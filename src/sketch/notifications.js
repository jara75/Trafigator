/**
 * Global User Notifications & Messages Popover (#notifications-popover)
 * Powered by #btn-work-notifications (bell) and #btn-user-reviews (messages)
 * in the top-right user bar of #pane-right.
 */

import {
  ensureOtData,
  escapeHtml,
  getClientColor,
  notifySketchChange,
  onSketchChange,
  sketchState,
  trafficOrders,
} from './store.js';

let initialized = false;
let activeFilter = 'all'; // 'all' | 'traffic' | 'messages' | 'review'
let isOpen = false;

const userNotifications = [
  {
    id: 'n-1',
    type: 'messages',
    priority: 'urgent',
    otId: 'OT-26-001',
    client: 'Shambhala Ecohotel',
    actor: 'Camila',
    channel: 'App',
    at: 'Hoy 14:20',
    title: 'Alerta Urgente en OT-26-001',
    text: 'Urgente llamar al cliente para confirmar aprobación antes de las 4pm.',
    unread: true,
  },
  {
    id: 'n-2',
    type: 'traffic',
    priority: 'important',
    otId: 'OT-26-005',
    client: 'Café Origen',
    actor: 'Camila',
    channel: 'Tráfico',
    at: 'Hoy 11:05',
    title: 'Nueva OT asignada · OT-26-005',
    text: 'Traficada a Producción (Empaque 340g). Pendiente acusar recibido.',
    unread: true,
  },
  {
    id: 'n-3',
    type: 'review',
    priority: 'important',
    otId: 'OT-26-001',
    pieceName: 'Boceto_Principal.png',
    client: 'Shambhala Ecohotel',
    actor: 'Cliente',
    channel: 'Revisión',
    at: 'Hoy 10:42',
    title: '2 pines nuevos en Boceto_Principal.png',
    text: '«Ajustar contraste del titular y subir un poco el logo en esquina.»',
    unread: true,
  },
  {
    id: 'n-4',
    type: 'messages',
    priority: 'important',
    otId: 'OT-26-009',
    client: 'Club Premium',
    actor: 'Sofía',
    channel: 'WhatsApp',
    at: 'Hoy 09:50',
    title: 'Mensaje por WhatsApp · OT-26-009',
    text: 'Enviar medidas definitivas al impresor hoy para prueba de barniz UV.',
    unread: true,
  },
  {
    id: 'n-5',
    type: 'traffic',
    priority: 'info',
    otId: 'OT-26-013',
    client: 'Shambhala Ecohotel',
    actor: 'Mateo',
    channel: 'Tráfico',
    at: 'Ayer 17:15',
    title: 'Entrega mañana · OT-26-013',
    text: 'Banner Hero Web (Puente Festivo) vence mañana a las 14:00.',
    unread: false,
  },
];

function getPriorityDotClass(priority) {
  if (priority === 'urgent') return 'bg-rose-500';
  if (priority === 'important') return 'bg-amber-400';
  return 'bg-sky-400';
}

function getTypeBadgeHtml(n) {
  if (n.type === 'review') {
    return '<span class="px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 text-[8.5px] font-mono">Revisión</span>';
  }
  if (n.type === 'traffic') {
    return '<span class="px-1.5 py-0.5 rounded bg-amber-500/15 text-obsidian-amber text-[8.5px] font-mono">Tráfico</span>';
  }
  if (n.channel === 'WhatsApp') {
    return '<span class="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 text-[8.5px] font-mono">WhatsApp</span>';
  }
  return '<span class="px-1.5 py-0.5 rounded bg-sky-500/15 text-obsidian-cyan text-[8.5px] font-mono">Mensaje</span>';
}

