# 公開準備チェック

最終更新: 2026-08-24

## 対象

- repository: `nexus-ai-2045/quiet-orchestrator-japan`
- 表示タイトル: 「静かなオーケストレーターとしての日本」
- 現在のvisibility: `PUBLIC`（2026-08-24 live確認）
- 準備branch: `codex/public-prep`
- default branch: `main`（初期commit。公開候補はDraft PR #1で未merge）
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
- `docs/images/simulator-preview.jpg`
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
| Webアプリ | pass-local | 決定論テスト4件、build、Sites互換テスト4件を確認 |
| ブラウザ操作 | pass-local | 年次更新、72時間テスト、比較を内蔵ブラウザで確認 |
| デザインQA | pass-local | 実装スクリーンショットと`design-qa.md`を確認。主要操作と1265px表示のP2修正済み |
| UTF-8 / LF / 相対リンク | pass-local | 53ファイル、Markdown 24件、相対リンク切れ0、conflict marker 0 |
| 既知secret形式 / 個人絶対パス | pass-local | 成果物内の既知secret候補0、個人絶対パス0。worktree管理用`.git`は公開対象外 |
| 公式URL | pass-source-check | 23件のHTTP到達に加え、bot拒否3件を公式検索結果と掲載面で確認。米統合軍の名称復帰と海警法URLを修正 |
| 第三者原典 | scoped | 公式URLと帰属のみ。原典ファイルを同梱しない |
| LICENSE / NOTICE | ready-for-review | MITと第三者原典の非再配布境界を確認する |
| SECURITY / threat model | pass-local / pending-remote | ライブAPIなし。secret scanning、push protection、Private Vulnerability Reportingは公開後も未設定 |
| CI / repository設定 | pass-local / blocked-remote | YAML 6件・JSON 1件をparse。公式ActionをSHA固定。直近CIは課金・spending limitによりstep開始前にfailure、CodeQLはprivate時点の条件でskip |
| repo-preflight | needs-human-input | 必須文書、secret候補0、個人path0、README設計はpass。初期commitのGitHub committerとremote CIを人間判断へ返す |
| ai-ratchet-gate | pass-local | baseline 0件、現存0件、新規0件 |
| 人間目視review | pending | README、権利、免責、公開全履歴を確認する |

## public化後の実測と停止線

- repository visibilityは`PUBLIC`。
- `main`は初期commitのまま。実装、SECURITY.md、PUBLIC_READY.md、視覚改善READMEはDraft PR #1のbranchで公開中。
- secret scanning、push protection、Dependabot security updates、vulnerability alerts、Private Vulnerability Reporting、default branch rulesetは未設定。
- merge、設定変更、workflow再実行、release、告知はそれぞれ別の人間承認を必要とする。

公開後lockdownは、設定ごとに現在値・正確なAPI操作・外部影響・rollbackを提示し、承認された項目だけ適用してread-backする。
