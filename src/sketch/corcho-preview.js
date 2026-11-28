/**
 * Renderizado puro de la Vista Previa del Módulo Corcho (Paso 2):
 * - Acción 2: Consultar / Anotar en privado (panel abierto en archivos/enlaces, colapsable en notas breves)
 * - Acciones 5, 6 y 7 en cabecera: Archivar/Restaurar, Exportar, Eliminar
 * - Visor por tipo: note (editor autoguardado), link (URL segura + Abrir ↗), file (IMG/VID inline, PDF/otros tarjeta + Abrir/Descargar, 0 iframe)
 */

import { escapeHtml } from './store.js';
import { getCorchoFileTag, normalizeSafeWebUrl } from './corcho-store.js';

function formatNoteTime(iso) {
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

function getPreviewBadge(item) {
  if (item.type === 'link') return { label: 'ENLACE', icon: 'globe', cls: 'text-sky-400' };
  if (item.type === 'file') {
    const tag = getCorchoFileTag(item.fileMeta?.mime, item.fileMeta?.name || item.title);
    const cls = tag === 'PDF'
      ? 'text-rose-400'
      : (tag === 'VID' ? 'text-sky-400' : (tag === 'IMG' ? 'text-obsidian-amber' : 'text-[#8C8C8C]'));
    return { label: tag, icon: 'file', cls };
  }
  return { label: 'NOTA', icon: 'sticky-note', cls: 'text-obsidian-amber' };
}

function renderMainStage(item) {
  if (item.type === 'note') {
    return `
      <div class="flex-1 min-h-0 flex flex-col gap-2">
        <div class="flex items-center justify-between gap-2 shrink-0">
          <label for="corcho-note-editor" class="font-mono text-[9.5px] uppercase tracking-wider text-[#8C8C8C]">Nota</label>
          <span id="corcho-save-indicator" class="font-mono text-[9px] text-[#6d6d6d]">Guardado</span>
        </div>
        <textarea id="corcho-note-editor" name="corcho_note_editor" data-corcho-note-editor="${escapeHtml(item.id)}"
          placeholder="Escribe tus apuntes, datos sueltos o ideas aquí..."
          class="flex-1 min-h-[220px] w-full bg-[#202020] border border-obsidian-border rounded-xl p-3 text-[12px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-relaxed">${escapeHtml(item.content || '')}</textarea>
      </div>
    `;
  }

  if (item.type === 'link') {
    const parsed = item.url ? normalizeSafeWebUrl(item.url) : null;
    const safeUrl = parsed?.ok ? parsed.url : '';
    const domain = parsed?.ok ? parsed.domain : (item.title || 'Enlace');

    return `
      <div class="flex-1 min-h-0 flex flex-col gap-3">
        <div class="p-3.5 rounded-xl bg-[#202020] border border-obsidian-border space-y-2.5 shrink-0">
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-sky-400 font-semibold truncate">
              <span data-icon="globe" data-icon-size="w-3.5 h-3.5"></span>
              <span>${escapeHtml(domain)}</span>
            </span>
            ${safeUrl ? `
              <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer"
                class="px-2.5 py-1 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border font-mono text-[10px] text-[#D4D4D4] hover:text-obsidian-amber inline-flex items-center gap-1 transition-colors shrink-0">
                <span>Abrir</span>
                <span aria-hidden="true">↗</span>
              </a>
            ` : ''}
          </div>
          <div class="font-mono text-[10px] text-[#8C8C8C] break-all select-all bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-2">${escapeHtml(safeUrl || item.url || 'Enlace no válido')}</div>
        </div>

        <div class="flex-1 min-h-0 flex flex-col gap-1.5">
          <div class="flex items-center justify-between gap-2 shrink-0">
            <label for="corcho-link-excerpt" class="font-mono text-[9.5px] uppercase tracking-wider text-[#8C8C8C]">Extracto o contexto</label>
            <span id="corcho-save-indicator" class="font-mono text-[9px] text-[#6d6d6d]">Guardado</span>
          </div>
          <textarea id="corcho-link-excerpt" name="corcho_link_excerpt" data-corcho-note-editor="${escapeHtml(item.id)}"
            placeholder="Anota por qué guardaste este enlace o pega un extracto relevante..."
            class="flex-1 min-h-[140px] w-full bg-[#202020] border border-obsidian-border rounded-xl p-3 text-[11.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-relaxed">${escapeHtml(item.content || '')}</textarea>
        </div>
      </div>
    `;
  }

  // item.type === 'file'
  const tag = getCorchoFileTag(item.fileMeta?.mime, item.fileMeta?.name || item.title);
  const blobId = item.fileMeta?.blobId || '';
  return `
    <div class="flex-1 min-h-0 flex flex-col gap-2">
      <div data-corcho-preview-blob="${escapeHtml(blobId)}"
           data-corcho-preview-tag="${escapeHtml(tag)}"
           data-corcho-preview-item-id="${escapeHtml(item.id)}"
           data-corcho-preview-name="${escapeHtml(item.fileMeta?.name || item.title)}"
           data-corcho-preview-size="${escapeHtml(item.fileMeta?.sizeLabel || '')}"
           class="flex-1 min-h-[220px] rounded-xl bg-[#141414] border border-obsidian-border flex items-center justify-center overflow-hidden p-3">
        <span class="font-mono text-[10px] text-[#737373]">Cargando archivo...</span>
      </div>
    </div>
  `;
}

function renderPrivateNotesPanel(item, { notesExpanded }) {
  const notes = Array.isArray(item.privateNotes) ? item.privateNotes : [];

  if (!notesExpanded) {
    return `
      <div class="shrink-0 pt-2 border-t border-obsidian-border flex items-center justify-between gap-2">
        <span class="font-mono text-[9.5px] text-[#8C8C8C]">Apuntes privados (${notes.length})</span>
        <button type="button" data-corcho-toggle-notes="1"
          class="px-2.5 py-1 rounded-lg bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] transition-colors cursor-pointer">
          Mostrar apuntes privados
        </button>
      </div>
    `;
  }

  return `
    <aside class="w-full lg:w-[340px] shrink-0 flex flex-col min-h-0 bg-[#202020] border border-obsidian-border rounded-xl p-3 gap-2.5">
      <div class="flex items-center justify-between gap-2 pb-2 border-b border-obsidian-border shrink-0">
        <span class="font-mono text-[9.5px] uppercase tracking-wider text-[#D4D4D4] font-semibold">Apuntes privados (${notes.length})</span>
        ${item.type === 'note' ? `
          <button type="button" data-corcho-toggle-notes="1" data-tip="Ocultar apuntes" aria-label="Ocultar apuntes privados"
            class="px-1.5 py-0.5 rounded text-[9.5px] font-mono text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated cursor-pointer transition-colors">Ocultar</button>
        ` : ''}
      </div>

      <form id="corcho-private-note-form" data-corcho-note-target="${escapeHtml(item.id)}" class="flex flex-col gap-1.5 shrink-0" autocomplete="off">
        <label for="corcho-private-note-input" class="sr-only">Nuevo apunte privado</label>
        <textarea id="corcho-private-note-input" name="corcho_private_note_input" rows="2"
          placeholder="Anota una observación privada sobre esta ficha..."
          class="w-full bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1.5 text-[11px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none resize-none leading-snug"></textarea>
        <div class="flex justify-end">
          <button type="submit"
            class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10.5px] text-[#D4D4D4] transition-colors cursor-pointer">
            Guardar apunte
          </button>
        </div>
      </form>

      <div class="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pr-0.5">
        ${notes.length
          ? notes.map((n) => `
              <div class="p-2 rounded-lg bg-[#191919] border border-obsidian-border/80 flex flex-col gap-1">
                <p class="text-[11px] text-[#D4D4D4] whitespace-pre-wrap leading-snug break-words">${escapeHtml(n.text)}</p>
                <div class="flex items-center justify-between gap-2">
                  <span class="font-mono text-[8.5px] text-[#6d6d6d]">${escapeHtml(formatNoteTime(n.at))}</span>
                  <button type="button" data-corcho-del-pnote="${escapeHtml(n.id)}" data-corcho-pnote-item="${escapeHtml(item.id)}"
                    data-tip="Eliminar apunte" aria-label="Eliminar apunte"
                    class="w-5 h-5 rounded text-[#737373] hover:text-rose-400 hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
                    <span data-icon="trash-2" data-icon-size="w-3 h-3"></span>
                  </button>
                </div>
              </div>
            `).join('')
          : `<div class="py-6 text-center font-mono text-[10px] text-[#5a6169]">Sin apuntes privados aún</div>`
        }
      </div>
    </aside>
  `;
}

export function renderCorchoActionDrawerHtml(item, {
  mode = 'share',
  sharePurpose = 'inform',
  selectedMoveOtId = '',
  teamMembers = [],
  activeOrders = [],
} = {}) {
  if (!item) return '';

  if (mode === 'share') {
    const isFile = item.type === 'file';
    return `
      <section aria-label="Compartir ficha" class="p-3 rounded-xl bg-[#202020] border border-obsidian-border flex flex-col gap-2.5 shrink-0">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-obsidian-border">
          <div class="flex items-center gap-2 min-w-0">
            <span data-icon="share-2" data-icon-size="w-3.5 h-3.5" data-icon-class="text-obsidian-amber"></span>
            <span class="font-mono text-[10px] uppercase tracking-wider text-[#D4D4D4] font-semibold truncate">Compartir: ${escapeHtml(item.title)}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="inline-flex items-center gap-1 text-[10px] font-mono">
              <button type="button" data-corcho-share-purpose="inform"
                class="px-2 py-0.5 rounded-md transition-colors cursor-pointer ${sharePurpose === 'inform' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">
                Para dar a conocer
              </button>
              <button type="button" data-corcho-share-purpose="review"
                class="px-2 py-0.5 rounded-md transition-colors cursor-pointer ${sharePurpose === 'review' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">
                Para revisar
              </button>
            </div>
            <button type="button" data-corcho-close-drawer="1" data-tip="Cerrar panel (Esc)" aria-label="Cerrar panel de compartir"
              class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
              <span data-icon="x" data-icon-size="w-3 h-3"></span>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="font-mono text-[9.5px] text-[#8C8C8C] mr-1">Mensaje (1 clic):</span>
            ${teamMembers.map((m) => `
              <button type="button" data-corcho-share-copy-member="${escapeHtml(m.name)}"
                class="px-2 py-1 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] inline-flex items-center gap-1 transition-colors cursor-pointer">
                <span data-icon="send" data-icon-size="w-3 h-3" data-icon-class="text-obsidian-amber"></span>
                <span>${escapeHtml(m.name)}</span>
              </button>
            `).join('')}
          </div>

          <form id="corcho-share-email-form" data-corcho-share-item="${escapeHtml(item.id)}" class="flex flex-wrap items-center gap-2" autocomplete="off">
            <label for="corcho-share-email-input" class="font-mono text-[9.5px] text-[#8C8C8C] shrink-0">Correo:</label>
            <input id="corcho-share-email-input" name="corcho_share_email" type="email"
              placeholder="persona@estudio.com (o elige integrante)"
              class="flex-1 min-w-[200px] bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1 text-[11px] text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none" />
            <button type="submit"
              class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] text-[10.5px] text-[#D4D4D4] inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0">
              <span data-icon="send" data-icon-size="w-3 h-3"></span>
              <span>Abrir correo</span>
            </button>
          </form>

          ${isFile ? `
            <p class="font-mono text-[9.5px] text-obsidian-amber/90">
              Archivo local: expórtalo con Descargar para adjuntarlo manualmente al correo o mensaje.
            </p>
          ` : ''}
        </div>
      </section>
    `;
  }

  // mode === 'move'
  const effectiveOtId = selectedMoveOtId || activeOrders[0]?.id || '';
  return `
    <section aria-label="Mover ficha a OT o Tarea" class="p-3 rounded-xl bg-[#202020] border border-obsidian-border flex flex-col gap-2.5 shrink-0">
      <div class="flex items-center justify-between gap-2 pb-2 border-b border-obsidian-border">
        <div class="flex items-center gap-2 min-w-0">
          <span data-icon="folder-input" data-icon-size="w-3.5 h-3.5" data-icon-class="text-obsidian-amber"></span>
          <span class="font-mono text-[10px] uppercase tracking-wider text-[#D4D4D4] font-semibold truncate">Mover: ${escapeHtml(item.title)}</span>
        </div>
        <button type="button" data-corcho-close-drawer="1" data-tip="Cerrar panel (Esc)" aria-label="Cerrar panel de mover"
          class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer shrink-0">
          <span data-icon="x" data-icon-size="w-3 h-3"></span>
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <label for="corcho-move-ot-select" class="font-mono text-[9.5px] text-[#8C8C8C] shrink-0">OT destino:</label>
        <select id="corcho-move-ot-select" name="corcho_move_ot_select"
          class="flex-1 min-w-[200px] bg-[#191919] border border-obsidian-border rounded-lg px-2.5 py-1 text-[11px] text-[#D4D4D4] focus:border-[#3f3f3f] focus:outline-none cursor-pointer">
          ${activeOrders.length
            ? activeOrders.map((ot) => `
                <option value="${escapeHtml(ot.id)}" ${ot.id === effectiveOtId ? 'selected' : ''}>
                  ${escapeHtml(ot.id)} · ${escapeHtml(ot.client || '')} — ${escapeHtml(ot.title || '')}
                </option>
              `).join('')
            : '<option value="">Sin OTs activas</option>'
          }
        </select>
        <button type="button" data-corcho-move-to-ot="${escapeHtml(item.id)}" ${!activeOrders.length ? 'disabled' : ''}
          class="px-2.5 py-1 rounded-lg bg-obsidian-amber hover:bg-amber-400 disabled:opacity-40 text-[#191919] text-[10.5px] font-semibold transition-colors cursor-pointer shrink-0">
          A OT
        </button>
        <button type="button" data-corcho-move-to-task="${escapeHtml(item.id)}" ${!activeOrders.length ? 'disabled' : ''}
          class="px-2.5 py-1 rounded-lg bg-obsidian-elevated hover:bg-[#323232] disabled:opacity-40 text-[#D4D4D4] text-[10.5px] transition-colors cursor-pointer shrink-0">
          A Tarea
        </button>
        <button type="button" data-corcho-move-to-new-ot="${escapeHtml(item.id)}"
          class="px-2.5 py-1 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] text-[10.5px] inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0">
          <span data-icon="plus" data-icon-size="w-3 h-3"></span>
          <span>Nueva OT</span>
        </button>
      </div>
    </section>
  `;
}

export function renderCorchoPreviewHtml(item, { notesExpanded = true, feedbackMsg = '', feedbackKind = 'info', drawerHtml = '' } = {}) {
  const badge = getPreviewBadge(item);
  const isArchived = item.status === 'archived';
  const splitLayout = notesExpanded;

  return `
    <div class="h-full flex flex-col min-h-0 px-4 py-3 gap-3">
      <!-- Cabecera de Vista Previa -->
      <div class="flex items-center justify-between gap-2 pb-2.5 border-b border-obsidian-border shrink-0">
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <button type="button" data-corcho-back="1" data-tip="Volver al Corcho (Esc)" aria-label="Volver al Corcho"
            class="px-2 py-1 rounded-lg bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border font-mono text-[10px] text-[#D4D4D4] inline-flex items-center gap-1 transition-colors cursor-pointer shrink-0">
            <span data-icon="chevron-left" data-icon-size="w-3 h-3"></span>
            <span>Corcho</span>
          </button>
          <span class="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-semibold ${badge.cls} shrink-0">
            <span data-icon="${badge.icon}" data-icon-size="w-3 h-3"></span>
            <span>${escapeHtml(badge.label)}</span>
          </span>
          <label for="corcho-preview-title" class="sr-only">Título de la ficha</label>
          <input id="corcho-preview-title" name="corcho_preview_title" type="text" maxlength="140"
            data-corcho-title-editor="${escapeHtml(item.id)}" value="${escapeHtml(item.title)}"
            class="flex-1 min-w-[120px] bg-transparent hover:bg-[#202020] focus:bg-[#222222] border border-transparent focus:border-[#3f3f3f] rounded-lg px-2 py-1 text-[12.5px] font-medium text-[#D4D4D4] focus:outline-none transition-colors truncate" />
        </div>

        <div class="flex items-center gap-1 shrink-0">
          <button type="button" data-corcho-open-share="${escapeHtml(item.id)}" data-tip="Compartir" aria-label="Compartir ficha"
            class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="share-2" data-icon-size="w-3.5 h-3.5"></span>
          </button>
          <button type="button" data-corcho-open-move="${escapeHtml(item.id)}" data-tip="Mover a OT o Tarea" aria-label="Mover ficha a OT o Tarea"
            class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-obsidian-amber hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="folder-input" data-icon-size="w-3.5 h-3.5"></span>
          </button>
          ${isArchived
            ? `<button type="button" data-corcho-restore="${escapeHtml(item.id)}" data-tip="Restaurar a Activos" aria-label="Restaurar ficha"
                 class="px-2 py-1 rounded-lg bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-emerald-400 inline-flex items-center gap-1 transition-colors cursor-pointer">
                 <span data-icon="rotate-ccw" data-icon-size="w-3 h-3"></span>
                 <span>Restaurar</span>
               </button>`
            : `<button type="button" data-corcho-archive="${escapeHtml(item.id)}" data-tip="Archivar en Historial" aria-label="Archivar ficha"
                 class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
                 <span data-icon="archive" data-icon-size="w-3.5 h-3.5"></span>
               </button>`
          }
          <button type="button" data-corcho-export="${escapeHtml(item.id)}" data-tip="Exportar" aria-label="Exportar ficha"
            class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="download" data-icon-size="w-3.5 h-3.5"></span>
          </button>
          <button type="button" data-corcho-delete="${escapeHtml(item.id)}" data-tip="Eliminar definitivamente" aria-label="Eliminar ficha"
            class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="trash-2" data-icon-size="w-3.5 h-3.5"></span>
          </button>
          <button type="button" data-corcho-close="1" data-tip="Cerrar Corcho" aria-label="Cerrar Corcho"
            class="w-7 h-7 rounded-md text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="x" data-icon-size="w-3.5 h-3.5"></span>
          </button>
        </div>
      </div>

      ${feedbackMsg ? `
        <div role="status" class="px-3 py-1.5 rounded-lg border text-[10.5px] font-mono shrink-0 ${feedbackKind === 'error' ? 'bg-rose-500/10 border-rose-500/40 text-rose-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'}">
          ${escapeHtml(feedbackMsg)}
        </div>
      ` : ''}

      ${drawerHtml}

      <!-- Cuerpo: Visor principal + Apuntes privados -->
      <div class="flex-1 min-h-0 flex ${splitLayout ? 'flex-col lg:flex-row' : 'flex-col'} gap-3 overflow-hidden">
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          ${renderMainStage(item)}
        </div>
        ${renderPrivateNotesPanel(item, { notesExpanded })}
      </div>
    </div>
  `;
}
