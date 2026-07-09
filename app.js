// ═══════════════════════════════════════════════
//  fën — App principal
// ═══════════════════════════════════════════════

// ── ESTADO GLOBAL ────────────────────────────────────────────
const App = {
  rol: null,
  area: null,
  areaCodigo: null,
  vistaActual: null,
  recetaActivaId: null,
  materiasPrimas: [],
  recetas: [],
  planSemana: [],
};

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

  // Admin card
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

  // Aplicar colores del área
  const color = App.area?.color || '#003a79';
  const bg    = App.area?.bg    || '#e8eef5';
  document.documentElement.style.setProperty('--area-color', color);
  document.documentElement.style.setProperty('--area-bg', bg);

  // Topbar
  document.getElementById('topbar-nombre').textContent = App.area?.nombre || 'Administración';
  document.getElementById('topbar-icon').className = `ti ${App.area?.icon || 'ti-shield-check'}`;
  document.getElementById('topbar-usuario-txt').textContent = rol === 'admin' ? 'Administrador' : `Jefa de ${App.area?.nombre}`;
  document.getElementById('topbar-avatar-txt').textContent = rol === 'admin' ? 'AD' : areaCodigo;

  // Sidebar según rol
  renderSidebar();

  // Cargar datos iniciales
  mostrarLoading('Cargando datos...');
  await cargarMP();
  await cargarRecetas();
  ocultarLoading();

  // Verificar alertas (recetas en prueba)
  verificarAlertas();

  // Vista inicial
  if (rol === 'admin') {
    navegarA('aprobaciones');
  } else {
    navegarA('nueva-receta');
  }
}

function salir() {
  App.rol = null;
  App.area = null;
  App.areaCodigo = null;
  App.recetas = [];
  App.planSemana = [];
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
}

// ── SIDEBAR ───────────────────────────────────────────────────
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = '';

  if (App.rol === 'jefa') {
    const items = [
      { id: 'nueva-receta',    icon: 'ti-plus',          label: 'Nueva receta'       },
      { id: 'mis-recetas',     icon: 'ti-clipboard-list', label: 'Mis recetas'        },
      { id: 'planificacion',   icon: 'ti-calendar-week', label: 'Planificación'       },
      { id: 'recetas-del-dia', icon: 'ti-chef-hat',      label: 'Recetas del día'    },
      { id: 'maestro',         icon: 'ti-book',          label: 'Maestro de recetas' },
    ];
    if (App.areaCodigo === 'CAF') {
      items.splice(2, 2); // Café no tiene planificación ni recetas del día
    }
    items.forEach(item => nav.appendChild(crearNavItem(item)));
  } else {
    const items = [
      { id: 'aprobaciones',  icon: 'ti-check-circle', label: 'Aprobaciones'      },
      { id: 'materias-primas', icon: 'ti-list',        label: 'Materias primas'   },
      { id: 'maestro-admin', icon: 'ti-book',          label: 'Maestro de recetas'},
      { id: 'costos',        icon: 'ti-chart-bar',     label: 'Estructuras de costo'},
    ];
    items.forEach(item => nav.appendChild(crearNavItem(item)));
  }
}

function crearNavItem({ id, icon, label, badge }) {
  const btn = document.createElement('button');
  btn.className = 'nav-item';
  btn.dataset.vista = id;
  btn.innerHTML = `<i class="ti ${icon}"></i> ${label}${badge ? `<span class="badge-pendiente">${badge}</span>` : ''}`;
  btn.onclick = () => navegarA(id);
  return btn;
}

function actualizarNavActivo(vistaId) {
  document.querySelectorAll('.nav-item').forEach(b => {
    b.classList.toggle('active', b.dataset.vista === vistaId);
  });
}

