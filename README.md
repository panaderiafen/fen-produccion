# fën producción · v2.1.0

**App:** v2.1.0 · **Apps Script:** Seguridad.gs v2.1.0 (Code.gs no cambia) · 4 de octubre de 2026

## Qué cambia

| Antes (v2.0) | Ahora (v2.1) |
| --- | --- |
| Cada vez que la tablet apagaba la pantalla o se recargaba la página, la jefa tenía que volver a poner su PIN | La jefa pone su PIN **una vez por turno**. Si la pantalla se apaga o la página se recarga, vuelve directo a su área. Su turno dura 12 horas o hasta que toque **Salir** |
| Al entrar, la app pedía los datos uno tras otro (configuración, materias primas, recetas, plan) | Los pide **todos a la vez**: la carga demora lo que el más lento, no la suma |
| "Sincronizar" borraba todo lo guardado en el sitio, también lo de otras apps del mismo equipo (la autorización de la tablet de Asistencia, la dirección del script de B2B, las sesiones de Gastos, la impresora de la caja) | Borra solo lo de Producción y respeta lo de las demás apps |
| Una jefa podía seguir entrando con la autorización vencida de un equipo hasta que se limpiara | El servidor revisa que la autorización del equipo siga vigente en cada acción |

(i) Si se cierra la sesión de una jefa desde **Administración → Seguridad**, o deja de ser jefa del área, al recargar la tablet ya no entra: vuelve a la pantalla de áreas.

(i) En una tablet compartida, la jefa debe tocar **Salir** al terminar su turno, para que otra persona no trabaje con su sesión.

## Archivos y dónde va cada uno
```
index.html     (solo cambian los números de versión de los archivos)  → GitHub, raíz del repo de Producción
config.js      la sesión de la jefa queda guardada en el equipo        → GitHub, raíz
acceso.js      retoma el turno de la jefa al abrir                     → GitHub, raíz
app.js         carga en paralelo; "Sincronizar" respeta otras apps     → GitHub, raíz
Seguridad.gs   v2.1.0                                                  → Apps Script de Producción (reemplaza el archivo Seguridad)
README.md      este archivo                                            → GitHub, respaldos/produccion-v2.1.0/
```
`Code.gs`, `subrecetas.js` y `main.css` no cambian.

## Instalación

### 1. Prueba (copia PRUEBA de Producción)
1. En el Apps Script de **Producción PRUEBA**, reemplaza `Seguridad` por `Seguridad.gs` v2.1.0 y guarda. Gestionar implementaciones → la de prueba → ✏️ → Nueva versión → Implementar. Ping: `"version":"2.1.0"`.
2. **Antes de subir la carpeta de prueba:** abre en GitHub tu `prueba/config.js` actual y copia la URL que está en `WEBAPP_URL`.
3. Sube la carpeta `prueba` del zip `prueba-produccion-v2.1.zip` (reemplaza la anterior). Después edita `prueba/config.js` con el lápiz ✏️ y pega esa URL en lugar de `PEGA_AQUI_LA_URL_DE_PRUEBA` → Commit.
   (i) La carpeta de prueba guarda sus sesiones aparte (`fen_prodprueba_…`), así no se mezcla con la app real en el mismo equipo.
4. Revisa la lista de verificación.

### 2. Producción
1. En el Apps Script real de Producción, reemplaza `Seguridad` por `Seguridad.gs` v2.1.0 y guarda → Gestionar implementaciones → la de **siempre** → ✏️ → Nueva versión → Implementar. Ping: `"version":"2.1.0"`.
2. Sube a la raíz del repo `index.html`, `config.js`, `acceso.js` y `app.js`.
3. En cada tablet, recarga la página. Las jefas ponen su PIN una vez; desde ahí ya no se les vuelve a pedir en el turno.

## Lista de verificación (en la prueba)
- [ ] Una jefa entra con su PIN. Recargas la página (o apagas y prendes la pantalla): vuelve a su área **sin pedir PIN** y sigue sin ver costos.
- [ ] Toca **Salir** y recargas: aparece la pantalla de áreas (no entra sola).
- [ ] Como Administración → Seguridad, cierras la sesión de esa jefa. En la tablet, al recargar o en su siguiente acción, le pide entrar de nuevo.
- [ ] La carga al entrar a un área se siente más rápida.

## Si algo sale mal
Gestionar implementaciones → la de siempre → versión anterior, y en GitHub restaura los archivos anteriores desde el historial. No se pierde ningún dato: v2.1 no cambia ninguna hoja.

## Pruebas automáticas
- **Script (20):** las 18 de la v2.0 más: "estado" solo reconoce a una jefa mientras siga vigente (deja de serlo → no se retoma); con la autorización del equipo vencida, la sesión de la jefa ya no vale.
- **Navegador (11):** las de la v2.0 más: al recargar, la jefa vuelve a su área sin PIN y sin costos; después de Salir, recargar no entra; con la sesión cerrada desde Seguridad, recargar no la retoma.
- **Sincronizar (1):** borra solo claves de Producción y conserva las de Asistencia, B2B, Gastos, la caja y la sesión.
