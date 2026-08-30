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
  START_YEAR,
  getFinalAssessment,
  getRelationshipEdgePresentation,
  getRelationshipContribution,
  getLedgerEntryFocus,
  getLedgerSignature,
  getStressContributionFocus,
  getStressTestDisplayYears,
  listLedgerTrail,
  migrateSimulationState,
  previewInvestmentPortfolio,
  previewRelationshipInvestment,
  previewSelectedInvestment,
  RELATIONSHIPS,
  runStressTest,
  selectAction,
  selectRelationship,
  validateRelationshipPortfolio,
  validateSimulationExecutionState,
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
  assert.equal(state.schemaVersion, 4);
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

test("the adopted M2 portfolio calibrates all 20 relationships from explicit archetypes", () => {
  const report = validateRelationshipPortfolio(createInitialState());
  assert.equal(report.valid, true);
  assert.equal(report.total, 20);
  assert.deepEqual(report.calibration, { calibrated: 20, uncalibrated: 0 });
  assert.deepEqual(report.errors, []);

  const verification = RELATIONSHIPS.find(({ id }) => id === "J1-B1");
  const interoperability = RELATIONSHIPS.find(({ id }) => id === "J4-U4");
  const coownership = RELATIONSHIPS.find(({ id }) => id === "B1-C5");
  const contested = RELATIONSHIPS.find(({ id }) => id === "U3-B1");
  assert.deepEqual(
    [verification.archetype, interoperability.archetype, coownership.archetype],
    ["verification", "interoperability", "coownership"],
  );
  assert.equal(verification.calibrationVersion, "relationship-v1.1.0");
  assert.deepEqual(verification.initialState, {
    maturity: 36, trust: 34, verificationAgreement: 40, interoperability: 28,
    coOwnership: 22, dependency: 50, alternateRoutes: 1, disclosureCost: 12,
  });
  assert.equal(contested.contested, true);
  assert.deepEqual(contested.initialState, {
    maturity: 32, trust: 26, verificationAgreement: 34, interoperability: 28,
    coOwnership: 22, dependency: 58, alternateRoutes: 1, disclosureCost: 18,
  });
});

test("M2 archetypes produce nonuniform action eligibility and deterministic deltas", () => {
  let state = selectRelationship(createInitialState(), "J1-B1");
  assert.equal(previewRelationshipInvestment(state, "redundancy", "J1-B1").eligible, false);
  const verification = previewRelationshipInvestment(state, "verification", "J1-B1");
  assert.equal(verification.eligible, true);
  assert.deepEqual(verification.deltas, {
    maturity: 5, trust: 4, verificationAgreement: 12, dependency: -1, disclosureCost: 2,
  });

  state = selectRelationship(createInitialState(), "J4-U4");
  const redundancy = previewRelationshipInvestment(state, "redundancy", "J4-U4");
  assert.equal(redundancy.eligible, true);
  assert.deepEqual(redundancy.deltas, {
    maturity: 4, interoperability: 7, dependency: -8, alternateRoutes: 1, disclosureCost: 1,
  });

  state = selectRelationship(createInitialState(), "U3-B1");
  const contested = previewRelationshipInvestment(state, "verification", "U3-B1");
  assert.equal(contested.eligible, true);
  assert.deepEqual(contested.deltas, {
    maturity: 3, trust: 3, verificationAgreement: 9, dependency: 0, disclosureCost: 2,
  });
});

test("the M2 portfolio gate fails closed on map identity and state range drift", () => {
  const state = createInitialState();
  state.relationships["J1-B1"].id = "B1-C6";
  state.relationships["J1-B1"].source = "unknown-actor";
  state.relationships["J1-B1"].state.trust = 101;
  state.relationships["J1-B1"].state.alternateRoutes = 1.5;
  const report = validateRelationshipPortfolio(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("map key")));
  assert.ok(report.errors.some((error) => error.includes("trust")));
  assert.ok(report.errors.some((error) => error.includes("unknown actor")));
  assert.ok(report.errors.some((error) => error.includes("integer")));

  const malformed = createInitialState();
  malformed.relationships["J1-B1"] = null;
  assert.equal(validateRelationshipPortfolio(malformed).valid, false);

  const metadataDrift = createInitialState();
  metadataDrift.relationships["J1-B1"].investable = false;
  metadataDrift.relationships["J1-B1"].purpose = "forged";
  metadataDrift.relationships["J1-B1"].contested = true;
  const metadataReport = validateRelationshipPortfolio(metadataDrift);
  assert.equal(metadataReport.valid, false);
  assert.ok(metadataReport.errors.some((error) => error.includes("investable drift")));
  assert.ok(metadataReport.errors.some((error) => error.includes("purpose drift")));
  assert.ok(metadataReport.errors.some((error) => error.includes("contested drift")));

  assert.equal(validateRelationshipPortfolio(createInitialState(), null).valid, false);
  assert.equal(validateRelationshipPortfolio(createInitialState(), [null]).valid, false);

  const fingerprintDrift = createInitialState();
  fingerprintDrift.relationships["B1-C6"].calibrationFingerprint = "forged";
  assert.equal(validateRelationshipPortfolio(fingerprintDrift).valid, false);

  const uncalibratedDrift = createInitialState();
  uncalibratedDrift.relationships["J1-B1"].state.trust += 1;
  assert.equal(validateRelationshipPortfolio(uncalibratedDrift).valid, false);

  const emptyBaselineDefinitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6"
      ? { ...definition, initialState: {} }
      : definition
  ));
  const emptyBaselineState = createInitialState();
  emptyBaselineState.relationships["B1-C6"].calibrationFingerprint = "relationship-v1.0.0:{}";
  const emptyBaselineReport = validateRelationshipPortfolio(emptyBaselineState, emptyBaselineDefinitions);
  assert.equal(emptyBaselineReport.valid, false);
  assert.ok(emptyBaselineReport.errors.some((error) => error.includes("calibrated definition baseline is invalid")));
  assert.equal(
    previewInvestmentPortfolio(
      emptyBaselineState,
      [{ relationshipId: "B1-C6", actionId: "verification" }],
      emptyBaselineDefinitions,
    ).eligible,
    false,
  );
  assert.equal(getRelationshipContribution(emptyBaselineState, "B1-C6", emptyBaselineDefinitions), null);

  for (const [field, value] of [["contested", "false"], ["investable", 0]]) {
    const definitions = RELATIONSHIPS.map((definition) => (
      definition.id === "B1-C6" ? { ...definition, [field]: value } : definition
    ));
    const corrupted = createInitialState();
    corrupted.relationships["B1-C6"][field] = value;
    const report = validateRelationshipPortfolio(corrupted, definitions);
    assert.equal(report.valid, false, field);
    assert.ok(report.errors.some((error) => error.includes("must be boolean")), field);
    assert.equal(
      previewInvestmentPortfolio(
        corrupted,
        [{ relationshipId: "B1-C6", actionId: "verification" }],
        definitions,
      ).eligible,
      false,
      field,
    );
    assert.strictEqual(advanceYear(corrupted, definitions), corrupted, field);
  }
});

