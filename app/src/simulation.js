import {
  AGGREGATE_ACTION_EFFECTS,
  CRISIS_METRIC_WEIGHTS,
  CALIBRATION_VERSION,
  DEFAULT_RELATIONSHIP_STATE,
  FINAL_ASSESSMENT_WEIGHTS,
  RELATIONSHIP_ACTION_EFFECTS,
  RELATIONSHIP_BENEFIT_DIRECTIONS,
  RELATIONSHIP_CONTRIBUTION_LIMITS,
  RELATIONSHIP_CONTRIBUTION_WEIGHTS,
  REPRESENTATIVE_INITIAL_STATE,
  SCHEMA_V2_REPRESENTATIVE_CALIBRATION,
} from "./calibration-v0.js";

export const START_YEAR = 2026;
export const END_YEAR = 2045;
const isValidSimulationYear = (year) => Number.isInteger(year) && year >= START_YEAR && year <= END_YEAR;
const INITIAL_METRICS = Object.freeze({
  coordinationCapital: 42,
  verification: 38,
  interoperability: 35,
  autonomy: 48,
  legitimacy: 55,
  continuity: 28,
  concentration: 22,
  surveillance: 18,
  dependency: 48,
});
const SIMULATION_METRIC_KEYS = Object.freeze(Object.keys(INITIAL_METRICS));
const RELATIONSHIP_STATE_KEYS = Object.freeze(Object.keys(DEFAULT_RELATIONSHIP_STATE));
const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim().length > 0;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function isValidRelationshipStateShape(candidate) {
  if (!isRecord(candidate)) return false;
  const stateKeys = Object.keys(candidate).sort();
  if (stateKeys.join("|") !== [...RELATIONSHIP_STATE_KEYS].sort().join("|")) return false;
  for (const key of RELATIONSHIP_STATE_KEYS) {
    const value = candidate[key];
    const max = key === "alternateRoutes" ? 5 : 100;
    if (!Number.isFinite(value) || value < 0 || value > max) return false;
    if (key === "alternateRoutes" && !Number.isInteger(value)) return false;
  }
  return true;
}

function deriveRelationshipContribution(before, after, relationshipId, relationshipLabel) {
  if (!isValidRelationshipStateShape(before) || !isValidRelationshipStateShape(after)) return null;
  const delta = (key) => after[key] - before[key];
  const weightedDelta = (weights) => Object.entries(weights).reduce(
    (total, [key, weight]) => total + delta(key) * weight,
    0,
  );
  const { min, max } = RELATIONSHIP_CONTRIBUTION_LIMITS;
  return {
    relationshipId,
    relationshipLabel,
    attributionSafety: clamp(Math.round(weightedDelta(RELATIONSHIP_CONTRIBUTION_WEIGHTS.attributionSafety)), min, max),
    coordinationSurvival: clamp(Math.round(weightedDelta(RELATIONSHIP_CONTRIBUTION_WEIGHTS.coordinationSurvival)), min, max),
    civilianProtection: clamp(Math.round(weightedDelta(RELATIONSHIP_CONTRIBUTION_WEIGHTS.civilianProtection)), min, max),
  };
}

function validateNumericDeltaMap(deltas, label, allowedKeys, before = null, after = null) {
  const errors = [];
  if (!isRecord(deltas)) {
    errors.push(`${label} must be an object`);
    return errors;
  }
  const allowed = new Set(allowedKeys);
  for (const [key, value] of Object.entries(deltas)) {
    if (!allowed.has(key)) errors.push(`${label} has unexpected key ${key}`);
    if (!Number.isFinite(value)) errors.push(`${label}.${key} must be a finite number`);
    else if (
      isRecord(before)
      && isRecord(after)
      && Number.isFinite(before[key])
      && Number.isFinite(after[key])
      && value !== after[key] - before[key]
    ) {
      errors.push(`${label}.${key} must equal after-before`);
    }
  }
  if (isRecord(before) && isRecord(after)) {
    for (const key of allowedKeys) {
      if (!Number.isFinite(before[key]) || !Number.isFinite(after[key]) || before[key] === after[key]) continue;
      if (!Object.prototype.hasOwnProperty.call(deltas, key)) {
        errors.push(`${label} missing required key ${key}`);
      }
    }
  }
  return errors;
}

function validateLedgerEntries(ledger, state, relationshipDefinitions = RELATIONSHIPS) {
  if (!Array.isArray(ledger)) return ["ledger must be an array"];
  const errors = [];
  const ids = new Set();
  for (const entry of ledger) {
    if (!isRecord(entry)) {
      errors.push("ledger entries must be objects");
      continue;
    }
    if (!isNonEmptyString(entry.id) || ids.has(entry.id)) errors.push("ledger entry IDs must be nonempty and unique");
    else ids.add(entry.id);
    if (!isValidSimulationYear(entry.year)) errors.push("ledger entry year must be within the simulation horizon");
    else if (Number.isInteger(state?.year) && entry.year > state.year) {
      errors.push("ledger entry year cannot exceed the current simulation year");
    }
    for (const field of ["relationshipId", "relationshipLabel", "action", "actionLabel", "project", "reason", "ruleVersion"]) {
      if (!isNonEmptyString(entry[field])) errors.push(`ledger entry ${field} must be nonempty`);
    }
    if (!isNonEmptyString(entry.seed) || entry.seed !== state.seed) {
      errors.push("ledger entry seed must match the simulation seed");
    }
    if (!isValidRelationshipStateShape(entry.before) || !isValidRelationshipStateShape(entry.after)) {
      errors.push("ledger entry before/after must match the relationship state schema");
    }
    errors.push(...validateNumericDeltaMap(entry.deltas, "ledger entry deltas", RELATIONSHIP_STATE_KEYS, entry.before, entry.after));
    errors.push(...validateNumericDeltaMap(entry.metricDeltas, "ledger entry metricDeltas", SIMULATION_METRIC_KEYS));
    if (entry.action !== "checkpoint-snapshot") {
      const spillover = entry.effects?.spillover;
      if (!isRecord(spillover) || canonicalizeJsonValue(entry.metricDeltas) !== canonicalizeJsonValue(spillover)) {
        errors.push("annual ledger metric deltas must match their recorded spillover effects");
      }
    }
    if (!Array.isArray(entry.tradeoffs)) errors.push("ledger entry tradeoffs must be an array");
    else if (entry.tradeoffs.some((item) => !isNonEmptyString(item))) {
      errors.push("ledger entry tradeoffs must be nonempty strings");
    }
    const relationship = state.relationships?.[entry.relationshipId];
    if (!relationship || relationship.label !== entry.relationshipLabel) errors.push("ledger entry must reference its canonical relationship");
    if (entry.action !== "checkpoint-snapshot") {
      const definition = Array.isArray(relationshipDefinitions)
        ? relationshipDefinitions.find((item) => item.id === entry.relationshipId)
        : null;
      if (!matchesCalibratedRelationship(relationship, definition)) {
        errors.push("annual ledger entry must reference a calibrated investable relationship");
      }
    }
    if (!Number.isFinite(entry.cost) || entry.cost < 0) errors.push("ledger entry cost must be a nonnegative finite number");
  }
  const annualByRelationship = new Map();
  const annualEntries = ledger.filter((entry) => isRecord(entry) && entry.action !== "checkpoint-snapshot");
  const annualYears = annualEntries.map((entry) => entry.year);
  if (new Set(annualYears).size !== annualYears.length) {
    errors.push("annual ledger must contain exactly one action per year");
  }
  annualEntries.forEach((entry) => {
    const entries = annualByRelationship.get(entry.relationshipId) ?? [];
    entries.push(entry);
    annualByRelationship.set(entry.relationshipId, entries);
  });
  for (const [relationshipId, entries] of annualByRelationship) {
    const definition = Array.isArray(relationshipDefinitions)
      ? relationshipDefinitions.find((item) => item.id === relationshipId)
      : null;
    const relationship = state.relationships?.[relationshipId];
    const ordered = [...entries].sort((left, right) => left.year - right.year);
    if (!definition || !relationship || ordered.some((entry) => !isValidRelationshipStateShape(entry.before) || !isValidRelationshipStateShape(entry.after))) continue;
    if (canonicalizeJsonValue(ordered[0].before) !== canonicalizeJsonValue(definition.initialState)) {
      errors.push("annual ledger timeline must start from the calibrated baseline");
    }
    for (let index = 1; index < ordered.length; index += 1) {
      if (canonicalizeJsonValue(ordered[index].before) !== canonicalizeJsonValue(ordered[index - 1].after)) {
        errors.push("annual ledger timeline must be continuous");
      }
    }
    if (canonicalizeJsonValue(ordered.at(-1).after) !== canonicalizeJsonValue(relationship.state)) {
      errors.push("annual ledger timeline must end at the current relationship state");
    }
  }
  return errors;
}

