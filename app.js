// ═══════════════════════════════════════════════
//  fën — App principal v1.1
//  Grupo 1: Visual / Grupo 2: Plan semanal
// ═══════════════════════════════════════════════

// ── ESTADO GLOBAL ────────────────────────────────────────────
// Estado local de recetas (sobrevive recargas)
function getEstadoLocal(recetaId) {
  try { return localStorage.getItem('fen_estado_' + recetaId) || null; } catch(e) { return null; }
}
function setEstadoLocal(recetaId, estado) {
  try { localStorage.setItem('fen_estado_' + recetaId, estado); } catch(e) {}
}
function clearEstadoLocal(recetaId) {
  try { localStorage.removeItem('fen_estado_' + recetaId); } catch(e) {}
}

// Aplicar estados locales sobre datos del Sheet
function aplicarEstadosLocales(recetas) {
  return recetas.map(r => {
    const estadoLocal = getEstadoLocal(r.ID_receta);
    if (estadoLocal) {
      return { ...r, estado: estadoLocal };
    }
    return r;
  });
}

const App = {
  rol: null,
  area: null,
  areaCodigo: null,
  vistaActual: null,
  materiasPrimas: [],
  recetas: [],
  planSemana: {},  // { recetaId: [lun,mar,mie,jue,vie,sab,dom] }
};

// ── FORMATO PESO CHILENO ──────────────────────────────────────
function clp(valor) {
  const n = Math.round(parseFloat(valor) || 0);
  return '$' + n.toLocaleString('es-CL');
}

// ── INIT ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  renderLoginCards();
});

function renderLoginCards() {
  const grid = document.getElementById('login-grid');
  grid.innerHTML = '';
  Object.entries(FEN.AREAS).forEach(([codigo, area]) => {
    const card = document.createElement('button');
    card.className = 'login-card';
    card.style.setProperty('--card-color', area.color);
    card.style.setProperty('--card-bg', area.bg);
    card.innerHTML = `
      <div class="lc-icono"><i class="ti ${area.icon}"></i></div>
      <span class="lc-nombre">${area.nombre}</span>
      <span class="lc-desc">Recetas · Planificación · Maestro</span>
    `;
    card.onclick = () => entrar(codigo, 'jefa');
    grid.appendChild(card);
  });
  const admin = document.createElement('button');
  admin.className = 'login-card admin';
  admin.style.setProperty('--card-color', '#003a79');
  admin.style.setProperty('--card-bg', '#e8eef5');
  admin.innerHTML = `
    <div class="lc-icono"><i class="ti ti-shield-check"></i></div>
    <span class="lc-nombre">Administración</span>
    <span class="lc-desc">Aprobaciones · Costos · Materias primas</span>
  `;
  admin.onclick = () => {
    const clave = prompt('Clave de administración:');
    if (clave === null) return;
    if (clave !== 'fen2026admin') { alert('Clave incorrecta'); return; }
    entrar(null, 'admin');
  };
  grid.appendChild(admin);
}

async function entrar(areaCodigo, rol, desdeAdmin = false) {
  App.rol = rol;
  App.areaCodigo = areaCodigo;
  App.area = areaCodigo ? FEN.AREAS[areaCodigo] : null;
  App._desdeAdmin = desdeAdmin;

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const color = App.area?.color || '#003a79';
  const bg    = App.area?.bg    || '#e8eef5';
  document.documentElement.style.setProperty('--area-color', color);
  document.documentElement.style.setProperty('--area-bg', bg);

  document.getElementById('topbar-nombre').textContent = App.area?.nombre || 'Administración';
  document.getElementById('topbar-icon').className = `ti ${App.area?.icon || 'ti-shield-check'}`;
  document.getElementById('topbar-usuario-txt').textContent = rol === 'admin' ? 'Administrador' : `Jefa de ${App.area?.nombre}`;
  document.getElementById('topbar-avatar-txt').textContent = rol === 'admin' ? 'AD' : areaCodigo;

  renderSidebar();
  mostrarLoading('Cargando datos...');
  await cargarMP();
  await cargarRecetas(true);
  await cargarPlanSemana();

  // BOL: cargar plan masas y estado tareas del día actual en background
  if (areaCodigo === 'BOL') {
    const hoy = new Date().getDay();
    const diaIdx = hoy === 0 ? 6 : hoy - 1;
    cargarPlanMasasBOL(); // no await — carga en background
    cargarEstadoTareasBOL(diaIdx); // no await — carga en background
  }

  cargarAvisos(); // no await — carga en background

  ocultarLoading();
  verificarAlertas();

  if (rol === 'admin') navegarA('aprobaciones');
  else navegarA('mis-recetas');
}

// ── VOLVER A ADMIN ───────────────────────────────────────────
async function entrarComoAdmin(areaCodigo) {
  // Admin entra a un área sin clave
  await entrar(areaCodigo, 'jefa', true); // desdeAdmin = true
  // Agregar botón volver en topbar
  setTimeout(() => {
    const syncBtn = document.getElementById('btn-sync-global');
    if (syncBtn && !document.getElementById('btn-volver-admin')) {
      const btnVolver = document.createElement('button');
      btnVolver.id = 'btn-volver-admin';
      btnVolver.className = 'btn-salir';
      btnVolver.style.cssText = 'border-color:rgba(255,255,255,.4);color:#FFD54F';
      btnVolver.innerHTML = '<i class="ti ti-shield-check"></i> Admin';
      btnVolver.onclick = volverAAdmin;
      syncBtn.parentNode.insertBefore(btnVolver, syncBtn);
    }
  }, 100);
}

function volverAAdmin() {
  App.rol = 'admin';
  App.areaCodigo = null;
  App.area = null;
  App._desdeAdmin = false;
  document.documentElement.style.setProperty('--area-color', '#003a79');
  document.documentElement.style.setProperty('--area-bg', '#e8eef5');
  document.getElementById('topbar-nombre').textContent = 'Administración';
  document.getElementById('topbar-icon').className = 'ti ti-shield-check';
  document.getElementById('topbar-usuario-txt').textContent = 'Administrador';
  document.getElementById('topbar-avatar-txt').textContent = 'AD';
  Cache.invalidarTodo();
  renderSidebar();
  actualizarTopbarAdmin();
  navegarA('aprobaciones');
}

function actualizarTopbarAdmin() {
  // Rebuild topbar buttons dynamically
  const topbarRight = document.querySelector('.topbar-right');
  if (!topbarRight) return;
  topbarRight.innerHTML = `
    <div class="topbar-usuario">
      <div class="topbar-avatar"><span id="topbar-avatar-txt">AD</span></div>
      <span id="topbar-usuario-txt">Administrador</span>
    </div>
    <button class="btn-salir" onclick="sincronizarTodo(this)" id="btn-sync-global" title="Sincronizar datos">
      <i class="ti ti-refresh"></i>
    </button>
    <button class="btn-salir" onclick="salir()">
      <i class="ti ti-logout"></i> Salir
    </button>
  `;
}

// ── GET FORZADO PARA OPERACIONES CRÍTICAS ────────────────────
async function getSheet(accion, datos) {
  const body = JSON.stringify({ accion, ...datos });
  // POST no-cors — no retorna respuesta pero sí llega al Sheet
  try {
    await fetch(FEN.WEBAPP_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body
    });
    return { ok: true, msg: 'Enviado' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

// ── SISTEMA DE AVISOS ────────────────────────────────────────
let _avisosCache = [];
let _avisosLeidos = new Set(JSON.parse(localStorage.getItem('fen_avisos_leidos') || '[]'));

async function cargarAvisos() {
  if (!App.areaCodigo) return;
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'leer_avisos',
      area_codigo: App.areaCodigo
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload);
    const data = await res.json();
    if (data.ok) {
      _avisosCache = (data.avisos || []).filter(a => !_avisosLeidos.has(a.id));
      renderAvisos();
    }
  } catch(e) {
    console.warn('[fën] No se pudieron cargar avisos:', e.message);
  }
}

function marcarAvisoLeido(id) {
  _avisosLeidos.add(id);
  localStorage.setItem('fen_avisos_leidos', JSON.stringify([..._avisosLeidos]));
  _avisosCache = _avisosCache.filter(a => a.id !== id);
  renderAvisos();
}

function renderAvisos() {
  // Render in all target containers
  const contenedores = document.querySelectorAll('.avisos-container');
  const avisosPendientes = _avisosCache.filter(a => !_avisosLeidos.has(a.id));

  if (!avisosPendientes.length) {
    contenedores.forEach(c => c.innerHTML = '');
    return;
  }

  const iconos = {
    mp_recibida: { ico: 'ti-clock', color: '#1565C0', bg: '#E3F2FD' },
    mp_aprobada: { ico: 'ti-check', color: '#2E7D32', bg: '#E8F5E9' },
    mp_asignada: { ico: 'ti-link',  color: '#E65100', bg: '#FFF3E0' },
  };

  const html = avisosPendientes.map(a => {
    const cfg = iconos[a.tipo] || { ico: 'ti-bell', color: '#F57C00', bg: '#FFF8E1' };
    return `
      <div class="aviso-card" style="background:${cfg.bg};border-color:${cfg.color}20">
        <i class="ti ${cfg.ico}" style="color:${cfg.color};font-size:16px;flex-shrink:0"></i>
        <span style="flex:1;font-size:13px;color:var(--txt)">${a.mensaje}</span>
        <button onclick="marcarAvisoLeido('${a.id}')"
          style="background:none;border:1px solid ${cfg.color}40;border-radius:var(--r-sm);padding:4px 10px;font-size:11px;color:${cfg.color};cursor:pointer;white-space:nowrap;font-family:inherit">
          Entendido
        </button>
      </div>`;
  }).join('');

  contenedores.forEach(c => { c.innerHTML = html; });
}

// ── SINCRONIZAR TODO ──────────────────────────────────────────
async function sincronizarTodo(btn) {
  const icon = btn.querySelector('i');
  btn.disabled = true;
  icon.style.animation = 'spin .7s linear infinite';
  Cache.invalidarTodo();
  try { localStorage.clear(); } catch(e) {}
  await cargarMP();
  await cargarRecetas();
  await cargarPlanSemana();
  if (App.areaCodigo === 'BOL') {
    await cargarPlanMasasBOL();
    const hoy = new Date().getDay();
    await cargarEstadoTareasBOL(hoy === 0 ? 6 : hoy - 1);
  }
  verificarAlertas();
  // Re-renderizar vista actual
  if (App.vistaActual) navegarA(App.vistaActual);
  btn.disabled = false;
  icon.style.animation = '';
  toast('Datos sincronizados');
}

function salir() {
  App.rol = null; App.area = null; App.areaCodigo = null;
  App.recetas = []; App.planSemana = {};
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';
  if (App.rol === 'jefa') {
    const items = [
      { id: 'nueva-receta',      icon: 'ti-plus',           label: 'Nueva receta / sub receta' },
      { id: 'mis-recetas',       icon: 'ti-clipboard-list', label: 'Mis recetas'        },
      { id: 'planificacion',     icon: 'ti-calendar-week',  label: 'Plan semanal'       },
      { id: 'recetas-del-dia',   icon: 'ti-chef-hat',       label: 'Recetas del día'   },
      { id: 'maestro',           icon: 'ti-book',           label: 'Maestro de recetas' },
    ];
    if (App.areaCodigo === 'CAF') items.splice(2, 2);
    // Pre-elaboraciones BOL — va antes de recetas del día en el push
    if (App.areaCodigo === 'BOL') {
      // Insert pre-elaboraciones after plan semanal (index 2), before recetas del dia (index 3)
      items.splice(3, 0, { id: 'pre-elaboraciones', icon: 'ti-clock-play', label: 'Pre-elaboraciones' });
    }
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL') {
      items.push({ id: 'resumen-semanal',     icon: 'ti-chart-grid-dots', label: 'Resumen semanal' });
      items.push({ id: 'consolidado-mensual', icon: 'ti-calendar-stats',  label: 'Consolidado mensual' });
    }

    if (App.areaCodigo === 'CAF') {
      items.push({ id: 'stock-caf', icon: 'ti-package', label: 'Stock materias primas' });
    }
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL' || App.areaCodigo === 'CAF') {
      items.push({ id: 'config-subrecetas',   icon: 'ti-adjustments',     label: App.areaCodigo === 'CAF' ? 'Configuración' : 'Config sub recetas' });
    }
    items.forEach(item => nav.appendChild(crearNavItem(item)));
  } else {
    [
      { id: 'aprobaciones',   icon: 'ti-check-circle', label: 'Aprobaciones'         },
      { id: 'materias-primas',icon: 'ti-list',          label: 'Materias primas'     },
      { id: 'maestro-admin',  icon: 'ti-book',          label: 'Maestro de recetas'  },
      { id: 'costos',         icon: 'ti-chart-bar',     label: 'Estructuras de costo'},
    ].forEach(item => nav.appendChild(crearNavItem(item)));

    // Area shortcuts for admin
    const divider = document.createElement('div');
    divider.style.cssText = 'font-size:10px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--txt3);padding:14px 12px 6px';
    divider.textContent = 'Ir a área';
    nav.appendChild(divider);

    Object.entries(FEN.AREAS).forEach(([codigo, area]) => {
      const btn = document.createElement('button');
      btn.className = 'nav-item';
      btn.style.setProperty('--area-color', area.color);
      btn.style.setProperty('--area-bg', area.bg);
      btn.innerHTML = `<i class="ti ${area.icon}" style="color:${area.color}"></i> ${area.nombre}`;
      btn.onclick = () => entrarComoAdmin(codigo);
      nav.appendChild(btn);
    });
  }
}

function crearNavItem({ id, icon, label }) {
  const btn = document.createElement('button');
  btn.className = 'nav-item';
  btn.dataset.vista = id;
  btn.innerHTML = `<i class="ti ${icon}"></i> ${label}`;
  btn.onclick = () => navegarA(id);
  return btn;
}

function actualizarNavActivo(vistaId) {
  document.querySelectorAll('.nav-item').forEach(b =>
    b.classList.toggle('active', b.dataset.vista === vistaId));
}

// ── NAVEGACIÓN ────────────────────────────────────────────────
function navegarA(vistaId) {
  // Cancelar navegación automática pendiente
  if (App._navTimer) { clearTimeout(App._navTimer); App._navTimer = null; }
  App.vistaActual = vistaId;
  actualizarNavActivo(vistaId);
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('active'));
  switch(vistaId) {
    case 'nueva-receta':    renderVistaFormReceta(null, 'receta'); break;
    case 'mis-recetas':     renderVistaMisRecetas(); cargarAvisos(); break;
    case 'planificacion':   cargarPlanSemana().then(() => renderVistaPlanificacion()); break;
    case 'recetas-del-dia': renderVistaRecetasDelDia(); cargarAvisos(); break;
    case 'maestro':         renderVistaMaestro(); break;
    case 'aprobaciones':    renderVistaAprobaciones(); break;
    case 'materias-primas': renderVistaMP(); break;
    case 'maestro-admin':   renderVistaMaestroAdmin(); break;
    case 'costos':              renderVistaCostos(); break;
    case 'config-subrecetas':   renderVistaConfigSubrecetas(); break;
    case 'resumen-semanal':     renderVistaResumenSemanal(); break;
    case 'consolidado-mensual': renderVistaConsolidado();    break;
    case 'stock-caf':           renderVistaStockCAF();        break;
    case 'pre-elaboraciones':   renderVistaPreElaboraciones(); break;
    default: mostrarVista('empty');
  }
}

function mostrarVista(id) {
  const v = document.getElementById('vista-' + id);
  if (v) v.classList.add('active');
}

// ── CARGA DE DATOS ────────────────────────────────────────────
async function cargarMP() {
  App.materiasPrimas = await Cache.get('mp_maestro', () => leerHoja('MP_maestro'));
}

async function cargarRecetas(forzar = false) {
  if (!App.areaCodigo) {
    const todas = [];
    for (const codigo of Object.keys(FEN.AREAS)) {
      const r = await leerHoja(FEN.AREAS[codigo].hoja_recetas);
      r.forEach(rec => rec._area = codigo);
      todas.push(...r);
    }
    App.recetas = todas;
  } else {
    const hoja = FEN.AREAS[App.areaCodigo].hoja_recetas;
    const datos = await Cache.get(hoja, () => leerHoja(hoja));
    // Aplicar estados locales sobre los datos del Sheet
    App.recetas = aplicarEstadosLocales(datos);
  }
}

async function cargarPlanSemana() {
  if (!App.areaCodigo || !FEN.AREAS[App.areaCodigo].hoja_plan) return;
  const semana  = obtenerSemanaActual();
  const claveLS = `fen_plan_${App.areaCodigo}_${semana}`;

  // Fuente principal: Sheet (siempre fresco, no usar caché)
  try {
    const hoja     = FEN.AREAS[App.areaCodigo].hoja_plan;
    Cache.invalidar(hoja); // Forzar recarga desde Sheet
    const datos    = await leerHoja(hoja);
    const diasCols = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const planSheet = {};
    datos.filter(f => f.semana_ID === semana).forEach(fila => {
      const rid = fila.ID_receta;
      if (rid) planSheet[rid] = diasCols.map(d => parseInt(fila[d]) || 0);
    });
    if (Object.keys(planSheet).length > 0) {
      App.planSemana = planSheet;
      // Guardar local como caché para carga rápida
      try { localStorage.setItem(claveLS, JSON.stringify(planSheet)); } catch(e) {}
      return;
    }
  } catch(e) {
    console.warn('Sheet no disponible, usando caché local:', e);
  }

  // Fallback: localStorage (mismo dispositivo)
  try {
    const local = localStorage.getItem(claveLS);
    if (local) App.planSemana = JSON.parse(local);
  } catch(e) {}
}

function guardarPlanLocal(plan) {
  const semana  = obtenerSemanaActual();
  const claveLS = `fen_plan_${App.areaCodigo}_${semana}`;
  try { localStorage.setItem(claveLS, JSON.stringify(plan)); } catch(e) {}
}

// ── ALERTAS ───────────────────────────────────────────────────
function verificarAlertas() {
  const enPrueba = App.recetas.filter(r =>
    r.estado === 'en_prueba' || r.estado === 'pendiente_aprobación');
  const alerta = document.getElementById('topbar-alerta');
  if (enPrueba.length > 0 && App.rol === 'jefa') {
    alerta.classList.remove('hidden');
    alerta.querySelector('span').textContent =
      `${enPrueba.length} receta${enPrueba.length > 1 ? 's' : ''} pendiente${enPrueba.length > 1 ? 's' : ''}`;
  } else {
    alerta.classList.add('hidden');
  }
}

