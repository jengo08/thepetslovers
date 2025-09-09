/* TPL: INICIO BLOQUE NUEVO [Perfil: estado owner + mascotas + logout real persistente por usuario] */
(function(){
  'use strict';

  // ---------- Helpers DOM ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const show = (el, disp='') => { if (!el) return; el.style.display = disp; el.hidden = false; };
  const hide = (el) => { if (!el) return; el.style.display = 'none'; el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // ---------- Mini “base de datos” por usuario (localStorage) ----------
  // Guardamos por usuario en keys: tpl.udb.{uid}.owner y tpl.udb.{uid}.pets
  function getCurrentUserId(){
    // Tu login debería guardar aquí el email/ID del usuario:
    // localStorage.setItem('tpl.currentUser', 'email@dominio.com');
    return localStorage.getItem('tpl.currentUser') || 'default';
  }
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  function udbSet(uid, key, value){
    try { localStorage.setItem(udbKey(uid,key), JSON.stringify(value)); } catch(_){}
  }

  // ---------- Owner (placeholder) ----------
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
    // 1) si viene de sessionStorage (ej. tras guardar desde formulario), sincronizamos
    let ssOwner = null;
    try { ssOwner = JSON.parse(sessionStorage.getItem('tpl.owner') || 'null'); } catch(_){}
    if (ssOwner){ udbSet(uid, 'owner', ssOwner); }

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

    // Ocultar vacío con doble control robusto
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

      // Enlace Editar
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

    // 1) Si venimos del formulario, copiar desde sessionStorage -> base usuario
    let ssPets = [];
    try { ssPets = JSON.parse(sessionStorage.getItem('tpl.pets') || '[]'); } catch(_){}
    if (Array.isArray(ssPets) && ssPets.length){
      udbSet(uid, 'pets', ssPets);
      // Limpio session para evitar duplicados al volver atrás/adelante
      try { sessionStorage.removeItem('tpl.pets'); } catch(_){}
    }

    // 2) Mostrar lo del usuario
    const pets = udbGet(uid, 'pets', []);
    renderPets(pets);
  }

  // ---------- Cerrar sesión (real sin borrar perfil) ----------
  function setupLogout(){
    const btn = $('#tpl-logout');
    if (!btn) return;
    btn.addEventListener('click', (ev)=>{
      ev.preventDefault();

      // 1) Limpiar sólo la sesión actual (no borramos la base de datos de usuario)
      try{
        sessionStorage.removeItem('tpl.pets');
        sessionStorage.removeItem('tpl.owner');
        sessionStorage.clear(); // por si hay más transitorios
      }catch(_){}

      try{
        // “Cerrar sesión” para el front: quitamos el usuario actual y tokens
        localStorage.removeItem('tpl.session');      // si tu navbar lo usa
        localStorage.removeItem('tpl.auth');         // por si acaso
        localStorage.removeItem('tpl.currentUser');  // muy importante
        // Disparo un cambio para que otros scripts (nav) reaccionen
        localStorage.setItem('tpl.loggedOut', String(Date.now()));
        setTimeout(()=>localStorage.removeItem('tpl.loggedOut'), 0);
      }catch(_){}

      // 2) Redirigir a home
      location.assign('index.html');
    }, {passive:false});
  }

  // ---------- Inicio ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    setOwnerIncomplete();   // estado base
    setPetsEmpty();         // estado base
    loadOwner();            // carga owner por usuario o placeholder
    loadPetsAndRender();    // carga mascotas por usuario u oculta vacío
    setupLogout();
  });

  // Al volver desde el formulario (bfcache Safari/Chrome)
  window.addEventListener('pageshow', (e)=>{ if (e.persisted) { loadOwner(); loadPetsAndRender(); } });

  // Exponer por si acaso
  window.__TPL_PERFIL__ = Object.assign({}, window.__TPL_PERFIL__||{}, { loadPetsAndRender });
})();
 /* TPL: FIN BLOQUE NUEVO */
