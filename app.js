document.documentElement.classList.add("js-ready");

// =========================
// RISX: CORE STATE
// =========================
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

//wallet state
let currentWallet = "";
let balance = 0;
let selectedCurrency = "USDT";

// CHALLENGE STATE
let challengeActive = false;
let challengeCompleted = false;
let challengeFailed = false;
let challengeTierSelected = "beginner";
let _lastBalanceForMercy = 0;
let ROUND_ACTIVE = false;
let failModal;


// SESSION STATS (not persisted)
let sessionRounds = 0;
let bestCrashMult = 0;
let minesWins = 0;
let minesLosses = 0;

// MINES STATE
let currentBet = 10;
let currentMines = 3;
let gameActive = false;
let minesSet = new Set();
let safeClicks = 0;
let minesResultHideTimer = null;

// PLINKO STATE
let plinkoRows = 8;
let plinkoBet = 10;
let plinkoDropping = false;
let lastPlinkoResult = null;

let serverSeed = "CHANGE_ME_TO_RANDOM_LONG_SECRET"; // secret until reveal
let clientSeed = "Guest"; // let player edit this
let plinkoNonce = 0;
let plinkoBallsInFlight = 0;

// CRASH STATE
let crashRoundActive = false;
let crashCrashed = false;
let crashHasCashedOut = false;
let crashBet = 10;
let crashCrashPoint = 0;      // multiplier at which round crashes
let crashCurrentMult = 1.0;
let crashStartTime = 0;
let crashAnimFrameId = null;
let crashCashedOutMult = 0;   // optional, for history/logic
let crashCashedOutWin  = 0;   // optional, for toast line
const crashMaxDisplayMult = 50; // cap visual rocket/curve at 50x
const crashRounds = []; // { outcome: 'bust'|'cashout', mult: number }

//========================
// Challenge modal bonding
//========================
const openChallengeBtn = document.getElementById("openChallengeBtn");
const challengeModal = document.getElementById("challengeModal");
const challengeTier = document.getElementById("challengeTier");
const challengeStartBtn = document.getElementById("challengeStartBtn");
const challengeMsg = document.getElementById("challengeMsg");
const tierSummary = document.getElementById("tierSummary");
const challengeResetBtn = document.getElementById("challengeResetBtn");
const challengeRecoveryCtas = document.getElementById("challengeRecoveryCtas");
const resumePaymentBtn = document.getElementById("resumePaymentBtn");
const startChallengeRecoveryBtn = document.getElementById("startChallengeRecoveryBtn");
const resumeClaimBtn = document.getElementById("resumeClaimBtn");
const winReturnHomeBtn = document.getElementById("winReturnHomeBtn");

// =========================
// DOM REFS (declare only once)
// =========================
const connectWalletBtn = document.getElementById("connectWalletBtn");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const adminBtn = document.getElementById("adminBtn");
const currencySelect = document.getElementById("currencySelect"); 
const walletCurrencyLabel = document.getElementById("walletCurrencyLabel"); 

// ============  Life Cycle ========== //
const RISX_SAVE_KEY = "risx_demo_wallet_v2";
const WALLET_KEY = `${RISX_SAVE_KEY}::activeWallet`;
const walletStoreKey = (wallet) => `${RISX_SAVE_KEY}::wallet::${wallet}`;
const CHALLENGE_WALLET_ID = "__RISX_CHALLENGE__";
const RUN_ID_KEY      = "risx_run_id";
const RUN_TIER_KEY    = "risx_run_tier";
const RUN_STATUS_KEY  = "risx_run_status";
const RUN_START_KEY   = "risx_run_started_at";
const RUN_END_KEY     = "risx_run_ended_at";
const RESTART_FAILED_RUN_ID_KEY = "risx_restart_failed_run_id";
const PAYMENT_SESSION_KEY = "risx_payment_session";
const CLAIM_STATE_KEY = "risx_claim_state";
let recoveryUnlockTier = "";
let recoveryUnlockIntent = "entry";

function debounce(fn, delay = 150) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// =========================
// Modal DOM refs (make them real, not window globals)
// =========================
const depositModal = document.getElementById("depositModal");
const withdrawModal = document.getElementById("withdrawModal");
const adminModal = document.getElementById("adminModal");
const adminLoginModal = document.getElementById("adminLoginModal");
const risxInputModal = document.getElementById("risxInputModal");
const risxInputTitle = document.getElementById("risxInputTitle");
const risxInputDescription = document.getElementById("risxInputDescription");
const risxInputLabel = document.getElementById("risxInputLabel");
const risxInputField = document.getElementById("risxInputField");
const risxInputError = document.getElementById("risxInputError");
const risxInputCancel = document.getElementById("risxInputCancel");
const risxInputConfirm = document.getElementById("risxInputConfirm");
const risxPayoutModal = document.getElementById("risxPayoutModal");
const payoutAsset = document.getElementById("payoutAsset");
const payoutChain = document.getElementById("payoutChain");
const payoutChainNotice = document.getElementById("payoutChainNotice");
const payoutAddress = document.getElementById("payoutAddress");
const payoutEmail = document.getElementById("payoutEmail");
const payoutPasteBtn = document.getElementById("payoutPasteBtn");
const risxPayoutError = document.getElementById("risxPayoutError");
const risxPayoutCancel = document.getElementById("risxPayoutCancel");
const risxPayoutConfirm = document.getElementById("risxPayoutConfirm");

const depositCurrency = document.getElementById("depositCurrency");
const depositAddress = document.getElementById("depositAddress");
const copyDepositBtn = document.getElementById("copyDepositBtn");
const depositMsg = document.getElementById("depositMsg");

const depositAmount = document.getElementById("depositAmount");
const depositSubmitBtn = document.getElementById("depositSubmitBtn");

const withdrawAmount = document.getElementById("withdrawAmount");
const withdrawAddress = document.getElementById("withdrawAddress");
const withdrawSubmitBtn = document.getElementById("withdrawSubmitBtn");
const withdrawClearBtn = document.getElementById("withdrawClearBtn");
const withdrawMsg = document.getElementById("withdrawMsg");
const withdrawHistoryList = document.getElementById("withdrawHistoryList");

const adminTabDeposits = document.getElementById("adminTabDeposits");
const adminTabWithdrawals = document.getElementById("adminTabWithdrawals");
const adminTabUsers = document.getElementById("adminTabUsers");
const adminViewDeposits = document.getElementById("adminViewDeposits");
const adminViewWithdrawals = document.getElementById("adminViewWithdrawals");
const adminViewUsers = document.getElementById("adminViewUsers");
const adminRefreshBtn = document.getElementById("adminRefreshBtn");
const adminPendingOnly = document.getElementById("adminPendingOnly");
const adminStatusFilter = document.getElementById("adminStatusFilter");
const adminSearch = document.getElementById("adminSearch");
const adminMsg = document.getElementById("adminMsg");
const adminMintTier = document.getElementById("adminMintTier");
const adminMintBtn = document.getElementById("adminMintBtn");
const adminMintOut = document.getElementById("adminMintOut");
const adminKeyStatusBtn = document.getElementById("adminKeyStatusBtn");
const adminRotateKeyBtn = document.getElementById("adminRotateKeyBtn");
const adminKeyStatusOut = document.getElementById("adminKeyStatusOut");
const adminCountDeposits = document.getElementById("adminCountDeposits");
const adminCountWithdrawals = document.getElementById("adminCountWithdrawals");
const adminCountUsers = document.getElementById("adminCountUsers");
const adminTabClaims     = document.getElementById("adminTabClaims");
const adminViewClaims    = document.getElementById("adminViewClaims");
const adminCountClaims   = document.getElementById("adminCountClaims");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");
const adminLoginForm = document.getElementById("adminLoginForm");
const adminLoginPassword = document.getElementById("adminLoginPassword");
const adminLoginMsg = document.getElementById("adminLoginMsg");
const ADMIN_HOTKEY = "l";
let adminSessionAuthed = false;
let adminMintDebugTimer = null;
const DEBUG = false;

function openAdminPanel() {
  openModal?.(adminModal);
  setAdminTab?.("deposits");
  renderAdmin?.();
  checkAdminStatus?.();
}

function isTypingTarget(target) {
  return target instanceof HTMLElement
    && !!target.closest("input, textarea, select, [contenteditable='true']");
}

function setAdminLoginMessage(msg, isError = true) {
  if (!adminLoginMsg) return;
  adminLoginMsg.textContent = String(msg || "");
  adminLoginMsg.style.color = isError ? "#ff9b9b" : "";
}

async function apiJson(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  let data = {};
  try { data = await res.json(); } catch {}
  return { ok: res.ok, status: res.status, data };
}

async function checkAdminSession() {
  const { ok, data } = await apiJson("/api/admin/me", { method: "GET" });
  adminSessionAuthed = !!(ok && data?.authed);
  return adminSessionAuthed;
}

async function openAdminEntry() {
  try {
    const authed = await checkAdminSession();
    if (authed) {
      closeModal?.(adminLoginModal);
      setAdminLoginMessage("", false);
      openAdminPanel();
      return;
    }
  } catch {}

  if (adminLoginPassword) adminLoginPassword.value = "";
  setAdminLoginMessage("Admin login required.");
  openModal?.(adminLoginModal);
}

async function requireAdminSession() {
  try {
    if (await checkAdminSession()) return true;
  } catch {}
  closeModal?.(adminModal);
  setAdminLoginMessage("Session expired. Please sign in again.");
  openModal?.(adminLoginModal);
  return false;
}

async function submitAdminLogin(e) {
  e.preventDefault();
  const password = String(adminLoginPassword?.value || "");
  if (!password) {
    setAdminLoginMessage("Enter admin password.");
    return;
  }

  setAdminLoginMessage("Signing in...", false);
  const { ok, status, data } = await apiJson("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password }),
  });

  if (!ok) {
    const msg = status === 429
      ? `Too many attempts. Retry in ${Number(data?.retryAfterSec || 60)}s.`
      : String(data?.error || "Login failed.");
    setAdminLoginMessage(msg);
    return;
  }

  setAdminLoginMessage("Signed in.", false);
  adminSessionAuthed = true;
  if (adminLoginPassword) adminLoginPassword.value = "";
  closeModal?.(adminLoginModal);
  openAdminPanel();
}

async function logoutAdminSession() {
  const { ok, data } = await apiJson("/api/admin/logout", { method: "POST" });
  adminSessionAuthed = false;
  closeModal?.(adminModal);
  if (adminLoginPassword) adminLoginPassword.value = "";
  if (ok) {
    setAdminLoginMessage("Signed out.", false);
  } else {
    setAdminLoginMessage(String(data?.error || "Logout failed. Please sign in again."));
  }
  openModal?.(adminLoginModal);
}

function setAdminSecurityOutput(el, msg) {
  if (!el) return;
  el.textContent = String(msg || "—");
}

function formatRemainingMs(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function clearAdminMintDebugTimer() {
  if (adminMintDebugTimer) {
    clearInterval(adminMintDebugTimer);
    adminMintDebugTimer = null;
  }
}

function setMintDebugStatus({ keyName, tier, exp }) {
  clearAdminMintDebugTimer();
  const expMs = Number(exp || 0);
  const render = () => {
    const left = expMs ? formatRemainingMs(expMs - Date.now()) : "n/a";
    const line = `saved:${keyName} tier:${String(tier || "—")} ttl:${left}`;
    setAdminSecurityOutput(adminMintOut, line);
    if (adminMsg) adminMsg.textContent = `Mint debug → ${line}`;
  };
  render();
  if (expMs > Date.now()) {
    adminMintDebugTimer = setInterval(render, 1000);
  }
}

async function applyUnlockFromAdminMint(resp = {}) {
  const token = String(resp?.unlock_token || resp?.token || "");
  const tier = String(resp?.tierKey || adminMintTier?.value || challengeTier?.value || "").toLowerCase();
  if (!token || !tier) {
    setAdminSecurityOutput(adminMintOut, "Mint failed: missing token or tier.");
    return false;
  }

  localStorage.setItem("risx_unlock_token", token);
  localStorage.setItem("risx_unlock_tier", tier);
  const resetExpiresAt = Number(localStorage.getItem("risx_reset_expires_at") || 0);
  const isRestartIntent = localStorage.getItem("risx_restart_required") === "1" && resetExpiresAt > Date.now();
  localStorage.setItem("risx_unlock_intent", isRestartIntent ? "restart" : "entry");

  let verifyJson = {};
  try {
    const verifyRes = await fetch("/api/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    verifyJson = await verifyRes.json().catch(() => ({}));
    const ok = !!(verifyRes.ok && verifyJson?.valid && verifyJson?.tierKey === tier);
    if (!ok) {
      setAdminSecurityOutput(adminMintOut, `Verify failed for tier:${tier}`);
      if (adminMsg) adminMsg.textContent = "Minted token failed /api/verify-token.";
      return false;
    }
  } catch (err) {
    const msg = `Mint verify error: ${String(err?.message || err || "unknown error")}`;
    setAdminSecurityOutput(adminMintOut, msg);
    if (adminMsg) adminMsg.textContent = msg;
    return false;
  }

  setMintDebugStatus({
    keyName: "risx_unlock_token",
    tier,
    exp: Number(verifyJson?.exp || resp?.exp || 0),
  });

  // Refresh local unlock UX immediately; mirrors payment flow outcome without requiring reload.
  if (challengeTier) challengeTier.value = tier;
  challengeTierSelected = tier;
  renderTierSummary?.();
  if (challengeMsg) challengeMsg.textContent = `Tier unlocked: ${tier.toUpperCase()} — press Start Challenge.`;
  void refreshPostPaymentRecovery().catch(() => {});
  return true;
}

async function checkAdminStatus() {
  setAdminSecurityOutput(adminKeyStatusOut, "Checking...");
  const { ok, data } = await apiJson("/api/admin/status", { method: "GET" });
  if (!ok) {
    setAdminSecurityOutput(adminKeyStatusOut, String(data?.error || "Status check failed."));
    return;
  }
  const mint = data?.mint || {};
  const auth = data?.auth || {};
  setAdminSecurityOutput(
    adminKeyStatusOut,
    `CURRENT:${mint.hasCurrent ? "yes" : "no"} PREVIOUS:${mint.hasPrevious ? "yes" : "no"} ADMIN_TOKEN:${auth.hasAdminToken ? "yes" : "no"}`
  );
}

async function mintAdminToken() {
  const tierKey = String(adminMintTier?.value || "beginner");
  setAdminSecurityOutput(adminMintOut, "Minting...");
  try {
    const { ok, data } = await apiJson("/api/admin/mint", {
      method: "POST",
      body: JSON.stringify({ tierKey }),
    });
    if (!ok) {
      setAdminSecurityOutput(adminMintOut, String(data?.error || "Mint failed."));
      return;
    }
    const applied = await applyUnlockFromAdminMint(data);
    if (!applied) return;

    const mintedToken = String(data?.unlock_token || data?.token || "");
    if (mintedToken && navigator?.clipboard?.writeText) {
      try { await navigator.clipboard.writeText(mintedToken); } catch {}
    }
  } catch (err) {
    const msg = `Mint failed: ${String(err?.message || err || "unknown error")}`;
    setAdminSecurityOutput(adminMintOut, msg);
    if (adminMsg) adminMsg.textContent = msg;
  }
}

async function verifyAdminKeyRotation() {
  setAdminSecurityOutput(adminKeyStatusOut, "Verifying rotation...");
  const { ok, data } = await apiJson("/api/admin/rotate-key", { method: "POST" });
  if (!ok) {
    setAdminSecurityOutput(adminKeyStatusOut, String(data?.error || "Rotation verification failed."));
    return;
  }
  setAdminSecurityOutput(adminKeyStatusOut, String(data?.message || "Rotation check passed."));
  await checkAdminStatus();
}

function handleAdminComboHotkey(e) {
  if (e.defaultPrevented || e.isComposing) return;
  if (isTypingTarget(e.target)) return;
  const key = String(e.key || "").toLowerCase();
  if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && key === ADMIN_HOTKEY) {
    e.preventDefault();
    openAdminEntry();
  }
}

// =========================
// DOM HOOKS
// =========================

// Wallet / global
const balanceEl        = document.getElementById("balance");

// Tabs
const tabButtons = document.querySelectorAll(".game-tab");
const gameSections = document.querySelectorAll(".game-section");

// MINES: controls
const mineCountInput   = document.getElementById("mineCount");
const startGameBtn     = document.getElementById("startGameBtn");
const cashOutBtn       = document.getElementById("cashOutBtn");

const presetLowBtn     = document.getElementById("presetLowBtn");
const presetMedBtn     = document.getElementById("presetMedBtn");
const presetHighBtn    = document.getElementById("presetHighBtn");

const betPlus10Btn     = document.getElementById("betPlus10Btn");
const betPlus50Btn     = document.getElementById("betPlus50Btn");
const betHalfBtn       = document.getElementById("betHalfBtn");
const betMaxBtn        = document.getElementById("betMaxBtn");

const presetHintEl     = document.getElementById("presetHint");
const strategyMessageEl= document.getElementById("strategyMessage");
const resultMessageEl  = document.getElementById("resultMessage");

const gridEl           = document.querySelector(".mines-grid");
const multiplierEl     = document.getElementById("multiplier");
const safeClicksEl     = document.getElementById("safeClicks");


// PLINKO: controls & UI
const plinkoRowsEl      = document.getElementById("plinkoRows");
const plinkoDropBtn     = document.getElementById("plinkoDropBtn");
const plinkoMessageEl   = document.getElementById("plinkoMessage");
const plinkoStageEl     = document.getElementById("plinkoStage");
const plinkoBoardEl     = document.getElementById("plinkoBoard");
const plinkoBucketsEl   = document.getElementById("plinkoBuckets");
const plinkoOutcomeEl   = document.getElementById("plinkoOutcome");
const plinkoMultEl      = document.getElementById("plinkoMult");
const plinkoBallEl      = document.getElementById("plinkoBall");
const plinkoRiskEl      = document.getElementById("plinkoRisk");

// MINES: overlay card
const minesResultCard  = document.getElementById("minesResultCard");
const minesResultTitle = document.getElementById("minesResultTitle");
const minesResultMult  = document.getElementById("minesResultMultiplier");
const minesResultWin   = document.getElementById("minesResultWin");

// CRASH: controls & UI
const crashBigMultEl     = document.getElementById("crashBigMult");
const crashStatusMessage = document.getElementById("crashStatusMessage");
const crashStartBtn      = document.getElementById("crashStartBtn");
const crashCashOutBtn    = document.getElementById("crashCashOutBtn");
const crashHistoryEl     = document.getElementById("crashHistory");
const crashRocketEl      = document.getElementById("crashRocket");
const rocketTrailEl      = document.getElementById("rocketTrail");
const crashGraphInner    = document.querySelector(".crash-graph-inner");

// SESSION STATS UI
const statRoundsEl    = document.getElementById("statRounds");
const statBestCrashEl = document.getElementById("statBestCrash");
const statMinesWLEl   = document.getElementById("statMinesWL");
const resetSessionBtn = document.getElementById("resetSessionBtn");
const statSessionTimeEl = document.getElementById("statSessionTime");

// User / daily
const currentWalletEl   = document.getElementById("currentWallet");
// Wallet connect UI
const walletAddressInput    = document.getElementById("walletAddressInput");
const currentWalletDisplay  = document.getElementById("currentWalletDisplay");
const walletStatusEl        = document.getElementById("walletStatus");

let crashCurveLine = null;

// =========================
// PROVABLY FAIR: DOM HOOKS
// =========================
const pfModalEl            = document.getElementById("pfModal");
const pfServerHashEl       = document.getElementById("pfServerHash");
const pfClientSeedInput    = document.getElementById("pfClientSeed");
const pfNewClientSeedBtn   = document.getElementById("pfNewClientSeedBtn");
const pfNonceEl            = document.getElementById("pfNonce");
const pfResetNonceBtn      = document.getElementById("pfResetNonceBtn");
const pfServerSeedEl       = document.getElementById("pfServerSeed");
const pfRevealBtn          = document.getElementById("pfRevealBtn");
const pfRotateBtn          = document.getElementById("pfRotateBtn");
const pfVerifyBtn          = document.getElementById("pfVerifyBtn");
const pfVerifyResultEl     = document.getElementById("pfVerifyResult");
const pfLastRoundEl        = document.getElementById("pfLastRound");

////////////////////////////////////
////////TRIGGER WIN/FAIL////////

function triggerChallengeWin(payload = {}) {
  const tierId = String(payload?.tier || CHALLENGE.tier || challengeTierSelected || "beginner");
  const tier = CHALLENGE_TIERS[tierId] || getTier();
  const target = Number(payload?.target ?? tier?.goalCredits ?? 0);
  const achieved = Number(payload?.achieved ?? target);
  const payout = Number(payload?.payout ?? tier?.prizeUsd ?? 0);

  challengeState.status = "won";
  challengeCompleted = true;
  saveChallengeCompleted?.(true);
  setChallengeStatus?.("won");
  endRun?.("won");
  const finalizedRun = markRunWon?.({
    finalScore: Number(payload?.finalScore ?? achieved),
    finalProgress: payload?.finalProgress ?? achieved,
    finalStep: payload?.finalStep ?? null,
    finalMultiplier: payload?.finalMultiplier ?? null,
    finalState: payload?.finalState ?? "won",
    achieved,
    target,
    payout,
  });
  const winRunId = String(finalizedRun?.runId || localStorage.getItem(RUN_ID_KEY) || "");

  // Recovery metadata is allowed; active access tokens are burned so this run cannot be replayed.
  burnChallengeAccessState({ clearResetFlags: true });

  if (finalizedRun && String(finalizedRun.status || "") === "won" && winRunId) {
    setClaimRecoveryState({
      status: "available",
      winId: winRunId,
      sessionId: winRunId,
      amount: payout,
      createdAt: Date.now(),
      form: normalizeClaimForm(null),
    });
  } else {
    setClaimRecoveryState(null);
  }

  const claimBtn = document.getElementById("submitClaimBtn");
  if (claimBtn) {
    const claimAvailable = !!(finalizedRun && String(finalizedRun.status || "") === "won");
    claimBtn.disabled = !claimAvailable;
    claimBtn.textContent = claimAvailable ? "Claim Reward" : "Claim Unavailable";
  }

  lockAppUI?.(true);

  document.getElementById("winTarget").textContent = `${target.toLocaleString()} credits`;
  document.getElementById("winAchieved").textContent = `${achieved.toLocaleString()} credits`;
  document.getElementById("winPayout").textContent = `$${payout.toLocaleString()} USD`;

  showChallengeResetIfNeeded?.();
  refreshChallengeHud?.();
  clearRun();
  localStorage.removeItem(RESTART_FAILED_RUN_ID_KEY);
  openModal?.(document.getElementById("winModal"));
  renderRecoveryCtas?.();
}

window.triggerChallengeWin = triggerChallengeWin;

let challengeState = {
  status: "inactive", // inactive | active | failed | won | pending
  resetExpiresAt: null
};

// ================================
// Bet Settings Lock (Mines/Crash/Plinko)
// ================================


function _setDisabled(el, disabled) {
  if (!el) return;
  el.disabled = !!disabled;
  el.classList.toggle("is-disabled", !!disabled);
}

function lockBetSettings(gameKey, locked) {
  const lock = !!locked;

  // Helper to grab elements safely
  const $ = (id) => document.getElementById(id);

  // ---- MINES ----
  if (gameKey === "mines") {
    // Bet settings (lock these during an active round)
    const disable = [
      $("betAmount"),
      $("minesHalfBtn"),
      $("mines2xBtn"),
      $("minesMaxBtn"),

      $("mineCount"),
      $("presetLowBtn"),
      $("presetMedBtn"),
      $("presetHighBtn"),

      // If you have these, they'll get locked too (safe if null)
      $("minesMineCount"),
      $("minesDifficulty"),
      $("minesRisk"),
      $("minesStartBtn"),
      $("minesStart"),
    ];

    // Buttons that MUST stay usable during an active round
    const keepEnabled = [
      $("minesCashoutBtn"),
      $("minesCashout"),
      $("cashOutBtn"),
    ];

    disable.forEach((el) => _setDisabled(el, lock));
    keepEnabled.forEach((el) => _setDisabled(el, false));
  }

  // ---- CRASH ----
  if (gameKey === "crash") {
    // "settings beside cashout button" = lock anything that changes wager/auto rules mid-round
    const disable = [
      $("crashBetAmount"),
      $("crashHalfBtn"),
      $("crash2xBtn"),
      $("crashMaxBtn"),

      // Common Crash settings inputs (safe if you don't have them)
      $("crashAutoCashout"),
      $("crashAutoCashoutInput"),
      $("crashAuto"),
      $("crashStartBtn"),
      $("crashStart"),
    ];

    // MUST remain usable mid-round:
    const keepEnabled = [
      $("crashCashoutBtn"),
      $("crashCashout"),
    ];

    disable.forEach((el) => _setDisabled(el, lock));
    keepEnabled.forEach((el) => _setDisabled(el, false));
  }

  // ---- PLINKO ----
  if (gameKey === "plinko") {
    // Lock wager/settings while balls are in-flight
    // BUT keep the "drop ball" button enabled so they can spam drops.
    const disable = [
      $("plinkoBetAmount"),
      $("plinkoHalfBtn"),
      $("plinko2xBtn"),
      $("plinkoMaxBtn"),

      // Common Plinko settings (safe if you don't have them)
      $("plinkoRows"),
      $("plinkoPins"),
      $("plinkoRisk"),
      $("plinkoRiskSelect"),
      $("plinkoStartBtn"),
      $("plinkoStart"),
    ];

    // MUST remain usable even while locked:
    const keepEnabled = [
      $("plinkoDropBtn"),
      $("plinkoDropBallBtn"),
      $("plinkoDropBall"),
    ];

    disable.forEach((el) => _setDisabled(el, lock));
    keepEnabled.forEach((el) => _setDisabled(el, false));
  }
}

function plinkoOnBallDrop_LockIfNeeded() {
  if (plinkoBallsInFlight === 0) lockBetSettings("plinko", true);
  plinkoBallsInFlight += 1;
}

function plinkoOnBallResolved_UnlockIfDone() {
  plinkoBallsInFlight = Math.max(0, plinkoBallsInFlight - 1);
  if (plinkoBallsInFlight === 0) lockBetSettings("plinko", false);
}

// =========================
// CHALLENGE TIERS (shape must match game code)
// =========================

const CHALLENGE_TIERS = {
  beginner: {
    entryUsd: 10,
    prizeUsd: 65,
    restartUsd: 7,
    startCredits: 250,
    mercyAllInAt: 50,
    goalCredits: 10000,
    minesMaxBetPct: 0.15,
    crashMaxBetPct: 0.15,
    plinkoMaxBetPct: 0.10,
    minesMin: 3,
    minesMaxCashoutMult: 4.5,
    plinkoMaxMult: 40,
    crashAutoCashout: false
  },

  // Optional placeholders (you can tune later)
  intermediate: {
    entryUsd: 25,
    prizeUsd: 175,
    restartUsd: 18,
    startCredits: 500,
    mercyAllInAt: 75,
    goalCredits: 25000,
    minesMaxBetPct: 0.12,
    crashMaxBetPct: 0.12,
    plinkoMaxBetPct: 0.08,
    minesMin: 4,
    minesMaxCashoutMult: 4.0,
    plinkoMaxMult: 30,
    crashAutoCashout: false
  },

  pro: {
    entryUsd: 50,
    prizeUsd: 1000,
    restartUsd: 35,
    startCredits: 750,
    mercyAllInAt: 100,
    goalCredits: 50000,
    minesMaxBetPct: 0.12,
    crashMaxBetPct: 0.12,
    plinkoMaxBetPct: 0.08,
    minesMin: 5,
    minesMaxCashoutMult: 3.5,
    plinkoMaxMult: 25,
    crashAutoCashout: false,
    locked: true,
    lockReason: "Invite Only"
  }
};

const CHALLENGE = {
  enabled: true,
  active: false,
  tier: null,
  startBalance: 0,
  target: 100,
  maxBetPct: 0.1,
  locked: false
};

function getTier() {
  const tierKey = challengeTierSelected || CHALLENGE.tier || "beginner";
  return CHALLENGE_TIERS[tierKey] || CHALLENGE_TIERS.beginner;
}

function pct(n){ return Math.round((Number(n)||0) * 100); }

function renderTierSummary() {
  const el = document.getElementById("tierSummary");
  if (!el) return;

  const t = getTier();

  const entry = Number(t.entryUsd || 0);
  const prize = Number(t.prizeUsd || 0);

  const key = (challengeTierSelected || CHALLENGE?.tier || "beginner");
  const title = (t.label || key).toString().toUpperCase();

  const isLocked = !!t.locked;

  el.innerHTML = `
    <div class="tier-summary-card ${isLocked ? "locked-tier-card" : ""}">

      ${isLocked ? `
        <div class="tier-locked-banner">
          ${t.lockReason || "Invite Only"}
        </div>
      ` : ""}

      <div class="redeem-note">
        One run. No top-ups. Hit the goal or you reset.
      </div>

      <div class="tier-summary-top">
        <div class="tier-summary-title">${title}</div>
        <div class="tier-summary-prize">
          ${isLocked 
            ? `<span class="locked-text">Locked</span>`
            : `Prize: <span>$${prize}</span>`}
        </div>
      </div>

      ${isLocked ? `
        <div class="tier-summary-foot locked-foot">
          This tier is currently invite only.
        </div>
      ` : `
        <div class="tier-summary-grid">
          <div class="tier-kv"><div class="k">Entry</div><div class="v">$${entry}</div></div>
          <div class="tier-kv"><div class="k">Restart</div><div class="v">$${Number(t.restartUsd || entry)}</div></div>
          <div class="tier-kv"><div class="k">Start Credits</div><div class="v">${t.startCredits}</div></div>
          <div class="tier-kv"><div class="k">Goal</div><div class="v">${t.goalCredits}</div></div>
        </div>

        <div class="tier-summary-rules">
          <div class="rule-line">• Max bet (Mines & Crash): <b>${pct(t.minesMaxBetPct)}%</b> of balance</div>
          <div class="rule-line">• Max bet (Plinko): <b>${pct(t.plinkoMaxBetPct)}%</b> of balance</div>
          <div class="rule-line">• Mines cashouts capped at <b>${t.minesMaxCashoutMult}x</b></div>
          <div class="rule-line">• Plinko can hit up to <b>${t.plinkoMaxMult}x</b></div>
          <div class="rule-line">• Mines must be <b>${t.minesMin}+</b></div>
        </div>

        <div class="tier-summary-foot">
          Start with <b>${t.startCredits}</b> credits. Reach <b>${t.goalCredits}</b> to win <b>$${prize}</b>.<br>
          If you fail, restart the tier for <b>$${Number(t.restartUsd || entry)}</b>.
        </div>
      `}

    </div>
  `;
  renderChallengeParams();
}

// =========================
// Small utils / Challenge helpers
// =========================

function openChallengeTierModal() {
  const modal = document.getElementById("challengeModal"); // <-- YOUR ID
  if (!modal) return;

  openModal?.(modal);

  // YOUR scroller is .modal-body
  const scroller = modal.querySelector(".modal-body") || modal;
  scroller.scrollTop = 0;
}

function closeChallengeTierModal() {
  const modal = document.getElementById("challengeModal");
  if (!modal) return;

  closeModal?.(modal);
}

function setChallengeGoalUI(value) {
  const el = document.getElementById("challengeGoal");
  if (!el) return;
  const n = Number(value);
  el.textContent = (Number.isFinite(n) && n > 0) ? formatCredits(n) : "—";
}

function setChallengeHud({ state = "ready", text = "READY", sub = "", mercyOn = false } = {}) {
  const hud = document.getElementById("challengeHud");
  const stateEl = document.getElementById("challengeStateText");
  const subEl = document.getElementById("challengeHudSub");
  const mercy = document.getElementById("mercyBadge");

  if (!hud || !stateEl || !mercy) return;

  hud.dataset.state = state;
  stateEl.textContent = text;

  if (subEl && sub) subEl.textContent = sub;

  mercy.hidden = !mercyOn;
}

function inMercyNowGlobal() {
  const t = getTier?.() || {};
  setChallengeGoalUI(t.goalBalance ?? t.goal ?? t.target ?? t.targetBalance ?? 0);
  const bal = Math.max(0, Number(getBalance?.() ?? balance ?? 0));
  const mercyAt = Number(t.mercyAllInAt || 0);
  return !!(CHALLENGE?.enabled && challengeActive && bal > 0 && mercyAt > 0 && bal <= mercyAt);
}

function refreshChallengeHud() {
  const bal = Math.max(0, Number(getBalance?.() ?? balance ?? 0));
  const t = getTier?.() || {};
  const mercyAt = Number(t.mercyAllInAt || 0);

  const mercyOn = inMercyNowGlobal();
  const status = getChallengeStatus?.() || ""; // "active" | "won" | "failed" | ""

  // --- Goal UI ---
  const goalEl = document.getElementById("challengeGoal");
  if (goalEl) {
  const t = getTier?.() || {};
  const goal =
    Number(t.goalCredits ?? t.goalBalance ?? t.goal ?? t.target ?? t.targetBalance ?? 0);

  goalEl.textContent = (goal > 0) ? formatCredits(goal) : "—";
}

  // Not in a live challenge
  if (!challengeActive && status === "") {
    setChallengeHud({
      state: "ready",
      text: "READY",
      sub: "Demo • Wallet-mode credits across all games",
      mercyOn: false
    });
    return;
  }

  // Ended states
  if (status === "won") {
    setChallengeHud({
      state: "cleared",
      text: "CLEARED",
      sub: "Challenge completed",
      mercyOn: false
    });
    return;
  }

  if (status === "failed") {
    setChallengeHud({
      state: "failed",
      text: "FAILED",
      sub: "Run ended",
      mercyOn: false
    });
    return;
  }

  // Live state
  // WARNING: close to mercy threshold (you can tune this)
  const warnAt = mercyAt > 0 ? mercyAt * 1.5 : 0;
  const nearBoundary = warnAt > 0 && bal <= warnAt;

  if (nearBoundary && !mercyOn) {
    setChallengeHud({
      state: "warning",
      text: "WARNING",
      sub: "Close to boundary",
      mercyOn: false
    });
    return;
  }

  setChallengeHud({
    state: "live",
    text: "LIVE",
    sub: mercyOn ? "Mercy active: MAX = all-in" : "Challenge running",
    mercyOn
  });
}

  function completeReset() {
    if (challengeState.status !== "failed") return;

    CHALLENGE.resetExpiresAt = null;

    challengeState.status = "active";
    CHALLENGE.active = true;
    challengeActive = true;

    closeModal?.(failModal);
    lockAppUI?.(false);

    startChallengeNow(CHALLENGE.tier);
  }

window.RISX_completeReset = (tier) => {
  if (tier) {
    challengeTierSelected = String(tier);
    CHALLENGE.tier = String(tier);
    if (challengeTier) challengeTier.value = String(tier);
  }
  completeReset();
};

const PAYOUT_ASSET_CHAINS = {
  SOL: ["Solana"],
  LTC: ["Litecoin"],
  BTC: ["Bitcoin"],
  TRX: ["Tron"],
};

function getPayoutChainAckText(asset, chain) {
  const a = String(asset || "").toUpperCase();
  if (a === "SOL") {
    return "SOL claims are processed on Solana only. Use your Solana wallet address.";
  }
  if (a === "LTC") {
    return "LTC claims are processed on Litecoin only. Use a Litecoin wallet address.";
  }
  if (a === "BTC") {
    return "BTC claims are processed on Bitcoin only. Use a Bitcoin address (bc1, 1, or 3).";
  }
  if (a === "TRX") {
    return "TRX claims are processed on Tron only. Use a Tron wallet address starting with T.";
  }
  return `${a} claims are processed on ${String(chain || "")} only.`;
}

function getPayoutChainNoticeText(asset) {
  const a = String(asset || "").toUpperCase();
  if (a === "SOL") return "Network: Solana only.";
  if (a === "LTC") return "Network: Litecoin only.";
  if (a === "BTC") return "Network: Bitcoin only.";
  if (a === "TRX") return "Network: Tron only.";
  return "Use the supported network for this asset.";
}

function risxConfirm({ title = "Confirm", body = "", okText = "OK", cancelText = "Cancel" } = {}) {
  return new Promise((resolve) => {
    const modal   = document.getElementById("risxModal");
    const tEl     = document.getElementById("risxModalTitle");
    const bEl     = document.getElementById("risxModalBody");
    const okBtn   = document.getElementById("risxModalOk");
    const canBtn  = document.getElementById("risxModalCancel");

    if (!modal || !tEl || !bEl || !okBtn || !canBtn) {
      resolve(false);
      return;
    }

    tEl.textContent = title;
    bEl.textContent = body;
    okBtn.textContent = okText;
    canBtn.textContent = cancelText;

    const close = (val) => {
      closeModal?.(modal);
      cleanup();
      resolve(val);
    };

    const onBackdrop = (e) => {
      if (e.target?.dataset?.close !== undefined) close(false);
    };

    const onOk = () => close(true);
    const onCancel = () => close(false);

    const cleanup = () => {
      modal.removeEventListener("click", onBackdrop);
      okBtn.removeEventListener("click", onOk);
      canBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onEsc);
    };

    const onEsc = (e) => { if (e.key === "Escape") close(false); };

    modal.addEventListener("click", onBackdrop);
    okBtn.addEventListener("click", onOk);
    canBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onEsc);

    openModal?.(modal);
    okBtn.focus();
  });
}

