export const STORE_SECTIONS = [
  "explore",
  "profile",
  "saved",
  "cart",
  "inbox",
  "account",
  "wholesale",
] as const;
// Pages that live outside the store shell and must stay reachable at one segment.
export const INFO_ROUTES = [
  "about",
  "faq",
  "shipping",
  "terms",
  "contact",
] as const;
export const TOP_LEVEL_ROUTES = [
  "admin",
  "progress",
  "basket",
  ...INFO_ROUTES,
] as const;
