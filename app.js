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

// Muestra el rendimiento de una receta respetando si es en gramos o en unidades
function formatearRendimiento(r) {
  const cantidad = parseFloat(r.porciones_base) || 0;
  const esGramos = r.porciones_base_unidad === 'g';
  if (esGramos) return `${cantidad.toLocaleString('es-CL')}g`;
  return `${cantidad.toLocaleString('es-CL')} unidad${cantidad !== 1 ? 'es' : ''}`;
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
  await sincronizarConfigDesdeSheet(); // trae la config guardada en el Sheet (ej. capacidad congelador) a localStorage
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
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
  fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' }).catch(() => {});
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
    receta_aprobada: { ico: 'ti-check', color: '#2E7D32', bg: '#E8F5E9' },
    receta_devuelta: { ico: 'ti-alert-triangle', color: '#C62828', bg: '#FFEBEE' },
  };

  const html = avisosPendientes.map(a => {
    const cfg = iconos[a.tipo] || { ico: 'ti-bell', color: '#F57C00', bg: '#FFF8E1' };
    const esUrgente = a.tipo === 'receta_devuelta';
    return `
      <div class="aviso-card" style="background:${cfg.bg};border-color:${cfg.color}${esUrgente?'':'20'};${esUrgente?`border-width:2px;`:''}">
        <i class="ti ${cfg.ico}" style="color:${cfg.color};font-size:16px;flex-shrink:0"></i>
        <span style="flex:1;font-size:13px;color:var(--txt);${esUrgente?'font-weight:500':''}">${a.mensaje}</span>
        <button onclick="marcarAvisoLeido('${a.id}')"
          style="background:none;border:1px solid ${cfg.color}40;border-radius:var(--r-sm);padding:4px 10px;font-size:11px;color:${cfg.color};cursor:pointer;white-space:nowrap;font-family:inherit">
          Entendido
        </button>
      </div>`;
  }).join('');

  contenedores.forEach(c => { c.innerHTML = html; });
}

// ── SINCRONIZAR TODO ──────────────────────────────────────────
// Trae la config de subrecetas guardada en el Sheet (fuente de verdad) hacia
// localStorage — sin esto, un localStorage.clear() (ej. al presionar "sincronizar")
// deja huérfano cualquier valor guardado en el Sheet, porque cargarConfigSubrecetas()
// solo lee de localStorage.
async function sincronizarConfigDesdeSheet() {
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_config', clave: 'subrecetas' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (data.ok && data.valor) {
      localStorage.setItem('fen_config_subrecetas', data.valor);
    }
  } catch(e) {
    // Si falla, seguimos con lo que haya en localStorage (o los valores por defecto)
  }
}

