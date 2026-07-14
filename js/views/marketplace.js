/* ---------- Marketplace ---------- */
import { db, storageService } from '../firebase-service.js';
import { showToast, escapeHtml, formatPhone } from '../utils.js';
import { MKT_STORAGE_KEY, MKT_KNOWN_CATEGORIES, MKT_CATEGORY_COLORS, MKT_TYPE_COLORS } from '../constants.js';
import {
  isAdminUser,
  RENDER_FN_BY_SECTION,
  VIEW_MODES,
  buildTableWrap,
  showDetailsModal,
  openRequestRemovalModal,
  logActivity
} from '../shared.js';
import { uploadPhotoToStorage, pendingPhotoUploads } from '../photo-upload.js';

export let marketplaceData = [];
let editingMktId = null;
let selectedMktType = null;

const typeChipSelect = document.getElementById('typeChipSelect');
typeChipSelect.querySelectorAll('.chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    selectedMktType = chip.dataset.value;
    typeChipSelect.querySelectorAll('.chip').forEach(c=>c.classList.toggle('selected', c===chip));
    document.getElementById('mkerr-type').style.display = 'none';
  });
});

const chipSelectMkt = document.getElementById('chipSelectMkt');
const catOtherInputMkt = document.getElementById('mk-categoria-other');
let selectedChipsMkt = new Set();

MKT_KNOWN_CATEGORIES.forEach(cat=>{
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.textContent = cat;
  chip.dataset.value = cat;
  chip.addEventListener('click', ()=>{
    if(selectedChipsMkt.has(cat)){ selectedChipsMkt.delete(cat); chip.classList.remove('selected'); }
    else { selectedChipsMkt.add(cat); chip.classList.add('selected'); }
  });
  chipSelectMkt.appendChild(chip);
});

function setSelectedChipsMkt(cats){
  selectedChipsMkt = new Set(cats.filter(c=>MKT_KNOWN_CATEGORIES.includes(c)));
  chipSelectMkt.querySelectorAll('.chip').forEach(chip=>{
    chip.classList.toggle('selected', selectedChipsMkt.has(chip.dataset.value));
  });
  const customOnes = cats.filter(c=>!MKT_KNOWN_CATEGORIES.includes(c));
  catOtherInputMkt.value = customOnes.join(', ');
}

function getSelectedCategoriesMkt(){
  const custom = catOtherInputMkt.value.split(',').map(s=>s.trim()).filter(Boolean);
  return Array.from(new Set([...selectedChipsMkt, ...custom]));
}

const countRowMkt = document.getElementById('countRowMkt');
const gridAreaMkt = document.getElementById('gridAreaMkt');
const overlayMkt = document.getElementById('overlayMkt');
const searchInputMkt = document.getElementById('searchInputMkt');
const filterTypeMkt = document.getElementById('filterTypeMkt');

async function migrateLegacyMarketplace(){
  try{
    if(localStorage.getItem('ds-migrated-marketplace')) return;
    const res = await storageService.get(MKT_STORAGE_KEY, true);
    const legacy = res && res.value ? JSON.parse(res.value) : [];
    if(legacy.length){
      await Promise.all(legacy.map(m=>{
        const id = m.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
        const {id: _drop, ...rest} = m;
        return db.collection('marketplace').doc(id).set(rest);
      }));
      await storageService.delete(MKT_STORAGE_KEY, true);
    }
    localStorage.setItem('ds-migrated-marketplace', '1');
  }catch(e){
    console.error('Legacy marketplace migration failed (non-fatal)', e);
  }
}

