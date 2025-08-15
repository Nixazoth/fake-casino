// Arcadia v3 — visuals & animations
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ---------- Global State & Stats ----------
const state = {
  balance: 0, startBalance: 0, houseEdge: 0.01,
  history: [], pnl: [{x:0,y:0}], idx: 0,
  totals: {wagered:0, won:0, games:0, bestStreak:0, curStreak:0},
  mines:null, crash:null, bj:null,
};

function save() { localStorage.setItem("arcadia_v3", JSON.stringify(state)); }
function load() {
  const raw = localStorage.getItem("arcadia_v3"); if (!raw) return;
  try { const s = JSON.parse(raw); Object.assign(state, s); } catch (e) {}
}
function fmt(n) { return Number(n).toLocaleString('fr-FR', {maximumFractionDigits:2}); }
function updateHeader() {
  $("#balance").textContent = fmt(state.balance);
  $("#mTotalWagered").textContent = fmt(state.totals.wagered);
  $("#mTotalWon").textContent = fmt(state.totals.won);
  $("#mNet").textContent = (state.balance - state.startBalance >= 0 ? '+' : '') + fmt(state.balance - state.startBalance);
  $("#sTotalWagered").textContent = fmt(state.totals.wagered);
  $("#sTotalWon").textContent = fmt(state.totals.won);
  $("#sNet").textContent = (state.balance - state.startBalance >= 0 ? '+' : '') + fmt(state.balance - state.startBalance);
  $("#sBestStreak").textContent = state.totals.bestStreak;
  $("#sGames").textContent = state.totals.games;
}

// ---------- P&L Chart (Responsive Canvas) ----------
const pnl = $("#pnlChart"); const pctx = pnl.getContext("2d");
function drawPNL() {
  const w = pnl.clientWidth, h = pnl.clientHeight;
  pnl.width = w * devicePixelRatio; pnl.height = h * devicePixelRatio;
  pctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  pctx.clearRect(0, 0, w, h);
  pctx.fillStyle = "#0d1126"; pctx.fillRect(0, 0, w, h);
  pctx.strokeStyle = "rgba(255,255,255,.06)";
  for (let i = 0; i < 5; i++) { const y = (h - 20) * i / 4 + 10; pctx.beginPath(); pctx.moveTo(40, y); pctx.lineTo(w - 10, y); pctx.stroke(); }
  const data = state.pnl.length ? state.pnl : [{x:0,y:state.balance}];
  const ys = data.map(d => d.y); const minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = (maxY - minY) || 10;
  const y0 = minY - pad * 0.2, y1 = maxY + pad * 0.2;
  const sx = (w - 60) / Math.max(1, (data.at(-1).x || 1)); const sy = (h - 40) / (y1 - y0 || 1);
  const grad = pctx.createLinearGradient(0, 0, 0, h); grad.addColorStop(0, "rgba(124,135,255,.9)"); grad.addColorStop(1, "rgba(124,135,255,.1)");
  pctx.strokeStyle = grad; pctx.lineWidth = 2;
  pctx.beginPath();
  data.forEach((p, i) => { const x = 40 + p.x * sx; const y = (h - 20) - (p.y - y0) * sy; if (i === 0) pctx.moveTo(x, y); else pctx.lineTo(x, y); });
  pctx.stroke();
}
const ro = new ResizeObserver(drawPNL); ro.observe(pnl);

function pushPoint() { state.pnl.push({x: ++state.idx, y: state.balance}); drawPNL(); }
function addHistory(item) {
  state.history.unshift(item);
  const el = document.createElement("div"); el.className = "hist-item";
  el.innerHTML = `<span>${new Date(item.ts).toLocaleTimeString('fr-FR')}</span>
                  <span>${item.game}</span>
                  <span>${item.result}</span>
                  <span style="color:${item.delta >= 0 ? '#70e0a5' : '#ff7b9b'}">${item.delta >= 0 ? '+' : ''}${fmt(item.delta)}</span>
                  <span>${fmt(item.balanceAfter)}</span>`;
  $("#history").prepend(el);
}

