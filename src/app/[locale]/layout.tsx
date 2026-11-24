import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { routing } from "@workspace/i18n/routing";
import { setRequestLocale } from "@workspace/i18n/server";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const resolvedParams = await params;
  const locale = resolvedParams?.locale;

  // Validate that the incoming `locale` parameter is valid
  if (
    !(
      locale &&
      routing.locales.includes(locale as (typeof routing.locales)[number])
    )
  ) {
    notFound();
  }

  // Enable static rendering for next-intl server components & request config
  setRequestLocale(locale);

  // Get messages for the current locale (client-side loading for Tauri)
  const localeMessages =
    messages[locale as keyof typeof messages] ??
    messages[routing.defaultLocale];

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={localeMessages}
      timeZone="UTC"
    >
      {children}
    </NextIntlClientProvider>
  );
}
