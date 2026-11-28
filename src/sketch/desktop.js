/**
 * Orquestador del Escritorio (#view-desktop):
 * - Estado de cuadrantes 2×2 (Prioridades, Calendario, Estadística, Visor contextual C04) y Escritorio Completo
 * - Persistencia de alcance (Global | Personal) y orden de cuadrantes en localStorage
 * - Preservación de scroll en re-renderizados
 * - Enlace con el Inspector derecho (mini-calendario, Mensajes, Actividad, Lista y detalle OT/Tarea)
 */

import {
  ensureOtData,
  escapeHtml,
  formatShortDate,
  getActiveWorkspaces,
  notifySketchChange,
  relDate,
  shiftIsoDate,
  sketchState,
  studioFreeTasks,
  studioSeparators,
  studioSettings,
  trafficOrders,
  userProfile,
} from './store.js';
import { renderInspectorMiniCalendar } from './schedule-views.js';
import { getDayReservedHours } from './stripboard.js';
import { renderTrafficNotesInspector } from './inspector.js';
import {
  getRoleCapabilities,
  loadStatsState,
  runStatsQuery,
  saveStatsState,
} from './stats-engine.js';
import { renderStatsPillChartsGrid } from './ot-en-proceso-charts.js';
import {
  renderCollapseBtn,
  renderDragHandle,
  renderExpandPanelBtn,
} from './desktop-cards.js';
import {
  getIsoMonday,
  renderCalendarQuadrant,
  renderPrioritiesQuadrant,
} from './desktop-calendar.js';
import { renderStatsQuadrant } from './desktop-stats-panel.js';
import { hydrateIcons } from '../client/icons.js';
import {
  DND_MIME_SLOT,
  applyViewerAction,
  createDefaultViewerState,
  renderViewerQuadrant,
} from './desktop-viewer.js';
import {
  buildInspectorIdleStreams,
  renderDesktopIdleInspector,
} from './desktop-inspector.js';

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
let activeStatsPill = 'ots-active';
let deptChartPageWsId = null;
let panelLightboxModId = null; // null | 'priorities' | 'calendar' | 'stats' | 'empty'
let lightboxChartIdx = null;
let lastPillBoard = null;
let selectedStatsDrillKey = null;
let q4TraceFilter = 'all'; // 'all' | 'routes' | 'activity'
let inspIdleTab = 'messages'; // 'messages' | 'activity' | 'drill'
let selectedContextOtId = null;
let selectedContextTaskIdx = null;
let selectedMediaIndex = null;
let viewerState = createDefaultViewerState();
let lastViewerContextKey = '';

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
let leftCollapseMode = 'none'; // 'none' | 'q1' | 'q3'
let rightCollapseMode = 'none'; // 'none' | 'q2' | 'q4'
let dismissListenersBound = false;

function ensureQuadrantVisible(modId, order) {
  const idx = Array.isArray(order) ? order.indexOf(modId) : -1;
  if (idx === 0 && leftCollapseMode === 'q1') leftCollapseMode = 'none';
  else if (idx === 2 && leftCollapseMode === 'q3') leftCollapseMode = 'none';
  else if (idx === 1 && rightCollapseMode === 'q2') rightCollapseMode = 'none';
  else if (idx === 3 && rightCollapseMode === 'q4') rightCollapseMode = 'none';
}

function captureScrollPositions(container, prevInspSlot) {
  const positions = new Map();
  container.querySelectorAll('[data-dk-scroll-id]').forEach((el) => {
    if (el.scrollTop > 0) {
      positions.set(el.dataset.dkScrollId, el.scrollTop);
    }
  });
  const inspScrollTop = prevInspSlot ? prevInspSlot.scrollTop : 0;
  const inspScrollCtx = prevInspSlot ? (prevInspSlot.dataset.dkInspScrollCtx || '') : '';
  return { positions, inspScrollTop, inspScrollCtx };
}

function restoreScrollPositions(container, inspContentSlot, snapshot, currentInspScrollCtx) {
  if (!snapshot) return;
  snapshot.positions.forEach((top, id) => {
    const el = container.querySelector(`[data-dk-scroll-id="${CSS.escape(id)}"]`);
    if (el) el.scrollTop = top;
  });
  if (inspContentSlot) {
    inspContentSlot.dataset.dkInspScrollCtx = currentInspScrollCtx;
    if (snapshot.inspScrollTop > 0 && snapshot.inspScrollCtx === currentInspScrollCtx) {
      inspContentSlot.scrollTop = snapshot.inspScrollTop;
    } else if (snapshot.inspScrollCtx !== currentInspScrollCtx) {
      inspContentSlot.scrollTop = 0;
    }
  }
}

