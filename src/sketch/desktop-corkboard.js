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
  closeCorkPinPreview,
  getCorkboardPermissions,
  hasOpenCorkPinPreview,
} from './desktop-corkboard-store.js';

// Re-exportación limpia para mantener dirección única: desktop.js → desktop-corkboard.js → desktop-corkboard-store.js
export {
  DND_MIME_PIN,
  DND_MIME_SLOT,
  closeCorkPinPreview,
  hasOpenCorkPinPreview,
};

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
  // Referencia explícita al contexto RBAC para Paso 0 (consumido en HU-01..HU-07)
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  void isFullDesktop;
  void studioSettings;
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
  return `
    <div data-dk-cork-root="1" data-dk-cork-editable="${perms.canEdit ? '1' : '0'}"
      class="relative p-3 border-t-2 border-t-cyan-500/70 flex flex-col justify-between min-h-0 flex-1 bg-[#161616]/60 transition-colors">
      <div class="flex items-center justify-between gap-2 pb-1.5 border-b border-obsidian-border/70 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold truncate">Tablero de Corcho</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[8.5px] font-mono text-[#666666] uppercase tracking-wider">${isPersonalScope ? 'Personal' : 'Estudio'}</span>
          ${rightActionBtns}
        </div>
      </div>
      <div class="flex flex-col items-center justify-center flex-1 py-4 gap-1.5 text-center">
        <div class="w-8 h-8 rounded-lg border border-dashed border-obsidian-border flex items-center justify-center text-[#5A5A5A]">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>
          </svg>
        </div>
        <span class="text-[10.5px] text-[#8C8C8C] font-medium">Tablero de Corcho</span>
        <span class="text-[9px] text-[#5A5A5A] font-mono">Fija archivos, notas, enlaces o selecciona una OT / gráfico para inspeccionar aquí</span>
      </div>
      <div class="flex items-center justify-between text-[8.5px] font-mono text-[#4A4A4A] pt-1 border-t border-obsidian-border/40 shrink-0">
        <span>CORCHO · 04</span>
        <span>Pines · Vista previa · Plugins</span>
      </div>
    </div>
  `;
}

/**
 * Capa propia de eventos de C04.
 * Regla 3: enlaza eventos únicamente dentro de `container` (nunca en window/document).
 */
export function bindCorkboardEvents(container, ctx = {}) {
  if (!container) return;
  const corkRoot = container.querySelector('[data-dk-cork-root="1"]');
  if (!corkRoot) return;

  const isCorkDrop = (e) => {
    const types = Array.from(e.dataTransfer?.types || []);
    return types.includes(DND_MIME_PIN) || types.includes(DND_MIME_CORK_CARD) || types.includes('Files');
  };

  // Aislamiento de DnD en Paso 0: evita que drops de pines/tarjetas/archivos burbujeen al intercambio de cuadrantes
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
    void ctx;
  });
}
