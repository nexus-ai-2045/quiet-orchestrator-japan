/**
 * verify-doc-boundaries.mjs から切り出した純粋判定関数。
 *
 * 切り出しの理由: gate 本体は top-level await と固定パスIOで構成されており、
 * fixture を差し込めないため回帰テストが書けなかった。検知器そのものに検知器が
 * 無い状態だと、gate が緩む方向の変更を誰も止められない。
 *
 * IO (readFile / readdir / spawnSync) は呼び出し側に残し、ここは文字列と配列だけを扱う。
 * 同じ形式の先例は preflight-row-gate.mjs。
 */

export const DRAWER_EVIDENCE_GATES = Object.freeze([
  "standard-width",
  "narrow-880",
  "narrow-320",
  "keyboard-modal",
  "reduced-motion",
]);

const SHA_IN_OBSERVATION = /`([0-9a-f]{7,40})`/;

/**
 * RESULTS.md が記録する機械検証対象 content HEAD を取り出す。
 * 実在確認と祖先確認は git を引く呼び出し側の責務。
 */
export function extractRecordedResultsHead(resultsText) {
  const recorded = String(resultsText ?? "").match(/^機械検証対象content HEAD: `([0-9a-f]{40})`/m)?.[1];
  if (!recorded) {
    throw new Error("RESULTS.md must record the machine-verified content HEAD as a full SHA");
  }
  return recorded;
}

/**
 * drawer UIゲートの証拠行を検査する。
 *
 * same-HEAD (pass-current-head) を主張する行は、検証したcommit SHAを併記し、
 * かつそれが記録済みcontent HEADと同一commitを指していなければならない。
 * 形式だけを見ていた頃は、実在しない `deadbee` のような文字列でも通っていた。
 *
 * @returns {string[]} 各gateのstatus (呼び出し側が履歴証拠の残存判定に使う)
 */
export function assertDrawerEvidenceRows(resultsText, recordedResultsHead) {
  const results = String(resultsText ?? "");
  const statuses = [];
  for (const gate of DRAWER_EVIDENCE_GATES) {
    const row = results.match(
      new RegExp(`^\\| ${gate} \\| (pass-historical-head|pass-current-head) \\| ([^|]+) \\|$`, "m"),
    );
    if (!row) throw new Error(`RESULTS.md drawer evidence row is missing or uses an unknown status: ${gate}`);
    const [, status, observation] = row;
    statuses.push(status);
    if (/未確認|pending|未実施/.test(observation) || observation.trim().length < 8) {
      throw new Error(`RESULTS.md drawer evidence must be affirmative and complete: ${gate}`);
    }
    if (status !== "pass-current-head") continue;
    const citedSha = observation.match(SHA_IN_OBSERVATION)?.[1];
    if (!citedSha) {
      throw new Error(`RESULTS.md same-HEAD drawer evidence must cite the verified commit SHA: ${gate}`);
    }
    if (!recordedResultsHead || !recordedResultsHead.startsWith(citedSha)) {
      throw new Error(
        `RESULTS.md same-HEAD drawer evidence SHA must match the recorded content HEAD: ${gate}`,
      );
    }
  }
  return statuses;
}

/** 履歴証拠が残っている間だけ、same-HEAD証拠と混同しない注記を要求する。 */
export function assertHistoricalEvidenceNote(resultsText, drawerEvidenceStatuses) {
  if (!drawerEvidenceStatuses.includes("pass-historical-head")) return;
  const results = String(resultsText ?? "");
  if (!results.includes("履歴content HEAD") || !results.includes("same-HEAD証拠には数えない")) {
    throw new Error("RESULTS.md must keep historical drawer evidence distinct from same-HEAD evidence");
  }
}

/** README実装構成ツリーが app/src 直下の実体を漏れなく載せていることを照合する。 */
export function assertReadmeImplementationTree(readmeText, sourceModules) {
  const tree = String(readmeText ?? "").match(/## 実装構成\n\n```text\n([\s\S]*?)\n```/)?.[1];
  if (!tree) throw new Error("README.md must keep the 実装構成 tree block");
  for (const moduleName of sourceModules) {
    if (!tree.includes(moduleName)) {
      throw new Error(`README implementation tree missing app/src module: ${moduleName}`);
    }
  }
}

/** ADR索引が docs/adr の実体を漏れなく載せていることを照合する。 */
export function assertAdrIndex(adrIndexText, adrFileNames) {
  if (adrFileNames.length === 0) throw new Error("docs/adr must contain numbered ADR files");
  const index = String(adrIndexText ?? "");
  for (const adrFile of adrFileNames) {
    if (!index.includes(adrFile)) {
      throw new Error(`docs/adr/README.md must index the ADR: ${adrFile}`);
    }
  }
}

/**
 * 危機局面名は実装の CRISIS_PHASES が正本で、契約がそれを説明する。
 * 他の文書が局面名の並びを複製すると、実装が変わったときにそこだけ古くなる。
 * 実際に product-architecture.md を直した際 ROADMAP.md を取りこぼし、
 * 実装と食い違う旧局面名が「main統合済み」の節に残った。
 *
 * @param crisisSource app/src/crisis.js の中身
 * @param docs [name, text] の配列。契約以外の文書を渡す
 */
export function assertCrisisPhaseNamesNotDuplicated(crisisSource, docs) {
  const phaseNames = [...String(crisisSource ?? "").matchAll(/name:\s*"([^"]+)"/g)].map(([, name]) => name);
  if (phaseNames.length === 0) throw new Error("app/src/crisis.js must declare CRISIS_PHASES names");
  for (const [name, text] of docs) {
    const content = String(text ?? "");
    const duplicated = phaseNames.filter((phase) => content.includes(phase));
    // 3つ以上の局面名が同居していれば、局面列の複製とみなす。
    if (duplicated.length >= 3) {
      throw new Error(
        `${name} duplicates the crisis phase sequence owned by simulation-contract.md: ${duplicated.join("/")}`,
      );
    }
  }
}
