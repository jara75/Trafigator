# Arquitectura y Diseño del Módulo **Escritorio** — Trafigator

> **Estado vigente (rama `ui/escritorio-estadistica`):** Escritorio unificado de **4 cuadrantes intercambiables por arrastre**, alcance **`Global | Personal`** por rol, **Caja de Luz** para todos los paneles, **Estadística** con Vistas Rápidas + Masonry + Filtros jerárquicos + puente directo al **Inspector derecho** (`Mensajes | Actividad | Lista` + mini-calendario).
>
> Motor lógico subyacente: [`arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md`](./arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md).

---

## 1. Estructura del Escritorio (`Global | Personal` y 4 Cuadrantes)

### 1.1. Conmutador `Global | Personal` (por Rol)
- **`Dueño` / `Admin-Tráfico` / `Cuentas`:** alternan entre **Escritorio Global (`Estudio`)** y **Escritorio Personal (`Yo`)**, persistiendo su orden de cuadrantes por separado en `localStorage`.
- **`Colaborador` (`member` sin visibilidad global):** opera directamente en **Escritorio Personal** (sin `Finalizadas`, sin `Responsable`, default en `Tareas`).
- **`Cliente` (`client`):** bloqueado en su cuenta (`allowed_client_id`), sin capacidad interna ni tramo financiero.
- **`Invitado` (`share_token`):** sin acceso a Escritorio ni Estadísticas.

### 1.2. Los 4 Cuadrantes (Drag & Drop + Caja de Luz `⤢`)
Todos los cuadrantes son intercambiables mediante su manija (`⋮⋮`), llevan línea superior de acento (`border-t-2`) y botón expandir (**`⤢`**) para abrirse en **Caja de Luz** (`max-w-[1440px]`, `90vh`) con barra de **Perfiles** (`Estudio | Publicidad | Web | Software`) sincronizada en vivo y cierre con `Esc`:

| Cuadrante | Módulo | Línea de acento | Rol operativo |
| :--- | :--- | :--- | :--- |
| **C01** | **Prioridades** | Rojo / Ámbar / Celeste | 3 columnas (`Urgentes`, `Para Hoy`, `Para Mañana`) con switch `OTs \| Tareas` independiente por columna. |
| **C02** | **Estadística** | Violeta | Panel completo de análisis: cabecera con controles arriba, **Vistas Rápidas** en 2 filas, gráficos **Masonry** (izquierda `4/5`) y **Filtros jerárquicos** (derecha `1/5`). |
| **C03** | **Calendario / Galería** | Esmeralda (Ámbar en Galería) | Vista `Semana` (`Esta Semana` con `(Hoy)` marcado + `Semana Próxima` navegable) y `Mes` (`24 (Hoy)`), o `Galería + Vista previa` contextual al seleccionar una OT. |
| **C04** | **Tablero de Corcho (`140px`)** | Cian | **En `Global` y `Personal`:** tu tablero de pines (archivos/PDF Brief de OT, notas, enlaces web con Vista Previa, resaltado/comentarios y envío como mensaje), widgets de **Plugins** y espacio reservado para **publicidad en la versión gratis**. |

---

## 2. Módulo **Estadística** — Historia de Usuario (4 Niveles)

El flujo de consulta progresa de lo general a lo particular sin salir del Escritorio:

1. **Pulso en 1 vistazo (`Vistas Rápidas`):** 2 filas de anillos KPI en la parte superior de Estadística.
   - **En `Global` (8 Vistas Rápidas):**
     - Fila 1: `OTs Activas` · `OTs Urgentes` · `Tareas Activas` · `Tareas Urgentes`
     - Fila 2: `En Cliente` · `Finalizadas` *(solo roles financieros)* · **`Tareas Libres`** (`Estudio` + `Cliente`) · **`Separadores`** (pausas/agenda)
   - **En `Personal` (7 Vistas Rápidas):**
     - Fila 1: `Mis OTs` · `OTs Urgentes` · `Mis Tareas` · `Tareas Urgentes`
     - Fila 2: `En Cliente` · **`Mi Jornada Hoy`** · **`Mañana`**
