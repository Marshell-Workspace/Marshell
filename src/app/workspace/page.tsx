"use client";

import { routing } from "@workspace/i18n/routing";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WorkspaceRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/${routing.defaultLocale}/workspace`);
  }, [router]);

  return (
    <>
      <noscript>
        <meta
          content={`0;url=/${routing.defaultLocale}/workspace`}
          httpEquiv="refresh"
        />
      </noscript>
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </>
  );
}
