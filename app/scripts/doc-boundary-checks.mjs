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

import { parseCompletedPreflightEvidence } from "./preflight-row-gate.mjs";

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

const CONTENT_HEAD_LINE = /^- content HEAD: `([0-9a-f]{40})`/gm;
const CONTENT_HEAD_LINE_SHAPE = /^- content HEAD:.*$/gm;

/**
 * review record (PREFLIGHT.md / PUBLIC_READY.md) を `- content HEAD:` 行ごとの節へ分ける。
 * 記録は新しい検査を先頭へ追記し、過去の記録は書き換えずに後ろへ残す。
 * したがって先頭の節が現在の記録、以降が履歴である。
 * 各節の本文はその `- content HEAD:` 行から次の `- content HEAD:` 行の直前まで。
 *
 * 節境界はフル40桁小文字SHAの行だけが作る。短縮SHAや大文字を節境界として黙って
 * 読み飛ばすと、現在の記録が節として認識されず履歴の節が「現在」へ繰り上がる
 * (blockedの記録がpassの記録に化ける)。形だけ `- content HEAD:` の行は落とす。
 */
export function splitReviewRecordSections(documentText, documentName) {
  const text = String(documentText ?? "");
  const heads = [...text.matchAll(CONTENT_HEAD_LINE)];
  const headShapedLines = [...text.matchAll(CONTENT_HEAD_LINE_SHAPE)];
  if (headShapedLines.length !== heads.length) {
    const malformed = headShapedLines.find(
      (line) => !heads.some((head) => head.index === line.index),
    );
    throw new Error(
      `${documentName} must record its content HEAD as a full SHA: ${malformed[0].trim()}`,
    );
  }
  if (heads.length === 0) {
    throw new Error(`${documentName} must record its content HEAD as a full SHA`);
  }
  return {
    preamble: text.slice(0, heads[0].index),
    sections: heads.map((match, index) => ({
      contentHead: match[1],
      text: text.slice(match.index, heads[index + 1]?.index ?? text.length),
    })),
  };
}

/** 現在 (先頭) の節が記録する content HEAD。実在確認と祖先確認は git を引く呼び出し側の責務。 */
export function extractRecordedContentHead(documentText, documentName) {
  return splitReviewRecordSections(documentText, documentName).sections[0].contentHead;
}

const PREFLIGHT_RESULT_MARKER = "<!-- repo-preflight-result:v1 -->";
const PREFLIGHT_SUMMARY_ROW = /^\| repo-preflight[^|]* \| ([^|]+) \| ([^|]+) \|$/gm;
const COMPLETED_SUMMARY_NOTE = "machine-readable result v1";

/**
 * PREFLIGHT.md の repo-preflight 要約行と完了記録 (repo-preflight-result:v1) を節ごとに検査する。
 *
 * 以前のgateは「pass要約行と完了記録が文書のどこかにあり、そのcontentHeadが先頭のcontent HEAD
 * と一致する」ことを必須にしていた。これは「最新HEADは常にpass」という時点状態を焼き込み、
 * 実測がblockedのときに正直な記録を書く手段を奪う (偽のpass記録を書くか、古い記録を現在として
 * 残すかの二択になる)。必須にするのは次の不変条件だけにする。
 *
 * - 現在の節は要約行を1つ持ち、statusは `pass` か `blocked`。
 * - 完了記録は自分が属する節のcontent HEADをcontentHeadとして持つ (別HEADの記録を流用できない)。
 * - `pass` 要約行と完了記録は同じ節で対になる。`blocked` の節は完了記録を持てない。
 * - 最初のcontent HEADより前に完了記録を置けない (どのHEADの記録か決まらない)。
 *
 * @returns {{contentHead: string, status: string | undefined, completed: boolean}[]} 先頭が現在の節
 */
