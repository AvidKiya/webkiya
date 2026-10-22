export const dynamicParams = false;
import { notFound } from "next/navigation";
import Store from "@/components/store";
export function generateStaticParams() {
  return ["explore", "saved", "cart", "inbox", "account", "wholesale"].map(
    (section) => ({ section }),
  );
}
export default async function Page({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (
    !["explore", "saved", "cart", "inbox", "account", "wholesale"].includes(
      section,
    )
  )
    notFound();
  return <Store section={section} />;
}
