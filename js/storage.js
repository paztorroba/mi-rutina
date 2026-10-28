/* ============================================================
   PERSISTENCIA  ·  Dale Paz
   Guarda en el teléfono (localStorage) y en Google Sheets.

   Reglas (corrigen el bug de "vuelve siempre al progreso viejo"):
   - Cada guardado lleva fecha (updatedAt). Siempre gana el dato MÁS NUEVO.
   - La subida a Sheets se VERIFICA leyendo de vuelta: solo muestra
     "Guardado" si de verdad quedó guardado.
   - Si falla, queda marcado como pendiente y se reintenta solo.
   ============================================================ */

// Pegá acá la URL de tu Apps Script publicado como aplicación web.
const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwfb4sq1nLiwBlX8Lh6faMCZITmsV40a-uUr0oFEk4XF44kB4ewTbpcQKAANWqz_bFPwg/exec';

const LS_KEY = 'gym_data';
const LS_DIRTY = 'gym_dirty';

/* Estado de la app. Todo lo que está acá se guarda. */
function defaultState() {
  return {
    weights: {},          // último peso por ejercicio            { ex_Nombre: kg }
    checks: {},           // ejercicio completo por sesión         { chk_w1d1_Nombre: bool }
    doneSessions: {},     // entrenamientos marcados como hechos   { sess_w1d1: bool }
    cycleStartDate: null, // 'YYYY-MM-DD' (derivado: el último de cycleStarts)
    cycleStarts: [],      // historial de inicios de período, ascendente. De acá sale el largo real del ciclo
    periodPromptedOn: null, // día en que ya se preguntó "¿te vino?" (para no repetir)
    manualPhase: null,    // fase elegida a mano
    customSeries: {},     // (compatibilidad) series ajustadas
    customReps: {},       // repeticiones por defecto ajustadas
    sessionOrders: {},    // orden de ejercicios por sesión
    weightHistory: {},    // historial: { ex_Nombre: [{d:'YYYY-MM-DD', v:kg}] } (kg más alto del día)
    extraExercises: [],   // nombres agregados desde Historial/Rutina
    sets: {},             // NUEVO · series por sesión y ejercicio { st_w1d1_Nombre: [{d,w,r}] }
    sessionExtras: {},    // NUEVO · ejercicios agregados a una sesión { sess_w1d1: [{n,s,r}] }
    lastSets: {},         // NUEVO · última serie hecha por ejercicio { ex_Nombre: {w,r,d} }
    updatedAt: 0
  };
}
const S = defaultState();
const STATE_KEYS = Object.keys(defaultState());

/* Claves que esta versión no conoce (p. ej. escritas por una versión más nueva en otro
   dispositivo). Se guardan aparte y se vuelven a escribir tal cual: una versión vieja
   NUNCA debe borrar datos que no entiende. Esto ya pasó una vez y costó un historial. */
let _extra = {};

