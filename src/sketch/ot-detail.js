/**
 * Detalle de OT / Tarea (#view-my-ots) + árbol izquierdo de tareas + Inspector (#right-body).
 */

import {
  bindTableColResizers,
  escapeHtml,
  formatShortDate,
  getClientColor,
  getDepartmentColor,
  getPriorityDotHtml,
  getStageColor,
  getStatusColor,
  matchesCommonTrafficFilters,
  notifySketchChange,
  onSketchChange,
  recordOtActivity,
  relDate,
  renderOtActivityHtml,
  sketchState,
  sortTrafficItemsByEntryDate,
  studioSettings,
  syncDepartmentFromRoutes,
  trafficDepartments,
  trafficMembers,
  trafficOrders,
  trafficStages,
  trafficStatuses,
  ensureOtData
} from './store.js';
import { renderGallerySectionHtml, bindGalleryEvents, getFilteredGalleryPieces } from './gallery.js';
import { renderTrafficTree } from './traffic.js';
import {
  bindKanbanScheduleEvents,
  bindScheduleNavEvents,
  formatLongDayHeading,
  mountScheduleView,
  renderInspectorMiniCalendar,
  renderKanbanScheduleHtml,
  renderScheduleNavHeader,
  shiftScheduleDate,
} from './schedule-views.js';
import { renderOtInspectorPanel, renderTrafficNotesInspector } from './inspector.js';
import {
  ensureStripboardDaySeeded,
  getDayReservedHours,
  moveTaskToScheduledDate
} from './stripboard.js';

let initialized = false;
let jumpStripboardCb = null;
let backToTrafficCb = null;

/**
 * Sync active state of .myots-mode-btn buttons with sketchState.myOtsMode.
 */
function syncMyOtsModeButtons() {
  document.querySelectorAll('.myots-mode-btn').forEach((b) => {
    const active = b.dataset.myotsMode === sketchState.myOtsMode;
    b.classList.toggle('bg-obsidian-elevated', active);
    b.classList.toggle('text-[#D4D4D4]', active);
    b.classList.toggle('font-medium', active);
    b.classList.toggle('text-[#8C8C8C]', !active);
    b.classList.toggle('hover:text-[#D4D4D4]', !active);
  });
}

/**
 * Ensure #my-ots-member-label and #my-ots-count exist in #view-my-ots.
 */
function ensureMyOtsHeaderControls() {
  const topbar = document.getElementById('my-ots-topbar');
  if (!topbar) return;

  let memberLabel = document.getElementById('my-ots-member-label');
  let countEl = document.getElementById('my-ots-count');

  if (!memberLabel || !countEl) {
    let controlsWrap = document.getElementById('my-ots-extra-controls');
    if (!controlsWrap) {
      controlsWrap = document.createElement('div');
      controlsWrap.id = 'my-ots-extra-controls';
      controlsWrap.className = 'inline-flex items-center gap-2 shrink-0';
      const rightGroup = topbar.querySelector(':scope > div:last-child');
      if (rightGroup) {
        rightGroup.insertBefore(controlsWrap, rightGroup.firstChild);
      } else {
        topbar.appendChild(controlsWrap);
      }
    }
    if (!memberLabel) {
      memberLabel = document.createElement('span');
      memberLabel.id = 'my-ots-member-label';
      memberLabel.className = 'text-[11px] font-medium text-[#D4D4D4] whitespace-nowrap';
      controlsWrap.appendChild(memberLabel);
    }
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.id = 'my-ots-count';
      countEl.className = 'text-[10.5px] font-mono text-[#8C8C8C] whitespace-nowrap';
      controlsWrap.appendChild(countEl);
    }
  }

  memberLabel.textContent = sketchState.myOtsMember || 'Andrés';
}

function formatBitacoraNow() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${String(now.getFullYear()).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Commit a newly entered blank route row in the bitácora table.
 */
function commitBlankRouteRow(row, { signedNow = false } = {}) {
  if (!row || row.dataset.committing === '1') return;
  const otId = row.getAttribute('data-new-route-ot');
  const taskAttr = row.getAttribute('data-new-route-task');
  const ot = trafficOrders.find((o) => o.id === otId);
  if (!ot) return;

  const getVal = (col) => (row.querySelector(`[data-new-route-col="${col}"]`)?.value || '').trim();
  const date = getVal('date');
  const from = getVal('from');
  const to = getVal('to');
  const desc = getVal('desc');
  const sign = getVal('sign');
  const notes = getVal('notes');
  if (!desc && !to && !notes && !sign) return;

  row.dataset.committing = '1';
  const targetTask = taskAttr !== null && taskAttr !== 'root' ? ot.subtasks?.[Number(taskAttr)] : null;
  const targetRoutes = targetTask ? (targetTask.routes || (targetTask.routes = [])) : (ot.routes || (ot.routes = []));
  const nowStamp = formatBitacoraNow();

  const targetObj = targetTask || ot;
  const isSigned = signedNow || !!sign;
  targetRoutes.push({
    date: isSigned ? nowStamp : (date || nowStamp),
    from: from || 'Cuentas',
    to: to || '—',
    desc: desc || '—',
    sign: sign || 'Sin Firmar',
    notes: notes || '',
    locked: isSigned
  });
  if (isSigned) {
    syncDepartmentFromRoutes(targetObj);
    recordOtActivity(targetObj, `firmó bitácora: ${from || 'Cuentas'} → ${to || '—'}`, sign);
  }
  notifySketchChange('orders');
  renderMyOts();
}

/**
 * Render the left task tree for an OT and its subtasks.
 */
export function renderOtTaskTree(ot, taskTreeList, selectedTaskIndex = null, onSelect = null) {
  if (!ot || !taskTreeList) return;
  const cColor = getClientColor(ot.client);
  const tasks = ot.subtasks || [];
  const isRootActive = selectedTaskIndex === null;
  taskTreeList.innerHTML = `
    <div class="select-none">
      <button type="button" data-tree-task="root" class="w-full py-1 px-1.5 rounded-lg text-[10px] font-normal uppercase tracking-[0.12em] flex items-center gap-1.5 transition-colors cursor-pointer ${isRootActive ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}">
        <span class="w-1 h-1 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
        <span class="truncate font-mono">${escapeHtml(ot.id)}</span>
      </button>
      <div class="mt-2 pl-2.5 pr-[5px] py-1 text-[10px] font-normal uppercase tracking-[0.12em] text-[#8C8C8C]">Tareas</div>
      <div class="flex flex-col gap-0.5">
        ${tasks.map((t, idx) => {
          const isActive = selectedTaskIndex === idx;
          return `
            <button type="button" data-tree-task="${idx}" class="w-full pl-4 pr-[5px] py-1.5 rounded-lg flex items-center gap-2 text-[11.5px] transition-colors cursor-pointer ${isActive ? 'bg-obsidian-elevated text-[#D4D4D4]' : 'text-[#8C8C8C] hover:bg-obsidian-elevated hover:text-[#D4D4D4]'}">
              <span class="truncate">${escapeHtml(t.title)}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;
  if (onSelect) {
    taskTreeList.querySelectorAll('[data-tree-task]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.treeTask;
        onSelect(val === 'root' ? null : Number(val));
      });
    });
  }
}

