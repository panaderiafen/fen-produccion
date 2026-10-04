// ═══════════════════════════════════════════════════════════
//  fën producción — Apps Script · Seguridad.gs  v2.0.0  (2026-10-01)
//
//  Archivo NUEVO: va en el mismo proyecto de Apps Script que Code.gs.
//  Recibe todas las llamadas de la app (doPost / doGet) y, antes de
//  ejecutar cualquier acción, revisa quién la pide:
//
//   · Administración: la misma contraseña del panel de Asistencia.
//     Producción se la pregunta a Asistencia (servidor a servidor), así hay
//     UNA sola contraseña de dueño. La sesión dura 30 días en ese equipo.
//   · Jefas: cada equipo de cocina se autoriza UNA vez con la contraseña del
//     dueño. Después, la jefa entra a su área con su PIN de Asistencia.
//     Quién es jefa de cada área se elige en Administración → Seguridad.
//     Su sesión dura 12 horas o hasta que toque "Salir".
//   · Las jefas no ven costos ni precios: este archivo los quita de todo lo
//     que les llega. Al guardar una receta o una merma, el costo lo calcula
//     el servidor con los precios de MP_maestro.
//   · La planilla deja de leerse publicada: la app lee cada hoja por aquí.
//   · Cada escritura lleva una clave única (idem) y se hace con bloqueo:
//     aunque llegue dos veces, se ejecuta una.
//
//  Configuración (una vez, ver README):
//   Configuración del proyecto ▸ Propiedades del script:
//     ASISTENCIA_URL   = URL /exec del Apps Script de Asistencia
//     ASISTENCIA_CLAVE = clave que entrega crearClaveServicioProduccion()
//                        en el Apps Script de Asistencia
//   Luego ejecutar instalarSeguridad() para probar la conexión.
// ═══════════════════════════════════════════════════════════

const SEG_VERSION = '2.1.0';
const SEG_SESION_ADMIN_DIAS  = 30;
const SEG_SESION_JEFA_HORAS  = 12;
const SEG_DISPOSITIVO_DIAS   = 400;
const SEG_AREAS = { PAN: 'Panadería', BOL: 'Bollería', PAS: 'Pastelería', CAF: 'Cafetería' };

// Encabezados o campos que una jefa no debe ver.
const SEG_COSTO_RE = /costo|precio|utilidad|margen|monto|ingreso_neto|gasto|valor_neto|rentab|venta_est|^iva|^imp_adicional|^cobertura|super[aá]vit/i;

// Hojas que la app lee directamente (antes vía planilla publicada).
const SEG_HOJAS_JEFA = /^(PAN|BOL|PAS|CAF)_(recetas|planificacion)$|^MP_maestro$|^Maestro_recetas$|^BOL_(plan_[a-z_]+|stock_inicial_[a-z]+)$/;
const SEG_HOJAS_ADMIN_EXTRA = /^(EC_productos|EC_resumen_areas|Config_costeo|Lista_publica_productos|Productos_reventa|Inversiones|Ventas_mensuales_consolidadas|Registro_merma|Mapeo_productos)$/;

// Acciones de la app que son decisiones del dueño o muestran finanzas.
const SEG_SOLO_ADMIN = [
  'aprobar_receta', 'editar_mp', 'editar_campo_mp', 'eliminar_mp',
  'reemplazar_mp_receta', 'fusionar_mp', 'renombrar_mp', 'buscar_recetas_usando_mp',
  'auditar_costos_recetas', 'sincronizar_lista_publica',
  'leer_correos_jefas', 'guardar_correos_jefas', 'leer_urls_ventas_csv', 'guardar_urls_ventas_csv',
  'sincronizar_ventas_mensuales', 'leer_ventas_mensuales', 'leer_solicitudes_habilitacion',
  'resolver_solicitud_habilitacion', 'crear_producto_reventa', 'editar_producto_reventa',
  'ajustar_stock_reventa', 'leer_productos_reventa', 'crear_aviso',
  'leer_gastos_area', 'leer_gastos_area_prorrateo', 'leer_resumen_ventas_mes',
  'crear_inversion', 'editar_inversion', 'leer_inversiones', 'leer_config_costeo',
  'guardar_config_costeo', 'calcular_ec', 'generar_informe_auditoria',
  'guardar_verificacion_ventas_externa', 'leer_ventas_total_b2b_externo',
  'leer_ventas_total_b2c_externo', 'sincronizar_cobros_b2b', 'leer_verificacion_ventas_externa',
  'generar_informe_general', 'calcular_meta_venta', 'eliminar_config_costeo_fila', 'eliminar_ec_por_area',
];

