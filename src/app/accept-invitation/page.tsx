import type { Metadata } from "next";
import { AcceptInvitation } from "@/components/accept-invitation";
export const metadata: Metadata = { title: "Activate your Klassa account", referrer: "no-referrer", robots: { index: false, follow: false } };
export default function AcceptInvitationPage() { return <AcceptInvitation />; }
