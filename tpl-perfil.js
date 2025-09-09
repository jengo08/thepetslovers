/* TPL: INICIO BLOQUE NUEVO [Propietario: guardar/editar en base por usuario (localStorage) + submit blindado] */
(function(){
  'use strict';

  // ===== UID robusto (igual que perfil/mascotas) =====
  function getCurrentUserId(){
    var explicit = localStorage.getItem('tpl.currentUser');
    if (explicit) return explicit;
    var uidLS = localStorage.getItem('tpl_auth_uid');
    if (uidLS) return uidLS;
    try{
      if (window.firebase && typeof firebase.auth === 'function'){
        var u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return 'default';
  }

  // ===== Utils udb =====
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try{ const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }catch(_){ return fallback; }
  }
  function udbSet(uid, key, value){
    try{ localStorage.setItem(udbKey(uid,key), JSON.stringify(value)); }catch(_){}
  }

  // ===== DOM =====
  const $ = (sel, root=document) => root.querySelector(sel);

  function computeZona(localidad, provincia, cp){
    const parts = [];
    if (localidad) parts.push(localidad.trim());
    if (provincia) parts.push(provincia.trim());
    if (!parts.length && cp) parts.push(cp.trim());
    return parts.join(', ');
  }

  function fillFormFromOwner(owner){
    if (!owner) return;
    $('#nombre').value     = owner.nombre || '';
    $('#dni').value        = owner.dni || '';
    $('#direccion').value  = owner.direccion || '';
    $('#cp').value         = owner.cp || '';
    $('#provincia').value  = owner.provincia || '';
    $('#localidad').value  = owner.localidad || '';
    $('#email').value      = owner.email || '';
    $('#telefono').value   = owner.telefono || '';
    const pref = owner.contacto || 'whatsapp';
    const r = document.querySelector(`input[name="contacto"][value="${pref}"]`);
    if (r) r.checked = true;
    $('#contactoHorario').value = owner.contactoHorario || '';
  }

  function normalizeId(v){
    return String(v||'').toUpperCase().replace(/\s+/g,'').replace(/-/g,'');
  }
  const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';
  function isValidSpanishId(idRaw){
    const id = normalizeId(idRaw);
    if (!id) return false;
    const mDni = id.match(/^(\d{8})([A-Z])$/);
    if (mDni){
      const num = parseInt(mDni[1],10);
      const letter = DNI_LETTERS[num % 23];
      return mDni[2] === letter;
    }
    const mNie = id.match(/^([XYZ])(\d{7})([A-Z])$/);
    if (mNie){
      const map = {X:'0', Y:'1', Z:'2'};
      const num = parseInt(map[mNie[1]] + mNie[2], 10);
      const letter = DNI_LETTERS[num % 23];
      return mNie[3] === letter;
    }
    return false;
  }
  function attachDniValidation(){
    const dni = $('#dni');
    if (!dni) return;
    const apply = ()=>{
      const v = normalizeId(dni.value);
      dni.value = v;
      if (!v){ dni.setCustomValidity(''); return; }
      if (isValidSpanishId(v)){ dni.setCustomValidity(''); }
      else { dni.setCustomValidity('DNI/NIE no válido'); }
    };
    dni.addEventListener('input', apply);
    dni.addEventListener('blur', apply);
    apply();
  }

  function readForm(){
    const nombre     = ($('#nombre').value||'').trim();
    const dni        = normalizeId($('#dni').value||'');
    const direccion  = ($('#direccion').value||'').trim();
    const cp         = ($('#cp').value||'').trim();
    const provincia  = ($('#provincia').value||'').trim();
    const localidad  = ($('#localidad').value||'').trim();
    const email      = ($('#email').value||'').trim();
    const telefono   = ($('#telefono').value||'').trim();
    const contacto   = (document.querySelector('input[name="contacto"]:checked') || {}).value || 'whatsapp';
    const contactoHorario = ($('#contactoHorario').value||'').trim();
    const zona = computeZona(localidad, provincia, cp);
    return { nombre, dni, direccion, cp, provincia, localidad, email, telefono, contacto, contactoHorario, zona };
  }

  // ===== Guardado + redirección (expuesto global) =====
  function handleSubmit(ev){
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

    const form = document.getElementById('tpl-owner-form');
    if (!form) return false;

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false;

    const uid = getCurrentUserId();
    const owner = readForm();
    udbSet(uid, 'owner', owner);
    try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}

    location.assign('perfil.html');
    return false;
  }

  // Exponer el manejador para el onsubmit inline y el botón
  window.__TPL_OWNER_SUBMIT__ = handleSubmit;

  function init(){
    const form = document.getElementById('tpl-owner-form');
    const btn  = document.getElementById('saveOwner');
    if (!form || !btn) return;

    // Prefill si ya había datos
    const uid = getCurrentUserId();
    const existing = udbGet(uid, 'owner', null);
    if (existing) fillFormFromOwner(existing);

    // Validaciones rápidas
    const cp = document.getElementById('cp');
    if (cp){
      cp.setAttribute('inputmode','numeric');
      cp.setAttribute('pattern','[0-9]{5}');
      cp.setAttribute('maxlength','5');
    }
    attachDniValidation();

    // Enganche en captura (si otro script intenta interceptar)
    form.addEventListener('submit', handleSubmit, {capture:true});

    // Click del botón → submit o fallback directo a handleSubmit
    btn.addEventListener('click', function(){
      if (typeof form.requestSubmit === 'function') form.requestSubmit();
      else handleSubmit();
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
 /* TPL: FIN BLOQUE NUEVO */
