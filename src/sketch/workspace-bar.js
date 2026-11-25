import {
  escapeHtml,
  getActiveWorkspaces,
  notifySketchChange,
  onSketchChange,
  setActiveWorkspace,
  sketchState,
  trafficOrders,
} from './store.js';

/**
 * Barra inferior de Espacios (estilo DaVinci Resolve):
 *   Estudio | ● Publicidad (n) | ● Web (n) | ● Software (n)
 * Visible solo con 2+ espacios activos y fuera de Ajustes.
 */
export function initWorkspaceBar() {
  const bar = document.getElementById('workspace-bar');
  if (!bar) return;

  const openCount = (wsId) => trafficOrders.filter((o) => !o.archived && (wsId === 'studio' || o.workspaceId === wsId)).length;

  const render = () => {
    const active = getActiveWorkspaces();
    const visible = active.length >= 2;
    bar.classList.toggle('hidden', !visible);
    if (!visible) return;

    const current = sketchState.activeWorkspaceId || 'studio';
    const tab = (id, label, color, count) => {
      const isActive = id === current;
      const countStyle = color ? ` style="color:${escapeHtml(color)}"` : '';
      const countClass = color
        ? (isActive ? 'font-semibold' : 'opacity-85')
        : (isActive ? 'text-obsidian-amber font-semibold' : 'text-[#8C8C8C]');
      return `
        <button type="button" data-workspace-tab="${escapeHtml(id)}"
          class="h-6 px-3 rounded-md text-[11px] flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer ${isActive ? 'bg-obsidian-elevated text-[#D4D4D4] font-medium' : 'text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated/60'}">
          <span>${escapeHtml(label)}</span>
          <span class="font-mono text-[9.5px] ${countClass}"${countStyle}>${count}</span>
        </button>
      `;
    };

    bar.innerHTML = [
      tab('studio', 'Estudio', null, openCount('studio')),
      '<span class="w-px h-4 bg-obsidian-border shrink-0"></span>',
      ...active.map((p) => tab(p.id, p.shortName || p.name, p.color, openCount(p.id))),
    ].join('');

    bar.querySelectorAll('[data-workspace-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.workspaceTab;
        const settingsEl = document.getElementById('settings-modal');
        const inSettings = !!(settingsEl && !settingsEl.classList.contains('hidden'));
        if (next === (sketchState.activeWorkspaceId || 'studio') && !inSettings) return;
        setActiveWorkspace(next);
        if (inSettings) {
          document.getElementById('btn-close-settings-modal')?.click();
        }
        const myOtsEl = document.getElementById('view-my-ots');
        const reviewEl = document.getElementById('view-review');
        const inOtDetail = !!(myOtsEl && !myOtsEl.classList.contains('hidden') && sketchState.myOtsMode === 'cards');
        const inReview = !!(reviewEl && !reviewEl.classList.contains('hidden'));
        if (inOtDetail || inReview) {
          document.querySelector('.ot-sub-btn[data-ot-view="traffic"]')?.click();
        }
        notifySketchChange('orders');
        notifySketchChange('stripboard');
        notifySketchChange('gallery');
      });
    });
  };

  onSketchChange('workspace', render);
  onSketchChange('orders', render);

  render();
}
