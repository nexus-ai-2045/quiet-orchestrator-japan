# PROJECT SSOT｜quiet-orchestrator-japan

## Canonical 宣言

`nexus-ai-2045/quiet-orchestrator-japan` は、「静かなオーケストレーターとしての日本」の設計、根拠、シミュレーション契約、実装、検証結果を管理する canonical repository である。

ローカルの別repo、作業用worktree、会話ログ、メモ、提案書は探索・来歴確認の対象にはなるが、この主題の現行仕様を上書きする正本にはしない。差分を採用するときは、内容をこのrepoの該当owner fileへ移し、検証してから正本化する。

## 正本の範囲

| 主題 | owner file | 正本として持つもの |
|---|---|---|
| 作品の入口と中心仮説 | `README.md` | 目的、二重時間軸、5機能、単一危機、制約。比較条件は事前実験設計への導線だけを持つ |
| 実験設計スナップショット | `EXPERIMENT_DESIGN.md` | 仮説、比較条件、評価軸、反証・縮小条件。初回実測に対する事前登録証拠ではない |
| 実行契約 | `simulation-contract.md` | 状態、seed、主体、回線、行動、再現条件、実装完了条件 |
| 観測根拠 | `evidence.md` | 観測事実、公式評価、設計推論の分離と更新規律 |
| URLと概念原典 | `official-sources.md` | 公式URL、役割参照、利用規律 |
| 実装計画 | `ROADMAP.md` | 実装フェーズ、依存関係、マイルストーン |
| 実測結果 | `RESULTS.md` | 同一HEADで再現した機械検証と、結論に使えない範囲 |
| 設計判断 | `docs/adr/` | 採用済み判断、帰結、非採用案 |
| 実装状態 | `app/src/` | 決定論エンジンとUI。DOMは状態の正本にしない |
| SSOT契約と移管来歴 | `PROJECT_SSOT.md` | canonical境界、移管台帳、更新手順 |

同じ事実や仕様を複数文書へ複製して独立更新しない。入口文書からowner fileへリンクし、数値や契約を変える場合はowner fileを先に更新する。

## ローカル集約台帳

2026-08-26に、ローカルの関連repo、worktree、設計セッション由来の記録を名称、中心仮説、危機因果鎖、固有の契約語で検索した。

| 候補 | 判定 | このSSOTでの扱い |
|---|---|---|
| `meta-security-sim` の旧 `docs/themes/03-japan-orchestrator/README.md`（commit `e8cf8ed`） | 吸収済み | 中心仮説、5機能、A〜E比較、18主体、根拠、反証条件は現行の `README.md`、`simulation-contract.md`、`evidence.md`、`official-sources.md` に分割して正本化済み。旧ファイルは来歴であり更新先にしない |
| 宇宙天気・時刻同期・電力AIの初期案 | 置換済み候補 | 現行の入力領域と単一危機へ採用しない。宇宙・エネルギー・AIは独立テーマではなく、海洋とサイバーの間を結ぶ接続ノードとして扱う |
| `codex/design-roadmap-2045` worktree | 吸収済み | 実装・検証差分はPR #4で`main`へ統合済み。worktreeと旧branchは来歴であり、現行SSOTは`main`上のowner fileと実装である |
| workspace側のSSOT registry | 外部索引 | このrepoを canonical と指す探索用索引。プロジェクト内容の正本ではなく、本ファイルと矛盾した場合は双方を人間レビューへ戻す |

旧成果物は削除しない。未追跡の判断が見つかった場合は、出典を記録して該当owner fileへ最小差分で移し、移管後にこの台帳へ `吸収済み` または `非採用` を追記する。

### 2026-10-26 旧SSOT集約枝の照合

旧枝 `old/codex/consolidate-quiet-orchestrator-ssot@14ed32a` と `old/main` の分岐点 `105e67f` からの差分（29コミット、28ファイル）を、新 `origin/main@ad87634` と照合した。旧枝そのものの未統合と、内容の未採用は区別する。新旧の履歴が連続しているとは扱わない。

照合時の `old/main@0a78138` と新基準点は、下表の対象について `RESULTS.md` 以外の内容が一致する。旧mainでは因果縦切り（`9fb74d1`）、校正検証（`6be43be`）、台帳drawer（`7fa6df8`）、ポートフォリオ（`bdb9902`）、M2〜M5（`d1c0859`）、文書境界修正（`1ee8f7c`〜`6026881`）が後続している。以下は移管判定であり、新たな設計採用や実測証拠ではない。

