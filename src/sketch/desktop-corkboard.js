/**
 * Cuadrante C04 Tablero de Corcho del Escritorio:
 * - Modo contextual 1: Gráfico ampliado desde C02 Estadística
 * - Modo contextual 2: Galería + Vista previa de OT/Tarea seleccionada
 * - Modo base: Tablero de Corcho (Scrivener-style)
 * - Renderizado y capa de eventos locales (con datos/estado en desktop-corkboard-store.js)
 */

import { escapeHtml } from './store.js';
import {
  DND_MIME_CORK_CARD,
  DND_MIME_PIN,
  DND_MIME_SLOT,
  addChartCorkPin,
  addCorkPin,
  addLocalFilesToCorkboard,
  addOtMediaCorkPin,
  addOtOrTaskCorkPin,
  closeCorkPinPreview,
  closePinnedChart,
  ensureCorkPinsInitialized,
  findDuplicateChartPin,
  findDuplicateOtMediaPin,
  findDuplicateOtOrTaskPin,
  getActiveCorkComposer,
  getActiveCorkPinId,
  getActivePinnedChartId,
  getCorkBlobObjectUrl,
  getCorkStorageKey,
  getCorkboardPermissions,
  hasOpenCorkPinPreview,
  loadCorkInternalMessages,
  normalizeSafeWebUrl,
  removeCorkPin,
  reorderCorkPins,
  setActiveCorkComposer,
  setActiveCorkPinId,
  setActivePinnedChartId,
} from './desktop-corkboard-store.js';
import {
  renderChartOverlay,
  renderOtGalleryOverlay,
} from './desktop-corkboard-overlays.js';
import {
  buildPinnedChartBoard,
  renderCorkPinCard,
} from './desktop-corkboard-cards.js';
import {
  bindCorkPreviewEvents,
  renderCorkPinPreview,
  renderCorkPinPreviewCloseBtn,
  renderCorkPinPreviewFooter,
  renderCorkPinPreviewHeaderLeft,
} from './desktop-corkboard-preview.js';

// Re-exportación limpia para mantener dirección única: desktop.js → desktop-corkboard.js → { store, overlays, cards, preview }
export {
  DND_MIME_PIN,
  DND_MIME_SLOT,
  closeCorkPinPreview,
  hasOpenCorkPinPreview,
  loadCorkInternalMessages,
  renderOtGalleryOverlay,
};

let composerErrorMsg = '';
let corkNoticeMsg = '';
let corkNoticeTimer = null;

function renderCorkHeaderActions(canEdit, activeComposer) {
  if (!canEdit) {
    return `<span class="text-[8.5px] font-mono text-[#5A5A5A] uppercase tracking-wider">Solo lectura</span>`;
  }
  const btnCls = (mode) =>
    `px-1.5 py-0.5 rounded text-[9.5px] font-mono transition-colors cursor-pointer ${
      activeComposer === mode
        ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold'
        : 'text-[#737373] hover:text-[#D4D4D4]'
    }`;
  return `
    <div class="inline-flex items-center gap-1 shrink-0">
      <button type="button" data-cork-open-composer="note" class="${btnCls('note')}">+ Nota</button>
      <button type="button" data-cork-open-composer="link" class="${btnCls('link')}">+ Enlace</button>
      <button type="button" data-cork-trigger-file="1" class="${btnCls('file')}">+ Archivo</button>
    </div>
  `;
}

