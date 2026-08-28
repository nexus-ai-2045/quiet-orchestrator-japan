import test from "node:test";
import assert from "node:assert/strict";
import {
  AGGREGATE_ACTION_EFFECTS,
  CRISIS_METRIC_WEIGHTS,
  CALIBRATION_VERSION,
  FINAL_ASSESSMENT_WEIGHTS,
  RELATIONSHIP_ACTION_EFFECTS,
  RELATIONSHIP_BENEFIT_DIRECTIONS,
  RELATIONSHIP_CONTRIBUTION_LIMITS,
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
  getStressTestDisplayYears,
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
  assert.deepEqual(RELATIONSHIP_ACTION_EFFECTS, {
    translation: {
      deltas: { maturity: 6, trust: 5, interoperability: 2, disclosureCost: 1 },
      tradeoffs: ["開示コスト +1"],
    },
    verification: {
      deltas: { maturity: 5, trust: 4, verificationAgreement: 12, dependency: -1, disclosureCost: 2 },
      tradeoffs: ["開示コスト +2", "監視化リスク +2"],
    },
    reversibility: {
      deltas: { maturity: 3, interoperability: 4, dependency: -4, alternateRoutes: 1 },
      tradeoffs: ["合意形成の速度を優先しない"],
    },
    redundancy: {
      deltas: { maturity: 4, interoperability: 7, dependency: -8, alternateRoutes: 1, disclosureCost: 1 },
      tradeoffs: ["開示コスト +1", "維持経路が増える"],
    },
    coownership: {
      deltas: { maturity: 4, trust: 3, coOwnership: 10, dependency: -5 },
      tradeoffs: ["日本の単独編集権を縮小"],
    },
  });
  assert.deepEqual(RELATIONSHIP_CONTRIBUTION_WEIGHTS, {
    attributionSafety: {
      verificationAgreement: 0.28,
      trust: 0.14,
      disclosureCost: -0.08,
    },
    coordinationSurvival: {
      maturity: 0.12,
      interoperability: 0.18,
      coOwnership: 0.2,
      alternateRoutes: 1.5,
      dependency: -0.12,
    },
    civilianProtection: {
      interoperability: 0.15,
      trust: 0.1,
      alternateRoutes: 1.2,
      dependency: -0.12,
      disclosureCost: -0.05,
    },
  });
  assert.deepEqual(RELATIONSHIP_CONTRIBUTION_LIMITS, { min: -20, max: 25 });
  assert.deepEqual(AGGREGATE_ACTION_EFFECTS, {
    translation: { coordinationCapital: 7, legitimacy: 3, dependency: -2 },
    verification: { verification: 10, coordinationCapital: 4, surveillance: 2 },
    reversibility: { autonomy: 6, legitimacy: 4, concentration: -3 },
    redundancy: { interoperability: 6, autonomy: 7, dependency: -8 },
    coownership: { continuity: 9, coordinationCapital: 6, concentration: -6 },
  });
  assert.deepEqual(CRISIS_METRIC_WEIGHTS, {
    attributionSafety: { verification: 0.45, coordinationCapital: 0.25, autonomy: 0.2, surveillance: -0.1 },
    coordinationSurvival: { interoperability: 0.3, continuity: 0.35, legitimacy: 0.25, concentration: -0.1 },
    civilianProtection: { legitimacy: 0.35, autonomy: 0.3, verification: 0.2, dependency: -0.15 },
  });
  assert.deepEqual(FINAL_ASSESSMENT_WEIGHTS, {
    continuity: 0.35, coordinationCapital: 0.2, verification: 0.15, interoperability: 0.15,
    autonomy: 0.15, concentration: -0.08, surveillance: -0.05, dependency: -0.07,
  });
  assert.equal(RELATIONSHIP_BENEFIT_DIRECTIONS.dependency, -1);
  assert.equal(RELATIONSHIP_BENEFIT_DIRECTIONS.disclosureCost, -1);
  for (const action of Object.values(RELATIONSHIP_ACTION_EFFECTS)) {
    for (const key of Object.keys(action.deltas)) {
      assert.ok([1, -1].includes(RELATIONSHIP_BENEFIT_DIRECTIONS[key]), `${key} must declare its benefit direction`);
    }
  }
});

