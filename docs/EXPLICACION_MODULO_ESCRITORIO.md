# Explicación Detallada del Módulo **Escritorio**

> **Actualización de arquitectura (2026-11-23):** El diseño anterior de 5 subpantallas (`Resumen | Prioridades | Capacidad y Carga | Flujo y Facturación | Actividad`) fue reemplazado por un **Escritorio unificado** (fila KPI superior + 4 cuadrantes intercambiables por arrastre + Inspector derecho con `Mensajes | Actividad` y mini-calendario fijo) gobernado por el motor y los **Presets por Rol** definidos en [`arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md`](./arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md).

## 0. Presets Predeterminados por Rol (Vigentes)

* **Dueño (`owner` — Ancla inicial: `Estudio`, con conmutador a `Personal`):**
  1. Horizonte de Entregas (`LIVE` sin `Suspendida`).
  2. Pulso de Acuse y Operación (`LIVE`: `Tráfico + Activa`, `En Proceso`, `Suspendida`).
  3. Capacidad y Carga del Estudio (`LIVE`, Nodos Hoja vs. `dailyHours`).
  4. Distribución por Espacio y Cuellos de Botella (`LIVE`: `Perfil` / `Depto`, destacando `Depto: Cliente`).
  5. Ritmo del Estudio y Ciclo de Facturación (`THROUGHPUT`: `Cerrar OT/Facturar → Facturada → Pagada`).
  6. Concentración por Cliente (`LIVE`, Nodos Hoja).
* **Colaborador (`member` — Ancla inicial: `Colaborador = Yo`):**
  1. Mi Horizonte de Entregas (`LIVE`).
  2. Mi Bandeja de Acuse y Ejecución (`LIVE`).
  3. Mi Capacidad Horaria (`LIVE` vs. `dailyHours`).
  4. Mi Distribución por Cliente y Depto (`LIVE`, acotado a su alcance).
  5. Mi Ritmo de Cierre y Cumplimiento (`THROUGHPUT`).
  * *Variante con visibilidad global (`*`) o `Tráfico`:* habilita conmutador a vistas operativas de `Estudio`, manteniendo oculto el tramo financiero salvo permiso explícito del Dueño.
* **Cliente (`client` — Bloqueado en `allowed_client_id`):** Horizonte de entregas de su cuenta, estado de avance de sus OTs y pendientes en su cancha (`Depto: Cliente` y piezas en revisión). Sin otros clientes, sin capacidad interna y sin tramo financiero.
* **Invitado (`share_token`):** Sin acceso a Escritorio ni Estadísticas.

---

> *(A continuación se conserva como referencia histórica el diagnóstico del prototipo previo de 5 subpantallas).*

---

## 1. Navegación en el Menú Izquierdo

### Slide 1 (Menú principal)
Bajo el título de sección no accionable **`ESCRITORIO`** aparecen 5 módulos:
1. **`Resumen >`** — Pantalla panorámica con métricas y gráficos.
2. **`Prioridades >`** — Tablero de 3 columnas de entregas críticas.
3. **`Capacidad y Carga >`** — Detalle de horas de la semana (Lun–Vie) y OTs por persona.
4. **`Flujo y Facturación >`** — Contadores de cierre/cobro y tabla por Cliente.
5. **`Actividad >`** — Lista cronológica de últimos eventos en las OTs.

Al hacer clic en cualquiera de ellos, el ítem se resalta en gris (`bg-obsidian-elevated`), el título superior central cambia al nombre de ese módulo y el menú izquierdo desliza hacia **Slide 2**.

### Slide 2 (Panel contextual `#left-desktop-panel`)
Cuando entras a cualquiera de los 5 módulos, en Slide 2 aparecen 4 bloques:
1. **Botón `< ESCRITORIO`:** Regresa al menú principal (Slide 1) y deja `Resumen` abierto.
2. **Filtro `Alcance`:** Selector desplegable con 2 opciones:
   - `Todo el estudio`: cuenta las OTs de todos los colaboradores del Estudio (dentro del Espacio seleccionado arriba).
   - `Solo mis OTs (Andrés)`: filtra únicamente las OTs donde el usuario activo es responsable.
