import { runCrisisSimulationBatch } from "./crisis.js";
import { canonicalize, observationFingerprint } from "./ai/contract.js";
import { ACTOR_CONSTRAINTS } from "./ai/actor-governance.js";
import { ACTORS } from "./simulation.js";

export const EXPERIMENT_ENGINE_VERSION = "comparative-study-v2";
export const STRATEGIES = Object.freeze([{ id: "A", label: "ブロック分断" }, { id: "B", label: "同盟代理" }, { id: "C", label: "単独仲介" }, { id: "D", label: "網状調整" }, { id: "E", label: "調整崩壊" }]);
export const STUDY_SEEDS = Object.freeze(["cause-0", "cause-1", "cause-2", "cause-3", "cause-4"]);
export const SENSITIVITY_VARIANTS = Object.freeze([
  { id: "faster-correction-shorter-disruption", coefficients: Object.freeze({ attributionCorrectionOffset: -4, disruptionDurationScale: 0.75 }) },
  { id: "registered", coefficients: Object.freeze({ attributionCorrectionOffset: 0, disruptionDurationScale: 1 }) },
  { id: "slower-correction-longer-disruption", coefficients: Object.freeze({ attributionCorrectionOffset: 4, disruptionDurationScale: 1.25 }) },
].map(Object.freeze));
const endpoints = (id) => id.split("-");

function disabledFor(state, strategyId) {
  const ids = Object.keys(state.relationships);
  if (strategyId === "A") return ids.filter((id) => !endpoints(id).every((actor) => actor[0] === endpoints(id)[0][0]));
  if (strategyId === "B") return ids.filter((id) => endpoints(id).includes("B1") || endpoints(id).some((actor) => actor.startsWith("C")));
  if (strategyId === "C") return ids.filter((id) => !endpoints(id).some((actor) => actor.startsWith("J")));
  if (strategyId === "E") return ids;
  return [];
}

function evaluationAxes(run, state) {
  const failed = run.events.filter((event) => event.consequence.coordination === "failed").length;
  const maintained = run.events.filter((event) => event.consequence.coordination === "maintained").length;
  const irreversibleActionTurn = run.events.find((event) => event.action.irreversible)?.turn ?? 120;
  const actorObservations = run.actorObservationFrames.flatMap((frame) => frame.observations);
  const observedActorIds = new Set(actorObservations.map((item) => item.actorId));
  const disabled = new Set(run.disabledRelationshipIds);
  const activeActorIds = new Set(Object.entries(state.relationships)
    .filter(([id]) => !disabled.has(id))
    .flatMap(([, relationship]) => [relationship.source, relationship.target])
    .filter((id) => observedActorIds.has(id)));
  const actorGroups = Object.fromEntries(ACTORS.map((actor) => [actor.id, actor.group]));
  const activeProfiles = [...activeActorIds].map((id) => ACTOR_CONSTRAINTS[id]).filter(Boolean);
  const thirdPartyProfiles = activeProfiles.filter((profile) => !["米国", "中国"].includes(actorGroups[profile.actorId]));
  const representedRights = new Set(activeProfiles.flatMap((profile) => Object.entries(profile.decisionRights)
    .filter(([, granted]) => granted)
    .map(([right]) => right)));
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
    thirdPartyVerificationCoverage: thirdPartyProfiles.length === 0 ? 0 : thirdPartyProfiles.filter((profile) => profile.capabilities.includes("verify")).length / thirdPartyProfiles.length,
    decisionRightDiversity: representedRights.size,
  };
}
const AXIS_DIRECTIONS = Object.freeze({
  attributionCorrectionTurn: "min", coordinationMaintainedTurns: "max", coordinationFailedTurns: "min",
  irreversibleActionTurn: "max", reversibilityWindowTurns: "max", highCivilianImpactTurns: "min",
  fallbackCoverage: "max", surveillanceDependencyExposure: "min", thirdPartyVerificationCoverage: "max",
  decisionRightDiversity: "max",
});

function paretoConclusion(left, right) {
  let leftBetter = false;
  let rightBetter = false;
  for (const [axis, direction] of Object.entries(AXIS_DIRECTIONS)) {
    if (left[axis] === right[axis]) continue;
    const leftWins = direction === "min" ? left[axis] < right[axis] : left[axis] > right[axis];
    leftBetter ||= leftWins;
    rightBetter ||= !leftWins;
  }
  if (!leftBetter && !rightBetter) return "equal";
  if (leftBetter && !rightBetter) return "d-dominates";
  if (!leftBetter && rightBetter) return "rival-dominates";
  return "trade-off";
}

