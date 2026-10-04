// ═══════════════════════════════════════════════
//  fën producción — Configuración y conexión  v2.1.0
//  Este archivo es público en GitHub Pages: aquí NO va ninguna clave.
//  La planilla ya no está publicada: todo se lee y escribe a través del
//  Apps Script, que revisa la sesión de quien pide (ver Seguridad.gs).
// ═══════════════════════════════════════════════

const FEN = {
  VERSION: '2.1.0',
  SHEET_ID: '1lGL6SPgvBAZfRU4WUKUEr7ZEo1WD0Wq92qoyghk8pyY', // solo referencia; la planilla queda privada

  AREAS: {
    PAN: { nombre: 'Panadería',    color: '#E65100', bg: '#FFF8E1', icon: 'ti-bread',  hoja_recetas: 'PAN_recetas', hoja_plan: 'PAN_planificacion', tiene_pan: true  },
    BOL: { nombre: 'Bollería',     color: '#6A1B9A', bg: '#F3E5F5', icon: 'ti-cake',   hoja_recetas: 'BOL_recetas', hoja_plan: 'BOL_planificacion', tiene_pan: false },
    PAS: { nombre: 'Pastelería',   color: '#1B5E20', bg: '#E8F5E9', icon: 'ti-slice',  hoja_recetas: 'PAS_recetas', hoja_plan: 'PAS_planificacion', tiene_pan: false },
    CAF: { nombre: 'Cafetería',    color: '#B71C1C', bg: '#FFEBEE', icon: 'ti-coffee', hoja_recetas: 'CAF_recetas', hoja_plan: null,                tiene_pan: false },
  },

  ESTADOS: {
    borrador:             { label: 'Borrador',              color: '#9E9E9E', bg: '#F5F5F5' },
    en_prueba:            { label: 'En prueba',             color: '#F57C00', bg: '#FFF3E0' },
    pendiente_aprobacion: { label: 'Pendiente aprobación',  color: '#1565C0', bg: '#E3F2FD' },
    'pendiente_aprobación': { label: 'Pendiente aprobación',  color: '#1565C0', bg: '#E3F2FD' },
    consolidada:          { label: 'Consolidada',           color: '#2E7D32', bg: '#E8F5E9' },
  },

  // URL del Apps Script (Implementar → Gestionar implementaciones). No es secreta:
  // sin una sesión válida, el script no entrega ni guarda nada.
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbw-D1gOezUuFEhhqXQ69zYR0Sp4Bekg3CHhy3lEMzB8CV9kp6ty0iXTreyq5aULmz5L8g/exec',
};

// ── Sesión en este equipo ───────────────────────────────────
//  dispositivo: el equipo quedó autorizado por el dueño (dura ~1 año)
//  admin:       sesión de Administración (hasta "Salir"; 30 días si se marcó
//               "Recordar en este equipo", si no, mientras la pestaña esté abierta)
//  jefa:        sesión de la jefa: dura su turno (12 horas) o hasta "Salir".
//               v2.1: se guarda en el equipo (ya autorizado), así apagar la
//               pantalla o recargar no vuelve a pedir el PIN.
const FenSesion = {
  _leer(almacen, k) { try { return almacen.getItem(k); } catch (e) { return null; } },
  _poner(almacen, k, v) { try { v ? almacen.setItem(k, v) : almacen.removeItem(k); } catch (e) {} },
  dispositivo()  { return this._leer(localStorage, 'fen_prod_dispositivo'); },
  // Admin: en localStorage solo si se marcó "Recordar en este equipo";
  // si no, dura lo que la pestaña abierta.
  admin()        { return this._leer(localStorage, 'fen_prod_admin') || this._leer(sessionStorage, 'fen_prod_admin'); },
  jefa()         { return this._leer(localStorage, 'fen_prod_jefa'); },
  setDispositivo(t) { this._poner(localStorage, 'fen_prod_dispositivo', t); },
  setAdmin(t, recordar) {
    this._poner(localStorage, 'fen_prod_admin', recordar ? t : null);
    this._poner(sessionStorage, 'fen_prod_admin', recordar ? null : t);
  },
  setJefa(t)        { this._poner(localStorage, 'fen_prod_jefa', t); this._poner(sessionStorage, 'fen_prod_jefa', null); },
  // La sesión con la que se trabaja ahora (jefa en esta pestaña, si no admin)
  actual() { return this.jefa() || this.admin(); },
};

const _fetchOriginal = window.fetch.bind(window);

