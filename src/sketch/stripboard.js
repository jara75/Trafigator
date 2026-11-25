/**
 * Mis Tareas / Stripboard (#view-stripboard): Lista, Día, Semana, Gantt, Mes + Drag & Drop.
 */

import {
  bindTableColResizers,
  escapeHtml,
  formatShortDate,
  getActiveWorkspaces,
  getClientColor,
  getDepartmentsForWorkspace,
  getDepartmentColor,
  getPriorityDotHtml,
  getStageColor,
  getWorkspaceById,
  matchesCommonTrafficFilters,
  notifySketchChange,
  onSketchChange,
  relDate,
  shiftIsoDate,
  sketchState,
  sortTrafficItemsByEntryDate,
  studioFreeTasks,
  studioSeparators,
  studioSettings,
  trafficDepartments,
  trafficMembers,
  trafficOrders,
  trafficStages,
  trafficStatuses,
  ensureOtData
} from './store.js';
import {
  bindGanttScaleEvents,
  bindKanbanScheduleEvents,
  bindScheduleNavEvents,
  formatLongDayHeading,
  renderGanttScheduleHtml,
  renderInspectorMiniCalendar,
  renderKanbanScheduleHtml,
  renderMonthScheduleHtml,
  renderScheduleNavHeader,
  renderWeekScheduleHtml,
  shiftScheduleDate,
} from './schedule-views.js';
import { renderTrafficNotesInspector } from './inspector.js';

let initialized = false;
let openOtCb = null;
let inspectedStrip = null;

/**
 * Build the flat pool of subtasks assigned to the active member across non-archived OTs.
 */
export function getAllMyTaskPool() {
  const pool = [];
  trafficOrders.filter((o) => !o.archived).forEach((ot) => {
    ensureOtData(ot, formatShortDate);
    (ot.subtasks || []).forEach((st, idx) => {
      if ((st.responsible || ot.responsible) === sketchState.myOtsMember) {
        const deliv = st.deliveryDate || ot.deliveryDate;
        pool.push({
          uid: `${ot.id}::${idx}`,
          code: `${ot.id}-${idx + 1}`,
          otId: ot.id,
          workspaceId: ot.workspaceId || 'diseno-publicidad',
          taskIndex: idx,
          client: ot.client,
          brand: ot.brand,
          product: ot.product,
          title: st.title,
          entryDate: ot.entryDate,
          deliveryDate: deliv,
          scheduledDate: (st.scheduledDate || deliv || '').slice(0, 10),
          estimatedHours: Number(st.estimatedHours ?? 3) || 0,
          department: st.department || ot.department || '—',
          stage: st.stage || ot.stage || 'Tráfico',
          status: st.status || ot.status,
          urgent: !!(st.urgent ?? ot.urgent),
          notes: st.notes || '',
          type: 'task'
        });
      }
    });
  });
  return pool;
}

/**
 * Seed and synchronize the Stripboard List view items while preserving breaks, free tasks, and manual order.
 */
export function ensureStripboardListSeeded() {
  const pool = getAllMyTaskPool();
  if (!sketchState.stripboardListItems) {
    sketchState.stripboardListItems = pool.map((t) => ({ ...t }));
    return sketchState.stripboardListItems;
  }
  const poolMap = new Map(pool.map((t) => [t.uid, t]));
  const next = [];
  const seen = new Set();
  sketchState.stripboardListItems.forEach((s) => {
    if (s.type === 'break' || String(s.uid || '').startsWith('free-')) {
      next.push(s);
    } else if (poolMap.has(s.uid)) {
      const src = poolMap.get(s.uid);
      next.push({ ...s, ...src });
      seen.add(s.uid);
    }
  });
  pool.forEach((t) => {
    if (!seen.has(t.uid)) next.push({ ...t });
  });
  sketchState.stripboardListItems = next;
  return sketchState.stripboardListItems;
}

/**
 * Seed and synchronize the strips for a specific ISO date while preserving breaks, free tasks, and manual order.
 */
export function ensureStripboardDaySeeded(dateStr) {
  if (!sketchState.stripboardStripsByDate[dateStr]) {
    const dueThatDay = getAllMyTaskPool().filter(
      (t) => (t.scheduledDate || (t.deliveryDate || '').slice(0, 10)) === dateStr
    );
    sketchState.stripboardStripsByDate[dateStr] = dueThatDay.map((t) => ({ ...t }));
  } else {
    const poolMap = new Map(getAllMyTaskPool().map((t) => [t.uid, t]));
    sketchState.stripboardStripsByDate[dateStr].forEach((s) => {
      if (s.type !== 'break' && poolMap.has(s.uid)) {
        const src = poolMap.get(s.uid);
        s.estimatedHours = src.estimatedHours;
        s.scheduledDate = src.scheduledDate;
        s.status = src.status;
        s.stage = src.stage;
        s.department = src.department;
        s.notes = src.notes;
        s.urgent = src.urgent;
        s.title = src.title;
      }
    });
  }
  return sketchState.stripboardStripsByDate[dateStr];
}

/**
 * Calculate total reserved hours for a given ISO date (excluding break separators).
 */
