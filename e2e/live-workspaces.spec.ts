import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import postgres, { type Sql } from "postgres";
import { expect, test, type Page } from "@playwright/test";

const school = randomUUID();
const tenant = `browser-${school.slice(0, 8)}`;
const year = randomUUID();
const grade = randomUUID();
const classA = randomUUID();
const classB = randomUUID();
const childA = randomUUID();
const childB = randomUUID();
const guardian = randomUUID();
const roles = ["school_admin", "office_staff", "teacher", "guardian"] as const;
const users = Object.fromEntries(roles.map(role => [role, `browser-${role}-${randomUUID()}`]));
const password = "BrowserTestPassword123!";
let owner: Sql;

test.beforeAll(async () => {
  const url = process.env.RLS_TEST_ADMIN_URL!;
  if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(url).hostname)) throw new Error("Use a local disposable test database.");
  owner = postgres(url, { max: 1 });
  const hashedPassword = await hashPassword(password);
  await owner.begin(async tx => {
    await tx`INSERT INTO organizations (id, name, slug) VALUES (${school}, 'Browser Test School', ${tenant})`;
    for (const role of roles) {
      const user = users[role];
      await tx`INSERT INTO users (id, name, email, username, display_username, organization_id, role)
        VALUES (${user}, ${role}, ${`${user}@invalid.example`}, ${`${tenant}:${role}`}, ${role}, ${school}, ${role === 'guardian' ? null : role})`;
      await tx`INSERT INTO accounts (id, account_id, provider_id, user_id, password)
        VALUES (${randomUUID()}, ${user}, 'credential', ${user}, ${hashedPassword})`;
      if (role !== "guardian") await tx`INSERT INTO organization_memberships (organization_id, user_id, role)
        VALUES (${school}, ${user}, ${role})`;
    }
    await tx`INSERT INTO academic_years (id, organization_id, name, starts_on, ends_on, is_current)
      VALUES (${year}, ${school}, '2026', '2026-01-01', '2026-12-31', true)`;
    await tx`INSERT INTO terms (organization_id, academic_year_id, name, starts_on, ends_on, position)
      VALUES (${school}, ${year}, 'Annual term', '2026-01-01', '2026-12-31', 1)`;
    await tx`INSERT INTO grade_levels (id, organization_id, name, position) VALUES (${grade}, ${school}, 'Basic 5', 5)`;
    await tx`INSERT INTO classes (id, organization_id, academic_year_id, grade_level_id, name, homeroom_teacher_id) VALUES
      (${classA}, ${school}, ${year}, ${grade}, 'Assigned class', ${users.teacher}),
      (${classB}, ${school}, ${year}, ${grade}, 'Other class', NULL)`;
    await tx`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth, status) VALUES
      (${childA}, ${school}, 'BROWSER-1', 'Linked', 'Pupil', '2015-01-01', 'active'),
      (${childB}, ${school}, 'BROWSER-2', 'Unrelated', 'Pupil', '2015-01-01', 'active')`;
    await tx`INSERT INTO enrollments (organization_id, student_id, academic_year_id, class_id, status, starts_on) VALUES
      (${school}, ${childA}, ${year}, ${classA}, 'active', '2026-01-01'),
      (${school}, ${childB}, ${year}, ${classB}, 'active', '2026-01-01')`;
    await tx`INSERT INTO guardians (id, organization_id, user_id, first_name, last_name)
      VALUES (${guardian}, ${school}, ${users.guardian}, 'Test', 'Guardian')`;
    await tx`INSERT INTO student_guardians (organization_id, student_id, guardian_id, relationship, has_legal_responsibility)
      VALUES (${school}, ${childA}, ${guardian}, 'parent', true)`;
  });
});

test.afterAll(async () => {
  if (!owner) return;
  await owner.begin(async tx => {
    await tx`DELETE FROM audit_events WHERE organization_id = ${school}`;
    await tx`DELETE FROM subjects WHERE organization_id = ${school}`;
    await tx`DELETE FROM enrollments WHERE organization_id = ${school}`;
    await tx`DELETE FROM student_guardians WHERE organization_id = ${school}`;
    await tx`DELETE FROM guardians WHERE organization_id = ${school}`;
    await tx`DELETE FROM students WHERE organization_id = ${school}`;
    await tx`DELETE FROM classes WHERE organization_id = ${school}`;
    await tx`DELETE FROM grade_levels WHERE organization_id = ${school}`;
    await tx`DELETE FROM terms WHERE organization_id = ${school}`;
    await tx`DELETE FROM academic_years WHERE organization_id = ${school}`;
    await tx`DELETE FROM users WHERE organization_id = ${school}`;
    await tx`DELETE FROM organizations WHERE id = ${school}`;
  });
  await owner.end();
});

async function signIn(page: Page, role: typeof roles[number]) {
  // Model separate clients behind the local test proxy. Production authentication
  // rate limits remain enabled, rather than sharing one IP across every account.
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": `192.0.2.${roles.indexOf(role) + 1}` });
  await page.goto("/login");
  await page.getByLabel("Tenant ID", { exact: true }).fill(tenant);
  await page.getByLabel("Username", { exact: true }).fill(role);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL("https://localhost:3107/");
  const sessionCookie = (await page.context().cookies()).find(cookie => cookie.name.endsWith("session_token"));
  expect(sessionCookie?.secure).toBe(true);
}

test("anonymous school access redirects to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Klassa sign in" })).toBeVisible();
});

test("administrator can save a school subject with an audit entry", async ({ page }) => {
  await signIn(page, "school_admin");
  await page.goto("/?section=subjects");
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject code", { exact: true }).fill("E2E");
  await page.getByLabel("Subject name", { exact: true }).fill("Browser verified subject");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("cell", { name: "Browser verified subject", exact: true })).toBeVisible();
  expect(await owner`SELECT id FROM audit_events WHERE organization_id = ${school} AND entity_type = 'subject'`).toHaveLength(1);
});

test("office staff see the roster without administrator navigation", async ({ page }) => {
  await signIn(page, "office_staff");
  await page.goto("/?section=students");
  await expect(page.getByText("Linked Pupil", { exact: true })).toBeVisible();
  await expect(page.getByText("Unrelated Pupil", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Staff & access", exact: true })).toHaveCount(0);
});

test("teacher sees only pupils in assigned classes", async ({ page }) => {
  await signIn(page, "teacher");
  await page.getByRole("link", { name: "My classes", exact: true }).click();
  await expect(page.getByText("Linked Pupil", { exact: true })).toBeVisible();
  await expect(page.getByText("Unrelated Pupil", { exact: true })).toHaveCount(0);
});

test("guardian signs in to only their legally linked pupil", async ({ page }) => {
  await signIn(page, "guardian");
  await expect(page.getByRole("heading", { name: "Your students", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Linked Pupil", exact: true })).toBeVisible();
  await expect(page.getByText("Unrelated Pupil", { exact: true })).toHaveCount(0);
});
