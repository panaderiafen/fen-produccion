# fën — Sistema de producción

Sistema de gestión de recetas y estructuras de costos para panadería, bollería, pastelería y cafetería.

## Estructura del proyecto

```
fen-produccion/
├── index.html          ← App principal
├── css/
│   └── main.css        ← Estilos
├── js/
│   ├── config.js       ← Configuración y conexión al Sheet
│   └── app.js          ← Lógica de la app
├── assets/
│   └── logo.png        ← Logo fën (subir aquí)
└── README.md
```

## Configuración inicial

### 1. Logo
Sube el logo de fën como `assets/logo.png`.

### 2. Google Sheets
El Sheet ID ya está configurado en `js/config.js`:
```
SHEET_ID: '1lGL6SPgvBAZfRU4WUKUEr7ZEo1WD0Wq92qoyghk8pyY'
```

Para que la app pueda **leer** datos, el Sheet debe estar publicado:
- Archivo → Compartir → Publicar en la web
- Publicar como: hoja de cálculo completa → CSV

### 3. Escritura (Apps Script Web App)
Para que la app pueda **escribir** (guardar recetas, planificación, etc.):

1. Abre el Sheet → Extensiones → Apps Script
2. Crea un archivo nuevo `webapp.gs`
3. Pega el contenido de `webapp.gs` (próximo paso)
4. Implementar → Nueva implementación → Aplicación web
5. Ejecutar como: Yo / Quién tiene acceso: Cualquier persona
6. Copia la URL generada y pégala en `js/config.js` → `WEBAPP_URL`

### 4. GitHub Pages
1. Settings → Pages → Branch: main → / (root)
2. La app queda en: `https://panaderiafen.github.io/fen-produccion/`

## Roles

| Rol | Acceso |
|-----|--------|
| Jefa de Panadería | Recetas PAN + planificación + maestro PAN |
| Jefa de Bollería | Recetas BOL + planificación + maestro BOL |
| Jefa de Pastelería | Recetas PAS + planificación + maestro PAS |
| Jefa de Cafetería | Recetas CAF + maestro CAF |
| Administración | Aprobaciones + MP + EC + maestro global |

## Flujo de una receta

```
Borrador → En prueba → Pendiente aprobación → Consolidada (Maestro)
                                    ↓
                          Estructura de Costos (solo admin)
```
