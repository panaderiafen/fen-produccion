// ═══════════════════════════════════════════════════════════
//  fën producción — Apps Script · Code.gs  v2.0.0  (2026-10-01)
//  Funciones de la app (recetas, MP, planificación, costeo...).
//
//  v2.0.0: doPost y doGet se movieron a Seguridad.gs (archivo nuevo, va en
//  el mismo proyecto). Este archivo ya no recibe llamadas directamente:
//  Seguridad.gs revisa sesión y permisos y llama a ejecutarAccionLegada().
//  Los correos salen con MailApp (permiso más acotado que GmailApp).
//  El resto del código es el mismo de v1.
//
//  Publicar como: Aplicación web · Ejecutar como: Yo · Acceso: Cualquier persona
//  (la seguridad la pone Seguridad.gs: nada funciona sin sesión).
// ═══════════════════════════════════════════════════════════

// Todas las acciones de la app (antes repartidas entre doPost y doGet, que
// tenían listas distintas). Ahora doPost/doGet viven en Seguridad.gs: revisan
// la sesión y el permiso, y recién entonces llaman a esta función.
function ejecutarAccionLegada(accion, datos) {
  let resultado;
  switch (accion) {
    case 'guardar_receta':                               resultado = guardarReceta(datos);           break;
    case 'cambiar_estado':                               resultado = cambiarEstado(datos);           break;
    case 'aprobar_receta':                               resultado = aprobarReceta(datos);           break;
    case 'guardar_planificacion':                        resultado = guardarPlanificacion(datos);    break;
    case 'solicitar_mp':                                 resultado = solicitarMP(datos);             break;
    case 'editar_mp':                                    resultado = editarMP(datos);                break;
    case 'editar_campo_receta':                          resultado = editarCampoReceta(datos);       break;
    case 'editar_campo_mp':                              resultado = editarCampoMP(datos);           break;
    case 'registrar_llegada_stock_mp':                   resultado = registrarLlegadaStockMP(datos); break;
    case 'leer_movimientos_stock_mp':                    resultado = leerMovimientosStockMP(datos); break;
    case 'leer_plan_masas_bol':                          resultado = leerPlanMasasBOL(datos);       break;
    case 'guardar_plan_masas_bol':                       resultado = guardarPlanMasasBOL(datos);   break;
    case 'editar_config':                                resultado = editarConfig(datos);            break;
    case 'leer_config':                                  resultado = leerConfig(datos);              break;
    case 'eliminar_receta':                              resultado = eliminarReceta(datos);          break;
    case 'reemplazar_mp_receta':                         resultado = reemplazarMPEnReceta(datos);    break;
    case 'fusionar_mp':                                  resultado = fusionarMP(datos);              break;
    case 'renombrar_mp':                                 resultado = renombrarMP(datos);             break;
    case 'buscar_recetas_usando_mp':                     resultado = buscarRecetasUsandoMP(datos); break;
    case 'auditar_costos_recetas':                       resultado = auditarCostosRecetas();      break;
    case 'sincronizar_lista_publica':                    sincronizarListaPublicaProductos(); resultado = { ok: true, msg: 'Lista pública sincronizada' }; break;
    case 'leer_correos_jefas':                           resultado = { ok: true, correos: obtenerCorreosJefas() }; break;
    case 'guardar_correos_jefas':                        resultado = guardarCorreosJefas(datos);     break;
    case 'leer_urls_ventas_csv':                         resultado = { ok: true, urls: obtenerUrlsVentasCSV() }; break;
    case 'guardar_urls_ventas_csv':                      resultado = guardarUrlsVentasCSV(datos);   break;
    case 'sincronizar_ventas_mensuales':                 resultado = sincronizarVentasMensuales(); break;
    case 'leer_ventas_mensuales':                        resultado = { ok: true, ventas: leerVentasMensualesConsolidadas() }; break;
    case 'solicitar_habilitacion_mp':                    resultado = solicitarHabilitacionMP(datos); break;
    case 'leer_solicitudes_habilitacion':                resultado = { ok: true, solicitudes: leerSolicitudesHabilitacion() }; break;
    case 'resolver_solicitud_habilitacion':              resultado = resolverSolicitudHabilitacion(datos); break;
    case 'crear_producto_reventa':                       resultado = crearProductoReventa(datos); break;
    case 'editar_producto_reventa':                      resultado = editarProductoReventa(datos); break;
    case 'ajustar_stock_reventa':                        resultado = ajustarStockReventa(datos); break;
    case 'leer_productos_reventa':                       resultado = { ok: true, productos: leerProductosReventa() }; break;
    case 'leer_plan_rellenos':                           resultado = leerPlanRellenos();          break;
    case 'guardar_plan_relleno':                         resultado = guardarPlanRelleno(datos);   break;
    case 'leer_plan_ps_pc':                              resultado = leerPlanPSPC();              break;
    case 'guardar_entrada_plan_ps_pc':                   resultado = guardarEntradaPlanPSPC(datos); break;
    case 'eliminar_entrada_plan_ps_pc':                  resultado = eliminarEntradaPlanPSPC(datos); break;
    case 'leer_plan_masa_base':                          resultado = leerPlanMasaBase();          break;
    case 'guardar_entrada_plan_masa_base':               resultado = guardarEntradaPlanMasaBase(datos); break;
    case 'eliminar_entrada_plan_masa_base':              resultado = eliminarEntradaPlanMasaBase(datos); break;
    case 'guardar_celda_plan_masa_base':                 resultado = guardarCeldaPlanMasaBase(datos); break;
    case 'guardar_celda_plan_descongelacion_masa':       resultado = guardarCeldaPlanDescongelacionMasa(datos); break;
    case 'leer_plan_descongelacion_masa':                resultado = leerPlanDescongelacionMasa(); break;
    case 'guardar_tandas_subreceta_masa_base':           resultado = guardarTandasSubRecetaMasaBase(datos); break;
    case 'leer_tandas_subreceta_masa_base':              resultado = leerTandasSubRecetaMasaBase(); break;
    case 'guardar_celda_plan_congelacion_productos':     resultado = guardarCeldaPlanCongelacionProductos(datos); break;
    case 'leer_plan_congelacion_productos':              resultado = leerPlanCongelacionProductos(); break;
    case 'guardar_celda_plan_descongelacion_productos':  resultado = guardarCeldaPlanDescongelacionProductos(datos); break;
    case 'leer_plan_descongelacion_productos':           resultado = leerPlanDescongelacionProductos(); break;
    case 'guardar_stock_inicial_productos':              resultado = guardarStockInicialProductosSheet(datos); break;
    case 'leer_stock_inicial_productos':                 resultado = leerStockInicialProductosSheet(); break;
    case 'guardar_stock_inicial_masa':                   resultado = guardarStockInicialMasaSheet(datos); break;
    case 'leer_stock_inicial_masa':                      resultado = leerStockInicialMasaSheet(); break;
    case 'actualizar_tandas_plan_masa_base':             resultado = actualizarTandasPlanMasaBase(datos); break;
    case 'guardar_tarea_bol':                            resultado = guardarTareaBOL(datos);         break;
    case 'leer_tareas_bol':                              resultado = leerTareasBOL(datos);           break;
    case 'leer_consolidado':                             resultado = leerConsolidado(datos);         break;
    case 'guardar_consolidado':                          resultado = guardarConsolidadoManual(datos); break;
    case 'leer_stock_caf':                               resultado = leerStockCAF(datos);            break;
    case 'mov_stock_caf':                                resultado = movimientoStockCAF(datos);      break;
    case 'crear_aviso':                                  crearAviso(datos.area_codigo, datos.tipo, datos.mensaje, datos.mp_id); resultado = {ok:true}; break;
    case 'leer_avisos':                                  resultado = leerAvisos(datos);              break;
    case 'guardar_registro_merma':                       resultado = guardarRegistroMerma(datos);   break;
    case 'leer_registro_merma':                          resultado = leerRegistroMerma(datos);      break;
    case 'leer_gastos_area':                             resultado = leerGastosPorArea(datos);      break;
    case 'leer_gastos_area_prorrateo':                   resultado = leerGastosPorAreaConProrrateo(datos); break;
    case 'leer_resumen_ventas_mes':                      resultado = { ok: true, ...calcularParticipacionVentasPorArea(datos.mes) }; break;
    case 'crear_inversion':                              resultado = crearInversion(datos);         break;
    case 'editar_inversion':                             resultado = editarInversion(datos);        break;
    case 'leer_inversiones':                             resultado = { ok: true, inversiones: leerInversiones() }; break;
    case 'leer_config_costeo':                           resultado = leerConfigCosteo(datos);       break;
    case 'guardar_config_costeo':                        resultado = guardarConfigCosteo(datos);    break;
    case 'calcular_ec':                                  resultado = calcularEC(datos);            break;
    case 'generar_informe_auditoria':                    resultado = generarInformeAuditoria(datos); break;
    case 'guardar_verificacion_ventas_externa':          resultado = guardarVerificacionVentasExterna(datos); break;
    case 'leer_ventas_total_b2b_externo':                resultado = leerVentasTotalB2BExterno(); break;
    case 'leer_ventas_total_b2c_externo':                resultado = leerVentasTotalB2CExterno(); break;
    case 'sincronizar_cobros_b2b':                       resultado = sincronizarCobrosB2B(); break;
    case 'leer_verificacion_ventas_externa':             resultado = leerVerificacionVentasExterna(); break;
    case 'generar_informe_general':                      resultado = generarInformeGeneral(datos); break;
    case 'calcular_meta_venta':                          resultado = calcularMetaVenta(datos); break;
    case 'eliminar_config_costeo_fila':                  resultado = eliminarConfigCosteoFila(datos); break;
    case 'eliminar_ec_por_area':                         resultado = eliminarECPorArea(datos);      break;
    case 'eliminar_mp':                                  resultado = eliminarMP(datos);              break;
    case 'leer_plan_b2cb2b_bol':                         resultado = leerPlanB2CB2BBOL(datos);       break;
    case 'leer_baristas_caf':                            resultado = leerBaristasCaf(datos);         break;
    case 'guardar_baristas_caf':                         resultado = guardarBaristasCaf(datos);      break;
    case 'leer_registros_caf':                           resultado = leerRegistrosCAF(datos);        break;
    case 'guardar_registro_caf':                         resultado = guardarRegistroCAF(datos);      break;
    case 'guardar_plan_b2cb2b_bol':                      resultado = guardarPlanB2CB2BBOL(datos);    break;
    case 'marcar_aviso_leido':                           resultado = marcarAvisoLeido(datos);        break;
    default: resultado = { ok: false, msg: 'Accion no reconocida: ' + accion };
  }
  return resultado;
}

// ── BOL TAREAS ───────────────────────────────────────────────
function guardarTareaBOL(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_tareas');
  if (!h) {
    h = ss.insertSheet('BOL_tareas');
    h.getRange(1,1,1,9).setValues([['fecha','semana_ID','dia','tipo_tarea','subtarea','cantidad','estado','hora','dispositivo']]);
  }

  const semana  = datos.semana_ID;
  const dia     = datos.dia;
  const tipo    = datos.tipo_tarea;
  // Usar fecha local del dispositivo (no UTC para evitar problemas de zona horaria)
  const ahora   = new Date();
  const offset  = ahora.getTimezoneOffset() * 60000;
  const local   = new Date(ahora - offset);
  const fecha   = datos.fecha_local || local.toISOString().slice(0,10);
  const hora    = ahora.toLocaleTimeString('es-CL');

  // Buscar fila existente
  const lastRow = h.getLastRow();
  if (lastRow > 1) {
    const vals = h.getRange(2, 1, lastRow-1, 9).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][1] === semana && String(vals[i][2]) === String(dia) && vals[i][3] === tipo) {
        h.getRange(i+2, 1, 1, 9).setValues([[fecha, semana, dia, tipo, datos.subtarea||'', datos.cantidad||0, datos.estado||'0', hora, datos.dispositivo||'']]);
        return { ok: true, msg: 'Tarea actualizada' };
      }
    }
  }

  // Nueva fila
  h.appendRow([fecha, semana, dia, tipo, datos.subtarea||'', datos.cantidad||0, datos.estado||'0', hora, datos.dispositivo||'']);
  return { ok: true, msg: 'Tarea guardada' };
}

function leerTareasBOL(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('BOL_tareas');
  if (!h || h.getLastRow() < 2) return { ok: true, tareas: [] };

  const numCols = h.getLastColumn();
  const headers = h.getRange(1, 1, 1, numCols).getValues()[0];
  const vals    = h.getRange(2, 1, h.getLastRow()-1, numCols).getValues();

  const semIdx = headers.indexOf('semana_ID');
  const diaIdx = headers.indexOf('dia');

  const tareas = vals
    .filter(r => r[semIdx] === datos.semana_ID && String(r[diaIdx]) === String(datos.dia))
    .map(r => {
      const obj = {};
      headers.forEach((col, i) => { obj[col] = r[i]; });
      obj.estado = String(obj.estado || '0');
      return obj;
    });

  return { ok: true, tareas };
}

// ── CONSOLIDADO MENSUAL ──────────────────────────────────────
function leerConsolidado(datos) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('Consolidado_mensual');
  if (!hoja || hoja.getLastRow() < 2) return { ok: true, filas: [] };

  const vals = hoja.getRange(2, 1, hoja.getLastRow()-1, 15).getValues();
  const filas = vals
    .filter(r => {
      const añoOk  = !datos.año  || String(r[1]) === String(datos.año);
      const mesOk  = !datos.mes  || String(r[2]) === String(datos.mes);
      const areaOk = !datos.area || r[4] === datos.area;
      return añoOk && mesOk && areaOk && r[3];
    })
    .map(r => ({
      fecha: r[0], año: r[1], mes: r[2], semana_ID: r[3],
      area: r[4], tipo: r[5], nombre: r[6],
      dias: r.slice(7,14), total: r[14]
    }));
  return { ok: true, filas };
}

function guardarConsolidadoManual(datos) {
  // Permite guardar desde la app manualmente
  try {
    guardarConsolidadoSemanal();
    return { ok: true, msg: 'Consolidado guardado' };
  } catch(e) {
    return { ok: false, msg: e.toString() };
  }
}

// ── STOCK CAFETERÍA ───────────────────────────────────────────
function leerStockCAF(datos) {
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName('CAF_stock');
  if (!hoja || hoja.getLastRow() < 2) return { ok: true, movimientos: [] };

  const vals = hoja.getRange(2, 1, hoja.getLastRow()-1, 7).getValues();
  const movimientos = vals.map(r => ({
    fecha: r[0], mp_id: r[1], nombre: r[2], tipo: r[3],
    cantidad: r[4], nota: r[5], barista: r[6]
  })).filter(m => m.mp_id);

  return { ok: true, movimientos };
}

function movimientoStockCAF(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('CAF_stock');
  if (!h) {
    h = ss.insertSheet('CAF_stock');
    h.getRange(1,1,1,7).setValues([['fecha','mp_id','nombre','tipo','cantidad','nota','barista']])
      .setBackground('#B71C1C').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }

  const fecha = new Date().toISOString().slice(0,10) + ' ' + new Date().toLocaleTimeString('es-CL');
  h.appendRow([fecha, datos.mp_id, datos.nombre, datos.tipo, datos.cantidad, datos.nota||'', datos.barista||'']);

  return { ok: true, msg: 'Movimiento registrado' };
}

// ── ELIMINAR RECETA ──────────────────────────────────────────
function eliminarReceta(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName(datos.hoja);
  if (!h) return { ok: false, msg: 'Hoja no encontrada: ' + datos.hoja };

  const ids = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
  const idx = ids.indexOf(datos.ID_receta);
  if (idx < 1) return { ok: false, msg: 'Receta no encontrada: ' + datos.ID_receta };

  const maestro = ss.getSheetByName('Maestro_recetas');
  let mIdx = -1;
  if (maestro && maestro.getLastRow() > 1) {
    const mIds = maestro.getRange(1, 1, maestro.getLastRow(), 1).getValues().flat();
    mIdx = mIds.indexOf(datos.ID_receta);
  }

  if (mIdx > 0) {
    // Ya fue publicada al menos una vez (existe en Maestro_recetas) — nunca se borra
    // físicamente, porque B2B/B2C pueden tener su ID_receta anclado con ID_receta_fen.
    // Se marca "descontinuada" en su lugar: sale de Lista_publica_productos, pero el
    // ID sigue siendo consultable/trazable. Sí se elimina de la hoja de área, porque
    // ahí ya no se trabaja activamente sobre ella.
    let headersM = maestro.getRange(1, 1, 1, maestro.getLastColumn()).getValues()[0];
    let idxDesc = headersM.indexOf('descontinuada');
    if (idxDesc < 0) {
      idxDesc = headersM.length;
      maestro.getRange(1, idxDesc + 1).setValue('descontinuada')
        .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    }
    maestro.getRange(mIdx + 1, idxDesc + 1).setValue('si');
    h.deleteRow(idx + 1);
    sincronizarListaPublicaProductos();
    return {
      ok: true,
      msg: 'Receta descontinuada — ya no aparece en el listado público, pero su ID se conserva por trazabilidad con B2B/B2C'
    };
  }

  // Nunca fue aprobada (no existe en Maestro_recetas) — no hay ancla externa que
  // romper, se puede eliminar de verdad.
  h.deleteRow(idx + 1);
  return { ok: true, msg: 'Receta eliminada: ' + datos.ID_receta };
}

// ── ELIMINAR MP ──────────────────────────────────────────────
function eliminarMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('MP_maestro');
  if (!h) return { ok: false, msg: 'Hoja MP_maestro no encontrada' };
  if (h.getLastRow() < 2) return { ok: false, msg: 'Sin datos en Maestro_MP' };

  const numCols = h.getLastColumn();
  const headers = h.getRange(1, 1, 1, numCols).getValues()[0];
  const idIdx   = headers.indexOf('ID_MP');
  if (idIdx < 0) return { ok: false, msg: 'Columna ID_MP no encontrada' };

  // Read only the ID_MP column (idIdx+1 is 1-based column number)
  const idCol = h.getRange(2, idIdx+1, h.getLastRow()-1, 1).getValues().flat();
  const rowOffset = idCol.indexOf(datos.ID_MP);
  
  Logger.log('eliminarMP: buscando ' + datos.ID_MP + ' en ' + idCol.length + ' filas');
  
  if (rowOffset < 0) return { ok: false, msg: 'MP no encontrada: ' + datos.ID_MP };
  h.deleteRow(rowOffset + 2); // +2 for header row and 0-index
  Logger.log('eliminarMP: eliminada fila ' + (rowOffset + 2));
  return { ok: true, msg: 'MP eliminada: ' + datos.ID_MP };
}

// ── EDITAR CONFIG ────────────────────────────────────────────
function leerConfig(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Config');
  if (!h || h.getLastRow() < 2) return { ok: true, valor: null };
  const claves = h.getRange(2, 1, h.getLastRow()-1, 1).getValues().flat();
  const idx = claves.indexOf(datos.clave);
  if (idx < 0) return { ok: true, valor: null };
  const valor = h.getRange(idx + 2, 2).getValue();
  return { ok: true, valor: valor };
}

function editarConfig(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Config');
  if (!h) return { ok: false, msg: 'Hoja Config no encontrada' };

  const claves = h.getRange(2, 1, h.getLastRow()-1, 1).getValues().flat();
  const idx    = claves.indexOf(datos.clave);
  if (idx >= 0) {
    h.getRange(idx + 2, 2).setValue(datos.valor);
    return { ok: true, msg: 'Config actualizada' };
  }
  // Si no existe la clave, agregarla
  h.appendRow([datos.clave, datos.valor, 'Generado por app']);
  return { ok: true, msg: 'Config creada' };
}

