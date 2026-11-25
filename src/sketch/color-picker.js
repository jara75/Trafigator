/**
 * Reusable 7-spectrum × 5-shade long-press Obsidian color picker.
 * Quick click selects the family base color; long-press (~280ms) or right-click
 * opens a floating 5-shade capsule above the swatch.
 */

import { escapeHtml } from './store.js';

export const SPECTRUM_COLOR_FAMILIES = [
  { id: 'coral', name: 'Coral', shades: ['#fda4af', '#fb7185', '#f43f5e', '#e11d48', '#be123c'] },
  { id: 'amber', name: 'Ámbar', shades: ['#fcd34d', '#fbbf24', '#f59e0b', '#fb923c', '#ea580c'] },
  { id: 'lime', name: 'Lima', shades: ['#d9f99d', '#bef264', '#a3e635', '#84cc16', '#65a30d'] },
  { id: 'emerald', name: 'Esmeralda', shades: ['#6ee7b7', '#34d399', '#10b981', '#2dd4bf', '#14b8a6'] },
  { id: 'cyan', name: 'Cian', shades: ['#7dd3fc', '#38bdf8', '#0ea5e9', '#60a5fa', '#3b82f6'] },
  { id: 'violet', name: 'Violeta', shades: ['#c4b5fd', '#a78bfa', '#8b5cf6', '#818cf8', '#6366f1'] },
  { id: 'magenta', name: 'Magenta', shades: ['#f9a8d4', '#f472b6', '#ec4899', '#e879f9', '#c026d3'] },
];

export function getSpectrumColorName(hex) {
  const norm = String(hex || '').toLowerCase();
  for (const fam of SPECTRUM_COLOR_FAMILIES) {
    const idx = fam.shades.findIndex((s) => s.toLowerCase() === norm);
    if (idx !== -1) {
      const tone = ['Muy claro', 'Claro', '', 'Intenso', 'Profundo'][idx];
      return tone ? `${fam.name} · ${tone}` : fam.name;
    }
  }
  return 'Personalizado';
}

/**
 * Render the 7-circle spectrum picker HTML into a container.
 */
