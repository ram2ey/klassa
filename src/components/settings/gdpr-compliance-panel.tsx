"use client";

import { useState, useTransition } from "react";
import {
  ShieldCheck, DownloadSimple, UserMinus, Prohibit, Plus,
  FileText, WarningOctagon, X,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  GdprRequestRecord,
  StudentDataPortabilityPackage,
} from "@/lib/gdpr";
import {
  submitGdprRequestAction,
  executeExportPackageAction,
  executeAnonymizeStudentAction,
  toggleProcessingRestrictionAction,
} from "@/app/actions/gdpr-actions";

interface GdprCompliancePanelProps {
  currentUserId: string;
  currentUserRole: string;
  requests: GdprRequestRecord[];
  students: Array<{ id: string; firstName: string; lastName: string; dateOfBirth: string }>;
  onRequestCreated: (req: GdprRequestRecord) => void;
  onStudentAnonymized: (studentId: string, updated: { firstName: string; lastName: string; dateOfBirth: string; status: "Active" | "Pending" | "Withdrawn" }) => void;
}

export function GdprCompliancePanel({
  currentUserId,
  currentUserRole,
  requests,
  students,
  onRequestCreated,
  onStudentAnonymized,
}: GdprCompliancePanelProps) {
  const [localRequests, setLocalRequests] = useState<GdprRequestRecord[]>(requests);
  const [selectedPackage, setSelectedPackage] = useState<StudentDataPortabilityPackage | null>(null);
  const [showNewRequestDialog, setShowNewRequestDialog] = useState(false);
  const [showAnonymizeDialog, setShowAnonymizeDialog] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id || "");
  const [anonymizeJustification, setAnonymizeJustification] = useState("");
  const [anonymizeError, setAnonymizeError] = useState("");
  const [isPending, startTransition] = useTransition();

  // New Request Form State
  const [newStudentId, setNewStudentId] = useState(students[0]?.id || "");
  const [newRequestType, setNewRequestType] = useState<"export" | "rectify" | "anonymize" | "restrict">("export");
  const [newRequesterName, setNewRequesterName] = useState("");
  const [newRequesterRole, setNewRequesterRole] = useState("guardian");
  const [newRequesterEmail, setNewRequesterEmail] = useState("");
  const [newJustification, setNewJustification] = useState("");
  const [formError, setFormError] = useState("");

  const handleExportDossier = (studentId: string, studentName: string) => {
    startTransition(async () => {
      const res = await executeExportPackageAction(
        studentId,
        studentName,
        currentUserRole === "guardian" ? "guardian" : "school_admin",
        currentUserId
      );
      if (res.success && res.dossier) {
        setSelectedPackage(res.dossier);
      }
    });
  };

  const handleCreateRequest = () => {
    setFormError("");
    const targetStudent = students.find((s) => s.id === newStudentId);
    const studentName = targetStudent ? `${targetStudent.firstName} ${targetStudent.lastName}` : "Unknown Student";

    startTransition(async () => {
      const res = await submitGdprRequestAction(
        {
          studentId: newStudentId,
          studentName,
          requestType: newRequestType,
          requesterName: newRequesterName,
          requesterRole: newRequesterRole,
          requesterEmail: newRequesterEmail,
          justification: newJustification,
        },
        currentUserId
      );

      if (res.success && res.request) {
        setLocalRequests((prev) => [res.request, ...prev]);
        onRequestCreated(res.request);
        setShowNewRequestDialog(false);
        setNewRequesterName("");
        setNewRequesterEmail("");
        setNewJustification("");
      } else {
        setFormError(res.error || "Failed to submit request.");
      }
    });
  };

  const handleExecuteAnonymization = () => {
    setAnonymizeError("");
    const targetStudent = students.find((s) => s.id === selectedStudentId);
    if (!targetStudent) return;

    startTransition(async () => {
      const res = await executeAnonymizeStudentAction(
        targetStudent,
        anonymizeJustification,
        currentUserRole,
        currentUserId
      );

      if (res.success && res.anonymizedStudent) {
        onStudentAnonymized(targetStudent.id, res.anonymizedStudent);
        setShowAnonymizeDialog(false);
        setAnonymizeJustification("");
      } else {
        setAnonymizeError(res.error || "Anonymization failed.");
      }
    });
  };

  const handleToggleRestriction = (studentId: string, currentlyRestricted: boolean) => {
    startTransition(async () => {
      const res = await toggleProcessingRestrictionAction(
        studentId,
        !currentlyRestricted,
        "Parental request to freeze communications processing under GDPR Article 18.",
        currentUserId
      );
      if (res.success) {
        setLocalRequests((prev) =>
          prev.map((r) =>
            r.studentId === studentId && r.requestType === "restrict"
              ? { ...r, isProcessingRestricted: res.isRestricted }
              : r
          )
        );
      }
    });
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "export":
        return <Badge tone="blue">Article 20 Portability</Badge>;
      case "anonymize":
        return <Badge tone="amber" className="border-rose-300 bg-rose-50 text-rose-800">Article 17 Erasure</Badge>;
      case "restrict":
        return <Badge tone="amber">Article 18 Restriction</Badge>;
      case "rectify":
        return <Badge tone="slate">Article 16 Rectify</Badge>;
      default:
        return <Badge tone="slate">{type}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge tone="green">Completed & Audited</Badge>;
      case "in_review":
        return <Badge tone="amber">In Legal Review</Badge>;
      default:
        return <Badge tone="slate">Pending Processing</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* GDPR Overview Banner */}
      <div className="flex items-start justify-between rounded-xs border border-slate-300 bg-white p-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-700" weight="bold" />
            <h2 className="text-base font-bold text-slate-900">
              GDPR & Statutory Data Protection Management (Articles 15–20)
            </h2>
            <span className="rounded-xs border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              EU 2016/679 & UK DPA 2018
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Fulfill and audit student data portability requests, process rectification notices, manage processing restrictions, and execute irreversible PII anonymization while preserving statutory academic retention marks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAnonymizeDialog(true)}
            className="gap-1.5 text-xs text-rose-800 hover:bg-rose-50"
          >
            <UserMinus size={14} weight="bold" />
            Article 17 Erasure
          </Button>

          <Button
            size="sm"
            onClick={() => setShowNewRequestDialog(true)}
            className="gap-1.5 text-xs"
          >
            <Plus size={14} weight="bold" />
            New Data Subject Request
          </Button>
        </div>
      </div>

      {/* Statutory Safeguarding Non-Disclosure Advisory */}
      <div className="border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950 space-y-1 rounded-xs">
        <div className="flex items-center gap-2 font-bold">
          <FileText size={16} className="text-blue-700" weight="bold" />
          <span>Statutory Safeguarding Non-Disclosure Enforcement</span>
        </div>
        <p className="text-[11px] text-blue-900 leading-relaxed">
          Pursuant to UK DPA 2018 Schedule 2 and EU GDPR Recital 38, confidential child safeguarding case files, clinical medical diagnoses, and disciplinary investigation notes are <strong>automatically redacted</strong> from parental portability packages to prevent child endangerment.
        </p>
      </div>

      {/* Requests Ledger */}
      <section className="border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="font-bold text-xs uppercase tracking-wider text-slate-700">
            Data Subject Rights Audit Ledger ({localRequests.length})
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase text-slate-500">
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5">Request Type</th>
                <th className="px-4 py-2.5">Requester & Role</th>
                <th className="px-4 py-2.5">Justification</th>
                <th className="px-4 py-2.5">Safeguarding Shield</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {localRequests.map((req) => (
                <tr key={req.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{req.studentName}</td>
                  <td className="px-4 py-3">{getTypeBadge(req.requestType)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{req.requesterName}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{req.requesterEmail} ({req.requesterRole})</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={req.justification}>
                    {req.justification}
                  </td>
                  <td className="px-4 py-3">
                    {req.safeguardingRedacted ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 border border-amber-200">
                        <ShieldCheck size={12} weight="bold" /> Redacted
                      </span>
                    ) : (
                      <span className="text-slate-400 text-[11px]">N/A</span>
                    )}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(req.status)}</td>
                  <td className="px-4 py-3 text-right space-x-1.5">
                    {req.requestType === "export" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleExportDossier(req.studentId, req.studentName)}
                        disabled={isPending}
                        className="gap-1 text-[11px] h-7"
                      >
                        <DownloadSimple size={12} weight="bold" />
                        Export JSON
                      </Button>
                    )}

                    {req.requestType === "restrict" && (
                      <Button
                        variant={req.isProcessingRestricted ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => handleToggleRestriction(req.studentId, !!req.isProcessingRestricted)}
                        disabled={isPending}
                        className="gap-1 text-[11px] h-7"
                      >
                        <Prohibit size={12} weight="bold" />
                        {req.isProcessingRestricted ? "Frozen (Active)" : "Freeze Processing"}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Article 20 Dossier Modal */}
      {selectedPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section role="dialog" aria-modal="true" className="w-full max-w-3xl border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-blue-700" weight="bold" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    GDPR Article 20 Data Portability Dossier
                  </h3>
                  <p className="text-xs text-slate-600 font-mono">
                    {selectedPackage.exportMetadata.exportId} • {selectedPackage.exportMetadata.studentName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPackage(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-4 space-y-4 text-xs">
              {/* Safeguarding Exemption Warning Banner */}
              {selectedPackage.exportMetadata.safeguardingRedacted && (
                <div className="border border-amber-300 bg-amber-50 p-3 rounded-xs text-amber-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-amber-900">
                    <ShieldCheck size={16} weight="bold" />
                    Statutory Safeguarding Redaction Active
                  </div>
                  <p className="text-[11px] leading-relaxed">
                    {selectedPackage.exportMetadata.safeguardingExemptionReason}
                  </p>
                </div>
              )}

              {/* JSON Payload View */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px] uppercase">
                  <span>Structured Machine-Readable Payload</span>
                  <span className="font-mono">application/json</span>
                </div>
                <pre className="max-h-80 overflow-y-auto border border-slate-200 bg-slate-900 p-3 font-mono text-[11px] text-slate-200 rounded-xs">
                  {JSON.stringify(selectedPackage, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-3 bg-slate-50">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const blob = new Blob([JSON.stringify(selectedPackage, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${selectedPackage.exportMetadata.exportId}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="gap-1.5"
              >
                <DownloadSimple size={14} weight="bold" />
                Download JSON File
              </Button>
              <Button size="sm" onClick={() => setSelectedPackage(null)}>
                Close Dossier
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* New Request Dialog */}
      {showNewRequestDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Record Data Subject Request</h3>
                <p className="text-xs text-slate-600">Log a formal GDPR data rights request under institutional audit policy.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewRequestDialog(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="border border-rose-200 bg-rose-50 p-2.5 text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Target Student</label>
                <select
                  value={newStudentId}
                  onChange={(e) => setNewStudentId(e.target.value)}
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} (DOB: {st.dateOfBirth})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Request Type</label>
                <select
                  value={newRequestType}
                  onChange={(e) => setNewRequestType(e.target.value as "export" | "rectify" | "anonymize" | "restrict")}
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                >
                  <option value="export">Article 20 — Right to Data Portability Export</option>
                  <option value="restrict">Article 18 — Right to Restriction of Processing</option>
                  <option value="rectify">Article 16 — Right to Rectification of Data</option>
                  <option value="anonymize">Article 17 — Right to Erasure / Anonymization</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Requester Full Name</label>
                  <input
                    type="text"
                    value={newRequesterName}
                    onChange={(e) => setNewRequesterName(e.target.value)}
                    placeholder="e.g. David Warren"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Requester Role</label>
                  <select
                    value={newRequesterRole}
                    onChange={(e) => setNewRequesterRole(e.target.value)}
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                  >
                    <option value="guardian">Guardian / Parent</option>
                    <option value="student_adult">Student (Age of Majority)</option>
                    <option value="dpo">Data Protection Officer</option>
                    <option value="legal_counsel">Statutory Legal Counsel</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Requester Email</label>
                <input
                  type="email"
                  value={newRequesterEmail}
                  onChange={(e) => setNewRequesterEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Mandatory Justification / Notes</label>
                <textarea
                  rows={2}
                  value={newJustification}
                  onChange={(e) => setNewJustification(e.target.value)}
                  placeholder="Describe the regulatory or parental basis for this data subject request..."
                  className="w-full border border-slate-300 bg-white p-2 text-xs focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-3 bg-slate-50">
              <Button variant="ghost" size="sm" onClick={() => setShowNewRequestDialog(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleCreateRequest} disabled={isPending}>
                Save Request
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Article 17 Erasure / Anonymization Dialog */}
      {showAnonymizeDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg border border-rose-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-rose-200 bg-rose-50/50 p-4">
              <div className="flex items-center gap-2 text-rose-900">
                <WarningOctagon size={20} weight="bold" />
                <div>
                  <h3 className="text-base font-bold">Article 17 — Irreversible PII Anonymization</h3>
                  <p className="text-xs text-rose-800">Right to Erasure (&ldquo;Right to be Forgotten&rdquo;)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAnonymizeDialog(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="border border-rose-200 bg-rose-50 p-3 text-rose-950 text-xs leading-relaxed space-y-1">
                <strong>Statutory Retention vs Erasure Warning:</strong>
                <p className="text-[11px]">
                  Under educational recordkeeping statutes, academic grades and historical attendance totals must be preserved. This operation will <strong>permanently overwrite names, contact information, and date of birth</strong> with pseudonymous tokens, while maintaining anonymized cohort averages.
                </p>
              </div>

              {anonymizeError && (
                <div className="border border-rose-200 bg-rose-50 p-2.5 text-rose-800 text-xs">
                  {anonymizeError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Select Student to Anonymize</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                >
                  {students.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.firstName} {st.lastName} (ID: {st.id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">
                  Mandatory Legal Justification (min 10 characters)
                </label>
                <textarea
                  rows={2}
                  value={anonymizeJustification}
                  onChange={(e) => setAnonymizeJustification(e.target.value)}
                  placeholder="e.g. Formal Right to Erasure request received and validated by DPO following student graduation..."
                  className="w-full border border-slate-300 bg-white p-2 text-xs focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-3 bg-slate-50">
              <Button variant="ghost" size="sm" onClick={() => setShowAnonymizeDialog(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleExecuteAnonymization}
                disabled={isPending || anonymizeJustification.trim().length < 10}
              >
                Confirm Irreversible Anonymization
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
