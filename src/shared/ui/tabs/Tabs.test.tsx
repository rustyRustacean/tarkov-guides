import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "./Tabs";

function renderTabs() {
  return render(
    <Tabs defaultValue="one">
      <TabsList>
        <TabsTrigger value="one">One</TabsTrigger>
        <TabsTrigger value="two">Two</TabsTrigger>
      </TabsList>
      <TabsContent value="one">First panel</TabsContent>
      <TabsContent value="two">Second panel</TabsContent>
    </Tabs>,
  );
}

describe("Tabs", () => {
  it("shows the default tab's panel", () => {
    renderTabs();
    expect(screen.getByText("First panel")).toBeVisible();
  });

  it("switches panels on click and via arrow-key navigation", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("tab", { name: "Two" }));
    expect(screen.getByText("Second panel")).toBeVisible();

    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "One" })).toHaveAttribute("aria-selected", "true");
  });
});
