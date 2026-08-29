const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function createModalFocusController({ getDialog, getActiveElement }) {
  let opener = null;
  return {
    rememberOpener() {
      opener = getActiveElement() ?? null;
    },
    restoreOpener() {
      opener?.focus?.();
    },
    handleTab(event) {
      if (event.key !== "Tab") return false;
      const dialog = getDialog();
      const focusable = [...(dialog?.querySelectorAll(FOCUSABLE_SELECTOR) ?? [])]
        .filter((node) => !node.hasAttribute?.("hidden"));
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!dialog || !first || !last) return false;
      const active = getActiveElement();
      if (!dialog.contains(active) || (!event.shiftKey && active === last)) {
        event.preventDefault();
        first.focus();
        return true;
      }
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
        return true;
      }
      return false;
    },
  };
}
