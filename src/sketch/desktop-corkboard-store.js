/**
 * Capa de datos, constantes, persistencia y estado interno del Tablero de Corcho (C04):
 * - Constantes MIME dedicadas para aislar Drag & Drop
 * - Esquema y fábrica de pines (Pin)
 * - Persistencia particionada en localStorage (solo metadata) + IndexedDB (blobs locales)
 * - RBAC y estado de UI interno del Corcho
 */

// --- Drag & Drop MIME types dedicados (aislados del intercambio de cuadrantes) ---
export const DND_MIME_SLOT = 'application/x-trafigator-slot';
export const DND_MIME_PIN = 'application/x-trafigator-pin';
export const DND_MIME_CORK_CARD = 'application/x-trafigator-cork-card';

// --- Estado interno de UI de C04 (sin listeners globales acumulados) ---
export const corkUiState = {
  activePinId: null,
  activePinnedChartId: null,
  activeComposer: null, // null | 'note' | 'link' | 'file'
};

export function getActiveCorkPinId() {
  return corkUiState.activePinId;
}

export function setActiveCorkPinId(pinId) {
  corkUiState.activePinId = pinId ? String(pinId) : null;
  return corkUiState.activePinId;
}

export function getActivePinnedChartId() {
  return corkUiState.activePinnedChartId;
}

export function setActivePinnedChartId(pinId) {
  corkUiState.activePinnedChartId = pinId ? String(pinId) : null;
  return corkUiState.activePinnedChartId;
}

export function closePinnedChart() {
  if (corkUiState.activePinnedChartId === null) return false;
  corkUiState.activePinnedChartId = null;
  return true;
}

export function hasOpenCorkPinPreview() {
  return corkUiState.activePinId !== null || corkUiState.activePinnedChartId !== null;
}

export function closeCorkPinPreview() {
  let closed = false;
  if (corkUiState.activePinId !== null) {
    corkUiState.activePinId = null;
    closed = true;
  }
  if (corkUiState.activePinnedChartId !== null) {
    corkUiState.activePinnedChartId = null;
    closed = true;
  }
  return closed;
}

export function getActiveCorkComposer() {
  return corkUiState.activeComposer;
}

export function setActiveCorkComposer(mode) {
  corkUiState.activeComposer = mode || null;
  return corkUiState.activeComposer;
}

// --- RBAC del Tablero de Corcho (Sección 6) ---
export function getCorkboardPermissions({ isPersonalScope = false, roleCaps = null, userProfile = null } = {}) {
  const role = String(roleCaps?.role || userProfile?.role || 'Dueño');
  const isClientOrGuest = role === 'Cliente' || role === 'Invitado';
  const isOwnerOrAdmin = Boolean(roleCaps?.isOwner)
    || role === 'Dueño'
    || role === 'Admin / Tráfico'
    || role === 'Tráfico';
  const canAccess = !isClientOrGuest;
  const canEdit = canAccess && (isPersonalScope || isOwnerOrAdmin);
  return {
    role,
    canAccess,
    canEdit,
    isReadOnly: canAccess && !canEdit,
    isOwnerOrAdmin,
  };
}

function clonePlainObject(obj, fallback = {}) {
  if (!obj || typeof obj !== 'object') return { ...fallback };
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return { ...fallback };
  }
}

// --- Esquema completo del objeto Pin (Sección 5 + Regla 1) ---
export function createCorkPin({
  id = '',
  organizationId = 'org_studio',
  scope = 'global',
  ownerUserId = '',
  type = 'note',
  title = '',
  otId = null,
  taskIndex = null,
  mediaIndex = null,
  url = '',
  content = '',
  fileMeta = null,
  highlights = [],
  chartMeta = null,
  position = 0,
  demoPackId = null,
  createdAt = '',
} = {}) {
  const nowIso = createdAt || new Date().toISOString();
  const safeId = id || `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const rawUrl = String(url || '').trim();
  const parsedUrl = rawUrl ? normalizeSafeWebUrl(rawUrl) : null;
  const safeUrl = parsedUrl?.ok ? parsedUrl.url : '';
  return {
    id: String(safeId),
    organizationId: String(organizationId || 'org_studio'),
    scope: scope === 'personal' ? 'personal' : 'global',
    ownerUserId: String(ownerUserId || ''),
    type: String(type || 'note'),
    title: String(title || ''),
    otId: otId ? String(otId) : null,
    taskIndex: Number.isInteger(taskIndex) ? taskIndex : null,
    mediaIndex: Number.isInteger(mediaIndex) ? mediaIndex : null,
    url: safeUrl,
    content: String(content || ''),
    fileMeta: fileMeta && typeof fileMeta === 'object'
      ? {
          mime: String(fileMeta.mime || ''),
          sizeLabel: String(fileMeta.sizeLabel || ''),
          blobId: fileMeta.blobId ? String(fileMeta.blobId) : null,
        }
      : null,
    highlights: Array.isArray(highlights)
      ? highlights.map((h) => ({
          id: String(h?.id || `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
          quote: String(h?.quote || ''),
          note: String(h?.note || ''),
          createdAt: String(h?.createdAt || nowIso),
          sharedAt: h?.sharedAt ? String(h.sharedAt) : null,
          sharedTo: h?.sharedTo ? String(h.sharedTo) : null,
          sharedOtId: h?.sharedOtId ? String(h.sharedOtId) : null,
        }))
      : [],
    chartMeta: chartMeta && typeof chartMeta === 'object'
      ? {
          pillId: String(chartMeta.pillId || 'ots-active'),
          chartIdx: Number.isInteger(chartMeta.chartIdx) ? chartMeta.chartIdx : 0,
          title: String(chartMeta.title || ''),
          boardTitle: String(chartMeta.boardTitle || ''),
          anchors: clonePlainObject(chartMeta.anchors, {}),
          metric: String(chartMeta.metric || 'hours'),
          filtersSnapshot: clonePlainObject(chartMeta.filtersSnapshot, {
            pillId: String(chartMeta.pillId || 'ots-active'),
            anchors: clonePlainObject(chartMeta.anchors, {}),
            metric: String(chartMeta.metric || 'hours'),
            activeWsId: 'studio',
            deptPageWsId: null,
            isPersonalScope: false,
            myMember: '',
          }),
        }
      : null,
    position: Number.isFinite(Number(position)) ? Number(position) : 0,
    demoPackId: demoPackId ? String(demoPackId) : null,
    createdAt: nowIso,
  };
}