async function risxAlert({ title = "Notice", body = "", okText = "OK" } = {}) {
  return risxConfirm({ title, body, okText, cancelText: "Close" });
}

function validateAddressByAsset(asset, chain, address) {
  const raw = String(address || "").trim();
  if (!raw) return "Wallet address is required.";
  if (raw.length < 14 || raw.length > 140) return "Wallet address looks invalid.";

  const normalizedAsset = String(asset || "").toUpperCase();
  const normalizedChain = String(chain || "").toLowerCase();

  if ((normalizedAsset === "BTC" || normalizedChain === "bitcoin") && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,}$/.test(raw)) {
    return "BTC address should start with bc1, 1, or 3.";
  }
  if ((normalizedAsset === "LTC" || normalizedChain === "litecoin")
      && !/^(ltc1[ac-hj-np-z02-9]{8,87}|[LM3][a-km-zA-HJ-NP-Z1-9]{26,33})$/.test(raw)) {
    return "LTC address should start with ltc1, L, M, or 3.";
  }
  if ((normalizedAsset === "SOL" || normalizedChain === "solana") && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(raw)) {
    return "Solana address should be base58 (32-44 chars).";
  }
  if ((normalizedAsset === "TRX" || normalizedChain === "tron") && !/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(raw)) {
    return "TRX address should start with T and be 34 characters.";
  }
  if ((normalizedAsset === "ETH" || ["ethereum", "arbitrum", "optimism", "base", "polygon"].includes(normalizedChain))
      && !/^0x[a-fA-F0-9]{40}$/.test(raw)) {
    return "EVM address should be 0x + 40 hex characters.";
  }

  return "";
}

function updatePayoutChains(asset) {
  if (!payoutChain) return;
  const chains = PAYOUT_ASSET_CHAINS[String(asset || "").toUpperCase()] || [];
  payoutChain.innerHTML = chains.map((chain) => `<option value="${escapeHtml(chain)}">${escapeHtml(chain)}</option>`).join("");
  payoutChain.value = chains[0] || "";
  if (payoutChainNotice) {
    payoutChainNotice.textContent = getPayoutChainNoticeText(asset);
  }
}

function risxInputPrompt({
  title = "Input",
  description = "",
  label = "Value",
  value = "",
  placeholder = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  required = false,
  inputType = "text",
} = {}) {
  return new Promise((resolve) => {
    if (!risxInputModal || !risxInputField || !risxInputConfirm || !risxInputCancel) {
      resolve({ confirmed: false, value: "" });
      return;
    }

    risxInputTitle && (risxInputTitle.textContent = title);
    risxInputDescription && (risxInputDescription.textContent = description || "");
    risxInputLabel && (risxInputLabel.textContent = label);
    risxInputField.type = inputType;
    risxInputField.value = String(value || "");
    risxInputField.placeholder = String(placeholder || "");
    risxInputConfirm.textContent = confirmText;
    risxInputCancel.textContent = cancelText;
    risxInputError && (risxInputError.textContent = "");

    let closed = false;
    const close = (confirmed) => {
      if (closed) return;
      closed = true;
      cleanup();
      closeModal?.(risxInputModal);
      resolve({ confirmed, value: String(risxInputField.value || "").trim() });
    };

    const submit = () => {
      const val = String(risxInputField.value || "").trim();
      if (required && !val) {
        if (risxInputError) risxInputError.textContent = `${label} is required.`;
        risxInputField.focus();
        return;
      }
      close(true);
    };

    const onConfirm = () => submit();
    const onCancel = () => close(false);
    const onBackdrop = (e) => {
      if (e.target === risxInputModal || e.target?.matches?.("[data-risx-input-close]")) close(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") close(false); };
    const onEnter = (e) => { if (e.key === "Enter") submit(); };

    const cleanup = () => {
      risxInputConfirm.removeEventListener("click", onConfirm);
      risxInputCancel.removeEventListener("click", onCancel);
      risxInputModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
      risxInputField.removeEventListener("keydown", onEnter);
    };

    risxInputConfirm.addEventListener("click", onConfirm);
    risxInputCancel.addEventListener("click", onCancel);
    risxInputModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);
    risxInputField.addEventListener("keydown", onEnter);

    openModal?.(risxInputModal);
    setTimeout(() => risxInputField.focus(), 0);
  });
}

function openPayoutDetailsModal(options = {}) {
  return new Promise((resolve) => {
    if (!risxPayoutModal || !payoutAsset || !payoutChain || !payoutAddress || !risxPayoutConfirm || !risxPayoutCancel) {
      resolve({ confirmed: false, payout: null });
      return;
    }

    const savedForm = normalizeClaimForm(options?.draft);
    const onDraftChange = (typeof options?.onDraftChange === "function") ? options.onDraftChange : null;

    payoutAsset.innerHTML = Object.keys(PAYOUT_ASSET_CHAINS)
      .map((asset) => `<option value="${escapeHtml(asset)}">${escapeHtml(asset)}</option>`)
      .join("");
    const initialAsset = String(savedForm.crypto || "SOL").toUpperCase();
    payoutAsset.value = Object.prototype.hasOwnProperty.call(PAYOUT_ASSET_CHAINS, initialAsset) ? initialAsset : "SOL";
    updatePayoutChains(payoutAsset.value);
    const validChains = PAYOUT_ASSET_CHAINS[payoutAsset.value] || [];
    if (savedForm.chain && validChains.includes(savedForm.chain)) {
      payoutChain.value = savedForm.chain;
    }
    payoutAddress.value = savedForm.wallet || "";
    payoutEmail && (payoutEmail.value = savedForm.email || "");
    risxPayoutError && (risxPayoutError.textContent = "");

    let closed = false;
    const close = (confirmed, payout = null) => {
      if (closed) return;
      closed = true;
      cleanup();
      closeModal?.(risxPayoutModal);
      resolve({ confirmed, payout });
    };

    const validate = () => {
      const asset = String(payoutAsset.value || "").toUpperCase();
      const chain = String(payoutChain.value || "");
      const address = String(payoutAddress.value || "").trim();
      const email = String(payoutEmail?.value || "").trim();

      if (!asset) return "Asset is required.";
      if (!chain) return "Chain is required.";

      const assetChains = PAYOUT_ASSET_CHAINS[asset] || [];
      if (!assetChains.includes(chain)) return "Selected chain does not match asset.";

      const addrError = validateAddressByAsset(asset, chain, address);
      if (addrError) return addrError;

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Email format looks invalid.";
      return "";
    };

    const submit = async () => {
      const msg = validate();
      if (msg) {
        if (risxPayoutError) risxPayoutError.textContent = msg;
        return;
      }
      const asset = String(payoutAsset.value || "").toUpperCase();
      const chain = String(payoutChain.value || "");
      const acknowledged = await risxConfirm({
        title: "Confirm Claim Network",
        body: `${getPayoutChainAckText(asset, chain)}\n\nBy continuing, you confirm this address supports ${asset} on ${chain}.`,
        okText: "I Understand",
        cancelText: "Go Back",
      });
      if (!acknowledged) return;

      const payout = {
        asset,
        chain,
        address: String(payoutAddress.value || "").trim(),
      };
      const email = String(payoutEmail?.value || "").trim();
      if (email) payout.email = email;
      close(true, payout);
    };

    const emitDraft = () => {
      onDraftChange?.({
        wallet: String(payoutAddress.value || "").trim(),
        crypto: String(payoutAsset.value || "SOL").toUpperCase(),
        chain: String(payoutChain.value || ""),
        email: String(payoutEmail?.value || "").trim(),
      });
    };

    const onAssetChange = () => {
      updatePayoutChains(payoutAsset.value);
      if (risxPayoutError) risxPayoutError.textContent = "";
      emitDraft();
    };
    const onChainChange = () => emitDraft();
    const onAddressInput = () => emitDraft();
    const onEmailInput = () => emitDraft();
    const onConfirm = () => { void submit(); };
    const onCancel = () => close(false);
    const onBackdrop = (e) => {
      if (e.target === risxPayoutModal || e.target?.matches?.("[data-risx-payout-close]")) close(false);
    };
    const onEsc = (e) => { if (e.key === "Escape") close(false); };
    const onPaste = async () => {
      let pasted = "";
      try {
        pasted = String(await navigator.clipboard.readText() || "");
      } catch {}
      if (!pasted) {
        const manual = window.prompt("Paste your wallet address:");
        if (!manual) return;
        pasted = String(manual);
      }
      const next = pasted.trim();
      if (!next) return;
      payoutAddress.value = next;
      if (risxPayoutError) risxPayoutError.textContent = "";
      emitDraft();
    };

    const cleanup = () => {
      payoutAsset.removeEventListener("change", onAssetChange);
      payoutChain.removeEventListener("change", onChainChange);
      payoutAddress.removeEventListener("input", onAddressInput);
      payoutEmail?.removeEventListener("input", onEmailInput);
      risxPayoutConfirm.removeEventListener("click", onConfirm);
      risxPayoutCancel.removeEventListener("click", onCancel);
      payoutPasteBtn?.removeEventListener("click", onPaste);
      risxPayoutModal.removeEventListener("click", onBackdrop);
      document.removeEventListener("keydown", onEsc);
    };

    payoutAsset.addEventListener("change", onAssetChange);
    payoutChain.addEventListener("change", onChainChange);
    payoutAddress.addEventListener("input", onAddressInput);
    payoutEmail?.addEventListener("input", onEmailInput);
    risxPayoutConfirm.addEventListener("click", onConfirm);
    risxPayoutCancel.addEventListener("click", onCancel);
    payoutPasteBtn?.addEventListener("click", onPaste);
    risxPayoutModal.addEventListener("click", onBackdrop);
    document.addEventListener("keydown", onEsc);

    openModal?.(risxPayoutModal);
    setTimeout(() => payoutAddress.focus(), 0);
  });
}

function mercyConfirm(msg, onConfirm) {
  let wrap = document.getElementById("mercyConfirm");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "mercyConfirm";
    wrap.style.position = "fixed";
    wrap.style.inset = "0";
    wrap.style.zIndex = "10000";
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
    wrap.style.background = "rgba(0,0,0,0.45)";
    wrap.innerHTML = `
      <div style="
        max-width: 420px;
        width: calc(100vw - 32px);
        padding: 18px;
        border-radius: 16px;
        background: rgba(10,15,30,0.95);
        border: 1px solid rgba(255,255,255,0.15);
        text-align: center;
        box-shadow: 0 24px 70px rgba(0,0,0,0.55);
      ">
        <div id="mercyConfirmText" style="font-weight:700;margin-bottom:14px;"></div>
        <button id="mercyConfirmBtn" class="btn primary" type="button">
          I understand
        </button>
      </div>
    `;
    document.body.appendChild(wrap);
  }

  document.getElementById("mercyConfirmText").textContent = msg;
  wrap.style.display = "flex";

  const btn = document.getElementById("mercyConfirmBtn");
  btn.onclick = () => {
    wrap.style.display = "none";
    onConfirm?.();
  };
}

window.updateSupportIdPill = function () {
  const el = document.getElementById("supportIdPill");
  if (!el) return;
  const pid = localStorage.getItem("risx_last_payment_id") || "—";
  el.textContent = `ID: ${pid}`;
};

function loadChallengeState() {
  try {
    const isActive = localStorage.getItem("RISX_CH_ACTIVE") === "1";

    challengeActive = isActive;
    CHALLENGE.active = isActive;

    const t = localStorage.getItem("RISX_CH_TIER");
    if (t) {
      challengeTierSelected = t;
      CHALLENGE.tier = t;
    }
  } catch {}
}

