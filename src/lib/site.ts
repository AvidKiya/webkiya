export const site = {
  name: "کیا",
  nameEn: "KIYA",
  tagline: "جزئیات کوچک، استایل تو",
  domain: "kiyaco24.ir",
  url: "https://kiyaco24.ir",
  instagram: "https://www.instagram.com/kiyaco24/",
  telegram: "https://t.me/kiyaco24",
  telegramBot: "https://t.me/kiyaco24bot",
  categories: [
    "کیف و کیف پول",
    "ساعت و زیورآلات",
    "اکسسوری شخصی",
    "دکوری و هدیه",
    "لباس زیر",
    "کفش و کمربند",
    "اکسسوری موبایل",
  ],
} as const;

export const infoPages = [
  { href: "/about", label: "دربارهٔ کیا", short: "درباره" },
  { href: "/faq", label: "سوالات متداول", short: "سوالات" },
  { href: "/shipping", label: "ارسال و مرجوعی", short: "ارسال" },
  { href: "/terms", label: "قوانین و شرایط", short: "قوانین" },
  { href: "/contact", label: "تماس با ما", short: "تماس" },
] as const;
