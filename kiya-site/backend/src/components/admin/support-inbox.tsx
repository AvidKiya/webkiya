"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import "./integration-settings.css";
type Thread = {
  id: string;
  subject: string;
  customerName?: string;
  status: string;
  version: number;
  orderId: string | null;
};
type Message = {
  id: string;
  body: string;
  authorKind: string;
  internal: boolean;
  createdAt: string;
};
type Listing = {
  items: Thread[];
  page: number;
  hasMore: boolean;
  canReply: boolean;
  canNote: boolean;
  canManage: boolean;
};
type History = { thread: Thread; messages: Message[]; hasMore: boolean };
export function SupportInbox() {
  const [list, setList] = useState<Listing | null>(null),
    [history, setHistory] = useState<History | null>(null),
    [page, setPage] = useState(1),
    [filter, setFilter] = useState("OPEN"),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [draft, setDraft] = useState("");
  const generation = useRef(0),
    pending = useRef({ signature: "", requestId: "" });
  useEffect(() => {
    const ticket = ++generation.current;
    api<Listing>(`/api/admin/support?page=${page}&status=${filter}`)
      .then((data) => {
        if (ticket === generation.current) {
          setList(data);
          setError("");
        }
      })
      .catch((e) => {
        if (ticket === generation.current) {
          setList(null);
          setHistory(null);
          setError(e.message);
        }
      });
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- This is an async generation token, not a DOM ref.
      generation.current++;
    };
  }, [page, filter, revision]);
  useEffect(() => {
    const invalidate = () => {
      generation.current++;
      setList(null);
      setHistory(null);
      setDraft("");
      setBusy(false);
      setRevision((value) => value + 1);
    };
    const visible = () => {
      if (document.visibilityState === "visible") invalidate();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "kiya-auth-change") invalidate();
    };
    window.addEventListener("kiya-auth-changed", invalidate);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("kiya-auth-changed", invalidate);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  async function open(thread: Thread, older = false) {
    const ticket = ++generation.current,
      previous = history;
    if (!older) setHistory(null);
    setError("");
    try {
      const data = await api<History>(
        `/api/admin/support/${thread.id}${older && previous?.messages[0] ? "?before=" + previous.messages[0].id : ""}`,
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
        setError(e instanceof Error ? e.message : "دریافت گفت‌وگو ناموفق بود.");
      }
    }
  }
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!history || busy) return;
    const data = new FormData(event.currentTarget),
      internal = data.get("internal") === "on",
      thread = history.thread,
      text = draft,
      signature = JSON.stringify({ id: thread.id, text, internal });
    if (signature !== pending.current.signature)
      pending.current = { signature, requestId: crypto.randomUUID() };
    const ticket = ++generation.current;
    setBusy(true);
    setError("");
    try {
      await api(`/api/admin/support/${thread.id}`, {
        method: "POST",
        body: JSON.stringify({
          body: text,
          internal,
          requestId: pending.current.requestId,
        }),
      });
      if (ticket !== generation.current) return;
      setDraft("");
      pending.current = { signature: "", requestId: "" };
      setNotice(
        internal
          ? "یادداشت فقط برای کارکنان مجاز ذخیره شد."
          : "پاسخ در سایت ثبت شد؛ خوانده‌شدن یا ارسال تلگرام تأیید نشده است.",
      );
      await open(thread);
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(null);
        setList(null);
        setError(e instanceof Error ? e.message : "ثبت پیام ناموفق بود.");
      }
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!history || busy) return;
    const thread = history.thread,
      reason = new FormData(event.currentTarget).get("reason"),
      ticket = ++generation.current;
    setBusy(true);
    try {
      const next = await api<Thread>(`/api/admin/support/${thread.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: thread.status === "OPEN" ? "CLOSED" : "OPEN",
          version: thread.version,
          reason,
        }),
      });
      if (ticket === generation.current) await open(next);
    } catch (e) {
      if (ticket === generation.current) {
        setHistory(null);
        setList(null);
        setError(e instanceof Error ? e.message : "تغییر وضعیت ناموفق بود.");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="integration-settings" dir="rtl">
      <Link href="/admin">بازگشت به مدیریت</Link>
      <h1>صندوق پشتیبانی خصوصی</h1>
      <p>
        پاسخ عمومی برای صاحب درخواست قابل مشاهده است. یادداشت داخلی فقط برای
        کارکنان دارای مجوز یادداشت نمایش داده می‌شود.
      </p>
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <label>
        وضعیت درخواست
        <select
          value={filter}
          disabled={busy}
          onChange={(e) => {
            setHistory(null);
            setList(null);
            setFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="OPEN">باز</option>
          <option value="CLOSED">بسته</option>
          <option value="ALL">همه</option>
        </select>
      </label>
      <button
        disabled={busy}
        onClick={() => {
          setHistory(null);
          setList(null);
          setRevision((v) => v + 1);
        }}
      >
        تازه‌سازی صندوق
      </button>
      {list?.items.length === 0 && <p>درخواستی در این وضعیت نیست.</p>}
      <div className="support-columns">
        <section>
          <h2>درخواست‌ها</h2>
          {list?.items.map((t) => (
            <button
              key={t.id}
              disabled={busy}
              onClick={() => {
                setDraft("");
                void open(t);
              }}
              className="support-thread"
            >
              {t.subject} · {t.customerName} ·{" "}
              {t.status === "OPEN" ? "باز" : "بسته"}
            </button>
          ))}
          <nav aria-label="صفحه‌های درخواست">
            <button
              disabled={busy || page === 1}
              onClick={() => {
                setHistory(null);
                setList(null);
                setPage((v) => v - 1);
              }}
            >
              قبل
            </button>
            <span>{page}</span>
            <button
              disabled={busy || !list?.hasMore}
              onClick={() => {
                setHistory(null);
                setList(null);
                setPage((v) => v + 1);
              }}
            >
              بعد
            </button>
          </nav>
        </section>
        <section>
          {history && list ? (
            <>
              <h2>{history.thread.subject}</h2>
              <p>
                {history.thread.status === "OPEN"
                  ? "گفت‌وگو باز است"
                  : "گفت‌وگو بسته است"}
              </p>
              {history.thread.orderId && (
                <p>
                  سفارش مرتبط: <bdi>{history.thread.orderId}</bdi>
                </p>
              )}
              <button disabled={busy} onClick={() => void open(history.thread)}>
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
              <ol aria-label="پیام‌های پشتیبانی">
                {history.messages.map((m) => (
                  <li
                    key={m.id}
                    className={
                      m.internal
                        ? "support-message support-note"
                        : "support-message"
                    }
                  >
                    <strong>
                      {m.internal
                        ? "یادداشت داخلی"
                        : m.authorKind === "STAFF"
                          ? "پشتیبانی کیا"
                          : "مشتری"}
                    </strong>
                    <p style={{ whiteSpace: "pre-wrap" }}>{m.body}</p>
                    <time>{new Date(m.createdAt).toLocaleString("fa-IR")}</time>
                  </li>
                ))}
              </ol>
              {((list.canReply && history.thread.status === "OPEN") ||
                list.canNote) && (
                <form onSubmit={(event) => void send(event)}>
                  <label>
                    متن پیام پشتیبانی
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      minLength={1}
                      maxLength={3000}
                      required
                    />
                  </label>
                  {list.canNote && (
                    <label>
                      <input
                        name="internal"
                        type="checkbox"
                        defaultChecked={
                          !list.canReply || history.thread.status === "CLOSED"
                        }
                      />
                      یادداشت داخلی؛ برای مشتری منتشر نشود
                    </label>
                  )}
                  <button disabled={busy}>ثبت پیام پشتیبانی</button>
                </form>
              )}
              {list.canManage && (
                <form onSubmit={(event) => void changeStatus(event)}>
                  <label>
                    دلیل تغییر وضعیت
                    <input
                      name="reason"
                      minLength={3}
                      maxLength={300}
                      required
                    />
                  </label>
                  <button disabled={busy}>
                    {history.thread.status === "OPEN"
                      ? "بستن درخواست"
                      : "بازکردن دوباره درخواست"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <p>یک درخواست را انتخاب کنید.</p>
          )}
        </section>
      </div>
    </main>
  );
}
