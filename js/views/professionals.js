/* ---------- Professionals ---------- */
import { db, storageService } from '../firebase-service.js';
import { GOOGLE_PLACES_API_KEY } from '../config.js';
import { showToast, escapeHtml, formatPhone, displayHostname, instagramUrl, facebookUrl, newSessionToken } from '../utils.js';
import { STORAGE_KEY, KNOWN_CATEGORIES, CATEGORY_COLORS } from '../constants.js';
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
import { openReviewsModal } from './reviews.js';

export let data = [];
let editingId = null;
let currentStars = 0;

const chipSelect = document.getElementById('chipSelect');
const catOtherInput = document.getElementById('f-categoria-other');
let selectedChips = new Set();

KNOWN_CATEGORIES.forEach(cat=>{
  const chip = document.createElement('div');
  chip.className = 'chip';
  chip.textContent = cat;
  chip.dataset.value = cat;
  chip.addEventListener('click', ()=>{
    if(selectedChips.has(cat)){ selectedChips.delete(cat); chip.classList.remove('selected'); }
    else { selectedChips.add(cat); chip.classList.add('selected'); }
  });
  chipSelect.appendChild(chip);
});

function setSelectedChips(cats){
  selectedChips = new Set(cats.filter(c=>KNOWN_CATEGORIES.includes(c)));
  chipSelect.querySelectorAll('.chip').forEach(chip=>{
    chip.classList.toggle('selected', selectedChips.has(chip.dataset.value));
  });
  const customOnes = cats.filter(c=>!KNOWN_CATEGORIES.includes(c));
  catOtherInput.value = customOnes.join(', ');
}

function getSelectedCategories(){
  const custom = catOtherInput.value.split(',').map(s=>s.trim()).filter(Boolean);
  return Array.from(new Set([...selectedChips, ...custom]));
}
const countRow = document.getElementById('countRow');
const gridArea = document.getElementById('gridArea');
const overlay = document.getElementById('overlay');
const searchInput = document.getElementById('searchInput');
const filterCat = document.getElementById('filterCat');
const filterSuburb = document.getElementById('filterSuburb');

/* ---------- Address autocomplete (Google Places API — New) ---------- */

const addressInput = document.getElementById('f-endereco');
const addressSuggestions = document.getElementById('addressSuggestions');
let addressDebounceTimer = null;
let addressAbortController = null;
let placesSessionToken = null;

function closeAddressSuggestions(){
  addressSuggestions.classList.remove('open');
  addressSuggestions.innerHTML = '';
}

addressInput.addEventListener('input', ()=>{
  document.getElementById('f-suburb-captured').value = '';
  const query = addressInput.value.trim();
  clearTimeout(addressDebounceTimer);
  if(query.length < 4){
    closeAddressSuggestions();
    return;
  }
  addressDebounceTimer = setTimeout(()=>fetchAddressSuggestions(query), 300);
});

addressInput.addEventListener('blur', ()=>{
  setTimeout(closeAddressSuggestions, 150); // delay so a click on a suggestion still registers
});

function simplifyAddressQuery(q){
  // "2501 / 20 Parkes St" or "Suite 1.03/150 Pacific Hwy" -> "20 Parkes St" / "150 Pacific Hwy"
  return q
    .replace(/^(suite|unit|level|shop|apt|apartment)\s*[\w.\-]*\s*\/\s*/i, '')
    .replace(/^[\w.\-]+\s*\/\s*(\d)/, '$1')
    .trim();
}

async function runPlacesAutocomplete(query, signal){
  const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
      'X-Goog-FieldMask': 'suggestions.placePrediction.text.text,suggestions.placePrediction.placeId'
    },
    body: JSON.stringify({
      input: query,
      includedRegionCodes: ['au'],
      sessionToken: placesSessionToken
    })
  });
  const data = await res.json();
  console.log('[Places Autocomplete]', { query, status: res.status, data });
  if(!res.ok || data.error){
    throw new Error((data.error && data.error.message) || `Google Places request failed (HTTP ${res.status})`);
  }
  return (data.suggestions || []).map(s=>({
    text: s.placePrediction.text.text,
    placeId: s.placePrediction.placeId
  }));
}