test("primary investment flow routes through the portfolio gate", () => {
  const drifted = createInitialState();
  drifted.relationships["J1-B1"].state.trust += 1;
  assert.equal(validateRelationshipPortfolio(drifted).valid, false);
  assert.equal(previewSelectedInvestment(drifted).eligible, false);
  assert.equal(previewRelationshipInvestment(drifted).eligible, true);
  assert.strictEqual(advanceYear(drifted), drifted);

  const malformedBudget = createInitialState();
  malformedBudget.budget = "100";
  assert.equal(previewSelectedInvestment(malformedBudget).eligible, false);
  assert.strictEqual(advanceYear(malformedBudget), malformedBudget);

  const healthy = createInitialState();
  const preview = previewSelectedInvestment(healthy);
  assert.equal(preview.eligible, true);
  assert.equal(preview.relationshipId, "B1-C6");
  assert.notEqual(advanceYear(healthy), healthy);
});

test("an investment portfolio enforces one-to-three unique calibrated targets and the annual budget", () => {
  const state = createInitialState();
  assert.equal(previewInvestmentPortfolio(state, []).eligible, false);
  assert.equal(previewInvestmentPortfolio(state, [null]).eligible, false);
  assert.equal(previewInvestmentPortfolio(state, [{ relationshipId: "", actionId: "verification" }]).eligible, false);
  const malformedBudget = structuredClone(state);
  malformedBudget.budget = "100";
  assert.equal(previewInvestmentPortfolio(malformedBudget, [{ relationshipId: "B1-C6", actionId: "verification" }]).eligible, false);
  malformedBudget.budget = Infinity;
  assert.equal(previewInvestmentPortfolio(malformedBudget, [{ relationshipId: "B1-C6", actionId: "verification" }]).eligible, false);
  assert.equal(previewInvestmentPortfolio(state, [
    { relationshipId: "B1-C6", actionId: "verification" },
    { relationshipId: "B1-C6", actionId: "translation" },
  ]).eligible, false);
  assert.equal(previewInvestmentPortfolio(state, [
    { relationshipId: "B1-C6", actionId: "verification" },
    { relationshipId: "J1-B1", actionId: "translation" },
  ]).reason, "年間アクションは全配分で同一にしてください");
  const multiTarget = previewInvestmentPortfolio(state, [
    { relationshipId: "B1-C6", actionId: "verification" },
    { relationshipId: "J1-B1", actionId: "verification" },
  ]);
  assert.equal(multiTarget.eligible, true);
  assert.equal(multiTarget.items.length, 2);
  assert.equal(multiTarget.totalCost, 50);

  const plan = previewInvestmentPortfolio(state, [{ relationshipId: "B1-C6", actionId: "verification" }]);
  assert.equal(plan.eligible, true);
  assert.equal(plan.totalCost, 25);
  assert.equal(plan.items.length, 1);

  const expensive = structuredClone(state);
  expensive.budget = 20;
  assert.equal(previewInvestmentPortfolio(expensive, [{ relationshipId: "B1-C6", actionId: "verification" }]).eligible, false);
});

test("edge presentation is derived from relationship state rather than year or array position", () => {
  const state = createInitialState();
  const base = getRelationshipEdgePresentation(state.relationships["J1-B1"]);
  state.relationships["J1-B1"].state.maturity = 90;
  state.relationships["J1-B1"].state.trust = 85;
  state.relationships["J1-B1"].state.dependency = 10;
  const strengthened = getRelationshipEdgePresentation(state.relationships["J1-B1"]);
  assert.ok(strengthened.strokeWidth > base.strokeWidth);
  assert.ok(strengthened.opacity > base.opacity);
  assert.notEqual(strengthened.stroke, base.stroke);
  const malformed = getRelationshipEdgePresentation({ state: { maturity: "bad", trust: null, dependency: undefined } });
  assert.equal(Number.isFinite(malformed.strokeWidth), true);
  assert.equal(Number.isFinite(malformed.opacity), true);
});

