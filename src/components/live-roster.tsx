"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { listLiveStudents } from "@/lib/live-roster";
import { createStudentAction, updateStudentStatusAction } from "@/app/actions/roster-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { AccountSignOut } from "@/components/account-sign-out";

export function LiveRoster({ students }: { students: Awaited<ReturnType<typeof listLiveStudents>> }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  function run(operation: () => Promise<unknown>, success: string) {
    setMessage("");
    startTransition(async () => {
      try { await operation(); setMessage(success); router.refresh(); }
      catch { setMessage("The change could not be saved. Check the student number, class and grade, then retry. Contact your administrator if it persists."); }
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
  </main>;
}
