# 実行結果｜P0 baseline + P1因果縦切り 実測スナップショット

確認日: 2026-08-30

機械検証対象content HEAD: `6e41587d976d0e02a30aef67a7aa7cc1c9c4254f`

## 実行環境

- Node.js `v24.14.0`
- npm `11.14.1`
- Windows / ローカルworktree
- 外部API、APIキー、ライブデータなし

READMEの下限はNode.js 20であり、この記録は上記環境で実際に実行した履歴スナップショットである。仮説、比較条件、反証条件の正本は[実験設計スナップショット](EXPERIMENT_DESIGN.md)だが、初回実測と同じcommit系列で追加されたため、この結果に対する事前登録証拠ではない。今後の実行ではdesign revisionを先に固定し、この文書から変更しない。

## 機械検証

次の結果は上記content HEADをcommit後にcheckoutした状態で再実行した。同じcommitへ証拠文書を自己参照させず、この文書更新は後続evidence commitとして記録する。

| コマンド | 結果 |
|---|---|
| `npm test` | 115件pass |
| `npm run build` | Vite production build pass |
| `npm run test:sites` | 4件pass |
| `npm audit --audit-level=high` | 0 vulnerabilities |
| `ai-ratchet-gate` | 現存0件、新規0件 |

115件には`meta-security-run-bundle/v1`の同一`run_id`束縛、accessorを含むJSON外値拒否、seed役割分離、失敗event保持、独立implementation SHA照合、event container fail-closed、決定論的再実行の8件を含む。

### M1.5 ローカルPDCA実測

外部API・APIキー・ネットワークを使わず、固定seed・固定action表のscripted Policy Engineで3主体×3ターンを実行した。各手は現在stateから観測を再生成し、`Plan → Do → Check → Act`を順に記録する。提案はschema・主体権限・観測hash・state hashを検証後、既存の決定論コアだけが適用する。観測値を使うAI/LLM推論の実測ではない。

Policy Engineの正規versionは`scripted-policy-v1`であり、各receiptのprovider metadataへ記録しvalidatorで固定する。checkpoint再試行時は、検査前previewとは別に実際に適用したPlan hashとattempt数をCheck/Actへ残す。

- 9手の主体順序: `B1 → J2 → C6`を3ターン
- 同じ初期stateとseedの全PDCA出力: 完全一致
- checkpoint未記録時: 決定論コアが一度拒否し、危機テスト記録後に同じ手を再観測・再試行
- Planによるstate直接変更: なし
- Check証拠: before/after state hash、追加ledger ID、次の観測summary

### ブラウザ確認（PR #4 履歴）

2026-08-28のPR #4系列における履歴証拠である。標準幅と880px狭幅で、接続選択、表示専用接続のfail-closed、投資差分と集約指標・tradeoffのpreview、年次更新、最新因果台帳、2030年危機寄与から台帳#5の累積スナップショットと当時の接続状態への逆引き、現在台帳への復帰を確認した。追加確認では、2030年のstress未記録時に年次進行が停止し、記録後に再開すること、2038年のfatigue後に開示コスト・監視化リスクが実delta`+1`として表示されることを確認した。URLと固有title、非blank、console warning/error 0件、axe violations 0件を確認した。画面外要素26件はaxeがcontrastを自動判定できずincompleteであり、passとは数えていない。この履歴証拠を同一HEADのブラウザ実測とは数えない。

### ブラウザ確認（因果台帳drawer・履歴content HEAD）

履歴content HEAD `9a11564d3d583a7f1b4b95125e7faf1bd5440fba` のローカルViteで、因果台帳drawerのUIゲートを確認した。このブラウザ証拠は現在のM2 mechanical foundation content HEADのsame-HEAD証拠には数えない。

| gate | status | affirmative observation |
|---|---|---|
| standard-width | pass-historical-head | 複数台帳を一覧し、過去entryからInspectorと記録済み副作用へ逆引きできた |
| narrow-880 | pass-historical-head | drawer一覧・選択・Inspector更新が表示領域内で破綻しなかった |
| narrow-320 | pass-historical-head | padded backdropのcontent幅100%へdrawerを制約し、左右clipを防ぐ契約testが通った |
| keyboard-modal | pass-historical-head | Escape・行操作・Tab循環・Close後のopener focus復帰を確認した |
| reduced-motion | pass-historical-head | 署名差分が静的テキストとして残り、理解がanimationに依存しなかった |

## PR reviewへの対応

PR #5の同一HEAD Codex reviewで未解決だったP2 3件は、content HEAD `f97e124`で次の運用保証へ根因修正した。

- 校正fingerprintは`initialState`キーの挿入順に依存せず、値の正規化比較で一致判定する。
- preview / advanceは選択接続だけでなく、state全体の未解決investableをstressと同じ条件で拒否する。
- schema-v2 migrationはfingerprint欠落時だけ既知校正をbackfillし、明示された競合fingerprintは保持してfail closedにする。

これらの修正は後続evidence commitで34件の同一content HEAD実測として固定する。

