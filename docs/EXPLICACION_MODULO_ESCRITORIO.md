# Arquitectura y Diseño del Módulo **Tablero** — Trafigator

> **Estado vigente (rama `ui/escritorio-estadistica`):** Tablero unificado sobre fondo mate con grano sutil y emblema animado en hover (`#pane-left`), **4 cuadrantes de igual altura (`50% / 50%`) intercambiables por arrastre**, colapsado vertical simétrico en ambas columnas (`01/03` y `02/04`), expansión de cualquier cuadrante a **Tablero Completo (`⤢`)** sin perder laterales ni Inspector, alcance **`Global | Personal`** por rol y **Estadística** conectada al **Inspector derecho** (`Mensajes | Actividad | Lista`).
>
> **Documentos complementarios:**
> - Motor estadístico: [`arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md`](./arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md)
> - Especificación de `C04`: [`DEFINICION_TABLERO_DE_CORCHO.md`](../Plugins/Tablero%20de%20Corcho/DEFINICION_TABLERO_DE_CORCHO.md)
> - Ecosistema y Packs Demo: [`ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md`](../Plugins/ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md)

---

## 1. Estructura General de las 3 Columnas y los 4 Cuadrantes

### 1.1. Columnas Laterales Persistentes e Identidad Visual
- **Fondo global:** degradado radial carbón mate (`#242523 → #151516 → #0b0b0c`) con textura de grano fino SVG continuo en las 3 columnas.
- **Columna izquierda (`#pane-left`):** emblema cuadrado `1:1` de **Trafigator** en el tope (estático en reposo para cero distracción visual, animado en `hover`), con botón superpuesto `panel-left-close/open` (`w-3.5 h-3.5`, simétrico al `panel-right-close/open` derecho) y navegación en 2 slides.
- **Columna derecha (`#pane-right` — Inspector):** siempre visible en toda la app:
  - **Cabecera:** avatar/menú de usuario, campana de notificaciones (`#btn-work-notifications`), mensajes, reloj de jornada y botón de colapsar (`panel-right-close`).
  - **Cuerpo dinámico:** pestañas fijas **`Mensajes`**, **`Actividad`** y **`Lista`** (cuando se inspecciona un segmento de Estadística), o **Detalle de OT** al seleccionar una OT; además es el lugar natural para **Recordatorios / Alarmas** transversales (estilo Apple Recordatorios: check + 1 línea + aviso en `5m / 15m / 1h / hora`), separados del Tablero de Corcho para que sigan vivos fuera del Tablero.
  - **Pie fijo:** mini-calendario mensual sincronizado.

### 1.2. Conmutador `Global | Personal` (por Rol)
- **`Dueño` / `Admin-Tráfico` / `Cuentas`:** alternan entre **Tablero Global (`Estudio`)** y **Tablero Personal (`Yo`)**, persistiendo el orden de cuadrantes por separado en `localStorage`.
- **`Colaborador` (`member` sin visibilidad global):** entra directo en **Tablero Personal** (sin `Finalizadas`, sin filtro `Responsable`, default en `Tareas`).
- **`Cliente` (`client`):** acotado a su cuenta (`allowed_client_id`), sin capacidad interna ni tramo financiero.
- **`Invitado` (`share_token`):** sin acceso a Tablero ni Estadísticas.

### 1.3. Los 4 Cuadrantes (`50% / 50%` · Drag & Drop · Colapsar · Tablero Completo `⤢`)
Los 4 cuadrantes comparten altura simétrica (`grid-rows-2` en ambas mitades), manija de arrastre (`⋮⋮`), línea superior de acento (`border-t-2`), botón de colapsar verticalmente (`▴`/`▾` tanto en `01/03` como en `02/04`) y botón **`⤢` (Tablero Completo)**, que expande ese cuadrante al **100% del área central** sin tapar la barra izquierda, la barra superior de Perfiles ni el Inspector derecho (restaurable con `↙↗` o `Esc`):

| Cuadrante | Módulo | Línea de acento | Rol operativo |
| :--- | :--- | :--- | :--- |
| **C01** | **Prioridades** | Rojo / Ámbar / Celeste | 3 columnas (`Urgentes`, `Para Hoy`, `Para Mañana`) con switch `OTs \| Tareas` independiente por columna. |
| **C02** | **Estadística** | Violeta | Cabecera superior con controles del panel, **Vistas Rápidas** en 2 filas (1 fila en Tablero Completo), gráficos **Masonry** a la izquierda (`4/5`) y **Filtros jerárquicos** a la derecha (`1/5`). |
| **C03** | **Calendario** | Esmeralda | Dedicado permanentemente a `Semana` (`Esta Semana` con `(Hoy)` marcado + `Semana Próxima` navegable) y `Mes` (`24 (Hoy)`), sin ser reemplazado al seleccionar una OT. |
| **C04** | **Tablero de Corcho** | Cian (Ámbar en Galería / Violeta en Gráfico) | Mesa de fichas estilo Scrivener (`Global` y `Personal`) para pines de archivos/Briefs PDF, notas, enlaces, plugins y publicidad en plan gratis; actúa además como **visor contextual temporal** para la **Galería + Vista previa** (al tocar una OT en `C01`/`C03`) y para el **Gráfico ampliado** (al tocar una tarjeta en `C02`). Ver [`DEFINICION_TABLERO_DE_CORCHO.md`](../Plugins/Tablero%20de%20Corcho/DEFINICION_TABLERO_DE_CORCHO.md). |

---

## 2. Módulo **Estadística** — Historia de Usuario (4 Niveles)

