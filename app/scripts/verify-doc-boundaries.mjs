import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parseCompletedPreflightEvidence } from "./preflight-row-gate.mjs";

const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptDirectory, "..", "..");
const read = (name) => readFile(resolve(repoRoot, name), "utf8");

const [design, contract, results, roadmap, projectSsot, readme, preflight, publicReady, packageJson] = await Promise.all([
  read("EXPERIMENT_DESIGN.md"),
  read("simulation-contract.md"),
  read("RESULTS.md"),
  read("ROADMAP.md"),
  read("PROJECT_SSOT.md"),
  read("README.md"),
  read("PREFLIGHT.md"),
  read("PUBLIC_READY.md"),
  read("app/package.json"),
]);

const requirements = [
  [design, "retrospective design snapshot / 未実証", "design status"],
  [design, "## 反証・縮小条件", "design falsification section"],
  [contract, "EXPERIMENT_DESIGN.md", "contract design pointer"],
  [results, "実測", "results evidence label"],
  [roadmap, "P0 baseline", "roadmap baseline terminology"],
];

for (const [content, needle, label] of requirements) {
  if (!content.includes(needle)) throw new Error(`document boundary missing: ${label}`);
}

const forbiddenDesignPhrases = ["テストは4件pass", "build pass", "実測結果である"];
for (const phrase of forbiddenDesignPhrases) {
  if (design.includes(phrase)) throw new Error(`observed result leaked into design: ${phrase}`);
}

if (contract.includes("| A ブロック分断")) {
  throw new Error("comparison design duplicated in simulation-contract.md");
}

if (!results.includes("EXPERIMENT_DESIGN.md") || !results.includes("結論に使えない")) {
  throw new Error("RESULTS.md must link the frozen design and state its limits");
}

if (!design.includes("事前登録証拠ではない") || !results.includes("事前登録証拠ではない")) {
  throw new Error("design chronology limitation must remain explicit");
}

