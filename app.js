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
  const { ok, data } = await apiJson("/api/admin/mint", {
    method: "POST",
    body: JSON.stringify({ tierKey }),
  });
  if (!ok) {
    setAdminSecurityOutput(adminMintOut, String(data?.error || "Mint failed."));
    return;
  }
  const token = String(data?.unlock_token || "");
  if (token && navigator?.clipboard?.writeText) {
    try { await navigator.clipboard.writeText(token); } catch {}
  }
  setAdminSecurityOutput(adminMintOut, token ? `Token minted (copied): ${token}` : "Minted, but no token returned.");
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

function triggerChallengeWin() {

  challengeState.status = "completed";
  CHALLENGE.active = false;
  challengeActive = false;

  lockAppUI?.(true);

  const tierId = CHALLENGE.tier;
  const tier = getTier();

  console.log("🏆 CHALLENGE WON", tierId, tier);

  document.getElementById("winTarget").textContent =
    `${Number(tier.goalCredits).toLocaleString()} credits`;

  document.getElementById("winAchieved").textContent =
    `${Number(tier.goalCredits).toLocaleString()} credits`;

  document.getElementById("winPayout").textContent =
    `$${Number(tier.prizeUsd).toLocaleString()} USD`;

  document.getElementById("winModal").classList.add("open");
}

window.triggerChallengeWin = triggerChallengeWin;

let challengeState = {
  status: "inactive", // inactive | active | failed | completed | pending
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

  document.documentElement.classList.add("modal-open");
  document.body.classList.add("modal-open");

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");

  // YOUR scroller is .modal-body
  const scroller = modal.querySelector(".modal-body") || modal;
  scroller.scrollTop = 0;
}

