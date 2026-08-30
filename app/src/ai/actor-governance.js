import { ACTORS } from "../simulation.js";
import { canonicalize, observationFingerprint } from "./contract.js";

export const ACTOR_CONSTRAINT_VERSION = "actor-constraints-v1";

const PORTFOLIO_TYPES = Object.freeze({
  verification: Object.freeze({
    role: "evidence-verifier",
    capabilities: Object.freeze(["observe", "propose", "verify"]),
    interests: Object.freeze(["attribution-quality", "civilian-protection"]),
    constraints: Object.freeze(["classified-evidence", "domestic-accountability", "time-pressure"]),
    evidenceAccess: "restricted",
  }),
  interop: Object.freeze({
    role: "coordination-broker",
    capabilities: Object.freeze(["observe", "propose", "translate"]),
    interests: Object.freeze(["continuity", "interoperability"]),
    constraints: Object.freeze(["alliance-consent", "budget", "translation-delay"]),
    evidenceAccess: "shared",
  }),
  ownership: Object.freeze({
    role: "sovereign-gatekeeper",
    capabilities: Object.freeze(["observe", "propose", "approve"]),
    interests: Object.freeze(["sovereignty", "narrative-control"]),
    constraints: Object.freeze(["domestic-accountability", "dissent-compression", "leak-risk"]),
    evidenceAccess: "controlled",
  }),
});

function rightsFor(actor) {
  return Object.freeze({
    propose: true,
    approve: actor.id === "B1" || actor.portfolio === "ownership",
    execute: actor.id === "B1",
  });
}

export function buildActorConstraintProfile(actor) {
  const type = PORTFOLIO_TYPES[actor?.portfolio];
  if (!type) throw new TypeError("actor portfolio is not supported");
  return Object.freeze({
    actorId: actor.id,
    constraintVersion: ACTOR_CONSTRAINT_VERSION,
    portfolio: actor.portfolio,
    role: type.role,
    capabilities: type.capabilities,
    interests: type.interests,
    constraints: type.constraints,
    evidenceAccess: type.evidenceAccess,
    decisionRights: rightsFor(actor),
  });
}

export const ACTOR_CONSTRAINTS = Object.freeze(Object.fromEntries(
  ACTORS.map((actor) => [actor.id, buildActorConstraintProfile(actor)]),
));

export function actorConstraintFingerprint(actors = ACTORS) {
  return observationFingerprint(actors.map((actor) => buildActorConstraintProfile(actor)));
}

export function recordGovernanceOutcome({ receipt, proposerId, approverId, executorId, outcome, errors }) {
  const payload = {
    governanceVersion: 1,
    constraintVersion: ACTOR_CONSTRAINT_VERSION,
    seed: receipt?.seed ?? null,
    turn: receipt?.turn ?? null,
    observationHash: receipt?.observationHash ?? null,
    proposalOutputHash: receipt?.provider?.outputHash ?? null,
    proposerId,
    approverId,
    executorId,
    outcome,
    errors: [...errors],
  };
  return { ...payload, governanceId: observationFingerprint(payload) };
}

export function authorizeAiTransaction(receipt, {
  proposerId = receipt?.actorId,
  approverId = receipt?.actorId === "B1" ? "B1" : "C6",
  executorId = "B1",
} = {}) {
  const errors = [];
  const proposer = ACTOR_CONSTRAINTS[proposerId];
  const approver = ACTOR_CONSTRAINTS[approverId];
  const executor = ACTOR_CONSTRAINTS[executorId];
  if (!proposer?.decisionRights.propose || proposerId !== receipt?.actorId) errors.push("proposal_not_authorized");
  if (!approver?.decisionRights.approve) errors.push("approval_not_authorized");
  if (!executor?.decisionRights.execute) errors.push("execution_not_authorized");
  if (receipt?.outcome !== "accepted") errors.push("proposal_not_accepted");
  const outcome = errors.length === 0 ? "approved" : "rejected";
  return {
    approved: outcome === "approved",
    errors,
    entry: recordGovernanceOutcome({ receipt, proposerId, approverId, executorId, outcome, errors }),
  };
}

export function validateGovernanceEntry(entry) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const { governanceId, ...payload } = entry;
  return typeof governanceId === "string"
    && governanceId === observationFingerprint(payload)
    && Array.isArray(entry.errors)
    && entry.errors.every((error) => typeof error === "string")
    && canonicalize(entry.errors) === canonicalize([...entry.errors]);
}