// ── NAVEGACIÓN ────────────────────────────────────────────────
function navegarA(vistaId) {
  App.vistaActual = vistaId;
  actualizarNavActivo(vistaId);

  document.querySelectorAll('.vista').forEach(v => v.classList.remove('active'));

  switch(vistaId) {
    case 'nueva-receta':    renderVistaFormReceta(null); break;
    case 'mis-recetas':     renderVistaMisRecetas(); break;
    case 'planificacion':   renderVistaPlanificacion(); break;
    case 'recetas-del-dia': renderVistaRecetasDelDia(); break;
    case 'maestro':         renderVistaMaestro(); break;
    case 'aprobaciones':    renderVistaAprobaciones(); break;
    case 'materias-primas': renderVistaMP(); break;
    case 'maestro-admin':   renderVistaMaestroAdmin(); break;
    case 'costos':          renderVistaCostos(); break;
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

async function cargarRecetas() {
  if (!App.areaCodigo) {
    // Admin carga todas
    const todas = [];
    for (const codigo of Object.keys(FEN.AREAS)) {
      const h = FEN.AREAS[codigo].hoja_recetas;
      const r = await leerHoja(h);
      r.forEach(rec => rec._area = codigo);
      todas.push(...r);
    }
    App.recetas = todas;
  } else {
    const hoja = FEN.AREAS[App.areaCodigo].hoja_recetas;
    App.recetas = await Cache.get(hoja, () => leerHoja(hoja));
  }
}

// ── ALERTAS ───────────────────────────────────────────────────
function verificarAlertas() {
  const enPrueba = App.recetas.filter(r => r.estado === 'en_prueba' || r.estado === 'pendiente_aprobación');
  const alerta = document.getElementById('topbar-alerta');
  if (enPrueba.length > 0 && App.rol === 'jefa') {
    alerta.classList.remove('hidden');
    alerta.querySelector('span').textContent = `${enPrueba.length} receta${enPrueba.length > 1 ? 's' : ''} pendiente${enPrueba.length > 1 ? 's' : ''}`;
  } else {
    alerta.classList.add('hidden');
  }
}

// ── FORMULARIO NUEVA / EDITAR RECETA ─────────────────────────
function renderVistaFormReceta(recetaId) {
  const receta = recetaId ? App.recetas.find(r => r.ID_receta === recetaId) : null;
  const esPan = App.areaCodigo === 'PAN';
  const esEdicion = !!receta;

  let ingredientes = [];
  let pasos = [];

  if (receta) {
    try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) { ingredientes = []; }
    try { pasos = JSON.parse(receta.pasos_JSON || '[]'); }
    catch(e) { pasos = (receta.observaciones_procedimiento || '').split('.'). filter(s => s.trim()); }
  }

  const vista = document.getElementById('vista-form-receta');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${esEdicion ? 'Editar receta' : 'Nueva receta'}</div>
        <h1 class="vista-titulo">${esEdicion ? receta.nombre : 'Crear receta'}</h1>
      </div>
    </div>

    ${esEdicion && (receta.estado === 'en_prueba') ? `
      <div class="alerta-prueba">
        <i class="ti ti-flask"></i>
        <span>Esta receta está <strong>en prueba</strong>. Una vez que estés conforme, envíala a revisión de administración para consolidarla en el maestro.</span>
      </div>
    ` : ''}

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-info-circle"></i> Datos generales</div>
      <div class="form-grid">
        <div class="campo">
          <label>Nombre de la receta <span class="req">*</span></label>
          <input type="text" id="f-nombre" placeholder="Ej: Pan de centeno" value="${receta?.nombre || ''}">
        </div>
        <div class="campo">
          <label>Estado</label>
          <select id="f-estado">
            <option value="borrador"  ${(!receta || receta.estado==='borrador') ? 'selected':''}>Borrador</option>
            <option value="en_prueba" ${receta?.estado==='en_prueba' ? 'selected':''}>En prueba</option>
          </select>
        </div>
        <div class="campo">
          <label>Porciones / rendimiento <span class="req">*</span></label>
          <input type="number" id="f-porciones" placeholder="Ej: 12" min="1" value="${receta?.porciones_base || ''}">
        </div>
        ${esPan ? `
        <div class="campo">
          <label>Peso total de harina (g) <span class="req">*</span></label>
          <input type="number" id="f-harina" placeholder="Ej: 500" min="0" value="${receta?.peso_harina_total_g || ''}">
        </div>
        ` : '<div class="campo"><label>Área</label><input type="text" readonly value="'+FEN.AREAS[App.areaCodigo].nombre+'"></div>'}
        <div class="campo full">
          <label>Descripción / observaciones</label>
          <textarea id="f-desc" rows="2" placeholder="Descripción breve de la receta, origen, características...">${receta?.observaciones_procedimiento || ''}</textarea>
        </div>
        <div class="campo full">
          <label>Notas de sistematización</label>
          <textarea id="f-notas" rows="2" placeholder="Notas del proceso de prueba y ajustes realizados...">${receta?.sistematización_notas || ''}</textarea>
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
              ${esPan ? '<th>% panadero</th>' : ''}
              <th>Costo calc.</th>
              <th></th>
            </tr>
          </thead>
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
          </button>
        ` : ''}
      </div>
      <div class="form-acciones-der">
        <button class="btn-secundario" onclick="navegarA('mis-recetas')">Cancelar</button>
        <button class="btn-primario" onclick="guardarReceta('${recetaId || ''}')">
          <i class="ti ti-device-floppy"></i> ${esEdicion ? 'Guardar cambios' : 'Crear receta'}
        </button>
      </div>
    </div>
  `;

  // Llenar ingredientes
  if (ingredientes.length > 0) {
    ingredientes.forEach(ing => agregarIngrediente(ing));
  } else {
    agregarIngrediente(); agregarIngrediente(); agregarIngrediente();
  }

  // Llenar pasos
  if (pasos.length > 0) {
    pasos.forEach(p => agregarPaso(typeof p === 'string' ? p : p.texto || ''));
  } else {
    agregarPaso(); agregarPaso();
  }

  mostrarVista('form-receta');
}

// ── INGREDIENTES ──────────────────────────────────────────────
function agregarIngrediente(data = {}) {
  const esPan = App.areaCodigo === 'PAN';
  const tbody = document.getElementById('tbody-ingr');
  const tr = document.createElement('tr');

  // Opciones de MP
  const mpActivas = App.materiasPrimas.filter(m => m.estado === 'activa');
  const options = mpActivas.map(m =>
    `<option value="${m.ID_MP}" data-costo="${m.costo_por_gramo}" ${m.ID_MP === data.id ? 'selected' : ''}>${m.nombre}</option>`
  ).join('');

  tr.innerHTML = `
    <td>
      <select onchange="calcularCostoFila(this)">
        <option value="">— Seleccionar —</option>
        ${options}
        <option value="__nueva__">+ Solicitar nueva MP</option>
      </select>
    </td>
    <td><input type="number" placeholder="0" value="${data.gramos || ''}" min="0" step="0.01" oninput="calcularCostoFila(this)"></td>
    ${esPan ? `<td><input type="number" placeholder="0.00" value="${data.pct ? (data.pct*100).toFixed(2) : ''}" step="0.01" style="max-width:70px" readonly tabindex="-1" style="color:var(--txt3)"></td>` : ''}
    <td><span class="td-num" style="font-family:'DM Mono',monospace;font-size:12px;color:var(--txt3)">$${data.costo ? data.costo.toFixed(2) : '0.00'}</span></td>
    <td><button class="btn-fila-del" onclick="this.closest('tr').remove();actualizarPctPanadero()" aria-label="Eliminar"><i class="ti ti-x"></i></button></td>
  `;
  tbody.appendChild(tr);
}

function calcularCostoFila(el) {
  const tr = el.closest('tr');
  const select = tr.querySelector('select');
  const inputGr = tr.querySelectorAll('input[type="number"]')[0];
  const spanCosto = tr.querySelector('.td-num');

  const opcion = select.options[select.selectedIndex];
  if (opcion.value === '__nueva__') {
    solicitarNuevaMP();
    select.value = '';
    return;
  }

  const costoPorGramo = parseFloat(opcion.dataset.costo) || 0;
  const gramos = parseFloat(inputGr?.value) || 0;
  const costo = costoPorGramo * gramos;
  if (spanCosto) spanCosto.textContent = '$' + costo.toFixed(2);

  if (App.areaCodigo === 'PAN') actualizarPctPanadero();
}

function actualizarPctPanadero() {
  const pesoHarina = parseFloat(document.getElementById('f-harina')?.value) || 0;
  if (!pesoHarina) return;
  const filas = document.querySelectorAll('#tbody-ingr tr');
  filas.forEach(tr => {
    const inputs = tr.querySelectorAll('input[type="number"]');
    if (inputs.length >= 2) {
      const gramos = parseFloat(inputs[0].value) || 0;
      const pct = pesoHarina > 0 ? (gramos / pesoHarina * 100) : 0;
      inputs[1].value = pct.toFixed(2);
    }
  });
}

// ── PASOS ─────────────────────────────────────────────────────
function agregarPaso(texto = '') {
  const contenedor = document.getElementById('contenedor-pasos');
  const idx = contenedor.children.length + 1;
  const div = document.createElement('div');
  div.className = 'paso-fila';
  div.innerHTML = `
    <div class="paso-num">${idx}</div>
    <textarea placeholder="Describe este paso..." rows="2">${texto}</textarea>
    <button class="btn-fila-del" onclick="this.closest('.paso-fila').remove();renumerarPasos()" aria-label="Eliminar paso">
      <i class="ti ti-x"></i>
    </button>
  `;
  contenedor.appendChild(div);
}

function renumerarPasos() {
  document.querySelectorAll('.paso-num').forEach((el, i) => el.textContent = i + 1);
}

// ── GUARDAR RECETA ────────────────────────────────────────────
async function guardarReceta(recetaId) {
  const nombre = document.getElementById('f-nombre').value.trim();
  const porciones = document.getElementById('f-porciones').value;
  if (!nombre) { toast('El nombre es requerido', 'error'); return; }
  if (!porciones) { toast('Las porciones son requeridas', 'error'); return; }

  const ingredientes = [];
  document.querySelectorAll('#tbody-ingr tr').forEach(tr => {
    const select = tr.querySelector('select');
    const inputs = tr.querySelectorAll('input[type="number"]');
    const spanCosto = tr.querySelector('.td-num');
    if (select?.value && select.value !== '__nueva__') {
      const opcion = select.options[select.selectedIndex];
      ingredientes.push({
        id:     select.value,
        nombre: opcion.text,
        gramos: parseFloat(inputs[0]?.value) || 0,
        pct:    App.areaCodigo === 'PAN' ? (parseFloat(inputs[1]?.value) || 0) / 100 : 0,
        costo:  parseFloat(spanCosto?.textContent?.replace('$','')) || 0,
      });
    }
  });

  const pasos = [];
  document.querySelectorAll('#contenedor-pasos textarea').forEach(ta => {
    if (ta.value.trim()) pasos.push(ta.value.trim());
  });

  const datos = {
    ID_receta:                    recetaId || generarId(App.areaCodigo),
    nombre,
    estado:                       document.getElementById('f-estado').value,
    área:                         App.area.nombre,
    porciones_base:               parseInt(porciones),
    peso_harina_total_g:          App.areaCodigo === 'PAN' ? (document.getElementById('f-harina')?.value || '') : '',
    ingredientes_JSON:            JSON.stringify(ingredientes),
    observaciones_procedimiento:  document.getElementById('f-desc').value.trim(),
    sistematización_notas:        document.getElementById('f-notas').value.trim(),
    versión:                      recetaId ? ((App.recetas.find(r=>r.ID_receta===recetaId)?.versión || 1) + 1) : 1,
    hoja:                         App.area.hoja_recetas,
    esEdicion:                    !!recetaId,
  };

  // Guardar en Sheet
  const resultado = await escribirEnSheet('guardar_receta', datos);

  // Actualizar local
  if (recetaId) {
    const idx = App.recetas.findIndex(r => r.ID_receta === recetaId);
    if (idx >= 0) App.recetas[idx] = { ...App.recetas[idx], ...datos };
  } else {
    App.recetas.push(datos);
  }

  Cache.invalidar(App.area.hoja_recetas);
  verificarAlertas();
  toast(recetaId ? 'Receta actualizada' : 'Receta creada');
  navegarA('mis-recetas');
}

// ── ENVIAR A REVISIÓN ─────────────────────────────────────────
async function enviarARevision(recetaId) {
  const receta = App.recetas.find(r => r.ID_receta === recetaId);
  if (!receta) return;
  await escribirEnSheet('cambiar_estado', { ID_receta: recetaId, estado: 'pendiente_aprobación', hoja: App.area.hoja_recetas });
  receta.estado = 'pendiente_aprobación';
  verificarAlertas();
  toast('Receta enviada a revisión de administración');
  navegarA('mis-recetas');
}

// ── VISTA MIS RECETAS ─────────────────────────────────────────
function renderVistaMisRecetas() {
  const recetas = App.recetas;
  const vista = document.getElementById('vista-mis-recetas');

  if (!recetas.length) {
    vista.innerHTML = `
      <div class="vista-header">
        <h1 class="vista-titulo">Mis recetas</h1>
        <button class="btn-primario" onclick="navegarA('nueva-receta')"><i class="ti ti-plus"></i> Nueva receta</button>
      </div>
      <div class="empty-state">
        <i class="ti ti-clipboard-list"></i>
        <h2>Sin recetas aún</h2>
        <p>Crea tu primera receta para empezar</p>
        <button class="btn-primario" onclick="navegarA('nueva-receta')"><i class="ti ti-plus"></i> Crear receta</button>
      </div>
    `;
  } else {
    const enPrueba = recetas.filter(r => r.estado === 'en_prueba');
    vista.innerHTML = `
      <div class="vista-header">
        <div>
          <div class="vista-eyebrow">${App.area.nombre}</div>
          <h1 class="vista-titulo">Mis recetas</h1>
        </div>
        <button class="btn-primario" onclick="navegarA('nueva-receta')"><i class="ti ti-plus"></i> Nueva receta</button>
      </div>

      ${enPrueba.length ? `
        <div class="alerta-prueba">
          <i class="ti ti-flask"></i>
          <span>Tienes <strong>${enPrueba.length} receta${enPrueba.length>1?'s':''} en prueba</strong>. Revísalas y envíalas a administración cuando estén listas.</span>
        </div>
      ` : ''}

      <div class="card">
        <div class="card-head"><i class="ti ti-clipboard-list"></i> Todas las recetas (${recetas.length})</div>
        <table class="tabla-vista">
          <thead>
            <tr>
              <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Receta</th>
              <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Estado</th>
              <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${recetas.map(r => {
              const est = FEN.ESTADOS[r.estado] || FEN.ESTADOS.borrador;
              return `
                <tr>
                  <td class="td-nombre">${r.nombre || r.ID_receta}</td>
                  <td style="text-align:center">
                    <span class="estado-badge" style="color:${est.color};background:${est.bg}">${est.label}</span>
                  </td>
                  <td style="text-align:right">
                    <button class="btn-secundario" style="font-size:12px;padding:5px 12px" onclick="verReceta('${r.ID_receta}')">
                      <i class="ti ti-eye"></i> Ver
                    </button>
                    <button class="btn-secundario" style="font-size:12px;padding:5px 12px;margin-left:6px" onclick="renderVistaFormReceta('${r.ID_receta}');mostrarVista('form-receta')">
                      <i class="ti ti-edit"></i> Editar
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }
  mostrarVista('mis-recetas');
}

// ── VER RECETA ────────────────────────────────────────────────
function verReceta(recetaId) {
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (!r) return;

  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
  const costoMP = ingredientes.reduce((s, i) => s + (parseFloat(i.costo) || 0), 0);

  const est = FEN.ESTADOS[r.estado] || FEN.ESTADOS.borrador;
  const esPan = App.areaCodigo === 'PAN';

  const vista = document.getElementById('vista-ver-receta');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span class="estado-badge" style="color:${est.color};background:${est.bg}">
            <span class="ri-estado estado-${r.estado.replace('_aprobación','_aprobacion')}" style="width:7px;height:7px;border-radius:50%;display:inline-block;margin-right:4px"></span>
            ${est.label}
          </span>
        </div>
        <h1 class="vista-titulo">${r.nombre}</h1>
        <div class="meta-chips">
          <span class="chip"><i class="ti ti-users"></i>${r.porciones_base} porciones</span>
          ${esPan && r.peso_harina_total_g ? `<span class="chip"><i class="ti ti-weight"></i>${r.peso_harina_total_g}g harina base</span>` : ''}
          <span class="chip"><i class="ti ti-calendar"></i>v${r.versión || 1}</span>
        </div>
      </div>
      <div class="vista-acciones">
        <button class="btn-secundario" onclick="renderVistaFormReceta('${recetaId}');mostrarVista('form-receta')">
          <i class="ti ti-edit"></i> Editar
        </button>
        ${r.estado === 'en_prueba' ? `
          <button class="btn-primario" onclick="enviarARevision('${recetaId}')">
            <i class="ti ti-send"></i> Enviar a revisión
          </button>
        ` : ''}
      </div>
    </div>

    ${r.observaciones_procedimiento ? `
      <div style="background:var(--bg);border-radius:var(--r-md);padding:12px 16px;margin-bottom:16px;font-size:13px;color:var(--txt2);line-height:1.65">
        ${r.observaciones_procedimiento}
      </div>
    ` : ''}

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-val">$${costoMP.toFixed(2)}</div>
        <div class="stat-lbl">Costo total MP</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">$${r.porciones_base > 0 ? (costoMP/r.porciones_base).toFixed(2) : '—'}</div>
        <div class="stat-lbl">Costo por porción</div>
      </div>
      <div class="stat-card">
        <div class="stat-val azul">${ingredientes.length}</div>
        <div class="stat-lbl">Ingredientes</div>
      </div>
      <div class="stat-card">
        <div class="stat-val">${r.porciones_base}</div>
        <div class="stat-lbl">Porciones base</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="card-head"><i class="ti ti-basket"></i> Ingredientes</div>
      <table class="tabla-vista">
        <thead>
          <tr>
            <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Ingrediente</th>
            <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Gramos</th>
            ${esPan ? '<th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">% panadero</th>' : ''}
            <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo</th>
          </tr>
        </thead>
        <tbody>
          ${ingredientes.map(ing => `
            <tr>
              <td class="td-nombre">${ing.nombre}</td>
              <td class="td-num">${ing.gramos}g</td>
              ${esPan ? `<td class="td-pct">${((ing.pct||0)*100).toFixed(1)}%</td>` : ''}
              <td class="td-num">$${(parseFloat(ing.costo)||0).toFixed(2)}</td>
            </tr>
          `).join('')}
          <tr style="background:var(--bg);font-weight:600">
            <td style="padding:8px 16px">Total</td>
            <td class="td-num" style="padding:8px 16px">${ingredientes.reduce((s,i)=>s+(parseFloat(i.gramos)||0),0).toFixed(0)}g</td>
            ${esPan ? '<td></td>' : ''}
            <td class="td-num" style="padding:8px 16px">$${costoMP.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${r.sistematización_notas ? `
      <div class="card">
        <div class="card-head"><i class="ti ti-notes"></i> Notas de sistematización</div>
        <div class="card-body" style="font-size:13px;color:var(--txt2);line-height:1.7">${r.sistematización_notas}</div>
      </div>
    ` : ''}
  `;
  mostrarVista('ver-receta');
}

// ── PLANIFICACIÓN SEMANAL ─────────────────────────────────────
function renderVistaPlanificacion() {
  const recetasConsolidadas = App.recetas.filter(r => r.estado === 'consolidada' && r.tipo_receta !== 'sub_receta');
  const dias = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  const hoy = new Date().getDay();
  const diaIdx = hoy === 0 ? 6 : hoy - 1;

  const vista = document.getElementById('vista-planificacion');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area.nombre}</div>
        <h1 class="vista-titulo">Planificación semanal</h1>
      </div>
      <button class="btn-primario" onclick="guardarPlanificacion()">
        <i class="ti ti-device-floppy"></i> Guardar plan
      </button>
    </div>

    ${!recetasConsolidadas.length ? `
      <div class="empty-state">
        <i class="ti ti-calendar-off"></i>
        <h2>Sin recetas consolidadas</h2>
        <p>Solo puedes planificar recetas que hayan sido aprobadas y estén en el maestro.</p>
      </div>
    ` : `
      <div class="plan-tabla-wrap">
        <table class="plan-tabla">
          <thead>
            <tr>
              <th class="th-nombre">Producto</th>
              ${dias.map((d, i) => `<th class="${i === diaIdx ? 'dia-hoy' : ''}">${d}</th>`).join('')}
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${recetasConsolidadas.map(r => `
              <tr>
                <td class="td-nombre">${r.nombre}</td>
                ${dias.map((_, i) => `
                  <td class="${i === diaIdx ? 'dia-hoy' : ''}">
                    <input type="number" min="0" placeholder="0"
                      data-receta="${r.ID_receta}" data-dia="${i}"
                      oninput="actualizarTotalFila(this)"
                      value="${obtenerPlanDia(r.ID_receta, i)}">
                  </td>
                `).join('')}
                <td class="td-total" id="total-${r.ID_receta}">0</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:12px;color:var(--txt3);margin-top:12px;text-align:center">
        <i class="ti ti-info-circle"></i> El día resaltado es hoy. Los cambios se guardan en el Sheet al presionar "Guardar plan".
      </p>
    `}
  `;

  // Calcular totales iniciales
  recetasConsolidadas.forEach(r => calcularTotalFila(r.ID_receta));

  // BOL: Agregar sub-plan de masas base
  if (App.areaCodigo === 'BOL') {
    cargarPlanMasasBOL().then(() => renderSubPlanMasasBOL());
  }

  mostrarVista('planificacion');
}

// ── BOL: PLAN DE MASAS BASE ───────────────────────────────────
let _planMasasBOL = {}; // { ID_mp: [7 días] }

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
      data.filas.forEach(f => {
        const dias = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
        _planMasasBOL[f.ID_mp] = dias.map(d => parseFloat(f[d]) || 0);
      });
    }
  } catch(e) {
    // Fallback a localStorage
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
                  <td>
                    <input type="number" min="0" placeholder="0"
                      data-masa="${m.ID_MP}" data-dia="${i}"
                      oninput="actualizarTotalMasaBOL(this)"
                      value="${v || ''}">
                  </td>`).join('')}
                <td class="td-total" id="total-masa-${m.ID_MP}">${total || 0}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
      <p style="font-size:11px;color:var(--txt3);margin-top:8px">
        <i class="ti ti-info-circle"></i> Máx ${maxTanda} masas por tanda. 
        "Calcular automático" propone el máximo como punto de partida — ajusta según tu criterio.
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
  const maxTandas = cfg.bol?.amasadora_tandas_dia || 2;
  const maxPorTanda = cfg.bol?.amasadora_max_por_tanda || 16;
  const maxDia = maxTandas * maxPorTanda;

  const inputs = document.querySelectorAll('input[data-masa]');
  inputs.forEach(inp => {
    inp.value = maxDia;
    actualizarTotalMasaBOL(inp);
  });
  toast(`Propuesta: ${maxDia} masas por día (${maxTandas} tandas × ${maxPorTanda})`);
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
    return {
      semana_ID: semana,
      ID_mp: m.ID_MP,
      nombre_mp: m.nombre,
      dias
    };
  });

  await escribirEnSheet('guardar_plan_masas_bol', { filas });

  // También guardar en cfg como backup
  const cfg = cargarConfigSubrecetas();
  if (!cfg.bol) cfg.bol = {};
  cfg.bol.plan_masas = _planMasasBOL;
  guardarConfigSubrecetas(cfg);

  toast('Plan de masas guardado');
  desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar plan masas', true);
}