test("relationship v1 gives every connection a stable schema", () => {
  const state = createInitialState();
  assert.equal(state.schemaVersion, 3);
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
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(migrated.year, 2030);
  assert.equal(migrated.metrics.verification, 61);
  assert.equal(migrated.relationships["B1-C6"].state.maturity, 46);
  assert.deepEqual(migrated.ledger, []);
  assert.deepEqual(migrated.stressTests, {});
});

test("a legitimate schema-v2 save is backfilled with the known calibration", () => {
  const legacy = createInitialState();
  legacy.schemaVersion = 2;
  for (const relationship of Object.values(legacy.relationships)) {
    delete relationship.calibrationFingerprint;
  }

  const migrated = migrateSimulationState(legacy);
  assert.equal(migrated.schemaVersion, 3);
  assert.equal(
    migrated.relationships["B1-C6"].calibrationFingerprint,
    'relationship-v1.0.0:{"maturity":46,"trust":42,"verificationAgreement":38,"interoperability":36,"coOwnership":28,"dependency":48,"alternateRoutes":1,"disclosureCost":12}',
  );
  assert.equal(previewRelationshipInvestment(migrated).eligible, true);
  assert.notEqual(advanceYear(migrated), migrated);
  assert.ok(runStressTest(migrated).stressTests[migrated.year]);
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
  assert.equal(preview.metricDeltas.continuity, 1);

  const next = advanceYear(state);
  assert.equal(next.ledger[0].deltas.maturity, 2);
  assert.equal(next.ledger[0].metricDeltas.verification, 3);
  assert.equal(next.ledger[0].metricDeltas.continuity, 1);
  assert.equal(next.metrics.continuity - state.metrics.continuity, 1);
});

