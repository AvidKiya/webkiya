import { useEffect, useRef, useState } from "react";
import { api, announceAuthChange } from "../../services/catalog";
type Challenge = { id: string; code: string; link: string; expiresAt: string };
type Otp = { id: string; expiresAt: string; message: string };
export function TelegramLogin({ onLogin }: { onLogin: () => Promise<void> }) {
  const [challenge, setChallenge] = useState<Challenge | null>(null),
    [otp, setOtp] = useState<Otp | null>(null),
    [phone, setPhone] = useState(""),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const finishing = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const loggedIn = async () => {
    window.dispatchEvent(new Event("kiya-session-changed"));
    announceAuthChange();
    await onLogin();
  };
  useEffect(() => {
    if (!challenge) return;
    let stopped = false;
    const poll = async () => {
      if (stopped || document.hidden || finishing.current) return;
      if (Date.now() >= Date.parse(challenge.expiresAt)) {
        setError("لینک منقضی شد؛ دوباره درخواست دهید.");
        setChallenge(null);
        return;
      }
      try {
        const result = await api<{ state: string }>("/api/auth/telegram", {
          action: "status",
          id: challenge.id,
        });
        if (stopped || result.state !== "APPROVED") return;
        finishing.current = true;
        await api("/api/auth/telegram", { action: "finish", id: challenge.id });
        if (!stopped && alive.current) {
          setChallenge(null);
          await loggedIn();
        }
      } catch (e) {
        if (!stopped) {
          setError(e instanceof Error ? e.message : "ورود ناموفق بود.");
          stopped = true;
        }
      } finally {
        finishing.current = false;
      }
    };
    const timer = setInterval(() => void poll(), 2500);
    const visible = () => void poll();
    document.addEventListener("visibilitychange", visible);
    void poll();
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [challenge]);
  async function start() {
    if (busy) return;
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setBusy(true);
    setError("");
    setChallenge(null);
    setOtp(null);
    try {
      const next = await api<Challenge>("/api/auth/telegram", {
        action: "start",
        mode: "direct",
      });
      setChallenge(next);
      if (popup) popup.location.replace(next.link);
    } catch (e) {
      popup?.close();
      setError(e instanceof Error ? e.message : "ساخت لینک ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function requestOtp(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setChallenge(null);
    setCode("");
    try {
      setOtp(
        await api<Otp>("/api/auth/telegram", { action: "otp-start", phone }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "ارسال کد ناموفق بود.");
    } finally {
      setBusy(false);
    }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!otp || busy) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/auth/telegram", {
        action: "otp-verify",
        id: otp.id,
        code,
      });
      setOtp(null);
      await loggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "کد معتبر نیست.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="rounded-2xl border border-border p-4 space-y-4"
      aria-label="ورود با تلگرام"
    >
      <h2 className="font-extrabold">ورود با حساب تلگرام</h2>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      <div className="space-y-3">
        <h3 className="font-bold">۱. ورود مستقیم با ربات</h3>
        <p className="text-sm">
          لینک را باز کنید و در تلگرام Start بزنید؛ با برگشت به همین صفحه،
          خودکار وارد می‌شوید. فقط لینک درخواست خودتان را باز کنید، نه لینک فرد
          دیگر.
        </p>
        <button
          disabled={busy}
          onClick={() => void start()}
          className="bg-buy text-buy-fg rounded-xl px-4 py-3 disabled:opacity-40"
        >
          {challenge ? "بازکردن دوبارهٔ ربات" : "ورود مستقیم با ربات"}
        </button>
        {challenge && (
          <div className="space-y-2">
            <a
              href={challenge.link}
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-buy text-buy-fg rounded-xl p-3 text-center font-bold"
            >
              بازکردن ربات و ورود مستقیم
            </a>
            <p role="status">
              منتظر Start شما در ربات هستیم؛ نیازی به دکمهٔ تأیید دیگری نیست.
            </p>
            <p className="text-xs">
              اعتبار لینک سه دقیقه است. شناسهٔ تطبیق درخواست:{" "}
              <bdi>{challenge.code}</bdi>
            </p>
          </div>
        )}
      </div>
      <div className="border-t border-border pt-4 space-y-3">
        <h3 className="font-bold">۲. کد یک‌بارمصرف در تلگرام</h3>
        <p className="text-sm">
          اگر قبلاً بات را Start و شمارهٔ خودتان را در آن تأیید کرده‌اید، کد را
          در تلگرام دریافت و اینجا وارد کنید. برای بار اول از روش مستقیم بالا
          استفاده کنید یا{" "}
          <a
            className="underline"
            href="https://t.me/kiyaco24bot"
            target="_blank"
            rel="noopener noreferrer"
          >
            ربات را باز کنید
          </a>{" "}
          و شمارهٔ خودتان را به اشتراک بگذارید.
        </p>
        <form onSubmit={requestOtp} className="space-y-2">
          <label className="block">
            شماره موبایل
            <input
              type="tel"
              inputMode="tel"
              required
              dir="ltr"
              maxLength={30}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="block w-full p-3 rounded-xl bg-canvas-sunken border border-border"
            />
          </label>
          <button
            disabled={busy}
            className="border border-border rounded-xl px-4 py-3"
          >
            {otp ? "ارسال مجدد کد در تلگرام" : "دریافت کد در تلگرام"}
          </button>
        </form>
        {otp && (
          <form onSubmit={verify} className="space-y-2">
            <p role="status" className="text-xs">
              {otp.message}
            </p>
            <label className="block">
              کد یک‌بارمصرف تلگرام
              <input
                autoComplete="one-time-code"
                inputMode="numeric"
                required
                minLength={6}
                maxLength={6}
                dir="ltr"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="block w-full p-3 rounded-xl bg-canvas-sunken border border-border"
              />
            </label>
            <button
              disabled={busy || code.length !== 6}
              className="bg-buy text-buy-fg rounded-xl px-4 py-3"
            >
              تأیید کد و ورود
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
