import {
  clientsData,
  defaultTrafficStages,
  defaultTrafficStatuses,
  departmentColors,
  stageColors,
  studioProfiles,
  studioRoles,
  studioScopes,
  studioSettings,
  studioTagPalette,
  studioTeamList,
  trafficDepartments,
  trafficOrders,
  trafficStages,
  trafficStatuses,
  standaloneDocuments,
  standaloneDevFiles,
  statusColors,
  sketchState,
  escapeHtml,
  getActiveWorkspaces,
  getDepartmentColor,
  getStageColor,
  getStatusColor,
  orderStudioDepartments,
  setActiveWorkspace,
  syncMemberToUserAccount,
  syncStudioTaxonomyFromProfiles,
  syncTrafficMembers,
  notifySketchChange,
  onSketchChange,
} from './store.js';
import { openClientModal } from './client-modal.js';
import { clearInspectorPanel } from './inspector.js';
import { renderSpectrumColorPickerHtml, bindSpectrumColorPicker } from './color-picker.js';

let activeColorTarget = null; // { kind: 'dept' | 'stage' | 'status', name: string }
let selectedSpaceId = studioProfiles[0]?.id || null;

function syncStudioFooterBadge() {
  const fn = document.getElementById('studio-footer-name');
  const fi = document.getElementById('studio-footer-initials');
  if (fn) fn.textContent = studioSettings.name;
  if (fi) {
    if (studioSettings.logoDataUrl) {
      fi.innerHTML = `<img src="${escapeHtml(studioSettings.logoDataUrl)}" alt="" class="w-full h-full object-cover rounded-md" />`;
    } else {
      fi.textContent = studioSettings.initials || 'EM';
    }
  }
}

const settingsTabLabels = {
  studio: 'Perfil del Estudio',
  workflow: 'Perfiles y Flujo de Trabajo',
  team: 'Equipo y Permisos',
  clients: 'Clientes',
  billing: 'Membresía y Facturación',
  data: 'Integraciones y Datos',
  prefs: 'Preferencias',
  help: 'Ayuda y Legal',
};

const settingsTabSubtitles = {
  studio: 'Identidad, logo, jornada laboral y parámetros generales',
  workflow: 'Perfil operativo activo, áreas/departamentos, etapas del ciclo y estados de la OT',
  team: 'Roles, alcances de visibilidad y múltiples departamentos por colaborador',
  clients: 'Directorio de clientes, marcas, productos y contactos revisores',
  billing: 'Plan activo, puestos y facturación',
  data: 'Webhooks, API Keys y exportación de datos',
  prefs: 'Apariencia e idioma',
  help: 'Documentación y términos',
};

let previousCenterViewId = null;

/**
 * Open the unified Settings view at full center width with navigation in Slide 2 (#left-settings-menu).
 */
export function openSettingsModal(tab = 'studio') {
  const settingsModal = document.getElementById('settings-modal');
  const centerViewIds = ['view-desktop', 'view-new-ot', 'view-traffic', 'view-my-ots', 'view-envelope-open', 'view-gallery', 'view-stripboard', 'view-review'];
  const visibleView = centerViewIds.find((id) => {
    const el = document.getElementById(id);
    return el && !el.classList.contains('hidden');
  });
  if (visibleView) previousCenterViewId = visibleView;

  centerViewIds.forEach((id) => document.getElementById(id)?.classList.add('hidden'));
  ['left-traffic-tree', 'left-envelope-tree', 'left-stripboard-pool'].forEach((id) =>
    document.getElementById(id)?.classList.add('hidden')
  );
  document.getElementById('left-settings-menu')?.classList.remove('hidden');
  document.getElementById('left-menu-track')?.classList.add('-translate-x-1/2');

  const centerTitle = document.getElementById('center-page-title');
  if (centerTitle) centerTitle.textContent = 'Estudio';

  sketchState.activeSettingsTab = tab;
  if (settingsModal) settingsModal.classList.remove('hidden');
  clearInspectorPanel('Configuración del Estudio. Los cambios se reflejan en vivo en toda la app.');
  renderSettingsTab();
}

/**
 * Close the unified Settings view and restore the previous center view.
 */
export function closeSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) settingsModal.classList.add('hidden');
  document.getElementById('left-settings-menu')?.classList.add('hidden');
  const restoreId = previousCenterViewId || 'view-desktop';
  document.getElementById(restoreId)?.classList.remove('hidden');
  if (restoreId === 'view-traffic' || restoreId === 'view-gallery' || restoreId === 'view-stripboard') {
    document.getElementById('left-traffic-tree')?.classList.remove('hidden');
  } else if (restoreId === 'view-desktop') {
    document.getElementById('left-menu-track')?.classList.remove('-translate-x-1/2');
  }
}

/**
 * Render the active tab inside #settings-modal.
 */
