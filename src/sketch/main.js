import './sketch.css';
import { hydrateIcons } from '/src/client/icons.js';
import { onSketchChange, sketchState } from './store.js';
import { initNavigation } from './navigation.js';
import { initClientModal } from './client-modal.js';
import { initSettingsModal } from './settings.js';
import { initTraffic, renderTrafficGrid, renderTrafficTree } from './traffic.js';
import { initNewOt } from './new-ot.js';
import { initGallery, renderStandaloneGallery } from './gallery.js';
import { initOtDetail, renderMyOts } from './ot-detail.js';
import { initStripboard, renderStripboard } from './stripboard.js';

window.hydrateIcons = hydrateIcons;
hydrateIcons();

function openOtInDetail(otId, taskIndex = null) {
  if (!otId) return;
  const viewIds = ['view-new-ot', 'view-traffic', 'view-gallery', 'view-stripboard', 'view-envelope-open'];
  viewIds.forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  document.getElementById('view-my-ots')?.classList.remove('hidden');
  document.getElementById('left-traffic-tree')?.classList.add('hidden');
  document.getElementById('left-envelope-tree')?.classList.add('hidden');
  document.getElementById('left-stripboard-pool')?.classList.add('hidden');

  const centerTitle = document.getElementById('center-page-title');
  if (centerTitle) centerTitle.textContent = 'Mis OTs';
  document.getElementById('left-menu-track')?.classList.add('-translate-x-1/2');

  sketchState.myOtsScope = 'active';
  sketchState.activeMyOtId = otId;
  sketchState.activeTaskIndex = taskIndex;
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

initTraffic({
  onOpenOt: (otId) => openOtInDetail(otId, null)
});

initNewOt({
  onCreatedOt: (ot) => openOtInDetail(ot?.id, null),
  onCancel: () => jumpToSubView('traffic')
});

initGallery();

initOtDetail({
  onJumpStripboard: () => jumpToSubView('my-tasks')
});

initStripboard({
  onOpenOt: (otId, taskIndex) => openOtInDetail(otId, taskIndex)
});

initNavigation({
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

onSketchChange('open-ot', (payload) => {
  if (payload?.otId) {
    openOtInDetail(payload.otId, payload.taskIndex ?? null);
  }
});
