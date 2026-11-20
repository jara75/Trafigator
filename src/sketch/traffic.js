/**
 * Traffic view: client/brand tree (#left-traffic-tree) and 11-column OT/Task grid (#view-traffic).
 */

import {
  clientsData,
  trafficDepartments,
  trafficStages,
  trafficStatuses,
  trafficMembers,
  trafficOrders,
  sketchState,
  escapeHtml,
  formatShortDate,
  relDate,
  shiftIsoDate,
  getClientColor,
  getDepartmentColor,
  getPriorityDotHtml,
  getStageColor,
  bindTableColResizers,
  getStatusColor,
  ensureOtData,
  matchesCommonTrafficFilters,
  renderOtActivityHtml,
  sortTrafficItemsByEntryDate,
  onSketchChange,
  notifySketchChange,
} from './store.js';
import {
  bindGanttScaleEvents,
  bindKanbanScheduleEvents,
  bindScheduleNavEvents,
  formatLongDayHeading,
  renderGanttScheduleHtml,
  renderInspectorMiniCalendar,
  renderKanbanScheduleHtml,
  renderMonthScheduleHtml,
  renderScheduleNavHeader,
  renderWeekScheduleHtml,
  shiftScheduleDate,
} from './schedule-views.js';

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

function notifyActiveScopeAfterTreeFilter() {
  if (['gallery', 'documents', 'dev'].includes(sketchState.trafficScope)) {
    sketchState.galleryPage = 1;
    sketchState.activePieceIndex = 0;
    notifySketchChange('gallery', { filter: sketchState.trafficFilter });
  } else if (sketchState.trafficScope === 'my-tasks') {
    notifySketchChange('stripboard', { filter: sketchState.trafficFilter });
  } else if (sketchState.trafficScope === 'my-ots') {
    notifySketchChange('orders', { filter: sketchState.trafficFilter });
  } else {
    renderTrafficGrid();
  }
}

function renderLeftSelectRow(id, label, optionsHtml) {
  return `
    <label class="flex flex-col gap-1">
      <span class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C]">${escapeHtml(label)}</span>
      <select id="${escapeHtml(id)}" class="w-full h-7 bg-[#222222] border border-obsidian-border rounded-lg px-2 text-[11px] text-[#D4D4D4] focus:border-[#3f3f3f] focus:outline-none cursor-pointer">
        ${optionsHtml}
      </select>
    </label>
  `;
}

/**
 * Render the left-hand module filters (#traffic-tree-container) replacing the old client/brand tree.
 */