function saveChallengeActive(v){
  try { localStorage.setItem("RISX_CH_ACTIVE", v ? "1" : "0"); } catch {}
}

  // Optional: persist across refresh
  function saveChallengeCompleted(v){
    try { localStorage.setItem("RISX_CHALLENGE_DONE", v ? "1" : "0"); } catch {}
  }
  function loadChallengeCompleted(){
    try { return localStorage.getItem("RISX_CHALLENGE_DONE") === "1"; } catch { return false; }
  }

  const CHALLENGE_STATUS_KEY = "RISX_CHALLENGE_STATUS"; // "active" | "failed" | "won" | ""

  function setChallengeStatus(v) {
    try { localStorage.setItem(CHALLENGE_STATUS_KEY, String(v || "")); } catch {}
  }

  function getChallengeStatus() {
    try { return localStorage.getItem(CHALLENGE_STATUS_KEY) || ""; } catch { return ""; }
  }

  function clearChallengeStatus() {
    try { localStorage.removeItem(CHALLENGE_STATUS_KEY); } catch {}
  }

  function saveChallengeStatus(status) {
  setChallengeStatus(status);
  }

  function saveChallengeState() {
    saveChallengeActive(challengeActive);

    try {
      if (challengeTierSelected) {
        localStorage.setItem("RISX_CH_TIER", challengeTierSelected);
      }
    } catch {}
  }

function challengeToast(msg) {
  const el = document.getElementById("challengeToast");
  if (!el) return;                 // if you’re on a page without it, do nothing
  el.textContent = String(msg || "");
}

// lightweight toast using the walletStatus line (no prompts)
function toast(msg) {
  const el = document.getElementById("walletStatus");
  if (!el) return;
  const prev = el.textContent;
  el.textContent = String(msg);
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.textContent = prev; }, 2200);
}

function clamp2(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 100) / 100;
}

function adjustBalance(delta, opts = {}) {
  const prev = Number(balance || 0);
  balance = clamp2(Math.max(0, prev + Number(delta || 0)));

  updateBalanceDisplay?.();
  persistActiveWalletState?.();
  showChallengeResetIfNeeded?.();

  if (!opts.suppressChallengeChecks) {
  if (challengeActive && !challengeCompleted) {

    const tier = getTier();
    if (!tier) return;

    if (balance >= tier.goalCredits) {
      challengeCompleted = true;
      saveChallengeCompleted?.(true);

      refreshChallengeHud?.();  // Update UI immediately

      challengeActive = false;
      saveChallengeActive?.(false);
      setChallengeStatus?.("won");

      triggerChallengeWin?.({
        tier: CHALLENGE.tier,
        target: tier.goalCredits,
        achieved: balance,
        payout: tier.prizeUsd,
        currency: tier.prizeUsd?.currency || "USDT",
        chain: tier.prizeUsd?.chain || "SOL"
      });

      return;
    }
  }}
}


function postRoundChecks() {
  if (!CHALLENGE?.enabled || !challengeActive) return;

  const roundActiveNow = (typeof anyRoundActive === "function") ? anyRoundActive() : false;
  if (roundActiveNow) return;

  const t = getTier?.() || {};
  const bal = Number(getBalance?.() ?? balance ?? 0);

if (challengeActive && !challengeCompleted && bal <= 0) {
  challengeActive = false;
  challengeCompleted = false;
  saveChallengeActive?.(false);

  challengeFail?.("Balance hit 0");
  showChallengeResetIfNeeded?.();
  refreshChallengeHud?.();
  return;
}

  showChallengeResetIfNeeded?.();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function challengeFail(reason) {
  challengeFailed = true;

  setChallengeStatus?.("failed");
  endRun("failed");
  const failedRun = markRunFailed?.(reason);
  const failedRunId = String(failedRun?.runId || localStorage.getItem(RUN_ID_KEY) || "");
  if (failedRunId) {
    localStorage.setItem(RESTART_FAILED_RUN_ID_KEY, failedRunId);
  }

  toast?.(`Challenge failed — ${reason}`);
  burnChallengeAccessState({ clearResetFlags: false });

  challengeState.status = "failed";

  CHALLENGE.resetExpiresAt = Date.now() + (10 * 60 * 1000);
  localStorage.setItem("risx_restart_required", "1");
  localStorage.setItem("risx_reset_expires_at", String(CHALLENGE.resetExpiresAt));

  refreshChallengeHud();
  openModal?.(failModal);
  startResetTimer();
  renderRecoveryCtas?.();

  lockAppUI?.(true);
  clearRun();
}

let _mercyOn = false;

function startResetTimer() {
  const timerEl = document.getElementById("resetTimer");
  if (!timerEl) return;

  const tick = () => {
    const remaining = (CHALLENGE.resetExpiresAt || 0) - Date.now();

    if (remaining <= 0) {
      timerEl.textContent = "Reset expired. Full entry required.";
      document.getElementById("resetBtn")?.setAttribute("disabled", "true");
      return;
    }

    const mins = Math.floor(remaining / 60000);
    const secs = Math.floor((remaining % 60000) / 1000);
    timerEl.textContent = `Discount reset available: ${mins}:${String(secs).padStart(2, "0")}`;
    setTimeout(tick, 1000);
  };

  tick();
}

function getChallengeMaxBetForUI(gameKey) {
  if (!(CHALLENGE?.enabled && challengeActive)) return null;
  return clamp2(challengeMaxBet(gameKey));
}

function roundDownCents(n) {
  return Math.floor(Number(n || 0) * 100) / 100;
}

function challengeMaxBet(gameKey) {
  const t = getTier();
  const bal = Math.max(0, Number(getBalance?.() ?? balance ?? 0));

  // ---- MERCY MODE (all-in) ----
  const inMercy = !!(CHALLENGE?.enabled && challengeActive && bal <= Number(t.mercyAllInAt || 0));

  // toast only when ENTERING mercy (so it can happen again later)
  if (inMercy && !_mercyOn) {
    toast?.(`Low balance mercy: MAX = full balance (≤ ${roundDownCents(t.mercyAllInAt)}).`);
  }
  _mercyOn = false;

  if (inMercy) return roundDownCents(bal);

  // ---- NORMAL CAPS ----
  if (gameKey === "mines")  return roundDownCents(bal * Number(t.minesMaxBetPct || 0));
  if (gameKey === "crash")  return roundDownCents(bal * Number(t.crashMaxBetPct || 0));
  if (gameKey === "plinko") return roundDownCents(bal * Number(t.plinkoMaxBetPct || 0));
  return roundDownCents(bal);
}

function showChallengeResetIfNeeded() {
  if (!challengeResetBtn) return;
  const st = getChallengeStatus();
  challengeResetBtn.style.display =
    (st === "failed" || st === "won") ? "inline-flex" : "none";
}

function wipeChallengeWalletOnly() {
  try {
    localStorage.removeItem(walletStoreKey(CHALLENGE_WALLET_ID));
  } catch {}
}

// =========================
// WALLET STATE (single source of truth)
// =========================

function setBalance(next) {
  balance = clamp2(Math.max(0, Number(next || 0)));
  updateBalanceDisplay?.();
  persistActiveWalletState?.();
}

function getActiveWallet() {
  return String(localStorage.getItem(WALLET_KEY) || "").trim();
}

function setActiveWallet(w) {
  const wallet = String(w || "").trim();
  if (!wallet) return;

  currentWallet = wallet;
  challengeCompleted = loadChallengeCompleted();
  const st = loadWalletState(wallet) || { balance: 1000, currency: "USDT" };

  // persist active wallet using YOUR existing key
  localStorage.setItem(WALLET_KEY, wallet);

 // If challenge hasn't started yet, keep them locked at 0
  if (!challengeActive && !CHALLENGE.active) {
    balance = 0;
  } else {
    balance = (st && typeof st.balance === "number") ? st.balance : 0;
  }
  selectedCurrency = String(st.currency || "USDT");

  // reflect in UI
  currentWalletEl && (currentWalletEl.textContent = wallet);
  currencySelect && (currencySelect.value = selectedCurrency);
  walletCurrencyLabel && (walletCurrencyLabel.textContent = selectedCurrency);

  updateBalanceDisplay?.();

  // make sure it exists in storage (seed once)
  persistActiveWalletState();
}

// =============================
// RUN LIFECYCLE (local only for now)
// =============================

function getRun() {
  return {
    id: localStorage.getItem(RUN_ID_KEY),
    tier: localStorage.getItem(RUN_TIER_KEY),
    status: localStorage.getItem(RUN_STATUS_KEY),
    startedAt: Number(localStorage.getItem(RUN_START_KEY) || 0),
    endedAt: Number(localStorage.getItem(RUN_END_KEY) || 0),
  };
}

function startRun(tier) {
  const t = String(tier || "");
  const session = getPaymentSessionState?.();
  const paymentId = (session && session.tier === t) ? String(session.paymentId || "") : "";
  const run = markRunStarted?.({ tier: t, paymentId });
  if (!run?.runId) {
    toast?.("Challenge could not start because no valid run was found.");
    return null;
  }
  const id = String(run.runId);
  localStorage.setItem(RUN_ID_KEY, id);
  localStorage.setItem(RUN_TIER_KEY, t);
  localStorage.setItem(RUN_STATUS_KEY, String(run?.status || "active"));
  localStorage.setItem(RUN_START_KEY, String(run?.startedAt || Date.now()));
  localStorage.removeItem(RUN_END_KEY);
  return id;
}

function endRun(status /* "won" | "failed" | "reset" */) {
  localStorage.setItem(RUN_STATUS_KEY, status);
  localStorage.setItem(RUN_END_KEY, String(Date.now()));
}

function finalizeActiveRunLocalState(status, runId, endedAt) {
  const localRunId = String(localStorage.getItem(RUN_ID_KEY) || "");
  const targetRunId = String(runId || "");
  if (!localRunId || (targetRunId && localRunId !== targetRunId)) return;
  localStorage.removeItem(RUN_ID_KEY);
  if (status) localStorage.setItem(RUN_STATUS_KEY, String(status));
  else localStorage.removeItem(RUN_STATUS_KEY);
  if (endedAt) localStorage.setItem(RUN_END_KEY, String(Number(endedAt) || Date.now()));
  else localStorage.setItem(RUN_END_KEY, String(Date.now()));
}

function clearRun() {
  localStorage.removeItem(RUN_ID_KEY);
  localStorage.removeItem(RUN_TIER_KEY);
  localStorage.removeItem(RUN_STATUS_KEY);
  localStorage.removeItem(RUN_START_KEY);
  localStorage.removeItem(RUN_END_KEY);
}

function readStoredObject(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : null;
  } catch {
    return null;
  }
}

function normalizeClaimForm(form) {
  const src = (form && typeof form === "object") ? form : {};
  return {
    wallet: String(src.wallet || "").trim(),
    crypto: String(src.crypto || "SOL").toUpperCase(),
    chain: String(src.chain || ""),
    email: String(src.email || "").trim(),
  };
}

function normalizePaymentSession(raw) {
  if (!raw || typeof raw !== "object") return null;

  const status = String(raw.status || "").toLowerCase();
  const intent = String(raw.intent || "entry").toLowerCase();
  const tier = String(raw.tier || raw.tierKey || "").trim();
  const invoiceId = String(raw.invoiceId || "").trim();
  const paymentId = String(raw.paymentId || raw.payment_id || invoiceId).trim();

  if (!["pending", "paid", "expired", "cancelled"].includes(status)) return null;
  if (!["entry", "restart"].includes(intent)) return null;
  if (!tier) return null;
  if (!paymentId && status === "pending") return null;

  return {
    status,
    intent,
    tier,
    invoiceId: invoiceId || paymentId,
    paymentId,
    amount: Number(raw.amount ?? raw.pay_amount ?? 0) || 0,
    currency: String(raw.currency || raw.pay_currency || "").toUpperCase(),
    payAddress: String(raw.payAddress || raw.pay_address || ""),
    createdAt: Number(raw.createdAt || Date.now()),
  };
}

function getPaymentSessionState() {
  const direct = normalizePaymentSession(readStoredObject(PAYMENT_SESSION_KEY));
  if (direct) return direct;

  const legacy = readStoredObject("risx_pending_payment");
  return normalizePaymentSession(legacy ? {
    status: "pending",
    intent: legacy.intent || "entry",
    tier: legacy.tierKey,
    paymentId: legacy.payment_id,
    amount: legacy.pay_amount,
    currency: legacy.pay_currency,
    payAddress: legacy.pay_address,
    createdAt: legacy.createdAt,
  } : null);
}

function setPaymentSessionState(nextState) {
  const normalized = normalizePaymentSession(nextState);
  if (!normalized) {
    localStorage.removeItem(PAYMENT_SESSION_KEY);
    localStorage.removeItem("risx_pending_payment");
    renderRecoveryCtas?.();
    return;
  }

  localStorage.setItem(PAYMENT_SESSION_KEY, JSON.stringify(normalized));
  if (normalized.status === "pending") {
    localStorage.setItem("risx_pending_payment", JSON.stringify({
      intent: normalized.intent,
      tierKey: normalized.tier,
      payment_id: normalized.paymentId,
      pay_amount: normalized.amount,
      pay_currency: normalized.currency,
      pay_address: normalized.payAddress,
      createdAt: normalized.createdAt,
    }));
  } else {
    localStorage.removeItem("risx_pending_payment");
  }
  renderRecoveryCtas?.();
}

async function verifyLocalUnlockToken() {
  const token = String(localStorage.getItem("risx_unlock_token") || "");
  if (!token) return null;

  try {
    const r = await fetch("/api/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j?.valid && j?.tierKey) {
      const storedIntent =
        String(localStorage.getItem("risx_unlock_intent") || getPaymentSessionState()?.intent || "entry").toLowerCase();
      return { tier: String(j.tierKey), intent: (storedIntent === "restart" ? "restart" : "entry") };
    }
  } catch {}

  localStorage.removeItem("risx_unlock_token");
  localStorage.removeItem("risx_unlock_tier");
  localStorage.removeItem("risx_unlock_intent");
  return null;
}

