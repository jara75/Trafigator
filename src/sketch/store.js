/**
 * Central in-memory store, shared state, event bus, and helpers for sketch-ot.
 */

export const escapeHtml = (str) =>
  String(str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]));

export const relDate = (offsetDays, timeStr = '09:00') => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${timeStr}`;
};

export function formatShortDate(iso) {
  if (!iso) return '';
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})/);
  return m ? `${m[3]}/${m[2]} ${m[4]}` : iso;
}

export function shiftIsoDate(dateStr, deltaDays) {
  const d = new Date(`${dateStr}T12:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Shared 3-level priority dot matching Escritorio: Urgente (rose), Vence hoy (amber), Vence mañana (sky).
 */
export function getPriorityDotHtml(item, todayKey = relDate(0).slice(0, 10), tomorrowKey = relDate(1).slice(0, 10), sizeCls = 'w-2 h-2') {
  if (!item) return '';
  if (item.urgent) {
    return `<span class="inline-block ${sizeCls} rounded-full bg-rose-500 shrink-0" title="Urgente"></span>`;
  }
  const dKey = (item.deliveryDate || '').slice(0, 10);
  if (dKey === todayKey) {
    return `<span class="inline-block ${sizeCls} rounded-full bg-amber-400 shrink-0" title="Vence hoy"></span>`;
  }
  if (dKey === tomorrowKey) {
    return `<span class="inline-block ${sizeCls} rounded-full bg-sky-400 shrink-0" title="Vence mañana"></span>`;
  }
  return '';
}

export const clientsData = [
  {
    name: 'Shambhala Ecohotel',
    color: '#34d399',
    brands: {
      'Ecohotel Boutique': ['Institucional', 'Habitaciones', 'Restaurante'],
      'Spa & Retiros': ['Institucional', 'Rituales', 'Retiros'],
    },
  },
  {
    name: 'Club Premium',
    color: '#38bdf8',
    brands: {
      'Club Premium': ['Institucional', 'Línea Retornable', 'Latas'],
      'Club Roja': ['Institucional', 'Edición Especial'],
    },
  },
  {
    name: 'Café Origen',
    color: '#a78bfa',
    brands: {
      'Tostión Media': ['Institucional', 'Molido 500g', 'Grano 1kg'],
      'Cold Brew': ['Institucional', 'Botella 300ml'],
    },
  },
];

export const getClientColor = (name) => clientsData.find((c) => c.name === name)?.color || '#8C8C8C';

export const studioSettings = {
  name: 'El Marcante',
  initials: 'EM',
  logoDataUrl: '',
  otPrefix: 'OT-26-',
  timezone: 'America/Bogota',
  dailyHours: 8,
  trialDaysLeft: 14,
  planName: 'Prueba Gratis (5 puestos · 14 días)',
  maxSeats: 5,
  apiKey: 'sk-trafikeitor-demo-••••••••••••',
  theme: 'dark',
  language: 'es'
};

export const studioRoles = ['Dueño', 'Admin / Tráfico', 'Cuentas', 'Operativo', 'Facturación'];
export const studioScopes = ['Estudio', 'Departamento', 'Propio'];

export const userAccounts = [
  { fullName: 'Andrés Jaramillo', shortName: 'Andrés', email: 'direccion@elmarcante.com', role: 'Dueño', scope: 'Todo el estudio', departments: ['Todos'], dailyHours: 8, color: '#f59e0b', avatarMode: 'initials', avatarIcon: 'compass', avatarImage: '' },
  { fullName: 'Camila Rojas', shortName: 'Camila', email: 'camila@elmarcante.com', role: 'Tráfico', scope: 'Todo el estudio', departments: ['Tráfico', 'Cuentas'], dailyHours: 8, color: '#38bdf8', avatarMode: 'initials', avatarIcon: 'zap', avatarImage: '' },
  { fullName: 'Mateo Silva', shortName: 'Mateo', email: 'mateo@elmarcante.com', role: 'Creativo', scope: 'Clientes asignados', departments: ['Creativos', 'Producción'], dailyHours: 8, color: '#a78bfa', avatarMode: 'initials', avatarIcon: 'palette', avatarImage: '' },
  { fullName: 'Sofía Pardo', shortName: 'Sofía', email: 'sofia@elmarcante.com', role: 'Producción', scope: 'Clientes asignados', departments: ['Producción', 'Medios'], dailyHours: 8, color: '#34d399', avatarMode: 'initials', avatarIcon: 'film', avatarImage: '' },
];

export const userProfile = {
  ...userAccounts[0],
  defaultView: 'kanban',
  notifyWhatsapp: true,
  notifyEmail: true,
};

export const studioTeamList = [
  { name: 'Andrés', email: 'direccion@elmarcante.com', role: 'Dueño', scope: 'Estudio', departments: ['Todos'], isOwner: true, status: 'Activo' },
  { name: 'Camila', email: 'camila@elmarcante.com', role: 'Admin / Tráfico', scope: 'Estudio', departments: ['Tráfico', 'Cuentas'], isOwner: false, status: 'Activo' },
  { name: 'Mateo', email: 'mateo@elmarcante.com', role: 'Operativo', scope: 'Departamento', departments: ['Creativos', 'Producción'], isOwner: false, status: 'Activo' },
  { name: 'Sofía', email: 'sofia@elmarcante.com', role: 'Operativo', scope: 'Propio', departments: ['Producción', 'Medios'], isOwner: false, status: 'Activo' }
];

export function syncMemberToUserAccount(member) {
  if (!member) return;
  const acc = userAccounts.find((a) => a.email === member.email || a.shortName === member.name);
  if (acc) {
    acc.role = member.role;
    acc.scope = member.scope;
    acc.departments = Array.isArray(member.departments) && member.departments.length ? [...member.departments] : ['Todos'];
    if (userProfile.email === acc.email || userProfile.shortName === acc.shortName) {
      userProfile.role = acc.role;
      userProfile.scope = acc.scope;
      userProfile.departments = [...acc.departments];
    }
  }
}

export const studioTagPalette = ['#34d399', '#38bdf8', '#f59e0b', '#a78bfa', '#fb7185', '#2dd4bf', '#fb923c', '#818cf8'];

export const studioProfiles = [
  {
    id: 'diseno-publicidad',
    name: 'Diseño / Publicidad',
    shortName: 'Publicidad',
    color: '#f59e0b',
    active: true,
    isBase: true,
    departments: ['Cuentas', 'Tráfico', 'Creativos', 'Producción', 'Medios', 'Cliente', 'Facturación'],
  },
  {
    id: 'diseno-branding',
    name: 'Diseño / Branding',
    shortName: 'Branding',
    color: '#f472b6',
    active: false,
    isBase: true,
    departments: ['Dirección', 'Estrategia', 'Identidad', 'Maquetación', 'Arte Final', 'Cliente', 'Facturación'],
  },
  {
    id: 'diseno-web',
    name: 'Diseño / Web',
    shortName: 'Web',
    color: '#2dd4bf',
    active: true,
    isBase: true,
    departments: ['Dirección', 'UX/UI', 'Maquetación', 'Contenido', 'Cliente', 'Facturación'],
  },
  {
    id: 'desarrollo-software',
    name: 'Desarrollo de Software',
    shortName: 'Software',
    color: '#38bdf8',
    active: true,
    isBase: true,
    departments: ['Product', 'Frontend', 'Backend', 'QA', 'DevOps', 'Cliente', 'Facturación'],
  },
  {
    id: 'productora-contenido',
    name: 'Productora / Contenido',
    shortName: 'Contenido',
    color: '#a78bfa',
    active: false,
    isBase: true,
    departments: ['Preproducción', 'Rodaje', 'Edición', 'Color/Audio', 'Cliente', 'Facturación'],
  },
];

