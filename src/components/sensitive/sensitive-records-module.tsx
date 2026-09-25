"use client";

import { useState, useTransition, useMemo } from "react";
import {
  LockKey,
  ShieldCheck,
  ShieldWarning,
  Plus,
  MagnifyingGlass,
  Gavel,
  ClockCounterClockwise,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatGMTDateTime } from "@/lib/timezone";
import type {
  SensitiveCaseRecord,
  NeedToKnowAlertRecord,
  CourtRestrictionRecord,
  SensitiveAccessLogRecord,
  KlassoRole,
  SensitiveCaseArea,
  DisclosurePackageResult,
} from "@/lib/sensitive-records";
import { canUserAccessCaseArea, canUserManageNeedToKnow, canUserManageCourtOrders } from "@/lib/sensitive-records";
import { ViewCaseDetailModal } from "./view-case-detail-modal";
import { AddSensitiveCaseDialog } from "./add-sensitive-case-dialog";
import { AddNeedToKnowDialog } from "./add-need-to-know-dialog";
import { CourtOrderDialog } from "./court-order-dialog";
import { DisclosurePackageModal } from "./disclosure-package-modal";
import { resolveNeedToKnowAlertAction, generateStudentDisclosureAction } from "@/app/actions/sensitive-record-actions";

interface SensitiveRecordsModuleProps {
  currentUserRole: KlassoRole;
  currentUserId: string;
  currentUserName: string;
  cases: SensitiveCaseRecord[];
  alerts: NeedToKnowAlertRecord[];
  courtOrders: CourtRestrictionRecord[];
  accessLogs: SensitiveAccessLogRecord[];
  onCaseCreated: (c: SensitiveCaseRecord) => void;
  onAlertCreated: (a: NeedToKnowAlertRecord) => void;
  onOrderRegistered: (o: CourtRestrictionRecord) => void;
  onAccessAudited?: (l: SensitiveAccessLogRecord) => void;
}

type SubTab = "cases" | "need_to_know" | "court_orders" | "audit_log";

