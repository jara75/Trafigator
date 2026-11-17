import {
  clientsData,
  studioSettings,
  studioTeamList,
  trafficOrders,
  standaloneDocuments,
  standaloneDevFiles,
  sketchState,
  escapeHtml,
  syncTrafficMembers,
  notifySketchChange,
  onSketchChange,
} from './store.js';
import { openClientModal } from './client-modal.js';

const settingsTabLabels = {
  studio: 'Perfil del Estudio',
  team: 'Miembros del Equipo',
  clients: 'Clientes',
  billing: 'Membresía y Facturación',
  data: 'API Keys y Datos',
  prefs: 'Preferencias',
  help: 'Ayuda y Legal',
  products: 'Otros Productos',
};

/**
 * Open the unified Settings modal on the specified tab.
 */
export function openSettingsModal(tab = 'studio') {
  const settingsModal = document.getElementById('settings-modal');
  sketchState.activeSettingsTab = tab;
  if (settingsModal) settingsModal.classList.remove('hidden');
  renderSettingsTab();
}

/**
 * Close the unified Settings modal.
 */
export function closeSettingsModal() {
  const settingsModal = document.getElementById('settings-modal');
  if (settingsModal) settingsModal.classList.add('hidden');
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
  if (settingsTabTitle) settingsTabTitle.textContent = settingsTabLabels[activeTab] || 'Ajustes';

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
    settingsTabBody.innerHTML = `
      <div class="space-y-4">
        <div class="bg-[#202020] border border-obsidian-border rounded-xl p-4 space-y-3">
          <div class="text-[10px] uppercase tracking-wider text-[#8C8C8C] font-semibold">Identidad del Estudio</div>
          <div class="grid grid-cols-3 gap-3">
            <label class="col-span-2 block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Nombre del Estudio</span>
              <input id="st-studio-name" type="text" value="${escapeHtml(studioSettings.name)}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] focus:outline-none focus:border-[#3f3f3f]" />
            </label>
            <label class="block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Siglas</span>
              <input id="st-studio-initials" type="text" maxlength="3" value="${escapeHtml(studioSettings.initials)}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] font-mono uppercase focus:outline-none focus:border-[#3f3f3f]" />
            </label>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block space-y-1">
              <span class="text-[10px] text-[#8C8C8C]">Jornada diaria estándar (Stripboard)</span>
              <input id="st-studio-hours" type="number" min="4" max="14" value="${studioSettings.dailyHours}" class="w-full h-8 bg-[#191919] border border-obsidian-border rounded-lg px-2.5 text-[#D4D4D4] font-mono focus:outline-none focus:border-[#3f3f3f]" />
            </label>
            <div class="flex items-end justify-end">
              <button type="button" id="st-save-studio" class="h-8 px-3.5 rounded-lg bg-obsidian-amber hover:bg-amber-400 text-[#191919] font-semibold cursor-pointer transition-colors">Guardar Estudio</button>
            </div>
          </div>
        </div>
      </div>
    `;
    settingsTabBody.querySelector('#st-save-studio')?.addEventListener('click', () => {
      const n = settingsTabBody.querySelector('#st-studio-name')?.value.trim();
      const ini = settingsTabBody.querySelector('#st-studio-initials')?.value.trim().toUpperCase();
      const hrs = Number(settingsTabBody.querySelector('#st-studio-hours')?.value) || 8;
      if (n) studioSettings.name = n;
      if (ini) studioSettings.initials = ini;
      studioSettings.dailyHours = hrs;
      const fn = document.getElementById('studio-footer-name');
      const fi = document.getElementById('studio-footer-initials');
      if (fn) fn.textContent = studioSettings.name;
      if (fi) fi.textContent = studioSettings.initials;
      notifySketchChange('settings');
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

        <div class="border border-obsidian-border rounded-xl overflow-hidden bg-[#202020]">
          <table class="w-full text-left text-[10.5px] border-collapse">
            <thead>
              <tr class="bg-[#161616] border-b border-obsidian-border text-[9.5px] uppercase tracking-wider text-[#8C8C8C]">
                <th class="px-3 py-2">Miembro</th>
                <th class="px-3 py-2">Cargo</th>
                <th class="px-3 py-2">Acceso</th>
                <th class="px-3 py-2 text-center">Estado</th>
                <th class="px-3 py-2 w-16 text-right"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-obsidian-border">
              ${studioTeamList.map((m, idx) => `
                <tr class="hover:bg-obsidian-elevated/40">
                  <td class="px-3 py-2">
                    <div class="text-[#D4D4D4] font-medium">${escapeHtml(m.name)} ${m.isOwner ? '<span class="ml-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-obsidian-amber text-[9px] font-mono">Dueño</span>' : ''}</div>
                    <div class="text-[9.5px] text-[#8C8C8C]">${escapeHtml(m.email)}</div>
                  </td>
                  <td class="px-3 py-2 text-[#D4D4D4]">${escapeHtml(m.role)}</td>
                  <td class="px-3 py-2 text-[#8C8C8C]">${escapeHtml(m.scope)}</td>
                  <td class="px-3 py-2 text-center"><span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[9.5px]">${escapeHtml(m.status)}</span></td>
                  <td class="px-3 py-2 text-right">
                    ${m.isOwner ? '' : `<button type="button" data-st-remove-member="${idx}" class="text-[#8C8C8C] hover:text-rose-400 cursor-pointer">Quitar</button>`}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <form id="st-add-member-form" class="bg-[#202020] border border-obsidian-border rounded-xl p-3 flex flex-wrap items-end gap-2">
          <label class="flex-1 min-w-[130px] space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Nombre</span>
            <input id="st-m-name" type="text" required placeholder="Ej. Valentina" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-[#D4D4D4] focus:outline-none" />
          </label>
          <label class="flex-1 min-w-[150px] space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Correo</span>
            <input id="st-m-email" type="email" required placeholder="correo@estudio.com" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-[#D4D4D4] focus:outline-none" />
          </label>
          <label class="w-36 space-y-1">
            <span class="text-[9.5px] text-[#8C8C8C] uppercase">Cargo</span>
            <input id="st-m-role" type="text" value="Creativo" class="w-full h-7 bg-[#191919] border border-obsidian-border rounded px-2 text-[#D4D4D4] focus:outline-none" />
          </label>
          <button type="submit" ${usedSeats >= studioSettings.maxSeats ? 'disabled' : ''} class="h-7 px-3 rounded-lg bg-obsidian-amber hover:bg-amber-400 disabled:opacity-40 text-[#191919] font-semibold cursor-pointer">+ Invitar</button>
        </form>
      </div>
    `;
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
      const role = settingsTabBody.querySelector('#st-m-role')?.value.trim() || 'Creativo';
      if (!name || !email) return;
      studioTeamList.push({ name, email, role, scope: 'Todos los clientes', isOwner: false, status: 'Invitado' });
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