// ── FORMULARIO NUEVA / EDITAR RECETA ─────────────────────────
function renderVistaFormReceta(recetaId, tipoForzado) {
  App._recetaEditandoId = recetaId || null;
  // Track area from recipe if admin is editing
  if (recetaId && !App.areaCodigo) {
    const r = App.recetas.find(x => x.ID_receta === recetaId);
    if (r) {
      // Find area code from recipe area name
      App._areaCodigoFormulario = Object.entries(FEN.AREAS).find(([_, a]) => a.nombre === r.área)?.[0] || '';
    }
  } else {
    App._areaCodigoFormulario = App.areaCodigo || '';
  }
  const receta = recetaId ? App.recetas.find(r => r.ID_receta === recetaId) : null;
  const esPan  = App.areaCodigo === 'PAN';
  const esEdicion = !!receta;
  let ingredientes = [], pasos = [];
  if (receta) {
    try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
    pasos = (receta.observaciones_procedimiento || '').split('.').filter(s => s.trim());
  }

  // Determinar tipo: receta o sub_receta
  const tipoActual = tipoForzado || receta?.tipo_receta || 'receta';

  const vista = document.getElementById('vista-form-receta');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${esEdicion ? 'Editar' : 'Nueva'} ${tipoActual === 'sub_receta' ? 'sub receta' : 'receta'}</div>
        <h1 class="vista-titulo">${esEdicion ? receta.nombre : (tipoActual === 'sub_receta' ? 'Crear sub receta' : 'Crear receta')}</h1>
      </div>
    </div>

    ${!esEdicion ? `
    <div class="tipo-selector-wrap">
      <button class="tipo-btn ${tipoActual==='receta'?'tipo-btn-activo':''}"
        onclick="renderVistaFormReceta(null,'receta')">
        <i class="ti ti-clipboard-text"></i>
        <span class="tipo-btn-label">Receta</span>
        <span class="tipo-btn-desc">Va al maestro de recetas y planificación</span>
      </button>
      <button class="tipo-btn ${tipoActual==='sub_receta'?'tipo-btn-activo':''}"
        onclick="renderVistaFormReceta(null,'sub_receta')">
        <i class="ti ti-puzzle"></i>
        <span class="tipo-btn-label">Sub receta</span>
        <span class="tipo-btn-desc">Se convierte en ingrediente para otras recetas</span>
      </button>
    </div>` : ''}

    ${esEdicion && receta.estado === 'en_prueba' ? `
      <div class="alerta-prueba">
        <i class="ti ti-flask"></i>
        <span>Esta ${tipoActual === 'sub_receta' ? 'sub receta' : 'receta'} está <strong>en prueba</strong>. Envíala a revisión cuando esté lista.</span>
      </div>` : ''}
    <input type="hidden" id="f-tipo" value="${tipoActual}">
    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <i class="ti ${tipoActual==='sub_receta'?'ti-puzzle':'ti-info-circle'}"></i>
        Datos ${tipoActual === 'sub_receta' ? 'de la sub receta' : 'generales'}
      </div>
      <div class="form-grid">
        <div class="campo">
          <label>Nombre de la receta <span class="req">*</span></label>
          <input type="text" id="f-nombre" placeholder="Ej: Hogaza clásica" value="${receta?.nombre || ''}">
        </div>
        <div class="campo">
          <label>Estado</label>
          <select id="f-estado">
            <option value="borrador"  ${(!receta || receta.estado==='borrador') ? 'selected':''}>Borrador</option>
            <option value="en_prueba" ${(receta?.estado==='en_prueba' || receta?.estado==='consolidada' || receta?.estado==='pendiente_aprobación') ? 'selected':''}>En prueba</option>
          </select>
          ${esEdicion && receta?.estado==='consolidada' ? '<p style="font-size:11px;color:#F57C00;margin-top:4px"><i class="ti ti-info-circle"></i> Al guardar cambios volverá a "en prueba" para re-aprobación.</p>' : ''}
          ${esEdicion && receta?.estado==='pendiente_aprobación' ? '<p style="font-size:11px;color:#1565C0;margin-top:4px"><i class="ti ti-info-circle"></i> Al guardar cambios volverá a "en prueba" — deberás enviarla de nuevo a revisión.</p>' : ''}
        </div>
        <div class="campo">
          <label>Rendimiento / unidades <span class="req">*</span></label>
          <input type="number" id="f-porciones" placeholder="Ej: 1 (hogaza), 12 (marraquetas)" min="1" value="${receta?.porciones_base || ''}">
        </div>
        ${esPan ? `
        <div class="campo">
          <label>Peso total de harina base (g) <span class="req">*</span></label>
          <input type="number" id="f-harina" placeholder="Ej: 505" min="0"
            value="${receta?.peso_harina_total_g || ''}"
            oninput="actualizarGramosDesdeHarina()">
        </div>` : `
        <div class="campo">
          <label>Área</label>
          <input type="text" readonly value="${FEN.AREAS[App.areaCodigo]?.nombre || ''}">
        </div>`}
        <div class="campo">
          <label>Peso por pieza cruda (g) <span style="color:var(--txt3);font-weight:400;font-size:10px">— calculado</span></label>
          <input type="number" id="f-peso-crudo" placeholder="Auto" readonly
            style="color:var(--txt3);background:var(--bg)"
            value="${receta?.ingredientes_JSON ? (() => { try { const ings = JSON.parse(receta.ingredientes_JSON); const total = ings.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0); return (total/(parseInt(receta.porciones_base)||1)).toFixed(1); } catch(e) { return ''; } })() : ''}">
        </div>
        ${App.areaCodigo === 'BOL' ? `
        <div class="campo">
          <label>% Merma laminado <span style="color:var(--txt3);font-weight:400;font-size:10px">— recortes de borde</span></label>
          <input type="number" id="f-merma-laminado" placeholder="Ej: 8" min="0" max="30" step="0.1"
            value="${receta?.merma_laminado_pct || (cargarConfigSubrecetas().bol?.merma_laminado_ref || 8)}">
        </div>
        <div class="campo">
          <label>Peso pastón listo para cortar (g) <span style="color:var(--txt3);font-weight:400;font-size:10px">— calculado</span></label>
          <input type="number" id="f-peso-paston" placeholder="Auto" readonly
            style="color:#6A1B9A;background:var(--bg);font-weight:500"
            value="${receta?.ingredientes_JSON ? (() => { try {
              const ings = JSON.parse(receta.ingredientes_JSON);
              const total = ings.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0);
              const merma = parseFloat(receta.merma_laminado_pct || 8) / 100;
              return (total * (1 - merma)).toFixed(0);
            } catch(e) { return ''; } })() : ''}">
        </div>` : ''}
        <div class="campo full">
          <label>Descripción / observaciones del proceso</label>
          <textarea id="f-desc" rows="2" placeholder="Describe el proceso, notas importantes...">${receta?.observaciones_procedimiento || ''}</textarea>
        </div>
        <div class="campo full">
          <label>Notas de sistematización</label>
          <textarea id="f-notas" rows="2" placeholder="Ajustes realizados durante pruebas...">${receta?.sistematización_notas || ''}</textarea>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <i class="ti ti-basket"></i> Ingredientes
        <button class="btn-agregar-fila" onclick="agregarIngrediente()" style="margin-left:auto">
          <i class="ti ti-plus"></i> Agregar
        </button>
      </div>
      <div class="tabla-wrap">
        <table class="tabla-ingr">
          <thead>
            <tr>
              <th style="min-width:200px">Ingrediente</th>
              <th>Gramos <span style="font-size:9px;color:var(--txt3);font-weight:400">(usar .)</span></th>
              ${esPan ? '<th style="color:var(--area-color)">% panadero</th>' : ''}
              <th></th>
            </tr>
          </thead>
          ${esPan ? `<tfoot><tr><td colspan="4" style="padding:6px 12px;font-size:11px;color:var(--txt3)">
            <i class="ti ti-info-circle"></i> Puedes ingresar el % y los gramos se calculan solos, o viceversa.
          </td></tr></tfoot>` : ''}
          <tbody id="tbody-ingr"></tbody>
        </table>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <i class="ti ti-list-numbers"></i> Pasos de preparación
        <button class="btn-agregar-fila" onclick="agregarPaso()" style="margin-left:auto">
          <i class="ti ti-plus"></i> Agregar paso
        </button>
      </div>
      <div id="contenedor-pasos"></div>
    </div>

    <div class="form-acciones">
      <div>
        ${esEdicion && receta.estado === 'en_prueba' ? `
          <button class="btn-secundario" onclick="enviarARevision('${recetaId}')">
            <i class="ti ti-send"></i> Enviar a revisión
          </button>` : ''}
      </div>
      <div class="form-acciones-der">
        <button class="btn-secundario" onclick="navegarA('mis-recetas')">Cancelar</button>
        <button class="btn-primario" onclick="guardarReceta('${recetaId || ''}')">
          <i class="ti ti-device-floppy"></i> ${esEdicion ? 'Guardar cambios' : 'Crear receta'}
        </button>
      </div>
    </div>
  `;

  if (ingredientes.length > 0) ingredientes.forEach(ing => agregarIngrediente(ing));
  else { agregarIngrediente(); agregarIngrediente(); agregarIngrediente(); }

  if (pasos.length > 0) pasos.forEach(p => agregarPaso(typeof p === 'string' ? p : ''));
  else { agregarPaso(); agregarPaso(); }

  mostrarVista('form-receta');
}

// ── INGREDIENTES ──────────────────────────────────────────────
function agregarIngrediente(data = {}) {
  const esPan = App.areaCodigo === 'PAN';
  const tbody = document.getElementById('tbody-ingr');
  const tr = document.createElement('tr');
  const areaCode = App.areaCodigo || '';
  const mpActivas  = App.materiasPrimas.filter(m =>
    m.estado === 'activa' && m.tipo !== 'sub_receta' &&
    (!m.areas_habilitadas || m.areas_habilitadas.split(',').map(a=>a.trim()).includes(areaCode))
  );
  const subRecetas = App.materiasPrimas.filter(m =>
    m.estado === 'activa' && m.tipo === 'sub_receta' &&
    (!m.areas_habilitadas || m.areas_habilitadas.split(',').map(a=>a.trim()).includes(areaCode))
  );

  const optionsMP = mpActivas.map(m =>
    `<option value="${m.ID_MP}" data-costo="${m.costo_por_gramo || 0}"
      ${m.ID_MP === data.id ? 'selected' : ''}>${m.nombre}</option>`
  ).join('');

  const optionsSR = subRecetas.length
    ? `<optgroup label="⟳ Sub recetas">
        ${subRecetas.map(m =>
          `<option value="${m.ID_MP}" data-costo="${m.costo_por_gramo || 0}"
            ${m.ID_MP === data.id ? 'selected' : ''}>⟳ ${m.nombre}</option>`
        ).join('')}
      </optgroup>`
    : '';

  const options = optionsMP + optionsSR;

  const esBOL = App.areaCodigo === 'BOL';
  // Para BOL, detectar si el ingrediente es sub receta (puede ser en unidades)
  const esSubRecetaIngr = data.id && (subRecetas.some(sr => sr.ID_MP === data.id));
  const usaUnidades = esBOL && esSubRecetaIngr && (data.unidades !== undefined ? data.unidades : true);

  tr.innerHTML = `
    <td>
      <select onchange="onChangeIngredienteSelect(this)">
        <option value="">— Seleccionar —</option>
        ${options}
        <option value="__nueva__">+ Solicitar / habilitar MP...</option>
      </select>
    </td>
    ${esBOL ? `
    <td>
      <select class="sel-unidad-tipo" onchange="toggleUnidadTipo(this)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit">
        <option value="gramos" ${!usaUnidades?'selected':''}>Gramos</option>
        <option value="unidades" ${usaUnidades?'selected':''}>Unidades</option>
      </select>
    </td>` : ''}
    <td><input type="number" placeholder="${usaUnidades?'1':'0'}"
      value="${usaUnidades ? (data.unidades||'') : (data.gramos ? parseFloat(data.gramos).toFixed(1) : '')}"
      min="0" step="${usaUnidades?'1':'0.01'}"
      oninput="${esPan ? 'desdeGramos(this)' : ''}"
      style="max-width:90px"
      data-modo="${usaUnidades ? 'unidades' : 'gramos'}">
    </td>
    ${esPan ? `<td><input type="number" placeholder="0.00"
      value="${data.pct ? (data.pct*100).toFixed(2) : ''}"
      step="0.01" style="max-width:70px;color:var(--area-color);font-weight:500"
      oninput="desdePct(this)" title="% relativo al peso de harina"></td>` : ''}
    <td><button class="btn-fila-del" onclick="this.closest('tr').remove()"
      aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(tr);
}

function calcularCostoFila(el) {
  const tr = el.closest('tr');
  const select = tr.querySelector('select');
  if (select.value === '__nueva__') { solicitarNuevaMP(); select.value = ''; return; }
}

function onChangeIngredienteSelect(sel) {
  if (sel.value === '__nueva__') { solicitarNuevaMP(); sel.value = ''; return; }
  // Auto-switch to unidades if sub receta in BOL
  if (App.areaCodigo === 'BOL') {
    const esSR = App.materiasPrimas.find(m => m.ID_MP === sel.value && (m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR')));
    const tipoSel = sel.closest('tr').querySelector('.sel-unidad-tipo');
    if (tipoSel && esSR) tipoSel.value = 'unidades';
    else if (tipoSel) tipoSel.value = 'gramos';
    toggleUnidadTipo(tipoSel);
  }
  if (App.areaCodigo === 'PAN') desdeGramos(sel.closest('tr').querySelector('input[type="number"]'));
}

function toggleUnidadTipo(sel) {
  if (!sel) return;
  const tr = sel.closest('tr');
  const input = tr.querySelector('input[data-modo]');
  if (!input) return;
  const modo = sel.value;
  input.dataset.modo = modo;
  input.placeholder = modo === 'unidades' ? '1' : '0';
  input.step = modo === 'unidades' ? '1' : '0.01';
  input.value = '';
}

// Ingresa gramos → calcula %
function desdeGramos(inputGr) {
  if (App.areaCodigo !== 'PAN') return;
  const tr       = inputGr.closest('tr');
  const inputPct = tr.querySelectorAll('input[type="number"]')[1];
  if (!inputPct) return;
  const pesoHarina = parseFloat(document.getElementById('f-harina')?.value) || 0;
  if (!pesoHarina) return;
  const gramos = parseFloat(inputGr.value) || 0;
  inputPct.value = (gramos / pesoHarina * 100).toFixed(2);
}

// Ingresa % → calcula gramos
function desdePct(inputPct) {
  if (App.areaCodigo !== 'PAN') return;
  const tr       = inputPct.closest('tr');
  const inputGr  = tr.querySelectorAll('input[type="number"]')[0];
  if (!inputGr) return;
  const pesoHarina = parseFloat(document.getElementById('f-harina')?.value) || 0;
  if (!pesoHarina) { inputGr.value = ''; return; }
  const pct = parseFloat(inputPct.value) || 0;
  inputGr.value = (pesoHarina * pct / 100).toFixed(1);
}

// Al cambiar el peso de harina base → recalcular todos los gramos desde sus %
function actualizarGramosDesdeHarina() {
  const pesoHarina = parseFloat(document.getElementById('f-harina')?.value) || 0;
  if (!pesoHarina) return;
  document.querySelectorAll('#tbody-ingr tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input[type="number"]');
    if (inputs.length >= 2) {
      const pct = parseFloat(inputs[1].value) || 0;
      if (pct > 0) inputs[0].value = (pesoHarina * pct / 100).toFixed(1);
    }
  });
}

function actualizarPctPanadero() { actualizarGramosDesdeHarina(); }

// ── PASOS ─────────────────────────────────────────────────────
function agregarPaso(texto = '') {
  const contenedor = document.getElementById('contenedor-pasos');
  const idx = contenedor.children.length + 1;
  const div = document.createElement('div');
  div.className = 'paso-fila';
  div.innerHTML = `
    <div class="paso-num">${idx}</div>
    <textarea placeholder="Describe este paso..." rows="2">${texto}</textarea>
    <button class="btn-fila-del" onclick="this.closest('.paso-fila').remove();renumerarPasos()"
      aria-label="Eliminar paso"><i class="ti ti-x"></i></button>
  `;
  contenedor.appendChild(div);
}

function renumerarPasos() {
  document.querySelectorAll('.paso-num').forEach((el, i) => el.textContent = i + 1);
}

// ── GUARDAR RECETA ────────────────────────────────────────────
async function guardarReceta(recetaId) {
  const esEdicion = !!recetaId;
  const nombre    = document.getElementById('f-nombre').value.trim();
  const porciones = document.getElementById('f-porciones').value;
  if (!nombre)   { toast('El nombre es requerido', 'error'); return; }
  if (!porciones){ toast('El rendimiento es requerido', 'error'); return; }

  const ingredientes = [];
  document.querySelectorAll('#tbody-ingr tr').forEach(tr => {
    const select = tr.querySelector('select');
    const inputs = tr.querySelectorAll('input[type="number"]');
    if (select?.value && select.value !== '__nueva__') {
      const opcion = select.options[select.selectedIndex];
      const costoPorGramo = parseFloat(opcion.dataset.costo) || 0;
      const gramos = parseFloat(inputs[0]?.value) || 0;
      const tipoSel = tr.querySelector('.sel-unidad-tipo');
      const modoInput = tipoSel ? tipoSel.value : 'gramos';
      const valorInput = parseFloat(inputs[0]?.value) || 0;
      const unidades = modoInput === 'unidades' ? valorInput : null;

      // Si es unidades, buscar gramos desde sub receta para referencia
      let gramosCalc = gramos;
      if (modoInput === 'unidades' && valorInput > 0) {
        const nombreSR = opcion.text.replace('⟳ ','');
        const srReceta = App.recetas.find(r =>
          r.nombre === nombreSR && r.estado === 'consolidada'
        );
        if (srReceta) {
          let ingsR = [];
          try { ingsR = JSON.parse(srReceta.ingredientes_JSON || '[]'); } catch(e) {}
          const pesoUnitario = ingsR.reduce((s,i) => s+(parseFloat(i.gramos)||0), 0);
          gramosCalc = pesoUnitario * valorInput;
        } else {
          gramosCalc = valorInput; // sin sub receta: guardar valor numérico
        }
      }

      ingredientes.push({
        id:       select.value,
        nombre:   opcion.text.replace('⟳ ',''),
        gramos:   gramosCalc,
        unidades: unidades, // null = gramos, número = unidades
        pct:      App.areaCodigo === 'PAN' ? ((parseFloat(inputs[1]?.value) || 0) / 100) : 0,
        costo:    costoPorGramo * gramosCalc,
      });
    }
  });

  const pasos = [];
  document.querySelectorAll('#contenedor-pasos textarea').forEach(ta => {
    if (ta.value.trim()) pasos.push(ta.value.trim());
  });

  const tipoReceta = document.getElementById('f-tipo')?.value || 'receta';
  const datos = {
    ID_receta:                   recetaId || generarId(App.areaCodigo),
    nombre,
    estado:                      (() => {
      const sel = document.getElementById('f-estado').value;
      // Si es edición y receta ya estaba en prueba/pendiente, mantener en_prueba
      if (esEdicion) {
        const recetaActual = App.recetas.find(r => r.ID_receta === recetaId);
        if (recetaActual?.estado === 'pendiente_aprobación') return 'en_prueba';
      }
      return sel || 'borrador';
    })(),
    área:                        App.area.nombre,
    porciones_base:              parseInt(porciones),
    peso_harina_total_g:         App.areaCodigo === 'PAN' ? (document.getElementById('f-harina')?.value || '') : '',
    ingredientes_JSON:           JSON.stringify(ingredientes),
    observaciones_procedimiento: document.getElementById('f-desc').value.trim(),
    'sistematización_notas':     document.getElementById('f-notas').value.trim(),
    merma_laminado_pct:          document.getElementById('f-merma-laminado')?.value || '',
    tipo_receta:                 tipoReceta,
    versión:                     recetaId ? ((App.recetas.find(r=>r.ID_receta===recetaId)?.versión || 1) + 1) : 1,
    hoja:                        App.area.hoja_recetas,
    esEdicion:                   !!recetaId,
  };

  const btnGuardar = document.querySelector('#vista-form-receta .btn-primario');
  bloquearBtn(btnGuardar, esEdicion ? 'Guardando cambios...' : 'Creando receta...');

  try {
    const resultado = await escribirEnSheet('guardar_receta', datos);
    if (!resultado || resultado.ok === false) {
      throw new Error(resultado?.msg || 'Error desconocido');
    }

    // Guardar estado en localStorage
    setEstadoLocal(datos.ID_receta, datos.estado);
    // Actualizar estado local
    if (recetaId) {
      const idx = App.recetas.findIndex(r => r.ID_receta === recetaId);
      if (idx >= 0) App.recetas[idx] = { ...App.recetas[idx], ...datos };
    } else {
      App.recetas.push(datos);
    }

    verificarAlertas();
    desbloquearBtn(btnGuardar, esEdicion
      ? '<i class="ti ti-device-floppy"></i> Guardar cambios'
      : '<i class="ti ti-device-floppy"></i> Crear receta', true);
    toast(recetaId ? 'Receta actualizada' : 'Receta creada');
    App._navTimer = setTimeout(() => navegarA('mis-recetas'), 1500);

  } catch(e) {
    console.error('Error guardando receta:', e);
    desbloquearBtn(btnGuardar, esEdicion
      ? '<i class="ti ti-device-floppy"></i> Guardar cambios'
      : '<i class="ti ti-device-floppy"></i> Crear receta', false);
    toast('Error al guardar: ' + e.message, 'error');
  }
}

async function enviarARevision(recetaId) {
  const btn = document.querySelector(`[onclick="enviarARevision('${recetaId}')"]`);
  bloquearBtn(btn, 'Enviando...');

  // Guardar estado en localStorage (persiste recargas)
  setEstadoLocal(recetaId, 'pendiente_aprobación');
  console.log('[fën] Verificacion localStorage:', getEstadoLocal(recetaId));
  // Actualizar estado local en memoria
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (r) r.estado = 'pendiente_aprobación';
  verificarAlertas();

  // Enviar al Sheet en segundo plano
  escribirEnSheet('cambiar_estado', {
    ID_receta: recetaId, estado: 'pendiente_aprobación', hoja: App.area.hoja_recetas
  }).catch(e => console.warn('Error actualizando Sheet:', e));

  desbloquearBtn(btn, '<i class="ti ti-send"></i> Enviar a revisión', true);
  toast('Receta enviada a revisión');
  setTimeout(() => {
    renderVistaMisRecetas();
    mostrarVista('mis-recetas');
    actualizarNavActivo('mis-recetas');
    App.vistaActual = 'mis-recetas';
  }, 800);
}

// ── VISTA MIS RECETAS ─────────────────────────────────────────
function renderVistaMisRecetas() {
  console.log("[fën] renderVistaMisRecetas - estados:", App.recetas.map(r => r.ID_receta + ":" + r.estado).join(", "));
  const recetas = App.recetas;
  const vista = document.getElementById('vista-mis-recetas');
  const enPrueba = recetas.filter(r => r.estado === 'en_prueba');

  vista.innerHTML = `
    <div class="avisos-container" style="margin-bottom:12px"></div>
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre || ''}</div>
        <h1 class="vista-titulo">Mis recetas</h1>
      </div>
      <button class="btn-primario" onclick="navegarA('nueva-receta')">
        <i class="ti ti-plus"></i> Nueva receta
      </button>
    </div>
    ${enPrueba.length ? `
      <div class="alerta-prueba">
        <i class="ti ti-flask"></i>
        <span>Tienes <strong>${enPrueba.length} receta${enPrueba.length>1?'s':''} en prueba</strong>.
        Envíalas a administración cuando estén listas.</span>
      </div>` : ''}
    ${!recetas.length ? `
      <div class="empty-state">
        <i class="ti ti-clipboard-list"></i>
        <h2>Sin recetas aún</h2>
        <p>Crea tu primera receta para empezar</p>
      </div>` : `
      <div class="card">
        <div class="card-head"><i class="ti ti-clipboard-list"></i> Todas las recetas (${recetas.length})</div>
        <table class="tabla-vista">
          <thead><tr>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Receta</th>
            <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Estado</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Acciones</th>
          </tr></thead>
          <tbody>
            ${recetas.map(r => {
              const est = FEN.ESTADOS[r.estado] || FEN.ESTADOS.borrador;
              const esConsolidada = r.estado === 'consolidada';
              return `<tr>
                <td class="td-nombre">
                  ${r.nombre || r.ID_receta}
                  <span style="font-size:10px;padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600;
                    background:${r.tipo_receta==='sub_receta'?'#EDE9FE':'#E8F5E9'};
                    color:${r.tipo_receta==='sub_receta'?'#5B21B6':'#166534'}">
                    ${r.tipo_receta==='sub_receta'?'⟳ Sub receta':'Receta'}
                  </span>
                  ${esConsolidada ? '<span style="font-size:10px;color:#2E7D32;margin-left:4px"><i class="ti ti-lock"></i></span>' : ''}
                </td>
                <td style="text-align:center">
                  <span class="estado-badge" style="color:${est.color};background:${est.bg}">${est.label}</span>
                </td>
                <td style="text-align:right;padding:6px 16px">
                  <button class="btn-secundario" style="font-size:12px;padding:5px 12px"
                    onclick="verReceta('${r.ID_receta}')"><i class="ti ti-eye"></i> Ver</button>
                  <button class="btn-secundario" style="font-size:12px;padding:5px 12px;margin-left:6px"
                    onclick="renderVistaFormReceta('${r.ID_receta}');mostrarVista('form-receta')">
                    <i class="ti ti-edit"></i> Editar${esConsolidada ? '*' : ''}</button>
                </td>
              </tr>`;
            }).join('')}
            ${recetas.some(r => r.estado === 'consolidada') ? '<tr><td colspan="3" style="padding:8px 16px;font-size:11px;color:var(--txt3)">* Editar una receta consolidada la enviará a re-aprobación.</td></tr>' : ''}
          </tbody>
        </table>
      </div>`}
  `;
  mostrarVista('mis-recetas');
}

