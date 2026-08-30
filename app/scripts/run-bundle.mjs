import { createDemoState } from "../src/simulation.js";
import { buildMetaSecurityRunBundle } from "../src/run-bundle.js";
import { resolveImplementationRevision } from "../src/run-bundle-provenance.js";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const valueAfter = (flag, fallback) => {
  const index = args.indexOf(flag);
  return index === -1 ? fallback : args[index + 1];
};
const seed = Number(valueAfter("--seed", "404"));
const maxSteps = Number(valueAfter("--max-steps", "9"));
const implementationRepoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const implementationRevision = resolveImplementationRevision(implementationRepoRoot);
const bundle = buildMetaSecurityRunBundle(createDemoState(2035), { seed, maxSteps, implementationRevision });
process.stdout.write(`${JSON.stringify(bundle, null, 2)}\n`);
