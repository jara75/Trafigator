/**
 * TRAFIGATOR // CONTROLADOR DE MODALES Y VISORES
 * Módulo 5: Gestión unificada de los 8 modales de la aplicación, visualizador multimedia fullscreen,
 * motor de previsualización inline, hoja de ruta, firmas retro y respaldos JSON.
 */

import {
  state,
  emit,
  on,
  SUITE_DEFS,
  CODE_EXTS,
  STORAGE_KEY,
  CLIENTS_STORAGE_KEY,
  STATUSES_STORAGE_KEY,
  RESPONSIBLES_STORAGE_KEY,
  STRIPBOARD_STORAGE_KEY,
  USER_AVATAR_ICONS,
  isOtTerminal
} from './core-state.js';

import { icon as lucideIcon } from './icons.js';

import {
  getOrders,
  saveOrders,
  createOt,
  getOrderById,
  deleteOt,
  clearScopedLocalCache,
  getClients,
  saveClients,
  addClient,
  deleteClient as bridgeDeleteClient,
  addBrand,
  deleteBrand as bridgeDeleteBrand,
  getStatuses,
  saveStatuses,
  getStatusBadgeClass,
  getStatusOptionsHtml,
  getResponsibles,
  addResponsible,
  getResponsibleOptionsHtml,
  getDepartments,
  addDepartment,
  getDepartmentOptionsHtml,
  getActiveRoute,
  syncOtStatusAndRoute,
  getAllStripboardStorage,
  getDayStrips,
  saveDayStrips,
  getNowFormatted,
  toIsoDateTime,
  fromIsoToDisplay,
  escapeHtml,
  translateAuthError,
  uploadOtFiles,
  shareMediaForReview,
  uploadMediaVersion,
  getUserProfile,
  saveUserProfile,
  getActiveUserShortName,
  deriveShortName,
  renderUserAvatarHtml,
  getCurrentUser,
  getCurrentOrganization,
  fetchFullOrganization,
  bootstrap
} from './data-bridge.js';

import {
  renderTrafficDesk,
  renderBinTree,
  renderStatusSelects,
  renderResponsibleSelects,
  syncSortAndGroupControls,
  refreshAllViews,
  CLIENT_COLOR_PALETTE,
  getClientColorClasses,
  getResponsibleColorClasses
} from './traffic-desk-view.js';

import {
  renderStripboard,
  renderStripboardPendingPool,
  getOtScheduledDays,
  selectStripboardDate,
  insertOtStripOnDate,
  removeStrip,
  openCustomTaskModal,
  closeCustomTaskModal,
  setCustomTaskAssignee,
  promptNewResponsible,
  saveCustomTaskModal,
  deleteCustomTaskFromModal,
  updateDeptOptionsDatalist
} from './stripboard-engine-view.js';

// Re-exportar funciones de tarea libre para unificar la API de modales
export {
  openCustomTaskModal,
  closeCustomTaskModal,
  setCustomTaskAssignee,
  promptNewResponsible,
  saveCustomTaskModal,
  deleteCustomTaskFromModal
};

let stampingRowIndex = null;
let mediaPoolViewMode = 'grid'; // 'grid' | 'list'

// ============================================================================
// 1. MODAL SOBRE OT (ENVELOPE-MODAL)
// ============================================================================

function getEnvelopeRootOt(ot) {
  if (!ot) return null;
  if (ot.parentOtId) {
    return getOrderById(ot.parentOtId) || ot;
  }
  const subMatch = typeof ot.id === 'string' && ot.id.match(/^(OT-\d{2}-\d+)-\d+$/);
  if (subMatch) {
    return getOrderById(subMatch[1]) || ot;
  }
  return ot;
}

function populateEnvelopeRootHeader(rootOt) {
  if (!rootOt || typeof document === 'undefined') return;
  if (document.getElementById('modal-ot-id-display')) {
    document.getElementById('modal-ot-id-display').value = rootOt.id;
  }
  if (document.getElementById('modal-ot-id')) {
    document.getElementById('modal-ot-id').innerText = rootOt.id;
  }
  if (document.getElementById('modal-ot-title-header')) {
    document.getElementById('modal-ot-title-header').innerText = rootOt.title || rootOt.description || '';
  }
  if (document.getElementById('modal-ot-client')) {
    document.getElementById('modal-ot-client').value = rootOt.client || '';
  }
  if (document.getElementById('modal-ot-brand')) {
    document.getElementById('modal-ot-brand').value = rootOt.brand || rootOt.product || '';
  }
  if (document.getElementById('modal-ot-product')) {
    document.getElementById('modal-ot-product').value = rootOt.product || '';
  }
  if (document.getElementById('modal-ot-media')) {
    document.getElementById('modal-ot-media').value = rootOt.media || '';
  }
  if (document.getElementById('modal-ot-ref')) {
    document.getElementById('modal-ot-ref').value = rootOt.ref || '';
  }
  if (document.getElementById('modal-ot-description')) {
    document.getElementById('modal-ot-description').value = rootOt.title || rootOt.description || '';
  }

  renderStatusSelects();
  renderResponsibleSelects();

  const modalStatusEl = document.getElementById('modal-ot-status');
  if (modalStatusEl) {
    const currentStatus = rootOt.responsibleDept || 'Tráfico';
    modalStatusEl.innerHTML = getStatusOptionsHtml(currentStatus);
    modalStatusEl.value = currentStatus;
  }
  const respEl = document.getElementById('modal-ot-responsible');
  if (respEl) {
    const respVal = rootOt.sign || getActiveUserShortName() || 'Usuario';
    respEl.innerHTML = `<option value="${escapeHtml(respVal)}" selected>${escapeHtml(respVal)}</option>`;
    respEl.value = respVal;
  }
  const entryEl = document.getElementById('modal-ot-entry-date');
  if (entryEl) {
    const rootEntry = rootOt.entryDate || rootOt.createdAt || rootOt.routes?.[0]?.entryDate || '';
    entryEl.value = toIsoDateTime(rootEntry);
  }
  const deliveryEl = document.getElementById('modal-ot-delivery-date');
  if (deliveryEl) {
    const rootDelivery = rootOt.deliveryDate || rootOt.routes?.[0]?.deliveryDate || '';
    deliveryEl.value = toIsoDateTime(rootDelivery);
  }
  const urgentEl = document.getElementById('modal-ot-urgent');
  if (urgentEl) urgentEl.checked = !!rootOt.urgent;
}

export function openEnvelopeModal(otId) {
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot) return;

  const rootOt = getEnvelopeRootOt(ot) || ot;
  state.activeEnvelopeRootId = rootOt.id;
  state.activeEnvelopeTaskId = ot.id;
  state.activeOtId = ot.id;
  state.selectedMediaIndex = 0;

  if (typeof document === 'undefined') return;

  populateEnvelopeRootHeader(rootOt);

  const briefEl = document.getElementById('modal-ot-brief');
  if (briefEl) briefEl.value = ot.brief || '';

  const legalEl = document.getElementById('modal-ot-legal');
  if (legalEl) legalEl.value = ot.legalText || '';

  // Botón "← Volver al Stripboard" si se abrió desde Stripboard
  const backBtn = document.getElementById('modal-btn-back-stripboard');
  if (backBtn) {
    if (state.currentMainView === 'stripboard') {
      backBtn.classList.remove('hidden');
    } else {
      backBtn.classList.add('hidden');
    }
  }

  // Selector de fecha para agendar desde el Sobre
  const schedInput = document.getElementById('modal-schedule-date-input');
  if (schedInput) {
    schedInput.value = state.currentStripboardDate || new Date().toISOString().split('T')[0];
  }

  // Renderizar testigo de días asignados en el Stripboard
  renderModalStripboardWitness(ot.id);

  // Contador del badge de archivos
  const tabBadge = document.getElementById('tab-badge-files');
  if (tabBadge) {
    tabBadge.innerText = getEnvelopeVisibleMediaEntries().length;
  }

  renderEnvelopeTaskTree();
  applyEnvelopeTreeSidebarState();
  applyEnvelopeInspectorSidebarState();
  initEnvelopeResizers();
  expandedEnvelopeSubRouteGroups.clear();
  activeInspectorRow = { otId: ot.id, index: Math.max(0, (ot.routes || []).length - 1) };
  updateBitacoraTaskHeader(ot);
  renderRouteSheetRows(ot.routes || []);
  renderEnvelopeInspector();
  renderMediaPool();
  renderInlineEnvelopeMedia();
  applyEnvelopeSectionCollapseState();

  // Guardas RBAC y modo solo lectura para Archivada
  const delBtn = document.getElementById('btn-delete-active-ot');
  if (delBtn) {
    if (state.memberRole !== 'owner') delBtn.classList.add('hidden');
    else delBtn.classList.remove('hidden');
  }

  const clientInput = document.getElementById('modal-ot-client');
  if (clientInput) {
    clientInput.disabled = state.memberRole === 'client' || ot.otStatus === 'Archivada';
  }

  const isArchived = ot.otStatus === 'Archivada';
  const reopenBtn = document.getElementById('btn-reopen-archived-ot');
  if (reopenBtn) {
    if (isArchived && state.memberRole === 'owner') reopenBtn.classList.remove('hidden');
    else reopenBtn.classList.add('hidden');
  }

  const modalEl = document.getElementById('envelope-modal');
  if (modalEl) {
    modalEl.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id === 'modal-schedule-date-input') return;
      if (isArchived) {
        el.disabled = true;
      } else if (el.id !== 'modal-ot-client') {
        el.disabled = false;
      }
    });
  }

  switchOtTab('hoja-ruta');
  const modal = document.getElementById('envelope-modal');
  if (modal) modal.classList.remove('hidden');
  if (typeof window !== 'undefined' && typeof window.updateMainHeaderNav === 'function') {
    window.updateMainHeaderNav('ot');
  }
}

export function reopenArchivedOt() {
  if (state.memberRole !== 'owner' || !state.activeOtId) return;
  const reason = typeof window !== 'undefined'
    ? window.prompt('Nota de justificación obligatoria para reabrir esta OT archivada:')
    : '';
  if (!reason || !reason.trim()) return;

  const orders = getOrders();
  const ot = orders.find(o => o.id === state.activeOtId);
  if (!ot) return;
  ot.otStatus = 'Abierta';
  ot.responsibleDept = 'Tráfico';
  ot.reopenReason = reason.trim();
  saveOrders(orders);
  openEnvelopeModal(ot.id);
  refreshAllViews();
}

export function applyEnvelopeSectionCollapseState() {
  if (typeof document === 'undefined') return;
  const sections = [
    { key: 'bitacora', bodyId: 'envelope-bitacora-body', iconId: 'toggle-envelope-bitacora-icon' },
    { key: 'mediapool', bodyId: 'envelope-mediapool-body', iconId: 'toggle-envelope-mediapool-icon' },
  ];
  sections.forEach(({ key, bodyId, iconId }) => {
    const collapsed = localStorage.getItem(`trafigator_env_collapse_${key}`) === '1';
    const body = document.getElementById(bodyId);
    const iconEl = document.getElementById(iconId);
    if (body) body.classList.toggle('hidden', collapsed);
    if (iconEl) iconEl.innerHTML = lucideIcon(collapsed ? 'expand-diagonal' : 'collapse-diagonal', 'w-[15px] h-[15px]');
  });
}

export function toggleEnvelopeSection(section) {
  if (typeof document === 'undefined') return;
  const storageKey = `trafigator_env_collapse_${section}`;
  const nextCollapsed = localStorage.getItem(storageKey) !== '1';
  localStorage.setItem(storageKey, nextCollapsed ? '1' : '0');
  applyEnvelopeSectionCollapseState();
}

export function closeEnvelopeModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('envelope-modal');
  if (modal) modal.classList.add('hidden');
  state.activeOtId = null;

  if (typeof window !== 'undefined' && typeof window.updateMainHeaderNav === 'function') {
    window.updateMainHeaderNav(state.currentMainView === 'stripboard' ? 'stripboard' : 'desk');
  }

  renderTrafficDesk();
  if (state.currentMainView === 'stripboard') {
    renderStripboard();
  } else {
    renderStripboardPendingPool();
  }
}