function obtenerPlanDia(recetaId, diaIdx) {
  const entrada = App.planSemana.find(p => p.ID_receta === recetaId);
  if (!entrada) return '';
  const dias = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  return entrada[dias[diaIdx]] || '';
}

function actualizarTotalFila(input) {
  calcularTotalFila(input.dataset.receta);
}

function calcularTotalFila(recetaId) {
  const inputs = document.querySelectorAll(`input[data-receta="${recetaId}"]`);
  const total = Array.from(inputs).reduce((s, el) => s + (parseInt(el.value) || 0), 0);
  const span = document.getElementById('total-' + recetaId);
  if (span) span.textContent = total;
}

async function guardarPlanificacion() {
  const inputs = document.querySelectorAll('#vista-planificacion input[data-receta]');
  const plan = {};
  inputs.forEach(el => {
    const rid = el.dataset.receta;
    const dia = parseInt(el.dataset.dia);
    if (!plan[rid]) plan[rid] = Array(7).fill(0);
    plan[rid][dia] = parseInt(el.value) || 0;
  });

  await escribirEnSheet('guardar_planificacion', {
    hoja: FEN.AREAS[App.areaCodigo].hoja_plan,
    semana: obtenerSemanaActual(),
    plan
  });
  toast('Plan guardado');
}

