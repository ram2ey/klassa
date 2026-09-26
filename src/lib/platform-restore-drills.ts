import "server-only";

import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, restoreDrills, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";

export async function getPlatformRestoreDrillData() {
  await requirePlatformAdmin();
  const drills = await db.select({ id: restoreDrills.id, organizationId: restoreDrills.organizationId,
    schoolName: organizations.name, drillDate: restoreDrills.drillDate,
    backupFilename: restoreDrills.backupFilename, backupSizeBytes: restoreDrills.backupSizeBytes,
    checksumSha256: restoreDrills.checksumSha256, checksumVerified: restoreDrills.checksumVerified,
    rpoHoursValidated: restoreDrills.rpoHoursValidated, rtoMinutesElapsed: restoreDrills.rtoMinutesElapsed,
    reconciledStudents: restoreDrills.reconciledStudents,
    reconciledGuardians: restoreDrills.reconciledGuardians, reconciledCases: restoreDrills.reconciledCases,
    status: restoreDrills.status, operatorName: users.name, notes: restoreDrills.notes })
    .from(restoreDrills).innerJoin(organizations, eq(organizations.id, restoreDrills.organizationId))
    .leftJoin(users, eq(users.id, restoreDrills.operatorId))
    .orderBy(desc(restoreDrills.drillDate), desc(restoreDrills.id)).limit(50);
  return { drills };
}

export type PlatformRestoreDrillData = Awaited<ReturnType<typeof getPlatformRestoreDrillData>>;
