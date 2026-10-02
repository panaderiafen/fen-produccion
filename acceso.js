// ═══════════════════════════════════════════════
//  fën producción — Acceso v2.0.0
//  Entrada de jefas (PIN de Asistencia), Administración (contraseña del
//  dueño, la misma del panel de Asistencia), autorización de equipos y la
//  sección Administración → Seguridad.
// ═══════════════════════════════════════════════

const Acceso = { estado: null };

// Pregunta al servidor qué sabe de este equipo. Si una sesión guardada ya no
// sirve (venció o se cerró desde Seguridad), se olvida.
async function accesoCargarEstado() {
  const disp = FenSesion.dispositivo();
  const adm = FenSesion.admin();
  const r = await fenApi('estado', { token: null, dispositivo: disp, sesion: adm }, { sinAviso: true });
  if (!r || r.ok === false) { Acceso.estado = null; return null; }
  // Solo se olvida lo que se consultó: si mientras tanto se autorizó el
  // equipo o se entró como admin, esa sesión nueva no se toca.
  if (!r.dispositivo && disp && FenSesion.dispositivo() === disp) FenSesion.setDispositivo(null);
  if ((!r.sesion || r.sesion.rol !== 'admin') && adm && FenSesion.admin() === adm) FenSesion.setAdmin(null);
  if (FenSesion.dispositivo() !== disp || FenSesion.admin() !== adm) return accesoCargarEstado();
  Acceso.estado = r;
  return r;
}

// Texto de cada tarjeta de área: quién puede entrar.
function accesoDescripcionArea(codigo) {
  const a = Acceso.estado && Acceso.estado.areas && Acceso.estado.areas.find(x => x.codigo === codigo);
  if (!a) return 'Recetas · Planificación · Maestro';
  if (!a.personas.length) return 'Sin jefa asignada';
  return 'Entra: ' + a.personas.map(p => p.nombre.split(' ')[0]).join(', ');
}

function accesoPieLogin() {
  let pie = document.getElementById('login-pie');
  if (!pie) {
    pie = document.createElement('div');
    pie.id = 'login-pie';
    pie.className = 'login-pie';
    document.getElementById('login-screen').appendChild(pie);
  }
  const e = Acceso.estado;
  const equipo = e && e.dispositivo
    ? `<i class="ti ti-device-desktop-check"></i> Equipo autorizado: <strong>${esc(e.dispositivo.nombre)}</strong>`
    : e ? `<i class="ti ti-device-desktop-off"></i> Equipo sin autorizar
            <span class="info-i" tabindex="0" data-info="La primera vez que una jefa entra desde este equipo, el dueño escribe su contraseña una sola vez. Después cada jefa entra solo con su PIN.">i</span>`
        : `<i class="ti ti-wifi-off"></i> Sin conexión con el servidor`;
  pie.innerHTML = `<span>${equipo}</span><span class="login-version">app v${FEN.VERSION}</span>`;
}

// ── Modal genérico ───────────────────────────────────────────
function accesoModal(html, opciones = {}) {
  accesoCerrarModal();
  const fondo = document.createElement('div');
  fondo.className = 'modal-fondo';
  fondo.id = 'modal-acceso';
  fondo.innerHTML = `<div class="modal modal-acceso">${html}</div>`;
  if (!opciones.fijo) fondo.addEventListener('click', ev => { if (ev.target === fondo) accesoCerrarModal(); });
  document.body.appendChild(fondo);
  const primero = fondo.querySelector('input');
  if (primero) setTimeout(() => primero.focus(), 50);
  return fondo;
}
function accesoCerrarModal() {
  const m = document.getElementById('modal-acceso');
  if (m) m.remove();
}

function accesoBotonCargando(btn, cargando, texto) {
  if (!btn) return;
  btn.disabled = cargando;
  if (texto) btn.innerHTML = texto;
}

