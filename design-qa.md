# Design QA

- source visual truth: `docs/design/selected-ui-concept.png`
- implementation screenshot: `docs/images/simulator-preview.jpg`
- source pixels: 1487 × 1058
- implementation pixels: 1265 × 712
- CSS viewport: 1265 × 712（Codex内蔵ブラウザの表示領域）
- density normalization: いずれも1倍相当として全体比率を比較。実装は同一幅比へ縮小して確認
- state: 2035年デモ、検証アクション選択、B1選択、比較ダイアログ閉

## Full-view comparison evidence

両画像を同じ比較入力で開き、ヘッダー、2026〜2045年時間軸、左の18主体、中央の3レイヤー接続網、右インスペクター、年間アクション、72時間試験、能力・リスク指標の順序と占有率を確認した。

実装は内蔵ブラウザの高さ712pxでは指標レールが折り返し後の領域となるが、ページスクロールで欠落なく表示される。幅1265pxでは選択済みコンセプトの三列構成を維持する。

## Focused region comparison evidence

- 中央接続網: 主体ID、日米中BRIDGEの色、選択B1、強化・形成・依存リスクの線種を確認。
- 右インスペクター: 関係目的、所有形態、検証プロトコル、可逆性、依存リスク、成熟度、2045最終条件を確認。
- 年間アクション: 5機能、選択状態、費用、選択プロジェクトを確認。
- 72時間試験: 2030・2035の結果と2040・2045の未実施状態を確認。

## Comparison history

### Iteration 1

- [P2] 1265px幅で中央列の最小幅が右インスペクターへ干渉し、見出しの先頭が欠けた。
- Fix: 1320px以下のグリッド幅を縮小し、中央列のoverflowを閉じ、インスペクターを前面レイヤーへ固定した。
- Post-fix evidence: `docs/images/simulator-preview.jpg` で「検証・対話ハブ」と全詳細が表示されることを確認した。

## Required fidelity surfaces

- Fonts and typography: 日本語システムサンセリフと等幅数値の二系統。見出し、本文、主体ID、年の階層は一致。長文は周辺UIで省略し、重要コピーは折り返して保持。
- Spacing and layout rhythm: ヘッダー、時間軸、三列ワークスペース、試験、指標の順序と比率は一致。高さの違いはブラウザ表示領域によるスクロールで吸収。
- Colors and visual tokens: 濃紺、磁器色、シアン、緑、琥珀、赤の意味対応を維持。赤は不可逆リスクと免責だけに限定。
- Image quality and asset fidelity: UIはコードネイティブ。接続網は静止画像で代替せず、React Flowの操作可能なデータ可視化として実装。欠落した装飾画像やプレースホルダーはない。
- Copy and content: 中心命題、2026〜2045、5機能、18主体、72時間試験、2045成功条件、二つの免責を一致させた。
- Interaction and accessibility: 年次更新、危機試験、比較、リセット、施策・主体選択をブラウザで実行。ボタン、`aria-pressed`、`aria-current`、dialog、live status、reduced motionを確認。

## Findings

P0、P1、P2の未解決項目はない。

## Follow-up polish

- [P3] コンセプトの台形レイヤーを、実装では操作可能な水平レイヤーへ単純化した。情報階層と接続関係を優先した意図的な差分。
- [P3] 1440 × 1024の外部ブラウザでも最終スクリーンショットを追加すると、公開READMEで全体を一度に見せやすい。

## Primary interactions tested

- 「次の1年へ」: 2035年から2036年へ進み、検証能力と協調資本が更新された。
- 「72時間テスト」: 2036年の決定論的結果が状態へ記録された。
- 「比較」: 三つの戦略と継続性・単一依存がdialogへ表示された。
- ブラウザDOM上の実行時エラーは観測されなかった。buildと操作の両方で画面は継続した。

final result: passed
