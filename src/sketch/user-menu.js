/**
 * User menu popover, Configuración de usuario modal, and Cambiar de cuenta modal.
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

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return String(name || 'US').trim().slice(0, 2).toUpperCase();
}

function syncUserHeaderUi() {
  const initials = getInitials(userProfile.fullName || userProfile.shortName);
  const initEl = document.getElementById('user-avatar-initials');
  if (initEl) initEl.textContent = initials;

  const btn = document.getElementById('btn-user-menu');
  if (btn) btn.title = `${userProfile.fullName} · ${userProfile.role}`;

  const popover = document.getElementById('user-menu-popover');
  if (popover) {
    const header = popover.firstElementChild;
    if (header) {
      header.innerHTML = `
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-[#D4D4D4] truncate">${escapeHtml(userProfile.fullName)}</span>
          <span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-obsidian-amber text-[9px] font-mono shrink-0">${escapeHtml(userProfile.role)}</span>
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
    host.className = 'hidden fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4';
    document.body.appendChild(host);
    host.addEventListener('click', (e) => {
      if (e.target === host) host.classList.add('hidden');
    });
  }
  return host;
}

function openProfileModal() {
  const host = ensureUserModalHost();
  const initials = getInitials(userProfile.fullName);

  host.innerHTML = `
    <div class="w-full max-w-md bg-[#202020] border border-obsidian-borderActive rounded-xl shadow-2xl overflow-hidden text-[11px]">
      <div class="px-4 py-3 border-b border-obsidian-border flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="w-7 h-7 rounded-md bg-amber-500/20 text-obsidian-amber font-mono font-semibold text-[11px] flex items-center justify-center">${escapeHtml(initials)}</span>
          <div>
            <div class="text-[12.5px] font-medium text-[#D4D4D4]">Configuración de Usuario</div>
            <div class="text-[10px] text-[#8C8C8C]">Perfil personal, firma y preferencias</div>
          </div>
        </div>
        <button type="button" data-close-umodal class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">×</button>
      </div>

      <form id="um-profile-form" class="p-4 space-y-3">
        <div class="grid grid-cols-2 gap-2.5">
          <label class="block space-y-1">
            <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Nombre completo</span>
            <input id="um-fullname" type="text" required value="${escapeHtml(userProfile.fullName)}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:border-obsidian-borderActive focus:outline-none" />
          </label>
          <label class="block space-y-1">
            <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Firma corta</span>
            <input id="um-shortname" type="text" required value="${escapeHtml(userProfile.shortName)}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:border-obsidian-borderActive focus:outline-none" />
          </label>
        </div>

        <div class="space-y-2.5">
          <label class="block space-y-1">
            <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Correo</span>
            <input id="um-email" type="email" required value="${escapeHtml(userProfile.email)}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:border-obsidian-borderActive focus:outline-none" />
          </label>
          <div class="space-y-1">
            <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C] block">Departamentos asignados</span>
            <div class="min-h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 py-1 flex flex-wrap items-center gap-1.5">
              ${(Array.isArray(userProfile.departments) && userProfile.departments.length ? userProfile.departments : ['Todos']).map((d) => {
                const isAll = d === 'Todos';
                return `<span class="px-1.5 py-0.5 rounded bg-[#252525] border border-obsidian-border text-[10px] font-medium" style="color:${isAll ? '#f59e0b' : escapeHtml(getDepartmentColor(d))}">${escapeHtml(isAll ? 'Todos los departamentos' : d)}</span>`;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2.5 pt-1 border-t border-obsidian-border">
          <label class="block space-y-1">
            <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Jornada diaria (horas)</span>
            <input id="um-hours" type="number" min="1" max="16" step="0.5" value="${Number(studioSettings.dailyHours) || 8}" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 font-mono text-obsidian-amber focus:outline-none" />
          </label>
          <label class="block space-y-1">
            <span class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Vista inicial en Mis OTs</span>
            <select id="um-default-view" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded-lg px-2 text-[#D4D4D4] focus:outline-none cursor-pointer">
              ${[['list', 'Lista'], ['kanban', 'Kanban'], ['gantt', 'Gantt'], ['day', 'Día'], ['week', 'Semana'], ['month', 'Mes']].map(([v, l]) => `<option value="${v}" ${userProfile.defaultView === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
        </div>

        <div class="pt-1 border-t border-obsidian-border space-y-1.5">
          <div class="text-[9.5px] uppercase tracking-[0.08em] text-[#8C8C8C]">Notificaciones</div>
          <label class="flex items-center justify-between gap-2 text-[#D4D4D4] cursor-pointer">
            <span>Alertas por WhatsApp (urgentes y vencimientos)</span>
            <input id="um-notif-wa" type="checkbox" ${userProfile.notifyWhatsapp ? 'checked' : ''} class="accent-amber-500 rounded cursor-pointer" />
          </label>
          <label class="flex items-center justify-between gap-2 text-[#D4D4D4] cursor-pointer">
            <span>Resumen diario por correo</span>
            <input id="um-notif-email" type="checkbox" ${userProfile.notifyEmail ? 'checked' : ''} class="accent-amber-500 rounded cursor-pointer" />
          </label>
        </div>

        <div class="pt-2 border-t border-obsidian-border flex items-center justify-end gap-2">
          <button type="button" data-close-umodal class="h-7 px-3 rounded-lg bg-[#191919] hover:bg-obsidian-elevated border border-obsidian-border text-[#8C8C8C] hover:text-[#D4D4D4] cursor-pointer">Cancelar</button>
          <button type="submit" class="h-7 px-3.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-obsidian-amber font-medium cursor-pointer">Guardar cambios</button>
        </div>
      </form>
    </div>
  `;

  host.classList.remove('hidden');
  host.querySelectorAll('[data-close-umodal]').forEach((b) => {
    b.addEventListener('click', () => host.classList.add('hidden'));
  });

  host.querySelector('#um-profile-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    userProfile.fullName = host.querySelector('#um-fullname').value.trim() || userProfile.fullName;
    userProfile.shortName = host.querySelector('#um-shortname').value.trim() || userProfile.shortName;
    userProfile.email = host.querySelector('#um-email').value.trim() || userProfile.email;
    userProfile.defaultView = host.querySelector('#um-default-view').value;
    userProfile.notifyWhatsapp = host.querySelector('#um-notif-wa').checked;
    userProfile.notifyEmail = host.querySelector('#um-notif-email').checked;

    const hrs = Math.max(1, Math.min(16, Number(host.querySelector('#um-hours').value) || 8));
    userProfile.dailyHours = hrs;
    studioSettings.dailyHours = hrs;
    sketchState.myOtsMember = userProfile.shortName;
    sketchState.myOtsMode = userProfile.defaultView;

    syncUserHeaderUi();
    host.classList.add('hidden');
    notifySketchChange('settings');
    notifySketchChange('orders', { filter: sketchState.trafficFilter });
  });
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
        <button type="button" data-close-umodal class="w-6 h-6 rounded hover:bg-obsidian-elevated text-[#8C8C8C] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer">×</button>
      </div>
      <div class="p-2 space-y-1">
        ${userAccounts.map((acc, idx) => {
          const isCurrent = acc.shortName === sketchState.myOtsMember;
          return `
            <button type="button" data-pick-account="${idx}" class="w-full px-2.5 py-2 rounded-lg ${isCurrent ? 'bg-obsidian-elevated border border-obsidian-borderActive' : 'hover:bg-obsidian-elevated/70 border border-transparent'} flex items-center justify-between gap-2 text-left transition-colors cursor-pointer">
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="w-7 h-7 rounded-md bg-amber-500/15 text-obsidian-amber font-mono font-semibold text-[10px] flex items-center justify-center shrink-0">${escapeHtml(getInitials(acc.fullName))}</span>
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
      Object.assign(userProfile, acc);
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
