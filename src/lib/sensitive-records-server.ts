import crypto from "node:crypto";
import {
  type SensitiveCaseRecord,
  type CourtRestrictionRecord,
  type KlassoRole,
  type DisclosurePackageResult,
} from "./sensitive-records";

export * from "./sensitive-records";

export function generateDisclosurePackage(
  student: { id: string; name: string; studentNumber?: string },
  cases: SensitiveCaseRecord[],
  courtOrders: CourtRestrictionRecord[],
  requestingRole: KlassoRole,
  metadata?: { schoolName?: string; recipientAgency?: string }
): DisclosurePackageResult {
  const studentCases = cases.filter((c) => c.studentId === student.id);
  const activeOrders = courtOrders.filter((o) => o.studentId === student.id && o.isEnforced);

  let withheldSafeguarding = 0;
  const included: DisclosurePackageResult["includedRecords"] = [];

  for (const c of studentCases) {
    // Under safeguarding regulations, active child protection investigations are strictly withheld from standard disclosures
    if (c.area === "safeguarding" && requestingRole !== "school_admin") {
      withheldSafeguarding += 1;
      continue;
    }

    included.push({
      area: c.area,
      title: c.title,
      date: c.createdAt,
      status: c.status,
      redactedNotes: `[Official Institutional Summary: ${c.title} — Reviewed under school records policy.]`,
    });
  }

  const checksumPayload = `${student.id}:${included.length}:${withheldSafeguarding}:${Date.now()}`;
  const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex").substring(0, 16);

  return {
    studentName: student.name,
    studentNumber: student.studentNumber,
    dossierNumber: `DISCL-${student.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    generatedAt: new Date().toISOString(),
    schoolName: metadata?.schoolName,
    recipientAgency: metadata?.recipientAgency,
    includedRecords: included,
    withheldSafeguardingCount: withheldSafeguarding,
    activeCourtOrdersCount: activeOrders.length,
    digitalIntegrityChecksum: checksum,
  };
}
