export type Product = {
  id: string;
  name: string;
  subtitle: string;
  category: string;
  image: string;
  price: string;
  previous?: string;
  description: string;
  colors: { name: string; hex: string }[];
  packSize: number;
  tag: string;
  collection: string;
};
export const products: Product[] = [
  {
    id: "everyday-bag",
    name: "کیف چرمی، همراه هر روزت",
    subtitle: "کیف دستی و دوشی چرم",
    category: "کیف و کیف پول",
    image: "/images/bag.webp",
    price: "1450000",
    previous: "1850000",
    tag: "انتخاب کیا",
    collection: "جزئیاتِ ماندگار",
    packSize: 6,
    description:
      "بعضی چیزها با گذشت زمان، زیباتر می‌شوند. این کیف با بافت گرم و جزئیات مینیمال، برای روزهای شلوغ و سفرهای کوتاه طراحی شده؛ همان همراهی که با هر استایلی جور می‌شود. فضای داخلی جادار، بند قابل تنظیم و جیب مجزا برای وسایل کوچک دارد. مشخصات، جنس و قیمت این محصول برای پیش‌نمایش هستند و قبل از فروش واقعی باید تأیید شوند.",
    colors: [
      { name: "قهوه‌ای", hex: "#845c3a" },
      { name: "مشکی", hex: "#292729" },
      { name: "عسلی", hex: "#c79863" },
    ],
  },
  {
    id: "minimal-watch",
    name: "زمان، به سبک مینیمال",
    subtitle: "ساعت مچی با بند چرمی",
    category: "ساعت و زیورآلات",
    image: "/images/watch.webp",
    price: "2290000",
    tag: "مینیمال و همیشگی",
    collection: "کمتر، اما بهتر",
    packSize: 12,
    description:
      "یک صفحهٔ ساده، یک بند خوش‌رنگ و جزئیاتی که هیچ‌وقت از مد نمی‌افتند. برای قرارهای روزمره و لحظه‌های خاص؛ انتخابی که قرار نیست از دستت باز شود. اطلاعات فنی و قیمت در این نسخه نمونه‌اند.",
    colors: [
      { name: "مشکی", hex: "#262627" },
      { name: "قهوه‌ای", hex: "#7f5036" },
    ],
  },
  {
    id: "leather-wallet",
    name: "کوچک، اما پر از جزئیات",
    subtitle: "کیف پول و جاکلیدی ست",
    category: "کیف و کیف پول",
    image: "/images/wallet.webp",
    price: "380000",
    tag: "برای هدیه",
    collection: "هدیه‌های کوچک",
    packSize: 6,
    description:
      "یک جای مرتب برای چیزهای کوچک و مهم. ست کیف پول و جاکلیدی با طراحی ساده؛ برای خودت یا کسی که دوستش داری. رنگ و مشخصات در پیش‌نمایش نمونه هستند.",
    colors: [
      { name: "سبز", hex: "#355c49" },
      { name: "مشکی", hex: "#232323" },
    ],
  },
  {
    id: "daily-glasses",
    name: "دنیا رو از قاب تازه ببین",
    subtitle: "عینک آفتابی فریم کلاسیک",
    category: "اکسسوری شخصی",
    image: "/images/glasses.webp",
    price: "640000",
    tag: "استایل روزمره",
    collection: "آفتابِ پاییزی",
    packSize: 12,
    description:
      "یک قاب کلاسیک برای یک روز متفاوت. فرم ساده و رنگ خنثی، به‌راحتی با استایل روزمره همراه می‌شود. دربارهٔ ویژگی‌های محافظتی، تا پیش از تأیید تأمین‌کننده هیچ ادعایی نداریم.",
    colors: [
      { name: "مشکی", hex: "#292729" },
      { name: "عسلی", hex: "#b37d48" },
    ],
  },
  {
    id: "little-light",
    name: "یک گوشهٔ گرم برای خودت",
    subtitle: "چراغ دکوری کوچک",
    category: "دکوری و هدیه",
    image: "/images/lamp.webp",
    price: "1150000",
    tag: "حال خوبِ کوچک",
    collection: "گوشهٔ دنج",
    packSize: 6,
    description:
      "یک جزئیات کوچک می‌تواند حال‌وهوای گوشهٔ موردعلاقه‌ات را عوض کند. این محصول صرفاً نمونهٔ تصویری برای بررسی طراحی کاتالوگ است.",
    colors: [{ name: "کرم", hex: "#e0c8a8" }],
  },
];
export const categories = [
  "همه",
  "کیف و کیف پول",
  "ساعت و زیورآلات",
  "اکسسوری شخصی",
  "دکوری و هدیه",
  "لباس زیر",
  "کفش و کمربند",
  "اکسسوری موبایل",
];
export const faNumber = (n: number | string) =>
  new Intl.NumberFormat("fa-IR").format(Number(n));
export const money = (price: string) => faNumber(price);
export type CartItem = { productId: string; color: string; qty: number };
export function cartTotal(items: CartItem[]): string {
  return items
    .reduce((sum, item) => {
      const product = products.find((p) => p.id === item.productId);
      return sum + (product ? BigInt(product.price) * BigInt(item.qty) : 0n);
    }, 0n)
    .toString();
}
export function validCart(value: unknown): CartItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (v): v is CartItem =>
        typeof v === "object" &&
        v !== null &&
        typeof v.productId === "string" &&
        products.some((p) => p.id === v.productId) &&
        Number.isInteger(v.qty) &&
        v.qty > 0 &&
        v.qty <= 20 &&
        typeof v.color === "string" &&
        products.some(
          (p) =>
            p.id === v.productId && p.colors.some((c) => c.name === v.color),
        ),
    )
    .slice(0, 30);
}
