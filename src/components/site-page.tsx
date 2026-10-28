import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Home, Sparkles } from "lucide-react";
import { infoPages, site } from "@/lib/site";
import { SiteFooter } from "./site-footer";
import "../app/site-page.css";

export function InfoPage({
  eyebrow,
  title,
  lead,
  current,
  children,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
  current: string;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="info-page">
      <header className="info-topbar">
        <Link href="/" className="info-brand" aria-label="کیا — صفحه اصلی">
          <Image
            src="/brand/logo-light.webp"
            alt="کیا — KIYA"
            width={92}
            height={54}
            priority
          />
          <span>
            {site.name}
            <small>
              {site.nameEn} / {site.domain}
            </small>
          </span>
        </Link>
        <nav aria-label="صفحات اطلاعاتی">
          {infoPages.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={current === p.href ? "page" : undefined}
              className={current === p.href ? "active" : ""}
            >
              {p.label}
            </Link>
          ))}
        </nav>
        <Link href="/" className="info-store-link">
          <Home size={15} /> فروشگاه
        </Link>
      </header>
      <section className="info-hero">
        <span className="eyebrow">
          <Sparkles size={13} /> {eyebrow}
        </span>
        <h1>{title}</h1>
        {lead ? <p>{lead}</p> : null}
      </section>
      <div className="info-body">{children}</div>
      <div className="info-back">
        <Link href="/" className="text-link">
          بازگشت به فروشگاه <ArrowLeft size={15} />
        </Link>
        <Link href="/progress" className="text-link">
          نقشهٔ تکمیل پروژه <ArrowLeft size={15} />
        </Link>
      </div>
      <SiteFooter />
    </main>
  );
}

export function InfoSection({
  title,
  children,
  id,
}: {
  title: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section className="info-section" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