test("a fully clamped relationship cannot create aggregate or crisis gains", () => {
  const state = selectAction(createInitialState(), "verification");
  Object.assign(state.relationships["B1-C6"].state, {
    maturity: 100,
    trust: 100,
    verificationAgreement: 100,
    dependency: 0,
    disclosureCost: 100,
  });

  const preview = previewRelationshipInvestment(state);
  assert.deepEqual(Object.values(preview.deltas), [0, 0, 0, 0, 0]);
  assert.equal(preview.metricDeltas.verification ?? 0, 0);
  assert.equal(preview.metricDeltas.coordinationCapital ?? 0, 0);
  assert.equal(preview.metricDeltas.surveillance ?? 0, 0);
  assert.equal(preview.eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("an adverse-only relationship delta cannot unlock aggregate gains", () => {
  const state = selectAction(createInitialState(), "verification");
  Object.assign(state.relationships["B1-C6"].state, {
    maturity: 100,
    trust: 100,
    verificationAgreement: 100,
    dependency: 0,
    disclosureCost: 99,
  });

  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.deltas.disclosureCost, 1);
  assert.equal(preview.metricDeltas.verification ?? 0, 0);
  assert.equal(preview.metricDeltas.coordinationCapital ?? 0, 0);
  assert.equal(preview.metricDeltas.continuity ?? 0, 0);
  assert.equal(preview.eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("partially clamped beneficial progress scales aggregate effects", () => {
  const state = selectAction(createInitialState(), "verification");
  Object.assign(state.relationships["B1-C6"].state, {
    maturity: 98,
    trust: 100,
    verificationAgreement: 100,
    dependency: 0,
    disclosureCost: 99,
  });

  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.effectRealization, 2 / 22);
  assert.equal(preview.metricDeltas.verification, 1);
  assert.equal(preview.metricDeltas.coordinationCapital, 0);
  assert.equal(preview.metricDeltas.surveillance, 0);
  assert.equal(preview.eligible, true);
  assert.equal(advanceYear(state).ledger[0].effectRealization, 2 / 22);
});

test("numeric tradeoffs reflect fatigue and clamping instead of configured values", () => {
  const state = selectAction(createDemoState(2038), "verification");
  const preview = previewRelationshipInvestment(state);

  assert.equal(preview.deltas.disclosureCost, 1);
  assert.equal(preview.metricDeltas.surveillance, 1);
  assert.ok(preview.tradeoffs.includes("開示コスト +1"));
  assert.ok(preview.tradeoffs.includes("監視化リスク +1"));
  assert.equal(preview.tradeoffs.includes("開示コスト +2"), false);
  assert.equal(preview.tradeoffs.includes("監視化リスク +2"), false);
});

test("qualitative tradeoffs are omitted when their source delta is clamped to zero", () => {
  const state = selectAction(createInitialState(), "redundancy");
  state.relationships["B1-C6"].state.alternateRoutes = 5;
  const preview = previewRelationshipInvestment(state);

  assert.equal(preview.deltas.alternateRoutes, 0);
  assert.equal(preview.tradeoffs.includes("維持経路が増える"), false);
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
  for (let turn = 0; turn < 30; turn += 1) {
    if ([2030, 2035, 2040].includes(state.year)) state = runStressTest(state);
    state = advanceYear(state);
  }
  assert.equal(state.year, END_YEAR);
  assert.equal(state.history.length, END_YEAR - 2026);
});

test("a checkpoint cannot be skipped before its stress result is recorded", () => {
  let state = createInitialState();
  while (state.year < 2030) state = advanceYear(state);

  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /終末の1ヶ月テスト/);
  assert.strictEqual(advanceYear(state), state);

  const tested = runStressTest(state);
  const advanced = advanceYear(tested);
  assert.equal(advanced.year, 2031);
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

test("role-equivalent labels and ids cannot change preview or stress outcomes", () => {
  const original = createInitialState();
  const relabeled = structuredClone(original);
  const relationship = relabeled.relationships["B1-C6"];
  delete relabeled.relationships["B1-C6"];
  Object.assign(relationship, {
    id: "neutral-role-pair",
    source: "actor-alpha",
    target: "actor-beta",
    label: "Actor Alpha ↔ Actor Beta",
  });
  relabeled.relationships[relationship.id] = relationship;
  relabeled.selectedRelationshipId = relationship.id;
  relabeled.selectedActor = "actor-alpha";
  const roleEquivalentDefinitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6"
      ? {
        ...definition,
        id: relationship.id,
        source: relationship.source,
        target: relationship.target,
        label: relationship.label,
      }
      : definition
  ));

  const originalPreview = previewRelationshipInvestment(original);
  const relabeledPreview = previewRelationshipInvestment(
    relabeled,
    relabeled.selectedAction,
    relabeled.selectedRelationshipId,
    roleEquivalentDefinitions,
  );
  assert.deepEqual(
    {
      eligible: relabeledPreview.eligible,
      cost: relabeledPreview.cost,
      before: relabeledPreview.before,
      after: relabeledPreview.after,
      deltas: relabeledPreview.deltas,
      metricDeltas: relabeledPreview.metricDeltas,
      metricsAfter: relabeledPreview.metricsAfter,
      tradeoffs: relabeledPreview.tradeoffs,
    },
    {
      eligible: originalPreview.eligible,
      cost: originalPreview.cost,
      before: originalPreview.before,
      after: originalPreview.after,
      deltas: originalPreview.deltas,
      metricDeltas: originalPreview.metricDeltas,
      metricsAfter: originalPreview.metricsAfter,
      tradeoffs: originalPreview.tradeoffs,
    },
  );

  const originalAdvanced = advanceYear(original);
  const relabeledAdvanced = advanceYear(relabeled, roleEquivalentDefinitions);
  assert.deepEqual(relabeledAdvanced.metrics, originalAdvanced.metrics);
  assert.deepEqual(
    relabeledAdvanced.relationships[relationship.id].state,
    originalAdvanced.relationships["B1-C6"].state,
  );
  assert.deepEqual(relabeledAdvanced.ledger[0].deltas, originalAdvanced.ledger[0].deltas);

  const relabeledStress = runStressTest(relabeledAdvanced, roleEquivalentDefinitions).stressTests[relabeledAdvanced.year];
  const originalStressAfterAdvance = runStressTest(originalAdvanced).stressTests[originalAdvanced.year];
  assert.deepEqual(
    {
      attributionSafety: relabeledStress.attributionSafety,
      coordinationSurvival: relabeledStress.coordinationSurvival,
      civilianProtection: relabeledStress.civilianProtection,
      verdict: relabeledStress.verdict,
    },
    {
      attributionSafety: originalStressAfterAdvance.attributionSafety,
      coordinationSurvival: originalStressAfterAdvance.coordinationSurvival,
      civilianProtection: originalStressAfterAdvance.civilianProtection,
      verdict: originalStressAfterAdvance.verdict,
    },
  );
});

test("an unknown investable id cannot silently inherit representative calibration", () => {
  const state = createInitialState();
  const relationship = state.relationships["B1-C6"];
  delete state.relationships["B1-C6"];
  relationship.id = "unknown-investable";
  relationship.label = "Unknown investable";
  state.relationships[relationship.id] = relationship;
  state.selectedRelationshipId = relationship.id;

  const preview = previewRelationshipInvestment(state);
  const tested = runStressTest(state);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /校正済み/);
  assert.equal(tested, state);
  assert.equal(tested.stressTests[state.year], undefined);
  assert.equal(tested.ledger.length, 0);
  assert.equal(advanceYear(tested), tested);
});

test("an investable relationship cannot collide with a display-only definition id", () => {
  const state = createInitialState();
  const relationship = state.relationships["B1-C6"];
  delete state.relationships["B1-C6"];
  relationship.id = "J1-B1";
  relationship.label = "Colliding investable";
  state.relationships[relationship.id] = relationship;
  state.selectedRelationshipId = relationship.id;

  const preview = previewRelationshipInvestment(state);
  const tested = runStressTest(state);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /校正済み/);
  assert.equal(tested, state);
  assert.equal(tested.stressTests[state.year], undefined);
  assert.equal(advanceYear(tested), tested);
});

test("a calibrated id cannot authorize a different relationship role", () => {
  const state = createInitialState();
  state.relationships["B1-C6"].source = "J1";
  state.relationships["B1-C6"].target = "B1";

  const preview = previewRelationshipInvestment(state);
  const tested = runStressTest(state);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /校正済み/);
  assert.equal(tested, state);
  assert.equal(tested.stressTests[state.year], undefined);
  assert.equal(advanceYear(tested), tested);
});