// Acciones nuevas de esta versión.
const SEG_ACCIONES = {
  ping:                  { nivel: 'publico', fn: () => ({ ok: true, version: SEG_VERSION }) },
  estado:                { nivel: 'publico', fn: segEstado },
  login_admin:           { nivel: 'publico', fn: segLoginAdmin },
  autorizar_dispositivo: { nivel: 'publico', fn: segAutorizarDispositivo },
  login_jefa:            { nivel: 'publico', fn: segLoginJefa },
  logout:                { nivel: 'publico', fn: segLogout },
  leer_hoja:             { nivel: 'equipo',  fn: segLeerHoja },
  seg_datos:             { nivel: 'admin',   fn: segDatosSeguridad },
  seg_guardar_jefas:     { nivel: 'admin',   fn: segGuardarJefas, escribe: true },
  seg_revocar:           { nivel: 'admin',   fn: segRevocar, escribe: true },
};

// ═══════════════════════════════════════════════════════════
//  Entrada
// ═══════════════════════════════════════════════════════════

function doPost(e) {
  let p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return segSalida({ ok: false, msg: 'Solicitud inválida', code: 'formato' }); }
  return segSalida(segDespachar(p));
}

function doGet(e) {
  const prm = (e && e.parameter) || {};
  if (prm.action === 'ping' || prm.accion === 'ping') return segSalida({ ok: true, version: SEG_VERSION });
  // Respaldo cuando Google desvía el POST: la app reenvía el mismo JSON en "p".
  // "payload" es el formato de la v1: también exige sesión.
  const crudo = prm.p || prm.payload;
  if (crudo) {
    let p;
    try { p = JSON.parse(crudo); } catch (err) { return segSalida({ ok: false, msg: 'Solicitud inválida', code: 'formato' }); }
    return segSalida(segDespachar(p));
  }
  return segSalida({ ok: false, msg: 'Solicitud sin datos: la app reintentará.', code: 'version' });
}

function segSalida(d) {
  return ContentService.createTextOutput(JSON.stringify(d)).setMimeType(ContentService.MimeType.JSON);
}

