import { createHash } from "node:crypto";
import { types as utilTypes } from "node:util";
import { buildAiStateSummary } from "./ai/apply-proposal.js";
import { canonicalize, observationFingerprint } from "./ai/contract.js";
import { runLocalPdcaSimulation } from "./ai/local-pdca.js";

export const META_SECURITY_RUN_BUNDLE_SCHEMA = "meta-security-run-bundle/v1";
export const PRODUCT_ID = "quiet-orchestrator-japan";
const SOURCE_REPOSITORY = "nexus-ai-2045/quiet-orchestrator-japan";
const FIXED_EPOCH_MS = Date.UTC(2026, 0, 1);
const MAX_JSON_DEPTH = 64;
const MAX_JSON_NODES = 100_000;

function sha256(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function timestamp(offsetSeconds) {
  return new Date(FIXED_EPOCH_MS + offsetSeconds * 1000).toISOString();
}

function assertOptions(seed, maxSteps, implementationRevision) {
  if (!Number.isSafeInteger(seed) || seed < 0) throw new TypeError("seed must be a non-negative safe integer");
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 9) {
    throw new RangeError("maxSteps must be an integer from 1 through 9");
  }
  if (typeof implementationRevision !== "string" || !/^[0-9a-f]{40}$/.test(implementationRevision)) {
    throw new TypeError("implementationRevision must be a full lowercase Git commit SHA");
  }
}

function snapshotJsonValue(root) {
  const result = { value: undefined };
  const pending = [{ source: root, depth: 0, assign: (value) => { result.value = value; }, exiting: false }];
  const ancestors = new WeakSet();
  let nodeCount = 0;
  let pendingValueCount = 1;

  try {
    while (pending.length > 0) {
      const { source, depth, assign, exiting } = pending.pop();
      if (exiting) {
        ancestors.delete(source);
        continue;
      }
      pendingValueCount -= 1;
      nodeCount += 1;
      if (depth > MAX_JSON_DEPTH || nodeCount > MAX_JSON_NODES) return { valid: false };
      if (source === null || typeof source === "string" || typeof source === "boolean") {
        assign(source);
        continue;
      }
      if (typeof source === "number") {
        if (!Number.isFinite(source)) return { valid: false };
        assign(source);
        continue;
      }
      if (typeof source !== "object" || utilTypes.isProxy(source) || ancestors.has(source)) return { valid: false };
      ancestors.add(source);
      pending.push({ source, depth, assign: undefined, exiting: true });
      if (Object.getOwnPropertySymbols(source).length > 0) return { valid: false };

      const isArray = Array.isArray(source);
      const prototype = Object.getPrototypeOf(source);
      if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) return { valid: false };

      const descriptors = Object.getOwnPropertyDescriptors(source);
      const propertyNames = Object.getOwnPropertyNames(source);
      if (propertyNames.some((name) => descriptors[name].get || descriptors[name].set)) return { valid: false };

      if (isArray) {
        const length = descriptors.length?.value;
        if (!Number.isSafeInteger(length) || length < 0 || propertyNames.length !== length + 1) return { valid: false };
        if (propertyNames.some((name) => name !== "length" && !/^(0|[1-9]\d*)$/.test(name))) return { valid: false };
        if (nodeCount + pendingValueCount + length > MAX_JSON_NODES) return { valid: false };
        pendingValueCount += length;
        const snapshot = new Array(length);
        assign(snapshot);
        for (let index = length - 1; index >= 0; index -= 1) {
          const descriptor = descriptors[String(index)];
          if (!descriptor || !descriptor.enumerable) return { valid: false };
          pending.push({
            source: descriptor.value,
            depth: depth + 1,
            assign: (value) => { snapshot[index] = value; },
            exiting: false,
          });
        }
      } else {
        if (nodeCount + pendingValueCount + propertyNames.length > MAX_JSON_NODES) return { valid: false };
        pendingValueCount += propertyNames.length;
        const snapshot = {};
        assign(snapshot);
        for (const name of propertyNames.toReversed()) {
          const descriptor = descriptors[name];
          if (!descriptor.enumerable) return { valid: false };
          pending.push({
            source: descriptor.value,
            depth: depth + 1,
            assign: (value) => Object.defineProperty(snapshot, name, {
              value,
              enumerable: true,
              writable: true,
              configurable: true,
            }),
            exiting: false,
          });
        }
      }
    }
  } catch {
    return { valid: false };
  }
  return { valid: true, value: result.value };
}

