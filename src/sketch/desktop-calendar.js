/**
 * Cuadrantes de agenda del Escritorio:
 * - C01 Prioridades (Urgentes | Para Hoy | Para Mañana)
 * - C03 Calendario (Semana: Esta Semana + Semana Próxima | Mes)
 */

import { escapeHtml, getClientColor } from './store.js';
import { getWeekMonday } from './schedule-views.js';
import { renderOtRow, renderTaskRow } from './desktop-cards.js';

export const MONTH_NAMES_LOWER = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function getIsoMonday(iso) {
  const m = getWeekMonday(iso);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

function renderQ1Column({
  colKey,
  title,
  ots,
  tasks,
  q1Modes,
  rowOpts,
  borderClass,
  bgClass = '',
  accentBarClass = '',
  dotClass = '',
  titleClass = 'text-[#D4D4D4]',
  leadingHtml = '',
  trailingHtml = '',
  emptyOts,
  emptyTasks,
}) {
  const mode = q1Modes[colKey] || 'ots';
  const bodyHtml = mode === 'ots'
    ? (ots.length
        ? ots.map((ot) => renderOtRow(ot, colKey, { ...rowOpts, compact: false })).join('')
        : `<div class="flex-1 flex items-center justify-center text-[10px] font-mono text-[#5A5A5A]">${escapeHtml(emptyOts)}</div>`)
    : (tasks.length
        ? tasks.map((t) => renderTaskRow(t, colKey, { ...rowOpts, compact: false })).join('')
        : `<div class="flex-1 flex items-center justify-center text-[10px] font-mono text-[#5A5A5A]">${escapeHtml(emptyTasks)}</div>`);

  return `
    <div class="p-3 ${bgClass} ${accentBarClass} ${borderClass} flex flex-col min-h-0">
      <div class="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-obsidian-border/70 shrink-0">
        <span class="inline-flex items-center gap-1.5 min-w-0">
          ${leadingHtml}
          ${dotClass ? `<span class="w-1.5 h-1.5 rounded-full ${dotClass} shrink-0"></span>` : ''}
          <span class="font-mono text-[9.5px] ${titleClass} tracking-wider uppercase font-semibold truncate">${escapeHtml(title)}</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <div class="inline-flex items-center gap-0.5 text-[9px] font-mono shrink-0">
            <button type="button" data-dk-q1-col="${colKey}" data-dk-q1-mode="ots"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${mode === 'ots' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">OTs <span class="${mode === 'ots' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${ots.length}</span></button>
            <button type="button" data-dk-q1-col="${colKey}" data-dk-q1-mode="tasks"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${mode === 'tasks' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Tareas <span class="${mode === 'tasks' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${tasks.length}</span></button>
          </div>
          ${trailingHtml}
        </div>
      </div>
      <div data-dk-scroll-id="q1:${colKey}" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
        ${bodyHtml}
      </div>
    </div>
  `;
}

export function renderPrioritiesQuadrant({
  q1Modes,
  urgentOts,
  urgentTasks,
  todayOts,
  todayTasks,
  tomorrowOts,
  tomorrowTasks,
  todayKey,
  tomorrowKey,
  showWsTag,
  selectedCardKey,
  dragHandleHtml,
  rightActionBtns,
}) {
  const rowOpts = { todayKey, tomorrowKey, showWsTag, selectedCardKey };
  return `
    <div class="flex-1 grid grid-cols-1 md:grid-cols-3 min-h-0">
      ${renderQ1Column({
        colKey: 'urgent',
        title: 'Urgentes',
        ots: urgentOts,
        tasks: urgentTasks,
        q1Modes,
        rowOpts,
        bgClass: 'bg-rose-950/20',
        accentBarClass: 'border-t-2 border-t-rose-500/80',
        dotClass: 'bg-rose-400',
        titleClass: 'text-rose-300',
        borderClass: 'border-b md:border-b-0 md:border-r border-obsidian-border',
        emptyOts: 'Sin OTs urgentes',
        emptyTasks: 'Sin tareas urgentes',
        leadingHtml: dragHandleHtml,
      })}
      ${renderQ1Column({
        colKey: 'today',
        title: 'Para Hoy',
        ots: todayOts,
        tasks: todayTasks,
        q1Modes,
        rowOpts,
        bgClass: 'bg-amber-950/15',
        accentBarClass: 'border-t-2 border-t-amber-500/80',
        dotClass: 'bg-obsidian-amber',
        titleClass: 'text-amber-300',
        borderClass: 'border-b md:border-b-0 md:border-r border-obsidian-border',
        emptyOts: 'Sin OTs para hoy',
        emptyTasks: 'Sin tareas para hoy',
      })}
      ${renderQ1Column({
        colKey: 'tomorrow',
        title: 'Para Mañana',
        ots: tomorrowOts,
        tasks: tomorrowTasks,
        q1Modes,
        rowOpts,
        bgClass: 'bg-sky-950/15',
        accentBarClass: 'border-t-2 border-t-sky-500/75',
        dotClass: 'bg-sky-400',
        titleClass: 'text-sky-300',
        borderClass: '',
        emptyOts: 'Sin OTs para mañana',
        emptyTasks: 'Sin tareas para mañana',
        trailingHtml: rightActionBtns,
      })}
    </div>
  `;
}

function renderQ2ViewSwitch(q2ViewMode) {
  return `
    <div class="inline-flex items-center gap-0.5 text-[9px] font-mono shrink-0">
      <button type="button" data-dk-q2-view="week"
        class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${q2ViewMode === 'week' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Semana</button>
      <button type="button" data-dk-q2-view="month"
        class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${q2ViewMode === 'month' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Mes</button>
    </div>
  `;
}

function renderQ2MonthView({
  q2ViewMode,
  q2Modes,
  monthAnchorIso,
  todayKey,
  selectedCalendarDate,
  scopedOrders,
  allActiveTasks,
  selectedCardKey,
  borderClass = '',
  dragHandleHtml = '',
  collapseBtnHtml = '',
}) {
  const mode = q2Modes.month || 'ots';
  const year = Number(monthAnchorIso.slice(0, 4));
  const monthIdx = Number(monthAnchorIso.slice(5, 7)) - 1;
  const firstDay = new Date(year, monthIdx, 1, 12, 0, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIdx, 0).getDate();

  const cells = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, monthIdx - 1, prevMonthDays - i, 12, 0, 0);
    cells.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), inMonth: false });
  }
  for (let dNum = 1; dNum <= daysInMonth; dNum++) {
    const d = new Date(year, monthIdx, dNum, 12, 0, 0);
    cells.push({ iso: d.toISOString().slice(0, 10), num: dNum, inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const nextNum = cells.length - (startOffset + daysInMonth) + 1;
    const d = new Date(year, monthIdx + 1, nextNum, 12, 0, 0);
    cells.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), inMonth: false });
  }

  const monthName = MONTH_NAMES_LOWER[monthIdx] || '';
  const monthTitle = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} de ${year}`;
  const isCurrentMonth = monthAnchorIso.slice(0, 7) === todayKey.slice(0, 7);
  const dows = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  const cellItemsMap = new Map();
  let totalOts = 0;
  let totalTasks = 0;
  cells.forEach((c) => {
    const dayOts = scopedOrders.filter((o) => (o.deliveryDate || '').slice(0, 10) === c.iso);
    const dayTasks = allActiveTasks.filter((t) => (t.deliveryDate || '').slice(0, 10) === c.iso);
    if (c.inMonth) {
      totalOts += dayOts.length;
      totalTasks += dayTasks.length;
    }
    cellItemsMap.set(c.iso, { dayOts, dayTasks });
  });

  const numWeeks = Math.ceil(cells.length / 7);

  return `
    <div class="p-2.5 ${borderClass} flex flex-col min-h-0 flex-1">
      <div class="flex items-center justify-between gap-2 pb-1.5 mb-1.5 border-b border-obsidian-border/70 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">${escapeHtml(monthTitle)}</span>
          <div class="inline-flex items-center gap-0.5 bg-[#141414] border border-obsidian-border rounded-md p-0.5 shrink-0">
            <button type="button" data-dk-month-shift="-1" title="Mes anterior"
              class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer text-[10px] leading-none">‹</button>
            ${!isCurrentMonth ? `
              <button type="button" data-dk-month-reset="1" title="Volver al mes actual"
                class="px-1 h-4 rounded hover:bg-obsidian-elevated text-[8.5px] font-mono text-obsidian-amber cursor-pointer leading-none">Hoy</button>
            ` : ''}
            <button type="button" data-dk-month-shift="1" title="Mes siguiente"
              class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer text-[10px] leading-none">›</button>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${renderQ2ViewSwitch(q2ViewMode)}
          <span class="w-px h-3 bg-obsidian-border"></span>
          <div class="inline-flex items-center gap-0.5 text-[9px] font-mono shrink-0">
            <button type="button" data-dk-q2-row="month" data-dk-q2-mode="ots"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${mode === 'ots' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">OTs <span class="${mode === 'ots' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${totalOts}</span></button>
            <button type="button" data-dk-q2-row="month" data-dk-q2-mode="tasks"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${mode === 'tasks' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Tareas <span class="${mode === 'tasks' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${totalTasks}</span></button>
          </div>
          ${collapseBtnHtml}
        </div>
      </div>

      <div class="grid grid-cols-7 gap-1 mb-1 shrink-0">
        ${dows.map((d) => `<div class="text-center font-mono text-[8.5px] uppercase tracking-wider text-[#737373]">${d}</div>`).join('')}
      </div>

      <div class="flex-1 min-h-0 grid grid-cols-7 gap-1 overflow-hidden" style="grid-template-rows:repeat(${numWeeks}, minmax(0, 1fr))">
        ${cells.map((c) => {
          const { dayOts, dayTasks } = cellItemsMap.get(c.iso) || { dayOts: [], dayTasks: [] };
          const items = mode === 'ots' ? dayOts : dayTasks;
          const isToday = c.iso === todayKey;
          const isSelDay = c.iso === selectedCalendarDate;
          const cellCls = isToday
            ? 'border-obsidian-amber/70 bg-[#222222]'
            : (isSelDay
                ? 'border-[#525252] bg-[#202020]'
                : (c.inMonth ? 'border-obsidian-border/80 bg-[#1c1c1c]' : 'border-obsidian-border/40 bg-[#161616] opacity-55'));
          return `
            <div class="border ${cellCls} rounded-md p-1 flex flex-col gap-0.5 min-h-0 overflow-hidden">
              <div class="flex items-center justify-between text-[8.5px] font-mono shrink-0 leading-none">
                <span class="${isToday ? 'text-obsidian-amber font-bold' : (c.inMonth ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]')}">${c.num}${isToday ? ' (Hoy)' : ''}</span>
                ${items.length ? `<span class="text-[8px] text-[#737373]">${items.length}</span>` : ''}
              </div>
              <div data-dk-scroll-id="q2:month:${c.iso}" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5">
                ${items.map((it) => {
                  if (mode === 'ots') {
                    const shortCode = String(it.id || '').replace(/^OT-/i, '');
                    const cColor = getClientColor(it.client);
                    const key = `month:${c.iso}:ot:${it.id}`;
                    const isSel = selectedCardKey === key;
                    return `
                      <div data-desktop-select-ot="${escapeHtml(it.id)}" data-dk-key="${escapeHtml(key)}" title="${escapeHtml(`${shortCode} · ${it.client} — ${it.title}`)}"
                        class="px-1 py-0.5 rounded bg-[#242424] hover:bg-[#2c2c2c] border ${isSel ? 'border-obsidian-amber/80' : 'border-obsidian-border/60'} cursor-pointer flex items-center gap-1 min-w-0 leading-tight">
                        <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
                        <span class="font-mono text-[8px] text-obsidian-amber shrink-0">${escapeHtml(shortCode)}</span>
                        <span class="text-[8px] text-[#D4D4D4] truncate">${escapeHtml(it.title)}</span>
                      </div>
                    `;
                  }
                  const shortCode = `${String(it.otId || '').replace(/^OT-/i, '')}.${it.taskIndex + 1}`;
                  const cColor = getClientColor(it.client);
                  const key = `month:${c.iso}:task:${it.otId}:${it.taskIndex}`;
                  const isSel = selectedCardKey === key;
                  return `
                    <div data-desktop-select-task-ot="${escapeHtml(it.otId)}" data-desktop-select-task-idx="${it.taskIndex}" data-dk-key="${escapeHtml(key)}" title="${escapeHtml(`${shortCode} · ${it.client} — ${it.title}`)}"
                      class="px-1 py-0.5 rounded bg-[#242424] hover:bg-[#2c2c2c] border ${isSel ? 'border-obsidian-amber/80' : 'border-obsidian-border/60'} cursor-pointer flex items-center gap-1 min-w-0 leading-tight">
                      <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
                      <span class="font-mono text-[8px] text-obsidian-amber shrink-0">${escapeHtml(shortCode)}</span>
                      <span class="text-[8px] text-[#D4D4D4] truncate">${escapeHtml(it.title)}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderQ2WeekRow({
  rowKey,
  title,
  anchorIso,
  defaultNextWeekIso,
  q2ViewMode,
  q2Modes,
  todayKey,
  selectedCalendarDate,
  scopedOrders,
  allActiveTasks,
  rowOpts,
  borderClass,
  navigable = false,
  dragHandleHtml = '',
  collapseBtnHtml = '',
  showViewSwitch = false,
}) {
  const mode = q2Modes[rowKey] || 'ots';
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monday = getWeekMonday(anchorIso);
  const cols = dayNames.map((name, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    const iso = d.toISOString().slice(0, 10);
    const dayOts = scopedOrders.filter((o) => (o.deliveryDate || '').slice(0, 10) === iso);
    const dayTasks = allActiveTasks.filter((t) => (t.deliveryDate || '').slice(0, 10) === iso);
    return {
      name,
      iso,
      dayNum: iso.slice(8, 10),
      dayOts,
      dayTasks,
      isToday: iso === todayKey,
      isSelectedDay: iso === selectedCalendarDate,
    };
  });

  const totalOts = cols.reduce((s, c) => s + c.dayOts.length, 0);
  const totalTasks = cols.reduce((s, c) => s + c.dayTasks.length, 0);
  const mStart = MONTH_NAMES_LOWER[Number(cols[0].iso.slice(5, 7)) - 1] || '';
  const mEnd = MONTH_NAMES_LOWER[Number(cols[5].iso.slice(5, 7)) - 1] || '';
  const rangeTitle = mStart === mEnd
    ? `Semana del ${Number(cols[0].dayNum)} al ${Number(cols[5].dayNum)} de ${mEnd}`
    : `Semana del ${Number(cols[0].dayNum)} de ${mStart} al ${Number(cols[5].dayNum)} de ${mEnd}`;
  const headerTitle = navigable ? rangeTitle : `${title} · ${Number(cols[0].dayNum)}–${Number(cols[5].dayNum)} ${mEnd}`;
  const isDefaultNextWeek = getIsoMonday(anchorIso) === getIsoMonday(defaultNextWeekIso);

  return `
    <div class="p-2.5 ${borderClass} flex flex-col min-h-0">
      <div class="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-obsidian-border/70 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate" title="${escapeHtml(headerTitle)}">${escapeHtml(headerTitle)}</span>
          ${navigable ? `
            <div class="inline-flex items-center gap-0.5 bg-[#141414] border border-obsidian-border rounded-md p-0.5 shrink-0">
              <button type="button" data-dk-q2-shift="-7" title="Semana anterior"
                class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer text-[10px] leading-none">‹</button>
              ${!isDefaultNextWeek ? `
                <button type="button" data-dk-q2-reset="1" title="Volver a semana próxima"
                  class="px-1 h-4 rounded hover:bg-obsidian-elevated text-[8.5px] font-mono text-obsidian-amber cursor-pointer leading-none">Próx.</button>
              ` : ''}
              <button type="button" data-dk-q2-shift="7" title="Semana siguiente"
                class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer text-[10px] leading-none">›</button>
            </div>
          ` : ''}
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${showViewSwitch ? `${renderQ2ViewSwitch(q2ViewMode)}<span class="w-px h-3 bg-obsidian-border"></span>` : ''}
          <div class="inline-flex items-center gap-0.5 text-[9px] font-mono shrink-0">
            <button type="button" data-dk-q2-row="${rowKey}" data-dk-q2-mode="ots"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${mode === 'ots' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">OTs <span class="${mode === 'ots' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${totalOts}</span></button>
            <button type="button" data-dk-q2-row="${rowKey}" data-dk-q2-mode="tasks"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${mode === 'tasks' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Tareas <span class="${mode === 'tasks' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${totalTasks}</span></button>
          </div>
          ${collapseBtnHtml}
        </div>
      </div>
      <div class="flex-1 min-h-0 grid grid-cols-2 sm:grid-cols-6 gap-1.5 overflow-hidden">
        ${cols.map((c) => {
          const items = mode === 'ots' ? c.dayOts : c.dayTasks;
          const colBorder = c.isSelectedDay
            ? 'border-obsidian-amber/70 bg-[#222222]'
            : (c.isToday ? 'border-obsidian-amber/45 bg-[#202020]' : 'border-obsidian-border bg-[#1c1c1c]');
          return `
            <div class="border ${colBorder} rounded-lg p-1.5 flex flex-col gap-1 min-h-0 overflow-hidden">
              <div class="flex items-center justify-between text-[9px] font-mono pb-1 border-b border-obsidian-border/70 shrink-0">
                <span class="${c.isToday || c.isSelectedDay ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]'} truncate">${c.name} ${c.dayNum}${c.isToday ? ' (Hoy)' : ''}</span>
                <span class="text-[#5A5A5A]">${items.length}</span>
              </div>
              <div data-dk-scroll-id="q2:${rowKey}:${c.iso}" class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-0.5">
                ${items.length
                  ? (mode === 'ots'
                      ? items.map((ot) => renderOtRow(ot, `${rowKey}:${c.iso}`, { ...rowOpts, compact: true })).join('')
                      : items.map((t) => renderTaskRow(t, `${rowKey}:${c.iso}`, { ...rowOpts, compact: true })).join(''))
                  : `<div class="flex-1 flex items-center justify-center text-[8.5px] font-mono text-[#3f3f3f]">—</div>`
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

export function renderCalendarQuadrant({
  q2ViewMode,
  q2Modes,
  monthAnchorIso,
  todayKey,
  tomorrowKey,
  nextWeekAnchor,
  defaultNextWeekIso,
  selectedCalendarDate,
  scopedOrders,
  allActiveTasks,
  showWsTag,
  selectedCardKey,
  dragHandleHtml,
  rightActionBtns,
}) {
  if (q2ViewMode === 'month') {
    return renderQ2MonthView({
      q2ViewMode,
      q2Modes,
      monthAnchorIso,
      todayKey,
      selectedCalendarDate,
      scopedOrders,
      allActiveTasks,
      selectedCardKey,
      borderClass: 'border-t-2 border-t-emerald-500/70',
      dragHandleHtml,
      collapseBtnHtml: rightActionBtns,
    });
  }

  const rowOpts = { todayKey, tomorrowKey, showWsTag, selectedCardKey };
  return `
    <div class="flex-1 grid grid-rows-2 min-h-0">
      ${renderQ2WeekRow({
        rowKey: 'thisWeek',
        title: 'Esta Semana',
        anchorIso: todayKey,
        defaultNextWeekIso,
        q2ViewMode,
        q2Modes,
        todayKey,
        selectedCalendarDate,
        scopedOrders,
        allActiveTasks,
        rowOpts,
        borderClass: 'border-t-2 border-t-emerald-500/70 border-b border-obsidian-border',
        dragHandleHtml,
        collapseBtnHtml: rightActionBtns,
        showViewSwitch: true,
      })}
      ${renderQ2WeekRow({
        rowKey: 'nextWeek',
        title: 'Semana Próxima',
        anchorIso: nextWeekAnchor,
        defaultNextWeekIso,
        q2ViewMode,
        q2Modes,
        todayKey,
        selectedCalendarDate,
        scopedOrders,
        allActiveTasks,
        rowOpts,
        borderClass: '',
        navigable: true,
      })}
    </div>
  `;
}
