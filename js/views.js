/* ============================================================
   VISTAS  ·  Dale Paz
   Cada función arma el HTML de una pantalla.
   Los clicks se manejan en main.js con data-act="...".
   ============================================================ */

/* ---------- botón de tema claro / oscuro (va en el encabezado de cada pantalla) ---------- */
function themeBtn() {
  return `<button type="button" class="btn-icon theme-btn" data-act="theme" aria-label="${isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}">${ic('circle-half-2')}</button>`;
}

/* ---------- selector numérico (– número +) ---------- */
function stepRow(label, ctx, n, field, value) {
  const mode = (field === 'r' || field === 's') ? 'numeric' : 'decimal';
  const a = esc(n);
  return `<div class="step-row"><span class="step-label">${label}</span>
    <div class="stepper">
      <button type="button" class="btn-icon" data-act="step" data-ctx="${ctx}" data-n="${a}" data-f="${field}" data-d="-1" aria-label="Bajar ${label}">${ic('minus')}</button>
      <div class="num-wrap" data-act="focusnum"><span class="num" contenteditable="true" inputmode="${mode}" enterkeyhint="done" role="spinbutton" aria-label="${label}" data-act="num" data-ctx="${ctx}" data-n="${a}" data-f="${field}">${fmtNum(value)}</span></div>
      <button type="button" class="btn-icon" data-act="step" data-ctx="${ctx}" data-n="${a}" data-f="${field}" data-d="1" aria-label="Subir ${label}">${ic('plus')}</button>
    </div></div>`;
}

/* ============================================================
   RUTINA
   ============================================================ */
function setLabel(s, ex) {
  if (ex.timer) return s.w > 0 ? fmtNum(s.w) + ' kg' : ex.r;
  return (s.w > 0 ? fmtNum(s.w) : '—') + ' × ' + s.r;
}

function cardHTML(ex, pos, total) {
  const n = ex.n, a = esc(n);
  const sets = getSets(n);
  const isDone = sets.every(s => s.d);
  const open = openEx === n;
  const act = activeIdx(sets);
  const wt = gw(n), tags = getTags(n), last = S.lastSets[sk(n)];
  const meta = `${sets.length} × ${ex.r}${wt > 0 ? ' · ' + fmtNum(wt) + ' kg' : ''}`;
  const sub = `Ejercicio ${pos} de ${total}` + (last && last.w > 0 ? ` · última vez ${fmtNum(last.w)} kg${ex.timer ? '' : ' × ' + last.r}` : '');
  const tagLine = tags ? `${tags.lugar} · ${tags.zona} · ${tags.tipo}` : '';

  const left = isDone
    ? `<span class="ck">${ic('check')}</span>`
    : `<span class="drag" data-act="drag" role="button" aria-label="Arrastrar para reordenar">${ic('menu-2')}</span>`;
  const dots = (!isDone) ? `<span class="dots">${sets.map(s => `<i class="dt ${s.d ? 'ok' : ''}"></i>`).join('')}</span>` : '';

  let body = '';
  if (open) {
    const setBtns = sets.map((s, i) => {
      const cls = s.d ? 'ok' : (i === act ? 'next' : 'later');
      return `<button type="button" class="set ${cls}" data-act="set" data-n="${a}" data-i="${i}" aria-pressed="${s.d}" aria-label="Serie ${i + 1}${s.d ? ' hecha' : ''}">
        <span class="set-n">${s.d ? ic('check') : ''}${i + 1}</span><span class="set-v">${esc(setLabel(s, ex))}</span></button>`;
    }).join('');
    let editor;
    if (act >= 0) {
      const s = sets[act];
      editor = `<div class="editor">
        <div class="editor-head"><b>Serie ${act + 1}</b><span class="caption">Ajustá antes de marcar</span></div>
        ${stepRow('Peso (kg)', 'ex', n, 'w', s.w)}
        ${ex.timer ? '' : stepRow('Repeticiones', 'ex', n, 'r', s.r)}
      </div>`;
    } else {
      editor = `<div class="complete-note">Ejercicio completo. Tocá una serie para editarla.</div>`;
    }
    const t = tState(n);
    const presets = [[45, '45 s'], [60, '1 min'], [75, '1:15'], [90, '1:30']]
      .map(([s, l]) => `<button type="button" class="pre ${t.preset === s ? 'sel' : ''}" data-act="preset" data-n="${a}" data-s="${s}">${l}</button>`).join('');
    body = `<div class="xc-body">
      <div class="sets">${setBtns}</div>
      ${editor}
      <div class="xc-actions">
        <button type="button" class="btn btn-secondary btn-lg tm-btn ${t.running ? 'is-active' : ''}" data-act="timer" data-n="${a}">${ic('stopwatch')}<span class="tm-label">${timerLabel(n, ex)}</span></button>
        <button type="button" class="btn btn-secondary btn-lg" data-act="media" data-n="${a}">${ic('photo')}Ver técnica</button>
      </div>
      <div class="presets" role="group" aria-label="Duración"><span class="caption">Duración</span>${presets}</div>
    </div>`;
  }

  return `<div class="xc ${open ? 'open' : ''} ${isDone ? 'is-done' : ''}" data-n="${a}">
    <div class="xc-head" data-act="toggle" data-n="${a}" role="button" tabindex="0" aria-expanded="${open}">
      ${left}
      <div class="xc-text">
        <p class="xc-name">${esc(n)}</p>
        <p class="xc-meta">${esc(meta)}</p>
        <p class="xc-sub">${esc(sub)}</p>
        ${tagLine ? `<p class="xc-tags">${esc(tagLine)}</p>` : ''}
      </div>
      <span class="xc-right">${dots}${ic(open ? 'chevron-up' : 'chevron-down')}</span>
    </div>
    ${body}
  </div>`;
}

