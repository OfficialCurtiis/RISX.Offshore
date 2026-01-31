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

  // close actions
  document.querySelectorAll("[data-pay-close]").forEach(el => {
    el.addEventListener("click", () => closeModal());
  });

  // ------- State -------
  let activeTierKey = null;
  let activePaymentId = null;
  let pollTimer = null;

  // ------- Helpers -------
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
  }

  function closeModal() {
    modal.style.display = "none";
    stopPolling();
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function setUnlocked(tierKey) {
    localStorage.setItem("risx_unlocked_tier", tierKey);
    unlockedBox.style.display = "block";
    statusEl.textContent = "✅ Confirmed";
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