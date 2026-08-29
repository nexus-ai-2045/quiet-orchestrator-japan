import { advanceYear, selectAction, selectRelationship } from "../simulation.js";
import { observationFingerprint, validateAiReceipt } from "./contract.js";

export function buildAiStateSummary(state) {
  const stateProjection = {
    year: state.year,
    selectedAction: state.selectedAction,
    selectedRelationshipId: state.selectedRelationshipId,
    metrics: state.metrics,
    relationshipState: state.relationships[state.selectedRelationshipId]?.state ?? null,
    latestLedgerId: state.ledger.at(-1)?.id ?? null,
  };
  return { ...stateProjection, stateHash: observationFingerprint(stateProjection) };
}

export function applyValidatedAiProposal(state, receipt) {
  const receiptValidation = validateAiReceipt(receipt);
  if (!receiptValidation.valid) return { applied: false, errors: receiptValidation.errors, state };
  const expectedSummary = buildAiStateSummary(state);
  if (receipt.observation.stateSummary?.stateHash !== expectedSummary.stateHash) {
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