function renderCorkComposerHtml(activeComposer, errorMsg = '') {
  if (activeComposer === 'note') {
    return `
      <form data-cork-form="note" class="mb-2.5 p-2.5 rounded-lg bg-[#202020] border border-obsidian-border space-y-2 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[9px] uppercase tracking-wider text-obsidian-amber font-semibold">Nueva nota</span>
          <button type="button" data-cork-cancel-composer="1" aria-label="Cancelar nueva nota"
            class="w-5 h-5 rounded text-[#737373] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div>
          <label for="cork-note-title" class="sr-only">Título de la nota</label>
          <input id="cork-note-title" name="note_title" type="text" maxlength="120" required
            placeholder="Título de la nota..."
            class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1 text-[11px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none" />
        </div>
        <div>
          <label for="cork-note-content" class="sr-only">Contenido de la nota</label>
          <textarea id="cork-note-content" name="note_content" rows="3"
            placeholder="Apuntes, ideas o referencias rápidas..."
            class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1.5 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-snug"></textarea>
        </div>
        ${errorMsg ? `<p class="text-[9.5px] font-mono text-rose-400">${escapeHtml(errorMsg)}</p>` : ''}
        <div class="flex items-center justify-end gap-1.5">
          <button type="button" data-cork-cancel-composer="1"
            class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10px] text-[#8C8C8C] hover:text-[#D4D4D4] transition-colors cursor-pointer">Cancelar</button>
          <button type="submit"
            class="px-3 py-1 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[10px] text-[#191919] font-semibold transition-colors cursor-pointer">Guardar nota</button>
        </div>
      </form>
    `;
  }
  if (activeComposer === 'link') {
    return `
      <form data-cork-form="link" class="mb-2.5 p-2.5 rounded-lg bg-[#202020] border border-obsidian-border space-y-2 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[9px] uppercase tracking-wider text-obsidian-amber font-semibold">Nuevo enlace web</span>
          <button type="button" data-cork-cancel-composer="1" aria-label="Cancelar nuevo enlace"
            class="w-5 h-5 rounded text-[#737373] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div>
          <label for="cork-link-url" class="sr-only">Dirección URL</label>
          <input id="cork-link-url" name="link_url" type="text" required
            placeholder="https://referencia.com/campana"
            class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1 text-[11px] font-mono text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none" />
        </div>
        <div>
          <label for="cork-link-title" class="sr-only">Título opcional del enlace</label>
          <input id="cork-link-title" name="link_title" type="text" maxlength="120"
            placeholder="Título descriptivo (opcional)..."
            class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1 text-[11px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none" />
        </div>
        ${errorMsg ? `<p class="text-[9.5px] font-mono text-rose-400">${escapeHtml(errorMsg)}</p>` : ''}
        <div class="flex items-center justify-end gap-1.5">
          <button type="button" data-cork-cancel-composer="1"
            class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10px] text-[#8C8C8C] hover:text-[#D4D4D4] transition-colors cursor-pointer">Cancelar</button>
          <button type="submit"
            class="px-3 py-1 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[10px] text-[#191919] font-semibold transition-colors cursor-pointer">Guardar enlace</button>
        </div>
      </form>
    `;
  }
  return '';
}

function renderCorkBodyHtml({
  pins,
  isFullDesktop,
  canEdit,
  activeComposer,
  errorMsg,
  noticeMsg = '',
  trafficOrders = [],
  todayKey = '',
  tomorrowKey = '',
  dailyHours = 8,
  canSeeFinancial = false,
  myMember = '',
}) {
  const gridColsCls = isFullDesktop ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2';
  const noticeHtml = noticeMsg
    ? `<div data-dk-cork-notice="1" role="status" class="mb-2 px-2.5 py-1 rounded-md bg-[#202020] border border-obsidian-border font-mono text-[9.5px] text-obsidian-amber shrink-0">${escapeHtml(noticeMsg)}</div>`
    : '';
  const composerHtml = canEdit ? renderCorkComposerHtml(activeComposer, errorMsg) : '';
  const listHtml = pins.length
    ? `<div class="grid ${gridColsCls} gap-2 content-start">${pins.map((p, idx) => renderCorkPinCard(p, idx, { canEdit, trafficOrders, todayKey, tomorrowKey, dailyHours, canSeeFinancial, myMember })).join('')}</div>`
    : `
      <div class="flex flex-col items-center justify-center flex-1 py-6 gap-1.5 text-center">
        <div class="w-8 h-8 rounded-lg border border-dashed border-obsidian-border flex items-center justify-center text-[#5A5A5A]">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
          </svg>
        </div>
        <span class="text-[10.5px] text-[#8C8C8C] font-medium">Corcho vacío</span>
        <span class="text-[9px] text-[#5A5A5A] font-mono">${canEdit ? 'Crea una nota, enlace o archivo arriba, o arrastra una OT aquí' : 'Aún no hay fichas fijadas en el Corcho del Estudio'}</span>
      </div>
    `;
  return `
    ${noticeHtml}
    ${composerHtml}
    ${listHtml}
  `;
}

function hydrateCorkThumbnails(corkRoot) {
  if (!corkRoot) return;
  corkRoot.querySelectorAll('[data-cork-blob-thumb]').forEach((slot) => {
    const blobId = slot.dataset.corkBlobThumb;
    if (!blobId) return;
    getCorkBlobObjectUrl(blobId).then((objUrl) => {
      if (!objUrl || !slot.isConnected) return;
      slot.innerHTML = `<img src="${escapeHtml(objUrl)}" alt="Vista previa" class="w-full h-full object-cover" />`;
    });
  });
}

function resolveActivePreviewPin(pins) {
  const activeId = getActiveCorkPinId();
  if (!activeId) return null;
  const found = pins.find((p) => p.id === activeId && ['file', 'note', 'link'].includes(p.type)) || null;
  if (!found) {
    setActiveCorkPinId(null);
    return null;
  }
  return found;
}

