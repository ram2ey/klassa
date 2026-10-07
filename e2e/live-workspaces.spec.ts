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
const subject = randomUUID();
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
    await tx`INSERT INTO subjects (id,organization_id,code,name) VALUES (${subject},${school},'MATH','Mathematics')`;
    await tx`INSERT INTO class_subjects (organization_id,class_id,subject_id) VALUES (${school},${classA},${subject})`;
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
    for (const table of ["mvp_operations","fee_payments","fee_entries","fee_definitions","fee_counters","report_card_subject_grades","report_cards","term_marks","class_subjects","attendance_corrections","attendance_records","attendance_sessions"]) await tx`DELETE FROM ${tx(table)} WHERE organization_id = ${school}`;
    await tx`DELETE FROM audit_events WHERE organization_id = ${school}`;
    await tx`DELETE FROM subjects WHERE organization_id = ${school}`;
    await tx`DELETE FROM enrollments WHERE organization_id = ${school}`;
    await tx`DELETE FROM guardian_consents WHERE organization_id = ${school}`;
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
  const health = await page.request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).checks.database.status).toBe("healthy");
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


test("office staff manage pupil contacts without deferred parent controls", async ({ page }) => {
  await signIn(page, "office_staff");
  await page.getByRole("link", { name: "Pupils", exact: true }).click();
  await expect(page.getByText("Linked Pupil", { exact: true })).toBeVisible();
  await expect(page.getByText("Unrelated Pupil", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Guardian contacts", exact: true }).click();
  await expect(page.getByRole("tab", { name: "SMS & phone verification" })).toHaveCount(0);
});

test("teacher sees assigned pupils and has no fee access", async ({ page }) => {
  await signIn(page, "teacher");
  await page.getByRole("link", { name: "My classes", exact: true }).click();
  await expect(page.getByText("Linked Pupil", { exact: true })).toBeVisible();
  await expect(page.getByText("Unrelated Pupil", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Fees", exact: true })).toHaveCount(0);
  await page.goto("/?section=fees");
  await expect(page).toHaveURL("https://localhost:3107/");
});

test("parent sign-in is unavailable for the staff-only release", async ({ page }) => {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": "192.0.2.44" });
  await page.goto("/login");
  await page.getByLabel("Tenant ID", { exact: true }).fill(tenant);
  await page.getByLabel("Username", { exact: true }).fill("guardian");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Sign in failed");
  await expect(page).toHaveURL(/\/login$/);
});

test("administrator completes attendance, marks, report publication and fee receipts", async ({ page }) => {
  page.on("pageerror", error => console.log("BROWSER ERROR:", error.message));
  page.on("console", message => { if(message.type() === "error") console.log("BROWSER CONSOLE:", message.text()); });
  await signIn(page, "school_admin");
  await expect(page.getByRole("navigation", { name: "School navigation" }).getByRole("link")).toHaveCount(6);
  await page.getByRole("link", { name: "Attendance", exact: true }).click();
  await page.getByLabel("Attendance for Linked Pupil", { exact: true }).selectOption("present");
  await page.getByRole("button", { name: "Submit daily register", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Daily register submitted");
  await page.getByRole("link", { name: "Marks & Reports", exact: true }).click();
  await page.getByLabel("Classwork for Linked Pupil", { exact: true }).fill("80");
  await page.getByLabel("Exam for Linked Pupil", { exact: true }).fill("75");
  await expect(page.getByRole("cell", { name: "77.00", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Save term marks", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Term marks saved");
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await page.getByRole("button", { name: "Select pupils with complete marks" }).click();
  await page.getByRole("button", { name: "Prepare report previews" }).click();
  await expect(page.getByRole("status")).toContainText("prepared for review");
  await page.getByRole("button", { name: "Publish 1 reports" }).click();
  await expect(page.getByRole("status")).toContainText("1 report(s) published");
  const reportLink = page.getByRole("link", { name: /published · Version 1/ });
  const reportPage = await page.context().newPage();
  await reportPage.goto((await reportLink.getAttribute("href"))!);
  await expect(reportPage.getByRole("heading", { name: "Pupil term report" })).toBeVisible();
  await expect(reportPage.getByRole("cell", { name: "77.00", exact: true })).toBeVisible();
  await expect(reportPage.getByText("GPA", { exact: true })).toHaveCount(0);
  await reportPage.screenshot({ path: ".cache/mvp-report.png", fullPage: true });
  await reportPage.emulateMedia({ media: "print" });
  await reportPage.pdf({ path: ".cache/mvp-report.pdf", format: "A4" });
  await reportPage.close();
  await page.getByRole("link", { name: "Fees", exact: true }).click();
  await page.getByLabel("Fee class", { exact: true }).selectOption(classA);
  await page.getByLabel("Fee term", { exact: true }).selectOption({ label: "Annual term" });
  await page.getByLabel("Fee name", { exact: true }).fill("Tuition");
  await page.getByLabel("Fee amount (GH₵)", { exact: true }).fill("450");
  await page.getByRole("button", { name: "Save class fee", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Class fee saved");
  const [definition] = await owner`SELECT id FROM fee_definitions WHERE organization_id = ${school}`;
  await page.getByLabel("Review class fee", { exact: true }).selectOption(definition.id);
  await page.getByRole("button", { name: "Select all 1 pupils", exact: true }).click();
  await page.getByRole("button", { name: "Apply reviewed charges", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("1 new charge(s) applied");
  await page.getByLabel("Pupil account", { exact: true }).selectOption(childA);
  await page.getByLabel("Amount received (GH₵)", { exact: true }).fill("100");
  await page.getByLabel("Payment method", { exact: true }).selectOption("cash");
  await page.getByRole("button", { name: "Record payment", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Receipt RC-");
  const receiptPage = await page.context().newPage();
  await receiptPage.goto((await page.getByRole("link", { name: "View / print the payment receipt" }).getAttribute("href"))!);
  await expect(receiptPage.getByRole("heading", { name: "Payment receipt", exact: true })).toBeVisible();
  await expect(receiptPage.getByText("GH₵350.00 owed", { exact: true })).toBeVisible();
  await receiptPage.screenshot({ path: ".cache/mvp-receipt.png", fullPage: true });
  await receiptPage.emulateMedia({ media: "print" });
  await receiptPage.pdf({ path: ".cache/mvp-receipt.pdf", format: "A4" });
  await receiptPage.close();
  const statementPage = await page.context().newPage();
  await statementPage.goto(`/fees/students/${childA}`);
  await expect(statementPage.getByRole("heading", { name: "Pupil fee statement", exact: true })).toBeVisible();
  await expect(statementPage.getByText("Amount owed: GH₵350.00", { exact: true })).toBeVisible();
  await statementPage.close();
  const balances = await page.request.get("/fees/export");
  expect(balances.status()).toBe(200);
  expect(await balances.text()).toContain('"BROWSER-1","Linked Pupil","350.00","0.00"');
  const [audit] = await owner`SELECT count(*)::int AS count FROM audit_events WHERE organization_id = ${school} AND action = 'mvp.payment'`;
  expect(audit.count).toBe(1);
  await page.goto("/?section=subjects");
  await expect(page).toHaveURL(/section=settings&tab=subjects/);
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page.getByLabel("Subject code", { exact: true }).fill("SCI");
  await page.getByLabel("Subject name", { exact: true }).fill("Science");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Science", { exact: true })).toBeVisible();
});


test("administrator configures class subjects, enrols and imports pupils, and uses mobile navigation", async ({ page }) => {
  await signIn(page, "school_admin");
  await page.goto("/?section=settings&tab=classes");
  await page.getByLabel("Class", { exact: true }).selectOption(classB);
  await page.getByRole("checkbox", { name: "Mathematics", exact: true }).check();
  await page.getByRole("button", { name: "Save class subjects", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Class subjects saved");
  await page.getByRole("link", { name: "Pupils", exact: true }).click();
  await page.getByRole("button", { name: "Enroll student", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Enrollment steps").getByRole("listitem")).toHaveCount(3);
  await dialog.getByLabel("First name", { exact: true }).fill("New");
  await dialog.getByLabel("Last name", { exact: true }).fill("Enrolment");
  await dialog.getByLabel("Date of birth", { exact: true }).fill("2016-05-06");
  await dialog.getByLabel("Class in current year", { exact: true }).selectOption(classB);
  await dialog.getByLabel("Enrollment status", { exact: true }).selectOption("active");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByText("Review enrollment", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Enroll student", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "New Enrolment", exact: true })).toBeVisible();
  await page.getByLabel("CSV file", { exact: true }).setInputFiles({ name: "pupils.csv", mimeType: "text/csv", buffer: Buffer.from("externalReference,firstName,middleName,lastName,preferredName,dateOfBirth,gradeLevel,className\nMVP-IMPORT,CSV,,Pupil,,2016-01-01,Basic 5,Other class\n") });
  await expect(page.getByText("1 valid rows · 0 invalid rows", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Import students", exact: true }).click();
  await expect(page.getByRole("status").filter({ hasText: "Imported 1 students" })).toBeVisible();
  await expect(page.getByRole("button", { name: "CSV Pupil", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation", exact: true }).click();
  await page.getByRole("link", { name: "Fees", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Pupil fee accounts", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: ".cache/mvp-mobile-fees.png", fullPage: true });
});