// --- Persistencia particionada en localStorage (solo metadata, nunca binarios pesados) ---
function slugKey(val, fallback) {
  return String(val || fallback)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

export function getCorkStorageKey({ isPersonalScope = false, studioSettings = null, userProfile = null } = {}) {
  const orgKey = slugKey(studioSettings?.initials || studioSettings?.name, 'studio');
  if (isPersonalScope) {
    const userKey = slugKey(userProfile?.shortName || userProfile?.email, 'user');
    return `trafigator_cork_v1_${orgKey}_user_${userKey}`;
  }
  return `trafigator_cork_v1_${orgKey}_global`;
}

export function loadCorkPins(opts = {}) {
  const key = getCorkStorageKey(opts);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null; // null distingue "nunca inicializado" (onboarding) de [] (vaciado por usuario)
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, idx) => createCorkPin({ ...item, position: item?.position ?? idx }))
      .sort((a, b) => a.position - b.position);
  } catch {
    return [];
  }
}

export function saveCorkPins(pins, opts = {}) {
  const key = getCorkStorageKey(opts);
  const normalized = (Array.isArray(pins) ? pins : []).map((p, idx) =>
    createCorkPin({ ...p, position: idx })
  );
  try {
    localStorage.setItem(key, JSON.stringify(normalized));
    return { ok: true, pins: normalized };
  } catch (err) {
    return { ok: false, error: err?.name || 'StorageError', pins: normalized };
  }
}

// --- Utilidades de validación y formato (HU-03) ---
export function normalizeSafeWebUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: false, error: 'Ingresa una URL válida.' };
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  if (hasScheme && !/^https?:/i.test(trimmed)) {
    return { ok: false, error: 'Solo se permiten enlaces http:// o https://.' };
  }
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if ((parsed.protocol !== 'http:' && parsed.protocol !== 'https:') || !parsed.hostname) {
      return { ok: false, error: 'Solo se permiten enlaces http:// o https://.' };
    }
    return {
      ok: true,
      url: parsed.href,
      domain: parsed.hostname.replace(/^www\./i, ''),
    };
  } catch {
    return { ok: false, error: 'URL no válida. Ej: https://ejemplo.com' };
  }
}

const UNSAFE_MEDIA_MIMES = new Set([
  'text/html',
  'image/svg+xml',
  'application/xhtml+xml',
]);

function normalizeMimeType(mime = '') {
  return String(mime || '').trim().toLowerCase().split(';')[0].trim();
}

export function isSafeMediaSrc(url, kind = 'any') {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  const normKind = String(kind || 'any').toLowerCase();

  if (/^blob:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'blob:';
    } catch {
      return false;
    }
  }

  if (/^https:/i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      return parsed.protocol === 'https:' && Boolean(parsed.hostname);
    } catch {
      return false;
    }
  }

  if (/^data:/i.test(trimmed)) {
    const isSafeImgData = /^data:image\/(?!svg\+xml\b)[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafeVidData = /^data:video\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafePdfData = /^data:application\/pdf(?:;[^,]*)?,/i.test(trimmed);
    if (normKind === 'img' || normKind === 'image') return isSafeImgData;
    if (normKind === 'vid' || normKind === 'video') return isSafeVidData;
    if (normKind === 'pdf') return isSafePdfData;
    return isSafeImgData || isSafeVidData || isSafePdfData;
  }

  return false;
}

