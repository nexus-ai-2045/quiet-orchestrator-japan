import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { replayCrisisEvent, runCrisisSimulation } from "../src/crisis.js";

test("the crisis engine deterministically emits all 120 ordered turns without strategic growth", () => {
  const state = createDemoState(2035);
  const snapshot = structuredClone(state);
  const first = runCrisisSimulation(state, { seed: "crisis-replay-0" });
  const second = runCrisisSimulation(state, { seed: "crisis-replay-0" });
  assert.deepEqual(first, second);
  assert.deepEqual(state, snapshot);
  assert.equal(first.events.length, 120);
  assert.deepEqual(first.events.map((event) => event.sequence), Array.from({ length: 120 }, (_, index) => index));
  assert.equal(new Set(first.events.map((event) => event.phase)).size, 7);
  assert.equal(replayCrisisEvent(first, 119).turn, 120);
});

test("misattribution correction irreversible action and route failure remain replayable", () => {
  const state = createDemoState(2035);
  const run = runCrisisSimulation(state, { seed: "crisis-evidence-0" });
  assert.equal(run.events[18].claim.status, "misattributed");
  assert.equal(run.events[run.causalParameters.irreversibleTurn].action.irreversible, true);
  assert.equal(run.events[run.causalParameters.correctionTurn].claim.status, "corrected");
  assert.equal(run.importantEvents.some((event) => event.sequence === run.causalParameters.disruptionStart), true);
  const disconnected = runCrisisSimulation(state, { disabledRelationshipIds: Object.keys(state.relationships) });
  assert.equal(disconnected.events[disconnected.causalParameters.disruptionStart].consequence.fallbackAvailable, false);
  assert.equal(disconnected.events[disconnected.causalParameters.disruptionStart].consequence.coordination, "failed");
});
