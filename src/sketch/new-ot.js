/**
 * New OT creation form (#view-new-ot): auto-resize, next OT-26-XXX code, submit & cancel handlers.
 */

import {
  trafficOrders,
  trafficMembers,
  sketchState,
  relDate,
  ensureOtData,
  escapeHtml,
  getActiveWorkspaces,
  getDepartmentsForWorkspace,
  onSketchChange,
  notifySketchChange,
} from './store.js';

let newOtInitialized = false;

/**
 * Compute the next sequential OT code (`OT-26-XXX`) from existing `trafficOrders`.
 */
function getNextOtCode() {
  let maxNum = 0;
  trafficOrders.forEach((o) => {
    const m = String(o.id || '').match(/^OT-26-(\d+)$/i);
    if (m) {
      const n = Number(m[1]);
      if (n > maxNum) maxNum = n;
    }
  });
  return `OT-26-${String(maxNum + 1).padStart(3, '0')}`;
}

function resetClientBrandProductLabels() {
  sketchState.selectedClientName = null;
  sketchState.selectedBrandName = null;

  const clientLabel = document.getElementById('client-select-label');
  if (clientLabel) {
    clientLabel.textContent = 'Seleccionar...';
    clientLabel.classList.remove('text-[#D4D4D4]');
    clientLabel.classList.add('text-[#5a6169]');
  }

  const brandBtn = document.getElementById('brand-select-btn');
  const brandLabel = document.getElementById('brand-select-label');
  if (brandBtn) {
    brandBtn.disabled = true;
    brandBtn.classList.add('opacity-50', 'cursor-not-allowed');
    brandBtn.classList.remove('hover:border-[#3f3f3f]', 'cursor-pointer');
  }
  if (brandLabel) {
    brandLabel.textContent = 'Elige cliente...';
    brandLabel.classList.remove('text-[#D4D4D4]');
    brandLabel.classList.add('text-[#5a6169]');
  }

  const productBtn = document.getElementById('product-select-btn');
  const productLabel = document.getElementById('product-select-label');
  if (productBtn) {
    productBtn.disabled = true;
    productBtn.classList.add('opacity-50', 'cursor-not-allowed');
    productBtn.classList.remove('hover:border-[#3f3f3f]', 'cursor-pointer');
  }
  if (productLabel) {
    productLabel.textContent = 'Elige marca...';
    productLabel.classList.remove('text-[#D4D4D4]');
    productLabel.classList.add('text-[#5a6169]');
  }
}

function flashRequiredButton(btn) {
  if (!btn) return;
  btn.classList.add('border-rose-500/80');
  btn.focus();
  setTimeout(() => btn.classList.remove('border-rose-500/80'), 1400);
}

/**
 * Initialize #view-new-ot form interactions, validation, OT creation, and cancel behavior.
 */
