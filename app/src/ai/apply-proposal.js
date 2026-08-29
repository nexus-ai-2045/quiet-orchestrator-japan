import { advanceYear, selectAction, selectRelationship } from "../simulation.js";
import { AI_RELATIONSHIP_ID, canonicalize, observationFingerprint, validateAiReceipt } from "./contract.js";

export function buildAiStateSummary(state) {
  const stateProjection = {
    year: state.year,
    seed: state.seed,
    budget: state.budget,
    selectedAction: state.selectedAction,
    selectedRelationshipId: state.selectedRelationshipId,
    metrics: state.metrics,
    stressTests: state.stressTests,
    investableRelationships: Object.entries(state.relationships)
      .filter(([, relationship]) => relationship.investable)
      .map(([mapKey, relationship]) => ({
        mapKey,
        id: relationship.id,
        source: relationship.source,
        target: relationship.target,
        investable: relationship.investable,
        calibrationFingerprint: relationship.calibrationFingerprint,
      })),
    relationshipId: AI_RELATIONSHIP_ID,
    relationshipState: state.relationships[AI_RELATIONSHIP_ID]?.state ?? null,
    latestLedgerId: state.ledger.at(-1)?.id ?? null,
    ledgerLength: state.ledger.length,
  };
  return { ...stateProjection, stateHash: observationFingerprint(stateProjection) };
}

export function applyValidatedAiProposal(state, receipt) {
  const receiptValidation = validateAiReceipt(receipt);
  if (!receiptValidation.valid) return { applied: false, errors: receiptValidation.errors, state };
  const expectedSummary = buildAiStateSummary(state);
  if (canonicalize(receipt.observation.stateSummary) !== canonicalize(expectedSummary)) {
    return { applied: false, errors: ["stale_state_snapshot"], state };
  }
  const selected = selectAction(selectRelationship(state, receipt.appliedProposal.relationshipId), receipt.appliedProposal.actionId);
  const next = advanceYear(selected);
  if (next.year === state.year) return { applied: false, errors: ["deterministic_core_rejected"], state };
  return {
    applied: true,
    errors: [],
    state: next,
    execution: {
      receiptVersion: 1,
      proposalOutputHash: receipt.provider.outputHash,
      beforeStateHash: observationFingerprint(state),
      afterStateHash: observationFingerprint(next),
      ledgerEntryId: next.ledger.at(-1)?.id ?? null,
    },
  };
}

export function nextFixtureStep(currentStep, totalSteps, applied) {
  if (!applied) return currentStep;
  return Math.min(currentStep + 1, totalSteps);
}

export function fixtureReceiptIndex(step, totalSteps) {
  if (!Number.isInteger(step) || !Number.isInteger(totalSteps) || totalSteps < 1) throw new TypeError("invalid fixture sequence");
  return Math.min(Math.max(step, 0), totalSteps - 1);
}
