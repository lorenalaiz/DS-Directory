/* ---------- Admin login (gates Activity / Backup / Restore) ---------- */
import { auth } from './firebase-service.js';
import { showToast } from './utils.js';
import { setIsAdminUser } from './shared.js';
import { switchView } from './view-switcher.js';
import { renderReviewsModal } from './views/reviews.js';

const overlayAdminLogin = document.getElementById('overlayAdminLogin');

function setAdminUiVisible(isAdmin){
  document.querySelectorAll('.admin-only').forEach(el=>{
    el.style.display = isAdmin ? '' : 'none';
  });
  document.getElementById('adminLoginBtn').style.display = isAdmin ? 'none' : '';
  document.getElementById('contactBtn').style.display = isAdmin ? 'none' : '';
  document.getElementById('ndisBanner').style.display = isAdmin ? 'none' : '';
  document.getElementById('tabNdisguide').style.display = isAdmin ? 'none' : '';
  document.getElementById('installAppBtn').style.display = isAdmin ? 'none' : '';
  if(isAdmin && document.getElementById('viewNdisguide').style.display !== 'none'){
    switchView('professionals');
  }
}

document.getElementById('adminMenuBtn').addEventListener('click', (e)=>{
  e.stopPropagation();
  document.getElementById('adminMenuDropdown').classList.toggle('open');
});
document.addEventListener('click', (e)=>{
  const dropdown = document.getElementById('adminMenuDropdown');
  if(dropdown.classList.contains('open') && !e.target.closest('#adminMenuWrap')){
    dropdown.classList.remove('open');
  }
});

auth.onAuthStateChanged(user=>{
  setIsAdminUser(!!user);
  setAdminUiVisible(!!user);
  renderReviewsModal();
});

document.getElementById('adminLoginBtn').addEventListener('click', ()=>{
  document.getElementById('admin-email').value = '';
  document.getElementById('admin-password').value = '';
  document.getElementById('admin-login-error').style.display = 'none';
  overlayAdminLogin.classList.add('open');
});

document.getElementById('closeAdminLoginBtn').addEventListener('click', ()=>{
  overlayAdminLogin.classList.remove('open');
});
overlayAdminLogin.addEventListener('click', (e)=>{ if(e.target === overlayAdminLogin) overlayAdminLogin.classList.remove('open'); });

document.getElementById('submitAdminLoginBtn').addEventListener('click', async ()=>{
  const email = document.getElementById('admin-email').value.trim();
  const password = document.getElementById('admin-password').value;
  const btn = document.getElementById('submitAdminLoginBtn');
  const errEl = document.getElementById('admin-login-error');
  errEl.style.display = 'none';
  btn.textContent = 'Signing in...';
  btn.disabled = true;
  try{
    await auth.signInWithEmailAndPassword(email, password);
    overlayAdminLogin.classList.remove('open');
    showToast('Signed in as admin.');
  }catch(e){
    errEl.textContent = e.message || 'Incorrect email or password.';
    errEl.style.display = 'block';
  }
  btn.textContent = 'Sign in';
  btn.disabled = false;
});

document.getElementById('adminLogoutBtn').addEventListener('click', async ()=>{
  await auth.signOut();
  showToast('Signed out.');
});