test("a persisted relationship cannot use a different calibration baseline", () => {
  const state = createInitialState();
  const changedDefinitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6"
      ? { ...definition, initialState: { ...definition.initialState, maturity: 0 } }
      : definition
  ));

  const preview = previewRelationshipInvestment(
    state,
    state.selectedAction,
    state.selectedRelationshipId,
    changedDefinitions,
  );
  const tested = runStressTest(state, changedDefinitions);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /校正済み/);
  assert.equal(tested, state);
  assert.equal(tested.stressTests[state.year], undefined);
  assert.equal(advanceYear(state, changedDefinitions), state);
});

test("a calibrated relationship cannot be duplicated under another map key", () => {
  const state = createInitialState();
  state.relationships.duplicate = structuredClone(state.relationships["B1-C6"]);

  const preview = previewRelationshipInvestment(state);
  const tested = runStressTest(state);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /校正済み/);
  assert.equal(tested, state);
  assert.equal(tested.stressTests[state.year], undefined);
  assert.equal(advanceYear(state), state);
});

test("role-equivalent stress still responds to a genuinely different relationship state", () => {
  const baseline = createInitialState();
  const changed = structuredClone(baseline);
  changed.relationships["B1-C6"].state.verificationAgreement += 20;

  const baselineResult = runStressTest(baseline).stressTests[baseline.year];
  const changedResult = runStressTest(changed).stressTests[changed.year];
  assert.notEqual(changedResult.attributionSafety, baselineResult.attributionSafety);
});

