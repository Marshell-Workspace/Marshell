"use client";

import { NotFoundPage } from "@workspace/core/pages/not-found-page";
import { routing } from "@workspace/i18n/routing";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function LocaleNotFound() {
  const params = useParams();
  const locale = (params?.locale as string) || routing.defaultLocale;
  const [redirecting, setRedirecting] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rawPath = window.location.pathname || "";
    if (rawPath.includes("/workspace")) {
      setRedirecting(false);
      return;
    }

    if (
      rawPath === `/${locale}` ||
      rawPath === `/${locale}/` ||
      rawPath === `/${locale}/index.html` ||
      rawPath === `/${locale}/index`
    ) {
      window.location.replace(`/${locale}/workspace`);
      return;
    }

    if (rawPath.endsWith(".html")) {
      window.location.replace(rawPath.slice(0, -5));
      return;
    }

    setRedirecting(false);
  }, [locale]);

  if (redirecting) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return <NotFoundPage />;
}
