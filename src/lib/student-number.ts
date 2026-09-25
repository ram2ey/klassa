import { sql } from "drizzle-orm";
import { db } from "@/db";
import { studentNumberCounters } from "@/db/schema";

/** Reserve a contiguous block within the caller's transaction. Rolled-back imports reuse the block. */
export async function allocateStudentNumbers(database: Pick<typeof db, "insert">, organizationId: string, count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || count > 1000) throw new Error("Invalid student number reservation.");
  const [counter] = await database.insert(studentNumberCounters).values({ organizationId, nextValue: count + 1 })
    .onConflictDoUpdate({ target: studentNumberCounters.organizationId,
      set: { nextValue: sql`${studentNumberCounters.nextValue} + ${count}` } })
    .returning({ nextValue: studentNumberCounters.nextValue });
  const first = counter.nextValue - count;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(counter.nextValue)) throw new Error("Student number range exhausted.");
  return Array.from({ length: count }, (_, index) => `ST-${String(first + index).padStart(6, "0")}`);
}
