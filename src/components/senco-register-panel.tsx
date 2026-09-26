"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Filter,
  GraduationCap,
  History,
  PenSquare,
  Plus,
  Search,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import type { senProfiles, senReviews } from "@/db/schema";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";

type SenProfile = typeof senProfiles.$inferSelect;
type SenReview = typeof senReviews.$inferSelect;

interface StudentOption {
  id: string;
  name: string;
  studentNumber: string;
}

interface SencoRegisterPanelProps {
  profiles: SenProfile[];
  reviews: SenReview[];
  students: StudentOption[];
  isPending: boolean;
  onSaveCommand: (command: WorkflowCommand) => void;
}

const inputClasses = "mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm rounded-none focus:outline-hidden focus:border-blue-600";
const primaryBtn = "min-h-11 bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2";
const secondaryBtn = "min-h-11 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2";

const TIER_META = {
  universal: {
    label: "Tier 1: Universal",
    description: "Quality first teaching & inclusive classroom adjustments",
    badge: "bg-sky-50 text-sky-800 border-sky-300",
    badgeFull: "bg-sky-100 text-sky-900 border-sky-400",
  },
  targeted: {
    label: "Tier 2: Targeted",
    description: "Targeted small-group interventions & SEN support plan",
    badge: "bg-amber-50 text-amber-800 border-amber-300",
    badgeFull: "bg-amber-100 text-amber-900 border-amber-400",
  },
  specialist: {
    label: "Tier 3: Specialist (EHCP)",
    description: "Statutory EHCP, external agency therapists & high-needs funding",
    badge: "bg-purple-50 text-purple-800 border-purple-300",
    badgeFull: "bg-purple-100 text-purple-900 border-purple-400",
  },
} as const;

