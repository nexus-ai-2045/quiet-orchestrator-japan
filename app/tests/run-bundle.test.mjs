import test from "node:test";
import assert from "node:assert/strict";
import { createDemoState } from "../src/simulation.js";
import { buildMetaSecurityRunBundle, validateMetaSecurityRunBundle } from "../src/run-bundle.js";
import { resolveImplementationRevision } from "../src/run-bundle-provenance.js";

const IMPLEMENTATION_REVISION = "1".repeat(40);
const buildBundle = (state = createDemoState(2035), options = {}) => buildMetaSecurityRunBundle(state, {
  seed: 404,
  implementationRevision: IMPLEMENTATION_REVISION,
  ...options,
});
const validateBundle = (bundle, expectedImplementationRevision = IMPLEMENTATION_REVISION) => validateMetaSecurityRunBundle(
  bundle,
  { expectedImplementationRevision },
);

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
  assert.deepEqual(first.events.map((event) => event.sequence), Array.from({ length: 130 }, (_, index) => index));
  assert.equal(first.events.filter((event) => event.event_type === "crisis.turn.completed").length, 120);
  assert.equal(first.events.at(-1).event_type, "comparative-study.completed");
  assert.equal(first.events.at(-1).payload.evaluation_policy, "axes-first-no-scalar-winner");
  assert.equal(first.events.at(-1).payload.japan_removal.status, "pending");
  assert.equal(first.events.at(-1).payload.japan_removal.requiredYear, 2045);
  assert.equal(Array.isArray(first.events.at(-1).payload.sensitivity_variants), true);
  assert.equal(Array.isArray(first.events.at(-1).payload.reversal_thresholds), true);
  assert.equal(first.events.every((event) => event.run_id === first.run_request.run_id), true);
  assert.equal(first.replay.event_stream_sha256, first.evidence.event_stream_sha256);
  assert.equal(validateBundle(first).valid, true);
});

test("run bundle validation fails closed on run identity and event-order drift", () => {
  const bundle = buildBundle(createDemoState(2035), { seed: 405 });

  const wrongRun = structuredClone(bundle);
  wrongRun.events[0].run_id = "qoj-0000000000000000";
  assert.equal(validateBundle(wrongRun).valid, false);

  const reordered = structuredClone(bundle);
  [reordered.events[0], reordered.events[1]] = [
    reordered.events[1],
    reordered.events[0],
  ];
  assert.equal(validateBundle(reordered).valid, false);
});

