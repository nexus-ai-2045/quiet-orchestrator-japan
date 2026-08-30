import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createModalFocusController } from "../src/modal-focus.js";

function renderFocusFixture() {
  let activeElement;
  const makeButton = (name) => ({ name, hasAttribute: () => false, focus() { activeElement = this; } });
  const opener = makeButton("opener");
  const close = makeButton("close");
  const row = makeButton("row");
  activeElement = opener;
  const dialog = {
    contains: (node) => node === close || node === row,
    querySelectorAll: () => [close, row],
  };
  return { opener, close, row, dialog, getActiveElement: () => activeElement };
}

function tabEvent({ shiftKey = false } = {}) {
  return { key: "Tab", shiftKey, prevented: false, preventDefault() { this.prevented = true; } };
}

test("the rendered ledger focus controller cycles Tab inside the modal", () => {
  const fixture = renderFocusFixture();
  const controller = createModalFocusController({ getDialog: () => fixture.dialog, getActiveElement: fixture.getActiveElement });
  controller.rememberOpener();
  fixture.row.focus();
  const forward = tabEvent();
  controller.handleTab(forward);
  assert.equal(forward.prevented, true);
  assert.equal(fixture.getActiveElement(), fixture.close);
  const backward = tabEvent({ shiftKey: true });
  controller.handleTab(backward);
  assert.equal(backward.prevented, true);
  assert.equal(fixture.getActiveElement(), fixture.row);
});

test("unmount restoration returns focus to the rendered modal opener", () => {
  const fixture = renderFocusFixture();
  const controller = createModalFocusController({ getDialog: () => fixture.dialog, getActiveElement: fixture.getActiveElement });
  controller.rememberOpener();
  fixture.row.focus();
  controller.restoreOpener();
  assert.equal(fixture.getActiveElement(), fixture.opener);
});

test("the 320px drawer stays within the padded backdrop content width", async () => {
  const styles = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
  const width = styles.match(/\.ledger-drawer\s*\{[^}]*width:\s*min\(560px,\s*([^;)]+)\)/s)?.[1];
  assert.equal(width, "100%");
});

test("the 2045 final display and replay share the recorded canonical checkpoint", async () => {
  const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
  assert.match(source, /finalEvidence\?\.canonicalCheckpoint\?\.run \?\? runCrisisSimulation/);
  assert.match(source, /canonicalMaintainedTurns = finalEvidence \? 120 - finalEvidence\.canonicalCheckpoint\.run\.events/);
  assert.match(source, /canonical危機の協調維持turn/);
  assert.match(source, /<code>\{run\.eventStreamHash\}<\/code>/);
});
