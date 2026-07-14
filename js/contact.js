/* ---------- Contact / Suggestions ---------- */
import { db } from './firebase-service.js';
import { showToast } from './utils.js';

const overlayContact = document.getElementById('overlayContact');

document.getElementById('contactBtn').addEventListener('click', ()=>{
  document.getElementById('contact-name').value = '';
  document.getElementById('contact-email').value = '';
  document.getElementById('contact-phone').value = '';
  document.getElementById('contact-message').value = '';
  document.getElementById('contact-error').style.display = 'none';
  document.getElementById('contact-error-name').style.display = 'none';
  overlayContact.classList.add('open');
});
document.getElementById('bannerContactBtn').addEventListener('click', ()=>{
  document.getElementById('contactBtn').click();
});
document.getElementById('closeContactBtn').addEventListener('click', ()=>{
  overlayContact.classList.remove('open');
});
overlayContact.addEventListener('click', (e)=>{ if(e.target === overlayContact) overlayContact.classList.remove('open'); });

document.getElementById('submitContactBtn').addEventListener('click', async ()=>{
  const name = document.getElementById('contact-name').value.trim();
  const email = document.getElementById('contact-email').value.trim();
  const phone = document.getElementById('contact-phone').value.trim();
  const message = document.getElementById('contact-message').value.trim();

  if(!name){
    document.getElementById('contact-error-name').style.display = 'block';
    return;
  }
  document.getElementById('contact-error-name').style.display = 'none';

  if(!message){
    document.getElementById('contact-error').style.display = 'block';
    return;
  }
  document.getElementById('contact-error').style.display = 'none';

  const btn = document.getElementById('submitContactBtn');
  btn.textContent = 'Sending...';
  btn.disabled = true;
  try{
    await db.collection('ds-network-messages').add({ name, email, phone, message, at: Date.now() });
    overlayContact.classList.remove('open');
    showToast('Thanks — your message has been sent!');
  }catch(e){
    console.error('Failed to send message', e);
    showToast('Something went wrong sending your message. Please try again.');
  }
  btn.textContent = 'Send';
  btn.disabled = false;
});
