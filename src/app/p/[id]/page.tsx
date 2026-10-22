export const dynamicParams = false;
import { notFound } from "next/navigation";
import { products } from "@/lib/catalog";
import Store from "@/components/store";
export function generateStaticParams() {
  return products.map(({ id }) => ({ id }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!products.some((p) => p.id === id)) notFound();
  return <Store section="home" initialPost={id} />;
}
