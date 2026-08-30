import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { recordJapanRemovalStudy, runComparativeStudy, SENSITIVITY_VARIANTS } from "../src/experiments.js";

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
  assert.equal(new Set(dRows.map((row) => JSON.stringify(row.disabledRelationshipIds))).size, 1);
  assert.ok(dRows.every((row) => row.disabledRelationshipIds.length === 0));
  const eRows = study.results.filter((row) => row.strategyId === "E");
  assert.ok(eRows.every((row) => row.disabledRelationshipIds.length > 0));
  assert.notDeepEqual(dRows[0].disabledRelationshipIds, eRows[0].disabledRelationshipIds);
  assert.ok(dRows.every((row) => row.sensitivity.length === 3));
  assert.ok(dRows.every((row) => new Set(row.sensitivity.map((item) => item.eventStreamHash)).size > 1));
  assert.ok(dRows.every((row) => row.sensitivity.every((item) => item.coefficientVersion === "crisis-coefficients-v1")));
  assert.ok(study.reversalThresholds.every((item) => item.rivalStrategyId !== "D" && item.registeredConclusion !== item.sensitivityConclusion));
  assert.equal(typeof study.falsification.triggered, "boolean");
});

test("governance axes use active actor groups and declared decision rights", () => {
  const study = runComparativeStudy(createDemoState(2035));
  const d = study.results.find((row) => row.strategyId === "D" && row.seed === study.seeds[0]);
  const e = study.results.find((row) => row.strategyId === "E" && row.seed === study.seeds[0]);
  assert.equal(d.evaluationAxes.thirdPartyVerificationCoverage, 5 / 7);
  assert.equal(d.evaluationAxes.decisionRightDiversity, 3);
  assert.equal(e.evaluationAxes.thirdPartyVerificationCoverage, 0);
  assert.equal(e.evaluationAxes.decisionRightDiversity, 0);
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
  assert.equal(study.japanRemoval.cases.length, study.seeds.length * SENSITIVITY_VARIANTS.length);
  assert.equal(study.japanRemoval.assessment.complete, true);
  assert.equal(study.japanRemoval.assessment.actualCaseCount, study.japanRemoval.assessment.expectedCaseCount);
  assert.equal(new Set(study.japanRemoval.cases.map((item) => `${item.seed}:${item.variantId}`)).size, study.japanRemoval.cases.length);
  const recorded = recordJapanRemovalStudy(createDemoState(2045), study);
  assert.equal(recorded.japanRemovalStressTest.year, 2045);
  assert.equal(recorded.japanRemovalStressTest.verdict, "改善余地");
  assert.ok(recorded.japanRemovalStressTest.stoppedFunctions.length > 0);
  assert.equal(recorded.japanRemovalStressTest.cases.length, study.seeds.length * SENSITIVITY_VARIANTS.length);
  assert.equal(recorded.japanRemovalStressTest.assessment.complete, true);
  const incomplete = structuredClone(study);
  incomplete.japanRemoval.cases.pop();
  assert.throws(() => recordJapanRemovalStudy(createDemoState(2045), incomplete), /only an executed 2045 study/);
  const forgedMatrix = structuredClone(study);
  forgedMatrix.japanRemoval.cases[0].seed = "unregistered-seed";
  assert.throws(() => recordJapanRemovalStudy(createDemoState(2045), forgedMatrix), /only an executed 2045 study/);
  const forgedVerdict = structuredClone(study);
  forgedVerdict.japanRemoval.assessment.verdict = "協調継続";
  assert.throws(() => recordJapanRemovalStudy(createDemoState(2045), forgedVerdict), /only an executed 2045 study/);
  assert.throws(() => recordJapanRemovalStudy(createDemoState(2035), pending), /only an executed 2045 study/);
});