export function switchOtTab(tab) {
  state.activeOtTab = tab;
  if (typeof document === 'undefined') return;

  const tabs = ['hoja-ruta', 'media-pool', 'brief'];
  tabs.forEach(t => {
    const el = document.getElementById(`ot-tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (el) {
      if (t === tab) el.classList.remove('hidden');
      else el.classList.add('hidden');
    }
    if (btn) {
      if (t === tab) {
        btn.classList.add('bg-resolve-panel', 'text-white', 'font-bold');
        btn.classList.remove('text-resolve-dimText');
      } else {
        btn.classList.remove('bg-resolve-panel', 'text-white', 'font-bold');
        btn.classList.add('text-resolve-dimText');
      }
    }
  });
}

export function updateActiveOtField(field, value) {
  if (!state.activeOtId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === state.activeOtId);
  if (!ot) return;

  ot[field] = value;
  if (field === 'title') ot.description = value;
  if (field === 'description') ot.title = value;
  if (field === 'brand' && !ot.product) ot.product = value;

  saveOrders(orders);
  refreshAllViews();
}

export function updateRootOtField(field, value) {
  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  if (!rootId) return;
  const orders = getOrders();
  const rootOt = orders.find(o => o.id === rootId);
  if (!rootOt) return;

  rootOt[field] = value;
  if (field === 'title') {
    rootOt.description = value;
    const headerTitle = typeof document !== 'undefined' ? document.getElementById('modal-ot-title-header') : null;
    if (headerTitle) headerTitle.innerText = value;
  }
  if (field === 'description') rootOt.title = value;
  if (field === 'brand' && !rootOt.product) rootOt.product = value;

  saveOrders(orders);
  renderEnvelopeTaskTree();
  refreshAllViews();
}

export function updateRootOtDateField(field, isoValue) {
  const displayVal = fromIsoToDisplay(isoValue);
  updateRootOtField(field, displayVal);
}

export function handleRootStatusChange(val) {
  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  if (!rootId) return;
  if (typeof window !== 'undefined' && typeof window.handleGlobalStatusChange === 'function') {
    window.handleGlobalStatusChange(val, rootId, 'modal-ot-status');
  }
  renderEnvelopeTaskTree();
}

export function handleRootResponsibleChange(val) {
  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  if (!rootId) return;
  if (typeof window !== 'undefined' && typeof window.handleGlobalResponsibleChange === 'function') {
    window.handleGlobalResponsibleChange(val, rootId, 'modal-ot-responsible');
  }
  renderEnvelopeTaskTree();
}

let isEnvelopeTreeCollapsed = (typeof localStorage !== 'undefined' && localStorage.getItem('trafigator_env_tree_collapsed') === 'true');
let isEnvelopeInspectorCollapsed = (typeof localStorage !== 'undefined' && localStorage.getItem('trafigator_env_inspector_collapsed') === 'true');
let activeInspectorRow = { otId: null, index: 0 };
let activeInspectorTab = 'task';

export function setEnvelopeInspectorTab(tab) {
  if (!['task', 'schedule', 'review'].includes(tab)) return;
  activeInspectorTab = tab;
  renderEnvelopeInspector();
}

export function applyEnvelopeInspectorSidebarState() {
  if (typeof document === 'undefined') return;
  const sidebar = document.getElementById('envelope-inspector-sidebar');
  const resizer = document.getElementById('envelope-inspector-resizer');
  const label = document.getElementById('envelope-inspector-header-label');
  const body = document.getElementById('envelope-inspector-body');
  const btn = document.getElementById('toggle-envelope-inspector-btn');
  if (!sidebar) return;

  if (isEnvelopeInspectorCollapsed) {
    sidebar.classList.remove('w-[210px]');
    sidebar.style.width = '32px';
    if (resizer) resizer.classList.add('hidden');
    if (label) label.classList.add('hidden');
    if (body) body.classList.add('hidden');
    if (btn) btn.innerHTML = '&lt;';
  } else {
    const savedW = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('trafigator_env_inspector_width') || '', 10) : NaN;
    sidebar.style.width = (!Number.isNaN(savedW) && savedW >= 180 && savedW <= 480) ? `${savedW}px` : '210px';
    if (resizer) resizer.classList.remove('hidden');
    if (label) label.classList.remove('hidden');
    if (body) body.classList.remove('hidden');
    if (btn) btn.innerHTML = '&gt;';
  }
}

export function toggleEnvelopeInspectorSidebar() {
  isEnvelopeInspectorCollapsed = !isEnvelopeInspectorCollapsed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('trafigator_env_inspector_collapsed', String(isEnvelopeInspectorCollapsed));
    }
  } catch {}
  applyEnvelopeInspectorSidebarState();
}

export function applyEnvelopeTreeSidebarState() {
  if (typeof document === 'undefined') return;
  const sidebar = document.getElementById('envelope-task-tree-sidebar');
  const resizer = document.getElementById('envelope-tree-resizer');
  const label = document.getElementById('envelope-tree-header-label');
  const list = document.getElementById('envelope-task-tree-list');
  const footer = document.getElementById('envelope-tree-footer');
  const btn = document.getElementById('toggle-envelope-tree-btn');
  if (!sidebar) return;

  if (isEnvelopeTreeCollapsed) {
    sidebar.classList.remove('w-[210px]');
    sidebar.style.width = '32px';
    if (resizer) resizer.classList.add('hidden');
    if (label) label.classList.add('hidden');
    if (list) list.classList.add('hidden');
    if (footer) footer.classList.add('hidden');
    if (btn) btn.innerHTML = '&gt;';
  } else {
    sidebar.classList.remove('w-8');
    const savedW = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('trafigator_env_tree_width') || '', 10) : NaN;
    sidebar.style.width = (!Number.isNaN(savedW) && savedW >= 150 && savedW <= 420) ? `${savedW}px` : '210px';
    if (resizer) resizer.classList.remove('hidden');
    if (label) label.classList.remove('hidden');
    if (list) list.classList.remove('hidden');
    if (footer) footer.classList.remove('hidden');
    if (btn) btn.innerHTML = '&lt;';
  }
}

export function toggleEnvelopeTaskTreeSidebar() {
  isEnvelopeTreeCollapsed = !isEnvelopeTreeCollapsed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('trafigator_env_tree_collapsed', String(isEnvelopeTreeCollapsed));
    }
  } catch {}
  applyEnvelopeTreeSidebarState();
}

function bindEnvelopeResizer(resizerId, axis, getInitialSize, onResize, storageKey, minSize, maxSize, invert = false) {
  if (typeof document === 'undefined') return;
  const resizer = document.getElementById(resizerId);
  if (!resizer || resizer.dataset.bound === '1') return;
  resizer.dataset.bound = '1';

  resizer.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const startPos = axis === 'x' ? e.clientX : e.clientY;
    const startSize = getInitialSize();
    let latestSize = startSize;

    resizer.classList.add('bg-sky-400');
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      const rawDelta = (axis === 'x' ? ev.clientX : ev.clientY) - startPos;
      const delta = invert ? -rawDelta : rawDelta;
      latestSize = Math.max(minSize, Math.min(maxSize, startSize + delta));
      onResize(latestSize);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      resizer.classList.remove('bg-sky-400');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        if (storageKey && typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, String(Math.round(latestSize)));
        }
      } catch {}
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
}

export function initEnvelopeResizers() {
  if (typeof document === 'undefined') return;

  const treeSidebar = document.getElementById('envelope-task-tree-sidebar');
  if (treeSidebar) {
    bindEnvelopeResizer(
      'envelope-tree-resizer',
      'x',
      () => treeSidebar.getBoundingClientRect().width,
      (w) => { treeSidebar.style.width = `${w}px`; },
      'trafigator_env_tree_width',
      150,
      420
    );
  }

  const inspectorSidebar = document.getElementById('envelope-inspector-sidebar');
  if (inspectorSidebar) {
    bindEnvelopeResizer(
      'envelope-inspector-resizer',
      'x',
      () => inspectorSidebar.getBoundingClientRect().width,
      (w) => { inspectorSidebar.style.width = `${w}px`; },
      'trafigator_env_inspector_width',
      180,
      480,
      true
    );
  }

  const bitacoraBody = document.getElementById('envelope-bitacora-body');
  if (bitacoraBody) {
    bitacoraBody.style.overflowY = 'auto';
    const savedH = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('trafigator_env_bitacora_height') || '', 10) : NaN;
    if (!Number.isNaN(savedH) && savedH >= 110 && savedH <= 480) {
      bitacoraBody.style.maxHeight = `${savedH}px`;
    }
    bindEnvelopeResizer(
      'envelope-bitacora-resizer',
      'y',
      () => bitacoraBody.getBoundingClientRect().height,
      (h) => { bitacoraBody.style.maxHeight = `${h}px`; },
      'trafigator_env_bitacora_height',
      110,
      480
    );
  }

  const mpLeft = document.getElementById('envelope-mediapool-left');
  const mpViewer = document.getElementById('envelope-inline-viewer');
  if (mpLeft) {
    const savedMpW = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('trafigator_env_mediapool_left_width') || '', 10) : NaN;
    if (!Number.isNaN(savedMpW) && savedMpW >= 220 && savedMpW <= 680) {
      mpLeft.style.width = `${savedMpW}px`;
    }
    bindEnvelopeResizer(
      'envelope-mediapool-resizer',
      'x',
      () => mpLeft.getBoundingClientRect().width,
      (w) => { mpLeft.style.width = `${w}px`; },
      'trafigator_env_mediapool_left_width',
      220,
      680
    );

    const savedMpH = typeof localStorage !== 'undefined' ? parseInt(localStorage.getItem('trafigator_env_mediapool_height') || '', 10) : NaN;
    if (!Number.isNaN(savedMpH) && savedMpH >= 220 && savedMpH <= 680) {
      mpLeft.style.height = `${savedMpH}px`;
      if (mpViewer) mpViewer.style.height = `${savedMpH}px`;
    }
    bindEnvelopeResizer(
      'envelope-mediapool-height-resizer',
      'y',
      () => mpLeft.getBoundingClientRect().height,
      (h) => {
        mpLeft.style.height = `${h}px`;
        if (mpViewer) mpViewer.style.height = `${h}px`;
      },
      'trafigator_env_mediapool_height',
      220,
      680
    );
  }
}

export function renderEnvelopeTaskTree() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('envelope-task-tree-list');
  if (!container) return;

  const orders = getOrders();
  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  const rootOt = orders.find(o => o.id === rootId);
  if (!rootOt) {
    container.innerHTML = '';
    return;
  }

  const activeTaskId = state.activeEnvelopeTaskId || rootOt.id;
  const subOts = orders
    .filter(o => o.parentOtId === rootOt.id || (typeof o.id === 'string' && o.id.startsWith(rootOt.id + '-')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));

  const rootSelected = activeTaskId === rootOt.id;
  const hasSubs = subOts.length > 0;

  let html = `
    <div class="space-y-0.5 select-none">
      <div
        onclick="selectEnvelopeTreeTask('${escapeHtml(rootOt.id)}')"
        title="${escapeHtml(rootOt.id)} — ${escapeHtml(rootOt.title || rootOt.description || 'OT Madre')} (${escapeHtml(rootOt.responsibleDept || 'Tráfico')})"
        class="flex items-center justify-between gap-1.5 px-1.5 py-1 rounded-md cursor-pointer group transition-colors text-[11px] ${rootSelected ? 'bin-active bg-white/[0.08] text-sky-300' : 'text-resolve-dimText hover:bg-white/[0.05] hover:text-zinc-200'}"
      >
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          ${hasSubs ? lucideIcon('collapse-diagonal', 'w-3 h-3', 'text-sky-400') : `<span class="w-3 shrink-0"></span>`}
          ${lucideIcon('module-ot', 'w-[15px] h-[15px]', 'text-sky-400')}
          <span class="font-mono font-bold truncate ${rootSelected ? 'text-sky-300' : 'text-zinc-200'}">${escapeHtml(rootOt.id)}</span>
        </div>
        <span class="text-[9px] text-zinc-400 shrink-0 truncate max-w-[68px]">${escapeHtml(rootOt.responsibleDept || 'Tráfico')}</span>
      </div>
  `;

  if (hasSubs) {
    html += `<div class="pl-3.5 ml-2.5 border-l border-resolve-border/60 space-y-0.5 mt-0.5">`;
    html += subOts.map(sub => {
      const subSel = activeTaskId === sub.id;
      const subLabel = sub.taskTitle || sub.title || sub.medium || sub.media || 'Subtarea';
      const subSuffix = typeof sub.id === 'string' && sub.id.startsWith(rootOt.id + '-')
        ? sub.id.slice(rootOt.id.length)
        : sub.id;
      return `
        <div
          onclick="selectEnvelopeTreeTask('${escapeHtml(sub.id)}')"
          title="${escapeHtml(sub.id)} • ${escapeHtml(subLabel)} (${escapeHtml(sub.responsibleDept || 'Tráfico')})"
          class="flex items-center justify-between gap-1.5 px-1.5 py-1 rounded-md cursor-pointer group transition-colors text-[11px] ${subSel ? 'bin-active bg-white/[0.08] text-sky-300' : 'text-resolve-dimText hover:bg-white/[0.05] hover:text-zinc-200'}"
        >
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            ${lucideIcon('file-text', 'w-3 h-3', subSel ? 'text-sky-400' : 'text-zinc-500 group-hover:text-sky-400')}
            <span class="font-mono text-[10px] shrink-0 ${subSel ? 'text-sky-300 font-bold' : 'text-zinc-400'}">${escapeHtml(subSuffix)}</span>
            <span class="truncate text-[11px] ${subSel ? 'text-white font-semibold' : 'text-zinc-300 group-hover:text-white'}">${escapeHtml(subLabel)}</span>
          </div>
          <span class="text-[9px] text-zinc-500 shrink-0 truncate max-w-[56px]">${escapeHtml(sub.responsibleDept || 'Tráfico')}</span>
        </div>
      `;
    }).join('');
    html += `</div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

function updateBitacoraTaskHeader(taskOt) {
  if (typeof document === 'undefined' || !taskOt) return;
  const badgeEl = document.getElementById('envelope-bitacora-task-id-badge');
  const titleInput = document.getElementById('envelope-bitacora-task-title-input');
  const subEl = document.getElementById('envelope-bitacora-task-subtitle');
  const taskTitle = (taskOt.taskTitle !== undefined && taskOt.taskTitle !== null)
    ? taskOt.taskTitle
    : (taskOt.title || '');
  if (badgeEl) {
    badgeEl.innerText = taskOt.id || '';
  }
  if (titleInput) {
    titleInput.value = taskTitle;
  }
  if (subEl) {
    subEl.innerText = `Bitácora de Relevos y Movimientos • ${taskOt.media || taskOt.medium || 'General'}`;
  }
}

export function updateActiveTaskTitle(newTitle) {
  const targetId = state.activeEnvelopeTaskId || state.activeOtId;
  if (!targetId) return;
  const orders = getOrders();
  const taskOt = orders.find(o => o.id === targetId);
  if (!taskOt) return;

  const clean = (newTitle || '').trim();
  taskOt.taskTitle = clean;
  if (taskOt.parentOtId || (state.activeEnvelopeRootId && taskOt.id !== state.activeEnvelopeRootId)) {
    taskOt.title = clean;
  }
  saveOrders(orders);
  renderEnvelopeTaskTree();
  renderRouteSheetRows(taskOt.routes || []);
  refreshAllViews();
}

export function updateRouteTaskTitle(newTitle, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const taskOt = orders.find(o => o.id === otId);
  if (!taskOt) return;

  const clean = (newTitle || '').trim();
  taskOt.taskTitle = clean;
  if (taskOt.parentOtId || (state.activeEnvelopeRootId && taskOt.id !== state.activeEnvelopeRootId)) {
    taskOt.title = clean;
  }
  saveOrders(orders);
  if ((state.activeEnvelopeTaskId || state.activeOtId) === taskOt.id) {
    updateBitacoraTaskHeader(taskOt);
  }
  renderEnvelopeTaskTree();
  renderRouteSheetRows(taskOt.routes || []);
  refreshAllViews();
}

export function selectEnvelopeTreeTask(targetOtId) {
  if (!targetOtId) return;
  const orders = getOrders();
  const taskOt = orders.find(o => o.id === targetOtId);
  if (!taskOt) return;

  state.activeEnvelopeTaskId = taskOt.id;
  state.activeOtId = taskOt.id;
  state.selectedMediaIndex = 0;
  activeInspectorRow = { otId: taskOt.id, index: Math.max(0, (taskOt.routes || []).length - 1) };

  if (typeof document !== 'undefined') {
    const briefEl = document.getElementById('modal-ot-brief');
    if (briefEl) briefEl.value = taskOt.brief || '';
    const legalEl = document.getElementById('modal-ot-legal');
    if (legalEl) legalEl.value = taskOt.legalText || '';
    const tabBadge = document.getElementById('tab-badge-files');
    if (tabBadge) tabBadge.innerText = getEnvelopeVisibleMediaEntries().length;
  }

  updateBitacoraTaskHeader(taskOt);
  renderEnvelopeTaskTree();
  renderModalStripboardWitness(taskOt.id);
  renderRouteSheetRows(taskOt.routes || []);
  renderEnvelopeInspector();
  renderMediaPool();
  renderInlineEnvelopeMedia();
}

export async function createEnvelopeSubTask() {
  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  if (!rootId) return;
  const rootOt = getOrderById(rootId);
  if (!rootOt) return;

  try {
    const subTitle = typeof window !== 'undefined'
      ? window.prompt(`Descripción de la Sub-tarea para ${rootOt.id}:`, `Entregable de ${rootOt.title || rootOt.id}`)
      : `Entregable de ${rootOt.id}`;
    if (subTitle === null) return;

    const created = await createOt({
      parentOtId: rootOt.id,
      client: rootOt.client || 'Interno',
      brand: rootOt.brand || '',
      product: rootOt.product || '',
      ref: rootOt.ref || '',
      title: subTitle.trim() || `Sub-OT de ${rootOt.id}`,
      discipline: rootOt.discipline || 'advertising',
      media: rootOt.media || 'Digital'
    });
    if (created) {
      refreshAllViews();
      selectEnvelopeTreeTask(created.id);
    }
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.alert(err?.message || 'Error al crear la Sub-tarea.');
    }
  }
}

export function deleteActiveOt() {
  if (state.memberRole !== 'owner') return;
  if (!state.activeOtId) return;
  if (typeof window !== 'undefined' && !window.confirm("¿Deseas eliminar permanentemente esta Orden de Trabajo de la mesa?")) return;

  deleteOt(state.activeOtId);
  closeEnvelopeModal();
}

// ============================================================================
// TESTIGO DE DÍAS Y AGENDAMIENTO DESDE EL SOBRE OT
// ============================================================================

export function renderModalStripboardWitness(otId) {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('modal-ot-stripboard-days');
  if (!container) return;

  const scheduledDays = getOtScheduledDays(otId);
  if (scheduledDays.length === 0) {
    container.innerHTML = `<span class="text-stone-500 italic text-[11px]">Esta OT aún no tiene turnos asignados en el Stripboard.</span>`;
    return;
  }

  container.innerHTML = scheduledDays.map(d => {
    return d.matched.map(m => {
      let pillColor = 'bg-white/[0.04] text-zinc-300 border-white/[0.08] hover:border-sky-400/50';
      if (m.strip.shiftStatus === 'En Mesa') pillColor = 'bg-sky-500/10 text-sky-300 border-sky-500/25';
      else if (m.strip.shiftStatus === 'Entregado') pillColor = 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25';
      else if (m.strip.shiftStatus === 'Detenido') pillColor = 'bg-rose-500/10 text-rose-300 border-rose-500/25';

      return `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-medium ${pillColor}">
          <button
            type="button"
            onclick="jumpFromModalToStripboardDate('${d.dateStr}')"
            title="Cerrar sobre e ir al Stripboard del ${d.shortLabel}"
            class="font-semibold hover:underline cursor-pointer"
          >
            ${d.shortLabel} • <span class="font-mono">${escapeHtml(m.strip.timeSlot || '')}</span> (${escapeHtml(m.strip.assignee || 'Creativos')} • ${escapeHtml(m.strip.shiftStatus || 'Por Iniciar')})
          </button>
          <button
            type="button"
            onclick="removeStripFromModalWitness('${d.dateStr}', ${m.idx})"
            title="Quitar este turno del ${d.shortLabel}"
            class="text-stone-400 hover:text-red-400 font-bold cursor-pointer"
          >
            ✕
          </button>
        </span>
      `;
    }).join('');
  }).join('');
}

export function jumpFromModalToStripboardDate(dateStr) {
  closeEnvelopeModal();
  emit('view:switch', { view: 'stripboard' });
  if (typeof window !== 'undefined' && typeof window.switchMainView === 'function') {
    window.switchMainView('stripboard');
  }
  selectStripboardDate(dateStr, false);
}

export function removeStripFromModalWitness(dateStr, stripIdx) {
  removeStrip(stripIdx, dateStr);
  if (state.activeOtId) {
    renderModalStripboardWitness(state.activeOtId);
    renderEnvelopeInspector();
  }
}

export function scheduleActiveOtFromModal() {
  if (!state.activeOtId) return;
  const schedInput = document.getElementById('modal-schedule-date-input');
  const targetDate = (schedInput && schedInput.value) ? schedInput.value : state.currentStripboardDate;
  const destStrips = getDayStrips(targetDate);
  insertOtStripOnDate(state.activeOtId, targetDate, destStrips.length);
  renderModalStripboardWitness(state.activeOtId);
}

// ============================================================================
// 2. HOJA DE RUTA (7 COLUMNAS) Y FIRMAS DE TINTA RETRO
// ============================================================================

const collapsedEnvelopeRouteGroups = new Set();
const expandedEnvelopeSubRouteGroups = new Set();

function getSubOtsForRoot(rootId) {
  if (!rootId) return [];
  return getOrders()
    .filter(o => o.parentOtId === rootId || (typeof o.id === 'string' && o.id.startsWith(rootId + '-')))
    .sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
}

export function toggleEnvelopeRouteGroup(otId) {
  if (!otId) return;
  if (otId === state.activeEnvelopeRootId) {
    if (collapsedEnvelopeRouteGroups.has(otId)) collapsedEnvelopeRouteGroups.delete(otId);
    else collapsedEnvelopeRouteGroups.add(otId);
  } else {
    if (expandedEnvelopeSubRouteGroups.has(otId)) expandedEnvelopeSubRouteGroups.delete(otId);
    else expandedEnvelopeSubRouteGroups.add(otId);
  }
  const ot = state.activeOtId ? getOrderById(state.activeOtId) : null;
  renderRouteSheetRows(ot?.routes || []);
}

function isCurrentUserRouteCreator(row) {
  if (!row) return false;
  const currentUserId = state.currentUser?.id || null;
  if (row.createdByUserId) {
    return Boolean(currentUserId && row.createdByUserId === currentUserId);
  }
  const currentShort = (getActiveUserShortName() || '').trim().toLowerCase();
  const rowSign = (row.sign || '').trim().toLowerCase();
  return Boolean(currentShort && rowSign && rowSign === currentShort);
}

function getRouteRowLockState(taskOt, row, index) {
  const routes = Array.isArray(taskOt?.routes) ? taskOt.routes : [];
  const isLastEntry = index === routes.length - 1;
  if (!isLastEntry) {
    return {
      isLocked: true,
      canToggle: false,
      title: 'Bloqueada permanentemente por entrada posterior',
    };
  }
  const isCreator = isCurrentUserRouteCreator(row);
  if (!isCreator) {
    return {
      isLocked: true,
      canToggle: false,
      title: 'Bloqueada (solo el creador de esta entrada puede abrir o cerrar el candado)',
    };
  }
  const isLocked = Boolean(row?.locked);
  return {
    isLocked,
    canToggle: true,
    title: isLocked ? 'Fila bloqueada (clic para desbloquear)' : 'Fila activa (clic para bloquear)',
  };
}

function getRouteSignOptionsHtml(selectedSign, isRowLocked) {
  const cleanSelected = String(selectedSign || '').trim();
  if (isRowLocked) {
    return `<option value="${escapeHtml(cleanSelected)}" selected>${escapeHtml(cleanSelected || 'Sin firmar')}</option>`;
  }
  const activeShort = (getActiveUserShortName() || 'Usuario').trim();
  return `
    <option value="" ${cleanSelected === '' ? 'selected' : ''}>Sin firmar...</option>
    <option value="${escapeHtml(activeShort)}" ${cleanSelected === activeShort ? 'selected' : ''}>${escapeHtml(activeShort)}</option>
  `;
}

function renderSingleRouteRowHtml(row, index, taskOt) {
  if (!String(row?.sign || '').trim() && !isCurrentUserRouteCreator(row)) {
    return '';
  }
  const otIdArg = taskOt?.id ? `'${escapeHtml(taskOt.id)}'` : 'null';
  const lockState = getRouteRowLockState(taskOt, row, index);
  const isRowLocked = lockState.isLocked;
  const lockAttr = isRowLocked ? 'disabled' : '';
  const isOdd = (index % 2 === 1);
  const zebraClass = isOdd ? 'bg-white/[0.055]' : 'bg-black/25';
  const isInspected = Boolean(taskOt?.id && activeInspectorRow.otId === taskOt.id && activeInspectorRow.index === index);
  const inspectedClass = isInspected ? 'ring-1 ring-inset ring-sky-400/60 bg-sky-500/[0.08]' : '';
  const rowSign = String(row.sign || '').trim();
  const respColors = rowSign ? getResponsibleColorClasses(rowSign) : { text: 'text-zinc-400', border: 'border-resolve-border' };

  return `
      <tr onclick="selectBitacoraInspectorRow(${otIdArg}, ${index})" class="${zebraClass} ${inspectedClass} hover:bg-white/[0.08] transition-colors font-mono text-[11px]">
        <!-- 1. FECHA: -->
        <td class="p-2 border-r border-resolve-border align-middle">
          <div class="flex items-center gap-1">
            <input 
              type="datetime-local" 
              ${lockAttr}
              value="${toIsoDateTime(row.entryDate)}" 
              onchange="updateRouteDateCell(${index}, 'entryDate', this.value, ${otIdArg})" 
              onclick="if(!this.disabled) try { this.showPicker(); } catch(e) {}"
              style="color-scheme: dark;"
              class="w-full bg-black/40 border border-resolve-border rounded px-1.5 py-0.5 text-[11px] text-zinc-200 font-mono focus:border-sky-500/60 focus:outline-none ${isRowLocked ? 'cursor-not-allowed' : 'hover:bg-black/60 hover:border-sky-400/50 cursor-pointer'}"
            />
            <button 
              type="button" 
              ${lockAttr}
              title="Poner fecha y hora actual" 
              onclick="stampCurrentTime(${index}, 'entryDate', ${otIdArg})" 
              class="p-0.5 text-zinc-400 rounded transition-colors shrink-0 ${isRowLocked ? 'hidden' : 'hover:text-white hover:bg-white/[0.08] cursor-pointer'}"
            >
              ${lucideIcon('clock', 'w-[15px] h-[15px]')}
            </button>
          </div>
        </td>

        <!-- 2. DE: -->
        <td class="p-2 border-r border-resolve-border align-middle text-[11px]">
          <select 
            ${lockAttr}
            onchange="handleRouteDeptChange(${index}, 'from', this.value, ${otIdArg})" 
            class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-0.5 text-[11px] font-medium text-sky-300 focus:border-sky-500/60 focus:outline-none ${isRowLocked ? 'cursor-not-allowed' : 'hover:border-sky-400/50 cursor-pointer'}"
          >
            ${getDepartmentOptionsHtml(row.from || 'Tráfico')}
          </select>
        </td>

        <!-- 3. PARA: -->
        <td class="p-2 border-r border-resolve-border align-middle text-[11px]">
          <select 
            ${lockAttr}
            onchange="handleRouteDeptChange(${index}, 'to', this.value, ${otIdArg})" 
            class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-0.5 text-[11px] font-medium text-sky-300 focus:border-sky-500/60 focus:outline-none ${isRowLocked ? 'cursor-not-allowed' : 'hover:border-sky-400/50 cursor-pointer'}"
          >
            ${getDepartmentOptionsHtml(row.to || 'Creativos')}
          </select>
        </td>

        <!-- 4. DESCRIPCIÓN -->
        <td class="p-2 border-r border-resolve-border align-middle text-[11px]">
          <input 
            type="text" 
            ${lockAttr}
            data-route-cell="${escapeHtml(taskOt?.id || '')}:${index}:task"
            value="${escapeHtml(row.task || '')}" 
            onfocus="selectBitacoraInspectorRow(${otIdArg}, ${index})"
            oninput="updateRouteCell(${index}, 'task', this.value, ${otIdArg})"
            onchange="updateRouteCell(${index}, 'task', this.value, ${otIdArg})" 
            placeholder="Instrucción del relevo..." 
            class="w-full bg-transparent border-0 border-b border-transparent focus:border-sky-500 focus:ring-0 text-[11px] font-sans text-zinc-100 px-1 py-0.5 leading-tight ${isRowLocked ? 'cursor-not-allowed' : 'hover:border-resolve-border'}"
          />
        </td>

        <!-- 5. FIRMA -->
        <td class="p-2 border-r border-resolve-border align-middle">
          <select 
            ${lockAttr}
            onchange="handleRouteSignChange(${index}, this.value, ${otIdArg})" 
            class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-0.5 text-[11px] font-semibold ${respColors.text} focus:border-current focus:outline-none ${isRowLocked ? 'cursor-not-allowed' : `hover:${respColors.border} cursor-pointer`}"
          >
            ${getRouteSignOptionsHtml(rowSign, isRowLocked)}
          </select>
        </td>

        <!-- 6. NOTAS -->
        <td class="p-2 border-r border-resolve-border align-middle">
          <input 
            type="text" 
            ${lockAttr}
            data-route-cell="${escapeHtml(taskOt?.id || '')}:${index}:notes"
            value="${escapeHtml(row.notes || '')}" 
            onfocus="selectBitacoraInspectorRow(${otIdArg}, ${index})"
            oninput="updateRouteCell(${index}, 'notes', this.value, ${otIdArg})"
            onchange="updateRouteCell(${index}, 'notes', this.value, ${otIdArg})" 
            placeholder="Notas..." 
            class="w-full bg-transparent border-0 border-b border-transparent focus:border-sky-500 focus:ring-0 text-[11px] font-sans text-zinc-300 px-1 py-0.5 leading-tight ${isRowLocked ? 'cursor-not-allowed' : 'hover:border-resolve-border'}"
          />
        </td>

        <!-- 7. CANDADO -->
        <td class="p-2 align-middle text-center">
          <button type="button" ${lockState.canToggle ? `onclick="event.stopPropagation(); toggleRouteRowLock(${index}, ${otIdArg})"` : 'disabled'} title="${escapeHtml(lockState.title)}" class="w-7 h-7 inline-flex items-center justify-center rounded transition-colors ${!lockState.canToggle ? 'bg-black/40 text-zinc-400 border border-white/[0.06] cursor-not-allowed' : (isRowLocked ? 'bg-sky-500/15 text-sky-300 border border-sky-500/40 hover:bg-sky-500/25 cursor-pointer' : 'bg-white/[0.04] text-emerald-400 border border-resolve-border hover:text-sky-300 hover:border-sky-500/40 cursor-pointer')}">
            ${lucideIcon(isRowLocked ? 'lock' : 'lock-open', 'w-[15px] h-[15px]')}
          </button>
        </td>
      </tr>
  `;
}

export function renderRouteSheetRows(routes) {
  if (typeof document === 'undefined') return;
  const tbody = document.getElementById('route-sheet-rows');
  if (!tbody) return;

  if (!routes || routes.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="p-8 text-center text-zinc-400 italic font-medium">
          Sin relevos asentados. Pulsa "+" para registrar un paso.
        </td>
      </tr>
    `;
    return;
  }

  const activeTaskOt = state.activeOtId ? getOrderById(state.activeOtId) : null;
  tbody.innerHTML = routes.map((row, index) => renderSingleRouteRowHtml(row, index, activeTaskOt)).join('');
}

export function addNewRouteRow() {
  if (!state.activeOtId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === state.activeOtId);
  if (!ot) return;

  if (!ot.routes) ot.routes = [];

  const profile = getUserProfile();
  const userPrimaryDept = (profile.departments && profile.departments.length > 0) ? profile.departments[0] : "Tráfico";
  const activeUserShort = getActiveUserShortName();

  let defaultFrom = userPrimaryDept;
  let defaultTo = "Creativos";
  if (ot.routes.length > 0) {
    const last = ot.routes[ot.routes.length - 1];
    defaultFrom = last.to || userPrimaryDept;
    defaultTo = last.from || "Creativos";
  }

  ot.routes.forEach((r) => {
    r.locked = true;
  });

  ot.routes.push({
    from: defaultFrom,
    to: defaultTo,
    task: "",
    status: ot.responsibleDept || "Tráfico",
    entryDate: getNowFormatted(),
    deliveryDate: "",
    sign: "",
    notes: "",
    stamp: null,
    locked: false,
    createdByUserId: state.currentUser?.id || null
  });

  saveOrders(orders);
  activeInspectorRow = { otId: ot.id, index: ot.routes.length - 1 };
  renderRouteSheetRows(ot.routes);
  renderEnvelopeInspector();
  refreshAllViews();
}

function resolveInspectorTarget() {
  const activeTaskId = state.activeEnvelopeTaskId || state.activeOtId;
  if (!activeTaskId) return null;

  if (activeInspectorRow.otId) {
    const candidate = getOrderById(activeInspectorRow.otId);
    if (candidate && Array.isArray(candidate.routes) && candidate.routes[activeInspectorRow.index]) {
      return { ot: candidate, index: activeInspectorRow.index, row: candidate.routes[activeInspectorRow.index] };
    }
  }

  const fallbackOt = getOrderById(activeTaskId);
  if (!fallbackOt || !Array.isArray(fallbackOt.routes) || fallbackOt.routes.length === 0) return null;
  const idx = fallbackOt.routes.length - 1;
  activeInspectorRow = { otId: fallbackOt.id, index: idx };
  return { ot: fallbackOt, index: idx, row: fallbackOt.routes[idx] };
}

export function selectBitacoraInspectorRow(otId, index) {
  if (!otId) return;
  if (activeInspectorRow.otId === otId && activeInspectorRow.index === index) return;
  activeInspectorRow = { otId, index };
  const activeOt = state.activeOtId ? getOrderById(state.activeOtId) : null;
  renderRouteSheetRows(activeOt?.routes || []);
  renderEnvelopeInspector();
}

export function updateRouteCellFromInspector(index, field, value, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot || !ot.routes[index]) return;

  ot.routes[index][field] = value;
  saveOrders(orders);
  if (typeof document !== 'undefined') {
    const cellInput = document.querySelector(`[data-route-cell="${otId}:${index}:${field}"]`);
    if (cellInput && cellInput.value !== value) {
      cellInput.value = value;
    }
  }
  refreshAllViews();
}

export function stepEnvelopeTask(delta) {
  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  if (!rootId) return;
  const rootOt = getOrderById(rootId);
  if (!rootOt) return;
  const nodes = [rootOt, ...getSubOtsForRoot(rootId)];
  if (nodes.length <= 1) return;

  const currentId = state.activeEnvelopeTaskId || state.activeOtId || rootId;
  const currentIdx = Math.max(0, nodes.findIndex(n => n.id === currentId));
  const nextIdx = (currentIdx + delta + nodes.length) % nodes.length;
  selectEnvelopeTreeTask(nodes[nextIdx].id);
}

export function syncInspectorTaskToStripboard(targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId || typeof document === 'undefined') return;
  const dateEl = document.getElementById('inspector-sched-date');
  const slotEl = document.getElementById('inspector-sched-timeslot');
  const respEl = document.getElementById('inspector-sched-assignee');

  const targetDate = (dateEl && dateEl.value) ? dateEl.value : (state.currentStripboardDate || new Date().toISOString().split('T')[0]);
  const timeSlot = (slotEl && slotEl.value.trim()) ? slotEl.value.trim() : '09:00 - 11:00';
  const assignee = (respEl && respEl.value) ? respEl.value : (getOrderById(otId)?.sign || getActiveUserShortName() || 'Creativos');

  const strips = getDayStrips(targetDate);
  const existing = strips.find(s => s.otId === otId);
  if (existing) {
    existing.timeSlot = timeSlot;
    existing.assignee = assignee;
    saveDayStrips(targetDate, strips);
  } else {
    insertOtStripOnDate(otId, targetDate, strips.length);
    const updatedStrips = getDayStrips(targetDate);
    const inserted = updatedStrips[updatedStrips.length - 1];
    if (inserted && inserted.otId === otId) {
      inserted.timeSlot = timeSlot;
      inserted.assignee = assignee;
      saveDayStrips(targetDate, updatedStrips);
    }
  }

  renderModalStripboardWitness(otId);
  renderEnvelopeInspector();
  refreshAllViews();
}

export function closeInspectorTaskAsDone(targetOtId = state.activeOtId, routeIndex = null) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const statuses = getStatuses();
  const doneStatus = statuses.find(s => /entreg|termin|finaliz/i.test(s.name))?.name || 'Entregado';
  syncOtStatusAndRoute(otId, doneStatus, { syncLatestRouteStatus: true });

  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (ot && Array.isArray(ot.routes) && routeIndex !== null && ot.routes[routeIndex]) {
    ot.routes[routeIndex].status = doneStatus;
    ot.routes[routeIndex].locked = true;
    saveOrders(orders);
  }
  if (otId === state.activeEnvelopeRootId) syncHeaderStatusSelect(doneStatus);
  renderEnvelopeTaskTree();
  renderRouteSheetRows(ot?.routes || []);
  renderEnvelopeInspector();
  refreshAllViews();
}

export function cancelInspectorTask(targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  if (typeof window !== 'undefined' && !window.confirm(`¿Marcar la tarea ${otId} como cancelada / detenida?`)) return;
  const statuses = getStatuses();
  const cancelStatus = statuses.find(s => /cancel|deten/i.test(s.name))?.name || 'Detenido';
  syncOtStatusAndRoute(otId, cancelStatus, { syncLatestRouteStatus: true });
  if (otId === state.activeEnvelopeRootId) syncHeaderStatusSelect(cancelStatus);

  const ot = getOrderById(otId);
  renderEnvelopeTaskTree();
  renderRouteSheetRows(ot?.routes || []);
  renderEnvelopeInspector();
  refreshAllViews();
}

export async function duplicateInspectorTask(targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const src = getOrderById(otId);
  if (!src) return;

  const baseTitle = (src.taskTitle !== undefined && src.taskTitle !== null) ? src.taskTitle : (src.title || src.description || 'Tarea');
  const copyTitle = `${baseTitle} (Copia)`;
  const created = await createOt({
    parentOtId: src.parentOtId || null,
    client: src.client || '',
    brand: src.brand || '',
    product: src.product || '',
    media: src.media || src.medium || '',
    medium: src.medium || src.media || '',
    reference: src.reference || '',
    description: src.description || '',
    taskTitle: copyTitle,
    title: copyTitle,
    sign: src.sign || getActiveUserShortName() || 'Usuario',
    status: 'Tráfico',
    entryDate: getNowFormatted(),
    deliveryDate: src.deliveryDate || ''
  });

  if (created && created.id) {
    renderEnvelopeTaskTree();
    selectEnvelopeTreeTask(created.id);
    refreshAllViews();
  }
}

export function deleteInspectorTask(targetOtId = state.activeOtId) {
  if (state.memberRole !== 'owner') return;
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const ot = getOrderById(otId);
  if (!ot) return;
  if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar permanentemente ${otId}?`)) return;

  const parentId = ot.parentOtId || (otId !== state.activeEnvelopeRootId ? state.activeEnvelopeRootId : null);
  deleteOt(otId);
  if (parentId && getOrderById(parentId)) {
    selectEnvelopeTreeTask(parentId);
    refreshAllViews();
  } else {
    closeEnvelopeModal();
  }
}

export function deleteInspectorRowOrTask(targetOtId = state.activeOtId, routeIndex = null) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot) return;

  if (routeIndex !== null && Array.isArray(ot.routes) && ot.routes[routeIndex]) {
    const lockState = getRouteRowLockState(ot, ot.routes[routeIndex], routeIndex);
    if (lockState.isLocked) {
      if (typeof window !== 'undefined') window.alert(lockState.title);
      return;
    }
    if (ot.routes.length > 1) {
      if (typeof window !== 'undefined' && !window.confirm('¿Eliminar esta tarea de la bitácora?')) return;
      ot.routes.splice(routeIndex, 1);
      saveOrders(orders);
      if (activeInspectorRow.otId === otId && activeInspectorRow.index >= ot.routes.length) {
        activeInspectorRow.index = Math.max(0, ot.routes.length - 1);
      }
      renderRouteSheetRows(ot.routes);
      renderEnvelopeInspector();
      refreshAllViews();
      return;
    }
    if (ot.parentOtId || (state.activeEnvelopeRootId && ot.id !== state.activeEnvelopeRootId)) {
      if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar permanentemente la tarea ${ot.id}?`)) return;
      const parentId = ot.parentOtId || state.activeEnvelopeRootId;
      deleteOt(ot.id);
      if (parentId && getOrderById(parentId)) selectEnvelopeTreeTask(parentId);
      refreshAllViews();
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('¿Eliminar esta fila de la bitácora?')) return;
    ot.routes.splice(routeIndex, 1);
    saveOrders(orders);
    activeInspectorRow.index = 0;
    renderRouteSheetRows(ot.routes);
    renderEnvelopeInspector();
    refreshAllViews();
    return;
  }

  deleteInspectorTask(otId);
}

export function renderEnvelopeInspector() {
  if (typeof document === 'undefined') return;
  const body = document.getElementById('envelope-inspector-body');
  if (!body) return;

  const rootId = state.activeEnvelopeRootId || state.activeOtId;
  const rootOt = rootId ? getOrderById(rootId) : null;
  const navNodes = rootOt ? [rootOt, ...getSubOtsForRoot(rootOt.id)] : [];
  const activeTaskId = state.activeEnvelopeTaskId || state.activeOtId || rootId;
  const activeOt = activeTaskId ? getOrderById(activeTaskId) : null;

  const target = resolveInspectorTarget();
  const ot = target?.ot || activeOt;
  if (!ot) {
    body.innerHTML = `<div class="p-3 text-[11px] text-zinc-400">Sin tarea activa.</div>`;
    return;
  }

  const index = target ? target.index : null;
  const row = target ? target.row : null;
  const otIdArg = `'${escapeHtml(ot.id)}'`;
  const isLocked = index !== null ? getRouteRowLockState(ot, row, index).isLocked : false;
  const lockAttr = isLocked ? 'disabled' : '';
  const isDeliveryLocked = isLocked || (state.memberRole !== 'owner' && Boolean((row?.deliveryDate || ot.deliveryDate) && String(row?.deliveryDate || ot.deliveryDate).trim()));
  const taskTitle = (ot.taskTitle !== undefined && ot.taskTitle !== null) ? ot.taskTitle : (ot.title || '');
  const taskStatus = row?.status || ot.responsibleDept || 'Tráfico';
  const statusBadgeCls = getStatusBadgeClass(taskStatus);

  // 1. Navegador rápido
  const navIdx = Math.max(0, navNodes.findIndex(n => n.id === ot.id));
  const navHtml = navNodes.length > 1 ? `
    <div class="flex items-center justify-between gap-1">
      <button type="button" onclick="stepEnvelopeTask(-1)" class="flex-1 py-1 px-1.5 rounded bg-white/[0.05] hover:bg-white/[0.12] border border-resolve-border text-[10px] font-semibold text-zinc-200 hover:text-white cursor-pointer transition-colors" title="Tarea anterior">↑ Anterior</button>
      <span class="px-1.5 font-mono text-[9px] text-zinc-400 shrink-0">${navIdx + 1}/${navNodes.length}</span>
      <button type="button" onclick="stepEnvelopeTask(1)" class="flex-1 py-1 px-1.5 rounded bg-white/[0.05] hover:bg-white/[0.12] border border-resolve-border text-[10px] font-semibold text-zinc-200 hover:text-white cursor-pointer transition-colors" title="Tarea siguiente">↓ Siguiente</button>
    </div>
  ` : '';

  // 5. Datos Stripboard
  const scheduledDays = getOtScheduledDays(ot.id);
  const firstMatch = scheduledDays[0]?.matched?.[0];
  const defaultSchedDate = scheduledDays[0]?.dateStr || state.currentStripboardDate || new Date().toISOString().split('T')[0];
  const defaultSlot = firstMatch?.strip?.timeSlot || '09:00 - 11:00';
  const defaultAssignee = firstMatch?.strip?.assignee || ot.sign || getActiveUserShortName() || 'Creativos';
  const schedPillsHtml = scheduledDays.length > 0
    ? `<div class="flex flex-wrap gap-1 pt-1">${scheduledDays.map(d => d.matched.map(m => `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-[9px] text-sky-300 font-mono">
          <button type="button" onclick="jumpFromModalToStripboardDate('${d.dateStr}')" title="Ir al Stripboard" class="hover:underline cursor-pointer">${d.shortLabel} • ${escapeHtml(m.strip.timeSlot || '')}</button>
          <button type="button" onclick="removeStripFromModalWitness('${d.dateStr}', ${m.idx})" title="Quitar turno" class="text-zinc-400 hover:text-red-400 inline-flex items-center justify-center cursor-pointer">${lucideIcon('x', 'w-3 h-3')}</button>
        </span>
      `).join('')).join('')}</div>`
    : `<div class="text-[10px] text-zinc-500 italic">Sin bloques en Stripboard</div>`;

  // 7. Revisor Colaborativo y Mensajes
  const mediaList = ot.mediaFiles || [];
  const reviewedMedia = mediaList.map((f, idx) => ({ f, idx })).filter(x => x.f.reviewStatus || x.f.lastReviewComment || x.f.latestComment || x.f.reviewCommentCount);
  const targetMedia = reviewedMedia[reviewedMedia.length - 1] || (mediaList.length > 0 ? { f: mediaList[mediaList.length - 1], idx: mediaList.length - 1 } : null);
  const lastMsg = targetMedia?.f?.lastReviewComment || targetMedia?.f?.latestComment || targetMedia?.f?.reviewNote || '';
  const reviewHtml = targetMedia ? `
    <div class="space-y-1.5">
      <div class="flex items-center justify-between gap-1 text-[10px]">
        <span class="text-zinc-300 font-medium truncate" title="${escapeHtml(targetMedia.f.name)}">${escapeHtml(targetMedia.f.name)}</span>
        ${getReviewStatusBadgeHtml(targetMedia.f.reviewStatus) || '<span class="text-[9px] text-zinc-500">Sin revisión</span>'}
      </div>
      ${lastMsg ? `<div class="p-1.5 rounded bg-black/40 border border-resolve-border text-[10px] text-zinc-300 italic leading-snug">"${escapeHtml(lastMsg)}"</div>` : `<div class="text-[10px] text-zinc-500 italic">Sin mensajes recientes del revisor.</div>`}
      <div class="flex items-center gap-1">
        <button type="button" onclick="openMediaReview(${targetMedia.idx}, ${otIdArg})" class="flex-1 py-1 px-2 rounded bg-[#0BA2AC]/15 hover:bg-[#0BA2AC]/25 border border-[#0BA2AC]/40 text-[#0BA2AC] text-[10px] font-semibold cursor-pointer transition-colors">Abrir Revisor</button>
        <button type="button" onclick="shareMediaItem(${targetMedia.idx}, ${otIdArg})" class="py-1 px-2 rounded bg-white/[0.05] hover:bg-white/[0.12] border border-resolve-border text-zinc-200 text-[10px] font-semibold cursor-pointer transition-colors">Compartir</button>
      </div>
    </div>
  ` : `<div class="text-[10px] text-zinc-500 italic">Esta tarea aún no tiene archivos para revisión.</div>`;

  const entryIso = toIsoDateTime(row?.entryDate || ot.entryDate || '');
  const deliveryIso = toIsoDateTime(row?.deliveryDate || ot.deliveryDate || '');
  const isOwner = state.memberRole === 'owner';

  const navIconsHtml = navNodes.length > 1 ? `
    <div class="flex items-center gap-0.5 shrink-0">
      <button type="button" onclick="stepEnvelopeTask(-1)" title="Tarea anterior" class="w-5 h-5 flex items-center justify-center rounded bg-white/[0.05] hover:bg-white/[0.12] border border-resolve-border text-zinc-300 hover:text-white cursor-pointer">
        ${lucideIcon('arrow-up', 'w-3 h-3')}
      </button>
      <button type="button" onclick="stepEnvelopeTask(1)" title="Tarea siguiente" class="w-5 h-5 flex items-center justify-center rounded bg-white/[0.05] hover:bg-white/[0.12] border border-resolve-border text-zinc-300 hover:text-white cursor-pointer">
        ${lucideIcon('arrow-down', 'w-3 h-3')}
      </button>
    </div>
  ` : '';

  const topToolbarHtml = `
    <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-white/[0.06]">
      ${navIconsHtml || '<span></span>'}
      <div class="flex items-center gap-0.5 shrink-0">
        ${row ? `
        <button type="button" onclick="toggleRouteRowLock(${index}, ${otIdArg})" title="${isLocked ? 'Desbloquear fila' : 'Bloquear fila'}" class="w-5 h-5 flex items-center justify-center rounded border cursor-pointer transition-colors ${isLocked ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' : 'bg-white/[0.04] hover:bg-white/[0.12] border-resolve-border text-zinc-300 hover:text-white'}">
          ${lucideIcon(isLocked ? 'lock' : 'lock-open', 'w-3 h-3')}
        </button>` : ''}
        <button type="button" onclick="closeInspectorTaskAsDone(${otIdArg}, ${row ? index : 'null'})" title="Cerrar tarea (Terminada / Entregada)" class="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] hover:bg-emerald-500/20 border border-resolve-border hover:border-emerald-500/40 text-emerald-300 cursor-pointer transition-colors">
          ${lucideIcon('check', 'w-3 h-3')}
        </button>
        <button type="button" onclick="cancelInspectorTask(${otIdArg})" title="Cancelar / Detener tarea" class="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] hover:bg-sky-500/20 border border-resolve-border hover:border-sky-500/40 text-sky-300 cursor-pointer transition-colors">
          ${lucideIcon('ban', 'w-3 h-3')}
        </button>
        <button type="button" onclick="duplicateInspectorTask(${otIdArg})" title="Duplicar tarea" class="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] hover:bg-white/[0.12] border border-resolve-border text-zinc-300 hover:text-white cursor-pointer transition-colors">
          ${lucideIcon('copy', 'w-3 h-3')}
        </button>
        <button type="button" onclick="deleteInspectorRowOrTask(${otIdArg}, ${row ? index : 'null'})" title="Eliminar tarea / fila" class="w-5 h-5 flex items-center justify-center rounded bg-white/[0.04] hover:bg-rose-900/60 border border-resolve-border hover:border-rose-700/60 text-rose-400 cursor-pointer transition-colors">
          ${lucideIcon('trash-2', 'w-3 h-3')}
        </button>
      </div>
    </div>
  `;

  const tabBtn = (id, label, tip) => {
    const active = activeInspectorTab === id;
    return `<button type="button" onclick="setEnvelopeInspectorTab('${id}')" title="${tip}" class="flex-1 py-1 text-[10px] font-semibold uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${active ? 'border-sky-400 text-sky-300 bg-white/[0.05]' : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03]'}">${label}</button>`;
  };

  const subTasksForOt = rootOt ? getSubOtsForRoot(rootOt.id) : [];
  const subTasksListHtml = `
    <details open class="group rounded-lg border border-resolve-border bg-resolve-panel/40 overflow-hidden">
      <summary class="px-2.5 py-1 bg-white/[0.06] border-b border-resolve-border text-[10px] uppercase tracking-wider font-bold text-zinc-200 cursor-pointer select-none flex items-center justify-between list-none">
        <span>Tareas (${subTasksForOt.length})</span>
        <div class="flex items-center gap-1">
          <button type="button" onclick="event.preventDefault(); event.stopPropagation(); createEnvelopeSubTask()" title="Nueva Sub-tarea" class="w-4 h-4 flex items-center justify-center rounded bg-white/[0.06] hover:bg-sky-500/20 border border-resolve-border text-sky-300 text-[10px] font-bold cursor-pointer">+</button>
          <span class="text-sky-400 text-[9px] transition-transform group-open:rotate-90">▶</span>
        </div>
      </summary>
      <div class="p-1.5 space-y-1 max-h-40 overflow-y-auto">
        ${subTasksForOt.length === 0
          ? `<div class="text-[10px] text-zinc-500 italic px-1 py-1">Sin tareas creadas en esta OT.</div>`
          : subTasksForOt.map(sub => {
              const isSelected = (state.activeEnvelopeTaskId || state.activeOtId) === sub.id;
              const subTitle = sub.taskTitle || sub.title || sub.medium || sub.media || 'Subtarea';
              const subSuffix = (typeof sub.id === 'string' && rootOt && sub.id.startsWith(rootOt.id + '-')) ? sub.id.slice(rootOt.id.length) : sub.id;
              const stCls = getStatusBadgeClass(sub.responsibleDept || 'Tráfico');
              return `
                <button type="button" onclick="selectEnvelopeTreeTask('${escapeHtml(sub.id)}')" class="w-full text-left px-2 py-1 rounded border flex items-center justify-between gap-1.5 cursor-pointer transition-colors ${isSelected ? 'bg-sky-500/10 border-sky-500/40 text-white' : 'bg-black/25 hover:bg-white/[0.05] border-resolve-border text-zinc-300'}">
                  <span class="flex items-center gap-1.5 min-w-0">
                    <span class="font-mono text-[9px] text-sky-300 shrink-0">${escapeHtml(subSuffix)}</span>
                    <span class="text-[11px] truncate font-medium">${escapeHtml(subTitle)}</span>
                  </span>
                  <span class="px-1 py-0.2 rounded border text-[8px] font-semibold shrink-0 ${stCls}">${escapeHtml(sub.responsibleDept || 'Tráfico')}</span>
                </button>
              `;
            }).join('')}
      </div>
    </details>
  `;

  let tabBodyHtml = '';
  if (activeInspectorTab === 'task') {
    tabBodyHtml = `
      ${subTasksListHtml}
      <details open class="group rounded-lg border border-resolve-border bg-resolve-panel/40 overflow-hidden">
        <summary class="px-2.5 py-1 bg-white/[0.06] border-b border-resolve-border text-[10px] uppercase tracking-wider font-bold text-zinc-200 cursor-pointer select-none flex items-center justify-between list-none">
          <span>Estado</span>
          <span class="text-sky-400 text-[9px] transition-transform group-open:rotate-90">▶</span>
        </summary>
        <div class="p-2 space-y-1.5">
          ${rootOt ? `
          <div>
            <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">OT Master (${escapeHtml(rootOt.id)})</label>
            <select onchange="handleRootStatusChange(this.value)" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[11px] text-sky-300 font-medium focus:border-sky-500 focus:outline-none cursor-pointer">
              ${getStatusOptionsHtml(rootOt.responsibleDept || 'Tráfico')}
            </select>
          </div>` : ''}
          <div>
            <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">Esta Tarea (${escapeHtml(ot.id)})</label>
            <select ${lockAttr} onchange="${row ? `handleRouteStatusChange(${index}, this.value, ${otIdArg})` : `syncOtStatusAndRoute(${otIdArg}, this.value, { syncLatestRouteStatus: true }); renderEnvelopeTaskTree(); renderEnvelopeInspector(); refreshAllViews();`}" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[11px] text-sky-300 font-medium focus:border-sky-500 focus:outline-none ${isLocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}">
              ${getStatusOptionsHtml(taskStatus)}
            </select>
          </div>
        </div>
      </details>

      <details open class="group rounded-lg border border-resolve-border bg-resolve-panel/40 overflow-hidden">
        <summary class="px-2.5 py-1 bg-white/[0.06] border-b border-resolve-border text-[10px] uppercase tracking-wider font-bold text-zinc-200 cursor-pointer select-none flex items-center justify-between list-none">
          <span>Fechas</span>
          <span class="text-sky-400 text-[9px] transition-transform group-open:rotate-90">▶</span>
        </summary>
        <div class="p-2 space-y-1.5">
          <div>
            <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">Entrada</label>
            <input type="datetime-local" ${lockAttr} value="${entryIso}" onchange="${row ? `updateRouteDateCell(${index}, 'entryDate', this.value, ${otIdArg})` : `updateActiveOtDateField('entryDate', this.value)`}" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[10px] font-mono text-zinc-200 focus:border-sky-500 focus:outline-none ${isLocked ? 'opacity-60 cursor-not-allowed' : ''}" />
          </div>
          <div>
            <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">Entrega</label>
            <input type="datetime-local" ${isDeliveryLocked ? 'disabled' : ''} value="${deliveryIso}" onchange="${row ? `updateRouteDateCell(${index}, 'deliveryDate', this.value, ${otIdArg})` : `updateActiveOtDateField('deliveryDate', this.value)`}" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[10px] font-mono text-sky-300 focus:border-sky-500 focus:outline-none ${isDeliveryLocked ? 'opacity-60 cursor-not-allowed' : ''}" />
          </div>
        </div>
      </details>

      <details open class="group rounded-lg border border-resolve-border bg-resolve-panel/40 overflow-hidden">
        <summary class="px-2.5 py-1 bg-white/[0.06] border-b border-resolve-border text-[10px] uppercase tracking-wider font-bold text-zinc-200 cursor-pointer select-none flex items-center justify-between list-none">
          <span>Descripción</span>
          <span class="text-sky-400 text-[9px] transition-transform group-open:rotate-90">▶</span>
        </summary>
        <div class="p-2">
          ${row ? `
          <textarea
            id="inspector-route-task"
            rows="6"
            ${lockAttr}
            oninput="updateRouteCellFromInspector(${index}, 'task', this.value, ${otIdArg})"
            onchange="updateRouteCellFromInspector(${index}, 'task', this.value, ${otIdArg})"
            placeholder="Escribe la descripción o instrucción completa..."
            class="w-full bg-black/40 border border-resolve-border rounded-md p-2 text-[11px] font-sans text-zinc-100 leading-relaxed focus:border-sky-500 focus:outline-none resize-y ${isLocked ? 'opacity-65 cursor-not-allowed' : ''}"
          >${escapeHtml(row.task || '')}</textarea>
          ` : `<button type="button" onclick="addNewRouteRow()" title="Agregar movimiento" class="w-full py-1 px-2 rounded bg-white/[0.05] hover:bg-sky-500/20 border border-resolve-border text-sky-300 text-[10px] font-semibold cursor-pointer">+ Movimiento</button>`}
        </div>
      </details>

      <details open class="group rounded-lg border border-resolve-border bg-resolve-panel/40 overflow-hidden">
        <summary class="px-2.5 py-1 bg-white/[0.06] border-b border-resolve-border text-[10px] uppercase tracking-wider font-bold text-zinc-200 cursor-pointer select-none flex items-center justify-between list-none">
          <span>Notas</span>
          <span class="text-sky-400 text-[9px] transition-transform group-open:rotate-90">▶</span>
        </summary>
        <div class="p-2">
          ${row ? `
          <textarea
            id="inspector-route-notes"
            rows="6"
            ${lockAttr}
            oninput="updateRouteCellFromInspector(${index}, 'notes', this.value, ${otIdArg})"
            onchange="updateRouteCellFromInspector(${index}, 'notes', this.value, ${otIdArg})"
            placeholder="Escribe notas completas, observaciones o acuerdos..."
            class="w-full bg-black/40 border border-resolve-border rounded-md p-2 text-[11px] font-sans text-zinc-200 leading-relaxed focus:border-sky-500 focus:outline-none resize-y ${isLocked ? 'opacity-65 cursor-not-allowed' : ''}"
          >${escapeHtml(row.notes || '')}</textarea>
          ` : `<div class="text-[10px] text-zinc-500 italic">Agrega un movimiento para registrar notas.</div>`}
        </div>
      </details>
    `;
  } else if (activeInspectorTab === 'schedule') {
    tabBodyHtml = `
      <div class="rounded-lg border border-resolve-border bg-resolve-panel/40 p-2.5 space-y-2">
        <div>
          <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">Fecha Programación</label>
          <input type="date" id="inspector-sched-date" value="${escapeHtml(defaultSchedDate)}" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[10px] font-mono text-zinc-200 focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">Bloque de horas</label>
          <input type="text" id="inspector-sched-timeslot" value="${escapeHtml(defaultSlot)}" placeholder="09:00 - 11:00" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[10px] font-mono text-sky-300 focus:border-sky-500 focus:outline-none" />
        </div>
        <div>
          <label class="block text-[9px] uppercase text-zinc-400 font-semibold mb-0.5">Responsable</label>
          <select id="inspector-sched-assignee" class="w-full bg-black/50 border border-resolve-border rounded px-1.5 py-1 text-[11px] text-zinc-200 focus:border-sky-500 focus:outline-none cursor-pointer">
            ${getResponsibleOptionsHtml(defaultAssignee)}
          </select>
        </div>
        <div class="flex items-center justify-between pt-1">
          <span class="text-[10px] text-zinc-400">Sincronizar Agenda</span>
          <button type="button" onclick="syncInspectorTaskToStripboard(${otIdArg})" title="Sincronizar con Agenda" class="w-6 h-6 flex items-center justify-center rounded bg-sky-500/15 hover:bg-sky-500/30 border border-sky-500/40 text-sky-300 cursor-pointer transition-colors">
            ${lucideIcon('refresh-cw', 'w-[15px] h-[15px]')}
          </button>
        </div>
        ${schedPillsHtml}
      </div>
    `;
  } else {
    tabBodyHtml = `
      <div class="rounded-lg border border-resolve-border bg-resolve-panel/40 p-2.5 space-y-2">
        ${reviewHtml}
      </div>
    `;
  }

  body.innerHTML = `
    <div class="p-2 rounded-lg bg-resolve-panel/80 border border-resolve-border space-y-1.5">
      ${topToolbarHtml}
      <div class="flex items-center justify-between gap-1.5">
        <span class="font-mono font-bold text-[10px] text-sky-300 truncate">${escapeHtml(ot.id)}</span>
        <span class="font-mono text-[9px] text-zinc-400 shrink-0">${navNodes.length > 1 ? `${navIdx + 1}/${navNodes.length}` : ''}${row ? ` • #${index + 1}` : ''}</span>
      </div>
      ${taskTitle ? `<div class="text-[13px] font-semibold text-white truncate" title="${escapeHtml(taskTitle)}">${escapeHtml(taskTitle)}</div>` : ''}
    </div>

    <div class="flex border border-resolve-border rounded-lg overflow-hidden bg-black/30">
      ${tabBtn('task', 'Tareas', 'Tareas de la OT, Estado, Fechas, Descripción y Notas')}
      ${tabBtn('schedule', 'Agenda', 'Programación en Stripboard')}
      ${tabBtn('review', 'Revisor', 'Revisor Colaborativo y Mensajes')}
    </div>

    <div class="space-y-2">
      ${tabBodyHtml}
    </div>
  `;
}

export function updateRouteCell(index, field, value, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot || !ot.routes[index]) return;

  ot.routes[index][field] = value;
  saveOrders(orders);
  if (typeof document !== 'undefined' && activeInspectorRow.otId === otId && activeInspectorRow.index === index) {
    if (field === 'task') {
      const inspTask = document.getElementById('inspector-route-task');
      if (inspTask && inspTask.value !== value) inspTask.value = value;
    } else if (field === 'notes') {
      const inspNotes = document.getElementById('inspector-route-notes');
      if (inspNotes && inspNotes.value !== value) inspNotes.value = value;
    }
  }
  refreshAllViews();
}

export function updateRouteDateCell(index, field, isoValue, targetOtId = state.activeOtId) {
  const displayVal = fromIsoToDisplay(isoValue);
  updateRouteCell(index, field, displayVal, targetOtId);
}

function isActiveOrLatestRoute(ot, index) {
  if (!ot || !Array.isArray(ot.routes) || ot.routes.length === 0) return false;
  const activeRoute = getActiveRoute(ot);
  return ot.routes[index] === activeRoute || index === ot.routes.length - 1;
}

function syncHeaderStatusSelect(statusName) {
  if (typeof document === 'undefined') return;
  const sel = document.getElementById('modal-ot-status');
  if (sel) {
    sel.innerHTML = getStatusOptionsHtml(statusName);
    sel.value = statusName;
  }
}

export function handleRouteDeptChange(index, field, val, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;

  if (val === '__NEW_DEPT__') {
    const newName = typeof window !== 'undefined' ? window.prompt("Nombre del nuevo departamento / área:") : null;
    if (newName && newName.trim()) {
      const clean = addDepartment(newName.trim());
      updateDeptOptionsDatalist();
      updateRouteCell(index, field, clean, otId);
      const ot = getOrders().find(o => o.id === otId);
      if (ot) renderRouteSheetRows(ot.routes);
    } else {
      const ot = getOrders().find(o => o.id === otId);
      if (ot) renderRouteSheetRows(ot.routes);
    }
    return;
  }

  updateRouteCell(index, field, val, otId);
}

export function handleRouteStatusChange(index, val, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;

  let resolvedStatus = val;
  if (val === '__NEW__') {
    const newName = typeof window !== 'undefined' ? window.prompt("Nombre del nuevo estado personalizado:") : null;
    if (newName && newName.trim()) {
      const clean = newName.trim();
      const statuses = getStatuses();
      let existing = statuses.find(s => s.name.toLowerCase() === clean.toLowerCase());
      if (!existing) {
        existing = { id: 'st-' + Date.now(), name: clean, color: 'stone' };
        statuses.push(existing);
        saveStatuses(statuses);
      }
      resolvedStatus = existing.name;
    } else {
      const ot = getOrders().find(o => o.id === otId);
      if (ot) renderRouteSheetRows(ot.routes);
      return;
    }
  }

  updateRouteCell(index, 'status', resolvedStatus, otId);
  const ot = getOrders().find(o => o.id === otId);
  if (ot && isActiveOrLatestRoute(ot, index)) {
    syncOtStatusAndRoute(otId, resolvedStatus, { syncLatestRouteStatus: true });
    if (ot.id === state.activeEnvelopeRootId) {
      syncHeaderStatusSelect(resolvedStatus);
    }
    renderEnvelopeTaskTree();
    renderRouteSheetRows(ot.routes || []);
    refreshAllViews();
    return;
  }
  if (val === '__NEW__' && ot) {
    renderRouteSheetRows(ot.routes);
  }
}

export function handleRouteSignChange(index, val, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;

  const activeShort = (getActiveUserShortName() || 'Usuario').trim();
  const resolvedVal = String(val || '').trim();
  if (resolvedVal && resolvedVal !== activeShort) {
    const ot = getOrders().find(o => o.id === otId);
    if (ot) renderRouteSheetRows(ot.routes);
    return;
  }

  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot || !ot.routes?.[index]) return;

  ot.routes[index].sign = resolvedVal;
  if (resolvedVal) {
    ot.routes[index].locked = true;
    if (isActiveOrLatestRoute(ot, index)) {
      ot.sign = resolvedVal;
      if (typeof document !== 'undefined' && ot.id === state.activeEnvelopeRootId) {
        const respSel = document.getElementById('modal-ot-responsible');
        if (respSel) {
          respSel.innerHTML = getResponsibleOptionsHtml(resolvedVal);
          respSel.value = resolvedVal;
        }
      }
    }
  } else {
    ot.routes[index].locked = false;
  }

  saveOrders(orders);
  renderEnvelopeTaskTree();
  renderRouteSheetRows(ot.routes || []);
  renderEnvelopeInspector();
  refreshAllViews();
}

export function stampCurrentTime(index, field, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  updateRouteCell(index, field, getNowFormatted(), otId);
  const ot = getOrders().find(o => o.id === otId);
  if (ot) renderRouteSheetRows(ot.routes);
}

export function toggleRouteRowLock(index, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot || !ot.routes[index]) return;

  const lockState = getRouteRowLockState(ot, ot.routes[index], index);
  if (!lockState.canToggle) return;

  if (ot.routes[index].locked) {
    ot.routes[index].locked = false;
    ot.routes[index].sign = '';
  } else {
    if (!String(ot.routes[index].sign || '').trim()) {
      if (typeof window !== 'undefined') window.alert('Selecciona tu firma en la columna Firma para cerrar el candado.');
      return;
    }
    ot.routes[index].locked = true;
  }
  saveOrders(orders);
  renderRouteSheetRows(ot.routes);
  renderEnvelopeInspector();
  refreshAllViews();
}

export function toggleRouteDone(index, targetOtId = state.activeOtId) {
  toggleRouteRowLock(index, targetOtId);
}

export function removeRouteRow(index, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot || !ot.routes[index]) return;
  if (getRouteRowLockState(ot, ot.routes[index], index).isLocked) return;

  ot.routes.splice(index, 1);
  saveOrders(orders);
  if (activeInspectorRow.otId === otId && activeInspectorRow.index >= ot.routes.length) {
    activeInspectorRow.index = Math.max(0, ot.routes.length - 1);
  }
  renderRouteSheetRows(ot.routes);
  renderEnvelopeInspector();
  refreshAllViews();
}

export function deleteRouteRow(index, targetOtId = state.activeOtId) {
  removeRouteRow(index, targetOtId);
}

// Control del Modal de Firmas de Tinta Retro
export function openStampModal(index) {
  stampingRowIndex = index;
  const modal = document.getElementById('stamp-modal');
  if (modal) modal.classList.remove('hidden');
}

export function closeStampModal() {
  const modal = document.getElementById('stamp-modal');
  if (modal) modal.classList.add('hidden');
  stampingRowIndex = null;
}

export function applyStamp(stampText) {
  if (stampingRowIndex === null || !state.activeOtId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === state.activeOtId);
  if (!ot || !ot.routes[stampingRowIndex]) return;

  ot.routes[stampingRowIndex].stamp = stampText;
  saveOrders(orders);

  if (isActiveOrLatestRoute(ot, stampingRowIndex)) {
    const statuses = getStatuses();
    let mappedStatus = null;
    if (stampText === 'APROBADO') {
      mappedStatus = statuses.find(s => /aprob/i.test(s.name))?.name || 'Aprobación';
    } else if (stampText === 'AJUSTES') {
      mappedStatus = statuses.find(s => /ajuste|correcc|revisi/i.test(s.name))?.name || 'Ajustes';
    } else if (stampText === 'ENTREGADO') {
      mappedStatus = statuses.find(s => /entreg/i.test(s.name))?.name || 'Entregado';
    }
    if (mappedStatus) {
      syncOtStatusAndRoute(state.activeOtId, mappedStatus, { syncLatestRouteTo: true });
      syncHeaderStatusSelect(mappedStatus);
    }
  }

  renderRouteSheetRows(ot.routes);
  refreshAllViews();
  closeStampModal();
}

export function clearCurrentStamp() {
  if (stampingRowIndex === null || !state.activeOtId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === state.activeOtId);
  if (!ot || !ot.routes[stampingRowIndex]) return;

  ot.routes[stampingRowIndex].stamp = null;
  saveOrders(orders);
  renderRouteSheetRows(ot.routes);
  closeStampModal();
}

// ============================================================================
// 3. MEDIA POOL Y MOTOR MULTIMEDIA FULLSCREEN
// ============================================================================

export function setMediaPoolView(mode) {
  mediaPoolViewMode = mode;
  if (typeof document === 'undefined') return;

  const btnGrid = document.getElementById('btn-view-grid');
  const btnList = document.getElementById('btn-view-list');

  if (mode === 'grid') {
    if (btnGrid) {
      btnGrid.classList.add('bg-resolve-panel', 'text-white');
      btnGrid.classList.remove('text-resolve-dimText');
    }
    if (btnList) {
      btnList.classList.remove('bg-resolve-panel', 'text-white');
      btnList.classList.add('text-resolve-dimText');
    }
  } else {
    if (btnList) {
      btnList.classList.add('bg-resolve-panel', 'text-white');
      btnList.classList.remove('text-resolve-dimText');
    }
    if (btnGrid) {
      btnGrid.classList.remove('bg-resolve-panel', 'text-white');
      btnGrid.classList.add('text-resolve-dimText');
    }
  }

  const ot = getOrders().find(o => o.id === state.activeOtId);
  if (ot) renderMediaPool(ot.mediaFiles || []);
}

let inlineEnvelopeViewMode = (typeof localStorage !== 'undefined' && localStorage.getItem('trafigator_inline_media_view') === 'grid') ? 'grid' : 'list';

function updateInlineViewToggleButtons() {
  if (typeof document === 'undefined') return;
  const btnGrid = document.getElementById('btn-inline-view-grid');
  const btnList = document.getElementById('btn-inline-view-list');
  const isGrid = inlineEnvelopeViewMode === 'grid';
  if (btnGrid) {
    btnGrid.classList.toggle('bg-resolve-panel', isGrid);
    btnGrid.classList.toggle('text-white', isGrid);
    btnGrid.classList.toggle('text-resolve-dimText', !isGrid);
  }
  if (btnList) {
    btnList.classList.toggle('bg-resolve-panel', !isGrid);
    btnList.classList.toggle('text-white', !isGrid);
    btnList.classList.toggle('text-resolve-dimText', isGrid);
  }
}

export function setInlineEnvelopeMediaView(mode) {
  inlineEnvelopeViewMode = mode === 'grid' ? 'grid' : 'list';
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('trafigator_inline_media_view', inlineEnvelopeViewMode);
    }
  } catch {}
  updateInlineViewToggleButtons();
  const ot = getOrders().find(o => o.id === state.activeOtId);
  if (ot) renderInlineEnvelopeMedia(ot.mediaFiles || []);
}

export function badgeStyle(color) {
  return 'background-color:' + color + '22;color:' + color + ';border:1px solid ' + color + '66;';
}

export function getFileExt(file) {
  const name = (file && file.name) ? file.name : '';
  if (file && file.ext) return String(file.ext).toLowerCase();
  return name.includes('.') ? name.split('.').pop().toLowerCase() : '';
}

export function getMediaMeta(file) {
  const ext = getFileExt(file);
  const t = (file && file.type) ? String(file.type).toLowerCase() : '';
  const mk = (type, badge, sub, color, extra) => Object.assign({
    type, ext, badge, subLabel: sub, color,
    badgeStyle: badgeStyle(color), isSuite: false, fullLabel: sub
  }, extra || {});

  if (ext === 'svg') return mk('image', 'SVG', 'Imagen vectorial', '#d97706');
  if (['jpg','jpeg','png','gif','webp','bmp','ico','avif'].includes(ext) || t === 'image') return mk('image', (ext || 'IMG').toUpperCase(), 'Imagen', '#d97706');
  if (['mp4','webm','mov','ogg','m4v','avi','mkv'].includes(ext) || t === 'video') return mk('video', (ext || 'VID').toUpperCase(), 'Video', '#a855f7');
  if (ext === 'pdf' || t === 'pdf') return mk('pdf', 'PDF', 'Documento PDF', '#ef4444');
  if (['md','markdown'].includes(ext) || t === 'markdown') return mk('markdown', 'MD', 'Markdown', '#38bdf8');
  if (['ttf','otf','woff','woff2'].includes(ext) || t === 'font') return mk('font', (ext || 'FONT').toUpperCase(), 'Tipografía ' + (ext || '').toUpperCase(), '#8b5cf6');
  if (CODE_EXTS.includes(ext) || t === 'code') return mk('code', (ext || 'CODE').toUpperCase(), 'Código ' + (ext || '').toUpperCase(), '#10b981');
  const s = SUITE_DEFS[ext];
  if (s) return mk(s.type, s.badge, s.sub, s.color, { isSuite: true, suiteBrand: s.brand });
  return mk(t || 'document', (ext || 'DOC').toUpperCase().substring(0, 5), t === 'link' ? 'Enlace web' : 'Archivo', '#a8a29e');
}

export function formatMarkdown(raw) {
  if (!raw) return '<p class="text-stone-400 italic">Documento vacío.</p>';
  let s = String(raw).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/```([a-zA-Z0-9_-]*)\r?\n([\s\S]*?)```/g, (m, lang, code) =>
    '<pre class="my-2 p-2.5 bg-black/80 border border-resolve-border rounded font-mono text-[11px] text-emerald-400 overflow-x-auto"><code>' + code.trim() + '</code></pre>');
  s = s.replace(/^### (.*$)/gim, '<h3 class="text-xs font-bold text-sky-400 uppercase mt-3 mb-1">$1</h3>');
  s = s.replace(/^## (.*$)/gim, '<h2 class="text-sm font-bold text-white mt-4 mb-2 border-b border-resolve-border pb-1">$1</h2>');
  s = s.replace(/^# (.*$)/gim, '<h1 class="text-base font-bold text-sky-400 mt-4 mb-2 border-b border-sky-500/40 pb-1">$1</h1>');
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
  s = s.replace(/\*(.*?)\*/g, '<em class="text-sky-200/90">$1</em>');
  s = s.replace(/`([^`]+)`/g, '<code class="bg-resolve-card text-sky-300 px-1 rounded text-[10px] font-mono">$1</code>');
  s = s.replace(/^&gt; (.*$)/gim, '<blockquote class="border-l-2 border-sky-500 pl-3 my-2 text-stone-300 italic">$1</blockquote>');
  s = s.replace(/^---$/gim, '<hr class="border-resolve-border my-3">');
  s = s.replace(/^\s*[-*]\s+(.*$)/gim, '<li class="ml-4 list-disc text-stone-300">$1</li>');
  s = s.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal text-stone-300">$1</li>');
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:underline">$1</a>');
  s = s.replace(/\n{2,}/g, '</p><p class="my-2 text-stone-300 text-xs leading-relaxed">');
  return '<p class="my-2 text-stone-300 text-xs leading-relaxed">' + s + '</p>';
}

export function fontSafeId(file) {
  return 'font-' + String((file && file.id) || 'f').replace(/[^a-zA-Z0-9_-]/g, '');
}

export function ensureFontLoaded(file) {
  if (typeof document === 'undefined') return;
  if (!file || !file.url) return;
  const id = fontSafeId(file);
  if (document.getElementById(id)) return;
  const st = document.createElement('style');
  st.id = id;
  st.textContent = '@font-face{font-family:"' + id + '";src:url("' + file.url + '");font-display:swap;}' +
                   '.specimen-' + id + '{font-family:"' + id + '",sans-serif !important;}';
  document.head.appendChild(st);
}

export function copyMediaCodeText(text, btn) {
  if (!text) return;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      if (!btn) return;
      const orig = btn.innerHTML;
      btn.innerHTML = '<span class="text-emerald-400 font-bold">Copiado</span>';
      setTimeout(() => { btn.innerHTML = orig; }, 1500);
    }).catch(() => {});
  }
}

