// =========================
// DOM REFS (declare only — no listeners here)
// =========================
const connectWalletBtn = document.getElementById("connectWalletBtn");
const depositBtn = document.getElementById("depositBtn");
const withdrawBtn = document.getElementById("withdrawBtn");
const adminBtn = document.getElementById("adminBtn");
const currencySelect = document.getElementById("currencySelect"); // make sure this id exists
const walletCurrencyLabel = document.getElementById("walletCurrencyLabel"); // make sure exists

function debounce(fn, delay = 150) {
  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), delay);
  };
}

// =========================
// WALLET: DEMO REQUEST FLOW (localStorage)
// =========================
const WALLET_STORE_KEY = "RISX_WALLET_DEMO_V1";

function loadWalletStore() {
  try {
    return JSON.parse(localStorage.getItem(WALLET_STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveWalletStore(store) {
  localStorage.setItem(WALLET_STORE_KEY, JSON.stringify(store));
}

function getWalletId() {
  // Use currentWallet if your repo has it; otherwise fall back to a default
  if (typeof currentWallet === "string" && currentWallet.trim()) return currentWallet.trim();
  return "demo-wallet";
}

function getWalletState() {
  const store = loadWalletStore();
  const id = getWalletId();

  if (!store[id]) {
    store[id] = {
      currency: (typeof selectedCurrency === "string" ? selectedCurrency : "USDT"),
      balance: (typeof balance === "number" ? balance : 1000),
      requests: [] // {id,type,amount,currency,status,createdAt,updatedAt}
    };
    saveWalletStore(store);
  }
  return store[id];
}

function setWalletState(nextState) {
  const store = loadWalletStore();
  const id = getWalletId();
  store[id] = nextState;
  saveWalletStore(store);
}

function pushRequest(type, amount) {
  const st = getWalletState();
  const req = {
    id: `req_${Math.random().toString(16).slice(2)}_${Date.now()}`,
    type, // "deposit" | "withdraw"
    amount: Number(amount),
    currency: st.currency || "USDT",
    status: "pending", // "pending" | "approved" | "rejected"
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  st.requests.unshift(req);
  setWalletState(st);
  return req;
}

function updateRequest(id, status) {
  const st = getWalletState();
  const r = st.requests.find(x => x.id === id);
  if (!r) return null;
  r.status = status;
  r.updatedAt = Date.now();

  // Apply balance effects only when status changes to approved
  if (status === "approved") {
    if (r.type === "deposit") st.balance += r.amount;
    if (r.type === "withdraw") st.balance -= r.amount;
  }

  setWalletState(st);

  // keep your existing global balance in sync if you use it
  if (typeof balance === "number") {
    balance = st.balance;
    if (typeof updateBalanceDisplay === "function") updateBalanceDisplay();
  }

  return r;
}

function formatReqRow(r) {
  const t = new Date(r.createdAt).toLocaleString();
  return `${r.type.toUpperCase()} • ${r.amount} ${r.currency} • ${r.status.toUpperCase()} • ${t}`;
}

// Optional: small UI helpers if your HTML has these nodes
function syncWalletUI() {
  const st = getWalletState();

  // If you have a balance node in your wallet panel, update it
  const balNode =
    document.getElementById("walletBalance") ||
    document.getElementById("balance"); // fallback to old demo balance span
  if (balNode) balNode.textContent = (st.balance ?? 0).toFixed ? st.balance.toFixed(2) : String(st.balance);

  if (currencySelect) {
    currencySelect.value = st.currency || "USDT";
  }
  if (walletCurrencyLabel) {
    walletCurrencyLabel.textContent = st.currency || "USDT";
  }
}

// Basic prompt fallback (so nothing breaks if modals aren’t there yet)
function promptDeposit() {
  const raw = prompt("Demo deposit amount (credits):", "100");
  const amt = Number(raw);
  if (!Number.isFinite(amt) || amt <= 0) return;
  pushRequest("deposit", amt);
  syncWalletUI();
  alert("Deposit request created (pending). Open Admin to approve.");
}

function promptWithdraw() {
  const raw = prompt("Demo withdraw amount (credits):", "50");
  const amt = Number(raw);
  if (!Number.isFinite(amt) || amt <= 0) return;
  pushRequest("withdraw", amt);
  syncWalletUI();
  alert("Withdraw request created (pending). Open Admin to approve.");
}

function openAdminPrompt() {
  const st = getWalletState();
  const pending = st.requests.filter(r => r.status === "pending");

  if (pending.length === 0) {
    alert("No pending requests.");
    return;
  }

  const menu = pending
    .map((r, i) => `${i + 1}) ${formatReqRow(r)}\n   Approve: A${i + 1}   Reject: R${i + 1}`)
    .join("\n\n");

  const action = prompt(
    `ADMIN (demo)\n\n${menu}\n\nType A# to approve or R# to reject (example: A1)`,
    "A1"
  );

  if (!action) return;

  const m = action.trim().match(/^([aArR])\s*(\d+)$/);
  if (!m) return;

  const letter = m[1].toLowerCase();
  const idx = Number(m[2]) - 1;
  const req = pending[idx];
  if (!req) return;

  updateRequest(req.id, letter === "a" ? "approved" : "rejected");
  syncWalletUI();
}

function initWalletDemoFlow() {
  // Grab fresh elements by ID (don’t rely on old const refs)
  let connectEl  = document.getElementById("connectWalletBtn");
  let depositEl  = document.getElementById("depositBtn");
  let withdrawEl = document.getElementById("withdrawBtn");
  let adminEl    = document.getElementById("adminBtn");

  // Wipe any existing listeners by cloning (keeps same id/class/styles)
  function wipeAndGet(el) {
    if (!el || !el.parentNode) return el;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    return clone;
  }

  connectEl  = wipeAndGet(connectEl);
  depositEl  = wipeAndGet(depositEl);
  withdrawEl = wipeAndGet(withdrawEl);
  adminEl    = wipeAndGet(adminEl);

  // Currency select changes wallet state
  currencySelect?.addEventListener("change", () => {
    const st = getWalletState();
    st.currency = currencySelect.value || "USDT";
    setWalletState(st);

    if (typeof selectedCurrency === "string") selectedCurrency = st.currency;
    syncWalletUI();
  });

  // Connect (prompt-based)
  connectEl?.addEventListener("click", () => {
    const input = prompt("Enter wallet address (demo):", getWalletId());
    if (!input) return;
    if (typeof currentWallet === "string") currentWallet = input.trim();
    syncWalletUI();
  });

  // Deposit / Withdraw / Admin (prompt-based demo flow)
  depositEl?.addEventListener("click", promptDeposit);
  withdrawEl?.addEventListener("click", promptWithdraw);
  adminEl?.addEventListener("click", openAdminPrompt);

  syncWalletUI();
}

// =========================
// RISX: CORE STATE
// =========================
const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

let currentWallet = "";          // IMPORTANT: declared early now
let balance = 0;
let selectedCurrency = "USDT";
// =========================
// PLINKO: HELPERS & SETTINGS (14/15 model, flat top)
// =========================
const PLINKO_BUCKETS = 15;
const PLINKO_SHAVE = 2;

// 13 visible rows (3..15) + 2 shaved rows = 15 total render rows
const PLINKO_RENDER_ROWS = 16;

// 14 decisions makes 15 buckets
const PLINKO_DECISION_ROWS = PLINKO_BUCKETS - 1; // 14

const PLINKO_PEG_R = 5;     // if your .plinko-peg is 10px
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
  root.querySelectorAll('#game-plinko input, #game-plinko select').forEach(el => {
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
  // length MUST be 15
  low:  [14, 6, 3, 2, 1.4, 1.1, 0.9, 0.9, 0.9, 1.1, 1.4, 2, 3, 6, 14],
  med:  [111,30,12,5,2.2,1.2,0.6,0.6,0.6,1.2,2.2,5,12,30,111],
  high: [1000,130,50,12,4,0.2,0.20,0.2,0.2,0.2,4,12,50,130,1000],
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

  const topPad = 30;

  const css = getComputedStyle(plinkoBoardEl);
  const stripH = parseFloat(css.getPropertyValue("--bucket-strip-h")) || 32;

  // ✅ REPLACE your sidePad/dx block with this:
  const sidePad = parseFloat(css.paddingLeft) || 18; // read from CSS padding
  const innerW = boardW - sidePad * 2;               // true drawable width
  const dx = innerW / PLINKO_BUCKETS;                // 15 bucket gaps

  plinkoBoardEl.style.setProperty("--plinko-side-pad", `${sidePad}px`);

  const bottomPad = stripH + 18;
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
}

function setupProvablyFairDrawer() {
  const openBtn = document.getElementById("openPfBtn");
  const modal = document.getElementById("pfModal");
  if (!openBtn || !modal) return;

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

  openBtn.addEventListener("click", open);

  modal.addEventListener("click", (e) => {
    if (e.target && e.target.matches("[data-pf-close]")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("open")) close();
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
  try {
    const bet = Number(plinkoBetAmountEl?.value || 0);

    if (bet <= 0) { plinkoMessageEl.textContent = "Enter a bet above 0."; return; }
    if (bet > balance) { plinkoMessageEl.textContent = "Bet exceeds your balance."; return; }

    balance -= bet;
    updateBalanceDisplay();

    plinkoBallsInFlight++;
    setPlinkoControlsLocked(true);

    const rows = PLINKO_DECISION_ROWS; // 14

    const { bucketIndex, path } = await provablyFairPlinko({
      serverSeed,
      clientSeed,
      nonce: plinkoNonce++,
      rows
    });

    const ballEl = spawnPlinkoBall();
    if (!ballEl) throw new Error("Could not spawn plinko ball.");

    await animatePlinkoBall(ballEl, rows, path, { targetBucketIndex: bucketIndex });

    const mult = getPlinkoMultiplier(bucketIndex);
    highlightBucket(bucketIndex);

    const payout = bet * mult * 0.98;
    balance += payout;
    updateBalanceDisplay();

    if (plinkoOutcomeEl) plinkoOutcomeEl.textContent = `Bucket ${bucketIndex + 1}/${PLINKO_BUCKETS}`;
    if (plinkoMultEl) plinkoMultEl.textContent = formatMult(mult);
    if (plinkoMessageEl) plinkoMessageEl.textContent =
      `You hit ${formatMult(mult)} → ${formatCredits(payout - bet)} profit`;

  } catch (err) {
  console.error(err);
  if (plinkoMessageEl) plinkoMessageEl.textContent = `Plinko error: ${err?.message || err}`;
} finally {
  plinkoBallsInFlight = Math.max(0, plinkoBallsInFlight - 1);
  if (plinkoBallsInFlight === 0) setPlinkoControlsLocked(false);
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

// PLINKO STATE
let plinkoRows = 8;
let plinkoBet = 10;
let plinkoDropping = false;
let lastPlinkoResult = null;

let serverSeed = "CHANGE_ME_TO_RANDOM_LONG_SECRET"; // secret until reveal
let clientSeed = "Guest"; // let player edit this
let plinkoNonce = 0;
let plinkoBallsInFlight = 0;  // ✅ ADD THIS

// CRASH STATE
let crashRoundActive = false;
let crashCrashed = false;
let crashBet = 10;
let crashCrashPoint = 0;      // multiplier at which round crashes
let crashCurrentMult = 1.0;
let crashStartTime = 0;
let crashAnimFrameId = null;
const crashMaxDisplayMult = 50; // cap visual rocket/curve at 50x
const crashRounds = []; // { outcome: 'bust'|'cashout', mult: number }

const RISX_SAVE_KEY = "risx_demo_wallet_v2";
const WALLET_KEY = `${RISX_SAVE_KEY}::activeWallet`;
const walletStoreKey = (wallet) => `${RISX_SAVE_KEY}::wallet::${wallet}`;
const depositsKey = `${RISX_SAVE_KEY}::deposits`;
const withdrawalsKey = `${RISX_SAVE_KEY}::withdrawals`;

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

function persistWallet(){
  if (!currentWallet) return;
  saveWalletState(currentWallet, {
    balance,
    currency: selectedCurrency,
    updatedAt: Date.now()
  });
}

function setActiveWallet(wallet){
  const w = String(wallet || "").trim();
  if (!w) return;

  // persist active wallet
  localStorage.setItem(WALLET_KEY, w);

  currentWallet = w;
  if (currentWalletEl) currentWalletEl.textContent = currentWallet;

  // load wallet state (balance + currency)
  const s = loadWalletState(w) || { balance: 0, currency: selectedCurrency };
  balance = Number(s.balance || 0);
  selectedCurrency = String(s.currency || selectedCurrency);

  if (currencySelect) currencySelect.value = selectedCurrency;
  if (walletCurrencyLabel) walletCurrencyLabel.textContent = selectedCurrency;

  console.log("ACTIVE WALLET:", currentWallet);
  updateBalanceDisplay();
}

function userKey(name) {
  return `${RISX_SAVE_KEY}::${name}`;
}

// =========================
// DOM HOOKS
// =========================

// Wallet / global
const balanceEl        = document.getElementById("balance");
const resetBalanceBtn  = document.getElementById("resetBalanceBtn");

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

requestAnimationFrame(() => {
  renderPlinkoBoard();
  renderPlinkoBuckets();
});

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
const switchUserBtn   = document.getElementById("connectWalletBtn");
const currentWalletEl   = document.getElementById("currentWallet");
// Wallet connect UI
const walletAddressInput    = document.getElementById("walletAddressInput");
const currentWalletDisplay  = document.getElementById("currentWalletDisplay");
const walletStatusEl        = document.getElementById("walletStatus");

let crashCurveLine = null;

// =========================
// UTILS
// =========================

function formatCredits(value) {
  return Number(value || 0).toFixed(2);
}

function formatMult(value) {
  return value.toFixed(2) + "x";
}

function updateBalanceDisplay() {
  balanceEl.textContent = formatCredits(balance);
  persistWallet();
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

function hashString(str) {
  // small stable hash for display/keys (not crypto)
  str = String(str ?? "");
  let h = 2166136261; // FNV-1a
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
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
  resetMinesResultCard();
  resetMinesRound();

  if (gameActive) return;

  const bet = Number(betAmountInput.value || 0);
  const mCount = Number(mineCountInput.value || 0);

  if (bet <= 0) {
    resultMessageEl.textContent = "Enter a bet above 0.";
    return;
  }
  if (bet > balance) {
    resultMessageEl.textContent = "Bet exceeds your balance.";
    return;
  }
  if (mCount < 1 || mCount >= TOTAL_CELLS) {
    resultMessageEl.textContent = "Mines must be between 1 and 24.";
    return;
  }
  if (!sessionStartMs) { sessionStartMs = Date.now(); startSessionTimer(); }

  balance -= bet;
  currentBet = bet;
  currentMines = mCount;
  safeClicks = 0;
  minesSet = generateMines(currentMines);
  gameActive = true;

  updateBalanceDisplay();
  updateMinesInfoPanel(1.0, safeClicks);

  resultMessageEl.textContent = "";
  strategyMessageEl.textContent = "";
  minesResultCard.classList.add("hidden");
  minesResultCard.classList.remove("lose");

  resetMinesGridVisual();
  setMinesGridEnabled(true);

  startGameBtn.disabled = true;
  cashOutBtn.disabled = false;
}

function endMinesRound({ outcome, cashedOut, multiplier }) {
  gameActive = false;
  setMinesGridEnabled(false);
  startGameBtn.disabled = false;
  cashOutBtn.disabled = true;

  const winAmount =
    cashedOut && outcome === "win"
      ? currentBet * multiplier
      : 0;

  if (winAmount > 0) {
    balance += winAmount;
    updateBalanceDisplay();
  }

  // Overlay card
  if (outcome === "lose") {
    minesResultTitle.textContent = "You exploded";
    minesResultMult.textContent = formatMult(multiplier);
    minesResultWin.textContent = formatCredits(0);
    minesResultCard.classList.add("lose");
  } else {
    minesResultTitle.textContent = cashedOut ? "You cashed out" : "Round over";
    minesResultMult.textContent = formatMult(multiplier);
    minesResultWin.textContent = formatCredits(winAmount);
    minesResultCard.classList.remove("lose");
  }
  minesResultCard.classList.remove("hidden");

  if (outcome === "lose") {
  minesLosses++;
  } else if (cashedOut) {
  minesWins++;
  }

sessionRounds++;

  updateSessionStats();
}

function resetMinesResultCard() {
  if (!minesResultCard) return;

  // Hide FIRST (prevents any “default green” frame)
  minesResultCard.classList.add("hidden");

  // Next paint: safely reset visuals/text while hidden
  requestAnimationFrame(() => {
    minesResultCard.classList.remove("lose", "win");
    if (minesResultTitle) minesResultTitle.textContent = "";
    if (minesResultMult)  minesResultMult.textContent  = "1.00x";
    if (minesResultWin)   minesResultWin.textContent   = "0";
  });
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

  const mult = computeMinesMultiplier(currentMines, Math.max(1, safeClicks));

  // end round FIRST so the result card shows immediately
  endMinesRound({
    outcome: "lose",
    cashedOut: false,
    multiplier: mult
  });

  // reveal the rest AFTER the card paints
  requestAnimationFrame(() => {
    revealAllMines();
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

  const mult = computeMinesMultiplier(currentMines, safeClicks);

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
  presetLowBtn.addEventListener("click", () => setPresetMines(3, "Low"));
  presetMedBtn.addEventListener("click", () => setPresetMines(5, "Medium"));
  presetHighBtn.addEventListener("click", () => setPresetMines(8, "High"));
}

// =========================
// WALLET CONTROLS
// =========================

function resetBalance() {
  balance = 1000;
  updateBalanceDisplay();
  resultMessageEl.textContent = "Balance reset to 1000 demo credits.";
  crashStatusMessage.textContent = "";
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

// =========================
// TABS
// =========================

function setupTabs() {
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
      const target = btn.dataset.target;
      show(target);
    });
  });

  // Ensure something is visible on load
  const activeBtn = document.querySelector(".game-tab.active");
  show(activeBtn?.dataset.target || "mines");
}

// =========================
// CRASH: LOGIC
// =========================

// Generates a random crash point with a heavy tail.
// Most rounds 1–3x, some 3–10x, rare 10–50x+.
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
  crashCrashed = true;

  crashCashOutBtn.disabled = true;
  crashStartBtn.disabled = false;

  sessionRounds++;
  bestCrashMult = Math.max(bestCrashMult, crashCurrentMult);
  updateSessionStats();

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

  const bet = Number(crashBetAmountEl.value || 0);

  if (bet <= 0) {
    crashStatusMessage.textContent = "Enter a bet above 0.";
    return;
  }
  if (bet > balance) {
    crashStatusMessage.textContent = "Bet exceeds your balance.";
    return;
  }
  if (!sessionStartMs) { sessionStartMs = Date.now(); startSessionTimer(); }

  // Deduct bet
  balance -= bet;
  updateBalanceDisplay();
  crashBet = bet;

  crashCrashPoint = generateCrashPoint();
  crashCurrentMult = 1.0;
  crashCrashed = false;
  crashRoundActive = true;
  crashStartTime = performance.now();

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

  const houseEdge = 0.02;
  const payout = crashBet * crashCurrentMult * (1 - houseEdge);

  balance += payout;
  updateBalanceDisplay();

  showCrashToast(`You cashed out at ${formatMult(crashCurrentMult)} for ${formatCredits(payout)} credits`);

  crashRoundActive = false;
  crashCrashed = false;
  crashCashOutBtn.disabled = true;
  crashStartBtn.disabled = false;

  if (crashAnimFrameId !== null) {
    cancelAnimationFrame(crashAnimFrameId);
    crashAnimFrameId = null;
  }

  sessionRounds++;
  bestCrashMult = Math.max(bestCrashMult, crashCurrentMult);
  updateSessionStats();

  // Freeze rocket where it is (no crash explosion)
  if (crashRocketEl) {
    crashRocketEl.classList.remove("crashed");
  }

  // History
  crashRounds.unshift({
    outcome: "cashout",
    mult: crashCurrentMult
  });
  if (crashRounds.length > 5) crashRounds.pop();
  renderCrashHistory();
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

// =========================
// INIT
// =========================

function wireBetMultButtons(inputEl, halfBtn, twoXBtn, maxBtn) {
  if (!inputEl) return;

  const read = () => Number(inputEl.value || 0);

  const write = (v) => {
    // keep it clean + non-negative
    const vv = Math.max(0, Math.round(v * 100) / 100);
    inputEl.value = String(vv);
    // optional: triggers any listeners you have watching input changes
    inputEl.dispatchEvent(new Event("input", { bubbles: true }));
  };

  halfBtn?.addEventListener("click", () => {
  const v = read();
  if (v <= 0) return;
  write(v / 2);
});

twoXBtn?.addEventListener("click", () => {
  const v = read();
  if (v <= 0) write(0.1);
  else write(v * 2);
});

  maxBtn?.addEventListener("click", () => write(balance)); // uses your current demo balance
}

// Inputs
const betAmountInput   = document.getElementById("betAmount");
const crashBetAmountEl = document.getElementById("crashBetAmount");
const plinkoBetAmountEl= document.getElementById("plinkoBetAmount");

// Mines buttons
wireBetMultButtons(
  betAmountInput,
  document.getElementById("minesHalfBtn"),
  document.getElementById("mines2xBtn"),
  document.getElementById("minesMaxBtn")
);

// Crash buttons
wireBetMultButtons(
  crashBetAmountEl,
  document.getElementById("crashHalfBtn"),
  document.getElementById("crash2xBtn"),
  document.getElementById("crashMaxBtn")
);

// Plinko buttons
wireBetMultButtons(
  plinkoBetAmountEl,
  document.getElementById("plinkoHalfBtn"),
  document.getElementById("plinko2xBtn"),
  document.getElementById("plinkoMaxBtn")
);

function initPlinko() {
  renderPlinkoBoard();
  renderPlinkoBuckets();
  attachPlinkoResizeObserver();

  let plinkoResizeRaf = 0;

  plinkoRiskEl?.addEventListener("change", renderPlinkoBuckets);
  plinkoDropBtn?.addEventListener("click", dropPlinkoBall);
}

function init() {

    // Wallet connect
connectWalletBtn?.addEventListener("click", () => {
  const input = prompt("Enter wallet address (demo):", currentWallet || "");
  if (!input) return;
  setActiveWallet(input);
});

// Currency select
currencySelect?.addEventListener("change", () => {
  selectedCurrency = currencySelect.value;
  if (walletCurrencyLabel) walletCurrencyLabel.textContent = selectedCurrency;
  persistWallet();
});
  
  // Boot: restore active wallet if present
  (function bootWallet(){
    const w = localStorage.getItem(WALLET_KEY) || "";
    if (w) setActiveWallet(w);
    else {
    if (currentWalletEl) currentWalletEl.textContent = "—";
    }
    })();

depositBtn?.addEventListener("click", () => {
  const amt = Number(prompt("Demo deposit amount (credits):", "100") || 0);
  if (!amt || amt <= 0) return;
  balance += amt;
  updateBalanceDisplay();
});

withdrawBtn?.addEventListener("click", () => {
  const amt = Number(prompt("Demo withdraw amount (credits):", "50") || 0);
  if (!amt || amt <= 0) return;
  if (amt > balance) return alert("Insufficient balance.");
  balance -= amt;
  updateBalanceDisplay();
});

adminBtn?.addEventListener("click", () => {
  alert(`Admin (demo)\nWallet: ${currentWallet}\nBalance: ${formatCredits(balance)}`);
});


  // =============================
  // MODALS (Deposit / Withdraw / Admin)
  // =============================
  function openModal(el) {
    if (!el) return;
    el.classList.add("open");
    el.setAttribute("aria-hidden", "false");
  }
  function closeModal(el) {
    if (!el) return;
    el.classList.remove("open");
    el.setAttribute("aria-hidden", "true");
  }

  document.querySelectorAll("[data-deposit-close]").forEach(btn => btn.addEventListener("click", () => closeModal(depositModal)));
  document.querySelectorAll("[data-withdraw-close]").forEach(btn => btn.addEventListener("click", () => closeModal(withdrawModal)));
  document.querySelectorAll("[data-admin-close]").forEach(btn => btn.addEventListener("click", () => closeModal(adminModal)));

  if (depositBtn) depositBtn.addEventListener("click", () => {
    if (!currentWallet) return toast("Connect wallet first.");
    depositCurrency.value = selectedCurrency;
    refreshDepositAddress();
    depositMsg.textContent = "";
    openModal(depositModal);
  });

  if (withdrawBtn) withdrawBtn.addEventListener("click", () => {
    if (!currentWallet) return toast("Connect wallet first.");
    withdrawMsg.textContent = "";
    renderWithdrawHistory();
    openModal(withdrawModal);
  });

if (adminBtn) adminBtn.addEventListener("click", () => {
  openModal(adminModal);
  setAdminTab("deposits");
  renderAdmin();
});

function refreshDepositAddress() {
  const cur = depositCurrency.value;
  // Demo: deterministic fake address per wallet+currency
  const fake = `${cur}_${hashString(currentWallet).slice(0, 10)}_${hashString(cur).slice(0, 6)}`;
  depositAddress.value = fake;
}

  if (depositCurrency) depositCurrency.addEventListener("change", refreshDepositAddress);

  if (copyDepositBtn) copyDepositBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(depositAddress.value);
    depositMsg.textContent = "Copied.";
  } catch {
    depositMsg.textContent = "Copy failed (clipboard blocked).";
  }
  });

  // Withdraw requests
  function submitWithdrawRequest() {
  const amt = Number(withdrawAmount.value || 0);
  const addr = String(withdrawAddress.value || "").trim();
  if (!currentWallet) return toast("Connect wallet first.");
  if (!addr) return (withdrawMsg.textContent = "Enter a destination address.");
  if (!isFinite(amt) || amt <= 0) return (withdrawMsg.textContent = "Enter a valid amount.");
  if (amt > balance) return (withdrawMsg.textContent = "Insufficient balance.");

  const req = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    wallet: currentWallet,
    currency: selectedCurrency,
    amount: clamp2(amt),
    to: addr,
    status: "PENDING",
    createdAt: Date.now()
  };
  const list = readList(withdrawalsKey);
  list.unshift(req);
  writeList(withdrawalsKey, list);
  withdrawAddress.value = "";
  withdrawMsg.textContent = "Submitted. Status: PENDING.";
  renderWithdrawHistory();
}

if (withdrawSubmitBtn) withdrawSubmitBtn.addEventListener("click", submitWithdrawRequest);
if (withdrawClearBtn) withdrawClearBtn.addEventListener("click", () => {
  const list = readList(withdrawalsKey).filter(r => r.wallet !== currentWallet);
  writeList(withdrawalsKey, list);
  renderWithdrawHistory();
});

function renderWithdrawHistory() {
  if (!withdrawHistoryList) return;
  const list = readList(withdrawalsKey).filter(r => r.wallet === currentWallet);
  if (!list.length) {
    withdrawHistoryList.innerHTML = `<div class="redeem-empty">No requests yet.</div>`;
    return;
  }
  withdrawHistoryList.innerHTML = list.map(r => `
    <div class="redeem-item">
      <div class="redeem-item-top">
        <div class="redeem-item-title">${formatCredits(r.amount)} ${r.currency}</div>
        <div class="redeem-item-status ${r.status.toLowerCase()}">${r.status}</div>
      </div>
      <div class="redeem-item-sub">${new Date(r.createdAt).toLocaleString()} • ${escapeHtml(r.to)}</div>
    </div>
  `).join("");
}

// Admin Ops
let adminTab = "deposits";
function setAdminTab(tab) {
  adminTab = tab;

  // buttons
  adminTabDeposits?.classList.toggle("active", tab === "deposits");
  adminTabWithdrawals?.classList.toggle("active", tab === "withdrawals");
  adminTabUsers?.classList.toggle("active", tab === "users");

  // views
  adminViewDeposits?.classList.toggle("hidden", tab !== "deposits");
  adminViewWithdrawals?.classList.toggle("hidden", tab !== "withdrawals");
  adminViewUsers?.classList.toggle("hidden", tab !== "users");
}

adminTabDeposits?.addEventListener("click", () => { setAdminTab("deposits"); renderAdmin(); });
adminTabWithdrawals?.addEventListener("click", () => { setAdminTab("withdrawals"); renderAdmin(); });
adminTabUsers?.addEventListener("click", () => { setAdminTab("users"); renderAdmin(); });

adminRefreshBtn?.addEventListener("click", renderAdmin);
adminPendingOnly?.addEventListener("change", renderAdmin);
adminSearch?.addEventListener("input", debounce(renderAdmin, 150));

function renderAdmin() {
  const q = (adminSearch?.value || "").trim().toLowerCase();
  const pendingOnly = !!adminPendingOnly?.checked;

  const deposits = readList(depositsKey);
  const withdrawals = readList(withdrawalsKey);

  // counts
  if (adminCountDeposits) adminCountDeposits.textContent = String(deposits.filter(d => d.status === "PENDING").length);
  if (adminCountWithdrawals) adminCountWithdrawals.textContent = String(withdrawals.filter(d => d.status === "PENDING").length);
  if (adminCountUsers) {
    const users = new Set([...deposits, ...withdrawals].map(x => x.wallet));
    adminCountUsers.textContent = String(users.size);
  }

  if (adminTab === "deposits") {
    const list = deposits
      .filter(r => !pendingOnly || r.status === "PENDING")
      .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    adminViewDeposits.innerHTML = renderAdminList(list, "deposit");
  } else if (adminTab === "withdrawals") {
    const list = withdrawals
      .filter(r => !pendingOnly || r.status === "PENDING")
      .filter(r => !q || JSON.stringify(r).toLowerCase().includes(q));
    adminViewWithdrawals.innerHTML = renderAdminList(list, "withdraw");
  } else {
    const users = aggregateUsers(deposits, withdrawals, q);
    adminViewUsers.innerHTML = users.length ? users.map(u => `
      <div class="admin-row">
        <div class="admin-col">
          <div class="admin-title">${escapeHtml(u.wallet)}</div>
          <div class="admin-sub">Balance: ${formatCredits(u.balance)} ${escapeHtml(u.currency)}</div>
        </div>
        <div class="admin-actions">
          <button class="btn small secondary" data-admin-credit="${escapeHtml(u.wallet)}">+10</button>
          <button class="btn small secondary" data-admin-debit="${escapeHtml(u.wallet)}">-10</button>
        </div>
      </div>
    `).join("") : `<div class="redeem-empty">No users yet.</div>`;

    // bind credit/debit
    adminViewUsers.querySelectorAll("[data-admin-credit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const w = btn.getAttribute("data-admin-credit");
        adminAdjustBalance(w, +10);
      });
    });
    adminViewUsers.querySelectorAll("[data-admin-debit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const w = btn.getAttribute("data-admin-debit");
        adminAdjustBalance(w, -10);
      });
    });
  }

  adminMsg.textContent = "";
}

function renderAdminList(list, kind) {
  if (!list.length) return `<div class="redeem-empty">Nothing here.</div>`;
  return list.map(r => `
    <div class="admin-row">
      <div class="admin-col">
        <div class="admin-title">${escapeHtml(r.wallet)}</div>
        <div class="admin-sub">${kind === "deposit" ? "Deposit" : "Withdraw"} • ${formatCredits(r.amount)} ${escapeHtml(r.currency)}</div>
        <div class="admin-sub">${new Date(r.createdAt).toLocaleString()} • ${kind === "withdraw" ? ("To: " + escapeHtml(r.to)) : ("Addr: " + escapeHtml(r.address || ""))}</div>
      </div>
      <div class="admin-actions">
        <button class="btn small primary" data-admin-paid="${escapeHtml(r.id)}" data-kind="${kind}">PAID</button>
        <button class="btn small secondary" data-admin-void="${escapeHtml(r.id)}" data-kind="${kind}">VOID</button>
      </div>
    </div>
  `).join("");
}

function aggregateUsers(deposits, withdrawals, q) {
  const wallets = new Set([...deposits, ...withdrawals].map(x => x.wallet));
  const out = [];
  wallets.forEach(w => {
    if (q && !w.toLowerCase().includes(q)) return;
    const raw = localStorage.getItem(walletStoreKey(w));
    let bal = 0, cur = "USDT";
    if (raw) { try { const s = JSON.parse(raw); bal = Number(s.balance||0); cur = String(s.currency||"USDT"); } catch {} }
    out.push({ wallet: w, balance: bal, currency: cur });
  });
  return out.sort((a,b)=>a.wallet.localeCompare(b.wallet));
}

function adminAdjustBalance(wallet, delta) {
  const raw = localStorage.getItem(walletStoreKey(wallet));
  let s = { balance: 0, currency: "USDT" };
  if (raw) { try { s = JSON.parse(raw); } catch {} }
  s.balance = clamp2((Number(s.balance)||0) + delta);
  localStorage.setItem(walletStoreKey(wallet), JSON.stringify(s));
  if (wallet === currentWallet) {
    balance = s.balance;
    selectedCurrency = s.currency;
    updateBalanceDisplay();
  }
  renderAdmin();
}

function adminMark(id, kind, status) {
  const key = (kind === "deposit") ? depositsKey : withdrawalsKey;
  const list = readList(key);
  const idx = list.findIndex(x => String(x.id) === String(id));
  if (idx < 0) return;
  list[idx].status = status;
  writeList(key, list);

  // Apply balance effects when PAID
  if (status === "PAID") {
    const r = list[idx];
    if (kind === "withdraw") {
      // deduct from that wallet
      adminAdjustBalance(r.wallet, -Number(r.amount || 0));
    } else {
      adminAdjustBalance(r.wallet, +Number(r.amount || 0));
    }
  }
  renderAdmin();
}

adminModal?.addEventListener("click", (e) => {
  const paid = e.target.closest("[data-admin-paid]");
  const voidBtn = e.target.closest("[data-admin-void]");
  if (paid) return adminMark(paid.getAttribute("data-admin-paid"), paid.getAttribute("data-kind"), "PAID");
  if (voidBtn) return adminMark(voidBtn.getAttribute("data-admin-void"), voidBtn.getAttribute("data-kind"), "VOID");
});

// Hotkey: Ctrl/Cmd + Shift + A to open Admin Ops (demo)
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && e.shiftKey && (e.key === "A" || e.key === "a")) {
    e.preventDefault();
    openModal(adminModal);
    setAdminTab("deposits");
    renderAdmin();
  }
});