export function renderTrafficTree() {
  const treeContainer = document.getElementById('traffic-tree-container');
  const btnAll = document.getElementById('btn-traffic-all');
  if (btnAll) btnAll.classList.add('hidden');
  if (!treeContainer) return;

  const isMyOtsScope = sketchState.trafficScope === 'my-ots';
  const isMyTasksScope = sketchState.trafficScope === 'my-tasks';
  const isTrafficFamily = !['gallery', 'documents', 'dev'].includes(sketchState.trafficScope);
  const selectedClient = sketchState.trafficFilter.client || 'all';
  const selectedBrand = sketchState.trafficFilter.brand || 'all';

  const availableBrands = selectedClient !== 'all'
    ? Object.keys(clientsData.find((c) => c.name === selectedClient)?.brands || {})
    : Array.from(new Set(clientsData.flatMap((c) => Object.keys(c.brands || {}))));

  const clientOptions = [
    `<option value="all" ${selectedClient === 'all' ? 'selected' : ''}>Todos</option>`,
    ...clientsData.map((c) => `<option value="${escapeHtml(c.name)}" ${selectedClient === c.name ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
  ].join('');

  const brandOptions = [
    `<option value="all" ${selectedBrand === 'all' ? 'selected' : ''}>Todas</option>`,
    ...availableBrands.map((b) => `<option value="${escapeHtml(b)}" ${selectedBrand === b ? 'selected' : ''}>${escapeHtml(b)}</option>`)
  ].join('');

  let extraFiltersHtml = '';
  if (isTrafficFamily) {
    const deptOpts = ['<option value="all">Todos</option>', ...trafficDepartments.map((d) => `<option value="${escapeHtml(d)}" ${sketchState.trafficDeptFilter === d ? 'selected' : ''}>${escapeHtml(d)}</option>`)].join('');
    const stageOpts = ['<option value="all">Todas</option>', ...trafficStages.map((s) => `<option value="${escapeHtml(s)}" ${sketchState.trafficStageFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`)].join('');
    const statusOpts = ['<option value="all">Todos</option>', ...trafficStatuses.map((s) => `<option value="${escapeHtml(s)}" ${sketchState.trafficStatusFilter === s ? 'selected' : ''}>${escapeHtml(s)}</option>`)].join('');
    const respOpts = ['<option value="all">Todos</option>', ...trafficMembers.map((m) => `<option value="${escapeHtml(m)}" ${sketchState.trafficRespFilter === m ? 'selected' : ''}>${escapeHtml(m)}</option>`)].join('');

    const dateValues = [
      ['all', 'Todas'],
      ['urgent-today-tomorrow', 'Urgentes · Hoy · Mañana'],
      ['urgent-today', 'Urgentes y vencen hoy'],
      ['urgent', 'Solo urgentes'],
      ['recent', 'Recientes'],
      ['today', 'Vence hoy'],
      ['tomorrow', 'Vencen mañana'],
    ];
    const dateOpts = dateValues.map(([val, lbl]) => `<option value="${val}" ${sketchState.trafficDateFilter === val ? 'selected' : ''}>${lbl}</option>`).join('');

    const groupValues = [
      ['none', 'Sin agrupar'],
      ['priority', 'Prioridad / Entrega'],
      ['client', 'Cliente'],
      ['department', 'Depto.'],
      ['stage', 'Etapa'],
      ['status', 'Estado'],
      ['responsible', 'Responsable'],
      ['entryDate', 'Entrada'],
      ['deliveryDate', 'Entrega'],
      ['media', 'Medio'],
    ];
    const activeGroupBy = isMyOtsScope
      ? (sketchState.myOtsGroupBy || 'status')
      : (isMyTasksScope ? (sketchState.stripboardGroupBy || 'none') : sketchState.trafficGroupBy);
    const groupOpts = groupValues.map(([val, lbl]) => `<option value="${val}" ${activeGroupBy === val ? 'selected' : ''}>${lbl}</option>`).join('');

    const sortOpts = `
      <option value="newest" ${sketchState.trafficSortBy === 'newest' ? 'selected' : ''}>De la más reciente a la más antigua</option>
      <option value="oldest" ${sketchState.trafficSortBy === 'oldest' ? 'selected' : ''}>De la más antigua a la más reciente</option>
    `;

    extraFiltersHtml = `
      ${renderLeftSelectRow('left-filter-dept', 'Depto.', deptOpts)}
      ${renderLeftSelectRow('left-filter-stage', 'Etapa', stageOpts)}
      ${renderLeftSelectRow('left-filter-status', 'Estado', statusOpts)}
      ${(isMyOtsScope || isMyTasksScope) ? '' : renderLeftSelectRow('left-filter-resp', 'Responsable', respOpts)}
      ${renderLeftSelectRow('left-filter-date', 'Prioridad / Fecha', dateOpts)}
      <div class="pt-1 border-t border-obsidian-border"></div>
      ${renderLeftSelectRow('left-filter-group', 'Agrupar por', groupOpts)}
      ${renderLeftSelectRow('left-filter-sort', 'Ordenar', sortOpts)}
    `;
  }

  treeContainer.innerHTML = `
    <div class="flex flex-col gap-2.5 pt-1">
      <div class="flex items-center justify-between">
        <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C]">Filtros</span>
        <button type="button" id="btn-left-filters-clear" class="text-[10px] text-[#8C8C8C] hover:text-obsidian-amber transition-colors cursor-pointer">Limpiar</button>
      </div>
      ${renderLeftSelectRow('left-filter-client', 'Cliente', clientOptions)}
      ${renderLeftSelectRow('left-filter-brand', 'Marca', brandOptions)}
      ${extraFiltersHtml}
    </div>
  `;

  treeContainer.querySelector('#btn-left-filters-clear')?.addEventListener('click', () => {
    sketchState.trafficFilter = { type: 'all', client: null, brand: null };
    sketchState.trafficDeptFilter = 'all';
    sketchState.trafficStageFilter = 'all';
    sketchState.trafficStatusFilter = 'all';
    sketchState.trafficRespFilter = 'all';
    sketchState.trafficDateFilter = 'all';
    sketchState.trafficSearchQuery = '';
    const searchInput = document.getElementById('traffic-search-input');
    const searchClear = document.getElementById('traffic-search-clear');
    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.classList.add('hidden');
    renderTrafficTree();
    notifyActiveScopeAfterTreeFilter();
  });

  treeContainer.querySelector('#left-filter-client')?.addEventListener('change', (e) => {
    const val = e.target.value;
    sketchState.trafficFilter = val === 'all'
      ? { type: 'all', client: null, brand: null }
      : { type: 'client', client: val, brand: null };
    renderTrafficTree();
    notifyActiveScopeAfterTreeFilter();
  });

  treeContainer.querySelector('#left-filter-brand')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'all') {
      sketchState.trafficFilter = selectedClient !== 'all'
        ? { type: 'client', client: selectedClient, brand: null }
        : { type: 'all', client: null, brand: null };
    } else {
      const ownerClient = selectedClient !== 'all'
        ? selectedClient
        : (clientsData.find((c) => Object.keys(c.brands || {}).includes(val))?.name || null);
      sketchState.trafficFilter = ownerClient
        ? { type: 'brand', client: ownerClient, brand: val }
        : { type: 'all', client: null, brand: null };
    }
    renderTrafficTree();
    notifyActiveScopeAfterTreeFilter();
  });

  if (isTrafficFamily) {
    const refreshTrafficOrMyOts = () => {
      if (isMyOtsScope || isMyTasksScope) notifySketchChange('orders', { filter: sketchState.trafficFilter });
      else renderTrafficGrid();
    };
    treeContainer.querySelector('#left-filter-dept')?.addEventListener('change', (e) => {
      sketchState.trafficDeptFilter = e.target.value;
      refreshTrafficOrMyOts();
    });
    treeContainer.querySelector('#left-filter-stage')?.addEventListener('change', (e) => {
      sketchState.trafficStageFilter = e.target.value;
      refreshTrafficOrMyOts();
    });
    treeContainer.querySelector('#left-filter-status')?.addEventListener('change', (e) => {
      sketchState.trafficStatusFilter = e.target.value;
      refreshTrafficOrMyOts();
    });
    treeContainer.querySelector('#left-filter-resp')?.addEventListener('change', (e) => {
      sketchState.trafficRespFilter = e.target.value;
      refreshTrafficOrMyOts();
    });
    treeContainer.querySelector('#left-filter-date')?.addEventListener('change', (e) => {
      sketchState.trafficDateFilter = e.target.value;
      refreshTrafficOrMyOts();
    });
    treeContainer.querySelector('#left-filter-group')?.addEventListener('change', (e) => {
      if (isMyOtsScope) sketchState.myOtsGroupBy = e.target.value;
      else if (isMyTasksScope) sketchState.stripboardGroupBy = e.target.value;
      else sketchState.trafficGroupBy = e.target.value;
      refreshTrafficOrMyOts();
    });
    treeContainer.querySelector('#left-filter-sort')?.addEventListener('change', (e) => {
      sketchState.trafficSortBy = e.target.value;
      refreshTrafficOrMyOts();
    });
  }
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
  const scopeSwitchEl = document.getElementById('traffic-scope-switch');
  if (scopeSwitchEl) {
    scopeSwitchEl.classList.toggle('hidden', sketchState.trafficScope === 'archived');
    scopeSwitchEl.querySelectorAll('.traffic-scope-btn').forEach((btn) => {
      const active = btn.dataset.trafficScope === sketchState.trafficScope;
      btn.classList.toggle('bg-obsidian-elevated', active);
      btn.classList.toggle('text-[#D4D4D4]', active);
      btn.classList.toggle('font-medium', active);
      btn.classList.toggle('text-[#8C8C8C]', !active);
      btn.classList.toggle('hover:text-[#D4D4D4]', !active);
    });
  }
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
            department: st.department || ot.department,
            stage: st.stage || ot.stage || 'Tráfico',
            status: st.status || ot.status,
            responsible: st.responsible || ot.responsible,
            urgent: Boolean(st.urgent ?? ot.urgent),
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
    label = sketchState.trafficFilter.client;
  } else if (sketchState.trafficFilter.type === 'brand') {
    label = `${sketchState.trafficFilter.client} · ${sketchState.trafficFilter.brand}`;
  }

  filtered = sortTrafficItemsByEntryDate(
    filtered.filter((o) =>
      matchesCommonTrafficFilters(o, {
        state: sketchState,
        checkResponsible: true,
        searchQuery: sketchState.trafficSearchQuery,
      })
    ),
    sketchState.trafficSortBy
  );

  if (titleEl) titleEl.textContent = label;
  if (countEl) {
    const unit = isTasksScope
      ? filtered.length === 1 ? 'Tarea' : 'Tareas'
      : filtered.length === 1 ? 'OT' : 'OTs';
    countEl.textContent = `${filtered.length} ${unit}`;
  }

  const activeViewMode = sketchState.trafficViewMode || 'list';
  document.querySelectorAll('.traffic-view-btn').forEach((btn) => {
    const isAct = btn.dataset.trafficView === activeViewMode;
    btn.classList.toggle('bg-obsidian-elevated', isAct);
    btn.classList.toggle('text-[#D4D4D4]', isAct);
    btn.classList.toggle('font-medium', isAct);
    btn.classList.toggle('text-[#8C8C8C]', !isAct);
    btn.classList.toggle('hover:text-[#D4D4D4]', !isAct);
  });

  const dayHeaderEl = document.getElementById('traffic-day-header');
  const tableWrapEl = document.getElementById('traffic-table-wrap');
  const schedEl = document.getElementById('traffic-schedule-view');

  const isTableMode = activeViewMode === 'list' || activeViewMode === 'day';
  if (dayHeaderEl) dayHeaderEl.classList.toggle('hidden', activeViewMode !== 'day');
  if (tableWrapEl) tableWrapEl.classList.toggle('hidden', !isTableMode);
  if (schedEl) schedEl.classList.toggle('hidden', isTableMode);

  if (activeViewMode === 'day') {
    const anchorDate = sketchState.trafficScheduleDate;
    const busyDates = new Set(filtered.map((o) => (o.deliveryDate || '').slice(0, 10)).filter(Boolean));
    renderInspectorMiniCalendar({
      anchorDate,
      busyDates,
      onSelectDate: (iso) => {
        sketchState.trafficScheduleDate = iso;
        renderTrafficGrid();
      },
    });
    if (dayHeaderEl) {
      const { title, subtitle } = formatLongDayHeading(anchorDate);
      dayHeaderEl.innerHTML = renderScheduleNavHeader(title, 'Día anterior', 'Día siguiente', { subtitle });
      if (window.hydrateIcons) window.hydrateIcons(dayHeaderEl);
      bindScheduleNavEvents(
        dayHeaderEl,
        (dir) => {
          sketchState.trafficScheduleDate = shiftScheduleDate(sketchState.trafficScheduleDate, 'day', dir, sketchState.ganttScale);
          renderTrafficGrid();
        },
        () => {
          sketchState.trafficScheduleDate = relDate(0).slice(0, 10);
          renderTrafficGrid();
        }
      );
    }
    filtered = filtered.filter((o) => (o.deliveryDate || '').slice(0, 10) === anchorDate);
    if (countEl) {
      const unit = isTasksScope
        ? filtered.length === 1 ? 'Tarea' : 'Tareas'
        : filtered.length === 1 ? 'OT' : 'OTs';
      countEl.textContent = `${filtered.length} ${unit}`;
    }
  } else if (!isTableMode && schedEl) {
    const anchorDate = sketchState.trafficScheduleDate;
    const matchDate = (o, iso) => (o.deliveryDate || '').slice(0, 10) === iso;

    if (activeViewMode === 'kanban') {
      const kanbanGroupBy = ['priority', 'stage', 'status', 'department', 'client', 'responsible'].includes(sketchState.trafficGroupBy)
        ? sketchState.trafficGroupBy
        : 'stage';
      schedEl.innerHTML = renderKanbanScheduleHtml({
        items: filtered,
        groupBy: kanbanGroupBy,
        todayKey: relDate(0).slice(0, 10),
        tomorrowKey: relDate(1).slice(0, 10),
        departments: trafficDepartments,
        stages: trafficStages,
        statuses: trafficStatuses,
        members: trafficMembers,
        wrap: true,
      });
      if (window.hydrateIcons) window.hydrateIcons(schedEl);
      bindKanbanScheduleEvents({
        container: schedEl,
        orders: trafficOrders,
        onOpenItem: (otId, taskIdx) => openOtFromTraffic(otId, taskIdx),
        onChanged: () => {
          renderTrafficGrid();
          notifySketchChange('orders');
        },
      });
      return;
    } else if (activeViewMode === 'week') {
      schedEl.innerHTML = renderWeekScheduleHtml({
        anchorDate,
        showHoursBadge: false,
        draggableCards: false,
        emptyColText: 'Sin entregas',
        getDayItems: (iso) => filtered.filter((o) => matchDate(o, iso)),
      });
    } else if (activeViewMode === 'gantt') {
      schedEl.innerHTML = renderGanttScheduleHtml({
        anchorDate,
        items: filtered,
        scale: sketchState.ganttScale,
      });
      bindGanttScaleEvents(schedEl, (nextScale) => {
        sketchState.ganttScale = nextScale;
        renderTrafficGrid();
      });
    } else if (activeViewMode === 'month') {
      schedEl.innerHTML = renderMonthScheduleHtml({
        anchorDate,
        dateAttr: 'data-traffic-pick-date',
        getDayItems: (iso) => filtered.filter((o) => matchDate(o, iso)),
      });
    }

    if (window.hydrateIcons) window.hydrateIcons(schedEl);
    const busyDates = new Set(filtered.map((o) => (o.deliveryDate || '').slice(0, 10)).filter(Boolean));
    renderInspectorMiniCalendar({
      anchorDate,
      busyDates,
      onSelectDate: (iso) => {
        sketchState.trafficScheduleDate = iso;
        renderTrafficGrid();
      },
    });
    bindScheduleNavEvents(
      schedEl,
      (dir) => {
        sketchState.trafficScheduleDate = shiftScheduleDate(
          sketchState.trafficScheduleDate,
          activeViewMode,
          dir,
          sketchState.ganttScale
        );
        renderTrafficGrid();
      },
      () => {
        sketchState.trafficScheduleDate = relDate(0).slice(0, 10);
        renderTrafficGrid();
      }
    );
    schedEl.querySelectorAll('[data-sched-ot]').forEach((el) => {
      el.addEventListener('click', () => {
        const otId = el.dataset.schedOt;
        if (otId) openOtFromTraffic(otId, el.dataset.schedTask || '');
      });
    });
    schedEl.querySelectorAll('[data-traffic-pick-date]').forEach((btn) => {
      btn.addEventListener('click', () => {
        sketchState.trafficScheduleDate = btn.dataset.trafficPickDate;
        sketchState.trafficViewMode = 'day';
        renderTrafficGrid();
      });
    });
    return;
  }

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="15" class="p-6 text-center text-[11px] text-[#8C8C8C]">No hay ${isTasksScope ? 'tareas' : 'OTs'} que coincidan con estos filtros.</td></tr>`;
    return;
  }

  let zebraIdx = 0;
  const nextZebra = () => ((zebraIdx++) % 2 === 1 ? 'bg-[#262626]' : 'bg-[#1d1d1d]');

  const renderOtRow = (ot) => {
    const zebra = nextZebra();
    const cColor = getClientColor(ot.client);
    const realOtId = ot.otId || ot.id;
    const taskIdxAttr = ot.taskIndex !== undefined ? ot.taskIndex : '';
    const entryVal = toDatetimeLocalValue(ot.entryDate);
    const deliveryVal = toDatetimeLocalValue(ot.deliveryDate);
    const clientWords = String(ot.client || '').trim().split(/\s+/).filter(Boolean);
    const clientInitials = (clientWords.length >= 2
      ? clientWords.slice(0, 3).map((w) => w[0]).join('')
      : String(ot.client || '').trim().slice(0, 2)).toUpperCase() || '—';

    if (!isTasksScope) ensureOtData(ot);
    const subtasks = !isTasksScope ? (ot.subtasks || []) : [];
    const hasSubtasks = subtasks.length > 0;
    const isOtExpanded = hasSubtasks && sketchState.expandedTrafficOts.has(ot.id);

    const shortOtCode = String(ot.id || '').replace(/^OT-/i, '');
    const brandStr = String(ot.brand || '').trim();
    const productStr = String(ot.product || '').trim();
    const brandIsClient = !brandStr || brandStr.toLowerCase() === String(ot.client || '').trim().toLowerCase() || brandStr.toLowerCase() === 'institucional';
    const brandLabel = brandIsClient ? '—' : brandStr;
    const productLabel = brandIsClient
      ? (productStr || 'Institucional')
      : (productStr && productStr.toLowerCase() !== 'institucional' ? productStr : '—');

    const otRowHtml = `
      <tr data-traffic-open-row="${escapeHtml(realOtId)}" data-traffic-open-task="${taskIdxAttr}" class="${zebra} hover:bg-obsidian-elevated/70 transition-colors text-[10.5px] cursor-pointer">
        <td class="px-1 py-1.5 border-r border-obsidian-border align-middle text-center">
          ${getPriorityDotHtml(ot)}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
          <div class="flex items-center gap-1">
            ${hasSubtasks ? `
              <button type="button" data-traffic-toggle-ot="${escapeHtml(ot.id)}" title="${isOtExpanded ? 'Ocultar tareas' : 'Ver tareas'}"
                class="w-3.5 h-3.5 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center shrink-0 cursor-pointer transition-colors">
                <span data-icon="${isOtExpanded ? 'chevron-down' : 'chevron-right'}" data-icon-size="w-2.5 h-2.5"></span>
              </button>
            ` : ''}
            <button type="button" data-traffic-edit-ot="${escapeHtml(realOtId)}" data-traffic-edit-task="${taskIdxAttr}" title="Abrir OT"
              class="font-mono font-semibold text-obsidian-amber hover:underline whitespace-nowrap cursor-pointer">${escapeHtml(shortOtCode)}</button>
          </div>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-medium">
          <span data-tip="${escapeHtml(ot.client)}" data-tip-pos="right" class="inline-flex items-center max-w-full">
            <span class="font-mono tracking-wide" style="color:${escapeHtml(cColor)}">${escapeHtml(clientInitials)}</span>
          </span>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#D4D4D4] truncate" title="${escapeHtml(brandLabel)}">
          ${escapeHtml(brandLabel)}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate" title="${escapeHtml(productLabel)}">
          ${escapeHtml(productLabel)}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate" title="${escapeHtml(ot.media)}">${escapeHtml(ot.media)}</td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#D4D4D4] truncate" title="${escapeHtml(ot.ref)}">
          ${escapeHtml(ot.ref)}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#D4D4D4]" title="${escapeHtml(ot.title)}">
          <div class="line-clamp-2 leading-tight">${escapeHtml(ot.title)}</div>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-mono text-[10px] text-[#8C8C8C] text-center whitespace-nowrap">
          ${escapeHtml(formatShortDate(ot.entryDate) || '—')}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-mono text-[10px] text-[#8C8C8C] text-center whitespace-nowrap">
          ${escapeHtml(formatShortDate(ot.deliveryDate) || '—')}
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate">
          <span class="block truncate font-medium" style="color:${escapeHtml(getDepartmentColor(ot.department))}">${escapeHtml(ot.department || '—')}</span>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate" title="${escapeHtml(ot.stage || 'Tráfico')}">
          <span class="block truncate font-medium" style="color:${escapeHtml(getStageColor(ot.stage || 'Tráfico'))}">${escapeHtml(ot.stage || 'Tráfico')}</span>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate">
          <span class="block truncate font-medium" style="color:${escapeHtml(getStatusColor(ot.status))}">${escapeHtml(ot.status || '—')}</span>
        </td>
        <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate" title="${escapeHtml(ot.responsible)}">
          ${escapeHtml(ot.responsible || '—')}
        </td>
        <td class="px-1 py-1.5 align-middle text-center">
          <button type="button" data-traffic-edit-ot="${escapeHtml(ot.id)}" data-traffic-edit-task="${taskIdxAttr}" title="Editar notas en Inspector"
            class="w-6 h-6 mx-auto rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-obsidian-amber flex items-center justify-center transition-colors cursor-pointer">
            <span data-icon="pencil" data-icon-size="w-3 h-3"></span>
          </button>
        </td>
      </tr>
    `;

    if (!isOtExpanded) return otRowHtml;

    const subtaskRowsHtml = subtasks
      .map((st, tIdx) => `
        <tr data-traffic-open-row="${escapeHtml(ot.id)}" data-traffic-open-task="${tIdx}" class="${nextZebra()} hover:bg-obsidian-elevated/60 transition-colors text-[10px] cursor-pointer">
          <td class="px-1 py-1 border-r border-obsidian-border align-middle"></td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle text-right">
            <button type="button" data-traffic-edit-ot="${escapeHtml(ot.id)}" data-traffic-edit-task="${tIdx}" title="Abrir tarea"
              class="font-mono text-obsidian-amber/90 hover:underline whitespace-nowrap cursor-pointer">${escapeHtml(shortOtCode)}-${tIdx + 1}</button>
          </td>
          <td colspan="5" class="px-2 py-1 border-r border-obsidian-border align-middle"></td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle text-[#D4D4D4]" title="${escapeHtml(st.title)}">
            <div class="truncate">${escapeHtml(st.title)}</div>
          </td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle font-mono text-[9.5px] text-[#8C8C8C] text-center whitespace-nowrap">
            ${escapeHtml(formatShortDate(st.entryDate || ot.entryDate) || '—')}
          </td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle font-mono text-[9.5px] text-[#8C8C8C] text-center whitespace-nowrap">
            ${escapeHtml(formatShortDate(st.deliveryDate || ot.deliveryDate) || '—')}
          </td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle truncate">
            <span class="block truncate" style="color:${escapeHtml(getDepartmentColor(st.department || ot.department))}">${escapeHtml(st.department || ot.department || '—')}</span>
          </td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle truncate" title="${escapeHtml(st.stage || ot.stage || 'Tráfico')}">
            <span class="block truncate" style="color:${escapeHtml(getStageColor(st.stage || ot.stage || 'Tráfico'))}">${escapeHtml(st.stage || ot.stage || 'Tráfico')}</span>
          </td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle truncate">
            <span class="block truncate" style="color:${escapeHtml(getStatusColor(st.status || ot.status))}">${escapeHtml(st.status || ot.status || '—')}</span>
          </td>
          <td class="px-1.5 py-1 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate">${escapeHtml(st.responsible || ot.responsible || '—')}</td>
          <td class="px-1 py-1 align-middle text-center">
            <button type="button" data-traffic-edit-ot="${escapeHtml(ot.id)}" data-traffic-edit-task="${tIdx}" title="Editar notas en Inspector"
              class="w-6 h-6 mx-auto rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-obsidian-amber flex items-center justify-center transition-colors cursor-pointer">
              <span data-icon="pencil" data-icon-size="w-3 h-3"></span>
            </button>
          </td>
        </tr>
      `)
      .join('');

    return otRowHtml + subtaskRowsHtml;
  };

  if (sketchState.trafficGroupBy === 'none') {
    tbody.innerHTML = filtered.map((ot) => renderOtRow(ot)).join('');
  } else {
    const groups = new Map();
    const todayIso = relDate(0).slice(0, 10);
    const tomorrowIso = relDate(1).slice(0, 10);
    filtered.forEach((ot) => {
      let key = 'Sin definir';
      if (sketchState.trafficGroupBy === 'client') key = ot.client || 'Sin cliente';
      else if (sketchState.trafficGroupBy === 'department') key = ot.department || 'Sin depto.';
      else if (sketchState.trafficGroupBy === 'stage') key = ot.stage || 'Tráfico';
      else if (sketchState.trafficGroupBy === 'status') key = ot.status || 'En proceso';
      else if (sketchState.trafficGroupBy === 'priority') {
        const dKey = (ot.deliveryDate || '').slice(0, 10);
        if (ot.urgent) key = 'Urgentes';
        else if (dKey === todayIso) key = 'Vencen hoy';
        else if (dKey === tomorrowIso) key = 'Vencen mañana';
        else key = 'Programadas';
      }
      else if (sketchState.trafficGroupBy === 'responsible') key = ot.responsible || 'Sin responsable';
      else if (sketchState.trafficGroupBy === 'entryDate') key = formatDayLabel(ot.entryDate);
      else if (sketchState.trafficGroupBy === 'deliveryDate') key = formatDayLabel(ot.deliveryDate);
      else if (sketchState.trafficGroupBy === 'media') key = ot.media || 'Sin medio';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(ot);
    });

    if (!sketchState.trafficGroupsSeeded && sketchState.trafficGroupBy === 'client') {
      sketchState.trafficGroupsSeeded = true;
      Array.from(groups.keys()).forEach((groupName, idx) => {
        if (idx > 0) sketchState.collapsedTrafficGroups.add(groupName);
      });
    }

    tbody.innerHTML = Array.from(groups.entries())
      .map(([groupName, items], gIdx) => {
        const isGroupCollapsed = sketchState.collapsedTrafficGroups.has(groupName);
        const groupColor = sketchState.trafficGroupBy === 'client' ? getClientColor(groupName) : null;
        const spacerRow = gIdx > 0
          ? `<tr class="h-3 ${nextZebra()}"><td colspan="15" class="p-0"></td></tr>`
          : '';
        const headerZebra = nextZebra();
        return `
        ${spacerRow}
        <tr data-traffic-toggle-group="${escapeHtml(groupName)}" class="bg-[#191919] hover:bg-[#222222] border-y border-obsidian-border cursor-pointer select-none transition-colors">
          <td colspan="15" class="px-2 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-medium">
            <span class="inline-flex items-center gap-1.5">
              <span data-icon="${isGroupCollapsed ? 'chevron-right' : 'chevron-down'}" data-icon-size="w-3 h-3" data-icon-class="text-[#8C8C8C] shrink-0"></span>
              <span style="${groupColor ? `color:${escapeHtml(groupColor)}` : 'color:#D4D4D4'}">${escapeHtml(groupName)}</span>
              <span class="font-mono text-[#8C8C8C]">(${items.length})</span>
            </span>
          </td>
        </tr>
        ${isGroupCollapsed ? '' : items.map((ot) => renderOtRow(ot)).join('')}
      `;
      })
      .join('');
  }

  if (window.hydrateIcons) window.hydrateIcons(tbody);

  tbody.querySelectorAll('[data-traffic-toggle-group]').forEach((grpRow) => {
    grpRow.addEventListener('click', () => {
      const grp = grpRow.dataset.trafficToggleGroup;
      if (!grp) return;
      if (sketchState.collapsedTrafficGroups.has(grp)) {
        sketchState.collapsedTrafficGroups.delete(grp);
      } else {
        sketchState.collapsedTrafficGroups.add(grp);
      }
      renderTrafficGrid();
    });
  });

  tbody.querySelectorAll('[data-traffic-toggle-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const otId = btn.dataset.trafficToggleOt;
      if (!otId) return;
      if (sketchState.expandedTrafficOts.has(otId)) {
        sketchState.expandedTrafficOts.delete(otId);
      } else {
        sketchState.expandedTrafficOts.add(otId);
      }
      renderTrafficGrid();
    });
  });

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

  tbody.querySelectorAll('[data-traffic-edit-ot]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openOtFromTraffic(btn.dataset.trafficEditOt, btn.dataset.trafficEditTask);
    });
  });

  tbody.querySelectorAll('tr[data-traffic-open-row]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('input, select, textarea, a, [data-traffic-toggle-ot], [data-traffic-edit-ot]')) return;
      renderTrafficNotesInspector(row.dataset.trafficOpenRow, row.dataset.trafficOpenTask, false);
    });
  });
}

