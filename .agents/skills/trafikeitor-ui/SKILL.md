---
name: trafikeitor-ui
description: Sistema de diseño Obsidian, arquitectura de 3 columnas, convenciones visuales y reglas de dominio de Trafikeitor extraídas de sketch-ot.html y src/sketch/. Usar siempre que se creen, modifiquen o migren vistas, componentes o modales de la interfaz de Trafikeitor.
---

# Trafikeitor UI — Frontend Design Skill (Obsidian)

Esta skill define la estética, estructura y reglas no negociables de la interfaz de **Trafikeitor**, basadas en la referencia validada en `sketch-ot.html` y `src/sketch/`.

## 1. Reglas No Negociables

1. **Idioma y fidelidad:** Toda la UI va en **español**. Al migrar o refactorizar vistas desde `sketch-ot.html` / `src/sketch/`, **no cambiar** textos, etiquetas, columnas, orden de menús ni flujos validados sin aprobación explícita.
2. **Terminología de dominio:**
   - Usar **Detalle de OT / Tarea** (`ot-detail.js`) — **nunca** usar *"Sobre abierto"* en código nuevo ni en textos de interfaz.
   - **Campanita inferior:** exclusiva para notificaciones de **suscripción**, no para notificaciones operativas del estudio.
   - **Membresía y Facturación:** dentro de la app solo muestra resumen (plan actual, días de prueba, puestos usados) y redirige al sitio web externo (`trafikeitor.com/planes`) para comprar o cambiar de plan.
3. **Íconos y Tooltips:**
   - Usar siempre `<span data-icon="..." data-icon-size="w-3 h-3"></span>` e hidratar con `hydrateIcons(container)` de `/src/client/icons.js`.
   - Para tooltips compactos usar el atributo `data-tip="..."` (y `data-tip-pos="right"` si va hacia la derecha), estilizado en `src/sketch/sketch.css`.

---

## 2. Tokens Visuales (Obsidian)

### Paleta de colores
- **Fondo base / paneles / cabeceras (`obsidian.bg`, `panel`, `header`):** `#191919`
- **Superficies secundarias (tarjetas, tablas):** `#202020` / `#222222` (inputs)
- **Superficie elevada / hover (`obsidian.elevated`):** `#2A2A2A` (`#323232` hover de botones secundarios)
- **Bordes (`obsidian.border` / `borderActive`):** `#2b2b2b` / `#3a3a3a` (`#3f3f3f` en focus)
- **Texto principal (`obsidian.text`):** `#D4D4D4`
- **Texto secundario / muted (`obsidian.textSecondary`):** `#8C8C8C` (`#5a6169` placeholders)
- **Acento primario (`obsidian.amber`):** `#f59e0b` (hover `amber-400`, texto sobre ámbar `#191919`, fondos suaves `bg-amber-500/15` / `bg-amber-500/20`)
- **Acento resizers / foco (`obsidian.cyan`):** `#38bdf8`
- **Estados semánticos:**
  - Éxito / Entregado / Gratis: `emerald-400` / `bg-emerald-500/15 text-emerald-300`
  - Sobrecarga / Urgente / Peligro: `rose-400` / `rose-300` (`bg-rose-500/10 border-rose-500/40`)

### Tipografía y Escala Densa
- **UI:** `Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif`
- **Códigos, fechas, horas y contadores:** `"JetBrains Mono", "SF Mono", ui-monospace, monospace` (`font-mono`)
- **Densidad compacta de estudio:**
  - Etiquetas de sección: `text-[9.5px]` o `text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C]`
  - Filas de menú y tablas: `text-[10.5px]` a `text-[11.5px]`
  - Títulos de vista y modales: `text-[13px]` a `text-[15px] font-medium`

---

## 3. Arquitectura de 3 Columnas (`sketch-ot.html`)

1. **Columna Izquierda (`#pane-left`, ancho inicial `260px`, colapsable):**
   - Cabecera `h-10` con toggle de menú (`#btn-desktop-menu`) y botón de colapso.
   - Carril deslizable `#left-menu-track` (`-translate-x-1/2`):
     - Panel raíz (`ESCRITORIO`) y subpanel (`#left-sub-panel`) con menú operativo (`Nueva OT`, `Tráfico`, `Mis OTs`, `Mis Tareas`, `ARCHIVO`: `OTs Archivadas`, `Todas las Tareas`, `Galería`, `Documentos`, `Desarrollo`).
     - Árboles contextuales: `#left-traffic-tree` (Clientes/Marcas) y `#left-envelope-tree` (lista de sub-tareas de la OT).
   - **Pie izquierdo:** íconos `Notificaciones` (suscripción), `Ajustes` (`#btn-settings-menu` Piñón) y `Buscar` (Lupa), más fila de estudio (`#btn-studio-footer` `EM · El Marcante` y `#btn-trial-badge` `14 días`).
