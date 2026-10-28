export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(value: number | string) {
  return new Intl.NumberFormat("fa-IR").format(Number(value));
}

export function formatPrice(value: number | string) {
  return `${formatNumber(Math.round(Number(value)))} تومان`;
}

export function discountPercent(
  price: number | string,
  compare?: number | string,
) {
  const now = Number(price);
  const before = Number(compare || 0);
  if (!before || before <= now) return 0;
  return Math.round(((before - now) / before) * 100);
}

export function relativeTime(iso: string) {
  const time = Date.parse(iso);
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - time) / 60000));
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${formatNumber(minutes)} دقیقه پیش`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${formatNumber(hours)} ساعت پیش`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${formatNumber(days)} روز پیش`;
  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(time));
}
