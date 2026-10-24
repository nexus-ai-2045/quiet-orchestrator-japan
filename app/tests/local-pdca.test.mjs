import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { observationFingerprint } from "../src/ai/contract.js";
import { buildAiStateSummary } from "../src/ai/apply-proposal.js";
import { canCompleteLocalPdca, runLocalPdcaSimulation, runOneLocalPdcaStep } from "../src/ai/local-pdca.js";

test("local PDCA runs exact steps 0 through 8 in actor-turn order", () => {
  const result = runLocalPdcaSimulation(createDemoState(2035), { seed: "pdca-order" });
  assert.equal(result.completed, true);
  assert.equal(result.completedSteps, 9);
  assert.deepEqual(result.steps.map(({ step }) => step), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(result.steps.map(({ actorId, turn }) => `${turn}:${actorId}`), [
    "1:B1", "1:J2", "1:C6", "2:B1", "2:J2", "2:C6", "3:B1", "3:J2", "3:C6",
  ]);
});

test("local PDCA replay is deterministic for an identical state and seed", () => {
  const initial = createDemoState(2035);
  const first = runLocalPdcaSimulation(initial, { seed: "pdca-replay" });
  const second = runLocalPdcaSimulation(initial, { seed: "pdca-replay" });
  assert.deepEqual(first, second);
});

test("checkpoint rejection records a stress test and retries the same step", () => {
  const initial = createDemoState(2040);
  const withoutCheckpoint = { ...initial, stressTests: { ...initial.stressTests, 2040: undefined } };
  delete withoutCheckpoint.stressTests[2040];
  withoutCheckpoint.ledger = initial.ledger.filter((entry) => !(entry.year === 2040 && entry.action === "checkpoint-snapshot"));
  const result = runOneLocalPdcaStep(withoutCheckpoint, 0, "pdca-checkpoint");
  assert.equal(result.completed, true);
  assert.equal(result.do.attempts.length, 2);
  assert.deepEqual(result.do.attempts[0].errors, ["deterministic_core_rejected"]);
  assert.equal(result.do.attempts[1].applied, true);
  assert.equal(result.do.checkpoint.year, 2040);
  assert.equal(result.do.checkpoint.recorded, true);
  assert.ok(result.state.stressTests[2040]);
  assert.equal(result.state.year, 2041);
  assert.equal(result.plan.receipt.observationHash, result.do.attempts.at(-1).observationHash);
});

test("nine-step PDCA refuses a horizon with too few remaining years", () => {
  assert.equal(canCompleteLocalPdca(createDemoState(2035), 0), true);
  assert.equal(canCompleteLocalPdca(createDemoState(2037), 0), false);
  assert.equal(canCompleteLocalPdca(createDemoState(2040), 4), true);
});

test("AI plan cannot mutate state outside the deterministic core", () => {
  const initial = createDemoState(2035);
  const snapshot = structuredClone(initial);
  const result = runOneLocalPdcaStep(initial, 0, "pdca-authority");
  assert.deepEqual(initial, snapshot);
  assert.deepEqual(result.plan.receipt.observation.stateSummary, buildAiStateSummary(initial));
  assert.equal(result.check.beforeStateHash, observationFingerprint(initial));
  assert.equal(result.do.execution.beforeStateHash, observationFingerprint(initial));
  assert.equal(result.do.execution.afterStateHash, observationFingerprint(result.state));
  assert.equal(result.state.ledger.length, initial.ledger.length + 1);
});

test("local PDCA fails closed outside the fixed nine-step contract", () => {
  const state = createDemoState(2035);
  assert.throws(() => runOneLocalPdcaStep(state, -1, "pdca-range"), /0 through 8/);
  assert.throws(() => runOneLocalPdcaStep(state, 9, "pdca-range"), /0 through 8/);
  assert.throws(() => runLocalPdcaSimulation(state, { maxSteps: 10 }), /0 through 9/);
});
