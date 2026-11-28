/**
 * Cuadrante C04 — Visor contextual del Tablero (Core):
 * - Modo contextual 1: Gráfico ampliado desde C02 Estadística (con navegación ‹ / ›)
 * - Modo contextual 2: Galería + Vista previa de OT/Tarea seleccionada en C01/C03 con controles por tipo de archivo
 * - Estado base: vacío limpio a la espera de selección
 */

import { escapeHtml } from './store.js';

// MIME dedicado para intercambio de cuadrantes por arrastre
export const DND_MIME_SLOT = 'application/x-trafigator-slot';

const UNSAFE_MEDIA_MIMES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
]);

export function createDefaultViewerState() {
  return {
    zoom: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    videoLoop: false,
    videoSpeed: 1,
    videoMuted: false,
    videoPlaying: false,
    docPage: 1,
    docCopied: false,
    docHighlight: null, // null | 'yellow' | 'pink'
    codeRenderPreview: false,
    codeWrap: true,
    codeLines: true,
  };
}

export function applyViewerAction(state, action) {
  const s = state || createDefaultViewerState();
  if (action === 'rotate') {
    s.rotation = (s.rotation + 90) % 360;
  } else if (action === 'flip-h') {
    s.flipH = !s.flipH;
  } else if (action === 'flip-v') {
    s.flipV = !s.flipV;
  } else if (action === 'zoom-in') {
    s.zoom = Math.min(3, +(s.zoom + 0.25).toFixed(2));
  } else if (action === 'zoom-out') {
    s.zoom = Math.max(0.5, +(s.zoom - 0.25).toFixed(2));
  } else if (action === 'fit') {
    s.zoom = 1;
    s.rotation = 0;
    s.flipH = false;
    s.flipV = false;
  } else if (action === 'video-play') {
    s.videoPlaying = !s.videoPlaying;
  } else if (action === 'video-loop') {
    s.videoLoop = !s.videoLoop;
  } else if (action === 'video-speed') {
    s.videoSpeed = s.videoSpeed === 1 ? 1.5 : (s.videoSpeed === 1.5 ? 2 : (s.videoSpeed === 2 ? 0.5 : 1));
  } else if (action === 'video-mute') {
    s.videoMuted = !s.videoMuted;
  } else if (action === 'doc-prev') {
    s.docPage = Math.max(1, s.docPage - 1);
  } else if (action === 'doc-next') {
    s.docPage = Math.min(3, s.docPage + 1);
  } else if (action === 'doc-copy') {
    s.docCopied = !s.docCopied;
  } else if (action === 'doc-highlight') {
    s.docHighlight = s.docHighlight ? null : 'yellow';
  } else if (action === 'doc-highlight-yellow') {
    s.docHighlight = 'yellow';
  } else if (action === 'doc-highlight-pink') {
    s.docHighlight = 'pink';
  } else if (action === 'code-preview') {
    s.codeRenderPreview = !s.codeRenderPreview;
  } else if (action === 'code-wrap') {
    s.codeWrap = !s.codeWrap;
  } else if (action === 'code-lines') {
    s.codeLines = !s.codeLines;
  }
  return s;
}