function respuesta(datos) {
  return ContentService
    .createTextOutput(JSON.stringify(datos))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── GUARDAR O EDITAR RECETA ──────────────────────────────────
function guardarReceta(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName(datos.hoja);
  if (!h) return { ok: false, msg: 'Hoja no encontrada: ' + datos.hoja };

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const fila = headers.map(col => datos[col] !== undefined ? datos[col] : '');

  if (datos.esEdicion) {
    // Buscar fila por ID y sobreescribir
    const ids = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
    const idx = ids.indexOf(datos.ID_receta);
    if (idx > 0) {
      h.getRange(idx + 1, 1, 1, fila.length).setValues([fila]);
      return { ok: true, msg: 'Receta actualizada', id: datos.ID_receta };
    }
  }

  // Nueva receta — agregar fila
  h.appendRow(fila);
  return { ok: true, msg: 'Receta guardada', id: datos.ID_receta };
}


// ── CAMBIAR ESTADO ───────────────────────────────────────────
function cambiarEstado(datos) {
  // Email notification when recipe sent for review
  if (datos.estado === 'pendiente_aprobación' || datos.estado === 'pendiente_aprobacion') {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const area = datos.area_codigo || '';
      const hojaRecetas = area + '_recetas';
      const h = ss.getSheetByName(hojaRecetas);
      let nombreReceta = datos.ID_receta || 'Receta';
      if (h) {
        const vals = h.getDataRange().getValues();
        const headers = vals[0];
        const idIdx = headers.indexOf('ID_receta');
        const nomIdx = headers.indexOf('nombre');
        const fila = vals.slice(1).find(r => r[idIdx] === datos.ID_receta);
        if (fila) nombreReceta = fila[nomIdx] || nombreReceta;
      }
      enviarNotificacionAdmin(
        'Receta enviada a revisión — ' + nombreReceta,
        'Área: ' + area + '\n' +
        'Receta: ' + nombreReceta + '\n' +
        'ID: ' + datos.ID_receta + '\n\n' +
        'Revisa en fën → Aprobaciones'
      );
    } catch(e) {
      Logger.log('Error notificando revision: ' + e.message);
    }
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName(datos.hoja);
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const colEstado = headers.indexOf('estado') + 1;
  const colFecha  = headers.indexOf('fecha_consolidación') + 1;

  const ids = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
  const idx = ids.indexOf(datos.ID_receta);
  if (idx < 1) return { ok: false, msg: 'Receta no encontrada: ' + datos.ID_receta };

  if (colEstado > 0) h.getRange(idx + 1, colEstado).setValue(datos.estado);
  return { ok: true, msg: 'Estado actualizado a: ' + datos.estado };
}


// ── APROBAR RECETA ───────────────────────────────────────────
function aprobarReceta(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName(datos.hoja);
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };

  const headers  = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const ids      = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
  const idx      = ids.indexOf(datos.ID_receta);
  if (idx < 1) return { ok: false, msg: 'Receta no encontrada' };

  // Cambiar estado en hoja de área
  const colEstado   = headers.indexOf('estado') + 1;
  const colAprobada = headers.indexOf('aprobada_por') + 1;
  const colFecha    = headers.indexOf('fecha_consolidación') + 1;
  const hoy = new Date();

  if (colEstado   > 0) h.getRange(idx + 1, colEstado).setValue('consolidada');
  if (colAprobada > 0) h.getRange(idx + 1, colAprobada).setValue(datos.aprobada_por || 'Admin');
  if (colFecha    > 0) h.getRange(idx + 1, colFecha).setValue(hoy);

  // Leer fila completa para copiar al maestro
  const filaData = h.getRange(idx + 1, 1, 1, h.getLastColumn()).getValues()[0];
  const receta = {};
  headers.forEach((col, i) => receta[col] = filaData[i]);

  // Calcular costo MP unitario
  let costoMP = 0;
  const porciones = parseInt(receta.porciones_base) || 1;
  try {
    const ingredientes = JSON.parse(receta.ingredientes_JSON || '[]');
    costoMP = ingredientes.reduce((s, i) => s + (parseFloat(i.costo) || 0), 0);
    costoMP = costoMP / porciones;
  } catch(e) {}

  // Calcular costo de insumos unitario (vasos, tapas, packaging, etiquetas, etc.)
  let costoInsumos = 0;
  try {
    const insumos = JSON.parse(receta.insumos_JSON || '[]');
    costoInsumos = insumos.reduce((s, i) => s + (parseFloat(i.costo) || 0), 0);
    costoInsumos = costoInsumos / porciones;
  } catch(e) {}

  // Verificar si es sub receta o receta normal
  const tipoReceta = receta['tipo_receta'] || 'receta';

  if (tipoReceta === 'sub_receta') {
    // Agregar a MP_maestro como sub_receta
    const mp = ss.getSheetByName('MP_maestro');
    if (mp) {
      const mpHeaders = mp.getRange(1, 1, 1, mp.getLastColumn()).getValues()[0];
      const idxOrigen = mpHeaders.indexOf('receta_id_origen');
      const nombreReceta = receta['nombre'] || '';
      const filasExistentes = mp.getLastRow() > 1
        ? mp.getRange(2, 1, mp.getLastRow()-1, mpHeaders.length).getValues()
        : [];

      // Buscar por el ID REAL de la receta primero (estable, nunca cambia aunque
      // se renombre) — el nombre es solo respaldo, para filas viejas de antes de
      // que existiera receta_id_origen. Buscar solo por nombre causaba que
      // renombrar una sub-receta creara una fila nueva en vez de actualizar la
      // existente (el nombre viejo ya no calzaba con el nuevo).
      let existeIdx = idxOrigen > -1 ? filasExistentes.findIndex(r => r[idxOrigen] === datos.ID_receta) : -1;
      if (existeIdx < 0) existeIdx = filasExistentes.findIndex(r => r[1] === nombreReceta); // columna B = nombre

      // Generar ID SR### — timestamp+aleatorio para que sea imposible de colisionar
      // (antes contaba cuántos SR había y sumaba 1, lo que podía repetir un ID ya usado)
      const nuevoId = 'SR' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2,4).toUpperCase();

      // Determinar área de origen desde la hoja
      const areaOrigen = datos.hoja ? datos.hoja.replace('_recetas','') : '';

      const filaMP = mpHeaders.map(col => {
        if (col === 'ID_MP') return existeIdx >= 0 ? filasExistentes[existeIdx][0] : nuevoId;
        if (col === 'nombre') return nombreReceta;
        if (col === 'categoría') return 'Sub recetas';
        if (col === 'tipo') return 'sub_receta';
        if (col === 'costo_por_gramo') return costoMP;
        if (col === 'estado') return 'activa';
        if (col === 'areas_habilitadas') return areaOrigen;
        if (col === 'receta_id_origen') return datos.ID_receta;
        return '';
      });

      if (existeIdx >= 0) {
        mp.getRange(existeIdx + 2, 1, 1, filaMP.length).setValues([filaMP]);
      } else {
        mp.appendRow(filaMP);
      }
    }
    // No hay return acá — las sub-recetas también deben quedar en Maestro_recetas,
    // igual que las recetas normales, para no perder su trazabilidad de costeo.
  }

  // Escribir en Maestro_recetas — aplica tanto a recetas normales como a sub-recetas
  const maestro = ss.getSheetByName('Maestro_recetas');
  if (maestro) {
    const mHeaders = maestro.getRange(1, 1, 1, maestro.getLastColumn()).getValues()[0];
    const mIds = maestro.getLastRow() > 1
      ? maestro.getRange(1, 1, maestro.getLastRow(), 1).getValues().flat()
      : [mHeaders[0]];
    const mIdx = mIds.indexOf(datos.ID_receta);

    const filaM = mHeaders.map(col => {
      if (col === 'costo_MP_unitario') return costoMP;
      if (col === 'costo_insumos_unitario') return costoInsumos;
      if (col === 'fecha_consolidación') return hoy;
      if (col === 'versión_actual') return receta['versión'] || 1;
      return receta[col] !== undefined ? receta[col] : '';
    });

    if (mIdx > 0) {
      maestro.getRange(mIdx + 1, 1, 1, filaM.length).setValues([filaM]);
    } else {
      maestro.appendRow(filaM);
    }
  }

  sincronizarListaPublicaProductos();

  return { ok: true, msg: tipoReceta === 'sub_receta'
    ? 'Sub receta aprobada, agregada al catálogo de ingredientes y al maestro'
    : 'Receta aprobada y enviada al maestro' };
}

// ── LISTA PÚBLICA DE PRODUCTOS (para B2C / B2B) ────────────────
// Hoja liviana, SOLO con lo que otros sistemas necesitan para reconciliar
// nombres — nunca se publica Maestro_recetas completo (tiene costos e
// ingredientes, información sensible del negocio).
// ── PRODUCTOS DE REVENTA (se compran ya terminados, no se producen en fën) ──
// Sección liviana de Admin — mismo espíritu que una receta (tiene ID, costo,
// entra a Lista_publica_productos), pero sin ingredientes, pasos, ni el flujo
// de aprobación por jefa: Admin la crea y ya queda vigente.
function _hojaProductosReventa() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Productos_reventa');
  if (!h) {
    h = ss.insertSheet('Productos_reventa');
    h.getRange(1,1,1,11).setValues([[
      'ID_reventa','nombre','costo_neto','iva_pct','costo_bruto','unidad_compra',
      'costo_por_unidad','stock_actual','stock_minimo','activo','area'
    ]]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  // Por si la hoja ya existía de antes sin la columna "area"
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  if (headers.indexOf('area') === -1) {
    h.getRange(1, headers.length+1).setValue('area').setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
  }
  return h;
}

function leerProductosReventa() {
  const h = _hojaProductosReventa();
  if (h.getLastRow() < 2) return [];
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  return vals.map((row,i) => {
    const o = {}; headers.forEach((hh,j)=>o[hh]=row[j]); o._fila = i+2; return o;
  });
}

function crearProductoReventa(datos) {
  const h = _hojaProductosReventa();
  const nombre = (datos.nombre || '').trim();
  if (!nombre) return { ok: false, msg: 'Falta el nombre' };

  const unidadCompra = (datos.unidad_compra || 'un').trim().toLowerCase();
  const { factorBase } = parsearUnidadCompra(unidadCompra);
  const neto = parseFloat(datos.costo_neto) || 0;
  const iva = datos.iva_pct !== undefined ? (parseFloat(datos.iva_pct) || 0) : 0.19;
  const bruto = neto * (1 + iva);
  const costoPorUnidad = bruto / factorBase;
  const area = (datos.area || 'Reventa').trim();

  const ids = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,1).getValues().flat() : [];
  let n = ids.length + 1;
  let id = 'REV' + String(n).padStart(3,'0');
  while (ids.includes(id)) { n++; id = 'REV' + String(n).padStart(3,'0'); }

  h.appendRow([
    id, nombre, neto, iva, bruto, unidadCompra, costoPorUnidad,
    parseFloat(datos.stock_actual) || 0, parseFloat(datos.stock_minimo) || 0, 'si', area
  ]);

  sincronizarListaPublicaProductos();
  return { ok: true, msg: 'Producto de reventa creado: ' + nombre, id };
}

function editarProductoReventa(datos) {
  const h = _hojaProductosReventa();
  if (h.getLastRow() < 2) return { ok: false, msg: 'No hay productos de reventa' };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxId = headers.indexOf('ID_reventa');
  const ids = h.getRange(2,1,h.getLastRow()-1,1).getValues().flat();
  const fila = ids.indexOf(datos.ID_reventa);
  if (fila < 0) return { ok: false, msg: 'Producto no encontrado: ' + datos.ID_reventa };

  const idxNombre = headers.indexOf('nombre');
  const idxNeto = headers.indexOf('costo_neto');
  const idxIva = headers.indexOf('iva_pct');
  const idxBruto = headers.indexOf('costo_bruto');
  const idxUnidad = headers.indexOf('unidad_compra');
  const idxCostoUn = headers.indexOf('costo_por_unidad');
  const idxActivo = headers.indexOf('activo');
  const idxArea = headers.indexOf('area');

  if (datos.nombre !== undefined) h.getRange(fila+2, idxNombre+1).setValue(datos.nombre);
  if (datos.activo !== undefined) h.getRange(fila+2, idxActivo+1).setValue(datos.activo);
  if (datos.area !== undefined && idxArea > -1) h.getRange(fila+2, idxArea+1).setValue(datos.area);

  if (datos.costo_neto !== undefined || datos.unidad_compra !== undefined) {
    const filaActual = h.getRange(fila+2, 1, 1, headers.length).getValues()[0];
    const unidadCompra = (datos.unidad_compra !== undefined ? datos.unidad_compra : filaActual[idxUnidad] || 'un').toLowerCase();
    const neto = datos.costo_neto !== undefined ? (parseFloat(datos.costo_neto) || 0) : (parseFloat(filaActual[idxNeto]) || 0);
    const iva = datos.iva_pct !== undefined ? (parseFloat(datos.iva_pct) || 0) : (parseFloat(filaActual[idxIva]) || 0.19);
    const { factorBase } = parsearUnidadCompra(unidadCompra);
    const bruto = neto * (1 + iva);
    const costoPorUnidad = bruto / factorBase;

    h.getRange(fila+2, idxNeto+1).setValue(neto);
    h.getRange(fila+2, idxIva+1).setValue(iva);
    h.getRange(fila+2, idxBruto+1).setValue(bruto);
    h.getRange(fila+2, idxUnidad+1).setValue(unidadCompra);
    h.getRange(fila+2, idxCostoUn+1).setValue(costoPorUnidad);
  }

  sincronizarListaPublicaProductos();
  return { ok: true, msg: 'Producto de reventa actualizado' };
}

function ajustarStockReventa(datos) {
  const h = _hojaProductosReventa();
  if (h.getLastRow() < 2) return { ok: false, msg: 'No hay productos de reventa' };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxId = headers.indexOf('ID_reventa');
  const idxStock = headers.indexOf('stock_actual');
  const ids = h.getRange(2,1,h.getLastRow()-1,1).getValues().flat();
  const fila = ids.indexOf(datos.ID_reventa);
  if (fila < 0) return { ok: false, msg: 'Producto no encontrado: ' + datos.ID_reventa };

  const stockActual = parseFloat(h.getRange(fila+2, idxStock+1).getValue()) || 0;
  let nuevoStock;
  if (datos.modo === 'sumar') nuevoStock = stockActual + (parseFloat(datos.cantidad) || 0);
  else if (datos.modo === 'restar') nuevoStock = Math.max(0, stockActual - (parseFloat(datos.cantidad) || 0));
  else nuevoStock = parseFloat(datos.cantidad) || 0; // modo 'fijar' — conteo manual exacto

  h.getRange(fila+2, idxStock+1).setValue(nuevoStock);
  return { ok: true, msg: 'Stock actualizado', stock_actual: nuevoStock };
}

// Código corto por área — mismo patrón que ya usan PAN/BOL/CAF/PAS desde el
// principio. Se agrega como columna aparte en Lista_publica_productos para que
// B2B/B2C puedan matchear por código sin tener que mantener su propia tabla de
// traducción nombre-completo → código, que es justo lo que se les quedó
// desactualizado con "Reventa". Cualquier área nueva que se cree a futuro
// (ej. "Jugos") recibe un código generado automáticamente, sin tener que tocar
// este código de nuevo cada vez.
function _codigoAreaDesdeNombre(nombreArea) {
  const CODIGOS_CONOCIDOS = {
    'Panadería': 'PAN', 'Bollería': 'BOL', 'Cafetería': 'CAF', 'Pastelería': 'PAS',
    'Reventa': 'REV', 'Servicios': 'SERV'
  };
  if (CODIGOS_CONOCIDOS[nombreArea]) return CODIGOS_CONOCIDOS[nombreArea];
  // Respaldo para áreas nuevas no listadas arriba: primeras 3 letras, sin
  // tildes, en mayúscula — mismo estilo que los códigos ya existentes.
  const sinTildes = (nombreArea || '').toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return sinTildes.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'GEN';
}

function sincronizarListaPublicaProductos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const maestro = ss.getSheetByName('Maestro_recetas');

  let filas = [];

  if (maestro && maestro.getLastRow() >= 2) {
    const headers = maestro.getRange(1, 1, 1, maestro.getLastColumn()).getValues()[0];
    const idxId       = headers.indexOf('ID_receta');
    const idxNombre   = headers.indexOf('nombre');
    const idxArea     = headers.indexOf('área');
    const idxTipo     = headers.indexOf('tipo_receta');
    const idxVende    = headers.indexOf('vende_directo');
    const idxVariante = headers.indexOf('variante_de_id');
    const idxDesc     = headers.indexOf('descontinuada');
    const vals = maestro.getRange(2, 1, maestro.getLastRow()-1, headers.length).getValues();

    // "vende_directo" manda si está definido explícito (ej. Espresso: sub-receta que
    // también se vende sola). Si aún no se definió (recetas guardadas antes de este
    // campo), se usa el criterio anterior como respaldo: recetas normales sí, sub-recetas no.
    const seVendeDirecto = r => {
      const val = idxVende > -1 ? r[idxVende] : '';
      if (val === 'si') return true;
      if (val === 'no') return false;
      return idxTipo < 0 || r[idxTipo] !== 'sub_receta';
    };

    // Variantes internas (ej. "Hogaza clásica 48 horas" apunta a "Hogaza clásica")
    // se excluyen — ya están representadas por el producto al que apuntan.
    const esVarianteInterna = r => idxVariante > -1 && r[idxVariante];

    // Descontinuadas: recetas eliminadas por Admin, pero conservadas (sin borrar la
    // fila) porque ya fueron publicadas — B2B/B2C pueden tener su ID anclado.
    const estaDescontinuada = r => idxDesc > -1 && r[idxDesc] === 'si';

    // No existe columna "estado" en Maestro_recetas — todo lo que llega ahí ya está
    // consolidado por definición (solo se escribe al aprobar), así que no hace falta filtrar.
    filas = vals
      .filter(seVendeDirecto)
      .filter(r => !esVarianteInterna(r))
      .filter(r => !estaDescontinuada(r))
      .map(r => [r[idxId], r[idxNombre], r[idxArea], 'consolidada', _codigoAreaDesdeNombre(r[idxArea])]);
  }

  // Productos de reventa (comprados, no producidos) — mismo listado, área "Reventa"
  const reventa = leerProductosReventa().filter(p => p.activo !== 'no');
  reventa.forEach(p => {
    const areaNombre = p.area || 'Reventa';
    filas.push([p.ID_reventa, p.nombre, areaNombre, 'consolidada', _codigoAreaDesdeNombre(areaNombre)]);
  });

  let pub = ss.getSheetByName('Lista_publica_productos');
  if (!pub) {
    pub = ss.insertSheet('Lista_publica_productos');
  }
  pub.clear();
  const headersPub = ['ID_receta', 'nombre', 'área', 'estado', 'código_área'];
  pub.getRange(1, 1, 1, headersPub.length).setValues([headersPub])
    .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
  pub.setFrozenRows(1);

  if (filas.length) {
    pub.getRange(2, 1, filas.length, headersPub.length).setValues(filas);
  }
}


// ── GUARDAR PLANIFICACIÓN SEMANAL ────────────────────────────
function guardarPlanificacion(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName(datos.hoja);
  if (!h) return { ok: false, msg: 'Hoja no encontrada: ' + datos.hoja };

  const headers  = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const semana   = datos.semana;
  const plan     = datos.plan; // { ID_receta: [lun, mar, mie, jue, vie, sab, dom] }
  const diasCols = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

  // Eliminar filas de esta semana si ya existen
  const semanaCol = headers.indexOf('semana_ID') + 1;
  if (semanaCol > 0 && h.getLastRow() > 1) {
    const semanas = h.getRange(2, semanaCol, h.getLastRow() - 1, 1).getValues().flat();
    for (let i = semanas.length - 1; i >= 0; i--) {
      if (semanas[i] === semana) h.deleteRow(i + 2);
    }
  }

  // Obtener maestro para nombres de recetas
  const maestro = ss.getSheetByName('Maestro_recetas');
  const nombresMap = {};
  if (maestro && maestro.getLastRow() > 1) {
    const mData = maestro.getRange(2, 1, maestro.getLastRow() - 1, 3).getValues();
    mData.forEach(row => nombresMap[row[0]] = row[2]);
  }

  // Agregar filas nuevas
  const fechaInicio = obtenerFechaInicioSemana(semana);
  const fechaFin    = new Date(fechaInicio);
  fechaFin.setDate(fechaFin.getDate() + 6);

  Object.entries(plan).forEach(([recetaId, cantidades]) => {
    if (cantidades.every(c => c === 0)) return; // Omitir si todo es 0
    const total = cantidades.reduce((s, c) => s + c, 0);
    const fila  = headers.map(col => {
      if (col === 'semana_ID')    return semana;
      if (col === 'fecha_inicio') return fechaInicio;
      if (col === 'fecha_fin')    return fechaFin;
      if (col === 'ID_receta')    return recetaId;
      if (col === 'nombre_receta') return nombresMap[recetaId] || recetaId;
      if (col === 'total_semana') return total;
      const diaIdx = diasCols.indexOf(col);
      if (diaIdx >= 0) return cantidades[diaIdx] || 0;
      return '';
    });
    h.appendRow(fila);
  });

  return { ok: true, msg: 'Planificación guardada para semana ' + semana };
}

function obtenerFechaInicioSemana(semanaId) {
  // ISO 8601: semana empieza el lunes
  // semanaId formato: YYYY-WNN
  const [añoStr, semStr] = semanaId.split('-W');
  const año   = parseInt(añoStr);
  const semana = parseInt(semStr);
  
  // 4 de enero siempre está en la semana 1 del año ISO
  const cuatroEnero = new Date(año, 0, 4);
  const diaSemana   = cuatroEnero.getDay() || 7; // 1=lun, 7=dom
  // Lunes de la semana 1
  const lunesSem1   = new Date(cuatroEnero);
  lunesSem1.setDate(cuatroEnero.getDate() - (diaSemana - 1));
  // Lunes de la semana solicitada
  const resultado   = new Date(lunesSem1);
  resultado.setDate(lunesSem1.getDate() + (semana - 1) * 7);
  return resultado;
}


// ── BOL PLAN B2C/B2B ──────────────────────────────────────────
function leerPlanB2CB2BBOL(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('BOL_plan_b2cb2b');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const vals    = h.getDataRange().getValues();
  const headers = vals[0];
  const semIdx  = headers.indexOf('semana_ID');
  const filas = vals.slice(1)
    .filter(r => !datos.semana_ID || r[semIdx] === datos.semana_ID)
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
  return { ok: true, filas };
}

function guardarPlanB2CB2BBOL(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_b2cb2b');
  if (!h) {
    h = ss.insertSheet('BOL_plan_b2cb2b');
    const headers = ['semana_ID','ID_receta','nombre_receta','canal',
                     'lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    h.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#4A148C').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const vals    = h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow()-1, headers.length).getValues() : [];
  const semIdx  = headers.indexOf('semana_ID');
  const ridIdx  = headers.indexOf('ID_receta');
  const canalIdx = headers.indexOf('canal');

  // datos.filas = [{ semana_ID, ID_receta, nombre_receta, canal, dias:[7] }]
  (datos.filas || []).forEach(fila => {
    let rowIdx = -1;
    vals.forEach((r, i) => {
      if (r[semIdx] === fila.semana_ID && r[ridIdx] === fila.ID_receta && r[canalIdx] === fila.canal)
        rowIdx = i + 2;
    });
    const dias = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
    const row = headers.map(col => {
      if (col === 'semana_ID')     return fila.semana_ID;
      if (col === 'ID_receta')     return fila.ID_receta;
      if (col === 'nombre_receta') return fila.nombre_receta;
      if (col === 'canal')         return fila.canal;
      const dIdx = dias.indexOf(col);
      return dIdx >= 0 ? (fila.dias[dIdx] || 0) : '';
    });
    if (rowIdx > 0) h.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    else h.appendRow(row);
  });
  return { ok: true, msg: 'Plan B2C/B2B guardado' };
}

// ── BOL PLAN MASAS ────────────────────────────────────────────
function leerPlanMasasBOL(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('BOL_plan_masas');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };

  const vals    = h.getDataRange().getValues();
  const headers = vals[0];
  const semanaIdx = headers.indexOf('semana_ID');
  const diasCols  = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

  const filas = vals.slice(1)
    .filter(r => !datos.semana_ID || r[semanaIdx] === datos.semana_ID)
    .map(r => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });
  return { ok: true, filas };
}

function guardarPlanMasasBOL(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_masas');
  if (!h) {
    h = ss.insertSheet('BOL_plan_masas');
    const headers = ['semana_ID','fecha_inicio','fecha_fin','ID_mp','nombre_mp',
                     'lunes','martes','miércoles','jueves','viernes','sábado','domingo','total_semana'];
    h.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const vals    = h.getLastRow() > 1 ? h.getRange(2, 1, h.getLastRow()-1, headers.length).getValues() : [];
  const semanaIdx = headers.indexOf('semana_ID');
  const mpIdx     = headers.indexOf('ID_mp');

  // datos.filas = [{ semana_ID, ID_mp, nombre_mp, dias:[7], total }]
  (datos.filas || []).forEach(fila => {
    let rowIdx = -1;
    vals.forEach((r, i) => {
      if (r[semanaIdx] === fila.semana_ID && r[mpIdx] === fila.ID_mp) rowIdx = i + 2;
    });
    const row = headers.map(col => {
      if (col === 'semana_ID')    return fila.semana_ID;
      if (col === 'fecha_inicio') return fila.fecha_inicio || '';
      if (col === 'fecha_fin')    return fila.fecha_fin || '';
      if (col === 'ID_mp')        return fila.ID_mp;
      if (col === 'nombre_mp')    return fila.nombre_mp;
      if (col === 'total_semana') return fila.dias.reduce((s,v)=>s+(v||0),0);
      const diasCols = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];
      const dIdx = diasCols.indexOf(col);
      return dIdx >= 0 ? (fila.dias[dIdx] || 0) : '';
    });
    if (rowIdx > 0) {
      h.getRange(rowIdx, 1, 1, row.length).setValues([row]);
    } else {
      h.appendRow(row);
    }
  });
  return { ok: true, msg: 'Plan masas guardado' };
}

