import {
  CALIBRATION_VERSION,
  DEFAULT_RELATIONSHIP_STATE,
  RELATIONSHIP_ACTION_EFFECTS,
  RELATIONSHIP_CONTRIBUTION_LIMITS,
  RELATIONSHIP_CONTRIBUTION_WEIGHTS,
  REPRESENTATIVE_INITIAL_STATE,
} from "./calibration-v0.js";

export const START_YEAR = 2026;
export const END_YEAR = 2045;
export const CHECKPOINTS = [2030, 2035, 2040, 2045];
export const CRISIS_DAYS = 30;
export const CRISIS_TURN_HOURS = 6;
export const CRISIS_TURNS = (CRISIS_DAYS * 24) / CRISIS_TURN_HOURS;
export const REPRESENTATIVE_RELATIONSHIP_ID = "B1-C6";
export const RULE_VERSION = CALIBRATION_VERSION;

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

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
  { id: "translation", label: "翻訳", cost: 20, summary: "制度・用語・意図を共通言語へ変換する", project: "日米中研究機関の危機用語クロスウォーク", effects: { coordinationCapital: 7, legitimacy: 3, dependency: -2 } },
  { id: "verification", label: "検証", cost: 25, summary: "事実を共同で十分に確かめる", project: "日米中研究機関の共同検証プロトコル", effects: { verification: 10, coordinationCapital: 4, surveillance: 2 } },
  { id: "reversibility", label: "可逆化", cost: 20, summary: "いつでも戻せる対応手順を設計する", project: "段階的対応と共同停止条件の標準化", effects: { autonomy: 6, legitimacy: 4, concentration: -3 } },
  { id: "redundancy", label: "複線化", cost: 20, summary: "供給・通信・判断経路の単一依存を減らす", project: "宇宙・海洋・エネルギー情報経路の複線化", effects: { interoperability: 6, autonomy: 7, dependency: -8 } },
  { id: "coownership", label: "共同所有", cost: 15, summary: "成果とガバナンスを多元的に持つ", project: "共同検証ハブの多元ガバナンス移行", effects: { continuity: 9, coordinationCapital: 6, concentration: -6 } },
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
    state: { ...definition.initialState },
    lastChangedYear: null,
    lastAction: null,
  }]));
}