/**
 * Render the OT summary metadata row.
 */
export function renderOtInfoRowHtml(ot, formatDateFn = formatShortDate) {
  const cColor = getClientColor(ot.client);
  const brandStr = String(ot.brand || '').trim();
  const productStr = String(ot.product || '').trim();
  const brandIsClient = !brandStr || brandStr.toLowerCase() === String(ot.client || '').trim().toLowerCase() || brandStr.toLowerCase() === 'institucional';
  const brandVal = brandIsClient ? '—' : brandStr;
  const productVal = brandIsClient
    ? (productStr || 'Institucional')
    : (productStr && productStr.toLowerCase() !== 'institucional' ? productStr : '—');
  return `
    <div class="bg-[#202020] border border-obsidian-border rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-6 lg:grid-cols-11 gap-1.5 text-[10.5px]">
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">No. OT</label>
        <input type="text" readonly value="${escapeHtml(ot.id)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-obsidian-amber font-mono font-semibold text-[10.5px] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Cliente</label>
        <div class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] font-medium truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</div>
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Marca</label>
        <input type="text" value="${escapeHtml(brandVal)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Producto</label>
        <input type="text" value="${escapeHtml(productVal)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Medio</label>
        <input type="text" value="${escapeHtml(ot.media)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Referencia</label>
        <input type="text" value="${escapeHtml(ot.ref)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] font-mono focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Descripción</label>
        <input type="text" value="${escapeHtml(ot.title)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Depto.</label>
        <input type="text" readonly value="${escapeHtml(ot.department || '—')}" title="Derivado automáticamente del último PARA: traficado en la bitácora"
          style="color:${escapeHtml(getDepartmentColor(ot.department))}"
          class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] font-medium focus:outline-none cursor-default">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Etapa</label>
        <select data-ot-id="${escapeHtml(ot.id)}" style="color:${escapeHtml(getStageColor(ot.stage || 'Tráfico'))}" class="myots-stage-sel w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] font-medium focus:outline-none cursor-pointer">
          ${trafficStages.map((st) => `<option value="${escapeHtml(st)}" ${(ot.stage || 'Tráfico') === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Estado</label>
        <select data-ot-id="${escapeHtml(ot.id)}" style="color:${escapeHtml(getStatusColor(ot.status))}" class="myots-status-sel w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] font-medium focus:outline-none cursor-pointer">
          ${trafficStatuses.map((s) => `<option value="${escapeHtml(s)}" ${ot.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Responsable</label>
        <input type="text" readonly value="${escapeHtml(ot.responsible)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#8C8C8C] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Entrada</label>
        <input type="text" readonly value="${escapeHtml(formatDateFn(ot.entryDate))}" title="Fecha y hora automática de apertura"
          class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10px] font-mono text-[#8C8C8C] focus:outline-none cursor-default">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Entrega Final</label>
        <input type="text" value="${escapeHtml(formatDateFn(ot.deliveryDate))}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10px] font-mono text-[#D4D4D4] focus:outline-none">
      </div>
    </div>
  `;
}

/**
 * Render the Detalle de OT / Tarea view (bitácora de movimientos + galería de piezas).
 */
export function renderOtDetailHtml(ot, formatDateFn = formatShortDate, taskIndex = null) {
  ensureOtData(ot, formatDateFn);
  const activeTask = taskIndex !== null && ot.subtasks[taskIndex] ? ot.subtasks[taskIndex] : null;
  const routes = activeTask ? activeTask.routes : ot.routes;
  const rawPieces = activeTask ? activeTask.mediaFiles : ot.mediaFiles;
  const routesCollapsed = sketchState.routesCollapsed;
  const lastValidTo = [...routes].reverse().find((r) => r.to && r.to !== '—')?.to;
  const defaultNextFrom = lastValidTo || 'Cuentas';
  const activeSigner = sketchState.myOtsMember || 'Andrés';

  return `
    <div class="flex flex-col gap-3">
      <!-- Tabla de movimientos -->
      <div class="space-y-1.5">
        ${routesCollapsed ? `
        <button type="button" data-toggle-ot-panel="routes" data-tip="Expandir bitácora" class="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] hover:text-[#D4D4D4] transition-colors cursor-pointer">
          <span data-icon="expand-diagonal" data-icon-size="w-3.5 h-3.5"></span>
          <span>BITÁCORA</span>
          <span class="font-mono text-[10px]">(${routes.length})</span>
        </button>
        ` : `
        <div class="border border-obsidian-border rounded-xl bg-[#202020] overflow-x-auto">
        <table class="w-full text-left text-[10.5px] border-collapse">
          <thead>
            <tr class="bg-[#191919] border-b border-obsidian-border text-[9.5px] text-[#8C8C8C] uppercase tracking-wider">
              <th class="px-2 py-1.5 border-r border-obsidian-border w-28">
                <button type="button" data-toggle-ot-panel="routes" data-tip="Contraer bitácora" class="inline-flex items-center gap-1.5 hover:text-[#D4D4D4] transition-colors cursor-pointer">
                  <span data-icon="collapse-diagonal" data-icon-size="w-3 h-3"></span>
                  <span>Fecha:</span>
                </button>
              </th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24">De:</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24">Para:</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border">Descripción</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24">Responsable</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border">Notas</th>
              <th class="px-2 py-1.5 w-9 text-center"><span data-icon="lock" data-icon-size="w-3 h-3"></span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-obsidian-border">
            ${routes.map((r, rIdx) => {
              const isLocked = ot.archived || r.locked;
              const isSelectedRoute = sketchState.activeRouteIndex === rIdx;
              if (isLocked) {
                return `
                <tr data-route-row-idx="${rIdx}" class="cursor-pointer transition-colors ${isSelectedRoute ? 'bg-obsidian-elevated/80 ring-1 ring-inset ring-obsidian-amber/40' : 'hover:bg-obsidian-elevated/40'}">
                  <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-[#8C8C8C]">${escapeHtml(r.date)}</td>
                  <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C]">${escapeHtml(r.from)}</td>
                  <td class="px-2 py-1.5 border-r border-obsidian-border text-[#D4D4D4]">${escapeHtml(r.to)}</td>
                  <td class="px-2 py-1.5 border-r border-obsidian-border text-[#D4D4D4]">${escapeHtml(r.desc)}</td>
                  <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C]">${escapeHtml(r.sign)}</td>
                  <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C]">${escapeHtml(r.notes)}</td>
                  <td class="px-2 py-1.5 text-center text-rose-400"><span data-icon="lock" data-icon-size="w-3 h-3"></span></td>
                </tr>
                `;
              }
              return `
              <tr data-route-row-idx="${rIdx}" data-edit-route-idx="${rIdx}" class="cursor-pointer transition-colors ${isSelectedRoute ? 'bg-obsidian-elevated/80 ring-1 ring-inset ring-obsidian-amber/40' : 'hover:bg-obsidian-elevated/40'}">
                <td class="px-2 py-1.5 border-r border-obsidian-border">
                  <input type="text" readonly data-edit-route-col="date" value="${escapeHtml(r.date || '')}" placeholder="Clic: ahora" title="Clic para estampar fecha y hora actual"
                    class="w-full bg-transparent font-mono text-[10px] text-[#8C8C8C] placeholder-[#555555] focus:outline-none cursor-pointer" />
                </td>
                <td class="px-2 py-1.5 border-r border-obsidian-border">
                  <select data-edit-route-col="from" class="w-full bg-transparent text-[10.5px] text-[#8C8C8C] focus:outline-none focus:text-[#D4D4D4] cursor-pointer">
                    <option value="" class="bg-[#202020]">—</option>
                    ${trafficDepartments.map((d) => `<option value="${escapeHtml(d)}" class="bg-[#202020]" ${r.from === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                  </select>
                </td>
                <td class="px-2 py-1.5 border-r border-obsidian-border">
                  <select data-edit-route-col="to" class="w-full bg-transparent text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
                    <option value="" class="bg-[#202020]">—</option>
                    ${trafficDepartments.map((d) => `<option value="${escapeHtml(d)}" class="bg-[#202020]" ${r.to === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                  </select>
                </td>
                <td class="px-2 py-1.5 border-r border-obsidian-border">
                  <input type="text" data-edit-route-col="desc" value="${escapeHtml(r.desc || '')}" placeholder="..." class="w-full bg-transparent text-[10.5px] text-[#D4D4D4] placeholder-[#555555] focus:outline-none" />
                </td>
                <td class="px-2 py-1.5 border-r border-obsidian-border">
                  <select data-edit-route-col="sign" class="w-full bg-transparent text-[10.5px] text-obsidian-amber focus:outline-none cursor-pointer">
                    <option value="" class="bg-[#202020]" ${!r.sign || r.sign.toLowerCase() === 'sin firmar' ? 'selected' : ''}>Sin Firmar</option>
                    <option value="${escapeHtml(activeSigner)}" class="bg-[#202020]" ${r.sign === activeSigner ? 'selected' : ''}>${escapeHtml(activeSigner)}</option>
                  </select>
                </td>
                <td class="px-2 py-1.5 border-r border-obsidian-border">
                  <input type="text" data-edit-route-col="notes" value="${escapeHtml(r.notes || '')}" placeholder="..." class="w-full bg-transparent text-[10.5px] text-[#8C8C8C] placeholder-[#555555] focus:outline-none focus:text-[#D4D4D4]" />
                </td>
                <td class="px-1.5 py-1.5 text-center">
                  <div class="inline-flex items-center justify-center gap-1">
                    <span class="text-emerald-400" title="Sin firmar (editable)"><span data-icon="lock-open" data-icon-size="w-3 h-3"></span></span>
                    <button type="button" data-delete-route-idx="${rIdx}" title="Eliminar fila sin firmar"
                      class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#737373] hover:text-rose-400 flex items-center justify-center transition-colors cursor-pointer">
                      <span data-icon="trash-2" data-icon-size="w-2.5 h-2.5"></span>
                    </button>
                  </div>
                </td>
              </tr>
              `;
            }).join('')}
            ${ot.archived ? '' : `
            <tr data-new-route-ot="${escapeHtml(ot.id)}" data-new-route-task="${taskIndex === null ? 'root' : taskIndex}" class="hover:bg-obsidian-elevated/30">
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <input type="text" readonly data-new-route-col="date" placeholder="Clic: ahora" title="Clic para estampar fecha y hora actual"
                  class="w-full bg-transparent font-mono text-[10px] text-[#8C8C8C] placeholder-[#555555] focus:outline-none focus:text-[#D4D4D4] cursor-pointer" />
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <select data-new-route-col="from" class="w-full bg-transparent text-[10.5px] text-[#8C8C8C] focus:outline-none focus:text-[#D4D4D4] cursor-pointer">
                  <option value="" class="bg-[#202020]">—</option>
                  ${trafficDepartments.map((d) => `<option value="${escapeHtml(d)}" class="bg-[#202020]" ${defaultNextFrom === d ? 'selected' : ''}>${escapeHtml(d)}</option>`).join('')}
                </select>
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <select data-new-route-col="to" class="w-full bg-transparent text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
                  <option value="" class="bg-[#202020]">—</option>
                  ${trafficDepartments.map((d) => `<option value="${escapeHtml(d)}" class="bg-[#202020]">${escapeHtml(d)}</option>`).join('')}
                </select>
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <input type="text" data-new-route-col="desc" placeholder="..." class="w-full bg-transparent text-[10.5px] text-[#D4D4D4] placeholder-[#555555] focus:outline-none" />
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <select data-new-route-col="sign" class="w-full bg-transparent text-[10.5px] text-obsidian-amber focus:outline-none cursor-pointer">
                  <option value="" class="bg-[#202020]">Sin Firmar</option>
                  <option value="${escapeHtml(activeSigner)}" class="bg-[#202020]">${escapeHtml(activeSigner)}</option>
                </select>
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <input type="text" data-new-route-col="notes" placeholder="..." class="w-full bg-transparent text-[10px] text-[#8C8C8C] placeholder-[#555555] focus:outline-none focus:text-[#D4D4D4]" />
              </td>
              <td class="px-2 py-1.5 text-center text-emerald-400"><span data-icon="lock-open" data-icon-size="w-3 h-3"></span></td>
            </tr>
            `}
          </tbody>
        </table>
        </div>
        `}
      </div>
      <div class="mt-2 pt-3 border-t border-obsidian-border">
        ${renderGallerySectionHtml(rawPieces, {
          allowFilters: !activeTask,
          showTaskFilter: !activeTask,
          subtasks: ot.subtasks || [],
          galleryMinH: routesCollapsed ? 'h-[calc(100vh-200px)] min-h-[740px]' : 'h-[calc(100vh-330px)] min-h-[620px]',
          canCollapse: true
        })}
      </div>
    </div>
  `;
}

/**
 * Render #view-my-ots (Detalle de OT, Lista, Kanban) and #right-body Inspector.
 */
export function renderMyOts() {
  const cardsEl = document.getElementById('my-ots-cards');
  const listEl = document.getElementById('my-ots-list');
  const listBodyEl = document.getElementById('my-ots-list-body');
  const kanbanEl = document.getElementById('my-ots-kanban');
  const schedEl = document.getElementById('my-ots-schedule-view');
  const leftEnvTree = document.getElementById('left-envelope-tree');
  const taskTreeList = document.getElementById('envelope-task-tree-list');
  if (!cardsEl || !listEl || !kanbanEl) return;

  ensureMyOtsHeaderControls();
  syncMyOtsModeButtons();
  document.getElementById('my-ots-mode-switch')?.classList.toggle('hidden', sketchState.myOtsMode === 'cards');
  document.getElementById('my-ots-extra-controls')?.classList.toggle('hidden', sketchState.myOtsMode === 'cards');
  const countEl = document.getElementById('my-ots-count');

  const isMyTasksScope = sketchState.myOtsScope === 'my-tasks';
  const myTasks = [];
  if (isMyTasksScope) {
    trafficOrders.filter((o) => !o.archived).forEach((ot) => {
      ensureOtData(ot, formatShortDate);
      (ot.subtasks || []).forEach((st, idx) => {
        if ((st.responsible || ot.responsible) === sketchState.myOtsMember) {
          myTasks.push({
            id: `${ot.id}-${idx + 1}`,
            otId: ot.id,
            taskIndex: idx,
            ot,
            task: st,
            client: ot.client,
            brand: ot.brand,
            product: ot.product,
            media: ot.media,
            ref: ot.ref,
            title: st.title,
            entryDate: st.entryDate || ot.entryDate,
            deliveryDate: st.deliveryDate || ot.deliveryDate,
            status: st.status || ot.status,
            notes: st.notes || ''
          });
        }
      });
    });
  }

  let mine = sketchState.myOtsScope === 'archived'
    ? trafficOrders.filter((o) => o.archived)
    : (sketchState.myOtsScope === 'traffic-open'
      ? trafficOrders.filter((o) => !o.archived)
      : (isMyTasksScope
        ? myTasks
        : trafficOrders.filter((o) => !o.archived && o.responsible === sketchState.myOtsMember)));

  if (sketchState.myOtsMode !== 'cards') {
    mine = sortTrafficItemsByEntryDate(
      mine.filter((o) =>
        matchesCommonTrafficFilters(o, {
          state: sketchState,
          checkResponsible: false,
        })
      ),
      sketchState.trafficSortBy
    );
  }

  if (countEl) {
    const unit = isMyTasksScope ? (mine.length === 1 ? 'Tarea' : 'Tareas') : (mine.length === 1 ? 'OT' : 'OTs');
    countEl.textContent = `${mine.length} ${unit}`;
  }

  const isDayMode = sketchState.myOtsMode === 'day';
  const isTableMode = sketchState.myOtsMode === 'list' || isDayMode;
  const isSchedMode = ['week', 'gantt', 'month'].includes(sketchState.myOtsMode);
  const dayHeaderEl = document.getElementById('my-ots-day-header');
  if (dayHeaderEl) dayHeaderEl.classList.toggle('hidden', !isDayMode);
  cardsEl.classList.toggle('hidden', sketchState.myOtsMode !== 'cards');
  listEl.classList.toggle('hidden', !isTableMode);
  kanbanEl.classList.toggle('hidden', sketchState.myOtsMode !== 'kanban');
  if (schedEl) schedEl.classList.toggle('hidden', !isSchedMode);
  leftEnvTree?.classList.toggle('hidden', sketchState.myOtsMode !== 'cards' || !mine.length);
  const leftTrafficTree = document.getElementById('left-traffic-tree');
  if (leftTrafficTree && !document.getElementById('view-my-ots')?.classList.contains('hidden')) {
    const showFilters = sketchState.myOtsMode !== 'cards';
    leftTrafficTree.classList.toggle('hidden', !showFilters);
    if (showFilters) {
      sketchState.trafficScope = 'my-ots';
      renderTrafficTree();
    }
  }

  const headerLeftEl = document.getElementById('my-ots-header-left');
  const headerCodeEl = document.getElementById('my-ots-header-code');
  const infoRowEl = document.getElementById('my-ots-info-row');

  let activeOt = null;
  let activeTask = null;

  if (isMyTasksScope) {
    const activeEntry = myTasks.length
      ? (myTasks.find((t) => t.otId === sketchState.activeMyOtId && t.taskIndex === sketchState.activeTaskIndex) || myTasks[0])
      : null;
    if (activeEntry) {
      activeOt = activeEntry.ot;
      sketchState.activeMyOtId = activeEntry.otId;
      if (sketchState.activeTaskIndex === null) sketchState.activeTaskIndex = activeEntry.taskIndex;
    }
  } else {
    activeOt = mine.length ? (mine.find((o) => o.id === sketchState.activeMyOtId) || mine[0]) : null;
  }

  if (activeOt) {
    sketchState.activeMyOtId = activeOt.id;
    ensureOtData(activeOt, formatShortDate);
    activeTask = sketchState.myOtsMode === 'cards' && sketchState.activeTaskIndex !== null && activeOt.subtasks?.[sketchState.activeTaskIndex]
      ? activeOt.subtasks[sketchState.activeTaskIndex]
      : null;
    const displayTitle = activeTask ? activeTask.title : activeOt.title;
    const displayCode = activeTask ? `${activeOt.id}-${sketchState.activeTaskIndex + 1}` : activeOt.id;

    if (!document.getElementById('view-my-ots')?.classList.contains('hidden')) {
      const centerTitle = document.getElementById('center-page-title');
      const rootLabel = sketchState.myOtsScope === 'archived'
        ? 'OTs Archivadas'
        : (isMyTasksScope ? 'Mis Tareas' : 'Mis OTs');
      if (centerTitle) centerTitle.textContent = activeTask && !isMyTasksScope ? `${rootLabel} / Tareas` : rootLabel;
    }

    if (sketchState.myOtsMode === 'cards') {
      if (headerLeftEl) {
        headerLeftEl.classList.remove('hidden');
        headerLeftEl.innerHTML = `
          <h2 class="text-[15px] font-medium text-[#D4D4D4] truncate">${escapeHtml(displayTitle)}</h2>
          <label class="flex items-center gap-1.5 text-[11px] cursor-pointer shrink-0">
            <input type="checkbox" ${activeOt.urgent ? 'checked' : ''} class="accent-rose-500 rounded">
            <span class="text-rose-400">Urgente</span>
          </label>
        `;
      }
      if (headerCodeEl) {
        headerCodeEl.textContent = displayCode;
        headerCodeEl.classList.remove('hidden');
      }
      if (infoRowEl) {
        infoRowEl.innerHTML = renderOtInfoRowHtml(activeOt, formatShortDate);
        infoRowEl.classList.remove('hidden');
      }
    } else {
      if (headerLeftEl) {
        headerLeftEl.innerHTML = '';
        headerLeftEl.classList.add('hidden');
      }
      if (headerCodeEl) {
        headerCodeEl.textContent = '';
        headerCodeEl.classList.add('hidden');
      }
      if (infoRowEl) {
        infoRowEl.innerHTML = '';
        infoRowEl.classList.add('hidden');
      }
    }
  } else {
    if (headerLeftEl) headerLeftEl.innerHTML = '';
    if (headerCodeEl) {
      headerCodeEl.textContent = '';
      headerCodeEl.classList.add('hidden');
    }
    if (infoRowEl) {
      infoRowEl.innerHTML = '';
      infoRowEl.classList.add('hidden');
    }
  }

  let activePieceForInspector = null;
  let activeRouteForInspector = null;
  if (sketchState.myOtsMode === 'cards' && activeOt) {
    ensureOtData(activeOt, formatShortDate);
    const rawPieces = (activeTask ? activeTask.mediaFiles : activeOt.mediaFiles) || [];
    const filtered = getFilteredGalleryPieces(rawPieces, {
      allowFilters: !activeTask,
      showTaskFilter: !activeTask,
    });
    const hasActivePiece =
      sketchState.activePieceIndex !== null &&
      sketchState.activePieceIndex !== undefined &&
      sketchState.activePieceIndex >= 0 &&
      sketchState.activePieceIndex < filtered.length;
    activePieceForInspector = hasActivePiece ? filtered[sketchState.activePieceIndex] : null;

    const currentRoutes = (activeTask ? activeTask.routes : activeOt.routes) || [];
    if (
      sketchState.activeRouteIndex !== null &&
      sketchState.activeRouteIndex !== undefined &&
      currentRoutes[sketchState.activeRouteIndex]
    ) {
      activeRouteForInspector = currentRoutes[sketchState.activeRouteIndex];
    } else {
      sketchState.activeRouteIndex = null;
    }
  }

  const openFromCollection = (otId, tIdx = '') => {
    sketchState.activeMyOtId = otId;
    sketchState.activeTaskIndex = tIdx !== undefined && tIdx !== '' && tIdx !== null ? Number(tIdx) : null;
    sketchState.activeRouteIndex = null;
    sketchState.activePieceIndex = null;
    sketchState.myOtsMode = 'cards';
    renderMyOts();
  };

  if (sketchState.myOtsMode === 'cards') {
    renderOtInspectorPanel(activeOt, activeTask, {
      activePiece: activePieceForInspector,
      selectedPieceCount: sketchState.selectedPieces.size,
      activeRoute: activeRouteForInspector,
      activeRouteIndex: sketchState.activeRouteIndex,
      onRerender: renderMyOts,
      onJumpStripboard: jumpStripboardCb,
    });
  } else if (activeOt) {
    renderTrafficNotesInspector(activeOt.id, activeTask ? sketchState.activeTaskIndex : '', false, {
      onOpenOt: openFromCollection,
    });
  }

  if (sketchState.myOtsMode === 'cards') {
    if (!activeOt) {
      cardsEl.innerHTML = `<div class="p-8 text-center text-[11px] text-[#8C8C8C] border border-obsidian-border rounded-xl bg-[#202020]">No tienes OTs asignadas.</div>`;
      return;
    }

    ensureOtData(activeOt, formatShortDate);
    if (taskTreeList) {
      renderOtTaskTree(activeOt, taskTreeList, sketchState.activeTaskIndex, (nextIdx) => {
        sketchState.activeTaskIndex = nextIdx;
        sketchState.activeRouteIndex = null;
        sketchState.activePieceIndex = null;
        sketchState.selectedPieces.clear();
        renderMyOts();
      });
    }

    cardsEl.innerHTML = renderOtDetailHtml(activeOt, formatShortDate, sketchState.activeTaskIndex);
    if (window.hydrateIcons) window.hydrateIcons(cardsEl);

    cardsEl.querySelectorAll('tr[data-route-row-idx]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('input, select, button, a')) return;
        const idx = Number(row.dataset.routeRowIdx);
        if (Number.isNaN(idx)) return;
        sketchState.activeRouteIndex = sketchState.activeRouteIndex === idx ? null : idx;
        sketchState.activePieceIndex = null;
        sketchState.inspectorTab = 'detail';
        renderMyOts();
      });
    });

    // Stamp current date/time on click in any unsigned or new Bitácora date input
    cardsEl.querySelectorAll('[data-new-route-col="date"]').forEach((inp) => {
      const stamp = () => {
        inp.value = formatBitacoraNow();
      };
      inp.addEventListener('click', stamp);
      inp.addEventListener('focus', () => {
        if (!inp.value) stamp();
      });
    });

    // Immediate sign + lock + timestamp update on new blank row
    cardsEl.querySelectorAll('[data-new-route-col="sign"]').forEach((sel) => {
      sel.addEventListener('change', () => {
        if (!sel.value) return;
        const row = sel.closest('tr[data-new-route-ot]');
        if (row) commitBlankRouteRow(row, { signedNow: true });
      });
    });

    // Editable unsigned existing rows: click date to stamp, edit fields, sign to lock & update timestamp
    const targetObjForRoutes = activeTask || activeOt;
    const routesArr = (activeTask ? activeTask.routes : activeOt.routes) || [];
    cardsEl.querySelectorAll('tr[data-edit-route-idx]').forEach((row) => {
      const rIdx = Number(row.dataset.editRouteIdx);
      const routeObj = routesArr[rIdx];
      if (!routeObj || routeObj.locked) return;

      const dateInp = row.querySelector('[data-edit-route-col="date"]');
      dateInp?.addEventListener('click', (e) => {
        e.stopPropagation();
        const nowStamp = formatBitacoraNow();
        routeObj.date = nowStamp;
        dateInp.value = nowStamp;
      });

      row.querySelector('[data-edit-route-col="from"]')?.addEventListener('change', (e) => {
        routeObj.from = e.target.value;
      });
      row.querySelector('[data-edit-route-col="to"]')?.addEventListener('change', (e) => {
        routeObj.to = e.target.value;
        syncDepartmentFromRoutes(targetObjForRoutes);
      });
      row.querySelector('[data-edit-route-col="desc"]')?.addEventListener('input', (e) => {
        routeObj.desc = e.target.value;
      });
      row.querySelector('[data-edit-route-col="notes"]')?.addEventListener('input', (e) => {
        routeObj.notes = e.target.value;
      });
      row.querySelector('[data-edit-route-col="sign"]')?.addEventListener('change', (e) => {
        const signer = e.target.value;
        if (!signer) return;
        routeObj.sign = signer;
        routeObj.date = formatBitacoraNow();
        routeObj.locked = true;
        syncDepartmentFromRoutes(targetObjForRoutes);
        recordOtActivity(targetObjForRoutes, `firmó bitácora: ${routeObj.from || 'Cuentas'} → ${routeObj.to || '—'}`, signer);
        notifySketchChange('orders');
        renderMyOts();
      });

      row.querySelector('[data-delete-route-idx]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        routesArr.splice(rIdx, 1);
        if (sketchState.activeRouteIndex === rIdx) sketchState.activeRouteIndex = null;
        else if (sketchState.activeRouteIndex !== null && sketchState.activeRouteIndex > rIdx) {
          sketchState.activeRouteIndex -= 1;
        }
        syncDepartmentFromRoutes(targetObjForRoutes);
        notifySketchChange('orders');
        renderMyOts();
      });
    });

    bindGalleryEvents(
      cardsEl,
      renderMyOts,
      () => getFilteredGalleryPieces((activeTask ? activeTask.mediaFiles : activeOt.mediaFiles) || [], {
        allowFilters: !activeTask,
        showTaskFilter: !activeTask,
      }),
      () => {
        const targetObj = activeTask || activeOt;
        if (targetObj && Array.isArray(targetObj.mediaFiles)) {
          targetObj.mediaFiles = targetObj.mediaFiles.filter((p) => !sketchState.selectedPieces.has(p.name));
        }
      }
    );
  } else if (isTableMode && listBodyEl) {
    let tableItems = mine;
    if (isDayMode) {
      const anchorDate = sketchState.trafficScheduleDate;
      const busyDates = new Set(mine.map((o) => (o.deliveryDate || '').slice(0, 10)).filter(Boolean));
      renderInspectorMiniCalendar({
        anchorDate,
        busyDates,
        onSelectDate: (iso) => {
          sketchState.trafficScheduleDate = iso;
          renderMyOts();
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
            renderMyOts();
          },
          () => {
            sketchState.trafficScheduleDate = relDate(0).slice(0, 10);
            renderMyOts();
          }
        );
      }
      tableItems = mine.filter((o) => (o.deliveryDate || '').slice(0, 10) === anchorDate);
      if (countEl) {
        const unit = isMyTasksScope ? (tableItems.length === 1 ? 'Tarea' : 'Tareas') : (tableItems.length === 1 ? 'OT' : 'OTs');
        countEl.textContent = `${tableItems.length} ${unit}`;
      }
    }
    if (!tableItems.length) {
      listBodyEl.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-[11px] text-[#8C8C8C]">${isDayMode ? 'Sin entregas programadas para este día.' : (isMyTasksScope ? 'No tienes tareas asignadas.' : 'No tienes OTs asignadas.')}</td></tr>`;
      return;
    }
    listBodyEl.innerHTML = tableItems.map((ot, idx) => {
      const zebra = idx % 2 === 1 ? 'bg-[#262626]' : 'bg-[#1d1d1d]';
      const cColor = getClientColor(ot.client);
      const realOtId = ot.otId || ot.id;
      const taskIdxAttr = ot.taskIndex !== undefined ? ot.taskIndex : '';
      const deptVal = ot.department || 'Tráfico';
      const stageVal = ot.stage || 'Tráfico';
      return `
        <tr data-myots-open="${escapeHtml(realOtId)}" data-myots-task="${taskIdxAttr}" class="${zebra} hover:bg-obsidian-elevated/70 transition-colors text-[10.5px] cursor-pointer">
          <td class="px-1 py-1.5 border-r border-obsidian-border align-middle text-center">
            ${getPriorityDotHtml(ot)}
          </td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
            <span class="font-mono font-semibold text-obsidian-amber px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border whitespace-nowrap block text-center">${escapeHtml(ot.id)}</span>
          </td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-medium truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate text-[#8C8C8C]">${escapeHtml(ot.brand)}${ot.product && ot.product !== ot.brand ? ' • ' + escapeHtml(ot.product) : ''}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate">${escapeHtml(ot.media)}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle"><span class="font-mono text-[#D4D4D4] px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border truncate block">${escapeHtml(ot.ref)}</span></td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#D4D4D4]"><div class="line-clamp-2 leading-tight">${escapeHtml(ot.title)}</div></td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-mono text-[10px] text-[#8C8C8C] text-center">${escapeHtml(formatShortDate(ot.entryDate))}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-mono text-[10px] text-[#8C8C8C] text-center">${escapeHtml(formatShortDate(ot.deliveryDate))}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate" style="color:${escapeHtml(getDepartmentColor(deptVal))}">${escapeHtml(deptVal)}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
            <select data-ot-id="${escapeHtml(realOtId)}" data-task-index="${taskIdxAttr}" class="myots-stage-sel w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#D4D4D4] focus:outline-none cursor-pointer">
              ${trafficStages.map((st) => `<option value="${escapeHtml(st)}" ${stageVal === st ? 'selected' : ''}>${escapeHtml(st)}</option>`).join('')}
            </select>
          </td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
            <select data-ot-id="${escapeHtml(realOtId)}" data-task-index="${taskIdxAttr}" class="myots-status-sel w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#D4D4D4] focus:outline-none cursor-pointer">
              ${trafficStatuses.map((s) => `<option value="${escapeHtml(s)}" ${ot.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
          </td>
          <td class="px-1.5 py-1.5 align-middle text-[10px] text-[#8C8C8C] truncate">${escapeHtml(ot.notes)}</td>
        </tr>
      `;
    }).join('');

    bindTableColResizers(listEl.querySelector('table'));

    listBodyEl.querySelectorAll('tr[data-myots-open]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('select, input, button, a')) return;
        listBodyEl.querySelectorAll('tr[data-myots-open]').forEach((r) => {
          r.classList.remove('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
        });
        row.classList.add('ring-1', 'ring-inset', 'ring-obsidian-amber/60');
        renderTrafficNotesInspector(row.dataset.myotsOpen, row.dataset.myotsTask || '', false, {
          onOpenOt: openFromCollection,
        });
      });
      row.addEventListener('dblclick', (e) => {
        if (e.target.closest('select, input, button, a')) return;
        openFromCollection(row.dataset.myotsOpen, row.dataset.myotsTask || '');
      });
    });
  } else if (sketchState.myOtsMode === 'kanban') {
    const groupMode = ['priority', 'stage', 'status', 'department', 'client'].includes(sketchState.myOtsGroupBy)
      ? sketchState.myOtsGroupBy
      : 'stage';
    kanbanEl.innerHTML = renderKanbanScheduleHtml({
      items: mine,
      groupBy: groupMode,
      todayKey: relDate(0).slice(0, 10),
      tomorrowKey: relDate(1).slice(0, 10),
      departments: trafficDepartments,
      stages: trafficStages,
      statuses: trafficStatuses,
      members: trafficMembers,
      wrap: false,
    });
    bindKanbanScheduleEvents({
      container: kanbanEl,
      orders: trafficOrders,
      onInspectItem: (otId, taskIdx) => {
        const rb = document.getElementById('right-body');
        if (rb && rb.querySelector('#insp-cal-slot')) rb.innerHTML = '';
        renderTrafficNotesInspector(otId, taskIdx, false, { onOpenOt: openFromCollection });
      },
      onOpenItem: (otId, taskIdx) => openFromCollection(otId, taskIdx),
      onChanged: () => {
        renderMyOts();
        notifySketchChange('orders');
      },
    });
  } else if (isSchedMode && schedEl) {
    mountScheduleView({
      container: schedEl,
      mode: sketchState.myOtsMode,
      anchorDate: sketchState.trafficScheduleDate,
      items: mine,
      ganttScale: sketchState.ganttScale,
      dateAttr: 'data-myots-pick-date',
      onScaleChange: (nextScale) => {
        sketchState.ganttScale = nextScale;
        renderMyOts();
      },
      onShiftDate: (dir) => {
        sketchState.trafficScheduleDate = shiftScheduleDate(
          sketchState.trafficScheduleDate,
          sketchState.myOtsMode,
          dir,
          sketchState.ganttScale
        );
        renderMyOts();
      },
      onToday: () => {
        sketchState.trafficScheduleDate = relDate(0).slice(0, 10);
        renderMyOts();
      },
      onSelectDate: (iso) => {
        sketchState.trafficScheduleDate = iso;
        renderMyOts();
      },
      onPickDayToDayView: (iso) => {
        sketchState.trafficScheduleDate = iso;
        sketchState.myOtsMode = 'day';
        renderMyOts();
      },
      onInspectItem: (otId, taskIdx) => renderTrafficNotesInspector(otId, taskIdx, false, { onOpenOt: openFromCollection }),
      onOpenItem: (otId, taskIdx) => openFromCollection(otId, taskIdx),
    });
  }

  document.querySelectorAll('.myots-stage-sel').forEach((sel) => {
    sel.addEventListener('change', () => {
      const target = trafficOrders.find((o) => o.id === sel.dataset.otId);
      if (!target) return;
      const tIdx = sel.dataset.taskIndex;
      if (tIdx !== undefined && tIdx !== '' && target.subtasks?.[Number(tIdx)]) {
        target.subtasks[Number(tIdx)].stage = sel.value;
      } else {
        target.stage = sel.value;
      }
      sel.style.color = getStageColor(sel.value);
      notifySketchChange('orders');
    });
  });

  document.querySelectorAll('.myots-status-sel').forEach((sel) => {
    sel.addEventListener('change', () => {
      const target = trafficOrders.find((o) => o.id === sel.dataset.otId);
      if (!target) return;
      const tIdx = sel.dataset.taskIndex;
      if (tIdx !== undefined && tIdx !== '' && target.subtasks?.[Number(tIdx)]) {
        target.subtasks[Number(tIdx)].status = sel.value;
      } else {
        target.status = sel.value;
      }
      sel.style.color = getStatusColor(sel.value);
      notifySketchChange('orders');
    });
  });
}

/**
 * Initialize Detalle de OT module, mode buttons, bitácora commit listeners, and store subscriptions.
 */
export function initOtDetail({ onJumpStripboard, onBackToTraffic } = {}) {
  jumpStripboardCb = onJumpStripboard || null;
  backToTrafficCb = onBackToTraffic || null;
  if (initialized) return;
  initialized = true;

  ensureMyOtsHeaderControls();

  document.querySelectorAll('.myots-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.myOtsMode = btn.dataset.myotsMode;
      if (btn.dataset.myotsMode === 'kanban' || btn.dataset.myotsMode === 'list') {
        sketchState.myOtsLastCollectionMode = btn.dataset.myotsMode;
      }
      syncMyOtsModeButtons();
      renderMyOts();
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const row = e.target?.closest?.('tr[data-new-route-ot]');
    if (!row) return;
    e.preventDefault();
    commitBlankRouteRow(row);
  });

  document.addEventListener('focusout', (e) => {
    const row = e.target?.closest?.('tr[data-new-route-ot]');
    if (!row) return;
    requestAnimationFrame(() => {
      if (!document.body.contains(row)) return;
      if (row.contains(document.activeElement)) return;
      commitBlankRouteRow(row);
    });
  });

  document.getElementById('btn-envelope-add-subtask')?.addEventListener('click', () => {
    const activeOt = trafficOrders.find((o) => o.id === sketchState.activeMyOtId);
    if (!activeOt || activeOt.archived) return;
    ensureOtData(activeOt, formatShortDate);
    const nextNum = (activeOt.subtasks || []).length + 1;
    activeOt.subtasks.push({
      title: `Nueva sub-tarea ${nextNum}`,
      responsible: activeOt.responsible || sketchState.myOtsMember || 'Andrés',
      department: activeOt.department || 'Creativos',
      stage: 'Tráfico',
      status: 'En proceso',
      entryDate: activeOt.entryDate,
      deliveryDate: activeOt.deliveryDate,
      scheduledDate: (activeOt.deliveryDate || '').slice(0, 10),
      estimatedHours: 2,
      notes: '',
      routes: [],
      mediaFiles: [],
    });
    sketchState.activeTaskIndex = activeOt.subtasks.length - 1;
    sketchState.activePieceIndex = 0;
    sketchState.selectedPieces.clear();
    notifySketchChange('orders');
    renderMyOts();
  });

  const renderIfVisible = () => {
    const view = document.getElementById('view-my-ots');
    if (view && !view.classList.contains('hidden')) {
      renderMyOts();
    }
  };

  onSketchChange('orders', renderIfVisible);
  onSketchChange('team', () => {
    ensureMyOtsHeaderControls();
    renderIfVisible();
  });
}
