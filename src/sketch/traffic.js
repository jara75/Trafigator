/**
 * Traffic view: client/brand tree (#left-traffic-tree) and 11-column OT/Task grid (#view-traffic).
 */

import {
  clientsData,
  trafficStatuses,
  trafficMembers,
  trafficOrders,
  sketchState,
  escapeHtml,
  relDate,
  getClientColor,
  ensureOtData,
  onSketchChange,
  notifySketchChange,
} from './store.js';

let trafficInitialized = false;
let onOpenOtCallback = null;

/**
 * Normalize an ISO-like date string to the `YYYY-MM-DDTHH:mm` format expected by `<input type="datetime-local">`.
 */
function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function formatDayLabel(iso) {
  if (!iso) return 'Sin fecha';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

function populateTrafficFilterSelects() {
  const statusFilterSel = document.getElementById('traffic-status-filter');
  if (statusFilterSel) {
    const prev = statusFilterSel.value || sketchState.trafficStatusFilter || 'all';
    statusFilterSel.innerHTML =
      '<option value="all">Todos</option>' +
      trafficStatuses.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    statusFilterSel.value = trafficStatuses.includes(prev) ? prev : 'all';
  }

  const respFilterSel = document.getElementById('traffic-resp-filter');
  if (respFilterSel) {
    const prev = respFilterSel.value || sketchState.trafficRespFilter || 'all';
    respFilterSel.innerHTML =
      '<option value="all">Todos</option>' +
      trafficMembers.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
    respFilterSel.value = trafficMembers.includes(prev) ? prev : 'all';
  }
}

function notifyActiveScopeAfterTreeFilter() {
  if (['gallery', 'documents', 'dev'].includes(sketchState.trafficScope)) {
    sketchState.galleryPage = 1;
    sketchState.activePieceIndex = 0;
    notifySketchChange('gallery', { filter: sketchState.trafficFilter });
  } else if (sketchState.trafficScope === 'my-tasks') {
    notifySketchChange('stripboard', { filter: sketchState.trafficFilter });
  } else {
    renderTrafficGrid();
  }
}

/**
 * Render the left-hand client/brand filter tree (#traffic-tree-container).
 */
export function renderTrafficTree() {
  const treeContainer = document.getElementById('traffic-tree-container');
  const countAllEl = document.getElementById('traffic-count-all');
  const btnAll = document.getElementById('btn-traffic-all');
  if (!treeContainer) return;

  const scopedOrders = trafficOrders.filter((o) =>
    sketchState.trafficScope === 'archived' ? !!o.archived : !o.archived
  );
  if (countAllEl) countAllEl.textContent = String(scopedOrders.length);
  if (btnAll) {
    const isAll = sketchState.trafficFilter.type === 'all';
    btnAll.classList.toggle('bg-obsidian-elevated', isAll);
    btnAll.classList.toggle('text-[#D4D4D4]', isAll);
    btnAll.classList.toggle('text-[#8C8C8C]', !isAll);
    btnAll.classList.toggle('hover:bg-obsidian-elevated', !isAll);
  }

  treeContainer.innerHTML = clientsData
    .map((client) => {
      const brandNames = Object.keys(client.brands || {});
      const isClientActive =
        sketchState.trafficFilter.type === 'client' && sketchState.trafficFilter.client === client.name;
      const isCollapsed = sketchState.collapsedTrafficClients.has(client.name);

      return `
        <div class="select-none">
          <div
            data-tree-client="${escapeHtml(client.name)}"
            class="traffic-client-row mt-4 py-1 pr-[5px] text-[10px] font-normal uppercase tracking-[0.12em] flex items-center justify-between gap-2 cursor-pointer transition-colors ${isClientActive ? 'text-[#D4D4D4]' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}"
          >
            <span class="flex items-center gap-1.5 min-w-0">
              <span class="w-1 h-1 rounded-full shrink-0" style="background:${escapeHtml(client.color || '#8C8C8C')}"></span>
              <span class="truncate">${escapeHtml(client.name)}</span>
            </span>
            ${brandNames.length ? `
              <button type="button" data-toggle-client="${escapeHtml(client.name)}" class="traffic-toggle-btn flex items-center justify-center text-[#8C8C8C] hover:text-[#D4D4D4] shrink-0 cursor-pointer">
                <span data-icon="${isCollapsed ? 'chevron-right' : 'chevron-down'}" data-icon-size="w-3 h-3"></span>
              </button>
            ` : ''}
          </div>
          ${brandNames.length && !isCollapsed ? `
            <div class="flex flex-col gap-0.5">
              ${brandNames
                .map((brand) => {
                  const isBrandActive =
                    sketchState.trafficFilter.type === 'brand' &&
                    sketchState.trafficFilter.client === client.name &&
                    sketchState.trafficFilter.brand === brand;
                  return `
                    <button
                      type="button"
                      data-tree-brand="${escapeHtml(brand)}"
                      data-tree-brand-client="${escapeHtml(client.name)}"
                      class="traffic-brand-row w-full pl-2.5 pr-[5px] py-1.5 rounded-lg flex items-center gap-2 text-[11.5px] transition-colors cursor-pointer ${isBrandActive ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}"
                    >
                      <span class="truncate">${escapeHtml(brand)}</span>
                    </button>
                  `;
                })
                .join('')}
            </div>
          ` : ''}
        </div>
      `;
    })
    .join('');

  if (window.hydrateIcons) window.hydrateIcons(treeContainer);

  treeContainer.querySelectorAll('.traffic-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cName = btn.dataset.toggleClient;
      if (sketchState.collapsedTrafficClients.has(cName)) {
        sketchState.collapsedTrafficClients.delete(cName);
      } else {
        sketchState.collapsedTrafficClients.add(cName);
      }
      renderTrafficTree();
    });
  });

  treeContainer.querySelectorAll('.traffic-client-row').forEach((row) => {
    row.addEventListener('click', () => {
      sketchState.trafficFilter = { type: 'client', client: row.dataset.treeClient, brand: null };
      renderTrafficTree();
      notifyActiveScopeAfterTreeFilter();
    });
  });

  treeContainer.querySelectorAll('.traffic-brand-row').forEach((row) => {
    row.addEventListener('click', () => {
      sketchState.trafficFilter = {
        type: 'brand',
        client: row.dataset.treeBrandClient,
        brand: row.dataset.treeBrand,
      };
      renderTrafficTree();
      notifyActiveScopeAfterTreeFilter();
    });
  });
}