| 旧差分の対象 | 判定 | 新基準点での同等内容・移さない理由 |
|---|---|---|
| `.github/workflows/ci.yml` | 吸収済み | 文書境界検証を実行する構成が存在する。後続で履歴取得とSites証拠照合も追加されている |
| `AGENTS.md`、`app/AGENTS.md` | 吸収済み | 所有境界、実測drift検出、因果縦切り、段階的開示の規則が存在する |
| `PROJECT_SSOT.md` | 吸収済み | owner表、移管台帳、更新ゲートが存在する。旧worktreeの未統合扱いは後続で吸収済みに更新されている |
| `EXPERIMENT_DESIGN.md` | 吸収済み | 仮説、A〜E、反証条件、初回実測の事前登録証拠ではないという境界が同一内容で存在する |
| `PREFLIGHT.md`、`PUBLIC_READY.md`、`RESULTS.md` | 非採用（旧記録の再移植） | 旧枝のテスト件数、build、UI確認、公開状態、名義、PR状態、承認範囲は当時の記録。現行の証拠・停止線を古い値で上書きしない。新の実測来歴は新のRESULTSが所有する |
| `README.md` | 吸収済み・後続で置換 | 正本への導線、実行手順、因果縦切りの説明が存在する。代表接続だけを投資可能とする説明はM2〜M5の現状へ更新済み |
| `ROADMAP.md` | 吸収済み・後続で置換 | M1〜M7と公開段階の整理が存在する。旧P1ローカル候補・未実装一覧・当時の件数を戻さない |
| `app/index.html` | 吸収済み | 固有の日本語タイトルが同一内容で存在する |
| `app/package.json` | 吸収済み・後続で拡張 | Node経由build、baseline、文書検証、一括verifyが存在する。現行の追加テスト・Sites証拠検証を維持する |
| `app/scripts/run-baseline.mjs`、`app/tests/baseline-output.test.mjs` | 吸収済み・後続で置換 | design blob、実装revision、作業ツリー変更、seed、係数version、baseline値の照合が存在する。旧「主体制約・120イベント・比較未実装」という限界文は現行実装に合わせ更新済み |
| `app/scripts/verify-doc-boundaries.mjs` | 吸収済み・後続で拡張 | 設計と結果の境界、件数drift、設計記録の時系列制約を検査する。後続で証拠SHA、ADR索引、構成、局面名等の検査も追加済み |
| `app/src/App.jsx`、`app/src/styles.css` | 吸収済み・後続で拡張 | 状態由来の線、接続選択、投資preview、副作用、台帳、任意年結果、危機寄与の逆引きが存在する。後続のdrawer・全接続投資・比較・危機再生を旧画面に戻さない |
| `app/src/calibration-v0.js` | 吸収済み | 初期値、5施策、改善方向、危機・最終評価の重み、上限下限、deep freezeが存在する。後続の旧schema移行用不変snapshotも維持する |
| `app/src/simulation.js`、`app/tests/simulation.test.mjs` | 吸収済み・後続で置換 | 安定ID、状態schema、接続投資、実delta、疲労・clamp後のtradeoff、改善実現率、checkpoint進行停止、累積snapshot、任意年表示、逆引き、最終危機・日本撤退必須判定と回帰検査が存在する。旧schema v2への移行で履歴なしの集約状態から実行可能なsnapshotを作る挙動は、記録済みaction列の再実行が成立しなければ実行を拒否する契約へ強化済み。代表接続限定も現行ポートフォリオに置換済み |
| `docs/adr/0001-dual-timescale.md`、`docs/adr/0008-causal-vertical-slice.md`、`docs/adr/README.md` | 吸収済み | 30日への整合、因果縦切りの採用・非採用理由、係数変更手順と索引が存在する |
| `docs/calibration-v0.md` | 吸収済み | 架空係数、改善実現率、危機寄与、変更ゲートが存在する。後続で移行用snapshotの不変性を追記済み |
| `docs/design-system.md`、`docs/images/simulator-preview-causal-slice.png` | 吸収済み | 期間正本への導線と旧画像の位置づけ、因果縦切りの画像が同一内容で存在する。画像を再生成しない |
| `docs/product-architecture.md` | 吸収済み・後続で置換 | ゴール、因果モデル、画面設計、検証階層が存在する。台帳形状、危機局面の所有境界、実装済み範囲、モジュール分割案の位置づけは後続で整理済み |
| `simulation-contract.md` | 吸収済み・後続で拡張 | 実験設計・実測との所有分離、再現条件、P0の履歴上の限界と完成条件が存在する。後続の保存状態再実行・M4/M5実装契約を維持する |

追加移植が必要な実装・仕様は見つからなかったため、今回の変更はこの照合来歴だけとする。設計選択の迷いはなし。旧文書に残る未実装案は現行文書にも設計案として残っており、今回の移管を理由に実装済みへ昇格させない。

## 更新ゲート

1. 変更する主題のowner fileを特定する。
2. 観測事実、発表主体の評価、設計推論、ユーザー提案を分離する。
3. 実装変更は決定論エンジンのtest、build、必要なUI検証を同一HEADで実行する。
4. `RESULTS.md` は実測後だけ更新し、設計上の期待値を結果として書かない。
5. 派生repoやworktreeへ正本を増やさず、必要な差分はこのrepoへ戻す。
6. 公開、release、merge、visibility変更、外部提出はこのSSOT契約とは別の人間承認を必要とする。

## 非目標

- 他repoや履歴に残る旧成果物を自動削除すること。
- 現実の攻撃帰属、軍事作戦、外交・防衛政策の正解を提示すること。
- 一つのスコアや日本の中心性を成功条件にすること。
- localで見つかった記述を、根拠・公平性・反証条件の確認なしに取り込むこと。