async function sincronizarTodo(btn) {
  const icon = btn.querySelector('i');
  btn.disabled = true;
  icon.style.animation = 'spin .7s linear infinite';
  Cache.invalidarTodo();
  try { localStorage.clear(); } catch(e) {}
  await sincronizarConfigDesdeSheet(); // re-traer la config recién borrada, para no perderla
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
      { id: 'buscar-mp',         icon: 'ti-search',         label: 'Buscar materia prima' },
      { id: 'planificacion',     icon: 'ti-calendar-week',  label: 'Plan semanal'       },
      { id: 'recetas-del-dia', icon: 'ti-flame', label: 'Recetas del día' },
      { id: 'registro-merma',  icon: 'ti-trash', label: 'Registro de merma' },
    ];
    if (App.areaCodigo === 'CAF') items.splice(2, 2);
    // BOL: quitar "recetas-del-dia" (Plan de horneado del día, ya no se usa) y "planificacion"
    // (Plan semanal viejo, reemplazado por Planificación PS/PC y Planificación Masas Base)
    if (App.areaCodigo === 'BOL') {
      const rdIdx = items.findIndex(i => i.id === 'recetas-del-dia');
      if (rdIdx >= 0) items.splice(rdIdx, 1);
      const planIdx = items.findIndex(i => i.id === 'planificacion');
      if (planIdx >= 0) items.splice(planIdx, 1);
      items.splice(2, 0, { id: 'rellenos-otras-recetas', icon: 'ti-egg', label: 'Recetas del día' });
      items.splice(2, 0, { id: 'plan-ps-pc', icon: 'ti-layout-grid', label: 'Planificación PS/PC' });
      items.splice(3, 0, { id: 'plan-masa-base', icon: 'ti-bread', label: 'Planificación Masas Base' });
      items.splice(4, 0, { id: 'plan-productos-congelados', icon: 'ti-snowflake', label: 'Productos Congelados' });
    }
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL') {
      items.push({ id: 'resumen-semanal',     icon: 'ti-chart-grid-dots', label: 'Resumen semanal' });
      items.push({ id: 'consolidado-mensual', icon: 'ti-calendar-stats',  label: 'Consolidado mensual' });
    }

    if (App.areaCodigo === 'CAF') {
      items.push({ id: 'registros-caf', icon: 'ti-clipboard-list', label: 'Bitácora de turno' });
    }
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL' || App.areaCodigo === 'CAF') {
      items.push({ id: 'config-subrecetas',   icon: 'ti-adjustments',     label: App.areaCodigo === 'CAF' ? 'Configuración' : 'Config sub recetas' });
    }
    items.forEach(item => nav.appendChild(crearNavItem(item)));
  } else {
    const grupos = [
      { id: 'flujo-diario', label: 'Flujo diario', icon: 'ti-list-check', items: [
        { id: 'aprobaciones',    icon: 'ti-check-circle', label: 'Aprobaciones' },
        { id: 'materias-primas', icon: 'ti-list',         label: 'Materias primas' },
      ]},
      { id: 'catalogo', label: 'Catálogo', icon: 'ti-books', items: [
        { id: 'maestro-admin',     icon: 'ti-book',           label: 'Maestro de recetas' },
        { id: 'productos-reventa', icon: 'ti-shopping-cart',  label: 'Productos de reventa' },
      ]},
      { id: 'costeo', label: 'Costeo (Fase 2)', icon: 'ti-settings-dollar', items: [
        { id: 'config-costeo',    icon: 'ti-settings-dollar', label: 'Config de costeo' },
        { id: 'costos',           icon: 'ti-chart-bar',       label: 'Estructuras de costo' },
        { id: 'auditoria-costos', icon: 'ti-shield-check',    label: 'Auditoría de costos' },
        { id: 'inversiones',      icon: 'ti-building-bank',   label: 'Inversiones' },
        { id: 'rentabilidad-real', icon: 'ti-scale',          label: 'Rentabilidad real' },
      ]},
      { id: 'analisis', label: 'Análisis y reportes', icon: 'ti-chart-bar', items: [
        { id: 'estimacion-bol',    icon: 'ti-chart-arrows-vertical', label: 'Estimación de demanda' },
        { id: 'analisis-merma',    icon: 'ti-trash',                 label: 'Análisis de $ merma' },
        { id: 'ventas-mensuales',  icon: 'ti-report-money',          label: 'Ventas mensuales (B2B/B2C)' },
      ]},
      { id: 'configuracion', label: 'Configuración', icon: 'ti-adjustments', items: [
        { id: 'correos-contacto', icon: 'ti-mail', label: 'Correos de contacto' },
      ]},
    ];

    // Recordar qué grupos están abiertos entre renders — por defecto, abrir el
    // grupo que contiene la vista actual (para que no se sienta "perdida" al entrar)
    if (!App._gruposAbiertos) {
      App._gruposAbiertos = {};
      const grupoConVistaActual = grupos.find(g => g.items.some(it => it.id === App.vistaActual));
      App._gruposAbiertos[(grupoConVistaActual || grupos[0]).id] = true;
    }

    grupos.forEach(grupo => {
      const abierto = !!App._gruposAbiertos[grupo.id];
      const header = document.createElement('button');
      header.className = 'nav-grupo-header';
      header.style.cssText = 'display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;background:none;border:none;cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--txt3)';
      header.innerHTML = `<i class="ti ${grupo.icon}"></i> <span style="flex:1;text-align:left">${grupo.label}</span> <i class="ti ${abierto ? 'ti-chevron-down' : 'ti-chevron-right'}" style="font-size:14px"></i>`;
      header.onclick = () => {
        App._gruposAbiertos[grupo.id] = !App._gruposAbiertos[grupo.id];
        renderSidebar();
      };
      nav.appendChild(header);

      if (abierto) {
        const cont = document.createElement('div');
        cont.style.cssText = 'padding-left:6px;margin-bottom:6px';
        grupo.items.forEach(item => cont.appendChild(crearNavItem(item)));
        nav.appendChild(cont);
      }
    });

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

  // Si el ítem pertenece a un grupo de Admin que está cerrado, abrirlo — así el
  // sidebar siempre queda coherente con la vista actual, sin importar si la
  // navegación vino de un clic en el menú o de otro botón dentro de la app.
  if (App.rol === 'admin' && App._gruposAbiertos) {
    const gruposAdmin = [
      { id: 'flujo-diario', items: ['aprobaciones','materias-primas'] },
      { id: 'catalogo', items: ['maestro-admin','productos-reventa'] },
      { id: 'costeo', items: ['config-costeo','costos','auditoria-costos','inversiones','rentabilidad-real'] },
      { id: 'analisis', items: ['estimacion-bol','analisis-merma','ventas-mensuales'] },
      { id: 'configuracion', items: ['correos-contacto'] },
    ];
    const grupo = gruposAdmin.find(g => g.items.includes(vistaId));
    if (grupo && !App._gruposAbiertos[grupo.id]) {
      App._gruposAbiertos[grupo.id] = true;
      renderSidebar();
    }
  }

  actualizarNavActivo(vistaId);
  document.querySelectorAll('.vista').forEach(v => v.classList.remove('active'));
  switch(vistaId) {
    case 'nueva-receta':    renderVistaFormReceta(null, 'receta'); break;
    case 'mis-recetas':     renderVistaMisRecetas(); cargarAvisos(); break;
    case 'buscar-mp':       mostrarVista('empty'); abrirBuscarMP(null, null); break;
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
    case 'registro-merma':      renderVistaRegistroMerma();   break;
    case 'pre-elaboraciones':   renderVistaPreElaboraciones(); break;
    case 'rellenos-otras-recetas': renderVistaRellenosOtrasRecetas(); break;
    case 'plan-ps-pc':          renderVistaPlanPSPC(); break;
    case 'plan-masa-base':      renderVistaPlanMasaBase(); break;
    case 'plan-productos-congelados': renderVistaPlanProductosCongelados(); break;
    case 'estimacion-bol':      renderVistaEstimacionDemanda();  break;
    case 'analisis-merma':      renderVistaAnalisisMerma();  break;
    case 'auditoria-costos':    renderVistaAuditoriaCostos(); break;
    case 'inversiones':         renderVistaInversiones(); break;
    case 'rentabilidad-real':   renderVistaRentabilidadReal(); break;
    case 'config-costeo':       renderVistaConfigCosteo();   break;
    case 'correos-contacto':    renderVistaCorreosContacto(); break;
    case 'productos-reventa':   renderVistaProductosReventa(); break;
    case 'ventas-mensuales':    renderVistaVentasMensuales(); break;
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

let _cargandoRecetasAdmin = null; // evita disparar el mismo pedido en paralelo si se llama 2+ veces seguidas

async function cargarRecetas(forzar = false) {
  if (!App.areaCodigo) {
    if (_cargandoRecetasAdmin) { await _cargandoRecetasAdmin; return; } // ya hay una carga en curso, esperarla en vez de duplicarla
    _cargandoRecetasAdmin = (async () => {
      const todas = [];
      for (const codigo of Object.keys(FEN.AREAS)) {
        const hoja = FEN.AREAS[codigo].hoja_recetas;
        const r = forzar
          ? await leerHoja(hoja)
          : await Cache.get(hoja, () => leerHoja(hoja));
        r.forEach(rec => rec._area = codigo);
        todas.push(...r);
      }
      App.recetas = todas;
    })();
    await _cargandoRecetasAdmin;
    _cargandoRecetasAdmin = null;
  } else {
    const hoja = FEN.AREAS[App.areaCodigo].hoja_recetas;
    const datos = forzar
      ? await leerHoja(hoja)
      : await Cache.get(hoja, () => leerHoja(hoja));
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

  // Fallback: localStorage (mismo dispositivo). Si tampoco hay nada ahí, vaciar
  // explícitamente — antes se dejaba lo que hubiera quedado en memoria de una
  // carga anterior, y el aviso de "copiar semana pasada" nunca aparecía.
  try {
    const local = localStorage.getItem(claveLS);
    App.planSemana = local ? JSON.parse(local) : {};
  } catch(e) {
    App.planSemana = {};
  }
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
    // Pasos: se leen de su propio campo pasos_JSON. Si una receta vieja no lo tiene
    // (guardada antes de este cambio), se reconstruye una vez desde la descripción,
    // partiendo por puntos — solo como respaldo para no perder recetas antiguas.
    try {
      const pasosGuardados = JSON.parse(receta.pasos_JSON || '[]');
      pasos = pasosGuardados.length ? pasosGuardados
        : (receta.observaciones_procedimiento || '').split('.').filter(s => s.trim());
    } catch(e) {
      pasos = (receta.observaciones_procedimiento || '').split('.').filter(s => s.trim());
    }
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
          <label>Rendimiento <span class="req">*</span></label>
          <div style="display:flex;gap:8px">
            <input type="number" id="f-porciones" placeholder="Ej: 12, 190" min="1" step="0.1" style="flex:1" value="${receta?.porciones_base || ''}">
            <select id="f-porciones-unidad" style="max-width:110px;padding:8px 10px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
              <option value="un" ${(receta?.porciones_base_unidad || 'un') === 'un' ? 'selected' : ''}>unidades</option>
              <option value="g" ${receta?.porciones_base_unidad === 'g' ? 'selected' : ''}>gramos</option>
            </select>
          </div>
          <p style="font-size:11px;color:var(--txt3);margin-top:4px">
            Use <strong>unidades</strong> si el lote rinde piezas contables (ej: 12 marraquetas, 1 hogaza).
            Use <strong>gramos</strong> si se consume en porciones variables de un lote (ej: 190g de masa madre).
          </p>
        </div>
        <div class="campo">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="f-vende-directo"
              ${receta?.vende_directo === 'no' ? '' : (receta?.vende_directo === 'si' || tipoActual !== 'sub_receta') ? 'checked' : ''}
              style="width:auto">
            Se vende directo al cliente (aparece en el listado para B2B/B2C)
          </label>
          <p style="font-size:11px;color:var(--txt3);margin-top:2px">
            Marcado por defecto en recetas normales, desmarcado en sub-recetas — pero puede cambiarlo.
            Útil para casos como el Espresso: es ingrediente de otras bebidas <strong>y</strong> también se vende solo.
          </p>
        </div>
        ${App.areaCodigo === 'BOL' ? `
        <div class="campo">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="f-se-congela"
              ${receta?.se_congela === 'si' ? 'checked' : ''}
              style="width:auto">
            Se congela ya terminado/horneado (participa en Planificación de Productos Congelados)
          </label>
          <p style="font-size:11px;color:var(--txt3);margin-top:2px">
            No todos los productos se congelan — marque solo los que sí, para que aparezcan en esa pantalla.
          </p>
        </div>` : ''}
        <div class="campo">
          <label>¿Es una variante interna de otro producto?</label>
          <select id="f-variante-de" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
            <option value="">— No, es un producto propio —</option>
            ${App.recetas
              .filter(r => r.estado === 'consolidada' && r.tipo_receta !== 'sub_receta' && r.ID_receta !== receta?.ID_receta)
              .map(r => `<option value="${r.ID_receta}" ${receta?.variante_de_id === r.ID_receta ? 'selected' : ''}>${r.nombre}</option>`)
              .join('')}
          </select>
          <p style="font-size:11px;color:var(--txt3);margin-top:4px">
            Ej: "Hogaza clásica 48 horas" es la misma "Hogaza clásica" para el cliente, solo que con una receta
            distinta para sábado/feriados — elíjala acá para que no aparezca duplicada en el listado de B2B/B2C.
          </p>
        </div>
        ${(App.areaCodigo === 'BOL' || App.areaCodigo === 'PAN') ? `
        <div class="campo">
          <label>Clasificación</label>
          <select id="f-tipo-preparacion" onchange="toggleCampoPesoMB(this)" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
            <option value="" ${!receta?.tipo_preparacion?'selected':''}>⚠️ Sin clasificar aún</option>
            <optgroup label="Productos terminados">
              <option value="producto_simple" ${receta?.tipo_preparacion==='producto_simple'?'selected':''}>Producto Simple (base + ingredientes sueltos, sin sub-receta)</option>
              <option value="producto_compuesto" ${receta?.tipo_preparacion==='producto_compuesto'?'selected':''}>Producto Compuesto (base + relleno u otra sub-receta)</option>
            </optgroup>
            <optgroup label="Preparaciones internas">
              <option value="masa_base" ${receta?.tipo_preparacion==='masa_base'?'selected':''}>Masa Base (laminado, congelación, escalado por peso)</option>
              <option value="relleno" ${receta?.tipo_preparacion==='relleno'?'selected':''}>Relleno / preparación (se planifica en Recetas del día, sugerencia + ajuste libre)</option>
            </optgroup>
          </select>
          <p style="font-size:11px;color:var(--txt3);margin-top:4px">
            Define qué tipo de planificación aplica: <strong>Producto Simple/Compuesto</strong> van a la grilla de planificación semanal;
            <strong>Masa Base</strong> tiene su propia planificación de tandas y stock congelado; <strong>Relleno/preparación</strong> aparece en <strong>Recetas del día</strong>.
          </p>
        </div>
        <div class="campo ${receta?.tipo_preparacion==='masa_base'?'':'hidden'}" id="campo-peso-unidad-mb">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="f-planificable-directo" ${receta?.planificable_directo === false || receta?.planificable_directo === 'no' ? '' : 'checked'} style="width:auto">
            Aparece en la grilla de "Planificación Masas Base"
          </label>
          <p style="font-size:11px;color:var(--txt3);margin-top:2px;margin-bottom:10px">
            Desmárquelo para componentes internos como Empaste o Poolish, que no se planifican por su cuenta —
            solo la Masa Base propiamente tal (ej. Masa Base Pastón) debería aparecer ahí.
          </p>
          <label>Peso por unidad (g) <span style="color:var(--txt3);font-weight:400;font-size:10px">— versatilidad de rendimiento</span></label>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="number" id="f-peso-unidad-mb" min="1" step="1" style="max-width:140px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm)"
              value="${receta?.peso_unidad_mb_g || ''}" placeholder="Ej: 1500">
            <button type="button" class="btn-secundario" style="font-size:12px;padding:8px 12px" onclick="recalcularRecetaPorPeso()">
              <i class="ti ti-refresh"></i> Recalcular ingredientes a este peso
            </button>
          </div>
          <p style="font-size:11px;color:var(--txt3);margin-top:4px">
            Si cambia este valor (ej. de 1.500g a 1.250g), presione "Recalcular" para que todos los ingredientes se ajusten
            proporcionalmente antes de guardar — la receta base no se toca hasta que confirme.
          </p>
        </div>` : ''}
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
        ${(receta?.porciones_base_unidad || 'un') !== 'g' ? `
        <div class="campo">
          <label>Peso por pieza cruda (g) <span style="color:var(--txt3);font-weight:400;font-size:10px">— calculado</span></label>
          <input type="number" id="f-peso-crudo" placeholder="Auto" readonly
            style="color:var(--txt3);background:var(--bg)"
            value="${receta?.ingredientes_JSON ? (() => { try { const ings = JSON.parse(receta.ingredientes_JSON); const total = ings.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0); return (total/(parseInt(receta.porciones_base)||1)).toFixed(1); } catch(e) { return ''; } })() : ''}">
        </div>` : ''}
        ${App.areaCodigo === 'BOL' ? `
        <div class="campo">
          <label>% Merma</label>
          <input type="number" id="f-merma-laminado" placeholder="Ej: 8" min="0" max="30" step="0.1"
            value="${receta?.merma_laminado_pct !== undefined && receta?.merma_laminado_pct !== '' ? receta.merma_laminado_pct : (esEdicion ? 0 : 8)}">
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

    <button type="button" class="btn-secundario" style="width:100%;margin-bottom:16px;padding:10px" onclick="abrirBuscarMP(null,null)">
      <i class="ti ti-search"></i> ¿Ya existe la materia prima que necesito? Buscar antes de agregar ingredientes
    </button>

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
      <div id="total-ingredientes-preview" style="padding:8px 16px;border-top:1px solid var(--border);text-align:right;font-size:12px;color:var(--txt2)">
        Total: <strong style="font-family:'DM Mono',monospace">0g</strong>
      </div>
    </div>

    ${tipoActual === 'sub_receta' ? '' : `
    <div class="card" style="margin-bottom:16px">
      <div class="card-head">
        <i class="ti ti-package"></i> Insumos
        <span style="font-size:11px;color:var(--txt3);font-weight:400;margin-left:8px">envases, etiquetas, packaging...</span>
        <button class="btn-agregar-fila" onclick="agregarInsumo()" style="margin-left:auto">
          <i class="ti ti-plus"></i> Agregar
        </button>
      </div>
      <div class="tabla-wrap">
        <table class="tabla-ingr">
          <thead>
            <tr>
              <th style="min-width:200px">Insumo</th>
              <th>Cantidad por unidad</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="tbody-insumos"></tbody>
        </table>
      </div>
    </div>`}

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

  const insumos = (() => { try { return JSON.parse(receta?.insumos_JSON || '[]'); } catch(e) { return []; } })();
  if (insumos.length > 0) insumos.forEach(ins => {
    if (ins.pendiente || ins.id === '__pendiente__') {
      agregarInsumoTemporal(ins);
    } else {
      agregarInsumo(ins);
    }
  });

  if (pasos.length > 0) pasos.forEach(p => agregarPaso(typeof p === 'string' ? p : ''));
  else { agregarPaso(); agregarPaso(); }

  actualizarTotalIngredientesPreview();
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


// ── INSUMOS (envases, etiquetas, packaging, etc.) ─────────────
function agregarInsumoTemporal(data) {
  const tbody = document.getElementById('tbody-insumos');
  if (!tbody) return;
  const tr = document.createElement('tr');
  const cantidad = data.unidades || data.gramos || '';

  // Igual que MP: usar el campo persistente del Sheet, no adivinar
  const insId = data.id || '__pendiente__';
  const insActual = App.materiasPrimas.find(m => m.ID_MP === insId);
  let nombreAsignado = null;
  let idAsignado = null;

  const insAprobado = insActual && insActual.estado === 'activa';

  if (insActual && insActual.estado === 'reemplazada' && insActual.reemplazada_por) {
    const insFound = App.materiasPrimas.find(m => m.ID_MP === insActual.reemplazada_por);
    if (insFound) { idAsignado = insFound.ID_MP; nombreAsignado = insFound.nombre; }
  }

  const bgColor = idAsignado || insAprobado ? '#E8F5E9' : '#FFF9C4';
  const textColor = idAsignado || insAprobado ? '#2E7D32' : '#F57C00';
  const icono = idAsignado || insAprobado ? '✓' : '⏳';

  let labelText = `${icono} ${data.nombre}`;
  if (idAsignado) labelText += ` → reemplazar por: ${nombreAsignado}`;
  else if (insAprobado) labelText += ` (aprobado — ya disponible)`;
  else labelText += ` (pendiente habilitación)`;

  tr.style.background = bgColor;
  tr.innerHTML = `
    <td style="min-width:200px">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <select disabled style="color:${textColor};font-weight:500;flex:1" data-mp-id="${insId}" data-nombre-tmp="${data.nombre}">
          <option>${labelText}</option>
        </select>
        ${(idAsignado || insAprobado) ? `
        <button onclick="reemplazarInsumoTemporal(this,'${idAsignado || insId}','${(nombreAsignado || data.nombre).replace(/'/g,"\'")}','${insId}')"
          style="background:#2E7D32;color:#fff;border:none;padding:4px 10px;border-radius:var(--r-sm);font-size:12px;cursor:pointer;white-space:nowrap">
          <i class="ti ti-replace"></i> Reemplazar
        </button>` : ''}
      </div>
    </td>
    <td><input type="number" placeholder="1" value="${cantidad || ''}" min="0" step="1" data-unidad="unidades"></td>
    <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(tr);
}

async function reemplazarInsumoTemporal(btn, insIdNuevo, nombreNuevo, insIdViejo) {
  const tr = btn.closest('tr');
  const inputs = tr.querySelectorAll('input[type="number"]');
  const cantidad = parseFloat(inputs[0]?.value) || 0;

  tr.remove();

  const data = { id: insIdNuevo, nombre: nombreNuevo, unidades: cantidad, pendiente: false };
  agregarInsumo(data);

  await guardarReceta(App._recetaEditandoId || '');
  toast(`Reemplazado por ${nombreNuevo} y receta guardada`);
}

function agregarInsumo(data = {}) {
  const tbody = document.getElementById('tbody-insumos');
  if (!tbody) return;
  const tr = document.createElement('tr');
  const areaCode = App.areaCodigo || '';
  const insumosActivos = App.materiasPrimas.filter(m =>
    m.estado === 'activa' && m.tipo === 'insumo' &&
    (!m.areas_habilitadas || m.areas_habilitadas.split(',').map(a=>a.trim()).includes(areaCode))
  ).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'));

  const options = insumosActivos.map(m =>
    `<option value="${m.ID_MP}" data-costo="${m.costo_por_gramo || 0}"
      ${m.ID_MP === data.id ? 'selected' : ''}>${m.nombre}</option>`
  ).join('');

  tr.innerHTML = `
    <td>
      <select onchange="onChangeInsumoSelect(this)">
        <option value="">— Seleccionar —</option>
        ${options}
        <option value="__nuevo__">+ Solicitar / habilitar insumo...</option>
      </select>
    </td>
    <td><input type="number" placeholder="1"
      value="${data.unidades !== undefined && data.unidades !== null ? data.unidades : ''}"
      min="0" step="1" data-unidad="unidades">
    </td>
    <td><button class="btn-fila-del" onclick="this.closest('tr').remove()"
      aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(tr);
}

function onChangeInsumoSelect(sel) {
  if (sel.value === '__nuevo__') { abrirBuscarMP(sel, 'insumo'); sel.value = ''; return; }
}

function solicitarNuevoInsumo() {
  const modal = document.getElementById('modal-solicitar-insumo');
  if (modal) modal.classList.remove('hidden');
}

function cerrarModalSolicitarInsumo() {
  const modal = document.getElementById('modal-solicitar-insumo');
  if (modal) modal.classList.add('hidden');
  const selects = document.querySelectorAll('#tbody-insumos select');
  selects.forEach(s => { if (s.value === '__nuevo__') s.value = ''; });
}

async function enviarSolicitudInsumo(btn) {
  if (btn) bloquearBtn(btn, 'Enviando...');
  const nombre    = document.getElementById('solicitar-insumo-nombre').value.trim();
  const tmpNombre = document.getElementById('solicitar-insumo-tmp').value.trim() || nombre;
  const cantidad  = document.getElementById('solicitar-insumo-cantidad').value;

  if (!nombre) { toast('Escribe el nombre del insumo', 'error'); return; }

  const areaNombre = App.area?.nombre || (App.areaCodigo ? FEN.AREAS[App.areaCodigo]?.nombre : '') || '';
  let insId = '__pendiente__';
  try {
    const recetaNombre = document.getElementById('f-nombre')?.value?.trim() || 'Receta sin nombre';
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'solicitar_mp',
      tipo: 'insumo',
      nombre,
      es_nueva: true,
      solicitada_por: areaNombre,
      area_codigo: App.areaCodigo || '',
      categoría: 'Insumos',
      unidad_receta: 'unidades',
      receta_nombre: recetaNombre,
      fecha: new Date().toISOString()
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (data.ok && data.id) insId = data.id;
  } catch(e) {
    console.warn('[fën] No se pudo obtener ID de insumo:', e.message);
  }

  if (tmpNombre) {
    const tbody = document.getElementById('tbody-insumos');
    const tr = document.createElement('tr');
    tr.style.background = '#FFF9C4';
    tr.dataset.mpId = insId;
    tr.innerHTML = `
      <td>
        <select disabled style="color:#F57C00;font-weight:500" data-mp-id="${insId}" data-nombre-tmp="${tmpNombre}">
          <option>⏳ ${tmpNombre} (pendiente habilitación)</option>
        </select>
      </td>
      <td><input type="number" placeholder="1" value="${cantidad || ''}" min="0" step="1" data-unidad="unidades"></td>
      <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
    `;
    tbody.appendChild(tr);
  }

  if (btn) desbloquearBtn(btn, '<i class="ti ti-send"></i> Enviar solicitud', true);
  cerrarModalSolicitarInsumo();

  await guardarReceta(App._recetaEditandoId || '');
  toast('Solicitud de insumo enviada y receta guardada automáticamente');
}


function agregarIngrediente(data = {}) {
  const esPan = App.areaCodigo === 'PAN';
  const tbody = document.getElementById('tbody-ingr');
  const tr = document.createElement('tr');
  const areaCode = App.areaCodigo || '';
  const mpActivas  = App.materiasPrimas.filter(m =>
    m.estado === 'activa' && m.tipo !== 'sub_receta' &&
    (!m.areas_habilitadas || m.areas_habilitadas.split(',').map(a=>a.trim()).includes(areaCode))
  ).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'));
  const subRecetas = App.materiasPrimas.filter(m =>
    m.estado === 'activa' && m.tipo === 'sub_receta' &&
    (!m.areas_habilitadas || m.areas_habilitadas.split(',').map(a=>a.trim()).includes(areaCode))
  ).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'));

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
  // El selector de Gramos/Unidades aplica a BOL y PAN — ambas áreas usan sub-recetas
  // de masa compartida (ej. Masa Ciabatta usada en Ciabatta y Focaccia a la vez).
  const permiteUnidadesIngrediente = esBOL || esPan;
  // Para BOL/PAN, detectar si el ingrediente es sub receta (puede ser en unidades)
  const esSubRecetaIngr = data.id && (subRecetas.some(sr => sr.ID_MP === data.id));
  // También considerar unidad_receta explícita (para MPs solicitadas con unidad específica)
  const usaUnidades = (permiteUnidadesIngrediente && esSubRecetaIngr && (data.unidades !== undefined ? data.unidades : true))
    || (data.unidad_receta === 'unidades');
  const usaMl = data.unidad_receta === 'ml';

  const idCoincideConOpcion = !data.id || mpActivas.some(m => m.ID_MP === data.id) || subRecetas.some(m => m.ID_MP === data.id);

  tr.innerHTML = `
    <td>
      <select onchange="onChangeIngredienteSelect(this)">
        <option value="">— Seleccionar —</option>
        ${options}
        <option value="__nueva__">+ Solicitar / habilitar MP...</option>
      </select>
      ${data.id ? `<div style="font-size:9px;color:${idCoincideConOpcion ? 'var(--txt3)' : '#C62828'};font-family:'DM Mono',monospace;margin-top:2px">
        ${data.id}${!idCoincideConOpcion ? ' ⚠ no coincide con ninguna opción activa — revise si hay MP duplicadas' : ''}
      </div>` : ''}
    </td>
    ${permiteUnidadesIngrediente ? `
    <td>
      <select class="sel-unidad-tipo" onchange="toggleUnidadTipo(this)" style="font-size:11px;padding:3px 6px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit">
        <option value="gramos" ${!usaUnidades?'selected':''}>Gramos</option>
        <option value="unidades" ${usaUnidades?'selected':''}>Unidades</option>
      </select>
    </td>` : ''}
    <td style="display:flex;gap:4px;align-items:center">
      <input type="number" placeholder="${usaUnidades?'1':'0'}"
      value="${usaUnidades ? (data.unidades||'') : usaMl ? (data.ml||data.gramos||'') : (data.gramos ? parseFloat(data.gramos).toFixed(1) : '')}"
      min="0" step="${usaUnidades?'0.001':'0.01'}"
      oninput="${esPan && !usaUnidades ? 'desdeGramos(this)' : 'actualizarTotalIngredientesPreview()'}"
      style="max-width:90px"
      data-modo="${usaUnidades ? 'unidades' : usaMl ? 'ml' : 'gramos'}"
      data-unidad="${data.unidad_receta || (usaUnidades ? 'unidades' : 'gramos')}">
      ${permiteUnidadesIngrediente && esSubRecetaIngr ? `<button type="button" class="btn-secundario" style="font-size:11px;padding:4px 6px" title="Calcular fracción (ej: 1 de cada 12)" onclick="calcularFraccionIngrediente(this)"><i class="ti ti-calculator"></i></button>` : ''}
    </td>
    ${esPan ? `<td><input type="number" placeholder="0.00"
      value="${data.pct ? (data.pct*100).toFixed(2) : ''}"
      step="0.01" style="max-width:70px;color:var(--area-color);font-weight:500"
      oninput="desdePct(this)" title="% relativo al peso de harina"></td>` : ''}
    <td><button class="btn-fila-del" onclick="this.closest('tr').remove();actualizarTotalIngredientesPreview();"
      aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(tr);
  actualizarTotalIngredientesPreview();
}

function calcularCostoFila(el) {
  const tr = el.closest('tr');
  const select = tr.querySelector('select');
  if (select.value === '__nueva__') { abrirBuscarMP(select, 'ingrediente'); select.value = ''; return; }
}

// Calcula y muestra el total de gramos de la tabla de ingredientes, convirtiendo
// sub-recetas agregadas en "Unidades" a su peso equivalente (solo para mostrar,
// igual que se hace al guardar — no afecta el costo).
let _calcInputTarget = null;
let _calcExpresion = '';

function calcularFraccionIngrediente(btn) {
  const tr = btn.closest('tr');
  const input = tr.querySelector('input[type="number"]');
  if (!input) return;
  _calcInputTarget = input;
  _calcExpresion = '';
  document.getElementById('calc-display').value = '0';
  document.getElementById('modal-calculadora').classList.remove('hidden');
}

function calcInput(val) {
  const esOperador = ['+','-','*','/'].includes(val);
  if (_calcExpresion === '0' && !esOperador && val !== '.') _calcExpresion = '';
  _calcExpresion += val;
  document.getElementById('calc-display').value = _calcExpresion;
}

function calcClear() {
  _calcExpresion = '';
  document.getElementById('calc-display').value = '0';
}

function calcBorrarUltimo() {
  _calcExpresion = _calcExpresion.slice(0, -1);
  document.getElementById('calc-display').value = _calcExpresion || '0';
}

function calcEquals() {
  const display = document.getElementById('calc-display');
  try {
    // Solo dígitos, operadores básicos, puntos, paréntesis y espacios — nunca eval libre
    if (!_calcExpresion || !/^[0-9+\-*/(). ]+$/.test(_calcExpresion)) throw new Error('vacío o inválido');
    const resultado = Function('"use strict"; return (' + _calcExpresion + ')')();
    if (!isFinite(resultado)) throw new Error('resultado inválido');
    _calcExpresion = String(Math.round(resultado * 10000) / 10000); // hasta 4 decimales
    display.value = _calcExpresion;
  } catch(e) {
    display.value = 'Error';
    _calcExpresion = '';
  }
}

function calcAplicar() {
  const valor = parseFloat(_calcExpresion);
  if (isNaN(valor)) { toast('Calcule un resultado primero (presione =)', 'error'); return; }
  if (_calcInputTarget) {
    _calcInputTarget.value = valor.toFixed(4);
    actualizarTotalIngredientesPreview();
    toast(`Valor aplicado: ${valor.toFixed(4)}`);
  }
  cerrarModalCalculadora();
}

function cerrarModalCalculadora() {
  document.getElementById('modal-calculadora').classList.add('hidden');
  _calcInputTarget = null;
}

function actualizarTotalIngredientesPreview() {
  const el = document.getElementById('total-ingredientes-preview');
  if (!el) return;
  let total = 0;
  let hayUnidadesSinConvertir = false;

  document.querySelectorAll('#tbody-ingr tr').forEach(tr => {
    const select = tr.querySelector('select');
    const inputs = tr.querySelectorAll('input[type="number"]');
    if (!select || select.disabled) return; // filas pendientes: no se pueden convertir a peso aún
    if (!select.value || select.value === '__nueva__') return;

    const opcion = select.options[select.selectedIndex];
    const tipoSel = tr.querySelector('.sel-unidad-tipo');
    const modoInput = tipoSel ? tipoSel.value : (tr.querySelector('input[type="number"]')?.dataset.modo || 'gramos');
    const valorInput = parseFloat(inputs[0]?.value) || 0;

    if (modoInput === 'unidades' && valorInput > 0) {
      const nombreSR = opcion.text.replace('⟳ ', '');
      const srReceta = App.recetas?.find(r => r.nombre === nombreSR && r.estado === 'consolidada');
      if (srReceta) {
        let ingsR = [];
        try { ingsR = JSON.parse(srReceta.ingredientes_JSON || '[]'); } catch(e) {}
        const pesoUnitario = ingsR.reduce((s,i) => s+(parseFloat(i.gramos)||0), 0);
        total += pesoUnitario * valorInput;
      } else {
        hayUnidadesSinConvertir = true;
      }
    } else if (modoInput !== 'unidades') {
      total += valorInput;
    }
  });

  const nota = hayUnidadesSinConvertir ? ' <span style="color:var(--txt3)">(algunas unidades sin peso de referencia)</span>' : '';
  el.innerHTML = `Total: <strong style="font-family:'DM Mono',monospace">${total.toLocaleString('es-CL', {maximumFractionDigits:1})}g</strong>${nota}`;
}

function onChangeIngredienteSelect(sel) {
  if (sel.value === '__nueva__') { abrirBuscarMP(sel, 'ingrediente'); sel.value = ''; return; }
  // Auto-switch a Unidades si es sub-receta — aplica a BOL y PAN, ambas usan
  // sub-recetas de masa compartida (ej. Masa Ciabatta en Ciabatta y Focaccia).
  const esSR = App.materiasPrimas.find(m => m.ID_MP === sel.value && (m.tipo === 'sub_receta' || m.ID_MP?.startsWith('SR')));
  if (App.areaCodigo === 'BOL' || App.areaCodigo === 'PAN') {
    const tipoSel = sel.closest('tr').querySelector('.sel-unidad-tipo');
    if (tipoSel && esSR) tipoSel.value = 'unidades';
    else if (tipoSel) tipoSel.value = 'gramos';
    if (tipoSel) toggleUnidadTipo(tipoSel);
  }
  // desdeGramos (cálculo de % panadero desde gramos) solo aplica en modo gramos —
  // no tiene sentido para una sub-receta en modo Unidades.
  if (App.areaCodigo === 'PAN' && !esSR) desdeGramos(sel.closest('tr').querySelector('input[type="number"]'));
  actualizarTotalIngredientesPreview();
}

function toggleCampoPesoMB(sel) {
  const campo = document.getElementById('campo-peso-unidad-mb');
  if (!campo) return;
  campo.classList.toggle('hidden', sel.value !== 'masa_base');
}

// Escala todos los ingredientes de la receta (ya en el formulario) para que el
// total coincida con: porciones_base × peso_por_unidad configurado. No guarda
// nada todavía — solo actualiza los campos en pantalla, el usuario revisa y
// presiona Guardar cuando esté conforme.
function recalcularRecetaPorPeso() {
  const unidadRendimiento = document.getElementById('f-porciones-unidad')?.value;
  if (unidadRendimiento === 'g') {
    alert(
      '⚠️ No se puede recalcular todavía\n\n' +
      'El campo "Rendimiento" está configurado en GRAMOS, y "Peso por unidad" espera que el Rendimiento sea en UNIDADES.\n\n' +
      'Son dos formas distintas de definir el peso — no se pueden combinar.\n\n' +
      'Qué hacer: suba hasta el campo "Rendimiento" (arriba del formulario), cambie el número a 1 y la unidad a "unidades", y vuelva a intentar.'
    );
    return;
  }

  const pesoUnidad = parseFloat(document.getElementById('f-peso-unidad-mb')?.value) || 0;
  const porciones = parseFloat(document.getElementById('f-porciones')?.value) || 0;
  if (!pesoUnidad || !porciones) { toast('Complete "Rendimiento" y "Peso por unidad" primero', 'error'); return; }

  const totalObjetivo = pesoUnidad * porciones;
  let totalActual = 0;
  const inputs = [];
  document.querySelectorAll('#tbody-ingr tr').forEach(tr => {
    const input = tr.querySelector('input[type="number"]');
    const modo = input?.dataset.modo;
    if (!input || modo === 'unidades') return; // no escalar sub-recetas usadas "por unidad completa"
    const val = parseFloat(input.value) || 0;
    totalActual += val;
    inputs.push(input);
  });

  if (!totalActual) { toast('No hay ingredientes en gramos para escalar', 'error'); return; }

  const factorPreview = totalObjetivo / totalActual;
  if (factorPreview > 5 || factorPreview < 0.2) {
    if (!confirm(`Esto va a multiplicar los ingredientes ×${factorPreview.toFixed(2)} (de ${totalActual.toLocaleString('es-CL')}g a ${totalObjetivo.toLocaleString('es-CL')}g). ¿Es correcto? Revise "Rendimiento" y "Peso por unidad" si no esperaba un cambio tan grande.`)) return;
  }

  const factor = totalObjetivo / totalActual;
  inputs.forEach(input => {
    const nuevoValor = (parseFloat(input.value) || 0) * factor;
    input.value = nuevoValor.toFixed(1);
  });

  actualizarTotalIngredientesPreview();
  toast(`Ingredientes escalados ×${factor.toFixed(3)} — total nuevo: ${totalObjetivo.toLocaleString('es-CL')}g. Revise y guarde.`);
}

function toggleUnidadTipo(sel) {
  if (!sel) return;
  const tr = sel.closest('tr');
  const input = tr.querySelector('input[data-modo]');
  if (!input) return;
  const modo = sel.value;

  // "Unidades" tiene dos usos válidos: (1) sub-recetas (ej. "1 unidad de Masa
  // Ciabatta" — el caso para el que se diseñó originalmente, siempre permitido),
  // y (2) MP que se compran contables (ej. "180un" — huevos). Para MP que se
  // compran por peso/volumen (kg, g, lt, ml), el costo guardado es un valor real
  // por gramo — mezclarlo con "Unidades" no tiene conversión correcta, así que
  // queda bloqueado. Si de verdad necesita esa MP medida por peso (ej. "Huevo kg"
  // en vez de por unidad), se soluciona creando una MP nueva con esa unidad de
  // compra — no forzando esta.
  if (modo === 'unidades') {
    const mpSelect = tr.querySelector('select');
    const mpId = mpSelect?.value;
    const mp = mpId ? App.materiasPrimas.find(m => m.ID_MP === mpId) : null;
    if (mp && mp.tipo !== 'sub_receta') {
      const unidadCompra = (mp.unidad_compra || 'kg').toLowerCase().replace(/[\d.]/g, '').trim();
      const esContable = unidadCompra === 'un' || unidadCompra === 'unidad' || unidadCompra === 'unidades';
      if (!esContable) {
        alert(
          `"${mp.nombre}" se compra por ${mp.unidad_compra} (peso/volumen), no por unidad — no se puede usar en modo "Unidades" acá.\n\n` +
          `Si necesita esta misma MP medida por peso en otra receta, y por unidad en esta, tiene que solicitarse` +
          ` como una MP nueva con esa unidad de compra (ej. "${mp.nombre} (kg)") — use "+ Solicitar/habilitar MP...".`
        );
        sel.value = 'gramos';
        return toggleUnidadTipo(sel);
      }
    }
  }

  input.dataset.modo = modo;
  input.placeholder = modo === 'unidades' ? '1' : '0';
  input.step = modo === 'unidades' ? '1' : '0.01';
  input.value = '';
  actualizarTotalIngredientesPreview();
}

// Ingresa gramos → calcula %
function desdeGramos(inputGr) {
  actualizarTotalIngredientesPreview();
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
  actualizarTotalIngredientesPreview();
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

    // Handle temporary (pending) ingredients — MP realmente nueva, sin ID todavía
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

    // Handle "esperando habilitación" — MP ya existe (ID y costo reales), solo
    // falta que Admin habilite el área. A diferencia del caso anterior, el costo
    // sí se calcula bien desde ahora.
    if (select?.disabled && select.options[0]?.text.includes('esperando habilitación')) {
      const nombre = select.options[0].text.replace('⏳ ', '').replace(' (esperando habilitación)', '').trim();
      const cantidad = parseFloat(inputs[0]?.value) || 0;
      const unidad = inputs[0]?.dataset?.unidad || 'gramos';
      const mpId = select.dataset?.mpId || '';
      const costoPorGramo = parseFloat(select.dataset?.costo) || 0;
      ingredientes.push({
        id: mpId,
        nombre,
        gramos: unidad === 'gramos' ? cantidad : 0,
        unidades: unidad === 'unidades' ? cantidad : null,
        ml: unidad === 'ml' ? cantidad : null,
        unidad_receta: unidad,
        pct: 0,
        costo: costoPorGramo * cantidad,
        esperando_habilitacion: true
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

      // Si es unidades, buscar gramos desde sub receta solo para referencia/visualización
      // (ej. mostrar "peso por pieza") — el COSTO no debe usar este peso, porque
      // costo_por_gramo de una sub-receta ya representa el costo de la unidad completa,
      // no un precio por gramo. Multiplicarlo por el peso infla el costo en cientos de veces.
      let gramosCalc = gramos;
      let esSubRecetaUnidades = false;
      if (modoInput === 'unidades' && valorInput > 0) {
        const nombreSR = opcion.text.replace('⟳ ','');
        const srReceta = App.recetas.find(r =>
          r.nombre === nombreSR && r.estado === 'consolidada'
        );
        if (srReceta) {
          esSubRecetaUnidades = true;
          let ingsR = [];
          try { ingsR = JSON.parse(srReceta.ingredientes_JSON || '[]'); } catch(e) {}
          const pesoUnitario = ingsR.reduce((s,i) => s+(parseFloat(i.gramos)||0), 0);
          gramosCalc = pesoUnitario * valorInput; // solo para mostrar peso de referencia
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
        costo:    esSubRecetaUnidades ? costoPorGramo * valorInput : costoPorGramo * gramosCalc,
      });
    }
  });

  const insumos = [];
  document.querySelectorAll('#tbody-insumos tr').forEach(tr => {
    const select = tr.querySelector('select');
    const input = tr.querySelector('input[type="number"]');

    // Insumo temporal (pendiente de habilitación)
    if (select?.disabled && select.options[0]?.text.includes('pendiente')) {
      const nombre = select.options[0].text.replace('⏳ ', '').replace(' (pendiente habilitación)', '').trim();
      const cantidad = parseFloat(input?.value) || 0;
      const insId = select.dataset?.mpId || '__pendiente__';
      insumos.push({
        id: insId,
        nombre,
        unidades: cantidad,
        unidad_receta: 'unidades',
        costo: 0,
        pendiente: true
      });
      return;
    }

    // Insumo esperando habilitación (MP ya existe, solo falta el área)
    if (select?.disabled && select.options[0]?.text.includes('esperando habilitación')) {
      const nombre = select.options[0].text.replace('⏳ ', '').replace(' (esperando habilitación)', '').trim();
      const cantidad = parseFloat(input?.value) || 0;
      const insId = select.dataset?.mpId || '';
      const costoPorGramo = parseFloat(select.dataset?.costo) || 0;
      insumos.push({
        id: insId,
        nombre,
        unidades: cantidad,
        unidad_receta: 'unidades',
        costo: costoPorGramo * cantidad,
        esperando_habilitacion: true
      });
      return;
    }

    if (select?.value && select.value !== '__nuevo__') {
      const opcion = select.options[select.selectedIndex];
      const costoPorUnidad = parseFloat(opcion.dataset.costo) || 0;
      const cantidad = parseFloat(input?.value) || 0;
      insumos.push({
        id:       select.value,
        nombre:   opcion.text,
        unidades: cantidad,
        unidad_receta: 'unidades',
        costo:    costoPorUnidad * cantidad,
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
    porciones_base:              parseFloat(porciones),
    porciones_base_unidad:       document.getElementById('f-porciones-unidad')?.value || 'un',
    tipo_preparacion:            document.getElementById('f-tipo-preparacion')?.value ?? '',
    peso_unidad_mb_g:            document.getElementById('f-peso-unidad-mb')?.value || '',
    vende_directo:                document.getElementById('f-vende-directo')?.checked ? 'si' : 'no',
    se_congela:                   document.getElementById('f-se-congela')?.checked ? 'si' : 'no',
    variante_de_id:               document.getElementById('f-variante-de')?.value || '',
    planificable_directo:        document.getElementById('f-planificable-directo') ? (document.getElementById('f-planificable-directo').checked ? 'si' : 'no') : 'si',
    peso_harina_total_g:         App.areaCodigo === 'PAN' ? (document.getElementById('f-harina')?.value || '') : '',
    ingredientes_JSON:           JSON.stringify(ingredientes),
    insumos_JSON:                JSON.stringify(insumos),
    pasos_JSON:                  JSON.stringify(
      Array.from(document.querySelectorAll('#contenedor-pasos .paso-fila textarea'))
        .map(t => t.value.trim())
        .filter(t => t)
    ),
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
  const r = App.recetas.find(x => x.ID_receta === recetaId);

  // Bloquear si algún ingrediente/insumo todavía apunta a una MP recién solicitada
  // (sin asignar por Admin) o a una MP existente esperando habilitación para el área
  // — evita que la receta quede aprobada con una referencia rota o no disponible.
  if (r) {
    let ingredientes = [], insumos = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    try { insumos = JSON.parse(r.insumos_JSON || '[]'); } catch(e) {}
    const pendientes = [
      ...ingredientes.filter(ing => ing.pendiente || ing.id === '__pendiente__').map(ing => ing.nombre),
      ...insumos.filter(ins => ins.pendiente || ins.id === '__pendiente__').map(ins => ins.nombre),
    ];
    const esperandoHabilitacion = [
      ...ingredientes.filter(ing => ing.esperando_habilitacion).map(ing => ing.nombre),
      ...insumos.filter(ins => ins.esperando_habilitacion).map(ins => ins.nombre),
    ];
    if (pendientes.length) {
      alert(
        `Esta receta no se puede enviar a revisión todavía.\n\n` +
        `Está esperando que Admin asigne la materia prima oficial para:\n` +
        `${pendientes.map(n => '• ' + n).join('\n')}\n\n` +
        `Apenas Admin la asigne, le va a llegar un aviso — ahí podrá reemplazarla en la receta y recién entonces enviarla a revisión.`
      );
      return;
    }
    if (esperandoHabilitacion.length) {
      alert(
        `Esta receta no se puede enviar a revisión todavía.\n\n` +
        `Está esperando que Admin habilite estas materias primas para su área:\n` +
        `${esperandoHabilitacion.map(n => '• ' + n).join('\n')}\n\n` +
        `Apenas Admin las habilite, va a poder enviarla a revisión sin ningún paso extra.`
      );
      return;
    }
  }

  const btn = document.querySelector(`[onclick="enviarARevision('${recetaId}')"]`);
  bloquearBtn(btn, 'Enviando...');

  // Guardar estado en localStorage (persiste recargas)
  setEstadoLocal(recetaId, 'pendiente_aprobación');
  console.log('[fën] Verificacion localStorage:', getEstadoLocal(recetaId));
  // Actualizar estado local en memoria
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
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadRevision, { redirect: 'follow', cache: 'no-store' }).catch(e => console.warn('Error:', e));

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
      </div>` : (() => {
        const recetasNormales = recetas.filter(r => r.tipo_receta !== 'sub_receta');
        const subRecetas = recetas.filter(r => r.tipo_receta === 'sub_receta');

        // Revisa si una MP marcada como "pendiente" en una receta ya fue resuelta por
        // Admin (aprobada directo, o fusionada con una MP existente) — misma lógica
        // que ya usa el formulario de "Nueva receta" al agregar ingredientes.
        const mpYaResuelta = item => {
          const mpActual = App.materiasPrimas.find(m => m.ID_MP === item.id);
          if (!mpActual) return false;
          if (mpActual.estado === 'activa') return true;
          if (mpActual.estado === 'reemplazada' && mpActual.reemplazada_por) return true;
          return false;
        };

        // Para "esperando habilitación", la MP ya es real — lo único que falta es
        // que el área actual aparezca en su lista de áreas habilitadas.
        const habilitacionYaResuelta = item => {
          const mpActual = App.materiasPrimas.find(m => m.ID_MP === item.id);
          if (!mpActual) return false;
          if (!mpActual.areas_habilitadas) return true; // sin restricción = habilitada para todas
          return mpActual.areas_habilitadas.split(',').map(a=>a.trim()).includes(App.areaCodigo);
        };

        const filaHtml = r => {
          const est = FEN.ESTADOS[r.estado] || FEN.ESTADOS.borrador;
          const esConsolidada = r.estado === 'consolidada';
          let ingredientesFila = [], insumosFila = [];
          try { ingredientesFila = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
          try { insumosFila = JSON.parse(r.insumos_JSON || '[]'); } catch(e) {}
          const itemsPendientesMarcados = [
            ...ingredientesFila.filter(ing => ing.pendiente || ing.id === '__pendiente__'),
            ...insumosFila.filter(ins => ins.pendiente || ins.id === '__pendiente__'),
          ];
          const itemsEsperandoHabilitacion = [
            ...ingredientesFila.filter(ing => ing.esperando_habilitacion),
            ...insumosFila.filter(ins => ins.esperando_habilitacion),
          ];
          const tieneMPPendiente = itemsPendientesMarcados.some(item => !mpYaResuelta(item));
          const tieneMPAsignada = !tieneMPPendiente && itemsPendientesMarcados.some(item => mpYaResuelta(item));
          const tieneHabilitacionPendiente = itemsEsperandoHabilitacion.some(item => !habilitacionYaResuelta(item));
          const tieneHabilitacionResuelta = !tieneHabilitacionPendiente && itemsEsperandoHabilitacion.some(item => habilitacionYaResuelta(item));
          return `<tr>
            <td class="td-nombre">
              ${r.nombre || r.ID_receta}
              <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:6px">${r.ID_receta}</span>
              ${esConsolidada ? '<span style="font-size:10px;color:#2E7D32;margin-left:4px"><i class="ti ti-lock"></i></span>' : ''}
              ${App.areaCodigo === 'BOL' ? `<span style="font-size:10px;color:${r.tipo_preparacion?'var(--txt3)':'#C62828'};margin-left:6px">· ${formatearClasificacionBOL(r.tipo_preparacion)}</span>` : ''}
              ${tieneMPPendiente ? `<span style="font-size:10px;font-weight:600;color:#C62828;background:#FFEBEE;padding:1px 7px;border-radius:99px;margin-left:6px"><i class="ti ti-clock-pause"></i> Espera asignación de MP</span>` : ''}
              ${tieneMPAsignada ? `<span style="font-size:10px;font-weight:600;color:#2E7D32;background:#E8F5E9;padding:1px 7px;border-radius:99px;margin-left:6px"><i class="ti ti-check"></i> MP asignada — reemplácela en la receta</span>` : ''}
              ${tieneHabilitacionPendiente ? `<span style="font-size:10px;font-weight:600;color:#C62828;background:#FFEBEE;padding:1px 7px;border-radius:99px;margin-left:6px"><i class="ti ti-clock-pause"></i> Espera habilitación de MP</span>` : ''}
              ${tieneHabilitacionResuelta ? `<span style="font-size:10px;font-weight:600;color:#2E7D32;background:#E8F5E9;padding:1px 7px;border-radius:99px;margin-left:6px"><i class="ti ti-check"></i> MP habilitada — ya puede enviarla</span>` : ''}
            </td>
            <td style="text-align:center">
              <span class="estado-badge" style="color:${est.color};background:${est.bg}">${est.label}</span>
            </td>
            <td style="text-align:right;padding:6px 16px">
              ${r.estado === 'en_prueba' ? `
              <button class="btn-primario" style="font-size:12px;padding:5px 12px;margin-right:6px"
                onclick="enviarARevision('${r.ID_receta}')">
                <i class="ti ti-send"></i> Enviar a revisión</button>` : ''}
              <button class="btn-secundario" style="font-size:14px;padding:5px 12px"
                onclick="abrirAccionesReceta('${r.ID_receta}')" title="Acciones">
                <i class="ti ti-dots-vertical"></i>
              </button>
            </td>
          </tr>`;
        };

        const tablaGrupo = (titulo, icono, lista) => !lista.length ? '' : `
          <div class="card" style="margin-bottom:16px">
            <div class="card-head"><i class="ti ${icono}"></i> ${titulo} (${lista.length})</div>
            <table class="tabla-vista">
              <thead><tr>
                <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Nombre</th>
                <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Estado</th>
                <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Acciones</th>
              </tr></thead>
              <tbody>
                ${lista.map(filaHtml).join('')}
                ${lista.some(r => r.estado === 'consolidada') ? '<tr><td colspan="3" style="padding:8px 16px;font-size:11px;color:var(--txt3)">* Editar una receta consolidada la enviará a re-aprobación.</td></tr>' : ''}
              </tbody>
            </table>
          </div>`;

        return tablaGrupo('Recetas', 'ti-clipboard-list', recetasNormales) +
               tablaGrupo('Sub recetas', 'ti-arrows-loop-2', subRecetas);
      })()}
  `;
  mostrarVista('mis-recetas');
}

function abrirModalVerReceta(recetaId) {
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;
  const esPan = App.areaCodigo === 'PAN';
  const est   = FEN.ESTADOS[r.estado] || FEN.ESTADOS.borrador;

  document.getElementById('ver-receta-modal-contenido').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span class="estado-badge" style="color:${est.color};background:${est.bg}">${est.label}</span>
    </div>
    <h2 style="margin-bottom:8px">${r.nombre}</h2>
    <div class="meta-chips" style="margin-bottom:16px">
      <span class="chip"><i class="ti ti-box"></i>${formatearRendimiento(r)}</span>
      ${esPan && r.peso_harina_total_g ? `<span class="chip"><i class="ti ti-weight"></i>${r.peso_harina_total_g}g harina base</span>` : ''}
      <span class="chip"><i class="ti ti-versions"></i>v${r.versión || 1}</span>
    </div>
    ${construirDetalleRecetaHTML(r)}
  `;
  document.getElementById('modal-ver-receta').classList.remove('hidden');
}

function abrirAccionesReceta(recetaId) {
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;

  document.getElementById('acciones-receta-titulo').textContent = r.nombre;

  const botones = [
    { icono: 'ti-edit', label: 'Editar receta',
      accion: `cerrarModalAccionesReceta();renderVistaFormReceta('${recetaId}');mostrarVista('form-receta')` },
    { icono: 'ti-eye', label: 'Ver receta',
      accion: `cerrarModalAccionesReceta();abrirModalVerReceta('${recetaId}')` },
  ];
  if (r.estado === 'borrador' || r.estado === 'en_prueba') {
    botones.push({ icono: 'ti-trash', label: 'Eliminar receta', color: '#C62828',
      accion: `cerrarModalAccionesReceta();confirmarEliminarReceta('${recetaId}','${(r.nombre||'').replace(/'/g,"\\'")}','${App.area?.nombre||''}')` });
  }

  document.getElementById('acciones-receta-botones').innerHTML = botones.map(b => `
    <button class="btn-secundario" style="width:100%;justify-content:flex-start;gap:10px;padding:12px 14px;font-size:14px;${b.color?'color:'+b.color:''}"
      onclick="${b.accion}">
      <i class="ti ${b.icono}" style="font-size:18px"></i> ${b.label}
    </button>
  `).join('') + (r.estado === 'consolidada' || r.estado === 'pendiente_aprobación'
    ? `<p style="font-size:11px;color:var(--txt3);text-align:center;margin-top:4px">
        <i class="ti ti-lock"></i> Receta aprobada o en revisión — solo Admin puede eliminarla.
      </p>` : '');

  document.getElementById('modal-acciones-receta').classList.remove('hidden');
}

function cerrarModalAccionesReceta() {
  document.getElementById('modal-acciones-receta').classList.add('hidden');
}

// ── VER RECETA ────────────────────────────────────────────────
// Contenido de detalle de una receta (stats + ingredientes + notas) — reutilizado
// tanto en la vista completa (verReceta) como en el modal rápido (abrirModalVerReceta).
function construirDetalleRecetaHTML(r) {
  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
  const esPan = App.areaCodigo === 'PAN';

  const statsHtml = (() => {
    const totalIngr = ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0);
    const porciones = parseInt(r.porciones_base)||1;
    const pesoCrudoPieza = (totalIngr/porciones).toFixed(1);
    const esBOL = App.areaCodigo === 'BOL';
    const esRendGramos = (r.porciones_base_unidad || 'un') === 'g';
    const mermaLaminado = esBOL ? parseFloat(r.merma_laminado_pct||8) : 0;
    const pesoPaston = esBOL ? (totalIngr * (1 - mermaLaminado/100)).toFixed(0) : null;
    const pesoPastonPieza = esBOL ? (pesoPaston / porciones).toFixed(1) : null;
    return `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val azul">${formatearRendimiento(r)}</div>
        <div class="stat-lbl">Rendimiento</div>
      </div>
      ${!esRendGramos ? `
      <div class="stat-card">
        <div class="stat-val">${pesoCrudoPieza}g</div>
        <div class="stat-lbl">Peso crudo por pieza</div>
      </div>` : ''}
      ${esBOL ? `
      <div class="stat-card">
        <div class="stat-val" style="color:#6A1B9A">${esRendGramos ? pesoPaston : pesoPastonPieza}g</div>
        <div class="stat-lbl">Peso pastón listo${esRendGramos ? '' : '/pieza'}</div>
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
  })();

  return `
    ${r.observaciones_procedimiento ? `
      <div style="background:var(--bg);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;
        font-size:13px;color:var(--txt2);line-height:1.65">${r.observaciones_procedimiento}</div>` : ''}
    ${statsHtml}
    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-basket"></i> Ingredientes</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Ingrediente</th>
          <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Gramos</th>
          ${esPan ? `<th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">% panadero</th>` : ''}
        </tr></thead>
        <tbody>
          ${ingredientes.map(ing => {
            const esUnidades = ing.unidades !== undefined && ing.unidades !== null && ing.unidades !== '';
            const valorMostrado = esUnidades
              ? `${formatearUnidadesIngrediente(ing.unidades)} uni <span style="color:var(--txt3);font-weight:400">(≈${parseFloat(ing.gramos||0).toFixed(0)}g)</span>`
              : `${parseFloat(ing.gramos||0).toFixed(0)}g`;
            return `
            <tr>
              <td class="td-nombre">${ing.nombre}</td>
              <td class="td-num">${valorMostrado}</td>
              ${esPan ? `<td class="td-pct">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
            </tr>`;
          }).join('')}
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
}

function verReceta(recetaId) {
  // Cancelar navegación automática pendiente
  if (App._navTimer) { clearTimeout(App._navTimer); App._navTimer = null; }
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;
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
          <span class="chip"><i class="ti ti-box"></i>${formatearRendimiento(r)}</span>
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
    ${construirDetalleRecetaHTML(r)}
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
  const semanaLabel = formatearEtiquetaSemana(obtenerSemanaHace(0));
  const esBOL = App.areaCodigo === 'BOL';

  const vista = document.getElementById('vista-planificacion');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre} · Semana ${semanaLabel}</div>
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
    ${(() => {
      const plan = App.planSemana || {};
      // Vacío si no hay filas, o si las hay pero todos los días de todas las recetas están en 0
      const totalUnidades = Object.values(plan).reduce((s, dias) => s + (dias||[]).reduce((s2,v)=>s2+(parseInt(v)||0),0), 0);
      return totalUnidades === 0;
    })() ? `
      <div class="card" style="background:#E3F2FD;border:1px solid #1565C0;margin-bottom:16px;padding:12px 16px;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <span style="font-size:13px;color:#0D47A1"><i class="ti ti-copy"></i> Esta semana todavía no tiene plan cargado. ¿Copiar el de la semana pasada como punto de partida?</span>
        <button class="btn-primario" style="font-size:12px;padding:6px 14px;white-space:nowrap" onclick="copiarPlanSemanaAnterior(this)">Copiar semana anterior</button>
      </div>` : ''}

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-calendar-search"></i> Ver / copiar otra semana</div>
      <div style="padding:14px 16px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <select id="selector-semana-historica" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
          ${Array.from({length:16}, (_,i) => i+1).map(n => {
            const s = obtenerSemanaHace(n);
            return `<option value="${s.id}">${formatearEtiquetaSemana(s)} (hace ${n} semana${n>1?'s':''})</option>`;
          }).join('')}
        </select>
        <button class="btn-secundario" style="font-size:12px;padding:8px 14px" onclick="verSemanaHistorica()">
          <i class="ti ti-eye"></i> Ver
        </button>
      </div>
      <div id="preview-semana-historica" class="hidden" style="padding:0 16px 16px"></div>
    </div>

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

async function leerPlanDeSemana(semanaId) {
  const hoja = FEN.AREAS[App.areaCodigo].hoja_plan;
  const datos = await leerHoja(hoja);
  const diasCols = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const plan = {};
  datos.filter(f => f.semana_ID === semanaId).forEach(fila => {
    const rid = fila.ID_receta;
    if (rid) plan[rid] = diasCols.map(d => parseInt(fila[d]) || 0);
  });
  return plan;
}

async function verSemanaHistorica() {
  const semanaId = document.getElementById('selector-semana-historica')?.value;
  const cont = document.getElementById('preview-semana-historica');
  if (!semanaId || !cont) return;
  cont.classList.remove('hidden');
  cont.innerHTML = '<p style="color:var(--txt3);font-size:12px">Cargando...</p>';

  const plan = await leerPlanDeSemana(semanaId);
  const diasCorto = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const recetaIds = Object.keys(plan);

  if (!recetaIds.length) {
    cont.innerHTML = `<p style="color:var(--txt3);font-size:12px">No hay plan guardado para la semana ${semanaId}.</p>`;
    return;
  }

  // Ordenado de mayor a menor total elaborado en la semana — así se ve de un
  // vistazo qué pan tuvo más volumen, que es lo que realmente sirve (el total
  // por día no distingue entre panes de distinta naturaleza)
  const totalGeneral = recetaIds.reduce((s,rid) => s + plan[rid].reduce((s2,v)=>s2+(v||0),0), 0);
  const recetaIdsOrdenados = [...recetaIds].sort((a,b) =>
    plan[b].reduce((s,v)=>s+(v||0),0) - plan[a].reduce((s,v)=>s+(v||0),0)
  );

  cont.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:560px">
        <thead><tr style="background:var(--bg)">
          <th style="text-align:left;padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Receta</th>
          ${diasCorto.map(d => `<th style="text-align:right;padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">${d}</th>`).join('')}
          <th style="text-align:right;padding:6px 10px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--area-color, #1565C0);border-left:2px solid var(--border)">Total semana</th>
        </tr></thead>
        <tbody>
          ${recetaIdsOrdenados.map(rid => {
            const r = App.recetas.find(x => x.ID_receta === rid);
            const totalReceta = plan[rid].reduce((s,v)=>s+(v||0),0);
            return `<tr>
              <td style="padding:5px 10px;border-bottom:1px solid var(--border)">${r?.nombre || rid}</td>
              ${plan[rid].map(v => `<td style="padding:5px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace">${v||''}</td>`).join('')}
              <td style="padding:5px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:700;border-left:2px solid var(--border)">${totalReceta}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:12px;color:var(--txt3);margin-top:8px">Total general de la semana: <strong>${totalGeneral}</strong> unidades</p>
    <button class="btn-primario" style="font-size:12px;padding:8px 14px;margin-top:8px" onclick="copiarSemanaHistorica('${semanaId}',this)">
      <i class="ti ti-copy"></i> Copiar esta semana a la actual
    </button>
  `;
}

async function copiarSemanaHistorica(semanaId, btn) {
  if (btn) bloquearBtn(btn, 'Copiando...');
  try {
    const plan = await leerPlanDeSemana(semanaId);
    if (!Object.keys(plan).length) {
      toast('Esa semana no tiene datos para copiar', 'error');
      if (btn) desbloquearBtn(btn, '<i class="ti ti-copy"></i> Copiar esta semana a la actual', false);
      return;
    }
    const hoja = FEN.AREAS[App.areaCodigo].hoja_plan;
    const semanaActual = obtenerSemanaActual();
    await escribirEnSheet('guardar_planificacion', { hoja, semana: semanaActual, plan });
    App.planSemana = plan;
    guardarPlanLocal(plan);
    toast(`Plan de la semana ${semanaId} copiado a la semana actual — revíselo y ajuste lo que corresponda`);
    renderVistaPlanificacion();
  } catch(e) {
    toast('Error al copiar: ' + e.message, 'error');
    if (btn) desbloquearBtn(btn, '<i class="ti ti-copy"></i> Copiar esta semana a la actual', false);
  }
}

async function copiarPlanSemanaAnterior(btn) {
  if (btn) bloquearBtn(btn, 'Copiando...');
  try {
    const hoja = FEN.AREAS[App.areaCodigo].hoja_plan;
    const semanaAnterior = obtenerSemanaAnterior();
    const semanaActual = obtenerSemanaActual();
    const datos = await leerHoja(hoja);
    const diasCols = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const plan = {};
    datos.filter(f => f.semana_ID === semanaAnterior).forEach(fila => {
      const rid = fila.ID_receta;
      if (rid) plan[rid] = diasCols.map(d => parseInt(fila[d]) || 0);
    });

    if (!Object.keys(plan).length) {
      toast('La semana pasada tampoco tiene plan guardado', 'error');
      if (btn) desbloquearBtn(btn, 'Copiar semana anterior', false);
      return;
    }

    await escribirEnSheet('guardar_planificacion', { hoja, semana: semanaActual, plan });
    App.planSemana = plan;
    guardarPlanLocal(plan);
    toast('Plan de la semana pasada copiado — revíselo y ajuste lo que corresponda');
    renderVistaPlanificacion();
  } catch(e) {
    toast('Error al copiar: ' + e.message, 'error');
    if (btn) desbloquearBtn(btn, 'Copiar semana anterior', false);
  }
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
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadB2B, { cache: 'no-store' }).catch(() => {});
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
  let tandas = Array.from(inputs).map(inp => parseInt(inp.value)||0);

  // Antes: calculaba "lo que sobra" y lo ponía en la tanda nueva — pero al abrir el
  // modal la primera tanda ya tiene el 100%, así que "sobraba" 0 y la tanda nueva
  // quedaba vacía (inservible). Ahora parte la tanda más grande por la mitad.
  let idxMax = 0;
  tandas.forEach((v,i) => { if (v > tandas[idxMax]) idxMax = i; });
  const mitad = Math.floor(tandas[idxMax] / 2);
  if (mitad > 0) {
    tandas[idxMax] = tandas[idxMax] - mitad;
    tandas.push(mitad);
  } else {
    tandas.push(0);
  }
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
              ${ingredientes.map((ing, ingIdx) => {
                const gr = (parseFloat(ing.gramos)||0) * factor;
                const pctMostrar = ing._modificado
                  ? (mod && mod[ing.id]?.pct_nuevo || 0).toFixed(2)
                  : ((parseFloat(ing.pct)||0)*100).toFixed(1);
                // Si tiene unidades guardadas, mostrar en unidades
                const tieneUnidades = ing.unidades !== undefined && ing.unidades !== null;
                const unidadesEscaladas = tieneUnidades
                  ? Math.ceil((parseFloat(ing.unidades)||0) * factor)
                  : null;
                const mpIng = App.materiasPrimas.find(m => m.ID_MP === ing.id);
                const esSubReceta = mpIng && mpIng.tipo === 'sub_receta';
                const filaId = `${rid}-${ingIdx}`;
                return `<tr ${ing._modificado ? 'style="background:#FFF3E0"' : ''}>
                  <td class="td-nombre">
                    ${esSubReceta ? `
                    <button onclick="toggleSubIngredienteExpandible('${filaId}','${ing.id}',${gr})"
                      style="background:none;border:none;padding:0;font-family:inherit;font-size:inherit;color:inherit;cursor:pointer;display:flex;align-items:center;gap:4px">
                      <span id="chev-${filaId}"><i class="ti ti-chevron-right"></i></span> ${ing.nombre}
                    </button>` : ing.nombre}
                    ${ing._modificado ? '<span style="font-size:10px;color:#F57C00;margin-left:4px">✦</span>' : ''}
                  </td>
                  <td class="td-num" style="font-size:14px;font-weight:600;${ing._modificado?'color:#F57C00':''}">
                    ${tieneUnidades
                      ? `${unidadesEscaladas} uni`
                      : `${gr.toFixed(0)}g`}
                  </td>
                  ${esPan ? `<td class="td-pct" style="${ing._modificado?'color:#F57C00':''}">${pctMostrar}%</td>` : ''}
                </tr>
                ${esSubReceta ? `<tr><td colspan="${esPan?3:2}" id="sub-ing-${filaId}" class="hidden" style="padding:0 16px 8px"></td></tr>` : ''}`;
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
              <td class="td-num">${formatearRendimiento(r)}</td>
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

// ── REGISTRO DE MERMA (PAN/BOL/CAF/PAS) ───────────────────────
let _mermaRegistros = [];

async function renderVistaRegistroMerma() {
  const vista = document.getElementById('vista-registro-merma');
  if (!vista) return;
  mostrarVista('registro-merma');

  await cargarRegistrosMerma();

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area?.nombre}</div>
        <h1 class="vista-titulo">Registro de merma</h1>
      </div>
      <button class="btn-primario" onclick="abrirModalRegistroMerma()">
        <i class="ti ti-plus"></i> Nuevo registro
      </button>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <select id="filtro-merma-periodo" onchange="renderTablaRegistrosMerma()"
        style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit">
        <option value="hoy">Hoy</option>
        <option value="semana" selected>Esta semana</option>
        <option value="mes">Este mes</option>
        <option value="todos">Todos</option>
      </select>
    </div>

    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Tus registros</div>
      <div id="tabla-registros-merma" style="overflow-x:auto"></div>
    </div>
  `;

  renderTablaRegistrosMerma();
}

async function cargarRegistrosMerma() {
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_registro_merma', area_codigo: App.areaCodigo }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    _mermaRegistros = data.registros || [];
  } catch(e) {
    console.warn('[fën] No se pudieron cargar registros de merma:', e.message);
    _mermaRegistros = [];
  }
}

function renderTablaRegistrosMerma() {
  const periodo = document.getElementById('filtro-merma-periodo')?.value || 'semana';
  const hoy = new Date();
  const off = hoy.getTimezoneOffset() * 60000;
  const fechaHoy = new Date(hoy - off).toISOString().slice(0,10);
  const lunesSemana = (() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - (d.getDay()===0?6:d.getDay()-1));
    return new Date(d - off).toISOString().slice(0,10);
  })();
  const primerMes = fechaHoy.slice(0,7) + '-01';

  let filtrados = _mermaRegistros.filter(r => {
    const fechaNorm = (r.fecha || '').slice(0,10);
    if (periodo === 'hoy' && fechaNorm !== fechaHoy) return false;
    if (periodo === 'semana' && fechaNorm < lunesSemana) return false;
    if (periodo === 'mes' && fechaNorm < primerMes) return false;
    return true;
  }).sort((a,b) => b.fecha.localeCompare(a.fecha) || (b.hora||'').localeCompare(a.hora||''));

  const motivos = { derrame_error:'Derrame/error', devolucion_cliente:'Devolución cliente', vencimiento:'Vencimiento', prueba_receta:'Prueba de receta', otro:'Otro' };

  const tablaEl = document.getElementById('tabla-registros-merma');
  if (!tablaEl) return;

  if (!filtrados.length) {
    tablaEl.innerHTML = '<p style="padding:20px;color:var(--txt3);font-size:13px;text-align:center">Sin registros para el período seleccionado.</p>';
    return;
  }

  tablaEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Fecha</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Ítem</th>
        <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Cantidad</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Motivo</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Nota</th>
      </tr></thead>
      <tbody>
        ${filtrados.map(r => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 14px;font-size:12px">${r.fecha}${r.hora ? ' · '+r.hora : ''}</td>
            <td style="padding:8px 14px;font-size:12px;font-weight:600">${r.item_nombre || ''} ${r.tipo_perdida === 'mp' ? '<span style="font-size:10px;color:var(--txt3)">(MP)</span>' : ''}</td>
            <td style="padding:8px 14px;font-size:12px;text-align:right">${parseFloat(r.cantidad||0)} ${r.unidad||''}</td>
            <td style="padding:8px 14px;font-size:12px">${motivos[r.motivo] || r.motivo || ''}</td>
            <td style="padding:8px 14px;font-size:12px;color:var(--txt2)">${r.nota || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function abrirModalRegistroMerma() {
  const modal = document.getElementById('modal-registro-merma');
  if (!modal) return;

  // Recetas consolidadas del área, con su costo directo (MP + insumos) ya calculado
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  const recetasArea = maestro.filter(r => r.área === App.area?.nombre && r.tipo_receta !== 'sub_receta');
  const selReceta = document.getElementById('merma-receta-id');
  selReceta.innerHTML = '<option value="">— Seleccionar —</option>' + recetasArea.map(r => {
    const costoUnit = (parseFloat(r.costo_MP_unitario)||0) + (parseFloat(r.costo_insumos_unitario)||0);
    return `<option value="${r.ID_receta}" data-costo-unit="${costoUnit}">${r.nombre}</option>`;
  }).join('');

  // MP/insumos activos disponibles para el área
  const mpArea = App.materiasPrimas.filter(m =>
    m.estado === 'activa' && m.tipo !== 'sub_receta' &&
    (!m.areas_habilitadas || m.areas_habilitadas.split(',').map(a=>a.trim()).includes(App.areaCodigo))
  ).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'));
  const selMP = document.getElementById('merma-mp-id');
  selMP.innerHTML = '<option value="">— Seleccionar —</option>' + mpArea.map(m => {
    const unidadCompra = (m.unidad_compra || 'kg').toLowerCase();
    return `<option value="${m.ID_MP}" data-costo-gr="${m.costo_por_gramo||0}" data-unidad-compra="${unidadCompra}">${m.nombre}</option>`;
  }).join('');

  document.getElementById('merma-tipo-perdida').value = 'receta';
  document.getElementById('merma-cantidad').value = '';
  document.getElementById('merma-nota').value = '';
  document.getElementById('merma-motivo').value = 'derrame_error';
  onCambioTipoPerdidaMerma();
  modal.classList.remove('hidden');
}

function onCambioTipoPerdidaMerma() {
  const tipo = document.getElementById('merma-tipo-perdida').value;
  document.getElementById('merma-campo-receta').classList.toggle('hidden', tipo !== 'receta');
  document.getElementById('merma-campo-mp').classList.toggle('hidden', tipo !== 'mp');
  onCambioItemMerma();
}

function onCambioItemMerma() {
  const tipo = document.getElementById('merma-tipo-perdida').value;
  const label = document.getElementById('merma-unidad-label');
  if (tipo === 'receta') {
    label.textContent = 'unidades';
  } else {
    const sel = document.getElementById('merma-mp-id');
    const opcion = sel.options[sel.selectedIndex];
    const unidadCompra = opcion?.dataset.unidadCompra || 'kg';
    label.textContent = unidadCompra === 'un' ? 'unidades' : unidadCompra === 'lt' ? 'ml' : 'gramos';
  }
  calcularCostoPreviewMerma();
}

function calcularCostoPreviewMerma() {
  const tipo = document.getElementById('merma-tipo-perdida').value;
  const cantidad = parseFloat(document.getElementById('merma-cantidad').value) || 0;
  let costoUnit = 0;
  if (tipo === 'receta') {
    const sel = document.getElementById('merma-receta-id');
    costoUnit = parseFloat(sel.options[sel.selectedIndex]?.dataset.costoUnit) || 0;
  } else {
    const sel = document.getElementById('merma-mp-id');
    costoUnit = parseFloat(sel.options[sel.selectedIndex]?.dataset.costoGr) || 0;
  }
  const total = costoUnit * cantidad;
  document.getElementById('merma-costo-preview').textContent = clp(total);
}

async function guardarRegistroMerma(btn) {
  const tipo = document.getElementById('merma-tipo-perdida').value;
  const cantidad = parseFloat(document.getElementById('merma-cantidad').value) || 0;
  const motivo = document.getElementById('merma-motivo').value;
  const nota = document.getElementById('merma-nota').value.trim();
  const unidad = document.getElementById('merma-unidad-label').textContent;

  if (cantidad <= 0) { toast('Ingresa una cantidad mayor a 0', 'error'); return; }

  let itemId = '', itemNombre = '', costoUnit = 0;
  if (tipo === 'receta') {
    const sel = document.getElementById('merma-receta-id');
    if (!sel.value) { toast('Selecciona una receta', 'error'); return; }
    itemId = sel.value;
    itemNombre = sel.options[sel.selectedIndex].text;
    costoUnit = parseFloat(sel.options[sel.selectedIndex].dataset.costoUnit) || 0;
  } else {
    const sel = document.getElementById('merma-mp-id');
    if (!sel.value) { toast('Selecciona una materia prima', 'error'); return; }
    itemId = sel.value;
    itemNombre = sel.options[sel.selectedIndex].text;
    costoUnit = parseFloat(sel.options[sel.selectedIndex].dataset.costoGr) || 0;
  }

  const costoCalculado = costoUnit * cantidad;
  bloquearBtn(btn, 'Guardando...');

  const hoy = new Date();
  const off = hoy.getTimezoneOffset() * 60000;
  const fecha = new Date(hoy - off).toISOString().slice(0,10);
  const hora  = hoy.toLocaleTimeString('es-CL', {hour:'2-digit',minute:'2-digit'});

  const registro = {
    fecha, hora,
    area_codigo: App.areaCodigo,
    area_nombre: App.area?.nombre || '',
    tipo_perdida: tipo,
    item_id: itemId,
    item_nombre: itemNombre,
    cantidad, unidad,
    costo_calculado: costoCalculado,
    motivo, nota
  };

  try {
    await escribirEnSheet('guardar_registro_merma', { registro });
    _mermaRegistros.unshift(registro);
    document.getElementById('modal-registro-merma').classList.add('hidden');
    renderTablaRegistrosMerma();
    toast('Registro de merma guardado');
  } catch(e) {
    toast('Error al guardar', 'error');
  }
  desbloquearBtn(btn, '<i class="ti ti-check"></i> Guardar', true);
}

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
        <h1 class="vista-titulo">Bitácora de turno</h1>
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
    const fechaNorm = (r.fecha || '').slice(0,10);
    if (periodo === 'hoy' && fechaNorm !== fechaHoy) return false;
    if (periodo === 'semana' && fechaNorm < lunesSemana) return false;
    if (periodo === 'mes' && fechaNorm < primerMes) return false;
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
    await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
  'Croissant':         { Lun:71.6, Mar:104.7, Mié:86.6, Jue:66.2, Vie:76.4, Sáb:58.1, Dom:0 },
  'Croissant Mini':    { Lun:10.7, Mar:6.5,   Mié:12.9, Jue:2.6,  Vie:12.0, Sáb:0,    Dom:0 },
  'Pan de chocolate':  { Lun:0.9,  Mar:2.4,   Mié:1.6,  Jue:1.1,  Vie:0.6,  Sáb:1.6,  Dom:0 },
  // Pañuelo y Palmeritas: aún no subidas a producción — se dejan con este nombre
  // a propósito, para que calcen solas apenas se creen con el mismo nombre en fën.
  'Pañuelo':           { Lun:0,    Mar:2.4,   Mié:0,    Jue:0,    Vie:3.3,  Sáb:0,    Dom:0 },
  'Palmeritas':        { Lun:0.7,  Mar:1.1,   Mié:1.3,  Jue:0,    Vie:0.6,  Sáb:0,    Dom:0 },
};

// Promedios B2C históricos (jun 2025 – jun 2026, 1 año de datos reales)
const BOL_ESTIMACION_B2C = {
  'Croissant':         { Lun:6.4,  Mar:7.1,  Mié:5.7,  Jue:5.9,  Vie:8.1,  Sáb:6.4,  Dom:3.0 },
  'Pan de chocolate':  { Lun:4.8,  Mar:3.6,  Mié:3.6,  Jue:5.1,  Vie:5.2,  Sáb:3.7,  Dom:1.9 },
  // Las 4 siguientes: aún no subidas a producción — mismo criterio, nombre intacto
  // a propósito para que calcen solas cuando se creen.
  'Croissant relleno': { Lun:0.9,  Mar:1.8,  Mié:1.8,  Jue:3.0,  Vie:2.1,  Sáb:1.4,  Dom:0.4 },
  'Pañuelo':           { Lun:1.3,  Mar:1.8,  Mié:1.9,  Jue:2.0,  Vie:1.9,  Sáb:1.3,  Dom:0.6 },
  'Palmeritas':        { Lun:1.9,  Mar:2.6,  Mié:2.0,  Jue:2.4,  Vie:3.5,  Sáb:2.1,  Dom:0.6 },
  'Cachito':           { Lun:0.7,  Mar:0.9,  Mié:0.7,  Jue:1.1,  Vie:0.9,  Sáb:0.6,  Dom:0.1 },
  'Roll hojaldre':     { Lun:0.2,  Mar:0.2,  Mié:0.2,  Jue:0.4,  Vie:0.3,  Sáb:0.3,  Dom:0.1 },
};

const BOL_DIAS_NOMBRES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

// Promedios B2C históricos PAN (jun 2025 – jun 2026)
const PAN_ESTIMACION_B2C = {
  'Ciabatta': { Lun:92.61, Mar:67.43, Mié:64.2, Jue:61.88, Vie:70.22, Sáb:56.84, Dom:10.0 },
  'Marraqueta': { Lun:9.18, Mar:21.05, Mié:20.96, Jue:19.88, Vie:21.42, Sáb:15.0, Dom:1.24 },
  'Hogaza clásica': { Lun:10.79, Mar:7.84, Mié:6.89, Jue:6.32, Vie:7.05, Sáb:6.31, Dom:1.25 },
  'Hogaza multigrano': { Lun:9.38, Mar:9.16, Mié:7.11, Jue:6.77, Vie:7.22, Sáb:5.84, Dom:0.89 },
  'Molde integral': { Lun:8.96, Mar:7.09, Mié:5.71, Jue:5.91, Vie:6.96, Sáb:4.8, Dom:0.75 },
  'Focaccia Tomate': { Lun:3.71, Mar:4.16, Mié:3.14, Jue:3.52, Vie:3.44, Sáb:2.38, Dom:0.13 },
  'Baguette': { Lun:1.5, Mar:2.77, Mié:2.82, Jue:3.12, Vie:3.02, Sáb:2.69, Dom:0.69 },
  'Coliza': { Lun:1.5, Mar:1.48, Mié:1.93, Jue:2.18, Vie:2.07, Sáb:0.31, Dom:0.09 },
  'Focaccia Pesto': { Lun:1.09, Mar:1.38, Mié:1.46, Jue:1.57, Vie:1.47, Sáb:1.04, Dom:0.11 },
  // Aún no subida a producción — nombre intacto a propósito para que calce sola al crearla.
  'Baguette Sésamo': { Lun:0.14, Mar:0.48, Mié:0.61, Jue:0.54, Vie:0.65, Sáb:0.47, Dom:0.04 },
  'Hogaza choco-nuez': { Lun:0.29, Mar:0.41, Mié:0.39, Jue:0.3, Vie:0.56, Sáb:0.4, Dom:0.04 },
  'Hogaza Tomate-Orégano': { Lun:0.23, Mar:0.05, Mié:0.27, Jue:0.5, Vie:0.56, Sáb:0.31, Dom:0.07 },
  'Molde blanco': { Lun:0.02, Mar:0.04, Mié:0.18, Jue:0.12, Vie:0.0, Sáb:0.0, Dom:0.0 },
  // Descartadas a propósito (no corresponden a productos vigentes que valga la pena rescatar):
  // Hallulla Integral, Hallullas, 80% Integral, Ciabatta Integral, Pan De Campo.
};

// Promedios B2B históricos PAN (dic 2025 – jul 2026)
// Nota: "Ciabatta", "Ciabatta kG" y "Ciabatta Mini" se fusionaron en una sola fila
// ("Ciabatta") — es la misma receta de producción, solo se vende en 3 formatos
// distintos (mismo criterio ya aplicado en toda la reconciliación con B2B/B2C).
const PAN_ESTIMACION_B2B = {
  'Ciabatta': { Lun:85.66, Mar:110.66, Mié:88.42, Jue:68.73, Vie:71.31, Sáb:51.72, Dom:0.0 },
  'Hogaza clásica': { Lun:22.87, Mar:42.77, Mié:26.39, Jue:20.03, Vie:22.87, Sáb:15.19, Dom:3.03 },
  'Hogaza multigrano': { Lun:23.43, Mar:15.23, Mié:20.84, Jue:15.39, Vie:18.1, Sáb:14.61, Dom:1.33 },
  'Molde blanco': { Lun:8.63, Mar:5.55, Mié:6.19, Jue:4.52, Vie:5.48, Sáb:5.1, Dom:2.0 },
  'Molde integral': { Lun:2.27, Mar:3.03, Mié:1.45, Jue:1.06, Vie:0.9, Sáb:0.0, Dom:0.0 },
  'Focaccia Tomate': { Lun:1.03, Mar:0.74, Mié:1.65, Jue:0.61, Vie:1.13, Sáb:0.94, Dom:0.0 },
  'Focaccia Pesto': { Lun:0.63, Mar:0.68, Mié:0.52, Jue:0.84, Vie:0.87, Sáb:1.16, Dom:0.0 },
  'Baguette': { Lun:0.0, Mar:0.13, Mié:0.0, Jue:0.16, Vie:0.0, Sáb:0.0, Dom:0.0 },
  'Marraqueta': { Lun:0.0, Mar:0.0, Mié:0.1, Jue:0.0, Vie:0.0, Sáb:0.0, Dom:0.0 },
};

// Promedios B2C históricos CAF (desde feb 2026 — período consistente, no desde el inicio de datos en oct 2025)
const CAF_ESTIMACION_B2C = {
  'Cappuccino': { Lun:1.43, Mar:0.95, Mié:2.14, Jue:1.62, Vie:1.75, Sáb:1.45, Dom:0.0 },
  'Americano': { Lun:1.33, Mar:1.14, Mié:1.24, Jue:1.67, Vie:1.6, Sáb:1.75, Dom:0.0 },
  'Latte': { Lun:0.38, Mar:0.52, Mié:0.81, Jue:0.76, Vie:0.45, Sáb:0.55, Dom:0.0 },
  'Flatwhite': { Lun:0.86, Mar:0.62, Mié:0.24, Jue:0.33, Vie:0.75, Sáb:0.3, Dom:0.0 },
  'Espresso': { Lun:0.52, Mar:0.43, Mié:0.86, Jue:0.29, Vie:0.35, Sáb:0.45, Dom:0.0 },
  'Mocaccino': { Lun:0.76, Mar:0.38, Mié:0.38, Jue:0.38, Vie:0.35, Sáb:0.6, Dom:0.0 },
  'Chocolate Caliente': { Lun:0.24, Mar:0.19, Mié:0.24, Jue:0.05, Vie:0.0, Sáb:0.15, Dom:0.0 },
  'Chai Latte': { Lun:0.0, Mar:0.0, Mié:0.1, Jue:0.05, Vie:0.05, Sáb:0.0, Dom:0.0 },
  'Golden Milk': { Lun:0.1, Mar:0.05, Mié:0.05, Jue:0.0, Vie:0.0, Sáb:0.0, Dom:0.0 },
  'Dirty Chai': { Lun:0.0, Mar:0.0, Mié:0.1, Jue:0.0, Vie:0.0, Sáb:0.05, Dom:0.0 },
};
// CAF no tiene ventas B2B registradas (no aparece en hoja "Productos" del Excel B2B)
const CAF_ESTIMACION_B2B = {};

const ESTIMACION_POR_AREA = {
  BOL: { b2b: BOL_ESTIMACION_B2B, b2c: BOL_ESTIMACION_B2C, nombre: 'Bollería', rango: 'B2B dic 2025–jul 2026 · B2C jun 2025–jun 2026' },
  PAN: { b2b: PAN_ESTIMACION_B2B, b2c: PAN_ESTIMACION_B2C, nombre: 'Panadería', rango: 'B2B dic 2025–jul 2026 · B2C jun 2025–jun 2026' },
  CAF: { b2b: CAF_ESTIMACION_B2B, b2c: CAF_ESTIMACION_B2C, nombre: 'Cafetería', rango: 'B2C feb 2026–jun 2026 (período consistente) · sin ventas B2B' },
};

function renderVistaEstimacionDemanda(areaSel) {
  const vista = document.getElementById('vista-estimacion-bol');
  if (!vista) return;
  mostrarVista('estimacion-bol');

  const area = areaSel || App._areaEstimacionActual || 'BOL';
  App._areaEstimacionActual = area;
  const est = ESTIMACION_POR_AREA[area];

  const cfg = cargarConfigSubrecetas();
  const maxMasas = (cfg.bol?.amasadora_tandas_dia || 2) * (cfg.bol?.amasadora_max_por_tanda || 16);
  const capHorno = cfg.bol?.capacidad_horno || 90;

  const productos = [...new Set([...Object.keys(est.b2b), ...Object.keys(est.b2c)])];

  // Para cada producto: calcular día más fuerte y promedios
  const analisis = productos.map(prod => {
    const b2b = est.b2b[prod] || {};
    const b2c = est.b2c[prod] || {};
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

  // Masas estimadas por día — solo aplica a BOL (config de amasadora es específica de esa área)
  const masasPorDia = area === 'BOL' ? BOL_DIAS_NOMBRES.map(d => {
    let total = 0;
    productos.forEach(prod => {
      const b2b = est.b2b[prod] || {};
      const b2c = est.b2c[prod] || {};
      total += parseFloat(b2b[d]||0) + parseFloat(b2c[d]||0);
    });
    const masas = Math.ceil(total / 10);
    const color = masas > maxMasas ? '#C62828' : masas > maxMasas*0.8 ? '#F57C00' : '#2E7D32';
    return { d, total: Math.round(total), masas, color };
  }) : [];

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${est.nombre} — Admin</div>
        <h1 class="vista-titulo">Estimación de demanda</h1>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:12px">
      ${Object.entries(ESTIMACION_POR_AREA).map(([cod, e]) => `
        <button class="${area===cod?'btn-primario':'btn-secundario'}" style="font-size:12px;padding:6px 14px"
          onclick="renderVistaEstimacionDemanda('${cod}')">${e.nombre}</button>
      `).join('')}
    </div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:20px">
      Basado en datos reales: ${est.rango}.
      Úsalo como referencia para definir tu meta de producción.
    </p>

    ${!analisis.length ? `
      <div class="empty-state">
        <i class="ti ti-chart-arrows-vertical"></i>
        <h2>Sin datos suficientes</h2>
        <p>No hay historial de ventas registrado para ${est.nombre}.</p>
      </div>` : `
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
    </div>`}

    ${area === 'BOL' && analisis.length ? `
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
    ` : ''}
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
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
  fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' }).catch(() => {});

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
  fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' }).catch(() => {});
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
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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
  fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' }).catch(() => {});
  const payload2 = encodeURIComponent(JSON.stringify({
    accion: 'guardar_tarea_bol', semana_ID: semana, dia: diaIdx,
    tipo_tarea: 'empaste_estirados', subtarea: 'empaste_estirados',
    cantidad: est, cantidad_real: est, estado: '1',
    fecha_local: fechaRealDiaSemana(diaIdx), dispositivo: navigator.userAgent.slice(0,50)
  }));
  fetch(FEN.WEBAPP_URL + '?payload=' + payload2, { cache: 'no-store' }).catch(() => {});

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
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadTarea, { cache: 'no-store' }).catch(() => {});
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
  fetch(FEN.WEBAPP_URL + '?payload=' + payloadTarea2, { cache: 'no-store' }).catch(() => {});
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
  fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' }).catch(() => {});
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
        let insumos = [];
        try { insumos = JSON.parse(r.insumos_JSON || '[]'); } catch(e) {}
        let pasos = [];
        try { pasos = JSON.parse(r.pasos_JSON || '[]'); } catch(e) {}
        const codigoArea = codigoAreaDesdeReceta(r);
        const areaInfo = FEN.AREAS[codigoArea] || {};
        const vendeDirecto = r.vende_directo !== 'no'; // por defecto sí, salvo que diga explícitamente "no"
        const seCongela = r.se_congela === 'si';
        const tieneClasificacion = codigoArea === 'BOL' || codigoArea === 'PAN';

        const chip = (label, activo, colorActivo='#2E7D32', bgActivo='#E8F5E9') => `
          <div style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:99px;font-size:11px;font-weight:600;
            background:${activo?bgActivo:'#FAFAFA'};color:${activo?colorActivo:'#9E9E9E'};border:1px solid ${activo?'transparent':'var(--border)'}">
            <i class="ti ${activo?'ti-circle-check':'ti-circle-x'}" style="font-size:13px"></i> ${label}
          </div>`;

        return `
          <div class="card" style="margin-bottom:20px">
            <div class="card-head" style="display:flex;align-items:center;gap:8px">
              <span style="background:${areaInfo.bg};color:${areaInfo.color};
                padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600">${areaInfo.nombre || r.área}</span>
              <div style="margin-left:auto;display:flex;gap:8px">
                <button id="btn-devolver-${r.ID_receta}" class="btn-peligro" style="font-size:12px;padding:5px 12px"
                  onclick="abrirModalDevolverReceta('${r.ID_receta}','${codigoArea}','${(r.nombre||'').replace(/'/g,"\\'")}')">
                  <i class="ti ti-x"></i> Devolver
                </button>
                <button id="btn-aprobar-${r.ID_receta}" class="btn-primario" style="font-size:12px;padding:5px 12px"
                  onclick="aprobarReceta('${r.ID_receta}','${codigoArea}',this)">
                  <i class="ti ti-check"></i> Aprobar
                </button>
              </div>
            </div>
            <div class="card-body">
              <!-- Nombre destacado — lo primero que se lee -->
              <div style="margin-bottom:14px">
                <h2 style="font-size:22px;font-weight:800;margin:0;line-height:1.2">${r.nombre}</h2>
                <span style="font-size:12px;color:var(--txt3);font-family:'DM Mono',monospace">${r.ID_receta} · versión ${r.versión||1}</span>
              </div>

              <!-- Datos clave, en cajas separadas — el rendimiento resaltado a propósito -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:14px">
                <div style="background:#FFF3E0;border:2px solid #FFB74D;border-radius:var(--r-md);padding:10px 12px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#E65100">Rendimiento</div>
                  <div style="font-size:18px;font-weight:800;color:#E65100;margin-top:2px">${formatearRendimiento(r)}</div>
                </div>
                <div style="background:var(--bg);border-radius:var(--r-md);padding:10px 12px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3)">Ingredientes</div>
                  <div style="font-size:18px;font-weight:700;margin-top:2px">${ingredientes.length}</div>
                </div>
                ${r.peso_harina_total_g ? `
                <div style="background:var(--bg);border-radius:var(--r-md);padding:10px 12px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3)">Harina base</div>
                  <div style="font-size:18px;font-weight:700;margin-top:2px">${r.peso_harina_total_g}g</div>
                </div>` : ''}
                ${tieneClasificacion ? `
                <div style="background:${r.tipo_preparacion?'#E8F5E9':'#FFEBEE'};border-radius:var(--r-md);padding:10px 12px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:${r.tipo_preparacion?'#2E7D32':'#C62828'}">Clasificación</div>
                  <div style="font-size:14px;font-weight:700;margin-top:4px;color:${r.tipo_preparacion?'#2E7D32':'#C62828'}">${formatearClasificacionBOL(r.tipo_preparacion)}</div>
                </div>` : ''}
              </div>

              <!-- Casillas activadas/desactivadas — visibles siempre, no solo cuando están marcadas -->
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
                ${chip('Se vende directo', vendeDirecto)}
                ${codigoArea === 'BOL' ? chip('Se congela', seCongela, '#1565C0', '#E3F2FD') : ''}
                ${r.variante_de_id ? chip('Es variante de otro producto', true, '#6A1B9A', '#F3E5F5') : ''}
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
                      ? `${formatearUnidadesIngrediente(ing.unidades||ing.gramos||0)} uni <span style="color:var(--txt3);font-weight:400;font-size:10px">(≈${parseFloat(ing.gramos||0).toFixed(0)}g)</span>`
                      : unidadRec === 'ml'
                      ? `${parseFloat(ing.ml||ing.gramos||0).toFixed(1)} ml`
                      : `${parseFloat(ing.gramos||0).toFixed(1)}g`;
                    return `
                    <tr>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--txt);font-weight:500">
                        ${ing.nombre}
                        <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:6px">${ing.id||''}</span>
                      </td>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:600">${displayVal}</td>
                      ${r._area === 'PAN' || r.área === 'Panadería' ? `<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:#E65100">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2);font-size:11px">${formatearCostoDecimal(ing.costo)}</td>
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
                      ${formatearCostoDecimal(ingredientes.reduce((s,i)=>s+(parseFloat(i.costo)||0),0))}
                    </td>
                  </tr>
                </tbody>
              </table>` : ''}
              ${insumos.length ? `
              <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
                <thead><tr>
                  <th style="text-align:left;padding:6px 10px;background:#FFF3E0;border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">📦 Insumo</th>
                  <th style="text-align:right;padding:6px 10px;background:#FFF3E0;border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Cantidad</th>
                  <th style="text-align:right;padding:6px 10px;background:#FFF3E0;border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Costo</th>
                </tr></thead>
                <tbody>
                  ${insumos.map(ins => `
                    <tr>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--txt);font-weight:500">
                        ${ins.nombre}
                        <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:6px">${ins.id||''}</span>
                      </td>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:600">${parseFloat(ins.unidades||0).toFixed(0)} uni</td>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2);font-size:11px">${formatearCostoDecimal(ins.costo)}</td>
                    </tr>`).join('')}
                  <tr style="background:#FFF3E0;font-weight:600">
                    <td style="padding:6px 10px" colspan="2">Total insumos</td>
                    <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">
                      ${formatearCostoDecimal(insumos.reduce((s,i)=>s+(parseFloat(i.costo)||0),0))}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div style="text-align:right;font-size:13px;font-weight:700;margin-bottom:12px;padding:6px 10px">
                Costo directo total (MP + insumos): ${formatearCostoDecimal(ingredientes.reduce((s,i)=>s+(parseFloat(i.costo)||0),0) + insumos.reduce((s,i)=>s+(parseFloat(i.costo)||0),0))}
              </div>` : ''}
              ${r.observaciones_procedimiento ? `
                <div style="margin-top:12px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);margin-bottom:5px">
                    <i class="ti ti-circle-check" style="color:#2E7D32"></i> Procedimiento / observaciones
                  </div>
                  <p style="font-size:13px;color:var(--txt2);line-height:1.6;background:var(--bg);padding:10px 12px;border-radius:var(--r-md)">${r.observaciones_procedimiento}</p>
                </div>` : `
                <div style="margin-top:12px;padding:8px 12px;background:#FFEBEE;border-radius:var(--r-md);font-size:12px;color:#C62828">
                  <i class="ti ti-alert-triangle"></i> Sin procedimiento/observaciones — la receta no explica cómo se prepara.
                </div>`}
              ${pasos.length ? `
                <div style="margin-top:10px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);margin-bottom:5px">
                    <i class="ti ti-circle-check" style="color:#2E7D32"></i> Pasos estructurados (${pasos.length})
                  </div>
                  <ol style="font-size:13px;color:var(--txt2);line-height:1.6;background:var(--bg);padding:10px 12px 10px 28px;border-radius:var(--r-md);margin:0">
                    ${pasos.map(p => `<li>${typeof p === 'string' ? p : (p.texto||p.descripcion||JSON.stringify(p))}</li>`).join('')}
                  </ol>
                </div>` : `
                <div style="margin-top:10px;padding:8px 12px;background:#FFF3E0;border-radius:var(--r-md);font-size:12px;color:#E65100">
                  <i class="ti ti-alert-triangle"></i> Sin pasos estructurados cargados.
                </div>`}
              ${r['sistematización_notas'] ? `
                <div style="margin-top:10px">
                  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);margin-bottom:5px">
                    <i class="ti ti-circle-check" style="color:#2E7D32"></i> Notas de sistematización
                  </div>
                  <p style="font-size:12px;color:var(--txt3);font-style:italic;background:var(--bg);padding:8px 12px;border-radius:var(--r-md)">${r['sistematización_notas']}</p>
                </div>` : `
                <div style="margin-top:10px;padding:6px 12px;font-size:11px;color:var(--txt3)">
                  <i class="ti ti-minus"></i> Sin notas de sistematización.
                </div>`}
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
      mensaje: `Tu receta "<strong>${r?.nombre || recetaId}</strong>" fue aprobada y está disponible en el maestro.`
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAviso, { cache: 'no-store' }).then(r => r.json()).then(d => console.log('[fën] Respuesta crear_aviso:', d)).catch(e => console.error('[fën] Error al crear aviso/correo:', e));

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
    const mensajeBase = `Tu receta "<strong>${r?.nombre || recetaId}</strong>" fue devuelta para revisión.`;
    const mensajeCompleto = comentario
      ? `${mensajeBase} Comentario del admin: <em>"${comentario}"</em>`
      : `${mensajeBase} Revisa los detalles y vuelve a enviarla.`;
    const payloadAviso = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCodigo,
      tipo: 'receta_devuelta',
      mensaje: mensajeCompleto
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAviso, { cache: 'no-store' }).then(r => r.json()).then(d => console.log('[fën] Respuesta crear_aviso:', d)).catch(e => console.error('[fën] Error al crear aviso/correo:', e));

    document.getElementById('modal-devolver-receta').classList.add('hidden');
    desbloquearBtn(btn, '<i class="ti ti-check"></i> Confirmar devolución', true);
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
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const data = await res.json();
    console.log('[fën] Respuesta eliminar:', data);
    if (!data.ok) {
      toast('Error al eliminar en Sheet: ' + data.msg, 'error');
      desbloquearBtn(btn, '<i class="ti ti-trash"></i> Eliminar', false);
      return;
    }
    App._ultimoMsgEliminar = data.msg;
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
  toast(App._ultimoMsgEliminar || 'Receta eliminada');

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
    await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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

  await escribirEnSheet('editar_campo_mp', { ID_MP: mpId, campo: 'estado', valor: 'recibida' });

  // Crear aviso para la jefa del área via GET (payload pequeño)
  if (areaCode) {
    const payloadAvisRec = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCode,
      tipo: 'mp_recibida',
      mensaje: `Tu solicitud de "<strong>${nombre}</strong>" fue recibida por administración — está siendo revisada.`,
      mp_id: mpId
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAvisRec, { cache: 'no-store' }).then(r => r.json()).then(d => console.log('[fën] Respuesta crear_aviso:', d)).catch(e => console.error('[fën] Error al crear aviso/correo:', e));
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
  let costoNeto = null, unidadCompra = null;

  if (sinCosto) {
    const quiereCostear = confirm(
      `"${mp.nombre}" no tiene costo cargado.\n\n` +
      `Aceptar = ingresar costo y unidad de compra ahora\n` +
      `Cancelar = agregarla igual, sin costo (queda marcada en rojo hasta que la costee más adelante)`
    );
    if (quiereCostear) {
      const precio = prompt(`Costo neto de "${mp.nombre}" (deje vacío para omitir):`);
      if (precio !== null && precio.trim() !== '' && !isNaN(parseFloat(precio)) && parseFloat(precio) > 0) {
        const unidad = prompt(
          `Unidad de compra de "${mp.nombre}"\nEjemplos: kg, 25kg, lt, un, 10un, 500ml`,
          'kg'
        );
        if (unidad && unidad.trim()) {
          costoNeto = parseFloat(precio);
          unidadCompra = unidad.trim().toLowerCase();
        }
      }
    }
    if (costoNeto === null) {
      if (!confirm(`"${mp.nombre}" quedará agregada sin costo. ¿Continuar?`)) {
        if (btn) desbloquearBtn(btn, '<i class="ti ti-check"></i> Agregar al maestro', false);
        return;
      }
    }
  }

  await escribirEnSheet('editar_campo_mp', { ID_MP: mpId, campo: 'estado', valor: 'activa' });

  if (costoNeto !== null) {
    // Un solo llamado con unidad_compra + costo_neto juntos — así editarMP() calcula
    // el costo por gramo con el dato correcto de una sola pasada, sin depender de que
    // una escritura previa ya haya quedado guardada al momento de leerla.
    const respAprobacion = await escribirEnSheet('editar_mp', { ID_MP: mpId, costo_neto: costoNeto, unidad_compra: unidadCompra });
    mp.unidad_compra = unidadCompra;
    mp.costo_neto = costoNeto;
    if (respAprobacion?.recetasActualizadas?.length) {
      alert(
        `✓ "${mp.nombre}" aprobada.\n\n` +
        `Se recalculó el costo automáticamente en ${respAprobacion.recetasActualizadas.length} receta(s) que ya la usaban:\n\n` +
        respAprobacion.recetasActualizadas.join('\n') +
        `\n\nQuedaron pendientes de aprobación — van a aparecerle en Aprobaciones.`
      );
    }
  }

  const areaCode = mp.area_codigo || mp.areas_habilitadas?.split(',')?.[0] || '';
  if (areaCode) {
    const payloadAviso = encodeURIComponent(JSON.stringify({
      accion: 'crear_aviso',
      area_codigo: areaCode,
      tipo: 'mp_aprobada',
      mensaje: '<strong>' + mp.nombre + '</strong> fue aprobada y esta disponible.' + (mp.receta_nombre ? ' Receta: <strong>' + mp.receta_nombre + '</strong>.' : '') + ' Actualiza tu receta.',
      mp_id: mpId
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAviso, { cache: 'no-store' }).then(r => r.json()).then(d => console.log('[fën] Respuesta crear_aviso:', d)).catch(e => console.error('[fën] Error al crear aviso/correo:', e));
  }

  mp.estado = 'activa';
  toast(`"${mp.nombre}" aprobada — aviso enviado a la jefa`);
  Cache.invalidar('mp_maestro');
  await cargarMP();
  renderVistaMP();
}

function asignarMPExistente(mpIdSolicitud, nombreSolicitud) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpIdSolicitud);
  const areaCode = mp?.area_codigo || mp?.areas_habilitadas || '';

  // Mostrar todas las MPs activas para que admin pueda asignar cualquiera
  const existentes = App.materiasPrimas.filter(m =>
    (m.estado === 'activa' || m.estado === 'recibida') && m.ID_MP !== mpIdSolicitud
  ).sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'));
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

  if (!mpExistId) { toast('Selecciona una MP existente'); desbloquearBtn(btn, '<i class="ti ti-check"></i> Confirmar asignación', false); return; }

  // 1. Marcar solicitud como reemplazada + guardar cuál MP la reemplaza (dato persistente)
  const r1 = await escribirEnSheet('editar_campo_mp', { ID_MP: mpSolicitudId, campo: 'estado', valor: 'reemplazada' });
  console.log('[fën] marcar reemplazada:', r1);
  const r1b = await escribirEnSheet('editar_campo_mp', { ID_MP: mpSolicitudId, campo: 'reemplazada_por', valor: mpExistId });
  console.log('[fën] guardar reemplazada_por:', r1b);

  // 2. Habilitar el área en la MP existente
  const mpExist = App.materiasPrimas.find(m => m.ID_MP === mpExistId);
  if (mpExist && areaCode) {
    const areasActuales = (mpExist.areas_habilitadas || '').split(',').map(a => a.trim()).filter(Boolean);
    if (!areasActuales.includes(areaCode)) {
      areasActuales.push(areaCode);
      const nuevasAreas = areasActuales.join(',');
      const r2 = await escribirEnSheet('editar_campo_mp', { ID_MP: mpExistId, campo: 'areas_habilitadas', valor: nuevasAreas });
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
      mensaje: `Tu solicitud "<strong>${nombreOriginal}</strong>"${recetaInfo} fue resuelta: usa "<strong>${nombreExist}</strong>" en su lugar. Ve a Mis recetas → edita la receta y presiona Reemplazar.`,
      mp_id: mpSolicitudId
    }));
    fetch(FEN.WEBAPP_URL + '?payload=' + payloadAvisAsig, { cache: 'no-store' }).then(r => r.json()).then(d => console.log('[fën] Respuesta crear_aviso:', d)).catch(e => console.error('[fën] Error al crear aviso/correo:', e));
  }

  toast(`Asignado "${nombreExist}" — aviso enviado a la jefa`);
  desbloquearBtn(btn, '<i class="ti ti-check"></i> Confirmar asignación', true);
  Cache.invalidar('mp_maestro');
  renderVistaMP();
}

// ── ADMIN: MATERIAS PRIMAS ────────────────────────────────────
async function cargarSolicitudesHabilitacion() {
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_solicitudes_habilitacion' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const data = await res.json();
    App._solicitudesHabilitacion = data.solicitudes || [];
    if (App.vistaActual === 'materias-primas') renderVistaMP();
  } catch(e) {
    console.warn('[fën] No se pudieron cargar solicitudes de habilitación:', e.message);
    App._solicitudesHabilitacion = [];
  }
}

async function habilitarMPDesdeSolicitud(id, mpId, areaCodigo, nombreMP, btn) {
  if (btn) bloquearBtn(btn, 'Habilitando...');
  try {
    const resp = await escribirEnSheet('resolver_solicitud_habilitacion', { id, mp_id: mpId, area_codigo: areaCodigo });
    if (resp?.ok) {
      toast(`"${nombreMP}" habilitada para ${areaCodigo}`);
      App._solicitudesHabilitacion = (App._solicitudesHabilitacion || []).filter(s => s.id !== id);
      const mpLocal = App.materiasPrimas.find(m => m.ID_MP === mpId);
      if (mpLocal) {
        const areas = (mpLocal.areas_habilitadas || '').split(',').map(a=>a.trim()).filter(Boolean);
        if (!areas.includes(areaCodigo)) areas.push(areaCodigo);
        mpLocal.areas_habilitadas = areas.join(',');
      }
      renderVistaMP();
    } else {
      toast('No se pudo habilitar: ' + (resp?.msg || ''), 'error');
      if (btn) desbloquearBtn(btn, '<i class="ti ti-check"></i> Habilitar', true);
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
    if (btn) desbloquearBtn(btn, '<i class="ti ti-check"></i> Habilitar', true);
  }
}

function renderVistaMP() {
  const mp = App.materiasPrimas;
  const filtro = App._filtroMP || 'todos';
  const busqueda = (App._busquedaMP || '').trim().toLowerCase();

  // Solicitudes de habilitación (MP que ya existe, esperando que se habilite
  // para otra área) — viven en su propia hoja, se cargan aparte de App.materiasPrimas
  if (App._solicitudesHabilitacion === undefined) {
    App._solicitudesHabilitacion = [];
    cargarSolicitudesHabilitacion();
  }
  const solicitudesHabilitacion = App._solicitudesHabilitacion || [];

  // "Sin costo" significa cosas distintas según el tipo: para MP/Insumo es costo_neto=0
  // (nunca se le puso precio); para sub-recetas es costo_por_gramo=0 (nunca se aprobó,
  // o sus propios ingredientes también están sin costo) — costo_neto siempre es $0 en
  // sub-recetas por diseño, no es un indicador válido de "sin costo" para ese tipo.
  const estaSinCosto = m => m.estado === 'activa' && (
    m.tipo === 'sub_receta' ? (parseFloat(m.costo_por_gramo)||0) === 0 : (parseFloat(m.costo_neto)||0) === 0
  );
  let mpFiltrada = filtro === 'todos' ? mp
    : filtro === 'sin_costo' ? mp.filter(estaSinCosto)
    : mp.filter(m => (m.tipo || 'mp') === filtro);
  if (busqueda) mpFiltrada = mpFiltrada.filter(m => (m.nombre || '').toLowerCase().includes(busqueda));
  const pendientes = mp.filter(m => m.estado === 'pendiente' || m.estado === 'recibida').filter(m => m.tipo !== 'sub_receta');
  const sinCostoCount = mp.filter(estaSinCosto).length;
  const vista = document.getElementById('vista-mp');
  const tabs = [
    { key: 'todos',       label: 'Todos' },
    { key: 'mp',          label: 'Materia Prima' },
    { key: 'insumo',      label: 'Insumos' },
    { key: 'sub_receta',  label: 'Sub recetas' },
    { key: 'sin_costo',   label: `⚠ Sin costo (${sinCostoCount})` },
  ];
  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Materias primas</h1>
      <button class="btn-primario" onclick="abrirFormNuevaMP()">
        <i class="ti ti-plus"></i> Nueva MP
      </button>
    </div>
    <div class="campo" style="max-width:320px;margin-bottom:12px">
      <input type="text" id="buscar-mp" placeholder="🔎 Buscar por nombre..." value="${App._busquedaMP || ''}"
        oninput="App._buscarMPFocused=true;App._busquedaMP=this.value;renderVistaMP();"
        onfocus="App._buscarMPFocused=true"
        style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
    </div>
    ${solicitudesHabilitacion.length ? `
      <div class="card" style="margin-bottom:16px;border-color:#90CAF9">
        <div class="card-head" style="background:#E3F2FD;color:#1565C0">
          <i class="ti ti-bell"></i>
          Solicitudes de habilitación (${solicitudesHabilitacion.length})
        </div>
        ${solicitudesHabilitacion.map(s => {
          const areaLabel = FEN.AREAS[s.area_codigo]?.nombre || s.area_codigo;
          return `
          <div style="padding:14px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:180px">
              <div style="font-size:14px;font-weight:600">${s.mp_nombre}</div>
              <div style="font-size:11px;color:var(--txt2);margin-top:2px">
                <strong>${areaLabel}</strong> quiere usar esta MP que ya existe en el sistema — no necesita revisión de precio, solo habilitar el área.
              </div>
            </div>
            <button class="btn-primario" style="font-size:12px;padding:5px 10px"
              onclick="habilitarMPDesdeSolicitud('${s.id}','${s.mp_id}','${s.area_codigo}','${(s.mp_nombre||'').replace(/'/g,"\\'")}',this)">
              <i class="ti ti-check"></i> Habilitar
            </button>
          </div>`;
        }).join('')}
      </div>` : ''}
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
              <div style="font-size:14px;font-weight:600">${p.nombre} ${p.tipo === 'insumo' ? '<span style="font-size:10px;color:#E65100;font-weight:600;background:#FFF3E0;padding:2px 6px;border-radius:99px;margin-left:4px">📦 Insumo</span>' : ''}</div>
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
                onclick="aprobarMP('${p.ID_MP}',this)" title="Agregar al maestro">
                <i class="ti ti-check"></i> Agregar al maestro
              </button>
              <button class="btn-secundario" style="font-size:12px;padding:5px 10px"
                onclick="asignarMPExistente('${p.ID_MP}','${p.nombre}')" title="Asignar a una MP/insumo ya existente">
                <i class="ti ti-link"></i> Usar existente
              </button>
              <button class="btn-secundario" style="font-size:12px;padding:5px 10px;border-color:#EF9A9A;color:#C62828"
                onclick="eliminarSolicitudMP('${p.ID_MP}','${p.nombre}',this)" title="Eliminar esta solicitud">
                <i class="ti ti-trash"></i> Eliminar
              </button>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">
      ${tabs.map(t => `
        <button class="${filtro === t.key ? 'btn-primario' : 'btn-secundario'}"
          style="font-size:12px;padding:6px 14px"
          onclick="App._filtroMP='${t.key}';renderVistaMP()">
          ${t.label}
        </button>
      `).join('')}
    </div>
    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Catálogo (${mpFiltrada.filter(m=>m.estado==='activa').length} activas)</div>
      <div style="overflow-x:auto">
      <table class="tabla-vista" style="min-width:680px">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">MP</th>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Categoría</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo neto</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo unitario</th>
          <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Estado</th>
          <th style="padding:9px 16px;background:var(--bg);border-bottom:1px solid var(--border)"></th>
        </tr></thead>
        <tbody>
          ${mpFiltrada.map(m => {
            const est = m.estado==='activa'
              ? {c:'#2E7D32',bg:'#E8F5E9',l:'Activa'}
              : m.estado==='pendiente'
              ? {c:'#1565C0',bg:'#E3F2FD',l:'Pendiente'}
              : m.estado==='reemplazada'
              ? {c:'#E65100',bg:'#FFF3E0',l:'Reemplazada' + (m.reemplazada_por ? ` por ${App.materiasPrimas.find(x=>x.ID_MP===m.reemplazada_por)?.nombre || m.reemplazada_por}` : '')}
              : {c:'#9E9E9E',bg:'#F5F5F5',l:'Inactiva'};
            return `<tr>
              <td class="td-nombre">${m.nombre}
                ${(!m.costo_neto||parseFloat(m.costo_neto)===0)&&m.estado==='activa' ? '<span style="font-size:10px;color:#C62828;font-weight:600;margin-left:4px">⚠ sin costo</span>' : ''}
                <br><span style="font-size:11px;color:var(--txt3);font-weight:400">${m.ID_MP}</span>
              </td>
              <td style="font-size:13px;color:var(--txt2)">${m.categoría||'—'}</td>
              <td class="td-num" style="${(!m.costo_neto||parseFloat(m.costo_neto)===0)&&m.estado==='activa'?'color:#C62828':''}">${clp(m.costo_neto)||'—'}</td>
              <td class="td-num" style="font-size:11px">${parseFloat(m.costo_por_gramo||0).toFixed(4)}${(() => { const u=(m.unidad_compra||'kg').toLowerCase(); return u==='un'?'/u':u==='lt'?'/ml':'/g'; })()}</td>
              <td style="text-align:center">
                <span class="estado-badge" style="color:${est.c};background:${est.bg}">${est.l}</span>
              </td>
              <td style="text-align:right;padding:6px 12px">
                <button class="btn-secundario" style="font-size:14px;padding:6px 14px"
                  onclick='abrirAccionesMP(${JSON.stringify(m.ID_MP)})' title="Acciones">
                  <i class="ti ti-dots-vertical"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      </div>
    </div>
  `;
  mostrarVista('mp');
  if (App._buscarMPFocused) {
    const inputBusqueda = document.getElementById('buscar-mp');
    if (inputBusqueda) {
      inputBusqueda.focus();
      inputBusqueda.setSelectionRange(inputBusqueda.value.length, inputBusqueda.value.length);
    }
  }
}

async function renombrarMPUI(mpId, nombreActual) {
  const nuevoNombre = prompt(`Nuevo nombre para "${nombreActual}":`, nombreActual);
  if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === nombreActual) return;

  if (!confirm(`¿Renombrar "${nombreActual}" a "${nuevoNombre.trim()}"?\n\nSe actualizará automáticamente en todas las recetas que la usan. Las que estaban aprobadas quedarán pendientes de aprobación, listas para que las revise en Aprobaciones (el costo no cambia, solo el nombre).`)) return;

  toast('Renombrando, puede tardar unos segundos...');
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'renombrar_mp', mp_id: mpId, nuevo_nombre: nuevoNombre.trim() }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (data.ok) {
      const mpLocal = App.materiasPrimas.find(m => m.ID_MP === mpId);
      if (mpLocal) mpLocal.nombre = nuevoNombre.trim();
      Cache.invalidar('mp_maestro');
      const detalle = data.recetas && data.recetas.length ? '\n\nRecetas actualizadas:\n' + data.recetas.join('\n') : '\n\n(no estaba siendo usada en ninguna receta)';
      alert('✓ ' + data.msg + detalle);
      renderVistaMP();
    } else {
      toast('Error: ' + (data.msg||''), 'error');
    }
  } catch(e) {
    toast('No se pudo renombrar: ' + e.message, 'error');
  }
}

async function verRecetasQueUsanMP(mpId, nombre) {
  toast('Buscando en las 4 áreas...');
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'buscar_recetas_usando_mp', mp_id: mpId }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) { toast('Error: ' + (data.msg||''), 'error'); return; }
    if (!data.recetas.length) {
      alert(`"${nombre}" no está siendo usada en ninguna receta actualmente.`);
      return;
    }
    const estados = { consolidada: 'Aprobada', en_prueba: 'En prueba', pendiente_aprobación: 'Pendiente de aprobación', borrador: 'Borrador' };
    const lista = data.recetas.map(r => `• [${r.area}] ${r.nombre} — ${estados[r.estado] || r.estado}`).join('\n');
    alert(
      `"${nombre}" se usa en ${data.recetas.length} receta(s):\n\n${lista}\n\n` +
      `Si le acaba de asignar costo a "${nombre}", cada una de estas recetas debe abrirse, guardarse y (si corresponde) volver a enviarse a revisión para que tome el costo actualizado.`
    );
  } catch(e) {
    toast('No se pudo buscar: ' + e.message, 'error');
  }
}

