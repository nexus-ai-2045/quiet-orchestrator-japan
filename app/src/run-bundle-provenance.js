import { execFileSync } from "node:child_process";

const FULL_SHA = /^[0-9a-f]{40}$/;

export function resolveImplementationRevision(repoRoot, {
  githubSha = process.env.GITHUB_SHA,
  execGit = execFileSync,
} = {}) {
  const runGit = (args) => execGit("git", args, { cwd: repoRoot, encoding: "utf8" }).trim();
  const revision = runGit(["rev-parse", "HEAD"]);
  if (!FULL_SHA.test(revision)) throw new Error("implementation repository HEAD is not a full Git SHA");
  if (runGit(["status", "--porcelain", "--untracked-files=normal"]) !== "") {
    throw new Error("implementation repository is dirty; refusing to emit provenance");
  }
  if (githubSha !== undefined && githubSha !== "") {
    if (!FULL_SHA.test(githubSha) || githubSha !== revision) {
      throw new Error("GITHUB_SHA does not match the implementation repository HEAD");
    }
  }
  return revision;
}
