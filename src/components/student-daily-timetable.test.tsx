import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { StudentDailyTimetable } from "./student-daily-timetable";
import type { TimetablePeriodItem } from "@/lib/timetable-service";

const mockTimetable: TimetablePeriodItem[] = [
  {
    id: "p-1",
    classId: "class-1",
    dayOfWeek: "monday",
    period: "period_1",
    periodLabel: "Period 1",
    startTime: "08:50",
    endTime: "09:40",
    subjectName: "Mathematics",
    subjectCode: "MATH-01",
    teacherName: "Mr. Turing",
    room: "Room 101",
    building: "Science Wing",
  },
  {
    id: "p-2",
    classId: "class-1",
    dayOfWeek: "monday",
    period: "period_2",
    periodLabel: "Period 2",
    startTime: "09:45",
    endTime: "10:35",
    subjectName: "English Literature",
    subjectCode: "ENG-01",
    teacherName: "Ms. Woolf",
    room: "Room 204",
    building: "Arts Wing",
  },
  {
    id: "p-3",
    classId: "class-1",
    dayOfWeek: "tuesday",
    period: "period_1",
    periodLabel: "Period 1",
    startTime: "08:50",
    endTime: "09:40",
    subjectName: "Physics",
    subjectCode: "SCI-01",
    teacherName: "Dr. Newton",
    room: "Lab B",
    building: "Science Wing",
  },
];

describe("StudentDailyTimetable component", () => {
  it("renders day tabs and scheduled periods for default day", () => {
    render(
      <StudentDailyTimetable
        timetable={mockTimetable}
        defaultDay="monday"
        studentName="Ada Lovelace"
        className="Year 7 / Class 7A"
      />
    );

    expect(screen.getByText("Monday Schedule")).toBeTruthy();
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("Mr. Turing")).toBeTruthy();
    expect(screen.getByText("Room 101")).toBeTruthy();

    expect(screen.getByText("English Literature")).toBeTruthy();
    expect(screen.getByText("Ms. Woolf")).toBeTruthy();
    expect(screen.getByText("Room 204")).toBeTruthy();
  });

  it("switches displayed periods when clicking a different day tab", () => {
    render(
      <StudentDailyTimetable
        timetable={mockTimetable}
        defaultDay="monday"
      />
    );

    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.queryByText("Physics")).toBeNull();

    const tuesdayBtn = screen.getByRole("button", { name: /Tue/i });
    fireEvent.click(tuesdayBtn);

    expect(screen.getByText("Tuesday Schedule")).toBeTruthy();
    expect(screen.getByText("Physics")).toBeTruthy();
    expect(screen.getByText("Dr. Newton")).toBeTruthy();
    expect(screen.getByText("Lab B")).toBeTruthy();
    expect(screen.queryByText("Mathematics")).toBeNull();
  });

  it("shows an empty state when a day has no scheduled periods", () => {
    render(
      <StudentDailyTimetable
        timetable={mockTimetable}
        defaultDay="wednesday"
      />
    );

    expect(
      screen.getByText("No periods scheduled for Wednesday")
    ).toBeTruthy();
  });
});
