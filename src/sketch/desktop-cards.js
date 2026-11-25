/**
 * Componentes compartidos de tarjetas, controles de cuadrante y KPI rings del Escritorio.
 */

import {
  escapeHtml,
  formatShortDate,
  getClientColor,
  getDepartmentColor,
  getPriorityDotHtml,
  getWorkspaceById,
} from './store.js';

export function renderDragHandle(slotIdx) {
  return `
    <span draggable="true" data-dk-drag-slot="${slotIdx}" title="Arrastrar para intercambiar cuadrante"
      class="cursor-grab active:cursor-grabbing text-[#5A5A5A] hover:text-[#D4D4D4] inline-flex items-center px-0.5 select-none shrink-0 transition-colors">
      <svg class="w-3 h-3" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/>
        <circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/>
        <circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/>
      </svg>
    </span>
  `;
}

export function renderCollapseBtn(target) {
  if (!target) return '';
  const isUp = target === 'q1' || target === 'q2';
  const attrName = (target === 'q1' || target === 'q3') ? 'data-dk-collapse-left' : 'data-dk-collapse-right';
  return `
    <button type="button" ${attrName}="${target}" title="${isUp ? 'Colapsar cuadrante superior' : 'Colapsar cuadrante inferior'}"
      class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#A3A3A3] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer transition-colors shrink-0">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${isUp ? '<polyline points="18 15 12 9 6 15"/>' : '<polyline points="6 9 12 15 18 9"/>'}</svg>
    </button>
  `;
}

export function renderExpandPanelBtn(modId, isExpanded = false) {
  return isExpanded
    ? `
      <button type="button" data-dk-lb-close="1" title="Volver a los 4 cuadrantes (Esc)" aria-label="Restaurar cuadrantes"
        class="w-6 h-6 rounded hover:bg-obsidian-elevated text-obsidian-amber hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
          <line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
    `
    : `
      <button type="button" data-dk-lb-open-panel="${escapeHtml(modId)}" title="Expandir a Tablero completo" aria-label="Expandir panel"
        class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#A3A3A3] hover:text-obsidian-amber flex items-center justify-center cursor-pointer transition-colors shrink-0">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
          <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
        </svg>
      </button>
    `;
}

