import createMiddleware from "@workspace/i18n/middleware";
import { routing } from "@workspace/i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Match all pathnames except for _next, api, static files, favicon, etc.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
