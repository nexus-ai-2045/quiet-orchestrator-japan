import { createHash } from "node:crypto";
import { buildAiStateSummary } from "./ai/apply-proposal.js";
import { canonicalize, observationFingerprint } from "./ai/contract.js";
import { runLocalPdcaSimulation } from "./ai/local-pdca.js";

export const META_SECURITY_RUN_BUNDLE_SCHEMA = "meta-security-run-bundle/v1";
export const PRODUCT_ID = "quiet-orchestrator-japan";
const SOURCE_REPOSITORY = "nexus-ai-2045/quiet-orchestrator-japan";
const FIXED_EPOCH_MS = Date.UTC(2026, 0, 1);

function sha256(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function timestamp(seed, offsetSeconds) {
  return new Date(FIXED_EPOCH_MS + seed * 1000 + offsetSeconds * 1000).toISOString();
}

function assertOptions(seed, maxSteps) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new TypeError("seed must be a non-negative safe integer");
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 9) {
    throw new RangeError("maxSteps must be an integer from 1 through 9");
  }
}

export function buildMetaSecurityRunBundle(initialState, { seed = 404, maxSteps = 9 } = {}) {
  assertOptions(seed, maxSteps);
  if (!initialState || typeof initialState !== "object" || Array.isArray(initialState)) {
    throw new TypeError("initialState must be an object");
  }

  const initialStateSnapshot = structuredClone(initialState);
  const parameters = {
    engine: "local-pdca-v1",
    max_steps: maxSteps,
    initial_state: initialStateSnapshot,
    initial_state_hash: observationFingerprint(initialStateSnapshot),
  };
  const requestedAt = timestamp(seed, 0);
  const runId = `qoj-${sha256({ scenario_id: "policy-orchestration", seed, requested_at: requestedAt, parameters }).slice(0, 16)}`;
  const runRequest = { run_id: runId, scenario_id: "policy-orchestration", seed, requested_at: requestedAt, parameters };
  const execution = runLocalPdcaSimulation(initialStateSnapshot, { seed: String(seed), maxSteps });
  const events = execution.steps.map((cycle, sequence) => ({
    run_id: runId,
    sequence,
    event_type: "pdca.step.completed",
    occurred_at: timestamp(seed, sequence + 1),
    payload: {
      step: cycle.step,
      actor_id: cycle.actorId,
      turn: cycle.turn,
      applied: cycle.do.applied,
      errors: [...cycle.do.errors],
      before_state_hash: cycle.check.beforeStateHash,
      after_state_hash: cycle.check.afterStateHash,
      ledger_entry_ids: [...cycle.check.appendedLedgerIds],
      receipt_hash: observationFingerprint(cycle.plan.receipt),
      ...(sequence === execution.steps.length - 1 ? { final_state_summary: buildAiStateSummary(execution.state) } : {}),
    },
  }));
  const eventStreamSha256 = sha256(events);
  return {
    schema: META_SECURITY_RUN_BUNDLE_SCHEMA,
    product_id: PRODUCT_ID,
    run_request: runRequest,
    events,
    replay: { run_id: runId, product_id: PRODUCT_ID, seed, event_count: events.length, event_stream_sha256: eventStreamSha256, deterministic: true },
    evidence: { run_id: runId, product_id: PRODUCT_ID, verification: "live-command", generated_at: timestamp(seed, events.length + 1), source_repository: SOURCE_REPOSITORY, event_stream_sha256: eventStreamSha256 },
  };
}

export function validateMetaSecurityRunBundle(bundle) {
  const errors = [];
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle)) return { valid: false, errors: ["bundle_not_object"] };
  if (bundle.schema !== META_SECURITY_RUN_BUNDLE_SCHEMA) errors.push("schema_mismatch");
  if (bundle.product_id !== PRODUCT_ID) errors.push("product_id_mismatch");
  const runId = bundle.run_request?.run_id;
  if (typeof runId !== "string" || !/^qoj-[0-9a-f]{16}$/.test(runId)) errors.push("run_id_invalid");
  for (const section of [bundle.replay, bundle.evidence]) if (section?.run_id !== runId) errors.push("run_id_mismatch");
  if (!Array.isArray(bundle.events) || bundle.events.length === 0) errors.push("events_invalid");
  if (bundle.events?.some((event, index) => event?.run_id !== runId || event?.sequence !== index)) errors.push("event_identity_or_order_mismatch");
  if (errors.length > 0) return { valid: false, errors };

  let rebuilt;
  try {
    rebuilt = buildMetaSecurityRunBundle(bundle.run_request.parameters.initial_state, { seed: bundle.run_request.seed, maxSteps: bundle.run_request.parameters.max_steps });
  } catch {
    return { valid: false, errors: ["replay_failed"] };
  }
  if (canonicalize(rebuilt) !== canonicalize(bundle)) errors.push("deterministic_replay_mismatch");
  return { valid: errors.length === 0, errors };
}
