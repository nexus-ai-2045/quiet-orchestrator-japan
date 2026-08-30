import { advanceYear, selectAction, selectRelationship } from "../simulation.js";
import { AI_RELATIONSHIP_ID, canonicalize, observationFingerprint, validateAiReceipt } from "./contract.js";
import { authorizeAiTransaction, recordGovernanceOutcome } from "./actor-governance.js";

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

export function applyValidatedAiProposal(state, receipt, authority = undefined) {
  const receiptValidation = validateAiReceipt(receipt);
  const authorization = authorizeAiTransaction(receipt, authority);
  if (!receiptValidation.valid) {
    const errors = [...receiptValidation.errors, ...authorization.errors];
    return {
      applied: false,
      errors,
      state,
      governanceLedger: [recordGovernanceOutcome({
        receipt,
        proposerId: authorization.entry.proposerId,
        approverId: authorization.entry.approverId,
        executorId: authorization.entry.executorId,
        outcome: "rejected",
        errors,
      })],
    };
  }
  if (!authorization.approved) {
    return { applied: false, errors: authorization.errors, state, governanceLedger: [authorization.entry] };
  }
  const expectedSummary = buildAiStateSummary(state);
  if (canonicalize(receipt.observation.stateSummary) !== canonicalize(expectedSummary)) {
    const errors = ["stale_state_snapshot"];
    return { applied: false, errors, state, governanceLedger: [recordGovernanceOutcome({ ...authorization.entry, receipt, outcome: "rejected", errors })] };
  }
  const selected = selectAction(selectRelationship(state, receipt.appliedProposal.relationshipId), receipt.appliedProposal.actionId);
  const next = advanceYear(selected);
  if (next.year === state.year) {
    const errors = ["deterministic_core_rejected"];
    return { applied: false, errors, state, governanceLedger: [recordGovernanceOutcome({ ...authorization.entry, receipt, outcome: "rejected", errors })] };
  }
  return {
    applied: true,
    errors: [],
    state: next,
    governanceLedger: [authorization.entry],
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
