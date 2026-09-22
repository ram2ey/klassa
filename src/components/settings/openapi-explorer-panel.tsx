"use client";

import { useState } from "react";
import {
  Code, Copy, Check, Play,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function OpenApiExplorerPanel() {
  const [copied, setCopied] = useState(false);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);

  const handleCopySpec = async () => {
    try {
      const res = await fetch("/api/openapi");
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleTestHealth = async () => {
    setIsLoadingHealth(true);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (err) {
      setTestResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setIsLoadingHealth(false);
    }
  };

  const endpoints = [
    { method: "GET", path: "/api/health", desc: "Operational diagnostics, memory telemetry & cipher health", auth: "Public" },
    { method: "GET", path: "/api/openapi", desc: "OpenAPI 3.1.0 formal contract in JSON format", auth: "Public" },
    { method: "GET", path: "/api/v1/students", desc: "Student directory with grade & status filters", auth: "Staff Session" },
    { method: "POST", path: "/api/v1/attendance/roll-call", desc: "Daily roll-call entry with discrepancy reasons", auth: "Teacher / Staff" },
    { method: "GET", path: "/api/v1/sensitive/cases", desc: "Confidential case registry (Safeguarding firewall)", auth: "Safeguarding / Nurse / SENCO" },
    { method: "GET", path: "/api/v1/gdpr/export/{studentId}", desc: "Article 20 data portability JSON export", auth: "Guardian / Admin" },
    { method: "POST", path: "/api/v1/communications/emergency", desc: "Four-Eyes executive safety broadcast", auth: "Two Distinct Admins" },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex items-start justify-between rounded-xs border border-slate-300 bg-white p-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Code size={20} className="text-blue-700" weight="bold" />
            <h2 className="text-base font-bold text-slate-900">
              OpenAPI 3.1 Specification & Institutional API Reference
            </h2>
            <span className="rounded-xs border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              OPENAPI 3.1.0
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Standardized machine-readable contracts for student directory, attendance roll-calls, assessments, communications, sensitive records, and GDPR data subject rights.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopySpec}
            className="gap-1.5 text-xs"
          >
            {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
            {copied ? "Copied Spec!" : "Copy OpenAPI JSON"}
          </Button>

          <Button
            size="sm"
            onClick={handleTestHealth}
            disabled={isLoadingHealth}
            className="gap-1.5 text-xs"
          >
            <Play size={14} weight="bold" />
            {isLoadingHealth ? "Pinging..." : "Ping /api/health"}
          </Button>
        </div>
      </div>

      {/* Live Health Check Console (if tested) */}
      {testResponse && (
        <section className="border border-slate-200 bg-white p-4 space-y-2 rounded-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase">
            <span>Live Response from /api/health</span>
            <span className="font-mono text-emerald-700">HTTP 200 OK</span>
          </div>
          <pre className="max-h-60 overflow-y-auto border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-200 rounded-xs">
            {testResponse}
          </pre>
        </section>
      )}

      {/* Endpoint Listing Table */}
      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">
          Documented OpenAPI 3.1 Endpoints ({endpoints.length})
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
              <th className="px-4 py-2.5">Method</th>
              <th className="px-4 py-2.5">Path</th>
              <th className="px-4 py-2.5">Description</th>
              <th className="px-4 py-2.5">Security / Auth Level</th>
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.path} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 font-bold font-mono text-[10px] border ${
                    ep.method === "GET"
                      ? "bg-blue-50 text-blue-800 border-blue-200"
                      : "bg-emerald-50 text-emerald-800 border-emerald-200"
                  }`}>
                    {ep.method}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-900">{ep.path}</td>
                <td className="px-4 py-3 text-slate-600">{ep.desc}</td>
                <td className="px-4 py-3 font-mono text-[11px] text-slate-700">
                  <Badge tone={ep.auth === "Public" ? "slate" : "blue"}>{ep.auth}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