function isSafeMediaSrc(url, kind = 'any') {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  const normKind = String(kind || 'any').toLowerCase();

  // Rutas relativas locales bajo /uploads/ sin path traversal ni extensiones ejecutables/SVG
  if (trimmed.startsWith('/uploads/')) {
    if (trimmed.includes('..') || /[\s<>'"\\]/.test(trimmed)) return false;
    if (/\.(svg|html?|xhtml|mjs|cjs|js)(?:[?#]|$)/i.test(trimmed)) return false;
    return true;
  }

  if (/^blob:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'blob:';
    } catch {
      return false;
    }
  }

  if (/^https:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }

  if (/^data:/i.test(trimmed)) {
    const isSafeImgData = /^data:image\/(?!svg\+xml\b)[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafeVidData = /^data:video\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafeAudData = /^data:audio\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafePdfData = /^data:application\/pdf(?:;[^,]*)?,/i.test(trimmed);
    if (normKind === 'img' || normKind === 'image') return isSafeImgData;
    if (normKind === 'vid' || normKind === 'video') return isSafeVidData;
    if (normKind === 'aud' || normKind === 'audio') return isSafeAudData;
    if (normKind === 'pdf') return isSafePdfData;
    return isSafeImgData || isSafeVidData || isSafeAudData || isSafePdfData;
  }

  return false;
}

function getViewerMediaType(media) {
  const m = String(media?.mime || '').trim().toLowerCase().split(';')[0].trim();
  const n = String(media?.name || '');
  const meta = String(media?.meta || '');

  // Bloquear SVG/HTML/JS como medios embebidos seguros
  if (m && UNSAFE_MEDIA_MIMES.has(m)) {
    if (/\.(html?|css|js|ts|json)$/i.test(n) || /CÓDIGO|CODE|HTML|JS/i.test(meta)) return 'code';
    return 'file';
  }
  if (/\.svg$/i.test(n) && (!m || m === 'image/svg+xml')) return 'file';

  if (m.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(n) || /VIDEO/i.test(meta)) return 'video';
  if (m.startsWith('audio/') || /\.(mp3|wav|m4a|aiff|ogg)$/i.test(n) || /AUDIO/i.test(meta)) return 'audio';
  if (m === 'application/pdf' || /\.pdf$/i.test(n) || /\bPDF\b/i.test(meta)) return 'pdf';
  if (/\.(html?|css|js|ts|json)$/i.test(n) || /CÓDIGO|CODE|HTML|JS/i.test(meta)) return 'code';
  if (/\.(docx?|txt|md|pages|csv|xlsx?|numbers)$/i.test(n) || /DOC|TEXTO|CSV|XLS|SHEET/i.test(meta)) return 'doc';
  if ((m.startsWith('image/') && m !== 'image/svg+xml') || /\.(png|jpe?g|gif|webp|avif)$/i.test(n) || /IMG|IMAGEN|FOTO|ARTE/i.test(meta)) return 'image';
  return 'image';
}

function getMediaTypeTag(type) {
  if (type === 'video') return 'VID';
  if (type === 'audio') return 'AUD';
  if (type === 'pdf') return 'PDF';
  if (type === 'doc') return 'DOC';
  if (type === 'code') return 'COD';
  if (type === 'image') return 'IMG';
  return 'ARCHIVO';
}

function getMediaTypeColor(type) {
  if (type === 'video') return 'text-sky-400';
  if (type === 'audio') return 'text-emerald-400';
  if (type === 'pdf' || type === 'doc') return 'text-rose-400';
  if (type === 'code') return 'text-violet-400';
  if (type === 'image') return 'text-obsidian-amber';
  return 'text-[#8C8C8C]';
}

function renderChartOverlay({
  lightboxChartIdx,
  lastPillBoard,
  dragHandleHtml = '',
  rightActionBtns = '',
}) {
  if (lightboxChartIdx === null || !lastPillBoard || !Array.isArray(lastPillBoard.cards) || !lastPillBoard.cards[lightboxChartIdx]) {
    return '';
  }
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
          <button type="button" data-dk-lb-close="1" title="Cerrar gráfico (Esc)" aria-label="Cerrar gráfico"
            class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
            <span data-icon="x" data-icon-size="w-3.5 h-3.5"></span>
          </button>
          ${rightActionBtns}
        </div>
      </div>
      <div data-dk-scroll-id="viewer-chart:${escapeHtml(lastPillBoard.title || '')}:${lightboxChartIdx}" class="flex-1 min-h-0 overflow-y-auto p-4">
        ${card.largeBody}
      </div>
    </div>
  `;
}

function renderViewerControlsBar({ media, mediaType, safeDownloadSrc, viewerState }) {
  const s = viewerState || createDefaultViewerState();
  const btnCls = (active = false) =>
    `p-1 rounded-md transition-colors cursor-pointer ${active ? 'bg-obsidian-elevated text-obsidian-amber' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}`;

  const zoomGroup = `
    <div class="inline-flex items-center gap-0.5">
      <button type="button" data-dk-viewer-action="zoom-out" data-tip="Alejar" aria-label="Alejar" class="${btnCls(false)}">
        <span data-icon="zoom-out" data-icon-size="w-3.5 h-3.5"></span>
      </button>
      <button type="button" data-dk-viewer-action="fit" data-tip="Ajustar (100%)" aria-label="Ajustar" class="${btnCls(s.zoom !== 1 || s.rotation !== 0 || s.flipH || s.flipV)}">
        <span data-icon="maximize-2" data-icon-size="w-3.5 h-3.5"></span>
      </button>
      <button type="button" data-dk-viewer-action="zoom-in" data-tip="Acercar" aria-label="Acercar" class="${btnCls(false)}">
        <span data-icon="zoom-in" data-icon-size="w-3.5 h-3.5"></span>
      </button>
    </div>
  `;

  let specificGroup = '';
  if (mediaType === 'image') {
    specificGroup = `
      <div class="inline-flex items-center gap-0.5">
        <button type="button" data-dk-viewer-action="rotate" data-tip="Girar 90°" aria-label="Girar 90 grados" class="${btnCls(s.rotation % 360 !== 0)}">
          <span data-icon="rotate-cw" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="flip-h" data-tip="Voltear horizontal" aria-label="Voltear horizontal" class="${btnCls(s.flipH)}">
          <span data-icon="flip-horizontal-2" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="flip-v" data-tip="Voltear vertical" aria-label="Voltear vertical" class="${btnCls(s.flipV)}">
          <span data-icon="flip-vertical-2" data-icon-size="w-3.5 h-3.5"></span>
        </button>
      </div>
      ${zoomGroup}
    `;
  } else if (mediaType === 'video' || mediaType === 'audio') {
    specificGroup = `
      <div class="inline-flex items-center gap-0.5">
        <button type="button" data-dk-viewer-action="video-play" data-tip="${s.videoPlaying ? 'Pausar' : 'Reproducir'}" aria-label="${s.videoPlaying ? 'Pausar' : 'Reproducir'}" class="${btnCls(s.videoPlaying)}">
          <span data-icon="${s.videoPlaying ? 'pause' : 'play'}" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="video-loop" data-tip="Repetir (Loop)" aria-label="Repetir" class="${btnCls(s.videoLoop)}">
          <span data-icon="repeat" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="video-speed" data-tip="Velocidad" aria-label="Velocidad de reproducción"
          class="px-1.5 py-0.5 rounded-md font-mono text-[9.5px] transition-colors cursor-pointer ${s.videoSpeed !== 1 ? 'bg-obsidian-elevated text-obsidian-amber font-semibold' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}">
          ${s.videoSpeed}x
        </button>
        <button type="button" data-dk-viewer-action="video-mute" data-tip="${s.videoMuted ? 'Activar sonido' : 'Silenciar'}" aria-label="${s.videoMuted ? 'Activar sonido' : 'Silenciar'}" class="${btnCls(s.videoMuted)}">
          <span data-icon="${s.videoMuted ? 'volume-x' : 'volume-2'}" data-icon-size="w-3.5 h-3.5"></span>
        </button>
      </div>
    `;
  } else if (mediaType === 'pdf' || mediaType === 'doc') {
    const isSheet = /\.(csv|xlsx?|numbers)$/i.test(media?.name || '') || /CSV|XLS|SHEET/i.test(media?.meta || '');
    specificGroup = `
      <div class="inline-flex items-center gap-0.5 text-[9.5px] font-mono">
        <button type="button" data-dk-viewer-action="doc-prev" ${s.docPage <= 1 ? 'disabled' : ''} data-tip="${isSheet ? 'Hoja anterior' : 'Página anterior'}" aria-label="Anterior"
          class="p-1 rounded-md transition-colors ${s.docPage <= 1 ? 'text-[#444444] cursor-default' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer'}">
          <span data-icon="chevron-left" data-icon-size="w-3 h-3"></span>
        </button>
        <span class="text-[#D4D4D4] px-0.5">${s.docPage}/3</span>
        <button type="button" data-dk-viewer-action="doc-next" ${s.docPage >= 3 ? 'disabled' : ''} data-tip="${isSheet ? 'Hoja siguiente' : 'Página siguiente'}" aria-label="Siguiente"
          class="p-1 rounded-md transition-colors ${s.docPage >= 3 ? 'text-[#444444] cursor-default' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4] cursor-pointer'}">
          <span data-icon="chevron-right" data-icon-size="w-3 h-3"></span>
        </button>
        <button type="button" data-dk-viewer-action="doc-copy" data-tip="${s.docCopied ? 'Copiado' : (isSheet ? 'Copiar tabla' : 'Copiar texto')}" aria-label="Copiar"
          class="p-1 rounded-md transition-colors cursor-pointer ${s.docCopied ? 'bg-obsidian-elevated text-emerald-400' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}">
          <span data-icon="copy" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="doc-highlight" data-tip="Resaltar" aria-label="Resaltar"
          class="p-1 rounded-md transition-colors cursor-pointer ${s.docHighlight === 'yellow' ? 'bg-obsidian-elevated text-amber-300' : (s.docHighlight === 'pink' ? 'bg-obsidian-elevated text-rose-400' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]')}">
          <span data-icon="highlighter" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        ${s.docHighlight ? `
          <button type="button" data-dk-viewer-action="doc-highlight-yellow" data-tip="Amarillo" aria-label="Resaltar amarillo"
            class="w-2.5 h-2.5 rounded-full bg-amber-300 mx-0.5 cursor-pointer ${s.docHighlight === 'yellow' ? 'ring-1 ring-white' : 'opacity-60 hover:opacity-100'}"></button>
          <button type="button" data-dk-viewer-action="doc-highlight-pink" data-tip="Rosa" aria-label="Resaltar rosa"
            class="w-2.5 h-2.5 rounded-full bg-rose-400 mx-0.5 cursor-pointer ${s.docHighlight === 'pink' ? 'ring-1 ring-white' : 'opacity-60 hover:opacity-100'}"></button>
        ` : ''}
      </div>
      ${zoomGroup}
    `;
  } else if (mediaType === 'code') {
    specificGroup = `
      <div class="inline-flex items-center gap-0.5">
        <button type="button" data-dk-viewer-action="code-preview" data-tip="${s.codeRenderPreview ? 'Ver código fuente' : 'Vista previa'}" aria-label="Alternar vista de código" class="${btnCls(s.codeRenderPreview)}">
          <span data-icon="eye" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="code-wrap" data-tip="Ajuste de línea" aria-label="Ajuste de línea" class="${btnCls(s.codeWrap)}">
          <span data-icon="wrap-text" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="code-lines" data-tip="Números de línea" aria-label="Números de línea" class="${btnCls(s.codeLines)}">
          <span data-icon="list-ordered" data-icon-size="w-3.5 h-3.5"></span>
        </button>
        <button type="button" data-dk-viewer-action="doc-copy" data-tip="${s.docCopied ? 'Copiado' : 'Copiar código'}" aria-label="Copiar código"
          class="p-1 rounded-md transition-colors cursor-pointer ${s.docCopied ? 'bg-obsidian-elevated text-emerald-400' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}">
          <span data-icon="copy" data-icon-size="w-3.5 h-3.5"></span>
        </button>
      </div>
      ${zoomGroup}
    `;
  }

  if (!specificGroup && !safeDownloadSrc) return '';

  return `
    <div id="dk-viewer-controls-bar" class="px-2 py-1 rounded-lg bg-[#202020] border border-obsidian-border flex flex-wrap items-center justify-between gap-1.5 shrink-0">
      <div class="flex flex-wrap items-center gap-2 min-w-0">
        ${specificGroup}
      </div>
      ${safeDownloadSrc ? `
        <div class="inline-flex items-center gap-0.5 shrink-0 ${specificGroup ? 'border-l border-obsidian-border pl-1.5' : ''}">
          <a href="${escapeHtml(safeDownloadSrc)}" download="${escapeHtml(media?.name || 'archivo')}" data-tip="Descargar" aria-label="Descargar"
            class="${btnCls(false)} inline-flex items-center justify-center">
            <span data-icon="download" data-icon-size="w-3.5 h-3.5"></span>
          </a>
        </div>
      ` : ''}
    </div>
  `;
}

function renderOtGalleryOverlay({
  selectedContextOt,
  selectedContextTask,
  selectedContextTaskIdx,
  selectedMediaIndex,
  viewerState = null,
  dragHandleHtml = '',
  rightActionBtns = '',
}) {
  if (!selectedContextOt) return '';
  const s = viewerState || createDefaultViewerState();
  const shortCode = String(selectedContextOt.id || '').replace(/^OT-/i, '');
  const hasTaskIdx = Boolean(selectedContextTask) && Number.isInteger(selectedContextTaskIdx);
  const contextBadge = hasTaskIdx
    ? `${shortCode}.${selectedContextTaskIdx + 1}`
    : shortCode;
  const openBadgeAttrs = hasTaskIdx
    ? `data-desktop-edit-task-ot="${escapeHtml(selectedContextOt.id)}" data-desktop-edit-task-idx="${selectedContextTaskIdx}" title="Abrir Tarea"`
    : `data-desktop-edit-ot="${escapeHtml(selectedContextOt.id)}" title="Abrir OT"`;
  const mediaItems = Array.isArray(selectedContextOt.mediaFiles) ? selectedContextOt.mediaFiles : [];
  const activeIdx = (selectedMediaIndex !== null && mediaItems[selectedMediaIndex])
    ? selectedMediaIndex
    : (mediaItems.length ? 0 : null);
  const selectedMedia = activeIdx !== null ? mediaItems[activeIdx] : null;

  const renderMediaPreviewHtml = (m) => {
    const mediaType = getViewerMediaType(m);
    const typeTag = getMediaTypeTag(mediaType);
    const typeColor = getMediaTypeColor(mediaType);
    const statusCls = m.status === 'Aprobado'
      ? 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30'
      : 'text-obsidian-amber bg-amber-500/15 border-amber-500/30';
    const versions = Array.isArray(m.versions) && m.versions.length
      ? m.versions
      : [{ label: 'v1', name: m.name, meta: m.meta }];
    const activeVer = versions[versions.length - 1];
    const rawSrc = m.dataUrl || m.url || activeVer?.url || '';

    const safeImgSrc = mediaType === 'image' && isSafeMediaSrc(rawSrc, 'img') ? rawSrc : '';
    const safeVidSrc = mediaType === 'video' && isSafeMediaSrc(rawSrc, 'vid') ? rawSrc : '';
    const safeAudSrc = mediaType === 'audio' && isSafeMediaSrc(rawSrc, 'aud') ? rawSrc : '';
    const safePdfSrc = mediaType === 'pdf' && isSafeMediaSrc(rawSrc, 'pdf') ? rawSrc : '';
    const safeDownloadSrc = mediaType !== 'file' && isSafeMediaSrc(rawSrc, 'any') ? rawSrc : '';

    const imgTransform = `transform: scale(${s.zoom}) rotate(${s.rotation}deg) scaleX(${s.flipH ? -1 : 1}) scaleY(${s.flipV ? -1 : 1});`;
    const docTransform = `transform: scale(${s.zoom}); transform-origin: top center;`;
    const highlightBorder = s.docHighlight === 'yellow'
      ? 'border-l-2 border-l-amber-300 bg-amber-500/5'
      : (s.docHighlight === 'pink' ? 'border-l-2 border-l-rose-400 bg-rose-500/5' : '');

    let previewVisual = '';
    if (safeImgSrc) {
      previewVisual = `<img src="${escapeHtml(safeImgSrc)}" alt="${escapeHtml(m.name)}" class="max-h-full max-w-full object-contain rounded transition-transform duration-150" style="${imgTransform}" />`;
    } else if (safeVidSrc) {
      previewVisual = `<video data-dk-viewer-media-el="1" src="${escapeHtml(safeVidSrc)}" controls ${s.videoLoop ? 'loop' : ''} ${s.videoMuted ? 'muted' : ''} class="max-h-full max-w-full rounded"></video>`;
    } else if (safeAudSrc) {
      previewVisual = `
        <div class="w-full max-w-[260px] flex flex-col items-center gap-2 px-3">
          <div class="w-10 h-10 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold text-emerald-400">AUD</div>
          <audio data-dk-viewer-media-el="1" src="${escapeHtml(safeAudSrc)}" controls ${s.videoLoop ? 'loop' : ''} ${s.videoMuted ? 'muted' : ''} class="w-full"></audio>
        </div>
      `;
    } else if (safePdfSrc) {
      previewVisual = `<iframe src="${escapeHtml(safePdfSrc)}" title="${escapeHtml(m.name || 'PDF')}" class="w-full h-full min-h-[140px] rounded bg-[#141414] border-0 transition-transform duration-150" style="${docTransform}"></iframe>`;
    } else if (mediaType === 'code') {
      const sampleLines = [
        `<section class="hero">`,
        `  <h1>${escapeHtml(m.name || 'Componente')}</h1>`,
        `  <p>${escapeHtml(m.taskTitle || 'OT')} · ${escapeHtml(activeVer?.label || 'v1')}</p>`,
        `</section>`,
      ];
      previewVisual = s.codeRenderPreview
        ? `
          <div class="w-full h-full overflow-auto p-3 flex items-center justify-center">
            <div class="w-full max-w-[260px] rounded-lg bg-[#1d1d1d] border border-obsidian-border p-3 text-left space-y-1 transition-transform duration-150" style="${docTransform}">
              <div class="font-mono text-[8.5px] uppercase tracking-wider text-violet-400">Vista previa renderizada</div>
              <div class="text-[11px] font-medium text-[#D4D4D4] truncate">${escapeHtml(m.name)}</div>
              <div class="text-[9.5px] text-[#8C8C8C]">${escapeHtml(m.taskTitle || 'OT')} · ${escapeHtml(activeVer?.label || 'v1')}</div>
            </div>
          </div>
        `
        : `
          <div class="w-full h-full overflow-auto p-2.5 font-mono text-[9.5px] text-[#D4D4D4] leading-relaxed transition-transform duration-150" style="${docTransform}">
            ${sampleLines.map((line, idx) => `
              <div class="flex items-start gap-2">
                ${s.codeLines ? `<span class="w-4 text-right text-[#555555] select-none shrink-0">${idx + 1}</span>` : ''}
                <span class="${s.codeWrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'}">${escapeHtml(line)}</span>
              </div>
            `).join('')}
          </div>
        `;
    } else if (mediaType === 'pdf' || mediaType === 'doc') {
      previewVisual = `
        <div class="w-full h-full overflow-auto p-3 flex items-center justify-center">
          <div class="w-full max-w-[260px] rounded-lg bg-[#1d1d1d] border border-obsidian-border p-3 text-left space-y-1.5 transition-transform duration-150 ${highlightBorder}" style="${docTransform}">
            <div class="flex items-center justify-between gap-2 font-mono text-[8.5px]">
              <span class="${typeColor} font-semibold">${typeTag}</span>
              <span class="text-[#737373]">Pág. ${s.docPage} / 3</span>
            </div>
            <div class="text-[10.5px] font-medium text-[#D4D4D4] truncate">${escapeHtml(m.name)}</div>
            <div class="text-[9px] font-mono text-[#737373]">${escapeHtml(m.meta || 'Documento')}</div>
          </div>
        </div>
      `;
    } else {
      previewVisual = `
        <div class="flex flex-col items-center justify-center gap-1.5 text-center px-3 transition-transform duration-150" style="${mediaType === 'image' ? imgTransform : ''}">
          <div class="w-10 h-10 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold ${typeColor}">
            ${typeTag}
          </div>
          <div class="text-[10.5px] font-medium text-[#D4D4D4] truncate max-w-full">${escapeHtml(m.name)}</div>
          <div class="text-[9px] font-mono text-[#737373]">
            ${escapeHtml(m.meta || 'Archivo')}${mediaType === 'video' ? ` · ${s.videoPlaying ? 'Reproduciendo' : 'Pausado'} · ${s.videoSpeed}x${s.videoLoop ? ' · Loop' : ''}${s.videoMuted ? ' · Silencio' : ''}` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="flex-1 min-h-0 flex flex-col gap-2">
        ${renderViewerControlsBar({ media: m, mediaType, safeDownloadSrc, viewerState: s })}
        <div class="relative flex-1 min-h-[110px] rounded-lg bg-[#141414] border border-obsidian-border flex items-center justify-center overflow-hidden p-2">
          ${previewVisual}
          ${mediaType !== 'video' && mediaType !== 'audio' && s.zoom !== 1
            ? `<span class="absolute bottom-1.5 right-2 font-mono text-[9px] text-[#8C8C8C] bg-[#191919]/90 border border-obsidian-border px-1.5 py-0.5 rounded">${Math.round(s.zoom * 100)}%</span>`
            : ''}
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
    <div id="dk-viewer-gallery-root" class="border-t-2 border-t-amber-500/75 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-obsidian-border min-h-0 flex-1 bg-[#171717]">
      <!-- 04.1: Galería de la OT / Tarea -->
      <div class="p-3 flex flex-col min-h-0">
        <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-obsidian-border/70 shrink-0">
          <div class="flex items-center gap-1.5 min-w-0">
            ${dragHandleHtml}
            <span class="font-mono text-[9.5px] text-[#D4D4D4] tracking-wider uppercase font-semibold">Galería</span>
            <button type="button" ${openBadgeAttrs}
              class="px-1.5 py-0.5 rounded bg-[#202020] border border-obsidian-border font-mono text-[8.5px] text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(contextBadge)}</button>
          </div>
          <span class="font-mono text-[9px] text-[#737373] shrink-0">${mediaItems.length} arch.</span>
        </div>
        <div data-dk-scroll-id="viewer-gallery:${escapeHtml(selectedContextOt.id)}" class="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-1.5 content-start pr-0.5">
          ${mediaItems.length
            ? mediaItems.map((m, mIdx) => {
                const mType = getViewerMediaType(m);
                const typeTag = getMediaTypeTag(mType);
                const statusCls = m.status === 'Aprobado'
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : 'text-obsidian-amber bg-amber-500/15';
                const verCount = Array.isArray(m.versions) && m.versions.length ? m.versions.length : 1;
                const isSelMedia = activeIdx === mIdx;
                return `
                  <div role="button" tabindex="0" data-dk-select-media="${mIdx}"
                    class="group text-left p-2 rounded-lg bg-[#202020] hover:bg-[#262626] border ${isSelMedia ? 'border-obsidian-amber/80 bg-[#252525]' : 'border-obsidian-border'} transition-colors cursor-pointer flex flex-col gap-1 min-w-0">
                    <div class="h-12 rounded bg-[#141414] border border-obsidian-border/70 flex items-center justify-between px-2 overflow-hidden">
                      <span class="font-mono text-[9px] font-semibold text-[#8C8C8C]">${typeTag}</span>
                      <span class="px-1 py-0.5 rounded bg-[#222222] font-mono text-[8px] text-[#D4D4D4]">v${verCount}</span>
                    </div>
                    <div class="text-[9.5px] text-[#D4D4D4] truncate" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</div>
                    <div class="flex items-center justify-between gap-1">
                      <span class="text-[8.5px] font-mono text-[#737373] truncate">${escapeHtml(m.taskTitle || 'OT')}</span>
                      <span class="px-1 rounded text-[8px] font-mono shrink-0 ${statusCls}">${escapeHtml(m.status || 'Rev.')}</span>
                    </div>
                  </div>
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
            <button type="button" data-dk-q4-close-ctx="1" title="Cerrar visor (Esc)" aria-label="Cerrar visor"
              class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
              <span data-icon="x" data-icon-size="w-3.5 h-3.5"></span>
            </button>
            ${rightActionBtns}
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

export function renderViewerQuadrant({
  lightboxChartIdx = null,
  lastPillBoard = null,
  selectedContextOt = null,
  selectedContextTask = null,
  selectedContextTaskIdx = null,
  selectedMediaIndex = null,
  viewerState = null,
  dragHandleHtml = '',
  rightActionBtns = '',
}) {
  // 1. Modo contextual: Gráfico ampliado desde C02 Estadística
  if (lightboxChartIdx !== null && lastPillBoard && Array.isArray(lastPillBoard.cards) && lastPillBoard.cards[lightboxChartIdx]) {
    return renderChartOverlay({
      lightboxChartIdx,
      lastPillBoard,
      dragHandleHtml,
      rightActionBtns,
    });
  }

  // 2. Modo contextual: Galería + Vista previa de OT/Tarea seleccionada
  if (selectedContextOt) {
    return renderOtGalleryOverlay({
      selectedContextOt,
      selectedContextTask,
      selectedContextTaskIdx,
      selectedMediaIndex,
      viewerState,
      dragHandleHtml,
      rightActionBtns,
    });
  }

  // 3. Estado base: C04 vacío limpio (visor contextual en reposo)
  return `
    <div id="dk-q4-viewer-root" class="flex-1 flex flex-col min-h-0 border-t-2 border-t-[#3a3a3a] bg-[#171717]">
      <div class="px-3 py-1.5 border-b border-obsidian-border bg-[#1b1b1b] flex items-center justify-between gap-2 shrink-0">
        <div class="flex items-center gap-1.5 min-w-0">
          ${dragHandleHtml}
          <span class="font-mono text-[9.5px] text-[#8C8C8C] tracking-wider uppercase font-semibold truncate">Visor</span>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${rightActionBtns}
        </div>
      </div>
      <div class="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-4 gap-1.5 select-none">
        <span class="text-[11px] font-medium text-[#737373]">Espacio disponible</span>
        <span class="text-[9.5px] font-mono text-[#5A5A5A]">Selecciona una OT, Tarea o Gráfico para previsualizarlo aquí</span>
      </div>
    </div>
  `;
}
