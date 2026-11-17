import {
  clientsData,
  trafficOrders,
  sketchState,
  escapeHtml,
  notifySketchChange,
} from './store.js';

function createBrandInput(index, value = '') {
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `Marca/Producto ${index}`;
  input.value = value;
  input.className = 'w-full bg-[#222222] border border-obsidian-border rounded-lg px-2.5 py-1.5 text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none';
  return input;
}

function selectProduct(productName) {
  const productLabel = document.getElementById('product-select-label');
  if (!productLabel) return;
  if (productName) {
    productLabel.textContent = productName;
    productLabel.classList.remove('text-[#5a6169]');
    productLabel.classList.add('text-[#D4D4D4]');
  } else {
    productLabel.textContent = sketchState.selectedBrandName ? 'Institucional' : 'Elige marca...';
    productLabel.classList.remove('text-[#D4D4D4]');
    productLabel.classList.add('text-[#5a6169]');
  }
}

function renderProductOptions() {
  const productList = document.getElementById('product-dropdown-list');
  const productBtn = document.getElementById('product-select-btn');
  const productMenu = document.getElementById('product-dropdown-menu');
  if (!productList || !productBtn) return;

  const clientObj = clientsData.find((c) => c.name === sketchState.selectedClientName);
  const products = (clientObj && sketchState.selectedBrandName && clientObj.brands[sketchState.selectedBrandName]) || null;

  if (!products) {
    productBtn.disabled = true;
    productBtn.classList.add('opacity-50', 'cursor-not-allowed');
    productBtn.classList.remove('hover:border-[#3f3f3f]', 'cursor-pointer');
    productList.innerHTML = '';
    selectProduct(null);
    return;
  }

  productBtn.disabled = false;
  productBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  productBtn.classList.add('hover:border-[#3f3f3f]', 'cursor-pointer');
  const listWithDefault = products.includes('Institucional') ? products : ['Institucional', ...products];

  productList.innerHTML = listWithDefault.map((p) => `
    <button type="button" data-product-name="${escapeHtml(p)}" class="w-full px-2.5 py-1.5 text-left text-[11px] text-[#D4D4D4] hover:bg-obsidian-elevated transition-colors cursor-pointer">${escapeHtml(p)}</button>
  `).join('');

  productList.querySelectorAll('[data-product-name]').forEach((item) => {
    item.addEventListener('click', () => {
      selectProduct(item.dataset.productName);
      productMenu?.classList.add('hidden');
    });
  });

  selectProduct('Institucional');
}

function renderBrandOptions() {
  const brandList = document.getElementById('brand-dropdown-list');
  const brandBtn = document.getElementById('brand-select-btn');
  const brandMenu = document.getElementById('brand-dropdown-menu');
  if (!brandList || !brandBtn) return;

  const clientObj = clientsData.find((c) => c.name === sketchState.selectedClientName);
  if (!clientObj) {
    brandBtn.disabled = true;
    brandBtn.classList.add('opacity-50', 'cursor-not-allowed');
    brandBtn.classList.remove('hover:border-[#3f3f3f]', 'cursor-pointer');
    brandList.innerHTML = '';
    selectBrand(null);
    return;
  }

  brandBtn.disabled = false;
  brandBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  brandBtn.classList.add('hover:border-[#3f3f3f]', 'cursor-pointer');
  const brandNames = Object.keys(clientObj.brands);

  brandList.innerHTML = brandNames.map((b) => `
    <button type="button" data-brand-name="${escapeHtml(b)}" class="w-full px-2.5 py-1.5 text-left text-[11px] text-[#D4D4D4] hover:bg-obsidian-elevated transition-colors cursor-pointer">${escapeHtml(b)}</button>
  `).join('');

  brandList.querySelectorAll('[data-brand-name]').forEach((item) => {
    item.addEventListener('click', () => {
      selectBrand(item.dataset.brandName);
      if (brandMenu) brandMenu.classList.add('hidden');
    });
  });
}

function setClientModalColor(color) {
  const ncColorInput = document.getElementById('nc-color');
  if (ncColorInput) ncColorInput.value = color;
  document.querySelectorAll('.nc-color-swatch').forEach((sw) => {
    const active = sw.dataset.color === color;
    sw.classList.toggle('ring-2', active);
    sw.classList.toggle('ring-[#D4D4D4]', active);
    sw.classList.toggle('ring-offset-2', active);
    sw.classList.toggle('ring-offset-[#202020]', active);
  });
}

/**
 * Select a brand in the New OT selector and refresh product options.
 */
export function selectBrand(brandName) {
  const brandLabel = document.getElementById('brand-select-label');
  sketchState.selectedBrandName = brandName;
  if (brandLabel) {
    if (brandName) {
      brandLabel.textContent = brandName;
      brandLabel.classList.remove('text-[#5a6169]');
      brandLabel.classList.add('text-[#D4D4D4]');
    } else {
      brandLabel.textContent = sketchState.selectedClientName ? 'Seleccionar...' : 'Elige cliente...';
      brandLabel.classList.remove('text-[#D4D4D4]');
      brandLabel.classList.add('text-[#5a6169]');
    }
  }
  renderProductOptions();
}

