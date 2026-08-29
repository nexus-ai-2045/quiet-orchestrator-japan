import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { buildMetaSecurityRunBundle, validateMetaSecurityRunBundle } from "../src/run-bundle.js";

test("meta-security-run-bundle/v1 binds request, events, replay, and evidence to one deterministic run", () => {
  const initial = createDemoState(2035);
  const first = buildMetaSecurityRunBundle(initial, { seed: 404 });
  const second = buildMetaSecurityRunBundle(initial, { seed: 404 });

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
  const bundle = buildMetaSecurityRunBundle(createDemoState(2035), { seed: 405 });

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
