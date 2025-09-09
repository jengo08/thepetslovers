/* TPL: INICIO BLOQUE NUEVO [Perfil: owner + mascotas (udb) + logout robusto + migración] */
(function(){
  'use strict';

  // ---------- Helpers DOM ----------
  const $ = (sel, root=document) => root.querySelector(sel);
  const show = (el, disp='') => { if (!el) return; el.style.display = disp; el.hidden = false; };
  const hide = (el) => { if (!el) return; el.style.display = 'none'; el.hidden = true; };
  const setText = (sel, txt) => { const el = $(sel); if (el) el.textContent = txt; };
  const escapeHtml = (s) => String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

  // ---------- Base por usuario ----------
  /* TPL: INICIO BLOQUE NUEVO [UID fallback a Firebase] */
  function getFirebaseUid(){
    try{
      if (window.firebase && firebase.auth){
        var u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return null;
  }
  /* TPL: FIN BLOQUE NUEVO */

  function getCurrentUserId(){
    const explicit = localStorage.getItem('tpl.currentUser');
    if (explicit) return explicit;
    /* TPL: INICIO BLOQUE NUEVO [Fallback UID Firebase si existe] */
    const fuid = getFirebaseUid();
    if (fuid) return fuid;
    /* TPL: FIN BLOQUE NUEVO */
    return 'default';
  }
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  /* TPL: INICIO BLOQUE NUEVO [udb set/any helpers] */
  function udbSet(uid, key, val){
    try{ localStorage.setItem(udbKey(uid,key), JSON.stringify(val)); }catch(_){}
  }
  function udbGetAny(uid, keys, fallback){
    for (var i=0;i<keys.length;i++){
      var v = udbGet(uid, keys[i], undefined);
      if (v !== undefined && v !== null) return v;
    }
    return fallback;
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Migración default → UID + alias "mascotas"] */
  function migrateUdbToCurrentUid(){
    const uid = getCurrentUserId();
    if (uid === 'default') return;

    // 1) Alias "mascotas" -> "pets" si procede
    const aliasPets = udbGet(uid, 'mascotas', null);
    const petsNow   = udbGet(uid, 'pets', null);
    if (Array.isArray(aliasPets) && !Array.isArray(petsNow)){
      udbSet(uid, 'pets', aliasPets);
    }

    // 2) Si no hay pets para este UID, intentar traer de default (pets o mascotas)
    const petsAfterAlias = udbGet(uid, 'pets', null);
    if (!Array.isArray(petsAfterAlias) || petsAfterAlias.length === 0){
      const defaultPets = udbGetAny('default', ['pets','mascotas'], []);
      if (Array.isArray(defaultPets) && defaultPets.length){
        udbSet(uid, 'pets', defaultPets);
      }
    }

    // 3) Owner: si falta en este UID, copiar de default
    const ownerNow = udbGet(uid, 'owner', null);
    if (!ownerNow){
      const defaultOwner = udbGet('default', 'owner', null);
      if (defaultOwner){ udbSet(uid, 'owner', defaultOwner); }
    }
  }
  /* TPL: FIN BLOQUE NUEVO */

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

    // Ocultar vacío con doble control
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
    // Acepta alias antiguo "mascotas" y migra silenciosamente
    let pets = udbGetAny(uid, ['pets','mascotas'], []);
    if (!Array.isArray(pets)) pets = [];
    renderPets(pets);
  }

  // ---------- Logout robusto ----------
  function setupLogout(){
    const btn = $('#tpl-logout');
    if (!btn) return;

    // Seguridad extra: reforzar estilos por si alguna hoja los pisa
    btn.style.position = 'fixed';
    btn.style.right = '16px';
    btn.style.bottom = '16px';
    btn.style.zIndex = '999999';

    // Si por lo que sea el inline fallback no corre, también escuchamos aquí:
    btn.addEventListener('click', function(ev){
      ev.preventDefault();
      if (window.__TPL_LOGOUT__) return window.__TPL_LOGOUT__();
      // Fallback del fallback:
      try{ sessionStorage.clear(); }catch(_){}
      try{
        localStorage.removeItem('tpl.session');
        localStorage.removeItem('tpl.auth');
        localStorage.removeItem('tpl.currentUser');
        /* TPL: INICIO BLOQUE NUEVO [Limpieza coherente con navbar/auth] */
        localStorage.removeItem('tpl_auth_email');
        localStorage.removeItem('tpl_auth_uid');
        try{ document.body && document.body.setAttribute('data-auth','out'); }catch(_){}
        /* TPL: FIN BLOQUE NUEVO */
      }catch(_){}
      location.assign('index.html');
    }, {passive:false});
  }

  // ---------- Inicio ----------
  document.addEventListener('DOMContentLoaded', ()=>{
    /* TPL: INICIO BLOQUE NUEVO [Migración antes de pintar] */
    migrateUdbToCurrentUid();
    /* TPL: FIN BLOQUE NUEVO */

    setOwnerIncomplete();
    setPetsEmpty();
    loadOwner();
    loadPetsAndRender();
    setupLogout();
  });

  // Reforzar al volver de atrás/adelante (bfcache)
  window.addEventListener('pageshow', (e)=>{
    if (e.persisted){
      loadOwner();
      loadPetsAndRender();
      // Ocultar vacío si hay items pintados (doble seguridad visual)
      const list = document.getElementById('tpl-pets-list');
      const empty = document.getElementById('tpl-pets-empty');
      if (list && list.children.length > 0 && empty){
        empty.style.display = 'none'; empty.hidden = true;
      }
    }
  });

  /* TPL: INICIO BLOQUE NUEVO [Reaccionar a cambios de sesión/almacenamiento] */
  // Cuando navbar/auth anuncian cambio de sesión:
  window.addEventListener('tpl-auth-change', function(){
    migrateUdbToCurrentUid();
    loadOwner();
    loadPetsAndRender();
  });
  // Si cambia storage (otra pestaña o logout):
  window.addEventListener('storage', function(ev){
    if (!ev) return;
    if (ev.key === 'tpl.currentUser' || ev.key === 'tpl_auth_uid' || ev.key === 'tpl_auth_email'
        || (ev.key && ev.key.indexOf('tpl.udb.') === 0)){
      migrateUdbToCurrentUid();
      loadOwner();
      loadPetsAndRender();
    }
  });
  /* TPL: FIN BLOQUE NUEVO */

  // Exponer por si se usa externamente
  window.__TPL_PERFIL__ = Object.assign({}, window.__TPL_PERFIL__||{}, { loadPetsAndRender });
})();
 /* TPL: FIN BLOQUE NUEVO */