export function getDayReservedHours(dateStr) {
  return ensureStripboardDaySeeded(dateStr).reduce(
    (sum, s) => sum + (s.type === 'break' ? 0 : (Number(s.estimatedHours) || 0)),
    0
  );
}

/**
 * Move a task strip to another scheduled date without deleting breaks, free-* tasks, or target day's manual order.
 */
export function moveTaskToScheduledDate(uid, targetDateStr) {
  if (!uid || !targetDateStr) return;

  if (String(uid).startsWith('free-') || String(uid).startsWith('sep-')) {
    let movedItem = null;
    for (const [dateKey, list] of Object.entries(sketchState.stripboardStripsByDate)) {
      const idx = list.findIndex((s) => s.uid === uid);
      if (idx !== -1) {
        if (dateKey === targetDateStr) return;
        [movedItem] = list.splice(idx, 1);
        break;
      }
    }
    if (!movedItem) return;
    movedItem.scheduledDate = targetDateStr;
    const targetList = ensureStripboardDaySeeded(targetDateStr);
    if (!targetList.some((s) => s.uid === uid)) {
      targetList.push(movedItem);
    }
    return;
  }

  const [otId, idxStr] = String(uid).split('::');
  const ot = trafficOrders.find((o) => o.id === otId);
  const idx = Number(idxStr);
  if (!ot || !ot.subtasks || !ot.subtasks[idx]) return;

  const oldDate = (ot.subtasks[idx].scheduledDate || ot.subtasks[idx].deliveryDate || ot.deliveryDate || '').slice(0, 10);
  ot.subtasks[idx].scheduledDate = targetDateStr;

  if (oldDate && oldDate !== targetDateStr && sketchState.stripboardStripsByDate[oldDate]) {
    sketchState.stripboardStripsByDate[oldDate] = sketchState.stripboardStripsByDate[oldDate].filter(
      (s) => s.uid !== uid
    );
  }

  const targetList = ensureStripboardDaySeeded(targetDateStr);
  if (!targetList.some((s) => s.uid === uid)) {
    const taskItem = getAllMyTaskPool().find((t) => t.uid === uid);
    if (taskItem) {
      targetList.push({ ...taskItem });
    }
  }
}

/**
 * Group visible strips by the active left-menu groupBy option.
 */
function buildStripGroups(visibleStrips, groupBy) {
  const todayIso = relDate(0).slice(0, 10);
  const tomorrowIso = relDate(1).slice(0, 10);
  const groupsMap = new Map();
  visibleStrips.forEach((s) => {
    let key = '';
    let label = '';
    let color = null;
    if (groupBy === 'client') {
      key = s.client || 'Interno';
      label = key;
      color = getClientColor(s.client);
    } else if (groupBy === 'department') {
      key = s.department || 'Sin depto.';
      label = key;
      color = getDepartmentColor(s.department);
    } else if (groupBy === 'stage') {
      key = s.stage || 'Tráfico';
      label = key;
      color = getStageColor(key);
    } else if (groupBy === 'status') {
      key = s.status || 'Sin estado';
      label = key;
    } else if (groupBy === 'priority') {
      const dKey = (s.deliveryDate || '').slice(0, 10);
      if (s.urgent) key = 'Urgentes';
      else if (dKey === todayIso) key = 'Vencen hoy';
      else if (dKey === tomorrowIso) key = 'Vencen mañana';
      else key = 'Programadas';
      label = key;
    } else if (groupBy === 'deliveryDate' || groupBy === 'entryDate') {
      const raw = groupBy === 'entryDate' ? (s.entryDate || s.scheduledDate) : s.deliveryDate;
      const isoDay = (raw || '').slice(0, 10);
      key = isoDay || 'Sin fecha';
      label = isoDay ? `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}/${isoDay.slice(0, 4)}` : 'Sin fecha';
    } else {
      key = s.responsible || s.brand || 'General';
      label = key;
    }
    if (!groupsMap.has(key)) {
      groupsMap.set(key, { key, label, color, items: [] });
    }
    groupsMap.get(key).items.push(s);
  });
  return Array.from(groupsMap.values());
}

/**
 * Render a single strip row (task or break) for List / Day views.
 */
