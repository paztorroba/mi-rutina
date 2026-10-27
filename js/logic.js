/* ============================================================
   LÓGICA  ·  Dale Paz
   Estado de navegación, series por ejercicio, orden, historial,
   cálculo del ciclo y cronómetros. No toca el DOM (salvo timers).
   ============================================================ */

/* ---------- utilidades ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (name, cls = '') => `<svg class="i ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const fmtNum = n => String(Math.round(n * 10) / 10).replace('.', ',');
const parseNum = t => { const v = parseFloat(String(t).replace(',', '.')); return isNaN(v) ? 0 : v; };
const todayISO = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fmtDate = iso => { if (!iso) return ''; const [, m, d] = iso.split('-'); return parseInt(d) + ' ' + MONTHS[parseInt(m) - 1]; };
const fmtDateLong = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return parseInt(d) + ' ' + MONTHS[parseInt(m) - 1] + ' ' + y; };
const isDark = () => document.documentElement.dataset.theme === 'dark';
const WEIGHT_STEP = 1;   // kg que suma/resta el botón + / −

/* ---------- navegación ---------- */
const cur = { w: 1, d: 1 };      // entrenamiento seleccionado
let openEx = null;               // ejercicio desplegado (solo uno)

/* ---------- claves ---------- */
const nk = n => n.replace(/\s+/g, '_');
const sk = n => 'ex_' + nk(n);
const ck = (n, w = cur.w, d = cur.d) => 'chk_w' + w + 'd' + d + '_' + nk(n);
const stKey = (n, w = cur.w, d = cur.d) => 'st_w' + w + 'd' + d + '_' + nk(n);
const sessKey = (w, d) => 'sess_w' + w + 'd' + d;
const csKey = (n, w = cur.w, d = cur.d) => 'cs_w' + w + 'd' + d + '_' + nk(n);
const crKey = (n, w = cur.w, d = cur.d) => 'cr_w' + w + 'd' + d + '_' + nk(n);

const getTags = n => TAGS[n] || null;
const gw = n => S.weights[sk(n)] || 0;
const isSessDone = (w, d) => !!S.doneSessions[sessKey(w, d)];

/* ---------- ejercicios de una sesión (plan + agregados) ---------- */
function sessExs(w = cur.w, d = cur.d) {
  const extras = (S.sessionExtras[sessKey(w, d)] || []).map(e => ({ n: e.n, s: e.s, r: String(e.r), timer: false, extra: true }));
  return [...R[w][d].exs, ...extras];
}
const getEx = (n, w = cur.w, d = cur.d) => sessExs(w, d).find(e => e.n === n);

function exSortPriority(n) {
  const t = getTags(n); if (!t) return 1;
  if (t.lugar === 'Máquina') return 0;
  if (t.tipo === 'Aeróbico') return 2;
  return 1;
}
function getSessionOrder(w = cur.w, d = cur.d) {
  const names = sessExs(w, d).map(e => e.n);
  let order = S.sessionOrders[sessKey(w, d)];
  if (!order) order = [...R[w][d].exs].sort((a, b) => exSortPriority(a.n) - exSortPriority(b.n)).map(e => e.n);
  order = order.filter(n => names.includes(n));
  names.forEach(n => { if (!order.includes(n)) order.push(n); });
  return order;
}
/* Reordena solo los pendientes, respetando las posiciones de los hechos. */
function commitOrder(newUndoneOrder) {
  const order = [...getSessionOrder()];
  const undone = new Set(order.filter(n => !isChecked(n)));
  const positions = order.map((n, i) => undone.has(n) ? i : -1).filter(i => i >= 0);
  positions.forEach((p, k) => { order[p] = newUndoneOrder[k]; });
  S.sessionOrders[sessKey(cur.w, cur.d)] = order;
  Store.save();
}

/* ---------- series ---------- */
const actSeries = (n, ex) => S.customSeries[csKey(n)] ?? (parseInt(ex.s) || 1);
const defReps = (n, ex) => ex.timer ? 0 : (S.customReps[crKey(n)] ?? (parseInt(ex.r) || 1));

/* Devuelve las series (guardadas o "virtuales" si todavía no hubo cambios). */
function getSets(n) {
  const ex = getEx(n);
  const total = actSeries(n, ex);
  let arr = S.sets[stKey(n)];
  if (arr) {
    if (arr.length === total) return arr;
    const fixed = arr.slice(0, total);
    while (fixed.length < total) fixed.push({ d: false, w: arr.length ? arr[arr.length - 1].w : gw(n), r: arr.length ? arr[arr.length - 1].r : defReps(n, ex) });
    return fixed;
  }
  const legacyDone = !!S.checks[ck(n)];          // migra los checks de la versión anterior
  return Array.from({ length: total }, () => ({ d: legacyDone, w: gw(n), r: defReps(n, ex) }));
}
function ensureSets(n) {
  S.sets[stKey(n)] = getSets(n);
  return S.sets[stKey(n)];
}
const isChecked = n => getSets(n).every(s => s.d);
const activeIdx = arr => arr.findIndex(s => !s.d);