// ---------- RNG ----------
function rng01() { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 2**32; }
function randint(n) { return Math.floor(rng01() * n); }
function pick(a) { return a[Math.floor(rng01() * a.length)]; }

// ---------- Session ----------
$("#resetSession").addEventListener('click', () => { localStorage.removeItem('arcadia_v3'); location.reload(); });
$("#exportHistory").addEventListener('click', () => {
  const payload = JSON.stringify({generatedAt: new Date().toISOString(), state}, null, 2);
  const blob = new Blob([payload], {type: "application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = "arcadia_v3_history.json"; a.click(); URL.revokeObjectURL(url);
});
$("#startPlay").addEventListener('click', () => {
  const b = parseFloat($("#startBankroll").value || "0");
  if (b <= 0) return alert("Entre un montant > 0");
  state.balance = b; state.startBalance = b; state.pnl = [{x:0,y:b}]; state.idx = 0; save(); $("#startModal").classList.remove('active'); updateHeader(); drawPNL();
});
load();
if (state.startBalance > 0) { $("#startModal").classList.remove('active'); updateHeader(); setTimeout(drawPNL, 0); state.history.slice().reverse().forEach(addHistory); }

// ---------- Controls & Edge ----------
$("#houseEdge").addEventListener('input', e => { state.houseEdge = parseFloat(e.target.value) / 100; $("#houseEdgeLabel").textContent = (state.houseEdge * 100).toFixed(1) + "%"; save(); updateDiceStats(); });
$("#houseEdgeLabel").textContent = (state.houseEdge * 100).toFixed(1) + "%"; $("#houseEdge").value = (state.houseEdge * 100).toFixed(1);
$$('.chip').forEach(ch => ch.addEventListener('click', () => {
  const kind = ch.dataset.chip; let v = parseFloat($("#betAmount").value || "0");
  if (kind === 'clear') v = 0; else if (kind === 'half') v = Math.floor(v / 2); else if (kind === 'double') v *= 2; else if (kind === 'all') v = state.balance; else v += parseFloat(kind);
  $("#betAmount").value = v;
}));
$$('.nav-btn').forEach(b => b.addEventListener('click', () => { $$('.nav-btn').forEach(x => x.classList.remove('active')); b.classList.add('active'); $$('.view').forEach(v => v.classList.remove('active')); $("#view-" + b.dataset.view).classList.add('active'); }));

// ---------- Settlement & Totals ----------
function settle(game, bet, payout, meta) {
  const delta = payout - bet;
  state.balance += delta;
  state.totals.wagered += bet; state.totals.won += payout; state.totals.games += 1;
  if (delta > 0) { state.totals.curStreak += 1; state.totals.bestStreak = Math.max(state.totals.bestStreak, state.totals.curStreak); } else if (delta < 0) { state.totals.curStreak = 0; }
  updateHeader(); pushPoint();
  const item = {ts: Date.now(), game, bet, result: payout > 0 ? "WIN" : "LOSE", delta, balanceAfter: state.balance, meta};
  state.history.push(item); addHistory(item); save();
}

// ---------- Coin Flip (3D) ----------
let cfChoice = "heads"; $("#cfChoice").addEventListener('click', e => { if (e.target.tagName !== 'BUTTON') return; $$('#cfChoice button').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); cfChoice = e.target.dataset.side; });
$("#cfPlay").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  const coin = $("#coin3d"); const spin = 360 * 4 + Math.floor(rng01() * 360); coin.style.transform = `rotateY(${spin}deg)`;
  setTimeout(() => { const res = rng01() < 0.5 ? "heads" : "tails"; $("#cfResult").textContent = res === "heads" ? "Face" : "Pile"; const mult = 2 * (1 - state.houseEdge); const payout = (res === cfChoice) ? bet * mult : 0; settle("Coin Flip", bet, payout, {choice: cfChoice, landed: res, mult: +mult.toFixed(3)}); }, 1000);
});

