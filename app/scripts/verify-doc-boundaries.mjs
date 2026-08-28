import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

const testTargets = JSON.parse(packageJson).scripts.test.match(/tests\/[\w.-]+\.test\.mjs/g) ?? [];
const testSources = await Promise.all(testTargets.map((target) => read(`app/${target}`)));
const registeredTestCount = testSources.reduce(
  (count, source) => count + (source.match(/\btest\s*\(/g)?.length ?? 0),
  0,
);
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