function getReviewStatusBadgeHtml(status) {
  if (status === 'in_review') {
    return '<span class="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-[#0BA2AC]/40 bg-[#0BA2AC]/15 text-[#0BA2AC]">En Revisión</span>';
  }
  if (status === 'changes_requested') {
    return '<span class="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-sky-500/40 bg-sky-500/15 text-sky-300">Ajustes</span>';
  }
  if (status === 'approved') {
    return '<span class="shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-300">Aprobado</span>';
  }
  return '';
}

function isEnvelopeMasterViewActive() {
  const activeTaskId = state.activeEnvelopeTaskId || state.activeOtId;
  const rootId = state.activeEnvelopeRootId;
  return Boolean(rootId && activeTaskId === rootId && getSubOtsForRoot(rootId).length > 0);
}

function getEnvelopeVisibleMediaEntries() {
  const activeTaskId = state.activeEnvelopeTaskId || state.activeOtId;
  if (!activeTaskId) return [];
  if (isEnvelopeMasterViewActive()) {
    const rootOt = getOrderById(state.activeEnvelopeRootId);
    const nodes = [rootOt, ...getSubOtsForRoot(state.activeEnvelopeRootId)].filter(Boolean);
    const entries = [];
    nodes.forEach((node, nodeIdx) => {
      const files = node.mediaFiles || [];
      files.forEach((file, ownerIndex) => {
        entries.push({
          file,
          ownerOt: node,
          ownerOtId: node.id,
          ownerIndex,
          isSubOt: nodeIdx > 0
        });
      });
    });
    return entries;
  }
  const ot = getOrderById(activeTaskId);
  if (!ot || !ot.mediaFiles) return [];
  return ot.mediaFiles.map((file, ownerIndex) => ({
    file,
    ownerOt: ot,
    ownerOtId: ot.id,
    ownerIndex,
    isSubOt: Boolean(ot.parentOtId)
  }));
}

