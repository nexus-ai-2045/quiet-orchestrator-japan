import { CHECKPOINTS, END_YEAR, runStressTest } from "../simulation.js";
import { applyValidatedAiProposal, buildAiStateSummary } from "./apply-proposal.js";
import { observationFingerprint, runFixtureSimulation } from "./contract.js";

const LOCAL_PDCA_ACTORS = Object.freeze(["B1", "J2", "C6"]);
const LOCAL_PDCA_STEP_COUNT = 9;

function assertStep(step) {
  if (!Number.isInteger(step) || step < 0 || step >= LOCAL_PDCA_STEP_COUNT) {
    throw new RangeError("step must be an integer from 0 through 8");
  }
}
function assertSeed(seed) {
  if (typeof seed !== "string" || seed.length === 0) throw new TypeError("seed must be a non-empty string");
}

function planFor(state, step, seed) {
  return runFixtureSimulation(seed, buildAiStateSummary(state))[step];
}

function attempt(state, step, seed) {
  const receipt = planFor(state, step, seed);
  return { receipt, result: applyValidatedAiProposal(state, receipt) };
}

export function runOneLocalPdcaStep(state, step, seed = "hackathon-mvp-0") {
  assertStep(step);
  assertSeed(seed);
  if (!state || typeof state !== "object" || Array.isArray(state)) throw new TypeError("state must be an object");

  const actorId = LOCAL_PDCA_ACTORS[step % LOCAL_PDCA_ACTORS.length];
  const turn = Math.floor(step / LOCAL_PDCA_ACTORS.length) + 1;
  const beforeStateHash = observationFingerprint(state);
  const beforeLedgerLength = state.ledger.length;
  let workingState = state;
  let checkpoint = null;
  let planned = attempt(workingState, step, seed);
  const attempts = [{
    observationHash: planned.receipt.observationHash,
    stateHash: planned.receipt.observation.stateSummary.stateHash,
    applied: planned.result.applied,
    errors: [...planned.result.errors],
  }];

  const checkpointPending = CHECKPOINTS.includes(state.year) && !state.stressTests[state.year];
  if (!planned.result.applied && planned.result.errors.includes("deterministic_core_rejected") && checkpointPending) {
    const testedState = runStressTest(state);
    checkpoint = {
      year: state.year,
      beforeStateHash: observationFingerprint(state),
      afterStateHash: observationFingerprint(testedState),
      recorded: Boolean(testedState.stressTests[state.year]),
    };
    workingState = testedState;
    planned = attempt(workingState, step, seed);
    attempts.push({
      observationHash: planned.receipt.observationHash,
      stateHash: planned.receipt.observation.stateSummary.stateHash,
      applied: planned.result.applied,
      errors: [...planned.result.errors],
    });
  }

  const nextState = planned.result.applied ? planned.result.state : state;
  const afterStateHash = observationFingerprint(nextState);
  const nextStep = planned.result.applied ? step + 1 : step;
  const nextActorId = nextStep < LOCAL_PDCA_STEP_COUNT ? LOCAL_PDCA_ACTORS[nextStep % LOCAL_PDCA_ACTORS.length] : null;
  const nextTurn = nextStep < LOCAL_PDCA_STEP_COUNT ? Math.floor(nextStep / LOCAL_PDCA_ACTORS.length) + 1 : null;

  return {
    state: nextState,
    completed: planned.result.applied,
    step,
    actorId,
    turn,
    plan: { receipt: planned.receipt },
    do: {
      applied: planned.result.applied,
      errors: [...planned.result.errors],
      execution: planned.result.execution ?? null,
      attempts,
      checkpoint,
    },
    check: {
      beforeStateHash,
      afterStateHash,
      stateChanged: beforeStateHash !== afterStateHash,
      ledgerLengthBefore: beforeLedgerLength,
      ledgerLengthAfter: nextState.ledger.length,
      appendedLedgerIds: nextState.ledger.slice(beforeLedgerLength).map((entry) => entry.id),
    },
    act: {
      nextStep,
      nextActorId,
      nextTurn,
      nextStateSummary: buildAiStateSummary(nextState),
    },
  };
}

export function canCompleteLocalPdca(state, nextStep) {
  if (!state || !Number.isInteger(state.year) || !Number.isInteger(nextStep)) return false;
  return END_YEAR - state.year >= LOCAL_PDCA_STEP_COUNT - nextStep;
}

export function runLocalPdcaSimulation(initialState, { maxSteps = LOCAL_PDCA_STEP_COUNT, seed = "hackathon-mvp-0" } = {}) {
  if (!Number.isInteger(maxSteps) || maxSteps < 0 || maxSteps > LOCAL_PDCA_STEP_COUNT) {
    throw new RangeError("maxSteps must be an integer from 0 through 9");
  }
  assertSeed(seed);
  let state = initialState;
  const steps = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const cycle = runOneLocalPdcaStep(state, step, seed);
    steps.push(cycle);
    if (!cycle.completed) break;
    state = cycle.state;
  }
  return {
    state,
    seed,
    steps,
    completedSteps: steps.filter((cycle) => cycle.completed).length,
    completed: steps.length === maxSteps && steps.every((cycle) => cycle.completed),
    nextStep: steps.at(-1)?.act.nextStep ?? 0,
  };
}
