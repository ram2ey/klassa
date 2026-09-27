# Simplified Ghana School App Plan

## Purpose

Build a practical school office tool with a useful guardian portal and dependable parent SMS. Keep the core flow simple:

**Enroll a pupil → place them in a class → take attendance → enter marks → publish a term report → place pupils for the next year.**

## Keep and simplify

- **School staff roles:** administrator, office staff and teacher. Platform administrators remain an internal setup role. Guardians have separate, limited accounts.
- **School records:** pupils, guardians, classes, configurable grade names, staff and enrollment history. Let schools use their own grade naming and structure.
- **Attendance:** teachers mark attendance for their class each day. Show missing attendance for review, but do not block term close based on a weekday calendar rule.
- **Marks and term reports:** support the grading method chosen by the school, marks entry and printable or downloadable published reports. Hide GPA, complex weighting and extra approval steps unless the school needs them.
- **Year rollover:** let staff review pupils and assign next year's classes, repeaters or leavers. Provide CSV upload for larger schools instead of a specialist approval workflow.
- **Guardian portal:** show linked children's attendance, published reports and school notices. Keep the simple absence note only if the school wants it. The school must still work when guardians do not use the portal.
- **Pickup and pupil concerns:** keep a basic authorised collector list and restricted flags for issues that affect release or access. Limit private notes to administrators; remove specialist case-management features.

## Parent SMS

Keep mNotify, its durable queue and delivery tracking. An administrator or office staff member selects a class or the whole school, writes a message, reviews the recipient count and unreachable numbers, then confirms. Show queued, sent, delivered or failed status.

For the first release, limit SMS to staff-written parent announcements. Remove automated absence texts, staff invitation texts, scheduling and the separate emergency broadcast approval workflow. Office staff confirm guardian phone numbers. Record a simple preference for routine SMS. Keep sensitive pupil details out of group messages. Store provider credentials in Coolify secrets.

## Remove from the product

- SENCO, safeguarding lead and school nurse app roles, dashboards, registers and approval flows.
- Guardian inquiry conversations, the consent dashboard, multiple SMS preference categories and advanced analytics.
- Specialist clinical, SEN and statutory disclosure workflows.
- Complex calendar exceptions and hard term-close blocks.
- Automated privacy case management and erasure automation. Keep an administrator process to record a privacy request and its decision.

Keep school-to-school data isolation, account security, backups and an audit trail for important changes. Handle pupil information with appropriate safeguards under Ghana's [Data Protection Act, 2012](https://dataprotection.org.gh/wp-content/uploads/2025/05/Data-Protection-Act-2012-Act-843.pdf).

## Rollout

1. Trim the current local release before deployment. The recent calendar, rollover, specialist privacy and expanded SMS work is uncommitted and undeployed. Retain the useful SMS queue and delivery tracking while removing the unnecessary complexity above.
2. The app has not been used. Remove specialist-role account compatibility and unused inquiry, clinical and SEN tables; use a fresh or disposable database when validating the trimmed migration chain.
3. Update screens and documentation to match the smaller roles and workflows. Remove UK-specific terminology from the live product.
4. Test in staging with synthetic pupils: enrollment and attendance, marks and term reports, year placement, guardian access to linked pupils only, pickup restrictions, and an mNotify parent SMS with delivery status checked.
5. Deploy the tested commit and verify one school's flow before enabling broad SMS use.

## Acceptance flow

With two test schools, verify that staff can enroll a pupil, link a guardian, take attendance, enter marks, publish a term report and place the pupil for next year. Verify that guardians see only their linked pupils and published information, and that pickup or disclosure restrictions are enforced. Confirm a parent SMS reaches a provider delivery status and that failures are visible.

## References

- [mNotify API documentation](https://readthedocs.mnotify.com/)
- [Ghana Data Protection Act, 2012 (Act 843)](https://dataprotection.org.gh/wp-content/uploads/2025/05/Data-Protection-Act-2012-Act-843.pdf)
