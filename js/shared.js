/* ---------- Cross-cutting state & helpers shared by 2+ view sections ---------- */
import { db } from './firebase-service.js';
import { showToast, escapeHtml } from './utils.js';

/* ---------- Admin state ----------
   Other modules only get a live-binding READ of this exported `let` — they
   cannot reassign it directly. Reassignment must go through setIsAdminUser(). */
export let isAdminUser = false;
export function setIsAdminUser(value){
  isAdminUser = !!value;
}

/* ---------- Cards / Table view mode (independent per section) ---------- */
export const VIEW_MODE_SECTIONS = ['professionals','products','families','marketplace','messages'];
export const RENDER_FN_BY_SECTION = {}; // each view module registers itself here once its render fn exists
export let VIEW_MODES = {};
VIEW_MODE_SECTIONS.forEach(section=>{
  let saved = 'cards';
  try{ saved = localStorage.getItem('ds-network-view-mode-'+section) || 'cards'; }catch(e){}
  VIEW_MODES[section] = saved;
});

export function buildTableWrap(headers, rowsHtml){
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}<th></th></tr></thead><tbody>${rowsHtml}</tbody></table></div>`;
}

export function setSectionViewMode(section, mode){
  VIEW_MODES[section] = mode;
  try{ localStorage.setItem('ds-network-view-mode-'+section, mode); }catch(e){}
  document.querySelectorAll(`.view-mode-btn[data-section="${section}"]`).forEach(btn=>{
    btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
  });
  const fn = RENDER_FN_BY_SECTION[section];
  if(fn) fn();
}

document.querySelectorAll('.view-mode-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    setSectionViewMode(btn.getAttribute('data-section'), btn.getAttribute('data-mode'));
  });
});

export function starsHtml(n){
  n = n || 0;
  let out = '';
  for(let i=1;i<=5;i++){
    out += i<=n ? '★' : '<span class="empty">★</span>';
  }
  return out;
}

/* ---------- Generic "Details" modal (used from table view to show the full card) ---------- */
export const overlayDetails = document.getElementById('overlayDetails');
export function showDetailsModal(html){
  document.getElementById('detailsModalBody').innerHTML = html;
  overlayDetails.classList.add('open');
}
document.getElementById('closeDetailsBtn').addEventListener('click', ()=>{
  overlayDetails.classList.remove('open');
});
overlayDetails.addEventListener('click', (e)=>{ if(e.target === overlayDetails) overlayDetails.classList.remove('open'); });

/* ---------- "Request removal" modal (non-admin delete flow) ---------- */
export let pendingRemovalRequest = null; // { type, targetId, profId, name }

export function openRequestRemovalModal(type, targetId, profId, name){
  pendingRemovalRequest = { type, targetId, profId, name };
  const labels = {
    review: 'Review',
    professional: 'Professional',
    product: 'Product',
    family: 'Family',
    marketplace: 'Marketplace listing'
  };
  document.getElementById('reqRemovalTarget').textContent = `${labels[type] || 'Item'}: ${name}`;
  document.getElementById('reqRemovalName').value = '';
  document.getElementById('reqRemovalNameError').style.display = 'none';
  document.getElementById('reqRemovalReason').value = '';
  document.getElementById('reqRemovalError').style.display = 'none';
  document.getElementById('overlayRequestRemoval').classList.add('open');
}

document.getElementById('closeReqRemovalBtn').addEventListener('click', ()=>{
  document.getElementById('overlayRequestRemoval').classList.remove('open');
});
document.getElementById('overlayRequestRemoval').addEventListener('click', (e)=>{
  if(e.target.id === 'overlayRequestRemoval') document.getElementById('overlayRequestRemoval').classList.remove('open');
});

document.getElementById('submitReqRemovalBtn').addEventListener('click', async ()=>{
  const requesterName = document.getElementById('reqRemovalName').value.trim();
  if(!requesterName){
    document.getElementById('reqRemovalNameError').style.display = 'block';
    return;
  }
  document.getElementById('reqRemovalNameError').style.display = 'none';

  const reason = document.getElementById('reqRemovalReason').value.trim();
  if(!reason){
    document.getElementById('reqRemovalError').style.display = 'block';
    return;
  }
  document.getElementById('reqRemovalError').style.display = 'none';
  if(!pendingRemovalRequest) return;

  const btn = document.getElementById('submitReqRemovalBtn');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try{
    const { type, targetId, profId, name } = pendingRemovalRequest;
    const payload = { type, targetId, name, requesterName, reason, requestedAt: Date.now() };
    if(type === 'review') payload.profId = profId;
    await db.collection('delete-requests').add(payload);
    document.getElementById('overlayRequestRemoval').classList.remove('open');
    showToast('Request sent — the admin will review it.');
  }catch(e){
    console.error('Failed to send removal request', e);
    showToast('Something went wrong sending the request. Please try again.');
  }
  btn.textContent = 'Send request';
  btn.disabled = false;
});

/* ---------- Activity log ---------- */
export const SECTION_LABELS = { professional: 'Professional', product: 'Product', family: 'Family', system: 'System', marketplace: 'Marketplace' };
export const ACTION_LABELS = { added: 'Added', edited: 'Edited', deleted: 'Deleted', restored: 'Restored', reviewed: 'Reviewed' };
export const ACTION_COLORS = { added: '#5C8A3D', edited: '#4A82A0', deleted: '#C15C4A', restored: '#8A6D3D', reviewed: '#B0567A' };

let cachedUserIp = null;
async function getUserIp(){
  if(cachedUserIp) return cachedUserIp;
  try{
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    cachedUserIp = data.ip;
    return cachedUserIp;
  }catch(e){
    console.error('Could not determine IP', e);
    return null;
  }
}

export async function logActivity(section, action, name){
  try{
    const ip = await getUserIp();
    await db.collection('ds-network-activity').add({ section, action, name, at: Date.now(), ip: ip || 'unknown' });
  }catch(e){
    console.error('Failed to log activity', e);
  }
}
