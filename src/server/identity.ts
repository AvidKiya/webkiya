import "server-only";
export function normalizeDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (c) =>
    String(
      "۰۱۲۳۴۵۶۷۸۹".indexOf(c) >= 0
        ? "۰۱۲۳۴۵۶۷۸۹".indexOf(c)
        : "٠١٢٣٤٥٦٧٨٩".indexOf(c),
    ),
  );
}
export function normalizePhone(value: string): string | null {
  const v = normalizeDigits(value).trim();
  if (/^09[0-9]{9}$/.test(v)) return "+98" + v.slice(1);
  if (/^\+989[0-9]{9}$/.test(v)) return v;
  if (/^00989[0-9]{9}$/.test(v)) return "+" + v.slice(2);
  return null;
}
export function staffIdentifier(value: string) {
  const v = normalizeDigits(value).trim().toLowerCase(),
    phone = normalizePhone(v);
  return { value: phone || v, phone, handle: v };
}
