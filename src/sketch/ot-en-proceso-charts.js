/**
 * Grilla de 8 gráficos simultáneos para las 8 pastillas de Estadística:
 * - ots-active     : OTs Activas / En Proceso
 * - ots-urgent     : OTs Urgentes
 * - tasks-active   : Tareas Activas
 * - tasks-urgent   : Tareas Urgentes
 * - client-review  : En Cliente
 * - finalizadas    : Finalizadas (Por Facturar / Facturadas / Pagadas)
 * - today-hours    : Mi Jornada Hoy
 * - tomorrow-hours : Mañana
 */

import {
  escapeHtml,
  getActiveWorkspaces,
  getDepartmentColor,
  getStageColor,
  getWorkspaceById,
  shiftIsoDate,
  studioFreeTasks,
  studioSeparators,
} from './store.js';
import { matchesTimeFilter } from './stats-engine.js';

const OT_STAGE_FLOW = [
  'Tráfico',
  'Recibida',
  'Cerrar OT y Facturar',
  'Facturada',
  'Pagada',
];

const TASK_STAGE_FLOW = ['Tráfico', 'Recibida'];
const FINANCIAL_STAGES = new Set(['Cerrar OT y Facturar', 'Facturada', 'Pagada']);

function computeOtLeafHours(ot) {
  const subtasks = Array.isArray(ot.subtasks) ? ot.subtasks : [];
  if (subtasks.length > 0) {
    return subtasks.reduce((sum, st) => {
      const stStatus = st.status || ot.status || 'En proceso';
      if (['Cancelada', 'Suspendida', 'Terminada', 'Archivada'].includes(stStatus)) return sum;
      return sum + (Number(st.estimatedHours) || 0);
    }, 0);
  }
  return Number(ot.estimatedHours) || 0;
}

function renderCardShell(num, idx, title, subtitle, bodyHtml) {
  return `
    <div role="button" tabindex="0" data-dk-chart-zoom="${idx}" title="Abrir en caja de luz"
      class="bg-[#1b1b1b] hover:bg-[#1f1f1f] border border-obsidian-border/80 hover:border-obsidian-amber/60 rounded-lg p-3 flex flex-col cursor-pointer transition-colors group">
      <div class="flex items-center justify-between gap-2 pb-1.5 mb-2.5 border-b border-obsidian-border/60">
        <div class="flex items-center gap-1.5 min-w-0">
          <span class="font-mono text-[8.5px] text-[#5A5A5A] shrink-0">0${num}</span>
          <span class="font-mono text-[9.5px] text-[#D4D4D4] uppercase tracking-wider font-semibold truncate">${escapeHtml(title)}</span>
        </div>
        <div class="flex items-center gap-1.5 shrink-0">
          ${subtitle ? `<span class="font-mono text-[8px] text-[#737373]">${escapeHtml(subtitle)}</span>` : ''}
          <svg class="w-3 h-3 text-[#4A4A4A] group-hover:text-obsidian-amber transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
            <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
        </div>
      </div>
      <div class="flex flex-col">
        ${bodyHtml}
      </div>
    </div>
  `;
}

