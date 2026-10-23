import { z } from "zod";
import { endpoint, ok, sameOrigin, readBody, ApiError } from "@/server/http";
import { requireOwner } from "@/server/access";
import { integrationConfig } from "@/server/settings";
import { limit } from "@/server/auth";
import { db } from "@/server/db";
import { reauthorize } from "@/server/product-workflow";
export async function POST(r: Request) {
  return endpoint(async () => {
    sameOrigin(r);
    const actor = await requireOwner(r);
    await limit("telegram-config:" + actor.user.id, 20, 60);
    const { action } = await readBody(
      r,
      z.object({ action: z.enum(["test", "webhook", "polling"]) }).strict(),
    );
    const c = await integrationConfig();
    if (!c.enabled || !c.token || !c.secret)
      throw new ApiError(
        503,
        "UNCONFIGURED",
        "ابتدا تنظیمات ربات را کامل و ذخیره کنید.",
      );
    async function call(method: string, body: object) {
      try {
        const response = await fetch(
          "https://api.telegram.org/bot" + c.token + "/" + method,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000),
          },
        );
        const value = await response.json();
        if (!response.ok || !value.ok) throw Error();
        return value.result;
      } catch {
        throw new ApiError(
          503,
          "PROVIDER_UNAVAILABLE",
          "اتصال به تلگرام برقرار نشد؛ دسترسی شبکه و توکن را در میزبان بررسی کنید.",
        );
      }
    }
    const me = await call("getMe", {});
    if (
      typeof me?.username !== "string" ||
      me.username.toLowerCase() !== c.username.toLowerCase()
    )
      throw new ApiError(
        409,
        "BOT_MISMATCH",
        "توکن متعلق به نام کاربری ربات ذخیره‌شده نیست.",
      );
    if (action === "webhook") {
      const site = process.env.NEXT_PUBLIC_SITE_URL;
      let url: URL;
      try {
        url = new URL(site || "");
        if (url.protocol !== "https:" || url.username || url.password)
          throw Error();
      } catch {
        throw new ApiError(
          422,
          "PUBLIC_HTTPS_REQUIRED",
          "دامنهٔ عمومی HTTPS را در NEXT_PUBLIC_SITE_URL میزبان تنظیم کنید.",
        );
      }
      await call("setWebhook", {
        url: new URL("/api/webhooks/telegram", url).href,
        secret_token: c.secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      });
    }
    if (action === "polling")
      await call("deleteWebhook", { drop_pending_updates: false });
    await db().$transaction(async (tx) => {
      await reauthorize(tx, actor, "staff:manage");
      const current = await tx.storeSettings.findUnique({ where: { id: 1 } });
      if (current?.version !== c.settings?.version)
        throw new ApiError(
          409,
          "SETTINGS_CHANGED",
          "تنظیمات حین تست تغییر کرد؛ نتیجه را دوباره بررسی کنید.",
        );
      await tx.auditLog.create({
        data: {
          actorId: actor.user.id,
          action: "telegram:" + action,
          resourceId: "integration",
          data: { providerVerified: true },
        },
      });
    });
    return ok({
      verified: true,
      action,
      username: c.username,
      message:
        action === "test"
          ? "هویت ربات با API واقعی تطبیق شد؛ تحویل پیام هنوز نیازمند worker و آزمون ورود است."
          : "روش دریافت رویداد تنظیم شد؛ worker انتقال پیام‌ها باید روشن باشد.",
    });
  });
}