export function getFileTypeTag(mime = '', name = '') {
  const m = normalizeMimeType(mime);
  const n = String(name || '');
  if (m && UNSAFE_MEDIA_MIMES.has(m)) return 'ARCHIVO';
  if (/\.svg$/i.test(n) && (!m || m === 'image/svg+xml')) return 'ARCHIVO';
  if (m === 'application/pdf' || (!m && /\.pdf$/i.test(n))) return 'PDF';
  if ((m.startsWith('image/') && m !== 'image/svg+xml') || (!m && /\.(png|jpe?g|gif|webp|avif)$/i.test(n))) return 'IMG';
  if (m.startsWith('video/') || (!m && /\.(mp4|mov|webm|m4v)$/i.test(n))) return 'VID';
  return 'ARCHIVO';
}

export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// --- Onboarding sin resurrección (null -> siembra demo; [] -> respeta vacío) ---
export function buildOnboardingPins({ isPersonalScope = false, studioSettings = null, userProfile = null } = {}) {
  const orgId = `org_${slugKey(studioSettings?.initials || studioSettings?.name, 'studio')}`;
  const ownerId = `usr_${slugKey(userProfile?.shortName || userProfile?.email, 'user')}`;
  const scope = isPersonalScope ? 'personal' : 'global';
  return [
    createCorkPin({
      id: `pin_onboarding_guide_${scope}`,
      organizationId: orgId,
      scope,
      ownerUserId: ownerId,
      type: 'note',
      title: 'Guía rápida del Tablero de Corcho',
      content: '1. Crea notas, enlaces o sube archivos desde la cabecera.\n2. Arrastra OTs o tareas desde Prioridades y Calendario.\n3. Retira cualquier ficha con × sin afectar las OTs del Estudio.',
      position: 0,
      demoPackId: 'onboarding-demo',
    }),
    createCorkPin({
      id: `pin_onboarding_brief_${scope}`,
      organizationId: orgId,
      scope,
      ownerUserId: ownerId,
      type: 'file',
      title: 'Brief_Campaña_Shambhala_Q4.pdf',
      otId: 'OT-26-001',
      mediaIndex: 0,
      fileMeta: { mime: 'application/pdf', sizeLabel: '1.4 MB', blobId: null },
      position: 1,
      demoPackId: 'onboarding-demo',
    }),
  ];
}

export function ensureCorkPinsInitialized(opts = {}) {
  const loaded = loadCorkPins(opts);
  if (loaded !== null) return loaded;
  const seeded = buildOnboardingPins(opts);
  const res = saveCorkPins(seeded, opts);
  return res.pins;
}

export function addCorkPin(pinInput, opts = {}) {
  const current = ensureCorkPinsInitialized(opts);
  const orgId = `org_${slugKey(opts.studioSettings?.initials || opts.studioSettings?.name, 'studio')}`;
  const ownerId = `usr_${slugKey(opts.userProfile?.shortName || opts.userProfile?.email, 'user')}`;
  const pin = createCorkPin({
    organizationId: orgId,
    scope: opts.isPersonalScope ? 'personal' : 'global',
    ownerUserId: ownerId,
    ...pinInput,
    position: current.length,
  });
  const next = [...current, pin];
  const saved = saveCorkPins(next, opts);
  return { ...saved, pin };
}

export function findDuplicateOtOrTaskPin(pins, { type, otId, taskIndex = null }) {
  if (!Array.isArray(pins) || !otId) return null;
  const normOtId = String(otId);
  if (type === 'task') {
    const idx = Number.isInteger(taskIndex) ? taskIndex : null;
    return pins.find((p) => p.type === 'task' && p.otId === normOtId && p.taskIndex === idx) || null;
  }
  return pins.find((p) => p.type === 'ot' && p.otId === normOtId) || null;
}

export function addOtOrTaskCorkPin({ type, otId, taskIndex = null, title = '' }, opts = {}) {
  const safeType = type === 'task' ? 'task' : 'ot';
  const safeTaskIdx = safeType === 'task' && Number.isInteger(taskIndex) ? taskIndex : null;
  const current = ensureCorkPinsInitialized(opts);
  const existing = findDuplicateOtOrTaskPin(current, { type: safeType, otId, taskIndex: safeTaskIdx });
  if (existing) {
    return { ok: true, duplicate: true, pin: existing, pins: current };
  }
  const res = addCorkPin({
    type: safeType,
    otId: String(otId),
    taskIndex: safeTaskIdx,
    title: String(title || ''),
  }, opts);
  return { ...res, duplicate: false };
}

export function findDuplicateOtMediaPin(pins, { otId, mediaIndex = null, title = '' }) {
  if (!Array.isArray(pins) || !otId) return null;
  const normOtId = String(otId);
  const idx = Number.isInteger(mediaIndex) ? mediaIndex : null;
  return pins.find((p) => {
    if (p.type !== 'file' || p.otId !== normOtId) return false;
    if (idx !== null && p.mediaIndex !== null) return p.mediaIndex === idx;
    return Boolean(title) && p.title === String(title);
  }) || null;
}

