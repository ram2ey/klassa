"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Plus,
  Send,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  User,
  GraduationCap,
  Clock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  submitGuardianInquiryAction,
  replyGuardianInquiryAction,
  resolveGuardianInquiryAction,
} from "@/app/actions/guardian-inquiry-actions";
import { formatGMTDateTime } from "@/lib/timezone";

export type GuardianInquiryStudent = {
  id: string;
  firstName: string;
  lastName: string;
  schoolId: string;
  schoolName: string;
};

export type InquiryMessageItem = {
  id: string;
  senderType: "guardian" | "teacher" | "school_admin" | "office_staff";
  senderName: string;
  message: string;
  createdAt: Date | string;
};

export type GuardianInquiryRecord = {
  id: string;
  studentId: string;
  studentName: string;
  schoolId: string;
  schoolName: string;
  targetRole: string;
  title: string;
  category: "academic" | "pastoral" | "attendance" | "general";
  status: "open" | "in_progress" | "resolved";
  closedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  messages: InquiryMessageItem[];
};

interface GuardianInquiriesPanelProps {
  students: GuardianInquiryStudent[];
  inquiries: GuardianInquiryRecord[];
}

const categoryLabels: Record<GuardianInquiryRecord["category"], string> = {
  academic: "Academic Progress & Homework",
  pastoral: "Pastoral Care & Wellbeing",
  attendance: "Attendance Follow-up",
  general: "General Inquiry",
};

const categoryBadgeColors: Record<GuardianInquiryRecord["category"], string> = {
  academic: "border-blue-200 bg-blue-50 text-blue-800",
  pastoral: "border-purple-200 bg-purple-50 text-purple-800",
  attendance: "border-amber-200 bg-amber-50 text-amber-800",
  general: "border-slate-200 bg-slate-100 text-slate-700",
};

const statusBadgeColors: Record<GuardianInquiryRecord["status"], string> = {
  open: "border-emerald-200 bg-emerald-50 text-emerald-800",
  in_progress: "border-sky-200 bg-sky-50 text-sky-800",
  resolved: "border-slate-200 bg-slate-100 text-slate-600",
};

