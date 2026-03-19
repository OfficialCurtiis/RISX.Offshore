(function (global) {
  const DEFAULT_KEYS = Object.freeze({
    CHALLENGE_ACTIVE: "RISX_CH_ACTIVE",
    CHALLENGE_TIER: "RISX_CH_TIER",
    CHALLENGE_STATUS: "RISX_CHALLENGE_STATUS",
    STAGE_INDEX: "RISX_CH_STAGE_INDEX",
    RUN_ID: "risx_run_id",
    RUN_TIER: "risx_run_tier",
    RUN_STATUS: "risx_run_status",
    RUN_STARTED_AT: "risx_run_started_at",
    RUN_ENDED_AT: "risx_run_ended_at",
  });

  function createChallengeStateStore({
    storage = global.localStorage,
    keys = DEFAULT_KEYS,
    now = () => Date.now(),
  } = {}) {
    const safe = {
      getItem(key) {
        try { return storage.getItem(key); } catch { return null; }
      },
      setItem(key, value) {
        try { storage.setItem(key, value); } catch {}
      },
      removeItem(key) {
        try { storage.removeItem(key); } catch {}
      },
    };

    function getChallengeActive() {
      return safe.getItem(keys.CHALLENGE_ACTIVE) === "1";
    }

    function setChallengeActive(active) {
      safe.setItem(keys.CHALLENGE_ACTIVE, active ? "1" : "0");
      return !!active;
    }

    function getActiveTier() {
      return String(safe.getItem(keys.CHALLENGE_TIER) || "").toLowerCase();
    }

    function setActiveTier(tierKey) {
      const tier = String(tierKey || "").toLowerCase();
      if (!tier) return "";
      safe.setItem(keys.CHALLENGE_TIER, tier);
      return tier;
    }

    function getChallengeStatus() {
      return String(safe.getItem(keys.CHALLENGE_STATUS) || "");
    }

    function setChallengeStatus(status) {
      const next = String(status || "");
      safe.setItem(keys.CHALLENGE_STATUS, next);
      return next;
    }

    function clearChallengeStatus() {
      safe.removeItem(keys.CHALLENGE_STATUS);
    }

    function getCurrentStageIndex() {
      const raw = safe.getItem(keys.STAGE_INDEX);
      const n = Number(raw);
      return Number.isFinite(n) ? n : 0;
    }

    function setCurrentStageIndex(index) {
      const n = Number(index);
      const next = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
      safe.setItem(keys.STAGE_INDEX, String(next));
      return next;
    }

    function resetCurrentStageIndex() {
      safe.removeItem(keys.STAGE_INDEX);
      return 0;
    }

    function getCurrentRun() {
      return {
        id: safe.getItem(keys.RUN_ID),
        tier: safe.getItem(keys.RUN_TIER),
        status: safe.getItem(keys.RUN_STATUS),
        startedAt: Number(safe.getItem(keys.RUN_STARTED_AT) || 0),
        endedAt: Number(safe.getItem(keys.RUN_ENDED_AT) || 0),
      };
    }

    function setCurrentRun({ runId = "", tier = "", status = "", startedAt = now() } = {}) {
      if (runId) safe.setItem(keys.RUN_ID, String(runId));
      if (tier) safe.setItem(keys.RUN_TIER, String(tier).toLowerCase());
      if (status) safe.setItem(keys.RUN_STATUS, String(status));
      safe.setItem(keys.RUN_STARTED_AT, String(Number(startedAt) || now()));
      safe.removeItem(keys.RUN_ENDED_AT);
      return getCurrentRun();
    }

    function finalizeCurrentRun({ status = "", runId = "", endedAt = now() } = {}) {
      const localRunId = String(safe.getItem(keys.RUN_ID) || "");
      const targetRunId = String(runId || "");
      if (!localRunId) return false;
      if (targetRunId && localRunId !== targetRunId) return false;

      safe.removeItem(keys.RUN_ID);
      if (status) safe.setItem(keys.RUN_STATUS, String(status));
      else safe.removeItem(keys.RUN_STATUS);
      safe.setItem(keys.RUN_ENDED_AT, String(Number(endedAt) || now()));
      return true;
    }

    function clearCurrentRun() {
      safe.removeItem(keys.RUN_ID);
      safe.removeItem(keys.RUN_TIER);
      safe.removeItem(keys.RUN_STATUS);
      safe.removeItem(keys.RUN_STARTED_AT);
      safe.removeItem(keys.RUN_ENDED_AT);
    }

    function resetChallengeState() {
      setChallengeActive(false);
      safe.removeItem(keys.CHALLENGE_TIER);
      clearChallengeStatus();
      resetCurrentStageIndex();
      clearCurrentRun();
    }

    return {
      keys,
      getChallengeActive,
      setChallengeActive,
      getActiveTier,
      setActiveTier,
      getChallengeStatus,
      setChallengeStatus,
      clearChallengeStatus,
      getCurrentStageIndex,
      setCurrentStageIndex,
      resetCurrentStageIndex,
      getCurrentRun,
      setCurrentRun,
      finalizeCurrentRun,
      clearCurrentRun,
      resetChallengeState,
    };
  }

  global.RISXCoreState = {
    DEFAULT_KEYS,
    createChallengeStateStore,
  };
})(window);
