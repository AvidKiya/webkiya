"use client";
import { useState, useEffect, useCallback } from "react";
export type Viewer = {
  id: string;
  name: string;
  kind: string;
  isDemo: boolean;
  mfaEnabled: boolean;
  mfaVerified: boolean;
  permissions: string[];
};
export type Account = {
  user: Viewer | null;
  demoLoginAvailable: boolean;
  smsConfigured: boolean;
};
export async function api<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok)
    throw new Error(payload.error?.message || "ارتباط با سرور برقرار نشد.");
  return payload.data as T;
}
export function authChanged() {
  window.dispatchEvent(new Event("kiya-auth-changed"));
}
export function useAccount(enabled = true) {
  const [account, setAccount] = useState<Account | null>(null),
    [error, setError] = useState("");
  const refresh = useCallback(() => {
    if (!enabled) return;
    api<Account>("/api/auth/me")
      .then((value) => {
        setAccount(value);
        setError("");
      })
      .catch((e) => setError(e.message));
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    api<Account>("/api/auth/me")
      .then((a) => {
        if (active) setAccount(a);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    window.addEventListener("kiya-auth-changed", refresh);
    return () => {
      active = false;
      window.removeEventListener("kiya-auth-changed", refresh);
    };
  }, [refresh, enabled]);
  return { account, error, refresh };
}