async function fetchAddressSuggestions(query){
  addressSuggestions.innerHTML = `<div class="address-suggestion loading-text">Searching...</div>`;
  addressSuggestions.classList.add('open');

  if(addressAbortController) addressAbortController.abort();
  addressAbortController = new AbortController();
  if(!placesSessionToken) placesSessionToken = newSessionToken();

  try{
    const simplified = simplifyAddressQuery(query);
    let suggestions = [];

    if(simplified !== query){
      suggestions = await runPlacesAutocomplete(simplified, addressAbortController.signal);
    }
    if(!suggestions.length){
      suggestions = await runPlacesAutocomplete(query, addressAbortController.signal);
    }

    if(!suggestions.length){
      addressSuggestions.innerHTML = `<div class="address-suggestion loading-text">No matches found</div>`;
      return;
    }

    addressSuggestions.innerHTML = suggestions.map((s,i)=>
      `<div class="address-suggestion" data-idx="${i}">${escapeHtml(s.text)}</div>`
    ).join('');
    addressSuggestions.querySelectorAll('.address-suggestion').forEach((el,i)=>{
      el.addEventListener('mousedown', async (e)=>{ // mousedown fires before blur
        e.preventDefault();
        const s = suggestions[i];
        addressInput.value = s.text;
        closeAddressSuggestions();
        await fillPostcodeFromPlace(s.placeId);
      });
    });
  }catch(e){
    if(e.name !== 'AbortError'){
      console.error('Address search failed', e);
      addressSuggestions.innerHTML = `<div class="address-suggestion loading-text">Error: ${escapeHtml(e.message || 'Could not load suggestions')}</div>`;
    }
  }
}

async function fillPostcodeFromPlace(placeId){
  try{
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'addressComponents'
      }
    });
    const data = await res.json();
    const components = data.addressComponents || [];
    const postcodeComp = components.find(c=>c.types.includes('postal_code'));
    if(postcodeComp && /^\d{4}$/.test(postcodeComp.longText)){
      document.getElementById('f-postcode').value = postcodeComp.longText;
    }
    // Prefer the real suburb Google identified for THIS address over our own
    // postcode-based guess — one postcode can span several suburbs.
    const localityComp = components.find(c=>c.types.includes('locality'))
      || components.find(c=>c.types.includes('sublocality'))
      || components.find(c=>c.types.includes('postal_town'));
    const stateComp = components.find(c=>c.types.includes('administrative_area_level_1'));
    if(localityComp){
      const stateAbbrev = stateComp ? (stateComp.shortText || stateComp.longText) : '';
      document.getElementById('f-suburb-captured').value = stateAbbrev
        ? `${localityComp.longText}, ${stateAbbrev}`
        : localityComp.longText;
    }
  }catch(e){
    console.error('Could not fetch place details', e);
  }finally{
    placesSessionToken = null; // session ends once a place is resolved
  }
}

async function migrateLegacyProfessionals(){
  try{
    if(localStorage.getItem('ds-migrated-professionals')) return;
    const res = await storageService.get(STORAGE_KEY, true);
    const legacy = res && res.value ? JSON.parse(res.value) : [];
    if(legacy.length){
      await Promise.all(legacy.map(p=>{
        const id = p.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
        const {id: _drop, ...rest} = p;
        return db.collection('professionals').doc(id).set(rest);
      }));
      await storageService.delete(STORAGE_KEY, true);
    }
    localStorage.setItem('ds-migrated-professionals', '1');
  }catch(e){
    console.error('Legacy professionals migration failed (non-fatal)', e);
  }
}

