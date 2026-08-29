# ADR-0009｜AIは提案し、決定論コアだけが状態を更新する

- status: accepted
- date: 2026-08-29

## 文脈

ハッカソンのデモでは、架空シナリオをAIが読み、シミュレーションへ参加するところまでを短時間で示す必要がある。一方、ADR-0002とシミュレーション契約は、年、能力、被害、評価値、権限、予算、状態遷移の正本を決定論コアに限定している。

ブラウザから外部APIを直接呼ぶと、APIキーの露出、ネットワーク障害によるデモ停止、モデル出力が状態の正解として扱われる危険が生じる。

## 判断

AIを状態更新者ではなく、観測を解釈して許可済みアクションを提案する`DecisionEngine`として追加する。

```text
固定seedの観測
  → AI応答（未信頼）
  → schema・主体・接続・action・input hash検証
  → 人間による採用
  → 既存の決定論コア
  → 状態差分・因果台帳
```

- 外部APIはローカルCLIだけが、環境変数で明示されたときに呼ぶ。
- API入口は共有SSOT `shared.lib.llm_client`を再利用し、独自HTTPクライアントを作らない。
- 静的WebアプリはAPIキーを保持せず、検証済みの提案トレースだけを読み込む。
- AI出力は`fact | claim | inference | proposal`のうち`proposal`であり、シミュレーション結果ではない。
- 不正JSON、未知ID、権限違反、input hash不一致、timeoutは拒否する。デモ継続が必要な場合は、同じschemaを持つversion固定fixtureへfallbackする。
- model、prompt version、seed、input/output hash、validation結果、fallback理由をreceiptへ記録する。secretとraw認証情報は記録しない。

## Principle / Invariant / Detector / Repair / Evidence

- **Principle**: AIは状況を読み提案する。状態の真実と遷移は決定論コアが所有する。
- **Invariant**: AI応答だけではstate、metrics、budget、ledgerを変更できない。
- **Detector**: schema、許可ID、主体権限、snapshot hash、secret scan、同一seed再生テストで境界違反を検知する。
- **Repair**: 応答を拒否し、理由をreceiptへ残し、固定fixtureまたは人間選択へ戻す。
- **Evidence**: JSONL receipt、検証済みproposal、既存因果台帳、同一seed/hash回帰を同じ実装HEADで保存する。

## 今日のMVP境界

代表接続`B1 ↔ C6`、固定seed、3主体×3ターンに限定する。全20接続の校正、18主体の自律会話、120ターン危機、A〜E比較、日本除去実動、MPC最適化、RAGは含めない。

ライブ呼び出しが失敗しても、同じvalidatorと固定fixtureで2〜3分のデモを完走できることを優先する。fixture再生はライブAI実行と明確に表示を分ける。

## 帰結

- AIの非決定性を、シミュレーション状態の再現性から隔離できる。
- ライブAIの参加と、オフラインでの再現可能なデモを両立できる。
- AIの提案品質は別の評価対象であり、架空係数や政策効果の妥当性を証明しない。
- 外部APIの実行、公開提出、releaseはそれぞれ別の人間承認境界として残る。