// ---------- Dice (Gauge) ----------
const diceTarget = $("#diceTarget"); function updateDiceStats() { const t = parseInt(diceTarget.value); $("#diceTargetLabel").textContent = t; const chance = t / 100; const mult = (0.99 / (t / 100)) * (1 - state.houseEdge); $("#diceMult").textContent = mult.toFixed(2) + 'x'; $("#diceChance").textContent = Math.round(chance * 100) + '%'; } updateDiceStats(); diceTarget.addEventListener('input', updateDiceStats);
const dg = $("#diceGauge"); const dgx = dg.getContext('2d');
function drawGauge(val, target) {
  const w = dg.width, h = dg.height; dgx.clearRect(0, 0, w, h);
  dgx.fillStyle = "#0d1126"; dgx.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h * 0.9, r = h * 0.8;
  // arc
  dgx.lineWidth = 18; dgx.strokeStyle = "rgba(255,255,255,.08)"; dgx.beginPath(); dgx.arc(cx, cy, r, Math.PI, 2 * Math.PI); dgx.stroke();
  // colored
  dgx.strokeStyle = "#7c87ff"; dgx.beginPath(); dgx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * val / 100); dgx.stroke();
  // needle
  const ang = Math.PI + Math.PI * val / 100;
  dgx.strokeStyle = "#43f2b6"; dgx.lineWidth = 3; dgx.beginPath(); dgx.moveTo(cx, cy); dgx.lineTo(cx + Math.cos(ang) * (r - 10), cy + Math.sin(ang) * (r - 10)); dgx.stroke();
  // target tick
  const targ = Math.PI + Math.PI * target / 100; dgx.strokeStyle = "rgba(255,255,255,.25)"; dgx.beginPath(); dgx.moveTo(cx + Math.cos(targ) * (r - 22), cy + Math.sin(targ) * (r - 22)); dgx.lineTo(cx + Math.cos(targ) * (r + 6), cy + Math.sin(targ) * (r + 6)); dgx.stroke();
}
$("#dicePlay").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  const t = parseInt(diceTarget.value);
  let val = 0; const anim = setInterval(() => { val += 3 + Math.random() * 6; drawGauge(Math.min(val, 100), t); if (val >= 100) { clearInterval(anim); const roll = Math.floor(rng01() * 100); $("#diceResult").textContent = roll < t ? `WIN (${roll})` : `LOSE (${roll})`; const mult = (0.99 / (t / 100)) * (1 - state.houseEdge); settle("Dice", bet, roll < t ? bet * mult : 0, {target: t, roll, mult: +mult.toFixed(3)}); } }, 20);
});

// ---------- Mines (same core, with reveal anim via CSS) ----------
const board = $("#minesBoard"), mCount = $("#minesCount"), mLabel = $("#minesCountLabel");
function minesReset() { board.innerHTML = ''; $("#minesResult").textContent = '—'; $("#minesPayout").textContent = '0 A$'; $("#minesCashout").disabled = true; }
$("#minesStart").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  const bombs = parseInt(mCount.value); mLabel.textContent = bombs;
  const size = 5, total = size * size; const bomb = new Set(); while (bomb.size < bombs) bomb.add(randint(total));
  const revealed = new Set(); const safeCount = total - bombs;
  const base = []; for (let i = 0; i <= safeCount; i++) { const p = i / safeCount; base.push(1 + Math.pow(p, 1.6) * 3.5 * (1 - state.houseEdge)); }
  state.mines = {bet, bomb, revealed, base, active: true};
  minesReset();
  for (let i = 0; i < total; i++) { const c = document.createElement('div'); c.className = 'cell'; c.dataset.idx = i; c.addEventListener('click', minesClick); board.appendChild(c); }
  $("#minesCashout").disabled = false;
});
mCount.addEventListener('input', () => mLabel.textContent = mCount.value);
function minesClick(e) {
  const st = state.mines; if (!st || !st.active) return;
  const i = +e.currentTarget.dataset.idx; if (st.revealed.has(i)) return;
  st.revealed.add(i); const isMine = st.bomb.has(i);
  e.currentTarget.classList.add('revealed'); e.currentTarget.classList.add(isMine ? 'mine' : 'safe');
  if (isMine) minesEnd(false); else updateMinesPayout();
}
function updateMinesPayout() {
  const st = state.mines; const safe = [...st.revealed].filter(i => !st.bomb.has(i)).length;
  const mult = st.base[safe] || 1; $("#minesPayout").textContent = `${fmt(st.bet * mult)} A$`;
}
function minesEnd(won) {
  const st = state.mines; if (!st || !st.active) return; st.active = false;
  $$('.cell').forEach(c => { const i = +c.dataset.idx; c.classList.add('revealed'); c.classList.toggle('mine', st.bomb.has(i)); c.classList.toggle('safe', !st.bomb.has(i)); });
  let payout = 0; if (won) { const safe = [...st.revealed].filter(i => !st.bomb.has(i)).length; const mult = st.base[safe] || 1; payout = st.bet * mult; $("#minesResult").textContent = `CASHOUT ×${mult.toFixed(2)}`; } else { $("#minesResult").textContent = `BOOM 💥`; }
  $("#minesCashout").disabled = true; settle("Mines", st.bet, payout, {won});
}
$("#minesCashout").addEventListener('click', () => minesEnd(true));

