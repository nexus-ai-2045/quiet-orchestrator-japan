import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { isIdentifyingGitShaPrefix, parseCompletedPreflightEvidence } from "./preflight-row-gate.mjs";

const scriptDirectory = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(scriptDirectory, "..", "..");
const read = (name) => readFile(resolve(repoRoot, name), "utf8");

const [design, contract, results, roadmap, projectSsot, readme, preflight, publicReady, packageJson, calibrationPacket, calibrationCandidateJson, simulationSource] = await Promise.all([
  read("EXPERIMENT_DESIGN.md"),
  read("simulation-contract.md"),
  read("RESULTS.md"),
  read("ROADMAP.md"),
  read("PROJECT_SSOT.md"),
  read("README.md"),
  read("PREFLIGHT.md"),
  read("PUBLIC_READY.md"),
  read("app/package.json"),
  read("docs/m2-calibration-decision-packet.md"),
  read("docs/m2-calibration-candidate-v1.json"),
  read("app/src/simulation.js"),
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
  const row = results.match(new RegExp(`^\\| ${gate} \\| pass-historical-head \\| ([^|]+) \\|$`, "m"));
  if (!row || /未確認|pending|未実施/.test(row[1]) || row[1].trim().length < 8) {
    throw new Error(`RESULTS.md historical drawer evidence must be affirmative and complete: ${gate}`);
  }
}
if (!results.includes("履歴content HEAD") || !results.includes("same-HEAD証拠には数えない")) {
  throw new Error("RESULTS.md drawer evidence must remain historical for the current M2 content HEAD");
}
if (/^\| (?:standard-width|narrow-880|narrow-320|keyboard-modal|reduced-motion) \| pass-current-head \|/m.test(results)) {
  throw new Error("RESULTS.md must not label historical drawer gates as pass-current-head");
}
if (!roadmap.includes("現在candidateはM2〜M5のローカルMVPを実装済み")) {
  throw new Error("ROADMAP.md must record the current M2-M5 runtime candidate boundary");
}
const m1Roadmap = roadmap.match(/## M1[\s\S]*?(?=## M2)/)?.[0] ?? "";
const m3Roadmap = roadmap.match(/## M3[\s\S]*?(?=## M4)/)?.[0] ?? "";
const countryEquivalenceGate = "日本、中国、米国の国名を入れ替えた制約同等fixture";
if (m1Roadmap.includes(countryEquivalenceGate) || !m3Roadmap.includes(countryEquivalenceGate)) {
  throw new Error("country-equivalence completion gate belongs to M3 actor constraints, not closed M1");
}

if (!calibrationPacket.includes("status: **採用済み / ハッカソン用架空校正**") || !calibrationPacket.includes("経験的校正へ置換する場合はversionを更新")) {
  throw new Error("M2 calibration packet must record the adopted fictional calibration boundary");
}
const calibrationCandidate = JSON.parse(calibrationCandidateJson);
if (
  calibrationCandidate.status !== "adopted-hackathon-fictional"
  || calibrationCandidate.version !== "relationship-v1.1.0"
  || !calibrationPacket.includes(`adopted calibration version: \`${calibrationCandidate.version}\``)
) {
  throw new Error("M2 calibration candidate status/version drift");
}
const relationshipPairsBlock = simulationSource.match(/const RELATIONSHIP_PAIRS = \[([\s\S]*?)\n\];/)?.[1] ?? "";
const runtimeRelationshipIds = [...relationshipPairsBlock.matchAll(/\["([A-Z]\d+)", "([A-Z]\d+)"\]/g)]
  .map(([, source, target]) => `${source}-${target}`)
  .filter((id) => id !== "B1-C6");
const runtimeContestedIds = new Set(
  [...(simulationSource.match(/const CONTESTED_RELATIONSHIPS = new Set\(\[([^\]]+)\]\);/)?.[1] ?? "").matchAll(/"([A-Z]\d+-[A-Z]\d+)"/g)]
    .map(([, id]) => id),
);
const packetRows = [...calibrationPacket.matchAll(/^\| ([A-Z]\d+-[A-Z]\d+) \| ([^|]+) \| ([^|]+) \| (yes|no) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/gm)]
  .map(([, id, endpoints, archetype, contested, purpose, channel, ownership]) => ({
    id,
    endpoints: endpoints.trim(),
    archetype: archetype.trim(),
    contested: contested === "yes",
    purpose: purpose.trim(),
    channel: channel.trim(),
    ownership: ownership.trim(),
  }));
const packetRelationshipIds = packetRows.map(({ id }) => id);
if (
  runtimeRelationshipIds.length !== 19
  || packetRelationshipIds.length !== 19
  || new Set(packetRelationshipIds).size !== 19
  || runtimeRelationshipIds.some((id) => !packetRelationshipIds.includes(id))
) {
  throw new Error(`M2 calibration packet relationship drift: runtime=${runtimeRelationshipIds.join(",")}, packet=${packetRelationshipIds.join(",")}`);
}
const stateKeys = ["maturity", "trust", "verificationAgreement", "interoperability", "coOwnership", "dependency", "alternateRoutes", "disclosureCost"];
const actionIds = ["translation", "verification", "reversibility", "redundancy", "coownership"];
const archetypeIds = ["verification", "interoperability", "coownership"];
if (JSON.stringify(calibrationCandidate.stateKeys) !== JSON.stringify(stateKeys) || JSON.stringify(calibrationCandidate.actions) !== JSON.stringify(actionIds)) {
  throw new Error("M2 calibration candidate state/action dimensions drift");
}
if (Object.keys(calibrationCandidate.archetypes).sort().join("|") !== [...archetypeIds].sort().join("|")) {
  throw new Error("M2 calibration candidate archetype dimensions drift");
}
for (const archetypeId of archetypeIds) {
  const archetype = calibrationCandidate.archetypes[archetypeId];
  if (!archetype || typeof archetype.ownership !== "string" || archetype.ownership.trim().length < 4) {
    throw new Error(`M2 calibration candidate ownership missing: ${archetypeId}`);
  }
  if (Object.keys(archetype.initialState ?? {}).sort().join("|") !== [...stateKeys].sort().join("|")) {
    throw new Error(`M2 calibration candidate initial-state dimensions drift: ${archetypeId}`);
  }
  for (const [key, value] of Object.entries(archetype.initialState)) {
    const valid = key === "alternateRoutes"
      ? Number.isInteger(value) && value >= 0 && value <= 5
      : Number.isInteger(value) && value >= 0 && value <= 100;
    if (!valid) throw new Error(`M2 calibration candidate initial-state value invalid: ${archetypeId}.${key}=${value}`);
  }
  if (Object.keys(archetype.actionMultipliers ?? {}).sort().join("|") !== [...actionIds].sort().join("|")) {
    throw new Error(`M2 calibration candidate action dimensions drift: ${archetypeId}`);
  }
  for (const [actionId, multiplier] of Object.entries(archetype.actionMultipliers)) {
    if (multiplier !== null && !(typeof multiplier === "number" && multiplier > 0 && multiplier <= 1)) {
      throw new Error(`M2 calibration candidate multiplier invalid: ${archetypeId}.${actionId}=${multiplier}`);
    }
  }
  const displayedStateRow = `| ${archetypeId} | ${stateKeys.map((key) => archetype.initialState[key]).join(" | ")} |`;
  if (!calibrationPacket.includes(displayedStateRow)) {
    throw new Error(`M2 calibration packet displayed initial-state drift: ${archetypeId}`);
  }
  const displayedActionRow = `| ${archetypeId} | ${actionIds.map((actionId) => {
    const multiplier = archetype.actionMultipliers[actionId];
    return multiplier === null ? "—" : multiplier.toFixed(2);
  }).join(" | ")} |`;
  if (!calibrationPacket.includes(displayedActionRow)) {
    throw new Error(`M2 calibration packet displayed action-multiplier drift: ${archetypeId}`);
  }
  if (!calibrationPacket.includes(`| ${archetypeId} | ${archetype.ownership} |`)) {
    throw new Error(`M2 calibration packet displayed ownership drift: ${archetypeId}`);
  }
}
if (Object.keys(calibrationCandidate.contestedModifier?.initialStateDelta ?? {}).sort().join("|") !== [...stateKeys].sort().join("|")) {
  throw new Error("M2 calibration candidate contested modifier dimensions drift");
}
for (const [key, delta] of Object.entries(calibrationCandidate.contestedModifier.initialStateDelta)) {
  if (!Number.isInteger(delta) || delta < -100 || delta > 100) {
    throw new Error(`M2 calibration candidate contested modifier invalid: ${key}=${delta}`);
  }
  for (const archetypeId of archetypeIds) {
    const modified = calibrationCandidate.archetypes[archetypeId].initialState[key] + delta;
    const valid = key === "alternateRoutes" ? modified >= 0 && modified <= 5 : modified >= 0 && modified <= 100;
    if (!valid) throw new Error(`M2 calibration candidate contested state out of range: ${archetypeId}.${key}=${modified}`);
  }
}
if (
  calibrationCandidate.contestedModifier.positiveDeltaMultiplier !== 0.75
  || calibrationCandidate.contestedModifier.riskDeltaMultiplier !== 1
  || typeof calibrationCandidate.contestedModifier.ownershipSuffix !== "string"
) {
  throw new Error("M2 calibration candidate contested modifier policy drift");
}
const modifier = calibrationCandidate.contestedModifier.initialStateDelta;
const modifierSentence = `\`contested\`接続はbaseへ、成熟\`${modifier.maturity}\`、信頼\`${modifier.trust}\`、検証合意\`${modifier.verificationAgreement}\`、単一依存\`+${modifier.dependency}\`、開示コスト\`+${modifier.disclosureCost}\`を適用する。`;
if (!calibrationPacket.includes(modifierSentence)) {
  throw new Error("M2 calibration packet displayed contested modifier drift");
}
const decisionModifierSentence = `\`contested\`だけ成熟\`${modifier.maturity}\`、信頼\`${modifier.trust}\`、検証合意\`${modifier.verificationAgreement}\`、単一依存\`+${modifier.dependency}\`、開示コスト\`+${modifier.disclosureCost}\`の明示modifierを適用する。`;
if (!calibrationPacket.includes(decisionModifierSentence)) {
  throw new Error("M2 calibration packet decision-summary modifier drift");
}
const candidateRows = calibrationCandidate.relationships ?? [];
if (candidateRows.length !== 19 || new Set(candidateRows.map(({ id }) => id)).size !== 19) {
  throw new Error("M2 calibration candidate must contain 19 unique relationship rows");
}
const actorBlock = simulationSource.match(/export const ACTORS = \[([\s\S]*?)\n\];/)?.[1] ?? "";
const actorNames = new Map(
  [...actorBlock.matchAll(/\{ id: "([A-Z]\d+)", group: "[^"]+", name: "([^"]+)"/g)]
    .map(([, id, name]) => [id, name]),
);
for (const runtimeId of runtimeRelationshipIds) {
  const candidate = candidateRows.find(({ id }) => id === runtimeId);
  const packet = packetRows.find(({ id }) => id === runtimeId);
  if (!candidate || !packet || !archetypeIds.includes(candidate.archetype)) {
    throw new Error(`M2 calibration candidate relationship missing or invalid: ${runtimeId}`);
  }
  const expectedContested = runtimeContestedIds.has(runtimeId);
  const expectedOwnership = calibrationCandidate.archetypes[candidate.archetype].ownership
    + (expectedContested ? calibrationCandidate.contestedModifier.ownershipSuffix : "");
  const [sourceId, targetId] = runtimeId.split("-");
  const [displayedSource, displayedTarget] = packet.endpoints.split("↔").map((value) => value.trim());
  const endpointsMatchRuntime = actorNames.get(sourceId)?.endsWith(displayedSource)
    && actorNames.get(targetId)?.endsWith(displayedTarget);
  if (
    candidate.contested !== expectedContested
    || packet.contested !== expectedContested
    || packet.archetype !== candidate.archetype
    || packet.purpose !== candidate.purpose
    || packet.channel !== candidate.channel
    || packet.ownership !== expectedOwnership
    || !endpointsMatchRuntime
    || candidate.purpose.trim().length < 8
    || candidate.channel.trim().length < 5
  ) {
    throw new Error(`M2 calibration packet/candidate/runtime row drift: ${runtimeId}`);
  }
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

const preflightBranch = preflight.match(/^- branch: `([^`]+)`$/m)?.[1];
const publicReadyBranch = publicReady.match(/^- 準備branch: `([^`]+)`$/m)?.[1];
if (!preflightBranch || publicReadyBranch !== preflightBranch) {
  throw new Error(
    `current branch evidence drift: PREFLIGHT=${preflightBranch ?? "missing"}, PUBLIC_READY=${publicReadyBranch ?? "missing"}`,
  );
}

const preflightBaseSha = preflight.match(/^- base: `origin\/main@([0-9a-f]{40})`$/m)?.[1];
const preflightDefaultBranchSha = preflight.match(/default branch `main@([0-9a-f]+)`/)?.[1];
const publicReadyDefaultBranchSha = publicReady.match(/^- default branch: `main@([0-9a-f]+)`/m)?.[1];
const publicReadySummarySha = publicReady.match(/^- `main@([0-9a-f]+)`は/m)?.[1];
if (!preflightBaseSha || !preflightDefaultBranchSha) {
  throw new Error("PREFLIGHT.md must record origin/main base SHA and default-branch read-back");
}
if (
  !isIdentifyingGitShaPrefix(preflightDefaultBranchSha)
  || !isIdentifyingGitShaPrefix(publicReadyDefaultBranchSha)
  || !isIdentifyingGitShaPrefix(publicReadySummarySha)
) {
  throw new Error("default-branch provenance must use an identifying Git SHA prefix of 7-40 hexadecimal characters");
}
if (!preflightBaseSha.startsWith(preflightDefaultBranchSha)) {
  throw new Error(
    `PREFLIGHT default-branch provenance drift: base=${preflightBaseSha}, read-back=${preflightDefaultBranchSha}`,
  );
}
if (
  publicReadyDefaultBranchSha !== preflightDefaultBranchSha
  || publicReadySummarySha !== preflightDefaultBranchSha
) {
  throw new Error(
    `default branch provenance drift: PREFLIGHT=${preflightDefaultBranchSha}, PUBLIC_READY target=${publicReadyDefaultBranchSha ?? "missing"}, summary=${publicReadySummarySha ?? "missing"}`,
  );
}

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
