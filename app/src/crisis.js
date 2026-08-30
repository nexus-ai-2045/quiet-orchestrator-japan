import { CRISIS_TURNS, CRISIS_TURN_HOURS, validateSimulationExecutionState } from "./simulation.js";
import { ACTOR_CONSTRAINTS } from "./ai/actor-governance.js";
import { observationFingerprint } from "./ai/contract.js";

export const CRISIS_ENGINE_VERSION = "crisis-event-v2";
export const CRISIS_PHASES = Object.freeze([
  { start: 0, end: 11, name: "衝撃" }, { start: 12, end: 27, name: "帰属競争" },
  { start: 28, end: 55, name: "生活圧力" }, { start: 56, end: 83, name: "制度疲労" },
  { start: 84, end: 99, name: "二次衝撃" }, { start: 100, end: 111, name: "復旧競争" },
  { start: 112, end: 119, name: "出口" },
].map(Object.freeze));
const FICTIONAL_CAUSES = Object.freeze(["fictional-third-party-spoof", "fictional-sensor-cascade", "fictional-insider-manipulation", "fictional-routing-failure", "fictional-coordinated-deception"]);
const FALLBACK_FUNCTION_BY_CHANNEL = Object.freeze({
  "危機状況・停止条件プロトコル": "crisis-stop-conditions",
  "国内危機継続回線": "crisis-stop-conditions",
  "分析クロスチェック回線": "analysis-verification",
  "分析証拠開示回線": "analysis-verification",
  "軍事観測検証回線": "contact-attribution",
  "海上接触確認回線": "contact-attribution",
  "接触帰属検証回線": "contact-attribution",
  "海上保安運用回線": "maritime-continuity",
  "海上現場停止回線": "maritime-continuity",
  "民間供給網回線": "civilian-supply-continuity",
  "供給網継続回線": "civilian-supply-continuity",
  "民間経済継続回線": "civilian-supply-continuity",
  "民間観測取込回線": "civilian-evidence",
  "民間証拠共同所有回線": "civilian-evidence",
  "公式主張検証回線": "public-claim-correction",
  "公開主張訂正回線": "public-claim-correction",
  "公開説明監査回線": "public-claim-correction",
  "経済影響共同検証回線": "economic-impact-verification",
  "サイバー帰属検証回線": "cyber-attribution",
  "共同検証プロトコル": "shared-verification",
});
const phaseAt = (turn) => CRISIS_PHASES.find(({ start, end }) => turn >= start && turn <= end)?.name;
const seededUnit = (seed, turn) => parseInt(observationFingerprint(`${seed}:${turn}`).slice(-8), 16) / 0xffffffff;
const causeForSeed = (seed) => {
  const registered = /^cause-([0-4])$/.exec(seed);
  return registered ? FICTIONAL_CAUSES[Number(registered[1])] : FICTIONAL_CAUSES[Math.floor(seededUnit(seed, 900) * FICTIONAL_CAUSES.length) % FICTIONAL_CAUSES.length];
};

function fallbackAssessment(state, disabled) {
  return [...disabled].sort().map((relationshipId) => {
    const relationship = state.relationships[relationshipId];
    const criticalFunction = FALLBACK_FUNCTION_BY_CHANNEL[relationship.channel];
    if (!criticalFunction) throw new TypeError(`relationship channel lacks a fallback function contract: ${relationship.channel}`);
    const alternatives = Object.entries(state.relationships).filter(([id, item]) => id !== relationshipId && !disabled.has(id) && FALLBACK_FUNCTION_BY_CHANNEL[item.channel] === criticalFunction && item.state.alternateRoutes > 0);
    return { relationshipId, function: criticalFunction, available: alternatives.length > 0, alternateRelationshipIds: alternatives.map(([id]) => id).sort() };
  });
}

function actorView(seed, turn, truth, confidence, falseAttribution) {
  return Object.values(ACTOR_CONSTRAINTS).map((profile) => {
    const accessPenalty = profile.evidenceAccess === "restricted" ? 18 : profile.evidenceAccess === "controlled" ? 10 : 4;
    const fragment = Math.round(seededUnit(`${seed}:${profile.actorId}`, turn) * 20) - accessPenalty;
    const visibleConfidence = Math.max(0, Math.min(100, confidence + fragment));
    const canVerify = profile.capabilities.includes("verify");
    const attribution = canVerify && visibleConfidence >= 70 ? truth.causeCode : falseAttribution && visibleConfidence >= 45 ? "fictional-rival" : "unknown";
    const decision = profile.constraints.includes("time-pressure") && visibleConfidence < 60 ? "protect-and-withhold" : canVerify ? "request-corroboration" : profile.capabilities.includes("translate") ? "share-minimum" : "hold-position";
    return { actorId: profile.actorId, visibleConfidence, attribution, decision };
  });
}