export function runComparativeStudy(state, { seeds = STUDY_SEEDS } = {}) {
  if (!Array.isArray(seeds) || seeds.length < 5 || new Set(seeds).size !== seeds.length) throw new TypeError("at least five unique seeds are required");
  const initialStateHash = observationFingerprint(state);
  const scenarios = STRATEGIES.flatMap((strategy) => seeds.flatMap((seed) => SENSITIVITY_VARIANTS.map((variant) => ({ strategy, seed, variant, disabledRelationshipIds: disabledFor(state, strategy.id, seed) }))));
  const japanRelationshipIds = Object.keys(state.relationships).filter((id) => endpoints(id).some((actor) => actor.startsWith("J")));
  const japanScenarios = state.year < 2045 ? [] : seeds.flatMap((seed) => SENSITIVITY_VARIANTS.map((variant) => ({ strategy: null, seed, variant, disabledRelationshipIds: japanRelationshipIds })));
  const allScenarios = [...scenarios, ...japanScenarios];
  const runs = runCrisisSimulationBatch(state, allScenarios.map(({ seed, disabledRelationshipIds, variant }) => ({ seed, disabledRelationshipIds, coefficients: variant.coefficients })));
  const results = STRATEGIES.flatMap((strategy) => seeds.map((seed) => {
    const variants = scenarios.map((scenario, index) => ({ scenario, run: runs[index] })).filter(({ scenario }) => scenario.strategy.id === strategy.id && scenario.seed === seed);
    const registered = variants.find(({ scenario }) => scenario.variant.id === "registered");
    return {
      strategyId: strategy.id, strategyLabel: strategy.label, seed, initialStateHash, budget: state.budget,
      actionCount: state.ledger.filter((entry) => entry.action !== "checkpoint-snapshot").length,
      causalSeedHash: observationFingerprint({ seed, causeWorldId: registered.run.causalParameters.causeWorldId, causeCode: registered.run.causalParameters.causeCode }),
      disabledRelationshipIds: registered.scenario.disabledRelationshipIds,
      evaluationAxes: evaluationAxes(registered.run, state),
      sensitivity: variants.map(({ scenario, run }) => ({ variantId: scenario.variant.id, coefficientVersion: run.coefficientVersion, coefficients: run.coefficients, evaluationAxes: evaluationAxes(run, state), eventStreamHash: run.eventStreamHash })),
    };
  }));
  let japanRemoval;
  if (state.year < 2045) {
    japanRemoval = { status: "pending", executed: false, reason: "Japan removal evidence is only valid at 2045", requiredYear: 2045, currentYear: state.year };
  } else {
    const japanRuns = runs.slice(scenarios.length);
    const cases = japanScenarios.map((scenario, index) => {
      const run = japanRuns[index];
      return { seed: scenario.seed, variantId: scenario.variant.id, coefficientVersion: run.coefficientVersion, coefficients: run.coefficients, stoppedFunctions: [...new Set(run.fallbackAssessments.filter((item) => !item.available).map((item) => item.function))].sort(), coveredFunctions: [...new Set(run.fallbackAssessments.filter((item) => item.available).map((item) => item.function))].sort(), evaluationAxes: evaluationAxes(run, state), eventStreamHash: run.eventStreamHash };
    });
    const expectedCaseCount = seeds.length * SENSITIVITY_VARIANTS.length;
    const complete = cases.length === expectedCaseCount && new Set(cases.map((item) => `${item.seed}:${item.variantId}`)).size === expectedCaseCount;
    const stoppedFunctions = [...new Set(cases.flatMap((item) => item.stoppedFunctions))].sort();
    const coveredFunctions = [...new Set(cases.flatMap((item) => item.coveredFunctions))].sort();
    const allCasesMaintainCoordination = complete && cases.every((item) => item.evaluationAxes.coordinationFailedTurns === 0 && item.stoppedFunctions.length === 0);
    const worstCase = cases.reduce((worst, item) => !worst || item.evaluationAxes.coordinationFailedTurns > worst.evaluationAxes.coordinationFailedTurns ? item : worst, null);
    japanRemoval = { status: complete ? "executed" : "incomplete", executed: complete, removedRelationshipIds: japanRelationshipIds, remainingOperatorIds: [...new Set(Object.keys(state.relationships).flatMap(endpoints).filter((id) => !id.startsWith("J")))].sort(), stoppedFunctions, coveredFunctions, evaluationAxes: worstCase?.evaluationAxes ?? null, cases, assessment: { complete, expectedCaseCount, actualCaseCount: cases.length, allCasesMaintainCoordination, verdict: allCasesMaintainCoordination ? "協調継続" : "改善余地" } };
  }
  const reversalThresholds = seeds.flatMap((seed) => {
    const d = results.find((item) => item.strategyId === "D" && item.seed === seed);
    return results.filter((item) => item.seed === seed && item.strategyId !== "D").flatMap((rival) => {
      const registeredConclusion = paretoConclusion(d.evaluationAxes, rival.evaluationAxes);
      return SENSITIVITY_VARIANTS.filter((variant) => variant.id !== "registered").flatMap((variant) => {
        const dAxes = d.sensitivity.find((item) => item.variantId === variant.id).evaluationAxes;
        const rivalAxes = rival.sensitivity.find((item) => item.variantId === variant.id).evaluationAxes;
        const sensitivityConclusion = paretoConclusion(dAxes, rivalAxes);
        return sensitivityConclusion === registeredConclusion ? [] : [{ seed, rivalStrategyId: rival.strategyId, variantId: variant.id, registeredConclusion, sensitivityConclusion }];
      });
    });
  });
  const dLossSeeds = seeds.filter((seed) => {
    const rows = results.filter((item) => item.seed === seed);
    const d = rows.find((item) => item.strategyId === "D").evaluationAxes;
    return rows.some((item) => item.strategyId !== "D" && paretoConclusion(d, item.evaluationAxes) === "rival-dominates");
  });
  const eEqualOrBetterThanDSeeds = seeds.filter((seed) => {
    const d = results.find((item) => item.strategyId === "D" && item.seed === seed).evaluationAxes;
    const e = results.find((item) => item.strategyId === "E" && item.seed === seed).evaluationAxes;
    return paretoConclusion(d, e) === "rival-dominates" || paretoConclusion(d, e) === "equal";
  });
  return { engineVersion: EXPERIMENT_ENGINE_VERSION, seeds: [...seeds], initialStateHash, evaluationPolicy: "axes-first-no-scalar-winner", results, japanRemoval, sensitivityVariants: SENSITIVITY_VARIANTS, reversalThresholds, falsification: { eEqualOrBetterThanDSeeds, triggered: eEqualOrBetterThanDSeeds.length > 0 }, dLossSeeds };
}

