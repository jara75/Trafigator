/**
 * Motor del Módulo de Estadísticas — Trafigator (v3)
 * Basado en docs/arquitectura_del_m_dulo_estad_sticas_cuaternio_y_trialidades-3.md:
 * - Regla de Nodos Hoja (5.1): cero duplicación de horas entre OT padre y Tareas hijas.
 * - Universos LIVE vs THROUGHPUT (5.2).
 * - Filtros en cascada / composición de anclas (4.1).
 * - Proyección automática por defecto según el ancla (5.3).
 * - Presets predeterminados por rol y RBAC (6 y 7).
 */

import {
  getActiveWorkspaces,
  getClientColor,
  getDepartmentColor,
  getStageColor,
  getStatusColor,
  getWorkspaceById,
  relDate,
  shiftIsoDate,
  studioSettings,
  studioTeamList,
  trafficMembers,
  userAccounts,
  userProfile,
} from './store.js';

export const LIVE_STATUSES = new Set(['Activa', 'En proceso', 'En Proceso', 'Suspendida']);
export const THROUGHPUT_STATUSES = new Set(['Activa', 'En proceso', 'En Proceso', 'Suspendida', 'Terminada', 'Archivada']);
export const FINANCIAL_STAGES = new Set(['Cerrar OT y Facturar', 'Facturada', 'Pagada']);

export const GROUP_LABELS = {
  client: 'Cliente',
  workspace: 'Perfil',
  department: 'Depto',
  priority: 'Prioridad',
  responsible: 'Responsable',
  stage: 'Etapa',
  status: 'Estado',
};

export const METRIC_LABELS = {
  ots: 'OTs',
  tasks: 'Tareas',
  hours: 'Horas',
};

export const PRIORITY_META = {
  urgent: { label: 'Urgentes', color: '#fb7185' },
  regular: { label: 'No urgentes', color: '#8C8C8C' },
};

export const TIME_FILTER_OPTIONS = [
  { value: 'yesterday_today_tomorrow', label: 'Ayer / Hoy / Mañana' },
  { value: 'today', label: 'Hoy' },
  { value: 'tomorrow', label: 'Mañana' },
  { value: 'prev_this_next_week', label: 'Sem. ant. / Esta / Próx.' },
  { value: 'this_week', label: 'Esta semana' },
  { value: 'next_week', label: 'Próxima semana' },
];

export const TIME_FILTER_LABELS = Object.fromEntries(TIME_FILTER_OPTIONS.map((o) => [o.value, o.label]));

