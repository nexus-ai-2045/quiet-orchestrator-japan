import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAdrIndex,
  assertCrisisPhaseNamesNotDuplicated,
  assertDrawerEvidenceRows,
  assertHistoricalEvidenceNote,
  assertReadmeImplementationTree,
  extractRecordedResultsHead,
} from "../scripts/doc-boundary-checks.mjs";

const HEAD = "92f795fddd92f153b191a7fd9c45521bb9bbe523";

function resultsFixture({ status = "pass-current-head", sha = "92f795fd", note = true, head = HEAD } = {}) {
  const observation = sha ? `\`${sha}\` で確認。drawerを一覧し逆引きできた` : "drawerを一覧し逆引きできた";
  const rows = ["standard-width", "narrow-880", "narrow-320", "keyboard-modal", "reduced-motion"]
    .map((gate) => `| ${gate} | ${status} | ${observation} |`)
    .join("\n");
  const historical = note ? "履歴content HEAD の記録であり same-HEAD証拠には数えない。\n" : "";
  return `機械検証対象content HEAD: \`${head}\`（\`main\`のmerge commit）\n\n${historical}\n${rows}\n`;
}

test("content HEADはフルSHAとして取り出せる", () => {
  assert.equal(extractRecordedResultsHead(resultsFixture()), HEAD);
});

test("content HEADが40桁でなければ落ちる", () => {
  assert.throws(
    () => extractRecordedResultsHead(resultsFixture({ head: "92f795fd" })),
    /must record the machine-verified content HEAD as a full SHA/,
  );
});

test("same-HEAD証拠はSHA併記がなければ落ちる", () => {
  assert.throws(
    () => assertDrawerEvidenceRows(resultsFixture({ sha: null }), HEAD),
    /must cite the verified commit SHA: standard-width/,
  );
});

test("same-HEAD証拠のSHAがcontent HEADと一致しなければ落ちる", () => {
  // 形式だけを見ていた頃は、実在しないこのSHAでも通っていた。
  assert.throws(
    () => assertDrawerEvidenceRows(resultsFixture({ sha: "deadbee" }), HEAD),
    /SHA must match the recorded content HEAD: standard-width/,
  );
});

test("content HEADのprefixであるSHA併記なら通る", () => {
  const statuses = assertDrawerEvidenceRows(resultsFixture(), HEAD);
  assert.deepEqual(new Set(statuses), new Set(["pass-current-head"]));
});

test("履歴証拠にはSHA併記を要求しない", () => {
  const statuses = assertDrawerEvidenceRows(resultsFixture({ status: "pass-historical-head", sha: null }), HEAD);
  assert.deepEqual(new Set(statuses), new Set(["pass-historical-head"]));
});

test("未実施と書かれた観測は落ちる", () => {
  const text = resultsFixture().replace("drawerを一覧し逆引きできた", "未実施のため未確認");
  assert.throws(() => assertDrawerEvidenceRows(text, HEAD), /must be affirmative and complete/);
});

test("証拠行が存在しなければ落ちる", () => {
  const text = resultsFixture().replace("| standard-width |", "| standard-widthX |");
  assert.throws(() => assertDrawerEvidenceRows(text, HEAD), /row is missing or uses an unknown status: standard-width/);
});

test("履歴証拠が残る間は混同しない注記を要求する", () => {
  const text = resultsFixture({ status: "pass-historical-head", sha: null, note: false });
  assert.throws(
    () => assertHistoricalEvidenceNote(text, ["pass-historical-head"]),
    /must keep historical drawer evidence distinct/,
  );
});

test("全行がsame-HEADなら履歴注記は要求しない", () => {
  assertHistoricalEvidenceNote(resultsFixture({ note: false }), ["pass-current-head"]);
});

test("README実装構成ツリーに載っていないmoduleがあれば落ちる", () => {
  const readme = "## 実装構成\n\n```text\napp/\n  src/\n    simulation.js\n```\n";
  assert.throws(
    () => assertReadmeImplementationTree(readme, ["simulation.js", "crisis.js"]),
    /missing app\/src module: crisis\.js/,
  );
});

test("READMEに実装構成ツリーblockがなければ落ちる", () => {
  assert.throws(() => assertReadmeImplementationTree("# README\n", []), /must keep the 実装構成 tree block/);
});

test("ADR索引に載っていないADRがあれば落ちる", () => {
  assert.throws(
    () => assertAdrIndex("| [0001](0001-a.md) |", ["0001-a.md", "0002-b.md"]),
    /must index the ADR: 0002-b\.md/,
  );
});

test("ADRが1件もなければ落ちる", () => {
  assert.throws(() => assertAdrIndex("index", []), /docs\/adr must contain numbered ADR files/);
});

const CRISIS_SOURCE = `export const CRISIS_PHASES = Object.freeze([
  { start: 0, end: 11, name: "衝撃" }, { start: 12, end: 27, name: "帰属競争" },
  { start: 28, end: 55, name: "生活圧力" }, { start: 56, end: 83, name: "制度疲労" },
]);`;

test("他文書が危機局面名を3つ以上並べると落ちる", () => {
  assert.throws(
    () => assertCrisisPhaseNamesNotDuplicated(CRISIS_SOURCE, [
      ["ROADMAP.md", "衝撃、帰属競争、生活圧力、制度疲労を再生する。"],
    ]),
    /ROADMAP\.md duplicates the crisis phase sequence/,
  );
});

test("局面名への言及が2つまでなら複製とみなさない", () => {
  assertCrisisPhaseNamesNotDuplicated(CRISIS_SOURCE, [
    ["ROADMAP.md", "帰属競争の局面で衝撃の余波を観測する。"],
  ]);
});

test("CRISIS_PHASESを読めなければ落ちる", () => {
  assert.throws(
    () => assertCrisisPhaseNamesNotDuplicated("export const NOTHING = [];", []),
    /must declare CRISIS_PHASES names/,
  );
});
