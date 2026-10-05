"use client";
import type { AnnouncementRecord } from "@/lib/communications";
import type { OfficialReportCardData } from "@/lib/assessments";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  FileText,
  Megaphone,
  ChatTeardropText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatGMTDate } from "@/lib/timezone";

export function GuardianPortalView({
  announcements,
  onSubmitExcuse,
  onViewReportCard,
  ameliaReportCards,
  guardianConsent,
  onToggleSmsConsent,
}: {
  announcements: AnnouncementRecord[];
  onSubmitExcuse: () => void;
  onViewReportCard: (reportCard: OfficialReportCardData) => void;
  ameliaReportCards: OfficialReportCardData[];
  guardianConsent?: { phone: string; optInSmsAnnouncements: boolean; consentTimestamp?: string };
  onToggleSmsConsent?: (optIn: boolean) => Promise<boolean | void>;
}) {
  const [tab, setTab] = useState<"attendance" | "academics" | "notices">("attendance");
  const [isUpdatingConsent, startConsentTransition] = useTransition();
  const [davidConsent, setDavidConsent] = useState(
    guardianConsent ?? { phone: "+354 555 0192", optInSmsAnnouncements: true, consentTimestamp: "2026-09-01T08:00:00Z" }
  );
  const [consentFeedback, setConsentFeedback] = useState<string | null>(null);

  function handleToggleConsentField() {
    const nextVal = !davidConsent.optInSmsAnnouncements;
    startConsentTransition(async () => {
      if (onToggleSmsConsent) {
        const saved = await onToggleSmsConsent(nextVal);
        if (saved === false) {
          setConsentFeedback("We could not save this preference. Please try again.");
          return;
        }
      }
      setDavidConsent((prev) => ({ ...prev, optInSmsAnnouncements: nextVal }));
      setConsentFeedback(`SMS announcement delivery preference updated to: ${nextVal ? "OPTED IN" : "OPTED OUT"}.`);
      if (typeof window !== "undefined") {
        setTimeout(() => setConsentFeedback(null), 4000);
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-line-subtle pb-4">
        <div>
          <span className="text-xs font-semibold text-primary uppercase tracking-wider">Guardian Self-Service Portal</span>
          <h1 className="text-2xl font-bold tracking-tight text-ink">David Warren · Student Records</h1>
          <p className="mt-0.5 text-xs text-secondary">Verified Parent with Legal Custody & Emergency Contact</p>
        </div>
        {tab === "attendance" && (
          <Button onClick={onSubmitExcuse} className="min-h-11">
            <ChatTeardropText size={16} />Submit Absence Excuse Note
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line-subtle text-xs">
        <button
          type="button"
          onClick={() => setTab("attendance")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors cursor-pointer",
            tab === "attendance" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <CalendarCheck size={16} />
          Daily Attendance & Excuses
        </button>
        <button
          type="button"
          onClick={() => setTab("academics")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors cursor-pointer",
            tab === "academics" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <FileText size={16} />
          Academic Performance & Report Cards
        </button>
        <button
          type="button"
          onClick={() => setTab("notices")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors cursor-pointer",
            tab === "notices" ? "border-primary text-selected" : "border-transparent text-secondary hover:text-ink",
          )}
        >
          <Megaphone size={16} />
          School Notices & Consents
        </button>
      </div>

      {tab === "attendance" && (
        <div className="rounded-card border border-line-subtle bg-surface p-6 shadow-card space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-control bg-primary-subtle text-sm font-bold text-selected">
                AW
              </span>
              <div>
                <h2 className="text-lg font-bold text-ink">Amelia Warren</h2>
                <p className="text-xs text-secondary">Student ID: ST-2026-0142 · Grade 7 (Class 7B)</p>
              </div>
            </div>
            <Badge tone="green">Present Today (08:42 AM)</Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-line-subtle pt-4">
            <div><span className="text-[10px] font-bold uppercase text-muted">Attendance Rate</span><p className="text-xl font-bold text-ink">97.8%</p></div>
            <div><span className="text-[10px] font-bold uppercase text-muted">Days Enrolled</span><p className="text-xl font-bold text-ink">45</p></div>
            <div><span className="text-[10px] font-bold uppercase text-muted">Excused Days</span><p className="text-xl font-bold text-ink">1</p></div>
            <div><span className="text-[10px] font-bold uppercase text-muted">Unexcused</span><p className="text-xl font-bold text-emerald-700">0</p></div>
          </div>

          {/* History */}
          <div className="border-t border-line-subtle pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-secondary">Recent Attendance History</h3>
            <div className="divide-y divide-line-subtle text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div><span className="font-semibold text-ink">Tuesday, 22 Sep 2026</span><span className="block text-[11px] text-muted">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div><span className="font-semibold text-ink">Monday, 21 Sep 2026</span><span className="block text-[11px] text-muted">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div><span className="font-semibold text-ink">Friday, 18 Sep 2026</span><span className="block text-[11px] text-muted">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <div><span className="font-semibold text-ink">Thursday, 17 Sep 2026</span><span className="block text-[11px] text-muted">Medical Examination</span></div>
                <Badge tone="primary">Excused (Doctor Note)</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "academics" && (
        <div className="space-y-6">
          {/* Overview Banner */}
          <div className="rounded-card border border-line-subtle bg-surface p-6 shadow-card space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 items-center justify-center rounded-control bg-primary-subtle text-sm font-bold text-selected">
                  AW
                </span>
                <div>
                  <h2 className="text-lg font-bold text-ink">Amelia Warren · Academic Standing</h2>
                  <p className="text-xs text-secondary">Term 1 (Fall 2026) · Grade 7 (Class 7B)</p>
                </div>
              </div>
              <Badge tone="green">Distinguished Honor Roll</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-line-subtle pt-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-muted">Cumulative Term GPA</span>
                <p className="text-2xl font-black text-ink">3.85 <span className="text-xs font-normal text-secondary">/ 4.00</span></p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted">Overall Weighted Mark</span>
                <p className="text-2xl font-black text-primary">93.8%</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-muted">Published Evaluations</span>
                <p className="text-2xl font-black text-ink">6 Subjects</p>
              </div>
            </div>
          </div>

          {/* Official Report Cards */}
          <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
            <div className="border-b border-line-subtle px-5 py-4 flex items-center justify-between bg-surface-subtle">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Official Published Report Cards
                </h2>
                <p className="mt-0.5 text-xs text-secondary">
                  Authorized transcripts signed by faculty and the head of school.
                </p>
              </div>
              <Badge tone="primary">Registrar Approved</Badge>
            </div>

            <div className="divide-y divide-line-subtle p-5 space-y-4">
              {ameliaReportCards.map((rc) => (
                <div key={rc.reportCardId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-control border border-line-subtle bg-surface-subtle p-4 shadow-subtle">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink text-sm">{rc.termName} Official Report Card</span>
                      <span className="font-mono text-xs text-selected font-bold bg-primary-subtle px-1.5 py-0.5 rounded border border-line-subtle">v{rc.version}.0</span>
                    </div>
                    <p className="text-xs text-secondary mt-1">
                      Term GPA: <strong className="text-ink">{rc.gpa.toFixed(2)}</strong> · Overall Mark: <strong className="text-ink">{rc.overallPercentage.toFixed(1)}%</strong> · Attendance: <strong className="text-ink">{rc.attendance.attendanceRate}%</strong>
                    </p>
                    <span className="text-[10px] text-muted">Published on {rc.publishedAt} · Office of Academic Records</span>
                  </div>
                  <Button onClick={() => onViewReportCard(rc)} className="gap-1.5 min-h-11">
                    <FileText size={15} />
                    View & Print Official Report Card
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Published Subject Breakdown */}
          <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
            <div className="border-b border-line-subtle px-5 py-4 bg-surface-subtle">
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                Course Performance & Faculty Feedback
              </h2>
            </div>
            <div className="divide-y divide-line-subtle">
              {ameliaReportCards[0]?.subjects.map((sub) => (
                <div key={sub.subjectCode} className="p-5 space-y-2.5 hover:bg-surface-subtle transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-ink text-sm">{sub.subjectName}</span>
                      <span className="text-xs text-secondary ml-2 font-mono">({sub.subjectCode}) · Faculty: {sub.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-ink text-sm">{sub.scorePercentage.toFixed(1)}%</span>
                      <span className="px-2 py-0.5 rounded border border-line-subtle bg-surface-subtle font-bold text-ink text-xs">
                        Grade {sub.letterGrade}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-secondary italic rounded-control bg-surface-subtle p-3 border-l-2 border-primary">
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
            <div className="rounded-control border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 animate-in fade-in">
              {consentFeedback}
            </div>
          )}

          {/* Official Notices */}
          <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
            <div className="border-b border-line-subtle px-5 py-4 flex items-center justify-between bg-surface-subtle">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                  School Circulars & Safety Broadcasts
                </h2>
                <p className="mt-0.5 text-xs text-secondary">
                  Official notices issued to guardians of Northfield Academy.
                </p>
              </div>
              <Badge tone="primary">Verified Guardian Recipient</Badge>
            </div>

            <div className="divide-y divide-line-subtle">
              {announcements
                .filter((a) => a.status === "published")
                .map((ann) => (
                  <div
                    key={ann.id}
                    className="p-5 space-y-2 hover:bg-surface-subtle transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ann.priority === "urgent" ? (
                          <Badge tone="amber">
                            URGENT
                          </Badge>
                        ) : (
                          <Badge tone="slate">
                            CIRCULAR
                          </Badge>
                        )}
                        <span className="font-mono text-[10px] text-muted">
                          {ann.channels === "both" ? "PORTAL + SMS" : ann.channels === "sms" ? "SMS ONLY" : "PORTAL ONLY"}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-muted">
                        {formatGMTDate(ann.createdAt)}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-ink">{ann.title}</h3>
                    <p className="text-xs text-secondary leading-relaxed">{ann.content}</p>

                    <div className="text-[11px] text-muted">
                      Dispatched by: <strong className="text-secondary">{ann.authorName ?? "Northfield Academy"}</strong>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* SMS Consent Preferences */}
          {davidConsent && (
            <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
              <div className="border-b border-line-subtle px-5 py-4 bg-surface-subtle">
                <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                  Mobile SMS Communications & TCPA Consent Preferences
                </h2>
                <p className="mt-0.5 text-xs text-secondary">
                  Manage which categories of school communications are dispatched to your registered mobile phone.
                </p>
              </div>

              <div className="p-5 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-line-subtle pb-4">
                  <div>
                    <span className="font-semibold text-ink">Registered Destination Mobile</span>
                    <p className="text-[11px] text-muted">Primary phone on file with the registrar office.</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-ink bg-surface-subtle px-2.5 py-1 rounded border border-line-subtle">
                    {davidConsent.phone}
                  </span>
                </div>

                <div className="divide-y divide-line-subtle">
                  <div className="py-3.5 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-ink">General School Announcements & Circulars</span>
                      <p className="text-[11px] text-muted">Receive SMS for term schedules, events, and school notices.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isUpdatingConsent}
                      onClick={() => handleToggleConsentField()}
                      className={cn(
                        "h-8 text-xs font-bold rounded-control",
                        davidConsent.optInSmsAnnouncements
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-line-subtle bg-surface-subtle text-secondary hover:bg-surface",
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
