import test from "node:test";
import assert from "node:assert/strict";
import {
  CALIBRATION_VERSION,
  RELATIONSHIP_ACTION_EFFECTS,
  RELATIONSHIP_CONTRIBUTION_WEIGHTS,
  REPRESENTATIVE_INITIAL_STATE,
} from "../src/calibration-v0.js";
import {
  advanceYear,
  createDemoState,
  createInitialState,
  CRISIS_DAYS,
  CRISIS_TURN_HOURS,
  CRISIS_TURNS,
  END_YEAR,
  getFinalAssessment,
  getRelationshipContribution,
  getStressContributionFocus,
  migrateSimulationState,
  previewRelationshipInvestment,
  RELATIONSHIPS,
  runStressTest,
  selectAction,
  selectRelationship,
} from "../src/simulation.js";

test("the adopted calibration v0 remains explicit and versioned", () => {
  assert.equal(CALIBRATION_VERSION, "relationship-v1.0.0");
  assert.equal(Object.isFrozen(RELATIONSHIP_ACTION_EFFECTS.verification.deltas), true);
  assert.deepEqual(REPRESENTATIVE_INITIAL_STATE, {
    maturity: 46,
    trust: 42,
    verificationAgreement: 38,
    interoperability: 36,
    coOwnership: 28,
    dependency: 48,
    alternateRoutes: 1,
    disclosureCost: 12,
  });
  assert.deepEqual(RELATIONSHIP_ACTION_EFFECTS.verification.deltas, {
    maturity: 5,
    trust: 4,
    verificationAgreement: 12,
    dependency: -1,
    disclosureCost: 2,
  });
  assert.equal(RELATIONSHIP_CONTRIBUTION_WEIGHTS.coordinationSurvival.coOwnership, 0.2);
});

test("relationship v1 gives every connection a stable schema", () => {
  const state = createInitialState();
  assert.equal(state.schemaVersion, 2);
  assert.equal(RELATIONSHIPS.length, 20);
  assert.equal(Object.keys(state.relationships).length, 20);
  assert.equal(state.selectedRelationshipId, "B1-C6");

  const relationship = state.relationships["B1-C6"];
  assert.deepEqual(
    Object.keys(relationship.state).sort(),
    [
      "alternateRoutes", "coOwnership", "dependency", "disclosureCost",
      "interoperability", "maturity", "trust", "verificationAgreement",
    ],
  );
  assert.equal(relationship.investable, true);
});

test("legacy aggregate state has an explicit migration path", () => {
  const migrated = migrateSimulationState({
    year: 2030,
    metrics: { verification: 61 },
    history: [],
    stressTests: { 2030: { verdict: "legacy result without a causal contribution" } },
  });
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.year, 2030);
  assert.equal(migrated.metrics.verification, 61);
  assert.equal(migrated.relationships["B1-C6"].state.maturity, 46);
  assert.deepEqual(migrated.ledger, []);
  assert.deepEqual(migrated.stressTests, {});
});

test("the selected yearly investment previews an exact relationship delta", () => {
  const state = selectAction(createInitialState(), "verification");
  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.eligible, true);
  assert.equal(preview.relationshipId, "B1-C6");
  assert.equal(preview.cost, 25);
  assert.equal(preview.deltas.verificationAgreement, 12);
  assert.equal(preview.after.verificationAgreement, 50);
  assert.ok(preview.tradeoffs.includes("開示コスト +2"));
});

test("preview and ledger record the applied delta after clamping", () => {
  const state = selectAction(createInitialState(), "verification");
  state.relationships["B1-C6"].state.maturity = 98;
  state.metrics.verification = 97;
  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.after.maturity, 100);
  assert.equal(preview.deltas.maturity, 2);
  assert.equal(preview.metricDeltas.verification, 3);

  const next = advanceYear(state);
  assert.equal(next.ledger[0].deltas.maturity, 2);
  assert.equal(next.ledger[0].metricDeltas.verification, 3);
});

test("verification investment deterministically increases verification capacity", () => {
  const initial = selectAction(createInitialState(), "verification");
  const next = advanceYear(initial);
  assert.equal(next.year, 2027);
  assert.equal(next.metrics.verification, 48);
  assert.equal(next.relationships["B1-C6"].state.verificationAgreement, 50);
  assert.equal(next.ledger.length, 1);
  assert.deepEqual(next.ledger[0].before, initial.relationships["B1-C6"].state);
  assert.deepEqual(next.ledger[0].after, next.relationships["B1-C6"].state);
  assert.equal(next.ledger[0].ruleVersion, "relationship-v1.0.0");
  assert.equal(next.ledger[0].seed, "baseline-0");
});

test("a display-only relationship cannot silently receive the representative investment", () => {
  const initial = selectRelationship(createInitialState(), "J1-B1");
  const preview = previewRelationshipInvestment(initial);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /P1/);
  assert.strictEqual(advanceYear(initial), initial);
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
  assert.equal(first.relationshipContributions[0].relationshipId, "B1-C6");
});

test("a stress contribution keeps the checkpoint ledger context", () => {
  const state = runStressTest(createDemoState(2035));
  const contribution = state.stressTests[2035].relationshipContributions[0];
  const focus = getStressContributionFocus(state, 2035, contribution.relationshipId);
  assert.equal(focus.checkpointYear, 2035);
  assert.equal(focus.relationshipId, "B1-C6");
  assert.equal(focus.ledgerEntryId, contribution.ledgerEntryId);
  assert.equal(state.ledger.find((entry) => entry.id === focus.ledgerEntryId).year <= 2035, true);
});

test("relationship investment is traceable to a larger crisis contribution", () => {
  const initial = createInitialState();
  const invested = advanceYear(selectAction(initial, "verification"));
  const before = getRelationshipContribution(initial, "B1-C6");
  const after = getRelationshipContribution(invested, "B1-C6");
  assert.ok(after.attributionSafety > before.attributionSafety);

  const result = runStressTest(invested).stressTests[2027];
  assert.deepEqual(
    {
      relationshipId: result.relationshipContributions[0].relationshipId,
      relationshipLabel: result.relationshipContributions[0].relationshipLabel,
      attributionSafety: result.relationshipContributions[0].attributionSafety,
      coordinationSurvival: result.relationshipContributions[0].coordinationSurvival,
      civilianProtection: result.relationshipContributions[0].civilianProtection,
    },
    after,
  );
  assert.equal(result.relationshipContributions[0].checkpointYear, 2027);
  assert.equal(result.relationshipContributions[0].ledgerEntryId, invested.ledger[0].id);
});

test("2045 assessment rewards continuity rather than Japanese centrality", () => {
  const state = createDemoState(2045);
  const assessment = getFinalAssessment(state);
  assert.ok(state.metrics.continuity >= 70);
  assert.ok(assessment.score >= 70 && assessment.score <= 100);
  assert.equal(assessment.passed, true);
  assert.equal(assessment.label, "自律継続圏");
});
