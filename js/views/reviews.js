/* ---------- Reviews (per-professional) ---------- */
import { db } from '../firebase-service.js';
import { showToast, escapeHtml, timeAgo } from '../utils.js';
import { isAdminUser, starsHtml, openRequestRemovalModal, logActivity } from '../shared.js';
import { data, render, averageRating } from './professionals.js';

let reviewingProfId = null;
let currentReviewStars = 0;

const reviewsOverlay = document.getElementById('overlayReviews');
const starInputReview = document.getElementById('starInputReview');

function updateStarInputReview(){
  document.querySelectorAll('#starInputReview span').forEach(s=>{
    s.classList.toggle('on', Number(s.getAttribute('data-v')) <= currentReviewStars);
  });
}
starInputReview.addEventListener('click', (e)=>{
  if(e.target.tagName === 'SPAN'){
    const v = Number(e.target.getAttribute('data-v'));
    currentReviewStars = (currentReviewStars === v) ? v-1 : v;
    updateStarInputReview();
  }
});

function requestDeleteReview(reviewId){
  const p = data.find(x=>x.id===reviewingProfId);
  if(!p) return;
  const review = (p.reviews||[]).find(r=>r.id===reviewId);
  openRequestRemovalModal('review', reviewId, p.id, `${p.nome}${review ? ` (by ${review.author})` : ''}`);
}

function renderReviewsModal(){
  const p = data.find(x=>x.id===reviewingProfId);
  if(!p) return;
  document.getElementById('reviewsModalTitle').textContent = `Reviews · ${p.nome}`;

  const avg = averageRating(p);
  const count = (p.reviews||[]).length;
  document.getElementById('reviewsSummary').innerHTML = avg
    ? `<div class="stars" style="font-size:16px;">${starsHtml(Math.round(avg))} <span style="color:var(--muted);font-size:13px;">${avg.toFixed(1)} average${count ? ` · ${count} review${count===1?'':'s'}` : ' · initial rating, no written reviews yet'}</span></div>`
    : `<p style="color:var(--muted);font-size:13.5px;">No ratings yet — be the first to review.</p>`;

  const list = (p.reviews || []).slice().sort((a,b)=>b.at-a.at);
  const listEl = document.getElementById('reviewsList');
  if(!list.length){
    listEl.innerHTML = `<p style="color:var(--muted);font-size:13px;">No written reviews yet.</p>`;
  }else{
    listEl.innerHTML = list.map(r=>`
      <div style="padding:12px 2px;border-bottom:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-weight:600;font-size:13.5px;">${escapeHtml(r.author || 'Anonymous')}</span>
          <span style="font-size:11.5px;color:var(--muted);display:flex;align-items:center;gap:8px;">
            ${timeAgo(r.at)}
            ${isAdminUser ? `<button class="btn-danger-text" style="padding:2px 4px;font-size:11.5px;" data-del-review="${r.id}">Delete</button>` : `<button class="btn-edit" style="padding:2px 4px;font-size:11.5px;" data-reqdel-review="${r.id}">Request removal</button>`}
          </span>
        </div>
        <div class="stars" style="margin:4px 0;">${starsHtml(r.rating)}</div>
        ${r.comment ? `<div style="font-size:13px;color:var(--ink);line-height:1.5;white-space:pre-line;">${escapeHtml(r.comment)}</div>` : ''}
      </div>
    `).join('');
    listEl.querySelectorAll('[data-del-review]').forEach(btn=>{
      btn.addEventListener('click', ()=>deleteReview(btn.getAttribute('data-del-review')));
    });
    listEl.querySelectorAll('[data-reqdel-review]').forEach(btn=>{
      btn.addEventListener('click', ()=>requestDeleteReview(btn.getAttribute('data-reqdel-review')));
    });
  }
}

async function deleteReview(reviewId){
  const p = data.find(x=>x.id===reviewingProfId);
  if(!p || !p.reviews) return;
  if(!confirm('Delete this review? This cannot be undone.')) return;

  try{
    await db.collection('professionals').doc(p.id).collection('reviews').doc(reviewId).delete();
    p.reviews = p.reviews.filter(r=>r.id !== reviewId);
    renderReviewsModal();
    render();
    showToast('Review deleted.');
    logActivity('professional', 'deleted', `Review on ${p.nome}`);
  }catch(e){
    console.error('Failed to delete review', e);
    showToast('Delete failed: ' + (e.message || 'unknown error'));
  }
}

export function openReviewsModal(id){
  reviewingProfId = id;
  document.getElementById('rv-author').value = '';
  document.getElementById('rv-comment').value = '';
  currentReviewStars = 0;
  updateStarInputReview();
  renderReviewsModal();
  reviewsOverlay.classList.add('open');
}

function closeReviewsModal(){
  reviewsOverlay.classList.remove('open');
  reviewingProfId = null;
}

document.getElementById('closeReviewsBtn').addEventListener('click', closeReviewsModal);
reviewsOverlay.addEventListener('click', (e)=>{ if(e.target === reviewsOverlay) closeReviewsModal(); });

document.getElementById('submitReviewBtn').addEventListener('click', async ()=>{
  if(currentReviewStars === 0){
    showToast('Please choose a star rating.');
    return;
  }
  const p = data.find(x=>x.id===reviewingProfId);
  if(!p) return;

  const review = {
    author: document.getElementById('rv-author').value.trim() || 'Anonymous',
    rating: currentReviewStars,
    comment: document.getElementById('rv-comment').value.trim(),
    at: Date.now()
  };

  const btn = document.getElementById('submitReviewBtn');
  btn.textContent = 'Posting...';
  btn.disabled = true;
  let ok = true;
  let newReviewId = null;
  try{
    const ref = await db.collection('professionals').doc(p.id).collection('reviews').add(review);
    newReviewId = ref.id;
  }catch(e){
    console.error('Failed to post review', e);
    ok = false;
  }
  btn.textContent = 'Post review';
  btn.disabled = false;

  if(ok){
    if(!p.reviews) p.reviews = [];
    p.reviews.push({ id: newReviewId, ...review });
    document.getElementById('rv-author').value = '';
    document.getElementById('rv-comment').value = '';
    currentReviewStars = 0;
    updateStarInputReview();
    renderReviewsModal();
    render();
    showToast('Review posted.');
    logActivity('professional', 'reviewed', `${p.nome} (by ${review.author})`);
  }else{
    showToast('Something went wrong posting your review. Please try again.');
  }
});

export { renderReviewsModal };
