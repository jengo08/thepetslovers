/* TPL: INICIO BLOQUE NUEVO [EmailJS + Overlay — Candidaturas (y Reservas) con adjuntos, con fallback Firebase Storage + Firestore] */
(function () {
  'use strict';

  // ========= 🔑 EmailJS (tus claves) =========
  const EMAILJS_PUBLIC_KEY = 'L2xAATfVuHJwj4EIV';
  const EMAILJS_SERVICE_ID = 'service_odjqrfl';
  const TEMPLATE_CANDIDATURAS = 'template_32z2wj4';
  const TEMPLATE_RESERVAS     = 'template_rao5n0c';
  const EMAILJS_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

  // ========= Helpers UI / DOM =========
  function q(id){ return document.getElementById(id); }
  function $(sel, root){ return (root||document).querySelector(sel); }
  function setStatus(msg, ok){
    var el = q('tpl-estado'); if (!el) return;
    el.textContent = msg;
    el.className = 'tpl-note ' + (ok ? 'tpl-ok' : 'tpl-error');
  }
  function withTimeout(promise, ms, label){
    let timer; const err = new Error((label||'Operación')+' tardó demasiado');
    const t = new Promise((_,rej)=> timer=setTimeout(()=>rej(err), ms));
    return Promise.race([promise.finally(()=>clearTimeout(timer)), t]);
  }
  function loadScript(src){
    return new Promise((res, rej)=>{
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = res; s.onerror = ()=>rej(new Error('No se pudo cargar '+src));
      document.head.appendChild(s);
    });
  }
  async function ensureEmailJS(){
    if (window.emailjs) return window.emailjs;
    await loadScript(EMAILJS_URL);
    if (!window.emailjs) throw new Error('EmailJS SDK no disponible');
    return window.emailjs;
  }

  /* =========================
     Firebase Auth (rehidratación de sesión)
     ========================= */
  const FB_APP  = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js';
  const FB_AUTH = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth-compat.js';

  async function ensureFirebaseAuth(){
    if (window.firebase && firebase.auth) return;
    try{
      await loadScript(FB_APP);
      await loadScript(FB_AUTH);
      if (!firebase.apps || !firebase.apps.length){
        firebase.initializeApp({
          apiKey:"AIzaSyDW73aFuz2AFS9VeWg_linHIRJYN4YMgTk",
          authDomain:"thepetslovers-c1111.firebaseapp.com",
          projectId:"thepetslovers-c1111",
          storageBucket:"thepetslovers-c1111.appspot.com",
          messagingSenderId:"415914577533",
          appId:"1:415914577533:web:0b7a056ebaa4f1de28ab14",
          measurementId:"G-FXPD69KXBG"
        });
      }
    }catch(_){}
  }
  function getAuth(){ try{ return firebase && firebase.auth ? firebase.auth() : null; }catch(_){ return null; } }
  async function waitForAuth(timeoutMs=9000){
    const auth = getAuth(); if (!auth) return null;
    if (auth.currentUser) return auth.currentUser;
    return await new Promise((resolve)=>{
      let done = false;
      const to = setTimeout(()=>{ if(!done){ done=true; resolve(auth.currentUser||null); } }, timeoutMs);
      auth.onAuthStateChanged(u=>{ if(!done){ done=true; clearTimeout(to); resolve(u||null); } });
    });
  }
  function isLogged(){
    const auth = getAuth();
    const u = auth && auth.currentUser;
    return !!(u && !u.isAnonymous);
  }
  function looksLoggedFromNavbar(){
    const a = document.getElementById('tpl-login-link'); if (!a) return false;
    const t = (a.textContent||'').toLowerCase();
    return t.includes('mi perfil') || t.includes('mi panel');
  }

  /* TPL: INICIO BLOQUE NUEVO [Respaldo de sesión en localStorage] */
  function getStoredEmail(){
    try{ return localStorage.getItem('tpl_auth_email') || ''; }catch(_){ return ''; }
  }
  function looksLoggedFromStorage(){ return !!getStoredEmail(); }
  function syncStorageFromUser(user){
    try{
      if (user && !user.isAnonymous && user.email){
        localStorage.setItem('tpl_auth_email', user.email || '');
        localStorage.setItem('tpl_auth_uid',   user.uid   || '');
      } else {
        localStorage.removeItem('tpl_auth_email');
        localStorage.removeItem('tpl_auth_uid');
      }
    }catch(_){}
  }
  /* TPL: FIN BLOQUE NUEVO */

  function resolveLoginUrl(){
    const a = $('.login-button[href]') 
           || $('a[href*="iniciar"][href$=".html"]') 
           || $('a[href*="#iniciar"]');
    const base = a ? a.getAttribute('href') : 'iniciar-sesion.html';
    const sep = base.includes('?') ? '&' : '?';
    return base + sep + 'next=' + encodeURIComponent(location.pathname + location.search + location.hash);
  }
  function getProfileUrl(){
    const a = document.getElementById('tpl-login-link');
    const href = a ? (a.getAttribute('href')||'') : '';
    if (/tpl-candidaturas-admin\.html/i.test(href)) return href; // admin → panel
    if (/perfil/i.test(href)) return href;
    return 'perfil.html';
  }

  /* TPL: INICIO BLOQUE NUEVO — Espera robusta hasta ver sesión (Firebase o navbar o storage) */
  async function waitUntilLogged({maxMs=12000, stepMs=150}={}){
    const t0 = Date.now();
    try{ await ensureFirebaseAuth(); }catch(_){}
    const u = await waitForAuth(9000);
    if (u) syncStorageFromUser(u);

    while (Date.now() - t0 < maxMs){
      if (isLogged() || looksLoggedFromNavbar() || looksLoggedFromStorage()) return true;
      await new Promise(r=>setTimeout(r, stepMs));
    }
    return false;
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ========= Overlay (tarjeta modal) =========
  function ensureOverlay(){
    let ov = $('#tpl-overlay');
    if (!ov){
      ov = document.createElement('div');
      ov.id = 'tpl-overlay';
      ov.className = 'tpl-overlay';
      ov.innerHTML =
        '<div class="tpl-modal" role="dialog" aria-modal="true" aria-labelledby="tpl-ov-title">'+
        '  <p id="tpl-ov-text" style="margin-bottom:14px"></p>'+
        '  <div class="tpl-ov-actions" style="display:flex;gap:10px;justify-content:center">'+
        '    <button id="tpl-ov-accept" class="cta-button" style="display:none">Aceptar</button>'+
        '  </div>'+
        '</div>';
      document.body.appendChild(ov);
    }
    return ov;
  }
  function showOverlay(message, showAccept){
    const ov = ensureOverlay();
    ov.classList.add('on');
    $('#tpl-ov-text', ov).textContent = message || '';
    const btn = $('#tpl-ov-accept', ov);
    btn.style.display = showAccept ? 'inline-block' : 'none';
  }
  function hideOverlay(){
    const ov = $('#tpl-overlay'); if (ov) ov.classList.remove('on');
  }
  function wireAcceptRedirect(url, label){
    const ov = ensureOverlay();
    const btn = $('#tpl-ov-accept', ov);
    if (label) btn.textContent = label;
    btn.onclick = null;
    btn.addEventListener('click', function(){
      window.location.href = url;
    }, { once:true });
  }

  /* =========================
     TPL: BLOQUE NUEVO — Fallback de adjuntos: Firebase Storage + Firestore
     ========================= */
  const FB_STORE = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage-compat.js';
  const FB_DB    = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js';

  async function ensureFirebaseData(){
    await ensureFirebaseAuth();
    if (!(firebase && firebase.firestore)) await loadScript(FB_DB);
    if (!(firebase && firebase.storage))   await loadScript(FB_STORE);
  }

  function getFiles(form){
    const files = [];
    form.querySelectorAll('input[type="file"]').forEach(inp=>{
      const field = inp.name || 'archivo';
      Array.from(inp.files||[]).forEach(file=>{
        if (file) files.push({ field, file, input: inp });
      });
    });
    return files;
  }

  function detectType(form){
    if (form && form.id === 'tpl-form-auxiliares') return 'cuestionario';
    if (form && form.id === 'tpl-form-reservas')    return 'reserva';
    return (form && (form.dataset.type||'generico')).toLowerCase();
  }

  function formToObject(form){
    const o = {};
    const fd = new FormData(form);
    fd.forEach((v,k)=>{
      if (v instanceof File) return;
      if (k in o){
        if (Array.isArray(o[k])) o[k].push(String(v));
        else o[k] = [o[k], String(v)];
      } else {
        o[k] = String(v);
      }
    });
    return o;
  }

  async function uploadFilesToFirebase(form, type, onProgress){
    await ensureFirebaseData();
    const auth = getAuth();
    const user = await waitForAuth(9000);
    if (!user || user.isAnonymous) throw new Error('Debes iniciar sesión para adjuntar archivos.');

    const storage = firebase.storage();
    const db = firebase.firestore();

    const files = getFiles(form);
    if (!files.length) return { urls:{}, id:null, uid: user.uid };

    const batchId = `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const urls = {};
    const total = files.reduce((a,it)=> a + (it.file?.size||0), 0);
    let done = 0;

    // Límite de tamaño (igual que el front)
    const MAX_FILE = 10*1024*1024, MAX_TOTAL = 20*1024*1024;
    if (files.some(f=>f.file.size > MAX_FILE) || total > MAX_TOTAL){
      throw new Error('Cada archivo ≤ 10MB y el total ≤ 20MB.');
    }

    for (let i=0;i<files.length;i++){
      const { field, file } = files[i];
      const safe = String(file.name||'file').replace(/[^\w.\-]+/g,'_').slice(0,120);
      const path = `tpl/${user.uid}/${type}/${batchId}/${field}__${safe}`;
      const ref = storage.ref().child(path);

      await new Promise((resolve,reject)=>{
        const task = ref.put(file, { contentType: file.type||'application/octet-stream' });
        task.on('state_changed',
          snap=>{
            if (onProgress){
              const pct = Math.round(((done + snap.bytesTransferred) / total) * 100);
              onProgress({ percent: pct, fileIndex: i+1, total: files.length, fileName: file.name });
            }
          },
          err=> reject(err),
          async ()=>{
            done += file.size;
            try{
              const url = await ref.getDownloadURL();
              urls[field] = urls[field] || [];
              urls[field].push(url);
              resolve();
            }catch(e){ reject(e); }
          }
        );
      });
    }

    // Registro para tu panel
    try{
      const fields = formToObject(form);
      await db.collection(type === 'reserva' ? 'reservas' : 'candidaturas').add({
        uid: user.uid || null,
        email: (user.email||''),
        fields,
        files: urls,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        estado: 'pendiente'
      });
    }catch(_){}

    return { urls, id: batchId, uid: user.uid };
  }

  function populateHiddenUrls(form, urls){
    // Mapea cv → cvUrl, titulo → tituloUrl (si existen)
    if (urls.cv && urls.cv[0]) { const el = q('tpl-cvUrl'); if (el) el.value = urls.cv[0]; }
    if (urls.titulo && urls.titulo[0]) { const el = q('tpl-tituloUrl'); if (el) el.value = urls.titulo[0]; }
    // Además, añade campos extras por si el template los quiere
    Object.keys(urls).forEach(field=>{
      urls[field].forEach((u, idx)=>{
        const hid = document.createElement('input');
        hid.type = 'hidden';
        hid.name = `file_${field}_${idx+1}_url`;
        hid.value = u;
        form.appendChild(hid);
      });
    });
  }

  function disableFileInputs(form, flag){
    form.querySelectorAll('input[type="file"]').forEach(inp=>{
      if (flag){
        inp.dataset._tplPrevDisabled = inp.disabled ? '1' : '';
        inp.disabled = true; // al estar disabled, EmailJS no los adjunta
      } else {
        if (inp.dataset._tplPrevDisabled === '') inp.disabled = false;
      }
    });
  }
  /* ===== FIN BLOQUE NUEVO (Storage + Firestore) ===== */

  // ========= Lógica genérica para formularios EmailJS =========
  async function handleEmailSend(form, templateId, sendingLabel, successLabel){
    const submitBtn = form.querySelector('button[type="submit"], .cta-button');

    // Validación nativa
    if (typeof form.reportValidity === 'function' && !form.reportValidity()){
      setStatus('Revisa los campos obligatorios.', false);
      return;
    }

    // Requiere sesión (robusta)
    const logged = await waitUntilLogged({ maxMs: 12000, stepMs: 150 });
    if (!logged){
      showOverlay('Inicia sesión para continuar. Te llevamos y volverás aquí automáticamente.', true);
      wireAcceptRedirect(resolveLoginUrl(), 'Iniciar sesión');
      return;
    }

    // Límite por archivo (10 MB)
    const max = 10 * 1024 * 1024;
    const files = getFiles(form);
    for (const f of files){
      if (f.file && f.file.size > max){
        setStatus('El archivo "'+(f.file.name||'adjunto')+'" supera 10MB.', false);
        return;
      }
    }

    if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; }
    setStatus('Preparando envío…', false);
    showOverlay(sendingLabel, false);

    // ====== TPL: NUEVO — Subir primero a Firebase y luego enviar EmailJS sin adjuntos ======
    let uploaded = null;
    try{
      if (files.length){
        uploaded = await uploadFilesToFirebase(form, detectType(form), (p)=>{/* opcional: podrías actualizar overlay */});
        if (uploaded && uploaded.urls) {
          populateHiddenUrls(form, uploaded.urls);
          disableFileInputs(form, true); // para que EmailJS no adjunte (evita el error de envío)
        }
      }
    }catch(errUp){
      console.error('Subida Storage falló:', errUp);
      setStatus('No se pudieron subir los archivos. '+(errUp.message||''), false);
      hideOverlay();
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
      return;
    }
    // ====== FIN NUEVO ======

    try{
      const emailjs = await ensureEmailJS();
      try{ emailjs.init(EMAILJS_PUBLIC_KEY); }catch(_){}

      // Envío del formulario (ya sin adjuntos, pero con URLs ocultas)
      await withTimeout(
        emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form),
        30000,
        'EmailJS'
      );

      // Éxito → mensaje + botón Aceptar que te lleva al PERFIL/PANEL
      const okMsg = successLabel || (form.dataset.success || '¡Envío realizado con éxito! 🐾');
      setStatus(okMsg + (files.length ? ' (archivos subidos y enlaces enviados).' : ''), true);
      showOverlay(
        okMsg + (detectType(form)==='cuestionario'
          ? ' En cuanto esté aceptada podrás generar tu perfil; te llegará un correo para crear tu acceso.'
          : ''),
        true
      );
      wireAcceptRedirect(getProfileUrl(), 'Ir a mi perfil');

      try{ form.reset(); }catch(_){}

    }catch(err){
      console.error('EmailJS error:', err);
      setStatus('No se pudo enviar. ' + (err && err.message ? err.message : ''), false);
      hideOverlay();
    }finally{
      disableFileInputs(form, false);
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
    }
  }

  /* =========================
     PATCH VALIDACIONES (CP + TEL)
     ========================= */
  (function patchValidationHintsGlobal(){
    // Candidaturas (ya lo tenías)
    const cp = q('tpl-cp');
    if (cp){
      cp.setAttribute('pattern', '[0-9]{5}');
      cp.setAttribute('inputmode', 'numeric');
      cp.setAttribute('maxlength', '5');
      if (!cp.getAttribute('title')) cp.setAttribute('title','Introduce 5 dígitos (España)');
      cp.addEventListener('input', function(){ this.value = this.value.replace(/\D/g,'').slice(0,5); });
    }
    const tel = q('tpl-telefono');
    if (tel){
      tel.setAttribute('pattern', '(\\+34\\s?)?([0-9]{3}\\s?){3}');
      tel.setAttribute('inputmode', 'tel');
      if (!tel.getAttribute('title')) tel.setAttribute('title','Ej.: 600123456 o +34 600123456');
      tel.addEventListener('input', function(){
        this.value = this.value.replace(/[^0-9+ ]/g,'').replace(/\s{2,}/g,' ');
      });
      tel.addEventListener('blur', function(){ this.value = this.value.trim(); });
    }
  })();

  /* TPL: INICIO BLOQUE NUEVO — PATCH específico para RESERVAS (CP) */
  function patchReservasCP(){
    const f = q('tpl-form-reservas'); if (!f) return;
    const cpInput =
      f.querySelector('#tpl-cp') ||
      f.querySelector('[name="cp"], [name="codigoPostal"], [name*="postal" i], [id*="cp" i]');
    if (!cpInput) return;
    cpInput.setAttribute('pattern', '[0-9]{5}');
    cpInput.setAttribute('inputmode', 'numeric');
    cpInput.setAttribute('maxlength', '5');
    if (!cpInput.getAttribute('title')) cpInput.setAttribute('title','Introduce 5 dígitos (España)');
    cpInput.addEventListener('input', function(){
      this.value = this.value.replace(/\D/g,'').slice(0,5);
    });
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ========= Inicialización por página =========
  document.addEventListener('DOMContentLoaded', function(){

    // --- CANDIDATURAS ---
    const formC = q('tpl-form-auxiliares');
    if (formC){
      formC.addEventListener('submit', function(ev){
        ev.preventDefault();
        handleEmailSend(
          formC,
          TEMPLATE_CANDIDATURAS,
          'Subiendo archivos y enviando tu candidatura…',
          'Tu candidatura está subida.'
        );
      });
    }

    // --- RESERVAS ---
    const formR = q('tpl-form-reservas');
    if (formR){
      patchReservasCP(); // ← FIX: CP vuelve a validarse “como antes”
      formR.addEventListener('submit', function(ev){
        ev.preventDefault();
        handleEmailSend(
          formR,
          TEMPLATE_RESERVAS,
          'Enviando tu reserva…',
          'Tu solicitud de reserva está enviada.'
        );
      });
    }
  });
})();
/* TPL: FIN BLOQUE NUEVO */
