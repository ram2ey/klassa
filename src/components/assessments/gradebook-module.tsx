"use client";

import { useState } from "react";
import {
  BookOpen,
  FileText,
  Plus,
  ShieldCheck,
  Table,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AssessmentCategoryItem,
  AssessmentItemData,
  GradeCorrectionLogItem,
  GradebookStudentRow,
  GradingSchemeDefinition,
} from "@/app/actions/assessment-actions";

interface GradebookModuleProps {
  classId: string;
  setClassId: (id: string) => void;
  subjectId: string;
  setSubjectId: (id: string) => void;
  classes: Array<{ id: string; name: string }>;
  subjects: Array<{ id: string; code: string; name: string }>;
  assessments: AssessmentItemData[];
  categories: AssessmentCategoryItem[];
  schemes: GradingSchemeDefinition[];
  students: GradebookStudentRow[];
  corrections: GradeCorrectionLogItem[];
  persona: "admin" | "teacher" | "guardian";
  onScoreSave: (assessmentId: string, studentId: string, score: number, status: "draft" | "published") => Promise<void>;
  onOpenCorrectionModal: (info: {
    gradeId: string;
    assessmentId: string;
    assessmentTitle: string;
    studentId: string;
    studentName: string;
    currentScore: number;
    maxScore: number;
  }) => void;
  onTogglePublishAssessment: (assessmentId: string, publish: boolean) => Promise<void>;
  onAddAssessment: () => void;
}

