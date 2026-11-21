/**
 * Right Inspector panel (#right-body) with 3 unified tabs:
 *   Detalle | Actividad | Mensajes
 * Supports OT inspection, Task inspection (with Stripboard capacity),
 * Archived read-only mode, and preserves #insp-cal-slot when in calendar views.
 */

import {
  addPieceVersion,
  appendOtMessage,
  deletePieceVersion,
  ensureOtData,
  escapeHtml,
  formatShortDate,
  getActivePieceVersion,
  getClientColor,
  getDepartmentColor,
  getStageColor,
  getStatusColor,
  notifySketchChange,
  recordOtActivity,
  rescheduleDeliveryDate,
  sketchState,
  studioSettings,
  trafficOrders,
} from './store.js';
import {
  ensureStripboardDaySeeded,
  getDayReservedHours,
  moveTaskToScheduledDate,
} from './stripboard.js';

function getInspectorTargetMount(preserveCalendar) {
  const rightBody = document.getElementById('right-body');
  if (!rightBody) return null;
  if (preserveCalendar) {
    const existingSlot = rightBody.querySelector('#insp-content-slot');
    if (existingSlot) return existingSlot;
  }
  return rightBody;
}

const ALERT_LEVELS = {
  urgent: {
    rank: 3,
    label: 'Urgente',
    dot: 'bg-rose-500',
    ring: 'ring-rose-500/70',
    cardBg: 'bg-[#281519]',
    cardHover: 'hover:bg-[#31191e]',
    stackBack1: 'bg-[#221216] border-rose-500/30',
    stackBack2: 'bg-[#1c1013] border-rose-500/20',
    border: 'border-rose-500/50',
    msgBorder: 'border-rose-500/45',
    badge: 'bg-rose-500 text-white',
    badgeSoft: 'bg-rose-500/20 text-rose-300',
    titleText: 'text-rose-300',
    subText: 'text-rose-300/80',
    closeHover: 'hover:bg-rose-500/20',
  },
  important: {
    rank: 2,
    label: 'Importante',
    dot: 'bg-amber-400',
    ring: 'ring-amber-400/70',
    cardBg: 'bg-[#261f12]',
    cardHover: 'hover:bg-[#2c2415]',
    stackBack1: 'bg-[#231c11] border-amber-500/30',
    stackBack2: 'bg-[#1d1810] border-amber-500/20',
    border: 'border-amber-500/50',
    msgBorder: 'border-amber-500/45',
    badge: 'bg-obsidian-amber text-[#191919]',
    badgeSoft: 'bg-obsidian-amber/20 text-obsidian-amber',
    titleText: 'text-obsidian-amber',
    subText: 'text-amber-300/80',
    closeHover: 'hover:bg-amber-500/20',
  },
  info: {
    rank: 1,
    label: 'Info',
    dot: 'bg-sky-400',
    ring: 'ring-sky-400/70',
    cardBg: 'bg-[#12202b]',
    cardHover: 'hover:bg-[#162735]',
    stackBack1: 'bg-[#111c26] border-sky-400/30',
    stackBack2: 'bg-[#0f1820] border-sky-400/20',
    border: 'border-sky-400/50',
    msgBorder: 'border-sky-400/45',
    badge: 'bg-sky-400 text-[#191919]',
    badgeSoft: 'bg-sky-400/20 text-sky-300',
    titleText: 'text-sky-300',
    subText: 'text-sky-300/80',
    closeHover: 'hover:bg-sky-400/20',
  },
};

const ALERT_KEYS = ['urgent', 'important', 'info'];

function getMsgPriority(m) {
  if (!m) return null;
  if (m.priority && ALERT_LEVELS[m.priority]) return m.priority;
  return m.pinned ? 'important' : null;
}

const FILE_REVIEW_STATUSES = ['En Revisión', 'Aprobado', 'Con cambios'];

function parseMetaSize(meta) {
  const m = String(meta || '').match(/(\d+(?:[.,]\d+)?\s*(?:KB|MB|GB))/i);
  return m ? m[1].toUpperCase() : '—';
}

function getFileExtension(name) {
  const m = String(name || '').match(/\.([a-z0-9]+)$/i);
  return m ? m[1].toUpperCase() : 'ARCHIVO';
}

function getFileTechSpecs(piece) {
  if (!piece) return [];
  const name = String(piece.name || '');
  const ext = getFileExtension(name);
  const size = piece.size || parseMetaSize(piece.meta);
  const rows = [];

  if (/\.(mp4|mov|webm)$/i.test(name) || /VIDEO/i.test(piece.meta || '')) {
    const isVert = /reel|stor|vertical|tiktok|9:16/i.test(name);
    rows.push(['Formato', `${ext} · ${size}`]);
    rows.push(['Resolución', piece.dimensions || (isVert ? '1080 × 1920 (9:16)' : '1920 × 1080 (16:9)')]);
    rows.push(['Duración / FPS', piece.duration || '00:15 · 30 fps']);
    rows.push(['Códec', piece.codec || 'H.264 · 12 Mbps']);
    rows.push(['Audio', piece.audio || 'Estéreo · 48 kHz']);
    rows.push(['Color', piece.colorSpace || 'Rec. 709']);
  } else if (/\.(mp3|wav|m4a|aiff)$/i.test(name) || /AUDIO/i.test(piece.meta || '')) {
    rows.push(['Formato', `${ext} · ${size}`]);
    rows.push(['Duración', piece.duration || '00:30']);
    rows.push(['Muestreo', piece.sampleRate || '48 kHz · 24-bit']);
    rows.push(['Canales', piece.channels || 'Estéreo']);
  } else if (/\.(ai|eps|svg)$/i.test(name)) {
    rows.push(['Formato', `${ext} · ${size}`]);
    rows.push(['Medidas', piece.dimensions || '210 × 297 mm']);
    rows.push(['Color', piece.colorSpace || (ext === 'SVG' ? 'RGB' : 'CMYK')]);
    if (ext !== 'SVG') {
      rows.push(['Sangrado', piece.bleed || '3 mm']);
      rows.push(['Tipografías', piece.outlines || 'En curvas']);
    }
  } else if (/\.(xlsx?|csv|numbers)$/i.test(name)) {
    rows.push(['Formato', `${ext} · ${size}`]);
    rows.push(['Hojas', piece.sheets || '3 hojas']);
    rows.push(['Estructura', piece.grid || '142 filas × 8 cols']);
  } else if (/\.(pdf|docx?|pages|txt|md)$/i.test(name) || /PDF|DOC|TEXTO/i.test(piece.meta || '')) {
    rows.push(['Formato', `${ext} · ${size}`]);
    if (ext === 'PDF') {
      rows.push(['Páginas', piece.pages || '4 págs']);
      if (/arte|troquel|manual|brochure|carta/i.test(name)) {
        rows.push(['Color', piece.colorSpace || 'CMYK · 300 dpi']);
        rows.push(['Sangrado', piece.bleed || '3 mm']);
      } else {
        rows.push(['Conteo', piece.wordCount || '640 palabras']);
      }
    } else {
      rows.push(['Páginas', piece.pages || '2 págs']);
      rows.push(['Conteo', piece.wordCount || '480 palabras']);
    }
  } else if (/\.(html?|css|js|ts|json)$/i.test(name) || /CODE|CÓDIGO/i.test(piece.meta || '')) {
    const langMap = { HTML: 'HTML5', HTM: 'HTML5', CSS: 'CSS3', JS: 'JavaScript', TS: 'TypeScript', JSON: 'JSON' };
    rows.push(['Lenguaje', `${langMap[ext] || ext} · ${size}`]);
    rows.push(['Líneas', piece.lines || '184 líneas']);
    rows.push(['Codificación', 'UTF-8']);
  } else {
    const isVert = /vertical|stor/i.test(name);
    const isPrint = /arte|empaque|troquel|caja|etiqueta/i.test(name);
    rows.push(['Formato', `${ext} · ${size}`]);
    rows.push(['Dimensiones', piece.dimensions || (isVert ? '1080 × 1920 (9:16)' : '1080 × 1350 (4:5)')]);
    rows.push(['Resolución', piece.dpi || (isPrint ? '300 dpi' : '72 dpi')]);
    rows.push(['Color', piece.colorSpace || (isPrint ? 'CMYK' : 'sRGB')]);
    rows.push(['Alfa / Bits', piece.alpha || (ext === 'PNG' ? 'Sí · 8-bit' : 'No · 8-bit')]);
  }

  return rows;
}