async function migrateReviewsToSubcollection(){
  try{
    if(localStorage.getItem('ds-migrated-reviews-subcollection')) return;
    const snap = await db.collection('professionals').get();
    await Promise.all(snap.docs.map(async d=>{
      const profRef = db.collection('professionals').doc(d.id);
      // Read-and-clear the embedded field inside a transaction, so two near-simultaneous
      // runs (e.g. during a deploy reload) can't both see it before either clears it —
      // only one of them will ever actually get a non-empty array back.
      const embedded = await db.runTransaction(async (tx)=>{
        const freshDoc = await tx.get(profRef);
        const current = freshDoc.data() ? freshDoc.data().reviews : null;
        if(Array.isArray(current) && current.length){
          tx.update(profRef, { reviews: firebase.firestore.FieldValue.delete() });
          return current;
        }
        return null;
      });
      if(embedded){
        await Promise.all(embedded.map(r=>{
          const {id: _drop, ...rest} = r;
          return profRef.collection('reviews').add(rest);
        }));
      }
    }));
    localStorage.setItem('ds-migrated-reviews-subcollection', '1');
  }catch(e){
    console.error('Review subcollection migration failed (non-fatal)', e);
  }
}

export async function loadAllReviews(){
  // One collection-group query fetches every professional's reviews in a single round trip.
  const reviewsByProf = {};
  try{
    const snap = await db.collectionGroup('reviews').get();
    snap.docs.forEach(d=>{
      const profId = d.ref.parent.parent.id;
      if(!reviewsByProf[profId]) reviewsByProf[profId] = [];
      reviewsByProf[profId].push({ id: d.id, ...d.data() });
    });
    // Safety net: if the same review ever ended up as two separate documents (e.g. from an
    // old migration re-run), only show one of them — keep the earliest, drop the rest.
    Object.keys(reviewsByProf).forEach(profId=>{
      const seen = new Set();
      reviewsByProf[profId] = reviewsByProf[profId]
        .sort((a,b)=>(a.at||0)-(b.at||0))
        .filter(r=>{
          const key = `${r.author||''}|${r.rating||''}|${r.comment||''}`;
          if(seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    });
  }catch(e){
    console.error('Failed to load reviews', e);
  }
  return reviewsByProf;
}

export async function loadData(){
  gridArea.innerHTML = `<div class="empty-state">Loading...</div>`;
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await migrateLegacyProfessionals();
      await migrateReviewsToSubcollection();
      const [snap, reviewsByProf] = await Promise.all([
        db.collection('professionals').get(),
        loadAllReviews()
      ]);
      data = snap.docs.map(d=>({ id: d.id, ...d.data(), reviews: reviewsByProf[d.id] || [] }));
      populateCategoryFilter();
      render();
      return;
    }catch(e){
      console.error('loadData failed (attempt '+attempt+')', e);
      if(attempt === 4){
        gridArea.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg><div class="display">Temporary hiccup loading data</div><p>This looks like a brief slowdown on Claude's side, not lost data. Please try again in a moment.</p><button class="btn btn-primary" id="retryLoadBtn" style="margin-top:10px;">Try again</button></div>`;
        document.getElementById('retryLoadBtn').addEventListener('click', loadData);
        return;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function saveProfessionalDoc(id, payload){
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await db.collection('professionals').doc(id).set(payload);
      return true;
    }catch(e){
      console.error('saveProfessionalDoc failed (attempt '+attempt+')', e);
      if(attempt === 4){
        showToast('Save failed: ' + (e && e.message ? e.message : 'unknown error'));
        return false;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function deleteProfessionalDoc(id){
  try{
    await db.collection('professionals').doc(id).delete();
    return true;
  }catch(e){
    console.error('deleteProfessionalDoc failed', e);
    showToast('Delete failed: ' + (e && e.message ? e.message : 'unknown error'));
    return false;
  }
}

export function populateCategoryFilter(){
  const all = data.flatMap(d => d.categorias || (d.categoria ? [d.categoria] : []));
  const cats = Array.from(new Set(all)).sort();
  const current = filterCat.value;
  filterCat.innerHTML = '<option value="">All specialties</option>' +
    cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  filterCat.value = current;

  const suburbs = Array.from(new Set(data.map(d=>d.suburb).filter(Boolean))).sort();
  const currentSuburb = filterSuburb.value;
  const hasHomeBased = data.some(d=>d.homeBased);
  filterSuburb.innerHTML = '<option value="">All locations</option>' +
    (hasHomeBased ? '<option value="__HOME_BASED__">🏠 Home Service</option>' : '') +
    suburbs.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  filterSuburb.value = currentSuburb;
}

export function render(){
  const q = searchInput.value.trim().toLowerCase();
  const cat = filterCat.value;
  const suburb = filterSuburb.value;

  let filtered = data.filter(p=>{
    const cats = p.categorias || (p.categoria ? [p.categoria] : []);
    const matchesCat = !cat || cats.includes(cat);
    const matchesSuburb = !suburb || (suburb === '__HOME_BASED__' ? p.homeBased : p.suburb === suburb);
    const haystack = [p.nome, p.endereco, p.observacoes, p.indicadoPor, cats.join(' ')].join(' ').toLowerCase();
    const matchesQ = !q || haystack.includes(q);
    return matchesCat && matchesSuburb && matchesQ;
  });

  countRow.textContent = data.length === 0
    ? ''
    : `${filtered.length} of ${data.length} professional${data.length===1?'':'s'}`;

  if(data.length === 0){
    gridArea.innerHTML = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/><path d="M8 4v-1"/><path d="M16 4v-1"/><circle cx="9" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="18" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="18" r="1.5" fill="currentColor" stroke="none"/></svg>
        <div class="display">No professionals added yet</div>
        <p>Add the first professional to start the directory.</p>
      </div>`;
    return;
  }

  if(filtered.length === 0){
    gridArea.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></svg><div class="display">Nothing found</div><p>Try a different search or specialty.</p></div>`;
    return;
  }

  filtered.sort((a,b)=> a.nome.localeCompare(b.nome, 'en'));

  if(VIEW_MODES['professionals'] === 'table'){
    gridArea.innerHTML = buildTableWrap(['Name','Specialties','Phone','Location','Rating'], filtered.map(tableRowHtml).join(''));
  }else{
    gridArea.innerHTML = `<div class="grid">${filtered.map(cardHtml).join('')}</div>`;
  }

  gridArea.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>openModal(btn.getAttribute('data-edit')));
  });
  gridArea.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>deleteItem(btn.getAttribute('data-del')));
  });
  gridArea.querySelectorAll('[data-reqdel]').forEach(btn=>{
    btn.addEventListener('click', ()=>requestDeleteProfessional(btn.getAttribute('data-reqdel')));
  });
  gridArea.querySelectorAll('[data-reviews]').forEach(btn=>{
    btn.addEventListener('click', ()=>openReviewsModal(btn.getAttribute('data-reviews')));
  });
  gridArea.querySelectorAll('[data-details]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = data.find(x=>x.id===btn.getAttribute('data-details'));
      if(item) showDetailsModal(cardHtml(item));
    });
  });
}