async function recoverUnlockFromPaymentSession() {
  const session = getPaymentSessionState();
  if (!session || !session.paymentId) return null;
  if (!["pending", "paid"].includes(session.status)) return null;

  try {
    const r = await fetch(`/api/verify-payment?payment_id=${encodeURIComponent(session.paymentId)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return null;

    const status = String(j?.payment_status || "").toLowerCase();
    if (status === "confirmed" || status === "finished") {
      const record = upsertPaymentRecord({
        paymentId: session.paymentId,
        wallet: auditWallet(),
        email: auditEmail(),
        tier: String(j?.tierKey || session.tier || ""),
        amount: Number(session.amount || j?.pay_amount || 0),
        currency: String(session.currency || j?.pay_currency || ""),
        status: "paid",
        paidAt: Date.now(),
      });
      if (j?.unlock_token && j?.tierKey) {
        localStorage.setItem("risx_unlock_token", String(j.unlock_token));
        localStorage.setItem("risx_unlock_tier", String(j.tierKey));
        localStorage.setItem("risx_unlock_intent", session.intent || "entry");
      }
      createRunFromPayment({
        paymentId: session.paymentId,
        wallet: record?.wallet || auditWallet(),
        email: record?.email || auditEmail(),
        tier: String(j?.tierKey || session.tier || ""),
        amount: Number(session.amount || j?.pay_amount || 0),
        currency: String(session.currency || j?.pay_currency || ""),
        status: "paid",
        paidAt: Date.now(),
      }, {
        tier: String(j?.tierKey || session.tier || ""),
        tokenId: String(j?.unlock_token || localStorage.getItem("risx_unlock_token") || "").slice(0, 24),
        intent: session.intent || "entry",
        failedRunId: String(localStorage.getItem(RESTART_FAILED_RUN_ID_KEY) || ""),
      });
      setPaymentSessionState({
        ...session,
        status: "paid",
        tier: String(j?.tierKey || session.tier),
      });
      return verifyLocalUnlockToken();
    }

    if (status === "expired" || status === "cancelled") {
      upsertPaymentRecord({
        paymentId: session.paymentId,
        tier: session.tier,
        amount: Number(session.amount || 0),
        currency: String(session.currency || ""),
        status,
      });
      setPaymentSessionState({
        ...session,
        status,
      });
    }
  } catch {}

  return null;
}

async function refreshPostPaymentRecovery() {
  if (challengeActive) {
    recoveryUnlockTier = "";
    recoveryUnlockIntent = "entry";
    renderRecoveryCtas?.();
    return;
  }

  let unlock = await verifyLocalUnlockToken();
  if (!unlock) {
    unlock = await recoverUnlockFromPaymentSession();
  }

  recoveryUnlockTier = String(unlock?.tier || "");
  recoveryUnlockIntent = String(unlock?.intent || "entry");

  if (recoveryUnlockTier && !restartRequiredNow()) {
    recoveryUnlockIntent = "entry";
  }

  if (recoveryUnlockTier && challengeTier) {
    challengeTier.value = recoveryUnlockTier;
    challengeTierSelected = recoveryUnlockTier;
    CHALLENGE.tier = recoveryUnlockTier;
    renderTierSummary?.();
  }

  const paymentSession = getPaymentSessionState();
  const claimState = getClaimRecoveryState();
  const hasAnyRecovery =
    !!recoveryUnlockTier ||
    paymentSession?.status === "pending" ||
    !!(claimState && (claimState.status === "available" || claimState.status === "started"));

  if (!challengeActive && challengeModal) {
    const modalOpen = challengeModal.classList.contains("open") || challengeModal.style.display === "block";
    if (hasAnyRecovery && modalOpen) closeModal(challengeModal);
    if (!hasAnyRecovery && !modalOpen) openModal(challengeModal);
  }

  renderRecoveryCtas?.();
}

function normalizeClaimRecoveryState(raw) {
  if (!raw || typeof raw !== "object") return null;

  const status = String(raw.status || "").toLowerCase();
  if (!["available", "started", "submitted", "paid"].includes(status)) return null;

  const winId = String(raw.winId || "").trim();
  const sessionId = String(raw.sessionId || "").trim();
  if (!winId && !sessionId) return null;

  return {
    status,
    winId,
    sessionId: sessionId || winId,
    amount: Number(raw.amount || 0) || 0,
    createdAt: Number(raw.createdAt || Date.now()),
    submittedAt: raw.submittedAt ? Number(raw.submittedAt) : null,
    form: normalizeClaimForm(raw.form),
  };
}

function claimStateMatchesAuthoritativeRun(state) {
  if (!state) return false;
  if (state.status !== "available" && state.status !== "started") return true;

  const stateRunId = String(state.winId || state.sessionId || "");
  if (!stateRunId) return false;

  const runRecord = getRunById(stateRunId);
  if (runRecord) return String(runRecord.status || "") === "won";

  const localRun = getRun?.() || {};
  const localRunId = String(localRun.id || "");
  if (!localRunId) return false;
  if (String(localRun.status || "") !== "won") return false;
  return (localRunId === state.winId || localRunId === state.sessionId);
}

function getClaimRecoveryState() {
  const state = normalizeClaimRecoveryState(readStoredObject(CLAIM_STATE_KEY));
  if (!state) return null;

  if (!claimStateMatchesAuthoritativeRun(state)) {
    localStorage.removeItem(CLAIM_STATE_KEY);
    return null;
  }
  return state;
}

function setClaimRecoveryState(nextState) {
  const normalized = normalizeClaimRecoveryState(nextState);
  if (!normalized) {
    localStorage.removeItem(CLAIM_STATE_KEY);
    renderRecoveryCtas?.();
    return;
  }
  localStorage.setItem(CLAIM_STATE_KEY, JSON.stringify(normalized));
  renderRecoveryCtas?.();
}

function burnChallengeAccessState({ clearResetFlags = false } = {}) {
  challengeActive = false;
  CHALLENGE.active = false;
  saveChallengeActive?.(false);
  recoveryUnlockTier = "";
  recoveryUnlockIntent = "entry";

  localStorage.removeItem("risx_unlock_token");
  localStorage.removeItem("risx_unlock_tier");
  localStorage.removeItem("risx_unlock_intent");
  localStorage.removeItem("risx_payment_intent");

  if (clearResetFlags) {
    localStorage.removeItem("risx_restart_required");
    localStorage.removeItem("risx_reset_expires_at");
    localStorage.removeItem(RESTART_FAILED_RUN_ID_KEY);
    CHALLENGE.resetExpiresAt = null;
  }
}

function renderRecoveryCtas() {
  if (!challengeRecoveryCtas) return;

  const paymentSession = getPaymentSessionState();
  const claimState = getClaimRecoveryState();
  const showStart = !challengeActive && !!recoveryUnlockTier;
  const showPayment = paymentSession?.status === "pending" && !showStart;
  const showClaim = !!claimState && (claimState.status === "available" || claimState.status === "started");

  challengeRecoveryCtas.style.display = (showPayment || showStart || showClaim) ? "flex" : "none";

  if (resumePaymentBtn) {
    resumePaymentBtn.style.display = showPayment ? "inline-flex" : "none";
  }
  if (startChallengeRecoveryBtn) {
    startChallengeRecoveryBtn.style.display = showStart ? "inline-flex" : "none";
    startChallengeRecoveryBtn.textContent = restartRequiredNow() ? "Resume Restart" : "Start Challenge";
  }
  if (resumeClaimBtn) {
    resumeClaimBtn.style.display = showClaim ? "inline-flex" : "none";
    resumeClaimBtn.textContent = (claimState?.status === "started") ? "Resume Claim" : "Claim Reward";
  }
}

window.RISX_renderRecoveryCtas = () => {
  renderRecoveryCtas();
  void refreshPostPaymentRecovery();
};

/*===============================
     Challenge UI locking
//============================== */ 

function lockAppUI(locked) {
  // disables the main game action buttons
  document.getElementById("startGameBtn")?.toggleAttribute("disabled", locked);
  document.getElementById("cashOutBtn")?.toggleAttribute("disabled", locked);

  document.getElementById("crashStartBtn")?.toggleAttribute("disabled", locked);
  document.getElementById("crashCashOutBtn")?.toggleAttribute("disabled", locked);

  document.getElementById("plinkoDropBtn")?.toggleAttribute("disabled", locked);

  // optional: also disable wallet buttons until tier picked
  document.getElementById("depositBtn")?.toggleAttribute("disabled", locked);
  document.getElementById("withdrawBtn")?.toggleAttribute("disabled", locked);
  document.getElementById("adminBtn")?.toggleAttribute("disabled", locked);
}

function setChallengeWalletUI() {
  // hard-lock wallet identity + ops in challenge mode
  const idsToDisable = ["connectWalletBtn", "depositBtn", "withdrawBtn", "adminBtn", "currencySelect"];
  idsToDisable.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.disabled = true;
    el.style.pointerEvents = "none";
    el.style.opacity = "0.45";
    el.setAttribute("aria-disabled", "true");
  });

  // status text
  const ws = document.getElementById("walletStatus");
  if (ws) ws.textContent = "Challenge Mode — wallet locked";
}

// =========================
// 3.4 BACKEND SEAM (API Transport + Outbox Queue)
// =========================
const RISX_API_MODE = "local"; // "local" (default) or "remote" later
const RISX_OUTBOX_KEY = "RISX_OUTBOX_V1";

function loadOutbox() {
  try { return JSON.parse(localStorage.getItem(RISX_OUTBOX_KEY) || "[]"); }
  catch { return []; }
}
function saveOutbox(list) {
  localStorage.setItem(RISX_OUTBOX_KEY, JSON.stringify(list));
}
function enqueueJob(job) {
  const list = loadOutbox();
  list.unshift(job);
  saveOutbox(list);
  return job;
}
function markJob(id, patch) {
  const list = loadOutbox();
  const idx = list.findIndex(x => x.id === id);
  if (idx < 0) return;
  list[idx] = { ...list[idx], ...patch };
  saveOutbox(list);
}

async function apiRequest(type, payload) {
  // Later: swap this to fetch("/api/...", {method:"POST", body:...})
  if (RISX_API_MODE === "remote") {
    try {
      const res = await fetch("/api/risx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, payload })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data?.error || `HTTP ${res.status}` };
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e?.message || String(e) };
    }
  }

  // LOCAL MODE: pretend success and do nothing here.
  return { ok: true, data: { mode: "local" } };
}

// Unified “submit request” entry point (backend seam)
async function submitRequest(type, payload, localApplyFn) {
  const job = enqueueJob({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    type,
    payload,
    status: "QUEUED",      // QUEUED | SENT | FAILED
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tries: 0,
    lastError: ""
  });

  // Always apply locally first (instant UX). Later your backend can reconcile.
  if (typeof localApplyFn === "function") localApplyFn();

  // If remote, attempt send in background (still same click flow)
  if (RISX_API_MODE === "remote") {
    markJob(job.id, { status: "SENT", tries: job.tries + 1, updatedAt: Date.now() });
    const res = await apiRequest(type, payload);
    if (!res.ok) {
      markJob(job.id, {
        status: "FAILED",
        tries: job.tries + 1,
        lastError: res.error || "unknown",
        updatedAt: Date.now()
      });
      return { ok: false, error: res.error, jobId: job.id };
    }
  }

  return { ok: true, jobId: job.id };
}

// Optional: manual retry button later can call this
async function retryFailedOutbox(limit = 10) {
  if (RISX_API_MODE !== "remote") return { ok: true, retried: 0 };

  const list = loadOutbox();
  const failed = list.filter(j => j.status === "FAILED").slice(0, limit);

  for (const j of failed) {
    markJob(j.id, { status: "SENT", tries: (j.tries || 0) + 1, updatedAt: Date.now() });
    const res = await apiRequest(j.type, j.payload);
    if (!res.ok) {
      markJob(j.id, {
        status: "FAILED",
        lastError: res.error || "unknown",
        updatedAt: Date.now()
      });
    }
  }

  return { ok: true, retried: failed.length };
}

// =========================
// ACTION LOCK (anti double-click)
// =========================
const __locks = Object.create(null);

function withLock(key, fn) {
  if (__locks[key]) return;
  __locks[key] = true;
  try { return fn(); }
  finally {
    // release next tick so rapid double clicks don't slip through
    setTimeout(() => { __locks[key] = false; }, 0);
  }
}

// =========================
// PLINKO: HELPERS & SETTINGS (14/15 model, flat top)
// =========================
const PLINKO_BUCKETS = 15;
const PLINKO_DECISION_ROWS = PLINKO_BUCKETS - 1; // 14 decisions => 15 buckets
const PLINKO_MIN_SIDE_PAD = 10;
const PLINKO_MAX_SIDE_PAD = 24;
const PLINKO_MIN_TOP_PAD = 16;
const PLINKO_MAX_TOP_PAD = 34;
const PLINKO_TOP_NUDGE = 10; // visual: push apex down slightly
const PLINKO_BALL_R = 7;
const PLINKO_CLEAR = 2;     // extra spacing so it looks like a bounce

function getBucketCenterX(bucketIndex) {
  const g = plinkoGeom;
  if (!g) return 0;
  return g.sidePad + (bucketIndex + 0.5) * g.dx;
}

function setPlinkoControlsLocked(locked) {
  const root = document.getElementById("game-plinko") || document;
  const panel = root.querySelector(".control-panel") || root;

  // Single source of truth: lock all Plinko bet settings, keep Drop enabled.
  lockBetSettings("plinko", !!locked);

  panel.classList.toggle("locked", !!locked);

  // ✅ NEVER lock Drop Ball
  if (plinkoDropBtn) {
    plinkoDropBtn.disabled = false;
    plinkoDropBtn.removeAttribute("disabled");
  }
}

function spawnPlinkoBall() {
  const template = document.getElementById("plinkoBall");
  const ball = template.cloneNode(true);
  ball.removeAttribute("id");          // IMPORTANT (no duplicate IDs)
  ball.classList.remove("hidden");
  plinkoBoardEl.appendChild(ball);
  return ball;
}

function setBallPosFor(ballEl, x, y) {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;

  // guarantee ball lives inside the board before animating
  if (plinkoBoardEl && ballEl?.parentElement !== plinkoBoardEl) {
    plinkoBoardEl.appendChild(ballEl);
  }

  const xr = Math.round(x * 2) / 2;
  const yr = Math.round(y * 2) / 2;

  ballEl.style.setProperty("--bx", `${xr}px`);
  ballEl.style.setProperty("--by", `${yr}px`);
}

// ---------- Plinko polish: spawn jitter + glow decay ----------
const PLINKO_SPAWN_JITTER_PX = 3;     // ±3px
const PLINKO_GLOW_START = 26;        // px blur
const PLINKO_GLOW_END   = 10;        // px blur
const PLINKO_GLOW_ALPHA_START = 0.95;
const PLINKO_GLOW_ALPHA_END   = 0.35;

function applyBallGlow(ballEl, t01) {
  // t01: 0 (top) -> 1 (bottom)
  const blur  = lerp(PLINKO_GLOW_START, PLINKO_GLOW_END, t01);
  const alpha = lerp(PLINKO_GLOW_ALPHA_START, PLINKO_GLOW_ALPHA_END, t01);

  // keep your neon vibe, just decay intensity
  ballEl.style.boxShadow =
    `0 0 ${blur}px rgba(29, 242, 127, ${alpha}), 0 0 ${blur * 2}px rgba(29, 242, 127, ${alpha * 0.6})`;
}

function spawnJitterX() {
  return (Math.random() - 0.5) * (PLINKO_SPAWN_JITTER_PX * 2);
}

const PLINKO_TABLES = {
  // length MUST be 15 (rows=14 => 15 buckets)
  // Goal: center hits most often AND pays lowest (house edge)
  low:  [6, 3, 2, 1.4, 1.15, 0.9, 0.6, 0.4, 0.6, 0.9, 1.15, 1.4, 2, 3, 6],
  med:  [12, 6, 3, 1.8, 1.2, 0.7, 0.45, 0.25, 0.45, 0.7, 1.2, 1.8, 3, 6, 12],
  high: [40, 15, 6, 3, 1.6, 0.7, 0.35, 0.2, 0.35, 0.7, 1.6, 3, 6, 15, 40],
};

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

let plinkoGeom = null;
let plinkoPegCenters = new Map();

function renderPlinkoBoard() {
  if (!plinkoBoardEl) return;

  const ballNode = document.getElementById("plinkoBall");
  const bucketsNode = document.getElementById("plinkoBuckets");

  plinkoBoardEl.querySelectorAll(".plinko-peg").forEach(n => n.remove());

  if (ballNode && ballNode.parentElement !== plinkoBoardEl) {
    plinkoBoardEl.appendChild(ballNode);
  }
  if (bucketsNode && bucketsNode.parentElement !== plinkoBoardEl) {
    plinkoBoardEl.appendChild(bucketsNode);
  }

  if (ballNode) ballNode.classList.add("hidden");
  plinkoPegCenters = new Map();

  const stageW = plinkoStageEl?.clientWidth || plinkoBoardEl.clientWidth || 640;
  const stageH = plinkoStageEl?.clientHeight || plinkoBoardEl.clientHeight || 520;
  const boardW = stageW;
  const boardH = stageH;

  const css = getComputedStyle(plinkoBoardEl);
  const stripH = parseFloat(css.getPropertyValue("--bucket-strip-h")) || 32;
  const sidePad = clamp(boardW * 0.045, PLINKO_MIN_SIDE_PAD, PLINKO_MAX_SIDE_PAD);
  const topPad = clamp(boardH * 0.07, PLINKO_MIN_TOP_PAD, PLINKO_MAX_TOP_PAD) + PLINKO_TOP_NUDGE;
  const innerW = Math.max(120, boardW - sidePad * 2);
  const cols = PLINKO_BUCKETS + 1;
  // Responsive spacing: scales from stage width, no mobile pixel constants.
  const dx = innerW / (cols - 1);

  plinkoBoardEl.style.setProperty("--plinko-side-pad", `${sidePad}px`);
  plinkoBoardEl.style.setProperty("--plinko-peg-size", `${clamp(dx * 0.28, 8, 14)}px`);

  const bottomPad = stripH + clamp(boardH * 0.055, 14, 28);
  const usableH = Math.max(150, boardH - topPad - bottomPad);
  // Responsive spacing: scales from stage height and decision rows.
  const dy = usableH / (PLINKO_DECISION_ROWS + 1);
  const pegR = clamp(Math.min(dx, dy) * 0.17, 3.2, 6.8);

  // Geometry is rebuilt by ResizeObserver whenever stage dimensions change.
  plinkoGeom = { boardW, boardH, innerW, topPad, bottomPad, sidePad, dx, dy, pegR };

  for (let r = 0; r < PLINKO_DECISION_ROWS; r++) {
    const pegsInRow = Math.min(cols, 3 + r);
    const rowW = (pegsInRow - 1) * dx;
    const startX = sidePad + (innerW - rowW) / 2;

    for (let c = 0; c < pegsInRow; c++) {
      const peg = document.createElement("div");
      peg.className = "plinko-peg";
      peg.dataset.row = String(r);
      peg.dataset.col = String(c);

      const px = startX + c * dx;
      const py = topPad + (r + 1) * dy;

      peg.style.left = `${px}px`;
      peg.style.top = `${py}px`;
      peg.style.width = `${pegR * 2}px`;
      peg.style.height = `${pegR * 2}px`;
      peg.style.marginLeft = `${-pegR}px`;
      peg.style.marginTop = `${-pegR}px`;
      plinkoPegCenters.set(`${r}:${c}`, { x: px, y: py });

      if (plinkoBucketsEl && plinkoBucketsEl.parentElement === plinkoBoardEl) {
        plinkoBoardEl.insertBefore(peg, plinkoBucketsEl);
      } else {
        plinkoBoardEl.appendChild(peg);
      }
    }
  }
}

requestAnimationFrame(() => {
  if (plinkoBallsInFlight > 0) {
    window.__plinkoNeedsRelayout = true;
    return;
  }
  renderPlinkoBoard();
  renderPlinkoBuckets();
});

function renderPlinkoBuckets() {
  if (!plinkoBucketsEl || !plinkoRiskEl) return;

  const risk = plinkoRiskEl.value || "low";
  const mults = PLINKO_TABLES[risk];

  if (!Array.isArray(mults) || mults.length !== PLINKO_BUCKETS) {
    console.error("❌ Plinko table mismatch", {
      risk,
      expected: PLINKO_BUCKETS,
      got: mults?.length
    });
    return;
  }

  plinkoBucketsEl.innerHTML = "";
  plinkoBucketsEl.style.setProperty("--plinko-buckets", String(PLINKO_BUCKETS));

  const center = (PLINKO_BUCKETS - 1) / 2;

  for (let i = 0; i < PLINKO_BUCKETS; i++) {
    const bucket = document.createElement("div");
    bucket.className = "plinko-bucket";
    bucket.dataset.index = String(i);

    const mult = mults[i];
    bucket.textContent = `${mult}x`;

    const heat = Math.abs(i - center) / center;
    bucket.style.setProperty("--heat", String(heat));

    plinkoBucketsEl.appendChild(bucket);
  }
    // ✅ After buckets are in DOM, measure real height and inform board layout
  requestAnimationFrame(() => {
    const h = plinkoBucketsEl.getBoundingClientRect().height || 32;
    plinkoBoardEl?.style?.setProperty("--bucket-strip-h", `${h}px`);
    if (plinkoBallsInFlight > 0) {
      window.__plinkoNeedsRelayout = true;
      return;
    }
    // Now re-render pegs with correct bottomPad so they never overlap buckets
    renderPlinkoBoard();
  });
}

function getPlinkoMultiplier(bucketIndex) {
  const risk = plinkoRiskEl?.value || "low";
  return PLINKO_TABLES[risk]?.[bucketIndex] ?? 1;
}

function plinkoSampleBucket(rows) {
  // each row: left/right choice (0/1). bucket = number of "rights"
  let rights = 0;
  for (let i = 0; i < rows; i++) {
    if (Math.random() < 0.5) rights++;
  }
  return rights; // 0..rows
}

function pegsInRenderedRow(r) {
  if (r < 0) return 0;
  return Math.min(PLINKO_BUCKETS + 1, 3 + r);
}

let plinkoResizeObs = null;

function attachPlinkoResizeObserver() {
  if (!plinkoStageEl && !plinkoBoardEl) return;
  if (plinkoResizeObs) return;

  let raf = 0;
  plinkoResizeObs = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      // Never rebuild mid-flight
      if (plinkoBallsInFlight > 0) {
        window.__plinkoNeedsRelayout = true;
        return;
      }
      renderPlinkoBoard();
      renderPlinkoBuckets();
    });
  });

  plinkoResizeObs.observe(plinkoStageEl || plinkoBoardEl);
}

function getPegCenter(row, logicalCol) {
  const count = pegsInRenderedRow(row);
  if (count <= 0) return null;

  const renderedCol = clamp(logicalCol + 1, 0, count - 1);
  return plinkoPegCenters.get(`${row}:${renderedCol}`) || null;
}

function computePlinkoOutcome(rows) {
  let col = 0;
  const path = [];

  for (let r = 0; r < rows; r++) {
    const goRight = Math.random() < 0.5;
    path.push(goRight ? 1 : 0);
    if (goRight) col += 1;
  }

  return { path }; // bucketIndex 0..rows
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function quadBezier(p0, p1, p2, t) {
  const u = 1 - t;
  return (u*u)*p0 + (2*u*t)*p1 + (t*t)*p2;
}

async function animatePlinkoBall(ballEl, rows, path, options = {}) {
  ballEl.__plinkoAlive = true;
  const stepMs = options.stepMs ?? 145; // slower cadence for more suspense
  const targetBucketIndex = options.targetBucketIndex;
  const g = plinkoGeom;
  const boardW = g?.boardW || plinkoBoardEl.clientWidth || 640;
  const boardH = g?.boardH || plinkoBoardEl.clientHeight || 520;
  const dx = g?.dx || (boardW / PLINKO_BUCKETS);

  const minX = PLINKO_BALL_R + 2;
  const maxX = boardW - (PLINKO_BALL_R + 2);

  let col = 0;
  const first = getPegCenter(0, 0);
  if (!first) throw new Error("Missing first Plinko peg");

  const targetX = clamp(
    Number.isInteger(targetBucketIndex) ? getBucketCenterX(targetBucketIndex) : first.x,
    minX,
    maxX
  );


  const stripH = parseFloat(getComputedStyle(plinkoBoardEl).getPropertyValue("--bucket-strip-h")) || 32;
  const boardRect = plinkoBoardEl.getBoundingClientRect();
  const bucketsRect = plinkoBucketsEl?.getBoundingClientRect();
  let targetY = boardH - (stripH * 0.65) - 6;

  if (bucketsRect && boardRect) {
    const bucketTop = bucketsRect.top - boardRect.top;
    const bucketH = bucketsRect.height || stripH;
    const bucketPocketY = bucketTop + bucketH * 0.62;
    targetY = bucketPocketY - PLINKO_BALL_R;
  }

  targetY = clamp(targetY, PLINKO_BALL_R + 2, boardH - PLINKO_BALL_R - 2);
  const centerBucket = (PLINKO_BUCKETS - 1) / 2;
  const fakeDir = (targetBucketIndex ?? centerBucket) >= centerBucket ? -1 : 1;

  const points = [{ x: first.x + spawnJitterX(), y: Math.max(12, first.y - dx * 1.3) }];

  for (let step = 0; step < rows; step++) {

  const pegA = getPegCenter(step, col);
  if (!pegA) continue;

  // direction this step
  const dir = (path[step] === 1) ? 1 : -1;

  // adjacent peg to define the GAP (lane) center
  const pegB = getPegCenter(step, col + (dir === 1 ? 1 : -1));

  // gap center (fallback if edge)
  const gapX = pegB ? (pegA.x + pegB.x) * 0.5 : (pegA.x + dir * dx * 0.5);

  // advance logical column AFTER we computed current row pegs
  if (path[step] === 1) col += 1;

  const progress = (step + 1) / rows;

  // push “crazy” to the very end so mid-board is clean
  const chaosT = clamp((progress - 0.86) / 0.14, 0, 1);

  // toned-down flavor terms (now that we’re lane-centered)
  const baseDrift = dx * (0.03 + 0.08 * progress);
  const chaosWobble =
    Math.sin((step + 1) * 2.35 + (path[step] ? 0.7 : 2.1)) * dx * (0.06 + 0.22 * chaosT);
  const fakeout = fakeDir * dx * 0.55 * Math.sin(chaosT * Math.PI);

  const settleT = clamp((progress - 0.90) / 0.10, 0, 1);

  // lane-centered X (threads between pegs)
  let x = gapX + dir * baseDrift + chaosWobble + fakeout;
  x = lerp(x, targetX, Math.pow(settleT, 1.1));
  x = clamp(x, minX, maxX);

  // y based on peg row height (fine)
  const y = pegA.y - (g?.pegR || 5) - (PLINKO_BALL_R - 1) + 2;

  points.push({ x, y });
  }

  const last = points[points.length - 1] || { x: targetX, y: targetY - 22 };
  points.push({ x: lerp(last.x, targetX, 0.55), y: lerp(last.y, targetY, 0.62) });
  points.push({ x: targetX, y: targetY });

  setBallPosFor(ballEl, points[0].x, points[0].y);
  applyBallGlow(ballEl, 0);

    let finalRenderedX = points[0].x;

  for (let i = 0; i < points.length - 1; i++) {
    if (!ballEl.isConnected || !ballEl.__plinkoAlive) break;
    const a = points[i];
    const b = points[i + 1];
    const start = performance.now();

    await new Promise((resolve) => {
      let rafId = 0;

      function frame(now) {
        if (!ballEl.isConnected || ballEl.__plinkoAlive !== true) {
          if (rafId) cancelAnimationFrame(rafId);
          return resolve();
        }

        const t = Math.min(1, (now - start) / stepMs);
        const e = smoothstep(t);

        const dxSeg = (b.x - a.x);
        const dySeg = (b.y - a.y);
        const segLen = Math.max(1, Math.hypot(dxSeg, dySeg));
        const px = -dySeg / segLen;
        const py =  dxSeg / segLen;

        const yLin = lerp(a.y, b.y, e);
        const progressY = clamp(yLin / boardH, 0, 1);
        const chaosT = clamp((progressY - 0.86) / 0.14, 0, 1);

        const arcRaw = dx * (0.07 + 0.16 * chaosT);
        const arcMax = segLen * 0.16;
        const arc = Math.min(arcRaw, arcMax);

        const mx = (a.x + b.x) * 0.5 + px * arc;
        const my = (a.y + b.y) * 0.5 + py * arc;

        let x = quadBezier(a.x, mx, b.x, e);
        let y = quadBezier(a.y, my, b.y, e);

        if (chaosT > 0) {
          const w = now * 0.010;
          const orbit = Math.min(dx * (0.02 + 0.04 * chaosT), segLen * 0.06);
          x += Math.sin(w) * orbit;
          y += Math.cos(w * 1.1) * orbit * 0.25;
        }

        x = clamp(x, minX, maxX);

        finalRenderedX = x;
        setBallPosFor(ballEl, x, y);
        applyBallGlow(ballEl, progressY);

        if (t >= 1) {
          if (rafId) cancelAnimationFrame(rafId);
          return resolve();
        }

        rafId = requestAnimationFrame(frame);
      }

      rafId = requestAnimationFrame(frame);
    });
  }

  ballEl.__plinkoAlive = false;
  return finalRenderedX;
}


function highlightBucket(bucketIndex) {
  if (!plinkoBucketsEl) return;
  const buckets = plinkoBucketsEl.querySelectorAll(".plinko-bucket");
  buckets.forEach(b => b.classList.remove("hit"));
  const el = buckets[bucketIndex];
  if (el) el.classList.add("hit");
}

function getBucketIndexFromFinalX(finalXBoardSpace) {
  const boardRect = plinkoBoardEl.getBoundingClientRect();
  const bucketsRect = plinkoBucketsEl.getBoundingClientRect();

  // Convert board-space X into viewport X
  const viewportX = boardRect.left + finalXBoardSpace;

  // Now compute relative X inside buckets
  const relX = viewportX - bucketsRect.left;

  const bucketW = bucketsRect.width / PLINKO_BUCKETS;

  return clamp(
    Math.floor(relX / bucketW),
    0,
    PLINKO_BUCKETS - 1
  );
}

async function dropPlinkoBall(e) {
  if (e) {
  e.preventDefault();
  e.stopPropagation();
}
  const MAX_IN_FLIGHT = 8;
  if (plinkoBallsInFlight >= MAX_IN_FLIGHT) return;

window.__lastPlinkoClickTs = window.__lastPlinkoClickTs || 0;
const now = Date.now();

// ignore ultra-fast duplicate clicks (<120ms) which are almost never intentional
if (now - window.__lastPlinkoClickTs < 120) return;
window.__lastPlinkoClickTs = now;

  plinkoBallsInFlight++;
  if (plinkoBallsInFlight === 1) setPlinkoControlsLocked(true);

  let ballEl = null;

  try {
    const bet = Number(plinkoBetAmountEl?.value || 0);
    const gate = enforceChallengeBet("plinko", bet);
    if (!gate.ok) { plinkoMessageEl.textContent = gate.msg; return; }

    if (bet <= 0) { plinkoMessageEl.textContent = "Enter a bet above 0."; return; }
    if (bet > (getBalance?.() ?? balance ?? 0)) { plinkoMessageEl.textContent = "Bet exceeds your balance."; return; }

    if (!plinkoGeom) { renderPlinkoBoard(); renderPlinkoBuckets(); }

    // charge bet immediately
    adjustBalance(-bet, { suppressChallengeChecks: true, suppressMercy: true });

    const rows = PLINKO_DECISION_ROWS;

    // ✅ concurrency-safe nonce (each ball gets unique nonce even when spam-clicked)
    if (typeof plinkoNonce !== "number") plinkoNonce = 0;
    const nonce = plinkoNonce++;
    const out = await provablyFairPlinko({ serverSeed, clientSeed, nonce, rows });

    pfLastPlinko = { serverSeed, clientSeed, nonce, rows, bucketIndex: out.bucketIndex, path: out.path, digestHex: out.digestHex };
    updatePfUI?.();

    const bucketIndex = out.bucketIndex;
    const mult = getPlinkoMultiplier(bucketIndex);

    // animate (each call awaits its own ball; doesn’t block other calls anymore)
    ballEl = spawnPlinkoBall();
    await animatePlinkoBall(ballEl, rows, out.path, { targetBucketIndex: bucketIndex });

    highlightBucket(bucketIndex);

    const payout = bet * mult * 0.98;
    adjustBalance(+payout, { suppressMercy: true });

    if (plinkoMessageEl) {
      plinkoMessageEl.textContent = `+${formatCredits(payout)} (${mult}x)`;
    }

    } catch (err) {
    console.error(err);
    if (plinkoMessageEl) plinkoMessageEl.textContent = `Plinko error: ${err?.message || err}`;
  } finally {
    if (ballEl?.isConnected) ballEl.remove();

    plinkoBallsInFlight = Math.max(0, plinkoBallsInFlight - 1);

    if (plinkoBallsInFlight === 0) {
      refreshChallengeHud();
      postRoundChecks?.();
      setPlinkoControlsLocked(false);

      if (window.__plinkoNeedsRelayout) {
        window.__plinkoNeedsRelayout = false;
        renderPlinkoBoard();
        renderPlinkoBuckets();
      }
    }
  }
}

// -------------------------
// PROVABLY FAIR PLINKO RNG
// -------------------------

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Bytes(keyStr, msgStr) {
  const keyData = new TextEncoder().encode(keyStr);
  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const msgData = new TextEncoder().encode(msgStr);
  const sig = await crypto.subtle.sign("HMAC", key, msgData);
  return new Uint8Array(sig); // 32 bytes
}

// Get one bit from a byte array at bit position i
function getBit(bytes, i) {
  const byteIndex = Math.floor(i / 8);
  const bitIndex = i % 8;
  return (bytes[byteIndex] >> bitIndex) & 1;
}

/**
 * Deterministic provably-fair plinko outcome
 * @param {object} params
 * @param {string} params.serverSeed - secret until reveal
 * @param {string} params.clientSeed - player controlled
 * @param {number} params.nonce - increments each drop
 * @param {number} params.rows - decision rows (14 for 15 buckets)
 */
async function provablyFairPlinko({ serverSeed, clientSeed, nonce, rows }) {
  // Pull enough bits for rows decisions.
  // 32 bytes = 256 bits. rows=14 needs only 14 bits.
  const msg = `${clientSeed}:${nonce}:plinko`;
  const digest = await hmacSha256Bytes(serverSeed, msg);

  const path = [];
  let bucketIndex = 0;

  for (let r = 0; r < rows; r++) {
    const bit = getBit(digest, r); // 0 or 1
    path.push(bit);
    if (bit === 1) bucketIndex++;
  }

  return { bucketIndex, path, digestHex: [...digest].map(b => b.toString(16).padStart(2,"0")).join("") };
}

// =========================
// PROVABLY FAIR: LOGIC
// =========================
let pfServerRevealed = false;
let pfLastPlinko = null; // { serverSeed, clientSeed, nonce, rows, bucketIndex, path, digestHex }

function randomSeed(len = 32) {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function setupProvablyFairDrawer() {
  if (setupProvablyFairDrawer._bound) return;
  setupProvablyFairDrawer._bound = true;

  const modal = document.getElementById("pfModal");
  if (!modal) return;

  const close = () => {
    closeModal?.(modal);
  };

  const open = () => {
    openModal?.(modal);
  };

  document.querySelectorAll("[data-open-pf]").forEach((btn) => {
    btn.addEventListener("click", open);
  });

  modal.addEventListener("click", (e) => {
    if (e.target?.matches("[data-pf-close]")) close();
  });
}

async function updatePfCommitUI() {
  if (!pfServerHashEl) return;
  const commit = await sha256Hex(serverSeed);
  pfServerHashEl.textContent = commit;
}

function updatePfUI() {
  if (pfClientSeedInput) pfClientSeedInput.value = clientSeed || "";
  if (pfNonceEl) pfNonceEl.textContent = String(plinkoNonce || 0);

  if (pfServerSeedEl) {
    pfServerSeedEl.textContent = pfServerRevealed ? (serverSeed || "—") : "Hidden";
  }

  if (pfLastRoundEl) {
    if (!pfLastPlinko) pfLastRoundEl.textContent = "—";
    else {
      const shortDigest = pfLastPlinko.digestHex
  ? `${pfLastPlinko.digestHex.slice(0, 12)}…`
  : "—";

pfLastRoundEl.textContent =
  `plinko • nonce ${pfLastPlinko.nonce} • bucket ${pfLastPlinko.bucketIndex + 1}/${(pfLastPlinko.rows + 1)} • digest ${shortDigest}`;
    }
  }
}

async function pfRevealServerSeed() {
  pfServerRevealed = true;
  updatePfUI();
  await updatePfCommitUI(); // commit remains same; still useful to show
}

async function pfRotateServerSeed() {
  // rotate = new secret server seed + reset nonce
  serverSeed = randomSeed(40);
  plinkoNonce = 0;
  pfServerRevealed = false;
  pfLastPlinko = null;

  await updatePfCommitUI();
  updatePfUI();
  if (pfVerifyResultEl) pfVerifyResultEl.textContent = "";
}

function pfNewClientSeed() {
  clientSeed = randomSeed(16);
  updatePfUI();
}

function pfResetNonce() {
  plinkoNonce = 0;
  updatePfUI();
}

async function pfVerifyLast() {
  if (!pfVerifyResultEl) return;

  if (!pfLastPlinko) {
    pfVerifyResultEl.textContent = "No last Plinko round yet.";
    return;
  }

  const { serverSeed: s, clientSeed: c, nonce, rows, bucketIndex } = pfLastPlinko;

  const regen = await provablyFairPlinko({ serverSeed: s, clientSeed: c, nonce, rows });

  const ok = regen.bucketIndex === bucketIndex;
  pfVerifyResultEl.textContent = ok
    ? `✅ Verified. bucket=${regen.bucketIndex + 1}`
    : `❌ Mismatch. got bucket=${regen.bucketIndex + 1}`;
}

function readList(key){ try{return JSON.parse(localStorage.getItem(key)||"[]")}catch{return []} }
function writeList(key,arr){ localStorage.setItem(key, JSON.stringify(arr||[])); }

function loadWalletState(wallet){
  const raw = localStorage.getItem(walletStoreKey(wallet));
  if(!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function saveWalletState(wallet, state){
  localStorage.setItem(walletStoreKey(wallet), JSON.stringify(state));
}

function persistActiveWalletState() {
  if (!currentWallet) return;

  saveWalletState(currentWallet, {
    balance: clamp2(Number(balance || 0)),
    currency: String(selectedCurrency || "USDT"),
    updatedAt: Date.now()
  });
}

function userKey(name) {
  return `${RISX_SAVE_KEY}::${name}`;
}

function enforceChallengeBet(gameKey, bet) {
  if (!CHALLENGE.enabled || !challengeActive) return { ok: true };

  const t = getTier();

  // mines minimum mines rule
  if (gameKey === "mines") {
    const mines = Number(mineCountInput?.value || currentMines || 0);
    const minMines = Number(t.minesMin || 1);
  if (mines < minMines) {
  return { ok: false, msg: `Challenge rule: Mines must be ≥ ${minMines}.` };
  }
  }

  // max bet rule
  const maxBet = challengeMaxBet(gameKey);
  if (Number(bet) > maxBet) {
    const bal = Math.max(1, Number(getBalance?.() ?? balance ?? 0));
return { ok:false, msg:`Challenge rule: Max bet is ${formatCredits(maxBet)} (${Math.round((maxBet / bal)*100)}%).` };
  }

  return { ok: true };
}

// =========================
// SESSION PERSISTENCE
// =========================
const SESSION_KEY = "RISX_SESSION_V1";

function loadSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "{}"); }
  catch { return {}; }
}

function saveSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

function restoreSessionStats() {
  const s = loadSession();
  sessionRounds  = Number(s.sessionRounds) || 0;
  bestCrashMult  = Number(s.bestCrashMult) || 0;
  minesWins      = Number(s.minesWins) || 0;
  minesLosses    = Number(s.minesLosses) || 0;

  // timer: if you want it to survive refresh, keep it
  sessionStartMs = Number(s.sessionStartMs) || 0;
}

function persistSessionStats() {
  saveSession({
    sessionRounds,
    bestCrashMult,
    minesWins,
    minesLosses,
    sessionStartMs
  });
}

// =========================
// 3.3 VALIDATION HELPERS
// =========================
function parseAmount(raw, { min = 0.01, max = 1e9, decimals = 2 } = {}) {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n)) return { ok: false, value: 0, msg: "Enter a valid number." };
  if (n < min) return { ok: false, value: 0, msg: `Amount must be at least ${min}.` };
  if (n > max) return { ok: false, value: 0, msg: `Amount too large.` };

  const factor = 10 ** decimals;
  const rounded = Math.floor(n * factor + 1e-9) / factor; // floor to avoid free rounding up
  return { ok: true, value: rounded, msg: "" };
}

function parseTrimmed(raw, { minLen = 1, maxLen = 180, label = "Value" } = {}) {
  const s = String(raw ?? "").trim();
  if (s.length < minLen) return { ok: false, value: "", msg: `${label} is required.` };
  if (s.length > maxLen) return { ok: false, value: "", msg: `${label} is too long.` };
  return { ok: true, value: s, msg: "" };
}

// Demo-only address check (keeps junk out; not chain-specific)
function isProbablyAddress(s) {
  if (!s) return false;
  if (s.length < 12) return false;
  // allow letters/numbers and common chain separators
  return /^[a-zA-Z0-9:_-]+$/.test(s);
}

// =========================
// UTILS
// =========================

function isRestartRequired() {
  const required = String(localStorage.getItem("risx_restart_required") || "").toLowerCase() === "true";
  const expiresAt = Number(localStorage.getItem("risx_reset_expires_at") || 0);
  return required && (!expiresAt || Date.now() < expiresAt);
}

function wireBetMultButtons(gameKey, inputEl, halfBtn, twoXBtn, maxBtn) {
  if (!inputEl || inputEl._wiredMults) return;
  inputEl._wiredMults = true;

  const read = () => Number(inputEl.value || 0);

  const write = (v) => {
    const vv = Math.max(0, Math.round(Number(v || 0) * 100) / 100);
    inputEl.value = String(vv);
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const getBal = () => Math.max(0, Number(getBalance?.() ?? balance ?? 0));

  const inMercyNow = () => {
    const t = getTier?.() || {};
    const bal = getBal();
    const mercyAt = Number(t.mercyAllInAt || 0);
    return !!(CHALLENGE?.enabled && challengeActive && bal > 0 && mercyAt > 0 && bal <= mercyAt);
  };

  const getMaxForUI = () => {
    const bal = getBal();
    if (inMercyNow()) return bal;                 // ✅ mercy = all-in
    return Number(challengeMaxBet?.(gameKey) ?? 0); // ✅ challenge cap
  };

  const applyCap = (val) => Math.min(Number(val || 0), getMaxForUI());

  const BASE_BET = 2.00;

  halfBtn?.addEventListener("click", () => {
    const v = read();
    const next = (v <= 0) ? (BASE_BET / 2) : (v / 2);   // 0 -> 1.00, 2 -> 1.00, 20 -> 10
    write(applyCap(next));
  });

  twoXBtn?.addEventListener("click", () => {
    const v = read();
    const next = (v <= 0) ? (BASE_BET * 2) : (v * 2);   // 0 -> 4.00, 2 -> 4.00, 20 -> 40
    write(applyCap(next));
  });

  maxBtn?.addEventListener("click", async () => {
  const bal = getBal();
  const cap = Number(challengeMaxBet?.(gameKey) ?? 0);

  if (inMercyNow()) {
    const ok = await risxConfirm({
      title: "Mercy Mode",
      body: `Mercy is active.\nMAX will bet your FULL balance: ${formatCredits(bal)}.\n\nProceed?`,
      okText: "Bet Max",
      cancelText: "Back"
    });
    if (!ok) return;

    write(bal);
    refreshChallengeHud?.();
    return;
  }

  const pct = bal > 0 ? Math.round((cap / bal) * 100) : 0;
  toast?.(`MAX = ${formatCredits(cap)} (${pct}% of balance)`);
  write(cap);
 });
}

// Inputs
const betAmountInput    = document.getElementById("betAmount");
const crashBetAmountEl  = document.getElementById("crashBetAmount");
const plinkoBetAmountEl = document.getElementById("plinkoBetAmount");

function setDefaultBetsIfEmpty() {
  const defaults = [
    { el: document.getElementById("betAmount"),      v: 2.00 }, // mines
    { el: document.getElementById("crashBetAmount"), v: 2.00 }, // crash
    { el: document.getElementById("plinkoBetAmount"),v: 2.00 }, // plinko
  ];

  defaults.forEach(({ el, v }) => {
    if (!el) return;
    const cur = Number(el.value || 0);
    if (cur <= 0) {
      el.value = v.toFixed(2);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });
}

// Mines
wireBetMultButtons(
  "mines",
  betAmountInput,
  document.getElementById("minesHalfBtn"),
  document.getElementById("mines2xBtn"),
  document.getElementById("minesMaxBtn")
);

// Crash
wireBetMultButtons(
  "crash",
  crashBetAmountEl,
  document.getElementById("crashHalfBtn"),
  document.getElementById("crash2xBtn"),
  document.getElementById("crashMaxBtn")
);

// Plinko
wireBetMultButtons(
  "plinko",
  plinkoBetAmountEl,
  document.getElementById("plinkoHalfBtn"),
  document.getElementById("plinko2xBtn"),
  document.getElementById("plinkoMaxBtn")
);

function formatCredits(value) {
  return Number(value || 0).toFixed(2);
}

function formatMult(value) {
  return value.toFixed(2) + "x";
}

function updateBalanceDisplay() {
  if (balanceEl) balanceEl.textContent = formatCredits(balance);
}

function updateMinesInfoPanel(mult, safeCount) {
  if (multiplierEl) multiplierEl.textContent = formatMult(mult);
  if (safeClicksEl) safeClicksEl.textContent = safeCount;
}

// Compute fair-ish multiplier from odds with a small house edge
function computeMinesMultiplier(mineCount, safeCount) {
  if (safeCount <= 0) return 1.0;

  const total = TOTAL_CELLS;
  const safeCells = total - mineCount;

  let p = 1;
  for (let i = 0; i < safeCount; i++) {
    p *= (safeCells - i) / (total - i);
  }

  const houseEdge = 0.02;
  const fairMult = (1 - houseEdge) / p;
  return fairMult;
}

function updateSessionStats() {
  if (!statRoundsEl || !statBestCrashEl || !statMinesWLEl) return;

  statRoundsEl.textContent = sessionRounds;
  statBestCrashEl.textContent = bestCrashMult > 0 ? formatMult(bestCrashMult) : "—";
  statMinesWLEl.textContent = `${minesWins} / ${minesLosses}`;
}

// =========================
// SESSION TIMER (not persisted)
// =========================
let sessionStartMs = 0;
let sessionTimerId = null;

function formatSessionTime(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

function updateSessionTimer() {
  if (!statSessionTimeEl) return;

  if (!sessionStartMs) {
    statSessionTimeEl.textContent = "—";
    return;
  }

  const elapsed = Date.now() - sessionStartMs;
  statSessionTimeEl.textContent = formatSessionTime(elapsed);
}

function startSessionTimer() {
  if (sessionTimerId) return;
  updateSessionTimer();
  sessionTimerId = setInterval(updateSessionTimer, 1000);
}

function resetSessionTimer() {
  sessionStartMs = Date.now();
  updateSessionTimer();
}

function resetSessionStats() {
  // Reset timer
  sessionStartMs = Date.now();
  if (sessionTimerId) {
    clearInterval(sessionTimerId);
    sessionTimerId = null;
  }
  startSessionTimer();

  // Reset stats variables
  sessionRounds = 0;
  bestCrashMult = 0;
  minesWins     = 0;
  minesLosses   = 0;

  // Update UI
  updateSessionStats?.();
  updateSessionTimer?.();
}

// =========================
// MINES: GRID BUILD & HELPERS
// =========================


function buildMinesGrid() {
  if (!gridEl) return; // 🛡️ prevents crash
  gridEl.innerHTML = "";

  for (let i = 0; i < TOTAL_CELLS; i++) {
    const cell = document.createElement("div");
    cell.classList.add("cell");
    cell.dataset.index = String(i);
    cell.addEventListener("click", onMinesCellClick);
    gridEl.appendChild(cell);
  }
}

function resetMinesGridVisual() {
  const cells = gridEl.querySelectorAll(".cell");
  cells.forEach(cell => {
    cell.classList.remove("safe", "mine");
    cell.textContent = "";
  });
}

// =========================
// MINES: GAME FLOW
// =========================

function setMinesGridEnabled(enabled) {
  const cells = gridEl.querySelectorAll(".cell");
  cells.forEach(cell => {
    cell.style.pointerEvents = enabled ? "auto" : "none";
  });
}

function resetMinesRound() {
  gameActive = false;
  safeClicks = 0;
  currentBet = 0;

  setMinesGridEnabled(false);
  resetMinesGridVisual();

  startGameBtn.disabled = false;
  cashOutBtn.disabled = true;
}

/////GAMEPLAY//////

function generateMines(mineCount) {
  const set = new Set();
  while (set.size < mineCount) {
    const idx = Math.floor(Math.random() * TOTAL_CELLS);
    set.add(idx);
  }
  return set;
}

function startMinesRound() {
 
  if (gameActive) return;

  const bet = Number(betAmountInput.value || 0);
  const gate = enforceChallengeBet("mines", bet);
  if (!gate.ok) { resultMessageEl.textContent = gate.msg; return; }

  const mCount = Number(mineCountInput.value || 0);

  if (bet <= 0) {
    resultMessageEl.textContent = "Enter a bet above 0.";
    return;
  }
  if (bet > (getBalance?.() ?? balance ?? 0)) {
  resultMessageEl.textContent = "Bet exceeds your balance.";
  return;
  }

  adjustBalance(-bet, { suppressChallengeChecks: true, suppressMercy: true });
  if (mCount < 1 || mCount >= TOTAL_CELLS) {
    resultMessageEl.textContent = "Mines must be between 1 and 24.";
    return;
  }
  if (!sessionStartMs) { sessionStartMs = Date.now(); startSessionTimer(); }

 
  currentBet = bet;
  currentMines = mCount;
  safeClicks = 0;
  minesSet = generateMines(currentMines);
  gameActive = true;
  
  lockBetSettings?.("mines", true);
  updateBalanceDisplay();
  updateMinesInfoPanel(1.0, safeClicks);
  refreshChallengeHud();

  resultMessageEl.textContent = "";
  strategyMessageEl.textContent = "";

  resetMinesGridVisual();
  setMinesGridEnabled(true);
  resetMinesResultCard();

  startGameBtn.disabled = true;
  cashOutBtn.disabled = false;
}

function endMinesRound({ outcome, cashedOut, multiplier }) {
  gameActive = false;
  lockBetSettings?.("mines", false);
  setMinesGridEnabled(false);
  startGameBtn.disabled = false;
  cashOutBtn.disabled = true;

  const winAmount =
    cashedOut && outcome === "win"
      ? currentBet * multiplier
      : 0;

    if (winAmount > 0) {
    adjustBalance(+winAmount, { suppressMercy: true });
  } else {
    persistActiveWalletState?.();
  }
    showMinesResultCard({
    outcome,
    multiplier,
    winAmount
  });

  // stats
  updateSessionStats?.();
  persistSessionStats?.();
  postRoundChecks?.();
  refreshChallengeHud();
}

function resetMinesResultCard() {
  if (!minesResultCard) return;

  minesResultCard.classList.add("hidden");
  minesResultCard.classList.remove("lose", "win");

  if (minesResultTitle) minesResultTitle.textContent = "Round";
  if (minesResultMult)  minesResultMult.textContent  = "1.00x";
  if (minesResultWin)   minesResultWin.textContent   = "0";
}

function showMinesResultCard({ outcome, multiplier = 1, winAmount = 0 }) {
  if (!minesResultCard) return;

  // theme
  minesResultCard.classList.remove("win", "lose");
  minesResultCard.classList.add(outcome === "win" ? "win" : "lose");

  // text
  if (minesResultTitle) {
    minesResultTitle.textContent = outcome === "win" ? "YOU WON" : "BUSTED";
  }
  if (minesResultMult) {
    minesResultMult.textContent = `${Number(multiplier).toFixed(2)}x`;
  }
  if (minesResultWin) {
    minesResultWin.textContent = outcome === "win" ? Math.floor(winAmount).toString() : "0";
  }

  // show (force pop animation each time)
  minesResultCard.classList.remove("hidden");
  minesResultCard.classList.remove("pop");
  void minesResultCard.offsetWidth;
  minesResultCard.classList.add("pop");
}

function onMinesCellClick(e) {

  if (!gameActive) return;

  const cell = e.currentTarget;
  const idx = Number(cell.dataset.index);

  if (cell.classList.contains("safe") || cell.classList.contains("mine")) {
    return;
  }

  if (minesSet.has(idx)) {
    // mark the clicked mine
    cell.classList.add("mine");
    cell.textContent = "";

    let mult = computeMinesMultiplier(currentMines, safeClicks);
    if (CHALLENGE.enabled && challengeActive) {
      const cap = Number(getTier()?.minesMaxCashoutMult || Infinity);
      mult = Math.min(mult, cap);
    }

  // end round FIRST so the result card shows immediately
  endMinesRound({
    outcome: "lose",
    cashedOut: false,
    multiplier: mult
  });

  return;
}

  cell.classList.add("safe");
  cell.textContent = "";
  safeClicks += 1;

  const mult = computeMinesMultiplier(currentMines, safeClicks);
  updateMinesInfoPanel(mult, safeClicks);
}

function cashOutMines() {
  if (!gameActive) return;
  if (safeClicks <= 0) {
    resultMessageEl.textContent =
      "Click at least one safe tile before cashing out.";
    return;
  }

  let mult = computeMinesMultiplier(currentMines, safeClicks);

    // Challenge cap (Mines cashout)
  if (CHALLENGE.enabled && challengeActive) {
    const cap = Number(getTier()?.minesMaxCashoutMult || Infinity);
    mult = Math.min(mult, cap);
  }

  endMinesRound({
    outcome: "win",
    cashedOut: true,
    multiplier: mult
  });
}

// =========================
// MINES PRESETS & SHORTCUTS
// =========================

function setPresetMines(count, label) {
  mineCountInput.value = String(count);
  currentMines = count;
  presetHintEl.textContent =
    `${label} risk preset selected (${count} mines).`;
}

function setupPresetButtons() {
  if (setupPresetButtons._didBind) return;
  setupPresetButtons._didBind = true;

  presetLowBtn.addEventListener("click", () => setPresetMines(3, "Low"));
  presetMedBtn.addEventListener("click", () => setPresetMines(5, "Medium"));
  presetHighBtn.addEventListener("click", () => setPresetMines(8, "High"));
}

// =========================
// CRASH: LOGIC
// =========================

function generateCrashPoint() {
  const houseEdge = 0.03;
  const r = Math.random();

  // Inverse-style distribution (like many crash games use)
  // Raw ~ 1/(1 - r) gives a long tail.
  let raw = 1 / (1 - r);

  // Apply house edge and clamp for sanity
  let point = raw * (1 - houseEdge);

  // Enforce minimum and maximum
  if (point < 1.01) point = 1.01;
  if (point > 250) point = 250;

  return parseFloat(point.toFixed(2));
}

function updateCrashVisuals() {
  if (crashBigMultEl) {
  crashBigMultEl.textContent = formatMult(crashCurrentMult);
}
  if (!crashCurveLine || !crashRocketEl || !rocketTrailEl) return;

  const maxMult = crashMaxDisplayMult || 50;
  const m = Math.max(1, Math.min(crashCurrentMult, maxMult));

  // Graph tick bands (match your on-screen labels)
  const ticks = [1, 10, 25, 50];        // bottom → top
  const bands = ticks.length - 1;       // 3 equal vertical sections

  // Find which band we're in
  let band = 0;
  if (m >= ticks[3]) band = 2;
  else if (m >= ticks[2]) band = 2;
  else if (m >= ticks[1]) band = 1;
  else band = 0;

  const a = ticks[band];
  const b = ticks[band + 1];

  // Within-band progress (use log inside band so it feels "crash-like")
  const t =
    b > a
      ? (Math.log(m) - Math.log(a)) / (Math.log(b) - Math.log(a))
      : 0;

  // Overall vertical progress 0..1 (bands are equal height)
  const pY = Math.min(Math.max((band + t) / bands, 0), 1);

  // Use real graph height instead of a hard cap
  const rect = crashGraphInner.getBoundingClientRect();

  // tune these if you want more/less headroom
  const paddingTop = 42;     // space for top labels
  const paddingBottom = 24;  // space above the baseline

  const maxHeightPx = Math.max(120, rect.height - paddingTop - paddingBottom);

  const yOffset = Math.max(0, pY * maxHeightPx);

  // Horizontal progress (SLOWED so 10–25x isn't already at the right wall)
  const pXRaw = Math.min(Math.max(Math.log(m) / Math.log(maxMult), 0), 1);

  // >1 slows early travel. 2.2 makes ~20x land around mid-right instead of far-right.
  const pX = Math.pow(pXRaw, 2.2);

  const left = 5 + pX * 90;

  crashRocketEl.style.left = `${left}%`;
  crashRocketEl.style.transform = `translate(-50%, -${yOffset}px) rotate(22deg)`;

  // curve + trail match the same pX so everything stays consistent
  if (crashCurveLine) crashCurveLine.style.transform = `scaleX(${pX})`;

  const trailWidth = 10 + pX * 70;
  rocketTrailEl.style.width = `${trailWidth}%`;
}

function syncCrashMultToRocket() {
  if (!crashBigMultEl || !crashRocketEl || !crashGraphInner) return;

  const rocketRect = crashRocketEl.getBoundingClientRect();
  const graphRect  = crashGraphInner.getBoundingClientRect();

  // position multiplier near the rocket
  const x = (rocketRect.left - graphRect.left) + (rocketRect.width / 2) + 28; // +28 shifts it right
  const y = (rocketRect.top  - graphRect.top)  - 18; // above rocket

  crashBigMultEl.style.left = `${x}px`;
  crashBigMultEl.style.top  = `${Math.max(18, y)}px`;
  crashBigMultEl.style.transform = "translate(-50%, -100%)";
}

function handleCrashBust() {
  crashRoundActive = false;
  lockBetSettings?.("crash", false);
  crashCrashed = true;

  crashCashOutBtn.disabled = true;
  crashStartBtn.disabled = false;

  // Keep cashout marker visible through bust if player cashed out (spectator mode)
  const m = document.getElementById("crashCashoutMarker");
  if (m && !crashHasCashedOut) m.hidden = true;

  sessionRounds++;
  updateSessionStats();
  persistSessionStats();

  showCrashToast(`Crashed at ${formatMult(crashCurrentMult)}.`);

  if (crashRocketEl) {
    crashRocketEl.classList.add("crashed");
  }

  if (crashAnimFrameId !== null) {
    cancelAnimationFrame(crashAnimFrameId);
    crashAnimFrameId = null;
  }

  // History
  crashRounds.unshift({
    outcome: "bust",
    mult: crashCurrentMult
  });
  if (crashRounds.length > 5) crashRounds.pop();
  renderCrashHistory();
  postRoundChecks?.();
}

let crashToastTimer = null;

function showCrashToast(msg) {
  if (!crashStatusMessage) return;

  crashStatusMessage.textContent = msg;
  crashStatusMessage.classList.add("show");

  clearTimeout(crashToastTimer);
  crashToastTimer = setTimeout(() => {
    crashStatusMessage.classList.remove("show");
  }, 2200);
}

function crashStep(timestamp) {
  if (!crashRoundActive) return;

  const elapsed = (timestamp - crashStartTime) / 1000; // seconds

  // Exponential-style growth:
  // - starts slow
  // - ramps up the longer it runs
  // tweak 0.24 to slightly speed up/slow down
  const growthRate = 0.24;
  let newMult = Math.exp(growthRate * elapsed);

  // Tiny noise so it's not perfectly smooth
  const noise = 1 + (Math.random() - 0.5) * 0.02; // ±1%
  newMult *= noise;

  // Ensure we never dip below 1.00x due to noise
  if (newMult < 1.0) newMult = 1.0;

  if (newMult >= crashCrashPoint) {
    crashCurrentMult = crashCrashPoint;
    updateCrashVisuals();
    handleCrashBust();
    return;
  }

  crashCurrentMult = newMult;
  updateCrashVisuals();
  crashAnimFrameId = requestAnimationFrame(crashStep);
  syncCrashMultToRocket();
}

function startCrashRound() {
  if (crashRoundActive) return;

  const marker = document.getElementById("crashCashoutMarker");
  if (marker) marker.hidden = true;

  const bet = Number(crashBetAmountEl.value || 0);
  const gate = enforceChallengeBet("crash", bet);
  if (!gate.ok) { crashStatusMessage.textContent = gate.msg; return; }

  if (bet <= 0) {
    crashStatusMessage.textContent = "Enter a bet above 0.";
    return;
  }
 if (bet > (getBalance?.() ?? balance ?? 0)) {
    crashStatusMessage.textContent = "Bet exceeds your balance.";
    return;
  }
  if (!sessionStartMs) { sessionStartMs = Date.now(); startSessionTimer(); }

  crashBet = bet;
  adjustBalance(-bet, { suppressChallengeChecks: true, suppressMercy: true });
  
  crashCrashPoint = generateCrashPoint();
  crashCurrentMult = 1.0;
  crashCrashed = false;

  crashRoundActive = true;
  lockBetSettings?.("crash", true);

  crashStartTime = performance.now();
  crashHasCashedOut = false;
  crashCashedOutMult = 0;
  crashCashedOutWin = 0;

  const m = document.getElementById("crashCashoutMarker");
  if (m) m.hidden = true;

  // also make sure cashout is enabled when round starts
  crashCashOutBtn.disabled = false;

  crashStatusMessage.textContent = "Round running. Cash out any time.";
  crashBigMultEl.textContent = "1.00x";
  crashCurrentMult = 1.0;
  syncCrashMultToRocket();
  updateCrashVisuals();

  // Reset rocket visuals
  if (crashRocketEl) {
    crashRocketEl.classList.remove("crashed");
  }
  if (rocketTrailEl) {
    rocketTrailEl.style.width = "0";
  }
  if (crashCurveLine) {
    crashCurveLine.style.transform = "scaleX(0)";
  }

  crashStartBtn.disabled = true;
  crashCashOutBtn.disabled = false;

  // Start the animation loop
  if (crashAnimFrameId !== null) {
    cancelAnimationFrame(crashAnimFrameId);
  }
  crashAnimFrameId = requestAnimationFrame(crashStep);
}

function cashOutCrash() {
  if (!crashRoundActive || crashCrashed) return;
  if (crashHasCashedOut) return; // ✅ blocks multi-cashout

  crashHasCashedOut = true;

  // Freeze multiplier at cashout moment
  const cashedMult = Number((crashCurrentMult ?? 1).toFixed(2));
  crashCashedOutMult = cashedMult;

  // Compute win (use YOUR existing payout math / house edge if you have it)
  const payout = crashBet * cashedMult;     // or your net payout formula
  crashCashedOutWin = payout;

  // Pay once
  adjustBalance(payout);

  // Spectator mode: disable cashout, BUT DO NOT stop the round/rocket
  crashCashOutBtn.disabled = true;

  // ✅ Place cashout marker at current rocket position (DOM-based)
const rocket = document.getElementById("crashRocket");
const wrap = document.querySelector("#game-crash .crash-graph-inner");
const marker = document.getElementById("crashCashoutMarker");

if (rocket && wrap && marker) {
  const r = rocket.getBoundingClientRect();
  const w = wrap.getBoundingClientRect();

  // Center of rocket
  const xCenter = (r.left + r.width / 2) - w.left;
  const yCenter = (r.top + r.height / 2) - w.top;

  // ✅ offset behind rocket (tweak this)
  const behind = Math.max(10, r.width * 0.35);  // ~35% of rocket width
  const x = xCenter - behind;
  const y = yCenter;

  marker.hidden = false;
  marker.style.left = `${x}px`;
  marker.style.top = `${y}px`;
}

  // Toast (same fading card, just adds winnings line)
  showCrashToast(`Cashed out at ${cashedMult}x\n+${formatCredits(payout)} credits`);

  refreshChallengeHud();
  postRoundChecks?.();
}

function renderCrashHistory() {
  crashHistoryEl.innerHTML = "";
  crashRounds.forEach(entry => {
    const pill = document.createElement("div");
    pill.classList.add("crash-history-pill");
    if (entry.outcome === "bust") pill.classList.add("lose");
    pill.textContent = formatMult(entry.mult);
    crashHistoryEl.appendChild(pill);
  });
}

// =========================
// WALLET CONTROLS
// =========================

function getBalance() {
  return Number(balance || 0);
}

function hashString(str) {
  str = String(str || "");
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function submitDepositRequest(amount, address = "") {
  if (!currentWallet) return toast?.("Connect wallet first.");

  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return toast?.("Invalid deposit amount.");
  }

  const req = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    wallet: currentWallet,                 // ✅ currentWallet ONLY
    currency: String(selectedCurrency || "USDT"),
    amount: clamp2(amt),
    address: String(address || ""),
    status: "PENDING",
    createdAt: Date.now()
  };

  const list = readList(depositsKey);
  list.unshift(req);
  writeList(depositsKey, list);

  return req; // balance changes only when Admin marks PAID
}

function submitWithdrawRequest() {
  const amt = Number(withdrawAmount?.value || 0);
  const addr = String(withdrawAddress?.value || "").trim();

  if (!Number.isFinite(amt) || amt <= 0) { if(withdrawMsg) withdrawMsg.textContent="Enter a valid amount."; return; }
  if (!addr) { if(withdrawMsg) withdrawMsg.textContent="Enter a destination address."; return; }
  if (amt > balance) { if(withdrawMsg) withdrawMsg.textContent="Insufficient balance."; return; }

  const req = {
    id: (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())),
    wallet: currentWallet,
    currency: depositCurrency?.value || "USDT",
    amount: clamp2(amt),
    to: addr,
    status: "PENDING",
    createdAt: Date.now()
  };

  const list = readList(withdrawalsKey);
  list.unshift(req);
  writeList(withdrawalsKey, list);

  withdrawAddress.value = "";
  if (withdrawMsg) withdrawMsg.textContent = "Submitted. Status: PENDING.";
  renderWithdrawHistory();
}

function refreshDepositAddress() {
  if (!depositCurrency || !depositAddress) return;

  const cur = depositCurrency.value || selectedCurrency || "USDT";
  const wallet = String(currentWallet || "").trim() || "demo-wallet";

  // deterministic fake address per wallet+currency (demo)
  const fake = `${cur}_${hashString(wallet).slice(0, 10)}_${hashString(cur).slice(0, 6)}`;

  depositAddress.value = fake;
}

function renderWithdrawHistory(){
  if (!withdrawHistoryList) return;
  const list = readList(withdrawalsKey).filter(r => r.wallet === currentWallet);

  if (!list.length) {
    withdrawHistoryList.innerHTML = `<div class="redeem-empty">No requests yet.</div>`;
    return;
  }

  withdrawHistoryList.innerHTML = list.map(r => `
    <div class="redeem-item">
      <div class="redeem-item-top">
        <div class="redeem-item-title">${Number(r.amount || 0).toFixed(2)} ${escapeHtml(r.currency)}</div>
        <div class="redeem-item-status ${String(r.status||"").toLowerCase()}">${escapeHtml(r.status)}</div>
      </div>
      <div class="redeem-item-sub">${new Date(r.createdAt).toLocaleString()} • ${escapeHtml(r.to)}</div>
    </div>
  `).join("");
}

let __risxModalDepth = 0;

function lockBodyScroll() {
  if (__risxModalDepth === 0) {
    const sbw = window.innerWidth - document.documentElement.clientWidth; // scrollbar width
    document.documentElement.style.overflow = "hidden";
    if (sbw > 0) document.body.style.paddingRight = `${sbw}px`;
  }
  __risxModalDepth++;
}

function unlockBodyScroll() {
  __risxModalDepth = Math.max(0, __risxModalDepth - 1);
  if (__risxModalDepth === 0) {
    document.documentElement.style.overflow = "";
    document.body.style.paddingRight = "";
  }
}

function openModal(modalEl) {
  if (!modalEl) return;

  modalEl.style.display = "block";
  modalEl.classList.add("open");
  modalEl.setAttribute("aria-hidden", "false");

  lockBodyScroll();
}

function closeModal(modalEl) {
  if (!modalEl) return;

  const active = document.activeElement;
  if (active && modalEl.contains(active)) {
    active.blur();
  }

  modalEl.classList.remove("open");
  modalEl.style.display = "none";
  modalEl.setAttribute("aria-hidden", "true");

  unlockBodyScroll();
}

async function switchUser() {
  const { confirmed, value } = await risxInputPrompt({
    title: "Switch Player",
    description: "Set the player name used for this demo session.",
    label: "Player Name",
    value: currentWallet || "Guest",
    placeholder: "Guest",
    confirmText: "Save",
    required: true,
  });
  if (!confirmed) return;

  const next = value.trim();
  if (!next) return;

  currentWallet = next;

  // ✅ Persist active user FIRST so loadState can't revert you to Guest
  localStorage.setItem(`${RISX_SAVE_KEY}::activeWallet`, currentWallet);

  if (currentWalletEl) currentWalletEl.textContent = currentWallet;

  updateBalanceDisplay();
  renderCrashHistory();
}

// =============================
// ADMIN + WITHDRAW UI HELPERS (required)
// =============================

const depositsKey   = `${RISX_SAVE_KEY}::deposits`;
const withdrawalsKey= `${RISX_SAVE_KEY}::withdrawals`;
const claimsKey = `${RISX_SAVE_KEY}::claims`;
const paymentRecordsKey = `${RISX_SAVE_KEY}::challenge_payments`;
const runsKey = `${RISX_SAVE_KEY}::challenge_runs`;
const playerWalletKey = `${RISX_SAVE_KEY}::player_wallet`;
const playerEmailKey = `${RISX_SAVE_KEY}::player_email`;

function auditWallet() {
  const stored = String(localStorage.getItem(playerWalletKey) || "").trim();
  if (stored) return stored;
  if (currentWallet && currentWallet !== CHALLENGE_WALLET_ID) return String(currentWallet);
  const activeWallet = String(localStorage.getItem(WALLET_KEY) || "").trim();
  return activeWallet && activeWallet !== CHALLENGE_WALLET_ID ? activeWallet : "";
}

function auditEmail() {
  return String(localStorage.getItem(playerEmailKey) || "").trim();
}

function normalizePaymentStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["pending", "paid", "expired", "cancelled", "failed"].includes(s)) return s;
  if (s === "finished" || s === "confirmed") return "paid";
  return "pending";
}

function normalizeClaimStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["pending", "approved", "paid", "void"].includes(s)) return s;
  if (s === "pending_review") return "pending";
  if (s === "paid" || s === "void") return s;
  return "pending";
}

function normalizeRunStatus(status) {
  const s = String(status || "").toLowerCase();
  if (["created", "ready", "active", "resumed", "failed", "won", "claimed", "paid", "void"].includes(s)) return s;
  return "created";
}

function inferAssetChainFromCurrency(cur) {
  const v = String(cur || "").toLowerCase();
  if (v.includes("btc")) return { asset: "BTC", chain: "Bitcoin" };
  if (v.includes("ltc")) return { asset: "LTC", chain: "Litecoin" };
  if (v.includes("trx")) return { asset: "TRX", chain: "Tron" };
  if (v.includes("sol")) {
    if (v.includes("usdc")) return { asset: "USDC", chain: "Solana" };
    if (v.includes("usdt")) return { asset: "USDT", chain: "Solana" };
    return { asset: "SOL", chain: "Solana" };
  }
  return { asset: String(cur || "UNKNOWN").toUpperCase(), chain: "" };
}

function newRunId() {
  return `run_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
}

function newClaimId() {
  return crypto.randomUUID ? crypto.randomUUID() : `claim_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function readPaymentRecords() {
  return readList(paymentRecordsKey).filter(Boolean).map((p) => {
    const inferred = inferAssetChainFromCurrency(p.asset || p.currency || "");
    return {
      paymentId: String(p.paymentId || p.payment_id || p.id || ""),
      wallet: String(p.wallet || ""),
      email: String(p.email || ""),
      tier: String(p.tier || p.tierKey || ""),
      amount: Number(p.amount || 0),
      asset: String(p.asset || inferred.asset || ""),
      chain: String(p.chain || inferred.chain || ""),
      status: normalizePaymentStatus(p.status),
      createdAt: Number(p.createdAt || Date.now()),
      paidAt: p.paidAt ? Number(p.paidAt) : null,
    };
  }).filter((p) => !!p.paymentId);
}

function writePaymentRecords(list) {
  writeList(paymentRecordsKey, list || []);
}

function upsertPaymentRecord(payload = {}) {
  const paymentId = String(payload.paymentId || payload.payment_id || "").trim();
  if (!paymentId) return null;

  const inferred = inferAssetChainFromCurrency(payload.asset || payload.currency || "");
  const list = readPaymentRecords();
  const idx = list.findIndex((p) => p.paymentId === paymentId);
  const prev = idx >= 0 ? list[idx] : null;
  const next = {
    paymentId,
    wallet: String(payload.wallet || prev?.wallet || auditWallet() || ""),
    email: String(payload.email || prev?.email || auditEmail() || ""),
    tier: String(payload.tier || prev?.tier || ""),
    amount: Number(payload.amount ?? prev?.amount ?? 0),
    asset: String(payload.asset || prev?.asset || inferred.asset || ""),
    chain: String(payload.chain || prev?.chain || inferred.chain || ""),
    status: normalizePaymentStatus(payload.status || prev?.status || "pending"),
    createdAt: Number(payload.createdAt || prev?.createdAt || Date.now()),
    paidAt: payload.paidAt ? Number(payload.paidAt) : (prev?.paidAt || null),
  };
  if (next.status === "paid" && !next.paidAt) next.paidAt = Date.now();
  if (idx >= 0) list[idx] = next; else list.unshift(next);
  writePaymentRecords(list);
  return next;
}

function getPaymentRecordById(paymentId) {
  const id = String(paymentId || "");
  if (!id) return null;
  return readPaymentRecords().find((p) => p.paymentId === id) || null;
}

function readRunRecords() {
  return readList(runsKey).filter(Boolean).map((r) => {
    const events = Array.isArray(r.events) ? r.events : [];
    return {
      runId: String(r.runId || r.id || ""),
      paymentId: String(r.paymentId || ""),
      wallet: String(r.wallet || ""),
      email: String(r.email || ""),
      tier: String(r.tier || ""),
      tokenId: String(r.tokenId || r.unlockToken || ""),
      status: normalizeRunStatus(r.status),
      startedAt: r.startedAt ? Number(r.startedAt) : null,
      endedAt: r.endedAt ? Number(r.endedAt) : null,
      resumedAt: r.resumedAt ? Number(r.resumedAt) : null,
      failReason: r.failReason ? String(r.failReason) : "",
      finalScore: r.finalScore ?? null,
      finalProgress: r.finalProgress ?? null,
      finalStep: r.finalStep ?? null,
      finalMultiplier: r.finalMultiplier ?? null,
      finalState: r.finalState ?? null,
      durationMs: Number(r.durationMs || 0),
      resetRequired: !!r.resetRequired,
      restartPaymentId: String(r.restartPaymentId || ""),
      claimId: String(r.claimId || ""),
      adminNotes: String(r.adminNotes || ""),
      adminGranted: !!r.adminGranted,
      createdAt: Number(r.createdAt || Date.now()),
      events: events.map((e) => ({ ...e, ts: Number(e?.ts || Date.now()) })),
    };
  }).filter((r) => !!r.runId);
}

function writeRunRecords(list) {
  writeList(runsKey, list || []);
}

function appendRunEvent(run, event) {
  if (!run) return;
  if (!Array.isArray(run.events)) run.events = [];
  run.events.push({ ts: Date.now(), ...event });
}

function runHasEvent(run, type, matcher = null) {
  const list = Array.isArray(run?.events) ? run.events : [];
  return list.some((evt) => {
    if (String(evt?.type || "") !== String(type || "")) return false;
    return typeof matcher === "function" ? !!matcher(evt) : true;
  });
}

function getRunById(runId) {
  const id = String(runId || "");
  if (!id) return null;
  return readRunRecords().find((r) => r.runId === id) || null;
}

function getRunByPaymentId(paymentId) {
  const id = String(paymentId || "");
  if (!id) return null;
  return readRunRecords().find((r) => r.paymentId === id) || null;
}

function createRunFromPayment(paymentPayload = {}, opts = {}) {
  const payment = upsertPaymentRecord(paymentPayload);
  if (!payment) return null;

  const list = readRunRecords();
  let run = list.find((r) => r.paymentId === payment.paymentId);
  if (!run) {
    run = {
      runId: newRunId(),
      paymentId: payment.paymentId,
      wallet: payment.wallet || auditWallet(),
      email: payment.email || auditEmail(),
      tier: payment.tier || String(opts.tier || ""),
      tokenId: String(opts.tokenId || ""),
      status: payment.status === "paid" ? "ready" : "created",
      startedAt: null,
      endedAt: null,
      resumedAt: null,
      failReason: "",
      finalScore: null,
      finalProgress: null,
      finalStep: null,
      finalMultiplier: null,
      finalState: null,
      durationMs: 0,
      resetRequired: false,
      restartPaymentId: "",
      claimId: "",
      adminNotes: "",
      adminGranted: !!opts.adminGranted,
      createdAt: Date.now(),
      events: [],
    };
    list.unshift(run);
  }

  run.wallet = run.wallet || payment.wallet || auditWallet();
  run.email = run.email || payment.email || auditEmail();
  run.tier = run.tier || payment.tier || String(opts.tier || "");
  if (opts.tokenId) run.tokenId = String(opts.tokenId);
  if (opts.adminGranted) run.adminGranted = true;
  if (payment.status === "paid" && run.status === "created") run.status = "ready";

  if (
    payment.status === "paid" &&
    !runHasEvent(run, "payment_confirmed", (evt) => String(evt?.paymentId || "") === payment.paymentId)
  ) {
    appendRunEvent(run, { type: "payment_confirmed", paymentId: payment.paymentId });
  }
  if (
    run.tokenId &&
    !runHasEvent(run, "token_granted", (evt) => String(evt?.tokenId || "") === String(run.tokenId))
  ) {
    appendRunEvent(run, { type: "token_granted", tokenId: run.tokenId, paymentId: payment.paymentId });
  }

  if (String(opts.intent || "").toLowerCase() === "restart") {
    const explicitFailedRunId = String(opts.failedRunId || localStorage.getItem(RESTART_FAILED_RUN_ID_KEY) || "");
    if (explicitFailedRunId) {
      const failedRun = list.find((x) => x.runId === explicitFailedRunId && x.status === "failed");
      if (failedRun) {
        failedRun.restartPaymentId = payment.paymentId;
      }
    }
  }

  writeRunRecords(list);
  return run;
}

function markRunStarted({ tier, paymentId } = {}) {
  const list = readRunRecords();
  const isStartableStatus = (r) => ["ready", "active", "resumed"].includes(String(r?.status || "").toLowerCase());
  const byPayment = paymentId ? list.find((r) => r.paymentId === String(paymentId)) : null;
  const byLocalRunId = list.find((r) => r.runId === String(localStorage.getItem(RUN_ID_KEY) || ""));
  const byTier = list
    .filter((r) => r.tier === String(tier || "") && isStartableStatus(r) && !r.claimId)
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0] || null;
  const run = [byPayment, byLocalRunId, byTier].find((r) => r && isStartableStatus(r)) || null;
  if (!run) return null;
  const status = String(run.status || "").toLowerCase();

  if (status === "ready") {
    run.status = "active";
    if (!run.startedAt) run.startedAt = Date.now();
    appendRunEvent(run, { type: "challenge_started" });
  } else {
    run.status = "resumed";
    if (!run.startedAt) run.startedAt = Date.now();
    run.resumedAt = Date.now();
    appendRunEvent(run, { type: "challenge_resumed" });
  }
  run.endedAt = null;
  run.resetRequired = false;
  run.failReason = "";

  writeRunRecords(list);
  return run;
}

function markRunResumed(runId) {
  const id = String(runId || "");
  if (!id) return null;
  const list = readRunRecords();
  const run = list.find((r) => r.runId === id);
  if (!run) return null;
  if (!run.startedAt) return markRunStarted({ tier: run.tier, paymentId: run.paymentId });
  if (run.status === "won" || run.status === "failed" || run.status === "claimed" || run.status === "paid" || run.status === "void") {
    return run;
  }
  run.status = "resumed";
  run.resumedAt = Date.now();
  appendRunEvent(run, { type: "challenge_resumed" });
  writeRunRecords(list);
  return run;
}

function markRunFailed(reason = "") {
  const runId = String(localStorage.getItem(RUN_ID_KEY) || "");
  if (!runId) return null;
  const list = readRunRecords();
  const run = list.find((r) => r.runId === runId);
  if (!run) return null;

  run.status = "failed";
  run.failReason = String(reason || "");
  run.resetRequired = true;
  run.endedAt = Date.now();
  if (run.startedAt) run.durationMs = Math.max(0, run.endedAt - run.startedAt);
  appendRunEvent(run, { type: "challenge_failed", reason: run.failReason });
  writeRunRecords(list);
  finalizeActiveRunLocalState("failed", run.runId, run.endedAt);
  return run;
}

function markRunWon(summary = {}) {
  const runId = String(localStorage.getItem(RUN_ID_KEY) || "");
  if (!runId) return null;
  const list = readRunRecords();
  const run = list.find((r) => r.runId === runId);
  if (!run) return null;

  const payment = getPaymentRecordById(run.paymentId);
  const hasValidPayment = !!(payment && payment.status === "paid");
  const hasAdminGrant = !!run.adminGranted;
  if (!hasValidPayment && !hasAdminGrant) {
    run.status = "void";
    run.endedAt = Date.now();
    if (run.startedAt) run.durationMs = Math.max(0, run.endedAt - run.startedAt);
    run.adminNotes = "Auto-voided: missing paid payment link for win.";
    appendRunEvent(run, { type: "challenge_won_blocked", reason: "missing_paid_payment_link" });
    writeRunRecords(list);
    finalizeActiveRunLocalState("void", run.runId, run.endedAt);
    return null;
  }

  run.status = "won";
  run.endedAt = Date.now();
  if (run.startedAt) run.durationMs = Math.max(0, run.endedAt - run.startedAt);
  run.finalScore = summary.finalScore ?? summary.achieved ?? null;
  run.finalProgress = summary.finalProgress ?? null;
  run.finalStep = summary.finalStep ?? null;
  run.finalMultiplier = summary.finalMultiplier ?? null;
  run.finalState = summary.finalState ?? null;
  appendRunEvent(run, { type: "challenge_won", summary: { ...summary } });
  writeRunRecords(list);
  finalizeActiveRunLocalState("won", run.runId, run.endedAt);
  return run;
}

function markRunClaimState(runId, status, extra = {}) {
  const id = String(runId || "");
  if (!id) return null;
  const list = readRunRecords();
  const run = list.find((r) => r.runId === id);
  if (!run) return null;

  if (status) run.status = normalizeRunStatus(status);
  if (extra.claimId) run.claimId = String(extra.claimId);
  if (extra.restartPaymentId) run.restartPaymentId = String(extra.restartPaymentId);
  if (extra.adminNotes) run.adminNotes = String(extra.adminNotes);

  if (extra.eventType) appendRunEvent(run, { type: extra.eventType, ...extra.eventPayload });
  writeRunRecords(list);
  if (["claimed", "paid", "void"].includes(String(run.status || "").toLowerCase())) {
    const endedAt = run.endedAt || Date.now();
    if (!run.endedAt) {
      run.endedAt = endedAt;
      writeRunRecords(list);
    }
    finalizeActiveRunLocalState(run.status, run.runId, endedAt);
  }
  return run;
}

function validateClaimAgainstRun(runId) {
  const id = String(runId || "");
  if (!id) return { ok: false, msg: "Missing runId." };
  const run = getRunById(id);
  if (!run) return { ok: false, msg: "Run not found." };
  if (run.status !== "won") return { ok: false, msg: "Run is not in won status." };

  const existing = readList(claimsKey).find((c) => String(c.runId || "") === id);
  if (existing || run.claimId) return { ok: false, msg: "A claim already exists for this run." };

  return { ok: true, run };
}

function createClaimForRun({ run, payout, amount }) {
  const check = validateClaimAgainstRun(run?.runId);
  if (!check.ok) return { ok: false, msg: check.msg };
  const claimId = newClaimId();

  const claim = {
    claimId,
    id: claimId,
    runId: run.runId,
    paymentId: run.paymentId || "",
    wallet: run.wallet || auditWallet(),
    email: payout?.email || run.email || auditEmail(),
    tier: run.tier || "",
    amount: Number(amount || 0),
    payout,
    address: payout?.address || "",
    asset: payout?.asset || "",
    chain: payout?.chain || "",
    status: "pending",
    submittedAt: Date.now(),
    reviewedAt: null,
    paidAt: null,
    txid: "",
    adminNotes: "",
    createdAt: Date.now(),
    supportId: run.paymentId || "—",
  };

  const list = readList(claimsKey);
  list.unshift(claim);
  writeList(claimsKey, list);

  const updatedRun = markRunClaimState(run.runId, "claimed", {
    claimId: claim.claimId,
    eventType: "claim_submitted",
    eventPayload: { claimId: claim.claimId },
  });

  if (claim.email) {
    localStorage.setItem(playerEmailKey, claim.email);
  }
  if (claim.wallet) {
    localStorage.setItem(playerWalletKey, claim.wallet);
  }

  return { ok: true, claim, run: updatedRun };
}

function getRunRecordForClaim(claim) {
  const runId = String(claim?.runId || "");
  if (!runId) return null;
  return getRunById(runId);
}

window.RISX_upsertPaymentRecord = upsertPaymentRecord;
window.RISX_createRunFromPayment = createRunFromPayment;

// Admin
let adminTab = "deposits";

function setAdminTab(tab){
  adminTab = tab;

  adminTabDeposits?.classList.toggle("active", tab==="deposits");
  adminTabWithdrawals?.classList.toggle("active", tab==="withdrawals");
  adminTabClaims?.classList.toggle("active", tab==="claims");   // ✅
  adminTabUsers?.classList.toggle("active", tab==="users");

  adminViewDeposits?.classList.toggle("hidden", tab!=="deposits");
  adminViewWithdrawals?.classList.toggle("hidden", tab!=="withdrawals");
  adminViewClaims?.classList.toggle("hidden", tab!=="claims");  // ✅
  adminViewUsers?.classList.toggle("hidden", tab!=="users");
}

function pctText(n){
  return `${Math.round((Number(n) || 0) * 100)}%`;
}

function renderChallengeParams(){
  const el = document.getElementById("challengeParams");
  if (!el) return;

  const tierKey = (challengeTierSelected || CHALLENGE.tier || "beginner");
  const t = CHALLENGE_TIERS[tierKey] || CHALLENGE_TIERS.beginner;

  const lockedLine = t.locked
    ? `<div class="param-h">Status: <b>LOCKED</b> — ${t.lockReason || "Invite Only"}</div>`
    : "";

  el.innerHTML = `
    <div class="param-card">
      <div class="param-k">Tier</div>
      <div class="param-v">${tierKey.toUpperCase()}</div>
      <div class="param-h">Entry: $${t.entryUsd} • Restart: $${t.restartUsd} • Prize: $${t.prizeUsd}</div>
      ${lockedLine}
    </div>

    <div class="param-card">
      <div class="param-k">Run</div>
      <div class="param-v">${t.startCredits} → ${t.goalCredits}</div>
      <div class="param-h">Start credits → Goal credits</div>
    </div>

    <div class="param-card">
      <div class="param-k">Max Bet Caps</div>
      <div class="param-v">Mines: ${pctText(t.minesMaxBetPct)} • Crash: ${pctText(t.crashMaxBetPct)}</div>
      <div class="param-h">Plinko: ${pctText(t.plinkoMaxBetPct)} of balance</div>
    </div>

    <div class="param-card">
      <div class="param-k">Mines Rules</div>
      <div class="param-v">Min mines: ${t.minesMin}+</div>
      <div class="param-h">Cashout cap: ${t.minesMaxCashoutMult}x</div>
    </div>

    <div class="param-card">
      <div class="param-k">Plinko</div>
      <div class="param-v">Max: ${t.plinkoMaxMult}x</div>
      <div class="param-h">Tier-dependent payout ceiling</div>
    </div>

    <div class="param-card">
      <div class="param-k">Mercy Mode</div>
      <div class="param-v">All-in at ≤ ${Number(t.mercyAllInAt || 0)}</div>
      <div class="param-h">When balance drops below this line, MAX becomes full balance.</div>
    </div>
  `;
}

function renderAdminList(list, kind){
  if (!list.length) return `<div class="redeem-empty">Nothing here.</div>`;
  return list.map(r => `
    <div class="admin-row">
      <div class="admin-col">
        <div class="admin-title">${escapeHtml(r.wallet)}</div>
        <div class="admin-sub">${kind} • ${Number(r.amount).toFixed(2)} ${escapeHtml(r.currency)}</div>
        <div class="admin-sub">${new Date(r.createdAt).toLocaleString()}</div>
      </div>
      <div class="admin-actions">
        <button class="btn small primary" data-admin-paid="${escapeHtml(r.id)}" data-kind="${kind}">PAID</button>
        <button class="btn small secondary" data-admin-void="${escapeHtml(r.id)}" data-kind="${kind}">VOID</button>
      </div>
    </div>
  `).join("");
}

function renderClaimsList(list){
  if (!list.length) return `<div class="redeem-empty">No claims yet.</div>`;

  return list.map(c => `
    <div class="admin-row">
      <div class="admin-col">
        <div class="admin-title">
          ${escapeHtml(c.tier || "—")} • $${Number(c.amount || c.prizeUsd || 0).toFixed(2)}
          <span style="opacity:.7; font-size:12px; margin-left:8px;">(${escapeHtml(c.status || "pending")})</span>
          ${!c.runId ? `<span style="opacity:.7; font-size:11px; margin-left:6px;">legacy</span>` : ""}
        </div>
        <div class="admin-sub">ClaimID: ${escapeHtml(c.claimId || c.id || "—")} • Run: ${escapeHtml(c.runId || "—")} • PaymentID: ${escapeHtml(c.paymentId || c.supportId || "—")}</div>
        <div class="admin-sub">Wallet: ${escapeHtml(c.wallet || "—")} ${(c.email ? `• Email: ${escapeHtml(c.email)}` : "")}</div>
        <div class="admin-sub">Submitted: ${new Date(c.submittedAt || c.createdAt || Date.now()).toLocaleString()}</div>
        <div class="admin-sub">To: <b>${escapeHtml(c.payout?.address || c.address || "")}</b></div>
        <div class="admin-sub">Asset/Chain: ${escapeHtml(c.payout?.asset || c.asset || "—")} • ${escapeHtml(c.payout?.chain || c.chain || "—")}</div>
        ${c.txid ? `<div class="admin-sub">Tx: ${escapeHtml(c.txid)}</div>` : ""}
        ${(c.adminNotes || c.note) ? `<div class="admin-sub">Admin Notes: ${escapeHtml(c.adminNotes || c.note)}</div>` : ""}
      </div>

      <div class="admin-actions">
        ${normalizeClaimStatus(c.status) === "pending" ? `
          <button class="btn small primary" data-claim-mark="${escapeHtml(c.claimId || c.id)}" data-claim-status="approved">APPROVE</button>
          <button class="btn small secondary" data-claim-mark="${escapeHtml(c.claimId || c.id)}" data-claim-status="void">VOID</button>
        ` : ""}
        ${normalizeClaimStatus(c.status) === "approved" ? `
          <button class="btn small primary" data-claim-mark="${escapeHtml(c.claimId || c.id)}" data-claim-status="paid">PAID</button>
          <button class="btn small secondary" data-claim-mark="${escapeHtml(c.claimId || c.id)}" data-claim-status="void">VOID</button>
        ` : ""}
      </div>
    </div>
  `).join("");
}

function formatDurationMs(startAt, endAt) {
  const start = Number(startAt || 0);
  const end = Number(endAt || 0);
  if (!start || !end || end <= start) return "—";
  const ms = end - start;
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${String(remSec).padStart(2, "0")}s`;
}

function renderRunEvents(events) {
  const list = Array.isArray(events) ? events : [];
  if (!list.length) return `<div class="admin-sub">No events.</div>`;
  return list.map((e) => `
    <div class="admin-sub">
      ${new Date(Number(e.ts || Date.now())).toLocaleString()} • <b>${escapeHtml(e.type || "event")}</b>
      ${escapeHtml(JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => k !== "type" && k !== "ts"))))}
    </div>
  `).join("");
}

function renderRunsList(list) {
  if (!list.length) return `<div class="redeem-empty">No challenge runs yet.</div>`;
  return list.map((r) => `
    <div class="admin-row">
      <div class="admin-col">
        <div class="admin-title">
          ${escapeHtml(r.runId)} • ${escapeHtml(r.status)}
          <span style="opacity:.7; font-size:12px; margin-left:8px;">tier:${escapeHtml(r.tier || "—")}</span>
        </div>
        <div class="admin-sub">PaymentID: ${escapeHtml(r.paymentId || "—")} • Claim: ${escapeHtml(r.claimId || "—")}</div>
        <div class="admin-sub">Wallet: ${escapeHtml(r.wallet || "—")} ${(r.email ? `• Email: ${escapeHtml(r.email)}` : "")}</div>
        <div class="admin-sub">Started: ${r.startedAt ? new Date(r.startedAt).toLocaleString() : "—"} • Ended: ${r.endedAt ? new Date(r.endedAt).toLocaleString() : "—"} • Duration: ${formatDurationMs(r.startedAt, r.endedAt)}</div>
        <div class="admin-sub">Result: score=${escapeHtml(r.finalScore ?? "—")} progress=${escapeHtml(r.finalProgress ?? "—")} step=${escapeHtml(r.finalStep ?? "—")} mult=${escapeHtml(r.finalMultiplier ?? "—")} state=${escapeHtml(r.finalState ?? "—")}</div>
        <div class="admin-sub">Reset Required: ${r.resetRequired ? "yes" : "no"} ${r.restartPaymentId ? `• RestartPaymentID: ${escapeHtml(r.restartPaymentId)}` : ""}</div>
        ${(r.failReason) ? `<div class="admin-sub">Fail Reason: ${escapeHtml(r.failReason)}</div>` : ""}
        <details style="margin-top:6px;">
          <summary class="admin-sub" style="cursor:pointer;">Run timeline</summary>
          ${renderRunEvents(r.events)}
        </details>
      </div>
    </div>
  `).join("");
}

function statusFilterMatch(record, kind, filterValue) {
  const f = String(filterValue || "all").toLowerCase();
  if (f === "all") return true;

  const status = String(record?.status || "").toLowerCase();
  if (f === "pending_review") {
    if (kind === "claims") return status === "pending";
    if (kind === "runs") return ["created", "ready", "active", "resumed"].includes(status);
    return status === "pending";
  }
  if (f === "active") return kind === "runs" && ["active", "resumed"].includes(status);
  if (f === "failed") return kind === "runs" && status === "failed";
  if (f === "won") return kind === "runs" && status === "won";
  if (f === "claimed") return kind === "runs" && status === "claimed";
  if (f === "paid") return status === "paid";
  if (f === "void") return status === "void";
  return status === f;
}

async function adminMark(id, kind, status) {
  if (!(await requireAdminSession())) return;
  const markRes = await apiJson("/api/admin/requests/mark", {
    method: "POST",
    body: JSON.stringify({ id, kind, status }),
  });
  if (!markRes.ok) {
    adminMsg && (adminMsg.textContent = String(markRes.data?.error || "Admin action rejected."));
    return;
  }

  const key = (kind === "deposit") ? depositsKey : withdrawalsKey;
  const list = readList(key);
  const idx = list.findIndex(x => String(x.id) === String(id));
  if (idx < 0) return;

  const prev = String(list[idx].status || "");

  // already finalized? bail
  if (prev === "PAID" || prev === "VOID") return;

  // set + persist status first
  list[idx].status = status;
  writeList(key, list);

  // ✅ APPLY BALANCE EFFECTS FIRST (so UI always updates)
  if (status === "PAID") {
    const r = list[idx];
    const amt = Number(r.amount || 0);

    if (Number.isFinite(amt) && amt > 0) {
      if (kind === "withdraw") {
        adminAdjustBalance(r.wallet, -amt);
      } else {
        adminAdjustBalance(r.wallet, +amt);
      }
    }
  }

  // ✅ BACKEND/OUTBOX SEAM SHOULD NEVER BLOCK THE UI
  try {
    submitRequest?.(
      "admin_mark",
      { id, kind, status, wallet: list[idx].wallet, amount: list[idx].amount, currency: list[idx].currency },
      null
    );
  } catch (e) {}

  renderAdmin?.();
}

// ----- Admin: apply balance changes ONLY when marking PAID -----
function adminAdjustBalance(wallet, delta) {
  const st = loadWalletState(wallet) || { balance: 0, currency: "USDT" };
  st.balance = clamp2(Math.max(0, Number(st.balance || 0) + Number(delta || 0)));
  saveWalletState(wallet, st);

  if (wallet === currentWallet) {
    balance = st.balance;
    selectedCurrency = st.currency;
    updateBalanceDisplay?.();
    persistActiveWalletState(); // <-- this persists current wallet too
  }
}

// main admin renderer
function renderAdmin() {
  if (!adminViewDeposits || !adminViewWithdrawals || !adminViewUsers) return;

  const q = (adminSearch?.value || "").trim().toLowerCase();
  const pendingOnly = !!adminPendingOnly?.checked;
  const statusFilter = String(adminStatusFilter?.value || "all");

  const claims = readList(claimsKey).map((c) => ({
    ...c,
    claimId: String(c.claimId || c.id || ""),
    runId: String(c.runId || ""),
    paymentId: String(c.paymentId || c.supportId || ""),
    status: normalizeClaimStatus(c.status),
  }));
  const deposits = readList(depositsKey);
  const withdrawals = readList(withdrawalsKey);
  const runs = readRunRecords();
  const payments = readPaymentRecords();

  // counts
  adminCountClaims && (adminCountClaims.textContent = String(claims.filter(c => c.status === "pending").length));
  adminCountDeposits && (adminCountDeposits.textContent = String(deposits.filter(d => String(d.status || "").toUpperCase() === "PENDING").length));
  adminCountWithdrawals && (adminCountWithdrawals.textContent = String(withdrawals.filter(d => String(d.status || "").toUpperCase() === "PENDING").length));
  if (adminCountUsers) {
    adminCountUsers.textContent = String(runs.length);
  }

  if (adminTab === "deposits") {
    const list = deposits
      .map((r) => ({ ...r, status: String(r.status || "").toLowerCase() }))
      .filter(r => !pendingOnly || r.status === "pending")
      .filter(r => statusFilterMatch(r, "deposits", statusFilter))
      .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    adminViewDeposits.innerHTML = renderAdminList(list, "deposit");
  } else if (adminTab === "claims") {
  const list = claims
    .filter(r => !pendingOnly || r.status === "pending")
    .filter(r => statusFilterMatch(r, "claims", statusFilter))
    .filter(r => !q || `${JSON.stringify(r).toLowerCase()} ${String(r.paymentId || "")} ${String(r.runId || "")} ${String(r.claimId || "")}`.includes(q));
  adminViewClaims.innerHTML = renderClaimsList(list);
  } else if (adminTab === "withdrawals") {
    const list = withdrawals
      .map((r) => ({ ...r, status: String(r.status || "").toLowerCase() }))
      .filter(r => !pendingOnly || r.status === "pending")
      .filter(r => statusFilterMatch(r, "withdrawals", statusFilter))
      .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    adminViewWithdrawals.innerHTML = renderAdminList(list, "withdraw");
  } else {
    const list = runs
      .filter(r => !pendingOnly || ["created", "ready", "active", "resumed"].includes(String(r.status || "").toLowerCase()))
      .filter(r => statusFilterMatch(r, "runs", statusFilter))
      .filter(r => {
        if (!q) return true;
        const linkedClaim = claims.find((c) => String(c.runId || "") === String(r.runId || ""));
        const payment = payments.find((p) => String(p.paymentId || "") === String(r.paymentId || ""));
        const blob = [
          r.runId, r.paymentId, r.wallet, r.email, r.tier, r.status, r.claimId,
          linkedClaim?.claimId, linkedClaim?.paymentId, linkedClaim?.wallet, linkedClaim?.email,
          payment?.paymentId, payment?.wallet, payment?.email
        ].join(" ").toLowerCase();
        return blob.includes(q);
      });
    adminViewUsers.innerHTML = renderRunsList(list);
  }

  adminMsg && (adminMsg.textContent = "");
}

// delegate PAID/VOID clicks inside admin modal
function bindAdminModalClicks() {
  adminModal?.addEventListener("click", (e) => {
    // deposits / withdrawals
    const paid = e.target.closest("[data-admin-paid]");
    const voidBtn = e.target.closest("[data-admin-void]");
    if (paid) return void adminMark(paid.getAttribute("data-admin-paid"), paid.getAttribute("data-kind"), "PAID");
    if (voidBtn) return void adminMark(voidBtn.getAttribute("data-admin-void"), voidBtn.getAttribute("data-kind"), "VOID");

    // ✅ claims
    const claimBtn = e.target.closest("[data-claim-mark]");
    if (claimBtn) {
      const id = claimBtn.getAttribute("data-claim-mark");
      const status = claimBtn.getAttribute("data-claim-status");
      return void adminMarkClaim(id, status);
    }
  });
}

async function adminMarkClaim(id, status) {
  if (!(await requireAdminSession())) return;

  const list = readList(claimsKey);
  const idx = list.findIndex(x => String(x.claimId || x.id) === String(id));
  if (idx < 0) return;

  const claim = list[idx];
  claim.claimId = String(claim.claimId || claim.id || id);
  claim.id = claim.claimId;
  claim.status = normalizeClaimStatus(claim.status);

  const nextStatus = normalizeClaimStatus(status);
  if (["paid", "void"].includes(claim.status)) return;

  if ((nextStatus === "approved" || nextStatus === "paid")) {
    const run = getRunRecordForClaim(claim);
    if (!run || run.runId !== String(claim.runId || "")) {
      adminMsg && (adminMsg.textContent = "Claim cannot be approved/paid without a valid linked runId.");
      return;
    }
  }

  if (nextStatus === "paid") {
    const { confirmed, value } = await risxInputPrompt({
      title: "Payout Reference",
      description: "Optional: add txid or payout reference before marking claim as paid.",
      label: "TxID / Reference",
      value: claim.txid || "",
      placeholder: "Optional",
      confirmText: "Save + Mark Paid",
      cancelText: "Cancel",
      required: false,
    });
    if (!confirmed) return;
    if (value) claim.txid = value.trim();
    claim.paidAt = Date.now();
  }

  if (nextStatus === "paid" || nextStatus === "void") {
    const markRes = await apiJson("/api/admin/claims/markPaid", {
      method: "POST",
      body: JSON.stringify({ claimId: claim.claimId, status: nextStatus.toUpperCase(), txid: claim.txid || "" }),
    });
    if (!markRes.ok) {
      adminMsg && (adminMsg.textContent = String(markRes.data?.error || "Claim update rejected."));
      return;
    }
  }

  if (nextStatus === "approved") claim.reviewedAt = Date.now();
  if (nextStatus === "void") claim.reviewedAt = Date.now();
  if (nextStatus === "void") claim.voidAt = Date.now();

  claim.status = nextStatus;
  writeList(claimsKey, list);

  const runId = String(claim.runId || "");
  if (runId) {
    if (nextStatus === "paid") {
      markRunClaimState(runId, "paid", {
        eventType: "claim_paid",
        eventPayload: { claimId: claim.claimId, txid: claim.txid || "" },
      });
    } else if (nextStatus === "void") {
      markRunClaimState(runId, "void", {
        eventType: "claim_void",
        eventPayload: { claimId: claim.claimId },
      });
    } else if (nextStatus === "approved") {
      markRunClaimState(runId, "claimed", {
        eventType: "claim_approved",
        eventPayload: { claimId: claim.claimId },
      });
    }
  }

  renderAdmin?.();
}

// =========================
// TABS
// =========================

function anyRoundActive() {
  const minesActive = !!gameActive;
  const crashActive = !!crashRoundActive;
  const plinkoActive = typeof plinkoBallsInFlight === "number" && plinkoBallsInFlight > 0;
  return minesActive || crashActive || plinkoActive;
}

function setupTabs() {
  if (setupTabs._didBind) return;
  setupTabs._didBind = true;

  const tabButtons = document.querySelectorAll(".game-tab");
  const gameSections = document.querySelectorAll(".game-section");

  function show(target) {
    // 1) Find section first (BEFORE we remove actives)
    const targetSection = document.getElementById(`game-${target}`);

    if (!targetSection) {
      // Fallback to mines so you never go blank
      return show("mines");
    }

    // 2) Toggle tab active state
    tabButtons.forEach(b => b.classList.toggle("active", b.dataset.target === target));

    // 3) Toggle section active state
    gameSections.forEach(section => section.classList.remove("active"));
    targetSection.classList.add("active");

    setDefaultBetsIfEmpty();

    // 4) Optional: per-game renders (wrapped so errors won't blank UI)
    try {
      if (target === "plinko") {
        requestAnimationFrame(() => {
          try {
          if (plinkoBallsInFlight > 0) {
            window.__plinkoNeedsRelayout = true;
            return;
          }
          renderPlinkoBoard();
          renderPlinkoBuckets();
          } catch (e) {
            console.error("[RISX] Plinko render error:", e);
          }
        });
      }
      if (target === "crash") {
        // if you have any crash render/init calls, put them here
        // iniCrash(); renderCrashHistory();
      }
      if (target === "mines") {
        // if mines ever needs rebuild:
        // buildMinesGrid();
      }
    } catch (e) {
      console.error(`[RISX] Error switching to ${target}:`, e);
      // fallback to mines instead of staying blank
      return show("mines");
    }
  }

 tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.classList.contains("disabled")) return;

    // ✅ BLOCK TAB SWITCH DURING ACTIVE ROUND
    if (anyRoundActive()) {
      toast?.("Finish the current round before switching games.");
      return;
    }

    const target = btn.dataset.target;
    if (!target) return;
    show(target);
  });
});

  // Ensure something is visible on load
  const activeBtn = document.querySelector(".game-tab.active");
  show(activeBtn?.dataset.target || "mines");
}

