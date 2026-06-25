// ═══════════════════════════════════════════════════════════
//  fën — Módulo de Sub Recetas Dinámicas
//  Calcula elaboraciones previas y resumen de insumos
//  según el plan semanal
// ═══════════════════════════════════════════════════════════

// ── CONFIGURACIÓN POR DEFECTO ────────────────────────────────
const CONFIG_SUBRECETAS_DEFAULT = {
  mm_blanca: {
    nombre: 'Masa madre blanca',
    pie_pct: 20,      // % del total de MM
    harina_pct: 100,
    agua_pct: 90,
  },
  mm_integral: {
    nombre: 'Masa madre integral',
    pie_pct: 20,
    harina_pct: 100,
    agua_pct: 90,
  },
  poolish: {
    nombre: 'Poolish',
    harina_pct: 100,
    agua_pct: 100,
    levadura_pct: 0.36,
  }
};

// ── CARGAR CONFIG DESDE LOCALSTORAGE ─────────────────────────
function cargarConfigSubrecetas() {
  try {
    const saved = localStorage.getItem('fen_config_subrecetas');
    if (saved) return { ...CONFIG_SUBRECETAS_DEFAULT, ...JSON.parse(saved) };
  } catch(e) {}
  return { ...CONFIG_SUBRECETAS_DEFAULT };
}

function guardarConfigSubrecetas(config) {
  try { localStorage.setItem('fen_config_subrecetas', JSON.stringify(config)); } catch(e) {}
  // También guardar en Sheet
  escribirEnSheet('editar_config', { clave: 'subrecetas', valor: JSON.stringify(config) });
}

// ── CALCULAR ELABORACIONES DEL DÍA ───────────────────────────
// Retorna objeto con sub recetas detectadas y sus cantidades totales
function calcularElaboracionesDia(diaIdx) {
  const recetasDelDia = Object.entries(App.planSemana)
    .filter(([_, cant]) => (cant[diaIdx] || 0) > 0)
    .map(([rid, cant]) => ({
      receta: App.recetas.find(r => r.ID_receta === rid),
      unidades: cant[diaIdx]
    }))
    .filter(x => x.receta);

  // Mapa de sub recetas: { id: { nombre, totalGramos, recetasQueUsan[] } }
  const subRecetasMap = {};

  // Mapa de insumos directos: { nombre: totalGramos }
  const insumosMap = {};

  // IDs de sub recetas (tipo = sub_receta en MP_maestro)
  // También detectar por ID que empiece con SR
  const idsSubRecetas = new Set(
    App.materiasPrimas
      .filter(m => m.tipo === 'sub_receta' || (m.ID_MP && m.ID_MP.toString().startsWith('SR')))
      .map(m => m.ID_MP)
  );

  console.log('[fën] Sub recetas en MP_maestro:', [...idsSubRecetas]);
  console.log('[fën] Total materias primas cargadas:', App.materiasPrimas.length);
  console.log('[fën] Recetas del día:', recetasDelDia.map(x => x.receta?.nombre));

  recetasDelDia.forEach(({ receta: r, unidades }) => {
    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(r.porciones_base) || 1;
    const factor    = unidades / porciones;

    ingredientes.forEach(ing => {
      const grEscalados = (parseFloat(ing.gramos) || 0) * factor;
      const esSubReceta = idsSubRecetas.has(ing.id);

      if (esSubReceta) {
        // Acumular en sub recetas
        if (!subRecetasMap[ing.id]) {
          subRecetasMap[ing.id] = {
            id: ing.id,
            nombre: ing.nombre,
            totalGramos: 0,
            recetasQueUsan: []
          };
        }
        subRecetasMap[ing.id].totalGramos += grEscalados;
        subRecetasMap[ing.id].recetasQueUsan.push({
          nombre: r.nombre,
          gramos: grEscalados
        });
      } else {
        // Acumular en insumos directos
        const key = ing.nombre;
        insumosMap[key] = (insumosMap[key] || 0) + grEscalados;
      }
    });
  });

  return { subRecetasMap, insumosMap };
}