/**
 * Render the 11-column traffic / all-tasks / archived grid (#traffic-table-body).
 */
export function renderTrafficGrid() {
  const tbody = document.getElementById('traffic-table-body');
  const titleEl = document.getElementById('traffic-filter-title');
  const countEl = document.getElementById('traffic-visible-count');
  if (!tbody) return;

  const isTasksScope = sketchState.trafficScope === 'all-tasks';
  let filtered = [];

  if (isTasksScope) {
    trafficOrders
      .filter((o) => !o.archived)
      .forEach((ot) => {
        ensureOtData(ot);
        (ot.subtasks || []).forEach((st, idx) => {
          filtered.push({
            id: `${ot.id}-${idx + 1}`,
            otId: ot.id,
            taskIndex: idx,
            client: ot.client,
            brand: ot.brand,
            product: ot.product,
            media: ot.media,
            ref: ot.ref,
            title: st.title,
            entryDate: st.entryDate || ot.entryDate,
            deliveryDate: st.deliveryDate || ot.deliveryDate,
            status: st.status || ot.status,
            responsible: st.responsible || ot.responsible,
            notes: st.notes || '',
          });
        });
      });
  } else {
    filtered = trafficOrders.filter((o) =>
      sketchState.trafficScope === 'archived' ? !!o.archived : !o.archived
    );
  }

  let label =
    sketchState.trafficScope === 'archived'
      ? 'Todas las Archivadas'
      : isTasksScope
        ? 'Todas las Tareas'
        : 'Todas las OTs';

  if (sketchState.trafficFilter.type === 'client') {
    filtered = filtered.filter((o) => o.client === sketchState.trafficFilter.client);
    label = sketchState.trafficFilter.client;
  } else if (sketchState.trafficFilter.type === 'brand') {
    filtered = filtered.filter(
      (o) => o.client === sketchState.trafficFilter.client && o.brand === sketchState.trafficFilter.brand
    );
    label = `${sketchState.trafficFilter.client} · ${sketchState.trafficFilter.brand}`;
  }

  if (sketchState.trafficSearchQuery) {
    const q = sketchState.trafficSearchQuery.toLowerCase();
    filtered = filtered.filter((o) =>
      [o.id, o.client, o.brand, o.product, o.media, o.ref, o.title, o.responsible, o.status, o.notes].some((v) =>
        String(v || '').toLowerCase().includes(q)
      )
    );
  }

  const todayKey = relDate(0).slice(0, 10);
  const tomorrowKey = relDate(1).slice(0, 10);
  const recentCutoffKey = relDate(-2).slice(0, 10);

  if (sketchState.trafficDateFilter === 'today') {
    filtered = filtered.filter((o) => (o.deliveryDate || '').slice(0, 10) === todayKey);
  } else if (sketchState.trafficDateFilter === 'tomorrow') {
    filtered = filtered.filter((o) => (o.deliveryDate || '').slice(0, 10) === tomorrowKey);
  } else if (sketchState.trafficDateFilter === 'recent') {
    filtered = filtered.filter((o) => (o.entryDate || '').slice(0, 10) >= recentCutoffKey);
  }

  if (sketchState.trafficStatusFilter !== 'all') {
    filtered = filtered.filter((o) => o.status === sketchState.trafficStatusFilter);
  }
  if (sketchState.trafficRespFilter !== 'all') {
    filtered = filtered.filter((o) => o.responsible === sketchState.trafficRespFilter);
  }

  filtered.sort((a, b) => {
    const da = a.entryDate || '';
    const db = b.entryDate || '';
    return sketchState.trafficSortBy === 'oldest' ? da.localeCompare(db) : db.localeCompare(da);
  });

  if (titleEl) titleEl.textContent = label;
  if (countEl) {
    const unit = isTasksScope
      ? filtered.length === 1 ? 'Tarea' : 'Tareas'
      : filtered.length === 1 ? 'OT' : 'OTs';
    countEl.textContent = `${filtered.length} ${unit}`;
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-[11px] text-[#8C8C8C]">No hay ${isTasksScope ? 'tareas' : 'OTs'} que coincidan con estos filtros.</td></tr>`;
    return;
  }

  const renderOtRow = (ot, idx) => {
    const zebra = idx % 2 === 1 ? 'bg-[#262626]' : 'bg-[#1d1d1d]';
    const cColor = getClientColor(ot.client);
    const realOtId = ot.otId || ot.id;
    const taskIdxAttr = ot.taskIndex !== undefined ? ot.taskIndex : '';
    const entryVal = toDatetimeLocalValue(ot.entryDate);
    const deliveryVal = toDatetimeLocalValue(ot.deliveryDate);

    return `
      <tr data-traffic-open-row="${escapeHtml(realOtId)}" data-traffic-open-task="${taskIdxAttr}" class="${zebra} hover:bg-obsidian-elevated/70 transition-colors text-[10.5px] cursor-pointer">
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <button type="button" data-traffic-open-ot="${escapeHtml(ot.id)}" class="w-full font-mono font-semibold text-obsidian-amber px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border hover:border-obsidian-amber/60 whitespace-nowrap block text-center cursor-pointer transition-colors">${escapeHtml(ot.id)}</button>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-medium truncate" title="${escapeHtml(ot.client)}">
          <span class="inline-flex items-center gap-1.5 max-w-full">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
            <span class="truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
          </span>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate" title="${escapeHtml(ot.brand)}${ot.product && ot.product !== ot.brand ? ' • ' + escapeHtml(ot.product) : ''}">
          <span class="text-[#8C8C8C]">${escapeHtml(ot.brand)}</span>
          ${ot.product && ot.product !== ot.brand ? `<span class="text-[#5a6169]"> • </span><span class="text-[#8C8C8C]">${escapeHtml(ot.product)}</span>` : ''}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate" title="${escapeHtml(ot.media)}">${escapeHtml(ot.media)}</td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <span class="font-mono text-[#D4D4D4] px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border truncate block" title="${escapeHtml(ot.ref)}">${escapeHtml(ot.ref)}</span>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#D4D4D4]" title="${escapeHtml(ot.title)}">
          <div class="line-clamp-2 leading-tight">${escapeHtml(ot.title)}</div>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <input type="datetime-local" value="${escapeHtml(entryVal)}" data-ot-id="${escapeHtml(ot.id)}" data-field="entryDate" style="color-scheme: dark;" class="traffic-field-input w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#8C8C8C] font-mono text-center focus:border-[#3f3f3f] focus:outline-none">
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <input type="datetime-local" value="${escapeHtml(deliveryVal)}" data-ot-id="${escapeHtml(ot.id)}" data-field="deliveryDate" style="color-scheme: dark;" class="traffic-field-input w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#8C8C8C] font-mono text-center focus:border-[#3f3f3f] focus:outline-none">
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <select data-ot-id="${escapeHtml(ot.id)}" data-field="status" class="traffic-field-input w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#D4D4D4] focus:border-[#3f3f3f] focus:outline-none cursor-pointer">
            ${trafficStatuses.map((s) => `<option value="${escapeHtml(s)}" ${ot.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
          </select>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <select data-ot-id="${escapeHtml(ot.id)}" data-field="responsible" class="traffic-field-input w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#8C8C8C] focus:border-[#3f3f3f] focus:outline-none cursor-pointer">
            ${trafficMembers.map((d) => `<option value="${escapeHtml(d)}" ${ot.responsible === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
          </select>
        </td>
        <td class="px-1.5 py-1.5 align-middle">
          <input type="text" value="${escapeHtml(ot.notes)}" placeholder="Notas..." data-ot-id="${escapeHtml(ot.id)}" data-field="notes" class="traffic-field-input w-full bg-transparent border border-transparent hover:border-obsidian-border focus:border-[#3f3f3f] rounded px-1 py-0.5 text-[10px] text-[#8C8C8C] placeholder-[#5a6169] focus:outline-none truncate">
        </td>
      </tr>
    `;
  };

  if (sketchState.trafficGroupBy === 'none') {
    tbody.innerHTML = filtered.map((ot, idx) => renderOtRow(ot, idx)).join('');
  } else {
    const groups = new Map();
    filtered.forEach((ot) => {
      let key = 'Sin definir';
      if (sketchState.trafficGroupBy === 'client') key = ot.client || 'Sin cliente';
      else if (sketchState.trafficGroupBy === 'responsible') key = ot.responsible || 'Sin responsable';
      else if (sketchState.trafficGroupBy === 'entryDate') key = formatDayLabel(ot.entryDate);
      else if (sketchState.trafficGroupBy === 'deliveryDate') key = formatDayLabel(ot.deliveryDate);
      else if (sketchState.trafficGroupBy === 'media') key = ot.media || 'Sin medio';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ot);
    });

    tbody.innerHTML = Array.from(groups.entries())
      .map(
        ([groupName, items]) => `
        <tr class="bg-[#191919] border-y border-obsidian-border">
          <td colspan="11" class="px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-medium">
            <span class="text-[#D4D4D4]">${escapeHtml(groupName)}</span>
            <span class="ml-1.5 font-mono text-[#8C8C8C]">(${items.length})</span>
          </td>
        </tr>
        ${items.map((ot, idx) => renderOtRow(ot, idx)).join('')}
      `
      )
      .join('');
  }

  tbody.querySelectorAll('.traffic-field-input').forEach((el) => {
    el.addEventListener('change', () => {
      const row = el.closest('tr');
      const otId = row?.dataset.trafficOpenRow || el.dataset.otId;
      const tIdx = row?.dataset.trafficOpenTask;
      const target = trafficOrders.find((o) => o.id === otId);
      if (!target) return;

      const field = el.dataset.field;
      const val = el.value;

      if (field === 'entryDate' || field === 'deliveryDate') {
        const parsedIso = toDatetimeLocalValue(val);
        if (!parsedIso) {
          el.value = toDatetimeLocalValue(
            tIdx !== undefined && tIdx !== '' && target.subtasks?.[Number(tIdx)]
              ? target.subtasks[Number(tIdx)][field] || target[field]
              : target[field]
          );
          return;
        }
        if (tIdx !== undefined && tIdx !== '' && target.subtasks?.[Number(tIdx)]) {
          target.subtasks[Number(tIdx)][field] = parsedIso;
        } else {
          target[field] = parsedIso;
        }
        notifySketchChange('orders', { otId: target.id, field });
        return;
      }

      if (tIdx !== undefined && tIdx !== '' && target.subtasks?.[Number(tIdx)]) {
        target.subtasks[Number(tIdx)][field] = val;
      } else {
        target[field] = val;
        if (field === 'status') {
          target.archived = val === 'Archivada' || val === 'Cancelado';
        }
      }

      notifySketchChange('orders', { otId: target.id, field });
    });
  });

  const openOtFromTraffic = (otId, taskIdx = '') => {
    if (!otId) return;
    const parsedTaskIdx =
      taskIdx !== '' && taskIdx !== undefined && taskIdx !== null ? Number(taskIdx) : null;
    const payload = {
      otId,
      taskIndex: parsedTaskIdx,
      scope: sketchState.trafficScope === 'archived' ? 'archived' : 'traffic-open',
    };
    if (typeof onOpenOtCallback === 'function') {
      onOpenOtCallback(payload);
    } else {
      notifySketchChange('open-ot', payload);
    }
  };

  tbody.querySelectorAll('tr[data-traffic-open-row]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('input, select, textarea, a')) return;
      openOtFromTraffic(row.dataset.trafficOpenRow, row.dataset.trafficOpenTask);
    });
  });
}