// ── Contraseña del dueño (para Administración o para autorizar un equipo) ──
function accesoPedirClave({ titulo, texto, pedirEquipo, boton, ofrecerRecordar }) {
  return new Promise(resolve => {
    const m = accesoModal(`
      <div class="modal-ico" style="background:var(--azul-soft);color:var(--azul)"><i class="ti ti-lock"></i></div>
      <h3>${titulo}</h3>
      <p>${texto}</p>
      <form id="form-clave-acceso" class="form-acceso" autocomplete="off">
        <input type="password" id="acceso-clave" placeholder="Contraseña" autocomplete="current-password">
        ${pedirEquipo ? `<input type="text" id="acceso-equipo" placeholder="Nombre del equipo (ej. Tablet Bollería)" maxlength="40">` : ''}
        ${ofrecerRecordar ? `<label class="acceso-recordar"><input type="checkbox" id="acceso-recordar">
          Recordar en este equipo por 30 días
          <span class="info-i" tabindex="0" data-info="Márcalo solo en tu computador o tu celular. En una tablet de cocina déjalo sin marcar: así nadie más puede entrar a Administración con tu sesión.">i</span></label>` : ''}
        <div class="acceso-error" id="acceso-error"></div>
        <div class="modal-acciones">
          <button type="button" class="btn-secundario" id="acceso-cancelar">Cancelar</button>
          <button type="submit" class="btn-primario" id="acceso-ok">${boton}</button>
        </div>
      </form>`);
    m.querySelector('#acceso-cancelar').onclick = () => { accesoCerrarModal(); resolve(null); };
    m.querySelector('#form-clave-acceso').onsubmit = ev => {
      ev.preventDefault();
      const clave = m.querySelector('#acceso-clave').value;
      if (!clave) return;
      const equipo = pedirEquipo ? m.querySelector('#acceso-equipo').value.trim() : '';
      const recordar = !!(m.querySelector('#acceso-recordar') || {}).checked;
      resolve({ clave, equipo, recordar, modal: m });
    };
  });
}

function accesoErrorModal(m, msg) {
  const el = m.querySelector('#acceso-error');
  if (el) el.textContent = msg;
}

function accesoAutorizarEquipo() {
  return new Promise(async resolve => {
    const r = await accesoPedirClave({
      titulo: 'Autorizar este equipo',
      texto: 'Es una sola vez por equipo. Escribe la contraseña del dueño (la misma del panel de Asistencia) y un nombre para reconocerlo.',
      pedirEquipo: true,
      boton: 'Autorizar',
    });
    if (!r) { resolve(false); return; }
    const m = r.modal;
    const intentar = async (clave, equipo) => {
      const btn = m.querySelector('#acceso-ok');
      accesoBotonCargando(btn, true, 'Revisando…');
      const res = await fenApi('autorizar_dispositivo', { token: null, password: clave, nombreDispositivo: equipo || 'Equipo de cocina' }, { sinAviso: true });
      if (res && res.ok) {
        FenSesion.setDispositivo(res.dispositivo);
        accesoCerrarModal();
        await accesoCargarEstado();
        renderLoginCards();
        resolve(true);
        return;
      }
      accesoBotonCargando(btn, false, 'Autorizar');
      accesoErrorModal(m, (res && res.msg) || 'No se pudo autorizar.');
    };
    m.querySelector('#form-clave-acceso').onsubmit = ev => {
      ev.preventDefault();
      const clave = m.querySelector('#acceso-clave').value;
      if (clave) intentar(clave, m.querySelector('#acceso-equipo').value.trim());
    };
    m.querySelector('#acceso-cancelar').onclick = () => { accesoCerrarModal(); resolve(false); };
    intentar(r.clave, r.equipo);
  });
}

// ── Entrada de Administración ───────────────────────────────
async function accesoAdmin() {
  FenSesion.setJefa(null);
  if (FenSesion.admin()) {
    const e = await accesoCargarEstado();
    if (e && e.sesion && e.sesion.rol === 'admin') { entrar(null, 'admin'); return; }
  }
  const r = await accesoPedirClave({
    titulo: 'Administración',
    texto: 'Escribe la contraseña del dueño: es la misma del panel de Asistencia.',
    pedirEquipo: !FenSesion.dispositivo(),
    ofrecerRecordar: true,
    boton: 'Entrar',
  });
  if (!r) return;
  await accesoEnviarClaveAdmin(r);
}

