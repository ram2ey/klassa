import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Directory, type DirectoryRow } from "./directory";

afterEach(cleanup);
const rows: DirectoryRow[] = Array.from({ length: 12 }, (_, index) => ({ id: `row-${index}`, name: `Student ${index + 1}`, search: `Student ${index + 1} ST-${index + 1}`, filters: { status: index % 2 ? "pending" : "active" }, values: { name: index + 1 }, cells: { name: `Student ${index + 1}` } }));
const columns = [{ key: "name", label: "Student", sortable: true }];
const filters = [{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }] }];

describe("directory interactions", () => {
  it("resets pagination when searching or filtering and exports the filtered rows in sort order", () => {
    const exported = vi.fn();
    render(<Directory title="Students" resultLabel="students" rows={rows} columns={columns} filters={filters} onExport={exported} />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText("Page 2 of 2")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "pending" } });
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sort by Student" }));
    expect(screen.getByRole("columnheader").getAttribute("aria-sort")).toBe("descending");
    fireEvent.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(exported).toHaveBeenCalledWith(["row-11", "row-9", "row-7", "row-5", "row-3", "row-1"]);
    fireEvent.change(screen.getByLabelText("Search students"), { target: { value: "ST-12" } });
    expect(screen.getByText("Showing 1–1 of 1 students")).toBeTruthy();
    expect(screen.queryByText("Student 2")).toBeNull();
  });

  it("keeps selections across pages and reports partially selected pages", () => {
    function Harness() { const [selected, setSelected] = useState<string[]>([]); return <><Directory title="Students" resultLabel="students" rows={rows} columns={columns} selected={selected} onSelectionChange={setSelected} /><p>Selected: {selected.join(",")}</p></>; }
    render(<Harness />);
    fireEvent.click(screen.getByLabelText("Select Student 1"));
    expect(screen.getByLabelText("Select all visible students").getAttribute("aria-checked")).toBe("mixed");
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.click(screen.getByLabelText("Select all visible students"));
    expect(screen.getByText("Selected: row-0,row-10,row-11")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect((screen.getByLabelText("Select Student 1") as HTMLInputElement).checked).toBe(true);
  });

  it("distinguishes an empty directory from a filtered view and clears filters", () => {
    const { rerender } = render(<Directory title="Students" rows={[]} columns={columns} emptyTitle="No pupils enrolled" emptyAction={<button>Add first pupil</button>} />);
    expect(screen.getByRole("heading", { name: "No pupils enrolled" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Add first pupil" })).toBeTruthy();
    rerender(<Directory title="Students" rows={rows} columns={columns} />);
    fireEvent.change(screen.getByLabelText("Search records"), { target: { value: "no matching name" } });
    expect(screen.getByRole("heading", { name: "No records match this view" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(screen.getByText("Showing 1–10 of 12 records")).toBeTruthy();
  });

  it("resets the visible page when a controlled search changes outside the directory", () => {
    const { rerender } = render(<Directory title="Students" rows={rows} columns={columns} query="" />);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    rerender(<Directory title="Students" rows={rows} columns={columns} query="ST-1" />);
    expect(screen.getByText("Page 1 of 1")).toBeTruthy();
    expect(screen.getByText("Student 1")).toBeTruthy();
  });
});
