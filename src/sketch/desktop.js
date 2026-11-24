/**
 * Escritorio (#view-desktop):
 * - Fila superior: mitad izquierda con 3 pastillas dobles condensadas (OTs Activas|Urgentes, Tareas Act.|Urgentes, En Cliente|Por Facturar);
 *   mitad derecha con 2 pastillas (Mi Jornada Hoy | Mañana).
 * - Espacio inferior acuartelado 2×2:
 *   - Cuadrante 01: 3 columnas con switch OTs / Tareas (Urgentes | Para Hoy | Para Mañana).
 *   - Cuadrante 02: 2 filas Semana (02.1 Esta Semana | 02.2 Semana Próxima) con switch OTs / Tareas.
 *   - Cuadrantes 03 y 04: vacíos por ahora.
 * - Inspector derecho: mini-calendario arriba + detalle de la OT/Tarea seleccionada debajo.
 */

import {
  ensureOtData,
  escapeHtml,
  formatShortDate,
  getActiveWorkspaces,
  getClientColor,
  getDepartmentColor,
  getPriorityDotHtml,
  getWorkspaceById,
  notifySketchChange,
  relDate,
  setActiveWorkspace,
  shiftIsoDate,
  sketchState,
  studioFreeTasks,
  studioSeparators,
  studioSettings,
  trafficOrders,
  userProfile,
} from './store.js';
import { getWeekMonday, renderInspectorMiniCalendar } from './schedule-views.js';
import { ensureStripboardDaySeeded, getDayReservedHours } from './stripboard.js';
import { renderTrafficNotesInspector } from './inspector.js';
import {
  getRoleCapabilities,
  loadStatsState,
  runStatsQuery,
  saveStatsState,
} from './stats-engine.js';
import { renderChartLightboxHtml, renderStatsPillChartsGrid } from './ot-en-proceso-charts.js';

let lastCallbacks = {};
const q1ModesByScope = {
  global: { urgent: 'ots', today: 'ots', tomorrow: 'ots' },
  personal: { urgent: 'tasks', today: 'tasks', tomorrow: 'tasks' },
};
const q2ModesByScope = {
  global: { thisWeek: 'ots', nextWeek: 'ots', month: 'ots' },
  personal: { thisWeek: 'tasks', nextWeek: 'tasks', month: 'tasks' },
};
let q2ViewMode = 'week'; // 'week' | 'month'
let monthAnchorIso = null;
let statsState = loadStatsState();
let activeStatsPill = 'ots-active'; // 'ots-active' | 'ots-urgent' | 'tasks-active' | 'tasks-urgent' | 'client-review' | 'finalizadas' | 'today-hours' | 'tomorrow-hours'
let deptChartPageWsId = null;
let panelLightboxModId = null; // null | 'priorities' | 'calendar' | 'stats'
let lightboxChartIdx = null;
let lastPillBoard = null;
let selectedStatsDrillKey = null;
let q4TraceFilter = 'all'; // 'all' | 'routes' | 'activity'
let inspIdleTab = 'messages'; // 'messages' | 'activity'
let selectedContextOtId = null;
let selectedContextTaskIdx = null;
let selectedMediaIndex = null;
const QUADRANT_STORAGE_KEY = 'trafigator_desktop_quadrants_v1';
const DESKTOP_SCOPE_STORAGE_KEY = 'trafigator_desktop_scope_v1';
const DEFAULT_QUADRANT_ORDER = ['priorities', 'calendar', 'stats', 'empty'];

function loadDesktopScope() {
  try {
    const saved = localStorage.getItem(DESKTOP_SCOPE_STORAGE_KEY);
    if (saved === 'global' || saved === 'personal') return saved;
  } catch {
    // ignore storage errors
  }
  return 'global';
}

function saveDesktopScope(scope) {
  try {
    localStorage.setItem(DESKTOP_SCOPE_STORAGE_KEY, scope);
  } catch {
    // ignore storage errors
  }
}

let desktopScopePref = loadDesktopScope();