function openOtFromTraffic(otId, taskIdx = '') {
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
}

function renderTrafficNotesInspector(otId, taskIdx = '', focusNotes = false) {
  const rightBody = document.getElementById('right-body');
  if (!rightBody) return;
  const ot = trafficOrders.find((o) => o.id === otId);
  if (!ot) return;
  const hasTask = taskIdx !== '' && taskIdx !== undefined && taskIdx !== null && ot.subtasks?.[Number(taskIdx)];
  const targetObj = hasTask ? ot.subtasks[Number(taskIdx)] : ot;
  const codeLabel = hasTask ? `${ot.id}-${Number(taskIdx) + 1}` : ot.id;
  const cColor = getClientColor(ot.client);

  rightBody.innerHTML = `
    <div class="space-y-3 text-[11px]">
      <div class="pb-2 border-b border-obsidian-border space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[10px] font-semibold text-obsidian-amber px-1.5 py-0.5 rounded bg-[#191919] border border-obsidian-border">${escapeHtml(codeLabel)}</span>
          <span class="text-[10px] text-[#8C8C8C]">${escapeHtml(targetObj.status || ot.status || '')}</span>
        </div>
        <div class="text-[12px] font-medium text-[#D4D4D4] leading-snug">${escapeHtml(targetObj.title || ot.title)}</div>
        <div class="flex items-center gap-1.5 text-[10px] text-[#8C8C8C]">
          <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
          <span class="truncate">${escapeHtml(ot.client)}</span>
        </div>
      </div>

      <label class="block space-y-1">
        <span class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Notas</span>
        <textarea id="insp-traffic-notes" rows="5" placeholder="Escribir notas..." class="w-full bg-[#191919] border border-obsidian-border rounded-lg p-2 text-[11px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60 resize-y">${escapeHtml(targetObj.notes || '')}</textarea>
      </label>

      <button type="button" id="insp-traffic-open-ot" class="w-full h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">
        Abrir ${hasTask ? 'Tarea' : 'OT'}
      </button>
      ${renderOtActivityHtml(ot)}
    </div>
  `;

  const notesEl = rightBody.querySelector('#insp-traffic-notes');
  notesEl?.addEventListener('input', (e) => {
    targetObj.notes = e.target.value;
  });
  if (focusNotes && notesEl) {
    notesEl.focus();
    notesEl.setSelectionRange(notesEl.value.length, notesEl.value.length);
  }
  rightBody.querySelector('#insp-traffic-open-ot')?.addEventListener('click', () => {
    openOtFromTraffic(ot.id, hasTask ? taskIdx : '');
  });
}

