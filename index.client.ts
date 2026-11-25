import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Platform } from "react-native";

const TOAST_ID = "paseo-copy-on-select-toast";

function isEditableElement(target: EventTarget | null): boolean {
  if (!target || typeof (target as HTMLElement).closest !== "function") {
    return false;
  }
  const el = target as HTMLElement;
  return Boolean(
    el.closest('input, textarea, [contenteditable="true"], [contenteditable=""]'),
  );
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

export default function contribute(_client: PluginClientContext) {
  if (Platform.OS !== "web" || typeof document === "undefined") {
    return () => {};
  }

  let lastCopiedText = "";
  let lastCopiedAt = 0;

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

      void copyText(text).then((ok) => {
        if (ok) showCopiedToast();
      });
    }, 0);
  };

  document.addEventListener("mouseup", onMouseUp, true);

  return () => {
    document.removeEventListener("mouseup", onMouseUp, true);
    const toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();
  };
}
