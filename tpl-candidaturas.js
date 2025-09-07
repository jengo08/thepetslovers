/* TPL: INICIO BLOQUE NUEVO [EmailJS + Overlay — Candidaturas (y Reservas) con adjuntos, con fallback Cloudinary unsigned + Firestore; SIN Firebase Storage] */
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
  const FB_DB   = 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore-compat.js';

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
  async function ensureFirestore(){
    await ensureFirebaseAuth();
    if (!(window.firebase && firebase.firestore)) await loadScript(FB_DB);
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

  /* Respaldo de sesión en localStorage */
  function getStoredEmail(){ try{ return localStorage.getItem('tpl_auth_email') || ''; }catch(_){ return ''; } }
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

  // ========= Utilidades comunes =========
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

  /* =========================
     NUEVO: Subida a Cloudinary (unsigned, GRATIS)
     ========================= */
  async function uploadFilesToCloudinary(form, type, onProgress){
    const ds = form.dataset || {};
    const cloudName = ds.cloudinaryName;
    const preset    = ds.cloudinaryPreset;
    if (!cloudName || !preset){
      // Si no hay Cloudinary configurado, retornamos null (seguirá con EmailJS adjuntos)
      return null;
    }

    // Intentamos obtener uid para folder, si hay sesión
    let uid = null;
    try{
      await ensureFirebaseAuth();
      const u = await waitForAuth(4000);
      uid = (u && u.uid) ? u.uid : 'anon';
    }catch(_){
      uid = 'anon';
    }

    const files = getFiles(form);
    if (!files.length) return { urls:{}, id:null, uid };

    const batchId = `${type}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const base = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/auto/upload`;
    const urls = {};
    const total = files.reduce((a,it)=> a + (it.file?.size||0), 0);
    let transferred = 0;

    // Límites front (iguales a los que ya usas)
    const MAX_FILE = 10*1024*1024, MAX_TOTAL = 20*1024*1024;
    if (files.some(f=>f.file.size > MAX_FILE) || total > MAX_TOTAL){
      throw new Error('Cada archivo ≤ 10MB y el total ≤ 20MB.');
    }

    for (let i=0;i<files.length;i++){
      const { field, file } = files[i];
      const fd = new FormData();
      fd.append('upload_preset', preset);
      fd.append('file', file);
      fd.append('folder', `tpl/${uid}/${type}/${batchId}`);

      await new Promise((resolve, reject)=>{
        const xhr = new XMLHttpRequest();
        xhr.open('POST', base, true);

        xhr.upload.onprogress = function(ev){
          if (ev.lengthComputable){
            const doneThis = ev.loaded;
            const pct = Math.round(((transferred + doneThis) / total) * 100);
            onProgress && onProgress({ percent: pct, fileIndex: i+1, total: files.length, fileName: file.name });
          }
        };
        xhr.onreadystatechange = function(){
          if (xhr.readyState === 4){
            if (xhr.status >= 200 && xhr.status < 300){
              try{
                const res = JSON.parse(xhr.responseText || '{}');
                const url = res.secure_url || res.url;
                if (!url) throw new Error('Respuesta sin URL de Cloudinary.');
                urls[field] = urls[field] || [];
                urls[field].push(url);
                transferred += file.size;
                resolve();
              }catch(e){ reject(e); }
            } else {
              reject(new Error('Error Cloudinary: '+xhr.status));
            }
          }
        };
        xhr.onerror = ()=> reject(new Error('Error de red al subir a Cloudinary.'));
        xhr.send(fd);
      });
    }

    // Guardado en Firestore para tu panel
    try{
      await ensureFirestore();
      const db = firebase.firestore();
      const fields = formToObject(form);
      await db.collection(type === 'reserva' ? 'reservas' : 'candidaturas').add({
        uid,
        email: getStoredEmail() || '',
        fields,
        files: urls,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        estado: 'pendiente'
      });
    }catch(_){ /* opcional */ }

    return { urls, id: batchId, uid };
  }

  function populateHiddenUrls(form, urls){
    if (urls.cv && urls.cv[0]) { const el = q('tpl-cvUrl'); if (el) el.value = urls.cv[0]; }
    if (urls.titulo && urls.titulo[0]) { const el = q('tpl-tituloUrl'); if (el) el.value = urls.titulo[0]; }
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
        inp.disabled = true; // al estar disabled, EmailJS no adjunta
      } else {
        if (inp.dataset._tplPrevDisabled === '') inp.disabled = false;
      }
    });
  }

  /* =========================
     PATCH VALIDACIONES (CP + TEL) — global (candidaturas)
     ========================= */
  (function patchValidationHintsGlobal(){
    // Candidaturas
    const cp = q('tpl-cp');
    if (cp){
      cp.setAttribute('pattern', '^[0-9]{5}$');
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

  /* PATCH específico para RESERVAS (CP) — mantiene el patrón “como antes” */
  function patchReservasCP(){
    const f = q('tpl-form-reservas'); if (!f) return;
    const cpInput =
      f.querySelector('#tpl-cp') ||
      f.querySelector('[name="cp"], [name="codigoPostal"], [name*="postal" i], [id*="cp" i]');
    if (!cpInput) return;
    cpInput.setAttribute('pattern', '^[0-9]{5}$');   // anclado
    cpInput.setAttribute('inputmode', 'numeric');
    cpInput.setAttribute('maxlength', '5');
    if (!cpInput.getAttribute('title')) cpInput.setAttribute('title','Introduce 5 dígitos (España)');
    cpInput.addEventListener('input', function(){
      this.value = this.value.replace(/\D/g,'').slice(0,5);
    });
  }

  /* TPL: INICIO BLOQUE NUEVO — Sanitizado CP Reservas ANTES de validar (fix definitivo) */
  function sanitizeReservasCP(form){
    if (!form) return;
    // Solo para Reservas
    if (detectType(form) !== 'reserva') return;
    const cp =
      form.querySelector('#tpl-cp') ||
      form.querySelector('[name="cp"], [name="codigoPostal"], [name*="postal" i], [id*="cp" i]');
    if (!cp) return;
    // Normaliza y asegura patrón correcto
    cp.value = String(cp.value||'').replace(/\D/g,'').slice(0,5);
    cp.setAttribute('pattern', '^[0-9]{5}$');
    cp.setCustomValidity('');
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ========= Lógica genérica para formularios EmailJS =========
  async function handleEmailSend(form, templateId, sendingLabel, successLabel){
    const submitBtn = form.querySelector('button[type="submit"], .cta-button');

    /* 🔧 FIX: si es Reservas, sanitiza CP ANTES de validar */
    sanitizeReservasCP(form);  /* ←————— TPL: NUEVO */

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

    // ====== Cloudinary (si está configurado) → EmailJS sin adjuntos ======
    let uploaded = null;
    try{
      if (files.length){
        uploaded = await uploadFilesToCloudinary(form, detectType(form), (p)=>{/* opcional progreso */});
        if (uploaded && uploaded.urls){
          populateHiddenUrls(form, uploaded.urls);
          disableFileInputs(form, true);
        }
      }
    }catch(errUp){
      console.warn('Cloudinary falló, sigo con EmailJS adjuntos:', errUp);
      // Si falla Cloudinary, seguimos con EmailJS con adjuntos (sin romper tu flujo)
    }

    try{
      const emailjs = await ensureEmailJS();
      try{ emailjs.init(EMAILJS_PUBLIC_KEY); }catch(_){}

      // Envío (si Cloudinary subió, irá sin adjuntos; si no, con adjuntos)
      await withTimeout(
        emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form),
        30000,
        'EmailJS'
      );

      const okMsg = successLabel || (form.dataset.success || '¡Envío realizado con éxito! 🐾');
      const extra = uploaded?.urls ? ' (archivos subidos y enlaces enviados).' : '';
      setStatus(okMsg + extra, true);
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
      patchReservasCP(); // deja el patrón bien puesto “como antes”
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
