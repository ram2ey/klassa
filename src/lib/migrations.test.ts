// @vitest-environment node
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { readMigrationFiles } from "drizzle-orm/migrator";
import ts from "typescript";

describe("deployment and action boundaries", () => {
  it("registers every SQL migration in order", () => {
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"));
    const files = readdirSync("drizzle").filter(file => file.endsWith(".sql")).sort();
    expect(journal.entries.map((entry: { tag: string }) => `${entry.tag}.sql`)).toEqual(files);
    expect(readMigrationFiles({ migrationsFolder: "drizzle" })).toHaveLength(files.length);
    for (let i = 1; i < journal.entries.length; i++) expect(journal.entries[i].when).toBeGreaterThan(journal.entries[i - 1].when);
  });
  it("references tables created before each foreign key", () => {
    const tables = new Set<string>();
    for (const migration of readMigrationFiles({ migrationsFolder: "drizzle" })) {
      for (const statement of migration.sql) {
        for (const match of statement.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/g)) {
          tables.add(match[1]);
        }
        for (const match of statement.matchAll(/REFERENCES "public"\."([^"]+)"/g)) {
          expect(tables.has(match[1]), `Unknown referenced table: ${match[1]}`).toBe(true);
        }
      }
    }
  });
  it("guards every fixture-backed server action before executing its body", () => {
    const liveActionFiles = ["guardian-portal-actions.ts", "invitation-actions.ts", "office-actions.ts", "password-actions.ts", "platform-account-actions.ts", "platform-admin-actions.ts", "platform-audit-actions.ts", "platform-incident-actions.ts", "platform-school-actions.ts", "school-access-actions.ts", "school-workflow-actions.ts", "student-enrollment-actions.ts", "teacher-actions.ts"];
    for (const file of readdirSync("src/app/actions").filter(file => file.endsWith(".ts") && !liveActionFiles.includes(file))) {
      const source = readFileSync(`src/app/actions/${file}`, "utf8");
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      for (const node of ast.statements) {
        if (!ts.isFunctionDeclaration(node) || !node.body || !node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
        const first = node.body.statements[0].getText(ast);
        if (file === "school-admin-actions.ts") {
          expect(first).toBe('const actor = await requireStaff(["school_admin"]);');
        } else if (file === "roster-actions.ts" && ["createStudentAction", "updateStudentStatusAction"].includes(node.name!.text)) {
          expect(first).toMatch(/^if \(!isDemoMode\(\)\) return (createLiveStudent|updateLiveStudentStatus)/);
        } else expect(first, `${file}:${node.name?.text}`).toBe("await requireDemoAction();");
      }
    }
  });
  it("stops a restore on SQL errors and ignores user psql startup files", () => {
    const restore = readFileSync("scripts/restore.sh", "utf8");
    expect(restore).toContain("--set=ON_ERROR_STOP=on --single-transaction");
    expect(restore).toContain("--no-psqlrc");
  });
});
