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
    color: '#f59e0b',
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
  dailyHours: 8,
  trialDaysLeft: 14,
  planName: 'Prueba Gratis (5 puestos · 14 días)',
  maxSeats: 5,
  apiKey: 'sk-trafikeitor-demo-••••••••••••',
  theme: 'dark',
  language: 'es'
};

export const studioTeamList = [
  { name: 'El Marcante', email: 'direccion@elmarcante.com', role: 'Dueño / Admin', scope: 'Todos los clientes', isOwner: true, status: 'Activo' },
  { name: 'Camila', email: 'camila@elmarcante.com', role: 'Creativo', scope: 'Todos los clientes', isOwner: false, status: 'Activo' },
  { name: 'Mateo', email: 'mateo@elmarcante.com', role: 'Diseñador Senior', scope: 'Todos los clientes', isOwner: false, status: 'Activo' },
  { name: 'Sofía', email: 'sofia@elmarcante.com', role: 'Ejecutiva de Tráfico', scope: 'Todos los clientes', isOwner: false, status: 'Activo' }
];

export const trafficStatuses = ['Tráfico', 'Recibido', 'Creativos', 'Desarrollo', 'Cliente', 'Entregado', 'Facturación', 'Cerrado', 'Archivada', 'Cancelado'];

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
  { id: 'OT-26-001', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Institucional', media: 'IG Carousel 1080x1350', ref: 'Temporada Verde', title: 'Campaña lanzamiento temporada baja y escapadas', entryDate: relDate(-5, '09:00'), deliveryDate: relDate(3, '17:00'), status: 'Desarrollo', responsible: 'Camila', notes: 'Esperando fotos finales de cabañas', urgent: true },
  { id: 'OT-26-002', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Retiro Detox', media: 'Landing + Reel 9:16', ref: 'Equilibrio 2026', title: 'Piezas digitales para retiro de fin de semana', entryDate: relDate(-4, '10:30'), deliveryDate: relDate(4, '12:00'), status: 'Recibido', responsible: 'Mateo', notes: 'Revisar copy de itinerario', urgent: false },
  { id: 'OT-26-003', client: 'Club Premium', brand: 'Membresía Black', product: 'Institucional', media: 'Email + Banner Web', ref: 'Black Benefits', title: 'Actualización beneficios Q4 para socios Black', entryDate: relDate(-2, '08:45'), deliveryDate: relDate(3, '18:00'), status: 'Cliente', responsible: 'Sofía', notes: 'Enviado a aprobación de gerencia', urgent: false },
  { id: 'OT-26-004', client: 'Club Premium', brand: 'Eventos', product: 'Gala Anual', media: 'Impreso + Invitación Digital', ref: 'Noche Dorada', title: 'Invitación VIP y señalética del salón principal', entryDate: relDate(-1, '14:15'), deliveryDate: relDate(5, '16:00'), status: 'Tráfico', responsible: 'Andrés', notes: 'Cotizar papel texturizado', urgent: true },
  { id: 'OT-26-005', client: 'Café Origen', brand: 'Tostado Especial', product: 'Empaque 340g', media: 'Troquel + Arte Final', ref: 'Sierra Nevada', title: 'Ajuste tabla nutricional y código de barras', entryDate: relDate(0, '11:00'), deliveryDate: relDate(4, '15:00'), status: 'Desarrollo', responsible: 'Valentina', notes: 'Validar Pantone dorado', urgent: false },
  { id: 'OT-26-006', client: 'Café Origen', brand: 'Cold Brew', product: 'Institucional', media: 'Pauta Meta Ads', ref: 'Verano Frío', title: 'Adaptaciones 3 formatos para pauta pagada', entryDate: relDate(0, '09:20'), deliveryDate: relDate(6, '17:00'), status: 'Entregado', responsible: 'Sebastián', notes: 'Listo para pauta lunes', urgent: false },
  { id: 'OT-26-007', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Institucional', media: 'Video Reel 9:16', ref: 'Amanecer Bosque', title: 'Edición reel experiencia desayuno en terraza', entryDate: relDate(-6, '09:10'), deliveryDate: relDate(3, '16:00'), status: 'Desarrollo', responsible: 'Camila', notes: 'Falta colorización final', urgent: false },
  { id: 'OT-26-008', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Institucional', media: 'Brochure PDF', ref: 'Carta Masajes', title: 'Diagramación menú de terapias y precios 2026', entryDate: relDate(-5, '15:20'), deliveryDate: relDate(5, '18:00'), status: 'Cliente', responsible: 'Sofía', notes: 'En revisión con dirección', urgent: false },
  { id: 'OT-26-009', client: 'Club Premium', brand: 'Membresía Black', product: 'Kit Bienvenida', media: 'Impreso Offset', ref: 'Welcome Box', title: 'Caja rígida y tarjeta personalizada nuevos socios', entryDate: relDate(-4, '11:00'), deliveryDate: relDate(6, '12:00'), status: 'Desarrollo', responsible: 'Andrés', notes: 'Prueba de barniz UV pendiente', urgent: true },
  { id: 'OT-26-010', client: 'Club Premium', brand: 'Eventos', product: 'Torneo Golf', media: 'Pendones + Backing', ref: 'Copa Otoño', title: 'Señalética de hoyos y backing premiación', entryDate: relDate(-3, '16:40'), deliveryDate: relDate(7, '10:00'), status: 'Tráfico', responsible: 'Andrés', notes: 'Confirmar medidas con club', urgent: false },
  { id: 'OT-26-011', client: 'Café Origen', brand: 'Tostado Especial', product: 'Institucional', media: 'Post + Stories IG', ref: 'Cosecha Altura', title: 'Carrusel educativo proceso de lavado', entryDate: relDate(-3, '08:30'), deliveryDate: relDate(4, '17:00'), status: 'Recibido', responsible: 'Valentina', notes: 'Textos aprobados por marca', urgent: false },
  { id: 'OT-26-012', client: 'Café Origen', brand: 'Cold Brew', product: 'Lata 250ml', media: 'Render 3D', ref: 'Pack x4', title: 'Renders de producto sobre hielo para e-commerce', entryDate: relDate(-2, '13:15'), deliveryDate: relDate(5, '19:00'), status: 'Desarrollo', responsible: 'Camila', notes: 'Ajustar reflejos metálicos', urgent: true },
  { id: 'OT-26-013', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Reservas Web', media: 'Banner Hero Web', ref: 'Puente Festivo', title: 'Actualización banner principal tarifa especial', entryDate: relDate(-2, '10:00'), deliveryDate: relDate(4, '14:00'), status: 'Recibido', responsible: 'Mateo', notes: 'Subir versión desktop y móvil', urgent: false },
  { id: 'OT-26-014', client: 'Club Premium', brand: 'Membresía Black', product: 'App Socios', media: 'UI Pantalla', ref: 'Concierge 2.0', title: 'Flujo de reserva prioritaria en restaurantes', entryDate: relDate(-2, '17:00'), deliveryDate: relDate(8, '18:00'), status: 'Desarrollo', responsible: 'Lucía', notes: 'Validar endpoints con backend', urgent: false },
  { id: 'OT-26-015', client: 'Café Origen', brand: 'Tostado Especial', product: 'Suscripción', media: 'Email Marketing', ref: 'Club Grano', title: 'Newsletter mensual recomendación del barista', entryDate: relDate(-1, '09:45'), deliveryDate: relDate(6, '11:00'), status: 'Cliente', responsible: 'Sofía', notes: 'Pendiente asunto A/B test', urgent: false },
  { id: 'OT-26-016', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Retiro Detox', media: 'Pauta Google Ads', ref: 'Search Bienestar', title: 'Copies y extensiones campaña de búsqueda', entryDate: relDate(-1, '11:30'), deliveryDate: relDate(5, '16:00'), status: 'Tráfico', responsible: 'Sebastián', notes: 'Definir presupuesto diario', urgent: false },
  { id: 'OT-26-017', client: 'Club Premium', brand: 'Eventos', product: 'Cata Privada', media: 'Invitación WhatsApp', ref: 'Reserva Cava', title: 'Pieza vertical animada para envío a VIPs', entryDate: relDate(-1, '15:00'), deliveryDate: relDate(7, '18:30'), status: 'Entregado', responsible: 'Valentina', notes: 'Enviado archivo MP4 liviano', urgent: false },
  { id: 'OT-26-018', client: 'Café Origen', brand: 'Cold Brew', product: 'Activación POP', media: 'Hablador + Cenefa', ref: 'Tiendas Gourmet', title: 'Material punto de venta neveras exhibidoras', entryDate: relDate(-1, '16:20'), deliveryDate: relDate(9, '17:00'), status: 'Desarrollo', responsible: 'Andrés', notes: 'Troquel estándar 15x20cm', urgent: false },
  { id: 'OT-26-019', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Institucional', media: 'Dossier Corporativo', ref: 'Eventos Empresa', title: 'Presentación salones para retiros corporativos', entryDate: relDate(0, '08:15'), deliveryDate: relDate(10, '17:00'), status: 'Tráfico', responsible: 'Sofía', notes: 'Recopilar planos de capacidad', urgent: false },
  { id: 'OT-26-020', client: 'Club Premium', brand: 'Membresía Black', product: 'Institucional', media: 'Landing Page', ref: 'Alianza Aerolíneas', title: 'Maquetación página beneficios salas VIP', entryDate: relDate(0, '09:50'), deliveryDate: relDate(6, '18:00'), status: 'Recibido', responsible: 'Mateo', notes: 'Integrar formulario de registro', urgent: false },
  { id: 'OT-26-021', client: 'Café Origen', brand: 'Tostado Especial', product: 'Empaque 340g', media: 'Etiqueta Adhesiva', ref: 'Edición Microlote', title: 'Diseño sello numerado cosecha limitada', entryDate: relDate(0, '10:40'), deliveryDate: relDate(4, '15:00'), status: 'Desarrollo', responsible: 'Camila', notes: 'Usar papel kraft texturizado', urgent: true },
  { id: 'OT-26-022', client: 'Shambhala Ecohotel', brand: 'Spa & Retiros', product: 'Institucional', media: 'Reel + Carrusel', ref: 'Sonoterapia', title: 'Cobertura sesión de cuencos y edición rápida', entryDate: relDate(0, '12:00'), deliveryDate: relDate(5, '17:00'), status: 'Recibido', responsible: 'Valentina', notes: 'Grabación programada sábado', urgent: false },
  { id: 'OT-26-023', client: 'Club Premium', brand: 'Eventos', product: 'Gala Anual', media: 'Registro QR Web', ref: 'Check-in Gala', title: 'Sistema de confirmación y código QR invitados', entryDate: relDate(0, '14:00'), deliveryDate: relDate(8, '12:00'), status: 'Desarrollo', responsible: 'Lucía', notes: 'Probar lectura en tablet puerta', urgent: false },
  { id: 'OT-26-024', client: 'Café Origen', brand: 'Cold Brew', product: 'Institucional', media: 'Pauta TikTok', ref: 'Receta Tonic', title: 'Video tutorial 15s preparación Cold Brew Tonic', entryDate: relDate(0, '15:10'), deliveryDate: relDate(7, '16:00'), status: 'Tráfico', responsible: 'Sebastián', notes: 'Revisar música sin copyright', urgent: false },
  { id: 'OT-26-025', client: 'Shambhala Ecohotel', brand: 'Ecohotel Boutique', product: 'Institucional', media: 'Facturación Cierre', ref: 'Fee Noviembre', title: 'Consolidado horas y entregables mes actual', entryDate: relDate(-7, '09:00'), deliveryDate: relDate(9, '17:00'), status: 'Facturación', responsible: 'Daniel', notes: 'Adjuntar orden de compra', urgent: false },
  { id: 'OT-26-026', client: 'Club Premium', brand: 'Membresía Black', product: 'Institucional', media: 'Reporte Mensual', ref: 'KPIs Octubre', title: 'Informe resultados pauta y aperturas email', entryDate: relDate(-8, '10:00'), deliveryDate: relDate(0, '14:00'), status: 'Archivada', responsible: 'Sofía', notes: 'Presentado en comité', urgent: false, archived: true },
  { id: 'OT-25-118', client: 'Café Origen', brand: 'Tostado Especial', product: 'Lanzamiento', media: 'Campaña Integral', ref: 'Cosecha 2025', title: 'Cierre campaña anual origen y empaques', entryDate: relDate(-45, '09:00'), deliveryDate: relDate(-20, '18:00'), status: 'Archivada', responsible: 'Camila', notes: 'Archivada tras aprobación final', urgent: false, archived: true }
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
  trafficFilter: { type: 'all', client: null, brand: null },
  trafficSearchQuery: '',
  trafficGroupBy: 'none',
  trafficSortBy: 'newest',
  trafficDateFilter: 'all',
  trafficStatusFilter: 'all',
  trafficRespFilter: 'all',
  collapsedTrafficClients: new Set(),

  // OT detail / My OTs view
  myOtsMode: 'cards',
  myOtsMember: 'Camila',
  activeMyOtId: null,
  myOtsScope: 'active',
  activeTaskIndex: null,
  routesCollapsed: false,
  galleryCollapsed: false,

  // Gallery & preview
  activePieceIndex: 0,
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
export function notifySketchChange(topic, payload) {
  const listeners = sketchListeners.get(topic);
  if (!listeners) return;
  listeners.forEach((fn) => fn(payload));
}

export function ensureOtData(ot, formatShortDateFn = formatShortDate) {
  if (!ot.routes) {
    ot.routes = [
      { date: formatShortDateFn(ot.entryDate), from: 'Cuentas', to: 'Creativos', desc: ot.title, sign: ot.responsible || 'Camila', notes: ot.notes || '', locked: true },
      { date: formatShortDateFn(ot.deliveryDate), from: 'Creativos', to: 'Producción', desc: 'Ajuste de piezas y preparación de arte final', sign: ot.responsible || 'Camila', notes: 'Pendiente validación', locked: false }
    ];
  }
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
        responsible: 'Mateo',
        status: ot.status || 'En Revisión',
        entryDate: ot.entryDate,
        deliveryDate: ot.deliveryDate,
        notes: 'Tono cercano',
        routes: [
          { date: formatShortDateFn(ot.entryDate), from: 'Cuentas', to: 'Creativos', desc: 'Brief de copy y titulares para campaña', sign: 'Mateo', notes: 'Tono cercano', locked: true },
          { date: formatShortDateFn(ot.deliveryDate), from: 'Creativos', to: 'Tráfico', desc: 'Propuesta de textos v1 lista para revisión', sign: 'Lucía', notes: 'Revisar CTA', locked: false }
        ],
        mediaFiles: [
          { name: 'Copy_Campana_v1.docx', meta: 'DOC · 0.14 MB', status: 'En Revisión' },
          { name: 'Titulares_IG.pdf', meta: 'PDF · 0.32 MB', status: 'Aprobado' }
        ]
      },
      {
        title: customTitle,
        responsible: 'Camila',
        status: 'Creativos',
        entryDate: ot.entryDate,
        deliveryDate: ot.deliveryDate,
        scheduledDate: (ot.deliveryDate || '').slice(0, 10),
        estimatedHours: 3,
        notes: ot.notes || 'Alta resolución',
        routes: [
          { date: formatShortDateFn(ot.entryDate), from: 'Tráfico', to: 'Diseño', desc: customTitle, sign: 'Camila', notes: ot.notes || 'Alta resolución', locked: true },
          { date: formatShortDateFn(ot.deliveryDate), from: 'Diseño', to: 'Producción', desc: 'Entregable v1 listo para revisión', sign: 'Camila', notes: 'Revisar formato', locked: false }
        ],
        mediaFiles: [
          { name: 'Foto_Retocada_01.png', meta: 'IMAGEN · 1.24 MB', status: 'En Revisión' },
          { name: 'Hero_Color_Final.png', meta: 'IMAGEN · 0.98 MB', status: 'En Revisión' }
        ]
      }
    ];
  } else {
    ot.subtasks.forEach((st, idx) => {
      if (!st.responsible) st.responsible = idx % 2 === 0 ? 'Mateo' : 'Camila';
      if (!st.status) st.status = ot.status || 'En Revisión';
      if (!st.entryDate) st.entryDate = ot.entryDate;
      if (!st.deliveryDate) st.deliveryDate = ot.deliveryDate;
      if (!st.scheduledDate) st.scheduledDate = (st.deliveryDate || ot.deliveryDate || '').slice(0, 10);
      if (st.estimatedHours === undefined || st.estimatedHours === null || st.estimatedHours === '') st.estimatedHours = 3;
      if (st.notes === undefined) st.notes = '';
    });
  }
}
