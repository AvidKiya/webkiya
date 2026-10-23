"use client";

import { useSyncExternalStore, useMemo } from "react";
import { products, validCart, type CartItem, type Product } from "./catalog";
export type PreviewData = {
  cart: CartItem[];
  liked: string[];
  saved: string[];
};
const EMPTY: PreviewData = { cart: [], liked: [], saved: [] };
const KEY = "kiya.preview.v1";
const EVENT = "kiya-preview-updated";
let memoryRaw: string | null = null;
let storageFailed = false;
export function parsePreview(
  raw: string | null,
  catalog: Product[] = products,
): PreviewData {
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
                  typeof id === "string" && catalog.some((p) => p.id === id),
              ),
            ),
          ]
        : [];
    return {
      cart: validCart(data.cart, catalog),
      liked: ids(data.liked),
      saved: ids(data.saved),
    };
  } catch {
    return EMPTY;
  }
}
function snapshot(): string | null {
  if (typeof window === "undefined") return null;
  if (storageFailed) return memoryRaw;
  try {
    memoryRaw = localStorage.getItem(KEY);
  } catch {
    storageFailed = true;
  }
  return memoryRaw;
}
function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}
export function usePreviewStore(catalog: Product[] = products) {
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const data = useMemo(() => parsePreview(raw, catalog), [raw, catalog]);
  const warning = useSyncExternalStore(
    subscribe,
    () => storageFailed,
    () => false,
  );
  function update(fn: (data: PreviewData) => PreviewData) {
    const next = fn(parsePreview(snapshot(), catalog));
    memoryRaw = JSON.stringify(next);
    try {
      localStorage.setItem(KEY, memoryRaw);
    } catch {
      storageFailed = true;
    }
    window.dispatchEvent(new Event(EVENT));
  }
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
