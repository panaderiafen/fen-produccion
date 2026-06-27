// ═══════════════════════════════════════════════════════════
//  fën — Módulo de Sub Recetas Dinámicas
//  Calcula elaboraciones previas y resumen de insumos
//  según el plan semanal
// ═══════════════════════════════════════════════════════════

// ── CONFIGURACIÓN POR DEFECTO ────────────────────────────────
const CONFIG_SUBRECETAS_DEFAULT = {
  mm_blanca: {
    nombre: 'Masa madre blanca',
    pie_pct: 20,
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
  },
  pie_mm: {
    dias_elaboracion: [1, 4],
    reserva_pct: 20,
    mm_madura_pct: 20,
    harina_pct: 100,
    agua_pct: 90,
  },
  bol: {
    prefermento: {
      dias_elaboracion: [1, 3, 5], // Lun, Mié, Vie por defecto
      harina_pct: 100,
      agua_pct: 100,
      levadura_pct: 0.5,
    },
    capacidad_masas: 20,       // pastóns máximos en congelador
    capacidad_productos: 200,  // unidades máximas en congelador
    stock: {},                 // { recetaId: unidades } — se edita semanalmente
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

  // IDs de sub recetas filtradas por área actual
  const areaActual = App.areaCodigo || '';
  const idsSubRecetas = new Set(
    App.materiasPrimas
      .filter(m => {
        const esSubReceta = m.tipo === 'sub_receta' || (m.ID_MP && m.ID_MP.toString().startsWith('SR'));
        if (!esSubReceta) return false;
        // Filtrar por área habilitada
        if (!m.areas_habilitadas) return true;
        return m.areas_habilitadas.split(',').map(a => a.trim()).includes(areaActual);
      })
      .map(m => m.ID_MP)
  );

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
  const mpItem = App.materiasPrimas.find(m => m.ID_MP === subRecetaId);
  const nombreMP = (mpItem?.nombre || '').toLowerCase();
  const nombreBuscado = mpItem?.nombre || '';

  // 1. SIEMPRE buscar primero en recetas consolidadas con ingredientes reales
  const recetaSR = App.recetas.find(r =>
    r.nombre === nombreBuscado ||
    r.ID_receta === subRecetaId ||
    (r.nombre || '').toLowerCase() === nombreBuscado.toLowerCase()
  );

  if (recetaSR) {
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

  // 2. Fallback: fórmulas de config % panadero (solo si no hay receta con ingredientes)
  // Solo aplica para área PAN y sub recetas sin ingredientes definidos
  if (App.areaCodigo === 'PAN') {
    if (nombreMP.includes('masa madre') && nombreMP.includes('integral')) {
      return desgloseMMPorcentaje(totalGramos, cfg.mm_integral);
    }
    if (nombreMP.includes('masa madre')) {
      return desgloseMMPorcentaje(totalGramos, cfg.mm_blanca);
    }
    if (nombreMP.includes('poolish')) {
      return desglosePoolish(totalGramos, cfg.poolish);
    }
  }

  // 3. Genérico: mostrar solo el total
  return [{ nombre: nombreBuscado || 'Total', gramos: totalGramos, esPie: false }];
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

// ── CALCULAR PIE DE MASA MADRE ──────────────────────────────
function calcularPieMM(diaIdxActual) {
  const cfg = cargarConfigSubrecetas();
  const pieCfg = cfg.pie_mm;
  if (!pieCfg) return null;

  // Convertir día JS (0=Dom) al índice plan (0=Lun)
  const diasElaboracion = pieCfg.dias_elaboracion; // en índice plan (0=Lun)

  // ¿Es hoy un día de elaboración del pie?
  if (!diasElaboracion.includes(diaIdxActual)) return null;

  // Determinar qué días cubre este pie
  const diasSemana = [0,1,2,3,4,5,6];
  const posActual = diasElaboracion.indexOf(diaIdxActual);
  const siguienteElaboracion = diasElaboracion[(posActual + 1) % diasElaboracion.length];

  // Días que cubre: desde mañana hasta el día anterior a la siguiente elaboración
  const diasCubiertos = [];
  let dia = (diaIdxActual + 1) % 7;
  while (dia !== siguienteElaboracion) {
    diasCubiertos.push(dia);
    dia = (dia + 1) % 7;
  }

  // Días del período siguiente (para calcular reserva)
  const diasSiguientePeriodo = [];
  let diaSig = siguienteElaboracion;
  const posNext = diasElaboracion.indexOf(siguienteElaboracion);
  const despuesNext = diasElaboracion[(posNext + 1) % diasElaboracion.length];
  diaSig = (siguienteElaboracion + 1) % 7;
  while (diaSig !== despuesNext) {
    diasSiguientePeriodo.push(diaSig);
    diaSig = (diaSig + 1) % 7;
  }

  // Calcular MM necesaria por día (de todas las sub recetas MM)
  const nombresDias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const idsMMBlanca = App.materiasPrimas
    .filter(m => (m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR')) &&
      m.nombre?.toLowerCase().includes('masa madre') &&
      !m.nombre?.toLowerCase().includes('integral'))
    .map(m => m.ID_MP);

  const idsMMIntegral = App.materiasPrimas
    .filter(m => (m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR')) &&
      m.nombre?.toLowerCase().includes('masa madre') &&
      m.nombre?.toLowerCase().includes('integral'))
    .map(m => m.ID_MP);

  function mmNecesariaDia(diaIdx, idsMMSet) {
    let total = 0;
    Object.entries(App.planSemana).forEach(([rid, cant]) => {
      const unidades = cant[diaIdx] || 0;
      if (!unidades) return;
      const receta = App.recetas.find(r => r.ID_receta === rid);
      if (!receta) return;
      let ingredientes = [];
      try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
      const porciones = parseInt(receta.porciones_base) || 1;
      const factor = unidades / porciones;
      ingredientes.forEach(ing => {
        if (idsMMSet.includes(ing.id)) {
          total += (parseFloat(ing.gramos) || 0) * factor;
        }
      });
    });
    return total;
  }

  // Calcular totales
  const mmBlancaCubiertos = diasCubiertos.reduce((s, d) => s + mmNecesariaDia(d, idsMMBlanca), 0);
  const mmBlancaSiguiente = diasSiguientePeriodo.reduce((s, d) => s + mmNecesariaDia(d, idsMMBlanca), 0);
  const reservaBlanca = mmBlancaSiguiente * (pieCfg.reserva_pct / 100);
  const pieBlancaTotal = mmBlancaCubiertos + reservaBlanca;

  const mmIntegralCubiertos = diasCubiertos.reduce((s, d) => s + mmNecesariaDia(d, idsMMIntegral), 0);
  const mmIntegralSiguiente = diasSiguientePeriodo.reduce((s, d) => s + mmNecesariaDia(d, idsMMIntegral), 0);
  const reservaIntegral = mmIntegralSiguiente * (pieCfg.reserva_pct / 100);
  const pieIntegralTotal = mmIntegralCubiertos + reservaIntegral;

  if (pieBlancaTotal === 0 && pieIntegralTotal === 0) return null;

  return {
    diasCubiertos: diasCubiertos.map(d => nombresDias[d]),
    diasSiguientePeriodo: diasSiguientePeriodo.map(d => nombresDias[d]),
    blanca: {
      total: pieBlancaTotal,
      mmCubiertos: mmBlancaCubiertos,
      reserva: reservaBlanca,
      desglose: calcularDesglosePie(pieBlancaTotal, pieCfg)
    },
    integral: {
      total: pieIntegralTotal,
      mmCubiertos: mmIntegralCubiertos,
      reserva: reservaIntegral,
      desglose: calcularDesglosePie(pieIntegralTotal, pieCfg)
    }
  };
}

function calcularDesglosePie(totalPie, pieCfg) {
  if (totalPie === 0) return [];
  // El pie lleva: MM madura, harina y agua
  // Total = MMmadura + harina + agua
  // MMmadura = mm_madura_pct% de harina
  // agua = agua_pct% de harina
  // total = harina × (1 + mm_madura_pct/100 + agua_pct/100)
  const factor = 1 + (pieCfg.mm_madura_pct / 100) + (pieCfg.agua_pct / 100);
  const harina   = totalPie / factor;
  const mmMadura = harina * (pieCfg.mm_madura_pct / 100);
  const agua     = harina * (pieCfg.agua_pct / 100);
  return [
    { nombre: 'MM madura anterior', gramos: mmMadura, especial: true },
    { nombre: 'Harina T000',        gramos: harina,   especial: false },
    { nombre: 'Agua',               gramos: agua,     especial: false },
  ];
}

function renderBloquepieMM(diaIdx) {
  const datos = calcularPieMM(diaIdx);
  if (!datos) return '';

  const claveBlanca   = `fen_pie_blanca_${obtenerSemanaActual()}_${diaIdx}`;
  const claveIntegral = `fen_pie_integral_${obtenerSemanaActual()}_${diaIdx}`;
  const listoBlanca   = localStorage.getItem(claveBlanca) === '1';
  const listoIntegral = localStorage.getItem(claveIntegral) === '1';

  const renderSeccionPie = (tipo, datos, clave, listo) => {
    if (datos.total === 0) return '';
    return `
      <div class="pie-mm-seccion ${listo ? 'pie-mm-lista' : ''}">
        <div class="pie-mm-seccion-header">
          <label class="rdc-check-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" ${listo ? 'checked' : ''}
              onchange="marcarPieMM('${clave}', this.checked, '${tipo}')">
            <span class="rdc-check-box"></span>
          </label>
          <span class="pie-mm-tipo">${tipo}</span>
          <span class="pie-mm-total">${formatearGramos(datos.total, true)}</span>
        </div>
        <div class="pie-mm-desglose">
          ${datos.desglose.map(comp => `
            <div class="pie-mm-fila ${comp.especial ? 'pie-mm-madura' : ''}">
              <span>${comp.nombre}</span>
              <span class="pie-mm-val">${formatearGramos(comp.gramos, true)}</span>
            </div>`).join('')}
          <div class="pie-mm-fila pie-mm-subtotal">
            <span>MM a cubrir (${datos.mmCubiertos > 0 ? formatearGramos(datos.mmCubiertos, true) : '0g'})</span>
            <span class="pie-mm-val" style="color:var(--txt3);font-size:11px">+ Reserva ${formatearGramos(datos.reserva, true)}</span>
          </div>
        </div>
      </div>`;
  };

  return `
    <div class="pie-mm-bloque">
      <div class="pie-mm-header">
        <div class="pie-mm-icono">🌱</div>
        <div class="pie-mm-titulo-wrap">
          <div class="pie-mm-titulo">Pie de Masa Madre</div>
          <div class="pie-mm-subtitulo">
            Cubre: ${datos.diasCubiertos.join(' · ')}
            &nbsp;|&nbsp; Reserva (${datos.diasSiguientePeriodo.join(' · ')}): ${Math.round(cargarConfigSubrecetas().pie_mm?.reserva_pct || 20)}%
          </div>
        </div>
      </div>
      ${renderSeccionPie('MM Blanca',   datos.blanca,   claveBlanca,   listoBlanca)}
      ${renderSeccionPie('MM Integral', datos.integral, claveIntegral, listoIntegral)}
    </div>
  `;
}

function marcarPieMM(clave, listo, tipo) {
  try { localStorage.setItem(clave, listo ? '1' : '0'); } catch(e) {}
  const seccion = document.querySelector(`.pie-mm-seccion[data-clave="${clave}"]`);
  // Re-render para actualizar visual
  const diaSelect = document.getElementById('selector-dia');
  if (diaSelect) renderDia(parseInt(diaSelect.value));
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
    const esHarina = cat === 'harina';
    const sacosTotal = esHarina ? Math.ceil(total / 25000) : 0;
    return `
      <div class="insumo-grupo">
        <div class="insumo-grupo-header" style="color:${cfg.color}">
          <span>${cfg.label}</span>
          <span>${formatearGramos(total)}${sacosTotal > 0 ? ' · ' + sacosTotal + ' saco' + (sacosTotal > 1 ? 's' : '') : ''}</span>
        </div>
        ${items.map(i => {
          const sacos = esHarina ? Math.ceil(i.gramos / 25000) : 0;
          return `
          <div class="insumo-fila">
            <span>${i.nombre}</span>
            <span class="insumo-val">${formatearGramos(i.gramos, true)}${sacos > 0 ? ` <span style="font-size:10px;color:var(--txt3);margin-left:3px">(${sacos} saco${sacos > 1 ? 's' : ''})</span>` : ''}</span>
          </div>`;
        }).join('')}
      </div>`;
  }).join('');

  // Para BOL: mostrar elaboraciones del día SIGUIENTE (lo que hay que preparar hoy para mañana)
  // Para PAN: pie de MM para días futuros
  const pieMM    = (typeof renderBloquepieMM === 'function') ? renderBloquepieMM(diaIdx) : '';

  // Empastes y prefermento BOL: mostrar lo necesario para el DÍA SIGUIENTE
  const diaIdxSiguiente = (diaIdx + 1) % 7;
  const empastes = (typeof renderEmpastesPrevistos === 'function')
    ? renderEmpastesPrevistos(diaIdxSiguiente, diaIdx)
    : '';
  const prefermentoBOL = (App.areaCodigo === 'BOL')
    ? renderPrefermentoBOL(diaIdxSiguiente)
    : '';

  return `
    <div class="elaboraciones-wrap">

      ${pieMM}
      ${prefermentoBOL}
      ${empastes}

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
        const esHarina = ['harina','masa madre','poolish'].some(k => nombre.toLowerCase().includes(k)) && cat === 'Harinas';
        const sacos = esHarina ? Math.ceil(total/25000) : 0;
        html += `<div class="rsm-item-simple"><span>${nombre}</span><span>${formatearGramos(total)}${sacos > 0 ? ' <span style="font-size:10px;color:var(--txt3)">('+sacos+' saco'+(sacos>1?'s':'')+')</span>' : ''}</span></div>`;
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
  const areaLabel = App.area?.nombre || 'Área';
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${areaLabel}</div>
        <h1 class="vista-titulo">Configuración</h1>
      </div>
    </div>
    <p style="font-size:13px;color:var(--txt2);margin-bottom:20px;line-height:1.6">
      Ajusta los parámetros de producción para ${areaLabel}.
    </p>

    ${App.areaCodigo === 'PAN' ? `
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

    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#F0F7EF;color:#2E4A1E">
        <span style="font-size:18px;margin-right:6px">🌱</span> Pie de Masa Madre
      </div>
      <div class="form-grid">
        <div class="campo full">
          <label>Días de elaboración del pie</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px" id="cfg-pie-dias">
            ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d,i) => `
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:400;cursor:pointer">
                <input type="checkbox" value="${i}" ${(cfg.pie_mm?.dias_elaboracion || [1,4]).includes(i) ? 'checked' : ''}>
                ${d}
              </label>`).join('')}
          </div>
        </div>
        <div class="campo">
          <label>% Reserva (basado en período siguiente)</label>
          <input type="number" id="cfg-pie-reserva" value="${cfg.pie_mm?.reserva_pct || 20}"
            min="0" max="50" step="1" placeholder="20">
        </div>
        <div class="campo">
          <label>MM madura anterior (%)</label>
          <input type="number" id="cfg-pie-madura" value="${cfg.pie_mm?.mm_madura_pct || 20}"
            min="5" max="50" step="1" placeholder="20">
        </div>
        <div class="campo">
          <label>Agua del pie (% sobre harina)</label>
          <input type="number" id="cfg-pie-agua" value="${cfg.pie_mm?.agua_pct || 90}"
            min="50" max="120" step="1" placeholder="90">
        </div>
      </div>
    </div>

    ` : ''}

    ${App.areaCodigo === 'BOL' ? `
    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-snowflake" style="color:#6A1B9A"></i> Bollería — Congelación y Prefermento
      </div>
      <div class="form-grid">
        <div class="campo">
          <label>Capacidad máxima masas (pastóns)</label>
          <input type="number" id="cfg-bol-masas" value="${cfg.bol?.capacidad_masas || 20}" min="1" step="1">
        </div>
        <div class="campo">
          <label>Capacidad máxima productos (unidades)</label>
          <input type="number" id="cfg-bol-productos" value="${cfg.bol?.capacidad_productos || 200}" min="1" step="1">
        </div>
        <div class="campo full">
          <label>Días de elaboración del prefermento</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px" id="cfg-bol-dias">
            ${['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((d,i) => `
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;font-weight:400;cursor:pointer">
                <input type="checkbox" value="${i}" ${(cfg.bol?.prefermento?.dias_elaboracion || [1,3,5]).includes(i) ? 'checked' : ''}>
                ${d}
              </label>`).join('')}
          </div>
        </div>
        <div class="campo">
          <label>Agua prefermento (% sobre harina)</label>
          <input type="number" id="cfg-bol-agua" value="${cfg.bol?.prefermento?.agua_pct || 100}" min="50" max="120" step="1">
        </div>
        <div class="campo">
          <label>Levadura prefermento (%)</label>
          <input type="number" id="cfg-bol-lev" value="${cfg.bol?.prefermento?.levadura_pct || 0.5}" min="0.1" max="2" step="0.01">
        </div>
        <div class="campo">
          <label>% Merma laminado referencia</label>
          <input type="number" id="cfg-bol-merma" value="${cfg.bol?.merma_laminado_ref || 8}" min="0" max="30" step="0.1" placeholder="8">
        </div>
      </div>
    </div>` : ''}

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
  // Leer días de elaboración del pie
  const diasPie = [];
  document.querySelectorAll('#cfg-pie-dias input[type="checkbox"]:checked').forEach(cb => {
    diasPie.push(parseInt(cb.value));
  });
  cfg.pie_mm = {
    dias_elaboracion: diasPie.length > 0 ? diasPie : [1, 4],
    reserva_pct:   parseFloat(document.getElementById('cfg-pie-reserva').value) || 20,
    mm_madura_pct: parseFloat(document.getElementById('cfg-pie-madura').value) || 20,
    harina_pct:    100,
    agua_pct:      parseFloat(document.getElementById('cfg-pie-agua').value) || 90,
  };

  // BOL config
  if (App.areaCodigo === 'BOL') {
    const diasBOL = [];
    document.querySelectorAll('#cfg-bol-dias input:checked').forEach(cb => diasBOL.push(parseInt(cb.value)));
    if (!cfg.bol) cfg.bol = { stock: {} };
    cfg.bol.capacidad_masas     = parseFloat(document.getElementById('cfg-bol-masas')?.value) || 20;
    cfg.bol.capacidad_productos = parseFloat(document.getElementById('cfg-bol-productos')?.value) || 200;
    cfg.bol.merma_laminado_ref  = parseFloat(document.getElementById('cfg-bol-merma')?.value) || 8;
    cfg.bol.prefermento = {
      dias_elaboracion: diasBOL.length > 0 ? diasBOL : [1,3,5],
      harina_pct: 100,
      agua_pct:   parseFloat(document.getElementById('cfg-bol-agua')?.value) || 100,
      levadura_pct: parseFloat(document.getElementById('cfg-bol-lev')?.value) || 0.5,
    };
  }

  guardarConfigSubrecetas(cfg);
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar configuración', true);
  toast('Configuración guardada');
}

// ── BOLLERÍA: CÁLCULO DE PAÑOS ───────────────────────────────

function calcularPastónsBOL(diaIdx) {
  const cfg = cargarConfigSubrecetas();
  const stock = cfg.bol?.stock || {};
  const capacidadMasas = cfg.bol?.capacidad_masas || 20;

  // Identificar sub recetas de tipo "pastón" (masa laminada)
  const idsPastóns = new Set(
    App.materiasPrimas
      .filter(m => (m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR')) &&
        (m.nombre?.toLowerCase().includes('pastón') ||
         m.nombre?.toLowerCase().includes('masa') &&
         !m.nombre?.toLowerCase().includes('masa madre')))
      .map(m => m.ID_MP)
  );

  // Por cada receta del día, calcular pastóns necesarios
  const recetasDelDia = Object.entries(App.planSemana)
    .filter(([_, cant]) => (cant[diaIdx] || 0) > 0)
    .map(([rid, cant]) => ({
      receta: App.recetas.find(r => r.ID_receta === rid),
      unidades: cant[diaIdx]
    }))
    .filter(x => x.receta);

  const pastónsMap = {}; // { pastónId: { nombre, totalPastóns, productos[] } }

  recetasDelDia.forEach(({ receta: r, unidades }) => {
    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(r.porciones_base) || 1;

    // Calcular unidades netas (descontando stock)
    const stockDisponible = stock[r.ID_receta] || 0;
    const unidadesNetas = Math.max(0, unidades - stockDisponible);
    if (unidadesNetas === 0) return;

    // Buscar pastóns en ingredientes
    ingredientes.forEach(ing => {
      if (idsPastóns.has(ing.id)) {
        const pastónsPorReceta = (parseFloat(ing.gramos) || 1) / porciones;
        const pastónsNecesarios = Math.ceil(pastónsPorReceta * unidadesNetas);
        if (!pastónsMap[ing.id]) {
          pastónsMap[ing.id] = {
            id: ing.id,
            nombre: ing.nombre,
            totalPastóns: 0,
            productos: []
          };
        }
        pastónsMap[ing.id].totalPastóns += pastónsNecesarios;
        pastónsMap[ing.id].productos.push({
          nombre: r.nombre,
          unidadesMeta: unidades,
          stockDisponible,
          unidadesNetas,
          pastónsNecesarios
        });
      }
    });
  });

  return { pastónsMap, capacidadMasas };
}

function renderResumenStockBOL() {
  if (App.areaCodigo !== 'BOL') return '';
  const cfg = cargarConfigSubrecetas();
  const stock = cfg.bol?.stock || {};
  const capacidadMasas = cfg.bol?.capacidad_masas || 20;
  const capacidadProductos = cfg.bol?.capacidad_productos || 200;

  const recetasConsolidadas = App.recetas.filter(r => r.estado === 'consolidada');
  if (!recetasConsolidadas.length) return '';

  return `
    <div class="stock-bol-wrap">
      <div class="stock-bol-header">
        <i class="ti ti-snowflake"></i>
        Stock congelado actual
        <button class="btn-agregar-fila" onclick="editarStockBOL()" style="margin-left:auto">
          <i class="ti ti-edit"></i> Editar stock
        </button>
      </div>
      <div class="stock-bol-grid">
        ${recetasConsolidadas.map(r => {
          const s = stock[r.ID_receta] || 0;
          return `
            <div class="stock-bol-item">
              <span class="stock-bol-nombre">${r.nombre}</span>
              <span class="stock-bol-val ${s > 0 ? 'stock-con' : 'stock-sin'}">${s} uds</span>
            </div>`;
        }).join('')}
      </div>
      <div class="stock-bol-capacidad">
        <span><i class="ti ti-box"></i> Cap. masas: ${capacidadMasas} pastóns</span>
        <span><i class="ti ti-freeze-row"></i> Cap. productos: ${capacidadProductos} uds</span>
      </div>
    </div>`;
}

function editarStockBOL() {
  const cfg = cargarConfigSubrecetas();
  const stock = cfg.bol?.stock || {};
  const recetas = App.recetas.filter(r => r.estado === 'consolidada');

  const modal = document.getElementById('modal-stock-bol');
  if (!modal) return;

  document.getElementById('stock-bol-body').innerHTML = recetas.map(r => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:13px">${r.nombre}</span>
      <input type="number" min="0" value="${stock[r.ID_receta] || 0}"
        data-receta="${r.ID_receta}"
        style="width:80px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit;text-align:right">
    </div>`).join('');

  modal.classList.remove('hidden');
}

function guardarStockBOL() {
  const cfg = cargarConfigSubrecetas();
  if (!cfg.bol) cfg.bol = {};
  cfg.bol.stock = {};

  document.querySelectorAll('#stock-bol-body input[data-receta]').forEach(inp => {
    const val = parseInt(inp.value) || 0;
    if (val > 0) cfg.bol.stock[inp.dataset.receta] = val;
  });

  guardarConfigSubrecetas(cfg);
  document.getElementById('modal-stock-bol').classList.add('hidden');
  toast('Stock actualizado');
}

function renderEmpastesPrevistos(diaIdxTarget, diaIdxActual) {
  if (App.areaCodigo !== 'BOL') return '';
  const idx = diaIdxTarget !== undefined ? diaIdxTarget : (diaIdxActual || 0);
  const { pastonesMap } = calcularPastonesBOL(idx);
  const totalPastones = Object.values(pastonesMap).reduce((s, p) => s + p.totalPastones, 0);
  if (totalPastones === 0) return '';

  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const labelDia = diaIdxTarget !== undefined
    ? `para producción del ${diasNombres[diaIdxTarget]}`
    : 'para mañana';
  const mantequillaTotalG = totalPastones * 250;
  const claveCheck = `fen_empaste_BOL_${obtenerSemanaActual()}_${idx}`;
  const listo = localStorage.getItem(claveCheck) === '1';

  return `
    <div class="empaste-bloque ${listo?'':''}">
      <div class="empaste-header">
        <span class="empaste-icono">🧈</span>
        <div>
          <div class="empaste-titulo">Empastes a preparar</div>
          <div class="empaste-subtitulo">Preparar hoy ${labelDia}</div>
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
          <label class="rdc-check-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" ${listo?'checked':''}
              onchange="localStorage.setItem('${claveCheck}',this.checked?'1':'0');this.closest('.empaste-bloque').style.opacity=this.checked?'.5':'1'">
            <span class="rdc-check-box"></span>
          </label>
          <span class="empaste-total">${totalPastones} bloque${totalPastones>1?'s':''}</span>
        </div>
      </div>
      <div class="empaste-detalle">
        ${Object.values(pastonesMap).map(p => `
          <div class="empaste-fila">
            <span>${p.nombre}</span>
            <span class="empaste-val">${p.totalPastones} pastón${p.totalPastones>1?'es':''}</span>
          </div>`).join('')}
        <div class="empaste-fila empaste-total-fila">
          <span>Mantequilla total (250g c/u)</span>
          <span class="empaste-val">${formatearGramos(mantequillaTotalG, true)}</span>
        </div>
      </div>
    </div>`;
}

function renderPrefermentoBOL(diaIdxTarget) {
  if (App.areaCodigo !== 'BOL') return '';
  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  // Detectar sub recetas de tipo prefermento (poolish) de BOL usadas el día target
  const idsPrefermentos = new Set(
    App.materiasPrimas
      .filter(m => {
        const esSubReceta = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
        const esDeBOL = !m.areas_habilitadas || m.areas_habilitadas.includes('BOL');
        const esPrefermento = (m.nombre || '').toLowerCase().includes('poolish');
        return esSubReceta && esDeBOL && esPrefermento;
      })
      .map(m => m.ID_MP)
  );
  if (idsPrefermentos.size === 0) return '';

  const subRecetasMap = {};
  Object.entries(App.planSemana)
    .filter(([_, cant]) => (cant[diaIdxTarget] || 0) > 0)
    .forEach(([rid, cant]) => {
      const receta = App.recetas.find(r => r.ID_receta === rid);
      if (!receta) return;
      let ingredientes = [];
      try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
      const porciones = parseInt(receta.porciones_base) || 1;
      const factor = cant[diaIdxTarget] / porciones;
      ingredientes.forEach(ing => {
        if (idsPrefermentos.has(ing.id)) {
          if (!subRecetasMap[ing.id]) {
            subRecetasMap[ing.id] = { id: ing.id, nombre: ing.nombre, totalGramos: 0 };
          }
          subRecetasMap[ing.id].totalGramos += (parseFloat(ing.gramos) || 0) * factor;
        }
      });
    });

  const srs = Object.values(subRecetasMap);
  if (!srs.length) return '';

  return srs.map(sr => {
    const desglose = calcularDesglose(sr.id, sr.totalGramos);
    const total = desglose.reduce((s, c) => s + c.gramos, 0);
    const claveCheck = `fen_pref_BOL_${obtenerSemanaActual()}_${diaIdxTarget}_${sr.id}`;
    const listo = localStorage.getItem(claveCheck) === '1';

    return `
      <div class="empaste-bloque" style="border-color:#9C27B0;background:linear-gradient(135deg,#F3E5F5,#EDE7F6);${listo?'opacity:.5':''}">
        <div class="empaste-header" style="border-color:rgba(156,39,176,.3)">
          <span class="empaste-icono">🌱</span>
          <div>
            <div class="empaste-titulo" style="color:#4A148C">${sr.nombre}</div>
            <div class="empaste-subtitulo" style="color:#7B1FA2">
              Preparar hoy para producción del ${diasNombres[diaIdxTarget]}
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
            <label class="rdc-check-wrap" onclick="event.stopPropagation()">
              <input type="checkbox" ${listo?'checked':''}
                onchange="localStorage.setItem('${claveCheck}',this.checked?'1':'0');this.closest('.empaste-bloque').style.opacity=this.checked?'.5':'1'">
              <span class="rdc-check-box"></span>
            </label>
            <span class="empaste-total" style="background:rgba(156,39,176,.15);color:#6A1B9A">
              ${formatearGramos(total, true)}
            </span>
          </div>
        </div>
        <div class="empaste-detalle">
          ${desglose.map(comp => `
            <div class="empaste-fila">
              <span>${comp.nombre}</span>
              <span class="empaste-val">${formatearGramos(comp.gramos, true)}</span>
            </div>`).join('')}
          <div class="empaste-fila empaste-total-fila">
            <span>Total</span>
            <span class="empaste-val">${formatearGramos(total, true)}</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ── UTILIDAD: formatear gramos ────────────────────────────────
function formatearGramos(gramos, forzarGramos = false) {
  if (!forzarGramos && gramos >= 10000) return (gramos / 1000).toFixed(2).replace('.', ',') + ' kg';
  return Math.round(gramos) + ' g';
}
