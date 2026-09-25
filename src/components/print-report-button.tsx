"use client";

export function PrintReportButton() {
  return <button type="button" className="min-h-11 bg-blue-700 px-4 text-sm font-semibold text-white" onClick={() => window.print()}>Print or save PDF</button>;
}
