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

const SETTINGS_TAB_KEYS = ["staff", "gdpr", "tenants", "security", "openapi"] as const;

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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Settings & Policies</h1>
          <p className="mt-1 text-xs text-secondary">Enterprise security, multi-institution administration, and statutory regulatory compliance.</p>
        </div>
        {settingsTab === "staff" && (
          <Button onClick={onInviteStaff} className="min-h-11"><UserPlus size={16} />Invite Staff</Button>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div role="tablist" aria-label="Settings sections" className="flex flex-wrap border-b border-line-subtle gap-1">
        {[
          { key: "staff" as const, label: "Staff & Access Control", icon: UsersThree },
          { key: "gdpr" as const, label: "GDPR Privacy & Data Rights", icon: ShieldCheck },
          { key: "tenants" as const, label: "Multi-School Institutions", icon: Buildings },
          { key: "security" as const, label: "Security & ASVS Level 2", icon: LockKey },
          { key: "openapi" as const, label: "OpenAPI 3.1 & Developer Reference", icon: FileText },
        ].map((tab, index) => {
          const Icon = tab.icon;
          const isActive = settingsTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              id={`settings-tab-${tab.key}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.key}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSettingsTab(tab.key)}
              onKeyDown={(event) => {
                const nextIndex = event.key === "ArrowRight" ? (index + 1) % SETTINGS_TAB_KEYS.length
                  : event.key === "ArrowLeft" ? (index - 1 + SETTINGS_TAB_KEYS.length) % SETTINGS_TAB_KEYS.length
                    : event.key === "Home" ? 0 : event.key === "End" ? SETTINGS_TAB_KEYS.length - 1 : -1;
                if (nextIndex < 0) return;
                event.preventDefault();
                const nextKey = SETTINGS_TAB_KEYS[nextIndex];
                setSettingsTab(nextKey);
                event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`#settings-tab-${nextKey}`)?.focus();
              }}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer rounded-t-control",
                isActive
                  ? "border-primary text-selected bg-primary-subtle"
                  : "border-transparent text-secondary hover:border-line hover:text-ink"
              )}
            >
              <Icon size={16} weight={isActive ? "bold" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`settings-panel-${settingsTab}`} aria-labelledby={`settings-tab-${settingsTab}`} tabIndex={0}>
      {settingsTab === "staff" && (
        <div className="space-y-6">
          <div className="rounded-card border border-primary/20 bg-primary-subtle p-5 flex items-center gap-3.5">
            <ShieldCheck size={28} className="text-primary shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-ink">Mandatory Staff MFA Active</h2>
              <p className="mt-0.5 text-xs text-secondary">All administrative and faculty accounts require TOTP two-factor authentication.</p>
            </div>
          </div>

          <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
            <div className="border-b border-line-subtle px-5 py-4 font-bold text-xs uppercase tracking-wider text-secondary">Staff Accounts</div>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <tbody className="divide-y divide-line-subtle">
                  {staff.map((usr) => (
                    <tr key={usr.id} className="h-12 hover:bg-surface-subtle transition-colors">
                      <td className="px-5 text-xs font-semibold text-ink">{usr.name}</td>
                      <td className="px-5 text-xs font-mono text-secondary">{usr.email}</td>
                      <td className="px-5 text-xs text-secondary">{usr.role}</td>
                      <td className="px-5"><Badge tone="green">TOTP Verified</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {invitations.length > 0 && (
            <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
              <div className="border-b border-line-subtle px-5 py-4 font-bold text-xs uppercase tracking-wider text-secondary">Pending Staff Invitations</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-line-subtle bg-surface-subtle text-[11px] font-semibold text-secondary uppercase tracking-wider">
                      <th className="px-5 py-3">Mobile number</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Delivery</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {invitations.map((inv) => (
                      <tr key={inv.id} className="h-11 hover:bg-surface-subtle transition-colors text-xs">
                        <td className="px-5 font-medium text-ink">{inv.phoneNumber}</td>
                        <td className="px-5"><Badge tone="primary">{inv.role}</Badge></td>
                        <td className="px-5 font-mono text-secondary">Not sent (demo)</td>
                        <td className="px-5"><Badge tone="amber">Simulated</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
    </div>
  );
}