function updateBadges() {
  const unreadAll = userNotifications.filter((n) => n.unread);
  const unreadMsgs = unreadAll.filter((n) => n.type === 'messages');
  const hasUrgent = unreadAll.some((n) => n.priority === 'urgent');

  const bellBadge = document.getElementById('notif-bell-badge');
  if (bellBadge) {
    if (unreadAll.length > 0) {
      bellBadge.textContent = unreadAll.length > 9 ? '9+' : String(unreadAll.length);
      bellBadge.className = `absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full ${
        hasUrgent ? 'bg-rose-500 text-white' : 'bg-obsidian-amber text-[#191919]'
      } text-[8.5px] font-mono font-bold flex items-center justify-center leading-none pointer-events-none`;
    } else {
      bellBadge.className = 'hidden';
    }
  }

  const msgBadge = document.getElementById('notif-msg-badge');
  if (msgBadge) {
    if (unreadMsgs.length > 0) {
      msgBadge.textContent = unreadMsgs.length > 9 ? '9+' : String(unreadMsgs.length);
      msgBadge.className = 'absolute -top-0.5 -right-0.5 min-w-[14px] h-[14px] px-1 rounded-full bg-obsidian-cyan text-[#191919] text-[8.5px] font-mono font-bold flex items-center justify-center leading-none pointer-events-none';
    } else {
      msgBadge.className = 'hidden';
    }
  }
}

function closePopover() {
  isOpen = false;
  document.getElementById('notifications-popover')?.classList.add('hidden');
}

function openNotificationTarget(n) {
  n.unread = false;
  updateBadges();
  closePopover();

  if (n.type === 'review') {
    const ot = trafficOrders.find((o) => o.id === n.otId);
    if (ot) ensureOtData(ot);
    const piece = ot?.mediaFiles?.find((p) => p.name === n.pieceName) || ot?.mediaFiles?.[0] || { name: n.pieceName || 'Pieza' };
    notifySketchChange('open-review', { piece });
    return;
  }

  if (n.otId) {
    sketchState.inspectorTab = n.type === 'messages' ? 'messages' : 'activity';
    notifySketchChange('open-ot', { otId: n.otId, scope: 'active' });
  }
}

