"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Search,
  Send,
  CheckCircle2,
  Clock,
  User,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  replyStaffInquiryAction,
  updateStaffInquiryStatusAction,
} from "@/app/actions/guardian-inquiry-actions";
import { formatGMTDateTime } from "@/lib/timezone";
import type { SerializedGuardianInquiry } from "@/lib/guardian-inquiry-service";

interface StaffInquiryListProps {
  inquiries: SerializedGuardianInquiry[];
  title?: string;
  description?: string;
  onOpenStudentDrawer?: (studentId: string) => void;
  isAdmin?: boolean;
}

const categoryLabels: Record<SerializedGuardianInquiry["category"], string> = {
  academic: "Academic Progress",
  pastoral: "Pastoral & Wellbeing",
  attendance: "Attendance Follow-up",
  general: "General Inquiry",
};

const categoryBadgeColors: Record<SerializedGuardianInquiry["category"], string> = {
  academic: "border-blue-200 bg-blue-50 text-blue-800",
  pastoral: "border-purple-200 bg-purple-50 text-purple-800",
  attendance: "border-amber-200 bg-amber-50 text-amber-800",
  general: "border-slate-200 bg-slate-100 text-slate-700",
};

export function StaffInquiryList({
  inquiries,
  title = "Guardian Inquiries & Communications",
  description = "Direct two-way message threads and inquiries submitted by verified guardians.",
  onOpenStudentDrawer,
  isAdmin = false,
}: StaffInquiryListProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "resolved" | "all">("active");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(inquiries[0]?.id ?? null);
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const openCount = inquiries.filter((i) => i.status === "open").length;

  const filtered = inquiries.filter((inq) => {
    if (statusFilter === "active" && inq.status === "resolved") return false;
    if (statusFilter === "resolved" && inq.status !== "resolved") return false;
    if (categoryFilter !== "all" && inq.category !== categoryFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchStudent = inq.studentName.toLowerCase().includes(q);
      const matchGuardian = inq.guardianName.toLowerCase().includes(q);
      const matchTitle = inq.title.toLowerCase().includes(q);
      const matchClass = inq.className.toLowerCase().includes(q);
      if (!matchStudent && !matchGuardian && !matchTitle && !matchClass) return false;
    }

    return true;
  });

  const handleReplySubmit = (inquiryId: string) => {
    const text = (replyTextMap[inquiryId] ?? "").trim();
    if (!text) return;
    setActionError("");
    setActionSuccess("");

    startTransition(async () => {
      const result = await replyStaffInquiryAction({
        inquiryId,
        message: text,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setActionSuccess("Reply sent to guardian.");
      setReplyTextMap((prev) => ({ ...prev, [inquiryId]: "" }));
      router.refresh();
    });
  };

  const handleStatusChange = (inquiryId: string, status: "open" | "in_progress" | "resolved") => {
    setActionError("");
    setActionSuccess("");

    startTransition(async () => {
      const result = await updateStaffInquiryStatusAction({
        inquiryId,
        status,
      });

      if (!result.success) {
        setActionError(result.error);
        return;
      }

      setActionSuccess(`Inquiry marked as ${status.replace("_", " ")}.`);
      router.refresh();
    });
  };

  return (
    <section className="border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-700" />
              <h2 className="text-lg font-bold">{title}</h2>
              {openCount > 0 && (
                <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-xs font-bold text-white">
                  {openCount} action required
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
        </div>

        {actionSuccess && (
          <p role="status" className="mt-3 border border-emerald-200 bg-emerald-50 p-2 text-xs font-medium text-emerald-800">
            {actionSuccess}
          </p>
        )}
        {actionError && (
          <p role="alert" className="mt-3 border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-800">
            {actionError}
          </p>
        )}

        {/* Filters bar */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                statusFilter === "active"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Active ({inquiries.filter((i) => i.status !== "resolved").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("resolved")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                statusFilter === "resolved"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Resolved ({inquiries.filter((i) => i.status === "resolved").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                statusFilter === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({inquiries.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
            >
              <option value="all">All categories</option>
              <option value="academic">Academic Progress</option>
              <option value="pastoral">Pastoral & Wellbeing</option>
              <option value="attendance">Attendance Follow-up</option>
              <option value="general">General Inquiry</option>
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student or topic…"
                className="min-h-9 border border-slate-300 bg-white pl-8 pr-3 py-1 text-xs focus:border-blue-600"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Inquiry List */}
      <div className="p-5">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-medium">No inquiries found</p>
            <p className="mt-1 text-xs text-slate-400">
              {inquiries.length === 0
                ? "No guardian inquiries have been submitted yet."
                : "No inquiries match the current search or status filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((inq) => {
              const isExpanded = expandedId === inq.id;
              const replyText = replyTextMap[inq.id] ?? "";
              const lastMessage = inq.messages[inq.messages.length - 1];

              return (
                <article
                  key={inq.id}
                  className={`rounded-lg border transition ${
                    inq.status === "open"
                      ? "border-rose-200 bg-rose-50/10"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <header
                    onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                    className="flex cursor-pointer flex-wrap items-start justify-between gap-3 p-4 sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {onOpenStudentDrawer ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenStudentDrawer(inq.studentId);
                            }}
                            className="font-bold text-blue-900 hover:text-blue-700 hover:underline"
                          >
                            {inq.studentName}
                          </button>
                        ) : (
                          <strong className="font-bold text-slate-900">{inq.studentName}</strong>
                        )}
                        {inq.studentNumber && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600">
                            {inq.studentNumber}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">·</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                          {inq.className}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                            categoryBadgeColors[inq.category]
                          }`}
                        >
                          {categoryLabels[inq.category]}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            inq.status === "open"
                              ? "border-rose-300 bg-rose-50 text-rose-800"
                              : inq.status === "in_progress"
                              ? "border-sky-200 bg-sky-50 text-sky-800"
                              : "border-slate-200 bg-slate-100 text-slate-600"
                          }`}
                        >
                          {inq.status === "open" ? "Needs reply" : inq.status.replace("_", " ")}
                        </span>
                      </div>

                      <h3 className="mt-2 text-base font-semibold text-slate-900">{inq.title}</h3>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span>
                          From: <strong>{inq.guardianName}</strong>
                        </span>
                        {inq.guardianPhone && (
                          <a
                            href={`tel:${inq.guardianPhone}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          >
                            <Phone className="h-3 w-3" />
                            {inq.guardianPhone}
                          </a>
                        )}
                        {inq.guardianEmail && (
                          <a
                            href={`mailto:${inq.guardianEmail}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-blue-700 hover:underline"
                          >
                            <Mail className="h-3 w-3" />
                            {inq.guardianEmail}
                          </a>
                        )}
                        <span>·</span>
                        <time className="text-slate-400">
                          Updated {formatGMTDateTime(inq.updatedAt)}
                        </time>
                      </div>

                      {lastMessage && !isExpanded && (
                        <p className="mt-2 line-clamp-1 text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{lastMessage.senderName}:</span>{" "}
                          {lastMessage.message}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{inq.messages.length} msg</span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </header>

                  {/* Expanded Conversation */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                      <div className="space-y-3">
                        {inq.messages.map((msg) => {
                          const isStaff = msg.senderType !== "guardian";
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${
                                isStaff ? "items-end" : "items-start"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                                <span className="font-semibold text-slate-700">
                                  {msg.senderName}
                                </span>
                                {isStaff && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-semibold text-blue-800">
                                    <GraduationCap className="h-3 w-3" />
                                    Staff
                                  </span>
                                )}
                                <span>·</span>
                                <time className="text-[11px]">
                                  {formatGMTDateTime(msg.createdAt)}
                                </time>
                              </div>
                              <div
                                className={`max-w-2xl whitespace-pre-wrap rounded-lg p-3 text-sm shadow-2xs ${
                                  isStaff
                                    ? "bg-blue-600 text-white rounded-br-none"
                                    : "border border-slate-200 bg-white text-slate-800 rounded-bl-none"
                                }`}
                              >
                                {msg.message}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Reply Box and Status Actions */}
                      <div className="mt-5 border-t border-slate-200 pt-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <label
                            htmlFor={`staff-reply-${inq.id}`}
                            className="text-xs font-semibold text-slate-700"
                          >
                            Reply to {inq.guardianName}
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {inq.status === "open" && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(inq.id, "in_progress")}
                                disabled={pending}
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Mark as in progress
                              </button>
                            )}
                            {inq.status !== "resolved" ? (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(inq.id, "resolved")}
                                disabled={pending}
                                className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                Mark as resolved
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(inq.id, "open")}
                                disabled={pending}
                                className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                Reopen inquiry
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <textarea
                            id={`staff-reply-${inq.id}`}
                            value={replyText}
                            onChange={(e) =>
                              setReplyTextMap((prev) => ({
                                ...prev,
                                [inq.id]: e.target.value,
                              }))
                            }
                            rows={3}
                            placeholder="Write your reply to the guardian..."
                            className="min-h-14 flex-1 border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
                          />
                          <Button
                            type="button"
                            onClick={() => handleReplySubmit(inq.id)}
                            disabled={pending || !replyText.trim()}
                            className="min-h-14 self-end gap-1.5"
                          >
                            <Send className="h-4 w-4" />
                            <span>Reply</span>
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
