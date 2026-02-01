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

  const PENDING_KEY = "risx_pending_payment"; // stores payment_id + tier + amount + address

  // close actions
  document.querySelectorAll("[data-pay-close]").forEach(el => {
    el.addEventListener("click", () => closeModal());
  });

  // ------- State -------
  let activeTierKey = null;
  let activePaymentId = null;
  let pollTimer = null;

  // ------- Helpers -------

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

  function setPendingPayment(payload) {
    localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
    }

  function getPendingPayment() {
    try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); }
    catch { return null; }
    }

  function clearPendingPayment() {
    localStorage.removeItem(PENDING_KEY);
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

function lockBodyScroll() {
  // Save current scroll position
  const y = window.scrollY || 0;
  document.body.dataset.risxScrollY = String(y);

  // Lock the body in place
  document.body.style.position = "fixed";
  document.body.style.top = `-${y}px`;
  document.body.style.left = "0";
  document.body.style.right = "0";
  document.body.style.width = "100%";
}

function unlockBodyScroll() {
  const y = Number(document.body.dataset.risxScrollY || "0");

  // Restore body styles
  document.body.style.position = "";
  document.body.style.top = "";
  document.body.style.left = "";
  document.body.style.right = "";
  document.body.style.width = "";
  delete document.body.dataset.risxScrollY;

  // Restore scroll position
  window.scrollTo(0, y);
}

  function openModal(tierKey) {
  activeTierKey = tierKey;
  activePaymentId = null;

  tierLabel.textContent = `Tier: ${tierKey}`;
  step2.style.display = "none";
  unlockedBox.style.display = "none";
  statusEl.textContent = "Waiting for payment…";
  amountEl.textContent = "—";
  addressEl.textContent = "—";

  modal.style.display = "block";
  lockBodyScroll();

  // ✅ Refresh-safe: restore pending payment for this tier if it exists
  const pending = getPendingPayment();
  if (pending && pending.tierKey === tierKey && pending.payment_id) {
    activePaymentId = pending.payment_id;

    step2.style.display = "block";
    amountEl.textContent = `${pending.pay_amount} ${String(pending.pay_currency).toUpperCase()}`;
    addressEl.textContent = pending.pay_address;

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
    localStorage.setItem("risx_unlocked_tier", tierKey);
    unlockedBox.style.display = "block";
    statusEl.textContent = "✅ Confirmed";
    clearPendingPayment();
    disableLeaveWarning();
    stopPolling();
  }

  function isUnlocked(tierKey) {
    return localStorage.getItem("risx_unlocked_tier") === tierKey;
  }

  async function createPayment(tierKey, payCurrency) {
    const r = await fetch("/api/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tierKey, payCurrency })
    });

    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Create payment failed");

    return j; // contains payment_id, pay_amount, pay_address, etc.
  }

  async function verifyPayment(paymentId) {
    const r = await fetch(`/api/verify-payment?payment_id=${encodeURIComponent(paymentId)}`);
    const j = await r.json();
    if (!r.ok) throw new Error(j?.error || "Verify payment failed");
    return j;
  }

  function startPolling(paymentId) {
    stopPolling();

    const tick = async () => {
      try {
        const s = await verifyPayment(paymentId);

        // statuses vary; we treat confirmed/finished as paid
        const status = (s.payment_status || "").toLowerCase();
        statusEl.textContent = `Status: ${status || "unknown"}`;

        if (status === "confirmed" || status === "finished") {
          setUnlocked(activeTierKey);
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
      const data = await createPayment(activeTierKey, payCurrency);

      activePaymentId = data.payment_id;

      setPendingPayment({
        tierKey: activeTierKey,
        payment_id: data.payment_id,
        pay_amount: data.pay_amount,
        pay_currency: data.pay_currency || payCurrency,
        pay_address: data.pay_address,
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
      createBtn.textContent = "Create Payment";
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
    if (!activePaymentId) return;
    try {
      const s = await verifyPayment(activePaymentId);
      const status = (s.payment_status || "").toLowerCase();
      statusEl.textContent = `Status: ${status || "unknown"}`;
      if (status === "confirmed" || status === "finished") {
        setUnlocked(activeTierKey);
      }
    } catch (e) {
      alert(e.message || String(e));
    }
  });

  // ------- Expose ONE function for your tier buttons -------
  window.RISX_openPayModalForTier = (tierKey) => {
    if (isUnlocked(tierKey)) {
      alert(`✅ ${tierKey} already unlocked.`);
      return;
    }
    openModal(tierKey);
  };
})();

(() => {
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  if (!isLocal) return;

  const btn = document.createElement("button");
  btn.textContent = "DEV UNLOCK (PRO)";
  btn.style.cssText = "position:fixed;bottom:14px;left:14px;z-index:999999;padding:10px 12px;border-radius:12px;";
  btn.addEventListener("click", () => {
    localStorage.setItem("risx_unlocked_tier", "pro");
    alert("✅ DEV unlocked: pro");
  });

  document.body.appendChild(btn);
})();