import { defineRouting } from "next-intl/routing";

export const localeConfig = {
  en: { flag: "🇬🇧", label: "English", nativeName: "English" },
  de: { flag: "🇩🇪", label: "German", nativeName: "Deutsch" },
  es: { flag: "🇪🇸", label: "Spanish", nativeName: "Español" },
  fr: { flag: "🇫🇷", label: "French", nativeName: "Français" },
  it: { flag: "🇮🇹", label: "Italian", nativeName: "Italiano" },
  ja: { flag: "🇯🇵", label: "Japanese", nativeName: "日本語" },
  pt: { flag: "🇵🇹", label: "Portuguese", nativeName: "Português" },
  ru: { flag: "🇷🇺", label: "Russian", nativeName: "Русский" },
  tr: { flag: "🇹🇷", label: "Turkish", nativeName: "Türkçe" },
  zh: { flag: "🇨🇳", label: "Chinese", nativeName: "中文" },
} as const;

export const locales = Object.keys(localeConfig) as Array<
  keyof typeof localeConfig
>;

export const routing = defineRouting({
  locales,
  defaultLocale: "en",
});
