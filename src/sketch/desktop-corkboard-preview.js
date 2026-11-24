/**
 * Renderizado puro del Estado 2 del Tablero de Corcho (C04):
 * - Vista Previa de Pin (`file`, `note`, `link`) en división 1/2 + 1/2
 * - Cabecera plana Obsidian (`‹ Corcho`, tipo, título editable inline, código OT, cierre `×`)
 * - Visores por tipo (editor de nota, tarjeta de enlace + extracto, archivo local IDB / ref OT / fallback)
 * - Panel derecho de resaltados y apuntes privados con formulario compacto accesible
 */

import { escapeHtml } from './store.js';
import { getFileTypeTag } from './desktop-corkboard-store.js';

export function getCorkPinTypeBadge(pin) {
  if (!pin) return { label: 'PIN', colorCls: 'text-[#8C8C8C]' };
  if (pin.type === 'note') return { label: 'NOTA', colorCls: 'text-[#8C8C8C]' };
  if (pin.type === 'link') return { label: 'WEB', colorCls: 'text-sky-400/90' };
  if (pin.type === 'file') {
    const tag = getFileTypeTag(pin.fileMeta?.mime, pin.title);
    const colorCls = tag === 'PDF'
      ? 'text-rose-400'
      : (tag === 'VID' ? 'text-sky-400' : (tag === 'IMG' ? 'text-obsidian-amber' : 'text-[#8C8C8C]'));
    return { label: tag, colorCls };
  }
  return { label: String(pin.type || 'PIN').toUpperCase(), colorCls: 'text-[#8C8C8C]' };
}