export function initNewOt({ onCreatedOt, onCancel } = {}) {
  const viewNewOt = document.getElementById('view-new-ot');
  if (!viewNewOt) return;

  const form = viewNewOt.querySelector('form');
  const titleInput = document.getElementById('ot-header-title');
  const orderInput = form?.querySelector('input[readonly]');
  const refInput = form?.querySelector('input[placeholder*="Elefante"]');
  const respSelect = document.getElementById('new-ot-responsible');
  const wsRow = document.getElementById('new-ot-workspace-row');
  const wsSelect = document.getElementById('new-ot-workspace');
  const mediaInput = form?.querySelector('input[placeholder*="TV 20"]');
  const descInput = document.getElementById('ot-desc-input');
  const urgentCheckbox = document.getElementById('sketch-urgent');
  const cancelBtn = form?.querySelector('button[type="button"]');

  const syncNextCode = () => {
    if (orderInput) orderInput.value = getNextOtCode();
  };

  // Espacio: visible con 2+ espacios activos; preseleccionado con el espacio actual.
  const syncWorkspaceSelect = () => {
    if (!wsSelect) return;
    const active = getActiveWorkspaces();
    const prev = wsSelect.value;
    const preferred = sketchState.activeWorkspaceId && sketchState.activeWorkspaceId !== 'studio'
      ? sketchState.activeWorkspaceId
      : (active.some((p) => p.id === prev) ? prev : active[0]?.id);
    wsSelect.innerHTML = active
      .map((p) => `<option value="${escapeHtml(p.id)}" ${p.id === preferred ? 'selected' : ''}>${escapeHtml(p.name)}</option>`)
      .join('');
    wsRow?.classList.toggle('hidden', active.length < 2);
  };

  const syncResponsibleSelect = () => {
    if (!respSelect) return;
    const prev = respSelect.value;
    const preferred = trafficMembers.includes(prev) ? prev : (sketchState.myOtsMember || trafficMembers[0]);
    respSelect.innerHTML = trafficMembers
      .map((m) => `<option value="${escapeHtml(m)}" ${m === preferred ? 'selected' : ''}>${escapeHtml(m)}</option>`)
      .join('');
  };

  const autoResize = () => {
    if (!descInput) return;
    descInput.style.height = 'auto';
    descInput.style.height = descInput.scrollHeight + 'px';
  };

  const resetForm = () => {
    if (titleInput) titleInput.value = '';
    form?.reset();
    resetClientBrandProductLabels();
    syncNextCode();
    syncWorkspaceSelect();
    syncResponsibleSelect();
    autoResize();
  };

  syncNextCode();
  syncWorkspaceSelect();
  syncResponsibleSelect();
  autoResize();

  if (newOtInitialized) return;
  newOtInitialized = true;

  descInput?.addEventListener('input', autoResize);

  onSketchChange('orders', syncNextCode);
  onSketchChange('workspace', syncWorkspaceSelect);
  onSketchChange('team', syncResponsibleSelect);

  cancelBtn?.addEventListener('click', () => {
    resetForm();
    if (typeof onCancel === 'function') {
      onCancel();
    } else {
      viewNewOt.classList.add('hidden');
    }
  });

  form?.addEventListener('submit', (e) => {
    e.preventDefault();

    const client = sketchState.selectedClientName;
    const brand = sketchState.selectedBrandName;
    if (!client) {
      flashRequiredButton(document.getElementById('client-select-btn'));
      return;
    }
    if (!brand) {
      flashRequiredButton(document.getElementById('brand-select-btn'));
      return;
    }

    const productText = document.getElementById('product-select-label')?.textContent?.trim() || '';
    const product =
      productText && productText !== 'Elige marca...' && productText !== 'Seleccionar...'
        ? productText
        : 'Institucional';

    const otId = getNextOtCode();
    const ref = (refInput?.value || '').trim();
    const title = (titleInput?.value || '').trim();
    const media = (mediaInput?.value || '').trim();
    const desc = (descInput?.value || '').trim();
    const responsible = respSelect?.value || sketchState.myOtsMember || trafficMembers[0] || '';
    const workspaceId = wsSelect?.value || getActiveWorkspaces()[0]?.id || 'diseno-publicidad';
    const wsDepartments = getDepartmentsForWorkspace(workspaceId);
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const newOt = {
      id: otId,
      workspaceId,
      client,
      brand,
      product,
      media: media || 'Por definir',
      ref: ref || otId,
      title: title || ref || 'Nueva Orden de Trabajo',
      entryDate: relDate(0, timeStr),
      deliveryDate: relDate(5, '17:00'),
      department: wsDepartments[0] || '',
      stage: 'Tráfico',
      status: 'En proceso',
      responsible,
      notes: desc,
      urgent: !!urgentCheckbox?.checked,
      archived: false,
    };

    ensureOtData(newOt);
    trafficOrders.unshift(newOt);
    resetForm();

    notifySketchChange('orders', { action: 'create', otId: newOt.id });

    if (typeof onCreatedOt === 'function') {
      onCreatedOt(newOt);
    } else {
      notifySketchChange('open-ot', { otId: newOt.id, taskIndex: null, scope: 'traffic-open' });
    }
  });
}
