/**
 * Detalle de OT / Tarea (#view-my-ots) + árbol izquierdo de tareas + Inspector (#right-body).
 */

import {
  escapeHtml,
  formatShortDate,
  getClientColor,
  notifySketchChange,
  onSketchChange,
  sketchState,
  studioSettings,
  trafficMembers,
  trafficOrders,
  trafficStatuses,
  ensureOtData
} from './store.js';
import { renderGallerySectionHtml, bindGalleryEvents } from './gallery.js';
import {
  ensureStripboardDaySeeded,
  getDayReservedHours,
  moveTaskToScheduledDate
} from './stripboard.js';

let initialized = false;
let jumpStripboardCb = null;

/**
 * Sync active state of .myots-mode-btn buttons with sketchState.myOtsMode.
 */
function syncMyOtsModeButtons() {
  document.querySelectorAll('.myots-mode-btn').forEach((b) => {
    const active = b.dataset.myotsMode === sketchState.myOtsMode;
    b.classList.toggle('bg-obsidian-elevated', active);
    b.classList.toggle('text-[#D4D4D4]', active);
    b.classList.toggle('text-[#8C8C8C]', !active);
    b.classList.toggle('hover:bg-obsidian-elevated', !active);
  });
}

/**
 * Ensure #my-ots-member-select and #my-ots-count exist in #view-my-ots and are connected.
 */
function ensureMyOtsHeaderControls() {
  const topbar = document.getElementById('my-ots-topbar');
  if (!topbar) return;

  let memberSel = document.getElementById('my-ots-member-select');
  let countEl = document.getElementById('my-ots-count');

  if (!memberSel || !countEl) {
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
    if (!memberSel) {
      memberSel = document.createElement('select');
      memberSel.id = 'my-ots-member-select';
      memberSel.className = 'h-6 bg-[#191919] border border-obsidian-border rounded-md px-1.5 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer';
      controlsWrap.appendChild(memberSel);
    }
    if (!countEl) {
      countEl = document.createElement('span');
      countEl.id = 'my-ots-count';
      countEl.className = 'text-[10.5px] font-mono text-[#8C8C8C] whitespace-nowrap';
      controlsWrap.appendChild(countEl);
    }
  }

  memberSel.innerHTML = trafficMembers
    .map((m) => `<option value="${escapeHtml(m)}" ${m === sketchState.myOtsMember ? 'selected' : ''}>${escapeHtml(m)}</option>`)
    .join('');

  if (!memberSel.dataset.bound) {
    memberSel.dataset.bound = '1';
    memberSel.addEventListener('change', (e) => {
      sketchState.myOtsMember = e.target.value;
      sketchState.activeMyOtId = null;
      sketchState.activeTaskIndex = null;
      renderMyOts();
    });
  }
}

/**
 * Commit a newly entered blank route row in the bitácora table.
 */
