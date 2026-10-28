"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { faNumber } from "@/lib/catalog";

type Detail = {
  id: string;
  status: string;
  version: number;
  allowedNext: string[];
  holds: {
    sku: string;
    name: string;
    units: number;
    stock: number;
    reserved: number;
  }[];
  events: {
    id: string;
    fromStatus: string;
    toStatus: string;
    reason: string;
    createdAt: string;
    actor: string;
  }[];
};
export const orderStatusLabels: Record<string, string> = {
  RESERVED: "رزرو فعال",
  CONFIRMED: "تأییدشده",
  PREPARING: "در حال آماده‌سازی",
  SHIPPED: "ارسال‌شده",
  COMPLETED: "تکمیل‌شده",
  CANCELLED: "لغوشده",
  EXPIRED: "منقضی‌شده",
};
const nextLabels: Record<string, string> = {
  PREPARING: "شروع آماده‌سازی",
  SHIPPED: "ثبت ارسال",
  COMPLETED: "تکمیل سفارش",
};
// Mirrors the server transition rules so actions are visible before detail loads.
const allowedFrom: Record<string, string[]> = {
  CONFIRMED: ["PREPARING", "SHIPPED", "COMPLETED"],
  PREPARING: ["SHIPPED", "COMPLETED"],
  SHIPPED: ["COMPLETED"],
};
const transitionable = (status: string) =>
  (allowedFrom[status] || []).length > 0;
function message(error: unknown) {
  return error instanceof Error ? error.message : "خطای نامشخص";
}
export function OrderManager({
  id,
  status,
  version,
  canManage,
  onSaved,
}: {
  id: string;
  status: string;
  version: number;
  canManage: boolean;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null),
    [open, setOpen] = useState(false),
    [reason, setReason] = useState(""),
    [next, setNext] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function load() {
    setError("");
    try {
      setDetail(await api<Detail>("/api/admin/orders/" + id));
    } catch (e) {
      setError(message(e));
    }
  }
  async function decide(action: "CONFIRM" | "ADVANCE", to?: string) {
    if (reason.trim().length < 3) {
      setError("دلیل تغییر وضعیت الزامی است (حداقل سه نویسه).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/orders/" + id, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          version,
          reason: reason.trim(),
          ...(to ? { next: to } : {}),
        }),
      });
      setReason("");
      setNext("");
      setOpen(false);
      setDetail(null);
      onSaved();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const allowed = detail?.allowedNext.length
    ? detail.allowedNext
    : allowedFrom[status] || [];
  return (
    <div className="order-manager">
      <div className="order-actions">
        {canManage && (status === "RESERVED" || transitionable(status)) ? (
          <label className="reason">
            دلیل تصمیم (الزامی)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              minLength={3}
              aria-label={"دلیل تصمیم سفارش " + id}
            />
          </label>
        ) : null}
        {canManage && status === "RESERVED" ? (
          <button
            className="primary"
            disabled={busy}
            onClick={() => decide("CONFIRM")}
          >
            تأیید سفارش و کسر موجودی
          </button>
        ) : null}
        {canManage && transitionable(status) ? (
          <>
            <label>
              مرحله بعد
              <select
                value={next}
                onChange={(e) => setNext(e.target.value)}
                aria-label={"مرحله بعدی سفارش " + id}
              >
                <option value="">انتخاب کنید</option>
                {allowed.map((s) => (
                  <option key={s} value={s}>
                    {nextLabels[s] || s}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary"
              disabled={busy || !next}
              onClick={() => decide("ADVANCE", next)}
            >
              ثبت مرحله
            </button>
          </>
        ) : null}
        <button
          className="secondary"
          disabled={busy}
          onClick={async () => {
            if (!open) await load();
            setOpen(!open);
          }}
        >
          {open ? "بستن جزئیات" : "جزئیات رزرو و تاریخچه"}
        </button>
      </div>
      {error ? <p role="alert">{error}</p> : null}
      {open && detail ? (
        <>
          <p className="micro">
            رزروها بر اساس SKU؛ پس از تأیید، موجودی کسر و رزرو آزاد می‌شود.
          </p>
          {detail.holds.length ? (
            <div className="order-lines">
              {detail.holds.map((h) => (
                <span key={h.sku}>
                  <bdi dir="ltr">{h.sku}</bdi> · {h.name} · {faNumber(h.units)}{" "}
                  عدد · موجودی {faNumber(h.stock)} · رزرو {faNumber(h.reserved)}
                </span>
              ))}
            </div>
          ) : (
            <p className="micro">این سفارش رزرو فعالی برای SKU ندارد.</p>
          )}
          <div className="order-events">
            {detail.events.length ? (
              detail.events.map((e) => (
                <span key={e.id}>
                  <b>
                    {orderStatusLabels[e.fromStatus] || e.fromStatus} ←{" "}
                    {orderStatusLabels[e.toStatus] || e.toStatus}
                  </b>{" "}
                  · {e.actor} · {new Date(e.createdAt).toLocaleString("fa-IR")}{" "}
                  · {e.reason}
                </span>
              ))
            ) : (
              <span>هنوز رویداد مدیریتی ثبت نشده است.</span>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