3. **Tarjeta `Jornada Hoy`:** Muestra `Xh / 8h` (horas reservadas hoy en el **Stripboard** frente a la jornada diaria de 8h), una barra de color (verde = con espacio, ámbar = casi lleno, rojo = sobrecarga) y el botón **`Stripboard →`** que salta directo a `Mis Tareas → Día` en la fecha de hoy.
4. **Lista `Vistas`:** Atajo para cambiar entre `Resumen`, `Prioridades`, `Capacidad y Carga`, `Flujo y Facturación` y `Actividad` sin tener que volver a Slide 1.

---

## 2. Cabecera Común (Parte superior del panel central)

Todas las pantallas de Escritorio comparten una misma barra horizontal debajo del título superior:
- **Izquierda:**
  - **Pastilla del Espacio actual** (`Estudio`, `Publicidad`, `Web` o `Software`) en su color. Indica sobre qué Espacio se están calculando todos los números de la pantalla.
  - **Texto de alcance** (`Vista completa` o `Mis OTs (Andrés)`).
- **Derecha:**
  - **Switch `Todo | Mío`:** Hace exactamente lo mismo que el desplegable `Alcance` de Slide 2.
  - **Botón `+ Nueva OT` (ámbar):** Salta directo al formulario de crear una OT.
  - **Botón `Tráfico →`:** Salta directo a la tabla de Tráfico.

---

## 3. Pantalla 1: **`Resumen`**

Está dividida en **3 filas** pensadas como lectura de arriba hacia abajo: *números rápidos → gráficos principales → desgloses y alertas*.

### Fila 1 — 5 Tarjetas KPI (todas clicables)
1. **`OTs Activas`**
   - **Qué muestra:** Total de OTs no archivadas del Espacio/Alcance actual. Debajo dice cuántas están en estado `Suspendida` (o `"Todas en marcha"` si hay 0).
   - **Para qué sirve:** Saber el volumen total de trabajo vivo.
   - **Al hacer clic:** Abre `Tráfico` sin filtros.
2. **`Urgentes / Vencidas`**
   - **Qué muestra:** Cantidad de OTs marcadas como `Urgente` **o** cuya fecha de entrega es anterior a hoy (`< hoy`). Debajo muestra cuántas vencen hoy y cuántas mañana.
   - **Para qué sirve:** Medir cuántos incendios reales hay ahora mismo.
   - **Al hacer clic:** Abre la pantalla **`Prioridades`**.
3. **`En Cliente / Rev.`**
   - **Qué muestra:** Cantidad de OTs cuyo departamento actual es `Cliente` **o** que tienen al menos una pieza en Galería con estado `En Revisión`.
   - **Para qué sirve:** Saber cuántas OTs están detenidas esperando respuesta o aprobación del cliente.
   - **Al hacer clic:** Abre `Tráfico` filtrado por `Depto: Cliente`.
4. **`Por Facturar`**
   - **Qué muestra:** Cantidad de OTs que están en etapa `Cerrar OT y Facturar`, en etapa `Facturada`, o en el departamento `Facturación`.
   - **Para qué sirve:** Ver trabajo terminado o en cierre pendiente de facturación/cobro.
   - **Al hacer clic:** Abre la pantalla **`Flujo y Facturación`**.
5. **`Mi Jornada Hoy`**
   - **Qué muestra:** Horas totales reservadas hoy en el Stripboard (`Xh / 8h`). Siempre suma tus horas reales de **todos** los Espacios (para no ocultar sobrecargas). Si estás dentro de un Espacio (ej. `Web`), abajo te desglosa `Nh Web + Mh otros`.
   - **Para qué sirve:** Saber de un vistazo si hoy estás libre, justo o sobrecargado.
   - **Al hacer clic:** Abre `Mis Tareas → Día` en la fecha de hoy.