function replayAnnualTimeline(state, relationshipDefinitions = RELATIONSHIPS, { allowMissingDerived = false } = {}) {
  const errors = [];
  const annualEntries = Array.isArray(state?.ledger)
    ? state.ledger.filter((entry) => isRecord(entry) && entry.action !== "checkpoint-snapshot")
    : [];
  const expectedYears = Number.isInteger(state?.year) && state.year >= START_YEAR
    ? Array.from({ length: state.year - START_YEAR }, (_, index) => START_YEAR + index + 1)
    : [];
  if (canonicalizeJsonValue(annualEntries.map((entry) => entry.year)) !== canonicalizeJsonValue(expectedYears)) {
    errors.push("annual ledger must cover every elapsed simulation year");
  }
  const history = Array.isArray(state?.history) ? state.history : [];
  if (history.length !== annualEntries.length) errors.push("history must project every annual ledger entry exactly once");

  let replay = { ...createInitialState(relationshipDefinitions), seed: state?.seed };
  const snapshotsByYear = new Map([[START_YEAR, {
    metrics: { ...replay.metrics },
    relationships: structuredClone(replay.relationships),
  }]]);
  const expectedByLedgerId = new Map();
  for (let index = 0; index < annualEntries.length; index += 1) {
    const entry = annualEntries[index];
    const expectedYear = START_YEAR + index + 1;
    if (entry.year !== expectedYear) continue;
    if (CHECKPOINTS.includes(replay.year)) replay = { ...replay, stressTests: { ...replay.stressTests, [replay.year]: { replayMarker: true } } };
    const preview = previewRelationshipInvestment(replay, entry.action, entry.relationshipId, relationshipDefinitions);
    if (!preview.eligible) {
      errors.push("annual ledger action cannot be replayed from the canonical timeline");
      continue;
    }
    const relationship = replay.relationships[entry.relationshipId];
    const expectedEffects = {
      direct: preview.deltas,
      spillover: preview.metricDeltas,
      conflict: relationship.contested ? ["係争接続への投資"] : [],
      sideEffects: preview.tradeoffs,
    };
    const expectedFields = {
      id: `${expectedYear}:${preview.relationshipId}:${preview.actionId}:${state.ledger.indexOf(entry) + 1}`,
      year: expectedYear,
      relationshipLabel: preview.relationshipLabel,
      action: preview.actionId,
      actionLabel: preview.actionLabel,
      project: preview.project,
      cost: preview.cost,
      before: preview.before,
      after: preview.after,
      deltas: preview.deltas,
      effectRealization: preview.effectRealization,
      metricDeltas: preview.metricDeltas,
      tradeoffs: preview.tradeoffs,
      reason: `${preview.actionLabel}の年間投資を${preview.relationshipLabel}へ適用`,
      ruleVersion: RULE_VERSION,
      seed: state.seed,
    };
    for (const [field, expected] of Object.entries(expectedFields)) {
      if (canonicalizeJsonValue(entry[field]) !== canonicalizeJsonValue(expected)) {
        errors.push(`annual ledger ${field} must match canonical action replay`);
      }
    }
    if ((!allowMissingDerived || entry.effects != null) && canonicalizeJsonValue(entry.effects) !== canonicalizeJsonValue(expectedEffects)) {
      errors.push("annual ledger effects must match canonical action replay");
    }
    const historyEntry = history[index];
    const expectedHistory = {
      year: expectedYear,
      action: preview.actionId,
      project: preview.project,
      relationshipId: preview.relationshipId,
      ledgerId: entry.id,
    };
    if (canonicalizeJsonValue(historyEntry) !== canonicalizeJsonValue(expectedHistory)) {
      errors.push("history must match its canonical annual ledger projection");
    }
    const nextRelationship = { ...relationship, state: { ...preview.after }, lastChangedYear: expectedYear, lastAction: preview.actionId };
    replay = {
      ...replay,
      year: expectedYear,
      budget: 100,
      metrics: preview.metricsAfter,
      relationships: { ...replay.relationships, [preview.relationshipId]: nextRelationship },
      history: [...replay.history, expectedHistory],
      ledger: [...replay.ledger, entry],
    };
    expectedByLedgerId.set(entry.id, { ...expectedFields, effects: expectedEffects });
    snapshotsByYear.set(expectedYear, {
      metrics: { ...replay.metrics },
      relationships: structuredClone(replay.relationships),
    });
  }
  if (annualEntries.length === expectedYears.length) {
    if (canonicalizeJsonValue(replay.metrics) !== canonicalizeJsonValue(state.metrics)) {
      errors.push("current metrics must match canonical annual replay");
    }
    if (canonicalizeJsonValue(replay.relationships) !== canonicalizeJsonValue(state.relationships)) {
      errors.push("current relationships must match canonical annual replay");
    }
  }
  return { valid: errors.length === 0, errors, snapshotsByYear, expectedByLedgerId };
}

