/* TPL: INICIO BLOQUE NUEVO [tpl-autofill-reserva.js — Autorrelleno desde perfil + selector de mascota + hidden EmailJS] */
(function(){
  'use strict';

  // =========================
  // Helpers DOM + utilidades
  // =========================
  const qs   = (s, r=document)=>r.querySelector(s);
  const qsa  = (s, r=document)=>Array.from(r.querySelectorAll(s));
  const byId = (id)=>document.getElementById(id);
  const esc  = (s)=>String(s||'').replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const safe = (v)=> (v==null ? '' : String(v)).trim();
  const hasFirebase = !!(window.firebase && firebase.auth && firebase.firestore);
  const auth = hasFirebase ? firebase.auth() : null;
  const db   = hasFirebase ? firebase.firestore() : null;

  // =========================
  // Config overridable
  // =========================
  const COLS = Object.assign({ owners:'propietarios', pets:'mascotas' }, window.TPL_COLLECTIONS || {});
  const MAP  = Object.assign({
    'owner.nombre'    : ['firstName','owner_nombre','nombre','res-nombre'],
    'owner.apellidos' : ['lastName','owner_apellidos','apellidos','res-apellidos'],
    'owner.email'     : ['email','owner_email','correo','res-email'],
    'owner.telefono'  : ['phone','owner_telefono','telefono','tel','res-telefono'],
    'owner.direccion' : ['location','owner_direccion','direccion','address','res-direccion'],
    'owner.cp'        : ['postalCode','owner_cp','cp','postal','codigoPostal'],
    'owner.ccaa'      : ['region','owner_ccaa','ccaa'],

    'pet.id'          : ['pet_id','mascota_id','res-pet-id'],
    'pet.nombre'      : ['pet_nombre','res-mascota','nombreMascota'],
    'pet.especie'     : ['pet_especie','especie'],
    'pet.raza'        : ['pet_raza','raza'],
    'pet.edad'        : ['pet_edad','edad'],
    'pet.sexo'        : ['pet_sexo','sexo'],
    'pet.peso'        : ['pet_peso','peso'],
    'pet.chip'        : ['pet_chip','microchip'],
    'pet.salud'       : ['pet_salud','salud','medicacion','alergias']
  }, window.TPL_AUTOFILL_MAP || {});

  const REGION_MAP = {
    'comunidad de madrid':'madrid','madrid':'madrid','md':'madrid','es-md':'madrid',
    'andalucia':'andalucia','es-an':'andalucia','an':'andalucia',
    'aragon':'aragon','es-ar':'aragon',
    'asturias':'asturias','es-as':'asturias',
    'illes balears':'baleares','islas baleares':'baleares','baleares':'baleares','es-ib':'baleares',
    'canarias':'canarias','es-cn':'canarias',
    'cantabria':'cantabria','es-cb':'cantabria',
    'castilla-la mancha':'castilla-la-mancha','castilla-la-mancha':'castilla-la-mancha','es-cm':'castilla-la-mancha',
    'castilla y leon':'castilla-y-leon','castilla-y-leon':'castilla-y-leon','es-cl':'castilla-y-leon',
    'cataluna':'cataluna','cataluña':'cataluna','es-ct':'cataluna',
    'comunitat valenciana':'valenciana','valenciana':'valenciana','es-vc':'valenciana',
    'extremadura':'extremadura','es-ex':'extremadura',
    'galicia':'galicia','es-ga':'galicia',
    'la rioja':'la-rioja','es-ri':'la-rioja',
    'murcia':'murcia','region de murcia':'murcia','es-mc':'murcia',
    'navarra':'navarra','es-nc':'navarra',
    'pais vasco':'euskadi','euskadi':'euskadi','es-pv':'euskadi',
    'ceuta':'ceuta','es-ce':'ceuta',
    'melilla':'melilla','es-ml':'melilla',
    'nacional':'nacional'
  };
  const normCCAA = (x)=>{
    const s = safe(x).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'');
    return REGION_MAP[s] || '';
  };

  // =========================
  // Estado
  // =========================
  const state = { user:null, owner:null, pets:[], selectedPet:null };

  // =========================
  // DOM bindings
  // =========================
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
    if (el.dataset?.tplDirty === '1') return; // no pisar lo escrito
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'){
      if (el.type === 'checkbox'){ el.checked = !!val; }
      else { el.value = val; }
    } else if (el.tagName === 'SELECT'){
      if (el.id === 'region'){
        const low = normCCAA(val) || String(val||'').toLowerCase();
        const has = [...el.options].some(o=>o.value===low);
        if (has) el.value = low;
      } else { el.value = val; }
    } else {
      el.textContent = val;
    }
    try{ el.dispatchEvent(new Event('change', {bubbles:true})); }catch(_){}
    try{ el.dispatchEvent(new Event('input',  {bubbles:true})); }catch(_){}
  }
  function bindDirtyTracking(){
    qsa('input,select,textarea').forEach(el=>{
      el.addEventListener('input', ()=> el.dataset.tplDirty = '1');
      el.addEventListener('change', ()=> el.dataset.tplDirty = '1');
    });
  }
  function ensureHidden(name, value){
    let el = qs(`input[name="${name}"]`);
    if (!el){
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      (document.forms[0]||document.body).appendChild(el);
    }
    if (value !== undefined) el.value = value || '';
    return el;
  }

  // =========================
  // Autorrelleno Owner
  // =========================
  function fillOwner(owner){
    if (!owner) return;
    for (const [k, ids] of Object.entries(MAP)){
      if (!k.startsWith('owner.')) continue;
      const field = k.split('.')[1];
      const el = elFor(ids.concat([`owner.${field}`]));
      setValue(el, owner[field]);
    }
    // Espejo a ocultos Propietario_* si existen en el HTML
    try{
      const regSel = byId('region');
      const ccaaTxt = regSel ? (regSel.options[regSel.selectedIndex]?.text || '') : '';
      const mirror = {
        'Propietario_Nombre'   : elFor(MAP['owner.nombre']),
        'Propietario_Apellidos': elFor(MAP['owner.apellidos']),
        'Propietario_Email'    : elFor(MAP['owner.email']),
        'Propietario_Telefono' : elFor(MAP['owner.telefono']),
        'Propietario_Direccion': elFor(MAP['owner.direccion']),
        'Propietario_CP'       : elFor(MAP['owner.cp'])
      };
      Object.entries(mirror).forEach(([name, el])=>{
        const v = el ? el.value || el.textContent || '' : '';
        ensureHidden(name, v);
      });
      ensureHidden('Propietario_CCAA', ccaaTxt);
    }catch(_){}
  }

  // =========================
  // Autorrelleno Pet
  // =========================
  function fillPet(pet){
    if (!pet) return;
    state.selectedPet = pet;
    for (const [k, ids] of Object.entries(MAP)){
      if (!k.startsWith('pet.')) continue;
      const field = k.split('.')[1];
      const el = elFor(ids.concat([`pet.${field}`]));
      setValue(el, pet[field]);
    }
    // JSON ocultos para EmailJS / backoffice
    ensureHidden('tpl_owner_json', JSON.stringify(state.owner||{}));
    ensureHidden('tpl_pet_json',   JSON.stringify(pet||{}));
    // Datalist de nombres (si existe)
    try{
      const dl = byId('tplPetNamesList');
      if (dl){
        const names = [...new Set((state.pets||[]).map(p=>safe(p.nombre)).filter(Boolean))];
        dl.innerHTML = names.map(n=>`<option value="${esc(n)}"></option>`).join('');
      }
    }catch(_){}
    // Rellenar inputs de nombres de mascotas si existen
    const nameInputs = qsa('input[id^="petName_"]');
    if (nameInputs.length){
      if (nameInputs[0] && !safe(nameInputs[0].value)) nameInputs[0].value = safe(pet.nombre);
      try{ nameInputs[0].dispatchEvent(new Event('input',{bubbles:true})); }catch(_){}
    }
  }

  // =========================
  // Selector de mascotas (chips)
  // =========================
  function renderPetSelector(){
    const mount = byId('tpl-pet-selector'); // opcional
    // Datalist independiente (para inputs manuales de nombres)
    try{
      const dl = byId('tplPetNamesList');
      if (dl){
        const names = [...new Set((state.pets||[]).map(p=>safe(p.nombre)).filter(Boolean))];
        dl.innerHTML = names.map(n=>`<option value="${esc(n)}"></option>`).join('');
      }
    }catch(_){}
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

  // =========================
  // Carga de datos (Firebase + caché) y fallbacks
  // =========================
  async function fetchOwner(uid){
    try{
      // propietarios/{uid}
      let ref = db.collection(COLS.owners).doc(uid);
      let snap = await ref.get();
      if (!snap.exists){ // users/{uid}
        ref = db.collection('users').doc(uid);
        snap = await ref.get();
      }
      return snap.exists ? Object.assign({id:snap.id}, snap.data()) : null;
    }catch(_){ return null; }
  }
  async function fetchPets(uid){
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
    if (!out.length){
      try{
        const sub = await db.collection('users').doc(uid).collection('mascotas').get();
        sub.forEach(d=> out.push(Object.assign({id:d.id}, d.data())));
      }catch(_){}
    }
    return out;
  }
  function tryCache(uid){
    try{
      const owner = JSON.parse(localStorage.getItem('tpl.owner.'+uid) || 'null');
      const pets  = JSON.parse(localStorage.getItem('tpl.pets.'+uid)  || '[]');
      if (owner){ state.owner = owner; fillOwner(owner); }
      if (pets?.length){ state.pets = dedupePets(pets); renderPetSelector(); }
    }catch(_){}
  }
  function saveCache(uid){
    try{
      localStorage.setItem('tpl.owner.'+uid, JSON.stringify(state.owner||{}));
      localStorage.setItem('tpl.pets.'+uid,  JSON.stringify(state.pets||[]));
      localStorage.setItem('tpl.cacheAt', Date.now().toString());
    }catch(_){}
  }
  function dedupePets(arr){
    const seen=new Set(), out=[];
    (arr||[]).forEach(p=>{
      const key=`${safe(p?.nombre).toLowerCase()}|${safe(p?.microchip).toLowerCase()}|${safe(p?.especie||p?.tipo)}`; 
      if(seen.has(key)) return; seen.add(key); out.push(p);
    });
    return out;
  }

  // =========================
  // Fallbacks sin sesión
  // =========================
  function fillFromWindowProfile(){
    const p = window.__TPL_PROFILE__ || {};
    if (p && typeof p==='object'){
      const owner = p.propietario || p.owner || p;
      const pets  = Array.isArray(p.mascotas) ? p.mascotas : (Array.isArray(p.pets)?p.pets:[]);
      state.owner = Object.assign({}, state.owner||{}, {
        nombre: owner.nombre || owner.firstName,
        apellidos: owner.apellidos || owner.lastName,
        email: owner.email,
        telefono: owner.telefono || owner.phone,
        direccion: owner.direccion || owner.address,
        cp: owner.cp || owner.postal || owner.zip,
        ccaa: owner.ccaa || owner.ccaa_code
      });
      state.pets = dedupePets([...(state.pets||[]), ...pets]);
      fillOwner(state.owner);
      renderPetSelector();
    }
  }
  function fillFromLocalProfile(){
    try{
      const raw = localStorage.getItem('tpl.profile');
      if (!raw) return;
      const o = JSON.parse(raw);
      const owner = o.propietario || o.owner || o || {};
      const pets  = Array.isArray(o.mascotas) ? o.mascotas : (Array.isArray(o.pets)?o.pets:[]);
      state.owner = Object.assign({}, state.owner||{}, {
        nombre: owner.nombre || owner.firstName,
        apellidos: owner.apellidos || owner.lastName,
        email: owner.email,
        telefono: owner.telefono || owner.phone,
        direccion: owner.direccion || owner.address,
        cp: owner.cp || owner.postal || owner.zip,
        ccaa: owner.ccaa || owner.ccaa_code
      });
      state.pets = dedupePets([...(state.pets||[]), ...pets]);
      fillOwner(state.owner);
      renderPetSelector();
    }catch(_){}
  }

  // =========================
  // Submit: asegurar ocultos JSON
  // =========================
  function bindSubmitAugment(){
    const form = document.forms[0];
    if (!form) return;
    form.addEventListener('submit', ()=>{
      ensureHidden('tpl_owner_json', JSON.stringify(state.owner||{}));
      const sel = state.selectedPet || state.pets?.[0] || null;
      ensureHidden('tpl_pet_json', JSON.stringify(sel||{}));
      // Espejo final Propietario_*
      try{
        const mirror = {
          'Propietario_Nombre'   : elFor(MAP['owner.nombre']),
          'Propietario_Apellidos': elFor(MAP['owner.apellidos']),
          'Propietario_Email'    : elFor(MAP['owner.email']),
          'Propietario_Telefono' : elFor(MAP['owner.telefono']),
          'Propietario_Direccion': elFor(MAP['owner.direccion']),
          'Propietario_CP'       : elFor(MAP['owner.cp'])
        };
        Object.entries(mirror).forEach(([name, el])=>{
          const v = el ? (el.value || el.textContent || '') : '';
          ensureHidden(name, v);
        });
        const regSel = byId('region');
        const ccaaTxt = regSel ? (regSel.options[regSel.selectedIndex]?.text || '') : '';
        ensureHidden('Propietario_CCAA', ccaaTxt);
      }catch(_){}
    });
  }

  // =========================
  // Login CTA si no hay sesión
  // =========================
  function showLoginCTA(){
    const box = byId('tpl-login-note');
    if (box){
      box.innerHTML = 'Para autocompletar tus datos, <a href="login.html">inicia sesión</a> o <a href="registro.html">crea tu cuenta</a>.';
    }
  }

  // =========================
  // Auto-“cachorro” si procede (guardería/alojamiento)
  // =========================
  function autoPuppyIfApplicable(){
    try{
      const svc = byId('service')?.value || '';
      const species = byId('species')?.value || '';
      const allowed = (svc==='guarderia'||svc==='alojamiento') && species!=='otros' && svc!=='visitas';
      if (!allowed) return;
      const p = (state.pets||[]).find(x=>x?.birthdate);
      if (!p) return;
      const b = new Date(p.birthdate); if (isNaN(b)) return;
      const today = new Date();
      const months = (today.getFullYear()-b.getFullYear())*12 + (today.getMonth()-b.getMonth());
      const sel = byId('isPuppy'); if (sel){ sel.value = months<6?'si':'no'; sel.dispatchEvent(new Event('change',{bubbles:true})); }
    }catch(_){}
  }

  // =========================
  // Inicio
  // =========================
  bindDirtyTracking();
  bindSubmitAugment();

  // Fallbacks sin sesión (se ejecutan ya)
  fillFromWindowProfile();
  fillFromLocalProfile();

  // Autenticación Firebase (si está disponible)
  if (hasFirebase){
    auth.onAuthStateChanged(async (user)=>{
      state.user = user;
      if (!user){ showLoginCTA(); return; }
      tryCache(user.uid);
      try{
        state.owner = await fetchOwner(user.uid) || state.owner;
        state.pets  = dedupePets(await fetchPets(user.uid) || state.pets);
        saveCache(user.uid);
      }catch(_){}
      if (state.owner) fillOwner(state.owner);
      renderPetSelector();
      autoPuppyIfApplicable();
    });
  } else {
    // Si no hay Firebase cargado, al menos renderiza selector con fallbacks
    renderPetSelector();
  }

  // Exponer para depuración opcional
  window.TPL_AUTOFILL_DEBUG = {
    get state(){ return state; },
    refetch: async ()=>{ 
      if (!hasFirebase || !state.user) return;
      state.owner = await fetchOwner(state.user.uid);
      state.pets  = await fetchPets(state.user.uid);
      saveCache(state.user.uid); fillOwner(state.owner); renderPetSelector();
    }
  };
})();
 /* TPL: FIN BLOQUE NUEVO */