function segDespachar(p) {
  const accion = String(p.accion || p.action || '');
  const nueva = Object.prototype.hasOwnProperty.call(SEG_ACCIONES, accion) ? SEG_ACCIONES[accion] : null;
  try {
    let ses = null;
    if (!nueva || nueva.nivel !== 'publico') {
      ses = segLeerSesion(p.token);
      if (!ses || (ses.rol !== 'admin' && ses.rol !== 'jefa') || (ses.rol === 'jefa' && !segJefaVigente(ses))) {
        return { ok: false, code: 'sesion', msg: 'Tu sesión venció. Vuelve a entrar.' };
      }
      const soloAdmin = nueva ? nueva.nivel === 'admin' : SEG_SOLO_ADMIN.indexOf(accion) >= 0;
      if (soloAdmin && ses.rol !== 'admin') {
        return { ok: false, code: 'permiso', msg: 'Solo Administración puede hacer esto.' };
      }
    }

    const datos = Object.assign({}, p);
    delete datos.token; delete datos.idem; delete datos.action;
    datos.accion = accion;

    if (ses && ses.rol === 'jefa' && !nueva) {
      const rechazo = segRevisarJefa(accion, datos, ses);
      if (rechazo) return { ok: false, code: 'permiso', msg: rechazo };
    }

    const escribe = nueva ? !!nueva.escribe : segEsEscritura(accion);
    let r;
    if (!escribe) {
      r = nueva ? nueva.fn(datos, ses) : ejecutarAccionLegada(accion, datos);
    } else {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(30000)) return { ok: false, code: 'ocupado', msg: 'El sistema está ocupado, intenta de nuevo en unos segundos.' };
      try {
        // La clave idem vale solo para esa sesión y esa acción.
        const idem = typeof p.idem === 'string' && /^[a-z0-9-]{8,64}$/i.test(p.idem)
          ? 'idem_' + segSha((ses ? ses.id : '-') + '|' + accion + '|' + p.idem).slice(0, 32) : null;
        const previo = idem ? segCache().get(idem) : null;
        if (previo) {
          r = JSON.parse(previo);
        } else {
          if (accion === 'guardar_registro_merma') segValorizarMerma(datos);
          r = nueva ? nueva.fn(datos, ses) : ejecutarAccionLegada(accion, datos);
          // v2.1: solo se recuerda un resultado exitoso; un reintento después de un error se vuelve a ejecutar
          if (idem && r && r.ok !== false) { try { segCache().put(idem, JSON.stringify(r), 600); } catch (e) {} }
        }
      } finally {
        lock.releaseLock();
      }
    }
    if (ses && ses.rol === 'jefa') r = segOcultarCostos(r);
    return r;
  } catch (err) {
    return { ok: false, msg: String(err && err.message || err) };
  }
}

function segEsEscritura(accion) {
  return /^(guardar|editar|crear|eliminar|cambiar|aprobar|solicitar|registrar|ajustar|fusionar|renombrar|reemplazar|resolver|marcar|mov_|actualizar|sincronizar|calcular_ec|generar)/.test(accion);
}

// Reglas extra cuando quien pide es una jefa.
function segRevisarJefa(accion, d, ses) {
  const hojaPropia = ses.area + '_recetas';
  if (accion === 'guardar_receta') {
    if (d.hoja !== hojaPropia) return 'Solo puedes guardar recetas de tu área.';
    if (d.estado === 'consolidada') return 'Una receta queda consolidada solo cuando Administración la aprueba.';
    const actual = segEstadoActualReceta(d.hoja, d.ID_receta);
    if (!d.esEdicion && actual !== '') return 'Ya existe una receta con ese código.';
    delete d.aprobada_por; delete d['fecha_consolidación'];
    segRecostearReceta(d);
  }
  if (accion === 'cambiar_estado') {
    if (d.hoja !== hojaPropia) return 'Solo puedes cambiar recetas de tu área.';
    if (['pendiente_aprobación', 'pendiente_aprobacion', 'en_prueba', 'borrador'].indexOf(d.estado) < 0) {
      return 'Ese cambio de estado lo hace Administración.';
    }
    if (segEstadoActualReceta(d.hoja, d.ID_receta) === 'consolidada') return 'Una receta aprobada se cambia editándola (vuelve a prueba).';
  }
  if (accion === 'editar_campo_receta') {
    // Desde las áreas solo se edita "unidades por caja" (Configuraciones).
    if (d.hoja !== hojaPropia || segEstadoActualReceta(d.hoja, d.ID_receta) === '') return 'Solo puedes editar recetas de tu área.';
    if (['unidades_por_caja'].indexOf(d.campo) < 0) return 'Ese dato lo edita Administración.';
  }
  if (accion === 'eliminar_receta') {
    // La jefa puede borrar sus borradores y recetas en prueba que nunca se
    // aprobaron (como en v1). Una receta que ya estuvo en el maestro solo la
    // descontinúa Administración.
    if (d.hoja !== hojaPropia) return 'Solo puedes eliminar recetas de tu área.';
    const estado = segEstadoActualReceta(d.hoja, d.ID_receta);
    if (['borrador', 'en_prueba'].indexOf(estado) < 0 || segEstadoActualReceta('Maestro_recetas', d.ID_receta) !== '') {
      return 'Esta receta ya fue aprobada alguna vez: solo Administración puede descontinuarla.';
    }
  }
  if (accion === 'guardar_planificacion' && d.hoja !== ses.area + '_planificacion') return 'Solo puedes planificar tu área.';
  if (accion === 'leer_config' && d.clave !== 'subrecetas') return 'Esa configuración la ve Administración.';
  if (accion === 'editar_config' && d.clave !== 'subrecetas') return 'Esa configuración la edita Administración.';
  if (accion === 'solicitar_mp') {
    // Una jefa solo solicita: la MP queda pendiente y el costo lo pone Administración.
    ['origen', 'estado_directo', 'costo_neto', 'unidad_compra', 'areas_habilitadas'].forEach(k => delete d[k]);
    d.area_codigo = ses.area;
  }
  return null;
}

