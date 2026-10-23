import "server-only";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "./db";
import { requireUser, requireStaff, limit } from "./auth";
import { freshCustomer } from "./wholesale";
import { reauthorize } from "./product-workflow";
import { ApiError } from "./http";
import { normalizeImage } from "./image-processing";
import { storeMedia, loadMedia } from "./media-storage";
export const transferInput = z
  .object({
    orderId: z.uuid(),
    recipient: z.string().trim().min(2).max(100),
    phone: z.string().regex(/^\+?[0-9]{10,15}$/),
    city: z.string().trim().min(2).max(80),
    address: z.string().trim().min(10).max(500),
    postalCode: z.string().regex(/^\d{10}$/),
  })
  .strict();
export const reviewPaymentInput = z
  .object({
    version: z.number().int().positive(),
    decision: z.enum(["CONFIRM", "REJECT"]),
    reason: z.string().trim().min(10).max(500),
    bankReconciled: z.boolean(),
    bankReference: z
      .string()
      .trim()
      .min(6)
      .max(100)
      .regex(/^[A-Za-z0-9][A-Za-z0-9:/_. -]*$/)
      .optional(),
  })
  .strict();
function dto(
  p: Awaited<
    ReturnType<ReturnType<typeof db>["manualPayment"]["findUniqueOrThrow"]>
  >,
) {
  return {
    id: p.id,
    orderId: p.orderId,
    amountToman: p.amountToman.toString(),
    shippingToman: p.shippingToman.toString(),
    taxToman: p.taxToman.toString(),
    destination: p.destination,
    shippingAddress: p.shippingAddress,
    status: p.status,
    version: p.version,
    transferReference: p.transferReference,
    hasReceipt: !!p.imageHash,
    reviewReason: p.reviewReason,
  };
}
export async function transferForOrder(r: Request, orderId: string) {
  const current = await requireUser(r);
  if (current.user.kind !== "CUSTOMER")
    throw new ApiError(403, "CUSTOMER_REQUIRED", "حساب مشتری لازم است.");
  const order = await db().purchaseOrder.findFirst({
    where: { id: orderId, userId: current.user.id },
  });
  if (!order) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
  const p = await db().manualPayment.findUnique({ where: { orderId } }),
    config = await db().storeSettings.findUnique({ where: { id: 1 } });
  return {
    payment: p ? dto(p) : null,
    available: !!config?.cardEnabled,
    reservedUntil: order.reservedUntil,
    orderStatus: order.status,
  };
}
export async function createTransfer(
  r: Request,
  input: z.infer<typeof transferInput>,
) {
  const current = await requireUser(r);
  await limit("transfer-create:" + current.user.id, 10, 3600);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${input.orderId}::uuid FOR UPDATE`;
    await freshCustomer(tx, current);
    const order = await tx.purchaseOrder.findFirst({
      where: { id: input.orderId, userId: current.user.id },
    });
    if (!order) throw new ApiError(404, "NOT_FOUND", "سفارش پیدا نشد.");
    const prior = await tx.manualPayment.findUnique({
      where: { orderId: order.id },
    });
    if (prior) return dto(prior);
    if (order.status !== "RESERVED" || order.reservedUntil <= new Date())
      throw new ApiError(
        409,
        "ORDER_EXPIRED",
        "رزرو پایان یافته؛ پیش از واریز، سفارش تازه بسازید.",
      );
    const c = await tx.storeSettings.findUnique({ where: { id: 1 } });
    if (!c?.cardEnabled)
      throw new ApiError(
        503,
        "TRANSFER_UNCONFIGURED",
        "کارت‌به‌کارت هنوز در تنظیمات فروشگاه فعال نشده است.",
      );
    const amount =
      BigInt(order.subtotalToman.toString()) +
      BigInt(c.shippingToman.toString()) +
      BigInt(c.taxToman.toString());
    if (amount > 99999999999999n)
      throw new ApiError(422, "AMOUNT_LIMIT", "مبلغ خارج از محدوده است.");
    const { orderId, ...shippingAddress } = input;
    void orderId;
    const payment = await tx.manualPayment.create({
      data: {
        orderId: order.id,
        userId: current.user.id,
        amountToman: amount.toString(),
        shippingToman: c.shippingToman,
        taxToman: c.taxToman,
        destination: {
          bankName: c.bankName,
          cardNumber: c.cardNumber,
          cardHolder: c.cardHolder,
        },
        shippingAddress,
      },
    });
    const deadline = new Date(Date.now() + c.transferMinutes * 60000);
    if (deadline > order.reservedUntil)
      await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { reservedUntil: deadline, version: { increment: 1 } },
      });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "payment:manual_created",
        resourceId: payment.id,
        data: { orderId: order.id },
      },
    });
    return dto(payment);
  });
}
export async function uploadReceipt(r: Request, id: string) {
  const current = await requireUser(r);
  await limit("receipt:" + current.user.id, 10, 3600);
  const p = await db().manualPayment.findFirst({
    where: { id, userId: current.user.id },
  });
  if (!p) throw new ApiError(404, "NOT_FOUND", "پرداخت پیدا نشد.");
  if (!["AWAITING_TRANSFER", "REJECTED"].includes(p.status))
    throw new ApiError(
      409,
      "PAYMENT_STATE",
      "رسید قبلاً ثبت شده یا بررسی در جریان است.",
    );
  const cap = 6 * 1024 * 1024;
  if (!r.headers.get("content-type")?.startsWith("multipart/form-data;"))
    throw new ApiError(415, "CONTENT_TYPE", "تصویر رسید لازم است.");
  if (Number(r.headers.get("content-length") || 0) > cap)
    throw new ApiError(413, "IMAGE_SIZE", "حجم تصویر بیش از حد مجاز است.");
  const reader = r.body?.getReader(),
    parts: Uint8Array[] = [];
  let size = 0;
  if (reader)
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > cap) {
        await reader.cancel();
        throw new ApiError(413, "IMAGE_SIZE", "حجم تصویر بیش از حد مجاز است.");
      }
      parts.push(chunk.value);
    }
  let form: FormData;
  try {
    form = await new Response(Buffer.concat(parts), {
      headers: { "content-type": r.headers.get("content-type")! },
    }).formData();
  } catch {
    throw new ApiError(422, "RECEIPT_FORMAT", "فایل رسید معتبر نیست.");
  }
  const file = form.get("file"),
    reference = z
      .string()
      .trim()
      .min(4)
      .max(80)
      .safeParse(form.get("reference")),
    version = z.coerce.number().int().positive().safeParse(form.get("version"));
  if (
    !file ||
    typeof file === "string" ||
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 5 * 1024 * 1024 ||
    !reference.success ||
    !version.success
  )
    throw new ApiError(
      422,
      "RECEIPT_FORMAT",
      "رسید تصویری، کد پیگیری و نسخهٔ معتبر لازم است.",
    );
  let normalized: Buffer;
  try {
    normalized = (await normalizeImage(Buffer.from(await file.arrayBuffer())))
      .bytes;
  } catch {
    throw new ApiError(
      422,
      "RECEIPT_IMAGE",
      "تصویر رسید را به صورت JPEG، PNG یا WebP معتبر بفرستید.",
    );
  }
  const imageHash = createHash("sha256").update(normalized).digest("hex");
  await storeMedia("private-receipt-" + imageHash, normalized);
  return db().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "ManualPayment" WHERE id=${id}::uuid FOR UPDATE`;
    await freshCustomer(tx, current);
    const row = await tx.manualPayment.findFirst({
      where: { id, userId: current.user.id },
    });
    if (!row) throw new ApiError(404, "NOT_FOUND", "پرداخت پیدا نشد.");
    if (row.imageHash === imageHash && row.transferReference === reference.data)
      return dto(row);
    if (
      row.version !== version.data ||
      !["AWAITING_TRANSFER", "REJECTED"].includes(row.status)
    )
      throw new ApiError(
        409,
        "STALE_VERSION",
        "وضعیت رسید تغییر کرده؛ تازه‌سازی کنید.",
      );
    if (
      await tx.manualPayment.findFirst({
        where: { imageHash, id: { not: id } },
      })
    )
      throw new ApiError(
        409,
        "DUPLICATE_RECEIPT",
        "این تصویر برای پرداخت دیگری ثبت شده است؛ نیازمند بررسی پشتیبانی است.",
      );
    const next = await tx.manualPayment.update({
      where: { id },
      data: {
        imageHash,
        transferReference: reference.data,
        status: "UNDER_REVIEW",
        version: { increment: 1 },
        submittedAt: new Date(),
        reviewReason: null,
        reviewerId: null,
        reviewedAt: null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: current.user.id,
        action: "payment:receipt_submitted",
        resourceId: id,
        data: {},
      },
    });
    return dto(next);
  });
}
export async function listManualPayments(r: Request) {
  await requireStaff(r, "payment:review");
  const rows = await db().manualPayment.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    items: rows.map((p) => ({
      ...dto(p),
      bankVerifiedReference: p.bankVerifiedReference,
    })),
  };
}
export async function receiptImage(r: Request, id: string) {
  const current = await requireUser(r);
  await limit("receipt-read:" + current.user.id, 60, 60);
  const p = await db().manualPayment.findUnique({ where: { id } });
  if (!p || !p.imageHash)
    throw new ApiError(404, "NOT_FOUND", "رسید پیدا نشد.");
  if (p.userId !== current.user.id) {
    await requireStaff(r, "payment:review");
    await db().auditLog.create({
      data: {
        actorId: current.user.id,
        action: "payment:receipt_read",
        resourceId: id,
        data: {},
      },
    });
  }
  return loadMedia("private-receipt-" + p.imageHash);
}
export async function reviewTransfer(
  r: Request,
  id: string,
  input: z.infer<typeof reviewPaymentInput>,
) {
  const actor = await requireStaff(r, "payment:review");
  await limit("payment-review:" + actor.user.id, 60, 60);
  if (
    input.decision === "CONFIRM" &&
    (!input.bankReconciled || !input.bankReference)
  )
    throw new ApiError(
      422,
      "RECONCILIATION_REQUIRED",
      "تطبیق واقعی مبلغ و حساب مقصد و شناسهٔ یکتای ردیف گردش بانک الزامی است؛ تصویر رسید به تنهایی کافی نیست.",
    );
  return db()
    .$transaction(async (tx) => {
      const ref = await tx.manualPayment.findUnique({ where: { id } });
      if (!ref) throw new ApiError(404, "NOT_FOUND", "پرداخت پیدا نشد.");
      await tx.$queryRaw`SELECT id FROM "PurchaseOrder" WHERE id=${ref.orderId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM "ManualPayment" WHERE id=${id}::uuid FOR UPDATE`;
      await reauthorize(tx, actor, "payment:review");
      const p = await tx.manualPayment.findUniqueOrThrow({ where: { id } });
      if (p.userId === actor.user.id)
        throw new ApiError(
          403,
          "SELF_APPROVAL",
          "تأیید پرداخت خودتان مجاز نیست.",
        );
      if (p.status === "CONFIRMED" || p.status === "REFUND_REQUIRED")
        return dto(p);
      if (
        p.version !== input.version ||
        p.status !== "UNDER_REVIEW" ||
        !p.imageHash
      )
        throw new ApiError(
          409,
          "STALE_VERSION",
          "رسید تغییر کرده یا آماده بررسی نیست.",
        );
      const order = await tx.purchaseOrder.findUniqueOrThrow({
        where: { id: p.orderId },
      });
      const late =
        order.status !== "RESERVED" || order.reservedUntil <= new Date();
      const status =
        input.decision === "REJECT"
          ? "REJECTED"
          : late
            ? "REFUND_REQUIRED"
            : "CONFIRMED";
      const bankReference =
        input.decision === "CONFIRM"
          ? input.bankReference!.toUpperCase().replace(/\s+/g, " ")
          : null;
      const destination = p.destination as { cardNumber: string };
      const bankProofKey = bankReference
        ? createHash("sha256")
            .update(destination.cardNumber + ":" + bankReference)
            .digest("hex")
        : null;
      if (
        bankProofKey &&
        (await tx.manualPayment.findFirst({
          where: { bankProofKey, id: { not: id } },
        }))
      )
        throw new ApiError(
          409,
          "BANK_ENTRY_USED",
          "این ردیف گردش بانک قبلاً برای پرداخت دیگری تطبیق شده است.",
        );
      const updated = await tx.manualPayment.update({
        where: { id },
        data: {
          status,
          version: { increment: 1 },
          reviewerId: actor.user.id,
          bankVerifiedReference: bankReference,
          bankProofKey,
          reviewReason: input.reason,
          reviewedAt: new Date(),
        },
      });
      if (status === "CONFIRMED")
        await tx.$queryRaw`SELECT kiya_capture_manual(${p.orderId}::uuid,${actor.user.id}::uuid)`;
      await tx.auditLog.create({
        data: {
          actorId: actor.user.id,
          action: "payment:" + status.toLowerCase(),
          resourceId: id,
          data: { orderId: p.orderId, bankReconciled: input.bankReconciled },
        },
      });
      return dto(updated);
    })
    .catch((error) => {
      if (error?.code === "P2002")
        throw new ApiError(
          409,
          "BANK_ENTRY_USED",
          "این ردیف گردش بانک هم‌زمان در پرداخت دیگری ثبت شد.",
        );
      throw error;
    });
}