// ==============================================
//===============================================
//                    INIT
//===============================================
// ==============================================

function initCrash() {
  if (crashBigMultEl) crashBigMultEl.textContent = "1.00x";

  if (crashStatusMessage) {
    crashStatusMessage.textContent = "Place a bet and start a Crash round.";
  }

  if (crashCashOutBtn) crashCashOutBtn.disabled = true;

  // Ensure curve line exists
  let curveContainer = crashGraphInner?.querySelector(".crash-curve");
  if (!curveContainer && crashGraphInner) {
    curveContainer = document.createElement("div");
    curveContainer.className = "crash-curve";
    const line = document.createElement("div");
    line.className = "crash-curve-line";
    curveContainer.appendChild(line);
    crashGraphInner.appendChild(curveContainer);
    crashCurveLine = line;
  } else if (curveContainer) {
    crashCurveLine = curveContainer.querySelector(".crash-curve-line");
  }

  // Put the toast inside the graph so it overlays nicely
  if (crashStatusMessage && crashGraphInner && crashStatusMessage.parentElement !== crashGraphInner) {
  crashGraphInner.appendChild(crashStatusMessage);
  crashStatusMessage.classList.add("crash-toast");
  }

  // Reset visuals
  if (crashCurveLine) crashCurveLine.style.transform = "scaleX(0)";
  if (rocketTrailEl) rocketTrailEl.style.width = "0";
  syncCrashMultToRocket();
}

