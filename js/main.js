/* ============================================================
   PRINCIPAL  ·  Dale Paz
   Navegación, eventos (data-act), edición de números,
   arrastrar para reordenar, aviso de guardado e inicio.
   ============================================================ */

let currentView = 'progress';

function showView(v, opts = {}) {
  currentView = v;
  ['progress', 'workout', 'history', 'ciclo'].forEach(id => {
    $('#view-' + id).classList.toggle('hidden', id !== v);
    const nb = $('#nav-' + id);
    nb.classList.toggle('active', id === v);
    nb.setAttribute('aria-current', id === v ? 'page' : 'false');
  });
  if (v === 'progress') { if (!opts.keepWeek) openWeek = cur.w; renderProgress(); }
  if (v === 'workout') {
    if (!opts.keepOpen) openEx = getSessionOrder().find(n => !isChecked(n)) || null;   // abre el primer pendiente
    renderWorkout();
  }
  if (v === 'history') renderHistory();
  if (v === 'ciclo') renderCiclo();
  if (!opts.noScroll) window.scrollTo(0, 0);
}

/* ---------- aviso de guardado ---------- */
let toastTimer = null;
function setStatus(s) {
  const t = $('#toast'); clearTimeout(toastTimer);
  if (s === 'ok') {
    t.textContent = '✓ Guardado'; t.className = 'toast'; t.hidden = false;
    toastTimer = setTimeout(() => { t.hidden = true; }, 1600);
  } else if (s === 'err') {
    t.textContent = '⚠ Sin sincronizar · tocá para reintentar'; t.className = 'toast err'; t.hidden = false;
  } else if (s === 'conflict') {
    t.textContent = '⚠ Otro dispositivo · tocá para resolver'; t.className = 'toast err is-conflict'; t.hidden = false;
  } else { if (!t.classList.contains('err')) t.hidden = true; }
}

/* ---------- números editables ---------- */
function applyValue(ctx, n, f, raw, el) {
  if (ctx === 'ex') {
    const val = setActiveValue(n, f, raw);
    if (val === undefined) return;
    if (el) el.textContent = fmtNum(val);
    refreshValues(n);
  } else {
    const c = sheetCtx; if (!c) return;
    c[f] = f === 'w' ? Math.max(0, Math.round(raw * 10) / 10) : Math.max(1, Math.round(raw));
    if (el) el.textContent = fmtNum(c[f]);
  }
}
function currentValue(ctx, n, f) {
  if (ctx === 'ex') { const s = getSets(n), k = activeIdx(s); return k >= 0 ? s[k][f] : 0; }
  return sheetCtx ? sheetCtx[f] : 0;
}
document.addEventListener('focusin', e => {
  const el = e.target.closest && e.target.closest('.num'); if (!el) return;
  const r = document.createRange(); r.selectNodeContents(el);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
});
document.addEventListener('focusout', e => {
  const el = e.target.closest && e.target.closest('.num'); if (!el) return;
  applyValue(el.dataset.ctx, el.dataset.n, el.dataset.f, parseNum(el.textContent), el);
});
document.addEventListener('keydown', e => {
  const el = e.target.closest && e.target.closest('.num');
  if (el && e.key === 'Enter') { e.preventDefault(); el.blur(); return; }
  const head = e.target.closest && e.target.closest('.xc-head');
  if (head && e.target === head && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); head.click(); }
});
document.addEventListener('beforeinput', e => {
  if (!e.target.closest || !e.target.closest('.num')) return;
  if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') { e.preventDefault(); return; }
  if (e.data && /[^\d.,]/.test(e.data)) e.preventDefault();
});
document.addEventListener('paste', e => {
  if (!e.target.closest || !e.target.closest('.num')) return;
  e.preventDefault();
  document.execCommand('insertText', false, (e.clipboardData.getData('text') || '').replace(/[^\d.,]/g, ''));
});

