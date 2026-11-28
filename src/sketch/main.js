import './sketch.css';
import { hydrateIcons } from '/src/client/icons.js';
import {
  canRedoOrders,
  canUndoOrders,
  onSketchChange,
  redoOrders,
  resolveOtTarget,
  sketchState,
  undoOrders,
} from './store.js';
import { initNavigation } from './navigation.js';
import { initClientModal } from './client-modal.js';
import { initSettingsModal } from './settings.js';
import { initTraffic, renderTrafficGrid, renderTrafficTree } from './traffic.js';
import { renderDesktopOverview } from './desktop.js';
import { initNewOt } from './new-ot.js';
import { initGallery, renderStandaloneGallery } from './gallery.js';
import { initOtDetail, renderMyOts } from './ot-detail.js';
import { initStripboard, renderStripboard } from './stripboard.js';
import { initUserMenu } from './user-menu.js';
import { initNotifications } from './notifications.js';
import { initWorkspaceBar } from './workspace-bar.js';
import { closeCorcho, initCorcho, isCorchoOpen } from './corcho.js';

window.hydrateIcons = hydrateIcons;
hydrateIcons();

let currentNavEntry = { type: 'desktop' };
const navHistory = [];
let isNavigatingBack = false;

function sameNavEntry(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === 'subview') return a.otView === b.otView;
  if (a.type === 'ot-detail') return a.otId === b.otId && a.taskIndex === b.taskIndex && a.scope === b.scope;
  return true;
}

function recordNavEntry(nextEntry) {
  if (isNavigatingBack) return;
  if (currentNavEntry && !sameNavEntry(currentNavEntry, nextEntry)) {
    navHistory.push(currentNavEntry);
    if (navHistory.length > 30) navHistory.shift();
  }
  currentNavEntry = nextEntry;
}

function goBackInHistory() {
  if (navHistory.length > 0) {
    const prev = navHistory.pop();
    isNavigatingBack = true;
    currentNavEntry = prev;
    try {
      if (prev.type === 'ot-detail') {
        openOtInDetail(prev.otId, prev.taskIndex, prev.scope);
      } else if (prev.type === 'review') {
        openReviewInCenter(prev.piece);
      } else if (prev.type === 'settings') {
        document.getElementById('btn-studio-footer')?.click();
      } else if (prev.type === 'desktop') {
        document.getElementById('btn-left-back')?.click();
      } else if (prev.type === 'subview') {
        jumpToSubView(prev.otView);
      }
    } finally {
      isNavigatingBack = false;
    }
    return;
  }
  currentNavEntry = { type: 'desktop' };
  document.getElementById('btn-left-back')?.click();
}

function openOtInDetail(target, taskIndex = null, scope = 'active') {
  const isObj = typeof target === 'object' && target !== null;
  const rawOtId = isObj ? target.otId : target;
  const rawTaskIdx = isObj && target.taskIndex !== undefined ? target.taskIndex : taskIndex;
  const requestedScope = isObj && target.scope !== undefined ? target.scope : scope;
  if (!rawOtId) return;

  const resolved = resolveOtTarget(rawOtId, rawTaskIdx);
  const otId = resolved ? resolved.otId : String(rawOtId).trim();
  const resolvedTaskIdx = resolved
    ? resolved.taskIndex
    : (rawTaskIdx !== '' && rawTaskIdx !== undefined && rawTaskIdx !== null ? Number(rawTaskIdx) : null);

  let resolvedScope = requestedScope || 'active';
  if (resolved?.ot) {
    if (resolved.ot.archived) {
      resolvedScope = 'archived';
    } else if (
      resolved.ot.responsible !== sketchState.myOtsMember &&
      (!requestedScope || requestedScope === 'active')
    ) {
      resolvedScope = 'traffic-open';
    }
  }

  recordNavEntry({ type: 'ot-detail', otId, taskIndex: resolvedTaskIdx, scope: resolvedScope });
  const viewIds = ['view-desktop', 'view-new-ot', 'view-traffic', 'view-gallery', 'view-stripboard', 'view-review', 'view-envelope-open', 'settings-modal'];
  viewIds.forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('view-my-ots')?.classList.remove('hidden');
  document.getElementById('left-traffic-tree')?.classList.add('hidden');
  document.getElementById('left-envelope-tree')?.classList.add('hidden');
  document.getElementById('left-stripboard-pool')?.classList.add('hidden');
  document.getElementById('left-settings-menu')?.classList.add('hidden');

  const centerTitle = document.getElementById('center-page-title');
  if (centerTitle) centerTitle.textContent = 'Mis OTs';
  document.getElementById('left-menu-track')?.classList.add('-translate-x-1/2');

  sketchState.myOtsScope = resolvedScope;
  sketchState.myOtsMode = 'cards';
  sketchState.activeMyOtId = otId;
  sketchState.activeTaskIndex = resolvedTaskIdx;
  sketchState.activeRouteIndex = null;
  sketchState.activePieceIndex = null;
  sketchState.galleryPage = 1;
  sketchState.selectedPieces.clear();
  renderMyOts();
}