function runValidated(state, { seed, disabledRelationshipIds }) {
  const disabled = new Set(disabledRelationshipIds);
  if (disabled.size !== disabledRelationshipIds.length || disabledRelationshipIds.some((id) => !state.relationships[id])) throw new TypeError("disabledRelationshipIds must contain unique canonical relationship IDs");
  const fallbackAssessments = fallbackAssessment(state, disabled);
  const verification = state.metrics.verification;
  const continuity = state.metrics.continuity;
  const causeCode = causeForSeed(seed);
  const correctionTurn = 40 + Math.floor(seededUnit(seed, 901) * 20);
  const irreversibleTurn = 26 + Math.floor(seededUnit(seed, 902) * 12);
  const disruptionStart = 66 + Math.floor(seededUnit(seed, 903) * 16);
  const disruptionEnd = Math.min(108, disruptionStart + 12 + Math.floor(seededUnit(seed, 904) * 18));
  const events = Array.from({ length: CRISIS_TURNS }, (_, turn) => {
    const falseAttribution = turn >= 18 && turn < correctionTurn;
    const correction = turn === correctionTurn;
    const irreversible = turn === irreversibleTurn;
    const disruption = turn >= disruptionStart && turn < disruptionEnd;
    const failedFunctions = disruption ? fallbackAssessments.filter((item) => !item.available) : [];
    const observationConfidence = Math.max(5, Math.min(95, verification - (disruption ? 25 : 8) + Math.round(seededUnit(seed, turn) * 12)));
    const truth = { causeCode, physicalIntegrity: disruption ? "degraded" : "operational" };
    const claimStatus = correction ? "corrected" : falseAttribution ? "misattributed" : "withheld";
    const action = irreversible ? "raise-readiness" : correction ? "publish-correction" : disruption ? "route-around" : "verify-and-wait";
    return {
      sequence: turn, turn: turn + 1, elapsedHours: turn * CRISIS_TURN_HOURS, day: Math.floor((turn * CRISIS_TURN_HOURS) / 24) + 1,
      phase: phaseAt(turn), truth, observation: { confidence: observationConfidence, communications: disruption ? "delayed" : "available" },
      claim: { status: claimStatus, attributionCode: falseAttribution ? "fictional-rival" : null },
      proposal: { action, basedOnVerifiedAttribution: !falseAttribution && observationConfidence >= 60 }, action: { id: action, irreversible },
      consequence: { fallbackAvailable: failedFunctions.length === 0, coordination: failedFunctions.length > 0 ? "failed" : continuity >= 45 ? "maintained" : "strained", civilianImpact: failedFunctions.length > 0 ? "high" : irreversible ? "elevated" : "contained" },
      important: turn === 0 || turn === 18 || irreversible || correction || turn === disruptionStart || turn === disruptionEnd || turn === 119,
    };
  });
  const actorObservationFrames = CRISIS_PHASES.map(({ start, name }) => ({ phase: name, sequence: start, observations: actorView(seed, start, events[start].truth, events[start].observation.confidence, events[start].claim.status === "misattributed") }));
  return { engineVersion: CRISIS_ENGINE_VERSION, seed, disabledRelationshipIds: [...disabled].sort(), fallbackAssessments, actorObservationFrames, causalParameters: { causeCode, correctionTurn, irreversibleTurn, disruptionStart, disruptionEnd }, frozenStrategicYear: state.year, frozenStateHash: observationFingerprint(state), turns: CRISIS_TURNS, events, importantEvents: events.filter((event) => event.important), eventStreamHash: observationFingerprint(events) };
}

export function runCrisisSimulation(state, { seed = state?.seed ?? "crisis-0", disabledRelationshipIds = [] } = {}) {
  const report = validateSimulationExecutionState(state);
  if (!report.valid) throw new TypeError(`invalid simulation state: ${report.errors[0]}`);
  if (typeof seed !== "string" || seed.length === 0) throw new TypeError("seed must be a non-empty string");
  if (!Array.isArray(disabledRelationshipIds)) throw new TypeError("disabledRelationshipIds must be an array");
  return runValidated(state, { seed, disabledRelationshipIds });
}

export function runCrisisSimulationBatch(state, scenarios) {
  const report = validateSimulationExecutionState(state);
  if (!report.valid) throw new TypeError(`invalid simulation state: ${report.errors[0]}`);
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError("scenarios must be a non-empty array");
  return scenarios.map(({ seed, disabledRelationshipIds = [] }) => {
    if (typeof seed !== "string" || seed.length === 0 || !Array.isArray(disabledRelationshipIds)) throw new TypeError("invalid crisis scenario");
    return runValidated(state, { seed, disabledRelationshipIds });
  });
}

export function replayCrisisEvent(run, sequence) {
  if (!run || run.engineVersion !== CRISIS_ENGINE_VERSION || !Array.isArray(run.events)) return null;
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= run.events.length) return null;
  return run.events[sequence];
}