export function buildMetaSecurityRunBundle(initialState, { seed = 404, maxSteps = 9, implementationRevision } = {}) {
  assertOptions(seed, maxSteps, implementationRevision);
  if (!initialState || typeof initialState !== "object" || Array.isArray(initialState)) {
    throw new TypeError("initialState must be an object");
  }
  const initialSnapshot = snapshotJsonValue(initialState);
  if (!initialSnapshot.valid) throw new TypeError("initialState must contain only JSON values");
  const initialStateSnapshot = initialSnapshot.value;
  if (typeof initialStateSnapshot.seed !== "string" || initialStateSnapshot.seed.length === 0) {
    throw new TypeError("simulation state seed must be a non-empty string");
  }
  const parameters = {
    engine: "local-pdca-v1",
    implementation_revision: implementationRevision,
    max_steps: maxSteps,
    policy_seed: String(seed),
    simulation_state_seed: initialStateSnapshot.seed,
    initial_state: initialStateSnapshot,
    initial_state_hash: observationFingerprint(initialStateSnapshot),
  };
  const requestedAt = timestamp(0);
  const runId = `qoj-${sha256({ scenario_id: "policy-orchestration", seed, requested_at: requestedAt, parameters }).slice(0, 16)}`;
  const runRequest = { run_id: runId, scenario_id: "policy-orchestration", seed, requested_at: requestedAt, parameters };
  const execution = runLocalPdcaSimulation(initialStateSnapshot, { seed: String(seed), maxSteps });
  const events = execution.steps.map((cycle, sequence) => ({
    run_id: runId,
    sequence,
    event_type: cycle.completed ? "pdca.step.completed" : "pdca.step.rejected",
    occurred_at: timestamp(sequence + 1),
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
  const draft = {
    schema: META_SECURITY_RUN_BUNDLE_SCHEMA,
    product_id: PRODUCT_ID,
    run_request: runRequest,
    events,
    replay: { run_id: runId, product_id: PRODUCT_ID, seed, event_count: events.length, event_stream_sha256: eventStreamSha256, deterministic: true },
    evidence: { run_id: runId, product_id: PRODUCT_ID, verification: "live-command", generated_at: timestamp(events.length + 1), source_repository: SOURCE_REPOSITORY, event_stream_sha256: eventStreamSha256 },
  };
  const completedSnapshot = snapshotJsonValue(draft);
  if (!completedSnapshot.valid) throw new TypeError("generated bundle exceeds the JSON transport boundary");
  return completedSnapshot.value;
}

export function validateMetaSecurityRunBundle(bundle, { expectedImplementationRevision } = {}) {
  const errors = [];
  if (!bundle || typeof bundle !== "object") return { valid: false, errors: ["bundle_not_object"] };
  const bundleSnapshot = snapshotJsonValue(bundle);
  if (!bundleSnapshot.valid) return { valid: false, errors: ["non_json_value"] };
  const trustedBundle = bundleSnapshot.value;
  if (Array.isArray(trustedBundle)) return { valid: false, errors: ["bundle_not_object"] };
  if (typeof expectedImplementationRevision !== "string" || !/^[0-9a-f]{40}$/.test(expectedImplementationRevision)) {
    errors.push("expected_implementation_revision_invalid");
  } else if (trustedBundle.run_request?.parameters?.implementation_revision !== expectedImplementationRevision) {
    errors.push("implementation_revision_mismatch");
  }
  if (trustedBundle.schema !== META_SECURITY_RUN_BUNDLE_SCHEMA) errors.push("schema_mismatch");
  if (trustedBundle.product_id !== PRODUCT_ID) errors.push("product_id_mismatch");
  const runId = trustedBundle.run_request?.run_id;
  if (typeof runId !== "string" || !/^qoj-[0-9a-f]{16}$/.test(runId)) errors.push("run_id_invalid");
  for (const section of [trustedBundle.replay, trustedBundle.evidence]) if (section?.run_id !== runId) errors.push("run_id_mismatch");
  if (!Array.isArray(trustedBundle.events) || trustedBundle.events.length === 0) errors.push("events_invalid");
  if (Array.isArray(trustedBundle.events)
    && trustedBundle.events.some((event, index) => event?.run_id !== runId || event?.sequence !== index)) {
    errors.push("event_identity_or_order_mismatch");
  }
  if (errors.length > 0) return { valid: false, errors };

  let rebuilt;
  try {
    rebuilt = buildMetaSecurityRunBundle(trustedBundle.run_request.parameters.initial_state, {
      seed: trustedBundle.run_request.seed,
      maxSteps: trustedBundle.run_request.parameters.max_steps,
      implementationRevision: trustedBundle.run_request.parameters.implementation_revision,
    });
  } catch {
    return { valid: false, errors: ["replay_failed"] };
  }
  if (canonicalize(rebuilt) !== canonicalize(trustedBundle)) errors.push("deterministic_replay_mismatch");
  return { valid: errors.length === 0, errors };
}
