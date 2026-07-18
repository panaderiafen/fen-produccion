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
    cargarPlanMasasBOL();
    cargarPlanB2CB2BBOL();
    cargarEstadoTareasBOL(diaIdx);
  }
  if (areaCodigo === 'CAF') {
    cargarBaristasCaf(); // Load baristas from Sheet on entry
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
  // Save to Sheet — aviso marked as read permanently
  const payload = encodeURIComponent(JSON.stringify({
    accion: 'marcar_aviso_leido', aviso_id: id
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload).catch(() => {});
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
    await cargarPlanB2CB2BBOL();
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
      { id: 'recetas-del-dia', icon: 'ti-flame', label: 'Recetas del día' },
      { id: 'maestro',         icon: 'ti-book',  label: 'Maestro de recetas' },
    ];
    if (App.areaCodigo === 'CAF') items.splice(2, 2);
    // BOL: rename recetas-del-dia and add pre-elaboraciones
    if (App.areaCodigo === 'BOL') {
      const rdIdx = items.findIndex(i => i.id === 'recetas-del-dia');
      if (rdIdx >= 0) items[rdIdx] = { id: 'recetas-del-dia', icon: 'ti-flame', label: 'Plan de horneado del día' };
      items.splice(3, 0, { id: 'pre-elaboraciones', icon: 'ti-clock-play', label: 'Pre-elaboraciones y tareas' });
    }
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL') {
      items.push({ id: 'resumen-semanal',     icon: 'ti-chart-grid-dots', label: 'Resumen semanal' });
      items.push({ id: 'consolidado-mensual', icon: 'ti-calendar-stats',  label: 'Consolidado mensual' });
    }

    if (App.areaCodigo === 'CAF') {
      items.push({ id: 'registros-caf', icon: 'ti-clipboard-list', label: 'Registros de turno' });
    }
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL' || App.areaCodigo === 'CAF') {
      items.push({ id: 'config-subrecetas',   icon: 'ti-adjustments',     label: App.areaCodigo === 'CAF' ? 'Configuración' : 'Config sub recetas' });
    }
    items.forEach(item => nav.appendChild(crearNavItem(item)));
  } else {
    [
      { id: 'aprobaciones',   icon: 'ti-check-circle',         label: 'Aprobaciones'         },
      { id: 'materias-primas',icon: 'ti-list',                  label: 'Materias primas'     },
      { id: 'maestro-admin',  icon: 'ti-book',                  label: 'Maestro de recetas'  },
      { id: 'costos',         icon: 'ti-chart-bar',             label: 'Estructuras de costo'},
      { id: 'estimacion-bol', icon: 'ti-chart-arrows-vertical', label: 'Estimación BOL'      },
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
    case 'planificacion':
      (async () => {
        await cargarPlanSemana();
        if (App.areaCodigo === 'BOL') await cargarPlanB2CB2BBOL();
        renderVistaPlanificacion();
      })();
      break;
    case 'recetas-del-dia': renderVistaRecetasDelDia(); cargarAvisos(); break;
    case 'maestro':         renderVistaMaestro(); break;
    case 'aprobaciones':    renderVistaAprobaciones(); break;
    case 'materias-primas': renderVistaMP(); break;
    case 'maestro-admin':   renderVistaMaestroAdmin(); break;
    case 'costos':              renderVistaCostos(); break;
    case 'config-subrecetas':   renderVistaConfigSubrecetas(); break;
    case 'resumen-semanal':     renderVistaResumenSemanal(); break;
    case 'consolidado-mensual': renderVistaConsolidado();    break;
    case 'registros-caf':       renderVistaRegistrosCAF();    break;
    case 'pre-elaboraciones':   renderVistaPreElaboraciones(); break;
    case 'estimacion-bol':      renderVistaEstimacionBOL();  break;
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
        <button class="btn-primario" onclick="guardarReceta('${recetaId || ''}',this)">
          <i class="ti ti-device-floppy"></i> ${esEdicion ? 'Guardar cambios' : 'Crear receta'}
        </button>
      </div>
    </div>
  `;

  if (ingredientes.length > 0) ingredientes.forEach(ing => {
    if (ing.pendiente || ing.id === '__pendiente__') {
      agregarIngredienteTemporal(ing);
    } else {
      agregarIngrediente(ing);
    }
  });
  else { agregarIngrediente(); agregarIngrediente(); agregarIngrediente(); }

  if (pasos.length > 0) pasos.forEach(p => agregarPaso(typeof p === 'string' ? p : ''));
  else { agregarPaso(); agregarPaso(); }

  mostrarVista('form-receta');
}

// ── INGREDIENTES ──────────────────────────────────────────────
function agregarIngredienteTemporal(data) {
  const tbody = document.getElementById('tbody-ingr');
  const tr = document.createElement('tr');
  const unidad = data.unidad_receta || 'gramos';
  const cantidad = unidad === 'unidades' ? (data.unidades || data.gramos || '')
                 : unidad === 'ml' ? (data.ml || data.gramos || '')
                 : (data.gramos || '');

  // Check if this MP has been assigned/approved — using persistent Sheet field, NOT guessing
  const mpId = data.id || '__pendiente__';
  const mpActual = App.materiasPrimas.find(m => m.ID_MP === mpId);
  let nombreAsignado = null;
  let idAsignado = null;

  // Case 1: MP was approved directly (estado changed to activa) — same MP now usable
  const mpAprobada = mpActual && mpActual.estado === 'activa';

  // Case 2: MP was replaced by a specific existing MP — read the exact assignment
  if (mpActual && mpActual.estado === 'reemplazada' && mpActual.reemplazada_por) {
    const mpFound = App.materiasPrimas.find(m => m.ID_MP === mpActual.reemplazada_por);
    if (mpFound) { idAsignado = mpFound.ID_MP; nombreAsignado = mpFound.nombre; }
  }

  const bgColor = idAsignado || mpAprobada ? '#E8F5E9' : '#FFF9C4';
  const textColor = idAsignado || mpAprobada ? '#2E7D32' : '#F57C00';
  const icono = idAsignado || mpAprobada ? '✓' : '⏳';

  let labelText = `${icono} ${data.nombre}`;
  if (idAsignado) labelText += ` → reemplazar por: ${nombreAsignado}`;
  else if (mpAprobada) labelText += ` (aprobada — ya disponible)`;
  else labelText += ` (pendiente habilitación)`;

  tr.style.background = bgColor;
  tr.innerHTML = `
    <td style="min-width:200px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <select disabled style="color:${textColor};font-weight:500;flex:1" data-mp-id="${mpId}" data-nombre-tmp="${data.nombre}">
          <option>${labelText}</option>
        </select>
        ${(idAsignado || mpAprobada) ? `
        <button onclick="reemplazarIngredienteTemporal(this,'${idAsignado || mpId}','${(nombreAsignado || data.nombre).replace(/'/g,"\'")}','${mpId}')"
          style="background:#2E7D32;color:#fff;border:none;padding:4px 10px;border-radius:var(--r-sm);font-size:12px;cursor:pointer;white-space:nowrap">
          <i class="ti ti-replace"></i> Reemplazar
        </button>` : ''}
      </div>
    </td>
    <td><input type="number" placeholder="0" value="${cantidad || ''}" min="0" step="0.01" data-unidad="${unidad}"></td>
    ${App.areaCodigo === 'PAN' ? '<td><input type="number" placeholder="0.00" readonly style="color:var(--txt3)"></td>' : ''}
    <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(tr);
}

async function reemplazarIngredienteTemporal(btn, mpIdNuevo, nombreNuevo, mpIdViejo) {
  const tr = btn.closest('tr');
  const inputs = tr.querySelectorAll('input[type="number"]');
  const cantidad = parseFloat(inputs[0]?.value) || 0;
  const unidad   = inputs[0]?.dataset?.unidad || 'gramos';

  // Replace entire row with normal ingredient
  tr.remove();

  // Add as normal ingredient
  const data = {
    id: mpIdNuevo,
    nombre: nombreNuevo,
    gramos: unidad === 'gramos' ? cantidad : 0,
    unidades: unidad === 'unidades' ? cantidad : null,
    unidad_receta: unidad,
    pendiente: false
  };
  agregarIngrediente(data);

  // Guardar la receta automáticamente para no perder el reemplazo
  await guardarReceta(App._recetaEditandoId || '');
  toast(`Reemplazado por ${nombreNuevo} y receta guardada`);
}


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
  // También considerar unidad_receta explícita (para MPs solicitadas con unidad específica)
  const usaUnidades = (esBOL && esSubRecetaIngr && (data.unidades !== undefined ? data.unidades : true))
    || (data.unidad_receta === 'unidades');
  const usaMl = data.unidad_receta === 'ml';

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
      value="${usaUnidades ? (data.unidades||'') : usaMl ? (data.ml||data.gramos||'') : (data.gramos ? parseFloat(data.gramos).toFixed(1) : '')}"
      min="0" step="${usaUnidades?'1':'0.01'}"
      oninput="${esPan ? 'desdeGramos(this)' : ''}"
      style="max-width:90px"
      data-modo="${usaUnidades ? 'unidades' : usaMl ? 'ml' : 'gramos'}"
      data-unidad="${data.unidad_receta || (usaUnidades ? 'unidades' : 'gramos')}">
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
async function guardarReceta(recetaId, btn) {
  const esEdicion = !!recetaId;
  const nombre    = document.getElementById('f-nombre').value.trim();
  const porciones = document.getElementById('f-porciones').value;
  if (!nombre)   { toast('El nombre es requerido', 'error'); return; }
  if (!porciones){ toast('El rendimiento es requerido', 'error'); return; }

  const ingredientes = [];
  document.querySelectorAll('#tbody-ingr tr').forEach(tr => {
    const select = tr.querySelector('select');
    const inputs = tr.querySelectorAll('input[type="number"]');

    // Handle temporary (pending) ingredients
    if (select?.disabled && select.options[0]?.text.includes('pendiente')) {
      const nombre = select.options[0].text.replace('⏳ ', '').replace(' (pendiente habilitación)', '').trim();
      const cantidad = parseFloat(inputs[0]?.value) || 0;
      const unidad = inputs[0]?.dataset?.unidad || 'gramos';
      const mpId = select.dataset?.mpId || '__pendiente__';
      ingredientes.push({
        id: mpId,
        nombre,
        gramos: unidad === 'gramos' ? cantidad : 0,
        unidades: unidad === 'unidades' ? cantidad : null,
        ml: unidad === 'ml' ? cantidad : null,
        unidad_receta: unidad,
        pct: 0,
        costo: 0,
        pendiente: true
      });
      return;
    }

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

  // Enviar al Sheet via GET para que el email también se dispare
  const payloadRevision = encodeURIComponent(JSON.stringify({
    accion: 'cambiar_estado',
    ID_receta: recetaId,
    estado: 'pendiente_aprobación',
    hoja: App.area.hoja_recetas,
    area_codigo: App.areaCodigo
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadRevision, { redirect: 'follow' }).catch(e => console.warn('Error:', e));

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
  const diasCorto = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const hoy  = new Date().getDay();
  const diaIdx = hoy === 0 ? 6 : hoy - 1;
  const semana = obtenerSemanaActual();
  const esBOL = App.areaCodigo === 'BOL';

  const vista = document.getElementById('vista-planificacion');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre} · Semana ${semana}</div>
        <h1 class="vista-titulo">Plan semanal</h1>
      </div>
      <div style="display:flex;gap:8px">
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
      El plan se guarda por semana. Puedes modificarlo en cualquier momento.
      ${esBOL ? 'Para BOL: ingresa la meta por canal (B2C vitrina + B2B pedidos).' : ''}
    </p>

    ${!recetasConsolidadas.length ? `
      <div class="empty-state">
        <i class="ti ti-calendar-off"></i>
        <h2>Sin recetas consolidadas</h2>
        <p>Solo puedes planificar recetas aprobadas en el maestro.</p>
      </div>` : esBOL ? `
      <!-- BOL: tabla con B2C/B2B por día -->
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:700px">
          <thead>
            <tr style="background:var(--bg)">
              <th style="text-align:left;padding:8px 14px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:2px solid var(--border);min-width:140px">Producto</th>
              ${diasCorto.map((d,i) => `
                <th colspan="3" style="text-align:center;padding:6px 4px;font-size:11px;font-weight:700;color:${i===diaIdx?'var(--area-color)':'var(--txt2)'};border-bottom:2px solid var(--border);border-left:2px solid var(--border)">
                  ${i===diaIdx?'▶ ':''} ${d}
                </th>`).join('')}
              <th style="text-align:right;padding:8px 14px;font-size:10px;font-weight:700;color:var(--txt3);border-bottom:2px solid var(--border);border-left:2px solid var(--border)">Total</th>
            </tr>
            <tr style="background:var(--bg)">
              <th style="border-bottom:1px solid var(--border)"></th>
              ${diasCorto.map(() => `
                <th style="text-align:center;padding:4px 3px;font-size:9px;color:#1565C0;font-weight:600;border-bottom:1px solid var(--border);border-left:2px solid var(--border)">B2C</th>
                <th style="text-align:center;padding:4px 3px;font-size:9px;color:#E65100;font-weight:600;border-bottom:1px solid var(--border)">B2B</th>
                <th style="text-align:center;padding:4px 3px;font-size:9px;color:var(--txt3);font-weight:600;border-bottom:1px solid var(--border)">Tot</th>`).join('')}
              <th style="border-bottom:1px solid var(--border);border-left:2px solid var(--border)"></th>
            </tr>
          </thead>
          <tbody>
            ${recetasConsolidadas.map(r => {
              const semana2 = semana;
              const claveBOL = `fen_bol_plan_${semana2}_${r.ID_receta}`;
              // Always read from localStorage (populated from Sheet by cargarPlanB2CB2BBOL)
              const planBOL = (() => { try { return JSON.parse(localStorage.getItem(claveBOL)||'null'); } catch(e) { return null; } })();
              // Fallback: if no B2C/B2B split, try to use App.planSemana totals as B2B
              const totales = App.planSemana[r.ID_receta] || Array(7).fill(0);
              const b2c = planBOL?.b2c || Array(7).fill(0);
              const b2b = planBOL?.b2b || (planBOL ? Array(7).fill(0) : totales);
              const totalSem = b2c.reduce((s,v)=>s+v,0) + b2b.reduce((s,v)=>s+v,0);
              return `<tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 14px;font-weight:600;font-size:13px">${r.nombre}</td>
                ${Array(7).fill(0).map((_,i) => `
                  <td style="padding:3px 2px;border-left:2px solid var(--border)">
                    <input type="number" min="0" placeholder="0" value="${b2c[i]||''}"
                      style="width:44px;text-align:center;padding:3px 2px;border:1px solid #90CAF9;border-radius:4px;font-size:12px;font-family:'DM Mono',monospace;color:#1565C0"
                      oninput="actualizarPlanBOL('${r.ID_receta}',${i},'b2c',this.value,'${semana2}')">
                  </td>
                  <td style="padding:3px 2px">
                    <input type="number" min="0" placeholder="0" value="${b2b[i]||''}"
                      style="width:44px;text-align:center;padding:3px 2px;border:1px solid #FFCC80;border-radius:4px;font-size:12px;font-family:'DM Mono',monospace;color:#E65100"
                      oninput="actualizarPlanBOL('${r.ID_receta}',${i},'b2b',this.value,'${semana2}')">
                  </td>
                  <td style="padding:3px 4px;text-align:center;font-family:'DM Mono',monospace;font-size:12px;font-weight:600;color:var(--txt2)" id="plan-tot-${r.ID_receta}-${i}">
                    ${(b2c[i]||0)+(b2b[i]||0)||''}
                  </td>`).join('')}
                <td style="padding:8px 14px;text-align:right;font-family:'DM Mono',monospace;font-weight:700;font-size:14px;color:var(--area-color);border-left:2px solid var(--border)" id="plan-sem-${r.ID_receta}">
                  ${totalSem||0}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : `
      <!-- PAN/PAS/CAF: tabla estándar -->
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
            ${recetasConsolidadas.map(r => {
              const cantidades = App.planSemana[r.ID_receta] || Array(7).fill(0);
              const total = cantidades.reduce((s,c)=>s+c,0);
              return `<tr>
                <td class="td-nombre">${r.nombre}</td>
                ${dias.map((_,i) => `
                  <td class="${i===diaIdx?'dia-hoy':''}">
                    <input type="number" min="0" placeholder="0"
                      data-receta="${r.ID_receta}" data-dia="${i}"
                      oninput="actualizarTotalFila(this)"
                      value="${cantidades[i] || ''}">
                  </td>`).join('')}
                <td class="td-total" id="total-${r.ID_receta}">${total}</td>
              </tr>`;
            }).join('')}
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

function actualizarPlanBOL(recetaId, diaIdx, canal, valor, semana) {
  const clave = `fen_bol_plan_${semana}_${recetaId}`;
  const plan = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })()
    || { b2c: Array(7).fill(0), b2b: Array(7).fill(0) };
  plan[canal][diaIdx] = parseInt(valor) || 0;
  localStorage.setItem(clave, JSON.stringify(plan));

  // Update App.planSemana with total for compatibility
  if (!App.planSemana[recetaId]) App.planSemana[recetaId] = Array(7).fill(0);
  App.planSemana[recetaId][diaIdx] = (plan.b2c[diaIdx]||0) + (plan.b2b[diaIdx]||0);

  // Update total cell
  const totCell = document.getElementById(`plan-tot-${recetaId}-${diaIdx}`);
  const tot = (plan.b2c[diaIdx]||0) + (plan.b2b[diaIdx]||0);
  if (totCell) totCell.textContent = tot || '';

  // Update weekly total
  const semCell = document.getElementById(`plan-sem-${recetaId}`);
  const semTot = plan.b2c.reduce((s,v)=>s+v,0) + plan.b2b.reduce((s,v)=>s+v,0);
  if (semCell) semCell.textContent = semTot || 0;
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
  const semana = obtenerSemanaActual();

  // BOL: save B2C/B2B plan separately + compute totals for App.planSemana
  if (App.areaCodigo === 'BOL') {
    const recetas = App.recetas.filter(r => r.estado === 'consolidada' && r.tipo_receta !== 'sub_receta');
    const plan = {};
    recetas.forEach(r => {
      const clave = `fen_bol_plan_${semana}_${r.ID_receta}`;
      const planR = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })()
        || { b2c: Array(7).fill(0), b2b: Array(7).fill(0) };
      // Total per day = b2c + b2b
      plan[r.ID_receta] = Array(7).fill(0).map((_,i) => (planR.b2c[i]||0) + (planR.b2b[i]||0));
    });
    App.planSemana = plan;
    guardarPlanLocal(plan);
    // Save totals to BOL_planificacion
    try {
      await escribirEnSheet('guardar_planificacion', {
        hoja: FEN.AREAS['BOL'].hoja_plan,
        semana,
        plan
      });
    } catch(e) {}

    // Save B2C/B2B detail to BOL_plan_b2cb2b
    const filasBOL = [];
    recetas.forEach(r => {
      const clave = `fen_bol_plan_${semana}_${r.ID_receta}`;
      const planR = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })()
        || { b2c: Array(7).fill(0), b2b: Array(7).fill(0) };
      filasBOL.push({ semana_ID: semana, ID_receta: r.ID_receta, nombre_receta: r.nombre, canal: 'b2c', dias: planR.b2c });
      filasBOL.push({ semana_ID: semana, ID_receta: r.ID_receta, nombre_receta: r.nombre, canal: 'b2b', dias: planR.b2b });
    });
    const payloadB2B = encodeURIComponent(JSON.stringify({
      accion: 'guardar_plan_b2cb2b_bol', filas: filasBOL
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadB2B).catch(() => {});
    toast('Plan guardado correctamente');
    desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan', true);
    return;
  }

  // PAN/PAS/CAF: standard save
  const inputs = document.querySelectorAll('#vista-planificacion input[data-receta]');
  const plan = {};
  inputs.forEach(el => {
    const rid = el.dataset.receta;
    const dia = parseInt(el.dataset.dia);
    if (!plan[rid]) plan[rid] = Array(7).fill(0);
    plan[rid][dia] = parseInt(el.value) || 0;
  });
  App.planSemana = plan;
  guardarPlanLocal(plan);
  try {
    await escribirEnSheet('guardar_planificacion', {
      hoja:   FEN.AREAS[App.areaCodigo].hoja_plan,
      semana,
      plan
    });
    desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan', true);
    toast('Plan guardado correctamente');
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan', false);
    toast('Guardado local OK (Sheet no disponible)');
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

// ── CAF: REGISTROS DE TURNO ──────────────────────────────────
let _cafBaristas = [];
let _cafRegistros = [];

async function renderVistaRegistrosCAF() {
  const vista = document.getElementById('vista-registros-caf');
  if (!vista) return;
  mostrarVista('registros-caf');

  // Load baristas and registros
  await Promise.all([cargarBaristasCaf(), cargarRegistrosCAF()]);

  const cfg = cargarConfigSubrecetas();
  const gramosDef = cfg.caf?.gramos_por_shot || 14;

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">Cafetería</div>
        <h1 class="vista-titulo">Registros de turno</h1>
      </div>
      <button class="btn-primario" onclick="abrirModalRegistroCaf()">
        <i class="ti ti-plus"></i> Nuevo registro
      </button>
    </div>

    <!-- FILTROS -->
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <select id="filtro-caf-periodo" onchange="renderTablaRegistrosCAF()"
        style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit">
        <option value="hoy">Hoy</option>
        <option value="semana">Esta semana</option>
        <option value="mes">Este mes</option>
        <option value="todos">Todos</option>
      </select>
      <select id="filtro-caf-barista" onchange="renderTablaRegistrosCAF()"
        style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit">
        <option value="">Todos los baristas</option>
        ${_cafBaristas.map(b => `<option value="${b}">${b}</option>`).join('')}
      </select>
      <select id="filtro-caf-tipo" onchange="renderTablaRegistrosCAF()"
        style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit">
        <option value="">Todos los tipos</option>
        <option value="calibracion">Calibración</option>
        <option value="merma">Merma</option>
        <option value="prueba_receta">Prueba de receta</option>
      </select>
    </div>

    <!-- RESUMEN -->
    <div id="resumen-caf" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px"></div>

    <!-- TABLA -->
    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Registros</div>
      <div id="tabla-registros-caf" style="overflow-x:auto"></div>
    </div>
  `;

  renderTablaRegistrosCAF();
}

function renderTablaRegistrosCAF() {
  const periodo  = document.getElementById('filtro-caf-periodo')?.value || 'hoy';
  const barista  = document.getElementById('filtro-caf-barista')?.value || '';
  const tipo     = document.getElementById('filtro-caf-tipo')?.value || '';

  const hoy = new Date();
  const off = hoy.getTimezoneOffset() * 60000;
  const fechaHoy = new Date(hoy - off).toISOString().slice(0,10);
  const lunesSemana = (() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - (d.getDay()===0?6:d.getDay()-1));
    return new Date(d - off).toISOString().slice(0,10);
  })();
  const primerMes = fechaHoy.slice(0,7) + '-01';

  let filtrados = _cafRegistros.filter(r => {
    if (barista && r.barista !== barista) return false;
    if (tipo && r.tipo !== tipo) return false;
    if (periodo === 'hoy' && r.fecha !== fechaHoy) return false;
    if (periodo === 'semana' && r.fecha < lunesSemana) return false;
    if (periodo === 'mes' && r.fecha < primerMes) return false;
    return true;
  }).sort((a,b) => b.fecha.localeCompare(a.fecha) || b.hora?.localeCompare(a.hora||''));

  // Resumen
  const totales = { calibracion: 0, merma: 0, prueba_receta: 0 };
  filtrados.forEach(r => { totales[r.tipo] = (totales[r.tipo]||0) + (parseFloat(r.gramos)||0); });
  const totalGr = Object.values(totales).reduce((s,v)=>s+v,0);

  const colores = { calibracion: '#6A1B9A', merma: '#C62828', prueba_receta: '#1565C0' };
  const nombres = { calibracion: 'Calibración', merma: 'Merma', prueba_receta: 'Prueba receta' };
  const iconos  = { calibracion: '☕', merma: '🗑️', prueba_receta: '🧪' };

  const resumenEl = document.getElementById('resumen-caf');
  if (resumenEl) {
    resumenEl.innerHTML = Object.entries(totales).map(([t, gr]) => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px;min-width:130px">
        <div style="font-size:11px;color:var(--txt3)">${iconos[t]} ${nombres[t]}</div>
        <div style="font-size:20px;font-weight:700;color:${colores[t]};font-family:'DM Mono',monospace">${gr.toFixed(1)}g</div>
      </div>`).join('') +
      `<div style="background:var(--surface);border:2px solid var(--area-color);border-radius:var(--r-md);padding:10px 16px;min-width:130px">
        <div style="font-size:11px;color:var(--txt3)">☕ Total café</div>
        <div style="font-size:20px;font-weight:700;color:var(--area-color);font-family:'DM Mono',monospace">${totalGr.toFixed(1)}g</div>
      </div>`;
  }

  const tablaEl = document.getElementById('tabla-registros-caf');
  if (!tablaEl) return;

  if (!filtrados.length) {
    tablaEl.innerHTML = '<p style="padding:20px;color:var(--txt3);font-size:13px;text-align:center">Sin registros para los filtros seleccionados.</p>';
    return;
  }

  tablaEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px">
      <thead>
        <tr style="background:var(--bg)">
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Fecha</th>
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Barista</th>
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Turno</th>
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Tipo</th>
          <th style="text-align:center;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Shots</th>
          <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Gramos</th>
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3);border-bottom:1px solid var(--border)">Nota</th>
        </tr>
      </thead>
      <tbody>
        ${filtrados.map(r => `
          <tr style="border-bottom:1px solid var(--border)">
            <td style="padding:8px 16px;color:var(--txt2)">${r.fecha} ${r.hora||''}</td>
            <td style="padding:8px 16px;font-weight:500">${r.barista}</td>
            <td style="padding:8px 16px;color:var(--txt2)">${r.turno}</td>
            <td style="padding:8px 16px">
              <span style="font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;
                background:${r.tipo==='calibracion'?'#F3E5F5':r.tipo==='merma'?'#FFEBEE':'#E3F2FD'};
                color:${colores[r.tipo]||'var(--txt2)'}">
                ${nombres[r.tipo]||r.tipo}
              </span>
            </td>
            <td style="text-align:center;padding:8px 16px;font-family:'DM Mono',monospace">${r.shots||'—'}</td>
            <td style="text-align:right;padding:8px 16px;font-family:'DM Mono',monospace;font-weight:600">${parseFloat(r.gramos).toFixed(1)}g</td>
            <td style="padding:8px 16px;color:var(--txt2);font-size:12px">${r.nota||''}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

async function cargarBaristasCaf() {
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_baristas_caf' }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && data.baristas) _cafBaristas = data.baristas;
  } catch(e) {
    const cfg = cargarConfigSubrecetas();
    _cafBaristas = cfg.caf?.baristas || [];
  }
}

async function cargarRegistrosCAF() {
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_registros_caf' }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok) _cafRegistros = data.registros || [];
  } catch(e) {
    _cafRegistros = [];
  }
}

function abrirModalRegistroCaf() {
  const cfg = cargarConfigSubrecetas();
  const gramosDef = cfg.caf?.gramos_por_shot || 14;
  const modal = document.getElementById('modal-registro-caf');
  if (!modal) return;
  // Reset form
  const baristaSelect = document.getElementById('rcaf-barista');
  baristaSelect.innerHTML = _cafBaristas.map(b => `<option value="${b}">${b}</option>`).join('') || '<option value="">Sin baristas configurados</option>';
  baristaSelect.value = _cafBaristas[0] || '';
  document.getElementById('rcaf-turno').value = 'Mañana';
  document.getElementById('rcaf-tipo').value = 'calibracion';
  document.getElementById('rcaf-shots').value = '1';
  document.getElementById('rcaf-gramos').value = gramosDef;
  document.getElementById('rcaf-nota').value = '';
  document.getElementById('rcaf-shots-row').style.display = '';
  document.getElementById('rcaf-total-gr').textContent = gramosDef + 'g';
  modal.classList.remove('hidden');
}

function actualizarTotalGrCaf() {
  const shots  = parseInt(document.getElementById('rcaf-shots')?.value) || 1;
  const gramos = parseFloat(document.getElementById('rcaf-gramos')?.value) || 0;
  const tipo   = document.getElementById('rcaf-tipo')?.value;
  const shotsRow = document.getElementById('rcaf-shots-row');
  if (shotsRow) shotsRow.style.display = tipo === 'calibracion' ? '' : 'none';
  const total = tipo === 'calibracion' ? shots * gramos : gramos;
  const span = document.getElementById('rcaf-total-gr');
  if (span) span.textContent = total.toFixed(1) + 'g';
}

async function guardarRegistroCaf(btn) {
  bloquearBtn(btn, 'Guardando...');
  const cfg = cargarConfigSubrecetas();
  const barista = document.getElementById('rcaf-barista').value;
  const turno   = document.getElementById('rcaf-turno').value;
  const tipo    = document.getElementById('rcaf-tipo').value;
  const shots   = parseInt(document.getElementById('rcaf-shots').value) || 1;
  const gramos  = parseFloat(document.getElementById('rcaf-gramos').value) || 0;
  const nota    = document.getElementById('rcaf-nota').value.trim();
  const totalGr = tipo === 'calibracion' ? shots * gramos : gramos;

  const hoy = new Date();
  const off = hoy.getTimezoneOffset() * 60000;
  const fecha = new Date(hoy - off).toISOString().slice(0,10);
  const hora  = hoy.toLocaleTimeString('es-CL', {hour:'2-digit',minute:'2-digit'});

  const registro = { fecha, hora, barista, turno, tipo, shots: tipo==='calibracion'?shots:null, gramos: totalGr, nota };

  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'guardar_registro_caf', registro }));
    await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    _cafRegistros.unshift(registro);
    document.getElementById('modal-registro-caf').classList.add('hidden');
    renderTablaRegistrosCAF();
    toast('Registro guardado');
  } catch(e) {
    toast('Error al guardar', 'error');
  }
  desbloquearBtn(btn, '<i class="ti ti-check"></i> Guardar', true);
}

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

