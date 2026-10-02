# fën producción · v2.0.0 (seguridad)

**App:** v2.0.0 · **Apps Script:** v2.0.0 (`Code.gs` + `Seguridad.gs`) · Requiere **Asistencia Apps Script v5.1.0** · 1 de octubre de 2026

Es la segunda entrega de la Fase 0 de Sistema Fën. Cierra las puertas de seguridad de Producción. Las pantallas y el trabajo diario siguen iguales: lo que cambia es **cómo se entra** y **qué ve cada persona**.

## Qué cambia

| Antes (v1) | Ahora (v2) |
| --- | --- |
| La planilla estaba publicada en la web completa: cualquiera con el enlace veía costos, recetas e ingredientes | La planilla queda privada. La app lee cada hoja a través del Apps Script, con sesión. Solo `Lista_publica_productos` sigue publicada, porque la usan la caja y B2B |
| La clave de Administración (`fen2026admin`) estaba escrita en `app.js`, que es público | Administración entra con **tu contraseña de dueño**, la misma del panel de Asistencia, y la revisa el servidor. Si marcas "Recordar en este equipo", la sesión dura 30 días; si no, hasta cerrar la pestaña. Siempre termina al tocar "Salir" |
| Cualquiera entraba a un área con un clic | Cada equipo de cocina se **autoriza una vez** con tu contraseña. Después, cada jefa entra con **su PIN de Asistencia**. La sesión dura 12 horas o hasta "Salir" |
| El script aceptaba cualquier acción sin revisar quién la pedía | Ninguna acción funciona sin sesión. Lo financiero y las decisiones (aprobar, MP, costeo, informes) son **solo de Administración** |
| Las jefas recibían costos: costo por gramo en las listas de MP y el monto en pesos de la merma | Las jefas **no reciben ningún costo ni precio**. El costo de una receta o de una merma lo calcula el servidor al guardar |
| Algunos envíos iban "a ciegas" (POST no-cors): la app suponía que habían llegado | Toda escritura recibe la respuesta real. Lleva una clave única, así que aunque llegue dos veces se guarda una sola vez, y se hace con bloqueo para que dos personas no se pisen |
| Si Google desviaba la llamada (varias cuentas abiertas), fallaba | La app lo detecta y reintenta por otra vía, igual que Asistencia v5.0.1 |
| — | Nueva sección **Administración → Configuración → Seguridad y acceso**: eliges quién es jefa de cada área (puede haber más de una) y ves o cierras los equipos y sesiones abiertas |

**Quién es jefa de cada área.** La primera vez se toma de **Correos de contacto** (Panadería, Bollería y Cafetería): queda como jefa la persona de ese correo, siempre que esté activa en Asistencia y tenga PIN. **Pastelería** queda sin jefa (panaderiafen@gmail.com no es una persona de Asistencia), así que se abre desde Administración → "Ir a área" hasta que asignes a alguien.

**Una limitación conocida de esta fase.** Una jefa puede escribir en planes y registros de otras áreas, aunque la app no le muestra esa opción. Recetas, estados y eliminación sí están limitados a su área. Como en v1, una jefa puede eliminar sus recetas en borrador o en prueba, pero no las aprobadas. Esto se cierra del todo en el rediseño 2027.

## Archivos

```
index.html     igual que v1 + carga acceso.js + vista "Seguridad"     → GitHub (raíz del repo fen-produccion)
config.js      conexión con sesión; ya no lee la planilla publicada    → GitHub
acceso.js      NUEVO: entrada con PIN / contraseña, sección Seguridad   → GitHub
app.js         v1 + entrada nueva + "Salir" cierra sesión               → GitHub
subrecetas.js  sin cambios (solo versión en index)                      → GitHub
main.css       v1 + estilos de entrada, PIN y Seguridad                 → GitHub
Code.gs        el script de v1, sin doPost/doGet y con MailApp          → Apps Script (reemplaza al archivo que hoy tiene doPost)
Seguridad.gs   NUEVO: recibe todas las llamadas y revisa permisos       → Apps Script (archivo nuevo en el mismo proyecto)
README.md      este archivo                                             → GitHub (respaldo)
```

`logoprincipal.jpg` y `logosecundario.jpg` del repo no cambian. Los otros archivos del proyecto de Apps Script (consolidado mensual y utilidades) tampoco.

## Antes de empezar: Asistencia v5.1.0

