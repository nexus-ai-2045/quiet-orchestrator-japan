# ADR-0010｜実行bundleを先に固定し、体験技術は必要時だけ追加する

- status: accepted
- date: 2026-08-30

## 文脈

ローカル決定論コア、scripted Policy Engine、因果台帳をCloud等の実行環境でも同じ証拠として扱うには、run request、event stream、replay、evidenceを一つのrun identityへ束縛する必要がある。一方、現行体験はReact、Vite、React Flowの2D関係網で成立しており、描画技術の追加自体はプロダクトゴールではない。

## 判断

既存runtimeとドメインロジックを変更せず、薄いadapterとして`meta-security-run-bundle/v1`をこのrepositoryが所有する。全sectionと各eventを同じ`run_id`へ束縛し、固定seed、event index、state hash、receipt hash、ledger IDを保存する。validatorはrun requestからbundle全体を再実行し、完全一致しない入力を拒否する。

### 技術評価

| 候補 | 判断 | 理由 |
|---|---|---|
| Three.js | 不採用 | 現在の2D関係網で接続選択と因果逆引きを表現でき、3D空間は必須ではない |
| GSAP | 保留 | 現在の年次・PDCA表示はReact状態とCSSで足りる。120ターンの時系列UIで必要性を再評価する |
| Hyperframes | runtime不採用 | 発表動画またはVisual QA時だけdev-onlyで使い、通常bundleへ含めない |
| Godot | 不採用 | 操作ゲームengineを二重所有すると既存決定論コアとruntimeが分岐する |

Three.jsまたはGSAPを将来採る場合も、必要な画面からdynamic importする。Hyperframes、Godot本体、Godot binaryを通常runtimeや`meta-security-sim`へ持ち込まない。

## 撤退・fallback

run bundle adapterは既存simulationを呼ぶだけで、状態遷移を所有しない。撤退時は`app/src/run-bundle.js`、CLI、専用test、npm scriptを除去すれば、既存`npm run simulate`と`simulate:ai`へ無変更で戻れる。描画候補は依存追加していないため撤退作業はない。
