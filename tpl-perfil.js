/* TPL: INICIO BLOQUE NUEVO [Propietario: guardar/editar en base por usuario (localStorage)] */
(function(){
  'use strict';

  // ===== UID robusto (mismo criterio que mascotas/perfil) =====
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
  function $(sel, root=document){ return root.querySelector(sel); }

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
  }

  function readForm(){
    const nombre     = $('#nombre').value.trim();
    const dni        = $('#dni').value.trim();
    const direccion  = $('#direccion').value.trim();
    const cp         = $('#cp').value.trim();
    const provincia  = $('#provincia').value.trim();
    const localidad  = $('#localidad').value.trim();
    const email      = $('#email').value.trim();
    const telefono   = $('#telefono').value.trim();
    const contacto   = (document.querySelector('input[name="contacto"]:checked') || {}).value || 'whatsapp';

    const zona = computeZona(localidad, provincia, cp);

    return {
      nombre, dni, direccion, cp, provincia, localidad,
      email, telefono, contacto,
      zona
    };
  }

  function init(){
    const form = document.getElementById('tpl-owner-form');
    const btn  = document.getElementById('saveOwner');
    if (!form || !btn) return;

    // Prefill si existe
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

    btn.addEventListener('click', function(e){
      e.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

      const owner = readForm();
      udbSet(uid, 'owner', owner);
      try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}

      // Volver al perfil (ahí se representa nombre/teléfono/zona/email)
      location.assign('perfil.html');
    });
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
 /* TPL: FIN BLOQUE NUEVO */
