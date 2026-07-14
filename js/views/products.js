/* ---------- Products & Toys ---------- */
import { db, storageService } from '../firebase-service.js';
import { showToast, escapeHtml, displayHostname } from '../utils.js';
import { PROD_STORAGE_KEY, PRODUCT_KNOWN_CATEGORIES, PRODUCT_CATEGORY_COLORS } from '../app.js';
import {
  isAdminUser,
  RENDER_FN_BY_SECTION,
  VIEW_MODES,
  buildTableWrap,
  starsHtml,
  showDetailsModal,
  openRequestRemovalModal,
  logActivity
} from '../shared.js';

export let productsData = [];
let editingProdId = null;
let currentStarsProd = 0;

const chipSelectProd = document.getElementById('chipSelectProd');
const catOtherInputProd = document.getElementById('pf-categoria-other');
let selectedChipsProd = new Set();

PRODUCT_KNOWN_CATEGORIES.forEach(cat=>{
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.textContent = cat;
  chip.dataset.value = cat;
  chip.addEventListener('click', ()=>{
    if(selectedChipsProd.has(cat)){ selectedChipsProd.delete(cat); chip.classList.remove('selected'); }
    else { selectedChipsProd.add(cat); chip.classList.add('selected'); }
  });
  chipSelectProd.appendChild(chip);
});

function setSelectedChipsProd(cats){
  selectedChipsProd = new Set(cats.filter(c=>PRODUCT_KNOWN_CATEGORIES.includes(c)));
  chipSelectProd.querySelectorAll('.chip').forEach(chip=>{
    chip.classList.toggle('selected', selectedChipsProd.has(chip.dataset.value));
  });
  const customOnes = cats.filter(c=>!PRODUCT_KNOWN_CATEGORIES.includes(c));
  catOtherInputProd.value = customOnes.join(', ');
}

function getSelectedCategoriesProd(){
  const custom = catOtherInputProd.value.split(',').map(s=>s.trim()).filter(Boolean);
  return Array.from(new Set([...selectedChipsProd, ...custom]));
}

const countRowProd = document.getElementById('countRowProd');
const gridAreaProd = document.getElementById('gridAreaProd');
const overlayProd = document.getElementById('overlayProd');
const searchInputProd = document.getElementById('searchInputProd');
const filterCatProd = document.getElementById('filterCatProd');

async function migrateLegacyProducts(){
  try{
    if(localStorage.getItem('ds-migrated-products')) return;
    const res = await storageService.get(PROD_STORAGE_KEY, true);
    const legacy = res && res.value ? JSON.parse(res.value) : [];
    if(legacy.length){
      await Promise.all(legacy.map(p=>{
        const id = p.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
        const {id: _drop, ...rest} = p;
        return db.collection('products').doc(id).set(rest);
      }));
      await storageService.delete(PROD_STORAGE_KEY, true);
    }
    localStorage.setItem('ds-migrated-products', '1');
  }catch(e){
    console.error('Legacy products migration failed (non-fatal)', e);
  }
}