export function SensitiveRecordsModule({
  currentUserRole,
  currentUserId,
  currentUserName,
  cases,
  alerts,
  courtOrders,
  accessLogs,
  onCaseCreated,
  onAlertCreated,
  onOrderRegistered,
  onAccessAudited,
}: SensitiveRecordsModuleProps) {
  const [activeTab, setActiveTab] = useState<SubTab>("cases");
  const [caseAreaFilter, setCaseAreaFilter] = useState<"all" | SensitiveCaseArea>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCase, setSelectedCase] = useState<SensitiveCaseRecord | null>(null);
  const [showAddCase, setShowAddCase] = useState(false);
  const [showAddAlert, setShowAddAlert] = useState(false);
  const [showCourtOrder, setShowCourtOrder] = useState(false);
  const [disclosurePackage, setDisclosurePackage] = useState<DisclosurePackageResult | null>(null);
  const [localLogs, setLocalLogs] = useState<SensitiveAccessLogRecord[]>(accessLogs);
  const [localAlerts, setLocalAlerts] = useState<NeedToKnowAlertRecord[]>(alerts);
  const [, startTransition] = useTransition();

  // Filter cases by role authorization & search (called unconditionally at top of component)
  const visibleCases = useMemo(() => {
    return cases.filter((c) => {
      // Must have role clearance
      if (!canUserAccessCaseArea(currentUserRole, c.area)) return false;

      // Area filter
      if (caseAreaFilter !== "all" && c.area !== caseAreaFilter) return false;

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.title.toLowerCase().includes(q) ||
          c.studentName.toLowerCase().includes(q) ||
          c.caseNumber.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [cases, currentUserRole, caseAreaFilter, searchQuery]);

  // Role Gate: Teachers & Guardians are blocked from viewing raw confidential files
  if (currentUserRole === "teacher" || currentUserRole === "guardian") {
    return (
      <div className="space-y-6">
        <div className="border border-rose-200 bg-rose-50/70 p-6 rounded-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xs bg-rose-100 p-2 text-rose-800">
              <LockKey size={28} weight="bold" />
            </div>
            <div>
              <h2 className="text-base font-bold text-rose-950">
                403 — Restricted Institutional Safeguarding Boundary
              </h2>
              <p className="text-xs text-rose-800">
                Raw sensitive case files, child protection disclosures, and clinical diagnoses are restricted to designated safeguarding leads, SENCO officers, and the school health nurse.
              </p>
            </div>
          </div>
          <div className="border-t border-rose-200 pt-3 text-xs text-rose-900 leading-relaxed space-y-2">
            <p>
              <strong>Classroom Staff Notice:</strong> Classroom action directives (e.g., EpiPen instructions, medical accommodation protocols) are securely synchronized to your class roster under <strong>Need-to-Know Directives</strong>.
            </p>
            <p className="text-[11px] text-rose-700">
              Security Protocol: OWASP ASVS Level 2 & statutory child protection non-disclosure rules.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const handleResolveAlert = (alertId: string) => {
    startTransition(async () => {
      await resolveNeedToKnowAlertAction(alertId, currentUserRole, currentUserId);
      setLocalAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, isActive: false } : a))
      );
    });
  };

  const handleGenerateDisclosure = (studentId: string, studentName: string) => {
    startTransition(async () => {
      const res = await generateStudentDisclosureAction(
        studentId,
        studentName,
        currentUserRole,
        currentUserId
      );
      if (res.success && res.package) {
        setDisclosurePackage(res.package);
      }
    });
  };

  const handleAccessAudited = (newLog: SensitiveAccessLogRecord) => {
    setLocalLogs((prev) => [newLog, ...prev]);
    onAccessAudited?.(newLog);
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "strictly_confidential":
        return <Badge tone="amber" className="border-rose-300 bg-rose-50 text-rose-800">Strictly Confidential</Badge>;
      case "confidential":
        return <Badge tone="amber">Confidential</Badge>;
      default:
        return <Badge tone="slate">Standard Sensitive</Badge>;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge tone="amber" className="border-rose-300 bg-rose-50 text-rose-800">Critical Life Safety</Badge>;
      case "urgent":
        return <Badge tone="amber">Urgent Directive</Badge>;
      default:
        return <Badge tone="slate">Routine Support</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="flex items-start justify-between rounded-xs border border-slate-300 bg-white p-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-blue-700" weight="bold" />
            <h1 className="text-lg font-bold text-slate-900">
              Sensitive Student Records & Statutory Safeguarding
            </h1>
            <span className="rounded-xs border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              AES-256-GCM ENCRYPTED
            </span>
          </div>
          <p className="text-xs text-slate-600">
            Institutional case files for Child Protection, Special Needs (SENCO), Health & Medical protocols, and Enforced Court Restrictions. Every narrative decryption is logged permanently in the read audit ledger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canUserManageNeedToKnow(currentUserRole) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowAddAlert(true)}
              className="gap-1.5 text-xs"
            >
              <Plus size={14} weight="bold" />
              Publish Need-to-Know
            </Button>
          )}

          {canUserManageCourtOrders(currentUserRole) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowCourtOrder(true)}
              className="gap-1.5 text-xs"
            >
              <Gavel size={14} weight="bold" />
              Register Court Order
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowAddCase(true)}
            className="gap-1.5 text-xs"
          >
            <Plus size={14} weight="bold" />
            New Sensitive Case
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xs border border-slate-200 bg-white p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Authorized Cases</span>
            <LockKey size={16} className="text-slate-400" />
          </div>
          <p className="text-xl font-bold text-slate-900">{visibleCases.length}</p>
          <span className="text-[10px] text-slate-400">Clearance role: {currentUserRole.replace("_", " ")}</span>
        </div>

        <div className="rounded-xs border border-slate-200 bg-white p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Teacher Need-to-Know</span>
            <ShieldWarning size={16} className="text-amber-600" />
          </div>
          <p className="text-xl font-bold text-amber-900">
            {localAlerts.filter((a) => a.isActive).length}
          </p>
          <span className="text-[10px] text-slate-400">Active classroom directives</span>
        </div>

        <div className="rounded-xs border border-slate-200 bg-white p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Enforced Court Orders</span>
            <Gavel size={16} className="text-rose-600" />
          </div>
          <p className="text-xl font-bold text-rose-900">
            {courtOrders.filter((o) => o.isEnforced).length}
          </p>
          <span className="text-[10px] text-slate-400">Protective pickup bans</span>
        </div>

        <div className="rounded-xs border border-slate-200 bg-white p-3.5 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Decryption Audits</span>
            <ClockCounterClockwise size={16} className="text-blue-600" />
          </div>
          <p className="text-xl font-bold text-blue-900">{localLogs.length}</p>
          <span className="text-[10px] text-slate-400">Immutable read events</span>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab("cases")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "cases"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            Confidential Cases ({visibleCases.length})
          </button>
          <button
            onClick={() => setActiveTab("need_to_know")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "need_to_know"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            Teacher Need-to-Know Registry ({localAlerts.filter((a) => a.isActive).length})
          </button>
          <button
            onClick={() => setActiveTab("court_orders")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "court_orders"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            Court Restrictions & Protection Orders ({courtOrders.length})
          </button>
          <button
            onClick={() => setActiveTab("audit_log")}
            className={cn(
              "px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors",
              activeTab === "audit_log"
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900"
            )}
          >
            Read-Access Audit Trail ({localLogs.length})
          </button>
        </div>

        {activeTab === "cases" && (
          <div className="flex items-center gap-2 py-1.5">
            <div className="relative">
              <MagnifyingGlass size={14} className="absolute left-2.5 top-2 text-slate-400" />
              <input
                type="text"
                placeholder="Search case or student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 rounded-xs border border-slate-300 bg-white pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <select
              value={caseAreaFilter}
              onChange={(e) => setCaseAreaFilter(e.target.value as "all" | SensitiveCaseArea)}
              className="rounded-xs border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Domains</option>
              <option value="safeguarding">Safeguarding (CP)</option>
              <option value="health_medical">Health & Medical</option>
              <option value="special_needs">Special Needs (SEN)</option>
              <option value="disciplinary">Disciplinary</option>
            </select>
          </div>
        )}
      </div>

      {/* Tab 1: Confidential Cases */}
      {activeTab === "cases" && (
        <div className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Case ID</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Domain Area</th>
                  <th className="px-4 py-3">Case Title & Latest Summary</th>
                  <th className="px-4 py-3">Confidentiality Tier</th>
                  <th className="px-4 py-3">Lead Specialist</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {visibleCases.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-slate-400">
                      No confidential records found for current role clearance and filter.
                    </td>
                  </tr>
                ) : (
                  visibleCases.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">
                        {c.caseNumber}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <div>{c.studentName}</div>
                        <span className="text-[10px] text-slate-400">{c.studentGrade}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="capitalize text-slate-700">
                          {c.area.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <div className="font-semibold text-slate-900 truncate">{c.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {c.latestNoteSummary || "Encrypted narrative on file"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{getTierBadge(c.confidentialityTier)}</td>
                      <td className="px-4 py-3 text-slate-600">{c.leadSpecialistName}</td>
                      <td className="px-4 py-3">
                        <span className="capitalize rounded-xs bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          {c.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-1.5">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setSelectedCase(c)}
                          className="gap-1 text-[11px] h-7"
                        >
                          <LockKey size={13} />
                          Decrypt & View
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleGenerateDisclosure(c.studentId, c.studentName)}
                          className="text-[11px] h-7 text-slate-600 hover:text-slate-900"
                        >
                          Redacted Package
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Need-to-Know Registry */}
      {activeTab === "need_to_know" && (
        <div className="space-y-4">
          <div className="rounded-xs border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-950 flex items-start gap-2">
            <ShieldWarning size={20} className="text-amber-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Active Classroom Staff Directives:</span> Teachers receive strictly operational directives (dietary allergies, physical health accommodations, exam support) without clinical diagnostics or confidential investigative narratives.
            </div>
          </div>

          <div className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Directive Summary</th>
                  <th className="px-4 py-3">Action Required for Classroom Teachers</th>
                  <th className="px-4 py-3">Urgency</th>
                  <th className="px-4 py-3">Specialist Author</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {localAlerts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-400">
                      No active teacher directives registered.
                    </td>
                  </tr>
                ) : (
                  localAlerts.map((a) => (
                    <tr
                      key={a.id}
                      className={cn(
                        "hover:bg-slate-50/70 transition-colors",
                        !a.isActive && "opacity-50 bg-slate-50"
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {a.studentName} ({a.studentGrade})
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-600">{a.category.replace(/_/g, " ")}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{a.directiveSummary}</td>
                      <td className="px-4 py-3 max-w-sm text-slate-700 leading-relaxed">
                        {a.actionRequired}
                      </td>
                      <td className="px-4 py-3">{getSeverityBadge(a.severity)}</td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">{a.authorSpecialistName}</td>
                      <td className="px-4 py-3 text-right">
                        {a.isActive ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleResolveAlert(a.id)}
                            className="text-[11px] h-7"
                          >
                            Mark Resolved
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Court Restrictions */}
      {activeTab === "court_orders" && (
        <div className="space-y-4">
          <div className="rounded-xs border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-950 flex items-start gap-2">
            <Gavel size={20} className="text-rose-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Statutory Legal Protective Registry:</span> Court orders enforced against non-custodial individuals or restricted guardians. Front office and gate security are alerted to prohibit campus access and withhold record disclosures.
            </div>
          </div>

          <div className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Protected Student</th>
                  <th className="px-4 py-3">Restricted Individual</th>
                  <th className="px-4 py-3">Order Type</th>
                  <th className="px-4 py-3">Docket Number & Court</th>
                  <th className="px-4 py-3">Legal Summary & Mandated Restrictions</th>
                  <th className="px-4 py-3">Prohibitions</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courtOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-semibold text-slate-900">{ord.studentName}</td>
                    <td className="px-4 py-3 font-medium text-rose-800">{ord.restrictedPersonName}</td>
                    <td className="px-4 py-3 capitalize text-slate-700">
                      {ord.orderType.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      <span className="font-mono">{ord.docketNumber}</span>
                      <div className="text-[10px] text-slate-400">{ord.issuingCourt}</div>
                    </td>
                    <td className="px-4 py-3 max-w-sm text-slate-700 leading-relaxed">
                      {ord.summary}
                    </td>
                    <td className="px-4 py-3 space-y-1 text-[10px]">
                      {ord.prohibitPickup && (
                        <span className="block font-medium text-rose-700">• No Campus Pickup</span>
                      )}
                      {ord.prohibitDisclosure && (
                        <span className="block font-medium text-rose-700">• No Record Disclosure</span>
                      )}
                      {ord.prohibitDirectContact && (
                        <span className="block font-medium text-rose-700">• No Direct Contact</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone="amber" className="border-rose-300 bg-rose-50 text-rose-800">Active & Enforced</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Read-Access Audit Trail */}
      {activeTab === "audit_log" && (
        <div className="space-y-4">
          <div className="rounded-xs border border-blue-200 bg-blue-50/60 p-3 text-xs text-blue-950 flex items-start gap-2">
            <ClockCounterClockwise size={20} className="text-blue-800 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Permanent Read-Access Audit Ledger:</span> Every single decryption of sensitive narrative notes is recorded with user identity, timestamp, IP address, and mandatory justification reason to prevent unauthorized record browsing.
            </div>
          </div>

          <div className="overflow-hidden rounded-xs border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Actor / User</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Case Number</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Mandatory Justification Reason</th>
                  <th className="px-4 py-3">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {localLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 text-slate-500 font-sans">
                      {formatGMTDateTime(log.accessedAt)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 font-sans">
                      {log.userName}
                    </td>
                    <td className="px-4 py-3 capitalize text-slate-600 font-sans">
                      {log.userRole.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3 font-bold text-blue-700">{log.caseNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 font-sans text-slate-900 max-w-sm italic">
                      &ldquo;{log.accessReason}&rdquo;
                    </td>
                    <td className="px-4 py-3 text-slate-500">{log.ipAddress}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals & Dialogs */}
      {selectedCase && (
        <ViewCaseDetailModal
          caseRecord={selectedCase}
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setSelectedCase(null)}
          onAccessAudited={handleAccessAudited}
        />
      )}

      {showAddCase && (
        <AddSensitiveCaseDialog
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowAddCase(false)}
          onCaseCreated={(c) => {
            onCaseCreated(c);
            setSelectedCase(c);
          }}
        />
      )}

      {showAddAlert && (
        <AddNeedToKnowDialog
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowAddAlert(false)}
          onAlertCreated={(a) => {
            onAlertCreated(a);
            setLocalAlerts((prev) => [a, ...prev]);
          }}
        />
      )}

      {showCourtOrder && (
        <CourtOrderDialog
          currentUserRole={currentUserRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => setShowCourtOrder(false)}
          onOrderRegistered={(o) => {
            onOrderRegistered(o);
          }}
        />
      )}

      {disclosurePackage && (
        <DisclosurePackageModal
          packageData={disclosurePackage}
          onClose={() => setDisclosurePackage(null)}
        />
      )}
    </div>
  );
}
