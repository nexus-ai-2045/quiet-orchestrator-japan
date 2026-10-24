/** PREFLIGHT.md の完了観測を固定schemaとしてfail closedで検証する。 */
const MARKER = "<!-- repo-preflight-result:v1 -->";
const REQUIRED_KEYS = ["ciConfigCount", "cleanWorktree", "contentHead", "effectiveIdentity", "effectiveMismatchCount", "historyMismatchCount", "intent", "origin", "personalPaths", "schemaVersion", "secretCandidates", "status"];

export function isIdentifyingGitShaPrefix(value) {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/.test(value);
}

function requireInteger(value, name, minimum = 0) {
  if (!Number.isInteger(value) || value < minimum) throw new Error(`repo-preflight ${name} must be an integer >= ${minimum}`);
}

export function parseCompletedPreflightEvidence(document) {
  const source = String(document ?? "");
  const markerIndex = source.indexOf(MARKER);
  if (markerIndex < 0) throw new Error("PREFLIGHT.md missing repo-preflight-result:v1 marker");
  const match = source.slice(markerIndex + MARKER.length).match(/^\s*```json\s*\n([\s\S]*?)\n```/);
  if (!match) throw new Error("PREFLIGHT.md missing repo-preflight-result:v1 JSON block");
  let evidence;
  try { evidence = JSON.parse(match[1]); } catch { throw new Error("PREFLIGHT.md repo-preflight-result:v1 must be valid JSON"); }
  if (!evidence || Array.isArray(evidence) || typeof evidence !== "object") throw new Error("PREFLIGHT.md repo-preflight-result:v1 must be an object");
  if (JSON.stringify(Object.keys(evidence).sort()) !== JSON.stringify(REQUIRED_KEYS)) throw new Error("PREFLIGHT.md repo-preflight-result:v1 keys do not match the fixed schema");
  if (evidence.schemaVersion !== 1 || evidence.status !== "pass" || evidence.intent !== "ready_after_confirmation") throw new Error("PREFLIGHT.md repo-preflight-result:v1 has a non-completed status token");
  if (!/^[0-9a-f]{40}$/.test(evidence.contentHead)) throw new Error("PREFLIGHT.md repo-preflight-result:v1 contentHead must be a full SHA");
  if (evidence.origin !== "pass" || evidence.effectiveIdentity !== "pass" || evidence.cleanWorktree !== true) throw new Error("PREFLIGHT.md repo-preflight-result:v1 required checks must be pass/true");
  requireInteger(evidence.ciConfigCount, "ciConfigCount", 1);
  requireInteger(evidence.historyMismatchCount, "historyMismatchCount");
  for (const name of ["secretCandidates", "personalPaths", "effectiveMismatchCount"]) {
    requireInteger(evidence[name], name);
    if (evidence[name] !== 0) throw new Error(`PREFLIGHT.md repo-preflight-result:v1 ${name} must be 0`);
  }
  return evidence;
}
