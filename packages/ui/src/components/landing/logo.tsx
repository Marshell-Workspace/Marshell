import { cn } from "@workspace/ui/lib/utils";
import type * as React from "react";

export interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  className?: string;
  theme?: "light" | "dark" | "auto";
}

export const Logo = ({
  className,
  alt = "Marshell logo",
  theme = "auto",
  ...props
}: LogoProps) => {
  if (theme === "light") {
    return (
      <img
        alt={alt}
        className={cn(
          "size-5.5 shrink-0 object-contain drop-shadow-xs",
          className
        )}
        src="/main_logo_light.png"
        {...props}
      />
    );
  }

  if (theme === "dark") {
    return (
      <img
        alt={alt}
        className={cn(
          "size-5.5 shrink-0 object-contain drop-shadow-xs",
          className
        )}
        src="/main_logo.png"
        {...props}
      />
    );
  }

  return (
    <>
      <img
        alt={alt}
        className={cn(
          "size-5.5 shrink-0 object-contain drop-shadow-xs marshell-logo-dark",
          className
        )}
        src="/main_logo.png"
        {...props}
      />
      <img
        alt={alt}
        className={cn(
          "size-5.5 shrink-0 object-contain drop-shadow-xs marshell-logo-light",
          className
        )}
        src="/main_logo_light.png"
        {...props}
      />
    </>
  );
};