// ---------- Crash (as before) ----------
const ccv = $("#crashChart"); const ccx = ccv.getContext('2d');
function drawCrash(pts, crashed) {
  const w = ccv.width, h = ccv.height; ccx.clearRect(0, 0, w, h);
  ccx.fillStyle = "#0d1126"; ccx.fillRect(0, 0, w, h);
  ccx.strokeStyle = "rgba(255,255,255,.08)"; for (let i = 0; i < 5; i++) { const y = (h - 20) * i / 4 + 10; ccx.beginPath(); ccx.moveTo(30, y); ccx.lineTo(w - 10, y); ccx.stroke(); }
  ccx.strokeStyle = crashed ? "#ff7b9b" : "#7c87ff"; ccx.lineWidth = 2; ccx.beginPath();
  pts.forEach((p, i) => { const x = 30 + p.x * 60; const y = (h - 10) - Math.min(240, p.y * 35); if (i === 0) ccx.moveTo(x, y); else ccx.lineTo(x, y); }); ccx.stroke();
}
function scheduleCrashPoint() { const U = Math.max(1e-6, rng01()); let m = 1 + 1 / U; m = Math.min(m, 50); return 1 + (m - 1) * (1 - state.houseEdge * 0.5); }
$("#crashStart").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  if (state.crash && state.crash.running) return;
  const cp = scheduleCrashPoint(); const pts = [{x:0,y:1}]; let t = 0, mult = 1; $("#crashState").textContent = "En cours"; $("#crashMult").textContent = "1.00x"; $("#crashCashout").disabled = false; $("#crashResult").textContent = "—";
  state.crash = {bet, cp, pts, running: true, cashed: false};
  function step() { if (!state.crash.running) return; t += 0.05; mult = 1 + (Math.exp(t) - 1) * 0.2; pts.push({x:t,y:mult}); $("#crashMult").textContent = mult.toFixed(2) + 'x'; drawCrash(pts, false);
    if (mult >= cp) { state.crash.running = false; $("#crashState").textContent = "Crash"; $("#crashCashout").disabled = true; drawCrash(pts, true);
      const payout = state.crash.cashed ? state.crash.bet * state.crash.cashedAt : 0;
      $("#crashResult").textContent = state.crash.cashed ? `Cashout ×${state.crash.cashedAt.toFixed(2)}` : `CRASH @ ×${cp.toFixed(2)}`;
      settle("Crash", state.crash.bet, payout, {crashPoint: cp, cashedAt: state.crash.cashedAt || null});
    } else { requestAnimationFrame(step); } }
  requestAnimationFrame(step);
});
$("#crashCashout").addEventListener('click', () => { if (!(state.crash && state.crash.running)) return; const m = parseFloat($("#crashMult").textContent); state.crash.cashed = true; state.crash.cashedAt = m * (1 - state.houseEdge * 0.2); $("#crashState").textContent = "CASHOUT"; $("#crashCashout").disabled = true; });

