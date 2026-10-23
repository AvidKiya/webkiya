import Link from "next/link";
export default function NotFound() {
  return (
    <main className="standalone">
      <span className="eyebrow">KIYA / 404</span>
      <h1>این گوشه هنوز چیزی نیست.</h1>
      <p>شاید آدرس تغییر کرده؛ بیا برگردیم به کشف چیزهای تازه.</p>
      <Link className="primary" href="/">
        بازگشت به خانه
      </Link>
    </main>
  );
}
