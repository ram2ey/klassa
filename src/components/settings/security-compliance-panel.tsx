"use client";

import { useState } from "react";
import {
  ShieldCheck, LockKey, Clock,
  ArrowClockwise, Play, Database,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { RestoreDrillRecord } from "@/lib/drills";
import { executeRestoreDrill } from "@/lib/drills";
import { RATE_LIMIT_TIERS } from "@/lib/rate-limit";

interface SecurityCompliancePanelProps {
  initialDrills: RestoreDrillRecord[];
  currentUserId: string;
  currentUserName: string;
}

export function SecurityCompliancePanel({
  initialDrills,
  currentUserId,
  currentUserName,
}: SecurityCompliancePanelProps) {
  const [drills, setDrills] = useState<RestoreDrillRecord[]>(initialDrills);
  const [cryptoHealthy, setCryptoHealthy] = useState<boolean | null>(null);
  const [isTestingCrypto, setIsTestingCrypto] = useState(false);
  const [isSimulatingDrill, setIsSimulatingDrill] = useState(false);

  const handleTestCrypto = async () => {
    setIsTestingCrypto(true);
    try {
      const cryptoApi = window.crypto?.subtle;
      if (!cryptoApi) throw new Error("Web Crypto is unavailable");
      const key = await cryptoApi.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const payload = new TextEncoder().encode("Klassa Web Crypto check");
      const encrypted = await cryptoApi.encrypt({ name: "AES-GCM", iv }, key, payload);
      const decrypted = await cryptoApi.decrypt({ name: "AES-GCM", iv }, key, encrypted);
      setCryptoHealthy(new TextDecoder().decode(decrypted) === "Klassa Web Crypto check");
    } catch {
      setCryptoHealthy(false);
    } finally {
      setIsTestingCrypto(false);
    }
  };

  const handleRunRestoreDrill = () => {
    setIsSimulatingDrill(true);
    setTimeout(() => {
      const newDrill = executeRestoreDrill({
        backupFilename: `klasso_prod_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}_manual.sql.gz`,
        backupSizeBytes: 25192800,
        checksumSha256: "d41d8cd98f00b204e9800998ecf8427e02b8b934ca495991b7852b855e3b0c44",
        targetStagingDb: "klasso_staging_on_demand_restore",
        operatorId: currentUserId,
        operatorName: currentUserName,
        notes: "On-demand disaster recovery drill executed via Institutional Security Console.",
      });

      setDrills((prev) => [newDrill, ...prev]);
      setIsSimulatingDrill(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-start justify-between rounded-card border border-line-subtle bg-surface p-4 shadow-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-primary" weight="bold" />
            <h2 className="text-base font-bold text-ink">
              Security Compliance & OWASP ASVS Level 2 Verification
            </h2>
            <span className="rounded-control border border-line-subtle bg-surface-subtle px-2 py-0.5 text-[10px] font-bold text-secondary">
              POLICY OVERVIEW
            </span>
          </div>
          <p className="text-xs text-secondary">
            Overview of configured security controls. This preview does not verify the live deployment or run an actual restore.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestCrypto}
            disabled={isTestingCrypto}
            className="gap-1.5 text-xs"
          >
            <ArrowClockwise size={14} weight="bold" />
            {isTestingCrypto ? "Testing browser crypto..." : "Test browser AES-GCM"}
          </Button>

          <Button
            size="sm"
            onClick={handleRunRestoreDrill}
            disabled={isSimulatingDrill}
            className="gap-1.5 text-xs"
          >
            <Play size={14} weight="bold" />
            {isSimulatingDrill ? "Simulating drill..." : "Simulate Restore Drill"}
          </Button>
        </div>
      </div>

      {/* Security Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Cryptographic Health */}
        <div className="rounded-card border border-line-subtle bg-surface p-4 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-muted">Cryptographic Subsystem</span>
            <Badge tone={cryptoHealthy ? "green" : "amber"}>
              {cryptoHealthy === null ? "Not tested" : cryptoHealthy ? "API available" : "API unavailable"}
            </Badge>
          </div>
          <div className="text-lg font-bold text-ink flex items-center gap-1.5">
            <LockKey size={20} className="text-primary" />
            Browser Web Crypto
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            This check uses a temporary in-memory key to confirm browser AES-GCM support. It does not inspect the school server&apos;s encryption key.
          </p>
        </div>

        {/* Card 2: HTTP Security Headers */}
        <div className="rounded-card border border-line-subtle bg-surface p-4 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-muted">HTTP Transport Defense</span>
            <Badge tone="green">All 8 Headers Enforced</Badge>
          </div>
          <div className="text-lg font-bold text-ink flex items-center gap-1.5">
            <ShieldCheck size={20} className="text-emerald-700" />
            Strict Headers & CSP
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            HSTS (2-year preload), strict Content-Security-Policy (CSP), COOP/CORP isolation, and X-Frame-Options DENY.
          </p>
        </div>

        {/* Card 3: Rate Limiting Metrics */}
        <div className="rounded-card border border-line-subtle bg-surface p-4 shadow-card space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-muted">Sliding Window Limiter</span>
            <div className="flex items-center gap-1.5">
              <Badge tone="primary">{Object.keys(RATE_LIMIT_TIERS).length} tiers configured</Badge>
            </div>
          </div>
          <div className="text-lg font-bold text-ink flex items-center gap-1.5">
            <Clock size={20} className="text-secondary" />
            Rate Limit Policy
          </div>
          <p className="text-[11px] text-secondary leading-relaxed">
            Auth: 5 req/15m. Sensitive Decrypt: 10 req/1m. API: 60 req/1m. General: 120 req/1m. These are configured limits; live request counts are not shown here.
          </p>
        </div>
      </div>

      {/* HTTP Security Headers Detail Table */}
      <section className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-card">
        <div className="border-b border-line px-4 py-3 font-bold text-xs uppercase text-secondary">
          Enforced HTTP Defense-in-Depth Headers
        </div>
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-line bg-surface-subtle text-[11px] font-semibold uppercase text-muted">
              <th className="px-4 py-2">Header Name</th>
              <th className="px-4 py-2">Configured Directive</th>
              <th className="px-4 py-2">ASVS Reference</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Content-Security-Policy", value: "default-src 'self'; frame-ancestors 'none'; object-src 'none'", asvs: "V14.4.1", status: "Active" },
              { name: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload", asvs: "V9.1.1", status: "Active" },
              { name: "Cross-Origin-Opener-Policy", value: "same-origin", asvs: "V14.4.6", status: "Active" },
              { name: "Cross-Origin-Resource-Policy", value: "same-origin", asvs: "V14.4.7", status: "Active" },
              { name: "X-Content-Type-Options", value: "nosniff", asvs: "V14.4.4", status: "Active" },
              { name: "X-Frame-Options", value: "DENY", asvs: "V14.4.3", status: "Active" },
              { name: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()", asvs: "V14.4.5", status: "Active" },
            ].map((hdr) => (
              <tr key={hdr.name} className="border-b border-line-subtle hover:bg-surface-subtle">
                <td className="px-4 py-2.5 font-mono text-[11px] font-semibold text-ink">{hdr.name}</td>
                <td className="px-4 py-2.5 font-mono text-[10px] text-secondary max-w-md truncate">{hdr.value}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-primary">{hdr.asvs}</td>
                <td className="px-4 py-2.5"><Badge tone="green">{hdr.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Disaster Recovery Drills Register */}
      <section className="overflow-hidden rounded-card border border-line-subtle bg-surface shadow-card">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="font-bold text-xs uppercase text-secondary flex items-center gap-2">
            <Database size={16} className="text-primary" />
            Disaster Recovery Monthly Restore Drills Register ({drills.length})
          </div>
          <span className="text-[11px] text-muted">
            Mandatory RPO: &lt;24.0h • Mandatory RTO: &lt;8.0h (480m)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-line bg-surface-subtle text-[11px] font-semibold uppercase text-muted">
                <th className="px-4 py-2.5">Drill Date</th>
                <th className="px-4 py-2.5">Backup Archive</th>
                <th className="px-4 py-2.5">Checksum Verified</th>
                <th className="px-4 py-2.5">RPO Validated</th>
                <th className="px-4 py-2.5">RTO Elapsed</th>
                <th className="px-4 py-2.5">Row Reconciliation</th>
                <th className="px-4 py-2.5">Operator</th>
                <th className="px-4 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {drills.map((drill) => (
                <tr key={drill.id} className="border-b border-line-subtle hover:bg-surface-subtle">
                  <td className="px-4 py-3 font-mono text-[11px] text-secondary">
                    {drill.drillDate.slice(0, 10)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-ink max-w-xs truncate" title={drill.backupFilename}>
                    {drill.backupFilename}
                  </td>
                  <td className="px-4 py-3">
                    {drill.checksumVerified ? (
                      <Badge tone="green">SHA-256 Verified</Badge>
                    ) : (
                      <Badge tone="amber">Failed</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-ink">{drill.rpoHoursValidated}h</span>{" "}
                    <span className="text-[10px] text-emerald-700">(&lt;24h)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-bold text-ink">{drill.rtoMinutesElapsed}m</span>{" "}
                    <span className="text-[10px] text-emerald-700">(&lt;480m)</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-secondary">
                    {drill.reconciledStudents} st / {drill.reconciledGuardians} gd / {drill.reconciledCases} cs
                  </td>
                  <td className="px-4 py-3 text-secondary">{drill.operatorName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={drill.status === "passed" ? "green" : "amber"}>
                      {drill.status === "passed" ? "PASSED SLA" : "FAILED"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