/* ---------- clicks ---------- */
document.addEventListener('click', e => {
  // cerrar el desplegable de búsqueda al tocar afuera
  const dd = $('#hist-dd');
  if (dd && !dd.classList.contains('hidden') && !e.target.closest('#hist-wrap')) dd.classList.add('hidden');

  const t = e.target.closest('[data-act]'); if (!t) return;
  const a = t.dataset.act, n = t.dataset.n;
  switch (a) {
    case 'nav': showView(t.dataset.view); break;
    case 'goto': showView(t.dataset.view); break;
    case 'goto-close': closeSheet(); showView(t.dataset.view); break;
    case 'sheet-close': closeSheet(); break;

    /* rutina */
    case 'toggle': {
      openEx = openEx === n ? null : n;
      renderWorkout();
      const c = $$('.xc').find(x => x.dataset.n === n);
      if (c && openEx === n) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      break;
    }
    case 'set': toggleSet(n, +t.dataset.i); renderWorkout(); break;
    case 'step': {
      const f = t.dataset.f, ctx = t.dataset.ctx;
      const step = f === 'w' ? WEIGHT_STEP : 1;
      const next = currentValue(ctx, n, f) + (+t.dataset.d) * step;
      applyValue(ctx, n, f, next, t.closest('.stepper').querySelector('.num'));
      break;
    }
    case 'focusnum': { const el = t.querySelector('.num'); if (el) el.focus(); break; }
    case 'timer': timerAction(n); break;
    case 'preset': setPreset(n, +t.dataset.s); break;
    case 'media': openMediaSheet(n); break;
    case 'add-routine': openAddSheet('routine'); break;
    case 'add-history': openAddSheet('history'); break;
    case 'add-confirm': confirmAdd(); break;
    case 'phase-open': openPhaseSheet(); break;
    case 'theme': { const next = isDark() ? 'light' : 'dark'; localStorage.setItem('gym_theme', next); applyTheme(next); break; }

    /* progreso */
    case 'week': { const w = +t.dataset.w; openWeek = openWeek === w ? null : w; renderProgress(); break; }
    case 'mark': toggleSessDone(+t.dataset.w, +t.dataset.d); renderProgress(); break;
    case 'open-session': cur.w = +t.dataset.w; cur.d = +t.dataset.d; showView('workout'); break;

    /* historial */
    case 'hist-select': {
      histSel = n;
      const q = $('#hist-q'); if (q) q.value = '';
      renderHistory(); window.scrollTo(0, 0);
      break;
    }

    /* ciclo */
    case 'cyc-phase': S.manualPhase = t.dataset.p; Store.save(); renderCiclo(); break;
    case 'cyc-auto': S.manualPhase = null; Store.save(); renderCiclo(); break;
    case 'cyc-save': {
      const v = $('#cyc-date').value;
      if (!registerPeriodStart(v)) break;      // fecha inválida o futura
      renderCiclo(); break;
    }
    case 'cyc-today': registerPeriodStart(todayISO()); renderCiclo(); break;
    case 'cyc-del': {
      const d = t.dataset.d;
      if (confirm('¿Borrar el período del ' + fmtDate(d) + '?')) { deletePeriodStart(d); renderCiclo(); }
      break;
    }
    case 'fr-save': {
      registerPeriodStart($('#fr-date').value);
      closeSheet(); renderAll(); break;
    }
    case 'pd-save': {
      if (!registerPeriodStart($('#pd-date').value)) break;
      closeSheet(); renderAll(); break;
    }
    case 'pd-snooze':
      S.periodPromptedOn = todayISO(); Store.save(); closeSheet(); break;
  }
});

/* ---------- buscador de Historial ---------- */
document.addEventListener('focusin', e => {
  if (e.target.id === 'hist-q') { filterDropdown(e.target.value); $('#hist-dd').classList.remove('hidden'); }
});
document.addEventListener('input', e => {
  if (e.target.id === 'hist-q') { filterDropdown(e.target.value); $('#hist-dd').classList.remove('hidden'); }
  if (e.target.id === 'fr-date') updateFirstRunPreview();
  if (e.target.id === 'add-name' && sheetCtx) sheetCtx.name = e.target.value;
});
window.addEventListener('resize', () => { if (currentView === 'history') drawChart(); });