function loadQuadrantOrder(scope = 'global') {
  const key = scope === 'personal' ? `${QUADRANT_STORAGE_KEY}_personal` : QUADRANT_STORAGE_KEY;
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (
      Array.isArray(saved)
      && saved.length === 4
      && DEFAULT_QUADRANT_ORDER.every((id) => saved.includes(id))
    ) {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return [...DEFAULT_QUADRANT_ORDER];
}

function saveQuadrantOrder(order, scope = 'global') {
  const key = scope === 'personal' ? `${QUADRANT_STORAGE_KEY}_personal` : QUADRANT_STORAGE_KEY;
  try {
    localStorage.setItem(key, JSON.stringify(order));
  } catch {
    // ignore storage errors
  }
}

const quadrantOrdersByScope = {
  global: loadQuadrantOrder('global'),
  personal: loadQuadrantOrder('personal'),
};
let draggedSlotIdx = null;
let selectedCardKey = null;
let selectedCalendarDate = null;
let nextWeekAnchorIso = null;
let rightCollapseMode = 'none'; // 'none' | 'q2' | 'q4'
let dismissListenersBound = false;

function renderDragHandle(slotIdx) {
  return `
    <span draggable="true" data-dk-drag-slot="${slotIdx}" title="Arrastrar para intercambiar cuadrante"
      class="cursor-grab active:cursor-grabbing text-[#5A5A5A] hover:text-[#D4D4D4] inline-flex items-center px-0.5 select-none shrink-0 transition-colors">
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
        <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
      </svg>
    </span>
  `;
}

const MONTH_NAMES_LOWER = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function getIsoMonday(iso) {
  const m = getWeekMonday(iso);
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}`;
}

function renderTopRingWidget({
  title,
  value,
  ringColor,
  progress = 1,
  lines = [],
  attrs = '',
  active = false,
}) {
  const radius = 15;
  const circ = 2 * Math.PI * radius;
  const frac = Math.max(0, Math.min(1, progress));
  const dash = frac * circ;
  const cardCls = active
    ? 'bg-[#2a2a2a] border-obsidian-amber/80 ring-1 ring-inset ring-obsidian-amber/40'
    : 'bg-[#242424] hover:bg-[#2a2a2a] border-obsidian-border hover:border-[#3f3f3f]';
  return `
    <button type="button" ${attrs}
      class="text-left px-2 py-1.5 rounded-xl border ${cardCls} transition-colors cursor-pointer flex flex-col gap-1 min-w-0">
      <div class="text-[9.5px] font-semibold text-[#F0F0F0] leading-tight truncate">${escapeHtml(title)}</div>
      <div class="flex items-center gap-2 min-w-0">
        <div class="relative w-8 h-8 shrink-0">
          <svg viewBox="0 0 38 38" class="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="19" cy="19" r="${radius}" fill="none" stroke="#181818" stroke-width="3" />
            <circle cx="19" cy="19" r="${radius}" fill="none" stroke="${escapeHtml(ringColor)}" stroke-width="3"
              stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center font-sans text-[12px] font-bold text-white leading-none">${escapeHtml(String(value))}</span>
        </div>
        <div class="min-w-0 flex flex-col justify-center text-[9px] font-medium leading-tight">
          ${lines.map((ln) => `
            <div class="truncate">
              ${ln.num !== undefined ? `<span class="font-bold mr-1" style="color:${escapeHtml(ln.numColor || '#D4D4D4')}">${escapeHtml(String(ln.num))}</span>` : ''}
              <span class="text-[#E5E5E5]">${escapeHtml(ln.label)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </button>
  `;
}

function renderEmptySlot(headerLabel, slotCode, borderClass = '') {
  return `
    <div class="relative p-3 ${borderClass} flex flex-col justify-between min-h-0 group hover:bg-[#202020]/25 transition-colors">
      <div class="flex items-center justify-between gap-2">
        <span class="font-mono text-[9px] text-[#5A5A5A] tracking-wider uppercase truncate">${escapeHtml(headerLabel)}</span>
        <span class="text-[9px] font-mono text-[#3a3a3a] group-hover:text-[#737373] transition-colors shrink-0">VACÍO</span>
      </div>
      <div class="flex flex-col items-center justify-center flex-1 py-4">
        <svg class="w-3 h-3 text-[#3a3a3a] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path>
        </svg>
        <span class="text-[10px] text-[#5A5A5A] font-mono tracking-wide">Área disponible</span>
      </div>
      <div class="flex items-center justify-between text-[9px] font-mono text-[#3a3a3a]">
        <span>${escapeHtml(slotCode)}</span>
        <span>--:--</span>
      </div>
    </div>
  `;
}

/**
 * Render the Escritorio (#view-desktop) view.
 */
export function renderDesktopOverview(onGoToTraffic, opts = {}) {
  lastCallbacks = { onGoToTraffic, ...opts };

  const container = document.getElementById('view-desktop');
  if (!container) return;

  const todayKey = relDate(0).slice(0, 10);
  const tomorrowKey = relDate(1).slice(0, 10);
  const defaultNextWeekIso = shiftIsoDate(todayKey, 7);
  if (!selectedCalendarDate) selectedCalendarDate = todayKey;
  if (!nextWeekAnchorIso) nextWeekAnchorIso = defaultNextWeekIso;
  if (!monthAnchorIso) monthAnchorIso = todayKey;
  const thisWeekMonIso = getIsoMonday(todayKey);
  const nextWeekAnchor = nextWeekAnchorIso;

  const dailyHours = Number(studioSettings.dailyHours) || 8;
  const activeWsId = sketchState.activeWorkspaceId || 'studio';
  const activeWsObj = activeWsId !== 'studio' ? getWorkspaceById(activeWsId) : null;
  const activeWorkspaces = getActiveWorkspaces();
  const showWsTag = activeWorkspaces.length >= 2 && activeWsId === 'studio';

  // Rol y alcance de Escritorio: Global | Personal (Dueño/Admin-Tráfico/Cuentas alternan; Colaborador solo Personal)
  const roleCaps = getRoleCapabilities();
  const canSwitchGlobal = roleCaps.hasGlobalScope;
  const desktopScope = canSwitchGlobal ? desktopScopePref : 'personal';
  const isPersonalScope = desktopScope === 'personal';
  const myMember = userProfile.shortName || sketchState.myOtsMember || 'Andrés';
  const q1Modes = q1ModesByScope[desktopScope];
  const q2Modes = q2ModesByScope[desktopScope];
  const quadrantOrder = quadrantOrdersByScope[desktopScope];

  const workspaceOrders = trafficOrders.filter((o) => {
    if (o.archived) return false;
    if (activeWsId !== 'studio' && (o.workspaceId || 'diseno-publicidad') !== activeWsId) return false;
    return true;
  });
  workspaceOrders.forEach((o) => ensureOtData(o, formatShortDate));

  const scopedOrders = isPersonalScope
    ? workspaceOrders.filter((o) => o.responsible === myMember || (o.subtasks || []).some((st) => (st.responsible || o.responsible) === myMember))
    : workspaceOrders;

  // OTs buckets
  const urgentOts = scopedOrders
    .filter((o) => !!o.urgent || (o.deliveryDate || '').slice(0, 10) < todayKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const todayOts = scopedOrders
    .filter((o) => (o.deliveryDate || '').slice(0, 10) === todayKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const tomorrowOts = scopedOrders
    .filter((o) => (o.deliveryDate || '').slice(0, 10) === tomorrowKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));

  // Tasks buckets
  const allActiveTasks = [];
  scopedOrders.forEach((ot) => {
    (ot.subtasks || []).forEach((st, idx) => {
      if (['Terminada', 'Finalizada', 'Archivada', 'Cancelada'].includes(st.status)) return;
      const resp = st.responsible || ot.responsible;
      if (isPersonalScope && resp !== myMember) return;
      const dDate = st.deliveryDate || ot.deliveryDate || '';
      allActiveTasks.push({
        otId: ot.id,
        taskIndex: idx,
        title: st.title || ot.title,
        client: ot.client,
        department: st.department || ot.department,
        responsible: resp,
        deliveryDate: dDate,
        urgent: !!(st.urgent || ot.urgent),
        workspaceId: ot.workspaceId || 'diseno-publicidad',
        estimatedHours: st.estimatedHours,
      });
    });
  });

  const urgentTasks = allActiveTasks
    .filter((t) => t.urgent || ((t.deliveryDate || '').slice(0, 10) && (t.deliveryDate || '').slice(0, 10) < todayKey))
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const todayTasks = allActiveTasks
    .filter((t) => (t.deliveryDate || '').slice(0, 10) === todayKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const tomorrowTasks = allActiveTasks
    .filter((t) => (t.deliveryDate || '').slice(0, 10) === tomorrowKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));

  // Busy dates for Inspector mini-calendar
  const busyDates = new Set();
  scopedOrders.forEach((o) => {
    const dk = (o.deliveryDate || '').slice(0, 10);
    if (dk) busyDates.add(dk);
  });
  allActiveTasks.forEach((t) => {
    const dk = (t.deliveryDate || '').slice(0, 10);
    if (dk) busyDates.add(dk);
  });

  const suspendedCount = scopedOrders.filter((o) => o.status === 'Suspendida').length;
  const waitingClientItems = scopedOrders.filter(
    (o) => o.department === 'Cliente' || (o.mediaFiles || []).some((m) => m.status === 'En Revisión')
  );
  const toBillItems = scopedOrders.filter((o) => (o.stage || 'Tráfico') === 'Cerrar OT y Facturar' || o.department === 'Facturación');
  const billedItems = scopedOrders.filter((o) => (o.stage || 'Tráfico') === 'Facturada');

  const todayHours = getDayReservedHours(todayKey);
  const todayPct = Math.round((todayHours / dailyHours) * 100);
  const todayOver = todayHours > dailyHours;
  const tomorrowHours = getDayReservedHours(tomorrowKey);
  const tomorrowPct = Math.round((tomorrowHours / dailyHours) * 100);
  const tomorrowOver = tomorrowHours > dailyHours;
  let todaySplit = '';
  let tomorrowSplit = '';
  if (activeWorkspaces.length >= 2 && activeWsId !== 'studio') {
    const sumH = (list) => list.reduce((s, x) => s + (Number(x.estimatedHours) || 0), 0);
    const calcSplit = (isoKey) => {
      const dayTasks = ensureStripboardDaySeeded(isoKey).filter((s) => s.type !== 'break');
      const mineH = sumH(dayTasks.filter((x) => !x.workspaceId || x.workspaceId === activeWsId));
      const otherH = sumH(dayTasks.filter((x) => x.workspaceId && x.workspaceId !== activeWsId));
      return `${mineH}h ${activeWsObj?.shortName || ''} + ${otherH}h otros`;
    };
    todaySplit = calcSplit(todayKey);
    tomorrowSplit = calcSplit(tomorrowKey);
  }

  const renderOtRow = (ot, colKey, compact = false) => {
    const cColor = getClientColor(ot.client);
    const shortOtCode = String(ot.id || '').replace(/^OT-/i, '');
    const dKey = (ot.deliveryDate || '').slice(0, 10);
    const isOverdue = dKey && dKey < todayKey;
    const isDueToday = dKey === todayKey;
    const ws = showWsTag && !compact ? getWorkspaceById(ot.workspaceId || 'diseno-publicidad') : null;
    const key = `${colKey}:ot:${ot.id}`;
    const isSelected = selectedCardKey === key;
    return `
      <div data-desktop-select-ot="${escapeHtml(ot.id)}" data-dk-key="${escapeHtml(key)}"
        class="bg-[#202020] hover:bg-[#262626] border ${isSelected ? 'border-obsidian-amber/70 bg-[#242424]' : 'border-obsidian-border'} rounded-lg ${compact ? 'p-1.5 space-y-0.5' : 'p-2 space-y-1'} cursor-pointer transition-colors">
        <div class="flex items-center justify-between gap-1">
          <span class="inline-flex items-center gap-1 min-w-0">
            ${getPriorityDotHtml(ot, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
            <button type="button" data-desktop-edit-ot="${escapeHtml(ot.id)}" title="Abrir OT"
              class="font-mono ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOtCode)}</button>
            ${ws ? `<span class="text-[9px] font-medium truncate" style="color:${escapeHtml(ws.color || '#8C8C8C')}">${escapeHtml(ws.shortName)}</span>` : ''}
          </span>
          ${compact ? '' : `<span class="font-mono text-[9px] ${isOverdue ? 'text-rose-300 font-semibold' : (isDueToday ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]')} shrink-0">${escapeHtml(formatShortDate(ot.deliveryDate) || '—')}</span>`}
        </div>
        <div class="${compact ? 'text-[9.5px] line-clamp-2' : 'text-[10.5px] line-clamp-2'} text-[#D4D4D4] leading-snug" title="${escapeHtml(ot.title)}">${escapeHtml(ot.title)}</div>
        <div class="flex items-center justify-between gap-1 ${compact ? 'text-[8.5px]' : 'text-[9.5px]'}">
          <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
          ${compact ? '' : `<span class="truncate shrink-0" style="color:${escapeHtml(getDepartmentColor(ot.department))}">${escapeHtml(ot.department || '—')}</span>`}
        </div>
      </div>
    `;
  };

  const renderTaskRow = (task, colKey, compact = false) => {
    const cColor = getClientColor(task.client);
    const shortOtCode = `${String(task.otId || '').replace(/^OT-/i, '')}.${task.taskIndex + 1}`;
    const dKey = (task.deliveryDate || '').slice(0, 10);
    const isOverdue = dKey && dKey < todayKey;
    const isDueToday = dKey === todayKey;
    const ws = showWsTag && !compact ? getWorkspaceById(task.workspaceId) : null;
    const key = `${colKey}:task:${task.otId}:${task.taskIndex}`;
    const isSelected = selectedCardKey === key;
    return `
      <div data-desktop-select-task-ot="${escapeHtml(task.otId)}" data-desktop-select-task-idx="${task.taskIndex}" data-dk-key="${escapeHtml(key)}"
        class="bg-[#202020] hover:bg-[#262626] border ${isSelected ? 'border-obsidian-amber/70 bg-[#242424]' : 'border-obsidian-border'} rounded-lg ${compact ? 'p-1.5 space-y-0.5' : 'p-2 space-y-1'} cursor-pointer transition-colors">
        <div class="flex items-center justify-between gap-1">
          <span class="inline-flex items-center gap-1 min-w-0">
            ${getPriorityDotHtml(task, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
            <button type="button" data-desktop-edit-task-ot="${escapeHtml(task.otId)}" data-desktop-edit-task-idx="${task.taskIndex}" title="Abrir Tarea"
              class="font-mono ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOtCode)}</button>
            ${ws ? `<span class="text-[9px] font-medium truncate" style="color:${escapeHtml(ws.color || '#8C8C8C')}">${escapeHtml(ws.shortName)}</span>` : ''}
          </span>
          ${compact ? '' : `<span class="font-mono text-[9px] ${isOverdue ? 'text-rose-300 font-semibold' : (isDueToday ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]')} shrink-0">${escapeHtml(formatShortDate(task.deliveryDate) || '—')}</span>`}
        </div>
        <div class="${compact ? 'text-[9.5px] line-clamp-2' : 'text-[10.5px] line-clamp-2'} text-[#D4D4D4] leading-snug" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
        <div class="flex items-center justify-between gap-1 ${compact ? 'text-[8.5px]' : 'text-[9.5px]'}">
          <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(task.client)}</span>
          ${compact ? '' : `<span class="truncate shrink-0" style="color:${escapeHtml(getDepartmentColor(task.department))}">${escapeHtml(task.department || '—')}</span>`}
        </div>
      </div>
    `;
  };

  const renderQ1Column = ({ colKey, title, ots, tasks, borderClass, bgClass = '', accentBarClass = '', dotClass = '', titleClass = 'text-[#D4D4D4]', leadingHtml = '', trailingHtml = '', emptyOts, emptyTasks }) => {
    const mode = q1Modes[colKey] || 'ots';
    const bodyHtml = mode === 'ots'
      ? (ots.length
          ? ots.map((ot) => renderOtRow(ot, colKey, false)).join('')
          : `<div class="flex-1 flex items-center justify-center text-[10px] font-mono text-[#5A5A5A]">${escapeHtml(emptyOts)}</div>`)
      : (tasks.length
          ? tasks.map((t) => renderTaskRow(t, colKey, false)).join('')
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
        <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
          ${bodyHtml}
        </div>
      </div>
    `;
  };

  const renderQ2ViewSwitch = () => `
    <div class="inline-flex items-center gap-0.5 text-[9px] font-mono shrink-0">
      <button type="button" data-dk-q2-view="week"
        class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${q2ViewMode === 'week' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Semana</button>
      <button type="button" data-dk-q2-view="month"
        class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${q2ViewMode === 'month' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Mes</button>
    </div>
  `;

  const renderQ2MonthView = ({ borderClass = '', dragHandleHtml = '', collapseBtnHtml = '' }) => {
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
            ${renderQ2ViewSwitch()}
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
                <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5">
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
  };

  const renderQ2WeekRow = ({ rowKey, title, anchorIso, borderClass, navigable = false, dragHandleHtml = '', collapseBtnHtml = '', showViewSwitch = false }) => {
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
            ${showViewSwitch ? `${renderQ2ViewSwitch()}<span class="w-px h-3 bg-obsidian-border"></span>` : ''}
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
                <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1 pr-0.5">
                  ${items.length
                    ? (mode === 'ots'
                        ? items.map((ot) => renderOtRow(ot, `${rowKey}:${c.iso}`, true)).join('')
                        : items.map((t) => renderTaskRow(t, `${rowKey}:${c.iso}`, true)).join(''))
                    : `<div class="flex-1 flex items-center justify-center text-[8.5px] font-mono text-[#3f3f3f]">—</div>`
                  }
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const showFinalizadasKpi = !isPersonalScope && roleCaps.canSeeFinancial;
  const scopedFreeTasks = (studioFreeTasks || []).filter((t) => {
    if (activeWsId !== 'studio' && t.workspaceId && t.workspaceId !== activeWsId) return false;
    if (isPersonalScope && t.responsible !== myMember) return false;
    return true;
  });
  const freeEstudioCount = scopedFreeTasks.filter((t) => t.kind === 'estudio').length;
  const freeClienteCount = scopedFreeTasks.filter((t) => t.kind !== 'estudio').length;
  const scopedSeparators = (studioSeparators || []).filter((s) => !isPersonalScope || s.responsible === myMember);
  const sepTotalHours = Number(scopedSeparators.reduce((sum, s) => sum + (Number(s.hours) || (Number(s.minutes) || 0) / 60), 0).toFixed(1));

  // Cuadrante Estadística: Motor v3 (Nodos Hoja · LIVE/THROUGHPUT · Filtros en cascada · Proyección automática · RBAC)
  const isAllowedPill = (p) => {
    if (p === 'finalizadas') return showFinalizadasKpi;
    if (p === 'free-tasks' || p === 'separators') return !isPersonalScope;
    if (p === 'today-hours' || p === 'tomorrow-hours') return isPersonalScope;
    return true;
  };
  const effectiveStatsPillForQuery = isAllowedPill(activeStatsPill) ? activeStatsPill : 'ots-active';
  const statsQuery = runStatsQuery({
    allOrders: trafficOrders,
    state: statsState,
    topWorkspaceId: activeWsId,
    myMember,
    forcePersonalMember: isPersonalScope ? myMember : null,
    activePill: effectiveStatsPillForQuery,
  });
  if (statsQuery.sanitized) {
    statsState = statsQuery.effectiveState;
    saveStatsState(statsState);
  }
  const statsChartTitle = statsQuery.chartTitle;

  // Cuadrante 04: Trazabilidad data (Bitácora routes + Activity log)
  const traceEvents = [];
  scopedOrders.forEach((ot) => {
    const shortCode = String(ot.id || '').replace(/^OT-/i, '');
    const cColor = getClientColor(ot.client);
    const sortBase = ot.entryDate || '';

    if (q4TraceFilter === 'all' || q4TraceFilter === 'routes') {
      (ot.routes || []).forEach((rt, idx) => {
        traceEvents.push({
          kind: 'route',
          otId: ot.id,
          shortCode,
          client: ot.client,
          clientColor: cColor,
          actor: rt.sign || ot.responsible || 'Sistema',
          at: rt.date || formatShortDate(ot.entryDate) || '—',
          from: rt.from || '—',
          to: rt.to || '—',
          text: rt.notes || rt.desc || ot.title,
          sortKey: `${sortBase}-r-${String(idx).padStart(2, '0')}`,
        });
      });
    }

    if (q4TraceFilter === 'all' || q4TraceFilter === 'activity') {
      (ot.activityLog || []).slice(0, 3).forEach((ev, idx) => {
        traceEvents.push({
          kind: 'activity',
          otId: ot.id,
          shortCode,
          client: ot.client,
          clientColor: cColor,
          actor: ev.actor || ot.responsible || 'Sistema',
          at: ev.at || '—',
          text: ev.text || '',
          sortKey: `${sortBase}-a-${String(99 - idx).padStart(2, '0')}`,
        });
      });
    }
  });
  traceEvents.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const visibleTrace = traceEvents.slice(0, 30);

  // Live stream of global messages across scopedOrders for 04.2 (idle state)
  const globalMessages = [];
  scopedOrders.forEach((ot) => {
    const shortCode = String(ot.id || '').replace(/^OT-/i, '');
    const cColor = getClientColor(ot.client);
    (ot.messages || []).forEach((msg, idx) => {
      globalMessages.push({
        otId: ot.id,
        shortCode,
        client: ot.client,
        clientColor: cColor,
        actor: msg.actor || ot.responsible || 'Equipo',
        channel: msg.channel || 'App',
        at: msg.at || '',
        text: msg.text || '',
        priority: msg.priority || null,
        sortKey: `${msg.priority === 'urgent' ? '2' : (msg.priority === 'important' ? '1' : '0')}-${ot.entryDate || ''}-${String(idx).padStart(2, '0')}`,
      });
    });
  });
  globalMessages.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  const visibleMessages = globalMessages.slice(0, 30);

  // Cuadrante 04 contextual (OT / Tarea seleccionada -> 04.1 Galería | 04.2 Mensajes Revisión / Log Actividad)
  const selectedContextOt = selectedContextOtId
    ? (scopedOrders.find((o) => o.id === selectedContextOtId) || trafficOrders.find((o) => o.id === selectedContextOtId) || null)
    : null;
  if (selectedContextOt) ensureOtData(selectedContextOt, formatShortDate);
  const selectedContextTask = (selectedContextOt && selectedContextTaskIdx !== null && selectedContextTaskIdx !== undefined)
    ? (selectedContextOt.subtasks || [])[selectedContextTaskIdx] || null
    : null;

  const renderCollapseBtn = (target) => {
    if (!target) return '';
    const isUp = target === 'q2';
    return `
      <button type="button" data-dk-collapse-right="${target}" title="${isUp ? 'Colapsar cuadrante superior' : 'Colapsar cuadrante inferior'}"
        class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#A3A3A3] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer transition-colors">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isUp ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>'}</svg>
      </button>
    `;
  };

  const renderQ2GalleryOverlay = (borderClass = '', dragHandleHtml = '', collapseBtnHtml = '') => {
    if (!selectedContextOt) return '';
    const shortCode = String(selectedContextOt.id || '').replace(/^OT-/i, '');
    const contextBadge = selectedContextTask
      ? `${shortCode}.${selectedContextTaskIdx + 1}`
      : shortCode;
    const mediaItems = Array.isArray(selectedContextOt.mediaFiles) ? selectedContextOt.mediaFiles : [];
    const activeIdx = (selectedMediaIndex !== null && mediaItems[selectedMediaIndex])
      ? selectedMediaIndex
      : (mediaItems.length ? 0 : null);
    const selectedMedia = activeIdx !== null ? mediaItems[activeIdx] : null;

    const renderMediaPreviewHtml = (m) => {
      const isVideo = /\.(mp4|mov|webm)$/i.test(m.name || '') || /VIDEO/i.test(m.meta || '');
      const isPdf = /\.pdf$/i.test(m.name || '') || /PDF/i.test(m.meta || '');
      const isImg = !isVideo && !isPdf;
      const statusCls = m.status === 'Aprobado'
        ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
        : 'text-obsidian-amber bg-amber-500/15 border-amber-500/30';
      const versions = Array.isArray(m.versions) && m.versions.length
        ? m.versions
        : [{ label: 'v1', name: m.name, meta: m.meta }];
      const activeVer = versions[versions.length - 1];
      const previewVisual = m.dataUrl && isImg
        ? `<img src="${escapeHtml(m.dataUrl)}" alt="${escapeHtml(m.name)}" class="max-h-full max-w-full object-contain rounded" />`
        : (m.dataUrl && isVideo
            ? `<video src="${escapeHtml(m.dataUrl)}" controls class="max-h-full max-w-full rounded"></video>`
            : `<div class="flex flex-col items-center justify-center gap-1.5 text-center px-3">
                <div class="w-10 h-10 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold ${isVideo ? 'text-sky-400' : (isPdf ? 'text-rose-400' : 'text-obsidian-amber')}">
                  ${isVideo ? 'VID' : (isPdf ? 'PDF' : 'IMG')}
                </div>
                <div class="text-[10.5px] font-medium text-[#D4D4D4] truncate max-w-full">${escapeHtml(m.name)}</div>
                <div class="text-[9px] font-mono text-[#737373]">${escapeHtml(m.meta || 'Archivo')}</div>
              </div>`);

      return `
        <div class="flex-1 min-h-0 flex flex-col gap-2">
          <div class="flex-1 min-h-[110px] rounded-lg bg-[#141414] border border-obsidian-border flex items-center justify-center overflow-hidden p-2">
            ${previewVisual}
          </div>
          <div class="shrink-0 space-y-1.5">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10.5px] font-medium text-[#D4D4D4] truncate" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
              <span class="px-1.5 py-0.5 rounded border text-[8.5px] font-mono shrink-0 ${statusCls}">${escapeHtml(m.status || 'En Revisión')}</span>
            </div>
            <div class="flex items-center justify-between gap-2 text-[9px] font-mono text-[#737373]">
              <span class="truncate">${escapeHtml(m.taskTitle || 'OT')} · ${escapeHtml(activeVer?.label || 'v1')} · ${escapeHtml(m.meta || '')}</span>
              <button type="button" data-dk-open-review="${activeIdx}"
                class="px-2 py-0.5 rounded bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] hover:text-obsidian-amber transition-colors cursor-pointer shrink-0">Revisión ↗</button>
            </div>
          </div>
        </div>
      `;
    };

    return `
      <div id="dk-q2-gallery-root" class="${borderClass} grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-obsidian-border min-h-0 flex-1">
        <!-- 02.1: Galería de la OT / Tarea -->
        <div class="p-3 flex flex-col min-h-0">
          <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-obsidian-border/70 shrink-0">
            <div class="flex items-center gap-1.5 min-w-0">
              ${dragHandleHtml}
              <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold">Galería</span>
              <button type="button" data-desktop-edit-ot="${escapeHtml(selectedContextOt.id)}" title="Abrir OT"
                class="px-1.5 py-0.5 rounded bg-[#202020] border border-obsidian-border font-mono text-[8.5px] text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(contextBadge)}</button>
            </div>
            <span class="font-mono text-[9px] text-[#737373] shrink-0">${mediaItems.length} arch.</span>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-1.5 content-start pr-0.5">
            ${mediaItems.length
              ? mediaItems.map((m, mIdx) => {
                  const isVideo = /\.(mp4|mov|webm)$/i.test(m.name || '') || /VIDEO/i.test(m.meta || '');
                  const isPdf = /\.pdf$/i.test(m.name || '') || /PDF/i.test(m.meta || '');
                  const typeTag = isVideo ? 'VID' : (isPdf ? 'PDF' : 'IMG');
                  const statusCls = m.status === 'Aprobado'
                    ? 'text-emerald-400 bg-emerald-500/15'
                    : 'text-obsidian-amber bg-amber-500/15';
                  const verCount = Array.isArray(m.versions) && m.versions.length ? m.versions.length : 1;
                  const isSelMedia = activeIdx === mIdx;
                  return `
                    <button type="button" data-dk-select-media="${mIdx}"
                      class="text-left p-2 rounded-lg bg-[#202020] hover:bg-[#262626] border ${isSelMedia ? 'border-obsidian-amber/80 bg-[#252525]' : 'border-obsidian-border'} transition-colors cursor-pointer flex flex-col gap-1 min-w-0">
                      <div class="h-12 rounded bg-[#141414] border border-obsidian-border/70 flex items-center justify-between px-2 overflow-hidden">
                        <span class="font-mono text-[9px] font-semibold text-[#8C8C8C]">${typeTag}</span>
                        <span class="px-1 py-0.5 rounded bg-[#222222] font-mono text-[8px] text-[#D4D4D4]">v${verCount}</span>
                      </div>
                      <div class="text-[9.5px] text-[#D4D4D4] truncate" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>
                      <div class="flex items-center justify-between gap-1">
                        <span class="text-[8.5px] font-mono text-[#737373] truncate">${escapeHtml(m.taskTitle || 'OT')}</span>
                        <span class="px-1 rounded text-[8px] font-mono shrink-0 ${statusCls}">${escapeHtml(m.status || 'Rev.')}</span>
                      </div>
                    </button>
                  `;
                }).join('')
              : `<div class="col-span-2 py-6 text-center text-[10px] font-mono text-[#5A5A5A]">Sin archivos en esta OT</div>`
            }
          </div>
        </div>

        <!-- 02.2: Previsualización del archivo seleccionado -->
        <div class="p-3 flex flex-col min-h-0">
          <div class="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-obsidian-border/70 shrink-0">
            <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold">Vista previa</span>
            <div class="flex items-center gap-1.5 shrink-0">
              <button type="button" data-dk-q4-close-ctx="1" title="Cerrar galería y volver a calendarios (Esc)"
                class="px-2 py-0.5 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[9px] font-mono text-[#D4D4D4] hover:text-obsidian-amber transition-colors cursor-pointer">Cerrar</button>
              ${collapseBtnHtml}
            </div>
          </div>
          <div class="flex-1 min-h-0 flex flex-col">
            ${selectedMedia
              ? renderMediaPreviewHtml(selectedMedia)
              : `<div class="flex-1 flex items-center justify-center text-[10px] font-mono text-[#5A5A5A]">Sin archivo para previsualizar</div>`
            }
          </div>
        </div>
      </div>
    `;
  };

  const renderQ4Content = (dragHandleHtml = '', collapseBtnHtml = '') => `
    <div class="relative p-3 border-t-2 border-t-cyan-500/65 flex flex-col justify-between min-h-0 flex-1 group hover:bg-[#202020]/25 transition-colors">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9px] text-[#5A5A5A] tracking-wider uppercase truncate">04 // CUADRANTE INF. DER</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[9px] font-mono text-[#3a3a3a] group-hover:text-[#737373] transition-colors">VACÍO</span>
          ${collapseBtnHtml}
        </div>
      </div>
      <div class="flex flex-col items-center justify-center flex-1 py-4">
        <svg class="w-3 h-3 text-[#3a3a3a] mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4v16m8-8H4"></path>
        </svg>
        <span class="text-[10px] text-[#5A5A5A] font-mono tracking-wide">Área disponible</span>
      </div>
      <div class="flex items-center justify-between text-[9px] font-mono text-[#3a3a3a]">
        <span>PANEL_04</span>
        <span>--:--</span>
      </div>
    </div>
  `;

  const getQuadrantCollapsedLabel = (modId) => {
    if (modId === 'priorities') return 'Prioridades · Urgentes · Hoy · Mañana';
    if (modId === 'calendar') {
      return selectedContextOt
        ? `Galería · ${escapeHtml(String(selectedContextOt.id || '').replace(/^OT-/i, ''))}`
        : (q2ViewMode === 'month' ? 'Mes' : 'Semanas · Esta semana · Semana próxima');
    }
    if (modId === 'stats') return `Estadística · ${escapeHtml(statsChartTitle)}`;
    return '04 // Cuadrante disponible';
  };

  let fullStatsPanelLightboxHtml = '';

  const wsOpenOrdersForLb = trafficOrders.filter((o) => !o.archived);
  const lbWsTabsHtml = activeWorkspaces.length >= 2
    ? `
      <div class="inline-flex items-center gap-1 font-mono text-[9.5px] overflow-x-auto">
        <button type="button" data-dk-lb-ws="studio"
          class="px-2 py-0.5 rounded transition-colors cursor-pointer shrink-0 ${activeWsId === 'studio' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">
          Estudio <span class="text-[#8C8C8C] font-normal ml-0.5">${wsOpenOrdersForLb.length}</span>
        </button>
        ${activeWorkspaces.map((ws) => {
          const cnt = wsOpenOrdersForLb.filter((o) => (o.workspaceId || 'diseno-publicidad') === ws.id).length;
          const isAct = activeWsId === ws.id;
          return `
            <button type="button" data-dk-lb-ws="${escapeHtml(ws.id)}"
              class="px-2 py-0.5 rounded transition-colors cursor-pointer shrink-0 ${isAct ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">
              ${escapeHtml(ws.shortName || ws.name)} <span class="font-semibold ml-0.5" style="color:${escapeHtml(ws.color || '#8C8C8C')}">${cnt}</span>
            </button>
          `;
        }).join('')}
      </div>
    `
    : '';

  const renderExpandPanelBtn = (modId) => `
    <button type="button" data-dk-lb-open-panel="${escapeHtml(modId)}" title="Abrir panel en caja de luz"
      class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#A3A3A3] hover:text-obsidian-amber flex items-center justify-center cursor-pointer transition-colors shrink-0">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
        <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
      </svg>
    </button>
  `;

  const renderQuadrantModule = (modId, slotIdx, { collapseTarget = '', borderBottomClass = '', slotClass = 'flex-1', inLightbox = false } = {}) => {
    const dragHandleHtml = inLightbox ? '' : renderDragHandle(slotIdx);
    const collapseBtnHtml = inLightbox ? '' : renderCollapseBtn(collapseTarget);
    const expandBtnHtml = (!inLightbox && modId !== 'empty') ? renderExpandPanelBtn(modId) : '';
    const rightActionBtns = `${expandBtnHtml}${collapseBtnHtml}`;
    let innerHtml = '';

    if (modId === 'priorities') {
      innerHtml = `
        <div class="flex-1 grid grid-cols-1 md:grid-cols-3 min-h-0">
          ${renderQ1Column({
            colKey: 'urgent',
            title: 'Urgentes',
            ots: urgentOts,
            tasks: urgentTasks,
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
    } else if (modId === 'calendar') {
      innerHtml = selectedContextOt
        ? renderQ2GalleryOverlay('border-t-2 border-t-obsidian-amber/80', dragHandleHtml, rightActionBtns)
        : (q2ViewMode === 'month'
            ? renderQ2MonthView({ borderClass: 'border-t-2 border-t-emerald-500/70', dragHandleHtml, collapseBtnHtml: rightActionBtns })
            : `<div class="flex-1 grid grid-rows-2 min-h-0">
                ${renderQ2WeekRow({
                  rowKey: 'thisWeek',
                  title: 'Esta Semana',
                  anchorIso: todayKey,
                  borderClass: 'border-t-2 border-t-emerald-500/70 border-b border-obsidian-border',
                  dragHandleHtml,
                  collapseBtnHtml: rightActionBtns,
                  showViewSwitch: true,
                })}
                ${renderQ2WeekRow({
                  rowKey: 'nextWeek',
                  title: 'Semana Próxima',
                  anchorIso: nextWeekAnchor,
                  borderClass: '',
                  navigable: true,
                })}
              </div>`);
    } else if (modId === 'stats') {
      const renderSelectOpts = (items, currentVal, allLabel = 'Todos') => `
        <option value="all" ${currentVal === 'all' ? 'selected' : ''}>${escapeHtml(allLabel)}</option>
        ${items.map((it) => {
          const val = typeof it === 'string' ? it : it.value;
          const lbl = typeof it === 'string' ? it : it.label;
          return `<option value="${escapeHtml(val)}" ${currentVal === val ? 'selected' : ''}>${escapeHtml(lbl)}</option>`;
        }).join('')}
      `;

      const selectCls = (active) =>
        `w-full bg-[#141414] border ${active ? 'border-obsidian-amber/70 text-[#D4D4D4]' : 'border-obsidian-border text-[#A3A3A3]'} rounded px-1.5 py-0.5 text-[9.5px] focus:outline-none focus:border-obsidian-amber/80 cursor-pointer`;

      const {
        rbac: stRbac,
        universe: stUniverse,
        resolvedGroupBy,
        cascadingOptions,
        rows: statsGroupRows,
        totalMetricVal: statsTotalMetricVal,
        maxRowVal: statsMaxRowVal,
        totalOts: statsTotalOts,
        totalTasks: statsTotalTasks,
        totalHours: statsTotalHours,
        showTargetLine: showRespTarget,
        targetVal: respTargetVal,
        activeAnchorChips: activeFilterChips,
        hasActiveAnchors: hasActiveStatsFilters,
        effectiveState: stEff,
      } = statsQuery;
      const stAnchors = stEff.anchors;

      const computeNiceMax = (rawMax) => {
        const m = Math.max(1, rawMax);
        if (m <= 4) return 4;
        if (m <= 8) return 8;
        if (m <= 12) return 12;
        if (m <= 16) return 16;
        if (m <= 20) return 20;
        const step = Math.ceil(m / 4 / 5) * 5;
        return step * 4;
      };

      const horizNiceMax = computeNiceMax(
        showRespTarget ? Math.max(statsMaxRowVal, respTargetVal * 1.05) : statsMaxRowVal * 1.12
      );
      const horizTargetPct = showRespTarget ? Math.min(96, Math.round((respTargetVal / horizNiceMax) * 100)) : null;
      const horizTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(horizNiceMax * f));
      const tickUnit = stEff.metric === 'hours' ? 'h' : '';

      const presetTabs = [
        { id: 'capacidad', lbl: 'Capacidad' },
        { id: 'espacio', lbl: 'Espacio' },
        { id: 'clientes', lbl: 'Clientes' },
        ...(stRbac.canSeeFinancial ? [{ id: 'facturacion', lbl: 'Facturación' }] : []),
      ];

      const effectiveStatsPill = effectiveStatsPillForQuery;

      const pillBoard = renderStatsPillChartsGrid({
        pillId: effectiveStatsPill,
        allOrders: trafficOrders,
        scopedOrders,
        anchors: stAnchors,
        metric: stEff.metric,
        todayKey,
        tomorrowKey,
        dailyHours,
        activeWsId,
        deptPageWsId: deptChartPageWsId,
        isPersonalScope,
        myMember,
        canSeeFinancial: stRbac.canSeeFinancial,
      });
      lastPillBoard = pillBoard;
      if (lightboxChartIdx !== null && (!pillBoard.cards || !pillBoard.cards[lightboxChartIdx])) {
        lightboxChartIdx = null;
      }
      const vizBodyHtml = pillBoard.html;

      const statsKpiRowsHtml = `
        <div class="p-1.5 border-b border-obsidian-border flex flex-col gap-1 shrink-0 bg-[#171717]">
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-1">
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
          </div>
          <div class="grid grid-cols-2 ${showFinalizadasKpi ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-1">
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
          </div>
        </div>
      `;

      innerHtml = `
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

              <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5 text-[9.5px]">
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

      if (panelLightboxModId === 'stats' && lightboxChartIdx === null) {
        const filtersMarkup = `
          <div class="flex items-center justify-between gap-1 pb-2 mb-2 border-b border-obsidian-border/70 shrink-0">
            <span class="font-mono text-[9px] uppercase tracking-wider text-[#A3A3A3] font-semibold">Filtros</span>
            <button type="button" data-dk-st-reset="1" title="Limpiar filtros"
              class="w-5 h-5 rounded hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors ${hasActiveStatsFilters ? 'text-obsidian-amber' : 'text-[#5A5A5A] hover:text-[#A3A3A3]'}">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pr-0.5 text-[10px]">
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-[#8C8C8C]">Tiempo</span>
              <select data-dk-st-filter="time"
                ${cascadingOptions.timeDisabled ? 'disabled title="Horizonte fijado por la Vista Rápida"' : ''}
                class="${selectCls(stAnchors.time !== 'all' || cascadingOptions.timeDisabled)} ${cascadingOptions.timeDisabled ? 'opacity-65 cursor-not-allowed' : ''}">
                ${cascadingOptions.timeDisabled
                  ? `<option value="all" selected>${escapeHtml(cascadingOptions.timeLockedLabel)}</option>`
                  : renderSelectOpts(cascadingOptions.time, stAnchors.time || 'all', 'Todas las fechas')}
              </select>
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-[#8C8C8C]">Estudio / Perfil</span>
              <select data-dk-st-filter="workspace"
                ${cascadingOptions.workspaceDisabled ? 'disabled title="Perfil fijado desde la barra superior"' : ''}
                class="${selectCls(stAnchors.workspace !== 'all' || cascadingOptions.workspaceDisabled)} ${cascadingOptions.workspaceDisabled ? 'opacity-65 cursor-not-allowed' : ''}">
                ${cascadingOptions.workspaceDisabled
                  ? `<option value="all" selected>${escapeHtml(cascadingOptions.workspaceLockedLabel)}</option>`
                  : renderSelectOpts(cascadingOptions.workspace, stAnchors.workspace, 'Estudio')}
              </select>
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-[#8C8C8C]">Cliente</span>
              <select data-dk-st-filter="client" class="${selectCls(stAnchors.client !== 'all')}">
                ${renderSelectOpts(cascadingOptions.client, stAnchors.client, 'Todos')}
              </select>
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-[#8C8C8C]">Depto</span>
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
                <span class="text-[9px] text-[#8C8C8C]">Responsable</span>
                <select data-dk-st-filter="responsible" class="${selectCls(stAnchors.responsible !== 'all')}">
                  ${renderSelectOpts(cascadingOptions.responsible, stAnchors.responsible, 'Todos')}
                </select>
              </label>
            ` : ''}
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-[#8C8C8C]">Etapa</span>
              <select data-dk-st-filter="stage" class="${selectCls(stAnchors.stage !== 'all')}">
                ${renderSelectOpts(cascadingOptions.stage, stAnchors.stage, 'Todas')}
              </select>
            </label>
            <label class="flex flex-col gap-0.5">
              <span class="text-[9px] text-[#8C8C8C]">Estado</span>
              <select data-dk-st-filter="status" class="${selectCls(stAnchors.status !== 'all')}">
                ${renderSelectOpts(cascadingOptions.status, stAnchors.status, 'Todos')}
              </select>
            </label>
          </div>
        `;

        const wideKpiRowHtml = `
          <div class="p-2 border-b border-obsidian-border bg-[#161616] grid grid-cols-2 sm:grid-cols-4 ${showFinalizadasKpi ? 'xl:grid-cols-8' : 'xl:grid-cols-7'} gap-1.5 shrink-0">
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
          </div>
        `;

        fullStatsPanelLightboxHtml = `
          <div id="dk-stats-panel-lightbox" data-dk-lb-backdrop="1"
            class="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
            <div class="w-full max-w-[1440px] h-[90vh] bg-[#171717] border border-obsidian-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
              <div class="px-4 py-2.5 border-b border-obsidian-border bg-[#1c1c1c] flex items-center justify-between gap-3 shrink-0">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="font-mono text-[10px] text-obsidian-amber uppercase tracking-wider font-semibold shrink-0">Estadística</span>
                  <span class="text-[#4A4A4A]">·</span>
                  <span class="font-mono text-[11px] text-[#F0F0F0] uppercase tracking-wider font-semibold truncate">${escapeHtml(pillBoard.title)}</span>
                </div>
                ${lbWsTabsHtml}
                <div class="flex items-center gap-2.5 font-mono text-[9.5px] text-[#8C8C8C] shrink-0">
                  ${!pillBoard.isDayMode ? `
                    <div class="inline-flex items-center gap-0.5 text-[9.5px] font-mono">
                      <button type="button" data-dk-st-metric="${pillBoard.isTasksMode ? 'tasks' : 'ots'}"
                        class="px-2 py-0.5 rounded transition-colors cursor-pointer ${stEff.metric !== 'hours' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">${pillBoard.isTasksMode ? 'Tareas' : 'OTs'}</button>
                      <button type="button" data-dk-st-metric="hours"
                        class="px-2 py-0.5 rounded transition-colors cursor-pointer ${stEff.metric === 'hours' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Horas</button>
                    </div>
                    <span class="w-px h-3.5 bg-obsidian-border"></span>
                  ` : ''}
                  <span>${escapeHtml(pillBoard.countLabel)}</span>
                  <span>·</span>
                  <span class="text-[#D4D4D4] font-semibold">${pillBoard.totalHours}h</span>
                  <span class="w-px h-3.5 bg-obsidian-border"></span>
                  <button type="button" data-dk-lb-close="1" title="Cerrar (Esc)"
                    class="px-2.5 py-1 rounded text-[10px] font-mono text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors">Cerrar</button>
                </div>
              </div>
              ${wideKpiRowHtml}
              <div class="flex-1 min-h-0 flex divide-x divide-obsidian-border">
                <div class="flex-1 min-w-0 p-3 flex flex-col min-h-0 bg-[#171717]">
                  ${activeFilterChips.length ? `
                    <div class="flex items-center flex-wrap gap-1.5 mb-2.5 shrink-0">
                      ${activeFilterChips.map((ch) => `
                        <button type="button" data-dk-st-clear-filter="${escapeHtml(ch.key)}" title="Quitar filtro"
                          class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#222222] hover:bg-[#2a2a2a] border border-obsidian-amber/40 text-[9px] font-mono text-[#D4D4D4] cursor-pointer transition-colors">
                          <span>${escapeHtml(ch.label)}</span>
                          <span class="text-obsidian-amber">×</span>
                        </button>
                      `).join('')}
                    </div>
                  ` : ''}
                  ${pillBoard.wideHtml}
                </div>
                <div class="w-[185px] shrink-0 p-3 flex flex-col min-h-0 bg-[#151515]">
                  ${filtersMarkup}
                </div>
              </div>
            </div>
          </div>
        `;
      }
    } else {
      innerHtml = renderQ4Content(dragHandleHtml, collapseBtnHtml);
    }

    return `
      <div data-dk-drop-slot="${slotIdx}" class="${slotClass} flex flex-col min-h-0 ${borderBottomClass} transition-shadow">
        ${innerHtml}
      </div>
    `;
  };

  const renderGenericPanelLightboxHtml = () => {
    if (!panelLightboxModId || panelLightboxModId === 'stats') return '';
    const title = panelLightboxModId === 'priorities'
      ? 'Prioridades · Urgentes · Hoy · Mañana'
      : (selectedContextOt
          ? `Galería · ${String(selectedContextOt.id || '').replace(/^OT-/i, '')}`
          : (q2ViewMode === 'month' ? 'Calendario · Mes' : 'Calendario · Semanas'));
    return `
      <div id="dk-generic-panel-lightbox" data-dk-lb-backdrop="1"
        class="fixed inset-0 z-50 bg-black/80 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-6">
        <div class="w-full max-w-[1440px] h-[90vh] bg-[#191919] border border-obsidian-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
          <div class="px-4 py-2.5 border-b border-obsidian-border bg-[#1c1c1c] flex items-center justify-between gap-3 shrink-0">
            <span class="font-mono text-[11px] text-[#F0F0F0] uppercase tracking-wider font-semibold truncate">${escapeHtml(title)}</span>
            ${lbWsTabsHtml}
            <button type="button" data-dk-lb-close="1" title="Cerrar (Esc)"
              class="px-2.5 py-1 rounded text-[10px] font-mono text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors shrink-0">Cerrar</button>
          </div>
          <div class="flex-1 min-h-0 flex flex-col">
            ${renderQuadrantModule(panelLightboxModId, -1, { inLightbox: true })}
          </div>
        </div>
      </div>
    `;
  };

  container.innerHTML = `
    ${canSwitchGlobal ? `
      <div class="flex items-center justify-between gap-2 shrink-0 px-0.5">
        <span class="font-mono text-[9px] uppercase tracking-wider text-[#737373]">
          ${isPersonalScope ? `Escritorio Personal · ${escapeHtml(myMember)}` : 'Escritorio Global · Estudio'}
        </span>
        <div class="inline-flex items-center gap-1 text-[9.5px] font-mono shrink-0">
          <button type="button" data-dk-scope-mode="global"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer ${!isPersonalScope ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Global</button>
          <button type="button" data-dk-scope-mode="personal"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer ${isPersonalScope ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Personal</button>
        </div>
      </div>
    ` : ''}

    <!-- Espacio acuartelado 2×2 (intercambiable por arrastre · mitad derecha colapsable) -->
    <div class="flex-1 min-h-[420px] grid grid-cols-1 lg:grid-cols-2 border border-obsidian-border rounded-xl overflow-hidden bg-[#191919]">
      <!-- Mitad izquierda: Slot 0 (arriba) + Slot 2 (abajo) -->
      <div class="grid grid-rows-2 border-b lg:border-b-0 lg:border-r border-obsidian-border min-h-0">
        ${renderQuadrantModule(quadrantOrder[0], 0, { borderBottomClass: 'border-b border-obsidian-border' })}
        ${renderQuadrantModule(quadrantOrder[2], 2)}
      </div>

      <!-- Mitad derecha: Slot 1 (arriba) + Slot 3 (abajo), colapsables -->
      <div class="flex flex-col min-h-0">
        ${rightCollapseMode === 'q2'
          ? `
            <button type="button" data-dk-drop-slot="1" data-dk-collapse-right="none" title="Expandir cuadrante superior"
              class="h-7 px-3 border-b border-obsidian-border bg-[#1d1d1d] hover:bg-[#242424] flex items-center justify-between gap-2 shrink-0 cursor-pointer transition-colors">
              <span class="font-mono text-[9px] text-[#8C8C8C] tracking-wider uppercase truncate">${getQuadrantCollapsedLabel(quadrantOrder[1])}</span>
              <span class="inline-flex items-center gap-1 font-mono text-[9.5px] text-obsidian-amber shrink-0">
                <span>Expandir</span>
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </button>
            ${renderQuadrantModule(quadrantOrder[3], 3, { collapseTarget: 'q4' })}
          `
          : (rightCollapseMode === 'q4'
              ? `
                ${renderQuadrantModule(quadrantOrder[1], 1, { collapseTarget: 'q2' })}
                <button type="button" data-dk-drop-slot="3" data-dk-collapse-right="none" title="Expandir cuadrante inferior"
                  class="h-7 px-3 border-t border-obsidian-border bg-[#1d1d1d] hover:bg-[#242424] flex items-center justify-between gap-2 shrink-0 cursor-pointer transition-colors">
                  <span class="font-mono text-[9px] text-[#8C8C8C] tracking-wider uppercase truncate">${getQuadrantCollapsedLabel(quadrantOrder[3])}</span>
                  <span class="inline-flex items-center gap-1 font-mono text-[9.5px] text-obsidian-amber shrink-0">
                    <span>Expandir</span>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                  </span>
                </button>
              `
              : `
                ${renderQuadrantModule(quadrantOrder[1], 1, { collapseTarget: 'q2', borderBottomClass: 'border-b border-obsidian-border' })}
                ${renderQuadrantModule(quadrantOrder[3], 3, { collapseTarget: 'q4', slotClass: 'h-[140px] shrink-0' })}
              `)
        }
      </div>
    </div>
    ${lightboxChartIdx !== null && lastPillBoard
      ? renderChartLightboxHtml({
          pillBoard: lastPillBoard,
          activeIdx: lightboxChartIdx,
          activeFilterChips: statsQuery.activeAnchorChips || [],
          showBackToPanel: panelLightboxModId === 'stats',
        })
      : (panelLightboxModId === 'stats' ? fullStatsPanelLightboxHtml : renderGenericPanelLightboxHtml())}
  `;

  // Render Inspector mini-calendar pinned at the bottom
  renderInspectorMiniCalendar({
    anchorDate: selectedCalendarDate,
    busyDates,
    onSelectDate: (iso) => {
      selectedCalendarDate = iso;
      monthAnchorIso = iso;
      if (getIsoMonday(iso) !== thisWeekMonIso) {
        nextWeekAnchorIso = iso;
      }
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    },
  });

  const openOt = (otId, taskIndex = null) => {
    if (!otId) return;
    if (typeof lastCallbacks.onOpenOt === 'function') {
      lastCallbacks.onOpenOt({ otId, taskIndex, scope: 'active' });
    } else {
      notifySketchChange('open-ot', { otId, taskIndex, scope: 'active' });
    }
  };

  // In idle state (no OT selected), render Estadística drill-down list (if active) or global Mensajes & Actividad inside Inspector (#insp-content-slot)
  const inspContentSlot = document.getElementById('insp-content-slot');
  const activeStatsDrill = selectedStatsDrillKey && lastPillBoard?.drillMap
    ? (lastPillBoard.drillMap.get(selectedStatsDrillKey) || null)
    : null;
  if (selectedStatsDrillKey && !activeStatsDrill) {
    selectedStatsDrillKey = null;
    if (inspIdleTab === 'drill') inspIdleTab = 'messages';
  }
  if (!activeStatsDrill && inspIdleTab === 'drill') {
    inspIdleTab = 'messages';
  }

  if (inspContentSlot && !selectedContextOt && activeStatsDrill && inspIdleTab === 'drill') {
    inspContentSlot.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-obsidian-border sticky top-0 bg-[#191919] z-10">
          <div class="inline-flex items-center gap-0.5 text-[9px] font-mono w-full">
            <button type="button" data-dk-insp-tab="messages"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center text-[#737373] hover:text-[#D4D4D4]">Mensajes <span class="text-[#5A5A5A]">${visibleMessages.length}</span></button>
            <button type="button" data-dk-insp-tab="activity"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center text-[#737373] hover:text-[#D4D4D4]">Actividad <span class="text-[#5A5A5A]">${visibleTrace.length}</span></button>
            <button type="button" data-dk-insp-tab="drill"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center bg-obsidian-elevated text-[#D4D4D4] font-semibold">Lista <span class="text-obsidian-amber">${activeStatsDrill.items.length}</span></button>
          </div>
        </div>

        <div class="pb-1.5 border-b border-obsidian-border/70">
          <div class="flex items-start justify-between gap-1.5">
            <div class="min-w-0">
              <div class="font-mono text-[8px] uppercase tracking-wider text-obsidian-amber truncate">${escapeHtml(activeStatsDrill.category)} · ${escapeHtml(activeStatsDrill.boardTitle)}</div>
              <div class="text-[11px] font-semibold text-[#F0F0F0] truncate mt-0.5">${escapeHtml(activeStatsDrill.title)}</div>
              <div class="font-mono text-[8.5px] text-[#8C8C8C] mt-0.5">${activeStatsDrill.items.length} ${escapeHtml(activeStatsDrill.itemNoun)} · <span class="text-[#D4D4D4]">${activeStatsDrill.totalHours}h</span></div>
            </div>
            <button type="button" data-dk-insp-clear-drill="1" title="Cerrar lista"
              class="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors shrink-0">×</button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          ${activeStatsDrill.items.length
            ? activeStatsDrill.items.map((it, idx) => {
                const hasOt = !!it.otId;
                const shortCode = hasOt
                  ? (it.taskIndex !== null && it.taskIndex !== undefined
                      ? `${String(it.otId || '').replace(/^OT-/i, '')}.${it.taskIndex + 1}`
                      : String(it.otId || '').replace(/^OT-/i, ''))
                  : (it.badge || 'LIBRE');
                const cColor = it.client === 'Estudio' ? '#a855f7' : (it.client === 'Agenda' ? '#94a3b8' : getClientColor(it.client));
                const dKey = (it.deliveryDate || '').slice(0, 10);
                const isOverdue = hasOt && dKey && dKey < todayKey;
                const isTodayDue = dKey === todayKey;
                const dateLbl = dKey ? `${dKey.slice(8, 10)}/${dKey.slice(5, 7)}` : '—';
                const otAttrs = hasOt
                  ? `data-dk-drill-select-ot="${escapeHtml(it.otId)}" data-dk-drill-task-idx="${it.taskIndex !== null && it.taskIndex !== undefined ? it.taskIndex : ''}" data-dk-drill-key="drill:${escapeHtml(it.id)}:${idx}"`
                  : '';
                return `
                  <div ${otAttrs}
                    class="px-2 py-1.5 rounded-md bg-[#202020] ${hasOt ? 'hover:bg-[#262626] cursor-pointer' : ''} border border-obsidian-border/70 transition-colors flex flex-col gap-0.5">
                    <div class="flex items-center justify-between gap-1">
                      <span class="inline-flex items-center gap-1 min-w-0">
                        ${hasOt ? getPriorityDotHtml(it, todayKey, tomorrowKey, 'w-1.5 h-1.5') : ''}
                        ${hasOt
                          ? `<button type="button" data-dk-drill-open-ot="${escapeHtml(it.otId)}" data-dk-drill-open-task="${it.taskIndex !== null && it.taskIndex !== undefined ? it.taskIndex : ''}" title="Abrir OT"
                              class="font-mono text-[9.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortCode)}</button>`
                          : `<span class="font-mono text-[8.5px] font-semibold text-[#A3A3A3] shrink-0">${escapeHtml(shortCode)}</span>`}
                        <span class="font-mono text-[8px] text-[#737373] shrink-0">${Number(it.hours) || 0}h</span>
                      </span>
                      <span class="font-mono text-[8.5px] ${isOverdue ? 'text-rose-300 font-semibold' : (isTodayDue ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]')} shrink-0">${escapeHtml(dateLbl)}</span>
                    </div>
                    <div class="text-[10px] text-[#D4D4D4] line-clamp-2 leading-snug" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</div>
                    <div class="flex items-center justify-between gap-1 text-[8.5px]">
                      <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(it.client)}</span>
                      <span class="truncate shrink-0 text-[#8C8C8C]">${escapeHtml(it.responsible)}</span>
                    </div>
                  </div>
                `;
              }).join('')
            : `<div class="py-4 text-center text-[9.5px] font-mono text-[#5A5A5A]">Sin elementos</div>`
          }
        </div>
      </div>
    `;

    inspContentSlot.querySelectorAll('[data-dk-insp-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.dkInspTab;
        if (next && next !== inspIdleTab) {
          inspIdleTab = next;
          renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
        }
      });
    });

    inspContentSlot.querySelector('[data-dk-insp-clear-drill]')?.addEventListener('click', () => {
      selectedStatsDrillKey = null;
      inspIdleTab = 'messages';
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });

    inspContentSlot.querySelectorAll('[data-dk-drill-open-ot]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tIdx = btn.dataset.dkDrillOpenTask !== '' ? Number(btn.dataset.dkDrillOpenTask) : null;
        openOt(btn.dataset.dkDrillOpenOt, tIdx);
      });
    });

    inspContentSlot.querySelectorAll('[data-dk-drill-select-ot]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const otId = row.dataset.dkDrillSelectOt;
        const tIdx = row.dataset.dkDrillTaskIdx !== '' ? Number(row.dataset.dkDrillTaskIdx) : null;
        selectedCardKey = row.dataset.dkDrillKey;
        selectedContextOtId = otId;
        selectedContextTaskIdx = tIdx;
        selectedMediaIndex = null;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
        renderTrafficNotesInspector(otId, tIdx !== null ? String(tIdx) : '', false, { onOpenOt: (id) => openOt(id, tIdx) });
      });
      row.addEventListener('dblclick', () => {
        const tIdx = row.dataset.dkDrillTaskIdx !== '' ? Number(row.dataset.dkDrillTaskIdx) : null;
        openOt(row.dataset.dkDrillSelectOt, tIdx);
      });
    });
  } else if (inspContentSlot && !selectedContextOt) {
    const getInitials = (name) => String(name || '?').trim().split(/\s+/).map((p) => p[0] || '').join('').slice(0, 2).toUpperCase();
    inspContentSlot.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-obsidian-border sticky top-0 bg-[#191919] z-10">
          <div class="inline-flex items-center gap-0.5 text-[9px] font-mono w-full">
            <button type="button" data-dk-insp-tab="messages"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center ${inspIdleTab === 'messages' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Mensajes <span class="${inspIdleTab === 'messages' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${visibleMessages.length}</span></button>
            <button type="button" data-dk-insp-tab="activity"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center ${inspIdleTab === 'activity' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Actividad <span class="${inspIdleTab === 'activity' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${visibleTrace.length}</span></button>
            ${activeStatsDrill ? `
              <button type="button" data-dk-insp-tab="drill"
                class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center text-[#737373] hover:text-[#D4D4D4]">Lista <span class="text-obsidian-amber">${activeStatsDrill.items.length}</span></button>
            ` : ''}
          </div>
        </div>

        ${inspIdleTab === 'messages'
          ? `
            <div class="flex flex-col gap-1">
              ${visibleMessages.length
                ? visibleMessages.map((msg, idx) => {
                    const isUrg = msg.priority === 'urgent';
                    const isImp = msg.priority === 'important';
                    const accentCls = isUrg
                      ? 'border-l-2 border-l-rose-400 bg-rose-500/5 hover:bg-rose-500/10'
                      : (isImp
                          ? 'border-l-2 border-l-obsidian-amber bg-amber-500/5 hover:bg-amber-500/10'
                          : 'hover:bg-[#222222]');
                    const chLabel = msg.channel === 'WhatsApp' ? 'WA' : 'App';
                    return `
                      <div data-dk-insp-select-ot="${escapeHtml(msg.otId)}" data-dk-insp-key="msg:${escapeHtml(msg.otId)}:${idx}"
                        class="px-1.5 py-1.5 rounded-md ${accentCls} transition-colors cursor-pointer flex items-start gap-1.5">
                        <span class="w-4 h-4 rounded-full bg-[#242424] border border-obsidian-border text-[7.5px] font-mono font-semibold text-[#D4D4D4] flex items-center justify-center shrink-0 mt-0.5">${escapeHtml(getInitials(msg.actor))}</span>
                        <div class="min-w-0 flex-1 leading-snug">
                          <div class="flex items-center justify-between gap-1">
                            <span class="inline-flex items-center gap-1 min-w-0">
                              <span class="text-[9.5px] font-semibold text-[#D4D4D4] truncate">${escapeHtml(msg.actor)}</span>
                              <button type="button" data-dk-insp-open-ot="${escapeHtml(msg.otId)}" title="Abrir OT"
                                class="font-mono text-[8.5px] text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(msg.shortCode)}</button>
                              <span class="px-1 rounded bg-[#141414] font-mono text-[7px] text-[#737373] shrink-0">${chLabel}</span>
                            </span>
                            <span class="font-mono text-[7.5px] text-[#5A5A5A] shrink-0">${escapeHtml(msg.at)}</span>
                          </div>
                          <div class="text-[9.5px] text-[#B8B8B8] line-clamp-2 mt-0.5">${escapeHtml(msg.text)}</div>
                        </div>
                      </div>
                    `;
                  }).join('')
                : `<div class="py-4 text-center text-[9.5px] font-mono text-[#5A5A5A]">Sin mensajes</div>`
              }
            </div>
          `
          : `
            <div class="inline-flex items-center bg-[#141414] border border-obsidian-border rounded-md p-0.5 text-[8.5px] font-mono self-start">
              ${[
                ['all', 'Todo'],
                ['routes', 'Bitácora'],
                ['activity', 'Cambios'],
              ].map(([key, lbl]) => `
                <button type="button" data-dk-insp-filter="${key}"
                  class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${q4TraceFilter === key ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">${escapeHtml(lbl)}</button>
              `).join('')}
            </div>
            <div class="flex flex-col gap-1">
              ${visibleTrace.length
                ? visibleTrace.map((ev, idx) => {
                    const badgeHtml = ev.kind === 'route'
                      ? `<div class="font-mono text-[8.5px] truncate mt-0.5">
                          <span style="color:${escapeHtml(getDepartmentColor(ev.from))}">${escapeHtml(ev.from)}</span>
                          <span class="text-[#5A5A5A]">→</span>
                          <span style="color:${escapeHtml(getDepartmentColor(ev.to))}">${escapeHtml(ev.to)}</span>
                        </div>`
                      : `<div class="text-[9px] text-[#8C8C8C] line-clamp-2 mt-0.5">${escapeHtml(ev.text)}</div>`;
                    return `
                      <div data-dk-insp-select-ot="${escapeHtml(ev.otId)}" data-dk-insp-key="trace:${escapeHtml(ev.otId)}:${idx}"
                        class="px-2 py-1.5 rounded-md bg-[#202020] hover:bg-[#262626] border border-obsidian-border/60 cursor-pointer transition-colors">
                        <div class="flex items-center justify-between gap-1">
                          <span class="inline-flex items-center gap-1 min-w-0">
                            <button type="button" data-dk-insp-open-ot="${escapeHtml(ev.otId)}" title="Abrir OT"
                              class="font-mono text-[9px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(ev.shortCode)}</button>
                            <span class="text-[9px] text-[#D4D4D4] truncate">${escapeHtml(ev.actor)}</span>
                          </span>
                          <span class="font-mono text-[7.5px] text-[#5A5A5A] shrink-0">${escapeHtml(ev.at)}</span>
                        </div>
                        ${badgeHtml}
                      </div>
                    `;
                  }).join('')
                : `<div class="py-4 text-center text-[9.5px] font-mono text-[#5A5A5A]">Sin movimientos</div>`
              }
            </div>
          `
        }
      </div>
    `;

    inspContentSlot.querySelectorAll('[data-dk-insp-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.dkInspTab;
        if (next && next !== inspIdleTab) {
          inspIdleTab = next;
          renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
        }
      });
    });

    inspContentSlot.querySelectorAll('[data-dk-insp-filter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.dkInspFilter;
        if (next && next !== q4TraceFilter) {
          q4TraceFilter = next;
          renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
        }
      });
    });

    inspContentSlot.querySelectorAll('[data-dk-insp-open-ot]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        openOt(btn.dataset.dkInspOpenOt, null);
      });
    });

    inspContentSlot.querySelectorAll('[data-dk-insp-select-ot]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const otId = row.dataset.dkInspSelectOt;
        selectedCardKey = row.dataset.dkInspKey;
        selectedContextOtId = otId;
        selectedContextTaskIdx = null;
        selectedMediaIndex = null;
        rightCollapseMode = 'none';
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
        renderTrafficNotesInspector(otId, '', false, { onOpenOt: (id) => openOt(id, null) });
      });
      row.addEventListener('dblclick', () => openOt(row.dataset.dkInspSelectOt, null));
    });
  }

  // Bind Estadística KPI pills (Vista Rápida -> select active board inside Estadística)
  container.querySelectorAll('[data-dk-stats-pill]').forEach((el) => {
    el.addEventListener('click', () => {
      const nextPill = el.dataset.dkStatsPill;
      if (nextPill && nextPill !== activeStatsPill) {
        activeStatsPill = nextPill;
        lightboxChartIdx = null;
        selectedStatsDrillKey = null;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  // Bind Estadística -> Inspector drill-down on chart bars, slices & columns
  container.querySelectorAll('[data-dk-chart-drill]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const key = el.dataset.dkChartDrill;
      if (!key) return;
      selectedStatsDrillKey = key;
      inspIdleTab = 'drill';
      selectedContextOtId = null;
      selectedContextTaskIdx = null;
      lightboxChartIdx = null;
      panelLightboxModId = null;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  // Bind Por Depto local Perfil pager (inside Masonry card and Caja de Luz)
  container.querySelectorAll('[data-dk-dept-page]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextWs = btn.dataset.dkDeptPage;
      if (nextWs && nextWs !== deptChartPageWsId) {
        deptChartPageWsId = nextWs;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  // Bind Caja de Luz (Lightbox) on Masonry chart cards
  container.querySelectorAll('[data-dk-chart-zoom]').forEach((cardEl) => {
    const openZoom = (e) => {
      if (e && e.target && e.target.closest('button, [data-dk-chart-drill]')) return;
      const idx = Number(cardEl.dataset.dkChartZoom);
      if (!Number.isNaN(idx)) {
        lightboxChartIdx = idx;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    };
    cardEl.addEventListener('click', openZoom);
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openZoom();
      }
    });
  });

  // Bind full-panel Caja de Luz trigger & workspace switcher
  container.querySelectorAll('[data-dk-lb-ws]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextWs = btn.dataset.dkLbWs;
      if (nextWs && nextWs !== activeWsId) {
        setActiveWorkspace(nextWs);
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  container.querySelectorAll('[data-dk-lb-open-panel]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panelLightboxModId = btn.dataset.dkLbOpenPanel || 'stats';
      lightboxChartIdx = null;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  container.querySelector('[data-dk-lb-back-panel]')?.addEventListener('click', () => {
    lightboxChartIdx = null;
    panelLightboxModId = 'stats';
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  });

  container.querySelector('[data-dk-lb-backdrop]')?.addEventListener('click', () => {
    lightboxChartIdx = null;
    panelLightboxModId = null;
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  });

  container.querySelector('[data-dk-lb-close]')?.addEventListener('click', () => {
    lightboxChartIdx = null;
    panelLightboxModId = null;
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  });

  container.querySelectorAll('[data-dk-lb-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const total = lastPillBoard?.cards?.length || 0;
      if (!total || lightboxChartIdx === null) return;
      const delta = Number(btn.dataset.dkLbNav || 0);
      lightboxChartIdx = (lightboxChartIdx + delta + total) % total;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  // Bind Q1 column OTs / Tareas switches
  container.querySelectorAll('[data-dk-q1-col]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.dkQ1Col;
      const nextMode = btn.dataset.dkQ1Mode;
      if (col && nextMode && q1Modes[col] !== nextMode) {
        q1Modes[col] = nextMode;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  // Bind Q2 Semana | Mes view switch & Month navigation
  container.querySelectorAll('[data-dk-q2-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextView = btn.dataset.dkQ2View;
      if (nextView && nextView !== q2ViewMode) {
        q2ViewMode = nextView;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  container.querySelectorAll('[data-dk-month-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.dkMonthShift || 0);
      if (!delta) return;
      const y = Number(monthAnchorIso.slice(0, 4));
      const m = Number(monthAnchorIso.slice(5, 7)) - 1;
      const next = new Date(y, m + delta, 1, 12, 0, 0);
      monthAnchorIso = next.toISOString().slice(0, 10);
      selectedCalendarDate = monthAnchorIso;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  container.querySelector('[data-dk-month-reset]')?.addEventListener('click', () => {
    monthAnchorIso = todayKey;
    selectedCalendarDate = todayKey;
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  });

  // Bind Q2 row OTs / Tareas switches
  container.querySelectorAll('[data-dk-q2-row]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.dataset.dkQ2Row;
      const nextMode = btn.dataset.dkQ2Mode;
      if (row && nextMode && q2Modes[row] !== nextMode) {
        q2Modes[row] = nextMode;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  // Bind Q2.2 week navigation (prev / next / reset to next week)
  container.querySelectorAll('[data-dk-q2-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.dkQ2Shift || 0);
      if (!delta) return;
      nextWeekAnchorIso = shiftIsoDate(nextWeekAnchorIso, delta);
      selectedCalendarDate = nextWeekAnchorIso;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  container.querySelector('[data-dk-q2-reset]')?.addEventListener('click', () => {
    nextWeekAnchorIso = defaultNextWeekIso;
    selectedCalendarDate = defaultNextWeekIso;
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  });

  // Bind right-half collapse/expand toggles (02 / 04)
  container.querySelectorAll('[data-dk-collapse-right]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.dkCollapseRight || 'none';
      rightCollapseMode = next === rightCollapseMode ? 'none' : next;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  // Bind 4-slot Drag & Drop quadrant swapping (with localStorage persistence)
  const clearDropHighlights = () => {
    container.querySelectorAll('[data-dk-drop-slot]').forEach((el) => {
      el.classList.remove('ring-2', 'ring-inset', 'ring-obsidian-amber/80', 'opacity-60');
    });
  };

  container.querySelectorAll('[data-dk-drag-slot]').forEach((handle) => {
    handle.addEventListener('dragstart', (e) => {
      const slotIdx = Number(handle.dataset.dkDragSlot);
      if (Number.isNaN(slotIdx)) return;
      draggedSlotIdx = slotIdx;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(slotIdx));
      }
      const sourceSlot = handle.closest('[data-dk-drop-slot]');
      if (sourceSlot) sourceSlot.classList.add('opacity-60');
    });

    handle.addEventListener('dragend', () => {
      draggedSlotIdx = null;
      clearDropHighlights();
    });
  });

  container.querySelectorAll('[data-dk-drop-slot]').forEach((slotEl) => {
    slotEl.addEventListener('dragover', (e) => {
      const targetSlot = Number(slotEl.dataset.dkDropSlot);
      if (draggedSlotIdx === null || Number.isNaN(targetSlot) || targetSlot === draggedSlotIdx) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      slotEl.classList.add('ring-2', 'ring-inset', 'ring-obsidian-amber/80');
    });

    slotEl.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && slotEl.contains(e.relatedTarget)) return;
      slotEl.classList.remove('ring-2', 'ring-inset', 'ring-obsidian-amber/80');
    });

    slotEl.addEventListener('drop', (e) => {
      const targetSlot = Number(slotEl.dataset.dkDropSlot);
      const fromSlot = draggedSlotIdx !== null
        ? draggedSlotIdx
        : Number(e.dataTransfer?.getData('text/plain'));
      draggedSlotIdx = null;
      clearDropHighlights();
      if (Number.isNaN(fromSlot) || Number.isNaN(targetSlot) || fromSlot === targetSlot) return;
      if (fromSlot < 0 || fromSlot > 3 || targetSlot < 0 || targetSlot > 3) return;
      e.preventDefault();
      const tmp = quadrantOrder[fromSlot];
      quadrantOrder[fromSlot] = quadrantOrder[targetSlot];
      quadrantOrder[targetSlot] = tmp;
      saveQuadrantOrder(quadrantOrder, desktopScope);
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
  });

  // Bind Global | Personal switcher (Dueño / Admin-Tráfico / Cuentas)
  container.querySelectorAll('[data-dk-scope-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.dkScopeMode;
      if ((next === 'global' || next === 'personal') && next !== desktopScopePref) {
        desktopScopePref = next;
        saveDesktopScope(next);
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      }
    });
  });

  // Bind Estadística v3 controls (presets, Agrupar por, Medir, Ordenar, 7 Filtros en cascada)
  const applyStatsUpdate = () => {
    saveStatsState(statsState);
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  };

  container.querySelectorAll('[data-dk-st-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.dkStPreset;
      statsState.preset = p;
      statsState.manualGroupBy = false;
      statsState.sortBy = 'desc';
      if (p === 'capacidad') {
        statsState.groupBy = 'responsible';
        statsState.metric = 'hours';
      } else if (p === 'espacio') {
        statsState.groupBy = 'workspace';
        statsState.metric = 'ots';
      } else if (p === 'clientes') {
        statsState.groupBy = 'client';
        statsState.metric = 'ots';
      } else if (p === 'facturacion') {
        statsState.groupBy = 'stage';
        statsState.metric = 'ots';
      }
      applyStatsUpdate();
    });
  });

  container.querySelectorAll('[data-dk-st-cfg]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.dkStCfg;
      if (key === 'groupBy') {
        statsState.groupBy = sel.value;
        statsState.manualGroupBy = true;
        statsState.preset = 'custom';
        applyStatsUpdate();
      }
    });
  });

  container.querySelectorAll('[data-dk-st-metric]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.dkStMetric;
      if (m && statsState.metric !== m) {
        statsState.metric = m;
        applyStatsUpdate();
      }
    });
  });

  container.querySelectorAll('[data-dk-st-filter]').forEach((sel) => {
    sel.addEventListener('change', () => {
      const key = sel.dataset.dkStFilter;
      if (key && statsState.anchors[key] !== sel.value) {
        statsState.anchors[key] = sel.value;
        statsState.manualGroupBy = false;
        statsState.preset = 'custom';
        applyStatsUpdate();
      }
    });
  });

  container.querySelectorAll('[data-dk-st-clear-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.dkStClearFilter;
      if (key && key in statsState.anchors) {
        statsState.anchors[key] = 'all';
        statsState.manualGroupBy = false;
        applyStatsUpdate();
      }
    });
  });

  container.querySelectorAll('[data-dk-st-reset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      Object.keys(statsState.anchors).forEach((k) => { statsState.anchors[k] = 'all'; });
      statsState.manualGroupBy = false;
      statsState.preset = 'capacidad';
      statsState.groupBy = 'responsible';
      statsState.metric = 'hours';
      applyStatsUpdate();
    });
  });

  container.querySelectorAll('[data-dk-stat-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.dkStatType;
      const val = btn.dataset.dkStatVal;
      const goTasks = statsState.metric === 'tasks';
      if (type === 'workspace') {
        setActiveWorkspace(val);
      } else if (type === 'client') {
        (goTasks ? lastCallbacks.onGoToAllTasks : lastCallbacks.onGoToTraffic)?.({ client: val });
      } else if (type === 'department') {
        (goTasks ? lastCallbacks.onGoToAllTasks : lastCallbacks.onGoToTraffic)?.({ department: val });
      } else if (type === 'stage') {
        (goTasks ? lastCallbacks.onGoToAllTasks : lastCallbacks.onGoToTraffic)?.({ stage: val });
      } else if (type === 'status') {
        sketchState.trafficStatusFilter = val;
        (goTasks ? lastCallbacks.onGoToAllTasks : lastCallbacks.onGoToTraffic)?.({});
      } else if (type === 'priority') {
        const df = val === 'urgent' ? 'urgent' : 'all';
        (goTasks ? lastCallbacks.onGoToAllTasks : lastCallbacks.onGoToTraffic)?.({ dateFilter: df });
      } else if (type === 'responsible') {
        sketchState.trafficRespFilter = val;
        (goTasks ? lastCallbacks.onGoToAllTasks : lastCallbacks.onGoToTraffic)?.({});
      }
    });
  });

  const closeQ4Context = () => {
    if (!selectedContextOtId) return;
    selectedContextOtId = null;
    selectedContextTaskIdx = null;
    selectedMediaIndex = null;
    selectedCardKey = null;
    rightCollapseMode = 'none';
    renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
  };

  container.querySelector('[data-dk-q4-close-ctx]')?.addEventListener('click', closeQ4Context);

  if (!dismissListenersBound) {
    dismissListenersBound = true;
    document.addEventListener('keydown', (e) => {
      const desktopEl = document.getElementById('view-desktop');
      if (!desktopEl || desktopEl.classList.contains('hidden')) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select'].includes(tag)) return;

      if (lightboxChartIdx !== null) {
        if (e.key === 'Escape') {
          lightboxChartIdx = null;
          renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
          return;
        }
        const total = lastPillBoard?.cards?.length || 0;
        if (total && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          const delta = e.key === 'ArrowLeft' ? -1 : 1;
          lightboxChartIdx = (lightboxChartIdx + delta + total) % total;
          renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
          return;
        }
      }

      if (panelLightboxModId && e.key === 'Escape') {
        panelLightboxModId = null;
        renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
        return;
      }

      if (e.key !== 'Escape' || !selectedContextOtId) return;
      closeQ4Context();
    });

    document.addEventListener('click', (e) => {
      if (!selectedContextOtId) return;
      const desktopEl = document.getElementById('view-desktop');
      if (!desktopEl || desktopEl.classList.contains('hidden')) return;
      if (!e.target.closest('#center-body')) return;
      if (e.target.closest('#dk-q2-gallery-root')) return;
      if (e.target.closest('[data-desktop-select-ot], [data-desktop-select-task-ot]')) return;
      if (e.target.closest('button, a, input, select')) return;
      closeQ4Context();
    });
  }

  const openMediaReview = (idx) => {
    if (!selectedContextOt) return;
    const media = (selectedContextOt.mediaFiles || [])[idx];
    if (!media) return;
    notifySketchChange('open-review', {
      piece: {
        ...media,
        otId: selectedContextOt.id,
        client: selectedContextOt.client,
        brand: selectedContextOt.brand,
        otTitle: selectedContextOt.title,
      },
    });
  };

  container.querySelectorAll('[data-dk-select-media]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedMediaIndex = Number(btn.dataset.dkSelectMedia);
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
    });
    btn.addEventListener('dblclick', () => {
      openMediaReview(Number(btn.dataset.dkSelectMedia));
    });
  });

  container.querySelector('[data-dk-open-review]')?.addEventListener('click', (e) => {
    const idx = Number(e.currentTarget.dataset.dkOpenReview);
    if (!Number.isNaN(idx)) openMediaReview(idx);
  });

  // Bind OTs -> Inspector below mini-calendar + Q4 contextual (Galería | Vista previa)
  container.querySelectorAll('[data-desktop-edit-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openOt(btn.dataset.desktopEditOt, null);
    });
  });

  container.querySelectorAll('[data-desktop-select-ot]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const otId = row.dataset.desktopSelectOt;
      const key = row.dataset.dkKey;
      if (selectedCardKey === key && selectedContextOtId === otId && selectedContextTaskIdx === null) {
        closeQ4Context();
        return;
      }
      selectedCardKey = key;
      selectedContextOtId = otId;
      selectedContextTaskIdx = null;
      selectedMediaIndex = null;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      renderTrafficNotesInspector(otId, '', false, { onOpenOt: (id) => openOt(id, null) });
    });
    row.addEventListener('dblclick', () => openOt(row.dataset.desktopSelectOt, null));
  });

  // Bind Tasks -> Inspector below mini-calendar + Q4 contextual (Galería | Vista previa)
  container.querySelectorAll('[data-desktop-edit-task-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openOt(btn.dataset.desktopEditTaskOt, Number(btn.dataset.desktopEditTaskIdx));
    });
  });

  container.querySelectorAll('[data-desktop-select-task-ot]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const otId = row.dataset.desktopSelectTaskOt;
      const taskIdx = Number(row.dataset.desktopSelectTaskIdx);
      const key = row.dataset.dkKey;
      if (selectedCardKey === key && selectedContextOtId === otId && selectedContextTaskIdx === taskIdx) {
        closeQ4Context();
        return;
      }
      selectedCardKey = key;
      selectedContextOtId = otId;
      selectedContextTaskIdx = taskIdx;
      selectedMediaIndex = null;
      renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
      renderTrafficNotesInspector(otId, String(taskIdx), false, { onOpenOt: (id) => openOt(id, taskIdx) });
    });
    row.addEventListener('dblclick', () => openOt(row.dataset.desktopSelectTaskOt, Number(row.dataset.desktopSelectTaskIdx)));
  });
}
