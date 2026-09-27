# Phase 0 baseline: simplified Ghana school app

Recorded 2026-09-27 against local `HEAD` `51b18b1`. This inventory began as a production migration and account audit. The owner then clarified that the app has not been used, so no historical school accounts or pupil records need preservation or reassignment.

The committed migration journal ended at `0028_tenant_row_security`. Local work had added calendar, SMS delivery, emergency approval, pickup identity, privacy actions, and SMS worker status migrations. Phase 2 removed the unused school-calendar migration from the journal; the remaining uncommitted delivery and workflow migrations are still under review.

Phase 1 removes specialist roles and their unused inquiry, clinic, and SEN records. Migration `0035_remove_unused_phase1_records` drops those tables and narrows the staff role enum to administrator, office staff, and teacher. It assumes no specialist accounts or invitations exist. Apply it only to a fresh or disposable database; it deliberately has no account conversion path.

The SMS queue and delivery tracking remain in scope for the simplified product. The older migration files remain in the journal so the local migration chain still applies in order. No deployment or live database migration has been run by this work.
