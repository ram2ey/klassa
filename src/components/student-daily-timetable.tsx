"use client";

import { useMemo, useState } from "react";
import {
  Calendar,
  Clock,
  GraduationCap,
  MapPin,
  Sparkles,
  BookOpen,
} from "lucide-react";
import type { DayOfWeek, TimetablePeriodItem } from "@/lib/timetable-service";

export type StudentDailyTimetableProps = {
  timetable: TimetablePeriodItem[];
  studentName?: string;
  className?: string;
  defaultDay?: DayOfWeek;
};

const DAYS: Array<{ key: DayOfWeek; label: string; short: string }> = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
];

function getTodayDay(): DayOfWeek {
  const dayIndex = new Date().getDay();
  switch (dayIndex) {
    case 1:
      return "monday";
    case 2:
      return "tuesday";
    case 3:
      return "wednesday";
    case 4:
      return "thursday";
    case 5:
      return "friday";
    default:
      return "monday";
  }
}

function getCurrentTimeHHMM(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function StudentDailyTimetable({
  timetable,
  studentName,
  className,
  defaultDay,
}: StudentDailyTimetableProps) {
  const today = useMemo(() => getTodayDay(), []);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(
    defaultDay ?? today
  );

  const dayPeriods = useMemo(() => {
    return timetable
      .filter((p) => p.dayOfWeek === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timetable, selectedDay]);

  const currentTime = getCurrentTimeHHMM();
  const isToday = selectedDay === today;

  return (
    <div className="space-y-4">
      {/* Day Selector Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 p-1.5">
        {DAYS.map(({ key, label, short }) => {
          const isSelected = selectedDay === key;
          const isCurrentDay = today === key;
          const count = timetable.filter((p) => p.dayOfWeek === key).length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                isSelected
                  ? "bg-white text-blue-900 shadow-sm"
                  : "text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
              }`}
            >
              <span>{short}</span>
              {isCurrentDay && (
                <span className="rounded bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-blue-800">
                  Today
                </span>
              )}
              {count > 0 && (
                <span
                  className={`text-[11px] font-normal ${
                    isSelected ? "text-blue-700" : "text-slate-400"
                  }`}
                >
                  ({count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Summary Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-700" />
          <span className="font-semibold text-slate-800">
            {DAYS.find((d) => d.key === selectedDay)?.label} Schedule
          </span>
          {className && <span>· {className}</span>}
          {studentName && <span>· {studentName}</span>}
        </div>
        <div>
          {dayPeriods.length > 0 ? (
            <span>
              {dayPeriods.length} period{dayPeriods.length > 1 ? "s" : ""} ·{" "}
              {dayPeriods[0].startTime} to{" "}
              {dayPeriods[dayPeriods.length - 1].endTime}
            </span>
          ) : (
            <span>No periods scheduled</span>
          )}
        </div>
      </div>

      {/* Periods Timeline List */}
      {dayPeriods.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-700">
            No periods scheduled for {DAYS.find((d) => d.key === selectedDay)?.label}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Check other weekdays or verify with the school timetable coordinator.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {dayPeriods.map((period) => {
            const isLiveNow =
              isToday &&
              currentTime >= period.startTime &&
              currentTime <= period.endTime;

            return (
              <div
                key={period.id}
                className={`relative flex flex-col gap-3 rounded-lg border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                  isLiveNow
                    ? "border-emerald-300 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-400"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}
              >
                {/* Time & Period Column */}
                <div className="flex items-start gap-3 sm:w-48 sm:shrink-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-900">
                      {period.startTime} – {period.endTime}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      {period.periodLabel}
                      {isLiveNow && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                          Live Now
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Subject Details */}
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-700" />
                    <span className="text-sm font-bold text-slate-900">
                      {period.subjectName ?? "Homeroom / Independent Study"}
                    </span>
                    {period.subjectCode && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-600">
                        {period.subjectCode}
                      </span>
                    )}
                  </div>

                  {period.teacherName && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <GraduationCap className="h-3.5 w-3.5 text-slate-400" />
                      <span>{period.teacherName}</span>
                    </div>
                  )}
                </div>

                {/* Location / Room */}
                <div className="flex items-center gap-1.5 text-xs sm:w-44 sm:justify-end sm:text-right">
                  {period.room ? (
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-50 px-2.5 py-1.5 text-slate-700 border border-slate-200">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-semibold">{period.room}</span>
                      {period.building && (
                        <span className="text-slate-500">
                          · {period.building}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-400">Classroom not set</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
