import React from "react";

import RootLayout from "@/app/layout";

vi.mock("next/font/google", () => ({
  Literata: () => ({ variable: "__body" }),
  Space_Grotesk: () => ({ variable: "__display" })
}));

describe("RootLayout", () => {
  it("suppresses hydration warnings on the html root", () => {
    const tree = RootLayout({
      children: <div>child</div>
    }) as React.ReactElement;

    expect(tree.type).toBe("html");
    expect(tree.props.suppressHydrationWarning).toBe(true);
  });
});