export function renderTopRingWidget({
  title,
  value,
  ringColor,
  progress = 1,
  lines = [],
  attrs = '',
  active = false,
}) {
  const radius = 15;
  const circ = 2 * Math.PI * radius;
  const frac = Math.max(0, Math.min(1, progress));
  const dash = frac * circ;
  const cardCls = active
    ? 'bg-[#2a2a2a] border-obsidian-amber/80 ring-1 ring-inset ring-obsidian-amber/40'
    : 'bg-[#242424] hover:bg-[#2a2a2a] border-obsidian-border hover:border-[#3f3f3f]';
  return `
    <button type="button" ${attrs}
      class="text-left px-2 py-1.5 rounded-xl border ${cardCls} transition-colors cursor-pointer flex flex-col gap-1 min-w-0">
      <div class="text-[9.5px] font-semibold text-[#F0F0F0] leading-tight truncate">${escapeHtml(title)}</div>
      <div class="flex items-center gap-2 min-w-0">
        <div class="relative w-8 h-8 shrink-0">
          <svg viewBox="0 0 38 38" class="w-full h-full -rotate-90" aria-hidden="true">
            <circle cx="19" cy="19" r="${radius}" fill="none" stroke="#181818" stroke-width="3" />
            <circle cx="19" cy="19" r="${radius}" fill="none" stroke="${escapeHtml(ringColor)}" stroke-width="3"
              stroke-linecap="round" stroke-dasharray="${dash.toFixed(2)} ${(circ - dash).toFixed(2)}" />
          </svg>
          <span class="absolute inset-0 flex items-center justify-center font-sans text-[12px] font-bold text-white leading-none">${escapeHtml(String(value))}</span>
        </div>
        <div class="min-w-0 flex flex-col justify-center text-[9px] font-medium leading-tight">
          ${lines.map((ln) => `
            <div class="truncate">
              ${ln.num !== undefined ? `<span class="font-bold mr-1" style="color:${escapeHtml(ln.numColor || '#D4D4D4')}">${escapeHtml(String(ln.num))}</span>` : ''}
              <span class="text-[#E5E5E5]">${escapeHtml(ln.label)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </button>
  `;
}

export function renderOtRow(ot, colKey, { compact = false, todayKey, tomorrowKey, showWsTag = false, selectedCardKey = null }) {
  const cColor = getClientColor(ot.client);
  const shortOtCode = String(ot.id || '').replace(/^OT-/i, '');
  const dKey = (ot.deliveryDate || '').slice(0, 10);
  const isOverdue = dKey && dKey < todayKey;
  const isDueToday = dKey === todayKey;
  const ws = showWsTag && !compact ? getWorkspaceById(ot.workspaceId || 'diseno-publicidad') : null;
  const key = `${colKey}:ot:${ot.id}`;
  const isSelected = selectedCardKey === key;
  return `
    <div draggable="true" data-dk-pin-type="ot" data-dk-pin-ot-id="${escapeHtml(ot.id)}" data-desktop-select-ot="${escapeHtml(ot.id)}" data-dk-key="${escapeHtml(key)}"
      class="bg-[#202020] hover:bg-[#262626] border ${isSelected ? 'border-obsidian-amber/70 bg-[#242424]' : 'border-obsidian-border'} rounded-lg ${compact ? 'p-1.5 space-y-0.5' : 'p-2 space-y-1'} cursor-pointer transition-colors">
      <div class="flex items-center justify-between gap-1">
        <span class="inline-flex items-center gap-1 min-w-0">
          ${getPriorityDotHtml(ot, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
          <button type="button" data-desktop-edit-ot="${escapeHtml(ot.id)}" title="Abrir OT"
            class="font-mono ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOtCode)}</button>
          ${ws ? `<span class="text-[9px] font-medium truncate" style="color:${escapeHtml(ws.color || '#8C8C8C')}">${escapeHtml(ws.shortName)}</span>` : ''}
        </span>
        ${compact ? '' : `<span class="font-mono text-[9px] ${isOverdue ? 'text-rose-300 font-semibold' : (isDueToday ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]')} shrink-0">${escapeHtml(formatShortDate(ot.deliveryDate) || '—')}</span>`}
      </div>
      <div class="${compact ? 'text-[9.5px] line-clamp-2' : 'text-[10.5px] line-clamp-2'} text-[#D4D4D4] leading-snug" title="${escapeHtml(ot.title)}">${escapeHtml(ot.title)}</div>
      <div class="flex items-center justify-between gap-1 ${compact ? 'text-[8.5px]' : 'text-[9.5px]'}">
        <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
        ${compact ? '' : `<span class="truncate shrink-0" style="color:${escapeHtml(getDepartmentColor(ot.department))}">${escapeHtml(ot.department || '—')}</span>`}
      </div>
    </div>
  `;
}

export function renderTaskRow(task, colKey, { compact = false, todayKey, tomorrowKey, showWsTag = false, selectedCardKey = null }) {
  const cColor = getClientColor(task.client);
  const shortOtCode = `${String(task.otId || '').replace(/^OT-/i, '')}.${task.taskIndex + 1}`;
  const dKey = (task.deliveryDate || '').slice(0, 10);
  const isOverdue = dKey && dKey < todayKey;
  const isDueToday = dKey === todayKey;
  const ws = showWsTag && !compact ? getWorkspaceById(task.workspaceId) : null;
  const key = `${colKey}:task:${task.otId}:${task.taskIndex}`;
  const isSelected = selectedCardKey === key;
  return `
    <div draggable="true" data-dk-pin-type="task" data-dk-pin-ot-id="${escapeHtml(task.otId)}" data-dk-pin-task-idx="${task.taskIndex}" data-desktop-select-task-ot="${escapeHtml(task.otId)}" data-desktop-select-task-idx="${task.taskIndex}" data-dk-key="${escapeHtml(key)}"
      class="bg-[#202020] hover:bg-[#262626] border ${isSelected ? 'border-obsidian-amber/70 bg-[#242424]' : 'border-obsidian-border'} rounded-lg ${compact ? 'p-1.5 space-y-0.5' : 'p-2 space-y-1'} cursor-pointer transition-colors">
      <div class="flex items-center justify-between gap-1">
        <span class="inline-flex items-center gap-1 min-w-0">
          ${getPriorityDotHtml(task, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
          <button type="button" data-desktop-edit-task-ot="${escapeHtml(task.otId)}" data-desktop-edit-task-idx="${task.taskIndex}" title="Abrir Tarea"
            class="font-mono ${compact ? 'text-[9px]' : 'text-[10px]'} font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOtCode)}</button>
          ${ws ? `<span class="text-[9px] font-medium truncate" style="color:${escapeHtml(ws.color || '#8C8C8C')}">${escapeHtml(ws.shortName)}</span>` : ''}
        </span>
        ${compact ? '' : `<span class="font-mono text-[9px] ${isOverdue ? 'text-rose-300 font-semibold' : (isDueToday ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]')} shrink-0">${escapeHtml(formatShortDate(task.deliveryDate) || '—')}</span>`}
      </div>
      <div class="${compact ? 'text-[9.5px] line-clamp-2' : 'text-[10.5px] line-clamp-2'} text-[#D4D4D4] leading-snug" title="${escapeHtml(task.title)}">${escapeHtml(task.title)}</div>
      <div class="flex items-center justify-between gap-1 ${compact ? 'text-[8.5px]' : 'text-[9.5px]'}">
        <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(task.client)}</span>
        ${compact ? '' : `<span class="truncate shrink-0" style="color:${escapeHtml(getDepartmentColor(task.department))}">${escapeHtml(task.department || '—')}</span>`}
      </div>
    </div>
  `;
}
