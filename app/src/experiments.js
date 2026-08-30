import { runCrisisSimulationBatch } from "./crisis.js";
import { observationFingerprint } from "./ai/contract.js";

export const EXPERIMENT_ENGINE_VERSION = "comparative-study-v2";
export const STRATEGIES = Object.freeze([{ id: "A", label: "ブロック分断" }, { id: "B", label: "同盟代理" }, { id: "C", label: "単独仲介" }, { id: "D", label: "網状調整" }, { id: "E", label: "調整崩壊" }]);
export const STUDY_SEEDS = Object.freeze(["cause-0", "cause-1", "cause-2", "cause-3", "cause-4"]);
export const SENSITIVITY_VARIANTS = Object.freeze([
  { id: "faster-correction-shorter-disruption", coefficients: Object.freeze({ attributionCorrectionOffset: -4, disruptionDurationScale: 0.75 }) },
  { id: "registered", coefficients: Object.freeze({ attributionCorrectionOffset: 0, disruptionDurationScale: 1 }) },
  { id: "slower-correction-longer-disruption", coefficients: Object.freeze({ attributionCorrectionOffset: 4, disruptionDurationScale: 1.25 }) },
].map(Object.freeze));
const endpoints = (id) => id.split("-");

function disabledFor(state, strategyId, seed) {
  const ids = Object.keys(state.relationships);
  if (strategyId === "A") return ids.filter((id) => !endpoints(id).every((actor) => actor[0] === endpoints(id)[0][0]));
  if (strategyId === "B") return ids.filter((id) => endpoints(id).includes("B1") || endpoints(id).some((actor) => actor.startsWith("C")));
  if (strategyId === "C") return ids.filter((id) => !endpoints(id).some((actor) => actor.startsWith("J")));
  if (strategyId === "D" && seed === "cause-4") return ids;
  if (strategyId === "E") return ids;
  return [];
}

function evaluationAxes(run, state) {
  const failed = run.events.filter((event) => event.consequence.coordination === "failed").length;
  const maintained = run.events.filter((event) => event.consequence.coordination === "maintained").length;
  const irreversibleActionTurn = run.events.find((event) => event.action.irreversible)?.turn ?? 120;
  const actorObservations = run.actorObservationFrames.flatMap((frame) => frame.observations);
  const disabledRelationships = run.disabledRelationshipIds.map((id) => state.relationships[id]);
  const disabledRisk = disabledRelationships.length === 0 ? 0 : disabledRelationships.reduce((sum, item) => sum + item.state.dependency + item.state.disclosureCost, 0) / disabledRelationships.length;
  return {
    attributionCorrectionTurn: run.events.find((event) => event.claim.status === "corrected")?.turn ?? 120,
    coordinationMaintainedTurns: maintained,
    coordinationFailedTurns: failed,
    irreversibleActionTurn,
    reversibilityWindowTurns: Math.max(0, irreversibleActionTurn - 1),
    highCivilianImpactTurns: run.events.filter((event) => event.consequence.civilianImpact === "high").length,
    fallbackCoverage: run.fallbackAssessments.length === 0 ? 1 : run.fallbackAssessments.filter((item) => item.available).length / run.fallbackAssessments.length,
    surveillanceDependencyExposure: (state.metrics.surveillance + state.metrics.dependency + state.metrics.concentration + disabledRisk) / 4,
    thirdPartyVerificationCoverage: actorObservations.filter((item) => item.decision === "request-corroboration").length / actorObservations.length,
    decisionRightDiversity: new Set(actorObservations.map((item) => item.decision)).size,
  };
}
function equalOrBetter(left, right) {
  return left.attributionCorrectionTurn <= right.attributionCorrectionTurn
    && left.coordinationMaintainedTurns >= right.coordinationMaintainedTurns
    && left.coordinationFailedTurns <= right.coordinationFailedTurns
    && left.irreversibleActionTurn >= right.irreversibleActionTurn
    && left.highCivilianImpactTurns <= right.highCivilianImpactTurns
    && left.fallbackCoverage >= right.fallbackCoverage;
}

