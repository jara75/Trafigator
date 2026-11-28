/**
 * Persistencia local y validaciones de seguridad del Módulo Corcho (Paso 1):
 * - Lista plana en localStorage (`trafigator_corcho_items_v1`) sin RBAC ni partición multiusuario
 * - Binarios locales en IndexedDB (`trafigator_corcho_blobs_v1`, límite 15 MB por archivo)
 * - Validadores estrictos `normalizeSafeWebUrl` e `isSafeMediaSrc`
 */

export const CORCHO_STORAGE_KEY = 'trafigator_corcho_items_v1';
export const CORCHO_IDB_NAME = 'trafigator_corcho_blobs_v1';
export const CORCHO_IDB_STORE = 'blobs';
export const MAX_CORCHO_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

const UNSAFE_MEDIA_MIMES = new Set([
  'image/svg+xml',
  'text/html',
  'application/xhtml+xml',
  'text/javascript',
  'application/javascript',
]);

const UNSAFE_FILE_EXT_RE = /\.(svg|html?|xhtml|mjs|cjs|js)$/i;

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function normalizeSafeWebUrl(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return { ok: false, error: 'URL vacía.' };
  if (/^(javascript|data|vbscript|file):/i.test(trimmed)) {
    return { ok: false, error: 'Protocolo de enlace no permitido por seguridad.' };
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'Solo se permiten enlaces http:// o https://.' };
    }
    if (!parsed.hostname) {
      return { ok: false, error: 'Enlace sin dominio válido.' };
    }
    return {
      ok: true,
      url: parsed.href,
      domain: parsed.hostname.replace(/^www\./i, ''),
    };
  } catch {
    return { ok: false, error: 'Formato de enlace inválido.' };
  }
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
    const isSafeImg = /^data:image\/(?!svg\+xml\b)[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafeVid = /^data:video\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(trimmed);
    const isSafePdf = /^data:application\/pdf(?:;[^,]*)?,/i.test(trimmed);
    if (normKind === 'img' || normKind === 'image') return isSafeImg;
    if (normKind === 'vid' || normKind === 'video') return isSafeVid;
    if (normKind === 'pdf') return isSafePdf;
    return isSafeImg || isSafeVid || isSafePdf;
  }

  return false;
}

export function isUnsafeFileForCorcho(file) {
  const mime = String(file?.type || '').trim().toLowerCase().split(';')[0].trim();
  const name = String(file?.name || '').trim();
  if (mime && UNSAFE_MEDIA_MIMES.has(mime)) return true;
  if (UNSAFE_FILE_EXT_RE.test(name)) return true;
  return false;
}

export function getCorchoFileTag(mime = '', name = '') {
  const m = String(mime || '').trim().toLowerCase().split(';')[0].trim();
  const n = String(name || '');
  if ((m && UNSAFE_MEDIA_MIMES.has(m)) || UNSAFE_FILE_EXT_RE.test(n)) return 'ARCHIVO';
  if (m === 'application/pdf' || /\.pdf$/i.test(n)) return 'PDF';
  if ((m.startsWith('image/') && m !== 'image/svg+xml') || /\.(png|jpe?g|gif|webp|avif)$/i.test(n)) return 'IMG';
  if (m.startsWith('video/') || /\.(mp4|mov|webm|m4v)$/i.test(n)) return 'VID';
  if (m.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/i.test(n)) return 'AUD';
  if (/\.(docx?|txt|md|pages|csv|xlsx?|numbers)$/i.test(n)) return 'DOC';
  return 'ARCHIVO';
}

export function loadCorchoItems() {
  try {
    const raw = localStorage.getItem(CORCHO_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((it) => it && typeof it === 'object' && typeof it.id === 'string')
      .map((it) => ({
        id: it.id,
        type: it.type === 'link' || it.type === 'file' ? it.type : 'note',
        title: String(it.title || '').trim() || 'Sin título',
        content: String(it.content || ''),
        url: typeof it.url === 'string' ? it.url : null,
        fileMeta: it.fileMeta && typeof it.fileMeta === 'object' ? it.fileMeta : null,
        privateNotes: Array.isArray(it.privateNotes) ? it.privateNotes : [],
        status: it.status === 'archived' ? 'archived' : 'active',
        promotedOtIds: Array.isArray(it.promotedOtIds) ? it.promotedOtIds : [],
        createdAt: it.createdAt || new Date().toISOString(),
        archivedAt: it.archivedAt || null,
        updatedAt: it.updatedAt || it.createdAt || new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

export function saveCorchoItems(items) {
  try {
    localStorage.setItem(CORCHO_STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
    return { ok: true };
  } catch (err) {
    const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22);
    return {
      ok: false,
      error: isQuota
        ? 'Espacio local lleno (localStorage). Archiva o elimina fichas antes de guardar nuevas.'
        : 'No se pudo guardar en almacenamiento local.',
    };
  }
}

function openCorchoIdb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no está disponible en este navegador.'));
      return;
    }
    const req = indexedDB.open(CORCHO_IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(CORCHO_IDB_STORE)) {
        db.createObjectStore(CORCHO_IDB_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Error al abrir IndexedDB.'));
  });
}

export async function putBlob(id, blob) {
  const db = await openCorchoIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORCHO_IDB_STORE, 'readwrite');
    tx.objectStore(CORCHO_IDB_STORE).put({ id, blob, savedAt: new Date().toISOString() });
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Error guardando archivo en IndexedDB.'));
    };
  });
}

