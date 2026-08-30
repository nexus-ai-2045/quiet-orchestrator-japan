import { CRISIS_TURNS, CRISIS_TURN_HOURS, validateSimulationExecutionState } from "./simulation.js";
import { ACTOR_CONSTRAINTS } from "./ai/actor-governance.js";
import { observationFingerprint } from "./ai/contract.js";

export const CRISIS_ENGINE_VERSION = "crisis-event-v2";
export const CRISIS_COEFFICIENT_VERSION = "crisis-coefficients-v1";
export const DEFAULT_CRISIS_COEFFICIENTS = Object.freeze({
  attributionCorrectionOffset: 0,
  disruptionDurationScale: 1,
});
export const CRISIS_PHASES = Object.freeze([
  { start: 0, end: 11, name: "衝撃" }, { start: 12, end: 27, name: "帰属競争" },
  { start: 28, end: 55, name: "生活圧力" }, { start: 56, end: 83, name: "制度疲労" },
  { start: 84, end: 99, name: "二次衝撃" }, { start: 100, end: 111, name: "復旧競争" },
  { start: 112, end: 119, name: "出口" },
].map(Object.freeze));
export const CONTRACTED_CAUSE_WORLDS = Object.freeze({
  "cause-0": Object.freeze({ id: "S1", causeCode: "coordinated-cross-domain-coercion", evidenceQuality: 0.75, harmIntensity: 1.2, ambiguity: 0.2 }),
  "cause-1": Object.freeze({ id: "S2", causeCode: "maritime-accident-plus-independent-cybercrime", evidenceQuality: 0.55, harmIntensity: 0.8, ambiguity: 0.7 }),
  "cause-2": Object.freeze({ id: "S3", causeCode: "third-party-or-non-state-incitement", evidenceQuality: 0.45, harmIntensity: 0.9, ambiguity: 0.8 }),
  "cause-3": Object.freeze({ id: "S4", causeCode: "equipment-weather-and-operator-error", evidenceQuality: 0.65, harmIntensity: 0.6, ambiguity: 0.9 }),
  "cause-4": Object.freeze({ id: "S5", causeCode: "partial-coercion-plus-unrelated-events", evidenceQuality: 0.5, harmIntensity: 1, ambiguity: 0.9 }),
});
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
const CAUSE_WORLDS = Object.values(CONTRACTED_CAUSE_WORLDS);
const causeForSeed = (seed) => CONTRACTED_CAUSE_WORLDS[seed] ?? CAUSE_WORLDS[Math.floor(seededUnit(seed, 900) * CAUSE_WORLDS.length) % CAUSE_WORLDS.length];

function fallbackAssessment(state, disabled) {
  return [...disabled].sort().map((relationshipId) => {
    const relationship = state.relationships[relationshipId];
    const criticalFunction = FALLBACK_FUNCTION_BY_CHANNEL[relationship.channel];
    if (!criticalFunction) throw new TypeError(`relationship channel lacks a fallback function contract: ${relationship.channel}`);
    const alternatives = Object.entries(state.relationships).filter(([id, item]) => id !== relationshipId && !disabled.has(id) && FALLBACK_FUNCTION_BY_CHANNEL[item.channel] === criticalFunction && item.state.alternateRoutes > 0);
    return { relationshipId, function: criticalFunction, available: alternatives.length > 0, alternateRelationshipIds: alternatives.map(([id]) => id).sort() };
  });
}

function actorView(seed, turn, truth, confidence, falseAttribution, activeActorIds) {
  return Object.values(ACTOR_CONSTRAINTS).filter((profile) => activeActorIds.has(profile.actorId)).map((profile) => {
    const accessPenalty = profile.evidenceAccess === "restricted" ? 18 : profile.evidenceAccess === "controlled" ? 10 : 4;
    const fragment = Math.round(seededUnit(`${seed}:${profile.actorId}`, turn) * 20) - accessPenalty;
    const visibleConfidence = Math.max(0, Math.min(100, confidence + fragment));
    const canVerify = profile.capabilities.includes("verify");
    const attribution = canVerify && visibleConfidence >= 70 ? truth.causeCode : falseAttribution && visibleConfidence >= 45 ? "fictional-rival" : "unknown";
    const decision = profile.constraints.includes("time-pressure") && visibleConfidence < 60 ? "protect-and-withhold" : canVerify ? "request-corroboration" : profile.capabilities.includes("translate") ? "share-minimum" : "hold-position";
    return { actorId: profile.actorId, visibleConfidence, attribution, decision, decisionRights: profile.decisionRights };
  });
}