function renderStripRowHtml(s, strips, visIdx, runningHoursRef, dailyHours) {
  const idx = strips.indexOf(s);
  const sbMulti = getActiveWorkspaces().length >= 2;
  if (s.type === 'break') {
    return `
      <tr draggable="true" data-sb-idx="${idx}" class="sb-strip-row bg-[#2a2419] border-y border-amber-500/30 text-[10px] text-obsidian-amber cursor-grab active:cursor-grabbing">
        <td class="px-2 py-1.5 text-center font-mono text-[#8C8C8C]">≡</td>
        <td colspan="${sbMulti ? 11 : 10}" class="px-2 py-1">
          <input type="text" data-sb-edit-title="${idx}" value="${escapeHtml(s.title)}"
            class="w-full bg-transparent border border-transparent hover:border-amber-500/40 focus:border-obsidian-amber focus:bg-[#191919] rounded px-1.5 py-0.5 font-mono uppercase tracking-[0.12em] font-semibold text-obsidian-amber focus:outline-none" />
        </td>
        <td class="px-2 py-1.5 text-center">
          <button type="button" data-sb-remove="${idx}" class="text-[#8C8C8C] hover:text-rose-400 cursor-pointer">×</button>
        </td>
      </tr>
    `;
  }

  const cColor = getClientColor(s.client);
  const zebra = visIdx % 2 === 1 ? 'bg-[#262626]' : 'bg-[#1d1d1d]';
  const hrs = Number(s.estimatedHours ?? 3) || 0;
  runningHoursRef.total += hrs;
  const isOverRow = sketchState.stripboardViewMode === 'day' && runningHoursRef.total > dailyHours;
  const firstCross = isOverRow && !runningHoursRef.crossed;
  if (firstCross) runningHoursRef.crossed = true;
  const isFree = String(s.uid || '').startsWith('free-');

  // Espacios: tu jornada es una sola. Las tareas de otros espacios se ven atenuadas, nunca ocultas.
  const sbWs = s.workspaceId ? getWorkspaceById(s.workspaceId) : null;
  const sbActiveWs = sketchState.activeWorkspaceId || 'studio';
  const isOtherSpace = !!(sbMulti && sbWs && sbActiveWs !== 'studio' && s.workspaceId !== sbActiveWs);
  const wsTdHtml = sbMulti
    ? `<td class="px-2 py-1.5 border-r border-obsidian-border truncate font-medium" style="color:${escapeHtml(sbWs?.color || '#8C8C8C')}">${escapeHtml(sbWs?.shortName || 'Estudio')}</td>`
    : '';

  return `
    <tr draggable="true" data-sb-idx="${idx}" data-sb-ot="${escapeHtml(s.otId || '')}" data-sb-task="${s.taskIndex !== undefined ? s.taskIndex : ''}" class="sb-strip-row ${zebra} ${firstCross ? 'border-t-2 border-t-rose-500/80' : ''} ${isOtherSpace ? 'opacity-45' : ''} hover:bg-obsidian-elevated/70 transition-colors cursor-grab active:cursor-grabbing">
      <td class="px-2 py-1.5 border-r border-obsidian-border text-center font-mono text-[#8C8C8C]">${visIdx + 1}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border">
        <span class="inline-flex items-center justify-center gap-1 w-full font-mono font-semibold text-obsidian-amber px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border whitespace-nowrap">
          ${getPriorityDotHtml(s, undefined, undefined, 'w-1.5 h-1.5')}
          <span>${escapeHtml(s.code || 'LIBRE')}</span>
        </span>
      </td>
      ${wsTdHtml}
      <td class="px-2 py-1.5 border-r border-obsidian-border truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(s.client || 'Interno')}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C] truncate">${escapeHtml(s.brand || '—')}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border text-[#D4D4D4] font-medium">
        ${isFree
          ? `<input type="text" data-sb-edit-title="${idx}" value="${escapeHtml(s.title)}" class="w-full bg-transparent border border-transparent hover:border-obsidian-border focus:border-obsidian-amber focus:bg-[#191919] rounded px-1.5 py-0.5 text-[#D4D4D4] font-medium focus:outline-none" />`
          : escapeHtml(s.title)
        }
      </td>
      <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-center ${isOverRow ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-obsidian-amber'}">
        <div class="inline-flex items-center justify-center gap-1">
          <input type="number" min="0.5" max="24" step="0.5" value="${hrs}" data-sb-hours-idx="${idx}"
            class="w-11 bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-center font-mono text-[10px] text-obsidian-amber focus:outline-none" />
          ${sketchState.stripboardViewMode === 'day' ? `<span class="text-[9px] text-[#8C8C8C]">(${runningHoursRef.total}h)</span>` : ''}
        </div>
      </td>
      <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-[#8C8C8C] text-center">${escapeHtml(formatShortDate(s.deliveryDate) || 'Hoy')}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border truncate" style="color:${escapeHtml(getDepartmentColor(s.department))}">${escapeHtml(s.department || '—')}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border">
        <select data-sb-stage-idx="${idx}" style="color:${escapeHtml(getStageColor(s.stage || 'Tráfico'))}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] focus:outline-none cursor-pointer">
          ${trafficStages.map((st) => `<option value="${escapeHtml(st)}" ${(s.stage || 'Tráfico') === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
        </select>
      </td>
      <td class="px-2 py-1.5 border-r border-obsidian-border">
        <select data-sb-status-idx="${idx}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#D4D4D4] focus:outline-none cursor-pointer">
          ${trafficStatuses.map((st) => `<option value="${escapeHtml(st)}" ${s.status === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
        </select>
      </td>
      <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C] truncate">${escapeHtml(s.notes || '')}</td>
      <td class="px-2 py-1.5 text-center">
        <button type="button" data-sb-remove="${idx}" class="text-[#8C8C8C] hover:text-rose-400 cursor-pointer">×</button>
      </td>
    </tr>
  `;
}

/**
 * Render the Stripboard (#view-stripboard) across Lista, Día, Semana, Gantt, and Mes modes.
 */
export function renderStripboard() {
  const container = document.getElementById('view-stripboard');
  if (!container) return;

  const dailyHours = Number(studioSettings.dailyHours) || 8;
  const trafficFilter = sketchState.trafficFilter;

  const matchesTrafficFilter = (item) => {
    if (item.type === 'break') {
      return (
        trafficFilter.type === 'all' &&
        sketchState.trafficDeptFilter === 'all' &&
        sketchState.trafficStageFilter === 'all' &&
        sketchState.trafficStatusFilter === 'all' &&
        sketchState.trafficDateFilter === 'all' &&
        !sketchState.stripboardSearch.trim() &&
        sketchState.stripboardGroupBy === 'none'
      );
    }
    return matchesCommonTrafficFilters(item, {
      state: sketchState,
      checkResponsible: false,
      checkWorkspace: false,
      searchQuery: sketchState.stripboardSearch,
    });
  };

  const allPool = getAllMyTaskPool();
  const strips = sketchState.stripboardViewMode === 'list'
    ? ensureStripboardListSeeded()
    : ensureStripboardDaySeeded(sketchState.stripboardDate);

  const filteredStrips = strips.filter(matchesTrafficFilter);
  const visibleStrips = sketchState.stripboardViewMode !== 'day'
    ? sortTrafficItemsByEntryDate(filteredStrips, sketchState.trafficSortBy)
    : filteredStrips;

  const taskStrips = visibleStrips.filter((s) => s.type !== 'break');
  const doneStages = new Set(['Cerrar OT y Facturar', 'Facturada', 'Pagada']);
  const activeCount = taskStrips.filter((s) => s.status === 'En proceso' && !doneStages.has(s.stage)).length;
  const doneCount = taskStrips.filter((s) => doneStages.has(s.stage)).length;
  const dayReservedHours = getDayReservedHours(sketchState.stripboardDate);
  const dayOverloaded = dayReservedHours > dailyHours;

  // Desglose de la jornada: horas del espacio actual vs. horas ocupadas en otros espacios.
  let daySplitLabel = '';
  const activeWsId = sketchState.activeWorkspaceId || 'studio';
  if (getActiveWorkspaces().length >= 2 && activeWsId !== 'studio') {
    const dayTasks = ensureStripboardDaySeeded(sketchState.stripboardDate).filter((s) => s.type !== 'break');
    const sumHours = (list) => list.reduce((sum, s) => sum + (Number(s.estimatedHours) || 0), 0);
    const mineH = sumHours(dayTasks.filter((s) => !s.workspaceId || s.workspaceId === activeWsId));
    const otherH = sumHours(dayTasks.filter((s) => s.workspaceId && s.workspaceId !== activeWsId));
    const wsShort = getWorkspaceById(activeWsId)?.shortName || 'Espacio';
    daySplitLabel = ` (${mineH}h ${wsShort} + ${otherH}h otros)`;
  }

  let mainContentHtml = '';
  if (sketchState.stripboardViewMode === 'list' || sketchState.stripboardViewMode === 'day') {
    const runningHoursRef = { total: 0, crossed: false };
    let tbodyHtml = '';

    const sbTotalCols = getActiveWorkspaces().length >= 2 ? 13 : 12;
    if (!visibleStrips.length) {
      tbodyHtml = `<tr><td colspan="${sbTotalCols}" class="p-8 text-center text-[11px] text-[#8C8C8C]">Sin tiras programadas para este filtro o día.</td></tr>`;
    } else if (sketchState.stripboardGroupBy !== 'none') {
      const groups = buildStripGroups(visibleStrips, sketchState.stripboardGroupBy);
      let visCounter = 0;
      tbodyHtml = groups.map((grp) => {
        const groupHours = grp.items.reduce((sum, s) => sum + (Number(s.estimatedHours) || 0), 0);
        const headerRow = `
          <tr class="bg-[#191919] border-y border-obsidian-border text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8C8C8C] select-none">
            <td colspan="${sbTotalCols}" class="px-2.5 py-1.5">
              <div class="flex items-center justify-between">
                <span class="font-semibold" style="${grp.color ? `color:${escapeHtml(grp.color)}` : 'color:#D4D4D4'}">${escapeHtml(grp.label)}</span>
                <span class="font-mono text-[9.5px] text-[#8C8C8C]">${grp.items.length} ${grp.items.length === 1 ? 'tarea' : 'tareas'} · ${groupHours}h</span>
              </div>
            </td>
          </tr>
        `;
        const rowsHtml = grp.items.map((s) => renderStripRowHtml(s, strips, visCounter++, runningHoursRef, dailyHours)).join('');
        return headerRow + rowsHtml;
      }).join('');
    } else {
      tbodyHtml = visibleStrips.map((s, visIdx) => renderStripRowHtml(s, strips, visIdx, runningHoursRef, dailyHours)).join('');
    }

    let dayNavHtml = '';
    if (sketchState.stripboardViewMode === 'day') {
      const { title, subtitle, centerLabel } = formatLongDayHeading(sketchState.stripboardDate);
      dayNavHtml = renderScheduleNavHeader(title, 'Día anterior', 'Día siguiente', { subtitle, centerLabel });
    }

    mainContentHtml = `
      <div class="flex-1 flex flex-col gap-2 overflow-hidden">
        ${dayNavHtml}
        <div class="flex-1 overflow-auto border border-obsidian-border rounded-xl bg-[#202020]">
          <table class="w-full text-left text-[10.5px] border-collapse">
            <thead>
              <tr class="bg-[#191919] border-b border-obsidian-border text-[9.5px] text-[#8C8C8C] uppercase tracking-wider select-none">
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-8 text-center">#<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-24">Código<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                ${getActiveWorkspaces().length >= 2 ? '<th class="relative px-2 py-1.5 border-r border-obsidian-border w-24">Espacio<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>' : ''}
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-32">Cliente<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-28">Marca<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border">Tarea<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-20 text-center">Horas<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-24 text-center">Entrega<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-24">Depto.<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-28">Etapa<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-28">Estado<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="relative px-2 py-1.5 border-r border-obsidian-border w-36">Notas<div class="traffic-col-resizer absolute inset-y-0 right-0 w-1.5 cursor-col-resize hover:bg-obsidian-cyan/70"></div></th>
                <th class="px-2 py-1.5 w-8 text-center"></th>
              </tr>
            </thead>
            <tbody id="sb-day-tbody" class="divide-y divide-obsidian-border">
              ${tbodyHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else if (sketchState.stripboardViewMode === 'kanban') {
    const kanbanPool = sortTrafficItemsByEntryDate(
      allPool.filter(matchesTrafficFilter).map((t) => ({ ...t, id: t.code || t.otId })),
      sketchState.trafficSortBy
    );
    const kanbanGroupBy = ['priority', 'stage', 'status', 'department', 'client'].includes(sketchState.stripboardGroupBy)
      ? sketchState.stripboardGroupBy
      : 'stage';
    mainContentHtml = renderKanbanScheduleHtml({
      items: kanbanPool,
      groupBy: kanbanGroupBy,
      todayKey: relDate(0).slice(0, 10),
      tomorrowKey: relDate(1).slice(0, 10),
      departments: getDepartmentsForWorkspace(sketchState.activeWorkspaceId),
      stages: trafficStages,
      statuses: trafficStatuses,
      members: trafficMembers,
      wrap: true,
    });
  } else if (sketchState.stripboardViewMode === 'week') {
    mainContentHtml = renderWeekScheduleHtml({
      anchorDate: sketchState.stripboardDate,
      dailyHours,
      showHoursBadge: true,
      draggableCards: true,
      emptyColText: 'Sin tiras',
      getDayItems: (iso) => ensureStripboardDaySeeded(iso).filter((s) => matchesTrafficFilter(s)),
    });
  } else if (sketchState.stripboardViewMode === 'gantt') {
    const rows = taskStrips.length ? taskStrips : allPool.slice(0, 5);
    mainContentHtml = renderGanttScheduleHtml({
      anchorDate: sketchState.stripboardDate,
      items: rows,
      scale: sketchState.ganttScale,
    });
  } else {
    mainContentHtml = renderMonthScheduleHtml({
      anchorDate: sketchState.stripboardDate,
      dateAttr: 'data-sb-pick-date',
      getDayItems: (iso) => ensureStripboardDaySeeded(iso).filter((s) => matchesTrafficFilter(s)),
    });
  }

  container.innerHTML = `
    <!-- Toolbar Stripboard -->
    <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-obsidian-border shrink-0">
      <div class="flex flex-wrap items-center gap-2 text-[10.5px] text-[#8C8C8C]">
        <span class="hidden xl:inline">Tareas: <strong class="text-[#D4D4D4] font-mono">${taskStrips.length}</strong></span>
        <span class="hidden xl:inline">·</span>
        <span class="hidden xl:inline">En Mesa: <strong class="text-obsidian-amber font-mono">${activeCount}</strong></span>
        <span class="hidden xl:inline">·</span>
        <span class="hidden xl:inline">Entregadas: <strong class="text-emerald-400 font-mono">${doneCount}</strong></span>
        <span class="hidden xl:inline">·</span>
        <span class="px-1.5 py-0.5 rounded border font-mono ${dayOverloaded ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold' : 'bg-[#191919] border-obsidian-border text-[#D4D4D4]'}">
          Día: ${dayReservedHours}h / ${dailyHours}h${daySplitLabel}${dayOverloaded ? ' · Sobrecarga' : ''}
        </span>
        <button type="button" id="sb-add-break" class="h-6 px-2 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">+ Separador</button>
        <button type="button" id="sb-add-free" class="h-6 px-2 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">+ Tarea Libre</button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <div class="relative flex items-center">
          <span data-icon="search" data-icon-size="w-3 h-3" class="text-[#8C8C8C] absolute left-2 pointer-events-none"></span>
          <input type="text" id="sb-search-input" value="${escapeHtml(sketchState.stripboardSearch)}" placeholder="Buscar..." class="h-6 w-28 focus:w-40 bg-[#191919] border border-obsidian-border rounded-md pl-6 pr-2 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none transition-all" />
        </div>
        <div class="inline-flex items-center bg-[#191919] border border-obsidian-border rounded-lg p-0.5 text-[10.5px]">
          ${[['list', 'Lista'], ['kanban', 'Kanban'], ['gantt', 'Gantt']].map(([mode, lbl]) => `
            <button type="button" data-sb-mode="${mode}" class="px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${sketchState.stripboardViewMode === mode ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">${lbl}</button>
          `).join('')}
          <span class="w-px h-3.5 bg-obsidian-border mx-1"></span>
          ${[['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([mode, lbl]) => `
            <button type="button" data-sb-mode="${mode}" class="px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${sketchState.stripboardViewMode === mode ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">${lbl}</button>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Cuerpo: Tablero Stripboard a ancho completo -->
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
      ${mainContentHtml}
    </div>
  `;

  if (window.hydrateIcons) window.hydrateIcons(container);
  bindTableColResizers(container.querySelector('table'));

  const isCalMode = ['day', 'week', 'gantt', 'month'].includes(sketchState.stripboardViewMode);
  if (isCalMode) {
    const busyDates = new Set(
      allPool.map((t) => (t.scheduledDate || t.deliveryDate || '').slice(0, 10)).filter(Boolean)
    );
    renderInspectorMiniCalendar({
      anchorDate: sketchState.stripboardDate,
      busyDates,
      onSelectDate: (iso) => {
        sketchState.stripboardDate = iso;
        renderStripboard();
      },
    });
  } else {
    const rb = document.getElementById('right-body');
    if (rb && rb.querySelector('#insp-cal-slot')) rb.innerHTML = '';
  }

  const openOtFromStrip = (otId, tIdx) => {
    if (!otId) return;
    sketchState.myOtsScope = 'traffic-open';
    sketchState.activeMyOtId = otId;
    sketchState.activeTaskIndex = tIdx !== '' && tIdx !== null && tIdx !== undefined ? Number(tIdx) : null;
    sketchState.myOtsMode = 'cards';
    if (openOtCb) {
      openOtCb(otId, sketchState.activeTaskIndex);
    } else {
      document.getElementById('view-stripboard')?.classList.add('hidden');
      document.getElementById('left-traffic-tree')?.classList.add('hidden');
      document.getElementById('left-stripboard-pool')?.classList.add('hidden');
      document.getElementById('view-my-ots')?.classList.remove('hidden');
      notifySketchChange('orders');
    }
  };

  const inspectStripTask = (otId, tIdx) => {
    if (!otId) return;
    inspectedStrip = { otId, taskIndex: tIdx !== '' && tIdx !== null && tIdx !== undefined ? Number(tIdx) : '' };
    renderTrafficNotesInspector(inspectedStrip.otId, inspectedStrip.taskIndex, false, {
      onOpenOt: openOtFromStrip,
    });
  };

  const firstInspectable = taskStrips.find((s) => s.otId) || allPool.find((s) => s.otId);
  if (inspectedStrip && !trafficOrders.some((o) => o.id === inspectedStrip.otId)) {
    inspectedStrip = null;
  }
  if (!inspectedStrip && firstInspectable) {
    inspectedStrip = { otId: firstInspectable.otId, taskIndex: firstInspectable.taskIndex ?? '' };
  }
  if (inspectedStrip) {
    renderTrafficNotesInspector(inspectedStrip.otId, inspectedStrip.taskIndex, false, {
      onOpenOt: openOtFromStrip,
    });
  }

  const sbSearchInput = container.querySelector('#sb-search-input');
  if (sbSearchInput) {
    sbSearchInput.addEventListener('input', (e) => {
      const pos = e.target.selectionStart || 0;
      sketchState.stripboardSearch = e.target.value;
      renderStripboard();
      const nextInput = container.querySelector('#sb-search-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });
  }

  container.querySelectorAll('[data-sb-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.stripboardViewMode = btn.dataset.sbMode;
      renderStripboard();
    });
  });

  bindGanttScaleEvents(container, (nextScale) => {
    sketchState.ganttScale = nextScale;
    renderStripboard();
  });

  bindScheduleNavEvents(
    container,
    (dir) => {
      sketchState.stripboardDate = shiftScheduleDate(
        sketchState.stripboardDate,
        sketchState.stripboardViewMode,
        dir,
        sketchState.ganttScale
      );
      renderStripboard();
    },
    () => {
      sketchState.stripboardDate = relDate(0).slice(0, 10);
      renderStripboard();
    }
  );

  container.querySelector('#sb-load-pending')?.addEventListener('click', () => {
    const existing = new Set(strips.map((s) => s.uid));
    allPool.forEach((t) => {
      if (!existing.has(t.uid)) strips.push({ ...t });
    });
    renderStripboard();
  });

  container.querySelector('#sb-add-break')?.addEventListener('click', () => {
    const sepUid = `sep-${Date.now()}`;
    strips.push({ uid: sepUid, type: 'break', title: '15 minutos de descanso', minutes: 15, hours: 0.25 });
    studioSeparators.push({
      id: sepUid,
      title: '15 minutos de descanso',
      responsible: sketchState.myOtsMember || 'Andrés',
      date: sketchState.stripboardDate || relDate(0).slice(0, 10),
      minutes: 15,
      hours: 0.25,
    });
    renderStripboard();
    notifySketchChange('orders');
  });

  container.querySelector('#sb-add-free')?.addEventListener('click', () => {
    const freeUid = `free-${Date.now()}`;
    const dIso = sketchState.stripboardDate || relDate(0).slice(0, 10);
    strips.push({
      uid: freeUid,
      type: 'task',
      freeKind: 'estudio',
      code: 'LIBRE',
      client: 'Estudio',
      brand: 'Interno',
      title: 'Capacitación Trafigator',
      deliveryDate: `${dIso}T18:00:00`,
      scheduledDate: dIso,
      estimatedHours: 1.5,
      department: 'Estudio',
      stage: 'Tráfico',
      status: 'En proceso',
      notes: ''
    });
    studioFreeTasks.push({
      id: freeUid,
      kind: 'estudio',
      client: 'Estudio',
      title: 'Capacitación Trafigator',
      responsible: sketchState.myOtsMember || 'Andrés',
      workspaceId: sketchState.activeWorkspaceId !== 'studio' ? sketchState.activeWorkspaceId : 'diseno-publicidad',
      date: dIso,
      hours: 1.5,
    });
    renderStripboard();
    notifySketchChange('orders');
  });

  container.querySelectorAll('[data-sb-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      strips.splice(Number(btn.dataset.sbRemove), 1);
      renderStripboard();
    });
  });

  container.querySelectorAll('[data-sb-status-idx]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      const item = strips[Number(sel.dataset.sbStatusIdx)];
      if (!item) return;
      item.status = sel.value;
      if (item.otId && item.taskIndex !== undefined) {
        const ot = trafficOrders.find((o) => o.id === item.otId);
        if (ot?.subtasks?.[item.taskIndex]) ot.subtasks[item.taskIndex].status = sel.value;
      }
      renderStripboard();
      notifySketchChange('orders');
    });
  });

  container.querySelectorAll('[data-sb-stage-idx]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      e.stopPropagation();
      const item = strips[Number(sel.dataset.sbStageIdx)];
      if (!item) return;
      item.stage = sel.value;
      if (item.otId && item.taskIndex !== undefined) {
        const ot = trafficOrders.find((o) => o.id === item.otId);
        if (ot?.subtasks?.[item.taskIndex]) ot.subtasks[item.taskIndex].stage = sel.value;
      }
      renderStripboard();
      notifySketchChange('orders');
    });
  });

  container.querySelectorAll('[data-sb-hours-idx]').forEach((inp) => {
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('change', (e) => {
      e.stopPropagation();
      const item = strips[Number(inp.dataset.sbHoursIdx)];
      if (!item) return;
      const val = Math.max(0.5, Math.min(24, Number(inp.value) || 0.5));
      item.estimatedHours = val;
      if (item.otId && item.taskIndex !== undefined) {
        const ot = trafficOrders.find((o) => o.id === item.otId);
        if (ot?.subtasks?.[item.taskIndex]) ot.subtasks[item.taskIndex].estimatedHours = val;
      }
      renderStripboard();
      notifySketchChange('orders');
    });
  });

  let dragIdx = null;
  const tbodyEl = container.querySelector('#sb-day-tbody');
  tbodyEl?.addEventListener('dragover', (e) => { e.preventDefault(); });
  tbodyEl?.addEventListener('drop', (e) => {
    const poolUid = e.dataTransfer?.getData('text/sb-pool-uid');
    if (!poolUid) return;
    e.preventDefault();
    const item = allPool.find((t) => t.uid === poolUid);
    if (item) {
      strips.push({ ...item });
      renderStripboard();
    }
  });

  container.querySelectorAll('.sb-strip-row').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      dragIdx = Number(row.dataset.sbIdx);
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(dragIdx));
        e.dataTransfer.setData('text/sb-row-idx', String(dragIdx));
      }
      row.classList.add('opacity-50');
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('opacity-50');
      container.querySelectorAll('.sb-strip-row').forEach((r) => r.classList.remove('ring-1', 'ring-obsidian-amber/60'));
      dragIdx = null;
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      row.classList.add('ring-1', 'ring-obsidian-amber/60');
    });
    row.addEventListener('dragleave', () => {
      row.classList.remove('ring-1', 'ring-obsidian-amber/60');
    });
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('ring-1', 'ring-obsidian-amber/60');
      const targetIdx = Number(row.dataset.sbIdx);
      const poolUid = e.dataTransfer?.getData('text/sb-pool-uid');
      if (poolUid) {
        e.stopPropagation();
        const item = allPool.find((t) => t.uid === poolUid);
        if (item) {
          strips.splice(targetIdx, 0, { ...item });
          renderStripboard();
        }
        return;
      }
      const rawFrom = e.dataTransfer?.getData('text/sb-row-idx');
      const fromIdx = dragIdx !== null ? dragIdx : (rawFrom !== '' && rawFrom !== undefined ? Number(rawFrom) : null);
      if (fromIdx === null || Number.isNaN(fromIdx) || fromIdx === targetIdx) return;

      sketchState.stripboardSortBy = 'manual';
      const rect = row.getBoundingClientRect();
      const dropAfter = rect.height > 0 && e.clientY > rect.top + rect.height / 2;
      let insertIdx = dropAfter ? targetIdx + 1 : targetIdx;
      if (fromIdx < insertIdx) insertIdx -= 1;
      if (insertIdx === fromIdx) return;

      const [moved] = strips.splice(fromIdx, 1);
      strips.splice(insertIdx, 0, moved);
      renderStripboard();
    });
    row.addEventListener('click', (e) => {
      if (e.target.closest('select, button, input, a')) return;
      container.querySelectorAll('.sb-strip-row').forEach((r) => {
        r.classList.remove('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
      });
      row.classList.add('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
      inspectStripTask(row.dataset.sbOt, row.dataset.sbTask);
    });
    row.addEventListener('dblclick', (e) => {
      if (e.target.closest('select, button, input, a')) return;
      openOtFromStrip(row.dataset.sbOt, row.dataset.sbTask);
    });
  });

  container.querySelectorAll('[data-sb-edit-title]').forEach((inp) => {
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('change', (e) => {
      e.stopPropagation();
      const item = strips[Number(inp.dataset.sbEditTitle)];
      if (!item) return;
      const next = inp.value.trim();
      if (next) item.title = next;
      else inp.value = item.title;
    });
  });

  container.querySelectorAll('[data-sb-week-title]').forEach((inp) => {
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('change', (e) => {
      e.stopPropagation();
      const dayList = ensureStripboardDaySeeded(inp.dataset.sbWeekDay);
      const item = dayList.find((s) => s.uid === inp.dataset.sbWeekTitle);
      if (!item) return;
      const next = inp.value.trim();
      if (next) item.title = next;
      else inp.value = item.title;
    });
  });

  container.querySelectorAll('[data-sb-week-hours]').forEach((inp) => {
    inp.addEventListener('click', (e) => e.stopPropagation());
    inp.addEventListener('change', (e) => {
      e.stopPropagation();
      const dayList = ensureStripboardDaySeeded(inp.dataset.sbWeekDay);
      const item = dayList.find((s) => s.uid === inp.dataset.sbWeekHours);
      if (!item) return;
      item.estimatedHours = Math.max(0.5, Math.min(24, Number(inp.value) || 0.5));
      renderStripboard();
    });
  });

  container.querySelectorAll('[data-sb-week-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uid = btn.dataset.sbWeekRemove;
      const dayIso = btn.dataset.sbWeekDay;
      if (!uid || !dayIso) return;
      const dayList = ensureStripboardDaySeeded(dayIso);
      const rmIdx = dayList.findIndex((s) => s.uid === uid);
      if (rmIdx !== -1) {
        dayList.splice(rmIdx, 1);
        renderStripboard();
      }
    });
  });

  container.querySelectorAll('.sb-open-trigger').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, select, input')) return;
      container.querySelectorAll('.sb-open-trigger').forEach((c) => {
        c.classList.remove('ring-1', 'ring-obsidian-amber/70');
      });
      card.classList.add('ring-1', 'ring-obsidian-amber/70');
      inspectStripTask(card.dataset.sbOt, card.dataset.sbTask);
    });
    card.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, select, input')) return;
      openOtFromStrip(card.dataset.sbOt, card.dataset.sbTask);
    });
  });

  if (sketchState.stripboardViewMode === 'kanban') {
    bindKanbanScheduleEvents({
      container,
      orders: trafficOrders,
      onInspectItem: (otId, taskIdx) => inspectStripTask(otId, taskIdx),
      onOpenItem: (otId, taskIdx) => openOtFromStrip(otId, taskIdx),
      onChanged: () => {
        renderStripboard();
        notifySketchChange('orders');
      },
    });
  }

  container.querySelectorAll('[data-sched-ot]').forEach((el) => {
    el.addEventListener('click', () => {
      container.querySelectorAll('[data-sched-ot]').forEach((n) => {
        n.classList.remove('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
      });
      el.classList.add('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
      inspectStripTask(el.dataset.schedOt, el.dataset.schedTask || '');
    });
    el.addEventListener('dblclick', () => {
      openOtFromStrip(el.dataset.schedOt, el.dataset.schedTask || '');
    });
  });

  container.querySelectorAll('.sb-week-card').forEach((card) => {
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer?.setData('text/sb-week-uid', card.dataset.sbUid || '');
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-50');
    });
  });

  container.querySelectorAll('.sb-week-col').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('ring-1', 'ring-obsidian-amber/60');
    });
    col.addEventListener('dragleave', () => {
      col.classList.remove('ring-1', 'ring-obsidian-amber/60');
    });
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('ring-1', 'ring-obsidian-amber/60');
      const uid = e.dataTransfer?.getData('text/sb-week-uid');
      const targetDate = col.dataset.sbWeekDate;
      if (uid && targetDate) {
        moveTaskToScheduledDate(uid, targetDate);
        renderStripboard();
      }
    });
  });

  container.querySelectorAll('[data-sb-pick-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.stripboardDate = btn.dataset.sbPickDate;
      sketchState.stripboardViewMode = 'day';
      renderStripboard();
    });
  });
}

/**
 * Initialize Stripboard module and subscribe to store channels.
 */
export function initStripboard({ onOpenOt } = {}) {
  openOtCb = onOpenOt || null;
  if (initialized) return;
  initialized = true;

  const renderIfVisible = () => {
    const container = document.getElementById('view-stripboard');
    if (container && !container.classList.contains('hidden')) {
      renderStripboard();
    }
  };

  onSketchChange('orders', renderIfVisible);
  onSketchChange('stripboard', renderIfVisible);
  onSketchChange('clients', renderIfVisible);
  onSketchChange('settings', renderIfVisible);
}