function validateStoredStressTests(stressTests, ledger, state, relationshipDefinitions = RELATIONSHIPS, replayReport = null) {
  if (!isRecord(stressTests)) return ["stressTests must be an object"];
  const errors = [];
  const referencedCheckpointIds = new Set();
  for (const checkpoint of CHECKPOINTS.filter((year) => year < state.year)) {
    if (!isRecord(stressTests[checkpoint])) errors.push("every crossed checkpoint must retain its stress result");
  }
  const ledgerById = new Map(Array.isArray(ledger) ? ledger.filter(isRecord).map((entry) => [entry.id, entry]) : []);
  const expectedContributionIds = Object.values(state?.relationships ?? {})
    .filter((relationship) => {
      if (!isRecord(relationship) || !isNonEmptyString(relationship.id)) return false;
      const definition = Array.isArray(relationshipDefinitions)
        ? relationshipDefinitions.find((item) => item.id === relationship.id)
        : null;
      return matchesCalibratedRelationship(relationship, definition);
    })
    .map((relationship) => relationship.id)
    .sort();
  for (const [yearKey, result] of Object.entries(stressTests)) {
    const year = Number(yearKey);
    if (!isValidSimulationYear(year) || !isRecord(result) || result.year !== year) {
      errors.push("stored stress result year must match a simulation year");
      continue;
    }
    if (Number.isInteger(state?.year) && year > state.year) {
      errors.push("stored stress result year cannot exceed the current simulation year");
    }
    if (result.durationDays !== CRISIS_DAYS || result.turnHours !== CRISIS_TURN_HOURS || result.turns !== CRISIS_TURNS) {
      errors.push("stored stress result must use the canonical crisis duration");
    }
    const snapshotKeys = Object.keys(result.metricsSnapshot ?? {}).sort();
    let metricsSnapshotValid = snapshotKeys.join("|") === [...SIMULATION_METRIC_KEYS].sort().join("|");
    for (const key of SIMULATION_METRIC_KEYS) {
      const value = result.metricsSnapshot?.[key];
      if (!Number.isFinite(value) || value < 0 || value > 100) metricsSnapshotValid = false;
    }
    if (!metricsSnapshotValid) errors.push("stored stress result must contain a canonical metrics snapshot");
    const replaySnapshot = replayReport?.snapshotsByYear?.get(year);
    if (metricsSnapshotValid && replaySnapshot && canonicalizeJsonValue(result.metricsSnapshot) !== canonicalizeJsonValue(replaySnapshot.metrics)) {
      errors.push("stored stress metrics snapshot must match its replayed simulation year");
    }
    if (!Array.isArray(result.relationshipContributions) || result.relationshipContributions.length === 0) {
      errors.push("stored stress result must contain causal relationship contributions");
      continue;
    }
    const contributionIds = result.relationshipContributions.map((contribution) => contribution?.relationshipId);
    if (contributionIds.some((id) => !isNonEmptyString(id)) || new Set(contributionIds).size !== contributionIds.length) {
      errors.push("stored stress contributions must uniquely identify each calibrated relationship");
    }
    if (canonicalizeJsonValue([...contributionIds].sort()) !== canonicalizeJsonValue(expectedContributionIds)) {
      errors.push("stored stress contributions must cover exactly the calibrated relationships");
    }
    let contributionsValid = true;
    for (const contribution of result.relationshipContributions) {
      if (!isRecord(contribution) || !isNonEmptyString(contribution.relationshipId) || !isNonEmptyString(contribution.relationshipLabel)
        || contribution.checkpointYear !== year || !isNonEmptyString(contribution.ledgerEntryId)) {
        errors.push("stored stress contribution identity is invalid");
        contributionsValid = false;
        continue;
      }
      const ledgerEntry = ledgerById.get(contribution.ledgerEntryId);
      if (isNonEmptyString(contribution.ledgerEntryId)) referencedCheckpointIds.add(contribution.ledgerEntryId);
      const relationship = state.relationships?.[contribution.relationshipId];
      const definition = Array.isArray(relationshipDefinitions)
        ? relationshipDefinitions.find((item) => item.id === contribution.relationshipId)
        : null;
      if (!relationship || relationship.label !== contribution.relationshipLabel) {
        errors.push("stored stress contribution relationship is invalid");
        contributionsValid = false;
      }
      if (!matchesCalibratedRelationship(relationship, definition)) {
        errors.push("stored stress contribution must reference a calibrated investable relationship");
        contributionsValid = false;
      }
      if (!ledgerEntry || ledgerEntry.relationshipId !== contribution.relationshipId || ledgerEntry.year !== year
        || ledgerEntry.action !== "checkpoint-snapshot") {
        errors.push("stored stress contribution must reference its checkpoint ledger entry");
        contributionsValid = false;
        continue;
      }
      if (!definition || !isRecord(relationship)) {
        errors.push("stored stress contribution relationship definition is missing");
        contributionsValid = false;
        continue;
      }
      if (canonicalizeJsonValue(ledgerEntry.before) !== canonicalizeJsonValue(definition.initialState)) {
        errors.push("checkpoint before must match the calibrated baseline");
        contributionsValid = false;
      }
      const replayRelationship = replaySnapshot?.relationships?.[contribution.relationshipId];
      if (replayRelationship && canonicalizeJsonValue(ledgerEntry.after) !== canonicalizeJsonValue(replayRelationship.state)) {
        errors.push("checkpoint after must match its replayed relationship state");
        contributionsValid = false;
      }
      const { min, max } = RELATIONSHIP_CONTRIBUTION_LIMITS;
      for (const field of ["attributionSafety", "coordinationSurvival", "civilianProtection"]) {
        if (!Number.isFinite(contribution[field]) || contribution[field] < min || contribution[field] > max) {
          errors.push(`stored stress contribution ${field} is outside its calibrated limits`);
          contributionsValid = false;
        }
      }
      const expectedContribution = deriveRelationshipContribution(
        ledgerEntry.before,
        ledgerEntry.after,
        contribution.relationshipId,
        contribution.relationshipLabel,
      );
      if (
        !expectedContribution
        || expectedContribution.attributionSafety !== contribution.attributionSafety
        || expectedContribution.coordinationSurvival !== contribution.coordinationSurvival
        || expectedContribution.civilianProtection !== contribution.civilianProtection
      ) {
        errors.push("stored stress contribution does not match its checkpoint snapshot");
        contributionsValid = false;
      }
    }
    if (contributionsValid && metricsSnapshotValid) {
      const contributionTotals = result.relationshipContributions.reduce((total, item) => ({
        attributionSafety: total.attributionSafety + item.attributionSafety,
        coordinationSurvival: total.coordinationSurvival + item.coordinationSurvival,
        civilianProtection: total.civilianProtection + item.civilianProtection,
      }), { attributionSafety: 0, coordinationSurvival: 0, civilianProtection: 0 });
      const weightedMetrics = (weights) => Object.entries(weights).reduce(
        (total, [key, weight]) => total + result.metricsSnapshot[key] * weight,
        0,
      );
      const expectedScores = {
        attributionSafety: clamp(Math.round(weightedMetrics(CRISIS_METRIC_WEIGHTS.attributionSafety) + contributionTotals.attributionSafety)),
        coordinationSurvival: clamp(Math.round(weightedMetrics(CRISIS_METRIC_WEIGHTS.coordinationSurvival) + contributionTotals.coordinationSurvival)),
        civilianProtection: clamp(Math.round(weightedMetrics(CRISIS_METRIC_WEIGHTS.civilianProtection) + contributionTotals.civilianProtection)),
      };
      for (const field of ["attributionSafety", "coordinationSurvival", "civilianProtection"]) {
        if (result[field] !== expectedScores[field]) {
          errors.push(`stored stress result ${field} does not match recomputed evidence`);
        }
      }
      const expectedVerdict = expectedScores.attributionSafety >= 70 && expectedScores.coordinationSurvival >= 70 ? "協調継続" : "改善余地";
      if (result.verdict !== expectedVerdict) errors.push("stored stress result verdict contradicts its scores");
    } else {
      for (const field of ["attributionSafety", "coordinationSurvival", "civilianProtection"]) {
        if (!Number.isFinite(result[field]) || result[field] < 0 || result[field] > 100) {
          errors.push(`stored stress result ${field} must be within 0-100`);
        }
      }
      if (contributionsValid) {
        const expectedVerdict = result.attributionSafety >= 70 && result.coordinationSurvival >= 70 ? "協調継続" : "改善余地";
        if (result.verdict !== expectedVerdict) errors.push("stored stress result verdict contradicts its scores");
      }
    }
  }
  const checkpointLedgerIds = Array.isArray(ledger)
    ? ledger.filter((entry) => isRecord(entry) && entry.action === "checkpoint-snapshot").map((entry) => entry.id).sort()
    : [];
  if (canonicalizeJsonValue(checkpointLedgerIds) !== canonicalizeJsonValue([...referencedCheckpointIds].sort())) {
    errors.push("checkpoint ledger entries must exactly match stored stress contribution references");
  }
  return errors;
}

