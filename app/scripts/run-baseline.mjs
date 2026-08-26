import {
  ACTIONS,
  createDemoState,
  createInitialState,
  advanceYear,
  runStressTest,
  selectAction,
} from "../src/simulation.js";

const oneYearDeltas = Object.fromEntries(ACTIONS.map((action) => {
  const initial = createInitialState();
  const next = advanceYear(selectAction(initial, action.id));
  const deltas = Object.fromEntries(Object.keys(initial.metrics).map((key) => [
    key,
    next.metrics[key] - initial.metrics[key],
  ]).filter(([, delta]) => delta !== 0));
  return [action.id, deltas];
}));

const demo = runStressTest(createDemoState(2035));
console.log(JSON.stringify({
  schemaVersion: 1,
  runType: "P0-baseline",
  deterministic: true,
  oneYearDeltas,
  demo2035: {
    metrics: demo.metrics,
    stressTest: demo.stressTests[2035],
  },
  limitations: [
    "relationships-are-not-stateful",
    "actors-do-not-yet-change-behavior",
    "crisis-does-not-yet-execute-120-events",
    "comparison-strategies-are-not-yet-run-by-one-engine",
  ],
}, null, 2));