export const trafficDepartments = ['Dirección', 'Cuentas', 'Tráfico', 'Creativos', 'Producción', 'Medios', 'UX/UI', 'Maquetación', 'Contenido', 'Product', 'Frontend', 'Backend', 'QA', 'DevOps', 'Cliente', 'Facturación'];

export function getActiveWorkspaces() {
  return studioProfiles.filter((p) => p.active);
}

export function getWorkspaceById(id) {
  return studioProfiles.find((p) => p.id === id) || null;
}

export function getDepartmentsForWorkspace(workspaceId) {
  if (!workspaceId || workspaceId === 'studio') {
    const active = getActiveWorkspaces();
    const source = active.length ? active : studioProfiles.slice(0, 1);
    return orderStudioDepartments(source.flatMap((p) => p.departments || []));
  }
  const ws = getWorkspaceById(workspaceId) || studioProfiles[0];
  return orderStudioDepartments(ws?.departments || []);
}

export function setActiveWorkspace(workspaceId) {
  const active = getActiveWorkspaces();
  let nextId = 'studio';
  if (workspaceId && workspaceId !== 'studio') {
    const found = active.find((p) => p.id === workspaceId);
    if (found) nextId = found.id;
  } else if (active.length === 1) {
    const hasInactiveOpen = trafficOrders.some((o) => !o.archived && o.workspaceId && o.workspaceId !== active[0].id);
    if (!hasInactiveOpen) nextId = active[0].id;
  }
  sketchState.activeWorkspaceId = nextId;
  if (sketchState.trafficDeptFilter !== 'all') {
    const validDepts = getDepartmentsForWorkspace(nextId);
    if (!validDepts.includes(sketchState.trafficDeptFilter)) {
      sketchState.trafficDeptFilter = 'all';
    }
  }
  notifySketchChange('workspace', { workspaceId: nextId });
}

export const departmentColors = {
  'Dirección': '#fbbf24',
  'Cuentas': '#38bdf8',
  'Tráfico': '#f59e0b',
  'Creativos': '#a78bfa',
  'Producción': '#fb923c',
  'Medios': '#818cf8',
  'Estrategia': '#60a5fa',
  'Identidad': '#f472b6',
  'Maquetación': '#c4b5fd',
  'Arte Final': '#fb7185',
  'UX/UI': '#2dd4bf',
  'Contenido': '#34d399',
  'Product': '#38bdf8',
  'Frontend': '#2dd4bf',
  'Backend': '#818cf8',
  'QA': '#a3e635',
  'DevOps': '#fb923c',
  'Preproducción': '#7dd3fc',
  'Rodaje': '#f43f5e',
  'Edición': '#8b5cf6',
  'Color/Audio': '#14b8a6',
  'Desarrollo': '#2dd4bf',
  'Cliente': '#34d399',
  'Facturación': '#fb7185',
};

const START_ANCHOR_DEPTS = ['Dirección', 'Cuentas', 'Tráfico'];
const END_ANCHOR_DEPTS = ['Cliente', 'Facturación'];

export function orderStudioDepartments(list) {
  const unique = [];
  (list || []).forEach((d) => {
    if (d && !unique.includes(d)) unique.push(d);
  });
  const start = START_ANCHOR_DEPTS.filter((d) => unique.includes(d));
  const end = END_ANCHOR_DEPTS.filter((d) => unique.includes(d));
  const middle = unique.filter((d) => !START_ANCHOR_DEPTS.includes(d) && !END_ANCHOR_DEPTS.includes(d));
  return [...start, ...middle, ...end];
}

export function syncStudioTaxonomyFromProfiles() {
  const activeProfiles = studioProfiles.filter((p) => p.active);
  const source = activeProfiles.length ? activeProfiles : studioProfiles.slice(0, 1);

  const rawDepts = [];
  source.forEach((p) => {
    (p.departments || []).forEach((d) => {
      if (d && !rawDepts.includes(d)) {
        rawDepts.push(d);
        if (!departmentColors[d]) {
          departmentColors[d] = studioTagPalette[rawDepts.length % studioTagPalette.length];
        }
      }
    });
  });
  const ordered = orderStudioDepartments(rawDepts);
  trafficDepartments.splice(0, trafficDepartments.length, ...ordered);
}

export const defaultTrafficStatuses = ['Activa', 'En proceso', 'Suspendida', 'Cancelada', 'Archivada'];

export const trafficStatuses = ['Activa', 'En proceso', 'Suspendida', 'Cancelada', 'Archivada'];

export const statusColors = {
  'Activa': '#38bdf8',
  'En proceso': '#34d399',
  'Suspendida': '#f59e0b',
  'Cancelada': '#fb7185',
  'Archivada': '#8C8C8C'
};

export const defaultTrafficStages = ['Tráfico', 'Recibida', 'Cerrar OT y Facturar', 'Facturada', 'Pagada'];

export const trafficStages = ['Tráfico', 'Recibida', 'Cerrar OT y Facturar', 'Facturada', 'Pagada'];

export const stageColors = {
  'Tráfico': '#38bdf8',
  'Recibida': '#a78bfa',
  'Cerrar OT y Facturar': '#f59e0b',
  'Facturada': '#eab308',
  'Pagada': '#34d399'
};

export const getDepartmentColor = (name) => departmentColors[name] || '#8C8C8C';
export const getStageColor = (name) => stageColors[name] || '#8C8C8C';
export const getStatusColor = (name) => statusColors[name] || '#8C8C8C';

/**
 * Attach Excel-like independent column resizers to any table with `.traffic-col-resizer` handles.
 */
