# GitHub設定計画

確認日: 2026-08-24

対象: `nexus-ai-2045/quiet-orchestrator-japan`

この文書は設定候補であり、GitHub設定の変更承認ではない。repositoryは2026-08-24にpublic化済み。remote設定は現在値を毎回read-backし、設定ごとに承認・適用・rollback確認を分離する。

## 現在値

| 設定 | 現在 |
|---|---|
| visibility | `PUBLIC` |
| default branch | `main` |
| 公開候補 | Draft PR #1 / `codex/public-prep`（main未merge） |
| Issues / Projects / Wiki / Discussions | on / on / off / off |
| merge方式 | merge commit / squash / rebaseがすべてon |
| merge後branch削除 | off |
| branch protection | rule 0件 |
| Actions | enabled、全Actionを許可、SHA pin必須ではない |
| vulnerability alerts | disabled |
| secret scanning / push protection | disabled / disabled |
| Dependabot security updates | disabled |
| Private Vulnerability Reporting | disabled |

## repo内で適用する設定

- CIとCodeQL workflowは第三者Actionを使わず、公式Actionをcommit SHAで固定する。
- Dependabotは`/app`のnpm依存を週次確認する。
- CODEOWNERS、PR template、不具合・モデル提案Issue formを追加する。
- CodeQL jobはrepositoryがpublicになった場合だけ実行する。

## remote設定の推奨値

### public化直後

- descriptionとtopicsを設定する。
- Projectsはoff、Issuesはon、WikiとDiscussionsはoffを維持する。
- squash mergeだけを許可し、merge後branchを自動削除する。
- vulnerability alertsとautomated security fixesを有効化する。
- secret scanning、push protection、Private Vulnerability Reportingを有効化する。
- ActionsはGitHub公式Actionだけを許可し、full commit SHA固定を必須化する。
- READMEと`PUBLIC_READY.md`の公開後状態をDraft PRで更新する。

### Draft PRの新HEADでCIが成功した後

- `main`にPull Requestと`validate` checkを必須化する。
- conversation resolutionとlinear historyを必須化する。
- force pushとbranch deletionを禁止する。
- 1人開発で自己mergeを不可能にしないため、必須approval数は0とする。人間reviewは運用ゲートで保持する。

branch protection payload候補は[main-branch-protection.json](../.github/settings/main-branch-protection.json)に置く。

### merge後

- `main`上のREADME、LICENSE、SECURITY、PUBLIC_READYを匿名表示面で確認する。
- CodeQL、Dependabot、community profile、security controlsをread-backする。
- release、デプロイ、告知は別承認にする。

## 現在の停止線

public化は成立済み。以後のpush、設定変更、PRのDraft解除、merge、release、デプロイ、告知は、それぞれ対象と外部影響を再掲した別承認を必要とする。
