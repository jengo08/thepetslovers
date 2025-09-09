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
  /* TPL: INICIO BLOQUE NUEVO [Firestore sync helpers - lazy load + init] */
  function tplLazyLoadFirebase8(){
    return new Promise(function(resolve){
      if (window.firebase && firebase.app) return resolve();
      var urls = [
        'https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js',
        'https://www.gstatic.com/firebasejs/8.10.1/firebase-auth.js',
        'https://www.gstatic.com/firebasejs/8.10.1/firebase-firestore.js'
      ];
      var i = 0;
      (function next(){
        if (i >= urls.length) return resolve();
        var s = document.createElement('script');
        s.src = urls[i++]; s.async = true; s.onload = next; s.onerror = function(){ resolve(); };
        document.head.appendChild(s);
      })();
    });
  }
  function tplEnsureFirebaseInit(){
    try{
      if (!window.firebase) return false;
      if (firebase.apps && firebase.apps.length) return true;
      var cfg = window.TPL_FIREBASE_CONFIG || window.firebaseConfig || window.__TPL_FIREBASE_CONFIG;
      if (!cfg) return false;
      firebase.initializeApp(cfg);
      return true;
    }catch(_){ return false; }
  }
  async function __tplOwnerSyncToFirestore(uid, owner){
    // Requisitos mínimos
    if (!uid || uid === 'default') return false;
    await tplLazyLoadFirebase8();
    if (!tplEnsureFirebaseInit() || !(firebase.auth && firebase.firestore)) return false;

    // Asegurar sesión (evitamos escribir en uid incorrecto)
    if (!firebase.auth().currentUser || firebase.auth().currentUser.uid !== uid){
      await new Promise(function(res){
        var unsub = firebase.auth().onAuthStateChanged(function(){ try{unsub();}catch(_){ } res(); });
      });
    }
    var u = firebase.auth().currentUser;
    if (!u || u.uid !== uid) return false;

    var db = firebase.firestore();
    var docRef = db.collection('owners').doc(uid);
    var snap = await docRef.get();
    var FV = firebase.firestore.FieldValue;

    var payload = {
      nombre: owner.nombre || '',
      dni: owner.dni || '',
      direccion: owner.direccion || '',
      cp: owner.cp || '',
      provincia: owner.provincia || '',
      localidad: owner.localidad || '',
      email: owner.email || '',
      telefono: owner.telefono || '',
      contacto: owner.contacto || 'whatsapp',
      contactoHorario: owner.contactoHorario || '',
      zona: owner.zona || ''
      // hasPet lo gestionaremos cuando crees la primera mascota
    };

    if (snap.exists){
      payload.updatedAt = FV.serverTimestamp();
      await docRef.set(payload, { merge: true });
    } else {
      payload.createdAt = FV.serverTimestamp();
      payload.updatedAt = FV.serverTimestamp();
      await docRef.set(payload, { merge: true });
    }

    try { localStorage.setItem('tpl.owner.synced', String(Date.now())); }catch(_){}
    return true;
  }
  /* TPL: FIN BLOQUE NUEVO */

  // Exponer el manejador para el onsubmit inline y el botón
  /* TPL: INICIO BLOQUE NUEVO [handleSubmit async + sync Firestore si disponible] */
  async function handleSubmit(ev){
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

    const form = document.getElementById('tpl-owner-form');
    const btn  = document.getElementById('saveOwner');
    if (!form) return false;

    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false;

    try{ if (btn){ btn.disabled = true; btn.style.opacity = '.6'; } }catch(_){}

    const uid = getCurrentUserId();
    const owner = readForm();

    // Siempre guardamos en local (como ya hacías)
    udbSet(uid, 'owner', owner);
    try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}

    // Sincronización opcional a Firestore (si está disponible y hay sesión válida)
    try{
      await __tplOwnerSyncToFirestore(uid, owner);
    }catch(e){
      console.warn('[TPL propietario] Sync Firestore fallo (continuamos igual):', e);
    }

    // Redirección idéntica a tu flujo actual
    location.assign('perfil.html');
    return false;
  }
  /* TPL: FIN BLOQUE NUEVO */

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