function tableRowHtml(p){
  const cats = (p.categorias || (p.categoria ? [p.categoria] : [])).join(', ');
  const avg = averageRating(p);
  const reviewCount = (p.reviews||[]).length;
  const ratingCell = avg
    ? `<button class="table-link-btn" data-reviews="${p.id}">${avg.toFixed(1)} ★ <span style="color:var(--muted);">(${reviewCount})</span></button>`
    : `<button class="table-link-btn" data-reviews="${p.id}">Add review</button>`;
  const locationCell = p.homeBased
    ? `🏠 Home service${p.suburb ? ` <span style="color:var(--muted);">(${escapeHtml(p.suburb)})</span>` : ''}`
    : (p.suburb ? escapeHtml(p.suburb) : '');
  return `<tr>
    <td><b>${escapeHtml(p.nome)}</b></td>
    <td>${escapeHtml(cats)}</td>
    <td>${p.telefone ? escapeHtml(formatPhone(p.telefone)) : ''}</td>
    <td>${locationCell}</td>
    <td>${ratingCell}</td>
    <td class="table-actions">
      <button class="btn-edit" data-details="${p.id}">Details</button>
      <button class="btn-edit" data-edit="${p.id}">Edit</button>
      ${isAdminUser ? `<button class="btn-danger-text" data-del="${p.id}">Delete</button>` : `<button class="btn-edit" data-reqdel="${p.id}">Request removal</button>`}
    </td>
  </tr>`;
}

