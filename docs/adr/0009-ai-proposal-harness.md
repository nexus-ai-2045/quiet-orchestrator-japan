# ADR-0009｜scripted Policy Engineで推論層の安全境界を先に固定する

- status: accepted
- date: 2026-08-29

## 文脈

将来、外部推論器をシミュレーションへ参加させる。一方、ADR-0002とシミュレーション契約は、年、能力、被害、評価値、権限、予算、状態遷移の正本を決定論コアに限定している。まず固定action表のscripted Policy Engineで、PDCAと安全境界を実測する。

ブラウザから外部APIを直接呼ぶと、APIキーの露出、ネットワーク障害によるデモ停止、モデル出力が状態の正解として扱われる危険が生じる。

## 判断

現MVPではAI/LLMを実装せず、固定action表から許可済みアクションを返すscripted Policy Engineを追加する。シミュレーターは各手でPlan（提案生成）、Do（検証後に決定論コアへ適用）、Check（state hash・台帳・gate確認）、Act（次観測を生成）を自動反復する。

```text
固定seedの観測
  → scripted policy提案（未信頼）
  → schema・主体・接続・action・input hash検証
  → ローカルorchestratorによる採否判定
  → 既存の決定論コア
  → 状態差分・因果台帳
```

- 現MVPは外部APIを呼ばず、ローカルの差し替え可能なscripted Policy Engineだけで完走する。
- 静的WebアプリはAPIキーを保持せず、検証済みの提案トレースだけを読み込む。
- policy出力は`fact | claim | inference | proposal`のうち`proposal`であり、シミュレーション結果ではない。
- 不正JSON、未知ID、権限違反、input hash不一致、timeoutは拒否する。デモ継続が必要な場合は、同じschemaを持つversion固定fixtureへfallbackする。
- engine version、model、prompt version、seed、input/output hash、validation結果、fallback理由をreceiptへ記録する。secretとraw認証情報は記録しない。

## Principle / Invariant / Detector / Repair / Evidence

- **Principle**: Policy Engineは提案だけを返す。状態の真実と遷移は決定論コアが所有する。
- **Invariant**: policy提案だけではstate、metrics、budget、ledgerを変更できない。
- **Detector**: schema、許可ID、主体権限、snapshot hash、secret scan、同一seed再生テストで境界違反を検知する。
- **Repair**: 応答を拒否し、理由をreceiptへ残し、固定fixtureまたは人間選択へ戻す。
- **Evidence**: JSONL receipt、検証済みproposal、既存因果台帳、同一seed/hash回帰を同じ実装HEADで保存する。

## 今日のMVP境界

代表接続`B1 ↔ C6`、固定seed、3主体×3ターンに限定する。全20接続の校正、18主体の自律会話、120ターン危機、A〜E比較、日本除去実動、MPC最適化、RAGは含めない。

同じvalidatorと固定seedのscripted Policy Engineで2〜3分のデモを完走できることを優先する。Google Cloud等は後から同じJSONL入出力を実行する配置先であり、状態正本にはしない。

## 帰結

- 将来の推論器の非決定性を、シミュレーション状態の再現性から隔離できる。
- scripted baselineと、将来の外部推論器を同じcontractで比較できる。
- 現MVPはAIの提案品質や、架空係数・政策効果の妥当性を証明しない。
- Google Cloud等への配置、公開提出、releaseはそれぞれ別の人間承認境界として残る。
