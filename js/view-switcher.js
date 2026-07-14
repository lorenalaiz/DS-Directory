/* ---------- View tab switching ---------- */
import { familiesMapInstance } from './views/families.js';
import { loadActivityData } from './views/activity.js';
import { loadDeleteRequests } from './views/requests.js';
import { loadMessagesData } from './views/messages.js';

let ndisGuideLoaded = false;
async function loadNdisGuide(){
  if(ndisGuideLoaded) return;
  ndisGuideLoaded = true;
  const res = await fetch('./partials/ndis-guide.html');
  document.getElementById('viewNdisguide').innerHTML = await res.text();
}

export const TAB_IDS = ['professionals','products','families','marketplace','ndisguide','messages','activity','requests'];

export function switchView(view, persist=true){
  TAB_IDS.forEach(v=>{
    document.getElementById('tab'+v.charAt(0).toUpperCase()+v.slice(1)).classList.toggle('active', v===view);
    document.getElementById('view'+v.charAt(0).toUpperCase()+v.slice(1)).style.display = (v===view) ? '' : 'none';
  });
  if(persist){
    try{ localStorage.setItem('ds-network-active-tab', view); }catch(e){}
  }
  if(view === 'families' && familiesMapInstance){
    setTimeout(()=>familiesMapInstance.invalidateSize(), 50);
  }
  if(view === 'activity'){
    loadActivityData();
  }
  if(view === 'requests'){
    loadDeleteRequests();
  }
  if(view === 'ndisguide'){
    loadNdisGuide();
  }
  if(view === 'messages'){
    loadMessagesData().then(()=>{
      localStorage.setItem('ds-messages-last-seen', Date.now());
    });
  }
}

document.getElementById('tabProfessionals').addEventListener('click', ()=>switchView('professionals'));
document.getElementById('tabProducts').addEventListener('click', ()=>switchView('products'));
document.getElementById('tabFamilies').addEventListener('click', ()=>switchView('families'));
document.getElementById('tabMarketplace').addEventListener('click', ()=>switchView('marketplace'));
document.getElementById('tabNdisguide').addEventListener('click', ()=>switchView('ndisguide'));
document.getElementById('viewNdisGuideBtn').addEventListener('click', ()=>switchView('ndisguide'));
document.getElementById('tabMessages').addEventListener('click', ()=>switchView('messages'));
document.getElementById('tabActivity').addEventListener('click', ()=>switchView('activity'));
document.getElementById('tabRequests').addEventListener('click', ()=>switchView('requests'));
