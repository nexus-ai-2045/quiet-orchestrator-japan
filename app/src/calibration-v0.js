export const CALIBRATION_VERSION = "relationship-v1.0.0";

const deepFreeze = (value) => {
  Object.values(value).forEach((item) => {
    if (item && typeof item === "object" && !Object.isFrozen(item)) deepFreeze(item);
  });
  return Object.freeze(value);
};

export const DEFAULT_RELATIONSHIP_STATE = deepFreeze({
  maturity: 28,
  trust: 32,
  verificationAgreement: 30,
  interoperability: 30,
  coOwnership: 20,
  dependency: 52,
  alternateRoutes: 1,
  disclosureCost: 10,
});

export const REPRESENTATIVE_INITIAL_STATE = deepFreeze({
  maturity: 46,
  trust: 42,
  verificationAgreement: 38,
  interoperability: 36,
  coOwnership: 28,
  dependency: 48,
  alternateRoutes: 1,
  disclosureCost: 12,
});

// Positive means an increase is beneficial; negative means a decrease is beneficial.
// Aggregate effects are realized only in proportion to progress in these directions.
export const RELATIONSHIP_BENEFIT_DIRECTIONS = deepFreeze({
  maturity: 1,
  trust: 1,
  verificationAgreement: 1,
  interoperability: 1,
  coOwnership: 1,
  dependency: -1,
  alternateRoutes: 1,
  disclosureCost: -1,
});

export const RELATIONSHIP_ACTION_EFFECTS = deepFreeze({
  translation: {
    deltas: { maturity: 6, trust: 5, interoperability: 2, disclosureCost: 1 },
    tradeoffs: ["開示コスト +1"],
  },
  verification: {
    deltas: { maturity: 5, trust: 4, verificationAgreement: 12, dependency: -1, disclosureCost: 2 },
    tradeoffs: ["開示コスト +2", "監視化リスク +2"],
  },
  reversibility: {
    deltas: { maturity: 3, interoperability: 4, dependency: -4, alternateRoutes: 1 },
    tradeoffs: ["合意形成の速度を優先しない"],
  },
  redundancy: {
    deltas: { maturity: 4, interoperability: 7, dependency: -8, alternateRoutes: 1, disclosureCost: 1 },
    tradeoffs: ["開示コスト +1", "維持経路が増える"],
  },
  coownership: {
    deltas: { maturity: 4, trust: 3, coOwnership: 10, dependency: -5 },
    tradeoffs: ["日本の単独編集権を縮小"],
  },
});

export const AGGREGATE_ACTION_EFFECTS = deepFreeze({
  translation: { coordinationCapital: 7, legitimacy: 3, dependency: -2 },
  verification: { verification: 10, coordinationCapital: 4, surveillance: 2 },
  reversibility: { autonomy: 6, legitimacy: 4, concentration: -3 },
  redundancy: { interoperability: 6, autonomy: 7, dependency: -8 },
  coownership: { continuity: 9, coordinationCapital: 6, concentration: -6 },
});

export const RELATIONSHIP_CONTRIBUTION_WEIGHTS = deepFreeze({
  attributionSafety: {
    verificationAgreement: 0.28,
    trust: 0.14,
    disclosureCost: -0.08,
  },
  coordinationSurvival: {
    maturity: 0.12,
    interoperability: 0.18,
    coOwnership: 0.2,
    alternateRoutes: 1.5,
    dependency: -0.12,
  },
  civilianProtection: {
    interoperability: 0.15,
    trust: 0.1,
    alternateRoutes: 1.2,
    dependency: -0.12,
    disclosureCost: -0.05,
  },
});

export const RELATIONSHIP_CONTRIBUTION_LIMITS = deepFreeze({ min: -20, max: 25 });
