<!-- repo-preflight:review-record -->

# Preflight review record

## 検査対象

- repository: `nexus-ai-2045/quiet-orchestrator-japan`
- branch: `codex/design-roadmap-2045`
- content HEAD: `5f4fd70cfd77c3f04e30f0f49144d5eadb14aac7`
- base: `origin/main@105e67f7b5bf76d4375d65f1c0d66fb5bec17d6e`
- inspected at: `2026-08-25T02:21:33Z`
- intended audience: public repositoryのPull Request reviewer
- expected identity: `nexus_ai <273569186+nexus-ai-2045@users.noreply.github.com>`

この記録自体はcontent HEADの後続commitとして追加する。content HEADと記録commitを同一とみなさず、外部操作の直前に最終HEADでpreflightを再実行する。

## 機械検査

| 検査 | 結果 | 証拠・限界 |
|---|---|---|
| repo-preflight target diff | pass / ready-after-confirmation | secret候補0、個人path0、origin、clean worktree、CI設定2件、作者・committer名義一致 |
| 決定論テスト | pass | `npm test`: 14件pass。最終metric状態からの実delta、fatigue/clamp後のtradeoff、未記録checkpointの進行停止を回帰固定 |
| Sites互換テスト | pass | `npm run test:sites`: 4件pass |
| production build | pass | Vite 6.4.3、192 modules、Sites package生成 |
| 依存脆弱性監査 | pass-current | `npm audit --audit-level=high`: 0 vulnerabilities |
| 架空係数v0 | pass-local | version、代表初期値、検証delta、危機寄与weight、deep-freezeを回帰テストで固定 |
| ブラウザ操作・デザインQA | pass-local | 2030未記録checkpointで進行停止、stress記録後の再開、2038 fatigue後の開示コスト・監視化リスク`+1`表示を実操作。console error/warning 0件。既存の標準幅・880px確認とaxe violations 0件も維持 |
| ai-ratchet-gate | pass | baseline 0件、現存0件、新規0件。baseline変更なし |
| GitHub repository read-back | pass | visibility `PUBLIC`、default branch `main@105e67f`、archived `false` |
| GitHub PR / Codex review | partial-remote | PR #4は`f85baeb`でOPEN / MERGEABLE。同一HEADのCodex review P2 3件をcontent HEAD `5f4fd70`でローカル修正。新HEAD reviewはpush後に回収する |
| remote CI | pass-remote-old-head / pending-correction-head | `f85baeb`のvalidate / CodeQL workflow / CodeQL checkは成功。`5f4fd70`以降のremote CIは未実施 |

## 採用済みの人間判断

- 代表接続の初期値、5施策の接続delta、危機寄与weightを、ハッカソン体験検証用の架空係数v0として採用する。
- 現行UIの情報密度とREADME画像を採用する。
- 公開名義を`nexus_ai <273569186+nexus-ai-2045@users.noreply.github.com>`として検査する。

採用範囲と変更ゲートは[ADR-0008](docs/adr/0008-causal-vertical-slice.md)および[架空係数 Calibration v0](docs/calibration-v0.md)を正本とする。

## repo-preflightの保証と非保証

保証するのは、選択したtarget diffのローカルGit、既知secret候補、個人path、作者名義、origin、CI設定等の機械検査である。

次は保証しない。

- 独自形式、符号化、大容量blob、バイナリ内を含む秘密情報の完全な不存在
- 第三者素材の権利・ライセンス判断
- remote CI、branch protection、review必須、Actions権限のP1 exact HEADでの現在状態
- README、免責、公開全履歴のGitHub上での最終目視
- push、PR、merge、release、告知の承認

## 収録・除外境界

- 片山俊大氏の構想ペーパーは、公式掲載URLと必要最小限の帰属だけを収録する。
- PRIVATE内部SSOTのGit履歴、knowledge、DOCX、内部PDF、タスク記録は含めない。
- 画面内の数値と試験結果は架空であり、経験的に較正された予測ではない。
- 実在組織の公開役割はモデル化の参照であり、非公開の指揮系統や将来行動を再現しない。

## 次の停止線

1. 記録commitを追加し、PR #4へcontent HEAD `5f4fd70`以降をfast-forward pushする。
2. push後、同一HEADのremote CI、CodeQL、Codex再review、GitHub差分、権利・免責を回収する。
3. unresolved thread 0件と通常ruleset充足を確認してmergeする。branch/worktree削除、release、告知は対象外。

この記録はpush、PR、merge、release、応募、告知の承認ではない。
