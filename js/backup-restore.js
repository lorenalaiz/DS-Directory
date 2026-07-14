/* ---------- Backup & Restore (admin-only) ---------- */
import { db } from './firebase-service.js';
import { showToast } from './utils.js';
import { logActivity } from './shared.js';
import { loadAllReviews } from './views/professionals.js';

document.getElementById('backupBtn').addEventListener('click', async ()=>{
  try{
    const [profSnap, prodSnap, famSnap, mktSnap, actSnap, msgSnap, reviewsByProf] = await Promise.all([
      db.collection('professionals').get(),
      db.collection('products').get(),
      db.collection('families').get(),
      db.collection('marketplace').get(),
      db.collection('ds-network-activity').orderBy('at', 'desc').limit(300).get(),
      db.collection('ds-network-messages').orderBy('at', 'desc').limit(300).get(),
      loadAllReviews()
    ]);
    const backup = {
      exportedAt: new Date().toISOString(),
      professionals: profSnap.docs.map(d=>({ id: d.id, ...d.data(), reviews: reviewsByProf[d.id] || [] })),
      products: prodSnap.docs.map(d=>({ id: d.id, ...d.data() })),
      families: famSnap.docs.map(d=>({ id: d.id, ...d.data() })),
      marketplace: mktSnap.docs.map(d=>({ id: d.id, ...d.data() })),
      activityLog: actSnap.docs.map(d=>d.data()),
      contactMessages: msgSnap.docs.map(d=>d.data())
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `ds-network-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded.');
  }catch(e){
    console.error('Backup failed', e);
    showToast('Backup failed: ' + e.message);
  }
});

document.getElementById('restoreBtn').addEventListener('click', ()=>{
  document.getElementById('restoreFileInput').click();
});

document.getElementById('restoreFileInput').addEventListener('change', async (e)=>{
  const file = e.target.files[0];
  e.target.value = ''; // reset so choosing the same file again still fires 'change'
  if(!file) return;

  let parsed;
  try{
    const text = await file.text();
    parsed = JSON.parse(text);
  }catch(err){
    showToast('That file doesn\'t look like a valid backup.');
    return;
  }

  if(!parsed || (!parsed.professionals && !parsed.products && !parsed.families && !parsed.marketplace)){
    showToast('That file doesn\'t look like a valid DS Network backup.');
    return;
  }

  const exportedDate = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : 'an unknown date';
  const confirmed = confirm(
    `This will REPLACE everything currently in Professionals, Products, and Families with the contents of this backup (from ${exportedDate}).\n\nThis cannot be undone. Continue?`
  );
  if(!confirmed) return;

  try{
    if(parsed.professionals){
      const existing = await db.collection('professionals').get();
      await Promise.all(existing.docs.map(async d=>{
        const reviewsSnap = await d.ref.collection('reviews').get();
        await Promise.all(reviewsSnap.docs.map(r=>r.ref.delete()));
        await d.ref.delete();
      }));
      await Promise.all(parsed.professionals.map(async p=>{
        const id = p.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
        const {id: _drop, reviews, ...rest} = p;
        await db.collection('professionals').doc(id).set(rest);
        if(Array.isArray(reviews) && reviews.length){
          await Promise.all(reviews.map(r=>{
            const {id: _rid, ...reviewRest} = r;
            return db.collection('professionals').doc(id).collection('reviews').add(reviewRest);
          }));
        }
      }));
    }
    async function restoreCollection(collectionName, items){
      if(!items) return;
      const existing = await db.collection(collectionName).get();
      await Promise.all(existing.docs.map(d=>d.ref.delete()));
      await Promise.all(items.map(item=>{
        const id = item.id || (Date.now().toString(36)+Math.random().toString(36).slice(2,7));
        const {id: _drop, ...rest} = item;
        return db.collection(collectionName).doc(id).set(rest);
      }));
    }
    await restoreCollection('products', parsed.products);
    await restoreCollection('families', parsed.families);
    await restoreCollection('marketplace', parsed.marketplace);
    showToast('Backup restored. Reloading...');
    await logActivity('system', 'restored', `Backup from ${exportedDate}`);
    setTimeout(()=>location.reload(), 1200);
  }catch(err){
    console.error('Restore failed', err);
    showToast('Restore failed: ' + err.message);
  }
});
