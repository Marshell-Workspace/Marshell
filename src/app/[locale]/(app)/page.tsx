"use client";

import { useRouter } from "@workspace/i18n/navigation";
import { useParams } from "next/navigation";
import { useEffect } from "react";

export default function RootRedirect() {
  const router = useRouter();
  const params = useParams();
  const locale = (params?.locale as string) || "en";

  useEffect(() => {
    router.replace("/workspace");
  }, [router]);

  return (
    <>
      <noscript>
        <meta content={`0;url=/${locale}/workspace`} httpEquiv="refresh" />
      </noscript>
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    </>
  );
}
