export const dynamic = "force-dynamic";
import { publicCatalog } from "@/server/catalog";
import { STORE_SECTIONS } from "@/lib/routes";
import { notFound } from "next/navigation";
import Store from "@/components/kiya/store";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { section } = await params;
  if (!STORE_SECTIONS.some((s) => s === section)) notFound();
  const { q } = await searchParams;
  return (
    <Store
      section={section}
      catalog={await publicCatalog()}
      initialQuery={q ?? ""}
    />
  );
}