// ── CAF: BARISTAS ────────────────────────────────────────────
function leerBaristasCaf(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('CAF_baristas');
  if (!h || h.getLastRow() < 2) return { ok: true, baristas: [] };
  const vals = h.getRange(2, 1, h.getLastRow()-1, 1).getValues();
  const baristas = vals.map(r => r[0]).filter(Boolean);
  return { ok: true, baristas };
}

function guardarBaristasCaf(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('CAF_baristas');
  if (!h) {
    h = ss.insertSheet('CAF_baristas');
    h.getRange(1,1).setValue('nombre')
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  h.getRange(2, 1, Math.max(h.getLastRow(), 2), 1).clearContent();
  if (datos.baristas?.length) {
    h.getRange(2, 1, datos.baristas.length, 1).setValues(datos.baristas.map(b => [b]));
  }
  return { ok: true };
}

// ── REGISTRO DE MERMA (PAN/BOL/CAF/PAS) ───────────────────────
function guardarRegistroMerma(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Registro_merma');
  const headersDefault = ['fecha','hora','area_codigo','area_nombre','tipo_perdida','item_id','item_nombre','es_sub_receta','cantidad','unidad','costo_calculado','motivo','nota'];
  if (!h) {
    h = ss.insertSheet('Registro_merma');
    h.getRange(1, 1, 1, headersDefault.length).setValues([headersDefault])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  // Hojas creadas antes de agregar la columna es_sub_receta no la tienen — se agrega
  // sola al final la primera vez que se guarda un registro, sin perder los datos ya escritos.
  let headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  if (headers.indexOf('es_sub_receta') < 0) {
    const col = headers.length + 1;
    h.getRange(1, col).setValue('es_sub_receta').setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  }
  const r = datos.registro;
  const fila = headers.map(col => {
    if (col === 'fecha') return r.fecha;
    if (col === 'hora') return r.hora;
    if (col === 'area_codigo') return r.area_codigo;
    if (col === 'area_nombre') return r.area_nombre;
    if (col === 'tipo_perdida') return r.tipo_perdida;
    if (col === 'item_id') return r.item_id;
    if (col === 'item_nombre') return r.item_nombre;
    if (col === 'es_sub_receta') return r.es_sub_receta || 'no';
    if (col === 'cantidad') return r.cantidad;
    if (col === 'unidad') return r.unidad;
    if (col === 'costo_calculado') return r.costo_calculado;
    if (col === 'motivo') return r.motivo;
    if (col === 'nota') return r.nota || '';
    return '';
  });
  h.appendRow(fila);
  return { ok: true };
}

function leerRegistroMerma(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Registro_merma');
  if (!h || h.getLastRow() < 2) return { ok: true, registros: [] };
  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const vals    = h.getRange(2, 1, h.getLastRow()-1, headers.length).getValues();
  const tz = Session.getScriptTimeZone();
  let registros = vals.map(r => {
    const obj = {};
    headers.forEach((col, i) => { obj[col] = r[i]; });
    // Igual que en CAF_registros — formatear explícito evita el desajuste con
    // los filtros de fecha del frontend y el corrimiento de día por UTC.
    if (obj.fecha instanceof Date) {
      obj.fecha = Utilities.formatDate(obj.fecha, tz, 'yyyy-MM-dd');
    }
    return obj;
  }).filter(r => r.fecha);
  if (datos.area_codigo) registros = registros.filter(r => r.area_codigo === datos.area_codigo);
  return { ok: true, registros };
}

// ── CAF: REGISTROS ────────────────────────────────────────────
function leerRegistrosCAF(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('CAF_registros');
  if (!h || h.getLastRow() < 2) return { ok: true, registros: [] };
  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const vals    = h.getRange(2, 1, h.getLastRow()-1, headers.length).getValues();
  const idxFecha = headers.indexOf('fecha');
  const tz = Session.getScriptTimeZone();
  const registros = vals.map(r => {
    const obj = {};
    headers.forEach((col, i) => { obj[col] = r[i]; });
    // La fecha puede venir como objeto Date de Sheets — formatearla explícito
    // (yyyy-MM-dd, sin hora ni "Z") evita el desajuste con las comparaciones de
    // fecha del frontend y el corrimiento de día por conversión a UTC.
    if (idxFecha > -1 && obj.fecha instanceof Date) {
      obj.fecha = Utilities.formatDate(obj.fecha, tz, 'yyyy-MM-dd');
    }
    return obj;
  }).filter(r => r.fecha);
  return { ok: true, registros };
}

function guardarRegistroCAF(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('CAF_registros');
  if (!h) {
    h = ss.insertSheet('CAF_registros');
    const headers = ['fecha','hora','barista','turno','tipo','shots','gramos','nota'];
    h.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const r = datos.registro;
  h.appendRow([r.fecha, r.hora, r.barista, r.turno, r.tipo, r.shots||'', r.gramos, r.nota||'']);
  return { ok: true };
}

// ── EDITAR CAMPO GENÉRICO MP ──────────────────────────────────
// Edita un campo puntual de una receta ya consolidada (ej. "unidades_por_caja"
// para Productos Congelados) sin pasar por todo el flujo de guardarReceta/
// aprobación — son ajustes operativos, no cambios de contenido de receta que
// necesiten re-revisión. Escribe en la hoja de trabajo del área Y en
// Maestro_recetas a la vez, para que ambas fuentes queden consistentes.
function editarCampoReceta(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const resultados = [];

  [datos.hoja, 'Maestro_recetas'].forEach(nombreHoja => {
    const h = ss.getSheetByName(nombreHoja);
    if (!h) return;
    const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
    const ids = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
    const rowIdx = ids.indexOf(datos.ID_receta);
    if (rowIdx < 1) return;

    let colIdx = headers.indexOf(datos.campo);
    if (colIdx < 0) {
      colIdx = headers.length;
      h.getRange(1, colIdx + 1).setValue(datos.campo);
    }
    h.getRange(rowIdx + 1, colIdx + 1).setValue(datos.valor);
    resultados.push(nombreHoja);
  });

  if (!resultados.length) return { ok: false, msg: 'Receta no encontrada en ninguna hoja' };
  return { ok: true, msg: 'Actualizado en: ' + resultados.join(', ') };
}

function editarCampoMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('MP_maestro');
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };

  let headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const ids   = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
  const rowIdx = ids.indexOf(datos.ID_MP);
  if (rowIdx < 1) return { ok: false, msg: 'MP no encontrada: ' + datos.ID_MP };

  let colIdx = headers.indexOf(datos.campo);
  if (colIdx < 0) {
    // Create the column if it doesn't exist (e.g. reemplazada_por)
    colIdx = headers.length;
    h.getRange(1, colIdx + 1).setValue(datos.campo);
  }

  h.getRange(rowIdx + 1, colIdx + 1).setValue(datos.valor);
  return { ok: true, msg: 'MP actualizada: ' + datos.ID_MP + ' ' + datos.campo + ' = ' + datos.valor };
}

// ── SOLICITAR NUEVA MP ───────────────────────────────────────
const CORREOS_JEFAS = {
  'BOL': 'marjoriearaya1130@gmail.com',
  'PAN': 'camilitavira1@gmail.com',
  'CAF': 'abraham.alejandro902@gmail.com',
  'PAS': 'panaderiafen@gmail.com'
};

// ── FASE 2: CONEXIÓN A REGISTRO DE GASTOS (Sheet externo) ─────
const SHEET_ID_GASTOS = '1IQabDQ3a7Tz3yAUbeYNhlTGsTSdr9SA5326F1yTslBA';

// Calcula qué % de las ventas totales del mes corresponde a cada área — usado
// para prorratear gastos generales (arriendo, vehículo, gas) de forma justificable,
// en vez de repartirlos en partes iguales o a criterio manual cada vez.
// ── INVERSIONES Y DEPRECIACIÓN ─────────────────────────────────
// Se maneja acá, no en Registro de Gastos — esa app está pensada para carga
// rápida diaria, y una inversión necesita más cuidado (monto, vida útil).
// La depreciación mensual (monto_total / vida_util_meses) se suma a los gastos
// generales del mes correspondiente mientras la inversión siga "viva" (dentro
// de su vida útil) — si tiene área asignada, va directo a esa área; si no,
// entra al mismo prorrateo por ventas que los demás gastos sin área.
function _hojaInversiones() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Inversiones');
  if (!h) {
    h = ss.insertSheet('Inversiones');
    h.getRange(1,1,1,7).setValues([[
      'ID_inversion','nombre','monto_total','fecha_compra','vida_util_meses','área','activa'
    ]]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function leerInversiones() {
  const h = _hojaInversiones();
  if (h.getLastRow() < 2) return [];
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  return vals.map((row,i) => {
    const o = {}; headers.forEach((hh,j)=>o[hh]=row[j]); o._fila = i+2;
    o.depreciacion_mensual = (parseFloat(o.monto_total)||0) / (parseFloat(o.vida_util_meses)||1);
    return o;
  });
}

function crearInversion(datos) {
  const h = _hojaInversiones();
  const nombre = (datos.nombre || '').trim();
  const monto = parseFloat(datos.monto_total) || 0;
  const vidaUtil = parseFloat(datos.vida_util_meses) || 0;
  if (!nombre) return { ok: false, msg: 'Falta el nombre' };
  if (!monto || monto <= 0) return { ok: false, msg: 'Monto inválido' };
  if (!vidaUtil || vidaUtil <= 0) return { ok: false, msg: 'Vida útil inválida — confirme el plazo con su contador' };

  const ids = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,1).getValues().flat() : [];
  let n = ids.length + 1;
  let id = 'INV' + String(n).padStart(3,'0');
  while (ids.includes(id)) { n++; id = 'INV' + String(n).padStart(3,'0'); }

  h.appendRow([id, nombre, monto, datos.fecha_compra || '', vidaUtil, datos.area || '', 'si']);
  return { ok: true, msg: 'Inversión registrada: ' + nombre, id };
}

function editarInversion(datos) {
  const h = _hojaInversiones();
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxId = headers.indexOf('ID_inversion');
  const ids = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,1).getValues().flat() : [];
  const fila = ids.indexOf(datos.ID_inversion);
  if (fila < 0) return { ok: false, msg: 'Inversión no encontrada: ' + datos.ID_inversion };

  const campos = ['nombre','monto_total','fecha_compra','vida_util_meses','área','activa'];
  campos.forEach(campo => {
    if (datos[campo] !== undefined) {
      h.getRange(fila+2, headers.indexOf(campo)+1).setValue(datos[campo]);
    }
  });
  return { ok: true, msg: 'Inversión actualizada' };
}

// Depreciación del mes: suma la cuota mensual de cada inversión activa cuya vida
// útil todavía cubra ese mes — separado por área (directo) y general (a prorratear)
function calcularDepreciacionMes(mes) {
  const inversiones = leerInversiones().filter(inv => inv.activa !== 'no');
  const porArea = {};
  let general = 0;

  inversiones.forEach(inv => {
    const fechaCompra = inv.fecha_compra ? new Date(inv.fecha_compra) : null;
    if (!fechaCompra || isNaN(fechaCompra.getTime())) return;
    const mesCompra = Utilities.formatDate(fechaCompra, Session.getScriptTimeZone(), 'yyyy-MM');
    const vidaUtil = parseFloat(inv.vida_util_meses) || 0;
    if (!vidaUtil) return;

    // ¿El mes consultado cae dentro de la ventana de vida útil de esta inversión?
    const mesesDesdeCompra = _mesesEntre(mesCompra, mes);
    if (mesesDesdeCompra < 0 || mesesDesdeCompra >= vidaUtil) return; // aún no existía, o ya se depreció completa

    const cuota = inv.depreciacion_mensual;
    const area = (inv['área'] || '').toString().trim();
    if (area) porArea[area] = (porArea[area] || 0) + cuota;
    else general += cuota;
  });

  return { porArea, general };
}

// Diferencia en meses completos entre dos strings "YYYY-MM" (b - a)
function _mesesEntre(mesA, mesB) {
  const [anioA, mA] = mesA.split('-').map(Number);
  const [anioB, mB] = mesB.split('-').map(Number);
  return (anioB - anioA) * 12 + (mB - mA);
}

// El despacho que se cobra a los clientes existe justamente para cubrir el gasto
// de bencina — antes de prorratear ese gasto entre las áreas, se descuenta lo
// que el despacho ya cubrió ese mes. Si el despacho cubre más que la bencina,
// el excedente no se usa para descontar otros gastos (se deja en 0, no negativo).
function calcularGastoBencinaNeto(generalPorEtiqueta, mes) {
  let bencinaTotal = 0;
  Object.values(generalPorEtiqueta || {}).forEach(g => {
    Object.entries(g.items || {}).forEach(([item, monto]) => {
      if (item.toUpperCase().includes('BENCINA')) bencinaTotal += monto;
    });
  });
  if (bencinaTotal === 0) return { bencinaTotal: 0, despachoTotal: 0, bencinaNeta: 0, descuento: 0 };

  const ventas = leerVentasMensualesConsolidadas().filter(v => v.mes === mes);
  let despachoTotal = 0;
  ventas.forEach(v => {
    const areaNombre = (v['área'] || v.área || '').toString();
    if (areaNombre.toUpperCase().replace(/[ÁÉÍÓÚ]/g,c=>({Á:'A',É:'E',Í:'I',Ó:'O',Ú:'U'}[c])).includes('SERVICIO')) despachoTotal += parseFloat(v.monto_neto) || 0;
  });

  const descuento = Math.min(bencinaTotal, despachoTotal);
  return { bencinaTotal, despachoTotal, bencinaNeta: bencinaTotal - descuento, descuento };
}

function leerGastosPorAreaConProrrateo(datos) {
  const gastosRes = leerGastosPorArea(datos);
  if (!gastosRes.ok) return gastosRes;
  const { participacion, totalGeneral, totalPorArea } = calcularParticipacionVentasPorArea(gastosRes.mes);

  // Descontar del gasto de bencina lo que el despacho cobrado a clientes ya cubrió
  // ese mes, antes de prorratear el resto entre las áreas.
  const bencina = calcularGastoBencinaNeto(gastosRes.generalPorEtiqueta, gastosRes.mes);
  const generalPorEtiquetaAjustado = JSON.parse(JSON.stringify(gastosRes.generalPorEtiqueta || {}));
  if (bencina.descuento > 0) {
    Object.values(generalPorEtiquetaAjustado).forEach(g => {
      Object.keys(g.items || {}).forEach(item => {
        if (item.toUpperCase().includes('BENCINA') && g.items[item] > 0) {
          const reduccion = Math.min(g.items[item], bencina.descuento);
          g.items[item] -= reduccion;
          g.fijos -= reduccion;
        }
      });
    });
  }
  const generalAjustado = {
    fijos: gastosRes.general.fijos - bencina.descuento,
    remuneracion: gastosRes.general.remuneracion
  };

  // Sumar depreciación de inversiones — por área directo, o al balde general a prorratear
  const depre = calcularDepreciacionMes(gastosRes.mes);
  const datosConDepre = JSON.parse(JSON.stringify(gastosRes.datos)); // copia, no mutar el original
  Object.entries(depre.porArea).forEach(([area, monto]) => {
    if (!datosConDepre[area]) datosConDepre[area] = { fijos: 0, remuneracion: 0 };
    datosConDepre[area].fijos += monto;
  });
  const generalConDepre = {
    fijos: generalAjustado.fijos + depre.general,
    remuneracion: generalAjustado.remuneracion
  };

  return {
    ok: true, mes: gastosRes.mes, datos: datosConDepre, general: generalConDepre,
    generalPorEtiqueta: generalPorEtiquetaAjustado,
    bencinaDescuento: bencina,
    participacion, totalVentasMes: totalGeneral, ventasPorArea: totalPorArea,
    depreciacionIncluida: { porArea: depre.porArea, general: depre.general }
  };
}

// Mapeo nombre completo -> código, para que el resultado siempre quede en código
// (PAN/BOL/CAF/PAS) — mismo formato que usa el resto del sistema (Config de
// costeo, leerGastosPorArea, etc.), evitando desajustes entre "Panadería" y "PAN".
const _CODIGO_POR_NOMBRE_AREA = { 'Panadería':'PAN', 'Bollería':'BOL', 'Cafetería':'CAF', 'Pastelería':'PAS' };

function calcularParticipacionVentasPorArea(mes) {
  const AREAS_REALES = ['PAN', 'BOL', 'CAF', 'PAS'];
  const ventas = leerVentasMensualesConsolidadas().filter(v => v.mes === mes);
  const totalPorArea = {};
  let totalGeneral = 0;
  ventas.forEach(v => {
    const areaNombre = v['área'] || v.área || 'Sin área';
    const area = _CODIGO_POR_NOMBRE_AREA[areaNombre] || areaNombre; // normaliza a código si se puede
    // Solo las 4 áreas de producción cuentan para el prorrateo — ventas de
    // "Servicios" (ej. Despacho) o "Reventa" no deben diluir ni inflar el % de
    // ninguna área real. El caso de Despacho se maneja aparte, descontándolo
    // directamente del gasto de bencina (ver calcularGastoBencinaNeto).
    if (!AREAS_REALES.includes(area)) return;
    const monto = parseFloat(v.monto_neto) || 0;
    totalPorArea[area] = (totalPorArea[area] || 0) + monto;
    totalGeneral += monto;
  });
  const participacion = {};
  Object.keys(totalPorArea).forEach(area => {
    participacion[area] = totalGeneral > 0 ? totalPorArea[area] / totalGeneral : 0;
  });
  return { participacion, totalPorArea, totalGeneral };
}

// Lee 'Registro Gasto' del Sheet de Gastos y agrega costos fijos + remuneración por área, para un mes dado (YYYY-MM)
// Los gastos sin área asignada (arriendo, vehículo, gas, etc. — no nacen de una
// sola área) se devuelven aparte en "general", para que quien llame decida cómo
// prorratearlos entre las áreas, en vez de perderlos en silencio.
function leerGastosPorArea(datos) {
  const mes = datos.mes || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM');

  let ssGastos;
  try {
    ssGastos = SpreadsheetApp.openById(SHEET_ID_GASTOS);
  } catch(e) {
    return { ok: false, msg: 'No se pudo abrir el Sheet de Gastos: ' + e.message };
  }
  const h = ssGastos.getSheetByName('Registro Gasto');
  if (!h || h.getLastRow() < 2) return { ok: true, mes, datos: {}, general: { fijos: 0, remuneracion: 0 } };

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const idxFecha  = headers.indexOf('Fecha');
  const idxItem   = headers.indexOf('Ítem Gasto');
  const idxCat    = headers.indexOf('Categoría');
  const idxSubTipo = headers.indexOf('Sub Tipo');
  const idxArea   = headers.indexOf('Área');
  const idxMonto  = headers.indexOf('Monto Final');

  const vals = h.getRange(2, 1, h.getLastRow()-1, headers.length).getValues();
  const resultado = {}; // { AREA: { fijos: n, remuneracion: n } }
  const general = { fijos: 0, remuneracion: 0 }; // gastos compartidos — total (para el prorrateo)
  const generalPorEtiqueta = {}; // { ADMIN: {fijos,remuneracion, items:[{item,monto}]}, VENTAS: {...}, ... } — para mostrar desglosado
  const AREAS_REALES = ['PAN', 'BOL', 'CAF', 'PAS'];

  vals.forEach(row => {
    const fecha = row[idxFecha];
    if (!fecha || !(fecha instanceof Date)) return;
    const mesFila = Utilities.formatDate(fecha, Session.getScriptTimeZone(), 'yyyy-MM');
    if (mesFila !== mes) return;
    // Nota: "Categoría" (VARIABLE/FIJO) en este Sheet no distingue "gasto operativo
    // vs. no operativo" — VARIABLE incluye cosas tan operativas como bencina o
    // materia prima. El filtro real que importa acá es "Sub Tipo": solo OPERATIVO
    // entra al costeo — PASIVO, FINANCIERO, COMERCIAL e INVERSIÓN se manejan aparte
    // (inversión tiene su propia herramienta con depreciación, ver Inversiones).
    if (row[idxSubTipo] !== 'OPERATIVO') return;

    const areaRaw = (row[idxArea] || '').toString().trim().toUpperCase();
    const item = (row[idxItem] || '').toString();
    const monto = parseFloat(row[idxMonto]) || 0;
    const esRemuneracion = item.toUpperCase().includes('REMUNERAC');

    // Cualquier área que no sea una de las 4 reales de producción se trata como
    // gasto compartido — cubre "SIN_AREA", vacío, "ADMIN", "VENTAS", "PRORRATEADO",
    // o cualquier etiqueta nueva que se use en el futuro, sin tener que enumerarlas.
    if (!AREAS_REALES.includes(areaRaw)) {
      const etiqueta = areaRaw || 'SIN ETIQUETA';
      if (!generalPorEtiqueta[etiqueta]) generalPorEtiqueta[etiqueta] = { fijos: 0, remuneracion: 0, items: {} };
      if (esRemuneracion) {
        general.remuneracion += monto;
        generalPorEtiqueta[etiqueta].remuneracion += monto;
      } else {
        general.fijos += monto;
        generalPorEtiqueta[etiqueta].fijos += monto;
      }
      const nombreItem = item || '(sin ítem)';
      generalPorEtiqueta[etiqueta].items[nombreItem] = (generalPorEtiqueta[etiqueta].items[nombreItem] || 0) + monto;
      return;
    }

    if (!resultado[areaRaw]) resultado[areaRaw] = { fijos: 0, remuneracion: 0 };
    if (esRemuneracion) resultado[areaRaw].remuneracion += monto;
    else resultado[areaRaw].fijos += monto;
  });

  return { ok: true, mes, datos: resultado, general, generalPorEtiqueta };
}

// ── FASE 2: CONFIG DE COSTEO POR ÁREA/MES ─────────────────────
// Normaliza la columna "mes": si Sheets convirtió el texto "2026-06" en fecha real,
// lo devuelve igual como string 'yyyy-MM'. Si ya es texto, lo deja tal cual.
function normalizarMes(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM');
  return String(v || '').trim();
}

// Nota: la infraestructura de "Mapeo_productos" (traducción de nombres receta ↔
// ventas B2C/B2B) se eliminó — la Estimación de demanda usa ahora nombres que ya
// coinciden exactamente con el Maestro de recetas, sin necesitar traducción.

function leerConfigCosteo(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Config_costeo');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(c => String(c).trim());
  const vals = h.getRange(2, 1, h.getLastRow()-1, headers.length).getValues();
  let filas = vals.map((r,i) => {
    const obj = {};
    headers.forEach((col,j) => { obj[col] = r[j]; });
    obj.mes = normalizarMes(obj.mes);
    obj._fila = i + 2; // fila real en el Sheet — para poder elegir/eliminar una config específica
    return obj;
  }).filter(f => f.area);
  if (datos.area) filas = filas.filter(f => f.area === datos.area);
  if (datos.mes)  filas = filas.filter(f => f.mes === normalizarMes(datos.mes));
  return { ok: true, filas };
}

function eliminarConfigCosteoFila(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Config_costeo');
  if (!h) return { ok: false, msg: 'Hoja Config_costeo no encontrada' };
  const fila = parseInt(datos.fila);
  if (!fila || fila < 2 || fila > h.getLastRow()) return { ok: false, msg: 'Fila inválida' };
  h.deleteRow(fila);
  return { ok: true, msg: 'Configuración eliminada' };
}

function eliminarECPorArea(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('EC_productos');
  if (!h || h.getLastRow() < 2) return { ok: true, msg: 'No había nada que borrar', eliminadas: 0 };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxArea = headers.indexOf('área');
  const idxMes = headers.indexOf('mes');
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const mesFiltro = datos.mes ? _normalizarMesVentas(datos.mes) : null;

  // Borrar de abajo hacia arriba para no desordenar los índices de fila al eliminar
  let eliminadas = 0;
  for (let i = vals.length - 1; i >= 0; i--) {
    const coincideArea = vals[i][idxArea] === datos.area;
    const coincideMes = !mesFiltro || _normalizarMesVentas(vals[i][idxMes]) === mesFiltro;
    if (coincideArea && coincideMes) {
      h.deleteRow(i + 2);
      eliminadas++;
    }
  }
  return { ok: true, msg: eliminadas + ' cálculo(s) eliminado(s) de ' + datos.area + (mesFiltro ? ' — ' + mesFiltro : ''), eliminadas };
}

function guardarConfigCosteo(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Config_costeo');
  if (!h) {
    h = ss.insertSheet('Config_costeo');
    const headers = ['area','mes','costos_fijos_monto','remuneracion_monto','merma_pct','utilidad_b2c_pct','utilidad_b2b_pct','fuente','fecha_actualizacion'];
    h.getRange(1, 1, 1, headers.length).setValues([headers])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const r = datos.registro;
  const colMesIdx = headers.indexOf('mes');

  // Forzar formato de texto en la columna "mes" para que Sheets no la
  // reinterprete como fecha (ej. "2026-06" -> 1/6/2026)
  if (colMesIdx > -1) {
    h.getRange(2, colMesIdx + 1, Math.max(h.getMaxRows() - 1, 1), 1).setNumberFormat('@');
  }

  // Buscar fila existente para esa área+mes (upsert) — normalizando el mes por si alguna
  // fila anterior quedó guardada como fecha antes de este arreglo
  const lastRow = h.getLastRow();
  let rowIdx = -1;
  if (lastRow > 1) {
    const vals = h.getRange(2, 1, lastRow-1, headers.length).getValues();
    const colArea = headers.indexOf('area'), colMes = headers.indexOf('mes');
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][colArea] === r.area && normalizarMes(vals[i][colMes]) === normalizarMes(r.mes)) { rowIdx = i + 2; break; }
    }
  }

  const fila = headers.map(col => {
    if (col === 'fecha_actualizacion') return new Date();
    if (col === 'mes') return normalizarMes(r.mes);
    return r[col] !== undefined ? r[col] : '';
  });

  if (rowIdx > 0) {
    h.getRange(rowIdx, 1, 1, fila.length).setValues([fila]);
    if (colMesIdx > -1) h.getRange(rowIdx, colMesIdx + 1).setNumberFormat('@').setValue(normalizarMes(r.mes));
  } else {
    h.appendRow(fila);
    if (colMesIdx > -1) h.getRange(h.getLastRow(), colMesIdx + 1).setNumberFormat('@').setValue(normalizarMes(r.mes));
  }
  return { ok: true };
}