export function SencoRegisterPanel({
  profiles,
  reviews,
  students,
  isPending,
  onSaveCommand,
}: SencoRegisterPanelProps) {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "universal" | "targeted" | "specialist" | "overdue">("all");
  const [selectedStudentForReview, setSelectedStudentForReview] = useState<SenProfile | null>(null);
  const [editingProfile, setEditingProfile] = useState<SenProfile | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const studentMap = useMemo(() => {
    const map = new Map<string, StudentOption>();
    for (const s of students) map.set(s.id, s);
    return map;
  }, [students]);

  const registeredStudentIds = useMemo(() => new Set(profiles.map(p => p.studentId)), [profiles]);

  // Unregistered students for "Add student"
  const availableStudents = useMemo(() => {
    return students.filter(s => !registeredStudentIds.has(s.id));
  }, [students, registeredStudentIds]);

  // Key metrics
  const metrics = useMemo(() => {
    let universalCount = 0;
    let targetedCount = 0;
    let specialistCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;

    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const thirtyDaysStr = thirtyDaysFromNow.toISOString().slice(0, 10);

    for (const p of profiles) {
      if (p.tier === "universal") universalCount++;
      else if (p.tier === "targeted") targetedCount++;
      else if (p.tier === "specialist") specialistCount++;

      if (p.status === "active") {
        if (p.nextReviewDate < todayStr) {
          overdueCount++;
        } else if (p.nextReviewDate <= thirtyDaysStr) {
          dueSoonCount++;
        }
      }
    }

    return {
      total: profiles.length,
      universal: universalCount,
      targeted: targetedCount,
      specialist: specialistCount,
      overdue: overdueCount,
      dueSoon: dueSoonCount,
    };
  }, [profiles, todayStr]);

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    return profiles.filter(p => {
      const student = studentMap.get(p.studentId);
      const studentName = student ? student.name.toLowerCase() : "";
      const studentNum = student ? student.studentNumber.toLowerCase() : "";
      const matchesSearch = !search.trim() ||
        studentName.includes(search.toLowerCase()) ||
        studentNum.includes(search.toLowerCase()) ||
        p.primaryNeed.toLowerCase().includes(search.toLowerCase()) ||
        (p.secondaryNeeds && p.secondaryNeeds.toLowerCase().includes(search.toLowerCase()));

      if (!matchesSearch) return false;

      if (tierFilter === "all") return true;
      if (tierFilter === "overdue") return p.status === "active" && p.nextReviewDate < todayStr;
      return p.tier === tierFilter;
    });
  }, [profiles, studentMap, search, tierFilter, todayStr]);

  const handleCreateOrUpdateProfile = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const studentId = formData.get("studentId") as string;
    const tier = formData.get("tier") as "universal" | "targeted" | "specialist";
    const primaryNeed = (formData.get("primaryNeed") as string).trim();
    const secondaryNeeds = (formData.get("secondaryNeeds") as string)?.trim() || "";
    const supportPlanSummary = (formData.get("supportPlanSummary") as string).trim();
    const examAccessArrangements = (formData.get("examAccessArrangements") as string)?.trim() || "";
    const nextReviewDate = formData.get("nextReviewDate") as string;
    const reviewFrequencyWeeks = parseInt((formData.get("reviewFrequencyWeeks") as string) || "12", 10);
    const status = (formData.get("status") as string || "active") as "active" | "monitoring" | "graduated";

    onSaveCommand({
      kind: "sen_profile_save",
      profileId: editingProfile?.id,
      studentId: editingProfile ? editingProfile.studentId : studentId,
      tier,
      primaryNeed,
      secondaryNeeds: secondaryNeeds || undefined,
      supportPlanSummary,
      examAccessArrangements: examAccessArrangements || undefined,
      nextReviewDate,
      reviewFrequencyWeeks,
      status,
    });

    setIsAddingNew(false);
    setEditingProfile(null);
  };

  const handleCompleteReview = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStudentForReview) return;
    const formData = new FormData(event.currentTarget);
    const reviewDate = formData.get("reviewDate") as string;
    const reviewType = (formData.get("reviewType") as "termly" | "annual_ehcp" | "interim" | "emergency") || "termly";
    const attendees = (formData.get("attendees") as string).trim();
    const targetsMetSummary = (formData.get("targetsMetSummary") as string).trim();
    const newTargets = (formData.get("newTargets") as string).trim();
    const tierDecision = formData.get("tierDecision") as "universal" | "targeted" | "specialist";
    const nextReviewDate = formData.get("nextReviewDate") as string;
    const notes = (formData.get("notes") as string)?.trim() || "";

    onSaveCommand({
      kind: "sen_review_complete",
      profileId: selectedStudentForReview.id,
      reviewDate,
      reviewType,
      attendees,
      targetsMetSummary,
      newTargets,
      tierDecision,
      nextReviewDate,
      notes: notes || undefined,
    });

    setSelectedStudentForReview(null);
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards Header */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="border border-slate-200 bg-white p-4">
          <p className="text-xs uppercase font-medium text-slate-500">SEN Register</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.total} students</p>
          <p className="mt-1 text-xs text-slate-500">Active caseload</p>
        </div>
        <div className="border border-sky-200 bg-sky-50/50 p-4">
          <p className="text-xs uppercase font-semibold text-sky-800">Tier 1: Universal</p>
          <p className="mt-1 text-2xl font-bold text-sky-950">{metrics.universal}</p>
          <p className="mt-1 text-xs text-sky-700">Classroom adaptations</p>
        </div>
        <div className="border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-xs uppercase font-semibold text-amber-800">Tier 2: Targeted</p>
          <p className="mt-1 text-2xl font-bold text-amber-950">{metrics.targeted}</p>
          <p className="mt-1 text-xs text-amber-700">Targeted SEN support</p>
        </div>
        <div className="border border-purple-200 bg-purple-50/50 p-4">
          <p className="text-xs uppercase font-semibold text-purple-800">Tier 3: Specialist</p>
          <p className="mt-1 text-2xl font-bold text-purple-950">{metrics.specialist}</p>
          <p className="mt-1 text-xs text-purple-700">EHCP / Multi-agency</p>
        </div>
        <div className={`border p-4 ${metrics.overdue > 0 ? "border-red-300 bg-red-50 text-red-900" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          <p className="text-xs uppercase font-semibold">{metrics.overdue > 0 ? "Reviews Overdue" : "Review Schedule"}</p>
          <p className="mt-1 text-2xl font-bold">{metrics.overdue > 0 ? `${metrics.overdue} overdue` : "Up to date"}</p>
          <p className="mt-1 text-xs">{metrics.dueSoon} due in next 30 days</p>
        </div>
      </div>

      {/* Main Register Section */}
      <section className="border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Special Educational Needs Register & Reviews</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Manage multi-tiered support provisions, exam accommodations, and statutory review schedules.
            </p>
          </div>
          <button
            onClick={() => {
              setEditingProfile(null);
              setIsAddingNew(true);
            }}
            className={primaryBtn}
            disabled={isPending || availableStudents.length === 0}
          >
            <Plus size={16} /> Add student to register
          </button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500 mr-1 flex items-center gap-1">
              <Filter size={14} /> Filter:
            </span>
            {(
              [
                { id: "all", label: `All (${metrics.total})` },
                { id: "universal", label: `Universal (${metrics.universal})` },
                { id: "targeted", label: `Targeted (${metrics.targeted})` },
                { id: "specialist", label: `Specialist (${metrics.specialist})` },
                { id: "overdue", label: `Overdue (${metrics.overdue})` },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                onClick={() => setTierFilter(tab.id)}
                className={`min-h-9 px-3 py-1 font-medium transition-colors ${
                  tierFilter === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-64 max-w-sm flex-1">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by student name, number, or need..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-blue-600 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Profiles List */}
        <div className="space-y-4 pt-2">
          {filteredProfiles.map(profile => {
            const student = studentMap.get(profile.studentId);
            const tierMeta = TIER_META[profile.tier];
            const isOverdue = profile.status === "active" && profile.nextReviewDate < todayStr;
            const profileReviews = reviews.filter(r => r.profileId === profile.id);
            const isHistoryOpen = expandedHistoryId === profile.id;

            return (
              <article
                key={profile.id}
                className={`border p-4 transition-colors ${
                  isOverdue ? "border-red-300 bg-red-50/20" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-slate-900 text-base">
                        {student ? student.name : "Student"}
                      </h3>
                      <span className="font-mono text-xs text-slate-500">
                        ({student?.studentNumber ?? profile.studentId.slice(0, 8)})
                      </span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold border ${tierMeta.badge}`}>
                        {tierMeta.label}
                      </span>
                      {profile.status !== "active" && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-slate-100 text-slate-600 border border-slate-300 capitalize">
                          {profile.status}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      <strong>Primary Need:</strong> {profile.primaryNeed}
                      {profile.secondaryNeeds && ` · ${profile.secondaryNeeds}`}
                    </p>
                  </div>

                  {/* Review Due Banner & Quick Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-right mr-2">
                      <p className="text-xs font-semibold text-slate-500 uppercase">Statutory Review</p>
                      <p
                        className={`text-xs font-bold flex items-center gap-1 justify-end ${
                          isOverdue ? "text-red-700" : "text-slate-800"
                        }`}
                      >
                        {isOverdue && <AlertTriangle size={13} className="text-red-600" />}
                        {isOverdue ? `Overdue: ${profile.nextReviewDate}` : `Due: ${profile.nextReviewDate}`}
                      </p>
                    </div>

                    <button
                      onClick={() => setSelectedStudentForReview(profile)}
                      disabled={isPending}
                      className="min-h-9 border border-blue-600 bg-blue-50 px-3 text-xs font-semibold text-blue-800 hover:bg-blue-100 transition-colors inline-flex items-center gap-1.5"
                    >
                      <CheckCircle2 size={14} /> Log review
                    </button>
                    <button
                      onClick={() => setEditingProfile(profile)}
                      disabled={isPending}
                      className="min-h-9 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors inline-flex items-center gap-1.5"
                    >
                      <PenSquare size={14} /> Edit plan
                    </button>
                  </div>
                </div>

                {/* Accommodations & Support Plan Details */}
                <div className="mt-3 grid gap-3 pt-3 border-t border-slate-100 sm:grid-cols-2 text-xs">
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                      <BookOpen size={13} className="text-slate-500" /> Support Plan & Interventions:
                    </p>
                    <p className="text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {profile.supportPlanSummary}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-semibold text-slate-700 flex items-center gap-1">
                      <Award size={13} className="text-slate-500" /> Exam Access Arrangements:
                    </p>
                    {profile.examAccessArrangements ? (
                      <p className="text-slate-800 font-medium bg-slate-50 p-2 border border-slate-200">
                        {profile.examAccessArrangements}
                      </p>
                    ) : (
                      <p className="text-slate-400 italic">None recorded (Standard arrangements)</p>
                    )}
                  </div>
                </div>

                {/* Past Reviews Toggle */}
                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Review cycle: Every {profile.reviewFrequencyWeeks} weeks · {profileReviews.length} past reviews recorded
                  </span>
                  {profileReviews.length > 0 && (
                    <button
                      onClick={() => setExpandedHistoryId(isHistoryOpen ? null : profile.id)}
                      className="text-blue-700 hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <History size={13} />
                      {isHistoryOpen ? "Hide review history" : "View review history"}
                      {isHistoryOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                  )}
                </div>

                {/* Review History Details */}
                {isHistoryOpen && profileReviews.length > 0 && (
                  <div className="mt-3 space-y-2 border-t border-dashed border-slate-200 pt-3">
                    <h4 className="font-semibold text-xs text-slate-700 uppercase tracking-wide">
                      Review Chronology:
                    </h4>
                    {profileReviews.map(r => (
                      <div key={r.id} className="bg-slate-50 border border-slate-200 p-2.5 text-xs space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-1 text-slate-700">
                          <span className="font-bold">
                            {r.reviewDate} · {r.reviewType.replace("_", " ").toUpperCase()}
                          </span>
                          <span className="text-slate-500">
                            Attendees: {r.attendees}
                          </span>
                        </div>
                        <p><strong>Targets Met / Progress:</strong> {r.targetsMetSummary}</p>
                        <p><strong>Next Cycle Targets:</strong> {r.newTargets}</p>
                        <p><strong>Tier Decision:</strong> <span className="capitalize font-medium">{r.tierDecision}</span> · Next review set for: {r.nextReviewDate}</p>
                        {r.notes && <p className="text-slate-500 italic">Notes: {r.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            );
          })}

          {filteredProfiles.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500">
              No students found matching the selected filter or search query.
            </div>
          )}
        </div>
      </section>

      {/* Add or Edit Profile Modal */}
      {(isAddingNew || editingProfile) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-300 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProfile ? "Edit SEN Profile & Support Plan" : "Add Student to SEN Register"}
              </h3>
              <button
                onClick={() => {
                  setIsAddingNew(false);
                  setEditingProfile(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdateProfile} className="space-y-4">
              {!editingProfile && (
                <label className="block text-sm font-medium text-slate-900">
                  Student
                  <select name="studentId" required className={inputClasses} defaultValue="">
                    <option value="">Choose a student</option>
                    {availableStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.studentNumber})
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {editingProfile && (
                <div className="bg-slate-50 p-3 border border-slate-200 text-sm">
                  <p className="font-semibold text-slate-900">
                    {studentMap.get(editingProfile.studentId)?.name ?? "Student"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Student ID: {editingProfile.studentId}
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-900">
                  Support Tier
                  <select
                    name="tier"
                    required
                    defaultValue={editingProfile?.tier ?? "targeted"}
                    className={inputClasses}
                  >
                    <option value="universal">Tier 1: Universal Provision</option>
                    <option value="targeted">Tier 2: Targeted Support</option>
                    <option value="specialist">Tier 3: Specialist (EHCP)</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-900">
                  Primary Area of Need
                  <input
                    name="primaryNeed"
                    required
                    defaultValue={editingProfile?.primaryNeed ?? ""}
                    placeholder="e.g. Cognition & Learning, SEMH, Speech & Language"
                    className={inputClasses}
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-900">
                Secondary Needs / Diagnoses (Optional)
                <input
                  name="secondaryNeeds"
                  defaultValue={editingProfile?.secondaryNeeds ?? ""}
                  placeholder="e.g. Dyslexia, ADHD, Sensory processing, Anxiety"
                  className={inputClasses}
                />
              </label>

              <label className="block text-sm font-medium text-slate-900">
                Support Plan Summary & Classroom Interventions
                <textarea
                  name="supportPlanSummary"
                  required
                  rows={3}
                  defaultValue={editingProfile?.supportPlanSummary ?? ""}
                  placeholder="Outline high-impact adjustments: e.g. 1-to-1 reading support 2x weekly, quiet breakout space, visual schedule, chunked task instructions..."
                  className={inputClasses}
                />
              </label>

              <label className="block text-sm font-medium text-slate-900">
                Exam Access Arrangements & Accommodations
                <input
                  name="examAccessArrangements"
                  defaultValue={editingProfile?.examAccessArrangements ?? ""}
                  placeholder="e.g. 25% Extra Time, Rest Breaks, Reader Pen, Separate Room"
                  className={inputClasses}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block text-sm font-medium text-slate-900">
                  Review Frequency
                  <select
                    name="reviewFrequencyWeeks"
                    defaultValue={editingProfile?.reviewFrequencyWeeks ?? 12}
                    className={inputClasses}
                  >
                    <option value={6}>Half-termly (6 weeks)</option>
                    <option value={12}>Termly (12 weeks)</option>
                    <option value={24}>Bi-annually (24 weeks)</option>
                    <option value={52}>Annually / EHCP (52 weeks)</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-900">
                  Next Scheduled Review Date
                  <input
                    type="date"
                    name="nextReviewDate"
                    required
                    defaultValue={editingProfile?.nextReviewDate ?? todayStr}
                    className={inputClasses}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-900">
                  Profile Status
                  <select
                    name="status"
                    defaultValue={editingProfile?.status ?? "active"}
                    className={inputClasses}
                  >
                    <option value="active">Active</option>
                    <option value="monitoring">Monitoring</option>
                    <option value="graduated">Graduated / Exited</option>
                  </select>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingProfile(null);
                  }}
                  className={secondaryBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className={primaryBtn}>
                  {editingProfile ? "Save profile changes" : "Create SEN profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Complete Review Modal */}
      {selectedStudentForReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-slate-300 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Log Statutory SEN Review
                </h3>
                <p className="text-xs text-slate-500">
                  Student: {studentMap.get(selectedStudentForReview.studentId)?.name ?? "Student"} · Current: {TIER_META[selectedStudentForReview.tier].label}
                </p>
              </div>
              <button
                onClick={() => setSelectedStudentForReview(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCompleteReview} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-900">
                  Review Meeting Date
                  <input
                    type="date"
                    name="reviewDate"
                    required
                    defaultValue={todayStr}
                    className={inputClasses}
                  />
                </label>

                <label className="block text-sm font-medium text-slate-900">
                  Review Type
                  <select name="reviewType" defaultValue="termly" className={inputClasses}>
                    <option value="termly">Termly Progress Review</option>
                    <option value="annual_ehcp">Statutory Annual EHCP Review</option>
                    <option value="interim">Interim Review</option>
                    <option value="emergency">Emergency / Exceptional Review</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-900">
                Attendees Present
                <input
                  name="attendees"
                  required
                  placeholder="e.g. Dr. Arthur Bell (SENCO), Mrs. Davies (Teacher), Mr. & Mrs. Doe (Guardians), Student"
                  className={inputClasses}
                />
              </label>

              <label className="block text-sm font-medium text-slate-900">
                Targets Met & Progress Review
                <textarea
                  name="targetsMetSummary"
                  required
                  rows={3}
                  placeholder="Document progress against previous targets, interventions evaluated, reading/maths age improvements, and classroom observations..."
                  className={inputClasses}
                />
              </label>

              <label className="block text-sm font-medium text-slate-900">
                New SMART Targets for Next Cycle
                <textarea
                  name="newTargets"
                  required
                  rows={3}
                  placeholder="Set measurable targets: e.g. Achieve 85% accuracy on phonics list 4; complete 15-minute independent writing using graphic organizer..."
                  className={inputClasses}
                />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-900">
                  Tier Decision
                  <select
                    name="tierDecision"
                    required
                    defaultValue={selectedStudentForReview.tier}
                    className={inputClasses}
                  >
                    <option value="universal">Tier 1: Universal Provision</option>
                    <option value="targeted">Tier 2: Targeted Support</option>
                    <option value="specialist">Tier 3: Specialist (EHCP)</option>
                  </select>
                </label>

                <label className="block text-sm font-medium text-slate-900">
                  Next Scheduled Review Date
                  <input
                    type="date"
                    name="nextReviewDate"
                    required
                    defaultValue={(() => {
                      const d = new Date();
                      d.setDate(d.getDate() + (selectedStudentForReview.reviewFrequencyWeeks || 12) * 7);
                      return d.toISOString().slice(0, 10);
                    })()}
                    className={inputClasses}
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-slate-900">
                Additional Notes / External Agency Updates (Optional)
                <input
                  name="notes"
                  placeholder="e.g. Educational Psychologist report pending, Speech Therapy referral submitted..."
                  className={inputClasses}
                />
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSelectedStudentForReview(null)}
                  className={secondaryBtn}
                >
                  Cancel
                </button>
                <button type="submit" disabled={isPending} className={primaryBtn}>
                  Complete and record review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
