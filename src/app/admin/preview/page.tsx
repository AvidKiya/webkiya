import { AdminPanel } from "@/components/admin/panel";
export const metadata = {
  title: "نمایش مدیریت کیا | فقط خواندنی",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <AdminPanel preview />;
}
