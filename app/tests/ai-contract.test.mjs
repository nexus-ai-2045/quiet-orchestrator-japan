import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  AI_ACTORS,
  buildObservation,
  createAiReceipt,
  runFixtureSimulation,
  validateAiReceipt,
} from "../src/ai/contract.js";
import { applyValidatedAiProposal, buildAiStateSummary, fixtureReceiptIndex, nextFixtureStep } from "../src/ai/apply-proposal.js";
import { createDemoState } from "../src/simulation.js";

test("valid proposal is accepted only for the exact observation hash", () => {
  const observation = buildObservation({ actorId: "B1", turn: 1, seed: "hackathon-mvp-0" });
  const proposal = {
    proposalVersion: 1,
    actorId: "B1",
    turn: 1,
    observationHash: observation.observationHash,
    actionId: "verification",
    relationshipId: "B1-C6",
    rationale: "共同検証の入口を先に固定する",
    confidence: 0.82,
  };
  const receipt = createAiReceipt({ observation, proposal });
  assert.equal(receipt.outcome, "accepted");
  assert.equal(receipt.appliedProposal.actionId, "verification");
  assert.equal(receipt.fallbackUsed, false);
  assert.equal(receipt.provider.promptVersion, "ai-proposal-v1");
  assert.match(receipt.provider.outputHash, /^fnv1a32:/);
});

test("forged hash and unauthorized action fail closed to a fixed fallback", () => {
  const observation = buildObservation({ actorId: "C6", turn: 2, seed: "hackathon-mvp-0" });
  const proposal = {
    proposalVersion: 1,
    actorId: "C6",
    turn: 2,
    observationHash: "fnv1a32:00000000",
    actionId: "redundancy",
    relationshipId: "B1-C6",
    rationale: "権限外の提案",
    confidence: 0.9,
  };
  const receipt = createAiReceipt({ observation, proposal });
  assert.equal(receipt.outcome, "fallback");
  assert.equal(receipt.fallbackUsed, true);
  assert.equal(receipt.appliedProposal.actionId, AI_ACTORS.C6.fallbackActionId);
  assert.ok(receipt.validationErrors.includes("observation_hash_mismatch"));
  assert.ok(receipt.validationErrors.includes("action_not_allowed_for_actor"));
});

test("tampered observation permissions are rejected even when proposal copies its stale hash", () => {
  const original = buildObservation({ actorId: "J2", turn: 1, seed: "hackathon-mvp-0" });
  const observation = { ...original, allowedActionIds: [...original.allowedActionIds, "redundancy"] };
  const proposal = {
    proposalVersion: 1,
    actorId: "J2",
    turn: 1,
    observationHash: original.observationHash,
    actionId: "redundancy",
    relationshipId: "B1-C6",
    rationale: "改ざんされた許可表を利用する",
    confidence: 0.9,
  };
  const receipt = createAiReceipt({ observation, proposal });
  assert.equal(receipt.outcome, "fallback");
  assert.ok(receipt.validationErrors.includes("observation_integrity_mismatch"));
  assert.ok(receipt.validationErrors.includes("action_not_allowed_for_actor"));
});

test("invalid JSON and timeout produce the same deterministic fallback", () => {
  const observation = buildObservation({ actorId: "J2", turn: 3, seed: "hackathon-mvp-0" });
  const invalid = createAiReceipt({ observation, proposal: "not-json", providerStatus: "invalid_json" });
  const timeout = createAiReceipt({ observation, proposal: null, providerStatus: "timeout" });
  assert.deepEqual(invalid.appliedProposal, timeout.appliedProposal);
  assert.equal(timeout.outcome, "fallback");
});

test("fixture simulation is reproducible and covers three actors for three turns", () => {
  const first = runFixtureSimulation("hackathon-mvp-0");
  const second = runFixtureSimulation("hackathon-mvp-0");
  assert.deepEqual(first, second);
  assert.equal(first.length, 9);
  assert.deepEqual(new Set(first.map((item) => item.actorId)), new Set(["B1", "J2", "C6"]));
  assert.deepEqual(new Set(first.map((item) => item.turn)), new Set([1, 2, 3]));
});

test("the recorded Codex smoke receipt still validates against its observation", async () => {
  const artifact = JSON.parse(await readFile(new URL("../evidence/ai-codex-smoke.json", import.meta.url), "utf8"));
  const receipt = createAiReceipt({
    observation: artifact.observation,
    proposal: {
      proposalVersion: 1,
      actorId: artifact.receipt.actorId,
      turn: artifact.receipt.turn,
      observationHash: artifact.receipt.observationHash,
      ...artifact.receipt.appliedProposal,
    },
  });
  assert.equal(receipt.outcome, "accepted");
  assert.deepEqual(receipt.appliedProposal, artifact.receipt.appliedProposal);
  assert.equal(validateAiReceipt(artifact.receipt).valid, true);
});

test("import validation rejects a forged provider hash and invalid confidence", () => {
  const receipt = runFixtureSimulation()[0];
  const forged = { ...receipt, provider: { ...receipt.provider, outputHash: "fnv1a32:00000000" }, appliedProposal: { ...receipt.appliedProposal, confidence: "high" } };
  const validation = validateAiReceipt(forged);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.includes("output_hash_mismatch"));
  assert.ok(validation.errors.includes("applied_proposal_invalid"));
});

