/**
 * Renderizado puro del Estado 2 del Tablero de Corcho (C04):
 * - Vista Previa de Pin (`file`, `note`, `link`) en división 1/2 + 1/2
 * - Cabecera plana Obsidian (`‹ Corcho`, tipo, título editable inline, código OT, cierre `×`)
 * - Visores por tipo (editor de nota, tarjeta de enlace + extracto, archivo local IDB / ref OT / fallback)
 * - Panel derecho de resaltados y apuntes privados con formulario compacto accesible
 */

import {
  appendOtMessage,
  ensureOtData,
  escapeHtml,
  studioTeamList,
  trafficMembers,
} from './store.js';
import {
  addCorkPinHighlight,
  appendCorkInternalMessage,
  canShareCorkHighlight,
  getAssignableOrdersForShare,
  getCorkBlob,
  getCorkBlobObjectUrl,
  getCorkPinById,
  getCorkStorageKey,
  getCorkboardPermissions,
  getFileTypeTag,
  isSafeMediaSrc,
  markCorkPinHighlightShared,
  normalizeSafeWebUrl,
  removeCorkPinHighlight,
  setActiveCorkPinId,
  updateCorkPinMeta,
} from './desktop-corkboard-store.js';

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
          <span data-cork-save-status="1" class="font-mono text-[8.5px] text-[#5A5A5A]">Guardado</span>
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
  const parsedUrl = pin.url ? normalizeSafeWebUrl(pin.url) : null;
  const safeUrl = parsedUrl?.ok ? parsedUrl.url : '';
  const domain = parsedUrl?.ok ? parsedUrl.domain : (pin.url || '');

  return `
    <div class="flex-1 min-h-0 flex flex-col gap-2.5 overflow-y-auto pr-0.5">
      <div class="p-3 rounded-lg bg-[#202020] border border-obsidian-border space-y-2 shrink-0">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[9px] uppercase tracking-wider text-sky-400 font-semibold">${escapeHtml(domain || 'ENLACE WEB')}</span>
          ${safeUrl ? `
            <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer"
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border font-mono text-[9px] text-[#D4D4D4] hover:text-obsidian-amber transition-colors shrink-0">
              <span>Abrir</span>
              <span aria-hidden="true">↗</span>
            </a>
          ` : ''}
        </div>
        <div class="font-mono text-[9.5px] text-[#8C8C8C] break-all select-all bg-[#191919] border border-obsidian-border/70 rounded px-2 py-1.5">${escapeHtml(safeUrl || pin.url || 'Sin URL')}</div>
      </div>

      <div class="flex-1 min-h-0 flex flex-col gap-1.5">
        <div class="flex items-center justify-between gap-2 shrink-0">
          <label for="cork-preview-link-excerpt" class="font-mono text-[9px] uppercase tracking-wider text-[#8C8C8C]">Extracto o cita manual</label>
          ${canEdit ? `
            <div class="inline-flex items-center gap-2">
              <span data-cork-save-status="1" class="font-mono text-[8.5px] text-[#5A5A5A]">Guardado</span>
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
  const normMime = String(mime || '').trim().toLowerCase().split(';')[0].trim();
  const isVerifiedPdfData = normMime === 'application/pdf' || /^data:application\/pdf(?:;[^,]*)?,/i.test(otDataUrl);
  if (blobId) {
    stageHtml = `
      <div data-cork-preview-blob-id="${escapeHtml(blobId)}"
           data-cork-preview-file-tag="${escapeHtml(tag)}"
           data-cork-preview-file-name="${escapeHtml(pin.title || 'Archivo')}"
           data-cork-preview-file-size="${escapeHtml(sizeLabel)}"
           class="w-full h-full flex items-center justify-center">
        <span class="font-mono text-[9.5px] text-[#737373]">Cargando archivo...</span>
      </div>
    `;
  } else if (otDataUrl) {
    if (tag === 'IMG' && isSafeMediaSrc(otDataUrl, 'img')) {
      stageHtml = `<img src="${escapeHtml(otDataUrl)}" alt="${escapeHtml(pin.title || 'Imagen')}" class="max-h-full max-w-full object-contain rounded" />`;
    } else if (tag === 'VID' && isSafeMediaSrc(otDataUrl, 'vid')) {
      stageHtml = `<video src="${escapeHtml(otDataUrl)}" controls class="max-h-full max-w-full rounded"></video>`;
    } else if (tag === 'PDF' && isVerifiedPdfData && isSafeMediaSrc(otDataUrl, 'pdf')) {
      stageHtml = `<iframe src="${escapeHtml(otDataUrl)}" title="${escapeHtml(pin.title || 'PDF')}" class="w-full h-full min-h-[180px] rounded bg-[#141414] border-0"></iframe>`;
    } else if (isSafeMediaSrc(otDataUrl, 'any')) {
      stageHtml = `
        <div class="flex flex-col items-center justify-center gap-2 text-center px-4">
          <div class="w-11 h-11 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold ${tagColorCls}">${escapeHtml(tag)}</div>
          <div class="text-[11px] font-medium text-[#D4D4D4] break-all">${escapeHtml(pin.title || 'Archivo')}</div>
          <a href="${escapeHtml(otDataUrl)}" download="${escapeHtml(pin.title || 'archivo')}"
            class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10px] font-mono text-[#D4D4D4] transition-colors">Descargar archivo</a>
        </div>
      `;
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
        <span class="shrink-0">${blobId ? 'En este equipo' : (shortOt ? `Ref. OT ${escapeHtml(shortOt)}` : 'Referencia')}</span>
      </div>
    </div>
  `;
}

function buildShareTargets({ pin = null, roleCaps = null, userProfile = null, trafficOrders = [] } = {}) {
  const perms = getCorkboardPermissions({ isPersonalScope: true, roleCaps, userProfile });
  const allowedOrders = getAssignableOrdersForShare({ roleCaps, userProfile, trafficOrders });
  const memberSet = new Set();
  if (perms.isOwnerOrAdmin) {
    (studioTeamList || []).forEach((m) => {
      if (m?.name && m.status !== 'Inactivo') memberSet.add(String(m.name));
    });
    (trafficMembers || []).forEach((name) => {
      if (name) memberSet.add(String(name));
    });
  } else {
    allowedOrders.forEach((o) => {
      if (o?.responsible) memberSet.add(String(o.responsible));
      (o?.subtasks || []).forEach((st) => {
        const resp = st?.responsible || o?.responsible;
        if (resp) memberSet.add(String(resp));
      });
    });
  }
  const members = Array.from(memberSet);

  const clientSet = new Set();
  if (pin?.otId) {
    const liveOt = allowedOrders.find((o) => o.id === pin.otId);
    if (liveOt?.client) clientSet.add(String(liveOt.client));
  } else {
    allowedOrders.forEach((o) => {
      if (o?.client) clientSet.add(String(o.client));
    });
  }
  const clients = Array.from(clientSet);

  return { members, clients, allowedOrders };
}

function formatSharedHighlightMessage({ pin, highlight, recipientType, recipientName }) {
  const targetPrefix = recipientType === 'client'
    ? `[Para Cliente: ${recipientName}]`
    : `@${recipientName}`;
  const refLabel = pin?.title ? `[Corcho · ${pin.title}]` : '[Corcho]';
  const parts = [`${targetPrefix} · ${refLabel}`];
  if (highlight?.quote) parts.push(`«${highlight.quote}»`);
  if (highlight?.note) parts.push(highlight.note);
  return parts.join(' — ');
}

export function renderCorkPinHighlightsList(pin, {
  canEdit = false,
  canShare = false,
  activeShareHlId = null,
  shareTargets = null,
} = {}) {
  const highlights = Array.isArray(pin?.highlights) ? pin.highlights : [];
  if (!highlights.length) {
    return `
      <div class="flex-1 flex flex-col items-center justify-center py-6 text-center gap-1">
        <span class="text-[10px] text-[#8C8C8C]">Sin resaltados ni apuntes</span>
        <span class="font-mono text-[8.5px] text-[#5A5A5A]">${canEdit ? 'Agrega un apunte privado abajo o resalta texto a la izquierda' : 'No hay apuntes registrados en esta ficha'}</span>
      </div>
    `;
  }
  const targets = shareTargets || { members: [], clients: [], allowedOrders: [] };

  return highlights.map((h, idx) => {
    const ts = formatHighlightTimestamp(h.createdAt);
    const isShareOpen = canShare && activeShareHlId === h.id;
    const sharedBadge = h.sharedAt
      ? `<span data-cork-hl-shared="1" class="font-mono text-[8px] text-emerald-400/90 truncate" title="Enviado a ${escapeHtml(h.sharedTo || 'equipo')}">· Enviado${h.sharedTo ? ` (${escapeHtml(h.sharedTo)})` : ''}</span>`
      : '';
    const recipientSelectId = `cork-share-recipient-${idx}`;
    const otSelectId = `cork-share-ot-${idx}`;

    return `
      <div data-cork-hl-id="${escapeHtml(h.id)}" class="p-2 rounded-lg bg-[#202020] border border-obsidian-border space-y-1.5">
        ${h.quote ? `
          <blockquote class="border-l-2 border-obsidian-amber/80 pl-2 text-[10px] font-mono text-[#D4D4D4] leading-snug whitespace-pre-wrap break-words">“${escapeHtml(h.quote)}”</blockquote>
        ` : ''}
        ${h.note ? `
          <p class="text-[10.5px] text-[#D4D4D4] leading-snug whitespace-pre-wrap break-words">${escapeHtml(h.note)}</p>
        ` : ''}
        <div class="flex items-center justify-between gap-1.5 pt-0.5 min-w-0">
          <div class="inline-flex items-center gap-1 min-w-0">
            <span class="font-mono text-[8.5px] text-[#5A5A5A] shrink-0">${escapeHtml(ts || 'Apunte privado')}</span>
            ${sharedBadge}
          </div>
          <div class="inline-flex items-center gap-1 shrink-0">
            ${canShare ? `
              <button type="button" data-cork-toggle-share="${escapeHtml(h.id)}"
                class="px-1 py-0.5 rounded text-[8.5px] font-mono cursor-pointer transition-colors ${isShareOpen ? 'bg-obsidian-elevated text-obsidian-amber font-semibold' : 'text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated'}">
                ${h.sharedAt ? 'Reenviar →' : 'Enviar como mensaje →'}
              </button>
            ` : ''}
            ${canEdit ? `
              <button type="button" data-cork-remove-hl="${escapeHtml(h.id)}" title="Eliminar apunte" aria-label="Eliminar apunte"
                class="w-5 h-5 rounded text-[#737373] hover:text-rose-400 hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors">
                <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
        ${isShareOpen ? `
          <form data-cork-share-form="${escapeHtml(h.id)}" class="mt-1.5 p-2 rounded-md bg-[#191919] border border-obsidian-border space-y-1.5">
            <div>
              <label for="${recipientSelectId}" class="block font-mono text-[8px] uppercase tracking-wider text-[#8C8C8C] mb-0.5">Destinatario</label>
              <select id="${recipientSelectId}" name="share_recipient" data-cork-share-recipient="1"
                class="w-full bg-[#222222] border border-obsidian-border rounded px-2 py-1 text-[10px] text-[#D4D4D4] focus:border-[#3f3f3f] focus:outline-none">
                ${targets.members.length ? `
                  <optgroup label="Miembro del equipo">
                    ${targets.members.map((m) => `<option value="member:${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('')}
                  </optgroup>
                ` : ''}
                ${targets.clients.length ? `
                  <optgroup label="Cliente">
                    ${targets.clients.map((c) => `<option value="client:${escapeHtml(c)}">Cliente · ${escapeHtml(c)}</option>`).join('')}
                  </optgroup>
                ` : ''}
              </select>
            </div>
            ${!pin.otId && targets.allowedOrders.length ? `
              <div>
                <label for="${otSelectId}" class="block font-mono text-[8px] uppercase tracking-wider text-[#8C8C8C] mb-0.5">Destino (opcional)</label>
                <select id="${otSelectId}" name="share_ot_id" data-cork-share-ot="1"
                  class="w-full bg-[#222222] border border-obsidian-border rounded px-2 py-1 text-[10px] font-mono text-[#D4D4D4] focus:border-[#3f3f3f] focus:outline-none">
                  <option value="">Canal interno del Estudio (Corcho)</option>
                  ${targets.allowedOrders.slice(0, 20).map((ot) => {
                    const code = String(ot.id || '').replace(/^OT-/i, '');
                    return `<option value="${escapeHtml(ot.id)}">${escapeHtml(code)} · ${escapeHtml(String(ot.title || '').slice(0, 34))}</option>`;
                  }).join('')}
                </select>
              </div>
            ` : ''}
            <div class="flex items-center justify-end gap-1.5 pt-0.5">
              <button type="button" data-cork-cancel-share="1"
                class="px-2 py-0.5 rounded bg-obsidian-elevated hover:bg-[#323232] text-[9.5px] text-[#8C8C8C] hover:text-[#D4D4D4] cursor-pointer transition-colors">Cancelar</button>
              <button type="submit"
                class="px-2.5 py-0.5 rounded bg-obsidian-amber hover:bg-amber-400 text-[9.5px] text-[#191919] font-semibold cursor-pointer transition-colors">Enviar</button>
            </div>
          </form>
        ` : ''}
      </div>
    `;
  }).join('');
}

export function renderCorkPinPreview({
  pin,
  canEdit = false,
  roleCaps = null,
  userProfile = null,
  trafficOrders = [],
  highlightError = '',
}) {
  if (!pin) return '';
  const highlights = Array.isArray(pin.highlights) ? pin.highlights : [];
  const canShare = canShareCorkHighlight({ pin, roleCaps, userProfile, trafficOrders });
  const shareTargets = canShare ? buildShareTargets({ pin, roleCaps, userProfile, trafficOrders }) : null;
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
          <div class="inline-flex items-center gap-2 shrink-0">
            <span data-cork-share-status="1" role="status" class="hidden font-mono text-[8.5px] text-emerald-400"></span>
            <span data-cork-hl-count="1" class="font-mono text-[9px] text-[#737373]">${highlights.length}</span>
          </div>
        </div>

        <div data-cork-hl-list="1" data-dk-scroll-id="corkboard-preview-hl:${escapeHtml(pin.id)}"
          class="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-0.5 flex flex-col">
          ${renderCorkPinHighlightsList(pin, { canEdit, canShare, shareTargets })}
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

function hydrateCorkPreviewMedia(root) {
  if (!root) return;
  const slot = root.querySelector('[data-cork-preview-blob-id]');
  if (!slot) return;
  const blobId = slot.dataset.corkPreviewBlobId;
  const fallbackTag = slot.dataset.corkPreviewFileTag || 'ARCHIVO';
  const fileName = slot.dataset.corkPreviewFileName || 'Archivo';
  const fileSize = slot.dataset.corkPreviewFileSize || '';
  if (!blobId) return;
  Promise.all([
    getCorkBlob(blobId).catch(() => null),
    getCorkBlobObjectUrl(blobId),
  ]).then(([rec, objUrl]) => {
    if (!slot.isConnected) return;
    if (!objUrl) {
      slot.innerHTML = `<span class="font-mono text-[9.5px] text-[#737373]">Recurso no disponible en este equipo.</span>`;
      return;
    }
    const verifiedMime = String(rec?.blob?.type || rec?.mime || '').trim().toLowerCase().split(';')[0].trim();
    const verifiedTag = verifiedMime ? getFileTypeTag(verifiedMime, fileName) : fallbackTag;
    if (verifiedTag === 'IMG' && isSafeMediaSrc(objUrl, 'img')) {
      slot.innerHTML = `<img src="${escapeHtml(objUrl)}" alt="${escapeHtml(fileName)}" class="max-h-full max-w-full object-contain rounded" />`;
    } else if (verifiedTag === 'VID' && isSafeMediaSrc(objUrl, 'vid')) {
      slot.innerHTML = `<video src="${escapeHtml(objUrl)}" controls class="max-h-full max-w-full rounded"></video>`;
    } else if (verifiedTag === 'PDF' && verifiedMime === 'application/pdf' && isSafeMediaSrc(objUrl, 'pdf')) {
      slot.innerHTML = `
        <div class="w-full h-full flex flex-col gap-1.5 min-h-[180px]">
          <iframe src="${escapeHtml(objUrl)}" title="${escapeHtml(fileName)}" class="w-full flex-1 min-h-[160px] rounded bg-[#141414] border-0"></iframe>
          <div class="flex justify-end shrink-0">
            <a href="${escapeHtml(objUrl)}" target="_blank" rel="noopener noreferrer"
              class="font-mono text-[9px] text-[#8C8C8C] hover:text-obsidian-amber transition-colors">Abrir PDF ↗</a>
          </div>
        </div>
      `;
    } else {
      slot.innerHTML = `
        <div class="flex flex-col items-center justify-center gap-2 text-center px-4">
          <div class="w-11 h-11 rounded-lg bg-[#202020] border border-obsidian-border flex items-center justify-center font-mono text-[11px] font-semibold text-[#8C8C8C]">${escapeHtml(verifiedTag)}</div>
          <div class="text-[11px] font-medium text-[#D4D4D4] break-all">${escapeHtml(fileName)}</div>
          ${fileSize ? `<div class="font-mono text-[9px] text-[#737373]">${escapeHtml(fileSize)}</div>` : ''}
          ${isSafeMediaSrc(objUrl, 'any') ? `<a href="${escapeHtml(objUrl)}" download="${escapeHtml(fileName)}"
            class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10px] font-mono text-[#D4D4D4] transition-colors">Descargar archivo</a>` : ''}
        </div>
      `;
    }
  });
}

export function bindCorkPreviewEvents(root, ctx = {}) {
  if (!root) return;
  const previewRoot = root.querySelector('[data-dk-cork-preview-root]');
  if (!previewRoot) return;
  const pinId = previewRoot.dataset.dkCorkPreviewRoot;
  if (!pinId) return;

  const {
    isPersonalScope = false,
    roleCaps = null,
    userProfile = null,
    studioSettings = null,
    trafficOrders = [],
    rerenderLocal,
    onHighlightShared,
  } = ctx;
  const perms = getCorkboardPermissions({ isPersonalScope, roleCaps, userProfile });
  const storeOpts = { isPersonalScope, studioSettings, userProfile };
  const storageKey = getCorkStorageKey(storeOpts);

  const loadCurrentPin = () => getCorkPinById(storageKey, pinId);

  let activeShareHlId = null;
  let shareStatusTimer = null;

  const showShareStatus = (msg) => {
    const statusEl = root.querySelector('[data-cork-share-status="1"]');
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove('hidden');
    if (shareStatusTimer) clearTimeout(shareStatusTimer);
    shareStatusTimer = setTimeout(() => {
      if (statusEl.isConnected) statusEl.classList.add('hidden');
      shareStatusTimer = null;
    }, 3000);
  };

  // Cerrar Estado 2 (botón ‹ Corcho y botón × uniforme)
  root.querySelectorAll('[data-cork-close-preview="1"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActiveCorkPinId(null);
      rerenderLocal?.();
    });
  });

  // Hidratar blob local en IndexedDB si aplica
  hydrateCorkPreviewMedia(root);

  // Actualización in-place de la lista de resaltados (preserva visor izquierdo y foco)
  const refreshHighlightsUi = (updatedPin, { scrollToBottom = false } = {}) => {
    const pinObj = updatedPin || loadCurrentPin();
    if (!pinObj) return;
    const canShare = canShareCorkHighlight({ pin: pinObj, roleCaps, userProfile, trafficOrders });
    const shareTargets = canShare ? buildShareTargets({ pin: pinObj, roleCaps, userProfile, trafficOrders }) : null;
    const listSlot = root.querySelector('[data-cork-hl-list="1"]');
    const countSlot = root.querySelector('[data-cork-hl-count="1"]');
    const footerSlot = root.querySelector('[data-dk-cork-footer="1"]');
    const prevTop = listSlot ? listSlot.scrollTop : 0;
    if (listSlot) {
      listSlot.innerHTML = renderCorkPinHighlightsList(pinObj, {
        canEdit: perms.canEdit,
        canShare,
        activeShareHlId,
        shareTargets,
      });
      listSlot.scrollTop = scrollToBottom ? listSlot.scrollHeight : prevTop;
    }
    if (countSlot) {
      countSlot.textContent = String(Array.isArray(pinObj?.highlights) ? pinObj.highlights.length : 0);
    }
    if (footerSlot) {
      footerSlot.innerHTML = renderCorkPinPreviewFooter(pinObj, { canEdit: perms.canEdit, isPersonalScope });
    }
    bindHighlightItemActions();
  };

  const bindHighlightItemActions = () => {
    // Desplegar/cerrar selector inline "Enviar como mensaje →"
    root.querySelectorAll('[data-cork-toggle-share]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const hlId = btn.dataset.corkToggleShare;
        if (!hlId) return;
        activeShareHlId = activeShareHlId === hlId ? null : hlId;
        refreshHighlightsUi();
        if (activeShareHlId) {
          root.querySelector('[data-cork-share-recipient="1"]')?.focus();
        }
      });
    });

    // Cancelar despacho inline
    root.querySelectorAll('[data-cork-cancel-share="1"]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        activeShareHlId = null;
        refreshHighlightsUi();
      });
    });

    // Confirmar envío de apunte/resaltado como mensaje (HU-06)
    root.querySelectorAll('[data-cork-share-form]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const hlId = form.dataset.corkShareForm;
        const currentPin = loadCurrentPin();
        if (!currentPin || !hlId) return;
        if (!canShareCorkHighlight({ pin: currentPin, roleCaps, userProfile, trafficOrders })) return;
        const hl = (currentPin.highlights || []).find((item) => item.id === hlId);
        if (!hl) return;

        const recipientVal = String(form.querySelector('[data-cork-share-recipient="1"]')?.value || '');
        const [rawType, ...restName] = recipientVal.split(':');
        const recipientType = rawType === 'client' ? 'client' : 'member';
        const recipientName = restName.join(':').trim() || 'Equipo';
        const recipientDisplay = recipientType === 'client' ? `Cliente · ${recipientName}` : recipientName;
        const optionalOtId = String(form.querySelector('[data-cork-share-ot="1"]')?.value || '').trim() || null;
        const targetOtId = currentPin.otId || optionalOtId || null;
        const allowedOrders = getAssignableOrdersForShare({ roleCaps, userProfile, trafficOrders });
        const actorName = String(userProfile?.shortName || 'Equipo');
        const msgText = formatSharedHighlightMessage({
          pin: currentPin,
          highlight: hl,
          recipientType,
          recipientName,
        });
        const nowIso = new Date().toISOString();

        if (targetOtId) {
          const targetOt = allowedOrders.find((o) => o.id === targetOtId);
          if (!targetOt) return;
          ensureOtData(targetOt);
          appendOtMessage(targetOt, {
            text: msgText,
            channel: recipientType === 'client' ? 'Cliente' : 'App',
            actor: actorName,
            priority: null,
            pinned: false,
          });
          const lastMsg = targetOt.messages?.[targetOt.messages.length - 1];
          if (lastMsg) lastMsg.createdAt = nowIso;
        } else {
          appendCorkInternalMessage({
            text: msgText,
            actor: actorName,
            recipientType,
            recipientLabel: recipientDisplay,
            channel: 'Corcho',
            pinId: currentPin.id,
            pinTitle: currentPin.title || 'Ficha',
            createdAt: nowIso,
          }, { studioSettings });
        }

        let updatedPin = currentPin;
        if (perms.canEdit) {
          const marked = markCorkPinHighlightShared(storageKey, pinId, hlId, {
            sharedTo: recipientDisplay,
            sharedAt: nowIso,
            sharedOtId: targetOtId,
          });
          updatedPin = marked.pin || currentPin;
        }
        activeShareHlId = null;
        refreshHighlightsUi(updatedPin);
        showShareStatus(`Enviado a ${recipientDisplay}`);
        onHighlightShared?.({
          otId: targetOtId,
          recipientType,
          recipientLabel: recipientDisplay,
        });
      });
    });

    if (perms.canEdit) {
      root.querySelectorAll('[data-cork-remove-hl]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const hlId = btn.dataset.corkRemoveHl;
          if (!hlId) return;
          if (activeShareHlId === hlId) activeShareHlId = null;
          const res = removeCorkPinHighlight(storageKey, pinId, hlId);
          if (res.removed && res.pin) {
            refreshHighlightsUi(res.pin);
          }
        });
      });
    }
  };
  bindHighlightItemActions();

  if (!perms.canEdit) return;

  // Edición inline del título (sin perder foco)
  const titleInput = root.querySelector('[data-cork-preview-title="1"]');
  titleInput?.addEventListener('input', () => {
    const nextTitle = titleInput.value.trim();
    if (!nextTitle) return;
    updateCorkPinMeta(storageKey, pinId, { title: nextTitle });
  });
  titleInput?.addEventListener('blur', () => {
    const nextTitle = titleInput.value.trim() || 'Sin título';
    titleInput.value = nextTitle;
    updateCorkPinMeta(storageKey, pinId, { title: nextTitle });
  });

  // Guardado local continuo de contenido en nota o extracto de enlace (sin re-render ni pérdida de foco)
  const saveStatusEl = root.querySelector('[data-cork-save-status="1"]');
  const bindAutoSaveTextarea = (el) => {
    if (!el) return;
    let saveTimer = null;
    const persist = () => {
      updateCorkPinMeta(storageKey, pinId, { content: el.value });
      if (saveStatusEl) saveStatusEl.textContent = 'Guardado';
    };
    el.addEventListener('input', () => {
      if (saveStatusEl) saveStatusEl.textContent = 'Guardando...';
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(persist, 160);
    });
    el.addEventListener('blur', () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      persist();
    });
  };
  const noteEditor = root.querySelector('[data-cork-note-editor="1"]');
  const linkExcerpt = root.querySelector('[data-cork-link-excerpt="1"]');
  bindAutoSaveTextarea(noteEditor);
  bindAutoSaveTextarea(linkExcerpt);

  // Capturar selección de texto en Nota como resaltado
  const selectionHint = root.querySelector('[data-cork-selection-hint="1"]');
  root.querySelector('[data-cork-capture-selection="1"]')?.addEventListener('click', () => {
    if (!noteEditor) return;
    const start = noteEditor.selectionStart ?? 0;
    const end = noteEditor.selectionEnd ?? 0;
    const selected = noteEditor.value.slice(start, end).trim();
    if (!selected) {
      if (selectionHint) {
        selectionHint.textContent = 'Selecciona un fragmento en la nota para capturarlo como resaltado.';
        selectionHint.classList.remove('hidden');
      }
      return;
    }
    if (selectionHint) selectionHint.classList.add('hidden');
    const quoteInput = root.querySelector('#cork-hl-quote');
    const noteInput = root.querySelector('#cork-hl-note');
    if (quoteInput) quoteInput.value = selected.slice(0, 320);
    noteInput?.focus();
  });

  // Capturar extracto/selección de Enlace como resaltado
  root.querySelector('[data-cork-capture-link-excerpt="1"]')?.addEventListener('click', () => {
    if (!linkExcerpt) return;
    const start = linkExcerpt.selectionStart ?? 0;
    const end = linkExcerpt.selectionEnd ?? 0;
    const selected = linkExcerpt.value.slice(start, end).trim() || linkExcerpt.value.trim();
    if (!selected) return;
    const quoteInput = root.querySelector('#cork-hl-quote');
    const noteInput = root.querySelector('#cork-hl-note');
    if (quoteInput) quoteInput.value = selected.slice(0, 320);
    noteInput?.focus();
  });

  // Formulario de nuevo resaltado / apunte privado
  root.querySelector('[data-cork-hl-form="1"]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const quoteInput = root.querySelector('#cork-hl-quote');
    const noteInput = root.querySelector('#cork-hl-note');
    const errorSlot = root.querySelector('[data-cork-hl-error="1"]');
    const quote = String(quoteInput?.value || '').trim();
    const note = String(noteInput?.value || '').trim();
    if (!quote && !note) {
      if (errorSlot) errorSlot.textContent = 'Escribe una cita o un apunte.';
      noteInput?.focus();
      return;
    }
    const res = addCorkPinHighlight(storageKey, pinId, { quote, note });
    if (res.added && res.pin) {
      if (quoteInput) quoteInput.value = '';
      if (noteInput) noteInput.value = '';
      if (errorSlot) errorSlot.textContent = '';
      refreshHighlightsUi(res.pin, { scrollToBottom: true });
      noteInput?.focus();
    }
  });
}
