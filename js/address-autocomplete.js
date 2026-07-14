/* ---------- Shared piece of the Google Places autocomplete flows ----------
   Professionals (f-endereco, full address) and Families (ff-suburb, suburb-only)
   both need a Places API session token — that's the only genuinely shared logic;
   the rest of each flow (fields fetched, result filtering) is different enough
   per-form that it stays in views/professionals.js and views/families.js. */
export function newSessionToken(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c=>{
    const r = Math.random()*16|0, v = c==='x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
