import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { idbDelImage, idbGetImage, idbPutImage } from "../persistence/custom-map-idb";
import { useMapsStore } from "../store";

import { AddCustomMapDialog } from "./AddCustomMapDialog";

vi.mock("../persistence/custom-map-idb", () => ({
  idbGetImage: vi.fn(),
  idbPutImage: vi.fn(),
  idbDelImage: vi.fn(),
}));

const initialMapsState = useMapsStore.getInitialState();

beforeEach(() => {
  useMapsStore.setState(initialMapsState, true);
  vi.mocked(idbPutImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbDelImage).mockReset().mockResolvedValue(undefined);
  vi.mocked(idbGetImage).mockReset().mockResolvedValue(undefined);
});

function makeImageFile(): File {
  return new File(["fake-image-bytes"], "map.png", { type: "image/png" });
}

describe("AddCustomMapDialog", () => {
  it("Add Map is disabled until both a name and a file are provided", async () => {
    const user = userEvent.setup();
    render(<AddCustomMapDialog open={true} onOpenChange={vi.fn()} normalizedName="reserve" />);

    expect(screen.getByRole("button", { name: "Add Map" })).toBeDisabled();

    await user.type(screen.getByLabelText("Variant name"), "My callouts");
    expect(screen.getByRole("button", { name: "Add Map" })).toBeDisabled();

    await user.upload(screen.getByLabelText("Image file"), makeImageFile());
    expect(screen.getByRole("button", { name: "Add Map" })).toBeEnabled();
  });

  it("submitting adds the variant, closes the dialog, and resets the form", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<AddCustomMapDialog open={true} onOpenChange={onOpenChange} normalizedName="reserve" />);

    await user.type(screen.getByLabelText("Variant name"), "My callouts");
    await user.upload(screen.getByLabelText("Image file"), makeImageFile());
    await user.click(screen.getByRole("button", { name: "Add Map" }));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(useMapsStore.getState().customMaps.reserve).toHaveLength(1);
    expect(useMapsStore.getState().customMaps.reserve?.[0]?.label).toBe("My callouts");
  });
});
