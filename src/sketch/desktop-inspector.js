/**
 * Inspector derecho en reposo para el Escritorio (#insp-content-slot):
 * - Pestañas: Mensajes | Actividad | Lista (drill-down desde Estadística)
 */

import {
  escapeHtml,
  formatShortDate,
  getClientColor,
  getDepartmentColor,
  getPriorityDotHtml,
} from './store.js';

export function buildInspectorIdleStreams({ scopedOrders, q4TraceFilter }) {
  const traceEvents = [];
  const globalMessages = [];

  scopedOrders.forEach((ot) => {
    const shortCode = String(ot.id || '').replace(/^OT-/i, '');
    const cColor = getClientColor(ot.client);
    const sortBase = ot.entryDate || '';

    if (q4TraceFilter === 'all' || q4TraceFilter === 'routes') {
      (ot.routes || []).forEach((rt, idx) => {
        traceEvents.push({
          kind: 'route',
          otId: ot.id,
          shortCode,
          client: ot.client,
          clientColor: cColor,
          actor: rt.sign || ot.responsible || 'Sistema',
          at: rt.date || formatShortDate(ot.entryDate) || '—',
          from: rt.from || '—',
          to: rt.to || '—',
          text: rt.notes || rt.desc || ot.title,
          sortKey: `${sortBase}-r-${String(idx).padStart(2, '0')}`,
        });
      });
    }

    if (q4TraceFilter === 'all' || q4TraceFilter === 'activity') {
      (ot.activityLog || []).slice(0, 3).forEach((ev, idx) => {
        traceEvents.push({
          kind: 'activity',
          otId: ot.id,
          shortCode,
          client: ot.client,
          clientColor: cColor,
          actor: ev.actor || ot.responsible || 'Sistema',
          at: ev.at || '—',
          text: ev.text || '',
          sortKey: `${sortBase}-a-${String(99 - idx).padStart(2, '0')}`,
        });
      });
    }

    (ot.messages || []).forEach((msg, idx) => {
      const sortKey = msg.createdAt
        ? `3-${msg.createdAt}`
        : `${msg.priority === 'urgent' ? '2' : (msg.priority === 'important' ? '1' : '0')}-${ot.entryDate || ''}-${String(idx).padStart(2, '0')}`;
      globalMessages.push({
        otId: ot.id,
        shortCode,
        client: ot.client,
        clientColor: cColor,
        actor: msg.actor || ot.responsible || 'Equipo',
        channel: msg.channel || 'App',
        at: msg.at || '',
        text: msg.text || '',
        priority: msg.priority || null,
        sortKey,
      });
    });
  });

  traceEvents.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  globalMessages.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return {
    visibleTrace: traceEvents.slice(0, 30),
    visibleMessages: globalMessages.slice(0, 30),
  };
}

function getInitials(name) {
  return String(name || '?').trim().split(/\s+/).map((p) => p[0] || '').join('').slice(0, 2).toUpperCase();
}

