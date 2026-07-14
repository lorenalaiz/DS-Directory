/* ---------- Families & Playgroups ---------- */
import { db, storageService } from '../firebase-service.js';
import { GOOGLE_PLACES_API_KEY } from '../config.js';
import { showToast, escapeHtml, formatPhone } from '../utils.js';
import { FAM_STORAGE_KEY } from '../app.js';
import {
  isAdminUser,
  RENDER_FN_BY_SECTION,
  VIEW_MODES,
  buildTableWrap,
  showDetailsModal,
  openRequestRemovalModal,
  logActivity
} from '../shared.js';
import { newSessionToken } from '../address-autocomplete.js';
import { pendingPhotoUploads, wirePhotoUpload, wirePhotoRemoveButton } from '../photo-upload.js';

export let familiesData = [];
let editingFamId = null;
export let familiesMapInstance = null;
let familiesMarkersLayer = null;
let mapOpen = false;

const childrenList = document.getElementById('childrenList');

function addChildRow(name='', dob=''){
  const row = document.createElement('div');
  row.className = 'child-row';
  row.innerHTML = `
    <input type="text" class="child-name" placeholder="Child's name" value="${escapeHtml(name)}">
    <input type="date" class="child-dob" value="${escapeHtml(dob)}">
    <button type="button" class="remove-child" title="Remove">×</button>`;
  row.querySelector('.remove-child').addEventListener('click', ()=>row.remove());
  childrenList.appendChild(row);
}

document.getElementById('addChildBtn').addEventListener('click', ()=>addChildRow());

/* Suburb search for the family form (Google Places, restricted to suburb-level results) */
const ffPostcodeInput = document.getElementById('ff-postcode');
const ffSuburbInput = document.getElementById('ff-suburb');
const ffSuburbSuggestions = document.getElementById('ffSuburbSuggestions');
let ffSuburbDebounceTimer = null;
let ffSuburbAbortController = null;
let ffSuburbSessionToken = null;
let ffSuburbSelectedData = null; // { postcode, suburb, lat, lon } once a suggestion is chosen

function closeFfSuburbSuggestions(){
  ffSuburbSuggestions.classList.remove('open');
  ffSuburbSuggestions.innerHTML = '';
}

ffSuburbInput.addEventListener('input', ()=>{
  ffSuburbSelectedData = null; // typing invalidates whatever was previously selected
  const query = ffSuburbInput.value.trim();
  clearTimeout(ffSuburbDebounceTimer);
  if(query.length < 2){
    closeFfSuburbSuggestions();
    return;
  }
  ffSuburbDebounceTimer = setTimeout(()=>fetchFfSuburbSuggestions(query), 300);
});
ffSuburbInput.addEventListener('blur', ()=>{
  setTimeout(closeFfSuburbSuggestions, 150);
});

async function fetchFfSuburbSuggestions(query){
  ffSuburbSuggestions.innerHTML = `<div class="address-suggestion loading-text">Searching...</div>`;
  ffSuburbSuggestions.classList.add('open');
  if(ffSuburbAbortController) ffSuburbAbortController.abort();
  ffSuburbAbortController = new AbortController();
  if(!ffSuburbSessionToken) ffSuburbSessionToken = newSessionToken();

  try{
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      signal: ffSuburbAbortController.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.text.text,suggestions.placePrediction.placeId'
      },
      body: JSON.stringify({
        input: query,
        includedRegionCodes: ['au'],
        includedPrimaryTypes: ['locality', 'sublocality', 'postal_code'],
        sessionToken: ffSuburbSessionToken
      })
    });
    const data = await res.json();
    if(!res.ok || data.error){
      throw new Error((data.error && data.error.message) || `Google Places request failed (HTTP ${res.status})`);
    }
    const suggestions = (data.suggestions || []).map(s=>({
      text: s.placePrediction.text.text,
      placeId: s.placePrediction.placeId
    }));
    if(!suggestions.length){
      ffSuburbSuggestions.innerHTML = `<div class="address-suggestion loading-text">No matches found</div>`;
      return;
    }
    ffSuburbSuggestions.innerHTML = suggestions.map((s,i)=>
      `<div class="address-suggestion" data-idx="${i}">${escapeHtml(s.text)}</div>`
    ).join('');
    ffSuburbSuggestions.querySelectorAll('.address-suggestion').forEach((el,i)=>{
      el.addEventListener('mousedown', async (e)=>{ // mousedown fires before blur
        e.preventDefault();
        const s = suggestions[i];
        closeFfSuburbSuggestions();
        await fillFamilySuburbFromPlace(s.placeId, s.text);
      });
    });
  }catch(e){
    if(e.name !== 'AbortError'){
      console.error('[Suburb Autocomplete]', e);
      ffSuburbSuggestions.innerHTML = `<div class="address-suggestion loading-text">Error: ${escapeHtml(e.message || 'Could not load suggestions')}</div>`;
    }
  }
}

