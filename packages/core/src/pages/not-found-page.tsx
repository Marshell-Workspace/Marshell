"use client";

import { Button } from "@workspace/ui/components/button";
import { Card } from "@workspace/ui/components/card";
import { Home, LayoutGrid } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 text-foreground selection:bg-primary/30">
      <Card className="flex max-w-md w-full flex-col items-center border border-border/40 bg-card p-8 text-center shadow-2xl">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-border bg-muted/40 shadow-inner">
          <LayoutGrid className="size-8 text-muted-foreground animate-pulse" />
        </div>

        <h1 className="mt-6 font-display font-extrabold text-5xl tracking-tight text-foreground drop-shadow-sm">
          404
        </h1>

        <h2 className="mt-2 font-semibold text-lg tracking-tight text-foreground/90">
          Page Not Found
        </h2>

        <p className="mt-2 text-balance text-xs text-muted-foreground leading-relaxed">
          The requested page or route could not be found or has been moved.
        </p>

        <div className="mt-6 flex w-full items-center justify-center gap-3">
          <Button
            className="w-full sm:w-auto gap-2 rounded-xl text-xs font-semibold shadow-md backdrop-blur-md cursor-pointer"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.replace("/en/workspace");
              }
            }}
            size="sm"
            type="button"
          >
            <Home className="size-3.5" />
            <span>Go to Workspace</span>
          </Button>
        </div>
      </Card>
    </div>
  );
}
