import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceYear,
  createDemoState,
  createInitialState,
  CRISIS_DAYS,
  CRISIS_TURN_HOURS,
  CRISIS_TURNS,
  END_YEAR,
  getFinalAssessment,
  runStressTest,
  selectAction,
} from "../src/simulation.js";

test("verification investment deterministically increases verification capacity", () => {
  const initial = selectAction(createInitialState(), "verification");
  const next = advanceYear(initial);
  assert.equal(next.year, 2027);
  assert.equal(next.metrics.verification, 48);
});

test("the strategic simulation cannot advance beyond 2045", () => {
  let state = createInitialState();
  for (let turn = 0; turn < 30; turn += 1) state = advanceYear(state);
  assert.equal(state.year, END_YEAR);
  assert.equal(state.history.length, END_YEAR - 2026);
});

test("the same state always produces the same one-month stress result", () => {
  const state = createDemoState(2035);
  const first = runStressTest(state).stressTests[2035];
  const second = runStressTest(state).stressTests[2035];
  assert.deepEqual(first, second);
  assert.equal(first.durationDays, CRISIS_DAYS);
  assert.equal(first.turnHours, CRISIS_TURN_HOURS);
  assert.equal(first.turns, CRISIS_TURNS);
  assert.equal(CRISIS_DAYS, 30);
  assert.equal(CRISIS_TURNS, 120);
});

test("2045 assessment rewards continuity rather than Japanese centrality", () => {
  const state = createDemoState(2045);
  const assessment = getFinalAssessment(state);
  assert.ok(state.metrics.continuity >= 70);
  assert.ok(assessment.score >= 70 && assessment.score <= 100);
  assert.equal(assessment.passed, true);
  assert.equal(assessment.label, "自律継続圏");
});