function bindColResizers() {
  document.querySelectorAll('#traffic-table .traffic-col-resizer').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const th = handle.parentElement;
      if (!th) return;
      const startX = e.clientX;
      const startW = th.getBoundingClientRect().width;
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.classList.add('bg-obsidian-cyan');

      const onMove = (ev) => {
        const nextW = Math.max(36, Math.round(startW + (ev.clientX - startX)));
        th.style.width = nextW + 'px';
      };

      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        handle.classList.remove('bg-obsidian-cyan');
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  });
}

/**
 * Initialize traffic tree, grid filters, column resizers, and store subscriptions.
 */
export function initTraffic({ onOpenOt } = {}) {
  if (typeof onOpenOt === 'function') {
    onOpenOtCallback = onOpenOt;
  }

  if (trafficInitialized) {
    renderTrafficTree();
    renderTrafficGrid();
    return;
  }
  trafficInitialized = true;

  const searchInput = document.getElementById('traffic-search-input');
  const searchClear = document.getElementById('traffic-search-clear');

  searchInput?.addEventListener('input', () => {
    sketchState.trafficSearchQuery = searchInput.value.trim();
    searchClear?.classList.toggle('hidden', !sketchState.trafficSearchQuery);
    renderTrafficGrid();
  });

  searchClear?.addEventListener('click', () => {
    if (searchInput) searchInput.value = '';
    sketchState.trafficSearchQuery = '';
    searchClear.classList.add('hidden');
    renderTrafficGrid();
  });

  document.getElementById('traffic-group-by')?.addEventListener('change', (e) => {
    sketchState.trafficGroupBy = e.target.value;
    renderTrafficGrid();
  });

  document.getElementById('traffic-sort-by')?.addEventListener('change', (e) => {
    sketchState.trafficSortBy = e.target.value;
    renderTrafficGrid();
  });

  document.getElementById('traffic-date-filter')?.addEventListener('change', (e) => {
    sketchState.trafficDateFilter = e.target.value;
    renderTrafficGrid();
  });

  populateTrafficFilterSelects();

  document.getElementById('traffic-status-filter')?.addEventListener('change', (e) => {
    sketchState.trafficStatusFilter = e.target.value;
    renderTrafficGrid();
  });

  document.getElementById('traffic-resp-filter')?.addEventListener('change', (e) => {
    sketchState.trafficRespFilter = e.target.value;
    renderTrafficGrid();
  });

  document.getElementById('btn-traffic-all')?.addEventListener('click', () => {
    sketchState.trafficFilter = { type: 'all', client: null, brand: null };
    renderTrafficTree();
    notifyActiveScopeAfterTreeFilter();
  });

  document.getElementById('btn-traffic-collapse-all')?.addEventListener('click', () => {
    const allCollapsed = clientsData.every((c) => sketchState.collapsedTrafficClients.has(c.name));
    if (allCollapsed) sketchState.collapsedTrafficClients.clear();
    else clientsData.forEach((c) => sketchState.collapsedTrafficClients.add(c.name));
    renderTrafficTree();
  });

  bindColResizers();

  const refreshIfVisible = () => {
    const leftTree = document.getElementById('left-traffic-tree');
    const viewTraffic = document.getElementById('view-traffic');
    if (leftTree && !leftTree.classList.contains('hidden')) {
      renderTrafficTree();
    }
    if (viewTraffic && !viewTraffic.classList.contains('hidden')) {
      renderTrafficGrid();
    }
  };

  onSketchChange('orders', refreshIfVisible);
  onSketchChange('clients', refreshIfVisible);
  onSketchChange('team', () => {
    populateTrafficFilterSelects();
    refreshIfVisible();
  });

  renderTrafficTree();
  renderTrafficGrid();
}