// ---------- Roulette (Canvas wheel + ball) ----------
const rouCanvas = $("#rouCanvas"); const rcx = rouCanvas.getContext('2d');
const orderEU = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
const redSet = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
function drawWheel(rotation = 0, ballAngle = null) {
  const w = rouCanvas.width, h = rouCanvas.height; const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.45;
  rcx.clearRect(0, 0, w, h); rcx.fillStyle = "#0d1126"; rcx.fillRect(0, 0, w, h);
  // sectors
  const N = 37; const step = (2 * Math.PI) / N;
  for (let i = 0; i < N; i++) {
    const ang = i * step + rotation;
    rcx.beginPath(); rcx.moveTo(cx, cy); rcx.arc(cx, cy, R, ang, ang + step); rcx.closePath();
    const num = orderEU[i];
    rcx.fillStyle = num === 0 ? "#0b8f4a" : (redSet.has(num) ? "#c33" : "#222");
    rcx.fill();
  }
  // outer ring
  rcx.lineWidth = 6; rcx.strokeStyle = "rgba(255,255,255,.15)"; rcx.beginPath(); rcx.arc(cx, cy, R, 0, 2 * Math.PI); rcx.stroke();
  // numbers (simplified dots)
  rcx.fillStyle = "#fff"; rcx.font = "12px system-ui"; rcx.textAlign = "center"; rcx.textBaseline = "middle";
  for (let i = 0; i < N; i++) { const a = i * step + rotation + step / 2; const r = R * 0.78; rcx.fillText(orderEU[i], cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
  // ball
  if (ballAngle !== null) { const rBall = R * 0.92; rcx.fillStyle = "#eee"; rcx.beginPath(); rcx.arc(cx + Math.cos(ballAngle) * rBall, cy + Math.sin(ballAngle) * rBall, 8, 0, 2 * Math.PI); rcx.fill(); rcx.strokeStyle = "rgba(0,0,0,.3)"; rcx.stroke(); }
}
drawWheel();
$("#rouPlay").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  const t = $("#rouType").value; const picked = parseInt($("#rouNumber").value);
  let time = 0; let rot = 0; let ball = 2 * Math.PI; const spin = (2 + Math.random() * 1.5); const ballSpin = (3 + Math.random() * 2);
  const dt = 1 / 60; const fr = setInterval(() => {
    time += dt; rot += spin * dt * 4; ball -= ballSpin * dt * 5; drawWheel(rot, ball);
    if (time > 3) { clearInterval(fr);
      // compute landing index: angle relative to rotation
      const N = 37; const step = (2 * Math.PI) / N;
      let rel = (ball - rot) % (2 * Math.PI); if (rel < 0) rel += 2 * Math.PI;
      const index = Math.floor(rel / step);
      const landed = orderEU[index];
      $("#rouResult").textContent = `Arrêt sur ${landed}`;
      let win = false, mult = 0;
      if (t === "red") { win = landed !== 0 && redSet.has(landed); mult = 2 * (1 - state.houseEdge); }
      else if (t === "black") { win = landed !== 0 && !redSet.has(landed); mult = 2 * (1 - state.houseEdge); }
      else if (t === "even") { win = landed !== 0 && landed % 2 === 0; mult = 2 * (1 - state.houseEdge); }
      else if (t === "odd") { win = landed !== 0 && landed % 2 === 1; mult = 2 * (1 - state.houseEdge); }
      else { win = landed === picked; mult = 35 * (1 - state.houseEdge); }
      settle("Roulette", bet, win ? bet * mult : 0, {type: t, picked, landed, mult: +mult.toFixed(3)});
    }
  }, 1000 / 60);
});

