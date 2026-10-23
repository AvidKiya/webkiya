"use client";
import { useEffect, useState } from "react";
import { api, authChanged } from "@/lib/api";
type Role = {
  id: string;
  name: string;
  key: string;
  permissions: string[];
  version: number;
};
type Staff = {
  id: string;
  displayName: string;
  handle: string | null;
  phoneMasked: string | null;
  isActive: boolean;
  mfaEnabled: boolean;
  permissionVersion: number;
  roles: { roleId: string }[];
};
type Data = {
  roles: Role[];
  staff: Staff[];
  eligibleAccounts: {
    id: string;
    displayName: string;
    phoneMasked: string | null;
  }[];
  delegatedPermissions: string[];
};
const labels: Record<string, string> = {
  "dashboard:read": "نمای کلی",
  "support:read": "مشاهده درخواست‌های خصوصی پشتیبانی",
  "support:reply": "پاسخ عمومی به صاحب درخواست",
  "support:note": "مشاهده و ثبت یادداشت داخلی پشتیبانی",
  "support:manage": "بستن و بازکردن درخواست پشتیبانی",
  "order:read": "مشاهده سفارش‌های پرداخت‌شده و اطلاعات ارسال",
  "order:manage": "آماده‌سازی، ثبت ارسال و تحویل سفارش",
  "payment:review": "بررسی مستقل رسید و تطبیق بانک",
  "comment:read": "خواندن دیدگاه",
  "comment:reply": "پاسخ رسمی",
  "comment:moderate": "نظارت دیدگاه",
  "partner:read": "خواندن پروندهٔ همکار",
  "partner:review": "بررسی/رد همکار",
  "partner:approve": "تأیید همکار",
  "partner:suspend": "تعلیق همکار",
  "product:read": "خواندن کالا",
  "product:write": "نوشتن پیش‌نویس کالا",
  "product:publish": "انتشار و بایگانی کالا",
  "inventory:read": "خواندن موجودی",
  "inventory:manage": "اصلاح موجودی",
  "wholesale:pack:manage": "تنظیم ترکیب جین",
  "wholesale:price:read": "خواندن قیمت خصوصی عمده",
  "wholesale:price:manage": "ثبت قیمت خصوصی عمده",
  "wholesale:price:publish": "تأیید مستقل قیمت عمده",
  "wholesale:pack:publish": "فعال‌سازی جین",
  "staff:read": "خواندن فهرست پرسنل",
  "audit:read": "خواندن رویداد امنیتی",
};
export function AccessManagement({ selfId }: { selfId: string }) {
  const [data, setData] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [nonce, setNonce] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    api<Data>("/api/admin/access")
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [nonce]);
  async function mutate(path: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setMessage("تغییرات در پایگاه داده ثبت شد.");
      setNonce((n) => n + 1);
      authChanged();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="admin-card access-management">
      <h2>مدیر کل · پرسنل و نقش‌های واقعی</h2>
      <p className="admin-note">
        تغییر مجوز یا وضعیت، نشست‌های حساب مربوط را باطل می‌کند. حساب تازه تا
        تکمیل MFA به مدیریت وارد نمی‌شود. نقش‌های پایه قابل ویرایش نیستند؛ اعطای
        مالکیت نیاز به تأیید صریح دارد. این ابزار scope کالا/انبار ندارد؛ مجوزها
        عملیاتی و سراسری‌اند.
      </p>
      {error ? (
        <p role="alert" className="admin-alert">
          {error}
        </p>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {!data && !error ? (
        <p role="status">در حال دریافت فهرست مدیریت…</p>
      ) : null}
      {data ? (
        <>
          <details className="access-section" data-testid="staff-create">
            <summary>مدیر کردن حساب کاربری تأییدشده</summary>
            <form
              className="backend-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget,
                  v = new FormData(form);
                if (
                  await mutate("/api/admin/staff/promote", "POST", {
                    userId: v.get("userId"),
                    reason: v.get("reason"),
                    roleIds: v.getAll("roleIds"),
                    ownerConfirmed: v.get("ownerConfirmed") === "on",
                  })
                )
                  form.reset();
              }}
            >
              <label>
                حساب کاربری
                <select name="userId" required defaultValue="">
                  <option value="" disabled>
                    انتخاب حساب با تلگرام و شمارهٔ تأییدشده
                  </option>
                  {data.eligibleAccounts.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.displayName} · {u.phoneMasked} · {u.id}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                فرد ابتدا با حساب تلگرام خودش وارد سایت و شمارهٔ خودش را در بات
                به اشتراک بگذارد. سفارش‌ها و شناسهٔ حساب حفظ می‌شوند؛ پس از
                اعطای نقش باید دوباره وارد شود.
              </p>
              <label>
                دلیل اعطای نقش
                <textarea
                  name="reason"
                  required
                  minLength={10}
                  maxLength={500}
                />
              </label>
              <RoleChoices roles={data.roles} />
              <label className="access-check">
                <input type="checkbox" name="ownerConfirmed" />
                در صورت انتخاب نقش مالک، اعطای اختیارات کامل را تأیید می‌کنم.
              </label>
              <button className="primary" disabled={busy}>
                اعطای نقش به همین حساب
              </button>
            </form>
          </details>
          <details className="access-section" data-testid="role-create">
            <summary>ساخت نقش سفارشی</summary>
            <RoleForm
              permissions={data.delegatedPermissions}
              busy={busy}
              onSubmit={(body) => mutate("/api/admin/roles", "POST", body)}
            />
          </details>
          <h3>حساب‌های پرسنلی</h3>
          {data.staff.map((u) => (
            <article className="access-record" key={u.id}>
              <h4>
                {u.displayName}
                {u.id === selfId ? " · حساب شما" : ""}
              </h4>
              <p>
                <code dir="ltr">{u.handle || "ورود با حساب تلگرام"}</code> ·{" "}
                {u.phoneMasked || "بدون موبایل ثبت‌شده"} ·{" "}
                {u.isActive ? "فعال" : "غیرفعال"} · MFA:{" "}
                {u.mfaEnabled ? "فعال" : "در انتظار تنظیم"}
              </p>
              <p>
                {u.roles
                  .map((ur) => data.roles.find((r) => r.id === ur.roleId)?.name)
                  .join("، ")}
              </p>
              {u.id !== selfId ? (
                <details>
                  <summary>تغییر نقش یا وضعیت</summary>
                  <form
                    className="backend-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const v = new FormData(e.currentTarget);
                      void mutate("/api/admin/staff/" + u.id, "PATCH", {
                        isActive: v.get("isActive") === "on",
                        roleIds: v.getAll("roleIds"),
                        version: u.permissionVersion,
                        reason: v.get("reason"),
                        ownerConfirmed: v.get("ownerConfirmed") === "on",
                      });
                    }}
                  >
                    <label className="access-check">
                      <input
                        key={String(u.isActive)}
                        type="checkbox"
                        name="isActive"
                        defaultChecked={u.isActive}
                      />
                      حساب فعال باشد
                    </label>
                    <RoleChoices
                      key={u.permissionVersion}
                      roles={data.roles}
                      selected={u.roles.map((r) => r.roleId)}
                    />
                    <label className="access-check">
                      <input type="checkbox" name="ownerConfirmed" />
                      اعطای/حفظ نقش مالک را آگاهانه تأیید می‌کنم.
                    </label>
                    <label>
                      دلیل تغییر
                      <input
                        name="reason"
                        required
                        minLength={3}
                        maxLength={500}
                      />
                    </label>
                    <button className="primary" disabled={busy}>
                      ثبت وضعیت و نقش‌ها
                    </button>
                  </form>
                </details>
              ) : (
                <small>
                  تغییر نقش یا غیرفعال‌کردن حساب خودتان از اینجا مجاز نیست.
                </small>
              )}
            </article>
          ))}
          <h3>نقش‌های سفارشی قابل ویرایش</h3>
          {data.roles
            .filter((r) => r.key.startsWith("CUSTOM_"))
            .map((role) => (
              <details
                key={role.id + ":" + role.version}
                className="access-section"
              >
                <summary>{role.name}</summary>
                <RoleForm
                  role={role}
                  permissions={data.delegatedPermissions}
                  busy={busy}
                  onSubmit={(body) =>
                    mutate("/api/admin/roles/" + role.id, "PATCH", body)
                  }
                />
              </details>
            ))}
        </>
      ) : null}
    </section>
  );
}
function RoleChoices({
  roles,
  selected = [],
}: {
  roles: Role[];
  selected?: string[];
}) {
  return (
    <fieldset className="access-choices">
      <legend>نقش‌های حساب (حداقل یکی)</legend>
      {roles.map((r) => (
        <label key={r.id}>
          <input
            type="checkbox"
            name="roleIds"
            value={r.id}
            defaultChecked={selected.includes(r.id)}
          />
          {r.name}
          {r.key === "OWNER" ? " — اختیارات مدیر کل" : ""}
        </label>
      ))}
    </fieldset>
  );
}
function RoleForm({
  role,
  permissions,
  busy,
  onSubmit,
}: {
  role?: Role;
  permissions: string[];
  busy: boolean;
  onSubmit: (body: unknown) => Promise<boolean>;
}) {
  return (
    <form
      className="backend-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget,
          v = new FormData(form);
        const saved = await onSubmit({
          name: v.get("name"),
          permissions: v.getAll("permissions"),
          ...(role ? { version: role.version } : {}),
        });
        if (saved && !role) form.reset();
      }}
    >
      <label>
        نام نقش
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={role?.name || ""}
        />
      </label>
      <fieldset className="access-choices">
        <legend>مجوزهای عملیاتی (حداقل یکی)</legend>
        {permissions.map((p) => (
          <label key={p}>
            <input
              type="checkbox"
              name="permissions"
              value={p}
              defaultChecked={role?.permissions.includes(p)}
            />
            {labels[p] || p}
          </label>
        ))}
      </fieldset>
      <button className="primary" disabled={busy}>
        {role ? "ذخیره نقش و ابطال نشست‌های مربوط" : "ساخت نقش سفارشی"}
      </button>
    </form>
  );
}
export function PasswordChange() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <details className="admin-card access-section">
      <summary>امنیت حساب من · تغییر رمز</summary>
      <form
        className="backend-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget,
            v = new FormData(form);
          setError("");
          if (v.get("newPassword") !== v.get("confirmPassword")) {
            setError("تکرار رمز جدید یکسان نیست.");
            return;
          }
          setBusy(true);
          try {
            await api("/api/auth/password", {
              method: "POST",
              body: JSON.stringify({
                oldPassword: v.get("oldPassword"),
                newPassword: v.get("newPassword"),
              }),
            });
            form.reset();
            authChanged();
          } catch (err) {
            setError((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <p className="admin-note">
          پس از تغییر رمز، همهٔ نشست‌ها از جمله همین نشست باطل می‌شوند؛ دوباره
          با رمز جدید و MFA وارد شوید.
        </p>
        <label>
          رمز فعلی
          <input
            type="password"
            name="oldPassword"
            autoComplete="current-password"
            required
            maxLength={200}
          />
        </label>
        <label>
          رمز جدید
          <input
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={14}
            maxLength={200}
          />
        </label>
        <label>
          تکرار رمز جدید
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={14}
            maxLength={200}
          />
        </label>
        {error ? (
          <p className="admin-alert" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary" disabled={busy}>
          تغییر رمز و خروج از همهٔ نشست‌ها
        </button>
      </form>
    </details>
  );
}
