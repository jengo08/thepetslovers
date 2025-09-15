/* TPL: INICIO BLOQUE NUEVO [Lógica reservas reforzada: login obligatorio + envío EmailJS + Firestore opcional] */
(function(){
  const $ = (id) => document.getElementById(id);

  // ---------- Overlays ----------
  function ensureOverlay(){
    let wrap = document.getElementById('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = '<div class="tpl-modal" role="dialog" aria-live="polite"><p></p><pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:200px;overflow:auto"></pre><button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button></div>';
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

  // ---------- EmailJS ----------
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

  // ---------- Firestore (opcional) ----------
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    const db = firebase.firestore();
    if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
    await db.collection('reservas').add(payload);
    return true;
  }

  // ---------- Login inline ----------
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
    if (typeof firebase !== 'undefined') {
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
          await auth.signInWithPopup(provider);
        }catch(err){ msg.textContent = err && err.message || 'No se pudo iniciar con Google.'; }
      });
    }
  }

  // ---------- Detección de sesión: robusta ----------
  function setAuthUI(logged, user){
    const form = $('bookingForm');
    const wall = $('authWall');
    if(form) form.classList.toggle('disabled', !logged);
    if(wall) wall.style.display = logged ? 'none' : 'block';
    console.log('TPL auth status =>', { logged, user: user ? {uid:user.uid, email:user.email}:null });
    if(!logged) renderInlineLogin();
  }

  /* TPL: INICIO BLOQUE NUEVO [Compat con NAVAR y orígenes: lectura de usuario global + listeners genéricos] */
  function getUserFromGlobals(){
    try{
      const candidates = [
        // Convenciones típicas de NAVBAR/APP
        window.TPL_USER,
        window.__TPL_USER,
        window.NAVAR_USER,
        window.__NAVAR_USER,
        window.APP_USER,
        window.appUser,
        window.currentUser,
        window.user
      ].filter(Boolean);
      if(!candidates.length) return null;
      const u = candidates[0];
      // Normalizamos un mínimo (solo usamos uid/email para UI y payload):
      return {
        uid: u.uid || u.id || u._id || u.uidUser || null,
        email: u.email || u.mail || null,
        displayName: u.displayName || u.name || null,
        _raw: u
      };
    }catch(_){ return null; }
  }

  // Espera a que Firebase esté listo (SDK + app inicializada)
  async function waitForFirebaseReady(timeoutMs=6000){
    const t0 = Date.now();
    while(Date.now() - t0 < timeoutMs){
      if (window.firebase && firebase.apps && firebase.apps.length > 0 && firebase.auth) return true;
      await new Promise(r=>setTimeout(r, 120));
    }
    return !!(window.firebase && firebase.auth);
  }

  // Rechequeo de sesión combinando Firebase + globales
  async function recheckAuthNow(){
    const hasFb = await waitForFirebaseReady(1); // no bloquear si no está
    const fbUser = (hasFb && firebase.auth) ? firebase.auth().currentUser : null;
    const glUser = getUserFromGlobals();
    // Mostramos UI como logueada si alguna de las dos fuentes nos da usuario.
    setAuthUI(!!(fbUser || glUser), fbUser || glUser);
  }

  // Suscribirse a señales globales comunes sin tocar NAVAR
  function subscribeToGlobalAuthSignals(){
    // Cambios en localStorage (p.ej. NAVAR guarda user; o Firebase actualiza claves)
    window.addEventListener('storage', (e)=>{
      try{
        if(!e || !e.key) return;
        // Cualquier cambio típico de auth dispara re-chequeo
        if (e.key.startsWith('firebase:authUser') || /user|auth|tpl/i.test(e.key)) {
          recheckAuthNow();
        }
      }catch(_){}
    });

    // Escucha eventos de app si existen (no rompemos si no existen)
    ['tpl:auth','tpl:auth-changed','nav:auth','auth:changed','user:changed'].forEach(ev=>{
      window.addEventListener(ev, recheckAuthNow, { passive:true });
    });

    // Primer tanteo desde global
    const glUser = getUserFromGlobals();
    if (glUser) setAuthUI(true, glUser);
  }
  /* TPL: FIN BLOQUE NUEVO */

  function attachAuthWall(){
    /* TPL: INICIO BLOQUE NUEVO [Arranque tolerante al orden de carga] */
    (async function boot(){
      subscribeToGlobalAuthSignals(); // por si el NAVAR ya tiene user
      const ready = await waitForFirebaseReady();
      if (!ready){
        console.warn('Firebase aún no listo; se usará detección global hasta hidratar.');
        recheckAuthNow();
        return;
      }
      /* TPL: FIN BLOQUE NUEVO */

      const auth = firebase.auth();

      // 1) Eventos principales
      auth.onAuthStateChanged((u)=> setAuthUI(!!u, u || null));
      auth.onIdTokenChanged((u)=> setAuthUI(!!u, u || null));

      // 2) Fallback: polling corto por si tarda en hidratar la sesión
      let tries = 0;
      const iv = setInterval(()=>{
        const u = auth.currentUser;
        if (u){ setAuthUI(true, u); clearInterval(iv); }
        if (++tries > 20){ clearInterval(iv); } // ~3s máximo (20 * 150ms)
      }, 150);

      // 3) Chequeo combinado (por si NAVAR ya puso el user global antes)
      recheckAuthNow();
    })();
  }

  // ---------- Resumen sencillo ----------
  function buildSummary(){
    const svcSel = $('service');
    const svcTxt = svcSel ? (svcSel.options[svcSel.selectedIndex]?.text || '') : '';
    return [
      `Servicio: ${svcTxt}`,
      `Fechas: ${$('startDate')?.value || '-'} a ${$('endDate')?.value || '-'}`,
      `Hora: ${$('start')?.value || '-'} a ${$('end')?.value || '-'}`,
      `Nombre: ${$('firstName')?.value || ''} ${$('lastName')?.value || ''}`,
      `Email/Tel: ${$('email')?.value || ''} / ${$('phone')?.value || ''}`
    ].join(' | ');
  }

  function validateRequired(){
    const ids = ['service','startDate','endDate','start','end','firstName','lastName','email','phone'];
    const missing = ids.filter(id => !String($(id)?.value||'').trim());
    return { ok: missing.length===0, missing };
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', function(){
    attachAuthWall();

    const form = $('bookingForm');
    if(!form) return;

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      const hasFb = await waitForFirebaseReady(2000);
      const auth = (hasFb && firebase.auth) ? firebase.auth() : null;

      // Preferimos usuario Firebase (reglas/seguridad). Si no, miramos global.
      let u = auth && auth.currentUser;
      if(!u){
        const g = getUserFromGlobals();
        if (g) {
          // Si solo existe usuario global, mostramos UI como logueada pero pedimos abrir sesión real si Firestore es obligatorio.
          console.warn('Sesión global detectada pero Firebase.currentUser es null. Es probable que el login esté en otro host/subdominio.');
          // Mostramos error para mantener el requisito de "logueo 100%" con Firebase:
          showErrorOverlay('Parece que tu sesión no está activa en este dominio. Inicia sesión aquí mismo (botón superior) y vuelve a intentarlo.');
          return;
        }
      }

      if(!u){
        showErrorOverlay('Para enviar la reserva debes iniciar sesión.');
        return;
      }

      const check = validateRequired();
      if(!check.ok){
        const first = $(check.missing[0]); if(first) first.focus();
        showErrorOverlay('Faltan campos obligatorios por completar.');
        return;
      }

      // Construye summary para el correo
      const summary = buildSummary();
      const summaryField = $('summaryField');
      if(summaryField) summaryField.value = summary;

      const fd = new FormData(form);
      const payload = Object.fromEntries(fd.entries());
      payload._tipo = 'reserva';
      payload._estado = 'enviada';
      payload._page = location.href;
      payload._uid = u.uid;
      payload._email = u.email || null;

      let emailOk = false, fsOk = false, lastErr = null;
      try{
        try{ fsOk = await saveToFirestore(payload); }catch(errFs){ fsOk = false; lastErr = errFs; }
        try{ emailOk = await sendEmailJS(fd, { _tipo:'reserva', _estado:'enviada', _page: location.href }); }
        catch(errMail){ emailOk = false; lastErr = errMail; }

        if (emailOk || fsOk){
          showSuccessOverlay(form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.', form.dataset.tplRedirect || 'perfil.html');
        } else {
          showErrorOverlay('No se pudo enviar la solicitud (correo/servidor). Revisa tu inicio de sesión y el origen permitido en EmailJS.', lastErr);
        }
      }catch(err){
        showErrorOverlay('Ocurrió un error inesperado al enviar la solicitud.', err);
      }
    });
  });
})();
/* TPL: FIN BLOQUE NUEVO */
