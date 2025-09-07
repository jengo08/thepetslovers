/* TPL: INICIO BLOQUE NUEVO [EmailJS + Overlay — Candidaturas (y Reservas) con adjuntos, sin Firebase Storage/Cloudinary/Formspree] */
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
     TPL: FIX — Comprobación de sesión (Firebase Auth) antes de enviar
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

  <!-- TPL: INICIO BLOQUE NUEVO [Lectura/Escritura de sesión en localStorage como respaldo] -->
  function getStoredEmail(){
    try{ return localStorage.getItem('tpl_auth_email') || ''; }catch(_){ return ''; }
  }
  function looksLoggedFromStorage(){
    return !!getStoredEmail();
  }
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
  <!-- TPL: FIN BLOQUE NUEVO -->

  function resolveLoginUrl(){
    const a = $('.login-button[href]') 
           || $('a[href*="iniciar"][href$=".html"]') 
           || $('a[href*="#iniciar"]');
    const base = a ? a.getAttribute('href') : 'iniciar-sesion.html';
    const sep = base.includes('?') ? '&' : '?';
    // TPL: FIX — incluir ?next=ruta-actual
    return base + sep + 'next=' + encodeURIComponent(location.pathname + location.search + location.hash);
  }
  function getProfileUrl(){
    const a = document.getElementById('tpl-login-link');
    const href = a ? (a.getAttribute('href')||'') : '';
    if (/tpl-candidaturas-admin\.html/i.test(href)) return href; // si eres admin, ve a tu panel
    if (/perfil/i.test(href)) return href;
    return 'perfil.html';
  }

  /* TPL: INICIO BLOQUE NUEVO — Espera robusta hasta que la sesión sea visible (Firebase o navbar o storage) */
  async function waitUntilLogged({maxMs=12000, stepMs=150}={}){
    const t0 = Date.now();
    // Primer intento: dispara la rehidratación
    try{ await ensureFirebaseAuth(); }catch(_){}
    const u = await waitForAuth(9000);
    if (u) syncStorageFromUser(u); // sincroniza storage aunque no haya navbar

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
  /* TPL: FIX — Aceptar con redirección configurable + etiqueta del botón */
  function wireAcceptRedirect(url, label){
    const ov = ensureOverlay();
    const btn = $('#tpl-ov-accept', ov);
    if (label) btn.textContent = label;           // ← pone “Iniciar sesión” cuando toca
    btn.onclick = null;
    btn.addEventListener('click', function(){
      window.location.href = url;
    }, { once:true });
  }

  // ========= Lógica genérica para formularios EmailJS =========
  async function handleEmailSend(form, templateId, sendingLabel, successLabel){
    const submitBtn = form.querySelector('button[type="submit"], .cta-button');

    // Validación nativa
    if (typeof form.reportValidity === 'function' && !form.reportValidity()){
      setStatus('Revisa los campos obligatorios.', false);
      return;
    }

    /* TPL: FIX — Exigir sesión ANTES de enviar (con espera robusta que detecta Firebase, navbar o storage) */
    const logged = await waitUntilLogged({ maxMs: 12000, stepMs: 150 });
    if (!logged){
      showOverlay('Inicia sesión para continuar. Te llevamos y volverás aquí automáticamente.', true);
      wireAcceptRedirect(resolveLoginUrl(), 'Iniciar sesión'); // → login con ?next
      return;
    }

    // Límite de tamaño por archivo (10 MB)
    const max = 10 * 1024 * 1024;
    const files = form.querySelectorAll('input[type="file"]');
    for (const inp of files){
      const f = inp.files && inp.files[0];
      if (f && f.size > max){
        setStatus('El archivo "'+(f.name||'adjunto')+'" supera 10MB.', false);
        return;
      }
    }

    if (submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Enviando…'; }
    setStatus('Preparando envío…', false);
    showOverlay(sendingLabel, false);

    try{
      const emailjs = await ensureEmailJS();
      try{ emailjs.init(EMAILJS_PUBLIC_KEY); }catch(_){}

      // Envío con adjuntos reales (sendForm + <input type="file">)
      await withTimeout(
        emailjs.sendForm(EMAILJS_SERVICE_ID, templateId, form),
        30000,
        'EmailJS'
      );

      // Éxito → mensaje + botón Aceptar que te lleva al PERFIL (ya hay sesión)
      const okMsg = successLabel || (form.dataset.success || '¡Envío realizado con éxito! 🐾');
      setStatus(okMsg + ' (correo enviado con adjuntos).', true);
      showOverlay(
        okMsg + ' En cuanto esté aceptada podrás generar tu perfil; te llegará un correo para crear tu acceso.',
        true
      );
      wireAcceptRedirect(getProfileUrl(), 'Ir a mi perfil'); // TPL: FIX — ahora etiqueta clara

      try{ form.reset(); }catch(_){}

    }catch(err){
      console.error(err);
      setStatus('No se pudo enviar. ' + (err && err.message ? err.message : ''), false);
      hideOverlay();
    }finally{
      if (submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Enviar'; }
    }
  }

  // ========= Inicialización por página =========
  document.addEventListener('DOMContentLoaded', function(){

    /* =========================
       TPL: PATCH VALIDACIÓN (CP + TEL) — añadido
       Fuerza patrones correctos aunque el HTML tenga \\d{5}, etc.
       ========================= */
    (function patchValidationHints(){
      const cp = q('tpl-cp');
      if (cp){
        cp.setAttribute('pattern', '[0-9]{5}');
        cp.setAttribute('inputmode', 'numeric');
        cp.setAttribute('maxlength', '5');
        if (!cp.getAttribute('title')) cp.setAttribute('title','Introduce 5 dígitos (España)');
        // Ayuda: solo dígitos y 5 máx
        cp.addEventListener('input', function(){
          this.value = this.value.replace(/\D/g,'').slice(0,5);
        });
      }
      const tel = q('tpl-telefono');
      if (tel){
        tel.setAttribute('pattern', '(\\+34\\s?)?([0-9]{3}\\s?){3}');
        tel.setAttribute('inputmode', 'tel');
        if (!tel.getAttribute('title')) tel.setAttribute('title','Ej.: 600123456 o +34 600123456');
        // Ayuda: solo +, dígitos y espacios
        tel.addEventListener('input', function(){
          this.value = this.value.replace(/[^0-9+ ]/g,'').replace(/\s{2,}/g,' ');
        });
        tel.addEventListener('blur', function(){
          this.value = this.value.trim();
        });
      }
    })();
    /* ===== FIN PATCH ===== */

    // --- CANDIDATURAS ---
    const formC = q('tpl-form-auxiliares');
    if (formC){
      formC.addEventListener('submit', function(ev){
        ev.preventDefault(); // Ignora cualquier action (Formspree u otro)
        handleEmailSend(
          formC,
          TEMPLATE_CANDIDATURAS,
          'Subiendo archivos y enviando tu candidatura…',
          'Tu candidatura está subida.'
        );
      });
    }

    // --- RESERVAS (si existe en esta página) ---
    const formR = q('tpl-form-reservas');
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
/* TPL: FIN BLOQUE NUEVO */