async function fillFamilySuburbFromPlace(placeId, displayText){
  try{
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      headers: {
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'addressComponents,location'
      }
    });
    const data = await res.json();
    const components = data.addressComponents || [];
    const postcodeComp = components.find(c=>c.types.includes('postal_code'));
    const localityComp = components.find(c=>c.types.includes('locality')) || components.find(c=>c.types.includes('sublocality'));
    const stateComp = components.find(c=>c.types.includes('administrative_area_level_1'));
    const suburbName = localityComp ? localityComp.longText : displayText.split(',')[0];
    const stateAbbrev = stateComp ? (stateComp.shortText || stateComp.longText) : '';
    const label = stateAbbrev ? `${suburbName}, ${stateAbbrev}` : suburbName;

    ffSuburbInput.value = label;
    if(postcodeComp) ffPostcodeInput.value = postcodeComp.longText;
    ffSuburbSelectedData = {
      postcode: postcodeComp ? postcodeComp.longText : '',
      suburb: label,
      lat: data.location ? data.location.latitude : null,
      lon: data.location ? data.location.longitude : null
    };
  }catch(e){
    console.error('Could not fetch suburb place details', e);
    showToast('Could not look up that suburb — please try again.');
  }finally{
    ffSuburbSessionToken = null;
  }
}

function getChildrenFromForm(){
  return Array.from(childrenList.querySelectorAll('.child-row')).map(row=>({
    name: row.querySelector('.child-name').value.trim(),
    dob: row.querySelector('.child-dob').value
  })).filter(c=>c.name);
}

function ageLabel(dobStr){
  if(!dobStr) return null;
  const dob = new Date(dobStr+'T00:00:00');
  if(isNaN(dob.getTime())) return null;
  const now = new Date();
  let months = (now.getFullYear()-dob.getFullYear())*12 + (now.getMonth()-dob.getMonth());
  if(now.getDate() < dob.getDate()) months--;
  if(months < 0) return null;
  if(months < 24) return months + 'mo';
  return Math.floor(months/12) + 'y';
}

const countRowFam = document.getElementById('countRowFam');
const gridAreaFam = document.getElementById('gridAreaFam');
const overlayFam = document.getElementById('overlayFam');
const searchInputFam = document.getElementById('searchInputFam');
const filterSuburbFam = document.getElementById('filterSuburbFam');

async function migrateLegacyFamilies(){
  try{
    if(localStorage.getItem('ds-migrated-families')) return;
    const res = await storageService.get(FAM_STORAGE_KEY, true);
    const legacy = res && res.value ? JSON.parse(res.value) : [];
    if(legacy.length){
      await Promise.all(legacy.map(f=>{
        const id = f.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
        const {id: _drop, ...rest} = f;
        return db.collection('families').doc(id).set(rest);
      }));
      await storageService.delete(FAM_STORAGE_KEY, true);
    }
    localStorage.setItem('ds-migrated-families', '1');
  }catch(e){
    console.error('Legacy families migration failed (non-fatal)', e);
  }
}

