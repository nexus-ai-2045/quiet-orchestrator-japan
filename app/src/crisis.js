import { CRISIS_TURNS, CRISIS_TURN_HOURS, validateSimulationExecutionState } from "./simulation.js";
import { observationFingerprint } from "./ai/contract.js";

export const CRISIS_ENGINE_VERSION = "crisis-event-v1";
const PHASES = Object.freeze([
  [0, "初動"], [12, "帰属競争"], [30, "警戒上昇"], [48, "持久"],
  [72, "連鎖障害"], [92, "出口形成"], [108, "復旧"],
]);

const phaseAt = (turn) => [...PHASES].reverse().find(([start]) => turn >= start)[1];
const seededUnit = (seed, turn) => parseInt(observationFingerprint(`${seed}:${turn}`).slice(-8), 16) / 0xffffffff;

export function runCrisisSimulation(state, { seed = state?.seed ?? "crisis-0", disabledRelationshipIds = [] } = {}) {
  const report = validateSimulationExecutionState(state);
  if (!report.valid) throw new TypeError(`invalid simulation state: ${report.errors[0]}`);
  if (typeof seed !== "string" || seed.length === 0) throw new TypeError("seed must be a non-empty string");
  if (!Array.isArray(disabledRelationshipIds)) throw new TypeError("disabledRelationshipIds must be an array");
  const disabled = new Set(disabledRelationshipIds);
  if (disabled.size !== disabledRelationshipIds.length || disabledRelationshipIds.some((id) => !state.relationships[id])) {
    throw new TypeError("disabledRelationshipIds must contain unique canonical relationship IDs");
  }
  const relationships = Object.values(state.relationships);
  const enabledRelationshipCount = relationships.length - disabled.size;
  const alternateRoutes = Object.entries(state.relationships).reduce(
    (sum, [id, item]) => sum + (disabled.has(id) ? 0 : item.state.alternateRoutes),
    0,
  );
  const verification = state.metrics.verification;
  const continuity = state.metrics.continuity;
  const events = Array.from({ length: CRISIS_TURNS }, (_, turn) => {
    const phase = phaseAt(turn);
    const falseAttribution = turn >= 18 && turn < 46;
    const correction = turn === 46;
    const irreversible = turn === 31;
    const disruption = turn >= 72 && turn < 92;
    const fallbackAvailable = enabledRelationshipCount > 0 && alternateRoutes >= enabledRelationshipCount * 1.5;
    const noise = Math.round(seededUnit(seed, turn) * 12);
    const observationConfidence = Math.max(5, Math.min(95, verification - (disruption ? 25 : 8) + noise));
    const claimStatus = correction ? "corrected" : falseAttribution ? "misattributed" : "withheld";
    const action = irreversible ? "raise-readiness" : correction ? "publish-correction" : disruption ? "route-around" : "verify-and-wait";
    const failed = disruption && !fallbackAvailable;
    return {
      sequence: turn,
      turn: turn + 1,
      elapsedHours: turn * CRISIS_TURN_HOURS,
      day: Math.floor((turn * CRISIS_TURN_HOURS) / 24) + 1,
      phase,
      truth: { causeCode: "fictional-third-party-spoof", physicalIntegrity: disruption ? "degraded" : "operational" },
      observation: { confidence: observationConfidence, communications: disruption ? "delayed" : "available" },
      claim: { status: claimStatus, attributionCode: falseAttribution ? "fictional-rival" : null },
      proposal: { action, basedOnVerifiedAttribution: !falseAttribution && observationConfidence >= 60 },
      action: { id: action, irreversible },
      consequence: {
        fallbackAvailable,
        coordination: failed ? "failed" : continuity >= 45 ? "maintained" : "strained",
        civilianImpact: failed ? "high" : irreversible ? "elevated" : "contained",
      },
      important: turn === 0 || turn === 18 || irreversible || correction || turn === 72 || turn === 92 || turn === 119,
    };
  });
  return {
    engineVersion: CRISIS_ENGINE_VERSION,
    seed,
    disabledRelationshipIds: [...disabledRelationshipIds].sort(),
    frozenStrategicYear: state.year,
    frozenStateHash: observationFingerprint(state),
    turns: CRISIS_TURNS,
    events,
    importantEvents: events.filter((event) => event.important),
    eventStreamHash: observationFingerprint(events),
  };
}

export function replayCrisisEvent(run, sequence) {
  if (!run || run.engineVersion !== CRISIS_ENGINE_VERSION || !Array.isArray(run.events)) return null;
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= run.events.length) return null;
  return run.events[sequence];
}
