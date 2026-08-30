import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { buildMetaSecurityRunBundle, validateMetaSecurityRunBundle } from "../src/run-bundle.js";

const IMPLEMENTATION_REVISION = "1".repeat(40);
const buildBundle = (state = createDemoState(2035), options = {}) => buildMetaSecurityRunBundle(state, {
  seed: 404,
  implementationRevision: IMPLEMENTATION_REVISION,
  ...options,
});

test("meta-security-run-bundle/v1 binds request, events, replay, and evidence to one deterministic run", () => {
  const initial = createDemoState(2035);
  const first = buildBundle(initial);
  const second = buildBundle(initial);

  assert.deepEqual(first, second);
  assert.equal(first.schema, "meta-security-run-bundle/v1");
  assert.equal(first.product_id, "quiet-orchestrator-japan");
  assert.match(first.run_request.run_id, /^qoj-[0-9a-f]{16}$/);
  assert.equal(first.replay.run_id, first.run_request.run_id);
  assert.equal(first.evidence.run_id, first.run_request.run_id);
  assert.deepEqual(first.events.map((event) => event.sequence), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(first.events.every((event) => event.run_id === first.run_request.run_id), true);
  assert.equal(first.replay.event_stream_sha256, first.evidence.event_stream_sha256);
  assert.equal(validateMetaSecurityRunBundle(first).valid, true);
});

test("run bundle validation fails closed on run identity and event-order drift", () => {
  const bundle = buildBundle(createDemoState(2035), { seed: 405 });

  const wrongRun = structuredClone(bundle);
  wrongRun.events[0].run_id = "qoj-0000000000000000";
  assert.equal(validateMetaSecurityRunBundle(wrongRun).valid, false);

  const reordered = structuredClone(bundle);
  [reordered.events[0], reordered.events[1]] = [
    reordered.events[1],
    reordered.events[0],
  ];
  assert.equal(validateMetaSecurityRunBundle(reordered).valid, false);
});

test("run bundle rejects non-JSON values before deterministic comparison", () => {
  const bundle = buildBundle();
  bundle.events[0].payload.errors = [undefined];
  assert.deepEqual(validateMetaSecurityRunBundle(bundle), { valid: false, errors: ["non_json_value"] });

  const hidden = buildBundle();
  Object.defineProperty(hidden.events[0].payload, "hidden", { value: "tamper", enumerable: false });
  assert.deepEqual(validateMetaSecurityRunBundle(hidden), { valid: false, errors: ["non_json_value"] });

  const invalidState = createDemoState(2035);
  invalidState.metrics.coordinationCapital = Number.NaN;
  assert.throws(() => buildBundle(invalidState), /only JSON values/);

  const cyclicState = createDemoState(2035);
  cyclicState.cycle = cyclicState;
  assert.throws(() => buildBundle(cyclicState), /only JSON values/);
});

test("run seed range does not control timestamp representability and seed roles stay explicit", () => {
  const bundle = buildBundle(createDemoState(2035), { seed: Number.MAX_SAFE_INTEGER, maxSteps: 1 });
  assert.equal(bundle.run_request.seed, Number.MAX_SAFE_INTEGER);
  assert.equal(bundle.run_request.parameters.policy_seed, String(Number.MAX_SAFE_INTEGER));
  assert.equal(bundle.run_request.parameters.simulation_state_seed, "baseline-0");
  assert.doesNotThrow(() => new Date(bundle.run_request.requested_at).toISOString());
  assert.equal(validateMetaSecurityRunBundle(bundle).valid, true);

  const policySeedTamper = structuredClone(bundle);
  policySeedTamper.run_request.parameters.policy_seed = "different";
  assert.equal(validateMetaSecurityRunBundle(policySeedTamper).valid, false);

  const stateSeedTamper = structuredClone(bundle);
  stateSeedTamper.run_request.parameters.simulation_state_seed = "different";
  assert.equal(validateMetaSecurityRunBundle(stateSeedTamper).valid, false);
});

test("rejected PDCA cycles remain rejected evidence", () => {
  const bundle = buildBundle(createDemoState(2037), { maxSteps: 9 });
  assert.equal(bundle.events.at(-1).payload.applied, false);
  assert.equal(bundle.events.at(-1).event_type, "pdca.step.rejected");
  assert.equal(validateMetaSecurityRunBundle(bundle).valid, true);
});

test("implementation revision is a full run-identity input", () => {
  const bundle = buildBundle();
  assert.equal(bundle.run_request.parameters.implementation_revision, IMPLEMENTATION_REVISION);
  bundle.run_request.parameters.implementation_revision = "2".repeat(40);
  assert.equal(validateMetaSecurityRunBundle(bundle).valid, false);
  assert.throws(() => buildMetaSecurityRunBundle(createDemoState(2035), { seed: 404 }), /implementationRevision/);
  assert.throws(() => buildMetaSecurityRunBundle(createDemoState(2035), { seed: 404, implementationRevision: "abc123" }), /implementationRevision/);
});