export function assertPreflightResultSections(documentText) {
  const name = "PREFLIGHT.md";
  const { preamble, sections } = splitReviewRecordSections(documentText, name);
  if (preamble.includes(PREFLIGHT_RESULT_MARKER)) {
    throw new Error(`${name} repo-preflight-result:v1 must follow the content HEAD it certifies`);
  }
  // 要約行も同じ理由でpreambleへ置けない。どのcontent HEADの要約か決まらないまま、
  // 読み手は文書の冒頭でその status を「現在の結果」として読む。
  if (PREFLIGHT_SUMMARY_ROW.test(preamble)) {
    PREFLIGHT_SUMMARY_ROW.lastIndex = 0;
    throw new Error(`${name} repo-preflight summary row must follow the content HEAD it describes`);
  }
  PREFLIGHT_SUMMARY_ROW.lastIndex = 0;
  const summaries = sections.map((section, index) => {
    const label = index === 0 ? "current record" : `history record ${section.contentHead.slice(0, 8)}`;
    const markerCount = section.text.split(PREFLIGHT_RESULT_MARKER).length - 1;
    if (markerCount > 1) {
      throw new Error(`${name} ${label} must hold at most one repo-preflight-result:v1 block`);
    }
    const rows = [...section.text.matchAll(PREFLIGHT_SUMMARY_ROW)];
    if (rows.length > 1) {
      throw new Error(`${name} ${label} must hold at most one repo-preflight summary row`);
    }
    const status = rows[0]?.[1].trim();
    const note = rows[0]?.[2].trim() ?? "";
    if (status !== undefined && status !== "pass" && status !== "blocked") {
      throw new Error(`${name} ${label} repo-preflight summary uses an unknown status: ${status}`);
    }
    if (markerCount === 1) {
      const evidence = parseCompletedPreflightEvidence(section.text);
      if (evidence.contentHead !== section.contentHead) {
        throw new Error(
          `${name} ${label} repo-preflight-result:v1 contentHead drift: json=${evidence.contentHead}, recorded=${section.contentHead}`,
        );
      }
      if (status !== "pass" || note !== COMPLETED_SUMMARY_NOTE) {
        throw new Error(`${name} ${label} completion record requires a pass summary row pointing to ${COMPLETED_SUMMARY_NOTE}`);
      }
    } else if (status === "pass") {
      throw new Error(`${name} ${label} pass summary row requires a repo-preflight-result:v1 record for the same content HEAD`);
    }
    if (status === "blocked" && note.length < 8) {
      throw new Error(`${name} ${label} blocked summary row must name the failing checks`);
    }
    return { contentHead: section.contentHead, status, completed: markerCount === 1 };
  });
  if (summaries[0].status === undefined) {
    throw new Error(`${name} current record must hold a repo-preflight summary row`);
  }
  return summaries;
}

const HISTORICAL_QA_STATUS = /^history-only-[a-z0-9-]+$/;
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * review record (PREFLIGHT / PUBLIC_READY) のブラウザ操作・デザインQA行を検査する。
 *
 * 以前のgateは `history-only-pr4` という時点状態のリテラルを必須にしていた。
 * それでは同じHEADで画面を再検証しても記録を更新できず、merge済みで参照不能な
 * 過去branchの状態を文書へ凍結してしまう。必須にするのは不変条件だけにする。
 *
 * 各行は次のどちらかでなければならない。
 * - 履歴証拠: `history-only-<ラベル>` で、same-HEAD証拠ではないと明記する
 * - same-HEAD証拠: `pass-current-head` で、先頭に検証したcommit SHAを併記し、
 *   それが記録済みcontent HEADと同じcommitを指す (drawer証拠行と同じ規則)
 *
 * @param rowLabels 表の1列目に置く検査名
 * @returns {string[]} 見つかった全行のstatus
 */