// ── CALCULAR SUB RECETA DESGLOSADA ───────────────────────────
// Dado el total de gramos de una sub receta, calcula sus componentes
function calcularDesglose(subRecetaId, totalGramos) {
  const cfg = cargarConfigSubrecetas();

  // Buscar en recetas si existe como sub receta con sus propios ingredientes
  const recetaSR = App.recetas.find(r => r.ID_receta === subRecetaId);
  if (recetaSR) {
    // Tiene ingredientes propios → escalar
    let ingredientes = [];
    try { ingredientes = JSON.parse(recetaSR.ingredientes_JSON || '[]'); } catch(e) {}
    if (ingredientes.length > 0) {
      const pesoBase = ingredientes.reduce((s, i) => s + (parseFloat(i.gramos) || 0), 0);
      const factor = pesoBase > 0 ? totalGramos / pesoBase : 1;
      return ingredientes.map(ing => ({
        nombre: ing.nombre,
        gramos: (parseFloat(ing.gramos) || 0) * factor,
        esPie:  false
      }));
    }
  }

  // Buscar en config por nombre para aplicar fórmula % panadero
  const nombre = (App.materiasPrimas.find(m => m.ID_MP === subRecetaId)?.nombre || '').toLowerCase();

  if (nombre.includes('masa madre') && nombre.includes('integral')) {
    return desgloseMMPorcentaje(totalGramos, cfg.mm_integral);
  }
  if (nombre.includes('masa madre')) {
    return desgloseMMPorcentaje(totalGramos, cfg.mm_blanca);
  }
  if (nombre.includes('poolish')) {
    return desglosePoolish(totalGramos, cfg.poolish);
  }

  // Genérico: mostrar solo el total
  return [{ nombre: 'Total', gramos: totalGramos, esPie: false }];
}

function desgloseMMPorcentaje(totalGramos, cfg) {
  // Fórmula: pie + harina + agua = total
  // pie = pie_pct% de harina, agua = agua_pct% de harina
  // total = harina × (1 + pie_pct/100 + agua_pct/100)
  const factorTotal = 1 + (cfg.pie_pct / 100) + (cfg.agua_pct / 100);
  const harina = totalGramos / factorTotal;
  const pie    = harina * (cfg.pie_pct / 100);
  const agua   = harina * (cfg.agua_pct / 100);

  return [
    { nombre: 'Pie de masa madre', gramos: pie,    esPie: true  },
    { nombre: 'Harina',            gramos: harina, esPie: false },
    { nombre: 'Agua',              gramos: agua,   esPie: false },
  ];
}

function desglosePoolish(totalGramos, cfg) {
  // harina + agua + levadura = total
  // agua = agua_pct% de harina, lev = lev_pct% de harina
  const factorTotal = 1 + (cfg.agua_pct / 100) + (cfg.levadura_pct / 100);
  const harina    = totalGramos / factorTotal;
  const agua      = harina * (cfg.agua_pct / 100);
  const levadura  = harina * (cfg.levadura_pct / 100);

  return [
    { nombre: 'Harina T000',    gramos: harina,   esPie: false },
    { nombre: 'Agua',           gramos: agua,     esPie: false },
    { nombre: 'Levadura seca',  gramos: levadura, esPie: false },
  ];
}