export function addOtMediaCorkPin({ otId, mediaIndex = null, title = '', mime = '', sizeLabel = '' }, opts = {}) {
  const safeOtId = String(otId || '');
  const safeIdx = Number.isInteger(mediaIndex) ? mediaIndex : null;
  const current = ensureCorkPinsInitialized(opts);
  const existing = findDuplicateOtMediaPin(current, { otId: safeOtId, mediaIndex: safeIdx, title });
  if (existing) {
    return { ok: true, duplicate: true, pin: existing, pins: current };
  }
  // Referencia pura a mediaFiles de la OT (sin copiar binarios a IndexedDB)
  const res = addCorkPin({
    type: 'file',
    title: String(title || 'Archivo de OT'),
    otId: safeOtId,
    mediaIndex: safeIdx,
    fileMeta: {
      mime: String(mime || ''),
      sizeLabel: String(sizeLabel || ''),
      blobId: null,
    },
  }, opts);
  return { ...res, duplicate: false };
}

export function buildChartSnapshotSignature(chartMeta) {
  if (!chartMeta || typeof chartMeta !== 'object') return '';
  const snap = chartMeta.filtersSnapshot || {};
  const anchors = snap.anchors || chartMeta.anchors || {};
  const sortedAnchors = Object.keys(anchors)
    .sort()
    .map((k) => `${k}:${String(anchors[k] ?? 'all')}`)
    .join('|');
  return [
    String(snap.pillId || chartMeta.pillId || 'ots-active'),
    String(Number.isInteger(chartMeta.chartIdx) ? chartMeta.chartIdx : 0),
    String(snap.metric || chartMeta.metric || 'hours'),
    String(snap.activeWsId || 'studio'),
    String(snap.deptPageWsId || ''),
    snap.isPersonalScope ? 'personal' : 'global',
    sortedAnchors,
  ].join('::');
}

export function findDuplicateChartPin(pins, chartMeta) {
  if (!Array.isArray(pins) || !chartMeta) return null;
  const sig = buildChartSnapshotSignature(chartMeta);
  if (!sig) return null;
  return pins.find((p) => p.type === 'chart' && buildChartSnapshotSignature(p.chartMeta) === sig) || null;
}

export function addChartCorkPin(chartMeta, opts = {}) {
  const deepAnchors = clonePlainObject(chartMeta?.anchors, {});
  const deepSnapshot = clonePlainObject(chartMeta?.filtersSnapshot, {
    pillId: String(chartMeta?.pillId || 'ots-active'),
    anchors: deepAnchors,
    metric: String(chartMeta?.metric || 'hours'),
    activeWsId: 'studio',
    deptPageWsId: null,
    isPersonalScope: Boolean(opts.isPersonalScope),
    myMember: String(opts.userProfile?.shortName || ''),
  });
  const normalizedMeta = {
    pillId: String(chartMeta?.pillId || deepSnapshot.pillId || 'ots-active'),
    chartIdx: Number.isInteger(chartMeta?.chartIdx) ? chartMeta.chartIdx : 0,
    title: String(chartMeta?.title || 'Gráfico'),
    boardTitle: String(chartMeta?.boardTitle || ''),
    anchors: deepAnchors,
    metric: String(chartMeta?.metric || deepSnapshot.metric || 'hours'),
    filtersSnapshot: deepSnapshot,
  };
  const current = ensureCorkPinsInitialized(opts);
  const existing = findDuplicateChartPin(current, normalizedMeta);
  if (existing) {
    return { ok: true, duplicate: true, pin: existing, pins: current };
  }
  const res = addCorkPin({
    type: 'chart',
    title: normalizedMeta.title,
    chartMeta: normalizedMeta,
  }, opts);
  return { ...res, duplicate: false };
}

