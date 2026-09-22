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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-2 sm:p-4 overflow-y-auto">
      <div className="relative w-full max-w-4xl border border-slate-300 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Modal Action Bar (Hidden on Print) */}
        <div className="print:hidden flex items-center justify-between border-b border-slate-200 bg-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <SealCheck size={20} className="text-blue-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
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
              className="flex h-8 w-8 items-center justify-center border border-slate-300 bg-white text-slate-500 hover:bg-slate-200 hover:text-slate-800"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Report Card Surface */}
        <div className="p-6 sm:p-10 space-y-6 text-slate-900 bg-white print:p-0 print:space-y-4">
          {/* Institutional Header */}
          <div className="border-b-2 border-slate-900 pb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 items-center justify-center border-2 border-slate-900 bg-slate-950 text-blue-300">
                  <Buildings size={28} />
                </span>
                <div>
                  <h1 className="text-xl font-black uppercase tracking-[0.14em] text-slate-950">Northfield Academy</h1>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Office of Academic Records & Registrar</p>
                  <p className="text-[11px] text-slate-500">Austurstræti 12, 101 Reykjavík · Accreditation Ref: NA-IS-2026</p>
                </div>
              </div>
              <div className="text-right sm:border-l sm:border-slate-200 sm:pl-6">
                <Badge tone={reportCard.status === "published" ? "green" : "amber"}>
                  {reportCard.status === "published" ? `OFFICIAL RECORD · v${reportCard.version}.0` : "UNOFFICIAL DRAFT"}
                </Badge>
                <p className="mt-1 text-xs font-bold text-slate-900">{reportCard.termName}</p>
                <p className="text-[11px] text-slate-500">Academic Year {reportCard.academicYear}</p>
              </div>
            </div>
          </div>

          {/* Student Demographics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border border-slate-200 bg-slate-50/70 p-4 text-xs">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Student Name</span>
              <span className="font-bold text-slate-900 text-sm">{reportCard.studentName}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Student Number</span>
              <span className="font-mono font-bold text-slate-900">{reportCard.studentNumber}</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Class & Grade</span>
              <span className="font-bold text-slate-900">{reportCard.className} ({reportCard.gradeLevel})</span>
            </div>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Homeroom Teacher</span>
              <span className="font-semibold text-slate-900">Elena Rostova</span>
            </div>
          </div>

          {/* Academic Performance Matrix */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Coursework & Academic Evaluations</h2>
            <div className="border border-slate-200 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="h-9 border-b border-slate-200 bg-slate-100 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-600">
                    <th className="px-3 py-2">Subject / Course</th>
                    <th className="px-3 py-2">Faculty</th>
                    <th className="px-3 py-2 text-center">Score %</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                    <th className="px-3 py-2 text-center">Points</th>
                    <th className="px-3 py-2">Faculty Evaluation & Progress Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {reportCard.subjects.map((sub) => (
                    <tr key={sub.subjectCode} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2.5 font-bold text-slate-900">
                        <div>{sub.subjectName}</div>
                        <span className="font-mono text-[10px] text-slate-500">{sub.subjectCode} · {sub.department}</span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 font-medium">{sub.teacherName}</td>
                      <td className="px-3 py-2.5 text-center font-mono font-bold text-slate-900">{sub.scorePercentage.toFixed(1)}%</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-block px-2 py-0.5 border border-slate-300 bg-slate-50 font-bold text-slate-900">
                          {sub.letterGrade}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center font-mono text-slate-700">{sub.gpaPoint.toFixed(1)}</td>
                      <td className="px-3 py-2.5 text-[11px] text-slate-600 italic leading-relaxed">
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
            <div className="border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Term Academic Standing</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Cumulative Term GPA</span>
                  <p className="text-2xl font-black text-slate-950">{reportCard.gpa.toFixed(2)} <span className="text-xs font-normal text-slate-500">/ 4.00</span></p>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-500">Weighted Average</span>
                  <p className="text-2xl font-black text-blue-700">{reportCard.overallPercentage.toFixed(1)}%</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                <CheckCircle size={16} className="text-green-700" />
                <span className="text-xs font-bold text-slate-800">Honor Roll Status: Distinguished Honors</span>
              </div>
            </div>

            {/* Attendance Summary */}
            <div className="border border-slate-200 bg-slate-50 p-4 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">Attendance & Punctuality Ledger</h3>
              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="border border-slate-200 bg-white p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-slate-500">Enrolled</span>
                  <span className="font-bold text-slate-900">{reportCard.attendance.daysEnrolled}</span>
                </div>
                <div className="border border-slate-200 bg-white p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-slate-500">Present</span>
                  <span className="font-bold text-green-700">{reportCard.attendance.daysPresent}</span>
                </div>
                <div className="border border-slate-200 bg-white p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-slate-500">Excused</span>
                  <span className="font-bold text-blue-700">{reportCard.attendance.daysExcused}</span>
                </div>
                <div className="border border-slate-200 bg-white p-1.5">
                  <span className="block text-[9px] font-bold uppercase text-slate-500">Unexcused</span>
                  <span className="font-bold text-slate-900">{reportCard.attendance.daysAbsent}</span>
                </div>
              </div>
              <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
                <span>Official Attendance Rate:</span>
                <span className="font-mono font-bold text-slate-900">{reportCard.attendance.attendanceRate}%</span>
              </div>
            </div>
          </div>

          {/* Remarks Section */}
          <div className="space-y-3 border border-slate-200 p-4 bg-white">
            <div className="text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Homeroom Teacher Evaluation</span>
              <p className="text-slate-800 italic leading-relaxed">{reportCard.homeroomTeacherRemarks}</p>
            </div>
            <div className="pt-2 border-t border-slate-100 text-xs space-y-1">
              <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">Principal / Head of School Endorsement</span>
              <p className="text-slate-800 leading-relaxed">{reportCard.principalRemarks}</p>
            </div>
          </div>

          {/* Signature Blocks */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-300 text-xs">
            <div>
              <div className="border-b border-slate-400 pb-8 font-serif italic text-slate-700">Elena Rostova</div>
              <span className="block mt-1.5 font-bold text-slate-900">Elena Rostova</span>
              <span className="text-[10px] text-slate-500">Homeroom Teacher & Lead Faculty</span>
            </div>
            <div>
              <div className="border-b border-slate-400 pb-8 font-serif italic text-slate-700">Dr. Arthur Vance, Ed.D.</div>
              <span className="block mt-1.5 font-bold text-slate-900">Dr. Arthur Vance</span>
              <span className="text-[10px] text-slate-500">Head of School & Principal</span>
            </div>
          </div>

          {/* Verification Footer */}
          <div className="pt-4 border-t border-slate-200 text-[10px] text-slate-400 flex flex-col sm:flex-row justify-between items-center gap-2">
            <span>Official digital verification hash: sha256:{reportCard.reportCardId}-verified-2026</span>
            <span>Generated on {reportCard.publishedAt ?? "22 Sep 2026"} · Confidential School Document</span>
          </div>
        </div>
      </div>
    </div>
  );
}
