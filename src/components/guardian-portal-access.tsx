"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { provisionGuardianPortalAccountAction } from "@/app/actions/guardian-portal-actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function GuardianPortalAccess({ guardianId, guardianName, enabled, eligible }: {
  guardianId: string; guardianName: string; enabled: boolean; eligible: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ tenantId: string; username: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (enabled) {
    return <Badge tone="green" className="min-h-9 px-3 py-1">Portal enabled</Badge>;
  }
  if (!eligible) {
    return <span title="Link this contact to a student with legal responsibility first." className="inline-flex min-h-9 items-center rounded-control border border-line-subtle bg-surface-subtle px-3 text-xs text-muted">Legal link required</span>;
  }

  return (
    <>
      <Button variant="secondary" className="min-h-10" onClick={() => { setError(""); setOpen(true); }}>
        Enable portal<span className="sr-only"> for {guardianName}</span>
      </Button>
      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/40 p-4"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !pending && !created) {
              setOpen(false);
              setCreated(null);
            }
          }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="guardian-portal-title" className="w-full max-w-lg rounded-card border border-line-subtle bg-surface shadow-overlay overflow-hidden">
            <div className="border-b border-line-subtle p-6">
              <h2 id="guardian-portal-title" className="text-lg font-bold text-ink">Enable guardian portal</h2>
              <p className="mt-1 text-sm text-secondary">Create a sign-in for {guardianName}. Access is limited to linked students for whom this contact has legal responsibility.</p>
            </div>
            {created ? (
              <div className="space-y-4 p-6">
                <p role="status" className="text-sm font-semibold text-emerald-800">Portal account created. Share these sign-in details privately.</p>
                <dl className="grid gap-3 rounded-control border border-line-subtle bg-surface-subtle p-4 text-sm">
                  <div>
                    <dt className="text-secondary text-xs uppercase font-semibold">Tenant ID</dt>
                    <dd className="font-mono text-ink mt-0.5">{created.tenantId}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary text-xs uppercase font-semibold">Username</dt>
                    <dd className="font-mono text-ink mt-0.5">{created.username}</dd>
                  </div>
                  <div>
                    <dt className="text-secondary text-xs uppercase font-semibold">Temporary password</dt>
                    <dd className="font-mono text-ink mt-0.5">{created.password}</dd>
                  </div>
                </dl>
                <p className="text-xs text-secondary">The guardian must change this password after sign-in.</p>
                <div className="flex justify-end">
                  <Button className="min-h-11" onClick={() => { setOpen(false); setCreated(null); router.refresh(); }}>Done</Button>
                </div>
              </div>
            ) : (
              <form className="space-y-4 p-6" onSubmit={event => {
                event.preventDefault();
                setError("");
                const form = new FormData(event.currentTarget);
                const password = String(form.get("temporaryPassword") ?? "");
                startTransition(async () => {
                  try {
                    const result = await provisionGuardianPortalAccountAction({
                      guardianId,
                      username: String(form.get("username") ?? ""),
                      temporaryPassword: password,
                    });
                    if (!result.success) { setError(result.error); return; }
                    setCreated({ tenantId: result.tenantId, username: result.username, password });
                  } catch { setError("The portal account could not be created. Refresh the page and try again."); }
                });
              }}>
                <label className="block text-sm font-medium text-ink">Username
                  <input name="username" required minLength={3} maxLength={64} autoCapitalize="none" spellCheck={false} className="ui-field mt-1.5 w-full" />
                </label>
                <label className="block text-sm font-medium text-ink">Temporary password
                  <input name="temporaryPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="ui-field mt-1.5 w-full" />
                  <span className="mt-1 block text-xs font-normal text-muted">At least 12 characters. The guardian must change it after their first sign-in.</span>
                </label>
                <p className="rounded-control border border-warning/20 bg-warning-subtle p-3 text-sm text-warning">Share the tenant ID, username, and temporary password through a verified private channel. Klassa does not send guardian invitations yet.</p>
                {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">{error}</p>}
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="secondary" className="min-h-11" disabled={pending} onClick={() => { setOpen(false); setCreated(null); }}>Cancel</Button>
                  <Button type="submit" className="min-h-11" disabled={pending}>{pending ? "Creating…" : "Create portal account"}</Button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