function initProvablyFair() {
  // Ensure seeds exist
  if (!serverSeed || serverSeed === "CHANGE_ME_TO_RANDOM_LONG_SECRET") {
    serverSeed = randomSeed(40);
  }
  if (!clientSeed) clientSeed = "Guest";

  if (initProvablyFair._didBind) return;
  initProvablyFair._didBind = true;


  // Bind UI
  pfClientSeedInput?.addEventListener("input", () => {
    clientSeed = pfClientSeedInput.value || "";
    updatePfUI();
  });

  pfNewClientSeedBtn?.addEventListener("click", pfNewClientSeed);
  pfResetNonceBtn?.addEventListener("click", pfResetNonce);
  pfRevealBtn?.addEventListener("click", pfRevealServerSeed);
  pfRotateBtn?.addEventListener("click", pfRotateServerSeed);
  pfVerifyBtn?.addEventListener("click", pfVerifyLast);

  // Initial render
  updatePfCommitUI();
  updatePfUI();
}

function initPlinko() {
  // These can run every time (safe)
  renderPlinkoBoard();
  renderPlinkoBuckets();
  attachPlinkoResizeObserver();

  // Bind events only once (prevents duplicates)
  if (initPlinko._didBind) return;
  initPlinko._didBind = true;

  plinkoRiskEl?.addEventListener("change", renderPlinkoBuckets);
  if (plinkoDropBtn) plinkoDropBtn.onclick = (e) => dropPlinkoBall(e);
}

