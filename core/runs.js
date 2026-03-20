(function (global) {
  function createRunLifecycle({
    stateStore = null,
    storage = global.localStorage,
    now = () => Date.now(),
  } = {}) {
    const fallbackStateStore = global.RISXCoreState?.createChallengeStateStore?.({ storage, now }) || null;
    const store = stateStore || fallbackStateStore;

    function getRun() {
      if (!store?.getCurrentRun) {
        return { id: null, tier: null, status: null, startedAt: 0, endedAt: 0 };
      }
      return store.getCurrentRun();
    }

    function setRunEndTimestamp(ts = now()) {
      const key = store?.keys?.RUN_ENDED_AT || "risx_run_ended_at";
      try { storage.setItem(key, String(Number(ts) || now())); } catch {}
    }

    function startRun({ runId = "", tier = "", status = "active", startedAt = now() } = {}) {
      if (!store?.setCurrentRun) return null;
      return store.setCurrentRun({
        runId: String(runId || ""),
        tier: String(tier || "").toLowerCase(),
        status: String(status || "active"),
        startedAt: Number(startedAt || now()),
      });
    }

    function startChallenge(payload = {}) {
      return startRun(payload);
    }

    function advanceStage(nextStageIndex) {
      if (!store?.getCurrentStageIndex || !store?.setCurrentStageIndex) return 0;
      if (Number.isFinite(Number(nextStageIndex))) {
        return store.setCurrentStageIndex(Number(nextStageIndex));
      }
      const current = Number(store.getCurrentStageIndex() || 0);
      return store.setCurrentStageIndex(current + 1);
    }

    function failRun({ runId = "", endedAt = now(), preservePointer = true } = {}) {
      if (!store) return false;
      if (store.setChallengeStatus) store.setChallengeStatus("failed");

      if (preservePointer && store.getCurrentRun && store.setCurrentRun) {
        const current = store.getCurrentRun() || {};
        store.setCurrentRun({
          runId: String(current.id || runId || ""),
          tier: String(current.tier || "").toLowerCase(),
          status: "failed",
          startedAt: Number(current.startedAt || now()),
        });
        setRunEndTimestamp(endedAt);
        return true;
      }

      return !!store.finalizeCurrentRun?.({
        status: "failed",
        runId: String(runId || ""),
        endedAt: Number(endedAt || now()),
      });
    }

    function completeRun({ runId = "", endedAt = now(), preservePointer = true } = {}) {
      if (!store) return false;
      if (store.setChallengeStatus) store.setChallengeStatus("won");

      if (preservePointer && store.getCurrentRun && store.setCurrentRun) {
        const current = store.getCurrentRun() || {};
        store.setCurrentRun({
          runId: String(current.id || runId || ""),
          tier: String(current.tier || "").toLowerCase(),
          status: "won",
          startedAt: Number(current.startedAt || now()),
        });
        setRunEndTimestamp(endedAt);
        return true;
      }

      return !!store.finalizeCurrentRun?.({
        status: "won",
        runId: String(runId || ""),
        endedAt: Number(endedAt || now()),
      });
    }

    function resetRun({ clearChallengeStatus = false } = {}) {
      if (!store) return;
      store.clearCurrentRun?.();
      store.resetCurrentStageIndex?.();
      if (clearChallengeStatus) store.clearChallengeStatus?.();
    }

    return {
      getRun,
      startRun,
      startChallenge,
      advanceStage,
      failRun,
      completeRun,
      resetRun,
    };
  }

  global.RISXCoreRuns = {
    createRunLifecycle,
  };
})(window);