export function GuardianInquiriesPanel({
  students,
  inquiries,
}: GuardianInquiriesPanelProps) {
  const router = useRouter();
  const [showNewForm, setShowNewForm] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    inquiries[0]?.id ?? null
  );
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved">(
    "all"
  );
  const [replyTextMap, setReplyTextMap] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  if (!students.length) return null;

  const filteredInquiries = inquiries.filter((inq) => {
    if (filterStatus === "active") return inq.status !== "resolved";
    if (filterStatus === "resolved") return inq.status === "resolved";
    return true;
  });

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    const form = new FormData(e.currentTarget);
    const studentId = String(form.get("studentId") ?? "");
    const targetRole = String(form.get("targetRole") ?? "teacher") as
      | "teacher"
      | "school_admin";
    const category = String(form.get("category") ?? "academic") as
      | "academic"
      | "pastoral"
      | "attendance"
      | "general";
    const title = String(form.get("title") ?? "").trim();
    const message = String(form.get("message") ?? "").trim();

    startTransition(async () => {
      const result = await submitGuardianInquiryAction({
        studentId,
        targetRole,
        category,
        title,
        message,
      });

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      setFormSuccess("Inquiry sent successfully.");
      setShowNewForm(false);
      setExpandedId(result.inquiryId);
      router.refresh();
    });
  };

  const handleReplySubmit = (inquiryId: string) => {
    const text = (replyTextMap[inquiryId] ?? "").trim();
    if (!text) return;
    setFormError("");

    startTransition(async () => {
      const result = await replyGuardianInquiryAction({
        inquiryId,
        message: text,
      });

      if (!result.success) {
        setFormError(result.error);
        return;
      }

      setReplyTextMap((prev) => ({ ...prev, [inquiryId]: "" }));
      router.refresh();
    });
  };

  const handleResolve = (inquiryId: string) => {
    setFormError("");
    startTransition(async () => {
      const result = await resolveGuardianInquiryAction(inquiryId);
      if (!result.success) {
        setFormError(result.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <section className="border border-slate-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5">
        <div>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-700" />
            <h2 className="text-lg font-bold">School Inquiries & Messages</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Direct two-way messaging with your students&apos; teachers and school administration.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            setShowNewForm(!showNewForm);
            setFormError("");
            setFormSuccess("");
          }}
          className="min-h-10 gap-1.5"
        >
          {showNewForm ? "Cancel" : <><Plus className="h-4 w-4" /> New inquiry</>}
        </Button>
      </div>

      {formSuccess && (
        <div role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-3 text-sm font-medium text-emerald-800">
          {formSuccess}
        </div>
      )}

      {/* New Inquiry Form */}
      {showNewForm && (
        <form onSubmit={handleCreateSubmit} className="border-b border-slate-200 bg-slate-50/70 p-5 space-y-4">
          <h3 className="font-semibold text-slate-900">Start a new inquiry</h3>
          {formError && (
            <div role="alert" className="border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {formError}
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="inquiry-student" className="block text-sm font-medium text-slate-700">
                Student <span className="text-rose-600">*</span>
              </label>
              <select
                id="inquiry-student"
                name="studentId"
                required
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} · {s.schoolName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inquiry-category" className="block text-sm font-medium text-slate-700">
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                id="inquiry-category"
                name="category"
                required
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
              >
                <option value="academic">Academic Progress & Homework</option>
                <option value="pastoral">Pastoral Care & Wellbeing</option>
                <option value="attendance">Attendance & Absence Follow-up</option>
                <option value="general">General School Inquiry</option>
              </select>
            </div>
            <div>
              <label htmlFor="inquiry-recipient" className="block text-sm font-medium text-slate-700">
                Send to <span className="text-rose-600">*</span>
              </label>
              <select
                id="inquiry-recipient"
                name="targetRole"
                required
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
              >
                <option value="teacher">Homeroom / Subject Teacher</option>
                <option value="school_admin">School Administration / Office</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="inquiry-title" className="block text-sm font-medium text-slate-700">
              Subject / Topic <span className="text-rose-600">*</span>
            </label>
            <input
              id="inquiry-title"
              name="title"
              type="text"
              required
              minLength={3}
              maxLength={180}
              placeholder="e.g. Clarification on reading assignment deadline"
              className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
            />
          </div>
          <div>
            <label htmlFor="inquiry-message" className="block text-sm font-medium text-slate-700">
              Initial Message <span className="text-rose-600">*</span>
            </label>
            <textarea
              id="inquiry-message"
              name="message"
              required
              minLength={5}
              maxLength={5000}
              rows={4}
              placeholder="Please provide details about your inquiry..."
              className="mt-1 block min-h-28 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              className="min-h-11"
              disabled={pending}
              onClick={() => setShowNewForm(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-11 gap-1.5" disabled={pending}>
              <Send className="h-4 w-4" />
              {pending ? "Sending..." : "Submit inquiry"}
            </Button>
          </div>
        </form>
      )}

      {/* Filter Tabs & Inquiries List */}
      <div className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFilterStatus("all")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filterStatus === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All ({inquiries.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("active")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filterStatus === "active"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Active ({inquiries.filter((i) => i.status !== "resolved").length})
            </button>
            <button
              type="button"
              onClick={() => setFilterStatus("resolved")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                filterStatus === "resolved"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Resolved ({inquiries.filter((i) => i.status === "resolved").length})
            </button>
          </div>
        </div>

        {filteredInquiries.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-2 text-sm font-medium">No inquiries found</p>
            <p className="mt-1 text-xs text-slate-400">
              {inquiries.length === 0
                ? "Start a new conversation with your student's teachers above."
                : "No inquiries match the selected filter."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInquiries.map((inq) => {
              const isExpanded = expandedId === inq.id;
              const replyText = replyTextMap[inq.id] ?? "";
              const lastMessage = inq.messages[inq.messages.length - 1];

              return (
                <article
                  key={inq.id}
                  className="rounded-lg border border-slate-200 bg-white transition hover:border-slate-300"
                >
                  <header
                    onClick={() => setExpandedId(isExpanded ? null : inq.id)}
                    className="flex cursor-pointer flex-wrap items-center justify-between gap-3 p-4 sm:p-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">{inq.studentName}</span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500">{inq.schoolName}</span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-medium ${
                            categoryBadgeColors[inq.category]
                          }`}
                        >
                          {categoryLabels[inq.category]}
                        </span>
                        <span
                          className={`rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                            statusBadgeColors[inq.status]
                          }`}
                        >
                          {inq.status === "in_progress" ? "Staff replied" : inq.status}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-slate-900">{inq.title}</h3>
                      {lastMessage && !isExpanded && (
                        <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {lastMessage.senderType === "guardian" ? "You" : lastMessage.senderName}:
                          </span>{" "}
                          {lastMessage.message}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span className="hidden sm:inline">
                        {inq.messages.length} {inq.messages.length === 1 ? "message" : "messages"}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-slate-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-slate-400" />
                      )}
                    </div>
                  </header>

                  {/* Conversation Thread */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 bg-slate-50/50 p-4 sm:p-5">
                      <div className="space-y-3">
                        {inq.messages.map((msg) => {
                          const isGuardian = msg.senderType === "guardian";
                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${
                                isGuardian ? "items-end" : "items-start"
                              }`}
                            >
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
                                {!isGuardian && (
                                  <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-semibold text-blue-800">
                                    <GraduationCap className="h-3 w-3" />
                                    {msg.senderType === "teacher" ? "Teacher" : "School Office"}
                                  </span>
                                )}
                                <span className="font-semibold text-slate-700">
                                  {isGuardian ? "You" : msg.senderName}
                                </span>
                                <span>·</span>
                                <time className="text-[11px]">
                                  {formatGMTDateTime(msg.createdAt)}
                                </time>
                              </div>
                              <div
                                className={`max-w-2xl whitespace-pre-wrap rounded-lg p-3 text-sm shadow-2xs ${
                                  isGuardian
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

                      {/* Reply Box & Status Action */}
                      <div className="mt-5 border-t border-slate-200 pt-4">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <label
                            htmlFor={`reply-${inq.id}`}
                            className="text-xs font-semibold text-slate-700"
                          >
                            Reply to thread
                          </label>
                          {inq.status !== "resolved" ? (
                            <button
                              type="button"
                              onClick={() => handleResolve(inq.id)}
                              disabled={pending}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-emerald-700 hover:underline"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                              Mark as resolved
                            </button>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                              <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" />
                              Resolved
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <textarea
                            id={`reply-${inq.id}`}
                            value={replyText}
                            onChange={(e) =>
                              setReplyTextMap((prev) => ({
                                ...prev,
                                [inq.id]: e.target.value,
                              }))
                            }
                            rows={2}
                            placeholder="Write your follow-up reply..."
                            className="min-h-11 flex-1 border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600"
                          />
                          <Button
                            type="button"
                            onClick={() => handleReplySubmit(inq.id)}
                            disabled={pending || !replyText.trim()}
                            className="min-h-11 self-end gap-1.5"
                          >
                            <Send className="h-4 w-4" />
                            <span className="hidden sm:inline">Send</span>
                          </Button>
                        </div>
                        {inq.status === "resolved" && (
                          <p className="mt-2 text-xs text-slate-500">
                            Note: Sending a new message will automatically reopen this inquiry.
                          </p>
                        )}
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
