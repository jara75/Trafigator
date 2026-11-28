/**
 * Orquestador del Módulo Corcho (Pasos 1 y 2):
 * - Capa ampliada #corcho-overlay sobre #pane-center (hermana de #center-body, z-[45])
 * - Doble Escape controlado (1.er Esc cierra vista previa, 2.º Esc cierra Corcho)
 * - Acciones: Poner (1), Consultar/Anotar en privado (2), Archivar/Historial (5), Exportar (6), Eliminar (7)
 */

import { hydrateIcons } from '../client/icons.js';
import {
  appendOtMessage,
  ensureOtData,
  escapeHtml,
  notifySketchChange,
  relDate,
  studioTeamList,
  trafficOrders,
  userProfile,
} from './store.js';
import {
  addCorchoFile,
  addCorchoPrivateNote,
  addCorchoTextOrLink,
  archiveCorchoItem,
  buildCorchoMailtoUrl,
  buildCorchoMarkdownExport,
  buildCorchoShareText,
  deleteCorchoItem,
  deleteCorchoPrivateNote,
  getBlob,
  getCorchoFileTag,
  getCorchoItemById,
  isSafeMediaSrc,
  loadCorchoItems,
  markCorchoItemPromoted,
  restoreCorchoItem,
  updateCorchoItem,
} from './corcho-store.js';
import { renderCorchoActionDrawerHtml, renderCorchoPreviewHtml } from './corcho-preview.js';

let corchoOpen = false;
let initialized = false;
let corchoCallbacks = {};
let dragDepth = 0;
let activeTab = 'active'; // 'active' | 'archived'
let historyQuery = '';
let selectedItemId = null;
let notesExpanded = true;
let actionDrawer = null; // null | { itemId: string, mode: 'share' | 'move' }
let sharePurpose = 'inform'; // 'inform' | 'review'
let selectedMoveOtId = '';
let renderSeq = 0;
let feedbackMsg = '';
let feedbackKind = 'info';
let feedbackTimer = null;
const activeObjectUrls = new Set();

function trackObjectUrl(blob) {
  const url = URL.createObjectURL(blob);
  activeObjectUrls.add(url);
  return url;
}

function revokeAllObjectUrls() {
  activeObjectUrls.forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore revoke errors
    }
  });
  activeObjectUrls.clear();
}