/**
 * Select a client in the New OT selector and refresh brand/product options.
 */
export function selectClient(name) {
  const clientLabel = document.getElementById('client-select-label');
  sketchState.selectedClientName = name;
  if (clientLabel) {
    clientLabel.textContent = name;
    clientLabel.classList.remove('text-[#5a6169]');
    clientLabel.classList.add('text-[#D4D4D4]');
  }
  selectBrand(null);
  renderBrandOptions();
}

/**
 * Render the client dropdown list in the New OT form.
 */
export function renderClientOptions() {
  const clientList = document.getElementById('client-dropdown-list');
  const clientMenu = document.getElementById('client-dropdown-menu');
  if (!clientList) return;

  clientList.innerHTML = clientsData.map((c) => `
    <button type="button" data-client-name="${escapeHtml(c.name)}" class="w-full px-2.5 py-1.5 text-left text-[11px] text-[#D4D4D4] hover:bg-obsidian-elevated transition-colors cursor-pointer">${escapeHtml(c.name)}</button>
  `).join('');

  clientList.querySelectorAll('[data-client-name]').forEach((item) => {
    item.addEventListener('click', () => {
      selectClient(item.dataset.clientName);
      if (clientMenu) clientMenu.classList.add('hidden');
    });
  });
}

/**
 * Open the Create/Edit Client modal.
 */
export function openClientModal(clientToEdit = null) {
  const clientMenu = document.getElementById('client-dropdown-menu');
  const brandMenu = document.getElementById('brand-dropdown-menu');
  const productMenu = document.getElementById('product-dropdown-menu');
  const clientModal = document.getElementById('new-client-modal');
  const clientModalTitle = document.getElementById('nc-modal-title');
  const clientForm = document.getElementById('new-client-form');
  const brandsList = document.getElementById('nc-brands-list');

  clientMenu?.classList.add('hidden');
  brandMenu?.classList.add('hidden');
  productMenu?.classList.add('hidden');

  sketchState.editingClientName = clientToEdit ? clientToEdit.name : null;
  if (clientModalTitle) {
    clientModalTitle.textContent = clientToEdit ? `Editar Cliente — ${clientToEdit.name}` : 'Nuevo Cliente';
  }

  clientForm?.reset();
  const nameInput = document.getElementById('nc-name');
  if (nameInput) nameInput.value = clientToEdit ? clientToEdit.name : '';
  setClientModalColor(clientToEdit?.color || '#38bdf8');

  if (brandsList) {
    brandsList.innerHTML = '';
    const existingBrands = clientToEdit ? Object.keys(clientToEdit.brands || {}) : [];
    const count = Math.max(2, existingBrands.length + (clientToEdit ? 1 : 0));
    for (let i = 0; i < count; i++) {
      brandsList.appendChild(createBrandInput(i + 1, existingBrands[i] || ''));
    }
  }

  if (clientModal) clientModal.classList.remove('hidden');
}

/**
 * Close the Create/Edit Client modal.
 */
export function closeClientModal() {
  const clientModal = document.getElementById('new-client-modal');
  sketchState.editingClientName = null;
  if (clientModal) clientModal.classList.add('hidden');
}

/**
 * Initialize Client/Brand/Product dropdowns and the #new-client-modal form.
 */
