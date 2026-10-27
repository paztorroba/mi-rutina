/* ============================================================
   HOJAS Y MODALES  ·  Dale Paz
   Resumen de fase, primer ingreso, agregar ejercicio y técnica.
   ============================================================ */

let sheetCtx = null;     // estado local de la hoja abierta

function openSheet(html, ctx = null) {
  closeSheet();
  sheetCtx = ctx;
  const ov = document.createElement('div');
  ov.className = 'overlay';
  ov.id = 'overlay';
  ov.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grabber"></div>${html}</div>`;
  ov.addEventListener('click', e => { if (e.target === ov) closeSheet(); });
  document.body.appendChild(ov);
  document.body.style.overflow = 'hidden';
}
function closeSheet() {
  const ov = $('#overlay');
  if (ov) ov.remove();
  document.body.style.overflow = '';
  sheetCtx = null;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

/* ---------- resumen de fase (se abre con la etiqueta de Rutina) ---------- */
function openPhaseSheet() {
  const sm = cycleSummaryHTML();
  if (sm.empty) {
    openSheet(`
      <div><p class="sheet-title">Tu ciclo</p><p class="sheet-sub">Cargá la fecha de inicio de tu último período para calcular la fase automáticamente.</p></div>
      <div class="sheet-btns wide"><button type="button" class="btn btn-secondary btn-lg" data-act="sheet-close">Cerrar</button><button type="button" class="btn btn-primary" data-act="goto-close" data-view="ciclo">Cargar fecha</button></div>`);
    return;
  }
  openSheet(`
    <div class="top-row"><div class="cyc-title"><span class="pdot" style="background:${sm.pm.color}"></span><p class="sheet-title">${sm.pm.title}</p></div>${sm.chipText ? `<span class="chip">${sm.chipText}</span>` : ''}</div>
    ${sm.bar}
    <p class="cyc-desc">${esc(sm.desc)}</p>
    ${sm.advice}
    <div class="sheet-btns wide"><button type="button" class="btn btn-secondary btn-lg" data-act="sheet-close">Cerrar</button><button type="button" class="btn btn-primary" data-act="goto-close" data-view="ciclo">Ver mi ciclo</button></div>`);
}

/* ---------- primer ingreso ---------- */
function checkFirstRun() {
  if (lastStart() || S.manualPhase) return;
  const d = new Date(); d.setDate(d.getDate() - 3);
  const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  openSheet(`
    <div><p class="sheet-title" style="font-size:24px">¡Hola!</p>
      <p class="sheet-sub">Para calcular tu fase del ciclo automáticamente, ¿cuándo empezó tu última menstruación?</p></div>
    <div><label class="field-label" for="fr-date">Fecha de inicio</label>
      <input type="date" class="field" id="fr-date" value="${iso}" max="${todayISO()}"></div>
    <div class="preview" id="fr-preview"></div>
    <p class="caption" style="margin-top:-4px">Podés cambiarla después en Mi ciclo.</p>
    <div class="sheet-btns"><button type="button" class="btn btn-secondary btn-lg" data-act="sheet-close">Ahora no</button><button type="button" class="btn btn-primary" data-act="fr-save">Listo</button></div>`);
  updateFirstRunPreview();
}
function updateFirstRunPreview() {
  const inp = $('#fr-date'), box = $('#fr-preview'); if (!inp || !box) return;
  if (!inp.value) { box.innerHTML = ''; return; }
  const day = dayDiff(inp.value) + 1, pm = phaseMeta(phaseOfDay(day));
  box.innerHTML = `<span class="pdot" style="background:${pm.color}"></span><div><p class="caption">Hoy sería</p><p class="a">Día ${day} · ${pm.title}</p></div>`;
}

/* ---------- aviso automático de período ----------
   Aparece al llegar al día esperado según TU promedio. Pregunta una vez por día:
   si decís "todavía no", vuelve mañana, no en el próximo toque. */
function checkPeriodDue() {
  if (!periodIsDue()) return;
  if ($('#overlay')) return;            // no encimar con otro modal
  const falta = daysUntilNext(), atraso = -falta, len = getCycleLength();
  const base = cycleLengths().length ? `tu promedio de ${len} días` : `un ciclo estimado de ${len} días`;
  const texto = atraso === 0
    ? `Según ${base}, hoy es el día en que te tocaría.`
    : `Según ${base}, te tocaba hace ${atraso} ${atraso === 1 ? 'día' : 'días'}.`;
  openSheet(`
    <div><p class="sheet-title" style="font-size:24px">¿Te vino?</p>
      <p class="sheet-sub">${texto} Si ya empezó, registralo y ajusto el cálculo.</p></div>
    <div><label class="field-label" for="pd-date">Primer día del período</label>
      <input type="date" class="field" id="pd-date" value="${todayISO()}" max="${todayISO()}"></div>
    <div class="sheet-btns"><button type="button" class="btn btn-secondary btn-lg" data-act="pd-snooze">Todavía no</button><button type="button" class="btn btn-primary" data-act="pd-save">Sí, registrar</button></div>`);
}

/* ---------- agregar ejercicio (Rutina e Historial) ---------- */
function openAddSheet(mode) {
  const ctx = { mode, name: '', s: 4, r: 10, w: 0 };
  openSheet(addSheetHTML(ctx), ctx);
}
function addSheetHTML(ctx) {
  const routine = ctx.mode === 'routine';
  return `
    <div><p class="sheet-title">Agregar ejercicio</p>
      <p class="sheet-sub" style="font-size:13px">${routine ? 'Se suma al final de este entrenamiento.' : 'Registrá el peso de un ejercicio que no está en tu plan.'}</p></div>
    <div><label class="field-label" for="add-name">Nombre</label>
      <input type="text" class="field" id="add-name" style="width:100%" placeholder="Ej: Elevaciones laterales" autocomplete="off" value="${esc(ctx.name)}"></div>
    ${routine ? stepRow('Series', 'sheet', '_', 's', ctx.s) + stepRow('Repeticiones', 'sheet', '_', 'r', ctx.r) : ''}
    ${stepRow('Peso (kg)', 'sheet', '_', 'w', ctx.w)}
    <div class="sheet-btns"><button type="button" class="btn btn-secondary btn-lg" data-act="sheet-close">Cancelar</button><button type="button" class="btn btn-primary" data-act="add-confirm">Agregar</button></div>`;
}
function confirmAdd() {
  const ctx = sheetCtx; if (!ctx) return;
  const name = ($('#add-name').value || '').trim();
  if (!name) { $('#add-name').focus(); return; }
  if (ctx.mode === 'routine') {
    const n = addRoutineExercise({ name, series: ctx.s, reps: ctx.r, weight: ctx.w });
    closeSheet();
    openEx = n;
    showView('workout', { keepOpen: true });
    setTimeout(() => { const c = $$('.xc').find(x => x.dataset.n === n); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 50);
  } else {
    const n = addHistoryExercise({ name, weight: ctx.w });
    closeSheet();
    histSel = n;
    renderHistory();
  }
}

/* ---------- técnica (imagen del ejercicio) ---------- */
function openMediaSheet(name) {
  const src = IMAGES[name];
  openSheet(`
    <p class="sheet-title">${esc(name)}</p>
    ${src ? `<img class="media-img" id="media-img" src="${esc(encodeURI(src))}" alt="${esc(name)}">` : ''}
    <div class="media-ph ${src ? 'hidden' : ''}" id="media-ph">${ic('photo')}<span>Imagen próximamente</span></div>
    <button type="button" class="btn btn-secondary btn-lg btn-block" data-act="sheet-close">Cerrar</button>`);
  const img = $('#media-img');
  if (img) img.onerror = () => { img.classList.add('hidden'); $('#media-ph').classList.remove('hidden'); };
}