// ── FASE 2: CALCULAR ESTRUCTURAS DE COSTO (EC_productos) ──────
// Combina Config_costeo (fijos/remuneración/merma%/utilidad% de un área+mes)
// con las recetas activas del área para calcular costo de producción y precio sugerido.
// Peso por unidad de una receta — se calcula de sus propios ingredientes
// (suma de gramos ÷ porciones que rinde), sin necesitar ningún campo nuevo,
// ya que esa información ya vive en cada receta.
function _pesoUnidadReceta(r) {
  let ingredientes = [];
  try { ingredientes = JSON.parse(r.ingredientes_JSON || '[]'); } catch(e) {}
  const pesoTotal = ingredientes.reduce((s,i) => s + (parseFloat(i.gramos)||0), 0);
  const porciones = parseInt(r.porciones_base) || 1;
  return pesoTotal / porciones;
}

// ── INFORME DE AUDITORÍA — traza completa de cómo se calculó cada número ─────
// No recalcula nada — lee lo que YA está guardado en cada hoja (EC_productos,
// Maestro_recetas, Config_costeo, Registro de Gastos, Ventas_mensuales_consolidadas)
// y lo organiza para poder seguirle la pista a cualquier cifra, sin tener que
// abrir 5 pestañas distintas del Sheet cada vez.
// ── INFORME GENERAL DEL NEGOCIO — ventas − gastos, por área y total ─────────
// Mismo criterio que "Rentabilidad real": resta MP + fijos (propios y
// compartidos prorrateados) + remuneración de una sola vez — el número que
// realmente dice si el negocio genera plata, no solo el margen de MP.
// ── META DE VENTA / PUNTO DE EQUILIBRIO POR PRODUCTO ────────────────────────
// Distinto de "Rentabilidad real" — esta es prospectiva (antes de vender, para
// planificar), no retrospectiva. Responde: "¿cuántas unidades necesito vender
// para cubrir los costos, y cuántas más para llegar a la utilidad que quiero?"
//
// Trae solo los datos BASE para el simulador — el cálculo interactivo (precio,
// % de fijos asignado, etc.) se hace en el navegador, instantáneo, sin volver
// a consultar el servidor cada vez que el usuario mueve un número.
// Funciona con un producto YA CALCULADO (trae sus datos como punto de partida,
// editable) o con uno NUEVO (ID_receta vacío o sin Estructura de costo — el
// usuario completa todo a mano).
function obtenerDatosBaseMetaVenta(datos) {
  const area = datos.area;
  const mes = datos.mes;
  const idReceta = datos.ID_receta || '';
  if (!area || !mes) return { ok: false, msg: 'Falta área o mes' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombreAreaCompleto = { PAN:'Panadería', BOL:'Bollería', CAF:'Cafetería', PAS:'Pastelería' }[area] || area;

  // 1. Config de costeo — montos TOTALES del área (no por unidad)
  const cfgRes = leerConfigCosteo({ area, mes });
  const cfg = cfgRes.filas && cfgRes.filas.length ? cfgRes.filas[cfgRes.filas.length - 1] : null;
  if (!cfg) return { ok: false, msg: 'No hay Config de costeo guardada para ' + nombreAreaCompleto + ' / ' + mes };
  const fijosMonto = parseFloat(cfg.costos_fijos_monto) || 0;
  const remuneracionMonto = parseFloat(cfg.remuneracion_monto) || 0;

  // 2. Volumen total del área ese mes (todas las recetas juntas, real vendido)
  // — solo de referencia, para que el % que el usuario elija a mano tenga con
  // qué compararse ("¿es razonable que este producto sea el 15% del área?").
  const ventasDelMes = leerVentasMensualesConsolidadas().filter(v =>
    _normalizarMesVentas(v.mes) === _normalizarMesVentas(mes) && (v['área']||v.área) === nombreAreaCompleto);
  const volumenTotalArea = ventasDelMes.reduce((s,v) => s + (parseFloat(v.cantidad_vendida)||0), 0);

  // 3. Si se eligió un producto existente, traer su costo/precio calculado
  // como punto de partida editable — si no hay, o es un producto nuevo, todo
  // queda en null para que el usuario complete a mano.
  let base = { costoMPUnit: null, costoInsumosUnit: null, mermaPct: parseFloat(cfg.merma_pct)||5,
    precioB2C: null, precioB2B: null, utilidadB2CPct: parseFloat(cfg.utilidad_b2c_pct)||0,
    utilidadB2BPct: parseFloat(cfg.utilidad_b2b_pct)||0, nombre: '', volumenPropioMes: 0 };

  if (idReceta) {
    const hEC = ss.getSheetByName('EC_productos');
    if (hEC && hEC.getLastRow() > 1) {
      const ecHeaders = hEC.getRange(1,1,1,hEC.getLastColumn()).getValues()[0];
      const ecRow = hEC.getRange(2,1,hEC.getLastRow()-1,ecHeaders.length).getValues()
        .map(r => { const o = {}; ecHeaders.forEach((c,i) => o[c] = r[i]); return o; })
        .find(r => r.ID_receta === idReceta && r['área'] === nombreAreaCompleto && _normalizarMesVentas(r.mes) === _normalizarMesVentas(mes));
      if (ecRow) {
        base.costoMPUnit = parseFloat(ecRow.costo_MP_unit) || 0;
        base.costoInsumosUnit = parseFloat(ecRow.costo_insumos_unit) || 0;
        base.mermaPct = parseFloat(ecRow['merma_%']) || base.mermaPct;
        base.precioB2C = (parseFloat(ecRow.precio_B2C)||0) / 1.19; // neto
        base.precioB2B = (parseFloat(ecRow.precio_B2B)||0) / 1.19;
        base.nombre = ecRow.nombre;
      }
    }
    if (!base.nombre) {
      const hMaestro = ss.getSheetByName('Maestro_recetas');
      if (hMaestro && hMaestro.getLastRow() > 1) {
        const mHeaders = hMaestro.getRange(1,1,1,hMaestro.getLastColumn()).getValues()[0];
        const mRow = hMaestro.getRange(2,1,hMaestro.getLastRow()-1,mHeaders.length).getValues()
          .map(r => { const o = {}; mHeaders.forEach((c,i) => o[c] = r[i]); return o; })
          .find(r => r.ID_receta === idReceta);
        if (mRow) base.nombre = mRow.nombre;
      }
    }
    base.volumenPropioMes = ventasDelMes.filter(v => v.ID_receta === idReceta).reduce((s,v) => s + (parseFloat(v.cantidad_vendida)||0), 0);
  }

  return { ok: true, area: nombreAreaCompleto, mes, fijosMonto, remuneracionMonto,
    totalFijosRemuneracion: fijosMonto + remuneracionMonto, volumenTotalArea, ...base };
}

// ── VERIFICACIÓN EXTERNA DE VENTAS ──────────────────────────────
// No es un cálculo — es un lugar para guardar el número que CADA sistema (B2B,
// B2C) declara por su cuenta, para poder comparar contra lo que fën calculó a
// partir de Ventas_mensuales_consolidadas. Si no coinciden, es señal real de
// que algo no está sincronizando bien (ej. productos sin vincular) — no algo
// que fën pueda inferir ni adivinar solo, tiene que venir de la fuente misma.
// Trae en vivo, directo del CSV que B2B publica, el total neto que ELLOS
// declaran por su cuenta (sin depender de qué productos tengan vinculados a
// receta) — reemplaza el ingreso manual para B2B específicamente. B2C sigue
// siendo manual hasta que exista un CSV equivalente de su parte.
// Genérica para ambos sistemas — B2B publica {mes, total_neto} directo; B2C
// publica {mes, sucursal, total_neto} con 3 filas por mes (Ainavillo, Barros
// Arana, TOTAL) — en ese caso se usa solo la fila TOTAL, ya viene sumada.
function leerVentasTotalExterno(sistema) {
  const urls = obtenerUrlsVentasCSV();
  const url = sistema === 'B2B' ? urls.ventasTotalB2B : urls.verificacionB2C;
  if (!url) return { ok: true, filas: [] };
  try {
    const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, msg: 'HTTP ' + res.getResponseCode() };
    const filasCsv = Utilities.parseCsv(res.getContentText());
    if (!filasCsv.length) return { ok: true, filas: [] };
    const headers = filasCsv[0];
    const idxMes = _buscarColumna(headers, ['mes']);
    const idxTotal = _buscarColumna(headers, ['total']);
    const idxSucursal = _buscarColumna(headers, ['sucursal']);
    if (idxMes < 0 || idxTotal < 0) return { ok: false, msg: 'No se encontraron las columnas mes/total_neto en el CSV' };
    let filas = filasCsv.slice(1).map(f => ({
      mes: _normalizarMesVentas(f[idxMes]),
      sucursal: idxSucursal > -1 ? (f[idxSucursal]||'').toString() : null,
      total_neto: parseFloat(f[idxTotal]) || 0
    })).filter(f => f.mes);
    if (idxSucursal > -1) filas = filas.filter(f => f.sucursal.toUpperCase() === 'TOTAL');
    return { ok: true, filas };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}
function leerVentasTotalB2BExterno() { return leerVentasTotalExterno('B2B'); }
function leerVentasTotalB2CExterno() { return leerVentasTotalExterno('B2C'); }

// Sincroniza CobrosMensualesB2B a una hoja propia — no se usa todavía (queda
// listo para cuando se construya Flujo de Caja), pero se guarda desde ya para
// no perder el historial mientras tanto.
function sincronizarCobrosB2B() {
  const urls = obtenerUrlsVentasCSV();
  if (!urls.cobrosB2B) return { ok: false, msg: 'No hay URL de Cobros mensuales B2B configurada' };
  try {
    const res = UrlFetchApp.fetch(urls.cobrosB2B, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) return { ok: false, msg: 'HTTP ' + res.getResponseCode() };
    const filasCsv = Utilities.parseCsv(res.getContentText());
    if (!filasCsv.length) return { ok: false, msg: 'CSV vacío' };
    const headers = filasCsv[0];
    const idxMes = _buscarColumna(headers, ['mes']);
    const idxMonto = _buscarColumna(headers, ['monto', 'cobrado']);
    if (idxMes < 0 || idxMonto < 0) return { ok: false, msg: 'No se encontraron las columnas mes/monto_cobrado en el CSV' };

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let h = ss.getSheetByName('Cobros_mensuales_B2B');
    if (!h) {
      h = ss.insertSheet('Cobros_mensuales_B2B');
    } else {
      h.clear();
    }
    h.getRange(1,1,1,3).setValues([['mes','monto_cobrado','fecha_sincronizado']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
    h.getRange(2,4,Math.max(h.getMaxRows()-1,1),1).setNumberFormat('@'); // por si acaso, aunque mes va en col 1

    const filas = filasCsv.slice(1).map(f => [
      _normalizarMesVentas(f[idxMes]), parseFloat(f[idxMonto]) || 0, new Date().toISOString()
    ]).filter(f => f[0]);
    if (filas.length) {
      h.getRange(2,1,filas.length,3).setValues(filas);
      h.getRange(2,1,filas.length,1).setNumberFormat('@'); // forzar texto en mes, mismo bug de siempre
    }
    return { ok: true, msg: filas.length + ' mes(es) sincronizados de Cobros B2B' };
  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function guardarVerificacionVentasExterna(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Verificacion_ventas_externa');
  if (!h) {
    h = ss.insertSheet('Verificacion_ventas_externa');
    h.getRange(1,1,1,4).setValues([['mes','sistema','monto_declarado','fecha_ingreso']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxMes = headers.indexOf('mes');
  const idxSistema = headers.indexOf('sistema');
  const idxMonto = headers.indexOf('monto_declarado');
  const mesLimpio = _normalizarMesVentas(datos.mes);

  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,headers.length).getValues() : [];
  let filaExistente = -1;
  vals.forEach((r,i) => { if (_normalizarMesVentas(r[idxMes]) === mesLimpio && r[idxSistema] === datos.sistema) filaExistente = i + 2; });

  if (filaExistente > 0) {
    h.getRange(filaExistente, idxMonto+1).setValue(parseFloat(datos.monto)||0);
    h.getRange(filaExistente, headers.indexOf('fecha_ingreso')+1).setValue(new Date());
  } else {
    h.appendRow([mesLimpio, datos.sistema, parseFloat(datos.monto)||0, new Date()]);
  }
  return { ok: true, msg: 'Verificación guardada' };
}

function leerVerificacionVentasExterna() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('Verificacion_ventas_externa');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map(row => { const o = {}; headers.forEach((hh,j)=>o[hh]=row[j]); o.mes = _normalizarMesVentas(o.mes); return o; });
  return { ok: true, filas };
}

function generarInformeGeneral(datos) {
  const mes = datos.mes;
  if (!mes) return { ok: false, msg: 'Falta el mes' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const AREAS_REALES = ['PAN', 'BOL', 'CAF', 'PAS'];
  const nombrePorCodigo = { PAN:'Panadería', BOL:'Bollería', CAF:'Cafetería', PAS:'Pastelería' };

  // 1. Ventas del mes, ya separadas por área. Reventa se trata aparte, con su
  // propio costo (ver punto 3b) — es un negocio real (compra y vende), a
  // diferencia de Servicios/Despacho, que va incluido dentro del monto que el
  // cliente ya paga en su orden de B2B — sumarlo aparte sería contarlo dos veces.
  const ventas = leerVentasMensualesConsolidadas().filter(v => _normalizarMesVentas(v.mes) === _normalizarMesVentas(mes));
  const ventasNetoPorArea = {};
  const ventasPorCanal = { B2B: 0, B2C: 0 }; // desglose por canal — 4 áreas + Reventa, sin Servicios/Despacho
  let ventasReventaNeto = 0;
  let ventasOtros = 0; // Servicios (despacho) — no tiene costo propio que restarle, se muestra aparte
  ventas.forEach(v => {
    const areaNombre = v['área'] || v.área || '';
    const codigo = Object.keys(nombrePorCodigo).find(k => nombrePorCodigo[k] === areaNombre);
    const monto = parseFloat(v.monto_neto) || 0;
    const esReventa = areaNombre.toLowerCase() === 'reventa';
    if (codigo) {
      ventasNetoPorArea[codigo] = (ventasNetoPorArea[codigo] || 0) + monto;
    } else if (esReventa) {
      ventasReventaNeto += monto;
    } else {
      ventasOtros += monto; // Servicios/Despacho
    }
    // El desglose B2B/B2C se compara contra el TOTAL que cada sistema declara
    // por su cuenta (VentasMensualesTotalB2B / VerificacionVentasFen) — y ese
    // total no distingue producción de Servicios/Despacho, viene todo junto
    // (el despacho va incluido dentro del monto de cada orden). Por eso acá se
    // suma TODO sin filtrar por área — la exclusión de Servicios/Despacho solo
    // aplica al cálculo de utilidad POR ÁREA de producción (arriba), no a esta
    // comparación contra el total externo.
    const canal = v.canal === 'B2B' ? 'B2B' : 'B2C';
    ventasPorCanal[canal] += monto;
  });

  // 2. Gastos ya prorrateados — misma fuente que "Config de costeo"
  const gastosDetalle = leerGastosPorAreaConProrrateo({ mes });

  // 3. MP consumida por área — cruza EC_productos (costo_MP_unit) con las
  // cantidades reales vendidas ese mes, sumando B2B+B2C por producto.
  const hEC = ss.getSheetByName('EC_productos');
  let ecPorId = {};
  if (hEC && hEC.getLastRow() > 1) {
    const ecHeaders = hEC.getRange(1,1,1,hEC.getLastColumn()).getValues()[0];
    hEC.getRange(2,1,hEC.getLastRow()-1,ecHeaders.length).getValues().forEach(r => {
      const o = {}; ecHeaders.forEach((c,i) => o[c] = r[i]);
      if (_normalizarMesVentas(o.mes) === _normalizarMesVentas(mes)) ecPorId[o.ID_receta] = o;
    });
  }
  const cantidadVendidaPorId = {};
  ventas.forEach(v => {
    cantidadVendidaPorId[v.ID_receta] = (cantidadVendidaPorId[v.ID_receta] || 0) + (parseFloat(v.cantidad_vendida) || 0);
  });
  const mpConsumidaPorArea = {};
  AREAS_REALES.forEach(cod => { mpConsumidaPorArea[cod] = 0; });
  Object.keys(cantidadVendidaPorId).forEach(idReceta => {
    const ec = ecPorId[idReceta];
    if (!ec) return; // sin costo calculado ese mes — no se puede estimar su MP consumida
    const codigo = Object.keys(nombrePorCodigo).find(k => nombrePorCodigo[k] === ec['área']);
    if (!codigo) return;
    mpConsumidaPorArea[codigo] += (parseFloat(ec.costo_MP_unit) || 0) * cantidadVendidaPorId[idReceta];
  });

  // 4. Armar el resumen por área
  const areas = AREAS_REALES.map(cod => {
    const participacion = gastosDetalle.participacion?.[cod] || 0;
    const fijosPropios = gastosDetalle.datos?.[cod]?.fijos || 0;
    const fijosCompartidos = (gastosDetalle.general?.fijos || 0) * participacion;
    const remuneracionPropia = gastosDetalle.datos?.[cod]?.remuneracion || 0;
    const remuneracionCompartida = (gastosDetalle.general?.remuneracion || 0) * participacion;
    const mpConsumida = mpConsumidaPorArea[cod] || 0;
    const ventasNeto = ventasNetoPorArea[cod] || 0;
    const totalGastos = mpConsumida + fijosPropios + fijosCompartidos + remuneracionPropia + remuneracionCompartida;
    const utilidad = ventasNeto - totalGastos;
    return {
      area: nombrePorCodigo[cod],
      codigo: cod,
      ventasNeto, ventasBruto: ventasNeto * 1.19,
      mpConsumida, fijosPropios, fijosCompartidos, remuneracionPropia, remuneracionCompartida,
      totalGastos,
      utilidad, utilidadPct: ventasNeto > 0 ? (utilidad / ventasNeto) * 100 : null,
      cubreCostos: ventasNeto > 0 ? utilidad >= 0 : null
    };
  });

  const total = areas.reduce((acc, a) => {
    acc.ventasNeto += a.ventasNeto; acc.mpConsumida += a.mpConsumida;
    acc.fijosPropios += a.fijosPropios; acc.fijosCompartidos += a.fijosCompartidos;
    acc.remuneracionPropia += a.remuneracionPropia; acc.remuneracionCompartida += a.remuneracionCompartida;
    acc.totalGastos += a.totalGastos; acc.utilidad += a.utilidad;
    return acc;
  }, { ventasNeto:0, mpConsumida:0, fijosPropios:0, fijosCompartidos:0, remuneracionPropia:0, remuneracionCompartida:0, totalGastos:0, utilidad:0 });
  total.ventasBruto = total.ventasNeto * 1.19;
  total.utilidadPct = total.ventasNeto > 0 ? (total.utilidad / total.ventasNeto) * 100 : null;
  total.cubreCostos = total.ventasNeto > 0 ? total.utilidad >= 0 : null;

  return { ok: true, mes, areas, total, ventasOtros, ventasPorCanal };
}

function generarInformeAuditoria(datos) {
  const area = datos.area;
  const mes = datos.mes;
  if (!area || !mes) return { ok: false, msg: 'Falta área o mes' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const nombreAreaCompleto = { PAN:'Panadería', BOL:'Bollería', CAF:'Cafetería', PAS:'Pastelería' }[area] || area;

  // 1. Config de costeo — la base del prorrateo
  const cfgRes = leerConfigCosteo({ area, mes });
  const cfg = cfgRes.filas && cfgRes.filas.length ? cfgRes.filas[cfgRes.filas.length - 1] : null;

  // 2. Gastos desglosados — mismo detalle que se ve en "Config de costeo" al sincronizar
  let gastosDetalle = null;
  try { gastosDetalle = leerGastosPorAreaConProrrateo({ mes }); } catch(e) {}

  // 3. EC_productos — los cálculos ya guardados (no se recalculan acá)
  const hEC = ss.getSheetByName('EC_productos');
  let filasEC = [];
  if (hEC && hEC.getLastRow() > 1) {
    const ecHeaders = hEC.getRange(1,1,1,hEC.getLastColumn()).getValues()[0];
    const ecVals = hEC.getRange(2,1,hEC.getLastRow()-1,ecHeaders.length).getValues();
    filasEC = ecVals
      .map(r => { const o = {}; ecHeaders.forEach((c,i) => o[c] = r[i]); return o; })
      .filter(r => r['área'] === nombreAreaCompleto && _normalizarMesVentas(r.mes) === _normalizarMesVentas(mes));
    if (datos.ID_receta) filasEC = filasEC.filter(r => r.ID_receta === datos.ID_receta);
  }
  if (!filasEC.length) return { ok: false, msg: 'No hay Estructura de costo calculada para ' + nombreAreaCompleto + ' / ' + mes + '. Calcúlela primero.' };

  // 4. Maestro_recetas — para el desglose ingrediente por ingrediente de cada producto
  const hMaestro = ss.getSheetByName('Maestro_recetas');
  const maestroPorId = {};
  if (hMaestro && hMaestro.getLastRow() > 1) {
    const mHeaders = hMaestro.getRange(1,1,1,hMaestro.getLastColumn()).getValues()[0];
    hMaestro.getRange(2,1,hMaestro.getLastRow()-1,mHeaders.length).getValues().forEach(r => {
      const o = {}; mHeaders.forEach((c,i) => o[c] = r[i]);
      maestroPorId[o.ID_receta] = o;
    });
  }

  // 5. Ventas reales del mes, para comparar contra el precio sugerido
  const ventasDelMes = leerVentasMensualesConsolidadas().filter(v => _normalizarMesVentas(v.mes) === _normalizarMesVentas(mes));

  // 5b. Total de ventas del área (todas sus recetas, no solo las que tienen EC
  // calculada) — separado por canal, para el resumen de arriba del informe.
  const ventasDelArea = ventasDelMes.filter(v => (v['área'] || v.área) === nombreAreaCompleto);
  const ventasAreaResumen = { b2c: { cantidad: 0, monto: 0 }, b2b: { cantidad: 0, monto: 0 } };
  ventasDelArea.forEach(v => {
    const bucket = v.canal === 'B2B' ? ventasAreaResumen.b2b : ventasAreaResumen.b2c;
    bucket.cantidad += parseFloat(v.cantidad_vendida) || 0;
    bucket.monto += parseFloat(v.monto_neto) || 0;
  });
  ventasAreaResumen.total = {
    cantidad: ventasAreaResumen.b2c.cantidad + ventasAreaResumen.b2b.cantidad,
    monto: ventasAreaResumen.b2c.monto + ventasAreaResumen.b2b.monto
  };

  // 6. Determinar el método de prorrateo usado — se nota solo mirando si el costo
  // fijo por unidad es igual para todos los productos (unidad) o varía según su
  // peso (peso) — no hace falta guardarlo aparte, el patrón ya lo revela.
  const fijosUnitDistintos = new Set(filasEC.map(r => Math.round((parseFloat(r.costos_fijos_unit)||0)*100))).size > 1;
  const metodoProrrateo = fijosUnitDistintos ? 'peso' : 'unidad';

  const productos = filasEC.map(ec => {
    const receta = maestroPorId[ec.ID_receta] || {};
    let ingredientes = [], insumos = [];
    try { ingredientes = JSON.parse(receta.ingredientes_JSON || '[]'); } catch(e) {}
    try { insumos = JSON.parse(receta.insumos_JSON || '[]'); } catch(e) {}
    const pesoUnidad = _pesoUnidadReceta(receta);

    const ventasProducto = ventasDelMes.filter(v => v.ID_receta === ec.ID_receta);
    const ventasPorCanal = ventasProducto.map(v => {
      const cantidad = parseFloat(v.cantidad_vendida) || 0;
      const monto = parseFloat(v.monto_neto) || 0;
      const precioReal = cantidad > 0 ? monto / cantidad : 0;
      const costoReal = parseFloat(ec.total_costo_prod) || 0;
      const margenPct = precioReal > 0 ? ((precioReal - costoReal) / precioReal) * 100 : null;
      const objetivoPct = v.canal === 'B2B' ? parseFloat(ec['utilidad_B2B_%']) : parseFloat(ec['utilidad_B2C_%']);
      return { canal: v.canal, cantidad, monto, precioReal, margenPct, objetivoPct, cumple: margenPct !== null ? margenPct >= objetivoPct : null };
    });

    return {
      ID_receta: ec.ID_receta,
      nombre: ec.nombre,
      porcionesBase: receta.porciones_base || 1,
      pesoUnidad,
      ingredientes: ingredientes.map(i => ({ nombre: i.nombre, gramos: i.gramos, unidades: i.unidades, costo: i.costo })),
      insumos: insumos.map(i => ({ nombre: i.nombre, unidades: i.unidades, costo: i.costo })),
      costoMPUnit: parseFloat(ec.costo_MP_unit) || 0,
      costoInsumosUnit: parseFloat(ec.costo_insumos_unit) || 0,
      mermaPct: parseFloat(ec['merma_%']) || 0,
      costoMermaUnit: parseFloat(ec.costo_merma_unit) || 0,
      costosFijosUnit: parseFloat(ec.costos_fijos_unit) || 0,
      costosFijosPct: parseFloat(ec['costos_fijos_%']) || 0,
      remuneracionUnit: parseFloat(ec.remuneraciones_unit) || 0,
      remuneracionPct: parseFloat(ec['remuneraciones_%']) || 0,
      totalCostoProduccion: parseFloat(ec.total_costo_prod) || 0,
      utilidadB2CPct: parseFloat(ec['utilidad_B2C_%']) || 0,
      precioB2C: parseFloat(ec.precio_B2C) || 0,
      utilidadB2BPct: parseFloat(ec['utilidad_B2B_%']) || 0,
      precioB2B: parseFloat(ec.precio_B2B) || 0,
      metaB2CMes: parseFloat(ec.meta_B2C_mes) || 0,
      metaB2BMes: parseFloat(ec.meta_B2B_mes) || 0,
      ventasReales: ventasPorCanal,
      fechaCalculo: ec.fecha_calculo
    };
  });

  return {
    ok: true,
    area: nombreAreaCompleto,
    mes,
    config: cfg ? {
      fijosMonto: parseFloat(cfg.costos_fijos_monto)||0,
      remuneracionMonto: parseFloat(cfg.remuneracion_monto)||0,
      mermaPct: parseFloat(cfg.merma_pct)||0,
      utilidadB2CPct: parseFloat(cfg.utilidad_b2c_pct)||0,
      utilidadB2BPct: parseFloat(cfg.utilidad_b2b_pct)||0,
      fuente: cfg.fuente || '',
      fechaActualizacion: cfg.fecha_actualizacion || ''
    } : null,
    gastos: gastosDetalle,
    ventasAreaResumen,
    metodoProrrateo,
    productos
  };
}

function calcularEC(datos) {
  const area = datos.area;
  const mes  = datos.mes;
  if (!area || !mes) return { ok: false, msg: 'Falta área o mes' };

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Traer config de esa área/mes — si viene datos.filaConfig, usar esa fila
  // específica (elegida por el usuario cuando hay varias guardadas para el mismo
  // área/mes). Si no viene, usar la última como respaldo (comportamiento anterior).
  const cfgRes = leerConfigCosteo({ area, mes });
  const cfg = datos.filaConfig
    ? (cfgRes.filas || []).find(f => f._fila === parseInt(datos.filaConfig))
    : (cfgRes.filas && cfgRes.filas.length ? cfgRes.filas[cfgRes.filas.length - 1] : null);
  if (!cfg) return { ok: false, msg: 'No hay Config_costeo guardada para ' + area + ' / ' + mes + '. Sincronice y guarde primero.' };
  if (cfgRes.filas.length > 1 && !datos.filaConfig) {
    Logger.log('ADVERTENCIA: ' + cfgRes.filas.length + ' filas duplicadas encontradas para ' + area + '/' + mes + ' en Config_costeo. Usando la última.');
  }

  const fijosMonto = parseFloat(cfg.costos_fijos_monto) || 0;
  const remuneracionMonto = parseFloat(cfg.remuneracion_monto) || 0;
  const mermaPct = (parseFloat(cfg.merma_pct) || 0) / 100;
  const utilidadB2CPct = (parseFloat(cfg.utilidad_b2c_pct) || 0) / 100;
  const utilidadB2BPct = (parseFloat(cfg.utilidad_b2b_pct) || 0) / 100;

  // 2. Recetas activas del área (Maestro_recetas ya tiene costo_MP_unitario y costo_insumos_unitario de Fase 1)
  const hMaestro = ss.getSheetByName('Maestro_recetas');
  if (!hMaestro) return { ok: false, msg: 'Hoja Maestro_recetas no encontrada' };
  const mHeaders = hMaestro.getRange(1,1,1,hMaestro.getLastColumn()).getValues()[0];
  const mVals = hMaestro.getRange(2,1,hMaestro.getLastRow()-1,mHeaders.length).getValues();
  const areaNombreCol = mHeaders.indexOf('área');
  const tipoCol = mHeaders.indexOf('tipo_receta');

  const nombreAreaCompleto = { PAN:'Panadería', BOL:'Bollería', CAF:'Cafetería', PAS:'Pastelería' }[area] || area;

  const recetas = mVals
    .map(r => { const o = {}; mHeaders.forEach((c,i) => o[c] = r[i]); return o; })
    .filter(r => r['área'] === nombreAreaCompleto && r.tipo_receta !== 'sub_receta' && !r.variante_de_id);

  if (!recetas.length) return { ok: false, msg: 'No hay recetas consolidadas para ' + nombreAreaCompleto };

  // 3. Total de unidades del área: preferir el volumen mensual real (de la Estimación
  // de demanda, calculado en el frontend) — si no viene (área sin estimación aún, como
  // Pastelería), caer de vuelta a la suma de porciones_base como aproximación de respaldo.
  const volumenReal = parseInt(datos.volumenTotalReal) || 0;
  const totalUnidades = volumenReal > 0
    ? volumenReal
    : recetas.reduce((s,r) => s + (parseInt(r.porciones_base) || 0), 0);
  if (!totalUnidades) return { ok: false, msg: 'No hay volumen real ni porciones_base para calcular el prorrateo.' };

  const costosFijosUnit = fijosMonto / totalUnidades;
  const remuneracionUnit = remuneracionMonto / totalUnidades;

  // Prorrateo por PESO en vez de por unidad — un producto grande absorbe más
  // costo fijo que uno chico, en vez de que todos paguen la misma cuota plana
  // (que infla desproporcionadamente el precio de los productos pequeños).
  // Disponible en las 4 áreas — el usuario elige el método en la pantalla.
  const usaPeso = datos.metodoProrrateo === 'peso';
  let costosFijosPorGramo = 0, remuneracionPorGramo = 0, totalGramosArea = 0;
  if (usaPeso) {
    const volumenPorProductoTmp = datos.volumenPorProducto || {};
    recetas.forEach(r => {
      const volProd = volumenPorProductoTmp[r.nombre] || { b2c: 0, b2b: 0 };
      const unidadesReceta = (volProd.b2c||0) + (volProd.b2b||0);
      totalGramosArea += unidadesReceta * _pesoUnidadReceta(r);
    });
    if (totalGramosArea > 0) {
      costosFijosPorGramo = fijosMonto / totalGramosArea;
      remuneracionPorGramo = remuneracionMonto / totalGramosArea;
    }
  }
  const usaPesoReal = usaPeso && totalGramosArea > 0;

  // 3b. Si se pidió un solo producto (datos.ID_receta), calcular igual el prorrateo
  // con el volumen del ÁREA COMPLETA (arriba) — es correcto que un solo producto
  // cargue su parte proporcional de costos fijos como si el resto siguiera
  // produciéndose normal — pero solo se guarda/devuelve la fila de ese producto.
  const recetasAProcesar = datos.ID_receta
    ? recetas.filter(r => r.ID_receta === datos.ID_receta)
    : recetas;
  if (datos.ID_receta && !recetasAProcesar.length) {
    return { ok: false, msg: 'No se encontró la receta ' + datos.ID_receta + ' en ' + nombreAreaCompleto };
  }

  // 4. Por receta: costo directo + merma + fijos/remuneración (parejo por unidad) + utilidad -> precio
  const volumenPorProducto = datos.volumenPorProducto || {};
  const filasEC = recetasAProcesar.map(r => {
    const costoMP = parseFloat(r.costo_MP_unitario) || 0;
    const costoInsumos = parseFloat(r.costo_insumos_unitario) || 0;
    const costoMerma = costoMP * mermaPct;
    const pesoUnidadReceta = _pesoUnidadReceta(r);
    const costosFijosUnitReceta = usaPesoReal ? costosFijosPorGramo * pesoUnidadReceta : costosFijosUnit;
    const remuneracionUnitReceta = usaPesoReal ? remuneracionPorGramo * pesoUnidadReceta : remuneracionUnit;
    const totalCostoProduccion = costoMP + costoInsumos + costoMerma + costosFijosUnitReceta + remuneracionUnitReceta;

    const valorNetoB2C = totalCostoProduccion * (1 + utilidadB2CPct);
    const precioB2C = valorNetoB2C * 1.19;
    const valorNetoB2B = totalCostoProduccion * (1 + utilidadB2BPct);
    const precioB2B = valorNetoB2B * 1.19;

    // Volumen estimado del producto (de la Estimación de demanda) — coincide por nombre exacto.
    // Si no hay coincidencia (producto sin historial de venta, o nombre distinto), queda en 0.
    const volProd = volumenPorProducto[r.nombre] || { b2c: 0, b2b: 0 };

    return {
      ID_receta: r.ID_receta,
      nombre: r.nombre,
      área: nombreAreaCompleto,
      mes: mes,
      costo_MP_unit: costoMP,
      costo_insumos_unit: costoInsumos,
      'merma_%': mermaPct * 100,
      costo_merma_unit: costoMerma,
      'costos_fijos_%': totalCostoProduccion ? (costosFijosUnitReceta / totalCostoProduccion * 100) : 0,
      costos_fijos_unit: costosFijosUnitReceta,
      'remuneraciones_%': totalCostoProduccion ? (remuneracionUnitReceta / totalCostoProduccion * 100) : 0,
      remuneraciones_unit: remuneracionUnitReceta,
      total_costo_prod: totalCostoProduccion,
      'utilidad_B2C_%': utilidadB2CPct * 100,
      valor_neto_B2C: valorNetoB2C,
      'utilidad_B2B_%': utilidadB2BPct * 100,
      valor_neto_B2B: valorNetoB2B,
      'utilidad_mes_%': utilidadB2CPct * 100,
      precio_B2C: precioB2C,
      precio_B2B: precioB2B,
      meta_B2C_mes: volProd.b2c,
      venta_est_B2C: volProd.b2c * valorNetoB2C,
      meta_B2B_mes: volProd.b2b,
      venta_est_B2B: volProd.b2b * valorNetoB2B,
      fecha_calculo: new Date()
    };
  });

  // 5. Escribir en EC_productos (upsert por ID_receta — cada receta tiene una sola fila vigente)
  let hEC = ss.getSheetByName('EC_productos');
  const headersEC = ['ID_receta','área','nombre','costo_MP_unit','merma_%','costo_merma_unit','costos_fijos_%',
    'costos_fijos_unit','remuneraciones_%','remuneraciones_unit','total_costo_prod','utilidad_B2C_%','valor_neto_B2C',
    'precio_B2C','utilidad_B2B_%','valor_neto_B2B','precio_B2B','utilidad_mes_%','mes','costo_insumos_unit','fecha_calculo',
    'meta_B2C_mes','venta_est_B2C','meta_B2B_mes','venta_est_B2B'];
  if (!hEC) {
    hEC = ss.insertSheet('EC_productos');
    hEC.getRange(1,1,1,headersEC.length).setValues([headersEC]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    hEC.setFrozenRows(1);
  }
  // Asegurar que existan todas las columnas que el código necesita — la hoja pudo
  // haberse creado con una versión anterior que no tenía, por ejemplo, "mes"
  // (eso pasó acá: el cálculo nunca tenía dónde escribir el mes, por eso "Rentabilidad
  // real" nunca encontraba coincidencias). Se agregan las que falten, sin tocar las existentes.
  let ecHeaders = hEC.getRange(1,1,1,hEC.getLastColumn()).getValues()[0];
  const columnasFaltantes = headersEC.filter(h => ecHeaders.indexOf(h) === -1);
  if (columnasFaltantes.length) {
    hEC.getRange(1, ecHeaders.length+1, 1, columnasFaltantes.length).setValues([columnasFaltantes])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    ecHeaders = hEC.getRange(1,1,1,hEC.getLastColumn()).getValues()[0];
  }
  const ecVals = hEC.getLastRow() > 1 ? hEC.getRange(2,1,hEC.getLastRow()-1,ecHeaders.length).getValues() : [];
  const idColIdx = ecHeaders.indexOf('ID_receta');
  const mesColIdx = ecHeaders.indexOf('mes');
  const fechaColIdx = ecHeaders.indexOf('fecha_calculo');

  // Limpieza de duplicados que ya existan (de antes de esta corrección, cuando el
  // upsert solo miraba ID_receta sin considerar el mes) — se queda con la fila
  // más recientemente calculada de cada combinación ID_receta+mes, borra el resto.
  // Usa _normalizarMesVentas (no comparación de texto cruda) porque una fila vieja
  // puede tener el mes guardado como fecha real en vez de texto — comparando crudo,
  // "2026-07" y esa misma fecha como objeto Date nunca calzaban, así que la
  // limpieza no reconocía la fila vieja como duplicado y la dejaba viva.
  const vistosEC = {};
  const filasParaBorrarEC = [];
  ecVals.forEach((r, i) => {
    const clave = String(r[idColIdx]).trim() + '|' + _normalizarMesVentas(r[mesColIdx]);
    if (vistosEC[clave] === undefined) {
      vistosEC[clave] = i;
    } else {
      // Ya había una — quedarse con la de fecha_calculo más reciente
      const filaExistente = vistosEC[clave];
      const fechaExistente = new Date(ecVals[filaExistente][fechaColIdx] || 0).getTime();
      const fechaActual = new Date(r[fechaColIdx] || 0).getTime();
      if (fechaActual >= fechaExistente) {
        filasParaBorrarEC.push(filaExistente + 2);
        vistosEC[clave] = i;
      } else {
        filasParaBorrarEC.push(i + 2);
      }
    }
  });
  if (filasParaBorrarEC.length) {
    filasParaBorrarEC.sort((a,b) => b-a).forEach(fila => hEC.deleteRow(fila)); // de abajo hacia arriba
  }
  // Releer después de borrar, para que el upsert de abajo trabaje con el estado limpio
  const ecValsLimpio = hEC.getLastRow() > 1 ? hEC.getRange(2,1,hEC.getLastRow()-1,ecHeaders.length).getValues() : [];

  filasEC.forEach(fila => {
    const filaArr = ecHeaders.map(col => fila[col] !== undefined ? fila[col] : '');
    let rowIdx = -1;
    for (let i = 0; i < ecValsLimpio.length; i++) {
      // Emparejar por ID_receta Y mes juntos — antes solo miraba ID_receta, así
      // que una fila vieja de otro mes se confundía con la actual y terminaba
      // creando filas duplicadas en vez de actualizar la correcta.
      if (ecValsLimpio[i][idColIdx] === fila.ID_receta && _normalizarMesVentas(ecValsLimpio[i][mesColIdx]) === _normalizarMesVentas(fila.mes)) {
        rowIdx = i + 2; break;
      }
    }
    const targetRow = rowIdx > 0 ? rowIdx : hEC.getLastRow() + 1;
    if (rowIdx > 0) {
      hEC.getRange(rowIdx, 1, 1, filaArr.length).setValues([filaArr]);
    } else {
      hEC.appendRow(filaArr);
      ecValsLimpio.push(filaArr); // para que dentro del mismo bucle (varios productos a la vez) no se vuelva a duplicar esta misma fila
    }
    // Forzar formato numérico plano en las columnas de costo/precio — evita que un
    // formato de % o moneda heredado de la celda distorsione el número (ej. 30 -> "3000%")
    const colsNumericas = ['costo_MP_unit','costo_insumos_unit','merma_%','costo_merma_unit','costos_fijos_%',
      'costos_fijos_unit','remuneraciones_%','remuneraciones_unit','total_costo_prod','utilidad_B2C_%',
      'valor_neto_B2C','utilidad_B2B_%','valor_neto_B2B','utilidad_mes_%','precio_B2C','precio_B2B',
      'meta_B2C_mes','venta_est_B2C','meta_B2B_mes','venta_est_B2B'];
    colsNumericas.forEach(col => {
      const colIdx = ecHeaders.indexOf(col);
      if (colIdx > -1) hEC.getRange(targetRow, colIdx + 1).setNumberFormat('0.####');
    });
    // Forzar "mes" a texto plano — evita que Sheets reinterprete "2026-07" como
    // fecha y lo reformatee solo (mismo bug que ya corregimos en Ventas_mensuales_consolidadas)
    const colMes = ecHeaders.indexOf('mes');
    if (colMes > -1) hEC.getRange(targetRow, colMes + 1).setNumberFormat('@').setValue(fila.mes);
  });

  return {
    ok: true,
    msg: filasEC.length + ' productos calculados para ' + nombreAreaCompleto + ' / ' + mes
      + (filasParaBorrarEC.length ? ` — se limpiaron ${filasParaBorrarEC.length} duplicado(s) de antes` : '')
      + (usaPesoReal ? ' — prorrateo de fijos/remuneración por PESO' : ' — prorrateo por unidad')
  };
}

function obtenerCorreosJefas() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const h = ss.getSheetByName('Config');
    if (h && h.getLastRow() >= 2) {
      const claves = h.getRange(2, 1, h.getLastRow()-1, 1).getValues().flat();
      const idx = claves.indexOf('correos_jefas');
      if (idx >= 0) {
        const valor = h.getRange(idx + 2, 2).getValue();
        if (valor) {
          const guardado = JSON.parse(valor);
          // Combina lo guardado con la constante como respaldo, por si falta algún área
          return { ...CORREOS_JEFAS, ...guardado };
        }
      }
    }
  } catch(e) {
    Logger.log('No se pudo leer correos_jefas de Config, usando respaldo: ' + e.message);
  }
  return CORREOS_JEFAS;
}

function guardarCorreosJefas(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Config');
  if (!h) {
    h = ss.insertSheet('Config');
    h.getRange(1,1,1,3).setValues([['clave','valor','descripcion']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const claves = h.getLastRow() >= 2 ? h.getRange(2, 1, h.getLastRow()-1, 1).getValues().flat() : [];
  const idx = claves.indexOf('correos_jefas');
  const valor = JSON.stringify(datos.correos || {});
  if (idx >= 0) {
    h.getRange(idx + 2, 2).setValue(valor);
  } else {
    h.appendRow(['correos_jefas', valor, 'Correos de contacto por área, editable desde Admin']);
  }
  return { ok: true, msg: 'Correos actualizados' };
}

function enviarNotificacionJefa(areaCodigo, asunto, cuerpoHtml, esUrgente) {
  const correos = obtenerCorreosJefas();
  const correo = correos[areaCodigo];
  if (!correo) return;
  try {
    const colorBorde = esUrgente ? '#C62828' : '#003a79';
    const colorFondo = esUrgente ? '#FFEBEE' : '#F5F5F5';
    const htmlCompleto = `
      <div style="font-family:Arial,sans-serif;max-width:480px">
        <div style="background:${colorFondo};border-left:4px solid ${colorBorde};border-radius:4px;padding:14px 18px;margin-bottom:12px">
          <p style="margin:0;font-size:14px;color:#333;line-height:1.5">${cuerpoHtml}</p>
        </div>
        <p style="font-size:12px;color:#999">Revisa en <a href="https://panaderiafen.github.io/fen-produccion/">fën</a>.</p>
      </div>`;
    const textoPlano = cuerpoHtml.replace(/<[^>]+>/g, '') + '\n\nRevisa en fën.';
    MailApp.sendEmail(correo, '[fën] ' + asunto, textoPlano, { htmlBody: htmlCompleto });
  } catch(e) {
    Logger.log('Error enviando email a jefa ' + areaCodigo + ': ' + e.message);
  }
}

function enviarNotificacionAdmin(asunto, cuerpo) {
  try {
    MailApp.sendEmail('emmanuel.vepal@gmail.com', '[fën] ' + asunto, cuerpo);
  } catch(e) {
    Logger.log('Error enviando email: ' + e.message);
    // Fallback: save to Sheet for manual review
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let h = ss.getSheetByName('Notificaciones_pendientes');
      if (!h) {
        h = ss.insertSheet('Notificaciones_pendientes');
        h.getRange(1,1,1,3).setValues([['fecha','asunto','cuerpo']]);
      }
      h.appendRow([new Date().toISOString(), asunto, cuerpo]);
    } catch(e2) {}
  }
}

// ── SOLICITUD DE HABILITACIÓN DE MP EXISTENTE PARA OTRA ÁREA ──────
// Flujo liviano: la MP ya existe (precio, unidad, todo definido) — solo falta
// que Admin agregue el área a "areas_habilitadas". No pasa por revisión de
// precio ni por el flujo de "solicitar MP nueva".
function solicitarHabilitacionMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Solicitudes_habilitacion');
  if (!h) {
    h = ss.insertSheet('Solicitudes_habilitacion');
    h.getRange(1,1,1,6).setValues([['id','mp_id','mp_nombre','area_codigo','fecha','estado']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,6).getValues() : [];
  const yaExiste = vals.some(r => r[1] === datos.mp_id && r[3] === datos.area_codigo && r[5] === 'pendiente');
  if (yaExiste) return { ok: true, msg: 'Ya había una solicitud pendiente para esta área', id: null };

  const id = 'SH_' + Date.now();
  h.appendRow([id, datos.mp_id, datos.mp_nombre || '', datos.area_codigo, new Date().toISOString(), 'pendiente']);
  return { ok: true, msg: 'Solicitud de habilitación enviada — Admin la verá en Materias primas', id };
}

function leerSolicitudesHabilitacion() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('Solicitudes_habilitacion');
  if (!h || h.getLastRow() < 2) return [];
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  return vals
    .map(row => { const o = {}; headers.forEach((hh,j)=>o[hh]=row[j]); return o; })
    .filter(o => o.estado === 'pendiente');
}

function resolverSolicitudHabilitacion(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('Solicitudes_habilitacion');
  if (h && h.getLastRow() >= 2) {
    const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
    const idxId = headers.indexOf('id');
    const idxEstado = headers.indexOf('estado');
    const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
    vals.forEach((row,i) => {
      if (row[idxId] === datos.id) h.getRange(i+2, idxEstado+1).setValue('resuelta');
    });
  }

  const hMP = ss.getSheetByName('MP_maestro');
  if (!hMP) return { ok: false, msg: 'MP_maestro no encontrada' };
  const headersMP = hMP.getRange(1,1,1,hMP.getLastColumn()).getValues()[0];
  const idxIdMP = headersMP.indexOf('ID_MP');
  const idxAreas = headersMP.indexOf('areas_habilitadas');
  if (idxAreas < 0) return { ok: false, msg: 'MP_maestro no tiene columna areas_habilitadas' };
  const idsMP = hMP.getRange(2,1,hMP.getLastRow()-1,1).getValues().flat();
  const fila = idsMP.indexOf(datos.mp_id);
  if (fila < 0) return { ok: false, msg: 'MP no encontrada: ' + datos.mp_id };

  const actual = (hMP.getRange(fila+2, idxAreas+1).getValue() || '').toString();
  const areas = actual.split(',').map(a=>a.trim()).filter(Boolean);
  if (!areas.includes(datos.area_codigo)) areas.push(datos.area_codigo);
  hMP.getRange(fila+2, idxAreas+1).setValue(areas.join(','));

  return { ok: true, msg: 'MP habilitada para ' + datos.area_codigo };
}

// ── VENTAS MENSUALES CONSOLIDADAS (Fase 3 — canal de vuelta desde B2B/B2C) ──
// Mismo patrón que obtenerCorreosJefas: clave/valor en la hoja Config.
function obtenerUrlsVentasCSV() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const h = ss.getSheetByName('Config');
    if (h && h.getLastRow() >= 2) {
      const claves = h.getRange(2, 1, h.getLastRow()-1, 1).getValues().flat();
      const idx = claves.indexOf('csv_ventas_urls');
      if (idx >= 0) {
        const valor = h.getRange(idx + 2, 2).getValue();
        if (valor) return JSON.parse(valor);
      }
    }
  } catch(e) {
    Logger.log('No se pudo leer csv_ventas_urls de Config: ' + e.message);
  }
  return { b2b: '', b2c: '', ventasTotalB2B: '', cobrosB2B: '', verificacionB2C: '', flujoCajaB2C: '' };
}

function guardarUrlsVentasCSV(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Config');
  if (!h) {
    h = ss.insertSheet('Config');
    h.getRange(1,1,1,3).setValues([['clave','valor','descripcion']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const claves = h.getLastRow() >= 2 ? h.getRange(2, 1, h.getLastRow()-1, 1).getValues().flat() : [];
  const idx = claves.indexOf('csv_ventas_urls');
  const valor = JSON.stringify({
    b2b: datos.b2b || '', b2c: datos.b2c || '',
    ventasTotalB2B: datos.ventasTotalB2B || '', cobrosB2B: datos.cobrosB2B || '',
    verificacionB2C: datos.verificacionB2C || '', flujoCajaB2C: datos.flujoCajaB2C || ''
  });
  if (idx >= 0) {
    h.getRange(idx + 2, 2).setValue(valor);
  } else {
    h.appendRow(['csv_ventas_urls', valor, 'URLs de los CSV publicados de ventas mensuales (B2B/B2C) y verificación/cobros B2B']);
  }
  return { ok: true, msg: 'URLs guardadas' };
}

// Busca por nombre de columna sin importar mayúscula/acento/guion bajo —
// B2B y B2C pueden nombrar la columna distinto (ID_receta_fen vs idRecetaFen)
function _buscarColumna(headers, patronesTexto) {
  const norm = s => (s||'').toString().toLowerCase().replace(/[_\s]/g,'');
  for (const patron of patronesTexto) {
    const idx = headers.findIndex(h => norm(h).includes(patron));
    if (idx > -1) return idx;
  }
  return -1;
}

// Normaliza el campo "mes" a formato AAAA-MM sin importar cómo llegue —
// puede venir como texto limpio ("2026-08") o como fecha completa
// ("2026-08-01T04:00:00.000Z", si el sistema de origen mandó un objeto Date).
function _normalizarMesVentas(valor) {
  const s = (valor || '').toString().trim();
  const match = s.match(/^(\d{4})-(\d{2})/);
  if (match) return match[1] + '-' + match[2];
  const fecha = new Date(s);
  if (!isNaN(fecha.getTime())) {
    return fecha.getFullYear() + '-' + String(fecha.getMonth()+1).padStart(2,'0');
  }
  return s; // no se pudo interpretar, se deja tal cual para no perder el dato
}

// Clave estable para detectar "la misma fila" — recorta espacios invisibles que
// pueden venir de distintas fuentes (CSV externos, copiar/pegar) y que antes
// hacían que el upsert no reconociera una fila ya existente, duplicándola.
function _claveVenta(idReceta, canal, mes) {
  return (idReceta||'').toString().trim() + '|' + (canal||'').toString().trim() + '|' + (mes||'').toString().trim();
}

function sincronizarVentasMensuales() {
  const urls = obtenerUrlsVentasCSV();
  if (!urls.b2b && !urls.b2c) {
    return { ok: false, msg: 'No hay URLs de CSV configuradas. Guarde primero los links de B2B y/o B2C.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let hVentas = ss.getSheetByName('Ventas_mensuales_consolidadas');
  const headersVentas = ['ID_receta','área','canal','mes','cantidad_vendida','monto_neto','fecha_sincronizado'];
  if (!hVentas) {
    hVentas = ss.insertSheet('Ventas_mensuales_consolidadas');
    hVentas.getRange(1,1,1,headersVentas.length).setValues([headersVentas])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    hVentas.setFrozenRows(1);
  }
  // Forzar columna "mes" (D) a texto plano siempre — evita que Sheets reinterprete
  // "2026-08" como fecha y lo reformatee solo, que es justo lo que causaba el bug.
  hVentas.getRange(2, 4, Math.max(hVentas.getMaxRows()-1, 1), 1).setNumberFormat('@');

  // Mapa ID_receta -> área, para completar la columna (los CSV externos no la traen)
  const hMaestro = ss.getSheetByName('Maestro_recetas');
  const areaPorId = {};
  if (hMaestro && hMaestro.getLastRow() > 1) {
    const mHeaders = hMaestro.getRange(1,1,1,hMaestro.getLastColumn()).getValues()[0];
    const idxId = mHeaders.indexOf('ID_receta');
    const idxArea = mHeaders.indexOf('área');
    hMaestro.getRange(2,1,hMaestro.getLastRow()-1,mHeaders.length).getValues().forEach(r => {
      areaPorId[r[idxId]] = r[idxArea];
    });
  }
  // Los productos de reventa (ej. REV001) no están en Maestro_recetas — viven en su
  // propia hoja. Se agregan al mismo mapa para que también les resuelva el área —
  // usando su área real (ej. "Servicios" para Despacho), no forzando "Reventa" siempre.
  leerProductosReventa().forEach(p => { areaPorId[p.ID_reventa] = p.area || 'Reventa'; });

  let filasExistentes = hVentas.getLastRow() > 1
    ? hVentas.getRange(2,1,hVentas.getLastRow()-1,headersVentas.length).getValues()
    : [];

  // Limpieza de duplicados que ya existan en el Sheet (de sincronizaciones
  // anteriores, antes de que la clave fuera resistente a espacios/formato). Se
  // queda con la fila normalizada más completa entre las duplicadas (o la última).
  const filasParaBorrar = [];
  const vistosDedupe = {};
  filasExistentes.forEach((r, i) => {
    const mesLimpio = _normalizarMesVentas(r[3]);
    const clave = _claveVenta(r[0], r[2], mesLimpio);
    if (vistosDedupe[clave] !== undefined) {
      filasParaBorrar.push(i + 2); // fila real en el Sheet
    } else {
      vistosDedupe[clave] = i;
    }
  });
  if (filasParaBorrar.length) {
    filasParaBorrar.sort((a,b) => b-a).forEach(fila => hVentas.deleteRow(fila)); // de abajo hacia arriba
    filasExistentes = hVentas.getLastRow() > 1
      ? hVentas.getRange(2,1,hVentas.getLastRow()-1,headersVentas.length).getValues()
      : [];
  }

  // Índice por "ID_receta|canal|mes" para hacer upsert (reemplazar si ya existía esa combinación).
  // Si alguna fila vieja quedó con el mes en formato "sucio" (de antes de esta corrección),
  // se normaliza en el Sheet mismo acá, para que el upsert la reconozca en vez de duplicarla.
  const indicePorClave = {};
  filasExistentes.forEach((r, i) => {
    const mesLimpio = _normalizarMesVentas(r[3]);
    if (mesLimpio !== r[3]) {
      hVentas.getRange(i+2, 4).setNumberFormat('@').setValue(mesLimpio);
      r[3] = mesLimpio;
    }
    if (!r[1] && areaPorId[r[0]]) {
      hVentas.getRange(i+2, 2).setValue(areaPorId[r[0]]);
      r[1] = areaPorId[r[0]];
    }
    indicePorClave[_claveVenta(r[0], r[2], r[3])] = i + 2;
  });

  let totalFilas = 0;
  const canales = [];
  if (urls.b2b) canales.push({ canal: 'B2B', url: urls.b2b });
  if (urls.b2c) canales.push({ canal: 'B2C', url: urls.b2c });

  const errores = [];
  canales.forEach(({ canal, url }) => {
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (res.getResponseCode() !== 200) {
        errores.push(canal + ': HTTP ' + res.getResponseCode());
        return;
      }
      const filas = Utilities.parseCsv(res.getContentText());
      if (!filas.length) { errores.push(canal + ': CSV vacío'); return; }
      const headers = filas[0];
      const idxId  = _buscarColumna(headers, ['receta']);
      const idxMes = _buscarColumna(headers, ['mes']);
      const idxCant = _buscarColumna(headers, ['cantidad']);
      const idxMonto = _buscarColumna(headers, ['montoneto', 'monto']);
      if (idxId < 0 || idxMes < 0 || idxCant < 0 || idxMonto < 0) {
        errores.push(canal + ': no se encontraron todas las columnas esperadas (ID_receta/mes/cantidad/monto)');
        return;
      }

      filas.slice(1).forEach(fila => {
        const idReceta = fila[idxId];
        const mes = _normalizarMesVentas(fila[idxMes]);
        if (!idReceta || !mes) return;
        const cantidad = parseFloat(fila[idxCant]) || 0;
        const monto = parseFloat(fila[idxMonto]) || 0;
        const area = areaPorId[idReceta] || '';
        const filaArr = [idReceta, area, canal, mes, cantidad, monto, new Date().toISOString()];
        const clave = _claveVenta(idReceta, canal, mes);
        if (indicePorClave[clave]) {
          const filaDestino = indicePorClave[clave];
          hVentas.getRange(filaDestino, 4).setNumberFormat('@'); // columna "mes" — antes de escribir el valor
          hVentas.getRange(filaDestino, 1, 1, filaArr.length).setValues([filaArr]);
        } else {
          hVentas.appendRow(filaArr);
          const filaNueva = hVentas.getLastRow();
          hVentas.getRange(filaNueva, 4).setNumberFormat('@').setValue(mes); // reafirmar como texto — appendRow() puede
          // crear filas más allá de lo que el setNumberFormat inicial alcanzó a cubrir, y Sheets las reinterpreta como fecha.
          indicePorClave[clave] = filaNueva;
        }
        totalFilas++;
      });
    } catch(e) {
      errores.push(canal + ': ' + e.message);
    }
  });

  if (totalFilas === 0 && errores.length) {
    return { ok: false, msg: 'No se pudo sincronizar: ' + errores.join(' | ') };
  }
  return {
    ok: true,
    msg: totalFilas + ' fila(s) sincronizada(s)'
      + (filasParaBorrar.length ? ` — se limpiaron ${filasParaBorrar.length} duplicado(s) de antes` : '')
      + (errores.length ? ' — con avisos: ' + errores.join(' | ') : ''),
    filas: totalFilas
  };
}

function leerVentasMensualesConsolidadas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('Ventas_mensuales_consolidadas');
  if (!h || h.getLastRow() < 2) return [];
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  return vals.map(row => { const o = {}; headers.forEach((hh,j)=>o[hh]=row[j]); return o; });
}

// ── CONTROL DE STOCK — MP CRÍTICA ──────────────────────────────
// Suma (no reemplaza) al stock actual de una MP — usado cuando llega un
// pedido. Deliberadamente una acción aparte de editarCampoMP: sumar necesita
// leer el valor actual primero, y hacerlo en el backend evita que dos personas
// registrando una llegada casi al mismo tiempo se pisen entre sí.
function registrarLlegadaStockMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('MP_maestro');
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const ids     = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
  const rowIdx  = ids.indexOf(datos.ID_MP);
  if (rowIdx < 1) return { ok: false, msg: 'MP no encontrada: ' + datos.ID_MP };

  let colStock = headers.indexOf('stock_actual');
  if (colStock < 0) {
    colStock = headers.length;
    h.getRange(1, colStock + 1).setValue('stock_actual');
  }

  const cantidad = parseFloat(datos.cantidad) || 0;
  if (cantidad <= 0) return { ok: false, msg: 'La cantidad tiene que ser mayor a 0' };

  const actual = parseFloat(h.getRange(rowIdx + 1, colStock + 1).getValue()) || 0;
  const nuevo = actual + cantidad;
  h.getRange(rowIdx + 1, colStock + 1).setValue(nuevo);

  // Registro del movimiento, para trazabilidad — igual espíritu que Registro_merma
  let hMov = ss.getSheetByName('MP_stock_movimientos');
  if (!hMov) {
    hMov = ss.insertSheet('MP_stock_movimientos');
    hMov.getRange(1,1,1,6).setValues([['fecha','ID_MP','nombre','tipo','cantidad','stock_resultante']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    hMov.setFrozenRows(1);
  }
  const nombreMP = h.getRange(rowIdx + 1, headers.indexOf('nombre') + 1).getValue();
  hMov.appendRow([new Date(), datos.ID_MP, nombreMP, 'llegada', cantidad, nuevo]);

  return { ok: true, msg: 'Llegada registrada — stock actual: ' + nuevo, stock_actual: nuevo };
}

function leerMovimientosStockMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('MP_stock_movimientos');
  if (!h || h.getLastRow() < 2) return { ok: true, movimientos: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  let movimientos = vals.map(row => { const o = {}; headers.forEach((hh,j)=>o[hh]=row[j]); return o; });
  if (datos.ID_MP) movimientos = movimientos.filter(m => m.ID_MP === datos.ID_MP);
  return { ok: true, movimientos };
}

function solicitarMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('MP_maestro');
  if (!h) return { ok: false, msg: 'Hoja MP_maestro no encontrada' };

  // Generar ID nuevo — prefijo distinto para insumos (IN) vs materia prima (MP)
  const prefijo = datos.tipo === 'insumo' ? 'IN' : 'MP';
  const ids = h.getLastRow() > 1
    ? h.getRange(2, 1, h.getLastRow() - 1, 1).getValues().flat()
    : [];
  const idsPrefijo = ids.filter(id => (id+'').startsWith(prefijo));
  const nums = idsPrefijo.map(id => parseInt((id+'').replace(/\D/g,''))).filter(n => !isNaN(n));
  const siguiente = nums.length > 0 ? Math.max(...nums) + 1 : 1;
  const nuevoId   = prefijo + String(siguiente).padStart(3, '0');

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const esCreacionAdmin = datos.origen === 'admin';

  // Cálculo de costo (mismo criterio que editarMP): dividir por lo que representa el paquete
  const neto = parseFloat(datos.costo_neto) || 0;
  const iva  = 0.19;
  const imp  = 0;
  const bruto = neto * (1 + iva + imp);
  const unidadCompra = (datos.unidad_compra || 'kg').toLowerCase();
  const porGr = bruto / parsearUnidadCompra(unidadCompra).factorBase;

  const fila = headers.map(col => {
    if (col === 'ID_MP')           return nuevoId;
    if (col === 'nombre')          return datos.nombre;
    if (col === 'estado')          return esCreacionAdmin ? (datos.estado_directo || 'activa') : 'pendiente';
    if (col === 'tipo')            return datos.tipo || 'mp';
    if (col === 'solicitada_por')  return datos.solicitada_por || datos.area_codigo || '';
    if (col === 'categoría')        return datos.categoría || datos.categoria || 'Pendiente';
    if (col === 'area_codigo')     return datos.area_codigo || '';
    if (col === 'areas_habilitadas') return datos.areas_habilitadas !== undefined ? datos.areas_habilitadas : (datos.area_codigo || '');
    if (col === 'receta_id_origen') return datos.receta_id || '';
    if (col === 'unidad_receta')    return datos.unidad_receta || 'gramos';
    if (col === 'unidad_compra')    return esCreacionAdmin ? unidadCompra : (datos.unidad_compra || '');
    if (col === 'receta_nombre')    return datos.receta_nombre || '';
    if (col === 'fecha_solicitud') return new Date();
    if (col === 'costo_neto')      return esCreacionAdmin ? neto : '';
    if (col === 'IVA_%')           return esCreacionAdmin ? iva : '';
    if (col === 'imp_adicional_%') return esCreacionAdmin ? imp : '';
    if (col === 'costo_bruto')     return esCreacionAdmin ? bruto : '';
    if (col === 'costo_por_kg')    return esCreacionAdmin ? bruto : '';
    if (col === 'costo_por_gramo') return esCreacionAdmin ? porGr : '';
    return '';
  });

  h.appendRow(fila);

  // Si Admin lo creó directamente, no hay a quién notificar — ya quedó activo
  if (esCreacionAdmin) {
    return { ok: true, msg: (datos.tipo === 'insumo' ? 'Insumo' : 'MP') + ' creada', id: nuevoId };
  }

  // Notificar al admin
  try {
    enviarNotificacionAdmin(
      'Nueva solicitud de MP — ' + datos.nombre,
      'Área: ' + (datos.solicitada_por || datos.area_codigo) + '\n' +
      'Ingrediente solicitado: ' + datos.nombre + '\n' +
      'Para receta: ' + (datos.receta_nombre || 'No especificada') + '\n' +
      'Unidad en receta: ' + (datos.unidad_receta || 'gramos') + '\n' +
      'ID asignado: ' + nuevoId + '\n\n' +
      'Revisa en fën → Materias primas'
    );
  } catch(e) {
    Logger.log('Error enviando notificacion MP: ' + e.message);
  }

  return { ok: true, msg: 'Solicitud registrada', id: nuevoId };
}


// ── AVISOS ────────────────────────────────────────────────────
function crearAviso(area_codigo, tipo, mensaje, mp_id) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('Avisos');
  if (!h) {
    h = ss.insertSheet('Avisos');
    h.getRange(1,1,1,7).setValues([['id','fecha','area_codigo','tipo','mensaje','mp_id','leido']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  // Add leido column if missing
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  if (!headers.includes('leido')) {
    h.getRange(1, headers.length+1).setValue('leido').setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
  }
  const id = 'AV_' + Date.now();
  h.appendRow([id, new Date().toISOString(), area_codigo, tipo, mensaje, mp_id || '', '']);

  // Notificar por correo a la jefa del área correspondiente
  const titulos = {
    mp_recibida:  'Solicitud de MP recibida',
    mp_aprobada:  'MP aprobada y disponible',
    mp_asignada:  'MP asignada a tu solicitud',
    receta_aprobada: 'Receta aprobada',
    receta_devuelta: 'Receta devuelta para revisión'
  };
  const asunto = titulos[tipo] || 'Nuevo aviso';
  const esUrgente = tipo === 'receta_devuelta';
  enviarNotificacionJefa(area_codigo, asunto, mensaje, esUrgente);

  return id;
}

function leerAvisos(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Avisos');
  if (!h || h.getLastRow() < 2) return { ok: true, avisos: [] };
  const numCols = h.getLastColumn();
  const headers = h.getRange(1,1,1,numCols).getValues()[0];
  const vals    = h.getRange(2, 1, h.getLastRow()-1, numCols).getValues();
  const leidoIdx = headers.indexOf('leido');
  const avisos = vals
    .filter(r => r[0] && (!datos.area_codigo || r[2] === datos.area_codigo) && String(r[leidoIdx]) !== '1')
    .map(r => ({ id: r[0], fecha: r[1], area_codigo: r[2], tipo: r[3], mensaje: r[4], mp_id: r[5] }));
  return { ok: true, avisos };
}

function marcarAvisoLeido(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('Avisos');
  if (!h || h.getLastRow() < 2) return { ok: false };
  const numCols = h.getLastColumn();
  const headers = h.getRange(1,1,1,numCols).getValues()[0];
  const vals    = h.getRange(2,1,h.getLastRow()-1,numCols).getValues();
  const idIdx   = headers.indexOf('id');
  const leidoIdx= headers.indexOf('leido');
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][idIdx] === datos.aviso_id) {
      h.getRange(i+2, leidoIdx+1).setValue('1');
      return { ok: true };
    }
  }
  return { ok: false, msg: 'Aviso no encontrado' };
}

// ── REEMPLAZAR MP EN RECETA ──────────────────────────────────
// Fusiona dos MP duplicadas: busca en TODAS las recetas de las 4 áreas (ingredientes E
// insumos) cualquier referencia a la MP que se va a eliminar, y la reemplaza por la que
// se mantiene. Al final marca la duplicada como 'reemplazada' (no se borra la fila, para
// no perder el historial ni romper referencias que se nos hayan escapado).
// Busca en las 4 áreas (ingredientes E insumos) qué recetas usan una MP específica.
// Solo lectura — no modifica nada. Sirve para saber qué recetas re-aprobar después
// de asignarle costo a una MP que estaba en $0.
function buscarRecetasUsandoMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const areas = ['PAN', 'BOL', 'CAF', 'PAS'];
  const encontradas = [];

  areas.forEach(area => {
    const hoja = ss.getSheetByName(area + '_recetas');
    if (!hoja || hoja.getLastRow() < 2) return;
    const headers = hoja.getRange(1,1,1,hoja.getLastColumn()).getValues()[0];
    const idxNombreReceta = headers.indexOf('nombre');
    const idxEstado = headers.indexOf('estado');
    const idxIng = headers.indexOf('ingredientes_JSON');
    const idxIns = headers.indexOf('insumos_JSON');
    const vals = hoja.getRange(2,1,hoja.getLastRow()-1,headers.length).getValues();

    vals.forEach(row => {
      let usa = false;
      if (idxIng > -1 && row[idxIng]) {
        try { usa = usa || JSON.parse(row[idxIng]).some(i => i.id === datos.mp_id); } catch(e) {}
      }
      if (idxIns > -1 && row[idxIns]) {
        try { usa = usa || JSON.parse(row[idxIns]).some(i => i.id === datos.mp_id); } catch(e) {}
      }
      if (usa) {
        encontradas.push({ area, nombre: row[idxNombreReceta], estado: idxEstado > -1 ? row[idxEstado] : '' });
      }
    });
  });

  return { ok: true, recetas: encontradas };
}

// Revisa BOL_recetas, PAN_recetas, CAF_recetas, PAS_recetas y Maestro_recetas, y agrega
// cualquier columna que falte de la lista de abajo — sin tocar ni reordenar las que ya
// existen. Segura de ejecutar varias veces (no duplica columnas). Ejecutar UNA VEZ desde
// el editor de Apps Script (▶ Ejecutar, seleccionando "asegurarColumnasRecetas").
function asegurarColumnasRecetas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const columnasRequeridas = ['insumos_JSON', 'porciones_base_unidad', 'pasos_JSON', 'tipo_preparacion', 'peso_unidad_mb_g', 'planificable_directo', 'vende_directo', 'variante_de_id', 'se_congela', 'unidades_por_caja'];
  const hojas = ['PAN_recetas', 'BOL_recetas', 'CAF_recetas', 'PAS_recetas', 'Maestro_recetas'];
  const resumen = [];

  hojas.forEach(nombreHoja => {
    const h = ss.getSheetByName(nombreHoja);
    if (!h) { resumen.push(nombreHoja + ': hoja no encontrada, omitida'); return; }

    const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0].map(c => String(c).trim());
    const agregadas = [];

    columnasRequeridas.forEach(col => {
      if (headers.indexOf(col) === -1) {
        const nuevaCol = h.getLastColumn() + 1;
        h.getRange(1, nuevaCol).setValue(col).setFontWeight('bold');
        headers.push(col); // para que la siguiente columna a agregar no pise esta
        agregadas.push(col);
      }
    });

    resumen.push(nombreHoja + ': ' + (agregadas.length ? 'agregadas [' + agregadas.join(', ') + ']' : 'ya estaba completa, sin cambios'));
  });

  Logger.log(resumen.join('\n'));
  return resumen.join('\n');
}

// Recalcula, con los precios ACTUALES de MP_maestro, cuánto debería costar cada receta
// consolidada, y lo compara contra lo que quedó guardado — para detectar recetas
// desactualizadas (ej. el precio de una MP cambió después de la última aprobación).
function auditarCostosRecetas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hMP = ss.getSheetByName('MP_maestro');
  const hMaestro = ss.getSheetByName('Maestro_recetas');
  if (!hMP || !hMaestro) return { ok: false, msg: 'Faltan hojas MP_maestro o Maestro_recetas' };

  // Mapa de costo actual por ID_MP
  const mpHeaders = hMP.getRange(1,1,1,hMP.getLastColumn()).getValues()[0];
  const idxMPId = mpHeaders.indexOf('ID_MP');
  const idxMPCosto = mpHeaders.indexOf('costo_por_gramo');
  const idxMPEstado = mpHeaders.indexOf('estado');
  const mpVals = hMP.getLastRow() > 1 ? hMP.getRange(2,1,hMP.getLastRow()-1,mpHeaders.length).getValues() : [];
  const costoActualPorId = {};
  const estadoPorId = {};
  mpVals.forEach(row => {
    costoActualPorId[row[idxMPId]] = parseFloat(row[idxMPCosto]) || 0;
    estadoPorId[row[idxMPId]] = row[idxMPEstado];
  });

  const mHeaders = hMaestro.getRange(1,1,1,hMaestro.getLastColumn()).getValues()[0];
  const idxNombre = mHeaders.indexOf('nombre');
  const idxArea = mHeaders.indexOf('área');
  const idxTipo = mHeaders.indexOf('tipo_receta');
  const idxPorciones = mHeaders.indexOf('porciones_base');
  const idxIng = mHeaders.indexOf('ingredientes_JSON');
  const idxIns = mHeaders.indexOf('insumos_JSON');
  const idxCostoMPGuardado = mHeaders.indexOf('costo_MP_unitario');
  const idxCostoInsGuardado = mHeaders.indexOf('costo_insumos_unitario');
  const mVals = hMaestro.getLastRow() > 1 ? hMaestro.getRange(2,1,hMaestro.getLastRow()-1,mHeaders.length).getValues() : [];

  const resultado = [];

  mVals.forEach(row => {
    const porciones = parseFloat(row[idxPorciones]) || 1;
    let ingredientes = [], insumos = [];
    try { ingredientes = JSON.parse(row[idxIng] || '[]'); } catch(e) {}
    try { insumos = JSON.parse(row[idxIns] || '[]'); } catch(e) {}

    let costoMPActual = 0, costoInsActual = 0;
    let huboProblemaReferencia = false;
    const detalleProblemas = [];

    ingredientes.forEach(ing => {
      if (ing.id === '__pendiente__' || !(ing.id in costoActualPorId)) {
        huboProblemaReferencia = true;
        detalleProblemas.push('Ingrediente "' + ing.nombre + '" no se encuentra en MP_maestro');
        return;
      }
      if (estadoPorId[ing.id] === 'inactiva' || estadoPorId[ing.id] === 'reemplazada') {
        detalleProblemas.push('Ingrediente "' + ing.nombre + '" está ' + estadoPorId[ing.id] + ' en MP_maestro');
      }
      costoMPActual += costoActualPorId[ing.id] * (parseFloat(ing.gramos) || 0);
    });
    insumos.forEach(ins => {
      if (ins.id === '__pendiente__' || !(ins.id in costoActualPorId)) {
        huboProblemaReferencia = true;
        detalleProblemas.push('Insumo "' + ins.nombre + '" no se encuentra en MP_maestro');
        return;
      }
      costoInsActual += costoActualPorId[ins.id] * (parseFloat(ins.unidades) || 0);
    });

    costoMPActual = costoMPActual / porciones;
    costoInsActual = costoInsActual / porciones;
    const totalActual = costoMPActual + costoInsActual;

    const costoMPGuardado = parseFloat(row[idxCostoMPGuardado]) || 0;
    const costoInsGuardado = parseFloat(row[idxCostoInsGuardado]) || 0;
    const totalGuardado = costoMPGuardado + costoInsGuardado;

    const diferencia = totalActual - totalGuardado;
    const diferenciaPct = totalGuardado ? (diferencia / totalGuardado * 100) : (totalActual > 0 ? 100 : 0);

    // Solo reportar si hay una diferencia real (>1%) o algún problema de referencia
    if (Math.abs(diferenciaPct) > 1 || huboProblemaReferencia || totalGuardado === 0) {
      resultado.push({
        nombre: row[idxNombre],
        área: row[idxArea],
        tipo: row[idxTipo],
        costo_guardado: Math.round(totalGuardado),
        costo_actual: Math.round(totalActual),
        diferencia_pct: Math.round(diferenciaPct * 10) / 10,
        problemas: detalleProblemas
      });
    }
  });

  // Ordenar por mayor diferencia absoluta primero
  resultado.sort((a,b) => Math.abs(b.diferencia_pct) - Math.abs(a.diferencia_pct));

  return { ok: true, total_revisadas: mVals.length, con_diferencias: resultado.length, recetas: resultado };
}

// ── BOL: PLAN DE RELLENOS Y OTRAS RECETAS DEL DÍA ─────────────
function leerPlanRellenos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_rellenos');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map(r => {
    const obj = {};
    headers.forEach((c,i) => obj[c] = r[i]);
    return obj;
  }).filter(f => f.ID_receta);
  return { ok: true, filas };
}

function guardarPlanRelleno(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_rellenos');
  if (!h) {
    h = ss.insertSheet('BOL_plan_rellenos');
    const headers = ['ID_receta','nombre','cantidad_planificada','unidad','hecho','fecha_actualizacion'];
    h.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const r = datos.registro;
  const lastRow = h.getLastRow();
  let rowIdx = -1;
  if (lastRow > 1) {
    const vals = h.getRange(2,1,lastRow-1,headers.length).getValues();
    const colId = headers.indexOf('ID_receta');
    for (let i = 0; i < vals.length; i++) {
      if (vals[i][colId] === r.ID_receta) { rowIdx = i + 2; break; }
    }
  }
  const fila = headers.map(col => {
    if (col === 'fecha_actualizacion') return new Date();
    return r[col] !== undefined ? r[col] : '';
  });
  if (rowIdx > 0) h.getRange(rowIdx,1,1,fila.length).setValues([fila]);
  else h.appendRow(fila);
  return { ok: true };
}

// ── BOL: PLAN SEMANAL PS/PC (grilla) ──────────────────────────
function leerPlanPSPC() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_ps_pc');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map((r,i) => {
    const obj = { _fila: i + 2 };
    headers.forEach((c,j) => obj[c] = r[j]);
    return obj;
  }).filter(f => f.ID_receta);
  return { ok: true, filas };
}

