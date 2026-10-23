"use client";
import Link from "next/link";
import { useAccount } from "@/lib/api";
import { OrderHistory } from "../order-history";
export function CustomerOrders() {
  const { account, error } = useAccount();
  return (
    <section className="surface template-customer-orders">
      <h2>پیگیری سفارش‌ها</h2>
      {error ? (
        <p role="alert">{error}</p>
      ) : !account ? (
        <p role="status">در حال بررسی حساب…</p>
      ) : account.user?.kind === "CUSTOMER" ? (
        <OrderHistory key={account.user.id} nonce={0} />
      ) : (
        <p>برای دیدن سفارش‌های خود با حساب مشتری وارد شوید.</p>
      )}
      <Link className="text-link" href="/basket">
        رفتن به سبد و ثبت سفارش اولیه
      </Link>
    </section>
  );
}
