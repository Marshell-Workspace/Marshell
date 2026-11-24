"use client";

import { usePanelStore } from "@workspace/core/stores/panel-store";
import { useTutorialStore } from "@workspace/core/stores/tutorial-store";
import { Button } from "@workspace/ui/components/button";
import { BookOpen, Compass, Settings2 } from "lucide-react";

export function TutorialsSettingsTab() {
  const handleAppTour = () => {
    usePanelStore.getState().closeSettings();
    useTutorialStore.getState().replayTour("onboarding");
  };

  const handleSettingsTour = () => {
    useTutorialStore.getState().replayTour("settings");
  };

  return (
    <div
      className="w-full space-y-6 text-foreground"
      data-tour="settings-tutorials-section"
    >
      <div>
        <h2 className="font-semibold text-xl tracking-tight flex items-center gap-2">
          <BookOpen className="size-5 text-muted-foreground" />
          <span>Tutorials</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          Replay interactive walkthroughs anytime to explore application
          features and workspace tools.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* biome-ignore lint/a11y/useSemanticElements: interactive card container wraps its own action button */}
        <div
          className="flex flex-col justify-between p-4 rounded-xl border border-border/80 bg-card/60 gap-3 cursor-pointer hover:border-primary/50 hover:bg-card/90 active:scale-[0.99] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-tour-action="replay-onboarding"
          onClick={handleAppTour}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleAppTour();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-foreground font-medium text-xs group-hover:text-primary transition-colors">
              <Compass className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>App Tour</span>
            </div>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Replay first-run onboarding, workspace setup, and environment
              tours.
            </p>
          </div>
          <Button
            className="w-full text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleAppTour();
            }}
            size="sm"
            variant="outline"
          >
            Replay app tour
          </Button>
        </div>

        {/* biome-ignore lint/a11y/useSemanticElements: interactive card container wraps its own action button */}
        <div
          className="flex flex-col justify-between p-4 rounded-xl border border-border/80 bg-card/60 gap-3 cursor-pointer hover:border-primary/50 hover:bg-card/90 active:scale-[0.99] transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-tour-action="replay-settings"
          onClick={handleSettingsTour}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleSettingsTour();
            }
          }}
          role="button"
          tabIndex={0}
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-foreground font-medium text-xs group-hover:text-primary transition-colors">
              <Settings2 className="size-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Settings Tour</span>
            </div>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Explore appearance, workspaces, notifications, and performance
              preferences.
            </p>
          </div>
          <Button
            className="w-full text-xs h-8 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleSettingsTour();
            }}
            size="sm"
            variant="outline"
          >
            Replay Settings tour
          </Button>
        </div>
      </div>
    </div>
  );
}