/* Recalcula el historial de hoy a partir de las SERIES hechas.
   Guarda el kg más alto (v), las reps de esa serie (r), cuántas series (n) y el
   volumen total del día (vol = suma de kg × reps). Las entradas viejas solo tienen
   v: el resto queda sin definir y la UI lo omite. */
function syncHistory(n) {
  const key = sk(n);
  const done = getSets(n).filter(s => s.d && s.w > 0);
  const mx = Math.max(0, ...done.map(s => s.w));
  const today = todayISO();
  const h = S.weightHistory[key] || (S.weightHistory[key] = []);
  const i = h.findIndex(p => p.d === today);
  if (mx > 0) {
    const top = done.filter(s => s.w === mx);
    const entry = {
      d: today, v: mx,
      r: Math.max(0, ...top.map(s => +s.r || 0)) || undefined,
      n: done.length,
      vol: Math.round(done.reduce((a, s) => a + s.w * (+s.r || 0), 0)) || undefined
    };
    if (i >= 0) Object.assign(h[i], entry); else h.push(entry);
    h.sort((a, b) => a.d.localeCompare(b.d));
  } else if (i >= 0) h.splice(i, 1);
  if (!h.length) delete S.weightHistory[key];
}

function toggleSet(n, i) {
  const arr = ensureSets(n);
  const s = arr[i]; if (!s) return;
  s.d = !s.d;
  if (s.d) {
    for (let j = i + 1; j < arr.length; j++) if (!arr[j].d) { arr[j].w = s.w; arr[j].r = s.r; }   // la próxima arranca con estos valores
    if (s.w > 0) S.weights[sk(n)] = s.w;
    S.lastSets[sk(n)] = { w: s.w, r: s.r, d: todayISO() };
    if (arr.every(x => x.d) && openEx === n) openEx = null;       // al terminar, se cierra y elegís cuál abrir
  } else {
    openEx = n;                                                    // al reabrir una serie, queda desplegado
  }
  syncHistory(n);
  S.checks[ck(n)] = arr.every(x => x.d);
  Store.save();
}

/* Cambia peso o repeticiones de la serie activa (y de las que siguen). */
function setActiveValue(n, field, val) {
  const arr = ensureSets(n);
  const k = activeIdx(arr); if (k < 0) return;
  val = field === 'r' ? Math.max(1, Math.round(val)) : Math.max(0, Math.round(val * 10) / 10);
  for (let j = k; j < arr.length; j++) if (!arr[j].d) arr[j][field] = val;
  Store.save();
  return val;
}

function toggleSessDone(w, d) {
  S.doneSessions[sessKey(w, d)] = !isSessDone(w, d);
  Store.save();
}

/* Agrega un ejercicio al entrenamiento actual. */
function addRoutineExercise({ name, series, reps, weight }) {
  name = name.trim(); if (!name) return null;
  const key = sessKey(cur.w, cur.d);
  if (getEx(name)) { return name; }                         // ya existe en la sesión
  (S.sessionExtras[key] = S.sessionExtras[key] || []).push({ n: name, s: series, r: reps });
  if (!S.extraExercises.includes(name)) S.extraExercises.push(name);
  if (weight > 0) S.weights[sk(name)] = weight;
  Store.save();
  return name;
}
/* Registra un peso para un ejercicio (Historial). */
function addHistoryExercise({ name, weight }) {
  name = name.trim(); if (!name) return null;
  if (!S.extraExercises.includes(name)) S.extraExercises.push(name);
  if (weight > 0) {
    S.weights[sk(name)] = weight;
    const h = S.weightHistory[sk(name)] || (S.weightHistory[sk(name)] = []);
    const today = todayISO(), i = h.findIndex(p => p.d === today);
    if (i >= 0) h[i].v = weight; else h.push({ d: today, v: weight });
  }
  Store.save();
  return name;
}

