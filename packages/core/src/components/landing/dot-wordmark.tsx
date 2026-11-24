"use client";

import { useEffect, useRef } from "react";
import { createDotWordmark } from "./dot-wordmark-renderer";

export function DotWordmark() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const animation = createDotWordmark(canvas);
    return animation.destroy;
  }, []);

  return (
    <canvas
      aria-hidden="true"
      className="auth-login__dot-wordmark"
      data-dot-wordmark=""
      ref={canvasRef}
      tabIndex={-1}
    />
  );
}
