/**
 * Reusable Gallery/Monitor section and Standalone Archive view (#view-gallery).
 */

import {
  clientsData,
  trafficOrders,
  standaloneDocuments,
  standaloneDevFiles,
  sketchState,
  escapeHtml,
  ensureOtData,
  getActivePieceVersion,
  notifySketchChange,
  onSketchChange,
} from './store.js';
import { renderStandaloneFileInspector } from './inspector.js';

let galleryInitialized = false;
let galleryKeyboardBound = false;
let activeGalleryCtx = null;

function isAnyOverlayOpen() {
  const overlayIds = [
    'new-client-modal',
    'settings-modal',
    'user-menu-popover',
    'notifications-popover',
    'user-account-modal',
    'user-switch-modal',
  ];
  if (overlayIds.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  })) {
    return true;
  }
  return !!document.querySelector('[data-cp-popover]');
}

function ensureGalleryKeyboardBound() {
  if (galleryKeyboardBound) return;
  galleryKeyboardBound = true;

  document.addEventListener('keydown', (e) => {
    if (!activeGalleryCtx || !activeGalleryCtx.container || activeGalleryCtx.container.offsetParent === null) return;
    if (e.target && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (isAnyOverlayOpen()) return;

    if (e.key === 'Escape') {
      if (sketchState.previewLightbox) {
        e.preventDefault();
        sketchState.previewLightbox = false;
        activeGalleryCtx.rerender();
        return;
      }
      if (
        sketchState.activePieceIndex !== null ||
        sketchState.selectedPieces.size > 0 ||
        sketchState.activeRouteIndex !== null
      ) {
        e.preventDefault();
        sketchState.activePieceIndex = null;
        sketchState.selectedPieces.clear();
        sketchState.activeRouteIndex = null;
        activeGalleryCtx.rerender();
      }
      return;
    }

    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    if (sketchState.galleryCollapsed) return;

    const pieces = activeGalleryCtx.getPieces() || [];
    if (!pieces.length) return;

    e.preventDefault();
    const isGrid = sketchState.galleryViewMode === 'grid';
    const cols = isGrid ? (window.innerWidth >= 640 ? 4 : 3) : 1;
    let delta = 0;
    if (e.key === 'ArrowRight') delta = 1;
    else if (e.key === 'ArrowLeft') delta = -1;
    else if (e.key === 'ArrowDown') delta = cols;
    else if (e.key === 'ArrowUp') delta = -cols;

    let nextIdx;
    if (
      sketchState.activePieceIndex === null ||
      sketchState.activePieceIndex === undefined ||
      sketchState.activePieceIndex < 0
    ) {
      nextIdx = delta > 0 ? 0 : pieces.length - 1;
    } else {
      nextIdx = Math.max(0, Math.min(pieces.length - 1, sketchState.activePieceIndex + delta));
    }

    const pageSize = isGrid ? 15 : 9;
    sketchState.activePieceIndex = nextIdx;
    sketchState.activeRouteIndex = null;
    sketchState.galleryPage = Math.floor(nextIdx / pageSize) + 1;
    activeGalleryCtx.rerender();
  });
}

const LEGACY_CLIENT_BRAND_MAP = {
  'Shambhala Ecohotel|Alojamiento': { client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique' },
  'Shambhala Ecohotel|Spa': { client: 'Shambhala Ecohotel', brand: 'Spa & Retiros' },
  'Cámara Lúcida|Festival': { client: 'Club Premium', brand: 'Club Premium' },
  'Botánica Lab|Cuidado Facial': { client: 'Café Origen', brand: 'Tostión Media' },
  'Editorial Ícaro|Colección Norte': { client: 'Café Origen', brand: 'Cold Brew' },
};

/**
 * Align standalone document/dev items with `clientsData` so left-tree client/brand filters match.
 */
function resolveAlignedClientBrand(item) {
  const clientObj = clientsData.find((c) => c.name === item.client);
  if (clientObj && clientObj.brands && Object.prototype.hasOwnProperty.call(clientObj.brands, item.brand)) {
    return { client: item.client, brand: item.brand };
  }
  const mapped = LEGACY_CLIENT_BRAND_MAP[`${item.client}|${item.brand}`];
  if (mapped) return mapped;
  if (clientObj) {
    const firstBrand = Object.keys(clientObj.brands || {})[0] || item.brand;
    return { client: clientObj.name, brand: firstBrand };
  }
  const fallbackClient = clientsData[0];
  if (fallbackClient) {
    return {
      client: fallbackClient.name,
      brand: Object.keys(fallbackClient.brands || {})[0] || item.brand,
    };
  }
  return { client: item.client, brand: item.brand };
}

function removeSelectedInPlace(arr, selectedSet) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (selectedSet.has(arr[i].name)) {
      arr.splice(i, 1);
    }
  }
}

export function getGalleryPieceType(p) {
  if (!p) return 'image';
  if (/\.mp4|\.mov|\.webm/i.test(p.name) || /VIDEO/i.test(p.meta || '')) return 'video';
  if (/\.mp3|\.wav|\.m4a|\.aiff/i.test(p.name) || /AUDIO/i.test(p.meta || '')) return 'audio';
  if (/\.html?|\.css|\.js|\.ts|\.json/i.test(p.name) || /CÓDIGO|CODE|HTML|JS/i.test(p.meta || '')) return 'code';
  if (/\.pdf|\.docx?|\.txt|\.md|\.pages|\.csv|\.xlsx?|\.numbers$/i.test(p.name) || /PDF|DOC|TEXTO|CSV|XLS|SHEET/i.test(p.meta || '')) return 'text';
  return 'image';
}

export function getFilteredGalleryPieces(rawPieces, { allowFilters = true, showTaskFilter = false } = {}) {
  let pieces = (rawPieces || []).slice();
  if (allowFilters) {
    if (sketchState.galleryTypeFilter !== 'all') {
      pieces = pieces.filter((p) => getGalleryPieceType(p) === sketchState.galleryTypeFilter);
    }
    if (showTaskFilter && sketchState.galleryTaskFilter !== 'all') {
      pieces = pieces.filter((p) => (p.taskTitle || 'OT') === sketchState.galleryTaskFilter);
    }
    if (sketchState.gallerySearch.trim()) {
      const q = sketchState.gallerySearch.trim().toLowerCase();
      pieces = pieces.filter(
        (p) => p.name.toLowerCase().includes(q) || (p.meta || '').toLowerCase().includes(q)
      );
    }
    if (sketchState.gallerySort === 'oldest') {
      pieces.sort((a, b) => (a.dateOrder || 0) - (b.dateOrder || 0));
    } else if (sketchState.gallerySort === 'name') {
      pieces.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      pieces.sort((a, b) => (b.dateOrder || 0) - (a.dateOrder || 0));
    }
  }
  return pieces;
}

