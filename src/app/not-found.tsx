"use client";

import { NotFoundPage } from "@workspace/core/pages/not-found-page";
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { routing } from "@workspace/i18n/routing";
import { useEffect, useState } from "react";

export default function RootNotFound() {
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawPathname = window.location.pathname || "/";
    const cleanPath =
      rawPathname.length > 1 && rawPathname.endsWith("/")
        ? rawPathname.slice(0, -1)
        : rawPathname;

    if (cleanPath.includes("/workspace")) {
      setRedirecting(false);
      return;
    }

    // Check if path is root or index
    if (
      cleanPath === "/" ||
      cleanPath === "/index.html" ||
      cleanPath === "/index" ||
      cleanPath === ""
    ) {
      window.location.replace(`/${routing.defaultLocale}/workspace`);
      return;
    }

    // Check if the current pathname starts with one of the configured locales
    const matchedLocale = routing.locales.find(
      (loc) => cleanPath === `/${loc}` || cleanPath.startsWith(`/${loc}/`)
    );

    if (matchedLocale) {
      const subPath = cleanPath.slice(matchedLocale.length + 1);
      if (
        subPath === "" ||
        subPath === "/" ||
        subPath === "/index.html" ||
        subPath === "/index"
      ) {
        window.location.replace(`/${matchedLocale}/workspace`);
        return;
      }
      if (subPath.endsWith(".html")) {
        window.location.replace(`/${matchedLocale}${subPath.slice(0, -5)}`);
        return;
      }
      setRedirecting(false);
      return;
    }

    // Direct navigation to an un-prefixed route (e.g. /workspace, /settings, /dashboard)
    const strippedPath = cleanPath.endsWith(".html")
      ? cleanPath.slice(0, -5)
      : cleanPath;
    window.location.replace(`/${routing.defaultLocale}${strippedPath}`);
  }, []);

  if (redirecting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={messages[routing.defaultLocale]}
      timeZone="UTC"
    >
      <NotFoundPage />
    </NextIntlClientProvider>
  );
}