// ── VER RECETA ────────────────────────────────────────────────
function verReceta(recetaId) {
  // Cancelar navegación automática pendiente
  if (App._navTimer) { clearTimeout(App._navTimer); App._navTimer = null; }
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;
  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
  const esPan = App.areaCodigo === 'PAN';
  const est   = FEN.ESTADOS[r.estado] || FEN.ESTADOS.borrador;

  const vista = document.getElementById('vista-ver-receta');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="estado-badge" style="color:${est.color};background:${est.bg}">${est.label}</span>
        </div>
        <h1 class="vista-titulo">${r.nombre}</h1>
        <div class="meta-chips">
          <span class="chip"><i class="ti ti-box"></i>${r.porciones_base} unidad${parseInt(r.porciones_base)>1?'es':''}</span>
          ${esPan && r.peso_harina_total_g ? `<span class="chip"><i class="ti ti-weight"></i>${r.peso_harina_total_g}g harina base</span>` : ''}
          <span class="chip"><i class="ti ti-versions"></i>v${r.versión || 1}</span>
        </div>
      </div>
      <div class="vista-acciones">
        <button class="btn-secundario"
          onclick="renderVistaFormReceta('${recetaId}');mostrarVista('form-receta')">
          <i class="ti ti-edit"></i> Editar${r.estado === 'consolidada' ? '*' : ''}
        </button>
        ${(r.estado === 'en_prueba') ? `
          <button class="btn-primario" onclick="enviarARevision('${recetaId}')">
            <i class="ti ti-send"></i> Enviar a revisión
          </button>` : ''}
      </div>
    </div>

    ${r.observaciones_procedimiento ? `
      <div style="background:var(--bg);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;
        font-size:13px;color:var(--txt2);line-height:1.65">${r.observaciones_procedimiento}</div>` : ''}

    ${(() => {
      const totalIngr = ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0);
      const porciones = parseInt(r.porciones_base)||1;
      const pesoCrudoTotal = totalIngr;
      const pesoCrudoPieza = (totalIngr/porciones).toFixed(1);
      const esBOL = App.areaCodigo === 'BOL';
      const mermaLaminado = esBOL ? parseFloat(r.merma_laminado_pct||8) : 0;
      const pesoPaston = esBOL ? (totalIngr * (1 - mermaLaminado/100)).toFixed(0) : null;
      const pesoPastonPieza = esBOL ? (pesoPaston / porciones).toFixed(1) : null;
      return `
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-val azul">${r.porciones_base}</div>
          <div class="stat-lbl">Rendimiento (unidades)</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${pesoCrudoPieza}g</div>
          <div class="stat-lbl">Peso crudo por pieza</div>
        </div>
        ${esBOL ? `
        <div class="stat-card">
          <div class="stat-val" style="color:#6A1B9A">${pesoPastonPieza}g</div>
          <div class="stat-lbl">Peso pastón listo/pieza</div>
        </div>
        <div class="stat-card">
          <div class="stat-val" style="color:#C62828">${mermaLaminado}%</div>
          <div class="stat-lbl">Merma laminado</div>
        </div>` : `
        <div class="stat-card">
          <div class="stat-val">${ingredientes.length}</div>
          <div class="stat-lbl">Ingredientes</div>
        </div>
        <div class="stat-card">
          <div class="stat-val">${r.versión||1}</div>
          <div class="stat-lbl">Versión</div>
        </div>`}
      </div>`;
    })()}

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-basket"></i> Ingredientes</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Ingrediente</th>
          <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Gramos</th>
          ${esPan ? `<th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">% panadero</th>` : ''}
        </tr></thead>
        <tbody>
          ${ingredientes.map(ing => `
            <tr>
              <td class="td-nombre">${ing.nombre}</td>
              <td class="td-num">${parseFloat(ing.gramos||0).toFixed(0)}g</td>
              ${esPan ? `<td class="td-pct">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
            </tr>`).join('')}
          <tr style="background:var(--bg);font-weight:600">
            <td style="padding:8px 16px">Total ingredientes</td>
            <td class="td-num" style="padding:8px 16px">
              ${ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(0)}g</td>
            ${esPan ? '<td></td>' : ''}
          </tr>
        </tbody>
      </table>
    </div>

    ${r['sistematización_notas'] ? `
      <div class="card">
        <div class="card-head"><i class="ti ti-notes"></i> Notas de sistematización</div>
        <div class="card-body" style="font-size:13px;color:var(--txt2);line-height:1.7">
          ${r['sistematización_notas']}</div>
      </div>` : ''}
  `;
  mostrarVista('ver-receta');
}

// ── FUNCIONES RECETAS DEL DÍA ────────────────────────────────

function claveEstadoDia(recetaId, diaIdx) {
  const semana = obtenerSemanaActual();
  return `fen_dia_${App.areaCodigo}_${semana}_${diaIdx}_${recetaId}`;
}

function obtenerEstadoTerminada(recetaId, diaIdx) {
  try { return localStorage.getItem(claveEstadoDia(recetaId, diaIdx) + '_done') === '1'; } catch(e) { return false; }
}

function obtenerNotaDia(recetaId, diaIdx) {
  try { return localStorage.getItem(claveEstadoDia(recetaId, diaIdx) + '_nota') || ''; } catch(e) { return ''; }
}

function marcarTerminada(recetaId, terminada) {
  // Guardar estado
  try { localStorage.setItem(claveEstadoDia(recetaId, App._diaActual || 0) + '_done', terminada ? '1' : '0'); } catch(e) {}

  const card    = document.getElementById('card-' + recetaId);
  const ingr    = document.getElementById('ingr-' + recetaId);
  const nombre  = document.getElementById('nombre-' + recetaId);
  const chev    = document.getElementById('chev-' + recetaId);

  if (terminada) {
    card.classList.add('rdc-terminada');
    if (ingr)   { ingr.style.display = 'none'; }
    if (chev)   { chev.className = 'ti ti-check rdc-chevron'; chev.style.color = '#2E7D32'; }
    if (nombre) { nombre.style.textDecoration = 'line-through'; nombre.style.color = 'var(--txt3)'; }
  } else {
    card.classList.remove('rdc-terminada');
    if (ingr)   { ingr.style.display = 'block'; }
    if (chev)   { chev.className = 'ti ti-chevron-down rdc-chevron'; chev.style.color = ''; }
    if (nombre) { nombre.style.textDecoration = ''; nombre.style.color = ''; }
  }
}

function toggleIngredientes(recetaId) {
  const check = document.getElementById('check-' + recetaId);
  if (check?.checked) return; // Si está terminada no colapsar/expandir
  const ingr = document.getElementById('ingr-' + recetaId);
  const chev = document.getElementById('chev-' + recetaId);
  if (!ingr) return;
  const visible = ingr.style.display !== 'none';
  ingr.style.display = visible ? 'none' : 'block';
  if (chev) chev.style.transform = visible ? 'rotate(-90deg)' : '';
}

function toggleSeccion(id, btn) {
  const el   = document.getElementById(id);
  const icon = btn.querySelector('.rdc-toggle-icon');
  if (!el) return;
  const abierto = el.classList.contains('abierto');
  el.classList.toggle('abierto', !abierto);
  if (icon) icon.style.transform = abierto ? '' : 'rotate(90deg)';
}

let _notaTimer = {};
function autoguardarNota(recetaId) {
  clearTimeout(_notaTimer[recetaId]);
  _notaTimer[recetaId] = setTimeout(() => {
    const ta  = document.getElementById('textarea-notas-' + recetaId);
    const dia = App._diaActual || 0;
    if (ta) {
      try { localStorage.setItem(claveEstadoDia(recetaId, dia) + '_nota', ta.value); } catch(e) {}
    }
  }, 800);
}

// ── PLAN MASAS BASE BOL ──────────────────────────────────────
function renderPlanMasasBOL() {
  const cfg = cargarConfigSubrecetas();
  const bolCfg = cfg.bol || {};
  const maxPorTanda = bolCfg.amasadora_max_por_tanda || 16;
  const tandasDia   = bolCfg.amasadora_tandas_dia || 2;
  const maxDia      = maxPorTanda * tandasDia;
  const planMasas   = bolCfg.plan_masas || {};
  const diasNombres = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  // Detectar sub recetas de masa base (pastones, no poolish)
  const masasBase = App.materiasPrimas.filter(m => {
    const esSubReceta = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    const esMasa = nombre.includes('masa') && !nombre.includes('madre') && !nombre.includes('poolish');
    const esBOL = !m.areas_habilitadas || m.areas_habilitadas.includes('BOL');
    return esSubReceta && esMasa && esBOL;
  });

  if (!masasBase.length) return `
    <div class="card" style="margin-bottom:16px;border-color:#F3E5F5">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-stack-2"></i> Plan de masas base
      </div>
      <div style="padding:16px;font-size:13px;color:var(--txt2)">
        No hay masas base configuradas. Crea sub recetas de tipo masa en Bollería.
      </div>
    </div>`;

  return `
    <div class="card" style="margin-bottom:16px;border-color:#E1BEE7">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-stack-2"></i> Plan de masas base
        <span style="font-size:11px;font-weight:400;color:#7B1FA2;margin-left:8px">
          Máx. ${maxDia} masas/día (${tandasDia} tandas × ${maxPorTanda})
        </span>
        <button class="btn-secundario" onclick="calcularPlanMasasAuto()"
          style="margin-left:auto;font-size:12px;padding:4px 10px;border-color:#CE93D8;color:#6A1B9A">
          <i class="ti ti-calculator"></i> Calcular automático
        </button>
      </div>
      <div style="overflow-x:auto">
        <table class="plan-tabla">
          <thead>
            <tr>
              <th class="th-nombre">Masa base</th>
              ${diasNombres.map((d,i) => `<th style="min-width:70px;text-align:center">${d}</th>`).join('')}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${masasBase.map(m => {
              const plan = planMasas[m.ID_MP] || Array(7).fill(maxDia);
              return `<tr>
                <td class="td-nombre">${m.nombre}</td>
                ${diasNombres.map((_,i) => `
                  <td style="text-align:center">
                    <input type="number" min="0" max="${maxDia}" placeholder="${maxDia}"
                      data-masa="${m.ID_MP}" data-dia="${i}"
                      value="${plan[i] !== undefined ? plan[i] : maxDia}"
                      style="width:60px;text-align:center;padding:4px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit"
                      oninput="actualizarTotalMasaFila(this)">
                  </td>`).join('')}
                <td class="td-total" id="total-masa-${m.ID_MP}">
                  ${plan.reduce((s,v)=>s+(v||maxDia),0)}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:10px 16px;font-size:11px;color:var(--txt3)">
        <i class="ti ti-info-circle"></i>
        El plan de masas determina las tandas de elaboración y el poolish del día anterior.
        Se guarda junto con el plan de producción.
      </div>
    </div>`;
}

function actualizarTotalMasaFila(input) {
  const mid = input.dataset.masa;
  const inputs = document.querySelectorAll(`input[data-masa="${mid}"]`);
  const total = Array.from(inputs).reduce((s,el) => s + (parseInt(el.value)||0), 0);
  const span = document.getElementById('total-masa-' + mid);
  if (span) span.textContent = total;
}

function calcularPlanMasasAuto() {
  const cfg = cargarConfigSubrecetas();
  const bolCfg = cfg.bol || {};
  const maxPorTanda = bolCfg.amasadora_max_por_tanda || 16;
  const tandasDia   = bolCfg.amasadora_tandas_dia || 2;
  const maxDia      = maxPorTanda * tandasDia;
  const capCongelacion = bolCfg.capacidad_congelacion_masas || 40;
  const stockMasas  = bolCfg.stock_masas || {};

  // Para cada masa base calcular demanda por día desde plan de productos
  const masasBase = App.materiasPrimas.filter(m => {
    const esSubReceta = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    return esSubReceta && nombre.includes('masa') && !nombre.includes('madre') && !nombre.includes('poolish') &&
      (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });

  masasBase.forEach(masa => {
    let stockActual = stockMasas[masa.ID_MP] || 0;
    const planCalculado = Array(7).fill(0);

    for (let dia = 0; dia < 7; dia++) {
      // Demanda del día: masas necesarias según plan de productos
      let demanaDia = 0;
      Object.entries(App.planSemana).forEach(([rid, cant]) => {
        const unidades = cant[dia] || 0;
        if (!unidades) return;
        const receta = App.recetas.find(r => r.ID_receta === rid);
        if (!receta) return;
        let ingredientes = [];
        try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
        const porciones = parseInt(receta.porciones_base) || 1;
        ingredientes.forEach(ing => {
          if (ing.id === masa.ID_MP) {
            demanaDia += Math.ceil((parseFloat(ing.gramos)||1) / porciones * unidades);
          }
        });
      });

      // Descontar stock disponible
      const masasNetas = Math.max(0, demanaDia - stockActual);
      stockActual = Math.max(0, stockActual - demanaDia);

      // Calcular cuánto elaborar: llenar al tope sin superar capacidad congelación
      const espacioCongelador = capCongelacion - stockActual;
      const aElaborar = Math.min(maxDia, Math.max(masasNetas, Math.min(espacioCongelador, maxDia)));
      planCalculado[dia] = Math.max(0, aElaborar);
      stockActual += aElaborar;
    }

    // Actualizar inputs
    document.querySelectorAll(`input[data-masa="${masa.ID_MP}"]`).forEach((inp, i) => {
      inp.value = planCalculado[i];
    });
    actualizarTotalMasaFila(document.querySelector(`input[data-masa="${masa.ID_MP}"]`));
  });

  toast('Plan calculado automáticamente — revisa y guarda');
}

// ── PLANIFICACIÓN SEMANAL ─────────────────────────────────────
function renderVistaPlanificacion() {
  const recetasConsolidadas = App.recetas.filter(r => r.estado === 'consolidada' && r.tipo_receta !== 'sub_receta');
  const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const hoy  = new Date().getDay();
  const diaIdx = hoy === 0 ? 6 : hoy - 1;
  const semana = obtenerSemanaActual();

  const vista = document.getElementById('vista-planificacion');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre} · Semana ${semana}</div>
        <h1 class="vista-titulo">Plan semanal</h1>
      </div>
      <div style="display:flex;gap:8px">
        ${App.areaCodigo === 'BOL' ? `
        <button class="btn-secundario" onclick="editarStockBOL()" style="border-color:#90CAF9;color:#1565C0">
          <i class="ti ti-snowflake"></i> Stock congelado
        </button>` : ''}
        <button class="btn-secundario" onclick="sincronizarPlan(this)" id="btn-sync-plan">
          <i class="ti ti-refresh"></i> Sincronizar
        </button>
        <button class="btn-primario" onclick="guardarPlanificacion()">
          <i class="ti ti-device-floppy"></i> Guardar plan
        </button>
      </div>
    </div>
    <p style="font-size:12px;color:var(--txt3);margin-bottom:14px">
      <i class="ti ti-info-circle"></i>
      El plan se guarda por semana. Puedes modificarlo en cualquier momento — los cambios se reflejan en "Recetas del día".
    </p>

    ${!recetasConsolidadas.length ? `
      <div class="empty-state">
        <i class="ti ti-calendar-off"></i>
        <h2>Sin recetas consolidadas</h2>
        <p>Solo puedes planificar recetas aprobadas en el maestro.</p>
      </div>` : `
      <div class="plan-tabla-wrap">
        <table class="plan-tabla">
          <thead>
            <tr>
              <th class="th-nombre">Producto</th>
              ${dias.map((d,i) => `<th class="${i===diaIdx?'dia-hoy':''}" style="${i===diaIdx?'font-size:13px;font-weight:700;':''}">${i===diaIdx?'&#9655; '+d:d}</th>`).join('')}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${(() => {
              const cfg = (typeof cargarConfigSubrecetas === 'function') ? cargarConfigSubrecetas() : {};
              const stock = (App.areaCodigo === 'BOL' && cfg.bol?.stock) ? cfg.bol.stock : {};
              const esBOL = App.areaCodigo === 'BOL';
              return recetasConsolidadas.map(r => {
                const cantidades = App.planSemana[r.ID_receta] || Array(7).fill(0);
                const stockUnits = stock[r.ID_receta] || 0;
                const total = cantidades.reduce((s,c)=>s+c,0);
                const neto = Math.max(0, total - stockUnits);
                return `<tr>
                  <td class="td-nombre">
                    ${r.nombre}
                    ${esBOL && stockUnits > 0 ? `<br><span style="font-size:10px;color:#1565C0;font-weight:500">❄ Stock: ${stockUnits} uds · Neto: ${neto}</span>` : ''}
                  </td>
                  ${dias.map((_,i) => `
                    <td class="${i===diaIdx?'dia-hoy':''}">
                      <input type="number" min="0" placeholder="0"
                        data-receta="${r.ID_receta}" data-dia="${i}"
                        oninput="actualizarTotalFila(this)"
                        value="${cantidades[i] || ''}">
                    </td>`).join('')}
                  <td class="td-total" id="total-${r.ID_receta}">
                    ${total}${esBOL && stockUnits > 0 ? `<br><span style="font-size:10px;color:#1565C0">${neto} neto</span>` : ''}
                  </td>
                </tr>`;
              }).join('');
            })()}
          </tbody>
        </table>
      </div>`}
  `;
  // BOL: cargar y mostrar sub-plan de masas
  if (App.areaCodigo === 'BOL') {
    cargarPlanMasasBOL().then(() => renderSubPlanMasasBOL());
  }

  mostrarVista('planificacion');
}

function actualizarTotalFila(input) {
  const rid = input.dataset.receta;
  const inputs = document.querySelectorAll(`input[data-receta="${rid}"]`);
  const total = Array.from(inputs).reduce((s,el) => s + (parseInt(el.value)||0), 0);
  const span = document.getElementById('total-' + rid);
  if (span) span.textContent = total;
}

async function guardarPlanificacion() {
  const btn = document.querySelector('#vista-planificacion .btn-primario');
  bloquearBtn(btn, 'Guardando plan...');

  const inputs = document.querySelectorAll('#vista-planificacion input[data-receta]');
  const plan = {};
  inputs.forEach(el => {
    const rid = el.dataset.receta;
    const dia = parseInt(el.dataset.dia);
    if (!plan[rid]) plan[rid] = Array(7).fill(0);
    plan[rid][dia] = parseInt(el.value) || 0;
  });

  // Guardar local inmediatamente (persiste aunque falle el Sheet)
  App.planSemana = plan;
  guardarPlanLocal(plan);

  // Guardar plan de masas BOL si existe
  if (App.areaCodigo === 'BOL') {
    const cfg = cargarConfigSubrecetas();
    if (!cfg.bol) cfg.bol = {};
    cfg.bol.plan_masas = cfg.bol.plan_masas || {};
    document.querySelectorAll('#vista-planificacion input[data-masa]').forEach(el => {
      const mid = el.dataset.masa;
      const dia = parseInt(el.dataset.dia);
      if (!cfg.bol.plan_masas[mid]) cfg.bol.plan_masas[mid] = Array(7).fill(0);
      cfg.bol.plan_masas[mid][dia] = parseInt(el.value) || 0;
    });
    guardarConfigSubrecetas(cfg);
  }

  try {
    await escribirEnSheet('guardar_planificacion', {
      hoja:   FEN.AREAS[App.areaCodigo].hoja_plan,
      semana: obtenerSemanaActual(),
      plan
    });
    desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan', true);
    toast('Plan guardado correctamente');
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan', false);
    toast('Guardado local OK (Sheet no disponible)', 'error');
  }
}

// ── SINCRONIZAR PLAN ─────────────────────────────────────────
async function sincronizarPlan(btn) {
  bloquearBtn(btn, 'Sincronizando...');
  // Invalidar caché y recargar desde Sheet
  if (App.areaCodigo && FEN.AREAS[App.areaCodigo].hoja_plan) {
    Cache.invalidar(FEN.AREAS[App.areaCodigo].hoja_plan);
  }
  const semana  = obtenerSemanaActual();
  const claveLS = `fen_plan_${App.areaCodigo}_${semana}`;
  try {
    localStorage.removeItem(claveLS);
  } catch(e) {}

  await cargarPlanSemana();
  desbloquearBtn(btn, '<i class="ti ti-refresh"></i> Sincronizar', true);
  // Re-renderizar el plan con datos frescos
  renderVistaPlanificacion();
  toast('Plan sincronizado desde Sheet');
}

// ── MODAL DE TANDAS ──────────────────────────────────────────
function abrirModalTandas(recetaId, totalUnidades) {
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;

  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}

  const clave = `fen_tandas_${App.areaCodigo}_${recetaId}_${App._diaActivo || 0}`;
  const tandasGuardadas = (() => { try { return JSON.parse(localStorage.getItem(clave) || '[]'); } catch(e) { return []; } })();
  const tandasIniciales = tandasGuardadas.length > 0 ? tandasGuardadas : [totalUnidades];

  const modal = document.getElementById('modal-tandas');
  document.getElementById('tandas-titulo').textContent = r.nombre;
  document.getElementById('tandas-total').textContent = totalUnidades;
  document.getElementById('tandas-receta-id').value = recetaId;
  document.getElementById('tandas-total-val').value = totalUnidades;

  renderTandasBody(ingredientes, tandasIniciales, totalUnidades);
  modal.classList.remove('hidden');
}