const Store = {
  onStatus: null,        // callback(estado) para mostrar el aviso
  _syncTimer: null,
  _retryTimer: null,
  _syncing: false,
  _queued: false,

  snapshot() { return JSON.parse(JSON.stringify(Object.assign({}, _extra, S))); },

  apply(snap) {
    const d = defaultState();
    STATE_KEYS.forEach(k => { S[k] = (snap && snap[k] !== undefined && snap[k] !== null) ? snap[k] : d[k]; });
    S.updatedAt = +(snap && snap.updatedAt) || 0;
    _extra = {};
    if (snap) Object.keys(snap).forEach(k => { if (!STATE_KEYS.includes(k)) _extra[k] = snap[k]; });
    if (typeof normalizeCycleStarts === 'function') normalizeCycleStarts();
  },

  /* Cuánto hay registrado. Solo desempata en la migración, cuando ningún lado tiene fecha. */
  size(s) {
    if (!s) return 0;
    let n = 0;
    ['weights','checks','doneSessions','customSeries','customReps','sessionOrders','sets','sessionExtras'].forEach(k => { if (s[k]) n += Object.keys(s[k]).length; });
    if (s.weightHistory) Object.values(s.weightHistory).forEach(h => { n += Array.isArray(h) ? h.length : 0; });
    if (Array.isArray(s.extraExercises)) n += s.extraExercises.length;
    if (Array.isArray(s.cycleStarts)) n += s.cycleStarts.length;
    return n;
  },

  hasData(s) {
    if (!s) return false;
    const objs = ['weights', 'checks', 'doneSessions', 'customSeries', 'customReps', 'weightHistory', 'sets', 'sessionExtras'];
    return objs.some(k => s[k] && Object.keys(s[k]).length) || !!s.cycleStartDate || !!s.manualPhase
      || (s.cycleStarts && s.cycleStarts.length > 0) || (s.extraExercises && s.extraExercises.length > 0);
  },

  saveLocal() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(Store.snapshot())); return true; } catch (e) { return false; }
  },

  pendingRemote: null,

  /* Conflicto: los dos lados tienen versiones distintas y el estado se guarda entero,
     así que no hay forma de fusionarlas. Preguntamos en vez de elegir y perder datos. */
  resolveConflict() {
    if (!Store.pendingRemote) return Store.syncToSheets();
    const quedarse = confirm(
      'Hay datos más nuevos guardados desde otro dispositivo.\n\n' +
      'Aceptar: conservar lo de ESTE teléfono (pisa lo del otro).\n' +
      'Cancelar: traer lo del otro dispositivo (descarta lo de este teléfono).'
    );
    const remote = Store.pendingRemote;
    Store.pendingRemote = null;
    if (quedarse) {
      // Por encima del remoto, si no el backend lo rechaza de nuevo para siempre
      Store.save(+remote.updatedAt || 0);
      clearTimeout(Store._syncTimer);
      Store.syncToSheets();
    } else {
      Store.apply(remote); Store.saveLocal();
      try { localStorage.removeItem(LS_DIRTY); } catch (e) {}
      Store._status('ok');
      if (typeof renderAll === 'function') renderAll();
    }
  },

  /* Llamar después de CADA cambio de estado. minTs: marca mínima a superar. */
  save(minTs) {
    S.updatedAt = Math.max(Date.now(), (+minTs || 0) + 1);
    Store.saveLocal();
    try { localStorage.setItem(LS_DIRTY, '1'); } catch (e) {}
    Store._status('pending');
    clearTimeout(Store._syncTimer);
    Store._syncTimer = setTimeout(Store.syncToSheets, 1200);
  },

  _status(s) { if (Store.onStatus) Store.onStatus(s); },
  _dirty() { return localStorage.getItem(LS_DIRTY) === '1'; },

  /* Sube y verifica leyendo de vuelta. */
  async syncToSheets() {
    if (Store._syncing) { Store._queued = true; return; }
    Store._syncing = true; Store._queued = false;
    clearTimeout(Store._retryTimer);
    Store._status('saving');
    const snap = Store.snapshot();
    let ok = false, conflict = false;
    try {
      await fetch(SHEETS_URL, { method: 'POST', mode: 'no-cors', body: new Blob([JSON.stringify(snap)], { type: 'text/plain' }) });
      // Verificar leyendo de vuelta, pero con REINTENTOS: cada lectura de Apps Script
      // tarda 2-3 segundos y en wifi flojo se pasa del límite. Una lectura que no llega
      // NO significa que no se guardó, y avisar "sin sincronizar" cuando el dato sí subió
      // asusta al pedo. Solo después de tres intentos lo damos por fallado.
      let rT = -1;
      for (let intento = 0; intento < 3; intento++) {
        if (intento) await new Promise(r => setTimeout(r, 800 * intento));
        const remote = await Store.loadFromSheets();
        if (!remote) continue;                       // la lectura no volvió a tiempo
        rT = +remote.updatedAt || 0;
        if (rT === snap.updatedAt) break;            // confirmado
        // El backend rechaza (sin guardar) un envío más viejo que lo que ya tiene, y el
        // dato de vuelta es MÁS nuevo que el nuestro. Eso es un conflicto, no un error.
        if (rT > snap.updatedAt) { conflict = true; Store.pendingRemote = remote; break; }
      }
      ok = (rT === snap.updatedAt);
    } catch (e) { ok = false; }
    Store._syncing = false;
    if (ok && snap.updatedAt === S.updatedAt && !Store._queued) {
      try { localStorage.removeItem(LS_DIRTY); } catch (e) {}
      Store._status('ok');
    } else if (ok || Store._queued) {
      Store.syncToSheets();               // hubo cambios mientras subía
    } else if (conflict) {
      Store._status('conflict');
    } else {
      Store._status('err');
      Store._retryTimer = setTimeout(Store.syncToSheets, 30000);
    }
  },

  /* Envío rápido al cerrar o minimizar la app. */
  flushOnHide() {
    if (!Store._dirty()) return;
    try {
      const body = JSON.stringify(Store.snapshot());
      fetch(SHEETS_URL, { method: 'POST', mode: 'no-cors', keepalive: body.length < 60000, body: new Blob([body], { type: 'text/plain' }) }).catch(() => {});
    } catch (e) {}
  },

  /* Lectura por JSONP (Apps Script no permite CORS). */
  loadFromSheets() {
    return new Promise(resolve => {
      const cb = '_gjcb' + Date.now() + Math.floor(Math.random() * 1e4);
      const script = document.createElement('script');
      let settled = false;
      const finish = data => {
        if (settled) return;
        settled = true; clearTimeout(timer);
        window[cb] = () => {}; script.remove(); resolve(data);
      };
      const timer = setTimeout(() => finish(null), 8000);
      window[cb] = finish;
      script.onerror = () => finish(null);
      script.src = SHEETS_URL + '?callback=' + cb + '&t=' + Date.now();
      document.head.appendChild(script);
    });
  },

  /* 1) Carga lo guardado en este teléfono (instantáneo). */
  loadLocal() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (e) {}
    if (local) Store.apply(local);
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return local;
  },

  /* 2) Compara con Google Sheets; gana lo más reciente. Devuelve true si cambió el estado. */
  async syncFromRemote(local) {
    const remote = await Store.loadFromSheets();
    const remoteOk = remote && typeof remote === 'object' && !remote.error && remote.ok !== false;
    if (!remoteOk) {
      if (Store._dirty()) Store.syncToSheets();
      return false;
    }
    // Contra el estado ACTUAL (S.updatedAt), no contra la foto leída al arrancar: Sheets
    // puede tardar 8 segundos y lo que toques en el medio no se puede perder.
    const localNow = Store.snapshot();
    const rT = +remote.updatedAt || 0, lT = S.updatedAt;

    // Migración desde una versión sin updatedAt: ningún lado tiene fecha y no hay forma de
    // saber cuál es más nuevo. Se conserva el MÁS COMPLETO en vez de asumir que gana el teléfono.
    if (rT === 0 && lT === 0 && Store.hasData(localNow) && Store.hasData(remote)) {
      const adoptar = Store.size(remote) > Store.size(localNow);
      if (adoptar) Store.apply(remote);
      S.updatedAt = Date.now(); Store.saveLocal();
      try { localStorage.setItem(LS_DIRTY, '1'); } catch (e) {}
      Store.syncToSheets();
      return adoptar;
    }
    if (rT > lT) {                                   // Sheets tiene algo más nuevo (p. ej. otro dispositivo)
      Store.apply(remote); Store.saveLocal(); return true;
    }
    if (Store.hasData(localNow) && (lT > rT || Store._dirty() || rT === 0)) {
      if (!S.updatedAt) { S.updatedAt = Date.now(); Store.saveLocal(); }
      Store.syncToSheets();                          // lo local es más nuevo: subirlo
      return false;
    }
    if (!Store.hasData(localNow) && Store.hasData(remote)) {
      Store.apply(remote); Store.saveLocal(); return true;   // teléfono vacío: restaurar
    }
    return false;
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') Store.flushOnHide();
  else if (Store._dirty()) Store.syncToSheets();
});
window.addEventListener('pagehide', () => Store.flushOnHide());
window.addEventListener('online', () => { if (Store._dirty()) Store.syncToSheets(); });