async function cargarPlanB2CB2BBOL() {
  const semana = obtenerSemanaActual();
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'leer_plan_b2cb2b_bol', semana_ID: semana
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && data.filas?.length) {
      const dias = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

      // Build plan objects directly from Sheet data
      const planPorReceta = {};
      data.filas.forEach(f => {
        if (!planPorReceta[f.ID_receta]) {
          planPorReceta[f.ID_receta] = { b2c: Array(7).fill(0), b2b: Array(7).fill(0) };
        }
        const canal = f.canal;
        if (canal === 'b2c' || canal === 'b2b') {
          planPorReceta[f.ID_receta][canal] = dias.map(d => parseFloat(f[d]) || 0);
        }
      });

      // Save to localStorage and update App.planSemana
      Object.entries(planPorReceta).forEach(([rid, plan]) => {
        const clave = `fen_bol_plan_${semana}_${rid}`;
        localStorage.setItem(clave, JSON.stringify(plan));
        // Update App.planSemana with totals
        App.planSemana[rid] = Array(7).fill(0).map((_,i) => (plan.b2c[i]||0) + (plan.b2b[i]||0));
      });
    }
  } catch(e) {
    console.warn('[fën] No se pudo cargar plan B2C/B2B:', e.message);
  }
}

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

// ── BOL: ESTIMACIÓN DEMANDA ──────────────────────────────────
// Promedios B2B históricos (dic 2025 – jul 2026, 7 meses)
const BOL_ESTIMACION_B2B = {
  'Croissant clásico': { Lun:71.6, Mar:104.7, Mié:86.6, Jue:66.2, Vie:76.4, Sáb:58.1, Dom:0 },
  'Croissant mini':    { Lun:10.7, Mar:6.5,   Mié:12.9, Jue:2.6,  Vie:12.0, Sáb:0,    Dom:0 },
  'Pan de chocolate':  { Lun:0.9,  Mar:2.4,   Mié:1.6,  Jue:1.1,  Vie:0.6,  Sáb:1.6,  Dom:0 },
  'Pañuelo':           { Lun:0,    Mar:2.4,   Mié:0,    Jue:0,    Vie:3.3,  Sáb:0,    Dom:0 },
  'Palmeritas':        { Lun:0.7,  Mar:1.1,   Mié:1.3,  Jue:0,    Vie:0.6,  Sáb:0,    Dom:0 },
};