function getAllExNames() {
  const fromR = [...new Set(Object.values(R).flatMap(w => Object.values(w).flatMap(d => d.exs.map(e => e.n))))].sort((a, b) => a.localeCompare(b));
  const extra = S.extraExercises.filter(n => !fromR.includes(n));
  return [...fromR, ...extra];
}
function getTopZones(w, d) {
  const counts = {};
  R[w][d].exs.forEach(e => { const t = getTags(e.n); if (t) counts[t.zona] = (counts[t.zona] || 0) + 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([z]) => z);
}
/* Primer entrenamiento sin marcar como hecho (para arrancar ahí). */
function firstPendingSession() {
  for (let w = 1; w <= 8; w++) for (let d = 1; d <= 2; d++) if (!isSessDone(w, d)) return { w, d };
  return { w: 8, d: 2 };
}

/* ---------- ciclo ---------- */
const PHASES = [
  { id: 'menstrual', name: 'Menstrual', title: 'Fase menstrual', hint: 'Día 1–5', color: 'var(--phase-menstrual)', icon: 'heart' },
  { id: 'folicular', name: 'Folicular', title: 'Fase folicular', hint: 'Día 6–13', color: 'var(--phase-folicular)', icon: 'trending-up' },
  { id: 'ovulacion', name: 'Ovulación', title: 'Ovulación', hint: 'Día 14', color: 'var(--phase-ovulacion)', icon: 'flame' },
  { id: 'lutea', name: 'Lútea', title: 'Fase lútea', hint: 'Día 15–28', color: 'var(--phase-lutea)', icon: 'moon' }
];
const phaseMeta = id => PHASES.find(p => p.id === id) || null;

/* El largo del ciclo sale del promedio de TUS períodos, no de un 28 fijo: con una sola
   fecha y módulo 28 el cálculo se desfasa a los pocos meses.
   La ovulación se cuenta hacia ATRÁS desde el próximo período, porque la fase lútea dura
   ~14 días casi siempre y la que se estira o acorta es la folicular. En un ciclo de 31
   días ovulás el día 17, no el 14. */
const DEFAULT_CYCLE = 28, LUTEAL_DAYS = 14, MIN_CYCLE = 21, MAX_CYCLE = 40, PERIOD_DAYS = 5, AVG_OVER = 6;

function dayDiff(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const a = new Date(y, m - 1, d), t = new Date();
  return Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()) - a) / 864e5);
}
function daysBetween(a, b) {
  const p = a.split('-').map(Number), q = b.split('-').map(Number);
  return Math.round((new Date(q[0], q[1] - 1, q[2], 12) - new Date(p[0], p[1] - 1, p[2], 12)) / 864e5);
}
function addDays(iso, n) {
  const p = iso.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2], 12);
  d.setDate(d.getDate() + n);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
/* No alcanza el formato: '2026-13-45' lo cumple y rompería todo el cálculo. El estado
   viaja por una hoja de cálculo editable a mano, así que validamos la fecha real. */
function isValidDay(x) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(x || '')) return false;
  const p = x.split('-').map(Number), d = new Date(p[0], p[1] - 1, p[2], 12);
  return d.getFullYear() === p[0] && d.getMonth() === p[1] - 1 && d.getDate() === p[2];
}
function normalizeCycleStarts() {
  if (!Array.isArray(S.cycleStarts)) S.cycleStarts = [];
  if (!S.cycleStarts.length && S.cycleStartDate) S.cycleStarts = [S.cycleStartDate];   // datos de la versión anterior
  S.cycleStarts = [...new Set(S.cycleStarts.filter(isValidDay))].sort();
  S.cycleStartDate = S.cycleStarts.length ? S.cycleStarts[S.cycleStarts.length - 1]
                   : (isValidDay(S.cycleStartDate) ? S.cycleStartDate : null);
}
const lastStart = () => (S.cycleStarts && S.cycleStarts.length) ? S.cycleStarts[S.cycleStarts.length - 1] : S.cycleStartDate;

/* Intervalos imposibles (fecha mal tipeada, o un período sin registrar) no ensucian el promedio. */
function cycleLengths() {
  const out = [];
  for (let i = 1; i < (S.cycleStarts || []).length; i++) {
    const len = daysBetween(S.cycleStarts[i - 1], S.cycleStarts[i]);
    if (len >= MIN_CYCLE && len <= MAX_CYCLE) out.push(len);
  }
  return out;
}
function getCycleLength() {
  const l = cycleLengths().slice(-AVG_OVER);
  return l.length ? Math.round(l.reduce((a, b) => a + b, 0) / l.length) : DEFAULT_CYCLE;
}
const ovulationDay = (len = getCycleLength()) => Math.max(PERIOD_DAYS + 2, len - LUTEAL_DAYS);

/* Sin dar la vuelta: si estás en el día 31 de un ciclo de 28 querés saber que tenés
   3 días de atraso, no que "es el día 3". */