// ── BOL: PLAN DIARIO DE MASA BASE ─────────────────────────────
// Upsert de una celda de la grilla (masa × día) — si ya existe una fila para esa
// combinación, la actualiza; si la cantidad queda en 0, la elimina (celda vacía =
// sin plan ese día). Reemplaza el flujo viejo de "seleccionar masa, elegir día".
// Upsert de celda para el plan de DESCONGELACIÓN de masa — mismo patrón que
// guardarCeldaPlanMasaBase, pero en su propia hoja (no se mezcla con elaboración).
function guardarCeldaPlanDescongelacionMasa(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_descongelacion_masa');
  if (!h) {
    h = ss.insertSheet('BOL_plan_descongelacion_masa');
    const headers = ['ID_receta','nombre','dia','semana_ID','cantidad_unidades','fecha_ingreso'];
    h.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  let headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  if (headers.indexOf('semana_ID') === -1) {
    h.getRange(1, headers.length+1).setValue('semana_ID').setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  }
  const idxId = headers.indexOf('ID_receta');
  const idxDia = headers.indexOf('dia');
  const idxSemana = headers.indexOf('semana_ID');
  const idxCant = headers.indexOf('cantidad_unidades');

  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,headers.length).getValues() : [];
  let filaExistente = -1;
  vals.forEach((r,i) => { if (r[idxId] === datos.ID_receta && r[idxDia] === datos.dia && r[idxSemana] === datos.semana) filaExistente = i + 2; });

  const cantidad = parseFloat(datos.cantidad_unidades) || 0;

  if (cantidad <= 0) {
    if (filaExistente > 0) h.deleteRow(filaExistente);
    return { ok: true, msg: 'Celda vaciada' };
  }

  if (filaExistente > 0) {
    h.getRange(filaExistente, idxCant+1).setValue(cantidad);
  } else {
    const fila = headers.map(col => {
      if (col === 'ID_receta') return datos.ID_receta;
      if (col === 'nombre') return datos.nombre || '';
      if (col === 'dia') return datos.dia;
      if (col === 'semana_ID') return datos.semana || '';
      if (col === 'cantidad_unidades') return cantidad;
      if (col === 'fecha_ingreso') return new Date();
      return '';
    });
    h.appendRow(fila);
  }
  return { ok: true, msg: 'Guardado' };
}