test("legacy aggregate state has an explicit migration path", () => {
  const migrated = migrateSimulationState({
    year: 2030,
    metrics: { verification: 61 },
    history: [],
    stressTests: { 2030: { verdict: "legacy result without a causal contribution" } },
  });
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.year, 2030);
  assert.equal(migrated.metrics.verification, 61);
  assert.equal(migrated.relationships["B1-C6"].state.maturity, 46);
  assert.deepEqual(migrated.ledger, []);
  assert.deepEqual(migrated.stressTests, {});
  assert.equal(validateSimulationExecutionState(migrated).valid, false);
  assert.strictEqual(runStressTest(migrated), migrated);
});

test("a legitimate schema-v2 save is backfilled with the known calibration", () => {
  const legacy = createInitialState();
  legacy.schemaVersion = 2;
  for (const relationship of Object.values(legacy.relationships)) {
    delete relationship.calibrationFingerprint;
  }

  const migrated = migrateSimulationState(legacy);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(
    migrated.relationships["B1-C6"].calibrationFingerprint,
    'relationship-v1.0.0:{"alternateRoutes":1,"coOwnership":28,"dependency":48,"disclosureCost":12,"interoperability":36,"maturity":46,"trust":42,"verificationAgreement":38}',
  );
  assert.equal(previewRelationshipInvestment(migrated).eligible, true);
  assert.notEqual(advanceYear(migrated), migrated);
  assert.ok(runStressTest(migrated).stressTests[migrated.year]);
});

test("schema-v3 migration backfills only absent M2 metadata and preserves conflicts", () => {
  const legacy = createInitialState();
  legacy.schemaVersion = 3;
  const absent = legacy.relationships["J1-B1"];
  delete absent.archetype;
  delete absent.calibrationVersion;
  delete absent.actionMultipliers;
  delete absent.positiveDeltaMultiplier;
  delete absent.calibrationFingerprint;
  legacy.relationships["J2-U2"].archetype = "forged-archetype";

  const migrated = migrateSimulationState(legacy);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.relationships["J1-B1"].archetype, RELATIONSHIPS.find((item) => item.id === "J1-B1").archetype);
  assert.deepEqual(migrated.relationships["J1-B1"].actionMultipliers, RELATIONSHIPS.find((item) => item.id === "J1-B1").actionMultipliers);
  assert.match(migrated.relationships["J1-B1"].calibrationFingerprint, /^relationship-v1\.1\.0:/);
  assert.equal(migrated.relationships["J2-U2"].archetype, "forged-archetype");
  assert.equal(validateSimulationExecutionState(migrated).valid, false);
});

test("runtime rejects incomplete or out-of-range calibration multiplier metadata", () => {
  const state = createInitialState();
  const missingAction = structuredClone(state);
  delete missingAction.relationships["J1-B1"].actionMultipliers.translation;
  assert.ok(validateSimulationExecutionState(missingAction).errors.some((error) => error.includes("actionMultipliers")));

  const invalidPositive = structuredClone(state);
  invalidPositive.relationships["J1-B1"].positiveDeltaMultiplier = Number.POSITIVE_INFINITY;
  assert.ok(validateSimulationExecutionState(invalidPositive).errors.some((error) => error.includes("positiveDeltaMultiplier")));

  const badDefinitions = RELATIONSHIPS.map((definition) => definition.id === "J1-B1"
    ? { ...definition, actionMultipliers: { ...definition.actionMultipliers, verification: 1.01 } }
    : definition);
  assert.ok(validateSimulationExecutionState(state, badDefinitions).errors.some((error) => error.includes("multiplier must be null or within 0-1")));
});

test("calibration fingerprints ignore initialState key insertion order", () => {
  const state = createInitialState();
  const original = state.relationships["B1-C6"].state;
  const reorderedInitialState = {
    disclosureCost: 12,
    alternateRoutes: 1,
    dependency: 48,
    coOwnership: 28,
    interoperability: 36,
    verificationAgreement: 38,
    trust: 42,
    maturity: 46,
  };
  const reorderedDefinitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6"
      ? { ...definition, initialState: reorderedInitialState }
      : definition
  ));

  assert.notEqual(JSON.stringify(reorderedInitialState), JSON.stringify(original));
  assert.equal(previewRelationshipInvestment(state, state.selectedAction, state.selectedRelationshipId, reorderedDefinitions).eligible, true);
  assert.notEqual(advanceYear(state, reorderedDefinitions), state);
  assert.ok(runStressTest(state, reorderedDefinitions).stressTests[state.year]);
});

test("an extra unresolved investable blocks preview and advance", () => {
  const state = createInitialState();
  state.relationships["unknown-extra"] = {
    ...structuredClone(state.relationships["B1-C6"]),
    id: "unknown-extra",
    label: "Unknown extra investable",
    source: "actor-x",
    target: "actor-y",
    calibrationFingerprint: "relationship-v0.9.0:{\"maturity\":0}",
  };

  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /校正済み/);
  assert.strictEqual(advanceYear(state), state);
  assert.strictEqual(runStressTest(state), state);
});