export function GradebookModule({
  classId,
  setClassId,
  subjectId,
  setSubjectId,
  classes,
  subjects,
  assessments,
  categories,
  schemes,
  students,
  corrections,
  persona,
  onScoreSave,
  onOpenCorrectionModal,
  onTogglePublishAssessment,
  onAddAssessment,
}: GradebookModuleProps) {
  const [tab, setTab] = useState<"matrix" | "assessments" | "schemes" | "audit">("matrix");
  const [editingCell, setEditingCell] = useState<{ studentId: string; assessmentId: string } | null>(null);
  const [cellValue, setCellValue] = useState<string>("");

  const currentClass = classes.find((c) => c.id === classId);
  const currentSubject = subjects.find((s) => s.id === subjectId);

  // Quick cell click
  function handleCellClick(
    student: GradebookStudentRow,
    assessment: AssessmentItemData,
  ) {
    const scoreData = student.scores[assessment.id];

    // If score exists and is already published, prompt audit correction modal
    if (scoreData && scoreData.status === "published") {
      onOpenCorrectionModal({
        gradeId: scoreData.gradeId,
        assessmentId: assessment.id,
        assessmentTitle: assessment.title,
        studentId: student.studentId,
        studentName: student.studentName,
        currentScore: scoreData.score,
        maxScore: assessment.maxScore,
      });
      return;
    }

    setEditingCell({ studentId: student.studentId, assessmentId: assessment.id });
    setCellValue(scoreData ? String(scoreData.score) : "");
  }

  async function handleCellBlur(studentId: string, assessmentId: string) {
    if (cellValue.trim() === "") {
      setEditingCell(null);
      return;
    }

    const num = parseFloat(cellValue);
    if (!isNaN(num)) {
      const assessment = assessments.find((a) => a.id === assessmentId);
      const bounded = Math.max(0, Math.min(assessment?.maxScore ?? 100, num));
      const targetStudent = students.find((s) => s.studentId === studentId);
      const existingStatus = targetStudent?.scores[assessmentId]?.status ?? "draft";
      await onScoreSave(assessmentId, studentId, bounded, existingStatus);
    }
    setEditingCell(null);
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-line-subtle pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-selected uppercase tracking-wider">Phase 3 Academic Records</span>
            <span className="text-line-subtle">/</span>
            <span className="text-xs text-secondary font-medium">Interactive Gradebook</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {currentSubject?.name ?? "Mathematics & Logic"} · Class {currentClass?.name ?? "7B"}
          </h1>
          <p className="mt-0.5 text-xs text-secondary">
            Weighted category calculations, draft vs. published state management, and strict grade-change audit trails.
          </p>
        </div>

        {/* Class & Subject Dropdowns + Action */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-xs">
            <span className="text-[10px] font-bold uppercase text-secondary">Class:</span>
            <select
              aria-label="Filter class"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="font-bold text-ink bg-transparent focus:outline-none cursor-pointer"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>Class {c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 rounded-control border border-line bg-surface px-2.5 py-1 text-xs">
            <span className="text-[10px] font-bold uppercase text-secondary">Subject:</span>
            <select
              aria-label="Filter subject"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="font-bold text-ink bg-transparent focus:outline-none cursor-pointer"
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
              ))}
            </select>
          </div>

          <Button onClick={onAddAssessment} className="gap-1.5">
            <Plus size={15} />
            New Assessment
          </Button>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-line-subtle text-xs">
        <button
          onClick={() => setTab("matrix")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "matrix" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <Table size={16} />
          Gradebook Matrix
        </button>
        <button
          onClick={() => setTab("assessments")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "assessments" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <FileText size={16} />
          Assessments & Weights ({assessments.length})
        </button>
        <button
          onClick={() => setTab("schemes")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "schemes" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <BookOpen size={16} />
          Grading Scales
        </button>
        <button
          onClick={() => setTab("audit")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "audit" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <ShieldCheck size={16} />
          Grade Change Audit ({corrections.length})
        </button>
      </div>

      {/* View: Gradebook Matrix */}
      {tab === "matrix" && (
        <div className="space-y-4">
          {/* Category Weight Summary Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line-subtle bg-surface shadow-card p-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-secondary">Category Weights:</span>
              {categories.map((cat) => (
                <span key={cat.id} className="rounded-control border border-line-subtle bg-surface-subtle px-2 py-0.5 font-medium text-secondary">
                  {cat.name}: <strong className="text-ink">{cat.weight}%</strong>
                </span>
              ))}
            </div>
            <div className="flex items-center gap-3 text-[11px] text-secondary">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-success"></span> Published (Guardian Visible)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-warning"></span> Draft (Staff Only)
              </span>
            </div>
          </div>

          {/* Interactive Table Matrix */}
          <div className="rounded-card border border-line-subtle bg-surface shadow-card overflow-x-auto">
            <table className="w-full min-w-[950px] border-collapse text-left text-xs">
              <thead>
                <tr className="h-14 border-b border-line-subtle bg-surface-subtle text-[10px] uppercase tracking-[0.08em] text-secondary">
                  <th className="sticky left-0 z-10 bg-surface-subtle px-4 font-bold min-w-[180px] border-r border-line-subtle text-ink">
                    Student Roster
                  </th>
                  {assessments.map((a) => (
                    <th key={a.id} className="px-3 py-2 font-bold min-w-[140px] border-r border-line-subtle">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-ink font-bold">{a.code}</span>
                        <Badge tone={a.status === "published" ? "green" : "amber"}>
                          {a.status}
                        </Badge>
                      </div>
                      <div className="truncate text-secondary font-medium normal-case" title={a.title}>
                        {a.title}
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[9px] text-secondary/70">
                        <span>Max {a.maxScore} pts ({a.categoryName.split(" ")[0]})</span>
                        {persona !== "guardian" && (
                          <button
                            onClick={() => onTogglePublishAssessment(a.id, a.status !== "published")}
                            className="text-selected hover:underline uppercase font-bold text-[9px]"
                          >
                            {a.status === "published" ? "Unpublish" : "Publish"}
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  <th className="sticky right-0 z-10 bg-primary-subtle/70 px-4 py-2 font-bold min-w-[160px] border-l border-primary/20 text-selected">
                    Weighted Term Mark
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {students.map((st) => (
                  <tr key={st.studentId} className="h-12 hover:bg-surface-subtle/50 transition-colors">
                    {/* Student Column */}
                    <td className="sticky left-0 z-10 bg-surface px-4 border-r border-line-subtle">
                      <div className="font-bold text-ink">{st.studentName}</div>
                      <span className="font-mono text-[10px] text-secondary">{st.studentNumber}</span>
                    </td>

                    {/* Assessment Cells */}
                    {assessments.map((a) => {
                      const scoreData = st.scores[a.id];
                      const isEditing = editingCell?.studentId === st.studentId && editingCell?.assessmentId === a.id;

                      return (
                        <td
                          key={a.id}
                          className={cn(
                            "px-3 border-r border-line-subtle text-center transition-colors cursor-pointer",
                            scoreData?.status === "published" ? "hover:bg-primary-subtle/30" : "hover:bg-warning-subtle/30",
                          )}
                          onClick={() => !isEditing && handleCellClick(st, a)}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              min={0}
                              max={a.maxScore}
                              step="0.5"
                              value={cellValue}
                              onChange={(e) => setCellValue(e.target.value)}
                              onBlur={() => handleCellBlur(st.studentId, a.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleCellBlur(st.studentId, a.id);
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="h-8 w-16 text-center rounded-control border border-primary bg-surface font-mono font-bold text-xs text-ink focus:outline-none"
                            />
                          ) : scoreData ? (
                            <div className="space-y-0.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <span className="font-mono font-bold text-ink text-sm">
                                  {scoreData.score}
                                </span>
                                <span className="text-[10px] text-secondary font-mono">
                                  /{a.maxScore}
                                </span>
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-[10px] font-semibold text-secondary">
                                  {scoreData.percentage.toFixed(0)}%
                                </span>
                                <span className="text-[10px] font-bold text-selected bg-primary-subtle px-1 rounded-control border border-primary/20">
                                  {scoreData.letterGrade}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-secondary/50 italic text-[11px]">—</span>
                          )}
                        </td>
                      );
                    })}

                    {/* Computed Final Term Mark */}
                    <td className="sticky right-0 z-10 bg-primary-subtle/40 px-4 border-l border-primary/20">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black text-ink">
                              {st.computedPercentage > 0 ? `${st.computedPercentage.toFixed(1)}%` : "N/A"}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-control border border-primary bg-primary text-white font-bold text-xs">
                              {st.computedLetter}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View: Assessments & Category Weights */}
      {tab === "assessments" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            {categories.map((c) => (
              <div key={c.id} className="rounded-card border border-line-subtle bg-surface shadow-card p-4">
                <span className="text-[10px] font-bold uppercase text-secondary">Category</span>
                <h3 className="font-bold text-ink mt-1">{c.name}</h3>
                <p className="text-2xl font-black text-selected mt-2">{c.weight}%</p>
                <span className="text-[10px] text-secondary">Weight toward term average</span>
              </div>
            ))}
          </div>

          <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
            <div className="border-b border-line-subtle px-4 py-3 flex items-center justify-between bg-surface-subtle/50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                Current Subject Assessments ({assessments.length})
              </h2>
              <Button size="sm" onClick={onAddAssessment}>
                <Plus size={14} /> Add Assessment
              </Button>
            </div>
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="h-10 border-b border-line-subtle bg-surface-subtle text-[10px] uppercase tracking-[0.08em] text-secondary">
                  <th className="px-4 font-bold">Code</th>
                  <th className="px-4 font-bold">Assessment Title</th>
                  <th className="px-4 font-bold">Category</th>
                  <th className="px-4 font-bold">Max Points</th>
                  <th className="px-4 font-bold">Due Date</th>
                  <th className="px-4 font-bold">State</th>
                  <th className="px-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {assessments.map((a) => (
                  <tr key={a.id} className="h-12 hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-4 font-mono font-bold text-ink">{a.code}</td>
                    <td className="px-4 font-semibold text-ink">{a.title}</td>
                    <td className="px-4 text-secondary">{a.categoryName}</td>
                    <td className="px-4 font-mono text-secondary">{a.maxScore} pts</td>
                    <td className="px-4 text-secondary">{a.dateDue}</td>
                    <td className="px-4">
                      <Badge tone={a.status === "published" ? "green" : "amber"}>
                        {a.status}
                      </Badge>
                    </td>
                    <td className="px-4">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onTogglePublishAssessment(a.id, a.status !== "published")}
                      >
                        {a.status === "published" ? "Set Draft" : "Publish"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {/* View: Grading Scales */}
      {tab === "schemes" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {schemes.map((sch) => (
            <section key={sch.id} className="rounded-card border border-line-subtle bg-surface shadow-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-ink">{sch.name}</h2>
                  <span className="text-xs text-secondary uppercase font-mono">Type: {sch.type}</span>
                </div>
                {sch.isDefault && <Badge tone="amber">School Default</Badge>}
              </div>

              <div className="rounded-control border border-line-subtle overflow-hidden">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="h-8 border-b border-line-subtle bg-surface-subtle text-[10px] uppercase font-bold text-secondary">
                      <th className="px-3">Grade Label</th>
                      <th className="px-3">Min %</th>
                      <th className="px-3">Max %</th>
                      <th className="px-3">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {sch.scale.map((item) => (
                      <tr key={item.label} className="h-8 hover:bg-surface-subtle/50 transition-colors">
                        <td className="px-3 font-bold text-ink">{item.label}</td>
                        <td className="px-3 font-mono text-secondary">{item.minScore}%</td>
                        <td className="px-3 font-mono text-secondary">{item.maxScore}%</td>
                        <td className="px-3 text-[11px] text-secondary">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* View: Grade Changes Audit Ledger */}
      {tab === "audit" && (
        <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
          <div className="border-b border-line-subtle px-4 py-3 flex items-center justify-between bg-surface-subtle/50">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-selected" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Grade Change Audit Ledger
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-secondary">
                Immutable record of all score alterations made after grade publication.
              </p>
            </div>
            <Badge tone="green">Institutional Integrity Protection</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left text-xs">
              <thead>
                <tr className="h-10 border-b border-line-subtle bg-surface-subtle text-[10px] uppercase tracking-[0.08em] text-secondary">
                  <th className="px-4 font-bold">Student</th>
                  <th className="px-4 font-bold">Assessment</th>
                  <th className="px-4 font-bold">Previous Score</th>
                  <th className="px-4 font-bold">New Score</th>
                  <th className="px-4 font-bold">Mandatory Justification Reason</th>
                  <th className="px-4 font-bold">Authorized By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-subtle">
                {corrections.map((c) => (
                  <tr key={c.id} className="h-14 hover:bg-surface-subtle/50 transition-colors">
                    <td className="px-4 font-bold text-ink">{c.studentName}</td>
                    <td className="px-4 text-ink">{c.assessmentTitle}</td>
                    <td className="px-4">
                      <span className="font-mono text-danger bg-danger-subtle px-2 py-0.5 rounded-control border border-danger/20 font-bold">
                        {c.previousScore} ({c.previousGrade})
                      </span>
                    </td>
                    <td className="px-4">
                      <span className="font-mono text-success bg-success-subtle px-2 py-0.5 rounded-control border border-success/20 font-bold">
                        {c.newScore} ({c.newGrade})
                      </span>
                    </td>
                    <td className="px-4 max-w-xs text-secondary text-[11px] italic">
                      &ldquo;{c.reason}&rdquo;
                    </td>
                    <td className="px-4 text-[11px] text-secondary">
                      <div>{c.correctedBy}</div>
                      <span className="text-[10px] text-secondary/70">{c.correctedAt}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