function leerPlanDescongelacionMasa() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_descongelacion_masa');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map((r,i) => { const o = {}; headers.forEach((c,j)=>o[c]=r[j]); o._fila = i+2; return o; }).filter(f => f.ID_receta);
  return { ok: true, filas };
}

function guardarCeldaPlanMasaBase(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_masa_base');
  if (!h) {
    h = ss.insertSheet('BOL_plan_masa_base');
    const headers = ['ID_receta','nombre','dia','semana_ID','cantidad_unidades','peso_unidad_g','peso_total_g','tandas_JSON','fecha_ingreso'];
    h.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  let headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  if (headers.indexOf('semana_ID') === -1) {
    h.getRange(1, headers.length+1).setValue('semana_ID').setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  }
  const idxId = headers.indexOf('ID_receta');
  const idxDia = headers.indexOf('dia');
  const idxSemana = headers.indexOf('semana_ID');
  const idxCant = headers.indexOf('cantidad_unidades');
  const idxPesoUnidad = headers.indexOf('peso_unidad_g');
  const idxPesoTotal = headers.indexOf('peso_total_g');

  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,headers.length).getValues() : [];
  let filaExistente = -1;
  vals.forEach((r,i) => { if (r[idxId] === datos.ID_receta && r[idxDia] === datos.dia && r[idxSemana] === datos.semana) filaExistente = i + 2; });

  const cantidad = parseFloat(datos.cantidad_unidades) || 0;
  const pesoUnidad = parseFloat(datos.peso_unidad_g) || 0;
  const pesoTotal = cantidad * pesoUnidad;

  if (cantidad <= 0) {
    if (filaExistente > 0) h.deleteRow(filaExistente);
    return { ok: true, msg: 'Celda vaciada' };
  }

  if (filaExistente > 0) {
    h.getRange(filaExistente, idxCant+1).setValue(cantidad);
    h.getRange(filaExistente, idxPesoUnidad+1).setValue(pesoUnidad);
    h.getRange(filaExistente, idxPesoTotal+1).setValue(pesoTotal);
  } else {
    const fila = headers.map(col => {
      if (col === 'ID_receta') return datos.ID_receta;
      if (col === 'nombre') return datos.nombre || '';
      if (col === 'dia') return datos.dia;
      if (col === 'semana_ID') return datos.semana || '';
      if (col === 'cantidad_unidades') return cantidad;
      if (col === 'peso_unidad_g') return pesoUnidad;
      if (col === 'peso_total_g') return pesoTotal;
      if (col === 'fecha_ingreso') return new Date();
      return '';
    });
    h.appendRow(fila);
  }
  return { ok: true, msg: 'Guardado' };
}

