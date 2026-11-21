/**
 * Shared temporal schedule views (Día, Semana, Gantt, Mes) reused by Tráfico and Stripboard.
 */

import { escapeHtml, formatShortDate, getClientColor, getDepartmentColor, getPriorityDotHtml, getStageColor, getStatusColor, relDate } from './store.js';

/**
 * Compute Monday Date object for the week containing `anchorIso` (YYYY-MM-DD).
 */
export function getWeekMonday(anchorIso) {
  const base = new Date(`${anchorIso}T12:00:00`);
  const day = base.getDay();
  const diffToMon = day === 0 ? -6 : 1 - day;
  const monday = new Date(base);
  monday.setDate(base.getDate() + diffToMon);
  return monday;
}

/**
 * Shift an ISO date (YYYY-MM-DD) by day, week, or month depending on the active schedule view and Gantt scale.
 */
export function shiftScheduleDate(anchorIso, viewMode, direction, ganttScale = 'week') {
  const dir = direction < 0 ? -1 : 1;
  const isMonth = viewMode === 'month' || (viewMode === 'gantt' && ganttScale === 'month');
  if (isMonth) {
    const year = Number(anchorIso.slice(0, 4));
    const month = Number(anchorIso.slice(5, 7)) - 1;
    const day = Number(anchorIso.slice(8, 10));
    const targetMonthStart = new Date(year, month + dir, 1, 12, 0, 0);
    const maxDay = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 0).getDate();
    targetMonthStart.setDate(Math.min(day, maxDay));
    return targetMonthStart.toISOString().slice(0, 10);
  }
  const isWeek = viewMode === 'week' || viewMode === 'gantt';
  const d = new Date(`${anchorIso}T12:00:00`);
  d.setDate(d.getDate() + dir * (isWeek ? 7 : 1));
  return d.toISOString().slice(0, 10);
}

const MONTH_NAMES_LOWER = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MONTH_NAMES_CAP = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAY_NAMES_FULL = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function formatLongDayHeading(anchorDate) {
  const year = Number(anchorDate.slice(0, 4));
  const monthIdx = Number(anchorDate.slice(5, 7)) - 1;
  const dayNum = Number(anchorDate.slice(8, 10));
  const title = `${dayNum} de ${MONTH_NAMES_LOWER[monthIdx] || ''} de ${year}`;

  const dObj = new Date(`${anchorDate}T12:00:00`);
  const dow = Number.isNaN(dObj.getTime()) ? '' : WEEKDAY_NAMES_FULL[dObj.getDay()];
  const todayIso = relDate(0).slice(0, 10);
  const tomorrowIso = relDate(1).slice(0, 10);
  const yesterdayIso = relDate(-1).slice(0, 10);
  const rel = anchorDate === todayIso
    ? 'Hoy'
    : (anchorDate === tomorrowIso ? 'Mañana' : (anchorDate === yesterdayIso ? 'Ayer' : ''));
  const subtitle = rel ? `${dow} · ${rel}` : dow;
  const centerLabel = rel || 'Hoy';
  return { title, subtitle, centerLabel };
}

