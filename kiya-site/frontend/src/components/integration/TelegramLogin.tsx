import { useEffect, useRef, useState } from "react";
import { api } from "../../services/catalog";
type Challenge = { id: string; code: string; link: string; expiresAt: string };
export function TelegramLogin({ onLogin }: { onLogin: () => Promise<void> }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null),
    [name, setName] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const generation = useRef(0);
  useEffect(() => {
    if (!challenge) return;
    let stopped = false;
    const ticket = ++generation.current;
    const poll = async () => {
      if (stopped || document.hidden) return;
      if (Date.now() >= Date.parse(challenge.expiresAt)) {
        setError("لینک منقضی شد؛ لینک تازه بسازید.");
        setChallenge(null);
        return;
      }
      try {
        const result = await api<{ state: string; name: string | null }>(
          "/api/auth/telegram",
          { action: "status", id: challenge.id },
        );
        if (
          !stopped &&
          ticket === generation.current &&
          result.state === "APPROVED"
        )
          setName(result.name);
      } catch (e) {
        if (!stopped) {
          setError(e instanceof Error ? e.message : "بررسی ورود ناموفق بود.");
          stopped = true;
        }
      }
    };
    const timer = setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      generation.current++;
      clearInterval(timer);
    };
  }, [challenge]);
  async function start() {
    if (busy) return;
    setBusy(true);
    setError("");
    setName(null);
    setChallenge(null);
    try {
      setChallenge(
        await api<Challenge>("/api/auth/telegram", { action: "start" }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ایجاد لینک ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!challenge || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/telegram", { action: "finish", id: challenge.id });
      setChallenge(null);
      window.dispatchEvent(new Event("kiya-session-changed"));
      await onLogin();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ورود ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-2xl border border-border p-4 space-y-3"
      aria-label="ورود با تلگرام"
    >
      <h2 className="font-extrabold">ورود با حساب تلگرام</h2>
      <p className="text-sm text-ink-600">
        لینک را فقط خودتان باز کنید. کد سایت و ربات باید یکی باشد. این روش ورود
        مشتری است، نه ورود مدیر یا تأیید شماره موبایل.
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <button
        disabled={busy}
        onClick={() => void start()}
        className="bg-buy text-buy-fg rounded-xl px-4 py-3 disabled:opacity-40"
      >
        {challenge ? "ساخت لینک تازه" : "دریافت لینک یک‌بارمصرف تلگرام"}
      </button>
      {challenge && (
        <div className="space-y-3">
          <p>
            کد تطبیق مرورگر و ربات:{" "}
            <bdi className="font-mono text-xl">{challenge.code}</bdi>
          </p>
          <a
            href={challenge.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block underline text-brand-600"
          >
            بازکردن ربات و تأیید ورود
          </a>
          <p className="text-xs text-ink-500">
            پس از تأیید داخل ربات به همین صفحه برگردید. اعتبار لینک سه دقیقه
            است.
          </p>
          {name && (
            <div>
              <p>
                حساب تأییدشده: <strong>{name}</strong>
              </p>
              <button
                disabled={busy}
                onClick={() => void finish()}
                className="bg-buy text-buy-fg rounded-xl px-4 py-3"
              >
                این حساب من است؛ ورود به سایت
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