function renderWorkout() {
  const root = $('#view-workout');
  const { w, d } = cur;
  const order = getSessionOrder();
  const exMap = Object.fromEntries(sessExs().map(e => [e.n, e]));
  const undone = order.filter(n => !isChecked(n));
  const done = order.filter(n => isChecked(n));
  const shown = [...undone, ...done];
  if (openEx && !shown.includes(openEx)) openEx = null;

  let totalSets = 0, doneSets = 0; const pcts = [];
  shown.forEach(n => { const s = getSets(n); totalSets += s.length; const k = s.filter(x => x.d).length; doneSets += k; pcts.push(k / s.length); });
  pcts.sort((a, b) => b - a);

  const phase = calcPhase(), pm = phaseMeta(phase);
  const chip = `<button type="button" class="chip chip-btn" data-act="phase-open" aria-label="Ver fase del ciclo"><i class="dot" style="${pm ? 'background:' + pm.color : ''}"></i>${pm ? pm.name : 'Ciclo'}</button>`;
  const cardio = R[w][d].cardio;

  root.innerHTML = `
    <div class="top-row"><h1 class="title">Rutina</h1><div class="top-actions">${chip}${themeBtn()}</div></div>
    <div>
      <div class="segs" style="grid-template-columns:repeat(${pcts.length},1fr)">${pcts.map(p => `<i><b style="width:${Math.round(p * 100)}%"></b></i>`).join('')}</div>
      <button type="button" class="prog-cap" data-act="goto" data-view="progress">Semana ${w} · Entrenamiento ${d} · series ${doneSets} de ${totalSets}${ic('chevron-right')}</button>
    </div>
    <div class="xc-list" id="xc-list">${undone.map(n => cardHTML(exMap[n], shown.indexOf(n) + 1, shown.length)).join('')}</div>
    <button type="button" class="btn btn-secondary btn-lg btn-block" data-act="add-routine">${ic('plus')}Agregar ejercicio</button>
    ${done.length ? `<p class="section-label">Hechos · ${done.length}</p>
      <div class="xc-list">${done.map(n => cardHTML(exMap[n], shown.indexOf(n) + 1, shown.length)).join('')}</div>` : ''}
    ${cardio ? `<div class="card cardio"><p class="caption">Cardio</p><p class="xc-name">${esc(cardio.n)}</p><p class="xc-meta">${esc(cardio.d)}</p></div>` : ''}
  `;
  timerTick();
  if ($$('.tm-btn').some(b => tState(b.dataset.n).running)) ensureTicker();
}

/* Actualiza números sin reemplazar botones (evita perder el toque en los selectores). */
function refreshValues(n) {
  const card = $$('.xc').find(c => c.dataset.n === n); if (!card) return;
  const ex = getEx(n), sets = getSets(n), act = activeIdx(sets);
  $$('.set', card).forEach((b, i) => { if (sets[i]) b.querySelector('.set-v').textContent = setLabel(sets[i], ex); });
  if (act >= 0) {
    $$('.num', card).forEach(el => {
      if (document.activeElement === el) return;
      el.textContent = fmtNum(sets[act][el.dataset.f]);
    });
  }
  const wt = gw(n);
  $('.xc-meta', card).textContent = `${sets.length} × ${ex.r}${wt > 0 ? ' · ' + fmtNum(wt) + ' kg' : ''}`;
}