// Una sesión de jefa sigue valiendo solo si su equipo sigue autorizado y
// ella sigue siendo jefa de esa área.
function segJefaVigente(ses) {
  // v2.1: además de existir, la autorización del equipo debe estar vigente
  if (!ses.dispositivoId) return false;
  const raw = segProps().getProperty('PSES_' + ses.dispositivoId);
  if (!raw) return false;
  try { if (JSON.parse(raw).vence < Date.now()) return false; } catch (e) { return false; }
  return (segLeerJefas()[ses.area] || []).indexOf(String(ses.email).toLowerCase()) >= 0;
}

// ═══════════════════════════════════════════════════════════
//  Sesiones
// ═══════════════════════════════════════════════════════════

function segProps() { return PropertiesService.getScriptProperties(); }
function segCache() { return CacheService.getScriptCache(); }

function segSha(texto) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(texto), Utilities.Charset.UTF_8);
  return b.map(x => ((x + 256) % 256).toString(16).padStart(2, '0')).join('');
}
function segToken() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }

function segCrearSesion(datos, ms) {
  const token = segToken();
  const id = segSha(token).slice(0, 24);
  const ses = Object.assign({ id, creada: new Date().toISOString(), vence: Date.now() + ms }, datos);
  segProps().setProperty('PSES_' + id, JSON.stringify(ses));
  segLimpiarSesiones();
  return token;
}

function segLeerSesion(token) {
  if (!token || typeof token !== 'string' || token.length < 20) return null;
  const id = segSha(token).slice(0, 24);
  const raw = segProps().getProperty('PSES_' + id);
  if (!raw) return null;
  const ses = JSON.parse(raw);
  if (Date.now() > ses.vence) { segProps().deleteProperty('PSES_' + id); return null; }
  return ses;
}

function segLimpiarSesiones() {
  const todas = segProps().getProperties();
  Object.keys(todas).forEach(k => {
    if (k.indexOf('PSES_') !== 0) return;
    try { if (JSON.parse(todas[k]).vence < Date.now()) segProps().deleteProperty(k); }
    catch (e) { segProps().deleteProperty(k); }
  });
}

// ═══════════════════════════════════════════════════════════
//  Conexión con Asistencia (contraseña del dueño y PIN)
// ═══════════════════════════════════════════════════════════

function segAsistencia(action, datos) {
  const url = segProps().getProperty('ASISTENCIA_URL');
  const clave = segProps().getProperty('ASISTENCIA_CLAVE');
  if (!url || !clave) return { error: 'Falta conectar Producción con Asistencia (ver README, paso de configuración).', code: 'config' };
  const cuerpo = JSON.stringify(Object.assign({ action, servicio: 'produccion', claveServicio: clave }, datos || {}));
  let d;
  try {
    const r = UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: cuerpo, muteHttpExceptions: true });
    d = JSON.parse(r.getContentText());
    if (d && d.code === 'version') {
      d = JSON.parse(UrlFetchApp.fetch(url + '?p=' + encodeURIComponent(cuerpo), { muteHttpExceptions: true }).getContentText());
    }
  } catch (e) {
    return { error: 'No se pudo conectar con Asistencia. Intenta de nuevo en un momento.', code: 'conexion' };
  }
  return d || { error: 'Asistencia no respondió.' };
}

