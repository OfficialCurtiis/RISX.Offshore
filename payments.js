// payments.js
(() => {
  // ------- DOM -------
  const modal        = document.getElementById("payModal");
  const tierLabel    = document.getElementById("payTierLabel");
  const currencySel  = document.getElementById("payCurrencySelect");
  const createBtn    = document.getElementById("payCreateBtn");
  const step2        = document.getElementById("payStep2");
  const amountEl     = document.getElementById("payAmount");
  const addressEl    = document.getElementById("payAddress");
  const copyBtn      = document.getElementById("payCopyBtn");
  const statusEl     = document.getElementById("payStatus");
  const checkBtn     = document.getElementById("payCheckBtn");
  const unlockedBox  = document.getElementById("payUnlocked");

  const PAYMENT_SESSION_KEY = "risx_payment_session";
  const LEGACY_PENDING_KEY = "risx_pending_payment";
  const CREATE_PAYMENT_ATTEMPT_KEY = "risx_create_payment_attempt_v1";
  const SAVE_PREFIX = (typeof RISX_SAVE_KEY !== "undefined" ? RISX_SAVE_KEY : "risx_demo_wallet_v2");
  const PLAYER_WALLET_KEY = `${SAVE_PREFIX}::player_wallet`;
  const PLAYER_EMAIL_KEY = `${SAVE_PREFIX}::player_email`;
  const ACTIVE_WALLET_KEY = `${SAVE_PREFIX}::activeWallet`;
  const RESTART_FAILED_RUN_ID_KEY = "risx_restart_failed_run_id";

  // NEW: Payment ID + Resume
  const payIdEl       = document.getElementById("payPaymentId");
  const payIdCopyBtn  = document.getElementById("payPaymentIdCopyBtn");

  // NEW: Paid-but-not-unlocked support box
  const manualIdInput  = document.getElementById("payManualId");
  const manualCheckBtn = document.getElementById("payManualCheckBtn");
  const manualMsgEl    = document.getElementById("payManualMsg");

  // close actions
  document.querySelectorAll("[data-pay-close]").forEach(el => {
    el.addEventListener("click", () => closeModal());
  });

  // ------- State -------
  let activeTierKey = null;
  let activePaymentId = null;
  let pollTimer = null;

  // ------- Helpers -------

  function setCreateButtonLabel(hasInvoice) {
  if (!createBtn) return;
  createBtn.textContent = hasInvoice ? "Generate New Payment" : "Create Payment";
}

  function lockBodyScroll() {
  document.body.dataset.risxScrollY = String(window.scrollY || 0);
  document.body.style.position = "fixed";
  document.body.style.top = `-${window.scrollY || 0}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

    function unlockBodyScroll() {
    const y = Number(document.body.dataset.risxScrollY || "0");
    document.body.style.position = "";
    document.body.style.top = "";
    document.body.style.left = "";
    document.body.style.right = "";
    document.body.style.width = "";
    delete document.body.dataset.risxScrollY;
    window.scrollTo(0, y);
    }

  function normalizePaymentSession(raw) {
    if (!raw || typeof raw !== "object") return null;

    const status = String(raw.status || "").toLowerCase();
    const intent = String(raw.intent || "entry").toLowerCase();
    const tier = String(raw.tier || raw.tierKey || "").trim();
    const paymentId = String(raw.paymentId || raw.payment_id || raw.invoiceId || "").trim();

    if (!["pending", "paid", "expired", "cancelled"].includes(status)) return null;
    if (!["entry", "restart"].includes(intent)) return null;
    if (!tier) return null;
    if (!paymentId && status === "pending") return null;

    return {
      status,
      intent,
      tier,
      invoiceId: String(raw.invoiceId || paymentId),
      paymentId,
      amount: Number(raw.amount ?? raw.pay_amount ?? 0) || 0,
      currency: String(raw.currency || raw.pay_currency || "").toUpperCase(),
      payAddress: String(raw.payAddress || raw.pay_address || ""),
      createdAt: Number(raw.createdAt || Date.now()),
    };
  }

  function auditWallet() {
    const challengeWalletId = (typeof CHALLENGE_WALLET_ID !== "undefined") ? CHALLENGE_WALLET_ID : "__RISX_CHALLENGE__";
    const playerWallet = String(localStorage.getItem(PLAYER_WALLET_KEY) || "").trim();
    if (playerWallet) return playerWallet;
    const active = String(localStorage.getItem(ACTIVE_WALLET_KEY) || "").trim();
    if (active && active !== challengeWalletId) return active;
    return "";
  }

  function auditEmail() {
    return String(localStorage.getItem(PLAYER_EMAIL_KEY) || "").trim();
  }

  function newIdempotencyKey() {
    try {
      if (globalThis?.crypto?.randomUUID) return globalThis.crypto.randomUUID();
      if (globalThis?.crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch {}
    return `fallback_${Date.now()}`;
  }

  function getOrCreateCreatePaymentAttempt({ tierKey, currency, intent, failedRunId }) {
    const now = Date.now();
    const existingRaw = localStorage.getItem(CREATE_PAYMENT_ATTEMPT_KEY);
    if (existingRaw) {
      try {
        const existing = JSON.parse(existingRaw);
        const isSameShape =
          existing &&
          existing.tierKey === tierKey &&
          existing.currency === currency &&
          existing.intent === intent &&
          existing.failedRunId === failedRunId;
        const ageMs = Math.max(0, now - Number(existing.createdAt || 0));
        if (isSameShape && ageMs <= 15 * 60 * 1000 && existing.key) {
          return existing.key;
        }
      } catch {}
    }

    const next = {
      key: newIdempotencyKey(),
      tierKey,
      currency,
      intent,
      failedRunId,
      createdAt: now,
    };
    localStorage.setItem(CREATE_PAYMENT_ATTEMPT_KEY, JSON.stringify(next));
    return next.key;
  }

  function clearCreatePaymentAttempt() {
    localStorage.removeItem(CREATE_PAYMENT_ATTEMPT_KEY);
  }

  function syncPaymentRecord(session) {
    if (!session?.paymentId) return;
    try {
      window.RISX_upsertPaymentRecord?.({
        paymentId: session.paymentId,
        wallet: auditWallet(),
        email: auditEmail(),
        tier: session.tier,
        amount: Number(session.amount || 0),
        currency: session.currency,
        status: session.status,
        createdAt: Number(session.createdAt || Date.now()),
        paidAt: session.status === "paid" ? Date.now() : undefined,
      });
    } catch {}
  }

  function setPaymentSession(payload) {
    const normalized = normalizePaymentSession(payload);
    if (!normalized) return;

    localStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(normalized));
    if (normalized.status === "pending") {
      localStorage.setItem(LEGACY_PENDING_KEY, JSON.stringify({
        intent: normalized.intent,
        tierKey: normalized.tier,
        payment_id: normalized.paymentId,
        pay_amount: normalized.amount,
        pay_currency: normalized.currency,
        pay_address: normalized.payAddress,
        createdAt: normalized.createdAt,
      }));
    } else {
      localStorage.removeItem(LEGACY_PENDING_KEY);
    }
    syncPaymentRecord(normalized);
    window.RISX_renderRecoveryCtas?.();
  }

  function getPaymentSession() {
    try {
      const direct = normalizePaymentSession(JSON.parse(localStorage.getItem(PAYMENT_SESSION_KEY) || "null"));
      if (direct) return direct;
    } catch {}

    try {
      const legacy = JSON.parse(localStorage.getItem(LEGACY_PENDING_KEY) || "null");
      if (!legacy || typeof legacy !== "object") return null;
      const migrated = normalizePaymentSession({
        status: "pending",
        intent: legacy.intent || "entry",
        tier: legacy.tierKey,
        paymentId: legacy.payment_id,
        amount: legacy.pay_amount,
        currency: legacy.pay_currency,
        payAddress: legacy.pay_address,
        createdAt: legacy.createdAt,
      });
      if (migrated) {
        localStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(migrated));
      }
      return migrated;
    } catch {
      return null;
    }
  }

  function updatePaymentSessionStatus(status) {
    const current = getPaymentSession();
    if (!current) return;
    setPaymentSession({
      ...current,
      status: String(status || "").toLowerCase(),
    });
  }

  function enableLeaveWarning() {
      window.onbeforeunload = (e) => {
    e.preventDefault();
    e.returnValue = "";
    return "";
    };
    }

  function disableLeaveWarning() {
    window.onbeforeunload = null;
    }

function openModal(tierKey, intent = "entry") {
  activeTierKey = tierKey;
  activePaymentId = null;

  const t = CHALLENGE_TIERS[tierKey] || CHALLENGE_TIERS.beginner;
  const usd = (intent === "restart") ? t.restartUsd : t.entryUsd;

  // Update existing UI elements safely
  const modalTitle = modal.querySelector("h2");
  if (modalTitle) modalTitle.textContent = (intent === "restart") ? "Reset Challenge" : "Unlock Tier";

  tierLabel.textContent =
    `Tier: ${String(tierKey).toUpperCase()} • ${(intent === "restart") ? `Restart: $${usd}` : `Entry: $${usd}`}`;

  step2.style.display = "none";
  unlockedBox.style.display = "none";
  statusEl.textContent = "Waiting for payment…";
  amountEl.textContent = "—";
  addressEl.textContent = "—";
  if (payIdEl) payIdEl.textContent = "—";
  if (manualMsgEl) manualMsgEl.textContent = "";

  setCreateButtonLabel(false);
  modal.style.display = "block";
  lockBodyScroll();

  // Restore only the same pending payment session for this tier/intent.
  const pending = getPaymentSession();
if (
  pending &&
  pending.status === "pending" &&
  pending.tier === tierKey &&
  pending.intent === intent &&
  pending.paymentId
) {
  activePaymentId = pending.paymentId;
  localStorage.setItem("risx_last_payment_id", pending.paymentId); 
  window.updateSupportIdPill?.();

  setCreateButtonLabel(true);
  step2.style.display = "block";
  amountEl.textContent = `${pending.amount} ${String(pending.currency).toUpperCase()}`;
  addressEl.textContent = pending.payAddress || "—";
  if (payIdEl) payIdEl.textContent = pending.paymentId;

  statusEl.textContent = "Status: restoring… (checking every 2.5s)";
  enableLeaveWarning();
  startPolling(activePaymentId);
 }
}

function closeModal() {
    modal.style.display = "none";
    stopPolling();
    unlockBodyScroll();
    disableLeaveWarning();
}

function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
}

  function setUnlocked(tierKey) {
    unlockedBox.style.display = "block";
    statusEl.textContent = "✅ Confirmed";
    updatePaymentSessionStatus("paid");
    disableLeaveWarning();
    stopPolling();
  }

  function isUnlocked(tierKey) {
  const tok = localStorage.getItem("risx_unlock_token");
  const tk  = localStorage.getItem("risx_unlock_tier");
  return !!tok && (!tierKey || tk === tierKey);
}

  async function createPayment(tierKey, currency, intent = "entry") {
    const t = CHALLENGE_TIERS[tierKey] || CHALLENGE_TIERS.beginner;
    const usd = (intent === "restart") ? t.restartUsd : t.entryUsd;
    const failedRunId = intent === "restart"
      ? String(localStorage.getItem(RESTART_FAILED_RUN_ID_KEY) || "")
      : "";
    const idempotencyKey = getOrCreateCreatePaymentAttempt({
      tierKey,
      currency,
      intent,
      failedRunId,
    });

    const r = await fetch("/api/create-payment", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        tierKey,
        usd,
        currency,
        intent,
        failedRunId,
        wallet: auditWallet(),
        email: auditEmail(),
        idempotencyKey,
      })
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.details ? `${j.error}: ${j.details}` : (j?.error || "Create payment failed"));
    clearCreatePaymentAttempt();
    return j; // contains payment_id, pay_amount, pay_address, etc.
  }

  async function verifyPayment(paymentId) {
    const r = await fetch(`/api/verify-payment?payment_id=${encodeURIComponent(paymentId)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Verify payment failed");
    return j;
  }

function handleConfirmed(resp) {
  if (!(resp?.unlock_token && resp?.tierKey)) {
    if (resp?.unlock_consumed) {
      statusEl.textContent = "This payment was already used to start a challenge run. Resume that run from this device or contact support.";
    } else {
      statusEl.textContent = "Confirmed, but missing unlock token. Contact support.";
    }
    return;
  }

  const pending = getPaymentSession();
  const intent = String(resp?.intent || pending?.intent || "entry").toLowerCase() === "restart" ? "restart" : "entry";
  const tierKey = String(resp?.tierKey || pending?.tier || "").toLowerCase();
  const paymentId = String(pending?.paymentId || activePaymentId || resp?.payment_id || "").trim();
  const failedRunId = String(resp?.failedRunId || localStorage.getItem(RESTART_FAILED_RUN_ID_KEY) || "");

  // Persist unlock (entry unlock token still useful)
  localStorage.setItem("risx_unlock_token", resp.unlock_token);
  localStorage.setItem("risx_unlock_tier", resp.tierKey);
  localStorage.setItem("risx_unlock_intent", intent);
  if (intent === "restart" && failedRunId) {
    localStorage.setItem(RESTART_FAILED_RUN_ID_KEY, failedRunId);
  }

  if (paymentId) {
    syncPaymentRecord({
      paymentId,
      tier: String(resp.tierKey || tierKey || ""),
      amount: Number(pending?.amount || resp?.pay_amount || 0),
      currency: String(pending?.currency || resp?.pay_currency || ""),
      status: "paid",
      createdAt: Number(pending?.createdAt || Date.now()),
    });
    try {
      window.RISX_createRunFromPayment?.({
        paymentId,
        wallet: auditWallet(),
        email: auditEmail(),
        tier: String(resp.tierKey || tierKey || ""),
        amount: Number(pending?.amount || resp?.pay_amount || 0),
        currency: String(pending?.currency || resp?.pay_currency || ""),
        status: "paid",
        paidAt: Date.now(),
      }, {
        tier: String(resp.tierKey || tierKey || ""),
        tokenId: String(resp.unlock_token || "").slice(0, 24),
        intent,
        failedRunId,
      });
    } catch {}
  }

  // mark UI unlocked/close modal first
  activeTierKey = tierKey;
  setUnlocked(activeTierKey);
  closeModal();

  // ONE branch only
  if (intent === "restart") {
    window.RISX_completeReset?.(tierKey);
  } else {
    window.RISX_startChallengeFromPayment?.(tierKey);
  }
}

function startPolling(paymentId) {
    stopPolling();

    const tick = async () => {
      try {
        const s = await verifyPayment(paymentId);

        // statuses vary; we treat confirmed/finished as paid
        const status = (s.payment_status || "").toLowerCase();
        statusEl.textContent = `Status: ${status || "waiting"} (auto-checking)`;

       if (status === "confirmed" || status === "finished") {
        updatePaymentSessionStatus("paid");
        handleConfirmed(s);
        return;
        }
       if (status === "expired" || status === "cancelled") {
        updatePaymentSessionStatus(status);
        disableLeaveWarning();
        stopPolling();
        return;
        }
      } catch (e) {
        statusEl.textContent = `Status check error (try again)`;
      }

      pollTimer = setTimeout(tick, 2500);
    };

    tick();
  }

  // ------- UI Events -------
  createBtn?.addEventListener("click", async () => {
    if (!activeTierKey) return;

    createBtn.disabled = true;
    createBtn.textContent = "Creating…";

    try {
      const payCurrency = currencySel.value;
      const intent = localStorage.getItem("risx_payment_intent") || "entry";
      localStorage.removeItem("risx_payment_intent");

      const data = await createPayment(activeTierKey, payCurrency, intent);

      activePaymentId = data.payment_id;
      localStorage.setItem("risx_last_payment_id", data.payment_id);
      window.updateSupportIdPill?.();

      localStorage.setItem("risx_last_payment_tier", activeTierKey);
      localStorage.setItem("risx_last_payment_intent", intent);
      if (payIdEl) payIdEl.textContent = data.payment_id;
      setCreateButtonLabel(true);

      setPaymentSession({
        status: "pending",
        intent,
        tier: activeTierKey,
        invoiceId: data.invoice_id || data.payment_id,
        paymentId: data.payment_id,
        amount: data.pay_amount,
        currency: data.pay_currency || payCurrency,
        payAddress: data.pay_address,
        createdAt: Date.now()
      });
      enableLeaveWarning();

      step2.style.display = "block";
      amountEl.textContent = `${data.pay_amount} ${String(data.pay_currency || payCurrency).toUpperCase()}`;
      addressEl.textContent = data.pay_address;

      statusEl.textContent = "Waiting for payment… (checking every 2.5s)";
      startPolling(activePaymentId);
    } catch (e) {
      alert(e.message || String(e));
      } finally {
      createBtn.disabled = false;
      setCreateButtonLabel(!!activePaymentId);
    }
  });

  copyBtn?.addEventListener("click", async () => {
    const text = addressEl.textContent.trim();
    if (!text || text === "—") return;
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => (copyBtn.textContent = "Copy"), 900);
  });

checkBtn?.addEventListener("click", async () => {
  // Pull from active id, or pending storage (refresh-safe)
  const pending = getPaymentSession();
  const pid = activePaymentId || pending?.paymentId;

  if (!pid) {
    alert("Create a payment first.");
    return;
  }

  statusEl.textContent = "Status: checking…";

  try {
    const s = await verifyPayment(pid);
    const status = (s.payment_status || "").toLowerCase();

    statusEl.textContent = `Status: ${status || "unknown"}`;

    if (status === "confirmed" || status === "finished") {
      updatePaymentSessionStatus("paid");
      handleConfirmed(s);
      return;
    }
    if (status === "expired" || status === "cancelled") {
      updatePaymentSessionStatus(status);
      disableLeaveWarning();
      stopPolling();
      return;
    }

    // If not confirmed yet, keep auto-checking running
    activePaymentId = pid;
    startPolling(pid);
  } catch (e) {
    statusEl.textContent = "Status check error (try again)";
  }
});

    payIdCopyBtn?.addEventListener("click", async () => {
    const text = (payIdEl?.textContent || "").trim();
    if (!text || text === "—") return;
    await navigator.clipboard.writeText(text);
    payIdCopyBtn.textContent = "Copied";
    setTimeout(() => (payIdCopyBtn.textContent = "Copy"), 900);
    });

    manualCheckBtn?.addEventListener("click", async () => {
  const pid = (manualIdInput?.value || "").trim();
  if (!pid) {
    if (manualMsgEl) manualMsgEl.textContent = "Paste a payment_id first.";
    return;
  }

  manualCheckBtn.disabled = true;
  manualCheckBtn.textContent = "Checking…";
  if (manualMsgEl) manualMsgEl.textContent = "";

  try {
    const s = await verifyPayment(pid);
    const status = (s.payment_status || "").toLowerCase();
    if (manualMsgEl) manualMsgEl.textContent = `Status: ${status || "unknown"}`;

    if (status === "confirmed" || status === "finished") {
      const serverTierKey = String(s?.tierKey || "").toLowerCase();
      if (!serverTierKey) {
        if (manualMsgEl) manualMsgEl.textContent = "Confirmed, but tier could not be verified. Contact support.";
        return;
      }
      // Treat it as the active payment for this tier and persist it for refresh-resume
      activePaymentId = pid;
      if (payIdEl) payIdEl.textContent = pid;
      const currentIntent =
        String(getPaymentSession()?.intent || localStorage.getItem("risx_last_payment_intent") || localStorage.getItem("risx_payment_intent") || "entry").toLowerCase() === "restart"
          ? "restart"
          : "entry";

      setPaymentSession({
        status: "paid",
        intent: currentIntent,
        tier: serverTierKey,
        invoiceId: pid,
        paymentId: pid,
        amount: s.pay_amount || 0,
        currency: s.pay_currency || "",
        payAddress: s.pay_address || "",
        createdAt: Date.now()
      });

      handleConfirmed(s);
      return;
    }
    if (status === "expired" || status === "cancelled") {
      updatePaymentSessionStatus(status);
    }
  } catch (e) {
    if (manualMsgEl) manualMsgEl.textContent = "Could not verify that payment_id. Double-check and try again.";
  } finally {
    manualCheckBtn.disabled = false;
    manualCheckBtn.textContent = "Verify Payment";
  }
});

  // ------- Expose ONE function for your tier buttons -------
  window.RISX_openPayModalForTier = async (tierKey) => {
  const intent = localStorage.getItem("risx_payment_intent") || "entry";
  const recovery = await window.RISX_resolveRecoveryState?.({ allowPaymentRecovery: false }).catch?.(() => null);
  const hasVerifiedUnlock = recovery?.kind === "unlock" && String(recovery?.tier || "").toLowerCase() === String(tierKey || "").toLowerCase();
  if (intent === "entry" && hasVerifiedUnlock) {
    toast?.(`✅ ${tierKey} already unlocked.`);
    return;
  }

  openModal(tierKey, intent); // pass intent through
};
})();