export async function addLocalFilesToCorkboard(fileList, opts = {}) {
  const files = Array.from(fileList || []).filter((f) => f && typeof f.name === 'string');
  if (!files.length) return { addedCount: 0, pins: ensureCorkPinsInitialized(opts) };
  let lastPins = ensureCorkPinsInitialized(opts);
  let addedCount = 0;
  for (const file of files) {
    const blobId = `blob_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    let storedBlobId = null;
    try {
      await saveCorkBlob(blobId, file, { mime: file.type, name: file.name });
      storedBlobId = blobId;
    } catch {
      storedBlobId = null;
    }
    const res = addCorkPin({
      type: 'file',
      title: file.name || 'Archivo adjunto',
      fileMeta: {
        mime: file.type || '',
        sizeLabel: formatFileSize(file.size),
        blobId: storedBlobId,
      },
    }, opts);
    if (!res.ok) {
      if (storedBlobId) {
        deleteCorkBlob(storedBlobId).catch(() => {});
      }
      continue;
    }
    lastPins = res.pins;
    addedCount += 1;
  }
  return { addedCount, pins: lastPins };
}

export function removeCorkPin(pinId, opts = {}) {
  const current = ensureCorkPinsInitialized(opts);
  const target = current.find((p) => p.id === pinId);
  const next = current.filter((p) => p.id !== pinId);
  const saved = saveCorkPins(next, opts);
  if (target?.fileMeta?.blobId) {
    deleteCorkBlob(target.fileMeta.blobId).catch(() => {});
  }
  if (corkUiState.activePinId === pinId) {
    corkUiState.activePinId = null;
  }
  if (corkUiState.activePinnedChartId === pinId) {
    corkUiState.activePinnedChartId = null;
  }
  return { ...saved, removed: target || null };
}

function resolveStorageKey(storageKey) {
  return typeof storageKey === 'string' ? storageKey : getCorkStorageKey(storageKey || {});
}

function readNormalizedPinsByKey(key) {
  if (!key) return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;
  return parsed
    .map((item, idx) => createCorkPin({ ...item, position: item?.position ?? idx }))
    .sort((a, b) => a.position - b.position);
}

function writeNormalizedPinsByKey(key, pins) {
  const normalized = pins.map((p, idx) => createCorkPin({ ...p, position: idx }));
  localStorage.setItem(key, JSON.stringify(normalized));
  return normalized;
}

export function getCorkPinById(storageKey, pinId) {
  const key = resolveStorageKey(storageKey);
  const targetId = String(pinId || '');
  if (!key || !targetId) return null;
  try {
    const ordered = readNormalizedPinsByKey(key);
    if (!ordered) return null;
    return ordered.find((p) => p.id === targetId) || null;
  } catch {
    return null;
  }
}

export function reorderCorkPins(storageKey, draggedPinId, targetPinId) {
  const key = resolveStorageKey(storageKey);
  const fromId = String(draggedPinId || '');
  const toId = String(targetPinId || '');
  if (!key || !fromId || !toId || fromId === toId) {
    return { ok: true, moved: false, pins: [] };
  }
  try {
    const ordered = readNormalizedPinsByKey(key);
    if (!ordered) return { ok: true, moved: false, pins: [] };
    const fromIdx = ordered.findIndex((p) => p.id === fromId);
    const toIdx = ordered.findIndex((p) => p.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) {
      return { ok: true, moved: false, pins: ordered };
    }
    const [movedPin] = ordered.splice(fromIdx, 1);
    ordered.splice(toIdx, 0, movedPin);
    const normalized = writeNormalizedPinsByKey(key, ordered);
    return { ok: true, moved: true, pins: normalized };
  } catch (err) {
    return { ok: false, moved: false, error: err?.name || 'StorageError', pins: [] };
  }
}

export function updateCorkPinMeta(storageKey, pinId, patch = {}) {
  const key = resolveStorageKey(storageKey);
  const targetId = String(pinId || '');
  if (!key || !targetId || !patch || typeof patch !== 'object') {
    return { ok: false, updated: false, pin: null, pins: [] };
  }
  try {
    const ordered = readNormalizedPinsByKey(key);
    if (!ordered) return { ok: false, updated: false, pin: null, pins: [] };
    const idx = ordered.findIndex((p) => p.id === targetId);
    if (idx === -1) return { ok: false, updated: false, pin: null, pins: ordered };
    const current = ordered[idx];
    const nextPatch = {};
    if ('title' in patch) nextPatch.title = String(patch.title ?? '');
    if ('content' in patch) nextPatch.content = String(patch.content ?? '');
    if ('url' in patch) {
      const rawUrl = String(patch.url ?? '').trim();
      if (!rawUrl) {
        nextPatch.url = '';
      } else {
        const parsed = normalizeSafeWebUrl(rawUrl);
        if (!parsed.ok) {
          return { ok: false, updated: false, error: parsed.error || 'InvalidUrl', pin: current, pins: ordered };
        }
        nextPatch.url = parsed.url;
      }
    }
    if ('fileMeta' in patch && patch.fileMeta && typeof patch.fileMeta === 'object') {
      nextPatch.fileMeta = {
        ...(current.fileMeta || {}),
        ...patch.fileMeta,
      };
    }
    if ('highlights' in patch && Array.isArray(patch.highlights)) {
      nextPatch.highlights = patch.highlights;
    }
    const updatedPin = createCorkPin({ ...current, ...nextPatch, id: current.id, position: idx });
    const nextList = ordered.slice();
    nextList[idx] = updatedPin;
    const normalized = writeNormalizedPinsByKey(key, nextList);
    return { ok: true, updated: true, pin: normalized[idx], pins: normalized };
  } catch (err) {
    return { ok: false, updated: false, error: err?.name || 'StorageError', pin: null, pins: [] };
  }
}

export function addCorkPinHighlight(storageKey, pinId, highlight = {}) {
  const key = resolveStorageKey(storageKey);
  const targetId = String(pinId || '');
  const quote = String(highlight?.quote || '').trim();
  const note = String(highlight?.note || '').trim();
  if (!key || !targetId || (!quote && !note)) {
    return { ok: false, added: false, highlight: null, pin: null, pins: [] };
  }
  try {
    const ordered = readNormalizedPinsByKey(key);
    if (!ordered) return { ok: false, added: false, highlight: null, pin: null, pins: [] };
    const idx = ordered.findIndex((p) => p.id === targetId);
    if (idx === -1) return { ok: false, added: false, highlight: null, pin: null, pins: ordered };
    const current = ordered[idx];
    const newHighlight = {
      id: String(highlight?.id || `hl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      quote,
      note,
      createdAt: String(highlight?.createdAt || new Date().toISOString()),
    };
    const nextHighlights = [...(Array.isArray(current.highlights) ? current.highlights : []), newHighlight];
    const updatedPin = createCorkPin({ ...current, highlights: nextHighlights, id: current.id, position: idx });
    const nextList = ordered.slice();
    nextList[idx] = updatedPin;
    const normalized = writeNormalizedPinsByKey(key, nextList);
    return { ok: true, added: true, highlight: newHighlight, pin: normalized[idx], pins: normalized };
  } catch (err) {
    return { ok: false, added: false, error: err?.name || 'StorageError', highlight: null, pin: null, pins: [] };
  }
}