function init() {
  if (init._didBind) return;
  init._didBind = true;

  failModal = document.getElementById("failModal");
  const failCloseBtn = document.getElementById("failCloseBtn");

  failCloseBtn?.addEventListener("click", () => {
  // Clear any active run state so they don't come back stuck
  try {
    saveChallengeActive(false);
    CHALLENGE.active = false;
    challengeActive = false;
    clearRun?.();
  } catch {}

  // Go back to the beginning (tier modal will open on load if you coded that)
  window.location.href = "challenge.html";
});

  // ---- restore challenge state FIRST ----
  loadChallengeState(); 

  let status = getChallengeStatus();
  if (status === "completed") {
    status = "won";
    setChallengeStatus("won");
  }

  // If last run ended, do NOT auto-resume.
  if (status === "failed" || status === "won") {
  challengeActive = false;
  CHALLENGE.active = false;
  saveChallengeActive(false);
  clearRun();
  }

  if (challengeActive) {
  // already in a live challenge
  const existingRunId = String(localStorage.getItem(RUN_ID_KEY) || "");
  const resumed = existingRunId ? markRunResumed?.(existingRunId) : null;
  if (!existingRunId || !resumed?.runId) {
    challengeActive = false;
    CHALLENGE.active = false;
    saveChallengeActive(false);
    clearRun();
    lockAppUI(true);
    openModal(challengeModal);
    renderTierSummary?.();
  } else {
    localStorage.setItem(RUN_ID_KEY, String(resumed.runId));
    localStorage.setItem(RUN_TIER_KEY, String(resumed.tier || challengeTierSelected || "beginner"));
    localStorage.setItem(RUN_STATUS_KEY, String(resumed.status || "resumed"));
    localStorage.setItem(RUN_START_KEY, String(resumed.startedAt || Date.now()));
    localStorage.removeItem(RUN_END_KEY);
    setActiveWallet(CHALLENGE_WALLET_ID);
    setChallengeWalletUI?.();
    lockAppUI(false);
    closeModal(challengeModal);
  }
} else {
  const paymentRecovery = getPaymentSessionState();
  const claimRecovery = getClaimRecoveryState();
  const hasRecoveryCta =
    !!localStorage.getItem("risx_unlock_token") ||
    paymentRecovery?.status === "paid" ||
    paymentRecovery?.status === "pending" ||
    (claimRecovery && (claimRecovery.status === "available" || claimRecovery.status === "started"));

  // no live challenge → lock controls; only force tier modal when no recoverable flow exists
  lockAppUI(true);
  if (hasRecoveryCta) {
    closeModal(challengeModal);
  } else {
    openModal(challengeModal);
  }
  renderTierSummary?.();
}

  challengeTierSelected = challengeTier?.value || "beginner";
  CHALLENGE.tier = challengeTierSelected;
  renderTierSummary();

  // ---------- basic UI boot ----------
  bindAdminModalClicks?.();

  updateBalanceDisplay?.();
  updateMinesInfoPanel?.(1.0, 0);

  buildMinesGrid?.();
  renderCrashHistory?.();

  restoreSessionStats?.();
  updateSessionStats?.();
  startSessionTimer?.();
  updateSessionTimer?.();

  // =============================
  // WALLET BOOT (v2)
  // =============================
  if (!challengeActive) {
    const bootWallet = localStorage.getItem(WALLET_KEY) || "";
    if (bootWallet) {
      setActiveWallet(bootWallet);
    } else {
      if (currentWalletEl) currentWalletEl.textContent = "—";
    }
  }

  // =============================
  // BUTTON WIRING (REAL FLOW)
  // =============================

  // Connect wallet (identity only)
  connectWalletBtn?.addEventListener("click", async () => {
  if (CHALLENGE?.enabled && challengeActive) {
    toast?.("Challenge mode uses internal credits. Wallet connect is disabled.");
    return;
  }
  const { confirmed, value } = await risxInputPrompt({
    title: "Connect Wallet",
    description: "Demo mode: enter a wallet identifier to continue.",
    label: "Wallet Address",
    value: currentWallet || "",
    placeholder: "Wallet address",
    confirmText: "Connect",
    required: true,
  });
  if (!confirmed || !value) return;
  setActiveWallet(value.trim());
});

  // Deposit modal open
  depositBtn?.addEventListener("click", () => {
    if (CHALLENGE?.enabled && challengeActive) {
      toast?.("Deposits are disabled in Challenge mode.");
      return;
    }
    if (!currentWallet) return toast?.("Connect wallet first.");
    if (depositCurrency) depositCurrency.value = selectedCurrency || depositCurrency.value || "USDT";
    refreshDepositAddress?.();
    if (depositMsg) depositMsg.textContent = "";
    openModal?.(depositModal);
  });

  // Deposit currency changes address + currency
  depositCurrency?.addEventListener("change", () => {
    selectedCurrency = depositCurrency.value || selectedCurrency || "USDT";
    refreshDepositAddress?.();
    persistActiveWalletState?.();
  });

  // Create deposit request (PENDING only)
 depositSubmitBtn?.addEventListener("click", () => {
  if (CHALLENGE?.enabled && challengeActive) {
    toast?.("Challenge mode uses internal credits. Wallet connect is disabled.");
    return;
  }
  if (!currentWallet) return toast?.("Connect wallet first.");

  const amt = Number(depositAmount?.value || 0);
  if (!Number.isFinite(amt) || amt <= 0) {
    if (depositMsg) depositMsg.textContent = "Enter a valid amount.";
    return;
  }

  submitDepositRequest(amt, depositAddress?.value || "");
  if (depositMsg) depositMsg.textContent = "Deposit request created (PENDING).";
  if (depositAmount) depositAmount.value = "";
  renderAdmin?.();
});

  // Copy deposit address
  copyDepositBtn?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(depositAddress?.value || "");
      if (depositMsg) depositMsg.textContent = "Copied.";
    } catch {
      if (depositMsg) depositMsg.textContent = "Copy failed.";
    }
  });

  // Withdraw modal open
  withdrawBtn?.addEventListener("click", () => {
    if (CHALLENGE?.enabled && challengeActive) {
    toast?.("Challenge mode uses internal credits. Wallet connect is disabled.");
    return;
  }
    if (!currentWallet) return toast?.("Connect wallet first.");
    if (withdrawMsg) withdrawMsg.textContent = "";
    renderWithdrawHistory?.();
    openModal?.(withdrawModal);
  });

  // Withdraw submit/clear
  withdrawSubmitBtn?.addEventListener("click", submitWithdrawRequest);
  withdrawClearBtn?.addEventListener("click", () => {
    const list = readList(withdrawalsKey).filter(r => r.wallet !== currentWallet);
    writeList(withdrawalsKey, list);
    renderWithdrawHistory?.();
  });

  document.querySelectorAll("[data-challenge-close]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (!challengeActive) {
      if (challengeMsg) challengeMsg.textContent = "Pick a tier to begin.";
      return;
    }
    closeModal(challengeModal);
  });
  });

  openChallengeBtn?.addEventListener("click", () => {
  openModal(challengeModal);
  if (challengeMsg) challengeMsg.textContent = "";
  renderTierSummary();
  });

  // Admin open
  adminBtn?.addEventListener("click", () => { void openAdminEntry(); });
  document.addEventListener("keydown", handleAdminComboHotkey);
  adminLoginForm?.addEventListener("submit", (e) => { void submitAdminLogin(e); });
  adminLogoutBtn?.addEventListener("click", () => { void logoutAdminSession(); });
  adminMintBtn?.addEventListener("click", () => { void mintAdminToken(); });
  adminKeyStatusBtn?.addEventListener("click", () => { void checkAdminStatus(); });
  adminRotateKeyBtn?.addEventListener("click", () => { void verifyAdminKeyRotation(); });

  // Session reset
  resetSessionBtn?.addEventListener("click", () => {
  resetSessionStats?.();
  updateSessionStats?.();
  toast?.("Session reset.");
  });

  // Admin tabs + filters
  adminTabDeposits?.addEventListener("click", () => { setAdminTab?.("deposits"); renderAdmin?.(); });
  adminTabWithdrawals?.addEventListener("click", () => { setAdminTab?.("withdrawals"); renderAdmin?.(); });
  adminTabUsers?.addEventListener("click", () => { setAdminTab?.("users"); renderAdmin?.(); });
  adminTabClaims?.addEventListener("click", () => { setAdminTab?.("claims"); renderAdmin?.(); });

  adminRefreshBtn?.addEventListener("click", renderAdmin);
  adminPendingOnly?.addEventListener("change", renderAdmin);
  adminStatusFilter?.addEventListener("change", renderAdmin);
  adminSearch?.addEventListener("input", debounce(renderAdmin, 150));

  // Modal close buttons
  document.querySelectorAll("[data-deposit-close]").forEach(btn =>
    btn.addEventListener("click", () => closeModal?.(depositModal))
  );
  document.querySelectorAll("[data-withdraw-close]").forEach(btn =>
    btn.addEventListener("click", () => closeModal?.(withdrawModal))
  );
  document.querySelectorAll("[data-admin-close]").forEach(btn =>
    btn.addEventListener("click", () => closeModal?.(adminModal))
  );
  document.querySelectorAll("[data-admin-login-close]").forEach(btn =>
    btn.addEventListener("click", () => closeModal?.(adminLoginModal))
  );

  // FOOTER LINKS //