export async function loadProductsData(){
  gridAreaProd.innerHTML = `<div class="empty-state">Loading...</div>`;
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await migrateLegacyProducts();
      const snap = await db.collection('products').get();
      productsData = snap.docs.map(d=>({ id: d.id, ...d.data() }));
      populateCategoryFilterProd();
      renderProd();
      return;
    }catch(e){
      console.error('loadProductsData failed (attempt '+attempt+')', e);
      if(attempt === 4){
        gridAreaProd.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg><div class="display">Temporary hiccup loading data</div><p>This looks like a brief slowdown on Claude's side, not lost data. Please try again in a moment.</p><button class="btn btn-primary" id="retryLoadBtnProd" style="margin-top:10px;">Try again</button></div>`;
        document.getElementById('retryLoadBtnProd').addEventListener('click', loadProductsData);
        return;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function saveProductDoc(id, payload){
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await db.collection('products').doc(id).set(payload);
      return true;
    }catch(e){
      console.error('saveProductDoc failed (attempt '+attempt+')', e);
      if(attempt === 4){
        showToast('Save failed: ' + (e && e.message ? e.message : 'unknown error'));
        return false;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function deleteProductDoc(id){
  try{
    await db.collection('products').doc(id).delete();
    return true;
  }catch(e){
    console.error('deleteProductDoc failed', e);
    showToast('Delete failed: ' + (e && e.message ? e.message : 'unknown error'));
    return false;
  }
}

export function populateCategoryFilterProd(){
  const all = productsData.flatMap(d => d.categorias || []);
  const cats = Array.from(new Set(all)).sort();
  const current = filterCatProd.value;
  filterCatProd.innerHTML = '<option value="">All categories</option>' +
    cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filterCatProd.value = current;
}

export function renderProd(){
  const q = searchInputProd.value.trim().toLowerCase();
  const cat = filterCatProd.value;

  let filtered = productsData.filter(p=>{
    const cats = p.categorias || [];
    const matchesCat = !cat || cats.includes(cat);
    const haystack = [p.nome, p.brand, p.observacoes, p.indicadoPor, cats.join(' ')].join(' ').toLowerCase();
    const matchesQ = !q || haystack.includes(q);
    return matchesCat && matchesQ;
  });

  countRowProd.textContent = productsData.length === 0
    ? ''
    : `${filtered.length} of ${productsData.length} product${productsData.length===1?'':'s'}`;

  if(productsData.length === 0){
    gridAreaProd.innerHTML = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="8" width="16" height="12" rx="2"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/></svg>
        <div class="display">No products added yet</div>
        <p>Add the first product to start the list.</p>
      </div>`;
    return;
  }

  if(filtered.length === 0){
    gridAreaProd.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></svg><div class="display">Nothing found</div><p>Try a different search or category.</p></div>`;
    return;
  }

  filtered.sort((a,b)=> a.nome.localeCompare(b.nome, 'en'));

  if(VIEW_MODES['products'] === 'table'){
    gridAreaProd.innerHTML = buildTableWrap(['Name','Categories','Brand','Price','NDIS','Link'], filtered.map(tableRowHtmlProd).join(''));
  }else{
    gridAreaProd.innerHTML = `<div class="grid">${filtered.map(cardHtmlProd).join('')}</div>`;
  }

  gridAreaProd.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>openProdModal(btn.getAttribute('data-edit')));
  });
  gridAreaProd.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>deleteProdItem(btn.getAttribute('data-del')));
  });
  gridAreaProd.querySelectorAll('[data-reqdel-product]').forEach(btn=>{
    btn.addEventListener('click', ()=>requestDeleteProduct(btn.getAttribute('data-reqdel-product')));
  });
  gridAreaProd.querySelectorAll('[data-details]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = productsData.find(x=>x.id===btn.getAttribute('data-details'));
      if(item) showDetailsModal(cardHtmlProd(item));
    });
  });
}

function tableRowHtmlProd(p){
  const cats = (p.categorias || []).join(', ');
  const linkCell = p.website
    ? `<a href="${escapeHtml(/^https?:\/\//i.test(p.website) ? p.website : 'https://'+p.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayHostname(p.website))}</a>`
    : '';
  return `<tr>
    <td><b>${escapeHtml(p.nome)}</b></td>
    <td>${escapeHtml(cats)}</td>
    <td>${p.brand ? escapeHtml(p.brand) : ''}</td>
    <td>${p.price ? escapeHtml(p.price) : ''}</td>
    <td style="text-align:center;">${p.ndisCovered ? '<span class="table-check">✓</span>' : ''}</td>
    <td>${linkCell}</td>
    <td class="table-actions">
      <button class="btn-edit" data-details="${p.id}">Details</button>
      <button class="btn-edit" data-edit="${p.id}">Edit</button>
      ${isAdminUser ? `<button class="btn-danger-text" data-del="${p.id}">Delete</button>` : `<button class="btn-edit" data-reqdel-product="${p.id}">Request removal</button>`}
    </td>
  </tr>`;
}