export function renderScheduleNavHeader(title, prevTitle, nextTitle, { subtitle = '', extraRightHtml = '', centerLabel = 'Hoy' } = {}) {
  return `
    <div class="flex items-center justify-between gap-3 px-1 pb-1 shrink-0">
      <div class="min-w-0">
        <div class="text-[15px] font-semibold text-[#D4D4D4] leading-tight truncate">${escapeHtml(title)}</div>
        ${subtitle ? `<div class="text-[11px] text-[#8C8C8C] leading-tight mt-0.5">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <div class="flex items-center gap-2 shrink-0">
        ${extraRightHtml}
        <div class="inline-flex items-center gap-0.5 bg-[#191919] border border-obsidian-border rounded-lg p-0.5">
          <button type="button" data-sched-nav="-1" title="${escapeHtml(prevTitle)}" class="w-6 h-6 rounded-md hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer transition-colors">
            <span data-icon="chevron-left" data-icon-size="w-3 h-3"></span>
          </button>
          <button type="button" data-sched-today="1" title="Ir a hoy" class="h-6 px-2.5 rounded-md hover:bg-obsidian-elevated text-[10.5px] font-medium text-[#D4D4D4] cursor-pointer transition-colors">Hoy</button>
          <button type="button" data-sched-nav="1" title="${escapeHtml(nextTitle)}" class="w-6 h-6 rounded-md hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer transition-colors">
            <span data-icon="chevron-right" data-icon-size="w-3 h-3"></span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render an interactive Apple Calendar-style monthly mini-calendar in the right Inspector (#right-body).
 */
export function renderInspectorMiniCalendar({ anchorDate, busyDates = new Set(), onSelectDate }) {
  const rightBody = document.getElementById('right-body');
  if (!rightBody) return;

  let viewYear = Number(anchorDate.slice(0, 4));
  let viewMonth = Number(anchorDate.slice(5, 7)) - 1;
  const todayIso = relDate(0).slice(0, 10);

  const draw = () => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1, 12, 0, 0);
    const startDow = firstOfMonth.getDay(); // 0 = Sun
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();

    const gridCells = [];
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthDays - i, 12, 0, 0);
      gridCells.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), inMonth: false });
    }
    for (let dNum = 1; dNum <= daysInMonth; dNum++) {
      const d = new Date(viewYear, viewMonth, dNum, 12, 0, 0);
      gridCells.push({ iso: d.toISOString().slice(0, 10), num: dNum, inMonth: true });
    }
    while (gridCells.length % 7 !== 0) {
      const nextNum = gridCells.length - (startDow + daysInMonth) + 1;
      const d = new Date(viewYear, viewMonth + 1, nextNum, 12, 0, 0);
      gridCells.push({ iso: d.toISOString().slice(0, 10), num: d.getDate(), inMonth: false });
    }

    const monthTitle = `${MONTH_NAMES_LOWER[viewMonth] || ''} de ${viewYear}`;
    const dows = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

    let calSlot = rightBody.querySelector('#insp-cal-slot');
    if (!calSlot) {
      rightBody.innerHTML = `<div id="insp-cal-slot" class="pb-3 mb-3 border-b border-obsidian-border"></div><div id="insp-content-slot"></div>`;
      calSlot = rightBody.querySelector('#insp-cal-slot');
    }

    calSlot.innerHTML = `
      <div id="insp-mini-cal" class="space-y-2.5 text-[11px] select-none">
        <div class="flex items-center justify-between gap-1">
          <button type="button" data-mcal-shift="-1" title="Mes anterior" class="w-5 h-5 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">
            <span data-icon="chevron-left" data-icon-size="w-3 h-3"></span>
          </button>
          <span class="text-[11px] font-medium text-[#D4D4D4] capitalize">${escapeHtml(monthTitle)}</span>
          <button type="button" data-mcal-shift="1" title="Mes siguiente" class="w-5 h-5 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">
            <span data-icon="chevron-right" data-icon-size="w-3 h-3"></span>
          </button>
        </div>
        <div class="grid grid-cols-7 gap-y-1 text-center">
          ${dows.map((lbl) => `<span class="text-[9px] text-[#737373] font-medium">${lbl}</span>`).join('')}
          ${gridCells.map((c) => {
            const isSel = c.iso === anchorDate;
            const isToday = c.iso === todayIso;
            const hasItems = busyDates.has(c.iso);
            const btnCls = isSel
              ? 'bg-[#D4D4D4] text-[#191919] font-semibold'
              : (isToday
                ? 'bg-rose-500/85 text-white font-semibold'
                : (c.inMonth ? 'text-[#D4D4D4] hover:bg-obsidian-elevated' : 'text-[#525252] hover:bg-obsidian-elevated/50'));
            return `
              <button type="button" data-mcal-pick="${c.iso}" class="relative mx-auto w-6 h-6 rounded-full text-[10px] font-mono flex items-center justify-center cursor-pointer transition-colors ${btnCls}">
                <span>${c.num}</span>
                ${hasItems && !isSel && !isToday ? '<span class="w-1 h-1 rounded-full bg-obsidian-amber absolute bottom-0.5"></span>' : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
    if (window.hydrateIcons) window.hydrateIcons(calSlot);

    calSlot.querySelectorAll('[data-mcal-shift]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const delta = Number(btn.dataset.mcalShift || 0);
        const next = new Date(viewYear, viewMonth + delta, 1, 12, 0, 0);
        viewYear = next.getFullYear();
        viewMonth = next.getMonth();
        draw();
      });
    });

    calSlot.querySelectorAll('[data-mcal-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const iso = btn.dataset.mcalPick;
        if (iso && onSelectDate) onSelectDate(iso);
      });
    });
  };

  draw();
}

/**
 * Bind prev/next calendar navigation arrows (`[data-sched-nav]`) and optional Hoy button (`[data-sched-today]`).
 */
export function bindScheduleNavEvents(container, onStep, onToday) {
  if (!container) return;
  container.querySelectorAll('[data-sched-nav]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const dir = Number(btn.dataset.schedNav || 0);
      if (dir && onStep) onStep(dir);
    });
  });
  container.querySelectorAll('[data-sched-today]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onToday) onToday();
    });
  });
}

/**
 * Render the 6-column Week (Lun–Sáb) view shared by Stripboard and Tráfico.
 */
