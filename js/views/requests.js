/* ---------- Delete requests (admin-only approve/deny queue) ---------- */
import { db } from '../firebase-service.js';
import { showToast, escapeHtml, timeAgo } from '../utils.js';
import { logActivity } from '../shared.js';
import { data, render, populateCategoryFilter, deleteProfessionalDoc } from './professionals.js';
import { productsData, renderProd, populateCategoryFilterProd, deleteProductDoc } from './products.js';
import { familiesData, renderFam, populateSuburbFilter, deleteFamilyDoc } from './families.js';
import { marketplaceData, renderMkt, deleteMarketplaceDoc } from './marketplace.js';

const gridAreaReq = document.getElementById('gridAreaReq');
const countRowReq = document.getElementById('countRowReq');
let deleteRequestsData = [];

export async function loadDeleteRequests(){
  gridAreaReq.innerHTML = `<div class="empty-state">Loading...</div>`;
  try{
    const snap = await db.collection('delete-requests').orderBy('requestedAt', 'desc').limit(200).get();
    deleteRequestsData = snap.docs.map(d=>({ id: d.id, ...d.data() }));
  }catch(e){
    console.error('Failed to load delete requests', e);
    deleteRequestsData = [];
  }
  renderDeleteRequests();
}

function renderDeleteRequests(){
  document.getElementById('tabRequests').classList.toggle('has-alert', deleteRequestsData.length > 0);
  const reqBadge = document.getElementById('badgeRequests');
  reqBadge.textContent = deleteRequestsData.length;
  reqBadge.style.display = deleteRequestsData.length > 0 ? '' : 'none';
  countRowReq.textContent = deleteRequestsData.length
    ? `${deleteRequestsData.length} request${deleteRequestsData.length===1?'':'s'}`
    : '';
  if(!deleteRequestsData.length){
    gridAreaReq.innerHTML = `<div class="empty-state"><div class="display">No pending requests</div><p>Removal requests from the community will show up here.</p></div>`;
    return;
  }
  const reqTypeInfo = {
    professional: { label: 'Professional', color: '#2E5FA3' },
    review: { label: 'Review', color: '#7B6BA8' },
    product: { label: 'Product', color: '#D97D4C' },
    family: { label: 'Family', color: '#5C9EA0' },
    marketplace: { label: 'Marketplace', color: '#8A6D3D' }
  };
  gridAreaReq.innerHTML = `<div class="grid">${deleteRequestsData.map(req=>{
    const info = reqTypeInfo[req.type] || { label: 'Item', color: '#7A8590' };
    return `
    <div class="card">
      <div class="tags"><span class="tag" style="background:${info.color}"><span class="dot"></span>${info.label}</span></div>
      <div class="body">
        <h3 style="font-size:15px;">${escapeHtml(req.name || '(unnamed)')}</h3>
        ${req.reason ? `<div class="notes" style="border-top:none;padding-top:0;"><strong>Reason:</strong> ${escapeHtml(req.reason)}</div>` : ''}
        <div style="font-size:11.5px;color:var(--muted);margin:6px 0 14px;">Requested by ${escapeHtml(req.requesterName || 'Anonymous')} · ${timeAgo(req.requestedAt)}</div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary" style="padding:8px 14px;font-size:13px;" data-approve="${req.id}">Approve (delete)</button>
          <button class="btn btn-ghost" style="padding:8px 14px;font-size:13px;" data-deny="${req.id}">Deny</button>
        </div>
      </div>
    </div>
  `;
  }).join('')}</div>`;

  gridAreaReq.querySelectorAll('[data-approve]').forEach(btn=>{
    btn.addEventListener('click', ()=>approveDeleteRequest(btn.getAttribute('data-approve')));
  });
  gridAreaReq.querySelectorAll('[data-deny]').forEach(btn=>{
    btn.addEventListener('click', ()=>denyDeleteRequest(btn.getAttribute('data-deny')));
  });
}

async function approveDeleteRequest(reqId){
  const req = deleteRequestsData.find(r=>r.id===reqId);
  if(!req) return;
  if(!confirm(`Delete "${req.name}" for real? This cannot be undone.`)) return;
  try{
    if(req.type === 'professional'){
      await deleteProfessionalDoc(req.targetId);
      const idx = data.findIndex(x=>x.id===req.targetId);
      if(idx>-1) data.splice(idx, 1);
      populateCategoryFilter();
      render();
      logActivity('professional', 'deleted', req.name);
    }else if(req.type === 'review'){
      await db.collection('professionals').doc(req.profId).collection('reviews').doc(req.targetId).delete();
      const p = data.find(x=>x.id===req.profId);
      if(p && p.reviews) p.reviews = p.reviews.filter(r=>r.id!==req.targetId);
      render();
      logActivity('professional', 'deleted', req.name);
    }else if(req.type === 'product'){
      await deleteProductDoc(req.targetId);
      const idx = productsData.findIndex(x=>x.id===req.targetId);
      if(idx>-1) productsData.splice(idx, 1);
      populateCategoryFilterProd();
      renderProd();
      logActivity('product', 'deleted', req.name);
    }else if(req.type === 'family'){
      await deleteFamilyDoc(req.targetId);
      const idx = familiesData.findIndex(x=>x.id===req.targetId);
      if(idx>-1) familiesData.splice(idx, 1);
      populateSuburbFilter();
      renderFam();
      logActivity('family', 'deleted', req.name);
    }else if(req.type === 'marketplace'){
      await deleteMarketplaceDoc(req.targetId);
      const idx = marketplaceData.findIndex(x=>x.id===req.targetId);
      if(idx>-1) marketplaceData.splice(idx, 1);
      renderMkt();
      logActivity('marketplace', 'deleted', req.name);
    }
    await db.collection('delete-requests').doc(reqId).delete();
    deleteRequestsData = deleteRequestsData.filter(r=>r.id!==reqId);
    renderDeleteRequests();
    showToast('Approved and deleted.');
  }catch(e){
    console.error('Failed to approve request', e);
    showToast('Something went wrong: ' + (e.message || 'unknown error'));
  }
}

async function denyDeleteRequest(reqId){
  if(!confirm('Deny this request? The item will stay as-is.')) return;
  try{
    await db.collection('delete-requests').doc(reqId).delete();
    deleteRequestsData = deleteRequestsData.filter(r=>r.id!==reqId);
    renderDeleteRequests();
    showToast('Request denied.');
  }catch(e){
    console.error('Failed to deny request', e);
    showToast('Something went wrong: ' + (e.message || 'unknown error'));
  }
}