export function renderMediaPool() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('media-pool-container');
  const entries = getEnvelopeVisibleMediaEntries();
  const isMaster = isEnvelopeMasterViewActive();
  const badge = document.getElementById('tab-badge-files');
  if (badge) badge.innerText = entries.length;
  if (!container) return;

  if (entries.length === 0) {
    container.innerHTML = '<div class="p-8 text-center border border-resolve-border rounded-xl bg-white/[0.02] text-xs text-resolve-dimText font-medium">El Media Pool de esta OT está vacío. Arrastra archivos arriba para cargarlos.</div>';
    return;
  }

  if (mediaPoolViewMode === 'grid') {
    container.innerHTML = '<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">' + entries.map((entry) => {
      const { file, ownerOtId, ownerIndex, isSubOt } = entry;
      const otArg = `'${escapeHtml(ownerOtId)}'`;
      const meta = getMediaMeta(file);
      const nextVersion = (file.versionNumber || 1) + 1;
      const reviewBadge = getReviewStatusBadgeHtml(file.reviewStatus);
      const ownerBadge = isMaster
        ? `<span class="shrink-0 font-mono text-[8px] px-1 py-0.2 rounded ${isSubOt ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'}">${escapeHtml(ownerOtId)}</span>`
        : '';
      const thumb = (meta.type === 'image' && file.url && file.url !== '#')
        ? `<img src="${file.url}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover">`
        : `<div class="flex flex-col items-center text-center p-2"><span class="px-2 py-0.5 rounded-lg font-semibold text-xs" style="${meta.badgeStyle}">${meta.badge}</span><span class="text-[9px] text-resolve-dimText mt-1.5 uppercase font-semibold">${escapeHtml(meta.subLabel)}</span></div>`;
      return `
        <div class="bg-white/[0.03] hover:bg-white/[0.06] border border-resolve-border hover:border-sky-400/50 rounded-xl p-2.5 flex flex-col justify-between group transition-all">
          <div class="h-24 bg-black/40 rounded-lg border border-resolve-border/60 flex items-center justify-center overflow-hidden mb-2 relative">
            ${thumb}
            <button onclick="removeMediaItem(${ownerIndex}, ${otArg})" title="Eliminar del Media Pool" class="absolute top-1 right-1 p-1 bg-black/70 hover:bg-rose-900 text-white rounded inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">${lucideIcon('x', 'w-3 h-3')}</button>
          </div>
          <div class="text-[11px]">
            <div class="font-semibold text-white truncate flex items-center gap-1.5" title="${escapeHtml(file.name)}">
              <span class="truncate">${escapeHtml(file.name)}</span>
              ${file.versionNumber ? `<span class="shrink-0 font-mono text-[9px] px-1 py-0.2 rounded bg-white/[0.08] text-zinc-300">v${file.versionNumber}</span>` : ''}
            </div>
            <div class="text-resolve-dimText text-[10px] flex justify-between items-center mt-1 gap-1">
              <span class="flex items-center gap-1 min-w-0">${ownerBadge}<span>${file.size || 'Web'}</span></span>
              ${reviewBadge || `<span>${file.date ? file.date.split(' ')[0] : ''}</span>`}
            </div>
            <div class="mt-2 flex items-center gap-1">
              ${file.url && file.url !== '#' ? `<a href="${file.url}" target="_blank" download="${escapeHtml(file.name)}" class="flex-1 text-center py-1 bg-white/[0.05] hover:bg-white/[0.10] text-sky-300 font-semibold text-[10px] rounded-lg border border-resolve-border transition-all">Descargar</a>` : ''}
              <button type="button" onclick="openMediaReview(${ownerIndex}, ${otArg})" title="Abrir visor de revisión colaborativa" class="px-2 py-1 bg-[#0BA2AC]/15 hover:bg-[#0BA2AC]/25 text-[#0BA2AC] font-semibold text-[10px] rounded-lg border border-[#0BA2AC]/40 transition-all cursor-pointer">Revisar</button>
              <button type="button" onclick="shareMediaItem(${ownerIndex}, ${otArg})" title="Compartir enlace de revisión" class="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 font-semibold text-[10px] rounded-lg border border-resolve-border transition-all cursor-pointer">Compartir</button>
              <button type="button" onclick="promptUploadMediaVersion(${ownerIndex}, ${otArg})" title="Subir nueva versión (v${nextVersion})" class="px-1.5 py-1 bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 font-mono font-semibold text-[10px] rounded-lg border border-resolve-border transition-all cursor-pointer">v${nextVersion}</button>
            </div>
          </div>
        </div>`;
    }).join('') + '</div>';
  } else {
    container.innerHTML = `
      <div class="border border-resolve-border rounded-xl overflow-hidden bg-resolve-surface">
        <table class="w-full text-left text-xs border-collapse">
          <thead><tr class="bg-resolve-panel/90 border-b border-resolve-border text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
            <th class="p-2">NOMBRE DEL ARCHIVO</th><th class="p-2 w-32">TIPO</th><th class="p-2 w-24">TAMAÑO</th><th class="p-2 w-36">FECHA SUBIDA</th><th class="p-2 w-36 text-center">ACCIONES</th>
          </tr></thead>
          <tbody class="divide-y divide-resolve-border bg-resolve-bg text-stone-200">
            ${entries.map((entry, idx) => {
              const { file, ownerOtId, ownerIndex, isSubOt } = entry;
              const otArg = `'${escapeHtml(ownerOtId)}'`;
              const meta = getMediaMeta(file);
              const nextVersion = (file.versionNumber || 1) + 1;
              const reviewBadge = getReviewStatusBadgeHtml(file.reviewStatus);
              const ownerBadge = isMaster
                ? `<span class="shrink-0 font-mono text-[9px] px-1 rounded ${isSubOt ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'}">${escapeHtml(ownerOtId)}</span>`
                : '';
              const isOdd = (idx % 2 === 1);
              const zebraClass = isOdd ? 'bg-white/[0.025]' : 'bg-transparent';
              return `<tr class="${zebraClass} hover:bg-white/[0.08] transition-colors">
                <td class="p-2 font-bold text-white flex items-center gap-2"><span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="${meta.badgeStyle}">${meta.badge}</span>${ownerBadge}<span class="truncate">${escapeHtml(file.name)}</span>${file.versionNumber ? `<span class="shrink-0 font-mono text-[9px] px-1 rounded bg-white/[0.08] text-zinc-300">v${file.versionNumber}</span>` : ''}${reviewBadge}</td>
                <td class="p-2 text-resolve-dimText uppercase text-[10px]">${escapeHtml(meta.subLabel)}</td>
                <td class="p-2 text-resolve-dimText">${file.size || 'N/A'}</td>
                <td class="p-2 text-resolve-dimText">${file.date || '--'}</td>
                <td class="p-2 text-center"><div class="flex items-center justify-center gap-2">
                  ${file.url && file.url !== '#' ? `<a href="${file.url}" target="_blank" download="${escapeHtml(file.name)}" class="text-resolve-accent hover:underline text-[11px]">Abrir</a>` : ''}
                  <button type="button" onclick="openMediaReview(${ownerIndex}, ${otArg})" title="Abrir visor de revisión colaborativa" class="text-[#0BA2AC] hover:underline text-[11px] font-semibold cursor-pointer">Revisar</button>
                  <button type="button" onclick="shareMediaItem(${ownerIndex}, ${otArg})" title="Compartir enlace de revisión" class="text-zinc-200 hover:underline text-[11px] font-semibold cursor-pointer">Compartir</button>
                  <button type="button" onclick="promptUploadMediaVersion(${ownerIndex}, ${otArg})" title="Subir nueva versión (v${nextVersion})" class="text-zinc-300 hover:text-white text-[10px] font-mono cursor-pointer">v${nextVersion}</button>
                  <button onclick="removeMediaItem(${ownerIndex}, ${otArg})" class="text-resolve-dimText hover:text-red-400 inline-flex items-center justify-center">${lucideIcon('x', 'w-3 h-3')}</button>
                </div></td></tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }
}

export async function handleMediaPoolUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0 || !state.activeOtId) return;

  const uploaded = await uploadOtFiles(state.activeOtId, files);
  const ot = getOrderById(state.activeOtId);
  if (ot) {
    if (!ot.mediaFiles) ot.mediaFiles = [];
    renderMediaPool();
    if (uploaded.length > 0) {
      const entries = getEnvelopeVisibleMediaEntries();
      state.selectedMediaIndex = Math.max(0, entries.length - 1);
      renderInlineEnvelopeMedia();
    }
  }

  if (e.target && 'value' in e.target) e.target.value = '';
}

async function resolveReviewUrlForMedia(idx, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return null;
  const ot = getOrderById(otId);
  const file = ot?.mediaFiles?.[idx];
  if (!file) return null;

  const res = await shareMediaForReview(ot.id, file.id);
  if (!res?.url) return null;
  const fullUrl = window.location.origin + res.url;
  renderMediaPool();
  renderInlineEnvelopeMedia();
  return { fullUrl, ot, file };
}

export async function openMediaReview(idx, targetOtId = state.activeOtId) {
  try {
    const resolved = await resolveReviewUrlForMedia(idx, targetOtId);
    if (!resolved?.fullUrl) return;
    if (typeof window !== 'undefined') {
      window.open(resolved.fullUrl, '_blank', 'noopener');
    }
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.alert(err?.message || 'Error abriendo visor de revisión.');
    }
  }
}

export async function shareMediaItem(idx, targetOtId = state.activeOtId) {
  try {
    const resolved = await resolveReviewUrlForMedia(idx, targetOtId);
    if (!resolved?.fullUrl) return;
    openShareReviewPopover(resolved.fullUrl, resolved.ot, resolved.file);
  } catch (err) {
    if (typeof window !== 'undefined') {
      window.alert(err?.message || 'Error generando enlace de revisión.');
    }
  }
}

let sharePopoverEscHandler = null;