export async function loadMarketplaceData(){
  gridAreaMkt.innerHTML = `<div class="empty-state">Loading...</div>`;
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await migrateLegacyMarketplace();
      const snap = await db.collection('marketplace').get();
      marketplaceData = snap.docs.map(d=>({ id: d.id, ...d.data() }));
      renderMkt();
      return;
    }catch(e){
      console.error('loadMarketplaceData failed (attempt '+attempt+')', e);
      if(attempt === 4){
        gridAreaMkt.innerHTML = `<div class="empty-state"><div class="display">Couldn't load data</div><p>${escapeHtml(e && e.message ? e.message : 'Unknown error')}</p><button class="btn btn-primary" id="retryLoadBtnMkt" style="margin-top:10px;">Try again</button></div>`;
        document.getElementById('retryLoadBtnMkt').addEventListener('click', loadMarketplaceData);
        return;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function saveMarketplaceDoc(id, payload){
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await db.collection('marketplace').doc(id).set(payload);
      return true;
    }catch(e){
      console.error('saveMarketplaceDoc failed (attempt '+attempt+')', e);
      if(attempt === 4){
        showToast('Save failed: ' + (e && e.message ? e.message : 'unknown error'));
        return false;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function deleteMarketplaceDoc(id){
  try{
    await db.collection('marketplace').doc(id).delete();
    return true;
  }catch(e){
    console.error('deleteMarketplaceDoc failed', e);
    showToast('Delete failed: ' + (e && e.message ? e.message : 'unknown error'));
    return false;
  }
}

export function renderMkt(){
  const q = searchInputMkt.value.trim().toLowerCase();
  const type = filterTypeMkt.value;

  let filtered = marketplaceData.filter(m=>{
    const cats = m.categorias || [];
    const matchesType = !type || m.listingType === type;
    const haystack = [m.nome, m.observacoes, m.postedBy, cats.join(' ')].join(' ').toLowerCase();
    const matchesQ = !q || haystack.includes(q);
    return matchesType && matchesQ;
  });

  countRowMkt.textContent = marketplaceData.length === 0
    ? ''
    : `${filtered.length} of ${marketplaceData.length} listing${marketplaceData.length===1?'':'s'}`;

  if(marketplaceData.length === 0){
    gridAreaMkt.innerHTML = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 7h-3V6a4 4 0 0 0-8 0v1H6a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8a1 1 0 0 0-1-1z"/><path d="M9 7V6a3 3 0 0 1 6 0v1"/></svg>
        <div class="display">Nothing posted yet</div>
        <p>Post something to donate, sell, or rent to the community.</p>
      </div>`;
    return;
  }
  if(filtered.length === 0){
    gridAreaMkt.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></svg><div class="display">Nothing found</div><p>Try a different search or listing type.</p></div>`;
    return;
  }

  filtered.sort((a,b)=> b.at - a.at || a.nome.localeCompare(b.nome,'en'));
  if(VIEW_MODES['marketplace'] === 'table'){
    gridAreaMkt.innerHTML = buildTableWrap(['Item','Type','Condition','Price','Phone','Email','Posted by'], filtered.map(tableRowHtmlMkt).join(''));
  }else{
    gridAreaMkt.innerHTML = `<div class="grid">${filtered.map(cardHtmlMkt).join('')}</div>`;
  }

  gridAreaMkt.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>openMktModal(btn.getAttribute('data-edit')));
  });
  gridAreaMkt.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>deleteMktItem(btn.getAttribute('data-del')));
  });
  gridAreaMkt.querySelectorAll('[data-reqdel-marketplace]').forEach(btn=>{
    btn.addEventListener('click', ()=>requestDeleteMarketplace(btn.getAttribute('data-reqdel-marketplace')));
  });
  gridAreaMkt.querySelectorAll('[data-details]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = marketplaceData.find(x=>x.id===btn.getAttribute('data-details'));
      if(item){
        showDetailsModal(cardHtmlMkt(item));
        wireMktCarousels(document.getElementById('detailsModalBody'));
      }
    });
  });
  wireMktCarousels(gridAreaMkt);
}

function wireMktCarousels(containerEl){
  containerEl.querySelectorAll('.mkt-carousel').forEach(carousel=>{
    const track = carousel.querySelector('.mkt-carousel-track');
    const slides = carousel.querySelectorAll('.mkt-carousel-slide');
    const dots = carousel.querySelectorAll('.mkt-carousel-dot');
    if(slides.length <= 1) return;
    let index = 0;

    function goTo(i){
      index = (i + slides.length) % slides.length;
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((d,di)=>d.classList.toggle('active', di===index));
    }

    const prevBtn = carousel.querySelector('.mkt-carousel-prev');
    const nextBtn = carousel.querySelector('.mkt-carousel-next');
    if(prevBtn) prevBtn.addEventListener('click', (e)=>{ e.stopPropagation(); goTo(index-1); });
    if(nextBtn) nextBtn.addEventListener('click', (e)=>{ e.stopPropagation(); goTo(index+1); });

    // Swipe support for touch devices
    let touchStartX = null;
    carousel.addEventListener('touchstart', (e)=>{ touchStartX = e.touches[0].clientX; }, { passive: true });
    carousel.addEventListener('touchend', (e)=>{
      if(touchStartX === null) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      if(Math.abs(dx) > 40) goTo(dx < 0 ? index+1 : index-1);
      touchStartX = null;
    });
  });
}