function renderHorizontalBars(rows, { maxVal, unit = '', barGradient = 'linear-gradient(90deg, #1a72e8 0%, #00d1ff 100%)', targetVal = null, useRowColor = false, large = false } = {}) {
  if (!rows.length) {
    return `<div class="${large ? 'py-12 text-[11px]' : 'py-4 text-[9px]'} text-center font-mono text-[#5A5A5A]">Sin datos</div>`;
  }
  const safeMax = Math.max(1, maxVal || Math.max(...rows.map((r) => r.value), targetVal || 0));
  const total = rows.reduce((s, r) => s + r.value, 0);
  const targetPct = targetVal !== null && targetVal > 0 ? Math.min(96, Math.round((targetVal / safeMax) * 100)) : null;

  return `
    <div class="relative flex flex-col ${large ? 'gap-3' : 'gap-2'}">
      ${rows.map((row) => {
        const pct = row.value > 0 ? Math.max(5, Math.min(100, Math.round((row.value / safeMax) * 100))) : 0;
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const fillStyle = useRowColor && row.color
          ? `background:${escapeHtml(row.color)};`
          : `background:${barGradient};`;
        const valStr = `${row.value}${unit}`;
        const drillAttr = row.drillKey ? `data-dk-chart-drill="${escapeHtml(row.drillKey)}"` : '';
        return `
          <div ${drillAttr} class="flex items-center ${large ? 'gap-3 py-0.5' : 'gap-2'} min-w-0 ${row.drillKey ? 'cursor-pointer hover:bg-[#252525]/80 rounded px-1 -mx-1 transition-colors' : ''}" title="${escapeHtml(`${row.label}: ${valStr} (${share}%)${row.extra ? ` · ${row.extra}` : ''} — Clic para ver en Inspector`)}">
            <span class="${large ? 'w-[130px] text-[12px]' : 'w-[78px] text-[10px]'} shrink-0 text-[#C4C4C4] truncate">${escapeHtml(row.label)}</span>
            <div class="flex-1 ${large ? 'h-6 rounded-md' : 'h-4 rounded'} bg-[#242424] relative flex items-center overflow-hidden">
              ${targetPct !== null ? `<div class="pointer-events-none absolute inset-y-0 border-l${large ? '-2' : ''} border-dashed border-obsidian-amber/85 z-10" style="left:${targetPct}%"></div>` : ''}
              ${pct > 0 ? `
                <div class="h-full ${large ? 'rounded-md pr-2' : 'rounded'} flex items-center justify-end transition-all" style="width:${pct}%; ${fillStyle}">
                  ${large && pct >= 22 ? `<span class="font-mono text-[10px] font-bold text-white/95 leading-none">${share}%</span>` : ''}
                </div>
              ` : ''}
              <span class="font-mono ${large ? 'text-[11px]' : 'text-[9px]'} font-semibold text-white leading-none whitespace-nowrap ${pct > 76 ? 'absolute right-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]' : 'pl-2'}">${escapeHtml(valStr)}${large && row.extra ? ` <span class="text-[#8C8C8C] font-normal">· ${escapeHtml(row.extra)}</span>` : ''}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderSlimMixBars(rows, { unit = '', large = false } = {}) {
  if (!rows.length) {
    return `<div class="${large ? 'py-12 text-[11px]' : 'py-4 text-[9px]'} text-center font-mono text-[#5A5A5A]">Sin datos</div>`;
  }
  const total = rows.reduce((s, r) => s + r.value, 0);

  return `
    <div class="flex flex-col ${large ? 'gap-3.5' : 'gap-2.5'}">
      ${rows.map((row) => {
        const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
        const color = row.color || '#38bdf8';
        const valStr = `${row.value}${unit}`;
        const drillAttr = row.drillKey ? `data-dk-chart-drill="${escapeHtml(row.drillKey)}"` : '';
        return `
          <div ${drillAttr} class="flex flex-col ${large ? 'gap-1.5 py-0.5' : 'gap-1'} min-w-0 ${row.drillKey ? 'cursor-pointer hover:bg-[#252525]/80 rounded px-1 -mx-1 transition-colors' : ''}" title="${escapeHtml(`${row.label}: ${share}% (${valStr}) — Clic para ver en Inspector`)}">
            <div class="flex items-center justify-between gap-2 leading-none">
              <span class="${large ? 'text-[12.5px]' : 'text-[10px]'} text-[#D4D4D4] truncate">${escapeHtml(row.label)}</span>
              <span class="font-mono ${large ? 'text-[11.5px]' : 'text-[9.5px]'} font-semibold shrink-0" style="color:${escapeHtml(color)}">${share}% <span class="opacity-85">(${escapeHtml(valStr)})</span></span>
            </div>
            <div class="w-full ${large ? 'h-2' : 'h-1.5'} rounded-full bg-[#242424] overflow-hidden">
              <div class="h-full rounded-full transition-all" style="width:${Math.max(3, share)}%; background:${escapeHtml(color)};"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDonutChart(segments, centerTop, centerBottom, { large = false } = {}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (!total) {
    return `<div class="${large ? 'py-12 text-[11px]' : 'py-4 text-[9px]'} text-center font-mono text-[#5A5A5A]">Sin datos</div>`;
  }
  const radius = 38;
  const circ = 2 * Math.PI * radius;
  const segGap = segments.length > 1 ? 1.8 : 0;
  let offset = 0;

  const arcs = segments.map((seg) => {
    const frac = seg.value / total;
    const rawLen = frac * circ;
    const drawLen = Math.max(0.5, rawLen - segGap);
    const dash = `${drawLen.toFixed(2)} ${(circ - drawLen).toFixed(2)}`;
    const curOffset = offset;
    offset += rawLen;
    return `<circle cx="50" cy="50" r="${radius}" fill="none" stroke="${escapeHtml(seg.color)}" stroke-width="${large ? '12' : '11'}" stroke-dasharray="${dash}" stroke-dashoffset="${(-curOffset).toFixed(2)}" />`;
  }).join('');

  return `
    <div class="flex items-center ${large ? 'justify-center gap-10 py-4' : 'gap-3.5 py-1'}">
      <div class="relative ${large ? 'w-[196px] h-[196px]' : 'w-[92px] h-[92px]'} shrink-0">
        <svg viewBox="0 0 100 100" class="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#252525" stroke-width="${large ? '12' : '11'}" />
          ${arcs}
        </svg>
        <div class="absolute inset-0 flex flex-col items-center justify-center text-center leading-none">
          <span class="font-mono ${large ? 'text-[26px]' : 'text-[15px]'} font-bold text-white">${escapeHtml(String(centerTop))}</span>
          ${centerBottom ? `<span class="font-mono ${large ? 'text-[10.5px] mt-1' : 'text-[8px] mt-0.5'} text-[#8C8C8C]">${escapeHtml(centerBottom)}</span>` : ''}
        </div>
      </div>
      <div class="flex-1 ${large ? 'max-w-[260px] gap-3' : 'gap-1.5'} min-w-0 flex flex-col">
        ${segments.slice(0, 8).map((seg) => {
          const pct = Math.round((seg.value / total) * 100);
          const drillAttr = seg.drillKey ? `data-dk-chart-drill="${escapeHtml(seg.drillKey)}"` : '';
          return `
            <div ${drillAttr} class="flex items-center justify-between gap-2 ${large ? 'text-[12.5px] py-0.5' : 'text-[10px]'} min-w-0 ${seg.drillKey ? 'cursor-pointer hover:bg-[#252525]/80 rounded px-1 -mx-1 transition-colors' : ''}" title="${escapeHtml(`${seg.label}: ${seg.value} (${pct}%) — Clic para ver en Inspector`)}">
              <span class="inline-flex items-center gap-2 min-w-0">
                <span class="${large ? 'w-3 h-3' : 'w-2 h-2'} rounded-[2px] shrink-0" style="background:${escapeHtml(seg.color)}"></span>
                <span class="text-[#C4C4C4] truncate">${escapeHtml(seg.label)}</span>
              </span>
              <span class="font-mono ${large ? 'text-[12px]' : 'text-[9.5px]'} text-[#E5E5E5] shrink-0">${seg.value} <span class="text-[#737373]">${pct}%</span></span>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderVerticalColumns(buckets, unit = '', { large = false } = {}) {
  const maxVal = Math.max(1, ...buckets.map((b) => b.value));
  return `
    <div class="${large ? 'h-[240px] gap-5 pt-4 px-4' : 'h-[116px] gap-2 pt-2 px-1'} flex items-end justify-between">
      ${buckets.map((b) => {
        const hPct = b.value > 0 ? Math.max(10, Math.round((b.value / maxVal) * 100)) : 0;
        const drillAttr = b.drillKey && b.value > 0 ? `data-dk-chart-drill="${escapeHtml(b.drillKey)}"` : '';
        return `
          <div ${drillAttr} class="flex-1 min-w-0 h-full flex flex-col items-center justify-end ${large ? 'gap-2.5' : 'gap-1.5'} ${drillAttr ? 'cursor-pointer hover:bg-[#252525]/70 rounded px-0.5 transition-colors' : ''}" title="${escapeHtml(`${b.label}: ${b.value}${unit}${drillAttr ? ' — Clic para ver en Inspector' : ''}`)}">
            <span class="font-mono ${large ? 'text-[13px]' : 'text-[9.5px]'} font-bold ${b.value > 0 ? 'text-white' : 'text-[#4A4A4A]'} leading-none">${b.value}${unit}</span>
            <div class="w-full flex-1 flex items-end justify-center min-h-[30px]">
              <div class="w-full ${large ? 'max-w-[58px] rounded-t-md' : 'max-w-[30px] rounded-t'} transition-all" style="height:${hPct}%; background:${escapeHtml(b.color)}; opacity:${b.value > 0 ? '1' : '0.18'};"></div>
            </div>
            <span class="font-mono ${large ? 'text-[11px]' : 'text-[8.5px]'} text-[#A3A3A3] truncate max-w-full leading-none">${escapeHtml(large ? b.label : b.shortLabel)}</span>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderTimelineArea(points, strokeColor = '#00d1ff', unit = '', { large = false } = {}) {
  if (!points.length) {
    return `<div class="${large ? 'py-12 text-[11px]' : 'py-4 text-[9px]'} text-center font-mono text-[#5A5A5A]">Sin fechas registradas</div>`;
  }
  const w = large ? 480 : 240;
  const h = large ? 200 : 104;
  const padX = large ? 28 : 16;
  const padTop = large ? 28 : 18;
  const padBot = large ? 28 : 18;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBot;
  const maxVal = Math.max(1, ...points.map((p) => p.value));
  const gradId = large ? 'stPillAreaGradLg' : 'stPillAreaGrad';

  const coords = points.map((p, i) => {
    const x = points.length === 1 ? padX + innerW / 2 : padX + (i / (points.length - 1)) * innerW;
    const y = padTop + innerH - (p.value / maxVal) * innerH;
    return { ...p, x, y };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  return `
    <div class="${large ? 'h-[230px]' : 'h-[112px]'} flex flex-col justify-center">
      <svg viewBox="0 0 ${w} ${h}" class="w-full h-full" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${escapeHtml(strokeColor)}" stop-opacity="0.32" />
            <stop offset="100%" stop-color="${escapeHtml(strokeColor)}" stop-opacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="${padX}" y1="${padTop + innerH}" x2="${w - padX}" y2="${padTop + innerH}" stroke="#2c2c2c" stroke-width="1" />
        <line x1="${padX}" y1="${padTop + innerH / 2}" x2="${w - padX}" y2="${padTop + innerH / 2}" stroke="#252525" stroke-width="1" stroke-dasharray="3 3" />
        ${coords.length > 1 ? `<path d="${areaPath}" fill="url(#${gradId})" />` : ''}
        ${coords.length > 1 ? `<path d="${linePath}" fill="none" stroke="${escapeHtml(strokeColor)}" stroke-width="${large ? '2.4' : '1.8'}" stroke-linecap="round" stroke-linejoin="round" />` : ''}
        ${coords.map((c) => `
          <circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${large ? '4' : '2.8'}" fill="#1b1b1b" stroke="${escapeHtml(strokeColor)}" stroke-width="${large ? '2' : '1.6'}">
            <title>${escapeHtml(`${c.label}: ${c.value}${unit}`)}</title>
          </circle>
          <text x="${c.x.toFixed(1)}" y="${Math.max(14, c.y - (large ? 10 : 6)).toFixed(1)}" text-anchor="middle" fill="#D4D4D4" font-size="${large ? '11' : '8.5'}" font-family="monospace" font-weight="600">${c.value}${unit}</text>
          <text x="${c.x.toFixed(1)}" y="${(h - (large ? 6 : 3)).toFixed(1)}" text-anchor="middle" fill="#8C8C8C" font-size="${large ? '10.5' : '8'}" font-family="monospace">${escapeHtml(c.shortLabel)}</text>
        `).join('')}
      </svg>
    </div>
  `;
}

function normalizeOt(ot) {
  const stage = ot.stage || (ot.archived ? 'Pagada' : (ot.department === 'Facturación' ? 'Cerrar OT y Facturar' : 'Tráfico'));
  const status = ot.archived ? 'Archivada' : (ot.status || 'En proceso');
  return {
    id: ot.id,
    otId: ot.id,
    taskIndex: null,
    title: ot.title || 'Sin título',
    client: ot.client || 'Sin cliente',
    workspaceId: ot.workspaceId || 'diseno-publicidad',
    department: ot.department || 'Sin depto',
    responsible: ot.responsible || 'Sin asignar',
    stage,
    status,
    urgent: !!ot.urgent,
    deliveryDate: (ot.deliveryDate || '').slice(0, 10),
    entryDate: (ot.entryDate || ot.deliveryDate || '').slice(0, 10),
    hours: computeOtLeafHours(ot),
    mediaReview: (ot.mediaFiles || []).some((m) => m.status === 'En Revisión'),
    archived: !!ot.archived,
  };
}

function normalizeTasks(orders, isPersonalScope, myMember) {
  const list = [];
  (orders || []).forEach((ot) => {
    if (ot.archived) return;
    const otStage = ot.stage || 'Tráfico';
    (ot.subtasks || []).forEach((st, idx) => {
      const status = st.status || ot.status || 'En proceso';
      if (['Terminada', 'Finalizada', 'Archivada', 'Cancelada'].includes(status)) return;
      const resp = st.responsible || ot.responsible || 'Sin asignar';
      if (isPersonalScope && resp !== myMember) return;
      list.push({
        id: `${ot.id}-${idx + 1}`,
        otId: ot.id,
        taskIndex: idx,
        title: st.title || ot.title || 'Sin título',
        client: ot.client || 'Sin cliente',
        workspaceId: ot.workspaceId || 'diseno-publicidad',
        department: st.department || ot.department || 'Sin depto',
        responsible: resp,
        stage: st.stage || (otStage === 'Recibida' ? 'Recibida' : 'Tráfico'),
        status,
        urgent: !!(st.urgent || ot.urgent),
        deliveryDate: (st.deliveryDate || ot.deliveryDate || '').slice(0, 10),
        entryDate: (st.entryDate || ot.entryDate || st.deliveryDate || ot.deliveryDate || '').slice(0, 10),
        hours: status === 'Suspendida' ? 0 : (Number(st.estimatedHours) || 0),
        archived: false,
      });
    });
  });
  return list;
}

function matchesAnchors(item, anchors, canSeeFinancial, todayKey) {
  if (!canSeeFinancial && FINANCIAL_STAGES.has(item.stage)) return false;
  if (anchors.workspace && anchors.workspace !== 'all' && item.workspaceId !== anchors.workspace) return false;
  if (anchors.client && anchors.client !== 'all' && item.client !== anchors.client) return false;
  if (anchors.department && anchors.department !== 'all' && item.department !== anchors.department) return false;
  if (anchors.responsible && anchors.responsible !== 'all' && item.responsible !== anchors.responsible) return false;
  if (anchors.stage && anchors.stage !== 'all' && item.stage !== anchors.stage) return false;
  if (anchors.status && anchors.status !== 'all' && item.status !== anchors.status) return false;
  if (anchors.time && anchors.time !== 'all' && !matchesTimeFilter(item.deliveryDate || item.entryDate, anchors.time, todayKey)) return false;
  return true;
}

/**
 * Renderiza la grilla 2×4 de los 8 gráficos simultáneos adaptados a la pastilla activa.
 */
export function renderStatsPillChartsGrid({
  pillId = 'ots-active',
  allOrders = [],
  scopedOrders = [],
  anchors = {},
  metric = 'ots',
  todayKey,
  tomorrowKey,
  dailyHours = 8,
  activeWsId = 'studio',
  deptPageWsId = null,
  isPersonalScope = false,
  myMember = '',
  canSeeFinancial = true,
}) {
  const isTasksMode = pillId === 'tasks-active' || pillId === 'tasks-urgent';
  const isDayMode = pillId === 'today-hours' || pillId === 'tomorrow-hours';
  const isUrgentMode = pillId === 'ots-urgent' || pillId === 'tasks-urgent';
  const isFinalizadasMode = pillId === 'finalizadas';
  const isClientReviewMode = pillId === 'client-review';
  const isFreeTasksMode = pillId === 'free-tasks';
  const isSeparatorsMode = pillId === 'separators';

  // Dedicated path for Tareas Libres (Estudio vs Cliente) & Separadores (Pausas / Agenda)
  if (isFreeTasksMode || isSeparatorsMode) {
    const useHoursMetric = metric === 'hours';
    const valUnit = useHoursMetric ? 'h' : '';
    const itemNoun = isFreeTasksMode ? 'tar.' : 'bloques';
    const title = isFreeTasksMode ? 'Tareas Libres · Estudio y Cliente' : 'Separadores · Pausas y Agenda';
    const accentColor = isFreeTasksMode ? '#a855f7' : '#94a3b8';

    const sourceList = isFreeTasksMode
      ? (studioFreeTasks || []).map((t) => ({
          id: t.id,
          otId: null,
          taskIndex: null,
          badge: t.kind === 'estudio' ? 'ESTUDIO' : 'CLIENTE',
          kind: t.kind || 'estudio',
          client: t.client || 'Estudio',
          title: t.title || 'Tarea libre',
          responsible: t.responsible || 'Sin asignar',
          workspaceId: t.workspaceId || 'diseno-publicidad',
          deliveryDate: (t.date || '').slice(0, 10),
          entryDate: (t.date || '').slice(0, 10),
          hours: Number(t.hours) || 0,
          urgent: false,
        }))
      : (studioSeparators || []).map((s) => ({
          id: s.id,
          otId: null,
          taskIndex: null,
          badge: 'PAUSA',
          kind: 'separator',
          client: 'Agenda',
          title: s.title || 'Separador',
          responsible: s.responsible || 'Sin asignar',
          workspaceId: 'studio',
          deliveryDate: (s.date || '').slice(0, 10),
          entryDate: (s.date || '').slice(0, 10),
          hours: Number(s.hours) || (Number(s.minutes) || 0) / 60,
          minutes: Number(s.minutes) || Math.round((Number(s.hours) || 0) * 60),
          urgent: false,
        }));

    const filtered = sourceList.filter((it) => {
      if (isPersonalScope && it.responsible !== myMember) return false;
      if (isFreeTasksMode && activeWsId !== 'studio' && it.workspaceId !== activeWsId) return false;
      if (isFreeTasksMode && anchors.workspace && anchors.workspace !== 'all' && it.workspaceId !== anchors.workspace) return false;
      if (isFreeTasksMode && anchors.client && anchors.client !== 'all' && it.client !== anchors.client) return false;
      if (anchors.responsible && anchors.responsible !== 'all' && it.responsible !== anchors.responsible) return false;
      if (anchors.time && anchors.time !== 'all' && !matchesTimeFilter(it.deliveryDate, anchors.time, todayKey)) return false;
      return true;
    });

    const totalCount = filtered.length;
    const totalHours = Number(filtered.reduce((s, it) => s + (Number(it.hours) || 0), 0).toFixed(2));
    const valOf = (it) => (useHoursMetric ? (Number(it.hours) || 0) : 1);

    const drillMap = new Map();
    const reg = (key, drillTitle, drillCat, list) => {
      drillMap.set(key, {
        key,
        title: drillTitle,
        category: drillCat,
        boardTitle: title,
        isTasksMode: true,
        itemNoun,
        items: list,
        totalHours: Number(list.reduce((s, it) => s + (Number(it.hours) || 0), 0).toFixed(2)),
      });
      return key;
    };

    // By Responsible (always hours)
    const respMap = new Map();
    filtered.forEach((it) => {
      const cur = respMap.get(it.responsible) || { hours: 0, count: 0, list: [] };
      cur.hours = Number((cur.hours + (Number(it.hours) || 0)).toFixed(2));
      cur.count += 1;
      cur.list.push(it);
      respMap.set(it.responsible, cur);
    });
    const byResp = Array.from(respMap.entries())
      .map(([label, d]) => ({
        label,
        value: d.hours,
        extra: `${d.count} ${itemNoun}`,
        drillKey: reg(`resp:${label}`, label, 'Responsable', d.list),
      }))
      .sort((a, b) => b.value - a.value);

    // Horizon
    const endOfThisWeek = shiftIsoDate(todayKey, 6);
    const horizon = [
      { key: 'overdue', label: 'Vencidas', shortLabel: 'Venc.', value: 0, color: '#ef4444', list: [] },
      { key: 'today', label: 'Hoy', shortLabel: 'Hoy', value: 0, color: '#f59e0b', list: [] },
      { key: 'tomorrow', label: 'Mañana', shortLabel: 'Mañ.', value: 0, color: '#06b6d4', list: [] },
      { key: 'week', label: 'Esta semana', shortLabel: 'Sem.', value: 0, color: '#3b82f6', list: [] },
      { key: 'future', label: 'Próximas', shortLabel: 'Próx.+', value: 0, color: '#64748b', list: [] },
    ];
    filtered.forEach((it) => {
      const dKey = it.deliveryDate;
      let idx = 4;
      if (!dKey) idx = 4;
      else if (dKey < todayKey) idx = 0;
      else if (dKey === todayKey) idx = 1;
      else if (dKey === tomorrowKey) idx = 2;
      else if (dKey <= endOfThisWeek) idx = 3;
      horizon[idx].value = Number((horizon[idx].value + valOf(it)).toFixed(2));
      horizon[idx].list.push(it);
    });
    horizon.forEach((b) => {
      b.drillKey = reg(`horizon:${b.key}`, b.label, 'Horizonte', b.list);
    });

    // Timeline
    const dateMap = new Map();
    filtered.forEach((it) => {
      if (!it.entryDate) return;
      dateMap.set(it.entryDate, Number(((dateMap.get(it.entryDate) || 0) + valOf(it)).toFixed(2)));
    });
    const timelinePoints = Array.from(dateMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([iso, value]) => ({
        label: iso,
        shortLabel: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
        value,
      }));

    let cards = [];
    if (isFreeTasksMode) {
      // Estudio vs Cliente donut
      const estList = filtered.filter((it) => it.kind === 'estudio');
      const cliList = filtered.filter((it) => it.kind !== 'estudio');
      const estVal = Number(estList.reduce((s, it) => s + valOf(it), 0).toFixed(2));
      const cliVal = Number(cliList.reduce((s, it) => s + valOf(it), 0).toFixed(2));
      const kindSegs = [
        { label: 'Estudio (Interno)', value: estVal, color: '#a855f7', drillKey: reg('free:estudio', 'Estudio (Interno)', 'Tipo', estList) },
        { label: 'Cliente', value: cliVal, color: '#06b6d4', drillKey: reg('free:cliente', 'Cliente', 'Tipo', cliList) },
      ].filter((s) => s.value > 0);
      const cliPct = (estVal + cliVal) > 0 ? Math.round((cliVal / (estVal + cliVal)) * 100) : 0;

      // By Client
      const cliMap = new Map();
      filtered.forEach((it) => {
        if (!cliMap.has(it.client)) cliMap.set(it.client, { value: 0, list: [] });
        const entry = cliMap.get(it.client);
        entry.value = Number((entry.value + valOf(it)).toFixed(2));
        entry.list.push(it);
      });
      const byCli = Array.from(cliMap.entries())
        .map(([label, d]) => ({
          label,
          value: d.value,
          color: label === 'Estudio' ? '#a855f7' : '#06b6d4',
          drillKey: reg(`client:${label}`, label, 'Cliente', d.list),
        }))
        .sort((a, b) => b.value - a.value);

      cards = [
        {
          title: 'Estudio vs. Cliente',
          sub: `${estList.length} est. · ${cliList.length} cli.`,
          body: renderDonutChart(kindSegs, `${cliPct}%`, 'Cliente'),
          largeBody: renderDonutChart(kindSegs, `${cliPct}%`, 'Cliente', { large: true }),
        },
        {
          title: 'Por Cliente',
          sub: `${byCli.length} destinos`,
          body: renderSlimMixBars(byCli, { unit: valUnit || ' tar.' }),
          largeBody: renderSlimMixBars(byCli, { unit: valUnit || ' tar.', large: true }),
        },
        {
          title: 'Por Responsable',
          sub: 'Horas libres',
          body: renderHorizontalBars(byResp, { unit: 'h' }),
          largeBody: renderHorizontalBars(byResp, { unit: 'h', large: true }),
        },
        {
          title: 'Horizonte',
          sub: 'Agenda',
          body: renderVerticalColumns(horizon, valUnit),
          largeBody: renderVerticalColumns(horizon, valUnit, { large: true }),
        },
        {
          title: 'Evolución',
          sub: 'Por fecha',
          body: renderTimelineArea(timelinePoints, accentColor, valUnit),
          largeBody: renderTimelineArea(timelinePoints, accentColor, valUnit, { large: true }),
        },
      ];
    } else {
      // Separadores: Por Tipo de Pausa
      const pausePalette = ['#94a3b8', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa'];
      const typeMap = new Map();
      filtered.forEach((it) => {
        if (!typeMap.has(it.title)) typeMap.set(it.title, { value: 0, list: [] });
        const entry = typeMap.get(it.title);
        entry.value = Number((entry.value + valOf(it)).toFixed(2));
        entry.list.push(it);
      });
      const byType = Array.from(typeMap.entries())
        .map(([label, d], idx) => ({
          label,
          value: d.value,
          color: pausePalette[idx % pausePalette.length],
          drillKey: reg(`sep:${label}`, label, 'Separador', d.list),
        }))
        .sort((a, b) => b.value - a.value);

      cards = [
        {
          title: 'Por Tipo de Pausa',
          sub: `${byType.length} tipos`,
          body: renderSlimMixBars(byType, { unit: valUnit || ' blq.' }),
          largeBody: renderSlimMixBars(byType, { unit: valUnit || ' blq.', large: true }),
        },
        {
          title: 'Por Responsable',
          sub: 'Tiempo en pausas',
          body: renderHorizontalBars(byResp, { unit: 'h' }),
          largeBody: renderHorizontalBars(byResp, { unit: 'h', large: true }),
        },
        {
          title: 'Horizonte',
          sub: 'Agenda',
          body: renderVerticalColumns(horizon, valUnit),
          largeBody: renderVerticalColumns(horizon, valUnit, { large: true }),
        },
        {
          title: 'Evolución',
          sub: 'Por fecha',
          body: renderTimelineArea(timelinePoints, accentColor, valUnit),
          largeBody: renderTimelineArea(timelinePoints, accentColor, valUnit, { large: true }),
        },
      ];
    }

    const leftColCards = [];
    const rightColCards = [];
    cards.forEach((c, idx) => {
      const rendered = renderCardShell(idx + 1, idx, c.title, c.sub, c.body);
      if (idx % 2 === 0) leftColCards.push(rendered);
      else rightColCards.push(rendered);
    });
    const html = `
      <div class="flex-1 min-h-0 overflow-y-auto pr-1">
        <div class="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start pb-1">
          <div class="flex flex-col gap-2 min-w-0">${leftColCards.join('')}</div>
          <div class="flex flex-col gap-2 min-w-0">${rightColCards.join('')}</div>
        </div>
      </div>
    `;
    const wideColCount = cards.length <= 4 ? 2 : 3;
    const wideCols = Array.from({ length: wideColCount }, () => []);
    cards.forEach((c, idx) => {
      wideCols[idx % wideColCount].push(renderCardShell(idx + 1, idx, c.title, c.sub, c.body));
    });
    const wideHtml = `
      <div class="flex-1 min-h-0 overflow-y-auto pr-1">
        <div class="grid grid-cols-1 md:grid-cols-2 ${wideColCount === 3 ? 'xl:grid-cols-3' : 'xl:grid-cols-2'} gap-2.5 items-start pb-2">
          ${wideCols.map((col) => `<div class="flex flex-col gap-2.5 min-w-0">${col.join('')}</div>`).join('')}
        </div>
      </div>
    `;

    return {
      html,
      wideHtml,
      title,
      countLabel: `${totalCount} ${itemNoun}`,
      totalHours,
      isTasksMode: true,
      isDayMode: false,
      cards,
      drillMap,
    };
  }

  let title = isPersonalScope ? 'Mis OTs · En Proceso' : 'OTs Activas · En Proceso';
  let itemNoun = 'OTs';
  let accentColor = '#00d1ff';
  let rawItems = [];

  if (pillId === 'ots-active') {
    rawItems = scopedOrders.filter((o) => !o.archived).map(normalizeOt);
    accentColor = '#f97316';
  } else if (pillId === 'ots-urgent') {
    title = 'OTs Urgentes';
    rawItems = scopedOrders
      .filter((o) => !o.archived)
      .map(normalizeOt)
      .filter((o) => o.urgent || (o.deliveryDate && o.deliveryDate < todayKey));
    accentColor = '#ef4444';
  } else if (pillId === 'tasks-active') {
    title = isPersonalScope ? 'Mis Tareas · Activas' : 'Tareas Activas';
    itemNoun = 'tar.';
    rawItems = normalizeTasks(scopedOrders, isPersonalScope, myMember);
    accentColor = '#f59e0b';
  } else if (pillId === 'tasks-urgent') {
    title = 'Tareas Urgentes';
    itemNoun = 'tar.';
    rawItems = normalizeTasks(scopedOrders, isPersonalScope, myMember)
      .filter((t) => t.urgent || (t.deliveryDate && t.deliveryDate < todayKey));
    accentColor = '#ef4444';
  } else if (pillId === 'client-review') {
    title = 'En Cliente · En Revisión';
    rawItems = scopedOrders
      .filter((o) => !o.archived)
      .map(normalizeOt)
      .filter((o) => o.department === 'Cliente' || o.mediaReview);
    accentColor = '#06b6d4';
  } else if (pillId === 'finalizadas') {
    title = 'Finalizadas · Facturación';
    rawItems = (allOrders || [])
      .filter((o) => activeWsId === 'studio' || (o.workspaceId || 'diseno-publicidad') === activeWsId)
      .map(normalizeOt)
      .filter((o) => o.archived || FINANCIAL_STAGES.has(o.stage) || o.department === 'Facturación');
    accentColor = '#eab308';
  } else if (pillId === 'today-hours' || pillId === 'tomorrow-hours') {
    const targetIso = pillId === 'today-hours' ? todayKey : tomorrowKey;
    title = pillId === 'today-hours' ? 'Mi Jornada Hoy' : 'Jornada Mañana';
    itemNoun = 'ítems';
    accentColor = pillId === 'today-hours' ? '#22c55e' : '#38bdf8';
    const dayTasks = normalizeTasks(scopedOrders, isPersonalScope, myMember).filter((t) => t.deliveryDate === targetIso);
    const taskOtIds = new Set(dayTasks.map((t) => t.id.split('-').slice(0, -1).join('-')));
    const dayOts = scopedOrders
      .filter((o) => !o.archived && !taskOtIds.has(o.id) && (o.deliveryDate || '').slice(0, 10) === targetIso)
      .map(normalizeOt);
    rawItems = [...dayTasks, ...dayOts];
  }

  const items = rawItems.filter((it) => matchesAnchors(it, anchors, canSeeFinancial, todayKey));
  const totalCount = items.length;
  const totalHours = items.reduce((s, it) => s + (Number(it.hours) || 0), 0);
  const useHoursMetric = metric === 'hours' || isDayMode;
  const valOf = (it) => (useHoursMetric ? (Number(it.hours) || 0) : 1);
  const valUnit = useHoursMetric ? 'h' : '';

  const drillMap = new Map();
  const registerDrill = (key, drillTitle, drillCategory, list) => {
    drillMap.set(key, {
      key,
      title: drillTitle,
      category: drillCategory,
      boardTitle: title,
      isTasksMode,
      itemNoun,
      items: list,
      totalHours: list.reduce((s, it) => s + (Number(it.hours) || 0), 0),
    });
    return key;
  };

  // 1. Por Cliente
  const clientMap = new Map();
  items.forEach((it) => {
    const k = it.client;
    if (!clientMap.has(k)) clientMap.set(k, { value: 0, list: [] });
    const entry = clientMap.get(k);
    entry.value += valOf(it);
    entry.list.push(it);
  });
  const byClient = Array.from(clientMap.entries())
    .map(([label, d]) => ({
      label,
      value: d.value,
      drillKey: registerDrill(`client:${label}`, label, 'Cliente', d.list),
    }))
    .sort((a, b) => b.value - a.value);

  // 2. Por Perfil / Espacio
  const wsMap = new Map();
  items.forEach((it) => {
    if (!wsMap.has(it.workspaceId)) wsMap.set(it.workspaceId, { value: 0, list: [] });
    const entry = wsMap.get(it.workspaceId);
    entry.value += valOf(it);
    entry.list.push(it);
  });
  const byWorkspace = Array.from(wsMap.entries())
    .map(([wsId, d]) => {
      const ws = getWorkspaceById(wsId);
      const label = ws?.shortName || ws?.name || wsId;
      return {
        label,
        value: d.value,
        color: ws?.color || '#38bdf8',
        drillKey: registerDrill(`ws:${wsId}`, label, 'Perfil', d.list),
      };
    })
    .sort((a, b) => b.value - a.value);

  // 3. Por Depto (paginado por Perfil en modo Estudio; sin mezclar talleres)
  const fixedWsId = anchors.workspace && anchors.workspace !== 'all'
    ? anchors.workspace
    : (activeWsId && activeWsId !== 'studio' ? activeWsId : 'all');

  const activeWsList = getActiveWorkspaces();
  const wsIdsInItems = new Set(items.map((it) => it.workspaceId));
  const deptPagerWorkspaces = fixedWsId === 'all'
    ? activeWsList.filter((w) => wsIdsInItems.has(w.id))
    : [];
  const activeDeptWsId = fixedWsId !== 'all'
    ? fixedWsId
    : (deptPagerWorkspaces.some((w) => w.id === deptPageWsId)
        ? deptPageWsId
        : (deptPagerWorkspaces[0]?.id || null));
  const activeDeptWsObj = activeDeptWsId ? getWorkspaceById(activeDeptWsId) : null;

  const deptItems = activeDeptWsId
    ? items.filter((it) => it.workspaceId === activeDeptWsId)
    : items;
  const deptMap = new Map();
  deptItems.forEach((it) => {
    if (!deptMap.has(it.department)) deptMap.set(it.department, { value: 0, list: [] });
    const entry = deptMap.get(it.department);
    entry.value += valOf(it);
    entry.list.push(it);
  });
  const wsDeptOrder = Array.isArray(activeDeptWsObj?.departments) ? activeDeptWsObj.departments : [];
  const byDept = Array.from(deptMap.entries())
    .map(([label, d]) => ({
      label,
      value: d.value,
      color: getDepartmentColor(label),
      drillKey: registerDrill(`dept:${activeDeptWsId || 'all'}:${label}`, label, activeDeptWsObj ? `Depto · ${activeDeptWsObj.shortName || activeDeptWsObj.name}` : 'Depto', d.list),
    }))
    .sort((a, b) => {
      const ia = wsDeptOrder.indexOf(a.label);
      const ib = wsDeptOrder.indexOf(b.label);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return b.value - a.value;
    });

  const renderDeptPager = (large = false) => {
    if (deptPagerWorkspaces.length <= 1) return '';
    return `
      <div class="flex items-center gap-1 ${large ? 'mb-4 pb-2' : 'mb-2 pb-1.5'} border-b border-obsidian-border/50 font-mono ${large ? 'text-[10.5px]' : 'text-[8.5px]'} overflow-x-auto">
        ${deptPagerWorkspaces.map((w) => {
          const isCur = w.id === activeDeptWsId;
          return `
            <button type="button" data-dk-dept-page="${escapeHtml(w.id)}"
              class="px-1.5 py-0.5 rounded transition-colors cursor-pointer shrink-0 ${isCur ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">${escapeHtml(w.shortName || w.name)}</button>
          `;
        }).join('')}
      </div>
    `;
  };

  const deptBodyHtml = `${renderDeptPager(false)}${
    pillId === 'ots-active'
      ? renderSlimMixBars(byDept, { unit: valUnit || ' OT' })
      : renderHorizontalBars(byDept, { unit: valUnit, useRowColor: true })
  }`;
  const deptLargeBodyHtml = `${renderDeptPager(true)}${
    pillId === 'ots-active'
      ? renderSlimMixBars(byDept, { unit: valUnit || ' OT', large: true })
      : renderHorizontalBars(byDept, { unit: valUnit, useRowColor: true, large: true })
  }`;
  const deptCardSub = activeDeptWsObj
    ? `${activeDeptWsObj.shortName || activeDeptWsObj.name} · ${byDept.length}`
    : `${byDept.length} áreas`;

  // 4. Por Responsable (siempre en horas + línea de Meta diaria o semanal)
  const respMap = new Map();
  items.forEach((it) => {
    const cur = respMap.get(it.responsible) || { hours: 0, count: 0, list: [] };
    cur.hours += Number(it.hours) || 0;
    cur.count += 1;
    cur.list.push(it);
    respMap.set(it.responsible, cur);
  });
  const metaHours = isDayMode ? (Number(dailyHours) || 8) : (Number(dailyHours) || 8) * 5;
  const byResp = Array.from(respMap.entries())
    .map(([label, d]) => ({
      label,
      value: d.hours,
      extra: `${d.count} ${itemNoun}`,
      drillKey: registerDrill(`resp:${label}`, label, 'Responsable', d.list),
    }))
    .sort((a, b) => b.value - a.value);

  // 5. Por Etapa (flujo natural)
  const stageOrder = isTasksMode ? TASK_STAGE_FLOW : OT_STAGE_FLOW;
  const stageMap = new Map();
  items.forEach((it) => {
    if (!stageMap.has(it.stage)) stageMap.set(it.stage, { value: 0, list: [] });
    const entry = stageMap.get(it.stage);
    entry.value += valOf(it);
    entry.list.push(it);
  });
  const byStage = stageOrder
    .filter((stg) => (canSeeFinancial || !FINANCIAL_STAGES.has(stg)) && stageMap.has(stg))
    .map((stg) => {
      const label = stg === 'Cerrar OT y Facturar' ? 'Por Facturar' : stg;
      const d = stageMap.get(stg);
      return {
        label,
        value: d.value,
        color: getStageColor(stg),
        drillKey: registerDrill(`stage:${stg}`, label, 'Etapa', d.list),
      };
    });

  // 6. Por Prioridad (o Vencidas vs Marcadas Urgentes cuando ya estamos en Urgentes)
  let segA = 0;
  let segB = 0;
  const segAList = [];
  const segBList = [];
  let prioSegments = [];
  let prioCenterTop = '0%';
  let prioCenterBot = 'Urg.';
  let prioSubtitle = '';

  if (isUrgentMode) {
    items.forEach((it) => {
      if (it.deliveryDate && it.deliveryDate < todayKey) {
        segA += valOf(it);
        segAList.push(it);
      } else {
        segB += valOf(it);
        segBList.push(it);
      }
    });
    const tot = segA + segB;
    prioCenterTop = `${tot > 0 ? Math.round((segA / tot) * 100) : 0}%`;
    prioCenterBot = 'Venc.';
    prioSubtitle = `${segA}${valUnit} venc.`;
    prioSegments = [
      { label: 'Vencidas', value: segA, color: '#ef4444', drillKey: registerDrill('prio:overdue', 'Vencidas', 'Tipo Urgencia', segAList) },
      { label: 'Urgentes', value: segB, color: '#f59e0b', drillKey: registerDrill('prio:flagged', 'Urgentes', 'Tipo Urgencia', segBList) },
    ].filter((s) => s.value > 0);
  } else {
    items.forEach((it) => {
      if (it.urgent || (it.deliveryDate && it.deliveryDate < todayKey)) {
        segA += valOf(it);
        segAList.push(it);
      } else {
        segB += valOf(it);
        segBList.push(it);
      }
    });
    const tot = segA + segB;
    prioCenterTop = `${tot > 0 ? Math.round((segA / tot) * 100) : 0}%`;
    prioCenterBot = 'Urg.';
    prioSubtitle = `${segA}${valUnit} urg.`;
    prioSegments = [
      { label: 'Urgentes', value: segA, color: '#ef4444', drillKey: registerDrill('prio:urgent', 'Urgentes', 'Prioridad', segAList) },
      { label: 'Normales', value: segB, color: '#38bdf8', drillKey: registerDrill('prio:regular', 'Normales', 'Prioridad', segBList) },
    ].filter((s) => s.value > 0);
  }

  // 7. Horizonte de Entregas
  const endOfThisWeek = shiftIsoDate(todayKey, 6);
  const horizon = [
    { key: 'overdue', label: 'Vencidas', shortLabel: 'Venc.', value: 0, color: '#ef4444', list: [] },
    { key: 'today', label: 'Hoy', shortLabel: 'Hoy', value: 0, color: '#f59e0b', list: [] },
    { key: 'tomorrow', label: 'Mañana', shortLabel: 'Mañ.', value: 0, color: '#06b6d4', list: [] },
    { key: 'week', label: 'Esta semana', shortLabel: 'Sem.', value: 0, color: '#3b82f6', list: [] },
    { key: 'future', label: 'Próximas', shortLabel: 'Próx.+', value: 0, color: '#64748b', list: [] },
  ];
  items.forEach((it) => {
    const dKey = it.deliveryDate;
    const v = valOf(it);
    let idx = 4;
    if (!dKey) idx = 4;
    else if (dKey < todayKey) idx = 0;
    else if (dKey === todayKey) idx = 1;
    else if (dKey === tomorrowKey) idx = 2;
    else if (dKey <= endOfThisWeek) idx = 3;
    horizon[idx].value += v;
    horizon[idx].list.push(it);
  });
  horizon.forEach((b) => {
    b.drillKey = registerDrill(`horizon:${b.key}`, b.label, 'Horizonte Entregas', b.list);
  });

  // 8. Evolución en el Tiempo (por fecha de entrada)
  const entryMap = new Map();
  items.forEach((it) => {
    if (!it.entryDate) return;
    entryMap.set(it.entryDate, (entryMap.get(it.entryDate) || 0) + valOf(it));
  });
  const timelinePoints = Array.from(entryMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-7)
    .map(([iso, value]) => ({
      label: iso,
      shortLabel: `${iso.slice(8, 10)}/${iso.slice(5, 7)}`,
      value,
    }));

  const cards = isFinalizadasMode
    ? [
        {
          title: 'Por Cliente',
          sub: `${byClient.length} cuentas`,
          body: renderHorizontalBars(byClient, { unit: valUnit }),
          largeBody: renderHorizontalBars(byClient, { unit: valUnit, large: true }),
        },
        {
          title: 'Por Perfil',
          sub: `${byWorkspace.length} espacios`,
          body: renderDonutChart(byWorkspace, useHoursMetric ? `${totalHours}h` : totalCount, useHoursMetric ? 'Horas' : itemNoun),
          largeBody: renderDonutChart(byWorkspace, useHoursMetric ? `${totalHours}h` : totalCount, useHoursMetric ? 'Horas' : itemNoun, { large: true }),
        },
        {
          title: 'Por Etapa',
          sub: 'Cobro',
          body: renderHorizontalBars(byStage, { unit: valUnit, useRowColor: true }),
          largeBody: renderHorizontalBars(byStage, { unit: valUnit, useRowColor: true, large: true }),
        },
        {
          title: 'Evolución',
          sub: 'Por fecha',
          body: renderTimelineArea(timelinePoints, accentColor, valUnit),
          largeBody: renderTimelineArea(timelinePoints, accentColor, valUnit, { large: true }),
        },
      ]
    : [
        {
          title: 'Por Cliente',
          sub: `${byClient.length} cuentas`,
          body: renderHorizontalBars(byClient, { unit: valUnit }),
          largeBody: renderHorizontalBars(byClient, { unit: valUnit, large: true }),
        },
        {
          title: 'Por Perfil',
          sub: `${byWorkspace.length} espacios`,
          body: renderDonutChart(byWorkspace, useHoursMetric ? `${totalHours}h` : totalCount, useHoursMetric ? 'Horas' : itemNoun),
          largeBody: renderDonutChart(byWorkspace, useHoursMetric ? `${totalHours}h` : totalCount, useHoursMetric ? 'Horas' : itemNoun, { large: true }),
        },
        {
          title: 'Por Depto',
          sub: deptCardSub,
          body: deptBodyHtml,
          largeBody: deptLargeBodyHtml,
        },
        {
          title: 'Por Responsable',
          sub: `Meta ${metaHours}h`,
          body: renderHorizontalBars(byResp, { unit: 'h', maxVal: Math.max(metaHours, ...byResp.map((r) => r.value)), targetVal: metaHours }),
          largeBody: renderHorizontalBars(byResp, { unit: 'h', maxVal: Math.max(metaHours, ...byResp.map((r) => r.value)), targetVal: metaHours, large: true }),
        },
        {
          title: 'Por Etapa',
          sub: 'Flujo',
          body: renderHorizontalBars(byStage, { unit: valUnit, useRowColor: true }),
          largeBody: renderHorizontalBars(byStage, { unit: valUnit, useRowColor: true, large: true }),
        },
        {
          title: isUrgentMode ? 'Tipo Urgencia' : 'Por Prioridad',
          sub: prioSubtitle,
          body: renderDonutChart(prioSegments, prioCenterTop, prioCenterBot),
          largeBody: renderDonutChart(prioSegments, prioCenterTop, prioCenterBot, { large: true }),
        },
        {
          title: 'Horizonte Entregas',
          sub: isDayMode ? 'Jornada' : 'Compromisos',
          body: renderVerticalColumns(horizon, valUnit),
          largeBody: renderVerticalColumns(horizon, valUnit, { large: true }),
        },
        {
          title: 'Evolución Ingreso',
          sub: isClientReviewMode ? 'En cliente' : 'Por fecha',
          body: renderTimelineArea(timelinePoints, accentColor, valUnit),
          largeBody: renderTimelineArea(timelinePoints, accentColor, valUnit, { large: true }),
        },
      ];

  const leftColCards = [];
  const rightColCards = [];
  cards.forEach((c, idx) => {
    const rendered = renderCardShell(idx + 1, idx, c.title, c.sub, c.body);
    if (idx % 2 === 0) leftColCards.push(rendered);
    else rightColCards.push(rendered);
  });

  const html = `
    <div class="flex-1 min-h-0 overflow-y-auto pr-1">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-2 items-start pb-1">
        <div class="flex flex-col gap-2 min-w-0">
          ${leftColCards.join('')}
        </div>
        <div class="flex flex-col gap-2 min-w-0">
          ${rightColCards.join('')}
        </div>
      </div>
    </div>
  `;

  const wideCols = [[], [], [], []];
  const wideColCount = cards.length <= 4 ? 2 : 4;
  cards.forEach((c, idx) => {
    const rendered = renderCardShell(idx + 1, idx, c.title, c.sub, c.body);
    wideCols[idx % wideColCount].push(rendered);
  });

  const wideHtml = `
    <div class="flex-1 min-h-0 overflow-y-auto pr-1">
      <div class="grid grid-cols-1 md:grid-cols-2 ${wideColCount === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-2'} gap-2.5 items-start pb-2">
        ${wideCols.slice(0, wideColCount).map((col) => `
          <div class="flex flex-col gap-2.5 min-w-0">
            ${col.join('')}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  return {
    html,
    wideHtml,
    title,
    countLabel: `${totalCount} ${itemNoun}`,
    totalHours,
    isTasksMode,
    isDayMode,
    cards,
    drillMap,
  };
}

/**
 * Renderiza la Caja de Luz (modal ampliado) para un gráfico del tablero de Estadística.
 */
export function renderChartLightboxHtml({ pillBoard, activeIdx, activeFilterChips = [], showBackToPanel = false }) {
  if (!pillBoard || !Array.isArray(pillBoard.cards) || activeIdx === null || activeIdx === undefined) return '';
  const card = pillBoard.cards[activeIdx];
  if (!card) return '';
  const total = pillBoard.cards.length;
  return `
    <div id="dk-chart-lightbox" data-dk-lb-backdrop="1"
      class="fixed inset-0 z-50 bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-3xl max-h-[88vh] bg-[#181818] border border-obsidian-border rounded-2xl shadow-2xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
        <div class="px-5 py-3.5 border-b border-obsidian-border flex items-center justify-between gap-3 bg-[#1c1c1c] shrink-0">
          <div class="flex items-center gap-2.5 min-w-0">
            ${showBackToPanel ? `
              <button type="button" data-dk-lb-back-panel="1" title="Volver al panel completo"
                class="px-2 py-1 rounded text-[10px] font-mono text-obsidian-amber hover:bg-obsidian-elevated cursor-pointer transition-colors shrink-0">‹ Panel</button>
              <span class="w-px h-4 bg-obsidian-border shrink-0"></span>
            ` : ''}
            <span class="font-mono text-[10px] text-obsidian-amber font-semibold shrink-0">0${activeIdx + 1}/${total}</span>
            <div class="min-w-0">
              <div class="font-mono text-[12px] text-[#F0F0F0] uppercase tracking-wider font-semibold truncate">${escapeHtml(card.title)}</div>
              <div class="font-mono text-[9.5px] text-[#8C8C8C] truncate">${escapeHtml(pillBoard.title)}${card.sub ? ` · ${escapeHtml(card.sub)}` : ''}</div>
            </div>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="inline-flex items-center gap-1 font-mono text-[10px]">
              <button type="button" data-dk-lb-nav="-1" title="Gráfico anterior (←)"
                class="px-2 py-1 rounded text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors">‹ Ant.</button>
              <button type="button" data-dk-lb-nav="1" title="Gráfico siguiente (→)"
                class="px-2 py-1 rounded text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors">Sig. ›</button>
            </div>
            <span class="w-px h-4 bg-obsidian-border"></span>
            <button type="button" data-dk-lb-close="1" title="Cerrar (Esc)"
              class="px-2.5 py-1 rounded text-[10px] font-mono text-[#A3A3A3] hover:text-white hover:bg-obsidian-elevated cursor-pointer transition-colors">Cerrar</button>
          </div>
        </div>

        ${activeFilterChips.length ? `
          <div class="px-5 py-2 border-b border-obsidian-border/60 bg-[#161616] flex items-center flex-wrap gap-1.5 shrink-0">
            <span class="font-mono text-[8.5px] uppercase tracking-wider text-[#666666] mr-1">Filtros:</span>
            ${activeFilterChips.map((ch) => `
              <span class="px-1.5 py-0.5 rounded bg-[#222222] border border-obsidian-amber/40 text-[9px] font-mono text-[#D4D4D4]">${escapeHtml(ch.label)}</span>
            `).join('')}
          </div>
        ` : ''}

        <div class="flex-1 min-h-0 overflow-y-auto p-6">
          ${card.largeBody}
        </div>

        <div class="px-5 py-2.5 border-t border-obsidian-border bg-[#161616] flex items-center justify-between text-[10px] font-mono text-[#8C8C8C] shrink-0">
          <span>${escapeHtml(pillBoard.countLabel)} · <strong class="text-[#D4D4D4]">${pillBoard.totalHours}h</strong></span>
          <span class="text-[#5A5A5A]">← → navegar · Esc cerrar</span>
        </div>
      </div>
    </div>
  `;
}