function jumpToSubView(otView) {
  const btn = document.querySelector(`.ot-sub-btn[data-ot-view="${otView}"]`);
  if (btn) btn.click();
}

initClientModal();
initSettingsModal();
initUserMenu();
initNotifications();
initWorkspaceBar();
initCorcho();

initTraffic({
  onOpenOt: (payload) => openOtInDetail(payload)
});

initNewOt({
  onCreatedOt: (ot) => openOtInDetail(ot?.id, null),
  onCancel: () => jumpToSubView('traffic')
});

initGallery();

initOtDetail({
  onJumpStripboard: () => jumpToSubView('my-tasks'),
  onBackToTraffic: () => goBackInHistory()
});

document.querySelectorAll('.ot-sub-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const otView = btn.dataset.otView;
    if (otView) recordNavEntry({ type: 'subview', otView });
  });
});

['btn-settings-menu', 'btn-studio-footer', 'btn-trial-badge'].forEach((id) => {
  document.getElementById(id)?.addEventListener('click', () => {
    closeCorcho();
    recordNavEntry({ type: 'settings' });
  });
});

document.getElementById('btn-desktop-menu')?.addEventListener('click', () => {
  recordNavEntry({ type: 'desktop' });
});

document.getElementById('btn-center-back-traffic')?.addEventListener('click', () => {
  closeCorcho();
  goBackInHistory();
});

initStripboard({
  onOpenOt: (otId, taskIndex) => openOtInDetail(otId, taskIndex)
});

const desktopCallbacks = {
  onOpenOt: (payload) => openOtInDetail(payload),
  onGoToTraffic: (filters = null) => {
    if (filters) {
      sketchState.trafficFilter = filters.client ? { type: 'client', client: filters.client, brand: null } : { type: 'all', client: null, brand: null };
      sketchState.trafficDeptFilter = filters.department || 'all';
      sketchState.trafficStageFilter = filters.stage || 'all';
      sketchState.trafficStatusFilter = filters.status || 'all';
      sketchState.trafficDateFilter = filters.dateFilter || 'all';
    }
    jumpToSubView('traffic');
  },
  onGoToAllTasks: (filters = null) => {
    if (filters) {
      sketchState.trafficFilter = filters.client ? { type: 'client', client: filters.client, brand: null } : { type: 'all', client: null, brand: null };
      sketchState.trafficDeptFilter = filters.department || 'all';
      sketchState.trafficStageFilter = filters.stage || 'all';
      sketchState.trafficStatusFilter = filters.status || 'all';
      sketchState.trafficDateFilter = filters.dateFilter || 'all';
    }
    jumpToSubView('all-tasks');
  },
  onGoToStripboardDate: (isoDate) => {
    if (isoDate) {
      sketchState.stripboardDate = isoDate;
      sketchState.stripboardViewMode = 'day';
    }
    jumpToSubView('my-tasks');
  },
};

const refreshDesktopIfVisible = () => {
  const desktopEl = document.getElementById('view-desktop');
  if (desktopEl && !desktopEl.classList.contains('hidden')) {
    renderDesktopOverview(desktopCallbacks.onGoToTraffic, desktopCallbacks);
  }
};

