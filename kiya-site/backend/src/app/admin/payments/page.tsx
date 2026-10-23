import { IntegrationSettings } from "@/components/admin/integration-settings";
export const metadata = {
  title: "بررسی رسیدها | کیا",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <IntegrationSettings financeOnly />;
}