function abrirAccionesMP(mpId) {
  const m = App.materiasPrimas.find(x => x.ID_MP === mpId);
  if (!m) return;

  document.getElementById('acciones-mp-titulo').textContent = m.nombre;
  document.getElementById('acciones-mp-subtitulo').textContent = m.ID_MP + ' · ' + (m.categoría || 'Sin categoría');

  const nombreEscapado = (m.nombre || '').replace(/'/g, "\\'");
  const tipoActual = m.tipo || 'mp';
  const unidadActual = (m.unidad_compra || 'kg').toLowerCase();
  const esInactiva = m.estado === 'inactiva';

  const botones = [
    { icono: 'ti-edit', label: 'Editar precio', accion: `editarMP('${mpId}')` },
    { icono: 'ti-receipt-tax', label: 'Editar IVA / impuesto adicional', accion: `editarImpuestosMP('${mpId}')` },
    { icono: 'ti-search', label: 'Ver recetas que la usan', accion: `verRecetasQueUsanMP('${mpId}','${nombreEscapado}')` },
    { icono: 'ti-pencil', label: 'Editar nombre', accion: `renombrarMPUI('${mpId}','${nombreEscapado}')` },
    { icono: esInactiva ? 'ti-eye' : 'ti-eye-off', label: esInactiva ? 'Activar' : 'Desactivar',
      color: esInactiva ? '#2E7D32' : '#C62828', accion: `toggleEstadoMP('${mpId}','${m.estado}')` },
    { icono: 'ti-layout-grid', label: 'Gestionar áreas', accion: `gestionarAreasMP('${mpId}')` },
  ];
  if (tipoActual !== 'sub_receta') {
    botones.push({ icono: 'ti-package', label: tipoActual === 'insumo' ? 'Marcar como Materia Prima' : 'Marcar como Insumo',
      accion: `cambiarTipoMP('${mpId}','${tipoActual}','${nombreEscapado}')` });
    botones.push({ icono: 'ti-ruler-2', label: 'Cambiar unidad de compra (actual: ' + unidadActual + ')',
      accion: `cambiarUnidadCompra('${mpId}','${unidadActual}','${nombreEscapado}')` });
  }
  if (m.estado !== 'reemplazada') {
    botones.push({ icono: 'ti-arrows-join', label: 'Fusionar con otra MP (duplicado)', color: '#6A1B9A',
      accion: `fusionarMPUI('${mpId}','${nombreEscapado}')` });
  }

  document.getElementById('acciones-mp-botones').innerHTML = botones.map(b => `
    <button class="btn-secundario" style="width:100%;justify-content:flex-start;gap:10px;padding:12px 14px;font-size:14px;${b.color?'color:'+b.color:''}"
      onclick="cerrarModalAccionesMP(); ${b.accion}">
      <i class="ti ${b.icono}" style="font-size:18px"></i> ${b.label}
    </button>
  `).join('');

  document.getElementById('modal-acciones-mp').classList.remove('hidden');
}

function cerrarModalAccionesMP() {
  document.getElementById('modal-acciones-mp').classList.add('hidden');
}

// Espejo del parser de webapp.gs — interpreta "kg", "25kg", "un", "10un", "500ml", etc.
function parsearUnidadCompraJS(unidadStr) {
  const s = (unidadStr || 'kg').toString().trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*(kg|g|lt|l|ml|un|unidad|unidades)$/);
  if (!m) return null;
  const cantidad = m[1] ? parseFloat(m[1]) : 1;
  const unidad = m[2];
  if (unidad === 'un' || unidad === 'unidad' || unidad === 'unidades') return { factorBase: cantidad };
  if (unidad === 'kg' || unidad === 'lt' || unidad === 'l') return { factorBase: cantidad * 1000 };
  if (unidad === 'g' || unidad === 'ml') return { factorBase: cantidad };
  return { factorBase: 1000 };
}