document.querySelectorAll('[data-open]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-open');
    const m = document.getElementById(id);
    if (m) openModal(m);
  });
});

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-close');
    const m = document.getElementById(id);
    if (m) closeModal(m);
  });
});

document.getElementById("copySupportEmail")?.addEventListener("click", async () => {
  const email = document.getElementById("supportEmail")?.value || "";
  try { await navigator.clipboard.writeText(email); } catch {}
});

document.getElementById("supportSend")?.addEventListener("click", () => {
  const to = "risx.challenge@gmail.com";
  const userEmail = (document.getElementById("supportUserEmail")?.value || "").trim();
  const payId = (document.getElementById("supportPayId")?.value || "").trim();
  const msg = (document.getElementById("supportMsg")?.value || "").trim();

  if (!msg) {
    const el = document.getElementById("supportToast");
    if (el) el.textContent = "Please enter a message so we know what happened.";
    return;
  }

  const subject = encodeURIComponent(`RISX Support ${payId ? `— Payment/Game ID: ${payId}` : ""}`);
  const body = encodeURIComponent(
`Support Request

From: ${userEmail || "n/a"}
Payment/Game ID: ${payId || "n/a"}
Page: ${location.href}
Time: ${new Date().toISOString()}

Message:
${msg}
`
  );

  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
  const el = document.getElementById("supportToast");
  if (el) el.textContent = "Opening your email app…";
});

// =============================
// GAME WIRING
// =============================

async function hasValidUnlockForTier(tier) {
  const token = localStorage.getItem("risx_unlock_token");
  if (!token) return false;

  try {
    const r = await fetch("/api/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

  const j = await r.json().catch(() => ({}));
  const ok = !!(r.ok && j.valid && j.tierKey === tier);
  return ok;
  } catch {
    return false;
  }
}

challengeTier?.addEventListener("change", () => {
  challengeTierSelected = challengeTier.value;
  renderTierSummary(); // this already calls renderChallengeParams()
});

function consumeUnlockForStartedRun() {
  localStorage.removeItem("risx_unlock_token");
  localStorage.removeItem("risx_unlock_tier");
  localStorage.removeItem("risx_unlock_intent");
  localStorage.removeItem("risx_payment_intent");
  setPaymentSessionState(null);
}

function startChallengeNow(tier) {
  // set selected tier first (so getTier() always matches)
  challengeTierSelected = tier;
  CHALLENGE.tier = tier;

  const t = getTier();

  if (t.locked) {
    void risxAlert({
      title: "Tier Locked",
      body: "This tier is currently invite only.",
      okText: "Close",
    });
    return;
  }

  const runId = startRun(tier);
  if (!runId) {
    challengeActive = false;
    CHALLENGE.active = false;
    saveChallengeActive?.(false);
    lockAppUI?.(true);
    openModal?.(challengeModal);
    return;
  }

  challengeState.status = "active";
  CHALLENGE.active = true;
  challengeActive = true;

  saveChallengeState?.();
  setChallengeStatus("active");

  CHALLENGE.enabled = true;

  saveChallengeActive(true);
  challengeCompleted = false;

  setChallengeWalletUI();
  setActiveWallet(CHALLENGE_WALLET_ID);

  balance = Number(t.startCredits || 0);
  _lastBalanceForMercy = Number(balance || 0);
  _mercyOn = false;

  updateBalanceDisplay?.();
  persistActiveWalletState?.();
  saveChallengeCompleted(false);

  // Unlocks are one-use for starting a run; clear recovery once consumed.
  consumeUnlockForStartedRun();
  localStorage.removeItem("risx_restart_required");
  localStorage.removeItem("risx_reset_expires_at");
  localStorage.removeItem(RESTART_FAILED_RUN_ID_KEY);
  CHALLENGE.resetExpiresAt = null;

  showChallengeResetIfNeeded();
  setDefaultBetsIfEmpty();
  renderChallengeParams();

  if (challengeMsg) challengeMsg.textContent = `Challenge started: ${tier.toUpperCase()}`;

  refreshChallengeHud();
  closeModal(challengeModal);
  lockAppUI(false);
  renderRecoveryCtas?.();
}

  window.RISX_startChallengeFromPayment = async (tier) => {
  closeModal(challengeModal);

  const ok = await hasValidUnlockForTier(tier);
  if (ok) {
    startChallengeNow(tier);
    return;
  }

  // Restart payment is required only when no valid unlock exists yet.
  if (restartRequiredNow()) {
    localStorage.setItem("risx_payment_intent", "restart");
    window.RISX_openPayModalForTier?.(tier);
    return;
  }

  if (!ok) {
    localStorage.setItem("risx_payment_intent", "entry");
    window.RISX_openPayModalForTier?.(tier);
    return;
  }
};

  if (challengeStartBtn && !challengeStartBtn._bound) {
  challengeStartBtn._bound = true;
  
  challengeStartBtn?.addEventListener("click", async () => {
  const tier = challengeTier?.value || "beginner";

  const ok = await hasValidUnlockForTier(tier);
  if (ok) {
    startChallengeNow(tier);
    return;
  }

  // Restart payment is required only when no valid unlock exists yet.
  if (restartRequiredNow()) {
    closeModal(challengeModal);
    localStorage.setItem("risx_payment_intent", "restart");
    window.RISX_openPayModalForTier?.(tier);
    toast?.("Restart required — pay reset to start again.");
    return;
  }

  if (!ok) {
    closeModal(challengeModal);
    localStorage.setItem("risx_payment_intent", "entry");
    window.RISX_openPayModalForTier?.(tier);
    if (challengeMsg) {
      challengeMsg.textContent = `Tier locked: ${tier.toUpperCase()} — complete payment to unlock.`;
    }
    return;
  }

});
}

const resetBtn = document.getElementById("resetBtn");

if (resetBtn && !resetBtn._bound) {
  resetBtn._bound = true;

  resetBtn.addEventListener("click", () => {
  const tierKey = challengeTierSelected || CHALLENGE.tier || "beginner";
  const t = getTier();

  if (Date.now() > CHALLENGE.resetExpiresAt) {
    toast?.("Reset expired.");
    return;
  }

  localStorage.setItem("risx_payment_intent", "restart"); // ✅ first
  window.RISX_openPayModalForTier?.(tierKey);            // ✅ use tierKey
  });
}

function restartRequiredNow() {
  const required = localStorage.getItem("risx_restart_required") === "1";
  const expiresAt = Number(localStorage.getItem("risx_reset_expires_at") || CHALLENGE.resetExpiresAt || 0);
  const stillInWindow = expiresAt && Date.now() <= expiresAt;
  if (required && !stillInWindow) {
    localStorage.removeItem("risx_restart_required");
    localStorage.removeItem("risx_reset_expires_at");
    localStorage.removeItem(RESTART_FAILED_RUN_ID_KEY);
    CHALLENGE.resetExpiresAt = null;
    return false;
  }
  return required && stillInWindow;
}

function updateSupportIdPill(){
  const el = document.getElementById("supportIdPill");
  if (!el) return;
  const pid = localStorage.getItem("risx_last_payment_id") || "—";
  el.textContent = `ID: ${pid}`;
}
updateSupportIdPill();

function getLastSupportId(){
  // later you can expand to include a separate gameId if you add one
  return localStorage.getItem("risx_last_payment_id") || "—";
}

function refreshSupportModal(){
  const pid = getLastSupportId();
  const pidEl = document.getElementById("supportPaymentIdText");
  if (pidEl) pidEl.textContent = pid;

  const link = document.getElementById("emailSupportLink");
  if (link) {
    const to = "risx.challenge@gmail.com";
    const subject = encodeURIComponent(`RISX Support — ID: ${pid}`);
    const body = encodeURIComponent(
`Support Request

ID: ${pid}
Page: ${location.href}
Time: ${new Date().toISOString()}

Message:
${(document.getElementById("supportMsg")?.value || "").trim()}
`
    );
    link.href = `mailto:${to}?subject=${subject}&body=${body}`;
  }
}

// When opening support modal, populate ID + mailto
document.querySelector('[data-open="supportModal"]')?.addEventListener("click", () => {
  setTimeout(refreshSupportModal, 0);
});

document.getElementById("copySupportEmail")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("risx.challenge@gmail.com");
    const el = document.getElementById("supportToast");
    if (el) el.textContent = "Support email copied.";
  } catch {}
});

document.getElementById("copySupportId")?.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(getLastSupportId());
    const el = document.getElementById("supportToast");
    if (el) el.textContent = "ID copied.";
  } catch {}
});

  // Update mailto when they type
  document.getElementById("supportMsg")?.addEventListener("input", refreshSupportModal);

  // -----------------------------
  // Claim reward button
  // -----------------------------
  const submitClaimBtn = document.getElementById("submitClaimBtn");

  async function submitClaimFromRecovery({ closeWinModal = false } = {}) {
    const claimState = getClaimRecoveryState();
    if (!claimState || !["available", "started"].includes(claimState.status)) {
      await risxAlert({
        title: "Claim unavailable",
        body: "No active claim was found for this finalized run.",
        okText: "OK",
      });
      return;
    }

    const nextState = {
      ...claimState,
      status: "started",
      form: normalizeClaimForm(claimState.form),
    };
    setClaimRecoveryState(nextState);

    if (closeWinModal) {
      closeModal?.(document.getElementById("winModal"));
    }

    const payoutRes = await openPayoutDetailsModal({
      draft: nextState.form,
      onDraftChange: (form) => {
        const active = getClaimRecoveryState();
        if (!active || !["available", "started"].includes(active.status)) return;
        setClaimRecoveryState({
          ...active,
          status: "started",
          form: normalizeClaimForm(form),
        });
      },
    });
    if (!payoutRes.confirmed || !payoutRes.payout) return;

    const activeClaimState = getClaimRecoveryState();
    const runId = String(activeClaimState?.winId || activeClaimState?.sessionId || "");
    if (!activeClaimState || !runId) {
      await risxAlert({
        title: "Claim unavailable",
        body: "This claim is no longer attached to an eligible winning run.",
        okText: "OK",
      });
      return;
    }

    const valid = validateClaimAgainstRun(runId);
    if (!valid.ok || !valid.run) {
      await risxAlert({
        title: "Claim unavailable",
        body: valid.msg || "This run is not eligible for a claim.",
        okText: "OK",
      });
      return;
    }

    const payout = payoutRes.payout;
    const claimAmount = Number(
      activeClaimState.amount ||
      (CHALLENGE_TIERS[String(valid.run.tier || CHALLENGE.tier || "beginner")]?.prizeUsd || getTier()?.prizeUsd || 0)
    );
    const claimRes = createClaimForRun({
      run: valid.run,
      payout,
      amount: claimAmount,
    });
    if (!claimRes.ok) {
      await risxAlert({
        title: "Claim unavailable",
        body: claimRes.msg || "Failed to submit claim.",
        okText: "OK",
      });
      return;
    }

    if (claimRes.claim?.paymentId) {
      localStorage.setItem("risx_last_payment_id", String(claimRes.claim.paymentId));
      window.updateSupportIdPill?.();
    }

    setClaimRecoveryState({
      ...activeClaimState,
      status: "submitted",
      submittedAt: Date.now(),
      form: normalizeClaimForm({
        wallet: payout.address,
        crypto: payout.asset,
        chain: payout.chain,
        email: payout.email || "",
      }),
    });

    if (submitClaimBtn) {
      submitClaimBtn.disabled = true;
      submitClaimBtn.textContent = "Claim Submitted";
    }

    void risxAlert({
      title: "Claim Submitted",
      body: "Manual review + payout is typically completed within 24h.",
      okText: "Done",
    });
  }

  if (submitClaimBtn && !submitClaimBtn._bound) {
    submitClaimBtn._bound = true;
    submitClaimBtn.addEventListener("click", () => {
      void submitClaimFromRecovery({ closeWinModal: true });
    });
  }

  if (resumeClaimBtn && !resumeClaimBtn._bound) {
    resumeClaimBtn._bound = true;
    resumeClaimBtn.addEventListener("click", () => {
      void submitClaimFromRecovery({ closeWinModal: false });
    });
  }

  if (resumePaymentBtn && !resumePaymentBtn._bound) {
    resumePaymentBtn._bound = true;
    resumePaymentBtn.addEventListener("click", () => {
      const paymentSession = getPaymentSessionState();
      if (!paymentSession || paymentSession.status !== "pending") return;
      localStorage.setItem("risx_payment_intent", paymentSession.intent || "entry");
      window.RISX_openPayModalForTier?.(paymentSession.tier);
    });
  }

 if (startChallengeRecoveryBtn && !startChallengeRecoveryBtn._bound) {
  startChallengeRecoveryBtn._bound = true;
  startChallengeRecoveryBtn.addEventListener("click", async () => {
    startChallengeRecoveryBtn.disabled = true;
    try {
      await refreshPostPaymentRecovery();

      const tier = String(
        recoveryUnlockTier ||
        challengeTier?.value ||
        challengeTierSelected ||
        CHALLENGE.tier ||
        "beginner"
      );

      if (!tier) {
        toast?.("Unlock not ready yet. If you just paid, please wait for confirmation.");
        return;
      }

      const unlockOk = await hasValidUnlockForTier(tier);
      const restartNeeded = restartRequiredNow();

      if (challengeTier) challengeTier.value = tier;
      challengeTierSelected = tier;
      CHALLENGE.tier = tier;
      renderTierSummary?.();

      console.log("[RISX][RecoveryCTA] click", {
        tier,
        recoveryUnlockTier,
        recoveryUnlockIntent,
        unlockOk,
        restartNeeded,
        paymentIntent: localStorage.getItem("risx_payment_intent"),
      });

      // Real restart flow only if restart is actually required
      if (restartNeeded) {
        recoveryUnlockIntent = "restart";
        localStorage.setItem("risx_payment_intent", "restart");
        window.RISX_openPayModalForTier?.(tier);
        return;
      }

      // Valid unlock + no restart required = start immediately
      if (unlockOk) {
        recoveryUnlockIntent = "entry";
        localStorage.removeItem("risx_payment_intent");
        localStorage.removeItem("risx_pending_payment");
        closeModal?.(challengeModal);
        startChallengeNow(tier);
        return;
      }

      // No unlock yet = send to normal entry flow
      recoveryUnlockIntent = "entry";
      localStorage.setItem("risx_payment_intent", "entry");
      openModal?.(challengeModal);
    } finally {
      startChallengeRecoveryBtn.disabled = false;
    }
  });
}

  if (winReturnHomeBtn && !winReturnHomeBtn._bound) {
    winReturnHomeBtn._bound = true;
    winReturnHomeBtn.addEventListener("click", () => {
      closeModal?.(document.getElementById("winModal"));
      lockAppUI?.(true);
      openModal?.(challengeModal);
      if (challengeMsg) {
        challengeMsg.textContent = "Run finalized. Claim remains available in Resume Claim.";
      }
      renderTierSummary?.();
      renderRecoveryCtas?.();
    });
  }

  // -----------------------------
  // Dev win trigger (URL flag)
  // -----------------------------
  const params = new URLSearchParams(window.location.search);
  if (params.get("win") === "1") {
    window.triggerChallengeWin({
      target: getTier().goalCredits,
      achieved: getTier().goalCredits,
      payout: getTier().prizeUsd,
      currency: "USDT",
      chain: "SOL"
    });
  }


  startGameBtn?.addEventListener("click", () => withLock("minesStart", startMinesRound));
  cashOutBtn?.addEventListener("click", () => withLock("minesCashout", cashOutMines));

  setDefaultBetsIfEmpty();
  setupPresetButtons?.();
  setupTabs?.();
  setupProvablyFairDrawer?.();
  initProvablyFair?.();

  initCrash?.();
  crashStartBtn?.addEventListener("click", () => withLock("crashStart", startCrashRound));
  crashCashOutBtn?.addEventListener("click", () => withLock("crashCashout", cashOutCrash));

  initPlinko?.();

  renderChallengeParams();
  refreshChallengeHud();
  renderRecoveryCtas?.();
  void refreshPostPaymentRecovery();
  window.updateSupportIdPill?.();

  window.addEventListener("focus", () => { void refreshPostPaymentRecovery(); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void refreshPostPaymentRecovery();
  });


  document.documentElement.classList.remove("booting");
}

document.addEventListener("DOMContentLoaded", init); 