export function renderWeekScheduleHtml({
  anchorDate,
  getDayItems,
  dailyHours = 8,
  showHoursBadge = true,
  draggableCards = false,
  emptyColText = 'Sin entregas',
}) {
  const dayNames = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monday = getWeekMonday(anchorDate);
  const cols = dayNames.map((name, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const items = getDayItems(iso) || [];
    const reservedHours = items.reduce(
      (sum, s) => sum + (s.type === 'break' ? 0 : (Number(s.estimatedHours ?? 3) || 0)),
      0
    );
    return {
      name,
      iso,
      label: `${name} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      items,
      reservedHours,
      isOver: showHoursBadge && reservedHours > dailyHours,
    };
  });

  const startMonth = MONTH_NAMES_LOWER[Number(cols[0].iso.slice(5, 7)) - 1] || '';
  const endMonth = MONTH_NAMES_LOWER[Number(cols[5].iso.slice(5, 7)) - 1] || '';
  const weekLabel = startMonth === endMonth
    ? `${Number(cols[0].iso.slice(8, 10))} – ${Number(cols[5].iso.slice(8, 10))} de ${endMonth} de ${cols[5].iso.slice(0, 4)}`
    : `${Number(cols[0].iso.slice(8, 10))} de ${startMonth} – ${Number(cols[5].iso.slice(8, 10))} de ${endMonth} de ${cols[5].iso.slice(0, 4)}`;

  return `
    <div class="flex-1 flex flex-col gap-2 overflow-hidden">
      ${renderScheduleNavHeader(weekLabel, 'Semana anterior', 'Semana siguiente')}
      <div class="flex-1 grid grid-cols-2 lg:grid-cols-6 gap-2 overflow-auto">
        ${cols.map((c) => `
          <div data-sb-week-date="${c.iso}" class="sb-week-col bg-[#202020] border ${c.isOver ? 'border-rose-500/60 bg-rose-500/5' : (c.iso === anchorDate ? 'border-obsidian-amber/50' : 'border-obsidian-border')} rounded-xl p-2 flex flex-col gap-2 min-h-[260px] transition-colors">
            <div class="flex items-center justify-between text-[10px] uppercase tracking-wider pb-1 border-b border-obsidian-border">
              <span class="${c.iso === anchorDate ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]'}">${c.label}</span>
              <span class="font-mono px-1.5 py-0.5 rounded ${c.isOver ? 'bg-rose-500/20 text-rose-300 font-semibold' : 'text-[#8C8C8C]'}">
                ${showHoursBadge ? `${c.reservedHours}h / ${dailyHours}h` : `${c.items.length}`}
              </span>
            </div>
            <div class="flex flex-col gap-1.5 flex-1">
              ${c.items.map((item) => {
                if (item.type === 'break') {
                  return `
                    <div ${draggableCards ? 'draggable="true"' : ''} data-sb-uid="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}"
                      class="sb-week-card bg-[#2a2419] border border-amber-500/35 rounded-md px-2 py-1 flex items-center justify-between gap-1 text-[9.5px] font-mono uppercase tracking-wider text-obsidian-amber ${draggableCards ? 'cursor-grab active:cursor-grabbing' : ''}">
                      ${draggableCards
                        ? `<input type="text" data-sb-week-title="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}" value="${escapeHtml(item.title || 'CORTE / REUNIÓN')}" class="bg-transparent border border-transparent focus:border-obsidian-amber focus:bg-[#191919] rounded px-1 py-0.5 w-full min-w-0 text-[9.5px] font-mono uppercase tracking-wider text-obsidian-amber focus:outline-none" />`
                        : `<span class="truncate">${escapeHtml(item.title || 'CORTE / REUNIÓN')}</span>`
                      }
                      ${draggableCards ? `<button type="button" data-sb-week-remove="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}" class="text-[#8C8C8C] hover:text-rose-400 cursor-pointer shrink-0">×</button>` : ''}
                    </div>
                  `;
                }
                const otId = item.otId || item.id || '';
                const tIdx = item.taskIndex !== undefined && item.taskIndex !== null ? item.taskIndex : '';
                const cColor = getClientColor(item.client);
                const isFree = String(item.uid || '').startsWith('free-');
                return `
                  <div ${draggableCards ? 'draggable="true"' : ''} data-sb-uid="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}" data-sb-ot="${escapeHtml(otId)}" data-sb-task="${tIdx}" data-sched-ot="${escapeHtml(otId)}" data-sched-task="${tIdx}"
                    class="sb-open-trigger sb-week-card bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border rounded-lg p-2 space-y-1 ${draggableCards ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} transition-colors">
                    <div class="flex items-center justify-between gap-1">
                      <span class="inline-flex items-center gap-1 min-w-0">
                        ${getPriorityDotHtml(item, undefined, undefined, 'w-1.5 h-1.5')}
                        <span class="font-mono text-[9.5px] text-obsidian-amber truncate">${escapeHtml(item.code || item.id || 'LIBRE')}</span>
                      </span>
                      <span class="inline-flex items-center gap-1 shrink-0">
                        ${showHoursBadge
                          ? (draggableCards && isFree
                              ? `<input type="number" min="0.5" max="24" step="0.5" data-sb-week-hours="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}" value="${Number(item.estimatedHours ?? 2) || 2}" class="w-10 bg-[#202020] border border-obsidian-border rounded px-1 py-0.5 text-center font-mono text-[9px] text-obsidian-amber focus:outline-none" />`
                              : `<span class="font-mono text-[9px] text-[#8C8C8C] bg-[#202020] px-1 py-0.5 rounded">${Number(item.estimatedHours ?? 3) || 0}h</span>`)
                          : `<span class="text-[9px] text-[#8C8C8C] truncate">${escapeHtml(item.responsible || '')}</span>`
                        }
                        ${draggableCards && isFree ? `<button type="button" data-sb-week-remove="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}" class="text-[#8C8C8C] hover:text-rose-400 cursor-pointer text-[10px] leading-none px-0.5">×</button>` : ''}
                      </span>
                    </div>
                    ${draggableCards && isFree
                      ? `<input type="text" data-sb-week-title="${escapeHtml(item.uid || '')}" data-sb-week-day="${c.iso}" value="${escapeHtml(item.title)}" class="w-full bg-transparent border border-transparent hover:border-obsidian-border focus:border-obsidian-amber focus:bg-[#202020] rounded px-1 py-0.5 text-[11px] text-[#D4D4D4] focus:outline-none" />`
                      : `<div class="text-[11px] text-[#D4D4D4] leading-snug line-clamp-2">${escapeHtml(item.title)}</div>`
                    }
                    <div class="flex items-center justify-between gap-1 text-[9.5px] truncate">
                      <span class="truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(item.client || 'Interno')}</span>
                      ${item.stage ? `<span class="text-[#8C8C8C] truncate shrink-0">${escapeHtml(item.stage)}</span>` : ''}
                    </div>
                  </div>
                `;
              }).join('') || `<div class="text-[10px] text-[#5a6169] text-center py-4">${escapeHtml(emptyColText)}</div>`}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render an Excel-style Gantt timeline grouped by Client:
 *   Cliente (category row)
 *   No. OT (with description tooltip) | Entrada | Salida | DD/MM ... (week or month scale)
 */
export function renderGanttScheduleHtml({ anchorDate, items, scale = 'week' }) {
  const activeScale = scale === 'month' ? 'month' : 'week';
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  let days = [];
  let rangeLabel = '';
  if (activeScale === 'month') {
    const year = Number(anchorDate.slice(0, 4));
    const month = Number(anchorDate.slice(5, 7)) - 1;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    days = Array.from({ length: daysInMonth }, (_, i) => {
      const iso = `${anchorDate.slice(0, 8)}${String(i + 1).padStart(2, '0')}`;
      const d = new Date(`${iso}T12:00:00`);
      return { iso, ddmm: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, dow: dayNames[d.getDay()] };
    });
    rangeLabel = `${monthNames[month] || ''} ${year}`;
  } else {
    const monday = getWeekMonday(anchorDate);
    days = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toISOString().slice(0, 10);
      return { iso, ddmm: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`, dow: dayNames[d.getDay()] };
    });
    rangeLabel = `Semana ${days[0].ddmm} – ${days[days.length - 1].ddmm}`;
  }

  const rangeStart = days[0].iso;
  const rangeEnd = days[days.length - 1].iso;

  const visibleItems = items
    .map((r) => {
      const a = (r.entryDate || r.scheduledDate || r.deliveryDate || '').slice(0, 10);
      const b = (r.deliveryDate || r.scheduledDate || r.entryDate || '').slice(0, 10);
      if (!a && !b) return null;
      const startIso = a <= b ? a : b;
      const endIso = a <= b ? b : a;
      if (endIso < rangeStart || startIso > rangeEnd) return null;

      const clampedStart = startIso < rangeStart ? rangeStart : startIso;
      const clampedEnd = endIso > rangeEnd ? rangeEnd : endIso;
      const sIdx = days.findIndex((d) => d.iso >= clampedStart);
      const eIdx = days.findIndex((d) => d.iso >= clampedEnd);
      const startIdx = sIdx === -1 ? 0 : sIdx;
      const endIdx = eIdx === -1 ? days.length - 1 : Math.max(startIdx, eIdx);

      return { r, startIso, endIso, startIdx, endIdx };
    })
    .filter(Boolean);

  const clientGroups = [];
  const clientMap = new Map();
  visibleItems.forEach((entry) => {
    const clientName = entry.r.client || 'Interno';
    if (!clientMap.has(clientName)) {
      const group = { client: clientName, entries: [] };
      clientMap.set(clientName, group);
      clientGroups.push(group);
    }
    clientMap.get(clientName).entries.push(entry);
  });

  const scaleSwitchHtml = `
    <div class="inline-flex items-center bg-[#191919] border border-obsidian-border rounded-lg p-0.5 text-[10px]">
      <button type="button" data-gantt-scale="week" class="px-2 py-0.5 rounded-md transition-colors cursor-pointer ${activeScale === 'week' ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">Semana</button>
      <button type="button" data-gantt-scale="month" class="px-2 py-0.5 rounded-md transition-colors cursor-pointer ${activeScale === 'month' ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">Mes</button>
    </div>
  `;
  const scaleToolbar = `
    <div class="px-2 pt-2 pb-1 border-b border-obsidian-border bg-[#202020] shrink-0">
      ${renderScheduleNavHeader(
        rangeLabel,
        activeScale === 'month' ? 'Mes anterior' : 'Semana anterior',
        activeScale === 'month' ? 'Mes siguiente' : 'Semana siguiente',
        { extraRightHtml: scaleSwitchHtml }
      )}
    </div>
  `;

  if (!visibleItems.length) {
    return `
      <div class="flex-1 flex flex-col border border-obsidian-border rounded-xl bg-[#202020] overflow-hidden">
        ${scaleToolbar}
        <div class="p-8 text-center text-[11px] text-[#8C8C8C]">Sin entregas programadas para ${escapeHtml(rangeLabel)}.</div>
      </div>
    `;
  }

  const dayColClass = activeScale === 'month' ? 'min-w-[34px] w-[34px]' : 'min-w-[78px]';
  const totalCols = 3 + days.length;

  return `
    <div class="flex-1 flex flex-col border border-obsidian-border rounded-xl bg-[#202020] overflow-hidden">
      ${scaleToolbar}
      <div class="flex-1 overflow-auto">
        <table class="w-full border-collapse text-left text-[10.5px]">
          <thead class="sticky top-0 z-10 bg-[#191919] border-b border-obsidian-border text-[9.5px] uppercase tracking-wider text-[#8C8C8C]">
            <tr>
              <th class="px-2.5 py-1.5 font-medium border-r border-obsidian-border w-[108px] min-w-[108px] whitespace-nowrap">No. OT</th>
              <th class="px-2 py-1.5 font-medium border-r border-obsidian-border w-[60px] min-w-[60px] text-center whitespace-nowrap">Entrada</th>
              <th class="px-2 py-1.5 font-medium border-r border-obsidian-border w-[60px] min-w-[60px] text-center whitespace-nowrap">Salida</th>
              ${days.map((d) => `
                <th class="px-1 py-1.5 font-medium border-r border-obsidian-border/60 text-center whitespace-nowrap ${dayColClass}">
                  ${activeScale === 'week' ? `<span class="text-[#737373] mr-0.5">${d.dow}</span>` : ''}${d.ddmm}
                </th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${clientGroups.map(({ client, entries }) => {
              const cColor = getClientColor(client);
              return `
                <tr class="bg-[#252525] border-y border-obsidian-border">
                  <td colspan="${totalCols}" class="px-2.5 py-1.5 font-semibold text-[10.5px]">
                    <span style="color:${escapeHtml(cColor)}">${escapeHtml(client)}</span>
                    <span class="ml-2 text-[9.5px] font-mono font-normal text-[#8C8C8C]">(${entries.length})</span>
                  </td>
                </tr>
                ${entries.map(({ r, startIso, endIso, startIdx, endIdx }, idx) => {
                  const otId = r.otId || r.id || '';
                  const tIdx = r.taskIndex !== undefined && r.taskIndex !== null ? r.taskIndex : '';
                  const code = r.code || r.id || 'LIBRE';
                  const tooltip = [
                    r.title || '',
                    r.responsible ? `Resp: ${r.responsible}` : '',
                    r.stage ? `Etapa: ${r.stage}` : '',
                  ].filter(Boolean).join(' · ');
                  const zebra = idx % 2 === 1 ? 'bg-[#1d1d1d]' : 'bg-[#191919]';
                  const entryShort = `${startIso.slice(8, 10)}/${startIso.slice(5, 7)}`;
                  const exitShort = `${endIso.slice(8, 10)}/${endIso.slice(5, 7)}`;

                  return `
                    <tr data-sched-ot="${escapeHtml(otId)}" data-sched-task="${tIdx}" title="${escapeHtml(tooltip)}"
                      class="${zebra} hover:bg-[#262626] border-b border-obsidian-border/50 cursor-pointer transition-colors">
                      <td class="px-2.5 py-1.5 border-r border-obsidian-border whitespace-nowrap">
                        <span class="inline-flex items-center gap-1.5">
                          ${getPriorityDotHtml(r, undefined, undefined, 'w-1.5 h-1.5')}
                          <span class="font-mono font-semibold text-obsidian-amber">${escapeHtml(code)}</span>
                        </span>
                      </td>
                      <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-[#8C8C8C] text-center whitespace-nowrap">${escapeHtml(entryShort)}</td>
                      <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-[#8C8C8C] text-center whitespace-nowrap">${escapeHtml(exitShort)}</td>
                      ${days.map((_, dIdx) => {
                        const inSpan = dIdx >= startIdx && dIdx <= endIdx;
                        const isStart = dIdx === startIdx;
                        const isEnd = dIdx === endIdx;
                        if (!inSpan) {
                          return `<td class="p-0 border-r border-obsidian-border/40 ${dayColClass}"></td>`;
                        }
                        const roundCls = isStart && isEnd ? 'rounded' : (isStart ? 'rounded-l' : (isEnd ? 'rounded-r' : ''));
                        const padCls = `${isStart ? 'pl-0.5' : ''} ${isEnd ? 'pr-0.5' : ''}`.trim();
                        return `
                          <td class="py-1 ${padCls} border-r border-obsidian-border/40 ${dayColClass}">
                            <div class="h-4 ${roundCls}" style="background:${escapeHtml(cColor)}55; border-top: 1px solid ${escapeHtml(cColor)}; border-bottom: 1px solid ${escapeHtml(cColor)}; ${isStart ? `border-left: 1px solid ${escapeHtml(cColor)};` : ''} ${isEnd ? `border-right: 1px solid ${escapeHtml(cColor)};` : ''}"></div>
                          </td>
                        `;
                      }).join('')}
                    </tr>
                  `;
                }).join('')}
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * Bind Semana | Mes scale toggle inside shared Gantt views.
 */
export function bindGanttScaleEvents(container, onScaleChange) {
  if (!container) return;
  container.querySelectorAll('[data-gantt-scale]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextScale = btn.dataset.ganttScale;
      if (nextScale && onScaleChange) onScaleChange(nextScale);
    });
  });
}

/**
 * Render the Month calendar grid shared by Stripboard and Tráfico.
 */
export function renderMonthScheduleHtml({ anchorDate, getDayItems, dateAttr = 'data-sb-pick-date' }) {
  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const year = Number(anchorDate.slice(0, 4));
  const month = Number(anchorDate.slice(5, 7)) - 1;
  const monthLabel = `${monthNames[month] || ''} ${year}`;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: daysInMonth }, (_, i) => {
    const dNum = i + 1;
    const iso = `${anchorDate.slice(0, 8)}${String(dNum).padStart(2, '0')}`;
    const dayTasks = getDayItems(iso) || [];
    return { dNum, iso, dayTasks };
  });

  return `
    <div class="flex-1 flex flex-col gap-2 overflow-hidden">
      ${renderScheduleNavHeader(monthLabel, 'Mes anterior', 'Mes siguiente')}
      <div class="flex-1 grid grid-cols-7 gap-1.5 overflow-auto">
        ${cells.map((c) => `
          <button type="button" ${dateAttr}="${c.iso}" class="bg-[#202020] hover:bg-obsidian-elevated border ${c.iso === anchorDate ? 'border-obsidian-amber' : 'border-obsidian-border'} rounded-lg p-2 flex flex-col gap-1 min-h-[82px] text-left cursor-pointer transition-colors">
            <div class="flex items-center justify-between w-full">
              <span class="font-mono text-[10px] ${c.iso === anchorDate ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]'}">${c.dNum}</span>
              ${c.dayTasks.length ? `<span class="text-[9px] font-mono text-[#8C8C8C]">${c.dayTasks.length}</span>` : ''}
            </div>
            <div class="flex flex-col gap-0.5 w-full">
              ${c.dayTasks.slice(0, 3).map((t) => `
                <span class="inline-flex items-center gap-1 text-[9px] font-mono text-obsidian-amber bg-[#191919] px-1 py-0.5 rounded truncate">
                  ${getPriorityDotHtml(t, undefined, undefined, 'w-1 h-1')}
                  <span class="truncate">${escapeHtml(t.code || t.id || 'LIBRE')}</span>
                </span>
              `).join('')}
              ${c.dayTasks.length > 3 ? `<span class="text-[9px] font-mono text-[#8C8C8C]">+${c.dayTasks.length - 3} más</span>` : ''}
            </div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Render a shared Kanban board grouped by stage, status, department, priority, client, or responsible.
 */
export function renderKanbanScheduleHtml({
  items,
  groupBy = 'stage',
  todayKey,
  tomorrowKey,
  departments = [],
  stages = [],
  statuses = [],
  members = [],
  wrap = true,
}) {
  const groupMode = ['priority', 'stage', 'status', 'department', 'client', 'responsible'].includes(groupBy)
    ? groupBy
    : 'stage';

  const kanbanColumns = groupMode === 'priority'
    ? ['Urgentes', 'Vencen hoy', 'Vencen mañana']
    : (groupMode === 'stage'
      ? stages
      : (groupMode === 'department'
        ? departments
        : (groupMode === 'client'
          ? Array.from(new Set(items.map((o) => o.client || 'Sin cliente')))
          : (groupMode === 'responsible'
            ? Array.from(new Set([...members, ...items.map((o) => o.responsible || 'Sin asignar')]))
            : statuses))));

  const getColValue = (o) => {
    if (groupMode === 'priority') {
      if (o.urgent) return 'Urgentes';
      const dKey = (o.deliveryDate || '').slice(0, 10);
      if (dKey === todayKey) return 'Vencen hoy';
      if (dKey === tomorrowKey) return 'Vencen mañana';
      return '';
    }
    if (groupMode === 'stage') return o.stage || 'Tráfico';
    if (groupMode === 'department') return o.department || '—';
    if (groupMode === 'client') return o.client || 'Sin cliente';
    if (groupMode === 'responsible') return o.responsible || 'Sin asignar';
    return o.status || 'En proceso';
  };

  const colsHtml = kanbanColumns.map((colVal) => {
    const colOts = items.filter((o) => getColValue(o) === colVal);
    return `
      <div data-kanban-group="${escapeHtml(groupMode)}" data-kanban-val="${escapeHtml(colVal)}" class="shared-kanban-col w-60 shrink-0 bg-[#202020] border border-obsidian-border rounded-xl p-2 flex flex-col gap-2">
        <div class="flex items-center justify-between px-1 py-0.5">
          <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] truncate">${escapeHtml(colVal)}</span>
          <span class="text-[10px] font-mono text-[#8C8C8C]">${colOts.length}</span>
        </div>
        <div class="flex flex-col gap-2 min-h-[120px]">
          ${colOts.map((ot) => {
            const cColor = getClientColor(ot.client);
            const realOtId = ot.otId || ot.id;
            const taskIdxAttr = ot.taskIndex !== undefined ? ot.taskIndex : '';
            return `
              <div draggable="true" data-kanban-ot="${escapeHtml(realOtId)}" data-kanban-task="${taskIdxAttr}" class="shared-kanban-card bg-[#191919] hover:bg-[#262626] border border-obsidian-border rounded-lg p-2.5 space-y-1.5 cursor-pointer transition-colors">
                <div class="flex items-center justify-between gap-1">
                  <span class="inline-flex items-center gap-1.5">
                    ${getPriorityDotHtml(ot, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
                    <span class="font-mono text-[10px] font-semibold text-obsidian-amber">${escapeHtml(ot.id)}</span>
                  </span>
                  <span class="font-mono text-[9.5px] text-[#8C8C8C]">${escapeHtml(formatShortDate(ot.deliveryDate))}</span>
                </div>
                <div class="text-[10px] font-medium truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</div>
                <div class="text-[11px] text-[#D4D4D4] leading-snug line-clamp-2">${escapeHtml(ot.title)}</div>
                <div class="flex items-center justify-between gap-2 text-[9.5px] pt-0.5">
                  <span class="truncate" style="color:${escapeHtml(getDepartmentColor(ot.department))}">${escapeHtml(ot.department || '—')}</span>
                  <span class="truncate" style="color:${escapeHtml(getStageColor(ot.stage || 'Tráfico'))}">${escapeHtml(ot.stage || 'Tráfico')}</span>
                </div>
                <div class="flex items-center justify-between gap-2 text-[9.5px] text-[#8C8C8C]">
                  <span class="truncate">${escapeHtml(ot.ref || '—')}</span>
                  <span class="truncate text-[#A3A3A3]">${escapeHtml(ot.responsible || 'Sin asignar')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  return wrap
    ? `<div class="flex-1 flex gap-3 overflow-x-auto pb-2 items-start">${colsHtml}</div>`
    : colsHtml;
}

/**
 * Bind drag-and-drop column updates and card click handlers for shared Kanban boards.
 */
export function bindKanbanScheduleEvents({ container, orders, onInspectItem, onOpenItem, onChanged }) {
  if (!container) return;
  let draggedOtId = null;
  let draggedTaskIdx = '';

  const markActiveCard = (activeEl) => {
    container.querySelectorAll('.shared-kanban-card').forEach((c) => {
      c.classList.remove('ring-1', 'ring-obsidian-amber/70');
    });
    activeEl?.classList.add('ring-1', 'ring-obsidian-amber/70');
  };

  container.querySelectorAll('.shared-kanban-card').forEach((card) => {
    card.addEventListener('dragstart', () => {
      draggedOtId = card.dataset.kanbanOt;
      draggedTaskIdx = card.dataset.kanbanTask || '';
      card.classList.add('opacity-50');
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('opacity-50');
    });
    card.addEventListener('click', () => {
      if (!card.dataset.kanbanOt) return;
      if (onInspectItem) {
        markActiveCard(card);
        onInspectItem(card.dataset.kanbanOt, card.dataset.kanbanTask || '');
      } else if (onOpenItem) {
        onOpenItem(card.dataset.kanbanOt, card.dataset.kanbanTask || '');
      }
    });
    card.addEventListener('dblclick', () => {
      if (onOpenItem && card.dataset.kanbanOt) {
        onOpenItem(card.dataset.kanbanOt, card.dataset.kanbanTask || '');
      }
    });
  });

  container.querySelectorAll('.shared-kanban-col').forEach((col) => {
    col.addEventListener('dragover', (e) => {
      e.preventDefault();
      col.classList.add('border-[#3a3a3a]');
    });
    col.addEventListener('dragleave', () => col.classList.remove('border-[#3a3a3a]'));
    col.addEventListener('drop', (e) => {
      e.preventDefault();
      col.classList.remove('border-[#3a3a3a]');
      const target = orders.find((o) => o.id === draggedOtId);
      const gMode = col.dataset.kanbanGroup || 'stage';
      const nextVal = col.dataset.kanbanVal;
      if (!target || !nextVal) return;

      if (['stage', 'department', 'status', 'responsible'].includes(gMode)) {
        if (draggedTaskIdx !== '' && target.subtasks?.[Number(draggedTaskIdx)]) {
          target.subtasks[Number(draggedTaskIdx)][gMode] = nextVal;
        } else {
          target[gMode] = nextVal;
        }
        onChanged?.();
      }
    });
  });
}

/**
 * Unified renderer + event binder for Week, Gantt, and Month schedule views
 * (including Inspector mini-calendar and prev/today/next navigation).
 */
export function mountScheduleView({
  container,
  mode,
  anchorDate,
  items,
  ganttScale = 'week',
  dateAttr = 'data-sched-pick-date',
  onScaleChange,
  onShiftDate,
  onToday,
  onSelectDate,
  onPickDayToDayView,
  onInspectItem,
  onOpenItem,
  onDropDate = null,
}) {
  if (!container) return;
  const matchDate = (o, iso) => (o.deliveryDate || '').slice(0, 10) === iso;

  if (mode === 'week') {
    container.innerHTML = renderWeekScheduleHtml({
      anchorDate,
      showHoursBadge: false,
      draggableCards: typeof onDropDate === 'function',
      emptyColText: 'Sin entregas',
      getDayItems: (iso) => items.filter((o) => matchDate(o, iso)),
    });
  } else if (mode === 'gantt') {
    container.innerHTML = renderGanttScheduleHtml({
      anchorDate,
      items,
      scale: ganttScale,
    });
    bindGanttScaleEvents(container, onScaleChange);
  } else if (mode === 'month') {
    container.innerHTML = renderMonthScheduleHtml({
      anchorDate,
      dateAttr,
      getDayItems: (iso) => items.filter((o) => matchDate(o, iso)),
    });
  }

  if (window.hydrateIcons) window.hydrateIcons(container);

  const busyDates = new Set(items.map((o) => (o.deliveryDate || '').slice(0, 10)).filter(Boolean));
  renderInspectorMiniCalendar({
    anchorDate,
    busyDates,
    onSelectDate,
  });

  bindScheduleNavEvents(container, onShiftDate, onToday);

  const markActiveSched = (activeEl) => {
    container.querySelectorAll('[data-sched-ot]').forEach((node) => {
      node.classList.remove('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
    });
    activeEl?.classList.add('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
  };

  container.querySelectorAll('[data-sched-ot]').forEach((el) => {
    el.addEventListener('click', () => {
      const otId = el.dataset.schedOt;
      if (!otId) return;
      if (onInspectItem) {
        markActiveSched(el);
        onInspectItem(otId, el.dataset.schedTask || '');
      } else if (onOpenItem) {
        onOpenItem(otId, el.dataset.schedTask || '');
      }
    });
    el.addEventListener('dblclick', () => {
      const otId = el.dataset.schedOt;
      if (otId && onOpenItem) onOpenItem(otId, el.dataset.schedTask || '');
    });
  });

  container.querySelectorAll(`[${dateAttr}]`).forEach((btn) => {
    btn.addEventListener('click', () => {
      const picked = btn.getAttribute(dateAttr);
      if (picked && onPickDayToDayView) onPickDayToDayView(picked);
    });
  });

  if (mode === 'week' && typeof onDropDate === 'function') {
    let draggedOt = null;
    let draggedTask = '';
    container.querySelectorAll('.sb-week-card').forEach((card) => {
      card.addEventListener('dragstart', (e) => {
        draggedOt = card.dataset.schedOt || '';
        draggedTask = card.dataset.schedTask || '';
        e.dataTransfer?.setData('text/plain', `${draggedOt}::${draggedTask}`);
        card.classList.add('opacity-50');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('opacity-50');
        container.querySelectorAll('.sb-week-col').forEach((col) => col.classList.remove('ring-1', 'ring-obsidian-amber/60'));
        draggedOt = null;
        draggedTask = '';
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
        const targetDate = col.dataset.sbWeekDate;
        const payload = e.dataTransfer?.getData('text/plain') || '';
        const [rawOt, rawTask] = payload.split('::');
        const otId = draggedOt || rawOt;
        const taskIdx = draggedOt ? draggedTask : (rawTask || '');
        if (otId && targetDate) {
          onDropDate(otId, taskIdx, targetDate);
        }
      });
    });
  }
}
