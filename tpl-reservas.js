/* TPL: INICIO BLOQUE NUEVO [Hook de Auth para reservas.js — esperar sesión real] */
(function(){
  var ready = (window.__TPL_AUTH__ && window.__TPL_AUTH__.ready) ? window.__TPL_AUTH__.ready : Promise.resolve(null);

  // Expón un helper para que el resto de tu script use siempre el mismo user
  window.__TPL_GET_USER__ = function(){ return (window.__TPL_AUTH__ && window.__TPL_AUTH__.user) || null; };

  // Si tu lógica depende de user, arráncala aquí
  ready.then(function(user){
    // Marca global para otros módulos de reservas.js
    if (user) {
      window.__TPL_CURRENT_USER__ = user;
      try { window.dispatchEvent(new CustomEvent('tpl-auth-ready', { detail:{ user } })); } catch(_e){}
    } else {
      console.warn('[TPL][reservas] No hay sesión. El formulario queda deshabilitado hasta iniciar sesión.');
    }
    // 👉 A partir de aquí, continúa tu código existente (listeners, cálculos, EmailJS, etc.)
  });

  // Si en alguna parte de tu script tenías lecturas “en frío” de currentUser,
  // cámbialas por:  const user = window.__TPL_GET_USER__();
})();
/* TPL: FIN BLOQUE NUEVO */

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

  /* TPL: INICIO BLOQUE NUEVO [Helper: construir message_html a partir del formulario] */
  function buildHTMLFromForm(form){
    if (!form) return '';
    const fd = new FormData(form);
    const rows = [];
    const seen = new Set();
    fd.forEach((val, key)=>{
      if (seen.has(key)) return; seen.add(key);
      // buscar label
      const inputs = form.querySelectorAll(`[name="${(window.CSS && CSS.escape)?CSS.escape(key):key}"]`);
      let label = '';
      if (inputs[0] && inputs[0].id){
        const lab = form.querySelector(`label[for="${(window.CSS && CSS.escape)?CSS.escape(inputs[0].id):inputs[0].id}"]`);
        if (lab) label = lab.textContent.trim();
      }
      const prettyKey = label || key.replace(/[_-]+/g,' ').replace(/\b\w/g, c=>c.toUpperCase());
      const vals = fd.getAll(key).map(v => (v instanceof File) ? (v.name ? `Archivo: ${v.name}` : '') : String(v).trim()).filter(Boolean);
      const prettyVal = vals.join(', ');
      rows.push(`<tr><th align="left" style="padding:6px 8px;border-bottom:1px solid #eee">${prettyKey}</th><td style="padding:6px 8px;border-bottom:1px solid #eee">${prettyVal || '-'}</td></tr>`);
    });
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;line-height:1.45;color:#222">
        <p><strong>Nueva reserva desde The Pets Lovers</strong></p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${rows.join('')}</table>
      </div>
    `;
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ---------- EmailJS ----------
  /* TPL: INICIO BLOQUE NUEVO [Ajuste crítico: enviar subject + message_html + page_url] */
  async function sendEmailJS(fd, extra){
    if(!window.emailjs) return false;
    const cfg = window.TPL_EMAILJS || {};
    const service  = cfg.serviceId || cfg.service;
    const template = cfg.templateId || (cfg.templates && (cfg.templates.reserva || cfg.templates.booking));
    const pubKey   = cfg.publicKey || cfg.userId;
    if(!service || !template){ console.warn('EmailJS: falta serviceId/templateId'); return false; }

    // Construimos el payload base desde el form:
    const payload = Object.fromEntries(fd.entries());

    // Sujetos/HTML estándar que tu plantilla espera (como en el handler unificado):
    const form = document.getElementById('bookingForm');
    const message_html = buildHTMLFromForm(form);
    const subject = '[TPL] Nueva reserva';
    const page_url = location.href;

    Object.assign(payload, extra || {}, { subject, message_html, page_url });

    if (pubKey) { await emailjs.send(service, template, payload, pubKey); }
    else { await emailjs.send(service, template, payload); }
    return true;
  }
  /* TPL: FIN BLOQUE NUEVO */

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
    console.log('TPL reservas auth =>', { logged, user: user ? {uid:user.uid, email:user.email}:null });
    if(!logged) renderInlineLogin();
  }

  function attachAuthWall(){
    if (typeof firebase === 'undefined' || !firebase.auth) return;
    const auth = firebase.auth();

    // Eventos principales
    auth.onAuthStateChanged((u)=> setAuthUI(!!u && !u.isAnonymous, u || null));
    if (auth.onIdTokenChanged){
      auth.onIdTokenChanged((u)=> setAuthUI(!!u && !u.isAnonymous, u || null));
    }

    // Fallback: polling por si tarda en hidratar la sesión
    let tries = 0;
    const iv = setInterval(()=>{
      const u = auth.currentUser;
      if (u){ setAuthUI(!u.isAnonymous, u); clearInterval(iv); }
      if (++tries > 20){ clearInterval(iv); } // ~3s
    }, 150);
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

      const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
      const u = auth && auth.currentUser;
      if(!u || u.isAnonymous){ showErrorOverlay('Para enviar la reserva debes iniciar sesión.'); return; }

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
