# PROJECT SSOT｜quiet-orchestrator-japan

## Canonical 宣言

`nexus-ai-2045/quiet-orchestrator-japan` は、「静かなオーケストレーターとしての日本」の設計、根拠、シミュレーション契約、実装、検証結果を管理する canonical repository である。

ローカルの別repo、作業用worktree、会話ログ、メモ、提案書は探索・来歴確認の対象にはなるが、この主題の現行仕様を上書きする正本にはしない。差分を採用するときは、内容をこのrepoの該当owner fileへ移し、検証してから正本化する。

## 正本の範囲

| 主題 | owner file | 正本として持つもの |
|---|---|---|
| 作品の入口と中心仮説 | `README.md` | 目的、二重時間軸、5機能、単一危機、比較条件、制約 |
| 実験仕様 | `simulation-contract.md` | 状態、seed、主体、回線、行動、評価、反証、完了条件 |
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
| `codex/design-roadmap-2045` worktree | 派生実装 | `main`からの実装・検証差分を持つ作業lane。mergeされるまで現行SSOTではなく、仕様判断はADRまたはowner fileへ戻す |
| workspace側のSSOT registry | 外部索引 | このrepoを canonical と指す探索用索引。プロジェクト内容の正本ではなく、本ファイルと矛盾した場合は双方を人間レビューへ戻す |

旧成果物は削除しない。未追跡の判断が見つかった場合は、出典を記録して該当owner fileへ最小差分で移し、移管後にこの台帳へ `吸収済み` または `非採用` を追記する。

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
