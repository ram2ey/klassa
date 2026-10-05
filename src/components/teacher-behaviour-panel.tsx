"use client";

import { useId, useMemo, useState } from "react";
import { Award, CheckCircle2, AlertTriangle, Eye, EyeOff, Sparkles, Filter } from "lucide-react";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";
import { praiseCategories, incidentCategories } from "@/lib/school-workflow-policy";
import type { studentBehaviours } from "@/db/schema";
import type { TeacherData } from "@/lib/teacher-data";

export interface TeacherBehaviourPanelProps {
  classes: TeacherData["classes"];
  students: TeacherData["students"];
  enrollments: TeacherData["enrollments"];
  behaviours: (typeof studentBehaviours.$inferSelect)[];
  defaultDate: string;
  pending: boolean;
  onSave: (command: WorkflowCommand) => void;
  isAdmin?: boolean;
}

const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export function TeacherBehaviourPanel({
  classes,
  students,
  enrollments,
  behaviours = [],
  defaultDate,
  pending,
  onSave,
}: TeacherBehaviourPanelProps) {
  const formId = useId();
  const [conductType, setConductType] = useState<"praise" | "incident">("praise");
  const [selectedClassId, setSelectedClassId] = useState(classes[0]?.id ?? "");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [category, setCategory] = useState<string>(praiseCategories[0]);
  const [points, setPoints] = useState<number>(1);
  const [guardianVisible, setGuardianVisible] = useState<boolean>(true);
  const [filterType, setFilterType] = useState<"all" | "praise" | "incident">("all");

  // Filter students based on selected class
  const classRoster = useMemo(() => {
    if (!selectedClassId) return students;
    const enrolledIds = new Set(
      enrollments
        .filter(row => row.classId === selectedClassId && row.status === "active")
        .map(row => row.studentId)
    );
    return students.filter(student => enrolledIds.has(student.id));
  }, [selectedClassId, enrollments, students]);

  // Handle conduct type switch
  const handleTypeChange = (newType: "praise" | "incident") => {
    setConductType(newType);
    setCategory(newType === "praise" ? praiseCategories[0] : incidentCategories[0]);
    setPoints(1);
  };

  // Calculate totals
  const totalPraise = behaviours
    .filter(b => b.type === "praise")
    .reduce((sum, b) => sum + b.points, 0);
  const totalIncidents = behaviours
    .filter(b => b.type === "incident")
    .reduce((sum, b) => sum + b.points, 0);
  const praiseCount = behaviours.filter(b => b.type === "praise").length;
  const incidentCount = behaviours.filter(b => b.type === "incident").length;
  const totalEntries = praiseCount + incidentCount;
  const positiveRatio = totalEntries > 0 ? Math.round((praiseCount / totalEntries) * 100) : 100;

  // Filtered behaviour list
  const filteredBehaviours = useMemo(() => {
    if (filterType === "all") return behaviours;
    return behaviours.filter(b => b.type === filterType);
  }, [behaviours, filterType]);

  const studentName = (id: string) => {
    const student = students.find(s => s.id === id);
    return student ? `${student.firstName} ${student.lastName}` : "Student";
  };

  const className = (id: string | null) => {
    if (!id) return "School-wide";
    const c = classes.find(item => item.id === id);
    return c ? c.name : "Class";
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const chosenStudentId = String(form.get("studentId") || selectedStudentId);
    if (!chosenStudentId) return;

    onSave({
      kind: "behaviour_log",
      studentId: chosenStudentId,
      classId: selectedClassId || null,
      type: conductType,
      category,
      points: Number(form.get("points") || points),
      description: String(form.get("description") || "").trim(),
      guardianVisible,
      occurredAt: String(form.get("occurredAt") || defaultDate),
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Statistics Bar */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border border-emerald-200 bg-emerald-50/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Praise & Merits Awarded
            </span>
            <Sparkles className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-950">+{totalPraise}</p>
          <p className="mt-1 text-xs text-emerald-700">{praiseCount} positive commendation{praiseCount === 1 ? "" : "s"}</p>
        </div>

        <div className="border border-rose-200 bg-rose-50/60 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-rose-800">
              Incident Sanctions
            </span>
            <AlertTriangle className="h-5 w-5 text-rose-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-rose-950">-{totalIncidents}</p>
          <p className="mt-1 text-xs text-rose-700">{incidentCount} sanction event{incidentCount === 1 ? "" : "s"}</p>
        </div>

        <div className="border border-line bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Positive Ratio
            </span>
            <Award className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-2 text-3xl font-bold text-ink">{positiveRatio}%</p>
          <p className="mt-1 text-xs text-muted">Conduct positive feedback balance</p>
        </div>
      </div>

      {/* Conduct Entry Card */}
      <section className="border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-4">
          <div>
            <h2 className="text-lg font-bold text-ink">Record Student Conduct</h2>
            <p className="mt-0.5 text-xs text-muted">
              Award merit points for positive behavior or log disciplinary sanctions.
            </p>
          </div>

          {/* Type Segmented Buttons */}
          <div className="inline-flex rounded-lg border border-line bg-surface-subtle p-1" role="radiogroup" aria-label="Conduct Type">
            <button
              type="button"
              role="radio"
              aria-checked={conductType === "praise"}
              onClick={() => handleTypeChange("praise")}
              className={`flex items-center gap-2 rounded-control px-4 py-2 text-xs font-semibold transition-all ${
                conductType === "praise"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-secondary hover:text-ink"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Praise (Merits +)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={conductType === "incident"}
              onClick={() => handleTypeChange("incident")}
              className={`flex items-center gap-2 rounded-control px-4 py-2 text-xs font-semibold transition-all ${
                conductType === "incident"
                  ? "bg-rose-700 text-white shadow-xs"
                  : "text-secondary hover:text-ink"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              Incident (Sanctions -)
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Class Selection */}
            <div>
              <label htmlFor={`${formId}-class`} className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                Class
              </label>
              <select
                id={`${formId}-class`}
                name="classId"
                value={selectedClassId}
                onChange={e => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudentId("");
                }}
                className="mt-1 block min-h-11 w-full border border-line bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                {classes.length === 0 && <option value="">No classes available</option>}
                {classes.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Student Selection */}
            <div>
              <label htmlFor={`${formId}-student`} className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                Student <span className="text-red-500">*</span>
              </label>
              <select
                id={`${formId}-student`}
                name="studentId"
                required
                value={selectedStudentId}
                onChange={e => setSelectedStudentId(e.target.value)}
                className="mt-1 block min-h-11 w-full border border-line bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                <option value="">Select student...</option>
                {classRoster.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName} {s.studentNumber ? `(${s.studentNumber})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Dropdown */}
            <div>
              <label htmlFor={`${formId}-category`} className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                id={`${formId}-category`}
                name="category"
                required
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="mt-1 block min-h-11 w-full border border-line bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
              >
                {conductType === "praise"
                  ? praiseCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {words(cat)}
                      </option>
                    ))
                  : incidentCategories.map(cat => (
                      <option key={cat} value={cat}>
                        {words(cat)}
                      </option>
                    ))}
              </select>
            </div>

            {/* Points Selector */}
            <div>
              <label htmlFor={`${formId}-points`} className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                Points ({conductType === "praise" ? "+" : "-"})
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`${formId}-points`}
                  name="points"
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={points}
                  onChange={e => setPoints(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                  className="block min-h-11 w-24 border border-line bg-surface px-3 py-2 text-sm font-semibold focus:border-primary focus:outline-hidden"
                />
                <div className="flex gap-1">
                  {[1, 2, 3, 5].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPoints(preset)}
                      className={`min-h-11 px-2.5 text-xs font-semibold border ${
                        points === preset
                          ? conductType === "praise"
                            ? "bg-emerald-100 border-emerald-600 text-emerald-900"
                            : "bg-rose-100 border-rose-600 text-rose-900"
                          : "bg-surface-subtle border-line text-secondary hover:bg-surface-subtle"
                      }`}
                    >
                      {conductType === "praise" ? `+${preset}` : `-${preset}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Notes / Description */}
            <div>
              <label htmlFor={`${formId}-description`} className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                Notes & Context (Optional)
              </label>
              <textarea
                id={`${formId}-description`}
                name="description"
                maxLength={1000}
                placeholder={
                  conductType === "praise"
                    ? "e.g., Actively assisted peers with challenging math exercises during group work..."
                    : "e.g., Spoke disrespectfully and interrupted instruction multiple times after warnings..."
                }
                className="mt-1 block min-h-20 w-full border border-line bg-surface p-3 text-sm focus:border-primary focus:outline-hidden"
              />
            </div>

            {/* Date & Guardian Visibility Guard */}
            <div className="flex flex-col justify-between space-y-3">
              <div>
                <label htmlFor={`${formId}-date`} className="block text-xs font-semibold uppercase tracking-wider text-secondary">
                  Event Date
                </label>
                <input
                  id={`${formId}-date`}
                  name="occurredAt"
                  type="date"
                  required
                  defaultValue={defaultDate}
                  className="mt-1 block min-h-11 w-full border border-line bg-surface px-3 py-2 text-sm focus:border-primary focus:outline-hidden"
                />
              </div>

              <label className="flex items-start gap-3 rounded-control border border-line bg-surface-subtle/80 p-3 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  name="guardianVisible"
                  checked={guardianVisible}
                  onChange={e => setGuardianVisible(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line text-primary focus:ring-primary"
                />
                <div>
                  <span className="font-semibold text-ink">
                    Visible to parents & guardians in portal
                  </span>
                  <p className="text-xs text-muted">
                    {conductType === "praise"
                      ? "Family will receive celebration feedback on student portal dashboard."
                      : "Family will be able to review this conduct note in the student overview."}
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={pending || !classRoster.length}
              className={`flex min-h-11 items-center gap-2 px-6 py-2 text-sm font-semibold text-white shadow-xs transition-opacity disabled:opacity-50 ${
                conductType === "praise"
                  ? "bg-emerald-700 hover:bg-emerald-800"
                  : "bg-rose-700 hover:bg-rose-800"
              }`}
            >
              {conductType === "praise" ? (
                <>
                  <Sparkles className="h-4 w-4" />
                  Award Praise (+{points} {points === 1 ? "point" : "points"})
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Record Incident (-{points} {points === 1 ? "point" : "points"})
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Behaviour Activity Feed */}
      <section className="border border-line bg-surface p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle pb-4">
          <div>
            <h2 className="text-base font-bold text-ink">Recent Conduct Log</h2>
            <p className="text-xs text-muted">
              Showing recent praise merits and disciplinary entries.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <div className="inline-flex rounded-control border border-line bg-surface-subtle p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilterType("all")}
                className={`rounded px-2.5 py-1 font-medium ${
                  filterType === "all" ? "bg-surface font-semibold text-ink shadow-xs" : "text-secondary"
                }`}
              >
                All ({behaviours.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("praise")}
                className={`rounded px-2.5 py-1 font-medium ${
                  filterType === "praise" ? "bg-emerald-600 font-semibold text-white shadow-xs" : "text-secondary"
                }`}
              >
                Praise ({praiseCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterType("incident")}
                className={`rounded px-2.5 py-1 font-medium ${
                  filterType === "incident" ? "bg-rose-700 font-semibold text-white shadow-xs" : "text-secondary"
                }`}
              >
                Incidents ({incidentCount})
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="py-2.5">Date</th>
                <th>Student</th>
                <th>Class</th>
                <th>Type & Category</th>
                <th>Points</th>
                <th>Visibility</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredBehaviours.map(item => (
                <tr key={item.id} className="hover:bg-surface-subtle/60">
                  <td className="py-3 text-xs text-secondary whitespace-nowrap">{item.occurredAt}</td>
                  <td className="font-semibold text-ink whitespace-nowrap">
                    {studentName(item.studentId)}
                  </td>
                  <td className="text-xs text-secondary whitespace-nowrap">{className(item.classId)}</td>
                  <td className="whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${
                        item.type === "praise"
                          ? "bg-emerald-50 text-emerald-800"
                          : "bg-rose-50 text-rose-800"
                      }`}
                    >
                      {item.type === "praise" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      )}
                      {words(item.category)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    <span
                      className={`inline-block font-mono text-xs font-bold ${
                        item.type === "praise" ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {item.type === "praise" ? `+${item.points}` : `-${item.points}`}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {item.guardianVisible ? (
                      <span className="inline-flex items-center gap-1 text-xs text-primary" title="Visible to family">
                        <Eye className="h-3.5 w-3.5" />
                        Portal visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted" title="Internal staff only">
                        <EyeOff className="h-3.5 w-3.5" />
                        Internal only
                      </span>
                    )}
                  </td>
                  <td className="max-w-xs text-xs text-secondary truncate" title={item.description ?? ""}>
                    {item.description || <span className="text-muted italic">No notes</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredBehaviours.length === 0 && (
            <div className="py-8 text-center text-sm text-muted">
              No conduct records found for the selected filter.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
