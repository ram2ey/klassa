"use client";

import { useState, useTransition } from "react";
import {
  LockKey,
  ShieldCheck,
  Eye,
  X,
  User,
  Gavel,
  WarningOctagon,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGMTDateTime, formatGMTTime } from "@/lib/timezone";
import type {
  SensitiveCaseRecord,
  EncryptedCaseNote,
  SensitiveAccessLogRecord,
  KlassoRole,
} from "@/lib/sensitive-records";
import { viewSensitiveCaseDetailAction } from "@/app/actions/sensitive-record-actions";

interface ViewCaseDetailModalProps {
  caseRecord: SensitiveCaseRecord;
  currentUserRole: KlassoRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onAccessAudited?: (log: SensitiveAccessLogRecord) => void;
}

export function ViewCaseDetailModal({
  caseRecord,
  currentUserRole,
  currentUserId,
  currentUserName,
  onClose,
  onAccessAudited,
}: ViewCaseDetailModalProps) {
  const [accessReason, setAccessReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [decryptedNotes, setDecryptedNotes] = useState<EncryptedCaseNote[] | null>(null);
  const [auditNotice, setAuditNotice] = useState<string | null>(null);

  const isDecrypted = decryptedNotes !== null;

  const handleDecrypt = () => {
    if (!accessReason || accessReason.trim().length < 5) {
      setError("Mandatory: Please enter an access reason of at least 5 characters (e.g., 'Annual case review').");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await viewSensitiveCaseDetailAction(
        caseRecord.id,
        currentUserRole,
        currentUserId,
        currentUserName,
        accessReason
      );

      if (!res.success) {
        setError(res.error || "Failed to decrypt record.");
      } else {
        setDecryptedNotes(res.notes || []);
        if (res.accessLogRecord) {
          setAuditNotice(`Access permanently recorded as log #${res.accessLogRecord.id} at ${formatGMTTime(res.accessLogRecord.accessedAt)}`);
          if (onAccessAudited) {
            onAccessAudited(res.accessLogRecord);
          }
        }
      }
    });
  };

  const getTierTone = (tier: string): "amber" | "slate" | "blue" | "green" => {
    if (tier === "strictly_confidential") return "amber";
    if (tier === "confidential") return "amber";
    return "slate";
  };

  const getAreaLabel = (area: string) => {
    switch (area) {
      case "safeguarding":
        return "Safeguarding (Child Protection)";
      case "health_medical":
        return "Health & Medical";
      case "special_needs":
        return "Special Educational Needs (SEND)";
      case "disciplinary":
        return "Disciplinary & Pastoral";
      default:
        return area;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xs border border-slate-300 bg-white shadow-xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
                {caseRecord.caseNumber}
              </span>
              <Badge tone={getTierTone(caseRecord.confidentialityTier)}>
                {caseRecord.confidentialityTier.replace("_", " ")}
              </Badge>
              {caseRecord.hasCourtOrder && (
                <Badge tone="slate" className="flex items-center gap-1 border-rose-300 bg-rose-50 text-rose-700">
                  <Gavel size={12} weight="bold" />
                  Court Order Enforced
                </Badge>
              )}
            </div>
            <h2 className="text-lg font-bold text-slate-900">{caseRecord.title}</h2>
            <p className="text-xs text-slate-500">
              Student: <span className="font-medium text-slate-700">{caseRecord.studentName}</span> ({caseRecord.studentGrade}) • Area: <span className="font-medium text-slate-700">{getAreaLabel(caseRecord.area)}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-xs p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 rounded-xs border border-slate-200 bg-slate-50 p-3 text-xs md:grid-cols-4">
            <div>
              <span className="block text-slate-500">Status</span>
              <span className="font-medium capitalize text-slate-800">{caseRecord.status.replace("_", " ")}</span>
            </div>
            <div>
              <span className="block text-slate-500">Lead Specialist</span>
              <span className="font-medium text-slate-800">{caseRecord.leadSpecialistName}</span>
            </div>
            <div>
              <span className="block text-slate-500">Scheduled Review</span>
              <span className="font-medium text-slate-800">{caseRecord.reviewDate || "None set"}</span>
            </div>
            <div>
              <span className="block text-slate-500">Encrypted Notes</span>
              <span className="font-medium text-slate-800">{caseRecord.encryptedNotesCount} file(s)</span>
            </div>
          </div>

          {/* Decryption Security Shield */}
          {!isDecrypted ? (
            <div className="space-y-4 rounded-xs border border-amber-300 bg-amber-50/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xs bg-amber-100 p-2 text-amber-800">
                  <LockKey size={24} weight="bold" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-950">
                    AES-256-GCM Encrypted Narrative Shield
                  </h3>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    This file contains protected statutory records. Under Klassa Security Protocol (ASVS Level 2), accessing raw narratives decrypts on-demand and writes an immutable entry into the official read-access audit trail.
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-amber-200">
                <label className="block text-xs font-semibold text-amber-950">
                  Mandatory Access Justification <span className="text-rose-600">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g., Annual case conference review or medical dosing verification..."
                  value={accessReason}
                  onChange={(e) => setAccessReason(e.target.value)}
                  className="w-full rounded-xs border border-amber-300 bg-white px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
                  disabled={isPending}
                />
                <p className="text-[11px] text-amber-800">
                  Your identity (<span className="font-medium">{currentUserName}</span>) and IP address will be logged permanently with this reason.
                </p>
              </div>

              {error && (
                <div className="rounded-xs border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700 flex items-center gap-1.5">
                  <WarningOctagon size={16} />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex justify-end pt-1">
                <Button
                  onClick={handleDecrypt}
                  disabled={isPending || accessReason.trim().length < 5}
                  className="gap-1.5"
                >
                  <Eye size={16} />
                  {isPending ? "Decrypting & Auditing..." : "Decrypt & Record Access"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {auditNotice && (
                <div className="flex items-center gap-2 rounded-xs border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  <ShieldCheck size={18} weight="bold" />
                  <span>{auditNotice}</span>
                </div>
              )}

              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Decrypted Narrative Notes ({decryptedNotes.length})
                </h4>

                {decryptedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="rounded-xs border border-slate-200 bg-slate-50/50 p-4 space-y-2"
                  >
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs">
                      <div className="flex items-center gap-2 font-medium text-slate-700">
                        <User size={14} />
                        <span>{note.authorName}</span>
                        <span className="text-slate-400">•</span>
                        <span className="capitalize text-slate-500">{note.noteType.replace(/_/g, " ")}</span>
                      </div>
                      <span className="text-slate-400">
                        {formatGMTDateTime(note.createdAt)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-900 leading-relaxed whitespace-pre-wrap font-sans">
                      {note.decryptedText}
                    </p>

                    <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400 border-t border-slate-100">
                      <span>Cryptographic Auth Tag: Verified (AES-GCM)</span>
                      <span>IV: {note.ivHex.substring(0, 8)}...</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 text-xs">
          <span className="text-slate-500">
            Klassa Multi-Tenant Security Scope: Confidential Student Record
          </span>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