test("schema-v2 migration preserves a conflicting calibration fingerprint", () => {
  const legacy = createInitialState();
  legacy.schemaVersion = 2;
  for (const relationship of Object.values(legacy.relationships)) {
    if (!relationship.investable) {
      delete relationship.calibrationFingerprint;
      continue;
    }
    relationship.calibrationFingerprint = 'relationship-v0.9.0:{"maturity":0}';
  }

  const migrated = migrateSimulationState(legacy);
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.relationships["B1-C6"].calibrationFingerprint, 'relationship-v0.9.0:{"maturity":0}');
  assert.equal(previewRelationshipInvestment(migrated).eligible, false);
  assert.strictEqual(advanceYear(migrated), migrated);
  assert.strictEqual(runStressTest(migrated), migrated);
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

test("preview records clamping but noncanonical starting state cannot execute", () => {
  const state = selectAction(createInitialState(), "verification");
  state.relationships["B1-C6"].state.maturity = 98;
  state.metrics.verification = 97;
  const preview = previewRelationshipInvestment(state);
  assert.equal(preview.after.maturity, 100);
  assert.equal(preview.deltas.maturity, 2);
  assert.equal(preview.metricDeltas.verification, 3);
  assert.equal(preview.metricDeltas.continuity, 1);

  assert.strictEqual(advanceYear(state), state);
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
  assert.strictEqual(advanceYear(state), state);
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
  assert.deepEqual(next.ledger[0].effects, {
    direct: next.ledger[0].deltas,
    spillover: next.ledger[0].metricDeltas,
    conflict: [],
    sideEffects: next.ledger[0].tradeoffs,
  });
});

test("an archetype rejects an action that is not eligible for that connection", () => {
  const initial = selectRelationship(createInitialState(), "J1-B1");
  const preview = previewRelationshipInvestment(initial, "redundancy", "J1-B1");
  assert.equal(preview.eligible, false);
  assert.match(preview.reason, /適用しません/);
  const selected = selectAction(initial, "redundancy");
  assert.strictEqual(advanceYear(selected), selected);
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
  assert.ok(first.relationshipContributions.some(({ relationshipId }) => relationshipId === "B1-C6"));
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

test("non-Boolean investable flags cannot authorize a calibrated relationship", () => {
  for (const corruptedLayer of ["definition", "state"]) {
    const state = createInitialState();
    const changedDefinitions = RELATIONSHIPS.map((definition) => (
      definition.id === "B1-C6"
        ? { ...definition, investable: corruptedLayer === "definition" ? "false" : definition.investable }
        : definition
    ));
    if (corruptedLayer === "state") state.relationships["B1-C6"].investable = "false";

    const preview = previewRelationshipInvestment(
      state,
      state.selectedAction,
      state.selectedRelationshipId,
      changedDefinitions,
    );
    assert.equal(preview.eligible, false, corruptedLayer);
    assert.match(preview.reason, /校正済み/, corruptedLayer);
    assert.equal(runStressTest(state, changedDefinitions), state, corruptedLayer);
  }
});

test("portfolio execution rejects missing labels and zero calibrated relationships", () => {
  const blankLabel = createInitialState();
  blankLabel.relationships["B1-C6"].label = "";
  const blankDefinitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6" ? { ...definition, label: "" } : definition
  ));
  assert.equal(validateRelationshipPortfolio(blankLabel, blankDefinitions).valid, false);
  assert.equal(
    previewInvestmentPortfolio(blankLabel, [{ relationshipId: "B1-C6", actionId: "verification" }], blankDefinitions).eligible,
    false,
  );

  const noCalibration = createInitialState();
  for (const relationship of Object.values(noCalibration.relationships)) relationship.investable = false;
  const noCalibrationDefinitions = RELATIONSHIPS.map((definition) => ({ ...definition, investable: false }));
  assert.equal(validateRelationshipPortfolio(noCalibration, noCalibrationDefinitions).valid, false);
  assert.strictEqual(runStressTest(noCalibration, noCalibrationDefinitions), noCalibration);
});

test("portfolio execution rejects a blank relationship definition id", () => {
  const state = createInitialState();
  const relationship = state.relationships["B1-C6"];
  delete state.relationships["B1-C6"];
  relationship.id = "";
  state.relationships[""] = relationship;
  const definitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6" ? { ...definition, id: "" } : definition
  ));

  assert.equal(validateRelationshipPortfolio(state, definitions).valid, false);
  assert.strictEqual(runStressTest(state, definitions), state);
});

test("portfolio execution rejects malformed aggregate state containers", () => {
  for (const mutate of [
    (state) => { state.metrics.verification = "38"; },
    (state) => { state.metrics.verification = Number.NaN; },
    (state) => { state.metrics.verification = -1; },
    (state) => { state.metrics.verification = 101; },
    (state) => { delete state.metrics.verification; },
    (state) => { state.metrics.extra = 1; },
    (state) => { state.ledger = null; },
    (state) => { state.ledger = {}; },
    (state) => { state.ledger = [null]; },
    (state) => {
      const entry = runStressTest(state).ledger[0];
      state.ledger = [entry, structuredClone(entry)];
    },
    (state) => { state.history = null; },
    (state) => { state.history = {}; },
    (state) => { state.stressTests = []; },
    (state) => { state.stressTests = { 2030: { relationshipContributions: [{}] } }; },
    (state) => {
      const tested = runStressTest(state);
      state.ledger = tested.ledger;
      state.stressTests = tested.stressTests;
      state.stressTests[state.year].verdict = "協調継続";
    },
    (state) => {
      const tested = runStressTest(state);
      state.ledger = tested.ledger;
      state.stressTests = tested.stressTests;
      state.stressTests[state.year].relationshipContributions[0].ledgerEntryId = "missing";
    },
    (state) => { state.seed = ""; },
    (state) => {
      const tested = runStressTest(state);
      state.ledger = tested.ledger;
      state.stressTests = tested.stressTests;
      state.ledger[0].deltas.trust = { forged: true };
    },
    (state) => {
      const tested = runStressTest(state);
      state.ledger = tested.ledger;
      state.stressTests = tested.stressTests;
      state.stressTests[state.year].relationshipContributions[0].attributionSafety += 1;
    },
    (state) => {
      const tested = runStressTest(createDemoState(2030));
      state.ledger = tested.ledger;
      state.stressTests = tested.stressTests;
    },
    (state) => { state.schemaVersion = 2; },
  ]) {
    const state = createInitialState();
    mutate(state);
    assert.equal(validateSimulationExecutionState(state).valid, false);
    assert.equal(
      previewInvestmentPortfolio(state, [{ relationshipId: "B1-C6", actionId: "verification" }]).eligible,
      false,
    );
    assert.strictEqual(advanceYear(state), state);
    assert.strictEqual(runStressTest(state), state);
  }
  assert.equal(validateSimulationExecutionState(createInitialState()).valid, true);
});

