import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";

const TOAST_ID = "paseo-copy-on-select-toast";
const STYLE_ID = "paseo-copy-on-select-style";
const HIGHLIGHT_NAME = "paseo-copy-on-select";

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).closest !== "function") {
    return false;
  }
  const el = target as HTMLElement;
  return Boolean(
    el.closest('input, textarea, [contenteditable="true"], [contenteditable=""], .xterm'),
  );
}

const HIGHLIGHT_BG = "rgba(59, 130, 246, 0.32)";

function ensureHighlightStyle(): void {
  if (typeof document === "undefined" || !document.head) return;
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = STYLE_ID;
    document.head.appendChild(style);
  }
  style.textContent = [
    `::selection { background-color: ${HIGHLIGHT_BG} !important; }`,
    `.xterm ::selection, .cm-line::selection, .cm-line ::selection { background-color: transparent !important; }`,
    `::highlight(${HIGHLIGHT_NAME}) { background-color: ${HIGHLIGHT_BG}; color: inherit; }`,
  ].join("\n");
}

function setPersistentHighlight(selection: Selection): boolean {
  const cssHighlights = (globalThis.CSS as { highlights?: Map<string, unknown> } | undefined)
    ?.highlights;
  const HighlightCtor = (
    globalThis as { Highlight?: new (...ranges: AbstractRange[]) => unknown }
  ).Highlight;

  if (!cssHighlights || !HighlightCtor || selection.rangeCount === 0) {
    return false;
  }

  const ranges: Range[] = [];
  for (let i = 0; i < selection.rangeCount; i++) {
    ranges.push(selection.getRangeAt(i).cloneRange());
  }
  if (ranges.length === 0) return false;

  ensureHighlightStyle();
  cssHighlights.set(HIGHLIGHT_NAME, new HighlightCtor(...ranges));
  return true;
}

function clearPersistentHighlight(): void {
  const cssHighlights = (globalThis.CSS as { highlights?: Map<string, unknown> } | undefined)
    ?.highlights;
  if (cssHighlights) {
    cssHighlights.delete(HIGHLIGHT_NAME);
  }
}

function showCopiedToast(): void {
  if (typeof document === "undefined" || !document.body) return;

  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    Object.assign(toast.style, {
      position: "fixed",
      right: "16px",
      bottom: "16px",
      zIndex: "999999",
      padding: "4px 10px",
      borderRadius: "6px",
      background: "rgba(24, 24, 27, 0.88)",
      color: "#f4f4f5",
      fontSize: "12px",
      fontFamily: "system-ui, -apple-system, sans-serif",
      pointerEvents: "none",
      opacity: "0",
      transition: "opacity 120ms ease",
      boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
    });
    toast.textContent = "Copied";
    document.body.appendChild(toast);
  }

  toast.style.opacity = "1";
  const prevTimer = Number(toast.dataset.hideTimer || "0");
  if (prevTimer) window.clearTimeout(prevTimer);
  const timer = window.setTimeout(() => {
    if (toast) toast.style.opacity = "0";
  }, 900);
  toast.dataset.hideTimer = String(timer);
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below.
  }

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  }
}

export default function contribute(client: PluginClientContext) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return () => {};
  }

  ensureHighlightStyle();

  let lastCopiedText = "";
  let lastCopiedAt = 0;

  const focusActiveComposer = () => {
    try {
      const [composer] = client.composers({ focused: true });
      if (!composer) return;
      window.getSelection()?.removeAllRanges();
      void composer.focus().catch(() => {});
    } catch {
      // Ignore if no active composer is available.
    }
  };

  const onMouseDown = () => {
    clearPersistentHighlight();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      clearPersistentHighlight();
    }
  };

  const onMouseUp = (event: MouseEvent) => {
    if (event.button !== 0) return;
    if (isEditableElement(event.target)) return;

    window.setTimeout(() => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const anchorEl =
        selection.anchorNode instanceof Element
          ? selection.anchorNode
          : selection.anchorNode?.parentElement ?? null;
      if (isEditableElement(anchorEl)) {
        return;
      }

      const text = selection.toString();
      if (!text || text.trim().length === 0) return;

      const now = Date.now();
      if (text === lastCopiedText && now - lastCopiedAt < 300) return;
      lastCopiedText = text;
      lastCopiedAt = now;

      const highlighted = setPersistentHighlight(selection);

      void copyText(text).then((ok) => {
        if (ok) showCopiedToast();
        if (highlighted) {
          focusActiveComposer();
        }
      });
    }, 0);
  };

  // Fallback if CSS Custom Highlight API is unavailable or composer isn't focused yet.
  const onPaste = (event: ClipboardEvent) => {
    if (isEditableElement(event.target) || isEditableElement(document.activeElement)) {
      return;
    }

    const text = event.clipboardData?.getData("text/plain");
    if (!text) return;

    try {
      const [composer] = client.composers({ focused: true });
      if (!composer) return;
      event.preventDefault();
      composer.insertText(text);
      void composer.focus().catch(() => {});
    } catch {
      // Ignore if no active composer is available.
    }
  };

  document.addEventListener("mousedown", onMouseDown, true);
  document.addEventListener("keydown", onKeyDown, true);
  document.addEventListener("mouseup", onMouseUp, true);
  document.addEventListener("paste", onPaste, true);

  return () => {
    document.removeEventListener("mousedown", onMouseDown, true);
    document.removeEventListener("keydown", onKeyDown, true);
    document.removeEventListener("mouseup", onMouseUp, true);
    document.removeEventListener("paste", onPaste, true);
    clearPersistentHighlight();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    const toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();
  };
}
