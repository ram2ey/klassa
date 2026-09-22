"use client";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function AccountSignOut() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <span><Button variant="ghost" size="sm" disabled={pending} onClick={async () => {
    setPending(true); setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error("Sign out failed");
      router.replace("/login"); router.refresh();
    } catch { setError("Sign out failed. Please retry."); } finally { setPending(false); }
  }}>Sign out</Button>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</span>;
}
