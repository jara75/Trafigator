/**
 * Cuadrante C04 Tablero de Corcho del Escritorio:
 * - Modo contextual 1: Gráfico ampliado desde C02 Estadística
 * - Modo contextual 2: Galería + Vista previa de OT/Tarea seleccionada
 * - Modo base: Tablero de Corcho (Scrivener-style)
 * - Renderizado y capa de eventos locales (con datos/estado en desktop-corkboard-store.js)
 */

import {
  escapeHtml,
  formatShortDate,
  getClientColor,
  getPriorityDotHtml,
} from './store.js';
import {
  DND_MIME_CORK_CARD,
  DND_MIME_PIN,
  DND_MIME_SLOT,
  addCorkPin,
  addLocalFilesToCorkboard,
  addOtOrTaskCorkPin,
  closeCorkPinPreview,
  ensureCorkPinsInitialized,
  getActiveCorkComposer,
  getCorkBlobObjectUrl,
  getCorkboardPermissions,
  getFileTypeTag,
  hasOpenCorkPinPreview,
  normalizeSafeWebUrl,
  removeCorkPin,
  setActiveCorkComposer,
} from './desktop-corkboard-store.js';
import {
  renderChartOverlay,
  renderOtGalleryOverlay,
} from './desktop-corkboard-overlays.js';

