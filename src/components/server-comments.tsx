"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, UserRound, Send, X, BadgeCheck } from "lucide-react";
import { api, useAccount } from "@/lib/api";
import { faNumber } from "@/lib/catalog";
import { AccountPanel } from "./account-panel";
type Comment = {
  id: string;
  postId: string;
  name: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  isDemo: boolean;
  isOfficial: boolean;
  canDelete: boolean;
  status: string;
  replyCursor?: string | null;
};
type Page = { items: Comment[]; count: number; nextCursor: string | null };
export function ServerComments({ postId }: { postId: string }) {
  const { account } = useAccount();
  const [page, setPage] = useState<Page | null>(null),
    [error, setError] = useState(""),
    [draft, setDraft] = useState(""),
    [replyTo, setReplyTo] = useState<string>(),
    [busy, setBusy] = useState(false);
  const mutation = useRef<{ key: string; value: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const refresh = useCallback(async () => {
    const result = await api<Page>(`/api/posts/${postId}/comments`);
    setPage(result);
    setError("");
  }, [postId]);
  useEffect(() => {
    let active = true;
    const load = () =>
      api<Page>(`/api/posts/${postId}/comments`)
        .then((data) => {
          if (active) {
            setPage(data);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void load();
    return () => {
      active = false;
    };
  }, [postId, account?.user?.id]);
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || busy) return;
    setBusy(true);
    setError("");
    const value = draft.trim() + "|" + (replyTo || "");
    if (mutation.current?.value !== value)
      mutation.current = { value, key: crypto.randomUUID() };
    try {
      const created = await api<Comment>(`/api/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({
          body: draft.trim(),
          parentId: replyTo,
          clientMutationId: mutation.current.key,
        }),
      });
      setDraft("");
      setReplyTo(undefined);
      mutation.current = null;
      setPage((previous) =>
        previous
          ? {
              ...previous,
              count: previous.items.some((item) => item.id === created.id)
                ? previous.count
                : previous.count + 1,
              items: previous.items.some((item) => item.id === created.id)
                ? previous.items
                : created.parentId
                  ? [...previous.items, created]
                  : [created, ...previous.items],
            }
          : { items: [created], count: 1, nextCursor: null },
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await api("/api/comments/" + id, { method: "DELETE" });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function more() {
    if (!page?.nextCursor) return;
    setBusy(true);
    try {
      const next = await api<Page>(
        `/api/posts/${postId}/comments?cursor=${page.nextCursor}`,
      );
      setPage({
        ...next,
        items: [
          ...page.items,
          ...next.items.filter(
            (item) => !page.items.some((old) => old.id === item.id),
          ),
        ],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function moreReplies(root: Comment) {
    if (!root.replyCursor || !page) return;
    setBusy(true);
    try {
      const next = await api<{ items: Comment[]; nextCursor: string | null }>(
        `/api/posts/${postId}/comments?root=${root.id}&cursor=${root.replyCursor}`,
      );
      setPage({
        ...page,
        items: [
          ...page.items.map((item) =>
            item.id === root.id
              ? { ...item, replyCursor: next.nextCursor }
              : item,
          ),
          ...next.items.filter(
            (item) => !page.items.some((old) => old.id === item.id),
          ),
        ],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function comment(c: Comment, isReply = false) {
    return (
      <div
        key={c.id}
        className={isReply ? "reply" : "comment"}
        data-comment-id={c.id}
      >
        {!isReply ? (
          <div className="comment-avatar">
            <UserRound size={16} />
          </div>
        ) : null}
        <div>
          <b>
            {c.name}{" "}
            {c.isOfficial ? (
              <BadgeCheck size={14} aria-label="پاسخ رسمی" />
            ) : null}
          </b>
          {c.isDemo ? <small className="micro"> · آزمایشی</small> : null}
          <p>{c.text}</p>
          <div className="comment-controls">
            {!isReply && c.status === "VISIBLE" && account?.user ? (
              <button
                onClick={() => {
                  setReplyTo(c.id);
                  input.current?.focus();
                }}
              >
                پاسخ
              </button>
            ) : null}
            {c.canDelete ? (
              <button disabled={busy} onClick={() => remove(c.id)}>
                حذف
              </button>
            ) : null}
            <time dateTime={c.createdAt}>
              {new Date(c.createdAt).toLocaleDateString("fa-IR")}
            </time>
          </div>
        </div>
      </div>
    );
  }
  return (
    <section aria-label="دیدگاه‌های عمومی">
      <div className="comments-title">
        <h3>گفت‌وگو دربارهٔ این انتخاب</h3>
        <span>{page ? faNumber(page.count) : "…"}</span>
        <button
          className="text-link"
          onClick={() => refresh().catch((e) => setError(e.message))}
        >
          تازه‌سازی
        </button>
      </div>
      <p className="micro">
        دیدگاه‌ها روی سرور ذخیره می‌شوند و عمومی‌اند. اطلاعات شخصی ننویس.
      </p>
      {error ? (
        <p className="api-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="comments">
        {page?.items
          .filter((c) => !c.parentId)
          .map((c) => (
            <div className="comment-thread" key={c.id}>
              {comment(c)}
              {page.items
                .filter((reply) => reply.parentId === c.id)
                .map((reply) => comment(reply, true))}
              {c.replyCursor ? (
                <button
                  className="text-link"
                  disabled={busy}
                  onClick={() => moreReplies(c)}
                >
                  پاسخ‌های بیشتر
                </button>
              ) : null}
            </div>
          ))}
        {page && !page.items.length ? (
          <div className="comment-empty">
            <MessageCircle size={23} />
            <p>اولین دیدگاه این پست رو تو بنویس.</p>
          </div>
        ) : !page && !error ? (
          <p role="status">در حال دریافت دیدگاه‌ها…</p>
        ) : null}
      </div>
      {page?.nextCursor ? (
        <button className="secondary" disabled={busy} onClick={more}>
          دیدگاه‌های بیشتر
        </button>
      ) : null}
      {account?.user ? (
        <form className="comment-form" onSubmit={send}>
          {replyTo ? (
            <div className="reply-label">
              در حال پاسخ
              <button
                type="button"
                aria-label="لغو پاسخ"
                onClick={() => setReplyTo(undefined)}
              >
                <X size={13} />
              </button>
            </div>
          ) : null}
          <label className="sr-only" htmlFor="comment-input">
            دیدگاه شما
          </label>
          <input
            ref={input}
            id="comment-input"
            placeholder="نظرت رو بنویس…"
            value={draft}
            maxLength={1500}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button disabled={!draft.trim() || busy} aria-label="ارسال دیدگاه">
            <Send size={19} />
          </button>
        </form>
      ) : (
        <AccountPanel compact />
      )}
    </section>
  );
}
