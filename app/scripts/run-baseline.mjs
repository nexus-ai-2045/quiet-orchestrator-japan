import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  ACTIONS,
  RULE_VERSION,
  createDemoState,
  createInitialState,
  advanceYear,
  runStressTest,
  selectAction,
} from "../src/simulation.js";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const git = (...args) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
const implementationRevision = process.env.GITHUB_SHA || git("rev-parse", "HEAD");
const designRevision = git("rev-parse", "HEAD:EXPERIMENT_DESIGN.md");
const workingTreeDirty = git("status", "--porcelain", "--untracked-files=no") !== "";

const oneYearDeltas = Object.fromEntries(ACTIONS.map((action) => {
  const initial = createInitialState();
  const next = advanceYear(selectAction(initial, action.id));
  const deltas = Object.fromEntries(Object.keys(initial.metrics).map((key) => [
    key,
    next.metrics[key] - initial.metrics[key],
  ]).filter(([, delta]) => delta !== 0));
  return [action.id, deltas];
}));

const demo = runStressTest(createDemoState(2035));
console.log(JSON.stringify({
  schemaVersion: 1,
  runType: "P0-baseline",
  deterministic: true,
  provenance: {
    designRevision,
    implementationRevision,
    workingTreeDirty,
    seed: demo.seed,
    ruleVersion: RULE_VERSION,
  },
  oneYearDeltas,
  demo2035: {
    metrics: demo.metrics,
    stressTest: demo.stressTests[2035],
  },
  limitations: [
    "all-relationships-use-fictional-archetype-calibration-not-empirical-effects",
    "actor-constraints-and-decision-rights-are-fictional-not-empirical",
    "crisis-events-and-causal-chain-are-fictional-not-forecast-evidence",
    "comparative-strategies-and-removal-results-are-fictional-not-policy-evidence",
  ],
}, null, 2));
