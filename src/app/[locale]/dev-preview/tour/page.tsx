import { TourPrimitivesPreview } from "@workspace/core/components/common/tour/ui";
import { notFound } from "next/navigation";

/** Local visual review only for Mission Control HUD tour primitives. */
export default async function TourDevelopmentPreviewPage(props: {
  searchParams: Promise<{
    screen?: string;
    tier?: "performance" | "balanced" | "eco";
  }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  const searchParams = await props.searchParams;
  return (
    <TourPrimitivesPreview
      initialScreen={searchParams.screen}
      initialTier={searchParams.tier}
    />
  );
}