export function createInitialState() {
  return {
    schemaVersion: 2,
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
  if (candidate?.schemaVersion === 2) {
    return { ...candidate, stressTests: normalizeStressTests(candidate.stressTests) };
  }
  const initial = createInitialState();
  return {
    ...initial,
    ...(candidate ?? {}),
    schemaVersion: 2,
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

function effectiveDelta(delta, fatigue) {
  return delta > 1 ? delta - fatigue : delta;
}

export function previewRelationshipInvestment(state, actionId = state.selectedAction, relationshipId = state.selectedRelationshipId) {
  const relationship = state.relationships[relationshipId];
  const action = ACTIONS.find((item) => item.id === actionId);
  if (!relationship || !action) return { eligible: false, relationshipId, actionId, reason: "接続またはアクションが見つかりません" };
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
  const requestedMetricDeltas = Object.fromEntries(Object.entries(action.effects).map(([key, delta]) => [key, effectiveDelta(delta, fatigue)]));
  const after = { ...relationship.state };
  for (const [key, delta] of Object.entries(requestedDeltas)) {
    after[key] = key === "alternateRoutes" ? clamp(after[key] + delta, 0, 5) : clamp(after[key] + delta);
  }
  const deltas = Object.fromEntries(Object.keys(requestedDeltas).map((key) => [key, after[key] - relationship.state[key]]));
  const metricDeltas = Object.fromEntries(Object.entries(requestedMetricDeltas).map(([key, delta]) => [
    key,
    clamp(state.metrics[key] + delta) - state.metrics[key],
  ]));
  return {
    eligible: state.year < END_YEAR && state.budget >= action.cost,
    relationshipId,
    relationshipLabel: relationship.label,
    actionId: action.id,
    actionLabel: action.label,
    cost: action.cost,
    project: action.project,
    reason: state.year >= END_YEAR ? "2045年の最終評価に到達しています" : state.budget < action.cost ? "年間ポイントが不足しています" : "実行可能",
    before: { ...relationship.state },
    after,
    deltas,
    metricDeltas,
    tradeoffs: [...configured.tradeoffs],
  };
}

export function advanceYear(state) {
  const preview = previewRelationshipInvestment(state);
  if (!preview.eligible) return state;

  const metrics = { ...state.metrics };
  for (const [key, delta] of Object.entries(preview.metricDeltas)) metrics[key] = clamp(metrics[key] + delta);
  metrics.legitimacy = clamp(metrics.legitimacy - (metrics.concentration > 55 ? 2 : 0));
  metrics.continuity = clamp(metrics.continuity + Math.floor(metrics.coordinationCapital / 35));

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
    metricDeltas: preview.metricDeltas,
    tradeoffs: preview.tradeoffs,
    reason: `${preview.actionLabel}の年間投資を${preview.relationshipLabel}へ適用`,
    ruleVersion: RULE_VERSION,
    seed: state.seed,
  };
  return {
    ...state,
    year: nextYear,
    budget: 100,
    metrics,
    relationships: { ...state.relationships, [preview.relationshipId]: nextRelationship },
    history: [...state.history, { year: nextYear, action: preview.actionId, project: preview.project, relationshipId: preview.relationshipId, ledgerId }],
    ledger: [...state.ledger, ledgerEntry],
  };
}

export function getRelationshipContribution(state, relationshipId) {
  const relationship = state.relationships[relationshipId];
  const definition = RELATIONSHIPS.find((item) => item.id === relationshipId);
  if (!relationship || !definition) return null;
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

export function runStressTest(state) {
  const { metrics } = state;
  const relationshipContributions = Object.values(state.relationships).filter((relationship) => relationship.investable).map((relationship) => {
    const contribution = getRelationshipContribution(state, relationship.id);
    const ledgerEntry = [...state.ledger].reverse().find((entry) => entry.relationshipId === relationship.id && entry.year <= state.year);
    return { ...contribution, checkpointYear: state.year, ledgerEntryId: ledgerEntry?.id ?? null };
  });
  const contribution = relationshipContributions.reduce((total, item) => ({
    attributionSafety: total.attributionSafety + item.attributionSafety,
    coordinationSurvival: total.coordinationSurvival + item.coordinationSurvival,
    civilianProtection: total.civilianProtection + item.civilianProtection,
  }), { attributionSafety: 0, coordinationSurvival: 0, civilianProtection: 0 });
  const attributionSafety = clamp(Math.round(metrics.verification * 0.45 + metrics.coordinationCapital * 0.25 + metrics.autonomy * 0.2 - metrics.surveillance * 0.1 + contribution.attributionSafety));
  const coordinationSurvival = clamp(Math.round(metrics.interoperability * 0.3 + metrics.continuity * 0.35 + metrics.legitimacy * 0.25 - metrics.concentration * 0.1 + contribution.coordinationSurvival));
  const civilianProtection = clamp(Math.round(metrics.legitimacy * 0.35 + metrics.autonomy * 0.3 + metrics.verification * 0.2 - metrics.dependency * 0.15 + contribution.civilianProtection));
  const result = { year: state.year, durationDays: CRISIS_DAYS, turnHours: CRISIS_TURN_HOURS, turns: CRISIS_TURNS, attributionSafety, coordinationSurvival, civilianProtection, relationshipContributions, verdict: attributionSafety >= 70 && coordinationSurvival >= 70 ? "協調継続" : "改善余地" };
  return { ...state, stressTests: { ...state.stressTests, [state.year]: result } };
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

export function getFinalAssessment(state) {
  const { metrics } = state;
  const score = clamp(Math.round(metrics.continuity * 0.35 + metrics.coordinationCapital * 0.2 + metrics.verification * 0.15 + metrics.interoperability * 0.15 + metrics.autonomy * 0.15 - metrics.concentration * 0.08 - metrics.surveillance * 0.05 - metrics.dependency * 0.07));
  return { score, passed: state.year === END_YEAR && score >= 70 && metrics.continuity >= 70, label: score >= 70 ? "自律継続圏" : score >= 50 ? "移行途上" : "日本依存" };
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