async function cambiarUnidadCompra(mpId, unidadActual, nombre) {
  const respuesta = prompt(
    `Unidad de compra actual de "${nombre}": ${unidadActual}\n\n` +
    `Escribe la nueva unidad. Ejemplos válidos:\n` +
    `kg = por kilo suelto\n25kg = saco de 25 kilos\nlt = por litro\nun = por unidad\n10un = paquete de 10 unidades\n500ml = envase de 500ml`,
    unidadActual
  );
  if (!respuesta) return;
  const nuevaUnidad = respuesta.trim().toLowerCase();
  const parsed = parsearUnidadCompraJS(nuevaUnidad);
  if (!parsed) { toast('Formato inválido — ej: kg, 25kg, un, 10un, 500ml', 'error'); return; }

  const item = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!item) return;

  // Un solo llamado con unidad_compra + costo_neto juntos — evita depender de que
  // una escritura previa separada ya haya quedado guardada al momento de leerla.
  const resp = await escribirEnSheet('editar_mp', { ID_MP: mpId, costo_neto: item.costo_neto || 0, unidad_compra: nuevaUnidad });

  item.unidad_compra = nuevaUnidad;
  const bruto = (parseFloat(item.costo_neto) || 0) * 1.19;
  item.costo_por_gramo = bruto / parsed.factorBase;
  item.costo_por_kg = bruto;

  toast(`"${nombre}" ahora se compra por "${nuevaUnidad}" — costo recalculado`);
  if (resp?.recetasActualizadas?.length) {
    alert(
      `Se recalculó el costo automáticamente en ${resp.recetasActualizadas.length} receta(s) que usan "${nombre}":\n\n` +
      resp.recetasActualizadas.join('\n') +
      `\n\nQuedaron pendientes de aprobación — van a aparecerle en Aprobaciones.`
    );
  }
  Cache.invalidar('mp_maestro');
  await cargarMP();
  renderVistaMP();
}

async function cambiarTipoMP(mpId, tipoActual, nombre) {
  const nuevoTipo = tipoActual === 'insumo' ? 'mp' : 'insumo';
  const etiqueta = nuevoTipo === 'insumo' ? 'Insumo' : 'Materia Prima';
  if (!confirm(`¿Marcar "${nombre}" como ${etiqueta}?\n\nEsto cambia dónde aparece en los desplegables de recetas.`)) return;

  await escribirEnSheet('editar_campo_mp', { ID_MP: mpId, campo: 'tipo', valor: nuevoTipo });

  const item = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (item) item.tipo = nuevoTipo;
  toast(`"${nombre}" ahora es ${etiqueta}`);
  Cache.invalidar('mp_maestro');
  renderVistaMP();
}

// ── ADMIN: COSTOS ─────────────────────────────────────────────
// ── BOL: RECETAS DEL DÍA (rellenos y otras preparaciones) ─────
let _planRellenosCache = null;

