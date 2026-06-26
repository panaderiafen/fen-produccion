// ═══════════════════════════════════════════════
//  fën — App principal v1.1
//  Grupo 1: Visual / Grupo 2: Plan semanal
// ═══════════════════════════════════════════════

// ── ESTADO GLOBAL ────────────────────────────────────────────
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
  admin.onclick = () => entrar(null, 'admin');
  grid.appendChild(admin);
}

async function entrar(areaCodigo, rol) {
  App.rol = rol;
  App.areaCodigo = areaCodigo;
  App.area = areaCodigo ? FEN.AREAS[areaCodigo] : null;

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
  await cargarRecetas(true); // forzar recarga completa
  await cargarPlanSemana();
  ocultarLoading();
  verificarAlertas();

  if (rol === 'admin') navegarA('aprobaciones');
  else navegarA('mis-recetas');
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
    // Panadería tiene secciones extra
    if (App.areaCodigo === 'PAN' || App.areaCodigo === 'BOL') {
      items.push({ id: 'resumen-semanal',     icon: 'ti-chart-grid-dots', label: 'Resumen semanal' });
      items.push({ id: 'config-subrecetas',   icon: 'ti-adjustments',     label: 'Config sub recetas' });
    }
    items.forEach(item => nav.appendChild(crearNavItem(item)));
  } else {
    [
      { id: 'aprobaciones',   icon: 'ti-check-circle', label: 'Aprobaciones'         },
      { id: 'materias-primas',icon: 'ti-list',          label: 'Materias primas'     },
      { id: 'maestro-admin',  icon: 'ti-book',          label: 'Maestro de recetas'  },
      { id: 'costos',         icon: 'ti-chart-bar',     label: 'Estructuras de costo'},
    ].forEach(item => nav.appendChild(crearNavItem(item)));
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
    case 'mis-recetas':     renderVistaMisRecetas(); break;
    case 'planificacion':   renderVistaPlanificacion(); break;
    case 'recetas-del-dia': renderVistaRecetasDelDia(); break;
    case 'maestro':         renderVistaMaestro(); break;
    case 'aprobaciones':    renderVistaAprobaciones(); break;
    case 'materias-primas': renderVistaMP(); break;
    case 'maestro-admin':   renderVistaMaestroAdmin(); break;
    case 'costos':              renderVistaCostos(); break;
    case 'config-subrecetas':   renderVistaConfigSubrecetas(); break;
    case 'resumen-semanal':     renderVistaResumenSemanal(); break;
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
    if (forzar || App.recetas.length === 0) {
      // Primera carga o recarga forzada — reemplazar todo
      App.recetas = datos;
    } else {
      // Actualización — solo agregar filas nuevas, no sobreescribir las existentes
      // para no perder estados locales actualizados
      datos.forEach(recetaSheet => {
        const idx = App.recetas.findIndex(r => r.ID_receta === recetaSheet.ID_receta);
        if (idx === -1) {
          // Receta nueva que no existía localmente
          App.recetas.push(recetaSheet);
        }
        // Si ya existe, NO sobreescribir — el estado local es más reciente
      });
    }
  }
}

