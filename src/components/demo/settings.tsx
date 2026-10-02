"use client";
import { type StaffRecord, type InvitationRecord, type StudentRecord } from "./types";
import { type OrganizationRecord, type OnboardingChecklist } from "@/lib/tenant-admin";
import { type GdprRequestRecord } from "@/lib/gdpr";
import { type RestoreDrillRecord } from "@/lib/drills";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { UserPlus, UsersThree, ShieldCheck, Buildings, LockKey, FileText } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { GdprCompliancePanel } from "@/components/settings/gdpr-compliance-panel";
import { MultiSchoolPanel } from "@/components/settings/multi-school-panel";
import { SecurityCompliancePanel } from "@/components/settings/security-compliance-panel";
import { OpenApiExplorerPanel } from "@/components/settings/openapi-explorer-panel";

export function SettingsModule({
  staff,
  invitations,
  onInviteStaff,
  currentOrganization,
  organizations,
  onboardingChecklists,
  gdprRequests,
  restoreDrills,
  students,
  currentUserRole,
  currentUserId,
  currentUserName,
  onSwitchSchool,
  onSchoolProvisioned,
  onRequestCreated,
  onStudentAnonymized,
}: {
  staff: StaffRecord[];
  invitations: InvitationRecord[];
  onInviteStaff: () => void;
  currentOrganization: OrganizationRecord;
  organizations: OrganizationRecord[];
  onboardingChecklists: Record<string, OnboardingChecklist>;
  gdprRequests: GdprRequestRecord[];
  restoreDrills: RestoreDrillRecord[];
  students: StudentRecord[];
  currentUserRole: string;
  currentUserId: string;
  currentUserName: string;
  onSwitchSchool: (org: OrganizationRecord) => void;
  onSchoolProvisioned: (org: OrganizationRecord, checklist: OnboardingChecklist) => void;
  onRequestCreated: (req: GdprRequestRecord) => void;
  onStudentAnonymized: (stId: string, updated: { firstName: string; lastName: string; dateOfBirth: string; status: "Active" | "Pending" | "Withdrawn" }) => void;
}) {
  const [settingsTab, setSettingsTab] = useState<"staff" | "gdpr" | "tenants" | "security" | "openapi">("staff");

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings & Policies</h1>
          <p className="text-xs text-slate-600">Enterprise security, multi-institution administration, and statutory regulatory compliance.</p>
        </div>
        {settingsTab === "staff" && (
          <Button onClick={onInviteStaff}><UserPlus size={16} />Invite Staff</Button>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: "staff" as const, label: "Staff & Access Control", icon: UsersThree },
          { key: "gdpr" as const, label: "GDPR Privacy & Data Rights", icon: ShieldCheck },
          { key: "tenants" as const, label: "Multi-School Institutions", icon: Buildings },
          { key: "security" as const, label: "Security & ASVS Level 2", icon: LockKey },
          { key: "openapi" as const, label: "OpenAPI 3.1 & Developer Reference", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = settingsTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSettingsTab(tab.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer",
                isActive
                  ? "border-blue-600 text-blue-900 bg-blue-50/40"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              <Icon size={16} weight={isActive ? "bold" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {settingsTab === "staff" && (
        <div className="space-y-6">
          <div className="border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
            <ShieldCheck size={24} className="text-blue-700 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-blue-950">Mandatory Staff MFA Active</h2>
              <p className="text-xs text-blue-800">All administrative and faculty accounts require TOTP two-factor authentication.</p>
            </div>
          </div>

          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">Staff Accounts</div>
            <table className="w-full border-collapse text-left">
              <tbody>
                {staff.map((usr) => (
                  <tr key={usr.id} className="h-12 border-b border-slate-100">
                    <td className="px-4 text-xs font-semibold">{usr.name}</td>
                    <td className="px-4 text-xs font-mono text-slate-600">{usr.email}</td>
                    <td className="px-4 text-xs">{usr.role}</td>
                    <td className="px-4"><Badge tone="green">TOTP Verified</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {invitations.length > 0 && (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">Pending Staff Invitations</div>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-2">Mobile number</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Delivery</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="h-10 border-b border-slate-100 text-xs">
                      <td className="px-4 font-medium text-slate-800">{inv.phoneNumber}</td>
                      <td className="px-4"><Badge tone="blue">{inv.role}</Badge></td>
                      <td className="px-4 font-mono text-slate-500">Not sent (demo)</td>
                      <td className="px-4"><Badge tone="amber">Simulated</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {settingsTab === "gdpr" && (
        <GdprCompliancePanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          requests={gdprRequests}
          students={students}
          onRequestCreated={onRequestCreated}
          onStudentAnonymized={onStudentAnonymized}
        />
      )}

      {settingsTab === "tenants" && (
        <MultiSchoolPanel
          currentOrganization={currentOrganization}
          organizations={organizations}
          checklists={onboardingChecklists}
          onSwitchSchool={onSwitchSchool}
          onSchoolProvisioned={onSchoolProvisioned}
        />
      )}

      {settingsTab === "security" && (
        <SecurityCompliancePanel
          initialDrills={restoreDrills}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}

      {settingsTab === "openapi" && (
        <OpenApiExplorerPanel />
      )}
    </div>
  );
}
