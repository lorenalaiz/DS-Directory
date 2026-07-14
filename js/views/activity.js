/* ---------- Activity log (admin-only) ---------- */
import { db, storageService } from '../firebase-service.js';
import { escapeHtml, timeAgo } from '../utils.js';
import { SECTION_LABELS, ACTION_LABELS, ACTION_COLORS, buildTableWrap } from '../shared.js';

const gridAreaAct = document.getElementById('gridAreaAct');
const countRowAct = document.getElementById('countRowAct');
let activityData = [];

async function migrateLegacyActivityLog(){
  try{
    const res = await storageService.get('activity-log', true);
    const legacyEntries = res && res.value ? JSON.parse(res.value) : [];
    if(!legacyEntries.length) return;
    await Promise.all(legacyEntries.map(entry=>
      db.collection('ds-network-activity').add({
        section: entry.section,
        action: entry.action,
        name: entry.name,
        at: entry.at
      })
    ));
    await storageService.delete('activity-log', true); // only migrate once
  }catch(e){
    console.error('Legacy activity migration failed (non-fatal)', e);
  }
}

export async function loadActivityData(){
  gridAreaAct.innerHTML = `<div class="empty-state">Loading...</div>`;
  try{
    await migrateLegacyActivityLog();
    const snap = await db.collection('ds-network-activity').orderBy('at', 'desc').limit(300).get();
    activityData = snap.docs.map(d=>d.data());
  }catch(e){
    console.error('Failed to load activity', e);
    activityData = [];
  }
  renderActivity();
}

function activityRowHtml(entry){
  const label = SECTION_LABELS[entry.section] || entry.section;
  const action = ACTION_LABELS[entry.action] || entry.action;
  const color = ACTION_COLORS[entry.action] || '#7A8590';
  return `<tr>
    <td><span style="font-weight:600;color:${color};">${escapeHtml(action)}</span></td>
    <td>${escapeHtml(label)}</td>
    <td>${escapeHtml(entry.name || '(unnamed)')}</td>
    <td style="white-space:nowrap;color:var(--muted);">${entry.ip ? escapeHtml(entry.ip) : ''}</td>
    <td style="white-space:nowrap;color:var(--muted);">${timeAgo(entry.at)}</td>
  </tr>`;
}

function renderActivity(){
  const fromVal = document.getElementById('activityFromDate').value;
  const toVal = document.getElementById('activityToDate').value;
  const fromTs = fromVal ? new Date(fromVal + 'T00:00:00').getTime() : null;
  const toTs = toVal ? new Date(toVal + 'T23:59:59').getTime() : null;

  const filtered = activityData.filter(entry=>{
    if(fromTs && entry.at < fromTs) return false;
    if(toTs && entry.at > toTs) return false;
    return true;
  });

  countRowAct.textContent = activityData.length
    ? `${filtered.length} of ${activityData.length} event${activityData.length===1?'':'s'}`
    : '';

  if(!activityData.length){
    gridAreaAct.innerHTML = `<div class="empty-state"><div class="display">No activity recorded yet</div><p>Additions, edits, and deletions will show up here.</p></div>`;
    return;
  }
  if(!filtered.length){
    gridAreaAct.innerHTML = `<div class="empty-state"><div class="display">Nothing in this date range</div><p>Try clearing the date filter.</p></div>`;
    return;
  }

  gridAreaAct.innerHTML = buildTableWrap(['Action','Section','Item','IP','When'], filtered.map(activityRowHtml).join(''));
}

document.getElementById('activityFromDate').addEventListener('change', renderActivity);
document.getElementById('activityToDate').addEventListener('change', renderActivity);
document.getElementById('activityClearDateBtn').addEventListener('click', ()=>{
  document.getElementById('activityFromDate').value = '';
  document.getElementById('activityToDate').value = '';
  renderActivity();
});