// Tandas de una sub-receta ANIDADA (ej. Poolish) para un día específico — separado
// del tandas_JSON de la masa madre, porque la jefa puede repartir el Poolish del
// día en un número de tandas distinto al de la masa que lo contiene.
function _hojaSubRecetasMasaBase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_masa_base_subrecetas');
  if (!h) {
    h = ss.insertSheet('BOL_plan_masa_base_subrecetas');
    h.getRange(1,1,1,5).setValues([['dia','sub_receta_id','sub_receta_nombre','tandas_JSON','fecha_ingreso']])
      .setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function guardarTandasSubRecetaMasaBase(datos) {
  const h = _hojaSubRecetasMasaBase();
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxDia = headers.indexOf('dia');
  const idxSub = headers.indexOf('sub_receta_id');
  const idxTandas = headers.indexOf('tandas_JSON');

  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,headers.length).getValues() : [];
  let filaExistente = -1;
  vals.forEach((r,i) => { if (r[idxDia] === datos.dia && r[idxSub] === datos.sub_receta_id) filaExistente = i + 2; });

  if (filaExistente > 0) {
    h.getRange(filaExistente, idxTandas+1).setValue(datos.tandas_JSON || '[]');
  } else {
    h.appendRow([datos.dia, datos.sub_receta_id, datos.sub_receta_nombre || '', datos.tandas_JSON || '[]', new Date()]);
  }
  return { ok: true };
}

function leerTandasSubRecetaMasaBase() {
  const h = _hojaSubRecetasMasaBase();
  if (h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map(r => { const o = {}; headers.forEach((c,j)=>o[c]=r[j]); return o; }).filter(f => f.dia);
  return { ok: true, filas };
}

// ── PRODUCTOS TERMINADOS CONGELADOS (BOL) ──────────────────────
// Mismo patrón que masa base (celda masa×día con semana_ID, upsert por
// ID_receta+dia+semana), pero sin gramos ni tandas — acá cada unidad ya es un
// producto terminado, no hay que escalar ninguna receta.
function _hojaCeldaGenerica(nombreHoja, headersDefault) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName(nombreHoja);
  if (!h) {
    h = ss.insertSheet(nombreHoja);
    h.getRange(1,1,1,headersDefault.length).setValues([headersDefault]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  return h;
}

function _guardarCeldaGenerica(nombreHoja, datos) {
  const headersDefault = ['ID_receta','nombre','dia','semana_ID','cantidad_unidades','fecha_ingreso'];
  const h = _hojaCeldaGenerica(nombreHoja, headersDefault);
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxId = headers.indexOf('ID_receta');
  const idxDia = headers.indexOf('dia');
  const idxSemana = headers.indexOf('semana_ID');
  const idxCant = headers.indexOf('cantidad_unidades');

  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,headers.length).getValues() : [];
  let filaExistente = -1;
  vals.forEach((r,i) => { if (r[idxId] === datos.ID_receta && r[idxDia] === datos.dia && r[idxSemana] === datos.semana) filaExistente = i + 2; });

  const cantidad = parseFloat(datos.cantidad_unidades) || 0;

  if (cantidad <= 0) {
    if (filaExistente > 0) h.deleteRow(filaExistente);
    return { ok: true, msg: 'Celda vaciada' };
  }

  if (filaExistente > 0) {
    h.getRange(filaExistente, idxCant+1).setValue(cantidad);
  } else {
    const fila = headers.map(col => {
      if (col === 'ID_receta') return datos.ID_receta;
      if (col === 'nombre') return datos.nombre || '';
      if (col === 'dia') return datos.dia;
      if (col === 'semana_ID') return datos.semana || '';
      if (col === 'cantidad_unidades') return cantidad;
      if (col === 'fecha_ingreso') return new Date();
      return '';
    });
    h.appendRow(fila);
  }
  return { ok: true, msg: 'Guardado' };
}

function _leerCeldaGenerica(nombreHoja) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName(nombreHoja);
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map((r,i) => { const o = {}; headers.forEach((c,j)=>o[c]=r[j]); o._fila = i+2; return o; }).filter(f => f.ID_receta);
  return { ok: true, filas };
}