function renderTandasBody(ingredientes, tandas, totalUnidades) {
  const body = document.getElementById('tandas-body');
  const porciones = parseInt(App.recetas.find(r => r.ID_receta === document.getElementById('tandas-receta-id').value)?.porciones_base) || 1;
  const pesoBaseIngr = ingredientes.reduce((s,i) => s+(parseFloat(i.gramos)||0), 0);

  let html = '';
  let acumulado = 0;
  tandas.forEach((n, i) => {
    acumulado += n;
    const factor = n / porciones;
    const restante = totalUnidades - acumulado;
    html += `
      <div class="tanda-modal-bloque" id="tanda-bloque-${i}">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0">
          <span style="font-size:12px;font-weight:700;color:var(--area-color);min-width:60px">Tanda ${i+1}</span>
          <input type="number" min="1" max="${totalUnidades}" value="${n}"
            style="width:70px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:14px;font-weight:600;text-align:center;font-family:'DM Mono',monospace"
            oninput="actualizarTandaModal(${i},this.value)">
          <span style="font-size:11px;color:var(--txt3)">uni</span>
          ${restante > 0 ? `<span style="font-size:11px;color:#F57C00">→ quedan ${restante}</span>` : `<span style="font-size:11px;color:#2E7D32">✓ completo</span>`}
          ${tandas.length > 1 ? `<button onclick="eliminarTanda(${i})" style="margin-left:auto;background:none;border:none;color:var(--txt3);cursor:pointer;font-size:16px">×</button>` : ''}
        </div>
        <div style="background:var(--bg);border-radius:var(--r-sm);padding:8px;margin-bottom:4px">
          ${ingredientes.map(ing => {
            const gr = (parseFloat(ing.gramos)||0) * factor;
            const pct = (parseFloat(ing.pct)||0)*100;
            return `<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:12px;border-bottom:1px solid var(--border)">
              <span>${ing.nombre}</span>
              <span style="font-family:'DM Mono',monospace;font-weight:600">${gr.toFixed(0)}g${pct>0?` <span style="color:var(--txt3)">${pct.toFixed(1)}%</span>`:''}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  });
  body.innerHTML = html;
}

function actualizarTandaModal(idx, valor) {
  const recetaId = document.getElementById('tandas-receta-id').value;
  const total = parseInt(document.getElementById('tandas-total-val').value);
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  let ingredientes = [];
  try { ingredientes = JSON.parse(r?.ingredientes_JSON || '[]'); } catch(e) {}
  
  const inputs = document.querySelectorAll('#tandas-body input[type=number]');
  const tandas = Array.from(inputs).map((inp, i) => i === idx ? parseInt(valor)||0 : parseInt(inp.value)||0);
  renderTandasBody(ingredientes, tandas, total);
}

function agregarTanda() {
  const recetaId = document.getElementById('tandas-receta-id').value;
  const total = parseInt(document.getElementById('tandas-total-val').value);
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  let ingredientes = [];
  try { ingredientes = JSON.parse(r?.ingredientes_JSON || '[]'); } catch(e) {}
  const inputs = document.querySelectorAll('#tandas-body input[type=number]');
  const tandas = Array.from(inputs).map(inp => parseInt(inp.value)||0);
  const usadas = tandas.reduce((s,v)=>s+v,0);
  const restante = Math.max(0, total - usadas);
  tandas.push(restante);
  renderTandasBody(ingredientes, tandas, total);
}

function eliminarTanda(idx) {
  const recetaId = document.getElementById('tandas-receta-id').value;
  const total = parseInt(document.getElementById('tandas-total-val').value);
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  let ingredientes = [];
  try { ingredientes = JSON.parse(r?.ingredientes_JSON || '[]'); } catch(e) {}
  const inputs = document.querySelectorAll('#tandas-body input[type=number]');
  const tandas = Array.from(inputs).map(inp => parseInt(inp.value)||0);
  tandas.splice(idx, 1);
  renderTandasBody(ingredientes, tandas, total);
}

function guardarTandasModal() {
  const recetaId = document.getElementById('tandas-receta-id').value;
  const diaIdx = App._diaActivo || 0;
  const clave = `fen_tandas_${App.areaCodigo}_${recetaId}_${diaIdx}`;
  const inputs = document.querySelectorAll('#tandas-body input[type=number]');
  const tandas = Array.from(inputs).map(inp => parseInt(inp.value)||0);
  localStorage.setItem(clave, JSON.stringify(tandas));
  document.getElementById('modal-tandas').classList.add('hidden');
  toast('Tandas guardadas');
}

// ── MODIFICADORES DE RECETA POR DÍA ─────────────────────────
function claveModificador(recetaId, diaIdx) {
  return `fen_mod_${App.areaCodigo}_${recetaId}_${diaIdx}`;
}

function getModificador(recetaId, diaIdx) {
  try {
    const val = localStorage.getItem(claveModificador(recetaId, diaIdx));
    return val ? JSON.parse(val) : null;
  } catch(e) { return null; }
}

function setModificador(recetaId, diaIdx, mod) {
  try {
    if (mod) localStorage.setItem(claveModificador(recetaId, diaIdx), JSON.stringify(mod));
    else localStorage.removeItem(claveModificador(recetaId, diaIdx));
  } catch(e) {}
}

function abrirModalModificador(recetaId, diaIdx) {
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;

  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}

  const mod = getModificador(recetaId, diaIdx) || {};
  const pesoHarinaOriginal = parseFloat(r.peso_harina_total_g) || 0;
  const pesoHarinaMod = mod._harina_base || pesoHarinaOriginal;
  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  const ingsPct = ingredientes.filter(ing => parseFloat(ing.pct) > 0);

  const modal = document.getElementById('modal-modificador');
  document.getElementById('mod-titulo').textContent = `${r.nombre} — ${diasNombres[diaIdx]}`;
  document.getElementById('mod-receta-id').value = recetaId;
  document.getElementById('mod-dia-idx').value = diaIdx;
  document.getElementById('mod-harina-original').value = pesoHarinaOriginal;

  document.getElementById('mod-body').innerHTML = `
    <p style="font-size:12px;color:var(--txt2);margin-bottom:12px;line-height:1.5">
      Ajusta la harina base y/o los % para este día. La receta original no se modifica.
      ${Object.keys(mod).length ? '<span style="color:#F57C00;font-weight:500">· Tiene ajustes activos</span>' : ''}
    </p>

    <!-- Campo harina base -->
    <div style="background:#FFF8E1;border:1.5px solid #FFD54F;border-radius:var(--r-md);padding:10px 14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:#F57C00;text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px">
        Harina base (100%)
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:13px;flex:1">Harina base</span>
        <span style="font-size:11px;color:var(--txt3)">Original: ${pesoHarinaOriginal}g</span>
        <input type="number" id="mod-harina-base" min="1" step="1"
          value="${pesoHarinaMod}"
          data-original="${pesoHarinaOriginal}"
          style="width:90px;padding:5px 8px;border:1.5px solid ${pesoHarinaMod !== pesoHarinaOriginal ? '#F57C00' : 'var(--border)'};border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace;text-align:right;color:${pesoHarinaMod !== pesoHarinaOriginal ? '#F57C00' : 'var(--txt)'}"
          oninput="actualizarGramosDesdeHarina(this)">
        <span style="font-size:12px;color:var(--txt3)">g</span>
      </div>
    </div>

    <!-- Ingredientes con % -->
    <div style="font-size:11px;font-weight:700;color:var(--txt3);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px">
      Ingredientes (% sobre harina base)
    </div>
    ${ingsPct.map(ing => {
      const pctActual = (parseFloat(ing.pct) * 100).toFixed(2);
      const pctMod = mod[ing.id]?.pct_nuevo !== undefined ? mod[ing.id].pct_nuevo : pctActual;
      const grMod = (pesoHarinaMod * parseFloat(pctMod) / 100).toFixed(0);
      const modificado = parseFloat(pctMod) !== parseFloat(pctActual) || pesoHarinaMod !== pesoHarinaOriginal;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border)">
          <span style="flex:1;font-size:13px">${ing.nombre}</span>
          <span style="font-size:10px;color:var(--txt3)">Orig: ${pctActual}%</span>
          <input type="number" step="0.01" min="0" max="300"
            value="${pctMod}"
            data-ingid="${ing.id}"
            data-original="${pctActual}"
            class="mod-pct-input"
            style="width:72px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace;text-align:right;color:${modificado?'#F57C00':'var(--txt)'}"
            oninput="actualizarGrDesdePorc(this)">
          <span style="font-size:12px;color:var(--txt3)">%</span>
          <span style="font-size:12px;color:${modificado?'#F57C00':'var(--txt3)'};font-family:'DM Mono',monospace;min-width:52px;text-align:right" id="gr-display-${ing.id}">${grMod}g</span>
        </div>`;
    }).join('')}
    ${ingsPct.length === 0 ? '<p style="font-size:13px;color:var(--txt3);text-align:center;padding:12px">Esta receta no tiene ingredientes con % panadero.</p>' : ''}
  `;

  modal.classList.remove('hidden');
}

function actualizarGramosDesdeHarina(inputHarina) {
  const harinaBase = parseFloat(inputHarina.value) || 0;
  const original   = parseFloat(inputHarina.dataset.original) || 1;
  inputHarina.style.color  = harinaBase !== original ? '#F57C00' : 'var(--txt)';
  inputHarina.style.borderColor = harinaBase !== original ? '#F57C00' : 'var(--border)';

  // Recalcular gramos de cada ingrediente
  document.querySelectorAll('.mod-pct-input').forEach(inp => {
    const pct = parseFloat(inp.value) || 0;
    const gr  = (harinaBase * pct / 100).toFixed(0);
    const display = document.getElementById('gr-display-' + inp.dataset.ingid);
    if (display) display.textContent = gr + 'g';
  });
}

function actualizarGrDesdePorc(inputPct) {
  const harinaBase = parseFloat(document.getElementById('mod-harina-base')?.value) || 0;
  const pct        = parseFloat(inputPct.value) || 0;
  const original   = parseFloat(inputPct.dataset.original);
  const modificado = Math.abs(pct - original) > 0.001;
  inputPct.style.color = modificado ? '#F57C00' : 'var(--txt)';
  const gr = (harinaBase * pct / 100).toFixed(0);
  const display = document.getElementById('gr-display-' + inputPct.dataset.ingid);
  if (display) {
    display.textContent = gr + 'g';
    display.style.color = modificado ? '#F57C00' : 'var(--txt3)';
  }
}

function guardarModificador() {
  const recetaId       = document.getElementById('mod-receta-id').value;
  const diaIdx         = parseInt(document.getElementById('mod-dia-idx').value);
  const inputs         = document.querySelectorAll('#mod-body input[data-ingid]');
  const harinaBase     = parseFloat(document.getElementById('mod-harina-base')?.value) || 0;
  const harinaOriginal = parseFloat(document.getElementById('mod-harina-original')?.value) || 0;

  const mod = {};
  let tieneModificaciones = false;

  // Guardar harina base si cambió
  if (harinaBase > 0 && Math.abs(harinaBase - harinaOriginal) > 0.1) {
    mod._harina_base = harinaBase;
    tieneModificaciones = true;
  }

  inputs.forEach(inp => {
    const original = parseFloat(inp.dataset.original);
    const nuevo    = parseFloat(inp.value);
    if (Math.abs(nuevo - original) > 0.001) {
      mod[inp.dataset.ingid] = { pct_nuevo: nuevo, pct_original: original };
      tieneModificaciones = true;
    }
  });

  setModificador(recetaId, diaIdx, tieneModificaciones ? mod : null);
  document.getElementById('modal-modificador').classList.add('hidden');
  renderDia(diaIdx);
  toast(tieneModificaciones ? 'Ajustes guardados para este día' : 'Ajustes eliminados');
}

function limpiarModificador(recetaId, diaIdx) {
  setModificador(recetaId, diaIdx, null);
  document.getElementById('modal-modificador').classList.add('hidden');
  renderDia(diaIdx);
  toast('Ajustes eliminados — vuelve a % originales');
}

// ── RECETAS DEL DÍA ───────────────────────────────────────────
function renderVistaRecetasDelDia() {
  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const hoy = new Date().getDay();
  const diaIdx = hoy === 0 ? 6 : hoy - 1;

  const vista = document.getElementById('vista-recetas-dia');
  const diaActual = diasNombres[diaIdx];
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre}</div>
        <h1 class="vista-titulo">Recetas del día</h1>
      </div>
    </div>
    <div class="dia-selector-wrap">
      ${diasNombres.map((d,i) => `
        <button class="dia-btn ${i===diaIdx?'dia-btn-activo':''}"
          onclick="cambiarDia(${i},this)">
          ${d}
        </button>`).join('')}
    </div>
    <div class="dia-activo-label">
      <i class="ti ti-chef-hat"></i>
      <span id="dia-activo-txt">${diaActual}</span>
    </div>
    <div id="contenedor-dia"></div>
  `;
  App._diaActual = diaIdx;
  renderDia(diaIdx);
  mostrarVista('recetas-dia');
}

function cambiarDia(diaIdx, btn) {
  App._diaActual = parseInt(diaIdx);
  document.querySelectorAll('.dia-btn').forEach(b => b.classList.remove('dia-btn-activo'));
  btn.classList.add('dia-btn-activo');
  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const label = document.getElementById('dia-activo-txt');
  if (label) label.textContent = diasNombres[diaIdx];
  renderDia(diaIdx);
}

async function renderDia(diaIdx) {
  const contenedor = document.getElementById('contenedor-dia');
  const idx = parseInt(diaIdx);

  // Recetas con producción ese día
  const recetasHoy = Object.entries(App.planSemana)
    .filter(([_, cant]) => (cant[idx] || 0) > 0)
    .map(([rid, cant]) => ({
      receta: App.recetas.find(r => r.ID_receta === rid),
      unidades: cant[idx]
    }))
    .filter(x => x.receta);

  if (!recetasHoy.length) {
    contenedor.innerHTML = `
      <div class="empty-state" style="height:280px">
        <i class="ti ti-moon"></i>
        <h2>Sin producción planificada</h2>
        <p>No hay recetas para este día. Revisa el plan semanal.</p>
      </div>`;
    return;
  }

  const esPan = App.areaCodigo === 'PAN';

  // Bloque elaboraciones previas (sub recetas + insumos)
  // Para BOL: cargar tareas desde Sheet primero (async)
  let htmlElaboraciones = '';
  if (App.areaCodigo === 'BOL') {
    contenedor.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt3)"><div class="spinner"></div> Cargando...</div>';
    App._recetasHoyBOL = recetasHoy;
    _tareasEstadoBOL = {};
    await cargarEstadoTareasBOL(idx);
    await renderProduccionBOL(idx, recetasHoy);
    return;
  } else if (typeof renderElaboracionesPrevias === 'function') {
    htmlElaboraciones = renderElaboracionesPrevias(idx);
  }

  const htmlRecetas = recetasHoy.map(({ receta: r, unidades }) => {
    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(r.porciones_base) || 1;
    const factor    = unidades / porciones;
    const rid       = r.ID_receta;
    const procedimiento = r.observaciones_procedimiento || '';

    // Aplicar modificadores si existen
    const mod = getModificador(rid, idx);
    const pesoHarinaBase = parseFloat(r.peso_harina_total_g) || 0;
    if (mod) {
      const harinaEfectiva = mod._harina_base || pesoHarinaBase;
      if (harinaEfectiva > 0) {
        ingredientes = ingredientes.map(ing => {
          const tieneModPct = mod[ing.id];
          const harinaCambio = mod._harina_base && Math.abs(mod._harina_base - pesoHarinaBase) > 0.1;
          if (tieneModPct) {
            const pctNuevo = mod[ing.id].pct_nuevo / 100;
            return { ...ing, gramos: harinaEfectiva * pctNuevo, _modificado: true };
          } else if (harinaCambio && parseFloat(ing.pct) > 0) {
            // Solo recalcular si tiene % panadero
            const pctOriginal = parseFloat(ing.pct);
            return { ...ing, gramos: harinaEfectiva * pctOriginal, _modificado: true };
          }
          return ing;
        });
      }
    }

    return `
      <div class="receta-dia-card" id="card-${rid}">

        <!-- CABECERA con checkbox terminada -->
        <div class="rdc-header" onclick="toggleIngredientes('${rid}')">
          <label class="rdc-check-wrap" onclick="event.stopPropagation()">
            <input type="checkbox" class="rdc-check" id="check-${rid}"
              onchange="marcarTerminada('${rid}', this.checked)">
            <span class="rdc-check-box"></span>
          </label>
          <i class="ti ${App.area?.icon || 'ti-chef-hat'}" style="font-size:16px;color:var(--area-color)"></i>
          <strong class="rdc-nombre" id="nombre-${rid}">${r.nombre}</strong>
          ${(() => {
            const totalIngr = ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0);
            const porciones = parseInt(r.porciones_base)||1;
            const pesoCrudo = (totalIngr/porciones).toFixed(0);
            return pesoCrudo > 0 ? `<span style="font-size:11px;color:var(--txt3);font-weight:400">${pesoCrudo}g/ud</span>` : '';
          })()}
          <span class="rdc-badge" style="cursor:pointer" title="Dividir en tandas"
            onclick="event.stopPropagation();abrirModalTandas('${rid}',${unidades})">
            ${unidades} unidad${unidades>1?'es':''}
          </span>
          <i class="ti ti-chevron-down rdc-chevron" id="chev-${rid}"></i>
          ${esPan ? `
          <button class="rdc-mod-btn ${mod ? 'rdc-mod-activo' : ''}"
            onclick="event.stopPropagation();abrirModalModificador('${rid}',${idx})"
            title="${mod ? 'Ajustes activos — click para editar' : 'Ajustar % para este día'}">
            <i class="ti ti-adjustments-horizontal"></i>
            ${mod ? '<span class="rdc-mod-dot"></span>' : ''}
          </button>` : ''}
        </div>

        <!-- INGREDIENTES (visibles por defecto) -->
        <div class="rdc-ingredientes" id="ingr-${rid}">
          <table class="tabla-vista">
            <thead><tr>
              <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Ingrediente</th>
              <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Gramos × ${unidades} unid.</th>
              ${esPan ? `<th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">%</th>` : ''}
            </tr></thead>
            <tbody>
              ${ingredientes.map(ing => {
                const gr = (parseFloat(ing.gramos)||0) * factor;
                const pctMostrar = ing._modificado
                  ? (mod && mod[ing.id]?.pct_nuevo || 0).toFixed(2)
                  : ((parseFloat(ing.pct)||0)*100).toFixed(1);
                // Si tiene unidades guardadas, mostrar en unidades
                const tieneUnidades = ing.unidades !== undefined && ing.unidades !== null;
                const unidadesEscaladas = tieneUnidades
                  ? Math.ceil((parseFloat(ing.unidades)||0) * factor)
                  : null;
                return `<tr ${ing._modificado ? 'style="background:#FFF3E0"' : ''}>
                  <td class="td-nombre">
                    ${ing.nombre}
                    ${ing._modificado ? '<span style="font-size:10px;color:#F57C00;margin-left:4px">✦</span>' : ''}
                  </td>
                  <td class="td-num" style="font-size:14px;font-weight:600;${ing._modificado?'color:#F57C00':''}">
                    ${tieneUnidades
                      ? `${unidadesEscaladas} uni`
                      : `${gr.toFixed(0)}g`}
                  </td>
                  ${esPan ? `<td class="td-pct" style="${ing._modificado?'color:#F57C00':''}">${pctMostrar}%</td>` : ''}
                </tr>`;
              }).join('')}
              <tr style="background:var(--bg)">
                <td style="padding:8px 16px;font-weight:600">Total masa</td>
                <td class="td-num" style="padding:8px 16px;font-weight:600">
                  ${ingredientes.reduce((s,i) => s+(parseFloat(i.gramos)||0)*factor, 0).toFixed(0)}g
                </td>
                ${esPan ? '<td></td>' : ''}
              </tr>
            </tbody>
          </table>
        </div>

        <!-- PROCEDIMIENTO desplegable (cerrado por defecto) -->
        ${procedimiento ? `
        <div class="rdc-seccion">
          <button class="rdc-toggle" onclick="toggleSeccion('proc-${rid}', this)">
            <i class="ti ti-list-numbers"></i> Procedimiento
            <i class="ti ti-chevron-right rdc-toggle-icon"></i>
          </button>
          <div class="rdc-desplegable" id="proc-${rid}">
            <p style="font-size:13px;color:var(--txt2);line-height:1.7;padding:14px 16px">${procedimiento}</p>
          </div>
        </div>` : ''}

        <!-- NOTAS DEL DÍA -->
        <div class="rdc-seccion">
          <button class="rdc-toggle" onclick="toggleSeccion('notas-${rid}', this)">
            <i class="ti ti-notes"></i> Notas de este día
            <i class="ti ti-chevron-right rdc-toggle-icon"></i>
          </button>
          <div class="rdc-desplegable" id="notas-${rid}">
            <div style="padding:12px 16px">
              <textarea id="textarea-notas-${rid}"
                placeholder="Anota aquí observaciones, anomalías o cambios realizados en esta elaboración..."
                rows="3"
                style="width:100%;border:1px solid var(--border);border-radius:var(--r-md);
                  padding:10px 12px;font-size:13px;font-family:inherit;resize:vertical;
                  background:var(--surface);color:var(--txt);line-height:1.6"
                oninput="autoguardarNota('${rid}')">${obtenerNotaDia(rid, idx)}</textarea>
              <p style="font-size:11px;color:var(--txt3);margin-top:6px">
                <i class="ti ti-device-floppy"></i> Se guarda automáticamente
              </p>
            </div>
          </div>
        </div>

      </div>`;
  }).join('');

  contenedor.innerHTML = htmlElaboraciones + htmlRecetas;

  // Restaurar estados guardados
  recetasHoy.forEach(({ receta: r }) => {
    const terminada = obtenerEstadoTerminada(r.ID_receta, idx);
    if (terminada) {
      const check = document.getElementById('check-' + r.ID_receta);
      if (check) { check.checked = true; marcarTerminada(r.ID_receta, true); }
    }
  });
}

// ── MAESTRO DE RECETAS ────────────────────────────────────────
async function renderVistaMaestro() {
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  const mios = maestro.filter(r => r.área === App.area?.nombre);
  const vista = document.getElementById('vista-maestro');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre}</div>
        <h1 class="vista-titulo">Maestro de recetas</h1>
      </div>
    </div>
    ${!mios.length ? `
      <div class="empty-state">
        <i class="ti ti-book-off"></i>
        <h2>Sin recetas consolidadas</h2>
        <p>Las recetas aparecen aquí cuando son aprobadas por administración.</p>
      </div>` : `
      <div class="card">
        <div class="card-head"><i class="ti ti-book"></i> Recetas consolidadas (${mios.length})</div>
        <table class="tabla-vista">
          <thead><tr>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Receta</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Rendimiento</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Versión</th>
          </tr></thead>
          <tbody>
            ${mios.map(r => {
              const esSubReceta = r.tipo_receta === 'sub_receta';
              return `<tr>
              <td class="td-nombre">
                ${r.nombre}
                <span style="font-size:10px;padding:1px 6px;border-radius:99px;margin-left:6px;font-weight:600;
                  background:${esSubReceta?'#EDE9FE':'#E8F5E9'};
                  color:${esSubReceta?'#5B21B6':'#166534'}">
                  ${esSubReceta?'⟳ Sub receta':'Receta'}
                </span>
              </td>
              <td class="td-num">${r.porciones_base} unid.</td>
              <td class="td-num">v${r.versión_actual||1}</td>
            </tr>`;}).join('')}
          </tbody>
        </table>
      </div>`}
  `;
  mostrarVista('maestro');
}

// ── RESUMEN SEMANAL ──────────────────────────────────────────
function renderVistaResumenSemanal() {
  const vista = document.getElementById('vista-resumen-semanal');
  const semana = obtenerSemanaActual();
  const html = (typeof renderResumenSemanal === 'function') ? renderResumenSemanal() : '';
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre} · Semana ${semana}</div>
        <h1 class="vista-titulo">Resumen semanal</h1>
      </div>
    </div>
    <div class="rsm-wrap">${html}</div>
  `;
  mostrarVista('resumen-semanal');
}

// ── STOCK CAFETERÍA ────────────────────────────────────────────
let _stockCAFCache = [];

async function renderVistaStockCAF() {
  const vista = document.getElementById('vista-stock-caf');
  if (!vista) return;
  mostrarVista('stock-caf');

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">Cafetería</div>
        <h1 class="vista-titulo">Stock de materias primas</h1>
      </div>
      <button class="btn-primario" onclick="abrirModalMovStock()">
        <i class="ti ti-plus"></i> Registrar movimiento
      </button>
    </div>
    <div id="stock-caf-body">
      <div style="padding:20px;text-align:center;color:var(--txt3)"><div class="spinner"></div> Cargando...</div>
    </div>
  `;

  await cargarStockCAF();
}