async function renderVistaRellenosOtrasRecetas() {
  const vista = document.getElementById('vista-rellenos-otras-recetas');
  vista.innerHTML = '<div class="vista-header"><h1 class="vista-titulo">Recetas del día</h1></div><p style="color:var(--txt3)">Cargando...</p>';
  mostrarVista('rellenos-otras-recetas');

  // Cargar plan guardado (cantidades confirmadas de rellenos) y el plan PS/PC (para la sugerencia)
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_rellenos' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    _planRellenosCache = data.filas || [];
  } catch(e) {
    _planRellenosCache = [];
  }
  try {
    const payload2 = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_ps_pc' }));
    const res2 = await fetch(FEN.WEBAPP_URL + '?payload=' + payload2, { redirect: 'follow', cache: 'no-store' });
    const data2 = await res2.json();
    _planPSPCCache = data2.filas || [];
  } catch(e) {
    _planPSPCCache = [];
  }

  const candidatas = App.recetas.filter(r => {
    if (r.estado !== 'consolidada') return false;
    if (r.tipo_preparacion === 'relleno') return true; // clasificación nueva, explícita
    if (['producto_simple','producto_compuesto','masa_base'].includes(r.tipo_preparacion)) return false; // ya clasificada como otra cosa
    // Sin clasificar o con valor viejo (masa/elaboracion_previa): solo cuenta si es sub-receta,
    // nunca una receta final sin clasificar (para no mostrarla acá por error)
    return r.tipo_receta === 'sub_receta';
  });

  if (!candidatas.length) {
    vista.innerHTML = `
      <div class="vista-header"><h1 class="vista-titulo">Recetas del día</h1></div>
      <div class="empty-state">
        <i class="ti ti-egg"></i>
        <h2>Sin rellenos u otras masas configuradas</h2>
        <p>Marque una receta o sub-receta como "Relleno" u "Otra masa" en su formulario para que aparezca acá.</p>
      </div>`;
    return;
  }

  const filasHtml = candidatas.map(r => {
    const guardado = _planRellenosCache.find(p => p.ID_receta === r.ID_receta);
    const cantidadGuardada = guardado ? parseFloat(guardado.cantidad_planificada) || 0 : 0;
    const esGramos = (r.porciones_base_unidad || 'un') === 'g';
    const unidadLabel = esGramos ? 'g' : 'uni';

    // Sugerencia: buscar en qué Productos Compuestos planificados esta semana (BOL_plan_ps_pc)
    // se usa esta preparación como ingrediente. IMPORTANTE: el ID de la receta (ej. BOL008) y
    // el ID que tiene esa misma sub-receta en MP_maestro (ej. SR008) son DISTINTOS por diseño
    // — hay que resolver primero cuál es su ID real en el catálogo, buscando por nombre.
    const mpDeEstaReceta = App.materiasPrimas.find(m => m.nombre === r.nombre && m.tipo === 'sub_receta');
    let sugerenciaGramos = 0;
    if (mpDeEstaReceta) {
      (_planPSPCCache || []).filter(p => p.tipo_preparacion === 'producto_compuesto').forEach(entrada => {
        const final = App.recetas.find(x => x.ID_receta === entrada.ID_receta);
        if (!final) return;
        let ings = [];
        try { ings = JSON.parse(final.ingredientes_JSON || '[]'); } catch(e) {}
        const usoEnEsta = ings.find(i => i.id === mpDeEstaReceta.ID_MP);
        if (!usoEnEsta) return;
        const porcionesFinal = parseFloat(final.porciones_base) || 1;
        const gramosPorUnidadFinal = (parseFloat(usoEnEsta.gramos) || 0) / porcionesFinal;
        sugerenciaGramos += gramosPorUnidadFinal * (parseFloat(entrada.cantidad) || 0);
      });
    }

    const tipoLabel = r.tipo_preparacion === 'relleno' ? '🧁 Relleno' : '⚠️ Sin clasificar';

    return `
      <div class="card" style="margin-bottom:14px" data-receta-id="${r.ID_receta}">
        <div class="card-head">
          <span style="font-size:12px;font-weight:600;color:var(--txt3)">${tipoLabel}</span>
          <span style="margin-left:8px;font-weight:700">${r.nombre}</span>
          <button class="btn-secundario" style="margin-left:auto;font-size:11px;padding:4px 10px"
            onclick="toggleDetalleRelleno('${r.ID_receta}')">
            <i class="ti ti-list-details"></i> Ver detalle escalado
          </button>
        </div>
        <div style="padding:12px 16px">
          ${sugerenciaGramos > 0 ? `
            <p style="font-size:12px;color:#1565C0;background:#E3F2FD;padding:6px 10px;border-radius:var(--r-sm);margin-bottom:10px">
              <i class="ti ti-bulb"></i> Sugerido según el plan semanal: <strong>${Math.round(sugerenciaGramos).toLocaleString('es-CL')}g</strong>
            </p>` : `
            <p style="font-size:11px;color:var(--txt3);margin-bottom:10px">Sin productos planificados esta semana que la usen — puede igual planificar la cantidad que necesite.</p>`}
          <div style="display:flex;gap:8px;align-items:center">
            <label style="font-size:12px;color:var(--txt2)">Planificar para esta semana:</label>
            <input type="number" min="0" step="0.1" style="max-width:120px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm)"
              id="cant-relleno-${r.ID_receta}" value="${cantidadGuardada || ''}" placeholder="0">
            <span style="font-size:12px;color:var(--txt3)">${unidadLabel}</span>
            <button class="btn-primario" style="font-size:12px;padding:6px 14px"
              onclick="guardarCantidadRelleno('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}',this)">
              <i class="ti ti-device-floppy"></i> Guardar
            </button>
            ${guardado?.hecho === true || guardado?.hecho === 'true' ? `
              <span style="font-size:11px;color:#2E7D32"><i class="ti ti-check"></i> Hecho</span>
              <button class="btn-secundario" style="font-size:11px;padding:6px 10px"
                onclick="desmarcarRellenoHecho('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}')">Desmarcar</button>` : `
              <button class="btn-secundario" style="font-size:11px;padding:6px 10px"
                onclick="marcarRellenoHecho('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}')">Marcar hecho</button>`}
          </div>
          <div id="detalle-relleno-${r.ID_receta}" class="hidden" style="margin-top:12px"></div>
        </div>
      </div>`;
  }).join('');

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">Bollería</div>
        <h1 class="vista-titulo">Recetas del día</h1>
      </div>
    </div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:16px">
      Rellenos y otras masas que usted elabora con su propio ritmo — planifique la cantidad que va a preparar esta semana.
    </p>
    ${filasHtml}
    ${construirListaCompraRellenos(candidatas)}
  `;
}

// Suma la MP necesaria para elaborar los rellenos, escalando cada receta a la
// cantidad CONFIRMADA por la jefa (no la sugerencia) — solo cuenta los que
// realmente tienen algo planificado.
function construirListaCompraRellenos(candidatas) {
  const totalesMP = {};
  let hayAlgoPlanificado = false;

  candidatas.forEach(r => {
    const guardado = (_planRellenosCache || []).find(p => p.ID_receta === r.ID_receta);
    const cantidad = guardado ? parseFloat(guardado.cantidad_planificada) || 0 : 0;
    if (cantidad <= 0) return;
    hayAlgoPlanificado = true;

    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseFloat(r.porciones_base) || 1;
    const factor = cantidad / porciones;

    ingredientes.forEach(ing => {
      const totalGramos = (parseFloat(ing.gramos) || 0) * factor;
      expandirIngredienteRecursivo(ing.id, totalGramos, totalesMP);
    });
  });

  if (!hayAlgoPlanificado) return '';

  const lista = Object.values(totalesMP).sort((a,b) => b.gramos - a.gramos);

  return `
    <div class="card" style="margin-top:16px">
      <div class="card-head"><i class="ti ti-shopping-cart"></i> Lista de compra — Rellenos y preparaciones</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Materia Prima</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Cantidad necesaria</th>
        </tr></thead>
        <tbody>
          ${lista.map(it => {
            const esPorUnidad = it.unidadCompra === 'un' || it.unidadCompra === 'unidad' || it.unidadCompra === 'unidades';
            const display = esPorUnidad
              ? `${Math.ceil(it.gramos)} un`
              : it.gramos >= 1000 ? `${(it.gramos/1000).toFixed(2)} kg` : `${Math.round(it.gramos)} g`;
            return `<tr>
              <td class="td-nombre">${it.nombre}${it.sinDesarmar ? ' <span style="color:#E65100;font-size:10px" title="No se encontró la receta detallada de esta sub-receta — falta desglosar en MP real">⚠ sin desglosar</span>' : ''}</td>
              <td class="td-num" style="font-weight:600">${display}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:var(--txt3);padding:10px 16px">
        Suma según las cantidades que <strong>confirmó</strong> arriba (no la sugerencia) — solo cuenta lo que ya guardó.
      </p>
    </div>`;
}

function toggleDetalleRelleno(recetaId) {
  const cont = document.getElementById('detalle-relleno-' + recetaId);
  if (!cont) return;
  if (!cont.classList.contains('hidden')) { cont.classList.add('hidden'); return; }

  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;
  const cantidadInput = parseFloat(document.getElementById('cant-relleno-' + recetaId)?.value) || 0;
  const porciones = parseFloat(r.porciones_base) || 1;
  const factor = cantidadInput > 0 ? cantidadInput / porciones : 1;

  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}

  cont.classList.remove('hidden');
  cont.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border)">Ingrediente</th>
        <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border)">
          ${cantidadInput > 0 ? 'Cantidad escalada' : 'Cantidad receta base'}
        </th>
      </tr></thead>
      <tbody>
        ${ingredientes.map(ing => `
          <tr>
            <td style="padding:5px 10px;border-bottom:1px solid var(--border)">${ing.nombre}</td>
            <td style="padding:5px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace">
              ${(parseFloat(ing.gramos||0) * factor).toFixed(1)}g
            </td>
          </tr>`).join('')}
      </tbody>
    </table>
    ${cantidadInput > 0 ? `<p style="font-size:11px;color:var(--txt3);margin-top:6px">Receta base rinde ${porciones}${r.porciones_base_unidad==='g'?'g':' uni'} — escalado ×${factor.toFixed(2)}</p>` : ''}
  `;
}

async function guardarCantidadRelleno(recetaId, nombre, btn) {
  const cantidad = parseFloat(document.getElementById('cant-relleno-' + recetaId)?.value) || 0;
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  const unidad = (r?.porciones_base_unidad || 'un') === 'g' ? 'g' : 'uni';
  if (btn) bloquearBtn(btn, 'Guardando...');
  try {
    await escribirEnSheet('guardar_plan_relleno', {
      registro: { ID_receta: recetaId, nombre, cantidad_planificada: cantidad, unidad, hecho: false }
    });
    toast(`Plan de "${nombre}" guardado`);
    const idx = _planRellenosCache.findIndex(p => p.ID_receta === recetaId);
    const nuevo = { ID_receta: recetaId, nombre, cantidad_planificada: cantidad, unidad, hecho: false };
    if (idx >= 0) _planRellenosCache[idx] = nuevo; else _planRellenosCache.push(nuevo);
  } catch(e) {
    toast('Error al guardar', 'error');
  }
  if (btn) desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar', true);
}

async function marcarRellenoHecho(recetaId, nombre) {
  const cantidad = parseFloat(document.getElementById('cant-relleno-' + recetaId)?.value) || 0;
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  const unidad = (r?.porciones_base_unidad || 'un') === 'g' ? 'g' : 'uni';
  try {
    await escribirEnSheet('guardar_plan_relleno', {
      registro: { ID_receta: recetaId, nombre, cantidad_planificada: cantidad, unidad, hecho: true }
    });
    toast(`"${nombre}" marcado como hecho`);
    renderVistaRellenosOtrasRecetas();
  } catch(e) {
    toast('Error al guardar', 'error');
  }
}

async function desmarcarRellenoHecho(recetaId, nombre) {
  const guardado = (_planRellenosCache || []).find(p => p.ID_receta === recetaId);
  const cantidad = guardado ? parseFloat(guardado.cantidad_planificada) || 0 : 0;
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  const unidad = (r?.porciones_base_unidad || 'un') === 'g' ? 'g' : 'uni';
  try {
    await escribirEnSheet('guardar_plan_relleno', {
      registro: { ID_receta: recetaId, nombre, cantidad_planificada: cantidad, unidad, hecho: false }
    });
    toast(`"${nombre}" desmarcado`);
    renderVistaRellenosOtrasRecetas();
  } catch(e) {
    toast('Error al guardar', 'error');
  }
}

// ── BOL: PLANIFICACIÓN PS/PC (grilla estilo stock B2C) ─────────
let _planPSPCCache = null;
let _seleccionPSPC = null;

async function renderVistaPlanPSPC() {
  const vista = document.getElementById('vista-plan-ps-pc');
  vista.innerHTML = '<div class="vista-header"><h1 class="vista-titulo">Planificación PS/PC</h1></div><p style="color:var(--txt3)">Cargando...</p>';
  mostrarVista('plan-ps-pc');

  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_ps_pc' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    _planPSPCCache = data.filas || [];
  } catch(e) {
    _planPSPCCache = [];
  }

  const filtro = App._filtroPSPC || 'todos';
  const productos = App.recetas.filter(r =>
    r.estado === 'consolidada' && (r.tipo_preparacion === 'producto_simple' || r.tipo_preparacion === 'producto_compuesto')
  );
  const productosFiltrados = filtro === 'todos' ? productos : productos.filter(r => r.tipo_preparacion === filtro);
  const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb'];

  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Planificación PS/PC</h1></div>

    <div style="display:flex;gap:6px;margin-bottom:14px">
      <button class="${filtro==='todos'?'btn-primario':'btn-secundario'}" style="font-size:12px;padding:6px 14px" onclick="App._filtroPSPC='todos';renderVistaPlanPSPC()">Todos</button>
      <button class="${filtro==='producto_simple'?'btn-primario':'btn-secundario'}" style="font-size:12px;padding:6px 14px" onclick="App._filtroPSPC='producto_simple';renderVistaPlanPSPC()">Producto Simple</button>
      <button class="${filtro==='producto_compuesto'?'btn-primario':'btn-secundario'}" style="font-size:12px;padding:6px 14px" onclick="App._filtroPSPC='producto_compuesto';renderVistaPlanPSPC()">Producto Compuesto</button>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-grid-dots"></i> Seleccionar producto</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:8px;padding:16px">
        ${productosFiltrados.map(r => `
          <button data-id="${r.ID_receta}"
            style="padding:10px 6px;border-radius:var(--r-md);border:2px solid ${_seleccionPSPC?.ID_receta===r.ID_receta?'var(--area-color, #1565C0)':'var(--border)'};
              background:${_seleccionPSPC?.ID_receta===r.ID_receta?'var(--area-bg, #E3F2FD)':'var(--surface)'};cursor:pointer;text-align:center;font-size:12px"
            onclick="seleccionarProductoPSPC('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}')">
            ${r.nombre}
          </button>
        `).join('')}
        ${!productosFiltrados.length ? '<p style="color:var(--txt3);grid-column:1/-1">Sin productos clasificados como Producto Simple/Compuesto todavía — clasifíquelos desde el formulario de receta.</p>' : ''}
      </div>
      ${_seleccionPSPC ? `
      <div style="padding:0 16px 16px;border-top:1px solid var(--border);padding-top:16px">
        <p style="font-size:13px;font-weight:600;margin-bottom:10px">Seleccionado: ${_seleccionPSPC.nombre}</p>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
          <label style="font-size:12px">Cantidad:</label>
          <input type="number" id="cant-pspc" min="1" step="1" style="max-width:100px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--r-sm)" placeholder="0">
        </div>
        <p style="font-size:11px;color:var(--txt3);margin-bottom:6px">Presione el día para ingresar al plan semanal:</p>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${dias.map(d => `<button id="btn-dia-pspc-${d}" class="btn-secundario" style="font-size:12px;padding:6px 14px" onclick="ingresarPlanPSPC('${d}')">${d}</button>`).join('')}
        </div>
      </div>` : ''}
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      ${dias.map(d => {
        const items = _planPSPCCache.filter(p => p.dia === d);
        return `
        <div class="card">
          <div class="card-head" style="font-size:13px">${d}</div>
          <div style="padding:10px 14px">
            ${!items.length ? '<p style="color:var(--txt3);font-size:12px">Sin productos</p>' : items.map(it => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
                <div>
                  <div style="font-size:12px;font-weight:600">${it.nombre}</div>
                  <div style="font-size:11px;color:var(--txt3)">${it.cantidad} uni · ${it.tipo_preparacion==='producto_simple'?'PS':'PC'}</div>
                </div>
                <button class="btn-fila-del" onclick="eliminarPlanPSPCUI(${it._fila})" aria-label="Eliminar"><i class="ti ti-x"></i></button>
              </div>
            `).join('')}
          </div>
        </div>`;
      }).join('')}
    </div>

    ${construirListaCompraPS()}
  `;
}

// Suma, a través de todos los Productos Simples planificados en la semana, cuánta
// MP se necesita en total — ingredientes directos, sin pasar por sub-recetas
// (los PS por definición no las llevan).
// Desarma un ingrediente en sus componentes reales de compra — si es una MP normal,
// se acumula directo; si es una sub-receta, busca SU receta y repite el proceso con
// sus propios ingredientes (escalados según qué fracción del lote se está usando),
// hasta llegar a materias primas reales. Así una lista de compra nunca muestra
// "Masa Base: 5000g" — muestra la harina/agua/levadura reales que hay que comprar,
// sin importar cuántas capas de sub-recetas haya en el medio (ej. Poolish dentro
// de Masa Base dentro de un producto final).
function expandirIngredienteRecursivo(mpId, gramosUsados, acumulador) {
  if (!mpId || !gramosUsados) return;
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  const esSubReceta = mp && mp.tipo === 'sub_receta';

  if (!esSubReceta) {
    if (!acumulador[mpId]) {
      acumulador[mpId] = { nombre: mp?.nombre || mpId, gramos: 0, unidadCompra: (mp?.unidad_compra || 'kg').toLowerCase() };
    }
    acumulador[mpId].gramos += gramosUsados;
    return;
  }

  // Buscar por ID exacto primero — si no aparece (puede haber IDs viejos de
  // sub-recetas duplicadas o renombradas), respaldo por nombre, igual que en
  // el botón "Ver receta" de cada tanda.
  let recetaSR = App.recetas.find(r => r.ID_receta === mpId);
  if (!recetaSR) recetaSR = App.recetas.find(r => r.nombre === mp.nombre && r.tipo_receta === 'sub_receta');
  if (!recetaSR) {
    // No se encontró el detalle de la sub-receta — se deja como línea aparte,
    // marcada, en vez de perder el dato silenciosamente.
    if (!acumulador[mpId]) acumulador[mpId] = { nombre: mp.nombre, gramos: 0, unidadCompra: 'kg', sinDesarmar: true };
    acumulador[mpId].gramos += gramosUsados;
    return;
  }

  let ingredientesSR = [];
  try { ingredientesSR = JSON.parse(recetaSR.ingredientes_JSON || '[]'); } catch(e) {}
  const totalBaseGramos = ingredientesSR.reduce((s, ing) => s + (parseFloat(ing.gramos) || 0), 0);
  if (!totalBaseGramos) return;

  const factorEscala = gramosUsados / totalBaseGramos;
  ingredientesSR.forEach(ing => {
    const gramosEscalados = (parseFloat(ing.gramos) || 0) * factorEscala;
    expandirIngredienteRecursivo(ing.id, gramosEscalados, acumulador);
  });
}

function construirListaCompraPS() {
  const entradasPS = (_planPSPCCache || []).filter(p => p.tipo_preparacion === 'producto_simple');
  if (!entradasPS.length) return '';

  const totalesMP = {}; // id -> { nombre, gramos, unidad_compra }
  entradasPS.forEach(entrada => {
    const r = App.recetas.find(x => x.ID_receta === entrada.ID_receta);
    if (!r) return;
    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseFloat(r.porciones_base) || 1;
    const cantidadSemana = parseFloat(entrada.cantidad) || 0;

    ingredientes.forEach(ing => {
      const gramosPorUnidad = (parseFloat(ing.gramos) || 0) / porciones;
      const totalGramos = gramosPorUnidad * cantidadSemana;
      expandirIngredienteRecursivo(ing.id, totalGramos, totalesMP);
    });
  });

  const lista = Object.values(totalesMP).sort((a,b) => b.gramos - a.gramos);

  return `
    <div class="card" style="margin-top:16px">
      <div class="card-head"><i class="ti ti-shopping-cart"></i> Lista de compra — Productos Simples (semana)</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Materia Prima</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Cantidad necesaria</th>
        </tr></thead>
        <tbody>
          ${lista.map(it => {
            const esPorUnidad = it.unidadCompra === 'un' || it.unidadCompra === 'unidad' || it.unidadCompra === 'unidades';
            const display = esPorUnidad
              ? `${Math.ceil(it.gramos)} un`
              : it.gramos >= 1000 ? `${(it.gramos/1000).toFixed(2)} kg` : `${Math.round(it.gramos)} g`;
            return `<tr>
              <td class="td-nombre">${it.nombre}${it.sinDesarmar ? ' <span style="color:#E65100;font-size:10px" title="No se encontró la receta detallada de esta sub-receta — falta desglosar en MP real">⚠ sin desglosar</span>' : ''}</td>
              <td class="td-num" style="font-weight:600">${display}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:var(--txt3);padding:10px 16px">
        Suma de todos los Productos Simples planificados esta semana (Lun–Sáb), según sus recetas activas.
      </p>
    </div>`;
}

function seleccionarProductoPSPC(id, nombre) {
  _seleccionPSPC = { ID_receta: id, nombre };
  renderVistaPlanPSPC();
}

async function ingresarPlanPSPC(dia) {
  if (!_seleccionPSPC) return;
  const cantidad = parseFloat(document.getElementById('cant-pspc')?.value) || 0;
  if (cantidad <= 0) { toast('Ingresa una cantidad', 'error'); return; }
  const r = App.recetas.find(x => x.ID_receta === _seleccionPSPC.ID_receta);
  const btnDia = document.getElementById('btn-dia-pspc-' + dia);
  if (btnDia) { btnDia.style.background = '#EDE7F6'; btnDia.style.borderColor = '#4A148C'; btnDia.style.color = '#4A148C'; }
  try {
    await escribirEnSheet('guardar_entrada_plan_ps_pc', {
      registro: { ID_receta: _seleccionPSPC.ID_receta, nombre: _seleccionPSPC.nombre, tipo_preparacion: r?.tipo_preparacion||'', dia, cantidad }
    });
    toast(`${_seleccionPSPC.nombre} agregado al ${dia}`);
    _seleccionPSPC = null;
    renderVistaPlanPSPC();
  } catch(e) {
    toast('Error al guardar', 'error');
    if (btnDia) { btnDia.style.background = ''; btnDia.style.borderColor = ''; btnDia.style.color = ''; }
  }
}

async function eliminarPlanPSPCUI(fila) {
  if (!confirm('¿Eliminar esta entrada del plan?')) return;
  try {
    await escribirEnSheet('eliminar_entrada_plan_ps_pc', { fila });
    toast('Eliminado');
    renderVistaPlanPSPC();
  } catch(e) {
    toast('Error al eliminar', 'error');
  }
}

// ── BOL: PLANIFICACIÓN DIARIA DE MASA BASE ──────────────────────
let _planMasaBaseCache = null;
let _planDescongelacionMasaCache = null;

// Si esta es la primera vez que se entra en una semana nueva, calcula el stock
// de cierre de la última semana registrada y lo usa como stock inicial de esta
// semana — así nadie tiene que volver a contar ni reingresar nada cada lunes.
// Si ya se había hecho el traspaso para esta semana, no hace nada (evita
// recalcular en cada recarga de la pantalla).
function avanzarStockSemanaMasaBase(masasBase, dias, semanaActual) {
  const cfg = cargarConfigSubrecetas();
  if (!cfg.bol) cfg.bol = {};
  const semanaGuardada = cfg.bol.stock_masas_semana;

  if (!semanaGuardada) {
    // Primera vez que se usa el sistema — no hay semana anterior de la cual partir.
    cfg.bol.stock_masas_semana = semanaActual;
    guardarConfigSubrecetas(cfg);
    return;
  }
  if (semanaGuardada === semanaActual) return; // ya está al día, nada que hacer

  const stockPrevio = cfg.bol.stock_masas || {};
  const planSemanaVieja = _planMasaBaseCache.filter(p => p.semana_ID === semanaGuardada);
  const descongelacionSemanaVieja = _planDescongelacionMasaCache.filter(p => p.semana_ID === semanaGuardada);

  const nuevoStock = {};
  masasBase.forEach(r => {
    let acumulado = parseFloat(stockPrevio[r.ID_receta]) || 0;
    dias.forEach(d => {
      const elaborado = parseFloat(planSemanaVieja.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      const descongelado = parseFloat(descongelacionSemanaVieja.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      acumulado = acumulado + elaborado - descongelado;
    });
    nuevoStock[r.ID_receta] = acumulado;
  });

  cfg.bol.stock_masas = nuevoStock;
  cfg.bol.stock_masas_semana = semanaActual;
  guardarConfigSubrecetas(cfg);
}

// ── BOL: PLANIFICACIÓN DE PRODUCTOS TERMINADOS CONGELADOS ──────
// Mismo patrón que Masa Base (stock que se calcula solo, 8vo día "Próximo Lun",
// semana_ID por celda) pero más simple: no hay gramos que escalar ni tandas que
// dividir — cada unidad ya es un producto terminado. Capacidad de congelador
// independiente de la de masa base, aunque comparten el mismo aparato físico.
let _planCongelacionProdCache = null;
let _planDescongelacionProdCache = null;

function avanzarStockSemanaProductosCongelados(productos, dias, semanaActual) {
  const cfg = cargarConfigSubrecetas();
  if (!cfg.bol) cfg.bol = {};
  const semanaGuardada = cfg.bol.stock_productos_semana;

  if (!semanaGuardada) {
    cfg.bol.stock_productos_semana = semanaActual;
    guardarConfigSubrecetas(cfg);
    return;
  }
  if (semanaGuardada === semanaActual) return;

  const stockPrevio = cfg.bol.stock_productos || {};
  const congSemanaVieja = _planCongelacionProdCache.filter(p => p.semana_ID === semanaGuardada);
  const descongSemanaVieja = _planDescongelacionProdCache.filter(p => p.semana_ID === semanaGuardada);

  const nuevoStock = {};
  productos.forEach(r => {
    let acumulado = parseFloat(stockPrevio[r.ID_receta]) || 0;
    dias.forEach(d => {
      const congelado = parseFloat(congSemanaVieja.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      const descongelado = parseFloat(descongSemanaVieja.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      acumulado = acumulado + congelado - descongelado;
    });
    nuevoStock[r.ID_receta] = acumulado;
  });

  cfg.bol.stock_productos = nuevoStock;
  cfg.bol.stock_productos_semana = semanaActual;
  guardarConfigSubrecetas(cfg);
}

async function renderVistaPlanProductosCongelados() {
  const vista = document.getElementById('vista-plan-productos-congelados');
  vista.innerHTML = '<div class="vista-header"><h1 class="vista-titulo">Productos Congelados</h1></div><p style="color:var(--txt3)">Cargando...</p>';
  mostrarVista('plan-productos-congelados');

  try {
    const p1 = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_congelacion_productos' }));
    const r1 = await fetch(FEN.WEBAPP_URL + '?payload=' + p1, { redirect: 'follow', cache: 'no-store' });
    _planCongelacionProdCache = (await r1.json()).filas || [];
  } catch(e) { _planCongelacionProdCache = []; }

  try {
    const p2 = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_descongelacion_productos' }));
    const r2 = await fetch(FEN.WEBAPP_URL + '?payload=' + p2, { redirect: 'follow', cache: 'no-store' });
    _planDescongelacionProdCache = (await r2.json()).filas || [];
  } catch(e) { _planDescongelacionProdCache = []; }

  const productos = App.recetas.filter(r => r.estado === 'consolidada' && r.se_congela === 'si');
  const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const semanaActual = obtenerSemanaActual();
  const semanaSiguiente = obtenerSemanaHace(-1).id;
  const diasConProximo = [...dias, 'Próximo Lun'];

  avanzarStockSemanaProductosCongelados(productos, dias, semanaActual);

  const cfg = cargarConfigSubrecetas();
  const bolCfg = cfg.bol || {};
  const capacidadProductos = bolCfg.capacidad_congelacion_productos || 60;
  const stockInicial = bolCfg.stock_productos || {};

  const congelacionSemana = _planCongelacionProdCache.filter(p => p.semana_ID === semanaActual);
  const descongelacionSemana = _planDescongelacionProdCache.filter(p => p.semana_ID === semanaActual);
  const congelacionProximoLun = _planCongelacionProdCache.filter(p => p.semana_ID === semanaSiguiente && p.dia === 'Lun');
  const descongelacionProximoLun = _planDescongelacionProdCache.filter(p => p.semana_ID === semanaSiguiente && p.dia === 'Lun');

  const stockDiarioPorProducto = {};
  productos.forEach(r => {
    let acumulado = parseFloat(stockInicial[r.ID_receta]) || 0;
    const serie = dias.map(d => {
      const congelado = parseFloat(congelacionSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      const descongelado = parseFloat(descongelacionSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      acumulado = acumulado + congelado - descongelado;
      return { dia: d, congelado, descongelado, stock: acumulado };
    });
    const congProximo = parseFloat(congelacionProximoLun.find(p => p.ID_receta === r.ID_receta)?.cantidad_unidades) || 0;
    const descongProximo = parseFloat(descongelacionProximoLun.find(p => p.ID_receta === r.ID_receta)?.cantidad_unidades) || 0;
    serie.push({ dia: 'Próximo Lun', congelado: congProximo, descongelado: descongProximo, stock: acumulado + congProximo - descongProximo });
    stockDiarioPorProducto[r.ID_receta] = serie;
  });
  const stockFinalTotal = productos.reduce((s,r) => {
    const serie = stockDiarioPorProducto[r.ID_receta];
    return s + (serie.length ? serie[dias.length-1].stock : 0);
  }, 0);

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <h1 class="vista-titulo">Productos Congelados</h1>
        <p style="font-size:12px;color:var(--txt3);margin-top:2px">Semana ${formatearEtiquetaSemana(obtenerSemanaHace(0))} — mismo congelador que masa base, capacidad independiente</p>
      </div>
    </div>

    ${!productos.length ? `
    <div class="empty-state"><i class="ti ti-snowflake"></i><h2>Sin productos marcados como "Se congela" todavía</h2>
      <p>Edite una receta y marque el checkbox "Se congela ya terminado/horneado" para que aparezca acá.</p>
    </div>` : `

    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-snowflake" style="color:#6A1B9A"></i> Stock congelado
      </div>
      <div style="padding:14px 16px">
        <p style="font-size:13px;font-weight:700;margin-bottom:10px;color:${stockFinalTotal > capacidadProductos ? '#C62828' : '#2E7D32'}">
          Proyectado al cierre de la semana: ${stockFinalTotal} / ${capacidadProductos} espacios
          ${stockFinalTotal > capacidadProductos ? ' — ⚠️ sobre capacidad' : ''}
        </p>
        ${productos.map(r => {
          const serie = stockDiarioPorProducto[r.ID_receta];
          return `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:12px;font-weight:600">${r.nombre}</span>
              <div style="display:flex;gap:6px;align-items:center">
                <label style="font-size:10px;color:var(--txt3)">Stock inicial (lunes):</label>
                <input type="number" id="stock-prod-${r.ID_receta}" min="0" step="1" value="${stockInicial[r.ID_receta] || 0}"
                  style="max-width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px" placeholder="0">
                <button class="btn-secundario" style="font-size:10px;padding:4px 8px" onclick="guardarStockInicialProducto('${r.ID_receta}')">
                  <i class="ti ti-device-floppy"></i>
                </button>
              </div>
            </div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:10px;min-width:460px">
                <thead><tr>
                  ${diasConProximo.map((d,i) => `<th style="padding:3px 4px;text-align:center;color:${i===7?'#6A1B9A':'var(--txt3)'};font-weight:600;${i===7?'border-left:2px solid #CE93D8':''}">${d}</th>`).join('')}
                </tr></thead>
                <tbody><tr>
                  ${serie.map((s,i) => `<td style="padding:3px 4px;text-align:center;font-family:'DM Mono',monospace;${i===7?'border-left:2px solid #CE93D8;background:#F3E5F5':''};${s.stock > capacidadProductos ? 'color:#C62828;font-weight:700' : ''}">${s.stock}</td>`).join('')}
                </tr></tbody>
              </table>
            </div>
          </div>`;
        }).join('')}
        <p style="font-size:11px;color:var(--txt3);margin-top:8px">
          El stock de cada día se calcula solo: stock inicial + lo congelado − lo descongelado, acumulado desde el lunes.
          Ajuste "Stock inicial" a mano solo si hace un conteo físico y no calza. Corre semana a semana, no se resetea.
          <span style="color:#6A1B9A">La columna "Próximo Lun" es planificación anticipada — al llegar esa semana, queda como su primer día automáticamente.</span>
        </p>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#E3F2FD;color:#1565C0"><i class="ti ti-snowflake"></i> Plan de congelación</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:620px">
          <thead><tr style="background:var(--bg)">
            <th style="text-align:left;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Producto</th>
            ${diasConProximo.map((d,i) => `<th style="text-align:center;padding:9px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:${i===7?'#6A1B9A':'var(--txt3)'};${i===7?'border-left:2px solid #CE93D8':''}">${d}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${productos.map(r => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:8px 12px;font-size:12px">${r.nombre}</td>
                ${diasConProximo.map((d,i) => {
                  const entrada = i===7
                    ? congelacionProximoLun.find(p => p.ID_receta === r.ID_receta)
                    : congelacionSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d);
                  return `<td style="padding:4px;text-align:center;${i===7?'border-left:2px solid #CE93D8;background:#F3E5F5':''}">
                    <input type="number" min="0" step="1" value="${entrada ? entrada.cantidad_unidades : ''}" placeholder="0"
                      style="width:52px;padding:5px 4px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;text-align:center;font-family:'DM Mono',monospace"
                      onchange="guardarCeldaCongelacionProducto('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}','${i===7?'Lun':d}',this.value,'${i===7?semanaSiguiente:semanaActual}')">
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--txt3);padding:10px 16px">Cuántas unidades de cada producto se congelan cada día — suma al stock de arriba.</p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#FFF3E0;color:#E65100"><i class="ti ti-arrow-down-circle"></i> Plan de descongelación</div>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:620px">
          <thead><tr style="background:var(--bg)">
            <th style="text-align:left;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Producto</th>
            ${diasConProximo.map((d,i) => `<th style="text-align:center;padding:9px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:${i===7?'#6A1B9A':'var(--txt3)'};${i===7?'border-left:2px solid #CE93D8':''}">${d}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${productos.map(r => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:8px 12px;font-size:12px">${r.nombre}</td>
                ${diasConProximo.map((d,i) => {
                  const entrada = i===7
                    ? descongelacionProximoLun.find(p => p.ID_receta === r.ID_receta)
                    : descongelacionSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d);
                  return `<td style="padding:4px;text-align:center;${i===7?'border-left:2px solid #CE93D8;background:#F3E5F5':''}">
                    <input type="number" min="0" step="1" value="${entrada ? entrada.cantidad_unidades : ''}" placeholder="0"
                      style="width:52px;padding:5px 4px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;text-align:center;font-family:'DM Mono',monospace"
                      onchange="guardarCeldaDescongelacionProducto('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}','${i===7?'Lun':d}',this.value,'${i===7?semanaSiguiente:semanaActual}')">
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--txt3);padding:10px 16px">Cuántas unidades de cada producto se descongelan cada día — se descuenta del stock de arriba.</p>
    </div>
    `}
  `;
}

function guardarStockInicialProducto(recetaId) {
  const valor = parseInt(document.getElementById('stock-prod-' + recetaId)?.value) || 0;
  const cfg = cargarConfigSubrecetas();
  if (!cfg.bol) cfg.bol = {};
  if (!cfg.bol.stock_productos) cfg.bol.stock_productos = {};
  cfg.bol.stock_productos[recetaId] = valor;
  guardarConfigSubrecetas(cfg);
  toast('Stock actualizado');
  renderVistaPlanProductosCongelados();
}

async function guardarCeldaCongelacionProducto(recetaId, nombre, dia, valor, semana) {
  const cantidad = parseFloat(valor) || 0;
  await escribirEnSheet('guardar_celda_plan_congelacion_productos', {
    ID_receta: recetaId, nombre, dia, semana: semana || obtenerSemanaActual(), cantidad_unidades: cantidad
  });
  await renderVistaPlanProductosCongelados();
}

async function guardarCeldaDescongelacionProducto(recetaId, nombre, dia, valor, semana) {
  const cantidad = parseFloat(valor) || 0;
  await escribirEnSheet('guardar_celda_plan_descongelacion_productos', {
    ID_receta: recetaId, nombre, dia, semana: semana || obtenerSemanaActual(), cantidad_unidades: cantidad
  });
  await renderVistaPlanProductosCongelados();
}

async function renderVistaPlanMasaBase() {
  const vista = document.getElementById('vista-plan-masa-base');
  vista.innerHTML = '<div class="vista-header"><h1 class="vista-titulo">Planificación Masas Base</h1></div><p style="color:var(--txt3)">Cargando...</p>';
  mostrarVista('plan-masa-base');

  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_masa_base' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    _planMasaBaseCache = data.filas || [];
  } catch(e) {
    _planMasaBaseCache = [];
  }

  try {
    const payload3 = encodeURIComponent(JSON.stringify({ accion: 'leer_plan_descongelacion_masa' }));
    const res3 = await fetch(FEN.WEBAPP_URL + '?payload=' + payload3, { redirect: 'follow', cache: 'no-store' });
    const data3 = await res3.json();
    _planDescongelacionMasaCache = data3.filas || [];
  } catch(e) {
    _planDescongelacionMasaCache = [];
  }

  const masasBase = App.recetas.filter(r =>
    r.estado === 'consolidada' && r.tipo_preparacion === 'masa_base' &&
    r.planificable_directo !== 'no' && r.planificable_directo !== false
  );
  const dias = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const semanaActual = obtenerSemanaActual();
  const semanaSiguiente = obtenerSemanaHace(-1).id;

  // Antes de mostrar nada: si esta es la primera vez que se entra en una semana
  // nueva, heredar el stock inicial del cierre de la semana anterior — así nadie
  // tiene que volver a contar ni reingresar nada cada lunes.
  avanzarStockSemanaMasaBase(masasBase, dias, semanaActual);

  const cfg = cargarConfigSubrecetas();
  const bolCfg = cfg.bol || {};
  const capacidadCongelador = bolCfg.capacidad_congelacion_masas || 40;
  const stockInicial = bolCfg.stock_masas || {};

  // Vistas de la semana actual — el cache completo (todas las semanas) se
  // conserva en _planMasaBaseCache/_planDescongelacionMasaCache para poder
  // calcular el cierre de semanas anteriores cuando corresponda.
  const planSemana = _planMasaBaseCache.filter(p => p.semana_ID === semanaActual);
  const descongelacionSemana = _planDescongelacionMasaCache.filter(p => p.semana_ID === semanaActual);

  // "Próximo Lun" — planificación anticipada para el primer día de la semana que
  // viene (se guarda ya con el semana_ID de esa semana futura, así que cuando esa
  // semana efectivamente llegue, el sistema la reconoce sola como su propio lunes
  // — no hace falta ningún traspaso especial).
  const planProximoLun = _planMasaBaseCache.filter(p => p.semana_ID === semanaSiguiente && p.dia === 'Lun');
  const descongelacionProximoLun = _planDescongelacionMasaCache.filter(p => p.semana_ID === semanaSiguiente && p.dia === 'Lun');

  // Días de despliegue: 7 de esta semana + 1 columna extra para "Próximo Lun"
  const diasConProximo = [...dias, 'Próximo Lun'];

  // Stock proyectado día a día = stock inicial + elaborado ese día − descongelado ese
  // día (acumulado desde el lunes). Se calcula solo, no hay que ir a contar cada vez.
  // La 8va columna (Próximo Lun) sigue acumulando desde el domingo — muestra cómo
  // quedaría el stock si se ejecuta lo planificado con anticipación.
  const stockDiarioPorMasa = {};
  masasBase.forEach(r => {
    let acumulado = parseFloat(stockInicial[r.ID_receta]) || 0;
    const serie = dias.map(d => {
      const elaborado = parseFloat(planSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      const descongelado = parseFloat(descongelacionSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d)?.cantidad_unidades) || 0;
      acumulado = acumulado + elaborado - descongelado;
      return { dia: d, elaborado, descongelado, stock: acumulado };
    });
    const elaboradoProximo = parseFloat(planProximoLun.find(p => p.ID_receta === r.ID_receta)?.cantidad_unidades) || 0;
    const descongeladoProximo = parseFloat(descongelacionProximoLun.find(p => p.ID_receta === r.ID_receta)?.cantidad_unidades) || 0;
    serie.push({ dia: 'Próximo Lun', elaborado: elaboradoProximo, descongelado: descongeladoProximo, stock: acumulado + elaboradoProximo - descongeladoProximo });
    stockDiarioPorMasa[r.ID_receta] = serie;
  });
  const stockFinalTotal = masasBase.reduce((s,r) => {
    const serie = stockDiarioPorMasa[r.ID_receta];
    return s + (serie.length ? serie[dias.length-1].stock : 0); // cierre de la semana actual (domingo), no de "Próximo Lun"
  }, 0);

  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <h1 class="vista-titulo">Planificación Masas Base</h1>
        <p style="font-size:12px;color:var(--txt3);margin-top:2px">Semana ${formatearEtiquetaSemana(obtenerSemanaHace(0))}</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#F3E5F5;color:#4A148C">
        <i class="ti ti-snowflake" style="color:#6A1B9A"></i> Stock congelado
      </div>
      <div style="padding:14px 16px">
        <p style="font-size:13px;font-weight:700;margin-bottom:10px;color:${stockFinalTotal > capacidadCongelador ? '#C62828' : '#2E7D32'}">
          Proyectado al cierre de la semana: ${stockFinalTotal} / ${capacidadCongelador} espacios
          ${stockFinalTotal > capacidadCongelador ? ' — ⚠️ sobre capacidad' : ''}
        </p>
        ${masasBase.map(r => {
          const serie = stockDiarioPorMasa[r.ID_receta];
          return `
          <div style="padding:10px 0;border-bottom:1px solid var(--border)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <span style="font-size:12px;font-weight:600">${r.nombre}</span>
              <div style="display:flex;gap:6px;align-items:center">
                <label style="font-size:10px;color:var(--txt3)">Stock inicial (lunes):</label>
                <input type="number" id="stock-actual-${r.ID_receta}" min="0" step="1" value="${stockInicial[r.ID_receta] || 0}"
                  style="max-width:60px;padding:4px 8px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px" placeholder="0">
                <button class="btn-secundario" style="font-size:10px;padding:4px 8px" onclick="guardarStockActualMasa('${r.ID_receta}')">
                  <i class="ti ti-device-floppy"></i>
                </button>
              </div>
            </div>
            <div style="overflow-x:auto">
              <table style="width:100%;border-collapse:collapse;font-size:10px;min-width:460px">
                <thead><tr>
                  ${diasConProximo.map((d,i) => `<th style="padding:3px 4px;text-align:center;color:${i===7?'#6A1B9A':'var(--txt3)'};font-weight:600;${i===7?'border-left:2px solid #CE93D8':''}">${d}</th>`).join('')}
                </tr></thead>
                <tbody><tr>
                  ${serie.map((s,i) => `<td style="padding:3px 4px;text-align:center;font-family:'DM Mono',monospace;${i===7?'border-left:2px solid #CE93D8;background:#F3E5F5':''};${s.stock > capacidadCongelador ? 'color:#C62828;font-weight:700' : ''}">${s.stock}</td>`).join('')}
                </tr></tbody>
              </table>
            </div>
          </div>`;
        }).join('')}
        <p style="font-size:11px;color:var(--txt3);margin-top:8px">
          El stock de cada día se calcula solo: stock inicial + lo elaborado − lo descongelado, acumulado desde el lunes.
          Ajuste "Stock inicial" a mano solo si hace un conteo físico y no calza. Corre semana a semana, no se resetea.
          <span style="color:#6A1B9A">La columna "Próximo Lun" es planificación anticipada — al llegar esa semana, queda como su primer día automáticamente.</span>
        </p>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="background:#E3F2FD;color:#1565C0"><i class="ti ti-arrow-down-circle"></i> Plan de descongelación</div>
      ${!masasBase.length ? '' : `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:620px">
          <thead><tr style="background:var(--bg)">
            <th style="text-align:left;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Receta</th>
            ${diasConProximo.map((d,i) => `<th style="text-align:center;padding:9px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:${i===7?'#6A1B9A':'var(--txt3)'};${i===7?'border-left:2px solid #CE93D8':''}">${d}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${masasBase.map(r => `<tr style="border-top:1px solid var(--border)">
                <td style="padding:8px 12px;font-size:12px">${r.nombre}</td>
                ${diasConProximo.map((d,i) => {
                  const entrada = i===7
                    ? descongelacionProximoLun.find(p => p.ID_receta === r.ID_receta)
                    : descongelacionSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d);
                  return `<td style="padding:4px;text-align:center;${i===7?'border-left:2px solid #CE93D8;background:#F3E5F5':''}">
                    <input type="number" min="0" step="1" value="${entrada ? entrada.cantidad_unidades : ''}" placeholder="0"
                      style="width:52px;padding:5px 4px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;text-align:center;font-family:'DM Mono',monospace"
                      onchange="guardarCeldaGrillaDescongelacion('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}','${i===7?'Lun':d}',this.value,'${i===7?semanaSiguiente:semanaActual}')">
                  </td>`;
                }).join('')}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}
      <p style="font-size:11px;color:var(--txt3);padding:10px 16px">
        Cuántas masas de cada tipo saca a descongelar cada día — se descuenta solo del stock de arriba.
        Empaste se elabora según lo que descongele acá, no nace de la grilla de elaboración.
      </p>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-bread"></i> Planificación semanal</div>
      ${!masasBase.length ? `<p style="padding:16px;color:var(--txt3)">Sin recetas clasificadas como "Masa Base" todavía.</p>` : `
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;min-width:620px">
          <thead><tr style="background:var(--bg)">
            <th style="text-align:left;padding:9px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Receta</th>
            ${diasConProximo.map((d,i) => `<th style="text-align:center;padding:9px 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:${i===7?'#6A1B9A':'var(--txt3)'};${i===7?'border-left:2px solid #CE93D8':''}">${d}</th>`).join('')}
          </tr></thead>
          <tbody>
            ${masasBase.map(r => {
              const pesoUnidadG = parseFloat(r.peso_unidad_mb_g) || 0;
              return `<tr style="border-top:1px solid var(--border)">
                <td style="padding:8px 12px;font-size:12px">
                  ${r.nombre}
                  ${!pesoUnidadG ? '<div style="font-size:10px;color:#C62828">⚠️ sin peso configurado</div>' : ''}
                </td>
                ${diasConProximo.map((d,i) => {
                  const entrada = i===7
                    ? planProximoLun.find(p => p.ID_receta === r.ID_receta)
                    : planSemana.find(p => p.ID_receta === r.ID_receta && p.dia === d);
                  return `<td style="padding:4px;text-align:center;${i===7?'border-left:2px solid #CE93D8;background:#F3E5F5':''}">
                    <input type="number" min="0" step="1" value="${entrada ? entrada.cantidad_unidades : ''}" placeholder="0"
                      style="width:52px;padding:5px 4px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:12px;text-align:center;font-family:'DM Mono',monospace"
                      onchange="guardarCeldaGrillaMasaBase('${r.ID_receta}','${r.nombre.replace(/'/g,"\\'")}','${i===7?'Lun':d}',this.value,${pesoUnidadG},'${i===7?semanaSiguiente:semanaActual}')">
                  </td>`;
                }).join('')}
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
    </div>

    <div id="cards-masa-base"></div>
    <div id="lista-compra-masa-base-semana"></div>
  `;

  renderTarjetasPorMasaBase(masasBase, dias, planSemana, planProximoLun);
  renderListaCompraMasaBaseSemana(planSemana);
}

async function guardarCeldaGrillaDescongelacion(recetaId, nombre, dia, valor, semana) {
  const cantidad = parseFloat(valor) || 0;
  await escribirEnSheet('guardar_celda_plan_descongelacion_masa', {
    ID_receta: recetaId, nombre, dia, semana: semana || obtenerSemanaActual(), cantidad_unidades: cantidad
  });
  await renderVistaPlanMasaBase();
}

async function guardarCeldaGrillaMasaBase(recetaId, nombre, dia, valor, pesoUnidadG, semana) {
  const cantidad = parseFloat(valor) || 0;
  await escribirEnSheet('guardar_celda_plan_masa_base', {
    ID_receta: recetaId, nombre, dia, semana: semana || obtenerSemanaActual(), cantidad_unidades: cantidad, peso_unidad_g: pesoUnidadG
  });
  await renderVistaPlanMasaBase();
}

// Tarjetas apiladas por MASA (no por día) — cada una resume el total semanal y,
// para cada día con producción, las tandas de la masa madre + las sub-recetas
// anidadas (ej. Poolish) con su propia división en tandas.
function renderTarjetasPorMasaBase(masasBase, dias, planSemana, planProximoLun) {
  const cont = document.getElementById('cards-masa-base');
  if (!cont) return;
  planProximoLun = planProximoLun || [];

  const conProduccion = masasBase.filter(r => planSemana.some(p => p.ID_receta === r.ID_receta) || planProximoLun.some(p => p.ID_receta === r.ID_receta));
  if (!conProduccion.length) {
    cont.innerHTML = `<div class="empty-state"><i class="ti ti-bread"></i><h2>Sin masas planificadas esta semana</h2><p>Complete la grilla de arriba para empezar.</p></div>`;
    return;
  }

  cont.innerHTML = conProduccion.map(r => {
    // "Próximo Lun" se etiqueta distinto para mostrarse (_diaLabel), pero es una
    // entrada real con su propio _fila — tiene exactamente el mismo comportamiento
    // que cualquier otro día (dividir en tandas, Poolish, todo).
    const entradasSemana = planSemana.filter(p => p.ID_receta === r.ID_receta).map(p => ({...p, _diaLabel: p.dia}));
    const entradasProximo = planProximoLun.filter(p => p.ID_receta === r.ID_receta).map(p => ({...p, _diaLabel: 'Próximo Lun'}));
    const entradas = [...entradasSemana, ...entradasProximo];
    const totalUnidadesSemana = entradasSemana.reduce((s,e) => s + (parseFloat(e.cantidad_unidades)||0), 0);
    const totalKgSemana = entradasSemana.reduce((s,e) => s + (parseFloat(e.peso_total_g)||0), 0) / 1000;

    let ingredientesPropios = [];
    try { ingredientesPropios = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const subRecetasAnidadas = ingredientesPropios.filter(ing => {
      const mp = App.materiasPrimas.find(m => m.ID_MP === ing.id);
      return mp && mp.tipo === 'sub_receta';
    });

    return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
        <span><i class="ti ti-bread"></i> ${r.nombre}</span>
        <span style="font-weight:400;font-size:12px;color:var(--txt3)">${totalUnidadesSemana} uni · ${totalKgSemana.toFixed(2)}kg esta semana</span>
      </div>
      <div style="padding:12px 16px">
        ${entradas.map((it, idxDia) => {
          const esProximo = it._diaLabel === 'Próximo Lun';
          return `
          <div style="padding:12px;margin-bottom:10px;background:${esProximo ? '#F3E5F5' : (idxDia % 2 === 0 ? 'var(--bg)' : 'transparent')};border-radius:var(--r-md);border-left:3px solid ${esProximo ? '#CE93D8' : 'var(--area-color, #6A1B9A)'}">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px;font-weight:700;color:${esProximo ? '#6A1B9A' : 'inherit'}">${it._diaLabel}</span>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:12px;color:var(--txt3)">${it.cantidad_unidades} uni · ${(parseFloat(it.peso_total_g)/1000).toFixed(2)}kg</span>
                <button class="btn-fila-del" onclick="eliminarPlanMasaBaseUI(${it._fila})" aria-label="Eliminar"><i class="ti ti-x"></i></button>
              </div>
            </div>
            <button class="btn-secundario" style="width:100%;margin-top:6px;font-size:11px;padding:6px" onclick="toggleDetalleMasaBase(${it._fila},'${it.ID_receta}',${it.cantidad_unidades})">
              <i class="ti ti-list-details"></i> Dividir masa en tandas
            </button>
            <div id="detalle-masa-base-${it._fila}" class="hidden" style="margin-top:6px"></div>

            ${subRecetasAnidadas.map(subIng => {
              const gramosNecesarios = (parseFloat(subIng.gramos)||0) * (parseFloat(it.cantidad_unidades)||0);
              return `
              <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--border)">
                <span style="font-size:12px">${subIng.nombre} necesario: <strong>${gramosNecesarios >= 1000 ? (gramosNecesarios/1000).toFixed(2)+'kg' : Math.round(gramosNecesarios)+'g'}</strong></span>
                <span style="font-size:11px;color:var(--txt3);display:block">Vea el desglose completo con "Ver receta" en cada tanda arriba.</span>
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }).join('');
}

// ── Lista de compra de MP — toda la semana, todas las masas juntas, desarmadas
// recursivamente hasta materia prima real (reutiliza expandirIngredienteRecursivo) ──
function renderListaCompraMasaBaseSemana(planSemana) {
  const cont = document.getElementById('lista-compra-masa-base-semana');
  if (!cont) return;
  if (!planSemana.length) { cont.innerHTML = ''; return; }

  const totalesMP = {};
  planSemana.forEach(entrada => {
    const r = App.recetas.find(x => x.ID_receta === entrada.ID_receta);
    if (!r) return;
    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const pesoBaseReceta = ingredientes.reduce((s,ing) => s + (parseFloat(ing.gramos)||0), 0);
    if (!pesoBaseReceta) return;
    const factor = (parseFloat(entrada.peso_total_g) || 0) / pesoBaseReceta;
    ingredientes.forEach(ing => {
      const gramosEscalados = (parseFloat(ing.gramos) || 0) * factor;
      expandirIngredienteRecursivo(ing.id, gramosEscalados, totalesMP);
    });
  });

  const lista = Object.values(totalesMP).sort((a,b) => b.gramos - a.gramos);
  if (!lista.length) { cont.innerHTML = ''; return; }

  cont.innerHTML = `
    <div class="card" style="margin-top:16px">
      <div class="card-head"><i class="ti ti-shopping-cart"></i> Materias primas necesarias — toda la semana</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Materia Prima</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Cantidad necesaria</th>
        </tr></thead>
        <tbody>
          ${lista.map(it => {
            const esPorUnidad = it.unidadCompra === 'un' || it.unidadCompra === 'unidad' || it.unidadCompra === 'unidades';
            const display = esPorUnidad
              ? `${Math.ceil(it.gramos)} un`
              : it.gramos >= 1000 ? `${(it.gramos/1000).toFixed(2)} kg` : `${Math.round(it.gramos)} g`;
            return `<tr>
              <td class="td-nombre">${it.nombre}${it.sinDesarmar ? ' <span style="color:#E65100;font-size:10px">⚠ sin desglosar</span>' : ''}</td>
              <td class="td-num" style="font-weight:600">${display}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <p style="font-size:11px;color:var(--txt3);padding:10px 16px">
        Suma todas las masas planificadas esta semana (todos los días juntos), ya desglosadas hasta materia prima real
        (incluye sub-recetas anidadas como Poolish).
      </p>
    </div>`;
}

function guardarStockActualMasa(recetaId) {
  const valor = parseInt(document.getElementById('stock-actual-' + recetaId)?.value) || 0;
  const cfg = cargarConfigSubrecetas();
  if (!cfg.bol) cfg.bol = {};
  if (!cfg.bol.stock_masas) cfg.bol.stock_masas = {};
  cfg.bol.stock_masas[recetaId] = valor;
  guardarConfigSubrecetas(cfg);
  toast('Stock actualizado');
  renderVistaPlanMasaBase();
}

function toggleDetalleMasaBase(fila, recetaId, cantidadUnidades) {
  const cont = document.getElementById('detalle-masa-base-' + fila);
  if (!cont) return;
  if (!cont.classList.contains('hidden')) { cont.classList.add('hidden'); return; }
  cont.classList.remove('hidden');

  const entrada = (_planMasaBaseCache || []).find(p => p._fila === fila);
  let tandas = [];
  try { tandas = JSON.parse(entrada?.tandas_JSON || '[]'); } catch(e) {}
  if (!Array.isArray(tandas)) tandas = [];

  renderEditorTandas(fila, recetaId, cantidadUnidades, tandas);
}

function renderEditorTandas(fila, recetaId, cantidadUnidades, tandas) {
  const cont = document.getElementById('detalle-masa-base-' + fila);
  if (!cont) return;
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;
  const entrada = (_planMasaBaseCache || []).find(p => p._fila === fila);
  const pesoUnidadG = parseFloat(entrada?.peso_unidad_g) || 0;
  const pesoTotalKg = (parseFloat(entrada?.peso_total_g) || 0) / 1000;

  const sumaAsignada = tandas.reduce((s,t) => s + (parseFloat(t.unidades)||0), 0);
  const restanteFinal = cantidadUnidades - sumaAsignada;
  const completo = restanteFinal <= 0;

  cont.innerHTML = `
    <div style="background:var(--bg);border-radius:var(--r-md);padding:10px;margin-top:6px">
      <p style="font-size:11px;font-weight:600;margin-bottom:6px">Dividir en tandas libres (total: ${cantidadUnidades} uni · ${pesoTotalKg.toFixed(2)}kg)</p>
      ${!tandas.length ? `<p style="font-size:11px;color:var(--txt3);padding:4px 0">Sin tandas todavía — agregue la primera abajo.</p>` : (() => {
        let acumulado = 0;
        return tandas.map((t,i) => {
          acumulado += parseFloat(t.unidades) || 0;
          const restante = cantidadUnidades - acumulado;
          const kgTanda = (parseFloat(t.unidades)||0) * pesoUnidadG / 1000;
          return `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
            <span style="font-size:11px">Tanda ${i+1}: <strong>${t.unidades} uni</strong> (${kgTanda.toFixed(2)}kg)
              ${restante > 0 ? `<span style="color:#F57C00"> → quedan ${restante}</span>` : restante < 0 ? `<span style="color:#C62828"> → ${Math.abs(restante)} de más</span>` : `<span style="color:#2E7D32"> ✓ completo</span>`}
            </span>
            <div style="display:flex;gap:4px">
              <button style="font-size:9px;padding:2px 6px;background:#F3E5F5;color:#6A1B9A;border:1px solid #CE93D8;border-radius:var(--r-sm);cursor:pointer;font-weight:600" onclick="verRecetaEscaladaTanda(${fila},'${recetaId}',${kgTanda},${i})"><i class="ti ti-eye" style="font-size:11px"></i> Ver receta</button>
              <button class="btn-fila-del" style="padding:2px" onclick="quitarTandaMasaBase(${fila},'${recetaId}',${cantidadUnidades},${i})"><i class="ti ti-x"></i></button>
            </div>
          </div>
          <div id="tanda-receta-${fila}-${i}" class="hidden" style="margin:4px 0"></div>
        `;
        }).join('');
      })()}
      ${completo
        ? `<p style="font-size:11px;color:#2E7D32;margin-top:8px"><i class="ti ti-circle-check"></i> Todas las unidades ya están asignadas — elimine una tanda si necesita reasignar.</p>`
        : `<button class="btn-secundario" style="font-size:11px;padding:6px 12px;margin-top:8px;width:100%" onclick="agregarTandaMasaBase(${fila},'${recetaId}',${cantidadUnidades})">
             <i class="ti ti-plus"></i> Agregar tanda (quedan ${restanteFinal})
           </button>`}
    </div>
  `;
}

async function agregarTandaMasaBase(fila, recetaId, cantidadUnidades) {
  const entrada = (_planMasaBaseCache || []).find(p => p._fila === fila);
  let tandas = [];
  try { tandas = JSON.parse(entrada?.tandas_JSON || '[]'); } catch(e) {}
  if (!Array.isArray(tandas)) tandas = [];

  const sumaAsignada = tandas.reduce((s,t) => s + (parseFloat(t.unidades)||0), 0);
  const restante = cantidadUnidades - sumaAsignada;
  if (restante <= 0) { toast('Ya están todas las unidades asignadas', 'error'); return; }

  const valor = prompt(`¿Cuántas unidades lleva esta tanda? (quedan ${restante} sin asignar)`, restante);
  if (valor === null) return;
  const unidades = parseFloat(valor);
  if (isNaN(unidades) || unidades <= 0) { toast('Cantidad inválida', 'error'); return; }
  if (unidades > restante) { toast(`No puede asignar más de lo que queda (${restante})`, 'error'); return; }

  tandas.push({ unidades });

  await guardarTandasEnSheet(fila, tandas);
  await renderVistaPlanMasaBase(); // re-render completo, para que la sección de sub-recetas anidadas vea la tanda nueva
  toggleDetalleMasaBase(fila, recetaId, cantidadUnidades); // reabrir el panel que quedó cerrado por el re-render
}

async function quitarTandaMasaBase(fila, recetaId, cantidadUnidades, index) {
  const entrada = (_planMasaBaseCache || []).find(p => p._fila === fila);
  let tandas = [];
  try { tandas = JSON.parse(entrada?.tandas_JSON || '[]'); } catch(e) {}
  tandas.splice(index, 1);

  await guardarTandasEnSheet(fila, tandas);
  await renderVistaPlanMasaBase();
  toggleDetalleMasaBase(fila, recetaId, cantidadUnidades);
}

async function guardarTandasEnSheet(fila, tandas) {
  const tandasJSON = JSON.stringify(tandas);
  try {
    await escribirEnSheet('actualizar_tandas_plan_masa_base', { fila, tandas_JSON: tandasJSON });
    const entrada = (_planMasaBaseCache || []).find(p => p._fila === fila);
    if (entrada) entrada.tandas_JSON = tandasJSON;
  } catch(e) {
    toast('Error al guardar la tanda', 'error');
  }
}

function verRecetaEscaladaTanda(fila, recetaId, tandaKg, index) {
  const objetivo = document.getElementById(`tanda-receta-${fila}-${index}`);
  if (!objetivo) return;

  if (!objetivo.classList.contains('hidden')) {
    objetivo.classList.add('hidden');
    return;
  }

  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;
  const porciones = parseFloat(r.porciones_base) || 1;
  const entrada = (_planMasaBaseCache || []).find(p => p._fila === fila);
  const pesoUnidadG = parseFloat(entrada?.peso_unidad_g) || 0;
  const pesoRecetaBaseG = porciones * pesoUnidadG;
  const factor = pesoRecetaBaseG > 0 ? (tandaKg * 1000) / pesoRecetaBaseG : 0;

  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}

  objetivo.classList.remove('hidden');
  objetivo.innerHTML = renderTablaIngredientesExpandible(ingredientes, factor, `${fila}-${index}`);
}

// Renderiza una tabla de ingredientes ya escalados — si un ingrediente es una
// sub-receta, aparece como una fila desplegable (▸) que, al abrirla, muestra la
// receta de ESA sub-receta también escalada. Funciona en cualquier profundidad de
// anidamiento (una sub-receta dentro de otra), porque cada nivel se llama a sí mismo.
function renderTablaIngredientesExpandible(ingredientes, factor, idPrefix) {
  return `
    <table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:4px">
      <tbody>
        ${ingredientes.map((ing, i) => {
          const gramos = (parseFloat(ing.gramos) || 0) * factor;
          const mp = App.materiasPrimas.find(m => m.ID_MP === ing.id);
          const esSubReceta = mp && mp.tipo === 'sub_receta';
          const filaId = `${idPrefix}-${i}`;
          if (esSubReceta) {
            return `
              <tr>
                <td colspan="2" style="padding:3px 6px;border-bottom:1px solid var(--border)">
                  <button style="background:none;border:none;padding:0;font-size:10px;color:var(--area-color, #6A1B9A);cursor:pointer;display:flex;justify-content:space-between;width:100%;font-family:inherit"
                    onclick="toggleSubIngredienteExpandible('${filaId}','${ing.id}',${gramos})">
                    <span id="chev-${filaId}"><i class="ti ti-chevron-right"></i> ${ing.nombre}</span>
                    <span style="font-family:'DM Mono',monospace">${gramos.toFixed(1)}g</span>
                  </button>
                  <div id="sub-ing-${filaId}" class="hidden" style="padding-left:12px;margin-top:2px;border-left:2px solid var(--border)"></div>
                </td>
              </tr>`;
          }
          return `
            <tr>
              <td style="padding:3px 6px;border-bottom:1px solid var(--border)">${ing.nombre}</td>
              <td style="padding:3px 6px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace">${gramos.toFixed(1)}g</td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}

function toggleSubIngredienteExpandible(filaId, subRecetaMpId, gramosNecesarios) {
  const cont = document.getElementById('sub-ing-' + filaId);
  const chev = document.getElementById('chev-' + filaId);
  if (!cont) return;

  if (!cont.classList.contains('hidden')) {
    cont.classList.add('hidden');
    if (chev) chev.innerHTML = chev.innerHTML.replace('ti-chevron-down', 'ti-chevron-right');
    return;
  }
  cont.classList.remove('hidden');
  if (chev) chev.innerHTML = chev.innerHTML.replace('ti-chevron-right', 'ti-chevron-down');

  const mp = App.materiasPrimas.find(m => m.ID_MP === subRecetaMpId);
  // Buscar la receta detallada de esta sub-receta — primero por ID exacto, y si no
  // se encuentra (pueden existir IDs viejos de sub-recetas renombradas), por nombre.
  let subReceta = App.recetas.find(x => x.ID_receta === subRecetaMpId);
  if (!subReceta && mp) subReceta = App.recetas.find(x => x.nombre === mp.nombre && x.tipo_receta === 'sub_receta');

  if (!subReceta) {
    cont.innerHTML = `<p style="font-size:9px;color:var(--txt3);padding:4px 0">No se encontró la receta detallada de esta sub-receta.</p>`;
    return;
  }

  let ingredientesSub = [];
  try { ingredientesSub = JSON.parse(subReceta.ingredientes_JSON || '[]'); } catch(e) {}
  const pesoBaseSub = ingredientesSub.reduce((s,ing) => s + (parseFloat(ing.gramos)||0), 0);
  const factorSub = pesoBaseSub > 0 ? gramosNecesarios / pesoBaseSub : 0;

  cont.innerHTML = renderTablaIngredientesExpandible(ingredientesSub, factorSub, filaId);
}

async function eliminarPlanMasaBaseUI(fila) {
  if (!confirm('¿Eliminar esta entrada del plan?')) return;
  try {
    await escribirEnSheet('eliminar_entrada_plan_masa_base', { fila });
    toast('Eliminado');
    renderVistaPlanMasaBase();
  } catch(e) {
    toast('Error al eliminar', 'error');
  }
}

// ── ADMIN: AUDITORÍA DE COSTOS ────────────────────────────────
let _auditoriaResultado = null;

function renderVistaAuditoriaCostos() {
  const vista = document.getElementById('vista-auditoria-costos');
  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Auditoría de costos</h1></div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:16px">
      Recalcula, con los precios <strong>actuales</strong> de Materias Primas, cuánto debería costar
      cada receta consolidada, y lo compara contra lo que quedó guardado la última vez que se aprobó.
      Útil para detectar recetas que quedaron desactualizadas después de cambiar un precio.
    </p>
    <button class="btn-primario" onclick="ejecutarAuditoriaCostos(this)" style="margin-bottom:16px">
      <i class="ti ti-shield-check"></i> Ejecutar auditoría
    </button>
    <div id="auditoria-resultado-contenedor"></div>
  `;
  mostrarVista('auditoria-costos');
}

async function ejecutarAuditoriaCostos(btn) {
  bloquearBtn(btn, 'Auditando...');
  const contenedor = document.getElementById('auditoria-resultado-contenedor');
  contenedor.innerHTML = '<div style="padding:20px;text-align:center;color:var(--txt3)"><div class="spinner"></div> Revisando todas las recetas...</div>';
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'auditar_costos_recetas' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    desbloquearBtn(btn, '<i class="ti ti-shield-check"></i> Ejecutar auditoría', true);
    if (!data.ok) { contenedor.innerHTML = `<p style="color:#C62828">Error: ${data.msg||''}</p>`; return; }
    _auditoriaResultado = data;
    renderResultadoAuditoria();
  } catch(e) {
    desbloquearBtn(btn, '<i class="ti ti-shield-check"></i> Ejecutar auditoría', true);
    contenedor.innerHTML = `<p style="color:#C62828">No se pudo ejecutar: ${e.message}</p>`;
  }
}

function renderResultadoAuditoria() {
  const contenedor = document.getElementById('auditoria-resultado-contenedor');
  const data = _auditoriaResultado;
  if (!data) return;

  if (!data.recetas.length) {
    contenedor.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-circle-check" style="color:#2E7D32"></i>
        <h2>Todo al día</h2>
        <p>Se revisaron ${data.total_revisadas} recetas y ninguna tiene diferencias relevantes entre el costo guardado y el actual.</p>
      </div>`;
    return;
  }

  contenedor.innerHTML = `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <div style="background:#FFEBEE;border-radius:var(--r-md);padding:10px 16px">
        <div style="font-size:11px;color:#C62828">Con diferencias</div>
        <div style="font-size:20px;font-weight:700;color:#C62828;font-family:'DM Mono',monospace">${data.con_diferencias}</div>
      </div>
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px">
        <div style="font-size:11px;color:var(--txt3)">Total revisadas</div>
        <div style="font-size:20px;font-weight:700;font-family:'DM Mono',monospace">${data.total_revisadas}</div>
      </div>
    </div>
    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Recetas a revisar</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Receta</th>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Área</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Guardado</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Actual</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Diferencia</th>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Alertas</th>
        </tr></thead>
        <tbody>
          ${data.recetas.map(r => `
            <tr>
              <td class="td-nombre">${r.nombre} ${r.tipo === 'sub_receta' ? '<span style="font-size:10px;color:#5B21B6">⟳ sub</span>' : ''}</td>
              <td style="font-size:13px;color:var(--txt2)">${r.área}</td>
              <td class="td-num">${clp(r.costo_guardado)}</td>
              <td class="td-num" style="font-weight:600">${clp(r.costo_actual)}</td>
              <td class="td-num" style="color:${r.diferencia_pct > 0 ? '#C62828' : r.diferencia_pct < 0 ? '#2E7D32' : 'var(--txt2)'};font-weight:600">
                ${r.diferencia_pct > 0 ? '+' : ''}${r.diferencia_pct}%
              </td>
              <td style="font-size:11px;color:#C62828">${r.problemas.join('; ')}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:11px;color:var(--txt3);margin-top:10px">
      <i class="ti ti-info-circle"></i> Para corregir una receta: ábrala, guárdela (recalcula con los precios actuales) y vuelva a aprobarla.
    </p>
  `;
}

// ── ADMIN: ANÁLISIS DE $ MERMA ────────────────────────────────
let _mermaTodasAreas = [];

async function renderVistaAnalisisMerma() {
  const vista = document.getElementById('vista-analisis-merma');
  if (!vista) return;
  mostrarVista('analisis-merma');

  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_registro_merma' }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    _mermaTodasAreas = data.registros || [];
  } catch(e) {
    _mermaTodasAreas = [];
  }

  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Análisis de $ merma</h1>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
      <select id="filtro-analisis-merma-area" onchange="renderAnalisisMerma()"
        style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit">
        <option value="">Todas las áreas</option>
        ${Object.entries(FEN.AREAS).map(([cod,a]) => `<option value="${cod}">${a.nombre}</option>`).join('')}
      </select>
      <select id="filtro-analisis-merma-periodo" onchange="renderAnalisisMerma()"
        style="padding:7px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-size:13px;font-family:inherit">
        <option value="semana">Esta semana</option>
        <option value="mes" selected>Este mes</option>
        <option value="todos">Todos</option>
      </select>
    </div>
    <div id="resumen-analisis-merma" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px"></div>
    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Detalle</div>
      <div id="tabla-analisis-merma" style="overflow-x:auto"></div>
    </div>
  `;
  renderAnalisisMerma();
}

function renderAnalisisMerma() {
  const areaFiltro = document.getElementById('filtro-analisis-merma-area')?.value || '';
  const periodo     = document.getElementById('filtro-analisis-merma-periodo')?.value || 'mes';

  const hoy = new Date();
  const off = hoy.getTimezoneOffset() * 60000;
  const fechaHoy = new Date(hoy - off).toISOString().slice(0,10);
  const lunesSemana = (() => {
    const d = new Date(hoy);
    d.setDate(d.getDate() - (d.getDay()===0?6:d.getDay()-1));
    return new Date(d - off).toISOString().slice(0,10);
  })();
  const primerMes = fechaHoy.slice(0,7) + '-01';

  let filtrados = _mermaTodasAreas.filter(r => {
    if (areaFiltro && r.area_codigo !== areaFiltro) return false;
    if (periodo === 'semana' && r.fecha < lunesSemana) return false;
    if (periodo === 'mes' && r.fecha < primerMes) return false;
    return true;
  }).sort((a,b) => b.fecha.localeCompare(a.fecha) || (b.hora||'').localeCompare(a.hora||''));

  const motivos = { derrame_error:'Derrame/error', devolucion_cliente:'Devolución cliente', vencimiento:'Vencimiento', prueba_receta:'Prueba de receta', otro:'Otro' };
  const totalCosto = filtrados.reduce((s,r) => s + (parseFloat(r.costo_calculado)||0), 0);

  // Desglose por área
  const porArea = {};
  filtrados.forEach(r => { porArea[r.area_codigo] = (porArea[r.area_codigo]||0) + (parseFloat(r.costo_calculado)||0); });

  const resumenEl = document.getElementById('resumen-analisis-merma');
  if (resumenEl) {
    resumenEl.innerHTML = `
      <div style="background:var(--surface);border:2px solid #C62828;border-radius:var(--r-md);padding:10px 16px;min-width:160px">
        <div style="font-size:11px;color:var(--txt3)">🗑️ Total perdido</div>
        <div style="font-size:20px;font-weight:700;color:#C62828;font-family:'DM Mono',monospace">${clp(totalCosto)}</div>
      </div>
      ${Object.entries(porArea).map(([cod, monto]) => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px;min-width:140px">
          <div style="font-size:11px;color:var(--txt3)">${FEN.AREAS[cod]?.nombre || cod}</div>
          <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace">${clp(monto)}</div>
        </div>
      `).join('')}
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 16px;min-width:110px">
        <div style="font-size:11px;color:var(--txt3)">Registros</div>
        <div style="font-size:20px;font-weight:700;font-family:'DM Mono',monospace">${filtrados.length}</div>
      </div>
    `;
  }

  const tablaEl = document.getElementById('tabla-analisis-merma');
  if (!tablaEl) return;
  if (!filtrados.length) {
    tablaEl.innerHTML = '<p style="padding:20px;color:var(--txt3);font-size:13px;text-align:center">Sin registros para los filtros seleccionados.</p>';
    return;
  }
  tablaEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse">
      <thead><tr>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Fecha</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Área</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Ítem</th>
        <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Cantidad</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Motivo</th>
        <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Costo</th>
        <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Nota</th>
      </tr></thead>
      <tbody>
        ${filtrados.map(r => `
          <tr style="border-top:1px solid var(--border)">
            <td style="padding:8px 14px;font-size:12px">${r.fecha}${r.hora ? ' · '+r.hora : ''}</td>
            <td style="padding:8px 14px;font-size:12px">${FEN.AREAS[r.area_codigo]?.nombre || r.area_codigo}</td>
            <td style="padding:8px 14px;font-size:12px;font-weight:600">${r.item_nombre || ''} ${r.tipo_perdida === 'mp' ? '<span style="font-size:10px;color:var(--txt3)">(MP)</span>' : ''}</td>
            <td style="padding:8px 14px;font-size:12px;text-align:right">${parseFloat(r.cantidad||0)} ${r.unidad||''}</td>
            <td style="padding:8px 14px;font-size:12px">${motivos[r.motivo] || r.motivo || ''}</td>
            <td style="padding:8px 14px;font-size:12px;text-align:right;color:#C62828;font-weight:600">${clp(r.costo_calculado||0)}</td>
            <td style="padding:8px 14px;font-size:12px;color:var(--txt2)">${r.nota || ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// ── ADMIN: CONFIG DE COSTEO (FASE 2) ──────────────────────────
let _configCosteoFilas = [];
let _gastosSincronizados = null;

// ── ADMIN: CORREOS DE CONTACTO POR ÁREA ────────────────────────
// ── ADMIN: PRODUCTOS DE REVENTA ────────────────────────────────
// ── ADMIN: VENTAS MENSUALES CONSOLIDADAS (Fase 3) ──────────────
async function renderVistaVentasMensuales() {
  const vista = document.getElementById('vista-ventas-mensuales');
  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Ventas mensuales (B2B/B2C)</h1></div>
    <p style="font-size:12px;color:var(--txt3);margin-bottom:16px">
      Trae la agregación mensual de ventas que B2B y B2C publican como CSV — para calcular margen de contribución real
      cruzando esto con Estructuras de costo. No reemplaza la Estimación de demanda (esa sigue siendo la foto histórica).
    </p>
    <div id="ventas-mensuales-contenido"><p style="color:var(--txt3)">Cargando...</p></div>
  `;
  mostrarVista('ventas-mensuales');

  let urls = { b2b: '', b2c: '' };
  let ventas = [];
  try {
    const payloadUrls = encodeURIComponent(JSON.stringify({ accion: 'leer_urls_ventas_csv' }));
    const resUrls = await fetch(FEN.WEBAPP_URL + '?payload=' + payloadUrls, { cache: 'no-store' });
    urls = (await resUrls.json()).urls || urls;

    const payloadVentas = encodeURIComponent(JSON.stringify({ accion: 'leer_ventas_mensuales' }));
    const resVentas = await fetch(FEN.WEBAPP_URL + '?payload=' + payloadVentas, { cache: 'no-store' });
    ventas = (await resVentas.json()).ventas || [];
  } catch(e) {
    toast('No se pudo cargar la configuración actual', 'error');
  }

  // Nombre para mostrar junto al ID — cruza Maestro de recetas y productos de reventa
  const nombrePorId = {};
  try {
    const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
    maestro.forEach(r => { nombrePorId[r.ID_receta] = r.nombre; });
    const payloadReventa = encodeURIComponent(JSON.stringify({ accion: 'leer_productos_reventa' }));
    const resReventa = await fetch(FEN.WEBAPP_URL + '?payload=' + payloadReventa, { cache: 'no-store' });
    ((await resReventa.json()).productos || []).forEach(p => { nombrePorId[p.ID_reventa] = p.nombre; });
  } catch(e) {}

  const cont = document.getElementById('ventas-mensuales-contenido');

  // Resumen: último mes sincronizado por canal, y total de filas
  const mesesPorCanal = {};
  ventas.forEach(v => {
    if (!mesesPorCanal[v.canal] || v.mes > mesesPorCanal[v.canal]) mesesPorCanal[v.canal] = v.mes;
  });

  cont.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-link"></i> Links de los CSV publicados</div>
      <div style="padding:16px">
        <div class="campo" style="margin-bottom:14px">
          <label>Link CSV — B2B</label>
          <input type="text" id="url-ventas-b2b" value="${urls.b2b || ''}" placeholder="https://docs.google.com/.../output=csv"
            style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo" style="margin-bottom:14px">
          <label>Link CSV — B2C</label>
          <input type="text" id="url-ventas-b2c" value="${urls.b2c || ''}" placeholder="https://docs.google.com/.../output=csv"
            style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <button class="btn-secundario" onclick="guardarUrlsVentasUI(this)">
          <i class="ti ti-device-floppy"></i> Guardar links
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-refresh"></i> Sincronizar</div>
      <div style="padding:16px">
        <button class="btn-primario" onclick="sincronizarVentasMensualesUI(this)">
          <i class="ti ti-download"></i> Sincronizar ventas ahora
        </button>
        <p style="font-size:11px;color:var(--txt3);margin-top:10px">
          ${Object.keys(mesesPorCanal).length
            ? Object.entries(mesesPorCanal).map(([canal, mes]) => `Último mes recibido de ${canal}: <strong>${mes}</strong>`).join(' · ')
            : 'Todavía no se ha sincronizado nada.'}
        </p>
      </div>
    </div>

    ${ventas.length ? (() => {
      // Agrupar por área, y dentro de cada área por canal (B2B primero, B2C después)
      const porArea = {};
      ventas.forEach(v => {
        const area = v.área || 'Sin área (revisar)';
        (porArea[area] = porArea[area] || []).push(v);
      });
      return Object.entries(porArea).sort(([a],[b]) => a.localeCompare(b,'es')).map(([area, filasArea]) => {
        const porCanal = { B2B: [], B2C: [] };
        filasArea.forEach(v => (porCanal[v.canal] = porCanal[v.canal] || []).push(v));
        const totalB2B = porCanal.B2B.reduce((s,v) => s + (parseFloat(v.monto_neto)||0), 0);
        const totalB2C = porCanal.B2C.reduce((s,v) => s + (parseFloat(v.monto_neto)||0), 0);
        const totalArea = totalB2B + totalB2C;
        return `
        <div class="card" style="margin-bottom:16px">
          <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span><i class="ti ti-table"></i> ${area} <span style="font-weight:400;color:var(--txt3)">(${filasArea.length} fila${filasArea.length!==1?'s':''})</span></span>
            <span style="font-size:12px;font-weight:600;display:flex;gap:14px">
              ${totalB2B > 0 ? `<span style="color:var(--txt2)">B2B: ${clp(totalB2B)}</span>` : ''}
              ${totalB2C > 0 ? `<span style="color:var(--txt2)">B2C: ${clp(totalB2C)}</span>` : ''}
              <span>Total: ${clp(totalArea)}</span>
            </span>
          </div>
          ${Object.entries(porCanal).filter(([,filas]) => filas.length).map(([canal, filas]) => `
            <div style="padding:10px 16px 4px;font-size:11px;font-weight:700;text-transform:uppercase;color:var(--txt3);letter-spacing:.4px">${canal}</div>
            <div style="overflow-x:auto">
              <table class="tabla-vista">
                <thead><tr>
                  <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3);background:var(--bg)">ID receta</th>
                  <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Mes</th>
                  <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Cantidad</th>
                  <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3);background:var(--bg)">Monto neto</th>
                </tr></thead>
                <tbody>
                  ${filas.sort((a,b) => b.mes.localeCompare(a.mes) || a.ID_receta.localeCompare(b.ID_receta)).map(v => `
                    <tr style="border-top:1px solid var(--border)">
                      <td style="padding:6px 14px;font-size:12px">
                        ${nombrePorId[v.ID_receta] || '<span style="color:var(--txt3)">(sin nombre — revisar)</span>'}
                        <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:4px">${v.ID_receta}</span>
                      </td>
                      <td style="padding:6px 14px;font-size:12px">${v.mes}</td>
                      <td style="padding:6px 14px;font-size:12px;text-align:right;font-family:'DM Mono',monospace">${parseFloat(v.cantidad_vendida).toLocaleString('es-CL')}</td>
                      <td style="padding:6px 14px;font-size:12px;text-align:right;font-family:'DM Mono',monospace">${clp(v.monto_neto)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `).join('')}
        </div>`;
      }).join('');
    })() : ''}
  `;
}

async function guardarUrlsVentasUI(btn) {
  const b2b = document.getElementById('url-ventas-b2b')?.value.trim() || '';
  const b2c = document.getElementById('url-ventas-b2c')?.value.trim() || '';
  bloquearBtn(btn, 'Guardando...');
  try {
    await escribirEnSheet('guardar_urls_ventas_csv', { b2b, b2c });
    toast('Links guardados');
  } catch(e) {
    toast('Error: ' + e.message, 'error');
  }
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar links', true);
}

async function sincronizarVentasMensualesUI(btn) {
  bloquearBtn(btn, 'Sincronizando...');
  try {
    const resp = await escribirEnSheet('sincronizar_ventas_mensuales', {});
    if (resp?.ok) {
      toast(resp.msg);
      renderVistaVentasMensuales();
    } else {
      toast('Error: ' + (resp?.msg || ''), 'error');
      desbloquearBtn(btn, '<i class="ti ti-download"></i> Sincronizar ventas ahora', true);
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
    desbloquearBtn(btn, '<i class="ti ti-download"></i> Sincronizar ventas ahora', true);
  }
}

// ── ADMIN: INVERSIONES Y DEPRECIACIÓN ──────────────────────────
// ── ADMIN: RENTABILIDAD REAL (precio real vs. costo real, por producto) ──────
// Pregunta inversa a Estructuras de costo: en vez de "dado el costo, ¿a qué
// precio vender?", responde "dado lo que realmente estoy vendiendo y cobrando,
// ¿me conviene ese precio?" — cruza Ventas_mensuales_consolidadas (precio real
// = monto_neto / cantidad_vendida) con EC_productos (costo real calculado).
async function renderVistaRentabilidadReal() {
  const vista = document.getElementById('vista-rentabilidad-real');
  const hoy = new Date();
  const mesActual = App._rentMesActual || `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Rentabilidad real</h1></div>
    <p style="font-size:12px;color:var(--txt3);margin-bottom:16px">
      Compara el precio real que está cobrando (promedio real de las ventas) contra el costo real calculado —
      para saber si le sale a cuenta vender a ese precio, no cuánto debería cobrar. Requiere que ya haya calculado
      "Estructuras de costo" para el mes que elija.
    </p>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;gap:10px;align-items:flex-end;padding:16px;flex-wrap:wrap">
        <div class="campo">
          <label>Mes (YYYY-MM)</label>
          <input type="text" id="rent-mes" value="${mesActual}" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <button class="btn-primario" onclick="calcularRentabilidadRealUI(this)">
          <i class="ti ti-scale"></i> Calcular
        </button>
      </div>
    </div>
    <div id="rentabilidad-resultado"></div>
  `;
  mostrarVista('rentabilidad-real');
}

async function calcularRentabilidadRealUI(btn) {
  const mes = document.getElementById('rent-mes').value.trim();
  App._rentMesActual = mes;
  const cont = document.getElementById('rentabilidad-resultado');
  bloquearBtn(btn, 'Calculando...');
  cont.innerHTML = '<p style="color:var(--txt3)">Cargando...</p>';

  try {
    const [ecTodas, ventasRes] = await Promise.all([
      leerHoja('EC_productos'),
      fetch(FEN.WEBAPP_URL + '?payload=' + encodeURIComponent(JSON.stringify({ accion: 'leer_ventas_mensuales' })), { cache: 'no-store' }).then(r => r.json())
    ]);

    const ec = ecTodas.filter(r => r.mes === mes);
    const ventas = (ventasRes.ventas || []).filter(v => v.mes === mes);
    const ecPorId = {};
    ec.forEach(r => { ecPorId[r.ID_receta] = r; });

    if (!ventas.length) {
      cont.innerHTML = `<div class="empty-state"><i class="ti ti-scale"></i><h2>Sin ventas sincronizadas para ${mes}</h2></div>`;
      desbloquearBtn(btn, '<i class="ti ti-scale"></i> Calcular', true);
      return;
    }

    const filas = ventas.map(v => {
      const ecRow = ecPorId[v.ID_receta];
      const cantidad = parseFloat(v.cantidad_vendida) || 0;
      const montoNeto = parseFloat(v.monto_neto) || 0;
      const precioReal = cantidad > 0 ? montoNeto / cantidad : 0;
      const costoReal = ecRow ? parseFloat(ecRow.total_costo_prod) || 0 : null;
      const margenMonto = costoReal !== null ? precioReal - costoReal : null;
      const margenPct = (costoReal !== null && precioReal > 0) ? (margenMonto / precioReal) * 100 : null;
      const objetivoPct = ecRow ? parseFloat(v.canal === 'B2B' ? ecRow['utilidad_B2B_%'] : ecRow['utilidad_B2C_%']) : null;
      const cumple = (margenPct !== null && objetivoPct !== null && !isNaN(objetivoPct)) ? margenPct >= objetivoPct : null;
      return {
        nombre: ecRow?.nombre || v.ID_receta, ID_receta: v.ID_receta, área: v['área'] || ecRow?.área || '—',
        canal: v.canal, cantidad, precioReal, costoReal, margenMonto, margenPct, objetivoPct, cumple
      };
    }).sort((a,b) => (a.margenPct ?? 999) - (b.margenPct ?? 999)); // peores primero, para verlos de inmediato

    const sinCosto = filas.filter(f => f.costoReal === null).length;

    // Resumen por área — ingresos y costos reales, calculado con la mezcla de
    // ventas real del mes (no supuesto). "¿Cubre costos?" es el hallazgo que
    // dispara auditoría si sale que no — no se fuerza a que parezca bien.
    const areasPresentes = [...new Set(filas.map(f => f.área))].sort((a,b) => a.localeCompare(b,'es'));
    const resumenPorArea = areasPresentes.map(area => {
      const filasArea = filas.filter(f => f.área === area);
      let ingresosConCosto = 0, totalCostos = 0, totalObjetivoUtilidad = 0, ingresosSinCosto = 0;
      filasArea.forEach(f => {
        const ingresoFila = f.precioReal * f.cantidad;
        if (f.costoReal !== null) {
          ingresosConCosto += ingresoFila;
          totalCostos += f.costoReal * f.cantidad;
          if (f.objetivoPct !== null && !isNaN(f.objetivoPct)) {
            totalObjetivoUtilidad += ingresoFila * (f.objetivoPct / 100);
          }
        } else {
          ingresosSinCosto += ingresoFila;
        }
      });
      const utilidadReal = ingresosConCosto - totalCostos;
      const utilidadRealPct = ingresosConCosto > 0 ? (utilidadReal / ingresosConCosto) * 100 : null;
      const cubreCostos = ingresosConCosto > 0 ? utilidadReal >= 0 : null;
      const objetivoPonderado = ingresosConCosto > 0 ? (totalObjetivoUtilidad / ingresosConCosto) * 100 : null;
      const alcanzaObjetivo = (utilidadRealPct !== null && objetivoPonderado !== null) ? utilidadRealPct >= objetivoPonderado : null;
      return { area, ingresosConCosto, ingresosSinCosto, totalCostos, utilidadReal, utilidadRealPct, cubreCostos, objetivoPonderado, alcanzaObjetivo };
    });

    cont.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin-bottom:16px">
        ${resumenPorArea.map(r => `
          <div class="card" style="border:2px solid ${r.cubreCostos === false ? '#C62828' : r.cubreCostos === true ? '#2E7D32' : 'var(--border)'}">
            <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
              <span>${r.area}</span>
              ${r.cubreCostos === false ? '<span style="font-size:11px;color:#C62828;font-weight:700"><i class="ti ti-alert-triangle"></i> No cubre costos</span>' : r.cubreCostos === true ? '<span style="font-size:11px;color:#2E7D32;font-weight:700"><i class="ti ti-circle-check"></i> Cubre costos</span>' : ''}
            </div>
            <div style="padding:12px 16px">
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
                <span style="color:var(--txt3)">Ingresos reales${r.ingresosSinCosto > 0 ? ' (con costo calculado)' : ''}</span>
                <span style="font-family:'DM Mono',monospace;font-weight:600">${clp(r.ingresosConCosto)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
                <span style="color:var(--txt3)">Costos reales (MP+fijos+remuneración)</span>
                <span style="font-family:'DM Mono',monospace;font-weight:600">${clp(r.totalCostos)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:6px 0;margin-top:4px;border-top:1px solid var(--border);font-size:13px">
                <span style="font-weight:600">${r.utilidadReal >= 0 ? 'Utilidad real' : 'Déficit'}</span>
                <span style="font-family:'DM Mono',monospace;font-weight:700;color:${r.utilidadReal >= 0 ? '#2E7D32' : '#C62828'}">
                  ${clp(Math.abs(r.utilidadReal))}${r.utilidadRealPct !== null ? ` (${r.utilidadRealPct.toFixed(1)}%)` : ''}
                </span>
              </div>
              ${r.cubreCostos && r.objetivoPonderado !== null ? `
              <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px">
                <span style="color:var(--txt3)">Objetivo ponderado (mezcla de ventas)</span>
                <span style="font-family:'DM Mono',monospace">${r.objetivoPonderado.toFixed(1)}%</span>
              </div>
              <div style="font-size:12px;margin-top:2px;color:${r.alcanzaObjetivo ? '#2E7D32' : '#E65100'}">
                <i class="ti ${r.alcanzaObjetivo ? 'ti-circle-check' : 'ti-alert-triangle'}"></i>
                ${r.alcanzaObjetivo ? 'Alcanza el objetivo de utilidad' : 'No alcanza el objetivo de utilidad todavía'}
              </div>` : ''}
              ${r.ingresosSinCosto > 0 ? `<p style="font-size:10px;color:var(--txt3);margin-top:8px">+ ${clp(r.ingresosSinCosto)} en ventas sin costo calculado — no se incluyen en este resumen todavía.</p>` : ''}
            </div>
          </div>
        `).join('')}
      </div>

      ${sinCosto ? `<div style="padding:10px 14px;background:#FFF3E0;border-radius:var(--r-md);font-size:12px;color:#E65100;margin-bottom:14px">
        ⚠ ${sinCosto} producto(s) sin costo calculado para ${mes} — calcule "Estructuras de costo" primero para ese mes, para verlos completos.
      </div>` : ''}
      <div class="card">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg)">
            <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Producto</th>
            <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Canal</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Precio real</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Costo real</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Margen $</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Margen %</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Objetivo</th>
            <th style="text-align:center;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">¿Cumple?</th>
          </tr></thead>
          <tbody>
            ${filas.map(f => `
              <tr style="border-top:1px solid var(--border);${f.cumple === false ? 'background:#FFEBEE' : ''}">
                <td style="padding:8px 12px;font-size:13px">
                  <div>${f.nombre}</div>
                  <div style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace">${f.ID_receta}</div>
                </td>
                <td style="padding:8px 12px;font-size:12px">${f.canal}</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">${clp(f.precioReal)}</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">${f.costoReal !== null ? clp(f.costoReal) : '—'}</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">${f.margenMonto !== null ? clp(f.margenMonto) : '—'}</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace;font-weight:600">${f.margenPct !== null ? f.margenPct.toFixed(1)+'%' : '—'}</td>
                <td style="padding:8px 12px;font-size:12px;text-align:right;color:var(--txt3)">${f.objetivoPct !== null && !isNaN(f.objetivoPct) ? f.objetivoPct.toFixed(1)+'%' : '—'}</td>
                <td style="padding:8px 12px;text-align:center">
                  ${f.cumple === true ? '<span style="color:#2E7D32"><i class="ti ti-check"></i></span>' : f.cumple === false ? '<span style="color:#C62828"><i class="ti ti-x"></i></span>' : '—'}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    cont.innerHTML = `<p style="color:#C62828">Error: ${e.message}</p>`;
  }
  desbloquearBtn(btn, '<i class="ti ti-scale"></i> Calcular', true);
}

async function renderVistaInversiones() {
  const vista = document.getElementById('vista-inversiones');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <h1 class="vista-titulo">Inversiones</h1>
        <p style="font-size:12px;color:var(--txt3);margin-top:4px">
          Bienes de mayor valor (hornos, vehículos, remodelaciones) — se reparten en cuotas mensuales de depreciación
          a lo largo de su vida útil, y esa cuota se suma a los gastos generales del costeo. La vida útil (cuántos
          meses/años dura el bien para efectos tributarios) confírmela con su contador — acá solo se hace el cálculo.
        </p>
      </div>
      <button class="btn-primario" onclick="abrirFormInversion()">
        <i class="ti ti-plus"></i> Nueva inversión
      </button>
    </div>
    <div id="lista-inversiones"><p style="color:var(--txt3)">Cargando...</p></div>
  `;
  mostrarVista('inversiones');

  let inversiones = [];
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_inversiones' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    inversiones = (await res.json()).inversiones || [];
  } catch(e) {
    toast('No se pudieron cargar las inversiones', 'error');
  }
  App._inversiones = inversiones;
  renderListaInversiones();
}

function renderListaInversiones() {
  const cont = document.getElementById('lista-inversiones');
  const inversiones = App._inversiones || [];

  if (!inversiones.length) {
    cont.innerHTML = `<div class="empty-state"><i class="ti ti-building-bank"></i><h2>Sin inversiones registradas todavía</h2></div>`;
    return;
  }

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

  cont.innerHTML = `
    <div class="card">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg)">
          <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Inversión</th>
          <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Monto total</th>
          <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Vida útil</th>
          <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Cuota mensual</th>
          <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Área</th>
          <th style="padding:8px 12px"></th>
        </tr></thead>
        <tbody>
          ${inversiones.map(inv => {
            const activa = inv.activa !== 'no';
            return `
            <tr style="border-top:1px solid var(--border);${activa?'':'opacity:.5'}">
              <td style="padding:10px 12px">
                <div style="font-weight:600;font-size:13px">${inv.nombre}</div>
                <div style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace">${inv.ID_inversion} · compra: ${inv.fecha_compra || '—'}${!activa ? ' · INACTIVA' : ''}</div>
              </td>
              <td style="text-align:right;padding:10px 12px;font-family:'DM Mono',monospace">${clp(inv.monto_total)}</td>
              <td style="text-align:right;padding:10px 12px">${inv.vida_util_meses} meses</td>
              <td style="text-align:right;padding:10px 12px;font-family:'DM Mono',monospace">${clp(inv.depreciacion_mensual)}</td>
              <td style="padding:10px 12px">${inv['área'] ? (FEN.AREAS[inv['área']]?.nombre || inv['área']) : '<span style="color:var(--txt3)">Compartida (prorrateada)</span>'}</td>
              <td style="text-align:right;padding:10px 12px;white-space:nowrap">
                <button class="btn-secundario" style="font-size:12px;padding:5px 10px;margin-right:4px" onclick="abrirFormInversion('${inv.ID_inversion}')">
                  <i class="ti ti-pencil"></i>
                </button>
                <button class="btn-secundario" style="font-size:12px;padding:5px 10px" onclick="toggleActivaInversion('${inv.ID_inversion}',${activa})">
                  <i class="ti ti-${activa?'circle-x':'circle-check'}"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function abrirFormInversion(idExistente) {
  const inv = idExistente ? (App._inversiones || []).find(x => x.ID_inversion === idExistente) : null;

  const nombre = prompt('Nombre de la inversión (ej: "Horno rotatorio Panadería"):', inv?.nombre || '');
  if (nombre === null || !nombre.trim()) return;

  const monto = prompt('Monto total pagado (neto, todo junto — no la cuota mensual del crédito si la compró en cuotas):', inv?.monto_total || '');
  if (monto === null) return;
  const montoNum = parseFloat(monto);
  if (isNaN(montoNum) || montoNum <= 0) { toast('Monto inválido', 'error'); return; }

  const fechaCompra = prompt('Fecha de compra (AAAA-MM-DD):', inv?.fecha_compra || new Date().toISOString().slice(0,10));
  if (fechaCompra === null) return;

  const vidaUtil = prompt('Vida útil en MESES (confirme este número con su contador — ej: un horno puede ser 60-120 meses según normativa):', inv?.vida_util_meses || '');
  if (vidaUtil === null) return;
  const vidaUtilNum = parseFloat(vidaUtil);
  if (isNaN(vidaUtilNum) || vidaUtilNum <= 0) { toast('Vida útil inválida', 'error'); return; }

  const areaTexto = Object.entries(FEN.AREAS).map(([cod,a]) => `${cod}=${a.nombre}`).join(', ');
  const area = prompt(
    `¿Es de un área específica, o compartida entre todas?\n\nEscriba el código si es de una sola área (${areaTexto}), o deje vacío si es compartida (ej: vehículo de reparto, remodelación general) — se prorrateará por ventas.`,
    inv?.['área'] || ''
  );
  if (area === null) return;

  (async () => {
    const payload = { nombre: nombre.trim(), monto_total: montoNum, fecha_compra: fechaCompra, vida_util_meses: vidaUtilNum, area: area.trim().toUpperCase() };
    const resp = inv
      ? await escribirEnSheet('editar_inversion', { ID_inversion: inv.ID_inversion, ...payload })
      : await escribirEnSheet('crear_inversion', payload);
    if (resp?.ok) {
      toast(resp.msg);
      renderVistaInversiones();
    } else {
      toast('Error: ' + (resp?.msg || ''), 'error');
    }
  })();
}

async function toggleActivaInversion(id, estaActiva) {
  const accion = estaActiva ? 'desactivar' : 'reactivar';
  if (!confirm(`¿${accion === 'desactivar' ? 'Desactivar' : 'Reactivar'} esta inversión? ${accion === 'desactivar' ? 'Deja de sumar depreciación a los gastos generales.' : ''}`)) return;
  const resp = await escribirEnSheet('editar_inversion', { ID_inversion: id, activa: estaActiva ? 'no' : 'si' });
  if (resp?.ok) {
    toast('Inversión ' + (estaActiva ? 'desactivada' : 'reactivada'));
    renderVistaInversiones();
  } else {
    toast('Error: ' + (resp?.msg || ''), 'error');
  }
}

async function renderVistaProductosReventa() {
  const vista = document.getElementById('vista-productos-reventa');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <h1 class="vista-titulo">Productos de reventa</h1>
        <p style="font-size:12px;color:var(--txt3);margin-top:4px">
          Productos que se compran ya terminados (no se producen en fën) — igual entran a la lista pública para B2B/B2C.
        </p>
      </div>
      <button class="btn-primario" onclick="abrirFormProductoReventa()">
        <i class="ti ti-plus"></i> Nuevo producto
      </button>
    </div>
    <div id="lista-productos-reventa"><p style="color:var(--txt3)">Cargando...</p></div>
  `;
  mostrarVista('productos-reventa');

  let productos = [];
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_productos_reventa' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const data = await res.json();
    productos = data.productos || [];
  } catch(e) {
    toast('No se pudieron cargar los productos de reventa', 'error');
  }
  App._productosReventa = productos;
  renderListaProductosReventa();
}

function renderListaProductosReventa() {
  const cont = document.getElementById('lista-productos-reventa');
  const productos = (App._productosReventa || []).filter(p => p.activo !== 'no');

  if (!productos.length) {
    cont.innerHTML = `<div class="empty-state"><i class="ti ti-shopping-cart"></i><h2>Sin productos de reventa todavía</h2></div>`;
    return;
  }

  cont.innerHTML = `
    <div class="card">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg)">
          <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Producto</th>
          <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Costo por unidad</th>
          <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Stock</th>
          <th style="padding:8px 12px"></th>
        </tr></thead>
        <tbody>
          ${productos.map(p => {
            const stock = parseFloat(p.stock_actual) || 0;
            const stockMin = parseFloat(p.stock_minimo) || 0;
            const stockBajo = stockMin > 0 && stock <= stockMin;
            return `
            <tr style="border-top:1px solid var(--border)">
              <td style="padding:10px 12px">
                <div style="font-weight:600;font-size:13px">${p.nombre}</div>
                <div style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace">${p.ID_reventa} · compra por ${p.unidad_compra}</div>
              </td>
              <td style="text-align:right;padding:10px 12px;font-family:'DM Mono',monospace">${clp(p.costo_por_unidad)}</td>
              <td style="text-align:right;padding:10px 12px">
                <span style="font-family:'DM Mono',monospace;${stockBajo ? 'color:#C62828;font-weight:700' : ''}">${stock}</span>
                ${stockBajo ? '<div style="font-size:10px;color:#C62828"><i class="ti ti-alert-triangle"></i> Stock bajo</div>' : ''}
              </td>
              <td style="text-align:right;padding:10px 12px;white-space:nowrap">
                <button class="btn-secundario" style="font-size:12px;padding:5px 10px;margin-right:4px" onclick="abrirAjusteStockReventa('${p.ID_reventa}','${(p.nombre||'').replace(/'/g,"\\'")}')">
                  <i class="ti ti-adjustments"></i> Stock
                </button>
                <button class="btn-secundario" style="font-size:12px;padding:5px 10px" onclick="abrirFormProductoReventa('${p.ID_reventa}')">
                  <i class="ti ti-pencil"></i>
                </button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function abrirFormProductoReventa(idExistente) {
  const p = idExistente ? (App._productosReventa || []).find(x => x.ID_reventa === idExistente) : null;

  const nombre = prompt('Nombre del producto:', p?.nombre || '');
  if (nombre === null || !nombre.trim()) return;

  const unidadCompra = prompt(
    'Unidad de compra (ej: un, 24un, kg, 500ml):',
    p?.unidad_compra || 'un'
  );
  if (unidadCompra === null) return;

  const costoNeto = prompt(
    `Precio neto (sin IVA) del paquete completo de "${nombre}" (0 si no aplica, ej. un servicio):`,
    p?.costo_neto || ''
  );
  if (costoNeto === null) return;
  const neto = parseFloat(costoNeto);
  if (isNaN(neto) || neto < 0) { toast('Precio inválido', 'error'); return; }

  const area = prompt(
    `¿A qué categoría pertenece? Deje "Reventa" para productos comprados y revendidos (ej. barras de chocolate).\n` +
    `Use otra palabra para servicios que no son productos físicos (ej. "Servicios" para Despacho):`,
    p?.area || 'Reventa'
  );
  if (area === null) return;

  (async () => {
    let resp;
    if (p) {
      resp = await escribirEnSheet('editar_producto_reventa', {
        ID_reventa: p.ID_reventa, nombre: nombre.trim(), costo_neto: neto, unidad_compra: unidadCompra.trim().toLowerCase(), area: area.trim()
      });
    } else {
      const stockInicial = prompt(`Stock inicial de "${nombre}" (cuántas unidades tiene hoy — 0 si no aplica):`, '0');
      resp = await escribirEnSheet('crear_producto_reventa', {
        nombre: nombre.trim(), costo_neto: neto, unidad_compra: unidadCompra.trim().toLowerCase(),
        stock_actual: parseFloat(stockInicial) || 0, area: area.trim()
      });
    }
    if (resp?.ok) {
      toast(resp.msg);
      renderVistaProductosReventa();
    } else {
      toast('Error: ' + (resp?.msg || ''), 'error');
    }
  })();
}

function abrirAjusteStockReventa(id, nombre) {
  const p = (App._productosReventa || []).find(x => x.ID_reventa === id);
  const stockActual = parseFloat(p?.stock_actual) || 0;

  const nuevoValor = prompt(
    `Stock actual de "${nombre}": ${stockActual}\n\n` +
    `Escriba el nuevo conteo exacto (ej. después de recibir una compra o hacer inventario físico):`,
    stockActual
  );
  if (nuevoValor === null) return;
  const val = parseFloat(nuevoValor);
  if (isNaN(val) || val < 0) { toast('Cantidad inválida', 'error'); return; }

  (async () => {
    const resp = await escribirEnSheet('ajustar_stock_reventa', { ID_reventa: id, modo: 'fijar', cantidad: val });
    if (resp?.ok) {
      toast(`Stock de "${nombre}" actualizado a ${resp.stock_actual}`);
      if (p) p.stock_actual = resp.stock_actual;
      renderListaProductosReventa();
    } else {
      toast('Error: ' + (resp?.msg || ''), 'error');
    }
  })();
}

async function renderVistaCorreosContacto() {
  const vista = document.getElementById('vista-correos-contacto');
  vista.innerHTML = '<div class="vista-header"><h1 class="vista-titulo">Correos de contacto</h1></div><p style="color:var(--txt3)">Cargando...</p>';
  mostrarVista('correos-contacto');

  let correos = {};
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_correos_jefas' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const data = await res.json();
    correos = data.correos || {};
  } catch(e) {
    toast('No se pudieron cargar los correos actuales', 'error');
  }

  const areas = [
    { cod: 'BOL', nombre: 'Bollería' },
    { cod: 'PAN', nombre: 'Panadería' },
    { cod: 'CAF', nombre: 'Cafetería' },
    { cod: 'PAS', nombre: 'Pastelería' },
  ];

  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Correos de contacto</h1></div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:16px">
      Correo al que le llegan los avisos de aprobación/devolución de recetas y solicitudes de MP de cada área.
      Se puede cambiar acá sin tocar código. Puede escribir <strong>más de uno separados por coma</strong>
      (ej. jefa@gmail.com, encargada@gmail.com).
    </p>
    <div class="card">
      <div style="padding:16px">
        ${areas.map(a => `
          <div class="campo" style="margin-bottom:14px">
            <label>${a.nombre}</label>
            <input type="text" id="correo-${a.cod}" value="${correos[a.cod] || ''}" placeholder="correo@ejemplo.com, otro@ejemplo.com"
              style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
          </div>
        `).join('')}
        <button class="btn-primario" onclick="guardarCorreosContactoUI(this)">
          <i class="ti ti-device-floppy"></i> Guardar correos
        </button>
      </div>
    </div>
  `;
}

async function guardarCorreosContactoUI(btn) {
  const correos = {
    BOL: document.getElementById('correo-BOL')?.value.trim() || '',
    PAN: document.getElementById('correo-PAN')?.value.trim() || '',
    CAF: document.getElementById('correo-CAF')?.value.trim() || '',
    PAS: document.getElementById('correo-PAS')?.value.trim() || '',
  };

  // Validar cada dirección de cada área (pueden venir varias separadas por coma)
  const regexEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  for (const [cod, valor] of Object.entries(correos)) {
    if (!valor) continue;
    const direcciones = valor.split(',').map(d => d.trim()).filter(Boolean);
    const invalidas = direcciones.filter(d => !regexEmail.test(d));
    if (invalidas.length) {
      alert(`Correo con formato inválido en "${cod}": ${invalidas.join(', ')}\n\nRevise y vuelva a intentar.`);
      return;
    }
  }

  bloquearBtn(btn, 'Guardando...');
  try {
    await escribirEnSheet('guardar_correos_jefas', { correos });
    toast('Correos actualizados');
  } catch(e) {
    toast('Error al guardar: ' + e.message, 'error');
  }
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar correos', true);
}

async function renderVistaConfigCosteo() {
  const vista = document.getElementById('vista-config-costeo');
  if (!vista) return;
  mostrarVista('config-costeo');

  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_config_costeo' }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    _configCosteoFilas = data.filas || [];
  } catch(e) {
    _configCosteoFilas = [];
  }

  const hoy = new Date();
  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Config de costeo (Fase 2)</h1>
    </div>
    <p style="font-size:12px;color:var(--txt2);margin-bottom:20px">
      Costos fijos y remuneración por área, sincronizados desde el Registro de Gastos. Merma y utilidad objetivo se ingresan manualmente mientras se acumula historial real.
    </p>

    <div id="cc-resumen-mes"></div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-refresh"></i> Sincronizar y editar</div>
      <div class="form-grid" style="padding:16px">
        <div class="campo">
          <label>Área</label>
          <select id="cc-area" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
            ${Object.entries(FEN.AREAS).map(([cod,a]) => `<option value="${cod}">${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label>Mes (YYYY-MM)</label>
          <input type="text" id="cc-mes" value="${mesActual}" onchange="verificarVentasSincronizadasParaMes(); renderResumenVentasMes();" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div id="cc-aviso-ventas" class="campo full"></div>
        <div class="campo full">
          <button class="btn-secundario" onclick="sincronizarGastosArea()">
            <i class="ti ti-cloud-download"></i> Sincronizar desde Registro de Gastos
          </button>
          <span id="cc-sync-estado" style="font-size:12px;color:var(--txt3);margin-left:10px"></span>
        </div>
        <div class="campo">
          <label>Costos fijos del mes ($)</label>
          <input type="number" id="cc-fijos" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo">
          <label>Remuneración del mes ($)</label>
          <input type="number" id="cc-remuneracion" placeholder="0" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo">
          <label>% Merma estimado</label>
          <input type="number" id="cc-merma" placeholder="5" step="0.1" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo">
          <label>% Utilidad objetivo B2C</label>
          <input type="number" id="cc-utilidad-b2c" placeholder="30" step="0.1" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo">
          <label>% Utilidad objetivo B2B</label>
          <input type="number" id="cc-utilidad-b2b" placeholder="25" step="0.1" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo full">
          <button class="btn-primario" onclick="guardarConfigCosteoUI(this)">
            <i class="ti ti-device-floppy"></i> Guardar
          </button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Configuración guardada por área/mes</div>
      <div style="overflow-x:auto">
        ${!_configCosteoFilas.length ? `
          <p style="padding:20px;color:var(--txt3);font-size:13px;text-align:center">Aún no hay configuración guardada.</p>
        ` : `
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Área</th>
            <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Mes</th>
            <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Costos fijos</th>
            <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Remuneración</th>
            <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">% Merma</th>
            <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">% Util. B2C</th>
            <th style="text-align:right;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">% Util. B2B</th>
            <th style="text-align:left;padding:8px 14px;font-size:10px;text-transform:uppercase;color:var(--txt3)">Fuente</th>
            <th style="padding:8px 14px"></th>
          </tr></thead>
          <tbody>
            ${_configCosteoFilas.map(f => `
              <tr style="border-top:1px solid var(--border)">
                <td style="padding:8px 14px;font-size:12px;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${FEN.AREAS[f.area]?.nombre || f.area}</td>
                <td style="padding:8px 14px;font-size:12px;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${f.mes}</td>
                <td style="padding:8px 14px;font-size:12px;text-align:right;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${clp(f.costos_fijos_monto||0)}</td>
                <td style="padding:8px 14px;font-size:12px;text-align:right;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${clp(f.remuneracion_monto||0)}</td>
                <td style="padding:8px 14px;font-size:12px;text-align:right;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${f.merma_pct||0}%</td>
                <td style="padding:8px 14px;font-size:12px;text-align:right;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${f.utilidad_b2c_pct||0}%</td>
                <td style="padding:8px 14px;font-size:12px;text-align:right;cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${f.utilidad_b2b_pct||0}%</td>
                <td style="padding:8px 14px;font-size:12px;color:var(--txt3);cursor:pointer" onclick="cargarFilaConfigCosteo('${f.area}','${f.mes}')">${f.fuente||''}</td>
                <td style="padding:8px 14px;text-align:right">
                  <button class="btn-secundario" style="font-size:11px;padding:3px 8px;color:#C62828;border-color:#EF9A9A" onclick="eliminarFilaConfigCosteo(${f._fila},this)" title="Eliminar esta configuración">
                    <i class="ti ti-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        `}
      </div>
    </div>
  `;
  verificarVentasSincronizadasParaMes();
  renderResumenVentasMes();
}

async function eliminarFilaConfigCosteo(fila, btn) {
  if (!confirm('¿Eliminar esta configuración guardada? No se puede deshacer.')) return;
  bloquearBtn(btn, '');
  try {
    const resp = await escribirEnSheet('eliminar_config_costeo_fila', { fila });
    if (resp?.ok) {
      toast(resp.msg);
      renderVistaConfigCosteo();
    } else {
      toast('Error: ' + (resp?.msg || ''), 'error');
      desbloquearBtn(btn, '<i class="ti ti-trash"></i>', false);
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
    desbloquearBtn(btn, '<i class="ti ti-trash"></i>', false);
  }
}

async function renderResumenVentasMes() {
  const mes = document.getElementById('cc-mes')?.value.trim();
  const cont = document.getElementById('cc-resumen-mes');
  if (!mes || !cont) return;
  cont.innerHTML = `<p style="color:var(--txt3);font-size:12px;margin-bottom:16px">Cargando resumen de ventas...</p>`;
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_resumen_ventas_mes', mes }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const data = await res.json();
    if (!data.ok || !data.totalGeneral) {
      cont.innerHTML = `<div class="card" style="margin-bottom:16px"><p style="padding:16px;font-size:12px;color:var(--txt3)">Sin ventas sincronizadas para ${mes} todavía.</p></div>`;
      return;
    }
    const areas = Object.keys(FEN.AREAS);
    cont.innerHTML = `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head"><i class="ti ti-chart-pie"></i> Resumen de ventas — ${mes} (todas las áreas)</div>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg)">
            <th style="text-align:left;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Área</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Ventas del mes</th>
            <th style="text-align:right;padding:8px 12px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">% participación</th>
          </tr></thead>
          <tbody>
            ${areas.map(cod => {
              const monto = data.totalPorArea?.[cod] || 0;
              const pct = data.participacion?.[cod] || 0;
              return `<tr style="border-top:1px solid var(--border)">
                <td style="padding:8px 12px;font-size:13px">${FEN.AREAS[cod].nombre}</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">${clp(monto)}</td>
                <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">${(pct*100).toFixed(1)}%</td>
              </tr>`;
            }).join('')}
            <tr style="border-top:2px solid var(--border);font-weight:700">
              <td style="padding:8px 12px;font-size:13px">Total</td>
              <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">${clp(data.totalGeneral)}</td>
              <td style="padding:8px 12px;font-size:13px;text-align:right;font-family:'DM Mono',monospace">100%</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  } catch(e) {
    cont.innerHTML = '';
  }
}

async function verificarVentasSincronizadasParaMes() {
  const mes = document.getElementById('cc-mes')?.value.trim();
  const cont = document.getElementById('cc-aviso-ventas');
  if (!mes || !cont) return;
  cont.innerHTML = '';
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_ventas_mensuales' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const ventas = (await res.json()).ventas || [];
    const hayVentasDelMes = ventas.some(v => v.mes === mes);
    if (!hayVentasDelMes) {
      cont.innerHTML = `
        <div style="padding:8px 10px;background:#FFF3E0;border-radius:var(--r-sm);font-size:11px;color:#E65100">
          ⚠ No hay ventas sincronizadas para <strong>${mes}</strong> todavía — los gastos compartidos (arriendo, vehículo, gas, etc.)
          no se van a poder prorratear hasta que sincronice "Ventas mensuales (B2B/B2C)" para este mes primero.
        </div>`;
    }
  } catch(e) {}
}

async function sincronizarGastosArea() {
  const area = document.getElementById('cc-area').value;
  const mes  = document.getElementById('cc-mes').value.trim();
  const estadoEl = document.getElementById('cc-sync-estado');
  estadoEl.textContent = 'Sincronizando...';
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_gastos_area_prorrateo', mes }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (!data.ok) { estadoEl.textContent = 'Error: ' + (data.msg||''); return; }

    const areaData = data.datos?.[area] || { fijos: 0, remuneracion: 0 };
    const general = data.general || { fijos: 0, remuneracion: 0 };
    const generalPorEtiqueta = data.generalPorEtiqueta || {};
    const participacionArea = data.participacion?.[area] || 0;
    const ventasArea = data.ventasPorArea?.[area] || 0;
    const totalVentasMes = data.totalVentasMes || 0;
    const depreArea = data.depreciacionIncluida?.porArea?.[area] || 0;
    const depreGeneral = data.depreciacionIncluida?.general || 0;

    const fijosGeneralProrrateado = Math.round(general.fijos * participacionArea);
    const remuneracionGeneralProrrateado = Math.round(general.remuneracion * participacionArea);
    const depreGeneralProrrateada = Math.round(depreGeneral * participacionArea);

    // areaData.fijos ya incluye depreArea (se sumó en el backend) — lo separamos
    // solo para mostrarlo, sin alterar el total real que se guarda
    const fijosPropiosSinDepre = Math.round(areaData.fijos) - Math.round(depreArea);

    const fijosFinal = Math.round(areaData.fijos) + fijosGeneralProrrateado;
    const remuneracionFinal = Math.round(areaData.remuneracion) + remuneracionGeneralProrrateado;

    document.getElementById('cc-fijos').value = fijosFinal;
    document.getElementById('cc-remuneracion').value = remuneracionFinal;

    const sinVentasParaProrratear = (general.fijos > 0 || general.remuneracion > 0) && !totalVentasMes;
    const nombreArea = FEN.AREAS[area]?.nombre || area;

    const filaDesglose = (label, monto, nota) => `
      <tr style="border-top:1px solid var(--border)">
        <td style="padding:6px 10px;font-size:12px">${label}</td>
        <td style="padding:6px 10px;font-size:12px;text-align:right;font-family:'DM Mono',monospace">${clp(monto)}</td>
        <td style="padding:6px 10px;font-size:11px;color:var(--txt3)">${nota||''}</td>
      </tr>`;

    let html = `✓ Sincronizado (${mes})`;

    if (sinVentasParaProrratear) {
      html += `
        <div style="margin-top:8px;padding:8px 10px;background:#FFF3E0;border-radius:var(--r-sm);font-size:11px;color:#E65100">
          ⚠ Hay $${general.fijos.toLocaleString('es-CL')} en gastos compartidos para este mes, pero no hay ventas sincronizadas
          para prorratearlos — no se agregaron a este cálculo. Sincronice "Ventas mensuales" primero.
        </div>`;
    }

    const bencinaInfo = data.bencinaDescuento;
    if (bencinaInfo && bencinaInfo.bencinaTotal > 0) {
      html += `
        <div style="margin-top:8px;padding:8px 10px;background:#E8F5E9;border-radius:var(--r-sm);font-size:11px;color:#2E7D32">
          ⛽ Bencina del mes: $${Math.round(bencinaInfo.bencinaTotal).toLocaleString('es-CL')} — de eso,
          $${Math.round(bencinaInfo.descuento).toLocaleString('es-CL')} ya quedó cubierto por el despacho cobrado a clientes
          ($${Math.round(bencinaInfo.despachoTotal).toLocaleString('es-CL')} ese mes).
          Solo el resto ($${Math.round(bencinaInfo.bencinaNeta).toLocaleString('es-CL')}) se prorratea entre las áreas.
        </div>`;
    }

    html += `
      <div class="card" style="margin-top:10px">
        <div class="card-head" style="font-size:12px"><i class="ti ti-list-details"></i> Desglose completo — ${nombreArea}, ${mes}</div>
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${filaDesglose('Ventas del área este mes', ventasArea, totalVentasMes ? `${(participacionArea*100).toFixed(1)}% de $${totalVentasMes.toLocaleString('es-CL')} total` : 'sin ventas sincronizadas')}
          </tbody>
        </table>
        <div style="padding:8px 10px 2px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Costos fijos</div>
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${filaDesglose(`Propios de ${nombreArea}`, fijosPropiosSinDepre, 'Registro de Gastos, área = ' + area)}
            ${Object.entries(generalPorEtiqueta).map(([etiqueta, g]) =>
              g.fijos > 0 ? filaDesglose(
                `Compartidos — ${etiqueta}`,
                Math.round(g.fijos * participacionArea),
                `${(participacionArea*100).toFixed(1)}% de $${Math.round(g.fijos).toLocaleString('es-CL')} total`
              ) : ''
            ).join('')}
            ${depreArea > 0 ? filaDesglose('Depreciación — inversión propia', depreArea, 'directa de ' + nombreArea) : ''}
            ${depreGeneralProrrateada > 0 ? filaDesglose('Depreciación — inversiones compartidas', depreGeneralProrrateada, `${(participacionArea*100).toFixed(1)}% de $${Math.round(depreGeneral).toLocaleString('es-CL')} total`) : ''}
            <tr style="border-top:2px solid var(--border);font-weight:700">
              <td style="padding:6px 10px;font-size:12px">Total costos fijos</td>
              <td style="padding:6px 10px;font-size:12px;text-align:right;font-family:'DM Mono',monospace">${clp(fijosFinal)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <div style="padding:8px 10px 2px;font-size:10px;font-weight:700;text-transform:uppercase;color:var(--txt3)">Remuneración</div>
        <table style="width:100%;border-collapse:collapse">
          <tbody>
            ${filaDesglose(`Propia de ${nombreArea}`, areaData.remuneracion, 'Registro de Gastos, área = ' + area)}
            ${Object.entries(generalPorEtiqueta).map(([etiqueta, g]) =>
              g.remuneracion > 0 ? filaDesglose(
                `Compartida — ${etiqueta}`,
                Math.round(g.remuneracion * participacionArea),
                `${(participacionArea*100).toFixed(1)}% de $${Math.round(g.remuneracion).toLocaleString('es-CL')} total`
              ) : ''
            ).join('')}
            <tr style="border-top:2px solid var(--border);font-weight:700">
              <td style="padding:6px 10px;font-size:12px">Total remuneración</td>
              <td style="padding:6px 10px;font-size:12px;text-align:right;font-family:'DM Mono',monospace">${clp(remuneracionFinal)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>`;

    estadoEl.innerHTML = html;
  } catch(e) {
    estadoEl.textContent = 'No se pudo conectar al Registro de Gastos';
  }
}

function cargarFilaConfigCosteo(area, mes) {
  const f = _configCosteoFilas.find(x => x.area === area && x.mes === mes);
  if (!f) return;
  document.getElementById('cc-area').value = area;
  document.getElementById('cc-mes').value = mes;
  document.getElementById('cc-fijos').value = f.costos_fijos_monto || 0;
  document.getElementById('cc-remuneracion').value = f.remuneracion_monto || 0;
  document.getElementById('cc-merma').value = f.merma_pct || 0;
  document.getElementById('cc-utilidad-b2c').value = f.utilidad_b2c_pct || 0;
  document.getElementById('cc-utilidad-b2b').value = f.utilidad_b2b_pct || 0;
}

async function guardarConfigCosteoUI(btn) {
  const registro = {
    area: document.getElementById('cc-area').value,
    mes: document.getElementById('cc-mes').value.trim(),
    costos_fijos_monto: parseFloat(document.getElementById('cc-fijos').value) || 0,
    remuneracion_monto: parseFloat(document.getElementById('cc-remuneracion').value) || 0,
    merma_pct: parseFloat(document.getElementById('cc-merma').value) || 0,
    utilidad_b2c_pct: parseFloat(document.getElementById('cc-utilidad-b2c').value) || 0,
    utilidad_b2b_pct: parseFloat(document.getElementById('cc-utilidad-b2b').value) || 0,
    fuente: document.getElementById('cc-sync-estado').textContent.includes('Sincronizado') ? 'auto+manual' : 'manual'
  };
  if (!registro.mes) { toast('Ingresa el mes', 'error'); return; }
  bloquearBtn(btn, 'Guardando...');
  try {
    await escribirEnSheet('guardar_config_costeo', { registro });
    toast('Configuración guardada');
    renderVistaConfigCosteo();
  } catch(e) {
    toast('Error al guardar', 'error');
  }
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar', true);
}

async function renderVistaCostos() {
  const ec = await Cache.get('EC_productos', () => leerHoja('EC_productos'));
  const vista = document.getElementById('vista-costos');
  const hoy = new Date();
  const mesActual = App._ecMesActual || `${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,'0')}`;
  const areaActual = App._ecAreaActual || Object.keys(FEN.AREAS)[0];

  // Productos de esa área, para el selector "calcular solo 1 producto"
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  const nombreAreaCompleto = { PAN:'Panadería', BOL:'Bollería', CAF:'Cafetería', PAS:'Pastelería' }[areaActual] || areaActual;
  const productosArea = maestro
    .filter(r => r['área'] === nombreAreaCompleto && r.tipo_receta !== 'sub_receta')
    .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'', 'es'));

  // Configs guardadas para esa área/mes — si hay más de una, se deja elegir cuál usar
  let configsDisponibles = [];
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_config_costeo', area: areaActual, mes: mesActual }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    const data = await res.json();
    configsDisponibles = data.filas || [];
  } catch(e) {}
  App._ecConfigsDisponibles = configsDisponibles;

  // Agrupar EC_productos por área, para no mezclar cálculos de distintas áreas en una sola tabla
  const ecPorArea = {};
  ec.forEach(r => { (ecPorArea[r.área] = ecPorArea[r.área] || []).push(r); });

  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Estructuras de costo</h1></div>
    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-calculator"></i> Calcular (Fase 2)</div>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:16px">
        <div class="campo">
          <label>Área</label>
          <select id="ec-area" onchange="App._ecAreaActual=this.value;renderVistaCostos()" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
            ${Object.entries(FEN.AREAS).map(([cod,a]) => `<option value="${cod}" ${cod===areaActual?'selected':''}>${a.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label>Mes (YYYY-MM)</label>
          <input type="text" id="ec-mes" value="${mesActual}" onchange="App._ecMesActual=this.value;renderVistaCostos()" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
        </div>
        <div class="campo">
          <label>Producto <span style="font-weight:400;color:var(--txt3)">(opcional)</span></label>
          <select id="ec-producto" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px;min-width:200px">
            <option value="">— Todos los productos del área —</option>
            ${productosArea.map(p => `<option value="${p.ID_receta}">${p.nombre}</option>`).join('')}
          </select>
        </div>
        <div class="campo">
          <label>Prorrateo de fijos/remuneración</label>
          <select id="ec-metodo-prorrateo" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--r-sm);font-family:inherit;font-size:13px">
            <option value="unidad" ${(App._ecMetodoProrrateo||'unidad')==='unidad'?'selected':''}>Por unidad (parejo)</option>
            <option value="peso" ${App._ecMetodoProrrateo==='peso'?'selected':''}>Por peso (proporcional al tamaño)</option>
          </select>
        </div>
        ${configsDisponibles.length > 1 ? `
        <div class="campo">
          <label style="color:#E65100">⚠ Hay ${configsDisponibles.length} configs guardadas — elija cuál usar</label>
          <select id="ec-config-fila" style="padding:8px 12px;border:1px solid #FFB74D;border-radius:var(--r-sm);font-family:inherit;font-size:13px;min-width:260px">
            ${configsDisponibles.map(c => `<option value="${c._fila}">
              Fijos: ${clp(c.costos_fijos_monto)} · Merma: ${c.merma_pct||'—'}% · Util B2C: ${c.utilidad_b2c_pct||'—'}% ${c.fecha_actualizacion ? '· ' + new Date(c.fecha_actualizacion).toLocaleDateString('es-CL') : ''}
            </option>`).join('')}
          </select>
        </div>` : ''}
        <button class="btn-primario" onclick="calcularECUI(this)">
          <i class="ti ti-refresh"></i> Calcular
        </button>
        <span id="ec-calc-estado" style="font-size:12px;color:var(--txt3)"></span>
      </div>
      <p style="font-size:11px;color:var(--txt3);padding:0 16px 14px">
        Requiere que ya exista una Config de costeo guardada para esa área/mes (costos fijos, remuneración, %merma, %utilidad).
        Si elige un producto específico, igual se prorratea con el volumen del área completa — solo se calcula/guarda ese producto.
      </p>
      ${App._ecVolumenInfo && App._ecVolumenInfo.area === areaActual && App._ecVolumenInfo.mes === mesActual ? `
        <div style="margin:0 16px 14px;padding:10px 14px;background:${App._ecVolumenInfo.esReal ? '#E8F5E9' : '#FFF3E0'};border-radius:var(--r-md);font-size:12px;color:${App._ecVolumenInfo.esReal ? '#2E7D32' : '#E65100'}">
          ${App._ecVolumenInfo.esReal
            ? `📊 Último cálculo usó <strong>${App._ecVolumenInfo.volumen.toLocaleString('es-CL')} unidades/mes</strong> (volumen real, de la Estimación de demanda)`
            : `⚠ Último cálculo usó <strong>porciones_base</strong> como respaldo — no hay Estimación de demanda para esta área todavía`}
        </div>
      ` : ''}
    </div>

    ${!ec.length ? `
      <div class="empty-state">
        <i class="ti ti-chart-bar-off"></i>
        <h2>Sin datos</h2>
        <p>Calcule las estructuras de costo arriba, o espere a que se aprueben recetas.</p>
      </div>` : Object.entries(ecPorArea).map(([areaNombre, filas]) => `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head" style="display:flex;justify-content:space-between;align-items:center">
          <span><i class="ti ti-calculator"></i> ${areaNombre} <span style="font-weight:400;color:var(--txt3)">(${filas.length} producto${filas.length!==1?'s':''})</span></span>
          <button class="btn-secundario" style="font-size:11px;padding:4px 10px;color:#C62828;border-color:#EF9A9A" onclick="borrarCalculosArea('${areaNombre}',this)">
            <i class="ti ti-trash"></i> Borrar cálculos de ${areaNombre}
          </button>
        </div>
        <div style="overflow-x:auto">
        <table class="tabla-vista">
          <thead><tr>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Producto</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Vol. B2C/mes</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Vol. B2B/mes</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">MP+Insumos</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Merma</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Fijos</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Remun.</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo total</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">P. B2C</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">P. B2B</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Util. %</th>
          </tr></thead>
          <tbody>
            ${filas.map(r => `<tr>
              <td class="td-nombre">
                ${r.nombre}
                <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:4px">${r.ID_receta}</span>
              </td>
              <td class="td-num" style="color:var(--txt2)">${r.meta_B2C_mes ? parseFloat(r.meta_B2C_mes).toLocaleString('es-CL') : '—'}</td>
              <td class="td-num" style="color:var(--txt2)">${r.meta_B2B_mes ? parseFloat(r.meta_B2B_mes).toLocaleString('es-CL') : '—'}</td>
              <td class="td-num">${clp((parseFloat(r.costo_MP_unit)||0) + (parseFloat(r.costo_insumos_unit)||0))}</td>
              <td class="td-num">${clp(r.costo_merma_unit||0)}</td>
              <td class="td-num">${clp(r.costos_fijos_unit||0)}</td>
              <td class="td-num">${clp(r.remuneraciones_unit||0)}</td>
              <td class="td-num" style="font-weight:600">${clp(r.total_costo_prod||0)}</td>
              <td class="td-num">${clp(r.precio_B2C)}</td>
              <td class="td-num">${clp(r.precio_B2B)}</td>
              <td class="td-num" style="color:#2E7D32">${parseFloat(r['utilidad_mes_%']||0).toFixed(1)}%</td>
            </tr>`).join('')}
          </tbody>
        </table>
        </div>
      </div>`).join('')}
  `;
  mostrarVista('costos');
}

async function borrarCalculosArea(areaNombre, btn) {
  if (!confirm(`¿Borrar todos los cálculos de "${areaNombre}" en Estructuras de costo?\n\nEsto no afecta las recetas ni sus costos — solo borra esta tabla de precios sugeridos, se puede volver a calcular cuando quiera.`)) return;
  bloquearBtn(btn, 'Borrando...');
  try {
    const resp = await escribirEnSheet('eliminar_ec_por_area', { area: areaNombre });
    if (resp?.ok) {
      toast(resp.msg);
      Cache.invalidar('EC_productos');
      renderVistaCostos();
    } else {
      toast('Error: ' + (resp?.msg || ''), 'error');
      desbloquearBtn(btn, '<i class="ti ti-trash"></i> Borrar cálculos de ' + areaNombre, false);
    }
  } catch(e) {
    toast('Error: ' + e.message, 'error');
    desbloquearBtn(btn, '<i class="ti ti-trash"></i> Borrar cálculos de ' + areaNombre, false);
  }
}

// Calcula el volumen mensual REAL de un área (suma B2C + B2B de todos los productos,
// proyectado a los días reales del mes) usando la Estimación de demanda ya construida.
// Devuelve null si el área no tiene estimación (ej. Pastelería aún no la tiene) —
// en ese caso calcularEC cae de vuelta al criterio anterior (porciones_base).
//
// Igual que calcularVolumenMensualArea, pero devuelve el detalle por producto
// (B2C y B2B por separado). Los nombres en ESTIMACION_POR_AREA ya fueron
// renombrados para coincidir exactamente con el nombre vigente de cada receta
// en el Maestro — ya no hace falta traducir vía Mapeo_productos (eliminado).
// Volumen mensual estimado por producto — ahora se calcula desde ventas REALES
// (Ventas_mensuales_consolidadas), no desde el snapshot histórico fijo de antes.
// Esto resuelve productos que no existían cuando se tomó ese snapshot (ej.
// Croissant XL) sin tener que acordarse de agregarlos a mano cada vez — cualquier
// producto nuevo que tenga ventas sincronizadas ese mes aparece solo.
async function calcularVolumenMensualPorProducto(areaCodigo, mesStr) {
  const areaNombre = FEN.AREAS[areaCodigo]?.nombre || areaCodigo;
  const normalizar = s => (s||'').toString().trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // saca tildes para comparar
  const areaNombreNorm = normalizar(areaNombre);

  let ventas = [];
  try {
    const payload = encodeURIComponent(JSON.stringify({ accion: 'leer_ventas_mensuales' }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { cache: 'no-store' });
    ventas = (await res.json()).ventas || [];
  } catch(e) {
    return {};
  }

  // Resolver ID_receta -> nombre desde Maestro_recetas — es la MISMA fuente que
  // usa el backend (calcularEC lee directo de esa hoja), y no App.recetas (que
  // carga desde la hoja de trabajo de cada área — PAN_recetas, BOL_recetas, etc. —
  // la cual puede desalinearse de Maestro_recetas si una receta se reeditó).
  // Usar dos fuentes distintas para lo mismo es lo que causaba que Panadería
  // diera todo en cero: el nombre nunca calzaba con lo que busca el backend.
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  const nombrePorId = {};
  maestro.forEach(r => { nombrePorId[r.ID_receta] = r.nombre; });

  const resultado = {};
  ventas
    .filter(v => v.mes === mesStr && normalizar(v['área'] || v.área) === areaNombreNorm)
    .forEach(v => {
      const nombre = nombrePorId[v.ID_receta] || v.ID_receta; // si no se encuentra, se deja el ID como respaldo visible
      if (!resultado[nombre]) resultado[nombre] = { b2c: 0, b2b: 0 };
      const canal = v.canal === 'B2B' ? 'b2b' : 'b2c';
      resultado[nombre][canal] += parseFloat(v.cantidad_vendida) || 0;
    });

  Object.keys(resultado).forEach(k => {
    resultado[k].b2c = Math.round(resultado[k].b2c);
    resultado[k].b2b = Math.round(resultado[k].b2b);
  });
  return resultado;
}

// Volumen mensual total del área — ahora suma desde ventas reales (reutiliza
// calcularVolumenMensualPorProducto en vez de un segundo cálculo aparte, para no
// duplicar la lectura del snapshot fijo que ya no se usa).
async function calcularVolumenMensualArea(areaCodigo, mesStr) {
  const porProducto = await calcularVolumenMensualPorProducto(areaCodigo, mesStr);
  let total = 0;
  Object.values(porProducto).forEach(v => { total += (v.b2c||0) + (v.b2b||0); });
  return total > 0 ? Math.round(total) : null;
}

async function calcularECUI(btn) {
  const area = document.getElementById('ec-area').value;
  const mes = document.getElementById('ec-mes').value.trim();
  const idRecetaUnico = document.getElementById('ec-producto')?.value || '';
  const filaConfigEl = document.getElementById('ec-config-fila');
  const filaConfig = filaConfigEl ? filaConfigEl.value : '';
  const metodoProrrateo = document.getElementById('ec-metodo-prorrateo')?.value || 'unidad';
  App._ecAreaActual = area;
  App._ecMesActual = mes;
  App._ecMetodoProrrateo = metodoProrrateo;
  const estadoEl = document.getElementById('ec-calc-estado');
  bloquearBtn(btn, 'Calculando...');
  try {
    const volumenReal = await calcularVolumenMensualArea(area, mes);
    const volumenPorProducto = await calcularVolumenMensualPorProducto(area, mes);
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'calcular_ec', area, mes, volumenTotalReal: volumenReal, volumenPorProducto, metodoProrrateo,
      ID_receta: idRecetaUnico || undefined,
      filaConfig: filaConfig || undefined
    }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (data.ok) {
      App._ecVolumenInfo = { area, mes, volumen: volumenReal, esReal: !!volumenReal, msg: data.msg };
      Cache.invalidar('EC_productos');
      desbloquearBtn(btn, '<i class="ti ti-refresh"></i> Calcular', true);
      renderVistaCostos();
      return;
    } else {
      estadoEl.textContent = 'Error: ' + (data.msg||'');
    }
  } catch(e) {
    estadoEl.textContent = 'No se pudo calcular: ' + e.message;
  }
  desbloquearBtn(btn, '<i class="ti ti-refresh"></i> Calcular', true);
}

// ── ADMIN: MAESTRO ────────────────────────────────────────────
// Reconstruye el detalle de costeo de una receta (ingredientes + insumos + costos) tal
// como se ve en Aprobaciones — usado en el modal de Maestro de recetas para no perder
// la trazabilidad de costos una vez que la receta ya fue aprobada.
// Traduce el valor guardado de tipo_preparacion a un texto legible
// Formatea una cantidad en "unidades" mostrando decimales solo si los tiene —
// evita que fracciones como 0.083 (1 de cada 12) se vean como "0" y confundan.
// Muestra un costo en pesos — si es mayor a $0 pero muy chico (ej. $0,03), muestra
// decimales en vez de redondear a "$0" (que podría confundirse con "sin costo").
function formatearCostoDecimal(valor) {
  const n = parseFloat(valor) || 0;
  if (n === 0) return '$0';
  // Coma para decimales (nunca punto, que en Chile es separador de miles — "$7.096" se
  // leería como "siete mil noventa y seis", no como "siete coma cero noventa y seis")
  if (Math.abs(n) < 1) return '$' + n.toFixed(2).replace('.', ',');
  return '$' + Math.round(n).toLocaleString('es-CL');
}

function formatearUnidadesIngrediente(valor) {
  const n = parseFloat(valor) || 0;
  if (Number.isInteger(n)) return n.toFixed(0);
  return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
}

// r._area solo se llena cuando Admin carga TODAS las áreas de una vez — si Admin
// entró vía "Ir a área" (navegando dentro de una sola área), ese campo queda vacío
// y un template literal lo convierte en el texto "undefined". Este helper usa el
// nombre de área del Sheet (siempre presente) como respaldo confiable.
function codigoAreaDesdeReceta(r) {
  if (r._area) return r._area;
  const entrada = Object.entries(FEN.AREAS).find(([cod, info]) => info.nombre === r.área);
  if (entrada) return entrada[0];
  return App.areaCodigo || '';
}

function formatearClasificacionBOL(valor) {
  const mapa = {
    producto_simple: 'Producto Simple',
    producto_compuesto: 'Producto Compuesto',
    masa_base: 'Masa Base',
    relleno: 'Relleno / preparación',
  };
  return mapa[valor] || '⚠️ Sin clasificar';
}

// Muestra un costo en pesos, pero si redondea a $0 y en realidad no es cero,
// muestra el decimal — para no confundir "cuesta casi nada" con "no se calculó".
function formatearCostoDetalle(valor) {
  const n = parseFloat(valor) || 0;
  if (n === 0) return '$0';
  if (Math.round(n) === 0) return '$' + n.toFixed(3);
  return clp(n);
}

function construirDetalleCosteoRecetaHTML(r) {
  let ingredientes = [], insumos = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
  try { insumos = JSON.parse(r.insumos_JSON || '[]'); } catch(e) {}
  const esPan = r._area === 'PAN' || r.área === 'Panadería';
  const esBol = r._area === 'BOL' || r.área === 'Bollería';

  return `
    <div style="display:flex;gap:16px;font-size:13px;color:var(--txt2);margin-bottom:12px;flex-wrap:wrap">
      <span><strong>Rendimiento:</strong> ${formatearRendimiento(r)}</span>
      <span><strong>Ingredientes:</strong> ${ingredientes.length}</span>
      <span><strong>Versión:</strong> ${r.versión_actual || r.versión || 1}</span>
      ${r.peso_harina_total_g ? `<span><strong>Harina base:</strong> ${r.peso_harina_total_g}g</span>` : ''}
      ${esBol ? `<span><strong>Clasificación:</strong> ${formatearClasificacionBOL(r.tipo_preparacion)}</span>` : ''}
    </div>
    ${ingredientes.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Ingrediente</th>
        <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Cantidad</th>
        ${esPan ? `<th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">% pan.</th>` : ''}
        <th style="text-align:right;padding:6px 10px;background:var(--bg);border-bottom:1px solid var(--border);color:var(--txt3);font-weight:600;text-transform:uppercase;letter-spacing:.3px">Costo</th>
      </tr></thead>
      <tbody>
        ${ingredientes.map(ing => {
          const unidadRec = ing.unidad_receta || (ing.unidades !== undefined && ing.unidades !== null ? 'unidades' : 'gramos');
          const displayVal = unidadRec === 'unidades'
            ? `${formatearUnidadesIngrediente(ing.unidades||ing.gramos||0)} uni <span style="color:var(--txt3);font-weight:400;font-size:10px">(≈${parseFloat(ing.gramos||0).toFixed(0)}g)</span>`
            : unidadRec === 'ml'
            ? `${parseFloat(ing.ml||ing.gramos||0).toFixed(1)} ml`
            : `${parseFloat(ing.gramos||0).toFixed(1)}g`;
          return `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--txt);font-weight:500">
              ${ing.nombre}
              <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:6px">${ing.id||''}</span>
            </td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:600">${displayVal}</td>
            ${esPan ? `<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:#E65100">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2);font-size:11px">${formatearCostoDecimal(ing.costo)}</td>
          </tr>`;
        }).join('')}
        <tr style="background:var(--bg);font-weight:600">
          <td style="padding:6px 10px">Total ingredientes</td>
          <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace">
            ${ingredientes.some(i=>i.unidades!=null)
              ? ingredientes.filter(i=>i.unidades==null).reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(1)+'g + sub recetas en uni'
              : ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(1)+'g'}
          </td>
          ${esPan ? '<td></td>' : ''}
          <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">
            ${formatearCostoDecimal(ingredientes.reduce((s,i)=>s+(parseFloat(i.costo)||0),0))}
          </td>
        </tr>
      </tbody>
    </table>` : ''}
    ${insumos.length ? `
    <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px">
      <thead><tr>
        <th style="text-align:left;padding:6px 10px;background:#FFF3E0;border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">📦 Insumo</th>
        <th style="text-align:right;padding:6px 10px;background:#FFF3E0;border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Cantidad</th>
        <th style="text-align:right;padding:6px 10px;background:#FFF3E0;border-bottom:1px solid var(--border);color:#E65100;font-weight:600;text-transform:uppercase;letter-spacing:.3px">Costo</th>
      </tr></thead>
      <tbody>
        ${insumos.map(ins => `
          <tr>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--txt);font-weight:500">
              ${ins.nombre}
              <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:6px">${ins.id||''}</span>
            </td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:600">${parseFloat(ins.unidades||0).toFixed(0)} uni</td>
            <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2);font-size:11px">${formatearCostoDecimal(ins.costo)}</td>
          </tr>`).join('')}
        <tr style="background:#FFF3E0;font-weight:600">
          <td style="padding:6px 10px" colspan="2">Total insumos</td>
          <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace;font-size:11px">
            ${formatearCostoDecimal(insumos.reduce((s,i)=>s+(parseFloat(i.costo)||0),0))}
          </td>
        </tr>
      </tbody>
    </table>
    <div style="text-align:right;font-size:13px;font-weight:700;margin-bottom:12px;padding:6px 10px">
      Costo directo total (MP + insumos): ${formatearCostoDecimal(ingredientes.reduce((s,i)=>s+(parseFloat(i.costo)||0),0) + insumos.reduce((s,i)=>s+(parseFloat(i.costo)||0),0))}
    </div>` : ''}
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
  `;
}

async function renderVistaMaestroAdmin() {
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  App._maestroRecetasCache = maestro; // para que el modal pueda encontrar la fila por ID
  const vista = document.getElementById('vista-maestro-admin');
  const areaFiltro = App._filtroMaestroArea || 'todas';

  const filaHtml = r => {
    const esBol = r.área === 'Bollería';
    return `<tr style="cursor:pointer" onclick="abrirModalCosteoReceta('${r.ID_receta}')">
      <td class="td-nombre">
        ${r.nombre}
        <span style="font-size:10px;color:var(--txt3);font-family:'DM Mono',monospace;margin-left:6px">${r.ID_receta}</span>
        ${esBol ? `<span style="font-size:10px;color:${r.tipo_preparacion?'var(--txt3)':'#C62828'};margin-left:6px">· ${formatearClasificacionBOL(r.tipo_preparacion)}</span>` : ''}
      </td>
      <td class="td-num">${formatearRendimiento(r)}</td>
      <td class="td-num">v${r.versión_actual||1}</td>
      <td style="text-align:right;padding:6px 16px">
        <button class="btn-peligro" style="font-size:12px;padding:4px 10px"
          onclick="event.stopPropagation();confirmarEliminarReceta('${r.ID_receta}','${r.nombre}','${r.área}')">
          <i class="ti ti-trash"></i>
        </button>
      </td>
    </tr>`;
  };

  const tablaGrupo = (titulo, icono, lista) => !lista.length ? '' : `
    <div class="card" style="margin-bottom:14px">
      <div class="card-head"><i class="ti ${icono}"></i> ${titulo} (${lista.length})</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Nombre</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Rendimiento</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Versión</th>
          <th style="padding:9px 16px;background:var(--bg);border-bottom:1px solid var(--border)"></th>
        </tr></thead>
        <tbody>${lista.map(filaHtml).join('')}</tbody>
      </table>
    </div>`;

  const areasPresentes = [...new Set(maestro.map(r => r.área))].sort();
  const areasAMostrar = areaFiltro === 'todas' ? areasPresentes : areasPresentes.filter(a => a === areaFiltro);

  const bloqueArea = area => {
    const deArea = maestro.filter(r => r.área === area);
    const recetasNormales = deArea.filter(r => r.tipo_receta !== 'sub_receta');
    const subRecetas = deArea.filter(r => r.tipo_receta === 'sub_receta');
    return `
      <div style="margin-bottom:24px">
        <h2 style="font-size:16px;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--border)">${area} <span style="font-size:12px;color:var(--txt3);font-weight:400">(${deArea.length})</span></h2>
        ${tablaGrupo('Recetas', 'ti-clipboard-list', recetasNormales)}
        ${tablaGrupo('Sub recetas', 'ti-arrows-loop-2', subRecetas)}
      </div>`;
  };

  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Maestro de recetas</h1></div>
    <p style="font-size:11px;color:var(--txt3);margin-bottom:12px"><i class="ti ti-info-circle"></i> Haga clic en cualquier fila para ver su costeo completo, tal como se vio en Aprobaciones.</p>
    <div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap">
      <button class="${areaFiltro==='todas'?'btn-primario':'btn-secundario'}" style="font-size:12px;padding:6px 14px"
        onclick="App._filtroMaestroArea='todas';renderVistaMaestroAdmin()">Todas las áreas</button>
      ${areasPresentes.map(a => `
        <button class="${areaFiltro===a?'btn-primario':'btn-secundario'}" style="font-size:12px;padding:6px 14px"
          onclick="App._filtroMaestroArea='${a}';renderVistaMaestroAdmin()">${a}</button>
      `).join('')}
    </div>
    ${!maestro.length ? `
      <div class="empty-state">
        <i class="ti ti-book-off"></i>
        <h2>Sin recetas consolidadas</h2>
      </div>` : areasAMostrar.map(bloqueArea).join('')}
  `;
  mostrarVista('maestro-admin');
}

function abrirModalCosteoReceta(recetaId) {
  const r = (App._maestroRecetasCache || []).find(x => x.ID_receta === recetaId);
  if (!r) return;
  const esSubReceta = r.tipo_receta === 'sub_receta';
  document.getElementById('ver-receta-modal-contenido').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <span style="font-size:11px;padding:2px 8px;border-radius:99px;font-weight:600;
        background:${esSubReceta?'#EDE9FE':'#E8F5E9'};color:${esSubReceta?'#5B21B6':'#166534'}">
        ${esSubReceta?'⟳ Sub receta':'Receta'}
      </span>
      <span style="font-size:12px;color:var(--txt3)">${r.área}</span>
      <span style="font-size:11px;color:var(--txt3);font-family:'DM Mono',monospace">${r.ID_receta}</span>
    </div>
    <h2 style="margin-bottom:8px">${r.nombre}</h2>
    ${construirDetalleCosteoRecetaHTML(r)}
  `;
  document.getElementById('modal-ver-receta').classList.remove('hidden');
}

// ── MP: SOLICITAR Y EDITAR ────────────────────────────────────
// ── BUSCADOR DE MP EXISTENTE (evita duplicados por MP no habilitada en el área) ──
let _buscarMPContexto = null; // referencia al <select> que abrió el buscador, o null si es standalone
let _buscarMPTipo = 'ingrediente'; // 'ingrediente' o 'insumo' — determina qué fallback de creación usar

function _normTexto(s) {
  return (s || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function abrirBuscarMP(selectEl, tipo) {
  _buscarMPContexto = selectEl || null;
  _buscarMPTipo = tipo || 'ingrediente';
  const input = document.getElementById('buscar-mp-input');
  const resultados = document.getElementById('buscar-mp-resultados');
  const fallback = document.getElementById('buscar-mp-fallback');
  if (input) input.value = '';
  if (resultados) resultados.innerHTML = '<p style="font-size:12px;color:var(--txt3);text-align:center;padding:20px 0">Escriba para buscar...</p>';
  if (fallback) fallback.innerHTML = '';
  document.getElementById('modal-buscar-mp')?.classList.remove('hidden');
  setTimeout(() => input?.focus(), 50);
}

function cerrarModalBuscarMP() {
  document.getElementById('modal-buscar-mp')?.classList.add('hidden');
  _buscarMPContexto = null;
}

function filtrarResultadosBuscarMP() {
  const q = _normTexto(document.getElementById('buscar-mp-input')?.value);
  const resultados = document.getElementById('buscar-mp-resultados');
  const fallback = document.getElementById('buscar-mp-fallback');
  if (!resultados) return;

  if (q.length < 2) {
    resultados.innerHTML = '<p style="font-size:12px;color:var(--txt3);text-align:center;padding:20px 0">Escriba al menos 2 letras...</p>';
    fallback.innerHTML = '';
    return;
  }

  const areaActual = App.areaCodigo || '';
  const coincidencias = App.materiasPrimas.filter(m =>
    _normTexto(m.nombre).includes(q) && m.estado !== 'inactiva'
  );

  if (!coincidencias.length) {
    resultados.innerHTML = '<p style="font-size:12px;color:var(--txt3);text-align:center;padding:20px 0">No se encontró nada con ese nombre.</p>';
  } else {
    resultados.innerHTML = coincidencias.map(m => {
      // Reemplazada: ya no se usa, fue fusionada con otra MP — no ofrecer habilitarla.
      // Se muestra chica y discreta (no compite con los resultados accionables), pero
      // no se oculta del todo: si alguien la busca por su nombre viejo, necesita ver
      // hacia dónde migró para no terminar creando el duplicado de nuevo.
      if (m.estado === 'reemplazada') {
        const vigente = App.materiasPrimas.find(x => x.ID_MP === m.reemplazada_por);
        return `
          <div style="padding:6px 12px;border-left:2px solid #FFCC80;margin-bottom:6px">
            <span style="font-size:11px;color:var(--txt3);text-decoration:line-through">${m.nombre}</span>
            <span style="font-size:11px;color:#E65100"> → reemplazada por "${vigente?.nombre || 'otra MP'}", búsquela por ese nombre</span>
          </div>`;
      }

      // Pendiente/recibida: todavía no fue aprobada por Admin, no hay nada que habilitar aún.
      if (m.estado === 'pendiente' || m.estado === 'recibida') {
        return `
          <div style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:8px;background:var(--bg)">
            <div style="font-weight:600;font-size:13px">${m.nombre}</div>
            <p style="font-size:11px;color:#1565C0;margin:4px 0 0">
              <i class="ti ti-clock-pause"></i> Ya fue solicitada y está esperando que Admin la revise —
              todavía no se puede habilitar para otra área.
            </p>
          </div>`;
      }

      // Activa: caso normal — ofrecer habilitación si falta, o avisar que ya está disponible
      const areas = (m.areas_habilitadas || '').split(',').map(a=>a.trim()).filter(Boolean);
      const yaHabilitada = !m.areas_habilitadas || areas.includes(areaActual);
      const areasLabel = areas.length ? areas.join(', ') : 'todas las áreas';
      return `
        <div style="padding:10px 12px;border:1px solid var(--border);border-radius:var(--r-sm);margin-bottom:8px">
          <div style="font-weight:600;font-size:13px">${m.nombre}</div>
          <div style="font-size:11px;color:var(--txt3);margin:2px 0 8px">Habilitada hoy para: ${areasLabel}</div>
          ${yaHabilitada
            ? `<p style="font-size:11px;color:#2E7D32;margin:0"><i class="ti ti-check"></i> Ya está disponible para su área — selecciónela desde el desplegable normal.</p>`
            : `<button class="btn-primario" style="font-size:12px;padding:5px 12px" onclick="solicitarHabilitacionDesdeModal('${m.ID_MP}','${(m.nombre||'').replace(/'/g,"\\'")}')">
                 Solicitar habilitación para mi área
               </button>`}
        </div>`;
    }).join('');
  }

  // Fallback de "crear nueva" — solo tiene sentido si venimos del contexto de una receta
  if (_buscarMPContexto) {
    fallback.innerHTML = `
      <p style="font-size:12px;color:var(--txt3);margin-bottom:8px">¿Ninguna de estas es lo que busca?</p>
      <button class="btn-secundario" style="width:100%" onclick="pasarACrearMPNueva()">
        <i class="ti ti-plus"></i> Crear como materia prima nueva
      </button>`;
  } else {
    fallback.innerHTML = '';
  }
}

function pasarACrearMPNueva() {
  const selectEl = _buscarMPContexto;
  const tipo = _buscarMPTipo;
  cerrarModalBuscarMP();
  if (tipo === 'insumo') solicitarNuevoInsumo();
  else solicitarNuevaMP(selectEl);
}

async function solicitarHabilitacionDesdeModal(mpId, mpNombre) {
  const areaActual = App.areaCodigo || '';
  const selectEl = _buscarMPContexto;
  const tipo = _buscarMPTipo;
  cerrarModalBuscarMP();

  const resp = await escribirEnSheet('solicitar_habilitacion_mp', {
    mp_id: mpId, mp_nombre: mpNombre, area_codigo: areaActual
  });

  if (!resp?.ok) { toast('No se pudo enviar la solicitud', 'error'); return; }
  toast(`Solicitud enviada — "${mpNombre}" quedará disponible apenas Admin la habilite`);

  // Si venía de un ingrediente/insumo de receta, agrega la fila ya mismo con el ID
  // y costo reales (la MP ya existe, solo falta habilitar el área) — usa el mismo
  // patrón de <select disabled> que ya usa el sistema para MP pendientes, así el
  // guardado la detecta igual. Queda bloqueado el envío a revisión hasta que se
  // resuelva — se detecta solo, sin pasos extra de la jefa.
  if (selectEl) {
    const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
    const costoPorGramo = mp?.costo_por_gramo || 0;
    const tr = selectEl.closest('tr');
    if (tr) {
      const tbody = tr.parentElement;
      const nuevaTr = document.createElement('tr');
      nuevaTr.style.background = '#FFF9C4';
      const inputCantidad = tr.querySelector('input[type="number"]');
      const cantidadPrevia = inputCantidad?.value || '';
      if (tipo === 'insumo') {
        nuevaTr.innerHTML = `
          <td><select disabled style="color:#F57C00;font-weight:500" data-mp-id="${mpId}" data-costo="${costoPorGramo}">
            <option>⏳ ${mpNombre} (esperando habilitación)</option>
          </select></td>
          <td><input type="number" placeholder="1" value="${cantidadPrevia}" min="0" step="1" data-unidad="unidades"></td>
          <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
        `;
      } else {
        nuevaTr.innerHTML = `
          <td style="min-width:200px">
            <select disabled style="color:#F57C00;font-weight:500" data-mp-id="${mpId}" data-costo="${costoPorGramo}">
              <option>⏳ ${mpNombre} (esperando habilitación)</option>
            </select>
          </td>
          <td><input type="number" placeholder="0" value="${cantidadPrevia}" min="0" step="0.01" data-unidad="gramos"></td>
          ${App.areaCodigo === 'PAN' ? '<td><input type="number" placeholder="0.00" readonly style="color:var(--txt3)"></td>' : ''}
          <td><button class="btn-fila-del" onclick="this.closest('tr').remove()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
        `;
      }
      tbody.insertBefore(nuevaTr, tr);
      tr.remove();
    }
  }
}

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
  const tipoMP    = document.getElementById('solicitar-mp-tipo')?.value || 'mp';
  const esNueva   = true; // Admin decides if it's new or existing
  const tmpNombre = document.getElementById('solicitar-mp-tmp').value.trim() || nombre;
  const cantidad  = document.getElementById('solicitar-mp-gramos').value;
  const unidad    = document.getElementById('solicitar-mp-unidad')?.value || 'gramos';

  if (!nombre) { toast('Escribe el nombre de la MP', 'error'); return; }

  // Enviar solicitud al Sheet via GET para obtener el ID generado
  const areaNombre = App.area?.nombre || (App.areaCodigo ? FEN.AREAS[App.areaCodigo]?.nombre : '') || '';
  let mpId = '__pendiente__';
  try {
    const recetaNombre = document.getElementById('f-nombre')?.value?.trim() || 'Receta sin nombre';
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'solicitar_mp',
      tipo: tipoMP,
      nombre,
      es_nueva: esNueva,
      solicitada_por: areaNombre,
      area_codigo: App.areaCodigo || '',
      categoría: tipoMP === 'insumo' ? 'Insumos' : 'Pendiente de clasificar',
      unidad_receta: unidad,
      receta_nombre: recetaNombre,
      fecha: new Date().toISOString()
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
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

async function fusionarMPUI(mpIdEliminar, nombreActual) {
  // Buscar candidatos: cualquier MP con nombre parecido (activa o inactiva), excluyendo la actual y las ya reemplazadas
  const candidatos = App.materiasPrimas.filter(m =>
    m.ID_MP !== mpIdEliminar && m.estado !== 'reemplazada' &&
    m.nombre.toLowerCase().includes(nombreActual.toLowerCase().split(' ')[0])
  );

  let listaTexto = candidatos.length
    ? candidatos.map(c => `${c.ID_MP} — ${c.nombre} (${c.estado}${c.categoría ? ', '+c.categoría : ''})`).join('\n')
    : '(no se encontraron MP con nombre parecido — puede escribir el ID igual si lo conoce)';

  const idMantener = prompt(
    `Fusionar "${nombreActual}" (${mpIdEliminar}) con otra MP existente.\n\n` +
    `Escriba el ID de la MP que se debe MANTENER (la duplicada quedará marcada como reemplazada):\n\n${listaTexto}`,
    candidatos[0]?.ID_MP || ''
  );
  if (!idMantener) return;

  const mantener = App.materiasPrimas.find(m => m.ID_MP === idMantener.trim());
  if (!mantener) { toast('ID no encontrado', 'error'); return; }
  if (mantener.ID_MP === mpIdEliminar) { toast('No puede fusionar una MP consigo misma', 'error'); return; }

  if (!confirm(
    `¿Confirma fusionar?\n\n"${nombreActual}" (${mpIdEliminar}) quedará reemplazada por\n"${mantener.nombre}" (${mantener.ID_MP})\n\n` +
    `Se buscará y corregirá en TODAS las recetas de las 4 áreas. Las recetas afectadas van a necesitar volver a guardarse y aprobarse para que el costo se recalcule.`
  )) return;

  toast('Fusionando, puede tardar unos segundos...');
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'fusionar_mp', mp_id_mantener: mantener.ID_MP, mp_id_eliminar: mpIdEliminar
    }));
    const res = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (data.ok) {
      Cache.invalidar('mp_maestro');
      await cargarMP();
      const detalle = data.recetas && data.recetas.length ? '\n\nRecetas a re-aprobar:\n' + data.recetas.join('\n') : '';
      alert('✓ ' + data.msg + detalle);
      renderVistaMP();
    } else {
      toast('Error: ' + (data.msg||''), 'error');
    }
  } catch(e) {
    toast('No se pudo fusionar: ' + e.message, 'error');
  }
}

async function editarImpuestosMP(mpId) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;

  const ivaActual = ((parseFloat(mp['IVA_%']) || 0.19) * 100).toFixed(0);
  const nuevoIva = prompt(
    `IVA de "${mp.nombre}"\nActual: ${ivaActual}%\n\nNuevo IVA (%) — use 0 si está exento:`,
    ivaActual
  );
  if (nuevoIva === null) return;
  const ivaPct = parseFloat(nuevoIva);
  if (isNaN(ivaPct)) { toast('IVA inválido', 'error'); return; }

  const impActual = ((parseFloat(mp['imp_adicional_%']) || 0) * 100).toFixed(0);
  const nuevoImp = prompt(
    `Impuesto adicional de "${mp.nombre}"\nActual: ${impActual}%\n\nNuevo impuesto adicional (%) — ej: 12 para harina de trigo, 0 si no aplica:`,
    impActual
  );
  if (nuevoImp === null) return;
  const impPct = parseFloat(nuevoImp);
  if (isNaN(impPct)) { toast('Impuesto adicional inválido', 'error'); return; }

  const resp = await escribirEnSheet('editar_mp', {
    ID_MP: mpId,
    costo_neto: mp.costo_neto || 0,
    iva_pct: ivaPct / 100,
    imp_adicional_pct: impPct / 100
  });

  mp['IVA_%'] = ivaPct / 100;
  mp['imp_adicional_%'] = impPct / 100;
  const bruto = (parseFloat(mp.costo_neto) || 0) * (1 + ivaPct/100 + impPct/100);
  const parsed = parsearUnidadCompraJS((mp.unidad_compra || 'kg').toLowerCase());
  mp.costo_por_gramo = bruto / (parsed ? parsed.factorBase : 1000);
  mp.costo_por_kg = bruto;

  toast('Impuestos actualizados');
  if (resp?.recetasActualizadas?.length) {
    alert(
      `Se recalculó el costo automáticamente en ${resp.recetasActualizadas.length} receta(s) que usan "${mp.nombre}":\n\n` +
      resp.recetasActualizadas.join('\n') +
      `\n\nQuedaron pendientes de aprobación — van a aparecerle en Aprobaciones.`
    );
  }
  Cache.invalidar('mp_maestro');
  await cargarMP();
  renderVistaMP();
}

async function editarMP(mpId) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;

  const unidadActual = (mp.unidad_compra || 'kg').toLowerCase();
  const nuevaUnidadInput = prompt(
    `Antes de ingresar el precio, confirme la unidad de compra de "${mp.nombre}"\n` +
    `(así el costo por gramo/unidad se calcula correcto de inmediato).\n\n` +
    `Ejemplos: kg, 25kg, un, 180un, 500ml\n\nUnidad de compra actual:`,
    unidadActual
  );
  if (nuevaUnidadInput === null) return;
  const unidadCompra = nuevaUnidadInput.trim().toLowerCase();
  const parsed = parsearUnidadCompraJS(unidadCompra);
  if (!parsed) { toast('Formato de unidad de compra inválido — ej: kg, 25kg, un, 180un, 500ml', 'error'); return; }

  let etiquetaUnidad;
  if (unidadCompra === 'kg') etiquetaUnidad = 'por kilo';
  else if (unidadCompra === 'lt' || unidadCompra === 'l') etiquetaUnidad = 'por litro';
  else if (unidadCompra === 'un' || unidadCompra === 'unidad' || unidadCompra === 'unidades') etiquetaUnidad = 'por unidad';
  else etiquetaUnidad = `del paquete completo (${unidadCompra})`;
  const nuevoPrecio = prompt(
    `Precio neto ${etiquetaUnidad} de "${mp.nombre}" (solo el producto, sin flete)\nActual: ${clp(mp.costo_neto)}\n\nNuevo precio neto ${etiquetaUnidad}:`,
    mp.costo_neto
  );
  if (nuevoPrecio === null) return;
  const precio = parseFloat(nuevoPrecio);
  if (isNaN(precio)) { toast('Precio inválido', 'error'); return; }

  const flete = prompt(
    `¿Costo de transporte/flete ${etiquetaUnidad} de "${mp.nombre}"?\n(Si la compra a otra región, ingrese el flete prorrateado. Deje 0 o vacío si no aplica.)`,
    '0'
  );
  if (flete === null) return;
  const fletePct = parseFloat(flete) || 0;
  if (isNaN(fletePct) || fletePct < 0) { toast('Flete inválido', 'error'); return; }

  const precioFinal = precio + fletePct;
  const payload = { ID_MP: mpId, costo_neto: precioFinal, unidad_compra: unidadCompra };

  if (fletePct > 0) {
    const obsActual = mp.observaciones || '';
    const notaFlete = `[Precio $${precio} + flete $${fletePct}/${unidadCompra === 'un' ? 'u' : unidadCompra}]`;
    // Reemplaza una nota de flete anterior si existe, para no ir acumulando notas viejas
    const obsSinNotaVieja = obsActual.replace(/\[Precio \$[\d.]+ \+ flete \$[\d.]+\/\w+\]/, '').trim();
    payload.observaciones = (obsSinNotaVieja + ' ' + notaFlete).trim();
  }

  escribirEnSheet('editar_mp', payload).then(resp => {
    if (resp?.recetasActualizadas?.length) {
      alert(
        `✓ Precio actualizado.\n\n` +
        `Se recalculó el costo automáticamente en ${resp.recetasActualizadas.length} receta(s) que usan "${mp.nombre}":\n\n` +
        resp.recetasActualizadas.join('\n') +
        `\n\nQuedaron pendientes de aprobación — van a aparecerle en Aprobaciones.`
      );
    }
  });
  mp.costo_neto = precioFinal;
  mp.unidad_compra = unidadCompra;
  if (payload.observaciones !== undefined) mp.observaciones = payload.observaciones;
  toast(fletePct > 0 ? `Precio actualizado: $${precio} + flete $${fletePct} = ${clp(precioFinal)}` : 'Precio actualizado');
  Cache.invalidar('mp_maestro');
  await cargarMP();
  renderVistaMP();
}

function abrirFormNuevaMP() {
  const modal = document.getElementById('modal-crear-mp-admin');
  if (modal) {
    document.getElementById('crear-mp-tipo').value = 'mp';
    document.getElementById('crear-mp-nombre').value = '';
    document.getElementById('crear-mp-categoria').value = '';
    document.getElementById('crear-mp-unidad-compra').value = 'kg';
    document.getElementById('crear-mp-costo').value = '';
    document.getElementById('crear-mp-activa').checked = true;
    document.querySelectorAll('.chk-area-crear-mp').forEach(c => c.checked = false);
    modal.classList.remove('hidden');
  }
}

function cerrarModalCrearMPAdmin() {
  const modal = document.getElementById('modal-crear-mp-admin');
  if (modal) modal.classList.add('hidden');
}

async function crearMPAdmin(btn) {
  const nombre        = document.getElementById('crear-mp-nombre').value.trim();
  const tipo           = document.getElementById('crear-mp-tipo').value;
  const categoria      = document.getElementById('crear-mp-categoria').value.trim();
  const unidadCompra   = document.getElementById('crear-mp-unidad-compra').value;
  const costoNeto      = parseFloat(document.getElementById('crear-mp-costo').value) || 0;
  const activa         = document.getElementById('crear-mp-activa').checked;
  const areasMarcadas  = Array.from(document.querySelectorAll('.chk-area-crear-mp:checked')).map(c => c.value);
  const areasHabilitadas = areasMarcadas.join(',');

  if (!nombre) { toast('Escribe el nombre', 'error'); return; }

  if (btn) bloquearBtn(btn, 'Creando...');

  let nuevoId = null;
  try {
    const payload = encodeURIComponent(JSON.stringify({
      accion: 'solicitar_mp',
      origen: 'admin',
      tipo,
      nombre,
      categoría: categoria || (tipo === 'insumo' ? 'Insumos' : 'Sin categoría'),
      unidad_compra: unidadCompra,
      costo_neto: costoNeto,
      estado_directo: activa ? 'activa' : 'inactiva',
      areas_habilitadas: areasHabilitadas,
      area_codigo: areasHabilitadas,
      fecha: new Date().toISOString()
    }));
    const res  = await fetch(FEN.WEBAPP_URL + '?payload=' + payload, { redirect: 'follow', cache: 'no-store' });
    const data = await res.json();
    if (data.ok && data.id) nuevoId = data.id;
  } catch(e) {
    console.warn('[fën] No se pudo crear MP/Insumo:', e.message);
  }

  if (btn) desbloquearBtn(btn, '<i class="ti ti-plus"></i> Crear', true);

  if (!nuevoId) { toast('No se pudo crear — revisa la conexión', 'error'); return; }

  const bruto = costoNeto * 1.19;
  const parsedNueva = parsearUnidadCompraJS(unidadCompra);
  App.materiasPrimas.push({
    ID_MP: nuevoId, nombre, tipo, categoría: categoria || (tipo === 'insumo' ? 'Insumos' : 'Sin categoría'),
    estado: activa ? 'activa' : 'inactiva', costo_neto: costoNeto, costo_bruto: bruto,
    costo_por_kg: bruto, costo_por_gramo: bruto / (parsedNueva ? parsedNueva.factorBase : 1000),
    unidad_compra: unidadCompra, areas_habilitadas: areasHabilitadas
  });
  Cache.invalidar('mp_maestro');
  await cargarMP();
  cerrarModalCrearMPAdmin();
  toast(`"${nombre}" creada`);
  renderVistaMP();
}

async function gestionarAreasMP(mpId) {
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
  // Antes: contaba recetas existentes y sumaba 1 — colisionaba si alguna vez se
  // eliminó una receta, o si el listado cargado no reflejaba el 100% del Sheet
  // (recetas y sub-recetas comparten el mismo contador). Ahora es imposible de
  // colisionar: timestamp (único al milisegundo) + 3 caracteres aleatorios.
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${areaCodigo}${timestamp}${random}`;
}

// n=0 → semana actual, n=1 → semana pasada, n=4 → hace 4 semanas, etc.
function obtenerSemanaHace(n) {
  const now = new Date();
  now.setDate(now.getDate() - 7*n);
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return { id: `${d.getFullYear()}-W${String(weekNo).padStart(2,'0')}`, fechaRef: new Date(now) };
}

// Convierte { id: "2026-W32", fechaRef } en algo legible: "W32-ago-2026"
function formatearEtiquetaSemana(s) {
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const [anio, wPart] = s.id.split('-W');
  return `W${wPart}-${meses[s.fechaRef.getMonth()]}-${anio}`;
}

function obtenerSemanaAnterior() {
  return obtenerSemanaHace(1).id;
}

function obtenerSemanaActual() {
  return obtenerSemanaHace(0).id;
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