const historicalDrawerEvidenceGates = ["standard-width", "narrow-880", "narrow-320", "keyboard-modal", "reduced-motion"];
for (const gate of historicalDrawerEvidenceGates) {
  const row = results.match(new RegExp(`^\\| ${gate} \\| history-only-9a11564 \\| ([^|]+) \\|$`, "m"));
  if (!row || /未確認|pending|未実施/.test(row[1]) || row[1].trim().length < 8) {
    throw new Error(`RESULTS.md historical drawer evidence must retain its provenance and observation: ${gate}`);
  }
}
if (!roadmap.includes("M1因果台帳drawerとUIゲート同一HEAD証拠を閉じ、次はM2")) {
  throw new Error("ROADMAP.md cannot close M1 without the current drawer same-HEAD evidence");
}
const m1Roadmap = roadmap.match(/## M1[\s\S]*?(?=## M2)/)?.[0] ?? "";
const m3Roadmap = roadmap.match(/## M3[\s\S]*?(?=## M4)/)?.[0] ?? "";
const countryEquivalenceGate = "日本、中国、米国の国名を入れ替えた制約同等fixture";
if (m1Roadmap.includes(countryEquivalenceGate) || !m3Roadmap.includes(countryEquivalenceGate)) {
  throw new Error("country-equivalence completion gate belongs to M3 actor constraints, not closed M1");
}

const historicalEvidenceRows = [
  ["PREFLIGHT browser", preflight, /^\| ブラウザ操作・デザインQA \| history-only-pr4 \|.*現在branchのsame-HEAD evidenceではなく.*\|$/m],
  ["PUBLIC_READY browser", publicReady, /^\| ブラウザ操作 \| history-only-pr4 \|.*現在branchのsame-HEAD evidenceではなく.*\|$/m],
  ["PUBLIC_READY design QA", publicReady, /^\| デザインQA \| history-only-pr4 \|.*現在branchのsame-HEAD evidenceではなく.*\|$/m],
];
for (const [name, content, pattern] of historicalEvidenceRows) {
  if (!pattern.test(content)) throw new Error(`${name} must classify inherited evidence as historical`);
}

if (!/^\| repo-preflight target diff \| pass \| machine-readable result v1 \|$/m.test(preflight)) {
  throw new Error("PREFLIGHT.md repo-preflight summary row must point to machine-readable result v1");
}
parseCompletedPreflightEvidence(preflight);

const scripts = JSON.parse(packageJson).scripts;
const verifySitesEvidence = process.argv.includes("--sites");
function getTestResult(scriptName) {
  const targets = scripts[scriptName]?.match(/tests\/[\w.-]+\.test\.mjs/g) ?? [];
  if (targets.length === 0) throw new Error(`no test targets found for ${scriptName}`);
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", ...targets], {
    cwd: resolve(repoRoot, "app"),
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`${scriptName} failed while measuring evidence:\n${result.stdout}\n${result.stderr}`);
  const readSummary = (label) => Number(result.stdout.match(new RegExp(`^# ${label} (\\d+)$`, "m"))?.[1] ?? Number.NaN);
  const summary = {
    pass: readSummary("pass"),
    skipped: readSummary("skipped"),
    todo: readSummary("todo"),
    cancelled: readSummary("cancelled"),
  };
  if (!Number.isFinite(summary.pass) || summary.skipped !== 0 || summary.todo !== 0 || summary.cancelled !== 0) {
    throw new Error(`${scriptName} evidence is not all-pass: ${JSON.stringify(summary)}`);
  }
  return summary.pass;
}

const registeredTestCount = getTestResult("test");
const recordedTestCounts = {
  RESULTS: Number(results.match(/\| `npm test` \| (\d+)件pass \|/)?.[1] ?? Number.NaN),
  ROADMAP: Number(roadmap.match(/unit test (\d+)件/)?.[1] ?? Number.NaN),
  PREFLIGHT: Number(preflight.match(/`npm test`: (\d+)件pass/)?.[1] ?? Number.NaN),
  PUBLIC_READY: Number(publicReady.match(/決定論テスト(\d+)件/)?.[1] ?? Number.NaN),
};
if (Object.values(recordedTestCounts).some((count) => count !== registeredTestCount)) {
  throw new Error(
    `npm test count drift: ${JSON.stringify(recordedTestCounts)}, registered=${registeredTestCount}`,
  );
}

if (verifySitesEvidence) {
  const registeredSitesTestCount = getTestResult("test:sites");
  const recordedSitesTestCounts = {
    RESULTS: Number(results.match(/\| `npm run test:sites` \| (\d+)件pass \|/)?.[1] ?? Number.NaN),
    ROADMAP: Number(roadmap.match(/Sites test (\d+)件/)?.[1] ?? Number.NaN),
    PREFLIGHT: Number(preflight.match(/`npm run test:sites`: (\d+)件pass/)?.[1] ?? Number.NaN),
    PUBLIC_READY: Number(publicReady.match(/Sites互換テスト(\d+)件/)?.[1] ?? Number.NaN),
  };
  if (Object.values(recordedSitesTestCounts).some((count) => count !== registeredSitesTestCount)) {
    throw new Error(
      `npm run test:sites count drift: ${JSON.stringify(recordedSitesTestCounts)}, registered=${registeredSitesTestCount}`,
    );
  }
}

if (/公開前review中|visibility変更/.test(roadmap)) {
  throw new Error("stale publication state remains in ROADMAP.md");
}

const currentStateDocuments = { PROJECT_SSOT: projectSsot, ROADMAP: roadmap, RESULTS: results, README: readme, PREFLIGHT: preflight, PUBLIC_READY: publicReady };
const staleLifecyclePhrases = [
  "mergeされるまで現行SSOTではなく",
  "本SSOT統合HEADはローカルのみ",
  "現在HEADはlocalのみ",
  "どのPRへ統合HEADを反映するか",
  "public push前のローカル候補",
  "P1 ローカル統合候補",
  "P1 ローカル候補",
  "P1はPR #4でreview中",
  "main反映はPR merge後",
  "SSOT統合HEADは未push",
  "PR #4はremote `codex/design-roadmap-2045",
  "PR #4は`c2eeaf3`でOPEN",
];
for (const [name, content] of Object.entries(currentStateDocuments)) {
  for (const phrase of staleLifecyclePhrases) {
    if (content.includes(phrase)) {
      throw new Error(`stale merge lifecycle claim in ${name}: ${phrase}`);
    }
  }
}

console.log("document boundaries: OK");