function formatHighlightTimestamp(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${mins}`;
  } catch {
    return '';
  }
}

export function renderCorkPinPreviewHeaderLeft(pin, { canEdit = false } = {}) {
  const badge = getCorkPinTypeBadge(pin);
  const shortOt = pin?.otId ? String(pin.otId).replace(/^OT-/i, '') : '';
  const titleHtml = canEdit
    ? `
      <label for="cork-preview-title" class="sr-only">Título de la ficha</label>
      <input id="cork-preview-title" name="cork_preview_title" type="text" maxlength="140"
        value="${escapeHtml(pin?.title || '')}" placeholder="Sin título..."
        data-cork-preview-title="1"
        class="min-w-[80px] flex-1 bg-transparent hover:bg-[#202020] focus:bg-[#222222] border border-transparent focus:border-[#3f3f3f] rounded px-1.5 py-0.5 text-[11px] font-medium text-[#D4D4D4] placeholder-[#5a6169] truncate focus:outline-none transition-colors" />
    `
    : `<span class="text-[11px] font-medium text-[#D4D4D4] truncate" title="${escapeHtml(pin?.title || '')}">${escapeHtml(pin?.title || 'Sin título')}</span>`;

  return `
    <button type="button" data-cork-close-preview="1" title="Volver al Tablero de Corcho (Esc)"
      class="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9.5px] font-mono text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated cursor-pointer transition-colors shrink-0">
      <span aria-hidden="true">‹</span>
      <span>Corcho</span>
    </button>
    <span class="text-[#3a3a3a] font-mono text-[9px] shrink-0" aria-hidden="true">·</span>
    <span class="font-mono text-[8.5px] uppercase tracking-wider font-semibold ${badge.colorCls} shrink-0">${escapeHtml(badge.label)}</span>
    ${titleHtml}
    ${shortOt
      ? `<button type="button" data-cork-open-ot="${escapeHtml(pin.otId)}" title="Abrir OT ${escapeHtml(shortOt)}"
           class="px-1.5 py-0.5 rounded bg-[#202020] border border-obsidian-border font-mono text-[8.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOt)}</button>`
      : ''}
  `;
}

export function renderCorkPinPreviewCloseBtn() {
  return `
    <button type="button" data-cork-close-preview="1" title="Cerrar Vista Previa (Esc)" aria-label="Cerrar Vista Previa"
      class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0">
      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  `;
}

function renderNoteViewer(pin, { canEdit }) {
  if (!canEdit) {
    return `
      <div class="flex-1 min-h-0 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 shrink-0">
          <span class="font-mono text-[9px] uppercase tracking-wider text-[#8C8C8C]">Nota de texto</span>
          <span class="font-mono text-[8.5px] text-[#5A5A5A] uppercase">Solo lectura</span>
        </div>
        <div class="flex-1 min-h-[140px] overflow-y-auto rounded-lg bg-[#191919] border border-obsidian-border p-2.5 text-[11px] text-[#D4D4D4] whitespace-pre-wrap leading-relaxed select-text">${escapeHtml(pin.content || 'Sin contenido.')}</div>
      </div>
    `;
  }
  return `
    <div class="flex-1 min-h-0 flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2 shrink-0">
        <span class="font-mono text-[9px] uppercase tracking-wider text-[#8C8C8C]">Editor de nota</span>
        <div class="inline-flex items-center gap-2">
          <span data-cork-save-status="1" class="font-mono text-[8.5px] text-[#5A5A5A]">Guardado local</span>
          <button type="button" data-cork-capture-selection="1"
            class="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated cursor-pointer transition-colors">Resaltar selección</button>
        </div>
      </div>
      <label for="cork-preview-note-editor" class="sr-only">Contenido de la nota</label>
      <textarea id="cork-preview-note-editor" name="cork_preview_note_editor" data-cork-note-editor="1"
        placeholder="Escribe apuntes, guiones o referencias aquí..."
        class="flex-1 min-h-[140px] w-full bg-[#191919] border border-obsidian-border rounded-lg p-2.5 text-[11px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-relaxed">${escapeHtml(pin.content || '')}</textarea>
      <p data-cork-selection-hint="1" class="hidden font-mono text-[9px] text-obsidian-amber shrink-0"></p>
    </div>
  `;
}

function renderLinkViewer(pin, { canEdit }) {
  let domain = '';
  try {
    domain = new URL(pin.url).hostname.replace(/^www\./i, '');
  } catch {
    domain = pin.url || '';
  }

  return `
    <div class="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
      <div class="p-3 rounded-lg bg-[#202020] border border-obsidian-border space-y-2 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[9px] uppercase tracking-wider text-sky-400 font-semibold">${escapeHtml(domain || 'ENLACE WEB')}</span>
          ${pin.url ? `
            <a href="${escapeHtml(pin.url)}" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border font-mono text-[9px] text-[#D4D4D4] hover:text-obsidian-amber transition-colors shrink-0">
              <span>Abrir</span>
              <span aria-hidden="true">↗</span>
            </a>
          ` : ''}
        </div>
        <div class="font-mono text-[9.5px] text-[#8C8C8C] break-all select-all bg-[#191919] border border-obsidian-border/70 rounded px-2 py-1.5">${escapeHtml(pin.url || 'Sin URL')}</div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2 shrink-0">
          <label for="cork-preview-link-excerpt" class="font-mono text-[9px] uppercase tracking-wider text-[#8C8C8C]">Extracto o cita manual</label>
          ${canEdit ? `
            <div class="inline-flex items-center gap-2">
              <span data-cork-save-status="1" class="font-mono text-[8.5px] text-[#5A5A5A]">Guardado local</span>
              <button type="button" data-cork-capture-link-excerpt="1"
                class="px-1.5 py-0.5 rounded text-[9px] font-mono text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated cursor-pointer transition-colors">Usar como resaltado</button>
            </div>
          ` : ''}
        </div>
        ${canEdit
          ? `<textarea id="cork-preview-link-excerpt" name="cork_preview_link_excerpt" data-cork-link-excerpt="1" rows="4"
               placeholder="Pega aquí un extracto, referencia clave o notas del sitio..."
               class="flex-1 min-h-[100px] w-full bg-[#191919] border border-obsidian-border rounded-lg p-2.5 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-relaxed">${escapeHtml(pin.content || '')}</textarea>`
          : `<div class="flex-1 min-h-[90px] overflow-y-auto rounded-lg bg-[#191919] border border-obsidian-border p-2.5 text-[10.5px] text-[#D4D4D4] whitespace-pre-wrap leading-relaxed select-text">${escapeHtml(pin.content || 'Sin extracto guardado.')}</div>`
        }
      </div>
    </div>
  `;
}

function renderFileFallbackCard({ tag, tagColorCls, title, sizeLabel, otId, isDemo }) {
  const shortOt = otId ? String(otId).replace(/^OT-/i, '') : '';
  return `
    <div class="flex flex-col items-center justify-center gap-2 text-center px-4 py-6 max-w-full">
      <div class="w-11 h-11 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold ${tagColorCls}">
        ${escapeHtml(tag)}
      </div>
      <div class="text-[11px] font-medium text-[#D4D4D4] break-all max-w-full">${escapeHtml(title || 'Archivo')}</div>
      <div class="font-mono text-[9px] text-[#737373]">
        ${escapeHtml(sizeLabel || 'Referencia')}
        ${shortOt ? ` · OT ${escapeHtml(shortOt)}` : ''}
      </div>
      <p class="text-[9.5px] font-mono text-[#5A5A5A] max-w-[260px] leading-snug">
        ${isDemo
          ? 'Documento demo sin binario adjunto. Puedes registrar resaltados y apuntes privados a la derecha.'
          : 'Referencia de archivo sin binario local. Sube un archivo con + Archivo para previsualizarlo aquí.'}
      </p>
    </div>
  `;
}

function renderFileViewer(pin, { trafficOrders = [] }) {
  const liveOt = pin.otId ? (trafficOrders || []).find((o) => o.id === pin.otId) || null : null;
  const liveMedia = liveOt && Number.isInteger(pin.mediaIndex)
    ? ((liveOt.mediaFiles || [])[pin.mediaIndex] || null)
    : null;
  const mime = pin.fileMeta?.mime || liveMedia?.mime || '';
  const tag = getFileTypeTag(mime, pin.title || liveMedia?.name || '');
  const tagColorCls = tag === 'PDF'
    ? 'text-rose-400'
    : (tag === 'VID' ? 'text-sky-400' : (tag === 'IMG' ? 'text-obsidian-amber' : 'text-[#8C8C8C]'));
  const sizeLabel = pin.fileMeta?.sizeLabel || liveMedia?.meta || '';
  const blobId = pin.fileMeta?.blobId || '';
  const otDataUrl = liveMedia?.dataUrl || '';
  const shortOt = pin.otId ? String(pin.otId).replace(/^OT-/i, '') : '';

  let stageHtml = '';
  if (blobId) {
    stageHtml = `
      <div data-cork-preview-blob-id="${escapeHtml(blobId)}"
           data-cork-preview-file-tag="${escapeHtml(tag)}"
           data-cork-preview-file-name="${escapeHtml(pin.title || 'Archivo')}"
           data-cork-preview-file-size="${escapeHtml(sizeLabel)}"
           class="w-full h-full flex items-center justify-center">
        <span class="font-mono text-[9.5px] text-[#737373]">Cargando recurso local...</span>
      </div>
    `;
  } else if (otDataUrl) {
    if (tag === 'IMG') {
      stageHtml = `<img src="${escapeHtml(otDataUrl)}" alt="${escapeHtml(pin.title || 'Imagen')}" class="max-h-full max-w-full object-contain rounded" />`;
    } else if (tag === 'VID') {
      stageHtml = `<video src="${escapeHtml(otDataUrl)}" controls class="max-h-full max-w-full rounded"></video>`;
    } else if (tag === 'PDF') {
      stageHtml = `<iframe src="${escapeHtml(otDataUrl)}" title="${escapeHtml(pin.title || 'PDF')}" class="w-full h-full min-h-[180px] rounded bg-[#141414] border-0"></iframe>`;
    } else {
      stageHtml = `
        <div class="flex flex-col items-center justify-center gap-2 text-center px-4">
          <div class="w-11 h-11 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold ${tagColorCls}">${escapeHtml(tag)}</div>
          <div class="text-[11px] font-medium text-[#D4D4D4] break-all">${escapeHtml(pin.title || 'Archivo')}</div>
          <a href="${escapeHtml(otDataUrl)}" download="${escapeHtml(pin.title || 'archivo')}"
            class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10px] font-mono text-[#D4D4D4] transition-colors">Descargar archivo</a>
        </div>
      `;
    }
  } else {
    stageHtml = renderFileFallbackCard({
      tag,
      tagColorCls,
      title: pin.title || liveMedia?.name || 'Archivo',
      sizeLabel,
      otId: pin.otId,
      isDemo: Boolean(pin.demoPackId),
    });
  }

  return `
    <div class="flex-1 min-h-0 flex flex-col gap-2">
      <div class="flex-1 min-h-[150px] rounded-lg bg-[#141414] border border-obsidian-border flex items-center justify-center overflow-hidden p-2">
        ${stageHtml}
      </div>
      <div class="flex items-center justify-between gap-2 text-[9px] font-mono text-[#737373] shrink-0 min-w-0">
        <span class="truncate" title="${escapeHtml(pin.title || '')}">${escapeHtml(pin.title || 'Archivo')}${sizeLabel ? ` · ${escapeHtml(sizeLabel)}` : ''}</span>
        <span class="shrink-0">${blobId ? 'IndexedDB local' : (shortOt ? `Ref. OT ${escapeHtml(shortOt)}` : 'Referencia')}</span>
      </div>
    </div>
  `;
}

export function renderCorkPinHighlightsList(pin, { canEdit = false } = {}) {
  const highlights = Array.isArray(pin?.highlights) ? pin.highlights : [];
  if (!highlights.length) {
    return `
      <div class="flex-1 flex flex-col items-center justify-center py-6 text-center gap-1">
        <span class="text-[10px] text-[#8C8C8C]">Sin resaltados ni apuntes</span>
        <span class="font-mono text-[8.5px] text-[#5A5A5A]">${canEdit ? 'Agrega un apunte privado abajo o resalta texto a la izquierda' : 'No hay apuntes registrados en esta ficha'}</span>
      </div>
    `;
  }
  return highlights.map((h) => {
    const ts = formatHighlightTimestamp(h.createdAt);
    return `
      <div data-cork-hl-id="${escapeHtml(h.id)}" class="p-2 rounded-lg bg-[#202020] border border-obsidian-border space-y-1.5">
        ${h.quote ? `
          <blockquote class="border-l-2 border-obsidian-amber/80 pl-2 text-[10px] font-mono text-[#D4D4D4] leading-snug whitespace-pre-wrap break-words">“${escapeHtml(h.quote)}”</blockquote>
        ` : ''}
        ${h.note ? `
          <p class="text-[10.5px] text-[#D4D4D4] leading-snug whitespace-pre-wrap break-words">${escapeHtml(h.note)}</p>
        ` : ''}
        <div class="flex items-center justify-between gap-2 pt-0.5">
          <span class="font-mono text-[8.5px] text-[#5A5A5A]">${escapeHtml(ts || 'Apunte privado')}</span>
          ${canEdit ? `
            <button type="button" data-cork-remove-hl="${escapeHtml(h.id)}" title="Eliminar apunte" aria-label="Eliminar apunte"
              class="w-5 h-5 rounded text-[#737373] hover:text-rose-400 hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
              <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

export function renderCorkPinPreview({
  pin,
  canEdit = false,
  trafficOrders = [],
  highlightError = '',
}) {
  if (!pin) return '';
  const highlights = Array.isArray(pin.highlights) ? pin.highlights : [];
  let leftViewerHtml = '';
  if (pin.type === 'note') {
    leftViewerHtml = renderNoteViewer(pin, { canEdit });
  } else if (pin.type === 'link') {
    leftViewerHtml = renderLinkViewer(pin, { canEdit });
  } else {
    leftViewerHtml = renderFileViewer(pin, { trafficOrders });
  }

  return `
    <div data-dk-cork-preview-root="${escapeHtml(pin.id)}"
      class="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-obsidian-border">
      <!-- Mitad izquierda: Visor -->
      <div class="p-2.5 flex flex-col min-h-0 overflow-hidden">
        ${leftViewerHtml}
      </div>

      <!-- Mitad derecha: Resaltados y apuntes privados -->
      <div class="p-2.5 flex flex-col min-h-0 overflow-hidden">
        <div class="flex items-center justify-between gap-2 pb-1.5 mb-2 border-b border-obsidian-border/70 shrink-0">
          <span class="font-mono text-[9px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Resaltados y apuntes</span>
          <span data-cork-hl-count="1" class="font-mono text-[9px] text-[#737373]">${highlights.length}</span>
        </div>

        <div data-cork-hl-list="1" data-dk-scroll-id="corkboard-preview-hl:${escapeHtml(pin.id)}"
          class="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 flex flex-col">
          ${renderCorkPinHighlightsList(pin, { canEdit })}
        </div>

        ${canEdit ? `
          <form data-cork-hl-form="1" class="pt-2 mt-2 border-t border-obsidian-border/70 space-y-1.5 shrink-0">
            <div>
              <label for="cork-hl-quote" class="sr-only">Cita o fragmento resaltado</label>
              <input id="cork-hl-quote" name="hl_quote" type="text" maxlength="320"
                placeholder="Cita o referencia opcional (ej. pág. 2, frase clave)..."
                class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2 py-1 text-[10px] font-mono text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none" />
            </div>
            <div>
              <label for="cork-hl-note" class="sr-only">Apunte privado</label>
              <textarea id="cork-hl-note" name="hl_note" rows="2"
                placeholder="Escribe un apunte privado..."
                class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2 py-1 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-snug"></textarea>
            </div>
            <div class="flex items-center justify-between gap-2">
              <span data-cork-hl-error="1" class="font-mono text-[9px] text-rose-400 truncate">${escapeHtml(highlightError)}</span>
              <button type="submit"
                class="px-2.5 py-1 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[10px] text-[#191919] font-semibold transition-colors cursor-pointer shrink-0">Guardar apunte</button>
            </div>
          </form>
        ` : ''}
      </div>
    </div>
  `;
}

export function renderCorkPinPreviewFooter(pin, { canEdit = false, isPersonalScope = false } = {}) {
  const badge = getCorkPinTypeBadge(pin);
  const count = Array.isArray(pin?.highlights) ? pin.highlights.length : 0;
  return `
    <span>VISTA PREVIA · ${escapeHtml(badge.label)}</span>
    <span>${count} ${count === 1 ? 'apunte' : 'apuntes'} · ${isPersonalScope ? 'Privado' : (canEdit ? 'Estudio' : 'Solo lectura')}</span>
  `;
}