// ---------- Plinko (Canvas animation) ----------
const plcv = $("#plCanvas"); const plx = plcv.getContext('2d');
function plMultipliers(rows, risk) {
  const slots = rows + 1; const C = [1]; for (let i = 1; i <= rows; i++) { C[i] = C[i - 1] * (rows - i + 1) / i; }
  const total = 2**rows; const riskBoost = risk === 'low' ? 0.8 : risk === 'med' ? 1.1 : 1.6;
  const base = new Array(slots).fill(0);
  for (let k = 0; k <= rows; k++) { const p = C[k] / total; base[k] = Math.max(0.2, (1 / p)**0.35) * 0.6 * riskBoost * (1 - state.houseEdge); }
  let ev = 0; for (let k = 0; k <= rows; k++) ev += (C[k] / total) * base[k];
  const scale = (1 - state.houseEdge) / Math.max(0.01, ev); return base.map(v => v * scale);
}
function drawBoard(rows, pegR = 5) {
  const w = plcv.width, h = plcv.height; plx.clearRect(0, 0, w, h);
  plx.fillStyle = "#0d1126"; plx.fillRect(0, 0, w, h);
  const gapX = w / (rows + 2), gapY = h / (rows + 2);
  plx.fillStyle = "rgba(255,255,255,.15)";
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c <= r; c++) {
      const x = gapX * (1 + (rows - r) / 2 + c);
      const y = gapY * (1 + r);
      plx.beginPath(); plx.arc(x, y, pegR, 0, 2 * Math.PI); plx.fill();
    }
  }
}
drawBoard(12);
$("#plPlay").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  const rows = parseInt($("#plRows").value); const risk = $("#plRisk").value; const mults = plMultipliers(rows, risk);
  const w = plcv.width, h = plcv.height; const gapX = w / (rows + 2), gapY = h / (rows + 2);
  let col = Math.floor(rows / 2), x = gapX * (1 + (rows - 0) / 2), y = gapY * 0.5, vy = 0, vx = 0;
  const grav = 0.35, damp = 0.6, pegR = 5;
  function step() {
    drawBoard(rows);
    // draw ball
    vy += grav; y += vy; x += vx * 0.98;
    // collisions with pegs
    for (let r = 0; r < rows; r++) {
      const py = gapY * (1 + r);
      if (Math.abs(y - py) < 8) {
        for (let c = 0; c <= r; c++) {
          const px = gapX * (1 + (rows - r) / 2 + c);
          const dx = x - px, dy = y - py; const dist = Math.hypot(dx, dy);
          if (dist < (pegR + 6)) {
            // simple bounce left or right
            vx += (dx >= 0 ? 1 : -1) * (0.8 + Math.random() * 0.4);
            vy *= -damp; y += (dy >= 0 ? 1 : -1) * 2;
          }
        }
      }
    }
    plx.fillStyle = "#eee"; plx.beginPath(); plx.arc(x, y, 6, 0, 2 * Math.PI); plx.fill();
    if (y > h - gapY * 0.6) {
      // compute slot index by x
      const startX = gapX; const endX = w - gapX; const slotW = (endX - startX) / (rows + 1);
      let k = Math.min(rows, Math.max(0, Math.floor((x - startX) / slotW)));
      const mult = mults[k]; $("#plMult").textContent = mult.toFixed(2) + 'x'; $("#plSlot").textContent = `${k}/${rows}`;
      $("#plResult").textContent = `Slot ${k} — ×${mult.toFixed(2)}`;
      settle("Plinko", bet, bet * mult, {rows, risk, slot: k, mult: +mult.toFixed(3)});
    } else { requestAnimationFrame(step); }
  }
  requestAnimationFrame(step);
});

