# Definición Estructurada — Módulo **Tablero de Corcho (`Cuadrante 04`)**

> **Estado:** Especificación funcional, visual y técnica vigente (rama `ui/escritorio-estadistica`).
> **Documentos relacionados:**
> - [`EXPLICACION_MODULO_ESCRITORIO.md`](../../docs/EXPLICACION_MODULO_ESCRITORIO.md)
> - [`ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md`](../ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md)
> - [`MODELO_DOMINIO_ESTUDIO_Y_ESTADOS.md`](../../docs/MODELO_DOMINIO_ESTUDIO_Y_ESTADOS.md)
> - [`definici_n_funcional_y_roles_de_trafigator.md`](../../docs/definici_n_funcional_y_roles_de_trafigator.md)

---

## 1. Concepto Rector

El **Tablero de Corcho (`C04`)**, inspirado en el *Corkboard* de **Scrivener**, es la mesa de referencia espacial permanente del Tablero de Trafigator:

- Opera tanto en **`Global`** (corcho compartido del Estudio) como en **`Personal`** (corcho privado de cada integrante).
- Tiene la **misma altura base (`50% / 50%`)** que los demás cuadrantes del Tablero, línea superior de acento cian (`border-t-2 border-t-cyan-500/70`), manija de intercambio por arrastre (`⋮⋮`), colapsado vertical (`▾`) y expansión en 1 clic a **Tablero Completo (`⤢`)** — ocupando el 100% de la columna central sin ocultar nunca el menú izquierdo, la barra superior de Perfiles ni el **Inspector derecho**.
- Cumple además el rol de **visor contextual temporal** del Tablero:
  - Al seleccionar una **OT o Tarea** en `Prioridades (C01)` o `Calendario (C03)`, abre la **Galería + Vista previa** sobre `C04` (manteniendo intacto el Calendario en `C03`).
  - Al hacer clic sobre la tarjeta de un **gráfico** en `Estadística (C02)`, abre el **gráfico ampliado** sobre `C04` (sin modales flotantes).
  - Al cerrar (`×` o `Esc`), regresa siempre al estado base del **Tablero de Corcho**.

---

## 2. Frontera Arquitectónica: **Tablero de Corcho (`C04`)** vs. **Inspector Derecho (`#pane-right`)**

Para evitar solapamientos entre cuadrantes y paneles globales, Trafigator separa estrictamente la referencia espacial del pulso temporal:

| Dimensión | **Tablero de Corcho (`C04`)** | **Inspector Derecho (`#pane-right`)** |
| :--- | :--- | :--- |
| **Naturaleza** | **Espacial y estático** (mesa de fichas estilo Scrivener). | **Temporal y vivo** (avisos, conversación, trazabilidad y agenda). |
| **Visibilidad** | Exclusivo de la vista **`Tablero`**. | **Transversal y permanente** en toda la app (`Tráfico`, `Nueva OT`, `Stripboard`, `Documentos`, etc.). |
| **Qué aloja** | Pines de trabajo (Brief PDF, imágenes, notas largas, enlaces web, OTs/gráficos clavados), **Widgets de Plugins** y **pauta discreta** (plan gratis). | Cabecera de usuario (campana `#btn-work-notifications`, mensajes, reloj), pestañas `Mensajes \| Actividad \| Lista`, **Recordatorios / Alarmas** (estilo Apple Recordatorios: check + texto de 1 línea + disparo en `5m / 15m / 1h / hora`) y **Mini-calendario** fijo inferior. |

> **Regla de oro:** Ninguna alarma o recordatorio con cuenta regresiva vive en el Tablero de Corcho, porque el usuario debe poder crearlo, consultarlo y recibir su disparo aunque esté fuera del Tablero.

---

## 3. Historias de Usuario

