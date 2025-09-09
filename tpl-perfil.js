/* TPL: INICIO BLOQUE NUEVO [Perfil: owner + mascotas (udb) + logout robusto — FIX UID + compat 'mascotas'] */
(function(){
  'use strict';

  // ---------- Helpers DOM ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const show = (el, disp='') => { if (!el) return; el.style.display = disp; el.hidden = false; };
  const hide = (el) => { if (!el) return; el.style.display = 'none'; el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // ---------- Base por usuario (UID robusto) ----------
  function getCurrentUserId(){
    // 1) tu comportamiento previo si estaba seteado manualmente
    var explicit = localStorage.getItem('tpl.currentUser');
    if (explicit) return explicit;
    // 2) UID que deja navbar/auth al iniciar sesión
    var uidLS = localStorage.getItem('tpl_auth_uid');
    if (uidLS) return uidLS;
    // 3) UID de Firebase si está disponible
    try{
      if (window.firebase && typeof firebase.auth === 'function'){
        var u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    // 4) fallback
    return 'default';
  }

  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  function udbHas(uid, key){
    try { return localStorage.getItem(udbKey(uid,key)) !== null; }catch(_){ return false; }
  }

  // ---------- Owner (placeholder/cargado) ----------
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
    const uid = getCurrentUserId();
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

    if (empty){ empty.style.display = 'none'; empty.hidden = true; }
    show(list, 'block');
    list.innerHTML = '';

    pets.forEach((p, idx) => {
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
      const n = pets.length;
      status.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${n} ${n===1?'mascota':'mascotas'}`;
    }
  }

  function loadPetsAndRender(){
    const uid = getCurrentUserId();
    // Compat: si no existe 'pets', lee 'mascotas'
    const hasPets = udbHas(uid, 'pets');
    const pets = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
    renderPets(pets);
  }

  // ---------- Logout robusto (sin cambios) ----------
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

/* TPL: INICIO BLOQUE NUEVO [Reservas: helpers + render + Firestore opcional] */
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

    // Si la sección no existe en este HTML, salimos sin romper nada
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

  // Snapshot local opcional (lo escribiremos desde reserva.js)
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

  // Carga perezosa Firebase v8 (compat namespaced) si no está presente
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
      // Asegurar app init si no lo está
      if (!firebase.apps || !firebase.apps.length){
        const cfg = window.TPL_FIREBASE_CONFIG || window.firebaseConfig || window.__TPL_FIREBASE_CONFIG;
        if (cfg) { try{ firebase.initializeApp(cfg); }catch(_){ /* noop */ } }
      }
      const db = firebase.firestore();

      // Si hay usuario logueado, usar su uid real
      const auth = firebase.auth ? firebase.auth() : null;
      const u = auth && auth.currentUser ? auth.currentUser : null;
      const realUid = (u && u.uid) ? u.uid : uid;
      if (!realUid) return [];

      let snap;
      try{
        snap = await db.collection('reservas')
          .where('_uid','==', realUid)
          .orderBy('_createdAt','desc')
          .limit(10)
          .get();
      }catch(_){
        snap = await db.collection('reservas')
          .where('_uid','==', realUid)
          .limit(10)
          .get();
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
    const uid = getCurrentUserId();

    // 1) Pintar algo inmediato si existe snapshot local
    const localLast = readLocalLastReservation(uid);
    if (localLast) renderBookingsUI([localLast]); else renderBookingsUI([]);

    // 2) Intentar Firebase (si se puede)
    lazyLoadFirebase(async ()=>{
      try{
        if (!(window.firebase && firebase.auth)) return;
        const auth = firebase.auth();
        // Si ya hay usuario autenticado, vamos directo; si no, esperamos a onAuthStateChanged
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

  // ---------- Inicio ----------
  function start(){
    setOwnerIncomplete();
    setPetsEmpty();
    loadOwner();
    loadPetsAndRender();
    setupLogout();

    /* TPL: INICIO BLOQUE NUEVO [Hook: cargar reservas] */
    loadBookings();
    /* TPL: FIN BLOQUE NUEVO */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Reforzar al volver de atrás/adelante (bfcache)
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted){
      loadOwner();
      loadPetsAndRender();
      /* TPL: INICIO BLOQUE NUEVO [Re-pintar reservas en bfcache] */
      loadBookings();
      /* TPL: FIN BLOQUE NUEVO */
      const list = document.getElementById('tpl-pets-list');
      const empty = document.getElementById('tpl-pets-empty');
      if (list && list.children.length > 0 && empty){
        empty.style.display = 'none'; empty.hidden = true;
      }
    }
  });

  // Si otros módulos avisan de cambios, refrescamos
  window.addEventListener('storage', function(ev){
    if (!ev) return;
    if (ev.key && ev.key.indexOf('tpl.udb.') === 0) {
      loadOwner(); loadPetsAndRender();
      /* TPL: INICIO BLOQUE NUEVO [Escucha cambios que afecten reservas] */
      if (ev.key.includes('.lastReservation') || ev.key === 'tpl.udb.lastChange'){ loadBookings(); }
      /* TPL: FIN BLOQUE NUEVO */
    }
    if (ev.key === 'tpl.udb.lastChange'){
      loadOwner(); loadPetsAndRender();
    }
  });

  // Exponer (si se usa en otros lados)
  window.__TPL_PERFIL__ = Object.assign({}, window.__TPL_PERFIL__||{}, { loadPetsAndRender, refreshBookings: loadBookings });
})();
 /* TPL: FIN BLOQUE NUEVO */
