import { OrderFulfillment } from "@/components/admin/order-fulfillment";
export const metadata = {
  title: "پردازش و ارسال سفارش | کیا",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <OrderFulfillment />;
}
