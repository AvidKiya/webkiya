import { notFound } from "next/navigation";
import Store from "@/components/store";
import { publicCatalog, publicProduct } from "@/server/catalog";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await publicProduct(id);
  if (!product) notFound();
  const catalog = await publicCatalog();
  if (!catalog.some((p) => p.id === id)) catalog.push(product);
  return <Store section="home" initialPost={id} catalog={catalog} />;
}