function rerender() {
  renderDesktopOverview(lastCallbacks.onGoToTraffic, lastCallbacks);
}

/**
 * Render the Escritorio (#view-desktop) view.
 */
export function renderDesktopOverview(onGoToTraffic, opts = {}) {
  lastCallbacks = { onGoToTraffic, ...opts };

  const container = document.getElementById('view-desktop');
  if (!container) return;
  const prevInspSlot = document.getElementById('insp-content-slot');
  const scrollSnapshot = captureScrollPositions(container, prevInspSlot);

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
  const activeWorkspaces = getActiveWorkspaces();
  const showWsTag = activeWorkspaces.length >= 2 && activeWsId === 'studio';

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
      allActiveTasks.push({
        otId: ot.id,
        taskIndex: idx,
        title: st.title || ot.title,
        client: ot.client,
        department: st.department || ot.department,
        responsible: resp,
        deliveryDate: st.deliveryDate || ot.deliveryDate || '',
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

  // KPI metrics for Estadística Vistas Rápidas
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

  // Pre-compute Estadística query & pillBoard BEFORE rendering quadrants so C04 always has fresh data regardless of slot order
  const isAllowedPill = (p) => {
    if (p === 'finalizadas') return showFinalizadasKpi;
    if (p === 'free-tasks' || p === 'separators') return !isPersonalScope;
    if (p === 'today-hours' || p === 'tomorrow-hours') return isPersonalScope;
    return true;
  };
  const effectiveStatsPill = isAllowedPill(activeStatsPill) ? activeStatsPill : 'ots-active';
  const statsQuery = runStatsQuery({
    allOrders: trafficOrders,
    state: statsState,
    topWorkspaceId: activeWsId,
    myMember,
    forcePersonalMember: isPersonalScope ? myMember : null,
    activePill: effectiveStatsPill,
  });
  if (statsQuery.sanitized) {
    statsState = statsQuery.effectiveState;
    saveStatsState(statsState);
  }
  const statsChartTitle = statsQuery.chartTitle;

  const pillBoard = renderStatsPillChartsGrid({
    pillId: effectiveStatsPill,
    allOrders: trafficOrders,
    scopedOrders,
    anchors: statsQuery.effectiveState.anchors,
    metric: statsQuery.effectiveState.metric,
    todayKey,
    tomorrowKey,
    dailyHours,
    activeWsId,
    deptPageWsId: deptChartPageWsId,
    isPersonalScope,
    myMember,
    canSeeFinancial: statsQuery.rbac.canSeeFinancial,
  });
  lastPillBoard = pillBoard;
  if (lightboxChartIdx !== null && (!pillBoard.cards || !pillBoard.cards[lightboxChartIdx])) {
    lightboxChartIdx = null;
  }

  // Idle Inspector streams & contextual OT/Task
  const { visibleTrace, visibleMessages } = buildInspectorIdleStreams({ scopedOrders, q4TraceFilter });

  const selectedContextOt = selectedContextOtId
    ? (scopedOrders.find((o) => o.id === selectedContextOtId) || trafficOrders.find((o) => o.id === selectedContextOtId) || null)
    : null;
  if (selectedContextOt) ensureOtData(selectedContextOt, formatShortDate);
  const selectedContextTask = (selectedContextOt && selectedContextTaskIdx !== null && selectedContextTaskIdx !== undefined)
    ? (selectedContextOt.subtasks || [])[selectedContextTaskIdx] || null
    : null;

  const getQuadrantCollapsedLabel = (modId) => {
    if (modId === 'priorities') return 'Prioridades · Urgentes · Hoy · Mañana';
    if (modId === 'calendar') {
      return q2ViewMode === 'month' ? 'Mes' : 'Semanas · Esta semana · Semana próxima';
    }
    if (modId === 'stats') return `Estadística · ${escapeHtml(statsChartTitle)}`;
    if (lightboxChartIdx !== null && lastPillBoard?.cards?.[lightboxChartIdx]) {
      return `Gráfico · ${escapeHtml(lastPillBoard.cards[lightboxChartIdx].title)}`;
    }
    if (selectedContextOt) {
      return `Galería · ${escapeHtml(String(selectedContextOt.id || '').replace(/^OT-/i, ''))}`;
    }
    return 'Visor';
  };

  const renderQuadrantModule = (modId, slotIdx, { collapseTarget = '', borderBottomClass = '', slotClass = 'flex-1', isFullDesktop = false } = {}) => {
    const dragHandleHtml = isFullDesktop ? '' : renderDragHandle(slotIdx);
    const collapseBtnHtml = isFullDesktop ? '' : renderCollapseBtn(collapseTarget);
    const expandBtnHtml = renderExpandPanelBtn(modId, isFullDesktop);
    const rightActionBtns = `${expandBtnHtml}${collapseBtnHtml}`;
    let innerHtml = '';

    if (modId === 'priorities') {
      innerHtml = renderPrioritiesQuadrant({
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
      });
    } else if (modId === 'calendar') {
      innerHtml = renderCalendarQuadrant({
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
      });
    } else if (modId === 'stats') {
      innerHtml = renderStatsQuadrant({
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
      });
    } else {
      const nextViewerCtxKey = selectedContextOt ? `${selectedContextOt.id}:${selectedMediaIndex ?? 0}` : '';
      if (nextViewerCtxKey !== lastViewerContextKey) {
        lastViewerContextKey = nextViewerCtxKey;
        viewerState = createDefaultViewerState();
      }
      innerHtml = renderViewerQuadrant({
        lightboxChartIdx,
        lastPillBoard,
        selectedContextOt,
        selectedContextTask,
        selectedContextTaskIdx,
        selectedMediaIndex,
        viewerState,
        dragHandleHtml,
        rightActionBtns,
      });
    }

    return `
      <div data-dk-drop-slot="${slotIdx}" class="${slotClass} flex flex-col min-h-0 ${borderBottomClass} transition-shadow">
        ${innerHtml}
      </div>
    `;
  };

  container.innerHTML = `
    ${canSwitchGlobal ? `
      <div class="flex items-center justify-between gap-2 shrink-0 px-0.5">
        <span class="font-mono text-[9px] uppercase tracking-wider text-[#737373]">
          ${isPersonalScope ? `Tablero Personal · ${escapeHtml(myMember)}` : 'Tablero Global · Estudio'}
        </span>
        <div class="inline-flex items-center gap-1 text-[9.5px] font-mono shrink-0">
          <button type="button" data-dk-scope-mode="global"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer ${!isPersonalScope ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Global</button>
          <button type="button" data-dk-scope-mode="personal"
            class="px-2 py-0.5 rounded transition-colors cursor-pointer ${isPersonalScope ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Personal</button>
        </div>
      </div>
    ` : ''}

    ${panelLightboxModId
      ? `
        <!-- Vista de Escritorio completo (100% área central · conserva menú izquierdo, barra Perfiles e Inspector) -->
        <div class="flex-1 min-h-[420px] flex flex-col border border-obsidian-border rounded-xl overflow-hidden bg-[#161616]/75">
          ${renderQuadrantModule(panelLightboxModId, -1, { isFullDesktop: true })}
        </div>
      `
      : `
        <!-- Espacio acuartelado 2×2 (intercambiable por arrastre · ambas mitades colapsables) -->
        <div class="flex-1 min-h-[420px] grid grid-cols-1 lg:grid-cols-2 border border-obsidian-border rounded-xl overflow-hidden bg-[#161616]/75">
          <!-- Mitad izquierda: Slot 0 (arriba) + Slot 2 (abajo), colapsables -->
          <div class="flex flex-col border-b lg:border-b-0 lg:border-r border-obsidian-border min-h-0">
            ${leftCollapseMode === 'q1'
              ? `
                <button type="button" data-dk-drop-slot="0" data-dk-collapse-left="none" title="Expandir cuadrante superior"
                  class="h-7 px-3 border-b border-obsidian-border bg-[#1d1d1d] hover:bg-[#242424] flex items-center justify-between gap-2 shrink-0 cursor-pointer transition-colors">
                  <span class="font-mono text-[9px] text-[#8C8C8C] tracking-wider uppercase truncate">${getQuadrantCollapsedLabel(quadrantOrder[0])}</span>
                  <span class="inline-flex items-center gap-1 font-mono text-[9.5px] text-obsidian-amber shrink-0">
                    <span>Expandir</span>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
                  </span>
                </button>
                ${renderQuadrantModule(quadrantOrder[2], 2, { collapseTarget: 'q3' })}
              `
              : (leftCollapseMode === 'q3'
                  ? `
                    ${renderQuadrantModule(quadrantOrder[0], 0, { collapseTarget: 'q1' })}
                    <button type="button" data-dk-drop-slot="2" data-dk-collapse-left="none" title="Expandir cuadrante inferior"
                      class="h-7 px-3 border-t border-obsidian-border bg-[#1d1d1d] hover:bg-[#242424] flex items-center justify-between gap-2 shrink-0 cursor-pointer transition-colors">
                      <span class="font-mono text-[9px] text-[#8C8C8C] tracking-wider uppercase truncate">${getQuadrantCollapsedLabel(quadrantOrder[2])}</span>
                      <span class="inline-flex items-center gap-1 font-mono text-[9.5px] text-obsidian-amber shrink-0">
                        <span>Expandir</span>
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"/></svg>
                      </span>
                    </button>
                  `
                  : `
                    <div class="flex-1 grid grid-rows-2 min-h-0">
                      ${renderQuadrantModule(quadrantOrder[0], 0, { collapseTarget: 'q1', borderBottomClass: 'border-b border-obsidian-border' })}
                      ${renderQuadrantModule(quadrantOrder[2], 2, { collapseTarget: 'q3' })}
                    </div>
                  `)
            }
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
                    <div class="flex-1 grid grid-rows-2 min-h-0">
                      ${renderQuadrantModule(quadrantOrder[1], 1, { collapseTarget: 'q2', borderBottomClass: 'border-b border-obsidian-border' })}
                      ${renderQuadrantModule(quadrantOrder[3], 3, { collapseTarget: 'q4' })}
                    </div>
                  `)
            }
          </div>
        </div>
      `
    }
  `;

  hydrateIcons(container);

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
      rerender();
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

  // Re-query #insp-content-slot AFTER renderInspectorMiniCalendar creates/updates it
  const inspContentSlot = document.getElementById('insp-content-slot');

  // Render idle Inspector (Mensajes | Actividad | Lista) when no OT is selected
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

  const currentInspScrollCtx = selectedContextOt
    ? `ot:${selectedContextOt.id}:${selectedContextTaskIdx ?? ''}`
    : `idle:${inspIdleTab}:${inspIdleTab === 'activity' ? q4TraceFilter : (inspIdleTab === 'drill' ? (selectedStatsDrillKey || '') : '')}`;

  const renderIdleInspectorInPlace = (streams = { visibleMessages, visibleTrace }) => {
    const slot = document.getElementById('insp-content-slot');
    if (!slot || selectedContextOt) return;
    renderDesktopIdleInspector({
      inspContentSlot: slot,
      activeStatsDrill,
      inspIdleTab,
      visibleMessages: streams.visibleMessages,
      visibleTrace: streams.visibleTrace,
      q4TraceFilter,
      todayKey,
      tomorrowKey,
      onChangeTab: (next) => {
        if (next && next !== inspIdleTab) {
          inspIdleTab = next;
          rerender();
        }
      },
      onClearDrill: () => {
        selectedStatsDrillKey = null;
        inspIdleTab = 'messages';
        rerender();
      },
      onChangeTraceFilter: (next) => {
        if (next && next !== q4TraceFilter) {
          q4TraceFilter = next;
          rerender();
        }
      },
      onOpenOt: openOt,
      onSelectDrillOt: ({ otId, taskIdx, key }) => {
        selectedCardKey = key;
        selectedContextOtId = otId;
        selectedContextTaskIdx = taskIdx;
        selectedMediaIndex = null;
        lightboxChartIdx = null;
        ensureQuadrantVisible('empty', quadrantOrder);
        rerender();
        renderTrafficNotesInspector(otId, taskIdx !== null ? String(taskIdx) : '', false, { onOpenOt: (id) => openOt(id, taskIdx) });
      },
      onSelectIdleOt: ({ otId, key }) => {
        selectedCardKey = key;
        selectedContextOtId = otId;
        selectedContextTaskIdx = null;
        selectedMediaIndex = null;
        lightboxChartIdx = null;
        ensureQuadrantVisible('empty', quadrantOrder);
        rerender();
        renderTrafficNotesInspector(otId, '', false, { onOpenOt: (id) => openOt(id, null) });
      },
    });
  };

  if (inspContentSlot && !selectedContextOt) {
    renderIdleInspectorInPlace({ visibleMessages, visibleTrace });
  }

  // Restore scroll positions before binding events
  restoreScrollPositions(container, inspContentSlot, scrollSnapshot, currentInspScrollCtx);

  // --- Event Bindings ---

  // Estadística KPI pills (Vista Rápida)
  container.querySelectorAll('[data-dk-stats-pill]').forEach((el) => {
    el.addEventListener('click', () => {
      const nextPill = el.dataset.dkStatsPill;
      if (nextPill && nextPill !== activeStatsPill) {
        activeStatsPill = nextPill;
        lightboxChartIdx = null;
        selectedStatsDrillKey = null;
        rerender();
      }
    });
  });

  // Estadística -> Inspector drill-down
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
      rerender();
    });
  });

  // Por Depto local Perfil pager
  container.querySelectorAll('[data-dk-dept-page]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const nextWs = btn.dataset.dkDeptPage;
      if (nextWs && nextWs !== deptChartPageWsId) {
        deptChartPageWsId = nextWs;
        rerender();
      }
    });
  });

  // Chart click -> open enlarged chart inside C04 (Visor contextual)
  container.querySelectorAll('[data-dk-chart-zoom]').forEach((cardEl) => {
    const openZoom = (e) => {
      if (e && e.target && e.target.closest('button, [data-dk-chart-drill]')) return;
      const idx = Number(cardEl.dataset.dkChartZoom);
      if (!Number.isNaN(idx)) {
        lightboxChartIdx = idx;
        selectedContextOtId = null;
        selectedContextTaskIdx = null;
        panelLightboxModId = null;
        ensureQuadrantVisible('empty', quadrantOrder);
        rerender();
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

  // Expand / Restore Escritorio Completo & C04 chart nav/close
  container.querySelectorAll('[data-dk-lb-open-panel]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      panelLightboxModId = btn.dataset.dkLbOpenPanel || 'stats';
      lightboxChartIdx = null;
      rerender();
    });
  });

  container.querySelectorAll('[data-dk-lb-close]').forEach((btn) => {
    btn.addEventListener('click', () => {
      lightboxChartIdx = null;
      panelLightboxModId = null;
      rerender();
    });
  });

  container.querySelectorAll('[data-dk-lb-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const total = lastPillBoard?.cards?.length || 0;
      if (!total || lightboxChartIdx === null) return;
      const delta = Number(btn.dataset.dkLbNav || 0);
      lightboxChartIdx = (lightboxChartIdx + delta + total) % total;
      rerender();
    });
  });

  // C01 column OTs / Tareas switches
  container.querySelectorAll('[data-dk-q1-col]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.dkQ1Col;
      const nextMode = btn.dataset.dkQ1Mode;
      if (col && nextMode && q1Modes[col] !== nextMode) {
        q1Modes[col] = nextMode;
        rerender();
      }
    });
  });

  // C03 Semana | Mes view switch & Month/Week navigation
  container.querySelectorAll('[data-dk-q2-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextView = btn.dataset.dkQ2View;
      if (nextView && nextView !== q2ViewMode) {
        q2ViewMode = nextView;
        rerender();
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
      rerender();
    });
  });

  container.querySelector('[data-dk-month-reset]')?.addEventListener('click', () => {
    monthAnchorIso = todayKey;
    selectedCalendarDate = todayKey;
    rerender();
  });

  container.querySelectorAll('[data-dk-q2-row]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const row = btn.dataset.dkQ2Row;
      const nextMode = btn.dataset.dkQ2Mode;
      if (row && nextMode && q2Modes[row] !== nextMode) {
        q2Modes[row] = nextMode;
        rerender();
      }
    });
  });

  container.querySelectorAll('[data-dk-q2-shift]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const delta = Number(btn.dataset.dkQ2Shift || 0);
      if (!delta) return;
      nextWeekAnchorIso = shiftIsoDate(nextWeekAnchorIso, delta);
      selectedCalendarDate = nextWeekAnchorIso;
      rerender();
    });
  });

  container.querySelector('[data-dk-q2-reset]')?.addEventListener('click', () => {
    nextWeekAnchorIso = defaultNextWeekIso;
    selectedCalendarDate = defaultNextWeekIso;
    rerender();
  });

  // Left-half & right-half collapse/expand toggles
  container.querySelectorAll('[data-dk-collapse-left]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.dkCollapseLeft || 'none';
      leftCollapseMode = next === leftCollapseMode ? 'none' : next;
      rerender();
    });
  });

  container.querySelectorAll('[data-dk-collapse-right]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.dkCollapseRight || 'none';
      rightCollapseMode = next === rightCollapseMode ? 'none' : next;
      rerender();
    });
  });

  // 4-slot Drag & Drop quadrant swapping (MIME dedicado aislado de pines/tarjetas)
  const clearDropHighlights = () => {
    container.querySelectorAll('[data-dk-drop-slot]').forEach((el) => {
      el.classList.remove('ring-2', 'ring-inset', 'ring-obsidian-amber/80', 'opacity-60');
    });
  };

  container.querySelectorAll('[data-dk-drag-slot]').forEach((handle) => {
    handle.addEventListener('dragstart', (e) => {
      const slotIdx = Number(handle.dataset.dkDragSlot);
      if (Number.isNaN(slotIdx)) return;
      e.stopPropagation();
      draggedSlotIdx = slotIdx;
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData(DND_MIME_SLOT, String(slotIdx));
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
      const types = Array.from(e.dataTransfer?.types || []);
      const isSlotDrag = draggedSlotIdx !== null || types.includes(DND_MIME_SLOT);
      const targetSlot = Number(slotEl.dataset.dkDropSlot);
      if (!isSlotDrag || Number.isNaN(targetSlot) || targetSlot === draggedSlotIdx) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      slotEl.classList.add('ring-2', 'ring-inset', 'ring-obsidian-amber/80');
    });

    slotEl.addEventListener('dragleave', (e) => {
      if (e.relatedTarget && slotEl.contains(e.relatedTarget)) return;
      slotEl.classList.remove('ring-2', 'ring-inset', 'ring-obsidian-amber/80');
    });

    slotEl.addEventListener('drop', (e) => {
      const types = Array.from(e.dataTransfer?.types || []);
      const isSlotDrag = draggedSlotIdx !== null || types.includes(DND_MIME_SLOT);
      if (!isSlotDrag) return;
      const targetSlot = Number(slotEl.dataset.dkDropSlot);
      const rawSlot = draggedSlotIdx !== null
        ? String(draggedSlotIdx)
        : (e.dataTransfer?.getData(DND_MIME_SLOT) || '');
      const fromSlot = rawSlot !== '' ? Number(rawSlot) : NaN;
      draggedSlotIdx = null;
      clearDropHighlights();
      if (Number.isNaN(fromSlot) || Number.isNaN(targetSlot) || fromSlot === targetSlot) return;
      if (fromSlot < 0 || fromSlot > 3 || targetSlot < 0 || targetSlot > 3) return;
      e.preventDefault();
      const tmp = quadrantOrder[fromSlot];
      quadrantOrder[fromSlot] = quadrantOrder[targetSlot];
      quadrantOrder[targetSlot] = tmp;
      saveQuadrantOrder(quadrantOrder, desktopScope);
      rerender();
    });
  });

  // Global | Personal scope switcher
  container.querySelectorAll('[data-dk-scope-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.dkScopeMode;
      if ((next === 'global' || next === 'personal') && next !== desktopScopePref) {
        desktopScopePref = next;
        saveDesktopScope(next);
        rerender();
      }
    });
  });

  // Estadística controls (metric, cascading filters, chips, reset)
  const applyStatsUpdate = () => {
    saveStatsState(statsState);
    rerender();
  };

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

  // C04 contextual dismiss & keyboard navigation
  const closeQ4Context = () => {
    if (!selectedContextOtId) return;
    selectedContextOtId = null;
    selectedContextTaskIdx = null;
    selectedMediaIndex = null;
    selectedCardKey = null;
    rerender();
  };

  container.querySelector('[data-dk-q4-close-ctx]')?.addEventListener('click', closeQ4Context);

  if (!dismissListenersBound) {
    dismissListenersBound = true;
    document.addEventListener('keydown', (e) => {
      const corchoEl = document.getElementById('corcho-overlay');
      if (corchoEl && !corchoEl.classList.contains('hidden')) return;
      const desktopEl = document.getElementById('view-desktop');
      if (!desktopEl || desktopEl.classList.contains('hidden')) return;
      const tag = (document.activeElement?.tagName || '').toLowerCase();

      if (['input', 'textarea', 'select'].includes(tag)) return;

      if (lightboxChartIdx !== null) {
        if (e.key === 'Escape') {
          lightboxChartIdx = null;
          rerender();
          return;
        }
        const total = lastPillBoard?.cards?.length || 0;
        if (total && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
          e.preventDefault();
          const delta = e.key === 'ArrowLeft' ? -1 : 1;
          lightboxChartIdx = (lightboxChartIdx + delta + total) % total;
          rerender();
          return;
        }
      }

      if (panelLightboxModId && e.key === 'Escape') {
        panelLightboxModId = null;
        rerender();
        return;
      }

      if (e.key !== 'Escape' || !selectedContextOtId) return;
      closeQ4Context();
    });

    document.addEventListener('click', (e) => {
      if (!selectedContextOtId) return;
      const corchoEl = document.getElementById('corcho-overlay');
      if (corchoEl && !corchoEl.classList.contains('hidden')) return;
      const desktopEl = document.getElementById('view-desktop');
      if (!desktopEl || desktopEl.classList.contains('hidden')) return;
      if (!e.target.closest('#center-body')) return;
      if (e.target.closest('#dk-viewer-gallery-root')) return;
      if (e.target.closest('[data-desktop-select-ot], [data-desktop-select-task-ot]')) return;
      if (e.target.closest('button, a, input, select')) return;
      closeQ4Context();
    });
  }

  // C04 Gallery media selection & Review opener
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
    btn.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      const nextIdx = Number(btn.dataset.dkSelectMedia);
      if (nextIdx !== selectedMediaIndex) {
        selectedMediaIndex = nextIdx;
        viewerState = createDefaultViewerState();
      }
      rerender();
    });
    btn.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      const nextIdx = Number(btn.dataset.dkSelectMedia);
      if (nextIdx !== selectedMediaIndex) {
        selectedMediaIndex = nextIdx;
        viewerState = createDefaultViewerState();
      }
      rerender();
    });
    btn.addEventListener('dblclick', (e) => {
      if (e.target.closest('button')) return;
      openMediaReview(Number(btn.dataset.dkSelectMedia));
    });
  });

  // Sync live <video>/<audio> properties & bind C04 file-type controls
  const viewerMediaEl = container.querySelector('[data-dk-viewer-media-el]');
  if (viewerMediaEl) {
    viewerMediaEl.loop = Boolean(viewerState.videoLoop);
    viewerMediaEl.muted = Boolean(viewerState.videoMuted);
    try {
      viewerMediaEl.playbackRate = viewerState.videoSpeed || 1;
    } catch {
      // ignore unsupported playbackRate
    }
  }

  container.querySelectorAll('[data-dk-viewer-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = btn.dataset.dkViewerAction;
      if (!action) return;
      if (action === 'video-play' && viewerMediaEl) {
        if (viewerMediaEl.paused) {
          viewerMediaEl.play?.().catch(() => {});
          viewerState.videoPlaying = true;
        } else {
          viewerMediaEl.pause?.();
          viewerState.videoPlaying = false;
        }
        rerender();
        return;
      }
      if (action === 'doc-copy' && selectedContextOt) {
        const media = (selectedContextOt.mediaFiles || [])[selectedMediaIndex ?? 0];
        if (media && navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(`${media.name || ''}${media.meta ? ` — ${media.meta}` : ''}`).catch(() => {});
        }
      }
      applyViewerAction(viewerState, action);
      rerender();
    });
  });

  container.querySelectorAll('[data-dk-open-review]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(e.currentTarget.dataset.dkOpenReview);
      if (!Number.isNaN(idx)) openMediaReview(idx);
    });
  });

  // OT cards -> Inspector + C04 contextual gallery
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
      lightboxChartIdx = null;
      ensureQuadrantVisible('empty', quadrantOrder);
      rerender();
      renderTrafficNotesInspector(otId, '', false, { onOpenOt: (id) => openOt(id, null) });
    });
    row.addEventListener('dblclick', () => openOt(row.dataset.desktopSelectOt, null));
  });

  // Task cards -> Inspector + C04 contextual gallery
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
      lightboxChartIdx = null;
      ensureQuadrantVisible('empty', quadrantOrder);
      rerender();
      renderTrafficNotesInspector(otId, String(taskIdx), false, { onOpenOt: (id) => openOt(id, taskIdx) });
    });
    row.addEventListener('dblclick', () => openOt(row.dataset.desktopSelectTaskOt, Number(row.dataset.desktopSelectTaskIdx)));
  });
}