async function accesoEnviarClaveAdmin(r) {
  const btn = r.modal.querySelector('#acceso-ok');
  accesoBotonCargando(btn, true, 'Revisando…');
  const res = await fenApi('login_admin', {
    token: null, password: r.clave, dispositivo: FenSesion.dispositivo(),
    nombreDispositivo: r.equipo || 'Equipo de administración',
  }, { sinAviso: true });
  if (res && res.ok) {
    FenSesion.setAdmin(res.token, r.recordar);
    if (res.dispositivo) FenSesion.setDispositivo(res.dispositivo);
    accesoCerrarModal();
    accesoCargarEstado().then(accesoPieLogin);
    entrar(null, 'admin');
    return;
  }
  accesoBotonCargando(btn, false, 'Entrar');
  accesoErrorModal(r.modal, (res && res.msg) || 'No se pudo entrar.');
  r.modal.querySelector('#form-clave-acceso').onsubmit = ev => {
    ev.preventDefault();
    const clave = r.modal.querySelector('#acceso-clave').value;
    const eq = r.modal.querySelector('#acceso-equipo');
    const rec = r.modal.querySelector('#acceso-recordar');
    if (clave) accesoEnviarClaveAdmin({ clave, equipo: eq ? eq.value.trim() : '', recordar: !!(rec && rec.checked), modal: r.modal });
  };
}

// ── Entrada de una jefa ─────────────────────────────────────
async function accesoArea(codigo) {
  FenSesion.setJefa(null);
  if (!FenSesion.dispositivo()) {
    const ok = await accesoAutorizarEquipo();
    if (!ok) return;
  }
  if (!Acceso.estado || !Acceso.estado.areas) await accesoCargarEstado();
  const area = Acceso.estado && Acceso.estado.areas && Acceso.estado.areas.find(a => a.codigo === codigo);
  if (!area) { toast('No se pudo conectar con el servidor. Intenta de nuevo.', 'error'); return; }
  if (!area.personas.length) {
    const m = accesoModal(`
      <div class="modal-ico" style="background:#FFF3E0;color:#E65100"><i class="ti ti-user-question"></i></div>
      <h3>${esc(area.nombre)} no tiene jefa asignada</h3>
      <p>Para trabajar en esta área, entra por <strong>Administración</strong> y usa "Ir a área".
      Para que una persona entre con su PIN, asígnala en <strong>Administración → Seguridad</strong>.</p>
      <div class="modal-acciones"><button class="btn-primario" id="acceso-entendido">Entendido</button></div>`);
    m.querySelector('#acceso-entendido').onclick = accesoCerrarModal;
    return;
  }
  if (area.personas.length === 1) { accesoPin(area, area.personas[0]); return; }
  const m = accesoModal(`
    <div class="modal-ico" style="background:${FEN.AREAS[codigo].bg};color:${FEN.AREAS[codigo].color}"><i class="ti ${FEN.AREAS[codigo].icon}"></i></div>
    <h3>${esc(area.nombre)}</h3>
    <p>¿Quién entra?</p>
    <div class="acceso-personas">
      ${area.personas.map((p, i) => `<button class="acceso-persona" data-i="${i}">${esc(p.nombre)}</button>`).join('')}
    </div>`);
  m.querySelectorAll('.acceso-persona').forEach(b => {
    b.onclick = () => accesoPin(area, area.personas[Number(b.dataset.i)]);
  });
}