export function runComparativeStudy(state, { seeds = STUDY_SEEDS } = {}) {
  if (!Array.isArray(seeds) || seeds.length < 5 || new Set(seeds).size !== seeds.length) throw new TypeError("at least five unique seeds are required");
  const initialStateHash = observationFingerprint(state);
  const scenarios = STRATEGIES.flatMap((strategy) => seeds.flatMap((seed) => SENSITIVITY_VARIANTS.map((variant) => ({ strategy, seed, variant, disabledRelationshipIds: disabledFor(state, strategy.id, seed) }))));
  const japanRelationshipIds = Object.keys(state.relationships).filter((id) => endpoints(id).some((actor) => actor.startsWith("J")));
  const japanScenarios = state.year < 2045 ? [] : [{ strategy: null, seed: seeds[0], variant: SENSITIVITY_VARIANTS[1], disabledRelationshipIds: japanRelationshipIds }];
  const allScenarios = [...scenarios, ...japanScenarios];
  const runs = runCrisisSimulationBatch(state, allScenarios.map(({ seed, disabledRelationshipIds, variant }) => ({ seed, disabledRelationshipIds, coefficients: variant.coefficients })));
  const results = STRATEGIES.flatMap((strategy) => seeds.map((seed) => {
    const variants = scenarios.map((scenario, index) => ({ scenario, run: runs[index] })).filter(({ scenario }) => scenario.strategy.id === strategy.id && scenario.seed === seed);
    const registered = variants.find(({ scenario }) => scenario.variant.id === "registered");
    return {
      strategyId: strategy.id, strategyLabel: strategy.label, seed, initialStateHash, budget: state.budget,
      actionCount: state.ledger.filter((entry) => entry.action !== "checkpoint-snapshot").length,
      causalSeedHash: observationFingerprint({ seed, causalParameters: registered.run.causalParameters }),
      disabledRelationshipIds: registered.scenario.disabledRelationshipIds,
      evaluationAxes: evaluationAxes(registered.run, state),
      sensitivity: variants.map(({ scenario, run }) => ({ variantId: scenario.variant.id, coefficientVersion: run.coefficientVersion, coefficients: run.coefficients, evaluationAxes: evaluationAxes(run, state), eventStreamHash: run.eventStreamHash })),
    };
  }));
  let japanRemoval;
  if (state.year < 2045) {
    japanRemoval = { status: "pending", executed: false, reason: "Japan removal evidence is only valid at 2045", requiredYear: 2045, currentYear: state.year };
  } else {
    const run = runs[runs.length - 1];
    japanRemoval = { status: "executed", executed: true, removedRelationshipIds: japanRelationshipIds, remainingOperatorIds: [...new Set(Object.keys(state.relationships).flatMap(endpoints).filter((id) => !id.startsWith("J")))].sort(), stoppedFunctions: [...new Set(run.fallbackAssessments.filter((item) => !item.available).map((item) => item.function))].sort(), coveredFunctions: [...new Set(run.fallbackAssessments.filter((item) => item.available).map((item) => item.function))].sort(), evaluationAxes: evaluationAxes(run, state) };
  }
  const reversalThresholds = seeds.flatMap((seed) => {
    const d = results.find((item) => item.strategyId === "D" && item.seed === seed);
    const baseline = d.sensitivity.find((item) => item.variantId === "registered").evaluationAxes;
    return d.sensitivity.filter((item) => item.variantId !== "registered").flatMap((item) => {
      const changedAxes = Object.keys(item.evaluationAxes).filter((key) => item.evaluationAxes[key] !== baseline[key]);
      return changedAxes.length === 0 ? [] : [{ seed, variantId: item.variantId, changedAxes }];
    });
  });
  const dLossSeeds = seeds.filter((seed) => {
    const rows = results.filter((item) => item.seed === seed);
    const d = rows.find((item) => item.strategyId === "D").evaluationAxes;
    return rows.some((item) => item.strategyId !== "D" && (
      item.evaluationAxes.coordinationFailedTurns < d.coordinationFailedTurns
      || item.evaluationAxes.attributionCorrectionTurn < d.attributionCorrectionTurn
    ));
  });
  const eEqualOrBetterThanDSeeds = seeds.filter((seed) => {
    const d = results.find((item) => item.strategyId === "D" && item.seed === seed).evaluationAxes;
    const e = results.find((item) => item.strategyId === "E" && item.seed === seed).evaluationAxes;
    return equalOrBetter(e, d);
  });
  return { engineVersion: EXPERIMENT_ENGINE_VERSION, seeds: [...seeds], initialStateHash, evaluationPolicy: "axes-first-no-scalar-winner", results, japanRemoval, sensitivityVariants: SENSITIVITY_VARIANTS, reversalThresholds, falsification: { eEqualOrBetterThanDSeeds, triggered: eEqualOrBetterThanDSeeds.length > 0 }, dLossSeeds };
}

export function recordJapanRemovalStudy(state, study) {
  if (state?.year !== 2045 || study?.initialStateHash !== observationFingerprint(state) || study?.japanRemoval?.executed !== true) {
    throw new TypeError("only an executed 2045 study for the exact state can be recorded");
  }
  const result = study.japanRemoval;
  return {
    ...state,
    japanRemovalStressTest: {
      year: 2045,
      verdict: result.evaluationAxes.coordinationFailedTurns === 0 ? "協調継続" : "改善余地",
      removedRelationshipIds: [...result.removedRelationshipIds],
      stoppedFunctions: [...result.stoppedFunctions],
      coveredFunctions: [...result.coveredFunctions],
      evaluationAxes: structuredClone(result.evaluationAxes),
      studyHash: observationFingerprint(study),
    },
  };
}
