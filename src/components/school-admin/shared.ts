"use client";
import { LayoutDashboard, GraduationCap, UsersRound, Users, ClipboardList, BookOpen, CalendarDays, ClipboardCheck, NotebookPen, FileClock, Award, Megaphone, ShieldAlert, Settings } from "lucide-react";
import { type SchoolCommand } from "@/lib/school-admin-policy";

export const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "students", label: "Students", icon: GraduationCap },
  { id: "guardians", label: "Guardians", icon: UsersRound },
  { id: "staff", label: "Staff & access", icon: Users },
  { id: "classes", label: "Classes & grades", icon: ClipboardList },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "academic", label: "Academic years", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "gradebook", label: "Gradebook", icon: NotebookPen },
  { id: "reports", label: "Report cards", icon: FileClock },
  { id: "behaviour", label: "Behaviour & conduct", icon: Award },
  { id: "communications", label: "Communications", icon: Megaphone },
  { id: "sensitive", label: "Sensitive records", icon: ShieldAlert },
  { id: "audit", label: "Audit history", icon: FileClock },
  { id: "settings", label: "School settings", icon: Settings },
] as const;

export const roles = ["school_admin", "office_staff", "teacher"] as const;

export const fieldStyle = "mt-1.5 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600";

export const panelStyle = "border border-slate-200 bg-white";

export const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export type Editor = { kind: Exclude<SchoolCommand["kind"], "teacher_subject_assignment_remove" | "term_lock" | "term_unlock"> | "staff"; title: string; values?: Record<string, string | number | boolean | null> };

export type Option = { value: string; label: string };

export type Field = { name: string; label: string; type?: "text" | "date" | "email" | "password" | "number" | "checkbox"; required?: boolean; options?: Option[]; hint?: string; max?: number; min?: number; disabled?: boolean };
