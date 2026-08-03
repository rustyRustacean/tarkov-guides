import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import { useSiteStatusBannerStore } from "./site-status-banner-store";
import { SiteStatusBanner } from "./SiteStatusBanner";

const STORAGE_KEY = "tarkovguides.site-status-banner.dismissed.v1";

beforeEach(() => {
  localStorage.clear();
  useSiteStatusBannerStore.setState({ dismissed: false });
});

describe("SiteStatusBanner", () => {
  it("shows the development notice by default", () => {
    render(<SiteStatusBanner />);
    expect(screen.getByRole("status")).toHaveTextContent("under active development");
  });

  it("dismissing hides the banner and persists the choice", async () => {
    const user = userEvent.setup();
    render(<SiteStatusBanner />);

    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("stays dismissed across a remount once persisted", () => {
    localStorage.setItem(STORAGE_KEY, "1");
    render(<SiteStatusBanner />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows again when nothing has ever been stored", () => {
    render(<SiteStatusBanner />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