// Personas activas de Asistencia (caché 10 min).
function segPersonas(forzar) {
  if (!forzar) {
    const c = segCache().get('seg_personas');
    if (c) return JSON.parse(c);
  }
  const r = segAsistencia('srvPersonas');
  if (!r.success) return null;
  try { segCache().put('seg_personas', JSON.stringify(r.personas), 600); } catch (e) {}
  return r.personas;
}

// Jefas por área: { PAN: ['correo', ...], ... } guardado en la hoja Config.
// Si nunca se configuró, se toma de los correos de contacto de cada área.
function segLeerJefas() {
  const c = segCache().get('seg_jefas');
  if (c) return JSON.parse(c);
  const j = segLeerJefasHoja();
  try { segCache().put('seg_jefas', JSON.stringify(j), 120); } catch (e) {}
  return j;
}

function segLeerJefasHoja() {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Config');
  if (h && h.getLastRow() >= 2) {
    const vals = h.getRange(2, 1, h.getLastRow() - 1, 2).getValues();
    const fila = vals.find(r => r[0] === 'jefas_acceso');
    if (fila && fila[1]) { try { return JSON.parse(fila[1]); } catch (e) {} }
  }
  const correos = obtenerCorreosJefas();
  const jefas = {};
  Object.keys(SEG_AREAS).forEach(a => {
    jefas[a] = String(correos[a] || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
  });
  return jefas;
}

function segGuardarJefas(d) {
  const personas = segPersonas(true) || [];
  const validos = personas.map(p => p.email.toLowerCase());
  const jefas = {};
  Object.keys(SEG_AREAS).forEach(a => {
    jefas[a] = [].concat((d.jefas || {})[a] || []).map(x => String(x).trim().toLowerCase())
      .filter(x => validos.indexOf(x) >= 0);
  });
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Config');
  if (!h) { h = ss.insertSheet('Config'); h.appendRow(['clave', 'valor', 'descripcion']); }
  const claves = h.getLastRow() >= 2 ? h.getRange(2, 1, h.getLastRow() - 1, 1).getValues().flat() : [];
  const idx = claves.indexOf('jefas_acceso');
  const valor = JSON.stringify(jefas);
  if (idx >= 0) h.getRange(idx + 2, 2).setValue(valor);
  else h.appendRow(['jefas_acceso', valor, 'Quién entra a cada área con su PIN de Asistencia. Se edita en Administración → Seguridad.']);
  segCache().remove('seg_jefas');
  return { ok: true, jefas };
}

// Lista para la pantalla de entrada: por área, quiénes pueden entrar.
function segAreasConPersonas() {
  const personas = segPersonas() || [];
  const porEmail = {};
  personas.forEach(p => { porEmail[p.email.toLowerCase()] = p; });
  const jefas = segLeerJefas();
  return Object.keys(SEG_AREAS).map(a => ({
    codigo: a,
    nombre: SEG_AREAS[a],
    personas: (jefas[a] || []).map(e => porEmail[e]).filter(p => p && p.tienePin)
      .map(p => ({ email: p.email, nombre: p.nombre })),
  }));
}

// ═══════════════════════════════════════════════════════════
//  Acciones de acceso
// ═══════════════════════════════════════════════════════════

// Qué sabe este equipo: si está autorizado, si hay sesión de admin, y quién
// puede entrar a cada área (solo a equipos autorizados).
function segEstado(d) {
  const disp = segLeerSesion(d.dispositivo);
  const ses = segLeerSesion(d.sesion);
  const dispOk = !!(disp && disp.rol === 'dispositivo');
  const r = {
    ok: true,
    version: SEG_VERSION,
    dispositivo: dispOk ? { nombre: disp.nombre } : null,
    // v2.1: una sesión de jefa solo cuenta si sigue vigente (equipo autorizado y sigue siendo jefa del área)
    sesion: ses && (ses.rol === 'admin' || (ses.rol === 'jefa' && segJefaVigente(ses))) ? { rol: ses.rol, area: ses.area || null, nombre: ses.nombre || '' } : null,
  };
  if (dispOk || (ses && ses.rol === 'admin')) r.areas = segAreasConPersonas();
  return r;
}

function segVerificarDueno(password) {
  if (typeof password !== 'string' || !password) return { error: 'Escribe la contraseña.' };
  return segAsistencia('srvVerificarAdmin', { password });
}

function segLoginAdmin(d) {
  const v = segVerificarDueno(d.password);
  if (!v.success) return { ok: false, msg: v.error || 'Clave incorrecta.', code: v.code || 'clave' };
  const nombre = String(d.nombreDispositivo || 'Equipo de administración').slice(0, 40);
  return {
    ok: true,
    token: segCrearSesion({ rol: 'admin', nombre }, SEG_SESION_ADMIN_DIAS * 86400000),
    // Entrar como admin también deja autorizado el equipo para las jefas.
    dispositivo: segLeerSesion(d.dispositivo) ? null : segCrearSesion({ rol: 'dispositivo', nombre }, SEG_DISPOSITIVO_DIAS * 86400000),
  };
}

function segAutorizarDispositivo(d) {
  const v = segVerificarDueno(d.password);
  if (!v.success) return { ok: false, msg: v.error || 'Clave incorrecta.', code: v.code || 'clave' };
  const nombre = String(d.nombreDispositivo || 'Equipo de cocina').slice(0, 40);
  return { ok: true, dispositivo: segCrearSesion({ rol: 'dispositivo', nombre }, SEG_DISPOSITIVO_DIAS * 86400000) };
}

function segLoginJefa(d) {
  const disp = segLeerSesion(d.dispositivo);
  if (!disp || disp.rol !== 'dispositivo') return { ok: false, code: 'dispositivo', msg: 'Este equipo no está autorizado.' };
  const area = String(d.area || '');
  if (!SEG_AREAS[area]) return { ok: false, msg: 'Área no válida.' };
  const email = String(d.email || '').toLowerCase();
  if ((segLeerJefas()[area] || []).indexOf(email) < 0) return { ok: false, msg: 'Esa persona no tiene acceso a ' + SEG_AREAS[area] + '.' };
  // Asistencia busca el correo tal como está escrito en su planilla (mayúsculas incluidas).
  const persona = (segPersonas() || []).find(x => x.email.toLowerCase() === email);
  const v = segAsistencia('srvVerificarPin', { email: persona ? persona.email : email, pin: String(d.pin || '') });
  if (!v.success) return { ok: false, msg: v.error || 'PIN incorrecto', code: v.code || 'pin' };
  const token = segCrearSesion({ rol: 'jefa', area, email, nombre: v.nombre, dispositivoId: disp.id, dispositivoNombre: disp.nombre },
                               SEG_SESION_JEFA_HORAS * 3600000);
  return { ok: true, token, nombre: v.nombre, area };
}

function segLogout(d) {
  const ses = segLeerSesion(d.sesion || d.token);
  if (ses) segProps().deleteProperty('PSES_' + ses.id);
  return { ok: true };
}

// Para la sección Administración → Seguridad.
function segDatosSeguridad(d, ses) {
  const todas = segProps().getProperties();
  const sesiones = Object.keys(todas).filter(k => k.indexOf('PSES_') === 0).map(k => JSON.parse(todas[k]))
    .filter(s => s.vence > Date.now())
    .map(s => ({ id: s.id, rol: s.rol, nombre: s.rol === 'jefa' ? s.nombre + ' · ' + (SEG_AREAS[s.area] || s.area) + ' · ' + (s.dispositivoNombre || '') : s.nombre,
                 creada: s.creada, vence: new Date(s.vence).toISOString(), esta: s.id === ses.id }))
    .sort((a, b) => a.creada < b.creada ? 1 : -1);
  const personas = segPersonas(true);
  return {
    ok: true,
    version: SEG_VERSION,
    asistencia: personas ? 'conectada' : 'sin conexión',
    personas: personas || [],
    jefas: segLeerJefas(),
    areas: SEG_AREAS,
    sesiones,
  };
}

function segRevocar(d) {
  if (!/^[0-9a-f]{24}$/.test(String(d.id || ''))) return { ok: false, msg: 'Sesión inválida' };
  segProps().deleteProperty('PSES_' + d.id);
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════
//  Lectura de hojas (reemplaza la planilla publicada)
// ═══════════════════════════════════════════════════════════

function segLeerHoja(d, ses) {
  const nombre = String(d.hoja || '');
  const permitida = SEG_HOJAS_JEFA.test(nombre) || (ses.rol === 'admin' && SEG_HOJAS_ADMIN_EXTRA.test(nombre));
  if (!permitida) return { ok: false, code: 'permiso', msg: 'No tienes acceso a la hoja ' + nombre };
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nombre);
  if (!h || h.getLastRow() < 1) return { ok: true, headers: [], filas: [] };
  // Valores tal como se ven en la planilla: es lo mismo que entregaba la
  // planilla publicada, así la app los interpreta igual que antes.
  const vals = h.getRange(1, 1, h.getLastRow(), Math.max(h.getLastColumn(), 1)).getDisplayValues();
  let headers = vals[0].map(String);
  let filas = vals.slice(1);
  if (ses.rol === 'jefa') {
    const visibles = headers.map((x, i) => SEG_COSTO_RE.test(x) ? -1 : i).filter(i => i >= 0);
    const json = visibles.filter(i => /_JSON$/.test(headers[i]));
    filas = filas.map(f => visibles.map(i => json.indexOf(i) >= 0 ? segLimpiarJson(f[i]) : f[i]));
    headers = visibles.map(i => headers[i]);
  }
  return { ok: true, headers, filas };
}

function segLimpiarJson(texto) {
  if (!texto) return texto;
  try { return JSON.stringify(segOcultarCostos(JSON.parse(texto))); } catch (e) { return texto; }
}

// Quita costos y precios de cualquier respuesta que va a una jefa.
function segOcultarCostos(v) {
  if (Array.isArray(v)) return v.map(segOcultarCostos);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const o = {};
    Object.keys(v).forEach(k => {
      if (SEG_COSTO_RE.test(k)) return;
      o[k] = /_JSON$/.test(k) && typeof v[k] === 'string' ? segLimpiarJson(v[k]) : segOcultarCostos(v[k]);
    });
    return o;
  }
  return v;
}