async function cargarStockCAF() {
  const body = document.getElementById('stock-caf-body');
  if (!body) return;

  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_stock_caf' }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload);
    const data = await res.json();
    _stockCAFCache = data.movimientos || [];

    // Calcular saldo actual por MP
    const mpItems = App.materiasPrimas.filter(m =>
      !m.areas_habilitadas || m.areas_habilitadas.includes('CAF')
    );

    const saldos = {};
    mpItems.forEach(m => { saldos[m.ID_MP] = { nombre: m.nombre, saldo: 0, unidad: m.unidad || 'unid' }; });

    _stockCAFCache.forEach(mov => {
      if (!saldos[mov.mp_id]) saldos[mov.mp_id] = { nombre: mov.nombre, saldo: 0, unidad: '' };
      const cant = parseFloat(mov.cantidad) || 0;
      if (mov.tipo === 'compra') saldos[mov.mp_id].saldo += cant;
      else saldos[mov.mp_id].saldo -= cant; // consumo, merma
    });

    const itemsConMovimiento = Object.entries(saldos).filter(([id, s]) =>
      _stockCAFCache.some(m => m.mp_id === id) || mpItems.some(m => m.ID_MP === id)
    );

    if (!itemsConMovimiento.length) {
      body.innerHTML = '<p style="padding:20px;color:var(--txt3);font-size:13px">Sin materias primas configuradas para Cafetería. Agrégalas en "Materias primas" con área habilitada CAF.</p>';
      return;
    }

    body.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><i class="ti ti-package"></i> Stock actual</div>
        <table class="tabla-vista">
          <thead><tr>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Item</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Stock actual</th>
          </tr></thead>
          <tbody>
            ${itemsConMovimiento.map(([id, s]) => `
              <tr>
                <td class="td-nombre">${s.nombre}</td>
                <td class="td-num" style="font-weight:700;color:${s.saldo<=0?'#C62828':'var(--txt)'}">
                  ${s.saldo.toFixed(s.unidad==='unidades'?0:2)} ${s.unidad}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <div class="card">
        <div class="card-head" style="cursor:pointer" onclick="toggleHistoricoStock(this)">
          <i class="ti ti-history"></i> Histórico de movimientos
          <i class="ti ti-chevron-down" style="margin-left:auto;font-size:14px;transition:transform .2s"></i>
        </div>
        <div id="historico-stock-body" style="display:none">
          <div style="padding:10px 16px">
            <input type="text" placeholder="Buscar por item o barista..." id="buscar-historico"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit"
              oninput="filtrarHistoricoStock(this.value)">
          </div>
          <table class="tabla-vista" id="tabla-historico-stock">
            <thead><tr>
              <th style="text-align:left;padding:7px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Fecha</th>
              <th style="text-align:left;padding:7px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Item</th>
              <th style="text-align:center;padding:7px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Tipo</th>
              <th style="text-align:right;padding:7px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Cantidad</th>
              <th style="text-align:left;padding:7px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Barista</th>
            </tr></thead>
            <tbody>
              ${_stockCAFCache.slice().reverse().map(mov => `
                <tr>
                  <td style="font-size:12px;color:var(--txt2);padding:6px 16px">${mov.fecha}</td>
                  <td style="font-size:12px;padding:6px 16px">${mov.nombre}</td>
                  <td style="text-align:center;padding:6px 16px">
                    <span style="font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;
                      background:${mov.tipo==='compra'?'#E8F5E9':mov.tipo==='merma'?'#FFEBEE':'#FFF3E0'};
                      color:${mov.tipo==='compra'?'#2E7D32':mov.tipo==='merma'?'#C62828':'#E65100'}">
                      ${mov.tipo}
                    </span>
                  </td>
                  <td style="text-align:right;font-family:'DM Mono',monospace;padding:6px 16px">${mov.cantidad}</td>
                  <td style="font-size:12px;padding:6px 16px">${mov.barista||'—'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } catch(e) {
    body.innerHTML = `<p style="padding:20px;color:#C62828;font-size:13px">Error: ${e.message}</p>`;
  }
}

function toggleHistoricoStock(header) {
  const body = document.getElementById('historico-stock-body');
  const chev = header.querySelector('.ti-chevron-down');
  if (!body) return;
  const visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : 'block';
  if (chev) chev.style.transform = visible ? '' : 'rotate(180deg)';
}

function filtrarHistoricoStock(texto) {
  const filas = document.querySelectorAll('#tabla-historico-stock tbody tr');
  const t = texto.toLowerCase();
  filas.forEach(fila => {
    const match = fila.textContent.toLowerCase().includes(t);
    fila.style.display = match ? '' : 'none';
  });
}

function abrirModalMovStock() {
  const cfg = cargarConfigSubrecetas();
  const baristas = cfg.caf?.baristas || [];
  const mpItems = App.materiasPrimas.filter(m =>
    !m.areas_habilitadas || m.areas_habilitadas.includes('CAF')
  );

  const modal = document.getElementById('modal-mov-stock');
  document.getElementById('mov-stock-mp').innerHTML = mpItems.map(m =>
    `<option value="${m.ID_MP}" data-nombre="${m.nombre}">${m.nombre}</option>`
  ).join('');
  document.getElementById('mov-stock-barista').innerHTML =
    '<option value="">— Selecciona —</option>' +
    baristas.map(b => `<option value="${b}">${b}</option>`).join('');
  document.getElementById('mov-stock-cantidad').value = '';
  document.getElementById('mov-stock-nota').value = '';

  modal.classList.remove('hidden');
}

async function guardarMovStock(btn) {
  const mpSel = document.getElementById('mov-stock-mp');
  const mpId = mpSel.value;
  const nombre = mpSel.selectedOptions[0]?.dataset.nombre || '';
  const tipo = document.getElementById('mov-stock-tipo').value;
  const cantidad = parseFloat(document.getElementById('mov-stock-cantidad').value) || 0;
  const nota = document.getElementById('mov-stock-nota').value.trim();
  const barista = document.getElementById('mov-stock-barista').value;

  if (!mpId || cantidad <= 0 || !barista) {
    toast('Completa item, cantidad y barista');
    return;
  }

  bloquearBtn(btn, 'Guardando...');
  try {
    let data;
    try {
      const payload = encodeURIComponent(JSON.stringify({
        accion: 'mov_stock_caf', mp_id: mpId, nombre, tipo, cantidad, nota, barista
      }));
      const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload);
      data = await res.json();
    } catch(errGet) {
      // Fallback: POST con no-cors (sin confirmación pero funciona con tildes)
      await fetch(FEN.WEBAPP_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          accion: 'mov_stock_caf', mp_id: mpId, nombre, tipo, cantidad, nota, barista
        })
      });
      data = { ok: true, msg: 'Enviado (sin confirmación)' };
    }

    if (data.ok) {
      document.getElementById('modal-mov-stock').classList.add('hidden');
      toast('Movimiento registrado');
      await cargarStockCAF();
    } else {
      toast('Error: ' + data.msg);
    }
  } catch(e) {
    toast('Error de conexión: ' + e.message);
  }
  desbloquearBtn(btn, '<i class="ti ti-check"></i> Registrar', true);
}

