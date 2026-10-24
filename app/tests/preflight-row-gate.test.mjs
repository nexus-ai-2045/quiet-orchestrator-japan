import assert from "node:assert/strict";
import test from "node:test";
import { isIdentifyingGitShaPrefix, parseCompletedPreflightEvidence } from "../scripts/preflight-row-gate.mjs";

const valid = `<!-- repo-preflight-result:v1 -->
\`\`\`json
{"schemaVersion":1,"status":"pass","intent":"ready_after_confirmation","contentHead":"c1648feac1afcf42220cbfe0292e91c946dd46fb","secretCandidates":0,"personalPaths":0,"origin":"pass","cleanWorktree":true,"ciConfigCount":2,"effectiveIdentity":"pass","historyMismatchCount":2,"effectiveMismatchCount":0}
\`\`\``;

test("fixed completion schema with numeric observations is accepted", () => {
  assert.equal(parseCompletedPreflightEvidence(valid).ciConfigCount, 2);
});

test("future-plan prose cannot masquerade as completed evidence", () => {
  assert.throws(() => parseCompletedPreflightEvidence("pass / ready_after_confirmation | secret候補をpush前に確認する"), /missing repo-preflight-result:v1 marker/);
});

test("unknown fields and nonzero risk observations fail closed", () => {
  assert.throws(() => parseCompletedPreflightEvidence(valid.replace('"secretCandidates":0', '"secretCandidates":1')), /secretCandidates must be 0/);
  assert.throws(() => parseCompletedPreflightEvidence(valid.replace('"status":"pass"', '"status":"pass","note":"確認する"')), /keys do not match the fixed schema/);
});

test("Git provenance rejects non-identifying SHA prefixes", () => {
  assert.equal(isIdentifyingGitShaPrefix("959f3f8"), true);
  assert.equal(isIdentifyingGitShaPrefix("959f3f85368a45c88212554bf091cff1380701f1"), true);
  assert.equal(isIdentifyingGitShaPrefix("9"), false);
  assert.equal(isIdentifyingGitShaPrefix("not-a-sha"), false);
});