// ═══════════════════════════════════════════════════════════
//  Costos calculados en el servidor
// ═══════════════════════════════════════════════════════════

function segMapaMP() {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('MP_maestro');
  const mapa = {};
  if (!h || h.getLastRow() < 2) return mapa;
  const vals = h.getDataRange().getValues();
  const hd = vals[0];
  const iId = hd.indexOf('ID_MP'), iC = hd.indexOf('costo_por_gramo'), iT = hd.indexOf('tipo');
  vals.slice(1).forEach(r => { if (r[iId]) mapa[r[iId]] = { cpg: parseFloat(r[iC]) || 0, tipo: r[iT] }; });
  return mapa;
}

function segNum(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

// Mismo cálculo que hacía la app en el navegador (guardarReceta en app.js),
// pero con los costos de MP_maestro, que la jefa ya no recibe.
function segRecostearReceta(d) {
  const mp = segMapaMP();
  const costoIng = ing => {
    if (ing.pendiente || ing.id === '__pendiente__') return 0;
    const m = mp[ing.id];
    if (!m) return 0;
    if (ing.esperando_habilitacion) return m.cpg * (segNum(ing.gramos) || segNum(ing.unidades) || segNum(ing.ml));
    const enUnidades = ing.unidades !== null && ing.unidades !== undefined && ing.unidades !== '';
    if (enUnidades && m.tipo === 'sub_receta') return m.cpg * segNum(ing.unidades);
    return m.cpg * segNum(ing.gramos);
  };
  const costoIns = ins => {
    if (ins.pendiente || ins.id === '__pendiente__') return 0;
    const m = mp[ins.id];
    return m ? m.cpg * segNum(ins.unidades) : 0;
  };
  ['ingredientes_JSON', 'insumos_JSON'].forEach(campo => {
    if (typeof d[campo] !== 'string') return;
    try {
      const lista = JSON.parse(d[campo]);
      d[campo] = JSON.stringify(lista.map(x => Object.assign({}, x, { costo: campo === 'ingredientes_JSON' ? costoIng(x) : costoIns(x) })));
    } catch (e) {}
  });
}

// Estado actual de una receta ('' si no existe; 'existe' en hojas sin columna estado).
function segEstadoActualReceta(hoja, id) {
  const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(hoja);
  if (!h || h.getLastRow() < 2 || !id) return '';
  const vals = h.getDataRange().getValues();
  const iE = vals[0].indexOf('estado');
  const fila = vals.slice(1).find(r => r[0] === id);
  if (!fila) return '';
  return iE >= 0 ? String(fila[iE] || 'sin_estado') : 'existe';
}

// La merma se valoriza aquí: receta = costo directo unitario del maestro;
// MP = costo por gramo/unidad de MP_maestro.
function segValorizarMerma(d) {
  const r = d.registro;
  if (!r) return;
  const cantidad = segNum(r.cantidad);
  let unit = null;
  if (r.tipo_perdida === 'receta') {
    const h = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Maestro_recetas');
    if (h && h.getLastRow() >= 2) {
      const vals = h.getDataRange().getValues();
      const hd = vals[0];
      const fila = vals.slice(1).find(x => x[hd.indexOf('ID_receta')] === r.item_id);
      if (fila) unit = segNum(fila[hd.indexOf('costo_MP_unitario')]) + segNum(fila[hd.indexOf('costo_insumos_unitario')]);
    }
  } else {
    const m = segMapaMP()[r.item_id];
    if (m) unit = m.cpg;
  }
  r.costo_calculado = unit === null ? 0 : unit * cantidad;
}

// ═══════════════════════════════════════════════════════════
//  INSTALACIÓN — ejecutar desde el editor (Ejecutar ▸ instalarSeguridad)
// ═══════════════════════════════════════════════════════════
//  Revisa que Producción pueda hablar con Asistencia y muestra quién quedó
//  como jefa de cada área. Se puede ejecutar las veces que quieras.
function instalarSeguridad() {
  const url = segProps().getProperty('ASISTENCIA_URL');
  const clave = segProps().getProperty('ASISTENCIA_CLAVE');
  if (!url || !clave) {
    Logger.log('FALTA CONFIGURAR: en Configuración del proyecto ▸ Propiedades del script, agrega ASISTENCIA_URL y ASISTENCIA_CLAVE (ver README).');
    return { ok: false };
  }
  const ping = segAsistencia('srvPing');
  if (!ping.success) {
    Logger.log('No se pudo conectar con Asistencia: ' + (ping.error || JSON.stringify(ping)));
    Logger.log('Revisa que Asistencia esté en v5.1.0 y que ASISTENCIA_CLAVE sea la que entregó crearClaveServicioProduccion().');
    return { ok: false, error: ping.error };
  }
  Logger.log('Conexión con Asistencia OK (v' + ping.version + ').');
  const areas = segAreasConPersonas();
  areas.forEach(a => Logger.log(a.nombre + ': ' + (a.personas.length ? a.personas.map(p => p.nombre).join(', ') : 'sin jefa asignada (entra Administración)')));
  Logger.log('Seguridad de Producción v' + SEG_VERSION + ' lista.');
  return { ok: true, areas };
}
