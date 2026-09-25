"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importStudentsAction } from "@/app/actions/school-admin-actions";
import { importOfficeStudentsAction } from "@/app/actions/office-actions";
import { generateStudentCsvTemplate, validateStudentCsv } from "@/lib/csv";

export function StudentCsvImport({ role = "school_admin" }: { role?: "school_admin" | "office_staff" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const preview = content ? validateStudentCsv(content) : null;
  const template = () => {
    const blob = new Blob([generateStudentCsvTemplate()], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "klassa-student-template.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <section className="border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">Import students from CSV</h2><p className="mt-1 text-sm text-slate-600">Up to 1,000 students per file. Set up the current year, grades and classes first.</p></div><button type="button" className="min-h-11 border border-slate-300 px-4 text-sm font-semibold" onClick={template}>Download template</button></div>
    <label className="mt-4 block text-sm font-medium">CSV file<input type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm" onChange={async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (file.size > 2_000_000) { setMessage("Choose a CSV file smaller than 2 MB."); setContent(""); return; }
      setMessage("");
      setContent(await file.text());
    }} /></label>
    {preview && <div className="mt-4 space-y-2 text-sm"><p>{preview.validCount} valid rows · {preview.invalidCount} invalid rows</p>
      {preview.missingHeaders.length > 0 && <p className="text-red-700">Missing headers: {preview.missingHeaders.join(", ")}</p>}
      {preview.invalidRecords.slice(0, 10).map(row => <p key={row.row} className="text-red-700">Row {row.row}: {row.errors.map(error => `${error.field}: ${error.message}`).join("; ")}</p>)}
    </div>}
    {message && <p className="mt-3 text-sm" role="status">{message}</p>}
    <button type="button" className="mt-4 min-h-11 bg-blue-700 px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={pending || !preview?.isValid || preview.validCount > 1000} onClick={() => start(async () => {
      const result = await (role === "office_staff" ? importOfficeStudentsAction(content) : importStudentsAction(content));
      if (!result.success) { setMessage(result.error); return; }
      setMessage(`Imported ${result.count} students.`);
      setContent("");
      router.refresh();
    })}>{pending ? "Importing..." : "Import students"}</button>
  </section>;
}