1. **Pulso en 1 vistazo (`Vistas Rápidas`):** anillos KPI compactos sobre el área de gráficos.
   - **En `Global` (8 Vistas Rápidas):**
     - Fila 1: `OTs Activas` · `OTs Urgentes` · `Tareas Activas` · `Tareas Urgentes`
     - Fila 2: `En Cliente` · `Finalizadas` *(solo roles financieros)* · **`Tareas Libres`** (`Estudio` + `Cliente`) · **`Separadores`** (pausas/agenda)
   - **En `Personal` (7 Vistas Rápidas):**
     - Fila 1: `Mis OTs` · `OTs Urgentes` · `Mis Tareas` · `Tareas Urgentes`
     - Fila 2: `En Cliente` · **`Mi Jornada Hoy`** · **`Mañana`**
2. **Radiografía completa (Clic en una `Vista Rápida`):**
   - Despliega el tablero **Masonry de 2 columnas con scroll vertical** (4 columnas al expandir Estadística a **Tablero Completo**):
     - **Operación viva (`OTs` / `Tareas` / `En Cliente` / `Hoy` / `Mañana`):** `01 Por Cliente`, `02 Por Perfil`, `03 Por Depto` *(con barras delgadas estilo mix y paginador local por Perfil en modo `Estudio` para no mezclar departamentos)*, `04 Por Responsable` *(horas vs. Meta)*, `05 Por Etapa`, `06 Por Prioridad` *(o `Tipo Urgencia`)*, `07 Horizonte Entregas`, `08 Evolución Ingreso`.
     - **`Finalizadas`:** 4 gráficos exclusivos de cierre y cobro (`Por Cliente`, `Por Perfil`, `Por Etapa` y `Evolución`).
     - **`Tareas Libres`:** 5 gráficos (`Estudio vs. Cliente`, `Por Cliente`, `Por Responsable`, `Horizonte`, `Evolución`).
     - **`Separadores`:** 4 gráficos (`Por Tipo de Pausa`, `Por Responsable`, `Horizonte`, `Evolución`).
   - En la cabecera superior del panel: conmutador **`OTs | Horas`** (o **`Tareas | Horas`**; oculto en `Hoy / Mañana`).
3. **Recorte ergonómico (`Filtros` a la derecha, `1/5`, alineados con la 1.ª fila de gráficos):**
   - Orden fijo: **`Tiempo` → `Estudio / Perfil` → `Cliente` → `Depto` → `Responsable` → `Etapa` → `Estado`**.
   - **Principio de Jerarquía estricta (un filtro hijo jamás contradice ni sobrescribe a su padre):**
     - **`Tiempo`:** `Todas las fechas`, `Ayer / Hoy / Mañana`, `Hoy`, `Mañana`, `Sem. ant. / Esta / Próx.`, `Esta semana`, `Próxima semana` (bloqueado cuando la Vista Rápida ya fija `Hoy` o `Mañana`).
     - **`Estudio / Perfil`:** bloqueado si la barra superior global (`#workspace-bar`) ya fijó un Perfil.
     - **`Depto`:** deshabilitado (`Todos`) mientras se está en `Estudio` con 2+ perfiles; habilitado en el orden operativo exacto del Perfil al elegir uno.
     - **`Etapa` y `Estado`:** acotados a la entidad y condición de la Vista Rápida activa.
4. **Inspección contextual sin modales (`C04` + `Inspector`):**
   - **Clic en el encabezado o cuerpo libre de un gráfico:** abre ese gráfico ampliado sobre **`C04`** (con navegación `‹ / ›` y `×` / `Esc` para volver al Tablero de Corcho).
   - **Clic en una barra, fila de leyenda o columna:** activa la pestaña **`Lista`** en el **Inspector derecho** (conservando visibles `Mensajes` y `Actividad`) con las OTs, Tareas, Tareas Libres o Separadores exactos de ese segmento.

---

## 3. Taxonomía de **Tareas Libres**, **Separadores**, **Módulo Financiero Base** y **Packs Demo**

### 3.1. Tiempo Fuera de OT (`Stripboard` ↔ `Estadística`)
| Entidad | Propósito | Suma a jornada | Subtipos / Ejemplos |
| :--- | :--- | :--- | :--- |
| **Tarea Libre** | Trabajo productivo fuera de OT (captura de 1 clic) | **Sí** | **`Estudio`** (interno, ej. *Capacitación Trafigator*, *Reunión interna*) · **`Cliente`** (imputada a un cliente del directorio sin abrir OT, ej. *Reunión con Shambhala*). |
| **Separador** | Pausa o bloque personal de agenda (preset de 1 clic) | Tiempo de agenda | *15 minutos de descanso*, *Almorzar*, *Pasear a los perros*. |

### 3.2. Alcance Cerrado del Tramo Financiero en el Núcleo
Para cerrar el ciclo `Cerrar OT y Facturar → Facturada → Pagada` sin convertir Trafigator en un ERP contable, el núcleo contempla únicamente **5 campos financieros por OT** (visibles solo para `Dueño` y `Facturación`):
1. **Precio de la OT**
2. **Número de factura**
3. **Fecha de factura**
4. **Valor pagado**
5. **Fecha de pago**

Cualquier extensión contable, tributaria o de facturación electrónica adicional pertenece estrictamente al **Ecosistema de Plugins**.

### 3.3. Estrategia contra el *Horror Vacui* — **Packs Demo por Perfil (Plugins)**
Cada Perfil operativo (`Publicidad`, `Branding`, `Web`, `Software`, `Productora`, `Arquitectura`, `Diseño Industrial`) dispone de un **Pack Demo instalable y desinstalable en 1 clic** (etiquetado con `demoPackId`) que pobla clientes, OTs en todas las etapas/estados, Tareas, Tareas Libres, Separadores y pines de ejemplo en el Tablero de Corcho sin mezclarse jamás con los registros reales del estudio.