// ── RENDER BLOQUE ELABORACIONES PREVIAS ──────────────────────
function renderElaboracionesPrevias(diaIdx) {
  const { subRecetasMap, insumosMap } = calcularElaboracionesDia(diaIdx);
  const subRecetas = Object.values(subRecetasMap);

  console.log('[fën] Sub recetas detectadas:', subRecetas.map(s => s.nombre));
  console.log('[fën] Insumos detectados:', Object.keys(insumosMap));
  if (!subRecetas.length && !Object.keys(insumosMap).length) return '';

  // ── Sub recetas (elaboraciones previas)
  const subRecetasHtml = subRecetas.map(sr => {
    const desglose  = calcularDesglose(sr.id, sr.totalGramos);
    const claveCheck = `fen_elab_${App.areaCodigo}_${obtenerSemanaActual()}_${diaIdx}_${sr.id}`;
    const listo = localStorage.getItem(claveCheck) === '1';

    const filasDesglose = desglose.map(comp => `
      <div class="elab-fila ${comp.esPie ? 'elab-pie' : ''}">
        <span class="elab-comp-nombre">${comp.nombre}</span>
        <span class="elab-comp-val">${formatearGramos(comp.gramos, true)}</span>
      </div>`).join('');

    const totalDesglose = desglose.reduce((s, c) => s + c.gramos, 0);
    const totalStr = formatearGramos(totalDesglose, true);

    // Recetas que usan esta sub receta
    const usadaEn = sr.recetasQueUsan.map(u =>
      `<span class="elab-usado-en">${u.nombre} (${formatearGramos(u.gramos)})</span>`
    ).join('');

    return `
      <div class="elab-card ${listo ? 'elab-lista' : ''}" id="elab-${sr.id}">
        <div class="elab-header">
          <label class="rdc-check-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" ${listo ? 'checked' : ''}
              onchange="marcarElaboracion('${sr.id}', ${diaIdx}, this.checked)">
            <span class="rdc-check-box"></span>
          </label>
          <div class="elab-info">
            <strong class="elab-nombre">${sr.nombre}</strong>
            <div class="elab-usado-wrap">${usadaEn}</div>
          </div>
          <span class="elab-total-badge">${totalStr}</span>
        </div>
        <div class="elab-desglose" id="desglose-${sr.id}">
          ${filasDesglose}
          <div class="elab-fila elab-total-fila">
            <span class="elab-comp-nombre">Total</span>
            <span class="elab-comp-val elab-total-val">${totalStr}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  // ── Insumos del día (no sub recetas)
  const CATEGORIAS_INSUMOS = {
    harina:   { label: 'Harinas', keys: ['harina','masa madre','poolish','pie'], color: '#E65100' },
    levadura: { label: 'Levadura seca', keys: ['levadura'], color: '#6A1B9A' },
    sal:      { label: 'Sal', keys: ['sal'], color: '#1565C0' },
    semillas: { label: 'Semillas', keys: ['semilla','linaza','avena','maravilla','calabaza','nuez','sésamo'], color: '#2E7D32' },
    otros:    { label: 'Otros', keys: [], color: '#5D4037' },
  };

  // Agrupar insumos por categoría
  const grupos = {};
  Object.entries(insumosMap).forEach(([nombre, gramos]) => {
    const nombreLower = nombre.toLowerCase();
    let cat = 'otros';
    if (CATEGORIAS_INSUMOS.harina.keys.some(k => nombreLower.includes(k)))   cat = 'harina';
    else if (CATEGORIAS_INSUMOS.levadura.keys.some(k => nombreLower.includes(k))) cat = 'levadura';
    else if (CATEGORIAS_INSUMOS.sal.keys.some(k => nombreLower.includes(k)))  cat = 'sal';
    else if (CATEGORIAS_INSUMOS.semillas.keys.some(k => nombreLower.includes(k))) cat = 'semillas';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push({ nombre, gramos });
  });

  const insumosHtml = Object.entries(grupos).map(([cat, items]) => {
    const cfg = CATEGORIAS_INSUMOS[cat];
    const total = items.reduce((s, i) => s + i.gramos, 0);
    return `
      <div class="insumo-grupo">
        <div class="insumo-grupo-header" style="color:${cfg.color}">
          <span>${cfg.label}</span>
          <span>${formatearGramos(total)}</span>
        </div>
        ${items.map(i => `
          <div class="insumo-fila">
            <span>${i.nombre}</span>
            <span class="insumo-val">${formatearGramos(i.gramos)}</span>
          </div>`).join('')}
      </div>`;
  }).join('');

  return `
    <div class="elaboraciones-wrap">

      ${subRecetas.length ? `
      <div class="elab-seccion">
        <div class="elab-seccion-titulo">
          <i class="ti ti-clock-play"></i>
          Elaboraciones previas
          <span class="elab-count">${subRecetas.length}</span>
        </div>
        <div class="elab-lista-cards">${subRecetasHtml}</div>
      </div>` : ''}

      ${Object.keys(insumosMap).length ? `
      <div class="elab-seccion">
        <div class="elab-seccion-titulo">
          <i class="ti ti-basket"></i>
          Insumos del día
        </div>
        <div class="insumos-grid">${insumosHtml}</div>
      </div>` : ''}

    </div>
  `;
}

function marcarElaboracion(srId, diaIdx, listo) {
  const claveCheck = `fen_elab_${App.areaCodigo}_${obtenerSemanaActual()}_${diaIdx}_${srId}`;
  try { localStorage.setItem(claveCheck, listo ? '1' : '0'); } catch(e) {}
  const card = document.getElementById('elab-' + srId);
  if (card) card.classList.toggle('elab-lista', listo);
}

// ── RESUMEN SEMANAL ───────────────────────────────────────────
function calcularResumenSemanal() {
  const diasNombres = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const resumen = {
    subRecetas: {}, // { srId: { nombre, porDia: [7 valores] } }
    insumos: {},    // { nombre: [7 valores] }
  };

  const idsSubRecetas = new Set(
    App.materiasPrimas.filter(m => m.tipo === 'sub_receta').map(m => m.ID_MP)
  );

  for (let diaIdx = 0; diaIdx < 7; diaIdx++) {
    const { subRecetasMap, insumosMap } = calcularElaboracionesDia(diaIdx);

    Object.entries(subRecetasMap).forEach(([id, sr]) => {
      if (!resumen.subRecetas[id]) {
        resumen.subRecetas[id] = { nombre: sr.nombre, porDia: Array(7).fill(0) };
      }
      resumen.subRecetas[id].porDia[diaIdx] = sr.totalGramos;
    });

    Object.entries(insumosMap).forEach(([nombre, gramos]) => {
      if (!resumen.insumos[nombre]) resumen.insumos[nombre] = Array(7).fill(0);
      resumen.insumos[nombre][diaIdx] = gramos;
    });
  }

  return { resumen, diasNombres };
}

function renderResumenSemanal() {
  const { resumen, diasNombres } = calcularResumenSemanal();
  const tieneSubRecetas = Object.keys(resumen.subRecetas).length > 0;
  const tieneInsumos    = Object.keys(resumen.insumos).length > 0;

  if (!tieneSubRecetas && !tieneInsumos) {
    return '<p style="font-size:12px;color:var(--txt3);padding:12px">Sin producción planificada esta semana.</p>';
  }

  let html = '';

  if (tieneSubRecetas) {
    html += `<div class="rsm-seccion"><div class="rsm-titulo">Elaboraciones</div>`;
    Object.values(resumen.subRecetas).forEach(sr => {
      const total = sr.porDia.reduce((s, v) => s + v, 0);
      html += `
        <div class="rsm-item">
          <div class="rsm-item-nombre">${sr.nombre}</div>
          <div class="rsm-item-total">${formatearGramos(total)}</div>
          <div class="rsm-dias">
            ${sr.porDia.map((v, i) => v > 0
              ? `<span class="rsm-dia-pill rsm-dia-con">${diasNombres[i]}<br><strong>${formatearGramos(v)}</strong></span>`
              : `<span class="rsm-dia-pill rsm-dia-sin">${diasNombres[i]}</span>`
            ).join('')}
          </div>
        </div>`;
    });
    html += '</div>';
  }

  if (tieneInsumos) {
    // Agrupar por categoría igual que el diario
    const harinasTotal = {};
    const otrosTotal   = {};
    Object.entries(resumen.insumos).forEach(([nombre, dias]) => {
      const total = dias.reduce((s,v) => s+v, 0);
      const esSemilla = ['linaza','avena','maravilla','calabaza','nuez','sésamo','semilla'].some(k => nombre.toLowerCase().includes(k));
      const esHarina  = nombre.toLowerCase().includes('harina');
      const esLev     = nombre.toLowerCase().includes('levadura');
      const esSal     = nombre.toLowerCase().includes('sal');
      const cat = esHarina ? 'Harinas' : esLev ? 'Levadura' : esSal ? 'Sal' : esSemilla ? 'Semillas' : 'Otros';
      if (!otrosTotal[cat]) otrosTotal[cat] = [];
      otrosTotal[cat].push({ nombre, total });
    });

    html += `<div class="rsm-seccion"><div class="rsm-titulo">Insumos semana</div>`;
    Object.entries(otrosTotal).forEach(([cat, items]) => {
      html += `<div class="rsm-cat">${cat}</div>`;
      items.forEach(({ nombre, total }) => {
        html += `<div class="rsm-item-simple"><span>${nombre}</span><span>${formatearGramos(total)}</span></div>`;
      });
    });
    html += '</div>';
  }

  return html;
}

// ── VISTA CONFIGURACIÓN SUB RECETAS ──────────────────────────
function renderVistaConfigSubrecetas() {
  const cfg = cargarConfigSubrecetas();
  const vista = document.getElementById('vista-config-subrecetas');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">Panadería</div>
        <h1 class="vista-titulo">Configuración de sub recetas</h1>
      </div>
    </div>
    <p style="font-size:13px;color:var(--txt2);margin-bottom:20px;line-height:1.6">
      Ajusta los porcentajes según la temporada, temperatura y condiciones del día.
      Los cambios se aplican inmediatamente al cálculo de elaboraciones.
    </p>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-plant-2"></i> Masa madre blanca</div>
      <div class="form-grid">
        <div class="campo">
          <label>Pie de masa madre (%)</label>
          <input type="number" id="cfg-mm-blanca-pie" value="${cfg.mm_blanca.pie_pct}"
            min="5" max="50" step="1" placeholder="20">
        </div>
        <div class="campo">
          <label>Agua (% sobre harina)</label>
          <input type="number" id="cfg-mm-blanca-agua" value="${cfg.mm_blanca.agua_pct}"
            min="50" max="120" step="1" placeholder="90">
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-plant-2"></i> Masa madre integral</div>
      <div class="form-grid">
        <div class="campo">
          <label>Pie de masa madre (%)</label>
          <input type="number" id="cfg-mm-integral-pie" value="${cfg.mm_integral.pie_pct}"
            min="5" max="50" step="1" placeholder="20">
        </div>
        <div class="campo">
          <label>Agua (% sobre harina)</label>
          <input type="number" id="cfg-mm-integral-agua" value="${cfg.mm_integral.agua_pct}"
            min="50" max="120" step="1" placeholder="90">
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-droplet"></i> Poolish</div>
      <div class="form-grid">
        <div class="campo">
          <label>Agua (% sobre harina)</label>
          <input type="number" id="cfg-poolish-agua" value="${cfg.poolish.agua_pct}"
            min="50" max="120" step="1" placeholder="100">
        </div>
        <div class="campo">
          <label>Levadura seca (%)</label>
          <input type="number" id="cfg-poolish-lev" value="${cfg.poolish.levadura_pct}"
            min="0.1" max="2" step="0.01" placeholder="0.36">
        </div>
      </div>
    </div>

    <div class="form-acciones">
      <div></div>
      <div class="form-acciones-der">
        <button class="btn-primario" onclick="guardarConfigDesdeForm(this)">
          <i class="ti ti-device-floppy"></i> Guardar configuración
        </button>
      </div>
    </div>
  `;
  mostrarVista('config-subrecetas');
}

function guardarConfigDesdeForm(btn) {
  bloquearBtn(btn, 'Guardando...');
  const cfg = {
    mm_blanca: {
      nombre:    'Masa madre blanca',
      pie_pct:   parseFloat(document.getElementById('cfg-mm-blanca-pie').value) || 20,
      harina_pct: 100,
      agua_pct:  parseFloat(document.getElementById('cfg-mm-blanca-agua').value) || 90,
    },
    mm_integral: {
      nombre:    'Masa madre integral',
      pie_pct:   parseFloat(document.getElementById('cfg-mm-integral-pie').value) || 20,
      harina_pct: 100,
      agua_pct:  parseFloat(document.getElementById('cfg-mm-integral-agua').value) || 90,
    },
    poolish: {
      nombre:       'Poolish',
      harina_pct:   100,
      agua_pct:     parseFloat(document.getElementById('cfg-poolish-agua').value) || 100,
      levadura_pct: parseFloat(document.getElementById('cfg-poolish-lev').value) || 0.36,
    }
  };
  guardarConfigSubrecetas(cfg);
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar configuración', true);
  toast('Configuración guardada');
}

// ── UTILIDAD: formatear gramos ────────────────────────────────
function formatearGramos(gramos, forzarGramos = false) {
  if (!forzarGramos && gramos >= 10000) return (gramos / 1000).toFixed(2).replace('.', ',') + ' kg';
  return Math.round(gramos) + ' g';
}
