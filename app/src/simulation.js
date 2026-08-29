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

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const RELATIONSHIP_STATE_KEYS = Object.freeze(Object.keys(DEFAULT_RELATIONSHIP_STATE));

function isValidRelationshipStateShape(candidate) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
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

function createRelationshipState() {
  return Object.fromEntries(RELATIONSHIPS.map((definition) => [definition.id, {
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

export function createInitialState() {
  return {
    schemaVersion: 3,
    seed: "baseline-0",
    year: START_YEAR,
    budget: 100,
    selectedAction: "verification",
    selectedActor: "B1",
    selectedRelationshipId: REPRESENTATIVE_RELATIONSHIP_ID,
    relationships: createRelationshipState(),
    metrics: { coordinationCapital: 42, verification: 38, interoperability: 35, autonomy: 48, legitimacy: 55, continuity: 28, concentration: 22, surveillance: 18, dependency: 48 },
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

export function migrateSimulationState(candidate) {
  if (candidate?.schemaVersion === 3) {
    return { ...candidate, stressTests: normalizeStressTests(candidate.stressTests) };
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
    return {
      ...candidate,
      schemaVersion: 3,
      relationships,
      stressTests: normalizeStressTests(candidate.stressTests),
    };
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
    !definition || typeof definition !== "object" || Array.isArray(definition) || typeof definition.id !== "string"
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
    if (!actorIds.has(relationship.source) || !actorIds.has(relationship.target)) errors.push(`${mapKey}: unknown actor endpoint`);
    for (const field of ["label", "purpose", "channel", "ownership", "investable", "contested"]) {
      if (relationship[field] !== definition[field]) errors.push(`${mapKey}: ${field} drift`);
    }
    for (const field of ["purpose", "channel", "ownership"]) {
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
    if (definition.investable) {
      if (!isValidRelationshipStateShape(definition.initialState)) {
        errors.push(`${mapKey}: calibrated definition baseline is invalid`);
      } else if (matchesCalibratedRelationship(relationship, definition)) {
        calibrated += 1;
      } else {
        errors.push(`${mapKey}: calibrated fingerprint drift`);
      }
    } else {
      uncalibrated += 1;
      if (!isValidRelationshipStateShape(definition.initialState)) {
        errors.push(`${mapKey}: uncalibrated definition baseline is invalid`);
      } else if (canonicalizeJsonValue(relationship.state) !== canonicalizeJsonValue(definition.initialState)) {
        errors.push(`${mapKey}: uncalibrated state drift`);
      }
    }
  }
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
    relationship?.investable
    && definition?.investable
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
  const investableDefinitions = relationshipDefinitions.filter((definition) => definition.investable);
  const investableEntries = Object.entries(state.relationships).filter(([, relationship]) => relationship.investable);
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
  if (!Number.isFinite(state?.budget) || state.budget < 0 || state.budget > 100) {
    return { eligible: false, items: [], totalCost: 0, reason: "年間予算が不正です" };
  }
  const actionIds = allocations.map((allocation) => allocation.actionId);
  if (new Set(actionIds).size !== 1) {
    return { eligible: false, items: [], totalCost: 0, reason: "年間アクションは全配分で同一にしてください" };
  }
  const relationshipIds = allocations.map((allocation) => allocation.relationshipId);
  if (new Set(relationshipIds).size !== relationshipIds.length) {
    return { eligible: false, items: [], totalCost: 0, reason: "同じ接続へ複数の配分はできません" };
  }
  const portfolioReport = validateRelationshipPortfolio(state, relationshipDefinitions);
  if (!portfolioReport.valid) return { eligible: false, items: [], totalCost: 0, reason: "20接続ポートフォリオのschemaが不正です（校正済み接続を確認してください）", errors: portfolioReport.errors };
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
  const current = relationship.state;
  const initial = definition.initialState;
  const delta = (key) => current[key] - initial[key];
  const weightedDelta = (weights) => Object.entries(weights).reduce(
    (total, [key, weight]) => total + delta(key) * weight,
    0,
  );
  const { min, max } = RELATIONSHIP_CONTRIBUTION_LIMITS;
  return {
    relationshipId,
    relationshipLabel: relationship.label,
    attributionSafety: clamp(Math.round(weightedDelta(RELATIONSHIP_CONTRIBUTION_WEIGHTS.attributionSafety)), min, max),
    coordinationSurvival: clamp(Math.round(weightedDelta(RELATIONSHIP_CONTRIBUTION_WEIGHTS.coordinationSurvival)), min, max),
    civilianProtection: clamp(Math.round(weightedDelta(RELATIONSHIP_CONTRIBUTION_WEIGHTS.civilianProtection)), min, max),
  };
}

export function runStressTest(state, relationshipDefinitions = RELATIONSHIPS) {
  const { metrics } = state;
  if (hasUnresolvedInvestableRelationships(state, relationshipDefinitions)) return state;
  let ledger = state.ledger;
  const relationshipContributions = Object.values(state.relationships).filter((relationship) => relationship.investable).flatMap((relationship) => {
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
  const result = { year: state.year, durationDays: CRISIS_DAYS, turnHours: CRISIS_TURN_HOURS, turns: CRISIS_TURNS, attributionSafety, coordinationSurvival, civilianProtection, relationshipContributions, verdict: attributionSafety >= 70 && coordinationSurvival >= 70 ? "協調継続" : "改善余地" };
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
