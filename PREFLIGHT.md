<!-- repo-preflight:review-record -->

# Preflight review record

## 検査対象

- repository: `nexus-ai-2045/quiet-orchestrator-japan`
- branch: `codex/run-bundle-v1`
- content HEAD: `46fc28de50eed63a0804c178d624557b2ee6f1b3`（M2〜M5ローカルMVP、因果seed修正、127件回帰、Sites 4件、build、audit 0。次のevidence commitで更新する）
- base: `origin/main@bdb9902b91cc98dedb4fdbc88d404ab99e2e6714`
- inspected date: `2026-08-30`（content HEAD commit後にlive再測定）
- intended audience: public repositoryのPull Request reviewer
- expected identity: `nexus_ai <273569186+nexus-ai-2045@users.noreply.github.com>`

この記録は上記content HEADの後続evidence commitとして追加する。content HEADと記録commitを同一とみなさず、外部操作の直前に最終HEADでpreflightを再実行する。

## 機械検査

| 検査 | 結果 | 証拠・限界 |
|---|---|---|
| repo-preflight target diff | pass | machine-readable result v1 |
| 決定論・AI・UI境界テスト | pass | `npm test`: 127件pass。M2〜M5、120ターン危機再生、A〜E・5 seed・2045年日本除去境界、権限拒否証拠、run bundle、台帳drawerを回帰固定 |
| Sites互換テスト | pass | `npm run test:sites`: 4件pass |
| production build | pass-current-branch | Vite 8.2.2 production build、Sites package生成 |
| 依存脆弱性監査 | pass-current | `npm audit --audit-level=high`: 0 vulnerabilities |
| 架空係数v0 | pass-local | version、代表初期値、検証delta、危機寄与weight、deep-freezeを回帰テストで固定 |
| ブラウザ操作・デザインQA | history-only-pr4 | 2026-08-28のPR #4系列で実操作済み。現在branchのsame-HEAD evidenceではなく、履歴証拠の詳細は`RESULTS.md`を参照 |
| ai-ratchet-gate | pass | baseline 0件、現存0件、新規0件。baseline変更なし |
| GitHub repository read-back | pass | visibility `PUBLIC`、default branch `main@bdb9902b`、archived `false` |
| GitHub PR / Codex review | pending-current-branch | 同一HEAD CI・reviewをPRで回収する。本記録はpush前のローカル証拠 |
| remote CI | pending-current-branch | merge済みPRの成功証拠は現在branchを代替しない。push後に同一HEADのvalidateとCodeQLを確認する |

<!-- repo-preflight-result:v1 -->
```json
{"schemaVersion":1,"status":"pass","intent":"ready_after_confirmation","contentHead":"46fc28de50eed63a0804c178d624557b2ee6f1b3","secretCandidates":0,"personalPaths":0,"origin":"pass","cleanWorktree":true,"ciConfigCount":2,"effectiveIdentity":"pass","historyMismatchCount":2,"effectiveMismatchCount":0}
```

このJSONブロックだけが完了判定の機械可読正本である。上の表は人間向け要約であり、任意の説明文を完了証拠として扱わない。

## 採用済みの人間判断

- 代表接続v0と残り19接続のarchetype校正v1を、ハッカソン体験検証用の架空係数として採用する。
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

1. 現在branchのcommitを固定し、push前preflightを再実行する。
2. 承認されたpush後、同一HEADのremote CI、CodeQL、Codex再review、GitHub差分、権利・免責を回収する。
3. unresolved thread 0件と通常ruleset充足を確認してmergeする。branch/worktree削除、release、告知は対象外。

この記録はpush、PR、merge、release、応募、告知の承認ではない。
