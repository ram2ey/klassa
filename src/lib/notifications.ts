export interface InAppNotification {
  id: string;
  recipientUserId?: string | null;
  title: string;
  message: string;
  type: "absence_alert" | "attendance_discrepancy" | "guardian_excuse" | "report_card_published" | "grade_updated" | "announcement" | "emergency" | "system";
  isRead: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

const localNotifications: InAppNotification[] = [
  {
    id: "notif-001",
    title: "Unexcused Absence Alert",
    message: "Elias Martin (Grade 5A) marked absent for morning roll call. SMS dispatched to primary guardian.",
    type: "absence_alert",
    isRead: false,
    createdAt: "15 min ago",
    metadata: { studentId: "ST-2026-0126", class: "5A" },
  },
  {
    id: "notif-002",
    title: "Attendance Discrepancy Corrected",
    message: "Office staff updated Noah Bennett (6A) from Absent to Excused (Medical).",
    type: "attendance_discrepancy",
    isRead: false,
    createdAt: "1 hour ago",
    metadata: { studentId: "ST-2026-0138", class: "6A" },
  },
  {
    id: "notif-003",
    title: "Guardian Excuse Note Received",
    message: "Sarah Warren submitted an excuse note for Amelia Warren (7B) for tomorrow's dental visit.",
    type: "guardian_excuse",
    isRead: true,
    createdAt: "Yesterday",
    metadata: { studentId: "ST-2026-0142", guardian: "Sarah Warren" },
  },
];

export function getInAppNotifications(): InAppNotification[] {
  return [...localNotifications];
}

export function addInAppNotification(notification: Omit<InAppNotification, "id" | "createdAt" | "isRead">): InAppNotification {
  const newNotif: InAppNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    isRead: false,
    createdAt: "Just now",
  };
  localNotifications.unshift(newNotif);
  return newNotif;
}

export function markNotificationAsRead(id: string): boolean {
  const item = localNotifications.find((n) => n.id === id);
  if (item) {
    item.isRead = true;
    return true;
  }
  return false;
}

export function markAllNotificationsAsRead(): void {
  localNotifications.forEach((n) => {
    n.isRead = true;
  });
}

