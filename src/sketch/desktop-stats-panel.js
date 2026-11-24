/**
 * Cuadrante C02 Estadística del Escritorio:
 * - Cabecera con switch OTs/Tareas vs Horas y totales
 * - Vistas Rápidas (anillos KPI 2×4 en cuadrante o 1×8 en Escritorio Completo)
 * - Gráficos Masonry (4/5) + Filtros en cascada (1/5)
 */

import { escapeHtml } from './store.js';
import { renderTopRingWidget } from './desktop-cards.js';

function renderSelectOpts(items, currentVal, allLabel = 'Todos') {
  return `
    <option value="all" ${currentVal === 'all' ? 'selected' : ''}>${escapeHtml(allLabel)}</option>
    ${items.map((it) => {
      const val = typeof it === 'string' ? it : it.value;
      const lbl = typeof it === 'string' ? it : it.label;
      return `<option value="${escapeHtml(val)}" ${currentVal === val ? 'selected' : ''}>${escapeHtml(lbl)}</option>`;
    }).join('')}
  `;
}

function selectCls(active) {
  return `w-full bg-[#141414] border ${active ? 'border-obsidian-amber/70 text-[#D4D4D4]' : 'border-obsidian-border text-[#A3A3A3]'} rounded px-1.5 py-0.5 text-[9.5px] focus:outline-none focus:border-obsidian-amber/80 cursor-pointer`;
}

