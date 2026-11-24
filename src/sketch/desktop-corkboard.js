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
  addCorkPin,
  closeCorkPinPreview,
  ensureCorkPinsInitialized,
  formatFileSize,
  getActiveCorkComposer,
  getCorkBlobObjectUrl,
  getCorkboardPermissions,
  getFileTypeTag,
  hasOpenCorkPinPreview,
  normalizeSafeWebUrl,
  removeCorkPin,
  saveCorkBlob,
  setActiveCorkComposer,
} from './desktop-corkboard-store.js';

// Re-exportación limpia para mantener dirección única: desktop.js → desktop-corkboard.js → desktop-corkboard-store.js
export {
  DND_MIME_PIN,
  DND_MIME_SLOT,
  closeCorkPinPreview,
  hasOpenCorkPinPreview,
};

let composerErrorMsg = '';

export function renderOtGalleryOverlay({
  selectedContextOt,
  selectedContextTask,
  selectedContextTaskIdx,
  selectedMediaIndex,
  borderClass = '',
  dragHandleHtml = '',
  collapseBtnHtml = '',
}) {
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
      <!-- 04.1: Galería de la OT / Tarea -->
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
        <div data-dk-scroll-id="corkboard-gallery:${escapeHtml(selectedContextOt.id)}" class="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-1.5 content-start pr-0.5">
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

      <!-- 04.2: Previsualización del archivo seleccionado -->
      <div class="p-3 flex flex-col min-h-0">
        <div class="flex items-center justify-between gap-1.5 pb-2 mb-2 border-b border-obsidian-border/70 shrink-0">
          <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold">Vista previa</span>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-dk-q4-close-ctx="1" title="Volver al Tablero de Corcho (Esc)" aria-label="Volver al Tablero de Corcho"
              class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
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
}

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

function renderCorkPinCard(pin, idx, { canEdit }) {
  const notesCount = Array.isArray(pin.highlights) ? pin.highlights.length : 0;
  const unpinBtn = canEdit
    ? `<button type="button" data-cork-unpin="${escapeHtml(pin.id)}" title="Quitar del Corcho" aria-label="Quitar ${escapeHtml(pin.title || 'ficha')} del Corcho"
         class="opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded text-[#737373] hover:text-rose-400 hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0">
         <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       </button>`
    : '';

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

function renderCorkBodyHtml({ pins, isFullDesktop, canEdit, activeComposer, errorMsg }) {
  const gridColsCls = isFullDesktop ? 'grid-cols-2 lg:grid-cols-4' : 'grid-cols-2';
  const composerHtml = canEdit ? renderCorkComposerHtml(activeComposer, errorMsg) : '';
  const listHtml = pins.length
    ? `<div class="grid ${gridColsCls} gap-2 content-start">${pins.map((p, idx) => renderCorkPinCard(p, idx, { canEdit })).join('')}</div>`
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
    const card = lastPillBoard.cards[lightboxChartIdx];
    const total = lastPillBoard.cards.length;
    return `
      <div id="dk-q4-chart-root" class="flex-1 flex flex-col min-h-0 border-t-2 border-t-violet-500/75 bg-[#171717]">
        <div class="px-3 py-1.5 border-b border-obsidian-border bg-[#1b1b1b] flex items-center justify-between gap-2 shrink-0">
          <div class="flex items-center gap-1.5 min-w-0">
            ${dragHandleHtml}
            <span class="font-mono text-[9px] text-obsidian-amber font-semibold shrink-0">0${lightboxChartIdx + 1}/${total}</span>
            <span class="font-mono text-[9.5px] text-[#F0F0F0] uppercase tracking-wider font-semibold truncate">${escapeHtml(card.title)}</span>
            <span class="font-mono text-[8.5px] text-[#737373] truncate hidden sm:inline">· ${escapeHtml(lastPillBoard.title)}</span>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <button type="button" data-dk-lb-nav="-1" title="Gráfico anterior (←)"
              class="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors">‹</button>
            <button type="button" data-dk-lb-nav="1" title="Gráfico siguiente (→)"
              class="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors">›</button>
            <button type="button" data-dk-lb-close="1" title="Volver al Tablero de Corcho (Esc)" aria-label="Cerrar gráfico"
              class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
            ${rightActionBtns}
          </div>
        </div>
        <div data-dk-scroll-id="corkboard-chart:${escapeHtml(lastPillBoard.title || '')}:${lightboxChartIdx}" class="flex-1 min-h-0 overflow-y-auto p-4">
          ${card.largeBody}
        </div>
      </div>
    `;
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
        <label for="cork-file-upload-input" class="sr-only">Subir archivo al Tablero de Corcho</label>
        <input id="cork-file-upload-input" name="cork_file_upload" type="file" data-cork-file-input="1" class="hidden" />
      ` : ''}

      <div data-dk-cork-body="1" data-dk-scroll-id="corkboard-grid:${isPersonalScope ? 'personal' : 'global'}"
        class="flex-1 min-h-0 overflow-y-auto flex flex-col pr-0.5">
        ${renderCorkBodyHtml({ pins, isFullDesktop, canEdit: perms.canEdit, activeComposer, errorMsg: composerErrorMsg })}
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

  const { isPersonalScope = false, isFullDesktop = false, roleCaps = null, userProfile = null, studioSettings = null } = ctx;
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
    bodySlot.innerHTML = renderCorkBodyHtml({ pins, isFullDesktop, canEdit: perms.canEdit, activeComposer, errorMsg: composerErrorMsg });
    if (footerSlot) {
      footerSlot.innerHTML = `
        <span>CORCHO · ${pins.length} ${pins.length === 1 ? 'ficha' : 'fichas'}</span>
        <span>${isPersonalScope ? 'Privado' : (perms.canEdit ? 'Estudio · Editable' : 'Estudio · Solo lectura')}</span>
      `;
    }
    bodySlot.scrollTop = prevScrollTop;
    bindCorkboardLocalContentEvents(corkRoot, ctx, rerenderLocal);
  };

  // Input de archivo local (guarda blob en IndexedDB y metadata en localStorage)
  const fileInput = corkRoot.querySelector('[data-cork-file-input="1"]');
  fileInput?.addEventListener('change', async () => {
    if (!perms.canEdit) return;
    const file = fileInput.files?.[0];
    if (!file) return;
    const blobId = `blob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let storedBlobId = null;
    try {
      await saveCorkBlob(blobId, file, { mime: file.type, name: file.name });
      storedBlobId = blobId;
    } catch {
      storedBlobId = null;
    }
    addCorkPin({
      type: 'file',
      title: file.name || 'Archivo adjunto',
      fileMeta: {
        mime: file.type || '',
        sizeLabel: formatFileSize(file.size),
        blobId: storedBlobId,
      },
    }, storeOpts);
    fileInput.value = '';
    rerenderLocal();
  });

  // Aislamiento de DnD: evita que drops de pines/tarjetas/archivos burbujeen al intercambio de cuadrantes
  const isCorkDrop = (e) => {
    const types = Array.from(e.dataTransfer?.types || []);
    return types.includes(DND_MIME_PIN) || types.includes(DND_MIME_CORK_CARD) || types.includes('Files');
  };

  corkRoot.addEventListener('dragover', (e) => {
    if (!isCorkDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  corkRoot.addEventListener('drop', (e) => {
    if (!isCorkDrop(e)) return;
    e.preventDefault();
    e.stopPropagation();
    // Procesamiento real de drops se conecta en HU-01 y HU-04
  });

  bindCorkboardLocalContentEvents(corkRoot, ctx, rerenderLocal);
}