export function renderSettingsTab() {
  const settingsModal = document.getElementById('settings-modal');
  const settingsTabTitle = document.getElementById('settings-tab-title');
  const settingsTabBody = document.getElementById('settings-tab-body');
  if (!settingsTabBody) return;

  const activeTab = sketchState.activeSettingsTab || 'studio';
  if (settingsTabTitle) settingsTabTitle.textContent = settingsTabLabels[activeTab] || 'Estudio';
  const subEl = document.getElementById('settings-tab-subtitle');
  if (subEl) subEl.textContent = settingsTabSubtitles[activeTab] || '';

  document.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    const active = btn.dataset.settingsTab === activeTab;
    btn.classList.toggle('bg-obsidian-elevated', active);
    btn.classList.toggle('text-[#D4D4D4]', active);
    btn.classList.toggle('font-medium', active);
    btn.classList.toggle('text-[#8C8C8C]', !active);
    btn.classList.toggle('hover:bg-obsidian-elevated/60', !active);
    btn.classList.toggle('hover:text-[#D4D4D4]', !active);
  });

  const usedSeats = studioTeamList.filter((m) => !m.isOwner).length;

  if (activeTab === 'studio') {
    const activeProfilesCount = studioProfiles.filter((p) => p.active).length;
    settingsTabBody.innerHTML = `
      <div class="max-w-3xl mx-auto space-y-4">
        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-3.5">
          <div class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-semibold">Identidad y Jornada</div>
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-xl bg-amber-500/20 border border-obsidian-border text-obsidian-amber font-mono font-bold text-[15px] flex items-center justify-center shrink-0 overflow-hidden">
              ${studioSettings.logoDataUrl
                ? `<img src="${escapeHtml(studioSettings.logoDataUrl)}" alt="Logo" class="w-full h-full object-cover" />`
                : escapeHtml(studioSettings.initials || 'EM')}
            </div>
            <div class="flex flex-wrap items-center gap-2 text-[10.5px]">
              <label class="h-7 px-2.5 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] inline-flex items-center cursor-pointer transition-colors">
                <span>Subir logo</span>
                <input id="st-logo-file" type="file" accept="image/*" class="hidden" />
              </label>
              ${studioSettings.logoDataUrl ? `<button type="button" id="st-logo-remove" class="h-7 px-2 rounded-lg text-[#8C8C8C] hover:text-rose-400 cursor-pointer">Quitar</button>` : ''}
              <span class="text-[#737373]">PNG / JPG / SVG cuadrado</span>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="sm:col-span-2 block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Nombre del Estudio</span>
              <input id="st-studio-name" type="text" value="${escapeHtml(studioSettings.name)}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] focus:outline-none focus:border-[#3f3f3f]" />
            </label>
            <label class="block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Siglas</span>
              <input id="st-studio-initials" type="text" maxlength="3" value="${escapeHtml(studioSettings.initials)}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] font-mono uppercase focus:outline-none focus:border-[#3f3f3f]" />
            </label>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label class="block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Prefijo de OT</span>
              <input id="st-studio-prefix" type="text" maxlength="10" value="${escapeHtml(studioSettings.otPrefix || 'OT-26-')}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-obsidian-amber font-mono focus:outline-none focus:border-[#3f3f3f]" />
            </label>
            <label class="block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Jornada diaria (horas)</span>
              <input id="st-studio-hours" type="number" min="4" max="14" value="${studioSettings.dailyHours}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] font-mono focus:outline-none focus:border-[#3f3f3f]" />
            </label>
            <label class="block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Zona horaria</span>
              <select id="st-studio-tz" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] text-[10.5px] focus:outline-none cursor-pointer">
                ${['America/Bogota', 'America/Mexico_City', 'America/Lima', 'America/Santiago', 'America/Buenos_Aires', 'Europe/Madrid'].map((tz) => `<option value="${tz}" ${studioSettings.timezone === tz ? 'selected' : ''}>${tz}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="flex justify-end pt-1">
            <button type="button" id="st-save-studio" class="h-8 px-4 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] font-semibold cursor-pointer transition-colors">Guardar Estudio</button>
          </div>
        </div>

        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 flex items-center justify-between gap-3">
          <div class="space-y-0.5">
            <div class="text-[11.5px] font-medium text-[#D4D4D4]">Perfiles, Departamentos y Etapas</div>
            <div class="text-[10.5px] text-[#8C8C8C]">
              ${activeProfilesCount} ${activeProfilesCount === 1 ? 'perfil activo' : 'perfiles activos'} · ${trafficDepartments.length} departamentos · ${trafficStages.length} etapas · ${trafficStatuses.length} estados
            </div>
          </div>
          <button type="button" id="st-jump-workflow" class="h-7 px-3 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] cursor-pointer shrink-0">
            Configurar flujo →
          </button>
        </div>
      </div>
    `;

    settingsTabBody.querySelector('#st-logo-file')?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        studioSettings.logoDataUrl = String(reader.result || '');
        syncStudioFooterBadge();
        notifySketchChange('settings');
        renderSettingsTab();
      };
      reader.readAsDataURL(file);
    });
    settingsTabBody.querySelector('#st-logo-remove')?.addEventListener('click', () => {
      studioSettings.logoDataUrl = '';
      syncStudioFooterBadge();
      notifySketchChange('settings');
      renderSettingsTab();
    });
    settingsTabBody.querySelector('#st-save-studio')?.addEventListener('click', () => {
      const n = settingsTabBody.querySelector('#st-studio-name')?.value.trim();
      const ini = settingsTabBody.querySelector('#st-studio-initials')?.value.trim().toUpperCase();
      const prefix = settingsTabBody.querySelector('#st-studio-prefix')?.value.trim();
      const tz = settingsTabBody.querySelector('#st-studio-tz')?.value;
      const hrs = Number(settingsTabBody.querySelector('#st-studio-hours')?.value) || 8;
      if (n) studioSettings.name = n;
      if (ini) studioSettings.initials = ini;
      if (prefix) studioSettings.otPrefix = prefix;
      if (tz) studioSettings.timezone = tz;
      studioSettings.dailyHours = hrs;
      syncStudioFooterBadge();
      notifySketchChange('settings');
      renderSettingsTab();
    });
    settingsTabBody.querySelector('#st-jump-workflow')?.addEventListener('click', () => {
      sketchState.activeSettingsTab = 'workflow';
      renderSettingsTab();
    });
  } else if (activeTab === 'workflow') {
    if (!studioProfiles.some((p) => p.id === selectedSpaceId)) {
      selectedSpaceId = studioProfiles[0]?.id || null;
    }
    const selectedSpace = studioProfiles.find((p) => p.id === selectedSpaceId) || studioProfiles[0];
    const activeCount = getActiveWorkspaces().length;
    const displayedDepts = orderStudioDepartments(selectedSpace?.departments || []);

    const renderInlineColorEditor = (kind) => {
      if (!activeColorTarget || activeColorTarget.kind !== kind) return '';
      const map = kind === 'dept' ? departmentColors : (kind === 'stage' ? stageColors : statusColors);
      const curHex = map[activeColorTarget.name] || '#38bdf8';
      const usedByMap = new Map();
      Object.entries(map).forEach(([k, v]) => {
        if (k !== activeColorTarget.name && v) usedByMap.set(String(v).toLowerCase(), k);
      });
      return `
        <div class="p-2 rounded-lg bg-[#191919] border border-obsidian-borderActive space-y-1.5">
          <div class="flex items-center justify-between text-[10px]">
            <span class="text-[#8C8C8C] truncate">Color: <strong class="text-[#D4D4D4]">${escapeHtml(activeColorTarget.name)}</strong></span>
            <button type="button" data-st-close-picker="1" class="text-[#737373] hover:text-[#D4D4D4] cursor-pointer shrink-0">Listo</button>
          </div>
          ${renderSpectrumColorPickerHtml({ selectedHex: curHex, usedByMap, pickerId: `st-picker-${kind}` })}
        </div>
      `;
    };

    const statusSubtitles = {
      'Activa': 'Abierta',
      'En proceso': 'En marcha',
      'Suspendida': 'Pausada',
      'Cancelada': 'Archivo',
      'Archivada': 'Histórico',
    };

    const customStages = trafficStages.filter((s) => !defaultTrafficStages.includes(s));
    const baseStartStages = ['Tráfico', 'Recibida'];
    const baseEndStages = ['Cerrar OT y Facturar', 'Facturada', 'Pagada'];

    const renderBaseStageRow = (stg) => {
      const col = getStageColor(stg);
      const isEditing = activeColorTarget?.kind === 'stage' && activeColorTarget?.name === stg;
      return `
        <div class="px-2.5 py-1.5 rounded-lg bg-[#161616] border ${isEditing ? 'border-obsidian-amber' : 'border-obsidian-border/70'} flex items-center justify-between gap-1.5">
          <div class="flex items-center gap-2 min-w-0">
            <span data-icon="lock" data-icon-size="w-2.5 h-2.5" data-icon-class="text-[#5a6169] shrink-0" title="Etapa base del sistema"></span>
            <button type="button" data-st-pick-color="stage:${escapeHtml(stg)}" title="Color 7×5"
              class="w-3 h-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform border border-white/15" style="background:${escapeHtml(col)}"></button>
            <span class="text-[10.5px] text-[#D4D4D4] truncate">${escapeHtml(stg)}</span>
          </div>
          <span class="text-[8.5px] font-mono text-[#5a6169] uppercase shrink-0">Base</span>
        </div>
      `;
    };

    const openOrdersCount = (wsId) => trafficOrders.filter((o) => !o.archived && o.workspaceId === wsId).length;

    const renderSpaceCard = (p) => {
      const isSel = p.id === selectedSpace?.id;
      const isLastOn = p.active && activeCount <= 1;
      return `
        <div data-wf-select-space="${escapeHtml(p.id)}"
          class="p-2 rounded-lg border cursor-pointer transition-colors ${isSel ? 'bg-obsidian-elevated/90 border-obsidian-amber/60' : 'bg-[#191919] border-obsidian-border hover:border-[#3a3a3a]'}">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="w-2.5 h-2.5 rounded-full shrink-0 ${p.active ? '' : 'opacity-35'}" style="background:${escapeHtml(p.color || '#8C8C8C')}"></span>
              <span class="font-medium text-[11px] truncate ${p.active ? (isSel ? 'text-obsidian-amber' : 'text-[#D4D4D4]') : 'text-[#737373]'}">${escapeHtml(p.name)}</span>
            </div>
            <button type="button" data-wf-toggle-space="${escapeHtml(p.id)}"
              title="${isLastOn ? 'Debe quedar al menos 1 espacio activo' : (p.active ? 'Apagar espacio' : 'Encender espacio')}"
              ${isLastOn ? 'disabled' : ''}
              class="px-1.5 py-0.5 rounded text-[8.5px] font-mono transition-colors ${isLastOn ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${p.active ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-[#252525] text-[#737373] border border-obsidian-border hover:text-[#D4D4D4]'}">
              ${p.active ? 'ON' : 'OFF'}
            </button>
          </div>
          <div class="mt-0.5 text-[9.5px] font-mono text-[#737373]">
            ${(p.departments || []).length} áreas · ${openOrdersCount(p.id)} OTs abiertas
          </div>
        </div>
      `;
    };

    settingsTabBody.innerHTML = `
      <div class="space-y-4">
        <!-- 3 Columnas: Espacios | Áreas del Espacio | Etapas -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-3 items-stretch">
          <!-- Columna 1: Espacios (los 5 base, ON / OFF) -->
          <div class="bg-[#202020] border border-obsidian-border rounded-xl flex flex-col min-h-[420px] max-h-[520px] overflow-hidden">
            <div class="px-3 py-2 border-b border-obsidian-border flex items-center justify-between shrink-0 bg-[#191919]">
              <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-semibold">1. Espacios</span>
              <span class="font-mono text-[9.5px] text-[#737373]">${activeCount} ON</span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              <div class="px-1 pb-1 text-[9.5px] text-[#737373] leading-snug">Enciende los espacios que opera tu estudio. Con 2 o más aparece la barra de espacios abajo.</div>
              ${studioProfiles.map(renderSpaceCard).join('')}
            </div>
          </div>

          <!-- Columna 2: Áreas / Departamentos del Espacio seleccionado (solo lectura + color) -->
          <div class="bg-[#202020] border border-obsidian-border rounded-xl flex flex-col min-h-[420px] max-h-[520px] overflow-hidden">
            <div class="px-3 py-2 border-b border-obsidian-border flex items-center justify-between gap-2 shrink-0 bg-[#191919]">
              <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-semibold truncate">2. Áreas (${displayedDepts.length})</span>
              <span class="font-mono text-[9.5px] text-obsidian-amber truncate max-w-[140px]">${escapeHtml(selectedSpace?.shortName || selectedSpace?.name || '')}</span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              ${displayedDepts.map((dept) => {
                const col = getDepartmentColor(dept);
                const isEditing = activeColorTarget?.kind === 'dept' && activeColorTarget?.name === dept;
                return `
                  <div class="px-2.5 py-1.5 rounded-lg bg-[#191919] border ${isEditing ? 'border-obsidian-amber' : 'border-obsidian-border'} flex items-center gap-2">
                    <button type="button" data-st-pick-color="dept:${escapeHtml(dept)}" title="Color 7×5"
                      class="w-3 h-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform border border-white/15" style="background:${escapeHtml(col)}"></button>
                    <span class="text-[10.5px] text-[#D4D4D4] truncate">${escapeHtml(dept)}</span>
                  </div>
                `;
              }).join('')}
              ${renderInlineColorEditor('dept')}
            </div>
            <div class="px-3 py-2 border-t border-obsidian-border bg-[#191919] text-[9.5px] text-[#6d6d6d]">Áreas de fábrica del espacio · solo puedes cambiar su color.</div>
          </div>

          <!-- Columna 3: Etapas (ciclo transversal del Estudio) -->
          <div class="bg-[#202020] border border-obsidian-border rounded-xl flex flex-col min-h-[420px] max-h-[520px] overflow-hidden">
            <div class="px-3 py-2 border-b border-obsidian-border flex items-center justify-between shrink-0 bg-[#191919]">
              <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-semibold truncate">3. Etapas (${trafficStages.length})</span>
              <span class="font-mono text-[9.5px] text-[#737373]">Ciclo de la OT</span>
            </div>
            <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
              ${baseStartStages.map(renderBaseStageRow).join('')}
              ${customStages.map((stg, sIdx, arr) => {
                const col = getStageColor(stg);
                const isEditing = activeColorTarget?.kind === 'stage' && activeColorTarget?.name === stg;
                return `
                  <div class="px-2.5 py-1.5 rounded-lg bg-[#191919] border ${isEditing ? 'border-obsidian-amber' : 'border-obsidian-border'} flex items-center justify-between gap-1.5">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="font-mono text-[9px] text-[#6d6d6d] w-3 text-right shrink-0">${sIdx + 1}</span>
                      <button type="button" data-st-pick-color="stage:${escapeHtml(stg)}" title="Color 7×5"
                        class="w-3 h-3 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform border border-white/15" style="background:${escapeHtml(col)}"></button>
                      <span class="text-[10.5px] text-[#D4D4D4] truncate">${escapeHtml(stg)}</span>
                    </div>
                    <div class="flex items-center gap-0.5 shrink-0">
                      <button type="button" data-wf-move-stage="${escapeHtml(stg)}:-1" ${sIdx === 0 ? 'disabled' : ''} title="Subir" class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#737373] hover:text-[#D4D4D4] disabled:opacity-25 text-[9px] cursor-pointer">↑</button>
                      <button type="button" data-wf-move-stage="${escapeHtml(stg)}:1" ${sIdx === arr.length - 1 ? 'disabled' : ''} title="Bajar" class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#737373] hover:text-[#D4D4D4] disabled:opacity-25 text-[9px] cursor-pointer">↓</button>
                      <button type="button" data-wf-del-stage="${escapeHtml(stg)}" title="Quitar etapa" class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#737373] hover:text-rose-400 text-[11px] leading-none cursor-pointer">×</button>
                    </div>
                  </div>
                `;
              }).join('')}
              ${baseEndStages.map(renderBaseStageRow).join('')}
              ${renderInlineColorEditor('stage')}
            </div>
            <form id="wf-add-stage-form" class="p-2 border-t border-obsidian-border bg-[#191919] flex gap-1.5 shrink-0">
              <input id="wf-new-stage" type="text" placeholder="Etapa intermedia opcional..." class="flex-1 h-7 bg-[#202020] border border-obsidian-border rounded-md px-2 text-[10.5px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60" />
              <button type="submit" class="h-7 px-2.5 rounded-md bg-obsidian-elevated hover:bg-[#333333] border border-obsidian-borderActive text-[10px] text-[#D4D4D4] cursor-pointer shrink-0">+ Etapa</button>
            </form>
          </div>
        </div>

        <!-- Tira horizontal: Estados Transversales -->
        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-3.5 space-y-2.5">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C] font-semibold">Estados de la OT</span>
              <span class="text-[9.5px] text-[#6d6d6d]">Transversales · Cancelada y Archivada van a OTs Archivadas</span>
            </div>
            <span class="inline-flex items-center gap-1 text-[9.5px] text-[#737373]">
              <span data-icon="lock" data-icon-size="w-2.5 h-2.5"></span>
              <span>5 base protegidos</span>
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            ${trafficStatuses.map((st, idx) => {
              const col = getStatusColor(st);
              const isDefault = defaultTrafficStatuses.includes(st);
              const isEditing = activeColorTarget?.kind === 'status' && activeColorTarget?.name === st;
              return `
                <div class="px-2.5 py-1.5 rounded-lg bg-[#191919] border ${isEditing ? 'border-obsidian-amber' : 'border-obsidian-border'} flex items-center gap-2">
                  <button type="button" data-st-pick-color="status:${escapeHtml(st)}" title="Color 7×5"
                    class="w-2.5 h-2.5 rounded-full shrink-0 cursor-pointer hover:scale-125 transition-transform" style="background:${escapeHtml(col)}"></button>
                  <div class="leading-tight">
                    <div class="text-[10.5px] font-medium" style="color:${escapeHtml(col)}">${escapeHtml(st)}</div>
                    ${statusSubtitles[st] ? `<div class="text-[8.5px] text-[#737373]">${statusSubtitles[st]}</div>` : ''}
                  </div>
                  ${isDefault
                    ? `<span data-icon="lock" data-icon-size="w-2.5 h-2.5" data-icon-class="text-[#5a6169]"></span>`
                    : `<button type="button" data-st-del-status="${idx}" title="Quitar" class="text-[#737373] hover:text-rose-400 text-[11px] leading-none cursor-pointer">×</button>`
                  }
                </div>
              `;
            }).join('')}
            <form id="st-add-status-form" class="inline-flex items-center gap-1.5 ml-auto">
              <input id="st-new-status" type="text" placeholder="+ Nuevo estado..." class="w-36 h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[10px] text-[#D4D4D4] placeholder-[#5a6169] focus:outline-none focus:border-obsidian-amber/60" />
              <button type="submit" class="h-7 px-2.5 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[10px] text-[#D4D4D4] cursor-pointer">Agregar</button>
            </form>
          </div>
          ${renderInlineColorEditor('status')}
        </div>
      </div>
    `;

    // Bind Col 1: select space + ON/OFF
    settingsTabBody.querySelectorAll('[data-wf-select-space]').forEach((card) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const nextId = card.dataset.wfSelectSpace;
        if (nextId !== selectedSpaceId) {
          selectedSpaceId = nextId;
          activeColorTarget = null;
          renderSettingsTab();
        }
      });
    });

    settingsTabBody.querySelectorAll('[data-wf-toggle-space]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const space = studioProfiles.find((p) => p.id === btn.dataset.wfToggleSpace);
        if (!space) return;
        if (space.active && getActiveWorkspaces().length <= 1) return;
        space.active = !space.active;
        syncStudioTaxonomyFromProfiles();
        const cur = sketchState.activeWorkspaceId;
        setActiveWorkspace(getActiveWorkspaces().some((p) => p.id === cur) ? cur : 'studio');
        notifySketchChange('orders');
        renderSettingsTab();
      });
    });

    // Bind Col 3: Transversal Stages
    settingsTabBody.querySelectorAll('[data-wf-move-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [stgName, dirStr] = String(btn.dataset.wfMoveStage || '').split(':');
        const curCustom = trafficStages.filter((s) => !defaultTrafficStages.includes(s));
        const idx = curCustom.indexOf(stgName);
        const nextIdx = idx + Number(dirStr);
        if (idx === -1 || nextIdx < 0 || nextIdx >= curCustom.length) return;
        const [item] = curCustom.splice(idx, 1);
        curCustom.splice(nextIdx, 0, item);
        trafficStages.splice(0, trafficStages.length, ...baseStartStages, ...curCustom, ...baseEndStages);
        notifySketchChange('orders');
        renderSettingsTab();
      });
    });

    settingsTabBody.querySelectorAll('[data-wf-del-stage]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const stgName = btn.dataset.wfDelStage;
        const idx = trafficStages.indexOf(stgName);
        if (idx !== -1 && !defaultTrafficStages.includes(stgName)) {
          trafficStages.splice(idx, 1);
          notifySketchChange('orders');
          renderSettingsTab();
        }
      });
    });

    settingsTabBody.querySelector('#wf-add-stage-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = settingsTabBody.querySelector('#wf-new-stage')?.value.trim();
      if (!val || trafficStages.includes(val)) return;
      const curCustom = trafficStages.filter((s) => !defaultTrafficStages.includes(s));
      curCustom.push(val);
      if (!stageColors[val]) {
        stageColors[val] = studioTagPalette[curCustom.length % studioTagPalette.length];
      }
      trafficStages.splice(0, trafficStages.length, ...baseStartStages, ...curCustom, ...baseEndStages);
      notifySketchChange('orders');
      renderSettingsTab();
    });

    // Bind 7x5 Color Picker + Transversal Statuses
    settingsTabBody.querySelectorAll('[data-st-pick-color]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [kind, ...rest] = String(btn.dataset.stPickColor || '').split(':');
        const name = rest.join(':');
        if (activeColorTarget?.kind === kind && activeColorTarget?.name === name) {
          activeColorTarget = null;
        } else {
          activeColorTarget = { kind, name };
        }
        renderSettingsTab();
      });
    });

    settingsTabBody.querySelector('[data-st-close-picker]')?.addEventListener('click', () => {
      activeColorTarget = null;
      renderSettingsTab();
    });

    if (activeColorTarget) {
      const { kind, name } = activeColorTarget;
      const map = kind === 'dept' ? departmentColors : (kind === 'stage' ? stageColors : statusColors);
      bindSpectrumColorPicker(
        settingsTabBody,
        (nextHex) => {
          map[name] = nextHex;
          notifySketchChange('orders');
          renderSettingsTab();
        },
        { pickerId: `st-picker-${kind}` }
      );
    }

    settingsTabBody.querySelectorAll('[data-st-del-status]').forEach((btn) => {
      btn.addEventListener('click', () => {
        trafficStatuses.splice(Number(btn.dataset.stDelStatus), 1);
        notifySketchChange('orders');
        renderSettingsTab();
      });
    });

    settingsTabBody.querySelector('#st-add-status-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = settingsTabBody.querySelector('#st-new-status')?.value.trim();
      if (!val || trafficStatuses.includes(val)) return;
      trafficStatuses.push(val);
      statusColors[val] = studioTagPalette[(trafficStatuses.length - 1) % studioTagPalette.length];
      notifySketchChange('orders');
      renderSettingsTab();
    });
  } else if (activeTab === 'team') {
    settingsTabBody.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between bg-[#202020] border border-obsidian-border rounded-xl px-4 py-2.5">
          <div class="text-[11px] text-[#8C8C8C]">
            Puestos internos usados: <strong class="text-[#D4D4D4] font-mono">${usedSeats} / ${studioSettings.maxSeats}</strong> <span class="text-[10px]">(el Dueño no cuenta)</span>
          </div>
          <span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-[10px]">${studioSettings.maxSeats - usedSeats} disponibles</span>
        </div>

        <div class="space-y-2">
          ${studioTeamList.map((m, idx) => {
            const depts = Array.isArray(m.departments) && m.departments.length ? m.departments : ['Todos'];
            const isAllDepts = depts.includes('Todos');
            return `
            <div class="bg-[#202020] border border-obsidian-border rounded-xl p-3 space-y-2.5 text-[10.5px]">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-[#D4D4D4] font-medium">${escapeHtml(m.name)}</span>
                    ${m.isOwner ? '<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-obsidian-amber text-[9px] font-mono">Dueño</span>' : ''}
                    <span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9px]">${escapeHtml(m.status)}</span>
                  </div>
                  <div class="text-[9.5px] text-[#8C8C8C]">${escapeHtml(m.email)}</div>
                </div>
                <div class="flex items-center gap-2">
                  <label class="inline-flex items-center gap-1 text-[9.5px] text-[#8C8C8C]">
                    <span>Rol:</span>
                    <select data-st-member-role="${idx}" ${m.isOwner ? 'disabled' : ''}
                      class="h-6 bg-[#191919] border border-obsidian-border rounded px-1.5 text-[10px] text-[#D4D4D4] focus:outline-none ${m.isOwner ? 'opacity-60 cursor-default' : 'cursor-pointer'}">
                      ${studioRoles.map((r) => `<option value="${escapeHtml(r)}" ${m.role === r ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
                    </select>
                  </label>
                  <label class="inline-flex items-center gap-1 text-[9.5px] text-[#8C8C8C]">
                    <span>Alcance:</span>
                    <select data-st-member-scope="${idx}" ${m.isOwner ? 'disabled' : ''}
                      class="h-6 bg-[#191919] border border-obsidian-border rounded px-1.5 text-[10px] text-obsidian-cyan focus:outline-none ${m.isOwner ? 'opacity-60 cursor-default' : 'cursor-pointer'}">
                      ${studioScopes.map((sc) => `<option value="${escapeHtml(sc)}" ${m.scope === sc ? 'selected' : ''}>${escapeHtml(sc)}</option>`).join('')}
                    </select>
                  </label>
                  ${m.isOwner ? '' : `<button type="button" data-st-remove-member="${idx}" class="text-[10px] text-[#8C8C8C] hover:text-rose-400 cursor-pointer ml-1">Quitar</button>`}
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-1 pt-1 border-t border-obsidian-border/60">
                <span class="text-[9px] uppercase tracking-wider text-[#737373] mr-1">Deptos:</span>
                <button type="button" data-st-member-dept="${idx}:Todos"
                  class="px-2 py-0.5 rounded-md border text-[9.5px] cursor-pointer transition-colors ${isAllDepts ? 'bg-amber-500/15 border-amber-500/50 text-obsidian-amber font-medium' : 'bg-[#191919] border-obsidian-border text-[#737373] hover:text-[#D4D4D4]'}">
                  Todos
                </button>
                ${trafficDepartments.map((d) => {
                  const isOn = !isAllDepts && depts.includes(d);
                  const dCol = getDepartmentColor(d);
                  return `
                    <button type="button" data-st-member-dept="${idx}:${escapeHtml(d)}"
                      style="${isOn ? `border-color:${escapeHtml(dCol)}; color:${escapeHtml(dCol)}; background:${escapeHtml(dCol)}18;` : ''}"
                      class="px-2 py-0.5 rounded-md border text-[9.5px] cursor-pointer transition-colors ${isOn ? 'font-medium' : 'bg-[#191919] border-obsidian-border text-[#737373] hover:text-[#D4D4D4]'}">
                      ${escapeHtml(d)}
                    </button>
                  `;
                }).join('')}
              </div>
            </div>
            `;
          }).join('')}
        </div>

        <form id="st-add-member-form" class="bg-[#202020] border border-obsidian-border rounded-xl p-3 flex flex-wrap items-end gap-2">
          <label class="flex-1 min-w-[110px] space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Nombre</span>
            <input id="st-m-name" type="text" required placeholder="Ej. Valentina" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-[#D4D4D4] focus:outline-none" />
          </label>
          <label class="flex-1 min-w-[140px] space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Correo</span>
            <input id="st-m-email" type="email" required placeholder="correo@estudio.com" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-[#D4D4D4] focus:outline-none" />
          </label>
          <label class="w-32 space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Rol</span>
            <select id="st-m-role" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-[#D4D4D4] focus:outline-none cursor-pointer">
              ${studioRoles.filter((r) => r !== 'Dueño').map((r) => `<option value="${escapeHtml(r)}" ${r === 'Operativo' ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('')}
            </select>
          </label>
          <label class="w-32 space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Alcance</span>
            <select id="st-m-scope" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-obsidian-cyan focus:outline-none cursor-pointer">
              ${studioScopes.map((sc) => `<option value="${escapeHtml(sc)}" ${sc === 'Departamento' ? 'selected' : ''}>${escapeHtml(sc)}</option>`).join('')}
            </select>
          </label>
          <button type="submit" ${usedSeats >= studioSettings.maxSeats ? 'disabled' : ''} class="h-7 px-3 rounded-lg bg-obsidian-amber hover:bg-amber-400 disabled:opacity-40 text-[#191919] font-semibold cursor-pointer">+ Invitar</button>
        </form>
      </div>
    `;

    settingsTabBody.querySelectorAll('[data-st-member-role]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const m = studioTeamList[Number(sel.dataset.stMemberRole)];
        if (!m || m.isOwner) return;
        m.role = sel.value;
        syncMemberToUserAccount(m);
        notifySketchChange('team');
      });
    });

    settingsTabBody.querySelectorAll('[data-st-member-scope]').forEach((sel) => {
      sel.addEventListener('change', () => {
        const m = studioTeamList[Number(sel.dataset.stMemberScope)];
        if (!m || m.isOwner) return;
        m.scope = sel.value;
        syncMemberToUserAccount(m);
        notifySketchChange('team');
      });
    });

    settingsTabBody.querySelectorAll('[data-st-member-dept]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [idxStr, ...rest] = String(btn.dataset.stMemberDept || '').split(':');
        const dept = rest.join(':');
        const m = studioTeamList[Number(idxStr)];
        if (!m || !dept) return;
        if (dept === 'Todos') {
          m.departments = ['Todos'];
        } else {
          const cur = (Array.isArray(m.departments) ? m.departments : []).filter((d) => d !== 'Todos');
          const pos = cur.indexOf(dept);
          if (pos !== -1) cur.splice(pos, 1);
          else cur.push(dept);
          m.departments = cur.length ? cur : ['Todos'];
        }
        syncMemberToUserAccount(m);
        notifySketchChange('team');
        renderSettingsTab();
      });
    });

    settingsTabBody.querySelectorAll('[data-st-remove-member]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.stRemoveMember);
        const removed = studioTeamList.splice(idx, 1)[0];
        syncTrafficMembers(removed?.name || null);
        notifySketchChange('team');
        renderSettingsTab();
      });
    });
    settingsTabBody.querySelector('#st-add-member-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (usedSeats >= studioSettings.maxSeats) return;
      const name = settingsTabBody.querySelector('#st-m-name')?.value.trim();
      const email = settingsTabBody.querySelector('#st-m-email')?.value.trim();
      const role = settingsTabBody.querySelector('#st-m-role')?.value || 'Operativo';
      const scope = settingsTabBody.querySelector('#st-m-scope')?.value || 'Departamento';
      if (!name || !email) return;
      studioTeamList.push({
        name,
        email,
        role,
        scope,
        departments: [trafficDepartments[0] || 'Creativos'],
        isOwner: false,
        status: 'Invitado',
      });
      syncTrafficMembers();
      notifySketchChange('team');
      renderSettingsTab();
    });
  } else if (activeTab === 'clients') {
    settingsTabBody.innerHTML = `
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div class="text-[11px] text-[#8C8C8C]">
            ${clientsData.length} clientes registrados · <span class="text-emerald-400">Contactos revisores gratis en todos los planes</span>
          </div>
          <button type="button" id="st-btn-new-client" class="h-7 px-3 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] font-semibold cursor-pointer">+ Nuevo Cliente</button>
        </div>
        <div class="border border-obsidian-border rounded-xl overflow-hidden bg-[#202020]">
          <table class="w-full text-left text-[10.5px] border-collapse">
            <thead>
              <tr class="bg-[#161616] border-b border-obsidian-border text-[9.5px] uppercase tracking-wider text-[#8C8C8C]">
                <th class="px-3 py-2">Cliente</th>
                <th class="px-3 py-2">Marcas</th>
                <th class="px-3 py-2 text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-obsidian-border">
              ${clientsData.map((c) => {
      const bNames = Object.keys(c.brands || {});
      return `
                  <tr class="hover:bg-obsidian-elevated/40">
                    <td class="px-3 py-2">
                      <span class="inline-flex items-center gap-2 font-medium text-[#D4D4D4]">
                        <span class="w-2 h-2 rounded-full shrink-0" style="background:${escapeHtml(c.color || '#8C8C8C')}"></span>
                        <span>${escapeHtml(c.name)}</span>
                      </span>
                    </td>
                    <td class="px-3 py-2 text-[#8C8C8C]">${escapeHtml(bNames.join(', ') || '—')}</td>
                    <td class="px-3 py-2 text-right">
                      <button type="button" data-st-edit-client="${escapeHtml(c.name)}" class="px-2 py-0.5 rounded bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] cursor-pointer">Editar</button>
                    </td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    settingsTabBody.querySelector('#st-btn-new-client')?.addEventListener('click', () => openClientModal(null));
    settingsTabBody.querySelectorAll('[data-st-edit-client]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cObj = clientsData.find((c) => c.name === btn.dataset.stEditClient);
        if (cObj) openClientModal(cObj);
      });
    });
  } else if (activeTab === 'billing') {
    settingsTabBody.innerHTML = `
      <div class="space-y-4">
        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-3">
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="text-[10px] uppercase tracking-wider text-obsidian-amber font-semibold">Suscripción Actual</div>
              <div class="text-[14px] font-medium text-[#D4D4D4]">${escapeHtml(studioSettings.planName)}</div>
              <div class="text-[10.5px] text-[#8C8C8C]">Te quedan <strong class="text-[#D4D4D4]">${studioSettings.trialDaysLeft} días</strong> de prueba gratis.</div>
            </div>
            <a href="https://trafikeitor.com/planes" target="_blank" rel="noopener noreferrer"
              class="px-3.5 py-1.5 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] font-semibold inline-flex items-center gap-1.5 shrink-0 transition-colors">
              <span>Administrar / Mejorar plan</span>
              <span>↗</span>
            </a>
          </div>
          <div class="grid grid-cols-3 gap-2 pt-2 border-t border-obsidian-border text-[10.5px]">
            <div class="bg-[#191919] border border-obsidian-border rounded-lg p-2.5">
              <div class="text-[#8C8C8C] text-[9.5px] uppercase">Puestos internos</div>
              <div class="font-mono text-[13px] text-[#D4D4D4] mt-0.5">${usedSeats} / ${studioSettings.maxSeats}</div>
            </div>
            <div class="bg-[#191919] border border-obsidian-border rounded-lg p-2.5">
              <div class="text-[#8C8C8C] text-[9.5px] uppercase">Clientes revisores</div>
              <div class="font-mono text-[13px] text-emerald-400 mt-0.5">Gratis · Ilimitados</div>
            </div>
            <div class="bg-[#191919] border border-obsidian-border rounded-lg p-2.5">
              <div class="text-[#8C8C8C] text-[9.5px] uppercase">Facturación</div>
              <div class="text-[11px] text-[#D4D4D4] mt-1">Gestionada en sitio web</div>
            </div>
          </div>
        </div>

        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-2">
          <div class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Planes disponibles en trafikeitor.com</div>
          <div class="grid grid-cols-2 gap-2.5 text-[10.5px]">
            <div class="bg-[#191919] border border-obsidian-border rounded-lg p-3 space-y-1">
              <div class="flex items-center justify-between"><strong class="text-[#D4D4D4]">Plan Solo</strong><span class="font-mono text-obsidian-amber">USD $12/mes</span></div>
              <div class="text-[#8C8C8C]">1 puesto (sin invitaciones internas) + clientes revisores gratis.</div>
            </div>
            <div class="bg-[#191919] border border-obsidian-border rounded-lg p-3 space-y-1">
              <div class="flex items-center justify-between"><strong class="text-[#D4D4D4]">Plan Estudio</strong><span class="font-mono text-obsidian-amber">USD $49/mes</span></div>
              <div class="text-[#8C8C8C]">Hasta 5 puestos (sin contar al dueño) + USD $5/puesto extra (máx. 10) + clientes gratis.</div>
            </div>
          </div>
        </div>
      </div>
    `;
  } else if (activeTab === 'data') {
    settingsTabBody.innerHTML = `
      <div class="min-h-full flex flex-col justify-between gap-10">
        <div class="space-y-4">
          <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-2.5">
            <div class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">API Keys Conexión IA (Próximamente)</div>
            <div class="flex gap-2">
              <input id="st-api-key" type="password" value="${escapeHtml(studioSettings.apiKey)}" class="flex-1 h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 font-mono text-[#D4D4D4] focus:outline-none" />
              <button type="button" id="st-save-api" class="h-8 px-3 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] cursor-pointer">Guardar</button>
            </div>
          </div>

          <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <div class="text-[12px] font-medium text-[#D4D4D4]">Backups</div>
              <div class="text-[10.5px] text-[#8C8C8C]">Descarga un respaldo en JSON con clientes, equipo y órdenes de trabajo.</div>
            </div>
            <button type="button" id="st-export-backup" class="h-8 px-3 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#D4D4D4] cursor-pointer shrink-0">Descargar Backup</button>
          </div>
        </div>

        <div class="pt-5 border-t border-obsidian-border">
          <div class="text-[9.5px] uppercase tracking-[0.12em] text-rose-400/80 mb-2">Zona de peligro</div>
          <div class="bg-rose-500/5 border border-rose-500/30 rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <div class="text-[12px] font-medium text-rose-300">Resetear la app</div>
            <div class="text-[10.5px] text-[#8C8C8C]">Deja la base de datos vacía para iniciar desde cero.</div>
          </div>
          <button type="button" id="st-reset-app" class="h-8 px-3 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-medium cursor-pointer shrink-0">Resetear Datos</button>
          </div>
        </div>
      </div>
    `;
    settingsTabBody.querySelector('#st-save-api')?.addEventListener('click', () => {
      studioSettings.apiKey = settingsTabBody.querySelector('#st-api-key')?.value || '';
    });
    settingsTabBody.querySelector('#st-export-backup')?.addEventListener('click', () => {
      const payload = JSON.stringify({ studio: studioSettings, members: studioTeamList, clients: clientsData, orders: trafficOrders }, null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${studioSettings.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
    settingsTabBody.querySelector('#st-reset-app')?.addEventListener('click', () => {
      if (!confirm('¿Seguro que deseas vaciar todos los datos de prueba del estudio?')) return;
      trafficOrders.length = 0;
      sketchState.stripboardListItems = null;
      sketchState.stripboardStripsByDate = {};
      standaloneDocuments.length = 0;
      standaloneDevFiles.length = 0;
      notifySketchChange('orders');
      notifySketchChange('gallery');
      notifySketchChange('stripboard');
      closeSettingsModal();
    });
  } else if (activeTab === 'prefs') {
    settingsTabBody.innerHTML = `
      <div class="space-y-4">
        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-3">
          <div class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Tema de la interfaz</div>
          <div class="grid grid-cols-3 gap-2">
            ${[['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Dispositivo']].map(([val, lbl]) => `
              <button type="button" data-st-theme="${val}" class="h-9 rounded-lg border text-[11px] cursor-pointer transition-colors ${studioSettings.theme === val ? 'bg-obsidian-elevated border-obsidian-amber/60 text-[#D4D4D4] font-medium' : 'bg-[#191919] border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4]'}">${lbl}</button>
            `).join('')}
          </div>
        </div>
        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-2">
          <div class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Idioma de salida</div>
          <select id="st-lang-select" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] focus:outline-none cursor-pointer">
            <option value="es" ${studioSettings.language === 'es' ? 'selected' : ''}>Español</option>
            <option value="en" ${studioSettings.language === 'en' ? 'selected' : ''}>Inglés</option>
            <option value="pt" ${studioSettings.language === 'pt' ? 'selected' : ''}>Portugués</option>
          </select>
        </div>
      </div>
    `;
    settingsTabBody.querySelectorAll('[data-st-theme]').forEach((btn) => {
      btn.addEventListener('click', () => {
        studioSettings.theme = btn.dataset.stTheme;
        renderSettingsTab();
      });
    });
    settingsTabBody.querySelector('#st-lang-select')?.addEventListener('change', (e) => {
      studioSettings.language = e.target.value;
    });
  } else if (activeTab === 'help') {
    settingsTabBody.innerHTML = `
      <div class="grid grid-cols-2 gap-2.5">
        ${[
        ['Documentación de la app', 'Guías de uso, flujos de OT y Stripboard'],
        ['Ayuda', 'Preguntas frecuentes y primeros pasos'],
        ['Soporte técnico', 'Reportar un fallo o incidencia'],
        ['Soporte de facturación', 'Dudas sobre cobros, facturas y puestos'],
        ['Contáctenos', 'Hablar con el equipo de Trafikeitor'],
        ['Términos del servicio', 'Condiciones de uso de la plataforma'],
        ['Política de privacidad', 'Tratamiento de datos personales'],
        ['Cómo se usan sus datos', 'Seguridad, cifrado y propiedad de archivos']
      ].map(([title, desc]) => `
          <a href="#${encodeURIComponent(title)}" onclick="event.preventDefault()" class="bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border rounded-xl p-3 space-y-0.5 transition-colors block">
            <div class="text-[11.5px] font-medium text-[#D4D4D4] flex items-center justify-between"><span>${escapeHtml(title)}</span><span class="text-[#8C8C8C]">↗</span></div>
            <div class="text-[10px] text-[#8C8C8C]">${escapeHtml(desc)}</div>
          </a>
        `).join('')}
      </div>
    `;
  } else if (activeTab === 'products') {
    settingsTabBody.innerHTML = `
      <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 flex items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-medium text-[#D4D4D4]">PanOptik</span>
            <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-obsidian-amber text-[9.5px] font-mono">Próximamente</span>
          </div>
          <div class="text-[10.5px] text-[#8C8C8C]">Producto del ecosistema El Marcante integrado con tus proyectos.</div>
        </div>
        <button type="button" class="h-8 px-3 rounded-lg bg-[#191919] border border-obsidian-border text-[#8C8C8C] cursor-default">En desarrollo</button>
      </div>
    `;
  }

  if (window.hydrateIcons) window.hydrateIcons(settingsModal);
}

/**
 * Initialize #settings-modal triggers, navigation tabs, and Escape/backdrop close handlers.
 */
export function initSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');

  document.querySelectorAll('.settings-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      sketchState.activeSettingsTab = btn.dataset.settingsTab || 'studio';
      renderSettingsTab();
    });
  });

  document.getElementById('btn-settings-menu')?.addEventListener('click', () => openSettingsModal('studio'));
  document.getElementById('btn-studio-footer')?.addEventListener('click', () => openSettingsModal('studio'));
  document.getElementById('btn-trial-badge')?.addEventListener('click', () => openSettingsModal('billing'));
  document.getElementById('btn-close-settings-modal')?.addEventListener('click', closeSettingsModal);

  settingsModal?.addEventListener('click', (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && settingsModal && !settingsModal.classList.contains('hidden')) {
      closeSettingsModal();
    }
  });

  onSketchChange('clients', () => {
    if (settingsModal && !settingsModal.classList.contains('hidden')) {
      renderSettingsTab();
    }
  });
}