function getMondayIso(iso) {
  const d = new Date(`${iso}T12:00:00`);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function matchesTimeFilter(dateIso, timeKey, todayKey = relDate(0).slice(0, 10)) {
  if (!timeKey || timeKey === 'all') return true;
  const d = String(dateIso || '').slice(0, 10);
  if (!d) return false;
  if (timeKey === 'today') return d === todayKey;
  if (timeKey === 'tomorrow') return d === shiftIsoDate(todayKey, 1);
  if (timeKey === 'yesterday_today_tomorrow') {
    return d >= shiftIsoDate(todayKey, -1) && d <= shiftIsoDate(todayKey, 1);
  }
  const thisMon = getMondayIso(todayKey);
  if (timeKey === 'this_week') return d >= thisMon && d <= shiftIsoDate(thisMon, 6);
  if (timeKey === 'next_week') return d >= shiftIsoDate(thisMon, 7) && d <= shiftIsoDate(thisMon, 13);
  if (timeKey === 'prev_this_next_week') return d >= shiftIsoDate(thisMon, -7) && d <= shiftIsoDate(thisMon, 13);
  return true;
}

export const DEFAULT_STATS_STATE = {
  preset: 'capacidad',     // 'capacidad' | 'espacio' | 'clientes' | 'facturacion' | 'custom'
  groupBy: 'responsible',  // 'client' | 'workspace' | 'department' | 'priority' | 'responsible' | 'stage' | 'status'
  manualGroupBy: false,    // true when user manually picked Agrupar por; resets on preset click
  metric: 'hours',         // 'ots' | 'tasks' | 'hours'
  sortBy: 'desc',          // 'desc' | 'asc' | 'alpha'
  anchors: {
    workspace: 'all',
    client: 'all',
    department: 'all',
    stage: 'all',
    status: 'all',
    responsible: 'all',
    time: 'all',
    priority: 'all',       // 'all' | 'urgent' | 'regular'
  },
};

export function getStatsStorageKey() {
  const orgKey = String(studioSettings.initials || studioSettings.name || 'studio').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const userKey = String(userProfile.shortName || userProfile.email || 'user').toLowerCase().replace(/[^a-z0-9]+/g, '_');
  return `trafigator_stats_v3_${orgKey}_${userKey}`;
}

export function loadStatsState() {
  try {
    const saved = JSON.parse(localStorage.getItem(getStatsStorageKey()) || 'null');
    if (saved && typeof saved === 'object') {
      const merged = {
        ...DEFAULT_STATS_STATE,
        ...saved,
        anchors: {
          ...DEFAULT_STATS_STATE.anchors,
          ...(saved.anchors || {}),
        },
      };
      if (!GROUP_LABELS[merged.groupBy]) merged.groupBy = 'responsible';
      if (merged.preset === 'acuse') merged.preset = 'capacidad';
      if (!METRIC_LABELS[merged.metric]) merged.metric = 'hours';
      merged.anchors.priority = 'all';
      return merged;
    }
  } catch {
    // ignore storage errors
  }
  return {
    ...DEFAULT_STATS_STATE,
    anchors: { ...DEFAULT_STATS_STATE.anchors },
  };
}

export function saveStatsState(state) {
  try {
    localStorage.setItem(getStatsStorageKey(), JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

/**
 * RBAC capabilities derived from active userProfile (Section 7.2).
 */
export function getRoleCapabilities() {
  const role = String(userProfile.role || 'Dueño');
  const scope = String(userProfile.scope || 'Todo el estudio');
  const isOwner = role === 'Dueño';
  const isTrafficOrAdmin = role === 'Admin / Tráfico' || role === 'Tráfico';
  const isBilling = role === 'Facturación';
  const hasGlobalScope = isOwner || isTrafficOrAdmin || scope === 'Todo el estudio' || scope === 'Estudio';
  const canSeeFinancial = isOwner || isBilling;
  const canSeeStudioCapacity = isOwner || isTrafficOrAdmin || hasGlobalScope;

  return {
    role,
    isOwner,
    hasGlobalScope,
    canSeeFinancial,
    canSeeStudioCapacity,
    lockedMember: hasGlobalScope ? null : (userProfile.shortName || null),
  };
}

export function getMemberStatus(shortName) {
  const m = studioTeamList.find((x) => x.name === shortName);
  if (!m) return 'active';
  return m.status === 'Inactivo' || m.status === 'deactivated' ? 'deactivated' : 'active';
}

export function getMemberColor(name) {
  const acc = userAccounts.find((a) => a.shortName === name || a.fullName === name);
  return acc?.color || '#38bdf8';
}

/**
 * Resolve active universe (LIVE vs THROUGHPUT vs EXPLICIT) per Section 5.2.
 */
export function resolveUniverse(state) {
  if (state.anchors.status && state.anchors.status !== 'all') {
    return { mode: 'EXPLICIT', label: state.anchors.status };
  }
  if (state.preset === 'facturacion' || state.anchors.stage === 'Pagada') {
    return { mode: 'THROUGHPUT', label: 'Histórico · Cobro' };
  }
  return { mode: 'LIVE', label: 'Operación viva' };
}

function statusMatchesUniverse(status, universeMode, explicitStatus) {
  const norm = status || 'En proceso';
  if (universeMode === 'EXPLICIT') return norm === explicitStatus;
  if (universeMode === 'THROUGHPUT') return THROUGHPUT_STATUSES.has(norm);
  return LIVE_STATUSES.has(norm);
}

/**
 * Normalize an OT and its leaf nodes per Section 5.1 (Regla de Nodos Hoja).
 */
function buildNormalizedRecords(allOrders, universe) {
  const otRecords = [];
  const leafRecords = [];

  (allOrders || []).forEach((ot) => {
    const wsId = ot.workspaceId || 'diseno-publicidad';
    const otStatus = ot.archived ? 'Archivada' : (ot.status || 'En proceso');
    const otStage = ot.stage || (ot.archived ? 'Pagada' : (ot.department === 'Facturación' ? 'Cerrar OT y Facturar' : 'Tráfico'));
    const subtasks = Array.isArray(ot.subtasks) ? ot.subtasks : [];
    const hasSubtasks = subtasks.length > 0;

    // Derive OT hours strictly from leaf subtasks when present (5.1)
    let otHoursLive = 0;
    let otHoursThroughput = 0;

    if (hasSubtasks) {
      subtasks.forEach((st, idx) => {
        const stStatus = st.status || (ot.archived ? 'Terminada' : otStatus);
        const stStage = st.stage || (otStage === 'Recibida' ? 'Recibida' : 'Tráfico');
        const rawHours = Number(st.estimatedHours) || 0;
        const isCancelled = stStatus === 'Cancelada';
        const isPaused = stStatus === 'Suspendida';
        const isDone = stStatus === 'Terminada' || stStatus === 'Archivada';

        const hrsForLive = (isCancelled || isPaused || isDone) ? 0 : rawHours;
        const hrsForThroughput = isCancelled ? 0 : rawHours;

        otHoursLive += hrsForLive;
        otHoursThroughput += hrsForThroughput;

        leafRecords.push({
          kind: 'task',
          id: `${ot.id}-${idx + 1}`,
          otId: ot.id,
          taskIndex: idx,
          workspaceId: wsId,
          client: ot.client || 'Sin cliente',
          department: st.department || ot.department || '—',
          stage: stStage,
          status: stStatus,
          responsible: st.responsible || ot.responsible || 'Sin asignar',
          priority: (st.urgent || ot.urgent) ? 'urgent' : 'regular',
          deliveryDate: st.deliveryDate || ot.deliveryDate || '',
          entryDate: st.entryDate || ot.entryDate || '',
          hours: universe.mode === 'THROUGHPUT' ? hrsForThroughput : hrsForLive,
        });
      });
    } else {
      const rawHours = Number(ot.estimatedHours) || 0;
      const isCancelled = otStatus === 'Cancelada';
      const isPaused = otStatus === 'Suspendida';
      const isDone = otStatus === 'Archivada' || otStatus === 'Terminada';
      otHoursLive = (isCancelled || isPaused || isDone) ? 0 : rawHours;
      otHoursThroughput = isCancelled ? 0 : rawHours;

      leafRecords.push({
        kind: 'ot-leaf',
        id: ot.id,
        otId: ot.id,
        taskIndex: null,
        workspaceId: wsId,
        client: ot.client || 'Sin cliente',
        department: ot.department || '—',
        stage: otStage,
        status: otStatus,
        responsible: ot.responsible || 'Sin asignar',
        priority: ot.urgent ? 'urgent' : 'regular',
        deliveryDate: ot.deliveryDate || '',
        entryDate: ot.entryDate || '',
        hours: universe.mode === 'THROUGHPUT' ? otHoursThroughput : otHoursLive,
      });
    }

    otRecords.push({
      kind: 'ot',
      id: ot.id,
      otId: ot.id,
      workspaceId: wsId,
      client: ot.client || 'Sin cliente',
      department: ot.department || '—',
      stage: otStage,
      status: otStatus,
      responsible: ot.responsible || 'Sin asignar',
      priority: ot.urgent ? 'urgent' : 'regular',
      deliveryDate: ot.deliveryDate || '',
      entryDate: ot.entryDate || '',
      hours: universe.mode === 'THROUGHPUT' ? otHoursThroughput : otHoursLive,
    });
  });

  return { otRecords, leafRecords };
}

function recordMatchesAnchors(rec, anchors, { ignoreKey = null, topWorkspaceId = 'studio', rbac } = {}) {
  // RBAC enforcement (Section 7.2)
  if (rbac?.lockedMember && rec.responsible !== rbac.lockedMember) return false;
  if (!rbac?.canSeeFinancial && FINANCIAL_STAGES.has(rec.stage)) return false;

  // Workspace anchor (respect top workspace bar if anchor is 'all')
  if (ignoreKey !== 'workspace') {
    const effectiveWs = anchors.workspace !== 'all'
      ? anchors.workspace
      : (topWorkspaceId && topWorkspaceId !== 'studio' ? topWorkspaceId : 'all');
    if (effectiveWs !== 'all' && rec.workspaceId !== effectiveWs) return false;
  }
  if (ignoreKey !== 'client' && anchors.client !== 'all' && rec.client !== anchors.client) return false;
  if (ignoreKey !== 'department' && anchors.department !== 'all' && rec.department !== anchors.department) return false;
  if (ignoreKey !== 'stage' && anchors.stage !== 'all' && rec.stage !== anchors.stage) return false;
  if (ignoreKey !== 'status' && anchors.status !== 'all' && rec.status !== anchors.status) return false;
  if (ignoreKey !== 'responsible' && anchors.responsible !== 'all' && rec.responsible !== anchors.responsible) return false;
  if (ignoreKey !== 'time' && anchors.time && anchors.time !== 'all' && !matchesTimeFilter(rec.deliveryDate || rec.entryDate, anchors.time)) return false;
  if (ignoreKey !== 'priority' && anchors.priority !== 'all' && rec.priority !== anchors.priority) return false;
  return true;
}

/**
 * Automatic default projection per active anchor (Section 5.3),
 * skipping any dimension that is already fixed as an anchor.
 */
export function resolveAutoGroupBy(state, activeWorkspaceCount, topWorkspaceId = 'studio') {
  if (state.manualGroupBy && GROUP_LABELS[state.groupBy]) {
    return state.groupBy;
  }

  // Preset explicit projections
  if (state.preset === 'capacidad') return 'responsible';
  if (state.preset === 'facturacion') return 'stage';
  if (state.preset === 'clientes') {
    return state.anchors.client !== 'all' ? 'stage' : 'client';
  }
  if (state.preset === 'espacio') {
    const wsFixed = state.anchors.workspace !== 'all' || (topWorkspaceId && topWorkspaceId !== 'studio');
    if (!wsFixed && activeWorkspaceCount >= 2) return 'workspace';
    return state.anchors.department !== 'all' ? 'responsible' : 'department';
  }

  // Generic anchor-driven projection (Table 5.3)
  const a = state.anchors;
  const isFree = (dim) => {
    if (dim === 'workspace') return a.workspace === 'all' && (!topWorkspaceId || topWorkspaceId === 'studio');
    return a[dim] === 'all';
  };
  const pickFirstFree = (candidates, fallback = 'client') => candidates.find(isFree) || fallback;

  if (a.department !== 'all') return pickFirstFree(['responsible', 'client', 'status']);
  if (a.responsible !== 'all') return pickFirstFree(['client', 'department', 'stage']);
  if (a.client !== 'all') return pickFirstFree(['stage', 'responsible', 'workspace']);
  if (a.workspace !== 'all' || (topWorkspaceId && topWorkspaceId !== 'studio')) {
    return pickFirstFree(['department', 'client', 'stage']);
  }
  if (a.stage !== 'all') {
    return FINANCIAL_STAGES.has(a.stage)
      ? pickFirstFree(['client', 'responsible', 'workspace'])
      : pickFirstFree(['department', 'responsible', 'client']);
  }
  if (a.status !== 'all') {
    return (a.status === 'Activa' || a.status === 'En proceso')
      ? pickFirstFree(['responsible', 'client', 'workspace'])
      : pickFirstFree(['client', 'workspace', 'responsible']);
  }
  if (a.priority !== 'all') return pickFirstFree(['responsible', 'client', 'department']);

  return activeWorkspaceCount >= 2 ? 'workspace' : 'department';
}

function getGroupMeta(rec, groupBy, myMember) {
  if (groupBy === 'client') {
    return { key: rec.client, label: rec.client, color: getClientColor(rec.client) };
  }
  if (groupBy === 'department') {
    return { key: rec.department, label: rec.department, color: getDepartmentColor(rec.department) };
  }
  if (groupBy === 'stage') {
    return { key: rec.stage, label: rec.stage, color: getStageColor(rec.stage) };
  }
  if (groupBy === 'status') {
    return { key: rec.status, label: rec.status, color: getStatusColor(rec.status) };
  }
  if (groupBy === 'responsible') {
    const inactive = getMemberStatus(rec.responsible) === 'deactivated';
    const baseLabel = rec.responsible === myMember ? `${rec.responsible} (Tú)` : rec.responsible;
    return {
      key: rec.responsible,
      label: inactive ? `${baseLabel} (Inactivo)` : baseLabel,
      color: inactive ? '#fb7185' : getMemberColor(rec.responsible),
      inactive,
    };
  }
  if (groupBy === 'priority') {
    const meta = PRIORITY_META[rec.priority] || PRIORITY_META.regular;
    return { key: rec.priority, label: meta.label, color: meta.color };
  }
  const ws = getWorkspaceById(rec.workspaceId);
  return {
    key: rec.workspaceId,
    label: ws?.shortName || ws?.name || rec.workspaceId,
    color: ws?.color || '#f59e0b',
  };
}

/**
 * Main Quaternio query executor.
 * Returns cascading options, filtered totals, grouped rows, target metadata, and RBAC flags.
 */
export function runStatsQuery({
  allOrders,
  state,
  topWorkspaceId = 'studio',
  myMember = 'Andrés',
  forcePersonalMember = null,
  activePill = 'ots-active',
}) {
  const baseRbac = getRoleCapabilities();
  const rbac = forcePersonalMember
    ? {
        ...baseRbac,
        canSeeFinancial: false,
        canSeeStudioCapacity: false,
        lockedMember: forcePersonalMember,
      }
    : baseRbac;
  const activeWorkspaces = getActiveWorkspaces();
  const dailyHours = Number(studioSettings.dailyHours) || 8;

  // Enforce RBAC on financial preset & personal scope
  let nextPreset = state.preset;
  if (!rbac.canSeeFinancial && nextPreset === 'facturacion') {
    nextPreset = rbac.lockedMember ? 'clientes' : 'capacidad';
  }
  const effectiveState = {
    ...state,
    preset: nextPreset,
    anchors: { ...state.anchors },
  };
  if (rbac.lockedMember) {
    effectiveState.anchors.responsible = rbac.lockedMember;
  }

  const universe = resolveUniverse(effectiveState);
  const { otRecords, leafRecords } = buildNormalizedRecords(allOrders, universe);

  // Filter by universe first
  const universeOts = otRecords.filter((r) => statusMatchesUniverse(r.status, universe.mode, effectiveState.anchors.status));
  const universeLeaves = leafRecords.filter((r) => statusMatchesUniverse(r.status, universe.mode, effectiveState.anchors.status));

  // Primary pool for cascading options (use OTs for OTs metric, leaves for tasks/hours)
  const optionPool = effectiveState.metric === 'ots' ? universeOts : universeLeaves;

  // Compute cascading dropdown options (each filter sees values valid under all OTHER active anchors)
  const uniqueSorted = (arr, orderRef = null) => {
    const set = new Set(arr.filter(Boolean));
    if (!orderRef) return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
    return [
      ...orderRef.filter((v) => set.has(v)),
      ...Array.from(set).filter((v) => !orderRef.includes(v)).sort((a, b) => a.localeCompare(b, 'es')),
    ];
  };

  const getPoolExcluding = (key) => optionPool.filter((r) =>
    recordMatchesAnchors(r, effectiveState.anchors, { ignoreKey: key, topWorkspaceId, rbac })
  );

  const topWsLocked = !!(topWorkspaceId && topWorkspaceId !== 'studio');
  if (topWsLocked && effectiveState.anchors.workspace !== 'all') {
    effectiveState.anchors.workspace = 'all';
  }
  const wsPool = getPoolExcluding('workspace');
  const wsIds = new Set(wsPool.map((r) => r.workspaceId));

  // Build ordered department options strictly under the selected Perfil (disabled in Estudio when 2+ profiles)
  const deptPool = getPoolExcluding('department');
  const validDeptSet = new Set(deptPool.map((r) => r.department).filter(Boolean));
  const effectiveWsForDept = effectiveState.anchors.workspace !== 'all'
    ? effectiveState.anchors.workspace
    : (topWsLocked
        ? topWorkspaceId
        : (activeWorkspaces.length === 1 ? activeWorkspaces[0].id : 'all'));

  const departmentDisabled = effectiveWsForDept === 'all';
  let orderedDepts = [];
  if (!departmentDisabled) {
    const wsObj = getWorkspaceById(effectiveWsForDept);
    const refOrder = Array.isArray(wsObj?.departments) ? wsObj.departments : [];
    orderedDepts = uniqueSorted(Array.from(validDeptSet), refOrder);
  }

  // Hierarchy for Etapa & Estado under the active pastilla
  const isTasksPill = activePill === 'tasks-active' || activePill === 'tasks-urgent';
  const isFinalizadasPill = activePill === 'finalizadas';
  const allowedStageOrder = isTasksPill
    ? ['Tráfico', 'Recibida']
    : (isFinalizadasPill
        ? ['Cerrar OT y Facturar', 'Facturada', 'Pagada']
        : ['Tráfico', 'Recibida', 'Cerrar OT y Facturar', 'Facturada', 'Pagada']);
  const allowedStageSet = new Set(allowedStageOrder);

  const stagePool = (isTasksPill ? universeLeaves.filter((r) => r.kind === 'task') : (isFinalizadasPill ? otRecords : optionPool))
    .filter((r) => recordMatchesAnchors(r, effectiveState.anchors, { ignoreKey: 'stage', topWorkspaceId, rbac }))
    .map((r) => r.stage)
    .filter((s) => allowedStageSet.has(s));

  const allowedStatusOrder = isFinalizadasPill
    ? ['En proceso', 'Archivada']
    : ['Activa', 'En proceso', 'Suspendida'];
  const allowedStatusSet = new Set(allowedStatusOrder);

  const statusSource = isTasksPill
    ? leafRecords.filter((r) => r.kind === 'task')
    : (isFinalizadasPill
        ? otRecords.filter((r) => r.status === 'Archivada' || FINANCIAL_STAGES.has(r.stage) || r.department === 'Facturación')
        : otRecords);
  const statusPool = statusSource
    .filter((r) => recordMatchesAnchors(r, effectiveState.anchors, { ignoreKey: 'status', topWorkspaceId, rbac }))
    .map((r) => r.status)
    .filter((s) => allowedStatusSet.has(s));

  const isDayPill = activePill === 'today-hours' || activePill === 'tomorrow-hours';
  if (isDayPill && effectiveState.anchors.time !== 'all') {
    effectiveState.anchors.time = 'all';
  }

  const lockedWsObj = topWsLocked ? getWorkspaceById(topWorkspaceId) : null;
  const cascadingOptions = {
    workspace: activeWorkspaces
      .filter((w) => wsIds.has(w.id))
      .map((w) => ({ value: w.id, label: w.shortName || w.name })),
    workspaceDisabled: topWsLocked,
    workspaceLockedLabel: lockedWsObj?.shortName || lockedWsObj?.name || '',
    client: uniqueSorted(getPoolExcluding('client').map((r) => r.client)),
    department: orderedDepts,
    departmentDisabled,
    stage: uniqueSorted(stagePool, allowedStageOrder),
    status: uniqueSorted(statusPool, allowedStatusOrder),
    responsible: uniqueSorted(getPoolExcluding('responsible').map((r) => r.responsible), trafficMembers),
    time: TIME_FILTER_OPTIONS,
    timeDisabled: isDayPill,
    timeLockedLabel: activePill === 'today-hours' ? 'Hoy' : (activePill === 'tomorrow-hours' ? 'Mañana' : ''),
    priority: ['urgent', 'regular']
      .filter((pk) => getPoolExcluding('priority').some((r) => r.priority === pk))
      .map((pk) => ({ value: pk, label: PRIORITY_META[pk].label })),
  };

  // Auto-sanitize any anchor that no longer exists in cascading options
  const validOptionValues = {
    workspace: new Set(cascadingOptions.workspace.map((o) => o.value)),
    client: new Set(cascadingOptions.client),
    department: new Set(cascadingOptions.department),
    stage: new Set(cascadingOptions.stage),
    status: new Set(cascadingOptions.status),
    responsible: new Set(cascadingOptions.responsible),
    priority: new Set(cascadingOptions.priority.map((o) => o.value)),
  };
  let sanitized = false;
  Object.keys(validOptionValues).forEach((k) => {
    if (k === 'responsible' && rbac.lockedMember) return;
    const cur = effectiveState.anchors[k];
    if (cur !== 'all' && !validOptionValues[k].has(cur)) {
      effectiveState.anchors[k] = 'all';
      sanitized = true;
    }
  });

  // Final filtered sets
  const filteredOts = universeOts.filter((r) => recordMatchesAnchors(r, effectiveState.anchors, { topWorkspaceId, rbac }));
  const filteredLeaves = universeLeaves.filter((r) => recordMatchesAnchors(r, effectiveState.anchors, { topWorkspaceId, rbac }));
  const filteredTasks = filteredLeaves.filter((r) => r.kind === 'task');

  const resolvedGroupBy = resolveAutoGroupBy(effectiveState, activeWorkspaces.length, topWorkspaceId);

  // Aggregate by resolvedGroupBy using Leaf Node Rule (5.1)
  const groupMap = new Map();
  const ensureRow = (meta) => {
    if (!groupMap.has(meta.key)) {
      groupMap.set(meta.key, { ...meta, ots: 0, tasks: 0, hours: 0 });
    }
    return groupMap.get(meta.key);
  };

  filteredOts.forEach((o) => {
    const row = ensureRow(getGroupMeta(o, resolvedGroupBy, myMember));
    row.ots += 1;
  });

  filteredLeaves.forEach((l) => {
    const row = ensureRow(getGroupMeta(l, resolvedGroupBy, myMember));
    if (l.kind === 'task') row.tasks += 1;
    row.hours += l.hours;
  });

  // Ensure active internal team members appear in Capacidad even if 0h (Section 7.2)
  if (resolvedGroupBy === 'responsible' && effectiveState.preset === 'capacidad' && !rbac.lockedMember && effectiveState.anchors.responsible === 'all') {
    studioTeamList
      .filter((m) => m.status === 'Activo')
      .forEach((m) => {
        ensureRow(getGroupMeta({ responsible: m.name }, 'responsible', myMember));
      });
  }

  const rows = Array.from(groupMap.values()).map((r) => ({
    ...r,
    value: effectiveState.metric === 'ots' ? r.ots : (effectiveState.metric === 'tasks' ? r.tasks : r.hours),
  }));

  if (resolvedGroupBy === 'stage') {
    const stageOrder = ['Tráfico', 'Recibida', 'Cerrar OT y Facturar', 'Facturada', 'Pagada'];
    rows.sort((a, b) => {
      const ia = stageOrder.indexOf(a.key);
      const ib = stageOrder.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  } else {
    rows.sort((a, b) => b.value - a.value || b.ots - a.ots || a.label.localeCompare(b.label, 'es'));
  }

  const totalMetricVal = rows.reduce((s, r) => s + r.value, 0);
  const maxRowVal = Math.max(1, ...rows.map((r) => r.value));
  const totalHours = filteredLeaves.reduce((s, l) => s + l.hours, 0);

  // Target line only for Capacidad (Horas por Responsable vs weekly capacity dailyHours * 5)
  const showTargetLine = resolvedGroupBy === 'responsible' && effectiveState.metric === 'hours';
  const targetVal = dailyHours * 5;

  // Active anchor chips
  const activeAnchorChips = [];
  if (effectiveState.anchors.workspace !== 'all') {
    const ws = getWorkspaceById(effectiveState.anchors.workspace);
    activeAnchorChips.push({ key: 'workspace', label: `Perfil: ${ws?.shortName || ws?.name || effectiveState.anchors.workspace}` });
  }
  if (effectiveState.anchors.client !== 'all') activeAnchorChips.push({ key: 'client', label: `Cliente: ${effectiveState.anchors.client}` });
  if (effectiveState.anchors.department !== 'all') activeAnchorChips.push({ key: 'department', label: `Depto: ${effectiveState.anchors.department}` });
  if (effectiveState.anchors.stage !== 'all') activeAnchorChips.push({ key: 'stage', label: `Etapa: ${effectiveState.anchors.stage}` });
  if (effectiveState.anchors.status !== 'all') activeAnchorChips.push({ key: 'status', label: `Estado: ${effectiveState.anchors.status}` });
  if (effectiveState.anchors.responsible !== 'all' && !rbac.lockedMember) {
    activeAnchorChips.push({ key: 'responsible', label: `Resp.: ${effectiveState.anchors.responsible}` });
  }
  if (effectiveState.anchors.time && effectiveState.anchors.time !== 'all') {
    activeAnchorChips.push({ key: 'time', label: `Tiempo: ${TIME_FILTER_LABELS[effectiveState.anchors.time] || effectiveState.anchors.time}` });
  }
  if (effectiveState.anchors.priority !== 'all') {
    activeAnchorChips.push({ key: 'priority', label: `Prior.: ${PRIORITY_META[effectiveState.anchors.priority]?.label || effectiveState.anchors.priority}` });
  }

  const chartTitle = `${METRIC_LABELS[effectiveState.metric] || 'OTs'} por ${GROUP_LABELS[resolvedGroupBy] || 'Cliente'}`;

  return {
    rbac,
    universe,
    resolvedGroupBy,
    chartTitle,
    cascadingOptions,
    rows,
    totalMetricVal,
    maxRowVal,
    totalOts: filteredOts.length,
    totalTasks: filteredTasks.length,
    totalHours,
    showTargetLine,
    targetVal,
    dailyHours,
    activeAnchorChips,
    hasActiveAnchors: activeAnchorChips.length > 0,
    sanitized,
    effectiveState,
  };
}