export function removeCorkPinHighlight(storageKey, pinId, highlightId) {
  const key = resolveStorageKey(storageKey);
  const targetId = String(pinId || '');
  const hlId = String(highlightId || '');
  if (!key || !targetId || !hlId) {
    return { ok: false, removed: false, pin: null, pins: [] };
  }
  try {
    const ordered = readNormalizedPinsByKey(key);
    if (!ordered) return { ok: false, removed: false, pin: null, pins: [] };
    const idx = ordered.findIndex((p) => p.id === targetId);
    if (idx === -1) return { ok: false, removed: false, pin: null, pins: ordered };
    const current = ordered[idx];
    const prevHighlights = Array.isArray(current.highlights) ? current.highlights : [];
    const nextHighlights = prevHighlights.filter((h) => h.id !== hlId);
    if (nextHighlights.length === prevHighlights.length) {
      return { ok: true, removed: false, pin: current, pins: ordered };
    }
    const updatedPin = createCorkPin({ ...current, highlights: nextHighlights, id: current.id, position: idx });
    const nextList = ordered.slice();
    nextList[idx] = updatedPin;
    const normalized = writeNormalizedPinsByKey(key, nextList);
    return { ok: true, removed: true, pin: normalized[idx], pins: normalized };
  } catch (err) {
    return { ok: false, removed: false, error: err?.name || 'StorageError', pin: null, pins: [] };
  }
}

export function markCorkPinHighlightShared(storageKey, pinId, highlightId, { sharedTo = '', sharedAt = '', sharedOtId = null } = {}) {
  const key = resolveStorageKey(storageKey);
  const targetId = String(pinId || '');
  const hlId = String(highlightId || '');
  if (!key || !targetId || !hlId) {
    return { ok: false, updated: false, pin: null, pins: [] };
  }
  try {
    const ordered = readNormalizedPinsByKey(key);
    if (!ordered) return { ok: false, updated: false, pin: null, pins: [] };
    const idx = ordered.findIndex((p) => p.id === targetId);
    if (idx === -1) return { ok: false, updated: false, pin: null, pins: ordered };
    const current = ordered[idx];
    const prevHighlights = Array.isArray(current.highlights) ? current.highlights : [];
    let matched = false;
    const nextHighlights = prevHighlights.map((h) => {
      if (h.id !== hlId) return h;
      matched = true;
      return {
        ...h,
        sharedAt: String(sharedAt || new Date().toISOString()),
        sharedTo: String(sharedTo || ''),
        sharedOtId: sharedOtId ? String(sharedOtId) : (h.sharedOtId || null),
      };
    });
    if (!matched) return { ok: false, updated: false, pin: current, pins: ordered };
    const updatedPin = createCorkPin({ ...current, highlights: nextHighlights, id: current.id, position: idx });
    const nextList = ordered.slice();
    nextList[idx] = updatedPin;
    const normalized = writeNormalizedPinsByKey(key, nextList);
    return { ok: true, updated: true, pin: normalized[idx], pins: normalized };
  } catch (err) {
    return { ok: false, updated: false, error: err?.name || 'StorageError', pin: null, pins: [] };
  }
}