test("execution state rejects future-dated stress and ledger evidence", () => {
  const future = createInitialState();
  const tested = createDemoState(2030);
  future.ledger = structuredClone(tested.ledger);
  future.stressTests = structuredClone(tested.stressTests);
  assert.equal(future.year, 2026);
  assert.equal(validateSimulationExecutionState(future).valid, false);
  assert.ok(validateSimulationExecutionState(future).errors.some((error) => error.includes("cannot exceed the current simulation year") || error.includes("elapsed simulation year")));
  assert.equal(previewSelectedInvestment(future).eligible, false);
  assert.strictEqual(advanceYear(future), future);
  assert.strictEqual(runStressTest(future), future);
});

test("execution state binds stress contributions to checkpoint snapshots", () => {
  const state = runStressTest(createInitialState());
  const contribution = state.stressTests[state.year].relationshipContributions[0];
  const original = contribution.attributionSafety;
  contribution.attributionSafety = original === 0 ? 1 : original - 1;
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("does not match its checkpoint snapshot")));
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("execution state rejects non-numeric ledger delta values", () => {
  const state = advanceYear(createInitialState());
  state.ledger[0].deltas.trust = { forged: true };
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("must be a finite number")));
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(advanceYear(state), state);
  assert.strictEqual(runStressTest(state), state);
});

test("execution state requires a nonempty string seed", () => {
  for (const seed of [null, "", "   ", 0, 12, { value: "baseline-0" }]) {
    const state = createInitialState();
    state.seed = seed;
    assert.equal(validateSimulationExecutionState(state).valid, false, String(seed));
    assert.equal(previewSelectedInvestment(state).eligible, false, String(seed));
    assert.strictEqual(advanceYear(state), state, String(seed));
    assert.strictEqual(runStressTest(state), state, String(seed));
  }
});

test("execution state requires ledger deltas for every changed before/after field", () => {
  const state = advanceYear(createInitialState());
  state.ledger[0].deltas = {};
  state.ledger[0].metricDeltas = {};
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("missing required key")));
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("execution state binds checkpoint snapshots to the canonical relationship baseline", () => {
  const state = runStressTest(createInitialState());
  const contribution = state.stressTests[state.year].relationshipContributions[0];
  const entry = state.ledger.find((item) => item.id === contribution.ledgerEntryId);
  entry.before = Object.fromEntries(Object.keys(entry.before).map((key) => [key, 0]));
  entry.deltas = Object.fromEntries(Object.keys(entry.after).map((key) => [key, entry.after[key] - entry.before[key]]));
  const recalculated = {
    attributionSafety: contribution.attributionSafety,
    coordinationSurvival: contribution.coordinationSurvival,
    civilianProtection: contribution.civilianProtection,
  };
  // Keep contribution values in range but detached from the canonical baseline.
  Object.assign(contribution, recalculated);
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("calibrated baseline")));
});

test("execution state recomputes persisted stress aggregate scores", () => {
  const state = runStressTest(createInitialState());
  const result = state.stressTests[state.year];
  result.attributionSafety = 99;
  result.coordinationSurvival = 99;
  result.verdict = "協調継続";
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("does not match recomputed evidence")));
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("execution state requires ledger entry seeds to match the simulation seed", () => {
  const state = advanceYear(createInitialState());
  state.ledger[0].seed = "";
  assert.equal(validateSimulationExecutionState(state).valid, false);
  state.ledger[0].seed = "other-seed";
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(runStressTest(state), state);
});

test("execution state rejects non-string ledger tradeoffs", () => {
  const state = advanceYear(createInitialState());
  state.ledger[0].tradeoffs = [{ forged: true }];
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("tradeoffs must be nonempty strings")));
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("execution state requires exactly one stress contribution per calibrated relationship", () => {
  const state = runStressTest(createInitialState());
  const contribution = state.stressTests[state.year].relationshipContributions[0];
  state.stressTests[state.year].relationshipContributions = [contribution, structuredClone(contribution)];
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => (
    error.includes("uniquely identify") || error.includes("exactly the calibrated")
  )));
  assert.strictEqual(advanceYear(state), state);
});

test("execution state rejects a ledger entry reassigned to another calibrated relationship", () => {
  const state = advanceYear(createInitialState());
  state.ledger[0].relationshipId = "J1-B1";
  state.ledger[0].relationshipLabel = state.relationships["J1-B1"].label;
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => (
    error.includes("timeline") || error.includes("replayed") || error.includes("canonical")
  )));
  assert.equal(previewSelectedInvestment(state).eligible, false);
  assert.strictEqual(advanceYear(state), state);
});

test("execution state recomputes historical stress scores from their metrics snapshot", () => {
  let state = runStressTest(createDemoState(2030));
  state = advanceYear(state);
  state.stressTests[2030].attributionSafety = 99;
  state.stressTests[2030].coordinationSurvival = 99;
  state.stressTests[2030].verdict = "協調継続";
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.strictEqual(advanceYear(state), state);
});

