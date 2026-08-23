# 公開準備チェック

最終更新: 2026-08-24

## 対象

- repository: `nexus-ai-2045/quiet-orchestrator-japan`
- 表示タイトル: 「静かなオーケストレーターとしての日本」
- 現在のvisibility: `PRIVATE`
- 準備branch: `codex/public-prep`
- public化、release、告知、応募フォーム編集はこの文書だけでは承認されない

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
| README情報設計 | pass-local | 2045ゴール、二重時間軸、実行手順、制約を確認 |
| Webアプリ | pass-local | 決定論テスト4件、build、Sites互換テスト4件を確認 |
| ブラウザ操作 | pass-local | 年次更新、72時間テスト、比較を内蔵ブラウザで確認 |
| デザインQA | pass-local | 実装スクリーンショットと`design-qa.md`を確認。主要操作と1265px表示のP2修正済み |
| UTF-8 / LF / 相対リンク | pass-local | 53ファイル、Markdown 24件、相対リンク切れ0、conflict marker 0 |
| 既知secret形式 / 個人絶対パス | pass-local | 成果物内の既知secret候補0、個人絶対パス0。worktree管理用`.git`は公開対象外 |
| 公式URL | pass-source-check | 23件のHTTP到達に加え、bot拒否3件を公式検索結果と掲載面で確認。米統合軍の名称復帰と海警法URLを修正 |
| 第三者原典 | scoped | 公式URLと帰属のみ。原典ファイルを同梱しない |
| LICENSE / NOTICE | ready-for-review | MITと第三者原典の非再配布境界を確認する |
| SECURITY / threat model | ready-for-review | ライブAPIなし。Private Vulnerability Reportingはvisibility変更後に確認 |
| CI / repository設定 | pass-local / pending-remote | YAML 6件・JSON 1件をparse。公式ActionをSHA固定。CI、CodeQL、Dependabot、Issue/PR template、branch protection候補を追加 |
| repo-preflight | pass / ready-after-confirmation | content HEAD `8f9b350`の必須文書、secret、個人path、origin、CI設定2件はpass。push intentの明示確認待ち |
| ai-ratchet-gate | pass-local | baseline 0件、現存0件、新規0件 |
| 人間目視review | pending | README、権利、免責、公開全履歴を確認する |

## public化の停止線

public化候補コマンドは次のとおり。

```powershell
gh repo edit nexus-ai-2045/quiet-orchestrator-japan --visibility public
```

実行前に、target repository、コマンド、README、LICENSE、SECURITY、secret scan、personal path scan、PREFLIGHT、Webから見える全ファイルと全commit historyを再提示し、このrepository固有の明確な承認を得る。
