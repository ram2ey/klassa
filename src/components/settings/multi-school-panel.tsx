"use client";

import { useState, useTransition } from "react";
import {
  Buildings, Plus, CheckCircle,
  Gear, ArrowRight,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Overlay } from "@/components/ui/overlay";
import type {
  OrganizationRecord,
  OnboardingChecklist,
} from "@/lib/tenant-admin";
import { calculateOnboardingProgress } from "@/lib/tenant-admin";
import {
  provisionSchoolAction,
  updateOnboardingChecklistAction,
} from "@/app/actions/tenant-actions";

interface MultiSchoolPanelProps {
  currentOrganization: OrganizationRecord;
  organizations: OrganizationRecord[];
  checklists: Record<string, OnboardingChecklist>;
  onSwitchSchool: (org: OrganizationRecord) => void;
  onSchoolProvisioned: (org: OrganizationRecord, checklist: OnboardingChecklist) => void;
}

export function MultiSchoolPanel({
  currentOrganization,
  organizations,
  checklists,
  onSwitchSchool,
  onSchoolProvisioned,
}: MultiSchoolPanelProps) {
  const [localOrgs, setLocalOrgs] = useState<OrganizationRecord[]>(organizations);
  const [localChecklists, setLocalChecklists] = useState<Record<string, OnboardingChecklist>>(checklists);
  const [showProvisionModal, setShowProvisionModal] = useState(false);
  const [selectedOrgForChecklist, setSelectedOrgForChecklist] = useState<OrganizationRecord | null>(null);
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Provision Form
  const [schoolName, setSchoolName] = useState("");
  const [schoolSlug, setSchoolSlug] = useState("");
  const [schoolDomain, setSchoolDomain] = useState("");
  const [schoolGradingScheme, setSchoolGradingScheme] = useState<"letter" | "standards_based">("letter");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");

  const handleNameChange = (val: string) => {
    setSchoolName(val);
    if (!schoolSlug) {
      setSchoolSlug(val.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
    }
  };

  const handleProvision = () => {
    setFormError("");
    startTransition(async () => {
      const res = await provisionSchoolAction({
        name: schoolName,
        slug: schoolSlug,
        domain: schoolDomain,
        gradingScheme: schoolGradingScheme,
        adminName,
        adminEmail,
      });

      if (res.success && res.organization && res.checklist) {
        setLocalOrgs((prev) => [...prev, res.organization]);
        setLocalChecklists((prev) => ({ ...prev, [res.organization.id]: res.checklist }));
        onSchoolProvisioned(res.organization, res.checklist);
        setShowProvisionModal(false);
        setSchoolName("");
        setSchoolSlug("");
        setSchoolDomain("");
        setAdminName("");
        setAdminEmail("");
      } else {
        setFormError(res.error || "Failed to provision school.");
      }
    });
  };

  const handleToggleChecklist = (orgId: string, itemKey: keyof OnboardingChecklist, currentVal: boolean) => {
    startTransition(async () => {
      const res = await updateOnboardingChecklistAction(orgId, itemKey, !currentVal);
      if (res.success && res.checklist) {
        setLocalChecklists((prev) => ({ ...prev, [orgId]: res.checklist }));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex items-start justify-between rounded-card border border-line-subtle bg-surface p-4 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Buildings size={20} className="text-primary" weight="bold" />
            <h2 className="text-base font-bold text-ink">
              Multi-School Tenant Administration & Expansion
            </h2>
            <span className="rounded-control border border-primary/20 bg-primary-subtle px-2 py-0.5 text-[10px] font-bold text-primary-hover">
              Multi-Tenant Architecture
            </span>
          </div>
          <p className="text-xs text-secondary">
            Manage multi-institution deployments, onboarding workflows, isolated database schemas, and administrator delegations.
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setShowProvisionModal(true)}
          className="gap-1.5 text-xs"
        >
          <Plus size={14} weight="bold" />
          Provision New School
        </Button>
      </div>

      {/* Organizations Directory */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {localOrgs.map((org) => {
          const isCurrent = org.id === currentOrganization.id;
          const checklist = localChecklists[org.id] || {
            domainVerified: false,
            initialAdminInvited: false,
            mfaPolicyActivated: false,
            academicYearCreated: false,            initialRosterImported: false,
          };
          const progress = calculateOnboardingProgress(checklist);

          return (
            <div
              key={org.id}
              className={`rounded-card border p-4 bg-surface space-y-3 shadow-card ${
                isCurrent ? "border-primary ring-1 ring-primary" : "border-line"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-ink">{org.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] bg-primary-subtle text-primary-hover font-bold px-1.5 py-0.2 border border-primary/20">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-muted">{org.domain}</div>
                </div>

                <Badge tone={org.status === "active" ? "green" : "amber"}>
                  {org.status === "active" ? "Operational" : "Provisioning"}
                </Badge>
              </div>

              <div className="border-t border-line-subtle pt-2 grid grid-cols-2 gap-2 text-xs text-secondary">
                <div>
                  <span className="text-[10px] text-muted block uppercase">Students</span>
                  <span className="font-semibold text-ink">{org.studentCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted block uppercase">Grading Scheme</span>
                  <span className="font-semibold text-ink">
                    {org.gradingScheme === "letter" ? "Letter grades" : "Standards-Based"}
                  </span>
                </div>
              </div>

              {/* Onboarding Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted font-medium">Onboarding Verification</span>
                  <span className="font-bold text-ink">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-surface-subtle overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      progress === 100 ? "bg-emerald-600" : "bg-primary"
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedOrgForChecklist(org)}
                  className="text-[11px] h-7 px-2"
                >
                  <Gear size={12} className="mr-1" />
                  Checklist
                </Button>

                {!isCurrent ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSwitchSchool(org)}
                    className="text-[11px] h-7 gap-1"
                  >
                    Switch to School
                    <ArrowRight size={12} />
                  </Button>
                ) : (
                  <span className="text-[11px] text-primary font-semibold flex items-center gap-1">
                    <CheckCircle size={14} weight="fill" /> Selected
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Checklist Drawer/Modal */}
      {selectedOrgForChecklist && (
        <Overlay open onClose={() => setSelectedOrgForChecklist(null)} title={`Onboarding Checklist — ${selectedOrgForChecklist.name}`} description="Statutory institutional readiness verification">
            <div className="p-4 space-y-2 text-xs">
              {(() => {
                const ch = localChecklists[selectedOrgForChecklist.id] || {
                  domainVerified: false,
                  initialAdminInvited: false,
                  mfaPolicyActivated: false,
                  academicYearCreated: false,                  initialRosterImported: false,
                };

                const items: Array<{ key: keyof OnboardingChecklist; label: string; desc: string }> = [
                  { key: "domainVerified", label: "Educational Domain Verified", desc: "DNS TXT & MX verification" },
                  { key: "initialAdminInvited", label: "Executive Admin Account Provisioned", desc: "Initial principal credentials" },
                  { key: "mfaPolicyActivated", label: "Mandatory Staff MFA Enforced", desc: "TOTP two-factor compliance" },
                  { key: "academicYearCreated", label: "Academic Year & Terms Configured", desc: "2026–27 calendar defined" },                  { key: "initialRosterImported", label: "Student & Guardian Roster Ingested", desc: "Validated CSV import completed" },
                ];

                return items.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2.5 p-2 border border-line-subtle bg-surface-subtle hover:bg-surface-subtle/70 cursor-pointer rounded-control"
                  >
                    <input
                      type="checkbox"
                      checked={ch[item.key]}
                      onChange={() => handleToggleChecklist(selectedOrgForChecklist.id, item.key, ch[item.key])}
                      disabled={isPending}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className={`font-semibold ${ch[item.key] ? "text-ink" : "text-secondary"}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-muted">{item.desc}</div>
                    </div>
                  </label>
                ));
              })()}
            </div>

            <div className="flex justify-end border-t border-line p-3 bg-surface-subtle">
              <Button size="sm" onClick={() => setSelectedOrgForChecklist(null)}>
                Done
              </Button>
            </div>
          </Overlay>
      )}

      {/* Provision School Modal */}
      {showProvisionModal && (
        <Overlay open onClose={() => setShowProvisionModal(false)} title="Provision New School Institution" description="Deploy an isolated tenant with dedicated schema boundaries.">
            <div className="p-4 space-y-3 text-xs">
              {formError && (
                <div className="border border-rose-200 bg-rose-50 p-2.5 text-rose-800 text-xs">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold uppercase text-secondary mb-1">School Legal Name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Westford Grammar School"
                  className="ui-field w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-secondary mb-1">Subdomain Slug</label>
                  <input
                    type="text"
                    value={schoolSlug}
                    onChange={(e) => setSchoolSlug(e.target.value)}
                    placeholder="e.g. westford"
                    className="ui-field w-full text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-secondary mb-1">Primary Domain</label>
                  <input
                    type="text"
                    value={schoolDomain}
                    onChange={(e) => setSchoolDomain(e.target.value)}
                    placeholder="e.g. westford.edu.is"
                    className="ui-field w-full text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-secondary mb-1">Default Grading Model</label>
                  <select
                    value={schoolGradingScheme}
                    onChange={(e) => setSchoolGradingScheme(e.target.value as "letter" | "standards_based")}
                    className="ui-field w-full text-xs"
                  >
                    <option value="letter">Letter grades</option>
                    <option value="standards_based">Standards-Based (4-point Rubric)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-secondary mb-1">Timezone</label>
                  <p className="border border-line bg-surface-subtle px-3 py-2 text-xs">GMT</p>
                </div>
              </div>

              <div className="border-t border-line pt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-secondary mb-1">Initial Admin Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Margaret Evans"
                    className="ui-field w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-secondary mb-1">Initial Admin Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@westford.edu.is"
                    className="ui-field w-full text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line p-3 bg-surface-subtle">
              <Button variant="ghost" size="sm" onClick={() => setShowProvisionModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleProvision} disabled={isPending || !schoolName || !schoolDomain}>
                Deploy School Tenant
              </Button>
            </div>
          </Overlay>
      )}
    </div>
  );
}
