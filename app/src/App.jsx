import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ACTIONS, ACTORS, CHECKPOINTS, CRISIS_DAYS, END_YEAR, RELATIONSHIPS, START_YEAR,
  advanceYear, createDemoState, createInitialState, getFinalAssessment,
  getLedgerEntryFocus, getLedgerSignature, getSelectedRelationship, getStressContributionFocus,
  getStressTestDisplayYears, listLedgerTrail, previewRelationshipInvestment, runStressTest,
  selectAction, selectActor, selectRelationship,
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
const METRIC_DELTA_LABELS = new Map([
  ...METRIC_META.map(([key, label]) => [key, label]),
  ...RISK_META.map(([key, label]) => [key, label]),
  ["continuity", "日本不在時の継続性"],
]);
const RELATIONSHIP_FIELD_META = [
  ["maturity", "成熟度"],
  ["trust", "信頼"],
  ["verificationAgreement", "検証合意"],
  ["interoperability", "相互運用"],
  ["coOwnership", "共同所有"],
  ["dependency", "単一依存"],
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

function buildEdges(state) {
  return RELATIONSHIPS.map(({ id, source, target }) => {
    const relationship = state.relationships[id];
    const actorActive = source === state.selectedActor || target === state.selectedActor;
    const selected = id === state.selectedRelationshipId;
    const maturity = relationship.state.maturity;
    return {
      id,
      source,
      target,
      animated: selected,
      className: selected ? "relationship-selected" : "",
      style: {
        stroke: relationship.contested ? "#d98b43" : selected ? "#8ce7ec" : relationship.investable ? "#65c59b" : actorActive ? "#66d4dc" : "#4b7f94",
        strokeWidth: selected ? 4 : 1 + maturity / 50,
        opacity: selected ? 1 : actorActive ? 0.82 : relationship.investable ? 0.75 : 0.42,
        strokeDasharray: relationship.contested ? "5 6" : relationship.investable ? undefined : "3 4",
      },
    };
  });
}

function StrategicTimeline({ year }) {
  return (
    <div className="strategic-timeline" role="group" aria-label={`戦略時間軸、現在${year}年`}>
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

function Header({ state, preview, onAdvance, onStress, onCompare, onReset, comparing }) {
  const atCheckpoint = CHECKPOINTS.includes(state.year);
  return (
    <>
      <header className="app-header">
        <div className="identity"><h1>静かなオーケストレーターとしての日本</h1><span>2026 → 2045 戦略シミュレーション</span></div>
        <div className="thesis" role="note" aria-label="中心命題"><p>日本は終末の1ヶ月に何をするか、ではない。</p><strong>その1ヶ月に世界が壊れないよう、20年前から何を接続しておけるか。</strong></div>
        <div className="boundary"><span>社会シミュレーション / 公式方針・外交提言ではありません</span><strong>架空シナリオ / 現実の攻撃主体を断定しません</strong></div>
      </header>
      <div className="command-bar">
        <StrategicTimeline year={state.year} />
        <div className="command-actions">
          <button className="button primary" onClick={onAdvance} disabled={!preview.eligible} title={preview.reason}>{state.year >= END_YEAR ? "2045年に到達" : preview.eligible ? "投資して次の1年へ" : "代表接続を選択"}<span aria-hidden="true">→</span></button>
          <button className="button" onClick={onStress} title={`${state.year}年の接続状態を固定して${atCheckpoint ? "標準チェックポイント" : "任意年"}として検証`}>{atCheckpoint ? "終末の1ヶ月テスト" : "任意年テスト"}</button>
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

function NetworkStage({ state, onSelectActor, onSelectRelationship, focusedLedgerEntry }) {
  const nodes = useMemo(() => buildNodes(state.selectedActor), [state.selectedActor]);
  const edges = useMemo(() => buildEdges(state), [state]);
  const signature = getLedgerSignature(focusedLedgerEntry ?? state.ledger.at(-1));
  return (
    <section className="network-stage" aria-label="長期接続ネットワーク">
      <div className="stage-title">
        <strong>長期ポートフォリオ・レイヤー</strong>
        <label className="relationship-picker">接続を選択<select value={state.selectedRelationshipId} onChange={(event) => onSelectRelationship(event.target.value)}>{RELATIONSHIPS.map((relationship) => <option key={relationship.id} value={relationship.id}>{relationship.label}{relationship.investable ? " / P1代表" : " / 表示のみ"}</option>)}</select></label>
      </div>
      <div className="layer-labels" aria-hidden="true">
        <div><strong>検証基盤</strong><span>共通の事実を確かめる</span></div>
        <div><strong>相互運用</strong><span>仕組みをつなぎ、動かす</span></div>
        <div><strong>共同所有</strong><span>成果と責任を分ち合う</span></div>
      </div>
      <div className="flow-wrap">
        <ReactFlow nodes={nodes} edges={edges} onNodeClick={(_, node) => onSelectActor(node.id)} onEdgeClick={(_, edge) => onSelectRelationship(edge.id)} fitView fitViewOptions={{ padding: 0.13 }} minZoom={0.65} maxZoom={1.3} panOnDrag={false} zoomOnScroll={false} zoomOnDoubleClick={false} nodesConnectable={false} elementsSelectable proOptions={{ hideAttribution: true }}>
          <Background color="#27475a" gap={34} size={1} />
        </ReactFlow>
        {signature && <div key={focusedLedgerEntry?.id ?? state.ledger.at(-1)?.id ?? "empty"} className={`ledger-signature ${focusedLedgerEntry ? "is-focused" : ""}`} aria-live="polite">{signature.text}</div>}
      </div>
    </section>
  );
}

function Inspector({ state, focusedLedgerEntry }) {
  const relationship = getSelectedRelationship(state);
  const historicalEntry = focusedLedgerEntry?.relationshipId === relationship.id ? focusedLedgerEntry : null;
  const relationshipState = historicalEntry?.after ?? relationship.state;
  const source = ACTORS.find((item) => item.id === relationship.source);
  const target = ACTORS.find((item) => item.id === relationship.target);
  const preview = previewRelationshipInvestment(state);
  const final = getFinalAssessment(state);
  return (
    <aside className="inspector" aria-label="選択中の接続詳細" tabIndex={0}>
        <div className="panel-heading"><strong>{historicalEntry ? `${historicalEntry.year}年の接続` : "選択中の接続"}</strong><span>{relationship.label}</span></div>
      <div className="inspector-body">
        <div className={`scope-badge ${relationship.investable ? "active" : ""}`}>{relationship.investable ? "P1 代表接続 / 投資可能" : "P1 表示のみ / 未校正"}</div>
        <h2>{source.name}<span> ↔ </span>{target.name}</h2>
        <dl>
          <div><dt>関係の目的</dt><dd>{relationship.purpose}</dd></div>
          <div><dt>接続チャネル</dt><dd>{relationship.channel}</dd></div>
          <div><dt>所有形態</dt><dd>{relationship.ownership}</dd></div>
        </dl>
        <div className="relationship-grid">
          {RELATIONSHIP_FIELD_META.map(([key, label]) => <div key={key} className={key === "dependency" ? "risk" : ""}><span>{label}</span><strong>{relationshipState[key]}</strong>{!historicalEntry && preview.eligible && preview.deltas[key] ? <small>{preview.deltas[key] > 0 ? "+" : ""}{preview.deltas[key]}</small> : null}</div>)}
          <div><span>代替経路</span><strong>{relationshipState.alternateRoutes}</strong><small>本</small></div>
          <div className="risk"><span>開示コスト</span><strong>{relationshipState.disclosureCost}</strong>{!historicalEntry && preview.eligible && preview.deltas.disclosureCost ? <small>+{preview.deltas.disclosureCost}</small> : null}</div>
        </div>
        {historicalEntry && <p className="scope-note">因果台帳 {historicalEntry.id} 適用後の接続状態です。{historicalEntry.reason}</p>}
        {!preview.eligible && <p className="scope-note">{preview.reason}</p>}
        <div className="final-condition"><span>2045 最終条件</span><strong>日本が中心から退いても、<br />協調ネットワークが機能する</strong><div><b>{state.metrics.continuity}</b><span>/100<br />日本不在時の継続性<br />{final.label}</span></div></div>
      </div>
    </aside>
  );
}

function ActionRail({ state, onChoose, focusedLedgerEntry, onClearLedgerFocus, onOpenLedger }) {
  const selected = ACTIONS.find((item) => item.id === state.selectedAction) ?? ACTIONS[0];
  const preview = previewRelationshipInvestment(state);
  const latest = focusedLedgerEntry ?? state.ledger.at(-1);
  const ledgerIndex = latest ? state.ledger.findIndex((entry) => entry.id === latest.id) + 1 : 0;
  const signature = getLedgerSignature(latest);
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
      <div className="selected-action" tabIndex={0}>
        <div className="preview-heading"><span>{preview.relationshipId} への投資プレビュー</span>{focusedLedgerEntry && <button className="ledger-current" onClick={onClearLedgerFocus}>現在の台帳へ戻る</button>}</div><strong>{selected.project}</strong>
        {preview.eligible ? <><div className="delta-list">{Object.entries(preview.deltas).map(([key, delta]) => <i key={key}>{RELATIONSHIP_FIELD_META.find(([field]) => field === key)?.[1] ?? (key === "alternateRoutes" ? "代替経路" : "開示コスト")} <b>{delta > 0 ? "+" : ""}{delta}</b></i>)}</div><span className="preview-subheading">集約指標への副作用</span><div className="delta-list metric-deltas">{Object.entries(preview.metricDeltas).map(([key, delta]) => <i key={key}>{METRIC_DELTA_LABELS.get(key) ?? key} <b>{delta > 0 ? "+" : ""}{delta}</b></i>)}</div><span className="preview-subheading">構造上の注意</span><div className="tradeoff-list">{preview.tradeoffs.map((tradeoff) => <i key={tradeoff}>{tradeoff}</i>)}</div></> : <p>{preview.reason}</p>}
        {latest && (
          <div className="ledger-latest">
            <div className="ledger-latest-heading">
              <span>{focusedLedgerEntry ? "選択中" : "最新"}の因果台帳 #{ledgerIndex} / {latest.ruleVersion}</span>
              {state.ledger.length > 0 && <button type="button" className="ledger-open" onClick={onOpenLedger}>全台帳を開く</button>}
            </div>
            <b>{latest.year} / {latest.relationshipLabel} / {latest.actionLabel}</b>
            {signature && <div className="ledger-signature-inline" aria-hidden="true">{signature.text}</div>}
            <div className="ledger-deltas">{Object.entries(latest.deltas).map(([key, delta]) => <i key={key}>{RELATIONSHIP_FIELD_META.find(([field]) => field === key)?.[1] ?? (key === "alternateRoutes" ? "代替経路" : "開示コスト")} {delta > 0 ? "+" : ""}{delta}</i>)}</div>
            {Object.keys(latest.metricDeltas ?? {}).length > 0 && (
              <>
                <span className="preview-subheading">記録された集約指標の副作用</span>
                <div className="delta-list metric-deltas">{Object.entries(latest.metricDeltas).map(([key, delta]) => <i key={key}>{METRIC_DELTA_LABELS.get(key) ?? key} <b>{delta > 0 ? "+" : ""}{delta}</b></i>)}</div>
              </>
            )}
            {(latest.tradeoffs?.length ?? 0) > 0 && (
              <>
                <span className="preview-subheading">記録された構造上の注意</span>
                <div className="tradeoff-list">{latest.tradeoffs.map((tradeoff) => <i key={tradeoff}>{tradeoff}</i>)}</div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function LedgerDrawer({ state, focusedLedgerEntryId, onClose, onSelect }) {
  const titleId = useId();
  const dialogRef = useRef(null);
  const listRef = useRef(null);
  const previousFocusRef = useRef(null);
  const ordered = useMemo(() => [...listLedgerTrail(state)].reverse(), [state]);
  const initialIndex = Math.max(0, ordered.findIndex((item) => item.entry.id === focusedLedgerEntryId));
  const [activeIndex, setActiveIndex] = useState(initialIndex < 0 ? 0 : initialIndex);

  useEffect(() => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => previousFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    const node = listRef.current?.querySelector(`[data-ledger-index="${activeIndex}"]`);
    node?.focus();
  }, [activeIndex]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "Tab") {
        const focusable = [...(dialogRef.current?.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [])].filter((node) => !node.hasAttribute("hidden"));
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        if (!dialogRef.current?.contains(document.activeElement)) {
          event.preventDefault();
          first.focus();
        } else if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      const row = event.target instanceof Element ? event.target.closest("[data-ledger-index]") : null;
      if (!row) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(ordered.length - 1, current + 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(0, current - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(Math.max(0, ordered.length - 1));
      } else if (event.key === "Enter" || event.key === " ") {
        const item = ordered[Number(row.getAttribute("data-ledger-index"))];
        if (!item) return;
        event.preventDefault();
        onSelect(item.entry.id);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onSelect, ordered]);

  return (
    <div className="ledger-drawer-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        ref={dialogRef}
        className="ledger-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="panel-heading">
          <strong id={titleId}>因果台帳</strong>
          <button type="button" onClick={onClose}>閉じる</button>
        </div>
        <p className="ledger-drawer-help">投資履歴を選び、接続差分・理由・副作用へ戻ります。危機寄与カードと同じ台帳IDで逆引きします。</p>
        <ul className="ledger-drawer-list" ref={listRef} aria-label="因果台帳の全件">
          {ordered.map((item, index) => {
            const selected = item.entry.id === focusedLedgerEntryId;
            const active = index === activeIndex;
            return (
              <li key={item.entry.id}>
                <button
                  type="button"
                  className={`ledger-drawer-row ${selected ? "selected" : ""} ${active ? "active" : ""}`}
                  data-ledger-index={index}
                  aria-current={selected ? "true" : undefined}
                  onFocus={() => setActiveIndex(index)}
                  onClick={() => onSelect(item.entry.id)}
                >
                  <span className="ledger-drawer-meta">#{item.ordinal} / {item.entry.year} / {item.entry.ruleVersion}</span>
                  <strong>{item.entry.relationshipLabel} / {item.entry.actionLabel}</strong>
                  <span className="ledger-drawer-reason">{item.entry.reason}</span>
                  {item.signature && <span className="ledger-signature-inline">{item.signature.text}</span>}
                  <div className="ledger-deltas">{Object.entries(item.entry.deltas).map(([key, delta]) => <i key={key}>{RELATIONSHIP_FIELD_META.find(([field]) => field === key)?.[1] ?? (key === "alternateRoutes" ? "代替経路" : "開示コスト")} {delta > 0 ? "+" : ""}{delta}</i>)}</div>
                  {Object.keys(item.entry.metricDeltas ?? {}).length > 0 && (
                    <div className="delta-list metric-deltas">{Object.entries(item.entry.metricDeltas).map(([key, delta]) => <i key={key}>{METRIC_DELTA_LABELS.get(key) ?? key} <b>{delta > 0 ? "+" : ""}{delta}</b></i>)}</div>
                  )}
                  {(item.entry.tradeoffs?.length ?? 0) > 0 && (
                    <div className="tradeoff-list">{item.entry.tradeoffs.map((tradeoff) => <i key={tradeoff}>{tradeoff}</i>)}</div>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function StressStrip({ state, onSelectContribution }) {
  const displayYears = getStressTestDisplayYears(state);
  return (
    <section className={`stress-strip ${displayYears.length > CHECKPOINTS.length ? "has-exploratory" : ""}`} aria-label="終末の1ヶ月ストレステスト">
      <div className="stress-heading"><strong>終末の1ヶ月</strong><span>{CRISIS_DAYS}日間、長期投資が持ちこたえるか確かめる</span></div>
      {displayYears.map((year) => {
        const result = state.stressTests[year];
        const exploratory = !CHECKPOINTS.includes(year);
        return (
          <article key={year} className={state.year === year ? "current" : ""}>
            <div><strong>{year}{exploratory ? " 任意" : ""}</strong><span>{result ? result.verdict : "未実施"}</span></div>
            {result ? <><ul><li><span>誤帰属回避</span><b>{result.attributionSafety}</b></li><li><span>協調継続</span><b>{result.coordinationSurvival}</b></li><li><span>民間保護</span><b>{result.civilianProtection}</b></li></ul><button className="contribution" onClick={() => onSelectContribution(year, result.relationshipContributions[0])}>{result.relationshipContributions[0].relationshipLabel} 寄与 +{result.relationshipContributions[0].coordinationSurvival}</button></> : <p>{year > state.year ? "この年まで接続を育てる" : "テストを実行して記録する"}</p>}
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
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [notice, setNotice] = useState("2035年のデモ状態を表示しています");
  const [focusedLedgerEntryId, setFocusedLedgerEntryId] = useState(null);
  const preview = previewRelationshipInvestment(state);
  const focusedLedgerEntry = state.ledger.find((entry) => entry.id === focusedLedgerEntryId) ?? null;
  const clearLedgerFocus = () => setFocusedLedgerEntryId(null);
  const handleAdvance = () => { clearLedgerFocus(); setState((current) => { const next = advanceYear(current); setNotice(next.year === current.year ? previewRelationshipInvestment(current).reason : `${next.year}年へ進み、${next.ledger.at(-1).relationshipLabel} の変化を台帳へ記録しました`); return next; }); };
  const handleStress = () => setState((current) => { const next = runStressTest(current); setNotice(`${current.year}年時点の終末の1ヶ月テストを記録しました`); return next; });
  const handleReset = () => { clearLedgerFocus(); setLedgerOpen(false); setState(createInitialState()); setNotice("2026年から新しいシミュレーションを開始しました"); };
  const handleRelationshipSelect = (id) => { clearLedgerFocus(); setState((current) => selectRelationship(current, id)); };
  const handleContributionSelect = (checkpointYear, contribution) => {
    const focus = getStressContributionFocus(state, checkpointYear, contribution.relationshipId);
    if (!focus) return;
    setState((current) => selectRelationship(current, focus.relationshipId));
    setFocusedLedgerEntryId(focus.ledgerEntryId);
    setLedgerOpen(false);
    setNotice(`${checkpointYear}年チェックポイントを生んだ因果台帳を表示しています`);
  };
  const handleLedgerSelect = (ledgerEntryId) => {
    const focus = getLedgerEntryFocus(state, ledgerEntryId);
    if (!focus) return;
    setState((current) => selectRelationship(current, focus.relationshipId));
    setFocusedLedgerEntryId(focus.ledgerEntryId);
    setLedgerOpen(false);
    setNotice(`因果台帳 ${focus.ledgerEntryId} の接続差分を表示しています`);
  };

  return (
    <main className="app-shell">
      <Header state={state} preview={preview} onAdvance={handleAdvance} onStress={handleStress} onCompare={() => { setLedgerOpen(false); setComparing((value) => !value); }} onReset={handleReset} comparing={comparing} />
      <div className="workspace"><ActorRail state={state} onSelect={(id) => setState((current) => selectActor(current, id))} /><div className="center-stack"><NetworkStage state={state} onSelectActor={(id) => setState((current) => selectActor(current, id))} onSelectRelationship={handleRelationshipSelect} focusedLedgerEntry={focusedLedgerEntry} /><ActionRail state={state} onChoose={(id) => { clearLedgerFocus(); setState((current) => selectAction(current, id)); }} focusedLedgerEntry={focusedLedgerEntry} onClearLedgerFocus={clearLedgerFocus} onOpenLedger={() => { setComparing(false); setLedgerOpen(true); }} /></div><Inspector state={state} focusedLedgerEntry={focusedLedgerEntry} /></div>
      <StressStrip state={state} onSelectContribution={handleContributionSelect} /><MetricRail state={state} />
      <footer className="app-footer"><span role="status" aria-live="polite">{notice}</span><span>モデル入力はすべて架空です</span></footer>
      {comparing && <Comparison state={state} onClose={() => setComparing(false)} />}
      {ledgerOpen && state.ledger.length > 0 && <LedgerDrawer state={state} focusedLedgerEntryId={focusedLedgerEntryId} onClose={() => setLedgerOpen(false)} onSelect={handleLedgerSelect} />}
    </main>
  );
}
