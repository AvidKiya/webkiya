"use client";

import { useSyncExternalStore } from "react";
import { products, validCart, type CartItem } from "./catalog";
export type PreviewData = {
  cart: CartItem[];
  liked: string[];
  saved: string[];
};
const EMPTY: PreviewData = { cart: [], liked: [], saved: [] };
const KEY = "kiya.preview.v1";
const EVENT = "kiya-preview-updated";
let cachedRaw: string | null = null;
let cached: PreviewData = EMPTY;
let storageFailed = false;
export function parsePreview(raw: string | null): PreviewData {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return EMPTY;
    const data = parsed as Partial<PreviewData>;
    const ids = (value: unknown) =>
      Array.isArray(value)
        ? [
            ...new Set(
              value.filter(
                (id): id is string =>
                  typeof id === "string" && products.some((p) => p.id === id),
              ),
            ),
          ]
        : [];
    return {
      cart: validCart(data.cart),
      liked: ids(data.liked),
      saved: ids(data.saved),
    };
  } catch {
    return EMPTY;
  }
}
function snapshot() {
  if (typeof window === "undefined") return EMPTY;
  if (storageFailed) return cached;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cached = parsePreview(raw);
    }
  } catch {
    storageFailed = true;
  }
  return cached;
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
function update(fn: (data: PreviewData) => PreviewData) {
  const next = fn(snapshot());
  const raw = JSON.stringify(next);
  cached = next;
  cachedRaw = raw;
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    storageFailed = true;
  }
  window.dispatchEvent(new Event(EVENT));
}
export function usePreviewStore() {
  const data = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  const warning = useSyncExternalStore(
    subscribe,
    () => storageFailed,
    () => false,
  );
  return { data, setData: update, storageWarning: warning };
}

let themeMemory: "light" | "dark" = "light";
function themeSnapshot(): "light" | "dark" {
  try {
    themeMemory =
      localStorage.getItem("kiya.theme") === "dark" ? "dark" : "light";
  } catch {
    /* keep session choice */
  }
  return themeMemory;
}
export function usePreviewTheme() {
  const theme = useSyncExternalStore(
    subscribe,
    themeSnapshot,
    () => "light" as const,
  );
  function setTheme(value: "light" | "dark") {
    themeMemory = value;
    try {
      localStorage.setItem("kiya.theme", value);
    } catch {
      /* theme remains available for this session */
    }
    window.dispatchEvent(new Event(EVENT));
  }
  return { theme, setTheme };
}