export function renderStatsQuadrant({
  pillBoard,
  statsQuery,
  effectiveStatsPill,
  isFullDesktop,
  isPersonalScope,
  showFinalizadasKpi,
  scopedOrders,
  urgentOts,
  todayOts,
  tomorrowOts,
  allActiveTasks,
  urgentTasks,
  todayTasks,
  tomorrowTasks,
  suspendedCount,
  waitingClientItems,
  toBillItems,
  billedItems,
  scopedFreeTasks,
  freeEstudioCount,
  freeClienteCount,
  scopedSeparators,
  sepTotalHours,
  todayHours,
  todayPct,
  todayOver,
  tomorrowHours,
  tomorrowPct,
  tomorrowOver,
  dailyHours,
  dragHandleHtml,
  rightActionBtns,
}) {
  const {
    rbac: stRbac,
    cascadingOptions,
    activeAnchorChips: activeFilterChips,
    hasActiveAnchors: hasActiveStatsFilters,
    effectiveState: stEff,
  } = statsQuery;
  const stAnchors = stEff.anchors;
  const vizBodyHtml = isFullDesktop ? pillBoard.wideHtml : pillBoard.html;

  const statsKpiRowsHtml = `
    <div class="p-1.5 border-b border-obsidian-border ${isFullDesktop ? `grid grid-cols-2 sm:grid-cols-4 ${showFinalizadasKpi || isPersonalScope ? 'xl:grid-cols-8' : 'xl:grid-cols-7'} gap-1.5` : 'flex flex-col gap-1'} shrink-0 bg-[#171717]">
      ${isFullDesktop ? '' : '<div class="grid grid-cols-2 sm:grid-cols-4 gap-1">'}
        ${renderTopRingWidget({
          title: isPersonalScope ? 'Mis OTs' : 'OTs Activas',
          value: scopedOrders.length,
          ringColor: '#f97316',
          progress: 1,
          attrs: 'data-dk-stats-pill="ots-active"',
          active: effectiveStatsPill === 'ots-active',
          lines: suspendedCount
            ? [{ label: 'En proceso' }, { num: suspendedCount, numColor: '#f59e0b', label: 'Susp.' }]
            : [{ label: 'En proceso' }],
        })}
        ${renderTopRingWidget({
          title: 'OTs Urgentes',
          value: urgentOts.length,
          ringColor: urgentOts.length ? '#ef4444' : '#22c55e',
          progress: 1,
          attrs: 'data-dk-stats-pill="ots-urgent"',
          active: effectiveStatsPill === 'ots-urgent',
          lines: [
            { num: todayOts.length, numColor: '#06b6d4', label: 'Hoy' },
            { num: tomorrowOts.length, numColor: '#22c55e', label: 'Mañana' },
          ],
        })}
        ${renderTopRingWidget({
          title: isPersonalScope ? 'Mis Tareas' : 'Tareas Activas',
          value: allActiveTasks.length,
          ringColor: '#f59e0b',
          progress: 1,
          attrs: 'data-dk-stats-pill="tasks-active"',
          active: effectiveStatsPill === 'tasks-active',
          lines: [{ label: 'En proceso' }],
        })}
        ${renderTopRingWidget({
          title: 'Tareas Urgentes',
          value: urgentTasks.length,
          ringColor: urgentTasks.length ? '#ef4444' : '#22c55e',
          progress: 1,
          attrs: 'data-dk-stats-pill="tasks-urgent"',
          active: effectiveStatsPill === 'tasks-urgent',
          lines: [
            { num: todayTasks.length, numColor: '#06b6d4', label: 'Hoy' },
            { num: tomorrowTasks.length, numColor: '#22c55e', label: 'Mañana' },
          ],
        })}
      ${isFullDesktop ? '' : `</div><div class="grid grid-cols-2 ${showFinalizadasKpi ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-1">`}
        ${renderTopRingWidget({
          title: 'En Cliente',
          value: waitingClientItems.length,
          ringColor: '#06b6d4',
          progress: 1,
          attrs: 'data-dk-stats-pill="client-review"',
          active: effectiveStatsPill === 'client-review',
          lines: [{ label: 'En revisión' }],
        })}
        ${showFinalizadasKpi ? renderTopRingWidget({
          title: 'Finalizadas',
          value: toBillItems.length + billedItems.length,
          ringColor: '#eab308',
          progress: 1,
          attrs: 'data-dk-stats-pill="finalizadas"',
          active: effectiveStatsPill === 'finalizadas',
          lines: [
            { num: toBillItems.length, numColor: '#eab308', label: 'Por Facturar' },
            { num: billedItems.length, numColor: '#22c55e', label: 'Facturadas' },
          ],
        }) : ''}
        ${!isPersonalScope ? `
          ${renderTopRingWidget({
            title: 'Tareas Libres',
            value: scopedFreeTasks.length,
            ringColor: '#a855f7',
            progress: 1,
            attrs: 'data-dk-stats-pill="free-tasks"',
            active: effectiveStatsPill === 'free-tasks',
            lines: [
              { num: freeEstudioCount, numColor: '#a855f7', label: 'Estudio' },
              { num: freeClienteCount, numColor: '#06b6d4', label: 'Cliente' },
            ],
          })}
          ${renderTopRingWidget({
            title: 'Separadores',
            value: scopedSeparators.length,
            ringColor: '#94a3b8',
            progress: 1,
            attrs: 'data-dk-stats-pill="separators"',
            active: effectiveStatsPill === 'separators',
            lines: [
              { num: `${sepTotalHours}h`, numColor: '#cbd5e1', label: 'Pausas' },
            ],
          })}
        ` : `
          ${renderTopRingWidget({
            title: 'Mi Jornada Hoy',
            value: `${todayHours}h`,
            ringColor: todayOver ? '#ef4444' : '#22c55e',
            progress: todayHours / dailyHours,
            attrs: 'data-dk-stats-pill="today-hours"',
            active: effectiveStatsPill === 'today-hours',
            lines: [
              { num: `/${dailyHours}h`, numColor: '#8C8C8C', label: '' },
              { num: `${todayPct}%`, numColor: todayOver ? '#ef4444' : '#22c55e', label: todayOver ? 'Extra' : 'Uso' },
            ],
          })}
          ${renderTopRingWidget({
            title: 'Mañana',
            value: `${tomorrowHours}h`,
            ringColor: tomorrowOver ? '#ef4444' : '#38bdf8',
            progress: tomorrowHours / dailyHours,
            attrs: 'data-dk-stats-pill="tomorrow-hours"',
            active: effectiveStatsPill === 'tomorrow-hours',
            lines: [
              { num: `/${dailyHours}h`, numColor: '#8C8C8C', label: '' },
              { num: `${tomorrowPct}%`, numColor: tomorrowOver ? '#ef4444' : '#38bdf8', label: tomorrowOver ? 'Extra' : 'Uso' },
            ],
          })}
        `}
      ${isFullDesktop ? '' : '</div>'}
    </div>
  `;

  return `
    <div class="flex-1 flex flex-col min-h-0 border-t-2 border-t-violet-500/75">
      <!-- Cabecera superior del panel Estadística (controles arriba) -->
      <div class="px-2.5 py-1.5 border-b border-obsidian-border bg-[#1a1a1a] flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">${escapeHtml(pillBoard.title)}</span>
        </div>
        <div class="flex items-center gap-2 font-mono text-[8.5px] text-[#8C8C8C] shrink-0">
          ${!pillBoard.isDayMode ? `
            <div class="inline-flex items-center gap-0.5 text-[8.5px] font-mono">
              <button type="button" data-dk-st-metric="${pillBoard.isTasksMode ? 'tasks' : 'ots'}"
                class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${stEff.metric !== 'hours' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">${pillBoard.isTasksMode ? 'Tareas' : 'OTs'}</button>
              <button type="button" data-dk-st-metric="hours"
                class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${stEff.metric === 'hours' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Horas</button>
            </div>
            <span class="w-px h-3 bg-obsidian-border"></span>
          ` : ''}
          <span>${escapeHtml(pillBoard.countLabel)}</span>
          <span>·</span>
          <span class="text-[#D4D4D4]">${pillBoard.totalHours}h</span>
          ${rightActionBtns}
        </div>
      </div>

      ${statsKpiRowsHtml}

      <div class="flex-1 grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-obsidian-border min-h-0">
        <!-- Columna izquierda (4/5): Chips + Gráficos Masonry -->
        <div class="md:col-span-4 p-2.5 flex flex-col min-h-0">
          ${activeFilterChips.length ? `
            <div class="flex items-center flex-wrap gap-1 mb-2 shrink-0">
              ${activeFilterChips.map((ch) => `
                <button type="button" data-dk-st-clear-filter="${escapeHtml(ch.key)}" title="Quitar filtro"
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#222222] hover:bg-[#2a2a2a] border border-obsidian-amber/40 text-[8.5px] font-mono text-[#D4D4D4] cursor-pointer transition-colors">
                  <span>${escapeHtml(ch.label)}</span>
                  <span class="text-obsidian-amber">×</span>
                </button>
              `).join('')}
            </div>
          ` : ''}

          ${vizBodyHtml}
        </div>

        <!-- Columna derecha (1/5): Filtros alineados con la primera fila de gráficos -->
        <div class="md:col-span-1 p-2.5 flex flex-col min-h-0 bg-[#171717]">
          <div class="flex-1 min-h-0 flex flex-col pt-3 px-0.5">
            <div class="flex items-center justify-between gap-1 pb-1.5 mb-2.5 border-b border-obsidian-border/60 shrink-0">
              <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">Filtros</span>
              <button type="button" data-dk-st-reset="1" title="Limpiar filtros"
                class="w-4 h-4 rounded hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0 ${hasActiveStatsFilters ? 'text-obsidian-amber' : 'text-[#5A5A5A] hover:text-[#A3A3A3]'}"
                aria-label="Limpiar filtros">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            </div>

            <div data-dk-scroll-id="stats-filters" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5 text-[9.5px]">
              <label class="flex flex-col gap-0.5">
                <span class="text-[8.5px] text-[#8C8C8C]">Tiempo</span>
                <select data-dk-st-filter="time"
                  ${cascadingOptions.timeDisabled ? 'disabled title="Horizonte fijado por la Vista Rápida"' : ''}
                  class="${selectCls(stAnchors.time !== 'all' || cascadingOptions.timeDisabled)} ${cascadingOptions.timeDisabled ? 'opacity-65 cursor-not-allowed' : ''}">
                  ${cascadingOptions.timeDisabled
                    ? `<option value="all" selected>${escapeHtml(cascadingOptions.timeLockedLabel)}</option>`
                    : renderSelectOpts(cascadingOptions.time, stAnchors.time || 'all', 'Todas las fechas')}
                </select>
              </label>
              <label class="flex flex-col gap-0.5">
                <span class="text-[8.5px] text-[#8C8C8C]">Estudio / Perfil</span>
                <select data-dk-st-filter="workspace"
                  ${cascadingOptions.workspaceDisabled ? 'disabled title="Perfil fijado desde la barra superior"' : ''}
                  class="${selectCls(stAnchors.workspace !== 'all' || cascadingOptions.workspaceDisabled)} ${cascadingOptions.workspaceDisabled ? 'opacity-65 cursor-not-allowed' : ''}">
                  ${cascadingOptions.workspaceDisabled
                    ? `<option value="all" selected>${escapeHtml(cascadingOptions.workspaceLockedLabel)}</option>`
                    : renderSelectOpts(cascadingOptions.workspace, stAnchors.workspace, 'Estudio')}
                </select>
              </label>
              <label class="flex flex-col gap-0.5">
                <span class="text-[8.5px] text-[#8C8C8C]">Cliente</span>
                <select data-dk-st-filter="client" class="${selectCls(stAnchors.client !== 'all')}">
                  ${renderSelectOpts(cascadingOptions.client, stAnchors.client, 'Todos')}
                </select>
              </label>
              <label class="flex flex-col gap-0.5">
                <span class="text-[8.5px] text-[#8C8C8C]">Depto</span>
                <select data-dk-st-filter="department"
                  ${cascadingOptions.departmentDisabled ? 'disabled title="Selecciona un Perfil para filtrar por Depto"' : ''}
                  class="${selectCls(stAnchors.department !== 'all')} ${cascadingOptions.departmentDisabled ? 'opacity-45 cursor-not-allowed' : ''}">
                  ${cascadingOptions.departmentDisabled
                    ? '<option value="all" selected>Todos</option>'
                    : renderSelectOpts(cascadingOptions.department, stAnchors.department, 'Todos')}
                </select>
              </label>
              ${!stRbac.lockedMember ? `
                <label class="flex flex-col gap-0.5">
                  <span class="text-[8.5px] text-[#8C8C8C]">Responsable</span>
                  <select data-dk-st-filter="responsible" class="${selectCls(stAnchors.responsible !== 'all')}">
                    ${renderSelectOpts(cascadingOptions.responsible, stAnchors.responsible, 'Todos')}
                  </select>
                </label>
              ` : ''}
              <label class="flex flex-col gap-0.5">
                <span class="text-[8.5px] text-[#8C8C8C]">Etapa</span>
                <select data-dk-st-filter="stage" class="${selectCls(stAnchors.stage !== 'all')}">
                  ${renderSelectOpts(cascadingOptions.stage, stAnchors.stage, 'Todas')}
                </select>
              </label>
              <label class="flex flex-col gap-0.5">
                <span class="text-[8.5px] text-[#8C8C8C]">Estado</span>
                <select data-dk-st-filter="status" class="${selectCls(stAnchors.status !== 'all')}">
                  ${renderSelectOpts(cascadingOptions.status, stAnchors.status, 'Todos')}
                </select>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