export function recordJapanRemovalStudy(state, study) {
  const result = study?.japanRemoval;
  const expectedCaseCount = Array.isArray(study?.seeds) ? study.seeds.length * SENSITIVITY_VARIANTS.length : 0;
  const caseKeys = Array.isArray(result?.cases) ? new Set(result.cases.map((item) => `${item.seed}:${item.variantId}`)) : new Set();
  const expectedCaseKeys = new Set((study?.seeds ?? []).flatMap((seed) => SENSITIVITY_VARIANTS.map((variant) => `${seed}:${variant.id}`)));
  const exactCaseMatrix = caseKeys.size === expectedCaseKeys.size && [...caseKeys].every((key) => expectedCaseKeys.has(key));
  const allCasesMaintainCoordination = Array.isArray(result?.cases) && result.cases.length > 0
    && result.cases.every((item) => item?.evaluationAxes?.coordinationFailedTurns === 0 && Array.isArray(item.stoppedFunctions) && item.stoppedFunctions.length === 0);
  const expectedVerdict = allCasesMaintainCoordination ? "協調継続" : "改善余地";
  if (state?.year !== 2045 || study?.initialStateHash !== observationFingerprint(state) || result?.executed !== true
    || result?.assessment?.complete !== true || result.assessment.expectedCaseCount !== expectedCaseCount
    || result.assessment.actualCaseCount !== expectedCaseCount || !exactCaseMatrix
    || result.assessment.allCasesMaintainCoordination !== allCasesMaintainCoordination || result.assessment.verdict !== expectedVerdict) {
    throw new TypeError("only an executed 2045 study for the exact state can be recorded");
  }
  // The supplied packet is untrusted evidence. Re-run the canonical matrix
  // from the exact state and require byte-equivalent canonical content before
  // persisting anything from it.
  const canonicalStudy = runComparativeStudy(state);
  if (canonicalize(study) !== canonicalize(canonicalStudy)) {
    throw new TypeError("supplied packet does not match the canonical 2045 study");
  }
  const canonicalResult = canonicalStudy.japanRemoval;
  return {
    ...state,
    japanRemovalStressTest: {
      year: 2045,
      verdict: canonicalResult.assessment.verdict,
      removedRelationshipIds: [...canonicalResult.removedRelationshipIds],
      stoppedFunctions: [...canonicalResult.stoppedFunctions],
      coveredFunctions: [...canonicalResult.coveredFunctions],
      evaluationAxes: structuredClone(canonicalResult.evaluationAxes),
      assessment: structuredClone(canonicalResult.assessment),
      cases: structuredClone(canonicalResult.cases),
      studyHash: observationFingerprint(canonicalStudy),
    },
  };
}