function accesoPin(area, persona) {
  const cfg = FEN.AREAS[area.codigo];
  let pin = '';
  const m = accesoModal(`
    <div class="modal-ico" style="background:${cfg.bg};color:${cfg.color}"><i class="ti ${cfg.icon}"></i></div>
    <h3>${esc(persona.nombre)}</h3>
    <p>Tu PIN de Asistencia
      <span class="info-i" tabindex="0" data-info="Es el mismo PIN de 4 dígitos con el que marcas entrada y salida en la tablet. Si lo olvidaste, el dueño te asigna uno nuevo en el panel de Asistencia.">i</span></p>
    <div class="pin-puntos">${'<span></span>'.repeat(4)}</div>
    <div class="acceso-error" id="acceso-error"></div>
    <div class="pin-teclado">
      ${[1,2,3,4,5,6,7,8,9].map(n => `<button class="pin-tecla" data-n="${n}">${n}</button>`).join('')}
      <button class="pin-tecla pin-accion" data-n="cancelar" aria-label="Cancelar">✕</button>
      <button class="pin-tecla" data-n="0">0</button>
      <button class="pin-tecla pin-accion" data-n="borrar" aria-label="Borrar">⌫</button>
    </div>`, { fijo: true });
  const puntos = m.querySelectorAll('.pin-puntos span');
  const pintar = () => puntos.forEach((p, i) => p.classList.toggle('lleno', i < pin.length));
  let enviando = false;
  const enviar = async () => {
    enviando = true;
    m.querySelector('#acceso-error').textContent = 'Revisando…';
    const res = await fenApi('login_jefa', {
      token: null, dispositivo: FenSesion.dispositivo(), area: area.codigo, email: persona.email, pin,
    }, { sinAviso: true });
    if (res && res.ok) {
      FenSesion.setJefa(res.token);
      App.nombreUsuario = res.nombre;
      accesoCerrarModal();
      entrar(area.codigo, 'jefa');
      return;
    }
    if (res && res.code === 'dispositivo') FenSesion.setDispositivo(null);
    pin = ''; pintar(); enviando = false;
    m.querySelector('#acceso-error').textContent = (res && res.msg) || 'No se pudo entrar.';
  };
  const tecla = n => {
    if (enviando) return;
    if (n === 'cancelar') { accesoCerrarModal(); return; }
    if (n === 'borrar') { pin = pin.slice(0, -1); pintar(); return; }
    if (pin.length >= 4) return;
    pin += n; pintar();
    m.querySelector('#acceso-error').textContent = '';
    if (pin.length === 4) enviar();
  };
  m.querySelectorAll('.pin-tecla').forEach(b => { b.onclick = () => tecla(b.dataset.n); });
  m.addEventListener('keydown', ev => {
    if (/^\d$/.test(ev.key)) tecla(ev.key);
    else if (ev.key === 'Backspace') tecla('borrar');
    else if (ev.key === 'Escape') tecla('cancelar');
  });
  m.tabIndex = -1; m.focus();
}

// ── Salir y sesión vencida ──────────────────────────────────
async function accesoSalir() {
  const sesiones = [FenSesion.jefa(), FenSesion.admin()].filter(Boolean);
  FenSesion.setJefa(null);
  FenSesion.setAdmin(null);
  sesiones.forEach(t => fenApi('logout', { token: null, sesion: t }, { sinAviso: true }));
  await accesoCargarEstado();
  renderLoginCards();
}

let _avisoSesionMostrado = false;
function fenSesionVencida() {
  if (_avisoSesionMostrado) return;
  _avisoSesionMostrado = true;
  FenSesion.setJefa(null);
  FenSesion.setAdmin(null);
  if (typeof toast === 'function') toast('Tu sesión venció. Vuelve a entrar.', 'error');
  setTimeout(() => {
    _avisoSesionMostrado = false;
    if (!document.getElementById('app').classList.contains('hidden')) salir();
  }, 1200);
}

