/**
 * Mis Tareas / Stripboard (#view-stripboard): Lista, Día, Semana, Gantt, Mes + Drag & Drop.
 */

import {
  escapeHtml,
  formatShortDate,
  getClientColor,
  notifySketchChange,
  onSketchChange,
  relDate,
  shiftIsoDate,
  sketchState,
  studioSettings,
  trafficOrders,
  trafficStatuses,
  ensureOtData
} from './store.js';

let initialized = false;
let openOtCb = null;

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
          taskIndex: idx,
          client: ot.client,
          brand: ot.brand,
          product: ot.product,
          title: st.title,
          deliveryDate: deliv,
          scheduledDate: (st.scheduledDate || deliv || '').slice(0, 10),
          estimatedHours: Number(st.estimatedHours ?? 3) || 0,
          status: st.status || ot.status,
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

  if (String(uid).startsWith('free-')) {
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
 * Group visible strips by client, status, or deliveryDate when stripboardGroupBy !== 'none'.
 */
function buildStripGroups(visibleStrips, groupBy) {
  const groupsMap = new Map();
  visibleStrips.forEach((s) => {
    let key = '';
    let label = '';
    let color = null;
    if (groupBy === 'client') {
      key = s.client || 'Interno';
      label = key;
      color = getClientColor(s.client);
    } else if (groupBy === 'status') {
      key = s.status || 'Sin estado';
      label = key;
    } else if (groupBy === 'deliveryDate') {
      const isoDay = (s.deliveryDate || '').slice(0, 10);
      key = isoDay || 'Sin fecha';
      label = isoDay ? `${isoDay.slice(8, 10)}/${isoDay.slice(5, 7)}/${isoDay.slice(0, 4)}` : 'Sin fecha';
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
  if (s.type === 'break') {
    return `
      <tr draggable="true" data-sb-idx="${idx}" class="sb-strip-row bg-[#2a2419] border-y border-amber-500/30 text-[10px] text-obsidian-amber cursor-grab active:cursor-grabbing">
        <td class="px-2 py-1.5 text-center font-mono text-[#8C8C8C]">≡</td>
        <td colspan="8" class="px-2 py-1.5 font-mono uppercase tracking-[0.12em] font-semibold">${escapeHtml(s.title)}</td>
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

  return `
    <tr draggable="true" data-sb-idx="${idx}" data-sb-ot="${escapeHtml(s.otId || '')}" data-sb-task="${s.taskIndex !== undefined ? s.taskIndex : ''}" class="sb-strip-row ${zebra} ${firstCross ? 'border-t-2 border-t-rose-500/80' : ''} hover:bg-obsidian-elevated/70 transition-colors cursor-grab active:cursor-grabbing">
      <td class="px-2 py-1.5 border-r border-obsidian-border text-center font-mono text-[#8C8C8C]">${visIdx + 1}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border">
        <span class="font-mono font-semibold text-obsidian-amber px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border whitespace-nowrap block text-center">${escapeHtml(s.code || 'LIBRE')}</span>
      </td>
      <td class="px-2 py-1.5 border-r border-obsidian-border truncate">
        <span class="inline-flex items-center gap-1.5 max-w-full">
          <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
          <span class="truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(s.client || 'Interno')}</span>
        </span>
      </td>
      <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C] truncate">${escapeHtml(s.brand || '—')}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border text-[#D4D4D4] font-medium">${escapeHtml(s.title)}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-center ${isOverRow ? 'bg-rose-500/10 text-rose-300 font-semibold' : 'text-obsidian-amber'}">${hrs}h${sketchState.stripboardViewMode === 'day' ? ` <span class="text-[9px] text-[#8C8C8C]">(${runningHoursRef.total}h)</span>` : ''}</td>
      <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-[#8C8C8C] text-center">${escapeHtml(formatShortDate(s.deliveryDate) || 'Hoy')}</td>
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
        sketchState.stripboardStatusFilter === 'all' &&
        !sketchState.stripboardSearch.trim() &&
        sketchState.stripboardGroupBy === 'none' &&
        sketchState.stripboardSortBy === 'manual'
      );
    }
    if (trafficFilter.type === 'client' && item.client !== trafficFilter.client) return false;
    if (trafficFilter.type === 'brand' && (item.client !== trafficFilter.client || item.brand !== trafficFilter.brand)) return false;
    if (sketchState.stripboardStatusFilter !== 'all' && item.status !== sketchState.stripboardStatusFilter) return false;
    if (sketchState.stripboardSearch.trim()) {
      const q = sketchState.stripboardSearch.trim().toLowerCase();
      if (![item.code, item.client, item.brand, item.title, item.status, item.notes].some((v) => String(v || '').toLowerCase().includes(q))) {
        return false;
      }
    }
    return true;
  };

  const allPool = getAllMyTaskPool();
  const strips = sketchState.stripboardViewMode === 'list'
    ? ensureStripboardListSeeded()
    : ensureStripboardDaySeeded(sketchState.stripboardDate);

  const visibleStrips = strips.filter(matchesTrafficFilter);
  if (sketchState.stripboardSortBy === 'delivery-asc') {
    visibleStrips.sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  } else if (sketchState.stripboardSortBy === 'delivery-desc') {
    visibleStrips.sort((a, b) => (b.deliveryDate || '').localeCompare(a.deliveryDate || ''));
  } else if (sketchState.stripboardSortBy === 'code') {
    visibleStrips.sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  }

  const taskStrips = visibleStrips.filter((s) => s.type !== 'break');
  const activeCount = taskStrips.filter((s) => s.status !== 'Entregado').length;
  const doneCount = taskStrips.filter((s) => s.status === 'Entregado').length;
  const dayReservedHours = getDayReservedHours(sketchState.stripboardDate);
  const dayOverloaded = dayReservedHours > dailyHours;

  let mainContentHtml = '';
  if (sketchState.stripboardViewMode === 'list' || sketchState.stripboardViewMode === 'day') {
    const runningHoursRef = { total: 0, crossed: false };
    let tbodyHtml = '';

    if (!visibleStrips.length) {
      tbodyHtml = '<tr><td colspan="10" class="p-8 text-center text-[11px] text-[#8C8C8C]">Sin tiras programadas para este filtro o día.</td></tr>';
    } else if (sketchState.stripboardGroupBy !== 'none') {
      const groups = buildStripGroups(visibleStrips, sketchState.stripboardGroupBy);
      let visCounter = 0;
      tbodyHtml = groups.map((grp) => {
        const groupHours = grp.items.reduce((sum, s) => sum + (Number(s.estimatedHours) || 0), 0);
        const headerRow = `
          <tr class="bg-[#191919] border-y border-obsidian-border text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8C8C8C] select-none">
            <td colspan="10" class="px-2.5 py-1.5">
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-[#D4D4D4]">
                  ${grp.color ? `<span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(grp.color)}"></span>` : ''}
                  <span>${escapeHtml(grp.label)}</span>
                </span>
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

    mainContentHtml = `
      <div class="flex-1 overflow-auto border border-obsidian-border rounded-xl bg-[#202020]">
        <table class="w-full text-left text-[10.5px] border-collapse">
          <thead>
            <tr class="bg-[#191919] border-b border-obsidian-border text-[9.5px] text-[#8C8C8C] uppercase tracking-wider select-none">
              <th class="px-2 py-1.5 border-r border-obsidian-border w-8 text-center">#</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24">Código</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-32">Cliente</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-28">Marca</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border">Tarea</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-20 text-center">Horas</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24 text-center">Entrega</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24">Estado</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-36">Notas</th>
              <th class="px-2 py-1.5 w-8 text-center"></th>
            </tr>
          </thead>
          <tbody id="sb-day-tbody" class="divide-y divide-obsidian-border">
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;
  } else if (sketchState.stripboardViewMode === 'week') {
    const base = new Date(`${sketchState.stripboardDate}T12:00:00`);
    const day = base.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(base);
    monday.setDate(base.getDate() + diffToMon);
    const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const cols = dayNames.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const dayStrips = ensureStripboardDaySeeded(iso).filter((s) => s.type !== 'break' && matchesTrafficFilter(s));
      const reservedHours = getDayReservedHours(iso);
      return { name, iso, label: `${name} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`, items: dayStrips, reservedHours, isOver: reservedHours > dailyHours };
    });

    mainContentHtml = `
      <div class="flex-1 grid grid-cols-2 lg:grid-cols-6 gap-2 overflow-auto">
        ${cols.map((c) => `
          <div data-sb-week-date="${c.iso}" class="sb-week-col bg-[#202020] border ${c.isOver ? 'border-rose-500/60 bg-rose-500/5' : (c.iso === sketchState.stripboardDate ? 'border-obsidian-amber/50' : 'border-obsidian-border')} rounded-xl p-2 flex flex-col gap-2 min-h-[260px] transition-colors">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-wider pb-1 border-b border-obsidian-border">
              <span class="${c.iso === sketchState.stripboardDate ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]'}">${c.label}</span>
              <span class="font-mono px-1.5 py-0.5 rounded ${c.isOver ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-[#8C8C8C]'}">${c.reservedHours}h / ${dailyHours}h</span>
            </div>
            <div class="flex flex-col gap-1.5 flex-1">
              ${c.items.map((item) => `
                <div draggable="true" data-sb-uid="${escapeHtml(item.uid || '')}" data-sb-ot="${escapeHtml(item.otId || '')}" data-sb-task="${item.taskIndex !== undefined ? item.taskIndex : ''}" class="sb-open-trigger sb-week-card bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border rounded-lg p-2 space-y-1 cursor-grab active:cursor-grabbing transition-colors">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-mono text-[9.5px] text-obsidian-amber">${escapeHtml(item.code || 'LIBRE')}</span>
                    <span class="font-mono text-[9px] text-[#8C8C8C] bg-[#202020] px-1 py-0.5 rounded">${Number(item.estimatedHours ?? 3) || 0}h</span>
                  </div>
                  <div class="text-[11px] text-[#D4D4D4] leading-snug line-clamp-2">${escapeHtml(item.title)}</div>
                  <div class="text-[9.5px] text-[#8C8C8C] truncate">${escapeHtml(item.client || 'Interno')}</div>
                </div>
              `).join('') || '<div class="text-[10px] text-[#5a6169] text-center py-4">Sin tiras</div>'}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } else if (sketchState.stripboardViewMode === 'gantt') {
    const rows = taskStrips.length ? taskStrips : allPool.slice(0, 5);
    mainContentHtml = `
      <div class="flex-1 border border-obsidian-border rounded-xl bg-[#202020] p-3 overflow-auto space-y-2">
        <div class="grid grid-cols-12 text-[9.5px] uppercase tracking-wider text-[#8C8C8C] pb-1.5 border-b border-obsidian-border">
          <div class="col-span-4">Tarea / OT</div>
          <div class="col-span-8 grid grid-cols-6 text-center"><span>Lun</span><span>Mar</span><span>Mié</span><span>Jue</span><span>Vie</span><span>Sáb</span></div>
        </div>
        ${rows.map((r, i) => {
          const startCol = (i % 3) + 1;
          const span = Math.min(4, 7 - startCol);
          const cColor = getClientColor(r.client);
          return `
            <div class="grid grid-cols-12 items-center gap-2 py-1 text-[10.5px]">
              <div class="col-span-4 truncate flex items-center gap-1.5">
                <span class="font-mono text-[9.5px] text-obsidian-amber shrink-0">${escapeHtml(r.code || 'LIBRE')}</span>
                <span class="truncate text-[#D4D4D4]">${escapeHtml(r.title)}</span>
              </div>
              <div class="col-span-8 grid grid-cols-6 gap-1 items-center bg-[#191919] rounded-md p-1">
                <div style="grid-column: ${startCol} / span ${span}; background: ${escapeHtml(cColor)}33; border-color: ${escapeHtml(cColor)};" class="border rounded px-2 py-0.5 text-[9.5px] text-[#D4D4D4] truncate">
                  ${escapeHtml(r.client || 'Interno')} · ${escapeHtml(r.status)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else {
    const year = Number(sketchState.stripboardDate.slice(0, 4));
    const month = Number(sketchState.stripboardDate.slice(5, 7)) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Array.from({ length: daysInMonth }, (_, i) => {
      const dNum = i + 1;
      const iso = `${sketchState.stripboardDate.slice(0, 8)}${String(dNum).padStart(2, '0')}`;
      const dayTasks = ensureStripboardDaySeeded(iso).filter((s) => s.type !== 'break' && matchesTrafficFilter(s));
      return { dNum, iso, dayTasks };
    });

    mainContentHtml = `
      <div class="flex-1 grid grid-cols-7 gap-1.5 overflow-auto">
        ${cells.map((c) => `
          <button type="button" data-sb-pick-date="${c.iso}" class="bg-[#202020] hover:bg-obsidian-elevated border ${c.iso === sketchState.stripboardDate ? 'border-obsidian-amber' : 'border-obsidian-border'} rounded-lg p-2 flex flex-col gap-1 min-h-[82px] text-left cursor-pointer transition-colors">
            <div class="flex items-center justify-between w-full">
              <span class="font-mono text-[10px] ${c.iso === sketchState.stripboardDate ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]'}">${c.dNum}</span>
              ${c.dayTasks.length ? `<span class="text-[9px] font-mono text-[#8C8C8C]">${c.dayTasks.length}</span>` : ''}
            </div>
            <div class="flex flex-col gap-0.5 w-full">
              ${c.dayTasks.slice(0, 3).map((t) => `<span class="text-[9px] font-mono text-obsidian-amber bg-[#191919] px-1 py-0.5 rounded truncate">${escapeHtml(t.code || 'LIBRE')}</span>`).join('')}
              ${c.dayTasks.length > 3 ? `<span class="text-[9px] font-mono text-[#8C8C8C]">+${c.dayTasks.length - 3} más</span>` : ''}
            </div>
          </button>
        `).join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <!-- Toolbar Stripboard -->
    <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-obsidian-border shrink-0">
      <div class="flex items-center gap-1">
        <button type="button" id="sb-prev-day" class="w-6 h-6 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">
          <span data-icon="chevron-left" data-icon-size="w-3 h-3"></span>
        </button>
        <input type="date" id="sb-date-input" value="${sketchState.stripboardDate}" style="color-scheme: dark;" class="h-6 bg-[#191919] border border-obsidian-border rounded-md px-2 text-[11px] text-[#D4D4D4] focus:outline-none cursor-pointer" />
        <button type="button" id="sb-today-btn" class="h-6 px-2 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[11px] text-[#D4D4D4] cursor-pointer">Hoy</button>
        <button type="button" id="sb-next-day" class="w-6 h-6 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">
          <span data-icon="chevron-right" data-icon-size="w-3 h-3"></span>
        </button>
      </div>

      <div class="inline-flex items-center bg-[#191919] border border-obsidian-border rounded-lg p-0.5 text-[10.5px]">
        ${[['list', 'Lista'], ['day', 'Día'], ['week', 'Semana'], ['gantt', 'Gantt'], ['month', 'Mes']].map(([mode, lbl]) => `
          <button type="button" data-sb-mode="${mode}" class="px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${sketchState.stripboardViewMode === mode ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">${lbl}</button>
        `).join('')}
      </div>

      <div class="flex items-center gap-2 text-[10.5px] text-[#8C8C8C]">
        <span class="hidden xl:inline">Tareas: <strong class="text-[#D4D4D4] font-mono">${taskStrips.length}</strong></span>
        <span class="hidden xl:inline">·</span>
        <span class="hidden xl:inline">En Mesa: <strong class="text-obsidian-amber font-mono">${activeCount}</strong></span>
        <span class="hidden xl:inline">·</span>
        <span class="hidden xl:inline">Entregadas: <strong class="text-emerald-400 font-mono">${doneCount}</strong></span>
        <span class="hidden xl:inline">·</span>
        <span class="px-1.5 py-0.5 rounded border font-mono ${dayOverloaded ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 font-semibold' : 'bg-[#191919] border-obsidian-border text-[#D4D4D4]'}">
          Día: ${dayReservedHours}h / ${dailyHours}h${dayOverloaded ? ' · Sobrecarga' : ''}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <div class="relative flex items-center">
          <span data-icon="search" data-icon-size="w-3 h-3" class="text-[#8C8C8C] absolute left-2 pointer-events-none"></span>
          <input type="text" id="sb-search-input" value="${escapeHtml(sketchState.stripboardSearch)}" placeholder="Buscar..." class="h-6 w-28 focus:w-40 bg-[#191919] border border-obsidian-border rounded-md pl-6 pr-2 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none transition-all" />
        </div>
        <select id="sb-status-filter" class="h-6 bg-[#191919] border border-obsidian-border rounded-md px-1.5 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
          <option value="all" ${sketchState.stripboardStatusFilter === 'all' ? 'selected' : ''}>Estado: Todos</option>
          ${trafficStatuses.map((st) => `<option value="${escapeHtml(st)}" ${sketchState.stripboardStatusFilter === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
        </select>
        <select id="sb-group-by" class="h-6 bg-[#191919] border border-obsidian-border rounded-md px-1.5 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
          <option value="none" ${sketchState.stripboardGroupBy === 'none' ? 'selected' : ''}>Sin agrupar</option>
          <option value="client" ${sketchState.stripboardGroupBy === 'client' ? 'selected' : ''}>Agrupar: Cliente</option>
          <option value="status" ${sketchState.stripboardGroupBy === 'status' ? 'selected' : ''}>Agrupar: Estado</option>
          <option value="deliveryDate" ${sketchState.stripboardGroupBy === 'deliveryDate' ? 'selected' : ''}>Agrupar: Entrega</option>
        </select>
        <select id="sb-sort-by" class="h-6 bg-[#191919] border border-obsidian-border rounded-md px-1.5 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
          <option value="manual" ${sketchState.stripboardSortBy === 'manual' ? 'selected' : ''}>Orden: Manual</option>
          <option value="delivery-asc" ${sketchState.stripboardSortBy === 'delivery-asc' ? 'selected' : ''}>Entrega: Próximas</option>
          <option value="delivery-desc" ${sketchState.stripboardSortBy === 'delivery-desc' ? 'selected' : ''}>Entrega: Lejanas</option>
          <option value="code" ${sketchState.stripboardSortBy === 'code' ? 'selected' : ''}>Orden: Código</option>
        </select>
        <button type="button" id="sb-add-break" class="h-6 px-2 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">+ Separador</button>
        <button type="button" id="sb-add-free" class="h-6 px-2 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">+ Tarea Libre</button>
      </div>
    </div>

    <!-- Cuerpo: Tablero Stripboard a ancho completo -->
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
      ${mainContentHtml}
    </div>
  `;

  if (window.hydrateIcons) window.hydrateIcons(container);

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

  container.querySelector('#sb-status-filter')?.addEventListener('change', (e) => {
    sketchState.stripboardStatusFilter = e.target.value;
    renderStripboard();
  });
  container.querySelector('#sb-group-by')?.addEventListener('change', (e) => {
    sketchState.stripboardGroupBy = e.target.value;
    renderStripboard();
  });
  container.querySelector('#sb-sort-by')?.addEventListener('change', (e) => {
    sketchState.stripboardSortBy = e.target.value;
    renderStripboard();
  });

  container.querySelector('#sb-prev-day')?.addEventListener('click', () => {
    sketchState.stripboardDate = shiftIsoDate(sketchState.stripboardDate, -1);
    renderStripboard();
  });
  container.querySelector('#sb-next-day')?.addEventListener('click', () => {
    sketchState.stripboardDate = shiftIsoDate(sketchState.stripboardDate, 1);
    renderStripboard();
  });
  container.querySelector('#sb-today-btn')?.addEventListener('click', () => {
    sketchState.stripboardDate = relDate(0).slice(0, 10);
    renderStripboard();
  });
  container.querySelector('#sb-date-input')?.addEventListener('change', (e) => {
    if (e.target.value) {
      sketchState.stripboardDate = e.target.value;
      renderStripboard();
    }
  });

  container.querySelectorAll('[data-sb-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.stripboardViewMode = btn.dataset.sbMode;
      renderStripboard();
    });
  });

  container.querySelector('#sb-load-pending')?.addEventListener('click', () => {
    const existing = new Set(strips.map((s) => s.uid));
    allPool.forEach((t) => {
      if (!existing.has(t.uid)) strips.push({ ...t });
    });
    renderStripboard();
  });

  container.querySelector('#sb-add-break')?.addEventListener('click', () => {
    strips.push({ uid: `sep-${Date.now()}`, type: 'break', title: 'CORTE / REUNIÓN · 15 MIN' });
    renderStripboard();
  });

  container.querySelector('#sb-add-free')?.addEventListener('click', () => {
    strips.push({
      uid: `free-${Date.now()}`,
      type: 'task',
      code: 'LIBRE',
      client: 'Estudio',
      brand: 'Interno',
      title: 'Revisión rápida de entregables',
      deliveryDate: `${sketchState.stripboardDate}T18:00:00`,
      scheduledDate: sketchState.stripboardDate,
      estimatedHours: 2,
      status: 'Desarrollo',
      notes: ''
    });
    renderStripboard();
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

  const openOtFromStrip = (otId, tIdx) => {
    if (!otId) return;
    sketchState.myOtsScope = 'traffic-open';
    sketchState.activeMyOtId = otId;
    sketchState.activeTaskIndex = tIdx !== '' ? Number(tIdx) : null;
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
      openOtFromStrip(row.dataset.sbOt, row.dataset.sbTask);
    });
  });

  container.querySelectorAll('.sb-open-trigger').forEach((card) => {
    card.addEventListener('click', () => {
      openOtFromStrip(card.dataset.sbOt, card.dataset.sbTask);
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
