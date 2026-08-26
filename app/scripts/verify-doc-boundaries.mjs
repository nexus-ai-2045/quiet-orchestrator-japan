import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const read = (name) => readFile(resolve(repoRoot, name), "utf8");

const [design, contract, results, roadmap] = await Promise.all([
  read("EXPERIMENT_DESIGN.md"),
  read("simulation-contract.md"),
  read("RESULTS.md"),
  read("ROADMAP.md"),
]);

const requirements = [
  [design, "pre-registered design / 未実証", "design status"],
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

if (/公開前review中|visibility変更/.test(roadmap)) {
  throw new Error("stale publication state remains in ROADMAP.md");
}

console.log("document boundaries: OK");
