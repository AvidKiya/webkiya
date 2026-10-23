import { useEffect, useState } from "react";
type Item = {
  id: string;
  name: string;
  description: string;
  image: string;
  price: string;
  isDemo?: boolean;
};
export function ServerCatalog() {
  const [items, setItems] = useState<Item[]>([]),
    [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", {
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.ok || !Array.isArray(result.data?.items))
          throw new Error("catalog");
        setItems(result.data.items);
        setState("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, []);
  return (
    <section
      aria-label="کاتالوگ متصل به دیتابیس"
      className="max-w-[960px] mx-auto space-y-4 px-3"
    >
      <div className="bg-surface border border-border rounded-2xl p-5">
        <h1 className="font-black text-lg">کاتالوگ متصل به دیتابیس</h1>
        <p className="text-sm text-ink-500 mt-2">
          این داده‌ها از API بک‌اند مستقل می‌آیند، نه StoreContext قالب. پرداخت
          و خرید از این صفحه هنوز فعال نیست. قیمت عمده در این API عمومی وجود
          ندارد.
        </p>
      </div>
      {state === "loading" && <p role="status">در حال دریافت از سرور…</p>}
      {state === "error" && (
        <p role="alert">
          ارتباط با سرور برقرار نشد. سرویس backend باید روشن باشد؛ دادهٔ نمونه
          جای نتیجهٔ خطا گذاشته نمی‌شود.
        </p>
      )}
      {state === "ready" && items.length === 0 && (
        <p role="status">هنوز کالای منتشرشده‌ای وجود ندارد.</p>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="bg-surface border border-border rounded-2xl overflow-hidden"
          >
            <img
              src={item.image}
              alt={item.name}
              className="w-full aspect-square object-cover"
            />
            <div className="p-4 space-y-3">
              <h2 className="font-bold">{item.name}</h2>
              {item.isDemo && (
                <span className="text-xs text-warning">
                  نمونهٔ آزمایشی دیتابیس
                </span>
              )}
              <p className="text-sm text-ink-500">{item.description}</p>
              <p className="font-black">{item.price} تومان</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
