"use client";

import { useState, useTransition, useMemo } from "react";
import {
  Bell,
  CheckCircle,
  ClockCounterClockwise,
  DeviceMobile,
  FileText,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  WarningCircle,
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
  EmergencyBroadcastInput,
  GuardianConsentInput,
} from "@/lib/communications";
import { CreateAnnouncementDialog } from "./create-announcement-dialog";
import { EmergencyBroadcastDialog } from "./emergency-broadcast-dialog";

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
  onInitiateEmergencyBroadcast: (input: EmergencyBroadcastInput) => Promise<{ success: boolean; error?: string }>;
  onRecordRead: (announcementId: string, userId: string) => Promise<void>;
  onUpdateConsent: (input: GuardianConsentInput) => Promise<{ success: boolean; error?: string }>;
}

type CommTab = "notices" | "emergency" | "templates" | "consent" | "ledger";

export function CommunicationsModule({
  announcements,
  templates,
  consents,
  smsLedger,
  ledgerSummary,
  onCreateAnnouncement,
  onInitiateEmergencyBroadcast,
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
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
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
  const emergencyCount = announcements.filter((a) => a.priority === "emergency").length;
  const totalTargetRecipients = announcements.reduce((s, a) => s + a.targetRecipientCount, 0);
  const totalReads = announcements.reduce((s, a) => s + a.readCount, 0);
  const avgReadRate =
    totalTargetRecipients > 0 ? Math.round((totalReads / totalTargetRecipients) * 100) : 0;
  const optInSmsCount = consents.filter((c) => c.optInSmsAnnouncements).length;
  const smsOptInRate =
    consents.length > 0 ? Math.round((optInSmsCount / consents.length) * 100) : 100;

  function handleUseTemplate(template: CommunicationTemplateItem) {
    if (template.defaultPriority === "emergency") {
      setShowEmergencyModal(true);
    } else {
      setSelectedTemplateForCreate(template);
      setShowCreateModal(true);
    }
  }

  function handleToggleConsent(consent: GuardianConsentRecord, field: "announcements" | "attendance" | "emergency") {
    startTransition(async () => {
      const updated: GuardianConsentInput = {
        guardianId: consent.guardianId,
        phone: consent.phone,
        optInSmsAnnouncements:
          field === "announcements" ? !consent.optInSmsAnnouncements : consent.optInSmsAnnouncements,
        optInSmsAttendance:
          field === "attendance" ? !consent.optInSmsAttendance : consent.optInSmsAttendance,
        optInSmsEmergency:
          field === "emergency" ? !consent.optInSmsEmergency : consent.optInSmsEmergency,
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
      <div className="border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                School Communications Hub
              </h1>
              <Badge tone="blue" className="font-mono text-[10px]">
                PHASE 4
              </Badge>
              {emergencyCount > 0 && (
                <span className="inline-flex items-center gap-1 border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-600 animate-pulse" />
                  {emergencyCount} EMERGENCY BROADCASTS RECORDED
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Institutional notices, dual-party emergency dispatches, read tracking, consent registry, and telecommunications ledger.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowEmergencyModal(true)}
              className="h-8 rounded-none border-red-300 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 hover:text-red-800"
            >
              <WarningCircle weight="bold" className="mr-1.5 h-3.5 w-3.5 text-red-600" />
              Emergency Broadcast
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setSelectedTemplateForCreate(null);
                setShowCreateModal(true);
              }}
              className="h-8 rounded-none bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Plus weight="bold" className="mr-1.5 h-3.5 w-3.5" />
              New Announcement
            </Button>
          </div>
        </div>

        {/* Telemetry Metrics */}
        <div className="mt-3.5 grid grid-cols-2 gap-3 sm:grid-cols-5 text-xs">
          <div className="border border-slate-100 bg-slate-50/50 p-2.5">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Total Notices
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {totalAnnouncements}
            </span>
          </div>
          <div className="border border-slate-100 bg-slate-50/50 p-2.5">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Avg Read Rate
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {avgReadRate}%
            </span>
          </div>
          <div className="border border-slate-100 bg-slate-50/50 p-2.5">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              SMS Opt-In Rate
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {smsOptInRate}%
            </span>
          </div>
          <div className="border border-slate-100 bg-slate-50/50 p-2.5">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              SMS Dispatches
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-slate-900">
              {ledgerSummary.totalDispatches}
            </span>
          </div>
          <div className="border border-slate-100 bg-slate-50/50 p-2.5">
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              Telecom Spend
            </span>
            <span className="mt-0.5 font-mono text-base font-bold text-emerald-700">
              ${ledgerSummary.totalCost.toFixed(3)}
            </span>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs text-emerald-800 animate-in fade-in">
          {statusMessage}
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="border border-slate-200 bg-white">
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab("notices")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "notices"
                ? "border-blue-600 bg-white text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <Bell weight="bold" className="h-3.5 w-3.5" />
            Notice Board ({announcements.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("emergency")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "emergency"
                ? "border-red-600 bg-white text-red-700 font-bold"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <WarningCircle weight="bold" className="h-3.5 w-3.5 text-red-600" />
            Emergency Center ({emergencyCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "flex items-center gap-1.5 border-b-2 px-4 py-2.5 transition-colors uppercase tracking-wider text-[11px]",
              activeTab === "templates"
                ? "border-blue-600 bg-white text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
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
                ? "border-blue-600 bg-white text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
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
                ? "border-blue-600 bg-white text-blue-700"
                : "border-transparent text-slate-600 hover:text-slate-900",
            )}
          >
            <DeviceMobile weight="bold" className="h-3.5 w-3.5" />
            Delivery Ledger ({smsLedger.length})
          </button>
        </div>

        {/* TAB 1: NOTICES BOARD */}
        {activeTab === "notices" && (
          <div className="p-4 space-y-4">
            {/* Filter Bar */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between bg-slate-50 p-2.5 border border-slate-200 text-xs">
              <div className="relative flex-1 max-w-sm">
                <MagnifyingGlass className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter announcements by title, body, or author..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 w-full border border-slate-300 bg-white pl-8 pr-3 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={targetFilter}
                  onChange={(e) => setTargetFilter(e.target.value)}
                  className="h-8 border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Targets</option>
                  <option value="school">School-Wide</option>
                  <option value="grade">Grade Cohorts</option>
                  <option value="class">Class Sections</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className="h-8 border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Priorities</option>
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                  <option value="emergency">Emergency</option>
                </select>

                <select
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  className="h-8 border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
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
              <div className="border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
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
                        "border p-4 transition-all bg-white",
                        ann.priority === "emergency"
                          ? "border-red-300 bg-red-50/30"
                          : ann.priority === "urgent"
                            ? "border-amber-200"
                            : "border-slate-200 hover:border-slate-300",
                      )}
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {ann.priority === "emergency" ? (
                              <span className="border border-red-300 bg-red-600 text-white px-2 py-0.5 font-mono text-[10px] uppercase font-bold tracking-wider">
                                EMERGENCY
                              </span>
                            ) : ann.priority === "urgent" ? (
                              <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                                URGENT
                              </span>
                            ) : (
                              <span className="border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 uppercase">
                                NOTICE
                              </span>
                            )}

                            <span className="border border-slate-200 bg-white px-2 py-0.5 font-mono text-[10px] text-slate-600">
                              {ann.channels === "both" ? "IN-APP + SMS" : ann.channels === "sms" ? "SMS TEXT" : "IN-APP PORTAL"}
                            </span>

                            <span className="border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] text-slate-600">
                              {ann.targetLabel}
                            </span>

                            {ann.status === "scheduled" && (
                              <span className="border border-purple-200 bg-purple-50 px-2 py-0.5 font-mono text-[10px] text-purple-700">
                                SCHEDULED
                              </span>
                            )}
                          </div>

                          <h3 className="text-xs font-bold text-slate-900">{ann.title}</h3>
                          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
                            {ann.content}
                          </p>
                        </div>

                        {/* Read Receipt Progress */}
                        <div className="sm:text-right shrink-0 border border-slate-200 bg-slate-50 p-2.5 min-w-[170px]">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 uppercase tracking-wider font-semibold">
                              Read Rate
                            </span>
                            <span className="font-mono font-bold text-slate-800">
                              {readPct}%
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-slate-200 overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all",
                                readPct > 75 ? "bg-emerald-600" : readPct > 40 ? "bg-blue-600" : "bg-amber-600",
                              )}
                              style={{ width: `${readPct}%` }}
                            />
                          </div>
                          <span className="mt-1 block font-mono text-[10px] text-slate-500">
                            {ann.readCount} of {ann.targetRecipientCount} recipients
                          </span>
                        </div>
                      </div>

                      {/* Footer & Approvers */}
                      <div className="mt-3 flex flex-wrap items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                        <div className="flex items-center gap-3">
                          <span>
                            Author: <strong className="text-slate-700">{ann.authorName ?? "System"}</strong>
                          </span>
                          {ann.requiresTwoParty && (
                            <span className="inline-flex items-center gap-1 text-red-800 font-semibold">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Two-Party Signed: {ann.firstApproverName} + {ann.secondApproverName}
                            </span>
                          )}
                          <span>
                            Published: <span className="font-mono">{new Date(ann.createdAt).toLocaleDateString()}</span>
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
                          className="h-6 text-[10px] text-slate-600 hover:text-slate-900"
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

        {/* TAB 2: EMERGENCY COMMAND CENTER */}
        {activeTab === "emergency" && (
          <div className="p-4 space-y-4">
            <div className="border border-red-200 bg-red-50/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <WarningCircle weight="bold" className="h-5 w-5 text-red-600" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-red-950">
                      Emergency Crisis Operations & Safety Override
                    </h2>
                  </div>
                  <p className="mt-1 text-xs text-red-900 max-w-2xl">
                    Rapid crisis broadcast facility. In strict compliance with the Four-Eyes principle, an emergency transmission requires joint sign-off from two distinct executive officers.
                  </p>
                </div>
                <Button
                  onClick={() => setShowEmergencyModal(true)}
                  className="h-9 rounded-none bg-red-600 font-bold text-xs text-white hover:bg-red-700"
                >
                  <WarningCircle weight="bold" className="mr-1.5 h-4 w-4" />
                  Initiate Two-Party Emergency Broadcast
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Authorized Crisis Transmissions Log
              </h3>

              {announcements.filter((a) => a.priority === "emergency").length === 0 ? (
                <div className="border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                  No emergency broadcasts have been issued in the current academic year.
                </div>
              ) : (
                <div className="space-y-3">
                  {announcements
                    .filter((a) => a.priority === "emergency")
                    .map((em) => (
                      <div key={em.id} className="border-2 border-red-300 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <span className="border border-red-300 bg-red-100 px-2 py-0.5 font-mono text-[10px] font-bold text-red-900 uppercase">
                            EXECUTIVE EMERGENCY DISPATCH
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {new Date(em.createdAt).toLocaleString()}
                          </span>
                        </div>

                        <h4 className="mt-2 text-sm font-bold text-slate-950">{em.title}</h4>
                        <p className="mt-1 text-xs text-slate-700">{em.content}</p>

                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 pt-2.5 text-xs">
                          <div className="bg-slate-50 p-2 border border-slate-200">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">
                              1. Initiating Officer
                            </span>
                            <span className="font-semibold text-slate-900">
                              {em.firstApproverName ?? "Authorized Officer"}
                            </span>
                          </div>
                          <div className="bg-slate-50 p-2 border border-slate-200">
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">
                              2. Confirming Approver (Command)
                            </span>
                            <span className="font-semibold text-slate-900">
                              {em.secondApproverName ?? "Dr. Arthur Vance (Headmaster)"}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: INSTITUTIONAL TEMPLATES */}
        {activeTab === "templates" && (
          <div className="p-4 space-y-4">
            <div className="border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <h3 className="font-bold uppercase tracking-wider text-slate-900">
                Standard School Templates Library
              </h3>
              <p className="mt-0.5 text-slate-500">
                Pre-approved institutional language formats. Select a template to initiate a dispatch with standard parameters.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {templates.map((tpl) => (
                <div key={tpl.id} className="border border-slate-200 bg-white p-4 flex flex-col justify-between hover:border-slate-300">
                  <div>
                    <div className="flex items-center justify-between">
                      <Badge tone="slate" className="text-[10px] font-semibold text-slate-700">
                        {tpl.category}
                      </Badge>
                      <span className="font-mono text-[10px] text-slate-500 uppercase">
                        Channel: {tpl.suggestedChannel}
                      </span>
                    </div>

                    <h4 className="mt-2 text-xs font-bold text-slate-900">{tpl.title}</h4>
                    <p className="mt-1 text-[11px] text-slate-500">{tpl.description}</p>

                    <div className="mt-2.5 border border-slate-100 bg-slate-50/80 p-2.5 font-mono text-[11px] text-slate-800 leading-relaxed">
                      {tpl.contentTemplate}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end border-t border-slate-100 pt-2.5">
                    <Button
                      size="sm"
                      onClick={() => handleUseTemplate(tpl)}
                      className="h-7 rounded-none bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
                    >
                      Use Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: GUARDIAN CONSENT REGISTRY */}
        {activeTab === "consent" && (
          <div className="p-4 space-y-4">
            <div className="border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <h3 className="font-bold uppercase tracking-wider text-slate-900">
                Telecommunications Consent & TCPA Compliance Registry
              </h3>
              <p className="mt-0.5 text-slate-500">
                Institutional records of mobile SMS consent per guardian. General announcements and attendance notifications respect opt-outs. Emergency dispatches override circular opt-outs.
              </p>
            </div>

            <div className="border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    <th className="p-3">Guardian Name</th>
                    <th className="p-3">Student Enrolled</th>
                    <th className="p-3">Mobile Contact</th>
                    <th className="p-3 text-center">Announcements SMS</th>
                    <th className="p-3 text-center">Attendance SMS</th>
                    <th className="p-3 text-center">Emergency SMS</th>
                    <th className="p-3">Opt-Out Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consents.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-semibold text-slate-900">{c.guardianName}</td>
                      <td className="p-3 text-slate-600">{c.studentName}</td>
                      <td className="p-3 font-mono text-slate-700">{c.phone}</td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleConsent(c, "announcements")}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold border",
                            c.optInSmsAnnouncements
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-slate-300 bg-slate-100 text-slate-600",
                          )}
                        >
                          {c.optInSmsAnnouncements ? "OPTED IN" : "OPTED OUT"}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleConsent(c, "attendance")}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold border",
                            c.optInSmsAttendance
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-slate-300 bg-slate-100 text-slate-600",
                          )}
                        >
                          {c.optInSmsAttendance ? "OPTED IN" : "OPTED OUT"}
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleConsent(c, "emergency")}
                          className={cn(
                            "px-2 py-0.5 text-[10px] font-bold border",
                            c.optInSmsEmergency
                              ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                              : "border-red-300 bg-red-50 text-red-800",
                          )}
                        >
                          {c.optInSmsEmergency ? "OPTED IN" : "BLOCKED"}
                        </button>
                      </td>
                      <td className="p-3 text-slate-500 text-[11px] max-w-xs truncate">
                        {c.optOutReason || "Standard enrollment consent"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: TELECOM & COST LEDGER */}
        {activeTab === "ledger" && (
          <div className="p-4 space-y-4">
            <div className="border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <h3 className="font-bold uppercase tracking-wider text-slate-900">
                Telecommunications Transit & Financial Audit Ledger
              </h3>
              <p className="mt-0.5 text-slate-500">
                Itemized telecommunication gateway records. Each SMS dispatch records GSM segment size and per-segment transit charge ($0.015).
              </p>
            </div>

            <div className="border border-slate-200 bg-white overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Destination Mobile</th>
                    <th className="p-3">Announcement Title</th>
                    <th className="p-3 text-center">GSM Segments</th>
                    <th className="p-3 text-right">Cost (USD)</th>
                    <th className="p-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {smsLedger.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono text-slate-600 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <ClockCounterClockwise className="h-3 w-3 text-slate-400" />
                          {new Date(item.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-900">{item.recipientName}</td>
                      <td className="p-3 font-mono text-slate-700">{item.recipientPhone}</td>
                      <td className="p-3 text-slate-700 max-w-xs truncate">{item.announcementTitle}</td>
                      <td className="p-3 text-center font-mono">{item.segments}</td>
                      <td className="p-3 text-right font-mono font-semibold text-slate-900">
                        ${item.cost.toFixed(3)}
                      </td>
                      <td className="p-3 text-center">
                        <span className="border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-800">
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

      {showEmergencyModal && (
        <EmergencyBroadcastDialog
          onClose={() => setShowEmergencyModal(false)}
          onSubmit={async (input) => {
            const res = await onInitiateEmergencyBroadcast(input);
            if (res.success) {
              setStatusMessage("CRITICAL: Emergency broadcast authorized and dispatched school-wide.");
              setTimeout(() => setStatusMessage(null), 4000);
            }
          }}
        />
      )}
    </div>
  );
}
