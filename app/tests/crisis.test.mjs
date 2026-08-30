import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { CRISIS_PHASES, replayCrisisEvent, runCrisisSimulation } from "../src/crisis.js";

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
  assert.deepEqual(CRISIS_PHASES.map(({ start, end, name }) => [start, end, name]), [
    [0, 11, "衝撃"], [12, 27, "帰属競争"], [28, 55, "生活圧力"],
    [56, 83, "制度疲労"], [84, 99, "二次衝撃"], [100, 111, "復旧競争"], [112, 119, "出口"],
  ]);
  for (const { start, end, name } of CRISIS_PHASES) assert.ok(first.events.slice(start, end + 1).every((event) => event.phase === name));
  assert.equal(replayCrisisEvent(first, 119).turn, 120);
});

test("fallback is assessed per disabled function and actors receive constrained fragments", () => {
  const state = createDemoState(2035);
  const relationshipIds = Object.keys(state.relationships);
  const target = "J5-U5";
  const run = runCrisisSimulation(state, { seed: "fragment-0", disabledRelationshipIds: [target] });
  assert.equal(run.fallbackAssessments.length, 1);
  assert.equal(run.fallbackAssessments[0].relationshipId, target);
  assert.equal(run.fallbackAssessments[0].available, true);
  assert.deepEqual(run.fallbackAssessments[0].alternateRelationshipIds, ["J5-C4", "U5-C4"]);
  const views = run.actorObservationFrames[0].observations;
  assert.equal(views.length, 18);
  assert.ok(new Set(views.map((view) => view.visibleConfidence)).size > 1);
  assert.ok(new Set(views.map((view) => view.decision)).size > 1);
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

test("the five registered study seeds map bijectively to five true causes", () => {
  const state = createDemoState(2035);
  const causes = Array.from({ length: 5 }, (_, index) => runCrisisSimulation(state, { seed: `cause-${index}` }).causalParameters.causeCode);
  assert.equal(new Set(causes).size, 5);
});