export function openShareReviewPopover(reviewUrl, ot, mediaItem) {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('share-review-popover');
  if (!modal) return;

  const otId = ot?.id || '';
  const ref = ot?.reference ? ` (${ot.reference})` : '';
  const fileName = mediaItem?.name || 'Pieza';
  const msg = `Hola, te comparto la pieza "${fileName}" de la orden ${otId}${ref} para tu revisión y aprobación:\n${reviewUrl}`;
  const subject = `Revisión ${otId}${ref} — ${fileName}`;

  const subtitleEl = document.getElementById('share-review-subtitle');
  const urlInput = document.getElementById('share-review-url-input');
  const copyBtn = document.getElementById('share-review-copy-btn');
  const waBtn = document.getElementById('share-review-whatsapp-btn');
  const emailBtn = document.getElementById('share-review-email-btn');
  const smsBtn = document.getElementById('share-review-sms-btn');
  const nativeBtn = document.getElementById('share-review-native-btn');
  const openBtn = document.getElementById('share-review-open-btn');

  if (subtitleEl) subtitleEl.innerText = `${otId}${ref} • ${fileName}`;
  if (urlInput) urlInput.value = reviewUrl;
  if (waBtn) waBtn.href = `https://wa.me/?text=${encodeURIComponent(msg)}`;
  if (emailBtn) emailBtn.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(msg)}`;
  if (smsBtn) smsBtn.href = `sms:?&body=${encodeURIComponent(msg)}`;
  if (openBtn) openBtn.href = reviewUrl;

  if (copyBtn) {
    copyBtn.innerText = 'Copiar';
    copyBtn.onclick = async () => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(reviewUrl);
        } else if (urlInput) {
          urlInput.select();
          document.execCommand('copy');
        }
        copyBtn.innerText = '✓ Copiado';
        setTimeout(() => { copyBtn.innerText = 'Copiar'; }, 2000);
      } catch {}
    };
  }

  if (nativeBtn) {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      nativeBtn.classList.remove('hidden');
      nativeBtn.classList.add('flex');
      nativeBtn.onclick = async () => {
        try {
          await navigator.share({ title: subject, text: msg, url: reviewUrl });
        } catch {}
      };
    } else {
      nativeBtn.classList.add('hidden');
      nativeBtn.classList.remove('flex');
    }
  }

  if (sharePopoverEscHandler) {
    document.removeEventListener('keydown', sharePopoverEscHandler);
  }
  sharePopoverEscHandler = (ev) => {
    if (ev.key === 'Escape') closeShareReviewPopover();
  };
  document.addEventListener('keydown', sharePopoverEscHandler);

  modal.classList.remove('hidden');
}

export function closeShareReviewPopover() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('share-review-popover');
  if (modal) modal.classList.add('hidden');
  if (sharePopoverEscHandler) {
    document.removeEventListener('keydown', sharePopoverEscHandler);
    sharePopoverEscHandler = null;
  }
}

export function promptUploadMediaVersion(idx, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId || typeof document === 'undefined') return;
  const ot = getOrderById(otId);
  const parent = ot?.mediaFiles?.[idx];
  if (!parent) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      await uploadMediaVersion(ot.id, parent.id, file);
      const entries = getEnvelopeVisibleMediaEntries();
      renderMediaPool();
      state.selectedMediaIndex = Math.max(0, entries.length - 1);
      renderInlineEnvelopeMedia();
    } catch (err) {
      if (typeof window !== 'undefined') {
        window.alert(err?.message || 'Error subiendo nueva versión.');
      }
    }
  };
  input.click();
}

export function promptAddMediaLink() {
  if (!state.activeOtId) return;
  const title = typeof window !== 'undefined' ? window.prompt('Nombre o descripción del recurso (ej: Comercial TV MP4 / Figma / Drive):') : null;
  if (!title || !title.trim()) return;
  const url = typeof window !== 'undefined' ? window.prompt('Enlace URL directo:') : null;
  if (!url || !url.trim()) return;

  const orders = getOrders();
  const ot = orders.find(o => o.id === state.activeOtId);
  if (!ot) return;

  const u = url.trim().toLowerCase();
  let type = 'link', ext = '';
  if (u.match(/\.(jpg|jpeg|png|gif|webp|svg)($|\?)/)) { type = 'image'; ext = 'jpg'; }
  else if (u.match(/\.(mp4|webm|mov|ogg)($|\?)/) || u.includes('youtube.com') || u.includes('youtu.be') || u.includes('vimeo.com')) { type = 'video'; ext = 'mp4'; }
  else if (u.match(/\.pdf($|\?)/)) { type = 'pdf'; ext = 'pdf'; }

  if (!ot.mediaFiles) ot.mediaFiles = [];
  ot.mediaFiles.push({ id: 'm-' + Date.now(), name: title.trim(), type, ext, size: 'Enlace', date: getNowFormatted(), url: url.trim() });
  saveOrders(orders);
  const entries = getEnvelopeVisibleMediaEntries();
  renderMediaPool();
  state.selectedMediaIndex = Math.max(0, entries.length - 1);
  renderInlineEnvelopeMedia();
}

export function removeMediaItem(index, targetOtId = state.activeOtId) {
  const otId = targetOtId || state.activeOtId;
  if (!otId) return;
  const orders = getOrders();
  const ot = orders.find(o => o.id === otId);
  if (!ot || !ot.mediaFiles) return;
  ot.mediaFiles.splice(index, 1);
  saveOrders(orders);
  const entries = getEnvelopeVisibleMediaEntries();
  renderMediaPool();
  if (state.selectedMediaIndex >= entries.length) state.selectedMediaIndex = Math.max(0, entries.length - 1);
  renderInlineEnvelopeMedia();
}

export function renderInlineEnvelopeMedia() {
  if (typeof document === 'undefined') return;
  const listContainer = document.getElementById('envelope-inline-files-list');
  const countEl = document.getElementById('inline-envelope-files-count');
  if (!listContainer) return;
  updateInlineViewToggleButtons();
  const entries = getEnvelopeVisibleMediaEntries();
  const isMaster = isEnvelopeMasterViewActive();
  if (countEl) countEl.innerText = `${entries.length} pieza${entries.length === 1 ? '' : 's'}`;

  const isGrid = inlineEnvelopeViewMode === 'grid';

  if (entries.length === 0) {
    listContainer.className = 'flex-1 bg-black/20 border border-resolve-border rounded-xl p-2 overflow-y-auto space-y-1.5';
    listContainer.innerHTML = `
      <div class="p-6 text-center text-resolve-dimText text-xs border border-dashed border-resolve-border rounded-xl font-medium">
        <span class="font-semibold text-zinc-300">Sobre sin archivos adjuntos</span>
        <p class="text-[10px] text-zinc-500 mt-1">Arrastra archivos a la zona superior para importarlos.</p>
      </div>`;
    renderInlineViewer();
    return;
  }
  if (state.selectedMediaIndex >= entries.length) state.selectedMediaIndex = Math.max(0, entries.length - 1);

  listContainer.className = isGrid
    ? 'flex-1 bg-black/20 border border-resolve-border rounded-xl p-2 overflow-y-auto grid grid-cols-3 sm:grid-cols-4 gap-1.5 content-start'
    : 'flex-1 bg-black/20 border border-resolve-border rounded-xl p-2 overflow-y-auto space-y-1.5';

  listContainer.innerHTML = entries.map((entry, idx) => {
    const { file, ownerOtId, ownerIndex, isSubOt } = entry;
    const otArg = `'${escapeHtml(ownerOtId)}'`;
    const sel = idx === state.selectedMediaIndex;
    const meta = getMediaMeta(file);
    const nextVersion = (file.versionNumber || 1) + 1;
    const reviewBadge = getReviewStatusBadgeHtml(file.reviewStatus);
    const ownerBadge = isMaster
      ? `<span class="shrink-0 font-mono text-[8px] px-1 rounded ${isSubOt ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'}">${escapeHtml(ownerOtId)}</span>`
      : '';

    if (isGrid) {
      const thumbHtml = (meta.type === 'image' && file.url && file.url !== '#')
        ? `<img src="${file.url}" alt="${escapeHtml(file.name)}" class="w-full h-full object-cover">`
        : `<div class="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider" style="${meta.badgeStyle}">${meta.badge}</div>`;

      return `
        <div onclick="selectInlinePreviewMedia(${idx})" title="${escapeHtml(file.name)} (v${file.versionNumber || 1})" class="group rounded-md border overflow-hidden transition-all cursor-pointer flex flex-col ${sel ? 'bg-resolve-card border-sky-500 ring-1 ring-sky-500/50 text-white' : 'bg-resolve-panel border-resolve-border hover:border-white/25 text-stone-300'}">
          <div class="relative aspect-square bg-black/60 flex items-center justify-center overflow-hidden">
            ${thumbHtml}
            <span class="absolute bottom-1 left-1 font-mono text-[8px] px-1 rounded bg-black/75 border border-white/10 text-zinc-200 leading-tight">v${file.versionNumber || 1}</span>
            ${isMaster ? `<span class="absolute top-1 left-1 font-mono text-[7px] px-1 rounded bg-black/80 border border-white/10 ${isSubOt ? 'text-sky-300' : 'text-sky-300'}">${escapeHtml(ownerOtId)}</span>` : ''}
            <div class="absolute top-1 right-1 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" onclick="event.stopPropagation(); openMediaReview(${ownerIndex}, ${otArg})" title="Revisar" class="p-0.5 rounded bg-black/80 hover:bg-black text-[#0BA2AC] cursor-pointer">
                ${lucideIcon('eye', 'w-3 h-3')}
              </button>
              <button type="button" onclick="event.stopPropagation(); shareMediaItem(${ownerIndex}, ${otArg})" title="Compartir" class="p-0.5 rounded bg-black/80 hover:bg-black text-zinc-200 hover:text-white cursor-pointer">
                ${lucideIcon('share-2', 'w-3 h-3')}
              </button>
              <button type="button" onclick="event.stopPropagation(); openMediaPreviewModal(${idx})" title="Ampliar" class="p-0.5 rounded bg-black/80 hover:bg-black text-zinc-300 hover:text-white cursor-pointer">
                ${lucideIcon('maximize-2', 'w-3 h-3')}
              </button>
              <button type="button" onclick="event.stopPropagation(); removeMediaItem(${ownerIndex}, ${otArg})" title="Quitar del sobre" class="p-0.5 rounded bg-black/80 hover:bg-black text-zinc-300 hover:text-red-400 cursor-pointer">${lucideIcon('x', 'w-3 h-3')}</button>
            </div>
          </div>
          <div class="px-1 py-0.5 bg-black/30 truncate text-[9px] font-medium ${sel ? 'text-sky-400' : 'text-zinc-300'}">${escapeHtml(file.name)}</div>
        </div>`;
    }

    const icon = (meta.type === 'image' && file.url && file.url !== '#')
      ? `<img src="${file.url}" class="w-8 h-8 rounded object-cover border border-resolve-border shrink-0">`
      : `<div class="w-8 h-8 rounded flex items-center justify-center text-[9px] font-bold shrink-0" style="${meta.badgeStyle}">${meta.badge}</div>`;
    return `
      <div onclick="selectInlinePreviewMedia(${idx})" class="p-2 rounded border transition-all cursor-pointer flex items-center justify-between gap-2 ${sel ? 'bg-resolve-card border-sky-500 text-white' : 'bg-resolve-panel border-resolve-border hover:bg-resolve-card/70 text-stone-300'}">
        <div class="flex items-center gap-2.5 min-w-0 flex-1">
          ${icon}
          <div class="min-w-0 flex-1">
            <div class="font-bold text-[11px] truncate flex items-center gap-1.5 ${sel ? 'text-sky-400' : 'text-white'}" title="${escapeHtml(file.name)}">
              ${ownerBadge}
              <span class="truncate">${escapeHtml(file.name)}</span>
              <span class="shrink-0 font-mono text-[9px] px-1 rounded bg-white/[0.08] text-zinc-300">v${file.versionNumber || 1}</span>
            </div>
            <div class="text-[10px] text-resolve-dimText flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span class="uppercase font-bold">${escapeHtml(meta.subLabel)}</span>
              <span>•</span>
              <span>${file.size || 'Web'}</span>
              ${reviewBadge}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="event.stopPropagation(); openMediaReview(${ownerIndex}, ${otArg})" title="Abrir visor de revisión colaborativa" class="px-2 py-1 bg-[#0BA2AC]/15 hover:bg-[#0BA2AC]/25 text-[#0BA2AC] font-semibold text-[10px] rounded-md border border-[#0BA2AC]/40 transition-all cursor-pointer">Revisar</button>
          <button type="button" onclick="event.stopPropagation(); shareMediaItem(${ownerIndex}, ${otArg})" title="Compartir enlace de revisión" class="px-2 py-1 bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 font-semibold text-[10px] rounded-md border border-resolve-border transition-all cursor-pointer">Compartir</button>
          <button type="button" onclick="event.stopPropagation(); promptUploadMediaVersion(${ownerIndex}, ${otArg})" title="Subir nueva versión (v${nextVersion})" class="px-1.5 py-1 bg-white/[0.05] hover:bg-white/[0.12] text-zinc-200 font-mono font-semibold text-[10px] rounded-md border border-resolve-border transition-all cursor-pointer">v${nextVersion}</button>
          <button type="button" onclick="event.stopPropagation(); openMediaPreviewModal(${idx})" title="Ampliar" class="p-1 hover:bg-resolve-surface rounded text-resolve-dimText hover:text-white cursor-pointer inline-flex items-center justify-center">
            ${lucideIcon('maximize-2', 'w-[15px] h-[15px]')}
          </button>
          <button type="button" onclick="event.stopPropagation(); removeMediaItem(${ownerIndex}, ${otArg})" title="Quitar del sobre" class="p-1 hover:text-red-400 text-resolve-dimText cursor-pointer inline-flex items-center justify-center">${lucideIcon('x', 'w-[15px] h-[15px]')}</button>
        </div>
      </div>`;
  }).join('');
  renderInlineViewer();
}

export function selectInlinePreviewMedia(index) {
  state.selectedMediaIndex = index;
  renderInlineEnvelopeMedia();
}

export function setInlineCodeTab(mode) {
  state.inlineCodeViewMode = mode;
  renderInlineViewer();
  const previewModal = document.getElementById('media-preview-modal');
  if (previewModal && !previewModal.classList.contains('hidden')) {
    renderMediaPreviewModalBody();
  }
}

export function setInlineMarkdownTab(mode) {
  state.inlineMarkdownViewMode = mode;
  renderInlineViewer();
  const previewModal = document.getElementById('media-preview-modal');
  if (previewModal && !previewModal.classList.contains('hidden')) {
    renderMediaPreviewModalBody();
  }
}

export function setInlineFontSize(size) {
  state.inlineFontSize = parseInt(size, 10) || 26;
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-font-sandbox]').forEach(el => { el.style.fontSize = state.inlineFontSize + 'px'; });
  document.querySelectorAll('[data-font-counter]').forEach(el => { el.innerText = state.inlineFontSize + 'px'; });
}

export function setInteractiveFontPreset(text) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('[data-font-sandbox]').forEach(el => { el.innerText = text; });
}

export function buildMediaViewerHtml(file) {
  if (!file) {
    return `<div class="h-full flex flex-col items-center justify-center p-8 text-center text-resolve-dimText">
      <span class="text-xs font-semibold text-zinc-300">Monitor de Previsualización</span>
      <span class="text-[10px] text-zinc-500 mt-1">Selecciona una pieza a la izquierda para previsualizarla</span></div>`;
  }
  const meta = getMediaMeta(file);
  const url = file.url && file.url !== '#' ? file.url : '';
  const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
  const isVimeo = url.includes('vimeo.com');
  const tabBtn = (active, fn, label) => `<button type="button" onclick="${fn}" class="px-2 py-0.5 rounded-md text-[10px] ${active ? 'bg-white/[0.12] text-white font-semibold' : 'text-resolve-dimText hover:text-white'}">${label}</button>`;

  // Imagen
  if (meta.type === 'image' && url) {
    return `<div class="w-full h-full flex items-center justify-center bg-black/60 p-3 overflow-hidden"><img src="${url}" alt="${escapeHtml(file.name)}" class="max-h-full max-w-full object-contain rounded-xl shadow-lg"></div>`;
  }
  // Video
  if (isYouTube || isVimeo) {
    let embed = url;
    if (isYouTube) { const m = url.match(/(?:youtu\.be\/|watch\?v=)([\w\-]+)/); if (m) embed = 'https://www.youtube.com/embed/' + m[1]; }
    return `<div class="w-full h-full bg-black"><iframe src="${embed}" class="w-full h-full border-0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`;
  }
  if (meta.type === 'video' && url) {
    return `<div class="w-full h-full flex items-center justify-center bg-black p-2"><video controls playsinline class="max-h-full max-w-full rounded-xl"><source src="${url}"></video></div>`;
  }
  // PDF
  if (meta.type === 'pdf') {
    if (!url) return `<div class="p-6 text-xs text-zinc-500 font-medium">PDF sin enlace activo</div>`;
    return `<div class="w-full h-full flex flex-col bg-stone-950">
      <div class="h-8 px-3 bg-resolve-panel border-b border-resolve-border flex items-center justify-between shrink-0">
        <span class="text-[10px] text-zinc-400">Si el PDF no se muestra, ábrelo en el visor nativo</span>
        <a href="${url}" target="_blank" rel="noopener" class="px-2.5 py-0.5 bg-gradient-to-b from-sky-400 to-sky-500 text-stone-950 font-semibold rounded-md text-[10px]">Abrir PDF ↗</a>
      </div>
      <object data="${url}" type="application/pdf" class="w-full flex-1" style="min-height:260px">
        <embed src="${url}" type="application/pdf" class="w-full h-full">
        <div class="p-6 text-center text-xs text-zinc-300 font-medium">Tu navegador no puede incrustar este PDF. <a href="${url}" target="_blank" class="text-sky-400 underline">Abrir en pestaña nueva</a></div>
      </object>
    </div>`;
  }
  // Markdown
  if (meta.type === 'markdown') {
    const raw = file.content != null ? file.content : '*(Sin contenido de texto disponible. Vuelve a importar el archivo.)*';
    return `<div class="w-full h-full flex flex-col bg-resolve-bg">
      <div class="h-8 px-3 bg-resolve-panel border-b border-resolve-border flex items-center justify-between shrink-0">
        <div class="flex items-center gap-1">${tabBtn(state.inlineMarkdownViewMode === 'rendered', "setInlineMarkdownTab('rendered')", 'Renderizado')}${tabBtn(state.inlineMarkdownViewMode === 'raw', "setInlineMarkdownTab('raw')", 'Raw')}</div>
        <button type="button" onclick="copyMediaCodeText(this.dataset.code, this)" data-code="${escapeHtml(raw)}" class="px-2 py-0.5 bg-white/[0.05] border border-resolve-border text-zinc-300 rounded text-[10px]">Copiar</button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 select-text">${state.inlineMarkdownViewMode === 'rendered' ? formatMarkdown(raw) : '<pre class="text-[11px] text-zinc-300 font-mono whitespace-pre-wrap">' + escapeHtml(raw) + '</pre>'}</div>
    </div>`;
  }
  // Código
  if (meta.type === 'code') {
    const raw = file.content != null ? file.content : '// Sin contenido de texto disponible.\n// Vuelve a importar el archivo para previsualizarlo.';
    const lines = raw.split('\n');
    const isHtml = ['html', 'htm'].includes(meta.ext);
    return `<div class="w-full h-full flex flex-col bg-resolve-bg">
      <div class="h-8 px-3 bg-resolve-panel border-b border-resolve-border flex items-center justify-between shrink-0">
        <div class="flex items-center gap-1.5">
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="${meta.badgeStyle}">${meta.badge}</span>
          <span class="text-[10px] text-resolve-dimText">${lines.length} líneas</span>
          ${isHtml ? tabBtn(state.inlineCodeViewMode === 'code', "setInlineCodeTab('code')", 'Código') + tabBtn(state.inlineCodeViewMode === 'render', "setInlineCodeTab('render')", 'Vista Web') : ''}
        </div>
        <button type="button" onclick="copyMediaCodeText(this.dataset.code, this)" data-code="${escapeHtml(raw)}" class="px-2 py-0.5 bg-white/[0.05] border border-resolve-border text-zinc-300 rounded text-[10px]">Copiar</button>
      </div>
      <div class="flex-1 overflow-hidden">
        ${isHtml && state.inlineCodeViewMode === 'render'
          ? `<iframe sandbox="allow-scripts" srcdoc="${escapeHtml(raw)}" class="w-full h-full bg-white border-0"></iframe>`
          : `<div class="w-full h-full overflow-auto flex bg-black/80 text-xs select-text font-mono">
              <div class="py-2.5 px-2 bg-resolve-panel/60 border-r border-resolve-border text-zinc-600 text-right select-none text-[10px] leading-5 shrink-0 min-w-[34px]">${lines.map((_, i) => '<div>' + (i + 1) + '</div>').join('')}</div>
              <pre class="p-2.5 flex-1 text-[11px] text-emerald-400 leading-5 whitespace-pre"><code>${escapeHtml(raw)}</code></pre>
            </div>`}
      </div>
    </div>`;
  }
  // Fuente
  if (meta.type === 'font') {
    ensureFontLoaded(file);
    const id = fontSafeId(file);
    const preset = (t, l) => `<button type="button" onclick="setInteractiveFontPreset(this.dataset.t)" data-t="${escapeHtml(t)}" class="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.10] border border-resolve-border text-[10px] text-zinc-300 whitespace-nowrap transition-colors">${l}</button>`;
    return `<div class="w-full h-full flex flex-col bg-resolve-bg">
      <div class="h-9 px-3 bg-resolve-panel border-b border-resolve-border flex items-center justify-between shrink-0">
        <span class="px-1.5 py-0.5 rounded text-[10px] font-bold" style="${meta.badgeStyle}">${meta.badge}</span>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-resolve-dimText font-medium">Tamaño</span>
          <input type="range" min="12" max="72" value="${state.inlineFontSize}" oninput="setInlineFontSize(this.value)" class="w-24 accent-sky-500">
          <span data-font-counter class="text-[10px] text-sky-400 font-mono font-bold w-9 text-right">${state.inlineFontSize}px</span>
        </div>
      </div>
      <div class="h-8 px-3 bg-resolve-surface/70 border-b border-resolve-border flex items-center gap-1.5 overflow-x-auto shrink-0">
        ${preset('El veloz murciélago hindú comía feliz cardillo y kiwi. 1234567890', 'Pangrama ES')}
        ${preset('The quick brown fox jumps over the lazy dog. 1234567890', 'Pangram EN')}
        ${preset('ABCDEFGHIJKLMNÑOPQRSTUVWXYZ abcdefghijklmnñopqrstuvwxyz', 'Aa–Zz')}
        ${preset('0123456789 !?@#$%&*()_+-=[]{};:,.<>/~', '0–9 y símbolos')}
      </div>
      <div class="flex-1 overflow-y-auto p-4 space-y-4">
        <div data-font-sandbox contenteditable="true" class="specimen-${id} p-3.5 bg-black/60 border border-resolve-border rounded-xl text-white focus:outline-none focus:border-sky-400 leading-snug" style="font-size:${state.inlineFontSize}px">El veloz murciélago hindú comía feliz cardillo y kiwi. 1234567890</div>
        <div class="border border-resolve-border rounded-xl p-3 bg-resolve-surface/40 space-y-2">
          <div class="specimen-${id} text-2xl text-white truncate">Titular de campaña — 24</div>
          <div class="specimen-${id} text-lg text-sky-200/90 truncate">Subtitular descriptivo — 18</div>
          <div class="specimen-${id} text-sm text-zinc-300">Cuerpo de texto en 14px para evaluar legibilidad en impresos y pantallas.</div>
          <div class="specimen-${id} text-xs text-zinc-500 tracking-wider">ABCDEFGHIJKLMNÑOPQRSTUVWXYZ 0123456789</div>
        </div>
      </div>
    </div>`;
  }
  // Suites: Adobe, Affinity, Pages, Word
  if (meta.isSuite) {
    return `<div class="w-full h-full flex items-center justify-center p-5 overflow-y-auto">
      <div class="w-full max-w-sm bg-resolve-panel border border-resolve-border rounded-2xl p-5 flex flex-col items-center text-center shadow-lg">
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-lg font-black mb-3 shadow-md" style="${meta.badgeStyle}">${meta.badge}</div>
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider mb-1" style="${meta.badgeStyle}">${meta.suiteBrand}</span>
        <div class="font-semibold text-white text-sm mt-1 max-w-full truncate" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
        <div class="text-[11px] text-resolve-dimText mb-3">${escapeHtml(meta.subLabel)} • ${file.size || ''}</div>
        <div class="w-full bg-black/30 border border-resolve-border rounded-xl p-3 text-left text-[10px] mb-4 space-y-1">
          <div class="flex justify-between text-resolve-dimText"><span>Formato</span><span class="text-white font-mono font-bold">.${meta.ext.toUpperCase()}</span></div>
          <div class="flex justify-between text-resolve-dimText"><span>Importado</span><span class="text-zinc-300 font-mono">${file.date || '--'}</span></div>
          <p class="text-[9px] text-zinc-400 pt-1">Formato propietario: el navegador no puede renderizarlo. Ábrelo en su aplicación nativa; la pieza queda adjunta al sobre.</p>
        </div>
        ${url ? `<a href="${url}" download="${escapeHtml(file.name)}" class="w-full py-2 bg-gradient-to-b from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-stone-950 font-semibold text-xs rounded-lg shadow-sm border border-sky-300/40 transition-all active:scale-[0.98]">Descargar / Abrir en app nativa</a>` : ''}
      </div>
    </div>`;
  }
  // Genérico / enlace
  return `<div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-white/[0.02]">
    <div class="font-semibold text-white text-xs mb-1 max-w-xs truncate">${escapeHtml(file.name)}</div>
    <p class="text-[10px] text-resolve-dimText mb-3">Enlace web o archivo vinculado al sobre.</p>
    ${url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="px-3 py-1.5 bg-gradient-to-b from-sky-400 to-sky-500 hover:from-sky-300 hover:to-sky-400 text-stone-950 font-semibold text-xs rounded-lg shadow-sm border border-sky-300/40 transition-all active:scale-[0.98]">Abrir Recurso ↗</a>` : ''}
  </div>`;
}

export function renderInlineViewer() {
  if (typeof document === 'undefined') return;
  const viewer = document.getElementById('envelope-inline-viewer');
  const entries = getEnvelopeVisibleMediaEntries();
  const entry = entries[state.selectedMediaIndex];
  const file = entry?.file;
  const titleEl = document.getElementById('envelope-mediapool-title');
  if (titleEl) {
    titleEl.innerHTML = file
      ? `<span>GALERÍA</span><span class="text-zinc-500">•</span><span class="text-sky-300 normal-case tracking-normal truncate max-w-[360px]" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</span>`
      : 'GALERÍA';
  }
  if (!viewer) return;
  if (!file) { viewer.innerHTML = buildMediaViewerHtml(null); return; }

  const otArg = `'${escapeHtml(entry.ownerOtId)}'`;
  const ownerIndex = entry.ownerIndex;
  const isMaster = isEnvelopeMasterViewActive();
  const nextVersion = (file.versionNumber || 1) + 1;
  const reviewBadge = getReviewStatusBadgeHtml(file.reviewStatus);
  const ownerBadge = isMaster
    ? `<span class="shrink-0 font-mono text-[9px] px-1 rounded ${entry.isSubOt ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'}">${escapeHtml(entry.ownerOtId)}</span>`
    : '';
  viewer.innerHTML = `
    <div class="h-9 px-3 bg-resolve-panel/90 border-b border-resolve-border flex items-center justify-between gap-2 shrink-0">
      <div class="flex items-center gap-2 truncate min-w-0">
        <span class="w-2 h-2 rounded-full bg-sky-400 shrink-0"></span>
        ${ownerBadge}
        <span class="font-semibold text-white text-[11px] truncate">${escapeHtml(file.name)}</span>
        <span class="shrink-0 font-mono text-[9px] px-1 rounded bg-white/[0.08] text-zinc-300">v${file.versionNumber || 1}</span>
        ${reviewBadge}
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" onclick="openMediaReview(${ownerIndex}, ${otArg})" class="px-2 py-0.5 rounded-md bg-[#0BA2AC]/15 hover:bg-[#0BA2AC]/25 border border-[#0BA2AC]/40 text-[#0BA2AC] text-[10px] font-semibold cursor-pointer transition-colors" title="Abrir visor de revisión colaborativa">Revisar</button>
        <button type="button" onclick="shareMediaItem(${ownerIndex}, ${otArg})" class="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.10] border border-resolve-border text-zinc-200 text-[10px] font-semibold cursor-pointer transition-colors" title="Compartir enlace de revisión colaborativa">Compartir</button>
        <button type="button" onclick="promptUploadMediaVersion(${ownerIndex}, ${otArg})" class="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.10] border border-resolve-border text-zinc-200 font-mono text-[10px] font-semibold cursor-pointer transition-colors" title="Subir nueva versión (v${nextVersion})">+ v${nextVersion}</button>
        <button type="button" onclick="openMediaPreviewModal(${state.selectedMediaIndex})" class="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.10] border border-resolve-border text-sky-300 text-[10px] font-semibold cursor-pointer transition-colors" title="Pantalla completa">Ampliar</button>
        ${file.url && file.url !== '#' ? `<a href="${file.url}" target="_blank" download="${escapeHtml(file.name)}" class="px-2 py-0.5 rounded-md bg-white/[0.05] hover:bg-white/[0.10] border border-resolve-border text-zinc-300 hover:text-white text-[10px] font-semibold transition-colors">Descargar ↓</a>` : ''}
      </div>
    </div>
    <div class="flex-1 overflow-hidden relative bg-black/40">${buildMediaViewerHtml(file)}</div>`;
}

export function openMediaPreviewModal(index) {
  if (typeof document === 'undefined') return;
  const entries = getEnvelopeVisibleMediaEntries();
  if (entries.length === 0) return;
  state.modalPreviewIndex = Math.max(0, Math.min(entries.length - 1, index || 0));
  renderMediaPreviewModalBody();
  const modal = document.getElementById('media-preview-modal');
  if (modal) modal.classList.remove('hidden');
}

export function closeMediaPreviewModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('media-preview-modal');
  if (modal) modal.classList.add('hidden');
  const body = document.getElementById('media-preview-modal-body');
  if (body) body.innerHTML = '';
}

export function stepSelectedMediaItem(delta) {
  const entries = getEnvelopeVisibleMediaEntries();
  if (entries.length === 0) return;
  const total = entries.length;
  state.modalPreviewIndex = (state.modalPreviewIndex + delta + total) % total;
  renderMediaPreviewModalBody();
}

export function renderMediaPreviewModalBody() {
  if (typeof document === 'undefined') return;
  const entries = getEnvelopeVisibleMediaEntries();
  const entry = entries[state.modalPreviewIndex];
  const file = entry?.file;
  if (!file) return;
  const meta = getMediaMeta(file);

  const titleEl = document.getElementById('media-preview-modal-title');
  if (titleEl) titleEl.innerText = isEnvelopeMasterViewActive() ? `[${entry.ownerOtId}] ${file.name}` : file.name;

  const metaEl = document.getElementById('media-preview-modal-meta');
  if (metaEl) metaEl.innerText = `${state.modalPreviewIndex + 1} de ${entries.length} • ${meta.subLabel} • ${file.size || ''}`;

  const bodyEl = document.getElementById('media-preview-modal-body');
  if (bodyEl) bodyEl.innerHTML = buildMediaViewerHtml(file);
}

// ============================================================================
// 4. MODAL NUEVA OT & GENERADOR DE ID
// ============================================================================

export function openNewOtModal() {
  if (typeof document === 'undefined') return;
  const orders = getOrders();
  let maxNum = 0;
  orders.forEach(o => {
    const parts = (o.id || '').split('-');
    if (parts.length === 3) {
      const num = parseInt(parts[2], 10);
      if (!isNaN(num) && num > maxNum) maxNum = num;
    }
  });
  const nextId = `OT-26-${String(maxNum + 1).padStart(3, '0')}`;

  const idInput = document.getElementById('new-id-input');
  if (idInput) idInput.value = nextId;

  const refInput = document.getElementById('new-ref-input');
  if (refInput) refInput.value = '';

  const clientInput = document.getElementById('new-client-input');
  if (clientInput) clientInput.value = (state.selectedTreeFilter && state.selectedTreeFilter.client) || '';

  const brandInput = document.getElementById('new-brand-input');
  if (brandInput) brandInput.value = (state.selectedTreeFilter && state.selectedTreeFilter.brand) || '';

  const mediaInput = document.getElementById('new-media-input');
  if (mediaInput) mediaInput.value = '';

  const titleInput = document.getElementById('new-title-input');
  if (titleInput) titleInput.value = '';

  const firstTaskInput = document.getElementById('new-first-task-input');
  if (firstTaskInput) firstTaskInput.value = '';

  const urgentInput = document.getElementById('new-urgent-input');
  if (urgentInput) urgentInput.checked = false;

  renderStatusSelects();
  renderResponsibleSelects();

  const newStatus = document.getElementById('new-ot-status');
  if (newStatus) newStatus.value = 'Tráfico';

  const defaultResp = getActiveUserShortName() || 'Usuario';
  const newResp = document.getElementById('new-ot-responsible');
  if (newResp) newResp.value = defaultResp;

  updateClientsDatalist();
  syncNewOtBrandSuggestions();

  const modal = document.getElementById('new-ot-modal');
  if (modal) modal.classList.remove('hidden');
}

export function closeNewOtModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('new-ot-modal');
  if (modal) modal.classList.add('hidden');
}

export function syncNewOtBrandSuggestions() {
  if (typeof document === 'undefined') return;
  const clientName = (document.getElementById('new-client-input')?.value || '').trim();
  const brandDatalist = document.getElementById('brands-datalist');
  if (!brandDatalist) return;

  const clients = getClients();
  const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());

  if (client && client.brands) {
    brandDatalist.innerHTML = client.brands.map(b => `<option value="${escapeHtml(b)}"></option>`).join('');
  } else {
    const allBrands = new Set();
    clients.forEach(c => (c.brands || []).forEach(b => allBrands.add(b)));
    brandDatalist.innerHTML = Array.from(allBrands).map(b => `<option value="${escapeHtml(b)}"></option>`).join('');
  }
}

export async function handleCreateOt(e) {
  if (e) e.preventDefault();
  if (typeof document === 'undefined') return;

  const clients = getClients();

  const defaultResp = getActiveUserShortName() || 'Usuario';
  const ref = (document.getElementById('new-ref-input')?.value || '').trim();
  const client = (document.getElementById('new-client-input')?.value || '').trim();
  const brand = (document.getElementById('new-brand-input')?.value || '').trim();
  const product = (document.getElementById('new-product-input')?.value || '').trim();
  const responsible = (document.getElementById('new-ot-responsible')?.value) || defaultResp;
  const status = (document.getElementById('new-ot-status')?.value) || 'Tráfico';
  const media = (document.getElementById('new-media-input')?.value || '').trim();
  const title = (document.getElementById('new-title-input')?.value || '').trim();
  const firstTask = (document.getElementById('new-first-task-input')?.value || '').trim();
  const urgent = !!document.getElementById('new-urgent-input')?.checked;

  if (state.memberRole === 'owner') {
    let existingClient = clients.find(c => c.name.toLowerCase() === client.toLowerCase());
    if (!existingClient) {
      existingClient = { id: 'c-' + Date.now(), name: client, brands: brand ? [brand] : [] };
      clients.push(existingClient);
      saveClients(clients);
    } else {
      if (!existingClient.brands) existingClient.brands = [];
      if (brand && !existingClient.brands.some(b => b.toLowerCase() === brand.toLowerCase())) {
        existingClient.brands.push(brand);
        saveClients(clients);
      }
    }
  }

  if (responsible && responsible !== '__NEW_RESPONSIBLE__') {
    addResponsible(responsible);
  }

  const initialRoutes = [];
  const respVal = (responsible && responsible !== '__NEW_RESPONSIBLE__') ? responsible : defaultResp;
  initialRoutes.push({
    from: state.memberRole === 'client' ? 'Cliente' : 'Tráfico',
    to: 'Creativos',
    task: firstTask || title || '',
    entryDate: getNowFormatted(),
    deliveryDate: '',
    sign: respVal,
    notes: '',
    stamp: firstTask ? 'RECIBIDO' : null,
    completed: false
  });

  try {
    const createdOt = await createOt({
      ref,
      client,
      brand,
      product: product || brand,
      title,
      media,
      urgent,
      status: status !== '__NEW__' ? status : 'Tráfico',
      sign: responsible !== '__NEW_RESPONSIBLE__' ? responsible : defaultResp,
      routes: initialRoutes
    });
    closeNewOtModal();
    if (createdOt) openEnvelopeModal(createdOt.id);
  } catch (err) {
    if (typeof window !== 'undefined') window.alert(err?.message || 'Error al crear la OT.');
  }
}

export function updateClientsDatalist() {
  if (typeof document === 'undefined') return;
  const dl = document.getElementById('clients-datalist');
  if (!dl) return;
  const clients = getClients();
  dl.innerHTML = clients.map(c => `<option value="${escapeHtml(c.name)}"></option>`).join('');
}

// ============================================================================
// 5. GESTIÓN DE CLIENTES Y MARCAS (CRUD UNIFICADO CON COLOR Y MARCAS)
// ============================================================================

let currentModalBrands = [];
let currentModalColor = 'emerald';

export function renderClientModalColors() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('client-modal-color-container');
  const label = document.getElementById('client-modal-color-label');
  const hiddenInput = document.getElementById('client-modal-color');
  const headerIndicator = document.getElementById('client-modal-header-indicator');
  if (!container) return;

  const activeItem = CLIENT_COLOR_PALETTE.find(p => p.name === currentModalColor) || CLIENT_COLOR_PALETTE[0];
  if (label) {
    label.innerText = activeItem.label || activeItem.name;
    label.className = `text-[10px] font-semibold ${activeItem.text}`;
  }
  if (hiddenInput) hiddenInput.value = activeItem.name;
  if (headerIndicator) {
    headerIndicator.style.backgroundColor = activeItem.hex;
  }

  container.innerHTML = CLIENT_COLOR_PALETTE.map(item => {
    const isSelected = item.name === currentModalColor;
    return `
      <button 
        type="button" 
        onclick="selectClientModalColor('${item.name}')" 
        title="${escapeHtml(item.label || item.name)}"
        class="h-7 rounded-md flex items-center justify-center gap-1.5 px-1.5 transition-all cursor-pointer border ${isSelected ? 'border-white ring-2 ring-sky-400/60 shadow-sm scale-[1.03] ' + item.bg : 'border-white/[0.08] hover:border-white/30 opacity-70 hover:opacity-100 bg-white/[0.02]'}"
      >
        <span class="w-2.5 h-2.5 rounded-full ${item.dot} shrink-0"></span>
        <span class="text-[9px] font-medium truncate ${item.text}">${escapeHtml(item.label || item.name)}</span>
      </button>
    `;
  }).join('');
}

export function selectClientModalColor(colorName) {
  currentModalColor = colorName;
  renderClientModalColors();
}

export function renderClientModalBrandsList() {
  if (typeof document === 'undefined') return;
  const listContainer = document.getElementById('client-modal-brands-list');
  if (!listContainer) return;

  if (currentModalBrands.length === 0) {
    listContainer.innerHTML = `<span class="text-zinc-500 italic text-[11px] py-1 self-center w-full text-center select-none">Sin marcas o productos agregados aún (opcional)</span>`;
    return;
  }

  listContainer.innerHTML = currentModalBrands.map(brand => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/[0.08] text-zinc-200 border border-white/[0.12] text-xs font-medium group">
      <span>${escapeHtml(brand)}</span>
      <button 
        type="button" 
        onclick="handleRemoveBrandFromModal('${escapeHtml(brand)}')" 
        class="text-zinc-400 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
        title="Eliminar marca"
      >✕</button>
    </span>
  `).join('');
}

