import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dbPath = process.env.TRAFICO_DB_PATH || '/tmp/trafico_security_p0.db';
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
process.env.TRAFICO_DB_PATH = dbPath;
process.env.IS_TEST = 'true';
delete process.env.BOLD_WEBHOOK_SECRET;

const { app } = await import('../src/server/index.js');
const { sqlite } = await import('../src/server/db/index.js');
const { uploadsDir } = await import('../src/server/services/upload-helper.js');

async function req(urlPath: string, init: RequestInit = {}, cookie?: string) {
  const headers = new Headers(init.headers || {});
  headers.set('Origin', 'http://localhost:3000');
  if (cookie) headers.set('cookie', cookie);
  const res = await app.fetch(new Request(`http://localhost:3000${urlPath}`, { ...init, headers }));
  const setCookie = res.headers.get('set-cookie') || '';
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, json, text, setCookie, headers: res.headers };
}

function extractCookie(setCookie: string): string {
  return setCookie
    .split(/,(?=\s*[^;]+=)/)
    .map((part) => part.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function signupAndCreateOrg(label: string, ts: number) {
  const signup = await req('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `Owner ${label}`,
      email: `owner_${label}_${ts}@sec.test`,
      password: 'Password123!',
    }),
  });
  assert.equal(signup.status, 200, `Signup ${label} debe devolver 200`);
  const cookie = extractCookie(signup.setCookie);
  const orgRes = await req(
    '/api/auth/organization/create',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Estudio ${label}`, slug: `estudio-${label}-${ts}` }),
    },
    cookie
  );
  assert.equal(orgRes.status, 200, `Create org ${label} debe devolver 200`);
  const orgId = orgRes.json.id as string;
  const setActive = await req(
    '/api/auth/organization/set-active',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId: orgId }),
    },
    cookie
  );
  assert.equal(setActive.status, 200);
  return { cookie, orgId, userId: signup.json.user.id as string };
}

const createdOrgDirs: string[] = [];

try {
  console.log('================================================================');
  console.log('TRAFIGATOR // SUITE DE SEGURIDAD P0 & AISLAMIENTO MULTI-TENANT');
  console.log('================================================================\n');

  const ts = Date.now();
  const orgA = await signupAndCreateOrg('A', ts);
  const orgB = await signupAndCreateOrg('B', ts);
  createdOrgDirs.push(path.join(uploadsDir, orgA.orgId), path.join(uploadsDir, orgB.orgId));

  // 1. /src/server/* nunca expuesto
  const srcRes = await req('/src/server/auth.ts');
  assert.ok(srcRes.status === 404 || srcRes.status === 403, `GET /src/server/auth.ts debe ser 404/403 (recibido ${srcRes.status})`);
  console.log('[1] GET /src/server/auth.ts bloqueado ->', srcRes.status);

  // 2. Webhook Bold fail-closed (503 sin env, 401 firma inválida, 200 HMAC válido)
  const whPayload = JSON.stringify({ status: 'APPROVED', organizationId: orgA.orgId });
  const whNoSecret = await req('/api/billing/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: whPayload,
  });
  assert.equal(whNoSecret.status, 503, 'Webhook sin BOLD_WEBHOOK_SECRET debe responder 503');

  process.env.BOLD_WEBHOOK_SECRET = 'test_bold_secret_p0_12345';
  const whNoHeader = await req('/api/billing/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: whPayload,
  });
  assert.equal(whNoHeader.status, 401, 'Webhook sin firma debe responder 401');

  const whBadSig = await req('/api/billing/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bold-signature': 'deadbeef' },
    body: whPayload,
  });
  assert.equal(whBadSig.status, 401, 'Webhook con firma inválida debe responder 401');

  const validHmac = crypto.createHmac('sha256', process.env.BOLD_WEBHOOK_SECRET).update(whPayload).digest('hex');
  const whOk = await req('/api/billing/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-bold-signature': validHmac },
    body: whPayload,
  });
  assert.equal(whOk.status, 200, 'Webhook con HMAC válido debe responder 200');
  console.log('[2] Webhook Bold fail-closed (503 / 401 / 200 HMAC) OK');

  // 3. Org A sube 2 archivos (1 compartido + 1 borrador privado) y sincroniza OT + cliente + status + strip
  const fShared = new FormData();
  fShared.append('ot_id', 'OT-SEC-A1');
  fShared.append('file', new File([Buffer.from('SHARED_PNG_DATA')], 'compartida.png', { type: 'image/png' }));
  const upShared = await req('/api/studio/upload', { method: 'POST', body: fShared }, orgA.cookie);
  assert.equal(upShared.status, 200);
  const sharedMedia = upShared.json.mediaItem;
  assert.ok(sharedMedia.url.startsWith(`/uploads/${orgA.orgId}/OT-SEC-A1/`), 'Upload debe aislarse por organizationId');

  const fDraft = new FormData();
  fDraft.append('ot_id', 'OT-SEC-A1');
  fDraft.append('file', new File([Buffer.from('PRIVATE_DRAFT_DATA')], 'borrador_privado.png', { type: 'image/png' }));
  const upDraft = await req('/api/studio/upload', { method: 'POST', body: fDraft }, orgA.cookie);
  assert.equal(upDraft.status, 200);
  const draftMedia = upDraft.json.mediaItem;

  const syncA = await req(
    '/api/studio/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clients: [{ id: 'cli-org-a', name: 'Cliente A', color: 'emerald', brands: [] }],
        statuses: [{ id: 'st-org-a', name: 'Creativos', color: 'amber' }],
        orders: [
          {
            id: 'OT-SEC-A1',
            client: 'Cliente A',
            brand: 'Marca A',
            title: 'Campaña Confidencial A',
            brief: 'BRIEF_INTERNO_SECRETO',
            legalText: 'LEGAL_INTERNO_SECRETO',
            status: 'Creativos',
            mediaFiles: [sharedMedia, draftMedia],
            routes: [],
          },
        ],
        stripboard: {
          '2026-11-27': [{ id: 'strip-org-a', type: 'ot', otId: 'OT-SEC-A1', title: 'Bloque A' }],
        },
      }),
    },
    orgA.cookie
  );
  assert.equal(syncA.status, 200);

  // Compartir solo sharedMedia
  const shareRes = await req(
    '/api/studio/reviews/share',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ otId: 'OT-SEC-A1', mediaFileId: sharedMedia.id, reviewerLabel: 'Revisor A' }),
    },
    orgA.cookie
  );
  assert.equal(shareRes.status, 200);
  const tokenA = shareRes.json.token as string;

  // 4. Acceso a /uploads/*
  const upAnon = await req(sharedMedia.url);
  assert.equal(upAnon.status, 401, 'GET /uploads/* sin sesión ni token debe responder 401');

  const upCrossOrg = await req(sharedMedia.url, {}, orgB.cookie);
  assert.equal(upCrossOrg.status, 403, 'GET /uploads/* de Org A desde sesión de Org B debe responder 403');

  const upOwnerA = await req(sharedMedia.url, {}, orgA.cookie);
  assert.equal(upOwnerA.status, 200, 'GET /uploads/* desde dueño de Org A debe responder 200');
  assert.equal(upOwnerA.headers.get('x-content-type-options'), 'nosniff');

  const upWithToken = await req(`${sharedMedia.url}?reviewToken=${encodeURIComponent(tokenA)}`);
  assert.equal(upWithToken.status, 200, 'GET /uploads/* de pieza compartida con reviewToken válido debe responder 200');

  const upDraftWithToken = await req(`${draftMedia.url}?reviewToken=${encodeURIComponent(tokenA)}`);
  assert.equal(upDraftWithToken.status, 403, 'GET /uploads/* de borrador NO compartido con reviewToken debe responder 403');
  console.log('[3] Protección de /uploads/* (401 anónimo, 403 cross-org, 200 dueño/token, 403 borrador) OK');

  // 5. Revisión pública: no filtra borradores ni campos internos, ni marca a Org B como 'agency'
  const pubOrgB = await req(`/api/public/review/${tokenA}`, {}, orgB.cookie);
  assert.equal(pubOrgB.status, 200);
  assert.equal(pubOrgB.json.viewerSession.isAgency, false, 'Usuario de Org B NO debe ser isAgency en review de Org A');
  assert.equal(pubOrgB.json.order.brief, undefined, 'order.brief interno no debe filtrarse en review pública');
  assert.equal(pubOrgB.json.order.legal_text, undefined, 'order.legal_text interno no debe filtrarse');
  const exposedIds = (pubOrgB.json.mediaFiles || []).map((m: any) => m.id);
  assert.ok(exposedIds.includes(sharedMedia.id), 'Pieza compartida debe estar presente');
  assert.ok(!exposedIds.includes(draftMedia.id), 'Borrador NO compartido NO debe exponerse en mediaFiles');

  const pinFromOrgB = await req(
    `/api/public/review/${tokenA}/threads`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaFileId: sharedMedia.id,
        xPercent: 0.2,
        yPercent: 0.3,
        content: 'Intento de suplantar agencia desde Org B',
        authorName: 'Externo B',
      }),
    },
    orgB.cookie
  );
  assert.equal(pinFromOrgB.status, 201);
  assert.equal(pinFromOrgB.json.message.authorRole, 'client', 'Usuario de Org B debe registrarse como client, nunca agency');

  const pubOrgA = await req(`/api/public/review/${tokenA}`, {}, orgA.cookie);
  assert.equal(pubOrgA.json.viewerSession.isAgency, true, 'Usuario de Org A sí es isAgency');
  console.log('[4] GET /api/public/review/:token y resolveHybridAuthor aislados por org OK');

  // 6. Cross-tenant en sync, upload, open-native y reviews
  const badJsonSync = await req(
    '/api/studio/sync',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{invalid-json' },
    orgB.cookie
  );
  assert.equal(badJsonSync.status, 400, 'JSON inválido en /sync debe devolver 400');

  const syncCrossClient = await req(
    '/api/studio/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clients: [{ id: 'cli-org-a', name: 'Secuestrado' }] }),
    },
    orgB.cookie
  );
  assert.equal(syncCrossClient.status, 403, 'Sync cross-tenant en clients debe devolver 403');

  const syncCrossStrip = await req(
    '/api/studio/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stripboard: { '2026-11-27': [{ id: 'strip-org-a', title: 'Hijack' }] } }),
    },
    orgB.cookie
  );
  assert.equal(syncCrossStrip.status, 403, 'Sync cross-tenant en stripboard debe devolver 403');

  const syncCrossMedia = await req(
    '/api/studio/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders: [{ id: 'OT-SEC-B1', client: 'Cli B', title: 'OT B', mediaFiles: [{ id: sharedMedia.id, name: 'hijack.png' }] }],
      }),
    },
    orgB.cookie
  );
  assert.equal(syncCrossMedia.status, 403, 'Sync cross-tenant en media_files debe devolver 403');

  const fCrossUpload = new FormData();
  fCrossUpload.append('ot_id', 'OT-SEC-A1');
  fCrossUpload.append('file', new File([Buffer.from('HIJACK')], 'hijack.png', { type: 'image/png' }));
  const upCrossOt = await req('/api/studio/upload', { method: 'POST', body: fCrossUpload }, orgB.cookie);
  assert.equal(upCrossOt.status, 403, 'Upload a OT de otra organización debe devolver 403');

  const openCross = await req(
    '/api/studio/open-native',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrl: sharedMedia.url }) },
    orgB.cookie
  );
  assert.equal(openCross.status, 403, 'open-native cross-tenant debe devolver 403');

  const openTraversal = await req(
    '/api/studio/open-native',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrl: '/uploads/../../package.json' }) },
    orgA.cookie
  );
  assert.equal(openTraversal.status, 403, 'open-native con path traversal debe devolver 403');

  const revokeCross = await req(`/api/studio/reviews/share/${tokenA}/revoke`, { method: 'PATCH' }, orgB.cookie);
  assert.equal(revokeCross.status, 404, 'Revocar enlace de otra org debe devolver 404');

  // 7. Rol 'client' dentro de Org A no puede subir, compartir, revocar, abrir nativo ni cambiar work_orders.client
  const clientSignup = await req('/api/auth/sign-up/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Usuario Cliente A',
      email: `client_a_${ts}@sec.test`,
      password: 'Password123!',
    }),
  });
  assert.equal(clientSignup.status, 200);
  const clientCookie = extractCookie(clientSignup.setCookie);
  const clientUserId = clientSignup.json.user.id as string;
  sqlite
    .prepare(
      `INSERT INTO members (id, organization_id, user_id, role, status, role_title, allowed_client_id, created_at)
       VALUES (?, ?, ?, 'client', 'active', 'Cliente', 'cli-org-a', ?)`
    )
    .run(`mem-client-${ts}`, orgA.orgId, clientUserId, Date.now());
  await req(
    '/api/auth/organization/set-active',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ organizationId: orgA.orgId }) },
    clientCookie
  );

  const clientShare = await req(
    '/api/studio/reviews/share',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otId: 'OT-SEC-A1', mediaFileId: sharedMedia.id }) },
    clientCookie
  );
  assert.equal(clientShare.status, 403, 'Rol client no puede crear enlaces de revisión');

  const clientUpload = await req('/api/studio/upload', { method: 'POST', body: fCrossUpload }, clientCookie);
  assert.equal(clientUpload.status, 403, 'Rol client no puede subir archivos');

  const clientOpenNative = await req(
    '/api/studio/open-native',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileUrl: sharedMedia.url }) },
    clientCookie
  );
  assert.equal(clientOpenNative.status, 403, 'Rol client no puede invocar open-native');

  const clientSyncAlter = await req(
    '/api/studio/sync',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orders: [{ id: 'OT-SEC-A1', client: 'OTRO_CLIENTE_NO_AUTORIZADO', title: 'Campaña Confidencial A', status: 'Creativos' }],
      }),
    },
    clientCookie
  );
  assert.equal(clientSyncAlter.status, 200);
  const otAfterClientSync = sqlite.prepare('SELECT client FROM work_orders WHERE id = ?').get('OT-SEC-A1') as { client: string };
  assert.equal(otAfterClientSync.client, 'Cliente A', 'Rol client NO debe poder alterar work_orders.client');

  console.log('[5] Bloqueos cross-tenant y RBAC (sync, upload, open-native, reviews, rol client) OK');
  console.log('\n================================================================');
  console.log('TODAS LAS PRUEBAS DE SEGURIDAD P0 PASARON (100%)');
  console.log('================================================================');
} finally {
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  for (const dir of createdOrgDirs) {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }
}
