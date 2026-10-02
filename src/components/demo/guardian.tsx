"use client";
import { type OfficialReportCardData } from "@/lib/assessments";
import { type AnnouncementRecord, type GuardianConsentRecord, type GuardianConsentInput } from "@/lib/communications";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ChatTeardropText, CalendarCheck, FileText, Megaphone } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatGMTDate } from "@/lib/timezone";

export function GuardianPortalView({
  onSubmitExcuse,
  reportCards,
  onViewReportCard,
  announcements,
  consents,
  onUpdateConsent,
}: {
  onSubmitExcuse: () => void;
  reportCards: OfficialReportCardData[];
  onViewReportCard: (rc: OfficialReportCardData) => void;
  announcements: AnnouncementRecord[];
  consents: GuardianConsentRecord[];
  onUpdateConsent: (input: GuardianConsentInput) => Promise<{ success: boolean; error?: string }>;
}) {
  const [tab, setTab] = useState<"attendance" | "academics" | "notices">("attendance");
  const [consentFeedback, setConsentFeedback] = useState<string | null>(null);
  const [isUpdatingConsent, startConsentTransition] = useTransition();

  const ameliaReportCards = reportCards.filter((rc) => rc.studentId === "ST-2026-0142" && rc.status === "published");
  const davidConsent = consents.find((c) => c.guardianId === "grd-001") ?? consents[0];

  function handleToggleConsentField() {
    if (!davidConsent) return;
    startConsentTransition(async () => {
      const res = await onUpdateConsent({
        guardianId: davidConsent.guardianId,
        phone: davidConsent.phone,
        optInSmsAnnouncements: !davidConsent.optInSmsAnnouncements,
        optOutReason: davidConsent.optOutReason ?? undefined,
      });
      if (res.success) {
        setConsentFeedback("Communication preferences updated.");
        setTimeout(() => setConsentFeedback(null), 3000);
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Guardian Self-Service Portal</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">David Warren · Student Records</h1>
          <p className="mt-0.5 text-xs text-slate-500">Verified Parent with Legal Custody & Emergency Contact</p>
        </div>
        {tab === "attendance" && (
          <Button onClick={onSubmitExcuse}>
            <ChatTeardropText size={16} />Submit Absence Excuse Note
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setTab("attendance")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "attendance" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950",
          )}
        >
          <CalendarCheck size={16} />
          Daily Attendance & Excuses
        </button>
        <button
          onClick={() => setTab("academics")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "academics" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950",
          )}
        >
          <FileText size={16} />
          Academic Performance & Report Cards
        </button>
        <button
          onClick={() => setTab("notices")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "notices" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950",
          )}
        >
          <Megaphone size={16} />
          School Notices & Consents
        </button>
      </div>

      {tab === "attendance" && (
        <div className="border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center bg-blue-950 text-sm font-bold text-blue-300">
                AW
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Amelia Warren</h2>
                <p className="text-xs text-slate-500">Student ID: ST-2026-0142 · Grade 7 (Class 7B)</p>
              </div>
            </div>
            <Badge tone="green">Present Today (08:42 AM)</Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Attendance Rate</span><p className="text-xl font-bold text-slate-900">97.8%</p></div>
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Days Enrolled</span><p className="text-xl font-bold text-slate-900">45</p></div>
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Excused Days</span><p className="text-xl font-bold text-slate-900">1</p></div>
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Unexcused</span><p className="text-xl font-bold text-green-700">0</p></div>
          </div>

          {/* History */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recent Attendance History</h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Tuesday, 22 Sep 2026</span><span className="block text-[11px] text-slate-500">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Monday, 21 Sep 2026</span><span className="block text-[11px] text-slate-500">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Friday, 18 Sep 2026</span><span className="block text-[11px] text-slate-500">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Thursday, 17 Sep 2026</span><span className="block text-[11px] text-slate-500">Medical Examination</span></div>
                <Badge tone="blue">Excused (Doctor Note)</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "academics" && (
        <div className="space-y-6">
          {/* Overview Banner */}
          <div className="border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center bg-blue-950 text-sm font-bold text-blue-300">
                  AW
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Amelia Warren · Academic Standing</h2>
                  <p className="text-xs text-slate-500">Term 1 (Fall 2026) · Grade 7 (Class 7B)</p>
                </div>
              </div>
              <Badge tone="green">Distinguished Honor Roll</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Cumulative Term GPA</span>
                <p className="text-2xl font-black text-slate-950">3.85 <span className="text-xs font-normal text-slate-500">/ 4.00</span></p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Overall Weighted Mark</span>
                <p className="text-2xl font-black text-blue-700">93.8%</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Published Evaluations</span>
                <p className="text-2xl font-black text-slate-900">6 Subjects</p>
              </div>
            </div>
          </div>

          {/* Official Report Cards */}
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Official Published Report Cards
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Authorized transcripts signed by faculty and the head of school.
                </p>
              </div>
              <Badge tone="blue">Registrar Approved</Badge>
            </div>

            <div className="divide-y divide-slate-100 p-4 space-y-3">
              {ameliaReportCards.map((rc) => (
                <div key={rc.reportCardId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{rc.termName} Official Report Card</span>
                      <span className="font-mono text-xs text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 border border-blue-200">v{rc.version}.0</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Term GPA: <strong>{rc.gpa.toFixed(2)}</strong> · Overall Mark: <strong>{rc.overallPercentage.toFixed(1)}%</strong> · Attendance: <strong>{rc.attendance.attendanceRate}%</strong>
                    </p>
                    <span className="text-[10px] text-slate-400">Published on {rc.publishedAt} · Office of Academic Records</span>
                  </div>
                  <Button onClick={() => onViewReportCard(rc)} className="gap-1.5">
                    <FileText size={15} />
                    View & Print Official Report Card
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Published Subject Breakdown */}
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Course Performance & Faculty Feedback
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {ameliaReportCards[0]?.subjects.map((sub) => (
                <div key={sub.subjectCode} className="p-4 space-y-2 hover:bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{sub.subjectName}</span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">({sub.subjectCode}) · Faculty: {sub.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{sub.scorePercentage.toFixed(1)}%</span>
                      <span className="px-2 py-0.5 border border-slate-300 bg-slate-100 font-bold text-slate-900 text-xs">
                        Grade {sub.letterGrade}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 border-l-2 border-blue-600">
                    &ldquo;{sub.teacherComments}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "notices" && (
        <div className="space-y-6">
          {consentFeedback && (
            <div className="border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 animate-in fade-in">
              {consentFeedback}
            </div>
          )}

          {/* Official Notices */}
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  School Circulars & Safety Broadcasts
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Official notices issued to guardians of Northfield Academy.
                </p>
              </div>
              <Badge tone="blue">Verified Guardian Recipient</Badge>
            </div>

            <div className="divide-y divide-slate-100">
              {announcements
                .filter((a) => a.status === "published")
                .map((ann) => (
                  <div
                    key={ann.id}
                    className={cn(
                      "p-4 space-y-2",
                      "hover:bg-slate-50/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ann.priority === "urgent" ? (
                          <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                            URGENT
                          </span>
                        ) : (
                          <span className="border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 uppercase">
                            CIRCULAR
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500">
                          {ann.channels === "both" ? "PORTAL + SMS" : ann.channels === "sms" ? "SMS ONLY" : "PORTAL ONLY"}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {formatGMTDate(ann.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                    <p className="text-xs text-slate-700 leading-relaxed">{ann.content}</p>

                    <div className="text-[11px] text-slate-400">
                      Dispatched by: <strong className="text-slate-600">{ann.authorName ?? "Northfield Academy"}</strong>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* SMS Consent Preferences */}
          {davidConsent && (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Mobile SMS Communications & TCPA Consent Preferences
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Manage which categories of school communications are dispatched to your registered mobile phone.
                </p>
              </div>

              <div className="p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-semibold text-slate-900">Registered Destination Mobile</span>
                    <p className="text-[11px] text-slate-500">Primary phone on file with the registrar office.</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 border border-slate-200">
                    {davidConsent.phone}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">General School Announcements & Circulars</span>
                      <p className="text-[11px] text-slate-500">Receive SMS for term schedules, events, and school notices.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isUpdatingConsent}
                      onClick={() => handleToggleConsentField()}
                      className={cn(
                        "h-7 rounded-none text-xs font-bold",
                        davidConsent.optInSmsAnnouncements
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {davidConsent.optInSmsAnnouncements ? "OPTED IN" : "OPTED OUT"}
                    </Button>
                  </div>

                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
