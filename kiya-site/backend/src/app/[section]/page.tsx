export const dynamic = "force-dynamic";
import { publicCatalog } from "@/server/catalog";
import { STORE_SECTIONS } from "@/lib/routes";
import { notFound } from "next/navigation";
import Store from "@/components/store";
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!STORE_SECTIONS.some((s) => s === section)) notFound();
  return <Store section={section} catalog={await publicCatalog()} />;
}
