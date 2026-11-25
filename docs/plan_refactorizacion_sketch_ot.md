# Plan de Refactorización Modular — `sketch-ot.html`

> **Rama de trabajo:** `ui/sketch-exp-2`  
> **Archivo origen:** `sketch-ot.html` (4,448 líneas)  
> **Destino temporal de módulos:** `src/sketch/` (sin tocar `index.html`, `src/client/*` ni `src/server/*` durante la refactorización)

---

## 1. Objetivo y Reglas

1. **Cero cambios arbitrarios:** mantener exactamente los mismos textos, clases Tailwind, layout Obsidian de 3 columnas y flujos validados en `http://localhost:5173/sketch-ot.html`.
2. **Nomenclatura limpia:** en los módulos nuevos no usar *"Sobre abierto"*; el módulo de vista individual de OT/sub-tarea se llamará **`ot-detail.js`** (*Detalle de OT / Tarea*).
3. **Verificación tras cada paso:** después de extraer cada módulo, recargar `http://localhost:5173/sketch-ot.html` y verificar la consola del navegador sin errores antes de pasar al siguiente módulo.
4. **Corrección de P0 en el camino:** aprovechar la extracción de cada archivo para corregir los bugs críticos detectados en la auditoría sin alterar el diseño visual.
5. **Estado ESM seguro (`sketchState`):** nunca exportar variables primitivas mutables con `export let` (en ES Modules lanzaría `TypeError: Assignment to constant variable` al reasignarlas desde otro archivo). Todo el estado mutable debe vivir en `export const sketchState = { ... }`.
6. **Sin dependencias circulares:** los módulos de vista (`traffic.js`, `ot-detail.js`, `stripboard.js`, `gallery.js`, `client-modal.js`) no deben importarse entre sí en círculo; usar un mini bus por canal en `store.js` (`notifySketchChange(topic)` / `onSketchChange(topic, fn)`, con canales como `'orders' | 'clients' | 'team' | 'stripboard' | 'gallery' | 'settings'`) o callbacks registrados en `main.js`.

---

## 2. Estructura Destino (`src/sketch/`)

```text
src/sketch/
├── sketch.css        # Estilos extraídos del <style> inline de sketch-ot.html (scrollbars, resizers, reglas custom)
├── store.js          # Datos en memoria + sketchState + mini bus notifySketchChange/onSketchChange + helpers
├── navigation.js     # Shell, resizers de columnas, menú lateral deslizable y router de vistas
├── client-modal.js   # Modal Crear/Editar Cliente (#new-client-modal) y selectores de Cliente/Marca/Producto
├── settings.js       # Modal unificado del Piñón (#settings-modal): Estudio, Miembros, Clientes, Membresía, Datos, Preferencias
├── new-ot.js         # Formulario Nueva OT (#view-new-ot)
├── traffic.js        # Árbol izquierdo (#left-traffic-tree) + grilla Tráfico / Todas las tareas / OTs Archivadas
├── gallery.js        # Sección reutilizable de Galería/Documentos/Desarrollo y vista Archivo (#view-gallery)
├── ot-detail.js      # Detalle de OT y Tarea (#view-my-ots) + árbol izquierdo de tareas + Inspector de horas/día (#right-body)
├── stripboard.js     # Mis Tareas / Stripboard (#view-stripboard): Lista, Día, Semana, Gantt, Mes + Drag & Drop
└── main.js           # Punto de entrada importado desde sketch-ot.html (<script type="module" src="/src/sketch/main.js">)
```

---

## 3. Fases de Ejecución (Módulo por Módulo)

### Fase 1 — Estilos, Estado y Helpers (`src/sketch/sketch.css`, `src/sketch/store.js`)
- Extraer el bloque `<style>` del `<head>` de `sketch-ot.html` hacia `src/sketch/sketch.css` (importado desde `main.js` o enlazado en `sketch-ot.html`).
- Extraer a `src/sketch/store.js`:
  - `clientsData`, `trafficStatuses`, `trafficMembers`, `trafficOrders`, `standaloneDocuments`, `standaloneDevFiles`
  - `studioSettings`, `studioTeamList`
  - Objeto único `export const sketchState = { ... }` con las variables de estado mutables (`trafficScope`, `trafficFilter`, `myOtsMember`, `activeMyOtId`, `activeTaskIndex`, `stripboardDate`, `stripboardViewMode`, `stripboardListItems`, `stripboardStripsByDate`, etc.)
  - Mini bus por canal `notifySketchChange(topic)` / `onSketchChange(topic, fn)`
  - Helpers compartidos (`escapeHtml`, `relDate`, `shiftIsoDate`, `getClientColor`, `formatShortDate`, `ensureOtData`).
- **Ajustes incluidos:**
  - Asegurar `escapeHtml()` disponible desde el inicio para todos los módulos (corrige XSS en dropdowns).
  - Unificar `studioTeamList` y `trafficMembers` para que invitar o quitar un miembro en Ajustes actualice las listas de responsables.
- **Verificación:** `sketch-ot.html` importa `store.js` y todo sigue renderizando igual.

### Fase 2 — Shell, Navegación y Modales de Cliente/Ajustes (`navigation.js`, `client-modal.js`, `settings.js`)
- Extraer:
  - Resizers de paneles (`makeColResizer`), botones del menú izquierdo (`ot-sub-btn`, `#btn-desktop-menu`, `#btn-left-back`) -> `navigation.js`.
  - `openClientModal`, selectores de Cliente/Marca/Producto de Nueva OT -> `client-modal.js` (L1317+).
  - `openSettingsModal` y `renderSettingsTab` -> `settings.js` (L1474+).