// Promedios B2C históricos (jun 2025 – jun 2026, 1 año de datos reales)
const BOL_ESTIMACION_B2C = {
  'Croissant clásico': { Lun:6.4,  Mar:7.1,  Mié:5.7,  Jue:5.9,  Vie:8.1,  Sáb:6.4,  Dom:3.0 },
  'Pan de chocolate':  { Lun:4.8,  Mar:3.6,  Mié:3.6,  Jue:5.1,  Vie:5.2,  Sáb:3.7,  Dom:1.9 },
  'Croissant relleno': { Lun:0.9,  Mar:1.8,  Mié:1.8,  Jue:3.0,  Vie:2.1,  Sáb:1.4,  Dom:0.4 },
  'Pañuelo':           { Lun:1.3,  Mar:1.8,  Mié:1.9,  Jue:2.0,  Vie:1.9,  Sáb:1.3,  Dom:0.6 },
  'Palmeritas':        { Lun:1.9,  Mar:2.6,  Mié:2.0,  Jue:2.4,  Vie:3.5,  Sáb:2.1,  Dom:0.6 },
  'Cachito':           { Lun:0.7,  Mar:0.9,  Mié:0.7,  Jue:1.1,  Vie:0.9,  Sáb:0.6,  Dom:0.1 },
  'Roll hojaldre':     { Lun:0.2,  Mar:0.2,  Mié:0.2,  Jue:0.4,  Vie:0.3,  Sáb:0.3,  Dom:0.1 },
};

