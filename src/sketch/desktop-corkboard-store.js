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
  activeComposer: null, // null | 'note' | 'link' | 'file'
};

export function getActiveCorkPinId() {
  return corkUiState.activePinId;
}

export function setActiveCorkPinId(pinId) {
  corkUiState.activePinId = pinId ? String(pinId) : null;
  return corkUiState.activePinId;
}

export function hasOpenCorkPinPreview() {
  return corkUiState.activePinId !== null;
}

export function closeCorkPinPreview() {
  if (corkUiState.activePinId === null) return false;
  corkUiState.activePinId = null;
  return true;
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
    url: String(url || ''),
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
        }))
      : [],
    chartMeta: chartMeta && typeof chartMeta === 'object'
      ? {
          pillId: String(chartMeta.pillId || 'ots-active'),
          chartIdx: Number.isInteger(chartMeta.chartIdx) ? chartMeta.chartIdx : 0,
          title: String(chartMeta.title || ''),
          anchors: chartMeta.anchors && typeof chartMeta.anchors === 'object' ? { ...chartMeta.anchors } : {},
          metric: String(chartMeta.metric || 'hours'),
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

export function getFileTypeTag(mime = '', name = '') {
  const m = String(mime || '').toLowerCase();
  const n = String(name || '');
  if (m === 'application/pdf' || /\.pdf$/i.test(n)) return 'PDF';
  if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(n)) return 'IMG';
  if (m.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(n)) return 'VID';
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

export function removeCorkPin(pinId, opts = {}) {
  const current = ensureCorkPinsInitialized(opts);
  const target = current.find((p) => p.id === pinId);
  const next = current.filter((p) => p.id !== pinId);
  const saved = saveCorkPins(next, opts);
  if (target?.fileMeta?.blobId) {
    deleteCorkBlob(target.fileMeta.blobId).catch(() => {});
  }
  return { ...saved, removed: target || null };
}

// --- Almacenamiento de blobs locales en IndexedDB (evita QuotaExceededError en localStorage) ---
const CORK_BLOB_DB_NAME = 'trafigator_cork_blobs_v1';
const CORK_BLOB_STORE = 'blobs';
let corkBlobDbPromise = null;
const blobObjectUrlCache = new Map();

export function revokeCorkBlobObjectUrl(blobId) {
  const key = String(blobId || '');
  if (!key || !blobObjectUrlCache.has(key)) return;
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
  try {
    const rec = await getCorkBlob(key);
    if (!rec?.blob) return null;
    const url = URL.createObjectURL(rec.blob);
    blobObjectUrlCache.set(key, url);
    return url;
  } catch {
    return null;
  }
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