export function assertReviewRecordQaRows(documentText, documentName, rowLabels) {
  const { sections } = splitReviewRecordSections(documentText, documentName);
  const statuses = [];
  for (const [index, section] of sections.entries()) {
    const scope = index === 0 ? "current record" : `history record ${section.contentHead.slice(0, 8)}`;
    for (const label of rowLabels) {
      const rows = [...section.text.matchAll(new RegExp(`^\\| ${escapeRegExp(label)} \\| ([^|]+) \\| ([^|]+) \\|$`, "gm"))];
      if (rows.length === 0) {
        // 必須なのは現在の記録の行。履歴の節は当時の表のままでよい。
        if (index === 0) throw new Error(`${documentName} current record QA evidence row is missing: ${label}`);
        continue;
      }
      for (const [, rawStatus, observation] of rows) {
        const status = rawStatus.trim();
        statuses.push(status);
        if (HISTORICAL_QA_STATUS.test(status)) {
          if (!observation.includes("same-HEAD evidenceではなく")) {
            throw new Error(`${documentName} ${scope} ${label} must classify inherited evidence as historical`);
          }
          continue;
        }
        if (status !== "pass-current-head") {
          throw new Error(`${documentName} ${scope} ${label} uses an unknown status: ${status}`);
        }
        if (/未確認|pending|未実施/.test(observation) || observation.trim().length < 8) {
          throw new Error(`${documentName} ${scope} ${label} same-HEAD evidence must be affirmative and complete`);
        }
        const citedSha = observation.match(SHA_IN_OBSERVATION)?.[1];
        if (!citedSha) {
          throw new Error(`${documentName} ${scope} ${label} same-HEAD evidence must cite the verified commit SHA`);
        }
        if (!section.contentHead.startsWith(citedSha)) {
          throw new Error(`${documentName} ${scope} ${label} same-HEAD evidence SHA must match the content HEAD of its own record`);
        }
      }
    }
  }
  return statuses;
}

/** PREFLIGHT と PUBLIC_READY は同じcontent HEADを現在の記録として指していなければならない。 */
export function assertReviewRecordHeadsAgree(preflightHead, publicReadyHead) {
  if (preflightHead !== publicReadyHead) {
    throw new Error(
      `review record content HEAD drift: PREFLIGHT=${preflightHead}, PUBLIC_READY=${publicReadyHead}`,
    );
  }
}

/**
 * 記録されたcontent HEADは実在し、現在HEADの祖先でなければならない。
 * 実在確認だけでは、mainへ統合されていないcommitでも通ってしまう。
 * same-HEAD証拠のSHA照合は文字列上の一致しか見ないため、この実在・祖先確認と組で成立する。
 * git実行は呼び出し側が `runGit(args) => {status}` として注入する (テスト可能にするため)。
 */
export function assertContentHeadReachable(documentName, contentHead, runGit) {
  if (runGit(["cat-file", "-e", `${contentHead}^{commit}`]).status !== 0) {
    throw new Error(`${documentName} content HEAD does not exist in this repository: ${contentHead}`);
  }
  if (runGit(["merge-base", "--is-ancestor", contentHead, "HEAD"]).status !== 0) {
    throw new Error(`${documentName} content HEAD is not an ancestor of the current HEAD: ${contentHead}`);
  }
}

/**
 * 節の並びが「先頭が現在、後ろほど古い」であることをgitで確認する。
 *
 * 「先頭が現在」を規約のままにすると、新しい記録を末尾へ追記した文書が素通りし、
 * 古いpassの節が現在の記録として読まれる。順序は規約ではなく祖先関係で決める。
 */
export function assertContentHeadLineage(documentName, sections, runGit) {
  // 現在の記録だけは実在と祖先を必須にする。ここが緩むと、記録が指すHEADを誰も再現できない。
  assertContentHeadReachable(documentName, sections[0].contentHead, runGit);
  for (const [index, section] of sections.entries()) {
    if (index === 0) continue;
    const newer = sections[index - 1];
    if (newer.contentHead === section.contentHead) {
      throw new Error(`${documentName} records the same content HEAD twice: ${section.contentHead}`);
    }
    // 履歴のcontent HEADはsquash mergeで破棄され、このrepositoryから参照できないことがある
    // (RESULTS.mdが同じ事象を記録している)。実在しないcommitの祖先関係は判定できないので飛ばす。
    // 実在を必須にすると、当時の正直な記録を後から消さないと通らなくなる。
    if (runGit(["cat-file", "-e", `${section.contentHead}^{commit}`]).status !== 0) continue;
    if (runGit(["merge-base", "--is-ancestor", section.contentHead, newer.contentHead]).status !== 0) {
      throw new Error(
        `${documentName} history record ${section.contentHead.slice(0, 8)} must be an ancestor of the newer record ${newer.contentHead.slice(0, 8)}`,
      );
    }
  }
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
