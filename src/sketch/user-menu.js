/**
 * Módulo Usuario: popover de sesión, modal Configuración de Usuario
 * (Avatar Iniciales/Ícono/Foto + Color Personal + Rol/Alcance/Deptos + Firma + Preferencias)
 * y modal Cambiar de cuenta.
 */

import {
  escapeHtml,
  getDepartmentColor,
  notifySketchChange,
  sketchState,
  studioSettings,
  userAccounts,
  userProfile,
} from './store.js';
import {
  bindSpectrumColorPicker,
  getSpectrumColorName,
  renderSpectrumColorPickerHtml,
} from './color-picker.js';

const USER_AVATAR_ICONS = [
  { key: 'pen', label: 'Diseño', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/></svg>' },
  { key: 'palette', label: 'Arte', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>' },
  { key: 'film', label: 'Video', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 12h18"/><path d="M3 7.5h4"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>' },
  { key: 'camera', label: 'Foto', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>' },
  { key: 'compass', label: 'Dirección', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>' },
  { key: 'zap', label: 'Tráfico', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { key: 'code', label: 'Desarrollo', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>' },
  { key: 'sparkles', label: 'Creatividad', svg: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z"/></svg>' },
];

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || 'US').trim().slice(0, 2).toUpperCase();
}

function renderAvatarVisual(profile, sizeCls = 'w-6 h-6 text-[9.5px] rounded-md') {
  const color = profile.color || '#f59e0b';
  if (profile.avatarMode === 'image' && profile.avatarImage) {
    return `<span class="${sizeCls} inline-flex items-center justify-center overflow-hidden border shrink-0" style="border-color:${escapeHtml(color)}88;"><img src="${escapeHtml(profile.avatarImage)}" alt="" class="w-full h-full object-cover" /></span>`;
  }
  if (profile.avatarMode === 'icon') {
    const def = USER_AVATAR_ICONS.find((i) => i.key === profile.avatarIcon) || USER_AVATAR_ICONS[0];
    return `<span class="${sizeCls} inline-flex items-center justify-center border shrink-0" style="background:${escapeHtml(color)}22; border-color:${escapeHtml(color)}66; color:${escapeHtml(color)};">${def.svg}</span>`;
  }
  const initials = getInitials(profile.fullName || profile.shortName);
  return `<span class="${sizeCls} inline-flex items-center justify-center font-mono font-semibold border shrink-0" style="background:${escapeHtml(color)}22; border-color:${escapeHtml(color)}66; color:${escapeHtml(color)};">${escapeHtml(initials)}</span>`;
}

function syncUserHeaderUi() {
  const btn = document.getElementById('btn-user-menu');
  if (btn) {
    btn.title = `${userProfile.fullName} · ${userProfile.role}`;
    btn.className = 'w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-transform hover:scale-105 cursor-pointer';
    btn.innerHTML = renderAvatarVisual(userProfile, 'w-6 h-6 text-[9.5px] rounded-md');
  }

  const popover = document.getElementById('user-menu-popover');
  if (popover) {
    const header = popover.firstElementChild;
    if (header) {
      const color = userProfile.color || '#f59e0b';
      header.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-[#D4D4D4] truncate">${escapeHtml(userProfile.fullName)}</span>
          <span class="px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0" style="background:${escapeHtml(color)}22; color:${escapeHtml(color)}">${escapeHtml(userProfile.role)}</span>
        </div>
        <div class="text-[9.5px] text-[#8C8C8C] truncate">${escapeHtml(userProfile.email)}</div>
      `;
    }
  }
}

function ensureUserModalHost() {
  let host = document.getElementById('user-modal-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'user-modal-host';
    host.className = 'hidden fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4 overflow-y-auto';
    document.body.appendChild(host);
    host.addEventListener('click', (e) => {
      if (e.target === host) host.classList.add('hidden');
    });
  }
  return host;
}

function openProfileModal() {
  const host = ensureUserModalHost();
  const draft = {
    ...userProfile,
    departments: [...(userProfile.departments || ['Todos'])],
    dailyHours: Number(studioSettings.dailyHours) || userProfile.dailyHours || 8,
  };

  const renderModal = () => {
    const activeColorName = getSpectrumColorName(draft.color);
    const depts = draft.departments.length ? draft.departments : ['Todos'];
    const usedByMap = new Map();
    userAccounts.forEach((acc) => {
      if (acc.shortName !== draft.shortName && acc.color) {
        usedByMap.set(acc.color.toLowerCase(), acc.shortName);
      }
    });

    host.innerHTML = `
      <div class="w-full max-w-lg bg-[#202020] border border-obsidian-borderActive rounded-2xl shadow-2xl overflow-hidden text-[11px] my-auto">
        <div class="px-4 py-3 border-b border-obsidian-border flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background:${escapeHtml(draft.color || '#f59e0b')}"></span>
            <span class="text-[12px] font-semibold uppercase tracking-wider text-[#D4D4D4]">Configuración de Usuario</span>
          </div>
          <button type="button" data-close-umodal class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">✕</button>
        </div>

        <form id="um-profile-form" class="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto">
          <input id="um-photo-input" type="file" accept="image/*" class="hidden" />

          <!-- 1. Avatar & Color Personal -->
          <div class="bg-[#191919] border border-obsidian-border rounded-xl p-3 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-[9.5px] uppercase tracking-[0.1em] text-[#8C8C8C] font-semibold">Avatar & Color Personal</span>
              <span class="text-[10px] font-medium" style="color:${escapeHtml(draft.color || '#f59e0b')}">${escapeHtml(activeColorName)}</span>
            </div>

            <div class="flex items-center gap-3.5">
              <div id="um-avatar-preview" class="shrink-0">
                ${renderAvatarVisual(draft, 'w-14 h-14 text-[18px] rounded-full')}
              </div>

              <div class="flex-1 space-y-2 min-w-0">
                <div class="flex items-center gap-1 bg-[#202020] p-0.5 rounded-lg border border-obsidian-border">
                  ${[['initials', 'Iniciales'], ['icon', 'Ícono'], ['image', 'Subir Foto']].map(([m, lbl]) => `
                    <button type="button" data-um-avatar-mode="${m}" class="flex-1 py-1 text-[10.5px] rounded-md transition-colors cursor-pointer ${draft.avatarMode === m ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">${lbl}</button>
                  `).join('')}
                </div>

                ${draft.avatarMode === 'initials' ? `
                  <div class="text-[10px] text-[#8C8C8C]">Avatar generado automáticamente con las iniciales de tu nombre o firma.</div>
                ` : ''}

                ${draft.avatarMode === 'icon' ? `
                  <div class="grid grid-cols-4 gap-1.5">
                    ${USER_AVATAR_ICONS.map((ic) => {
                      const sel = draft.avatarIcon === ic.key;
                      return `
                        <button type="button" data-um-avatar-icon="${ic.key}" title="${escapeHtml(ic.label)}"
                          class="h-8 rounded-lg flex items-center justify-center border transition-all cursor-pointer ${sel ? 'bg-obsidian-elevated border-obsidian-amber text-obsidian-amber' : 'bg-[#202020] border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4]'}">
                          ${ic.svg}
                        </button>
                      `;
                    }).join('')}
                  </div>
                ` : ''}

                ${draft.avatarMode === 'image' ? `
                  <div class="flex items-center gap-2">
                    <button type="button" id="um-btn-upload" class="h-7 px-2.5 rounded-lg bg-[#202020] hover:bg-obsidian-elevated border border-obsidian-border text-[10.5px] text-[#D4D4D4] cursor-pointer">
                      ${draft.avatarImage ? 'Cambiar Foto' : 'Subir Imagen'}
                    </button>
                    ${draft.avatarImage ? `<button type="button" id="um-btn-remove-photo" class="h-7 px-2.5 rounded-lg border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-[10.5px] cursor-pointer">Quitar</button>` : ''}
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="pt-2 border-t border-obsidian-border">
              ${renderSpectrumColorPickerHtml({ selectedHex: draft.color, usedByMap, pickerId: 'um-spectrum-picker' })}
            </div>
          </div>

          <!-- 2. Rol, Alcance y Departamentos (solo lectura) -->
          <div class="bg-[#191919] border border-obsidian-border rounded-xl px-3 py-2.5 space-y-2">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-1.5">
                <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Rol:</span>
                <span class="px-2 py-0.5 rounded-full text-[9.5px] font-mono font-medium" style="background:${escapeHtml(draft.color)}22; color:${escapeHtml(draft.color)}">${escapeHtml(draft.role)}</span>
              </div>
              <div class="text-[10px] text-[#8C8C8C] truncate">
                Alcance: <strong class="text-[#D4D4D4] font-medium">${escapeHtml(draft.scope || 'Todo el estudio')}</strong>
              </div>
            </div>
            <div class="flex flex-wrap items-center gap-1.5 pt-1 border-t border-obsidian-border/70">
              <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C] mr-1">Deptos:</span>
              ${depts.map((d) => {
                const isAll = d === 'Todos';
                return `<span class="px-1.5 py-0.5 rounded bg-[#242424] border border-obsidian-border text-[9.5px] font-medium" style="color:${isAll ? '#f59e0b' : escapeHtml(getDepartmentColor(d))}">${escapeHtml(isAll ? 'Todos los departamentos' : d)}</span>`;
              }).join('')}
            </div>
          </div>

          <!-- 3. Identidad y Firma Operativa -->
          <div class="grid grid-cols-2 gap-2.5">
            <label class="block space-y-1">
              <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Nombre completo *</span>
              <input id="um-fullname" type="text" required value="${escapeHtml(draft.fullName)}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:border-obsidian-borderActive focus:outline-none" />
            </label>
            <label class="block space-y-1">
              <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Firma / Nombre corto *</span>
              <input id="um-shortname" type="text" required value="${escapeHtml(draft.shortName)}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:border-obsidian-borderActive focus:outline-none" />
            </label>
            <label class="col-span-2 block space-y-1">
              <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Correo</span>
              <input id="um-email" type="email" required value="${escapeHtml(draft.email)}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:border-obsidian-borderActive focus:outline-none" />
            </label>
          </div>

          <!-- 4. Preferencias Personales -->
          <div class="grid grid-cols-2 gap-2.5 pt-1 border-t border-obsidian-border">
            <label class="block space-y-1">
              <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Jornada diaria (horas)</span>
              <input id="um-hours" type="number" min="1" max="16" step="0.5" value="${draft.dailyHours}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 font-mono text-obsidian-amber focus:outline-none" />
            </label>
            <label class="block space-y-1">
              <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Vista inicial en Mis OTs</span>
              <select id="um-default-view" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:outline-none cursor-pointer">
                ${[['list', 'Lista'], ['kanban', 'Kanban'], ['gantt', 'Gantt'], ['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([v, l]) => `<option value="${v}" ${draft.defaultView === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
          </div>

          <div class="pt-1 border-t border-obsidian-border space-y-1.5">
            <div class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Notificaciones</div>
            <label class="flex items-center justify-between gap-2 text-[#D4D4D4] cursor-pointer">
              <span>Alertas por WhatsApp (urgentes y vencimientos)</span>
              <input id="um-notif-wa" type="checkbox" ${draft.notifyWhatsapp ? 'checked' : ''} class="accent-amber-500 rounded cursor-pointer" />
            </label>
            <label class="flex items-center justify-between gap-2 text-[#D4D4D4] cursor-pointer">
              <span>Resumen diario por correo</span>
              <input id="um-notif-email" type="checkbox" ${draft.notifyEmail ? 'checked' : ''} class="accent-amber-500 rounded cursor-pointer" />
            </label>
          </div>

          <div class="pt-2 border-t border-obsidian-border flex items-center justify-end gap-2">
            <button type="button" data-close-umodal class="h-7 px-3 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4] cursor-pointer">Cancelar</button>
            <button type="submit" class="h-7 px-3.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-obsidian-amber font-medium cursor-pointer">Guardar cambios</button>
          </div>
        </form>
      </div>
    `;

    host.querySelectorAll('[data-close-umodal]').forEach((b) => {
      b.addEventListener('click', () => host.classList.add('hidden'));
    });

    const syncDraftInputs = () => {
      draft.fullName = host.querySelector('#um-fullname')?.value ?? draft.fullName;
      draft.shortName = host.querySelector('#um-shortname')?.value ?? draft.shortName;
      draft.email = host.querySelector('#um-email')?.value ?? draft.email;
      draft.dailyHours = Math.max(1, Math.min(16, Number(host.querySelector('#um-hours')?.value) || 8));
      draft.defaultView = host.querySelector('#um-default-view')?.value || draft.defaultView;
      draft.notifyWhatsapp = !!host.querySelector('#um-notif-wa')?.checked;
      draft.notifyEmail = !!host.querySelector('#um-notif-email')?.checked;
    };

    host.querySelector('#um-fullname')?.addEventListener('input', () => {
      syncDraftInputs();
      const prev = host.querySelector('#um-avatar-preview');
      if (prev && draft.avatarMode === 'initials') {
        prev.innerHTML = renderAvatarVisual(draft, 'w-14 h-14 text-[18px] rounded-full');
      }
    });

    host.querySelectorAll('[data-um-avatar-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftInputs();
        draft.avatarMode = btn.dataset.umAvatarMode;
        renderModal();
      });
    });

    host.querySelectorAll('[data-um-avatar-icon]').forEach((btn) => {
      btn.addEventListener('click', () => {
        syncDraftInputs();
        draft.avatarIcon = btn.dataset.umAvatarIcon;
        renderModal();
      });
    });

    bindSpectrumColorPicker(
      host,
      (nextHex) => {
        syncDraftInputs();
        draft.color = nextHex;
        renderModal();
      },
      { pickerId: 'um-spectrum-picker' }
    );

    const photoInput = host.querySelector('#um-photo-input');
    host.querySelector('#um-btn-upload')?.addEventListener('click', () => photoInput?.click());
    photoInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      syncDraftInputs();
      const reader = new FileReader();
      reader.onload = () => {
        draft.avatarImage = String(reader.result || '');
        draft.avatarMode = 'image';
        renderModal();
      };
      reader.readAsDataURL(file);
    });

    host.querySelector('#um-btn-remove-photo')?.addEventListener('click', () => {
      syncDraftInputs();
      draft.avatarImage = '';
      draft.avatarMode = 'initials';
      renderModal();
    });

    host.querySelector('#um-profile-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      syncDraftInputs();
      Object.assign(userProfile, draft);
      studioSettings.dailyHours = draft.dailyHours;
      sketchState.myOtsMember = userProfile.shortName;
      sketchState.myOtsMode = userProfile.defaultView;

      const matchedAcc = userAccounts.find((a) => a.email === userProfile.email || a.shortName === userProfile.shortName);
      if (matchedAcc) Object.assign(matchedAcc, draft);

      syncUserHeaderUi();
      host.classList.add('hidden');
      notifySketchChange('settings');
      notifySketchChange('orders', { filter: sketchState.trafficFilter });
    });
  };

  renderModal();
  host.classList.remove('hidden');
}

function openSwitchAccountModal() {
  const host = ensureUserModalHost();

  host.innerHTML = `
    <div class="w-full max-w-sm bg-[#202020] border border-obsidian-borderActive rounded-xl shadow-2xl overflow-hidden text-[11px]">
      <div class="px-4 py-3 border-b border-obsidian-border flex items-center justify-between">
        <div>
          <div class="text-[12.5px] font-medium text-[#D4D4D4]">Cambiar de cuenta</div>
          <div class="text-[10px] text-[#8C8C8C]">Simula la sesión de otro miembro del estudio</div>
        </div>
        <button type="button" data-close-umodal class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">✕</button>
      </div>
      <div class="p-2 space-y-1">
        ${userAccounts.map((acc, idx) => {
          const isCurrent = acc.shortName === sketchState.myOtsMember;
          return `
            <button type="button" data-pick-account="${idx}" class="w-full px-2.5 py-2 rounded-lg ${isCurrent ? 'bg-obsidian-elevated border border-obsidian-borderActive' : 'hover:bg-obsidian-elevated/70 border border-transparent'} flex items-center justify-between gap-2 text-left transition-colors cursor-pointer">
              <div class="flex items-center gap-2.5 min-w-0">
                ${renderAvatarVisual(acc, 'w-7 h-7 text-[10px] rounded-md')}
                <div class="min-w-0">
                  <div class="font-medium text-[#D4D4D4] truncate">${escapeHtml(acc.fullName)}</div>
                  <div class="text-[9.5px] text-[#8C8C8C] truncate">${escapeHtml(acc.email)}</div>
                </div>
              </div>
              <span class="px-1.5 py-0.5 rounded text-[9px] font-mono shrink-0 ${isCurrent ? 'bg-emerald-500/15 text-emerald-300' : 'bg-[#191919] text-[#8C8C8C]'}">${isCurrent ? 'Activa' : escapeHtml(acc.role)}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  host.classList.remove('hidden');
  host.querySelectorAll('[data-close-umodal]').forEach((b) => {
    b.addEventListener('click', () => host.classList.add('hidden'));
  });
  host.querySelectorAll('[data-pick-account]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const acc = userAccounts[Number(btn.dataset.pickAccount)];
      if (!acc) return;
      Object.assign(userProfile, acc, { departments: [...(acc.departments || ['Todos'])] });
      studioSettings.dailyHours = acc.dailyHours || 8;
      sketchState.myOtsMember = acc.shortName;
      sketchState.activeMyOtId = null;
      sketchState.activeTaskIndex = null;
      sketchState.stripboardListItems = null;
      sketchState.stripboardStripsByDate = {};
      syncUserHeaderUi();
      host.classList.add('hidden');
      notifySketchChange('settings');
      notifySketchChange('orders', { filter: sketchState.trafficFilter });
    });
  });
}

function showQuickToast(msg) {
  let toast = document.getElementById('sketch-quick-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'sketch-quick-toast';
    toast.className = 'fixed bottom-4 right-4 z-[60] px-3 py-2 rounded-lg bg-[#202020] border border-obsidian-borderActive text-[11px] text-[#D4D4D4] shadow-2xl transition-opacity';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.remove('hidden', 'opacity-0');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.add('hidden'), 2600);
}

export function initUserMenu() {
  const btn = document.getElementById('btn-user-menu');
  const popover = document.getElementById('user-menu-popover');
  if (!btn || !popover) return;

  syncUserHeaderUi();

  const close = () => popover.classList.add('hidden');
  const toggle = () => popover.classList.toggle('hidden');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggle();
  });

  document.addEventListener('click', (e) => {
    if (!popover.classList.contains('hidden') && !popover.contains(e.target) && !btn.contains(e.target)) {
      close();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      document.getElementById('user-modal-host')?.classList.add('hidden');
    }
  });

  popover.querySelectorAll('[data-user-action]').forEach((item) => {
    item.addEventListener('click', () => {
      const action = item.dataset.userAction;
      close();
      if (action === 'profile') openProfileModal();
      else if (action === 'switch') openSwitchAccountModal();
      else if (action === 'logout') showQuickToast('Sesión cerrada (modo prototipo).');
    });
  });

  document.getElementById('btn-user-schedule')?.addEventListener('click', () => {
    sketchState.stripboardViewMode = 'day';
    document.querySelector('.ot-sub-btn[data-ot-view="my-tasks"]')?.click();
  });
}
