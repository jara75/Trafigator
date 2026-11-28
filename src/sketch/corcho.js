/**
 * Orquestador del Módulo Corcho (Paso 1):
 * - Capa ampliada #corcho-overlay sobre #pane-center (hermana de #center-body, z-[45])
 * - Listener de Escape controlado (adjunto al abrir, removido al cerrar)
 * - Acción 1: Poner en ≤1 clic (Enter, + Archivo o drag & drop sin parpadeo) y cuadrícula activa Obsidian
 */

import { hydrateIcons } from '../client/icons.js';
import { escapeHtml } from './store.js';
import {
  addCorchoFile,
  addCorchoTextOrLink,
  getCorchoFileTag,
  loadCorchoItems,
} from './corcho-store.js';

let corchoOpen = false;
let initialized = false;
let dragDepth = 0;
let feedbackMsg = '';
let feedbackKind = 'info'; // 'info' | 'error'
let feedbackTimer = null;
const activeObjectUrls = new Set();

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
  if (!corchoOpen) return;
  if (e.key !== 'Escape') return;
  if (isSuperiorOverlayOpen()) return;
  e.preventDefault();
  e.stopPropagation();
  closeCorcho();
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

function renderCardHtml(item) {
  const isLink = item.type === 'link';
  const isFile = item.type === 'file';
  const fileTag = isFile ? getCorchoFileTag(item.fileMeta?.mime, item.fileMeta?.name || item.title) : '';
  const typeBadge = isFile
    ? { label: fileTag, icon: 'file', cls: fileTag === 'PDF' ? 'text-rose-400' : (fileTag === 'VID' ? 'text-sky-400' : (fileTag === 'IMG' ? 'text-obsidian-amber' : 'text-[#8C8C8C]')) }
    : (isLink
        ? { label: 'ENLACE', icon: 'globe', cls: 'text-sky-400' }
        : { label: 'NOTA', icon: 'sticky-note', cls: 'text-obsidian-amber' });

  const bodyHtml = isLink
    ? `<div class="font-mono text-[9.5px] text-sky-400/90 truncate" title="${escapeHtml(item.url || '')}">${escapeHtml(item.url || '')}</div>`
    : (isFile
        ? `<div class="font-mono text-[9.5px] text-[#8C8C8C] truncate">${escapeHtml(item.fileMeta?.sizeLabel || 'Archivo local')}</div>`
        : (item.content && item.content !== item.title
            ? `<p class="text-[10.5px] text-[#A3A3A3] line-clamp-3 whitespace-pre-wrap leading-relaxed">${escapeHtml(item.content)}</p>`
            : ''));

  return `
    <article data-corcho-card-id="${escapeHtml(item.id)}"
      class="bg-[#202020] hover:bg-[#252525] border border-obsidian-border rounded-xl p-3 flex flex-col gap-2 transition-colors min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-semibold ${typeBadge.cls}">
          <span data-icon="${typeBadge.icon}" data-icon-size="w-3 h-3"></span>
          <span>${escapeHtml(typeBadge.label)}</span>
        </span>
        <span class="font-mono text-[8.5px] text-[#6d6d6d] shrink-0">${escapeHtml(formatShortTimestamp(item.createdAt))}</span>
      </div>
      <h3 class="text-[11.5px] font-medium text-[#D4D4D4] leading-snug break-words">${escapeHtml(item.title)}</h3>
      ${bodyHtml}
    </article>
  `;
}

function renderCorcho() {
  const overlay = document.getElementById('corcho-overlay');
  if (!overlay) return;

  revokeAllObjectUrls();
  const activeItems = loadCorchoItems().filter((it) => it.status === 'active');

  overlay.innerHTML = `
    <div class="h-full flex flex-col min-h-0 px-4 py-3 gap-3">
      <!-- Cabecera Corcho -->
      <div class="flex items-center justify-between gap-3 pb-2.5 border-b border-obsidian-border shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span data-icon="pin" data-icon-size="w-3.5 h-3.5" data-icon-class="text-obsidian-amber"></span>
          <h2 class="text-[13px] font-medium text-[#D4D4D4] truncate">Corcho</h2>
          <span class="font-mono text-[9.5px] text-[#8C8C8C]">${activeItems.length} ${activeItems.length === 1 ? 'ficha' : 'fichas'}</span>
        </div>
        <button type="button" data-corcho-close="1" data-tip="Cerrar Corcho (Esc)" aria-label="Cerrar Corcho"
          class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer shrink-0">
          <span data-icon="x" data-icon-size="w-3.5 h-3.5"></span>
        </button>
      </div>

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

      ${feedbackMsg ? `
        <div role="status" class="px-3 py-1.5 rounded-lg border text-[10.5px] font-mono shrink-0 ${feedbackKind === 'error' ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}">
          ${escapeHtml(feedbackMsg)}
        </div>
      ` : ''}

      <!-- Zona de cuadrícula y dropzone -->
      <div id="corcho-dropzone" class="relative flex-1 min-h-0 overflow-y-auto pr-0.5 rounded-xl border ${dragDepth > 0 ? 'border-obsidian-amber bg-amber-500/5' : 'border-transparent'} transition-colors">
        ${dragDepth > 0 ? `
          <div class="pointer-events-none sticky top-2 z-10 mx-auto w-fit px-3 py-1 rounded-lg bg-[#202020] border border-obsidian-amber font-mono text-[10px] text-obsidian-amber">
            Suelta el archivo para ponerlo en el Corcho
          </div>
        ` : ''}
        ${activeItems.length
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5 content-start pb-4">
              ${activeItems.map(renderCardHtml).join('')}
            </div>`
          : `<div class="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 gap-1.5 select-none">
              <span data-icon="pin" data-icon-size="w-5 h-5" data-icon-class="text-[#5a6169]"></span>
              <p class="text-[12px] font-medium text-[#8C8C8C]">Tu Corcho está despejado</p>
              <p class="text-[10.5px] font-mono text-[#5a6169] max-w-md">Escribe cualquier dato, pega un enlace o arrastra un archivo aquí para tenerlo a la vista sin crear una OT.</p>
            </div>`
        }
      </div>
    </div>
  `;

  hydrateIcons(overlay);
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

export function initCorcho() {
  if (initialized) return;
  initialized = true;

  const overlay = document.getElementById('corcho-overlay');
  const triggerBtn = document.getElementById('btn-global-corcho');

  triggerBtn?.addEventListener('click', () => {
    toggleCorcho();
  });

  if (!overlay) return;

  overlay.addEventListener('click', (e) => {
    const closeBtn = e.target.closest('[data-corcho-close]');
    if (closeBtn) {
      closeCorcho();
      return;
    }
    const pickFileBtn = e.target.closest('[data-corcho-pick-file]');
    if (pickFileBtn) {
      overlay.querySelector('#corcho-file-input')?.click();
    }
  });

  overlay.addEventListener('submit', (e) => {
    const form = e.target.closest('#corcho-capture-form');
    if (!form) return;
    e.preventDefault();
    const input = form.querySelector('#corcho-quick-input');
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
  });

  overlay.addEventListener('change', (e) => {
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
