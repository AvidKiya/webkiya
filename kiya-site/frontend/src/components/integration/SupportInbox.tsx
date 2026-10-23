import { useEffect, useRef, useState } from "react";
import { api } from "../../services/catalog";
type Thread = {
  id: string;
  subject: string;
  status: string;
  version: number;
  orderId: string | null;
  updatedAt: string;
};
type Message = {
  id: string;
  body: string;
  authorKind: string;
  createdAt: string;
};
type Listing = { items: Thread[]; hasMore: boolean; page: number };
type History = { thread: Thread; messages: Message[]; hasMore: boolean };
export function SupportInbox() {
  const [list, setList] = useState<Listing | null>(null),
    [orders, setOrders] = useState<{ id: string; status: string }[]>([]),
    [history, setHistory] = useState<History | null>(null),
    [page, setPage] = useState(1),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [loggedIn, setLoggedIn] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState("");
  const generation = useRef(0),
    pending = useRef({ signature: "", requestId: "" });
  const mutationId = (signature: string) => {
    if (pending.current.signature !== signature)
      pending.current = { signature, requestId: crypto.randomUUID() };
    return pending.current.requestId;
  };
  async function refresh(nextPage = page) {
    const ticket = ++generation.current;
    setHistory(null);
    setList(null);
    setOrders([]);
    setLoggedIn(null);
    setDraft("");
    setError("");
    setBusy(false);
    try {
      const me = await api<{ user: { canShop: boolean } | null }>(
        "/api/auth/me",
      );
      if (ticket !== generation.current) return;
      setLoggedIn(!!me.user?.canShop);
      if (!me.user?.canShop) return;
      const [result, recentOrders] = await Promise.all([
        api<Listing>(`/api/support?page=${nextPage}`),
        api<{ orders: { id: string; status: string }[] }>("/api/orders"),
      ]);
      if (ticket === generation.current) {
        setList(result);
        setOrders(recentOrders.orders);
        setPage(nextPage);
      }
    } catch (e) {
      if (ticket === generation.current)
        setError(e instanceof Error ? e.message : "دریافت گفت‌وگو ناموفق بود.");
    }
  }
  useEffect(() => {
    void Promise.resolve().then(() => refresh(1));
    const check = () => {
      if (document.visibilityState === "visible") void refresh(1);
    };
    const invalidate = () => {
      void refresh(1);
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "kiya-auth-change") invalidate();
    };
    window.addEventListener("kiya-auth-changed", invalidate);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", check);
    return () => {
      generation.current++;
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("kiya-auth-changed", invalidate);
      window.removeEventListener("storage", storage);
    };
  }, []);
  async function open(thread: Thread, older = false) {
    const ticket = ++generation.current,
      previous = history;
    if (!older) setHistory(null);
    setError("");
    try {
      const data = await api<History>(
        `/api/support/${thread.id}${older && previous?.messages[0] ? "?before=" + previous.messages[0].id : ""}`,
      );
      if (ticket === generation.current) {
        setList((previousList) =>
          previousList
            ? {
                ...previousList,
                items: previousList.items.map((thread) =>
                  thread.id === data.thread.id
                    ? { ...thread, ...data.thread }
                    : thread,
                ),
              }
            : previousList,
        );
        setHistory(
          older && previous
            ? { ...data, messages: [...data.messages, ...previous.messages] }
            : data,
        );
      }
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(null);
        setList(null);
        setLoggedIn(null);
        setDraft("");
        setError(e instanceof Error ? e.message : "دریافت پیام ناموفق بود.");
      }
    }
  }
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget,
      data = new FormData(form),
      values = {
        subject: String(data.get("subject") || ""),
        body: String(data.get("body") || ""),
        ...(data.get("orderId")
          ? { orderId: String(data.get("orderId")) }
          : {}),
      },
      ticket = ++generation.current;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const thread = await api<Thread>("/api/support", {
        ...values,
        requestId: mutationId(JSON.stringify(values)),
      });
      if (ticket !== generation.current) return;
      form.reset();
      pending.current = { signature: "", requestId: "" };
      setNotice(
        "درخواست در سایت ثبت شد؛ این پیام به معنای ارسال به تلگرام یا خوانده‌شدن توسط پشتیبان نیست.",
      );
      await refresh(1);
      await open(thread);
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(null);
        setList(null);
        setLoggedIn(null);
        setDraft("");
        setError(e instanceof Error ? e.message : "ثبت درخواست ناموفق بود.");
      }
    } finally {
      setBusy(false);
    }
  }
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !history) return;
    const thread = history.thread,
      text = draft,
      ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      await api(`/api/support/${thread.id}`, {
        body: text,
        requestId: mutationId(thread.id + ":" + text),
      });
      if (ticket !== generation.current) return;
      setDraft("");
      pending.current = { signature: "", requestId: "" };
      setNotice("پیام در گفت‌وگو ثبت شد؛ وضعیت خوانده‌شدن گزارش نمی‌شود.");
      await open(thread);
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(null);
        setList(null);
        setLoggedIn(null);
        setDraft("");
        setError(e instanceof Error ? e.message : "ثبت پیام ناموفق بود.");
      }
    } finally {
      setBusy(false);
    }
  }
  async function status() {
    if (!history || busy) return;
    const thread = history.thread,
      ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      const result = await api<Thread>(
        `/api/support/${thread.id}`,
        {
          status: thread.status === "OPEN" ? "CLOSED" : "OPEN",
          version: thread.version,
          reason: "تغییر وضعیت به درخواست صاحب گفت‌وگو",
        },
        "PATCH",
      );
      if (ticket === generation.current) await open(result);
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(null);
        setList(null);
        setLoggedIn(null);
        setDraft("");
        setError(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود.");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      className="max-w-[980px] mx-auto bg-surface border border-border rounded-3xl p-4 md:p-6 space-y-5"
      aria-label="پشتیبانی خصوصی"
    >
      <h1 className="font-black text-xl">دایرکت و پشتیبانی کیا</h1>
      <p className="text-sm text-ink-600">
        گفت‌وگوی خصوصی داخل سایت؛ پیام‌ها روی سرور ذخیره می‌شوند. رمز، کد ورود
        یا اطلاعات کارت بانکی را در پیام نفرستید.
      </p>
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm">
          {notice}
        </p>
      )}
      {loggedIn === null && !error && <p role="status">در حال بررسی حساب…</p>}
      {loggedIn === false && (
        <a href="/#account" className="text-brand-500 underline">
          برای پشتیبانی وارد حساب کاربری شوید
        </a>
      )}
      {loggedIn && (
        <>
          <button
            disabled={busy}
            onClick={() => void refresh(page)}
            className="border border-border rounded-xl p-2"
          >
            تازه‌سازی گفت‌وگوها
          </button>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="space-y-3">
              <h2 className="font-bold">درخواست‌های من</h2>
              {list?.items.length === 0 && <p>هنوز گفت‌وگویی ثبت نکرده‌اید.</p>}
              {list?.items.map((t) => (
                <button
                  key={t.id}
                  disabled={busy}
                  onClick={() => {
                    setDraft("");
                    void open(t);
                  }}
                  className="block w-full text-right border border-border rounded-xl p-3 break-words"
                >
                  {t.subject} · {t.status === "OPEN" ? "باز" : "بسته"}
                </button>
              ))}
              <nav aria-label="صفحه‌های گفت‌وگو" className="flex gap-3">
                <button
                  disabled={busy || page === 1}
                  onClick={() => void refresh(page - 1)}
                >
                  قبل
                </button>
                <span>{page}</span>
                <button
                  disabled={busy || !list?.hasMore}
                  onClick={() => void refresh(page + 1)}
                >
                  بعد
                </button>
              </nav>
              <form
                onSubmit={(event) => void create(event)}
                className="border border-border rounded-xl p-3 space-y-3"
              >
                <h2 className="font-bold">درخواست جدید</h2>
                <label className="block">
                  موضوع
                  <input
                    name="subject"
                    minLength={3}
                    maxLength={120}
                    required
                    className="block w-full bg-canvas-sunken border border-border rounded-lg p-2"
                  />
                </label>
                <label className="block">
                  سفارش مرتبط (اختیاری)
                  <select
                    name="orderId"
                    className="block w-full max-w-full bg-canvas-sunken border border-border rounded-lg p-2"
                  >
                    <option value="">بدون سفارش مرتبط</option>
                    {orders.map((order) => (
                      <option key={order.id} value={order.id}>
                        {order.id.slice(0, 8)} · {order.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  متن درخواست
                  <textarea
                    name="body"
                    minLength={1}
                    maxLength={3000}
                    required
                    className="block w-full bg-canvas-sunken border border-border rounded-lg p-2"
                  />
                </label>
                <button
                  disabled={busy}
                  className="bg-buy text-buy-fg rounded-xl p-3"
                >
                  ثبت درخواست پشتیبانی
                </button>
              </form>
            </div>
            <div className="min-w-0 space-y-3">
              {history ? (
                <>
                  <h2 className="font-bold break-words">
                    {history.thread.subject}
                  </h2>
                  <p>
                    {history.thread.status === "OPEN"
                      ? "گفت‌وگو باز است"
                      : "گفت‌وگو بسته است"}
                  </p>
                  {history.thread.orderId && (
                    <p className="break-all">
                      سفارش: <bdi>{history.thread.orderId}</bdi>
                    </p>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => void status()}
                    className="border border-border rounded-xl p-2"
                  >
                    {history.thread.status === "OPEN"
                      ? "بستن درخواست"
                      : "بازکردن دوباره درخواست"}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => void open(history.thread)}
                    className="border border-border rounded-xl p-2"
                  >
                    تازه‌سازی پیام‌ها
                  </button>
                  {history.hasMore && (
                    <button
                      disabled={busy}
                      onClick={() => void open(history.thread, true)}
                    >
                      پیام‌های قدیمی‌تر
                    </button>
                  )}
                  <ol className="space-y-3" aria-label="پیام‌های گفت‌وگو">
                    {history.messages.map((m) => (
                      <li
                        key={m.id}
                        className="rounded-xl bg-canvas-sunken p-3 break-words"
                      >
                        <strong>
                          {m.authorKind === "STAFF" ? "پشتیبانی کیا" : "شما"}
                        </strong>
                        <p className="whitespace-pre-wrap break-words">
                          {m.body}
                        </p>
                        <time className="text-xs text-ink-500">
                          {new Date(m.createdAt).toLocaleString("fa-IR")}
                        </time>
                      </li>
                    ))}
                  </ol>
                  {history.thread.status === "OPEN" && (
                    <form
                      onSubmit={(event) => void send(event)}
                      className="space-y-2"
                    >
                      <label>
                        پیام شما
                        <textarea
                          value={draft}
                          onChange={(event) => setDraft(event.target.value)}
                          minLength={1}
                          maxLength={3000}
                          required
                          className="block w-full border border-border bg-canvas-sunken rounded-lg p-2"
                        />
                      </label>
                      <button
                        disabled={busy}
                        className="bg-buy text-buy-fg rounded-xl p-3"
                      >
                        ثبت پیام در گفت‌وگو
                      </button>
                    </form>
                  )}
                </>
              ) : (
                <p>یک گفت‌وگو انتخاب کنید یا درخواست جدید بسازید.</p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