function obtenerSemanaActual() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

// ── RECETAS DEL DÍA ───────────────────────────────────────────
function renderVistaRecetasDelDia() {
  const dias = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const hoy = new Date().getDay();
  const diaIdx = hoy === 0 ? 6 : hoy - 1;
  const diasOpciones = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

  const vista = document.getElementById('vista-recetas-dia');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area.nombre}</div>
        <h1 class="vista-titulo">Recetas del día</h1>
      </div>
      <select id="selector-dia" onchange="renderDia(this.value)" style="padding:8px 12px;border:1px solid var(--border2);border-radius:var(--r-md);font-size:13px;font-family:inherit">
        ${diasOpciones.map((d, i) => `<option value="${i}" ${i === diaIdx ? 'selected' : ''}>${d}</option>`).join('')}
      </select>
    </div>
    <div id="contenedor-dia"></div>
  `;

  renderDia(diaIdx);
  mostrarVista('recetas-dia');
}

function renderDia(diaIdx) {
  const contenedor = document.getElementById('contenedor-dia');
  const diasNombres = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
  const diaNombre = diasNombres[parseInt(diaIdx)];

  const recetasHoy = App.planSemana.filter(p => parseInt(p[diaNombre] || 0) > 0);

  if (!recetasHoy.length) {
    contenedor.innerHTML = `<div class="empty-state" style="height:300px"><i class="ti ti-moon"></i><h2>Sin producción planificada</h2><p>No hay recetas asignadas para este día.</p></div>`;
    return;
  }

  contenedor.innerHTML = recetasHoy.map(plan => {
    const receta = App.recetas.find(r => r.ID_receta === plan.ID_receta);
    if (!receta) return '';
    const unidades = parseInt(plan[diaNombre]) || 0;
    let ingredientes = [];
    try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}

    return `
      <div class="card" style="margin-bottom:16px">
        <div class="card-head">
          <i class="ti ${App.area.icon}"></i>
          ${receta.nombre}
          <span style="margin-left:auto;font-size:12px;font-weight:400;color:var(--txt2)">${unidades} unidades</span>
        </div>
        <table class="tabla-vista">
          <thead>
            <tr>
              <th style="text-align:left;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Ingrediente</th>
              <th style="text-align:right;padding:8px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Para ${unidades} unid. (g)</th>
            </tr>
          </thead>
          <tbody>
            ${ingredientes.map(ing => {
              const porciones = parseInt(receta.porciones_base) || 1;
              const gramosEscalados = ((parseFloat(ing.gramos) || 0) / porciones * unidades);
              return `
                <tr>
                  <td class="td-nombre">${ing.nombre}</td>
                  <td class="td-num" style="font-weight:600;font-size:14px">${gramosEscalados.toFixed(0)}g</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');
}

// ── MAESTRO DE RECETAS ────────────────────────────────────────
async function renderVistaMaestro() {
  const maestro = await Cache.get('Maestro_recetas', () => leerHoja('Maestro_recetas'));
  const misMaestro = maestro.filter(r => r.área === App.area.nombre);

  const vista = document.getElementById('vista-maestro');
  vista.innerHTML = `
    <div class="vista-header">
      <div>
        <div class="vista-eyebrow">${App.area.nombre}</div>
        <h1 class="vista-titulo">Maestro de recetas</h1>
      </div>
    </div>
    ${!misMaestro.length ? `
      <div class="empty-state"><i class="ti ti-book-off"></i><h2>Sin recetas consolidadas</h2><p>Las recetas aparecen aquí cuando son aprobadas por administración.</p></div>
    ` : `
      <div class="card">
        <div class="card-head"><i class="ti ti-book"></i> Recetas consolidadas (${misMaestro.length})</div>
        <table class="tabla-vista">
          <thead><tr>
            <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Receta</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Porciones</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo MP unit.</th>
            <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Versión</th>
          </tr></thead>
          <tbody>
            ${misMaestro.map(r => `
              <tr>
                <td class="td-nombre">${r.nombre}</td>
                <td class="td-num">${r.porciones_base}</td>
                <td class="td-num">$${parseFloat(r.costo_MP_unitario||0).toFixed(2)}</td>
                <td class="td-num">v${r.versión_actual||1}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
  mostrarVista('maestro');
}

// ── ADMIN: APROBACIONES ───────────────────────────────────────
function renderVistaAprobaciones() {
  const pendientes = App.recetas.filter(r => r.estado === 'pendiente_aprobación');
  const vista = document.getElementById('vista-aprobaciones');
  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Aprobaciones</h1>
    </div>
    ${!pendientes.length ? `
      <div class="empty-state"><i class="ti ti-check-circle"></i><h2>Todo al día</h2><p>No hay recetas pendientes de aprobación.</p></div>
    ` : `
      ${pendientes.map(r => {
        let ingredientes = [];
        try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
        const costoMP = ingredientes.reduce((s,i) => s+(parseFloat(i.costo)||0), 0);
        const areaInfo = FEN.AREAS[r._area] || {};
        return `
          <div class="card" style="margin-bottom:16px">
            <div class="card-head">
              <span style="background:${areaInfo.bg};color:${areaInfo.color};padding:2px 8px;border-radius:99px;font-size:11px">${areaInfo.nombre || r.área}</span>
              <strong style="margin-left:4px">${r.nombre}</strong>
              <div style="margin-left:auto;display:flex;gap:8px">
                <button class="btn-peligro" style="font-size:12px;padding:5px 12px" onclick="rechazarReceta('${r.ID_receta}','${r._area}')">
                  <i class="ti ti-x"></i> Rechazar
                </button>
                <button class="btn-primario" style="font-size:12px;padding:5px 12px" onclick="aprobarReceta('${r.ID_receta}','${r._area}')">
                  <i class="ti ti-check"></i> Aprobar
                </button>
              </div>
            </div>
            <div class="card-body">
              <div style="display:flex;gap:16px;font-size:13px;color:var(--txt2);margin-bottom:12px">
                <span><strong>Porciones:</strong> ${r.porciones_base}</span>
                <span><strong>Costo MP:</strong> $${costoMP.toFixed(2)}</span>
                <span><strong>Versión:</strong> ${r.versión||1}</span>
              </div>
              ${r.observaciones_procedimiento ? `<p style="font-size:13px;color:var(--txt2);line-height:1.6">${r.observaciones_procedimiento}</p>` : ''}
              ${r.sistematización_notas ? `<p style="font-size:12px;color:var(--txt3);margin-top:8px;font-style:italic">${r.sistematización_notas}</p>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    `}
  `;
  mostrarVista('aprobaciones');
}

async function aprobarReceta(recetaId, areaCodigo) {
  const receta = App.recetas.find(r => r.ID_receta === recetaId);
  if (!receta) return;
  const hoja = FEN.AREAS[areaCodigo]?.hoja_recetas;
  await escribirEnSheet('aprobar_receta', { ID_receta: recetaId, hoja, aprobada_por: 'Admin' });
  receta.estado = 'consolidada';
  toast('Receta aprobada y enviada al maestro');
  renderVistaAprobaciones();
}

async function rechazarReceta(recetaId, areaCodigo) {
  const hoja = FEN.AREAS[areaCodigo]?.hoja_recetas;
  await escribirEnSheet('cambiar_estado', { ID_receta: recetaId, hoja, estado: 'en_prueba' });
  const r = App.recetas.find(x => x.ID_receta === recetaId);
  if (r) r.estado = 'en_prueba';
  toast('Receta devuelta a prueba');
  renderVistaAprobaciones();
}

// ── ADMIN: MATERIAS PRIMAS ────────────────────────────────────
function renderVistaMP() {
  const mp = App.materiasPrimas;
  const pendientes = mp.filter(m => m.estado === 'pendiente');
  const categorias = [...new Set(mp.map(m => m.categoría).filter(Boolean))];

  const vista = document.getElementById('vista-mp');
  vista.innerHTML = `
    <div class="vista-header">
      <h1 class="vista-titulo">Materias primas</h1>
      <button class="btn-primario" onclick="abrirFormNuevaMP()"><i class="ti ti-plus"></i> Nueva MP</button>
    </div>

    ${pendientes.length ? `
      <div class="alerta-prueba" style="background:#E3F2FD;border-color:#90CAF9;color:#0D47A1">
        <i class="ti ti-bell" style="color:#1565C0"></i>
        <span><strong>${pendientes.length} solicitud${pendientes.length>1?'es':''} pendiente${pendientes.length>1?'s':''}</strong> de nuevas materias primas.</span>
        <button class="btn-secundario" style="margin-left:auto;font-size:12px" onclick="filtrarPendientes()">Ver solicitudes</button>
      </div>
    ` : ''}

    <div class="card">
      <div class="card-head"><i class="ti ti-list"></i> Catálogo (${mp.filter(m=>m.estado==='activa').length} activas)</div>
      <table class="tabla-vista">
        <thead><tr>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">MP</th>
          <th style="text-align:left;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Categoría</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">$/g</th>
          <th style="text-align:center;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Estado</th>
          <th style="padding:9px 16px;background:var(--bg);border-bottom:1px solid var(--border)"></th>
        </tr></thead>
        <tbody>
          ${mp.map(m => {
            const est = m.estado === 'activa' ? {c:'#2E7D32',bg:'#E8F5E9',l:'Activa'} : m.estado === 'pendiente' ? {c:'#1565C0',bg:'#E3F2FD',l:'Pendiente'} : {c:'#9E9E9E',bg:'#F5F5F5',l:'Inactiva'};
            return `
              <tr>
                <td class="td-nombre">${m.nombre}<br><span style="font-size:11px;color:var(--txt3);font-weight:400">${m.ID_MP}</span></td>
                <td style="font-size:13px;color:var(--txt2)">${m.categoría || '—'}</td>
                <td class="td-num">$${parseFloat(m.costo_por_gramo||0).toFixed(4)}</td>
                <td style="text-align:center"><span class="estado-badge" style="color:${est.c};background:${est.bg}">${est.l}</span></td>
                <td style="text-align:right;padding:6px 12px">
                  <button class="btn-secundario" style="font-size:12px;padding:4px 10px" onclick="editarMP('${m.ID_MP}')">
                    <i class="ti ti-edit"></i>
                  </button>
                </td>
              </tr>
            `;
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
    <div class="vista-header">
      <h1 class="vista-titulo">Estructuras de costo</h1>
    </div>
    ${!ec.length ? `
      <div class="empty-state"><i class="ti ti-chart-bar-off"></i><h2>Sin datos</h2><p>Las EC aparecen aquí cuando se aprueban recetas.</p></div>
    ` : `
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
            ${ec.map(r => `
              <tr>
                <td class="td-nombre">${r.nombre}</td>
                <td style="font-size:13px;color:var(--txt2)">${r.área}</td>
                <td class="td-num">$${parseFloat(r.costo_MP_unit||0).toFixed(2)}</td>
                <td class="td-num">$${parseFloat(r.precio_B2C||0).toFixed(2)}</td>
                <td class="td-num">$${parseFloat(r.precio_B2B||0).toFixed(2)}</td>
                <td class="td-num" style="color:#2E7D32">${parseFloat(r['utilidad_mes_%']||0).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `}
  `;
  mostrarVista('costos');
}

// ── SOLICITAR NUEVA MP ────────────────────────────────────────
function solicitarNuevaMP() {
  const nombre = prompt('Nombre de la nueva materia prima:');
  if (!nombre) return;
  toast('Solicitud enviada a administración');
  escribirEnSheet('solicitar_mp', { nombre, solicitada_por: App.area?.nombre || 'Admin', fecha: new Date().toISOString() });
}

function editarMP(mpId) {
  const mp = App.materiasPrimas.find(m => m.ID_MP === mpId);
  if (!mp) return;
  const nuevoPrecio = prompt(`Precio neto de "${mp.nombre}" (actual: $${mp.costo_neto}):`, mp.costo_neto);
  if (nuevoPrecio === null) return;
  const precio = parseFloat(nuevoPrecio);
  if (isNaN(precio)) { toast('Precio inválido', 'error'); return; }
  escribirEnSheet('editar_mp', { ID_MP: mpId, costo_neto: precio });
  mp.costo_neto = precio;
  toast('Precio actualizado');
  Cache.invalidar('mp_maestro');
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
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Costo MP unit.</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Porciones</th>
          <th style="text-align:right;padding:9px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:var(--txt3);background:var(--bg);border-bottom:1px solid var(--border)">Versión</th>
        </tr></thead>
        <tbody>
          ${maestro.map(r => `
            <tr>
              <td class="td-nombre">${r.nombre}</td>
              <td style="font-size:13px;color:var(--txt2)">${r.área}</td>
              <td class="td-num">$${parseFloat(r.costo_MP_unitario||0).toFixed(2)}</td>
              <td class="td-num">${r.porciones_base}</td>
              <td class="td-num">v${r.versión_actual||1}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  mostrarVista('maestro-admin');
}

// ── UTILIDADES ────────────────────────────────────────────────
function generarId(areaCodigo) {
  const existing = App.recetas.filter(r => r.ID_receta?.startsWith(areaCodigo));
  const n = existing.length + 1;
  return `${areaCodigo}${String(n).padStart(3,'0')}`;
}

function mostrarLoading(msg = 'Cargando...') {
  const l = document.getElementById('loading-overlay');
  if (l) { l.querySelector('span').textContent = msg; l.classList.remove('hidden'); }
}

function ocultarLoading() {
  const l = document.getElementById('loading-overlay');
  if (l) l.classList.add('hidden');
}

function toast(msg, tipo = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (tipo ? ' ' + tipo : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}
