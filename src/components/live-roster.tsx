"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { listLiveStudents } from "@/lib/live-roster";
import { createStudentAction, updateStudentStatusAction } from "@/app/actions/roster-actions";
import { provisionStaffForCurrentSchoolAction } from "@/app/actions/school-access-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AccountSignOut } from "@/components/account-sign-out";

const staffRoles = ["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"] as const;

function roleLabel(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

export function LiveRoster({ students, canManageStaff }: { students: Awaited<ReturnType<typeof listLiveStudents>>; canManageStaff: boolean }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function run(operation: () => Promise<unknown>, success: string | ((result: unknown) => string), failure = "The change could not be saved. Check the student number, class and grade, then retry. Contact your administrator if it persists.") {
    setMessage("");
    startTransition(async () => {
      try { const result = await operation(); setMessage(typeof success === "function" ? success(result) : success); router.refresh(); }
      catch { setMessage(failure); }
    });
  }
  return <main className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900">
    <nav className="flex items-center justify-between"><Link href="/schools" className="text-sm text-blue-700 underline">Switch school</Link><AccountSignOut /></nav>
    <header><h1 className="text-2xl font-bold">Klassa · Student roster</h1>
      <p className="mt-2 text-sm text-slate-600">Live student records for your school. Other workflows are currently available only in the local demo.</p></header>
    <p role="status" className="text-sm">{message}</p>
    <div className="overflow-x-auto rounded border border-slate-200 bg-white">
      <table className="w-full text-left text-sm"><caption className="sr-only">School student roster</caption>
        <thead className="bg-slate-100"><tr><th className="p-3">Student number</th><th>Name</th><th>Status</th><th>Update status</th></tr></thead>
        <tbody>{students.map(student => <tr key={student.id} className="border-t border-slate-200">
          <td className="p-3">{student.studentNumber}</td><td>{student.firstName} {student.lastName}</td><td>{student.status}</td>
          <td className="p-2"><Button variant="secondary" size="sm" disabled={pending}
            onClick={() => run(() => updateStudentStatusAction(student.studentNumber, student.status === "active" ? "Pending" : "Active"), "Status saved.")}>
            Mark {student.status === "active" ? "pending" : "active"}</Button></td>
        </tr>)}</tbody>
      </table>{students.length === 0 && <p className="p-4 text-sm text-slate-600">No students enrolled yet.</p>}
    </div>
    <section className="rounded border border-slate-200 bg-white p-5"><h2 className="font-bold">Enroll a student</h2>
      <p className="mt-1 text-sm text-slate-600">The grade and class must already exist in your school’s current academic year.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        const field = (name: string) => String(data.get(name) ?? "");
        run(async () => { await createStudentAction({ studentNumber: field("studentNumber"), firstName: field("firstName"),
          lastName: field("lastName"), dateOfBirth: field("dateOfBirth"), gradeLevel: field("gradeLevel"), className: field("className") }); form.reset(); }, "Student enrolled.");
      }}>
        {[["studentNumber", "Student number"], ["firstName", "First name"], ["lastName", "Last name"],
          ["dateOfBirth", "Date of birth"], ["gradeLevel", "Grade"], ["className", "Class"]].map(([name, label]) =>
          <label key={name} className="text-sm">{label}<input name={name} required type={name === "dateOfBirth" ? "date" : "text"}
            className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>)}
        <Button type="submit" disabled={pending}>Enroll student</Button>
      </form>
    </section>
    {canManageStaff && <section className="rounded border border-slate-200 bg-white p-5"><h2 className="font-bold">Create a staff account</h2>
      <p className="mt-1 text-sm text-slate-600">Assign access to this school directly. New staff must replace the temporary password and configure MFA before accessing school data.</p>
      <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={event => {
        event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
        run(async () => {
          const result = await provisionStaffForCurrentSchoolAction({
            administratorName: String(data.get("staffName") ?? ""),
            username: String(data.get("staffUsername") ?? ""),
            temporaryPassword: String(data.get("temporaryPassword") ?? ""),
            role: String(data.get("staffRole") ?? "office_staff") as typeof staffRoles[number],
          });
          form.reset();
          return result;
        }, result => { const account = result as { tenantId: string; username: string }; return `Staff account created. Login: ${account.tenantId} / ${account.username}. Share the temporary password securely.`; },
        "The staff account could not be created. Check the username is valid and not already in use at this school.");
      }}>
        <label className="text-sm sm:col-span-2">Full name<input name="staffName" required minLength={2} maxLength={180} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm">Username<input name="staffUsername" type="text" required minLength={3} maxLength={64} autoCapitalize="none" spellCheck={false} placeholder="j.smith" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
        <label className="text-sm">Role<select name="staffRole" defaultValue="office_staff" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2">{staffRoles.map(role => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label>
        <label className="text-sm sm:col-span-2">Temporary password<input name="temporaryPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
        <p className="text-xs text-slate-500 sm:col-span-2">Share the tenant ID, username and password through a secure channel. Klassa never displays the temporary password again.</p>
        <Button type="submit" disabled={pending}>Create staff account</Button>
      </form>
    </section>}
  </main>;
}
