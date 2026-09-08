import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  alt?: string;
  className?: string;
  priority?: boolean;
  size?: number;
}

export const Logo = ({
  alt = "Hyperion",
  className,
  size = 32,
  priority = false,
}: LogoProps) => (
  <Image
    alt={alt}
    className={cn("shrink-0 object-contain", className)}
    height={size}
    priority={priority}
    src="/main_logo.png"
    width={size}
  />
);