Producción le pregunta a Asistencia por tu contraseña y por los PIN. Primero instala **Asistencia Apps Script v5.1.0** siguiendo su README, y deja a mano la **clave de servicio** (`fsv-…`) que entrega `crearClaveServicioProduccion()`. Es un cambio que solo agrega cosas: la tablet y el panel de Asistencia siguen igual.

## 1. Probar en una copia (20–30 minutos)

1. En Drive, abre la planilla de Producción y ve a **Archivo → Crear una copia**. Llámala `fen produccion PRUEBA`. La copia trae su propio Apps Script.
2. En la copia, ve a **Extensiones → Apps Script**:
   - Abre el archivo que tiene `function doPost` (probablemente `webapp.gs` o `Código.gs`) y reemplaza **todo** su contenido por `Code.gs`.
   - Crea un archivo nuevo con **＋ → Secuencia de comandos**, llámalo `Seguridad` y pega `Seguridad.gs`.
   - Revisa que ningún otro archivo tenga `function doPost` o `function doGet` (usa Ctrl+F en cada uno). Si queda una copia antigua de `webapp.gs`, avísame antes de borrarla.
   - Guarda.
3. Ve a **⚙️ Configuración del proyecto → Propiedades del script → Agregar propiedad de la secuencia de comandos** y crea estas dos:
   - `ASISTENCIA_URL` = la URL `/exec` de Asistencia (la que está en `config.js` de Asistencia).
   - `ASISTENCIA_CLAVE` = la clave `fsv-…`.

   (i) Van en propiedades y no en el código porque el código se respalda en GitHub, que es público. Así la clave nunca queda escrita en un archivo.
4. Vuelve al editor, elige la función `instalarSeguridad` y presiona **Ejecutar**. Acepta los permisos: conectarse a un servicio externo (Asistencia) y enviar correos en tu nombre. En el **Registro de ejecución** debe aparecer "Conexión con Asistencia OK" y quién quedó como jefa de cada área.
5. Ve a **Implementar → Nueva implementación → Aplicación web**, con "Ejecutar como: Yo" y "Acceso: Cualquier persona". Copia la URL.
6. En el repo `fen-produccion`, crea una carpeta `prueba` (sin barra ni otros símbolos) con `index.html`, `config.js`, `acceso.js`, `app.js`, `subrecetas.js`, `main.css`, `logoprincipal.jpg` y `logosecundario.jpg`. En `prueba/config.js` cambia `WEBAPP_URL` por la URL del paso 5.
7. Abre `panaderiafen.github.io/fen-produccion/prueba/` y revisa la lista de verificación de abajo.

Durante la prueba, la app real sigue funcionando igual: la copia no la toca.

## 2. Pasar a producción

Hazlo fuera del horario de cocina, porque las jefas tendrán que entrar con su PIN la primera vez.

1. **Respaldo:** **Archivo → Crear una copia** de la planilla real (`fen produccion RESPALDO 2026-10`).
2. En la planilla real, repite los pasos 1.2, 1.3 y 1.4: código, propiedades del script e `instalarSeguridad`.
3. **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva versión → Implementar.** Así la URL no cambia y `config.js` ya la trae.
4. Sube a la raíz del repo `index.html`, `config.js`, `acceso.js`, `app.js`, `subrecetas.js` y `main.css`. Sube también `Code.gs`, `Seguridad.gs` y `README.md` como respaldo.
5. Abre la app, entra como Administración con tu contraseña y revisa **Configuración → Seguridad y acceso**: conexión "Conectada" y las jefas correctas.
6. En cada equipo de cocina, toca el área. La primera vez pedirá tu contraseña y un nombre para el equipo (por ejemplo "Tablet Bollería"). Después, la jefa entra con su PIN.

## 3. Cerrar la planilla (después de comprobar que la app funciona)

1. **Publicación:** en la planilla real, ve a **Archivo → Compartir → Publicar en la Web**. En "Contenido publicado", elige **solo** la hoja `Lista_publica_productos` (no "Documento completo") y deja marcado "Volver a publicar automáticamente".
   - (i) La caja y B2B leen esa hoja (los nombres e IDs de recetas, sin costos). El enlace de publicación no cambia.
   - Comprueba que la caja sigue viendo las recetas fën al vincular un producto, y que B2B sigue mostrando los nombres fën.
2. **Acceso general:** ve a **Compartir → Acceso general → Restringido**. La app ya no lee la planilla directamente.
3. **Respaldo:** cuando todo funcione, borra la copia de respaldo y vacía la papelera.