function commitBlankRouteRow(row) {
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
  if (!desc && !to && !notes && !from && !sign) return;

  row.dataset.committing = '1';
  const targetTask = taskAttr !== null && taskAttr !== 'root' ? ot.subtasks?.[Number(taskAttr)] : null;
  const targetRoutes = targetTask ? (targetTask.routes || (targetTask.routes = [])) : (ot.routes || (ot.routes = []));
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const fallbackDate = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${String(now.getFullYear()).slice(-2)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  targetRoutes.push({
    date: date || fallbackDate,
    from: from || 'Tráfico',
    to: to || '—',
    desc: desc || '—',
    sign: sign || ot.responsible || '—',
    notes: notes || '',
    locked: false
  });
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
  return `
    <div class="bg-[#202020] border border-obsidian-border rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-1.5 text-[10.5px]">
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">No. OT</label>
        <input type="text" readonly value="${escapeHtml(ot.id)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-obsidian-amber font-mono font-semibold text-[10.5px] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Cliente</label>
        <div class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] font-medium truncate flex items-center gap-1">
          <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
          <span class="truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
        </div>
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Marca/Prod.</label>
        <input type="text" value="${escapeHtml(ot.brand)}${ot.product && ot.product !== ot.brand ? ' · ' + escapeHtml(ot.product) : ''}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none">
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
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Estado</label>
        <select data-ot-id="${escapeHtml(ot.id)}" class="myots-status-sel w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
          ${trafficStatuses.map((s) => `<option value="${escapeHtml(s)}" ${ot.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Firma</label>
        <input type="text" readonly value="${escapeHtml(ot.responsible)}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10.5px] text-[#8C8C8C] focus:outline-none">
      </div>
      <div>
        <label class="text-[9px] uppercase tracking-[0.08em] text-[#8C8C8C] block mb-0.5">Entrada</label>
        <input type="text" value="${escapeHtml(formatDateFn(ot.entryDate))}" class="w-full bg-[#191919] border border-obsidian-border rounded px-1.5 py-1 text-[10px] font-mono text-[#8C8C8C] focus:outline-none">
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
              <th class="px-2 py-1.5 border-r border-obsidian-border w-24">Firma</th>
              <th class="px-2 py-1.5 border-r border-obsidian-border">Notas</th>
              <th class="px-2 py-1.5 w-9 text-center"><span data-icon="lock" data-icon-size="w-3 h-3"></span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-obsidian-border">
            ${routes.map((r) => {
              const isLocked = ot.archived || r.locked;
              return `
              <tr class="hover:bg-obsidian-elevated/40">
                <td class="px-2 py-1.5 border-r border-obsidian-border font-mono text-[10px] text-[#8C8C8C]">${escapeHtml(r.date)}</td>
                <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C]">${escapeHtml(r.from)}</td>
                <td class="px-2 py-1.5 border-r border-obsidian-border text-[#D4D4D4]">${escapeHtml(r.to)}</td>
                <td class="px-2 py-1.5 border-r border-obsidian-border text-[#D4D4D4]">${escapeHtml(r.desc)}</td>
                <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C]">${escapeHtml(r.sign)}</td>
                <td class="px-2 py-1.5 border-r border-obsidian-border text-[#8C8C8C]">${escapeHtml(r.notes)}</td>
                <td class="px-2 py-1.5 text-center ${isLocked ? 'text-rose-400' : 'text-emerald-400'}"><span data-icon="${isLocked ? 'lock' : 'lock-open'}" data-icon-size="w-3 h-3"></span></td>
              </tr>
            `;
            }).join('')}
            ${ot.archived ? '' : `
            <tr data-new-route-ot="${escapeHtml(ot.id)}" data-new-route-task="${taskIndex === null ? 'root' : taskIndex}" class="hover:bg-obsidian-elevated/30">
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <input type="text" data-new-route-col="date" placeholder="—" class="w-full bg-transparent font-mono text-[10px] text-[#8C8C8C] placeholder-[#555555] focus:outline-none focus:text-[#D4D4D4]" />
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <select data-new-route-col="from" class="w-full bg-transparent text-[10.5px] text-[#8C8C8C] focus:outline-none focus:text-[#D4D4D4] cursor-pointer">
                  <option value="" class="bg-[#202020]">—</option>
                  ${['Cuentas', 'Creativos', 'Tráfico', 'Diseño', 'Producción', 'Cliente'].map((d) => `<option value="${d}" class="bg-[#202020]">${d}</option>`).join('')}
                </select>
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <select data-new-route-col="to" class="w-full bg-transparent text-[10.5px] text-[#D4D4D4] focus:outline-none cursor-pointer">
                  <option value="" class="bg-[#202020]">—</option>
                  ${['Cuentas', 'Creativos', 'Tráfico', 'Diseño', 'Producción', 'Cliente'].map((d) => `<option value="${d}" class="bg-[#202020]">${d}</option>`).join('')}
                </select>
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <input type="text" data-new-route-col="desc" placeholder="..." class="w-full bg-transparent text-[10.5px] text-[#D4D4D4] placeholder-[#555555] focus:outline-none" />
              </td>
              <td class="px-2 py-1.5 border-r border-obsidian-border">
                <select data-new-route-col="sign" class="w-full bg-transparent text-[10.5px] text-[#8C8C8C] focus:outline-none focus:text-[#D4D4D4] cursor-pointer">
                  <option value="" class="bg-[#202020]">—</option>
                  ${trafficMembers.map((m) => `<option value="${escapeHtml(m)}" class="bg-[#202020]">${escapeHtml(m)}</option>`).join('')}
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
      ${renderGallerySectionHtml(rawPieces, {
        allowFilters: !activeTask,
        showTaskFilter: !activeTask,
        subtasks: ot.subtasks || [],
        galleryMinH: routesCollapsed ? 'h-[calc(100vh-200px)] min-h-[740px]' : 'h-[calc(100vh-330px)] min-h-[620px]',
        canCollapse: true
      })}
    </div>
  `;
}

/**
 * Render the Inspector panel (#right-body) for the active task in Detalle de OT.
 */
function renderInspectorPanel(activeOt, inspTask) {
  const rightBodyEl = document.getElementById('right-body');
  if (!rightBodyEl) return;

  if (!inspTask || !activeOt) {
    rightBodyEl.innerHTML = '';
    return;
  }

  const dailyHours = Number(studioSettings.dailyHours) || 8;
  const taskUid = `${activeOt.id}::${sketchState.activeTaskIndex}`;
  const taskCode = `${activeOt.id}-${sketchState.activeTaskIndex + 1}`;
  const schedDate = (inspTask.scheduledDate || inspTask.deliveryDate || activeOt.deliveryDate || '').slice(0, 10);
  const estHours = Number(inspTask.estimatedHours ?? 3) || 0;
  const reserved = getDayReservedHours(schedDate);
  const isOver = reserved > dailyHours;

  rightBodyEl.innerHTML = `
    <div class="space-y-3 text-[11px]">
      <div class="pb-2 border-b border-obsidian-border space-y-1">
        <div class="flex items-center justify-between gap-2">
          <span class="font-mono text-[10px] font-semibold text-obsidian-amber px-1.5 py-0.5 rounded bg-[#191919] border border-obsidian-border">${escapeHtml(taskCode)}</span>
          <span class="text-[10px] text-[#8C8C8C]">${escapeHtml(inspTask.status || activeOt.status || '')}</span>
        </div>
        <div class="text-[12px] font-medium text-[#D4D4D4] leading-snug">${escapeHtml(inspTask.title)}</div>
        <div class="text-[10px] text-[#8C8C8C]">${escapeHtml(activeOt.client)} · ${escapeHtml(activeOt.brand)}</div>
      </div>

      <div class="space-y-2">
        <div class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Programación y Tiempo</div>
        <label class="block space-y-1">
          <span class="text-[10px] text-[#8C8C8C]">Tiempo dedicado (horas)</span>
          <input id="insp-task-hours" type="number" min="0.5" max="16" step="0.5" value="${estHours}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-md px-2 text-[11px] font-mono text-[#D4D4D4] focus:outline-none focus:border-obsidian-amber/60" />
        </label>
        <label class="block space-y-1">
          <span class="text-[10px] text-[#8C8C8C]">Día programado (entrega: ${escapeHtml(formatShortDate(inspTask.deliveryDate || activeOt.deliveryDate) || '—')})</span>
          <input id="insp-task-date" type="date" value="${escapeHtml(schedDate)}" style="color-scheme: dark;" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-md px-2 text-[11px] font-mono text-[#D4D4D4] focus:outline-none focus:border-obsidian-amber/60 cursor-pointer" />
        </label>
      </div>

      <div id="insp-capacity-box" class="p-2.5 rounded-lg border ${isOver ? 'bg-rose-500/10 border-rose-500/40' : 'bg-[#191919] border-obsidian-border'} space-y-1.5">
        <div class="flex items-center justify-between text-[10.5px]">
          <span class="text-[#8C8C8C]">Reservado ese día</span>
          <span id="insp-capacity-val" class="font-mono font-semibold ${isOver ? 'text-rose-300' : 'text-[#D4D4D4]'}">${reserved}h / ${dailyHours}h</span>
        </div>
        <div class="h-1.5 w-full rounded-full bg-[#262626] overflow-hidden">
          <div id="insp-capacity-bar" class="h-full ${isOver ? 'bg-rose-400' : 'bg-obsidian-amber'} transition-all" style="width:${Math.min(100, Math.round((reserved / dailyHours) * 100))}%"></div>
        </div>
        <div id="insp-capacity-note" class="text-[10px] ${isOver ? 'text-rose-300' : 'text-[#8C8C8C]'}">
          ${isOver ? `Sobrecarga de ${(reserved - dailyHours).toFixed(1).replace(/\.0$/, '')}h. Arrastra filas en el Stripboard para reordenar o mover de día.` : `Disponible: ${(dailyHours - reserved).toFixed(1).replace(/\.0$/, '')}h libres en este día.`}
        </div>
      </div>

      <div class="flex gap-1.5 pt-1">
        <button type="button" id="insp-go-sb-day" class="flex-1 h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">Ver Día</button>
        <button type="button" id="insp-go-sb-week" class="flex-1 h-7 rounded-md bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">Ver Semana</button>
      </div>
    </div>
  `;

  const hrsInput = rightBodyEl.querySelector('#insp-task-hours');
  const dateInput = rightBodyEl.querySelector('#insp-task-date');

  hrsInput?.addEventListener('input', (e) => {
    const val = Math.max(0, Number(e.target.value) || 0);
    inspTask.estimatedHours = val;
    const curDate = (inspTask.scheduledDate || inspTask.deliveryDate || activeOt.deliveryDate || '').slice(0, 10);
    ensureStripboardDaySeeded(curDate);
    const nextReserved = getDayReservedHours(curDate);
    const curDaily = Number(studioSettings.dailyHours) || 8;
    const over = nextReserved > curDaily;
    const box = rightBodyEl.querySelector('#insp-capacity-box');
    const valEl = rightBodyEl.querySelector('#insp-capacity-val');
    const barEl = rightBodyEl.querySelector('#insp-capacity-bar');
    const noteEl = rightBodyEl.querySelector('#insp-capacity-note');

    if (box) box.className = `p-2.5 rounded-lg border ${over ? 'bg-rose-500/10 border-rose-500/40' : 'bg-[#191919] border-obsidian-border'} space-y-1.5`;
    if (valEl) {
      valEl.className = `font-mono font-semibold ${over ? 'text-rose-300' : 'text-[#D4D4D4]'}`;
      valEl.textContent = `${nextReserved}h / ${curDaily}h`;
    }
    if (barEl) {
      barEl.className = `h-full ${over ? 'bg-rose-400' : 'bg-obsidian-amber'} transition-all`;
      barEl.style.width = `${Math.min(100, Math.round((nextReserved / curDaily) * 100))}%`;
    }
    if (noteEl) {
      noteEl.className = `text-[10px] ${over ? 'text-rose-300' : 'text-[#8C8C8C]'}`;
      noteEl.textContent = over
        ? `Sobrecarga de ${(nextReserved - curDaily).toFixed(1).replace(/\.0$/, '')}h. Arrastra filas en el Stripboard para reordenar o mover de día.`
        : `Disponible: ${(curDaily - nextReserved).toFixed(1).replace(/\.0$/, '')}h libres en este día.`;
    }
    notifySketchChange('stripboard');
  });

  dateInput?.addEventListener('change', (e) => {
    if (!e.target.value) return;
    moveTaskToScheduledDate(taskUid, e.target.value);
    renderMyOts();
    notifySketchChange('stripboard');
  });

  const jumpToStripboard = (mode) => {
    sketchState.stripboardDate = (inspTask.scheduledDate || inspTask.deliveryDate || activeOt.deliveryDate || '').slice(0, 10) || sketchState.stripboardDate;
    sketchState.stripboardViewMode = mode;
    if (jumpStripboardCb) {
      jumpStripboardCb(mode);
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

  rightBodyEl.querySelector('#insp-go-sb-day')?.addEventListener('click', () => jumpToStripboard('day'));
  rightBodyEl.querySelector('#insp-go-sb-week')?.addEventListener('click', () => jumpToStripboard('week'));
}

/**
 * Render #view-my-ots (Detalle de OT, Lista, Kanban) and #right-body Inspector.
 */
export function renderMyOts() {
  const cardsEl = document.getElementById('my-ots-cards');
  const listEl = document.getElementById('my-ots-list');
  const listBodyEl = document.getElementById('my-ots-list-body');
  const kanbanEl = document.getElementById('my-ots-kanban');
  const leftEnvTree = document.getElementById('left-envelope-tree');
  const taskTreeList = document.getElementById('envelope-task-tree-list');
  if (!cardsEl || !listEl || !kanbanEl) return;

  ensureMyOtsHeaderControls();
  syncMyOtsModeButtons();
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

  const mine = sketchState.myOtsScope === 'archived'
    ? trafficOrders.filter((o) => o.archived)
    : (sketchState.myOtsScope === 'traffic-open'
      ? trafficOrders.filter((o) => !o.archived)
      : (isMyTasksScope
        ? myTasks
        : trafficOrders.filter((o) => !o.archived && o.responsible === sketchState.myOtsMember)));

  if (countEl) {
    const unit = isMyTasksScope ? (mine.length === 1 ? 'Tarea' : 'Tareas') : (mine.length === 1 ? 'OT' : 'OTs');
    countEl.textContent = `${mine.length} ${unit}`;
  }

  cardsEl.classList.toggle('hidden', sketchState.myOtsMode !== 'cards');
  listEl.classList.toggle('hidden', sketchState.myOtsMode !== 'list');
  kanbanEl.classList.toggle('hidden', sketchState.myOtsMode !== 'kanban');
  leftEnvTree?.classList.toggle('hidden', sketchState.myOtsMode !== 'cards' || !mine.length);

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

    if (headerLeftEl) {
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

  renderInspectorPanel(activeOt, activeTask);

  if (sketchState.myOtsMode === 'cards') {
    if (!activeOt) {
      cardsEl.innerHTML = `<div class="p-8 text-center text-[11px] text-[#8C8C8C] border border-obsidian-border rounded-xl bg-[#202020]">No tienes OTs asignadas.</div>`;
      return;
    }

    ensureOtData(activeOt, formatShortDate);
    if (taskTreeList) {
      renderOtTaskTree(activeOt, taskTreeList, sketchState.activeTaskIndex, (nextIdx) => {
        sketchState.activeTaskIndex = nextIdx;
        sketchState.activePieceIndex = 0;
        sketchState.selectedPieces.clear();
        renderMyOts();
      });
    }

    cardsEl.innerHTML = renderOtDetailHtml(activeOt, formatShortDate, sketchState.activeTaskIndex);
    if (window.hydrateIcons) window.hydrateIcons(cardsEl);

    bindGalleryEvents(
      cardsEl,
      renderMyOts,
      () => (activeTask ? activeTask.mediaFiles : activeOt.mediaFiles) || [],
      () => {
        const targetObj = activeTask || activeOt;
        if (targetObj && Array.isArray(targetObj.mediaFiles)) {
          targetObj.mediaFiles = targetObj.mediaFiles.filter((p) => !sketchState.selectedPieces.has(p.name));
        }
      }
    );
  } else if (sketchState.myOtsMode === 'list' && listBodyEl) {
    if (!mine.length) {
      listBodyEl.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-[11px] text-[#8C8C8C]">${isMyTasksScope ? 'No tienes tareas asignadas.' : 'No tienes OTs asignadas.'}</td></tr>`;
      return;
    }
    listBodyEl.innerHTML = mine.map((ot, idx) => {
      const zebra = idx % 2 === 1 ? 'bg-[#262626]' : 'bg-[#1d1d1d]';
      const cColor = getClientColor(ot.client);
      const realOtId = ot.otId || ot.id;
      const taskIdxAttr = ot.taskIndex !== undefined ? ot.taskIndex : '';
      return `
        <tr data-myots-open="${escapeHtml(realOtId)}" data-myots-task="${taskIdxAttr}" class="${zebra} hover:bg-obsidian-elevated/70 transition-colors text-[10.5px] cursor-pointer">
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
            <span class="font-mono font-semibold text-obsidian-amber px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border whitespace-nowrap block text-center">${escapeHtml(ot.id)}</span>
          </td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-medium truncate">
            <span class="inline-flex items-center gap-1.5 max-w-full">
              <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
              <span class="truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
            </span>
          </td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle truncate text-[#8C8C8C]">${escapeHtml(ot.brand)}${ot.product && ot.product !== ot.brand ? ' • ' + escapeHtml(ot.product) : ''}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#8C8C8C] truncate">${escapeHtml(ot.media)}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle"><span class="font-mono text-[#D4D4D4] px-1 py-0.5 bg-[#191919] rounded border border-obsidian-border truncate block">${escapeHtml(ot.ref)}</span></td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle text-[#D4D4D4]"><div class="line-clamp-2 leading-tight">${escapeHtml(ot.title)}</div></td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-mono text-[10px] text-[#8C8C8C] text-center">${escapeHtml(formatShortDate(ot.entryDate))}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle font-mono text-[10px] text-[#8C8C8C] text-center">${escapeHtml(formatShortDate(ot.deliveryDate))}</td>
          <td class="px-1.5 py-1.5 border-r border-obsidian-border align-middle">
            <select data-ot-id="${escapeHtml(realOtId)}" data-task-index="${taskIdxAttr}" class="myots-status-sel w-full bg-[#191919] border border-obsidian-border rounded px-1 py-0.5 text-[10px] text-[#D4D4D4] focus:outline-none cursor-pointer">
              ${trafficStatuses.map((s) => `<option value="${escapeHtml(s)}" ${ot.status === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
            </select>
          </td>
          <td class="px-1.5 py-1.5 align-middle text-[10px] text-[#8C8C8C] truncate">${escapeHtml(ot.notes)}</td>
        </tr>
      `;
    }).join('');

    listBodyEl.querySelectorAll('tr[data-myots-open]').forEach((row) => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('select, input, button, a')) return;
        sketchState.activeMyOtId = row.dataset.myotsOpen;
        const tIdx = row.dataset.myotsTask;
        sketchState.activeTaskIndex = tIdx !== undefined && tIdx !== '' ? Number(tIdx) : null;
        sketchState.myOtsMode = 'cards';
        renderMyOts();
      });
    });
  } else if (sketchState.myOtsMode === 'kanban') {
    const kanbanStatuses = ['Tráfico', 'Recibido', 'Desarrollo', 'Cliente', 'Entregado'];
    kanbanEl.innerHTML = kanbanStatuses.map((st) => {
      const colOts = mine.filter((o) => o.status === st);
      return `
        <div data-kanban-status="${escapeHtml(st)}" class="myots-kanban-col w-60 shrink-0 bg-[#202020] border border-obsidian-border rounded-xl p-2 flex flex-col gap-2">
          <div class="flex items-center justify-between px-1 py-0.5">
            <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C]">${escapeHtml(st)}</span>
            <span class="text-[10px] font-mono text-[#8C8C8C]">${colOts.length}</span>
          </div>
          <div class="flex flex-col gap-2 min-h-[120px]">
            ${colOts.map((ot) => {
              const cColor = getClientColor(ot.client);
              const realOtId = ot.otId || ot.id;
              const taskIdxAttr = ot.taskIndex !== undefined ? ot.taskIndex : '';
              return `
                <div draggable="true" data-kanban-ot="${escapeHtml(realOtId)}" data-kanban-task="${taskIdxAttr}" class="myots-kanban-card bg-[#191919] hover:bg-[#262626] border border-obsidian-border rounded-lg p-2.5 space-y-1.5 cursor-grab active:cursor-grabbing transition-colors">
                  <div class="flex items-center justify-between gap-1">
                    <span class="font-mono text-[10px] font-semibold text-obsidian-amber">${escapeHtml(ot.id)}</span>
                    <span class="font-mono text-[9.5px] text-[#8C8C8C]">${escapeHtml(formatShortDate(ot.deliveryDate))}</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-[10px] truncate">
                    <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background:${escapeHtml(cColor)}"></span>
                    <span class="truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(ot.client)}</span>
                  </div>
                  <div class="text-[11px] text-[#D4D4D4] leading-snug line-clamp-2">${escapeHtml(ot.title)}</div>
                  <div class="text-[10px] text-[#8C8C8C] truncate">${escapeHtml(ot.ref)} · ${escapeHtml(ot.media)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }).join('');

    let draggedOtId = null;
    let draggedTaskIdx = '';
    kanbanEl.querySelectorAll('.myots-kanban-card').forEach((card) => {
      card.addEventListener('dragstart', () => {
        draggedOtId = card.dataset.kanbanOt;
        draggedTaskIdx = card.dataset.kanbanTask || '';
        card.classList.add('opacity-50');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('opacity-50');
      });
    });

    kanbanEl.querySelectorAll('.myots-kanban-col').forEach((col) => {
      col.addEventListener('dragover', (e) => {
        e.preventDefault();
        col.classList.add('border-[#3a3a3a]');
      });
      col.addEventListener('dragleave', () => col.classList.remove('border-[#3a3a3a]'));
      col.addEventListener('drop', (e) => {
        e.preventDefault();
        col.classList.remove('border-[#3a3a3a]');
        const target = trafficOrders.find((o) => o.id === draggedOtId);
        if (target && col.dataset.kanbanStatus) {
          if (draggedTaskIdx !== '' && target.subtasks?.[Number(draggedTaskIdx)]) {
            target.subtasks[Number(draggedTaskIdx)].status = col.dataset.kanbanStatus;
          } else {
            target.status = col.dataset.kanbanStatus;
          }
          renderMyOts();
          notifySketchChange('orders');
        }
      });
    });
  }

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
      notifySketchChange('orders');
    });
  });

  document.querySelectorAll('#view-my-ots .myots-kanban-card').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.kanbanOt;
      const tIdx = el.dataset.kanbanTask;
      if (!id) return;
      sketchState.activeMyOtId = id;
      sketchState.activeTaskIndex = tIdx !== undefined && tIdx !== '' ? Number(tIdx) : null;
      sketchState.myOtsMode = 'cards';
      renderMyOts();
    });
  });
}

/**
 * Initialize Detalle de OT module, mode buttons, bitácora commit listeners, and store subscriptions.
 */
export function initOtDetail({ onJumpStripboard } = {}) {
  jumpStripboardCb = onJumpStripboard || null;
  if (initialized) return;
  initialized = true;

  ensureMyOtsHeaderControls();

  document.querySelectorAll('.myots-mode-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.myOtsMode = btn.dataset.myotsMode;
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