function cycleDay() {
  const st = lastStart();
  if (!st || !isValidDay(st)) return null;
  const d = dayDiff(st) + 1;
  return d > 0 ? d : null;
}
const nextExpected = () => { const st = lastStart(); return st ? addDays(st, getCycleLength()) : null; };
const daysUntilNext = () => { const n = nextExpected(); return n ? -dayDiff(n) : null; };

function phaseOfDay(d, len = getCycleLength()) {
  const ov = ovulationDay(len);
  return d <= PERIOD_DAYS ? 'menstrual' : d < ov ? 'folicular' : d === ov ? 'ovulacion' : 'lutea';
}
/* Rango de días de cada fase adaptado a TU largo de ciclo (para mostrar en la UI). */
function phaseRange(id, len = getCycleLength()) {
  const ov = ovulationDay(len);
  return { menstrual: 'Día 1–' + PERIOD_DAYS, folicular: 'Día ' + (PERIOD_DAYS + 1) + '–' + (ov - 1),
           ovulacion: 'Día ' + ov, lutea: 'Día ' + (ov + 1) + '–' + len }[id] || '';
}
/* La fecha manda; manualPhase es solo el override explícito cuando no hay fecha. */
function calcPhase() {
  const d = cycleDay();
  if (d != null) return phaseOfDay(d);
  return S.manualPhase || null;
}

/* Registrar el inicio de un período: SUMA al historial en vez de pisar la fecha anterior,
   así el largo del ciclo se vuelve más preciso en lugar de desfasarse. */
function registerPeriodStart(iso) {
  if (!isValidDay(iso)) return false;
  if (dayDiff(iso) < 0) return false;                 // no aceptamos fechas futuras
  if (!S.cycleStarts.includes(iso)) S.cycleStarts.push(iso);
  normalizeCycleStarts();
  S.manualPhase = null;
  S.periodPromptedOn = null;                          // ciclo nuevo: se puede volver a preguntar
  Store.save();
  return true;
}
function deletePeriodStart(iso) {
  S.cycleStarts = (S.cycleStarts || []).filter(d => d !== iso);
  if (!S.cycleStarts.length) S.cycleStartDate = null;
  normalizeCycleStarts();
  Store.save();
}
/* ¿Toca avisar? Cuando llegaste al día esperado según TU promedio, una vez por día. */
function periodIsDue() {
  if (!lastStart()) return false;
  if (S.periodPromptedOn === todayISO()) return false;
  const falta = daysUntilNext();
  return falta !== null && falta <= 0;
}
function adviceText(p) {
  const raw = (PHASE_DETAIL[p] && PHASE_DETAIL[p].advice) || '';
  const t = raw.replace(/^[^\p{L}]+/u, '').replace(/^Recomendado:\s*/i, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ---------- cronómetros (usan la hora real: no se frenan con la pantalla bloqueada) ---------- */
const timers = {};
const tKey = n => cur.w + '_' + cur.d + '_' + n;
const tState = n => timers[tKey(n)] || (timers[tKey(n)] = { preset: 45, running: false, startedAt: 0, base: 0 });
const tElapsed = t => t.base + (t.running ? (Date.now() - t.startedAt) / 1000 : 0);
const tRemaining = n => { const t = tState(n); return Math.max(0, Math.ceil(t.preset - tElapsed(t))); };
const fmtClock = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
function timerLabel(n, ex) {
  const t = tState(n);
  const base = ex.timer ? 'Cronómetro' : 'Descanso';
  return tElapsed(t) >= t.preset ? '¡Listo!' : base + ' ' + fmtClock(tRemaining(n));
}
function timerAction(n) {
  const t = tState(n);
  if (t.running) { t.base = tElapsed(t); t.running = false; }
  else { if (tElapsed(t) >= t.preset) t.base = 0; t.startedAt = Date.now(); t.running = true; }
  timerTick(); ensureTicker();
}
function setPreset(n, secs) {
  const t = tState(n); t.preset = secs; t.base = 0; t.running = false;
  timerTick();
}
let _ticker = null;
function ensureTicker() { if (!_ticker) _ticker = setInterval(timerTick, 250); }
function timerTick() {
  let anyRunning = false;
  $$('.tm-btn').forEach(btn => {
    const n = btn.dataset.n, ex = getEx(n); if (!ex) return;
    const t = tState(n);
    if (t.running && tElapsed(t) >= t.preset) {          // terminó
      t.running = false; t.base = t.preset;
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
    }
    if (t.running) anyRunning = true;
    btn.querySelector('.tm-label').textContent = timerLabel(n, ex);
    btn.classList.toggle('is-active', t.running);
  });
  $$('.pre').forEach(p => { const t = tState(p.dataset.n); p.classList.toggle('sel', t.preset === +p.dataset.s); });
  if (!anyRunning && _ticker) { clearInterval(_ticker); _ticker = null; }
}