export function renderDesktopIdleInspector({
  inspContentSlot,
  activeStatsDrill,
  inspIdleTab,
  visibleMessages,
  visibleTrace,
  q4TraceFilter,
  todayKey,
  tomorrowKey,
  onChangeTab,
  onClearDrill,
  onChangeTraceFilter,
  onOpenOt,
  onSelectDrillOt,
  onSelectIdleOt,
}) {
  if (!inspContentSlot) return;

  if (activeStatsDrill && inspIdleTab === 'drill') {
    inspContentSlot.innerHTML = `
      <div class="flex flex-col gap-2">
        <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-obsidian-border sticky top-0 bg-[#191919] z-10">
          <div class="inline-flex items-center gap-0.5 text-[9px] font-mono w-full">
            <button type="button" data-dk-insp-tab="messages"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center text-[#737373] hover:text-[#D4D4D4]">Mensajes <span class="text-[#5A5A5A]">${visibleMessages.length}</span></button>
            <button type="button" data-dk-insp-tab="activity"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center text-[#737373] hover:text-[#D4D4D4]">Actividad <span class="text-[#5A5A5A]">${visibleTrace.length}</span></button>
            <button type="button" data-dk-insp-tab="drill"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center bg-obsidian-elevated text-[#D4D4D4] font-semibold">Lista <span class="text-obsidian-amber">${activeStatsDrill.items.length}</span></button>
          </div>
        </div>

        <div class="pb-1.5 border-b border-obsidian-border/70">
          <div class="flex items-start justify-between gap-1.5">
            <div class="min-w-0">
              <div class="font-mono text-[8px] uppercase tracking-wider text-obsidian-amber truncate">${escapeHtml(activeStatsDrill.category)} · ${escapeHtml(activeStatsDrill.boardTitle)}</div>
              <div class="text-[11px] font-semibold text-[#F0F0F0] truncate mt-0.5">${escapeHtml(activeStatsDrill.title)}</div>
              <div class="font-mono text-[8.5px] text-[#8C8C8C] mt-0.5">${activeStatsDrill.items.length} ${escapeHtml(activeStatsDrill.itemNoun)} · <span class="text-[#D4D4D4]">${activeStatsDrill.totalHours}h</span></div>
            </div>
            <button type="button" data-dk-insp-clear-drill="1" title="Cerrar lista" aria-label="Cerrar lista"
              class="w-6 h-6 rounded-md text-[#8C8C8C] hover:text-white hover:bg-obsidian-elevated flex items-center justify-center cursor-pointer transition-colors shrink-0">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <div class="flex flex-col gap-1">
          ${activeStatsDrill.items.length
            ? activeStatsDrill.items.map((it, idx) => {
                const hasOt = !!it.otId;
                const shortCode = hasOt
                  ? (it.taskIndex !== null && it.taskIndex !== undefined
                      ? `${String(it.otId || '').replace(/^OT-/i, '')}.${it.taskIndex + 1}`
                      : String(it.otId || '').replace(/^OT-/i, ''))
                  : (it.badge || 'LIBRE');
                const cColor = it.client === 'Estudio' ? '#a855f7' : (it.client === 'Agenda' ? '#94a3b8' : getClientColor(it.client));
                const dKey = (it.deliveryDate || '').slice(0, 10);
                const isOverdue = hasOt && dKey && dKey < todayKey;
                const isTodayDue = dKey === todayKey;
                const dateLbl = dKey ? `${dKey.slice(8, 10)}/${dKey.slice(5, 7)}` : '—';
                const otAttrs = hasOt
                  ? `data-dk-drill-select-ot="${escapeHtml(it.otId)}" data-dk-drill-task-idx="${it.taskIndex !== null && it.taskIndex !== undefined ? it.taskIndex : ''}" data-dk-drill-key="drill:${escapeHtml(it.id)}:${idx}"`
                  : '';
                return `
                  <div ${otAttrs}
                    class="px-2 py-1.5 rounded-md bg-[#202020] ${hasOt ? 'hover:bg-[#262626] cursor-pointer' : ''} border border-obsidian-border/70 transition-colors flex flex-col gap-0.5">
                    <div class="flex items-center justify-between gap-1">
                      <span class="inline-flex items-center gap-1 min-w-0">
                        ${hasOt ? getPriorityDotHtml(it, todayKey, tomorrowKey, 'w-1.5 h-1.5') : ''}
                        ${hasOt
                          ? `<button type="button" data-dk-drill-open-ot="${escapeHtml(it.otId)}" data-dk-drill-open-task="${it.taskIndex !== null && it.taskIndex !== undefined ? it.taskIndex : ''}" title="Abrir OT"
                              class="font-mono text-[9.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortCode)}</button>`
                          : `<span class="font-mono text-[8.5px] font-semibold text-[#A3A3A3] shrink-0">${escapeHtml(shortCode)}</span>`}
                        <span class="font-mono text-[8px] text-[#737373] shrink-0">${Number(it.hours) || 0}h</span>
                      </span>
                      <span class="font-mono text-[8.5px] ${isOverdue ? 'text-rose-300 font-semibold' : (isTodayDue ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]')} shrink-0">${escapeHtml(dateLbl)}</span>
                    </div>
                    <div class="text-[10px] text-[#D4D4D4] line-clamp-2 leading-snug" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</div>
                    <div class="flex items-center justify-between gap-1 text-[8.5px]">
                      <span class="truncate font-medium" style="color:${escapeHtml(cColor)}">${escapeHtml(it.client)}</span>
                      <span class="truncate shrink-0 text-[#8C8C8C]">${escapeHtml(it.responsible)}</span>
                    </div>
                  </div>
                `;
              }).join('')
            : `<div class="py-4 text-center text-[9.5px] font-mono text-[#5A5A5A]">Sin elementos</div>`
          }
        </div>
      </div>
    `;

    inspContentSlot.querySelectorAll('[data-dk-insp-tab]').forEach((btn) => {
      btn.addEventListener('click', () => onChangeTab(btn.dataset.dkInspTab));
    });

    inspContentSlot.querySelector('[data-dk-insp-clear-drill]')?.addEventListener('click', () => {
      onClearDrill();
    });

    inspContentSlot.querySelectorAll('[data-dk-drill-open-ot]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tIdx = btn.dataset.dkDrillOpenTask !== '' ? Number(btn.dataset.dkDrillOpenTask) : null;
        onOpenOt(btn.dataset.dkDrillOpenOt, tIdx);
      });
    });

    inspContentSlot.querySelectorAll('[data-dk-drill-select-ot]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const otId = row.dataset.dkDrillSelectOt;
        const tIdx = row.dataset.dkDrillTaskIdx !== '' ? Number(row.dataset.dkDrillTaskIdx) : null;
        onSelectDrillOt({ otId, taskIdx: tIdx, key: row.dataset.dkDrillKey });
      });
      row.addEventListener('dblclick', () => {
        const tIdx = row.dataset.dkDrillTaskIdx !== '' ? Number(row.dataset.dkDrillTaskIdx) : null;
        onOpenOt(row.dataset.dkDrillSelectOt, tIdx);
      });
    });
    return;
  }

  inspContentSlot.innerHTML = `
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-1 pb-1.5 border-b border-obsidian-border sticky top-0 bg-[#191919] z-10">
        <div class="inline-flex items-center gap-0.5 text-[9px] font-mono w-full">
          <button type="button" data-dk-insp-tab="messages"
            class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center ${inspIdleTab === 'messages' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Mensajes <span class="${inspIdleTab === 'messages' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${visibleMessages.length}</span></button>
          <button type="button" data-dk-insp-tab="activity"
            class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center ${inspIdleTab === 'activity' ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">Actividad <span class="${inspIdleTab === 'activity' ? 'text-[#A3A3A3]' : 'text-[#5A5A5A]'}">${visibleTrace.length}</span></button>
          ${activeStatsDrill ? `
            <button type="button" data-dk-insp-tab="drill"
              class="flex-1 px-1 py-0.5 rounded transition-colors cursor-pointer text-center text-[#737373] hover:text-[#D4D4D4]">Lista <span class="text-obsidian-amber">${activeStatsDrill.items.length}</span></button>
          ` : ''}
        </div>
      </div>

      ${inspIdleTab === 'messages'
        ? `
          <div class="flex flex-col gap-1">
            ${visibleMessages.length
              ? visibleMessages.map((msg, idx) => {
                  const isUrg = msg.priority === 'urgent';
                  const isImp = msg.priority === 'important';
                  const accentCls = isUrg
                    ? 'border-l-2 border-l-rose-400 bg-rose-500/5 hover:bg-rose-500/10'
                    : (isImp
                        ? 'border-l-2 border-l-obsidian-amber bg-amber-500/5 hover:bg-amber-500/10'
                        : 'hover:bg-[#222222]');
                  const chLabel = msg.channel === 'WhatsApp'
                    ? 'WA'
                    : (msg.channel === 'Cliente' ? 'Cli' : 'App');
                  return `
                    <div data-dk-insp-select-ot="${escapeHtml(msg.otId)}" data-dk-insp-key="msg:${escapeHtml(msg.otId)}:${idx}"
                      class="px-1.5 py-1.5 rounded-md ${accentCls} transition-colors cursor-pointer flex items-start gap-1.5">
                      <span class="w-4 h-4 rounded-full bg-[#242424] border border-obsidian-border text-[7.5px] font-mono font-semibold text-[#D4D4D4] flex items-center justify-center shrink-0 mt-0.5">${escapeHtml(getInitials(msg.actor))}</span>
                      <div class="min-w-0 flex-1 leading-snug">
                        <div class="flex items-center justify-between gap-1">
                          <span class="inline-flex items-center gap-1 min-w-0">
                            <span class="text-[9.5px] font-semibold text-[#D4D4D4] truncate">${escapeHtml(msg.actor)}</span>
                            <button type="button" data-dk-insp-open-ot="${escapeHtml(msg.otId)}" title="Abrir OT"
                              class="font-mono text-[8.5px] text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(msg.shortCode)}</button>
                            <span class="px-1 rounded bg-[#141414] font-mono text-[7px] text-[#737373] shrink-0">${chLabel}</span>
                          </span>
                          <span class="font-mono text-[7.5px] text-[#5A5A5A] shrink-0">${escapeHtml(msg.at)}</span>
                        </div>
                        <div class="text-[9.5px] text-[#B8B8B8] line-clamp-2 mt-0.5">${escapeHtml(msg.text)}</div>
                      </div>
                    </div>
                  `;
                }).join('')
              : `<div class="py-4 text-center text-[9.5px] font-mono text-[#5A5A5A]">Sin mensajes</div>`
            }
          </div>
        `
        : `
          <div class="inline-flex items-center bg-[#141414] border border-obsidian-border rounded-md p-0.5 text-[8.5px] font-mono self-start">
            ${[
              ['all', 'Todo'],
              ['routes', 'Bitácora'],
              ['activity', 'Cambios'],
            ].map(([key, lbl]) => `
              <button type="button" data-dk-insp-filter="${key}"
                class="px-1.5 py-0.5 rounded transition-colors cursor-pointer ${q4TraceFilter === key ? 'bg-obsidian-elevated text-[#D4D4D4] font-semibold' : 'text-[#737373] hover:text-[#D4D4D4]'}">${escapeHtml(lbl)}</button>
            `).join('')}
          </div>
          <div class="flex flex-col gap-1">
            ${visibleTrace.length
              ? visibleTrace.map((ev, idx) => {
                  const badgeHtml = ev.kind === 'route'
                    ? `<div class="font-mono text-[8.5px] truncate mt-0.5">
                        <span style="color:${escapeHtml(getDepartmentColor(ev.from))}">${escapeHtml(ev.from)}</span>
                        <span class="text-[#5A5A5A]">→</span>
                        <span style="color:${escapeHtml(getDepartmentColor(ev.to))}">${escapeHtml(ev.to)}</span>
                      </div>`
                    : `<div class="text-[9px] text-[#8C8C8C] line-clamp-2 mt-0.5">${escapeHtml(ev.text)}</div>`;
                  return `
                    <div data-dk-insp-select-ot="${escapeHtml(ev.otId)}" data-dk-insp-key="trace:${escapeHtml(ev.otId)}:${idx}"
                      class="px-2 py-1.5 rounded-md bg-[#202020] hover:bg-[#262626] border border-obsidian-border/60 cursor-pointer transition-colors">
                      <div class="flex items-center justify-between gap-1">
                        <span class="inline-flex items-center gap-1 min-w-0">
                          <button type="button" data-dk-insp-open-ot="${escapeHtml(ev.otId)}" title="Abrir OT"
                            class="font-mono text-[9px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(ev.shortCode)}</button>
                          <span class="text-[9px] text-[#D4D4D4] truncate">${escapeHtml(ev.actor)}</span>
                        </span>
                        <span class="font-mono text-[7.5px] text-[#5A5A5A] shrink-0">${escapeHtml(ev.at)}</span>
                      </div>
                      ${badgeHtml}
                    </div>
                  `;
                }).join('')
              : `<div class="py-4 text-center text-[9.5px] font-mono text-[#5A5A5A]">Sin movimientos</div>`
            }
          </div>
        `
      }
    </div>
  `;

  inspContentSlot.querySelectorAll('[data-dk-insp-tab]').forEach((btn) => {
    btn.addEventListener('click', () => onChangeTab(btn.dataset.dkInspTab));
  });

  inspContentSlot.querySelectorAll('[data-dk-insp-filter]').forEach((btn) => {
    btn.addEventListener('click', () => onChangeTraceFilter(btn.dataset.dkInspFilter));
  });

  inspContentSlot.querySelectorAll('[data-dk-insp-open-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onOpenOt(btn.dataset.dkInspOpenOt, null);
    });
  });

  inspContentSlot.querySelectorAll('[data-dk-insp-select-ot]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      onSelectIdleOt({ otId: row.dataset.dkInspSelectOt, key: row.dataset.dkInspKey });
    });
    row.addEventListener('dblclick', () => onOpenOt(row.dataset.dkInspSelectOt, null));
  });
}
