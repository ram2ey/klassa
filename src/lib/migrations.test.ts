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
  it("guards every fixture-backed server action before executing its body", () => {
    for (const file of readdirSync("src/app/actions").filter(file => file.endsWith(".ts") && !["invitation-actions.ts", "school-access-actions.ts"].includes(file))) {
      const source = readFileSync(`src/app/actions/${file}`, "utf8");
      const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
      for (const node of ast.statements) {
        if (!ts.isFunctionDeclaration(node) || !node.body || !node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
        const first = node.body.statements[0].getText(ast);
        if (file === "roster-actions.ts" && ["createStudentAction", "updateStudentStatusAction"].includes(node.name!.text)) {
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