function closeChallengeTierModal() {
  const modal = document.getElementById("challengeModal");
  if (!modal) return;

  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");

  document.documentElement.classList.remove("modal-open");
  document.body.classList.remove("modal-open");
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
  if (!challengeActive || status === "" ) {
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

function risxConfirm({ title = "Confirm", body = "", okText = "OK", cancelText = "Cancel" } = {}) {
  return new Promise((resolve) => {
    const modal   = document.getElementById("risxModal");
    const tEl     = document.getElementById("risxModalTitle");
    const bEl     = document.getElementById("risxModalBody");
    const okBtn   = document.getElementById("risxModalOk");
    const canBtn  = document.getElementById("risxModalCancel");

    if (!modal || !tEl || !bEl || !okBtn || !canBtn) {
      resolve(confirm(`${title}\n\n${body}`));
      return;
    }

    tEl.textContent = title;
    bEl.textContent = body;
    okBtn.textContent = okText;
    canBtn.textContent = cancelText;

    const close = (val) => {
      // ✅ Fix ARIA warning: don't hide a modal while something inside it still has focus
      if (modal.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      modal.classList.remove("open");
      modal.setAttribute("aria-hidden", "true");
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

    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
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
  if (!el) { console.log("[RISX]", msg); return; }
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
      setChallengeStatus?.("completed");

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

  toast?.(`Challenge failed — ${reason}`);

  challengeActive = false;
  CHALLENGE.active = false;
  saveChallengeActive?.(false);

  challengeState.status = "failed";

  CHALLENGE.resetExpiresAt = Date.now() + (10 * 60 * 1000);
  localStorage.setItem("risx_restart_required", "1");
  localStorage.setItem("risx_reset_expires_at", String(CHALLENGE.resetExpiresAt));

  refreshChallengeHud();
  openModal?.(failModal);
  startResetTimer();

  lockAppUI?.(true);
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

function makeRunId() {
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

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
  const id = makeRunId();
  localStorage.setItem(RUN_ID_KEY, id);
  localStorage.setItem(RUN_TIER_KEY, tier);
  localStorage.setItem(RUN_STATUS_KEY, "active");
  localStorage.setItem(RUN_START_KEY, String(Date.now()));
  localStorage.removeItem(RUN_END_KEY);
  return id;
}

function endRun(status /* "won" | "failed" | "reset" */) {
  localStorage.setItem(RUN_STATUS_KEY, status);
  localStorage.setItem(RUN_END_KEY, String(Date.now()));
}

function clearRun() {
  localStorage.removeItem(RUN_ID_KEY);
  localStorage.removeItem(RUN_TIER_KEY);
  localStorage.removeItem(RUN_STATUS_KEY);
  localStorage.removeItem(RUN_START_KEY);
  localStorage.removeItem(RUN_END_KEY);
}

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
const PLINKO_SHAVE = 2;

// 13 visible rows (3..15) + 2 shaved rows = 15 total render rows
const PLINKO_RENDER_ROWS = 16;

// 14 decisions makes 15 buckets
const PLINKO_DECISION_ROWS = PLINKO_BUCKETS - 1; // 14

const PLINKO_PEG_R = 5.5;     // if your .plinko-peg is 10px
const PLINKO_BALL_R = 7;    // if your .plinko-ball is 14px
const PLINKO_CLEAR = 2;     // extra spacing so it looks like a bounce

function getBucketCenterX(bucketIndex) {
  const g = plinkoGeom;
  if (!g) return 0;
  return g.sidePad + (bucketIndex + 0.5) * g.dx;
}

function setPlinkoControlsLocked(locked) {
  const root = document.getElementById("game-plinko") || document;

  // lock ONLY inputs + selects (bet settings)
  root.querySelectorAll('input, select').forEach(el => {
    el.disabled = locked;
  });

  const panel = root.querySelector(".control-panel");
  if (panel) panel.classList.toggle("locked", locked);

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
  ballEl.style.left = `${x}px`;
  ballEl.style.top  = `${y}px`;
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

  const boardW = plinkoBoardEl.clientWidth || 640;
  const boardH = plinkoBoardEl.clientHeight || 360;

  const topPad = 22;

  const css = getComputedStyle(plinkoBoardEl);
  const stripH = parseFloat(css.getPropertyValue("--bucket-strip-h")) || 32;

  // ✅ REPLACE your sidePad/dx block with this:
  const sidePad = parseFloat(css.paddingLeft) || 18; // read from CSS padding
  const innerW = boardW - sidePad * 2;               // true drawable width
  const dx = innerW / PLINKO_BUCKETS;                // 15 bucket gaps

  plinkoBoardEl.style.setProperty("--plinko-side-pad", `${sidePad}px`);

  const bottomPad = stripH + 10;
  const usableH = Math.max(240, boardH - topPad - bottomPad);

  const visibleRows = PLINKO_RENDER_ROWS - PLINKO_SHAVE;
  const dy = usableH / (visibleRows - 1);

  // ✅ store for animation + bucket center math
  plinkoGeom = { boardW, boardH, innerW, topPad, bottomPad, sidePad, dx, dy };

  for (let r = 0; r < PLINKO_RENDER_ROWS; r++) {
    if (r < PLINKO_SHAVE) continue;

    const vr = r - PLINKO_SHAVE;
    const pegsInRow = Math.min(PLINKO_BUCKETS + 1, 3 + vr); // cap at 16

    // ✅ REPLACE your startX math + peg left with this:
    const rowW = (pegsInRow - 1) * dx;
    const startX = (innerW - rowW) / 2;

    for (let c = 0; c < pegsInRow; c++) {
      const peg = document.createElement("div");
      peg.className = "plinko-peg";
      peg.dataset.row = String(r);
      peg.dataset.col = String(c);

      peg.style.left = `${sidePad + startX + c * dx}px`; // ✅ add sidePad offset
      peg.style.top  = `${topPad + vr * dy}px`;

      if (plinkoBucketsEl && plinkoBucketsEl.parentElement === plinkoBoardEl) {
        plinkoBoardEl.insertBefore(peg, plinkoBucketsEl);
      } else {
        plinkoBoardEl.appendChild(peg);
      }
    }
  }
}

requestAnimationFrame(() => {
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
  const visibleRows = PLINKO_RENDER_ROWS - PLINKO_SHAVE;
  const vr = r - PLINKO_SHAVE;
  if (vr < 0) return 0;
  return Math.min(PLINKO_BUCKETS + 1, 3 + vr); // ✅ cap at 16
}

let plinkoResizeObs = null;

function attachPlinkoResizeObserver() {
  if (!plinkoBoardEl) return;
  if (plinkoResizeObs) return; // prevent double observers

  let raf = 0;
  plinkoResizeObs = new ResizeObserver(() => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      renderPlinkoBoard();     // re-place pegs + update plinkoGeom
      renderPlinkoBuckets();   // keeps buckets/grid synced after resize
      attachPlinkoResizeObserver(); 
    });
  });

  plinkoResizeObs.observe(plinkoBoardEl);
}

function getPegCenter(row, logicalCol) {
  const count = pegsInRenderedRow(row);
  if (count <= 0) return null;

  // ✅ Duel-style mapping: logical slot -> peg index
  const renderedCol = clamp(logicalCol + 1, 0, count - 1);

  const peg = plinkoBoardEl.querySelector(
    `.plinko-peg[data-row="${row}"][data-col="${renderedCol}"]`
  );
  if (!peg) return null;

  return {
    x: parseFloat(peg.style.left),
    y: parseFloat(peg.style.top),
  };
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

function lerp(a, b, t) {
  return a + (b - a) * t;
}

async function animatePlinkoBall(ballEl, rows, path, options = {}) {
  const stepMs    = options.stepMs ?? 120;
  const driftPx   = options.driftPx ?? 6;
  const dropExtra = options.dropExtra ?? 20;
  const targetBucketIndex = options.targetBucketIndex; // ✅ z
  const startRow = PLINKO_SHAVE;
  const g = plinkoGeom;
  const boardW = g?.boardW || plinkoBoardEl.clientWidth || 640;
  const dx = g?.dx || (boardW / PLINKO_BUCKETS);

  const minX = PLINKO_BALL_R + 2;
  const maxX = boardW - (PLINKO_BALL_R + 2);

  const BALL_R = 7;
  const PEG_R  = 5;
  const HIT_Y  = PEG_R + BALL_R + 2;
  const KICK_X = PEG_R + BALL_R + 1;

  const points = [];
  let col = 0;

  const first = getPegCenter(startRow, 0);
  if (!first) throw new Error(`Missing peg row ${startRow} col ${col}`);
  points.push({ x: first.x, y: first.y - 40 });

    // Decision step 0..rows-1 maps to board row (startRow + step)
  for (let step = 0; step < rows; step++) {
    const boardRow = startRow + step;

    const peg = getPegCenter(boardRow, col);
    if (!peg) throw new Error(`Missing peg row ${boardRow} col ${col}`);

    const dir = (path[step] === 1) ? 1 : -1;

    const remaining = (rows - 1) - step;          // last step => 0
    const damp = clamp((remaining + 1) / 6, 0.12, 1); // last ~5 steps damp hard
    const kick = Math.min(KICK_X * damp, dx * 0.45);

    points.push({ x: peg.x + dir * kick, y: peg.y - HIT_Y });

    if (path[step] === 1) col += 1;

    const nextPeg = getPegCenter(boardRow + 1, col);
    if (nextPeg) {
      points.push({ x: nextPeg.x, y: nextPeg.y - HIT_Y });
    }
  }

  const last = points[points.length - 1];

  let targetX = last.x;
  if (Number.isInteger(targetBucketIndex)) {
  targetX = clamp(getBucketCenterX(targetBucketIndex), minX, maxX); 
  }

  const boardRect = plinkoBoardEl.getBoundingClientRect();
  const bucketRect = plinkoBucketsEl.getBoundingClientRect();
  const targetY = (bucketRect.top - boardRect.top) + (bucketRect.height * 0.35); // slightly above center

  // ✅ funnel steps (prevents sudden jump)
  const funnelSteps = 3;
  for (let s = 1; s <= funnelSteps; s++) {
  const t = s / (funnelSteps + 1);
  points.push({
    x: lerp(last.x, targetX, t),
    y: lerp(last.y, targetY, t)
      });
    }
    points.push({ x: targetX, y: targetY });

    // spawn jitter: tiny offset so spam-clicks don't look cloned
    const jx = spawnJitterX();
    setBallPosFor(ballEl, points[0].x + jx, points[0].y);
    applyBallGlow(ballEl, 0);

    let finalRenderedX = points[0].x;

    for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const start = performance.now();

    await new Promise(resolve => {
      function frame(now) {
      const t = Math.min(1, (now - start) / stepMs);
      const e = easeOutCubic(t);

      const segmentsLeft = (points.length - 2) - i;
      const wobbleFade = clamp(segmentsLeft / 4, 0, 1);

      const rawX = lerp(a.x, b.x, e);
      const bounce = Math.sin(e * Math.PI) * 1.8 * wobbleFade;

      const x = clamp(rawX, minX, maxX);
      const y = lerp(a.y, b.y, e) - bounce;

  // ✅ THIS WAS MISSING
  finalRenderedX = x;
  setBallPosFor(ballEl, x, y);

  // glow decay based on vertical progress within the board
  const tGlow = clamp(y / (plinkoGeom?.boardH || plinkoBoardEl.clientHeight || 500), 0, 1);
  applyBallGlow(ballEl, tGlow);

  if (t >= 1) return resolve();
  requestAnimationFrame(frame);
}
      requestAnimationFrame(frame);
    });
  }

 
  setTimeout(() => ballEl.remove(), 250);

  return finalRenderedX; // ✅ true rendered X at end
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

async function dropPlinkoBall() {

  // allow multiple balls; optionally cap spam
  const MAX_IN_FLIGHT = 8;
  if (plinkoBallsInFlight >= MAX_IN_FLIGHT) return;

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

    plinkoOnBallDrop_LockIfNeeded?.();  // 🔒 locks settings, keeps drop enabled

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
    plinkoOnBallResolved_UnlockIfDone?.(); // 🔓 unlocks only when last ball resolves
    refreshChallengeHud();
    postRoundChecks?.();
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
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  const open = () => {
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
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

  console.log("Session stats reset");
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
  modalEl.setAttribute("aria-hidden", "false");
  modalEl.classList.add("open");
  modalEl.style.display = "block";
  lockBodyScroll();
}

function closeModal(modalEl) {
  if (!modalEl) return;
  modalEl.setAttribute("aria-hidden", "true");
  modalEl.classList.remove("open");
  modalEl.style.display = "none";
  unlockBodyScroll();
}

function switchUser() {
  const name = prompt("Enter player name:", currentWallet || "Guest");
  if (name === null) return;

  const next = name.trim();
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
          ${escapeHtml(c.tier || "—")} • $${Number(c.prizeUsd || 0).toFixed(2)}
          <span style="opacity:.7; font-size:12px; margin-left:8px;">(${escapeHtml(c.status || "")})</span>
        </div>
        <div class="admin-sub">Run: ${escapeHtml(c.runId || "—")} • PaymentID: ${escapeHtml(c.supportId || "—")}</div>
        <div class="admin-sub">${new Date(c.createdAt).toLocaleString()}</div>
        <div class="admin-sub">To: <b>${escapeHtml(c.address || "")}</b></div>
        ${c.email ? `<div class="admin-sub">Email: ${escapeHtml(c.email)}</div>` : ""}
        ${c.note ? `<div class="admin-sub">Note: ${escapeHtml(c.note)}</div>` : ""}
        ${c.txid ? `<div class="admin-sub">Tx: ${escapeHtml(c.txid)}</div>` : ""}
      </div>

      <div class="admin-actions">
        <button class="btn small primary" data-claim-mark="${escapeHtml(c.id)}" data-claim-status="PAID">PAID</button>
        <button class="btn small secondary" data-claim-mark="${escapeHtml(c.id)}" data-claim-status="VOID">VOID</button>
      </div>
    </div>
  `).join("");
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
  } catch (e) {
    console.warn("[RISX] submitRequest failed (ignored):", e);
  }

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

  const claims = readList(claimsKey);
  const deposits = readList(depositsKey);
  const withdrawals = readList(withdrawalsKey);

  // counts
  adminCountClaims && (adminCountClaims.textContent = String(claims.filter(c => c.status === "PENDING").length));
  adminCountDeposits && (adminCountDeposits.textContent = String(deposits.filter(d => d.status === "PENDING").length));
  adminCountWithdrawals && (adminCountWithdrawals.textContent = String(withdrawals.filter(d => d.status === "PENDING").length));
  if (adminCountUsers) {
    const users = new Set([...deposits, ...withdrawals].map(x => x.wallet));
    adminCountUsers.textContent = String(users.size);
  }

  if (adminTab === "deposits") {
    const list = deposits
      .filter(r => !pendingOnly || r.status === "PENDING")
      .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    adminViewDeposits.innerHTML = renderAdminList(list, "deposit");
  } else if (adminTab === "claims") {
  const list = claims
    .filter(r => !pendingOnly || r.status === "PENDING")
    .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
  adminViewClaims.innerHTML = renderClaimsList(list);
  } else if (adminTab === "withdrawals") {
    const list = withdrawals
      .filter(r => !pendingOnly || r.status === "PENDING")
      .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    adminViewWithdrawals.innerHTML = renderAdminList(list, "withdraw");
  } else {
    adminViewUsers.innerHTML = `<div class="redeem-empty">Users view (later).</div>`;
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
  const idx = list.findIndex(x => String(x.id) === String(id));
  if (idx < 0) return;

  // prevent double-finalizing
  const prev = String(list[idx].status || "");
  if (prev === "PAID" || prev === "VOID") return;

  if (status === "PAID") {
    const txid = prompt("Paste txid / payout ref (optional):", list[idx].txid || "");
    if (txid) list[idx].txid = txid.trim();
    list[idx].paidAt = Date.now();
  }

  const markRes = await apiJson("/api/admin/claims/markPaid", {
    method: "POST",
    body: JSON.stringify({ claimId: id, status, txid: list[idx].txid || "" }),
  });
  if (!markRes.ok) {
    adminMsg && (adminMsg.textContent = String(markRes.data?.error || "Claim update rejected."));
    return;
  }

  if (status === "VOID") list[idx].voidAt = Date.now();

  list[idx].status = status;
  writeList(claimsKey, list);

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
      console.warn(`[RISX] Missing section: #game-${target}`);
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
  plinkoDropBtn?.addEventListener("click", () => withLock("plinkoDrop", dropPlinkoBall));
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

  const status = getChallengeStatus();

  // If last run ended, do NOT auto-resume.
  if (status === "failed" || status === "won") {
  challengeActive = false;
  CHALLENGE.active = false;
  saveChallengeActive(false);
  }

  if (challengeActive) {
  // already in a live challenge
  setActiveWallet(CHALLENGE_WALLET_ID);
  setChallengeWalletUI?.();
  lockAppUI(false);
  closeModal(challengeModal);
} else {
  // no challenge yet → lock and show tier modal
  lockAppUI(true);
  openModal(challengeModal);
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
  connectWalletBtn?.addEventListener("click", () => {
  if (CHALLENGE?.enabled && challengeActive) {
    toast?.("Challenge mode uses internal credits. Wallet connect is disabled.");
    return;
  }
  const input = prompt("Enter wallet address (demo):", currentWallet || "");
  if (!input) return;
  setActiveWallet(input.trim());
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

function startChallengeNow(tier) {
  startRun(tier);

  // set selected tier first (so getTier() always matches)
  challengeTierSelected = tier;
  CHALLENGE.tier = tier;

  const t = getTier();

  if (t.locked) {
    alert("This tier is currently invite only.");
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

  showChallengeResetIfNeeded();
  setDefaultBetsIfEmpty();
  renderChallengeParams();

  if (challengeMsg) challengeMsg.textContent = `Challenge started: ${tier.toUpperCase()}`;

  refreshChallengeHud();
  closeModal(challengeModal);
  lockAppUI(false);
}

  window.RISX_startChallengeFromPayment = async (tier) => {
  closeModal(challengeModal);

  // If they failed and are in reset window, entry/unlock doesn't matter — force restart payment
  if (restartRequiredNow()) {
    localStorage.setItem("risx_payment_intent", "restart");
    window.RISX_openPayModalForTier?.(tier);
    return;
  }

  const ok = await hasValidUnlockForTier(tier);
  if (!ok) {
    localStorage.setItem("risx_payment_intent", "entry");
    window.RISX_openPayModalForTier?.(tier);
    return;
  }

  startChallengeNow(tier);
};

  if (challengeStartBtn && !challengeStartBtn._bound) {
  challengeStartBtn._bound = true;
  
  challengeStartBtn?.addEventListener("click", async () => {
  const tier = challengeTier?.value || "beginner";

  // ✅ Gate: if they failed and are within reset window, force restart payment
  if (restartRequiredNow()) {
    closeModal(challengeModal);
    localStorage.setItem("risx_payment_intent", "restart");
    window.RISX_openPayModalForTier?.(tier);
    toast?.("Restart required — pay reset to start again.");
    return;
  }

  const ok = await hasValidUnlockForTier(tier);
  if (!ok) {
    closeModal(challengeModal);
    localStorage.setItem("risx_payment_intent", "entry");
    window.RISX_openPayModalForTier?.(tier);
    if (challengeMsg) {
      challengeMsg.textContent = `Tier locked: ${tier.toUpperCase()} — complete payment to unlock.`;
    }
    return;
  }

  startChallengeNow(tier);
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

  if (submitClaimBtn && !submitClaimBtn._bound) {
    submitClaimBtn._bound = true;

   submitClaimBtn.addEventListener("click", () => {
  // Ask directly (fastest, no extra modal needed)
  const address = prompt("Enter payout wallet address:", "");
  if (!address || !address.trim()) {
    alert("Enter a wallet address");
    return;
  }

  const email = prompt("Email (optional, for support contact):", "") || "";
  const note  = prompt("Note (optional):", "") || "";

  const tierId = CHALLENGE.tier;
  const tier = getTier();
  const run = getRun?.() || {};
  const supportId = localStorage.getItem("risx_last_payment_id") || "—";

  const claim = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    runId: run.id || localStorage.getItem("risx_run_id") || "",
    tier: tierId,
    prizeUsd: Number(tier.prizeUsd || 0),
    goalCredits: Number(tier.goalCredits || 0),
    address: address.trim(),
    email: email.trim(),
    note: note.trim(),
    supportId,
    status: "PENDING",
    createdAt: Date.now()
  };

  const list = readList(claimsKey);
  list.unshift(claim);
  writeList(claimsKey, list);

  submitClaimBtn.disabled = true;
  submitClaimBtn.textContent = "Claim Submitted";

  // keep UX clean
  document.getElementById("winModal")?.classList.remove("open");

  alert("Claim submitted. Manual review + payout within 24h.");
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
  window.updateSupportIdPill?.();


  document.documentElement.classList.remove("booting");
}

document.addEventListener("DOMContentLoaded", init); 
