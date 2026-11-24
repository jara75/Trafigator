import { sketchState, notifySketchChange } from './store.js';
import { clearInspectorPanel } from './inspector.js';

const MENU_FOLD_SVG = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M10 12h10"/><path d="M4 18h16"/><path d="m7 9-3 3 3 3"/></svg>';
const MENU_UNFOLD_SVG = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/><path d="m17 9 3 3-3 3"/></svg>';

const COLLAPSED_W = 44;

/**
 * Synchronize left pane collapsed/expanded state based on width in pixels.
 */
export function syncLeftState(widthPx) {
  const leftHeader = document.getElementById('left-header');
  const leftBrand = document.getElementById('left-brand');
  const leftBody = document.getElementById('left-body');
  const iconToggleLeft = document.getElementById('icon-toggle-left');
  const resizerLeft = document.getElementById('resizer-left');

  const collapsed = widthPx <= 72;
  if (leftBrand) leftBrand.classList.toggle('hidden', collapsed);
  if (leftBody) leftBody.classList.toggle('hidden', collapsed);
  if (resizerLeft) {
    resizerLeft.classList.toggle('bg-obsidian-border', !collapsed);
    resizerLeft.classList.toggle('bg-transparent', collapsed);
  }
  if (leftHeader) {
    leftHeader.classList.toggle('justify-between', !collapsed);
    leftHeader.classList.toggle('justify-center', collapsed);
    leftHeader.classList.toggle('px-3', !collapsed);
    leftHeader.classList.toggle('px-0', collapsed);
  }
  if (iconToggleLeft) {
    iconToggleLeft.innerHTML = collapsed ? MENU_UNFOLD_SVG : MENU_FOLD_SVG;
  }
}

/**
 * Attach a horizontal column resizer between a handle and target pane.
 */
export function makeColResizer(handleId, targetId, dir, minPx, maxPx, onResize) {
  const handle = document.getElementById(handleId);
  const target = document.getElementById(targetId);
  if (!handle || !target) return;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = target.getBoundingClientRect().width;
    target.style.transition = 'none';
    document.body.style.cursor = 'col-resize';
    handle.classList.add('bg-obsidian-cyan');

    const onMove = (ev) => {
      const dx = ev.clientX - startX;
      const next = Math.max(minPx, Math.min(maxPx, startW + dx * dir));
      target.style.width = next + 'px';
      if (onResize) onResize(next);
    };

    const onUp = () => {
      target.style.transition = '';
      document.body.style.cursor = '';
      handle.classList.remove('bg-obsidian-cyan');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });
}

function resetSubNavButtons() {
  document.querySelectorAll('.ot-sub-btn').forEach((b) => {
    b.classList.remove('bg-obsidian-elevated', 'text-[#D4D4D4]');
    b.classList.add('hover:bg-obsidian-elevated', 'text-[#8C8C8C]', 'hover:text-[#D4D4D4]');
    const svg = b.querySelector('svg');
    if (svg) {
      svg.classList.remove('text-[#D4D4D4]');
      svg.classList.add('text-[#8C8C8C]');
    }
  });
}

function hideAllWorkspaceViews() {
  document.getElementById('view-desktop')?.classList.add('hidden');
  document.getElementById('view-new-ot')?.classList.add('hidden');
  document.getElementById('view-traffic')?.classList.add('hidden');
  document.getElementById('view-my-ots')?.classList.add('hidden');
  document.getElementById('view-envelope-open')?.classList.add('hidden');
  document.getElementById('view-gallery')?.classList.add('hidden');
  document.getElementById('view-stripboard')?.classList.add('hidden');
  document.getElementById('view-review')?.classList.add('hidden');
  document.getElementById('settings-modal')?.classList.add('hidden');
  document.getElementById('left-traffic-tree')?.classList.add('hidden');
  document.getElementById('left-envelope-tree')?.classList.add('hidden');
  document.getElementById('left-stripboard-pool')?.classList.add('hidden');
  document.getElementById('left-settings-menu')?.classList.add('hidden');
}

/**
 * Initialize shell navigation, column resizers, and view routing.
 * Accepts optional callbacks map ({ onTraffic, onGallery, onMyOts, onStripboard })
 * and emits 'navigation:*' events on the store bus.
 */
