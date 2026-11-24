"use client";

import { ParallelExecutionLoom } from "@workspace/core/components/landing/parallel-execution-loom";
import { KeychainAccessCard } from "@workspace/core/components/settings/keychain-access-card";
import {
  openDesktopSignIn,
  useAuthStore,
} from "@workspace/core/stores/auth-store";
import { useTranslations } from "@workspace/i18n";
import { ExternalLink, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface AuthLoginPageProps {
  initialMode?: string;
}

export function AuthLoginPage(_props: AuthLoginPageProps) {
  const t = useTranslations("AuthLogin");
  const { authError } = useAuthStore();
  const [connecting, setConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleWebPortalSignIn = async () => {
    setConnecting(true);
    setErrorMessage(null);
    useAuthStore.setState({ authError: null });

    try {
      await openDesktopSignIn();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : t("signInError"));
    } finally {
      setTimeout(() => setConnecting(false), 2500);
    }
  };

  const activeError = errorMessage || authError;

  return (
    <div className="auth-login">
      <section aria-label={t("panelLabel")} className="auth-login__panel">
        <header className="auth-login__brand">
          <Image
            alt=""
            height={42}
            priority
            src="/main_logo_256.webp"
            width={42}
          />
          <span>Marshell</span>
        </header>
        <main className="auth-login__main">
          <div className="auth-login__intro">
            <h1 className="auth-login__title">
              {t("title")} <br />
              <span className="auth-login__name">Marshell</span>
            </h1>
            <p className="auth-login__description">{t("description")}</p>
          </div>

          <div className="auth-login__actions">
            {activeError && (
              <div className="auth-login__error" role="alert">
                {activeError}
                <KeychainAccessCard
                  onReset={() => {
                    setErrorMessage(null);
                    useAuthStore.setState({ authError: null });
                  }}
                />
              </div>
            )}
            <button
              aria-busy={connecting}
              aria-describedby="portal-hint"
              className="auth-login__submit"
              disabled={connecting}
              onClick={handleWebPortalSignIn}
              type="button"
            >
              <span>{connecting ? t("opening") : t("signIn")}</span>
              {connecting ? (
                <Loader2
                  aria-hidden="true"
                  className="size-4 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <ExternalLink aria-hidden="true" className="size-4" />
              )}
            </button>
            <p aria-live="polite" className="auth-login__hint" id="portal-hint">
              {connecting ? t("returnHint") : t("browserHint")}
            </p>
          </div>
        </main>
      </section>
      <div aria-hidden="true" className="auth-login__art">
        <ParallelExecutionLoom />
      </div>
    </div>
  );
}