export function validateSimulationExecutionState(state, relationshipDefinitions = RELATIONSHIPS) {
  const errors = [];
  if (!state || typeof state !== "object" || Array.isArray(state)) {
    return { valid: false, errors: ["simulation state must be an object"], portfolio: null };
  }
  if (state.schemaVersion !== 3) errors.push("simulation state must use schema version 3");
  if (!isNonEmptyString(state.seed)) errors.push("seed must be a nonempty string");
  if (!isValidSimulationYear(state.year)) errors.push(`year must be an integer within ${START_YEAR}-${END_YEAR}`);
  if (!Number.isFinite(state.budget) || state.budget < 0 || state.budget > 100) errors.push("budget must be within 0-100");
  errors.push(...validateLedgerEntries(state.ledger, state, relationshipDefinitions));
  if (!Array.isArray(state.history)) errors.push("history must be an array");
  const replayReport = replayAnnualTimeline(state, relationshipDefinitions);
  errors.push(...replayReport.errors);
  errors.push(...validateStoredStressTests(state.stressTests, state.ledger, state, relationshipDefinitions, replayReport));
  const metricKeys = Object.keys(state.metrics ?? {}).sort();
  if (metricKeys.join("|") !== [...SIMULATION_METRIC_KEYS].sort().join("|")) errors.push("metrics schema drift");
  for (const key of SIMULATION_METRIC_KEYS) {
    const value = state.metrics?.[key];
    if (!Number.isFinite(value) || value < 0 || value > 100) errors.push(`${key} must be within 0-100`);
  }
  const portfolio = validateRelationshipPortfolio(state, relationshipDefinitions);
  errors.push(...portfolio.errors);
  return { valid: errors.length === 0, errors, portfolio };
}
export const CHECKPOINTS = [2030, 2035, 2040, 2045];
export const CRISIS_DAYS = 30;
export const CRISIS_TURN_HOURS = 6;
export const CRISIS_TURNS = (CRISIS_DAYS * 24) / CRISIS_TURN_HOURS;
export const REPRESENTATIVE_RELATIONSHIP_ID = "B1-C6";
export const RULE_VERSION = CALIBRATION_VERSION;

function canonicalizeJsonValue(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalizeJsonValue(item)).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalizeJsonValue(value[key])}`).join(",")}}`;
}

function relationshipCalibrationFingerprint(definition, version = CALIBRATION_VERSION) {
  return `${version}:${canonicalizeJsonValue(definition.initialState)}`;
}