const BOL_DIAS_NOMBRES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function renderVistaEstimacionBOL() {
  const vista = document.getElementById('vista-estimacion-bol');
  if (!vista) return;
  mostrarVista('estimacion-bol');

  const cfg = cargarConfigSubrecetas();
  const maxMasas = (cfg.bol?.amasadora_tandas_dia || 2) * (cfg.bol?.amasadora_max_por_tanda || 16);
  const capHorno = cfg.bol?.capacidad_horno || 90;

  const productos = [...new Set([...Object.keys(BOL_ESTIMACION_B2B), ...Object.keys(BOL_ESTIMACION_B2C)])];

  // Para cada producto: calcular día más fuerte y promedios
  const analisis = productos.map(prod => {
    const b2b = BOL_ESTIMACION_B2B[prod] || {};
    const b2c = BOL_ESTIMACION_B2C[prod] || {};
    let maxTotal = 0, maxDia = '';
    let sumB2B = 0, sumB2C = 0, nDias = 0;
    BOL_DIAS_NOMBRES.forEach(d => {
      const b2bV = parseFloat(b2b[d] || 0);
      const b2cV = parseFloat(b2c[d] || 0);
      const total = b2bV + b2cV;
      sumB2B += b2bV; sumB2C += b2cV; nDias++;
      if (total > maxTotal) { maxTotal = total; maxDia = d; }
    });
    const promedioB2B = (sumB2B / nDias).toFixed(1);
    const promedioB2C = (sumB2C / nDias).toFixed(1);
    const promedioTotal = ((sumB2B + sumB2C) / nDias).toFixed(1);
    const semTotal = sumB2B + sumB2C;
    return { prod, maxDia, maxB2B: b2b[maxDia]||0, maxB2C: b2c[maxDia]||0, maxTotal,
             promedioB2B, promedioB2C, promedioTotal, semTotal: Math.round(semTotal) };
  }).filter(a => a.semTotal > 0).sort((a,b) => b.semTotal - a.semTotal);

  // Masas estimadas por día
  const masasPorDia = BOL_DIAS_NOMBRES.map(d => {
    let total = 0;
    productos.forEach(prod => {
      const b2b = BOL_ESTIMACION_B2B[prod] || {};
      const b2c = BOL_ESTIMACION_B2C[prod] || {};
      total += parseFloat(b2b[d]||0) + parseFloat(b2c[d]||0);
    });
    const masas = Math.ceil(total / 10);
    const color = masas > maxMasas ? '#C62828' : masas > maxMasas*0.8 ? '#F57C00' : '#2E7D32';
    return { d, total: Math.round(total), masas, color };
  });

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">Bollería — Admin</div>
        <h1 class="vista-titulo">Estimación de demanda</h1>
      </div>
    </div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:20px">
      Basado en datos reales: B2B dic 2025–jul 2026 · B2C jun 2025–jun 2026.
      Úsalo como referencia para definir tu meta de producción.
    </p>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-flame"></i> Días clave por producto</div>
      ${analisis.map(a => `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="min-width:160px;font-weight:600;font-size:13px">${a.prod}</div>
            <div style="background:#FFF3E0;border-radius:var(--r-md);padding:6px 12px;font-size:12px">
              🔥 <strong>${a.maxDia}</strong> más fuerte —
              B2B: <strong>${a.maxB2B}</strong> · B2C: <strong>${a.maxB2C}</strong> ·
              Total: <strong style="color:#E65100">${Math.round(a.maxTotal)}</strong>
            </div>
            <div style="font-size:11px;color:var(--txt3)">
              Prom/día: B2B ${a.promedioB2B} + B2C ${a.promedioB2C} = <strong>${a.promedioTotal}</strong> ·
              Semana est.: <strong>${a.semTotal}</strong>
            </div>
          </div>
        </div>`).join('')}
    </div>

    <div class="card">
      <div class="card-head" style="background:#FFF3E0;color:#E65100">
        <i class="ti ti-stack-2"></i> Masas estimadas por día (histórico)
        <span style="margin-left:auto;font-size:11px;font-weight:400">Cap: ${maxMasas} masas/día · ${capHorno} uni/tanda</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;padding:14px 16px">
        ${masasPorDia.map(({d, total, masas, color}) => `
          <div style="background:var(--bg);border:1.5px solid ${color}30;border-radius:var(--r-md);padding:10px 16px;min-width:90px;text-align:center">
            <div style="font-size:12px;color:var(--txt3);margin-bottom:4px">${d}</div>
            <div style="font-size:22px;font-weight:700;color:${color};font-family:'DM Mono',monospace">${masas}</div>
            <div style="font-size:10px;color:var(--txt3)">masas</div>
            <div style="font-size:10px;color:var(--txt2);margin-top:2px">${total} uni</div>
            ${masas > maxMasas ? `<div style="font-size:9px;color:#C62828;margin-top:2px">⚠ +${masas-maxMasas}</div>` : ''}
          </div>`).join('')}
      </div>
      <div style="padding:8px 16px 12px;font-size:11px;color:var(--txt3)">
        ⚠ Estos son promedios históricos. Tu producción actual (~900 croissants/semana) ya los supera — úsalos como piso, no como techo.
      </div>
    </div>
  `;
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

        // Load manual tasks from Sheet into localStorage
        if (t.tipo_tarea.startsWith('manual_')) {
          try {
            const tareaData = JSON.parse(t.subtarea);
            const ctx = tareaData.contexto || 'prod';
            const keyPre  = `fen_bol_tareas_manuales_pre_${semana}_${diaIdx}`;
            const keyProd = `fen_bol_tareas_manuales_${semana}_${diaIdx}`;
            const key = ctx === 'pre' ? keyPre : keyProd;
            const tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
            // Only add if not already there
            if (!tareas.find(x => x.id === tareaData.id)) {
              const tObj = { id: tareaData.id, hora: tareaData.hora, titulo: tareaData.titulo,
                             detalle: tareaData.detalle, icono: '📝' };
              if (ctx !== 'pre') { tObj.turno = 'am'; tObj.manual = true; }
              tareas.push(tObj);
              localStorage.setItem(key, JSON.stringify(tareas));
            }
          } catch(e) {}
          return;
        }

        // Sheet es fuente de verdad — siempre actualizar localStorage desde Sheet
        const clavePreLS  = `fen_bol_pre_${semana}_${diaIdx}_${t.subtarea}`;
        const claveProdLS = `fen_bol_check_${semana}_${diaIdx}_${t.subtarea}`;
        const claveEmpPor = `fen_bol_emp_por_${semana}_${diaIdx}`;
        const claveEmpEst = `fen_bol_emp_est_${semana}_${diaIdx}`;
        if (t.tipo_tarea === 'empaste_porcionados')
          localStorage.setItem(claveEmpPor, String(t.cantidad));
        else if (t.tipo_tarea === 'empaste_estirados')
          localStorage.setItem(claveEmpEst, String(t.cantidad));
        else {
          localStorage.setItem(clavePreLS, t.estado);
          localStorage.setItem(claveProdLS, t.estado);
        }
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

// ── BOL: DESCONGELADO → PLAN HORNEADO ────────────────────────
function actualizarDescongelado(prodId, diaIdx, valor, planificado) {
  const semana = obtenerSemanaActual();
  const cant = parseInt(valor) || 0;
  const claveDesc = `fen_bol_desc_${semana}_${diaIdx}_${prodId}`;
  localStorage.setItem(claveDesc, cant);

  // Update estado label
  const pct = planificado > 0 ? Math.round(cant/planificado*100) : 0;
  const color = pct >= 100 ? '#2E7D32' : pct > 0 ? '#F57C00' : 'var(--txt3)';
  const label = pct >= 100 ? '✓ Completo' : pct > 0 ? `◑ ${pct}%` : '';
  const sp = document.getElementById(`desc-estado-${prodId}`);
  if (sp) { sp.textContent = label; sp.style.color = color; }

  // Save to Sheet
  const payload = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: `desc_cant_${prodId}`,
    subtarea: prodId,
    cantidad: cant,
    cantidad_real: cant,
    estado: pct >= 100 ? '1' : '0',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload).catch(() => {});

  // Update stock congelado in plan de horneado (next day)
  const sigDiaIdx = (diaIdx + 1) % 7;
  const claveStock = `fen_bol_stock_${semana}_${sigDiaIdx}_${prodId}`;
  localStorage.setItem(claveStock, cant);

  // If Plan de horneado is currently visible for next day, update the field
  const stockInput = document.querySelector(`input[data-prod="${prodId}"][data-tipo="stock"]`);
  if (stockInput) {
    stockInput.value = cant;
    actualizarStockCirculante(stockInput, sigDiaIdx);
  }
}

// Load descongelado quantities from Sheet cache
function actualizarDescongeladoMasa(masaId, diaIdx, valor, planificado) {
  const semana = obtenerSemanaActual();
  const cant = parseInt(valor) || 0;
  const clave = `fen_bol_desc_masa_${semana}_${diaIdx}_${masaId}`;
  localStorage.setItem(clave, cant);

  const pct = planificado > 0 ? Math.round(cant/planificado*100) : 0;
  const color = pct >= 100 ? '#2E7D32' : pct > 0 ? '#F57C00' : 'var(--txt3)';
  const label = pct >= 100 ? '✓ Completo' : pct > 0 ? `◑ ${pct}%` : '';
  const sp = document.getElementById(`desc-masa-estado-${masaId}`);
  if (sp) { sp.textContent = label; sp.style.color = color; }

  // Save to Sheet
  const payload = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: `desc_masa_cant_${masaId}`,
    subtarea: masaId,
    cantidad: cant,
    estado: pct >= 100 ? '1' : '0',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload).catch(() => {});
}

async function cargarDescongeladoAntDesdeSheet(diaAnt, diaHoy) {
  // Load previous day tareas to get desc_cant values without overwriting current day cache
  const semana = obtenerSemanaActual();
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'leer_tareas_bol',
      semana_ID: semana,
      dia: diaAnt
    }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && data.tareas) {
      data.tareas.forEach(t => {
        if (!t.tipo_tarea.startsWith('desc_cant_') && !t.tipo_tarea.startsWith('prod_desc_prod_')) return;
        const prodId = t.tipo_tarea.replace('desc_cant_','').replace('prod_desc_prod_','');
        const cantReal = t.cantidad_real !== undefined ? parseInt(t.cantidad_real) : parseInt(t.cantidad) || 0;
        if (cantReal === 0) return;
        // Save as stock for today (diaHoy)
        const claveStock = `fen_bol_stock_${semana}_${diaHoy}_${prodId}`;
        localStorage.setItem(claveStock, cantReal);
        // Also save desc for reference
        const claveDesc = `fen_bol_desc_${semana}_${diaAnt}_${prodId}`;
        localStorage.setItem(claveDesc, cantReal);
      });
    }
  } catch(e) {
    console.warn('[fën] No se pudo cargar descongelado anterior:', e.message);
  }
}

function cargarDescongeladoDesdeSheet(diaIdx) {
  const semana = obtenerSemanaActual();
  const sigDiaIdx = (diaIdx + 1) % 7;
  // Look for desc_cant tasks in loaded tareas
  Object.entries(_tareasEstadoBOL).forEach(([tipo, val]) => {
    if (!tipo.startsWith('desc_cant_')) return;
    const prodId = tipo.replace('desc_cant_', '');
    const claveDesc = `fen_bol_desc_${semana}_${diaIdx}_${prodId}`;
    const claveStock = `fen_bol_stock_${semana}_${sigDiaIdx}_${prodId}`;
    // Always update from Sheet (Sheet is source of truth)
    localStorage.setItem(claveDesc, val);
    localStorage.setItem(claveStock, val);
  });
  // Also check prod_ tasks for descongelar with cantidad_real
  Object.entries(_tareasEstadoBOL).forEach(([tipo, val]) => {
    if (!tipo.startsWith('prod_desc_prod_')) return;
    // val here is estado, but we need cantidad_real — stored separately in Sheet
    // This is handled via desc_cant_ entries above
  });
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
        <h1 class="vista-titulo">Pre-elaboraciones y tareas</h1>
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
  const mantPorEmpaste = cfg.bol?.mantequilla_por_empaste || 250;

  // Masa base MPs
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

  // Poolish para MAÑANA (diaSiguiente)
  const poolishHoy = poolishMPs.map(m => ({
    mp: m, cantidad: (_planMasasBOL[masasBase[0]?.ID_MP] || [])[diaSiguiente] || 0,
    receta: App.recetas.find(r => r.nombre === m.nombre && r.estado === 'consolidada')
  })).filter(x => x.cantidad > 0);

  // Empastes para MAÑANA
  let totalEmpastes = 0;
  const desglosEmpastes = [];
  Object.entries(App.planSemana).forEach(([rid, cant]) => {
    const unidades = cant[diaSiguiente] || 0;
    if (!unidades) return;
    const receta = App.recetas.find(r => r.ID_receta === rid);
    if (!receta) return;
    let ings = []; try { ings = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(receta.porciones_base) || 1;
    ings.forEach(ing => {
      if ((ing.nombre||'').toLowerCase().includes('empaste')) {
        const n = Math.ceil((parseFloat(ing.unidades)||1) / porciones * unidades);
        totalEmpastes += n;
        desglosEmpastes.push({ nombre: receta.nombre, cantidad: n });
      }
    });
  });

  // Excedente de empastes del día ANTERIOR
  const diaAnterior = (diaIdx + 6) % 7;
  const claveEmpEstAnt = `fen_bol_emp_est_${semana}_${diaAnterior}`;
  const claveEmpPlanAnt = `fen_bol_emp_plan_${semana}_${diaAnterior}`;
  const estAnt  = parseInt(localStorage.getItem(claveEmpEstAnt)) || 0;
  const planAnt = parseInt(localStorage.getItem(claveEmpPlanAnt)) || 0;
  const excedente = Math.max(0, estAnt - planAnt);
  const empastesNecesarios = Math.max(0, totalEmpastes - excedente);

  // Estado empastes HOY
  const getCheck = id => getTareaEstadoBOL(id, semana, diaIdx, 'pre');
  const claveEmpPor = `fen_bol_emp_por_${semana}_${diaIdx}`;
  const claveEmpEst = `fen_bol_emp_est_${semana}_${diaIdx}`;
  const empPorcionados = parseInt(localStorage.getItem(claveEmpPor)) ||
                         (parseInt(_tareasEstadoBOL['empaste_porcionados']) || 0);
  const empEstirados   = parseInt(localStorage.getItem(claveEmpEst)) ||
                         (parseInt(_tareasEstadoBOL['empaste_estirados']) || 0);

  // Save plan de empastes para que mañana pueda calcular excedente
  localStorage.setItem(`fen_bol_emp_plan_${semana}_${diaIdx}`, totalEmpastes);

  // Descongelar masas y productos para MAÑANA
  const masasDescongelarManana = masasBase.map(m => ({
    mp: m, cantidad: totalEmpastes, // 1:1 con empastes
    receta: App.recetas.find(r => r.nombre === m.nombre && r.estado === 'consolidada')
  })).filter(x => x.cantidad > 0);

  const productosManana = Object.entries(App.planSemana)
    .filter(([_, cant]) => (cant[diaSiguiente] || 0) > 0)
    .map(([rid, cant]) => ({
      receta: App.recetas.find(r => r.ID_receta === rid),
      unidades: cant[diaSiguiente]
    })).filter(x => x.receta && x.receta.tipo_receta !== 'sub_receta');

  // Helper renderTandas
  const renderTandas = (id, cantidad, receta) => {
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
                    style="background:none;border:none;color:var(--txt3);cursor:pointer;padding:2px 4px;font-size:12px">
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

  const estadoColor = e => e === 'completado' ? '#2E7D32' : e === 'parcial' ? '#F57C00' : 'var(--txt3)';
  const estadoLabel = e => e === 'completado' ? '✓ Completado' : e === 'parcial' ? '◑ Parcial' : '';
  const empPorEstado = totalEmpastes === 0 ? '' : empPorcionados >= totalEmpastes ? 'completado' : empPorcionados > 0 ? 'parcial' : '';
  const empEstEstado = totalEmpastes === 0 ? '' : empEstirados >= totalEmpastes ? 'completado' : empEstirados > 0 ? 'parcial' : '';

  // Tareas manuales
  const tareasManualKey = `fen_bol_tareas_manuales_pre_${semana}_${diaIdx}`;
  const tareasManual = (() => { try { return JSON.parse(localStorage.getItem(tareasManualKey)||'[]'); } catch(e) { return []; } })();

  const noPlan = poolishHoy.length === 0 && totalEmpastes === 0 && productosManana.length === 0;

  contenedor.innerHTML = noPlan ? `
    <div class="empty-state" style="height:200px">
      <i class="ti ti-moon"></i>
      <h2>Sin plan para ${diasNombres[diaSiguiente]}</h2>
      <p>No hay productos ni masas planificadas para mañana.</p>
    </div>` : `

    <!-- POOLISH AM/PM -->
    ${poolishHoy.length ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-droplet"></i> ${diasNombres[diaIdx]} — Poolish (para masas de ${diasNombres[diaSiguiente]})
        <span style="margin-left:auto;font-size:11px;font-weight:400">${poolishHoy[0].cantidad} masas</span>
      </div>
      ${poolishHoy.map(({ mp, cantidad, receta }) =>
        renderTandas(mp.ID_MP + '_poolish', cantidad, receta)
      ).join('')}
    </div>` : ''}

    <!-- EMPASTES -->
    ${totalEmpastes > 0 ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="background:#E8F5E9;color:#1B5E20">
        <i class="ti ti-sun-low"></i> ${diasNombres[diaIdx]} PM — Empastes para ${diasNombres[diaSiguiente]}
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:600;margin-bottom:6px">
          🧈 Empastes necesarios: <strong style="color:var(--area-color)">${empastesNecesarios}</strong> / ${totalEmpastes} total
          ${excedente > 0 ? `<span style="font-size:11px;color:#2E7D32;margin-left:8px">✓ ${excedente} disponibles del ${diasNombres[diaAnterior]}</span>` : ''}
        </div>
        <div style="font-size:11px;color:var(--txt3);margin-bottom:10px">
          Para: ${desglosEmpastes.map(d => `${d.nombre} (${d.cantidad})`).join(' · ')} · ${totalEmpastes * mantPorEmpaste}g mantequilla total
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
              ${empEstirados > totalEmpastes ? `<span id="emp-est-extra" style="font-size:11px;color:#2E7D32;font-weight:600">+${empEstirados - totalEmpastes} para otro día</span>` : `<span id="emp-est-extra"></span>`}
            </div>
          </div>
        </div>
      </div>
    </div>` : ''}

    <!-- ELABORAR MASA BASE (pre-elaboración del día planificado) -->
    ${(() => {
      const masasHoyElab = masasBase.map(m => ({
        mp: m,
        cantidad: (_planMasasBOL[m.ID_MP] || [])[diaIdx] || 0,
        receta: App.recetas.find(r => r.nombre === m.nombre && r.estado === 'consolidada')
      })).filter(x => x.cantidad > 0);
      if (!masasHoyElab.length) return '';
      return renderElaboracionMasaBaseBOL(diaIdx, diasNombres);
    })()}

    <!-- DESCONGELAR MASAS Y PRODUCTOS -->
    ${(masasDescongelarManana.length > 0 || productosManana.length > 0) ? `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="background:#E3F2FD;color:#1565C0">
        <i class="ti ti-snowflake"></i> ${diasNombres[diaIdx]} PM — Descongelar para ${diasNombres[diaSiguiente]}
      </div>
      <div style="padding:8px 0">
        ${masasDescongelarManana.map(({mp, cantidad}) => {
          const id = 'desc_masa_' + mp.nombre.replace(/[^a-zA-Z0-9]/g,'_');
          const done = getCheck(id);
          return `
          <div class="bol-tarea ${done?'bol-tarea-done':''}" id="pre-tarea-${id}">
            <label class="rdc-check-wrap">
              <input type="checkbox" ${done?'checked':''} onchange="togglePreTarea('${id}',${diaIdx},this.checked)">
              <span class="rdc-check-box"></span>
            </label>
            <span style="font-size:16px">❄️</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600">Descongelar ${mp.nombre}</div>
              <div style="font-size:11px;color:var(--txt3)">${cantidad} masas · en frío para ${diasNombres[diaSiguiente]}</div>
            </div>
          </div>`;
        }).join('')}
        ${productosManana.map(({receta: r, unidades}) => {
          const id = 'desc_prod_' + r.ID_receta.replace(/[^a-zA-Z0-9]/g,'_');
          const claveDesc = `fen_bol_desc_${semana}_${diaIdx}_${r.ID_receta}`;
          const cantDesc = localStorage.getItem(claveDesc) !== null ? localStorage.getItem(claveDesc) : unidades;
          if (localStorage.getItem(claveDesc) === null) localStorage.setItem(claveDesc, unidades);
          const done = getCheck(id);
          const pct = unidades > 0 ? Math.round(parseInt(cantDesc)/unidades*100) : 0;
          const color = pct >= 100 ? '#2E7D32' : pct > 0 ? '#F57C00' : 'var(--txt3)';
          const label = pct >= 100 ? '✓ Completo' : pct > 0 ? `◑ ${pct}%` : '';
          return `
          <div class="bol-tarea ${done?'bol-tarea-done':''}" id="pre-tarea-${id}" style="flex-direction:column;align-items:stretch">
            <div style="display:flex;align-items:center;gap:8px">
              <label class="rdc-check-wrap">
                <input type="checkbox" ${done?'checked':''} onchange="togglePreTarea('${id}',${diaIdx},this.checked)">
                <span class="rdc-check-box"></span>
              </label>
              <span style="font-size:16px">🧊</span>
              <div style="flex:1">
                <div style="font-size:13px;font-weight:600">Descongelar ${r.nombre}</div>
                <div style="font-size:11px;color:var(--txt3)">${unidades} uni planificadas para ${diasNombres[diaSiguiente]}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:var(--r-sm)">
              <span style="font-size:11px;color:var(--txt3)">Descongelado:</span>
              <input type="number" min="0" value="${cantDesc}"
                style="width:60px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace;text-align:center"
                oninput="actualizarDescongelado('${r.ID_receta}',${diaIdx},this.value,${unidades})">
              <span style="font-size:11px">/ ${unidades} uni</span>
              <span style="font-size:11px;font-weight:600;color:${color}" id="desc-estado-${r.ID_receta}">${label}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- TAREAS DEL DÍA -->
    <div class="card" style="margin-bottom:14px">
      <div class="card-head" style="background:var(--bg);color:var(--txt2)">
        <i class="ti ti-list-check"></i> Tareas del día
      </div>
      ${tareasManual.length ? `
      <div style="padding:8px 0">
        ${tareasManual.map(t => {
          const done = getCheck('manual_' + t.id);
          return `
          <div class="bol-tarea ${done?'bol-tarea-done':''}" id="pre-tarea-manual_${t.id}">
            <label class="rdc-check-wrap">
              <input type="checkbox" ${done?'checked':''} onchange="togglePreTarea('manual_${t.id}',${diaIdx},this.checked)">
              <span class="rdc-check-box"></span>
            </label>
            <input type="time" value="${t.hora}"
              style="border:none;background:none;font-family:'DM Mono',monospace;font-size:12px;color:var(--txt3);width:70px;cursor:pointer;padding:0;min-width:70px">
            <span style="font-size:16px">📝</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600">${t.titulo}</div>
              ${t.detalle ? `<div style="font-size:11px;color:var(--txt3)">${t.detalle}</div>` : ''}
            </div>
            <button onclick="eliminarTareaManualPreBOL('${t.id}',${diaIdx})" style="background:none;border:none;color:var(--txt3);cursor:pointer"><i class="ti ti-x"></i></button>
          </div>`;
        }).join('')}
      </div>` : ''}
      <div style="padding:10px 16px;border-top:1px solid var(--border)">
        <button class="btn-secundario" style="font-size:12px;width:100%" onclick="abrirModalTareaManualBOL(${diaIdx},'pre')">
          <i class="ti ti-plus"></i> Agregar tarea
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
    accion: 'guardar_tarea_bol', semana_ID: semana, dia: diaIdx,
    tipo_tarea: 'empaste_porcionados', subtarea: 'empaste_porcionados',
    cantidad: por, cantidad_real: por, estado: '1',
    fecha_local: fechaRealDiaSemana(diaIdx), dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload).catch(() => {});
  const payload2 = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol', semana_ID: semana, dia: diaIdx,
    tipo_tarea: 'empaste_estirados', subtarea: 'empaste_estirados',
    cantidad: est, cantidad_real: est, estado: '1',
    fecha_local: fechaRealDiaSemana(diaIdx), dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload2).catch(() => {});

  // Calculate total empastes for this day
  let total = 0;
  const diaSig = (diaIdx + 1) % 7;
  Object.entries(App.planSemana).forEach(([rid, cant]) => {
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
  const spEstExtra = document.getElementById('emp-est-extra');
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
  const clave = `fen_bol_pre_tandas_${obtenerSemanaActual()}_${diaIdx}_${id}`;
  let tandas = (() => { try { return JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) { return null; } })();
  if (tandas) { tandas[idx] = valor; localStorage.setItem(clave, JSON.stringify(tandas)); }
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
}

function eliminarTareaManualPreBOL(id, diaIdx) {
  const key = `fen_bol_tareas_manuales_pre_${obtenerSemanaActual()}_${diaIdx}`;
  let tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem(key, JSON.stringify(tareas));
  renderPreElabDia(diaIdx);
}

function togglePreTarea(id, diaIdx, checked) {
  const semana = obtenerSemanaActual();
  localStorage.setItem(`fen_bol_pre_${semana}_${diaIdx}_${id}`, checked?'1':'0');
  _tareasEstadoBOL[`pre_${id}`] = checked ? '1' : '0';
  const elDirect = document.getElementById('pre-tarea-' + id);
  if (elDirect) {
    elDirect.classList.toggle('bol-tarea-done', checked);
  } else {
    document.querySelectorAll(`[id^="pre-tarea-${id}"]`).forEach(el => {
      el.classList.toggle('bol-tarea-done', checked);
    });
  }
  const payloadTarea = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol', semana_ID: semana, dia: diaIdx,
    tipo_tarea: 'pre_' + id, subtarea: id, cantidad: 0,
    estado: checked ? '1' : '0',
    fecha_local: fechaRealDiaSemana(diaIdx), dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadTarea).catch(() => {});
}