- **HU-01 · Fijar arrastrando desde el Tablero o el computador:** Como usuario, arrastro una tarjeta de OT o Tarea desde `Prioridades (C01)` o `Calendario (C03)` y la suelto sobre `C04` para dejarla clavada como ficha de acceso rápido (sin alterar su etapa, responsable ni fecha de entrega); o arrastro un PDF, imagen o video desde el Finder/explorador para subirlo directo a mi Corcho.
- **HU-02 · Fijar un archivo de OT (ej. Brief PDF) o un gráfico:** Como usuario, cuando inspecciono la Galería de una OT o un gráfico ampliado en `C04`, pulso el ícono de **Pin** en su cabecera para dejar ese Brief PDF, pieza o gráfico clavado permanentemente en mi Corcho en 1 clic.
- **HU-03 · Crear fichas rápidas propias (`+ Nota` · `+ Enlace` · `+ Archivo`):** Como usuario, creo desde la cabecera del Corcho una ficha de texto estilo Scrivener (título + apuntes), guardo un enlace web de referencia o adjunto un archivo suelto de apoyo sin abrir una OT.
- **HU-04 · Reordenar y despinar sin riesgo:** Como usuario, arrastro las fichas dentro de la cuadrícula del Corcho para organizarlas a mi gusto y las retiro con `×` cuando termino, con la garantía de que quitar un pin jamás elimina la OT ni el archivo original del Estudio.
- **HU-05 · Previsualizar, resaltar y comentar en privado:** Como usuario, hago clic en un pin (ej. el PDF del Brief, una imagen o una nota) para abrirlo en **Vista Previa** (dentro de `C04` o expandido a **Tablero Completo** con `⤢`), resaltar fragmentos clave y registrar mis propios apuntes reutilizando la mecánica de Revisión Colaborativa.
- **HU-06 · Compartir una anotación como mensaje en 1 clic:** Como usuario, selecciono cualquier nota o resaltado hecho sobre un pin y lo envío directamente como **mensaje** a otro integrante del equipo o al cliente (vinculado automáticamente a `ot.messages` si el archivo proviene de una OT).
- **HU-07 · Convivencia con Plugins y versión gratuita:** Como Estudio, visualizo en el Corcho los widgets compactos de los **Plugins activos** (ej. cronómetro EgoMaker o instaladores de Packs Demo por Perfil) y, únicamente cuando el estudio opera en **versión gratuita**, una tarjeta discreta de publicidad que desaparece al pasar a un plan pago.

---

## 4. Especificaciones Funcionales y Visuales

### 4.1. Catálogo de Fichas (`pin.type`)

| `pin.type` | Etiqueta monoespaciada | Origen | Contenido visible en la ficha del Corcho |
| :--- | :--- | :--- | :--- |
| **`file`** | `PDF` · `IMG` · `VID` | Pin desde Galería/Documentos de OT o subida/drop local | Miniatura o bloque de formato, nombre del archivo, código ámbar de OT (si pertenece a una) y contador de notas. |
| **`note`** | `NOTA` | Acción `+ Nota` en cabecera de `C04` | Título editable y extracto de 3–4 líneas sobre tarjeta mate estilo ficha Scrivener. |
| **`link`** | `WEB` | Acción `+ Enlace` o pegado de URL | Título, dominio limpio, botón `↗` para abrir pestaña externa y contador de apuntes. |
| **`ot`** / **`task`** | `OT` · `TAREA` | Drag & drop desde `C01` / `C03` o botón Pin en OT | Punto de prioridad *(único uso permitido de punto de color)*, código ámbar clicable, título y cliente en su color. |
| **`chart`** | `GRÁFICO` | Botón `Pin` en cabecera de gráfico abierto en `C04` | Mini-vista viva del gráfico conservando la Vista Rápida y los filtros con que se fijó. |
| **`plugin`** | `PLUGIN` | Registro de plugins activos del Estudio | Superficie compacta declarada por el plugin (ej. EgoMaker / Pack Demo). |
| **`ad`** | `PATROCINADO` | Sistema (exclusivo en plan gratuito) | 1 ficha discreta ubicada al cierre de la grilla, sin animaciones intrusivas; ausente en planes pagos. |

### 4.2. Los 3 Estados Internos de `C04`

1. **Estado 1 — Cuadrícula de Corcho (estado base):**
   - **Cabecera:** `⋮⋮` · `TABLERO DE CORCHO` · acciones rápidas en texto limpio (`+ Nota` · `+ Enlace` · `+ Archivo`, sin cajas ni pastillas) · indicador `Estudio` / `Personal` · `⤢` (Tablero Completo) · `▾` (Colapsar).
   - **Cuerpo:** cuadrícula responsiva de **`2 columnas`** en vista de 4 cuadrantes y **`4 columnas`** en **Tablero Completo**, con *dropzone* activo (borde punteado cian al detectar arrastre de tarjeta `ot`/`task` desde `C01`/`C03` o archivos desde el sistema operativo).
   - **Onboarding / *Horror vacui*:** en estudios recién creados o con Pack Demo activo, incluye de fábrica 1 ficha de bienvenida / guía de 3 pasos y 1 Brief PDF de ejemplo despinables en 1 clic.