test("execution state rejects missing stress metrics snapshots", () => {
  const state = runStressTest(createInitialState());
  delete state.stressTests[state.year].metricsSnapshot;
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.strictEqual(runStressTest(state), state);
});

test("execution state binds the current-year stress metrics snapshot to current metrics", () => {
  const state = runStressTest(createInitialState());
  state.stressTests[state.year].metricsSnapshot.verification += 1;
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("replayed simulation year")));
});

test("execution state requires a continuous annual relationship timeline", () => {
  let state = advanceYear(createInitialState());
  state = advanceYear(state);
  state.ledger[1].before.trust -= 1;
  state.ledger[1].deltas.trust = state.ledger[1].after.trust - state.ledger[1].before.trust;
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("timeline must be continuous")));
});

test("schema-v3 migration deterministically backfills persisted execution evidence", () => {
  const current = runStressTest(advanceYear(createInitialState()));
  const legacy = structuredClone(current);
  delete legacy.ledger.find((entry) => entry.action !== "checkpoint-snapshot").effects;
  delete legacy.stressTests[legacy.year].metricsSnapshot;
  const migrated = migrateSimulationState(legacy);
  assert.deepEqual(migrated.ledger.find((entry) => entry.action !== "checkpoint-snapshot").effects.spillover, current.ledger.find((entry) => entry.action !== "checkpoint-snapshot").metricDeltas);
  assert.deepEqual(migrated.stressTests[migrated.year].metricsSnapshot, current.metrics);
  assert.equal(validateSimulationExecutionState(migrated).valid, true);
});

test("schema-v3 backfill cannot launder forged annual metric deltas", () => {
  const legacy = advanceYear(createInitialState());
  delete legacy.ledger[0].effects;
  legacy.ledger[0].metricDeltas.verification = 99;
  const migrated = migrateSimulationState(legacy);
  assert.equal(validateSimulationExecutionState(migrated).valid, false);
  assert.ok(validateSimulationExecutionState(migrated).errors.some((error) => error.includes("spillover effects")));
});

test("execution state permits exactly one annual action per year", () => {
  let state = advanceYear(createInitialState());
  state = advanceYear(state);
  state.ledger[1].year = state.ledger[0].year;
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.ok(validateSimulationExecutionState(state).errors.some((error) => error.includes("one action per year")));
});

test("annual replay uses each relationship definition calibration version", () => {
  let state = selectRelationship(createInitialState(), "J1-B1");
  state = selectAction(state, "verification");
  state = advanceYear(state);
  assert.equal(state.ledger[0].ruleVersion, "relationship-v1.1.0");
  assert.equal(validateSimulationExecutionState(state).valid, true);
});

test("annual replay rejects a self-consistent forged action projection", () => {
  const state = advanceYear(createInitialState());
  const entry = state.ledger[0];
  entry.after.trust = 90;
  entry.deltas.trust = 90 - entry.before.trust;
  state.relationships[entry.relationshipId].state.trust = 90;
  entry.metricDeltas.verification = 50;
  entry.effects.spillover.verification = 50;
  state.metrics.verification = 88;
  const report = validateSimulationExecutionState(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("canonical action replay")));
  assert.strictEqual(runStressTest(state), state);
});

test("annual replay requires complete elapsed-year and history coverage", () => {
  const missingYears = createInitialState();
  missingYears.year = 2030;
  assert.equal(validateSimulationExecutionState(missingYears).valid, false);
  assert.strictEqual(runStressTest(missingYears), missingYears);

  const missingHistory = advanceYear(createInitialState());
  missingHistory.history = [];
  assert.equal(validateSimulationExecutionState(missingHistory).valid, false);
  assert.ok(validateSimulationExecutionState(missingHistory).errors.some((error) => error.includes("history")));
});

test("annual replay rejects invalid years and definition containers before allocation", () => {
  const hugeYear = createInitialState();
  hugeYear.year = 1_000_000_000;
  assert.doesNotThrow(() => validateSimulationExecutionState(hugeYear));
  assert.equal(validateSimulationExecutionState(hugeYear).valid, false);
  assert.strictEqual(advanceYear(hugeYear), hugeYear);
  assert.strictEqual(runStressTest(hugeYear), hugeYear);

  const state = createInitialState();
  assert.doesNotThrow(() => validateSimulationExecutionState(state, null));
  assert.equal(validateSimulationExecutionState(state, null).valid, false);
  assert.strictEqual(advanceYear(state, null), state);
  assert.strictEqual(runStressTest(state, null), state);

  const malformedDefinitions = [null];
  assert.doesNotThrow(() => validateSimulationExecutionState(state, malformedDefinitions));
  assert.equal(validateSimulationExecutionState(state, malformedDefinitions).valid, false);
  assert.strictEqual(advanceYear(state, malformedDefinitions), state);
  assert.strictEqual(runStressTest(state, malformedDefinitions), state);
});

test("checkpoint ledger is the complete canonical stress projection", () => {
  const canonical = createDemoState(2030);
  const checkpoint = canonical.ledger.find((entry) => entry.action === "checkpoint-snapshot");
  for (const [field, forged] of [
    ["actionLabel", "forged label"],
    ["project", "forged project"],
    ["reason", "forged reason"],
    ["ruleVersion", "forged-rule"],
    ["cost", 1],
    ["metricDeltas", { verification: 1 }],
    ["tradeoffs", ["forged tradeoff"]],
  ]) {
    const state = structuredClone(canonical);
    const entry = state.ledger.find((item) => item.id === checkpoint.id);
    entry[field] = forged;
    const report = validateSimulationExecutionState(state);
    assert.equal(report.valid, false, `${field} must fail closed`);
    assert.ok(report.errors.some((error) => error.includes("canonical checkpoint projection")));
  }
});