function summarizeActorDecisions(observations) {
  const verifiedActors = observations.filter((item) => item.attribution !== "unknown" && item.attribution !== "fictional-rival").length;
  const corroboratingActors = observations.filter((item) => item.decision === "request-corroboration" || item.decision === "share-minimum").length;
  const pressureActors = observations.filter((item) => item.decision === "protect-and-withhold" || item.decision === "hold-position").length;
  const authorizedApprovers = observations.filter((item) => item.decisionRights.approve && item.visibleConfidence >= 45).length;
  const authorizedExecutors = observations.filter((item) => item.decisionRights.execute && item.visibleConfidence >= 35).length;
  return { activeActors: observations.length, verifiedActors, corroboratingActors, pressureActors, authorizedApprovers, authorizedExecutors };
}

const correctionAuthorized = (decision) => decision.activeActors > 0
  && decision.verifiedActors >= 1
  && decision.corroboratingActors >= 6
  && decision.authorizedApprovers >= 1;

function normalizeCoefficients(coefficients = DEFAULT_CRISIS_COEFFICIENTS) {
  const candidate = { ...DEFAULT_CRISIS_COEFFICIENTS, ...coefficients };
  if (!Number.isInteger(candidate.attributionCorrectionOffset) || candidate.attributionCorrectionOffset < -8 || candidate.attributionCorrectionOffset > 8) throw new TypeError("attributionCorrectionOffset must be an integer from -8 to 8");
  if (!Number.isFinite(candidate.disruptionDurationScale) || candidate.disruptionDurationScale < 0.5 || candidate.disruptionDurationScale > 1.5) throw new TypeError("disruptionDurationScale must be from 0.5 to 1.5");
  return candidate;
}

function runValidated(state, { seed, disabledRelationshipIds, coefficients }) {
  const disabled = new Set(disabledRelationshipIds);
  if (disabled.size !== disabledRelationshipIds.length || disabledRelationshipIds.some((id) => !state.relationships[id])) throw new TypeError("disabledRelationshipIds must contain unique canonical relationship IDs");
  const fallbackAssessments = fallbackAssessment(state, disabled);
  const activeActorIds = new Set(Object.entries(state.relationships).flatMap(([id, relationship]) => (
    disabled.has(id) ? [] : [relationship.source, relationship.target]
  )));
  const verification = state.metrics.verification;
  const continuity = state.metrics.continuity;
  const causeWorld = causeForSeed(seed);
  const unavailableFunctions = fallbackAssessments.filter((item) => !item.available).length;
  const topologyPenalty = unavailableFunctions * 2 + Math.ceil(disabled.size / 5);
  const nominalCorrectionTurn = Math.max(32, Math.min(68, 40 + Math.floor(seededUnit(seed, 901) * 12) + Math.round(causeWorld.ambiguity * 8 - causeWorld.evidenceQuality * 4) + topologyPenalty + coefficients.attributionCorrectionOffset));
  const decisionAt = (turn, falseAttribution = true) => {
    const confidence = Math.max(5, Math.min(95, verification - 8 + Math.round(causeWorld.evidenceQuality * 20) + Math.round(seededUnit(seed, turn) * 12) - topologyPenalty));
    const truth = { causeCode: causeWorld.causeCode, causeWorldId: causeWorld.id, physicalIntegrity: "operational" };
    return summarizeActorDecisions(actorView(seed, turn, truth, confidence, falseAttribution, activeActorIds));
  };
  let correctionTurn = null;
  for (let candidateTurn = nominalCorrectionTurn; candidateTurn <= 68; candidateTurn += 1) {
    if (correctionAuthorized(decisionAt(candidateTurn))) {
      correctionTurn = candidateTurn;
      break;
    }
  }
  const nominalIrreversible = 26 + Math.floor(seededUnit(seed, 902) * 12) - Math.min(10, topologyPenalty);
  const irreversibleDecision = decisionAt(Math.max(20, nominalIrreversible));
  const irreversibleTurn = Math.max(20, nominalIrreversible + (irreversibleDecision.authorizedExecutors === 0 ? 2 : 0) + (irreversibleDecision.pressureActors < 8 ? 2 : 0));
  const disruptionStart = 66 + Math.floor(seededUnit(seed, 903) * 16);
  const baseDisruptionDuration = 12 + Math.floor(seededUnit(seed, 904) * 18);
  const disruptionEnd = Math.min(108, disruptionStart + Math.max(1, Math.round(baseDisruptionDuration * coefficients.disruptionDurationScale)));
  const events = Array.from({ length: CRISIS_TURNS }, (_, turn) => {
    const falseAttribution = turn >= 18 && (correctionTurn === null || turn < correctionTurn);
    const correction = correctionTurn !== null && turn === correctionTurn;
    const irreversible = turn === irreversibleTurn;
    const disruption = turn >= disruptionStart && turn < disruptionEnd;
    const failedFunctions = disruption ? fallbackAssessments.filter((item) => !item.available) : [];
    const observationConfidence = Math.max(5, Math.min(95, verification - (disruption ? 25 : 8) + Math.round(causeWorld.evidenceQuality * 20) + Math.round(seededUnit(seed, turn) * 12) - topologyPenalty));
    const truth = { causeCode: causeWorld.causeCode, causeWorldId: causeWorld.id, physicalIntegrity: disruption ? "degraded" : "operational" };
    const actorObservations = actorView(seed, turn, truth, observationConfidence, falseAttribution, activeActorIds);
    const actorDecision = summarizeActorDecisions(actorObservations);
    const claimStatus = correction ? "corrected" : falseAttribution ? "misattributed" : "withheld";
    const action = irreversible ? "raise-readiness" : correction ? "publish-correction" : disruption ? "route-around" : "verify-and-wait";
    return {
      sequence: turn, turn: turn + 1, elapsedHours: turn * CRISIS_TURN_HOURS, day: Math.floor((turn * CRISIS_TURN_HOURS) / 24) + 1,
      phase: phaseAt(turn), truth, observation: { confidence: observationConfidence, communications: disruption ? "delayed" : "available" },
      claim: { status: claimStatus, attributionCode: falseAttribution ? "fictional-rival" : null },
      proposal: { action, basedOnVerifiedAttribution: !falseAttribution && correctionAuthorized(actorDecision) }, action: { id: action, irreversible },
      decision: actorDecision,
      consequence: { fallbackAvailable: failedFunctions.length === 0, coordination: failedFunctions.length > 0 || actorDecision.authorizedApprovers === 0 ? "failed" : continuity >= 45 && actorDecision.corroboratingActors >= 6 ? "maintained" : "strained", civilianImpact: failedFunctions.length > 0 || (irreversible && causeWorld.harmIntensity >= 1) ? "high" : irreversible ? "elevated" : "contained" },
      important: turn === 0 || turn === 18 || irreversible || correction || turn === disruptionStart || turn === disruptionEnd || turn === 119,
    };
  });
  const actorObservationFrames = CRISIS_PHASES.map(({ start, name }) => ({ phase: name, sequence: start, observations: actorView(seed, start, events[start].truth, events[start].observation.confidence, events[start].claim.status === "misattributed", activeActorIds).map(({ decisionRights, ...item }) => item) }));
  return { engineVersion: CRISIS_ENGINE_VERSION, coefficientVersion: CRISIS_COEFFICIENT_VERSION, coefficients: { ...coefficients }, seed, disabledRelationshipIds: [...disabled].sort(), fallbackAssessments, actorObservationFrames, causalParameters: { causeWorldId: causeWorld.id, causeCode: causeWorld.causeCode, evidenceQuality: causeWorld.evidenceQuality, harmIntensity: causeWorld.harmIntensity, ambiguity: causeWorld.ambiguity }, transitionParameters: { correctionTurn, correctionStatus: correctionTurn === null ? "uncorrected" : "corrected", irreversibleTurn, disruptionStart, disruptionEnd, topologyPenalty }, frozenStrategicYear: state.year, frozenStateHash: observationFingerprint(state), turns: CRISIS_TURNS, events, importantEvents: events.filter((event) => event.important), eventStreamHash: observationFingerprint(events) };
}

