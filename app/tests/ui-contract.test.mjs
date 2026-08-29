import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");

test("the ledger modal traps Tab focus inside the dialog", () => {
  assert.match(appSource, /event\.key === "Tab"/);
  assert.match(appSource, /dialogRef\.current\?\.querySelectorAll/);
  assert.match(appSource, /focusable\.at\(-1\)/);
});

test("the ledger modal restores focus to its opener when closed", () => {
  assert.match(appSource, /previousFocusRef\.current = document\.activeElement/);
  assert.match(appSource, /previousFocusRef\.current\?\.focus\(\)/);
});