function renderFileInspectorBlockHtml(piece, { isArchived = false, standalone = false, selectedCount = 0 } = {}) {
  if (selectedCount > 1) {
    return `
      <div class="${standalone ? 'space-y-2.5' : 'pt-2 border-t border-obsidian-border space-y-2'}">
        <div class="flex items-center justify-between gap-1.5">
          <span class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C] font-semibold">Selección múltiple</span>
          <span class="px-1.5 py-0.5 rounded-full bg-obsidian-amber/20 text-obsidian-amber font-mono text-[9px] font-semibold">${selectedCount}</span>
        </div>
        <div class="p-2 rounded-lg bg-[#191919] border border-obsidian-border text-[10px] text-[#D4D4D4] space-y-2">
          <div>${selectedCount} archivos marcados para acción en lote.</div>
          ${!isArchived ? `
          <div class="grid grid-cols-2 gap-1.5">
            <button type="button" data-insp-batch-status="Aprobado" class="h-6 rounded-md bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[9.5px] font-medium cursor-pointer">
              Aprobar todos
            </button>
            <button type="button" data-insp-batch-status="En Revisión" class="h-6 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-obsidian-amber text-[9.5px] font-medium cursor-pointer">
              En Revisión
            </button>
          </div>
          <div class="flex gap-1.5">
            <button type="button" id="insp-batch-clear" class="flex-1 h-6 rounded-md bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4] text-[9.5px] cursor-pointer">
              Limpiar
            </button>
            <button type="button" id="insp-batch-delete" class="flex-1 h-6 rounded-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/35 text-rose-300 text-[9.5px] cursor-pointer">
              Eliminar (${selectedCount})
            </button>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }
  if (!piece) return '';

  const { versions, current, latest, isHistorical } = getActivePieceVersion(piece);
  const displayMeta = current?.meta || piece.meta;
  const techRows = getFileTechSpecs({ ...piece, meta: displayMeta });
  const reviewStatus = current?.status || piece.status || 'En Revisión';
  const statusColor = reviewStatus === 'Aprobado'
    ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
    : reviewStatus === 'Con cambios'
      ? 'text-rose-300 border-rose-500/40 bg-rose-500/10'
      : 'text-obsidian-amber border-amber-500/40 bg-amber-500/10';
  const openPins = current?.openPins ?? (reviewStatus === 'Aprobado' ? 0 : 2);
  const uploadedBy = current?.uploadedBy || piece.uploadedBy || 'Andrés';
  const uploadedAt = current?.at || '';
  const origFileName = current?.fileName || piece.name;

  return `
    <div class="${standalone ? 'space-y-2.5' : 'pt-2 border-t border-obsidian-border space-y-2'}">
      ${standalone ? `
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-1.5">
            <span class="font-mono text-[9.5px] font-semibold text-obsidian-amber px-1.5 py-0.5 rounded bg-[#191919] border border-obsidian-border">${escapeHtml(getFileExtension(piece.name))} · v${current?.version || 1}</span>
            ${piece.otId ? `<button type="button" id="insp-file-open-ot" class="font-mono text-[9.5px] text-obsidian-cyan hover:underline cursor-pointer">${escapeHtml(piece.otId)} ↗</button>` : ''}
          </div>
          <div class="text-[11.5px] font-medium text-[#D4D4D4] leading-snug break-all">${escapeHtml(piece.name)}</div>
          ${piece.client ? `<div class="text-[10px] font-medium truncate" style="color:${escapeHtml(getClientColor(piece.client))}">${escapeHtml(piece.client)}${piece.brand ? ` · ${escapeHtml(piece.brand)}` : ''}</div>` : ''}
        </div>
      ` : `
        <div class="flex items-center justify-between gap-1.5">
          <span class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C] font-semibold">Archivo · v${current?.version || 1}</span>
          <span class="font-mono text-[9px] text-[#737373] truncate max-w-[110px]" title="${escapeHtml(piece.name)}">${escapeHtml(piece.name)}</span>
        </div>
      `}

      ${isHistorical ? `
        <div class="p-2 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[9.5px] space-y-1.5">
          <div class="text-obsidian-amber font-medium">Viendo v${current.version} (histórica · solo lectura)</div>
          <div class="flex gap-1.5">
            <button type="button" data-insp-select-ver="${latest.version}" class="flex-1 h-6 rounded bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] cursor-pointer">Ir a v${latest.version}</button>
            ${!isArchived ? `<button type="button" id="insp-ver-restore" class="flex-1 h-6 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-obsidian-amber cursor-pointer">Restaurar v${latest.version + 1}</button>` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Estado de revisión editable (solo en versión actual) -->
      <div class="flex items-center justify-between gap-2 text-[10px]">
        <span class="text-[#8C8C8C]">Revisión</span>
        <select id="insp-file-status" ${isArchived || isHistorical ? 'disabled' : ''}
          class="h-6 px-2 rounded-md border text-[10px] font-medium focus:outline-none ${isArchived || isHistorical ? 'opacity-60 cursor-default' : 'cursor-pointer'} ${statusColor}">
          ${FILE_REVIEW_STATUSES.map((st) => `<option value="${st}" class="bg-[#202020] text-[#D4D4D4]" ${reviewStatus === st ? 'selected' : ''}>${st}</option>`).join('')}
        </select>
      </div>

      <!-- Ficha técnica adaptativa (estilo Finder) -->
      <div class="divide-y divide-obsidian-border/50 text-[10px] bg-[#191919] border border-obsidian-border rounded-lg px-2 py-0.5">
        ${techRows.map(([k, v]) => `
          <div class="flex items-center justify-between gap-2 py-1">
            <span class="text-[#8C8C8C] shrink-0">${escapeHtml(k)}</span>
            <span class="text-[#D4D4D4] font-mono text-[9.5px] text-right truncate">${escapeHtml(v)}</span>
          </div>
        `).join('')}
        ${origFileName !== piece.name ? `
          <div class="flex items-center justify-between gap-2 py-1">
            <span class="text-[#8C8C8C] shrink-0">Archivo orig.</span>
            <span class="text-[#8C8C8C] font-mono text-[9px] text-right truncate" title="${escapeHtml(origFileName)}">${escapeHtml(origFileName)}</span>
          </div>
        ` : ''}
        ${piece.taskTitle ? `
          <div class="flex items-center justify-between gap-2 py-1">
            <span class="text-[#8C8C8C] shrink-0">Vinculado a</span>
            <span class="text-[#D4D4D4] text-right truncate">${escapeHtml(piece.taskTitle)}</span>
          </div>
        ` : ''}
        <div class="flex items-center justify-between gap-2 py-1">
          <span class="text-[#8C8C8C] shrink-0">Subido por</span>
          <span class="text-[#D4D4D4] text-right truncate">${escapeHtml(uploadedBy)}${uploadedAt ? ` · ${escapeHtml(uploadedAt)}` : ''}</span>
        </div>
        <div class="flex items-center justify-between gap-2 py-1">
          <span class="text-[#8C8C8C] shrink-0">Pines RC</span>
          <span class="font-mono text-[9.5px] ${openPins > 0 ? 'text-obsidian-amber' : 'text-[#8C8C8C]'}">${openPins > 0 ? `${openPins} abiertos` : 'Sin pendientes'}</span>
        </div>
      </div>

      <!-- Historial de versiones -->
      <div class="space-y-1.5">
        <div class="flex items-center justify-between gap-1.5">
          <span class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C] font-semibold">Versiones (${versions.length})</span>
          ${!isArchived ? `<button type="button" id="insp-ver-toggle-form" class="text-[9.5px] text-obsidian-amber hover:underline cursor-pointer">+ Nueva versión</button>` : ''}
        </div>
        ${!isArchived ? `
          <form id="insp-ver-form" class="hidden p-2 rounded-lg bg-[#191919] border border-obsidian-border space-y-1.5 text-[10px]">
            <input id="insp-ver-file" type="file" class="w-full text-[9.5px] text-[#8C8C8C] file:mr-2 file:py-0.5 file:px-2 file:rounded file:border-0 file:bg-obsidian-elevated file:text-[#D4D4D4] file:text-[9.5px] file:cursor-pointer cursor-pointer" />
            <input id="insp-ver-note" type="text" placeholder="Nota de cambio (ej. Ajuste logo)..."
              class="w-full h-6 bg-[#202020] border border-obsidian-border rounded px-2 text-[10px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60" />
            <div class="flex justify-end gap-1.5">
              <button type="button" id="insp-ver-cancel" class="h-6 px-2 rounded bg-[#202020] hover:bg-obsidian-elevated text-[9.5px] text-[#8C8C8C] cursor-pointer">Cancelar</button>
              <button type="submit" class="h-6 px-2.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-[9.5px] text-obsidian-amber font-medium cursor-pointer">Subir v${(latest?.version || 1) + 1}</button>
            </div>
          </form>
        ` : ''}
        <div class="space-y-1 max-h-32 overflow-y-auto pr-0.5">
          ${[...versions].reverse().map((v) => {
            const isViewing = v.version === current?.version;
            const isLatest = v.version === latest?.version;
            return `
              <div data-insp-select-ver="${v.version}" class="px-2 py-1.5 rounded-lg border text-[9.5px] cursor-pointer transition-colors ${isViewing ? 'bg-obsidian-elevated/80 border-obsidian-amber/50' : 'bg-[#191919] border-obsidian-border hover:border-[#3a3a3a]'}">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="inline-flex items-center gap-1 min-w-0">
                    <span class="font-mono font-semibold ${isViewing ? 'text-obsidian-amber' : 'text-[#D4D4D4]'}">v${v.version}</span>
                    ${isLatest ? '<span class="px-1 rounded bg-emerald-500/15 text-emerald-300 text-[8px] font-mono">actual</span>' : ''}
                    <span class="text-[#8C8C8C] truncate">${escapeHtml(v.status)}</span>
                  </span>
                  <span class="inline-flex items-center gap-1 shrink-0">
                    <span class="font-mono text-[8.5px] text-[#737373]">${escapeHtml(v.at)}</span>
                    ${!isArchived && versions.length > 1 ? `<button type="button" data-insp-del-ver="${v.version}" title="Eliminar v${v.version}" class="w-3.5 h-3.5 rounded hover:bg-[#2a2a2a] text-[#737373] hover:text-rose-400 flex items-center justify-center cursor-pointer leading-none">×</button>` : ''}
                  </span>
                </div>
                ${v.note ? `<div class="mt-0.5 text-[9px] text-[#8C8C8C] truncate">${escapeHtml(v.note)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <div class="flex gap-1.5">
        <button type="button" id="insp-file-review" class="flex-1 h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10px] text-[#D4D4D4] cursor-pointer">
          Revisar v${current?.version || 1}
        </button>
        ${standalone && piece.otId ? `
          <button type="button" id="insp-file-open-ot-btn" class="flex-1 h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10px] text-obsidian-cyan cursor-pointer">
            Abrir OT
          </button>
        ` : ''}
      </div>
    </div>
  `;
}

function bindBatchFileEvents(mount, { piecesList = [], ot = null, onDeleteSelected = null, onRerender = null } = {}) {
  if (!mount) return;
  mount.querySelectorAll('[data-insp-batch-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextStatus = btn.dataset.inspBatchStatus;
      let changed = 0;
      (piecesList || []).forEach((p) => {
        if (sketchState.selectedPieces.has(p.name)) {
          p.status = nextStatus;
          changed += 1;
        }
      });
      if (ot && changed > 0) {
        recordOtActivity(ot, `cambió ${changed} archivos a ${nextStatus}`);
      }
      if (typeof onRerender === 'function') onRerender();
    });
  });

  mount.querySelector('#insp-batch-clear')?.addEventListener('click', () => {
    sketchState.selectedPieces.clear();
    if (typeof onRerender === 'function') onRerender();
  });

  mount.querySelector('#insp-batch-delete')?.addEventListener('click', () => {
    if (typeof onDeleteSelected === 'function') {
      onDeleteSelected();
    } else if (ot && Array.isArray(ot.mediaFiles)) {
      ot.mediaFiles = ot.mediaFiles.filter((p) => !sketchState.selectedPieces.has(p.name));
    }
    sketchState.selectedPieces.clear();
    sketchState.activePieceIndex = null;
    if (typeof onRerender === 'function') onRerender();
  });
}

function bindFileInspectorEvents(mount, piece, { ot = null, onRerender = null } = {}) {
  if (!mount || !piece) return;
  const { current, latest } = getActivePieceVersion(piece);

  mount.querySelector('#insp-file-status')?.addEventListener('change', (e) => {
    const prev = current?.status || piece.status || 'En Revisión';
    const next = e.target.value;
    if (current) current.status = next;
    if (!current || current.version === latest?.version) piece.status = next;
    if (ot && prev !== next) {
      recordOtActivity(ot, `cambió «${piece.name}» (v${current?.version || 1}) a ${next}`);
    }
    if (typeof onRerender === 'function') onRerender();
  });

  mount.querySelectorAll('[data-insp-select-ver]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-insp-del-ver]')) return;
      const ver = Number(el.dataset.inspSelectVer);
      if (!Number.isNaN(ver)) {
        piece.activeVersion = ver;
        if (typeof onRerender === 'function') onRerender();
      }
    });
  });

  mount.querySelectorAll('[data-insp-del-ver]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const ver = Number(btn.dataset.inspDelVer);
      if (deletePieceVersion(piece, ver, { ot })) {
        if (typeof onRerender === 'function') onRerender();
      }
    });
  });

  mount.querySelector('#insp-ver-restore')?.addEventListener('click', () => {
    if (!current) return;
    addPieceVersion(piece, {
      fileName: current.fileName,
      meta: current.meta,
      note: `Restaurada desde v${current.version}`,
      ot,
    });
    if (typeof onRerender === 'function') onRerender();
  });

  const verForm = mount.querySelector('#insp-ver-form');
  mount.querySelector('#insp-ver-toggle-form')?.addEventListener('click', () => {
    verForm?.classList.toggle('hidden');
    verForm?.querySelector('#insp-ver-note')?.focus();
  });
  mount.querySelector('#insp-ver-cancel')?.addEventListener('click', () => {
    verForm?.classList.add('hidden');
  });
  verForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const fileInput = verForm.querySelector('#insp-ver-file');
    const noteInput = verForm.querySelector('#insp-ver-note');
    const pickedFile = fileInput?.files?.[0] || null;
    const sizeLabel = pickedFile
      ? (pickedFile.size >= 1024 * 1024
        ? `${(pickedFile.size / (1024 * 1024)).toFixed(2)} MB`
        : `${Math.max(1, Math.round(pickedFile.size / 1024))} KB`)
      : null;
    const ext = getFileExtension(pickedFile?.name || piece.name);
    addPieceVersion(piece, {
      fileName: pickedFile?.name || piece.name,
      meta: sizeLabel ? `${ext} · ${sizeLabel}` : piece.meta,
      note: noteInput?.value || '',
      ot,
    });
    if (typeof onRerender === 'function') onRerender();
  });

  mount.querySelector('#insp-file-review')?.addEventListener('click', () => {
    notifySketchChange('open-review', { piece });
  });

  const openLinkedOt = () => {
    if (!piece.otId) return;
    notifySketchChange('open-ot', { otId: piece.otId, scope: 'active' });
  };
  mount.querySelector('#insp-file-open-ot')?.addEventListener('click', openLinkedOt);
  mount.querySelector('#insp-file-open-ot-btn')?.addEventListener('click', openLinkedOt);
}

function renderChannelBadge(channel) {
  if (channel === 'WhatsApp') {
    return '<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[8.5px] font-mono">WhatsApp</span>';
  }
  if (channel === 'Slack') {
    return '<span class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[8.5px] font-mono">Slack</span>';
  }
  return '<span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-obsidian-cyan text-[8.5px] font-mono">App</span>';
}

/**
 * Unified 3-tab Inspector renderer (`Detalle | Actividad | Mensajes`).
 */
export function renderTabbedInspector({
  ot,
  task = null,
  taskIndex = null,
  activePiece = null,
  selectedPieceCount = 0,
  activeRoute = null,
  activeRouteIndex = null,
  showOpenButton = false,
  preserveCalendar = false,
  focusNotes = false,
  onRerender = null,
  onOpenOt = null,
  onJumpStripboard = null,
} = {}) {
  const mount = getInspectorTargetMount(preserveCalendar);
  if (!mount) return;

  if (!ot) {
    mount.innerHTML = '';
    return;
  }

  ensureOtData(ot);
  const isArchived = !!ot.archived;
  const hasTask = !!task && taskIndex !== null && taskIndex !== undefined && taskIndex !== '';
  const targetObj = hasTask ? task : ot;
  const codeLabel = hasTask ? `${ot.id}-${Number(taskIndex) + 1}` : ot.id;
  const cColor = getClientColor(ot.client);
  const statusVal = targetObj.status || ot.status || '';
  const stageVal = targetObj.stage || ot.stage || 'Tráfico';
  const deptVal = targetObj.department || ot.department || '—';

  if (hasTask) {
    if (!Array.isArray(task.activityLog)) {
      const baseAt = formatShortDate(task.entryDate || ot.entryDate) || 'Hoy';
      const resp = task.responsible || ot.responsible || 'Andrés';
      task.activityLog = [
        { at: baseAt, actor: resp, text: `tarea «${task.title}» en etapa ${stageVal}` },
        { at: baseAt, actor: 'Tráfico', text: `asignó la tarea a ${resp} (${deptVal})` },
      ];
    }
    if (!Array.isArray(task.messages)) {
      const baseAt = formatShortDate(task.entryDate || ot.entryDate) || 'Hoy';
      const resp = task.responsible || ot.responsible || 'Andrés';
      task.messages = [
        { at: baseAt, actor: 'Tráfico', channel: 'App', text: `Tarea ${codeLabel} (${task.title}) asignada a @${resp}.`, priority: null, pinned: false },
      ];
    }
  }

  const logs = Array.isArray(targetObj.activityLog) ? targetObj.activityLog : [];
  const msgs = Array.isArray(targetObj.messages) ? targetObj.messages : [];
  const pinnedItems = msgs
    .map((m, idx) => ({ msg: m, idx, priority: getMsgPriority(m) }))
    .filter((item) => !!item.priority)
    .sort((a, b) => {
      const rankDiff = ALERT_LEVELS[b.priority].rank - ALERT_LEVELS[a.priority].rank;
      return rankDiff !== 0 ? rankDiff : b.idx - a.idx;
    });
  if (pinnedItems.length <= 1) sketchState.inspectorAlertsExpanded = false;
  const activeTab = ['detail', 'activity', 'messages'].includes(sketchState.inspectorTab)
    ? sketchState.inspectorTab
    : 'detail';

  // --- Tab 1: Detalle ---
  let detailHtml = '';
  if (activeTab === 'detail') {
    let taskScheduleHtml = '';
    if (hasTask) {
      const dailyHours = Number(studioSettings.dailyHours) || 8;
      const schedDate = (task.scheduledDate || task.deliveryDate || ot.deliveryDate || '').slice(0, 10);
      const estHours = Number(task.estimatedHours ?? 3) || 0;
      const reserved = getDayReservedHours(schedDate);
      const isOver = reserved > dailyHours;
      taskScheduleHtml = `
        <div class="pt-2 border-t border-obsidian-border space-y-2">
          <div class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C] font-semibold">Programación y Tiempo</div>
          <label class="block space-y-1">
            <span class="text-[10px] text-[#8C8C8C]">Tiempo dedicado (horas)</span>
            <input id="insp-task-hours" type="number" min="0.5" max="16" step="0.5" value="${estHours}" ${isArchived ? 'disabled' : ''}
              class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-md px-2 text-[11px] font-mono text-[#D4D4D4] focus:outline-none focus:border-obsidian-amber/60" />
          </label>
          <label class="block space-y-1">
            <span class="text-[10px] text-[#8C8C8C]">Día programado (entrega: ${escapeHtml(formatShortDate(task.deliveryDate || ot.deliveryDate) || '—')})</span>
            <input id="insp-task-date" type="date" value="${escapeHtml(schedDate)}" ${isArchived ? 'disabled' : ''} style="color-scheme: dark;"
              class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-md px-2 text-[11px] font-mono text-[#D4D4D4] focus:outline-none focus:border-obsidian-amber/60 cursor-pointer" />
          </label>
          <div id="insp-capacity-box" class="p-2 rounded-lg border ${isOver ? 'bg-rose-500/10 border-rose-500/40' : 'bg-[#191919] border-obsidian-border'} space-y-1">
            <div class="flex items-center justify-between text-[10px]">
              <span class="text-[#8C8C8C]">Reservado ese día</span>
              <span id="insp-capacity-val" class="font-mono font-semibold ${isOver ? 'text-rose-300' : 'text-[#D4D4D4]'}">${reserved}h / ${dailyHours}h</span>
            </div>
            <div class="h-1.5 w-full rounded-full bg-[#262626] overflow-hidden">
              <div id="insp-capacity-bar" class="h-full ${isOver ? 'bg-rose-400' : 'bg-obsidian-amber'} transition-all" style="width:${Math.min(100, Math.round((reserved / dailyHours) * 100))}%"></div>
            </div>
            <div id="insp-capacity-note" class="text-[9.5px] ${isOver ? 'text-rose-300' : 'text-[#8C8C8C]'}">
              ${isOver ? `Sobrecarga de ${(reserved - dailyHours).toFixed(1).replace(/\.0$/, '')}h.` : `Disponible: ${(dailyHours - reserved).toFixed(1).replace(/\.0$/, '')}h libres.`}
            </div>
          </div>
          <div class="flex gap-1.5">
            <button type="button" id="insp-go-sb-day" class="flex-1 h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10px] text-[#D4D4D4] cursor-pointer">Ver Día</button>
            <button type="button" id="insp-go-sb-week" class="flex-1 h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10px] text-[#D4D4D4] cursor-pointer">Ver Semana</button>
          </div>
        </div>
      `;
    }

    let routeDetailHtml = '';
    if (!showOpenButton && activeRoute) {
      const routeLocked = isArchived || !!activeRoute.locked;
      routeDetailHtml = `
        <div class="pt-2 border-t border-obsidian-border space-y-2">
          <div class="flex items-center justify-between gap-1.5">
            <span class="text-[9.5px] uppercase tracking-[0.1em] text-obsidian-amber font-semibold">Bitácora · Fila #${Number(activeRouteIndex) + 1}</span>
            <button type="button" id="insp-route-clear" title="Cerrar detalle de fila" class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer leading-none">×</button>
          </div>
          <div class="divide-y divide-obsidian-border/50 text-[10px] bg-[#191919] border border-obsidian-border rounded-lg px-2 py-0.5">
            <div class="flex items-center justify-between gap-2 py-1">
              <span class="text-[#8C8C8C]">Ruta</span>
              <span class="text-right truncate">
                <span style="color:${escapeHtml(getDepartmentColor(activeRoute.from))}">${escapeHtml(activeRoute.from || '—')}</span>
                <span class="text-[#737373] mx-0.5">→</span>
                <span style="color:${escapeHtml(getDepartmentColor(activeRoute.to))}">${escapeHtml(activeRoute.to || '—')}</span>
              </span>
            </div>
            <div class="flex items-center justify-between gap-2 py-1">
              <span class="text-[#8C8C8C]">Fecha/Hora</span>
              <span class="font-mono text-[9.5px] text-[#D4D4D4]">${escapeHtml(activeRoute.date || '—')}</span>
            </div>
            <div class="flex items-center justify-between gap-2 py-1">
              <span class="text-[#8C8C8C]">Firma</span>
              <span class="text-[#D4D4D4] truncate">${escapeHtml(activeRoute.sign || 'Sin firmar')}</span>
            </div>
            <div class="flex items-center justify-between gap-2 py-1">
              <span class="text-[#8C8C8C]">Estado</span>
              <span class="font-mono text-[9.5px] ${routeLocked ? 'text-rose-400' : 'text-emerald-400'}">${routeLocked ? 'Firmada · Bloqueada' : 'Editable'}</span>
            </div>
          </div>
          ${activeRoute.desc ? `
            <div class="p-2 rounded-lg bg-[#191919] border border-obsidian-border text-[10px] text-[#D4D4D4] leading-snug whitespace-pre-wrap">${escapeHtml(activeRoute.desc)}</div>
          ` : ''}
          <label class="block space-y-1">
            <span class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C]">Notas de esta fila</span>
            <textarea id="insp-route-notes" rows="2" ${routeLocked ? 'readonly' : ''} placeholder="Sin notas en esta fila..."
              class="w-full bg-[#191919] border border-obsidian-border rounded-lg p-1.5 text-[10px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60 resize-none">${escapeHtml(activeRoute.notes || '')}</textarea>
          </label>
        </div>
      `;
    }

    const subCount = (ot.subtasks || []).length;
    const mediaCount = hasTask ? (task.mediaFiles || []).length : (ot.mediaFiles || []).length;
    detailHtml = `
      <div class="space-y-2.5">
        ${isArchived ? `
          <div class="px-2 py-1.5 rounded-lg bg-[#191919] border border-obsidian-border flex items-center justify-between gap-2 text-[10px] text-[#8C8C8C]">
            <span>OT en archivo (solo lectura)</span>
            <button type="button" id="insp-restore-ot" class="text-obsidian-amber hover:underline cursor-pointer shrink-0">Restaurar</button>
          </div>
        ` : ''}
        ${showOpenButton || hasTask ? `
          <div class="grid grid-cols-2 gap-1.5 text-[10px]">
            <div class="p-1.5 rounded-lg bg-[#191919] border border-obsidian-border">
              <div class="text-[8.5px] uppercase text-[#737373]">Depto.</div>
              <div class="font-medium truncate" style="color:${escapeHtml(getDepartmentColor(deptVal))}">${escapeHtml(deptVal)}</div>
            </div>
            <div class="p-1.5 rounded-lg bg-[#191919] border border-obsidian-border">
              <div class="text-[8.5px] uppercase text-[#737373]">Etapa</div>
              <div class="font-medium truncate" style="color:${escapeHtml(getStageColor(stageVal))}">${escapeHtml(stageVal)}</div>
            </div>
            <div class="p-1.5 rounded-lg bg-[#191919] border border-obsidian-border">
              <div class="text-[8.5px] uppercase text-[#737373]">Responsable</div>
              <div class="text-[#D4D4D4] truncate">${escapeHtml(targetObj.responsible || ot.responsible || '—')}</div>
            </div>
            <div class="p-1.5 rounded-lg bg-[#191919] border border-obsidian-border">
              <div class="text-[8.5px] uppercase text-[#737373]">Entrega</div>
              ${!isArchived ? `
                <div class="flex items-center justify-between gap-1 mt-0.5">
                  <span class="font-mono text-[#D4D4D4] text-[9.5px] truncate">${escapeHtml((formatShortDate(targetObj.deliveryDate || ot.deliveryDate) || '—').split(' ')[0])}</span>
                  <input id="insp-delivery-time" type="time" value="${escapeHtml(String(targetObj.deliveryDate || ot.deliveryDate || '').slice(11, 16) || '17:00')}" style="color-scheme: dark;"
                    title="Ajustar hora de entrega"
                    class="bg-[#202020] border border-obsidian-border rounded px-1 py-0 text-[9px] font-mono text-obsidian-amber focus:outline-none focus:border-obsidian-amber/60 cursor-pointer" />
                </div>
              ` : `
                <div class="font-mono text-[#D4D4D4] truncate">${escapeHtml(formatShortDate(targetObj.deliveryDate || ot.deliveryDate) || '—')}</div>
              `}
            </div>
          </div>
        ` : `
          <div class="flex items-center justify-between px-2 py-1.5 rounded-lg bg-[#191919] border border-obsidian-border text-[10px] text-[#8C8C8C]">
            <span>${subCount} ${subCount === 1 ? 'tarea' : 'tareas'}</span>
            <span>·</span>
            <span>${mediaCount} ${mediaCount === 1 ? 'archivo' : 'archivos'}</span>
          </div>
        `}

        ${routeDetailHtml}

        ${taskScheduleHtml}

        ${!showOpenButton ? renderFileInspectorBlockHtml(activePiece, { isArchived, standalone: false, selectedCount: selectedPieceCount }) : ''}

        <label class="block space-y-1">
          <span class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C] font-semibold">Notas rápidas</span>
          <textarea id="insp-traffic-notes" rows="3" ${isArchived ? 'readonly' : ''} placeholder="Escribir notas..."
            class="w-full bg-[#191919] border border-obsidian-border rounded-lg p-2 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60 resize-y">${escapeHtml(targetObj.notes || '')}</textarea>
        </label>

        ${showOpenButton ? `
          <button type="button" id="insp-traffic-open-ot" class="w-full h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">
            Abrir ${hasTask ? 'Tarea' : 'OT'}
          </button>
        ` : ''}
      </div>
    `;
  }

  // --- Tab 2: Actividad ---
  const activityHtml = activeTab === 'activity' ? `
    <div class="space-y-1.5">
      ${logs.map((entry) => `
        <div class="p-2 rounded-lg bg-[#191919] border border-obsidian-border text-[10px] space-y-0.5">
          <div class="flex items-center justify-between gap-1.5">
            <span class="font-medium text-obsidian-cyan truncate">${escapeHtml(entry.actor)}</span>
            <span class="font-mono text-[9px] text-[#8C8C8C] shrink-0">${escapeHtml(entry.at)}</span>
          </div>
          <div class="text-[#D4D4D4] leading-snug">${escapeHtml(entry.text)}</div>
        </div>
      `).join('') || '<div class="text-[10px] text-[#8C8C8C] py-3 text-center">Sin actividad registrada aún.</div>'}
    </div>
  ` : '';

  // --- Tab 3: Mensajes ---
  const composerPrio = ALERT_LEVELS[sketchState.inspectorComposerPriority] ? sketchState.inspectorComposerPriority : null;
  const messagesHtml = activeTab === 'messages' ? `
    <div class="space-y-2">
      <div class="space-y-1.5 max-h-64 overflow-y-auto pr-0.5">
        ${msgs.map((m, mIdx) => {
          const mp = getMsgPriority(m);
          const cfg = mp ? ALERT_LEVELS[mp] : null;
          return `
          <div class="p-2 rounded-lg bg-[#191919] border ${cfg ? cfg.msgBorder : 'border-obsidian-border'} text-[10px] space-y-1">
            <div class="flex items-center justify-between gap-1">
              <span class="inline-flex items-center gap-1 min-w-0">
                <span class="font-medium text-[#D4D4D4] truncate">${escapeHtml(m.actor)}</span>
                ${renderChannelBadge(m.channel)}
              </span>
              <span class="inline-flex items-center gap-1.5 shrink-0">
                <span class="font-mono text-[8.5px] text-[#8C8C8C]">${escapeHtml(m.at)}</span>
                ${!isArchived ? `
                  <span class="inline-flex items-center gap-1" title="Prioridad de alerta">
                    ${ALERT_KEYS.map((k) => {
                      const lv = ALERT_LEVELS[k];
                      const isSel = mp === k;
                      return `<button type="button" data-insp-msg-prio="${mIdx}:${k}" title="${isSel ? `Quitar alerta ${lv.label}` : `Marcar como ${lv.label}`}"
                        class="w-2 h-2 rounded-full ${lv.dot} cursor-pointer transition-all ${isSel ? `opacity-100 ring-2 ring-offset-1 ring-offset-[#191919] ${lv.ring} scale-110` : 'opacity-25 hover:opacity-90'}"></button>`;
                    }).join('')}
                  </span>
                ` : ''}
              </span>
            </div>
            <div class="text-[#D4D4D4] leading-snug whitespace-pre-wrap">${escapeHtml(m.text)}</div>
          </div>
          `;
        }).join('') || '<div class="text-[10px] text-[#8C8C8C] py-3 text-center">Sin mensajes en esta OT.</div>'}
      </div>

      ${!isArchived ? `
        <form id="insp-msg-form" class="pt-2 border-t border-obsidian-border space-y-1.5">
          <textarea id="insp-msg-input" rows="2" placeholder="Escribir mensaje o @mencionar..."
            class="w-full bg-[#191919] border border-obsidian-border rounded-lg p-2 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60 resize-none"></textarea>
          <div class="flex items-center justify-between gap-1.5">
            <div class="flex items-center gap-2 text-[9.5px] text-[#8C8C8C]">
              <label class="inline-flex items-center gap-1 cursor-pointer" title="Enviar por WhatsApp">
                <input id="insp-msg-wa" type="checkbox" class="accent-emerald-500 rounded cursor-pointer" />
                <span>WhatsApp</span>
              </label>
              <span class="inline-flex items-center gap-1.5 pl-1 border-l border-obsidian-border" title="Fijar como alerta con prioridad">
                ${ALERT_KEYS.map((k) => {
                  const lv = ALERT_LEVELS[k];
                  const isSel = composerPrio === k;
                  return `<button type="button" data-insp-composer-prio="${k}" title="${isSel ? `Quitar prioridad ${lv.label}` : `Alerta: ${lv.label}`}"
                    class="w-2.5 h-2.5 rounded-full ${lv.dot} cursor-pointer transition-all ${isSel ? `opacity-100 ring-2 ring-offset-1 ring-offset-[#191919] ${lv.ring} scale-110` : 'opacity-30 hover:opacity-90'}"></button>`;
                }).join('')}
                ${composerPrio ? `<span class="text-[8.5px] font-medium ${ALERT_LEVELS[composerPrio].titleText}">${ALERT_LEVELS[composerPrio].label}</span>` : ''}
              </span>
            </div>
            <button type="submit" class="h-6 px-2.5 rounded-md bg-obsidian-elevated hover:bg-[#333333] border border-obsidian-borderActive text-[10px] font-medium text-[#D4D4D4] cursor-pointer">Enviar</button>
          </div>
        </form>
      ` : ''}
    </div>
  ` : '';

  let pinnedBannerHtml = '';
  if (pinnedItems.length === 1) {
    const { msg, idx, priority } = pinnedItems[0];
    const cfg = ALERT_LEVELS[priority];
    pinnedBannerHtml = `
      <div class="p-2 rounded-lg ${cfg.cardBg} border ${cfg.border} text-[10px] space-y-1 shadow-sm">
        <div class="flex items-center justify-between gap-1.5">
          <span class="inline-flex items-center gap-1.5 min-w-0">
            <span class="px-1.5 py-0.5 rounded-full ${cfg.badgeSoft} font-mono font-semibold text-[8.5px] shrink-0">1</span>
            <span class="font-semibold ${cfg.titleText} uppercase tracking-wider text-[8.5px] truncate">${cfg.label} · ${escapeHtml(msg.actor)}</span>
          </span>
          ${!isArchived ? `<button type="button" data-insp-clear-prio="${idx}" title="Quitar alerta" class="w-4 h-4 rounded ${cfg.closeHover} text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer leading-none shrink-0">×</button>` : ''}
        </div>
        <div class="text-[#D4D4D4] leading-snug whitespace-pre-wrap">${escapeHtml(msg.text)}</div>
      </div>
    `;
  } else if (pinnedItems.length > 1 && !sketchState.inspectorAlertsExpanded) {
    const top = pinnedItems[0];
    const cfg = ALERT_LEVELS[top.priority];
    const extraCount = pinnedItems.length - 1;
    pinnedBannerHtml = `
      <div class="relative ${pinnedItems.length >= 3 ? 'pb-3' : 'pb-2'}">
        ${pinnedItems.length >= 3 ? `<div class="absolute inset-x-3 bottom-0 h-3 rounded-b-lg border ${cfg.stackBack2} pointer-events-none"></div>` : ''}
        <div class="absolute inset-x-1.5 ${pinnedItems.length >= 3 ? 'bottom-1.5' : 'bottom-0.5'} h-3 rounded-b-lg border ${cfg.stackBack1} pointer-events-none"></div>
        <div data-insp-alerts-toggle class="relative z-10 p-2 rounded-lg ${cfg.cardBg} ${cfg.cardHover} border ${cfg.border} text-[10px] space-y-1 shadow-md cursor-pointer transition-colors">
          <div class="flex items-center justify-between gap-1.5">
            <span class="inline-flex items-center gap-1.5 min-w-0">
              <span class="px-1.5 py-0.5 rounded-full ${cfg.badge} font-mono font-bold text-[8.5px] shrink-0">${pinnedItems.length}</span>
              <span class="font-semibold ${cfg.titleText} uppercase tracking-wider text-[8.5px] truncate">${cfg.label} · ${escapeHtml(top.msg.actor)}</span>
            </span>
            <span class="text-[8.5px] ${cfg.subText} font-mono shrink-0">+${extraCount} ▾</span>
          </div>
          <div class="text-[#D4D4D4] leading-snug line-clamp-2">${escapeHtml(top.msg.text)}</div>
        </div>
      </div>
    `;
  } else if (pinnedItems.length > 1 && sketchState.inspectorAlertsExpanded) {
    const topCfg = ALERT_LEVELS[pinnedItems[0].priority];
    pinnedBannerHtml = `
      <div class="space-y-1.5">
        <div class="flex items-center justify-between px-0.5 text-[9px]">
          <span class="inline-flex items-center gap-1.5 font-semibold ${topCfg.titleText} uppercase tracking-wider">
            <span class="px-1.5 py-0.5 rounded-full ${topCfg.badge} font-mono font-bold text-[8.5px]">${pinnedItems.length}</span>
            <span>Alertas de esta OT</span>
          </span>
          <button type="button" data-insp-alerts-toggle class="text-[#8C8C8C] hover:text-[#D4D4D4] cursor-pointer font-mono text-[8.5px]">Apilar ▴</button>
        </div>
        <div class="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
          ${pinnedItems.map(({ msg, idx, priority }) => {
            const cfg = ALERT_LEVELS[priority];
            return `
              <div class="p-2 rounded-lg ${cfg.cardBg} border ${cfg.border} text-[10px] space-y-0.5">
                <div class="flex items-center justify-between gap-1.5">
                  <span class="inline-flex items-center gap-1.5 min-w-0">
                    <span class="w-1.5 h-1.5 rounded-full ${cfg.dot} shrink-0"></span>
                    <span class="font-medium ${cfg.titleText} text-[9px] truncate">${cfg.label} · ${escapeHtml(msg.actor)}</span>
                    <span class="font-mono text-[8.5px] text-[#8C8C8C] shrink-0">${escapeHtml(msg.at)}</span>
                  </span>
                  ${!isArchived ? `<button type="button" data-insp-clear-prio="${idx}" title="Quitar alerta" class="w-4 h-4 rounded ${cfg.closeHover} text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer leading-none shrink-0">×</button>` : ''}
                </div>
                <div class="text-[#D4D4D4] leading-snug whitespace-pre-wrap">${escapeHtml(msg.text)}</div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  mount.innerHTML = `
    <div class="space-y-2.5 text-[11px]">
      <!-- Cabecera del objeto inspeccionado -->
      <div class="space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[10px] font-semibold text-obsidian-amber px-1.5 py-0.5 rounded bg-[#191919] border border-obsidian-border">${escapeHtml(codeLabel)}</span>
          <span class="text-[10px] font-medium truncate" style="color:${escapeHtml(getStatusColor(statusVal))}">${escapeHtml(statusVal)}</span>
        </div>
        <div class="text-[11.5px] font-medium text-[#D4D4D4] leading-snug line-clamp-2">${escapeHtml(targetObj.title || ot.title || '')}</div>
        <div class="text-[10px] font-medium truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client || '')}</div>
      </div>

      ${pinnedBannerHtml}

      <!-- Pestañas: Detalle | Actividad | Mensajes -->
      <div class="grid grid-cols-3 gap-0.5 bg-[#191919] border border-obsidian-border rounded-lg p-0.5 text-[10px]">
        ${[
          ['detail', 'Detalle', null],
          ['activity', 'Actividad', logs.length],
          ['messages', 'Mensajes', msgs.length],
        ].map(([tabKey, lbl, cnt]) => {
          const isAct = activeTab === tabKey;
          return `
            <button type="button" data-insp-tab="${tabKey}"
              class="py-1 px-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 ${isAct ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">
              <span>${lbl}</span>
              ${cnt !== null && cnt > 0 ? `<span class="font-mono text-[8.5px] ${isAct ? 'text-obsidian-amber' : 'text-[#737373]'}">${cnt}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>

      ${detailHtml}
      ${activityHtml}
      ${messagesHtml}
    </div>
  `;

  const rerenderSelf = () => renderTabbedInspector({
    ot,
    task,
    taskIndex,
    activePiece,
    selectedPieceCount,
    activeRoute,
    activeRouteIndex,
    showOpenButton,
    preserveCalendar,
    focusNotes: false,
    onRerender,
    onOpenOt,
    onJumpStripboard,
  });

  mount.querySelector('#insp-route-clear')?.addEventListener('click', () => {
    sketchState.activeRouteIndex = null;
    if (typeof onRerender === 'function') onRerender();
    else rerenderSelf();
  });

  const routeNotesEl = mount.querySelector('#insp-route-notes');
  if (routeNotesEl && activeRoute && !isArchived && !activeRoute.locked) {
    routeNotesEl.addEventListener('input', (e) => {
      activeRoute.notes = e.target.value;
    });
  }

  // --- Bind Tab Switcher ---
  mount.querySelectorAll('[data-insp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.inspectorTab = btn.dataset.inspTab;
      rerenderSelf();
    });
  });

  // --- Bind Detalle actions ---
  const notesEl = mount.querySelector('#insp-traffic-notes');
  if (notesEl && !isArchived) {
    notesEl.addEventListener('input', (e) => {
      targetObj.notes = e.target.value;
    });
    if (focusNotes) {
      notesEl.focus();
      notesEl.setSelectionRange(notesEl.value.length, notesEl.value.length);
    }
  }

  mount.querySelector('#insp-delivery-time')?.addEventListener('change', (e) => {
    const nextTime = e.target.value;
    if (!nextTime) return;
    const curIso = String(targetObj.deliveryDate || ot.deliveryDate || '').slice(0, 10);
    if (rescheduleDeliveryDate(ot.id, hasTask ? taskIndex : '', curIso, nextTime)) {
      rerenderSelf();
    }
  });

  mount.querySelector('#insp-traffic-open-ot')?.addEventListener('click', () => {
    if (typeof onOpenOt === 'function') {
      onOpenOt(ot.id, hasTask ? taskIndex : '');
    } else {
      notifySketchChange('open-ot', { otId: ot.id, taskIndex: hasTask ? Number(taskIndex) : null, scope: 'active' });
    }
  });

  mount.querySelector('#insp-restore-ot')?.addEventListener('click', () => {
    ot.archived = false;
    ot.status = 'En proceso';
    notifySketchChange('orders');
    rerenderSelf();
  });

  if (hasTask && !isArchived) {
    const taskUid = `${ot.id}::${taskIndex}`;
    const hrsInput = mount.querySelector('#insp-task-hours');
    const dateInput = mount.querySelector('#insp-task-date');

    hrsInput?.addEventListener('input', (e) => {
      const val = Math.max(0, Number(e.target.value) || 0);
      task.estimatedHours = val;
      const curDate = (task.scheduledDate || task.deliveryDate || ot.deliveryDate || '').slice(0, 10);
      ensureStripboardDaySeeded(curDate);
      const nextReserved = getDayReservedHours(curDate);
      const curDaily = Number(studioSettings.dailyHours) || 8;
      const over = nextReserved > curDaily;
      const box = mount.querySelector('#insp-capacity-box');
      const valEl = mount.querySelector('#insp-capacity-val');
      const barEl = mount.querySelector('#insp-capacity-bar');
      const noteEl = mount.querySelector('#insp-capacity-note');

      if (box) box.className = `p-2 rounded-lg border ${over ? 'bg-rose-500/10 border-rose-500/40' : 'bg-[#191919] border-obsidian-border'} space-y-1`;
      if (valEl) {
        valEl.className = `font-mono font-semibold ${over ? 'text-rose-300' : 'text-[#D4D4D4]'}`;
        valEl.textContent = `${nextReserved}h / ${curDaily}h`;
      }
      if (barEl) {
        barEl.className = `h-full ${over ? 'bg-rose-400' : 'bg-obsidian-amber'} transition-all`;
        barEl.style.width = `${Math.min(100, Math.round((nextReserved / curDaily) * 100))}%`;
      }
      if (noteEl) {
        noteEl.className = `text-[9.5px] ${over ? 'text-rose-300' : 'text-[#8C8C8C]'}`;
        noteEl.textContent = over
          ? `Sobrecarga de ${(nextReserved - curDaily).toFixed(1).replace(/\.0$/, '')}h.`
          : `Disponible: ${(curDaily - nextReserved).toFixed(1).replace(/\.0$/, '')}h libres.`;
      }
      notifySketchChange('stripboard');
    });

    dateInput?.addEventListener('change', (e) => {
      if (!e.target.value) return;
      moveTaskToScheduledDate(taskUid, e.target.value);
      if (typeof onRerender === 'function') onRerender();
      notifySketchChange('stripboard');
    });

    const jumpToStripboard = (mode) => {
      sketchState.stripboardDate = (task.scheduledDate || task.deliveryDate || ot.deliveryDate || '').slice(0, 10) || sketchState.stripboardDate;
      sketchState.stripboardViewMode = mode;
      if (typeof onJumpStripboard === 'function') {
        onJumpStripboard(mode);
      } else {
        document.getElementById('view-my-ots')?.classList.add('hidden');
        document.getElementById('view-stripboard')?.classList.remove('hidden');
        document.getElementById('left-envelope-tree')?.classList.add('hidden');
        document.getElementById('left-traffic-tree')?.classList.remove('hidden');
        const titleEl = document.getElementById('center-page-title');
        if (titleEl) titleEl.textContent = 'Mis Tareas';
        notifySketchChange('stripboard');
      }
    };

    mount.querySelector('#insp-go-sb-day')?.addEventListener('click', () => jumpToStripboard('day'));
    mount.querySelector('#insp-go-sb-week')?.addEventListener('click', () => jumpToStripboard('week'));
  }

  // --- Bind Alert Stack Expand/Collapse, Semaphore Priority & Mensajes form ---
  if (!showOpenButton) {
    if (selectedPieceCount > 1) {
      const targetMedia = hasTask ? task.mediaFiles : ot.mediaFiles;
      bindBatchFileEvents(mount, {
        piecesList: targetMedia || [],
        ot,
        onDeleteSelected: () => {
          if (hasTask && Array.isArray(task.mediaFiles)) {
            task.mediaFiles = task.mediaFiles.filter((p) => !sketchState.selectedPieces.has(p.name));
          } else if (Array.isArray(ot.mediaFiles)) {
            ot.mediaFiles = ot.mediaFiles.filter((p) => !sketchState.selectedPieces.has(p.name));
          }
        },
        onRerender: onRerender || rerenderSelf,
      });
    } else if (activePiece) {
      bindFileInspectorEvents(mount, activePiece, { ot, onRerender: onRerender || rerenderSelf });
    }
  }

  mount.querySelectorAll('[data-insp-alerts-toggle]').forEach((el) => {
    el.addEventListener('click', () => {
      sketchState.inspectorAlertsExpanded = !sketchState.inspectorAlertsExpanded;
      rerenderSelf();
    });
  });

  mount.querySelectorAll('[data-insp-clear-prio]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.inspClearPrio);
      if (Number.isNaN(idx) || !msgs[idx]) return;
      msgs[idx].priority = null;
      msgs[idx].pinned = false;
      rerenderSelf();
    });
  });

  mount.querySelectorAll('[data-insp-msg-prio]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const [idxStr, prio] = String(btn.dataset.inspMsgPrio || '').split(':');
      const idx = Number(idxStr);
      if (Number.isNaN(idx) || !msgs[idx] || !ALERT_LEVELS[prio]) return;
      const cur = getMsgPriority(msgs[idx]);
      const next = cur === prio ? null : prio;
      msgs[idx].priority = next;
      msgs[idx].pinned = !!next;
      rerenderSelf();
    });
  });

  mount.querySelectorAll('[data-insp-composer-prio]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const prio = btn.dataset.inspComposerPrio;
      const draft = mount.querySelector('#insp-msg-input')?.value || '';
      const waChecked = !!mount.querySelector('#insp-msg-wa')?.checked;
      sketchState.inspectorComposerPriority = sketchState.inspectorComposerPriority === prio ? null : prio;
      rerenderSelf();
      const nextInput = mount.querySelector('#insp-msg-input');
      const nextWa = mount.querySelector('#insp-msg-wa');
      if (nextInput) {
        nextInput.value = draft;
        nextInput.focus();
      }
      if (nextWa) nextWa.checked = waChecked;
    });
  });

  mount.querySelector('#insp-msg-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = mount.querySelector('#insp-msg-input');
    const waCheck = mount.querySelector('#insp-msg-wa');
    const text = input?.value.trim();
    if (!text) return;
    appendOtMessage(targetObj, {
      text,
      channel: waCheck?.checked ? 'WhatsApp' : 'App',
      actor: sketchState.myOtsMember || 'Andrés',
      priority: sketchState.inspectorComposerPriority,
    });
    sketchState.inspectorComposerPriority = null;
    rerenderSelf();
  });
}

/**
 * Wrapper used by Detalle de OT (ot-detail.js).
 */
export function renderOtInspectorPanel(
  activeOt,
  inspTask,
  { activePiece = null, selectedPieceCount = 0, activeRoute = null, activeRouteIndex = null, onRerender, onJumpStripboard } = {}
) {
  renderTabbedInspector({
    ot: activeOt,
    task: inspTask || null,
    taskIndex: inspTask ? sketchState.activeTaskIndex : null,
    activePiece,
    selectedPieceCount,
    activeRoute,
    activeRouteIndex,
    showOpenButton: false,
    preserveCalendar: false,
    onRerender,
    onJumpStripboard,
  });
}

/**
 * Clear the Inspector panel to a neutral placeholder (used by Nueva OT and Ajustes).
 */
export function clearInspectorPanel(message = 'Selecciona una OT, tarea o archivo para inspeccionarlo.') {
  const rightBody = document.getElementById('right-body');
  if (!rightBody) return;
  rightBody.innerHTML = `<div class="text-[10.5px] text-[#8C8C8C] py-3 leading-relaxed">${escapeHtml(message)}</div>`;
}

/**
 * Standalone File Inspector used by Archivo (Galería, Documentos, Desarrollo).
 */
export function renderStandaloneFileInspector(
  piece,
  { selectedCount = 0, piecesList = [], onDeleteSelected = null, onRerender = null } = {}
) {
  const mount = getInspectorTargetMount(false);
  if (!mount) return;
  if (!piece && selectedCount <= 1) {
    mount.innerHTML = '<div class="text-[10.5px] text-[#8C8C8C] py-3">Selecciona un archivo para inspeccionarlo.</div>';
    return;
  }
  const linkedOt = piece?.otId ? trafficOrders.find((o) => o.id === piece.otId) : null;
  mount.innerHTML = `
    <div class="text-[11px]">
      ${renderFileInspectorBlockHtml(piece, {
        isArchived: !!linkedOt?.archived,
        standalone: true,
        selectedCount,
      })}
    </div>
  `;
  if (selectedCount > 1) {
    bindBatchFileEvents(mount, { piecesList, ot: linkedOt, onDeleteSelected, onRerender });
  } else if (piece) {
    bindFileInspectorEvents(mount, piece, { ot: linkedOt, onRerender });
  }
}

/**
 * Wrapper used by Tráfico and Escritorio.
 */
export function renderTrafficNotesInspector(otId, taskIdx = '', focusNotes = false, { onOpenOt } = {}) {
  const ot = trafficOrders.find((o) => o.id === otId);
  if (!ot) return;
  const hasTask = taskIdx !== '' && taskIdx !== undefined && taskIdx !== null && ot.subtasks?.[Number(taskIdx)];
  renderTabbedInspector({
    ot,
    task: hasTask ? ot.subtasks[Number(taskIdx)] : null,
    taskIndex: hasTask ? Number(taskIdx) : null,
    showOpenButton: true,
    preserveCalendar: true,
    focusNotes,
    onOpenOt,
  });
}