2. **Estado 2 — Vista Previa y Anotación de Pin:**
   - Se activa al hacer clic sobre una ficha `file`, `note` o `link`.
   - **Cabecera:** `‹ Corcho` · etiqueta de tipo + título de la ficha · código ámbar de OT (si aplica) · `⤢` (Tablero Completo) · `×` (volver a cuadrícula).
   - **División interna (`1/2` + `1/2`):**
     - **Izquierda (Visor):** previsualización de PDF, imagen, video o editor limpio de nota, con soporte de resaltado/marcador puntual.
     - **Derecha (Apuntes y Despacho):** listado cronológico de notas privadas/resaltados sobre ese pin + input para agregar apunte + botón **`Enviar como mensaje →`** (selector `Destinatario: Miembro del equipo / Cliente`, que publica en el hilo de mensajes de la OT o bandeja interna).
3. **Estado 3 — Visor Contextual Temporal (OT o Gráfico):**
   - **Al seleccionar OT/Tarea en `C01`/`C03`:** muestra `Galería` (izquierda) + `Vista previa` (derecha), incorporando en cada archivo y en la cabecera el botón **`Pin`** para clavarlo en el Corcho sin salir de la vista.
   - **Al seleccionar tarjeta de gráfico en `C02`:** muestra el gráfico ampliado con navegación `‹ / ›`, incorporando el botón **`Pin`** para fijar ese gráfico en el Corcho y `×` para volver al Corcho.

### 4.3. Convenciones Estéticas (Obsidian)
- **Cero pastillas en acciones en línea:** los disparadores `+ Nota`, `+ Enlace`, `+ Archivo` y selectores internos van en texto plano (`text-[#737373] hover:text-[#D4D4D4]`), resaltando únicamente la opción activa cuando sea un conmutador.
- **Exclusividad de puntos de color:** las fichas `note`, `file`, `link`, `chart` y `plugin` usan etiquetas tipográficas monoespaciadas (`PDF`, `NOTA`, `WEB`); **jamás** puntos redondos de color (reservados al semáforo `Urgente / Hoy / Mañana` en fichas de `OT` / `Tarea`).
- **Coexistencia limpia de Drag & Drop:**
  - Manija `⋮⋮` (`data-dk-drag-slot`) intercambia cuadrantes del Tablero.
  - Tarjetas de OT/Tarea (`data-dk-pin-drag`) arrastran referencias hacia `C04`.
  - Fichas internas de `C04` (`data-cork-card-idx`) reordenan su posición dentro del propio Corcho.

---

## 5. Modelo de Datos y Persistencia

Cada ítem fijado en el Corcho sigue una estructura uniforme serializable tanto en `localStorage` (prototipo) como en tabla `corkboard_pins` (producción):

```json
{
  "id": "pin_1795520000_a1b2",
  "organizationId": "org_el_marcante",
  "scope": "personal",
  "ownerUserId": "usr_andres",
  "type": "file",
  "title": "Brief_Campaña_Shambhala_Q4.pdf",
  "otId": "OT-26-004",
  "mediaIndex": 0,
  "url": "",
  "content": "",
  "fileMeta": { "mime": "application/pdf", "sizeLabel": "1.4 MB" },
  "highlights": [
    {
      "id": "hl_01",
      "quote": "Entrega final de piezas master antes del viernes 14:00",
      "note": "Confirmar formatos verticales con Camila",
      "createdAt": "2026-11-24T11:40:00Z"
    }
  ],
  "position": 0,
  "demoPackId": null,
  "createdAt": "2026-11-24T11:35:00Z"
}
```

