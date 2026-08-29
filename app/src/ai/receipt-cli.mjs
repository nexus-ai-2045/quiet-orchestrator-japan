import fs from "node:fs";
import {
  buildObservation,
  createAiReceipt,
  receiptsToJsonl,
  runFixtureSimulation,
} from "./contract.js";
import { buildAiStateSummary } from "./apply-proposal.js";
import { createDemoState } from "../simulation.js";

const input = fs.readFileSync(0, "utf8").trim();
const request = input ? JSON.parse(input) : {};

if (request.command === "fixture") {
  process.stdout.write(`${receiptsToJsonl(runFixtureSimulation(request.seed, buildAiStateSummary(createDemoState(2035))))}\n`);
} else if (request.command === "observation") {
  process.stdout.write(`${JSON.stringify(buildObservation(request))}\n`);
} else if (request.command === "receipt") {
  process.stdout.write(`${JSON.stringify(createAiReceipt(request))}\n`);
} else if (request.command === "demo-state-summary") {
  process.stdout.write(`${JSON.stringify(buildAiStateSummary(createDemoState(2035)))}\n`);
} else {
  throw new Error("command must be fixture, observation, receipt, or demo-state-summary");
}