export async function loadFamiliesData(){
  gridAreaFam.innerHTML = `<div class="empty-state">Loading...</div>`;
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await migrateLegacyFamilies();
      const snap = await db.collection('families').get();
      familiesData = snap.docs.map(d=>({ id: d.id, ...d.data() }));
      populateSuburbFilter();
      renderFam();
      return;
    }catch(e){
      console.error('loadFamiliesData failed (attempt '+attempt+')', e);
      if(attempt === 4){
        gridAreaFam.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 9v4"/><path d="M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg><div class="display">Temporary hiccup loading data</div><p>This looks like a brief slowdown on Claude's side, not lost data. Please try again in a moment.</p><button class="btn btn-primary" id="retryLoadBtnFam" style="margin-top:10px;">Try again</button></div>`;
        document.getElementById('retryLoadBtnFam').addEventListener('click', loadFamiliesData);
        return;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function saveFamilyDoc(id, payload){
  for(let attempt=1; attempt<=4; attempt++){
    try{
      await db.collection('families').doc(id).set(payload);
      return true;
    }catch(e){
      console.error('saveFamilyDoc failed (attempt '+attempt+')', e);
      if(attempt === 4){
        showToast('Save failed: ' + (e && e.message ? e.message : 'unknown error'));
        return false;
      }
      await new Promise(r=>setTimeout(r, 400));
    }
  }
}

export async function deleteFamilyDoc(id){
  try{
    await db.collection('families').doc(id).delete();
    return true;
  }catch(e){
    console.error('deleteFamilyDoc failed', e);
    showToast('Delete failed: ' + (e && e.message ? e.message : 'unknown error'));
    return false;
  }
}

export function populateSuburbFilter(){
  const suburbs = Array.from(new Set(familiesData.map(f=>f.suburb).filter(Boolean))).sort();
  const current = filterSuburbFam.value;
  filterSuburbFam.innerHTML = '<option value="">All suburbs</option>' +
    suburbs.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  filterSuburbFam.value = current;
}

export function renderFam(){
  const q = searchInputFam.value.trim().toLowerCase();
  const suburb = filterSuburbFam.value;

  let filtered = familiesData.filter(f=>{
    const matchesSuburb = !suburb || f.suburb === suburb;
    const kidNames = (f.children||[]).map(c=>c.name).join(' ');
    const haystack = [f.nome, f.suburb, f.observacoes, kidNames].join(' ').toLowerCase();
    const matchesQ = !q || haystack.includes(q);
    return matchesSuburb && matchesQ;
  });

  countRowFam.textContent = familiesData.length === 0
    ? ''
    : `${filtered.length} of ${familiesData.length} famil${familiesData.length===1?'y':'ies'}`;

  if(familiesData.length === 0){
    gridAreaFam.innerHTML = `
      <div class="empty-state">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="7" r="3"/><path d="M2 21v-2a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v2"/><circle cx="18" cy="8" r="2.5"/><path d="M15.5 21v-1.5a3.5 3.5 0 0 1 3.5-3.5h1a3.5 3.5 0 0 1 3.5 3.5V21"/></svg>
        <div class="display">No families added yet</div>
        <p>Add your family to start connecting with others nearby.</p>
      </div>`;
    updateFamiliesMap();
    return;
  }

  if(filtered.length === 0){
    gridAreaFam.innerHTML = `<div class="empty-state"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16" y2="16"/></svg><div class="display">Nothing found</div><p>Try a different search or suburb.</p></div>`;
    updateFamiliesMap();
    return;
  }

  filtered.sort((a,b)=> a.nome.localeCompare(b.nome, 'en'));
  if(VIEW_MODES['families'] === 'table'){
    gridAreaFam.innerHTML = buildTableWrap(['Parents','Suburb','Kids','Playgroup'], filtered.map(tableRowHtmlFam).join(''));
  }else{
    gridAreaFam.innerHTML = `<div class="grid">${filtered.map(cardHtmlFam).join('')}</div>`;
  }

  gridAreaFam.querySelectorAll('[data-edit]').forEach(btn=>{
    btn.addEventListener('click', ()=>openFamModal(btn.getAttribute('data-edit')));
  });
  gridAreaFam.querySelectorAll('[data-del]').forEach(btn=>{
    btn.addEventListener('click', ()=>deleteFamItem(btn.getAttribute('data-del')));
  });
  gridAreaFam.querySelectorAll('[data-reqdel-family]').forEach(btn=>{
    btn.addEventListener('click', ()=>requestDeleteFamily(btn.getAttribute('data-reqdel-family')));
  });
  gridAreaFam.querySelectorAll('[data-details]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const item = familiesData.find(x=>x.id===btn.getAttribute('data-details'));
      if(item) showDetailsModal(cardHtmlFam(item));
    });
  });

  updateFamiliesMap();
}