### Claves particionadas en `localStorage` (prototipo)
- **Corcho Global del Estudio:** `trafigator_cork_v1_<orgKey>_global`
- **Corcho Personal por Usuario:** `trafigator_cork_v1_<orgKey>_user_<userKey>`
- Los pines instalados por un **Pack Demo por Perfil** incluyen `demoPackId` (ej. `'demo-publicidad'`) para borrarse limpia e instantáneamente en 1 clic al desactivar el pack.

---

## 6. Matriz de Permisos (RBAC)

| Rol | Corcho `Global` (`Estudio`) | Corcho `Personal` (`Yo`) | Enviar nota/resaltado como mensaje |
| :--- | :--- | :--- | :--- |
| **`Dueño` (`owner`)** | Lectura, creación, orden y borrado total | Privado total | A cualquier miembro o cliente |
| **`Admin / Tráfico`** | Lectura, creación, orden y borrado total | Privado total | A cualquier miembro o cliente |
| **`Colaborador` (`member`)** | Solo lectura (si tiene alcance global) | Privado total (su espacio principal de trabajo) | A miembros/clientes dentro de sus OTs asignadas |
| **`Cliente` (`client`)** | Sin acceso | Sin acceso (usa su portal / `/review/:token`) | — |
| **`Invitado` (`share_token`)** | Sin acceso | Sin acceso | — |

---

## 7. Arquitectura Modular Implementada de C04

Los prerequisitos técnicos de C04 están **implementados** y el módulo del Tablero de Corcho se organiza en **5 archivos** bajo `src/sketch/` con flujo unidireccional (`desktop.js` → `desktop-corkboard.js` → `{ store, overlays, cards, preview }`):

1. **`desktop-corkboard.js`** *(orquestador visual y capa de eventos locales de C04)*: renderiza la cuadrícula 2/4 columnas (`isFullDesktop`), aplica el control RBAC (`canAccess` / `canEdit` / solo lectura), gestiona el *dropzone* sin parpadeo, el reordenamiento por `data-cork-card-id` (`DND_MIME_CORK_CARD`), los compositores inline (`+ Nota`, `+ Enlace`, `+ Archivo`) y el enlazado de eventos confinado al contenedor (`bindCorkboardEvents`).
2. **`desktop-corkboard-store.js`** *(datos, persistencia y RBAC)*: define las constantes MIME dedicadas (`DND_MIME_SLOT`, `DND_MIME_PIN`, `DND_MIME_CORK_CARD`), el esquema de pines (`createCorkPin`), la persistencia particionada en `localStorage` (`trafigator_cork_v1_<org>_global` / `_user_<user>` y bandeja interna `trafigator_cork_inbox_v1_<org>`) + `IndexedDB` (`trafigator_cork_blobs_v1` para blobs locales), reglas RBAC, utilidades de plan gratuito/plugins y estado efímero de UI de C04.
3. **`desktop-corkboard-cards.js`** *(render puro de fichas)*: renderiza las fichas `file`, `note`, `link`, `ot`/`task`, `chart` (con reconstrucción viva de `filtersSnapshot`), widgets de plugins (`EgoMaker`, `Pack Demo`) y la tarjeta discreta `PATROCINADO` en plan gratuito.
4. **`desktop-corkboard-overlays.js`** *(visores contextuales temporales)*: renderiza sobre C04 la Galería + Vista previa de OT/Tarea seleccionada en C01/C03 y el Gráfico ampliado desde C02 (o desde un gráfico clavado), con botones `Pin` y cierre uniforme con SVG `×`.
5. **`desktop-corkboard-preview.js`** *(Estado 2: Vista Previa 1/2 + 1/2 y despacho)*: renderiza el visor por tipo (`note`, `link`, `file`) junto al panel de resaltados/apuntes privados, e incluye `bindCorkPreviewEvents`, hidratación de blobs desde `IndexedDB`, auto-guardado y despacho de apuntes como mensajes a `ot.messages` o canal interno del Estudio.
6. **Integración en `desktop.js`, `desktop-cards.js` y `desktop-calendar.js`:** aislamiento de Drag & Drop con MIME dedicado (`DND_MIME_SLOT` vs. `DND_MIME_PIN`), atributos de arrastre (`data-dk-pin-type`, `data-dk-pin-ot-id`, `data-dk-pin-task-idx`) en C01/C03 y prioridad de `Escape` para cerrar la Vista Previa de Pin antes de salir de Tablero Completo (`panelLightboxModId`).