export function renderSpectrumColorPickerHtml({
  selectedHex,
  usedByMap = new Map(),
  pickerId = 'spectrum-picker',
} = {}) {
  const normSel = String(selectedHex || '').toLowerCase();

  return `
    <div id="${escapeHtml(pickerId)}" class="relative space-y-1.5 select-none">
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          ${SPECTRUM_COLOR_FAMILIES.map((fam) => {
            const matchIdx = fam.shades.findIndex((s) => s.toLowerCase() === normSel);
            const isFamActive = matchIdx !== -1;
            const displayHex = isFamActive ? fam.shades[matchIdx] : fam.shades[2];
            const usedOwner = usedByMap.get(displayHex.toLowerCase());
            const tip = usedOwner
              ? `${fam.name} (usado por ${usedOwner}) · Mantén presionado para ver 5 tonos`
              : `${fam.name} · Mantén presionado para ver 5 tonos`;

            return `
              <div class="relative" data-cp-fam-wrap="${fam.id}">
                <button type="button"
                  data-cp-fam="${fam.id}"
                  data-cp-base="${fam.shades[2]}"
                  title="${escapeHtml(tip)}"
                  class="relative w-5 h-5 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${isFamActive ? 'scale-115 ring-2 ring-[#D4D4D4] border-white' : 'border-white/20 opacity-85 hover:opacity-100 hover:scale-105'}"
                  style="background:${displayHex}">
                  ${usedOwner && !isFamActive ? '<span class="w-1.5 h-1.5 rounded-full bg-[#191919]/80"></span>' : ''}
                </button>
                <div data-cp-popover="${fam.id}"
                  class="hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 bg-[#252525] border border-obsidian-borderActive rounded-full px-2 py-1.5 shadow-2xl flex items-center gap-1.5">
                  ${fam.shades.map((sh, sIdx) => {
                    const isShadeSel = sh.toLowerCase() === normSel;
                    const shOwner = usedByMap.get(sh.toLowerCase());
                    const toneLbl = ['Muy claro', 'Claro', 'Base', 'Intenso', 'Profundo'][sIdx];
                    const shTip = shOwner ? `${fam.name} ${toneLbl} (usado por ${shOwner})` : `${fam.name} ${toneLbl}`;
                    return `
                      <button type="button" data-cp-shade="${sh}" title="${escapeHtml(shTip)}"
                        class="relative w-5 h-5 rounded-full border transition-transform cursor-pointer flex items-center justify-center ${isShadeSel ? 'scale-115 ring-2 ring-white border-white' : 'border-white/20 hover:scale-110'}"
                        style="background:${sh}">
                        ${shOwner && !isShadeSel ? '<span class="w-1.5 h-1.5 rounded-full bg-[#191919]/80"></span>' : ''}
                      </button>
                    `;
                  }).join('')}
                  <span class="w-px h-3.5 bg-obsidian-border mx-0.5"></span>
                  <button type="button" data-cp-close="1" title="Cerrar" class="w-4 h-4 rounded-full text-[#8C8C8C] hover:text-[#D4D4D4] hover:bg-obsidian-elevated flex items-center justify-center text-[10px] leading-none cursor-pointer">×</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        <span class="text-[9.5px] text-[#737373] shrink-0">Clic sostenido: 5 tonos</span>
      </div>
    </div>
  `;
}

/**
 * Bind quick-click + long-press (~280ms) shade popover interactions on a rendered spectrum picker.
 */
export function bindSpectrumColorPicker(container, onSelectHex, { pickerId = 'spectrum-picker' } = {}) {
  const root = container?.querySelector(`#${pickerId}`);
  if (!root) return;

  const closeAllPopovers = () => {
    root.querySelectorAll('[data-cp-popover]').forEach((p) => p.classList.add('hidden'));
  };

  root.querySelectorAll('[data-cp-fam]').forEach((btn) => {
    const famId = btn.dataset.cpFam;
    const baseHex = btn.dataset.cpBase;
    const pop = root.querySelector(`[data-cp-popover="${famId}"]`);
    let holdTimer = null;
    let didLongPress = false;

    const openPop = () => {
      closeAllPopovers();
      pop?.classList.remove('hidden');
    };

    btn.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      didLongPress = false;
      clearTimeout(holdTimer);
      holdTimer = setTimeout(() => {
        didLongPress = true;
        openPop();
      }, 280);
    });

    btn.addEventListener('pointerup', () => {
      clearTimeout(holdTimer);
      if (!didLongPress && baseHex) {
        closeAllPopovers();
        onSelectHex?.(baseHex);
      }
    });

    btn.addEventListener('pointerleave', () => {
      clearTimeout(holdTimer);
    });

    btn.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      clearTimeout(holdTimer);
      didLongPress = true;
      openPop();
    });
  });

  root.querySelectorAll('[data-cp-shade]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const hex = btn.dataset.cpShade;
      closeAllPopovers();
      if (hex) onSelectHex?.(hex);
    });
  });

  root.querySelectorAll('[data-cp-close]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeAllPopovers();
    });
  });

  const outsidePointerDown = (e) => {
    if (!root.isConnected) {
      document.removeEventListener('pointerdown', outsidePointerDown, true);
      document.removeEventListener('keydown', onEsc, true);
      return;
    }
    if (!e.target.closest('[data-cp-popover]') && !e.target.closest('[data-cp-fam]')) {
      closeAllPopovers();
    }
  };
  const onEsc = (e) => {
    if (!root.isConnected) {
      document.removeEventListener('keydown', onEsc, true);
      return;
    }
    if (e.key === 'Escape') {
      const anyOpen = Array.from(root.querySelectorAll('[data-cp-popover]')).some((p) => !p.classList.contains('hidden'));
      if (anyOpen) {
        e.stopPropagation();
        closeAllPopovers();
      }
    }
  };
  document.addEventListener('pointerdown', outsidePointerDown, true);
  document.addEventListener('keydown', onEsc, true);
}