// ---------- Slots (Reel animation) ----------
const symList = [{s:"🍒",w:30,pay:2},{s:"🍋",w:25,pay:3},{s:"🔔",w:20,pay:5},{s:"💎",w:10,pay:10},{s:"⭐",w:8,pay:15},{s:"7️⃣",w:4,pay:30}];
function weightedPick() { let total = symList.reduce((a, b) => a + b.w, 0); let r = rng01() * total; for (const s of symList) { if ((r -= s.w) <= 0) return s; } return symList[0]; }
function buildStrip(reel) {
  const strip = reel.querySelector('.strip'); strip.innerHTML = ''; const items = [];
  for (let i = 0; i < 18; i++) { const s = weightedPick(); items.push(s); const div = document.createElement('div'); div.className = 'symbol'; div.textContent = s.s; strip.appendChild(div); }
  return items;
}
const reels = $$('#reels .reel'); const strips = reels.map(r => r.querySelector('.strip'));
reels.forEach(buildStrip);
function evalSlotsStop(visible, bet) {
  // visible: array of 3 rows × 3 cols symbols (string)
  const edgeAdj = (1 - state.houseEdge);
  let win = 0;
  for (let r = 0; r < 3; r++) {
    const a = visible[r][0], b = visible[r][1], c = visible[r][2];
    if (a === b && b === c) {
      const sym = symList.find(x => x.s === a); win += bet * sym.pay * edgeAdj;
    } else if (a === b || b === c) {
      const s = a === b ? a : b; const sym = symList.find(x => x.s === s); win += bet * sym.pay * 0.5 * edgeAdj;
    }
  }
  return win;
}
$("#slotsSpin").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  // spin reels with different durations
  const durations = [1200, 1500, 1800];
  const results = [];
  reels.forEach((reel, i) => {
    const strip = reel.querySelector('.strip');
    buildStrip(reel);
    strip.style.transition = 'none'; strip.style.transform = 'translateY(0)';
    requestAnimationFrame(() => {
      strip.style.transition = `transform ${durations[i]}ms cubic-bezier(.2,.8,.2,1)`;
      const end = - (56 + 8) * (15 + Math.floor(rng01() * 3)); // symbol height + gap
      strip.style.transform = `translateY(${end}px)`;
      setTimeout(() => {
        // compute visible 3 symbols around stop index ~ 9..12
        const baseIndex = Math.abs(Math.round(end / 64));
        const visible = [0, 1, 2].map(r => {
          const s1 = strip.children[baseIndex + r]?.textContent || '🍒';
          return s1;
        });
        results[i] = visible;
        if (results.filter(Boolean).length === 3) {
          // Compose 3x3
          const matrix = [ [results[0][0], results[1][0], results[2][0]],
                           [results[0][1], results[1][1], results[2][1]],
                           [results[0][2], results[1][2], results[2][2]] ];
          const win = evalSlotsStop(matrix, bet); $("#slotsWin").textContent = `${fmt(win)} A$`;
          settle("Slots", bet, win, {matrix});
        }
      }, durations[i] + 20);
    });
  });
});