export function bindTableColResizers(tableEl) {
  if (!tableEl) return;
  tableEl.querySelectorAll('.traffic-col-resizer').forEach((handle) => {
    if (handle.dataset.resizerBound === '1') return;
    handle.dataset.resizerBound = '1';
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const th = handle.parentElement;
      if (!th) return;
      const headerRow = th.parentElement;
      const allThs = headerRow ? Array.from(headerRow.children) : [];

      // Freeze current pixel widths on all columns so resizing one never shifts the others
      allThs.forEach((col) => {
        const w = Math.round(col.getBoundingClientRect().width);
        col.style.width = `${w}px`;
        col.style.minWidth = `${w}px`;
      });

      const startX = e.clientX;
      const startColW = Math.round(th.getBoundingClientRect().width);
      const startTableW = Math.round(tableEl.getBoundingClientRect().width);

      tableEl.classList.remove('w-full');
      tableEl.style.tableLayout = 'fixed';
      tableEl.style.minWidth = '0px';
      tableEl.style.width = `${startTableW}px`;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      handle.classList.add('bg-obsidian-cyan');

      const onMove = (ev) => {
        const nextColW = Math.max(36, Math.round(startColW + (ev.clientX - startX)));
        const delta = nextColW - startColW;
        th.style.width = `${nextColW}px`;
        th.style.minWidth = `${nextColW}px`;
        tableEl.style.width = `${Math.max(200, startTableW + delta)}px`;
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

export const trafficMembers = ['Camila', 'Mateo', 'Sofía', 'Andrés', 'Valentina', 'Sebastián', 'Lucía', 'Daniel'];

/**
 * Keep trafficMembers synchronized with studioTeamList when members are invited or removed in Settings.
 */
export function syncTrafficMembers(removedName = null) {
  if (removedName) {
    const idx = trafficMembers.indexOf(removedName);
    if (idx !== -1) trafficMembers.splice(idx, 1);
  }
  studioTeamList.forEach((m) => {
    if (!m.isOwner && m.name && !trafficMembers.includes(m.name)) {
      trafficMembers.push(m.name);
    }
  });
}

export const trafficOrders = [
  { id: 'OT-26-001', workspaceId: 'diseno-publicidad', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Alojamiento', media: 'IG Carousel 1080x1350', ref: 'Temporada Verde', title: 'Campaña lanzamiento temporada baja y escapadas', entryDate: relDate(-5, '09:00'), deliveryDate: relDate(3, '17:00'), department: 'Creativos', status: 'En proceso', responsible: 'Andrés', notes: 'Esperando fotos finales de cabañas', urgent: true },
  { id: 'OT-26-002', workspaceId: 'diseno-web', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Retiro Detox', media: 'Landing + Reel 9:16', ref: 'Equilibrio 2026', title: 'Piezas digitales para retiro de fin de semana', entryDate: relDate(-4, '10:30'), deliveryDate: relDate(4, '12:00'), department: 'Contenido', status: 'En proceso', responsible: 'Camila', notes: 'Revisar copy de itinerario', urgent: false },
  { id: 'OT-26-003', workspaceId: 'diseno-web', client: 'Club Premium', brand: 'Club Premium', product: 'Institucional', media: 'Email + Banner Web', ref: 'Black Benefits', title: 'Actualización beneficios Q4 para socios Black', entryDate: relDate(-2, '08:45'), deliveryDate: relDate(3, '18:00'), department: 'Cliente', status: 'En proceso', responsible: 'Mateo', notes: 'Enviado a aprobación de gerencia', urgent: false },
  { id: 'OT-26-004', workspaceId: 'diseno-publicidad', client: 'Club Premium', brand: 'Club Premium', product: 'Eventos', media: 'Impreso + Invitación Digital', ref: 'Noche Dorada', title: 'Invitación VIP y señalética del salón principal', entryDate: relDate(-1, '14:15'), deliveryDate: relDate(5, '16:00'), department: 'Tráfico', status: 'En proceso', responsible: 'Sofía', notes: 'Cotizar papel texturizado', urgent: true },
  { id: 'OT-26-005', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Tostión Media', product: 'Empaque 340g', media: 'Troquel + Arte Final', ref: 'Sierra Nevada', title: 'Ajuste tabla nutricional y código de barras', entryDate: relDate(0, '11:00'), deliveryDate: relDate(0, '15:00'), department: 'Producción', status: 'En proceso', responsible: 'Andrés', notes: 'Validar Pantone dorado', urgent: false },
  { id: 'OT-26-006', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Cold Brew', product: 'Botella 300ml', media: 'Pauta Meta Ads', ref: 'Verano Frío', title: 'Adaptaciones 3 formatos para pauta pagada', entryDate: relDate(0, '09:20'), deliveryDate: relDate(0, '17:00'), department: 'Medios', status: 'En proceso', responsible: 'Camila', notes: 'Listo para pauta lunes', urgent: false },
  { id: 'OT-26-007', workspaceId: 'diseno-publicidad', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Restaurante', media: 'Video Reel 9:16', ref: 'Amanecer Bosque', title: 'Edición reel experiencia desayuno en terraza', entryDate: relDate(-6, '09:10'), deliveryDate: relDate(3, '16:00'), department: 'Creativos', status: 'En proceso', responsible: 'Mateo', notes: 'Falta colorización final', urgent: false },
  { id: 'OT-26-008', workspaceId: 'diseno-web', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Rituales', media: 'Brochure PDF', ref: 'Carta Masajes', title: 'Diagramación menú de terapias y precios 2026', entryDate: relDate(-5, '15:20'), deliveryDate: relDate(5, '18:00'), department: 'Maquetación', status: 'En proceso', responsible: 'Sofía', notes: 'En revisión con dirección', urgent: false },
  { id: 'OT-26-009', workspaceId: 'diseno-publicidad', client: 'Club Premium', brand: 'Club Roja', product: 'Edición Especial', media: 'Impreso Offset', ref: 'Welcome Box', title: 'Caja rígida y tarjeta personalizada nuevos socios', entryDate: relDate(-4, '11:00'), deliveryDate: relDate(6, '12:00'), department: 'Producción', status: 'En proceso', responsible: 'Andrés', notes: 'Prueba de barniz UV pendiente', urgent: true },
  { id: 'OT-26-010', workspaceId: 'diseno-publicidad', client: 'Club Premium', brand: 'Club Premium', product: 'Eventos', media: 'Pendones + Backing', ref: 'Copa Otoño', title: 'Señalética de hoyos y backing premiación', entryDate: relDate(-3, '16:40'), deliveryDate: relDate(7, '10:00'), department: 'Tráfico', status: 'En proceso', responsible: 'Camila', notes: 'Confirmar medidas con club', urgent: false },
  { id: 'OT-26-011', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Tostión Media', product: 'Molido 500g', media: 'Post + Stories IG', ref: 'Cosecha Altura', title: 'Carrusel educativo proceso de lavado', entryDate: relDate(-3, '08:30'), deliveryDate: relDate(4, '17:00'), department: 'Cuentas', status: 'En proceso', responsible: 'Mateo', notes: 'Textos aprobados por marca', urgent: false },
  { id: 'OT-26-012', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Cold Brew', product: 'Lata 250ml', media: 'Render 3D', ref: 'Pack x4', title: 'Renders de producto sobre hielo para e-commerce', entryDate: relDate(-2, '13:15'), deliveryDate: relDate(5, '19:00'), department: 'Creativos', status: 'En proceso', responsible: 'Sofía', notes: 'Ajustar reflejos metálicos', urgent: true },
  { id: 'OT-26-013', workspaceId: 'diseno-web', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Habitaciones', media: 'Banner Hero Web', ref: 'Puente Festivo', title: 'Actualización banner principal tarifa especial', entryDate: relDate(-2, '10:00'), deliveryDate: relDate(1, '14:00'), department: 'UX/UI', status: 'En proceso', responsible: 'Andrés', notes: 'Subir versión desktop y móvil', urgent: false },
  { id: 'OT-26-014', workspaceId: 'desarrollo-software', client: 'Club Premium', brand: 'Club Premium', product: 'App Socios', media: 'UI Pantalla', ref: 'Concierge 2.0', title: 'Flujo de reserva prioritaria en restaurantes', entryDate: relDate(-2, '17:00'), deliveryDate: relDate(1, '18:00'), department: 'Backend', status: 'En proceso', responsible: 'Camila', notes: 'Validar endpoints con backend', urgent: false },
  { id: 'OT-26-015', workspaceId: 'diseno-web', client: 'Café Origen', brand: 'Tostión Media', product: 'Grano 1kg', media: 'Email Marketing', ref: 'Club Grano', title: 'Newsletter mensual recomendación del barista', entryDate: relDate(-1, '09:45'), deliveryDate: relDate(6, '11:00'), department: 'Contenido', status: 'En proceso', responsible: 'Mateo', notes: 'Pendiente asunto A/B test', urgent: false },
  { id: 'OT-26-016', workspaceId: 'diseno-publicidad', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Retiros', media: 'Pauta Google Ads', ref: 'Search Bienestar', title: 'Copies y extensiones campaña de búsqueda', entryDate: relDate(-1, '11:30'), deliveryDate: relDate(5, '16:00'), department: 'Medios', status: 'En proceso', responsible: 'Sofía', notes: 'Definir presupuesto diario', urgent: false },
  { id: 'OT-26-017', workspaceId: 'diseno-publicidad', client: 'Club Premium', brand: 'Club Roja', product: 'Eventos', media: 'Invitación WhatsApp', ref: 'Reserva Cava', title: 'Pieza vertical animada para envío a VIPs', entryDate: relDate(-1, '15:00'), deliveryDate: relDate(7, '18:30'), department: 'Creativos', status: 'En proceso', responsible: 'Andrés', notes: 'Enviado archivo MP4 liviano', urgent: false },
  { id: 'OT-26-018', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Cold Brew', product: 'Activación POP', media: 'Hablador + Cenefa', ref: 'Tiendas Gourmet', title: 'Material punto de venta neveras exhibidoras', entryDate: relDate(-1, '16:20'), deliveryDate: relDate(9, '17:00'), department: 'Producción', status: 'En proceso', responsible: 'Camila', notes: 'Troquel estándar 15x20cm', urgent: false },
  { id: 'OT-26-019', workspaceId: 'desarrollo-software', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Eventos', media: 'Dossier Corporativo', ref: 'Eventos Empresa', title: 'Módulo cotizador de salones para retiros corporativos', entryDate: relDate(0, '08:15'), deliveryDate: relDate(10, '17:00'), department: 'Product', status: 'En proceso', responsible: 'Mateo', notes: 'Recopilar planos de capacidad', urgent: false },
  { id: 'OT-26-020', workspaceId: 'diseno-web', client: 'Club Premium', brand: 'Club Premium', product: 'Institucional', media: 'Landing Page', ref: 'Alianza Aerolíneas', title: 'Maquetación página beneficios salas VIP', entryDate: relDate(0, '09:50'), deliveryDate: relDate(6, '18:00'), department: 'Maquetación', status: 'En proceso', responsible: 'Sofía', notes: 'Integrar formulario de registro', urgent: false },
  { id: 'OT-26-021', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Tostión Media', product: 'Empaque 340g', media: 'Etiqueta Adhesiva', ref: 'Edición Microlote', title: 'Diseño sello numerado cosecha limitada', entryDate: relDate(0, '10:40'), deliveryDate: relDate(4, '15:00'), department: 'Creativos', status: 'En proceso', responsible: 'Andrés', notes: 'Usar papel kraft texturizado', urgent: true },
  { id: 'OT-26-022', workspaceId: 'diseno-publicidad', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Retiros', media: 'Reel + Carrusel', ref: 'Sonoterapia', title: 'Cobertura sesión de cuencos y edición rápida', entryDate: relDate(0, '12:00'), deliveryDate: relDate(5, '17:00'), department: 'Producción', status: 'En proceso', responsible: 'Camila', notes: 'Grabación programada sábado', urgent: false },
  { id: 'OT-26-023', workspaceId: 'desarrollo-software', client: 'Club Premium', brand: 'Club Premium', product: 'Eventos', media: 'Registro QR Web', ref: 'Check-in Gala', title: 'Sistema de confirmación y código QR invitados', entryDate: relDate(0, '14:00'), deliveryDate: relDate(8, '12:00'), department: 'Frontend', status: 'En proceso', responsible: 'Mateo', notes: 'Probar lectura en tablet puerta', urgent: false },
  { id: 'OT-26-024', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Cold Brew', product: 'Botella 300ml', media: 'Pauta TikTok', ref: 'Receta Tonic', title: 'Video tutorial 15s preparación Cold Brew Tonic', entryDate: relDate(0, '15:10'), deliveryDate: relDate(7, '16:00'), department: 'Tráfico', status: 'En proceso', responsible: 'Sofía', notes: 'Revisar música sin copyright', urgent: false },
  { id: 'OT-26-025', workspaceId: 'diseno-publicidad', client: 'Shambhala Ecohotel', brand: 'Shambhala Ecohotel', product: 'Institucional', media: 'Facturación Cierre', ref: 'Fee Noviembre', title: 'Consolidado horas y entregables mes actual', entryDate: relDate(-7, '09:00'), deliveryDate: relDate(9, '17:00'), department: 'Facturación', status: 'En proceso', responsible: 'Andrés', notes: 'Adjuntar orden de compra', urgent: false },
  { id: 'OT-26-026', workspaceId: 'diseno-publicidad', client: 'Club Premium', brand: 'Club Premium', product: 'Institucional', media: 'Reporte Mensual', ref: 'KPIs Octubre', title: 'Informe resultados pauta y aperturas email', entryDate: relDate(-8, '10:00'), deliveryDate: relDate(0, '14:00'), department: 'Cuentas', status: 'Archivada', responsible: 'Camila', notes: 'Presentado en comité', urgent: false, archived: true },
  { id: 'OT-25-118', workspaceId: 'diseno-publicidad', client: 'Café Origen', brand: 'Tostión Media', product: 'Lanzamiento', media: 'Campaña Integral', ref: 'Cosecha 2025', title: 'Cierre campaña anual origen y empaques', entryDate: relDate(-45, '09:00'), deliveryDate: relDate(-20, '18:00'), department: 'Cuentas', status: 'Archivada', responsible: 'Andrés', notes: 'Archivada tras aprobación final', urgent: false, archived: true }
];

export const standaloneDocuments = [
  { name: 'Manual_Marca_Shambhala_2026.pdf', meta: 'PDF · 4.2 MB · v3', client: 'Shambhala Ecohotel', brand: 'Alojamiento', dateOrder: 10 },
  { name: 'Presupuesto_Q4_Spa.xlsx', meta: 'XLSX · 340 KB · v2', client: 'Shambhala Ecohotel', brand: 'Spa', dateOrder: 9 },
  { name: 'Brief_General_Festival.docx', meta: 'DOCX · 1.1 MB · v1', client: 'Cámara Lúcida', brand: 'Festival', dateOrder: 8 },
  { name: 'Escaleta_Ponencias.pages', meta: 'PAGES · 820 KB · v2', client: 'Cámara Lúcida', brand: 'Festival', dateOrder: 7 },
  { name: 'Ficha_Ingredientes_Serum.pdf', meta: 'PDF · 2.5 MB · v4', client: 'Botánica Lab', brand: 'Cuidado Facial', dateOrder: 6 },
  { name: 'Inventario_SKUs_2026.csv', meta: 'CSV · 120 KB · v1', client: 'Botánica Lab', brand: 'Cuidado Facial', dateOrder: 5 },
  { name: 'Notas_Estilo_Editorial.md', meta: 'MD · 48 KB · v2', client: 'Editorial Ícaro', brand: 'Colección Norte', dateOrder: 4 },
  { name: 'Contrato_Distribucion_Norte.txt', meta: 'TXT · 32 KB · v1', client: 'Editorial Ícaro', brand: 'Colección Norte', dateOrder: 3 },
  { name: 'Proyeccion_Ventas_2026.numbers', meta: 'NUMBERS · 610 KB · v3', client: 'Shambhala Ecohotel', brand: 'Alojamiento', dateOrder: 2 }
];

export const standaloneDevFiles = [
  { name: 'landing_shambhala_hero.html', meta: 'HTML · 18 KB · v2', client: 'Shambhala Ecohotel', brand: 'Alojamiento', dateOrder: 10 },
  { name: 'booking_widget_styles.css', meta: 'CSS · 24 KB · v3', client: 'Shambhala Ecohotel', brand: 'Alojamiento', dateOrder: 9 },
  { name: 'spa_reservation_flow.ts', meta: 'TS · 14 KB · v1', client: 'Shambhala Ecohotel', brand: 'Spa', dateOrder: 8 },
  { name: 'festival_schedule_api.json', meta: 'JSON · 42 KB · v2', client: 'Cámara Lúcida', brand: 'Festival', dateOrder: 7 },
  { name: 'lightbox_gallery_player.js', meta: 'JS · 19 KB · v4', client: 'Cámara Lúcida', brand: 'Festival', dateOrder: 6 },
  { name: 'skin_quiz_logic.ts', meta: 'TS · 27 KB · v2', client: 'Botánica Lab', brand: 'Cuidado Facial', dateOrder: 5 },
  { name: 'checkout_bundle_config.json', meta: 'JSON · 9 KB · v1', client: 'Botánica Lab', brand: 'Cuidado Facial', dateOrder: 4 },
  { name: 'reader_typography_tokens.css', meta: 'CSS · 15 KB · v3', client: 'Editorial Ícaro', brand: 'Colección Norte', dateOrder: 3 },
  { name: 'catalog_search_index.js', meta: 'JS · 31 KB · v2', client: 'Editorial Ícaro', brand: 'Colección Norte', dateOrder: 2 }
];

export const sketchState = {
  // Navigation & shell
  lastOpenLeftW: 210,

  // Client modal & New OT selectors
  selectedClientName: null,
  selectedBrandName: null,
  editingClientName: null,

  // Settings modal
  activeSettingsTab: 'studio',

  // Traffic view
  trafficScope: 'active',
  trafficViewMode: 'list',
  ganttScale: 'week',
  trafficScheduleDate: relDate(0).slice(0, 10),
  trafficFilter: { type: 'all', client: null, brand: null },
  trafficSearchQuery: '',
  trafficGroupBy: 'client',
  trafficSortBy: 'newest',
  trafficDateFilter: 'all',
  trafficDeptFilter: 'all',
  trafficStageFilter: 'all',
  trafficStatusFilter: 'all',
  trafficRespFilter: 'all',
  collapsedTrafficClients: new Set(),
  collapsedTrafficGroups: new Set(),
  trafficGroupsSeeded: false,
  expandedTrafficOts: new Set(),

  // OT detail / My OTs view
  myOtsMode: 'kanban',
  myOtsLastCollectionMode: 'kanban',
  myOtsGroupBy: 'stage',
  myOtsMember: 'Andrés',
  activeMyOtId: null,
  myOtsScope: 'active',
  activeTaskIndex: null,
  activeRouteIndex: null,
  inspectorTab: 'detail',
  inspectorAlertsExpanded: false,
  inspectorComposerPriority: null,
  routesCollapsed: false,
  galleryCollapsed: false,

  // Gallery & preview
  activePieceIndex: null,
  galleryViewMode: 'grid',
  gallerySearch: '',
  galleryTypeFilter: 'all',
  galleryTaskFilter: 'all',
  gallerySort: 'recent',
  galleryFilterOpen: false,
  galleryPage: 1,
  previewRotation: 0,
  previewFlipH: false,
  previewFlipV: false,
  previewZoom: 1,
  previewLightbox: false,
  videoPlaying: false,
  videoMuted: false,
  videoLoop: false,
  videoSpeed: 1,
  videoProgress: 27,
  docPage: 1,
  docCopied: false,
  docHighlight: null,
  codeWrap: true,
  codeLines: true,
  codeRenderPreview: false,
  selectedPieces: new Set(),

  // Active Workspace ('studio' = global Estudio, or one of studioProfiles[].id)
  activeWorkspaceId: 'studio',

  // Stripboard / My Tasks view
  stripboardDate: relDate(0).slice(0, 10),
  stripboardViewMode: 'list',
  stripboardStatusFilter: 'all',
  stripboardSearch: '',
  stripboardGroupBy: 'none',
  stripboardSortBy: 'manual',
  stripboardListItems: null,
  stripboardStripsByDate: {},
};

const sketchListeners = new Map();

/**
 * Subscribe a handler to a store channel ('orders', 'clients', 'team', 'stripboard', 'gallery', 'settings').
 * Returns an unsubscribe function.
 */
export function onSketchChange(topic, fn) {
  if (!sketchListeners.has(topic)) {
    sketchListeners.set(topic, new Set());
  }
  const listeners = sketchListeners.get(topic);
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/**
 * Emit a change event on a store channel.
 */
const MAX_ORDER_HISTORY = 20;
let orderHistoryStack = [];
let orderHistoryIndex = -1;
let isApplyingOrderHistory = false;

function ensureOrderHistorySeeded() {
  if (orderHistoryStack.length === 0) {
    orderHistoryStack.push(JSON.stringify(trafficOrders));
    orderHistoryIndex = 0;
  }
}

export function canUndoOrders() {
  ensureOrderHistorySeeded();
  return orderHistoryIndex > 0;
}

export function canRedoOrders() {
  ensureOrderHistorySeeded();
  return orderHistoryIndex < orderHistoryStack.length - 1;
}

function applyOrderSnapshot(snapStr) {
  const parsed = JSON.parse(snapStr);
  isApplyingOrderHistory = true;
  try {
    trafficOrders.splice(0, trafficOrders.length, ...parsed);
    notifySketchChange('orders', { fromHistory: true });
    notifySketchChange('history', { canUndo: canUndoOrders(), canRedo: canRedoOrders() });
  } finally {
    isApplyingOrderHistory = false;
  }
}

export function undoOrders() {
  if (!canUndoOrders()) return false;
  orderHistoryIndex -= 1;
  applyOrderSnapshot(orderHistoryStack[orderHistoryIndex]);
  return true;
}

export function redoOrders() {
  if (!canRedoOrders()) return false;
  orderHistoryIndex += 1;
  applyOrderSnapshot(orderHistoryStack[orderHistoryIndex]);
  return true;
}

function formatNowDisplay() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${min}`;
}

export function recordOtActivity(otOrId, text, actor = sketchState.myOtsMember || 'Andrés') {
  const ot = typeof otOrId === 'string' ? trafficOrders.find((o) => o.id === otOrId) : otOrId;
  if (!ot || !text) return;
  if (!Array.isArray(ot.activityLog)) ot.activityLog = [];
  ot.activityLog.unshift({
    at: formatNowDisplay(),
    actor: actor || 'Estudio',
    text,
  });
  if (ot.activityLog.length > 50) ot.activityLog.length = 50;
}

export function appendOtMessage(otOrId, { text, channel = 'App', actor = sketchState.myOtsMember || 'Andrés', priority = null, pinned = false } = {}) {
  const ot = typeof otOrId === 'string' ? trafficOrders.find((o) => o.id === otOrId) : otOrId;
  const clean = String(text || '').trim();
  if (!ot || !clean) return;
  if (!Array.isArray(ot.messages)) ot.messages = [];
  const normPriority = ['urgent', 'important', 'info'].includes(priority)
    ? priority
    : (pinned ? 'important' : null);
  ot.messages.push({
    at: formatNowDisplay(),
    actor: actor || 'Estudio',
    channel,
    text: clean,
    priority: normPriority,
    pinned: !!normPriority,
  });
  const prioLabels = { urgent: 'Urgente', important: 'Importante', info: 'Info' };
  recordOtActivity(
    ot,
    normPriority ? `fijó alerta ${prioLabels[normPriority]} (${channel})` : `envió mensaje (${channel})`,
    actor
  );
}

export function renderOtActivityHtml(ot) {
  if (!ot) return '';
  ensureOtData(ot);
  const logs = Array.isArray(ot.activityLog) ? ot.activityLog : [];
  return `
    <div class="pt-3 border-t border-obsidian-border space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] uppercase tracking-[0.12em] text-[#8C8C8C]">Historial de Actividad</span>
        <span class="text-[9.5px] font-mono text-[#8C8C8C]">${logs.length}</span>
      </div>
      <div class="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
        ${logs.map((entry) => `
          <div class="p-2 rounded-lg bg-[#191919] border border-obsidian-border text-[10.5px] space-y-0.5">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium text-obsidian-cyan truncate">${escapeHtml(entry.actor)}</span>
              <span class="font-mono text-[9.5px] text-[#8C8C8C] shrink-0">${escapeHtml(entry.at)}</span>
            </div>
            <div class="text-[#D4D4D4] leading-snug">${escapeHtml(entry.text)}</div>
          </div>
        `).join('') || '<div class="text-[10px] text-[#8C8C8C] py-2">Sin actividad registrada aún.</div>'}
      </div>
    </div>
  `;
}

function appendAutoOrderActivity(prevSnapStr) {
  if (!prevSnapStr) return;
  let prevList;
  try {
    prevList = JSON.parse(prevSnapStr);
  } catch (_) {
    return;
  }
  const prevMap = new Map(prevList.map((o) => [o.id, o]));
  const actor = sketchState.myOtsMember || 'Estudio';

  trafficOrders.forEach((ot) => {
    const prev = prevMap.get(ot.id);
    if (!prev) {
      recordOtActivity(ot, 'abrió la OT', actor);
      return;
    }
    if ((prev.stage || 'Tráfico') !== (ot.stage || 'Tráfico')) {
      recordOtActivity(ot, `cambió etapa: ${prev.stage || 'Tráfico'} → ${ot.stage || 'Tráfico'}`, actor);
    }
    if (prev.status !== ot.status) {
      recordOtActivity(ot, `cambió estado: ${prev.status} → ${ot.status}`, actor);
    }
    if (prev.department !== ot.department) {
      recordOtActivity(ot, `traficó a ${ot.department || '—'}`, actor);
    }
    if (prev.responsible !== ot.responsible) {
      recordOtActivity(ot, `asignó a ${ot.responsible || 'Sin asignar'}`, actor);
    }
    if (Boolean(prev.urgent) !== Boolean(ot.urgent)) {
      recordOtActivity(ot, ot.urgent ? 'marcó como Urgente' : 'quitó marca de Urgente', actor);
    }
    if (prev.deliveryDate !== ot.deliveryDate) {
      recordOtActivity(ot, `reprogramó entrega: ${formatShortDate(prev.deliveryDate) || '—'} → ${formatShortDate(ot.deliveryDate) || '—'}`, actor);
    }
    const prevSubs = Array.isArray(prev.subtasks) ? prev.subtasks : [];
    const curSubs = Array.isArray(ot.subtasks) ? ot.subtasks : [];
    curSubs.forEach((st, idx) => {
      const pst = prevSubs[idx];
      if (!pst) {
        recordOtActivity(ot, `agregó tarea «${st.title}»`, actor);
        return;
      }
      if ((pst.stage || 'Tráfico') !== (st.stage || 'Tráfico')) {
        recordOtActivity(ot, `en «${st.title}»: etapa ${pst.stage || 'Tráfico'} → ${st.stage || 'Tráfico'}`, actor);
      }
      if (pst.status !== st.status) {
        recordOtActivity(ot, `en «${st.title}»: estado ${pst.status} → ${st.status}`, actor);
      }
      if (pst.deliveryDate !== st.deliveryDate) {
        const msg = `reprogramó entrega: ${formatShortDate(pst.deliveryDate) || '—'} → ${formatShortDate(st.deliveryDate) || '—'}`;
        recordOtActivity(ot, `en «${st.title}»: ${msg}`, actor);
        if (Array.isArray(st.activityLog)) recordOtActivity(st, msg, actor);
      }
      const prevHrs = Number(pst.estimatedHours ?? 3);
      const curHrs = Number(st.estimatedHours ?? 3);
      if (prevHrs !== curHrs) {
        recordOtActivity(ot, `en «${st.title}»: horas ${prevHrs}h → ${curHrs}h`, actor);
      }
    });
  });
}

export function notifySketchChange(topic, payload) {
  if (topic === 'orders' && !isApplyingOrderHistory && !payload?.filter && !payload?.fromHistory) {
    ensureOrderHistorySeeded();
    appendAutoOrderActivity(orderHistoryStack[orderHistoryIndex]);
    const snap = JSON.stringify(trafficOrders);
    if (snap !== orderHistoryStack[orderHistoryIndex]) {
      orderHistoryStack = orderHistoryStack.slice(0, orderHistoryIndex + 1);
      orderHistoryStack.push(snap);
      if (orderHistoryStack.length > MAX_ORDER_HISTORY + 1) {
        orderHistoryStack.shift();
      }
      orderHistoryIndex = orderHistoryStack.length - 1;
      notifySketchChange('history', { canUndo: canUndoOrders(), canRedo: canRedoOrders() });
    }
  }
  const listeners = sketchListeners.get(topic);
  if (!listeners) return;
  listeners.forEach((fn) => fn(payload));
}

export function ensurePieceVersions(piece, fallbackAuthor = 'Andrés') {
  if (!piece) return [];
  if (!Array.isArray(piece.versions) || !piece.versions.length) {
    const baseStatus = piece.status || 'En Revisión';
    const isMultiDemo = /Boceto_Principal|Hero_Desktop_v2/i.test(String(piece.name || ''));
    if (isMultiDemo) {
      piece.versions = [
        {
          version: 1,
          fileName: String(piece.name || '').replace(/_v2/i, '_v1'),
          meta: piece.meta || 'IMAGEN · 0.62 MB',
          status: 'Con cambios',
          uploadedBy: fallbackAuthor,
          at: '18/11 10:15',
          note: 'Primera propuesta enviada a revisión',
          openPins: 3,
        },
        {
          version: 2,
          fileName: piece.name,
          meta: piece.meta || 'IMAGEN · 0.66 MB',
          status: baseStatus,
          uploadedBy: fallbackAuthor,
          at: '20/11 11:20',
          note: 'Ajuste de contraste y tamaño de logo',
          openPins: baseStatus === 'Aprobado' ? 0 : 1,
        },
      ];
    } else {
      piece.versions = [
        {
          version: 1,
          fileName: piece.name,
          meta: piece.meta || 'ARCHIVO · 0.50 MB',
          status: baseStatus,
          uploadedBy: piece.uploadedBy || fallbackAuthor,
          at: '19/11 15:10',
          note: 'Versión inicial',
          openPins: piece.openPins ?? (baseStatus === 'Aprobado' ? 0 : 2),
        },
      ];
    }
  }
  const latest = piece.versions[piece.versions.length - 1];
  if (!piece.activeVersion || !piece.versions.some((v) => v.version === piece.activeVersion)) {
    piece.activeVersion = latest.version;
  }
  piece.version = latest.version;
  piece.status = latest.status;
  return piece.versions;
}

export function getActivePieceVersion(piece) {
  const versions = ensurePieceVersions(piece);
  const latest = versions[versions.length - 1] || null;
  const current = versions.find((v) => v.version === piece.activeVersion) || latest;
  return {
    versions,
    current,
    latest,
    isHistorical: !!(current && latest && current.version !== latest.version),
  };
}

export function addPieceVersion(piece, { fileName = '', meta = '', note = '', actor = sketchState.myOtsMember || 'Andrés', ot = null } = {}) {
  if (!piece) return null;
  const versions = ensurePieceVersions(piece, actor);
  const latest = versions[versions.length - 1];
  const nextVer = (latest?.version || 0) + 1;
  const entry = {
    version: nextVer,
    fileName: String(fileName || '').trim() || piece.name,
    meta: meta || latest?.meta || piece.meta || 'ARCHIVO · 0.80 MB',
    status: 'En Revisión',
    uploadedBy: actor || 'Andrés',
    at: formatNowDisplay(),
    note: String(note || '').trim() || `Nueva versión v${nextVer}`,
    openPins: 0,
  };
  versions.push(entry);
  piece.activeVersion = nextVer;
  piece.version = nextVer;
  piece.status = 'En Revisión';
  piece.meta = entry.meta;
  if (ot) {
    recordOtActivity(ot, `subió v${nextVer} de «${piece.name}»`, actor);
  }
  return entry;
}

export function deletePieceVersion(piece, targetVer, { actor = sketchState.myOtsMember || 'Andrés', ot = null } = {}) {
  if (!piece) return false;
  const versions = ensurePieceVersions(piece, actor);
  if (versions.length <= 1) return false;
  const idx = versions.findIndex((v) => v.version === Number(targetVer));
  if (idx === -1) return false;
  versions.splice(idx, 1);
  const latest = versions[versions.length - 1];
  piece.activeVersion = latest.version;
  piece.version = latest.version;
  piece.status = latest.status;
  if (ot) {
    recordOtActivity(ot, `eliminó v${targetVer} de «${piece.name}»`, actor);
  }
  return true;
}

export function rescheduleDeliveryDate(otId, taskIdx = '', nextIsoDate = null, nextTime = null) {
  const ot = trafficOrders.find((o) => o.id === otId);
  if (!ot || ot.archived) return false;
  const hasTask = taskIdx !== '' && taskIdx !== null && taskIdx !== undefined && ot.subtasks?.[Number(taskIdx)];
  const target = hasTask ? ot.subtasks[Number(taskIdx)] : ot;
  const prevRaw = String(target.deliveryDate || ot.deliveryDate || '');
  const prevDate = prevRaw.slice(0, 10) || relDate(0).slice(0, 10);
  const prevTime = prevRaw.length >= 16 ? prevRaw.slice(11, 16) : '17:00';
  const finalDate = nextIsoDate || prevDate;
  const finalTime = nextTime || prevTime;
  const nextVal = `${finalDate}T${finalTime}:00`;
  if (target.deliveryDate === nextVal) return false;

  target.deliveryDate = nextVal;
  if (hasTask) {
    if (target.scheduledDate && target.scheduledDate > finalDate) {
      target.scheduledDate = finalDate;
    }
  } else if (Array.isArray(ot.subtasks)) {
    ot.subtasks.forEach((st) => {
      if (st.scheduledDate && st.scheduledDate > finalDate) {
        st.scheduledDate = finalDate;
      }
    });
  }

  notifySketchChange('orders', { otId: ot.id, field: 'deliveryDate' });
  notifySketchChange('stripboard');
  return true;
}

export function syncDepartmentFromRoutes(targetObj) {
  if (!targetObj || !Array.isArray(targetObj.routes) || !targetObj.routes.length) return;
  const validTo = (r) => r && r.to && String(r.to).trim() && String(r.to).trim() !== '—';
  let picked = null;
  for (let i = targetObj.routes.length - 1; i >= 0; i--) {
    if (targetObj.routes[i].locked && validTo(targetObj.routes[i])) {
      picked = targetObj.routes[i].to;
      break;
    }
  }
  if (!picked) {
    for (let i = targetObj.routes.length - 1; i >= 0; i--) {
      if (validTo(targetObj.routes[i])) {
        picked = targetObj.routes[i].to;
        break;
      }
    }
  }
  if (picked) targetObj.department = picked;
}

export function ensureOtData(ot, formatShortDateFn = formatShortDate) {
  const wsDepts = getDepartmentsForWorkspace(ot.workspaceId || 'diseno-publicidad');
  const wsOrigin = wsDepts[0] || 'Cuentas';
  const wsHub = wsDepts.includes('Tráfico') ? 'Tráfico' : wsOrigin;
  const wsExec = wsDepts.find((d) => ![wsOrigin, wsHub, 'Cliente', 'Facturación'].includes(d)) || wsDepts[1] || wsOrigin;
  const wsExec2 = wsDepts.find((d) => ![wsOrigin, wsHub, wsExec, 'Cliente', 'Facturación'].includes(d)) || wsExec;
  if (!ot.activityLog) {
    const baseAt = formatShortDateFn(ot.entryDate) || formatNowDisplay();
    const resp = ot.responsible || 'Andrés';
    const dept = ot.department || wsExec;
    const stage = ot.stage || 'Tráfico';
    ot.activityLog = [
      { at: formatNowDisplay(), actor: resp, text: `actualizó etapa a ${stage}` },
      { at: baseAt, actor: resp, text: 'subió «Boceto_Principal.png» (v1)' },
      { at: baseAt, actor: 'Camila', text: `traficó a ${dept}` },
      { at: baseAt, actor: 'Camila', text: `asignó la OT a ${resp}` },
      { at: baseAt, actor: 'Cuentas', text: `abrió la OT para ${ot.client || 'Cliente'}` },
    ];
  }
  if (!ot.messages) {
    const baseAt = formatShortDateFn(ot.entryDate) || formatNowDisplay();
    const resp = ot.responsible || 'Andrés';
    ot.messages = [
      { at: baseAt, actor: 'Camila', channel: 'App', text: `Hola @${resp}, queda abierta ${ot.id}. Cualquier duda del brief me escribes.`, priority: null, pinned: false },
      { at: formatNowDisplay(), actor: resp, channel: 'WhatsApp', text: 'Recibido, ya monté v1 en galería para revisión.', priority: null, pinned: false },
    ];
    if (ot.urgent) {
      ot.messages.push(
        { at: formatNowDisplay(), actor: 'Camila', channel: 'App', text: 'Urgente llamar al cliente para confirmar aprobación antes de las 4pm.', priority: 'urgent', pinned: true },
        { at: formatNowDisplay(), actor: 'Sofía', channel: 'WhatsApp', text: 'Enviar medidas definitivas al impresor hoy.', priority: 'important', pinned: true },
      );
    }
  }
  if (!ot.routes) {
    const finalDept = ot.department || wsExec;
    ot.routes = [
      { date: formatShortDateFn(ot.entryDate), from: wsOrigin, to: finalDept, desc: ot.title, sign: ot.responsible || 'Camila', notes: ot.notes || '', locked: true },
    ];
  }
  syncDepartmentFromRoutes(ot);
  if (!ot.mediaFiles) {
    ot.mediaFiles = [
      { name: 'Boceto_Principal.png', meta: 'IMAGEN · 0.66 MB', status: 'En Revisión', taskTitle: 'OT', dateOrder: 15 },
      { name: 'Adaptacion_Vertical.png', meta: 'IMAGEN · 0.48 MB', status: 'En Revisión', taskTitle: 'Retoque Imagen', dateOrder: 14 },
      { name: 'Copy_Campana_v1.pdf', meta: 'PDF · 0.32 MB', status: 'Aprobado', taskTitle: 'Redacción de Textos', dateOrder: 13 },
      { name: 'Reel_Preview_01.mp4', meta: 'VIDEO · 4.20 MB', status: 'En Revisión', taskTitle: 'OT', dateOrder: 12 },
      { name: 'Hero_Desktop_v2.png', meta: 'IMAGEN · 1.45 MB', status: 'En Revisión', taskTitle: 'Retoque Imagen', dateOrder: 11 },
      { name: 'Banner_Stories_01.png', meta: 'IMAGEN · 0.72 MB', status: 'Aprobado', taskTitle: 'Retoque Imagen', dateOrder: 10 },
      { name: 'Guion_Locucion.docx', meta: 'DOC · 0.18 MB', status: 'Aprobado', taskTitle: 'Redacción de Textos', dateOrder: 9 },
      { name: 'Teaser_YouTube.mp4', meta: 'VIDEO · 8.10 MB', status: 'En Revisión', taskTitle: 'OT', dateOrder: 8 },
      { name: 'Paleta_Color_OT.png', meta: 'IMAGEN · 0.29 MB', status: 'Aprobado', taskTitle: 'OT', dateOrder: 7 },
      { name: 'Landing_Embed.html', meta: 'CODE · 0.04 MB', status: 'En Revisión', taskTitle: 'OT', dateOrder: 6 },
      { name: 'Carrusel_Slide_01.png', meta: 'IMAGEN · 0.84 MB', status: 'En Revisión', taskTitle: 'Retoque Imagen', dateOrder: 5 },
      { name: 'Carrusel_Slide_02.png', meta: 'IMAGEN · 0.91 MB', status: 'En Revisión', taskTitle: 'Retoque Imagen', dateOrder: 4 },
      { name: 'Titulares_Alternos.pdf', meta: 'PDF · 0.21 MB', status: 'En Revisión', taskTitle: 'Redacción de Textos', dateOrder: 3 },
      { name: 'Motion_Logo_Loop.mp4', meta: 'VIDEO · 3.60 MB', status: 'Aprobado', taskTitle: 'OT', dateOrder: 2 },
      { name: 'Notas_NotebookLM.txt', meta: 'TEXTO · 0.02 MB', status: 'En Revisión', taskTitle: 'Redacción de Textos', dateOrder: 1 }
    ];
  }
  if (!ot.subtasks) {
    const camilaTaskTitles = {
      'OT-26-001': 'Retoque y color de fotos cabañas',
      'OT-26-002': 'Adaptación Reel 9:16 retiro detox',
      'OT-26-003': 'Diseño banner web socios Black',
      'OT-26-004': 'Arte final invitación VIP dorada',
      'OT-26-005': 'Ajuste tabla nutricional y troquel 340g',
      'OT-26-006': 'Adaptación piezas pauta Meta Ads',
      'OT-26-007': 'Colorización final reel desayuno terraza',
      'OT-26-008': 'Diagramación carta masajes 2026',
      'OT-26-009': 'Arte caja rígida kit bienvenida',
      'OT-26-010': 'Diseño pendones y backing torneo golf',
      'OT-26-011': 'Carrusel educativo proceso lavado',
      'OT-26-012': 'Composición renders lata sobre hielo',
      'OT-26-013': 'Banner hero desktop y móvil puente',
      'OT-26-014': 'Prototipo UI reserva prioritaria',
      'OT-26-015': 'Maquetación newsletter mensual barista',
      'OT-26-016': 'Banners display campaña bienestar',
      'OT-26-017': 'Animación vertical invitación cata VIP',
      'OT-26-018': 'Arte hablador y cenefa neveras POP',
      'OT-26-019': 'Diagramación dossier eventos empresa',
      'OT-26-020': 'Diseño UI landing alianza aerolíneas',
      'OT-26-021': 'Diseño sello numerado microlote',
      'OT-26-022': 'Edición reel sonoterapia y portada',
      'OT-26-023': 'Pantallas check-in QR invitados gala',
      'OT-26-024': 'Edición video TikTok Cold Brew Tonic',
      'OT-26-025': 'Cierre gráfico entregables del mes'
    };
    const customTitle = camilaTaskTitles[ot.id] || `Producción visual · ${ot.ref || ot.title}`;
    ot.subtasks = [
      {
        title: 'Redacción de Textos',
        responsible: 'Andrés',
        department: wsExec,
        status: ot.status || 'En proceso',
        entryDate: ot.entryDate,
        deliveryDate: ot.deliveryDate,
        notes: 'Tono cercano',
        routes: [
          { date: formatShortDateFn(ot.entryDate), from: wsOrigin, to: wsExec, desc: 'Brief de copy y titulares para campaña', sign: 'Andrés', notes: 'Tono cercano', locked: true },
          { date: formatShortDateFn(ot.deliveryDate), from: wsExec, to: wsHub, desc: 'Propuesta de textos v1 lista para revisión', sign: 'Andrés', notes: 'Revisar CTA', locked: false }
        ],
        mediaFiles: [
          { name: 'Copy_Campana_v1.docx', meta: 'DOC · 0.14 MB', status: 'En Revisión' },
          { name: 'Titulares_IG.pdf', meta: 'PDF · 0.32 MB', status: 'Aprobado' }
        ]
      },
      {
        title: customTitle,
        responsible: 'Andrés',
        department: ot.department || wsExec,
        status: ot.status || 'En proceso',
        entryDate: ot.entryDate,
        deliveryDate: ot.deliveryDate,
        scheduledDate: (ot.deliveryDate || '').slice(0, 10),
        estimatedHours: 3,
        notes: ot.notes || 'Alta resolución',
        routes: [
          { date: formatShortDateFn(ot.entryDate), from: wsHub, to: wsExec, desc: customTitle, sign: 'Andrés', notes: ot.notes || 'Alta resolución', locked: true },
          { date: formatShortDateFn(ot.deliveryDate), from: wsExec, to: wsExec2, desc: 'Entregable v1 listo para revisión', sign: 'Andrés', notes: 'Revisar formato', locked: false }
        ],
        mediaFiles: [
          { name: 'Foto_Retocada_01.png', meta: 'IMAGEN · 1.24 MB', status: 'En Revisión' },
          { name: 'Hero_Color_Final.png', meta: 'IMAGEN · 0.98 MB', status: 'En Revisión' }
        ]
      }
    ];
  } else {
    ot.subtasks.forEach((st) => {
      if (!st.responsible) st.responsible = ot.responsible || 'Andrés';
      if (!st.department) st.department = ot.department || wsExec;
      if (!st.status) st.status = ot.status || 'En proceso';
      if (!st.entryDate) st.entryDate = ot.entryDate;
      if (!st.deliveryDate) st.deliveryDate = ot.deliveryDate;
      if (!st.scheduledDate) st.scheduledDate = (st.deliveryDate || ot.deliveryDate || '').slice(0, 10);
      if (st.estimatedHours === undefined || st.estimatedHours === null || st.estimatedHours === '') st.estimatedHours = 3;
      if (st.notes === undefined) st.notes = '';
      syncDepartmentFromRoutes(st);
    });
  }
}

/**
 * Shared filter predicate across Tráfico, Mis OTs, Todas las Tareas, and Stripboard.
 */
export function matchesCommonTrafficFilters(item, {
  state = sketchState,
  checkResponsible = true,
  checkWorkspace = true,
  searchQuery = '',
} = {}) {
  if (checkWorkspace && state.activeWorkspaceId && state.activeWorkspaceId !== 'studio') {
    const itemWs = item.workspaceId || item.otWorkspaceId || 'diseno-publicidad';
    if (itemWs !== state.activeWorkspaceId) return false;
  }
  const tf = state.trafficFilter || { type: 'all' };
  if (tf.type === 'client' && tf.client && item.client !== tf.client) return false;
  if (tf.type === 'brand' && (item.client !== tf.client || item.brand !== tf.brand)) return false;

  if (state.trafficDeptFilter !== 'all' && (item.department || '—') !== state.trafficDeptFilter) return false;
  if (state.trafficStageFilter !== 'all' && (item.stage || 'Tráfico') !== state.trafficStageFilter) return false;
  if (state.trafficStatusFilter !== 'all' && item.status !== state.trafficStatusFilter) return false;
  if (checkResponsible && state.trafficRespFilter !== 'all' && item.responsible !== state.trafficRespFilter) return false;

  const df = state.trafficDateFilter;
  if (df && df !== 'all') {
    const todayKey = relDate(0).slice(0, 10);
    const tomorrowKey = relDate(1).slice(0, 10);
    const recentCutoffKey = relDate(-2).slice(0, 10);
    const dKey = (item.deliveryDate || '').slice(0, 10);
    if (df === 'today' && dKey !== todayKey) return false;
    if (df === 'tomorrow' && dKey !== tomorrowKey) return false;
    if (df === 'recent' && (item.entryDate || '').slice(0, 10) < recentCutoffKey) return false;
    if (df === 'urgent' && !item.urgent) return false;
    if (df === 'urgent-today' && !item.urgent && dKey !== todayKey) return false;
    if (df === 'urgent-today-tomorrow' && !item.urgent && dKey !== todayKey && dKey !== tomorrowKey) return false;
  }

  const q = String(searchQuery || '').trim().toLowerCase();
  if (q) {
    const hay = [
      item.id, item.code, item.client, item.brand, item.product,
      item.ref, item.title, item.responsible, item.department,
      item.stage, item.status, item.notes,
    ];
    if (!hay.some((v) => String(v || '').toLowerCase().includes(q))) return false;
  }
  return true;
}

/**
 * Shared sort by opening date (`entryDate`) across collection views.
 */
export function sortTrafficItemsByEntryDate(items, sortBy = sketchState.trafficSortBy) {
  return [...items].sort((a, b) => {
    const da = a.entryDate || a.scheduledDate || '';
    const db = b.entryDate || b.scheduledDate || '';
    return sortBy === 'oldest' ? da.localeCompare(db) : db.localeCompare(da);
  });
}
