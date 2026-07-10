export function showToast(msg){
  const toast = document.getElementById('toast');

  if(!toast){
    console.warn('Toast element was not found.');
    return;
  }

  toast.textContent = msg;
  toast.classList.add('show');

  setTimeout(()=>{
    toast.classList.remove('show');
  }, 2200);
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

export function timeAgo(ts){
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if(seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if(minutes < 60) return minutes + (minutes===1 ? ' minute ago' : ' minutes ago');
  const hours = Math.floor(minutes / 60);
  if(hours < 24) return hours + (hours===1 ? ' hour ago' : ' hours ago');
  const days = Math.floor(hours / 24);
  if(days < 30) return days + (days===1 ? ' day ago' : ' days ago');
  return new Date(ts).toLocaleDateString();
}