function tableRowHtmlFam(f){
  const kids = (f.children||[]).map(c=>{ const a = ageLabel(c.dob); return a ? `${escapeHtml(c.name)} (${a})` : escapeHtml(c.name); }).join(', ');
  return `<tr>
    <td><b>${escapeHtml(f.nome)}</b></td>
    <td>${f.suburb ? escapeHtml(f.suburb) : ''}</td>
    <td>${kids}</td>
    <td style="text-align:center;">${f.playgroup ? '<span class="table-check">✓</span>' : ''}</td>
    <td class="table-actions">
      <button class="btn-edit" data-details="${f.id}">Details</button>
      <button class="btn-edit" data-edit="${f.id}">Edit</button>
      ${isAdminUser ? `<button class="btn-danger-text" data-del="${f.id}">Delete</button>` : `<button class="btn-edit" data-reqdel-family="${f.id}">Request removal</button>`}
    </td>
  </tr>`;
}

function cardHtmlFam(f){
  const kids = f.children || [];
  const kidsLine = kids.length
    ? kids.map(c=>{ const a = ageLabel(c.dob); return escapeHtml(c.name) + (a ? ` (${a})` : ''); }).join(', ')
    : '';
  return `
  <div class="card">
    ${f.photoUrl ? `<img src="${escapeHtml(f.photoUrl)}" alt="${escapeHtml(f.nome)}" class="product-photo" onerror="this.style.display='none'">` : ''}
    <div class="tags">
      ${f.suburb ? `<span class="tag" style="background:#2E5FA3"><span class="dot"></span>${escapeHtml(f.suburb)}</span>` : ''}
      ${f.playgroup ? `<span class="tag" style="background:#F4B942;color:#3A2C05"><span class="dot" style="background:rgba(0,0,0,0.35)"></span>Open to playgroups</span>` : ''}
    </div>
    <div class="body">
      <h3>${escapeHtml(f.nome)}</h3>
      ${f.telefone ? `<div class="field-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg><span>${escapeHtml(formatPhone(f.telefone))}</span></div>` : ''}
      ${kidsLine ? `<div class="kids-line"><b>Kids:</b> ${kidsLine}</div>` : ''}
      ${f.observacoes ? `<div class="notes">${escapeHtml(f.observacoes)}</div>` : ''}
      <div class="card-actions">
        ${isAdminUser ? `<button class="btn-danger-text" data-del="${f.id}">Delete</button>` : `<button class="btn-edit" data-reqdel-family="${f.id}">Request removal</button>`}
        <button class="btn-edit" data-edit="${f.id}">Edit</button>
      </div>
    </div>
  </div>`;
}

function openFamModal(id){
  editingFamId = id || null;
  const f = id ? familiesData.find(x=>x.id===id) : null;

  document.getElementById('modalTitleFam').textContent = f ? 'Edit family' : 'Add family';
  document.getElementById('ff-parent1').value = f ? (f.parent1 || f.nome || '') : '';
  document.getElementById('ff-parent2').value = f ? (f.parent2 || '') : '';
  document.getElementById('ff-postcode').value = f ? f.postcode||'' : '';
  document.getElementById('ff-suburb').value = f && f.suburb ? f.suburb : '';
  ffSuburbSelectedData = (f && f.suburb) ? { postcode: f.postcode, suburb: f.suburb, lat: f.lat, lon: f.lon } : null;
  document.getElementById('ff-telefone').value = f ? f.telefone||'' : '';
  document.getElementById('ff-photo').value = f ? f.photoUrl||'' : '';
  const ffPreview = document.getElementById('ff-photo-preview');
  const ffRemoveBtn = document.getElementById('ff-photo-remove');
  if(f && f.photoUrl){ ffPreview.src = f.photoUrl; ffPreview.style.display = 'block'; ffRemoveBtn.style.display = ''; }
  else { ffPreview.style.display = 'none'; ffPreview.src = ''; ffRemoveBtn.style.display = 'none'; }
  document.getElementById('ff-photo-file').value = '';
  document.getElementById('ff-photo-status').textContent = '';
  document.getElementById('ff-playgroup').checked = f ? !!f.playgroup : true;
  document.getElementById('ff-obs').value = f ? f.observacoes||'' : '';
  document.getElementById('ferr-nome').style.display = 'none';
  document.getElementById('ferr-suburb').style.display = 'none';

  childrenList.innerHTML = '';
  if(f && f.children && f.children.length){
    f.children.forEach(c=>addChildRow(c.name, c.dob));
  }else{
    addChildRow();
  }

  overlayFam.classList.add('open');
  setTimeout(()=>document.getElementById('ff-parent1').focus(), 50);
}

function closeFamModal(){
  overlayFam.classList.remove('open');
  editingFamId = null;
}

async function deleteFamItem(id){
  const f = familiesData.find(x=>x.id===id);
  if(!f) return;
  if(!confirm(`Delete "${f.nome}" from the directory?`)) return;
  const ok = await deleteFamilyDoc(id);
  if(ok){
    familiesData = familiesData.filter(x=>x.id!==id);
    populateSuburbFilter();
    renderFam();
    showToast('Family deleted.');
    logActivity('family', 'deleted', f.nome);
  }
}

function requestDeleteFamily(id){
  const f = familiesData.find(x=>x.id===id);
  if(!f) return;
  openRequestRemovalModal('family', id, null, f.nome);
}

document.getElementById('addBtnFam').addEventListener('click', ()=>openFamModal(null));
document.getElementById('cancelBtnFam').addEventListener('click', closeFamModal);
overlayFam.addEventListener('click', (e)=>{ if(e.target === overlayFam) closeFamModal(); });

document.getElementById('saveBtnFam').addEventListener('click', async ()=>{
  if(pendingPhotoUploads > 0){
    showToast('Please wait for the photo to finish uploading before saving.');
    return;
  }
  const parent1 = document.getElementById('ff-parent1').value.trim();
  const parent2 = document.getElementById('ff-parent2').value.trim();
  const nome = parent2 ? `${parent1} & ${parent2}` : parent1;
  const suburbLabel = document.getElementById('ff-suburb').value.trim();

  if(!parent1){
    document.getElementById('ferr-nome').style.display = 'block';
    return;
  }
  document.getElementById('ferr-nome').style.display = 'none';

  if(!suburbLabel || !ffSuburbSelectedData || ffSuburbSelectedData.suburb !== suburbLabel){
    document.getElementById('ferr-suburb').style.display = 'block';
    return;
  }
  document.getElementById('ferr-suburb').style.display = 'none';

  const saveBtn = document.getElementById('saveBtnFam');
  saveBtn.textContent = 'Saving...';
  saveBtn.disabled = true;

  const payload = {
    id: editingFamId || (Date.now().toString(36) + Math.random().toString(36).slice(2,7)),
    nome,
    parent1,
    parent2,
    postcode: ffSuburbSelectedData.postcode,
    suburb: suburbLabel,
    lat: ffSuburbSelectedData.lat,
    lon: ffSuburbSelectedData.lon,
    telefone: document.getElementById('ff-telefone').value.trim(),
    photoUrl: document.getElementById('ff-photo').value.trim(),
    children: getChildrenFromForm(),
    playgroup: document.getElementById('ff-playgroup').checked,
    observacoes: document.getElementById('ff-obs').value.trim()
  };

  if(editingFamId){
    const idx = familiesData.findIndex(x=>x.id===editingFamId);
    if(idx>-1) familiesData[idx] = payload;
  }else{
    familiesData.push(payload);
  }

  const ok = await saveFamilyDoc(payload.id, payload);
  saveBtn.textContent = 'Save';
  saveBtn.disabled = false;
  if(ok){
    const wasEditing = !!editingFamId;
    closeFamModal();
    populateSuburbFilter();
    renderFam();
    showToast(wasEditing ? 'Family updated.' : 'Family added.');
    logActivity('family', wasEditing ? 'edited' : 'added', nome);
  }
});

searchInputFam.addEventListener('input', renderFam);
filterSuburbFam.addEventListener('change', renderFam);

/* ---------- Map ---------- */
document.getElementById('toggleMapBtn').addEventListener('click', ()=>{
  mapOpen = !mapOpen;
  const mapDiv = document.getElementById('familiesMap');
  mapDiv.classList.toggle('open', mapOpen);
  if(mapOpen){
    if(!familiesMapInstance){
      familiesMapInstance = L.map('familiesMap', { zoomControl: true, attributionControl: true }).setView([-33.8688, 151.2093], 10);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
        subdomains: 'abcd'
      }).addTo(familiesMapInstance);
      familiesMarkersLayer = L.layerGroup().addTo(familiesMapInstance);
    }
    setTimeout(()=>{ familiesMapInstance.invalidateSize(); updateFamiliesMap(); }, 60);
  }
});

const familyPinIcon = L.divIcon({
  className: 'family-pin',
  html: `<svg width="30" height="38" viewBox="0 0 30 38" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 23 15 23s15-12.5 15-23C30 6.7 23.3 0 15 0z" fill="#2E5FA3"/>
    <circle cx="15" cy="15" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [30, 38],
  iconAnchor: [15, 38],
  popupAnchor: [0, -34]
});

