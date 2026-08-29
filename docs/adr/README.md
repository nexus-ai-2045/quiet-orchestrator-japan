# Architecture Decision Records

このディレクトリは、`quiet-orchestrator-japan` の重要な設計判断と、その理由・交換条件を記録する。

| ADR | 状態 | 判断 |
|---|---|---|
| [0001](0001-dual-timescale.md) | accepted | 2026〜2045年を本編、30日間を入れ子のストレステストにする |
| [0002](0002-deterministic-core.md) | accepted | 中核状態を決定論エンジンが所有する |
| [0003](0003-static-local-first-web-app.md) | accepted | React/Viteの静的・ローカルファーストWebアプリにする |
| [0004](0004-evidence-and-actor-boundary.md) | accepted | 証拠型と論理主体の安全境界を固定する |
| [0005](0005-japan-absence-success-condition.md) | accepted | 日本不在時の継続性を2045年の成功条件にする |
| [0006](0006-stateful-relationships-and-causal-ledger.md) | accepted | 接続を状態化し、因果レジャーを正本にする |
| [0007](0007-one-month-crisis-window.md) | accepted | 危機試験を30日・6時間×120ターンの「終末の1ヶ月」にする |
| [0008](0008-causal-vertical-slice.md) | accepted | 接続投資から危機寄与までを一本の縦切りで実装する |
| [0009](0009-ai-proposal-harness.md) | accepted | scripted Policy Engineで推論層の安全境界を先に固定する |
| [0010](0010-run-bundle-and-experience-technology.md) | accepted | 実行bundleを固定し、体験技術は必要時だけ追加する |

状態は `proposed | accepted | superseded | rejected` のいずれかを使う。判断を変更する場合、過去ADRを書き換えず、新しいADRから置換先を示す。