2. **Resizer (`#resizer-left` / `#resizer-right`):** línea de `1px` (`bg-obsidian-border hover:bg-obsidian-cyan cursor-col-resize`).
3. **Columna Central (`#pane-center`, `flex-1 min-w-0`):**
   - Cabecera `h-10 px-4` con `#center-page-title` y acciones rápidas a la derecha.
   - `#center-body` alberga vistas mutuamente excluyentes (`hidden` toggle): `#view-new-ot`, `#view-traffic`, `#view-my-ots`, `#view-gallery`, `#view-stripboard`.
4. **Columna Derecha (`#pane-right`, `220px`):**
   - Cabecera `h-10 px-3` con `INSPECTOR` y `#right-body` para controles contextuales de la tarea seleccionada (horas dedicadas, día programado, capacidad diaria `Xh / jornada`).

---

## 4. Patrones de Componentes

- **Botón primario:** `px-3.5 py-1 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] font-semibold transition-colors cursor-pointer`
- **Botón secundario:** `px-3 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[#8C8C8C] hover:text-[#D4D4D4] transition-colors cursor-pointer` (o `bg-[#191919] border border-obsidian-border text-[#D4D4D4]`)
- **Selectores / Switches / Pestañas inline (sin pastillas):** Texto limpio sin borde ni caja individual ni contenedor con borde (`text-[#737373] hover:text-[#D4D4D4]`); solo la opción seleccionada se resalta (`bg-obsidian-elevated text-[#D4D4D4] font-semibold`). Nunca envolver cada opción en bordes o pastillitas.
- **Puntos de color (semáforo exclusivo):** **Solo el semáforo de Prioridades** (Urgente / Hoy / Mañana) lleva punto de color (`rounded-full`). En perfiles/espacios de la barra superior y otros ítems con contador, **nunca** poner punto de color — el color del perfil se aplica al número contador.
- **Inputs / Selects:** `bg-[#222222]` o `bg-[#191919]` + `border border-obsidian-border rounded-lg px-2.5 py-1.5 text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none`
- **Tablas densas (Tráfico y Stripboard):** contenedor `border border-obsidian-border rounded-xl bg-[#202020]`, `thead` con `bg-[#191919] text-[9.5px] text-[#8C8C8C] uppercase tracking-wider`, filas zebra alternando `bg-[#1d1d1d]` y `bg-[#262626]` con `hover:bg-obsidian-elevated/70`.
- **Modales:** overlay `fixed inset-0 bg-black/70 flex items-center justify-center p-4`. Usar `z-40` para `#settings-modal` y `z-50` para `#new-client-modal` (para que crear/editar cliente desde Ajustes se superponga correctamente).
- **Código de tarea en Stripboard:** `${ot.id}-${taskIndex + 1}` en badge `font-mono font-semibold text-obsidian-amber bg-[#191919] border border-obsidian-border rounded`.

---

## 5. Reglas de Roles y Planes (para nuevas pantallas)

- **Roles en Trafikeitor:** `Dueño` (`director`, **no** cuenta en el cupo de puestos) | `Miembro` (`member`, con cargo `role_title` y permiso `allowed_client_id`: `'*'` o cliente específico) | `Cliente` (revisor gratuito en todos los planes) | `Invitado` *(pendiente de implementar completamente en el Módulo Estudio / Miembros)*.
- **Planes:** Prueba gratis `14 días` (5 puestos), Plan Solo `USD $12/mes` (1 puesto sin invitaciones internas), Plan Estudio `USD $49/mes` (5 puestos + `USD $5` por adicional hasta máximo `10`).
- **Principio de Jerarquía de Filtros (estricto):** Un filtro hijo **nunca** contradice ni sobrescribe a su padre. Ejemplos obligatorios:
  - Si `#workspace-bar` ya fijó un Perfil, el filtro interno `Estudio / Perfil` queda bloqueado en ese Perfil.
  - En modo `Estudio` (2+ perfiles activos), `Depto` permanece en `Todos` (deshabilitado) porque los departamentos pertenecen a cada Perfil; se habilita con el orden operativo exacto del Perfil al elegir uno.
  - `Etapa`, `Estado` y `Tiempo` respetan siempre los límites de la Vista Rápida activa (ej. `Tareas` solo `Tráfico`/`Recibida`; `Finalizadas` solo cobro; `Hoy`/`Mañana` fijan `Tiempo`).
- **Ergonomía de Filtros en Escritorio / Estadística:** Los filtros van a la **derecha** (`1/5`) alineados con la primera fila de gráficos (estilo software creativo / Inspector derecho), nunca como muro intermedio a la izquierda.
- **Tareas Libres vs. Separadores:** `Tarea Libre` = trabajo productivo fuera de OT de 2 tipos (`Estudio` interno o `Cliente`); `Separador` = pausa/bloque personal de agenda (*15 min descanso*, *Almorzar*, *Pasear a los perros*). En Escritorio `Global` ocupan las dos últimas Vistas Rápidas; `Mi Jornada Hoy` y `Mañana` pertenecen solo a Escritorio `Personal`.