function updateFamiliesMap(){
  if(!familiesMapInstance || !familiesMarkersLayer) return;
  familiesMarkersLayer.clearLayers();
  const withCoords = familiesData.filter(f=>f.lat && f.lon);
  withCoords.forEach(f=>{
    const kids = (f.children||[]).map(c=>{ const a = ageLabel(c.dob); return a ? `${escapeHtml(c.name)} (${a})` : escapeHtml(c.name); }).join(', ');
    const marker = L.marker([f.lat, f.lon], { icon: familyPinIcon }).addTo(familiesMarkersLayer);
    marker.bindPopup(`<b>${escapeHtml(f.nome)}</b><br>${escapeHtml(f.suburb||'')}${kids ? '<br>'+kids : ''}${f.playgroup ? '<br><i>Open to playgroups</i>' : ''}`);
  });
  if(withCoords.length){
    const bounds = L.latLngBounds(withCoords.map(f=>[f.lat, f.lon]));
    familiesMapInstance.fitBounds(bounds, { padding: [30,30], maxZoom: 13 });
  }
}

wirePhotoUpload('ff-photo-file', 'ff-photo', 'ff-photo-status', 'ff-photo-preview', 'family-photos', 'saveBtnFam');
wirePhotoRemoveButton('ff-photo', 'ff-photo-preview', 'ff-photo-file');

RENDER_FN_BY_SECTION.families = renderFam;
