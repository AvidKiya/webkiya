import Store from "@/components/kiya/store";
import { publicCatalog } from "@/server/catalog";
export const dynamic = "force-dynamic";
export default async function Page() {
  return <Store section="home" catalog={await publicCatalog()} />;
}