function cardHtmlProd(p){
  const cats = p.categorias || [];
  const tagsHtml = cats.map(cat=>{
    const color = PRODUCT_CATEGORY_COLORS[cat] || '#7A8590';
    return `<span class="tag" style="background:${color}"><span class="dot"></span>${escapeHtml(cat)}</span>`;
  }).join('');
  return `
  <div class="card">
    ${p.photoUrl ? `<img src="${escapeHtml(p.photoUrl)}" alt="${escapeHtml(p.nome)}" class="product-photo" onerror="this.style.display='none'">` : ''}
    <div class="tags">${tagsHtml}</div>
    <div class="body">
      <h3>${escapeHtml(p.nome)}</h3>
      ${p.ndisCovered ? `<div class="ndis-badge" style="margin-left:0;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Covered by NDIS</div>` : ''}
      ${p.avaliacao ? `<div class="stars">${starsHtml(p.avaliacao)}</div>` : ''}
      ${p.brand ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2.59 12.59A2 2 0 0 1 2 11.17V4a2 2 0 0 1 2-2h7.17a2 2 0 0 1 1.41.59l8.01 8.01a2 2 0 0 1 0 2.83z"/><circle cx="7" cy="7" r="1"/></svg><span>${escapeHtml(p.brand)}</span></div>` : ''}
      ${p.price ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>${escapeHtml(p.price)}</span></div>` : ''}
      ${p.website ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z"/></svg><a href="${escapeHtml(/^https?:\/\//i.test(p.website) ? p.website : 'https://'+p.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayHostname(p.website))}</a></div>` : ''}
      ${p.indicadoPor ? `<div class="referred">Recommended by ${escapeHtml(p.indicadoPor)}</div>` : ''}
      ${p.observacoes ? `<div class="notes">${escapeHtml(p.observacoes)}</div>` : ''}
      <div class="card-actions">
        ${isAdminUser ? `<button class="btn-danger-text" data-del="${p.id}">Delete</button>` : `<button class="btn-edit" data-reqdel-product="${p.id}">Request removal</button>`}
        <button class="btn-edit" data-edit="${p.id}">Edit</button>
      </div>
    </div>
  </div>`;
}

function openProdModal(id){
  editingProdId = id || null;
  const p = id ? productsData.find(x=>x.id===id) : null;

  document.getElementById('modalTitleProd').textContent = p ? 'Edit product' : 'Add product';
  document.getElementById('pf-nome').value = p ? p.nome : '';
  setSelectedChipsProd(p ? (p.categorias||[]) : []);
  document.getElementById('perr-categoria').style.display = 'none';
  document.getElementById('pf-brand').value = p ? p.brand||'' : '';
  document.getElementById('pf-price').value = p ? p.price||'' : '';
  document.getElementById('pf-website').value = p ? p.website||'' : '';
  document.getElementById('pf-photo').value = p ? p.photoUrl||'' : '';
  document.getElementById('pf-ndis').checked = p ? !!p.ndisCovered : false;
  document.getElementById('pf-indicado').value = p ? p.indicadoPor||'' : '';
  document.getElementById('pf-obs').value = p ? p.observacoes||'' : '';
  document.getElementById('perr-nome').style.display = 'none';

  currentStarsProd = p ? (p.avaliacao||0) : 0;
  updateStarInputProd();

  overlayProd.classList.add('open');
  setTimeout(()=>document.getElementById('pf-nome').focus(), 50);
}

function closeProdModal(){
  overlayProd.classList.remove('open');
  editingProdId = null;
}

function updateStarInputProd(){
  document.querySelectorAll('#starInputProd span').forEach(s=>{
    s.classList.toggle('on', Number(s.getAttribute('data-v')) <= currentStarsProd);
  });
}

document.getElementById('starInputProd').addEventListener('click', (e)=>{
  if(e.target.tagName === 'SPAN'){
    const v = Number(e.target.getAttribute('data-v'));
    currentStarsProd = (currentStarsProd === v) ? v-1 : v;
    updateStarInputProd();
  }
});

function requestDeleteProduct(id){
  const p = productsData.find(x=>x.id===id);
  if(!p) return;
  openRequestRemovalModal('product', id, null, p.nome);
}

export async function deleteProdItem(id){
  const p = productsData.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`Delete "${p.nome}" from the list?`)) return;
  const ok = await deleteProductDoc(id);
  if(ok){
    productsData = productsData.filter(x=>x.id!==id);
    populateCategoryFilterProd();
    renderProd();
    showToast('Product deleted.');
    logActivity('product', 'deleted', p.nome);
  }
}

document.getElementById('addBtnProd').addEventListener('click', ()=>openProdModal(null));
document.getElementById('cancelBtnProd').addEventListener('click', closeProdModal);
overlayProd.addEventListener('click', (e)=>{ if(e.target === overlayProd) closeProdModal(); });

document.getElementById('saveBtnProd').addEventListener('click', async ()=>{
  const nome = document.getElementById('pf-nome').value.trim();
  const categorias = getSelectedCategoriesProd();
  if(categorias.length === 0){
    document.getElementById('perr-categoria').style.display = 'block';
    return;
  }
  document.getElementById('perr-categoria').style.display = 'none';
  if(!nome){
    document.getElementById('perr-nome').style.display = 'block';
    return;
  }
  document.getElementById('perr-nome').style.display = 'none';

  const payload = {
    id: editingProdId || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
    nome,
    categorias,
    brand: document.getElementById('pf-brand').value.trim(),
    price: document.getElementById('pf-price').value.trim(),
    website: document.getElementById('pf-website').value.trim(),
    photoUrl: document.getElementById('pf-photo').value.trim(),
    ndisCovered: document.getElementById('pf-ndis').checked,
    indicadoPor: document.getElementById('pf-indicado').value.trim(),
    observacoes: document.getElementById('pf-obs').value.trim(),
    avaliacao: currentStarsProd
  };

  if(editingProdId){
    const idx = productsData.findIndex(x=>x.id===editingProdId);
    if(idx>-1) productsData[idx] = payload;
  }else{
    productsData.push(payload);
  }

  const ok = await saveProductDoc(payload.id, payload);
  if(ok){
    const wasEditing = !!editingProdId;
    closeProdModal();
    populateCategoryFilterProd();
    renderProd();
    showToast(wasEditing ? 'Product updated.' : 'Product added.');
    logActivity('product', wasEditing ? 'edited' : 'added', nome);
  }
});

searchInputProd.addEventListener('input', renderProd);
filterCatProd.addEventListener('change', renderProd);

RENDER_FN_BY_SECTION.products = renderProd;
