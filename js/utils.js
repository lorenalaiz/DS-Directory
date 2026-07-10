export function showToast(msg){
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'), 2200);
}

export function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

export function formatPhone(raw){
  if(!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if(digits.length === 10 && /^0[45]/.test(digits)){
    // Australian mobile: 04XX XXX XXX / 05XX XXX XXX
    return `${digits.slice(0,4)} ${digits.slice(4,7)} ${digits.slice(7)}`;
  }
  if(digits.length === 10 && digits[0] === '0'){
    // Australian landline: (0X) XXXX XXXX
    return `(${digits.slice(0,2)}) ${digits.slice(2,6)} ${digits.slice(6)}`;
  }
  return raw; // unrecognised format — show exactly what was entered
}

export function displayHostname(url){
  try{
    const withProtocol = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    const host = new URL(withProtocol).hostname.replace(/^www\./i, '');
    return host;
  }catch(e){
    return url.replace(/^https?:\/\//i,'').split('/')[0];
  }
}

export function instagramUrl(value){
  const v = value.trim();
  if(/^https?:\/\//i.test(v)) return v;
  return 'https://instagram.com/' + v.replace(/^@/, '');
}

export function facebookUrl(value){
  const v = value.trim();
  if(/^https?:\/\//i.test(v)) return v;
  return 'https://facebook.com/' + v.replace(/^@/, '');
}