### Fila 2 — 2 Gráficos Principales
1. **`Capacidad Semanal (Stripboard)` (izquierda)**
   - **Qué muestra:** 5 barras verticales correspondientes a **Lunes a Viernes** de la semana actual, con las horas programadas de cada día en el Stripboard y una **línea punteada horizontal** en tu límite diario (`8h`).
   - **Colores:** Azul = cómodo (`< 80%`), Ámbar = al límite (`80%–100%`), Rojo = sobrecargado (`> 8h`).
   - **Al hacer clic en cualquier día:** Abre ese día exacto en `Mis Tareas → Día`.
   - **Enlace `Ver Capacidad →`:** Abre la pantalla **`Capacidad y Carga`**.
2. **`Embudo de Flujo (Etapas)` (derecha)**
   - **Qué muestra:** Una barra horizontal por cada una de las 5 etapas del ciclo (`Tráfico`, `Recibida`, `Cerrar OT y Facturar`, `Facturada`, `Pagada`), indicando cuántas OTs están en cada una y su porcentaje del total.
   - **Para qué sirve:** Ver en qué etapa se acumulan las OTs (por ejemplo, muchas en `Tráfico` sin recibir, o muchas en `Cerrar OT y Facturar` sin cobrar).
   - **Al hacer clic en una etapa:** Abre `Tráfico` filtrado por esa etapa.

### Fila 3 — 3 Tarjetas de Desglose
1. **`Distribución por Espacio` / `Áreas en [Espacio]` (Dona SVG)**
   - **Qué muestra:** Un gráfico circular (dona) con el total de OTs en el centro.
     - Si estás en **`Estudio`**: reparte el círculo entre `Publicidad`, `Web` y `Software`. Al hacer clic en uno de la leyenda, cambia la barra superior a ese Espacio.
     - Si estás dentro de un **Espacio** (ej. `Web`): reparte el círculo entre los departamentos de `Web` (`UX/UI`, `Maquetación`, `Contenido`, etc.). Al hacer clic en uno, abre `Tráfico` filtrado por ese departamento.
2. **`Carga por Cliente`**
   - **Qué muestra:** Los 4 clientes con más OTs activas, una barra proporcional y cuántas de sus OTs están marcadas urgentes (`!`).
   - **Para qué sirve:** Ver qué cliente te está consumiendo más capacidad del estudio.
   - **Al hacer clic en un cliente:** Abre `Tráfico` filtrado por ese cliente.
3. **`Alertas Activas`**
   - **Qué muestra:** Lista automática (máx. 4 ítems) con avisos accionables: días sobrecargados esta semana (`Reprogramar`), OTs vencidas (`Revisar`), OTs prioritarias (`Abrir`) y OTs esperando aprobación de Cliente (`Ver`).
   - **Para qué sirve:** Resumen de acciones urgentes en forma de lista rápida.

---

## 4. Pantalla 2: **`Prioridades`**

Es la vista de 3 columnas que existía originalmente en el Escritorio, ampliada para incluir vencidas:
- **Columna 1 — `Vencidas y Urgentes` (punto rojo):** Todas las OTs con fecha `< hoy` (con etiqueta `Vencida`) o marcadas como `Urgente`.
- **Columna 2 — `Vencen hoy` (punto ámbar):** OTs con entrega hoy que no están ya en la Columna 1.
- **Columna 3 — `Vencen mañana` (punto cian):** OTs con entrega mañana que no están en las columnas anteriores.

**Interacción:**
- **1 clic en una tarjeta:** la resalta en ámbar y abre el **Inspector derecho** (`Detalle | Actividad | Mensajes`).
- **Doble clic (o clic en el código `26-001`):** abre la OT completa.

---

## 5. Pantalla 3: **`Capacidad y Carga`**

