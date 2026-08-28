# 公開準備チェック

最終更新: 2026-08-25

## 対象

- repository: `nexus-ai-2045/quiet-orchestrator-japan`
- 表示タイトル: 「静かなオーケストレーターとしての日本」
- 現在のvisibility: `PUBLIC`（2026-08-24 live確認）
- 準備branch: `codex/design-roadmap-2045`
- default branch: `main@105e67f`（P0公開基準点）。P1はPR #4でreview中
- merge、repository設定変更、release、告知、応募フォーム編集はこの文書だけでは承認されない

## 公開候補ファイル

- `README.md`
- `ROADMAP.md`
- `RESULTS.md`
- `app/`（実行可能なローカルWebアプリ、lockfile、テスト）
- `.github/`（CI、CodeQL、Dependabot、CODEOWNERS、Issue/PR template、設定候補）
- `docs/adr/`
- `docs/design-system.md`
- `docs/threat-model.md`
- `docs/github-settings-plan.md`
- `docs/design/selected-ui-concept.png`
- `docs/images/simulator-preview-causal-slice.png`
- `docs/calibration-v0.md`
- `simulation-contract.md`
- `evidence.md`
- `official-sources.md`
- `NOTICE.md`
- `SECURITY.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `PREFLIGHT.md`（検査対象HEADを記録して後続commitで追加）
- `.ai-ratchet-gate/baseline.txt`（人間確認済みの0件をbaseline化）

## 除外境界

- PRIVATE内部SSOT `nexus-ai-2045/meta-security-sim` のGit履歴、knowledge、タスク記録
- 片山氏構想ペーパーのローカルDOCX、内部要約PDF
- 認証情報、個人情報、絶対パス、非公開URL
- 実在組織の非公開運用・作戦情報、断定的な攻撃帰属

## 検査状態

| 項目 | 状態 | 備考 |
|---|---|---|
| README情報設計 | pass-local / pending-main | 実画面hero、要点表、二重時間軸の因果図、実行手順、制約を確認。main反映はPR merge後 |
| Webアプリ | pass-local | 決定論テスト18件、build 192 modules、Sites互換テスト4件を確認 |
| ブラウザ操作 | pass-local | 2030未記録checkpointの進行停止・stress記録後の再開、2038 fatigue後の実tradeoff`+1`を確認。既存の逆引き、標準幅・880px、axe violations 0件を維持。実行時error・warning 0件 |
| デザインQA | pass-local | 実装スクリーンショットと`design-qa.md`を確認。主要操作と1265px表示のP2修正済み |
| UTF-8 / LF / 相対リンク | pass-local | 53ファイル、Markdown 24件、相対リンク切れ0、conflict marker 0 |
| 既知secret形式 / 個人絶対パス | pass-local | 成果物内の既知secret候補0、個人絶対パス0。worktree管理用`.git`は公開対象外 |
| 公式URL | pass-source-check | 23件のHTTP到達に加え、bot拒否3件を公式検索結果と掲載面で確認。米統合軍の名称復帰と海警法URLを修正 |
| 第三者原典 | scoped | 公式URLと帰属のみ。原典ファイルを同梱しない |
| LICENSE / NOTICE | ready-for-review | MITと第三者原典の非再配布境界を確認する |
| SECURITY / threat model | pass-local / pass-remote | secret scanning、push protection、vulnerability alerts、Private Vulnerability Reportingを有効化してread-back済み |
| CI / repository設定 | pass-pr4 / pending-integrated-head | PR #4 `c2eeaf3`はvalidate / CodeQL workflow / CodeQL check成功。SSOT統合HEADは未push |
| repo-preflight | pending-integrated-final | PR #4実装と事前設計SSOTのlocal統合後、secret、個人path、公開名義、CI設定を最終HEADで再確認する |
| ai-ratchet-gate | pass-local | baseline 0件、現存0件、新規0件 |
| 人間目視review | pending-integrated-final | PR #4のreview thread全8件はresolved、`c2eeaf3`への最新Codex reviewは重大指摘なし。SSOT統合HEADの同一HEAD reviewと公開差分は未確認 |

## public化後の実測と停止線

- repository visibilityは`PUBLIC`。
- `main@105e67f`はP0公開基準点。PR #4はremote `codex/design-roadmap-2045@c2eeaf3`でOPEN / CLEAN。
- PR #4のreview threadは全8件resolvedし、最新Codex reviewは重大指摘なし。事前設計SSOTを統合したlocal HEADのpublic pushと同一HEAD再reviewは未実施。
- secret scanning、push protection、Dependabot security updates、vulnerability alerts、Private Vulnerability Reportingは有効化・read-back済み。
- ActionsはGitHub公式Actionだけを許可し、full commit SHA固定を必須化済み。
- merge方式はsquashだけを許可し、merge後のremote branch自動削除を有効化済み。
- default branch rulesetの現在値はこのP1検査では再確認していない。PRのCI成功後に別承認で再測定する。
- mergeは今回のGO範囲で、同一HEAD CI・review、unresolved 0、通常ruleset充足後に限る。設定変更、workflow再実行、release、告知は対象外。

公開後lockdownは、設定ごとに現在値・正確なAPI操作・外部影響・rollbackを提示し、承認された項目だけ適用してread-backする。
