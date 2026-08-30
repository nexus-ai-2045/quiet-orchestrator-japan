import { runCrisisSimulationBatch } from "./crisis.js";
import { observationFingerprint } from "./ai/contract.js";

export const EXPERIMENT_ENGINE_VERSION = "comparative-study-v2";
export const STRATEGIES = Object.freeze([{ id: "A", label: "ブロック分断" }, { id: "B", label: "同盟代理" }, { id: "C", label: "単独仲介" }, { id: "D", label: "網状調整" }, { id: "E", label: "調整崩壊" }]);
export const STUDY_SEEDS = Object.freeze(["cause-0", "cause-1", "cause-2", "cause-3", "cause-4"]);
export const SENSITIVITY_VARIANTS = Object.freeze([{ id: "low-failure-cost", failureCost: 1 }, { id: "registered", failureCost: 2 }, { id: "high-failure-cost", failureCost: 3 }].map(Object.freeze));
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
const sensitivityFor = (axes) => SENSITIVITY_VARIANTS.map((variant) => ({ variantId: variant.id, failureCost: variant.failureCost, diagnosticIndex: axes.coordinationMaintainedTurns - axes.coordinationFailedTurns * variant.failureCost - axes.attributionCorrectionTurn / 10 }));

export function runComparativeStudy(state, { seeds = STUDY_SEEDS } = {}) {
  if (!Array.isArray(seeds) || seeds.length < 5 || new Set(seeds).size !== seeds.length) throw new TypeError("at least five unique seeds are required");
  const initialStateHash = observationFingerprint(state);
  const scenarios = STRATEGIES.flatMap((strategy) => seeds.map((seed) => ({ strategy, seed, disabledRelationshipIds: disabledFor(state, strategy.id, seed) })));
  const runs = runCrisisSimulationBatch(state, scenarios.map(({ seed, disabledRelationshipIds }) => ({ seed, disabledRelationshipIds })));
  const results = scenarios.map(({ strategy, seed, disabledRelationshipIds }, index) => {
    const run = runs[index];
    const axes = evaluationAxes(run, state);
    return { strategyId: strategy.id, strategyLabel: strategy.label, seed, initialStateHash, budget: state.budget, actionCount: state.ledger.filter((entry) => entry.action !== "checkpoint-snapshot").length, causalSeedHash: observationFingerprint({ seed, causalParameters: run.causalParameters }), disabledRelationshipIds, evaluationAxes: axes, sensitivity: sensitivityFor(axes) };
  });
  const japanRelationshipIds = Object.keys(state.relationships).filter((id) => endpoints(id).some((actor) => actor.startsWith("J")));
  let japanRemoval;
  if (state.year < 2045) {
    japanRemoval = { status: "pending", executed: false, reason: "Japan removal evidence is only valid at 2045", requiredYear: 2045, currentYear: state.year };
  } else {
    const [run] = runCrisisSimulationBatch(state, [{ seed: seeds[0], disabledRelationshipIds: japanRelationshipIds }]);
    japanRemoval = { status: "executed", executed: true, removedRelationshipIds: japanRelationshipIds, remainingOperatorIds: [...new Set(Object.keys(state.relationships).flatMap(endpoints).filter((id) => !id.startsWith("J")))].sort(), stoppedFunctions: [...new Set(run.fallbackAssessments.filter((item) => !item.available).map((item) => item.function))].sort(), coveredFunctions: [...new Set(run.fallbackAssessments.filter((item) => item.available).map((item) => item.function))].sort(), evaluationAxes: evaluationAxes(run, state) };
  }
  const reversalThresholds = seeds.flatMap((seed) => {
    const rows = results.filter((item) => item.seed === seed);
    const leader = (variantId) => rows.map((row) => ({ strategyId: row.strategyId, value: row.sensitivity.find((item) => item.variantId === variantId).diagnosticIndex })).sort((a, b) => b.value - a.value)[0].strategyId;
    const baseline = leader("registered");
    return SENSITIVITY_VARIANTS.filter(({ id }) => id !== "registered").flatMap((variant) => leader(variant.id) === baseline ? [] : [{ seed, variantId: variant.id, from: baseline, to: leader(variant.id), failureCost: variant.failureCost }]);
  });
  const dLossSeeds = seeds.filter((seed) => {
    const rows = results.filter((item) => item.seed === seed);
    const d = rows.find((item) => item.strategyId === "D").evaluationAxes;
    return rows.some((item) => item.strategyId !== "D" && (
      item.evaluationAxes.coordinationFailedTurns < d.coordinationFailedTurns
      || item.evaluationAxes.attributionCorrectionTurn < d.attributionCorrectionTurn
    ));
  });
  return { engineVersion: EXPERIMENT_ENGINE_VERSION, seeds: [...seeds], initialStateHash, evaluationPolicy: "axes-first-no-scalar-winner", results, japanRemoval, sensitivityVariants: SENSITIVITY_VARIANTS, reversalThresholds, dLossSeeds };
}
