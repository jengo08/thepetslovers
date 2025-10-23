<!-- TPL: INICIO BLOQUE NUEVO [EmailJS + Overlay — Candidaturas (y Reservas) con adjuntos, Cloudinary unsigned + Firestore; doble envío] -->
<script>
(function () {
  'use strict';

  // ========= 🔑 EmailJS (tus claves) =========
  const EMAILJS_PUBLIC_KEY = 'DJY5pmUTEL5ji3AV3';
  const EMAILJS_SERVICE_ID = 'service_fu9tbwq';
  const TEMPLATE_CANDIDATURAS = 'template_q3q0smr';
  const TEMPLATE_RESERVAS     = 'template_ulk5owf';
  const EMAILJS_URL = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';

  // ========= Config de correo =========
  const ADMIN_EMAIL = 'gestion@thepetslovers.es';
  const ADMIN_NAME  = 'Gestión The Pets Lovers';

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
    if (/tpl-candidaturas-admin\.html/i.test(href)) return href;
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
    const txt = (form.textContent||'').toLowerCase();
    if (txt.includes('reserva') || txt.includes('reservar')) return 'reserva';
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
     Subida a Cloudinary (unsigned, opcional)
     ========================= */
  async function uploadFilesToCloudinary(form, type, onProgress){
    const ds = form.dataset || {};
    const cloudName = ds.cloudinaryName;
    const preset    = ds.cloudinaryPreset;
    if (!cloudName || !preset){
      return null;
    }

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
    }catch(_){}

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
        inp.disabled = true;
      } else {
        if (inp.dataset._tplPrevDisabled === '') inp.disabled = false;
      }
    });
  }

  /* =========================
     PATCH VALIDACIONES (CP + TEL) — global (candidaturas)
     ========================= */
  (function patchValidationHintsGlobal(){
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

  /* ==============
     Helpers EmailJS: inyectar vars temporales para doble envío
     ============== */
  function injectVars(form, vars){
    const created = [];
    Object.entries(vars||{}).forEach(([name, value])=>{
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value == null ? '' : String(value);
      form.appendChild(input);
      created.push(input);
    });
    return ()=> created.forEach(el=> el.remove());
  }

  /* ========= Lógica genérica para formularios EmailJS (DOBLE ENVÍO) ========= */
  async function handleEmailSend(form, templateId, sendingLabel, successLabel){
    const submitBtn = form.querySelector('button[type="submit"], .cta-button');

    // --- Validación básica (incluye CP saneado) ---
    const cpCtx = sanitizeCpInputsBeforeValidation(form);
    if (typeof form.reportValidity === 'function' && !form.reportValidity()){
      cpCtx.restoreAll(); setStatus('Revisa los campos obligatorios.', false); return;
    }
    if (cpCtx.hasError){
      cpCtx.restoreAll(); const first = cpCtx.inputs[0]; if (first){ try{ first.reportValidity(); first.focus(); }catch(_){ } } return;
    }
    cpCtx.restoreAll();

    // Requiere sesión
    const logged = await waitUntilLogged({ maxMs: 12000, stepMs: 150 });
    if (!logged){
      showOverlay('Inicia sesión para continuar. Te llevamos y volverás aquí automáticamente.', true);
      wireAcceptRedirect(resolveLoginUrl(), 'Iniciar sesión');
      return;
    }

    // Límite de adjuntos
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

    // Subir a Cloudinary (si está configurado) → enviamos enlaces en vez de adjuntos
    let uploaded = null;
    try{
      if (files.length){
        uploaded = await uploadFilesToCloudinary(form, detectType(form), null);
        if (uploaded && uploaded.urls){
          populateHiddenUrls(form, uploaded.urls);
          disableFileInputs(form, true);
        }
      }
    }catch(errUp){
      console.warn('Cloudinary falló, sigo con EmailJS adjuntos:', errUp);
    }

    try{
      const emailjs = await ensureEmailJS();
      try{ emailjs.init(EMAILJS_PUBLIC_KEY); }catch(_){}

      // Datos base
      const formDataObj = formToObject(form);
      const candidateEmail = formDataObj.email || getStoredEmail() || '';
      const candidateName  = formDataObj.name  || formDataObj.nombre || formDataObj.candidate_name || 'Candidata';

      // 1) ENVÍO A LA CANDIDATA
      const removeCandidateVars = injectVars(form, {
        to_email: candidateEmail,
        to_name: candidateName,
        reply_to: ADMIN_EMAIL,
        is_admin: '' // para plantilla: bloque público
      });
      await withTimeout(emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form), 30000, 'EmailJS candidata');
      removeCandidateVars();

      // 2) ENVÍO A GESTIÓN
      const removeAdminVars = injectVars(form, {
        to_email: ADMIN_EMAIL,
        to_name: ADMIN_NAME,
        reply_to: candidateEmail, // responder a la candidata desde gestión
        is_admin: '1' // para plantilla: bloque privado
      });
      await withTimeout(emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form), 30000, 'EmailJS gestión');
      removeAdminVars();

      const okMsg = successLabel || (form.dataset.success || '¡Envío realizado con éxito! 🐾');
      const extra = uploaded?.urls ? ' (archivos subidos y enlaces enviados).' : '';
      setStatus(okMsg + extra, true);

      // Mensaje especial si era candidatura
      showOverlay(
        okMsg + (detectType(form)==='cuestionario'
          ? ' Tu candidatura está confirmada. En breve revisaremos tus datos y, si todo está correcto, te abriremos tu perfil de auxiliar.'
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

  /* ========= CP universal — saneo/validación ========= */
  function digits5(s){ return String(s||'').replace(/\D/g,'').slice(0,5); }
  function findCpCandidates(form){
    if (!form) return [];
    const els = Array.from(form.querySelectorAll('input'));
    return els.filter(el=>{
      const n=(el.name||'').toLowerCase();
      const i=(el.id||'').toLowerCase();
      const ph=(el.getAttribute('placeholder')||'').toLowerCase();
      let labTxt='';
      if (el.id){
        try{
          const lab = form.querySelector('label[for="'+(CSS&&CSS.escape?CSS.escape(el.id):el.id)+'"]');
          if (lab) labTxt = (lab.textContent||'').toLowerCase();
        }catch(_){}
      }
      const wrap = el.closest('label');
      if (wrap) labTxt += ' ' + (wrap.textContent||'').toLowerCase();
      const hayCp = /(^|[^a-z])cp([^a-z]|$)/.test(n+i+ph+labTxt);
      const hayPostal = /(postal|c[óo]digo\s*postal)/.test(n+i+ph+labTxt);
      return hayCp || hayPostal;
    });
  }
  function sanitizeCpInputsBeforeValidation(form){
    const cands = findCpCandidates(form);
    if (!cands.length) return { restoreAll: ()=>{}, hasError:false, inputs:[] };
    const toRestore = []; let hasError = false;
    cands.forEach(cp=>{
      const prev = {
        type: cp.getAttribute('type'),
        pattern: cp.getAttribute('pattern'),
        step: cp.getAttribute('step'),
        min: cp.getAttribute('min'),
        max: cp.getAttribute('max')
      };
      cp.value = digits5(cp.value);
      cp.setAttribute('maxlength','5');
      cp.setAttribute('inputmode','numeric');
      cp.setAttribute('type','text');
      if (prev.pattern!=null) cp.removeAttribute('pattern');
      if (prev.step) cp.removeAttribute('step');
      if (prev.min) cp.removeAttribute('min');
      if (prev.max) cp.removeAttribute('max');
      const must = cp.hasAttribute('required') || cp.value.length>0;
      if (must && cp.value.length !== 5){ hasError = true; cp.setCustomValidity('Introduce 5 dígitos (España)'); }
      else { cp.setCustomValidity(''); }
      toRestore.push(()=> {
        if (prev.type) cp.setAttribute('type', prev.type); else cp.removeAttribute('type');
        if (prev.pattern!=null) cp.setAttribute('pattern', prev.pattern); else cp.removeAttribute('pattern');
        if (prev.step) cp.setAttribute('step', prev.step); else cp.removeAttribute('step');
        if (prev.min) cp.setAttribute('min', prev.min); else cp.removeAttribute('min');
        if (prev.max) cp.setAttribute('max', prev.max); else cp.removeAttribute('max');
      });
    });
    return { hasError, inputs: cands, restoreAll: ()=>{ toRestore.forEach(fn=>{ try{ fn(); }catch(_){}}); } };
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
          '¡Tu candidatura ha sido enviada! 🎉'
        );
      });
    }

    // --- RESERVAS ---
    const formR = q('tpl-form-reservas') || Array.from(document.forms).find(f => {
      const t=(f.textContent||'').toLowerCase(); return t.includes('reserva')||t.includes('reservar');
    });
    if (formR){
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
</script>
<!-- TPL: FIN BLOQUE NUEVO -->