/* ============================================================
   PROGRESO
   ============================================================ */
let openWeek = null;

function ringSVG() {
  const cx = 50, cy = 50, r = 40;
  const pt = a => { const t = a * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; };
  let paths = '';
  for (let w = 1; w <= 8; w++) {
    const ws = -90 + (w - 1) * 45 + 3, span = (45 - 6 - 2) / 2;
    for (let d = 1; d <= 2; d++) {
      const a0 = ws + (d - 1) * (span + 2), a1 = a0 + span;
      const [x0, y0] = pt(a0), [x1, y1] = pt(a1);
      const cls = isSessDone(w, d) ? 'd' : (w === cur.w && d === cur.d ? 'c' : 'p');
      paths += `<path class="${cls}" d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}"/>`;
    }
  }
  return paths;
}

function renderProgress() {
  const root = $('#view-progress');
  const done = Object.values(S.doneSessions).filter(Boolean).length;
  const pct = Math.round(done / 16 * 100);
  if (openWeek === undefined) openWeek = cur.w;

  let weeks = '';
  for (let w = 1; w <= 8; w++) {
    const dn = [1, 2].filter(d => isSessDone(w, d)).length;
    if (openWeek === w) {
      weeks += `<div class="week-open">
        <button type="button" class="week-open-head" data-act="week" data-w="${w}" aria-expanded="true"><span class="h2">Semana ${w}</span><span class="r"><span class="caption">${dn} de 2</span>${ic('chevron-up')}</span></button>
        ${[1, 2].map(d => {
          const isD = isSessDone(w, d), isC = (w === cur.w && d === cur.d);
          return `<div class="srow ${isD ? 'is-done' : ''} ${isC ? 'is-current' : ''}">
            <button type="button" class="mark ${isD ? 'ok' : ''}" data-act="mark" data-w="${w}" data-d="${d}" role="checkbox" aria-checked="${isD}" aria-label="Entrenamiento ${d} de la semana ${w}">${'<b>' + (isD ? ic('check') : '') + '</b>'}</button>
            <button type="button" class="srow-main" data-act="open-session" data-w="${w}" data-d="${d}"><span class="t"><span class="a" style="display:block">Entrenamiento ${d}</span><span class="b" style="display:block">${esc(getTopZones(w, d).join(' · '))}</span></span>${ic('chevron-right')}</button>
          </div>`;
        }).join('')}
      </div>`;
    } else {
      weeks += `<button type="button" class="week" data-act="week" data-w="${w}" aria-expanded="false">
        <span class="n">Semana ${w}</span>
        <span class="dots">${[1, 2].map(d => `<i class="dt ${isSessDone(w, d) ? 'ok' : ''}"></i>`).join('')}</span>
        <span class="cnt">${dn} de 2</span>${ic('chevron-down')}</button>`;
    }
  }

  root.innerHTML = `
    <div class="top-row"><h1 class="title">Progreso</h1>${themeBtn()}</div>
    <div class="card"><div class="hero-p">
      <div class="ring"><svg viewBox="0 0 100 100" role="img" aria-label="${done} de 16 entrenamientos completados">${ringSVG()}</svg><div class="ct">${done}</div></div>
      <div class="hero-p-text"><p class="a">de 16 entrenamientos</p><p class="b">${pct}% del plan completado</p><p class="caption" style="margin-top:2px">Semana ${cur.w} de 8</p></div>
    </div></div>
    <p class="h2" style="margin-top:4px">Semanas</p>
    ${weeks}`;
}

/* ============================================================
   HISTORIAL
   ============================================================ */
let histSel = null;

function histOf(n) { return (S.weightHistory[sk(n)] || []).filter(p => p.v > 0).sort((a, b) => a.d.localeCompare(b.d)); }
function curWeight(n) { const h = histOf(n); return h.length ? h[h.length - 1].v : (S.weights[sk(n)] || 0); }

function niceTicks(min, max) {
  const raw = ((max - min) || 1) / 3;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  let step = mag;
  for (const m of [1, 2, 2.5, 5, 10]) { if (m * mag >= raw) { step = m * mag; break; } }
  const out = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 100) / 100);
  return out;
}