async function cargarPlanSemana() {
  if (!App.areaCodigo || !FEN.AREAS[App.areaCodigo].hoja_plan) return;
  const semana  = obtenerSemanaActual();
  const claveLS = `fen_plan_${App.areaCodigo}_${semana}`;

  // Fuente principal: Sheet (compartido entre todos los dispositivos)
  try {
    const hoja     = FEN.AREAS[App.areaCodigo].hoja_plan;
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
              <th>Gramos</th>
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
  const mpActivas   = App.materiasPrimas.filter(m => m.estado === 'activa' && m.tipo !== 'sub_receta');
  const subRecetas  = App.materiasPrimas.filter(m => m.estado === 'activa' && m.tipo === 'sub_receta');

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

  tr.innerHTML = `
    <td>
      <select onchange="calcularCostoFila(this)">
        <option value="">— Seleccionar —</option>
        ${options}
        <option value="__nueva__">+ Solicitar nueva MP</option>
      </select>
    </td>
    <td><input type="number" placeholder="0" value="${data.gramos ? parseFloat(data.gramos).toFixed(1) : ''}"
      min="0" step="0.01" oninput="desdeGramos(this)" style="max-width:90px"></td>
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
      ingredientes.push({
        id:     select.value,
        nombre: opcion.text,
        gramos,
        pct:    App.areaCodigo === 'PAN' ? ((parseFloat(inputs[1]?.value) || 0) / 100) : 0,
        costo:  costoPorGramo * gramos,
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

    // Actualizar estado local solo si Sheet confirmó
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

  // Actualizar estado local ANTES de enviar al Sheet
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
  const recetas = App.recetas;
  const vista = document.getElementById('vista-mis-recetas');
  const enPrueba = recetas.filter(r => r.estado === 'en_prueba');

  vista.innerHTML = `
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
                  ${esConsolidada ? '<span style="font-size:10px;color:#2E7D32;margin-left:6px"><i class="ti ti-lock"></i> En maestro</span>' : ''}
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

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val azul">${r.porciones_base}</div>
        <div class="stat-lbl">Unidades / rendimiento</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${ingredientes.length}</div>
        <div class="stat-lbl">Ingredientes</div>
      </div>
      ${esPan && r.peso_harina_total_g ? `
      <div class="stat-card">
        <div class="stat-val">${parseFloat(r.peso_harina_total_g).toFixed(0)}g</div>
        <div class="stat-lbl">Harina base</div>
      </div>` : '<div class="stat-card"><div class="stat-val">—</div><div class="stat-lbl">—</div></div>'}
      <div class="stat-card">
        <div class="stat-val">${r.versión || 1}</div>
        <div class="stat-lbl">Versión</div>
      </div>
    </div>

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

// ── PLANIFICACIÓN SEMANAL ─────────────────────────────────────
function renderVistaPlanificacion() {
  const recetasConsolidadas = App.recetas.filter(r => r.estado === 'consolidada');
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
            ${recetasConsolidadas.map(r => {
              const cantidades = App.planSemana[r.ID_receta] || Array(7).fill(0);
              return `<tr>
                <td class="td-nombre">${r.nombre}</td>
                ${dias.map((_,i) => `
                  <td class="${i===diaIdx?'dia-hoy':''}">
                    <input type="number" min="0" placeholder="0"
                      data-receta="${r.ID_receta}" data-dia="${i}"
                      oninput="actualizarTotalFila(this)"
                      value="${cantidades[i] || ''}">
                  </td>`).join('')}
                <td class="td-total" id="total-${r.ID_receta}">
                  ${cantidades.reduce((s,c)=>s+c,0)}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`}
  `;
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

function renderDia(diaIdx) {
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
  const htmlElaboraciones = (typeof renderElaboracionesPrevias === 'function')
    ? renderElaboracionesPrevias(idx)
    : '';

  const htmlRecetas = recetasHoy.map(({ receta: r, unidades }) => {
    let ingredientes = [];
    try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
    const porciones = parseInt(r.porciones_base) || 1;
    const factor    = unidades / porciones;
    const rid       = r.ID_receta;
    const procedimiento = r.observaciones_procedimiento || '';

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
          <span class="rdc-badge">${unidades} unidad${unidades>1?'es':''}</span>
          <i class="ti ti-chevron-down rdc-chevron" id="chev-${rid}"></i>
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
                return `<tr>
                  <td class="td-nombre">${ing.nombre}</td>
                  <td class="td-num" style="font-size:14px;font-weight:600">${gr.toFixed(0)}g</td>
                  ${esPan ? `<td class="td-pct">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
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
            ${mios.map(r => `<tr>
              <td class="td-nombre">${r.nombre}</td>
              <td class="td-num">${r.porciones_base} unid.</td>
              <td class="td-num">v${r.versión_actual||1}</td>
            </tr>`).join('')}
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
                  ${ingredientes.map(ing => `
                    <tr>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);color:var(--txt);font-weight:500">${ing.nombre}</td>
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;font-weight:600">${parseFloat(ing.gramos||0).toFixed(1)}g</td>
                      ${r._area === 'PAN' || r.área === 'Panadería' ? `<td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:#E65100">${((parseFloat(ing.pct)||0)*100).toFixed(1)}%</td>` : ''}
                      <td style="padding:6px 10px;border-bottom:1px solid var(--border);text-align:right;font-family:'DM Mono',monospace;color:var(--txt2);font-size:11px">$${parseFloat(ing.costo||0).toFixed(0)}</td>
                    </tr>`).join('')}
                  <tr style="background:var(--bg);font-weight:600">
                    <td style="padding:6px 10px">Total ingredientes</td>
                    <td style="padding:6px 10px;text-align:right;font-family:'DM Mono',monospace">
                      ${ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(1)}g
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

// ── ADMIN: MATERIAS PRIMAS ────────────────────────────────────
function renderVistaMP() {
  const mp = App.materiasPrimas;
  const pendientes = mp.filter(m => m.estado === 'pendiente');
  const vista = document.getElementById('vista-mp');
  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Materias primas</h1>
      <button class="btn-primario" onclick="abrirFormNuevaMP()">
        <i class="ti ti-plus"></i> Nueva MP
      </button>
    </div>
    ${pendientes.length ? `
      <div class="alerta-prueba" style="background:#E3F2FD;border-color:#90CAF9;color:#0D47A1">
        <i class="ti ti-bell" style="color:#1565C0"></i>
        <span><strong>${pendientes.length} solicitud${pendientes.length>1?'es':''} pendiente${pendientes.length>1?'s':''}</strong> de nuevas materias primas.</span>
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
                <br><span style="font-size:11px;color:var(--txt3);font-weight:400">${m.ID_MP}</span>
              </td>
              <td style="font-size:13px;color:var(--txt2)">${m.categoría||'—'}</td>
              <td class="td-num">${clp(m.costo_neto)}</td>
              <td class="td-num" style="font-size:11px">${parseFloat(m.costo_por_gramo||0).toFixed(4)}</td>
              <td style="text-align:center">
                <span class="estado-badge" style="color:${est.c};background:${est.bg}">${est.l}</span>
              </td>
              <td style="text-align:right;padding:6px 12px">
                <button class="btn-secundario" style="font-size:12px;padding:4px 10px"
                  onclick="editarMP('${m.ID_MP}')"><i class="ti ti-edit"></i></button>
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
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Rendimiento</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Versión</th>
        </tr></thead>
        <tbody>
          ${maestro.map(r => `<tr>
            <td class="td-nombre">${r.nombre}</td>
            <td style="font-size:13px;color:var(--txt2)">${r.área}</td>
            <td class="td-num">${r.porciones_base} unid.</td>
            <td class="td-num">v${r.versión_actual||1}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
  mostrarVista('maestro-admin');
}

// ── MP: SOLICITAR Y EDITAR ────────────────────────────────────
function solicitarNuevaMP() {
  const nombre = prompt('Nombre de la nueva materia prima:');
  if (!nombre) return;
  escribirEnSheet('solicitar_mp', {
    nombre, solicitada_por: App.area?.nombre || 'Admin', fecha: new Date().toISOString()
  });
  toast('Solicitud enviada a administración');
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

// ── UTILIDADES ────────────────────────────────────────────────
function generarId(areaCodigo) {
  const existing = App.recetas.filter(r => r.ID_receta?.startsWith(areaCodigo));
  return `${areaCodigo}${String(existing.length + 1).padStart(3,'0')}`;
}

function obtenerSemanaActual() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week  = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2,'0')}`;
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
