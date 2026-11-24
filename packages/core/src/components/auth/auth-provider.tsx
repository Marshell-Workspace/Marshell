"use client";

import { AuthLoginPage } from "@workspace/core/components/auth/auth-login-page";
import { useAuthStore } from "@workspace/core/stores/auth-store";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { session, isLoaded, initAuth } = useAuthStore();

  useEffect(() => {
    initAuth();

    const handleFocus = async () => {
      await initAuth();
    };

    if (typeof window !== "undefined") {
      window.addEventListener("focus", handleFocus);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("focus", handleFocus);
      }
    };
  }, [initAuth]);

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen flex-1 items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <AuthLoginPage />;
  }

  return <>{children}</>;
}
