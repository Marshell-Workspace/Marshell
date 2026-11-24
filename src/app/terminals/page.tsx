"use client";

import { AuthProvider } from "@workspace/core/components/auth/auth-provider";
import { WorkspacePage } from "@workspace/core/pages/workspace-page";
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { routing } from "@workspace/i18n/routing";
import { AppLayout } from "../[locale]/components/app-layout";

export default function TerminalsRoutePage() {
  return (
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={messages[routing.defaultLocale]}
      timeZone="UTC"
    >
      <AuthProvider>
        <AppLayout>
          <WorkspacePage />
        </AppLayout>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
