import KiyaStore from "@/components/kiya/store";
import { publicCatalog } from "@/server/catalog";
export const dynamic = "force-dynamic";
export const metadata = { title: "سبد سروری — کیا" };
export default async function Page() {
  return <KiyaStore section="basket" catalog={await publicCatalog()} />;
}
