"use client";

import { useState, useTransition, useMemo } from "react";
import { formatGMTDate, formatGMTTime } from "@/lib/timezone";
import {
  Bell,
  CheckCircle,
  ClockCounterClockwise,
  DeviceMobile,
  FileText,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  AnnouncementRecord,
  CommunicationTemplateItem,
  GuardianConsentRecord,
  SmsDeliveryItem,
  AnnouncementInput,
  GuardianConsentInput,
} from "@/lib/communications";
import { CreateAnnouncementDialog } from "./create-announcement-dialog";

interface CommunicationsModuleProps {
  announcements: AnnouncementRecord[];
  templates: CommunicationTemplateItem[];
  consents: GuardianConsentRecord[];
  smsLedger: SmsDeliveryItem[];
  ledgerSummary: {
    totalDispatches: number;
    totalCost: number;
    totalSegments: number;
    deliveredCount: number;
  };
  onCreateAnnouncement: (input: AnnouncementInput) => Promise<{ success: boolean; error?: string }>;
  onRecordRead: (announcementId: string, userId: string) => Promise<void>;
  onUpdateConsent: (input: GuardianConsentInput) => Promise<{ success: boolean; error?: string }>;
}

type CommTab = "notices" | "templates" | "consent" | "ledger";

export function CommunicationsModule({
  announcements,
  templates,
  consents,
  smsLedger,
  ledgerSummary,
  onCreateAnnouncement,
  onRecordRead,
  onUpdateConsent,
}: CommunicationsModuleProps) {
  const [activeTab, setActiveTab] = useState<CommTab>("notices");
  const [searchQuery, setSearchQuery] = useState("");
  const [targetFilter, setTargetFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplateForCreate, setSelectedTemplateForCreate] = useState<CommunicationTemplateItem | null>(null);

  const [isPending, startTransition] = useTransition();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Filtered announcements
  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      const matchSearch =
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (a.authorName && a.authorName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchTarget = targetFilter === "all" || a.targetType === targetFilter;
      const matchPriority = priorityFilter === "all" || a.priority === priorityFilter;
      const matchChannel = channelFilter === "all" || a.channels === channelFilter;

      return matchSearch && matchTarget && matchPriority && matchChannel;
    });
  }, [announcements, searchQuery, targetFilter, priorityFilter, channelFilter]);

  // Overall statistics
  const totalAnnouncements = announcements.length;
  const totalTargetRecipients = announcements.reduce((s, a) => s + a.targetRecipientCount, 0);
  const totalReads = announcements.reduce((s, a) => s + a.readCount, 0);
  const avgReadRate =
    totalTargetRecipients > 0 ? Math.round((totalReads / totalTargetRecipients) * 100) : 0;
  const optInSmsCount = consents.filter((c) => c.optInSmsAnnouncements).length;
  const smsOptInRate =
    consents.length > 0 ? Math.round((optInSmsCount / consents.length) * 100) : 100;

  function handleUseTemplate(template: CommunicationTemplateItem) {
    setSelectedTemplateForCreate(template);
    setShowCreateModal(true);
  }

  function handleToggleConsent(consent: GuardianConsentRecord) {
    startTransition(async () => {
      const updated: GuardianConsentInput = {
        guardianId: consent.guardianId,
        phone: consent.phone,
        optInSmsAnnouncements: !consent.optInSmsAnnouncements,
        optOutReason: consent.optOutReason ?? undefined,
      };

      const res = await onUpdateConsent(updated);
      if (res.success) {
        setStatusMessage("Guardian SMS consent settings updated successfully.");
        setTimeout(() => setStatusMessage(null), 3000);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Top Banner & KPI Telemetry */}
      {/* Top Banner & KPI Telemetry */}
      <div className="rounded-card border border-line-subtle bg-surface shadow-card p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-line-subtle pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-ink">
                School Communications Hub
              </h1>
              <Badge tone="amber" className="font-mono text-[10px]">
                PHASE 4
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-secondary">
              Publish school notices and review SMS delivery status.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setSelectedTemplateForCreate(null);
                setShowCreateModal(true);
              }}
            >
              <Plus weight="bold" className="mr-1.5 h-3.5 w-3.5" />
              New Announcement
            </Button>
          </div>
        </div>

        {/* Telemetry Metrics */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
          <div className="rounded-control border border-line-subtle bg-surface-subtle p-2.5">
            <span className="block text-[11px] font-medium text-secondary uppercase tracking-wider">
              Total Notices
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-ink">
              {totalAnnouncements}
            </span>
          </div>
          <div className="rounded-control border border-line-subtle bg-surface-subtle p-2.5">
            <span className="block text-[11px] font-medium text-secondary uppercase tracking-wider">
              Avg Read Rate
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-ink">
              {avgReadRate}%
            </span>
          </div>
          <div className="rounded-control border border-line-subtle bg-surface-subtle p-2.5">
            <span className="block text-[11px] font-medium text-secondary uppercase tracking-wider">
              SMS Opt-In Rate
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-ink">
              {smsOptInRate}%
            </span>
          </div>
          <div className="rounded-control border border-line-subtle bg-surface-subtle p-2.5">
            <span className="block text-[11px] font-medium text-secondary uppercase tracking-wider">
              SMS Dispatches
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-ink">
              {ledgerSummary.totalDispatches}
            </span>
          </div>
          <div className="rounded-control border border-line-subtle bg-surface-subtle p-2.5">
            <span className="block text-[11px] font-medium text-secondary uppercase tracking-wider">
              Telecom Spend
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-success">
              ${ledgerSummary.totalCost.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="rounded-control border border-success/20 bg-success-subtle px-3.5 py-2 text-xs text-success animate-in fade-in">
          {statusMessage}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
        <div className="flex border-b border-line-subtle bg-surface-subtle px-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("notices")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "notices"
                ? "border-primary bg-surface text-selected"
                : "border-transparent text-secondary hover:text-ink",
            )}
          >
            <Bell weight="bold" className="h-3.5 w-3.5" />
            Notice Board ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "templates"
                ? "border-primary bg-surface text-selected"
                : "border-transparent text-secondary hover:text-ink",
            )}
          >
            <FileText weight="bold" className="h-3.5 w-3.5" />
            Templates ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("consent")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "consent"
                ? "border-primary bg-surface text-selected"
                : "border-transparent text-secondary hover:text-ink",
            )}
          >
            <ShieldCheck weight="bold" className="h-3.5 w-3.5" />
            Guardian Consent ({consents.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("ledger")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "ledger"
                ? "border-primary bg-surface text-selected"
                : "border-transparent text-secondary hover:text-ink",
            )}
          >
            <DeviceMobile weight="bold" className="h-3.5 w-3.5" />
            Delivery Ledger ({smsLedger.length})
          </button>
        </div>

        {/* TAB 1: NOTICES BOARD */}
        {/* TAB 1: NOTICES BOARD */}
        {activeTab === "notices" && (
          <div className="p-4 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between bg-surface-subtle p-2.5 rounded-control border border-line-subtle text-xs">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-secondary" />
                <input
                  type="text"
                  placeholder="Filter announcements by title, body, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full rounded-control border border-line bg-surface pl-8 pr-3 text-xs text-ink focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value)}
                  className="h-8 rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="all">All Targets</option>
                  <option value="school">School-Wide</option>
                  <option value="grade">Grade Cohorts</option>
                  <option value="class">Class Sections</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-8 rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="all">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="h-8 rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="all">All Channels</option>
                  <option value="in_app">In-App</option>
                  <option value="sms">SMS Only</option>
                  <option value="both">Both</option>
                </select>
              </div>
            </div>

            {/* Announcement Cards */}
            {filteredAnnouncements.length === 0 ? (
              <div className="rounded-control border border-line-subtle bg-surface p-8 text-center text-xs text-secondary">
                No official announcements found matching filter criteria.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnnouncements.map((ann) => {
                  const readPct =
                    ann.targetRecipientCount > 0
                      ? Math.round((ann.readCount / ann.targetRecipientCount) * 100)
                      : 0;

                  return (
                    <div
                      key={ann.id}
                      className={cn(
                        "rounded-card border p-4 transition-all bg-surface",
                        ann.priority === "urgent" ? "border-warning-subtle" : "border-line-subtle hover:border-line",
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {ann.priority === "urgent" ? (
                              <span className="rounded-control border border-warning/20 bg-warning-subtle px-2 py-0.5 text-[10px] font-bold text-warning uppercase">
                                URGENT
                              </span>
                            ) : (
                              <span className="rounded-control border border-line-subtle bg-surface-subtle px-2 py-0.5 text-[10px] font-medium text-secondary uppercase">
                                NOTICE
                              </span>
                            )}

                            <span className="rounded-control border border-line-subtle bg-surface px-2 py-0.5 font-mono text-[10px] text-secondary">
                              {ann.channels === "both" ? "IN-APP + SMS" : ann.channels === "sms" ? "SMS TEXT" : "IN-APP PORTAL"}
                            </span>

                            <span className="rounded-control border border-line-subtle bg-surface-subtle px-2 py-0.5 font-mono text-[10px] text-secondary">
                              {ann.targetLabel}
                            </span>
                          </div>

                          <h3 className="text-xs font-bold text-ink">{ann.title}</h3>
                          <p className="text-xs text-secondary leading-relaxed max-w-3xl">
                            {ann.content}
                          </p>
                        </div>

                        {/* Read Receipt Progress */}
                        <div className="sm:text-right shrink-0 rounded-control border border-line-subtle bg-surface-subtle p-2.5 min-w-[170px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-secondary uppercase tracking-wider font-semibold">
                              Read Rate
                            </span>
                            <span className="font-mono font-bold text-ink">
                              {readPct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full rounded-full bg-surface-subtle overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                readPct > 75 ? "bg-success" : readPct > 40 ? "bg-primary" : "bg-warning",
                              )}
                              style={{ width: `${readPct}%` }}
                            />
                          </div>
                          <span className="mt-1 block font-mono text-[10px] text-secondary">
                            {ann.readCount} of {ann.targetRecipientCount} recipients
                          </span>
                        </div>
                      </div>

                      {/* Footer & Approvers */}
                      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-line-subtle pt-2.5 text-[11px] text-secondary">
                        <div className="flex items-center gap-3">
                          <span>
                            Author: <strong className="text-ink">{ann.authorName ?? "System"}</strong>
                          </span>
                          <span>
                            Published: <span className="font-mono">{formatGMTDate(ann.createdAt)}</span>
                          </span>
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => {
                            startTransition(async () => {
                              await onRecordRead(ann.id, "usr-admin-1");
                            });
                          }}
                          className="h-6 text-[10px] text-secondary hover:text-ink"
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Simulate Read Receipt
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: INSTITUTIONAL TEMPLATES */}
        {activeTab === "templates" && (
          <div className="p-4 space-y-4">
            <div className="rounded-control border border-line-subtle bg-surface-subtle p-3 text-xs text-secondary">
              <h3 className="font-bold uppercase tracking-wider text-ink">
                Standard School Templates Library
              </h3>
              <p className="mt-0.5 text-secondary">
                Pre-approved institutional language formats. Select a template to initiate a dispatch with standard parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {templates.map((tpl) => (
                <div key={tpl.id} className="rounded-card border border-line-subtle bg-surface shadow-card p-4 flex flex-col justify-between hover:border-line transition-colors">
                  <div>
                    <div className="flex items-center justify-between">
                      <Badge tone="amber" className="text-[10px] font-semibold">
                        {tpl.category}
                      </Badge>
                      <span className="font-mono text-[10px] text-secondary uppercase">
                        Channel: {tpl.suggestedChannel}
                      </span>
                    </div>

                    <h4 className="mt-2 text-xs font-bold text-ink">{tpl.title}</h4>
                    <p className="mt-1 text-[11px] text-secondary">{tpl.description}</p>

                    <div className="mt-2.5 rounded-control border border-line-subtle bg-surface-subtle p-2.5 font-mono text-[11px] text-ink leading-relaxed">
                      {tpl.contentTemplate}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end border-t border-line-subtle pt-2.5">
                    <Button
                      size="sm"
                      onClick={() => handleUseTemplate(tpl)}
                    >
                      Use Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: GUARDIAN CONSENT REGISTRY */}
        {activeTab === "consent" && (
          <div className="p-4 space-y-4">
            <div className="rounded-control border border-line-subtle bg-surface-subtle p-3 text-xs text-secondary">
              <h3 className="font-bold uppercase tracking-wider text-ink">
                Telecommunications Consent & TCPA Compliance Registry
              </h3>
              <p className="mt-0.5 text-secondary">
                Institutional records of mobile SMS consent per guardian. General announcements and attendance notifications respect opt-outs. Emergency dispatches override circular opt-outs.
              </p>
            </div>

            <div className="rounded-control border border-line-subtle bg-surface overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-subtle font-semibold text-secondary uppercase tracking-wider text-[11px]">
                    <th className="p-3">Guardian Name</th>
                    <th className="p-3">Student Enrolled</th>
                    <th className="p-3">Mobile Contact</th>
                    <th className="p-3 text-center">Routine SMS</th>
                    <th className="p-3">Opt-Out Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {consents.map((c) => (
                    <tr key={c.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="p-3 font-semibold text-ink">{c.guardianName}</td>
                      <td className="p-3 text-secondary">{c.studentName}</td>
                      <td className="p-3 font-mono text-secondary">{c.phone}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleConsent(c)}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold rounded-control border transition-colors",
                            c.optInSmsAnnouncements
                              ? "border-success/20 bg-success-subtle text-success"
                              : "border-line bg-surface-subtle text-secondary",
                          )}
                        >
                          {c.optInSmsAnnouncements ? "OPTED IN" : "OPTED OUT"}
                        </button>
                      </td>
                      <td className="p-3 text-secondary text-[11px] max-w-xs truncate">
                        {c.optOutReason || "Standard enrollment consent"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: TELECOM & COST LEDGER */}
        {activeTab === "ledger" && (
          <div className="p-4 space-y-4">
            <div className="rounded-control border border-line-subtle bg-surface-subtle p-3 text-xs text-secondary">
              <h3 className="font-bold uppercase tracking-wider text-ink">
                Telecommunications Transit & Financial Audit Ledger
              </h3>
              <p className="mt-0.5 text-secondary">
                Itemized telecommunication gateway records. Each SMS dispatch records GSM segment size and per-segment transit charge ($0.015).
              </p>
            </div>

            <div className="rounded-control border border-line-subtle bg-surface overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-line-subtle bg-surface-subtle font-semibold text-secondary uppercase tracking-wider text-[11px]">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Destination Mobile</th>
                    <th className="p-3">Announcement Title</th>
                    <th className="p-3 text-center">GSM Segments</th>
                    <th className="p-3 text-right">Cost (USD)</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {smsLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-surface-subtle/50 transition-colors">
                      <td className="p-3 font-mono text-secondary text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <ClockCounterClockwise className="h-3 w-3 text-secondary" />
                          {formatGMTTime(item.sentAt)}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-ink">{item.recipientName}</td>
                      <td className="p-3 font-mono text-secondary">{item.recipientPhone}</td>
                      <td className="p-3 text-ink max-w-xs truncate">{item.announcementTitle}</td>
                      <td className="p-3 text-center font-mono text-secondary">{item.segments}</td>
                      <td className="p-3 text-right font-mono font-semibold text-ink">
                        ${item.cost.toFixed(3)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="rounded-control border border-success/20 bg-success-subtle px-2 py-0.5 font-mono text-[10px] font-bold text-success">
                          {item.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* MODALS */}
      {showCreateModal && (
        <CreateAnnouncementDialog
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (input) => {
            const res = await onCreateAnnouncement(input);
            if (res.success) {
              setStatusMessage("Official announcement created and published.");
              setTimeout(() => setStatusMessage(null), 3000);
            }
          }}
          templates={templates}
          prefilledTemplate={selectedTemplateForCreate}
        />
      )}

    </div>
  );
}