2. **Radiografía completa (Clic en una `Vista Rápida`):**
   - Despliega el tablero **Masonry de 2 columnas con scroll vertical** (4 columnas en Caja de Luz completa), mostrando todos los gráficos relevantes a ese corte:
     - **Operación viva (`OTs` / `Tareas` / `En Cliente` / `Hoy` / `Mañana`):** `01 Por Cliente`, `02 Por Perfil`, `03 Por Depto` *(paginado por Perfil en modo Estudio para no mezclar talleres)*, `04 Por Responsable` *(horas vs. Meta)*, `05 Por Etapa`, `06 Por Prioridad` *(o `Tipo Urgencia`)*, `07 Horizonte Entregas`, `08 Evolución Ingreso`.
     - **`Finalizadas`:** 4 gráficos propios de cierre y cobro (`Por Cliente`, `Por Perfil`, `Por Etapa` y `Evolución`).
     - **`Tareas Libres`:** 5 gráficos (`Estudio vs. Cliente`, `Por Cliente`, `Por Responsable`, `Horizonte`, `Evolución`).
     - **`Separadores`:** 4 gráficos (`Por Tipo de Pausa`, `Por Responsable`, `Horizonte`, `Evolución`).
   - En la cabecera del panel: conmutador de unidad **`OTs | Horas`** (o **`Tareas | Horas`**; oculto en `Hoy / Mañana` que solo miden horas).
3. **Recorte fino (`Filtros` a la derecha, `1/5`):**
   - Orden fijo: **`Tiempo` → `Estudio / Perfil` → `Cliente` → `Depto` → `Responsable` → `Etapa` → `Estado`**.
   - **Principio de Jerarquía estricta (un filtro hijo nunca sobrescribe ni contradice a su padre):**
     - **`Tiempo`:** `Todas las fechas`, `Ayer / Hoy / Mañana`, `Hoy`, `Mañana`, `Sem. ant. / Esta / Próx.`, `Esta semana`, `Próxima semana`. Se bloquea en `Hoy` / `Mañana` cuando la Vista Rápida ya fija ese día.
     - **`Estudio / Perfil`:** si la barra superior global (`#workspace-bar`) ya fijó un Perfil, queda bloqueado en ese Perfil.
     - **`Depto`:** en modo **`Estudio`** (2+ perfiles activos) permanece en `Todos` (deshabilitado); se habilita con el orden operativo exacto del Perfil una vez elegido un Perfil.
     - **`Etapa` y `Estado`:** restringidos al universo de la Vista Rápida activa (`Tareas` solo muestra `Tráfico` / `Recibida`; `Finalizadas` solo etapas de cobro; vistas vivas nunca muestran `Archivada` ni `Cancelada`).
     - **`Cliente` y `Responsable`:** transversales a todo el Estudio (`Responsable` se oculta en modo `Personal` / Colaborador).
4. **Zoom y desglose (`Caja de Luz` e `Inspector`):**
   - **Clic en tarjeta / `⤢`:** abre el gráfico individual en **Caja de Luz** ampliada con navegación `‹ Ant. | Sig. ›` (`←`/`→`, `Esc`) o el panel entero con barra de Perfiles.
   - **Clic en barra, segmento o columna:** carga en el **Inspector derecho** la 3.ª pestaña **`Lista`** (conservando siempre visibles `Mensajes` y `Actividad`) con las OTs, Tareas, Tareas Libres o Separadores exactos de ese segmento. Desde ahí 1 clic abre el **Detalle de OT** y doble clic abre el editor.

---

## 3. Taxonomía de **Tareas Libres** y **Separadores**

| Entidad | Propósito | Suma a jornada | Subtipos / Ejemplos |
| :--- | :--- | :--- | :--- |
| **Tarea Libre** | Trabajo productivo fuera de OT | **Sí** | **`Estudio`** (interno, ej. *Capacitación Trafigator*, *Reunión interna*) · **`Cliente`** (imputada a un cliente del directorio sin abrir OT, ej. *Reunión con Shambhala*). |
| **Separador** | Pausa o bloque personal de agenda | Tiempo de agenda (no producción OT) | *15 minutos de descanso*, *Almorzar*, *Pasear a los perros*. |

---

## 4. Diseño Objetivo de **Cuadrante 04 — Tablero de Corcho (`140px`)**

Tanto en **Global** como en **Personal**, C04 funciona como el **Tablero de Corcho** del Escritorio:

- **Pines (archivos, notas y enlaces):** permite fijar archivos (ej. el **PDF del Brief** de una OT), notas rápidas y enlaces web (compartidos del Estudio en `Global`; privados en `Personal`).
- **Doble zoom en Caja de Luz:** ver todo el Tablero de Corcho a pantalla completa (`⤢`), o abrir un pin (PDF/imagen/video/nota) en **Vista Previa** con **resaltado y comentarios** (reutilizando el motor de Revisión Colaborativa), con opción de compartir cualquier resaltado o comentario como **mensaje directo** a otro miembro del equipo o al cliente.
- **Widgets de Plugins:** dock natural para extensiones instaladas del ecosistema ([`ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md`](./ARQUITECTURA_PLUGINS_Y_ECOSISTEMA.md)) y alertas operativas.
- **Monetización en versión gratis:** espacio limpio y no invasivo para mostrar **publicidad** en la versión gratuita (sin tocar ni ensuciar Prioridades, Calendario ni Estadística), que se libera por completo en planes pagos.
