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
    assert.equal(new Set(rows.map((row) => row.causalScenarioHash)).size, 1);
  }
  assert.ok(study.dLossSeeds.length >= 1);
});

test("Japan removal reports remaining operators and stopped functions", () => {
  const study = runComparativeStudy(createDemoState(2035));
  assert.ok(study.japanRemoval.removedRelationshipIds.length > 0);
  assert.ok(study.japanRemoval.remainingOperatorIds.every((id) => !id.startsWith("J")));
  assert.equal(study.japanRemoval.stoppedFunctions.length, study.japanRemoval.removedRelationshipIds.length);
});