// --- RBAC para compartir resaltados/apuntes como mensaje (HU-06 · Sección 6) ---
export function getAssignableOrdersForShare({ roleCaps = null, userProfile = null, trafficOrders = [] } = {}) {
  const active = (trafficOrders || []).filter((o) => !o.archived);
  const perms = getCorkboardPermissions({ isPersonalScope: true, roleCaps, userProfile });
  if (!perms.canAccess) return [];
  if (perms.isOwnerOrAdmin) return active;
  const myName = String(userProfile?.shortName || '');
  if (!myName) return [];
  return active.filter(
    (o) => o.responsible === myName || (o.subtasks || []).some((st) => (st.responsible || o.responsible) === myName)
  );
}

export function canShareCorkHighlight({ pin = null, roleCaps = null, userProfile = null, trafficOrders = [] } = {}) {
  const perms = getCorkboardPermissions({ isPersonalScope: true, roleCaps, userProfile });
  if (!perms.canAccess) return false;
  if (perms.isOwnerOrAdmin) return true;
  if (!pin?.otId) return true;
  const allowed = getAssignableOrdersForShare({ roleCaps, userProfile, trafficOrders });
  return allowed.some((o) => o.id === pin.otId);
}

// --- Canal interno de mensajes del Estudio desde Corcho (pines sueltos sin otId) ---
export function getCorkInboxStorageKey({ studioSettings = null } = {}) {
  const orgKey = slugKey(studioSettings?.initials || studioSettings?.name, 'studio');
  return `trafigator_cork_inbox_v1_${orgKey}`;
}