test("run bundle rejects non-JSON values before deterministic comparison", () => {
  const bundle = buildBundle();
  bundle.events[0].payload.errors = [undefined];
  assert.deepEqual(validateBundle(bundle), { valid: false, errors: ["non_json_value"] });

  const hidden = buildBundle();
  Object.defineProperty(hidden.events[0].payload, "hidden", { value: "tamper", enumerable: false });
  assert.deepEqual(validateBundle(hidden), { valid: false, errors: ["non_json_value"] });

  const accessor = buildBundle();
  let reads = 0;
  Object.defineProperty(accessor, "product_id", { enumerable: true, get() { reads += 1; return "quiet-orchestrator-japan"; } });
  assert.deepEqual(validateBundle(accessor), { valid: false, errors: ["non_json_value"] });
  assert.equal(reads, 0);

  const inherited = buildBundle();
  const inheritedEvents = [...inherited.events];
  Object.setPrototypeOf(inheritedEvents, { get some() { throw new Error("must not execute"); } });
  inherited.events = inheritedEvents;
  assert.doesNotThrow(() => validateBundle(inherited));
  assert.deepEqual(validateBundle(inherited), { valid: false, errors: ["non_json_value"] });

  const disguisedSparse = buildBundle();
  const sparse = [];
  sparse.length = 1;
  sparse.foo = "bar";
  disguisedSparse.events[0].payload.errors = sparse;
  assert.deepEqual(validateBundle(disguisedSparse), { valid: false, errors: ["non_json_value"] });

  const deep = buildBundle();
  let cursor = deep.events[0].payload;
  for (let index = 0; index < 100; index += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.doesNotThrow(() => validateBundle(deep));
  assert.deepEqual(validateBundle(deep), { valid: false, errors: ["non_json_value"] });

  const proxied = buildBundle();
  let proxyReads = 0;
  const proxy = new Proxy(proxied, {
    get(target, property, receiver) {
      if (property === "schema") {
        proxyReads += 1;
        throw new Error("untrusted get trap must not execute");
      }
      return Reflect.get(target, property, receiver);
    },
  });
  assert.doesNotThrow(() => validateBundle(proxy));
  assert.deepEqual(validateBundle(proxy), { valid: false, errors: ["non_json_value"] });
  assert.equal(proxyReads, 0);

  const revoked = Proxy.revocable({}, {});
  revoked.revoke();
  assert.doesNotThrow(() => validateBundle(revoked.proxy));
  assert.deepEqual(validateBundle(revoked.proxy), { valid: false, errors: ["non_json_value"] });

  const tooWide = buildBundle();
  tooWide.events[0].payload.wide = Object.fromEntries(
    Array.from({ length: 100_001 }, (_, index) => [`key${index}`, index]),
  );
  assert.deepEqual(validateBundle(tooWide), { valid: false, errors: ["non_json_value"] });

  const invalidState = createDemoState(2035);
  invalidState.metrics.coordinationCapital = Number.NaN;
  assert.throws(() => buildBundle(invalidState), /only JSON values/);

  const cyclicState = createDemoState(2035);
  cyclicState.cycle = cyclicState;
  assert.throws(() => buildBundle(cyclicState), /only JSON values/);

  const envelopeOverflow = createDemoState(2035);
  let envelopeCursor = envelopeOverflow;
  for (let index = 0; index < 62; index += 1) {
    envelopeCursor.extra = {};
    envelopeCursor = envelopeCursor.extra;
  }
  assert.throws(() => buildBundle(envelopeOverflow), /JSON transport boundary/);
});

test("run seed range does not control timestamp representability and seed roles stay explicit", () => {
  const bundle = buildBundle(createDemoState(2035), { seed: Number.MAX_SAFE_INTEGER, maxSteps: 1 });
  assert.equal(bundle.run_request.seed, Number.MAX_SAFE_INTEGER);
  assert.equal(bundle.run_request.parameters.policy_seed, String(Number.MAX_SAFE_INTEGER));
  assert.equal(bundle.run_request.parameters.simulation_state_seed, "baseline-0");
  assert.doesNotThrow(() => new Date(bundle.run_request.requested_at).toISOString());
  assert.equal(validateBundle(bundle).valid, true);

  const policySeedTamper = structuredClone(bundle);
  policySeedTamper.run_request.parameters.policy_seed = "different";
  assert.equal(validateBundle(policySeedTamper).valid, false);

  const stateSeedTamper = structuredClone(bundle);
  stateSeedTamper.run_request.parameters.simulation_state_seed = "different";
  assert.equal(validateBundle(stateSeedTamper).valid, false);
});

test("rejected PDCA cycles remain rejected evidence", () => {
  const bundle = buildBundle(createDemoState(2037), { maxSteps: 9 });
  const rejected = bundle.events.find((event) => event.event_type === "pdca.step.rejected");
  assert.equal(rejected.payload.applied, false);
  assert.equal(rejected.payload.governance_entries.at(-1).outcome, "rejected");
  assert.equal(validateBundle(bundle).valid, true);
});

test("checkpoint retries preserve every governance outcome and transition", () => {
  const bundle = buildBundle(createDemoState(2035));
  const retried = bundle.events.find((event) => event.payload.attempts?.length === 2);
  assert.ok(retried);
  assert.deepEqual(retried.payload.attempts.map((attempt) => attempt.applied), [false, true]);
  assert.equal(retried.payload.attempts[0].governance_entries.at(-1).outcome, "rejected");
  assert.equal(retried.payload.attempts[1].governance_entries.at(-1).outcome, "approved");
  assert.equal(retried.payload.checkpoint.recorded, true);
  assert.equal(validateBundle(bundle).valid, true);
});

test("implementation revision is a full run-identity input", () => {
  const bundle = buildBundle();
  assert.equal(bundle.run_request.parameters.implementation_revision, IMPLEMENTATION_REVISION);
  bundle.run_request.parameters.implementation_revision = "2".repeat(40);
  assert.equal(validateBundle(bundle).valid, false);
  assert.equal(validateMetaSecurityRunBundle(buildBundle()).valid, false);
  assert.equal(validateBundle(buildBundle(), "2".repeat(40)).valid, false);
  assert.throws(() => buildMetaSecurityRunBundle(createDemoState(2035), { seed: 404 }), /implementationRevision/);
  assert.throws(() => buildMetaSecurityRunBundle(createDemoState(2035), { seed: 404, implementationRevision: "abc123" }), /implementationRevision/);
});

test("validator returns invalid for every non-array event container", () => {
  for (const events of [{}, "x", 1, true]) {
    const bundle = buildBundle();
    bundle.events = events;
    assert.equal(validateBundle(bundle).valid, false);
  }
});

test("builder requires the canonical simulation state seed", () => {
  const state = createDemoState(2035);
  delete state.seed;
  assert.throws(() => buildBundle(state), /simulation state seed/);
});

test("implementation provenance is resolved from a clean implementation repository", () => {
  const calls = [];
  const execGit = (_file, args, options) => {
    calls.push({ args, cwd: options.cwd });
    return args[0] === "rev-parse" ? `${IMPLEMENTATION_REVISION}\n` : "";
  };
  assert.equal(resolveImplementationRevision("C:/implementation", { githubSha: "", execGit }), IMPLEMENTATION_REVISION);
  assert.deepEqual(calls.map(({ cwd }) => cwd), ["C:/implementation", "C:/implementation"]);

  assert.throws(() => resolveImplementationRevision("C:/implementation", {
    githubSha: "",
    execGit: (_file, args) => args[0] === "rev-parse" ? `${IMPLEMENTATION_REVISION}\n` : " M app/src/run-bundle.js\n",
  }), /dirty/);
  assert.throws(() => resolveImplementationRevision("C:/implementation", {
    githubSha: "2".repeat(40),
    execGit,
  }), /does not match/);
});