Compuesta por 3 bloques:
1. **Franja superior (5 tarjetas `Lun` a `Vie`):** Muestra `Xh / 8h` y una barra de progreso por día. Al hacer clic en cualquier día, selecciona ese día abajo.
2. **Lista `Tareas programadas (fecha)` (izquierda):** Lista todas las tareas del Stripboard programadas para el día seleccionado arriba, con código, Espacio, título y horas estimadas (`3h`). 1 clic inspecciona, doble clic abre la OT, y el enlace `Abrir día en Stripboard →` salta a `Mis Tareas → Día`.
3. **Tarjeta `Carga por Responsable` (derecha):** Barras horizontales con el número de OTs asignadas a cada persona (`Andrés`, `Camila`, `Mateo`, `Sofía`).

---

## 6. Pantalla 4: **`Flujo y Facturación`**

Compuesta por 2 bloques:
1. **4 contadores superiores:** `En Cliente / Rev.`, `Cerrar y Facturar`, `Facturadas`, `Pagadas`.
2. **Tabla `Consolidado por Cliente`:** Una fila por cada cliente activo con:
   - `Cliente`
   - `OTs Activas`
   - `Urgentes`
   - `En Revisión`
   - `Por Facturar`
   - `Horas Est.` *(suma de las horas estimadas de todas las subtareas de las OTs de ese cliente)*
   - Al hacer clic en cualquier fila, abre `Tráfico` filtrado por ese cliente.

---

## 7. Pantalla 5: **`Actividad`**

- **Qué muestra:** Un feed cronológico con los últimos 25 registros de `activityLog` de todas las OTs activas del Espacio actual (código OT, Espacio, actor, acción y fecha/hora).
- **Interacción:** 1 clic abre el Inspector derecho de esa OT; doble clic abre la OT.

---

## 8. Diagnóstico Honesto: Dónde Hay Redundancias o Falta de Lógica Hoy

Si sentiste que la presentación actual no es intuitiva ni lógica en varias partes, hay **5 razones reales** visibles al mirarla con ojo crítico:

1. **Controles duplicados entre el panel izquierdo (Slide 2) y el panel central:**
   - El selector `Todo | Mío` aparece **dos veces** a la vez (en Slide 2 como desplegable `Alcance` y arriba a la derecha del centro como botones `Todo | Mío`).
   - `Jornada Hoy (Xh / 8h)` aparece **dos veces** a la vez en `Resumen` (en la tarjeta del Slide 2 y en la 5.ª tarjeta KPI del centro).
   - La lista `Vistas` de Slide 2 repite exactamente los mismos 5 ítems que estaban en Slide 1.
2. **`Embudo de Flujo (Etapas)` hoy se ve desbalanceado con los datos demo:**
   - Porque casi todas las 25 OTs de prueba tienen `stage = 'Tráfico'` por defecto, el embudo muestra `100% en Tráfico` y `0%` en las otras 4 etapas (`Recibida`, `Cerrar OT y Facturar`, `Facturada`, `Pagada`), haciendo que el gráfico parezca vacío o inútil.
3. **`En Cliente / Rev.` mezcla dos criterios y confunde los números:**
   - Como `ensureOtData()` crea piezas demo con `status: 'En Revisión'` en casi todas las OTs, el contador `En Cliente / Rev.` marca casi las 25 OTs, pero al hacer clic te lleva a `Tráfico` filtrado solo por `Depto: Cliente` (donde solo hay 3 OTs). El número que ves en el KPI no coincide con lo que ves al hacer clic.
4. **Fragmentación artificial en 5 pantallas cuando muchas se pisan:**
   - `Resumen` ya tiene capacidad semanal, embudo, clientes y alertas. Luego `Capacidad y Carga` repite la semana de Lun–Vie que ya existe en el Stripboard (`Mis Tareas → Semana`), y `Flujo y Facturación` repite el conteo de clientes que ya está en `Resumen`.
5. **En un estudio unipersonal (1 persona), `Carga por Responsable` y el toggle `Todo | Mío` sobran** si solo hay un usuario activo — tienen sentido solo cuando el estudio tiene 2+ miembros con OTs asignadas.
