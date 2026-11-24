"use client";

import { Panel } from "@workspace/core/components/panel/panel";
import { AccountPanel } from "@workspace/core/components/panels/account-panel";
import { usePanelStore } from "@workspace/core/stores/panel-store";

export function PanelManager() {
  const { activePanel, closePanel } = usePanelStore();

  const getPanelConfig = () => {
    switch (activePanel) {
      case "account":
        return {
          title: "Account Settings",
          content: <AccountPanel />,
          maxWidthClass: "max-w-3xl",
        };
      default:
        return {
          title: "",
          content: null,
          maxWidthClass: "max-w-4xl",
        };
    }
  };

  if (!activePanel || activePanel === "settings") {
    return null;
  }

  const { title, content, maxWidthClass } = getPanelConfig();

  return (
    <Panel
      isOpen={activePanel !== null}
      maxWidthClass={maxWidthClass}
      onClose={closePanel}
      title={title}
    >
      {content}
    </Panel>
  );
}
