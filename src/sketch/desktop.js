/**
 * Escritorio (#view-desktop) overview showing deduplicated priority buckets:
 * Urgentes | Vencen hoy | Vencen mañana.
 */

import {
  escapeHtml,
  formatShortDate,
  getActiveWorkspaces,
  getClientColor,
  getDepartmentColor,
  getPriorityDotHtml,
  getStageColor,
  getStatusColor,
  getWorkspaceById,
  notifySketchChange,
  relDate,
  sketchState,
  trafficOrders,
} from './store.js';
import { renderTrafficNotesInspector } from './inspector.js';

/**
 * Render the Escritorio (#view-desktop) 3-column priority Kanban.
 */
export function renderDesktopOverview(onGoToTraffic, { onOpenOt } = {}) {
  const container = document.getElementById('view-desktop');
  if (!container) return;

  const todayKey = relDate(0).slice(0, 10);
  const tomorrowKey = relDate(1).slice(0, 10);
  const activeWsId = sketchState.activeWorkspaceId || 'studio';
  const showWsTag = getActiveWorkspaces().length >= 2 && activeWsId === 'studio';
  const activeOrders = trafficOrders.filter((o) => {
    if (o.archived) return false;
    if (activeWsId !== 'studio' && (o.workspaceId || 'diseno-publicidad') !== activeWsId) return false;
    return true;
  });

  const urgentItems = activeOrders
    .filter((o) => !!o.urgent)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const todayItems = activeOrders
    .filter((o) => !o.urgent && (o.deliveryDate || '').slice(0, 10) === todayKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const tomorrowItems = activeOrders
    .filter((o) => !o.urgent && (o.deliveryDate || '').slice(0, 10) === tomorrowKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));

  const openOt = (otId) => {
    if (!otId) return;
    if (typeof onOpenOt === 'function') {
      onOpenOt({ otId, taskIndex: null, scope: 'active' });
    } else {
      notifySketchChange('open-ot', { otId, taskIndex: null, scope: 'active' });
    }
  };

  const renderKanbanCol = (title, dotClass, emptyMsg, items) => {
    const cardsHtml = items.length
      ? items.map((ot) => {
          const cColor = getClientColor(ot.client);
          const shortOtCode = String(ot.id || '').replace(/^OT-/i, '');
          const isDueToday = (ot.deliveryDate || '').slice(0, 10) === todayKey;
          const ws = showWsTag ? getWorkspaceById(ot.workspaceId || 'diseno-publicidad') : null;

          return `
            <div data-desktop-open-row="${escapeHtml(ot.id)}"
              class="bg-[#191919] hover:bg-[#262626] border border-obsidian-border rounded-lg p-2.5 space-y-1.5 cursor-pointer transition-colors">
              <div class="flex items-center justify-between gap-1.5">
                <span class="inline-flex items-center gap-1.5 min-w-0">
                  ${getPriorityDotHtml(ot, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
                  <button type="button" data-desktop-edit-ot="${escapeHtml(ot.id)}" title="Abrir OT"
                    class="font-mono text-[10.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOtCode)}</button>
                  ${ws ? `<span class="text-[9.5px] font-medium truncate" style="color:${escapeHtml(ws.color || '#8C8C8C')}">${escapeHtml(ws.shortName)}</span>` : ''}
                </span>
                <span class="font-mono text-[9.5px] ${isDueToday ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]'} shrink-0">${escapeHtml(formatShortDate(ot.deliveryDate) || '—')}</span>
              </div>
              <div class="flex items-center justify-between gap-2 text-[10px]">
                <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
                <span class="text-[#8C8C8C] truncate shrink-0">${escapeHtml(ot.responsible || '—')}</span>
              </div>
              <div class="text-[11px] text-[#D4D4D4] leading-snug line-clamp-2" title="${escapeHtml(ot.title)}">${escapeHtml(ot.title)}</div>
              <div class="flex items-center justify-between gap-2 text-[9.5px] pt-0.5">
                <span class="truncate font-medium" style="color:${escapeHtml(getDepartmentColor(ot.department))}">${escapeHtml(ot.department || '—')}</span>
                <span class="truncate font-medium" style="color:${escapeHtml(getStageColor(ot.stage || 'Tráfico'))}">${escapeHtml(ot.stage || 'Tráfico')}</span>
                <span class="truncate font-medium" style="color:${escapeHtml(getStatusColor(ot.status))}">${escapeHtml(ot.status || '—')}</span>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="p-4 text-center text-[10.5px] text-[#8C8C8C]">${escapeHtml(emptyMsg)}</div>`;

    return `
      <div class="bg-[#202020] border border-obsidian-border rounded-xl p-2.5 flex flex-col gap-2 min-w-0">
        <div class="flex items-center justify-between px-1 py-0.5 border-b border-obsidian-border pb-1.5">
          <span class="inline-flex items-center gap-2">
            <span class="w-2 h-2 rounded-full ${dotClass}"></span>
            <span class="text-[11px] font-medium text-[#D4D4D4]">${escapeHtml(title)}</span>
          </span>
          <span class="text-[10px] font-mono text-[#8C8C8C]">${items.length}</span>
        </div>
        <div class="flex flex-col gap-2 min-h-[120px]">${cardsHtml}</div>
      </div>
    `;
  };

  container.innerHTML = `
    <div class="flex items-center justify-between pb-0.5">
      <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C]">Atención Inmediata</span>
      <button type="button" id="btn-desktop-go-traffic"
        class="text-[11px] text-[#8C8C8C] hover:text-obsidian-amber transition-colors cursor-pointer">Ver todo en Tráfico →</button>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
      ${renderKanbanCol('Urgentes', 'bg-rose-500', 'No hay OTs marcadas como urgentes.', urgentItems)}
      ${renderKanbanCol('Vencen hoy', 'bg-amber-400', 'No hay otras OTs con entrega para hoy.', todayItems)}
      ${renderKanbanCol('Vencen mañana', 'bg-sky-400', 'No hay otras OTs con entrega para mañana.', tomorrowItems)}
    </div>
  `;

  if (window.hydrateIcons) window.hydrateIcons(container);

  container.querySelector('#btn-desktop-go-traffic')?.addEventListener('click', () => {
    if (typeof onGoToTraffic === 'function') onGoToTraffic();
  });

  container.querySelectorAll('[data-desktop-edit-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openOt(btn.dataset.desktopEditOt);
    });
  });

  container.querySelectorAll('[data-desktop-open-row]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button, a, [data-desktop-edit-ot]')) return;
      renderTrafficNotesInspector(card.dataset.desktopOpenRow, '', false, {
        onOpenOt: (otId, taskIdx) => openOt(otId, taskIdx),
      });
    });
  });
}
