import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAdrIndex,
  assertContentHeadLineage,
  assertContentHeadReachable,
  assertCrisisPhaseNamesNotDuplicated,
  assertDrawerEvidenceRows,
  assertHistoricalEvidenceNote,
  assertPreflightResultSections,
  assertReadmeImplementationTree,
  assertReviewRecordHeadsAgree,
  assertReviewRecordQaRows,
  extractRecordedContentHead,
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

const RECORD_HEAD = "60268813b322e2647a0a6bb16ebd481ff5285ed8";
const HISTORICAL_ROW = "| ブラウザ操作 | history-only-pr4 | 2026-08-28のPR #4系列で確認済み。現在branchのsame-HEAD evidenceではなく、履歴証拠 |";

function reviewRecordFixture({ head = RECORD_HEAD, rows = [], historyRows = [] } = {}) {
  return [
    "## 現在の記録",
    "",
    `- content HEAD: \`${head}\``,
    "",
    "| 項目 | 状態 | 備考 |",
    "|---|---|---|",
    ...rows,
    "",
    "## 履歴記録",
    "",
    "- content HEAD: `8d1e738799ec6997eceb7133dd3a53b39e349c5b`",
    "",
    ...historyRows,
    "",
  ].join("\n");
}

const currentRow = (sha, label = "ブラウザ操作") =>
  `| ${label} | pass-current-head | \`${sha}\` のapp/srcで確認。drawerを一覧し逆引きできた |`;

test("review recordのcontent HEADは先頭 (現在) の記録を取り出す", () => {
  assert.equal(extractRecordedContentHead(reviewRecordFixture(), "PREFLIGHT.md"), RECORD_HEAD);
});

test("review recordにフルSHAのcontent HEADがなければ落ちる", () => {
  assert.throws(
    () => extractRecordedContentHead("- content HEAD: `6026881`\n", "PUBLIC_READY.md"),
    /PUBLIC_READY\.md must record its content HEAD as a full SHA/,
  );
});

test("履歴と明記したQA行は通る (特定PR番号のリテラルに依存しない)", () => {
  const text = reviewRecordFixture({
    rows: [HISTORICAL_ROW, HISTORICAL_ROW.replace("history-only-pr4", "history-only-pr12")],
  });
  const statuses = assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]);
  assert.deepEqual(statuses, ["history-only-pr4", "history-only-pr12"]);
});