function bindColResizers() {
  bindTableColResizers(document.getElementById('traffic-table'));
}

/**
 * Render the Escritorio (#view-desktop) overview showing OTs marked Urgent or due today.
 */
export function renderDesktopOverview(onGoToTraffic) {
  const container = document.getElementById('view-desktop');
  if (!container) return;

  const todayKey = relDate(0).slice(0, 10);
  const tomorrowKey = relDate(1).slice(0, 10);
  const activeOrders = trafficOrders.filter((o) => !o.archived);

  // Deduplicated priority buckets: Urgent > Due Today > Due Tomorrow
  const urgentItems = activeOrders
    .filter((o) => !!o.urgent)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const todayItems = activeOrders
    .filter((o) => !o.urgent && (o.deliveryDate || '').slice(0, 10) === todayKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));
  const tomorrowItems = activeOrders
    .filter((o) => !o.urgent && (o.deliveryDate || '').slice(0, 10) === tomorrowKey)
    .sort((a, b) => (a.deliveryDate || '').localeCompare(b.deliveryDate || ''));

  const renderKanbanCol = (title, dotClass, emptyMsg, items) => {
    const cardsHtml = items.length
      ? items.map((ot) => {
          const cColor = getClientColor(ot.client);
          const shortOtCode = String(ot.id || '').replace(/^OT-/i, '');
          const isDueToday = (ot.deliveryDate || '').slice(0, 10) === todayKey;

          return `
            <div data-desktop-open-row="${escapeHtml(ot.id)}"
              class="bg-[#191919] hover:bg-[#262626] border border-obsidian-border rounded-lg p-2.5 space-y-1.5 cursor-pointer transition-colors">
              <div class="flex items-center justify-between gap-1.5">
                <span class="inline-flex items-center gap-1.5 min-w-0">
                  ${getPriorityDotHtml(ot, todayKey, tomorrowKey, 'w-1.5 h-1.5')}
                  <button type="button" data-desktop-edit-ot="${escapeHtml(ot.id)}" title="Abrir OT"
                    class="font-mono text-[10.5px] font-semibold text-obsidian-amber hover:underline cursor-pointer shrink-0">${escapeHtml(shortOtCode)}</button>
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
      const otId = btn.dataset.desktopEditOt;
      if (!otId) return;
      if (typeof onOpenOtCallback === 'function') {
        onOpenOtCallback({ otId, taskIndex: null, scope: 'active' });
      } else {
        notifySketchChange('open-ot', { otId, taskIndex: null, scope: 'active' });
      }
    });
  });

  container.querySelectorAll('tr[data-desktop-open-row]').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button, a, [data-desktop-edit-ot]')) return;
      renderTrafficNotesInspector(row.dataset.desktopOpenRow, '', false);
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

  document.querySelectorAll('.traffic-view-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextMode = btn.dataset.trafficView || 'list';
      if (nextMode === sketchState.trafficViewMode) return;
      sketchState.trafficViewMode = nextMode;
      renderTrafficGrid();
    });
  });

  document.getElementById('traffic-prev-day')?.addEventListener('click', () => {
    sketchState.trafficScheduleDate = shiftScheduleDate(
      sketchState.trafficScheduleDate,
      sketchState.trafficViewMode,
      -1,
      sketchState.ganttScale
    );
    renderTrafficGrid();
  });
  document.getElementById('traffic-next-day')?.addEventListener('click', () => {
    sketchState.trafficScheduleDate = shiftScheduleDate(
      sketchState.trafficScheduleDate,
      sketchState.trafficViewMode,
      1,
      sketchState.ganttScale
    );
    renderTrafficGrid();
  });
  document.getElementById('traffic-today-btn')?.addEventListener('click', () => {
    sketchState.trafficScheduleDate = relDate(0).slice(0, 10);
    renderTrafficGrid();
  });
  document.getElementById('traffic-date-input')?.addEventListener('change', (e) => {
    if (e.target.value) {
      sketchState.trafficScheduleDate = e.target.value;
      renderTrafficGrid();
    }
  });

  document.querySelectorAll('.traffic-scope-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextScope = btn.dataset.trafficScope;
      if (!nextScope || nextScope === sketchState.trafficScope) return;
      sketchState.trafficScope = nextScope;
      const centerTitle = document.getElementById('center-page-title');
      if (centerTitle) centerTitle.textContent = nextScope === 'all-tasks' ? 'Todas las Tareas' : 'Tráfico';
      renderTrafficTree();
      renderTrafficGrid();
    });
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