// ── BOL: PRODUCCIÓN DEL DÍA ──────────────────────────────────
async function renderProduccionBOL(diaIdx, recetasHoy) {
  const contenedor = document.getElementById('contenedor-dia');
  const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const diaAnterior = (diaIdx + 6) % 7; // día anterior (para referencia)
  const diaSiguiente = (diaIdx + 1) % 7; // día siguiente
  const cfg = cargarConfigSubrecetas();
  const capacidadHorno = (cfg.bol?.capacidad_horno || 90);

  // Calcular plan de horneado desde plan semanal BOL (B2C + B2B)
  const semanaHorn = obtenerSemanaActual();
  const planHorneado = recetasHoy.map(({ receta: r, unidades }) => {
    const clavePlan = `fen_bol_plan_${semanaHorn}_${r.ID_receta}`;
    const planR = (() => { try { return JSON.parse(localStorage.getItem(clavePlan)||'null'); } catch(e) { return null; } })();
    const b2cVal = planR?.b2c?.[diaIdx] || 0;
    const b2bVal = planR?.b2b?.[diaIdx] || 0;
    const total = parseInt(unidades) || 0;
    return {
      id: r.ID_receta,
      nombre: r.nombre,
      unidades: total,
      b2c_plan: b2cVal,
      b2b_plan: b2bVal,
      a_hornear: total
    };
  });

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

  // Masas a descongelar HOY PM = empastes necesarios para producción de MAÑANA
  let totalEmpastesManana = 0;
  Object.entries(App.planSemana).forEach(([rid, cant]) => {
    const unidades = cant[diaSiguiente] || 0;
    if (!unidades) return;
    const receta = App.recetas.find(r => r.ID_receta === rid);
    if (!receta) return;
    let ings = []; try { ings = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(receta.porciones_base) || 1;
    ings.forEach(ing => {
      if ((ing.nombre||'').toLowerCase().includes('empaste')) {
        totalEmpastesManana += Math.ceil((parseFloat(ing.unidades)||1) / porciones * unidades);
      }
    });
  });

  const masasPlanAnterior = masasBase
    .filter(m => totalEmpastesManana > 0 || (_planMasasBOL[m.ID_MP] || [])[diaSiguiente] > 0)
    .map(m => ({
      nombre: m.nombre,
      cantidad: totalEmpastesManana || (_planMasasBOL[m.ID_MP] || [])[diaSiguiente] || 0
    })).filter(m => m.cantidad > 0);

  // Productos a descongelar HOY = plan de MAÑANA
  const planManana = Object.entries(App.planSemana)
    .filter(([_, cant]) => (cant[diaSiguiente] || 0) > 0)
    .map(([rid, cant]) => ({
      receta: App.recetas.find(r => r.ID_receta === rid),
      unidades: cant[diaSiguiente]
    }))
    .filter(x => x.receta && x.receta.tipo_receta !== 'sub_receta');

  const productosFormados = planManana.map(({receta: r, unidades}) => ({
    id: r.ID_receta,
    nombre: r.nombre,
    a_hornear: parseInt(unidades) || 0
  })).filter(p => p.a_hornear > 0);

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
      id: `desc_prod_${p.id.replace(/[^a-zA-Z0-9]/g,'_')}`,
      hora: '15:30',
      turno: 'anterior_pm',
      icono: '🧊',
      titulo: `Descongelar productos: ${p.nombre}`,
      detalle: `${p.a_hornear} uni planificadas`,
      prodId: p.id,
      planificado: p.a_hornear
    })),
    // Día actual AM
    { id: 'revisar_b2b', hora: '06:30', turno: 'am', icono: '📋', titulo: 'Revisar pedidos B2B', detalle: 'Actualizar cantidades a hornear' },
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
  const tareasPMHoy = todasTareas.filter(t => t.turno === 'pm_hoy');
  const tareasAM = todasTareas.filter(t => t.turno === 'am');

  const renderTarea = (t) => {
    const done = getTareaEstado(t.id);
    const semana = obtenerSemanaActual();

    // For descongelar masas base — show editable quantity
    let descongeladoExtra = '';
    if (t.masaId) {
      // Simple confirmation — no quantity field needed for masas base
      // The checkbox itself is the confirmation
      descongeladoExtra = `
        <div style="margin-top:4px;margin-left:32px;font-size:11px;color:var(--txt3)">
          ${t.planificadoMasas} masa${t.planificadoMasas>1?'s':''} · confirmar con el checkbox
        </div>`;
    }
    // For descongelar productos — show editable quantity
    if (t.prodId) {
      const claveDesc = `fen_bol_desc_${semana}_${diaIdx}_${t.prodId}`;
      // Default to planificado if no value set
      const cantDesc = localStorage.getItem(claveDesc) !== null 
        ? localStorage.getItem(claveDesc) 
        : t.planificado;
      // Pre-populate localStorage with planificado so it's saved on first check
      if (localStorage.getItem(claveDesc) === null) {
        localStorage.setItem(claveDesc, t.planificado);
      }
      const pct = t.planificado > 0 ? Math.round(parseInt(cantDesc)/t.planificado*100) : 0;
      const color = pct >= 100 ? '#2E7D32' : pct > 0 ? '#F57C00' : 'var(--txt3)';
      const label = pct >= 100 ? '✓ Completo' : pct > 0 ? `◑ ${pct}%` : '';
      descongeladoExtra = `
        <div style="display:flex;align-items:center;gap:8px;margin-top:6px;padding:6px 10px;background:var(--bg);border-radius:var(--r-sm)">
          <span style="font-size:11px;color:var(--txt3)">Descongelado:</span>
          <input type="number" min="0" value="${cantDesc}"
            style="width:60px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:'DM Mono',monospace;text-align:center"
            oninput="actualizarDescongelado('${t.prodId}',${diaIdx},this.value,${t.planificado})">
          <span style="font-size:11px">/ ${t.planificado} uni</span>
          <span style="font-size:11px;font-weight:600;color:${color}" id="desc-estado-${t.prodId}">${label}</span>
        </div>`;
    }
    if (!t.masaId && !t.prodId) descongeladoExtra = '';

    return `
      <div class="bol-tarea ${done?'bol-tarea-done':''}" id="tarea-${t.id}" style="${t.prodId?'flex-direction:column;align-items:stretch':''}">
        <div style="display:flex;align-items:center;gap:8px">
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
            <div style="font-size:13px;font-weight:600;${done?'color:var(--txt3)':''}">${t.titulo}</div>
            <div style="font-size:11px;color:var(--txt3)">${t.detalle}</div>
          </div>
          ${t.manual ? `<button onclick="eliminarTareaManualBOL('${t.id}',${diaIdx})" style="background:none;border:none;color:var(--txt3);cursor:pointer;font-size:14px"><i class="ti ti-x"></i></button>` : ''}
        </div>
        ${descongeladoExtra}
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
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#1565C0">B2C plan</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#E65100">B2B plan</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Total plan</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Stock congelado</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">A descongelar</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">A formar hoy</th>
              <th style="text-align:center;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">A hornear</th>
            </tr>
          </thead>
          <tbody>
            ${planHorneado.map(p => {
              const semH = obtenerSemanaActual();
              const claveStock = `fen_bol_stock_${semH}_${diaIdx}_${p.id}`;
              const claveDescAnt = `fen_bol_desc_${semH}_${diaIdx > 0 ? diaIdx-1 : 6}_${p.id}`;
              const descAnt = localStorage.getItem(claveDescAnt);
              const stockCongelado = parseInt(localStorage.getItem(claveStock)) ||
                                     (descAnt !== null ? parseInt(descAnt) : 0);
              if (descAnt !== null && !localStorage.getItem(claveStock)) {
                localStorage.setItem(claveStock, descAnt);
              }
              const aDescongelar = Math.min(p.unidades, stockCongelado);
              const aFormarHoy = Math.max(0, p.unidades - aDescongelar);
              const aHornear = p.unidades;
              return `
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:8px 16px;font-weight:500">${p.nombre}</td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;color:#1565C0;font-weight:600">${p.b2c_plan||0}</td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;color:#E65100;font-weight:600">${p.b2b_plan||0}</td>
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;font-weight:700">${p.unidades}</td>
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
                <td style="text-align:center;padding:8px;font-family:'DM Mono',monospace;font-weight:700;color:var(--area-color);font-size:15px" id="a-hornear-${p.id}">
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
    ${tareasPMHoy.length ? `
    <div class="card" style="margin-bottom:16px;border-color:#E3F2FD">
      <div class="card-head" style="background:#E3F2FD;color:#1565C0">
        <i class="ti ti-moon"></i> ${diasNombres[diaIdx]} — Descongelar para ${diasNombres[diaSiguiente]}
      </div>
      <div style="padding:8px 0">
        ${tareasPMHoy.map(renderTarea).join('')}
      </div>
    </div>` : ''}

    <!-- TAREAS DÍA ACTUAL AM -->
    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#FFF8E1;color:#F57C00">
        <i class="ti ti-sun"></i> ${diasNombres[diaIdx]} — Planifica bien tu horneado del día
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

function renderElaboracionMasaBaseBOL(diaIdx, diasNombres) {
  const masasBase = App.materiasPrimas.filter(m => {
    const esSR = m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR');
    const nombre = (m.nombre || '').toLowerCase();
    return esSR && nombre.includes('masa') && !nombre.includes('madre') &&
           !nombre.includes('poolish') && (!m.areas_habilitadas || m.areas_habilitadas.includes('BOL'));
  });
  const masasHoy = masasBase.map(m => ({
    mp: m,
    cantidad: (_planMasasBOL[m.ID_MP] || [])[diaIdx] || 0,
    receta: App.recetas.find(r => r.nombre === m.nombre && r.estado === 'consolidada')
  })).filter(x => x.cantidad > 0);

  if (!masasHoy.length) return '';

  const cfg = cargarConfigSubrecetas();
  const maxPorTanda = cfg.bol?.amasadora_max_por_tanda || 16;
  const semana = obtenerSemanaActual();

  let html = '<div class="card" style="margin-bottom:16px;border-color:#E8F5E9">';
  html += '<div class="card-head" style="background:#E8F5E9;color:#1B5E20">';
  html += '<i class="ti ti-wind"></i> ' + diasNombres[diaIdx] + ' PM — Elaborar Masa Base';
  html += '<span style="margin-left:auto;font-size:11px;font-weight:400">reponer stock</span></div>';

  masasHoy.forEach(({mp, cantidad, receta}) => {
    const claveTandas = 'fen_bol_elab_tandas_' + semana + '_' + diaIdx + '_' + mp.ID_MP;
    let tandas = null;
    try { tandas = JSON.parse(localStorage.getItem(claveTandas)||'null'); } catch(e) {}
    if (!tandas) {
      tandas = [];
      let resto = cantidad;
      while (resto > 0) { const n = Math.min(resto, maxPorTanda); tandas.push(n); resto -= n; }
    }
    let ings = [];
    if (receta) try { ings = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}

    html += '<div style="padding:8px 16px">';
    html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">';
    html += '<span style="font-weight:600;font-size:13px">' + mp.nombre + ' — ' + cantidad + ' masas</span>';
    html += '<button onclick="agregarTandaElab("' + mp.ID_MP + '",' + diaIdx + ')" class="btn-secundario" style="font-size:11px;padding:2px 8px;margin-left:auto"><i class="ti ti-plus"></i> Tanda</button>';
    html += '</div>';

    tandas.forEach((n, i) => {
      const idElab = 'elab_' + mp.ID_MP + '_' + i;
      const done = getTareaEstadoBOL(idElab, semana, diaIdx, 'prod');
      html += '<div class="bol-tarea ' + (done?'bol-tarea-done':'') + '" style="flex-direction:column;align-items:stretch;padding:8px 0;border-bottom:1px solid var(--border)">';
      html += '<div style="display:flex;align-items:center;gap:8px">';
      html += '<label class="rdc-check-wrap"><input type="checkbox" ' + (done?'checked':'') + ' onchange="toggleTareaBOLProduccion(' + JSON.stringify(idElab) + ',this.checked)"><span class="rdc-check-box"></span></label>';
      html += '<span style="font-size:13px;font-weight:600">Tanda ' + (i+1) + ': ' + n + ' masas</span>';
      html += '</div>';
      if (ings.length) {
        html += '<div style="margin-top:4px;padding:4px 10px;background:var(--bg);border-radius:var(--r-sm);margin-left:32px">';
        ings.forEach(ing => {
          html += '<div style="font-size:11px;color:var(--txt2);padding:1px 0">' + ing.nombre + ': <strong>' + Math.round((parseFloat(ing.gramos)||0)*n) + 'g</strong></div>';
        });
        html += '</div>';
      }
      html += '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

function agregarTandaElab(mpId, diaIdx) {
  const clave = 'fen_bol_elab_tandas_' + obtenerSemanaActual() + '_' + diaIdx + '_' + mpId;
  let tandas = null; try { tandas = JSON.parse(localStorage.getItem(clave)||'null'); } catch(e) {}
  if (!tandas) tandas = [1]; else tandas.push(1);
  localStorage.setItem(clave, JSON.stringify(tandas));
  // Re-render just the elaboracion section
  const contenedorDia = document.getElementById('contenedor-dia');
  if (contenedorDia) {
    const diasNombres = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const elabDiv = contenedorDia.querySelector('.card[style*="E8F5E9"]');
    if (elabDiv) elabDiv.outerHTML = renderElaboracionMasaBaseBOL(diaIdx, diasNombres);
  }
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
  // If it's a descongelar task and being checked, save current cantidad field value as cantidad_real
  let cantReal = 0;
  if (id.startsWith('desc_prod_')) {
    const prodId = id.replace('desc_prod_', '');
    const claveDesc = `fen_bol_desc_${semana}_${diaIdx}_${prodId}`;
    cantReal = parseInt(localStorage.getItem(claveDesc)) || 0;
    // If no value set yet and checking, use the field value
    if (cantReal === 0 && checked) {
      const input = document.querySelector(`#tarea-${id} input[type=number]`);
      if (input) cantReal = parseInt(input.value) || 0;
    }
  }
  const payloadTarea2 = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: 'prod_' + id,
    subtarea: id,
    cantidad: cantReal,
    cantidad_real: cantReal,
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

function abrirModalTareaManualBOL(diaIdx, contexto) {
  const modal = document.getElementById('modal-tarea-manual-bol');
  if (modal) {
    const diaInput = document.getElementById('tarea-manual-dia');
    diaInput.value = diaIdx;
    diaInput.dataset.contexto = contexto || 'prod';
    document.getElementById('tarea-manual-hora').value = '10:00';
    document.getElementById('tarea-manual-titulo').value = '';
    document.getElementById('tarea-manual-detalle').value = '';
    modal.classList.remove('hidden');
  }
}

function guardarTareaManualBOL() {
  const diaIdx = parseInt(document.getElementById('tarea-manual-dia').value);
  const contexto = document.getElementById('tarea-manual-dia').dataset.contexto || 'prod';
  const hora   = document.getElementById('tarea-manual-hora').value;
  const titulo = document.getElementById('tarea-manual-titulo').value.trim();
  const detalle = document.getElementById('tarea-manual-detalle').value.trim();
  if (!titulo) { toast('Escribe un título para la tarea'); return; }

  const semana = obtenerSemanaActual();
  const id = Date.now().toString();
  const tarea = { id, hora, titulo, detalle, icono: '📝' };

  if (contexto === 'pre') {
    const key = `fen_bol_tareas_manuales_pre_${semana}_${diaIdx}`;
    const tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
    tareas.push(tarea);
    localStorage.setItem(key, JSON.stringify(tareas));
    document.getElementById('modal-tarea-manual-bol').classList.add('hidden');
    renderPreElabDia(diaIdx);
  } else {
    const key = `fen_bol_tareas_manuales_${semana}_${diaIdx}`;
    const tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
    tareas.push({ ...tarea, turno: 'am', manual: true });
    localStorage.setItem(key, JSON.stringify(tareas));
    document.getElementById('modal-tarea-manual-bol').classList.add('hidden');
    renderProduccionBOL(diaIdx, App._recetasHoyBOL || []);
  }

  // Save to Sheet — store full JSON in subtarea field
  const payload = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol',
    semana_ID: semana,
    dia: diaIdx,
    tipo_tarea: `manual_${contexto}_${id}`,
    subtarea: JSON.stringify({ ...tarea, contexto }),
    cantidad: 0,
    estado: '0',
    fecha_local: fechaRealDiaSemana(diaIdx),
    dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload).catch(() => {});
  toast('Tarea agregada');
}

function eliminarTareaManualBOL(id, diaIdx) {
  const key = `fen_bol_tareas_manuales_${obtenerSemanaActual()}_${diaIdx}`;
  let tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem(key, JSON.stringify(tareas));
  renderProduccionBOL(diaIdx, App._recetasHoyBOL || []);
}

function eliminarTareaManualPreBOL(id, diaIdx) {
  const key = `fen_bol_tareas_manuales_pre_${obtenerSemanaActual()}_${diaIdx}`;
  let tareas = (() => { try { return JSON.parse(localStorage.getItem(key)||'[]'); } catch(e) { return []; } })();
  tareas = tareas.filter(t => t.id !== id);
  localStorage.setItem(key, JSON.stringify(tareas));
  renderPreElabDia(diaIdx);
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
                  onclick="abrirModalDevolverReceta('${r.ID_receta}','${r._area}','${(r.nombre||'').replace(/'/g,"\\'")}')">
                  <i class="ti ti-x"></i> Devolver
                </button>
                <button id="btn-aprobar-${r.ID_receta}" class="btn-primario" style="font-size:12px;padding:5px 12px"
                  onclick="aprobarReceta('${r.ID_receta}','${r._area}',this)">
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
                  <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Cantidad</th>
                  ${r._area === 'PAN' || r.área === 'Panadería' ? `<th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">% pan.</th>` : ''}
                  <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Costo</th>
                </tr></thead>
                <tbody>
                  ${ingredientes.map(ing => {
                    const unidadRec = ing.unidad_receta || (ing.unidades !== undefined && ing.unidades !== null ? 'unidades' : 'gramos');
                    const displayVal = unidadRec === 'unidades'
                      ? `${parseFloat(ing.unidades||ing.gramos||0).toFixed(0)} uni`
                      : unidadRec === 'ml'
                      ? `${parseFloat(ing.ml||ing.gramos||0).toFixed(1)} ml`
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

async function aprobarReceta(recetaId, areaCodigo, btnParam) {
  const btn = btnParam || document.getElementById('btn-aprobar-' + recetaId);
  bloquearBtn(btn, 'Aprobando...');
  try {
    const hoja = FEN.AREAS[areaCodigo]?.hoja_recetas;
    await escribirEnSheet('aprobar_receta', { ID_receta: recetaId, hoja, aprobada_por: 'Admin' });
    clearEstadoLocal(recetaId);
    const r = App.recetas.find(x => x.ID_receta === recetaId);
    if (r) r.estado = 'consolidada';

    // Notificar a la jefa por aviso + correo
    const payloadAviso = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCodigo,
      tipo: 'receta_aprobada',
      mensaje: `Tu receta "${r?.nombre || recetaId}" fue aprobada y está disponible en el maestro.`
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAviso).catch(() => {});

    toast('Receta aprobada y enviada al maestro');
    setTimeout(() => renderVistaAprobaciones(), 1200);
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-check"></i> Aprobar', false);
    toast('Error: ' + e.message, 'error');
  }
}

function abrirModalDevolverReceta(recetaId, areaCodigo, nombre) {
  const modal = document.getElementById('modal-devolver-receta');
  if (!modal) return;
  document.getElementById('devolver-receta-id').value = recetaId;
  document.getElementById('devolver-receta-area').value = areaCodigo;
  document.getElementById('devolver-receta-nombre-display').textContent = nombre;
  document.getElementById('devolver-receta-comentario').value = '';
  modal.classList.remove('hidden');
}

async function rechazarReceta() {
  const recetaId   = document.getElementById('devolver-receta-id').value;
  const areaCodigo = document.getElementById('devolver-receta-area').value;
  const comentario = document.getElementById('devolver-receta-comentario').value.trim();
  const btn = document.getElementById('btn-confirmar-devolver');
  bloquearBtn(btn, 'Devolviendo...');
  try {
    const hoja = FEN.AREAS[areaCodigo]?.hoja_recetas;
    await escribirEnSheet('cambiar_estado', { ID_receta: recetaId, hoja, estado: 'en_prueba' });
    const r = App.recetas.find(x => x.ID_receta === recetaId);
    if (r) r.estado = 'en_prueba';

    // Notificar a la jefa por aviso + correo, incluyendo el comentario
    const mensajeBase = `Tu receta "${r?.nombre || recetaId}" fue devuelta para revisión.`;
    const mensajeCompleto = comentario
      ? `${mensajeBase} Comentario del admin: "${comentario}"`
      : `${mensajeBase} Revisa los detalles y vuelve a enviarla.`;
    const payloadAviso = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCodigo,
      tipo: 'receta_devuelta',
      mensaje: mensajeCompleto
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAviso).catch(() => {});

    document.getElementById('modal-devolver-receta').classList.add('hidden');
    toast('Receta devuelta a prueba');
    setTimeout(() => renderVistaAprobaciones(), 1200);
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-check"></i> Confirmar devolución', false);
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
async function eliminarSolicitudMP(mpId, nombre, btn) {
  if (!confirm(`¿Eliminar la solicitud "${nombre}"? Esta acción no se puede deshacer.`)) return;
  bloquearBtn(btn, 'Eliminando...');
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'eliminar_mp', ID_MP: mpId
    }));
    await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    App.materiasPrimas = App.materiasPrimas.filter(m => m.ID_MP !== mpId);
    Cache.invalidar('mp_maestro');
    toast(`Solicitud "${nombre}" eliminada`);
    renderVistaMP();
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-trash"></i> Eliminar', false);
    toast('Error al eliminar', 'error');
  }
}

async function notificarJefaMP(mpId, nombre, btn) {
  if (btn) bloquearBtn(btn, 'Notificando...');
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  const areaCode = mp?.area_codigo || mp?.areas_habilitadas?.split(',')?.[0] || '';

  await getSheet('editar_campo_mp', { ID_MP: mpId, campo: 'estado', valor: 'recibida' });

  // Crear aviso para la jefa del área via GET (payload pequeño)
  if (areaCode) {
    const payloadAvisRec = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCode,
      tipo: 'mp_recibida',
      mensaje: 'Tu solicitud fue recibida por administracion - esta siendo revisada.',
      mp_id: mpId
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAvisRec).catch(() => {});
  }

  if (mp) mp.estado = 'recibida';
  toast(`Notificado: "${nombre}" fue recibida`);
  // Force reload MP from Sheet to avoid stale cache
  App.materiasPrimas = App.materiasPrimas.map(m => m.ID_MP === mpId ? {...m, estado: 'recibida'} : m);
  Cache.invalidar('mp_maestro');
  renderVistaMP(); // re-renders the view, button feedback resets naturally
}

async function aprobarMP(mpId, btn) {
  if (btn) bloquearBtn(btn, 'Aprobando...');
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;

  const sinCosto = !mp.costo_neto || parseFloat(mp.costo_neto) === 0;
  if (sinCosto) {
    if (!confirm(`"${mp.nombre}" no tiene costo. ¿Agregar igual? Aparecerá en rojo hasta costearse.`)) return;
  }

  await getSheet('editar_campo_mp', { ID_MP: mpId, campo: 'estado', valor: 'activa' });

  const areaCode = mp.area_codigo || mp.areas_habilitadas?.split(',')?.[0] || '';
  if (areaCode) {
    const payloadAviso = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCode,
      tipo: 'mp_aprobada',
      mensaje: mp.nombre + ' fue aprobada y esta disponible.' + (mp.receta_nombre ? ' Receta: ' + mp.receta_nombre + '.' : '') + ' Actualiza tu receta.',
      mp_id: mpId
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAviso).catch(() => {});
  }

  mp.estado = 'activa';
  toast(`"${mp.nombre}" aprobada — aviso enviado a la jefa`);
  Cache.invalidar('mp_maestro');
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

async function confirmarAsignarMP(btn) {
  if (btn) bloquearBtn(btn, 'Asignando...');
  const mpSolicitudId = document.getElementById('asignar-mp-nueva-id').value;
  const mpExistId     = document.getElementById('asignar-mp-select').value;
  const areaCode      = document.getElementById('asignar-mp-area').value;
  const recetaId      = document.getElementById('asignar-mp-receta').value;
  const nombreExist   = document.getElementById('asignar-mp-select').selectedOptions[0]?.dataset.nombre || '';

  if (!mpExistId) { toast('Selecciona una MP existente'); return; }

  // 1. Marcar solicitud como reemplazada + guardar cuál MP la reemplaza (dato persistente)
  const r1 = await getSheet('editar_campo_mp', { ID_MP: mpSolicitudId, campo: 'estado', valor: 'reemplazada' });
  console.log('[fën] marcar reemplazada:', r1);
  const r1b = await getSheet('editar_campo_mp', { ID_MP: mpSolicitudId, campo: 'reemplazada_por', valor: mpExistId });
  console.log('[fën] guardar reemplazada_por:', r1b);

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
  if (mpSol) { mpSol.estado = 'reemplazada'; mpSol.reemplazada_por = mpExistId; }

  document.getElementById('modal-asignar-mp').classList.add('hidden');
  const mpSolObj = App.materiasPrimas.find(m => m.ID_MP === mpSolicitudId);
  const areaCode2 = mpSolObj?.area_codigo || areaCode || '';
  // Update local state immediately
  App.materiasPrimas = App.materiasPrimas.map(m => m.ID_MP === mpSolicitudId ? {...m, estado: 'reemplazada', reemplazada_por: mpExistId} : m);
  if (areaCode2) {
    const nombreOriginal = mpSolObj?.nombre || 'ingrediente pendiente';
    const recetaInfo = mpSolObj?.receta_nombre ? ` (receta: ${mpSolObj.receta_nombre})` : '';
    const payloadAvisAsig = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCode2,
      tipo: 'mp_asignada',
      mensaje: `Tu solicitud "${nombreOriginal}"${recetaInfo} fue resuelta: usa "${nombreExist}" en su lugar. Ve a Mis recetas → edita la receta y presiona Reemplazar.`,
      mp_id: mpSolicitudId
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAvisAsig).catch(() => {});
  }

  toast(`Asignado "${nombreExist}" — aviso enviado a la jefa`);
  Cache.invalidar('mp_maestro');
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
                onclick="notificarJefaMP('${p.ID_MP}','${p.nombre}',this)" title="Notificar a la jefa que fue recibida">
                <i class="ti ti-send"></i> Recibido
              </button>
              <button class="btn-primario" style="font-size:12px;padding:5px 10px"
                onclick="aprobarMP('${p.ID_MP}',this)" title="Agregar al maestro de MP">
                <i class="ti ti-check"></i> Agregar al maestro
              </button>
              <button class="btn-secundario" style="font-size:12px;padding:5px 10px"
                onclick="asignarMPExistente('${p.ID_MP}','${p.nombre}')" title="Asignar a una MP ya existente">
                <i class="ti ti-link"></i> Usar MP existente
              </button>
              <button class="btn-secundario" style="font-size:12px;padding:5px 10px;border-color:#EF9A9A;color:#C62828"
                onclick="eliminarSolicitudMP('${p.ID_MP}','${p.nombre}',this)" title="Eliminar esta solicitud">
                <i class="ti ti-trash"></i> Eliminar
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

function actualizarLabelGramosSolicitud() {
  const unidad = document.getElementById('solicitar-mp-unidad')?.value || 'gramos';
  const label  = document.getElementById('label-solicitar-mp-cantidad');
  if (label) {
    const labels = { gramos: 'Gramos (para agregar temporalmente)', unidades: 'Unidades (para agregar temporalmente)', ml: 'Mililitros (para agregar temporalmente)' };
    label.textContent = labels[unidad] || 'Cantidad';
  }
}

async function enviarSolicitudMP(btn) {
  if (btn) bloquearBtn(btn, 'Enviando...');
  const nombre    = document.getElementById('solicitar-mp-nombre').value.trim();
  const esNueva   = true; // Admin decides if it's new or existing
  const tmpNombre = document.getElementById('solicitar-mp-tmp').value.trim() || nombre;
  const cantidad  = document.getElementById('solicitar-mp-gramos').value;
  const unidad    = document.getElementById('solicitar-mp-unidad')?.value || 'gramos';

  if (!nombre) { toast('Escribe el nombre de la MP', 'error'); return; }

  // Enviar solicitud al Sheet via GET para obtener el ID generado
  const areaNombre = App.area?.nombre || (App.areaCodigo ? FEN.AREAS[App.areaCodigo]?.nombre : '') || '';
  let mpId = '__pendiente__';
  try {
    // Get recipe name being edited
    const recetaNombre = document.getElementById('f-nombre')?.value?.trim() || 'Receta sin nombre';
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'solicitar_mp',
      nombre,
      es_nueva: esNueva,
      solicitada_por: areaNombre,
      area_codigo: App.areaCodigo || '',
      categoría: 'Pendiente de clasificar',
      unidad_receta: unidad,
      receta_nombre: recetaNombre,
      fecha: new Date().toISOString()
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow' });
    const data = await res.json();
    if (data.ok && data.id) mpId = data.id;
  } catch(e) {
    console.warn('[fën] No se pudo obtener ID de MP:', e.message);
  }

  // Agregar ingrediente temporal al formulario con el ID real
  if (tmpNombre) {
    const tbody = document.getElementById('tbody-ingr');
    const tr = document.createElement('tr');
    tr.style.background = '#FFF9C4';
    tr.dataset.mpId = mpId;
    tr.innerHTML = `
      <td>
        <select disabled style="color:#F57C00;font-weight:500" data-mp-id="${mpId}" data-nombre-tmp="${tmpNombre}">
          <option>⏳ ${tmpNombre} (pendiente habilitación)</option>
        </select>
      </td>
      <td><input type="number" placeholder="0" value="${cantidad || ''}" min="0" step="0.01" data-unidad="${unidad}"></td>
      ${App.areaCodigo === 'PAN' ? '<td><input type="number" placeholder="0.00" readonly style="color:var(--txt3)"></td>' : ''}
      <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
    `;
    tbody.appendChild(tr);
  }

  if (btn) desbloquearBtn(btn, '<i class="ti ti-send"></i> Enviar solicitud', true);
  cerrarModalSolicitarMP();

  // Guardar la receta automáticamente para no perder el ingrediente temporal
  await guardarReceta(App._recetaEditandoId || '');
  toast('Solicitud enviada y receta guardada automáticamente');
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
