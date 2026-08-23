# 公開準備チェック

最終更新: 2026-08-23

## 対象

- repository: `nexus-ai-2045/quiet-orchestrator-japan`
- 表示タイトル: 「静かなオーケストレーターとしての日本」
- 現在のvisibility: `PRIVATE`
- 準備branch: `codex/public-prep`
- public化、release、告知、応募フォーム編集はこの文書だけでは承認されない

## 公開候補ファイル

- `README.md`
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
| README情報設計 | pass | 目的、できること、クイックスタート、制約を確認 |
| UTF-8 / LF / 相対リンク | pass-before-export | 新repositoryで再検査する |
| 既知secret形式 / 個人絶対パス | pass-before-export | 新repositoryの全履歴で再検査する |
| 公式URL | partial | 23件はHTTP 200、3件はbot拒否のため掲載面を目視確認する |
| 第三者原典 | scoped | 公式URLと帰属のみ。原典ファイルを同梱しない |
| LICENSE / NOTICE | ready-for-review | MITと第三者原典の非再配布境界を確認する |
| SECURITY | provisional | public化前に非公開報告経路を確定する |
| repo-preflight | pending | content HEADとPREFLIGHT記録後に再実行する |
| ai-ratchet-gate | pass | baseline 0件、現在0件、新規0件 |
| 人間目視review | pending | README、権利、免責、公開全履歴を確認する |

## public化の停止線

public化候補コマンドは次のとおり。

```powershell
gh repo edit nexus-ai-2045/quiet-orchestrator-japan --visibility public
```

実行前に、target repository、コマンド、README、LICENSE、SECURITY、secret scan、personal path scan、PREFLIGHT、Webから見える全ファイルと全commit historyを再提示し、このrepository固有の明確な承認を得る。