function parseCalibrationFingerprint(fingerprint) {
  if (typeof fingerprint !== "string") return null;
  const separator = fingerprint.indexOf(":");
  if (separator <= 0) return null;
  try {
    return {
      version: fingerprint.slice(0, separator),
      initialState: JSON.parse(fingerprint.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

function calibrationFingerprintsMatch(left, right) {
  const parsedLeft = parseCalibrationFingerprint(left);
  const parsedRight = parseCalibrationFingerprint(right);
  if (!parsedLeft || !parsedRight) return left === right;
  return parsedLeft.version === parsedRight.version
    && canonicalizeJsonValue(parsedLeft.initialState) === canonicalizeJsonValue(parsedRight.initialState);
}

const SCHEMA_V2_CALIBRATION_FINGERPRINT = relationshipCalibrationFingerprint(
  SCHEMA_V2_REPRESENTATIVE_CALIBRATION,
  SCHEMA_V2_REPRESENTATIVE_CALIBRATION.version,
);

export const ACTORS = [
  { id: "J1", group: "日本", name: "内閣官房・事態対処室", x: 90, y: 70, portfolio: "verification" },
  { id: "J2", group: "日本", name: "外務省・戦略情報分析", x: 250, y: 65, portfolio: "verification" },
  { id: "J3", group: "日本", name: "防衛省・統合情報部", x: 420, y: 80, portfolio: "verification" },
  { id: "J4", group: "日本", name: "海上保安庁・第一管区", x: 570, y: 62, portfolio: "verification" },
  { id: "J5", group: "日本", name: "経済産業・供給網連携", x: 155, y: 250, portfolio: "interop" },
  { id: "J6", group: "日本", name: "民間プラットフォーム連携", x: 520, y: 250, portfolio: "interop" },
  { id: "U1", group: "米国", name: "太平洋軍・統合司令部", x: 710, y: 70, portfolio: "verification" },
  { id: "U2", group: "米国", name: "国務省・情報分析局", x: 335, y: 235, portfolio: "interop" },
  { id: "U3", group: "米国", name: "DHS・サイバー基盤", x: 675, y: 235, portfolio: "interop" },
  { id: "U4", group: "米国", name: "海洋警備隊・太平洋地域", x: 840, y: 80, portfolio: "verification" },
  { id: "U5", group: "米国", name: "民間セクター連携窓口", x: 800, y: 245, portfolio: "interop" },
  { id: "C1", group: "中国", name: "外交部・報道官室", x: 85, y: 420, portfolio: "ownership" },
  { id: "C2", group: "中国", name: "国防部・報道局", x: 235, y: 440, portfolio: "ownership" },
  { id: "C3", group: "中国", name: "海警局・南海方面", x: 840, y: 420, portfolio: "ownership" },
  { id: "C4", group: "中国", name: "商務部・国際経済協力", x: 690, y: 420, portfolio: "ownership" },
  { id: "C5", group: "中国", name: "国家網信弁・公共意見局", x: 390, y: 435, portfolio: "ownership" },
  { id: "C6", group: "中国", name: "研究機関・共同検証窓口", x: 545, y: 440, portfolio: "ownership" },
  { id: "B1", group: "BRIDGE", name: "検証・対話ハブ", x: 455, y: 245, portfolio: "interop" },
];

const RELATIONSHIP_PAIRS = [
  ["J1", "B1"], ["J2", "U2"], ["J3", "U1"], ["J4", "U4"],
  ["J5", "U5"], ["J6", "B1"], ["U2", "B1"], ["U3", "B1"],
  ["U5", "C4"], ["B1", "C6"], ["B1", "C5"], ["J2", "C1"],
  ["J5", "C4"], ["J4", "C3"], ["C4", "C6"], ["C1", "C5"],
  ["U1", "C3"], ["U4", "C3"], ["J6", "C6"], ["J1", "J5"],
];

const CONTESTED_RELATIONSHIPS = new Set(["U3-B1", "J2-C1", "U1-C3"]);

export const RELATIONSHIPS = RELATIONSHIP_PAIRS.map(([source, target]) => {
  const id = `${source}-${target}`;
  const investable = id === REPRESENTATIVE_RELATIONSHIP_ID;
  return {
    id,
    source,
    target,
    label: `${source} ↔ ${target}`,
    investable,
    contested: CONTESTED_RELATIONSHIPS.has(id),
    purpose: investable
      ? "公開可能な事実と検証手順を、政策判断より先に共有する。"
      : "P1では構造だけを表示し、係数と投資適格性は次段階で校正する。",
    channel: investable ? "共同検証プロトコル" : "未校正の接続チャネル",
    ownership: investable ? "共同所有 / 多元ガバナンス" : "P1未設定",
    initialState: { ...(investable ? REPRESENTATIVE_INITIAL_STATE : DEFAULT_RELATIONSHIP_STATE) },
  };
});

export const ACTIONS = [
  { id: "translation", label: "翻訳", cost: 20, summary: "制度・用語・意図を共通言語へ変換する", project: "日米中研究機関の危機用語クロスウォーク", effects: AGGREGATE_ACTION_EFFECTS.translation },
  { id: "verification", label: "検証", cost: 25, summary: "事実を共同で十分に確かめる", project: "日米中研究機関の共同検証プロトコル", effects: AGGREGATE_ACTION_EFFECTS.verification },
  { id: "reversibility", label: "可逆化", cost: 20, summary: "いつでも戻せる対応手順を設計する", project: "段階的対応と共同停止条件の標準化", effects: AGGREGATE_ACTION_EFFECTS.reversibility },
  { id: "redundancy", label: "複線化", cost: 20, summary: "供給・通信・判断経路の単一依存を減らす", project: "宇宙・海洋・エネルギー情報経路の複線化", effects: AGGREGATE_ACTION_EFFECTS.redundancy },
  { id: "coownership", label: "共同所有", cost: 15, summary: "成果とガバナンスを多元的に持つ", project: "共同検証ハブの多元ガバナンス移行", effects: AGGREGATE_ACTION_EFFECTS.coownership },
];

function createRelationshipState(relationshipDefinitions = RELATIONSHIPS) {
  return Object.fromEntries(relationshipDefinitions.map((definition) => [definition.id, {
    id: definition.id,
    source: definition.source,
    target: definition.target,
    label: definition.label,
    investable: definition.investable,
    contested: definition.contested,
    purpose: definition.purpose,
    channel: definition.channel,
    ownership: definition.ownership,
    calibrationFingerprint: definition.investable
      ? relationshipCalibrationFingerprint(definition)
      : null,
    state: { ...definition.initialState },
    lastChangedYear: null,
    lastAction: null,
  }]));
}

export function createInitialState(relationshipDefinitions = RELATIONSHIPS) {
  return {
    schemaVersion: 3,
    seed: "baseline-0",
    year: START_YEAR,
    budget: 100,
    selectedAction: "verification",
    selectedActor: "B1",
    selectedRelationshipId: REPRESENTATIVE_RELATIONSHIP_ID,
    relationships: createRelationshipState(relationshipDefinitions),
    metrics: { ...INITIAL_METRICS },
    history: [],
    ledger: [],
    stressTests: {},
  };
}

function normalizeStressTests(stressTests) {
  if (!stressTests || typeof stressTests !== "object" || Array.isArray(stressTests)) return {};
  return Object.fromEntries(Object.entries(stressTests).filter(([, result]) => (
    result
    && typeof result === "object"
    && Array.isArray(result.relationshipContributions)
    && result.relationshipContributions.length > 0
  )));
}

function backfillSchemaV3ExecutionEvidence(candidate) {
  const replayReport = replayAnnualTimeline(candidate, RELATIONSHIPS, { allowMissingDerived: true });
  const ledger = Array.isArray(candidate?.ledger) ? candidate.ledger.map((entry) => {
    const expected = replayReport.expectedByLedgerId.get(entry?.id);
    if (!replayReport.valid || !isRecord(entry) || entry.action === "checkpoint-snapshot" || isRecord(entry.effects) || !expected) return entry;
    return {
      ...entry,
      effects: structuredClone(expected.effects),
    };
  }) : [];
  const stressTests = Object.fromEntries(Object.entries(normalizeStressTests(candidate?.stressTests)).map(([year, result]) => [
    year,
    replayReport.valid && isRecord(result) && !isRecord(result.metricsSnapshot) && replayReport.snapshotsByYear.has(Number(year))
      ? { ...result, metricsSnapshot: { ...replayReport.snapshotsByYear.get(Number(year)).metrics } }
      : result,
  ]));
  return { ...candidate, ledger, stressTests };
}

export function migrateSimulationState(candidate) {
  if (candidate?.schemaVersion === 3) {
    return backfillSchemaV3ExecutionEvidence(candidate);
  }
  if (candidate?.schemaVersion === 2) {
    const relationships = Object.fromEntries(Object.entries(candidate.relationships ?? {}).map(([key, relationship]) => {
      const definition = RELATIONSHIPS.find((item) => item.id === key);
      const activeCalibrationFingerprint = definition?.investable
        ? relationshipCalibrationFingerprint(definition)
        : null;
      const existingFingerprint = relationship?.calibrationFingerprint ?? null;
      const canBackfillKnownV2 = Boolean(
        definition
        && key === relationship?.id
        && relationship.source === definition.source
        && relationship.target === definition.target
        && relationship.investable === definition.investable
        && definition.investable
        && activeCalibrationFingerprint === SCHEMA_V2_CALIBRATION_FINGERPRINT
      );
      let calibrationFingerprint = existingFingerprint;
      if (canBackfillKnownV2) {
        if (existingFingerprint == null || existingFingerprint === "") {
          // Absent provenance only: never overwrite an explicit conflicting baseline.
          calibrationFingerprint = SCHEMA_V2_CALIBRATION_FINGERPRINT;
        } else if (calibrationFingerprintsMatch(existingFingerprint, SCHEMA_V2_CALIBRATION_FINGERPRINT)) {
          calibrationFingerprint = SCHEMA_V2_CALIBRATION_FINGERPRINT;
        }
      }
      return [key, { ...relationship, calibrationFingerprint }];
    }));
    return backfillSchemaV3ExecutionEvidence({
      ...candidate,
      schemaVersion: 3,
      relationships,
      stressTests: normalizeStressTests(candidate.stressTests),
    });
  }
  const initial = createInitialState();
  return {
    ...initial,
    ...(candidate ?? {}),
    schemaVersion: 3,
    seed: candidate?.seed ?? initial.seed,
    metrics: { ...initial.metrics, ...(candidate?.metrics ?? {}) },
    relationships: createRelationshipState(),
    selectedRelationshipId: REPRESENTATIVE_RELATIONSHIP_ID,
    history: [...(candidate?.history ?? [])],
    ledger: [],
    stressTests: normalizeStressTests(candidate?.stressTests),
  };
}

export function selectAction(state, actionId) {
  if (!ACTIONS.some((action) => action.id === actionId)) return state;
  return { ...state, selectedAction: actionId };
}

export function selectActor(state, actorId) {
  if (!ACTORS.some((actor) => actor.id === actorId)) return state;
  return { ...state, selectedActor: actorId };
}

export function selectRelationship(state, relationshipId) {
  if (!state.relationships[relationshipId]) return state;
  return { ...state, selectedRelationshipId: relationshipId };
}

export function getSelectedRelationship(state) {
  return state.relationships[state.selectedRelationshipId] ?? state.relationships[REPRESENTATIVE_RELATIONSHIP_ID];
}

export function validateRelationshipPortfolio(state, relationshipDefinitions = RELATIONSHIPS) {
  const errors = [];
  const actorIds = new Set(ACTORS.map((actor) => actor.id));
  if (!Array.isArray(relationshipDefinitions) || relationshipDefinitions.some((definition) => (
    !definition
    || typeof definition !== "object"
    || Array.isArray(definition)
    || typeof definition.id !== "string"
    || definition.id.trim() === ""
  ))) {
    return { valid: false, total: Object.keys(state?.relationships ?? {}).length, calibration: { calibrated: 0, uncalibrated: 0 }, errors: ["relationship definitions must be an array of objects"] };
  }
  for (const definition of relationshipDefinitions) {
    if (typeof definition.source === "string" && definition.source.trim() !== "") actorIds.add(definition.source);
    if (typeof definition.target === "string" && definition.target.trim() !== "") actorIds.add(definition.target);
  }
  const definitionsById = new Map(relationshipDefinitions.map((definition) => [definition.id, definition]));
  if (relationshipDefinitions.length !== 20 || definitionsById.size !== 20) {
    errors.push(`relationship definitions must contain 20 unique ids; received ${relationshipDefinitions.length}/${definitionsById.size}`);
  }
  const entries = Object.entries(state?.relationships ?? {});
  if (entries.length !== 20) errors.push(`relationship state must contain 20 entries; received ${entries.length}`);

  let calibrated = 0;
  let uncalibrated = 0;
  for (const definition of relationshipDefinitions) {
    const baselineKeys = Object.keys(definition.initialState ?? {}).sort();
    if (baselineKeys.join("|") !== [...RELATIONSHIP_STATE_KEYS].sort().join("|")) errors.push(`${definition.id}: definition baseline schema drift`);
    for (const key of RELATIONSHIP_STATE_KEYS) {
      const value = definition.initialState?.[key];
      const max = key === "alternateRoutes" ? 5 : 100;
      if (!Number.isFinite(value) || value < 0 || value > max) errors.push(`${definition.id}: definition ${key} must be within 0-${max}`);
      if (key === "alternateRoutes" && Number.isFinite(value) && !Number.isInteger(value)) errors.push(`${definition.id}: definition alternateRoutes must be an integer`);
    }
  }
  for (const [mapKey, relationship] of entries) {
    const definition = definitionsById.get(mapKey);
    if (!relationship || typeof relationship !== "object" || Array.isArray(relationship)) {
      errors.push(`${mapKey}: relationship must be an object`);
      continue;
    }
    if (mapKey !== relationship.id) errors.push(`${mapKey}: map key must equal relationship id`);
    if (!definition) {
      errors.push(`${mapKey}: definition is missing`);
      continue;
    }
    if (relationship.source !== definition.source || relationship.target !== definition.target) {
      errors.push(`${mapKey}: source/target drift`);
    }
    if (relationship.source === relationship.target) errors.push(`${mapKey}: source and target must be distinct`);
    if (!actorIds.has(relationship.source) || !actorIds.has(relationship.target)) errors.push(`${mapKey}: unknown actor endpoint`);
    for (const field of ["investable", "contested"]) {
      if (typeof definition[field] !== "boolean") errors.push(`${mapKey}: definition ${field} must be boolean`);
      if (typeof relationship[field] !== "boolean") errors.push(`${mapKey}: ${field} must be boolean`);
    }
    for (const field of ["label", "purpose", "channel", "ownership", "investable", "contested"]) {
      if (relationship[field] !== definition[field]) errors.push(`${mapKey}: ${field} drift`);
    }
    for (const field of ["label", "purpose", "channel", "ownership"]) {
      if (typeof relationship[field] !== "string" || relationship[field].trim() === "") errors.push(`${mapKey}: ${field} is required`);
    }
    const stateKeys = Object.keys(relationship.state ?? {}).sort();
    if (stateKeys.join("|") !== [...RELATIONSHIP_STATE_KEYS].sort().join("|")) errors.push(`${mapKey}: state schema drift`);
    for (const key of RELATIONSHIP_STATE_KEYS) {
      const value = relationship.state?.[key];
      const max = key === "alternateRoutes" ? 5 : 100;
      if (!Number.isFinite(value) || value < 0 || value > max) errors.push(`${mapKey}: ${key} must be within 0-${max}`);
      if (key === "alternateRoutes" && Number.isFinite(value) && !Number.isInteger(value)) errors.push(`${mapKey}: alternateRoutes must be an integer`);
    }
    if (definition.investable === true) {
      if (!isValidRelationshipStateShape(definition.initialState)) {
        errors.push(`${mapKey}: calibrated definition baseline is invalid`);
      } else if (matchesCalibratedRelationship(relationship, definition)) {
        calibrated += 1;
      } else {
        errors.push(`${mapKey}: calibrated fingerprint drift`);
      }
    } else if (definition.investable === false) {
      uncalibrated += 1;
      if (!isValidRelationshipStateShape(definition.initialState)) {
        errors.push(`${mapKey}: uncalibrated definition baseline is invalid`);
      } else if (canonicalizeJsonValue(relationship.state) !== canonicalizeJsonValue(definition.initialState)) {
        errors.push(`${mapKey}: uncalibrated state drift`);
      }
    }
  }
  if (calibrated < 1) errors.push("relationship portfolio must contain at least one calibrated relationship");
  return { valid: errors.length === 0, total: entries.length, calibration: { calibrated, uncalibrated }, errors };
}

export function getRelationshipEdgePresentation(relationship) {
  const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
  const maturity = clamp(finiteOr(relationship?.state?.maturity, 0));
  const trust = clamp(finiteOr(relationship?.state?.trust, 0));
  const dependency = clamp(finiteOr(relationship?.state?.dependency, 100));
  const strength = clamp((maturity * 0.45) + (trust * 0.35) + ((100 - dependency) * 0.2));
  return {
    stroke: relationship?.contested ? "#d98b43" : strength >= 60 ? "#65c59b" : strength >= 40 ? "#66d4dc" : "#4b7f94",
    strokeWidth: 1 + (strength / 40),
    opacity: 0.3 + (strength / 145),
    strokeDasharray: relationship?.contested ? "5 6" : strength < 40 ? "3 4" : undefined,
  };
}

function effectiveDelta(delta, fatigue) {
  return delta > 1 ? delta - fatigue : delta;
}

const NUMERIC_TRADEOFF_SOURCES = {
  "開示コスト": ["relationship", "disclosureCost"],
  "監視化リスク": ["metric", "surveillance"],
};

const QUALITATIVE_TRADEOFF_SOURCES = {
  "維持経路が増える": ["relationship", "alternateRoutes"],
};

function formatSignedDelta(delta) {
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function materializeTradeoffs(configuredTradeoffs, relationshipDeltas, metricDeltas) {
  return configuredTradeoffs.flatMap((tradeoff) => {
    const qualitativeSource = QUALITATIVE_TRADEOFF_SOURCES[tradeoff];
    if (qualitativeSource) {
      const [scope, key] = qualitativeSource;
      const appliedDelta = scope === "relationship" ? relationshipDeltas[key] : metricDeltas[key];
      return appliedDelta > 0 ? [tradeoff] : [];
    }
    const match = tradeoff.match(/^(.+?) [+-]\d+$/);
    const source = match ? NUMERIC_TRADEOFF_SOURCES[match[1]] : null;
    if (!source) return [tradeoff];
    const [scope, key] = source;
    const appliedDelta = scope === "relationship" ? relationshipDeltas[key] : metricDeltas[key];
    return [`${match[1]} ${formatSignedDelta(appliedDelta ?? 0)}`];
  });
}

function calculateMetricsAfter(state, requestedMetricDeltas) {
  const metrics = { ...state.metrics };
  for (const [key, delta] of Object.entries(requestedMetricDeltas)) metrics[key] = clamp(metrics[key] + delta);
  metrics.legitimacy = clamp(metrics.legitimacy - (metrics.concentration > 55 ? 2 : 0));
  metrics.continuity = clamp(metrics.continuity + Math.floor(metrics.coordinationCapital / 35));
  return metrics;
}

function calculateEffectRealization(requestedDeltas, appliedDeltas) {
  let requestedBenefit = 0;
  let appliedBenefit = 0;
  for (const [key, requestedDelta] of Object.entries(requestedDeltas)) {
    const direction = RELATIONSHIP_BENEFIT_DIRECTIONS[key];
    const requestedProgress = Math.max(0, requestedDelta * direction);
    if (requestedProgress === 0) continue;
    requestedBenefit += requestedProgress;
    appliedBenefit += Math.max(0, appliedDeltas[key] * direction);
  }
  return requestedBenefit === 0 ? 0 : clamp(appliedBenefit / requestedBenefit, 0, 1);
}

function matchesCalibratedRelationship(relationship, definition) {
  return Boolean(
    relationship?.investable === true
    && definition?.investable === true
    && isValidRelationshipStateShape(definition?.initialState)
    && relationship.id === definition.id
    && relationship.source === definition.source
    && relationship.target === definition.target
    && calibrationFingerprintsMatch(
      relationship.calibrationFingerprint,
      relationshipCalibrationFingerprint(definition),
    )
  );
}

function hasUniqueCalibratedRelationship(state, definition) {
  const matches = Object.entries(state.relationships).filter(([, relationship]) => (
    matchesCalibratedRelationship(relationship, definition)
  ));
  return matches.length === 1 && matches[0][0] === definition.id;
}

function hasUnresolvedInvestableRelationships(state, relationshipDefinitions = RELATIONSHIPS) {
  if (
    relationshipDefinitions.some((definition) => typeof definition.investable !== "boolean")
    || Object.values(state.relationships).some((relationship) => typeof relationship.investable !== "boolean")
  ) return true;
  const investableDefinitions = relationshipDefinitions.filter((definition) => definition.investable === true);
  const investableEntries = Object.entries(state.relationships).filter(([, relationship]) => relationship.investable === true);
  return investableDefinitions.some((definition) => (
    !hasUniqueCalibratedRelationship(state, definition)
  )) || investableEntries.some(([key, relationship]) => (
    key !== relationship.id
    || !investableDefinitions.some((definition) => matchesCalibratedRelationship(relationship, definition))
  ));
}

export function previewRelationshipInvestment(state, actionId = state.selectedAction, relationshipId = state.selectedRelationshipId, relationshipDefinitions = RELATIONSHIPS) {
  const relationship = state.relationships[relationshipId];
  const action = ACTIONS.find((item) => item.id === actionId);
  if (!relationship || !action) return { eligible: false, relationshipId, actionId, reason: "接続またはアクションが見つかりません" };
  if (hasUnresolvedInvestableRelationships(state, relationshipDefinitions)) {
    return { eligible: false, relationshipId, actionId, reason: "校正済みの接続定義が見つかりません" };
  }
  if (!relationship.investable) {
    return {
      eligible: false,
      relationshipId,
      actionId,
      cost: action.cost,
      project: action.project,
      reason: "P1では B1 ↔ C6 だけを投資可能な代表接続として検証します",
      before: { ...relationship.state },
      after: { ...relationship.state },
      deltas: {},
      metricDeltas: {},
      tradeoffs: [],
    };
  }

  const yearsElapsed = state.year - START_YEAR;
  const fatigue = yearsElapsed >= 12 ? 1 : 0;
  const configured = RELATIONSHIP_ACTION_EFFECTS[action.id];
  const requestedDeltas = Object.fromEntries(Object.entries(configured.deltas).map(([key, delta]) => [key, effectiveDelta(delta, fatigue)]));
  const after = { ...relationship.state };
  for (const [key, delta] of Object.entries(requestedDeltas)) {
    after[key] = key === "alternateRoutes" ? clamp(after[key] + delta, 0, 5) : clamp(after[key] + delta);
  }
  const deltas = Object.fromEntries(Object.keys(requestedDeltas).map((key) => [key, after[key] - relationship.state[key]]));
  const effectRealization = calculateEffectRealization(requestedDeltas, deltas);
  const beneficialRelationshipChanged = effectRealization > 0;
  const requestedMetricDeltas = beneficialRelationshipChanged
    ? Object.fromEntries(Object.entries(action.effects).map(([key, delta]) => [
      key,
      Math.round(effectiveDelta(delta, fatigue) * effectRealization),
    ]))
    : {};
  const metricsAfter = beneficialRelationshipChanged
    ? calculateMetricsAfter(state, requestedMetricDeltas)
    : { ...state.metrics };
  const metricKeys = new Set(Object.keys(requestedMetricDeltas));
  for (const key of Object.keys(state.metrics)) {
    if (metricsAfter[key] !== state.metrics[key]) metricKeys.add(key);
  }
  const metricDeltas = Object.fromEntries([...metricKeys].map((key) => [key, metricsAfter[key] - state.metrics[key]]));
  const checkpointPending = state.year < END_YEAR && CHECKPOINTS.includes(state.year) && !state.stressTests[state.year];
  return {
    eligible: state.year < END_YEAR && state.budget >= action.cost && !checkpointPending && beneficialRelationshipChanged,
    relationshipId,
    relationshipLabel: relationship.label,
    actionId: action.id,
    actionLabel: action.label,
    cost: action.cost,
    project: action.project,
    reason: state.year >= END_YEAR ? "2045年の最終評価に到達しています" : checkpointPending ? `${state.year}年の終末の1ヶ月テストを先に記録してください` : state.budget < action.cost ? "年間ポイントが不足しています" : !beneficialRelationshipChanged ? "この接続への改善効果はすべて上限または下限に達しています" : "実行可能",
    before: { ...relationship.state },
    after,
    deltas,
    effectRealization,
    metricDeltas,
    metricsAfter,
    tradeoffs: materializeTradeoffs(configured.tradeoffs, deltas, metricDeltas),
  };
}

export function previewInvestmentPortfolio(state, allocations, relationshipDefinitions = RELATIONSHIPS) {
  if (!Array.isArray(allocations) || allocations.length < 1 || allocations.length > 3) {
    return { eligible: false, items: [], totalCost: 0, reason: "投資先は1〜3接続で指定してください" };
  }
  if (allocations.some((allocation) => (
    !allocation
    || typeof allocation !== "object"
    || Array.isArray(allocation)
    || typeof allocation.relationshipId !== "string"
    || allocation.relationshipId.trim() === ""
    || typeof allocation.actionId !== "string"
    || allocation.actionId.trim() === ""
  ))) {
    return { eligible: false, items: [], totalCost: 0, reason: "配分の接続IDとアクションIDが不正です" };
  }
  const stateReport = validateSimulationExecutionState(state, relationshipDefinitions);
  if (!stateReport.valid) return { eligible: false, items: [], totalCost: 0, reason: "シミュレーションstateが不正です", errors: stateReport.errors };
  const actionIds = allocations.map((allocation) => allocation.actionId);
  if (new Set(actionIds).size !== 1) {
    return { eligible: false, items: [], totalCost: 0, reason: "年間アクションは全配分で同一にしてください" };
  }
  const relationshipIds = allocations.map((allocation) => allocation.relationshipId);
  if (new Set(relationshipIds).size !== relationshipIds.length) {
    return { eligible: false, items: [], totalCost: 0, reason: "同じ接続へ複数の配分はできません" };
  }
  const items = allocations.map(({ relationshipId, actionId }) => (
    previewRelationshipInvestment(state, actionId, relationshipId, relationshipDefinitions)
  ));
  const invalid = items.find((item) => !item.eligible);
  if (invalid) return { eligible: false, items, totalCost: items.reduce((total, item) => total + (item.cost ?? 0), 0), reason: invalid.reason };
  const totalCost = items.reduce((total, item) => total + item.cost, 0);
  if (totalCost > state.budget) return { eligible: false, items, totalCost, reason: `年間予算${state.budget}を超過しています` };
  return { eligible: true, items, totalCost, reason: "実行可能" };
}

export function previewSelectedInvestment(state, relationshipDefinitions = RELATIONSHIPS) {
  const relationshipId = state.selectedRelationshipId;
  const actionId = state.selectedAction;
  const plan = previewInvestmentPortfolio(
    state,
    [{ relationshipId, actionId }],
    relationshipDefinitions,
  );
  const item = plan.items[0];
  if (item) {
    return plan.eligible
      ? item
      : {
        ...item,
        eligible: false,
        reason: plan.reason,
        ...(plan.errors ? { errors: plan.errors } : {}),
      };
  }
  return {
    eligible: false,
    relationshipId,
    actionId,
    reason: plan.reason,
    ...(plan.errors ? { errors: plan.errors } : {}),
    deltas: {},
    metricDeltas: {},
    tradeoffs: [],
  };
}

export function advanceYear(state, relationshipDefinitions = RELATIONSHIPS) {
  const preview = previewSelectedInvestment(state, relationshipDefinitions);
  if (!preview.eligible) return state;

  const nextYear = state.year + 1;
  const relationship = state.relationships[preview.relationshipId];
  const nextRelationship = { ...relationship, state: { ...preview.after }, lastChangedYear: nextYear, lastAction: preview.actionId };
  const ledgerId = `${nextYear}:${preview.relationshipId}:${preview.actionId}:${state.ledger.length + 1}`;
  const ledgerEntry = {
    id: ledgerId,
    year: nextYear,
    relationshipId: preview.relationshipId,
    relationshipLabel: preview.relationshipLabel,
    action: preview.actionId,
    actionLabel: preview.actionLabel,
    project: preview.project,
    cost: preview.cost,
    before: preview.before,
    after: preview.after,
    deltas: preview.deltas,
    effectRealization: preview.effectRealization,
    metricDeltas: preview.metricDeltas,
    tradeoffs: preview.tradeoffs,
    effects: {
      direct: preview.deltas,
      spillover: preview.metricDeltas,
      conflict: relationship.contested ? ["係争接続への投資"] : [],
      sideEffects: preview.tradeoffs,
    },
    reason: `${preview.actionLabel}の年間投資を${preview.relationshipLabel}へ適用`,
    ruleVersion: RULE_VERSION,
    seed: state.seed,
  };
  return {
    ...state,
    year: nextYear,
    budget: 100,
    metrics: preview.metricsAfter,
    relationships: { ...state.relationships, [preview.relationshipId]: nextRelationship },
    history: [...state.history, { year: nextYear, action: preview.actionId, project: preview.project, relationshipId: preview.relationshipId, ledgerId }],
    ledger: [...state.ledger, ledgerEntry],
  };
}

export function getRelationshipContribution(state, relationshipId, relationshipDefinitions = RELATIONSHIPS) {
  const relationship = state.relationships[relationshipId];
  const definition = relationshipDefinitions.find((item) => item.id === relationshipId);
  if (!hasUniqueCalibratedRelationship(state, definition)) return null;
  return deriveRelationshipContribution(
    definition.initialState,
    relationship.state,
    relationship.id,
    relationship.label,
  );
}

export function runStressTest(state, relationshipDefinitions = RELATIONSHIPS) {
  if (!validateSimulationExecutionState(state, relationshipDefinitions).valid) return state;
  const { metrics } = state;
  let ledger = state.ledger;
  const relationshipContributions = Object.values(state.relationships).filter((relationship) => relationship.investable === true).flatMap((relationship) => {
    const contribution = getRelationshipContribution(state, relationship.id, relationshipDefinitions);
    const definition = relationshipDefinitions.find((item) => item.id === relationship.id);
    if (!contribution || !definition) return [];
    const before = { ...definition.initialState };
    const after = { ...relationship.state };
    const ledgerEntry = {
        id: `${state.year}:${relationship.id}:cumulative-checkpoint-snapshot`,
        year: state.year,
        relationshipId: relationship.id,
        relationshipLabel: relationship.label,
        action: "checkpoint-snapshot",
        actionLabel: "危機テスト累積スナップショット",
        project: "初期状態から危機テスト時点までの累積因果スナップショット",
        cost: 0,
        before,
        after,
        deltas: Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - before[key]])),
        metricDeltas: {},
        tradeoffs: [],
        reason: "危機寄与と同じ初期状態からの累積変化を保存",
        ruleVersion: RULE_VERSION,
        seed: state.seed,
      };
    ledger = [...ledger.filter((entry) => entry.id !== ledgerEntry.id), ledgerEntry];
    return [{ ...contribution, checkpointYear: state.year, ledgerEntryId: ledgerEntry.id }];
  });
  const contribution = relationshipContributions.reduce((total, item) => ({
    attributionSafety: total.attributionSafety + item.attributionSafety,
    coordinationSurvival: total.coordinationSurvival + item.coordinationSurvival,
    civilianProtection: total.civilianProtection + item.civilianProtection,
  }), { attributionSafety: 0, coordinationSurvival: 0, civilianProtection: 0 });
  const weightedMetrics = (weights) => Object.entries(weights).reduce((total, [key, weight]) => total + metrics[key] * weight, 0);
  const attributionSafety = clamp(Math.round(weightedMetrics(CRISIS_METRIC_WEIGHTS.attributionSafety) + contribution.attributionSafety));
  const coordinationSurvival = clamp(Math.round(weightedMetrics(CRISIS_METRIC_WEIGHTS.coordinationSurvival) + contribution.coordinationSurvival));
  const civilianProtection = clamp(Math.round(weightedMetrics(CRISIS_METRIC_WEIGHTS.civilianProtection) + contribution.civilianProtection));
  const result = { year: state.year, durationDays: CRISIS_DAYS, turnHours: CRISIS_TURN_HOURS, turns: CRISIS_TURNS, metricsSnapshot: { ...metrics }, attributionSafety, coordinationSurvival, civilianProtection, relationshipContributions, verdict: attributionSafety >= 70 && coordinationSurvival >= 70 ? "協調継続" : "改善余地" };
  return { ...state, ledger, stressTests: { ...state.stressTests, [state.year]: result } };
}

export function getStressTestDisplayYears(state) {
  const latestExploratoryYear = Object.keys(state.stressTests)
    .map(Number)
    .filter((year) => !CHECKPOINTS.includes(year))
    .sort((left, right) => right - left)[0];
  return latestExploratoryYear === undefined
    ? CHECKPOINTS
    : [latestExploratoryYear, ...CHECKPOINTS];
}

export function getStressContributionFocus(state, checkpointYear, relationshipId) {
  const result = state.stressTests[checkpointYear];
  const contribution = result?.relationshipContributions?.find((item) => item.relationshipId === relationshipId);
  if (!contribution) return null;
  const ledgerEntry = state.ledger.find((entry) => entry.id === contribution.ledgerEntryId)
    ?? [...state.ledger].reverse().find((entry) => entry.relationshipId === relationshipId && entry.year <= checkpointYear);
  return {
    checkpointYear,
    relationshipId,
    ledgerEntryId: ledgerEntry?.id ?? null,
  };
}

const LEDGER_SIGNATURE_FIELDS = [
  ["trust", "信頼"],
  ["verificationAgreement", "検証合意"],
  ["maturity", "成熟度"],
  ["interoperability", "相互運用"],
  ["coOwnership", "共同所有"],
  ["dependency", "単一依存"],
  ["alternateRoutes", "代替経路"],
  ["disclosureCost", "開示コスト"],
];

/** 台帳1件からInspector / 接続選択へ戻る共通focus契約。危機寄与の逆引きと同じledgerEntryIdを使う。 */
export function getLedgerEntryFocus(state, ledgerEntryId) {
  const entry = state.ledger.find((item) => item.id === ledgerEntryId);
  if (!entry) return null;
  return {
    ledgerEntryId: entry.id,
    relationshipId: entry.relationshipId,
    year: entry.year,
  };
}

/** 署名表現用の代表差分。prefers-reduced-motionではこの静的文字列だけを出す。 */
export function getLedgerSignature(entry) {
  if (!entry?.before || !entry?.after) return null;
  let best = null;
  for (const [field, label] of LEDGER_SIGNATURE_FIELDS) {
    const before = entry.before[field];
    const after = entry.after[field];
    if (typeof before !== "number" || typeof after !== "number" || before === after) continue;
    const magnitude = Math.abs(after - before);
    if (!best || magnitude > best.magnitude) {
      best = { field, label, before, after, magnitude, year: entry.year };
    }
  }
  return best
    ? { year: best.year, label: best.label, before: best.before, after: best.after, text: `${best.year} ${best.label} ${best.before}→${best.after}` }
    : null;
}

export function listLedgerTrail(state) {
  return state.ledger.map((entry, index) => ({
    entry,
    ordinal: index + 1,
    signature: getLedgerSignature(entry),
  }));
}

export function getFinalAssessment(state) {
  const { metrics } = state;
  const score = clamp(Math.round(Object.entries(FINAL_ASSESSMENT_WEIGHTS).reduce((total, [key, weight]) => total + metrics[key] * weight, 0)));
  const finalStressPassed = state.stressTests[END_YEAR]?.verdict === "協調継続";
  const japanRemovalPassed = state.japanRemovalStressTest?.verdict === "協調継続";
  const passed = state.year === END_YEAR && finalStressPassed && japanRemovalPassed && score >= 70 && metrics.continuity >= 70;
  const label = state.year === END_YEAR && !state.stressTests[END_YEAR]
    ? "最終検証待ち"
    : state.year === END_YEAR && !finalStressPassed
      ? "最終検証未達"
      : state.year === END_YEAR && !japanRemovalPassed
        ? "撤退検証待ち"
      : passed ? "自律継続圏" : score >= 50 ? "移行途上" : "日本依存";
  return { score, passed, label };
}

export function createDemoState(year = 2035) {
  let state = createInitialState();
  const sequence = ["verification", "translation", "coownership", "redundancy", "reversibility"];
  while (state.year < Math.min(year, END_YEAR)) {
    state = selectAction(state, sequence[(state.year - START_YEAR) % sequence.length]);
    state = advanceYear(state);
    if (CHECKPOINTS.includes(state.year)) state = runStressTest(state);
  }
  return selectAction(state, "verification");
}