export function initNavigation(handlers = {}) {
  const leftPane = document.getElementById('pane-left');
  const btnToggleLeft = document.getElementById('btn-toggle-left');

  syncLeftState(sketchState.lastOpenLeftW);

  if (btnToggleLeft && leftPane) {
    btnToggleLeft.addEventListener('click', () => {
      const curW = leftPane.getBoundingClientRect().width;
      const isCollapsed = curW <= 72;
      if (!isCollapsed) {
        sketchState.lastOpenLeftW = Math.max(160, Math.round(curW));
        leftPane.style.width = COLLAPSED_W + 'px';
        syncLeftState(COLLAPSED_W);
      } else {
        leftPane.style.width = sketchState.lastOpenLeftW + 'px';
        syncLeftState(sketchState.lastOpenLeftW);
      }
    });
  }

  makeColResizer('resizer-left', 'pane-left', 1, COLLAPSED_W, 460, (w) => {
    if (w > 72) sketchState.lastOpenLeftW = Math.round(w);
    syncLeftState(w);
  });
  makeColResizer('resizer-right', 'pane-right', -1, 120, 460);

  const rightPane = document.getElementById('pane-right');
  const rightResizer = document.getElementById('resizer-right');
  const btnRightCollapse = document.getElementById('btn-right-collapse');
  const btnRightExpand = document.getElementById('btn-right-expand');
  let lastOpenRightW = 220;

  const setRightCollapsed = (collapsed) => {
    if (!rightPane) return;
    if (collapsed) {
      const curW = Math.round(rightPane.getBoundingClientRect().width);
      if (curW >= 120) lastOpenRightW = curW;
      rightPane.classList.add('hidden');
      rightResizer?.classList.add('hidden');
      if (btnRightExpand) {
        btnRightExpand.classList.remove('hidden');
        btnRightExpand.classList.add('flex');
      }
    } else {
      rightPane.classList.remove('hidden');
      rightPane.style.width = `${lastOpenRightW}px`;
      rightResizer?.classList.remove('hidden');
      if (btnRightExpand) {
        btnRightExpand.classList.add('hidden');
        btnRightExpand.classList.remove('flex');
      }
    }
  };

  btnRightCollapse?.addEventListener('click', () => setRightCollapsed(true));
  btnRightExpand?.addEventListener('click', () => setRightCollapsed(false));

  document.querySelectorAll('.ot-sub-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const otView = btn.dataset.otView;
      const isDrillDown = otView !== 'new-ot';
      resetSubNavButtons();

      // Resaltado uniforme con pastilla gris y texto claro para cualquier módulo seleccionado
      btn.classList.add('bg-obsidian-elevated', 'text-[#D4D4D4]');
      btn.classList.remove('hover:bg-obsidian-elevated', 'text-[#8C8C8C]', 'hover:text-[#D4D4D4]');
      const svg = btn.querySelector('svg');
      if (svg) {
        svg.classList.remove('text-[#8C8C8C]');
        svg.classList.add('text-[#D4D4D4]');
      }

      const viewNewOt = document.getElementById('view-new-ot');
      const viewTraffic = document.getElementById('view-traffic');
      const viewMyOts = document.getElementById('view-my-ots');
      const viewEnvelopeOpen = document.getElementById('view-envelope-open');
      const viewGallery = document.getElementById('view-gallery');
      const viewStripboard = document.getElementById('view-stripboard');
      const leftTrafficTree = document.getElementById('left-traffic-tree');
      const leftEnvelopeTree = document.getElementById('left-envelope-tree');
      const leftStripboardPool = document.getElementById('left-stripboard-pool');
      const centerTitle = document.getElementById('center-page-title');

      if (centerTitle) {
        centerTitle.textContent = otView === 'my-tasks' ? 'Mis Tareas · Stripboard' : (btn.innerText.trim() || 'Escritorio');
      }

      const isArchiveGridView = otView === 'gallery' || otView === 'documents' || otView === 'dev';
      const isTrafficGridView = otView === 'traffic' || otView === 'archived-ots' || otView === 'all-tasks';
      const isMyOtsView = otView === 'my-ots';
      const isStripboardView = otView === 'my-tasks';

      if (viewNewOt) viewNewOt.classList.toggle('hidden', isDrillDown);
      if (!isDrillDown) {
        clearInspectorPanel('Completa los datos para crear la nueva OT.');
      }
      document.getElementById('view-desktop')?.classList.add('hidden');
      if (viewTraffic) viewTraffic.classList.toggle('hidden', !isTrafficGridView);
      document.getElementById('settings-modal')?.classList.add('hidden');
      document.getElementById('view-review')?.classList.add('hidden');
      if (viewMyOts) viewMyOts.classList.toggle('hidden', !isMyOtsView);
      if (viewEnvelopeOpen) viewEnvelopeOpen.classList.add('hidden');
      if (viewGallery) viewGallery.classList.toggle('hidden', !isArchiveGridView);
      if (viewStripboard) viewStripboard.classList.toggle('hidden', !isStripboardView);
      if (leftTrafficTree) {
        const showLeftFilters = isTrafficGridView || isArchiveGridView || isStripboardView || (isMyOtsView && sketchState.myOtsMode !== 'cards');
        leftTrafficTree.classList.toggle('hidden', !showLeftFilters);
      }
      if (leftEnvelopeTree) leftEnvelopeTree.classList.add('hidden');
      if (leftStripboardPool) leftStripboardPool.classList.add('hidden');
      document.getElementById('left-settings-menu')?.classList.add('hidden');

      if (isTrafficGridView) {
        sketchState.trafficScope = otView === 'archived-ots' ? 'archived' : (otView === 'all-tasks' ? 'all-tasks' : 'active');
        sketchState.trafficFilter = { type: 'all', client: null, brand: null };
        handlers.onTraffic?.(otView);
        notifySketchChange('navigation:traffic', { otView });
      } else if (isArchiveGridView) {
        sketchState.trafficScope = otView;
        sketchState.trafficFilter = { type: 'all', client: null, brand: null };
        sketchState.galleryTypeFilter = 'all';
        sketchState.galleryTaskFilter = 'all';
        sketchState.gallerySearch = '';
        sketchState.galleryPage = 1;
        sketchState.activePieceIndex = null;
        sketchState.selectedPieces.clear();
        handlers.onGallery?.(otView);
        notifySketchChange('navigation:gallery', { otView });
      } else if (isMyOtsView) {
        sketchState.trafficScope = 'my-ots';
        sketchState.myOtsScope = 'active';
        sketchState.myOtsMode = sketchState.myOtsLastCollectionMode || 'kanban';
        sketchState.trafficDateFilter = 'all';
        sketchState.activeMyOtId = null;
        sketchState.activeTaskIndex = null;
        sketchState.galleryPage = 1;
        sketchState.selectedPieces.clear();
        handlers.onMyOts?.(otView);
        notifySketchChange('navigation:my-ots', { otView });
      } else if (isStripboardView) {
        sketchState.trafficScope = 'my-tasks';
        sketchState.trafficFilter = { type: 'all', client: null, brand: null };
        handlers.onStripboard?.(otView);
        notifySketchChange('navigation:stripboard', { otView });
      }

      if (isDrillDown) {
        document.getElementById('left-menu-track')?.classList.add('-translate-x-1/2');
      }
    });
  });

  document.getElementById('btn-desktop-menu')?.addEventListener('click', () => {
    const centerTitle = document.getElementById('center-page-title');
    if (centerTitle) centerTitle.textContent = 'Escritorio';
    resetSubNavButtons();
    hideAllWorkspaceViews();
    document.getElementById('view-desktop')?.classList.remove('hidden');
    handlers.onDesktop?.();
    document.getElementById('left-menu-track')?.classList.remove('-translate-x-1/2');
  });

  document.getElementById('btn-left-back')?.addEventListener('click', () => {
    const centerTitle = document.getElementById('center-page-title');
    if (centerTitle) centerTitle.textContent = 'Escritorio';
    resetSubNavButtons();
    hideAllWorkspaceViews();
    document.getElementById('view-desktop')?.classList.remove('hidden');
    handlers.onDesktop?.();
    document.getElementById('left-menu-track')?.classList.remove('-translate-x-1/2');
  });
}