test("the latest arbitrary-year stress result remains visible beside standard checkpoints", () => {
  const initialTest = runStressTest(createInitialState());
  assert.equal(initialTest.ledger[0].actionLabel, "危機テスト累積スナップショット");
  assert.doesNotMatch(initialTest.ledger[0].reason, /移行/);

  let state = advanceYear(createInitialState());
  state = runStressTest(state);
  assert.deepEqual(getStressTestDisplayYears(state), [2027, 2030, 2035, 2040, 2045]);

  state = advanceYear(state);
  state = runStressTest(state);
  assert.deepEqual(getStressTestDisplayYears(state), [2028, 2030, 2035, 2040, 2045]);
  assert.ok(state.stressTests[2027]);
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

test("a migrated checkpoint creates a deterministic relationship snapshot when no ledger exists", () => {
  const migrated = migrateSimulationState({
    year: 2030,
    metrics: { verification: 61 },
    history: [],
    stressTests: { 2030: { verdict: "legacy result without a causal contribution" } },
  });
  const tested = runStressTest(migrated);
  const contribution = tested.stressTests[2030].relationshipContributions[0];
  const focus = getStressContributionFocus(tested, 2030, contribution.relationshipId);

  assert.equal(tested.ledger.length, 1);
  assert.equal(tested.ledger[0].action, "checkpoint-snapshot");
  assert.deepEqual(tested.ledger[0].before, tested.relationships[contribution.relationshipId].state);
  assert.deepEqual(tested.ledger[0].after, tested.relationships[contribution.relationshipId].state);
  assert.equal(contribution.ledgerEntryId, tested.ledger[0].id);
  assert.equal(focus.ledgerEntryId, tested.ledger[0].id);
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
  const tested = runStressTest(invested);
  const cumulativeEntry = tested.ledger.find((entry) => entry.id === result.relationshipContributions[0].ledgerEntryId);
  assert.deepEqual(cumulativeEntry.before, initial.relationships["B1-C6"].state);
  assert.deepEqual(cumulativeEntry.after, invested.relationships["B1-C6"].state);
  assert.equal(cumulativeEntry.deltas.verificationAgreement, 12);
});

test("2045 assessment remains pending until Japan-removal is actually tested", () => {
  const state = createDemoState(2045);
  const assessment = getFinalAssessment(state);
  assert.ok(state.metrics.continuity >= 70);
  assert.ok(assessment.score >= 70 && assessment.score <= 100);
  assert.equal(assessment.passed, false);
  assert.equal(assessment.label, "撤退検証待ち");
});

test("2045 assessment cannot pass before the final checkpoint succeeds", () => {
  const state = createDemoState(2045);
  delete state.stressTests[2045];
  state.metrics.continuity = 100;
  assert.equal(getFinalAssessment(state).passed, false);
  assert.equal(getFinalAssessment(state).label, "最終検証待ち");
});

test("a failed final checkpoint cannot show the success label", () => {
  const state = createDemoState(2045);
  state.stressTests[2045] = { ...state.stressTests[2045], verdict: "改善余地" };
  state.metrics.continuity = 100;
  const assessment = getFinalAssessment(state);
  assert.equal(assessment.passed, false);
  assert.equal(assessment.label, "最終検証未達");

  state.stressTests[2045].verdict = "協調継続";
  state.japanRemovalStressTest = { verdict: "協調継続" };
  Object.assign(state.metrics, {
    continuity: 69,
    coordinationCapital: 100,
    verification: 100,
    interoperability: 100,
    autonomy: 100,
    concentration: 0,
    surveillance: 0,
    dependency: 0,
  });
  const lowContinuity = getFinalAssessment(state);
  assert.ok(lowContinuity.score >= 70);
  assert.equal(lowContinuity.passed, false);
  assert.equal(lowContinuity.label, "移行途上");
});