// Re-exportación limpia para mantener dirección única: desktop.js → desktop-corkboard.js → { store, overlays }
export {
  DND_MIME_PIN,
  DND_MIME_SLOT,
  closeCorkPinPreview,
  hasOpenCorkPinPreview,
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

function renderCorkPinCard(pin, idx, { canEdit, trafficOrders = [], todayKey = '', tomorrowKey = '' }) {
  const notesCount = Array.isArray(pin.highlights) ? pin.highlights.length : 0;
  const unpinBtn = canEdit
    ? `<button type="button" data-cork-unpin="${escapeHtml(pin.id)}" title="Quitar del Corcho" aria-label="Quitar ${escapeHtml(pin.title || 'ficha')} del Corcho"
         class="opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded text-[#737373] hover:text-rose-400 hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0">
         <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       </button>`
    : '';

  if (pin.type === 'ot' || pin.type === 'task') {
    const isTask = pin.type === 'task';
    const liveOt = (trafficOrders || []).find((o) => o.id === pin.otId) || null;
    const liveTask = isTask && liveOt && Number.isInteger(pin.taskIndex)
      ? ((liveOt.subtasks || [])[pin.taskIndex] || null)
      : null;
    const shortBase = String(pin.otId || '').replace(/^OT-/i, '');
    const codeLabel = isTask && Number.isInteger(pin.taskIndex) ? `${shortBase}.${pin.taskIndex + 1}` : shortBase;
    const title = isTask
      ? (liveTask?.title || pin.title || liveOt?.title || 'Tarea')
      : (liveOt?.title || pin.title || 'Orden de Trabajo');
    const client = liveOt?.client || '';
    const deliveryDate = isTask ? (liveTask?.deliveryDate || liveOt?.deliveryDate || '') : (liveOt?.deliveryDate || '');
    const urgent = Boolean(isTask ? (liveTask?.urgent || liveOt?.urgent) : liveOt?.urgent);
    const priorityDot = getPriorityDotHtml({ urgent, deliveryDate }, todayKey, tomorrowKey, 'w-1.5 h-1.5');
    const cColor = getClientColor(client);
    const taskAttr = isTask && Number.isInteger(pin.taskIndex) ? `data-cork-open-task-idx="${pin.taskIndex}"` : '';

    return `
      <article data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 transition-colors">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-1.5">
            <div class="inline-flex items-center gap-1.5 min-w-0">
              ${priorityDot}
              <span class="font-mono text-[8.5px] uppercase tracking-wider text-[#8C8C8C] font-semibold shrink-0">${isTask ? 'TAREA' : 'OT'}</span>
              <button type="button" data-cork-open-ot="${escapeHtml(pin.otId || '')}" ${taskAttr} title="Abrir ${isTask ? 'Tarea' : 'OT'}"
                class="font-mono text-[9.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer truncate">${escapeHtml(codeLabel || '—')}</button>
            </div>
            ${unpinBtn}
          </div>
          <h4 class="text-[10.5px] font-medium text-[#D4D4D4] leading-snug line-clamp-2" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
        </div>
        <div class="flex items-center justify-between gap-1.5 text-[8.5px] pt-1 border-t border-obsidian-border/50 min-w-0">
          <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(client || (liveOt ? 'Estudio' : 'Referencia'))}</span>
          <span class="font-mono text-[#737373] shrink-0">${escapeHtml(formatShortDate(deliveryDate) || '—')}</span>
        </div>
      </article>
    `;
  }

  if (pin.type === 'note') {
    const excerpt = String(pin.content || '').trim();
    return `
      <article data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 transition-colors">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-1.5">
            <span class="font-mono text-[8.5px] uppercase tracking-wider text-[#8C8C8C] font-semibold">NOTA</span>
            ${unpinBtn}
          </div>
          <h4 class="text-[11px] font-medium text-[#D4D4D4] leading-snug line-clamp-2" title="${escapeHtml(pin.title)}">${escapeHtml(pin.title || 'Nota sin título')}</h4>
          ${excerpt ? `<p class="text-[10px] text-[#8C8C8C] leading-snug line-clamp-3 whitespace-pre-line">${escapeHtml(excerpt)}</p>` : ''}
        </div>
        <div class="flex items-center justify-between text-[8.5px] font-mono text-[#5A5A5A] pt-1 border-t border-obsidian-border/50">
          <span>${pin.demoPackId ? 'DEMO' : 'FICHA'}</span>
          <span>${notesCount ? `${notesCount} ap.` : 'Scrivener'}</span>
        </div>
      </article>
    `;
  }

  if (pin.type === 'link') {
    let domain = '';
    try {
      domain = new URL(pin.url).hostname.replace(/^www\./i, '');
    } catch {
      domain = pin.url || '';
    }
    return `
      <article data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 transition-colors">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-1.5">
            <span class="font-mono text-[8.5px] uppercase tracking-wider text-sky-400/90 font-semibold">WEB</span>
            <div class="flex items-center gap-0.5 shrink-0">
              ${pin.url ? `<a href="${escapeHtml(pin.url)}" target="_blank" rel="noopener noreferrer" title="Abrir enlace en nueva pestaña" aria-label="Abrir ${escapeHtml(pin.title || domain)} en nueva pestaña"
                class="w-5 h-5 rounded text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated flex items-center justify-center font-mono text-[10px] transition-colors">↗</a>` : ''}
              ${unpinBtn}
            </div>
          </div>
          <h4 class="text-[11px] font-medium text-[#D4D4D4] leading-snug line-clamp-2" title="${escapeHtml(pin.title || domain)}">${escapeHtml(pin.title || domain || 'Enlace web')}</h4>
          <div class="text-[9.5px] font-mono text-[#737373] truncate" title="${escapeHtml(pin.url)}">${escapeHtml(domain)}</div>
        </div>
        <div class="flex items-center justify-between text-[8.5px] font-mono text-[#5A5A5A] pt-1 border-t border-obsidian-border/50">
          <span>ENLACE</span>
          <span>${notesCount ? `${notesCount} ap.` : '↗ Ext.'}</span>
        </div>
      </article>
    `;
  }

  // Tipo 'file' (y fallback genérico limpio)
  const tag = getFileTypeTag(pin.fileMeta?.mime, pin.title);
  const tagColorCls = tag === 'PDF'
    ? 'text-rose-400'
    : (tag === 'VID' ? 'text-sky-400' : (tag === 'IMG' ? 'text-obsidian-amber' : 'text-[#8C8C8C]'));
  const shortOt = pin.otId ? String(pin.otId).replace(/^OT-/i, '') : '';
  const sizeLabel = pin.fileMeta?.sizeLabel || '';
  const blobId = pin.fileMeta?.blobId || '';
  const thumbHtml = tag === 'IMG' && blobId
    ? `<div data-cork-blob-thumb="${escapeHtml(blobId)}" class="h-14 rounded bg-[#141414] border border-obsidian-border/70 flex items-center justify-center overflow-hidden">
         <span class="font-mono text-[9px] text-[#5A5A5A]">IMG</span>
       </div>`
    : `<div class="h-10 rounded bg-[#141414] border border-obsidian-border/70 flex items-center justify-between px-2">
         <span class="font-mono text-[9.5px] font-semibold ${tagColorCls}">${tag}</span>
         ${sizeLabel ? `<span class="font-mono text-[8.5px] text-[#666666]">${escapeHtml(sizeLabel)}</span>` : ''}
       </div>`;

  return `
    <article data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
      class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 transition-colors">
      <div class="space-y-1.5 min-w-0">
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-mono text-[8.5px] uppercase tracking-wider font-semibold ${tagColorCls}">${tag}</span>
            ${shortOt ? `<span class="font-mono text-[8.5px] text-obsidian-amber truncate">${escapeHtml(shortOt)}</span>` : ''}
          </div>
          ${unpinBtn}
        </div>
        ${thumbHtml}
        <h4 class="text-[10.5px] font-medium text-[#D4D4D4] leading-snug truncate" title="${escapeHtml(pin.title)}">${escapeHtml(pin.title || 'Archivo')}</h4>
      </div>
      <div class="flex items-center justify-between text-[8.5px] font-mono text-[#5A5A5A] pt-1 border-t border-obsidian-border/50">
        <span>${escapeHtml(sizeLabel || (pin.demoPackId ? 'DEMO' : 'LOCAL'))}</span>
        <span>${notesCount ? `${notesCount} ap.` : (blobId ? 'IDB' : 'REF')}</span>
      </div>
    </article>
  `;
}

function renderCorkBodyHtml({ pins, isFullDesktop, canEdit, activeComposer, errorMsg, noticeMsg = '', trafficOrders = [], todayKey = '', tomorrowKey = '' }) {
  const gridColsCls = isFullDesktop ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2';
  const noticeHtml = noticeMsg
    ? `<div data-dk-cork-notice="1" role="status" class="mb-2 px-2.5 py-1 rounded-md bg-[#202020] border border-obsidian-border font-mono text-[9.5px] text-obsidian-amber shrink-0">${escapeHtml(noticeMsg)}</div>`
    : '';
  const composerHtml = canEdit ? renderCorkComposerHtml(activeComposer, errorMsg) : '';
  const listHtml = pins.length
    ? `<div class="grid ${gridColsCls} gap-2 content-start">${pins.map((p, idx) => renderCorkPinCard(p, idx, { canEdit, trafficOrders, todayKey, tomorrowKey })).join('')}</div>`
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
  scopedOrders = [],
  trafficOrders = [],
  todayKey = '',
  tomorrowKey = '',
  dragHandleHtml = '',
  rightActionBtns = '',
}) {
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  void effectiveStatsPill;
  void statsEffectiveState;
  void scopedOrders;
  void trafficOrders;
  void todayKey;
  void tomorrowKey;

  // 1. Gráfico seleccionado desde Estadística -> se muestra en C04 (sin modal)
  if (lightboxChartIdx !== null && lastPillBoard && Array.isArray(lastPillBoard.cards) && lastPillBoard.cards[lightboxChartIdx]) {
    return renderChartOverlay({
      lightboxChartIdx,
      lastPillBoard,
      dragHandleHtml,
      rightActionBtns,
    });
  }

  // 2. OT / Tarea seleccionada -> Galería + Vista previa sobre C04
  if (selectedContextOt) {
    return renderOtGalleryOverlay({
      selectedContextOt,
      selectedContextTask,
      selectedContextTaskIdx,
      selectedMediaIndex,
      borderClass: 'border-t-2 border-t-obsidian-amber/80',
      dragHandleHtml,
      collapseBtnHtml: rightActionBtns,
    });
  }

  // 3. Estado base: Tablero de Corcho (estilo Scrivener)
  const storeOpts = { isPersonalScope, studioSettings, userProfile };
  const pins = ensureCorkPinsInitialized(storeOpts);
  const activeComposer = perms.canEdit ? getActiveCorkComposer() : null;

  return `
    <div data-dk-cork-root="1" data-dk-cork-editable="${perms.canEdit ? '1' : '0'}"
      class="relative p-3 border-t-2 border-t-cyan-500/70 flex flex-col min-h-0 flex-1 bg-[#161616]/60 transition-colors">
      <div class="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-obsidian-border/70 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">Tablero de Corcho</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <div data-dk-cork-actions="1" class="flex items-center gap-1 shrink-0">
            ${renderCorkHeaderActions(perms.canEdit, activeComposer)}
          </div>
          <span class="text-[8.5px] font-mono text-[#666666] uppercase tracking-wider shrink-0">${isPersonalScope ? 'Personal' : 'Estudio'}</span>
          ${rightActionBtns}
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

      <div data-dk-cork-body="1" data-dk-scroll-id="corkboard-grid:${isPersonalScope ? 'personal' : 'global'}"
        class="flex-1 min-h-0 overflow-y-auto flex flex-col pr-0.5">
        ${renderCorkBodyHtml({
          pins,
          isFullDesktop,
          canEdit: perms.canEdit,
          activeComposer,
          errorMsg: composerErrorMsg,
          noticeMsg: corkNoticeMsg,
          trafficOrders,
          todayKey,
          tomorrowKey,
        })}
      </div>

      <div data-dk-cork-footer="1" class="flex items-center justify-between text-[8.5px] font-mono text-[#4A4A4A] pt-1.5 mt-1.5 border-t border-obsidian-border/40 shrink-0">
        <span>CORCHO · ${pins.length} ${pins.length === 1 ? 'ficha' : 'fichas'}</span>
        <span>${isPersonalScope ? 'Privado' : (perms.canEdit ? 'Estudio · Editable' : 'Estudio · Solo lectura')}</span>
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
}

/**
 * Capa propia de eventos de C04.
 * Regla 3: enlaza eventos únicamente dentro de `container` (nunca en window/document)
 * y realiza re-render local de C04 preservando listeners del Escritorio en cabecera.
 */
export function bindCorkboardEvents(container, ctx = {}) {
  if (!container) return;
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
  } = ctx;
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  const storeOpts = { isPersonalScope, studioSettings, userProfile };

  const rerenderLocal = () => {
    const actionsSlot = corkRoot.querySelector('[data-dk-cork-actions="1"]');
    const bodySlot = corkRoot.querySelector('[data-dk-cork-body="1"]');
    const footerSlot = corkRoot.querySelector('[data-dk-cork-footer="1"]');
    if (!bodySlot) return;
    const prevScrollTop = bodySlot.scrollTop;
    const pins = ensureCorkPinsInitialized(storeOpts);
    const activeComposer = perms.canEdit ? getActiveCorkComposer() : null;
    if (actionsSlot) actionsSlot.innerHTML = renderCorkHeaderActions(perms.canEdit, activeComposer);
    bodySlot.innerHTML = renderCorkBodyHtml({
      pins,
      isFullDesktop,
      canEdit: perms.canEdit,
      activeComposer,
      errorMsg: composerErrorMsg,
      noticeMsg: corkNoticeMsg,
      trafficOrders,
      todayKey,
      tomorrowKey,
    });
    if (footerSlot) {
      footerSlot.innerHTML = `
        <span>CORCHO · ${pins.length} ${pins.length === 1 ? 'ficha' : 'fichas'}</span>
        <span>${isPersonalScope ? 'Privado' : (perms.canEdit ? 'Estudio · Editable' : 'Estudio · Solo lectura')}</span>
      `;
    }
    bodySlot.scrollTop = prevScrollTop;
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
  const isPinOrFileDrop = (e) => hasType(e, DND_MIME_PIN) || hasType(e, 'Files');
  const isInternalCorkDrag = (e) => hasType(e, DND_MIME_CORK_CARD);

  corkRoot.addEventListener('dragenter', (e) => {
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
