/* ---------- Messages tab (admin-only, populated via the Contact form) ---------- */
import { db } from '../firebase-service.js';
import { escapeHtml, timeAgo } from '../utils.js';
import { RENDER_FN_BY_SECTION, VIEW_MODES, buildTableWrap } from '../shared.js';

const gridAreaMsg = document.getElementById('gridAreaMsg');
const countRowMsg = document.getElementById('countRowMsg');
let messagesData = [];

export async function loadMessagesData(){
  gridAreaMsg.innerHTML = `<div class="empty-state">Loading...</div>`;
  try{
    const snap = await db.collection('ds-network-messages').orderBy('at', 'desc').limit(300).get();
    messagesData = snap.docs.map(d=>d.data());
  }catch(e){
    console.error('Failed to load messages', e);
    messagesData = [];
  }
  renderMessages();
}

function messageCardHtml(msg){
  const contactBits = [msg.email, msg.phone].filter(Boolean).map(escapeHtml).join(' · ');
  return `
  <div class="card">
    <div class="body">
      <h3>${escapeHtml(msg.name)}</h3>
      ${contactBits ? `<div style="font-size:12px;color:var(--primary-dark);margin-bottom:6px;">${contactBits}</div>` : ''}
      <div class="notes" style="border-top:none;padding-top:0;">${escapeHtml(msg.message)}</div>
      <div style="font-size:11.5px;color:var(--muted);margin-top:10px;">${timeAgo(msg.at)}</div>
    </div>
  </div>`;
}

function messageRowHtml(msg){
  return `<tr>
    <td><b>${escapeHtml(msg.name)}</b></td>
    <td style="white-space:nowrap;">${msg.phone ? escapeHtml(msg.phone) : ''}</td>
    <td style="white-space:nowrap;">${msg.email ? escapeHtml(msg.email) : ''}</td>
    <td style="max-width:380px;">${escapeHtml(msg.message)}</td>
    <td style="white-space:nowrap;color:var(--muted);">${timeAgo(msg.at)}</td>
  </tr>`;
}

export function renderMessages(){
  const lastSeen = Number(localStorage.getItem('ds-messages-last-seen') || 0);
  const unreadCount = messagesData.filter(m=>m.at > lastSeen).length;
  const msgBadge = document.getElementById('badgeMessages');
  msgBadge.textContent = unreadCount;
  msgBadge.style.display = unreadCount > 0 ? '' : 'none';
  document.getElementById('tabMessages').classList.toggle('has-alert', unreadCount > 0);

  countRowMsg.textContent = messagesData.length
    ? `${messagesData.length} message${messagesData.length===1?'':'s'}`
    : '';

  if(!messagesData.length){
    gridAreaMsg.innerHTML = `<div class="empty-state"><div class="display">No messages yet</div><p>Suggestions sent via "Contact" will show up here.</p></div>`;
    return;
  }

  if(VIEW_MODES['messages'] === 'table'){
    gridAreaMsg.innerHTML = buildTableWrap(['Name','Phone','Email','Message','When'], messagesData.map(messageRowHtml).join(''));
  }else{
    gridAreaMsg.innerHTML = `<div class="grid">${messagesData.map(messageCardHtml).join('')}</div>`;
  }
}

RENDER_FN_BY_SECTION.messages = renderMessages;
