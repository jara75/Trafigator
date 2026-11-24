/**
 * Renderizado puro de tarjetas/fichas del Tablero de Corcho (C04) y helpers visuales:
 * - buildSnapshotSummary / buildPinnedChartBoard: render vivo de fichas GRÁFICO con filtersSnapshot inmutable
 * - renderCorkPinCard: fichas chart, ot/task, note, link y file (solo atributos data-*, sin handlers)
 */

import {
  escapeHtml,
  formatShortDate,
  getClientColor,
  getPriorityDotHtml,
} from './store.js';
import { renderStatsPillChartsGrid } from './ot-en-proceso-charts.js';
import { getFileTypeTag } from './desktop-corkboard-store.js';

export function buildSnapshotSummary(chartMeta) {
  if (!chartMeta) return '';
  const snap = chartMeta.filtersSnapshot || {};
  const anchors = snap.anchors || chartMeta.anchors || {};
  const parts = [];
  const metricLabel = snap.metric === 'ots' ? 'OTs' : (snap.metric === 'tasks' ? 'Tareas' : 'Horas');
  parts.push(metricLabel);
  if (snap.activeWsId && snap.activeWsId !== 'studio') parts.push(`Perfil: ${snap.activeWsId}`);
  Object.entries(anchors).forEach(([k, v]) => {
    if (v && v !== 'all') parts.push(`${k}: ${v}`);
  });
  return parts.join(' · ');
}

export function buildPinnedChartBoard(chartMeta, {
  trafficOrders = [],
  todayKey = '',
  tomorrowKey = '',
  dailyHours = 8,
  canSeeFinancial = false,
  myMember = '',
} = {}) {
  if (!chartMeta || typeof chartMeta !== 'object') return null;
  const snap = chartMeta.filtersSnapshot || {};
  const snapWsId = snap.activeWsId || 'studio';
  const snapPersonal = Boolean(snap.isPersonalScope);
  const snapMember = snap.myMember || myMember || '';
  const workspaceOrders = (trafficOrders || []).filter((o) => {
    if (o.archived) return false;
    if (snapWsId !== 'studio' && (o.workspaceId || 'diseno-publicidad') !== snapWsId) return false;
    return true;
  });
  const snapScopedOrders = snapPersonal
    ? workspaceOrders.filter((o) => o.responsible === snapMember || (o.subtasks || []).some((st) => (st.responsible || o.responsible) === snapMember))
    : workspaceOrders;
  const board = renderStatsPillChartsGrid({
    pillId: snap.pillId || chartMeta.pillId || 'ots-active',
    allOrders: trafficOrders,
    scopedOrders: snapScopedOrders,
    anchors: snap.anchors || chartMeta.anchors || {},
    metric: snap.metric || chartMeta.metric || 'hours',
    todayKey,
    tomorrowKey,
    dailyHours: Number(dailyHours) || 8,
    activeWsId: snapWsId,
    deptPageWsId: snap.deptPageWsId || null,
    isPersonalScope: snapPersonal,
    myMember: snapMember,
    canSeeFinancial: Boolean(canSeeFinancial),
  });
  const idx = Number.isInteger(chartMeta.chartIdx) ? chartMeta.chartIdx : 0;
  const card = Array.isArray(board?.cards) ? (board.cards[idx] || board.cards[0] || null) : null;
  if (!card) return null;
  return {
    board,
    card,
    chartIdx: Array.isArray(board.cards) && board.cards[idx] ? idx : 0,
    summary: buildSnapshotSummary(chartMeta),
  };
}

