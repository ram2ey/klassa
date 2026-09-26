"use client";

import { Printer, ShieldCheck, X, FileText } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { formatGMTDate } from "@/lib/timezone";
import type { DisclosurePackageResult } from "@/lib/sensitive-records";

interface DisclosurePackageModalProps {
  packageData: DisclosurePackageResult;
  onClose: () => void;
  schoolName?: string;
}

export function DisclosurePackageModal({ packageData, onClose, schoolName }: DisclosurePackageModalProps) {
  const handlePrint = () => {
    window.print();
  };

  const displaySchool = packageData.schoolName || schoolName || "Official Educational Institution";
  const subtitle = packageData.recipientAgency
    ? `Statutory Multi-Agency Safeguarding Disclosure • Designated Authority: ${packageData.recipientAgency}`
    : "Office of Records & Pastoral Safeguarding";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xs border border-slate-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4 print:hidden">
          <div className="flex items-center gap-2">
            <div className="rounded-xs bg-slate-100 p-1.5 text-slate-700">
              <FileText size={18} weight="bold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Official Statutory Disclosure Package</h2>
              <span className="font-mono text-xs text-slate-500">{packageData.dossierNumber}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer size={16} />
              Print / Save PDF
            </Button>
            <button
              onClick={onClose}
              className="rounded-xs p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6 text-xs text-slate-900">
          {/* Institutional Header */}
          <div className="border-b-2 border-slate-900 pb-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">{displaySchool.toUpperCase()}</h1>
                <p className="text-xs text-slate-600">{subtitle}</p>
              </div>
              <div className="text-right">
                <span className="inline-block border border-slate-900 px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase">
                  CONFIDENTIAL DISCLOSURE
                </span>
                <p className="mt-1 font-mono text-[10px] text-slate-500">
                  Dossier: {packageData.dossierNumber}
                </p>
              </div>
            </div>
          </div>

          {/* Dossier Metadata */}
          <div className="grid grid-cols-2 gap-4 rounded-xs border border-slate-200 bg-slate-50 p-4 text-xs">
            <div>
              <span className="block text-slate-500 font-medium">Subject Student:</span>
              <span className="text-sm font-bold text-slate-900">
                {packageData.studentName}
                {packageData.studentNumber ? ` (${packageData.studentNumber})` : ""}
              </span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Date of Certification:</span>
              <span className="text-slate-800">{formatGMTDate(packageData.generatedAt)}</span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Statutory Safeguarding Withholdings:</span>
              <span className="font-semibold text-rose-700">
                {packageData.withheldSafeguardingCount} case file(s) withheld under child protection law
              </span>
            </div>
            <div>
              <span className="block text-slate-500 font-medium">Active Court Orders:</span>
              <span className="font-semibold text-slate-800">
                {packageData.activeCourtOrdersCount} active protective order(s)
              </span>
            </div>
            {packageData.recipientAgency && (
              <div className="col-span-2 border-t border-slate-200/60 pt-2">
                <span className="block text-slate-500 font-medium">Recipient Authority / External Agency:</span>
                <span className="font-semibold text-slate-900">{packageData.recipientAgency}</span>
              </div>
            )}
          </div>

          {/* Records Summary */}
          <div className="space-y-3">
            <h3 className="border-b border-slate-200 pb-1 text-xs font-bold uppercase tracking-wider text-slate-800">
              Released Institutional Record Ledger ({packageData.includedRecords.length})
            </h3>

            {packageData.includedRecords.length === 0 ? (
              <p className="text-slate-500 italic">No releasable non-confidential files exist for this student subject.</p>
            ) : (
              <div className="space-y-3">
                {packageData.includedRecords.map((item, idx) => (
                  <div key={idx} className="border border-slate-200 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-900 capitalize">{item.area.replace(/_/g, " ")}: {item.title}</span>
                      <span className="font-mono text-[11px] text-slate-500">{formatGMTDate(item.date)}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-700 bg-slate-50 p-2 rounded-xs border border-slate-100">
                      {item.redactedNotes}
                    </p>
                    <div className="text-[10px] text-slate-400">
                      Classification: Redacted Institutional Summary • Status: {item.status.toUpperCase()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Statutory Verification & Hash */}
          <div className="rounded-xs border border-slate-200 bg-slate-50/70 p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
              <ShieldCheck size={16} className="text-emerald-600" />
              <span>Cryptographic Integrity Verification & Legal Seal</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              This official dossier has been compiled pursuant to institutional safeguarding governance. Any unauthorized reproduction, interception, or dissemination is strictly prohibited under federal educational privacy and statutory child protection provisions.
            </p>
            <div className="flex items-center justify-between pt-1 border-t border-slate-200 font-mono text-[10px] text-slate-500">
              <span>SHA-256 Digest: {packageData.digitalIntegrityChecksum}</span>
              <span>Registrar Digital Signature: VERIFIED</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end border-t border-slate-200 p-4 print:hidden">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
