// ═══════════════════════════════════════════════
//  fën — Configuración global
// ═══════════════════════════════════════════════

const FEN = {
  SHEET_ID: '1lGL6SPgvBAZfRU4WUKUEr7ZEo1WD0Wq92qoyghk8pyY',
  VERSION: '1.0.0',

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
    consolidada:          { label: 'Consolidada',           color: '#2E7D32', bg: '#E8F5E9' },
  },

  // URL base para leer sheets como CSV (público)
  csvUrl(hoja) {
    return `https://docs.google.com/spreadsheets/d/${this.SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(hoja)}`;
  },

  // URL para Google Apps Script Web App (escritura)
  WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbw-D1gOezUuFEhhqXQ69zYR0Sp4Bekg3CHhy3lEMzB8CV9kp6ty0iXTreyq5aULmz5L8g/exec',
};

// ── Leer hoja como array de objetos ─────────────────────────
async function leerHoja(nombreHoja) {
  try {
    const url = FEN.csvUrl(nombreHoja);
    const res = await fetch(url);
    if (!res.ok) throw new Error('No se pudo leer la hoja: ' + nombreHoja);
    const texto = await res.text();
    return csvAObjetos(texto);
  } catch(e) {
    console.error('Error leyendo hoja:', nombreHoja, e);
    return [];
  }
}

function csvAObjetos(csv) {
  const lineas = csv.split('\n').filter(l => l.trim());
  if (lineas.length < 2) return [];
  const headers = parseCsvLinea(lineas[0]);
  return lineas.slice(1).map(linea => {
    const valores = parseCsvLinea(linea);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim().replace(/"/g,'')] = (valores[i]||'').trim().replace(/^"|"$/g,''); });
    return obj;
  }).filter(o => Object.values(o).some(v => v));
}

function parseCsvLinea(linea) {
  const resultado = [];
  let campo = '';
  let dentroComillas = false;
  for (let i = 0; i < linea.length; i++) {
    const c = linea[i];
    if (c === '"') {
      if (dentroComillas && linea[i+1] === '"') { campo += '"'; i++; }
      else dentroComillas = !dentroComillas;
    } else if (c === ',' && !dentroComillas) {
      resultado.push(campo);
      campo = '';
    } else {
      campo += c;
    }
  }
  resultado.push(campo);
  return resultado;
}

// ── Escribir en Sheet via Apps Script Web App ────────────────
async function escribirEnSheet(accion, datos) {
  if (!FEN.WEBAPP_URL) {
    console.warn('WEBAPP_URL no configurada — guardando solo en local');
    return { ok: false, msg: 'Sin conexión al Sheet' };
  }
  try {
    const res = await fetch(FEN.WEBAPP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion, ...datos })
    });
    return await res.json();
  } catch(e) {
    console.error('Error escribiendo en Sheet:', e);
    return { ok: false, msg: e.message };
  }
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