/**
 * Render the split Gallery + Preview Monitor HTML for either OT detail or standalone archive.
 */
export function renderGallerySectionHtml(
  rawPieces,
  { allowFilters = true, showTaskFilter = false, subtasks = [], galleryMinH = 'min-h-[560px]', canCollapse = true } = {}
) {
  const pieces = getFilteredGalleryPieces(rawPieces, { allowFilters, showTaskFilter });

  const hasActivePiece =
    sketchState.activePieceIndex !== null &&
    sketchState.activePieceIndex !== undefined &&
    sketchState.activePieceIndex >= 0 &&
    sketchState.activePieceIndex < pieces.length;
  const safePieceIdx = hasActivePiece ? sketchState.activePieceIndex : -1;
  const activePiece = hasActivePiece ? pieces[safePieceIdx] : null;
  const activePieceType = activePiece ? getGalleryPieceType(activePiece) : 'none';
  const activePieceIsSheet = activePiece ? /\.csv|\.xlsx?|\.numbers$/i.test(activePiece.name) : false;
  const pageSize = sketchState.galleryViewMode === 'grid' ? 15 : 9;
  const totalPages = Math.max(1, Math.ceil(pieces.length / pageSize));
  const safePage = Math.min(Math.max(1, sketchState.galleryPage), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pagedPieces = pieces.slice(pageStart, pageStart + pageSize);
  const isCollapsed = canCollapse && sketchState.galleryCollapsed;

  return `
    <!-- Galería + Monitor de Previsualización -->
    <div class="space-y-2">
      ${isCollapsed ? `
      <div class="flex items-center justify-between gap-2">
        <button type="button" data-toggle-ot-panel="gallery" class="flex items-center gap-2 text-[15px] font-medium text-[#8C8C8C] hover:text-[#D4D4D4] transition-colors cursor-pointer min-w-0">
          <span data-icon="expand-diagonal" data-icon-size="w-3.5 h-3.5" class="shrink-0"></span>
          <span class="uppercase tracking-[0.06em]">GALERÍA</span>
          <span class="font-mono text-[13px] text-[#8C8C8C] shrink-0">(${pieces.length})</span>
        </button>
      </div>
      ` : `
      <div class="flex flex-col lg:flex-row lg:items-center gap-3 px-0.5 pb-1">
        <div class="w-full lg:w-[40%] shrink-0 flex flex-wrap items-center justify-start gap-1 text-[10px] text-[#8C8C8C]">
          ${canCollapse ? `
          <button type="button" data-toggle-ot-panel="gallery" data-tip="Contraer galería" class="inline-flex items-center gap-1.5 pr-2 mr-1 py-1 border-r border-obsidian-border text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8C8C8C] hover:text-[#D4D4D4] transition-colors cursor-pointer shrink-0">
            <span data-icon="collapse-diagonal" data-icon-size="w-3 h-3"></span>
            <span>Galería</span>
            <span class="font-mono font-normal text-[#737373]">(${pieces.length})</span>
          </button>
          ` : ''}
          ${allowFilters ? `
          <div class="relative flex items-center gap-1">
            <button type="button" id="btn-toggle-gallery-filter" data-tip="Filtrar" class="p-1.5 rounded-lg ${sketchState.galleryFilterOpen || sketchState.galleryTypeFilter !== 'all' || (showTaskFilter && sketchState.galleryTaskFilter !== 'all') || sketchState.gallerySort !== 'recent' ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} transition-colors cursor-pointer">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></svg>
            </button>
            ${sketchState.galleryFilterOpen ? `
            <div class="absolute left-0 top-full mt-1.5 z-50 bg-[#202020] border border-[#3a3a3a] rounded-xl p-2.5 shadow-xl flex flex-col gap-2 min-w-[170px]">
              <select id="ot-gallery-type" class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
                <option value="all" ${sketchState.galleryTypeFilter === 'all' ? 'selected' : ''}>Tipo: Todos</option>
                <option value="image" ${sketchState.galleryTypeFilter === 'image' ? 'selected' : ''}>Imágenes</option>
                <option value="video" ${sketchState.galleryTypeFilter === 'video' ? 'selected' : ''}>Videos</option>
                <option value="text" ${sketchState.galleryTypeFilter === 'text' ? 'selected' : ''}>Texto</option>
                <option value="code" ${sketchState.galleryTypeFilter === 'code' ? 'selected' : ''}>Código</option>
              </select>
              ${showTaskFilter ? `
              <select id="ot-gallery-task" class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
                <option value="all" ${sketchState.galleryTaskFilter === 'all' ? 'selected' : ''}>Tarea: Todas</option>
                <option value="OT" ${sketchState.galleryTaskFilter === 'OT' ? 'selected' : ''}>OT</option>
                ${(subtasks || []).map((st) => `<option value="${escapeHtml(st.title)}" ${sketchState.galleryTaskFilter === st.title ? 'selected' : ''}>${escapeHtml(st.title)}</option>`).join('')}
              </select>
              ` : ''}
              <select id="ot-gallery-sort" class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
                <option value="recent" ${sketchState.gallerySort === 'recent' ? 'selected' : ''}>Orden: Recientes</option>
                <option value="oldest" ${sketchState.gallerySort === 'oldest' ? 'selected' : ''}>Orden: Antiguos</option>
                <option value="name" ${sketchState.gallerySort === 'name' ? 'selected' : ''}>Orden: A-Z</option>
              </select>
            </div>
            ` : ''}
            <div class="relative flex items-center">
              <span data-icon="search" data-icon-size="w-3 h-3" class="text-[#8C8C8C] absolute left-1.5 pointer-events-none"></span>
              <input id="ot-gallery-search" type="text" value="${escapeHtml(sketchState.gallerySearch)}" data-tip="Buscar" class="bg-transparent border-b border-transparent focus:border-[#3a3a3a] pl-5 pr-1 py-0.5 text-[10px] text-[#D4D4D4] focus:outline-none ${sketchState.gallerySearch ? 'w-24 border-[#3a3a3a]' : 'w-6 focus:w-24 cursor-pointer focus:cursor-text'} transition-all" />
            </div>
          </div>
          ` : ''}
          <div class="inline-flex items-center gap-0.5 shrink-0">
            <button type="button" data-select-all-pieces="1" data-tip="${pieces.length && pieces.every((p) => sketchState.selectedPieces.has(p.name)) ? 'Deseleccionar todos' : 'Seleccionar todos'}" class="p-1.5 rounded-lg ${sketchState.selectedPieces.size > 0 ? 'text-[#D4D4D4]' : 'text-[#8C8C8C]'} hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer">
              <span data-icon="check" data-icon-size="w-3.5 h-3.5"></span>
            </button>
            <button type="button" data-gallery-view="grid" data-tip="Vista cuadrícula" class="p-1.5 rounded-lg ${sketchState.galleryViewMode === 'grid' ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} transition-colors cursor-pointer">
              <span data-icon="layout-grid" data-icon-size="w-3.5 h-3.5"></span>
            </button>
            <button type="button" data-gallery-view="list" data-tip="Vista lista" class="p-1.5 rounded-lg ${sketchState.galleryViewMode === 'list' ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} transition-colors cursor-pointer">
              <span data-icon="list" data-icon-size="w-3.5 h-3.5"></span>
            </button>
            <button type="button" data-delete-selected-pieces="1" data-tip="Eliminar seleccionados" class="p-1.5 rounded-lg ${sketchState.selectedPieces.size > 0 ? 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-rose-400 cursor-pointer' : 'text-[#555555] cursor-default'} transition-colors">
              <span data-icon="trash-2" data-icon-size="w-3.5 h-3.5"></span>
            </button>
          </div>
          ${sketchState.selectedPieces.size > 0 ? `<span class="font-mono text-[10px] text-[#D4D4D4] shrink-0 ml-1">${sketchState.selectedPieces.size} sel.</span>` : ''}
        </div>
        <div class="flex-1 min-w-0 flex items-center justify-between gap-2">
          <div class="flex items-center gap-2 min-w-0">
            ${activePiece ? (() => {
              const { versions, current, isHistorical } = getActivePieceVersion(activePiece);
              return `
              <span class="text-[15px] font-medium text-[#D4D4D4] truncate max-w-[260px]">${escapeHtml(activePiece.name)}</span>
              <select data-piece-version-select class="bg-[#191919] border border-obsidian-border rounded-md px-1.5 py-0.5 font-mono text-[11px] font-medium text-obsidian-amber focus:outline-none cursor-pointer shrink-0">
                ${[...versions].reverse().map((v) => `<option value="${v.version}" class="bg-[#202020] text-[#D4D4D4]" ${v.version === current?.version ? 'selected' : ''}>v${v.version}${v.version === versions[versions.length - 1].version ? ' (actual)' : ''}</option>`).join('')}
              </select>
              ${isHistorical ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-obsidian-amber text-[9px] font-mono shrink-0">Histórica</span>' : ''}
              <span class="text-[#8C8C8C] text-[10px] shrink-0">·</span>
              <span class="text-[10px] text-[#8C8C8C] shrink-0">${escapeHtml(current?.status || activePiece.status || 'En Revisión')}</span>
              `;
            })() : ''}
          </div>
          <div class="inline-flex items-center gap-4 text-[#8C8C8C] shrink-0 ml-auto ${!activePiece ? 'hidden' : ''}">
            ${activePieceType === 'video' ? `
            <div class="inline-flex items-center gap-1">
              <button type="button" data-preview-action="video-loop" data-tip="Repetir (Loop)" class="p-1.5 rounded-lg ${sketchState.videoLoop ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
              </button>
              <button type="button" data-preview-action="video-speed" data-tip="Velocidad de reproducción" class="px-1.5 py-1 rounded-lg font-mono text-[10px] ${sketchState.videoSpeed !== 1 ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                ${sketchState.videoSpeed}x
              </button>
            </div>
            ` : activePieceType === 'text' ? `
            <div class="inline-flex items-center gap-1 text-[10px]">
              <button type="button" data-preview-action="doc-prev" ${sketchState.docPage <= 1 ? 'disabled' : ''} data-tip="${activePieceIsSheet ? 'Hoja anterior' : 'Página anterior'}" class="p-1 rounded-lg ${sketchState.docPage <= 1 ? 'text-[#444444] cursor-default' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer'} transition-colors">
                <span data-icon="chevron-left" data-icon-size="w-3.5 h-3.5"></span>
              </button>
              <span class="font-mono text-[#D4D4D4] px-0.5">${sketchState.docPage} / 3</span>
              <button type="button" data-preview-action="doc-next" ${sketchState.docPage >= 3 ? 'disabled' : ''} data-tip="${activePieceIsSheet ? 'Hoja siguiente' : 'Página siguiente'}" class="p-1 rounded-lg ${sketchState.docPage >= 3 ? 'text-[#444444] cursor-default' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer'} transition-colors">
                <span data-icon="chevron-right" data-icon-size="w-3.5 h-3.5"></span>
              </button>
              <button type="button" data-preview-action="doc-copy" data-tip="${sketchState.docCopied ? 'Copiado' : (activePieceIsSheet ? 'Copiar tabla' : 'Copiar texto')}" class="p-1.5 rounded-lg ${sketchState.docCopied ? 'bg-obsidian-elevated text-emerald-400' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors ml-1">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
              <button type="button" data-preview-action="doc-highlight" data-tip="${sketchState.docHighlight === 'yellow' ? 'Resaltar: Amarillo' : (sketchState.docHighlight === 'pink' ? 'Resaltar: Rosa' : 'Resaltar')}" class="p-1.5 rounded-lg ${sketchState.docHighlight === 'yellow' ? 'bg-obsidian-elevated text-amber-300' : (sketchState.docHighlight === 'pink' ? 'bg-obsidian-elevated text-rose-400' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]')} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
              </button>
              ${sketchState.docHighlight ? `
              <button type="button" data-preview-action="doc-highlight-yellow" data-tip="Amarillo" class="w-3 h-3 rounded-full bg-amber-300 ${sketchState.docHighlight === 'yellow' ? 'ring-1 ring-white ring-offset-1 ring-offset-[#191919]' : 'opacity-60 hover:opacity-100'} cursor-pointer transition-opacity"></button>
              <button type="button" data-preview-action="doc-highlight-pink" data-tip="Rosa" class="w-3 h-3 rounded-full bg-rose-400 ${sketchState.docHighlight === 'pink' ? 'ring-1 ring-white ring-offset-1 ring-offset-[#191919]' : 'opacity-60 hover:opacity-100'} cursor-pointer transition-opacity"></button>
              ` : ''}
            </div>
            <div class="inline-flex items-center gap-0.5">
              <button type="button" data-preview-action="zoom-out" data-tip="Alejar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
              </button>
              <button type="button" data-preview-action="fit" data-tip="Ajustar al ancho" class="p-1.5 rounded-lg ${sketchState.previewZoom === 1 ? 'text-[#8C8C8C]' : 'text-[#D4D4D4]'} hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
              </button>
              <button type="button" data-preview-action="zoom-in" data-tip="Acercar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
              </button>
            </div>
            ` : activePieceType === 'code' ? `
            <div class="inline-flex items-center gap-0.5">
              <button type="button" data-preview-action="code-preview" data-tip="${sketchState.codeRenderPreview ? 'Ver código fuente' : 'Vista previa renderizada'}" class="p-1.5 rounded-lg ${sketchState.codeRenderPreview ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <span data-icon="eye" data-icon-size="w-3.5 h-3.5"></span>
              </button>
              <button type="button" data-preview-action="code-wrap" data-tip="Ajuste de línea" class="p-1.5 rounded-lg ${sketchState.codeWrap ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" x2="21" y1="6" y2="6"/><path d="M3 12h15a3 3 0 1 1 0 6h-4"/><polyline points="16 16 14 18 16 20"/><line x1="3" x2="10" y1="18" y2="18"/></svg>
              </button>
              <button type="button" data-preview-action="code-lines" data-tip="Números de línea" class="p-1.5 rounded-lg ${sketchState.codeLines ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="10" x2="21" y1="6" y2="6"/><line x1="10" x2="21" y1="12" y2="12"/><line x1="10" x2="21" y1="18" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
              </button>
              <button type="button" data-preview-action="doc-copy" data-tip="${sketchState.docCopied ? 'Copiado' : 'Copiar código'}" class="p-1.5 rounded-lg ${sketchState.docCopied ? 'bg-obsidian-elevated text-emerald-400' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              </button>
            </div>
            <div class="inline-flex items-center gap-0.5">
              <button type="button" data-preview-action="zoom-out" data-tip="Alejar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
              </button>
              <button type="button" data-preview-action="fit" data-tip="Tamaño original" class="p-1.5 rounded-lg ${sketchState.previewZoom === 1 ? 'text-[#8C8C8C]' : 'text-[#D4D4D4]'} hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
              </button>
              <button type="button" data-preview-action="zoom-in" data-tip="Acercar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
              </button>
            </div>
            ` : `
            <div class="inline-flex items-center gap-0.5">
              <button type="button" data-preview-action="rotate" data-tip="Girar" class="p-1.5 rounded-lg ${sketchState.previewRotation % 360 !== 0 ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
              </button>
              <button type="button" data-preview-action="flip-h" data-tip="Voltear horizontal" class="p-1.5 rounded-lg ${sketchState.previewFlipH ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2"/><path d="M12 14v2"/><path d="M12 8v2"/><path d="M12 2v2"/></svg>
              </button>
              <button type="button" data-preview-action="flip-v" data-tip="Voltear vertical" class="p-1.5 rounded-lg ${sketchState.previewFlipV ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4]'} cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m17 3-5 5-5-5h10"/><path d="m17 21-5-5-5 5h10"/><path d="M4 12H2"/><path d="M10 12H8"/><path d="M16 12h-2"/><path d="M22 12h-2"/></svg>
              </button>
            </div>
            <div class="inline-flex items-center gap-0.5">
              <button type="button" data-preview-action="zoom-out" data-tip="Alejar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
              </button>
              <button type="button" data-preview-action="fit" data-tip="Ajustar al espacio" class="p-1.5 rounded-lg ${sketchState.previewZoom === 1 && sketchState.previewRotation % 360 === 0 && !sketchState.previewFlipH && !sketchState.previewFlipV ? 'text-[#8C8C8C]' : 'text-[#D4D4D4]'} hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
              </button>
              <button type="button" data-preview-action="zoom-in" data-tip="Acercar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/></svg>
              </button>
            </div>
            `}
            <div class="inline-flex items-center gap-0.5">
              <button type="button" data-preview-action="review" data-tip="Revisión colaborativa" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-obsidian-amber cursor-pointer transition-colors"><span data-icon="eye" data-icon-size="w-3.5 h-3.5"></span></button>
              <button type="button" data-preview-action="lightbox" data-tip="Caja de luz" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors"><span data-icon="maximize-2" data-icon-size="w-3.5 h-3.5"></span></button>
              <button type="button" data-tip="Compartir" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors"><span data-icon="share-2" data-icon-size="w-3.5 h-3.5"></span></button>
              <button type="button" data-tip="Exportar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
              </button>
              <button type="button" data-tip="Descargar" class="p-1.5 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer transition-colors"><span data-icon="download" data-icon-size="w-3.5 h-3.5"></span></button>
            </div>
          </div>
        </div>
      </div>
      <div class="flex flex-col lg:flex-row gap-3 items-stretch">
        <div class="w-full lg:w-[40%] shrink-0 flex flex-col ${galleryMinH}">
          <div class="flex-1 ${sketchState.galleryViewMode === 'grid' ? 'grid grid-cols-3 sm:grid-cols-4 gap-2 content-start' : 'flex flex-col gap-1.5'}">
            ${safePage === 1 ? (sketchState.galleryViewMode === 'grid' ? `
              <div class="aspect-square rounded-lg border border-dashed border-[#3a3a3a] hover:border-[#8C8C8C] text-[#8C8C8C] flex flex-col items-center justify-between p-2 transition-colors">
                <div class="flex-1 w-full flex items-center justify-center hover:text-[#D4D4D4] cursor-pointer" data-tip="Arrastra archivos aquí">
                  <span data-icon="plus" data-icon-size="w-5 h-5"></span>
                </div>
                <div class="w-full flex items-center justify-center gap-1.5 pt-1 border-t border-[#2b2b2b]/60">
                  <button type="button" data-tip="Subir archivo" class="p-1 rounded hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer">
                    <span data-icon="upload" data-icon-size="w-3.5 h-3.5"></span>
                  </button>
                  <button type="button" data-tip="Enlace web / video" class="p-1 rounded hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer">
                    <span data-icon="link" data-icon-size="w-3.5 h-3.5"></span>
                  </button>
                </div>
              </div>
            ` : `
              <div class="w-full p-2 rounded-lg border border-dashed border-[#3a3a3a] hover:border-[#8C8C8C] text-[10.5px] text-[#8C8C8C] flex items-center justify-between gap-2 transition-colors">
                <button type="button" class="flex items-center gap-1.5 hover:text-[#D4D4D4] cursor-pointer transition-colors">
                  <span data-icon="upload" data-icon-size="w-3.5 h-3.5"></span>
                  <span>Arrastra archivos aquí o sube desde carpeta</span>
                </button>
                <button type="button" data-tip="Enlace web / video" class="p-1 rounded hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer shrink-0">
                  <span data-icon="link" data-icon-size="w-3.5 h-3.5"></span>
                </button>
              </div>
            `) : ''}
            ${pagedPieces
              .map((p, idx) => {
                const i = pageStart + idx;
                const isSel = i === safePieceIdx;
                const isChecked = sketchState.selectedPieces.has(p.name);
                const ver = p.version || i + 1;
                const isDoc = /\.pdf|\.docx?$/i.test(p.name) || /PDF|DOC/i.test(p.meta || '');
                const isVid = /\.mp4|\.mov/i.test(p.name) || /VIDEO/i.test(p.meta || '');
                const thumbIcon = isVid ? 'film' : isDoc ? 'file-text' : 'image';
                if (sketchState.galleryViewMode === 'grid') {
                  return `
                    <div data-pick-piece="${i}" title="${escapeHtml(p.name)} (${escapeHtml(p.meta)})" class="group aspect-square rounded-lg border ${isSel ? 'border-[#8C8C8C] bg-[#202020]/50' : 'border-[#202020] bg-transparent hover:border-[#3a3a3a]'} flex flex-col items-center justify-center relative cursor-pointer transition-colors overflow-hidden p-2">
                      <span data-icon="${thumbIcon}" data-icon-size="w-6 h-6" class="${isSel ? 'text-[#D4D4D4]' : 'text-[#8C8C8C]'}"></span>
                      <div class="absolute inset-x-0 bottom-0 px-1.5 py-1 bg-gradient-to-t from-[#141414]/95 via-[#141414]/80 to-transparent text-[9.5px] ${isSel ? 'text-[#D4D4D4]' : 'text-[#8C8C8C] group-hover:text-[#D4D4D4]'} truncate text-center pointer-events-none">
                        ${escapeHtml(p.name)}
                      </div>
                      <button type="button" data-review-piece="${i}" title="Revisión colaborativa" class="opacity-0 group-hover:opacity-100 absolute top-1.5 left-1.5 w-5 h-5 rounded flex items-center justify-center bg-[#141414]/85 border border-[#3a3a3a] text-[#8C8C8C] hover:text-obsidian-amber transition-all cursor-pointer">
                        <span data-icon="eye" data-icon-size="w-3 h-3"></span>
                      </button>
                      <button type="button" data-toggle-piece-select="${escapeHtml(p.name)}" title="Seleccionar" class="absolute top-1.5 right-1.5 w-4 h-4 rounded flex items-center justify-center transition-opacity cursor-pointer ${isChecked ? 'opacity-100 bg-[#8C8C8C] text-[#141414]' : 'opacity-0 group-hover:opacity-100 border border-[#555555] bg-[#141414]/80 text-transparent hover:border-[#8C8C8C]'}">
                        <span data-icon="check" data-icon-size="w-2.5 h-2.5"></span>
                      </button>
                    </div>
                  `;
                }
                return `
                  <div data-pick-piece="${i}" class="group p-2 rounded-lg border ${isSel ? 'border-[#8C8C8C] bg-obsidian-elevated/40' : 'border-obsidian-border bg-[#191919] hover:border-[#3a3a3a]'} flex items-center justify-between gap-2 cursor-pointer transition-colors">
                    <div class="flex items-center gap-2 min-w-0">
                      <button type="button" data-toggle-piece-select="${escapeHtml(p.name)}" title="Seleccionar" class="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer ${isChecked ? 'bg-[#8C8C8C] text-[#141414]' : 'border border-[#555555] text-transparent hover:border-[#8C8C8C]'}">
                        <span data-icon="check" data-icon-size="w-2.5 h-2.5"></span>
                      </button>
                      <div class="w-8 h-8 rounded bg-[#141414] border border-obsidian-border flex items-center justify-center text-[#8C8C8C] shrink-0"><span data-icon="${thumbIcon}" data-icon-size="w-4 h-4"></span></div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="text-[11px] text-[#D4D4D4] truncate">${escapeHtml(p.name)}</span>
                          <span class="font-mono text-[9px] text-[#8C8C8C] shrink-0">v${ver}</span>
                        </div>
                        <div class="flex items-center gap-1.5 mt-0.5 text-[9.5px] font-mono text-[#8C8C8C]">
                          <span class="truncate">${escapeHtml(p.meta)}</span>
                          <span class="text-[#8C8C8C]">·</span>
                          <span class="text-[9px] text-[#8C8C8C] shrink-0">${escapeHtml(p.status || 'En Revisión')}</span>
                        </div>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 text-[#8C8C8C] shrink-0">
                      <button type="button" data-review-piece="${i}" title="Revisión colaborativa" class="p-1 rounded-lg hover:bg-obsidian-elevated hover:text-obsidian-amber transition-colors cursor-pointer"><span data-icon="eye" data-icon-size="w-3 h-3"></span></button>
                      <button type="button" title="Compartir" class="p-1 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer"><span data-icon="share-2" data-icon-size="w-3 h-3"></span></button>
                      <button type="button" data-new-version-piece="${i}" title="Nueva versión" class="p-1 rounded-lg hover:bg-obsidian-elevated hover:text-obsidian-amber transition-colors cursor-pointer"><span data-icon="plus" data-icon-size="w-3 h-3"></span></button>
                      <button type="button" title="Ampliar" class="p-1 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer"><span data-icon="expand-diagonal" data-icon-size="w-3 h-3"></span></button>
                      <button type="button" title="Eliminar" class="p-1 rounded-lg hover:bg-obsidian-elevated hover:text-[#D4D4D4] transition-colors cursor-pointer"><span data-icon="x" data-icon-size="w-3 h-3"></span></button>
                    </div>
                  </div>
                `;
              })
              .join('')}
          </div>
          ${totalPages > 1 ? `
          <div class="pt-2 flex items-center justify-between text-[10px] text-[#8C8C8C]">
            <span class="font-mono">${pieces.length} archivos</span>
            <div class="inline-flex items-center gap-1">
              <button type="button" data-gallery-page="prev" ${safePage <= 1 ? 'disabled' : ''} class="p-1 rounded-lg ${safePage <= 1 ? 'text-[#444444] cursor-default' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer'} transition-colors" data-tip="Anterior">
                <span data-icon="chevron-left" data-icon-size="w-3.5 h-3.5"></span>
              </button>
              <span class="font-mono text-[#D4D4D4] px-1">${safePage} / ${totalPages}</span>
              <button type="button" data-gallery-page="next" ${safePage >= totalPages ? 'disabled' : ''} class="p-1 rounded-lg ${safePage >= totalPages ? 'text-[#444444] cursor-default' : 'hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer'} transition-colors" data-tip="Siguiente">
                <span data-icon="chevron-right" data-icon-size="w-3.5 h-3.5"></span>
              </button>
            </div>
          </div>
          ` : ''}
        </div>
        <div class="flex-1 min-w-0 bg-[#141414] rounded-xl overflow-hidden ${galleryMinH} flex flex-col ${activePieceType === 'code' && !sketchState.codeRenderPreview ? 'items-stretch justify-start' : 'items-center justify-center p-4 text-center'} relative">
          ${!activePiece ? `
          <div class="space-y-2 text-[#737373] select-none">
            <div class="w-10 h-10 mx-auto rounded-xl bg-[#191919] border border-obsidian-border flex items-center justify-center text-[#5a6169]">
              <span data-icon="image" data-icon-size="w-5 h-5"></span>
            </div>
            <div class="text-[11px] text-[#8C8C8C]">Selecciona un archivo para previsualizarlo</div>
            <div class="text-[9.5px] text-[#5a6169]">Haz clic sobre una pieza o marca el checkbox para selección múltiple</div>
          </div>
          ` : activePieceType === 'code' ? (sketchState.codeRenderPreview ? `
          <div class="transition-transform duration-150 bg-[#191919] border border-obsidian-border rounded-xl p-6 max-w-md w-full text-left" style="transform: scale(${sketchState.previewZoom});">
            <div class="text-[10px] font-mono uppercase tracking-wider text-obsidian-amber mb-1">Vista previa</div>
            <div class="text-[14px] font-medium text-[#D4D4D4]">${escapeHtml(activePiece?.name || '')}</div>
            <div class="text-[11px] text-[#8C8C8C] mt-2">Banner interactivo listo para pauta digital.</div>
            <div class="mt-4 inline-block px-3 py-1.5 rounded-lg bg-obsidian-amber text-[#141414] text-[11px] font-medium">Ver campaña</div>
          </div>
          ` : `
          <div class="w-full h-full p-4 font-mono text-left overflow-auto" style="font-size: ${Math.round(11 * sketchState.previewZoom)}px; line-height: 1.65;">
            ${[
              '&lt;section class="hero-banner" data-campaign="ot-26-001"&gt;',
              '  &lt;div class="hero-copy"&gt;',
              '    &lt;h1&gt;Campaña Lanzamiento 2026&lt;/h1&gt;',
              '    &lt;p&gt;Arte principal adaptado para pauta digital y web.&lt;/p&gt;',
              '    &lt;a href="#cta" class="btn-primary"&gt;Ver campaña&lt;/a&gt;',
              '  &lt;/div&gt;',
              '&lt;/section&gt;',
            ]
              .map(
                (line, idx) => `
              <div class="flex items-start gap-4">
                ${sketchState.codeLines ? `<span class="w-6 text-right text-[#555555] select-none shrink-0">${idx + 1}</span>` : ''}
                <span class="text-[#D4D4D4] ${sketchState.codeWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}">${line}</span>
              </div>
            `
              )
              .join('')}
          </div>
          `) : `
          <div class="transition-transform duration-150 flex flex-col items-center justify-center" style="${activePieceType === 'video' ? '' : `transform: scale(${sketchState.previewZoom}) rotate(${sketchState.previewRotation}deg) scaleX(${sketchState.previewFlipH ? -1 : 1}) scaleY(${sketchState.previewFlipV ? -1 : 1});`}">
            <div class="text-[11.5px] text-[#D4D4D4]">${escapeHtml(activePiece?.name || 'Sin piezas')}</div>
            <div class="text-[10px] font-mono text-[#8C8C8C] mt-1">${escapeHtml(activePiece?.meta || '')}</div>
          </div>
          `}
          ${activePieceType !== 'video' && sketchState.previewZoom !== 1 ? `<span class="absolute bottom-2.5 right-3 font-mono text-[10px] text-[#8C8C8C] bg-[#191919]/90 px-1.5 py-0.5 rounded">${Math.round(sketchState.previewZoom * 100)}%</span>` : ''}
          ${activePieceType === 'video' ? `
          <div class="absolute inset-x-0 bottom-0 px-3 py-2.5 bg-gradient-to-t from-black/95 via-black/75 to-transparent flex flex-col gap-2">
            <div class="w-full h-1 rounded-full bg-[#333333] overflow-hidden cursor-pointer" data-preview-action="video-seek">
              <div class="h-full bg-[#D4D4D4] transition-all" style="width:${sketchState.videoProgress}%"></div>
            </div>
            <div class="flex items-center justify-between gap-2 text-[#D4D4D4]">
              <div class="inline-flex items-center gap-1.5">
                <button type="button" data-preview-action="video-play" data-tip="${sketchState.videoPlaying ? 'Pausar' : 'Reproducir'}" class="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer">
                  ${sketchState.videoPlaying
                    ? '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>'
                    : '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>'}
                </button>
                <button type="button" data-preview-action="video-prev-frame" data-tip="Cuadro anterior" class="p-1 rounded text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-white/10 transition-colors cursor-pointer">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="19 20 9 12 19 4 19 20"/><line x1="5" x2="5" y1="19" y2="5"/></svg>
                </button>
                <button type="button" data-preview-action="video-next-frame" data-tip="Cuadro siguiente" class="p-1 rounded text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-white/10 transition-colors cursor-pointer">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" x2="19" y1="5" y2="19"/></svg>
                </button>
                <span class="font-mono text-[10px] text-[#8C8C8C] ml-1">${String(Math.floor((sketchState.videoProgress * 0.45) / 60)).padStart(2, '0')}:${String(Math.floor((sketchState.videoProgress * 0.45) % 60)).padStart(2, '0')} / 00:45</span>
              </div>
              <div class="inline-flex items-center gap-1.5">
                <button type="button" data-preview-action="video-mute" data-tip="${sketchState.videoMuted ? 'Activar sonido' : 'Silenciar'}" class="p-1 rounded text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-white/10 transition-colors cursor-pointer">
                  ${sketchState.videoMuted
                    ? '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>'
                    : '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>'}
                </button>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
      ${sketchState.previewLightbox && activePiece ? `
      <div data-preview-action="close-lightbox" class="fixed inset-0 z-[100] bg-black/90 flex flex-col items-center justify-center p-8 cursor-pointer">
        <div class="text-[14px] font-medium text-[#D4D4D4] mb-1">${escapeHtml(activePiece.name)}</div>
        <div class="text-[11px] font-mono text-[#8C8C8C]">${escapeHtml(activePiece.meta || '')} · Clic para cerrar</div>
      </div>
      ` : ''}
      `}
    </div>
  `;
}

/**
 * Attach all interactive event listeners for a rendered gallery + preview monitor container.
 */
export function bindGalleryEvents(container, rerenderFn, getAllPiecesFn, onDeleteSelectedFn) {
  if (!container) return;
  activeGalleryCtx = { container, getPieces: getAllPiecesFn, rerender: rerenderFn };
  ensureGalleryKeyboardBound();

  container.querySelectorAll('[data-toggle-ot-panel]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.toggleOtPanel === 'routes') {
        sketchState.routesCollapsed = !sketchState.routesCollapsed;
      }
      if (btn.dataset.toggleOtPanel === 'gallery') {
        sketchState.galleryCollapsed = !sketchState.galleryCollapsed;
      }
      rerenderFn();
    });
  });

  container.querySelectorAll('[data-toggle-piece-select]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const name = btn.dataset.togglePieceSelect;
      if (!name) return;
      if (sketchState.selectedPieces.has(name)) sketchState.selectedPieces.delete(name);
      else sketchState.selectedPieces.add(name);
      rerenderFn();
    });
  });

  container.querySelector('[data-select-all-pieces]')?.addEventListener('click', () => {
    const cFiles = getAllPiecesFn() || [];
    const allSelected = cFiles.length > 0 && cFiles.every((p) => sketchState.selectedPieces.has(p.name));
    if (allSelected) {
      cFiles.forEach((p) => sketchState.selectedPieces.delete(p.name));
    } else {
      cFiles.forEach((p) => sketchState.selectedPieces.add(p.name));
    }
    rerenderFn();
  });

  container.querySelector('[data-delete-selected-pieces]')?.addEventListener('click', () => {
    if (sketchState.selectedPieces.size === 0) return;
    if (onDeleteSelectedFn) onDeleteSelectedFn();
    sketchState.selectedPieces.clear();
    sketchState.activePieceIndex = 0;
    rerenderFn();
  });

  const openPieceReview = (piece) => {
    notifySketchChange('open-review', { piece });
  };

  container.querySelectorAll('[data-review-piece]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.reviewPiece);
      const pieces = getAllPiecesFn() || [];
      if (!Number.isNaN(idx)) sketchState.activePieceIndex = idx;
      openPieceReview(pieces[idx]);
    });
  });

  container.querySelector('[data-piece-version-select]')?.addEventListener('change', (e) => {
    const pieces = getAllPiecesFn() || [];
    const activePiece = sketchState.activePieceIndex !== null ? pieces[sketchState.activePieceIndex] : null;
    const ver = Number(e.target.value);
    if (activePiece && !Number.isNaN(ver)) {
      activePiece.activeVersion = ver;
      rerenderFn();
    }
  });

  container.querySelectorAll('[data-new-version-piece]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.newVersionPiece);
      if (Number.isNaN(idx)) return;
      sketchState.activePieceIndex = idx;
      sketchState.activeRouteIndex = null;
      sketchState.inspectorTab = 'detail';
      rerenderFn();
      const form = document.getElementById('insp-ver-form');
      if (form) {
        form.classList.remove('hidden');
        form.querySelector('#insp-ver-note')?.focus();
      }
    });
  });

  container.querySelectorAll('[data-pick-piece]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(el.dataset.pickPiece);
      if (Number.isNaN(idx)) return;
      sketchState.activePieceIndex = sketchState.activePieceIndex === idx ? null : idx;
      sketchState.activeRouteIndex = null;
      rerenderFn();
    });
  });

  if (!container.dataset.galleryOutsideBound) {
    container.dataset.galleryOutsideBound = '1';
    container.addEventListener('click', (e) => {
      if (sketchState.activePieceIndex === null) return;
      if (
        e.target.closest(
          '[data-pick-piece], [data-toggle-piece-select], [data-review-piece], [data-preview-action], [data-gallery-view], [data-gallery-page], [data-select-all-pieces], [data-delete-selected-pieces], [data-toggle-ot-panel], #btn-toggle-gallery-filter, #ot-gallery-search, #ot-gallery-type, #ot-gallery-task, #ot-gallery-sort, tr[data-route-row-idx], button, input, select, textarea, a'
        )
      ) {
        return;
      }
      sketchState.activePieceIndex = null;
      rerenderFn();
    });
  }

  container.querySelectorAll('[data-gallery-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.galleryViewMode = btn.dataset.galleryView || 'list';
      sketchState.galleryPage = 1;
      rerenderFn();
    });
  });

  container.querySelectorAll('[data-gallery-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      sketchState.galleryPage =
        btn.dataset.galleryPage === 'next'
          ? sketchState.galleryPage + 1
          : Math.max(1, sketchState.galleryPage - 1);
      rerenderFn();
    });
  });

  container.querySelectorAll('[data-preview-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const act = btn.dataset.previewAction;
      if (act === 'rotate') sketchState.previewRotation = (sketchState.previewRotation + 90) % 360;
      else if (act === 'flip-h') sketchState.previewFlipH = !sketchState.previewFlipH;
      else if (act === 'flip-v') sketchState.previewFlipV = !sketchState.previewFlipV;
      else if (act === 'zoom-in') sketchState.previewZoom = Math.min(3, +(sketchState.previewZoom + 0.25).toFixed(2));
      else if (act === 'zoom-out') sketchState.previewZoom = Math.max(0.5, +(sketchState.previewZoom - 0.25).toFixed(2));
      else if (act === 'fit') {
        sketchState.previewZoom = 1;
        sketchState.previewRotation = 0;
        sketchState.previewFlipH = false;
        sketchState.previewFlipV = false;
      } else if (act === 'lightbox') sketchState.previewLightbox = true;
      else if (act === 'close-lightbox') sketchState.previewLightbox = false;
      else if (act === 'video-loop') sketchState.videoLoop = !sketchState.videoLoop;
      else if (act === 'video-speed') {
        sketchState.videoSpeed = sketchState.videoSpeed === 1 ? 1.5 : sketchState.videoSpeed === 1.5 ? 2 : 1;
      } else if (act === 'video-play') sketchState.videoPlaying = !sketchState.videoPlaying;
      else if (act === 'video-mute') sketchState.videoMuted = !sketchState.videoMuted;
      else if (act === 'video-prev-frame') sketchState.videoProgress = Math.max(0, sketchState.videoProgress - 2);
      else if (act === 'video-next-frame') sketchState.videoProgress = Math.min(100, sketchState.videoProgress + 2);
      else if (act === 'video-seek') {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0) {
          sketchState.videoProgress = Math.min(
            100,
            Math.max(0, Math.round(((e.clientX - rect.left) / rect.width) * 100))
          );
        }
      } else if (act === 'doc-prev') sketchState.docPage = Math.max(1, sketchState.docPage - 1);
      else if (act === 'doc-next') sketchState.docPage = Math.min(3, sketchState.docPage + 1);
      else if (act === 'doc-copy') sketchState.docCopied = !sketchState.docCopied;
      else if (act === 'doc-highlight') sketchState.docHighlight = sketchState.docHighlight ? null : 'yellow';
      else if (act === 'doc-highlight-yellow') sketchState.docHighlight = 'yellow';
      else if (act === 'doc-highlight-pink') sketchState.docHighlight = 'pink';
      else if (act === 'code-preview') sketchState.codeRenderPreview = !sketchState.codeRenderPreview;
      else if (act === 'code-wrap') sketchState.codeWrap = !sketchState.codeWrap;
      else if (act === 'code-lines') sketchState.codeLines = !sketchState.codeLines;
      else if (act === 'review') {
        const pieces = getAllPiecesFn() || [];
        openPieceReview(pieces[sketchState.activePieceIndex]);
        return;
      }
      rerenderFn();
    });
  });

  container.querySelector('#btn-toggle-gallery-filter')?.addEventListener('click', () => {
    sketchState.galleryFilterOpen = !sketchState.galleryFilterOpen;
    rerenderFn();
  });

  container.querySelector('#ot-gallery-type')?.addEventListener('change', (e) => {
    sketchState.galleryTypeFilter = e.target.value;
    sketchState.activePieceIndex = 0;
    sketchState.galleryPage = 1;
    rerenderFn();
  });

  container.querySelector('#ot-gallery-task')?.addEventListener('change', (e) => {
    sketchState.galleryTaskFilter = e.target.value;
    sketchState.activePieceIndex = 0;
    sketchState.galleryPage = 1;
    rerenderFn();
  });

  container.querySelector('#ot-gallery-sort')?.addEventListener('change', (e) => {
    sketchState.gallerySort = e.target.value;
    sketchState.activePieceIndex = 0;
    sketchState.galleryPage = 1;
    rerenderFn();
  });

  const gSearch = container.querySelector('#ot-gallery-search');
  if (gSearch) {
    gSearch.addEventListener('input', (e) => {
      const pos = e.target.selectionStart || 0;
      sketchState.gallerySearch = e.target.value;
      sketchState.galleryPage = 1;
      sketchState.activePieceIndex = 0;
      rerenderFn();
      const nextInput = container.querySelector('#ot-gallery-search');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(pos, pos);
      }
    });
  }

  if (window.hydrateIcons) window.hydrateIcons(container);
}

/**
 * Render the standalone Archive view (#view-gallery) for Galería, Documentos, and Desarrollo.
 */
export function renderStandaloneGallery() {
  const viewGalleryEl = document.getElementById('view-gallery');
  if (!viewGalleryEl) return;

  const matchesFilter = (item) => {
    const resolved = resolveAlignedClientBrand(item);
    if (sketchState.trafficFilter.type === 'client') {
      return resolved.client === sketchState.trafficFilter.client;
    }
    if (sketchState.trafficFilter.type === 'brand') {
      return (
        resolved.client === sketchState.trafficFilter.client &&
        resolved.brand === sketchState.trafficFilter.brand
      );
    }
    return true;
  };

  let allPieces = [];
  let onDeleteSelected = null;

  if (sketchState.trafficScope === 'documents') {
    allPieces = standaloneDocuments.filter(matchesFilter).map((item) => ({
      ...item,
      ...resolveAlignedClientBrand(item),
    }));
    onDeleteSelected = () => removeSelectedInPlace(standaloneDocuments, sketchState.selectedPieces);
  } else if (sketchState.trafficScope === 'dev') {
    allPieces = standaloneDevFiles.filter(matchesFilter).map((item) => ({
      ...item,
      ...resolveAlignedClientBrand(item),
    }));
    onDeleteSelected = () => removeSelectedInPlace(standaloneDevFiles, sketchState.selectedPieces);
  } else {
    const activeWsId = sketchState.activeWorkspaceId || 'studio';
    const matchingOts = trafficOrders.filter((ot) => {
      if (activeWsId !== 'studio' && (ot.workspaceId || 'diseno-publicidad') !== activeWsId) return false;
      return matchesFilter(ot);
    });
    matchingOts.forEach((ot) => {
      ensureOtData(ot);
      (ot.mediaFiles || []).forEach((p) => {
        allPieces.push({ ...p, otId: ot.id, client: ot.client, brand: ot.brand });
      });
    });
    onDeleteSelected = () => {
      matchingOts.forEach((o) => {
        if (Array.isArray(o.mediaFiles)) {
          o.mediaFiles = o.mediaFiles.filter((p) => !sketchState.selectedPieces.has(p.name));
        }
      });
    };
  }

  viewGalleryEl.innerHTML = renderGallerySectionHtml(allPieces, {
    allowFilters: true,
    showTaskFilter: false,
    subtasks: [],
    galleryMinH: 'h-[calc(100vh-120px)] min-h-[760px]',
    canCollapse: false,
  });

  const filteredPieces = getFilteredGalleryPieces(allPieces, { allowFilters: true, showTaskFilter: false });
  const hasActive =
    sketchState.activePieceIndex !== null &&
    sketchState.activePieceIndex !== undefined &&
    sketchState.activePieceIndex >= 0 &&
    sketchState.activePieceIndex < filteredPieces.length;
  renderStandaloneFileInspector(hasActive ? filteredPieces[sketchState.activePieceIndex] : null, {
    selectedCount: sketchState.selectedPieces.size,
    piecesList: filteredPieces,
    onDeleteSelected,
    onRerender: renderStandaloneGallery,
  });

  bindGalleryEvents(viewGalleryEl, renderStandaloneGallery, () => filteredPieces, onDeleteSelected);
}

/**
 * Initialize standalone gallery subscriptions on 'gallery' and 'clients' channels.
 */
export function initGallery() {
  if (galleryInitialized) return;
  galleryInitialized = true;

  const refreshIfVisible = () => {
    const viewGalleryEl = document.getElementById('view-gallery');
    if (viewGalleryEl && !viewGalleryEl.classList.contains('hidden')) {
      renderStandaloneGallery();
    }
  };

  onSketchChange('gallery', refreshIfVisible);
  onSketchChange('clients', refreshIfVisible);
}
