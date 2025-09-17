/* TPL: INICIO BLOQUE NUEVO [tpl-autofill-reserva.js — Autorrelleno desde perfil + selector de mascota + hidden EmailJS] */
(function(){
  'use strict';
  // ===== Helpers DOM =====
  const qs = (s, r=document)=>r.querySelector(s);
  const qsa = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const byId = (id)=>document.getElementById(id);
  const esc = (s)=>String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const hasFirebase = !!(window.firebase && firebase.auth && firebase.firestore);
  if (!hasFirebase){ console.warn('[TPL] Firebase no está cargado en esta página.'); return; }

  const auth = firebase.auth();
  const db = firebase.firestore();

  // ===== Config overridable =====
  // Por defecto trabajamos con propietarios/mascotas (puedes overridear en window.TPL_COLLECTIONS)
  const COLS = Object.assign({ owners:'propietarios', pets:'mascotas' }, window.TPL_COLLECTIONS || {});

  // Mapa de IDs/names de inputs -> campos Firestore. Puedes añadir equivalencias sin tocar HTML.
  const MAP = Object.assign({
    'owner.nombre':     ['firstName','owner_nombre','nombre','res-nombre'],
    'owner.apellidos':  ['lastName','owner_apellidos','apellidos','res-apellidos'],
    'owner.email':      ['email','owner_email','correo','res-email'],
    'owner.telefono':   ['phone','owner_telefono','telefono','tel','res-telefono'],
    'owner.direccion':  ['location','owner_direccion','direccion','address','res-direccion'],
    'owner.cp':         ['postalCode','owner_cp','cp','postal','codigoPostal'],
    'owner.ccaa':       ['region','owner_ccaa','ccaa'],

    'pet.id':           ['pet_id','mascota_id','res-pet-id'],
    'pet.nombre':       ['pet_nombre','res-mascota','nombreMascota'],
    'pet.especie':      ['pet_especie','especie'],
    'pet.raza':         ['pet_raza','raza'],
    'pet.edad':         ['pet_edad','edad'],
    'pet.sexo':         ['pet_sexo','sexo'],
    'pet.peso':         ['pet_peso','peso'],
    'pet.chip':         ['pet_chip','microchip'],
    'pet.salud':        ['pet_salud','salud','medicacion','alergias']
  }, window.TPL_AUTOFILL_MAP || {});

  const state = { user:null, owner:null, pets:[] };

  function elFor(keys){
    for (const key of keys){
      let el = byId(key); if (el) return el;
      el = qs(`[name="${key}"]`); if (el) return el;
    }
    const dataKey = keys[0];
    return qs(`[data-tpl-key="${dataKey}"]`) || null;
  }
  function setValue(el, val){
    if (!el || val == null) return;
    if (el.dataset?.tplDirty === '1') return; // no pisar lo tecleado
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
      if (el.type === 'checkbox'){ el.checked = !!val; }
      else { el.value = val; }
    } else if (el.tagName === 'SELECT'){
      // Si es la CCAA (region) y el valor es código, normaliza
      if (el.id === 'region'){
        const low = String(val||'').toLowerCase();
        const match = [...el.options].find(o=>o.value===low);
        if (match) el.value = low;
      } else {
        el.value = val;
      }
    } else { el.textContent = val; }
    el.dispatchEvent(new Event('change', {bubbles:true}));
  }
  function bindDirtyTracking(){
    qsa('input,select,textarea').forEach(el=>{
      el.addEventListener('input', ()=> el.dataset.tplDirty = '1');
      el.addEventListener('change', ()=> el.dataset.tplDirty = '1');
    });
  }
  function fillOwner(owner){
    for (const [k, ids] of Object.entries(MAP)){
      if (!k.startsWith('owner.')) continue;
      const field = k.split('.')[1];
      const el = elFor(ids.concat([`owner.${field}`]));
      setValue(el, owner[field]);
    }
  }
  function ensureHidden(name, value){
    let el = qs(`input[name="${name}"]`);
    if (!el){
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      (document.forms[0]||document.body).appendChild(el);
    }
    el.value = value || '';
  }
  function fillPet(pet){
    for (const [k, ids] of Object.entries(MAP)){
      if (!k.startsWith('pet.')) continue;
      const field = k.split('.')[1];
      const el = elFor(ids.concat([`pet.${field}`]));
      setValue(el, pet[field]);
    }
    ensureHidden('tpl_owner_json', JSON.stringify(state.owner||{}));
    ensureHidden('tpl_pet_json', JSON.stringify(pet||{}));
  }
  function renderPetSelector(){
    const mount = byId('tpl-pet-selector');
    if (!mount) return;
    mount.innerHTML = '';
    if (!state.pets.length){
      mount.innerHTML = '<div class="tpl-note">No tienes mascotas guardadas. <a href="perfil.html">Añadir mascota</a></div>';
      return;
    }
    if (state.pets.length === 1){
      const pet = state.pets[0];
      mount.innerHTML = `<div class="tpl-chip is-selected" role="button" tabindex="0">${esc(pet.nombre||'Tu mascota')}</div>`;
      fillPet(pet);
      return;
    }
    const list = document.createElement('div');
    list.className = 'tpl-chip-row';
    state.pets.forEach(p=>{
      const chip = document.createElement('button');
      chip.type='button';
      chip.className='tpl-chip';
      chip.textContent = p.nombre || 'Mascota';
      chip.addEventListener('click', ()=>{
        fillPet(p);
        qsa('.tpl-chip', list).forEach(c=>c.classList.remove('is-selected'));
        chip.classList.add('is-selected');
      });
      list.appendChild(chip);
    });
    mount.appendChild(list);
  }
  async function loadData(uid){
    // Owner: propietarios -> users (fallback)
    async function fetchOwner(){
      let ref = db.collection(COLS.owners).doc(uid);
      let snap = await ref.get();
      if (!snap.exists){ ref = db.collection('users').doc(uid); snap = await ref.get(); }
      return snap.exists ? Object.assign({id:snap.id}, snap.data()) : null;
    }
    async function fetchPets(){
      const out = [];
      try{
        const sub = await db.collection(COLS.owners).doc(uid).collection(COLS.pets).get();
        sub.forEach(d=> out.push(Object.assign({id:d.id}, d.data())));
      }catch(_){}
      if (!out.length){
        try{
          const q = await db.collection(COLS.pets).where('uid','==',uid).get();
          q.forEach(d=> out.push(Object.assign({id:d.id}, d.data())));
        }catch(_){}
      }
      // users/{uid}/mascotas fallback
      if (!out.length){
        try{
          const sub = await db.collection('users').doc(uid).collection('mascotas').get();
          sub.forEach(d=> out.push(Object.assign({id:d.id}, d.data())));
        }catch(_){}
      }
      return out;
    }
    state.owner = await fetchOwner();
    state.pets  = await fetchPets();

    // Cache ligera
    try{
      localStorage.setItem('tpl.owner.'+uid, JSON.stringify(state.owner||{}));
      localStorage.setItem('tpl.pets.'+uid, JSON.stringify(state.pets||[]));
      localStorage.setItem('tpl.cacheAt', Date.now().toString());
    }catch(_){}
  }
  function tryCache(uid){
    try{
      const owner = JSON.parse(localStorage.getItem('tpl.owner.'+uid) || 'null');
      const pets = JSON.parse(localStorage.getItem('tpl.pets.'+uid) || '[]');
      if (owner){ state.owner = owner; fillOwner(owner); }
      if (pets?.length){ state.pets = pets; renderPetSelector(); }
    }catch(_){}
  }
  function bindSubmitAugment(){
    const form = document.forms[0];
    if (!form) return;
    form.addEventListener('submit', ()=>{
      ensureHidden('tpl_owner_json', JSON.stringify(state.owner||{}));
      if (!qs('input[name="tpl_pet_json"]')){
        ensureHidden('tpl_pet_json', JSON.stringify(state.pets?.[0]||{}));
      }
    });
  }
  function showLoginCTA(){
    const box = byId('tpl-login-note');
    if (box){
      box.innerHTML = 'Para autocompletar tus datos, <a href="login.html">inicia sesión</a> o <a href="registro.html">crea tu cuenta</a>.';
    }
  }

  // ===== Init =====
  bindDirtyTracking();
  bindSubmitAugment();

  auth.onAuthStateChanged(async (user)=>{
    state.user = user;
    if (!user){ showLoginCTA(); return; }
    tryCache(user.uid);
    await loadData(user.uid);
    if (state.owner) fillOwner(state.owner);
    renderPetSelector();
  });
})();
 /* TPL: FIN BLOQUE NUEVO */
