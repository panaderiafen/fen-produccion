# fën producción · v2.1.2

**App:** v2.1.2 · **Apps Script:** Seguridad.gs v2.1.2 (Code.gs no cambia) · 4 de octubre de 2026

Incluye todo lo de la v2.1.1. No hace falta instalar la v2.1.1 antes.

## Qué pasaba
Al recargar, la app esperaba **dos veces** al servidor (5 a 20 segundos cada una) antes de retomar el turno de la jefa. Mientras tanto mostraba las tarjetas. Si la jefa tocaba su tarjeta en ese rato, se abría el PIN y su turno se cortaba a medio retomar:
- en el computador entraba igual, por detrás del PIN;
- en el celular aparecía "Tu sesión venció".

## Qué cambia

| Antes (v2.1.0 / v2.1.1) | Ahora (v2.1.2) |
| --- | --- |
| Al recargar, la jefa veía las tarjetas y esperaba 2 respuestas del servidor antes de entrar | Entra **al tiro** a su área. El equipo recuerda de qué área es su turno, y el servidor revisa la sesión en cada pedido de datos, como siempre |
| Las tarjetas decían "Recetas · Planificación · Maestro" hasta que respondía el servidor | Muestran al tiro "Entra: Camila" (queda guardado en el equipo) y se actualizan solas en segundo plano |
| Al tocar la tarjeta, el PIN demoraba en aparecer | Aparece al tiro |
| Tocar la tarjeta mientras se retomaba el turno lo cortaba ("Tu sesión venció") | Ya no hay tarjetas que tocar mientras se retoma. Para turnos abiertos con la versión anterior (sin área guardada), las tarjetas quedan bloqueadas unos segundos y la jefa entra sola |
| El servidor volvía a preguntar a Asistencia quién tiene PIN cada 10 minutos (lento) | Cada 6 horas. Administración → Seguridad lo refresca al abrirse |

(i) Lo que todavía demora es cargar los datos del área (recetas, plan, materias primas): unos segundos, lo que tarde Apps Script. Eso pasa igual con o sin PIN.

(i) Si a una persona le asignas PIN en Asistencia y no aparece en la tarjeta, abre Administración → Seguridad: eso actualiza la lista.

(i) Diagnóstico del último intento de retomar el turno: F12 → Consola → `localStorage.getItem('fen_prod_diag')`. Valores posibles: `local` (entró al tiro), `ok`, `sin_sesion`, `vencida`, `equipo`, `no_jefa`, `red`.

## Archivos y dónde va cada uno
```
index.html     números de versión                                → GitHub, raíz del repo fen-produccion
config.js      guarda el área del turno junto a la sesión         → GitHub, raíz
acceso.js      entrada al tiro; tarjetas con lo guardado          → GitHub, raíz
app.js         arranque sin esperar al servidor                   → GitHub, raíz
main.css       tarjetas bloqueadas mientras se retoma             → GitHub, raíz
Seguridad.gs   v2.1.2 (lista de PIN guardada 6 h; motivo del aviso) → Apps Script de Producción (reemplaza el archivo Seguridad)
README.md      este archivo                                       → GitHub, raíz
```
`Code.gs` y `subrecetas.js` no cambian.

## Instalación (directo a producción)
1. **Apps Script de Producción:** reemplaza `Seguridad` por `Seguridad.gs` → Guardar → Implementar → Gestionar implementaciones → la de **siempre** → ✏️ → Versión: **Nueva versión** → Implementar. Ping (`…/exec?action=ping`): `"version":"2.1.2"`.
2. **GitHub, raíz de `fen-produccion`:** sube los 6 archivos de la app (`index.html`, `config.js`, `acceso.js`, `app.js`, `main.css`, `README.md`).
3. Espera 2 minutos y recarga. Abajo de las tarjetas debe decir **app v2.1.2**.

## Lista de verificación
- [ ] **Computador:** la jefa entra con su PIN. Recarga: entra al tiro a su área, sin ver las tarjetas. Recarga otra vez: igual.
- [ ] **Celular:** lo mismo. La primera recarga puede tardar unos segundos con las tarjetas grises (el turno era de la versión anterior); desde ahí entra al tiro.
- [ ] Toca **Salir** y recarga: aparecen las tarjetas, ya con "Entra: …" sin esperar.

## Si algo sale mal
Gestionar implementaciones → la de siempre → versión anterior, y en GitHub restaura los archivos anteriores desde el historial. No cambia ninguna hoja.

## Pruebas automáticas (37, todas pasan)
Las 34 de la v2.1.1 más:
- Con el servidor demorado 6 segundos, la jefa ve su área en menos de 0,2 s al recargar (simulador).
- Un turno sin área guardada bloquea las tarjetas; tocarlas no lo corta y la jefa entra sola.
- Las tarjetas muestran quién entra y abren el PIN sin esperar al servidor.