function guardarCeldaPlanCongelacionProductos(datos) { return _guardarCeldaGenerica('BOL_plan_congelacion_productos', datos); }
function leerPlanCongelacionProductos() { return _leerCeldaGenerica('BOL_plan_congelacion_productos'); }
function guardarCeldaPlanDescongelacionProductos(datos) { return _guardarCeldaGenerica('BOL_plan_descongelacion_productos', datos); }
function leerPlanDescongelacionProductos() { return _leerCeldaGenerica('BOL_plan_descongelacion_productos'); }

// ── STOCK INICIAL SEMANAL — PRODUCTOS CONGELADOS (hoja propia) ──
// Antes vivía como un campo más dentro del bloque JSON de "Config" (fila
// "subrecetas"), compartiendo una sola celda con TODA la demás configuración
// de las 4 áreas — cualquier guardado ahí (de cualquier sección, de cualquier
// persona) podía pisar el stock inicial sin aviso. Ahora es una fila por
// producto+semana, igual que el plan de congelación/descongelación.
function _guardarStockInicialGenerica(nombreHoja, datos) {
  const headersDefault = ['ID_receta','nombre','semana_ID','stock_inicial','fecha_ingreso'];
  const h = _hojaCeldaGenerica(nombreHoja, headersDefault);
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const idxId = headers.indexOf('ID_receta');
  const idxSemana = headers.indexOf('semana_ID');
  const idxStock = headers.indexOf('stock_inicial');

  const vals = h.getLastRow() > 1 ? h.getRange(2,1,h.getLastRow()-1,headers.length).getValues() : [];
  let filaExistente = -1;
  vals.forEach((r,i) => { if (r[idxId] === datos.ID_receta && r[idxSemana] === datos.semana) filaExistente = i + 2; });

  const stock = parseFloat(datos.stock_inicial) || 0;

  if (filaExistente > 0) {
    h.getRange(filaExistente, idxStock+1).setValue(stock);
  } else {
    const fila = headers.map(col => {
      if (col === 'ID_receta') return datos.ID_receta;
      if (col === 'nombre') return datos.nombre || '';
      if (col === 'semana_ID') return datos.semana || '';
      if (col === 'stock_inicial') return stock;
      if (col === 'fecha_ingreso') return new Date();
      return '';
    });
    h.appendRow(fila);
  }
  return { ok: true, msg: 'Stock inicial guardado' };
}

function guardarStockInicialProductosSheet(datos) { return _guardarStockInicialGenerica('BOL_stock_inicial_productos', datos); }
function leerStockInicialProductosSheet() { return _leerCeldaGenerica('BOL_stock_inicial_productos'); }

// Mismo patrón, para el stock inicial de Masa Base.
function guardarStockInicialMasaSheet(datos) { return _guardarStockInicialGenerica('BOL_stock_inicial_masa', datos); }
function leerStockInicialMasaSheet() { return _leerCeldaGenerica('BOL_stock_inicial_masa'); }

function leerPlanMasaBase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_masa_base');
  if (!h || h.getLastRow() < 2) return { ok: true, filas: [] };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const vals = h.getRange(2,1,h.getLastRow()-1,headers.length).getValues();
  const filas = vals.map((r,i) => {
    const obj = { _fila: i + 2 };
    headers.forEach((c,j) => obj[c] = r[j]);
    return obj;
  }).filter(f => f.ID_receta);
  return { ok: true, filas };
}

function guardarEntradaPlanMasaBase(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_masa_base');
  if (!h) {
    h = ss.insertSheet('BOL_plan_masa_base');
    const headers = ['ID_receta','nombre','dia','cantidad_unidades','peso_unidad_g','peso_total_g','tandas_JSON','fecha_ingreso'];
    h.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const r = datos.registro;
  const fila = headers.map(col => {
    if (col === 'fecha_ingreso') return new Date();
    return r[col] !== undefined ? r[col] : '';
  });
  h.appendRow(fila);
  return { ok: true };
}

function actualizarTandasPlanMasaBase(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_masa_base');
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  let colTandas = headers.indexOf('tandas_JSON') + 1;
  if (colTandas === 0) {
    colTandas = headers.length + 1;
    h.getRange(1, colTandas).setValue('tandas_JSON').setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
  }
  h.getRange(parseInt(datos.fila), colTandas).setValue(datos.tandas_JSON || '[]');
  return { ok: true };
}

function eliminarEntradaPlanMasaBase(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_masa_base');
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };
  h.deleteRow(parseInt(datos.fila));
  return { ok: true };
}

function guardarEntradaPlanPSPC(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let h = ss.getSheetByName('BOL_plan_ps_pc');
  if (!h) {
    h = ss.insertSheet('BOL_plan_ps_pc');
    const headers = ['ID_receta','nombre','tipo_preparacion','dia','cantidad','fecha_ingreso'];
    h.getRange(1,1,1,headers.length).setValues([headers]).setBackground('#003a79').setFontColor('#fff').setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const headers = h.getRange(1,1,1,h.getLastColumn()).getValues()[0];
  const r = datos.registro;
  const fila = headers.map(col => {
    if (col === 'fecha_ingreso') return new Date();
    return r[col] !== undefined ? r[col] : '';
  });
  h.appendRow(fila);
  return { ok: true };
}

function eliminarEntradaPlanPSPC(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h = ss.getSheetByName('BOL_plan_ps_pc');
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };
  h.deleteRow(parseInt(datos.fila));
  return { ok: true };
}

// Renombra una MP y actualiza automáticamente el nombre "cacheado" que quedó guardado
// dentro de ingredientes_JSON/insumos_JSON de cada receta que la usa (el ID no cambia,
// solo el texto que se muestra). Las recetas afectadas que estaban aprobadas vuelven a
// "en_prueba" para que se revisen — el número de costo no cambia, solo el nombre mostrado.
function renombrarMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hMP = ss.getSheetByName('MP_maestro');
  if (!hMP) return { ok: false, msg: 'MP_maestro no encontrada' };

  const mpHeaders = hMP.getRange(1,1,1,hMP.getLastColumn()).getValues()[0];
  const idxId = mpHeaders.indexOf('ID_MP');
  const idxNombre = mpHeaders.indexOf('nombre');
  const mpVals = hMP.getLastRow() > 1 ? hMP.getRange(2,1,hMP.getLastRow()-1,mpHeaders.length).getValues() : [];
  const filaIdx = mpVals.findIndex(r => r[idxId] === datos.mp_id);
  if (filaIdx < 0) return { ok: false, msg: 'MP no encontrada' };

  hMP.getRange(filaIdx+2, idxNombre+1).setValue(datos.nuevo_nombre);

  const areas = ['PAN', 'BOL', 'CAF', 'PAS'];
  const recetasActualizadas = [];

  areas.forEach(area => {
    const hoja = ss.getSheetByName(area + '_recetas');
    if (!hoja || hoja.getLastRow() < 2) return;
    const headers = hoja.getRange(1,1,1,hoja.getLastColumn()).getValues()[0];
    const idxNombreReceta = headers.indexOf('nombre');
    const idxEstadoReceta = headers.indexOf('estado');
    const idxIng = headers.indexOf('ingredientes_JSON');
    const idxIns = headers.indexOf('insumos_JSON');
    const vals = hoja.getRange(2,1,hoja.getLastRow()-1,headers.length).getValues();

    vals.forEach((row, i) => {
      let modificado = false;

      if (idxIng > -1 && row[idxIng]) {
        try {
          const ings = JSON.parse(row[idxIng]);
          const nuevos = ings.map(ing => {
            if (ing.id === datos.mp_id) { modificado = true; return { ...ing, nombre: datos.nuevo_nombre }; }
            return ing;
          });
          if (modificado) hoja.getRange(i+2, idxIng+1).setValue(JSON.stringify(nuevos));
        } catch(e) {}
      }

      if (idxIns > -1 && row[idxIns]) {
        try {
          const inss = JSON.parse(row[idxIns]);
          let modIns = false;
          const nuevos = inss.map(ins => {
            if (ins.id === datos.mp_id) { modIns = true; return { ...ins, nombre: datos.nuevo_nombre }; }
            return ins;
          });
          if (modIns) { hoja.getRange(i+2, idxIns+1).setValue(JSON.stringify(nuevos)); modificado = true; }
        } catch(e) {}
      }

      if (modificado) {
        recetasActualizadas.push(area + ': ' + row[idxNombreReceta]);
        if (idxEstadoReceta > -1 && row[idxEstadoReceta] === 'consolidada') {
          hoja.getRange(i+2, idxEstadoReceta+1).setValue('pendiente_aprobación');
        }
      }
    });
  });

  return {
    ok: true,
    msg: recetasActualizadas.length + ' receta(s) actualizada(s) con el nuevo nombre.',
    recetas: recetasActualizadas
  };
}

function fusionarMP(datos) {
  // datos: { mp_id_mantener, mp_id_eliminar }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hMaestro = ss.getSheetByName('MP_maestro');
  if (!hMaestro) return { ok: false, msg: 'MP_maestro no encontrada' };

  const mHeaders = hMaestro.getRange(1,1,1,hMaestro.getLastColumn()).getValues()[0];
  const mVals = hMaestro.getRange(2,1,hMaestro.getLastRow()-1,mHeaders.length).getValues();
  const idxId = mHeaders.indexOf('ID_MP');
  const idxNombre = mHeaders.indexOf('nombre');
  const idxEstado = mHeaders.indexOf('estado');
  const idxReemplazadaPor = mHeaders.indexOf('reemplazada_por');

  let nombreMantener = '';
  let filaMantenerIdx = -1, filaEliminarIdx = -1;
  for (let i = 0; i < mVals.length; i++) {
    if (mVals[i][idxId] === datos.mp_id_mantener) { nombreMantener = mVals[i][idxNombre]; filaMantenerIdx = i; }
    if (mVals[i][idxId] === datos.mp_id_eliminar) filaEliminarIdx = i;
  }
  if (filaMantenerIdx < 0) return { ok: false, msg: 'MP a mantener no encontrada' };
  if (filaEliminarIdx < 0) return { ok: false, msg: 'MP a eliminar no encontrada' };

  // Recorrer las 4 áreas buscando referencias en ingredientes_JSON e insumos_JSON
  const areas = ['PAN', 'BOL', 'CAF', 'PAS'];
  let recetasActualizadas = [];

  areas.forEach(area => {
    const hoja = ss.getSheetByName(area + '_recetas');
    if (!hoja || hoja.getLastRow() < 2) return;
    const headers = hoja.getRange(1,1,1,hoja.getLastColumn()).getValues()[0];
    const idxIdReceta = headers.indexOf('ID_receta');
    const idxNombreReceta = headers.indexOf('nombre');
    const idxIng = headers.indexOf('ingredientes_JSON');
    const idxIns = headers.indexOf('insumos_JSON');
    const idxEstadoReceta = headers.indexOf('estado');
    const vals = hoja.getRange(2,1,hoja.getLastRow()-1,headers.length).getValues();

    vals.forEach((row, i) => {
      let modificado = false;

      if (idxIng > -1 && row[idxIng]) {
        let ings = [];
        try { ings = JSON.parse(row[idxIng]); } catch(e) { ings = null; }
        if (ings) {
          const nuevos = ings.map(ing => {
            if (ing.id === datos.mp_id_eliminar) {
              modificado = true;
              return { ...ing, id: datos.mp_id_mantener, nombre: nombreMantener };
            }
            return ing;
          });
          if (modificado) hoja.getRange(i+2, idxIng+1).setValue(JSON.stringify(nuevos));
        }
      }

      if (idxIns > -1 && row[idxIns]) {
        let inss = [];
        try { inss = JSON.parse(row[idxIns]); } catch(e) { inss = null; }
        if (inss) {
          let modIns = false;
          const nuevos = inss.map(ins => {
            if (ins.id === datos.mp_id_eliminar) {
              modIns = true;
              return { ...ins, id: datos.mp_id_mantener, nombre: nombreMantener };
            }
            return ins;
          });
          if (modIns) { hoja.getRange(i+2, idxIns+1).setValue(JSON.stringify(nuevos)); modificado = true; }
        }
      }

      if (modificado) {
        recetasActualizadas.push(area + ': ' + row[idxNombreReceta]);
        // Si estaba aprobada, la devolvemos a "en_prueba" para que aparezca en
        // Aprobaciones de forma persistente hasta que se revise y re-apruebe.
        if (idxEstadoReceta > -1 && row[idxEstadoReceta] === 'consolidada') {
          hoja.getRange(i+2, idxEstadoReceta+1).setValue('pendiente_aprobación');
        }
      }
    });
  });

  // Marcar la MP duplicada como reemplazada (no se borra la fila)
  if (idxEstado > -1) hMaestro.getRange(filaEliminarIdx+2, idxEstado+1).setValue('reemplazada');
  if (idxReemplazadaPor > -1) hMaestro.getRange(filaEliminarIdx+2, idxReemplazadaPor+1).setValue(datos.mp_id_mantener);

  return {
    ok: true,
    msg: recetasActualizadas.length + ' receta(s) actualizada(s) y devueltas a "en_prueba" — van a aparecer en Aprobaciones hasta que las revise y apruebe.',
    recetas: recetasActualizadas
  };
}

function reemplazarMPEnReceta(datos) {
  // datos: { area_codigo, receta_id, mp_id_vieja, mp_id_nueva, nombre_nueva }
  const ss   = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName(datos.area_codigo + '_recetas');
  if (!hoja) return { ok: false, msg: 'Hoja no encontrada' };

  const vals    = hoja.getDataRange().getValues();
  const headers = vals[0];
  const idIdx   = headers.indexOf('ID_receta');
  const ingIdx  = headers.indexOf('ingredientes_JSON');
  if (idIdx < 0 || ingIdx < 0) return { ok: false, msg: 'Columnas no encontradas' };

  for (let i = 1; i < vals.length; i++) {
    if (vals[i][idIdx] !== datos.receta_id) continue;
    let ings = [];
    try { ings = JSON.parse(vals[i][ingIdx] || '[]'); } catch(e) { continue; }

    // Reemplazar la MP temporal por la nueva
    let modificado = false;
    ings = ings.map(ing => {
      if (ing.id === datos.mp_id_vieja || ing.nombre.includes('pendiente')) {
        modificado = true;
        return { ...ing, id: datos.mp_id_nueva, nombre: datos.nombre_nueva };
      }
      return ing;
    });

    if (modificado) {
      hoja.getRange(i + 1, ingIdx + 1).setValue(JSON.stringify(ings));
      return { ok: true, msg: 'Ingrediente reemplazado en receta' };
    }
  }

  return { ok: false, msg: 'Receta o ingrediente no encontrado' };
}

// ── EDITAR PRECIO MP ─────────────────────────────────────────
// Interpreta la unidad de compra (ej. "kg", "25kg", "un", "10un", "500ml", "lt")
// y devuelve cuántos gramos/mililitros/unidades representa el paquete completo,
// para dividir correctamente el costo del paquete y obtener el costo por gramo/unidad real.
function parsearUnidadCompra(unidadStr) {
  const s = (unidadStr || 'kg').toString().trim().toLowerCase().replace(',', '.');
  const m = s.match(/^(\d+(?:\.\d+)?)?\s*(kg|g|lt|l|ml|un|unidad|unidades)$/);
  if (!m) return { factorBase: 1000 }; // formato no reconocido: asumir kg simple, como antes
  const cantidad = m[1] ? parseFloat(m[1]) : 1;
  const unidad = m[2];
  if (unidad === 'un' || unidad === 'unidad' || unidad === 'unidades') return { factorBase: cantidad };
  if (unidad === 'kg' || unidad === 'lt' || unidad === 'l') return { factorBase: cantidad * 1000 };
  if (unidad === 'g' || unidad === 'ml') return { factorBase: cantidad };
  return { factorBase: 1000 };
}

function editarMP(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const h  = ss.getSheetByName('MP_maestro');
  if (!h) return { ok: false, msg: 'Hoja no encontrada' };

  const headers = h.getRange(1, 1, 1, h.getLastColumn()).getValues()[0];
  const ids     = h.getRange(1, 1, h.getLastRow(), 1).getValues().flat();
  const idx     = ids.indexOf(datos.ID_MP);
  if (idx < 1)  return { ok: false, msg: 'MP no encontrada: ' + datos.ID_MP };

  const colNeto  = headers.indexOf('costo_neto') + 1;
  const colIVA   = headers.indexOf('IVA_%') + 1;
  const colImp   = headers.indexOf('imp_adicional_%') + 1;
  const colBruto = headers.indexOf('costo_bruto') + 1;
  const colKg    = headers.indexOf('costo_por_kg') + 1;
  const colGr    = headers.indexOf('costo_por_gramo') + 1;
  const colUnidadCompra = headers.indexOf('unidad_compra') + 1;

  const neto = parseFloat(datos.costo_neto) || 0;
  const ivaCelda = datos.iva_pct !== undefined ? parseFloat(datos.iva_pct) :
    (colIVA > 0 ? parseFloat(h.getRange(idx+1, colIVA).getValue()) : NaN);
  const iva  = (isNaN(ivaCelda) || ivaCelda === 0) ? (datos.iva_pct !== undefined ? 0 : 0.19) : ivaCelda;
  const imp  = datos.imp_adicional_pct !== undefined ? (parseFloat(datos.imp_adicional_pct) || 0) :
    (colImp > 0 ? (parseFloat(h.getRange(idx+1, colImp).getValue()) || 0) : 0);
  const bruto = neto * (1 + iva + imp);
  // Si viene unidad_compra en el payload, se guarda ANTES de calcular el factor —
  // así el precio y la unidad quedan correctos en un solo paso, sin depender de
  // que alguien use "Cambiar unidad de compra" por separado antes.
  if (datos.unidad_compra !== undefined && colUnidadCompra > 0) {
    h.getRange(idx+1, colUnidadCompra).setValue(datos.unidad_compra);
  }
  const unidadCompra = datos.unidad_compra !== undefined
    ? datos.unidad_compra
    : (colUnidadCompra > 0 ? (h.getRange(idx+1, colUnidadCompra).getValue() || '').toString() : '');
  // El costo neto es del PAQUETE completo (ej. $440 por el saco de 25kg) — se divide
  // por lo que ese paquete representa en gramos/unidades para obtener el costo real
  // por gramo/unidad, en vez de asumir siempre "por kilo" o "por unidad" sin más.
  const { factorBase } = parsearUnidadCompra(unidadCompra);
  const porKg = bruto; // se mantiene igual, es solo referencia informativa
  const porGr = bruto / factorBase;

  if (colNeto  > 0) h.getRange(idx+1, colNeto).setValue(neto);
  if (colIVA   > 0) h.getRange(idx+1, colIVA).setValue(iva);
  if (colBruto > 0) h.getRange(idx+1, colBruto).setValue(bruto);
  if (colKg    > 0) h.getRange(idx+1, colKg).setValue(porKg);
  if (colGr    > 0) h.getRange(idx+1, colGr).setValue(porGr);

  // Actualizar estado si viene
  if (datos.estado) {
    const colEstado = headers.indexOf('estado') + 1;
    if (colEstado > 0) h.getRange(idx+1, colEstado).setValue(datos.estado);
  }

  // Actualizar areas_habilitadas si viene
  if (datos.areas_habilitadas !== undefined) {
    const colAreas = headers.indexOf('areas_habilitadas') + 1;
    if (colAreas > 0) h.getRange(idx+1, colAreas).setValue(datos.areas_habilitadas);
  }

  // Actualizar observaciones si viene
  if (datos.observaciones !== undefined) {
    const colObs = headers.indexOf('observaciones') + 1;
    if (colObs > 0) h.getRange(idx+1, colObs).setValue(datos.observaciones);
  }

  // Si el costo por gramo/unidad cambió de verdad, recalcular y actualizar
  // automáticamente todas las recetas que usan esta MP — mismo patrón de
  // gobernanza que renombrarMP: el número se actualiza solo, pero la receta
  // vuelve a "en_prueba" para que alguien la revise antes de reconsolidarla.
  let recetasActualizadas = [];
  if (colGr > 0) {
    recetasActualizadas = recostearRecetasPorMP(datos.ID_MP, porGr);
  }

  return {
    ok: true,
    msg: 'MP actualizada: ' + datos.ID_MP,
    recetasActualizadas
  };
}

// Recorre las 4 áreas y recalcula el costo de cada ingrediente/insumo que use
// esta MP, usando su cantidad ya guardada (gramos/unidades) × el nuevo costo
// por gramo — misma fórmula que usa auditarCostosRecetas(). Actualiza el JSON
// de la receta y la devuelve a "en_prueba" si estaba consolidada.
function recostearRecetasPorMP(mpId, nuevoCostoPorGramo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const areas = ['PAN', 'BOL', 'CAF', 'PAS'];
  const recetasActualizadas = [];

  areas.forEach(area => {
    const hoja = ss.getSheetByName(area + '_recetas');
    if (!hoja || hoja.getLastRow() < 2) return;
    const headers = hoja.getRange(1,1,1,hoja.getLastColumn()).getValues()[0];
    const idxNombreReceta = headers.indexOf('nombre');
    const idxEstadoReceta = headers.indexOf('estado');
    const idxIng = headers.indexOf('ingredientes_JSON');
    const idxIns = headers.indexOf('insumos_JSON');
    const vals = hoja.getRange(2,1,hoja.getLastRow()-1,headers.length).getValues();

    vals.forEach((row, i) => {
      let modificado = false;

      if (idxIng > -1 && row[idxIng]) {
        try {
          const ings = JSON.parse(row[idxIng]);
          const nuevos = ings.map(ing => {
            if (ing.id !== mpId) return ing;
            modificado = true;
            const gramos = parseFloat(ing.gramos) || 0;
            return { ...ing, costo: nuevoCostoPorGramo * gramos };
          });
          if (modificado) hoja.getRange(i+2, idxIng+1).setValue(JSON.stringify(nuevos));
        } catch(e) {}
      }

      if (idxIns > -1 && row[idxIns]) {
        try {
          const inss = JSON.parse(row[idxIns]);
          let modIns = false;
          const nuevos = inss.map(ins => {
            if (ins.id !== mpId) return ins;
            modIns = true;
            const unidades = parseFloat(ins.unidades) || 0;
            return { ...ins, costo: nuevoCostoPorGramo * unidades };
          });
          if (modIns) { hoja.getRange(i+2, idxIns+1).setValue(JSON.stringify(nuevos)); modificado = true; }
        } catch(e) {}
      }

      if (modificado) {
        recetasActualizadas.push(area + ': ' + row[idxNombreReceta]);
        if (idxEstadoReceta > -1 && row[idxEstadoReceta] === 'consolidada') {
          hoja.getRange(i+2, idxEstadoReceta+1).setValue('pendiente_aprobación');
        }
      }
    });
  });

  return recetasActualizadas;
}