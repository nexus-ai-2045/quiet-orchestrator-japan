import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("baseline output identifies the frozen design and implementation inputs", () => {
  const output = execFileSync(process.execPath, ["scripts/run-baseline.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const baseline = JSON.parse(output);

  assert.match(baseline.provenance.designRevision, /^[0-9a-f]{40}$/);
  assert.equal(baseline.provenance.implementationRevision, baseline.provenance.designRevision);
  assert.equal(typeof baseline.provenance.workingTreeDirty, "boolean");
  assert.equal(baseline.provenance.seed, "baseline-0");
  assert.equal(baseline.provenance.ruleVersion, "relationship-v1.0.0");
});
