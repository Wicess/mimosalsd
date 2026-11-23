/**
 * Analytics buffer flush — no-op on this project.
 *
 * On WHAM this lands Redis-buffered analytics events into the database before
 * the admin reads them. This project files visits through its own nightly
 * pipeline (VisitEvent → DailyVisitStat) and keeps live PageView rows, so there
 * is nothing to flush at admin-read time. Kept as a safe no-op so the analytics
 * page can call it unconditionally and stay structurally identical to WHAM's.
 */
export async function flushForAdminView(): Promise<void> {
  // Intentionally empty — see module comment.
}