## Si algo sale mal

- **"Falta conectar Producción con Asistencia" o "Sin conexión"** en Seguridad: revisa las dos propiedades del script. La URL debe terminar en `/exec` y la clave empezar con `fsv-`, sin espacios. Ejecuta `instalarSeguridad` para ver el detalle.
- **Una jefa no aparece en su área:** asígnala en **Seguridad y acceso**. Si dice "Sin PIN", asígnale un PIN en el panel de Asistencia.
- **Se perdió o se robó un equipo:** en **Seguridad y acceso → Equipos y sesiones**, toca **Cerrar** en ese equipo.
- **Olvidaste la contraseña:** se recupera en Asistencia con `restablecerClaveAdmin` (ver su README). Sirve para ambas apps.
- **Volver a v1:** en **Gestionar implementaciones**, elige la versión anterior, restaura los archivos anteriores desde el historial de GitHub y vuelve a publicar la planilla completa. No se pierde ningún dato: v2 no cambia el formato de ninguna hoja.

## Lista de verificación en la copia de prueba

**Jefas (en un equipo de cocina o en el celular):**
- [ ] Al tocar un área por primera vez, pide autorizar el equipo. Una contraseña mala da error y la correcta queda guardada.
- [ ] La jefa entra con su PIN de Asistencia, y un PIN malo avisa "PIN incorrecto". Arriba aparece su nombre y el área.
- [ ] Pastelería avisa que no tiene jefa asignada.
- [ ] En **Registro de merma** ya no aparece el monto en pesos. Al guardar, en la hoja `Registro_merma` de la copia queda `costo_calculado` con valor.
- [ ] Crear o editar una receta y guardarla: en la hoja del área, `ingredientes_JSON` tiene los costos calculados.
- [ ] Enviar una receta a revisión: llega a Aprobaciones y te llega el correo.
- [ ] El plan semanal se guarda y se lee igual que antes.
- [ ] "Salir" vuelve a la pantalla de entrada. Al tocar el área, pide PIN de nuevo, pero no la contraseña del equipo.

**Administración:**
- [ ] `fen2026admin` ya no funciona; tu contraseña de Asistencia sí.
- [ ] Aprobaciones, Materias primas, Estructuras de costo e informes muestran los mismos números que en v1.
- [ ] Aprobar una receta la pasa al maestro y actualiza `Lista_publica_productos`.
- [ ] **Seguridad y acceso:** cambiar una jefa y guardar. Cerrar la sesión de una jefa hace que le pida entrar de nuevo.
- [ ] "Ir a área" sigue funcionando y muestra costos (Administración sí los ve).

## Pruebas automáticas

Corrieron en un simulador de Apps Script con datos ficticios, con Producción y Asistencia conectados como en la realidad, sin internet y sin tocar tus planillas. El simulador queda en mi entorno de trabajo: no hace falta subirlo a GitHub.

- **18 pruebas del script.** Cubren: nada funciona sin sesión, contraseña del dueño y bloqueos, PIN con 0 inicial, jefas sin costos en ninguna lectura, costo de recetas y merma calculado en el servidor, recetas y planes solo de su área, sin autoaprobación, escrituras sin duplicados, Seguridad (jefas y sesiones) y correos con mayúsculas.
- **10 pruebas en el navegador**, en computador y celular, con capturas. Cubren: entrada, autorizar equipo, PIN, merma sin monto, área sin jefa, Administración con y sin "Recordar", Seguridad y cierre de sesión de una jefa.
- Además, una revisión de seguridad independiente encontró 7 problemas, y los 7 quedaron corregidos y probados.

**Lo que estas pruebas no cubren:** la velocidad real de Google (la primera carga puede tardar 1 o 2 segundos más, porque cada hoja pasa por el script) y las ~90 pantallas antiguas una por una. Por eso la lista de verificación en la copia es importante.

## Riesgos conocidos (aceptados en esta fase)

- **Bloqueo de la contraseña.** 5 intentos fallidos bloquean la contraseña del dueño 15 minutos en Asistencia y en Producción. Alguien que conozca la dirección del script podría provocar ese bloqueo a propósito, pero no podría entrar.
- **Admin en equipos de cocina.** Si entras como Administración en una tablet de cocina, no marques "Recordar en este equipo" y toca "Salir" al terminar.