// Demo "deposit request" shortcut: Ctrl/Cmd + Shift + D creates a pending deposit for current wallet
document.addEventListener("keydown", (e) => {
  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const mod = isMac ? e.metaKey : e.ctrlKey;
  if (mod && e.shiftKey && (e.key === "D" || e.key === "d")) {
    if (!currentWallet) return;
    e.preventDefault();
    const req = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      wallet: currentWallet,
      currency: selectedCurrency,
      amount: 10,
      address: depositAddress?.value || "",
      status: "PENDING",
      createdAt: Date.now()
    };
    const list = readList(depositsKey);
    list.unshift(req);
    writeList(depositsKey, list);
    toast("Created demo deposit request (+10 pending). Approve in Admin.");
  }
});

updateBalanceDisplay();
  updateMinesInfoPanel(1.0, 0);

  buildMinesGrid();
  renderCrashHistory();

  // Session stats + timer
  updateSessionStats();
  startSessionTimer();
  updateSessionTimer();

  // WALLET (demo request flow)
  initWalletDemoFlow();

  // Session reset  
  if (resetSessionBtn) {
    resetSessionBtn.addEventListener("click", () => {
      sessionRounds = 0;
      bestCrashMult = 0;
      minesWins = 0;
      minesLosses = 0;

      resetSessionTimer();
      updateSessionStats();
    });
  }

  // MINES
  if (startGameBtn) startGameBtn.addEventListener("click", startMinesRound);
  if (cashOutBtn) cashOutBtn.addEventListener("click", cashOutMines);
  if (resetBalanceBtn) resetBalanceBtn.addEventListener("click", resetBalance);

  setupPresetButtons();
  setupTabs();
  setupProvablyFairDrawer();

  // CRASH
  initCrash();
  if (crashStartBtn) crashStartBtn.addEventListener("click", startCrashRound);
  if (crashCashOutBtn) crashCashOutBtn.addEventListener("click", cashOutCrash);

  // PLINKO
  initPlinko();
}

document.addEventListener("DOMContentLoaded", init);