import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { CONTRACTED_CAUSE_WORLDS, CRISIS_PHASES, replayCrisisEvent, runCrisisSimulation } from "../src/crisis.js";

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
  const expectedActiveActors = new Set(Object.entries(state.relationships).flatMap(([id, item]) => id === target ? [] : [item.source, item.target]));
  assert.equal(views.length, expectedActiveActors.size);
  assert.ok(new Set(views.map((view) => view.visibleConfidence)).size > 1);
  assert.ok(new Set(views.map((view) => view.decision)).size > 1);
});

test("misattribution correction irreversible action and route failure remain replayable", () => {
  const state = createDemoState(2035);
  const run = runCrisisSimulation(state, { seed: "crisis-evidence-0" });
  assert.equal(run.events[18].claim.status, "misattributed");
  assert.equal(run.events[run.transitionParameters.irreversibleTurn].action.irreversible, true);
  assert.equal(run.events[run.transitionParameters.correctionTurn].claim.status, "corrected");
  assert.equal(run.importantEvents.some((event) => event.sequence === run.transitionParameters.disruptionStart), true);
  const disconnected = runCrisisSimulation(state, { disabledRelationshipIds: Object.keys(state.relationships) });
  assert.equal(disconnected.events[disconnected.transitionParameters.disruptionStart].consequence.fallbackAvailable, false);
  assert.equal(disconnected.events[disconnected.transitionParameters.disruptionStart].consequence.coordination, "failed");
});

test("versioned coefficient perturbations rerun transitions rather than reweighting output", () => {
  const state = createDemoState(2035);
  const fast = runCrisisSimulation(state, { seed: "coefficient-0", coefficients: { attributionCorrectionOffset: -4, disruptionDurationScale: 0.75 } });
  const slow = runCrisisSimulation(state, { seed: "coefficient-0", coefficients: { attributionCorrectionOffset: 4, disruptionDurationScale: 1.25 } });
  assert.equal(fast.coefficientVersion, slow.coefficientVersion);
  assert.ok(fast.transitionParameters.correctionTurn < slow.transitionParameters.correctionTurn);
  assert.ok(fast.transitionParameters.disruptionEnd <= slow.transitionParameters.disruptionEnd);
  assert.notEqual(fast.eventStreamHash, slow.eventStreamHash);
});

test("the five registered study seeds map bijectively to five true causes", () => {
  const state = createDemoState(2035);
  const expected = [
    ["S1", "coordinated-cross-domain-coercion"],
    ["S2", "maritime-accident-plus-independent-cybercrime"],
    ["S3", "third-party-or-non-state-incitement"],
    ["S4", "equipment-weather-and-operator-error"],
    ["S5", "partial-coercion-plus-unrelated-events"],
  ];
  const actual = Array.from({ length: 5 }, (_, index) => {
    const run = runCrisisSimulation(state, { seed: `cause-${index}` });
    return [run.causalParameters.causeWorldId, run.causalParameters.causeCode];
  });
  assert.deepEqual(actual, expected);
  assert.equal(Object.keys(CONTRACTED_CAUSE_WORLDS).length, 5);
});

test("topology and fallback loss causally delay correction and accelerate irreversible action", () => {
  const state = createDemoState(2035);
  const connected = runCrisisSimulation(state, { seed: "cause-1" });
  const disconnected = runCrisisSimulation(state, { seed: "cause-1", disabledRelationshipIds: Object.keys(state.relationships) });
  assert.ok(disconnected.transitionParameters.topologyPenalty > connected.transitionParameters.topologyPenalty);
  assert.ok(disconnected.transitionParameters.correctionTurn === null || disconnected.transitionParameters.correctionTurn >= connected.transitionParameters.correctionTurn);
  assert.equal(disconnected.transitionParameters.irreversibleTurn, null);
  assert.equal(disconnected.transitionParameters.irreversibleStatus, "not-executed-no-authorized-executor");
  assert.ok(Number.isInteger(connected.transitionParameters.irreversibleTurn));
  assert.notEqual(disconnected.eventStreamHash, connected.eventStreamHash);
});