export async function getBlob(id) {
  if (!id) return null;
  const db = await openCorchoIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORCHO_IDB_STORE, 'readonly');
    const req = tx.objectStore(CORCHO_IDB_STORE).get(id);
    req.onsuccess = () => {
      db.close();
      resolve(req.result?.blob || null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error('Error leyendo archivo en IndexedDB.'));
    };
  });
}

export async function deleteBlob(id) {
  if (!id) return false;
  const db = await openCorchoIdb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CORCHO_IDB_STORE, 'readwrite');
    tx.objectStore(CORCHO_IDB_STORE).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Error eliminando archivo en IndexedDB.'));
    };
  });
}

function makeItemId() {
  return `cr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function addCorchoTextOrLink(rawInput) {
  const text = String(rawInput || '').trim();
  if (!text) return { ok: false, error: 'Escribe una nota o pega un enlace para ponerlo en el Corcho.' };

  const nowIso = new Date().toISOString();
  const isSingleToken = !/\s/.test(text);
  const looksLikeDangerousProto = isSingleToken && /^(javascript|data|vbscript|file):/i.test(text);
  if (looksLikeDangerousProto) {
    return { ok: false, error: 'Protocolo de enlace bloqueado por seguridad.' };
  }

  let item;
  if (isSingleToken && /^https?:\/\//i.test(text)) {
    const check = normalizeSafeWebUrl(text);
    if (!check.ok) return check;
    item = {
      id: makeItemId(),
      type: 'link',
      title: check.domain,
      content: '',
      url: check.url,
      fileMeta: null,
      privateNotes: [],
      status: 'active',
      promotedOtIds: [],
      createdAt: nowIso,
      archivedAt: null,
      updatedAt: nowIso,
    };
  } else {
    const firstLine = text.split(/\r?\n/).find((l) => l.trim()) || text;
    const title = firstLine.trim().slice(0, 80);
    item = {
      id: makeItemId(),
      type: 'note',
      title,
      content: text,
      url: null,
      fileMeta: null,
      privateNotes: [],
      status: 'active',
      promotedOtIds: [],
      createdAt: nowIso,
      archivedAt: null,
      updatedAt: nowIso,
    };
  }

  const items = loadCorchoItems();
  items.unshift(item);
  const saved = saveCorchoItems(items);
  if (!saved.ok) return saved;
  return { ok: true, item };
}

export async function addCorchoFile(file) {
  if (!file || typeof file !== 'object') {
    return { ok: false, error: 'Archivo inválido.' };
  }
  if (isUnsafeFileForCorcho(file)) {
    return { ok: false, error: `Archivo bloqueado por seguridad (${file.name}). No se permiten SVG, HTML ni scripts ejecutables.` };
  }
  if ((file.size || 0) > MAX_CORCHO_FILE_BYTES) {
    return { ok: false, error: `El archivo "${file.name}" supera el límite de 15 MB (${formatFileSize(file.size)}).` };
  }

  const nowIso = new Date().toISOString();
  const id = makeItemId();
  const blobId = `blob-${id}`;

  try {
    await putBlob(blobId, file);
  } catch (err) {
    const isQuota = err && (err.name === 'QuotaExceededError' || err.code === 22);
    return {
      ok: false,
      error: isQuota
        ? 'Sin espacio en IndexedDB para guardar este archivo.'
        : 'No se pudo guardar el archivo en el almacenamiento local.',
    };
  }

  const item = {
    id,
    type: 'file',
    title: String(file.name || 'Archivo').trim(),
    content: '',
    url: null,
    fileMeta: {
      name: String(file.name || 'Archivo'),
      mime: String(file.type || 'application/octet-stream'),
      size: Number(file.size || 0),
      sizeLabel: formatFileSize(file.size || 0),
      blobId,
    },
    privateNotes: [],
    status: 'active',
    promotedOtIds: [],
    createdAt: nowIso,
    archivedAt: null,
    updatedAt: nowIso,
  };

  const items = loadCorchoItems();
  items.unshift(item);
  const saved = saveCorchoItems(items);
  if (!saved.ok) {
    await deleteBlob(blobId).catch(() => {});
    return saved;
  }
  return { ok: true, item };
}