function _idem() {
  return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12));
}

// Llamada al Apps Script: POST con JSON, con la sesión de este equipo y una
// clave única por escritura (idem) para que nunca se registre dos veces.
// Si Google desvía el POST (llega como GET sin datos: code "version"),
// reintenta por GET con el mismo JSON.
async function fenApi(accion, datos = {}, opciones = {}) {
  const cuerpo = Object.assign({}, datos, { accion, idem: _idem() });
  if (!('token' in cuerpo)) cuerpo.token = FenSesion.actual();
  const texto = JSON.stringify(cuerpo);
  let data;
  try {
    const res = await _fetchOriginal(FEN.WEBAPP_URL, { method: 'POST', body: texto, cache: 'no-store' });
    data = await res.json();
    if (data && data.code === 'version') {
      const r2 = await _fetchOriginal(FEN.WEBAPP_URL + '?p=' + encodeURIComponent(texto), { cache: 'no-store' });
      data = await r2.json();
    }
  } catch (e) {
    return { ok: false, msg: 'Sin conexión con el servidor. Revisa internet e intenta de nuevo.', code: 'red' };
  }
  if (data && data.code === 'sesion' && !opciones.sinAviso && typeof fenSesionVencida === 'function') {
    fenSesionVencida();
  }
  return data;
}

// La app v1 llamaba al script directamente en ~70 lugares, con
// fetch(FEN.WEBAPP_URL + '?payload=...') o con POST "no-cors" (sin poder leer
// la respuesta). En vez de reescribir cada uno, aquí se intercepta toda
// llamada al script y se envía por fenApi: con sesión, con clave idem, y
// devolviendo siempre la respuesta real del servidor.
window.fetch = async function (recurso, init) {
  const url = typeof recurso === 'string' ? recurso : (recurso && recurso.url) || '';
  if (!FEN.WEBAPP_URL || url.indexOf(FEN.WEBAPP_URL) !== 0) return _fetchOriginal(recurso, init);
  let datos = {};
  try {
    const q = url.split('?')[1] || '';
    const payload = new URLSearchParams(q).get('payload');
    if (payload) datos = JSON.parse(payload);
    else if (init && typeof init.body === 'string') datos = JSON.parse(init.body);
  } catch (e) {
    datos = {};
  }
  const accion = datos.accion;
  delete datos.accion;
  const data = await fenApi(accion, datos);
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// ── Leer hoja como array de objetos ─────────────────────────
// Antes se leía la planilla publicada (CSV). Ahora la entrega el script,
// que a las jefas no les manda columnas de costos ni precios.
async function leerHoja(nombreHoja) {
  const data = await fenApi('leer_hoja', { hoja: nombreHoja });
  if (!data || data.ok === false) {
    if (!data || data.code !== 'sesion') console.error('Error leyendo hoja:', nombreHoja, data && data.msg);
    return [];
  }
  const headers = (data.headers || []).map(h => String(h).trim().replace(/"/g, ''));
  return (data.filas || []).map(valores => {
    const obj = {};
    headers.forEach((h, i) => {
      let v = String(valores[i] ?? '').trim();
      // Igual que con el CSV: "$1,681.00" → "1681.00" para que se pueda leer como número.
      if (/^\$?-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(v) && /\d/.test(v)) v = v.replace(/[$,]/g, '');
      obj[h] = v;
    });
    return obj;
  }).filter(o => Object.values(o).some(v => v));
}

// ── Escribir en la planilla vía Apps Script ─────────────────
// Ahora siempre se recibe la respuesta real (antes, los envíos grandes iban
// "a ciegas" y la app suponía que habían llegado).
async function escribirEnSheet(accion, datos) {
  if (!FEN.WEBAPP_URL) return { ok: false, msg: 'Sin conexión al Sheet' };
  return fenApi(accion, datos);
}

// Escapa texto antes de ponerlo en HTML.
function esc(t) {
  return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Cache simple en memoria ──────────────────────────────────
const Cache = {
  _data: {},
  _ts: {},
  TTL: 60000, // 1 minuto

  async get(key, fetchFn) {
    const ahora = Date.now();
    if (this._data[key] && (ahora - this._ts[key]) < this.TTL) {
      return this._data[key];
    }
    const datos = await fetchFn();
    this._data[key] = datos;
    this._ts[key] = ahora;
    return datos;
  },

  invalidar(key) {
    delete this._data[key];
    delete this._ts[key];
  },

  invalidarTodo() {
    this._data = {};
    this._ts = {};
  }
};
