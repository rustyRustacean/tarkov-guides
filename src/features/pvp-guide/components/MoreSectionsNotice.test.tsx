import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { MoreSectionsNotice } from "./MoreSectionsNotice";

describe("MoreSectionsNotice", () => {
  it("is collapsed by default", () => {
    render(<MoreSectionsNotice />);
    expect(screen.getByRole("button", { name: /more pvp guide sections/i })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("opens on click and shows the coming-soon message", async () => {
    render(<MoreSectionsNotice />);
    await userEvent.click(screen.getByRole("button", { name: /more pvp guide sections/i }));

    expect(screen.getByRole("status")).toHaveTextContent("More sections coming soon");
    expect(screen.getByRole("button", { name: /more pvp guide sections/i })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("closes again on a second click", async () => {
    render(<MoreSectionsNotice />);
    const trigger = screen.getByRole("button", { name: /more pvp guide sections/i });
    await userEvent.click(trigger);
    await userEvent.click(trigger);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes on outside click", async () => {
    render(
      <>
        <MoreSectionsNotice />
        <button type="button">Outside</button>
      </>,
    );
    await userEvent.click(screen.getByRole("button", { name: /more pvp guide sections/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(<MoreSectionsNotice />);
    await userEvent.click(screen.getByRole("button", { name: /more pvp guide sections/i }));
    expect(screen.getByRole("status")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
