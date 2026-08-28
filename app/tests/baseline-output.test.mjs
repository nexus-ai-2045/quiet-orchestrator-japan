import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

test("baseline output identifies the frozen design and implementation inputs", () => {
  const output = execFileSync(process.execPath, ["scripts/run-baseline.mjs"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  const baseline = JSON.parse(output);
  const designRevision = execFileSync("git", ["rev-parse", "HEAD:EXPERIMENT_DESIGN.md"], {
    cwd: new URL("../..", import.meta.url),
    encoding: "utf8",
  }).trim();

  assert.equal(baseline.provenance.designRevision, designRevision);
  assert.notEqual(baseline.provenance.implementationRevision, baseline.provenance.designRevision);
  assert.equal(typeof baseline.provenance.workingTreeDirty, "boolean");
  assert.equal(baseline.provenance.seed, "baseline-0");
  assert.equal(baseline.provenance.ruleVersion, "relationship-v1.0.0");
});
