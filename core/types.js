(function (global) {
  const CHALLENGE_STATUS = Object.freeze({
    INACTIVE: "inactive",
    ACTIVE: "active",
    FAILED: "failed",
    WON: "won",
    PENDING: "pending",
  });

  const RUN_STATUS = Object.freeze({
    CREATED: "created",
    READY: "ready",
    ACTIVE: "active",
    RESUMED: "resumed",
    FAILED: "failed",
    WON: "won",
    CLAIMED: "claimed",
    PAID: "paid",
    VOID: "void",
  });

  const RUN_TERMINAL_STATUSES = Object.freeze([
    RUN_STATUS.FAILED,
    RUN_STATUS.WON,
    RUN_STATUS.CLAIMED,
    RUN_STATUS.PAID,
    RUN_STATUS.VOID,
  ]);

  const RUN_STARTABLE_STATUSES = Object.freeze([
    RUN_STATUS.READY,
    RUN_STATUS.ACTIVE,
    RUN_STATUS.RESUMED,
  ]);

  function normalizeChallengeStatus(status) {
    const s = String(status || "").toLowerCase();
    if (Object.values(CHALLENGE_STATUS).includes(s)) return s;
    return CHALLENGE_STATUS.INACTIVE;
  }

  function normalizeRunStatus(status) {
    const s = String(status || "").toLowerCase();
    if (Object.values(RUN_STATUS).includes(s)) return s;
    return RUN_STATUS.CREATED;
  }

  function isTerminalRunStatus(status) {
    return RUN_TERMINAL_STATUSES.includes(normalizeRunStatus(status));
  }

  function isStartableRunStatus(status) {
    return RUN_STARTABLE_STATUSES.includes(normalizeRunStatus(status));
  }

  function toEpochMs(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  global.RISXCoreTypes = {
    CHALLENGE_STATUS,
    RUN_STATUS,
    RUN_TERMINAL_STATUSES,
    RUN_STARTABLE_STATUSES,
    normalizeChallengeStatus,
    normalizeRunStatus,
    isTerminalRunStatus,
    isStartableRunStatus,
    toEpochMs,
  };
})(window);
