import { messages } from "@workspace/i18n";
import { routing } from "@workspace/i18n/routing";
import { getRequestConfig } from "@workspace/i18n/server";

export default getRequestConfig(async (params) => {
  let locale: string = routing.defaultLocale;
  try {
    if (params?.requestLocale) {
      const requested = await Promise.race([
        params.requestLocale,
        new Promise<string | undefined>((resolve) =>
          setTimeout(() => resolve(undefined), 50)
        ),
      ]);
      if (
        requested &&
        routing.locales.includes(requested as (typeof routing.locales)[number])
      ) {
        locale = requested;
      }
    }
  } catch {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages:
      messages[locale as keyof typeof messages] ??
      messages[routing.defaultLocale] ??
      {},
  };
});
