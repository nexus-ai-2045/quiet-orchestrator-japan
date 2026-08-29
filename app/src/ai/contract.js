export const AI_PROPOSAL_VERSION = 1;
export const AI_RECEIPT_VERSION = 1;
export const AI_RELATIONSHIP_ID = "B1-C6";
export const SCRIPTED_POLICY_ENGINE_VERSION = "scripted-policy-v1";

export const AI_ACTORS = Object.freeze({
  B1: Object.freeze({
    label: "検証・対話ハブ",
    allowedActionIds: Object.freeze(["verification", "reversibility", "coownership"]),
    fallbackActionId: "verification",
  }),
  J2: Object.freeze({
    label: "戦略情報分析",
    allowedActionIds: Object.freeze(["translation", "verification"]),
    fallbackActionId: "translation",
  }),
  C6: Object.freeze({
    label: "共同検証窓口",
    allowedActionIds: Object.freeze(["verification", "coownership"]),
    fallbackActionId: "verification",
  }),
});

const PROPOSAL_KEYS = Object.freeze([
  "actionId",
  "actorId",
  "confidence",
  "observationHash",
  "proposalVersion",
  "rationale",
  "relationshipId",
  "turn",
]);

export function canonicalize(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
}

// Browser/Node共通の同期hash。暗号用途ではなく、提案と観測の取り違え検知に限定する。
export function observationFingerprint(value) {
  const input = canonicalize(value);
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function buildObservation({ actorId, turn, seed, stateSummary = {} }) {
  const actor = AI_ACTORS[actorId];
  if (!actor) throw new TypeError(`unknown actorId: ${actorId}`);
  if (!Number.isInteger(turn) || turn < 1 || turn > 3) throw new TypeError("turn must be an integer from 1 to 3");
  if (typeof seed !== "string" || seed.length === 0) throw new TypeError("seed must be a non-empty string");
  if (!stateSummary || typeof stateSummary !== "object" || Array.isArray(stateSummary)) {
    throw new TypeError("stateSummary must be an object");
  }
  const payload = {
    observationVersion: 1,
    seed,
    turn,
    actorId,
    actorLabel: actor.label,
    allowedActionIds: [...actor.allowedActionIds],
    allowedRelationshipIds: [AI_RELATIONSHIP_ID],
    stateSummary: { ...stateSummary },
  };
  return { ...payload, observationHash: observationFingerprint(payload) };
}

function parseProposal(proposal) {
  if (typeof proposal !== "string") return proposal;
  try {
    return JSON.parse(proposal);
  } catch {
    return null;
  }
}

export function validateAiProposal(proposalInput, observation) {
  const proposal = parseProposal(proposalInput);
  const errors = [];
  const { observationHash, ...observationPayload } = observation;
  if (observationFingerprint(observationPayload) !== observationHash) errors.push("observation_integrity_mismatch");
  const canonicalActor = AI_ACTORS[observation.actorId];
  if (!canonicalActor) errors.push("observation_actor_unknown");
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return { valid: false, errors: [...errors, "proposal_not_object"], proposal: null };
  }
  const keys = Object.keys(proposal).sort();
  if (canonicalize(keys) !== canonicalize(PROPOSAL_KEYS)) errors.push("proposal_schema_mismatch");
  if (proposal.proposalVersion !== AI_PROPOSAL_VERSION) errors.push("proposal_version_mismatch");
  if (proposal.actorId !== observation.actorId) errors.push("actor_mismatch");
  if (proposal.turn !== observation.turn) errors.push("turn_mismatch");
  if (proposal.observationHash !== observation.observationHash) errors.push("observation_hash_mismatch");
  if (!canonicalActor?.allowedActionIds.includes(proposal.actionId)) errors.push("action_not_allowed_for_actor");
  if (proposal.relationshipId !== AI_RELATIONSHIP_ID) errors.push("relationship_not_allowed");
  if (typeof proposal.rationale !== "string" || proposal.rationale.trim().length < 4 || proposal.rationale.length > 240) {
    errors.push("rationale_invalid");
  }
  if (typeof proposal.confidence !== "number" || !Number.isFinite(proposal.confidence)
    || proposal.confidence < 0 || proposal.confidence > 1) errors.push("confidence_invalid");
  return { valid: errors.length === 0, errors, proposal };
}

function fallbackProposal(observation) {
  return {
    actionId: AI_ACTORS[observation.actorId]?.fallbackActionId ?? "verification",
    relationshipId: AI_RELATIONSHIP_ID,
    rationale: "不正な提案を採用せず、version固定のscripted policyへフォールバック",
    confidence: 0,
  };
}

