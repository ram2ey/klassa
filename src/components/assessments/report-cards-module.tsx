"use client";

import { useState } from "react";
import {
  ArrowsClockwise,
  FileText,
  MagnifyingGlass,
  SealCheck,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OfficialReportCardData } from "@/lib/assessments";

interface ReportCardsModuleProps {
  reportCards: OfficialReportCardData[];
  classes: Array<{ id: string; name: string }>;
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  onViewReportCard: (rc: OfficialReportCardData) => void;
  onPublishReportCard: (reportCardId: string) => Promise<void>;
  onGenerateBatch: (termId: string, classId: string) => Promise<void>;
}

export function ReportCardsModule({
  reportCards,
  classes,
  selectedClassId,
  setSelectedClassId,
  onViewReportCard,
  onPublishReportCard,
  onGenerateBatch,
}: ReportCardsModuleProps) {
  const [termFilter] = useState("Term 1 (Fall)");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [generating, setGenerating] = useState(false);

  const filteredCards = reportCards.filter((rc) => {
    const matchesSearch =
      rc.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rc.studentNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || rc.status === statusFilter;
    const matchesTerm = rc.termName.includes("Term 1");
    return matchesSearch && matchesStatus && matchesTerm;
  });

  const publishedCount = reportCards.filter((rc) => rc.status === "published").length;
  const draftCount = reportCards.filter((rc) => rc.status === "draft").length;

  async function handleBatchGenerate() {
    setGenerating(true);
    try {
      await onGenerateBatch("term-fall-2026", selectedClassId);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-selected uppercase tracking-wider">Phase 3 Academic Records</span>
            <span className="text-line-subtle">/</span>
            <span className="text-xs text-secondary font-medium">Official Report Cards</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            Term Report Cards & Transcripts
          </h1>
          <p className="mt-0.5 text-xs text-secondary">
            Versioned institutional academic records, multi-subject evaluations, attendance syntheses, and registrar publication.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={handleBatchGenerate} disabled={generating} className="gap-1.5">
            <ArrowsClockwise size={15} className={generating ? "animate-spin" : ""} />
            {generating ? "Compiling..." : "Generate Class Report Cards"}
          </Button>
        </div>
      </div>

      {/* Grading Progress & Publication Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-card border border-line-subtle bg-surface shadow-card p-4">
          <span className="text-[10px] font-bold uppercase text-secondary">Class Progress</span>
          <div className="flex items-baseline justify-between mt-1">
            <p className="text-2xl font-black text-ink">92%</p>
            <Badge tone="green">On Track</Badge>
          </div>
          <div className="w-full bg-surface-subtle h-2 mt-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full transition-all" style={{ width: "92%" }}></div>
          </div>
          <span className="text-[10px] text-secondary mt-1 block">Grades finalized for 7B</span>
        </div>

        <div className="rounded-card border border-line-subtle bg-surface shadow-card p-4">
          <span className="text-[10px] font-bold uppercase text-secondary">Official Status</span>
          <p className="text-2xl font-black text-selected mt-1">{publishedCount} Published</p>
          <p className="text-[11px] text-secondary mt-1">Released to Guardian Portal</p>
        </div>

        <div className="rounded-card border border-line-subtle bg-surface shadow-card p-4">
          <span className="text-[10px] font-bold uppercase text-secondary">Pending Approval</span>
          <p className="text-2xl font-black text-warning mt-1">{draftCount} Drafts</p>
          <p className="text-[11px] text-secondary mt-1">Awaiting principal endorsement</p>
        </div>

        <div className="rounded-card border border-line-subtle bg-surface shadow-card p-4">
          <span className="text-[10px] font-bold uppercase text-secondary">Current Term</span>
          <p className="text-lg font-bold text-ink mt-1">{termFilter}</p>
          <p className="text-[11px] text-secondary mt-1">Academic Year 2026–27</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface shadow-card p-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-secondary">Class:</span>
            <select
              aria-label="Select class for report cards"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="font-bold text-ink bg-transparent focus:outline-none cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Class {c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1">
            <span className="text-[10px] font-bold uppercase text-secondary">Status:</span>
            <select
              aria-label="Filter report cards by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="font-semibold text-secondary bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published Only</option>
              <option value="draft">Drafts Only</option>
            </select>
          </div>
        </div>

        <div className="relative w-full sm:w-64">
          <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={14} />
          <input
            type="text"
            placeholder="Search report cards…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-control border border-line bg-surface pl-8 pr-3 text-xs text-ink focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {/* Report Cards Table */}
      <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <thead>
              <tr className="h-10 border-b border-line-subtle bg-surface-subtle text-[10px] uppercase tracking-[0.08em] text-secondary">
                <th className="px-4 font-bold">Student</th>
                <th className="px-4 font-bold">Class & Term</th>
                <th className="px-4 font-bold text-center">Version</th>
                <th className="px-4 font-bold text-center">Average %</th>
                <th className="px-4 font-bold text-center">Attendance</th>
                <th className="px-4 font-bold">Status</th>
                <th className="px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-subtle">
              {filteredCards.map((rc) => (
                <tr key={rc.reportCardId} className="h-14 hover:bg-surface-subtle/50 transition-colors">
                  <td className="px-4">
                    <div className="font-bold text-ink">{rc.studentName}</div>
                    <span className="font-mono text-[10px] text-secondary">{rc.studentNumber}</span>
                  </td>
                  <td className="px-4">
                    <div className="font-semibold text-ink">{rc.className}</div>
                    <span className="text-[11px] text-secondary">{rc.termName}</span>
                  </td>
                  <td className="px-4 text-center font-mono font-bold text-secondary">
                    v{rc.version}.0
                  </td>
                  <td className="px-4 text-center font-mono font-bold text-selected">
                    {rc.overallPercentage.toFixed(1)}%
                  </td>
                  <td className="px-4 text-center text-[11px] text-secondary">
                    <div className="text-ink font-medium">{rc.attendance.attendanceRate}%</div>
                    <span className="text-[10px] text-secondary">{rc.attendance.daysPresent}/{rc.attendance.daysEnrolled} days</span>
                  </td>
                  <td className="px-4">
                    <Badge tone={rc.status === "published" ? "green" : "amber"}>
                      {rc.status}
                    </Badge>
                  </td>
                  <td className="px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => onViewReportCard(rc)} className="gap-1">
                        <FileText size={14} />
                        View / Print
                      </Button>
                      {rc.status === "draft" && (
                        <Button size="sm" onClick={() => onPublishReportCard(rc.reportCardId)} className="gap-1">
                          <SealCheck size={14} />
                          Publish
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