export function runCrisisSimulation(state, { seed = state?.seed ?? "crisis-0", disabledRelationshipIds = [], coefficients } = {}) {
  const report = validateSimulationExecutionState(state);
  if (!report.valid) throw new TypeError(`invalid simulation state: ${report.errors[0]}`);
  if (typeof seed !== "string" || seed.length === 0) throw new TypeError("seed must be a non-empty string");
  if (!Array.isArray(disabledRelationshipIds)) throw new TypeError("disabledRelationshipIds must be an array");
  return runValidated(state, { seed, disabledRelationshipIds, coefficients: normalizeCoefficients(coefficients) });
}

export function runCrisisSimulationBatch(state, scenarios) {
  const report = validateSimulationExecutionState(state);
  if (!report.valid) throw new TypeError(`invalid simulation state: ${report.errors[0]}`);
  if (!Array.isArray(scenarios) || scenarios.length === 0) throw new TypeError("scenarios must be a non-empty array");
  return scenarios.map(({ seed, disabledRelationshipIds = [], coefficients }) => {
    if (typeof seed !== "string" || seed.length === 0 || !Array.isArray(disabledRelationshipIds)) throw new TypeError("invalid crisis scenario");
    return runValidated(state, { seed, disabledRelationshipIds, coefficients: normalizeCoefficients(coefficients) });
  });
}

export function replayCrisisEvent(run, sequence) {
  if (!run || run.engineVersion !== CRISIS_ENGINE_VERSION || !Array.isArray(run.events)) return null;
  if (!Number.isInteger(sequence) || sequence < 0 || sequence >= run.events.length) return null;
  return run.events[sequence];
}