test("履歴statusでもsame-HEADではないと明記しなければ落ちる", () => {
  const text = reviewRecordFixture({ rows: ["| ブラウザ操作 | history-only-pr4 | 2026-08-28に確認済み |"] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    /ブラウザ操作 must classify inherited evidence as historical/,
  );
});

test("content HEADのprefixを併記したsame-HEAD証拠は通る", () => {
  const text = reviewRecordFixture({ rows: [currentRow("60268813")] });
  assert.deepEqual(
    assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    ["pass-current-head"],
  );
});

test("現在の証拠行と履歴行が同じ文書に並んでも通る", () => {
  const text = reviewRecordFixture({ rows: [currentRow("60268813"), HISTORICAL_ROW] });
  assert.deepEqual(
    assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    ["pass-current-head", "history-only-pr4"],
  );
});

test("記録済みcontent HEADと一致しないSHAのsame-HEAD証拠は落ちる", () => {
  // 実在確認そのものは git を引く assertContentHeadReachable の責務で、ここはprefix照合だけを見る。
  const text = reviewRecordFixture({ rows: [currentRow("deadbee")] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    /ブラウザ操作 same-HEAD evidence SHA must match the content HEAD of its own record/,
  );
});

test("実在するが別commitのSHAを併記したsame-HEAD証拠は落ちる", () => {
  // 92f795fd は実在するmainのcommitだが、記録済みcontent HEADではない。
  const text = reviewRecordFixture({ rows: [currentRow("92f795fd")] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PREFLIGHT.md", ["ブラウザ操作"]),
    /same-HEAD evidence SHA must match the content HEAD of its own record/,
  );
});

test("現在の記録にQA行が無く履歴節にしか無ければ落ちる", () => {
  const text = reviewRecordFixture({ rows: [], historyRows: [HISTORICAL_ROW] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    /current record QA evidence row is missing: ブラウザ操作/,
  );
});

test("履歴節のsame-HEAD証拠は自分の節のcontent HEADで判定する (現在HEADへ追随させない)", () => {
  // 履歴の記録は当時のHEADで実測したまま残す。現在HEADと照合すると、HEADが進むたびに
  // 「変更せずに残す」はずの履歴を書き換えないとgateが通らなくなる (lifecycle凍結の再発)。
  const text = reviewRecordFixture({
    rows: [currentRow("60268813")],
    historyRows: [currentRow("8d1e7387")],
  });
  assert.deepEqual(
    assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    ["pass-current-head", "pass-current-head"],
  );
});

test("履歴節のsame-HEAD証拠が別HEADのSHAを引いていれば落ちる", () => {
  const text = reviewRecordFixture({
    rows: [currentRow("60268813")],
    historyRows: [currentRow("92f795fd")],
  });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作"]),
    /history record 8d1e7387 ブラウザ操作 same-HEAD evidence SHA must match/,
  );
});

test("same-HEAD証拠にSHA併記がなければ落ちる", () => {
  const text = reviewRecordFixture({ rows: ["| ブラウザ操作 | pass-current-head | 画面でdrawerを一覧し逆引きできた |"] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PREFLIGHT.md", ["ブラウザ操作"]),
    /must cite the verified commit SHA/,
  );
});

test("未実施と書かれたsame-HEAD証拠は落ちる", () => {
  const text = reviewRecordFixture({ rows: ["| ブラウザ操作 | pass-current-head | `60268813` では未実施 |"] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PREFLIGHT.md", ["ブラウザ操作"]),
    /must be affirmative and complete/,
  );
});

test("未知のstatusのQA行は落ちる", () => {
  const text = reviewRecordFixture({ rows: ["| ブラウザ操作 | pass | `60268813` で確認済み |"] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PREFLIGHT.md", ["ブラウザ操作"]),
    /ブラウザ操作 uses an unknown status: pass/,
  );
});

test("QA行が1つもなければ落ちる", () => {
  const text = reviewRecordFixture({ rows: [currentRow("60268813")] });
  assert.throws(
    () => assertReviewRecordQaRows(text, "PUBLIC_READY.md", ["ブラウザ操作", "デザインQA"]),
    /PUBLIC_READY\.md current record QA evidence row is missing: デザインQA/,
  );
});

test("現在の節のcontent HEADが短縮SHAなら落ちる (履歴節を現在へ繰り上げない)", () => {
  assert.throws(
    () => extractRecordedContentHead(reviewRecordFixture({ head: "60268813" }), "PREFLIGHT.md"),
    /PREFLIGHT\.md must record its content HEAD as a full SHA: - content HEAD: `60268813`/,
  );
});

test("content HEADが大文字SHAなら落ちる", () => {
  const text = reviewRecordFixture({ head: RECORD_HEAD.toUpperCase() });
  assert.throws(() => extractRecordedContentHead(text, "PUBLIC_READY.md"), /must record its content HEAD as a full SHA/);
});

test("PREFLIGHTとPUBLIC_READYのcontent HEADがずれていれば落ちる", () => {
  assert.throws(
    () => assertReviewRecordHeadsAgree(RECORD_HEAD, PREFLIGHT_HISTORY_HEAD),
    /review record content HEAD drift/,
  );
});

const allowAllGit = () => ({ status: 0 });

test("実在しないcontent HEADは落ちる", () => {
  assert.throws(
    () => assertContentHeadReachable("PREFLIGHT.md", RECORD_HEAD, () => ({ status: 1 })),
    /PREFLIGHT\.md content HEAD does not exist in this repository/,
  );
});

test("実在しても現在HEADの祖先でなければ落ちる", () => {
  const runGit = (args) => ({ status: args[0] === "cat-file" ? 0 : 1 });
  assert.throws(
    () => assertContentHeadReachable("PUBLIC_READY.md", RECORD_HEAD, runGit),
    /PUBLIC_READY\.md content HEAD is not an ancestor of the current HEAD/,
  );
});

test("節が新しい順 (後ろほど古い) に並んでいれば通る", () => {
  const sections = [{ contentHead: RECORD_HEAD }, { contentHead: PREFLIGHT_HISTORY_HEAD }];
  assert.doesNotThrow(() => assertContentHeadLineage("PREFLIGHT.md", sections, allowAllGit));
});

test("新しい記録を末尾へ追記した文書は落ちる (古いpass節が現在へ繰り上がらない)", () => {
  // 末尾が新しい = 「古い節が新しい節の祖先」が成り立たない。
  const runGit = (args) =>
    args[0] === "merge-base" && args[2] === RECORD_HEAD && args[3] === PREFLIGHT_HISTORY_HEAD
      ? { status: 1 }
      : { status: 0 };
  const sections = [{ contentHead: PREFLIGHT_HISTORY_HEAD }, { contentHead: RECORD_HEAD }];
  assert.throws(
    () => assertContentHeadLineage("PREFLIGHT.md", sections, runGit),
    /history record 60268813 must be an ancestor of the newer record 8d1e7387/,
  );
});

test("squash mergeで破棄された履歴HEADは祖先判定を飛ばす (現在の記録は実在必須)", () => {
  // 8d1e7387 は実際にこのrepositoryから参照できない (当時のbranch commitがsquashで破棄された)。
  // 履歴に実在を必須にすると、当時の正直な記録を消さないとgateが通らなくなる。
  const runGit = (args) =>
    args[0] === "cat-file" && args[2].startsWith(PREFLIGHT_HISTORY_HEAD) ? { status: 1 } : { status: 0 };
  const sections = [{ contentHead: RECORD_HEAD }, { contentHead: PREFLIGHT_HISTORY_HEAD }];
  assert.doesNotThrow(() => assertContentHeadLineage("PREFLIGHT.md", sections, runGit));
});

test("現在の記録のcontent HEADが実在しなければ落ちる (履歴と違い必須)", () => {
  const runGit = (args) =>
    args[0] === "cat-file" && args[2].startsWith(RECORD_HEAD) ? { status: 1 } : { status: 0 };
  const sections = [{ contentHead: RECORD_HEAD }, { contentHead: PREFLIGHT_HISTORY_HEAD }];
  assert.throws(
    () => assertContentHeadLineage("PREFLIGHT.md", sections, runGit),
    /content HEAD does not exist in this repository/,
  );
});

test("同じcontent HEADを2回記録すると落ちる", () => {
  const sections = [{ contentHead: RECORD_HEAD }, { contentHead: RECORD_HEAD }];
  assert.throws(
    () => assertContentHeadLineage("PUBLIC_READY.md", sections, allowAllGit),
    /records the same content HEAD twice/,
  );
});

test("最初のcontent HEADより前に置いたrepo-preflight要約行は落ちる", () => {
  const text = `${BLOCKED_SUMMARY}\n${preflightFixture()}`;
  assert.throws(
    () => assertPreflightResultSections(text),
    /repo-preflight summary row must follow the content HEAD it describes/,
  );
});

const PREFLIGHT_HISTORY_HEAD = "8d1e738799ec6997eceb7133dd3a53b39e349c5b";
const PASS_SUMMARY = "| repo-preflight target diff | pass | machine-readable result v1 |";
const BLOCKED_SUMMARY = "| repo-preflight | blocked | commit_identity fail: 履歴名義2種が期待名義と不一致 |";

function completionRecord(contentHead, overrides = {}) {
  const evidence = {
    schemaVersion: 1, status: "pass", intent: "ready_after_confirmation", contentHead,
    secretCandidates: 0, personalPaths: 0, origin: "pass", cleanWorktree: true, ciConfigCount: 2,
    effectiveIdentity: "pass", historyMismatchCount: 2, effectiveMismatchCount: 0, ...overrides,
  };
  return ["<!-- repo-preflight-result:v1 -->", "```json", JSON.stringify(evidence), "```"].join("\n");
}

function preflightFixture({
  current = [BLOCKED_SUMMARY],
  history = [PASS_SUMMARY, "", completionRecord(PREFLIGHT_HISTORY_HEAD)],
} = {}) {
  return [
    "# Preflight review record",
    "",
    "## 現在の記録",
    "",
    `- content HEAD: \`${RECORD_HEAD}\``,
    "",
    ...current,
    "",
    "## 履歴記録",
    "",
    `- content HEAD: \`${PREFLIGHT_HISTORY_HEAD}\``,
    "",
    ...history,
    "",
  ].join("\n");
}

test("現在の記録がblockedでも完了記録を持たなければ通る (最新HEADにpass記録を要求しない)", () => {
  assert.deepEqual(assertPreflightResultSections(preflightFixture()), [
    { contentHead: RECORD_HEAD, status: "blocked", completed: false },
    { contentHead: PREFLIGHT_HISTORY_HEAD, status: "pass", completed: true },
  ]);
});

test("現在HEADのpass要約行と同じHEADの完了記録が対になっていれば通る", () => {
  const text = preflightFixture({ current: [PASS_SUMMARY, "", completionRecord(RECORD_HEAD)] });
  assert.equal(assertPreflightResultSections(text)[0].completed, true);
});

test("履歴の完了記録を現在の節へ流用した偽のpass記録は落ちる", () => {
  const text = preflightFixture({ current: [PASS_SUMMARY, "", completionRecord(PREFLIGHT_HISTORY_HEAD)] });
  assert.throws(
    () => assertPreflightResultSections(text),
    /current record repo-preflight-result:v1 contentHead drift: json=8d1e7387/,
  );
});

test("blocked要約行に現在HEADのpass完了記録を添えた偽の記録は落ちる", () => {
  const text = preflightFixture({ current: [BLOCKED_SUMMARY, "", completionRecord(RECORD_HEAD)] });
  assert.throws(
    () => assertPreflightResultSections(text),
    /current record completion record requires a pass summary row/,
  );
});

test("完了記録のないpass要約行は落ちる (履歴節の記録では代替できない)", () => {
  const text = preflightFixture({ current: [PASS_SUMMARY] });
  assert.throws(
    () => assertPreflightResultSections(text),
    /current record pass summary row requires a repo-preflight-result:v1 record for the same content HEAD/,
  );
});

test("status blockedのJSONを完了記録として置くと落ちる", () => {
  const text = preflightFixture({ current: [PASS_SUMMARY, "", completionRecord(RECORD_HEAD, { status: "blocked" })] });
  assert.throws(() => assertPreflightResultSections(text), /non-completed status token/);
});

test("履歴節の完了記録も自分の節のcontent HEADへ束縛される", () => {
  const text = preflightFixture({ history: [PASS_SUMMARY, "", completionRecord(RECORD_HEAD)] });
  assert.throws(
    () => assertPreflightResultSections(text),
    /history record 8d1e7387 repo-preflight-result:v1 contentHead drift/,
  );
});

test("最初のcontent HEADより前に置いた完了記録は落ちる", () => {
  const text = `${completionRecord(RECORD_HEAD)}\n${preflightFixture()}`;
  assert.throws(() => assertPreflightResultSections(text), /must follow the content HEAD it certifies/);
});

test("1つの節に完了記録が2つあれば落ちる", () => {
  const text = preflightFixture({
    current: [PASS_SUMMARY, "", completionRecord(RECORD_HEAD), "", completionRecord(RECORD_HEAD)],
  });
  assert.throws(() => assertPreflightResultSections(text), /current record must hold at most one repo-preflight-result:v1 block/);
});

test("1つの節に要約行が2つあれば落ちる", () => {
  const text = preflightFixture({ current: [BLOCKED_SUMMARY, PASS_SUMMARY] });
  assert.throws(() => assertPreflightResultSections(text), /current record must hold at most one repo-preflight summary row/);
});

test("現在の記録に要約行がなければ落ちる", () => {
  const text = preflightFixture({ current: ["| clean worktree | pass | 未コミット変更なし |"] });
  assert.throws(() => assertPreflightResultSections(text), /current record must hold a repo-preflight summary row/);
});

test("未知のstatusの要約行は落ちる", () => {
  const text = preflightFixture({ current: ["| repo-preflight | pass-local | 機械検査をローカルで実行した |"] });
  assert.throws(() => assertPreflightResultSections(text), /current record repo-preflight summary uses an unknown status: pass-local/);
});

test("失敗項目を書かないblocked要約行は落ちる", () => {
  const text = preflightFixture({ current: ["| repo-preflight | blocked | 失敗 |"] });
  assert.throws(() => assertPreflightResultSections(text), /current record blocked summary row must name the failing checks/);
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