export function initClientModal() {
  const clientWrap = document.getElementById('client-dropdown-wrap');
  const clientBtn = document.getElementById('client-select-btn');
  const clientMenu = document.getElementById('client-dropdown-menu');

  const brandWrap = document.getElementById('brand-dropdown-wrap');
  const brandBtn = document.getElementById('brand-select-btn');
  const brandMenu = document.getElementById('brand-dropdown-menu');

  const productWrap = document.getElementById('product-dropdown-wrap');
  const productBtn = document.getElementById('product-select-btn');
  const productMenu = document.getElementById('product-dropdown-menu');

  const clientForm = document.getElementById('new-client-form');
  const brandsList = document.getElementById('nc-brands-list');
  const contactsList = document.getElementById('nc-contacts-list');
  const ncColorInput = document.getElementById('nc-color');

  renderClientOptions();
  renderBrandOptions();

  if (clientBtn && clientMenu) {
    clientBtn.addEventListener('click', () => {
      brandMenu?.classList.add('hidden');
      productMenu?.classList.add('hidden');
      clientMenu.classList.toggle('hidden');
    });
  }
  if (brandBtn && brandMenu) {
    brandBtn.addEventListener('click', () => {
      if (brandBtn.disabled) return;
      clientMenu?.classList.add('hidden');
      productMenu?.classList.add('hidden');
      brandMenu.classList.toggle('hidden');
    });
  }
  if (productBtn && productMenu) {
    productBtn.addEventListener('click', () => {
      if (productBtn.disabled) return;
      clientMenu?.classList.add('hidden');
      brandMenu?.classList.add('hidden');
      productMenu.classList.toggle('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (clientWrap && !clientWrap.contains(e.target)) clientMenu?.classList.add('hidden');
    if (brandWrap && !brandWrap.contains(e.target)) brandMenu?.classList.add('hidden');
    if (productWrap && !productWrap.contains(e.target)) productMenu?.classList.add('hidden');
  });

  document.querySelectorAll('.nc-color-swatch').forEach((sw) => {
    sw.addEventListener('click', () => setClientModalColor(sw.dataset.color));
  });

  document.getElementById('btn-open-new-client')?.addEventListener('click', () => openClientModal(null));
  document.getElementById('btn-close-client-modal')?.addEventListener('click', closeClientModal);
  document.getElementById('btn-cancel-client-modal')?.addEventListener('click', closeClientModal);

  const openActiveClientModal = () => {
    const clientObj = clientsData.find((c) => c.name === sketchState.selectedClientName);
    if (!clientObj) return;
    openClientModal(clientObj);
    const inputs = brandsList?.querySelectorAll('input');
    if (inputs && inputs.length > 0) inputs[inputs.length - 1].focus();
  };

  document.getElementById('btn-open-new-brand')?.addEventListener('click', openActiveClientModal);
  document.getElementById('btn-open-new-product')?.addEventListener('click', openActiveClientModal);

  document.getElementById('btn-add-brand')?.addEventListener('click', () => {
    if (!brandsList) return;
    const idx = brandsList.children.length + 1;
    const input = createBrandInput(idx);
    brandsList.appendChild(input);
    input.focus();
  });

  document.getElementById('btn-add-contact')?.addEventListener('click', () => {
    if (!contactsList) return;
    const idx = contactsList.children.length + 1;
    const card = document.createElement('div');
    card.className = 'bg-[#202020] border border-obsidian-border rounded-lg p-2 space-y-1.5';
    card.innerHTML = `
      <div class="text-[9.5px] font-mono uppercase text-[#8C8C8C]">Contacto ${idx}</div>
      <div class="grid grid-cols-2 gap-1.5">
        <input type="text" placeholder="Nombre" class="w-full bg-[#191919] border border-obsidian-border rounded px-2 py-1 text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none">
        <input type="text" placeholder="Celular" class="w-full bg-[#191919] border border-obsidian-border rounded px-2 py-1 text-[#D4D4D4] placeholder-[#5a6169] font-mono focus:border-[#3f3f3f] focus:outline-none">
        <input type="text" placeholder="WhatsApp" class="w-full bg-[#191919] border border-obsidian-border rounded px-2 py-1 text-[#D4D4D4] placeholder-[#5a6169] font-mono focus:border-[#3f3f3f] focus:outline-none">
        <input type="email" placeholder="Correo" class="w-full bg-[#191919] border border-obsidian-border rounded px-2 py-1 text-[#D4D4D4] placeholder-[#5a6169] focus:border-[#3f3f3f] focus:outline-none">
      </div>
    `;
    contactsList.appendChild(card);
  });

  clientForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('nc-name');
    const newName = nameInput?.value.trim();

    if (newName) {
      const newBrandNames = Array.from(brandsList?.querySelectorAll('input') || [])
        .map((inp) => inp.value.trim())
        .filter(Boolean);

      const buildBrandsMap = (names, prevMap = {}) => {
        const map = {};
        names.forEach((b) => {
          map[b] = prevMap[b] || ['Institucional'];
        });
        return map;
      };

      const selectedColor = ncColorInput?.value || '#38bdf8';
      let renamed = false;

      if (sketchState.editingClientName) {
        const oldName = sketchState.editingClientName;
        const existing = clientsData.find((c) => c.name === oldName);
        if (existing) {
          existing.name = newName;
          existing.color = selectedColor;
          existing.brands = buildBrandsMap(newBrandNames, existing.brands);

          if (oldName !== newName) {
            renamed = true;
            trafficOrders.forEach((order) => {
              if (order.client === oldName) {
                order.client = newName;
              }
            });
            if (sketchState.trafficFilter?.client === oldName) {
              sketchState.trafficFilter.client = newName;
            }
          }
        }
      } else {
        clientsData.push({ name: newName, color: selectedColor, brands: buildBrandsMap(newBrandNames) });
      }

      renderClientOptions();
      selectClient(newName);
      if (newBrandNames.length > 0) selectBrand(newBrandNames[newBrandNames.length - 1]);

      notifySketchChange('clients');
      if (renamed) {
        notifySketchChange('orders');
      }

      clientForm.reset();
    }

    closeClientModal();
  });
}
