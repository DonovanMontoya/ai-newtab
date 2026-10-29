/**
 * Auto-rebuild policy: once the current homepage is older than the chosen
 * interval, rebuild headlessly. The worker's alarm heartbeat checks in the
 * background, and opening (or returning to) a new tab asks again, so a new tab
 * never sits on a stale page.
 */

/** Interval choices offered in Settings, in hours. */
export const REBUILD_INTERVAL_CHOICES = [6, 12, 24, 48] as const;

export const DEFAULT_REBUILD_INTERVAL_HOURS = 12;

/** A stored/user value as ms, falling back to the default when unset or invalid. */
export function rebuildIntervalMs(hours?: number | null): number {
  const h = typeof hours === "number" && hours > 0 ? hours : DEFAULT_REBUILD_INTERVAL_HOURS;
  return h * 60 * 60 * 1000;
}

/**
 * How long a new tab waits after a failed or cancelled auto attempt before
 * trying again. The heartbeat waits a full interval; this covers the common
 * case of the first attempt failing because the machine woke before the network.
 */
export const VIEW_RETRY_AFTER_MS = 30 * 60 * 1000;

/** What asked: the background alarm, or a new-tab page being opened or shown. */
export type AutoRebuildTrigger = "heartbeat" | "view";

export interface AutoRebuildInput {
  enabled: boolean;
  hasApiKey: boolean;
  isRunning: boolean;
  /** ISO timestamp of the last successful build, if any. */
  lastBuildTimestamp?: string | null;
  /** ISO timestamp of the last auto-build attempt, if any. */
  lastAutoAttemptTimestamp?: string | null;
  intervalMs: number;
  trigger: AutoRebuildTrigger;
  now: Date;
}

/**
 * Conservative by design:
 * - Never fires before the first manual build, so nothing spends on the API
 *   before the user has engaged.
 * - Only fires once the homepage is at least an interval old. A build (manual
 *   or automatic) restarts the clock.
 * - The heartbeat won't retry a failed or cancelled attempt until another full
 *   interval has passed. A new tab may retry sooner, but no sooner than
 *   VIEW_RETRY_AFTER_MS after it, so a persistent failure can't loop.
 */
export function shouldAutoRebuild(input: AutoRebuildInput): boolean {
  const { enabled, hasApiKey, isRunning, lastBuildTimestamp, lastAutoAttemptTimestamp, intervalMs, trigger, now } =
    input;

  if (!enabled || !hasApiKey || isRunning || !lastBuildTimestamp) return false;

  const age = (iso: string) => now.getTime() - new Date(iso).getTime();
  if (age(lastBuildTimestamp) < intervalMs) return false;

  if (!lastAutoAttemptTimestamp) return true;
  const retryAfter = trigger === "view" ? VIEW_RETRY_AFTER_MS : intervalMs;
  return age(lastAutoAttemptTimestamp) >= retryAfter;
}
