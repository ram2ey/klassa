"use client";

import { useState } from "react";
import {
  Calendar,
  Clock,
  MapPin,
  GraduationCap,
  BookOpen,
} from "lucide-react";
import type { TimetablePeriodItem, DayOfWeek } from "@/lib/timetable-service";

interface StudentDailyTimetableProps {
  timetable: TimetablePeriodItem[];
  defaultDay?: string;
  studentName?: string;
  className?: string;
}

const DAYS: Array<{ key: DayOfWeek; label: string; short: string }> = [
  { key: "monday", label: "Monday", short: "Mon" },
  { key: "tuesday", label: "Tuesday", short: "Tue" },
  { key: "wednesday", label: "Wednesday", short: "Wed" },
  { key: "thursday", label: "Thursday", short: "Thu" },
  { key: "friday", label: "Friday", short: "Fri" },
];

function getTodayDayOfWeek(): DayOfWeek {
  const day = new Date().getDay();
  switch (day) {
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
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function StudentDailyTimetable({
  timetable,
  defaultDay,
  studentName,
  className,
}: StudentDailyTimetableProps) {
  const today = getTodayDayOfWeek();
  const [selectedDay, setSelectedDay] = useState<string>(defaultDay ?? today);

  // Filter and sort periods for the selected day
  const dayPeriods = timetable
    .filter((slot) => slot.dayOfWeek === selectedDay)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  const currentTime = getCurrentTimeHHMM();
  const isToday = selectedDay === today;

  return (
    <div className="space-y-4">
      {/* Day Selector Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 rounded-control border border-line-subtle bg-surface-subtle p-1.5">
        {DAYS.map(({ key, short }) => {
          const isSelected = selectedDay === key;
          const isCurrentDay = today === key;
          const count = timetable.filter((p) => p.dayOfWeek === key).length;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-control px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                isSelected
                  ? "bg-surface text-selected shadow-subtle"
                  : "text-secondary hover:bg-surface hover:text-ink"
              }`}
            >
              <span>{short}</span>
              {isCurrentDay && (
                <span className="rounded-full bg-primary-subtle px-1.5 py-0.2 text-[10px] font-bold uppercase tracking-wider text-selected">
                  Today
                </span>
              )}
              {count > 0 && (
                <span
                  className={`text-[11px] font-normal ${
                    isSelected ? "text-selected" : "text-muted"
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
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-secondary">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-semibold text-ink">
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
        <div className="rounded-card border border-dashed border-line-subtle bg-surface-subtle p-8 text-center">
          <Clock className="mx-auto h-8 w-8 text-muted" />
          <p className="mt-2 text-sm font-semibold text-ink">
            No periods scheduled for {DAYS.find((d) => d.key === selectedDay)?.label}
          </p>
          <p className="mt-1 text-xs text-secondary">
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
                className={`relative flex flex-col gap-3 rounded-control border p-4 transition-all sm:flex-row sm:items-center sm:justify-between ${
                  isLiveNow
                    ? "border-emerald-300 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-400"
                    : "border-line-subtle bg-surface hover:border-line shadow-subtle"
                }`}
              >
                {/* Time & Period Column */}
                <div className="flex items-start gap-3 sm:w-48 sm:shrink-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-ink">
                      {period.startTime} – {period.endTime}
                    </span>
                    <span className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-secondary">
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
                    <BookOpen className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold text-ink">
                      {period.subjectName ?? "Homeroom / Independent Study"}
                    </span>
                    {period.subjectCode && (
                      <span className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] font-semibold text-secondary border border-line-subtle">
                        {period.subjectCode}
                      </span>
                    )}
                  </div>

                  {period.teacherName && (
                    <div className="flex items-center gap-1.5 text-xs text-secondary">
                      <GraduationCap className="h-3.5 w-3.5 text-muted" />
                      <span>{period.teacherName}</span>
                    </div>
                  )}
                </div>

                {/* Location / Room */}
                <div className="flex items-center gap-1.5 text-xs sm:w-44 sm:justify-end sm:text-right">
                  {period.room ? (
                    <div className="flex items-center gap-1.5 rounded-control bg-surface-subtle px-2.5 py-1.5 text-secondary border border-line-subtle">
                      <MapPin className="h-3.5 w-3.5 text-muted" />
                      <span className="font-semibold text-ink">{period.room}</span>
                      {period.building && (
                        <span className="text-secondary">
                          · {period.building}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted">Classroom not set</span>
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
