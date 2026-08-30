import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { runComparativeStudy } from "../src/experiments.js";

test("A-E use the same state budget action count and causal seed across five seeds", () => {
  const study = runComparativeStudy(createDemoState(2035));
  assert.equal(study.results.length, 25);
  for (const seed of study.seeds) {
    const rows = study.results.filter((row) => row.seed === seed);
    assert.equal(new Set(rows.map((row) => row.initialStateHash)).size, 1);
    assert.equal(new Set(rows.map((row) => row.budget)).size, 1);
    assert.equal(new Set(rows.map((row) => row.actionCount)).size, 1);
    assert.equal(new Set(rows.map((row) => row.causalSeedHash)).size, 1);
    assert.ok(rows.every((row) => row.evaluationAxes && row.score === undefined));
    assert.ok(rows.every((row) => ["reversibilityWindowTurns", "surveillanceDependencyExposure", "thirdPartyVerificationCoverage", "decisionRightDiversity"].every((key) => Number.isFinite(row.evaluationAxes[key]))));
  }
  assert.equal(study.evaluationPolicy, "axes-first-no-scalar-winner");
  assert.equal(study.sensitivityVariants.length, 3);
  const dRows = study.results.filter((row) => row.strategyId === "D");
  assert.equal(new Set(dRows.map((row) => row.causalSeedHash)).size, 5);
  assert.ok(dRows.every((row) => row.sensitivity.length === 3));
});

test("Japan removal remains pending before 2045 and executes only at 2045", () => {
  const pending = runComparativeStudy(createDemoState(2035));
  assert.deepEqual(pending.japanRemoval, { status: "pending", executed: false, reason: "Japan removal evidence is only valid at 2045", requiredYear: 2045, currentYear: 2035 });
  const study = runComparativeStudy(createDemoState(2045));
  assert.equal(study.japanRemoval.status, "executed");
  assert.ok(study.japanRemoval.removedRelationshipIds.length > 0);
  assert.ok(study.japanRemoval.remainingOperatorIds.every((id) => !id.startsWith("J")));
  assert.ok(Array.isArray(study.japanRemoval.stoppedFunctions));
  assert.ok(study.japanRemoval.stoppedFunctions.length > 0);
  assert.ok(study.japanRemoval.coveredFunctions.length > 0);
  assert.ok(study.japanRemoval.evaluationAxes.coordinationFailedTurns > 0);
});