export function handleAddBrandToModal() {
  if (typeof document === 'undefined') return;
  const input = document.getElementById('client-modal-brand-input');
  if (!input) return;
  const brandVal = (input.value || '').trim();
  if (!brandVal) return;

  if (currentModalBrands.some(b => b.toLowerCase() === brandVal.toLowerCase())) {
    if (typeof window !== 'undefined') window.alert('Esta marca o producto ya fue agregada.');
    return;
  }

  currentModalBrands.push(brandVal);
  input.value = '';
  renderClientModalBrandsList();
  input.focus();
}

export function handleRemoveBrandFromModal(brandName) {
  currentModalBrands = currentModalBrands.filter(b => b.toLowerCase() !== (brandName || '').toLowerCase());
  renderClientModalBrandsList();
}

export function openClientModal(clientId = null) {
  if (typeof document === 'undefined') return;
  const title = document.getElementById('client-modal-title');
  const inputId = document.getElementById('edit-client-id');
  const inputName = document.getElementById('client-modal-name');
  const brandInput = document.getElementById('client-modal-brand-input');

  if (clientId) {
    const client = getClients().find(c => c.id === clientId);
    if (!client) return;
    if (title) title.innerText = "Editar Cliente";
    if (inputId) inputId.value = client.id;
    if (inputName) inputName.value = client.name;
    currentModalColor = client.color || 'emerald';
    currentModalBrands = Array.isArray(client.brands) ? [...client.brands] : [];
  } else {
    if (title) title.innerText = "Nuevo Cliente";
    if (inputId) inputId.value = "";
    if (inputName) inputName.value = "";
    currentModalColor = 'emerald';
    currentModalBrands = [];
  }

  if (brandInput) brandInput.value = "";

  renderClientModalColors();
  renderClientModalBrandsList();

  const modal = document.getElementById('client-modal');
  if (modal) modal.classList.remove('hidden');
  if (inputName) inputName.focus();
}

export function closeClientModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('client-modal');
  if (modal) modal.classList.add('hidden');
}

export function handleSaveClient(e) {
  if (e) e.preventDefault();
  if (typeof document === 'undefined') return;

  const inputId = document.getElementById('edit-client-id')?.value;
  const name = (document.getElementById('client-modal-name')?.value || '').trim();
  if (!name) return;

  // Si quedó texto escrito en el input de marca sin pulsar "+", agregarlo automáticamente
  const pendingBrandInput = document.getElementById('client-modal-brand-input');
  if (pendingBrandInput) {
    const pendingVal = (pendingBrandInput.value || '').trim();
    if (pendingVal && !currentModalBrands.some(b => b.toLowerCase() === pendingVal.toLowerCase())) {
      currentModalBrands.push(pendingVal);
    }
  }

  const clients = getClients();
  const orders = getOrders();

  if (inputId) {
    const client = clients.find(c => c.id === inputId);
    if (client) {
      const oldName = client.name;
      client.name = name;
      client.color = currentModalColor;
      client.brands = [...currentModalBrands];

      if (oldName.toLowerCase() !== name.toLowerCase()) {
        orders.forEach(ot => {
          if ((ot.client || '').toLowerCase() === oldName.toLowerCase()) {
            ot.client = name;
          }
        });
        if (state.selectedTreeFilter && state.selectedTreeFilter.client === oldName) {
          state.selectedTreeFilter.client = name;
        }
        saveOrders(orders);
      }
    }
  } else {
    const exists = clients.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      if (typeof window !== 'undefined') window.alert("Ya existe un cliente con ese nombre.");
      return;
    }
    clients.push({
      id: 'c-' + Date.now(),
      name: name,
      color: currentModalColor,
      brands: [...currentModalBrands]
    });
  }

  saveClients(clients);
  closeClientModal();
  updateClientsDatalist();
  renderBinTree();
  renderTrafficDesk();
}

export function deleteClientAction(clientId) {
  if (state.memberRole !== 'owner') return;
  const clients = getClients();
  const client = clients.find(c => c.id === clientId);
  if (!client) return;

  const orders = getOrders();
  const associated = orders.filter(o => (o.client || '').toLowerCase() === client.name.toLowerCase());

  const confirmMsg = associated.length > 0
    ? `ATENCIÓN: El cliente "${client.name}" tiene ${associated.length} OTs vinculadas. ¿Deseas eliminar el cliente y todas sus marcas? (Las OTs se mantendrán pero quedarán sin bin activo)`
    : `¿Eliminar el cliente "${client.name}" y sus marcas?`;

  if (typeof window !== 'undefined' && !window.confirm(confirmMsg)) return;

  bridgeDeleteClient(clientId);
  if (state.selectedTreeFilter && state.selectedTreeFilter.client === client.name) {
    state.selectedTreeFilter = { type: 'all', client: null, brand: null };
  }
  renderBinTree();
  renderTrafficDesk();
}

export function openBrandModal(clientName, oldBrandName = null) {
  if (typeof document === 'undefined') return;
  const title = document.getElementById('brand-modal-title');
  const inputClient = document.getElementById('brand-client-name');
  const displayClient = document.getElementById('brand-client-display');
  const inputOld = document.getElementById('edit-brand-old-name');
  const inputName = document.getElementById('brand-modal-name');

  if (inputClient) inputClient.value = clientName;
  if (displayClient) displayClient.value = clientName;

  if (oldBrandName) {
    if (title) title.innerText = "Editar Marca / Producto";
    if (inputOld) inputOld.value = oldBrandName;
    if (inputName) inputName.value = oldBrandName;
  } else {
    if (title) title.innerText = "Nueva Marca / Producto";
    if (inputOld) inputOld.value = "";
    if (inputName) inputName.value = "";
  }

  const modal = document.getElementById('brand-modal');
  if (modal) modal.classList.remove('hidden');
  if (inputName) inputName.focus();
}

export function closeBrandModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('brand-modal');
  if (modal) modal.classList.add('hidden');
}

export function handleSaveBrand(e) {
  if (e) e.preventDefault();
  if (typeof document === 'undefined') return;

  const clientName = document.getElementById('brand-client-name')?.value || '';
  const oldBrandName = document.getElementById('edit-brand-old-name')?.value || '';
  const newBrandName = (document.getElementById('brand-modal-name')?.value || '').trim();
  if (!newBrandName) return;

  const clients = getClients();
  const client = clients.find(c => c.name.toLowerCase() === clientName.toLowerCase());
  if (!client) return;

  if (!client.brands) client.brands = [];

  if (oldBrandName) {
    const idx = client.brands.findIndex(b => b.toLowerCase() === oldBrandName.toLowerCase());
    if (idx !== -1) {
      client.brands[idx] = newBrandName;
    }
    const orders = getOrders();
    orders.forEach(ot => {
      if ((ot.client || '').toLowerCase() === clientName.toLowerCase() && (ot.product || '').toLowerCase() === oldBrandName.toLowerCase()) {
        ot.product = newBrandName;
      }
    });
    if (state.selectedTreeFilter && state.selectedTreeFilter.brand === oldBrandName) {
      state.selectedTreeFilter.brand = newBrandName;
    }
    saveOrders(orders);
  } else {
    if (client.brands.some(b => b.toLowerCase() === newBrandName.toLowerCase())) {
      if (typeof window !== 'undefined') window.alert("Esa marca ya existe para este cliente.");
      return;
    }
    client.brands.push(newBrandName);
  }

  saveClients(clients);
  closeBrandModal();
  renderBinTree();
  renderTrafficDesk();
}

export function deleteBrandAction(clientName, brandName) {
  if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar la marca "${brandName}" del cliente "${clientName}"?`)) return;

  bridgeDeleteBrand(clientName, brandName);
  if (state.selectedTreeFilter && state.selectedTreeFilter.client === clientName && state.selectedTreeFilter.brand === brandName) {
    state.selectedTreeFilter = { type: 'client', client: clientName, brand: null };
  }
  renderBinTree();
  renderTrafficDesk();
}

// ============================================================================
// 6. GESTOR DE ESTADOS (STATUS-MANAGER-MODAL)
// ============================================================================

export function openStatusManagerModal() {
  if (typeof document === 'undefined') return;
  renderStatusManagerList();
  const nameInput = document.getElementById('new-status-name');
  if (nameInput) nameInput.value = '';
  const modal = document.getElementById('status-manager-modal');
  if (modal) modal.classList.remove('hidden');
  if (nameInput) nameInput.focus();
}

export function closeStatusManagerModal() {
  if (typeof document === 'undefined') return;
  const modal = document.getElementById('status-manager-modal');
  if (modal) modal.classList.add('hidden');
}

export function renderStatusManagerList() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('status-manager-list');
  if (!container) return;

  const statuses = getStatuses();
  const orders = getOrders();

  container.innerHTML = statuses.map(st => {
    const count = orders.filter(o => (o.responsibleDept || '').toLowerCase() === st.name.toLowerCase() || (o.otStatus || '').toLowerCase() === st.name.toLowerCase()).length;
    return `
      <div class="flex items-center gap-2 p-1.5 bg-resolve-bg border border-resolve-border rounded">
        <select 
          onchange="updateStatusColor('${st.id}', this.value)" 
          class="bg-resolve-panel border border-resolve-border rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none"
        >
          <option value="amber" ${st.color === 'amber' ? 'selected' : ''}>Ámbar</option>
          <option value="blue" ${st.color === 'blue' ? 'selected' : ''}>Azul</option>
          <option value="cyan" ${st.color === 'cyan' ? 'selected' : ''}>Celeste</option>
          <option value="purple" ${st.color === 'purple' ? 'selected' : ''}>Púrpura</option>
          <option value="emerald" ${st.color === 'emerald' ? 'selected' : ''}>Verde</option>
          <option value="red" ${st.color === 'red' ? 'selected' : ''}>Rojo</option>
          <option value="yellow" ${st.color === 'yellow' ? 'selected' : ''}>Amarillo</option>
          <option value="stone" ${st.color === 'stone' ? 'selected' : ''}>Gris</option>
        </select>

        <input 
          type="text" 
          value="${escapeHtml(st.name)}" 
          onchange="renameStatus('${st.id}', this.value)" 
          class="flex-1 bg-transparent border-0 border-b border-transparent hover:border-resolve-border focus:border-resolve-accent focus:ring-0 text-xs text-white font-bold px-1"
        />

        <span class="text-[10px] text-resolve-dimText whitespace-nowrap" title="OTs activas con este estado">
          (${count} OTs)
        </span>

        <button 
          onclick="deleteStatusAction('${st.id}')" 
          title="Eliminar estado" 
          class="p-1 hover:text-red-400 text-resolve-dimText transition-colors"
        >
          ✕
        </button>
      </div>
    `;
  }).join('');
}

export function handleCreateStatus(e) {
  if (e) e.preventDefault();
  if (typeof document === 'undefined') return;

  const nameInput = document.getElementById('new-status-name');
  const colorSelect = document.getElementById('new-status-color');
  const name = (nameInput ? nameInput.value : '').trim();
  const color = colorSelect ? colorSelect.value : 'stone';
  if (!name) return;

  const statuses = getStatuses();
  if (statuses.some(s => s.name.toLowerCase() === name.toLowerCase())) {
    if (typeof window !== 'undefined') window.alert("Ya existe un estado con ese nombre.");
    return;
  }

  statuses.push({
    id: 'st-' + Date.now(),
    name: name,
    color: color
  });

  saveStatuses(statuses);
  if (nameInput) nameInput.value = '';

  if (state.activeOtId) {
    updateActiveOtField('responsibleDept', name);
    const sel = document.getElementById('modal-ot-status');
    if (sel) sel.value = name;
  }

  renderStatusManagerList();
  renderStatusSelects();
  refreshAllViews();
}

export function renameStatus(id, newName) {
  newName = (newName || '').trim();
  if (!newName) return;

  const statuses = getStatuses();
  const st = statuses.find(s => s.id === id);
  if (!st || st.name === newName) return;

  const oldName = st.name;
  st.name = newName;

  const orders = getOrders();
  orders.forEach(ot => {
    if ((ot.responsibleDept || '').toLowerCase() === oldName.toLowerCase()) {
      ot.responsibleDept = newName;
    }
    if ((ot.otStatus || '').toLowerCase() === oldName.toLowerCase()) {
      ot.otStatus = newName;
    }
  });
  saveOrders(orders);
  saveStatuses(statuses);

  renderStatusManagerList();
  renderStatusSelects();
  refreshAllViews();
}

export function updateStatusColor(id, newColor) {
  const statuses = getStatuses();
  const st = statuses.find(s => s.id === id);
  if (!st) return;
  st.color = newColor;
  saveStatuses(statuses);

  renderStatusManagerList();
  renderStatusSelects();
  refreshAllViews();
}

export function deleteStatusAction(id) {
  const statuses = getStatuses();
  if (statuses.length <= 1) {
    if (typeof window !== 'undefined') window.alert("Debe existir al menos un estado de tráfico.");
    return;
  }

  const st = statuses.find(s => s.id === id);
  if (!st) return;

  const orders = getOrders();
  const count = orders.filter(o => (o.responsibleDept || '').toLowerCase() === st.name.toLowerCase() || (o.otStatus || '').toLowerCase() === st.name.toLowerCase()).length;
  if (count > 0) {
    if (typeof window !== 'undefined' && !window.confirm(`Hay ${count} OTs con el estado "${st.name}". ¿Deseas eliminarlo? Las OTs pasarán al estado "Tráfico".`)) {
      return;
    }
    orders.forEach(o => {
      if ((o.responsibleDept || '').toLowerCase() === st.name.toLowerCase()) {
        o.responsibleDept = "Tráfico";
      }
      if ((o.otStatus || '').toLowerCase() === st.name.toLowerCase()) {
        o.otStatus = "Abierta";
        o.responsibleDept = "Tráfico";
      }
    });
    saveOrders(orders);
  } else {
    if (typeof window !== 'undefined' && !window.confirm(`¿Eliminar el estado "${st.name}"?`)) return;
  }

  const filtered = statuses.filter(s => s.id !== id);
  saveStatuses(filtered);

  renderStatusManagerList();
  renderStatusSelects();
  refreshAllViews();
}

// ============================================================================
// 7. RESPALDOS & RESTAURACIÓN JSON
// ============================================================================

export function exportBackupData() {
  const backup = {
    app: "ElMarcanteTrafficControl",
    version: "2.3",
    date: new Date().toISOString(),
    clients: getClients(),
    orders: getOrders(),
    statuses: getStatuses(),
    responsibles: getResponsibles(),
    stripboard: getAllStripboardStorage()
  };

  if (typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Respaldo_OTs_ElMarcante_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function importBackupData(event) {
  if (state.memberRole !== 'owner') return;
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.orders && parsed.clients) {
        saveOrders(parsed.orders);
        saveClients(parsed.clients);
        if (parsed.statuses) saveStatuses(parsed.statuses);
        if (parsed.responsibles) localStorage.setItem(RESPONSIBLES_STORAGE_KEY, JSON.stringify(parsed.responsibles));
        if (parsed.stripboard) localStorage.setItem(STRIPBOARD_STORAGE_KEY, JSON.stringify(parsed.stripboard));

        renderStatusSelects();
        renderResponsibleSelects();
        renderBinTree();
        renderTrafficDesk();
        updateClientsDatalist();
        updateDeptOptionsDatalist();
        renderStripboard();
        if (typeof window !== 'undefined') window.alert("Respaldo restaurado con éxito.");
      } else {
        if (typeof window !== 'undefined') window.alert("Archivo de respaldo inválido.");
      }
    } catch (err) {
      if (typeof window !== 'undefined') window.alert("Error al parsear el archivo JSON.");
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ============================================================================
// SUSCRIPCIÓN A EVENTOS DEL EVENTBUS
// ============================================================================
on('modal:open-envelope', e => {
  if (e && e.detail && e.detail.otId) {
    openEnvelopeModal(e.detail.otId);
  }
});

on('modal:open-client', e => {
  openClientModal(e && e.detail ? e.detail.clientId : null);
});

on('modal:open-brand', e => {
  if (e && e.detail) {
    openBrandModal(e.detail.clientName, e.detail.brand || null);
  }
});

on('modal:open-custom-task', e => {
  if (e && e.detail) {
    openCustomTaskModal(e.detail.index, e.detail.dateStr);
  }
});

// ============================================================================
// MODAL: PERFIL DE USUARIO, AVATAR, FIRMA OPERATIVA Y SEGURIDAD
// ============================================================================

let currentProfileDraft = null;
let lastLoadedOrgMembers = [];

export function openUserProfileModal() {
  const profile = getUserProfile();
  currentProfileDraft = {
    fullName: profile.fullName || '',
    shortName: profile.shortName || deriveShortName(profile.fullName) || 'Usuario',
    email: profile.email || '',
    phone: profile.phone || '',
    color: profile.color || 'cyan',
    avatarMode: profile.avatarMode || 'initials',
    avatarIcon: profile.avatarIcon || 'pen',
    avatarImage: profile.avatarImage || '',
    departments: Array.isArray(profile.departments) && profile.departments.length > 0
      ? [...profile.departments]
      : ['Tráfico']
  };

  const modal = document.getElementById('user-profile-modal');
  if (!modal) return;

  const fnInput = document.getElementById('user-modal-fullname');
  const snInput = document.getElementById('user-modal-shortname');
  const emInput = document.getElementById('user-modal-email');
  const phInput = document.getElementById('user-modal-phone');
  const feedback = document.getElementById('user-password-feedback');
  const pwdDetails = document.getElementById('user-password-details');

  if (fnInput) fnInput.value = currentProfileDraft.fullName;
  if (snInput) snInput.value = currentProfileDraft.shortName;
  if (emInput) emInput.value = currentProfileDraft.email;
  if (phInput) phInput.value = currentProfileDraft.phone;
  if (feedback) {
    feedback.className = 'hidden';
    feedback.innerHTML = '';
  }
  if (pwdDetails) {
    pwdDetails.open = false;
    const curr = document.getElementById('user-modal-current-password');
    const newP = document.getElementById('user-modal-new-password');
    const confP = document.getElementById('user-modal-confirm-password');
    if (curr) curr.value = '';
    if (newP) newP.value = '';
    if (confP) confP.value = '';
  }

  const canViewTeamTab = state.memberRole === 'owner' || state.memberRole === 'member';
  const teamTabBtn = document.getElementById('user-modal-tab-team-btn');
  if (teamTabBtn) {
    teamTabBtn.classList.toggle('hidden', !canViewTeamTab);
  }

  const roleBadgeEl = document.getElementById('user-profile-role-badge');
  const scopeLabelEl = document.getElementById('user-profile-scope-label');
  if (roleBadgeEl) {
    if (state.memberRole === 'owner') {
      roleBadgeEl.innerText = 'Dueño';
      roleBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 border border-sky-500/30 text-sky-300';
    } else if (state.memberRole === 'client') {
      roleBadgeEl.innerText = 'Cliente';
      roleBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-300';
    } else {
      roleBadgeEl.innerText = 'Colaborador';
      roleBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300';
    }
  }
  if (scopeLabelEl) {
    if (state.allowedClientId && state.allowedClientId !== '*') {
      const assignedClient = getClients().find((c) => c.id === state.allowedClientId);
      scopeLabelEl.innerText = assignedClient ? assignedClient.name : state.allowedClientId;
    } else {
      scopeLabelEl.innerText = 'Todo el estudio';
    }
  }

  renderUserProfileModalUI();
  switchUserProfileTab('profile');
  modal.classList.remove('hidden');
}

export function closeUserProfileModal() {
  const modal = document.getElementById('user-profile-modal');
  if (modal) modal.classList.add('hidden');
  currentProfileDraft = null;
}

export function handleUserProfileInputChange() {
  if (!currentProfileDraft) return;
  const fnInput = document.getElementById('user-modal-fullname');
  const snInput = document.getElementById('user-modal-shortname');
  const emInput = document.getElementById('user-modal-email');
  const phInput = document.getElementById('user-modal-phone');

  if (fnInput) currentProfileDraft.fullName = fnInput.value;
  if (snInput) currentProfileDraft.shortName = snInput.value;
  if (emInput) currentProfileDraft.email = emInput.value;
  if (phInput) currentProfileDraft.phone = phInput.value;

  if (currentProfileDraft.avatarMode === 'initials') {
    renderUserProfileModalAvatarPreview();
  }
}

export function renderUserProfileModalAvatarPreview() {
  if (!currentProfileDraft) return;
  const preview = document.getElementById('user-modal-avatar-preview');
  if (preview) {
    preview.innerHTML = renderUserAvatarHtml('w-16 h-16 text-lg font-bold shadow-md', currentProfileDraft);
  }
}

export function renderUserProfileModalUI() {
  if (!currentProfileDraft) return;

  // 1. Color activo y Header Indicator
  const activeColor = CLIENT_COLOR_PALETTE.find(p => p.name === currentProfileDraft.color) || CLIENT_COLOR_PALETTE[0];
  const headerIndicator = document.getElementById('user-modal-header-indicator');
  if (headerIndicator) {
    headerIndicator.style.backgroundColor = activeColor.hex;
  }

  // 2. Avatar Preview
  renderUserProfileModalAvatarPreview();

  // 3. Botones de Selección de Modo (Pestañas)
  const modeInitialsBtn = document.getElementById('user-avatar-mode-initials');
  const modeIconBtn = document.getElementById('user-avatar-mode-icon');
  const modeImageBtn = document.getElementById('user-avatar-mode-image');

  const activeTabClass = 'bg-sky-500/20 text-sky-300 border-sky-500/40 font-semibold shadow-sm';
  const inactiveTabClass = 'bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border-white/[0.08]';

  if (modeInitialsBtn) {
    modeInitialsBtn.className = `flex-1 py-1.5 text-xs rounded-lg border transition-all cursor-pointer ${currentProfileDraft.avatarMode === 'initials' ? activeTabClass : inactiveTabClass}`;
  }
  if (modeIconBtn) {
    modeIconBtn.className = `flex-1 py-1.5 text-xs rounded-lg border transition-all cursor-pointer ${currentProfileDraft.avatarMode === 'icon' ? activeTabClass : inactiveTabClass}`;
  }
  if (modeImageBtn) {
    modeImageBtn.className = `flex-1 py-1.5 text-xs rounded-lg border transition-all cursor-pointer ${currentProfileDraft.avatarMode === 'image' ? activeTabClass : inactiveTabClass}`;
  }

  // 4. Contenido específico según el Modo
  const iconGridContainer = document.getElementById('user-avatar-icon-selector');
  const imageUploadContainer = document.getElementById('user-avatar-image-selector');
  const initialsNotice = document.getElementById('user-avatar-initials-notice');

  if (iconGridContainer) {
    if (currentProfileDraft.avatarMode === 'icon') {
      iconGridContainer.classList.remove('hidden');
      iconGridContainer.innerHTML = Object.keys(USER_AVATAR_ICONS).map(key => {
        const iconDef = USER_AVATAR_ICONS[key];
        const isSelected = currentProfileDraft.avatarIcon === key;
        return `
          <button 
            type="button" 
            onclick="selectUserProfileAvatarIcon('${key}')" 
            title="${escapeHtml(iconDef.label)}"
            class="h-9 rounded-lg flex items-center justify-center p-2 transition-all cursor-pointer border ${isSelected ? 'border-sky-400 ring-2 ring-sky-400/50 bg-sky-500/10 text-sky-300 scale-105' : 'border-white/[0.08] hover:border-white/30 text-zinc-400 hover:text-zinc-200 bg-black/30'}"
          >
            <div class="w-5 h-5 flex items-center justify-center">${iconDef.svg}</div>
          </button>
        `;
      }).join('');
    } else {
      iconGridContainer.classList.add('hidden');
    }
  }

  if (imageUploadContainer) {
    if (currentProfileDraft.avatarMode === 'image') {
      imageUploadContainer.classList.remove('hidden');
      const hasImage = !!currentProfileDraft.avatarImage;
      imageUploadContainer.innerHTML = `
        <div class="flex items-center gap-2">
          <button 
            type="button" 
            onclick="document.getElementById('user-profile-photo-input').click()" 
            class="px-3 py-1.5 bg-white/[0.08] hover:bg-sky-500/15 hover:text-sky-300 text-zinc-200 border border-white/[0.12] rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
          >
            ${lucideIcon('image', 'w-[15px] h-[15px]')}
            <span>${hasImage ? 'Cambiar Foto' : 'Subir Imagen'}</span>
          </button>
          ${hasImage ? `
            <button 
              type="button" 
              onclick="setUserProfileAvatarMode('initials'); currentProfileDraft.avatarImage = ''; renderUserProfileModalUI();" 
              class="px-2.5 py-1.5 text-rose-400 hover:bg-rose-500/10 border border-rose-500/30 rounded-lg text-xs transition-colors cursor-pointer"
            >
              Quitar
            </button>
          ` : ''}
        </div>
      `;
    } else {
      imageUploadContainer.classList.add('hidden');
    }
  }

  if (initialsNotice) {
    if (currentProfileDraft.avatarMode === 'initials') {
      initialsNotice.classList.remove('hidden');
    } else {
      initialsNotice.classList.add('hidden');
    }
  }

  // 5. Paleta de Colores
  const colorContainer = document.getElementById('user-modal-color-container');
  const colorLabel = document.getElementById('user-modal-color-label');
  if (colorLabel) {
    colorLabel.innerText = activeColor.label || activeColor.name;
    colorLabel.className = `text-[10px] font-semibold ${activeColor.text}`;
  }
  if (colorContainer) {
    colorContainer.innerHTML = CLIENT_COLOR_PALETTE.map(item => {
      const isSelected = item.name === currentProfileDraft.color;
      return `
        <button 
          type="button" 
          onclick="selectUserProfileColor('${item.name}')" 
          title="${escapeHtml(item.label || item.name)}"
          class="h-7 rounded-md flex items-center justify-center gap-1.5 px-1.5 transition-all cursor-pointer border ${isSelected ? 'border-white ring-2 ring-sky-400/60 shadow-sm scale-[1.03] ' + item.bg : 'border-white/[0.08] hover:border-white/30 opacity-70 hover:opacity-100 bg-white/[0.02]'}"
        >
          <span class="w-2.5 h-2.5 rounded-full ${item.dot} shrink-0"></span>
          <span class="text-[9px] font-medium truncate ${item.text}">${escapeHtml(item.label || item.name)}</span>
        </button>
      `;
    }).join('');
  }

  // 6. Departamentos
  renderUserProfileDepartments();
}

export function setUserProfileAvatarMode(mode) {
  if (!currentProfileDraft) return;
  currentProfileDraft.avatarMode = mode;
  if (mode === 'image' && !currentProfileDraft.avatarImage) {
    const fileInput = document.getElementById('user-profile-photo-input');
    if (fileInput) fileInput.click();
  }
  renderUserProfileModalUI();
}

export function selectUserProfileAvatarIcon(iconKey) {
  if (!currentProfileDraft) return;
  currentProfileDraft.avatarIcon = iconKey;
  renderUserProfileModalUI();
}

export function selectUserProfileColor(colorName) {
  if (!currentProfileDraft) return;
  currentProfileDraft.color = colorName;
  renderUserProfileModalUI();
}

export function handleUserProfilePhotoUpload(event) {
  if (!currentProfileDraft || !event || !event.target || !event.target.files || !event.target.files[0]) return;
  const file = event.target.files[0];
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      currentProfileDraft.avatarImage = dataUrl;
      currentProfileDraft.avatarMode = 'image';
      renderUserProfileModalUI();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

export function renderUserProfileDepartments() {
  if (!currentProfileDraft) return;
  const container = document.getElementById('user-modal-departments-container');
  if (!container) return;

  const isOwner = state.memberRole === 'owner';
  const allDepts = getDepartments();
  const selectedDepts = currentProfileDraft.departments || [];

  if (!isOwner) {
    container.innerHTML = `
      ${selectedDepts.map(dept => `
        <span class="px-2.5 py-1 rounded-md text-[11px] border bg-sky-500/15 text-sky-300 border-sky-500/40 font-semibold flex items-center gap-1.5 select-none">
          <span>✓</span>
          <span>${escapeHtml(dept)}</span>
        </span>
      `).join('')}
      <span class="w-full text-[10px] text-zinc-500 mt-1">Asignados por el Dueño del estudio (solo lectura).</span>
    `;
    return;
  }

  container.innerHTML = `
    ${allDepts.map(dept => {
      const isSelected = selectedDepts.includes(dept);
      return `
        <button 
          type="button" 
          onclick="toggleUserProfileDepartment('${escapeHtml(dept)}')" 
          class="px-2.5 py-1 rounded-md text-[11px] border transition-all cursor-pointer flex items-center gap-1.5 ${isSelected ? 'bg-sky-500/20 text-sky-300 border-sky-500/50 font-semibold' : 'bg-white/[0.04] text-zinc-400 border-white/[0.08] hover:text-zinc-200'}"
        >
          <span>${isSelected ? '✓' : '+'}</span>
          <span>${escapeHtml(dept)}</span>
        </button>
      `;
    }).join('')}
    <button 
      type="button" 
      onclick="promptAddUserProfileDepartment()" 
      class="px-2.5 py-1 rounded-md text-[11px] border border-dashed border-white/[0.20] text-zinc-400 hover:text-sky-300 hover:border-sky-400/50 bg-white/[0.02] transition-colors cursor-pointer"
    >
      + Nuevo Depto.
    </button>
  `;
}

export function toggleUserProfileDepartment(deptName) {
  if (state.memberRole !== 'owner') return;
  if (!currentProfileDraft) return;
  if (!Array.isArray(currentProfileDraft.departments)) {
    currentProfileDraft.departments = [];
  }
  const idx = currentProfileDraft.departments.indexOf(deptName);
  if (idx !== -1) {
    if (currentProfileDraft.departments.length > 1) {
      currentProfileDraft.departments.splice(idx, 1);
    }
  } else {
    currentProfileDraft.departments.push(deptName);
  }
  renderUserProfileDepartments();
}

export function promptAddUserProfileDepartment() {
  if (state.memberRole !== 'owner') return;
  if (typeof window === 'undefined') return;
  const newName = window.prompt("Nombre del nuevo departamento / área:");
  if (newName && newName.trim()) {
    const clean = addDepartment(newName.trim());
    if (currentProfileDraft) {
      if (!currentProfileDraft.departments.includes(clean)) {
        currentProfileDraft.departments.push(clean);
      }
      renderUserProfileDepartments();
    }
  }
}

export async function handleUserChangePassword() {
  const feedback = document.getElementById('user-password-feedback');
  const currInput = document.getElementById('user-modal-current-password');
  const newInput = document.getElementById('user-modal-new-password');
  const confInput = document.getElementById('user-modal-confirm-password');
  const btn = document.getElementById('user-modal-update-pwd-btn');

  const currentPassword = currInput ? currInput.value : '';
  const newPassword = newInput ? newInput.value : '';
  const confirmPassword = confInput ? confInput.value : '';

  const showFeedback = (msg, type = 'error') => {
    if (!feedback) return;
    feedback.className = `p-2.5 rounded-lg border text-xs font-medium mb-3 ${type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border-rose-500/30 text-rose-300'}`;
    feedback.innerHTML = msg;
  };

  if (!currentPassword) {
    showFeedback('Ingresa tu contraseña actual.');
    return;
  }
  if (!newPassword || newPassword.length < 8) {
    showFeedback('La nueva contraseña debe tener al menos 8 caracteres.');
    return;
  }
  if (newPassword !== confirmPassword) {
    showFeedback('La nueva contraseña y su confirmación no coinciden.');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Actualizando...';
  }

  try {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        revokeOtherSessions: false
      })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showFeedback('Contraseña actualizada con éxito.', 'success');
      if (currInput) currInput.value = '';
      if (newInput) newInput.value = '';
      if (confInput) confInput.value = '';
    } else {
      showFeedback(data.message || data.error || 'No se pudo actualizar la contraseña. Revisa la contraseña actual.');
    }
  } catch (err) {
    showFeedback('No se pudo conectar con el servidor de autenticación (Modo Offline o sesión expirada).');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Actualizar Contraseña';
    }
  }
}

