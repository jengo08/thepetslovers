/* TPL: INICIO BLOQUE NUEVO [tpl-perfil.js — Perfil: owner + mascotas + reservas (tiempo real)] */
(function(){
  'use strict';

  // ---------- Helpers DOM ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const show = (el, disp='') => { if (!el) return; el.style.display = disp; el.hidden = false; };
  const hide = (el) => { if (!el) return; el.style.display = 'none'; el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const esc = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]) );

  // ---------- UDB helpers ----------
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  function udbHas(uid, key){ try { return localStorage.getItem(udbKey(uid,key)) !== null; }catch(_){ return false; } }
  function udbSet(uid, key, value){ try { localStorage.setItem(udbKey(uid,key), JSON.stringify(value)); } catch(_){ } }

  // ---------- UID robusto ----------
  let CURRENT_UID = null;
  function getCurrentUserId(){
    const explicit = localStorage.getItem('tpl.currentUser'); if (explicit) return explicit;
    const uidLS = localStorage.getItem('tpl_auth_uid'); if (uidLS) return uidLS;
    try{
      if (window.firebase && typeof firebase.auth === 'function'){
        const u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return 'default';
  }

  // ---------- Dedupe mascotas ----------
  const norm = (s)=>String(s||'').trim();
  const normKey = (v)=>String(v||'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  function dedupePets(arr){
    if (!Array.isArray(arr)) return [];
    const seen = new Set(), out=[];
    for (const p of arr){
      const key = `${normKey(p?.nombre)}|${normKey(p?.microchip)}|${normKey(p?.especie||p?.tipo||'')}`;
      if (seen.has(key)) continue; seen.add(key);
      out.push({
        nombre:norm(p?.nombre), microchip:norm(p?.microchip||p?.chip||''), especie:norm(p?.especie||p?.tipo||''),
        raza:norm(p?.raza||p?.tipoExotico||''), edad:norm(p?.edad||''), peso:norm(p?.peso||''),
        esterilizado:norm(p?.esterilizado||''), vacunas:norm(p?.vacunas||''), salud:norm(p?.salud||''),
        tratamiento:norm(p?.tratamiento||''), comportamiento:norm(p?.comportamiento||''),
        seguroVet:norm(p?.seguroVet||''), seguroVetComp:norm(p?.seguroVetComp||''), seguroVetNum:norm(p?.seguroVetNum||''),
        seguroRC:norm(p?.seguroRC||''), foto: typeof p?.foto==='string'?p.foto:''
      });
      if (out.length>=100) break;
    }
    return out;
  }

  // ---------- Migración default → UID real ----------
  function maybeMigrateFromDefault(toUid){
    if (!toUid || toUid==='default') return;
    const flagKey = `tpl.udb.migratedTo.${toUid}`;
    if (localStorage.getItem(flagKey)) return;

    const ownerDefault = udbGet('default','owner',null);
    const petsDefault  = (udbHas('default','pets') ? udbGet('default','pets',[]) : udbGet('default','mascotas',[])) || [];
    const ownerTo = udbGet(toUid,'owner',null);
    const hasPetsTo = udbHas(toUid,'pets') || udbHas(toUid,'mascotas');

    if (!ownerTo && ownerDefault) udbSet(toUid,'owner', ownerDefault);
    if (!hasPetsTo && petsDefault.length){
      const clean = dedupePets(petsDefault);
      udbSet(toUid,'pets', clean);
      if (udbHas(toUid,'mascotas')) udbSet(toUid,'mascotas', clean);
    }
    try{ localStorage.setItem(flagKey,'1'); }catch(_){}
  }

  // ---------- Owner ----------
  function setOwnerIncomplete(){
    setText('#tpl-owner-nombre','—'); setText('#tpl-owner-telefono','—'); setText('#tpl-owner-zona','—'); setText('#tpl-owner-email','—');
    const st=$('#tpl-owner-status'); if(st){ st.innerHTML='<i class="fa-solid fa-circle-exclamation"></i> Incompleto'; }
    const fill=$('#tpl-owner-fill'), edit=$('#tpl-owner-edit'); if(fill) fill.style.display=''; if(edit) edit.style.display='none';
  }
  function loadOwner(){
    const uid = CURRENT_UID || getCurrentUserId();
    const owner = udbGet(uid,'owner',null);
    if(!owner){ setOwnerIncomplete(); return; }
    setText('#tpl-owner-nombre', owner.nombre||'—');
    setText('#tpl-owner-telefono', owner.telefono||'—');
    setText('#tpl-owner-zona', owner.zona||'—');
    setText('#tpl-owner-email', owner.email||'—');
    const st=$('#tpl-owner-status'); if(st){ st.innerHTML='<i class="fa-solid fa-circle-check"></i> Completo'; }
    const fill=$('#tpl-owner-fill'), edit=$('#tpl-owner-edit'); if(fill) fill.style.display='none'; if(edit) edit.style.display='';
  }

  // ---------- Mascotas ----------
  function iconBySpecies(sp){ const v=(sp||'').toLowerCase(); if(v.includes('perro'))return'fa-dog'; if(v.includes('gato'))return'fa-cat'; if(v.includes('exó')||v.includes('exo'))return'fa-dove'; return'fa-paw'; }
  function setPetsEmpty(){
    const empty=$('#tpl-pets-empty'), list=$('#tpl-pets-list'); if(empty){ empty.style.display='flex'; empty.hidden=false; } hide(list);
    const st=$('#tpl-pets-status'); if(st) st.innerHTML='<i class="fa-solid fa-circle-exclamation"></i> Ninguna';
  }
  function renderPets(pets){
    const empty=$('#tpl-pets-empty'), list=$('#tpl-pets-list'), status=$('#tpl-pets-status');
    if(!Array.isArray(pets)||!pets.length){ setPetsEmpty(); return; }
    const cleaned = dedupePets(pets);
    if(empty){ empty.style.display='none'; empty.hidden=true; }
    show(list,'block'); list.innerHTML='';
    cleaned.forEach((p,idx)=>{
      const nombre=esc(p?.nombre||'Sin nombre'), especie=esc(p?.especie||''), raza=esc(p?.raza||p?.tipoExotico||''), edad=esc(p?.edad||''), foto=typeof p?.foto==='string'?p.foto:'';
      const item=document.createElement('div'); item.className='tpl-pet-item';
      if(foto){ const img=document.createElement('img'); img.className='tpl-pet-thumb'; img.src=foto; img.alt=`Foto de ${nombre}`; item.appendChild(img); }
      else { const ic=document.createElement('div'); ic.className='tpl-pet-icon'; ic.innerHTML=`<i class="fa-solid ${iconBySpecies(especie)}" aria-hidden="true"></i>`; item.appendChild(ic); }
      const meta=document.createElement('div'); meta.className='tpl-pet-meta';
      const nm=document.createElement('div'); nm.className='tpl-pet-name'; nm.textContent=nombre;
      const sub=document.createElement('div'); sub.className='tpl-pet-sub'; sub.textContent=[especie,raza,edad&&('Edad: '+edad)].filter(Boolean).join(' · ');
      meta.appendChild(nm); meta.appendChild(sub); item.appendChild(meta);
      const edit=document.createElement('a'); edit.href=`tpl-mascota.html?edit=${idx}`; edit.className='tpl-pet-edit'; edit.textContent='Editar'; edit.setAttribute('aria-label',`Editar a ${nombre}`); item.appendChild(edit);
      list.appendChild(item);
    });
    if(status){ const n=cleaned.length; status.innerHTML=`<i class="fa-solid fa-circle-check"></i> ${n} ${n===1?'mascota':'mascotas'}`; }

    // Persist dedupe si difiere
    const uid=CURRENT_UID||getCurrentUserId();
    const hasPets=udbHas(uid,'pets'); const stored=hasPets?(udbGet(uid,'pets',[])||[]):(udbGet(uid,'mascotas',[])||[]);
    if(JSON.stringify(stored)!==JSON.stringify(cleaned)){ udbSet(uid,'pets',cleaned); if(udbHas(uid,'mascotas')) udbSet(uid,'mascotas',cleaned); try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){ } }
  }
  function loadPetsAndRender(){
    const uid=CURRENT_UID||getCurrentUserId();
    const hasPets=udbHas(uid,'pets');
    const pets=hasPets?(udbGet(uid,'pets',[])||[]):(udbGet(uid,'mascotas',[])||[]);
    if(!Array.isArray(pets)||!pets.length){ setPetsEmpty(); }
    renderPets(pets||[]);
  }

  // ---------- Logout robusto ----------
  function setupLogout(){
    const btn=$('#tpl-logout'); if(!btn) return;
    btn.style.position='fixed'; btn.style.right='16px'; btn.style.bottom='16px'; btn.style.zIndex='999999';
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      if(window.__TPL_LOGOUT__) return window.__TPL_LOGOUT__();
      try{ sessionStorage.clear(); }catch(_){}
      try{ localStorage.removeItem('tpl.session'); localStorage.removeItem('tpl.auth'); localStorage.removeItem('tpl.currentUser'); }catch(_){}
      location.assign('index.html');
    }, {passive:false});
  }

  // ---------- Reservas (UI + tiempo real) ----------
  const fmtDateES = (iso)=>{
    if(!iso) return '—';
    const d=new Date(iso); if(Number.isNaN(+d)) return iso;
    const dd=String(d.getDate()).padStart(2,'0'), mm=String(d.getMonth()+1).padStart(2,'0'), yyyy=d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };
  const fmtTime = (hhmm)=> (hhmm && /^\d{2}:\d{2}/.test(hhmm)) ? hhmm.slice(0,5) : (hhmm||'—');
  const daysBetween = (d1,d2)=>{
    try{
      const a=new Date(d1), b=new Date(d2);
      if(Number.isNaN(+a)||Number.isNaN(+b)) return 0;
      a.setHours(0,0,0,0); b.setHours(0,0,0,0);
      return Math.max(1, Math.round((b - a)/86400000) + 1); // inclusivo
    }catch(_){ return 0; }
  };
  function estadoCalculado(row){
    const base = String(row._estado || row.estado || 'en revisión').toLowerCase();
    const today = new Date(); today.setHours(0,0,0,0);
    const s = row.Fecha_inicio || row.startDate, e = row.Fecha_fin || row.endDate;
    const sd = s? new Date(s):null, ed = e? new Date(e):null;
    if (base.includes('rech')) return 'rechazada';
    if (base.includes('acept')) {
      if (sd && ed){
        const tsd = new Date(sd); tsd.setHours(0,0,0,0);
        const ted = new Date(ed); ted.setHours(0,0,0,0);
        if (today < tsd) return 'aceptada';
        if (today >= tsd && today <= ted) return 'en curso';
        if (today > ted) return 'finalizada';
      }
      return 'aceptada';
    }
    // si viene "enviada", lo consideramos "en revisión"
    if (base.includes('envi')) return 'en revisión';
    if (base.includes('revis')) return 'en revisión';
    return base || 'en revisión';
  }
  function pillHtml(estado){
    switch(estado){
      case 'aceptada':   return '<span class="tpl-pill"><i class="fa-regular fa-circle-check"></i> Aceptada</span>';
      case 'en curso':   return '<span class="tpl-pill"><i class="fa-solid fa-play"></i> En curso</span>';
      case 'finalizada': return '<span class="tpl-pill"><i class="fa-regular fa-flag-checkered"></i> Finalizada</span>';
      case 'rechazada':  return '<span class="tpl-pill"><i class="fa-regular fa-circle-xmark"></i> Rechazada</span>';
      default:           return '<span class="tpl-pill"><i class="fa-regular fa-hourglass-half"></i> En revisión</span>';
    }
  }
  function renderBookingsUI(items){
    const pill=$('#tpl-bookings-status'), empty=$('#tpl-bookings-empty'), list=$('#tpl-bookings-list');
    if(!pill||!empty||!list) return;

    if(!items||!items.length){ pill.innerHTML='<i class="fa-regular fa-circle"></i> Sin reservas'; empty.style.display=''; list.hidden=true; list.innerHTML=''; return; }

    const data = items.slice(0, 5);
    pill.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${data.length} reserva${data.length>1?'s':''}`;
    empty.style.display='none'; list.hidden=false;

    list.innerHTML = data.map(it=>{
      const svc = esc(it.Servicio || it.service || it.serviceText || '—');
      const f1  = fmtDateES(it.Fecha_inicio || it.startDate);
      const f2  = fmtDateES(it.Fecha_fin    || it.endDate);
      const nDias = daysBetween(it.Fecha_inicio||it.startDate, it.Fecha_fin||it.endDate);
      const h1 = fmtTime(it.Hora_inicio || it.start || it.hora_inicio);
      const h2 = fmtTime(it.Hora_fin    || it.end   || it.hora_fin);
      const nm = esc((it.Mascotas_lista || it.petNames || '').replace(/\|/g, ', '));
      const sub = (it.subtotal || it.Subtotal || it['Subtotal (sin desplazamiento)'] || '').toString();
      const dep = (it.deposito || it.Deposito || it['Depósito a retener'] || '').toString();
      const dir = esc(it.Direccion || it.address || '');
      const notas = esc(it.Notas || it.notas || '');

      const estado = estadoCalculado(it);
      const badge  = pillHtml(estado);

      // Mensaje contextual
      let extraLine = '';
      if (estado==='aceptada'){
        // si empieza mañana/hoy
        const sd = it.Fecha_inicio || it.startDate;
        if (sd){
          const now = new Date(); now.setHours(0,0,0,0);
          const sD = new Date(sd); sD.setHours(0,0,0,0);
          const diff = Math.round((sD - now)/86400000);
          if (diff===0) extraLine = 'Comienza <strong>hoy</strong>.';
          else if (diff===1) extraLine = 'Comienza <strong>mañana</strong>.';
          else if (diff>1) extraLine = `Comienza en <strong>${diff} días</strong>.`;
        }
      } else if (estado==='en curso'){
        extraLine = 'Tu reserva está <strong>en curso</strong>.';
      } else if (estado==='finalizada'){
        extraLine = 'Tu reserva ha <strong>finalizado</strong>.';
      } else {
        extraLine = 'Estamos revisando tu solicitud. Te contactaremos lo antes posible.';
      }

      return `
        <div class="tpl-empty" style="border-style:solid">
          <i class="fa-regular fa-calendar"></i>
          <div style="display:flex;flex-direction:column;gap:4px">
            <strong>${svc}</strong>
            <span>${f1}${(f2 && f2!==f1)?' → '+f2:''} ${nDias?` · ${nDias} día${nDias>1?'s':''}`:''}</span>
            ${(h1||h2)?`<span>Horario: ${h1}${h2 && h2!==h1?'–'+h2:''}</span>`:''}
            ${nm?`<span style="color:#666">Mascotas: ${nm}</span>`:''}
            ${sub?`<span style="color:#666">Subtotal: ${sub} €</span>`:''}
            ${dep?`<span style="color:#666">Depósito: ${dep} €</span>`:''}
            ${dir?`<span style="color:#666">Dirección: ${dir}</span>`:''}
            ${notas?`<span style="color:#666">Notas: ${notas}</span>`:''}
            <div>${badge}</div>
            <div style="color:#58425a">${extraLine}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Fallback: última reserva guardada localmente
  function readLocalLastReservation(uid){
    try{
      const raw = localStorage.getItem(udbKey(uid,'lastReservation'));
      if(!raw) return null;
      const x = JSON.parse(raw);
      return {
        Servicio: x.Servicio || x.service,
        startDate: x.startDate || x.Fecha_inicio,
        endDate:   x.endDate   || x.Fecha_fin,
        Hora_inicio: x.Hora_inicio || x.hora_inicio,
        Hora_fin:    x.Hora_fin    || x.hora_fin,
        Mascotas_lista: x.Mascotas_lista || x.petNames || '',
        subtotal: x.subtotal, deposito: x.deposito,
        Direccion: x.Direccion || x.address || '',
        Notas: x.Notas || x.notas || '',
        _estado: x._estado || x.estado || 'en revisión',
        _createdAt: x._createdAt || Date.now()
      };
    }catch(_){ return null; }
  }

  // SDK Loader (v8) si no existe
  function lazyLoadFirebase(cb){
    if (window.firebase && firebase.app) { cb && cb(); return; }
    const urls = [
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
      'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
    ];
    let i=0; (function next(){
      if (i>=urls.length){ cb && cb(); return; }
      const s=document.createElement('script'); s.src=urls[i++]; s.async=true;
      s.onload=next; s.onerror=function(){ console.warn('[tpl-perfil] No se pudo cargar Firebase SDK'); cb && cb(); };
      document.head.appendChild(s);
    })();
  }

  // Suscripción en tiempo real
  let _unsubscribe = null;
  function unsubscribeBookings(){ if(typeof _unsubscribe==='function'){ try{ _unsubscribe(); }catch(_){ } _unsubscribe=null; } }

  function ensureFirebaseApp(){
    if (!(window.firebase && firebase.apps && firebase.apps.length)) {
      const cfg = window.TPL_FIREBASE_CONFIG || window.__TPL_FIREBASE_CONFIG || window.firebaseConfig;
      if (cfg) { try{ firebase.initializeApp(cfg); }catch(_){ /* ok si ya está */ } }
    }
  }

  async function subscribeBookings(uid){
    try{
      ensureFirebaseApp();
      if (!(window.firebase && firebase.firestore)) return [];

      const db = firebase.firestore();
      const auth = firebase.auth ? firebase.auth() : null;
      const u = auth && auth.currentUser ? auth.currentUser : null;
      const realUid = (u && u.uid) ? u.uid : uid;
      if (!realUid) { renderBookingsUI([]); return; }

      // Primero: pinta la última local (si existe)
      const localLast = readLocalLastReservation(uid);
      if (localLast) renderBookingsUI([localLast]);

      // Query y suscripción
      let q = db.collection('reservas').where('_uid','==', realUid).limit(10);
      try{ q = q.orderBy('_createdAt','desc'); }catch(_){ /* si no hay índice, seguimos sin orderBy */ }

      _unsubscribe = q.onSnapshot((snap)=>{
        const rows = snap.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
        const norm = rows.map(r=>({
          id: r.id,
          Servicio: r.Servicio || r.service,
          Fecha_inicio: r.Fecha_inicio || r.fecha_inicio,
          Fecha_fin: r.Fecha_fin || r.fecha_fin,
          Hora_inicio: r.Hora_inicio || r.hora_inicio,
          Hora_fin: r.Hora_fin || r.hora_fin,
          Mascotas_lista: r.Mascotas_lista || r.mascotas || '',
          subtotal: r.subtotal, deposito: r.deposito,
          Direccion: r.Direccion || r.direccion || '',
          Notas: r.Notas || r.notas || '',
          _estado: r._estado || r.estado || 'en revisión',
          _createdAt: r._createdAt ? (r._createdAt.toDate ? r._createdAt.toDate().getTime() : Date.parse(r._createdAt)) : 0
        }));
        norm.sort((a,b)=>(b._createdAt||0)-(a._createdAt||0));
        renderBookingsUI(norm);
      }, (err)=>{
        console.warn('[tpl-perfil] onSnapshot error', err);
      });

    }catch(err){
      console.warn('[tpl-perfil] subscribeBookings fail', err);
      renderBookingsUI([]);
    }
  }

  // ---------- Refresh orquestado ----------
  let refreshTimer=null;
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
      unsubscribeBookings();
      lazyLoadFirebase(()=>subscribeBookings(CURRENT_UID));
    }, reason==='immediate' ? 0 : 60);
  }

  // ---------- Watchers ----------
  function attachWatchers(){
    lazyLoadFirebase(()=>{
      try{
        if (!(window.firebase && firebase.auth)) return;
        firebase.auth().onAuthStateChanged(function(){ refreshAll('immediate'); });
      }catch(_){}
    });
    window.addEventListener('focus', ()=>refreshAll());
    document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) refreshAll(); });
    window.addEventListener('pageshow', (e)=>{ if (e.persisted) refreshAll('immediate'); });
    let lastAuthKey = localStorage.getItem('tpl_auth_uid') || '';
    setInterval(()=>{ const cur=localStorage.getItem('tpl_auth_uid')||''; if(cur!==lastAuthKey){ lastAuthKey=cur; refreshAll('immediate'); } }, 1200);
    window.addEventListener('storage', (ev)=>{ if(!ev) return;
      if((ev.key||'').startsWith('tpl.udb.')) refreshAll();
      if(ev.key==='tpl.udb.lastChange') refreshAll();
      if(ev.key==='tpl_auth_uid') refreshAll('immediate');
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
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();

  // API útil
  window.__TPL_PERFIL__ = Object.assign({}, window.__TPL_PERFIL__||{}, { refresh: refreshAll, getUid: ()=>CURRENT_UID });
})();
/* TPL: FIN BLOQUE NUEVO */
