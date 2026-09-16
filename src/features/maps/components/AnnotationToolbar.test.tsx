import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AnnotationToolbar } from "./AnnotationToolbar";

function baseProps() {
  return {
    drawModeOn: false,
    onToggleDrawMode: vi.fn(),
    baseTool: "pen" as const,
    onSelectTool: vi.fn(),
    color: "#ff3b3b",
    onSelectColor: vi.fn(),
    width: 4,
    onChangeWidth: vi.fn(),
    onUndo: vi.fn(),
    onClear: vi.fn(),
    clearPending: false,
    persistDrawingsAcrossReload: false,
    onTogglePersistDrawingsAcrossReload: vi.fn(),
  };
}

describe("AnnotationToolbar", () => {
  it("only shows the Draw toggle when draw mode is off", () => {
    render(<AnnotationToolbar {...baseProps()} />);
    expect(screen.getByRole("button", { name: /draw/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pen" })).not.toBeInTheDocument();
  });

  it("clicking the Draw toggle calls onToggleDrawMode", async () => {
    const onToggleDrawMode = vi.fn();
    render(<AnnotationToolbar {...baseProps()} onToggleDrawMode={onToggleDrawMode} />);
    await userEvent.click(screen.getByRole("button", { name: /draw/i }));
    expect(onToggleDrawMode).toHaveBeenCalledOnce();
  });

  it("shows all 5 tool buttons, colors, width, undo, and clear once draw mode is on", () => {
    render(<AnnotationToolbar {...baseProps()} drawModeOn />);
    expect(screen.getByRole("button", { name: "Pen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Circle/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rectangle" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Eraser/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Select & move" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    expect(screen.getByRole("slider")).toHaveValue("4");
  });

  it("highlights the active base tool", () => {
    render(<AnnotationToolbar {...baseProps()} drawModeOn baseTool="circle" />);
    expect(screen.getByRole("button", { name: /Circle/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Pen" })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a tool button calls onSelectTool with that tool", async () => {
    const onSelectTool = vi.fn();
    render(<AnnotationToolbar {...baseProps()} drawModeOn onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole("button", { name: "Rectangle" }));
    expect(onSelectTool).toHaveBeenCalledWith("rect");
  });

  it("clicking the Select tool button calls onSelectTool with 'select'", async () => {
    const onSelectTool = vi.fn();
    render(<AnnotationToolbar {...baseProps()} drawModeOn onSelectTool={onSelectTool} />);
    await userEvent.click(screen.getByRole("button", { name: "Select & move" }));
    expect(onSelectTool).toHaveBeenCalledWith("select");
  });

  it("clicking a color preset calls onSelectColor with its hex value", async () => {
    const onSelectColor = vi.fn();
    render(<AnnotationToolbar {...baseProps()} drawModeOn onSelectColor={onSelectColor} />);
    await userEvent.click(screen.getByRole("button", { name: "Color #3b86ff" }));
    expect(onSelectColor).toHaveBeenCalledWith("#3b86ff");
  });

  it("has a distinct rainbow-ringed custom color input that isn't one of the 4 presets", () => {
    render(<AnnotationToolbar {...baseProps()} drawModeOn />);
    const customInput = screen.getByLabelText("Custom color");
    expect(customInput).toHaveAttribute("type", "color");
    // The 4 fixed presets are their own separately-labeled buttons; the
    // custom input is a 5th, distinctly-labeled control, not a coincidental
    // match against one of them.
    expect(screen.getAllByRole("button", { name: /^Color #/ })).toHaveLength(4);
  });

  it("changing the width slider calls onChangeWidth with a number", () => {
    const onChangeWidth = vi.fn();
    render(<AnnotationToolbar {...baseProps()} drawModeOn onChangeWidth={onChangeWidth} />);
    const slider = screen.getByRole("slider");
    slider.dispatchEvent(new Event("input", { bubbles: true }));
    Object.defineProperty(slider, "value", { value: "20", writable: true });
    slider.dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChangeWidth).toHaveBeenCalledWith(20);
  });

  it("Clear button reads 'Clear' normally and 'Restore' when a clear is pending", () => {
    const { rerender } = render(<AnnotationToolbar {...baseProps()} drawModeOn />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
    rerender(<AnnotationToolbar {...baseProps()} drawModeOn clearPending />);
    expect(screen.getByRole("button", { name: "Restore" })).toBeInTheDocument();
  });

  it("Advanced settings is collapsed by default and reveals the persist-drawings checkbox when expanded", async () => {
    render(<AnnotationToolbar {...baseProps()} drawModeOn />);
    expect(screen.queryByText("Save drawings after refresh")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Advanced settings" }));
    expect(screen.getByText("Save drawings after refresh")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("toggling the persist-drawings checkbox calls onTogglePersistDrawingsAcrossReload", async () => {
    const onToggle = vi.fn();
    render(
      <AnnotationToolbar
        {...baseProps()}
        drawModeOn
        onTogglePersistDrawingsAcrossReload={onToggle}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Advanced settings" }));
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("Undo/Clear buttons call their respective callbacks", async () => {
    const onUndo = vi.fn();
    const onClear = vi.fn();
    render(<AnnotationToolbar {...baseProps()} drawModeOn onUndo={onUndo} onClear={onClear} />);
    await userEvent.click(screen.getByRole("button", { name: "Undo" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onUndo).toHaveBeenCalledOnce();
    expect(onClear).toHaveBeenCalledOnce();
  });
});