function renderPopover() {
  const pop = document.getElementById('notifications-popover');
  if (!pop) return;

  const unreadCount = userNotifications.filter((n) => n.unread).length;
  const filtered = activeFilter === 'all'
    ? userNotifications
    : userNotifications.filter((n) => n.type === activeFilter);

  const tabs = [
    ['all', 'Todo', userNotifications.filter((n) => n.unread).length],
    ['traffic', 'Tráfico', userNotifications.filter((n) => n.unread && n.type === 'traffic').length],
    ['messages', 'Mensajes', userNotifications.filter((n) => n.unread && n.type === 'messages').length],
    ['review', 'Revisión', userNotifications.filter((n) => n.unread && n.type === 'review').length],
  ];

  pop.innerHTML = `
    <div class="px-2.5 py-2 border-b border-obsidian-border flex items-center justify-between gap-2">
      <div class="flex items-center gap-1.5 min-w-0">
        <span class="text-[11px] font-semibold text-[#D4D4D4] truncate">Notificaciones</span>
        ${unreadCount > 0 ? `<span class="px-1.5 py-0.5 rounded-full bg-obsidian-amber/20 text-obsidian-amber font-mono text-[9px] font-semibold">${unreadCount}</span>` : ''}
      </div>
      ${unreadCount > 0 ? `
        <button type="button" id="notif-mark-all-read" class="text-[9.5px] text-obsidian-cyan hover:underline cursor-pointer shrink-0">
          Marcar todo leído
        </button>
      ` : '<span class="text-[9.5px] text-[#737373]">Al día</span>'}
    </div>

    <div class="p-1.5 border-b border-obsidian-border">
      <div class="grid grid-cols-4 gap-0.5 bg-[#191919] border border-obsidian-border rounded-lg p-0.5 text-[9.5px]">
        ${tabs.map(([key, label, cnt]) => {
          const isAct = activeFilter === key;
          return `
            <button type="button" data-notif-filter="${key}"
              class="py-1 px-1 rounded-md transition-colors cursor-pointer flex items-center justify-center gap-1 ${isAct ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4]'}">
              <span class="truncate">${label}</span>
              ${cnt > 0 ? `<span class="font-mono text-[8px] ${isAct ? 'text-obsidian-amber' : 'text-[#737373]'}">${cnt}</span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
    </div>

    <div class="max-h-80 overflow-y-auto divide-y divide-obsidian-border/60">
      ${filtered.map((n) => {
        const cColor = getClientColor(n.client);
        return `
          <div data-notif-open="${escapeHtml(n.id)}"
            class="px-2.5 py-2 hover:bg-obsidian-elevated/60 transition-colors cursor-pointer ${n.unread ? 'bg-[#232323]' : 'opacity-70'}">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-1.5 min-w-0">
                <span class="w-1.5 h-1.5 rounded-full shrink-0 ${n.unread ? getPriorityDotClass(n.priority) : 'bg-[#555555]'}"></span>
                ${getTypeBadgeHtml(n)}
                <span class="font-mono text-[8.5px] text-[#8C8C8C] shrink-0">${escapeHtml(n.at)}</span>
              </div>
              <button type="button" data-notif-dismiss="${escapeHtml(n.id)}" title="Descartar"
                class="w-4 h-4 rounded hover:bg-obsidian-elevated text-[#737373] hover:text-[#D4D4D4] flex items-center justify-center cursor-pointer leading-none shrink-0">×</button>
            </div>
            <div class="mt-1 text-[10.5px] font-medium text-[#D4D4D4] leading-snug">${escapeHtml(n.title)}</div>
            <div class="mt-0.5 text-[10px] text-[#8C8C8C] leading-snug line-clamp-2">${escapeHtml(n.text)}</div>
            ${n.client ? `<div class="mt-1 text-[9px] font-medium truncate" style="color:${escapeHtml(cColor)}">${escapeHtml(n.client)}</div>` : ''}
          </div>
        `;
      }).join('') || `
        <div class="py-8 px-4 text-center text-[10.5px] text-[#8C8C8C]">
          Sin notificaciones en esta categoría.
        </div>
      `}
    </div>
  `;

  pop.querySelector('#notif-mark-all-read')?.addEventListener('click', (e) => {
    e.stopPropagation();
    userNotifications.forEach((n) => { n.unread = false; });
    updateBadges();
    renderPopover();
  });

  pop.querySelectorAll('[data-notif-filter]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      activeFilter = btn.dataset.notifFilter || 'all';
      renderPopover();
    });
  });

  pop.querySelectorAll('[data-notif-dismiss]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = userNotifications.findIndex((n) => n.id === btn.dataset.notifDismiss);
      if (idx !== -1) userNotifications.splice(idx, 1);
      updateBadges();
      renderPopover();
    });
  });

  pop.querySelectorAll('[data-notif-open]').forEach((row) => {
    row.addEventListener('click', () => {
      const target = userNotifications.find((n) => n.id === row.dataset.notifOpen);
      if (target) openNotificationTarget(target);
    });
  });
}

function togglePopover(filter = 'all') {
  const pop = document.getElementById('notifications-popover');
  if (!pop) return;
  document.getElementById('user-menu-popover')?.classList.add('hidden');
  if (isOpen && activeFilter === filter) {
    closePopover();
    return;
  }
  activeFilter = filter;
  isOpen = true;
  renderPopover();
  pop.classList.remove('hidden');
}

export function initNotifications() {
  if (initialized) return;
  initialized = true;

  updateBadges();

  document.getElementById('btn-work-notifications')?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('all');
  });

  document.getElementById('btn-user-reviews')?.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopover('messages');
  });

  document.getElementById('btn-user-menu')?.addEventListener('click', () => {
    closePopover();
  });

  document.addEventListener('click', (e) => {
    if (!isOpen) return;
    const pop = document.getElementById('notifications-popover');
    if (!pop) return;
    if (
      pop.contains(e.target) ||
      e.target.closest('#btn-work-notifications') ||
      e.target.closest('#btn-user-reviews')
    ) {
      return;
    }
    closePopover();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) closePopover();
  });

  onSketchChange('notifications', () => {
    updateBadges();
    if (isOpen) renderPopover();
  });
}
