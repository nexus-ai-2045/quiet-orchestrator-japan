import { useMemo, useState } from "react";
import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ACTIONS, ACTORS, CHECKPOINTS, CRISIS_DAYS, END_YEAR, RELATIONSHIPS, START_YEAR,
  advanceYear, createDemoState, createInitialState, getFinalAssessment,
  runStressTest, selectAction, selectActor,
} from "./simulation.js";

const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, index) => START_YEAR + index);
const GROUPS = ["日本", "米国", "中国", "BRIDGE"];
const METRIC_META = [
  ["coordinationCapital", "協調資本", "信頼と関係の資産"],
  ["verification", "検証能力", "事実を確かめる力"],
  ["interoperability", "相互運用性", "仕組みをつなぐ力"],
  ["autonomy", "戦略的自律性", "選択肢を持ち続ける力"],
  ["legitimacy", "国内正統性", "社会の納得と支持"],
];
const RISK_META = [
  ["concentration", "権力集中", "編集権の集中リスク"],
  ["surveillance", "監視化", "過剰監視のリスク"],
  ["dependency", "単一依存", "依存・脆弱性のリスク"],
];

function actorClass(group) {
  return group === "日本" ? "actor-japan" : group === "米国" ? "actor-us" : group === "中国" ? "actor-china" : "actor-bridge";
}

function buildNodes(selectedActor) {
  return ACTORS.map((actor) => ({
    id: actor.id,
    position: { x: actor.x, y: actor.y },
    data: { label: actor.id },
    className: `${actorClass(actor.group)} ${selectedActor === actor.id ? "is-selected" : ""}`,
    draggable: false,
    selectable: true,
    style: { width: 48, height: 48 },
  }));
}

function buildEdges(selectedActor, year) {
  const maturity = Math.min(1, 0.38 + (year - START_YEAR) * 0.025);
  return RELATIONSHIPS.map(([source, target], index) => {
    const active = source === selectedActor || target === selectedActor;
    const contested = [7, 11, 16].includes(index);
    return {
      id: `${source}-${target}`,
      source,
      target,
      animated: active,
      style: {
        stroke: contested ? "#d98b43" : active ? "#66d4dc" : "#4b7f94",
        strokeWidth: active ? 2.5 : 1 + maturity,
        opacity: active ? 0.95 : 0.48,
        strokeDasharray: contested ? "5 6" : undefined,
      },
    };
  });
}

