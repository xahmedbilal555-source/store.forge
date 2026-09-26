export type Lang = "en" | "ur";

export const text = {
  en: {
    navHome: "Home",
    navPricing: "Pricing",
    navStores: "Stores",
    navContact: "Contact",
    ctaTrial: "Start Free Trial",
    headline: "Open Your Store – Start Selling Today",
    subheadline: "Launch your online business with our all‑in‑one platform.",
  },
  ur: {
    navHome: "ہوم",
    navPricing: "قیمت",
    navStores: "اسٹورز",
    navContact: "رابطہ",
    ctaTrial: "فری ٹرائل شروع کریں",
    headline: "اپنا اسٹور کھولیں – آج ہی فروخت شروع کریں",
    subheadline: "ہمارے آل اِن ون پلیٹ فارم کے ساتھ اپنا آن لائن کاروبار شروع کریں۔",
  },
} as const;

export function getLang(value: string | undefined): Lang {
  return value === "ur" ? "ur" : "en";
}