test("per-turn actor observations and decision rights drive proposals and consequences", () => {
  const state = createDemoState(2035);
  const run = runCrisisSimulation(state, { seed: "cause-2" });
  assert.ok(run.events.every((event) => Number.isInteger(event.decision.corroboratingActors)));
  const correction = run.events[run.transitionParameters.correctionTurn];
  assert.equal(correction.claim.status, "corrected");
  assert.equal(correction.proposal.basedOnVerifiedAttribution, correction.decision.corroboratingActors >= 6 && correction.decision.authorizedApprovers >= 1);
  const noFallback = runCrisisSimulation(state, { seed: "cause-2", disabledRelationshipIds: Object.keys(state.relationships) });
  assert.equal(noFallback.events[noFallback.transitionParameters.disruptionStart].consequence.coordination, "failed");
});

test("disabled topology removes isolated Japan actors from observations and decisions", () => {
  const state = createDemoState(2045);
  const japanRelationshipIds = Object.keys(state.relationships).filter((id) => id.split("-").some((actorId) => actorId.startsWith("J")));
  const run = runCrisisSimulation(state, { seed: "cause-0", disabledRelationshipIds: japanRelationshipIds });
  const observedActorIds = new Set(run.actorObservationFrames.flatMap((frame) => frame.observations.map((item) => item.actorId)));
  assert.ok(["J1", "J2", "J3", "J4", "J5", "J6"].every((actorId) => !observedActorIds.has(actorId)));
  assert.ok(run.events.every((event) => event.decision.activeActors === observedActorIds.size));
});

test("Japan removal retains the explicit fictional emergency-stop fallback", () => {
  const state = createDemoState(2045);
  const japanRelationshipIds = Object.keys(state.relationships).filter((id) => id.split("-").some((actorId) => actorId.startsWith("J")));
  const run = runCrisisSimulation(state, { seed: "cause-0", disabledRelationshipIds: japanRelationshipIds });
  const stopAssessments = run.fallbackAssessments.filter((item) => item.function === "crisis-stop-conditions");
  assert.ok(stopAssessments.length > 0);
  assert.ok(stopAssessments.every((item) => item.available && item.alternateRelationshipIds.includes("U4-C3")));
});

test("correction remains explicitly uncorrected when active governance never authorizes it", () => {
  const state = createDemoState(2035);
  const run = runCrisisSimulation(state, { seed: "cause-4", disabledRelationshipIds: Object.keys(state.relationships) });
  assert.equal(run.transitionParameters.correctionTurn, null);
  assert.equal(run.transitionParameters.correctionStatus, "uncorrected");
  assert.equal(run.events.some((event) => event.claim.status === "corrected"), false);
  assert.equal(run.events.at(-1).claim.status, "misattributed");
});

test("irreversible readiness is not fabricated without an active authorized executor", () => {
  const state = createDemoState(2035);
  const executorRelationshipIds = Object.keys(state.relationships).filter((id) => id.split("-").includes("B1"));
  const run = runCrisisSimulation(state, { seed: "cause-0", disabledRelationshipIds: executorRelationshipIds });
  assert.equal(run.transitionParameters.irreversibleTurn, null);
  assert.equal(run.transitionParameters.irreversibleStatus, "not-executed-no-authorized-executor");
  assert.equal(run.events.some((event) => event.action.id === "raise-readiness" || event.action.irreversible), false);
});

test("organizational failure parameters causally degrade active decisions and consequences", () => {
  const state = createDemoState(2035);
  const baseline = runCrisisSimulation(state, { seed: "cause-1" });
  const failed = runCrisisSimulation(state, {
    seed: "cause-1",
    organizationalFailure: { dissentCompression: 1, leakage: 1, interagencyConflict: 1 },
  });
  assert.equal(failed.organizationalFailureVersion, "organizational-failure-v1");
  assert.ok(failed.events[0].decision.corroboratingActors < baseline.events[0].decision.corroboratingActors);
  assert.ok(failed.events[0].decision.authorizedApprovers <= baseline.events[0].decision.authorizedApprovers);
  assert.ok(failed.events.filter((event) => event.consequence.coordination === "failed").length > baseline.events.filter((event) => event.consequence.coordination === "failed").length);
  assert.throws(() => runCrisisSimulation(state, { organizationalFailure: { leakage: 2 } }), /organizational failure/);
});