test("a proposal applies only to its exact state snapshot and replays deterministically", () => {
  const state = createDemoState(2035);
  const observation = buildObservation({ actorId: "B1", turn: 1, seed: "apply-0", stateSummary: buildAiStateSummary(state) });
  const proposal = { proposalVersion: 1, actorId: "B1", turn: 1, observationHash: observation.observationHash, actionId: "verification", relationshipId: "B1-C6", rationale: "共同検証手順を先に固定する", confidence: 0.8 };
  const receipt = createAiReceipt({ observation, proposal, providerMeta: { mode: "fixture" } });
  const first = applyValidatedAiProposal(state, receipt);
  const second = applyValidatedAiProposal(state, receipt);
  assert.equal(first.applied, true);
  assert.deepEqual(first.execution, second.execution);
  assert.deepEqual(first.state, second.state);
  assert.deepEqual(applyValidatedAiProposal(first.state, receipt).errors, ["stale_state_snapshot"]);
});

test("proposal freshness binds the complete canonical state summary", () => {
  const state = createDemoState(2035);
  const observation = buildObservation({ actorId: "B1", turn: 1, seed: "summary-0", stateSummary: buildAiStateSummary(state) });
  const alteredSummary = { ...observation.stateSummary, unboundField: "forged" };
  const alteredObservation = buildObservation({ actorId: "B1", turn: 1, seed: "summary-0", stateSummary: alteredSummary });
  const proposal = { proposalVersion: 1, actorId: "B1", turn: 1, observationHash: alteredObservation.observationHash, actionId: "verification", relationshipId: "B1-C6", rationale: "完全な状態要約との一致を要求する", confidence: 0.8 };
  const receipt = createAiReceipt({ observation: alteredObservation, proposal });
  assert.deepEqual(applyValidatedAiProposal(state, receipt).errors, ["stale_state_snapshot"]);
});

test("receipt envelope is bound to its observation identity", () => {
  const receipt = runFixtureSimulation()[0];
  for (const forged of [
    { ...receipt, receiptVersion: 2 },
    { ...receipt, actorId: "UNKNOWN" },
    { ...receipt, turn: 2 },
    { ...receipt, seed: "other-seed" },
  ]) {
    assert.equal(validateAiReceipt(forged).valid, false);
  }
});

test("receipt binds the scripted policy engine version", () => {
  const receipt = runFixtureSimulation()[0];
  assert.equal(typeof receipt.provider.engineVersion, "string");
  assert.equal(validateAiReceipt({ ...receipt, provider: { ...receipt.provider, engineVersion: "forged" } }).valid, false);
});

test("fallback audit fields are bound to rebuilt receipt semantics", () => {
  const observation = buildObservation({ actorId: "B1", turn: 1, seed: "fallback-audit" });
  const receipt = createAiReceipt({ observation, proposal: "invalid-json", providerStatus: "invalid_json" });
  assert.equal(validateAiReceipt({ ...receipt, fallbackUsed: false, validationErrors: [] }).valid, false);
});

test("raw output attestation distinguishes different invalid provider responses", () => {
  const observation = buildObservation({ actorId: "B1", turn: 1, seed: "raw-output" });
  const first = createAiReceipt({ observation, proposal: "invalid-one", providerStatus: "invalid_json" });
  const second = createAiReceipt({ observation, proposal: "invalid-two", providerStatus: "invalid_json" });
  assert.notEqual(first.provider.rawOutput.hash, second.provider.rawOutput.hash);
});

test("raw provider boundary attests valid JSON strings without storing the raw text", () => {
  const observation = buildObservation({ actorId: "B1", turn: 1, seed: "raw-valid" });
  const proposalObject = { proposalVersion: 1, actorId: "B1", turn: 1, observationHash: observation.observationHash, actionId: "verification", relationshipId: "B1-C6", rationale: "raw JSON境界を検証する", confidence: 0.8 };
  const raw = JSON.stringify(proposalObject, null, 2);
  const receipt = createAiReceipt({ observation, proposal: raw });
  assert.equal(validateAiReceipt(receipt).valid, true);
  assert.equal(receipt.provider.rawOutput.kind, "string");
  assert.equal(receipt.provider.rawOutput.bytes, new TextEncoder().encode(raw).length);
  assert.equal(JSON.stringify(receipt).includes(raw), false);
});

test("AI summary always binds the fixed execution relationship", () => {
  const state = createDemoState(2035);
  const otherRelationshipId = Object.keys(state.relationships).find((id) => id !== "B1-C6");
  const changedSelection = { ...state, selectedRelationshipId: otherRelationshipId };
  const summary = buildAiStateSummary(changedSelection);
  assert.equal(summary.relationshipId, "B1-C6");
  assert.deepEqual(summary.relationshipState, state.relationships["B1-C6"].state);
});

test("AI summary freshness includes budget and checkpoint results", () => {
  const state = createDemoState(2035);
  const summary = buildAiStateSummary(state);
  assert.equal(summary.budget, state.budget);
  assert.deepEqual(summary.stressTests, state.stressTests);
});

test("AI summary binds execution metadata for every investable relationship", () => {
  const state = createDemoState(2035);
  const summary = buildAiStateSummary(state);
  const expected = Object.entries(state.relationships).filter(([, item]) => item.investable).map(([mapKey, item]) => ({
    mapKey, id: item.id, source: item.source, target: item.target, investable: item.investable, calibrationFingerprint: item.calibrationFingerprint,
  }));
  assert.deepEqual(summary.investableRelationships, expected);
});

test("fixture sequencing advances only after a successful AI adoption", () => {
  assert.equal(nextFixtureStep(2, 9, false), 2);
  assert.equal(nextFixtureStep(2, 9, true), 3);
  assert.equal(nextFixtureStep(9, 9, true), 9);
});

test("fixture mode binds nine successful steps to receipt indices zero through eight", () => {
  let step = 0;
  const indices = [];
  while (step < 9) {
    indices.push(fixtureReceiptIndex(step, 9));
    step = nextFixtureStep(step, 9, true);
  }
  assert.deepEqual(indices, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
});