function StrategicTimeline({ year }) {
  return (
    <div className="strategic-timeline" aria-label={`戦略時間軸、現在${year}年`}>
      <div className="timeline-label">戦略時間軸 <span>2026 → 2045</span></div>
      <div className="year-track">
        {YEARS.map((item) => (
          <div key={item} className={`year-point ${item <= year ? "elapsed" : ""} ${item === year ? "current" : ""} ${CHECKPOINTS.includes(item) ? "checkpoint" : ""}`} aria-current={item === year ? "step" : undefined}>
            <span>{item}</span><i aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Header({ state, onAdvance, onStress, onCompare, onReset, comparing }) {
  return (
    <>
      <header className="app-header">
        <div className="identity"><h1>静かなオーケストレーターとしての日本</h1><span>2026 → 2045 戦略シミュレーション</span></div>
        <div className="thesis" aria-label="中心命題"><p>日本は終末の1ヶ月に何をするか、ではない。</p><strong>その1ヶ月に世界が壊れないよう、20年前から何を接続しておけるか。</strong></div>
        <div className="boundary"><span>社会シミュレーション / 公式方針・外交提言ではありません</span><strong>架空シナリオ / 現実の攻撃主体を断定しません</strong></div>
      </header>
      <div className="command-bar">
        <StrategicTimeline year={state.year} />
        <div className="command-actions">
          <button className="button primary" onClick={onAdvance} disabled={state.year >= END_YEAR}>{state.year >= END_YEAR ? "2045年に到達" : "次の1年へ"}<span aria-hidden="true">→</span></button>
          <button className="button" onClick={onStress}>終末の1ヶ月テスト</button>
          <button className={`button ${comparing ? "active" : ""}`} onClick={onCompare}>比較</button>
          <button className="button quiet" onClick={onReset}>リセット</button>
        </div>
      </div>
    </>
  );
}

function ActorRail({ state, onSelect }) {
  return (
    <aside className="actor-rail" aria-label="18の論理主体">
      <div className="panel-heading"><strong>アクター</strong><span>18</span></div>
      {GROUPS.map((group) => {
        const items = ACTORS.filter((actor) => actor.group === group);
        return (
          <section className="actor-group" key={group}>
            <h2><span className={`group-dot ${actorClass(group)}`} />{group}<small>{items.length}</small></h2>
            {items.map((actor) => (
              <button key={actor.id} className={`actor-row ${state.selectedActor === actor.id ? "selected" : ""}`} onClick={() => onSelect(actor.id)}>
                <span className="actor-code">{actor.id}</span><span className="actor-name">{actor.name}</span>
                <span className={`status-dot ${state.year >= 2035 || actor.id === "B1" ? "online" : "forming"}`} aria-label="接続状態" />
              </button>
            ))}
          </section>
        );
      })}
      <div className="relation-legend"><span><i className="line strong" />強化</span><span><i className="line forming" />形成</span><span><i className="line risk" />依存リスク</span></div>
    </aside>
  );
}

function NetworkStage({ state, onSelectActor }) {
  const nodes = useMemo(() => buildNodes(state.selectedActor), [state.selectedActor]);
  const edges = useMemo(() => buildEdges(state.selectedActor, state.year), [state.selectedActor, state.year]);
  return (
    <section className="network-stage" aria-label="長期接続ネットワーク">
      <div className="stage-title"><strong>長期ポートフォリオ・レイヤー</strong><span>{state.year}年 / 接続成熟度 {Math.min(100, 36 + (state.year - START_YEAR) * 3)}</span></div>
      <div className="layer-labels" aria-hidden="true">
        <div><strong>検証基盤</strong><span>共通の事実を確かめる</span></div>
        <div><strong>相互運用</strong><span>仕組みをつなぎ、動かす</span></div>
        <div><strong>共同所有</strong><span>成果と責任を分ち合う</span></div>
      </div>
      <div className="flow-wrap">
        <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, node) => onSelectActor(node.id)} fitView fitViewOptions={{ padding: 0.13 }} minZoom={0.65} maxZoom={1.3} panOnDrag={false} zoomOnScroll={false} zoomOnDoubleClick={false} nodesConnectable={false} elementsSelectable proOptions={{ hideAttribution: true }}>
          <Background color="#27475a" gap={34} size={1} />
        </ReactFlow>
      </div>
    </section>
  );
}

function Inspector({ state }) {
  const actor = ACTORS.find((item) => item.id === state.selectedActor) ?? ACTORS.at(-1);
  const maturity = Math.min(100, 28 + (state.year - START_YEAR) * 4);
  const final = getFinalAssessment(state);
  return (
    <aside className="inspector" aria-label="選択中の接続詳細">
      <div className="panel-heading"><strong>選択中</strong><span>{actor.id} / {actor.group}</span></div>
      <div className="inspector-body">
        <h2>{actor.name}</h2>
        <dl>
          <div><dt>関係の目的</dt><dd>公開可能な事実と検証手順を、政策判断より先に共有する。</dd></div>
          <div><dt>所有形態</dt><dd>共同所有 / 多元ガバナンス</dd></div>
          <div><dt>検証プロトコル</dt><dd>独立2ソース + 異論記録 + 期限付き再検証</dd></div>
          <div><dt>可逆性</dt><dd>データ・手順・権限を分離して撤回可能</dd></div>
          <div><dt>依存リスク</dt><dd>{state.metrics.dependency > 55 ? "高" : state.metrics.dependency > 35 ? "中" : "低"} / 代替経路を{Math.max(1, Math.round((100 - state.metrics.dependency) / 25))}本確保</dd></div>
        </dl>
        <div className="maturity"><div><span>現在の成熟度</span><strong>{maturity}%</strong></div><div className="maturity-bar"><i style={{ width: `${maturity}%` }} /></div><div className="maturity-steps"><span>初期</span><span>形成</span><span>運用</span><span>成熟</span></div></div>
        <div className="final-condition"><span>2045 最終条件</span><strong>日本が中心から退いても、<br />協調ネットワークが機能する</strong><div><b>{state.metrics.continuity}</b><span>/100<br />日本不在時の継続性<br />{final.label}</span></div></div>
      </div>
    </aside>
  );
}

function ActionRail({ state, onChoose }) {
  const selected = ACTIONS.find((item) => item.id === state.selectedAction) ?? ACTIONS[0];
  return (
    <section className="action-rail" aria-label="年間アクション">
      <div className="action-budget"><span>年間アクション</span><strong>100</strong><small>ポイント</small></div>
      <div className="action-options">
        {ACTIONS.map((action) => (
          <button key={action.id} onClick={() => onChoose(action.id)} className={state.selectedAction === action.id ? "selected" : ""} aria-pressed={state.selectedAction === action.id}>
            <span>{action.label}</span><small>{action.summary}</small><b>{action.cost}</b>
          </button>
        ))}
      </div>
      <div className="selected-action"><span>選択中のアクション</span><strong>{selected.project}</strong><p>{selected.summary}。効果は次の年へ進むと反映されます。</p></div>
    </section>
  );
}

function StressStrip({ state }) {
  return (
    <section className="stress-strip" aria-label="終末の1ヶ月ストレステスト">
      <div className="stress-heading"><strong>終末の1ヶ月</strong><span>{CRISIS_DAYS}日間、長期投資が持ちこたえるか確かめる</span></div>
      {CHECKPOINTS.map((year) => {
        const result = state.stressTests[year];
        return (
          <article key={year} className={state.year === year ? "current" : ""}>
            <div><strong>{year}</strong><span>{result ? result.verdict : "未実施"}</span></div>
            {result ? <ul><li><span>誤帰属回避</span><b>{result.attributionSafety}</b></li><li><span>協調継続</span><b>{result.coordinationSurvival}</b></li><li><span>民間保護</span><b>{result.civilianProtection}</b></li></ul> : <p>{year > state.year ? "この年まで接続を育てる" : "テストを実行して記録する"}</p>}
          </article>
        );
      })}
      <div className="evidence-legend"><span>証拠の種別</span><i className="fact" />事実<i className="claim" />主張<i className="inference" />推論<i className="proposal" />提案</div>
    </section>
  );
}

function MetricRail({ state }) {
  return (
    <section className="metric-rail" aria-label="戦略指標とリスク指標">
      <div className="metric-heading"><strong>戦略指標</strong><span>現在値</span></div>
      {METRIC_META.map(([key, label, description]) => <article className="metric" key={key}><span>{label}</span><small>{description}</small><div><strong>{state.metrics[key]}</strong><i style={{ width: `${state.metrics[key]}%` }} /></div></article>)}
      {RISK_META.map(([key, label, description]) => <article className="metric risk" key={key}><span>{label}</span><small>{description}</small><div><strong>{state.metrics[key]}</strong><i style={{ width: `${state.metrics[key]}%` }} /></div></article>)}
    </section>
  );
}

function Comparison({ state, onClose }) {
  const strategies = [
    { name: "同盟代理", continuity: 38, dependency: 76, note: "即応性は高いが、単一依存が残る" },
    { name: "単独仲介", continuity: 45, dependency: 58, note: "日本の負荷と失敗時の空白が大きい" },
    { name: "静かなオーケストレーション", continuity: state.metrics.continuity, dependency: state.metrics.dependency, note: "共同所有へ移し、日本不在でも残す" },
  ];
  return (
    <div className="comparison-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="comparison" role="dialog" aria-modal="true" aria-labelledby="comparison-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="panel-heading"><strong id="comparison-title">戦略比較</strong><button onClick={onClose}>閉じる</button></div><p>同じ初期条件と2045年を使い、調整方式だけを変えた比較です。</p>
        {strategies.map((strategy) => <article key={strategy.name}><h2>{strategy.name}</h2><div><span>日本不在時の継続性 <b>{strategy.continuity}</b></span><span>単一依存 <b>{strategy.dependency}</b></span></div><p>{strategy.note}</p></article>)}
      </section>
    </div>
  );
}

export function App() {
  const [state, setState] = useState(() => createDemoState(2035));
  const [comparing, setComparing] = useState(false);
  const [notice, setNotice] = useState("2035年のデモ状態を表示しています");
  const handleAdvance = () => setState((current) => { const next = advanceYear(current); setNotice(next.year === current.year ? "2045年の最終評価に到達しています" : `${next.year}年へ進みました`); return next; });
  const handleStress = () => setState((current) => { const next = runStressTest(current); setNotice(`${current.year}年時点の終末の1ヶ月テストを記録しました`); return next; });
  const handleReset = () => { setState(createInitialState()); setNotice("2026年から新しいシミュレーションを開始しました"); };

  return (
    <main className="app-shell">
      <Header state={state} onAdvance={handleAdvance} onStress={handleStress} onCompare={() => setComparing((value) => !value)} onReset={handleReset} comparing={comparing} />
      <div className="workspace"><ActorRail state={state} onSelect={(id) => setState((current) => selectActor(current, id))} /><div className="center-stack"><NetworkStage state={state} onSelectActor={(id) => setState((current) => selectActor(current, id))} /><ActionRail state={state} onChoose={(id) => setState((current) => selectAction(current, id))} /></div><Inspector state={state} /></div>
      <StressStrip state={state} /><MetricRail state={state} />
      <footer className="app-footer"><span role="status" aria-live="polite">{notice}</span><span>モデル入力はすべて架空です</span></footer>
      {comparing && <Comparison state={state} onClose={() => setComparing(false)} />}
    </main>
  );
}