export function createAiReceipt({ observation, proposal, providerStatus = "ok", providerMeta = {}, providerOutputHash = null }) {
  const validation = validateAiProposal(proposal, observation);
  const providerFailed = providerStatus !== "ok";
  const accepted = validation.valid && !providerFailed;
  const validationErrors = [...validation.errors];
  if (providerFailed) validationErrors.push(`provider_${providerStatus}`);
  const acceptedProposal = validation.proposal;
  const appliedProposal = accepted ? {
    actionId: acceptedProposal.actionId,
    relationshipId: acceptedProposal.relationshipId,
    rationale: acceptedProposal.rationale,
    confidence: acceptedProposal.confidence,
  } : fallbackProposal(observation);
  return {
    receiptVersion: AI_RECEIPT_VERSION,
    seed: observation.seed,
    turn: observation.turn,
    actorId: observation.actorId,
    observation,
    observationHash: observation.observationHash,
    providerStatus,
    provider: {
      mode: providerMeta.mode === "live" ? "live" : "fixture",
      model: typeof providerMeta.model === "string" ? providerMeta.model : "recorded-fixture",
      promptVersion: typeof providerMeta.promptVersion === "string" ? providerMeta.promptVersion : "ai-proposal-v1",
      engineVersion: SCRIPTED_POLICY_ENGINE_VERSION,
      outputHash: providerOutputHash ?? observationFingerprint(proposal),
    },
    outcome: accepted ? "accepted" : "fallback",
    fallbackUsed: !accepted,
    validationErrors,
    rawProposal: validation.proposal,
    appliedProposal,
  };
}

export function validateAiReceipt(receipt) {
  const errors = [];
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) return { valid: false, errors: ["receipt_not_object"] };
  if (receipt.receiptVersion !== AI_RECEIPT_VERSION) errors.push("receipt_version_mismatch");
  let expectedObservation;
  try {
    expectedObservation = buildObservation({
      actorId: receipt.observation?.actorId,
      turn: receipt.observation?.turn,
      seed: receipt.observation?.seed,
      stateSummary: receipt.observation?.stateSummary,
    });
  } catch {
    errors.push("observation_invalid");
  }
  if (expectedObservation && canonicalize(expectedObservation) !== canonicalize(receipt.observation)) errors.push("observation_tampered");
  if (receipt.actorId !== receipt.observation?.actorId || !AI_ACTORS[receipt.actorId]) errors.push("receipt_actor_mismatch");
  if (receipt.turn !== receipt.observation?.turn) errors.push("receipt_turn_mismatch");
  if (receipt.seed !== receipt.observation?.seed) errors.push("receipt_seed_mismatch");
  if (receipt.observationHash !== receipt.observation?.observationHash) errors.push("receipt_observation_hash_mismatch");
  const proposalValidation = expectedObservation ? validateAiProposal(receipt.rawProposal, expectedObservation) : { valid: false, errors: [] };
  if (!proposalValidation.valid && receipt.outcome === "accepted") errors.push("accepted_proposal_invalid");
  if (!receipt.provider || !["live", "fixture"].includes(receipt.provider.mode)
    || typeof receipt.provider.model !== "string" || receipt.provider.model.length === 0
    || typeof receipt.provider.promptVersion !== "string" || receipt.provider.promptVersion.length === 0
    || receipt.provider.engineVersion !== SCRIPTED_POLICY_ENGINE_VERSION) errors.push("provider_meta_invalid");
  if (proposalValidation.valid && receipt.provider?.outputHash !== observationFingerprint(receipt.rawProposal)) errors.push("output_hash_mismatch");
  if (typeof receipt.provider?.outputHash !== "string" || !/^fnv1a32:[0-9a-f]{8}$/.test(receipt.provider.outputHash)) errors.push("output_hash_invalid");
  if (!receipt.appliedProposal || typeof receipt.appliedProposal.rationale !== "string"
    || typeof receipt.appliedProposal.confidence !== "number" || !Number.isFinite(receipt.appliedProposal.confidence)) errors.push("applied_proposal_invalid");
  if (expectedObservation) {
    const rebuilt = createAiReceipt({
      observation: expectedObservation,
      proposal: receipt.rawProposal,
      providerStatus: receipt.providerStatus,
      providerMeta: receipt.provider,
      providerOutputHash: receipt.provider?.outputHash,
    });
    if (rebuilt.outcome !== receipt.outcome
      || rebuilt.fallbackUsed !== receipt.fallbackUsed
      || canonicalize(rebuilt.validationErrors) !== canonicalize(receipt.validationErrors)
      || canonicalize(rebuilt.appliedProposal) !== canonicalize(receipt.appliedProposal)) errors.push("receipt_outcome_mismatch");
  }
  return { valid: errors.length === 0, errors };
}

const FIXTURE_ACTIONS = Object.freeze({
  B1: ["verification", "reversibility", "coownership"],
  J2: ["translation", "verification", "translation"],
  C6: ["verification", "coownership", "verification"],
});

export function runFixtureSimulation(seed = "hackathon-mvp-0", stateSummary = { year: 2035 }) {
  const receipts = [];
  for (let turn = 1; turn <= 3; turn += 1) {
    for (const actorId of Object.keys(AI_ACTORS)) {
      const observation = buildObservation({
        actorId,
        turn,
        seed,
        stateSummary,
      });
      const proposal = {
        proposalVersion: AI_PROPOSAL_VERSION,
        actorId,
        turn,
        observationHash: observation.observationHash,
        actionId: FIXTURE_ACTIONS[actorId][turn - 1],
        relationshipId: AI_RELATIONSHIP_ID,
        rationale: `${AI_ACTORS[actorId].label}の許可範囲から第${turn}ターンの提案を選択`,
        confidence: 0.7 + turn * 0.05,
      };
      receipts.push(createAiReceipt({ observation, proposal, providerMeta: { mode: "fixture" } }));
    }
  }
  return receipts;
}

export function receiptsToJsonl(receipts) {
  return receipts.map((receipt) => JSON.stringify(receipt)).join("\n");
}