function chartSVG(hist, W) {
  const H = 160, pad = { t: 26, r: 14, b: 28, l: 34 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const vals = hist.map(p => p.v), minV = Math.min(...vals), maxV = Math.max(...vals);
  const span = (maxV - minV) || maxV * 0.2 || 10;
  const yLo = minV - span * 0.25, yHi = maxV + span * 0.25;
  const n = hist.length;
  const xOf = i => pad.l + (n === 1 ? cw / 2 : i / (n - 1) * cw);
  const yOf = v => pad.t + (1 - (v - yLo) / (yHi - yLo)) * ch;
  let g = '';
  niceTicks(yLo, yHi).slice(0, 4).forEach(v => {
    const y = yOf(v).toFixed(1);
    g += `<line x1="${pad.l}" y1="${y}" x2="${W - pad.r}" y2="${y}" class="gl"/><text x="${pad.l - 8}" y="${(+y + 4).toFixed(1)}" text-anchor="end" class="ax">${fmtNum(v)}</text>`;
  });
  const pts = hist.map((p, i) => `${xOf(i).toFixed(1)},${yOf(p.v).toFixed(1)}`).join(' ');
  if (n > 1) g += `<polyline points="${pts}" class="ln"/>`;
  hist.forEach((p, i) => { if (i < n - 1) g += `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.v).toFixed(1)}" r="3.5" class="dp"/>`; });
  const lx = xOf(n - 1), ly = yOf(hist[n - 1].v);
  g += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="6" class="lp"/>`;
  g += `<text x="${(n === 1 ? lx : lx + 2).toFixed(1)}" y="${Math.max(12, ly - 12).toFixed(1)}" text-anchor="${n === 1 ? 'middle' : 'end'}" class="lv">${fmtNum(hist[n - 1].v)} kg</text>`;
  const idxs = n === 1 ? [0] : (n <= 4 ? hist.map((_, i) => i) : [0, Math.floor(n / 2), n - 1]);
  idxs.forEach(i => {
    const anchor = n === 1 ? 'middle' : (i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle'));
    g += `<text x="${xOf(i).toFixed(1)}" y="${H - 6}" text-anchor="${anchor}" class="ax">${fmtDate(hist[i].d)}</text>`;
  });
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del peso">${g}</svg>`;
}

/* Detalle del último día registrado, leído de las series. */
function lastSessionCaption(h) {
  const l = h.length ? h[h.length - 1] : null;
  if (!l || (!l.n && !l.vol)) return '';
  const partes = [];
  if (l.n) partes.push(`${l.n} serie${l.n > 1 ? 's' : ''}${l.r ? ` × ${l.r} reps` : ''}`);
  if (l.vol) partes.push(`${fmtNum(l.vol)} kg de volumen`);
  return `<p class="caption" style="margin-top:2px">Último: ${partes.join(' · ')}</p>`;
}

function historyRows() {
  const names = new Set(getAllExNames().filter(n => curWeight(n) > 0));
  Object.keys(S.weights).filter(k => S.weights[k] > 0).forEach(k => names.add(k.replace(/^ex_/, '').replace(/_/g, ' ')));
  const rows = [...names].map(n => {
    const h = histOf(n), last = h.length ? h[h.length - 1] : null;
    return { n, w: curWeight(n), date: last ? last.d : null, r: last && last.r, sets: last && last.n };
  }).filter(r => r.w > 0);
  rows.sort((a, b) => (a.date && b.date) ? b.date.localeCompare(a.date) : (a.date ? -1 : (b.date ? 1 : a.n.localeCompare(b.n))));
  return rows;
}

function renderHistory() {
  const root = $('#view-history');
  const rows = historyRows();
  if (!histSel || !rows.some(r => r.n === histSel)) histSel = rows.length ? rows[0].n : null;
  const q = ($('#hist-q') && $('#hist-q').value) || '';

  let detail = '';
  if (histSel) {
    const h = histOf(histSel);
    const curW = curWeight(histSel);
    let chip = '';
    if (h.length >= 2) {
      const diff = Math.round((h[h.length - 1].v - h[0].v) * 10) / 10;
      if (diff !== 0) chip = `<span class="chip">${ic(diff > 0 ? 'trending-up' : 'trending-down')}${diff > 0 ? '+' : '−'}${fmtNum(Math.abs(diff))} kg</span>`;
    }
    detail = `<div class="card detail">
      <div><p class="display" style="font-size:20px;line-height:1.25">${esc(histSel)}</p>
        <p class="caption" style="margin-top:2px">${h.length ? `${h.length} registro${h.length > 1 ? 's' : ''} · desde el ${fmtDate(h[0].d)}` : 'Sin registros todavía'}</p>
        ${lastSessionCaption(h)}</div>
      <div class="top-row"><div class="detail-val"><span class="big">${fmtNum(curW)}</span><span class="u">kg</span></div>${chip}</div>
      <div class="chart" id="hist-chart">${h.length ? '' : `<p class="chart-empty">${curW > 0 ? 'Registrá más entrenamientos para ver la evolución.' : 'Todavía no hay pesos guardados.'}</p>`}</div>
    </div>`;
  }

  root.innerHTML = `
    <div class="top-row"><h1 class="title">Historial</h1>${themeBtn()}</div>
    <div class="search-wrap" id="hist-wrap">
      <label class="search">${ic('search')}<input id="hist-q" type="text" placeholder="Buscar ejercicio" autocomplete="off" value="${esc(q)}" aria-label="Buscar ejercicio"></label>
      <div class="dropdown hidden" id="hist-dd"></div>
    </div>
    ${detail}
    ${rows.length ? `<p class="section-label">Ejercicios con peso registrado</p>` : ''}
    ${rows.length ? rows.map(r => `<button type="button" class="hrow ${r.n === histSel ? 'is-selected' : ''}" data-act="hist-select" data-n="${esc(r.n)}">
        <span class="t"><span class="a" style="display:block">${esc(r.n)}</span><span class="b" style="display:block">${[r.date ? fmtDate(r.date) : '', r.sets ? `${r.sets} serie${r.sets > 1 ? 's' : ''}${r.r ? ` × ${r.r}` : ''}` : ''].filter(Boolean).join(' · ')}</span></span><span class="w">${fmtNum(r.w)} kg</span></button>`).join('')
      : `<div class="empty-state">Todavía no hay pesos guardados.</div>`}
    <button type="button" class="btn btn-secondary btn-lg btn-block" data-act="add-history">${ic('plus')}Agregar ejercicio</button>
  `;
  drawChart();
}

function drawChart() {
  const box = $('#hist-chart');
  if (!box || !histSel) return;
  const h = histOf(histSel);
  if (!h.length) return;
  box.innerHTML = chartSVG(h, Math.max(220, Math.floor(box.clientWidth) || 274));
}

function filterDropdown(q) {
  const dd = $('#hist-dd'); if (!dd) return;
  const names = getAllExNames().filter(n => !q || n.toLowerCase().includes(q.toLowerCase()));
  dd.innerHTML = names.length
    ? names.map(n => `<button type="button" data-act="hist-select" data-n="${esc(n)}">${esc(n)}</button>`).join('')
    : '<div class="empty">Sin resultados</div>';
}

/* ============================================================
   CICLO
   ============================================================ */
function cycleBarHTML(showToday) {
  const today = cycleDay(), len = getCycleLength();
  let html = '';
  for (let d = 1; d <= len; d++) {
    const isToday = showToday && today === d;
    html += `<i class="${isToday ? 'today' : ''}" ${isToday ? '' : `style="background:${phaseMeta(phaseOfDay(d)).color}"`}></i>`;
  }
  return html;
}

function cycleSummaryHTML() {
  const phase = calcPhase(), pm = phaseMeta(phase);
  if (!pm) {
    return { empty: true, html: `<p class="cyc-desc">Cargá la fecha de inicio de tu último período para calcular la fase automáticamente.</p>` };
  }
  const manual = !!S.manualPhase, day = cycleDay();
  const detail = PHASE_DETAIL[phase];
  return {
    empty: false, pm, manual, day,
    chipText: manual ? 'Ajustada a mano' : (day ? `Día ${day} de ${getCycleLength()}` : ''),
    bar: `<div><div class="cyc-bar">${cycleBarHTML(!manual)}</div><div class="cyc-ends"><span class="caption">Día 1</span><span class="caption">Día ${getCycleLength()}</span></div></div>`,
    desc: detail.desc,
    advice: `<div class="advice">${ic(pm.icon)}<div><p class="caption">Recomendado</p><p class="a">${esc(adviceText(phase))}</p></div></div>`
  };
}

function renderCiclo() {
  const root = $('#view-ciclo');
  const sm = cycleSummaryHTML();
  const phase = calcPhase();
  const hero = sm.empty
    ? `<div class="card cyc-hero">${sm.html}</div>`
    : `<div class="card cyc-hero">
        <div class="top-row"><div class="cyc-title"><span class="pdot" style="background:${sm.pm.color}"></span><p class="display">${sm.pm.title}</p></div>${sm.chipText ? `<span class="chip">${sm.chipText}</span>` : ''}</div>
        ${sm.bar}<hr class="hr"><p class="cyc-desc">${esc(sm.desc)}</p>${sm.advice}
        ${sm.manual && S.cycleStartDate ? `<button type="button" class="link-btn" data-act="cyc-auto">Volver al cálculo automático</button>` : ''}
      </div>`;

  root.innerHTML = `
    <div class="top-row"><h1 class="title">Mi ciclo</h1>${themeBtn()}</div>
    ${hero}
    ${cycleStatsHTML()}
    <div><p class="section-label" style="margin-top:4px">Ajustar fase</p><p class="caption" style="margin-top:2px">Se calcula sola con tus períodos. Tocá otra para cambiarla.</p></div>
    <div class="tiles">${PHASES.map(p => `<button type="button" class="tile ${p.id === phase ? 'is-selected' : ''}" data-act="cyc-phase" data-p="${p.id}"><span class="n"><span class="pdot" style="background:${p.color}"></span>${p.name}</span><span class="h">${phaseRange(p.id)}</span></button>`).join('')}</div>
    <p class="section-label">Registrar inicio de período</p>
    <div class="date-row"><input type="date" class="field" id="cyc-date" value="${todayISO()}" max="${todayISO()}" aria-label="Inicio de período"><button type="button" class="btn btn-primary" data-act="cyc-save">Agregar</button></div>
    ${periodListHTML()}
  `;
}

/* Tarjetas de estadística: cuánto falta, tu promedio real y el próximo estimado. */
function cycleStatsHTML() {
  const day = cycleDay();
  if (day == null) return '';
  const len = getCycleLength(), falta = daysUntilNext(), n = cycleLengths().length;
  let faltaVal, faltaLbl;
  if (falta > 0) { faltaVal = falta; faltaLbl = falta === 1 ? 'día para el próximo' : 'días para el próximo'; }
  else if (falta === 0) { faltaVal = 'Hoy'; faltaLbl = 'te toca hoy'; }
  else { faltaVal = -falta; faltaLbl = falta === -1 ? 'día de atraso' : 'días de atraso'; }
  const base = n ? `promedio de tus últimos ${n} ciclo${n > 1 ? 's' : ''}` : 'estimado · registrá otro período para afinarlo';
  const tile = (v, l) => `<div class="tile"><span class="n">${v}</span><span class="h" style="padding-left:0">${l}</span></div>`;
  return `<div class="tiles">
      ${tile(day, 'día del ciclo')}${tile(faltaVal, faltaLbl)}
      ${tile(len, 'días de ciclo · ' + base)}${tile(fmtDate(nextExpected()), 'próximo estimado')}
    </div>
    <button type="button" class="btn btn-primary btn-lg btn-block" data-act="cyc-today">Me vino hoy</button>`;
}

/* Historial de períodos, con el intervalo entre cada uno. */
function periodListHTML() {
  const cs = S.cycleStarts || [];
  if (!cs.length) return '';
  const rev = [...cs].reverse();
  return `<p class="section-label">Mis períodos</p>` + rev.map((d, i) => {
    const prev = rev[i + 1];
    const len = prev ? daysBetween(prev, d) : null;
    const raro = len !== null && (len < MIN_CYCLE || len > MAX_CYCLE);
    const sub = len === null ? 'primer registro'
      : `${len} días desde el anterior${raro ? ' · fuera de rango, no cuenta para el promedio' : ''}`;
    return `<div class="hrow"><span class="t"><span class="a" style="display:block">${fmtDate(d)}</span><span class="b" style="display:block">${sub}</span></span>`
      + `<button type="button" class="btn btn-icon" data-act="cyc-del" data-d="${d}" aria-label="Borrar período del ${fmtDate(d)}">${ic('x')}</button></div>`;
  }).join('');
}

/* ---------- todo ---------- */
function renderChip() { /* el chip vive dentro de renderWorkout */ }
function renderAll() {
  const v = currentView;
  if (v === 'progress') renderProgress();
  if (v === 'workout') renderWorkout();
  if (v === 'history') renderHistory();
  if (v === 'ciclo') renderCiclo();
}
