# ADR-0011｜M2残り19接続の架空校正 relationship-v1.1.0 を採用する

- status: accepted
- date: 2026-09-06
- 追記対象: ADR-0008の「2026-08-24 採用追記」に定めた校正変更ゲート

## 文脈

ADR-0008は代表接続`B1 ↔ C6`の係数を`relationship-v1.0.0`として採用し、係数を変更する場合の手順を定めた。その後M2で残り19接続を投資可能にするため、archetypeとmodifierによる架空校正`relationship-v1.1.0`を[M2校正判断packet](../m2-calibration-decision-packet.md)で人間が採用し、実装は`main`へ統合済みである。

一方、ADR-0008と[架空係数 Calibration v0](../calibration-v0.md)が求める「ADR-0008の追記または置換ADRを作成する」だけが未実施だった。この文書はその欠けていた記録であり、新しい判断を追加するものではない。

## 判断

M2残り19接続の架空校正`relationship-v1.1.0`の採用を、ADR系列の記録として確定する。機械可読な正本は[`m2-calibration-v1.json`](../m2-calibration-v1.json)、判断理由の人間可読記録は[M2校正判断packet](../m2-calibration-decision-packet.md)が所有し、この ADR は値を複製しない。

## 校正変更ゲートの充足状況

ADR-0008が定めた4条件に対する実装上の対応は次のとおり。

| ADR-0008の条件 | 対応 |
|---|---|
| `CALIBRATION_VERSION`を更新する | 接続単位でversionを持つ。代表接続は`relationship-v1.0.0`、残り19接続は`relationship-v1.1.0`（`app/src/simulation.js`の`calibrationVersion`分岐） |
| 変更理由を記録する | packetの「判断の目的」と「推奨する次元圧縮」がarchetype採用の理由を持つ |
| 回帰テストとCalibration文書を更新する | `m2-calibration-v1.json`を実行入力とし、`app/scripts/verify-doc-boundaries.mjs`がruntimeと機械照合する |
| 人間レビューへ戻す | packetの`decision owner: 人間レビュー`、`status: 採用済み` |

代表接続の係数は変更していないため、`app/src/calibration-v0.js`の`CALIBRATION_VERSION`定数は`relationship-v1.0.0`のまま据え置く。これは未更新ではなく、変更していない校正へ新しいversionを付けないという意味である。

## 帰結

- 全20接続が校正fingerprintを持ち、投資可能になる。
- 数値はハッカソン用の架空値であり、経験的な政策効果、実在組織の能力評価、将来予測ではない。
- 経験的校正へ置換する場合はversionを更新し、過去runを上書きしない。
- 公開、release、告知はこの採用判断に含めない。