export function renderCorkPinCard(pin, idx, {
  canEdit,
  trafficOrders = [],
  todayKey = '',
  tomorrowKey = '',
  dailyHours = 8,
  canSeeFinancial = false,
  myMember = '',
}) {
  const notesCount = Array.isArray(pin.highlights) ? pin.highlights.length : 0;
  const unpinBtn = canEdit
    ? `<button type="button" data-cork-unpin="${escapeHtml(pin.id)}" title="Quitar del Corcho" aria-label="Quitar ${escapeHtml(pin.title || 'ficha')} del Corcho"
         class="opacity-0 group-hover:opacity-100 focus:opacity-100 w-5 h-5 rounded text-[#737373] hover:text-rose-400 hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0">
         <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
       </button>`
    : '';

  const dragAttr = `draggable="${canEdit ? 'true' : 'false'}" data-cork-card-id="${escapeHtml(pin.id)}"`;
  const dragCursorCls = canEdit ? 'cursor-grab active:cursor-grabbing' : '';

  if (pin.type === 'chart') {
    const resolved = buildPinnedChartBoard(pin.chartMeta, {
      trafficOrders,
      todayKey,
      tomorrowKey,
      dailyHours,
      canSeeFinancial,
      myMember,
    });
    const chartTitle = resolved?.card?.title || pin.chartMeta?.title || pin.title || 'Gráfico';
    const boardTitle = resolved?.board?.title || pin.chartMeta?.boardTitle || '';
    const summary = resolved?.summary || buildSnapshotSummary(pin.chartMeta);
    const miniChartHtml = resolved?.card?.body
      ? `<div class="max-h-24 overflow-hidden pointer-events-none select-none rounded bg-[#141414] border border-obsidian-border/70 p-2">${resolved.card.body}</div>`
      : `<div class="h-14 rounded bg-[#141414] border border-obsidian-border/70 flex items-center justify-center font-mono text-[9px] text-[#5A5A5A]">Vista de gráfico</div>`;
    return `
      <article ${dragAttr} data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}" data-cork-open-pinned-chart="${escapeHtml(pin.id)}" role="button" tabindex="0"
        title="Abrir gráfico ampliado con filtros fijados"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-cyan-500/50 flex flex-col justify-between gap-1.5 min-w-0 cursor-pointer transition-colors">
        <div class="space-y-1.5 min-w-0">
          <div class="flex items-center justify-between gap-1.5">
            <span class="font-mono text-[8.5px] uppercase tracking-wider text-violet-400 font-semibold">GRÁFICO</span>
            ${unpinBtn}
          </div>
          <h4 class="text-[10.5px] font-medium text-[#D4D4D4] leading-snug truncate" title="${escapeHtml(chartTitle)}">${escapeHtml(chartTitle)}</h4>
          ${miniChartHtml}
        </div>
        <div class="flex items-center justify-between gap-1.5 text-[8.5px] font-mono text-[#5A5A5A] pt-1 border-t border-obsidian-border/50 min-w-0">
          <span class="truncate" title="${escapeHtml(summary || boardTitle)}">${escapeHtml(summary || boardTitle || 'Vivo')}</span>
          <span class="text-cyan-400/80 shrink-0">Ampliar ↗</span>
        </div>
      </article>
    `;
  }

  if (pin.type === 'ot' || pin.type === 'task') {
    const isTask = pin.type === 'task';
    const liveOt = (trafficOrders || []).find((o) => o.id === pin.otId) || null;
    const liveTask = isTask && liveOt && Number.isInteger(pin.taskIndex)
      ? ((liveOt.subtasks || [])[pin.taskIndex] || null)
      : null;
    const shortBase = String(pin.otId || '').replace(/^OT-/i, '');
    const codeLabel = isTask && Number.isInteger(pin.taskIndex) ? `${shortBase}.${pin.taskIndex + 1}` : shortBase;
    const title = isTask
      ? (liveTask?.title || pin.title || liveOt?.title || 'Tarea')
      : (liveOt?.title || pin.title || 'Orden de Trabajo');
    const client = liveOt?.client || '';
    const deliveryDate = isTask ? (liveTask?.deliveryDate || liveOt?.deliveryDate || '') : (liveOt?.deliveryDate || '');
    const urgent = Boolean(isTask ? (liveTask?.urgent || liveOt?.urgent) : liveOt?.urgent);
    const priorityDot = getPriorityDotHtml({ urgent, deliveryDate }, todayKey, tomorrowKey, 'w-1.5 h-1.5');
    const cColor = getClientColor(client);
    const taskAttr = isTask && Number.isInteger(pin.taskIndex) ? `data-cork-open-task-idx="${pin.taskIndex}"` : '';

    return `
      <article ${dragAttr} data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 ${dragCursorCls} transition-colors">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center justify-between gap-1.5">
            <div class="inline-flex items-center gap-1.5 min-w-0">
              ${priorityDot}
              <span class="font-mono text-[8.5px] uppercase tracking-wider text-[#8C8C8C] font-semibold shrink-0">${isTask ? 'TAREA' : 'OT'}</span>
              <button type="button" data-cork-open-ot="${escapeHtml(pin.otId || '')}" ${taskAttr} title="Abrir ${isTask ? 'Tarea' : 'OT'}"
                class="font-mono text-[9.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer truncate">${escapeHtml(codeLabel || '—')}</button>
            </div>
            ${unpinBtn}
          </div>
          <h4 class="text-[10.5px] font-medium text-[#D4D4D4] leading-snug line-clamp-2" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
        </div>
        <div class="flex items-center justify-between gap-1.5 text-[8.5px] pt-1 border-t border-obsidian-border/50 min-w-0">
          <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(client || (liveOt ? 'Estudio' : 'Referencia'))}</span>
          <span class="font-mono text-[#737373] shrink-0">${escapeHtml(formatShortDate(deliveryDate) || '—')}</span>
        </div>
      </article>
    `;
  }

  if (pin.type === 'note') {
    const excerpt = String(pin.content || '').trim();
    return `
      <article ${dragAttr} data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 ${dragCursorCls} transition-colors">
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
      <article ${dragAttr} data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
        class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 ${dragCursorCls} transition-colors">
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
    <article ${dragAttr} data-cork-pin-id="${escapeHtml(pin.id)}" data-cork-card-idx="${idx}"
      class="group p-2.5 rounded-lg bg-[#202020] hover:bg-[#252525] border border-obsidian-border hover:border-[#3a3a3a] flex flex-col justify-between gap-1.5 min-w-0 ${dragCursorCls} transition-colors">
      <div class="space-y-1.5 min-w-0">
        <div class="flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="font-mono text-[8.5px] uppercase tracking-wider font-semibold ${tagColorCls}">${tag}</span>
            ${shortOt
              ? `<button type="button" data-cork-open-ot="${escapeHtml(pin.otId)}" title="Abrir OT ${escapeHtml(shortOt)}"
                   class="font-mono text-[8.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer truncate">${escapeHtml(shortOt)}</button>`
              : ''}
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