/* ---------- arrastrar para reordenar ---------- */
let drag = null;
function dragPlace(y) {
  const card = drag.card, rect = card.getBoundingClientRect();
  const natural = rect.top - drag.ty;
  drag.ty = y - drag.grab - natural;
  card.style.transform = `translateY(${drag.ty}px)`;
}
function dragStep(y) {
  dragPlace(y);
  const card = drag.card, rect = card.getBoundingClientRect(), center = rect.top + rect.height / 2;
  const next = card.nextElementSibling, prev = card.previousElementSibling;
  if (next && next.classList.contains('xc')) {
    const r = next.getBoundingClientRect();
    if (center > r.top + r.height / 2) { next.after(card); dragPlace(y); }
  } else if (prev && prev.classList.contains('xc')) {
    const r = prev.getBoundingClientRect();
    if (center < r.top + r.height / 2) { prev.before(card); dragPlace(y); }
  }
}
function dragLoop() {
  if (!drag) return;
  const y = drag.lastY;
  if (y < 90) window.scrollBy(0, -12);
  else if (y > window.innerHeight - 130) window.scrollBy(0, 12);
  dragStep(y);
  requestAnimationFrame(dragLoop);
}
document.addEventListener('pointerdown', e => {
  const h = e.target.closest && e.target.closest('[data-act="drag"]'); if (!h) return;
  const card = h.closest('.xc'), list = card && card.parentElement; if (!card || !list) return;
  e.preventDefault();
  const open = $('.xc.open');
  if (open) { open.classList.remove('open'); openEx = null; }       // al arrastrar, todas quedan cerradas
  const rect = card.getBoundingClientRect();
  drag = { card, list, handle: h, pid: e.pointerId, ty: 0, lastY: e.clientY, grab: Math.min(Math.max(e.clientY - rect.top, 10), rect.height - 10) };
  try { h.setPointerCapture(e.pointerId); } catch (_) {}
  card.classList.add('dragging'); list.classList.add('is-dragging');
  dragPlace(e.clientY);
  requestAnimationFrame(dragLoop);
});
document.addEventListener('pointermove', e => {
  if (!drag || e.pointerId !== drag.pid) return;
  e.preventDefault();
  drag.lastY = e.clientY;
  dragStep(e.clientY);
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.pid)) return;
  const { card, list, handle, pid } = drag;
  const names = $$('.xc', list).map(c => c.dataset.n);
  card.style.transform = ''; card.classList.remove('dragging'); list.classList.remove('is-dragging');
  try { handle.releasePointerCapture(pid); } catch (_) {}
  drag = null;
  commitOrder(names);
  renderWorkout();
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

/* ---------- tema (claro / oscuro) ---------- */
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const m = $('#theme-color'); if (m) m.content = t === 'dark' ? '#0D0F0A' : '#F5F7F0';
  $$('.theme-btn').forEach(b => b.setAttribute('aria-label', t === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'));
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', ev => {
  if (!localStorage.getItem('gym_theme')) applyTheme(ev.matches ? 'dark' : 'light');
});

/* ---------- inicio ---------- */
(function init() {
  Store.onStatus = setStatus;
  $('#toast').addEventListener('click', () => {
    const t = $('#toast');
    if (t.classList.contains('is-conflict')) Store.resolveConflict();
    else if (t.classList.contains('err')) Store.syncToSheets();
  });
  const local = Store.loadLocal();                 // lo guardado en este teléfono: instantáneo
  Object.assign(cur, firstPendingSession());       // arranca en el primer entrenamiento sin hacer
  openWeek = cur.w;
  showView('progress', { noScroll: true });
  checkFirstRun();
  Store.syncFromRemote(local).then(changed => {    // luego compara con Google Sheets
    if (changed) {
      Object.assign(cur, firstPendingSession());
      if ((lastStart() || S.manualPhase) && $('#fr-date')) closeSheet();
      renderAll();
    }
    checkPeriodDue();                              // recién acá: Sheets puede traer un período más nuevo
  }, () => checkPeriodDue());

  // Si dejás la app abierta varios días, al volver igual avisa
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkPeriodDue();
  });
})();