test("causal ledger preserves annual action and checkpoint event order", () => {
  const startCheckpoint = runStressTest(createInitialState());
  assert.equal(validateSimulationExecutionState(startCheckpoint).valid, true);
  assert.equal(advanceYear(startCheckpoint).year, 2027);

  const definitions = RELATIONSHIPS;
  const multiRelationshipCheckpoint = runStressTest(createInitialState(definitions), definitions);
  assert.equal(multiRelationshipCheckpoint.stressTests[START_YEAR].relationshipContributions.length, 20);
  assert.equal(validateSimulationExecutionState(multiRelationshipCheckpoint, definitions).valid, true);

  const state = createDemoState(2031);
  const checkpointIndex = state.ledger.findIndex((entry) => entry.year === 2030 && entry.action === "checkpoint-snapshot");
  const [checkpoint] = state.ledger.splice(checkpointIndex, 1);
  const annual2031Index = state.ledger.findIndex((entry) => entry.year === 2031 && entry.action !== "checkpoint-snapshot");
  state.ledger.splice(annual2031Index + 1, 0, checkpoint);
  const annual2031 = state.ledger.find((entry) => entry.year === 2031 && entry.action !== "checkpoint-snapshot");
  annual2031.id = annual2031.id.replace(/:\d+$/, `:${state.ledger.indexOf(annual2031) + 1}`);
  state.history.find((entry) => entry.year === 2031).ledgerId = annual2031.id;

  const report = validateSimulationExecutionState(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("canonical event order")));
  assert.strictEqual(advanceYear(state), state);
});

test("annual replay preserves append order and canonical identity fields", () => {
  let state = advanceYear(createInitialState());
  state = advanceYear(state);
  state.ledger.reverse();
  assert.equal(validateSimulationExecutionState(state).valid, false);

  state = advanceYear(createInitialState());
  state.ledger[0].id = "forged-ledger-id";
  state.ledger[0].reason = "forged but nonempty";
  state.history[0].ledgerId = "forged-ledger-id";
  const report = validateSimulationExecutionState(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("canonical action replay")));
});

test("historical checkpoints are bound to their replayed year snapshots", () => {
  const state = createDemoState(2031);
  const result = state.stressTests[2030];
  const contribution = result.relationshipContributions[0];
  const entry = state.ledger.find((item) => item.id === contribution.ledgerEntryId);
  entry.after.trust = 99;
  entry.deltas.trust = 99 - entry.before.trust;
  contribution.attributionSafety += 1;
  result.metricsSnapshot.verification += 1;
  const report = validateSimulationExecutionState(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("replayed relationship state") || error.includes("replayed simulation year")));
});

test("every crossed checkpoint retains its crisis evidence", () => {
  const state = createDemoState(2031);
  const checkpointLedgerId = state.stressTests[2030].relationshipContributions[0].ledgerEntryId;
  delete state.stressTests[2030];
  state.ledger = state.ledger.filter((entry) => entry.id !== checkpointLedgerId);
  const report = validateSimulationExecutionState(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("crossed checkpoint")));
  assert.strictEqual(advanceYear(state), state);
});

test("checkpoint ledger is an exact projection of stored stress contributions", () => {
  const state = runStressTest(createInitialState());
  const orphan = structuredClone(state.ledger[0]);
  orphan.id = "orphan-checkpoint";
  state.ledger.push(orphan);
  const report = validateSimulationExecutionState(state);
  assert.equal(report.valid, false);
  assert.ok(report.errors.some((error) => error.includes("exactly match")));
});

test("execution validation fails closed for malformed relationship references", () => {
  const malformedRelationship = createInitialState();
  malformedRelationship.relationships["B1-C6"] = null;
  assert.doesNotThrow(() => validateSimulationExecutionState(malformedRelationship));
  assert.equal(validateSimulationExecutionState(malformedRelationship).valid, false);

  const unknownContribution = runStressTest(createInitialState());
  const contribution = unknownContribution.stressTests[unknownContribution.year].relationshipContributions[0];
  const ledgerEntry = unknownContribution.ledger.find((entry) => entry.id === contribution.ledgerEntryId);
  contribution.relationshipId = "missing";
  ledgerEntry.relationshipId = "missing";
  assert.doesNotThrow(() => validateSimulationExecutionState(unknownContribution));
  assert.equal(validateSimulationExecutionState(unknownContribution).valid, false);
});

test("execution state binds annual metric deltas to recorded spillover effects", () => {
  const state = advanceYear(createInitialState());
  state.ledger[0].metricDeltas = {};
  assert.equal(validateSimulationExecutionState(state).valid, false);
  assert.strictEqual(advanceYear(state), state);
});

test("portfolio execution rejects self-referential relationship endpoints", () => {
  const state = createInitialState();
  state.relationships["B1-C6"].target = "B1";
  const definitions = RELATIONSHIPS.map((definition) => (
    definition.id === "B1-C6" ? { ...definition, target: "B1" } : definition
  ));

  assert.equal(validateRelationshipPortfolio(state, definitions).valid, false);
  assert.equal(
    previewInvestmentPortfolio(state, [{ relationshipId: "B1-C6", actionId: "verification" }], definitions).eligible,
    false,
  );
  assert.strictEqual(runStressTest(state, definitions), state);
});