function isSuperiorOverlayOpen() {
  const superiorIds = [
    'user-menu-popover',
    'notifications-popover',
    'new-client-modal',
    'user-account-modal',
    'user-switch-modal',
  ];
  return superiorIds.some((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
}

function closeInternalCenterPopovers() {
  ['client-dropdown-menu', 'brand-dropdown-menu', 'product-dropdown-menu', 'ot-gallery-filter-popover'].forEach((id) => {
    document.getElementById(id)?.classList.add('hidden');
  });
}

function syncTriggerButtonState() {
  const btn = document.getElementById('btn-global-corcho');
  if (!btn) return;
  btn.setAttribute('aria-expanded', corchoOpen ? 'true' : 'false');
  btn.classList.toggle('bg-obsidian-elevated', corchoOpen);
  btn.classList.toggle('text-obsidian-amber', corchoOpen);
}

function setFeedback(message, kind = 'info') {
  feedbackMsg = message;
  feedbackKind = kind;
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(() => {
    feedbackMsg = '';
    if (corchoOpen) renderCorcho();
  }, 4000);
}

function handleDocumentKeydown(e) {
  if (!corchoOpen || e.key !== 'Escape') return;
  if (isSuperiorOverlayOpen()) return;
  e.preventDefault();
  e.stopPropagation();
  if (actionDrawer) {
    actionDrawer = null;
    renderCorcho();
    return;
  }
  if (selectedItemId) {
    selectedItemId = null;
    renderCorcho();
    return;
  }
  closeCorcho();
}

async function copyTextToClipboard(text) {
  if (navigator?.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function getActiveOrdersList() {
  return (trafficOrders || []).filter((ot) => ot && !ot.archived);
}

function buildCurrentDrawerHtml(allItems) {
  if (!actionDrawer) return '';
  const target = allItems.find((it) => it.id === actionDrawer.itemId);
  if (!target) {
    actionDrawer = null;
    return '';
  }
  return renderCorchoActionDrawerHtml(target, {
    mode: actionDrawer.mode,
    sharePurpose,
    selectedMoveOtId,
    teamMembers: studioTeamList || [],
    activeOrders: getActiveOrdersList(),
  });
}

function moveItemToExistingOt(itemId, otId) {
  const item = getCorchoItemById(itemId);
  const ot = (trafficOrders || []).find((o) => o.id === otId);
  if (!item || !ot) {
    setFeedback('Selecciona una OT válida.', 'error');
    renderCorcho();
    return;
  }
  ensureOtData(ot);
  const actor = userProfile?.shortName || userProfile?.name || 'Equipo';

  if (item.type === 'file') {
    ot.mediaFiles.push({
      name: item.fileMeta?.name || item.title,
      meta: item.fileMeta?.sizeLabel || 'Archivo',
      status: 'En Revisión',
      taskTitle: 'OT',
      dateOrder: Date.now(),
      corchoBlobId: item.fileMeta?.blobId || null,
    });
  } else {
    const body = item.type === 'link'
      ? `${item.title}${item.url ? ` — ${item.url}` : ''}${item.content ? `\n${item.content}` : ''}`
      : (item.content || item.title);
    appendOtMessage(ot, { text: body, channel: 'App', actor });
  }

  markCorchoItemPromoted(item.id, ot.id, { archive: true });
  actionDrawer = null;
  if (selectedItemId === item.id) selectedItemId = null;
  notifySketchChange('orders', { action: 'corcho-move-ot', otId: ot.id });
  setFeedback(`Movido a ${ot.id} y archivado en Historial.`, 'info');
  renderCorcho();
}

function moveItemToTask(itemId, otId) {
  const item = getCorchoItemById(itemId);
  const ot = (trafficOrders || []).find((o) => o.id === otId);
  if (!item || !ot) {
    setFeedback('Selecciona una OT válida.', 'error');
    renderCorcho();
    return;
  }
  ensureOtData(ot);
  const actor = userProfile?.shortName || userProfile?.name || 'Equipo';
  const taskMedia = item.type === 'file'
    ? [{
        name: item.fileMeta?.name || item.title,
        meta: item.fileMeta?.sizeLabel || 'Archivo',
        status: 'En Revisión',
        taskTitle: item.title,
        dateOrder: Date.now(),
        corchoBlobId: item.fileMeta?.blobId || null,
      }]
    : [];

  ot.subtasks.push({
    title: item.title || 'Nueva tarea',
    responsible: actor,
    department: ot.department || 'Tráfico',
    status: 'Pendiente',
    entryDate: relDate(0),
    deliveryDate: ot.deliveryDate || relDate(3),
    scheduledDate: null,
    estimatedHours: 1,
    notes: item.content || item.url || item.fileMeta?.name || '',
    routes: [],
    mediaFiles: taskMedia,
  });

  if (taskMedia.length) {
    ot.mediaFiles.push(...taskMedia);
  }

  markCorchoItemPromoted(item.id, ot.id, { archive: true });
  actionDrawer = null;
  if (selectedItemId === item.id) selectedItemId = null;
  notifySketchChange('orders', { action: 'corcho-move-task', otId: ot.id });
  notifySketchChange('stripboard', { action: 'corcho-move-task', otId: ot.id });
  setFeedback(`Convertido en Tarea dentro de ${ot.id} y archivado en Historial.`, 'info');
  renderCorcho();
}

function moveItemToNewOt(itemId) {
  const item = getCorchoItemById(itemId);
  if (!item) return;
  const notes = item.type === 'link'
    ? `${item.url || ''}${item.content ? `\n${item.content}` : ''}`.trim()
    : (item.content || item.fileMeta?.name || '');

  actionDrawer = null;
  closeCorcho();
  corchoCallbacks.onNewOtFromCorcho?.({
    title: item.title || '',
    notes,
    onCreated: (newOt) => {
      if (item.type === 'file' && newOt) {
        ensureOtData(newOt);
        newOt.mediaFiles.push({
          name: item.fileMeta?.name || item.title,
          meta: item.fileMeta?.sizeLabel || 'Archivo',
          status: 'En Revisión',
          taskTitle: 'OT',
          dateOrder: Date.now(),
          corchoBlobId: item.fileMeta?.blobId || null,
        });
      }
      markCorchoItemPromoted(item.id, newOt?.id || 'NEW', { archive: true });
    },
  });
}

function formatShortTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${min}`;
  } catch {
    return '';
  }
}

function triggerDownload(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'archivo';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportItem(id) {
  const item = getCorchoItemById(id);
  if (!item) return;

  if (item.type === 'file') {
    const blobId = item.fileMeta?.blobId;
    const blob = blobId ? await getBlob(blobId).catch(() => null) : null;
    if (!blob) {
      setFeedback('No se encontró el archivo original en IndexedDB para exportar.', 'error');
      renderCorcho();
      return;
    }
    triggerDownload(blob, item.fileMeta?.name || item.title || 'archivo');
    setFeedback(`Exportado "${item.fileMeta?.name || item.title}".`, 'info');
    renderCorcho();
    return;
  }

  const { fileName, content } = buildCorchoMarkdownExport(item);
  const mdBlob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(mdBlob, fileName);
  setFeedback(`Exportado "${fileName}".`, 'info');
  renderCorcho();
}

async function openFileBlobInTab(id) {
  const item = getCorchoItemById(id);
  const blobId = item?.fileMeta?.blobId;
  const blob = blobId ? await getBlob(blobId).catch(() => null) : null;
  if (!blob) {
    setFeedback('El archivo binario ya no está disponible en este navegador.', 'error');
    renderCorcho();
    return;
  }
  const url = trackObjectUrl(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
}

function renderCardHtml(item) {
  const isLink = item.type === 'link';
  const isFile = item.type === 'file';
  const isArchived = item.status === 'archived';
  const fileTag = isFile ? getCorchoFileTag(item.fileMeta?.mime, item.fileMeta?.name || item.title) : '';
  const isImgFile = isFile && fileTag === 'IMG' && Boolean(item.fileMeta?.blobId);
  const notesCount = Array.isArray(item.privateNotes) ? item.privateNotes.length : 0;

  const typeBadge = isFile
    ? { label: fileTag, icon: 'file', cls: fileTag === 'PDF' ? 'text-rose-400' : (fileTag === 'VID' ? 'text-sky-400' : (fileTag === 'IMG' ? 'text-obsidian-amber' : 'text-[#8C8C8C]')) }
    : (isLink
        ? { label: 'ENLACE', icon: 'globe', cls: 'text-sky-400' }
        : { label: 'NOTA', icon: 'sticky-note', cls: 'text-obsidian-amber' });

  const bodyHtml = isImgFile
    ? `<div data-corcho-thumb-blob="${escapeHtml(item.fileMeta.blobId)}" data-corcho-thumb-alt="${escapeHtml(item.title)}"
         class="h-24 rounded-lg bg-[#141414] border border-obsidian-border/80 flex items-center justify-center overflow-hidden">
         <span class="font-mono text-[9px] text-[#5a6169]">IMG</span>
       </div>`
    : (isLink
        ? `<div class="font-mono text-[9.5px] text-sky-400/90 truncate" title="${escapeHtml(item.url || '')}">${escapeHtml(item.url || '')}</div>`
        : (isFile
            ? `<div class="font-mono text-[9.5px] text-[#8C8C8C] truncate">${escapeHtml(item.fileMeta?.sizeLabel || 'Archivo local')}</div>`
            : (item.content && item.content !== item.title
                ? `<p class="text-[10.5px] text-[#A3A3A3] line-clamp-3 whitespace-pre-wrap leading-relaxed">${escapeHtml(item.content)}</p>`
                : '')));

  return `
    <article role="button" tabindex="0" data-corcho-open-item="${escapeHtml(item.id)}"
      class="group bg-[#202020] hover:bg-[#252525] border border-obsidian-border rounded-xl p-3 flex flex-col gap-2 transition-colors min-w-0 cursor-pointer">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-semibold ${typeBadge.cls}">
          <span data-icon="${typeBadge.icon}" data-icon-size="w-3 h-3"></span>
          <span>${escapeHtml(typeBadge.label)}</span>
        </span>
        <span class="font-mono text-[8.5px] text-[#6d6d6d] shrink-0">${escapeHtml(formatShortTimestamp(isArchived ? item.archivedAt : item.createdAt))}</span>
      </div>
      <h3 class="text-[11.5px] font-medium text-[#D4D4D4] leading-snug break-words">${escapeHtml(item.title)}</h3>
      ${bodyHtml}
      <div class="mt-auto pt-1.5 border-t border-obsidian-border/60 flex items-center justify-between gap-1">
        <span class="font-mono text-[8.5px] text-[#6d6d6d]">${notesCount ? `${notesCount} ${notesCount === 1 ? 'apunte' : 'apuntes'}` : ''}</span>
        <div class="inline-flex items-center gap-0.5 shrink-0">
          <button type="button" data-corcho-open-share="${escapeHtml(item.id)}" data-tip="Compartir" aria-label="Compartir ficha"
            class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="share-2" data-icon-size="w-3 h-3"></span>
          </button>
          <button type="button" data-corcho-open-move="${escapeHtml(item.id)}" data-tip="Mover a OT o Tarea" aria-label="Mover ficha a OT o Tarea"
            class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="folder-input" data-icon-size="w-3 h-3"></span>
          </button>
          ${isArchived
            ? `<button type="button" data-corcho-restore="${escapeHtml(item.id)}" data-tip="Restaurar" aria-label="Restaurar ficha"
                 class="w-6 h-6 rounded-md text-emerald-400 hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
                 <span data-icon="rotate-ccw" data-icon-size="w-3 h-3"></span>
               </button>`
            : `<button type="button" data-corcho-archive="${escapeHtml(item.id)}" data-tip="Archivar en Historial" aria-label="Archivar ficha"
                 class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
                 <span data-icon="archive" data-icon-size="w-3 h-3"></span>
               </button>`
          }
          <button type="button" data-corcho-export="${escapeHtml(item.id)}" data-tip="Exportar" aria-label="Exportar ficha"
            class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="download" data-icon-size="w-3 h-3"></span>
          </button>
          <button type="button" data-corcho-delete="${escapeHtml(item.id)}" data-tip="Eliminar" aria-label="Eliminar ficha"
            class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="trash-2" data-icon-size="w-3 h-3"></span>
          </button>
        </div>
      </div>
    </article>
  `;
}

async function hydrateCorchoBlobs(overlay, seq) {
  // 1. Miniaturas IMG en cuadrícula
  const thumbEls = Array.from(overlay.querySelectorAll('[data-corcho-thumb-blob]'));
  for (const el of thumbEls) {
    if (seq !== renderSeq || !corchoOpen) return;
    const blobId = el.dataset.corchoThumbBlob;
    const alt = el.dataset.corchoThumbAlt || 'Imagen';
    const blob = await getBlob(blobId).catch(() => null);
    if (seq !== renderSeq || !corchoOpen) return;
    if (!blob) {
      el.innerHTML = `<span class="font-mono text-[9px] text-[#5a6169]">Sin binario</span>`;
      continue;
    }
    const url = trackObjectUrl(blob);
    if (isSafeMediaSrc(url, 'img')) {
      el.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="w-full h-full object-cover" />`;
    }
  }

  // 2. Visor principal de archivo en vista previa
  const previewEl = overlay.querySelector('[data-corcho-preview-blob]');
  if (!previewEl) return;
  const blobId = previewEl.dataset.corchoPreviewBlob;
  const tag = previewEl.dataset.corchoPreviewTag || 'ARCHIVO';
  const itemId = previewEl.dataset.corchoPreviewItemId || '';
  const name = previewEl.dataset.corchoPreviewName || 'Archivo';
  const sizeLabel = previewEl.dataset.corchoPreviewSize || '';

  const blob = blobId ? await getBlob(blobId).catch(() => null) : null;
  if (seq !== renderSeq || !corchoOpen) return;

  if (!blob) {
    previewEl.innerHTML = `
      <div class="flex flex-col items-center justify-center gap-2 text-center px-4">
        <div class="w-11 h-11 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold text-[#8C8C8C]">${escapeHtml(tag)}</div>
        <div class="text-[11.5px] font-medium text-[#D4D4D4] break-all">${escapeHtml(name)}</div>
        <p class="font-mono text-[9.5px] text-rose-300/90 max-w-xs">Archivo no disponible en IndexedDB (puede haber sido limpiado por el navegador).</p>
      </div>
    `;
    return;
  }

  const url = trackObjectUrl(blob);
  if (tag === 'IMG' && isSafeMediaSrc(url, 'img')) {
    previewEl.innerHTML = `<img src="${escapeHtml(url)}" alt="${escapeHtml(name)}" class="max-h-full max-w-full object-contain rounded" />`;
    return;
  }
  if (tag === 'VID' && isSafeMediaSrc(url, 'vid')) {
    previewEl.innerHTML = `<video src="${escapeHtml(url)}" controls class="max-h-full max-w-full rounded"></video>`;
    return;
  }

  // PDF y otros documentos: tarjeta limpia de metadatos + Abrir (window.open) + Descargar (sin <iframe src="blob:...">)
  const tagColor = tag === 'PDF' ? 'text-rose-400' : (tag === 'AUD' ? 'text-emerald-400' : 'text-[#8C8C8C]');
  previewEl.innerHTML = `
    <div class="flex flex-col items-center justify-center gap-2.5 text-center px-4 max-w-sm">
      <div class="w-12 h-12 rounded-xl bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[12px] font-semibold ${tagColor}">
        ${escapeHtml(tag)}
      </div>
      <div class="text-[12px] font-medium text-[#D4D4D4] break-all">${escapeHtml(name)}</div>
      <div class="font-mono text-[9.5px] text-[#8C8C8C]">${escapeHtml(sizeLabel || 'Archivo local')}</div>
      <div class="flex items-center gap-2 pt-1">
        <button type="button" data-corcho-open-blob="${escapeHtml(itemId)}"
          class="px-3 py-1.5 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer">
          <span>Abrir</span>
          <span aria-hidden="true">↗</span>
        </button>
        <button type="button" data-corcho-export="${escapeHtml(itemId)}"
          class="px-3 py-1.5 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[#D4D4D4] text-[11px] inline-flex items-center gap-1.5 transition-colors cursor-pointer">
          <span data-icon="download" data-icon-size="w-3.5 h-3.5"></span>
          <span>Descargar</span>
        </button>
      </div>
    </div>
  `;
  hydrateIcons(previewEl);
}

function getFilteredGridItems(allItems) {
  const byStatus = allItems.filter((it) => it.status === activeTab);
  if (activeTab !== 'archived' || !historyQuery.trim()) return byStatus;
  const q = historyQuery.trim().toLowerCase();
  return byStatus.filter((it) =>
    (it.title || '').toLowerCase().includes(q) ||
    (it.content || '').toLowerCase().includes(q) ||
    (it.url || '').toLowerCase().includes(q) ||
    (it.fileMeta?.name || '').toLowerCase().includes(q)
  );
}

function renderGridItemsHtml(visibleItems) {
  if (visibleItems.length) {
    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 content-start pb-4">
        ${visibleItems.map(renderCardHtml).join('')}
      </div>
    `;
  }
  if (activeTab === 'archived') {
    return `
      <div class="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 gap-1.5 select-none">
        <span data-icon="archive" data-icon-size="w-5 h-5" data-icon-class="text-[#5a6169]"></span>
        <p class="text-[12px] font-medium text-[#8C8C8C]">${historyQuery.trim() ? 'Sin resultados en el Historial' : 'El Historial está vacío'}</p>
        <p class="text-[10.5px] font-mono text-[#5a6169]">Aquí se conservan las fichas que archivas para recuperarlas cuando hagan falta.</p>
      </div>
    `;
  }
  return `
    <div class="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 gap-1.5 select-none">
      <span data-icon="pin" data-icon-size="w-5 h-5" data-icon-class="text-[#5a6169]"></span>
      <p class="text-[12px] font-medium text-[#8C8C8C]">Tu Corcho está despejado</p>
      <p class="text-[10.5px] font-mono text-[#5a6169] max-w-md">Escribe cualquier dato, pega un enlace o arrastra un archivo aquí para tenerlo a la vista sin crear una OT.</p>
    </div>
  `;
}

function renderCorcho() {
  const overlay = document.getElementById('corcho-overlay');
  if (!overlay) return;

  renderSeq += 1;
  const seq = renderSeq;
  revokeAllObjectUrls();

  const allItems = loadCorchoItems();
  const drawerHtml = buildCurrentDrawerHtml(allItems);
  if (selectedItemId) {
    const selected = allItems.find((it) => it.id === selectedItemId);
    if (selected) {
      overlay.innerHTML = renderCorchoPreviewHtml(selected, {
        notesExpanded,
        feedbackMsg,
        feedbackKind,
        drawerHtml,
      });
      hydrateIcons(overlay);
      hydrateCorchoBlobs(overlay, seq);
      return;
    }
    selectedItemId = null;
  }

  const activeCount = allItems.filter((it) => it.status === 'active').length;
  const archivedCount = allItems.filter((it) => it.status === 'archived').length;
  const visibleItems = getFilteredGridItems(allItems);

  overlay.innerHTML = `
    <div class="h-full flex flex-col min-h-0 px-4 py-3 gap-3">
      <!-- Cabecera Corcho -->
      <div class="flex items-center justify-between gap-3 pb-2.5 border-b border-obsidian-border shrink-0">
        <div class="flex items-center gap-3 min-w-0">
          <div class="flex items-center gap-1.5 shrink-0">
            <span data-icon="pin" data-icon-size="w-3.5 h-3.5" data-icon-class="text-obsidian-amber"></span>
            <h2 class="text-[13px] font-medium text-[#D4D4D4]">Corcho</h2>
          </div>
          <div class="inline-flex items-center gap-1 text-[10.5px] font-mono">
            <button type="button" data-corcho-tab="active"
              class="px-2 py-0.5 rounded-md transition-colors cursor-pointer ${activeTab === 'active' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">
              Activos <span class="text-[#8C8C8C]">${activeCount}</span>
            </button>
            <button type="button" data-corcho-tab="archived"
              class="px-2 py-0.5 rounded-md transition-colors cursor-pointer ${activeTab === 'archived' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">
              Historial <span class="text-[#8C8C8C]">${archivedCount}</span>
            </button>
          </div>
        </div>
        <button type="button" data-corcho-close="1" data-tip="Cerrar Corcho (Esc)" aria-label="Cerrar Corcho"
          class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer shrink-0">
          <span data-icon="x" data-icon-size="w-3.5 h-3.5"></span>
        </button>
      </div>

      ${activeTab === 'active'
        ? `
          <!-- Barra de captura instantánea (Poner en ≤1 clic) -->
          <form id="corcho-capture-form" class="flex items-center gap-2 shrink-0" autocomplete="off">
            <label for="corcho-quick-input" class="sr-only">Poner nota o enlace en el Corcho</label>
            <input id="corcho-quick-input" name="corcho_quick_input" type="text"
              placeholder="Escribe una nota, pega un enlace https://... o suelta un archivo aquí (Enter para poner)"
              class="flex-1 min-w-0 bg-[#222222] border border-obsidian-border rounded-lg px-3 py-1.5 text-[11.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none transition-colors" />
            <label for="corcho-file-input" class="sr-only">Subir archivo al Corcho</label>
            <input id="corcho-file-input" name="corcho_file_input" type="file" multiple class="hidden" />
            <button type="button" data-corcho-pick-file="1" data-tip="Subir archivo (máx. 15 MB)" aria-label="Subir archivo"
              class="px-2.5 py-1.5 rounded-lg bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[11px] text-[#D4D4D4] inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0">
              <span data-icon="paperclip" data-icon-size="w-3.5 h-3.5" data-icon-class="text-[#8C8C8C]"></span>
              <span>Archivo</span>
            </button>
            <button type="submit"
              class="px-3.5 py-1.5 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0">
              <span data-icon="plus" data-icon-size="w-3.5 h-3.5"></span>
              <span>Poner</span>
            </button>
          </form>
        `
        : `
          <!-- Buscador rápido en Historial -->
          <div class="flex items-center gap-2 shrink-0">
            <label for="corcho-history-search" class="sr-only">Buscar en Historial del Corcho</label>
            <div class="relative flex-1 max-w-md">
              <span data-icon="search" data-icon-size="w-3.5 h-3.5" data-icon-class="text-[#8C8C8C] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"></span>
              <input id="corcho-history-search" name="corcho_history_search" type="search" value="${escapeHtml(historyQuery)}"
                placeholder="Buscar fichas archivadas..."
                class="w-full bg-[#222222] border border-obsidian-border rounded-lg pl-8 pr-3 py-1.5 text-[11.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none transition-colors" />
            </div>
          </div>
        `
      }

      ${feedbackMsg ? `
        <div role="status" class="px-3 py-1.5 rounded-lg border text-[10.5px] font-mono shrink-0 ${feedbackKind === 'error' ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}">
          ${escapeHtml(feedbackMsg)}
        </div>
      ` : ''}

      ${drawerHtml}

      <!-- Zona de cuadrícula y dropzone -->
      <div id="corcho-dropzone" class="relative flex-1 min-h-0 overflow-y-auto pr-0.5 rounded-xl border ${dragDepth > 0 ? 'border-obsidian-amber bg-amber-500/5' : 'border-transparent'} transition-colors">
        <div id="corcho-grid-slot" class="h-full">
          ${renderGridItemsHtml(visibleItems)}
        </div>
      </div>
    </div>
  `;

  hydrateIcons(overlay);
  hydrateCorchoBlobs(overlay, seq);
}

async function handleIncomingFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const errors = [];
  let added = 0;
  for (const file of files) {
    const res = await addCorchoFile(file);
    if (res.ok) added += 1;
    else errors.push(res.error);
  }
  activeTab = 'active';
  selectedItemId = null;
  if (errors.length) {
    setFeedback(errors[0], 'error');
  } else if (added > 0) {
    setFeedback(added === 1 ? 'Archivo puesto en el Corcho.' : `${added} archivos puestos en el Corcho.`, 'info');
  }
  renderCorcho();
}

export function isCorchoOpen() {
  return corchoOpen;
}

export function openCorcho() {
  const overlay = document.getElementById('corcho-overlay');
  if (!overlay) return;
  if (corchoOpen) {
    renderCorcho();
    return;
  }
  closeInternalCenterPopovers();
  corchoOpen = true;
  dragDepth = 0;
  overlay.classList.remove('hidden');
  syncTriggerButtonState();
  document.addEventListener('keydown', handleDocumentKeydown, true);
  renderCorcho();
  document.getElementById('corcho-quick-input')?.focus();
}

export function closeCorcho() {
  const overlay = document.getElementById('corcho-overlay');
  if (!corchoOpen) return;
  corchoOpen = false;
  dragDepth = 0;
  selectedItemId = null;
  actionDrawer = null;
  revokeAllObjectUrls();
  document.removeEventListener('keydown', handleDocumentKeydown, true);
  if (overlay) {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }
  syncTriggerButtonState();
}

export function toggleCorcho() {
  if (corchoOpen) closeCorcho();
  else openCorcho();
}

export function initCorcho(callbacks = {}) {
  corchoCallbacks = callbacks || {};
  if (initialized) return;
  initialized = true;

  const overlay = document.getElementById('corcho-overlay');
  const triggerBtn = document.getElementById('btn-global-corcho');

  triggerBtn?.addEventListener('click', () => {
    toggleCorcho();
  });

  if (!overlay) return;

  overlay.addEventListener('click', async (e) => {
    if (e.target.closest('[data-corcho-close]')) {
      closeCorcho();
      return;
    }
    if (e.target.closest('[data-corcho-back]')) {
      selectedItemId = null;
      actionDrawer = null;
      renderCorcho();
      return;
    }
    if (e.target.closest('[data-corcho-close-drawer]')) {
      actionDrawer = null;
      renderCorcho();
      return;
    }
    const openShareBtn = e.target.closest('[data-corcho-open-share]');
    if (openShareBtn) {
      e.stopPropagation();
      const id = openShareBtn.dataset.corchoOpenShare;
      if (actionDrawer?.itemId === id && actionDrawer?.mode === 'share') {
        actionDrawer = null;
      } else {
        actionDrawer = { itemId: id, mode: 'share' };
        sharePurpose = 'inform';
      }
      renderCorcho();
      return;
    }
    const openMoveBtn = e.target.closest('[data-corcho-open-move]');
    if (openMoveBtn) {
      e.stopPropagation();
      const id = openMoveBtn.dataset.corchoOpenMove;
      if (actionDrawer?.itemId === id && actionDrawer?.mode === 'move') {
        actionDrawer = null;
      } else {
        actionDrawer = { itemId: id, mode: 'move' };
        if (!selectedMoveOtId) selectedMoveOtId = getActiveOrdersList()[0]?.id || '';
      }
      renderCorcho();
      return;
    }
    const purposeBtn = e.target.closest('[data-corcho-share-purpose]');
    if (purposeBtn) {
      sharePurpose = purposeBtn.dataset.corchoSharePurpose === 'review' ? 'review' : 'inform';
      renderCorcho();
      return;
    }
    const copyMemberBtn = e.target.closest('[data-corcho-share-copy-member]');
    if (copyMemberBtn && actionDrawer?.itemId) {
      const recipientName = copyMemberBtn.dataset.corchoShareCopyMember || '';
      const item = getCorchoItemById(actionDrawer.itemId);
      if (item) {
        const text = buildCorchoShareText(item, { recipientName, purpose: sharePurpose });
        const copied = await copyTextToClipboard(text);
        setFeedback(
          copied
            ? `Copiado para enviar a ${recipientName}.`
            : 'No se pudo copiar al portapapeles.',
          copied ? 'info' : 'error'
        );
        actionDrawer = null;
        renderCorcho();
      }
      return;
    }
    const moveOtBtn = e.target.closest('[data-corcho-move-to-ot]');
    if (moveOtBtn) {
      const otId = overlay.querySelector('#corcho-move-ot-select')?.value || selectedMoveOtId;
      moveItemToExistingOt(moveOtBtn.dataset.corchoMoveToOt, otId);
      return;
    }
    const moveTaskBtn = e.target.closest('[data-corcho-move-to-task]');
    if (moveTaskBtn) {
      const otId = overlay.querySelector('#corcho-move-ot-select')?.value || selectedMoveOtId;
      moveItemToTask(moveTaskBtn.dataset.corchoMoveToTask, otId);
      return;
    }
    const moveNewOtBtn = e.target.closest('[data-corcho-move-to-new-ot]');
    if (moveNewOtBtn) {
      moveItemToNewOt(moveNewOtBtn.dataset.corchoMoveToNewOt);
      return;
    }
    if (e.target.closest('[data-corcho-pick-file]')) {
      overlay.querySelector('#corcho-file-input')?.click();
      return;
    }
    const tabBtn = e.target.closest('[data-corcho-tab]');
    if (tabBtn) {
      const next = tabBtn.dataset.corchoTab;
      if (next === 'active' || next === 'archived') {
        activeTab = next;
        selectedItemId = null;
        renderCorcho();
      }
      return;
    }
    if (e.target.closest('[data-corcho-toggle-notes]')) {
      notesExpanded = !notesExpanded;
      renderCorcho();
      return;
    }
    const openBlobBtn = e.target.closest('[data-corcho-open-blob]');
    if (openBlobBtn) {
      e.stopPropagation();
      await openFileBlobInTab(openBlobBtn.dataset.corchoOpenBlob);
      return;
    }
    const archiveBtn = e.target.closest('[data-corcho-archive]');
    if (archiveBtn) {
      e.stopPropagation();
      const id = archiveBtn.dataset.corchoArchive;
      const res = archiveCorchoItem(id);
      if (res.ok) {
        if (selectedItemId === id) selectedItemId = null;
        setFeedback('Ficha archivada en Historial.', 'info');
      } else {
        setFeedback(res.error, 'error');
      }
      renderCorcho();
      return;
    }
    const restoreBtn = e.target.closest('[data-corcho-restore]');
    if (restoreBtn) {
      e.stopPropagation();
      const id = restoreBtn.dataset.corchoRestore;
      const res = restoreCorchoItem(id);
      if (res.ok) {
        if (selectedItemId === id) selectedItemId = null;
        setFeedback('Ficha restaurada a Activos.', 'info');
      } else {
        setFeedback(res.error, 'error');
      }
      renderCorcho();
      return;
    }
    const exportBtn = e.target.closest('[data-corcho-export]');
    if (exportBtn) {
      e.stopPropagation();
      await exportItem(exportBtn.dataset.corchoExport);
      return;
    }
    const deleteBtn = e.target.closest('[data-corcho-delete]');
    if (deleteBtn) {
      e.stopPropagation();
      const id = deleteBtn.dataset.corchoDelete;
      const res = await deleteCorchoItem(id);
      if (res.ok) {
        if (selectedItemId === id) selectedItemId = null;
        setFeedback('Ficha eliminada definitivamente.', 'info');
      } else {
        setFeedback(res.error, 'error');
      }
      renderCorcho();
      return;
    }
    const delPNoteBtn = e.target.closest('[data-corcho-del-pnote]');
    if (delPNoteBtn) {
      e.stopPropagation();
      const res = deleteCorchoPrivateNote(delPNoteBtn.dataset.corchoPnoteItem, delPNoteBtn.dataset.corchoDelPnote);
      if (!res.ok) setFeedback(res.error, 'error');
      renderCorcho();
      return;
    }
    const openCard = e.target.closest('[data-corcho-open-item]');
    if (openCard && !e.target.closest('button, a')) {
      const id = openCard.dataset.corchoOpenItem;
      const item = getCorchoItemById(id);
      if (item) {
        selectedItemId = item.id;
        notesExpanded = item.type !== 'note' || (item.privateNotes?.length || 0) > 0;
        renderCorcho();
      }
    }
  });

  overlay.addEventListener('keydown', (e) => {
    const openCard = e.target.closest('[data-corcho-open-item]');
    if (openCard && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button, a, input, textarea')) {
      e.preventDefault();
      const item = getCorchoItemById(openCard.dataset.corchoOpenItem);
      if (item) {
        selectedItemId = item.id;
        notesExpanded = item.type !== 'note' || (item.privateNotes?.length || 0) > 0;
        renderCorcho();
      }
    }
  });

  overlay.addEventListener('input', (e) => {
    const searchInput = e.target.closest('#corcho-history-search');
    if (searchInput) {
      historyQuery = searchInput.value || '';
      const gridSlot = overlay.querySelector('#corcho-grid-slot');
      if (gridSlot) {
        renderSeq += 1;
        const seq = renderSeq;
        revokeAllObjectUrls();
        gridSlot.innerHTML = renderGridItemsHtml(getFilteredGridItems(loadCorchoItems()));
        hydrateIcons(gridSlot);
        hydrateCorchoBlobs(overlay, seq);
      }
      return;
    }

    const noteEditor = e.target.closest('[data-corcho-note-editor]');
    if (noteEditor) {
      const id = noteEditor.dataset.corchoNoteEditor;
      const res = updateCorchoItem(id, { content: noteEditor.value });
      const ind = overlay.querySelector('#corcho-save-indicator');
      if (ind) ind.textContent = res.ok ? 'Guardado' : 'Error al guardar';
      return;
    }

    const titleEditor = e.target.closest('[data-corcho-title-editor]');
    if (titleEditor) {
      const id = titleEditor.dataset.corchoTitleEditor;
      updateCorchoItem(id, { title: titleEditor.value });
    }
  });

  overlay.addEventListener('submit', (e) => {
    const captureForm = e.target.closest('#corcho-capture-form');
    if (captureForm) {
      e.preventDefault();
      const input = captureForm.querySelector('#corcho-quick-input');
      const res = addCorchoTextOrLink(input?.value || '');
      if (!res.ok) {
        setFeedback(res.error, 'error');
        renderCorcho();
        overlay.querySelector('#corcho-quick-input')?.focus();
        return;
      }
      feedbackMsg = '';
      renderCorcho();
      overlay.querySelector('#corcho-quick-input')?.focus();
      return;
    }

    const pNoteForm = e.target.closest('#corcho-private-note-form');
    if (pNoteForm) {
      e.preventDefault();
      const input = pNoteForm.querySelector('#corcho-private-note-input');
      const id = pNoteForm.dataset.corchoNoteTarget;
      const res = addCorchoPrivateNote(id, input?.value || '');
      if (!res.ok) {
        setFeedback(res.error, 'error');
      } else {
        notesExpanded = true;
      }
      renderCorcho();
      overlay.querySelector('#corcho-private-note-input')?.focus();
      return;
    }

    const shareEmailForm = e.target.closest('#corcho-share-email-form');
    if (shareEmailForm) {
      e.preventDefault();
      const emailInput = shareEmailForm.querySelector('#corcho-share-email-input');
      const email = (emailInput?.value || '').trim();
      if (!email) {
        setFeedback('Escribe un correo electrónico para abrir el borrador.', 'error');
        renderCorcho();
        return;
      }
      const item = getCorchoItemById(shareEmailForm.dataset.corchoShareItem);
      if (item) {
        const mailtoUrl = buildCorchoMailtoUrl(item, { email, purpose: sharePurpose });
        const a = document.createElement('a');
        a.href = mailtoUrl;
        a.click();
        setFeedback(`Correo listo para ${email}.`, 'info');
        actionDrawer = null;
        renderCorcho();
      }
    }
  });

  overlay.addEventListener('change', (e) => {
    const moveSelect = e.target.closest('#corcho-move-ot-select');
    if (moveSelect) {
      selectedMoveOtId = moveSelect.value || '';
      return;
    }
    const fileInput = e.target.closest('#corcho-file-input');
    if (!fileInput || !fileInput.files?.length) return;
    handleIncomingFiles(fileInput.files);
    fileInput.value = '';
  });

  // Drag & drop sin parpadeo usando contador dragDepth
  overlay.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    dragDepth += 1;
    if (dragDepth === 1) {
      const dz = overlay.querySelector('#corcho-dropzone');
      dz?.classList.add('border-obsidian-amber', 'bg-amber-500/5');
      dz?.classList.remove('border-transparent');
    }
  });

  overlay.addEventListener('dragover', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  overlay.addEventListener('dragleave', (e) => {
    if (dragDepth <= 0) return;
    e.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      const dz = overlay.querySelector('#corcho-dropzone');
      dz?.classList.remove('border-obsidian-amber', 'bg-amber-500/5');
      dz?.classList.add('border-transparent');
    }
  });

  overlay.addEventListener('drop', (e) => {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault();
    dragDepth = 0;
    handleIncomingFiles(e.dataTransfer.files);
  });
}
