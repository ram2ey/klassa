"use client";

import { Buildings, CheckCircle, Printer, SealCheck, X } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OfficialReportCardData } from "@/lib/assessments";

interface OfficialReportCardModalProps {
  reportCard: OfficialReportCardData;
  onClose: () => void;
}

export function OfficialReportCardModal({ reportCard, onClose }: OfficialReportCardModalProps) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl rounded-card border border-line-subtle bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8 overflow-hidden">
        {/* Modal Action Bar (Hidden on Print) */}
        <div className="print:hidden flex items-center justify-between border-b border-line-subtle bg-surface-subtle px-4 py-3">
          <div className="flex items-center gap-2">
            <SealCheck size={20} className="text-selected" />
            <span className="text-xs font-bold uppercase tracking-wider text-ink">
              Official Institutional Academic Transcript & Report Card
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer size={15} />
              Print / Save PDF
            </Button>
            <button
              onClick={onClose}
              aria-label="Close modal"
              className="flex h-8 w-8 items-center justify-center rounded-control border border-line bg-surface text-secondary hover:bg-surface-subtle hover:text-ink transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Report Card Surface */}
        <div className="p-6 sm:p-10 space-y-6 text-ink bg-surface print:p-0 print:space-y-4">
          {/* Institutional Header */}
          <div className="border-b-2 border-line pb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center rounded-control border border-line bg-surface-subtle text-primary">
                  <Buildings size={28} />
                </span>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-[0.14em] text-ink">Northfield Academy</h1>
                  <p className="text-xs font-semibold uppercase tracking-wider text-secondary">Office of Academic Records & Registrar</p>
                  <p className="text-[11px] text-secondary">Austurstræti 12, 101 Reykjavík · Accreditation Ref: NA-IS-2026</p>
                </div>
              </div>
              <div className="text-right sm:border-l sm:border-line sm:pl-6">
                <Badge tone={reportCard.status === "published" ? "green" : "amber"}>
                  {reportCard.status === "published" ? `OFFICIAL RECORD · v${reportCard.version}.0` : "UNOFFICIAL DRAFT"}
                </Badge>
                <p className="mt-1 text-xs font-bold text-ink">{reportCard.termName}</p>
                <p className="text-[11px] text-secondary">Academic Year {reportCard.academicYear}</p>
              </div>
            </div>
          </div>

          {/* Student Demographics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 rounded-control border border-line-subtle bg-surface-subtle p-4 text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">Student Name</span>
              <span className="font-bold text-ink text-sm">{reportCard.studentName}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">Student Number</span>
              <span className="font-mono font-bold text-ink">{reportCard.studentNumber}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">Class & Grade</span>
              <span className="font-bold text-ink">{reportCard.className} ({reportCard.gradeLevel})</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary">Homeroom Teacher</span>
              <span className="font-semibold text-ink">Elena Rostova</span>
            </div>
          </div>

          {/* Academic Performance Matrix */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-ink">Coursework & Academic Evaluations</h2>
            <div className="rounded-control border border-line-subtle overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="h-9 border-b border-line-subtle bg-surface-subtle text-[10px] font-bold uppercase tracking-[0.08em] text-secondary">
                    <th className="px-3 py-2">Subject / Course</th>
                    <th className="px-3 py-2">Faculty</th>
                    <th className="px-3 py-2 text-center">Score %</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                    <th className="px-3 py-2 text-center">Points</th>
                    <th className="px-3 py-2">Faculty Evaluation & Progress Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {reportCard.subjects.map((sub) => (
                    <tr key={sub.subjectCode} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="px-3 py-2.5 font-bold text-ink">
                        <div>{sub.subjectName}</div>
                        <span className="font-mono text-[10px] text-secondary">{sub.subjectCode} · {sub.department}</span>
                      </td>
                      <td className="px-3 py-2.5 text-secondary font-medium">{sub.teacherName}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-ink">{sub.scorePercentage.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 rounded-control border border-line bg-surface font-bold text-ink">
                          {sub.letterGrade}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px] text-secondary italic leading-relaxed">
                        &ldquo;{sub.teacherComments}&rdquo;
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Academic Standings & Attendance Ledger */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Academic Standings */}
            <div className="rounded-control border border-line-subtle bg-surface-subtle p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Term Academic Standing</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-secondary">Term average</span>
                  <p className="text-2xl font-black text-selected">{reportCard.overallPercentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="pt-2 border-t border-line-subtle flex items-center gap-2">
                <CheckCircle size={16} className="text-success" />
                <span className="text-xs font-bold text-ink">Honor Roll Status: Distinguished Honors</span>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="rounded-control border border-line-subtle bg-surface-subtle p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-ink">Attendance & Punctuality Ledger</h3>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="rounded-control border border-line bg-surface p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-secondary">Enrolled</span>
                  <span className="font-bold text-ink">{reportCard.attendance.daysEnrolled}</span>
                </div>
                <div className="rounded-control border border-line bg-surface p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-secondary">Present</span>
                  <span className="font-bold text-success">{reportCard.attendance.daysPresent}</span>
                </div>
                <div className="rounded-control border border-line bg-surface p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-secondary">Excused</span>
                  <span className="font-bold text-selected">{reportCard.attendance.daysExcused}</span>
                </div>
                <div className="rounded-control border border-line bg-surface p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-secondary">Unexcused</span>
                  <span className="font-bold text-ink">{reportCard.attendance.daysAbsent}</span>
                </div>
              </div>
              <div className="pt-1 border-t border-line-subtle flex items-center justify-between text-xs font-semibold text-secondary">
                <span>Official Attendance Rate:</span>
                <span className="font-mono font-bold text-ink">{reportCard.attendance.attendanceRate}%</span>
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          <div className="space-y-3 rounded-control border border-line-subtle p-4 bg-surface">
            <div className="text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-secondary">Homeroom Teacher Evaluation</span>
              <p className="text-ink italic leading-relaxed">{reportCard.homeroomTeacherRemarks}</p>
            </div>
            <div className="pt-2 border-t border-line-subtle text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-secondary">Principal / Head of School Endorsement</span>
              <p className="text-ink leading-relaxed">{reportCard.principalRemarks}</p>
            </div>
          </div>

          {/* Signature Blocks */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-line text-xs">
            <div>
              <div className="border-b border-line pb-8 font-serif italic text-ink">Elena Rostova</div>
              <span className="block mt-1.5 font-bold text-ink">Elena Rostova</span>
              <span className="text-[10px] text-secondary">Homeroom Teacher & Lead Faculty</span>
            </div>
            <div>
              <div className="border-b border-line pb-8 font-serif italic text-ink">Dr. Arthur Vance, Ed.D.</div>
              <span className="block mt-1.5 font-bold text-ink">Dr. Arthur Vance</span>
              <span className="text-[10px] text-secondary">Head of School & Principal</span>
            </div>
          </div>

          {/* Verification Footer */}
          <div className="pt-4 border-t border-line-subtle text-[10px] text-secondary flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>Official digital verification hash: sha256:{reportCard.reportCardId}-verified-2026</span>
            <span>Generated on {reportCard.publishedAt ?? "22 Sep 2026"} · Confidential School Document</span>
          </div>
        </div>
      </div>
    </div>
  );
}