test("portfolio execution rejects a non-integer or out-of-horizon year", () => {
  for (const year of ["2026", 2026.5, null, START_YEAR - 1, END_YEAR + 1]) {
    const state = createInitialState();
    state.year = year;
    const plan = previewInvestmentPortfolio(state, [{ relationshipId: "B1-C6", actionId: "verification" }]);
    assert.equal(plan.eligible, false, String(year));
    assert.strictEqual(advanceYear(state), state, String(year));
  }
});

test("stress tests refuse malformed portfolio state before recording evidence", () => {
  const outOfRange = createInitialState();
  outOfRange.relationships["B1-C6"].state.verificationAgreement = 1000;
  assert.equal(validateRelationshipPortfolio(outOfRange).valid, false);
  assert.strictEqual(runStressTest(outOfRange), outOfRange);
  assert.equal(outOfRange.stressTests[outOfRange.year], undefined);

  const uncalibratedDrift = createInitialState();
  uncalibratedDrift.relationships["J1-B1"].state.trust += 1;
  assert.equal(validateRelationshipPortfolio(uncalibratedDrift).valid, false);
  assert.strictEqual(runStressTest(uncalibratedDrift), uncalibratedDrift);
  assert.equal(uncalibratedDrift.stressTests[uncalibratedDrift.year], undefined);

  const healthy = createInitialState();
  const tested = runStressTest(healthy);
  assert.notEqual(tested, healthy);
  assert.ok(tested.stressTests[healthy.year]);
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

test("stress refuses a relationship state without a canonical annual transition", () => {
  const baseline = createInitialState();
  const changed = structuredClone(baseline);
  changed.relationships["B1-C6"].state.verificationAgreement += 20;

  assert.ok(runStressTest(baseline).stressTests[baseline.year]);
  assert.strictEqual(runStressTest(changed), changed);
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
  const contribution = state.stressTests[2035].relationshipContributions.find(({ relationshipId }) => relationshipId === "B1-C6");
  const focus = getStressContributionFocus(state, 2035, contribution.relationshipId);
  assert.equal(focus.checkpointYear, 2035);
  assert.equal(focus.relationshipId, "B1-C6");
  assert.equal(focus.ledgerEntryId, contribution.ledgerEntryId);
  assert.equal(state.ledger.find((entry) => entry.id === focus.ledgerEntryId).year <= 2035, true);
});

test("ledger drawer focus restores an earlier investment without breaking stress reverse-lookup", () => {
  const state = runStressTest(createDemoState(2035));
  const trail = listLedgerTrail(state);
  assert.ok(trail.length > 1);

  const investment = trail.find((item) => item.entry.action !== "checkpoint-snapshot");
  assert.ok(investment);
  const drawerFocus = getLedgerEntryFocus(state, investment.entry.id);
  assert.deepEqual(drawerFocus, {
    ledgerEntryId: investment.entry.id,
    relationshipId: investment.entry.relationshipId,
    year: investment.entry.year,
  });
  assert.equal(selectRelationship(state, drawerFocus.relationshipId).selectedRelationshipId, investment.entry.relationshipId);

  const contribution = state.stressTests[2035].relationshipContributions.find(({ relationshipId }) => relationshipId === "B1-C6");
  const stressFocus = getStressContributionFocus(state, 2035, contribution.relationshipId);
  assert.equal(stressFocus.ledgerEntryId, contribution.ledgerEntryId);
  assert.notEqual(drawerFocus.ledgerEntryId, stressFocus.ledgerEntryId);
  assert.equal(getLedgerEntryFocus(state, stressFocus.ledgerEntryId).relationshipId, stressFocus.relationshipId);

  const signature = getLedgerSignature(investment.entry);
  assert.ok(signature);
  assert.match(signature.text, new RegExp(`^${investment.entry.year} .+ \\d+→\\d+$`));
  assert.ok(Object.keys(investment.entry.metricDeltas).length > 0);
  assert.equal(Array.isArray(investment.entry.tradeoffs), true);
  assert.equal(getLedgerEntryFocus(state, "missing-entry"), null);
});

test("a legacy aggregate checkpoint is preserved but cannot invent missing annual evidence", () => {
  const migrated = migrateSimulationState({
    year: 2030,
    metrics: { verification: 61 },
    history: [],
    stressTests: { 2030: { verdict: "legacy result without a causal contribution" } },
  });
  const tested = runStressTest(migrated);
  assert.strictEqual(tested, migrated);
  assert.equal(migrated.year, 2030);
  assert.equal(migrated.metrics.verification, 61);
  assert.deepEqual(migrated.ledger, []);
});

test("relationship investment is traceable to a larger crisis contribution", () => {
  const initial = createInitialState();
  const invested = advanceYear(selectAction(initial, "verification"));
  const before = getRelationshipContribution(initial, "B1-C6");
  const after = getRelationshipContribution(invested, "B1-C6");
  assert.ok(after.attributionSafety > before.attributionSafety);

  const result = runStressTest(invested).stressTests[2027];
  const recorded = result.relationshipContributions.find(({ relationshipId }) => relationshipId === "B1-C6");
  assert.deepEqual(
    {
      relationshipId: recorded.relationshipId,
      relationshipLabel: recorded.relationshipLabel,
      attributionSafety: recorded.attributionSafety,
      coordinationSurvival: recorded.coordinationSurvival,
      civilianProtection: recorded.civilianProtection,
    },
    after,
  );
  assert.equal(recorded.checkpointYear, 2027);
  const tested = runStressTest(invested);
  const cumulativeEntry = tested.ledger.find((entry) => entry.id === recorded.ledgerEntryId);
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