export function averageRating(p){
  const ratings = (p.reviews || []).map(r=>r.rating).filter(Boolean);
  if(ratings.length) return ratings.reduce((a,b)=>a+b,0) / ratings.length;
  return p.avaliacao || null; // fall back to the initial rating only if there are no written reviews yet
}

export function cardHtml(p){
  const cats = p.categorias || (p.categoria ? [p.categoria] : []);
  const tagsHtml = cats.map(cat=>{
    const color = CATEGORY_COLORS[cat] || '#7A8590';
    return `<span class="tag" style="background:${color}"><span class="dot"></span>${escapeHtml(cat)}</span>`;
  }).join('');
  const suburbTag = p.suburb ? `<span class="tag" style="background:#5C6B7A"><span class="dot"></span>${escapeHtml(p.suburb)}</span>` : '';
  const homeBasedTag = p.homeBased ? `<span class="tag" style="background:#8A6D3D"><span class="dot"></span>🏠 Home Service</span>` : '';
  const reviewCount = (p.reviews||[]).length;
  const avg = averageRating(p);
  return `
  <div class="card">
    <div class="tags">${homeBasedTag}${suburbTag}${tagsHtml}</div>
    <div class="body">
      <h3>${escapeHtml(p.nome)}</h3>
      ${avg ? `<div class="stars">${starsHtml(Math.round(avg))} <span style="color:var(--muted);font-size:12px;">${avg.toFixed(1)}</span></div>` : ''}
      <button class="reviews-link" data-reviews="${p.id}">💬 ${reviewCount ? reviewCount + (reviewCount===1 ? ' review' : ' reviews') : 'Be the first to review'}</button>
      ${p.telefone ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>${escapeHtml(formatPhone(p.telefone))}</span></div>` : ''}
      ${p.email ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><path d="M2 6h20v12H2z"/></svg><a href="mailto:${escapeHtml(p.email)}">${escapeHtml(p.email)}</a></div>` : ''}
      ${p.endereco ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>${escapeHtml(p.endereco)}</span></div>` : ''}
      ${p.website ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20z"/></svg><a href="${escapeHtml(/^https?:\/\//i.test(p.website) ? p.website : 'https://'+p.website)}" target="_blank" rel="noopener noreferrer">${escapeHtml(displayHostname(p.website))}</a></div>` : ''}
      ${p.instagram ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg><a href="${escapeHtml(instagramUrl(p.instagram))}" target="_blank" rel="noopener noreferrer">Instagram</a></div>` : ''}
      ${p.facebook ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><a href="${escapeHtml(facebookUrl(p.facebook))}" target="_blank" rel="noopener noreferrer">Facebook</a></div>` : ''}
      ${p.indicadoPor ? `<div class="referred">Referred by ${escapeHtml(p.indicadoPor)}</div>` : ''}
      ${p.observacoes ? `<div class="notes">${escapeHtml(p.observacoes)}</div>` : ''}
      <div class="card-actions">
        ${isAdminUser ? `<button class="btn-danger-text" data-del="${p.id}">Delete</button>` : `<button class="btn-edit" data-reqdel="${p.id}">Request removal</button>`}
        <button class="btn-edit" data-edit="${p.id}">Edit</button>
      </div>
    </div>
  </div>`;
}

function openModal(id){
  editingId = id || null;
  const p = id ? data.find(x=>x.id===id) : null;

  document.getElementById('modalTitle').textContent = p ? 'Edit professional' : 'Add professional';
  document.getElementById('f-nome').value = p ? p.nome : '';
  const existingCats = p ? (p.categorias || (p.categoria ? [p.categoria] : [])) : [];
  setSelectedChips(existingCats);
  document.getElementById('err-categoria').style.display = 'none';
  document.getElementById('f-telefone').value = p ? p.telefone||'' : '';
  document.getElementById('f-email').value = p ? p.email||'' : '';
  document.getElementById('f-endereco').value = p ? p.endereco||'' : '';
  document.getElementById('f-postcode').value = p ? p.postcode||'' : '';
  document.getElementById('f-suburb-captured').value = p ? p.suburb||'' : '';
  document.getElementById('f-homebased').checked = p ? !!p.homeBased : false;
  document.getElementById('f-website').value = p ? p.website||'' : '';
  document.getElementById('f-instagram').value = p ? p.instagram||'' : '';
  document.getElementById('f-facebook').value = p ? p.facebook||'' : '';
  document.getElementById('f-indicado').value = p ? p.indicadoPor||'' : '';
  document.getElementById('f-obs').value = p ? p.observacoes||'' : '';
  document.getElementById('err-nome').style.display = 'none';

  currentStars = p ? (p.avaliacao||0) : 0;
  updateStarInput();

  overlay.classList.add('open');
  setTimeout(()=>document.getElementById('f-nome').focus(), 50);
}

function closeModal(){
  overlay.classList.remove('open');
  editingId = null;
}

function updateStarInput(){
  document.querySelectorAll('#starInput span').forEach(s=>{
    s.classList.toggle('on', Number(s.getAttribute('data-v')) <= currentStars);
  });
}

document.getElementById('starInput').addEventListener('click', (e)=>{
  if(e.target.tagName === 'SPAN'){
    const v = Number(e.target.getAttribute('data-v'));
    currentStars = (currentStars === v) ? v-1 : v;
    updateStarInput();
  }
});

function requestDeleteProfessional(id){
  const p = data.find(x=>x.id===id);
  if(!p) return;
  openRequestRemovalModal('professional', id, null, p.nome);
}

export async function deleteItem(id){
  const p = data.find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`Delete "${p.nome}" from the directory?`)) return;
  const ok = await deleteProfessionalDoc(id);
  if(ok){
    data = data.filter(x=>x.id!==id);
    populateCategoryFilter();
    render();
    showToast('Professional deleted.');
    logActivity('professional', 'deleted', p.nome);
  }
}

document.getElementById('addBtn').addEventListener('click', ()=>openModal(null));
document.getElementById('cancelBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e)=>{ if(e.target === overlay) closeModal(); });

document.getElementById('saveBtn').addEventListener('click', async ()=>{
  const nome = document.getElementById('f-nome').value.trim();
  const categorias = getSelectedCategories();
  if(categorias.length === 0){
    document.getElementById('err-categoria').style.display = 'block';
    return;
  }
  document.getElementById('err-categoria').style.display = 'none';
  if(!nome){
    document.getElementById('err-nome').style.display = 'block';
    return;
  }
  document.getElementById('err-nome').style.display = 'none';

  const postcode = document.getElementById('f-postcode').value.trim();
  const capturedSuburb = document.getElementById('f-suburb-captured').value.trim();
  const suburb = capturedSuburb;

  const payload = {
    id: editingId || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
    nome,
    categorias,
    telefone: document.getElementById('f-telefone').value.trim(),
    email: document.getElementById('f-email').value.trim(),
    endereco: document.getElementById('f-endereco').value.trim(),
    postcode,
    suburb,
    homeBased: document.getElementById('f-homebased').checked,
    website: document.getElementById('f-website').value.trim(),
    instagram: document.getElementById('f-instagram').value.trim(),
    facebook: document.getElementById('f-facebook').value.trim(),
    indicadoPor: document.getElementById('f-indicado').value.trim(),
    observacoes: document.getElementById('f-obs').value.trim(),
    avaliacao: currentStars
  };

  const ok = await saveProfessionalDoc(payload.id, payload);
  if(ok){
    if(editingId){
      const idx = data.findIndex(x=>x.id===editingId);
      if(idx>-1){
        payload.reviews = data[idx].reviews || []; // reviews live in a subcollection — keep the local copy as-is
        data[idx] = payload;
      }
    }else{
      payload.reviews = [];
      data.push(payload);
    }
    const wasEditing = !!editingId;
    closeModal();
    populateCategoryFilter();
    render();
    showToast(wasEditing ? 'Professional updated.' : 'Professional added.');
    logActivity('professional', wasEditing ? 'edited' : 'added', nome);
  }
});

searchInput.addEventListener('input', render);
filterCat.addEventListener('change', render);
filterSuburb.addEventListener('change', render);

RENDER_FN_BY_SECTION.professionals = render;