initNavigation({
  onCloseCorcho: () => closeCorcho(),
  onDesktop: () => {
    renderDesktopOverview(desktopCallbacks.onGoToTraffic, desktopCallbacks);
  },
  onTraffic: () => {
    renderTrafficTree();
    renderTrafficGrid();
  },
  onGallery: () => {
    renderTrafficTree();
    renderStandaloneGallery();
  },
  onMyOts: () => {
    renderMyOts();
  },
  onStripboard: () => {
    renderTrafficTree();
    renderStripboard();
  }
});

renderDesktopOverview(desktopCallbacks.onGoToTraffic, desktopCallbacks);

onSketchChange('orders', refreshDesktopIfVisible);
onSketchChange('stripboard', refreshDesktopIfVisible);
onSketchChange('workspace', refreshDesktopIfVisible);

onSketchChange('open-ot', (payload) => {
  if (payload?.otId) {
    closeCorcho();
    openOtInDetail(payload.otId, payload.taskIndex ?? null, payload.scope);
  }
});

function openReviewInCenter(piece) {
  const myOtsEl = document.getElementById('view-my-ots');
  if (myOtsEl && !myOtsEl.classList.contains('hidden') && sketchState.myOtsMode === 'cards' && sketchState.activeMyOtId) {
    currentNavEntry = {
      type: 'ot-detail',
      otId: sketchState.activeMyOtId,
      taskIndex: sketchState.activeTaskIndex ?? null,
      scope: sketchState.myOtsScope || 'active',
    };
  }
  recordNavEntry({ type: 'review', piece });
  const viewIds = ['view-desktop', 'view-new-ot', 'view-traffic', 'view-my-ots', 'view-gallery', 'view-stripboard', 'view-envelope-open', 'settings-modal'];
  viewIds.forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('left-traffic-tree')?.classList.add('hidden');
  document.getElementById('left-envelope-tree')?.classList.add('hidden');
  document.getElementById('left-stripboard-pool')?.classList.add('hidden');
  document.getElementById('left-settings-menu')?.classList.add('hidden');
  document.getElementById('left-menu-track')?.classList.remove('-translate-x-1/2');
  const reviewEl = document.getElementById('view-review');
  if (!reviewEl) return;
  reviewEl.classList.remove('hidden');

  const centerTitle = document.getElementById('center-page-title');
  if (centerTitle) {
    centerTitle.textContent = piece?.name ? `Revisión Colaborativa · ${piece.name}` : 'Revisión Colaborativa';
  }

  const token = piece?.reviewToken;
  const url = token ? `/review/${encodeURIComponent(token)}?embed=1` : '/review.html?embed=1';
  reviewEl.innerHTML = `<iframe src="${url}" title="Revisión Colaborativa" class="w-full flex-1 border-0 rounded-xl bg-[#191919]"></iframe>`;
}

onSketchChange('open-review', (payload) => {
  closeCorcho();
  openReviewInCenter(payload?.piece || null);
});

function syncHistoryButtons() {
  const undoBtn = document.getElementById('btn-undo-orders');
  const redoBtn = document.getElementById('btn-redo-orders');
  if (undoBtn) undoBtn.disabled = !canUndoOrders();
  if (redoBtn) redoBtn.disabled = !canRedoOrders();
}

document.getElementById('btn-undo-orders')?.addEventListener('click', () => undoOrders());
document.getElementById('btn-redo-orders')?.addEventListener('click', () => redoOrders());
onSketchChange('history', syncHistoryButtons);
syncHistoryButtons();

document.addEventListener('keydown', (e) => {
  if (isCorchoOpen()) return;
  const mod = e.metaKey || e.ctrlKey;
  if (!mod || e.key.toLowerCase() !== 'z') {
    if (mod && e.key.toLowerCase() === 'y' && !e.target.closest('input, textarea, [contenteditable="true"]')) {
      e.preventDefault();
      redoOrders();
    }
    return;
  }
  if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault();
  if (e.shiftKey) redoOrders();
  else undoOrders();
});
