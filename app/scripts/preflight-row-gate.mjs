/**
 * PREFLIGHT.md の repo-preflight target diff 行が、完了観測か future/pending かを区別する。
 * verify-doc-boundaries と回帰テストが同じ判定を使う。
 */

const STATUS_VOCAB = /\b(pass|pending|blocked|ready_after_confirmation|fail)\b/;
const SHA_ONLY = /^[0-9a-f]{7,40}$/i;
const PASSING = /\bpass\b|ready_after_confirmation/;

/** pass 行に許さない future / pending / plan 言語 */
const FUTURE_OR_PENDING = new RegExp([
  "push前に",
  "未実施",
  "pending",
  "予定",
  "後で",
  "will\\b",
  "再測定する",
  "固定後に再測定",
  "再確認する",
  "を確認する",
  "を検査する",
  "確認する$",
  "検査する$",
].join("|"), "i");

/** pass 行に必須の完了観測フィールド（裸の secret では足りない） */
const COMPLETED_FIELDS = [
  [/live再測定|再測定した|観測した/, "completed measurement marker (live再測定/再測定した/観測した)"],
  [/secret候補\s*0/, "secret候補0"],
  [/個人path\s*0/, "個人path0"],
  [/origin\s*pass/, "origin pass"],
  [/clean worktree\s*pass/, "clean worktree pass"],
  [/CI設定\s*\d+/, "CI設定N件"],
];

export function assertPreflightTargetDiffRow(resultCell, evidenceCell) {
  const result = String(resultCell ?? "").trim();
  const evidence = String(evidenceCell ?? "").trim();

  if (!result || !evidence) {
    throw new Error("PREFLIGHT.md repo-preflight result and evidence cells must be non-empty");
  }
  if (SHA_ONLY.test(result)) {
    throw new Error("PREFLIGHT.md repo-preflight result must be an observed status, not only a content SHA");
  }
  if (!STATUS_VOCAB.test(result)) {
    throw new Error("PREFLIGHT.md repo-preflight result must use observed status vocabulary");
  }

  if (PASSING.test(result)) {
    if (FUTURE_OR_PENDING.test(evidence)) {
      throw new Error("PREFLIGHT.md repo-preflight pass evidence must not use future/pending plan language");
    }
    for (const [pattern, label] of COMPLETED_FIELDS) {
      if (!pattern.test(evidence)) {
        throw new Error(`PREFLIGHT.md repo-preflight pass must include completed observation: ${label}`);
      }
    }
  }
}
