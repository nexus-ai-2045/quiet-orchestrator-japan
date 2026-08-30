import { createDemoState } from "../src/simulation.js";
import { buildMetaSecurityRunBundle } from "../src/run-bundle.js";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const seed = Number(valueAfter("--seed", "404"));
const maxSteps = Number(valueAfter("--max-steps", "9"));
const implementationRevision = process.env.GITHUB_SHA
  || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const bundle = buildMetaSecurityRunBundle(createDemoState(2035), { seed, maxSteps, implementationRevision });
process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