export function renderCorkboardQuadrant({
  lightboxChartIdx,
  lastPillBoard,
  selectedContextOt,
  selectedContextTask,
  selectedContextTaskIdx,
  selectedMediaIndex,
  isPersonalScope,
  isFullDesktop = false,
  roleCaps = null,
  userProfile = null,
  studioSettings = null,
  effectiveStatsPill = 'ots-active',
  statsEffectiveState = null,
  activeWsId = 'studio',
  deptChartPageWsId = null,
  dailyHours = 8,
  myMember = '',
  canSeeFinancial = false,
  scopedOrders = [],
  trafficOrders = [],
  todayKey = '',
  tomorrowKey = '',
  dragHandleHtml = '',
  rightActionBtns = '',
}) {
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  const storeOpts = { isPersonalScope, studioSettings, userProfile };
  const pins = ensureCorkPinsInitialized(storeOpts);
  void scopedOrders;

  // 1. Gráfico seleccionado desde Estadística (C02) -> se muestra en C04 con botón Pin
  if (lightboxChartIdx !== null && lastPillBoard && Array.isArray(lastPillBoard.cards) && lastPillBoard.cards[lightboxChartIdx]) {
    const card = lastPillBoard.cards[lightboxChartIdx];
    const currentChartMeta = {
      pillId: effectiveStatsPill,
      chartIdx: lightboxChartIdx,
      title: card.title,
      boardTitle: lastPillBoard.title || '',
      anchors: statsEffectiveState?.anchors || {},
      metric: statsEffectiveState?.metric || 'hours',
      filtersSnapshot: {
        pillId: effectiveStatsPill,
        anchors: statsEffectiveState?.anchors || {},
        metric: statsEffectiveState?.metric || 'hours',
        activeWsId,
        deptPageWsId: deptChartPageWsId,
        isPersonalScope,
        myMember,
      },
    };
    const isPinned = Boolean(findDuplicateChartPin(pins, currentChartMeta));
    return renderChartOverlay({
      lightboxChartIdx,
      lastPillBoard,
      canEdit: perms.canEdit,
      isPinned,
      isPinnedSnapshot: false,
      dragHandleHtml,
      rightActionBtns,
    });
  }

  // 2. OT / Tarea seleccionada -> Galería + Vista previa sobre C04 con botones Pin
  if (selectedContextOt) {
    const hasTask = Boolean(selectedContextTask) && Number.isInteger(selectedContextTaskIdx);
    const pinnedOt = Boolean(findDuplicateOtOrTaskPin(pins, {
      type: hasTask ? 'task' : 'ot',
      otId: selectedContextOt.id,
      taskIndex: hasTask ? selectedContextTaskIdx : null,
    }));
    const mediaItems = Array.isArray(selectedContextOt.mediaFiles) ? selectedContextOt.mediaFiles : [];
    const pinnedMediaIndices = new Set();
    mediaItems.forEach((m, mIdx) => {
      if (findDuplicateOtMediaPin(pins, { otId: selectedContextOt.id, mediaIndex: mIdx, title: m.name })) {
        pinnedMediaIndices.add(mIdx);
      }
    });
    return renderOtGalleryOverlay({
      selectedContextOt,
      selectedContextTask,
      selectedContextTaskIdx,
      selectedMediaIndex,
      canEdit: perms.canEdit,
      pinnedOt,
      pinnedMediaIndices,
      borderClass: 'border-t-2 border-t-obsidian-amber/80',
      dragHandleHtml,
      collapseBtnHtml: rightActionBtns,
    });
  }

  // 2b. Gráfico clavado abierto desde el propio Corcho (usa su filtersSnapshot inmutable)
  const activePinnedChartId = getActivePinnedChartId();
  if (activePinnedChartId) {
    const chartPin = pins.find((p) => p.id === activePinnedChartId && p.type === 'chart');
    if (chartPin) {
      const resolved = buildPinnedChartBoard(chartPin.chartMeta, {
        trafficOrders,
        todayKey,
        tomorrowKey,
        dailyHours,
        canSeeFinancial,
        myMember,
      });
      if (resolved) {
        return renderChartOverlay({
          lightboxChartIdx: resolved.chartIdx,
          lastPillBoard: resolved.board,
          canEdit: perms.canEdit,
          isPinned: true,
          isPinnedSnapshot: true,
          snapshotSummary: resolved.summary,
          dragHandleHtml,
          rightActionBtns,
        });
      }
    }
    closePinnedChart();
  }

  // 3. Estado 1 (Cuadrícula de Corcho) o Estado 2 (Vista Previa de Pin dentro de C04)
  const activePin = resolveActivePreviewPin(pins);
  const activeComposer = perms.canEdit && !activePin ? getActiveCorkComposer() : null;

  return `
    <div data-dk-cork-root="1" data-dk-cork-editable="${perms.canEdit ? '1' : '0'}" data-dk-cork-mode="${activePin ? 'preview' : 'grid'}"
      class="relative p-3 border-t-2 border-t-cyan-500/70 flex flex-col min-h-0 flex-1 bg-[#161616]/60 transition-colors">
      <div class="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-obsidian-border/70 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0 flex-1">
          <span data-dk-cork-drag-slot="1" class="${activePin ? 'hidden' : 'inline-flex items-center shrink-0'}">${dragHandleHtml}</span>
          <div data-dk-cork-header-left="1" class="flex items-center gap-1.5 min-w-0 flex-1">
            ${activePin
              ? renderCorkPinPreviewHeaderLeft(activePin, { canEdit: perms.canEdit })
              : `<span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">Tablero de Corcho</span>`}
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div data-dk-cork-actions="1" class="${activePin ? 'hidden' : 'flex items-center gap-2 shrink-0'}">
            ${renderCorkHeaderActions(perms.canEdit, activeComposer)}
            <span class="text-[8.5px] font-mono text-[#666666] uppercase tracking-wider shrink-0">${isPersonalScope ? 'Personal' : 'Estudio'}</span>
          </div>
          <div data-dk-cork-desktop-controls="1" class="inline-flex items-center gap-1 shrink-0">
            ${rightActionBtns}
          </div>
          <div data-dk-cork-close-slot="1" class="${activePin ? 'inline-flex items-center shrink-0' : 'hidden'}">
            ${activePin ? renderCorkPinPreviewCloseBtn() : ''}
          </div>
        </div>
      </div>

      ${perms.canEdit ? `
        <div data-dk-cork-dropzone-overlay="1" aria-hidden="true"
          class="hidden pointer-events-none absolute inset-2 z-10 rounded-lg border-2 border-dashed border-cyan-500/70 bg-[#141c20]/80 flex items-center justify-center">
          <span class="font-mono text-[10px] uppercase tracking-wider text-cyan-300 font-semibold">Soltar para fijar en el Corcho</span>
        </div>
        <label for="cork-file-upload-input" class="sr-only">Subir archivo al Tablero de Corcho</label>
        <input id="cork-file-upload-input" name="cork_file_upload" type="file" multiple data-cork-file-input="1" class="hidden" />
      ` : ''}

      <div data-dk-cork-body="1" data-dk-scroll-id="${activePin ? `corkboard-preview:${escapeHtml(activePin.id)}` : `corkboard-grid:${isPersonalScope ? 'personal' : 'global'}`}"
        class="flex-1 min-h-0 ${activePin ? 'overflow-hidden' : 'overflow-y-auto pr-0.5'} flex flex-col">
        ${activePin
          ? renderCorkPinPreview({
              pin: activePin,
              canEdit: perms.canEdit,
              roleCaps,
              userProfile,
              trafficOrders,
            })
          : renderCorkBodyHtml({
              pins,
              isFullDesktop,
              canEdit: perms.canEdit,
              activeComposer,
              errorMsg: composerErrorMsg,
              noticeMsg: corkNoticeMsg,
              trafficOrders,
              todayKey,
              tomorrowKey,
              dailyHours,
              canSeeFinancial,
              myMember,
            })}
      </div>

      <div data-dk-cork-footer="1" class="flex items-center justify-between text-[8.5px] font-mono text-[#4A4A4A] pt-1.5 mt-1.5 border-t border-obsidian-border/40 shrink-0">
        ${activePin
          ? renderCorkPinPreviewFooter(activePin, { canEdit: perms.canEdit, isPersonalScope })
          : `<span>CORCHO · ${pins.length} ${pins.length === 1 ? 'ficha' : 'fichas'}</span>
             <span>${isPersonalScope ? 'Privado' : (perms.canEdit ? 'Estudio · Editable' : 'Estudio · Solo lectura')}</span>`}
      </div>
    </div>
  `;
}

function bindCorkboardLocalContentEvents(corkRoot, ctx, rerenderLocal) {
  const { isPersonalScope, roleCaps, userProfile, studioSettings } = ctx;
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  const storeOpts = { isPersonalScope, studioSettings, userProfile };

  // Botones inline + Nota / + Enlace
  corkRoot.querySelectorAll('[data-cork-open-composer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!perms.canEdit) return;
      const mode = btn.dataset.corkOpenComposer;
      const next = getActiveCorkComposer() === mode ? null : mode;
      composerErrorMsg = '';
      setActiveCorkComposer(next);
      rerenderLocal();
      if (next === 'note') corkRoot.querySelector('#cork-note-title')?.focus();
      if (next === 'link') corkRoot.querySelector('#cork-link-url')?.focus();
    });
  });

  // Botón + Archivo -> dispara input file local
  corkRoot.querySelector('[data-cork-trigger-file]')?.addEventListener('click', () => {
    if (!perms.canEdit) return;
    composerErrorMsg = '';
    if (getActiveCorkComposer()) {
      setActiveCorkComposer(null);
      rerenderLocal();
    }
    const input = corkRoot.querySelector('[data-cork-file-input]');
    if (input) {
      input.value = '';
      input.click();
    }
  });

  // Cancelar compositor inline
  corkRoot.querySelectorAll('[data-cork-cancel-composer]').forEach((btn) => {
    btn.addEventListener('click', () => {
      composerErrorMsg = '';
      setActiveCorkComposer(null);
      rerenderLocal();
    });
  });

  // Guardar Nota
  corkRoot.querySelector('[data-cork-form="note"]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!perms.canEdit) return;
    const title = String(corkRoot.querySelector('#cork-note-title')?.value || '').trim();
    const content = String(corkRoot.querySelector('#cork-note-content')?.value || '').trim();
    if (!title) {
      composerErrorMsg = 'Escribe un título para la nota.';
      rerenderLocal();
      return;
    }
    composerErrorMsg = '';
    addCorkPin({ type: 'note', title, content }, storeOpts);
    setActiveCorkComposer(null);
    rerenderLocal();
  });

  // Guardar Enlace (normaliza https:// y bloquea esquemas no http/https)
  corkRoot.querySelector('[data-cork-form="link"]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!perms.canEdit) return;
    const rawUrl = String(corkRoot.querySelector('#cork-link-url')?.value || '');
    const customTitle = String(corkRoot.querySelector('#cork-link-title')?.value || '').trim();
    const parsed = normalizeSafeWebUrl(rawUrl);
    if (!parsed.ok) {
      composerErrorMsg = parsed.error;
      rerenderLocal();
      corkRoot.querySelector('#cork-link-url')?.focus();
      return;
    }
    composerErrorMsg = '';
    addCorkPin({ type: 'link', title: customTitle || parsed.domain, url: parsed.url }, storeOpts);
    setActiveCorkComposer(null);
    rerenderLocal();
  });

  // Abrir OT o Tarea exacta desde ficha clavada
  corkRoot.querySelectorAll('[data-cork-open-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const otId = btn.dataset.corkOpenOt;
      if (!otId) return;
      const rawTaskIdx = btn.dataset.corkOpenTaskIdx;
      const taskIdx = rawTaskIdx !== undefined && rawTaskIdx !== '' ? Number(rawTaskIdx) : null;
      ctx.openOt?.(otId, Number.isInteger(taskIdx) ? taskIdx : null);
    });
  });

  // Abrir Vista Previa (Estado 2) al hacer clic en ficha file, note o link
  corkRoot.querySelectorAll('[data-cork-open-preview]').forEach((cardEl) => {
    const openPreview = (e) => {
      if (e?.target?.closest('button, a, input, textarea')) return;
      const pinId = cardEl.dataset.corkOpenPreview;
      if (!pinId) return;
      setActiveCorkComposer(null);
      setActiveCorkPinId(pinId);
      rerenderLocal();
    };
    cardEl.addEventListener('click', openPreview);
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openPreview(e);
      }
    });
  });

  // Abrir gráfico clavado en vista ampliada usando su filtersSnapshot (sin mutar C02)
  corkRoot.querySelectorAll('[data-cork-open-pinned-chart]').forEach((cardEl) => {
    const openChart = (e) => {
      if (e?.target?.closest('button')) return;
      const pinId = cardEl.dataset.corkOpenPinnedChart;
      if (!pinId) return;
      setActivePinnedChartId(pinId);
      ctx.rerender?.();
    };
    cardEl.addEventListener('click', openChart);
    cardEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openChart(e);
      }
    });
  });

  // Reordenamiento interno de fichas por ID (HU-04 · MIME dedicado DND_MIME_CORK_CARD, aislado de cuadrantes y dropzone externo)
  if (perms.canEdit) {
    let draggedCardId = null;
    const clearCardIndicators = () => {
      corkRoot.querySelectorAll('[data-cork-card-id]').forEach((el) => {
        el.classList.remove('ring-2', 'ring-inset', 'ring-cyan-500/70', 'opacity-50');
      });
    };

    corkRoot.querySelectorAll('[data-cork-card-id]').forEach((cardEl) => {
      const cardId = cardEl.dataset.corkCardId;
      if (!cardId) return;

      cardEl.addEventListener('dragstart', (e) => {
        if (e.target && e.target.closest('button, a, input, textarea')) {
          e.preventDefault();
          return;
        }
        e.stopPropagation();
        draggedCardId = cardId;
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData(DND_MIME_CORK_CARD, cardId);
        }
        cardEl.classList.add('opacity-50');
      });

      cardEl.addEventListener('dragend', (e) => {
        e.stopPropagation();
        draggedCardId = null;
        clearCardIndicators();
      });

      cardEl.addEventListener('dragover', (e) => {
        const types = Array.from(e.dataTransfer?.types || []);
        const isInternal = draggedCardId !== null || types.includes(DND_MIME_CORK_CARD);
        if (!isInternal || draggedCardId === cardId) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        cardEl.classList.add('ring-2', 'ring-inset', 'ring-cyan-500/70');
      });

      cardEl.addEventListener('dragleave', (e) => {
        if (e.relatedTarget && cardEl.contains(e.relatedTarget)) return;
        cardEl.classList.remove('ring-2', 'ring-inset', 'ring-cyan-500/70');
      });

      cardEl.addEventListener('drop', (e) => {
        const types = Array.from(e.dataTransfer?.types || []);
        const isInternal = draggedCardId !== null || types.includes(DND_MIME_CORK_CARD);
        if (!isInternal) return;
        e.preventDefault();
        e.stopPropagation();
        const fromId = draggedCardId || e.dataTransfer?.getData(DND_MIME_CORK_CARD) || '';
        draggedCardId = null;
        clearCardIndicators();
        if (!fromId || fromId === cardId) return;
        const res = reorderCorkPins(getCorkStorageKey(storeOpts), fromId, cardId);
        if (res.moved) rerenderLocal();
      });
    });
  }

  // Despinar ficha (×)
  corkRoot.querySelectorAll('[data-cork-unpin]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!perms.canEdit) return;
      const pinId = btn.dataset.corkUnpin;
      if (!pinId) return;
      removeCorkPin(pinId, storeOpts);
      rerenderLocal();
    });
  });

  hydrateCorkThumbnails(corkRoot);
  if (corkRoot.dataset.dkCorkMode === 'preview') {
    bindCorkPreviewEvents(corkRoot, { ...ctx, rerenderLocal });
  }
}

function markOverlayPinButtonPinned(btn, labelText = 'Fijado') {
  if (!btn) return;
  btn.dataset.corkPinned = '1';
  btn.classList.remove('text-[#8C8C8C]', 'text-[#737373]', 'hover:bg-obsidian-elevated', 'opacity-70');
  btn.classList.add('text-obsidian-amber', 'bg-amber-500/15');
  const span = btn.querySelector('span');
  if (span) span.textContent = labelText;
}

function bindOverlayPinEvents(container, ctx) {
  const {
    isPersonalScope = false,
    roleCaps = null,
    userProfile = null,
    studioSettings = null,
    selectedContextOt = null,
    selectedContextTask = null,
    selectedContextTaskIdx = null,
    lightboxChartIdx = null,
    lastPillBoard = null,
    effectiveStatsPill = 'ots-active',
    statsEffectiveState = null,
    activeWsId = 'studio',
    deptChartPageWsId = null,
    myMember = '',
    rerender,
  } = ctx;
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  const storeOpts = { isPersonalScope, studioSettings, userProfile };

  // Cerrar gráfico clavado abierto desde el Corcho (sin tocar C02)
  container.querySelector('[data-cork-close-pinned-chart="1"]')?.addEventListener('click', () => {
    closePinnedChart();
    rerender?.();
  });

  if (!perms.canEdit) return;

  // Pin de gráfico ampliado desde C02 (guarda copia profunda de filtersSnapshot)
  container.querySelector('[data-dk-cork-pin-chart="1"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (lightboxChartIdx === null || !lastPillBoard?.cards?.[lightboxChartIdx]) return;
    const card = lastPillBoard.cards[lightboxChartIdx];
    addChartCorkPin({
      pillId: effectiveStatsPill,
      chartIdx: lightboxChartIdx,
      title: card.title,
      boardTitle: lastPillBoard.title || '',
      anchors: statsEffectiveState?.anchors || {},
      metric: statsEffectiveState?.metric || 'hours',
      filtersSnapshot: {
        pillId: effectiveStatsPill,
        anchors: statsEffectiveState?.anchors || {},
        metric: statsEffectiveState?.metric || 'hours',
        activeWsId,
        deptPageWsId: deptChartPageWsId,
        isPersonalScope,
        myMember,
      },
    }, storeOpts);
    markOverlayPinButtonPinned(e.currentTarget, 'Fijado');
  });

  // Pin de la OT / Tarea actual desde cabecera de Galería
  container.querySelector('[data-dk-cork-pin-ctx-ot="1"]')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!selectedContextOt) return;
    const hasTask = Boolean(selectedContextTask) && Number.isInteger(selectedContextTaskIdx);
    addOtOrTaskCorkPin({
      type: hasTask ? 'task' : 'ot',
      otId: selectedContextOt.id,
      taskIndex: hasTask ? selectedContextTaskIdx : null,
      title: hasTask ? (selectedContextTask.title || selectedContextOt.title) : selectedContextOt.title,
    }, storeOpts);
    markOverlayPinButtonPinned(e.currentTarget, 'Fijada');
  });

  // Pin de archivo de OT por referencia (desde tarjeta de Galería o cabecera de Vista previa)
  container.querySelectorAll('[data-dk-cork-pin-media]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!selectedContextOt) return;
      const mIdx = Number(btn.dataset.dkCorkPinMedia);
      const media = Number.isInteger(mIdx) ? (selectedContextOt.mediaFiles || [])[mIdx] : null;
      if (!media) return;
      const isPdf = /\.pdf$/i.test(media.name || '') || /PDF/i.test(media.meta || '');
      const isVideo = /\.(mp4|mov|webm)$/i.test(media.name || '') || /VIDEO/i.test(media.meta || '');
      const inferredMime = isPdf ? 'application/pdf' : (isVideo ? 'video/mp4' : 'image/png');
      addOtMediaCorkPin({
        otId: selectedContextOt.id,
        mediaIndex: mIdx,
        title: media.name || 'Archivo de OT',
        mime: media.mime || inferredMime,
        sizeLabel: media.meta || '',
      }, storeOpts);
      container.querySelectorAll(`[data-dk-cork-pin-media="${mIdx}"]`).forEach((matchingBtn) => {
        markOverlayPinButtonPinned(matchingBtn, 'Fijado');
      });
    });
  });
}

/**
 * Capa propia de eventos de C04.
 * Regla 3: enlaza eventos únicamente dentro de `container` (nunca en window/document)
 * y realiza re-render local de C04 preservando listeners del Escritorio en cabecera.
 */
export function bindCorkboardEvents(container, ctx = {}) {
  if (!container) return;
  bindOverlayPinEvents(container, ctx);

  const corkRoot = container.querySelector('[data-dk-cork-root="1"]');
  if (!corkRoot) return;

  const {
    isPersonalScope = false,
    isFullDesktop = false,
    roleCaps = null,
    userProfile = null,
    studioSettings = null,
    trafficOrders = [],
    todayKey = '',
    tomorrowKey = '',
    dailyHours = 8,
    canSeeFinancial = false,
    myMember = '',
  } = ctx;
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  const storeOpts = { isPersonalScope, studioSettings, userProfile };

  const rerenderLocal = () => {
    const dragSlot = corkRoot.querySelector('[data-dk-cork-drag-slot="1"]');
    const headerLeftSlot = corkRoot.querySelector('[data-dk-cork-header-left="1"]');
    const actionsSlot = corkRoot.querySelector('[data-dk-cork-actions="1"]');
    const closeSlot = corkRoot.querySelector('[data-dk-cork-close-slot="1"]');
    const bodySlot = corkRoot.querySelector('[data-dk-cork-body="1"]');
    const footerSlot = corkRoot.querySelector('[data-dk-cork-footer="1"]');
    if (!bodySlot) return;
    const prevScrollTop = bodySlot.scrollTop;
    const pins = ensureCorkPinsInitialized(storeOpts);
    const activePin = resolveActivePreviewPin(pins);
    const activeComposer = perms.canEdit && !activePin ? getActiveCorkComposer() : null;

    corkRoot.dataset.dkCorkMode = activePin ? 'preview' : 'grid';
    if (dragSlot) dragSlot.classList.toggle('hidden', Boolean(activePin));
    if (headerLeftSlot) {
      headerLeftSlot.innerHTML = activePin
        ? renderCorkPinPreviewHeaderLeft(activePin, { canEdit: perms.canEdit })
        : `<span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">Tablero de Corcho</span>`;
    }
    if (actionsSlot) {
      actionsSlot.classList.toggle('hidden', Boolean(activePin));
      if (!activePin) {
        actionsSlot.innerHTML = `
          ${renderCorkHeaderActions(perms.canEdit, activeComposer)}
          <span class="text-[8.5px] font-mono text-[#666666] uppercase tracking-wider shrink-0">${isPersonalScope ? 'Personal' : 'Estudio'}</span>
        `;
      }
    }
    if (closeSlot) {
      closeSlot.classList.toggle('hidden', !activePin);
      closeSlot.innerHTML = activePin ? renderCorkPinPreviewCloseBtn() : '';
    }

    bodySlot.classList.toggle('overflow-hidden', Boolean(activePin));
    bodySlot.classList.toggle('overflow-y-auto', !activePin);
    bodySlot.classList.toggle('pr-0.5', !activePin);
    bodySlot.dataset.dkScrollId = activePin
      ? `corkboard-preview:${activePin.id}`
      : `corkboard-grid:${isPersonalScope ? 'personal' : 'global'}`;

    bodySlot.innerHTML = activePin
      ? renderCorkPinPreview({
          pin: activePin,
          canEdit: perms.canEdit,
          roleCaps,
          userProfile,
          trafficOrders,
        })
      : renderCorkBodyHtml({
          pins,
          isFullDesktop,
          canEdit: perms.canEdit,
          activeComposer,
          errorMsg: composerErrorMsg,
          noticeMsg: corkNoticeMsg,
          trafficOrders,
          todayKey,
          tomorrowKey,
          dailyHours,
          canSeeFinancial,
          myMember,
        });

    if (footerSlot) {
      footerSlot.innerHTML = activePin
        ? renderCorkPinPreviewFooter(activePin, { canEdit: perms.canEdit, isPersonalScope })
        : `<span>CORCHO · ${pins.length} ${pins.length === 1 ? 'ficha' : 'fichas'}</span>
           <span>${isPersonalScope ? 'Privado' : (perms.canEdit ? 'Estudio · Editable' : 'Estudio · Solo lectura')}</span>`;
    }
    bodySlot.scrollTop = activePin ? 0 : prevScrollTop;
    bindCorkboardLocalContentEvents(corkRoot, ctx, rerenderLocal);
  };

  const showTransientNotice = (msg) => {
    corkNoticeMsg = msg;
    if (corkNoticeTimer) clearTimeout(corkNoticeTimer);
    corkNoticeTimer = setTimeout(() => {
      corkNoticeMsg = '';
      corkNoticeTimer = null;
      // Remueve solo el nodo del aviso para no interrumpir escritura activa ni robar el foco
      if (corkRoot.isConnected) {
        corkRoot.querySelector('[data-dk-cork-notice="1"]')?.remove();
      }
    }, 2800);
  };

  // Input de archivo local (guarda blob en IndexedDB y metadata en localStorage; soporta múltiples archivos)
  const fileInput = corkRoot.querySelector('[data-cork-file-input="1"]');
  fileInput?.addEventListener('change', async () => {
    if (!perms.canEdit) return;
    const files = fileInput.files;
    if (!files || !files.length) return;
    await addLocalFilesToCorkboard(files, storeOpts);
    fileInput.value = '';
    rerenderLocal();
  });

  // Dropzone sin parpadeo (HU-01) + aislamiento total frente a intercambio de cuadrantes
  const dropOverlay = corkRoot.querySelector('[data-dk-cork-dropzone-overlay="1"]');
  let dragEnterDepth = 0;

  const setDropzoneActive = (active) => {
    if (!perms.canEdit || !dropOverlay) return;
    dropOverlay.classList.toggle('hidden', !active);
  };

  const hasType = (e, mime) => Array.from(e.dataTransfer?.types || []).includes(mime);
  const isInternalCorkDrag = (e) => hasType(e, DND_MIME_CORK_CARD);
  const isPinOrFileDrop = (e) => !isInternalCorkDrag(e) && (hasType(e, DND_MIME_PIN) || hasType(e, 'Files'));

  corkRoot.addEventListener('dragenter', (e) => {
    if (isInternalCorkDrag(e)) {
      e.stopPropagation();
      return;
    }
    if (!isPinOrFileDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (!perms.canEdit) return;
    dragEnterDepth += 1;
    setDropzoneActive(true);
  });

  corkRoot.addEventListener('dragover', (e) => {
    if (isInternalCorkDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      return;
    }
    if (!isPinOrFileDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = perms.canEdit ? 'copy' : 'none';
    if (perms.canEdit) setDropzoneActive(true);
  });

  corkRoot.addEventListener('dragleave', (e) => {
    if (!isPinOrFileDrop(e)) return;
    e.stopPropagation();
    dragEnterDepth = Math.max(0, dragEnterDepth - 1);
    if (dragEnterDepth === 0 || !e.relatedTarget || !corkRoot.contains(e.relatedTarget)) {
      dragEnterDepth = 0;
      setDropzoneActive(false);
    }
  });

  corkRoot.addEventListener('dragend', () => {
    dragEnterDepth = 0;
    setDropzoneActive(false);
  });

  corkRoot.addEventListener('drop', async (e) => {
    if (isInternalCorkDrag(e)) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!isPinOrFileDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    dragEnterDepth = 0;
    setDropzoneActive(false);
    if (!perms.canEdit) return;

    // 1. Drop de OT / Tarea arrastrada desde C01 o C03 (MIME dedicado leído solo en drop)
    if (hasType(e, DND_MIME_PIN)) {
      const raw = e.dataTransfer?.getData(DND_MIME_PIN) || '';
      if (!raw) return;
      try {
        const payload = JSON.parse(raw);
        const type = payload?.type === 'task' ? 'task' : 'ot';
        const otId = String(payload?.otId || '');
        const taskIndex = Number.isInteger(payload?.taskIndex) ? payload.taskIndex : null;
        if (!otId) return;
        const liveOt = (trafficOrders || []).find((o) => o.id === otId) || null;
        const liveTask = type === 'task' && liveOt && taskIndex !== null
          ? ((liveOt.subtasks || [])[taskIndex] || null)
          : null;
        const title = type === 'task'
          ? (liveTask?.title || liveOt?.title || otId)
          : (liveOt?.title || otId);
        const res = addOtOrTaskCorkPin({ type, otId, taskIndex, title }, storeOpts);
        if (res.duplicate) {
          const shortCode = String(otId).replace(/^OT-/i, '');
          const label = type === 'task' && taskIndex !== null ? `${shortCode}.${taskIndex + 1}` : shortCode;
          showTransientNotice(`${label} ya está fijada en este Corcho.`);
        }
        rerenderLocal();
      } catch {
        // payload malformado: ignorar de forma segura
      }
      return;
    }

    // 2. Drop de uno o varios archivos desde el sistema operativo
    const droppedFiles = e.dataTransfer?.files;
    if (droppedFiles && droppedFiles.length) {
      await addLocalFilesToCorkboard(droppedFiles, storeOpts);
      rerenderLocal();
    }
  });

  bindCorkboardLocalContentEvents(corkRoot, ctx, rerenderLocal);
}
