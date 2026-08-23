# GitHub設定計画

確認日: 2026-08-24

対象: `nexus-ai-2045/quiet-orchestrator-japan`

この文書は設定候補であり、GitHub設定の変更承認ではない。repo内のworkflowとテンプレートを先にreviewし、remote設定はPRIVATE branchのCI確認後、public化の前後に分けて適用する。

## 現在値

| 設定 | 現在 |
|---|---|
| visibility | `PRIVATE` |
| default branch | `main` |
| Issues / Projects / Wiki / Discussions | on / on / off / off |
| merge方式 | merge commit / squash / rebaseがすべてon |
| merge後branch削除 | off |
| branch protection | rule 0件 |
| Actions | enabled、全Actionを許可、SHA pin必須ではない |
| vulnerability alerts | disabled |

## repo内で適用する設定

- CIとCodeQL workflowは第三者Actionを使わず、公式Actionをcommit SHAで固定する。
- Dependabotは`/app`のnpm依存を週次確認する。
- CODEOWNERS、PR template、不具合・モデル提案Issue formを追加する。
- CodeQL jobはrepositoryがpublicになった場合だけ実行する。

## remote設定の推奨値

### public化前

- descriptionとtopicsを設定する。
- Projectsはoff、Issuesはon、WikiとDiscussionsはoffを維持する。
- squash mergeだけを許可し、merge後branchを自動削除する。
- vulnerability alertsとautomated security fixesを有効化する。
- ActionsはGitHub公式Actionだけを許可する。

### CIがmainで成功した後

- `main`にPull Requestと`validate` checkを必須化する。
- conversation resolutionとlinear historyを必須化する。
- force pushとbranch deletionを禁止する。
- 1人開発で自己mergeを不可能にしないため、必須approval数は0とする。人間reviewは運用ゲートで保持する。

branch protection payload候補は[main-branch-protection.json](../.github/settings/main-branch-protection.json)に置く。

### public化後

- Private Vulnerability Reporting、secret scanning、push protectionの利用可能状態をread-backする。
- CodeQL初回結果、Dependabot、community profileを確認する。

## visibility変更の停止線

候補コマンド:

```powershell
gh repo edit nexus-ai-2045/quiet-orchestrator-japan --visibility public
```

実行前にREADME、LICENSE、SECURITY、secret scan、personal path scan、PUBLIC_READY、PREFLIGHT、全commit historyを再提示し、このrepository固有の明確な承認を得る。