- **Ajustes incluidos:**
  - Escapar HTML en dropdowns de Cliente/Marca/Producto.
  - Si se renombra un cliente en `#new-client-modal`, propagar el cambio a `trafficOrders` y re-renderizar árbol/grilla.
  - Hacer que `#st-reset-app` limpie también `stripboardListItems`, `stripboardStripsByDate`, `standaloneDocuments` y `standaloneDevFiles`.
- **Verificación:** probar menú izquierdo, `#new-client-modal` y todas las pestañas del Piñón.

### Fase 3 — Tráfico y Nueva OT (`traffic.js`, `new-ot.js`)
- Extraer:
  - `renderTrafficTree` (L1906+) y `renderTrafficGrid` (L2009+) -> `traffic.js`.
  - Lógica del formulario `#view-new-ot` -> `new-ot.js`.
- **Ajustes P0 incluidos:**
  - Conectar el envío real del formulario `#view-new-ot` (`Crear y Abrir OT` / `Cancelar`) para insertar una OT en `trafficOrders` y abrirla.
  - Corregir en `renderTrafficGrid()` la edición de `entryDate`/`deliveryDate` para no sobrescribir fechas ISO con formato corto `DD/MM HH:mm`.
  - Sincronizar `archived` cuando el estado cambia a `Archivada`/`Cancelado`.
- **Verificación:** crear OT en Nueva OT, verificar que aparezca en Tráfico, filtrar por cliente/marca, editar fecha y estado.

### Fase 4 — Archivo / Galería (`gallery.js`)
- Extraer:
  - `renderGallerySectionHtml` (L2627+), `bindGalleryEvents` y `renderStandaloneGallery` (L3250+) -> `gallery.js`.
- **Ajustes incluidos:**
  - Alinear clientes/marcas de `standaloneDocuments` y `standaloneDevFiles` con `clientsData` para que funcionen los filtros del árbol izquierdo.
  - Reiniciar `galleryPage = 1` al buscar en `#ot-gallery-search`.
- **Verificación:** probar `Galería`, `Documentos` y `Desarrollo` con filtros y paginación.

### Fase 5 — Detalle de OT / Tarea + Inspector (`ot-detail.js`)
- Extraer:
  - `renderMyOts` (L3881+), `renderEnvelopeTaskTree` -> renombrada a `renderOtTaskTree`, `renderOtInfoRowHtml`, y `renderSobreAbiertoHtml` (L2530+) -> renombrada internamente a `renderOtDetailHtml` -> `ot-detail.js`.
  - Renderizado del Inspector en `#right-body` (tiempo estimado en horas, día programado y capacidad `Xh / jornada`).
  - Eliminar código muerto legado (`openEnvelopeView` / `#view-envelope-open`).
- **Ajustes P0 incluidos:**
  - Corregir el **`ReferenceError: activeTask is not defined`** al seleccionar o eliminar piezas masivamente en `bindGalleryEvents()`.
  - Conectar `#my-ots-member-select` y `#my-ots-count` en `#view-my-ots`.
  - Conectar `studioSettings.dailyHours` en el cálculo de capacidad del Inspector (en lugar de `8` fijo).
- **Verificación:** abrir OTs y tareas individuales, cambiar horas/día en el Inspector y probar selección/borrado de piezas.

### Fase 6 — Stripboard / Mis Tareas (`stripboard.js`)
- Extraer:
  - `getAllMyTaskPool`, `ensureStripboardListSeeded`, `ensureStripboardDaySeeded`, `getDayReservedHours`, `moveTaskToScheduledDate` y `renderStripboard` (L3416+) -> `stripboard.js`.
- **Ajustes P0 incluidos:**
  - Corregir `moveTaskToScheduledDate()` para que **no borre** separadores (`break`), tareas libres (`free-*`) ni el orden manual del día destino.
  - Corregir el off-by-one en Drag & Drop de `Lista`/`Día` cuando `fromIdx < targetIdx`.
  - Implementar agrupación real cuando se selecciona `#sb-group-by` (`Cliente`, `Estado`, `Entrega`).
  - Usar `studioSettings.dailyHours` en el indicador de capacidad y corte de jornada.
- **Verificación:** probar `Lista`, `Día` (reordenar filas y ver corte de jornada), `Semana` (arrastrar tarjetas entre días), `Gantt` y `Mes`.

### Fase 7 — Limpieza Final de `sketch-ot.html` y Commit
- `sketch-ot.html` queda únicamente con el HTML estructural y `<script type="module" src="/src/sketch/main.js"></script>`.
- Prueba completa de punta a punta en `http://localhost:5173/sketch-ot.html`.
- Commit en `ui/sketch-exp-2` como base limpia y modular.

---

## 4. Paso Siguiente (Migración a Producción en `feat/migrate-obsidian-src`)

Una vez validado `sketch-ot.html` modular en `ui/sketch-exp-2`:
1. Cambiar a `feat/migrate-obsidian-src` (que ya tiene el commit de servidor `572ffca`).
2. Copiar el HTML exacto de `sketch-ot.html` a `index.html` (manteniendo el overlay de Auth/Login y `styles.css`).
3. Reemplazar en `src/sketch/store.js` los datos en memoria por llamadas asíncronas a `data-bridge.js` / `/api/...`, módulo por módulo, sin tocar las vistas ni los textos ya validados.