export async function handleSaveUserProfile(event) {
  if (event) event.preventDefault();
  if (!currentProfileDraft) return;

  const fnInput = document.getElementById('user-modal-fullname');
  const snInput = document.getElementById('user-modal-shortname');
  const emInput = document.getElementById('user-modal-email');
  const phInput = document.getElementById('user-modal-phone');

  if (fnInput) currentProfileDraft.fullName = fnInput.value.trim();
  if (snInput) currentProfileDraft.shortName = snInput.value.trim() || deriveShortName(currentProfileDraft.fullName) || 'Usuario';
  if (emInput) currentProfileDraft.email = emInput.value.trim();
  if (phInput) currentProfileDraft.phone = phInput.value.trim();

  if (!currentProfileDraft.departments || currentProfileDraft.departments.length === 0) {
    currentProfileDraft.departments = ['Tráfico'];
  }

  await saveUserProfile(currentProfileDraft);

  if (typeof window.updateUserPill === 'function') {
    window.updateUserPill(getCurrentUser());
  }

  refreshAllViews();
  closeUserProfileModal();
}

export function switchUserProfileTab(tabKey = 'profile') {
  if (tabKey === 'team' && state.memberRole === 'client') {
    tabKey = 'profile';
  }
  const profileTabBtn = document.getElementById('user-modal-tab-profile-btn');
  const teamTabBtn = document.getElementById('user-modal-tab-team-btn');
  const profileView = document.getElementById('user-modal-view-profile');
  const teamView = document.getElementById('user-modal-view-team');

  const activeClass = 'flex-1 py-1.5 text-xs rounded-lg font-semibold transition-all cursor-pointer bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm';
  const inactiveClass = 'flex-1 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer bg-white/[0.04] text-zinc-400 hover:text-zinc-200 border border-white/[0.08]';

  if (tabKey === 'team') {
    if (profileTabBtn) profileTabBtn.className = inactiveClass;
    if (teamTabBtn) teamTabBtn.className = activeClass;
    if (profileView) profileView.classList.add('hidden');
    if (teamView) teamView.classList.remove('hidden');
    loadTeamTabUI();
  } else {
    if (profileTabBtn) profileTabBtn.className = activeClass;
    if (teamTabBtn) teamTabBtn.className = inactiveClass;
    if (profileView) profileView.classList.remove('hidden');
    if (teamView) teamView.classList.add('hidden');
  }
}