本branchでは、因果台帳drawerの開示UIと逆引き契約を追加し、PR #6 Codex reviewの指摘へ次を反映した。

- 選択中台帳の記録済み`metricDeltas` / `tradeoffs`を表示し、現在previewと歴史証拠を混同しない。
- drawerのEnter/Spaceは台帳行がフォーカスを持つときだけ有効にし、CloseへのSpaceを吸わない。
- 署名アニメはentry IDの`key`で再起動する。
- RESULTSの機械検証を完了形で記録し、UIゲート同一HEAD証拠を追加してからM1を閉じる。
- PREFLIGHTの`repo-preflight target diff`行を、SHAのみ／「再測定する」未来形から、content HEADでのlive観測（secret0・path0・origin・clean worktree・CI設定2・effective_identity pass / `ready_after_confirmation`）へ直し、同種driftを`verify-doc-boundaries`でfail closedにした。
- pass行の証拠は完了観測フィールド必須とし、`secret候補をpush前に確認する`のようなfuture-plan文は回帰テスト付きで拒否する。

PR #4の`a05abc5`に対するCodex review P2 4件を、local `2263b50`で次の契約へ修正した。

- clamp前の要求値ではなく、clamp後に実際に適用されたdeltaをpreviewと因果台帳の正本にする。
- `relationshipContributions`を持たないlegacy stress resultはschema v2移行時に破棄し、描画クラッシュを防ぐ。
- stress contributionへcheckpoint年とledger entry IDを保存し、当時の接続状態まで逆引きする。
- 投資前に集約指標deltaとtradeoffを表示し、監視化等の副作用を隠さない。

`f85baeb`への同一HEAD reviewで追加されたP2 3件は、後続commitで次の契約へ修正した。

- 年次の自動変化を含む最終metricsから実deltaを算出し、preview・台帳・stateを同じ遷移結果へ束縛する。
- 数値tradeoffをfatigueとclamp後の実deltaから生成し、表示と適用値の不一致を防ぐ。
- 2030・2035・2040のstress resultが未記録なら年次進行をengineで拒否し、記録後だけ再開する。

これらの修正と、上限時の定性tradeoff抑止を含むremote PR #4 HEAD `c2eeaf3`はCI・CodeQLに成功し、review thread全8件がresolved、最新Codex reviewは重大指摘なしだった。その後の事前設計SSOT・実装・検証差分もPR #4で`main`へ統合済みであり、現行状態のcanonicalは`main`である。この段落のcommit・review記録は当時の履歴証拠であり、後続HEADの検証結果を代替しない。

## 初期状態から1年投資した差

全施策で、協調資本に応じた継続性の自然増分`+1`を含む。

| 施策 | 主要な差分 |
|---|---|
| 翻訳 | 協調資本 `42→49`、正統性 `55→58`、単一依存 `48→46` |
| 検証 | 検証能力 `38→48`、協調資本 `42→46`、監視化 `18→20` |
| 可逆化 | 自律性 `48→54`、正統性 `55→59`、権力集中 `22→19` |
| 複線化 | 相互運用性 `35→41`、自律性 `48→55`、単一依存 `48→40` |
| 共同所有 | 継続性 `28→38`、協調資本 `42→48`、権力集中 `22→16` |

## 2035年デモ状態

5施策を順番に適用した決定論デモでは、2035年に次を観測した。

- 協調資本: `76`
- 検証能力: `58`
- 相互運用性: `47`
- 戦略的自律性: `68`
- 国内正統性: `65`
- 日本不在時の継続性: `58`
- 権力集中: `7`
- 監視化: `22`
- 単一依存: `28`

同年の`B1 ↔ C6`は、成熟度`87`、信頼`66`、検証合意`62`、相互運用`58`、共同所有`48`、単一依存`16`、代替経路`4`、開示コスト`20`だった。

同年の終末の1ヶ月試験は、期間`30日`、`6時間×120ターン`の契約を持ち、誤帰属回避`66`、協調継続`71`、民間保護`64`で、`B1 ↔ C6`の協調継続寄与は`+21`、総合判定は「改善余地」だった。2045年最終評価ではなく、架空係数を使った途中状態の説明用結果である。

係数の正確な値、交換条件、変更規則は[架空係数 Calibration v0](docs/calibration-v0.md)に固定する。

## 現時点で結論に使えないこと

- 接続状態は共通schemaを持つが、投資可能で係数が動くのは代表接続`B1 ↔ C6`だけである。
- アクターごとの利害、制約、証拠アクセスは行動差へ反映していない。
- 終末の1ヶ月試験は120ターンのイベント列をまだ持たない。
- 比較条件の一部は固定値で、同じエンジンによる再実行ではない。
- 数値と係数は架空で、経験的な確率や政策効果を表さない。
- AI/LLM推論や自律交渉は未実装である。現M1.5は固定seed・固定action表のscripted Policy Engineによる3主体×3ターンPDCA基準線である。

したがって、この結果は「日本の構想が有効」という実証ではない。現在の成果は、仮説を反証可能な実装へ進めるためのP0 baselineである。次段階は[ロードマップ](ROADMAP.md)を参照する。
