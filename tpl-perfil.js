/* TPL: INICIO BLOQUE NUEVO [tpl-perfil.js — Perfil estable por UID: owner+mascotas+reservas con watcher, migración y dedupe] */
(function(){
  'use strict';

  // ---------- Helpers DOM ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const show = (el, disp='') => { if (!el) return; el.style.display = disp; el.hidden = false; };
  const hide = (el) => { if (!el) return; el.style.display = 'none'; el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // ---------- UDB helpers ----------
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  function udbHas(uid, key){
    try { return localStorage.getItem(udbKey(uid,key)) !== null; }catch(_){ return false; }
  }
  function udbSet(uid, key, value){
    try { localStorage.setItem(udbKey(uid,key), JSON.stringify(value)); } catch(_){}
  }

  // ---------- UID robusto + watcher ----------
  let CURRENT_UID = null;
  function getCurrentUserId(){
    const explicit = localStorage.getItem('tpl.currentUser');
    if (explicit) return explicit;
    const uidLS = localStorage.getItem('tpl_auth_uid');
    if (uidLS) return uidLS;
    try{
      if (window.firebase && typeof firebase.auth === 'function'){
        const u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return 'default';
  }

  // ---------- Dedupe / saneo de mascotas ----------
  function normalize(s){ return String(s||'').trim(); }
  function normKey(v){ return String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
  function dedupePets(arr){
    if (!Array.isArray(arr)) return [];
    const seen = new Set();
    const out = [];
    for (const p of arr){
      const nombre = normKey(p?.nombre);
      const chip   = normKey(p?.microchip);
      const esp    = normKey(p?.especie || p?.tipo || '');
      const key = `${nombre}|${chip}|${esp}`;
      if (seen.has(key)) continue;
      seen.add(key);
      // Saneo mínimo
      out.push({
        nombre: normalize(p?.nombre),
        microchip: normalize(p?.microchip || p?.chip || ''),
        especie: normalize(p?.especie || p?.tipo || ''),
        raza: normalize(p?.raza || p?.tipoExotico || ''),
        edad: normalize(p?.edad || ''),
        peso: normalize(p?.peso || ''),
        esterilizado: normalize(p?.esterilizado || ''),
        vacunas: normalize(p?.vacunas || ''),
        salud: normalize(p?.salud || ''),
        tratamiento: normalize(p?.tratamiento || ''),
        comidas: normalize(p?.comidas || ''),
        salidas: normalize(p?.salidas || ''),
        tamano: normalize(p?.tamano || ''),
        clinica: normalize(p?.clinica || ''),
        hospitalPref: normalize(p?.hospitalPref || ''),
        comportamiento: normalize(p?.comportamiento || ''),
        camaras: normalize(p?.camaras || ''),
        fotos: normalize(p?.fotos || ''),
        seguroVet: normalize(p?.seguroVet || ''),
        seguroVetComp: normalize(p?.seguroVetComp || ''),
        seguroVetNum: normalize(p?.seguroVetNum || ''),
        seguroRC: normalize(p?.seguroRC || ''),
        foto: typeof p?.foto === 'string' ? p.foto : ''
      });
      if (out.length >= 100) break; // safety hard-limit
    }
    return out;
  }

  // ---------- Migración suave default → UID real (una sola vez) ----------
  function maybeMigrateFromDefault(toUid){
    if (!toUid || toUid === 'default') return;
    const flagKey = `tpl.udb.migratedTo.${toUid}`;
    if (localStorage.getItem(flagKey)) return;

    const ownerDefault = udbGet('default','owner',null);
    const petsDefault  = (udbHas('default','pets') ? udbGet('default','pets',[]) : udbGet('default','mascotas',[])) || [];

    const ownerTo = udbGet(toUid,'owner',null);
    const hasPetsTo = udbHas(toUid,'pets') || udbHas(toUid,'mascotas');

    if (!ownerTo && ownerDefault){ udbSet(toUid,'owner', ownerDefault); }
    if (!hasPetsTo && Array.isArray(petsDefault) && petsDefault.length){
      const clean = dedupePets(petsDefault);
      udbSet(toUid,'pets', clean);
      if (udbHas(toUid,'mascotas')) udbSet(toUid,'mascotas', clean);
    }

    try{ localStorage.setItem(flagKey, '1'); }catch(_){}
  }

  // ---------- Owner ----------
  function setOwnerIncomplete(){
    setText('#tpl-owner-nombre', '—');
    setText('#tpl-owner-telefono', '—');
    setText('#tpl-owner-zona', '—');
    setText('#tpl-owner-email', '—');
    const status = $('#tpl-owner-status');
    if (status){ status.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Incompleto'; }
    const fill = $('#tpl-owner-fill'); const edit = $('#tpl-owner-edit');
    if (fill) fill.style.display = '';
    if (edit) edit.style.display = 'none';
  }

  function loadOwner(){
    const uid = CURRENT_UID || getCurrentUserId();
    const owner = udbGet(uid, 'owner', null);
    if (!owner){ setOwnerIncomplete(); return; }

    setText('#tpl-owner-nombre', owner.nombre || '—');
    setText('#tpl-owner-telefono', owner.telefono || '—');
    setText('#tpl-owner-zona', owner.zona || '—');
    setText('#tpl-owner-email', owner.email || '—');

    const status = $('#tpl-owner-status');
    if (status){ status.innerHTML = '<i class="fa-solid fa-circle-check"></i> Completo'; }
    const fill = $('#tpl-owner-fill'); const edit = $('#tpl-owner-edit');
    if (fill) fill.style.display = 'none';
    if (edit) edit.style.display = '';
  }

  // ---------- Mascotas ----------
  function iconBySpecies(sp){
    const v = (sp||'').toLowerCase();
    if (v.includes('perro')) return 'fa-dog';
    if (v.includes('gato'))  return 'fa-cat';
    if (v.includes('exó') || v.includes('exo')) return 'fa-dove';
    return 'fa-paw';
  }

  function setPetsEmpty(){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    if (empty){ empty.style.display = 'flex'; empty.hidden = false; }
    hide(list);
    const st = $('#tpl-pets-status');
    if (st) st.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Ninguna';
  }

  function renderPets(pets){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    const status = $('#tpl-pets-status');

    if (!Array.isArray(pets) || pets.length===0){ setPetsEmpty(); return; }

    const cleaned = dedupePets(pets);
    if (empty){ empty.style.display = 'none'; empty.hidden = true; }
    show(list, 'block');
    list.innerHTML = '';

    cleaned.forEach((p, idx) => {
      const nombre  = escapeHtml(p?.nombre || 'Sin nombre');
      const especie = escapeHtml(p?.especie || '');
      const raza    = escapeHtml(p?.raza || p?.tipoExotico || '');
      const edad    = escapeHtml(p?.edad || '');
      const foto    = (p && typeof p.foto === 'string') ? p.foto : '';

      const item = document.createElement('div');
      item.className = 'tpl-pet-item';

      if (foto){
        const img = document.createElement('img');
        img.className = 'tpl-pet-thumb';
        img.src = foto;
        img.alt = `Foto de ${nombre}`;
        item.appendChild(img);
      } else {
        const ic = document.createElement('div');
        ic.className = 'tpl-pet-icon';
        ic.innerHTML = `<i class="fa-solid ${iconBySpecies(especie)}" aria-hidden="true"></i>`;
        item.appendChild(ic);
      }

      const meta = document.createElement('div');
      meta.className = 'tpl-pet-meta';
      const nm = document.createElement('div');
      nm.className = 'tpl-pet-name';
      nm.textContent = nombre;
      const sub = document.createElement('div');
      sub.className = 'tpl-pet-sub';
      const parts = [especie, raza, edad && ('Edad: ' + edad)].filter(Boolean);
      sub.textContent = parts.join(' · ');
      meta.appendChild(nm); meta.appendChild(sub);
      item.appendChild(meta);

      const edit = document.createElement('a');
      edit.href = `tpl-mascota.html?edit=${idx}`;
      edit.className = 'tpl-pet-edit';
      edit.textContent = 'Editar';
      edit.setAttribute('aria-label', `Editar a ${nombre}`);
      item.appendChild(edit);

      list.appendChild(item);
    });

    if (status){
      const n = cleaned.length;
      status.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${n} ${n===1?'mascota':'mascotas'}`;
    }

    // Persistimos el dedupe si había diferencias
    const uid = CURRENT_UID || getCurrentUserId();
    const hasPets = udbHas(uid, 'pets');
    const stored = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
    if (JSON.stringify(stored) !== JSON.stringify(cleaned)){
      udbSet(uid,'pets', cleaned);
      if (udbHas(uid,'mascotas')) udbSet(uid,'mascotas', cleaned);
      try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}
    }
  }

  function loadPetsAndRender(){
    const uid = CURRENT_UID || getCurrentUserId();
    const hasPets = udbHas(uid, 'pets');
    const pets = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
    if (!Array.isArray(pets) || !pets.length){ setPetsEmpty(); }
    renderPets(pets || []);
  }

  // ---------- Logout robusto (igual que tenías) ----------
  function setupLogout(){
    const btn = $('#tpl-logout');
    if (!btn) return;
    btn.style.position = 'fixed';
    btn.style.right = '16px';
    btn.style.bottom = '16px';
    btn.style.zIndex = '999999';

    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      if (window.__TPL_LOGOUT__) return window.__TPL_LOGOUT__();
      try{ sessionStorage.clear(); }catch(_){}
      try{
        localStorage.removeItem('tpl.session');
        localStorage.removeItem('tpl.auth');
        localStorage.removeItem('tpl.currentUser');
      }catch(_){}
      location.assign('index.html');
    }, {passive:false});
  }

  /* TPL: INICIO BLOQUE NUEVO [Reservas: UI + Firestore opcional + snapshot local] */
  function formatDateES(iso){
    if (!iso) return '—';
    try{
      const d = new Date(iso);
      if (isNaN(d)) return iso;
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }catch(_){ return iso; }
  }
  function renderBookingsUI(items){
    const pill  = $('#tpl-bookings-status');
    const empty = $('#tpl-bookings-empty');
    const list  = $('#tpl-bookings-list');
    if (!pill || !empty || !list) return;

    if (!items || !items.length){
      pill.innerHTML = '<i class="fa-regular fa-circle"></i> Sin reservas';
      empty.style.display = '';
      list.hidden = true;
      list.innerHTML = '';
      return;
    }
    const data = items.slice(0,3);
    pill.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${data.length} reserva${data.length>1?'s':''}`;
    empty.style.display = 'none';
    list.hidden = false;

    list.innerHTML = data.map(it=>{
      const estado = String(it.estado || it._estado || 'enviada').toLowerCase();
      const badge = estado === 'aceptada'  ? '<span class="tpl-pill"><i class="fa-regular fa-circle-check"></i> Aceptada</span>'
                  : estado.includes('revis') ? '<span class="tpl-pill"><i class="fa-regular fa-hourglass-half"></i> En revisión</span>'
                  : estado.includes('rech')  ? '<span class="tpl-pill"><i class="fa-regular fa-circle-xmark"></i> Rechazada</span>'
                  : '<span class="tpl-pill"><i class="fa-regular fa-paper-plane"></i> Enviada</span>';

      const svc = escapeHtml(it.serviceText || it.service || it.Servicio || '—');
      const f1  = formatDateES(it.startDate || it.Fecha_inicio);
      const f2  = formatDateES(it.endDate   || it.Fecha_fin);
      const nm  = escapeHtml((it.petNames||it.Mascotas_lista||'').replace(/\|/g, ', '));

      return `
        <div class="tpl-empty" style="border-style:solid">
          <i class="fa-regular fa-calendar"></i>
          <div style="display:flex;flex-direction:column;gap:4px">
            <strong>${svc}</strong>
            <span>${f1}${f2 && f2!==f1 ? ' → '+f2 : ''}</span>
            ${nm ? `<span style="color:#666">Mascotas: ${nm}</span>` : ''}
            <div>${badge}</div>
          </div>
        </div>
      `;
    }).join('');
  }
  function readLocalLastReservation(uid){
    try{
      const raw = localStorage.getItem(udbKey(uid,'lastReservation'));
      if (!raw) return null;
      const x = JSON.parse(raw);
      return {
        service: x.service || x.Servicio,
        serviceText: x.service || x.Servicio,
        startDate: x.startDate || x.Fecha_inicio,
        endDate: x.endDate || x.Fecha_fin,
        estado: x.estado || x._estado || 'enviada',
        petNames: x.petNames || x.Mascotas_lista || ''
      };
    }catch(_){ return null; }
  }
  function lazyLoadFirebase(cb){
    if (window.firebase && firebase.app) { cb && cb(); return; }
    const urls = [
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
    ];
    let i=0;
    (function next(){
      if (i>=urls.length){ cb && cb(); return; }
      const s=document.createElement('script');
      s.src=urls[i++]; s.async=true; s.onload=next; s.onerror=function(){ console.warn('[tpl-perfil] No se pudo cargar Firebase SDK'); cb && cb(); };
      document.head.appendChild(s);
    })();
  }
  async function fetchBookingsFromFirestore(uid){
    try{
      if (!(window.firebase && firebase.firestore)) return [];
      if (!firebase.apps || !firebase.apps.length){
        const cfg = window.TPL_FIREBASE_CONFIG || window.firebaseConfig || window.__TPL_FIREBASE_CONFIG;
        if (cfg) { try{ firebase.initializeApp(cfg); }catch(_){ /* noop */ } }
      }
      const db = firebase.firestore();
      const auth = firebase.auth ? firebase.auth() : null;
      const u = auth && auth.currentUser ? auth.currentUser : null;
      const realUid = (u && u.uid) ? u.uid : uid;
      if (!realUid) return [];

      let snap;
      try{
        snap = await db.collection('reservas')
          .where('_uid','==', realUid)
          .orderBy('_createdAt','desc')
          .limit(10).get();
      }catch(_){
        snap = await db.collection('reservas')
          .where('_uid','==', realUid)
          .limit(10).get();
      }
      const rows = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
      const norm = rows.map(r => ({
        id: r.id,
        service: r.Servicio,
        serviceText: r.Servicio,
        startDate: r.Fecha_inicio,
        endDate: r.Fecha_fin,
        estado: r._estado || r.estado || 'enviada',
        petNames: r.Mascotas_lista || '',
        createdAt: r._createdAt ? (r._createdAt.toDate ? r._createdAt.toDate().getTime() : Date.parse(r._createdAt)) : 0
      }));
      norm.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
      return norm;
    }catch(_){ return []; }
  }
  async function loadBookings(){
    const uid = CURRENT_UID || getCurrentUserId();
    const localLast = readLocalLastReservation(uid);
    if (localLast) renderBookingsUI([localLast]); else renderBookingsUI([]);
    lazyLoadFirebase(async ()=>{
      try{
        if (!(window.firebase && firebase.auth)) return;
        const auth = firebase.auth();
        const doFetch = async ()=>{
          const list = await fetchBookingsFromFirestore(uid);
          if (list && list.length) renderBookingsUI(list);
        };
        if (auth.currentUser){ doFetch(); }
        auth.onAuthStateChanged(u=>{ if (u) doFetch(); });
      }catch(_){}
    });
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ---------- Refresh orquestado ----------
  let refreshTimer = null;
  function refreshAll(reason){
    if (refreshTimer) clearTimeout(refreshTimer);
    refreshTimer = setTimeout(()=>{
      const newUid = getCurrentUserId();
      if (CURRENT_UID !== newUid){
        maybeMigrateFromDefault(newUid);
        CURRENT_UID = newUid;
      }
      setOwnerIncomplete();
      setPetsEmpty();
      loadOwner();
      loadPetsAndRender();
      if (typeof renderBookingsUI === 'function') loadBookings();
    }, reason === 'immediate' ? 0 : 60);
  }

  // ---------- Watchers: auth, focus, visibility, local key polling ----------
  function attachWatchers(){
    // Firebase auth watcher
    lazyLoadFirebase(()=>{
      try{
        if (!(window.firebase && firebase.auth)) return;
        firebase.auth().onAuthStateChanged(function(){ refreshAll('immediate'); });
      }catch(_){}
    });

    // Cambios de foco/visibilidad → revalida UID y repinta
    window.addEventListener('focus', ()=>refreshAll());
    document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) refreshAll(); });

    // Bfcache back/forward
    window.addEventListener('pageshow', (e)=>{ if (e.persisted) refreshAll('immediate'); });

    // Polling ligero del key de auth para detectar cambios en la MISMA pestaña
    let lastAuthKey = localStorage.getItem('tpl_auth_uid') || '';
    setInterval(()=>{
      const cur = localStorage.getItem('tpl_auth_uid') || '';
      if (cur !== lastAuthKey){ lastAuthKey = cur; refreshAll('immediate'); }
    }, 1200);

    // storage (otras pestañas)
    window.addEventListener('storage', function(ev){
      if (!ev) return;
      if ((ev.key||'').startsWith('tpl.udb.')) refreshAll();
      if (ev.key === 'tpl.udb.lastChange') refreshAll();
      if (ev.key === 'tpl_auth_uid') refreshAll('immediate');
    });
  }

  // ---------- Inicio ----------
  function start(){
    CURRENT_UID = getCurrentUserId();
    maybeMigrateFromDefault(CURRENT_UID);
    setupLogout();
    refreshAll('immediate');
    attachWatchers();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // Exponer API útil
  window.__TPL_PERFIL__ = Object.assign({}, window.__TPL_PERFIL__||{}, {
    refresh: refreshAll,
    getUid: ()=>CURRENT_UID
  });
})();
 /* TPL: FIN BLOQUE NUEVO */
