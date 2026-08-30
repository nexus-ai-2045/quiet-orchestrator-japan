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
  assert.deepEqual(baseline.oneYearDeltas, {
    translation: { coordinationCapital: 7, legitimacy: 3, continuity: 1, dependency: -2 },
    verification: { coordinationCapital: 4, verification: 10, continuity: 1, surveillance: 2 },
    reversibility: { autonomy: 6, legitimacy: 4, continuity: 1, concentration: -3 },
    redundancy: { interoperability: 6, autonomy: 7, continuity: 1, dependency: -8 },
    coownership: { coordinationCapital: 6, continuity: 10, concentration: -6 },
  });
  assert.deepEqual(baseline.demo2035.metrics, {
    coordinationCapital: 76,
    verification: 58,
    interoperability: 47,
    autonomy: 68,
    legitimacy: 65,
    continuity: 58,
    concentration: 7,
    surveillance: 22,
    dependency: 28,
  });
  assert.deepEqual({
    attributionSafety: baseline.demo2035.stressTest.attributionSafety,
    coordinationSurvival: baseline.demo2035.stressTest.coordinationSurvival,
    civilianProtection: baseline.demo2035.stressTest.civilianProtection,
    verdict: baseline.demo2035.stressTest.verdict,
  }, {
    attributionSafety: 66,
    coordinationSurvival: 71,
    civilianProtection: 64,
    verdict: "改善余地",
  });
  assert.ok(baseline.limitations.includes(
    "all-relationships-use-fictional-archetype-calibration-not-empirical-effects",
  ));
  assert.ok(!baseline.limitations.includes("only-one-relationship-is-investable-and-calibrated"));
  assert.ok(baseline.limitations.includes("actor-constraints-and-decision-rights-are-fictional-not-empirical"));
  assert.ok(!baseline.limitations.includes("actors-do-not-yet-change-behavior"));
});
