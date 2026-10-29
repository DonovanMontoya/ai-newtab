import { describe, expect, test } from "bun:test";
import {
  DEFAULT_REBUILD_INTERVAL_HOURS,
  rebuildIntervalMs,
  shouldAutoRebuild,
  type AutoRebuildInput,
} from "../apps/extension/lib/auto-rebuild";

/** A local-time Date on 16 Oct 2026 (or another day) at the given hour. */
const at = (hour: number, minute = 0, day = 16) => new Date(2026, 9, day, hour, minute);

const HOUR = 60 * 60 * 1000;

const input = (overrides: Partial<AutoRebuildInput>): AutoRebuildInput => ({
  enabled: true,
  hasApiKey: true,
  isRunning: false,
  lastBuildTimestamp: at(0).toISOString(),
  lastAutoAttemptTimestamp: at(0).toISOString(),
  intervalMs: 12 * HOUR,
  trigger: "heartbeat",
  now: at(12),
  ...overrides,
});

describe("shouldAutoRebuild", () => {
  test("a midnight build is rebuilt once the 12-hour interval has passed", () => {
    expect(shouldAutoRebuild(input({ now: at(11, 59) }))).toBe(false);
    expect(shouldAutoRebuild(input({ now: at(12) }))).toBe(true);
  });

  test("a manual build restarts the clock", () => {
    const builtAt9 = at(9).toISOString();
    expect(shouldAutoRebuild(input({ lastBuildTimestamp: builtAt9, now: at(20) }))).toBe(false);
    expect(shouldAutoRebuild(input({ lastBuildTimestamp: builtAt9, now: at(21) }))).toBe(true);
  });

  test("a homepage several days old is rebuilt by either trigger", () => {
    const oct12 = at(9, 0, 12).toISOString();
    for (const trigger of ["heartbeat", "view"] as const) {
      expect(shouldAutoRebuild(input({ lastBuildTimestamp: oct12, lastAutoAttemptTimestamp: oct12, trigger }))).toBe(true);
    }
  });

  test("the heartbeat doesn't retry a failed attempt until another interval has passed", () => {
    const failedAt12 = at(12).toISOString();
    expect(shouldAutoRebuild(input({ lastAutoAttemptTimestamp: failedAt12, now: at(23) }))).toBe(false);
    expect(shouldAutoRebuild(input({ lastAutoAttemptTimestamp: failedAt12, now: at(0, 0, 17) }))).toBe(true);
  });

  test("a new tab retries a failed attempt, but not within 30 minutes of it", () => {
    const failedAt12 = at(12).toISOString();
    expect(shouldAutoRebuild(input({ lastAutoAttemptTimestamp: failedAt12, trigger: "view", now: at(12, 10) }))).toBe(false);
    expect(shouldAutoRebuild(input({ lastAutoAttemptTimestamp: failedAt12, trigger: "view", now: at(12, 30) }))).toBe(true);
  });

  test("never fires before a first manual build, when off, without a key, or mid-build", () => {
    for (const trigger of ["heartbeat", "view"] as const) {
      expect(shouldAutoRebuild(input({ trigger, lastBuildTimestamp: null }))).toBe(false);
      expect(shouldAutoRebuild(input({ trigger, enabled: false }))).toBe(false);
      expect(shouldAutoRebuild(input({ trigger, hasApiKey: false }))).toBe(false);
      expect(shouldAutoRebuild(input({ trigger, isRunning: true }))).toBe(false);
    }
  });
});

describe("rebuildIntervalMs", () => {
  test("uses the stored hours, or the 12-hour default when unset or invalid", () => {
    expect(DEFAULT_REBUILD_INTERVAL_HOURS).toBe(12);
    expect(rebuildIntervalMs(6)).toBe(6 * HOUR);
    for (const hours of [null, undefined, 0, -3]) {
      expect(rebuildIntervalMs(hours)).toBe(12 * HOUR);
    }
  });
});
