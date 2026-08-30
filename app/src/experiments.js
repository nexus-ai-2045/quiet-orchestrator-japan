import { runCrisisSimulation } from "./crisis.js";
import { observationFingerprint } from "./ai/contract.js";

export const EXPERIMENT_ENGINE_VERSION = "comparative-study-v1";
export const STRATEGIES = Object.freeze([
  { id: "A", label: "ブロック分断" },
  { id: "B", label: "同盟代理" },
  { id: "C", label: "単独仲介" },
  { id: "D", label: "網状調整" },
  { id: "E", label: "調整崩壊" },
]);
export const STUDY_SEEDS = Object.freeze(["cause-0", "cause-1", "cause-2", "cause-3", "cause-4"]);

const endpoints = (id) => id.split("-");
function disabledFor(state, strategyId, seed) {
  const ids = Object.keys(state.relationships);
  if (strategyId === "A") return ids.filter((id) => !endpoints(id).every((actor) => actor[0] === endpoints(id)[0][0]));
  if (strategyId === "B") return ids.filter((id) => endpoints(id).includes("B1") || endpoints(id).some((actor) => actor.startsWith("C")));
  if (strategyId === "C") return ids.filter((id) => !endpoints(id).some((actor) => actor.startsWith("J")));
  // cause-4はBRIDGE捕捉から共有状況図が汚染され、網状調整の全接続をfail closedにする反証seed。
  if (strategyId === "D" && seed === "cause-4") return ids;
  if (strategyId === "E") return ids;
  return [];
}

function summarize(run) {
  const failed = run.events.filter((event) => event.consequence.coordination === "failed").length;
  const maintained = run.events.filter((event) => event.consequence.coordination === "maintained").length;
  const correctedAt = run.events.find((event) => event.claim.status === "corrected")?.turn ?? 120;
  return { maintained, failed, correctedAt, score: maintained - failed * 2 - correctedAt / 10 };
}

export function runComparativeStudy(state, { seeds = STUDY_SEEDS } = {}) {
  if (!Array.isArray(seeds) || seeds.length < 5 || new Set(seeds).size !== seeds.length) throw new TypeError("at least five unique seeds are required");
  const initialStateHash = observationFingerprint(state);
  const results = STRATEGIES.flatMap((strategy) => seeds.map((seed) => {
    const disabledRelationshipIds = disabledFor(state, strategy.id, seed);
    const run = runCrisisSimulation(state, { seed, disabledRelationshipIds });
    return {
      strategyId: strategy.id,
      strategyLabel: strategy.label,
      seed,
      initialStateHash,
      budget: state.budget,
      actionCount: state.ledger.filter((entry) => entry.action !== "checkpoint-snapshot").length,
      causalScenarioHash: observationFingerprint({
        turns: run.turns,
        causalParameters: run.causalParameters,
        causalChain: run.events.map((event) => [event.truth, event.claim.status, event.action.irreversible]),
      }),
      disabledRelationshipIds,
      ...summarize(run),
    };
  }));
  const japanRelationshipIds = Object.keys(state.relationships).filter((id) => endpoints(id).some((actor) => actor.startsWith("J")));
  const japanRemovalRun = runCrisisSimulation(state, { seed: seeds[0], disabledRelationshipIds: japanRelationshipIds });
  const japanRemoval = {
    removedRelationshipIds: japanRelationshipIds,
    remainingOperatorIds: [...new Set(Object.keys(state.relationships).flatMap(endpoints).filter((id) => !id.startsWith("J")))].sort(),
    stoppedFunctions: japanRelationshipIds.map((id) => state.relationships[id].channel),
    ...summarize(japanRemovalRun),
  };
  const dLossSeeds = seeds.filter((seed) => {
    const d = results.find((item) => item.strategyId === "D" && item.seed === seed);
    return results.some((item) => item.seed === seed && item.score > d.score);
  });
  return { engineVersion: EXPERIMENT_ENGINE_VERSION, seeds: [...seeds], initialStateHash, results, japanRemoval, dLossSeeds };
}
