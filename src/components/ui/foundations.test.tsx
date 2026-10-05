import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "./tabs";
import { Field, Input } from "./field";
import { Button } from "./button";

afterEach(cleanup);

describe("design foundations", () => {
  it("links the visible field label, hint and validation error to its input", () => {
    render(<Field label="Guardian phone" hint="Include the country code." error="Enter a valid number."><Input required /></Field>);
    const control = screen.getByRole("textbox", { name: "Guardian phone" });
    expect(control.getAttribute("aria-invalid")).toBe("true");
    const described = control.getAttribute("aria-describedby")!.split(" ").map(id => document.getElementById(id)?.textContent);
    expect(described).toEqual(["Include the country code.", "Enter a valid number."]);
  });

  it("moves tab selection and focus with arrows and Home/End, exposing only the selected panel", () => {
    render(<Tabs label="Pupil status" items={[{ value: "all", label: "All", content: "All records" }, { value: "active", label: "Active", content: "Active records" }, { value: "pending", label: "Pending", content: "Pending records" }]} />);
    const all = screen.getByRole("tab", { name: "All" });
    fireEvent.keyDown(all, { key: "ArrowLeft" });
    const pending = screen.getByRole("tab", { name: "Pending" });
    expect(document.activeElement).toBe(pending);
    expect(screen.getByRole("tabpanel").textContent).toBe("Pending records");
    fireEvent.keyDown(pending, { key: "Home" });
    expect(document.activeElement).toBe(all);
    fireEvent.keyDown(all, { key: "End" });
    expect(document.activeElement).toBe(pending);
    fireEvent.click(screen.getByRole("tab", { name: "Active" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("Active records");
  });

  it("blocks repeat clicks while an action is loading and keeps its accessible name", () => {
    render(<Button loading>Save pupil</Button>);
    const button = screen.getByRole("button", { name: "Save pupil" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
