import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ClerkProvider } from "./clerk-provider";

describe("ClerkProvider", () => {
  it("renders children directly in open-source build", () => {
    const html = renderToStaticMarkup(
      <ClerkProvider>
        <div>app shell</div>
      </ClerkProvider>
    );

    expect(html).toContain("app shell");
  });
});