export function loadCorkInternalMessages(opts = {}) {
  const key = getCorkInboxStorageKey(opts);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function appendCorkInternalMessage(msgInput = {}, opts = {}) {
  const key = getCorkInboxStorageKey(opts);
  const text = String(msgInput.text || '').trim();
  if (!text) return { ok: false, message: null, messages: loadCorkInternalMessages(opts) };
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const entry = {
    id: String(msgInput.id || `cmsg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
    at: String(msgInput.at || `${dd}/${mm} ${hh}:${min}`),
    createdAt: String(msgInput.createdAt || now.toISOString()),
    actor: String(msgInput.actor || 'Estudio'),
    recipientType: msgInput.recipientType === 'client' ? 'client' : 'member',
    recipientLabel: String(msgInput.recipientLabel || ''),
    channel: String(msgInput.channel || 'Corcho'),
    text,
    otId: null,
    pinId: msgInput.pinId ? String(msgInput.pinId) : null,
    pinTitle: String(msgInput.pinTitle || ''),
    priority: null,
    pinned: false,
  };
  const current = loadCorkInternalMessages(opts);
  const next = [entry, ...current].slice(0, 50);
  try {
    localStorage.setItem(key, JSON.stringify(next));
    return { ok: true, message: entry, messages: next };
  } catch (err) {
    return { ok: false, error: err?.name || 'StorageError', message: entry, messages: current };
  }
}

// --- HU-07: Plan gratuito, Widgets de Plugins activos y limpieza selectiva de Pack Demo ---
export function isStudioFreePlan(studioSettings = null) {
  const plan = String(studioSettings?.planName || '').trim();
  if (!plan) return true;
  const hasFreeKeyword = /\b(gratis|gratuita|gratuito|free|prueba|trial)\b/i.test(plan);
  if (hasFreeKeyword) return true;
  const hasPaidKeyword = /\b(plan\s+solo|plan\s+estudio|solo|estudio|pro|enterprise|pago|pagado|mensual|anual)\b/i.test(plan);
  return !hasPaidKeyword;
}

export function getActiveCorkPlugins(studioSettings = null) {
  if (Array.isArray(studioSettings?.activePlugins)) {
    return studioSettings.activePlugins.filter((id) => typeof id === 'string' && id.trim());
  }
  return ['egomaker', 'demo-pack'];
}

export function countDemoPackPins(pins = []) {
  return (Array.isArray(pins) ? pins : []).filter((p) => Boolean(p?.demoPackId)).length;
}

export function clearDemoPackPins(opts = {}) {
  const current = ensureCorkPinsInitialized(opts);
  const removed = current.filter((p) => Boolean(p?.demoPackId));
  if (!removed.length) {
    return { ok: true, removedCount: 0, pins: current };
  }
  const next = current.filter((p) => !p?.demoPackId);
  const saved = saveCorkPins(next, opts);
  removed.forEach((p) => {
    if (p?.fileMeta?.blobId) {
      deleteCorkBlob(p.fileMeta.blobId).catch(() => {});
    }
    if (corkUiState.activePinId === p.id) corkUiState.activePinId = null;
    if (corkUiState.activePinnedChartId === p.id) corkUiState.activePinnedChartId = null;
  });
  return { ...saved, removedCount: removed.length };
}

export function installDemoPackPins(opts = {}) {
  const current = ensureCorkPinsInitialized(opts);
  const existingIds = new Set(current.map((p) => p.id));
  const toAdd = buildOnboardingPins(opts).filter((p) => !existingIds.has(p.id));
  if (!toAdd.length) {
    return { ok: true, addedCount: 0, pins: current };
  }
  const next = [...current, ...toAdd];
  const saved = saveCorkPins(next, opts);
  return { ...saved, addedCount: toAdd.length };
}

// Estado en memoria del cronómetro compacto EgoMaker (sin drift y sin acumular intervalos)
const egoMakerTimer = {
  running: false,
  baseSeconds: 0,
  startedAtMs: null,
};

export function getEgoMakerTimerState() {
  const extra = egoMakerTimer.running && egoMakerTimer.startedAtMs
    ? Math.max(0, Math.floor((Date.now() - egoMakerTimer.startedAtMs) / 1000))
    : 0;
  return {
    running: egoMakerTimer.running,
    elapsedSeconds: egoMakerTimer.baseSeconds + extra,
  };
}

export function toggleEgoMakerTimer() {
  if (egoMakerTimer.running) {
    const snap = getEgoMakerTimerState();
    egoMakerTimer.baseSeconds = snap.elapsedSeconds;
    egoMakerTimer.startedAtMs = null;
    egoMakerTimer.running = false;
  } else {
    egoMakerTimer.startedAtMs = Date.now();
    egoMakerTimer.running = true;
  }
  return getEgoMakerTimerState();
}

export function resetEgoMakerTimer() {
  egoMakerTimer.running = false;
  egoMakerTimer.baseSeconds = 0;
  egoMakerTimer.startedAtMs = null;
  return getEgoMakerTimerState();
}

export function formatTimerClock(totalSeconds = 0) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hh = String(Math.floor(safe / 3600)).padStart(2, '0');
  const mm = String(Math.floor((safe % 3600) / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

// --- Almacenamiento de blobs locales en IndexedDB (evita QuotaExceededError en localStorage) ---
const CORK_BLOB_DB_NAME = 'trafigator_cork_blobs_v1';
const CORK_BLOB_STORE = 'blobs';
let corkBlobDbPromise = null;
const blobObjectUrlCache = new Map();
const blobObjectUrlInFlight = new Map();

export function revokeCorkBlobObjectUrl(blobId) {
  const key = String(blobId || '');
  if (!key) return;
  blobObjectUrlInFlight.delete(key);
  if (!blobObjectUrlCache.has(key)) return;
  try {
    URL.revokeObjectURL(blobObjectUrlCache.get(key));
  } catch {
    // ignore revoke errors
  }
  blobObjectUrlCache.delete(key);
}

export async function getCorkBlobObjectUrl(blobId) {
  const key = String(blobId || '');
  if (!key) return null;
  if (blobObjectUrlCache.has(key)) return blobObjectUrlCache.get(key);
  if (blobObjectUrlInFlight.has(key)) return blobObjectUrlInFlight.get(key);
  const pending = (async () => {
    try {
      const rec = await getCorkBlob(key);
      if (!rec?.blob) return null;
      const verifiedMime = normalizeMimeType(rec.blob.type || rec.mime || '');
      let safeBlob = rec.blob;
      if (UNSAFE_MEDIA_MIMES.has(verifiedMime)) {
        safeBlob = new Blob([rec.blob], { type: 'application/octet-stream' });
      } else if (verifiedMime === 'application/pdf' && normalizeMimeType(rec.blob.type) !== 'application/pdf') {
        safeBlob = new Blob([rec.blob], { type: 'application/pdf' });
      }
      const url = URL.createObjectURL(safeBlob);
      blobObjectUrlCache.set(key, url);
      return url;
    } catch {
      return null;
    } finally {
      blobObjectUrlInFlight.delete(key);
    }
  })();
  blobObjectUrlInFlight.set(key, pending);
  return pending;
}

function openCorkBlobDb() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (!corkBlobDbPromise) {
    corkBlobDbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(CORK_BLOB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(CORK_BLOB_STORE)) {
          db.createObjectStore(CORK_BLOB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        corkBlobDbPromise = null;
        reject(req.error || new Error('IndexedDB open failed'));
      };
    });
  }
  return corkBlobDbPromise;
}

export async function saveCorkBlob(blobId, blob, meta = {}) {
  const db = await openCorkBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORK_BLOB_STORE, 'readwrite');
    tx.objectStore(CORK_BLOB_STORE).put({
      id: String(blobId),
      blob,
      mime: String(meta.mime || blob?.type || ''),
      name: String(meta.name || ''),
      createdAt: new Date().toISOString(),
    });
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB put failed'));
  });
}

export async function getCorkBlob(blobId) {
  const db = await openCorkBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORK_BLOB_STORE, 'readonly');
    const req = tx.objectStore(CORK_BLOB_STORE).get(String(blobId));
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error || new Error('IndexedDB get failed'));
  });
}

export async function deleteCorkBlob(blobId) {
  revokeCorkBlobObjectUrl(blobId);
  const db = await openCorkBlobDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORK_BLOB_STORE, 'readwrite');
    tx.objectStore(CORK_BLOB_STORE).delete(String(blobId));
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('IndexedDB delete failed'));
  });
}