function tableRowHtmlMkt(m){
  return `<tr>
    <td><b>${escapeHtml(m.nome)}</b></td>
    <td>${escapeHtml(m.listingType)}</td>
    <td>${m.condition ? escapeHtml(m.condition) : ''}</td>
    <td>${m.price ? escapeHtml(m.price) : ''}</td>
    <td>${m.telefone ? escapeHtml(formatPhone(m.telefone)) : ''}</td>
    <td>${m.email ? escapeHtml(m.email) : ''}</td>
    <td>${m.postedBy ? escapeHtml(m.postedBy) : ''}</td>
    <td class="table-actions">
      <button class="btn-edit" data-details="${m.id}">Details</button>
      <button class="btn-edit" data-edit="${m.id}">Edit</button>
      ${isAdminUser ? `<button class="btn-danger-text" data-del="${m.id}">Delete</button>` : `<button class="btn-edit" data-reqdel-marketplace="${m.id}">Request removal</button>`}
    </td>
  </tr>`;
}

function cardHtmlMkt(m){
  const cats = m.categorias || [];
  const typeColor = MKT_TYPE_COLORS[m.listingType] || '#7A8590';
  const typeIcon = m.listingType === 'Donate' ? '🎁' : m.listingType === 'Rent' ? '🔁' : m.listingType === 'Lend' ? '🤝' : '💲';
  const conditionTag = m.condition ? `<span class="tag" style="background:#5C6B7A"><span class="dot"></span>${escapeHtml(m.condition)}</span>` : '';
  const tagsHtml = `<span class="tag" style="background:${typeColor}"><span class="dot"></span>${typeIcon} ${escapeHtml(m.listingType)}</span>` + conditionTag +
    cats.map(cat=>{
      const color = MKT_CATEGORY_COLORS[cat] || '#7A8590';
      return `<span class="tag" style="background:${color}"><span class="dot"></span>${escapeHtml(cat)}</span>`;
    }).join('');
  const photos = m.fotos || (m.photoUrl ? [m.photoUrl] : []);
  const photoBlock = photos.length
    ? `<div class="mkt-carousel" data-carousel-id="${m.id}">
        <div class="mkt-carousel-track">
          ${photos.map(url=>`<img src="${escapeHtml(url)}" alt="${escapeHtml(m.nome)}" class="mkt-carousel-slide" onerror="this.style.display='none'">`).join('')}
        </div>
        ${photos.length > 1 ? `
          <button type="button" class="mkt-carousel-btn mkt-carousel-prev" onclick="event.stopPropagation();">‹</button>
          <button type="button" class="mkt-carousel-btn mkt-carousel-next" onclick="event.stopPropagation();">›</button>
          <div class="mkt-carousel-dots">${photos.map((_,i)=>`<span class="mkt-carousel-dot${i===0?' active':''}"></span>`).join('')}</div>
        ` : ''}
      </div>`
    : '';
  return `
  <div class="card">
    ${photoBlock}
    <div class="tags">${tagsHtml}</div>
    <div class="body">
      <h3>${escapeHtml(m.nome)}</h3>
      ${m.price ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg><span>${escapeHtml(m.price)}</span></div>` : ''}
      ${m.telefone ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>${escapeHtml(formatPhone(m.telefone))}</span></div>` : ''}
      ${m.email ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg><span>${escapeHtml(m.email)}</span></div>` : ''}
      ${m.postedBy ? `<div class="referred">Posted by ${escapeHtml(m.postedBy)}</div>` : ''}
      ${m.observacoes ? `<div class="notes">${escapeHtml(m.observacoes)}</div>` : ''}
      <div class="card-actions">
        ${isAdminUser ? `<button class="btn-danger-text" data-del="${m.id}">Delete</button>` : `<button class="btn-edit" data-reqdel-marketplace="${m.id}">Request removal</button>`}
        <button class="btn-edit" data-edit="${m.id}">Edit</button>
      </div>
    </div>
  </div>`;
}

function openMktModal(id){
  editingMktId = id || null;
  const m = id ? marketplaceData.find(x=>x.id===id) : null;

  document.getElementById('modalTitleMkt').textContent = m ? 'Edit listing' : 'Post a listing';
  document.getElementById('mk-nome').value = m ? m.nome : '';
  document.getElementById('mk-condition').value = m ? m.condition||'' : '';
  document.getElementById('mk-price').value = m ? m.price||'' : '';
  document.getElementById('mk-telefone').value = m ? m.telefone||'' : '';
  document.getElementById('mk-email').value = m ? m.email||'' : '';
  document.getElementById('mkerr-contact').style.display = 'none';
  resetMkPhotoSlots(m ? (m.fotos || (m.photoUrl ? [m.photoUrl] : [])) : []);
  document.getElementById('mk-postedby').value = m ? m.postedBy||'' : '';
  document.getElementById('mkerr-postedby').style.display = 'none';
  document.getElementById('mk-obs').value = m ? m.observacoes||'' : '';
  document.getElementById('mkerr-nome').style.display = 'none';
  document.getElementById('mkerr-type').style.display = 'none';
  document.getElementById('mkerr-condition').style.display = 'none';
  document.getElementById('mkerr-price').style.display = 'none';

  selectedMktType = m ? m.listingType : null;
  typeChipSelect.querySelectorAll('.chip').forEach(c=>c.classList.toggle('selected', c.dataset.value===selectedMktType));

  setSelectedChipsMkt(m ? (m.categorias||[]) : []);

  overlayMkt.classList.add('open');
  setTimeout(()=>document.getElementById('mk-nome').focus(), 50);
}

function closeMktModal(){
  overlayMkt.classList.remove('open');
  editingMktId = null;
}

async function deleteMktItem(id){
  const m = marketplaceData.find(x=>x.id===id);
  if(!m) return;
  if(!confirm(`Delete "${m.nome}" from the marketplace?`)) return;
  const ok = await deleteMarketplaceDoc(id);
  if(ok){
    marketplaceData = marketplaceData.filter(x=>x.id!==id);
    renderMkt();
    showToast('Listing deleted.');
    logActivity('marketplace', 'deleted', m.nome);
  }
}

function requestDeleteMarketplace(id){
  const m = marketplaceData.find(x=>x.id===id);
  if(!m) return;
  openRequestRemovalModal('marketplace', id, null, m.nome);
}

document.getElementById('addBtnMkt').addEventListener('click', ()=>openMktModal(null));
document.getElementById('cancelBtnMkt').addEventListener('click', closeMktModal);
overlayMkt.addEventListener('click', (e)=>{ if(e.target === overlayMkt) closeMktModal(); });

document.getElementById('saveBtnMkt').addEventListener('click', async ()=>{
  if(pendingPhotoUploads > 0){
    showToast('Please wait for the photo(s) to finish uploading before saving.');
    return;
  }
  const nome = document.getElementById('mk-nome').value.trim();
  if(!nome){
    document.getElementById('mkerr-nome').style.display = 'block';
    return;
  }
  document.getElementById('mkerr-nome').style.display = 'none';

  if(!selectedMktType){
    document.getElementById('mkerr-type').style.display = 'block';
    return;
  }
  document.getElementById('mkerr-type').style.display = 'none';

  const conditionVal = document.getElementById('mk-condition').value;
  if(!conditionVal){
    document.getElementById('mkerr-condition').style.display = 'block';
    return;
  }
  document.getElementById('mkerr-condition').style.display = 'none';

  const priceVal = document.getElementById('mk-price').value.trim();
  if(selectedMktType === 'Sell' || selectedMktType === 'Rent'){
    const numericPrice = parseFloat(priceVal.replace(/[^0-9.]/g, ''));
    if(!priceVal || isNaN(numericPrice) || numericPrice <= 0){
      document.getElementById('mkerr-price').style.display = 'block';
      return;
    }
  }
  document.getElementById('mkerr-price').style.display = 'none';

  const telefoneVal = document.getElementById('mk-telefone').value.trim();
  const emailVal = document.getElementById('mk-email').value.trim();
  if(!telefoneVal && !emailVal){
    document.getElementById('mkerr-contact').style.display = 'block';
    return;
  }
  document.getElementById('mkerr-contact').style.display = 'none';

  const postedByVal = document.getElementById('mk-postedby').value.trim();
  if(!postedByVal){
    document.getElementById('mkerr-postedby').style.display = 'block';
    return;
  }
  document.getElementById('mkerr-postedby').style.display = 'none';

  const existing = editingMktId ? marketplaceData.find(x=>x.id===editingMktId) : null;

  const payload = {
    id: editingMktId || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
    nome,
    listingType: selectedMktType,
    condition: conditionVal,
    categorias: getSelectedCategoriesMkt(),
    price: priceVal,
    telefone: telefoneVal,
    email: emailVal,
    fotos: getMkPhotoUrls(),
    postedBy: document.getElementById('mk-postedby').value.trim(),
    observacoes: document.getElementById('mk-obs').value.trim(),
    at: existing ? existing.at : Date.now()
  };

  if(editingMktId){
    const idx = marketplaceData.findIndex(x=>x.id===editingMktId);
    if(idx>-1) marketplaceData[idx] = payload;
  }else{
    marketplaceData.push(payload);
  }

  const ok = await saveMarketplaceDoc(payload.id, payload);
  if(ok){
    const wasEditing = !!editingMktId;
    closeMktModal();
    renderMkt();
    showToast(wasEditing ? 'Listing updated.' : 'Listing posted.');
    logActivity('marketplace', wasEditing ? 'edited' : 'added', nome);
  }
});

searchInputMkt.addEventListener('input', renderMkt);
filterTypeMkt.addEventListener('change', renderMkt);

/* ---------- Marketplace multi-photo slots (up to 5) ---------- */
const MAX_MKT_PHOTOS = 5;
const mkPhotosContainer = document.getElementById('mkPhotosContainer');
let mkPhotoSlotCount = 0;
const mkAddPhotoBtn = document.getElementById('mkAddPhotoBtn');

function addMkPhotoSlot(url){
  if(mkPhotosContainer.children.length >= MAX_MKT_PHOTOS) return;
  mkPhotoSlotCount++;
  const slotId = 'mk-photo-slot-' + mkPhotoSlotCount;
  const slot = document.createElement('div');
  slot.className = 'mk-photo-slot';
  slot.innerHTML = `
    <button type="button" class="remove-photo-slot" title="Remove">×</button>
    <input type="file" class="mk-slot-file" accept="image/*">
    <div class="photo-status mk-slot-status"></div>
    <img class="photo-preview mk-slot-preview" style="display:${url ? 'block' : 'none'};" ${url ? `src="${escapeHtml(url)}"` : ''}>
    <input type="text" class="mk-slot-url" placeholder="...or paste an image link" style="${url ? 'display:none;' : ''}" value="${url ? escapeHtml(url) : ''}">
  `;
  mkPhotosContainer.appendChild(slot);

  const fileInput = slot.querySelector('.mk-slot-file');
  const urlInput = slot.querySelector('.mk-slot-url');
  const statusEl = slot.querySelector('.mk-slot-status');
  const previewEl = slot.querySelector('.mk-slot-preview');

  fileInput.addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const saveBtn = document.getElementById('saveBtnMkt');
    const originalBtnText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Uploading photo...';
    const uploadedUrl = await uploadPhotoToStorage(file, 'marketplace-photos', statusEl);
    if(uploadedUrl){
      urlInput.value = uploadedUrl;
      urlInput.style.display = 'none';
      previewEl.src = uploadedUrl;
      previewEl.style.display = 'block';
    }
    saveBtn.disabled = false;
    saveBtn.textContent = originalBtnText;
  });
  urlInput.addEventListener('input', ()=>{
    const val = urlInput.value.trim();
    if(val){
      previewEl.src = val;
      previewEl.style.display = 'block';
      previewEl.onerror = ()=>{ previewEl.style.display = 'none'; };
    }else{
      previewEl.style.display = 'none';
    }
  });
  urlInput.addEventListener('blur', ()=>{
    if(urlInput.value.trim()) urlInput.style.display = 'none';
  });
  slot.querySelector('.remove-photo-slot').addEventListener('click', ()=>{
    slot.remove();
    mkAddPhotoBtn.style.display = mkPhotosContainer.children.length >= MAX_MKT_PHOTOS ? 'none' : '';
  });

  mkAddPhotoBtn.style.display = mkPhotosContainer.children.length >= MAX_MKT_PHOTOS ? 'none' : '';
}

function resetMkPhotoSlots(urls){
  mkPhotosContainer.innerHTML = '';
  const list = (urls && urls.length) ? urls : [''];
  list.slice(0, MAX_MKT_PHOTOS).forEach(u=>addMkPhotoSlot(u));
  mkAddPhotoBtn.style.display = mkPhotosContainer.children.length >= MAX_MKT_PHOTOS ? 'none' : '';
}

function getMkPhotoUrls(){
  return Array.from(mkPhotosContainer.querySelectorAll('.mk-slot-url'))
    .map(el=>el.value.trim())
    .filter(Boolean)
    .slice(0, MAX_MKT_PHOTOS);
}

mkAddPhotoBtn.addEventListener('click', ()=>addMkPhotoSlot(''));

RENDER_FN_BY_SECTION.marketplace = renderMkt;
