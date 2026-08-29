import assert from "node:assert/strict";
import test from "node:test";
import { assertPreflightTargetDiffRow } from "../scripts/preflight-row-gate.mjs";

const completed = "content HEAD `f372376` でlive再測定。secret候補0、個人path0、origin pass、clean worktree pass、CI設定2件、effective_identity pass。対話intent `open_pr` は `ready_after_confirmation`";

test("completed preflight observation evidence is accepted", () => {
  assert.doesNotThrow(() => assertPreflightTargetDiffRow("pass / ready_after_confirmation", completed));
});

test("future-plan prose with bare secret is rejected for passing rows", () => {
  assert.throws(
    () => assertPreflightTargetDiffRow("pass / ready_after_confirmation", "secret候補をpush前に確認する"),
    /future\/pending plan language|completed observation/,
  );
});

test("sha-only result cells are rejected", () => {
  assert.throws(
    () => assertPreflightTargetDiffRow("f372376a2f4c5a127a66432a6f0ee3cc0f1bf10b", "後で測る"),
    /not only a content SHA/,
  );
});
