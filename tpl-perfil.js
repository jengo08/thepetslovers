/* TPL: INICIO BLOQUE NUEVO [Propietario: guardar/cargar en base por usuario (localStorage)] */
(function(){
  'use strict';

  // ====== Base por usuario (localStorage) ======
  function getCurrentUserId(){
    // Tu login debe setear esto: localStorage.setItem('tpl.currentUser', 'email@dominio.com')
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

  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  document.addEventListener('DOMContentLoaded', ()=>{
    // Localiza el formulario (id recomendado: tpl-owner-form)
    const form = byId('tpl-owner-form') || $('form');
    if (!form) return;

    // Botón de guardar (id recomendado: saveBtn)
    const saveBtn = byId('saveBtn');

    // Campos “canónicos” que usa perfil.html para mostrar
    const fNombre   = byId('nombre')   || $('[name="nombre"]');
    const fTelefono = byId('telefono') || $('[name="telefono"]');
    const fZona     = byId('zona')     || $('[name="zona"]');
    const fEmail    = byId('email')    || $('[name="email"]');

    // Precarga desde udb
    (function prefill(){
      const uid = getCurrentUserId();
      const owner = udbGet(uid, 'owner', null);
      if (!owner) return;
      if (fNombre)   fNombre.value   = owner.nombre   || '';
      if (fTelefono) fTelefono.value = owner.telefono || '';
      if (fZona)     fZona.value     = owner.zona     || '';
      if (fEmail)    fEmail.value    = owner.email    || '';

      // Precargar extras si hay name=...
      form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el=>{
        const nm = el.name;
        if (nm && owner.hasOwnProperty(nm) && el !== fNombre && el !== fTelefono && el !== fZona && el !== fEmail){
          el.value = owner[nm] || '';
        }
      });
    })();

    function doSave(ev){
      if (ev){ ev.preventDefault(); ev.stopPropagation(); }
      if (form.reportValidity && !form.reportValidity()) return;

      // Recoger lo básico
      const owner = {
        nombre:   fNombre   ? (fNombre.value||'').trim()   : '',
        telefono: fTelefono ? (fTelefono.value||'').trim() : '',
        zona:     fZona     ? (fZona.value||'').trim()     : '',
        email:    fEmail    ? (fEmail.value||'').trim()    : ''
      };

      // Recoger también todos los name=... por si añadimos más campos
      form.querySelectorAll('input[name], select[name], textarea[name]').forEach(el=>{
        const nm = el.name;
        if (!nm) return;
        const v = (el.type === 'checkbox') ? (el.checked ? 'Sí' : 'No') : (el.value || '');
        owner[nm] = v;
      });

      const uid = getCurrentUserId();
      udbSet(uid, 'owner', owner);

      // Vuelta al perfil
      location.assign('perfil.html');
    }

    if (saveBtn){ saveBtn.addEventListener('click', doSave); }
    form.addEventListener('submit', doSave);
  });
})();
 /* TPL: FIN BLOQUE NUEVO */
