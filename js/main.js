/* ---------- App entry point ----------
   Imports every module in (roughly) the same relative order the original
   single inline <script type="module"> had them, so top-level side effects
   (chip building, reading saved view-modes from localStorage, DOM listener
   wiring) run in the same sequence as before. Then runs the init code that
   used to sit at the very bottom of that script. */

import './firebase-service.js';
import './config.js';
import './utils.js';
import './constants.js';

import './shared.js';
import './photo-upload.js';

import { loadData } from './views/professionals.js';
import './views/reviews.js';
import './view-switcher.js';

import { loadProductsData } from './views/products.js';
import { loadFamiliesData } from './views/families.js';
import { loadMarketplaceData } from './views/marketplace.js';

import './backup-restore.js';

import { loadActivityData } from './views/activity.js';
import { loadDeleteRequests } from './views/requests.js';

import './admin.js';
import './contact.js';

import { loadMessagesData } from './views/messages.js';

import { TAB_IDS, switchView } from './view-switcher.js';
import { VIEW_MODE_SECTIONS, VIEW_MODES, isAdminUser } from './shared.js';

/* ---------- Kick off data loading now that every module is wired up ---------- */
loadData();
loadProductsData();
loadFamiliesData();
loadMarketplaceData();
loadMessagesData();
loadActivityData();
loadDeleteRequests();

VIEW_MODE_SECTIONS.forEach(section=>{
  document.querySelectorAll(`.view-mode-btn[data-section="${section}"]`).forEach(btn=>{
    btn.classList.toggle('active', btn.getAttribute('data-mode') === VIEW_MODES[section]);
  });
});

/* Restore whichever tab the person was on last time they visited */
(function restoreLastTab(){
  let saved = null;
  try{ saved = localStorage.getItem('ds-network-active-tab'); }catch(e){}
  if(saved && TAB_IDS.includes(saved) && saved !== 'professionals'){
    switchView(saved, false);
  }
})();

/* Register the service worker so the app can be installed to the home screen */
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=>{
    navigator.serviceWorker.register('sw.js').catch(e=>console.error('Service worker registration failed', e));
  });
}

/* ---------- Install App button ---------- */
const installBtn = document.getElementById('installAppBtn');
let deferredInstallPrompt = null;

function isStandalone(){
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

if(!isStandalone()){
  if(isIOS()){
    // iOS/Safari has no install prompt API — show tap-to-see-instructions instead
    if(!isAdminUser) installBtn.style.display = '';
    installBtn.addEventListener('click', ()=>{
      alert('To install: tap the Share button (square with an arrow) at the bottom of Safari, then choose "Add to Home Screen". If you don\'t see it in the first row, tap "More" (or "View More") to find it.');
    });
  }else{
    // Android/Chrome/Edge: capture the real install prompt
    window.addEventListener('beforeinstallprompt', (e)=>{
      e.preventDefault();
      deferredInstallPrompt = e;
      if(!isAdminUser) installBtn.style.display = '';
    });
    installBtn.addEventListener('click', async ()=>{
      if(!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installBtn.style.display = 'none';
    });
    window.addEventListener('appinstalled', ()=>{
      installBtn.style.display = 'none';
    });
  }
}
