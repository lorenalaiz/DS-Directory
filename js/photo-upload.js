/* ---------- Photo upload (Firebase Storage) + URL preview fallback ----------
   Shared by the Family form (single photo) and the Marketplace form (up to 5). */
import { storage } from './firebase-service.js';

const MAX_PHOTO_MB = 5;

export let pendingPhotoUploads = 0;

export function compressImage(file, maxDimension = 1000, quality = 0.8){
  return new Promise((resolve)=>{
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = ()=>{
      let { width, height } = img;
      if(width > maxDimension || height > maxDimension){
        if(width > height){
          height = Math.round(height * (maxDimension / width));
          width = maxDimension;
        }else{
          width = Math.round(width * (maxDimension / height));
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      canvas.toBlob((blob)=>{
        resolve(blob || file); // fall back to the original file if canvas export fails
      }, 'image/jpeg', quality);
    };
    img.onerror = ()=>{
      URL.revokeObjectURL(objectUrl);
      resolve(file); // fall back to the original file if it can't be read as an image
    };
    img.src = objectUrl;
  });
}

export async function uploadPhotoToStorage(file, folder, statusEl){
  if(!file) return null;
  if(!file.type.startsWith('image/')){
    statusEl.textContent = 'Please choose an image file.';
    statusEl.className = 'photo-status error';
    return null;
  }
  if(file.size > MAX_PHOTO_MB * 1024 * 1024){
    statusEl.textContent = `Photo is too large (max ${MAX_PHOTO_MB}MB).`;
    statusEl.className = 'photo-status error';
    return null;
  }
  statusEl.textContent = '⏳ Uploading photo — please wait before saving...';
  statusEl.className = 'photo-status uploading';
  pendingPhotoUploads++;
  try{
    const compressed = await compressImage(file);
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.\w+$/, '.jpg');
    const path = `${folder}/${Date.now()}-${safeName}`;
    const ref = storage.ref().child(path);
    await ref.put(compressed, { contentType: 'image/jpeg' });
    const url = await ref.getDownloadURL();
    statusEl.textContent = '✓ Photo uploaded';
    statusEl.className = 'photo-status done';
    return url;
  }catch(e){
    console.error('Photo upload failed', e);
    statusEl.textContent = 'Upload failed: ' + (e.message || 'unknown error');
    statusEl.className = 'photo-status error';
    return null;
  }finally{
    pendingPhotoUploads--;
  }
}

export function wirePhotoUpload(fileInputId, urlInputId, statusId, previewId, folder, saveBtnId){
  document.getElementById(fileInputId).addEventListener('change', async (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const statusEl = document.getElementById(statusId);
    const saveBtn = saveBtnId ? document.getElementById(saveBtnId) : null;
    const originalBtnText = saveBtn ? saveBtn.textContent : null;
    if(saveBtn){ saveBtn.disabled = true; saveBtn.textContent = 'Uploading photo...'; }
    const url = await uploadPhotoToStorage(file, folder, statusEl);
    if(url){
      const urlInput = document.getElementById(urlInputId);
      urlInput.value = url;
      urlInput.style.display = 'none';
      const preview = document.getElementById(previewId);
      preview.src = url;
      preview.style.display = 'block';
      const removeBtn = document.getElementById(previewId.replace('-preview', '-remove'));
      if(removeBtn) removeBtn.style.display = '';
    }
    if(saveBtn){ saveBtn.disabled = false; saveBtn.textContent = originalBtnText; }
  });
}

export function wirePhotoUrlPreview(urlInputId, previewId){
  const input = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);
  const removeBtn = document.getElementById(previewId.replace('-preview', '-remove'));
  input.addEventListener('input', ()=>{
    const url = input.value.trim();
    if(url){
      preview.src = url;
      preview.style.display = 'block';
      preview.onerror = ()=>{ preview.style.display = 'none'; };
      if(removeBtn) removeBtn.style.display = '';
    }else{
      preview.style.display = 'none';
      preview.src = '';
      if(removeBtn) removeBtn.style.display = 'none';
    }
  });
  input.addEventListener('blur', ()=>{
    // Hide the raw link once they're done editing it, so it isn't shown on-screen
    if(input.value.trim()) input.style.display = 'none';
  });
  if(removeBtn){
    removeBtn.addEventListener('click', ()=>{
      input.value = '';
      input.style.display = ''; // let them paste a new link after removing
      preview.style.display = 'none';
      preview.src = '';
      removeBtn.style.display = 'none';
      const fileInput = document.getElementById(urlInputId.replace('ff-photo', 'ff-photo-file').replace('mk-photo', 'mk-photo-file'));
      if(fileInput) fileInput.value = '';
      input.focus();
    });
  }
}

export function wirePhotoRemoveButton(urlInputId, previewId, fileInputId){
  const input = document.getElementById(urlInputId);
  const preview = document.getElementById(previewId);
  const removeBtn = document.getElementById(previewId.replace('-preview', '-remove'));
  if(!removeBtn) return;
  removeBtn.addEventListener('click', ()=>{
    input.value = '';
    preview.style.display = 'none';
    preview.src = '';
    removeBtn.style.display = 'none';
    document.getElementById(fileInputId).value = '';
  });
}
