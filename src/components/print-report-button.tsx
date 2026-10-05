"use client";

export function PrintReportButton() {
  return <button type="button" className="min-h-11 bg-primary px-4 text-sm font-semibold text-white" onClick={() => window.print()}>Print or save PDF</button>;
}