export async function loadTeamTabUI() {
  const inviteBox = document.getElementById('user-modal-invite-box');
  const invContainer = document.getElementById('user-team-invitations-container');
  const isViewerOwner = state.memberRole === 'owner';
  if (state.memberRole === 'client') {
    if (inviteBox) inviteBox.classList.add('hidden');
    if (invContainer) invContainer.classList.add('hidden');
    return;
  }
  if (inviteBox) inviteBox.classList.toggle('hidden', !isViewerOwner);
  if (!isViewerOwner && invContainer) invContainer.classList.add('hidden');

  const orgNameEl = document.getElementById('user-modal-org-name');
  const orgSlugEl = document.getElementById('user-modal-org-slug');
  const orgQuotaEl = document.getElementById('user-modal-org-quota');
  const orgRoleEl = document.getElementById('user-modal-org-role-badge');
  const membersListEl = document.getElementById('user-team-members-list');
  const invListEl = document.getElementById('user-team-invitations-list');

  if (membersListEl) {
    membersListEl.innerHTML = '<div class="text-[11px] text-zinc-500 py-3 text-center">Cargando miembros del espacio...</div>';
  }

  const org = await fetchFullOrganization();
  const user = getCurrentUser();

  if (org) {
    if (orgNameEl) orgNameEl.innerText = org.name || 'Mi Espacio de Trabajo';
    if (orgSlugEl) orgSlugEl.innerText = org.slug || '--';

    const members = Array.isArray(org.members) ? org.members : [];
    lastLoadedOrgMembers = members;
    const activeTeamMembers = members.filter(m => m.status !== 'deactivated' && m.role !== 'client');
    if (orgQuotaEl) {
      orgQuotaEl.innerText = `${activeTeamMembers.length} / 6 miembros activos`;
    }

    const inviteClientSelect = document.getElementById('user-team-invite-client');
    if (inviteClientSelect) {
      const clientsList = getClients();
      inviteClientSelect.innerHTML = `<option value="">Selecciona cliente asignado...</option>` +
        clientsList.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    }

    const myMembership = user ? members.find(m => m.userId === user.id) : null;
    const isOwner = isViewerOwner && (myMembership ? myMembership.role === 'owner' : true);

    if (orgRoleEl) {
      if (isOwner) {
        orgRoleEl.innerText = 'Dueño';
        orgRoleEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 border border-sky-500/30 text-sky-300';
      } else {
        orgRoleEl.innerText = 'Colaborador';
        orgRoleEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/15 border border-cyan-500/30 text-cyan-300';
      }
    }

    // Renderizar miembros
    if (membersListEl) {
      if (members.length === 0) {
        membersListEl.innerHTML = '<div class="text-[11px] text-zinc-500 py-2">No hay miembros registrados aún.</div>';
      } else {
        membersListEl.innerHTML = members.map(m => {
          const mUser = m.user || {};
          const isCurrentUser = user && m.userId === user.id;
          const isDeactivated = m.status === 'deactivated';
          const memberProfile = {
            fullName: mUser.name || '',
            shortName: mUser.shortName || mUser.name || 'Usuario',
            email: mUser.email || '',
            color: mUser.color || 'cyan',
            avatarMode: mUser.avatarMode || 'initials',
            avatarIcon: mUser.avatarIcon || 'pen',
            avatarImage: mUser.image || '',
            departments: []
          };
          const isOwnerMember = m.role === 'owner';
          const canManage = isViewerOwner && isOwner && !isOwnerMember && !isCurrentUser;

          const statusPill = isDeactivated
            ? '<span class="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-600/50">Inactivo</span>'
            : '<span class="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Activo</span>';

          let memberDepts = ['Tráfico'];
          try {
            const parsed = typeof mUser.departments === 'string' ? JSON.parse(mUser.departments) : mUser.departments;
            if (Array.isArray(parsed) && parsed.length > 0) memberDepts = parsed;
          } catch {}
          const clientsList = getClients();
          const currentAllowed = m.allowedClientId || m.allowed_client_id || '*';
          const scopeObj = currentAllowed !== '*' ? clientsList.find(c => c.id === currentAllowed) : null;
          const scopeLabel = currentAllowed === '*' ? 'Todo el estudio' : (scopeObj ? scopeObj.name : currentAllowed);

          return `
            <div ${canManage ? `onclick="openTeamMemberDetailModal('${escapeHtml(m.id)}')" role="button" tabindex="0"` : ''} class="p-2.5 rounded-xl bg-black/40 border border-resolve-border/60 ${canManage ? 'cursor-pointer hover:border-sky-500/45 hover:bg-black/55 transition-all' : ''} ${isDeactivated ? 'opacity-65' : ''} space-y-2">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                  ${renderUserAvatarHtml('w-8 h-8 text-xs', memberProfile)}
                  <div class="min-w-0">
                    <div class="flex items-center gap-1.5 flex-wrap">
                      <span class="font-semibold text-white text-xs truncate">${escapeHtml(mUser.name || 'Sin nombre')}</span>
                      ${isCurrentUser ? '<span class="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.08] text-zinc-400 font-mono">Tú</span>' : ''}
                      ${statusPill}
                    </div>
                    <div class="text-[10px] text-zinc-400 truncate flex items-center gap-1.5 mt-0.5">
                      <span class="font-mono text-zinc-300">${escapeHtml(memberProfile.shortName)}</span>
                      <span class="text-zinc-600">•</span>
                      <span class="truncate">${escapeHtml(mUser.email || '')}</span>
                      ${mUser.phone ? `<span class="text-zinc-600">•</span><span class="font-mono text-zinc-300">${escapeHtml(mUser.phone)}</span>` : ''}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-1.5 shrink-0">
                  <span class="px-2 py-0.5 rounded-full text-[9px] font-semibold ${isOwnerMember ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30' : m.role === 'client' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-300 border border-zinc-700'}">
                    ${isOwnerMember ? 'Dueño' : m.role === 'client' ? 'Cliente' : 'Colaborador'}
                  </span>
                  ${canManage ? '<span class="text-[10px] text-sky-400/80 font-medium pl-1">Editar ›</span>' : ''}
                </div>
              </div>
              <div class="pt-1.5 border-t border-resolve-border/30 flex flex-wrap items-center justify-between gap-2 text-[10px]">
                <span class="text-zinc-400">Alcance: <strong class="text-zinc-200 font-medium">${escapeHtml(scopeLabel)}</strong></span>
                ${m.role !== 'client' ? `
                  <div class="flex flex-wrap items-center gap-1">
                    ${memberDepts.map(d => `<span class="px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/25 font-medium">${escapeHtml(d)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Renderizar invitaciones pendientes (solo Dueño)
    const invitations = Array.isArray(org.invitations) ? org.invitations.filter(i => i.status === 'pending') : [];
    if (invContainer && invListEl) {
      if (isViewerOwner && invitations.length > 0) {
        invContainer.classList.remove('hidden');
        invListEl.innerHTML = invitations.map(inv => {
          return `
            <div class="flex items-center justify-between p-2 rounded-xl bg-sky-500/[0.03] border border-sky-500/20 text-xs">
              <div class="min-w-0 pr-2">
                <div class="font-medium text-sky-200 truncate">${escapeHtml(inv.email)}</div>
                <div class="text-[10px] text-zinc-500">Pendiente de registro / aceptación</div>
              </div>
              <div class="flex items-center gap-1.5 shrink-0">
                <button 
                  type="button" 
                  data-email="${escapeHtml(inv.email)}"
                  data-role="${escapeHtml(inv.role || 'member')}"
                  onclick="handleResendTeamInvite(this.dataset.email, this.dataset.role, this)" 
                  class="px-2 py-1 bg-[#0BA2AC]/15 hover:bg-[#0BA2AC]/25 text-[#0BA2AC] border border-[#0BA2AC]/40 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                  title="Reenviar correo de invitación"
                >
                  Reenviar
                </button>
                <button 
                  type="button" 
                  onclick="handleCopyTeamInviteLink('${inv.id}', this)" 
                  class="px-2 py-1 bg-white/[0.08] hover:bg-sky-500/20 text-sky-300 border border-white/[0.12] hover:border-sky-500/40 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                  title="Copiar enlace de invitación"
                >
                  Copiar Link
                </button>
                <button 
                  type="button" 
                  onclick="handleCancelTeamInvite('${inv.id}')" 
                  class="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-[10px] font-medium transition-colors cursor-pointer"
                  title="Cancelar invitación"
                >
                  Cancelar
                </button>
              </div>
            </div>
          `;
        }).join('');
      } else {
        invContainer.classList.add('hidden');
        invListEl.innerHTML = '';
      }
    }
  } else {
    if (membersListEl) {
      membersListEl.innerHTML = '<div class="text-[11px] text-zinc-500 py-2">No se pudo cargar la información del espacio.</div>';
    }
  }
}

export function openTeamMemberDetailModal(memberId) {
  if (state.memberRole !== 'owner' || !memberId) return;
  const member = lastLoadedOrgMembers.find(m => m.id === memberId);
  if (!member) return;

  const modal = document.getElementById('team-member-detail-modal');
  if (!modal) return;

  const mUser = member.user || {};
  const isDeactivated = member.status === 'deactivated';
  const roleVal = member.role === 'client' ? 'client' : 'member';
  const currentAllowed = member.allowedClientId || member.allowed_client_id || '*';
  const memberProfile = {
    fullName: mUser.name || '',
    shortName: mUser.shortName || mUser.name || 'Usuario',
    email: mUser.email || '',
    color: mUser.color || 'cyan',
    avatarMode: mUser.avatarMode || 'initials',
    avatarIcon: mUser.avatarIcon || 'pen',
    avatarImage: mUser.image || '',
    departments: []
  };

  let memberDepts = ['Tráfico'];
  try {
    const parsed = typeof mUser.departments === 'string' ? JSON.parse(mUser.departments) : mUser.departments;
    if (Array.isArray(parsed) && parsed.length > 0) memberDepts = parsed;
  } catch {}

  const idEl = document.getElementById('team-member-modal-id');
  const avatarEl = document.getElementById('team-member-modal-avatar');
  const nameEl = document.getElementById('team-member-modal-name');
  const shortEl = document.getElementById('team-member-modal-shortname');
  const statusEl = document.getElementById('team-member-modal-status-badge');
  const emailEl = document.getElementById('team-member-modal-email');
  const phoneEl = document.getElementById('team-member-modal-phone');
  const roleEl = document.getElementById('team-member-modal-role');
  const clientEl = document.getElementById('team-member-modal-client');
  const deptsContainer = document.getElementById('team-member-modal-depts-container');
  const feedbackEl = document.getElementById('team-member-modal-feedback');
  const toggleBtn = document.getElementById('team-member-modal-toggle-status-btn');
  const removeBtn = document.getElementById('team-member-modal-remove-btn');

  if (idEl) idEl.value = member.id;
  if (avatarEl) avatarEl.innerHTML = renderUserAvatarHtml('w-10 h-10 text-sm', memberProfile);
  if (nameEl) nameEl.innerText = mUser.name || 'Sin nombre';
  if (shortEl) shortEl.innerText = memberProfile.shortName;
  if (statusEl) {
    statusEl.innerText = isDeactivated ? 'Inactivo' : 'Activo';
    statusEl.className = isDeactivated
      ? 'px-2 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-800 text-zinc-400 border border-zinc-600/50'
      : 'px-2 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30';
  }
  if (emailEl) emailEl.value = mUser.email || '';
  if (phoneEl) phoneEl.value = mUser.phone || '';
  if (roleEl) roleEl.value = roleVal;

  if (clientEl) {
    const clientsList = getClients();
    clientEl.innerHTML = `<option value="*" ${roleVal === 'client' ? 'disabled' : ''}>Todo el estudio (*)</option>` +
      clientsList.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    clientEl.value = currentAllowed;
  }

  if (deptsContainer) {
    const allDepts = getDepartments();
    deptsContainer.innerHTML = allDepts.map(d => `
      <label class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border border-white/10 bg-black/40 text-zinc-200 cursor-pointer hover:border-sky-500/40">
        <input type="checkbox" class="team-member-modal-dept-cb accent-sky-400" value="${escapeHtml(d)}" ${memberDepts.includes(d) ? 'checked' : ''} />
        <span>${escapeHtml(d)}</span>
      </label>
    `).join('');
  }

  if (feedbackEl) {
    feedbackEl.className = 'hidden';
    feedbackEl.innerText = '';
  }

  if (toggleBtn) {
    toggleBtn.innerText = isDeactivated ? 'Reactivar' : 'Desactivar';
    toggleBtn.className = isDeactivated
      ? 'px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
      : 'px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer bg-white/[0.06] hover:bg-sky-500/15 text-zinc-300 hover:text-sky-300 border-white/[0.12]';
    toggleBtn.onclick = async () => {
      await handleToggleMemberStatus(member.id, isDeactivated ? 'active' : 'deactivated');
      closeTeamMemberDetailModal();
    };
  }

  if (removeBtn) {
    removeBtn.onclick = () => {
      closeTeamMemberDetailModal();
      handleRequestRemoveMember(member.id, mUser.name || memberProfile.shortName, memberProfile.shortName);
    };
  }

  handleTeamMemberModalRoleChange(roleVal);
  modal.classList.remove('hidden');
}

export function closeTeamMemberDetailModal() {
  const modal = document.getElementById('team-member-detail-modal');
  if (modal) modal.classList.add('hidden');
}

export function handleTeamMemberModalRoleChange(nextRole) {
  const clientSelect = document.getElementById('team-member-modal-client');
  const deptsWrap = document.getElementById('team-member-modal-depts-wrap');
  if (clientSelect) {
    const allOpt = clientSelect.querySelector('option[value="*"]');
    if (allOpt) allOpt.disabled = nextRole === 'client';
    if (nextRole === 'client' && clientSelect.value === '*') {
      const firstSpecific = Array.from(clientSelect.options).find(o => o.value !== '*');
      if (firstSpecific) clientSelect.value = firstSpecific.value;
    }
  }
  if (deptsWrap) {
    deptsWrap.classList.toggle('hidden', nextRole === 'client');
  }
}

export async function saveTeamMemberDetailModal(event) {
  if (event) event.preventDefault();
  if (state.memberRole !== 'owner') return;

  const memberId = document.getElementById('team-member-modal-id')?.value || '';
  const phone = document.getElementById('team-member-modal-phone')?.value.trim() || '';
  const role = document.getElementById('team-member-modal-role')?.value || 'member';
  const allowedClientId = document.getElementById('team-member-modal-client')?.value || '*';
  const deptCheckboxes = document.querySelectorAll('.team-member-modal-dept-cb:checked');
  const departments = Array.from(deptCheckboxes).map(cb => cb.value).filter(Boolean);
  const feedbackEl = document.getElementById('team-member-modal-feedback');
  const saveBtn = document.getElementById('team-member-modal-save-btn');

  if (!memberId) return;
  if (role === 'client' && (!allowedClientId || allowedClientId === '*')) {
    if (feedbackEl) {
      feedbackEl.className = 'text-xs p-2 rounded-lg font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300';
      feedbackEl.innerText = 'Selecciona un cliente específico para el rol Cliente.';
    }
    return;
  }

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerText = 'Guardando...';
  }

  try {
    const res = await fetch('/api/studio/team/member/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId, role, allowedClientId, departments, phone })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      if (feedbackEl) {
        feedbackEl.className = 'text-xs p-2 rounded-lg font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300';
        feedbackEl.innerText = data.message || 'No se pudieron guardar los cambios.';
      }
    } else {
      closeTeamMemberDetailModal();
      await loadTeamTabUI();
    }
  } catch (err) {
    console.error('Error guardando detalle de miembro:', err);
    if (feedbackEl) {
      feedbackEl.className = 'text-xs p-2 rounded-lg font-medium bg-rose-500/10 border border-rose-500/30 text-rose-300';
      feedbackEl.innerText = 'Error de conexión al guardar permisos.';
    }
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerText = 'Guardar';
    }
  }
}

export function handleTeamMemberRoleChange(memberId, nextRole) {
  const clientSelect = document.getElementById(`team-member-client-${memberId}`);
  const deptsWrap = document.getElementById(`team-member-depts-wrap-${memberId}`);
  if (clientSelect) {
    const allOpt = clientSelect.querySelector('option[value="*"]');
    if (allOpt) allOpt.disabled = nextRole === 'client';
    if (nextRole === 'client' && clientSelect.value === '*') {
      const firstSpecific = Array.from(clientSelect.options).find(o => o.value !== '*');
      if (firstSpecific) clientSelect.value = firstSpecific.value;
    }
  }
  if (deptsWrap) {
    deptsWrap.classList.toggle('hidden', nextRole === 'client');
  }
}

export async function handleUpdateTeamMember(memberId, btnEl) {
  if (state.memberRole !== 'owner' || !memberId) return;
  const roleSelect = document.getElementById(`team-member-role-${memberId}`);
  const clientSelect = document.getElementById(`team-member-client-${memberId}`);
  const deptCheckboxes = document.querySelectorAll(`.team-member-dept-cb-${memberId}:checked`);

  const role = roleSelect ? roleSelect.value : 'member';
  const allowedClientId = clientSelect ? clientSelect.value : '*';
  const departments = Array.from(deptCheckboxes).map(cb => cb.value).filter(Boolean);

  if (role === 'client' && (!allowedClientId || allowedClientId === '*')) {
    alert('Selecciona un cliente específico para el rol Cliente.');
    return;
  }

  const origText = btnEl ? btnEl.innerText : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = 'Guardando...';
  }

  try {
    const res = await fetch('/api/studio/team/member/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId, role, allowedClientId, departments })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      alert(data.message || 'No se pudo actualizar el rol/privilegios del colaborador.');
    } else {
      await loadTeamTabUI();
    }
  } catch (err) {
    console.error('Error actualizando miembro:', err);
    alert('Error de conexión al guardar permisos.');
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerText = origText || 'Guardar Rol y Privilegios';
    }
  }
}

export function handleInviteRoleSelectChange(role) {
  const clientSelect = document.getElementById('user-team-invite-client');
  if (!clientSelect) return;
  if (role === 'client') {
    clientSelect.classList.remove('hidden');
    clientSelect.required = true;
  } else {
    clientSelect.classList.add('hidden');
    clientSelect.required = false;
  }
}

export async function handleSendTeamInvite(event) {
  if (event) event.preventDefault();
  if (state.memberRole !== 'owner') return;
  const emailInput = document.getElementById('user-team-invite-email');
  const roleSelect = document.getElementById('user-team-invite-role');
  const clientSelect = document.getElementById('user-team-invite-client');
  const feedbackEl = document.getElementById('user-team-invite-feedback');
  const btnEl = document.getElementById('user-team-invite-btn');

  const email = emailInput ? emailInput.value.trim() : '';
  const role = roleSelect ? roleSelect.value : 'member';
  const allowedClientId = role === 'client' ? (clientSelect?.value || '') : '*';
  if (!email) return;

  const showFeedback = (msg, isSuccess = false) => {
    if (!feedbackEl) return;
    feedbackEl.className = `text-xs p-2 rounded-lg font-medium ${isSuccess ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300' : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'}`;
    feedbackEl.innerText = msg;
    feedbackEl.classList.remove('hidden');
  };

  if (role === 'client' && !allowedClientId) {
    showFeedback('Selecciona el cliente asignado para el rol Cliente / Cuentas.');
    return;
  }

  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = 'Enviando...';
  }

  try {
    const res = await fetch('/api/auth/organization/invite-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, role, allowedClientId })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      showFeedback(`Invitación enviada a ${email}. También puedes copiar el enlace directo abajo.`, true);
      if (emailInput) emailInput.value = '';
      await loadTeamTabUI();
    } else {
      showFeedback(translateAuthError(data.message || data.error, 'No se pudo enviar la invitación (límite de miembros o error de permisos).'));
    }
  } catch (err) {
    showFeedback('Error de conexión al enviar la invitación.');
  } finally {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerText = 'Invitar';
    }
  }
}

export async function handleResendTeamInvite(email, role = 'member', btnEl = null) {
  if (state.memberRole !== 'owner' || !email) return;
  const orig = btnEl ? btnEl.innerText : '';
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerText = 'Enviando...';
  }
  try {
    const res = await fetch('/api/auth/organization/invite-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, role: role || 'member', resend: true })
    });
    if (res.ok) {
      if (btnEl) {
        btnEl.innerText = '¡Reenviado!';
        btnEl.classList.add('text-emerald-300');
        setTimeout(() => {
          btnEl.disabled = false;
          btnEl.innerText = orig || 'Reenviar';
          btnEl.classList.remove('text-emerald-300');
        }, 2200);
      }
    } else {
      const data = await res.json().catch(() => ({}));
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerText = orig || 'Reenviar';
      }
      window.alert(translateAuthError(data.message || data.error, 'No se pudo reenviar el correo de invitación.'));
    }
  } catch (err) {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerText = orig || 'Reenviar';
    }
    window.alert('Error de conexión al reenviar la invitación.');
  }
}

export async function handleCopyTeamInviteLink(inviteId, btnEl) {
  const inviteUrl = `${window.location.origin}/?invite=${inviteId}`;
  try {
    await navigator.clipboard.writeText(inviteUrl);
    if (btnEl) {
      const orig = btnEl.innerText;
      btnEl.innerText = '¡Copiado!';
      btnEl.classList.add('text-emerald-400');
      setTimeout(() => {
        btnEl.innerText = orig;
        btnEl.classList.remove('text-emerald-400');
      }, 2000);
    }
  } catch (e) {
    window.prompt('Copia este enlace de invitación:', inviteUrl);
  }
}

export async function handleCancelTeamInvite(invitationId) {
  if (state.memberRole !== 'owner') return;
  if (!confirm('¿Cancelar esta invitación?')) return;
  try {
    const res = await fetch('/api/auth/organization/cancel-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ invitationId })
    });
    if (res.ok) {
      await loadTeamTabUI();
    }
  } catch (err) {
    console.error('Error cancelando invitación:', err);
  }
}

export async function handleUserSignOut() {
  if (!confirm('¿Cerrar sesión en El Marcante?')) return;
  clearScopedLocalCache();
  try {
    await fetch('/api/auth/sign-out', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({})
    });
  } catch (e) {}
  await fetch('/api/logout-force', { method: 'POST', credentials: 'include' }).catch(() => {});
  window.location.reload();
}

export function togglePasswordVisibility(inputId, btn) {
  const input = typeof inputId === 'string' ? document.getElementById(inputId) : inputId;
  if (!input) return;
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  if (btn) {
    btn.innerHTML = isPassword ? `
      <svg class="w-3.5 h-3.5 text-sky-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>
      </svg>
    ` : `
      ${lucideIcon('eye', 'w-[15px] h-[15px]', 'text-zinc-400')}
    `;
  }
}

// ============================================================================
// MODAL ONBOARDING: NOMBRA TU ESTUDIO (PLG FORZOSO)
// ============================================================================
export function openOnboardingStudioModal() {
  const modal = document.getElementById('onboarding-studio-modal');
  if (!modal) return;

  const nameInput = document.getElementById('onboarding-studio-name');
  const slugInput = document.getElementById('onboarding-studio-slug');
  const errorEl = document.getElementById('onboarding-studio-error');
  const submitBtn = document.getElementById('onboarding-studio-submit-btn');

  if (nameInput) {
    nameInput.value = '';
    // Derivar slug en vivo
    nameInput.oninput = () => {
      if (slugInput) {
        slugInput.value = nameInput.value
          .toLowerCase()
          .trim()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }
    };
  }
  if (slugInput) slugInput.value = '';
  if (errorEl) {
    errorEl.classList.add('hidden');
    errorEl.innerText = '';
  }
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span>Comenzar Prueba Gratuita (14 Días)</span><span class="text-sm font-black">→</span>`;
  }

  modal.classList.remove('hidden');
  setTimeout(() => {
    if (nameInput) nameInput.focus();
  }, 50);
}

export function closeOnboardingStudioModal() {
  const modal = document.getElementById('onboarding-studio-modal');
  if (modal) modal.classList.add('hidden');
}

export async function handleCreateStudioOnboarding(event) {
  if (event) event.preventDefault();

  const nameInput = document.getElementById('onboarding-studio-name');
  const slugInput = document.getElementById('onboarding-studio-slug');
  const errorEl = document.getElementById('onboarding-studio-error');
  const submitBtn = document.getElementById('onboarding-studio-submit-btn');

  const name = nameInput ? nameInput.value.trim() : '';
  let slug = slugInput ? slugInput.value.trim() : '';

  if (!name) {
    if (errorEl) {
      errorEl.innerText = 'Por favor ingresa un nombre para tu estudio o agencia.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (!slug) {
    slug = name
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!slug) {
    slug = 'estudio-' + Date.now().toString(36);
  }

  try {
    if (errorEl) {
      errorEl.classList.add('hidden');
      errorEl.innerText = '';
    }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-black" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Creando tu espacio...</span>
      `;
    }

    // 1. Invocar endpoint nativo de Better Auth para crear organización
    const res = await fetch('/api/auth/organization/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, slug })
    });

    const orgData = await res.json().catch(() => null);

    if (!res.ok || !orgData || !orgData.id) {
      const msg = orgData?.message || orgData?.error || 'No se pudo crear el estudio. Intenta con otro nombre.';
      throw new Error(msg);
    }

    // 2. Fijar la organización recién creada como activa
    await fetch('/api/auth/organization/set-active', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ organizationId: orgData.id })
    }).catch(() => {});

    // 3. Cerrar modal y ejecutar bootstrap limpio
    closeOnboardingStudioModal();
    await bootstrap();
  } catch (err) {
    console.error('Error en creación de estudio onboarding:', err);
    if (errorEl) {
      errorEl.innerText = err.message || 'Error al crear el estudio. Intenta nuevamente.';
      errorEl.classList.remove('hidden');
    }
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `<span>Comenzar Prueba Gratuita (14 Días)</span><span class="text-sm font-black">→</span>`;
    }
  }
}

// ============================================================================
// MODAL DE SUSCRIPCIÓN / PAYWALL BOLD
// ============================================================================
export function openSubscriptionPaywallModal(isBlocking = false) {
  const modal = document.getElementById('subscription-paywall-modal');
  if (!modal) return;

  modal.dataset.blocking = isBlocking ? 'true' : 'false';

  const closeBtn = document.getElementById('subscription-modal-close-btn');
  if (closeBtn) {
    if (isBlocking) {
      closeBtn.classList.add('hidden');
    } else {
      closeBtn.classList.remove('hidden');
    }
  }

  const org = getCurrentOrganization();
  const orgNameEl = document.getElementById('subscription-modal-org-name');
  const daysTextEl = document.getElementById('subscription-modal-days-text');
  const statusBadgeEl = document.getElementById('subscription-modal-status-badge');
  const titleEl = document.getElementById('subscription-modal-title');
  const subtitleEl = document.getElementById('subscription-modal-subtitle');
  const checkoutBtn = document.getElementById('paywall-bold-checkout-btn');

  if (orgNameEl) {
    orgNameEl.innerText = (org && org.name) || 'Mi Estudio';
  }

  const subStatus = (org && org.subscriptionStatus) || 'trialing';
  const trialDaysLeft = typeof (org && org.trialDaysLeft) === 'number' ? org.trialDaysLeft : 14;

  if (subStatus === 'active') {
    if (statusBadgeEl) {
      statusBadgeEl.innerText = 'PLAN PRO ACTIVO';
      statusBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 border border-cyan-500/25 text-cyan-300';
    }
    if (daysTextEl) {
      daysTextEl.innerText = 'Suscripción Pro Activa';
      daysTextEl.className = 'font-bold text-cyan-400 text-xs';
    }
    if (titleEl) titleEl.innerText = 'Trafigator Plan Pro';
    if (subtitleEl) subtitleEl.innerText = 'Tu espacio cuenta con todas las funciones Pro habilitadas.';
    if (checkoutBtn) {
      checkoutBtn.innerHTML = `<span>Gestionar Suscripción con Bold</span><span class="text-sm font-black">→</span>`;
    }
  } else if (trialDaysLeft <= 0) {
    if (statusBadgeEl) {
      statusBadgeEl.innerText = 'PRUEBA FINALIZADA';
      statusBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 border border-rose-500/25 text-rose-300';
    }
    if (daysTextEl) {
      daysTextEl.innerText = '0 días restantes (Expirado)';
      daysTextEl.className = 'font-bold text-rose-400 text-xs';
    }
    if (titleEl) titleEl.innerText = 'Activa tu Suscripción Pro';
    if (subtitleEl) subtitleEl.innerText = 'Tu período de prueba de 14 días ha concluido. Activa tu plan con Bold para continuar editando tus OTs.';
    if (checkoutBtn) {
      checkoutBtn.innerHTML = `<span>Activar Plan Pro con Bold ($49 USD)</span><span class="text-sm font-black">→</span>`;
    }
  } else {
    if (statusBadgeEl) {
      statusBadgeEl.innerText = 'PRUEBA ACTIVA';
      statusBadgeEl.className = 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/10 border border-sky-500/25 text-sky-300';
    }
    if (daysTextEl) {
      daysTextEl.innerText = `${trialDaysLeft} ${trialDaysLeft === 1 ? 'día restante' : 'días restantes'}`;
      daysTextEl.className = 'font-bold text-sky-400 text-xs';
    }
    if (titleEl) titleEl.innerText = 'Trafigator Plan Pro';
    if (subtitleEl) subtitleEl.innerText = 'Impulsa el flujo de trabajo creativo de tu agencia con máxima capacidad.';
    if (checkoutBtn) {
      checkoutBtn.innerHTML = `<span>Activar Plan Pro con Bold ($49 USD)</span><span class="text-sm font-black">→</span>`;
    }
  }

  modal.classList.remove('hidden');
}

export function closeSubscriptionPaywallModal() {
  const modal = document.getElementById('subscription-paywall-modal');
  if (!modal) return;
  if (modal.dataset.blocking === 'true') {
    // Si el paywall es bloqueante, no permitir cierre sin activar
    return;
  }
  modal.classList.add('hidden');
}

export function handleBoldCheckoutClick() {
  const org = getCurrentOrganization();
  const orgId = org ? org.id : '';
  const boldBaseUrl = (typeof window !== 'undefined' && window.BOLD_CHECKOUT_URL) || 'https://checkout.bold.co/payment/LNK_TRAFIGATOR_PRO';
  const checkoutUrl = orgId ? `${boldBaseUrl}?reference=${encodeURIComponent(orgId)}` : boldBaseUrl;
  if (typeof window !== 'undefined') {
    window.open(checkoutUrl, '_blank');
  }
}

// ============================================================================
// GOBERNANZA DE EQUIPO: DESACTIVACIÓN Y REASIGNACIÓN SEGURA
// ============================================================================
export async function handleToggleMemberStatus(memberId, nextStatus) {
  if (state.memberRole !== 'owner' || !memberId || !nextStatus) return;
  try {
    const res = await fetch('/api/studio/team/member/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId, status: nextStatus })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      alert(data.message || 'No se pudo actualizar el estado del colaborador.');
      return;
    }
    await bootstrap();
    await loadTeamTabUI();
    refreshAllViews();
  } catch (err) {
    console.error('Error alternando estado de miembro:', err);
    alert('Error de conexión al actualizar estado.');
  }
}

export async function handleRequestRemoveMember(memberId, memberName, memberShortName) {
  if (state.memberRole !== 'owner' || !memberId) return;

  const orders = getOrders();
  const shortClean = (memberShortName || '').trim();
  const activeOrders = shortClean
    ? orders.filter(o => o.sign === shortClean && !isOtTerminal(o.otStatus))
    : [];

  let activeRoutesCount = 0;
  if (shortClean) {
    orders.forEach(o => {
      if (Array.isArray(o.routes)) {
        o.routes.forEach(r => {
          if (r.sign === shortClean && !r.locked) activeRoutesCount++;
        });
      }
    });
  }

  let activeStripsCount = 0;
  const sb = getAllStripboardStorage();
  if (shortClean && sb && typeof sb === 'object') {
    Object.values(sb).forEach(strips => {
      if (Array.isArray(strips)) {
        strips.forEach(st => {
          if (st.assignee === shortClean && st.shiftStatus !== 'Entregado') activeStripsCount++;
        });
      }
    });
  }

  if (activeOrders.length > 0 || activeRoutesCount > 0 || activeStripsCount > 0) {
    openMemberReassignModal(memberId, memberName, activeOrders.length, activeRoutesCount, activeStripsCount);
    return;
  }

  const confirmed = confirm(`¿Retirar definitivamente a ${memberName || 'este colaborador'} del equipo? Sus firmas históricas permanecerán intactas.`);
  if (!confirmed) return;

  try {
    const res = await fetch('/api/studio/team/member/reassign-and-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      if (data.error === 'reassignment_required') {
        openMemberReassignModal(
          memberId,
          memberName,
          data.activeWorkOrdersCount || 0,
          data.activeRoutesCount || 0,
          data.activeStripsCount || 0
        );
        return;
      }
      alert(data.message || 'No se pudo retirar al colaborador.');
      return;
    }
    await bootstrap();
    await loadTeamTabUI();
    refreshAllViews();
  } catch (err) {
    console.error('Error retirando miembro:', err);
    alert('Error de conexión al retirar colaborador.');
  }
}

export function openMemberReassignModal(memberId, memberName, ordersCount, routesCount, stripsCount) {
  const modal = document.getElementById('member-reassign-modal');
  const summaryEl = document.getElementById('member-reassign-summary');
  const targetInput = document.getElementById('member-reassign-target-id');
  const selectEl = document.getElementById('member-reassign-successor-select');
  const errorEl = document.getElementById('member-reassign-error');
  if (!modal || !targetInput || !selectEl) return;

  targetInput.value = memberId;
  if (errorEl) errorEl.classList.add('hidden');

  if (summaryEl) {
    const parts = [];
    if (ordersCount > 0) parts.push(`${ordersCount} OT(s) activas`);
    if (routesCount > 0) parts.push(`${routesCount} paso(s) de ruta`);
    if (stripsCount > 0) parts.push(`${stripsCount} tira(s) de stripboard`);
    summaryEl.innerHTML = `<strong>${escapeHtml(memberName || 'Este colaborador')}</strong> tiene ${parts.join(', ')} pendientes. Selecciona al miembro activo que asumirá estas responsabilidades antes de retirar su acceso.`;
  }

  const org = getCurrentOrganization();
  const members = Array.isArray(org?.members) ? org.members : [];
  const candidates = members.filter(m => m.id !== memberId && m.status !== 'deactivated');

  selectEl.innerHTML = candidates.length > 0
    ? candidates.map(m => {
        const u = m.user || {};
        const label = `${u.name || 'Sin nombre'} (${u.shortName || u.name || 'Usuario'})`;
        return `<option value="${escapeHtml(m.id)}">${escapeHtml(label)}</option>`;
      }).join('')
    : '<option value="">No hay otros miembros activos disponibles</option>';

  modal.classList.remove('hidden');
}

export function closeMemberReassignModal() {
  const modal = document.getElementById('member-reassign-modal');
  if (modal) modal.classList.add('hidden');
}

export async function handleConfirmReassignAndDelete(event) {
  if (event) event.preventDefault();
  const memberId = document.getElementById('member-reassign-target-id')?.value || '';
  const targetMemberId = document.getElementById('member-reassign-successor-select')?.value || '';
  const errorEl = document.getElementById('member-reassign-error');
  const submitBtn = document.getElementById('member-reassign-submit-btn');

  if (!memberId || !targetMemberId) {
    if (errorEl) {
      errorEl.innerText = 'Debes seleccionar un miembro activo sucesor.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = 'Transfiriendo...';
  }

  try {
    const res = await fetch('/api/studio/team/member/reassign-and-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ memberId, targetMemberId })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      if (errorEl) {
        errorEl.innerText = data.message || 'No se pudo completar la reasignación.';
        errorEl.classList.remove('hidden');
      }
      return;
    }

    closeMemberReassignModal();
    await bootstrap();
    await loadTeamTabUI();
    refreshAllViews();
  } catch (err) {
    if (errorEl) {
      errorEl.innerText = 'Error de conexión durante la reasignación.';
      errorEl.classList.remove('hidden');
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Transferir y Retirar Miembro';
    }
  }
}

// ============================================================================
// EXPOSICIÓN GLOBAL EN WINDOW PARA RETROCOMPATIBILIDAD
// ============================================================================
if (typeof window !== 'undefined') {
  window.togglePasswordVisibility = togglePasswordVisibility;
  window.openUserProfileModal = openUserProfileModal;
  window.closeUserProfileModal = closeUserProfileModal;
  window.handleUserProfileInputChange = handleUserProfileInputChange;
  window.renderUserProfileModalAvatarPreview = renderUserProfileModalAvatarPreview;
  window.renderUserProfileModalUI = renderUserProfileModalUI;
  window.setUserProfileAvatarMode = setUserProfileAvatarMode;
  window.selectUserProfileAvatarIcon = selectUserProfileAvatarIcon;
  window.selectUserProfileColor = selectUserProfileColor;
  window.handleUserProfilePhotoUpload = handleUserProfilePhotoUpload;
  window.renderUserProfileDepartments = renderUserProfileDepartments;
  window.toggleUserProfileDepartment = toggleUserProfileDepartment;
  window.promptAddUserProfileDepartment = promptAddUserProfileDepartment;
  window.handleUserChangePassword = handleUserChangePassword;
  window.handleSaveUserProfile = handleSaveUserProfile;
  window.handleUserSignOut = handleUserSignOut;
  window.handleInviteRoleSelectChange = handleInviteRoleSelectChange;
  window.reopenArchivedOt = reopenArchivedOt;
  window.switchUserProfileTab = switchUserProfileTab;
  window.loadTeamTabUI = loadTeamTabUI;
  window.handleSendTeamInvite = handleSendTeamInvite;
  window.handleTeamMemberRoleChange = handleTeamMemberRoleChange;
  window.handleUpdateTeamMember = handleUpdateTeamMember;
  window.openTeamMemberDetailModal = openTeamMemberDetailModal;
  window.closeTeamMemberDetailModal = closeTeamMemberDetailModal;
  window.handleTeamMemberModalRoleChange = handleTeamMemberModalRoleChange;
  window.saveTeamMemberDetailModal = saveTeamMemberDetailModal;
  window.handleCopyTeamInviteLink = handleCopyTeamInviteLink;
  window.handleResendTeamInvite = handleResendTeamInvite;
  window.handleCancelTeamInvite = handleCancelTeamInvite;
  window.handleToggleMemberStatus = handleToggleMemberStatus;
  window.handleRequestRemoveMember = handleRequestRemoveMember;
  window.openMemberReassignModal = openMemberReassignModal;
  window.closeMemberReassignModal = closeMemberReassignModal;
  window.handleConfirmReassignAndDelete = handleConfirmReassignAndDelete;
  window.openEnvelopeModal = openEnvelopeModal;
  window.closeEnvelopeModal = closeEnvelopeModal;
  window.toggleEnvelopeSection = toggleEnvelopeSection;
  window.switchOtTab = switchOtTab;
  window.updateActiveOtField = updateActiveOtField;
  window.deleteActiveOt = deleteActiveOt;
  window.renderModalStripboardWitness = renderModalStripboardWitness;
  window.jumpFromModalToStripboardDate = jumpFromModalToStripboardDate;
  window.removeStripFromModalWitness = removeStripFromModalWitness;
  window.scheduleActiveOtFromModal = scheduleActiveOtFromModal;
  window.renderRouteSheetRows = renderRouteSheetRows;
  window.addNewRouteRow = addNewRouteRow;
  window.updateRootOtField = updateRootOtField;
  window.updateRootOtDateField = updateRootOtDateField;
  window.handleRootStatusChange = handleRootStatusChange;
  window.handleRootResponsibleChange = handleRootResponsibleChange;
  window.toggleEnvelopeTaskTreeSidebar = toggleEnvelopeTaskTreeSidebar;
  window.selectEnvelopeTreeTask = selectEnvelopeTreeTask;
  window.updateActiveTaskTitle = updateActiveTaskTitle;
  window.createEnvelopeSubTask = createEnvelopeSubTask;
  window.updateRouteCell = updateRouteCell;
  window.updateRouteDateCell = updateRouteDateCell;
  window.handleRouteDeptChange = handleRouteDeptChange;
  window.handleRouteStatusChange = handleRouteStatusChange;
  window.handleRouteSignChange = handleRouteSignChange;
  window.stampCurrentTime = stampCurrentTime;
  window.toggleRouteRowLock = toggleRouteRowLock;
  window.toggleRouteDone = toggleRouteDone;
  window.removeRouteRow = removeRouteRow;
  window.deleteRouteRow = deleteRouteRow;
  window.openStampModal = openStampModal;
  window.closeStampModal = closeStampModal;
  window.applyStamp = applyStamp;
  window.clearCurrentStamp = clearCurrentStamp;
  window.setMediaPoolView = setMediaPoolView;
  window.setInlineEnvelopeMediaView = setInlineEnvelopeMediaView;
  window.renderMediaPool = renderMediaPool;
  window.handleMediaPoolUpload = handleMediaPoolUpload;
  window.promptAddMediaLink = promptAddMediaLink;
  window.removeMediaItem = removeMediaItem;
  window.renderInlineEnvelopeMedia = renderInlineEnvelopeMedia;
  window.toggleEnvelopeRouteGroup = toggleEnvelopeRouteGroup;
  window.updateRouteTaskTitle = updateRouteTaskTitle;
  window.toggleEnvelopeInspectorSidebar = toggleEnvelopeInspectorSidebar;
  window.setEnvelopeInspectorTab = setEnvelopeInspectorTab;
  window.selectBitacoraInspectorRow = selectBitacoraInspectorRow;
  window.updateRouteCellFromInspector = updateRouteCellFromInspector;
  window.stepEnvelopeTask = stepEnvelopeTask;
  window.syncInspectorTaskToStripboard = syncInspectorTaskToStripboard;
  window.closeInspectorTaskAsDone = closeInspectorTaskAsDone;
  window.cancelInspectorTask = cancelInspectorTask;
  window.duplicateInspectorTask = duplicateInspectorTask;
  window.deleteInspectorTask = deleteInspectorTask;
  window.deleteInspectorRowOrTask = deleteInspectorRowOrTask;
  window.renderEnvelopeInspector = renderEnvelopeInspector;
  window.syncOtStatusAndRoute = syncOtStatusAndRoute;
  window.selectInlinePreviewMedia = selectInlinePreviewMedia;
  window.setInlineCodeTab = setInlineCodeTab;
  window.setInlineMarkdownTab = setInlineMarkdownTab;
  window.setInlineFontSize = setInlineFontSize;
  window.setInteractiveFontPreset = setInteractiveFontPreset;
  window.openMediaPreviewModal = openMediaPreviewModal;
  window.closeMediaPreviewModal = closeMediaPreviewModal;
  window.stepSelectedMediaItem = stepSelectedMediaItem;
  window.copyMediaCodeText = copyMediaCodeText;
  window.openNewOtModal = openNewOtModal;
  window.closeNewOtModal = closeNewOtModal;
  window.syncNewOtBrandSuggestions = syncNewOtBrandSuggestions;
  window.handleCreateOt = handleCreateOt;
  window.updateClientsDatalist = updateClientsDatalist;
  window.openClientModal = openClientModal;
  window.closeClientModal = closeClientModal;
  window.renderClientModalColors = renderClientModalColors;
  window.selectClientModalColor = selectClientModalColor;
  window.renderClientModalBrandsList = renderClientModalBrandsList;
  window.handleAddBrandToModal = handleAddBrandToModal;
  window.handleRemoveBrandFromModal = handleRemoveBrandFromModal;
  window.handleSaveClient = handleSaveClient;
  window.deleteClient = deleteClientAction;
  window.openBrandModal = openBrandModal;
  window.closeBrandModal = closeBrandModal;
  window.handleSaveBrand = handleSaveBrand;
  window.deleteBrand = deleteBrandAction;
  window.openStatusManagerModal = openStatusManagerModal;
  window.closeStatusManagerModal = closeStatusManagerModal;
  window.renderStatusManagerList = renderStatusManagerList;
  window.handleCreateStatus = handleCreateStatus;
  window.renameStatus = renameStatus;
  window.updateStatusColor = updateStatusColor;
  window.deleteStatus = deleteStatusAction;
  window.deleteStatusAction = deleteStatusAction;
  window.exportBackupData = exportBackupData;
  window.importBackupData = importBackupData;
  window.openOnboardingStudioModal = openOnboardingStudioModal;
  window.closeOnboardingStudioModal = closeOnboardingStudioModal;
  window.handleCreateStudioOnboarding = handleCreateStudioOnboarding;
  window.openSubscriptionPaywallModal = openSubscriptionPaywallModal;
  window.closeSubscriptionPaywallModal = closeSubscriptionPaywallModal;
  window.handleBoldCheckoutClick = handleBoldCheckoutClick;
  window.openMediaReview = openMediaReview;
  window.shareMediaItem = shareMediaItem;
  window.openShareReviewPopover = openShareReviewPopover;
  window.closeShareReviewPopover = closeShareReviewPopover;
  window.promptUploadMediaVersion = promptUploadMediaVersion;
}

