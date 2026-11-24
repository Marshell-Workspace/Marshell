"use client";

import { AuthProvider } from "@workspace/core/components/auth/auth-provider";
import { KanbanPage } from "@workspace/core/pages/kanban-page";
import { messages, NextIntlClientProvider } from "@workspace/i18n";
import { routing } from "@workspace/i18n/routing";
import { AppLayout } from "../[locale]/components/app-layout";

export default function KanbanRoutePage() {
  return (
    <NextIntlClientProvider
      locale={routing.defaultLocale}
      messages={messages[routing.defaultLocale]}
      timeZone="UTC"
    >
      <AuthProvider>
        <AppLayout>
          <KanbanPage />
        </AppLayout>
      </AuthProvider>
    </NextIntlClientProvider>
  );
}