// ---------- Blackjack (SVG Cards) ----------
function newDeck() { const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K']; const deck = []; for (let i = 0; i < 4; i++) { for (const r of ranks) { deck.push(r); } } for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rng01() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; } return deck; }
function v(r) { if (r === 'A') return 11; if (['K','Q','J'].includes(r)) return 10; return parseInt(r); }
function handVal(h) { let s = 0, a = 0; for (const r of h) { s += v(r); if (r === 'A') a++; } while (s > 21 && a > 0) { s -= 10; a--; } return s; }
function cardSVG(rank, suit) {
  const red = (suit === '♥' || suit === '♦'); const cls = red ? 'red' : 'black';
  return `<div class="card-sv ${cls}"><div class="front">
    <div class="p">${rank}${suit}</div><div class="c">${rank}${suit}</div></div><div class="back"></div></div>`;
}
function renderBJ() {
  const p = $("#bjPlayer"), d = $("#bjDealer");
  p.innerHTML = state.bj.player.map(c => cardSVG(c.rank, c.suit)).join('');
  d.innerHTML = state.bj.dealer.map((c, i) => i === 0 && state.bj.stage === 'deal' ? cardSVG('', '') : cardSVG(c.rank, c.suit)).join('');
  $("#bjPlayerVal").textContent = handVal(state.bj.player.map(c => c.rank));
  $("#bjDealerVal").textContent = state.bj.stage === 'deal' ? "?" : handVal(state.bj.dealer.map(c => c.rank));
}
function dealCard() { const r = state.bj.deck.pop(); const suits = ['♠','♥','♦','♣']; return {rank: r, suit: pick(suits)}; }
function enableBJ(deal, hit, stand, dbl) { $("#bjDeal").disabled = !deal; $("#bjHit").disabled = !hit; $("#bjStand").disabled = !stand; $("#bjDouble").disabled = !dbl; }
function endBJ(txt, payout) { $("#bjResult").textContent = txt; enableBJ(true, false, false, false); settle("Blackjack", state.bj.bet, payout, {player: state.bj.player, dealer: state.bj.dealer, result: txt}); state.bj = null; }
$("#bjDeal").addEventListener('click', () => {
  const bet = parseFloat($("#betAmount").value || "0"); if (bet <= 0) return alert("Mise invalide"); if (bet > state.balance) return alert("Solde insuffisant");
  state.bj = {deck: newDeck(), player: [], dealer: [], bet, stage: 'deal', doubled: false};
  state.bj.player.push(dealCard(), dealCard()); state.bj.dealer.push(dealCard(), dealCard());
  $("#bjResult").textContent = '—'; renderBJ(); enableBJ(false, true, true, true);
  const pv = handVal(state.bj.player.map(c => c.rank)); if (pv === 21) { const mult = 2.5 * (1 - state.houseEdge * 0.2); endBJ("Blackjack naturel !", state.bj.bet * mult); }
});
$("#bjHit").addEventListener('click', () => { if (!state.bj) return; state.bj.player.push(dealCard()); renderBJ(); const pv = handVal(state.bj.player.map(c => c.rank)); if (pv > 21) endBJ("Bust du joueur", 0); });
$("#bjStand").addEventListener('click', () => {
  if (!state.bj) return; state.bj.stage = 'resolve'; renderBJ();
  while (handVal(state.bj.dealer.map(c => c.rank)) < 17) { state.bj.dealer.push(dealCard()); }
  renderBJ();
  const pv = handVal(state.bj.player.map(c => c.rank)), dv = handVal(state.bj.dealer.map(c => c.rank));
  let payout = 0, txt = "";
  if (dv > 21 || pv > dv) { txt = "Victoire joueur"; payout = state.bj.bet * (2 * (1 - state.houseEdge * 0.1)); }
  else if (pv === dv) { txt = "Push"; payout = state.bj.bet; } else { txt = "Victoire croupier"; payout = 0; }
  endBJ(txt, payout);
});
$("#bjDouble").addEventListener('click', () => {
  if (!state.bj) return; if (state.bj.doubled) return;
  if (state.bj.bet > state.balance - state.bj.bet) return alert("Solde insuffisant pour doubler.");
  state.bj.bet *= 2; state.bj.doubled = true; state.bj.player.push(dealCard()); renderBJ(); $("#bjHit").disabled = true; $("#bjDouble").disabled = true;
});

// ---------- Draggable Float Stats ----------
(function() {
  const el = $("#floatStats"); const head = el.querySelector('.float-head');
  let offX = 0, offY = 0, dragging = false;
  head.addEventListener('mousedown', e => { dragging = true; offX = e.clientX - el.offsetLeft; offY = e.clientY - el.offsetTop; });
  window.addEventListener('mousemove', e => { if (!dragging) return; el.style.left = (e.clientX - offX) + 'px'; el.style.top = (e.clientY - offY) + 'px'; el.style.right = 'auto'; el.style.bottom = 'auto'; });
  window.addEventListener('mouseup', () => dragging = false);
})();

// ---------- Init ----------
function notify(t) { const el = document.createElement('div'); el.className = 'hist-item'; el.innerHTML = `<span>•</span><span>${t}</span><span></span><span></span><span></span>`; $("#history").prepend(el); }
notify("UI mise à niveau: animations (roulette, slots, dice, plinko, cartes).");
updateHeader(); drawPNL();