// ── CONSOLIDADO MENSUAL ──────────────────────────────────────
async function renderVistaConsolidado() {
  const vista = document.getElementById('vista-consolidado-mensual');
  if (!vista) return;
  mostrarVista('consolidado-mensual');

  const ahora  = new Date();
  const mesAct = ahora.getMonth() + 1;
  const añoAct = ahora.getFullYear();

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre || 'Consolidado'}</div>
        <h1 class="vista-titulo">Consolidado mensual</h1>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap">
      <select id="sel-consolidado-mes" style="padding:6px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px"
        onchange="cargarConsolidado()">
        ${Array.from({length:12},(_,i)=>{
          const m=i+1;
          const label=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][i];
          return `<option value="${m}" ${m===mesAct?'selected':''}>${label}</option>`;
        }).join('')}
      </select>
      <select id="sel-consolidado-año" style="padding:6px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px"
        onchange="cargarConsolidado()">
        ${[añoAct-1, añoAct, añoAct+1].map(a=>`<option value="${a}" ${a===añoAct?'selected':''}>${a}</option>`).join('')}
      </select>
      <button class="btn-secundario" onclick="guardarConsolidadoAhora(this)" style="font-size:12px">
        <i class="ti ti-device-floppy"></i> Guardar semana actual
      </button>
    </div>
    <div id="consolidado-body">
      <div style="padding:20px;text-align:center;color:var(--txt3)">
        <div class="spinner"></div> Cargando...
      </div>
    </div>
  `;

  await cargarConsolidado();
}

async function cargarConsolidado() {
  const mes  = document.getElementById('sel-consolidado-mes')?.value;
  const año  = document.getElementById('sel-consolidado-año')?.value;
  const body = document.getElementById('consolidado-body');
  if (!body || !mes || !año) return;

  body.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt3)"><div class="spinner"></div> Cargando...</div>';

  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'leer_consolidado',
      mes, año,
      area: App.areaCodigo
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload);
    const data = await res.json();

    if (!data.ok || !data.filas?.length) {
      body.innerHTML = '<p style="padding:20px;color:var(--txt3);font-size:13px">Sin datos para este período. Usa "Guardar semana actual" o espera al trigger del sábado.</p>';
      return;
    }

    // Agrupar por semana
    const porSemana = {};
    data.filas.forEach(f => {
      if (!porSemana[f.semana_ID]) porSemana[f.semana_ID] = [];
      porSemana[f.semana_ID].push(f);
    });

    const diasLabel = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

    // ── Totales del mes ───────────────────────────────────────
    const totalesProduccion = {};
    const totalesInsumos    = {};
    data.filas.forEach(f => {
      if (f.tipo === 'produccion') {
        if (!totalesProduccion[f.nombre]) totalesProduccion[f.nombre] = 0;
        totalesProduccion[f.nombre] += parseFloat(f.total) || 0;
      } else if (f.tipo === 'insumo_mp') {
        if (!totalesInsumos[f.nombre]) totalesInsumos[f.nombre] = 0;
        totalesInsumos[f.nombre] += parseFloat(f.total) || 0;
      }
    });

    const mesesNombres = ['','Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const mesNombre = mesesNombres[parseInt(mes)] || mes;

    const cardTotales = `
      <div class="card" style="margin-bottom:20px;border-color:var(--area-color);border-width:2px">
        <div class="card-head" style="background:var(--area-color);color:#fff">
          <i class="ti ti-chart-bar"></i>
          Resumen ${mesNombre} ${año} — Totales del mes
        </div>
        ${Object.keys(totalesProduccion).length ? `
        <div style="padding:8px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--txt3);letter-spacing:.4px">
          Producción total
        </div>
        <div style="padding:0 12px 8px;display:flex;flex-wrap:wrap;gap:8px">
          ${Object.entries(totalesProduccion).map(([nombre, total]) => `
            <div style="background:var(--area-bg);border-radius:var(--r-md);padding:8px 14px;min-width:140px">
              <div style="font-size:11px;color:var(--txt3)">${nombre}</div>
              <div style="font-size:18px;font-weight:700;color:var(--area-color);font-family:'DM Mono',monospace">${total.toFixed(0)}</div>
              <div style="font-size:10px;color:var(--txt3)">unidades</div>
            </div>`).join('')}
        </div>` : ''}
        ${Object.keys(totalesInsumos).length ? `
        <div style="padding:8px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--txt3);letter-spacing:.4px;border-top:1px solid var(--border)">
          Insumos MP total
        </div>
        <div style="padding:0 12px 12px;display:flex;flex-wrap:wrap;gap:8px">
          ${Object.entries(totalesInsumos).map(([nombre, total]) => `
            <div style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:8px 14px;min-width:140px">
              <div style="font-size:11px;color:var(--txt3)">${nombre}</div>
              <div style="font-size:18px;font-weight:700;color:var(--txt);font-family:'DM Mono',monospace">${formatearGramos(total)}</div>
            </div>`).join('')}
        </div>` : ''}
      </div>`;

    body.innerHTML = cardTotales + Object.entries(porSemana)
      .sort(([a],[b]) => a.localeCompare(b))
      .map(([semana, filas]) => {
        const produccion = filas.filter(f => f.tipo === 'produccion');
        const insumos    = filas.filter(f => f.tipo === 'insumo_mp');

        const renderTabla = (filasList, esInsumo) => `
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:12px">
              <thead>
                <tr style="background:var(--bg)">
                  <th style="text-align:left;padding:7px 12px;border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;font-size:10px;text-transform:uppercase">
                    ${esInsumo ? 'Materia prima' : 'Producto'}
                  </th>
                  ${diasLabel.map(d=>`<th style="text-align:right;padding:7px 8px;border-bottom:1px solid var(--border);color:var(--txt3);font-size:10px">${d}</th>`).join('')}
                  <th style="text-align:right;padding:7px 12px;border-bottom:1px solid var(--border);color:var(--txt3);font-size:10px;font-weight:700">Total</th>
                </tr>
              </thead>
              <tbody>
                ${filasList.map(f => {
                  const esGramos = esInsumo;
                  return `<tr>
                    <td style="padding:6px 12px;border-bottom:1px solid var(--border);font-weight:500">${f.nombre}</td>
                    ${f.dias.map(v=>`<td style="padding:6px 8px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2)">${v>0?(esGramos?formatearGramos(v):v):''}</td>`).join('')}
                    <td style="padding:6px 12px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:700;color:var(--area-color)">
                      ${esGramos ? formatearGramos(f.total) : f.total}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;

        return `
          <div class="card" style="margin-bottom:16px">
            <div class="card-head" style="background:var(--area-bg);color:var(--area-color)">
              <i class="ti ti-calendar-week"></i>
              ${semana}
            </div>
            ${produccion.length ? `
            <div style="padding:8px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--txt3);letter-spacing:.4px">
              Producción
            </div>
            ${renderTabla(produccion, false)}` : ''}
            ${insumos.length ? `
            <div style="padding:8px 12px 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--txt3);letter-spacing:.4px;border-top:1px solid var(--border);margin-top:8px">
              Insumos MP
            </div>
            ${renderTabla(insumos, true)}` : ''}
          </div>`;
      }).join('');
  } catch(e) {
    body.innerHTML = `<p style="padding:20px;color:#C62828;font-size:13px">Error al cargar: ${e.message}</p>`;
  }
}

async function guardarConsolidadoAhora(btn) {
  bloquearBtn(btn, 'Guardando...');
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'guardar_consolidado' }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok) {
      toast('Consolidado guardado');
      await cargarConsolidado();
    } else {
      toast('Error: ' + data.msg);
    }
  } catch(e) {
    // Fallback POST
    try {
      await fetch(FEN.WEBAPP_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ accion: 'guardar_consolidado' })
      });
      toast('Consolidado guardado');
      setTimeout(() => cargarConsolidado(), 2000);
    } catch(e2) {
      toast('Error de conexión');
    }
  }
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar semana actual', true);
}

// ── BOL: PLAN DE MASAS BASE ───────────────────────────────────
let _planMasasBOL = {};

async function cargarPlanMasasBOL() {
  const semana = obtenerSemanaActual();
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'leer_plan_masas_bol', semana_ID: semana
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && data.filas?.length) {
      _planMasasBOL = {};
      const diasCols = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
      data.filas.forEach(f => {
        _planMasasBOL[f.ID_mp] = diasCols.map(d => parseFloat(f[d]) || 0);
      });
    }
  } catch(e) {
    const cfg = cargarConfigSubrecetas();
    _planMasasBOL = cfg.bol?.plan_masas || {};
  }
}

function renderSubPlanMasasBOL() {
  const vista = document.getElementById('vista-planificacion');
  if (!vista) return;

  const masasBase = App.materiasPrimas.filter(m => {
    const esSR = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    return esSR && nombre.includes('masa') && !nombre.includes('madre') &&
           !nombre.includes('poolish') &&
           (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });

  if (!masasBase.length) return;

  const cfg = cargarConfigSubrecetas();
  const maxTanda = cfg.bol?.amasadora_max_por_tanda || 16;
  const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

  const subPlanHTML = `
    <div style="margin-top:20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap;gap:8px">
        <h3 style="font-size:14px;font-weight:700;color:#4A148C;margin:0">
          <i class="ti ti-snowflake" style="color:#6A1B9A"></i> Plan de masas base
        </h3>
        <div style="display:flex;gap:8px">
          <button class="btn-secundario" style="font-size:12px" onclick="calcularAutomaticoBOL()">
            <i class="ti ti-calculator"></i> Calcular automático
          </button>
          <button class="btn-primario" style="font-size:12px" onclick="guardarPlanMasasBOL(this)">
            <i class="ti ti-device-floppy"></i> Guardar plan masas
          </button>
        </div>
      </div>
      <div class="plan-tabla-wrap">
        <table class="plan-tabla">
          <thead>
            <tr>
              <th class="th-nombre">Masa base</th>
              ${dias.map(d => `<th>${d}</th>`).join('')}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${masasBase.map(m => {
              const plan = _planMasasBOL[m.ID_MP] || Array(7).fill(0);
              const total = plan.reduce((s,v)=>s+v,0);
              return `<tr>
                <td class="td-nombre">${m.nombre}</td>
                ${plan.map((v, i) => `
                  <td><input type="number" min="0" placeholder="0"
                    data-masa="${m.ID_MP}" data-dia="${i}"
                    oninput="actualizarTotalMasaBOL(this)"
                    value="${v || ''}"></td>`).join('')}
                <td class="td-total" id="total-masa-${m.ID_MP}">${total || 0}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--txt3);margin-top:8px">
        <i class="ti ti-info-circle"></i> Máx ${maxTanda} masas por tanda.
        "Calcular automático" propone el máximo — ajusta según tu criterio.
      </p>
    </div>`;

  vista.insertAdjacentHTML('beforeend', subPlanHTML);
}

function actualizarTotalMasaBOL(input) {
  const masaId = input.dataset.masa;
  const inputs = document.querySelectorAll(`input[data-masa="${masaId}"]`);
  const total = Array.from(inputs).reduce((s, el) => s + (parseInt(el.value) || 0), 0);
  const span = document.getElementById('total-masa-' + masaId);
  if (span) span.textContent = total;
}

function calcularAutomaticoBOL() {
  const cfg = cargarConfigSubrecetas();
  const maxTandas  = cfg.bol?.amasadora_tandas_dia || 2;
  const maxPorTanda = cfg.bol?.amasadora_max_por_tanda || 16;
  const maxDia = maxTandas * maxPorTanda;
  document.querySelectorAll('input[data-masa]').forEach(inp => {
    inp.value = maxDia;
    actualizarTotalMasaBOL(inp);
  });
  toast(`Propuesta: ${maxDia} masas/día (${maxTandas} tandas × ${maxPorTanda})`);
}

async function guardarPlanMasasBOL(btn) {
  bloquearBtn(btn, 'Guardando...');
  const semana = obtenerSemanaActual();
  const masasBase = App.materiasPrimas.filter(m => {
    const esSR = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    return esSR && nombre.includes('masa') && !nombre.includes('madre') &&
           !nombre.includes('poolish') &&
           (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });

  const filas = masasBase.map(m => {
    const inputs = document.querySelectorAll(`input[data-masa="${m.ID_MP}"]`);
    const dias = Array.from(inputs).map(inp => parseInt(inp.value) || 0);
    _planMasasBOL[m.ID_MP] = dias;
    return { semana_ID: semana, ID_mp: m.ID_MP, nombre_mp: m.nombre, dias };
  });

  await escribirEnSheet('guardar_plan_masas_bol', { filas });
  toast('Plan de masas guardado');
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan masas', true);
}

// ── FECHA REAL DE DÍA DE SEMANA ──────────────────────────────
function fechaRealDiaSemana(diaIdx) {
  // Retorna la fecha real (YYYY-MM-DD) del día diaIdx (0=Lun) en la semana actual
  const hoy = new Date();
  const diaSemanaHoy = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1; // 0=Lun, 6=Dom
  const diff = diaIdx - diaSemanaHoy;
  const fecha = new Date(hoy);
  fecha.setDate(hoy.getDate() + diff);
  const off = fecha.getTimezoneOffset() * 60000;
  return new Date(fecha - off).toISOString().slice(0,10);
}

// ── BOL: ESTADO TAREAS ───────────────────────────────────────
let _tareasEstadoBOL = {}; // { tipo_tarea: estado } cargado desde Sheet

async function cargarEstadoTareasBOL(diaIdx) {
  const semana = obtenerSemanaActual();
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'leer_tareas_bol',
      semana_ID: semana,
      dia: diaIdx
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && data.tareas) {
      _tareasEstadoBOL = {};
      data.tareas.forEach(t => {
        // For empastes store cantidad, for others store estado
        const valor = (t.tipo_tarea === 'empaste_porcionados' || t.tipo_tarea === 'empaste_estirados')
          ? String(t.cantidad) : t.estado;
        _tareasEstadoBOL[t.tipo_tarea] = valor;
        // Solo actualizar localStorage si no hay valor local (otro dispositivo)
        const clavePreLS  = `fen_bol_pre_${semana}_${diaIdx}_${t.subtarea}`;
        const claveProdLS = `fen_bol_check_${semana}_${diaIdx}_${t.subtarea}`;
        const claveEmpPor = `fen_bol_emp_por_${semana}_${diaIdx}`;
        const claveEmpEst = `fen_bol_emp_est_${semana}_${diaIdx}`;
        if (t.tipo_tarea === 'empaste_porcionados' && localStorage.getItem(claveEmpPor) === null)
          localStorage.setItem(claveEmpPor, String(t.cantidad));
        if (t.tipo_tarea === 'empaste_estirados' && localStorage.getItem(claveEmpEst) === null)
          localStorage.setItem(claveEmpEst, String(t.cantidad));
        if (localStorage.getItem(clavePreLS) === null)  localStorage.setItem(clavePreLS, t.estado);
        if (localStorage.getItem(claveProdLS) === null) localStorage.setItem(claveProdLS, t.estado);
      });
    }
  } catch(e) {
    console.warn('[fën] No se pudo cargar estado tareas BOL:', e.message);
  }
}

function getTareaEstadoBOL(id, semana, diaIdx, prefijo) {
  // localStorage es la fuente de verdad (más reciente)
  const claveLS = prefijo === 'pre'
    ? `fen_bol_pre_${semana}_${diaIdx}_${id}`
    : `fen_bol_check_${semana}_${diaIdx}_${id}`;
  const localVal = localStorage.getItem(claveLS);
  if (localVal !== null) return localVal === '1';
  // Fallback Sheet cache (para otro dispositivo)
  const tipoTarea = `${prefijo}_${id}`;
  if (_tareasEstadoBOL[tipoTarea] !== undefined) {
    return _tareasEstadoBOL[tipoTarea] === '1';
  }
  return false;
}

function actualizarVisualTareaBOL(elementId, checked) {
  const card = document.getElementById(elementId);
  if (!card) return;
  card.classList.toggle('bol-tarea-done', checked);
}

// ── BOL: PRE-ELABORACIONES ───────────────────────────────────
async function renderVistaPreElaboraciones() {
  const vista = document.getElementById('vista-pre-elaboraciones');
  if (!vista) return;
  mostrarVista('pre-elaboraciones');

  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const hoy = new Date().getDay();
  const diaIdx = hoy === 0 ? 6 : hoy - 1;

  vista.innerHTML = `
    <div class="avisos-container" style="margin-bottom:12px"></div>
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">Bollería</div>
        <h1 class="vista-titulo">Pre-elaboraciones</h1>
      </div>
    </div>
    <div class="dia-selector-wrap">
      ${diasNombres.map((d,i) => `
        <button class="dia-btn ${i===diaIdx?'dia-btn-activo':''}"
          onclick="cambiarDiaPreElab(${i},this)">
          ${d}
        </button>`).join('')}
    </div>
    <div id="contenedor-pre-elab">
      <div style="padding:20px;text-align:center;color:var(--txt3)"><div class="spinner"></div></div>
    </div>
  `;

  // Always reload from Sheet to get latest state from all devices
  _tareasEstadoBOL = {};
  await cargarEstadoTareasBOL(diaIdx);
  renderPreElabDia(diaIdx);
}

function cambiarDiaPreElab(diaIdx, btn) {
  document.querySelectorAll('.dia-btn').forEach(b => b.classList.remove('dia-btn-activo'));
  btn.classList.add('dia-btn-activo');
  const contenedor = document.getElementById('contenedor-pre-elab');
  if (contenedor) contenedor.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt3)"><div class="spinner"></div></div>';
  _tareasEstadoBOL = {};
  cargarEstadoTareasBOL(diaIdx).then(() => renderPreElabDia(diaIdx));
}

function renderPreElabDia(diaIdx) {
  const contenedor = document.getElementById('contenedor-pre-elab');
  if (!contenedor) return;

  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const diaSiguiente = (diaIdx + 1) % 7;
  const cfg = cargarConfigSubrecetas();
  const semana = obtenerSemanaActual();
  const maxPorTanda = cfg.bol?.amasadora_max_por_tanda || 16;

  const masasBase = App.materiasPrimas.filter(m => {
    const esSR = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    return esSR && nombre.includes('masa') && !nombre.includes('madre') &&
           !nombre.includes('poolish') && (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });

  const poolishMPs = App.materiasPrimas.filter(m => {
    const esSR = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    return esSR && (m.nombre||'').toLowerCase().includes('poolish') &&
           (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });

  const masasSiguiente = masasBase.map(m => ({
    mp: m, cantidad: (_planMasasBOL[m.ID_MP] || [])[diaSiguiente] || 0,
    receta: App.recetas.find(r => r.nombre === m.nombre && r.estado === 'consolidada')
  })).filter(x => x.cantidad > 0);

  const poolishSiguiente = poolishMPs.map(m => ({
    mp: m, cantidad: (_planMasasBOL[masasBase[0]?.ID_MP] || [])[diaSiguiente] || 0,
    receta: App.recetas.find(r => r.nombre === m.nombre && r.estado === 'consolidada')
  })).filter(x => x.cantidad > 0);

  // Calcular empastes desde plan de producción del día siguiente
  let totalEmpastes = 0;
  Object.entries(App.planSemana).forEach(([rid, cant]) => {
    const unidades = cant[diaSiguiente] || 0;
    if (!unidades) return;
    const receta = App.recetas.find(r => r.ID_receta === rid);
    if (!receta) return;
    let ings = [];
    try { ings = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(receta.porciones_base) || 1;
    ings.forEach(ing => {
      if ((ing.nombre||'').toLowerCase().includes('empaste')) {
        totalEmpastes += Math.ceil((parseFloat(ing.unidades)||1) / porciones * unidades);
      }
    });
  });

  const mantPorEmpaste = cfg.bol?.mantequilla_por_empaste || 250;

  // Helper: get/set check state
  const getCheck = id => getTareaEstadoBOL(id, semana, diaIdx, 'pre');
  const claveEmpPor = `fen_bol_emp_por_${semana}_${diaIdx}`;
  const claveEmpEst = `fen_bol_emp_est_${semana}_${diaIdx}`;
  // Load from Sheet cache if available (for cross-device sync)
  const empPorSheet = _tareasEstadoBOL['empaste_porcionados'];
  const empEstSheet = _tareasEstadoBOL['empaste_estirados'];
  const empPorcionados = parseInt(localStorage.getItem(claveEmpPor)) || 
                         (empPorSheet ? parseInt(empPorSheet) : 0);
  const empEstirados   = parseInt(localStorage.getItem(claveEmpEst)) || 
                         (empEstSheet ? parseInt(empEstSheet) : 0);

  // Helper: render tanda blocks for masa/poolish
  const renderTandas = (id, cantidad, receta, prefix) => {
    const claveTandas = `fen_bol_pre_tandas_${semana}_${diaIdx}_${id}`;
    let tandas = (() => { try { return JSON.parse(localStorage.getItem(claveTandas)||'null'); } catch(e) { return null; } })();
    if (!tandas) {
      tandas = [];
      let resto = cantidad;
      while (resto > 0) { const n = Math.min(resto, maxPorTanda); tandas.push(n); resto -= n; }
    }

    let ings = [];
    if (receta) try { ings = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}

    return `
      <div style="padding:4px 16px 8px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="font-size:11px;color:var(--txt3)">Máx ${maxPorTanda} por tanda</span>
          <button onclick="agregarTandaPreElab('${id}',${diaIdx})" class="btn-secundario" style="font-size:11px;padding:2px 8px;margin-left:auto">
            <i class="ti ti-plus"></i> Tanda
          </button>
        </div>
        ${tandas.map((n, i) => {
          const done = getCheck(`${id}_tanda_${i}`);
          const ingRows = ings.map(ing => `
            <div style="padding:2px 0;font-size:11px;color:var(--txt2)">
              ${ing.nombre}: <strong id="ing-${id}-${i}-${ing.id}">${Math.round((parseFloat(ing.gramos)||0)*n)}g</strong>
            </div>`).join('');
          return `
            <div class="bol-tarea ${done?'bol-tarea-done':''}" style="flex-direction:column;align-items:stretch;padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;align-items:center;gap:8px">
                <label class="rdc-check-wrap">
                  <input type="checkbox" ${done?'checked':''}
                    onchange="togglePreTarea('${id}_tanda_${i}',${diaIdx},this.checked)">
                  <span class="rdc-check-box"></span>
                </label>
                <span style="font-size:13px;font-weight:600;min-width:60px">Tanda ${i+1}</span>
                <div style="display:flex;align-items:center;gap:6px" id="tanda-display-${id}-${i}">
                  <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:var(--area-color)">${n}</span>
                  <span style="font-size:11px;color:var(--txt3)">masas</span>
                  <button onclick="editarTandaPreElab('${id}',${diaIdx},${i})"
                    style="background:none;border:none;color:var(--txt3);cursor:pointer;padding:2px 4px;font-size:12px"
                    title="Editar cantidad">
                    <i class="ti ti-pencil"></i>
                  </button>
                </div>
                <div style="display:none;align-items:center;gap:6px" id="tanda-edit-${id}-${i}">
                  <input type="number" min="1" max="${maxPorTanda}" value="${n}" id="tanda-input-${id}-${i}"
                    style="width:54px;padding:3px 6px;border:1.5px solid var(--area-color);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace;text-align:center">
                  <button onclick="confirmarTandaPreElab('${id}',${diaIdx},${i})"
                    style="background:var(--area-color);border:none;color:#fff;cursor:pointer;padding:3px 8px;border-radius:var(--r-sm);font-size:12px">
                    <i class="ti ti-check"></i>
                  </button>
                  <button onclick="cancelarTandaPreElab('${id}',${diaIdx},${i})"
                    style="background:none;border:1px solid var(--border);cursor:pointer;padding:3px 6px;border-radius:var(--r-sm);font-size:12px;color:var(--txt3)">
                    <i class="ti ti-x"></i>
                  </button>
                </div>
                ${tandas.length > 1 ? `<button onclick="eliminarTandaPreElab('${id}',${diaIdx},${i})" style="background:none;border:none;color:var(--txt3);cursor:pointer;margin-left:auto"><i class="ti ti-trash" style="font-size:13px"></i></button>` : ''}
              </div>
              ${ings.length ? `
              <div style="margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:var(--r-sm);margin-left:32px" id="ings-tanda-${id}-${i}">
                ${ingRows}
              </div>` : ''}
            </div>`;
        }).join('')}
      </div>`;
  };

  // Estado empastes
  const empPorEstado = totalEmpastes === 0 ? '' : empPorcionados >= totalEmpastes ? 'completado' : empPorcionados > 0 ? 'parcial' : '';
  const empEstEstado = totalEmpastes === 0 ? '' : empEstirados >= totalEmpastes ? 'completado' : empEstirados > 0 ? 'parcial' : '';
  const estadoColor = e => e === 'completado' ? '#2E7D32' : e === 'parcial' ? '#F57C00' : 'var(--txt3)';
  const estadoLabel = e => e === 'completado' ? '✓ Completado' : e === 'parcial' ? '◑ Parcial' : '';

  const noPlan = masasSiguiente.length === 0 && poolishSiguiente.length === 0 && totalEmpastes === 0 && (_planMasasBOL[masasBase[0]?.ID_MP] || [])[diaIdx] === 0;

  contenedor.innerHTML = noPlan ? `
    <div class="empty-state" style="height:200px">
      <i class="ti ti-moon"></i>
      <h2>Sin plan para ${diasNombres[diaSiguiente]}</h2>
      <p>No hay productos ni masas planificadas para mañana.</p>
    </div>` : `

    ${poolishSiguiente.length ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-droplet"></i> ${diasNombres[diaIdx]} AM — Poolish (elaborar 12h antes)
        <span style="margin-left:auto;font-size:11px;font-weight:400">${poolishSiguiente[0].cantidad} masas para ${diasNombres[diaSiguiente]}</span>
      </div>
      ${poolishSiguiente.map(({ mp, cantidad, receta }) =>
        renderTandas(mp.ID_MP + '_poolish', cantidad, receta, 'poolish')
      ).join('')}
    </div>` : ''}

    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="background:#E8F5E9;color:#1B5E20">
        <i class="ti ti-sun-low"></i> ${diasNombres[diaIdx]} PM — Elaboraciones
      </div>

      ${totalEmpastes > 0 ? `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:10px">
          🧈 Empastes — ${totalEmpastes} total (${totalEmpastes * mantPorEmpaste}g mantequilla)
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap">
          <div>
            <div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Porcionados</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <input type="number" min="0" value="${empPorcionados}" id="emp-porcionados"
                style="width:64px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:14px;font-family:'DM Mono',monospace;text-align:center"
                oninput="actualizarEmpastes(${diaIdx})">
              <span style="font-size:11px">/ ${totalEmpastes}</span>
              <span style="font-size:11px;font-weight:600;color:${estadoColor(empPorEstado)}" id="emp-por-estado">${estadoLabel(empPorEstado)}</span>
              ${empPorcionados > totalEmpastes ? `<span style="font-size:11px;color:#2E7D32;font-weight:600">+${empPorcionados - totalEmpastes} para otro día</span>` : ''}
            </div>
          </div>
          <div>
            <div style="font-size:11px;color:var(--txt3);margin-bottom:4px">Estirados</div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <input type="number" min="0" value="${empEstirados}" id="emp-estirados"
                style="width:64px;padding:5px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:14px;font-family:'DM Mono',monospace;text-align:center"
                oninput="actualizarEmpastes(${diaIdx})">
              <span style="font-size:11px">/ ${totalEmpastes}</span>
              <span style="font-size:11px;font-weight:600;color:${estadoColor(empEstEstado)}" id="emp-est-estado">${estadoLabel(empEstEstado)}</span>
              ${empEstirados > totalEmpastes ? `<span style="font-size:11px;color:#2E7D32;font-weight:600">+${empEstirados - totalEmpastes} para otro día</span>` : ''}
            </div>
          </div>
        </div>
      </div>` : ''}

      ${masasSiguiente.map(({ mp, cantidad, receta }) => `
      <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px">
          🌀 Elaborar ${mp.nombre} — ${cantidad} masas (reponer stock)
        </div>
        ${renderTandas(mp.ID_MP + '_masa', cantidad, receta, 'masa')}
      </div>`).join('')}

      <div style="padding:10px 16px">
        <button class="btn-secundario" style="font-size:12px;width:100%"
          onclick="abrirModalTareaManualBOL(${diaIdx},'pre')">
          <i class="ti ti-plus"></i> Agregar tarea manual
        </button>
      </div>
    </div>
  `;

  renderAvisos();
}

function actualizarEmpastes(diaIdx) {
  const semana = obtenerSemanaActual();
  const por = parseInt(document.getElementById('emp-porcionados')?.value) || 0;
  const est = parseInt(document.getElementById('emp-estirados')?.value) || 0;
  localStorage.setItem(`fen_bol_emp_por_${semana}_${diaIdx}`, por);
  localStorage.setItem(`fen_bol_emp_est_${semana}_${diaIdx}`, est);
  // Save to Sheet
  const payload = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: 'empaste_porcionados',
    subtarea: 'empaste_porcionados',
    cantidad: por,
    estado: '1',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload).catch(() => {});
  const payload2 = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: 'empaste_estirados',
    subtarea: 'empaste_estirados',
    cantidad: est,
    estado: '1',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload2).catch(() => {});

  // Calcular total empastes
  let total = 0;
  Object.entries(App.planSemana).forEach(([rid, cant]) => {
    const diaSig = (diaIdx + 1) % 7;
    const unidades = cant[diaSig] || 0;
    if (!unidades) return;
    const receta = App.recetas.find(r => r.ID_receta === rid);
    if (!receta) return;
    let ings = []; try { ings = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(receta.porciones_base) || 1;
    ings.forEach(ing => {
      if ((ing.nombre||'').toLowerCase().includes('empaste'))
        total += Math.ceil((parseFloat(ing.unidades)||1) / porciones * unidades);
    });
  });

  const col = v => v >= total ? '#2E7D32' : v > 0 ? '#F57C00' : 'var(--txt3)';
  const lbl = v => v >= total ? '✓ Completado' : v > 0 ? '◑ Parcial' : '';
  const spPor = document.getElementById('emp-por-estado');
  const spEst = document.getElementById('emp-est-estado');
  if (spPor) { spPor.textContent = lbl(por); spPor.style.color = col(por); }
  if (spEst) { spEst.textContent = lbl(est); spEst.style.color = col(est); }
  // Show extras
  const spPorExtra = document.getElementById('emp-por-extra');
  const spEstExtra = document.getElementById('emp-est-extra');
  if (spPorExtra) { spPorExtra.textContent = por > total ? `+${por-total} para otro día` : ''; }
  if (spEstExtra) { spEstExtra.textContent = est > total ? `+${est-total} para otro día` : ''; }
}

function editarTandaPreElab(id, diaIdx, idx) {
  document.getElementById(`tanda-display-${id}-${idx}`).style.display = 'none';
  const editDiv = document.getElementById(`tanda-edit-${id}-${idx}`);
  editDiv.style.display = 'flex';
  document.getElementById(`tanda-input-${id}-${idx}`)?.focus();
}

function cancelarTandaPreElab(id, diaIdx, idx) {
  document.getElementById(`tanda-display-${id}-${idx}`).style.display = 'flex';
  document.getElementById(`tanda-edit-${id}-${idx}`).style.display = 'none';
}

function confirmarTandaPreElab(id, diaIdx, idx) {
  const input = document.getElementById(`tanda-input-${id}-${idx}`);
  const valor = parseInt(input?.value) || 0;

  // Save to localStorage
  const clave = `fen_bol_pre_tandas_${obtenerSemanaActual()}_${diaIdx}_${id}`;
  let tandas = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })();
  if (tandas) { tandas[idx] = valor; localStorage.setItem(clave, JSON.stringify(tandas)); }

  // Update display
  const displayDiv = document.getElementById(`tanda-display-${id}-${idx}`);
  if (displayDiv) {
    const span = displayDiv.querySelector('span:first-child');
    if (span) span.textContent = valor;
  }
  document.getElementById(`tanda-display-${id}-${idx}`).style.display = 'flex';
  document.getElementById(`tanda-edit-${id}-${idx}`).style.display = 'none';

  // Update ingredients
  const mpId = id.replace('_poolish','').replace('_masa','');
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;
  const receta = App.recetas.find(r => r.nombre === mp.nombre && r.estado === 'consolidada');
  if (!receta) return;
  let ings = []; try { ings = JSON.parse(receta.ingredientes_JSON||'[]'); } catch(e) {}

  ings.forEach(ing => {
    const el = document.getElementById(`ing-${id}-${idx}-${ing.id}`);
    if (el) el.textContent = Math.round((parseFloat(ing.gramos)||0) * valor) + 'g';
  });
}

function agregarTandaPreElab(id, diaIdx) {
  const clave = `fen_bol_pre_tandas_${obtenerSemanaActual()}_${diaIdx}_${id}`;
  let tandas = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })();
  if (!tandas) tandas = [1];
  else tandas.push(1);
  localStorage.setItem(clave, JSON.stringify(tandas));
  renderPreElabDia(diaIdx);
}

function eliminarTandaPreElab(id, diaIdx, idx) {
  const clave = `fen_bol_pre_tandas_${obtenerSemanaActual()}_${diaIdx}_${id}`;
  let tandas = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })();
  if (!tandas || tandas.length <= 1) return;
  tandas.splice(idx, 1);
  localStorage.setItem(clave, JSON.stringify(tandas));
  renderPreElabDia(diaIdx);
}

function actualizarTandaPreElab(id, diaIdx, idx, valor) {
  const clave = `fen_bol_pre_tandas_${obtenerSemanaActual()}_${diaIdx}_${id}`;
  let tandas = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })();
  if (!tandas) return;
  tandas[idx] = parseInt(valor) || 0;
  localStorage.setItem(clave, JSON.stringify(tandas));

  // Actualizar ingredientes usando id de elemento directo (sin selectores con caracteres especiales)
  const elId = `ing-tanda-${id}-${idx}`;
  const ingDiv = document.getElementById(elId);
  if (!ingDiv) return;

  const mpId = id.replace('_poolish','').replace('_masa','');
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;
  const receta = App.recetas.find(r => r.nombre === mp.nombre && r.estado === 'consolidada');
  if (!receta) return;
  let ings = []; try { ings = JSON.parse(receta.ingredientes_JSON||'[]'); } catch(e) {}
  const n = parseInt(valor) || 0;
  ingDiv.innerHTML = ings.map(ing =>
    `<div style="font-size:11px;color:var(--txt2);padding:2px 0">
      ${ing.nombre}: <strong>${Math.round((parseFloat(ing.gramos)||0)*n)}g</strong>
    </div>`
  ).join('');
}

function togglePreTarea(id, diaIdx, checked) {
  const semana = obtenerSemanaActual();
  // localStorage es la fuente de verdad local
  localStorage.setItem(`fen_bol_pre_${semana}_${diaIdx}_${id}`, checked?'1':'0');
  // Actualizar cache Sheet
  _tareasEstadoBOL[`pre_${id}`] = checked ? '1' : '0';
  // Update visual — el elemento puede ser pre-tarea-ID o pre-tarea-ID_tanda_N
  // Try exact id first, then look for tanda containers
  const elDirect = document.getElementById('pre-tarea-' + id);
  if (elDirect) {
    elDirect.classList.toggle('bol-tarea-done', checked);
  } else {
    // It's a tanda checkbox — find the parent tanda div
    document.querySelectorAll(`[id^="pre-tarea-${id}"]`).forEach(el => {
      el.classList.toggle('bol-tarea-done', checked);
    });
  }
  // Save to Sheet in background (best effort)
  const payloadTarea = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: 'pre_' + id,
    subtarea: id,
    cantidad: 0,
    estado: checked ? '1' : '0',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadTarea).catch(() => {});
}


// ── BOL: PRODUCCIÓN DEL DÍA ──────────────────────────────────
async function renderProduccionBOL(diaIdx, recetasHoy) {
  const contenedor = document.getElementById('contenedor-dia');
  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const diaAnterior = (diaIdx + 6) % 7; // día anterior para descongelados
  const cfg = cargarConfigSubrecetas();
  const capacidadHorno = (cfg.bol?.capacidad_horno || 90);

  // Calcular plan de horneado desde plan semanal
  const planHorneado = recetasHoy.map(({ receta: r, unidades }) => ({
    id: r.ID_receta,
    nombre: r.nombre,
    unidades: parseInt(unidades) || 0,
    b2b: 0,    // se ingresa manualmente
    a_hornear: parseInt(unidades) || 0
  }));

  const totalHornear = planHorneado.reduce((s,p) => s + p.a_hornear, 0);
  const tandasNecesarias = Math.ceil(totalHornear / capacidadHorno);

  // Cargar tareas guardadas
  const clavePrefix = `fen_bol_tarea_${obtenerSemanaActual()}_${diaIdx}`;

  // Tareas del día anterior (descongelados PM)
  const masasBase = App.materiasPrimas.filter(m => {
    const esSR = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    return esSR && nombre.includes('masa') && !nombre.includes('madre') &&
           !nombre.includes('poolish') &&
           (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });

  const masasPlanAnterior = masasBase.map(m => ({
    nombre: m.nombre,
    cantidad: (_planMasasBOL[m.ID_MP] || [])[diaIdx] || 0
  })).filter(m => m.cantidad > 0);

  const productosFormados = planHorneado.filter(p => p.a_hornear > 0);

  // Generar tareas automáticas
  const tareasAutomaticas = [
    // Día anterior PM — descongelados
    ...masasPlanAnterior.map(m => ({
      id: `desc_masa_${m.nombre.replace(/\s/g,'_')}`,
      hora: '15:00',
      turno: 'anterior_pm',
      icono: '❄️',
      titulo: `Descongelar masa base: ${m.nombre}`,
      detalle: `${m.cantidad} masa${m.cantidad>1?'s':''} en frío para mañana`
    })),
    ...productosFormados.map(p => ({
      id: `desc_prod_${p.id}`,
      hora: '15:30',
      turno: 'anterior_pm',
      icono: '🧊',
      titulo: `Descongelar productos: ${p.nombre}`,
      detalle: `${p.a_hornear} uni para hornear mañana`
    })),
    // Día actual AM
    { id: 'revisar_b2b', hora: '06:30', turno: 'am', icono: '📋', titulo: 'Revisar pedidos B2B', detalle: 'Actualizar cantidades a hornear' },
    { id: 'estirar_paston', hora: '08:00', turno: 'am', icono: '🧈', titulo: 'Estirar pastón', detalle: 'Laminar y estirar masas descongeladas' },
    { id: 'formar_productos', hora: '09:00', turno: 'am', icono: '✂️', titulo: 'Formar productos', detalle: 'Cortar, formar y preparar para hornear o congelar' },
    // Tarea de horneado se agrega manualmente según disponibilidad real del horno
  ];

  // Cargar tareas manuales del localStorage
  const tareasManualKey = `fen_bol_tareas_manuales_${obtenerSemanaActual()}_${diaIdx}`;
  const tareasManual = (() => { try { return JSON.parse(localStorage.getItem(tareasManualKey)||'[]'); } catch(e) { return []; } })();

  const todasTareas = [...tareasAutomaticas, ...tareasManual]
    .sort((a,b) => a.hora.localeCompare(b.hora));

  // Estado de tareas
  function getTareaEstado(id) {
    return getTareaEstadoBOL(id, obtenerSemanaActual(), diaIdx, 'prod');
  }
  function setTareaEstado(id, v) {
    try { localStorage.setItem(`fen_bol_check_${obtenerSemanaActual()}_${diaIdx}_${id}`, v?'1':'0'); } catch(e) {}
  }

  // Render
  const tareasAnterioresPM = todasTareas.filter(t => t.turno === 'anterior_pm');
  const tareasAM = todasTareas.filter(t => t.turno === 'am');

  const renderTarea = (t) => {
    const done = getTareaEstado(t.id);
    return `
      <div class="bol-tarea ${done?'bol-tarea-done':''}" id="tarea-${t.id}">
        <label class="rdc-check-wrap" onclick="event.stopPropagation()">
          <input type="checkbox" ${done?'checked':''}
            onchange="toggleTareaBOLProduccion('${t.id}',this.checked)">
          <span class="rdc-check-box"></span>
        </label>
        <input type="time" value="${t.hora}"
          style="border:none;background:none;font-family:'DM Mono',monospace;font-size:12px;color:var(--txt3);width:70px;cursor:pointer;padding:0;min-width:70px"
          onchange="actualizarHoraTarea('${t.id}',this.value,'${t.turno==='anterior_pm'?'anterior_pm':'am'}')">
        <span style="font-size:16px;flex-shrink:0">${t.icono}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:600;${done?'text-decoration:line-through;color:var(--txt3)':''}">${t.titulo}</div>
          <div style="font-size:11px;color:var(--txt3)">${t.detalle}</div>
        </div>
        ${t.manual ? `<button onclick="eliminarTareaManualBOL('${t.id}',${diaIdx})" style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:14px"><i class="ti ti-x"></i></button>` : ''}
      </div>`;
  };

  contenedor.innerHTML = `
    <div class="avisos-container" style="margin-bottom:12px"></div>

    <!-- PLAN DE HORNEADO -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#FFF3E0;color:#E65100">
        <i class="ti ti-flame"></i> Plan de horneado — ${diasNombres[diaIdx]}
        <span style="margin-left:auto;font-size:11px;font-weight:400">
          Cap. horno: ${capacidadHorno} uni/tanda · ${tandasNecesarias} tanda${tandasNecesarias>1?'s':''} necesaria${tandasNecesarias>1?'s':''}
        </span>
      </div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead>
            <tr style="background:var(--bg)">
              <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Producto</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Plan</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Stock congelado</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">A descongelar</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">A formar hoy</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">B2B</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">B2C BA</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">B2C Ain</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">A hornear</th>
            </tr>
          </thead>
          <tbody>
            ${planHorneado.map(p => {
              const claveStock = `fen_bol_stock_${obtenerSemanaActual()}_${diaIdx}_${p.id}`;
              const stockCongelado = parseInt(localStorage.getItem(claveStock)) || 0;
              const claveb2b = `fen_bol_b2b_${obtenerSemanaActual()}_${diaIdx}_${p.id}`;
              const b2bVal = parseInt(localStorage.getItem(claveb2b)) || 0;
              const aDescongelar = Math.min(p.unidades, stockCongelado);
              const aFormarHoy = Math.max(0, Math.max(p.unidades, b2bVal) - aDescongelar);
              const aHornear = Math.max(p.unidades, b2bVal);
              return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 16px;font-weight:500">${p.nombre}</td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace">${p.unidades}</td>
                <td style="text-align:center;padding:8px">
                  <input type="number" min="0" value="${stockCongelado}" data-prod="${p.id}" data-tipo="stock"
                    style="width:60px;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace"
                    oninput="actualizarStockCirculante(this,${diaIdx})">
                </td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;color:#1565C0;font-weight:600" id="a-descongelar-${p.id}">
                  ${aDescongelar}
                </td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;color:#E65100;font-weight:600" id="a-formar-${p.id}">
                  ${aFormarHoy}
                </td>
                <td style="text-align:center;padding:8px">
                  <input type="number" min="0" value="${b2bVal}" data-prod="${p.id}" data-tipo="b2b"
                    style="width:60px;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace"
                    oninput="actualizarStockCirculante(this,${diaIdx})">
                </td>
                <td style="text-align:center;padding:8px">
                  <input type="number" min="0" value="${parseInt(localStorage.getItem(`fen_bol_b2c_ba_${obtenerSemanaActual()}_${diaIdx}_${p.id}`))||0}" data-prod="${p.id}" data-tipo="b2c_ba"
                    style="width:60px;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace"
                    oninput="actualizarStockCirculante(this,${diaIdx})">
                </td>
                <td style="text-align:center;padding:8px">
                  <input type="number" min="0" value="${parseInt(localStorage.getItem(`fen_bol_b2c_ain_${obtenerSemanaActual()}_${diaIdx}_${p.id}`))||0}" data-prod="${p.id}" data-tipo="b2c_ain"
                    style="width:60px;text-align:center;padding:4px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace"
                    oninput="actualizarStockCirculante(this,${diaIdx})">
                </td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;font-weight:700;color:#E65100;font-size:15px" id="a-hornear-${p.id}">
                  ${aHornear}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg)">
              <td colspan="3" style="padding:8px 16px;font-weight:700;font-size:12px">Total</td>
              <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;font-weight:700;color:#E65100;font-size:14px" id="total-hornear">
                ${totalHornear}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- TAREAS DÍA ANTERIOR PM -->
    ${tareasAnterioresPM.length ? `
    <div class="card" style="margin-bottom:16px;border-color:#E3F2FD">
      <div class="card-head" style="background:#E3F2FD;color:#1565C0">
        <i class="ti ti-moon"></i> ${diasNombres[diaAnterior]} PM — Preparar para mañana
      </div>
      <div style="padding:8px 0">
        ${tareasAnterioresPM.map(renderTarea).join('')}
      </div>
    </div>` : ''}

    <!-- TAREAS DÍA ACTUAL AM -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#FFF8E1;color:#F57C00">
        <i class="ti ti-sun"></i> ${diasNombres[diaIdx]} AM — Producción
      </div>
      <div style="padding:8px 0">
        ${tareasAM.map(renderTarea).join('')}
      </div>
      <div style="padding:10px 16px;border-top:1px solid var(--border)">
        <button class="btn-secundario" style="font-size:12px;width:100%"
          onclick="abrirModalTareaManualBOL(${diaIdx})">
          <i class="ti ti-plus"></i> Agregar tarea manual
        </button>
      </div>
    </div>
  `;

  renderAvisos();
}

function toggleTareaBOLProduccion(id, checked) {
  const semana = obtenerSemanaActual();
  const diaIdx = App._diaActual || 0;
  // Save to localStorage for immediate response
  localStorage.setItem(`fen_bol_check_${semana}_${diaIdx}_${id}`, checked?'1':'0');
  // Update visual
  const elProd = document.getElementById('tarea-' + id);
  if (elProd) elProd.classList.toggle('bol-tarea-done', checked);
  // Save to Sheet in background
  const payloadTarea2 = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: 'prod_' + id,
    subtarea: id,
    cantidad: 0,
    estado: checked ? '1' : '0',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadTarea2).catch(() => {});
}

function actualizarStockCirculante(input, diaIdx) {
  const prodId = input.dataset.prod;
  const tipo   = input.dataset.tipo;
  const val    = parseInt(input.value) || 0;
  const semana = obtenerSemanaActual();

  // Guardar en localStorage
  if (tipo === 'stock')  localStorage.setItem(`fen_bol_stock_${semana}_${diaIdx}_${prodId}`, val);
  if (tipo === 'b2b')    localStorage.setItem(`fen_bol_b2b_${semana}_${diaIdx}_${prodId}`, val);
  if (tipo === 'b2c_ba') localStorage.setItem(`fen_bol_b2c_ba_${semana}_${diaIdx}_${prodId}`, val);
  if (tipo === 'b2c_ain')localStorage.setItem(`fen_bol_b2c_ain_${semana}_${diaIdx}_${prodId}`, val);

  // Recalcular fila
  const row = input.closest('tr');
  const plan = parseInt(row?.querySelector('td:nth-child(2)')?.textContent) || 0;
  const stockInput = row?.querySelector('input[data-tipo="stock"]');
  const b2bInput   = row?.querySelector('input[data-tipo="b2b"]');
  const stock = parseInt(stockInput?.value) || 0;
  const b2b   = parseInt(b2bInput?.value) || 0;

  const aDescongelar = Math.min(plan, stock);
  const aHornear     = Math.max(plan, b2b);
  const aFormar      = Math.max(0, aHornear - aDescongelar);

  const spDes = document.getElementById('a-descongelar-' + prodId);
  const spFor = document.getElementById('a-formar-' + prodId);
  const spHor = document.getElementById('a-hornear-' + prodId);
  if (spDes) spDes.textContent = aDescongelar;
  if (spFor) spFor.textContent = aFormar;
  if (spHor) spHor.textContent = aHornear;

  // Total
  let total = 0;
  document.querySelectorAll('[id^="a-hornear-"]').forEach(s => total += parseInt(s.textContent)||0);
  const totalSpan = document.getElementById('total-hornear');
  if (totalSpan) totalSpan.textContent = total;
}

function abrirModalTareaManualBOL(diaIdx) {
  const modal = document.getElementById('modal-tarea-manual-bol');
  if (modal) {
    document.getElementById('tarea-manual-dia').value = diaIdx;
    document.getElementById('tarea-manual-hora').value = '10:00';
    document.getElementById('tarea-manual-titulo').value = '';
    document.getElementById('tarea-manual-detalle').value = '';
    modal.classList.remove('hidden');
  }
}

function guardarTareaManualBOL() {
  const diaIdx = parseInt(document.getElementById('tarea-manual-dia').value);
  const hora   = document.getElementById('tarea-manual-hora').value;
  const titulo = document.getElementById('tarea-manual-titulo').value.trim();
  const detalle = document.getElementById('tarea-manual-detalle').value.trim();
  if (!titulo) { toast('Escribe un título para la tarea'); return; }

  const key = `fen_bol_tareas_manuales_${obtenerSemanaActual()}_${diaIdx}`;
  const tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
  tareas.push({ id: `manual_${Date.now()}`, hora, titulo, detalle, turno: 'am', icono: '📝', manual: true });
  localStorage.setItem(key, JSON.stringify(tareas));
  document.getElementById('modal-tarea-manual-bol').classList.add('hidden');
  renderProduccionBOL(diaIdx, App._recetasHoyBOL || []);
  toast('Tarea agregada');
}

function eliminarTareaManualBOL(id, diaIdx) {
  const key = `fen_bol_tareas_manuales_${obtenerSemanaActual()}_${diaIdx}`;
  let tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem(key, JSON.stringify(tareas));
  renderProduccionBOL(diaIdx, App._recetasHoyBOL || []);
}

function actualizarHoraTarea(id, hora, turno) {
  // Guardar hora modificada en localStorage
  const key = `fen_bol_hora_${obtenerSemanaActual()}_${App._diaActual||0}_${id}`;
  localStorage.setItem(key, hora);
}

// ── ADMIN: APROBACIONES ───────────────────────────────────────
function renderVistaAprobaciones() {
  const pendientes = App.recetas.filter(r => r.estado === 'pendiente_aprobación');
  const vista = document.getElementById('vista-aprobaciones');
  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Aprobaciones</h1></div>
    ${!pendientes.length ? `
      <div class="empty-state">
        <i class="ti ti-check-circle"></i>
        <h2>Todo al día</h2>
        <p>No hay recetas pendientes de aprobación.</p>
      </div>` : pendientes.map(r => {
        let ingredientes = [];
        try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
        const areaInfo = FEN.AREAS[r._area] || {};
        return `
          <div class="card" style="margin-bottom:16px">
            <div class="card-head">
              <span style="background:${areaInfo.bg};color:${areaInfo.color};
                padding:2px 8px;border-radius:99px;font-size:11px">${areaInfo.nombre || r.área}</span>
              <strong style="margin-left:6px">${r.nombre}</strong>
              <div style="margin-left:auto;display:flex;gap:8px">
                <button id="btn-devolver-${r.ID_receta}" class="btn-peligro" style="font-size:12px;padding:5px 12px"
                  onclick="rechazarReceta('${r.ID_receta}','${r._area}')">
                  <i class="ti ti-x"></i> Devolver
                </button>
                <button id="btn-aprobar-${r.ID_receta}" class="btn-primario" style="font-size:12px;padding:5px 12px"
                  onclick="aprobarReceta('${r.ID_receta}','${r._area}')">
                  <i class="ti ti-check"></i> Aprobar
                </button>
              </div>
            </div>
            <div class="card-body">
              <div style="display:flex;gap:16px;font-size:13px;color:var(--txt2);margin-bottom:12px">
                <span><strong>Rendimiento:</strong> ${r.porciones_base} unid.</span>
                <span><strong>Ingredientes:</strong> ${ingredientes.length}</span>
                <span><strong>Versión:</strong> ${r.versión||1}</span>
                ${r.peso_harina_total_g ? `<span><strong>Harina base:</strong> ${r.peso_harina_total_g}g</span>` : ''}
              </div>
              ${ingredientes.length ? `
              <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
                <thead><tr>
                  <th style="text-align:left;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Ingrediente</th>
                  <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Gramos</th>
                  ${r._area === 'PAN' || r.área === 'Panadería' ? `<th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">% pan.</th>` : ''}
                  <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Costo</th>
                </tr></thead>
                <tbody>
                  ${ingredientes.map(ing => {
                    const tieneUnidades = ing.unidades !== undefined && ing.unidades !== null;
                    const displayVal = tieneUnidades
                      ? `${parseFloat(ing.unidades).toFixed(0)} uni`
                      : `${parseFloat(ing.gramos||0).toFixed(1)}g`;
                    return `
                    <tr>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--txt);font-weight:500">${ing.nombre}</td>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:600">${displayVal}</td>
                      ${r._area === 'PAN' || r.área === 'Panadería' ? `<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:#E65100">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2);font-size:11px">$${parseFloat(ing.costo||0).toFixed(0)}</td>
                    </tr>`;
                  }).join('')}
                  <tr style="background:var(--bg);font-weight:600">
                    <td style="padding:6px 10px">Total ingredientes</td>
                    <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace">
                      ${ingredientes.some(i=>i.unidades!=null)
                        ? ingredientes.filter(i=>i.unidades==null).reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(1)+'g + sub recetas en uni'
                        : ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(1)+'g'}
                    </td>
                    ${r._area === 'PAN' || r.área === 'Panadería' ? '<td></td>' : ''}
                    <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">
                      $${ingredientes.reduce((s,i)=>s+(parseFloat(i.costo)||0),0).toFixed(0)}
                    </td>
                  </tr>
                </tbody>
              </table>` : ''}
              ${r.observaciones_procedimiento ? `
                <div style="margin-top:12px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);margin-bottom:5px">Procedimiento / observaciones</div>
                  <p style="font-size:13px;color:var(--txt2);line-height:1.6;background:var(--bg);padding:10px 12px;border-radius:var(--r-md)">${r.observaciones_procedimiento}</p>
                </div>` : ''}
              ${r['sistematización_notas'] ? `
                <div style="margin-top:10px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);margin-bottom:5px">Notas de sistematización</div>
                  <p style="font-size:12px;color:var(--txt3);font-style:italic;background:var(--bg);padding:8px 12px;border-radius:var(--r-md)">${r['sistematización_notas']}</p>
                </div>` : ''}
            </div>
          </div>`;
      }).join('')}
  `;
  mostrarVista('aprobaciones');
}

async function aprobarReceta(recetaId, areaCodigo) {
  const btn = document.getElementById('btn-aprobar-' + recetaId);
  bloquearBtn(btn, 'Aprobando...');
  try {
    const hoja = FEN.AREAS[areaCodigo]?.hoja_recetas;
    await escribirEnSheet('aprobar_receta', { ID_receta: recetaId, hoja, aprobada_por: 'Admin' });
    clearEstadoLocal(recetaId);
    const r = App.recetas.find(x => x.ID_receta === recetaId);
    if (r) r.estado = 'consolidada';
    toast('Receta aprobada y enviada al maestro');
    setTimeout(() => renderVistaAprobaciones(), 1200);
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-check"></i> Aprobar', false);
    toast('Error: ' + e.message, 'error');
  }
}

async function rechazarReceta(recetaId, areaCodigo) {
  const btn = document.getElementById('btn-devolver-' + recetaId);
  bloquearBtn(btn, 'Devolviendo...');
  try {
    const hoja = FEN.AREAS[areaCodigo]?.hoja_recetas;
    await escribirEnSheet('cambiar_estado', { ID_receta: recetaId, hoja, estado: 'en_prueba' });
    const r = App.recetas.find(x => x.ID_receta === recetaId);
    if (r) r.estado = 'en_prueba';
    toast('Receta devuelta a prueba');
    setTimeout(() => renderVistaAprobaciones(), 1200);
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-x"></i> Devolver', false);
    toast('Error: ' + e.message, 'error');
  }
}

// ── ADMIN: ELIMINAR RECETA ───────────────────────────────────
function confirmarEliminarReceta(recetaId, nombre, area) {
  const modal = document.getElementById('modal-eliminar-receta');
  document.getElementById('eliminar-receta-nombre').textContent = `"${nombre}"`;
  document.getElementById('btn-confirmar-eliminar').onclick = () => eliminarReceta(recetaId, area);
  modal.classList.remove('hidden');
}

async function eliminarReceta(recetaId, area) {
  const btn = document.getElementById('btn-confirmar-eliminar');
  bloquearBtn(btn, 'Eliminando...');

  // Determinar hoja buscando en todas las areas
  let hoja = null;
  for (const [codigo, areaObj] of Object.entries(FEN.AREAS)) {
    if (areaObj.nombre === area || areaObj.nombre.normalize('NFD').replace(/[̀-ͯ]/g,'') === area.normalize('NFD').replace(/[̀-ͯ]/g,'')) {
      hoja = areaObj.hoja_recetas;
      break;
    }
  }
  // Fallback: buscar en App.recetas
  if (!hoja) {
    const receta = App.recetas.find(r => r.ID_receta === recetaId);
    if (receta?._area) hoja = FEN.AREAS[receta._area]?.hoja_recetas;
  }

  console.log('[fën] Eliminando receta:', recetaId, 'hoja:', hoja);

  // Eliminar usa GET directo (payload pequeño, necesita respuesta confirmada)
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'eliminar_receta', ID_receta: recetaId, hoja }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload);
    const data = await res.json();
    console.log('[fën] Respuesta eliminar:', data);
    if (!data.ok) {
      toast('Error al eliminar en Sheet: ' + data.msg, 'error');
      desbloquearBtn(btn, '<i class="ti ti-trash"></i> Eliminar', false);
      return;
    }
  } catch(e) {
    console.error('[fën] Error eliminando:', e);
    toast('Error de conexión al eliminar', 'error');
    desbloquearBtn(btn, '<i class="ti ti-trash"></i> Eliminar', false);
    return;
  }

  // Remover local inmediatamente
  App.recetas = App.recetas.filter(r => r.ID_receta !== recetaId);

  // Invalidar caché del maestro para que recargue
  Cache.invalidar('Maestro_recetas');
  if (hoja) Cache.invalidar(hoja);

  document.getElementById('modal-eliminar-receta').classList.add('hidden');
  desbloquearBtn(btn, '<i class="ti ti-trash"></i> Eliminar', true);
  toast('Receta eliminada');

  // Recargar maestro desde Sheet
  await renderVistaMaestroAdmin();
}

// ── ADMIN: FLUJO SOLICITUD MP ─────────────────────────────────
async function notificarJefaMP(mpId, nombre) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  const areaCode = mp?.area_codigo || mp?.areas_habilitadas?.split(',')?.[0] || '';

  await getSheet('editar_campo_mp', { ID_MP: mpId, campo: 'estado', valor: 'recibida' });

  // Crear aviso para la jefa del área via GET (payload pequeño)
  if (areaCode) {
    getSheet('crear_aviso', {
      area_codigo: areaCode,
      tipo: 'mp_recibida',
      mensaje: 'Tu solicitud fue recibida por administracion - esta siendo revisada.',
      mp_id: mpId
    }).then(r => console.log('[fën] aviso recibida:', r));
  }

  if (mp) mp.estado = 'recibida';
  toast(`Notificado: "${nombre}" fue recibida`);
  // Force reload MP from Sheet to avoid stale cache
  App.materiasPrimas = App.materiasPrimas.map(m => m.ID_MP === mpId ? {...m, estado: 'recibida'} : m);
  Cache.invalidar('MP_maestro');
  renderVistaMP();
}

async function aprobarMP(mpId) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;

  const sinCosto = !mp.costo_neto || parseFloat(mp.costo_neto) === 0;
  if (sinCosto) {
    if (!confirm(`"${mp.nombre}" no tiene costo. ¿Agregar igual? Aparecerá en rojo hasta costearse.`)) return;
  }

  await getSheet('editar_campo_mp', { ID_MP: mpId, campo: 'estado', valor: 'activa' });

  const areaCode = mp.area_codigo || mp.areas_habilitadas?.split(',')?.[0] || '';
  if (areaCode) {
    getSheet('crear_aviso', {
      area_codigo: areaCode,
      tipo: 'mp_aprobada',
      mensaje: mp.nombre + ' fue aprobada y esta disponible - actualiza tu receta.',
      mp_id: mpId
    }).then(r => console.log('[fën] aviso aprobada:', r));
  }

  mp.estado = 'activa';
  toast(`"${mp.nombre}" aprobada — aviso enviado a la jefa`);
  Cache.invalidar('MP_maestro');
  renderVistaMP();
}

function asignarMPExistente(mpIdSolicitud, nombreSolicitud) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpIdSolicitud);
  const areaCode = mp?.area_codigo || mp?.areas_habilitadas || '';

  // Mostrar todas las MPs activas para que admin pueda asignar cualquiera
  const existentes = App.materiasPrimas.filter(m =>
    (m.estado === 'activa' || m.estado === 'recibida') && m.ID_MP !== mpIdSolicitud
  );
  const modal = document.getElementById('modal-asignar-mp');
  document.getElementById('asignar-mp-nueva-id').value = mpIdSolicitud;
  document.getElementById('asignar-mp-area').value = areaCode;
  document.getElementById('asignar-mp-receta').value = mp?.receta_id_origen || '';
  document.getElementById('asignar-mp-nueva-nombre').textContent = nombreSolicitud;
  document.getElementById('asignar-mp-select').innerHTML =
    '<option value="">— Selecciona una MP existente —</option>' +
    existentes.map(m => `<option value="${m.ID_MP}" data-nombre="${m.nombre}">${m.nombre}</option>`).join('');
  modal.classList.remove('hidden');
}

async function confirmarAsignarMP() {
  const mpSolicitudId = document.getElementById('asignar-mp-nueva-id').value;
  const mpExistId     = document.getElementById('asignar-mp-select').value;
  const areaCode      = document.getElementById('asignar-mp-area').value;
  const recetaId      = document.getElementById('asignar-mp-receta').value;
  const nombreExist   = document.getElementById('asignar-mp-select').selectedOptions[0]?.dataset.nombre || '';

  if (!mpExistId) { toast('Selecciona una MP existente'); return; }

  // 1. Marcar solicitud como reemplazada
  const r1 = await getSheet('editar_campo_mp', { ID_MP: mpSolicitudId, campo: 'estado', valor: 'reemplazada' });
  console.log('[fën] marcar reemplazada:', r1);

  // 2. Habilitar el área en la MP existente
  const mpExist = App.materiasPrimas.find(m => m.ID_MP === mpExistId);
  if (mpExist && areaCode) {
    const areasActuales = (mpExist.areas_habilitadas || '').split(',').map(a => a.trim()).filter(Boolean);
    if (!areasActuales.includes(areaCode)) {
      areasActuales.push(areaCode);
      const nuevasAreas = areasActuales.join(',');
      const r2 = await getSheet('editar_campo_mp', { ID_MP: mpExistId, campo: 'areas_habilitadas', valor: nuevasAreas });
      console.log('[fën] habilitar area:', r2);
      mpExist.areas_habilitadas = nuevasAreas;
    }
  }

  // 3. Reemplazar ingrediente en la receta automáticamente
  if (recetaId && areaCode) {
    await escribirEnSheet('reemplazar_mp_receta', {
      area_codigo:  areaCode,
      receta_id:    recetaId,
      mp_id_vieja:  mpSolicitudId,
      mp_id_nueva:  mpExistId,
      nombre_nueva: nombreExist
    });
  }

  // Actualizar local
  const mpSol = App.materiasPrimas.find(m => m.ID_MP === mpSolicitudId);
  if (mpSol) mpSol.estado = 'reemplazada';

  document.getElementById('modal-asignar-mp').classList.add('hidden');
  const mpSolObj = App.materiasPrimas.find(m => m.ID_MP === mpSolicitudId);
  const areaCode2 = mpSolObj?.area_codigo || areaCode || '';
  // Update local state immediately
  App.materiasPrimas = App.materiasPrimas.map(m => m.ID_MP === mpSolicitudId ? {...m, estado: 'reemplazada'} : m);
  if (areaCode2) {
    getSheet('crear_aviso', {
      area_codigo: areaCode2,
      tipo: 'mp_asignada',
      mensaje: 'Tu solicitud fue resuelta: usa ' + nombreExist + ' en lugar del ingrediente pendiente.',
      mp_id: mpSolicitudId
    }).then(r => console.log('[fën] aviso asignada:', r));
  }

  toast(`Asignado "${nombreExist}" — aviso enviado a la jefa`);
  Cache.invalidar('MP_maestro');
  renderVistaMP();
}

// ── ADMIN: MATERIAS PRIMAS ────────────────────────────────────
function renderVistaMP() {
  const mp = App.materiasPrimas;
  const pendientes = mp.filter(m => m.estado === 'pendiente' || m.estado === 'recibida').filter(m => m.tipo !== 'sub_receta');
  const vista = document.getElementById('vista-mp');
  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Materias primas</h1>
      <button class="btn-primario" onclick="abrirFormNuevaMP()">
        <i class="ti ti-plus"></i> Nueva MP
      </button>
    </div>
    ${pendientes.length ? `
      <div class="card" style="margin-bottom:16px;border-color:#FFA726">
        <div class="card-head" style="background:#FFF3E0;color:#E65100">
          <i class="ti ti-bell"></i>
          Solicitudes de nuevas materias primas (${pendientes.length})
        </div>
        ${pendientes.map(p => {
          const areaLabel = p.solicitada_por ||
            Object.entries(FEN.AREAS).find(([k,_]) => k === p.area_codigo)?.[1]?.nombre ||
            Object.values(FEN.AREAS).find(a => a.hoja_recetas === p.area)?.nombre ||
            p.area || 'Área desconocida';
          const sinCosto = !p.costo_neto || parseFloat(p.costo_neto) === 0;
          return `
          <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:180px">
              <div style="font-size:14px;font-weight:600">${p.nombre}</div>
              <div style="font-size:11px;color:var(--txt2);margin-top:2px">
                Solicitada por <strong>${areaLabel}</strong> · ${p.categoría||'Sin categoría'}
                ${p.estado==='recibida' ? '<span style="font-size:10px;color:#1565C0;font-weight:600;margin-left:6px">✓ Acuse de recibo enviado</span>' : ''}
              </div>
              ${sinCosto ? `<span style="font-size:10px;color:#C62828;font-weight:600;background:#FFEBEE;padding:2px 6px;border-radius:99px">
                ⚠ Sin costear
              </span>` : `<span style="font-size:11px;color:var(--txt2)">Costo: ${clp(p.costo_neto)}</span>`}
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button class="btn-secundario" style="font-size:12px;padding:5px 10px;border-color:#90CAF9;color:#1565C0"
                onclick="notificarJefaMP('${p.ID_MP}','${p.nombre}')" title="Notificar a la jefa que fue recibida">
                <i class="ti ti-send"></i> Recibido
              </button>
              <button class="btn-primario" style="font-size:12px;padding:5px 10px"
                onclick="aprobarMP('${p.ID_MP}')" title="Agregar al maestro de MP">
                <i class="ti ti-check"></i> Agregar al maestro
              </button>
              <button class="btn-secundario" style="font-size:12px;padding:5px 10px"
                onclick="asignarMPExistente('${p.ID_MP}','${p.nombre}')" title="Asignar a una MP ya existente">
                <i class="ti ti-link"></i> Usar MP existente
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Catálogo (${mp.filter(m=>m.estado==='activa').length} activas)</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">MP</th>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Categoría</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo neto</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">$/g</th>
          <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Estado</th>
          <th style="padding:9px 16px;background:var(--bg);border-bottom:1px solid var(--border)"></th>
        </tr></thead>
        <tbody>
          ${mp.map(m => {
            const est = m.estado==='activa'
              ? {c:'#2E7D32',bg:'#E8F5E9',l:'Activa'}
              : m.estado==='pendiente'
              ? {c:'#1565C0',bg:'#E3F2FD',l:'Pendiente'}
              : {c:'#9E9E9E',bg:'#F5F5F5',l:'Inactiva'};
            return `<tr>
              <td class="td-nombre">${m.nombre}
                ${(!m.costo_neto||parseFloat(m.costo_neto)===0)&&m.estado==='activa' ? '<span style="font-size:10px;color:#C62828;font-weight:600;margin-left:4px">⚠ sin costo</span>' : ''}
                <br><span style="font-size:11px;color:var(--txt3);font-weight:400">${m.ID_MP}</span>
              </td>
              <td style="font-size:13px;color:var(--txt2)">${m.categoría||'—'}</td>
              <td class="td-num" style="${(!m.costo_neto||parseFloat(m.costo_neto)===0)&&m.estado==='activa'?'color:#C62828':''}">${clp(m.costo_neto)||'—'}</td>
              <td class="td-num" style="font-size:11px">${parseFloat(m.costo_por_gramo||0).toFixed(4)}</td>
              <td style="text-align:center">
                <span class="estado-badge" style="color:${est.c};background:${est.bg}">${est.l}</span>
              </td>
              <td style="text-align:right;padding:6px 12px">
                <div style="display:flex;gap:4px;justify-content:flex-end">
                  <button class="btn-secundario" style="font-size:12px;padding:4px 10px"
                    onclick="editarMP('${m.ID_MP}')" title="Editar precio">
                    <i class="ti ti-edit"></i>
                  </button>
                  <button class="btn-secundario" style="font-size:12px;padding:4px 10px;color:${m.estado==='inactiva'?'#2E7D32':'#C62828'};border-color:${m.estado==='inactiva'?'#A5D6A7':'#FFCDD2'}"
                    onclick="toggleEstadoMP('${m.ID_MP}','${m.estado}')" title="${m.estado==='inactiva'?'Activar':'Desactivar'}">
                    <i class="ti ${m.estado==='inactiva'?'ti-eye':'ti-eye-off'}"></i>
                  </button>
                  <button class="btn-secundario" style="font-size:12px;padding:4px 10px"
                    onclick="gestionarAreasMP('${m.ID_MP}')" title="Gestionar areas">
                    <i class="ti ti-layout-grid"></i>
                  </button>
                </div>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  mostrarVista('mp');
}

// ── ADMIN: COSTOS ─────────────────────────────────────────────
async function renderVistaCostos() {
  const ec = await Cache.get('EC_productos', () => leerHoja('EC_productos'));
  const vista = document.getElementById('vista-costos');
  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Estructuras de costo</h1></div>
    ${!ec.length ? `
      <div class="empty-state">
        <i class="ti ti-chart-bar-off"></i>
        <h2>Sin datos</h2>
        <p>Las EC aparecen aquí cuando se aprueban recetas.</p>
      </div>` : `
      <div class="card">
        <div class="card-head"><i class="ti ti-calculator"></i> Todos los productos</div>
        <table class="tabla-vista">
          <thead><tr>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Producto</th>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Área</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo MP</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">P. B2C</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">P. B2B</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Margen B2C</th>
          </tr></thead>
          <tbody>
            ${ec.map(r => `<tr>
              <td class="td-nombre">${r.nombre}</td>
              <td style="font-size:13px;color:var(--txt2)">${r.área}</td>
              <td class="td-num">${clp(r.costo_MP_unit)}</td>
              <td class="td-num">${clp(r.precio_B2C)}</td>
              <td class="td-num">${clp(r.precio_B2B)}</td>
              <td class="td-num" style="color:#2E7D32">${parseFloat(r['utilidad_mes_%']||0).toFixed(1)}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
  `;
  mostrarVista('costos');
}

// ── ADMIN: MAESTRO ────────────────────────────────────────────
async function renderVistaMaestroAdmin() {
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  const vista = document.getElementById('vista-maestro-admin');
  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Maestro de recetas</h1></div>
    <div class="card">
      <div class="card-head"><i class="ti ti-book"></i> Todas las recetas consolidadas (${maestro.length})</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Receta</th>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Área</th>
          <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Tipo</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Rendimiento</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Versión</th>
          <th style="padding:9px 16px;background:var(--bg);border-bottom:1px solid var(--border)"></th>
        </tr></thead>
        <tbody>
          ${maestro.map(r => {
            const esSubReceta = r.tipo_receta === 'sub_receta';
            return `<tr>
            <td class="td-nombre">${r.nombre}</td>
            <td style="font-size:13px;color:var(--txt2)">${r.área}</td>
            <td style="text-align:center">
              <span style="font-size:10px;padding:2px 8px;border-radius:99px;font-weight:600;
                background:${esSubReceta?'#EDE9FE':'#E8F5E9'};
                color:${esSubReceta?'#5B21B6':'#166534'}">
                ${esSubReceta?'⟳ Sub receta':'Receta'}
              </span>
            </td>
            <td class="td-num">${r.porciones_base} unid.</td>
            <td class="td-num">v${r.versión_actual||1}</td>
            <td style="text-align:right;padding:6px 16px">
              <button class="btn-peligro" style="font-size:12px;padding:4px 10px"
                onclick="confirmarEliminarReceta('${r.ID_receta}','${r.nombre}','${r.área}')">
                <i class="ti ti-trash"></i>
              </button>
            </td>
          </tr>`;}).join('')}
        </tbody>
      </table>
    </div>
  `;
  mostrarVista('maestro-admin');
}

// ── MP: SOLICITAR Y EDITAR ────────────────────────────────────
function solicitarNuevaMP(selectEl) {
  // Mostrar modal de solicitud sin salir del formulario
  const modal = document.getElementById('modal-solicitar-mp');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('solicitar-mp-select-ref') && 
      (document.getElementById('solicitar-mp-select-ref').value = selectEl ? selectEl.id || '' : '');
    return;
  }
}

async function enviarSolicitudMP() {
  const nombre    = document.getElementById('solicitar-mp-nombre').value.trim();
  const esNueva   = document.getElementById('solicitar-mp-nueva').checked;
  const tmpNombre = document.getElementById('solicitar-mp-tmp').value.trim() || nombre;
  const gramos    = document.getElementById('solicitar-mp-gramos').value;

  if (!nombre) { toast('Escribe el nombre de la MP', 'error'); return; }

  // Enviar solicitud al Sheet
  const areaNombre = App.area?.nombre || (App.areaCodigo ? FEN.AREAS[App.areaCodigo]?.nombre : '') || '';
  escribirEnSheet('solicitar_mp', {
    nombre,
    es_nueva: esNueva,
    solicitada_por: areaNombre,
    area_codigo: App.areaCodigo || '',
    categoría: 'Pendiente de clasificar',
    fecha: new Date().toISOString()
  });

  // Agregar ingrediente temporal al formulario (en amarillo)
  if (tmpNombre) {
    const tbody = document.getElementById('tbody-ingr');
    const tr = document.createElement('tr');
    tr.style.background = '#FFF9C4';
    tr.innerHTML = `
      <td>
        <select disabled style="color:#F57C00;font-weight:500">
          <option>⏳ ${tmpNombre} (pendiente habilitación)</option>
        </select>
      </td>
      <td><input type="number" placeholder="0" value="${gramos || ''}" min="0" step="0.01"></td>
      ${App.areaCodigo === 'PAN' ? '<td><input type="number" placeholder="0.00" readonly style="color:var(--txt3)"></td>' : ''}
      <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
    `;
    tbody.appendChild(tr);
  }

  cerrarModalSolicitarMP();
  toast('Solicitud enviada a administración');
}

function cerrarModalSolicitarMP() {
  const modal = document.getElementById('modal-solicitar-mp');
  if (modal) modal.classList.add('hidden');
  // Resetear select que activó el modal
  const selects = document.querySelectorAll('#tbody-ingr select');
  selects.forEach(s => { if (s.value === '__nueva__') s.value = ''; });
}

function editarMP(mpId) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;
  const nuevoPrecio = prompt(
    `Precio neto de "${mp.nombre}"\nActual: ${clp(mp.costo_neto)}\n\nNuevo precio neto:`,
    mp.costo_neto
  );
  if (nuevoPrecio === null) return;
  const precio = parseFloat(nuevoPrecio);
  if (isNaN(precio)) { toast('Precio inválido', 'error'); return; }
  escribirEnSheet('editar_mp', { ID_MP: mpId, costo_neto: precio });
  mp.costo_neto = precio;
  toast('Precio actualizado');
  Cache.invalidar('mp_maestro');
  renderVistaMP();
}

function abrirFormNuevaMP() {
  solicitarNuevaMP();
}

function gestionarAreasMP(mpId) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;
  const areas = ['PAN','BOL','PAS','CAF'];
  const actuales = (mp.areas_habilitadas || '').split(',').map(a => a.trim()).filter(Boolean);
  const nuevas = [];
  areas.forEach(a => {
    if (confirm(`¿Habilitar ${mp.nombre} para ${FEN.AREAS[a]?.nombre || a}?
(Actualmente: ${actuales.includes(a) ? '✓ Habilitada' : '✗ No habilitada'})`)) {
      nuevas.push(a);
    }
  });
  const val = nuevas.join(',');
  escribirEnSheet('editar_mp', { ID_MP: mpId, areas_habilitadas: val });
  mp.areas_habilitadas = val;
  Cache.invalidar('mp_maestro');
  toast('Áreas actualizadas');
  renderVistaMP();
}

async function toggleEstadoMP(mpId, estadoActual) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;
  const nuevoEstado = estadoActual === 'inactiva' ? 'activa' : 'inactiva';
  const accion = nuevoEstado === 'inactiva' ? 'desactivar' : 'activar';
  if (!confirm(`¿${accion.charAt(0).toUpperCase() + accion.slice(1)} "${mp.nombre}"?`)) return;
  await escribirEnSheet('editar_mp', { ID_MP: mpId, estado: nuevoEstado });
  mp.estado = nuevoEstado;
  Cache.invalidar('mp_maestro');
  toast(`MP ${accion === 'desactivar' ? 'desactivada' : 'activada'}`);
  renderVistaMP();
}

// ── UTILIDADES ────────────────────────────────────────────────
function generarId(areaCodigo) {
  const existing = App.recetas.filter(r => r.ID_receta?.startsWith(areaCodigo));
  return `${areaCodigo}${String(existing.length + 1).padStart(3,'0')}`;
}

function obtenerSemanaActual() {
  // ISO 8601 week number — robusto con zona horaria
  // Usa fecha local del dispositivo (no UTC) para evitar cambios de semana a medianoche
  const now = new Date();
  // Ajustar al jueves de la misma semana ISO (semana empieza en lunes)
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNum = d.getDay() || 7; // 1=Lun, 7=Dom
  d.setDate(d.getDate() + 4 - dayNum); // jueves de esta semana
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`;
}

function mostrarLoading(msg = 'Cargando...') {
  const l = document.getElementById('loading-overlay');
  if (l) { l.querySelector('span').textContent = msg; l.classList.remove('hidden'); }
}

function ocultarLoading() {
  const l = document.getElementById('loading-overlay');
  if (l) l.classList.add('hidden');
}

// ── BOTONES CON ESTADO ───────────────────────────────────────
function bloquearBtn(btn, texto) {
  if (!btn) return;
  btn.disabled = true;
  btn.dataset.originalHtml = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:#fff;margin-right:6px;display:inline-block;vertical-align:middle"></span>' + texto;
  btn.style.opacity = '0.75';
}

function desbloquearBtn(btn, htmlOriginal, exito) {
  if (!btn) return;
  setTimeout(() => {
    btn.disabled = false;
    btn.style.opacity = '';
    if (exito) {
      btn.innerHTML = '<i class="ti ti-check"></i> Guardado';
      btn.style.background = '#2E7D32';
      setTimeout(() => {
        btn.innerHTML = htmlOriginal || btn.dataset.originalHtml || 'Guardar';
        btn.style.background = '';
      }, 2200);
    } else {
      btn.innerHTML = htmlOriginal || btn.dataset.originalHtml || 'Guardar';
    }
  }, 400);
}

function toast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