// ═══════════════════════════════════════════════
//  Administración → Seguridad
// ═══════════════════════════════════════════════
async function renderVistaSeguridad() {
  const vista = document.getElementById('vista-seguridad');
  vista.innerHTML = '<div class="vista-header"><h1 class="vista-titulo">Seguridad y acceso</h1></div><div class="loading"><div class="spinner"></div> Cargando…</div>';
  mostrarVista('seguridad');
  const d = await fenApi('seg_datos');
  if (!d || !d.ok) {
    vista.innerHTML = `<div class="vista-header"><h1 class="vista-titulo">Seguridad y acceso</h1></div><p style="color:#C62828">${esc((d && d.msg) || 'No se pudo cargar.')}</p>`;
    return;
  }
  const conectada = d.asistencia === 'conectada';
  const personasConPin = d.personas.filter(p => p.tienePin);
  const fecha = iso => new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
  const rolTxt = { admin: 'Administración', jefa: 'Jefa', dispositivo: 'Equipo autorizado' };

  vista.innerHTML = `
    <div class="vista-header"><h1 class="vista-titulo">Seguridad y acceso</h1></div>

    <div class="card seg-card">
      <div class="seg-fila">
        <div><strong>Conexión con Asistencia</strong>
          <span class="info-i" tabindex="0" data-info="Producción le pregunta a Asistencia si tu contraseña y los PIN son correctos. Así hay una sola contraseña de dueño y un solo PIN por persona. La contraseña se cambia en el panel de Asistencia → trabajadores → seguridad.">i</span></div>
        <span class="seg-chip ${conectada ? 'ok' : 'mal'}">${conectada ? 'Conectada' : 'Sin conexión'}</span>
      </div>
      ${conectada ? '' : '<p class="seg-nota">Sin conexión no se puede entrar con PIN ni con contraseña. Revisa ASISTENCIA_URL y ASISTENCIA_CLAVE en las propiedades del script (README).</p>'}
    </div>

    <div class="card seg-card">
      <h2 class="seg-titulo">Jefas por área
        <span class="info-i" tabindex="0" data-info="Quién puede entrar a cada área con su PIN de Asistencia. Puedes marcar más de una persona por área. Solo aparecen las personas activas en Asistencia. Puedes marcar a alguien sin PIN, pero no podrá entrar hasta que le asignes uno en el panel de Asistencia.">i</span></h2>
      <p class="seg-nota">Las jefas no ven costos ni precios. Un área sin jefa solo se abre desde Administración → "Ir a área".</p>
      <div class="seg-areas">
        ${Object.entries(d.areas).map(([cod, nombre]) => `
          <div class="seg-area">
            <div class="seg-area-nombre" style="color:${FEN.AREAS[cod].color}"><i class="ti ${FEN.AREAS[cod].icon}"></i> ${esc(nombre)}</div>
            ${d.personas.map(p => `
              <label class="seg-check">
                <input type="checkbox" data-area="${cod}" value="${esc(p.email)}" ${(d.jefas[cod] || []).includes(p.email.toLowerCase()) ? 'checked' : ''}>
                <span>${esc(p.nombre)}${p.tienePin ? '' : '<small>Sin PIN: no podrá entrar hasta que le asignes uno en Asistencia</small>'}</span>
              </label>`).join('') || '<p class="seg-nota">No llegaron personas desde Asistencia.</p>'}
          </div>`).join('')}
      </div>
      <button class="btn-primario" id="btn-guardar-jefas" ${conectada ? '' : 'disabled'}><i class="ti ti-device-floppy"></i> Guardar jefas</button>
      <span class="seg-msg" id="msg-jefas"></span>
    </div>

    <div class="card seg-card">
      <h2 class="seg-titulo">Equipos y sesiones abiertas
        <span class="info-i" tabindex="0" data-info="Equipo autorizado: un computador o tablet donde las jefas pueden entrar con su PIN (dura un año). Administración: tus sesiones (30 días). Jefa: sesiones abiertas hoy (12 horas). Si pierdes un equipo, ciérralo aquí: tendrá que autorizarse de nuevo.">i</span></h2>
      <div class="seg-sesiones">
        ${d.sesiones.map(s => `
          <div class="seg-sesion">
            <div><strong>${esc(s.nombre || '—')}</strong><br><small>${rolTxt[s.rol] || s.rol} · desde ${fecha(s.creada)} · vence ${fecha(s.vence)}</small></div>
            ${s.esta ? '<span class="seg-chip ok">Esta sesión</span>' : `<button class="btn-secundario btn-revocar" data-id="${s.id}">Cerrar</button>`}
          </div>`).join('') || '<p class="seg-nota">No hay sesiones abiertas.</p>'}
      </div>
    </div>
    <p class="seg-version">Producción · app v${FEN.VERSION} · Apps Script v${esc(d.version)}</p>`;

  vista.querySelector('#btn-guardar-jefas').onclick = async ev => {
    const btn = ev.currentTarget; // después del await, ev.currentTarget ya no existe
    const jefas = {};
    Object.keys(d.areas).forEach(a => { jefas[a] = []; });
    vista.querySelectorAll('input[type=checkbox][data-area]:checked').forEach(c => jefas[c.dataset.area].push(c.value));
    bloquearBtn(btn, 'Guardando…');
    const r = await fenApi('seg_guardar_jefas', { jefas });
    desbloquearBtn(btn, '<i class="ti ti-device-floppy"></i> Guardar jefas', !!(r && r.ok));
    vista.querySelector('#msg-jefas').textContent = r && r.ok ? '' : ((r && r.msg) || 'No se pudo guardar.');
  };
  vista.querySelectorAll('.btn-revocar').forEach(b => {
    b.onclick = async () => {
      if (!confirm('¿Cerrar esta sesión? Ese equipo o persona tendrá que entrar de nuevo.')) return;
      const r = await fenApi('seg_revocar', { id: b.dataset.id });
      if (r && r.ok) renderVistaSeguridad(); else toast((r && r.msg) || 'No se pudo cerrar', 'error');
    };
  });
}
