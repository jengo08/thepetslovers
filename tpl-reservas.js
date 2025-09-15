/* TPL: RESERVAS — login obligatorio + EmailJS + Firestore opcional
   - Habilita UI con señal del NAVBAR (localStorage + evento 'tpl-auth-change')
   - Exige usuario Firebase real para ENVIAR
   - EmailJS configurable vía window.TPL_EMAILJS { serviceId, templateId, publicKey }
*/

(function(){
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ===========================
     Overlays (éxito / error)
     =========================== */
  function ensureOverlay(){
    let wrap = document.getElementById('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = `
        <div class="tpl-modal" role="dialog" aria-live="polite">
          <p></p>
          <pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:200px;overflow:auto"></pre>
          <button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button>
        </div>`;
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function showSuccessOverlay(msg, redirect){
    const wrap = ensureOverlay();
    wrap.querySelector('p').textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    const det = wrap.querySelector('#tpl-err-detail'); det.style.display='none'; det.textContent='';
    wrap.classList.add('on');
    const btn = wrap.querySelector('#tpl-ov-action');
    btn.textContent = 'Ir a mi perfil';
    btn.onclick = () => { location.href = redirect || 'perfil.html'; };
  }
  function showErrorOverlay(msg, detail){
    const wrap = ensureOverlay();
    wrap.querySelector('p').textContent = msg || 'No se pudo enviar la solicitud.';
    const det = wrap.querySelector('#tpl-err-detail');
    if(detail){ det.style.display='block'; det.textContent = formatError(detail); } else { det.style.display='none'; det.textContent=''; }
    wrap.classList.add('on');
    const btn = wrap.querySelector('#tpl-ov-action');
    btn.textContent = 'Cerrar';
    btn.onclick = () => { wrap.classList.remove('on'); };
  }
  function formatError(e){
    try{
      if(!e) return '';
      if (typeof e === 'string') return e;
      if (e.code || e.message) return (e.code?`[${e.code}] `:'') + (e.message||'');
      return JSON.stringify(e, null, 2);
    }catch(_){ return String(e||''); }
  }

  /* ===========================
     EmailJS
     =========================== */
  async function sendEmailJS(fd, extra){
    if(!window.emailjs) return false;
    const cfg = window.TPL_EMAILJS || {};
    const service  = cfg.serviceId || cfg.service;
    const template = cfg.templateId || (cfg.templates && (cfg.templates.reserva || cfg.templates.booking));
    const pubKey   = cfg.publicKey || cfg.userId;
    if(!service || !template){ console.warn('EmailJS: falta serviceId/templateId'); return false; }
    const payload = Object.fromEntries(fd.entries());
    Object.assign(payload, extra || {});
    if (pubKey) { await emailjs.send(service, template, payload, pubKey); }
    else { await emailjs.send(service, template, payload); }
    return true;
  }

  /* ===========================
     Firestore (opcional)
     =========================== */
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    const db = firebase.firestore();
    if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('reservas').add(payload);
    return true;
  }

  /* ===========================
     Inline login (muro)
     =========================== */
  function renderInlineLogin(){
    const host = $('tpl-inline-login'); if(!host) return;
    if (host.dataset.rendered === '1') return; // evitar duplicados
    host.dataset.rendered = '1';
    host.innerHTML = `
      <form id="tpl-login-form" class="tpl-login-form" style="display:grid;gap:8px;max-width:420px;margin:10px auto 0">
        <input type="email" name="email" placeholder="Email" required autocomplete="email" style="padding:10px 12px;border:1px solid #ddd;border-radius:10px">
        <input type="password" name="password" placeholder="Contraseña" required autocomplete="current-password" style="padding:10px 12px;border:1px solid #ddd;border-radius:10px">
        <button type="submit" class="tpl-btn">Iniciar sesión</button>
        <button type="button" id="tpl-google" class="tpl-btn-outline">Continuar con Google</button>
        <div id="tpl-login-msg" style="text-align:center;color:#58425a;min-height:1.2em"></div>
      </form>
    `;
    const form = $('tpl-login-form');
    const msg  = $('tpl-login-msg');
    const btnG = $('tpl-google');
    if (typeof firebase !== 'undefined' && firebase.auth) {
      const auth = firebase.auth();
      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        msg.textContent = 'Accediendo…';
        try{
          await auth.signInWithEmailAndPassword(form.email.value.trim(), form.password.value);
          msg.textContent = '¡Listo!'; location.reload();
        }catch(err){ msg.textContent = err && err.message || 'No se pudo iniciar sesión.'; }
      });
      btnG.addEventListener('click', async ()=>{
        msg.textContent = 'Conectando con Google…';
        try{
          const provider = new firebase.auth.GoogleAuthProvider();
          // iOS Safari suele requerir redirect
          const isIOS = /iP(ad|hone|od)/i.test(navigator.userAgent);
          const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
          if (isIOS && isSafari) await auth.signInWithRedirect(provider);
          else await auth.signInWithPopup(provider);
        }catch(err){ msg.textContent = err && err.message || 'No se pudo iniciar con Google.'; }
      });
    }
  }

  /* ===========================
     Puente con NAVBAR (señal rápida)
     =========================== */
  function getUserFromNavbarStorage(){
    try{
      const email = localStorage.getItem('tpl_auth_email');
      const uid   = localStorage.getItem('tpl_auth_uid');
      if (email || uid) return { uid: uid || null, email: email || null, displayName: null, _from:'navbarStorage' };
    }catch(_){}
    return null;
  }

  /* ===========================
     UI: muro / formulario
     =========================== */
  function setAuthUI(logged, user){
    const form = $('bookingForm');
    const wall = $('authWall');
    if(form) form.classList.toggle('disabled', !logged);
    if(wall) wall.style.display = logged ? 'none' : 'block';
    if(!logged) renderInlineLogin();
    // Log útil en consola
    console.log('TPL reservas auth =>', { logged, from: user && user._from || (user?'firebase':'none'), uid: user && user.uid, email: user && user.email });
  }

  /* ===========================
     Firebase: esperar/hidratar
     =========================== */
  async function waitForFirebaseReady(waitMs){
    if (typeof firebase === 'undefined' || !firebase.auth) return false;
    const auth = firebase.auth();
    if (auth.currentUser) return true;
    const ms = Math.max(0, waitMs|0);
    if (!ms) return !!auth.currentUser;
    return await new Promise((resolve)=>{
      let done = false;
      const to = setTimeout(()=>{ if(!done){ done = true; resolve(!!auth.currentUser); } }, ms);
      auth.onAuthStateChanged(()=>{ if(!done){ done = true; clearTimeout(to); resolve(!!auth.currentUser); } });
    });
  }

  async function attachFirebaseAuthUI(){
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    const auth = firebase.auth();

    // Estado inicial
    setAuthUI(!!auth.currentUser, auth.currentUser || null);

    // Cambios de sesión
    auth.onAuthStateChanged((u)=> setAuthUI(!!u, u || null));
    if (auth.onIdTokenChanged) auth.onIdTokenChanged((u)=> setAuthUI(!!u, u || null));

    // Fallback: por si tarda en hidratar
    let tries = 0;
    const iv = setInterval(()=>{
      const u = auth.currentUser;
      if (u){ setAuthUI(true, u); clearInterval(iv); }
      if (++tries > 20){ clearInterval(iv); }
    }, 150);
  }

  /* ===========================
     Escuchar señales del NAVBAR
     =========================== */
  function subscribeToNavbarSignals(){
    // Evento oficial del NAVBAR
    window.addEventListener('tpl-auth-change', ()=> recheckAuthNow(), { passive:true });

    // Cambios en localStorage
    window.addEventListener('storage', (e)=>{
      if (!e || !e.key) return;
      if (e.key === 'tpl_auth_email' || e.key === 'tpl_auth_uid') recheckAuthNow();
    });

    // Pintado inmediato si ya hay datos del NAVBAR
    const nbUser = getUserFromNavbarStorage();
    if (nbUser) setAuthUI(true, nbUser);
  }

  async function recheckAuthNow(){
    let fbUser = null;
    if (await waitForFirebaseReady(1) && typeof firebase !== 'undefined' && firebase.auth){
      fbUser = firebase.auth().currentUser || null;
    }
    const nbUser = getUserFromNavbarStorage();
    const any = fbUser || nbUser || null;
    setAuthUI(!!any, any);
  }

  /* ===========================
     Desglose simple para Email
     =========================== */
  function buildSummary(){
    const svcSel = $('service');
    const svcTxt = svcSel ? (svcSel.options[svcSel.selectedIndex]?.text || '') : '';
    return [
      `Servicio: ${svcTxt}`,
      `Fechas: ${$('startDate')?.value || '-'} a ${$('endDate')?.value || '-'}`,
      `Hora: ${$('start')?.value || '-'} a ${$('end')?.value || '-'}`,
      `Nombre: ${$('firstName')?.value || ''} ${$('lastName')?.value || ''}`,
      `Email/Tel: ${$('email')?.value || ''} / ${$('phone')?.value || ''}`,
      `Notas: ${$('notes')?.value || ''}`
    ].join(' | ');
  }

  function validateRequired(){
    const ids = ['service','startDate','endDate','start','end','firstName','lastName','email','phone'];
    const missing = ids.filter(id => !String($(id)?.value||'').trim());
    return { ok: missing.length===0, missing };
  }

  /* ===========================
     INIT
     =========================== */
  document.addEventListener('DOMContentLoaded', function(){
    // 1) Escuchamos NAVBAR inmediatamente (pinta al vuelo el estado logueado)
    subscribeToNavbarSignals();

    // 2) Si Firebase está cargado en la página, también nos suscribimos
    attachFirebaseAuthUI();

    const form = $('bookingForm');
    if(!form) return;

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      // Valida HTML nativo (pattern, required, etc.)
      if (typeof form.reportValidity === 'function' && !form.reportValidity()){
        return;
      }

      // Anti-doble-submit
      const submitBtn = form.querySelector('button[type="submit"]');
      if(submitBtn){ submitBtn.disabled = true; submitBtn.setAttribute('aria-busy','true'); }

      try{
        // ===== Exigir sesión real en Firebase =====
        const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
        let u = auth && auth.currentUser;

        // Si el NAVBAR ya marcó sesión, damos un margen para que Firebase hidrate
        if (!u && getUserFromNavbarStorage()){
          try{
            const t0 = Date.now();
            while(Date.now()-t0 < 2000){
              if (auth && auth.currentUser){ u = auth.currentUser; break; }
              await new Promise(r=>setTimeout(r,150));
            }
          }catch(_){}
        }

        if(!u){
          showErrorOverlay('Para enviar la reserva debes iniciar sesión.');
          return;
        }

        // Validación de campos obligatorios
        const check = validateRequired();
        if(!check.ok){
          const first = $(check.missing[0]); if(first) first.focus();
          showErrorOverlay('Faltan campos obligatorios por completar.');
          return;
        }

        // Preparar resumen para el correo
        const summary = buildSummary();
        const summaryField = $('summaryField');
        if(summaryField) summaryField.value = summary;

        // Payload base (para Firestore)
        const fd = new FormData(form);
        const payload = Object.fromEntries(fd.entries());
        payload._tipo = 'reserva';
        payload._estado = 'enviada';
        payload._page = location.href;
        payload._uid = u.uid;
        payload._email = u.email || null;

        let emailOk = false, fsOk = false, lastErr = null;

        // Guardar en Firestore (opcional) — no bloquea el éxito global si falla
        try{ fsOk = await saveToFirestore(payload); }catch(errFs){ fsOk = false; lastErr = errFs; }

        // EmailJS (debe estar correctamente configurado)
        try{
          emailOk = await sendEmailJS(fd, { _tipo:'reserva', _estado:'enviada', _page: location.href });
        } catch(errMail){ emailOk = false; lastErr = errMail; }

        if (emailOk || fsOk){
          showSuccessOverlay(form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.', form.dataset.tplRedirect || 'perfil.html');
          try{ form.reset(); }catch(_){}
        } else {
          showErrorOverlay('No se pudo enviar la solicitud (correo/servidor). Revisa el inicio de sesión y la configuración de EmailJS.', lastErr);
        }

      }catch(err){
        showErrorOverlay('Ocurrió un error inesperado al enviar la solicitud.', err);
      }finally{
        if(submitBtn){ submitBtn.disabled = false; submitBtn.removeAttribute('aria-busy'); }
      }
    });
  });

})();
