export const START_YEAR = 2026;
export const END_YEAR = 2045;
export const CHECKPOINTS = [2030, 2035, 2040, 2045];

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export const ACTORS = [
  { id: "J1", group: "日本", name: "内閣官房・事態対処室", x: 90, y: 70, portfolio: "verification" },
  { id: "J2", group: "日本", name: "外務省・戦略情報分析", x: 250, y: 65, portfolio: "verification" },
  { id: "J3", group: "日本", name: "防衛省・統合情報部", x: 420, y: 80, portfolio: "verification" },
  { id: "J4", group: "日本", name: "海上保安庁・第一管区", x: 570, y: 62, portfolio: "verification" },
  { id: "J5", group: "日本", name: "経済産業・供給網連携", x: 155, y: 250, portfolio: "interop" },
  { id: "J6", group: "日本", name: "民間プラットフォーム連携", x: 520, y: 250, portfolio: "interop" },
  { id: "U1", group: "米国", name: "インド太平洋軍・司令部", x: 710, y: 70, portfolio: "verification" },
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

export const RELATIONSHIPS = [
  ["J1", "B1"], ["J2", "U2"], ["J3", "U1"], ["J4", "U4"],
  ["J5", "U5"], ["J6", "B1"], ["U2", "B1"], ["U3", "B1"],
  ["U5", "C4"], ["B1", "C6"], ["B1", "C5"], ["J2", "C1"],
  ["J5", "C4"], ["J4", "C3"], ["C4", "C6"], ["C1", "C5"],
  ["U1", "C3"], ["U4", "C3"], ["J6", "C6"], ["J1", "J5"],
];

export const ACTIONS = [
  {
    id: "translation",
    label: "翻訳",
    cost: 20,
    summary: "制度・用語・意図を共通言語へ変換する",
    project: "日米中研究機関の危機用語クロスウォーク",
    effects: { coordinationCapital: 7, legitimacy: 3, dependency: -2 },
  },
  {
    id: "verification",
    label: "検証",
    cost: 25,
    summary: "事実を共同で十分に確かめる",
    project: "日米中研究機関の共同検証プロトコル",
    effects: { verification: 10, coordinationCapital: 4, surveillance: 2 },
  },
  {
    id: "reversibility",
    label: "可逆化",
    cost: 20,
    summary: "いつでも戻せる対応手順を設計する",
    project: "段階的対応と共同停止条件の標準化",
    effects: { autonomy: 6, legitimacy: 4, concentration: -3 },
  },
  {
    id: "redundancy",
    label: "複線化",
    cost: 20,
    summary: "供給・通信・判断経路の単一依存を減らす",
    project: "宇宙・海洋・エネルギー情報経路の複線化",
    effects: { interoperability: 6, autonomy: 7, dependency: -8 },
  },
  {
    id: "coownership",
    label: "共同所有",
    cost: 15,
    summary: "成果とガバナンスを多元的に持つ",
    project: "共同検証ハブの多元ガバナンス移行",
    effects: { continuity: 9, coordinationCapital: 6, concentration: -6 },
  },
];

export function createInitialState() {
  return {
    year: START_YEAR,
    budget: 100,
    selectedAction: "verification",
    selectedActor: "B1",
    metrics: {
      coordinationCapital: 42,
      verification: 38,
      interoperability: 35,
      autonomy: 48,
      legitimacy: 55,
      continuity: 28,
      concentration: 22,
      surveillance: 18,
      dependency: 48,
    },
    history: [],
    stressTests: {},
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

export function advanceYear(state) {
  if (state.year >= END_YEAR) return state;
  const action = ACTIONS.find((item) => item.id === state.selectedAction) ?? ACTIONS[0];
  const yearsElapsed = state.year - START_YEAR;
  const fatigue = yearsElapsed >= 12 ? 1 : 0;
  const metrics = { ...state.metrics };
  for (const [key, delta] of Object.entries(action.effects)) {
    metrics[key] = clamp(metrics[key] + delta - (delta > 0 ? fatigue : 0));
  }
  metrics.legitimacy = clamp(metrics.legitimacy - (metrics.concentration > 55 ? 2 : 0));
  metrics.continuity = clamp(metrics.continuity + Math.floor(metrics.coordinationCapital / 35));

  const nextYear = state.year + 1;
  return {
    ...state,
    year: nextYear,
    budget: 100,
    metrics,
    history: [...state.history, { year: nextYear, action: action.id, project: action.project }],
  };
}

export function runStressTest(state) {
  const { metrics } = state;
  const attributionSafety = clamp(Math.round(
    metrics.verification * 0.45 + metrics.coordinationCapital * 0.25 +
    metrics.autonomy * 0.2 - metrics.surveillance * 0.1,
  ));
  const coordinationSurvival = clamp(Math.round(
    metrics.interoperability * 0.3 + metrics.continuity * 0.35 +
    metrics.legitimacy * 0.25 - metrics.concentration * 0.1,
  ));
  const civilianProtection = clamp(Math.round(
    metrics.legitimacy * 0.35 + metrics.autonomy * 0.3 +
    metrics.verification * 0.2 - metrics.dependency * 0.15,
  ));
  const result = {
    year: state.year,
    attributionSafety,
    coordinationSurvival,
    civilianProtection,
    verdict: attributionSafety >= 70 && coordinationSurvival >= 70 ? "協調継続" : "改善余地",
  };
  return {
    ...state,
    stressTests: { ...state.stressTests, [state.year]: result },
  };
}

export function getFinalAssessment(state) {
  const { metrics } = state;
  const score = clamp(Math.round(
    metrics.continuity * 0.35 + metrics.coordinationCapital * 0.2 +
    metrics.verification * 0.15 + metrics.interoperability * 0.15 +
    metrics.autonomy * 0.15 - metrics.concentration * 0.08 -
    metrics.surveillance * 0.05 - metrics.dependency * 0.07,
  ));
  return {
    score,
    passed: state.year === END_YEAR && score >= 70 && metrics.continuity >= 70,
    label: score >= 70 ? "自律継続圏" : score >= 50 ? "移行途上" : "日本依存",
  };
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
