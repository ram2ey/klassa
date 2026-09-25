"use client";

import { useState, useTransition } from "react";
import {
  Buildings, Plus, CheckCircle,
  Gear, X, ArrowRight,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="flex items-start justify-between rounded-xs border border-slate-300 bg-white p-4 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Buildings size={20} className="text-blue-700" weight="bold" />
            <h2 className="text-base font-bold text-slate-900">
              Multi-School Tenant Administration & Expansion
            </h2>
            <span className="rounded-xs border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              Multi-Tenant Architecture
            </span>
          </div>
          <p className="text-xs text-slate-600">
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
            academicYearCreated: false,
            safeguardingLeadDesignated: false,
            initialRosterImported: false,
          };
          const progress = calculateOnboardingProgress(checklist);

          return (
            <div
              key={org.id}
              className={`border p-4 bg-white space-y-3 rounded-xs ${
                isCurrent ? "border-blue-600 ring-1 ring-blue-600" : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900">{org.name}</span>
                    {isCurrent && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 border border-blue-200">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500">{org.domain}</div>
                </div>

                <Badge tone={org.status === "active" ? "green" : "amber"}>
                  {org.status === "active" ? "Operational" : "Provisioning"}
                </Badge>
              </div>

              <div className="border-t border-slate-100 pt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Students</span>
                  <span className="font-semibold text-slate-800">{org.studentCount}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block uppercase">Grading Scheme</span>
                  <span className="font-semibold text-slate-800">
                    {org.gradingScheme === "letter" ? "A-F (4.0 GPA)" : "Standards-Based"}
                  </span>
                </div>
              </div>

              {/* Onboarding Progress Bar */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Onboarding Verification</span>
                  <span className="font-bold text-slate-800">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      progress === 100 ? "bg-emerald-600" : "bg-blue-600"
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
                  <span className="text-[11px] text-blue-700 font-semibold flex items-center gap-1">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section role="dialog" aria-modal="true" className="w-full max-w-md border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Onboarding Checklist — {selectedOrgForChecklist.name}
                </h3>
                <p className="text-xs text-slate-600">Statutory institutional readiness verification</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrgForChecklist(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-4 space-y-2 text-xs">
              {(() => {
                const ch = localChecklists[selectedOrgForChecklist.id] || {
                  domainVerified: false,
                  initialAdminInvited: false,
                  mfaPolicyActivated: false,
                  academicYearCreated: false,
                  safeguardingLeadDesignated: false,
                  initialRosterImported: false,
                };

                const items: Array<{ key: keyof OnboardingChecklist; label: string; desc: string }> = [
                  { key: "domainVerified", label: "Educational Domain Verified", desc: "DNS TXT & MX verification" },
                  { key: "initialAdminInvited", label: "Executive Admin Account Provisioned", desc: "Initial principal credentials" },
                  { key: "mfaPolicyActivated", label: "Mandatory Staff MFA Enforced", desc: "TOTP two-factor compliance" },
                  { key: "academicYearCreated", label: "Academic Year & Terms Configured", desc: "2026–27 calendar defined" },
                  { key: "safeguardingLeadDesignated", label: "Safeguarding Lead Appointed", desc: "Statutory child protection officer" },
                  { key: "initialRosterImported", label: "Student & Guardian Roster Ingested", desc: "Validated CSV import completed" },
                ];

                return items.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2.5 p-2 border border-slate-100 bg-slate-50 hover:bg-slate-100/70 cursor-pointer rounded-xs"
                  >
                    <input
                      type="checkbox"
                      checked={ch[item.key]}
                      onChange={() => handleToggleChecklist(selectedOrgForChecklist.id, item.key, ch[item.key])}
                      disabled={isPending}
                      className="mt-0.5"
                    />
                    <div className="space-y-0.5">
                      <div className={`font-semibold ${ch[item.key] ? "text-slate-900" : "text-slate-600"}`}>
                        {item.label}
                      </div>
                      <div className="text-[10px] text-slate-500">{item.desc}</div>
                    </div>
                  </label>
                ));
              })()}
            </div>

            <div className="flex justify-end border-t border-slate-200 p-3 bg-slate-50">
              <Button size="sm" onClick={() => setSelectedOrgForChecklist(null)}>
                Done
              </Button>
            </div>
          </section>
        </div>
      )}

      {/* Provision School Modal */}
      {showProvisionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
          <section role="dialog" aria-modal="true" className="w-full max-w-lg border border-slate-300 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Provision New School Institution</h3>
                <p className="text-xs text-slate-600">Deploy an isolated tenant with dedicated schema boundaries.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowProvisionModal(false)}
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
                <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">School Legal Name</label>
                <input
                  type="text"
                  value={schoolName}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Westford Grammar School"
                  className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Subdomain Slug</label>
                  <input
                    type="text"
                    value={schoolSlug}
                    onChange={(e) => setSchoolSlug(e.target.value)}
                    placeholder="e.g. westford"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs font-mono focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Primary Domain</label>
                  <input
                    type="text"
                    value={schoolDomain}
                    onChange={(e) => setSchoolDomain(e.target.value)}
                    placeholder="e.g. westford.edu.is"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs font-mono focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Default Grading Model</label>
                  <select
                    value={schoolGradingScheme}
                    onChange={(e) => setSchoolGradingScheme(e.target.value as "letter" | "standards_based")}
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                  >
                    <option value="letter">Letter Grade (A–F, 4.0 GPA)</option>
                    <option value="standards_based">Standards-Based (4-point Rubric)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Timezone</label>
                  <p className="border border-slate-300 bg-slate-50 px-3 py-2 text-xs">GMT</p>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Initial Admin Name</label>
                  <input
                    type="text"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="e.g. Margaret Evans"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase text-slate-600 mb-1">Initial Admin Email</label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@westford.edu.is"
                    className="w-full border border-slate-300 bg-white px-3 py-2 text-xs focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-3 bg-slate-50">
              <Button variant="ghost" size="sm" onClick={() => setShowProvisionModal(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleProvision} disabled={isPending || !schoolName || !schoolDomain}>
                Deploy School Tenant
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
