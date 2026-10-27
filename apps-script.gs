// Dale Paz — backend en Google Apps Script
// Guarda todo el estado de la app como un JSON en la hoja "data" (en trozos,
// porque una celda de Google Sheets admite máximo 50.000 caracteres).

const SHEET_NAME = 'data';
const CHUNK = 40000;

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}

function readJson_(sheet) {
  const last = sheet.getLastRow();
  if (last < 1) return null;
  const raw = sheet.getRange(1, 1, last, 1).getValues().map(r => r[0]).join('');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function writeJson_(sheet, raw) {
  const rows = [];
  for (let i = 0; i < raw.length; i += CHUNK) rows.push([raw.slice(i, i + CHUNK)]);
  sheet.clearContents();
  const range = sheet.getRange(1, 1, rows.length, 1);
  range.setNumberFormat('@'); // texto plano: evita que Sheets interprete un trozo como fórmula o número
  range.setValues(rows);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const raw = e && e.postData && e.postData.contents;
    const incoming = JSON.parse(raw);
    if (!incoming || typeof incoming !== 'object') throw new Error('payload inválido');
    lock.waitLock(10000);
    const sheet = getSheet_();
    const current = readJson_(sheet);
    // No pisar datos más nuevos con una copia más vieja
    if (current && (+current.updatedAt || 0) > (+incoming.updatedAt || 0)) {
      return json_({ ok: false, error: 'stale' });
    }
    writeJson_(sheet, raw);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// Lectura por JSONP: ...exec?callback=nombre
function doGet(e) {
  const data = readJson_(getSheet_()) || {};
  const body = JSON.stringify(data);
  const cb = e && e.parameter && e.parameter.callback;
  if (cb && /^[\w$.]+$/.test(cb)) {
    return ContentService.createTextOutput(cb + '(' + body + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(data);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
