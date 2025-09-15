/* reservas.js — envío con EmailJS usando template_rao5n0c y to_email explícito
   Añadidos: autocompletar nombre/apellidos + copia al cliente + CP→Zona “caso por caso”
*/
(function(){
  'use strict';

  // ========= UTIL =========
  const $ = (id) => document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);

  const EJ = (function(){
    const cfg = window.TPL_EMAILJS || {};
    return {
      serviceId: cfg.serviceId || 'service_odjqrfl',
      templateId: cfg.templateId || 'template_rao5n0c',
      publicKey:  cfg.publicKey  || 'L2xAATfVuHJwj4EIV',
      toEmail:    cfg.toEmail    || 'gestion@thepetslovers.es',
      toName:     cfg.toName     || 'Gestión The Pets Lovers',
    };
  })();

  // ========= ZONAS POR CP (editable “caso por caso”) =========
  // Puedes definirlas en cualquier parte como window.TPL_CP_ZONES = [...]
  // y este script las usará. Si no existen, usa este array (vacío por defecto).
  const CP_ZONES = Array.isArray(window.TPL_CP_ZONES) ? window.TPL_CP_ZONES : [
    // { prefix:'28', code:'MAD', name:'Madrid' },
    // { prefix:'36', code:'PO',  name:'Pontevedra' },
    // { prefix:'15', code:'C',   name:'A Coruña' },
    // { prefix:'08', code:'BCN', name:'Barcelona' },
  ];

  // ========= OVERLAY =========
  function ensureOverlay(){
    let wrap = $('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = `
        <div class="tpl-modal" role="dialog" aria-live="polite">
          <p id="tpl-ov-text" style="margin:0 0 12px"></p>
          <pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:200px;overflow:auto"></pre>
          <button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button>
        </div>`;
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function showSuccessOverlay(msg, redirect){
    const wrap = ensureOverlay();
    q('#tpl-ov-text',wrap).textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    const det = q('#tpl-err-detail',wrap); det.style.display='none'; det.textContent='';
    wrap.classList.add('on');
    const btn = q('#tpl-ov-action',wrap);
    btn.textContent = 'Ir a mi perfil';
    btn.onclick = () => { location.href = redirect || 'perfil.html'; };
  }
  function showErrorOverlay(msg, detail){
    const wrap = ensureOverlay();
    q('#tpl-ov-text',wrap).textContent = msg || 'No se pudo enviar la solicitud.';
    const det = q('#tpl-err-detail',wrap);
    if (detail){ det.style.display='block'; det.textContent = String(detail); }
    else { det.style.display='none'; det.textContent=''; }
    wrap.classList.add('on');
    const btn = q('#tpl-ov-action',wrap);
    btn.textContent = 'Cerrar';
    btn.onclick = () => { wrap.classList.remove('on'); };
  }

  // ========= AUTOCOMPLETADO (Nombre/Apellidos/Email/Teléfono) =========
  function splitFullName(full){
    if (!full) return { nombre:'', apellidos:'' };
    const s = String(full).trim().replace(/\s+/g,' ');
    if (!s) return { nombre:'', apellidos:'' };
    const parts = s.split(' ');
    if (parts.length === 1) return { nombre: parts[0], apellidos: '' };
    return { nombre: parts[0], apellidos: parts.slice(1).join(' ') };
  }
  function setIfEmpty(input, val){ if (input && !input.value && val) input.value = val; }
  function udbKey(uid, key){ return 'tpl.udb.' + uid + '.' + key; }
  function udbGet(uid, key){
    try{ const raw = localStorage.getItem(udbKey(uid, key)); return raw ? JSON.parse(raw) : null; }catch(_){ return null; }
  }

  async function loadOwnerFromFirestore(uid){
    try{
      if (typeof firebase === 'undefined' || !firebase.firestore) return null;
      const db = firebase.firestore();
      const cols = ['owners','propietarios','profiles','usuarios'];
      for (let i=0;i<cols.length;i++){
        try{
          const snap = await db.collection(cols[i]).doc(uid).get();
          if (snap.exists) return snap.data() || null;
        }catch(_){}
      }
    }catch(_){}
    return null;
  }

  function fillFromOwner(owner){
    if (!owner) return;
    let n = owner.nombre || owner.name || owner.nombreCompleto || owner.fullName || '';
    let a = owner.apellidos || owner.surnames || '';
    if (!a && n && (n.includes(' ') || /,/.test(n))) {
      const sp = splitFullName(n); n = sp.nombre; a = sp.apellidos;
    }
    setIfEmpty($('firstName'), n || '');
    setIfEmpty($('lastName'),  a || '');
    setIfEmpty($('email'),     owner.email || '');
    setIfEmpty($('phone'),     owner.telefono || owner.phone || '');
  }

  function onAuthReady(cb){
    try{
      if (!firebase || !firebase.auth) { cb(null); return; }
      const auth = firebase.auth();
      let first = true;
      const handle = (user)=>{ if (first){ first=false; cb(user||null); } };
      if (auth.currentUser){ handle(auth.currentUser); }
      auth.onAuthStateChanged(handle);
    }catch(_){ cb(null); }
  }

  function bootstrapAutocomplete(){
    onAuthReady(async (user)=>{
      try{
        const uid = user && user.uid;
        // 1) UDB local
        if (uid){
          const owner = udbGet(uid, 'owner') || udbGet(uid, 'propietario');
          if (owner) fillFromOwner(owner);
        }
        // 2) Firebase Auth
        if (user){
          if (user.email) setIfEmpty($('email'), user.email);
          const sp = splitFullName(user.displayName || '');
          if (sp.nombre || sp.apellidos){
            setIfEmpty($('firstName'), sp.nombre);
            setIfEmpty($('lastName'),  sp.apellidos);
          }
        }
        // 3) Firestore (fallback si siguen vacíos)
        if (uid && (!$('firstName')?.value || !$('lastName')?.value || !$('email')?.value || !$('phone')?.value)){
          const fsOwner = await loadOwnerFromFirestore(uid);
          if (fsOwner) fillFromOwner(fsOwner);
        }
      }catch(_){}
      // Sincroniza hidden de reply-to si existe
      const hid = $('tpl-replyto');
      const email = $('email');
      if (hid && email){
        if (!hid.value && email.value) hid.value = email.value;
        email.addEventListener('input', ()=>{ hid.value = email.value || ''; });
      }
    });
  }

  // ========= CP → Zona =========
  function ensureZoneHiddens(){
    // Si los hidden no existen en el HTML, los creo sin romper nada.
    if (!$('tpl-zone-code')){
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = 'Zona_codigo'; input.id = 'tpl-zone-code';
      q('#bookingForm')?.appendChild(input);
    }
    if (!$('tpl-zone-name')){
      const input = document.createElement('input');
      input.type = 'hidden'; input.name = 'Zona_nombre'; input.id = 'tpl-zone-name';
      q('#bookingForm')?.appendChild(input);
    }
  }
  function zoneForCP(cp){
    cp = (cp||'').trim();
    if (!/^[0-9]{5}$/.test(cp)) return null;
    const p3 = cp.slice(0,3), p2 = cp.slice(0,2);
    return CP_ZONES.find(z=>z.prefix===p3) || CP_ZONES.find(z=>z.prefix===p2) || null;
  }
  function setupCPZone(){
    const cp = $('postalCode');
    if (!cp) return;
    ensureZoneHiddens();

    const sanitize = ()=>{ const v = (cp.value||'').replace(/\D+/g,'').slice(0,5); if (v!==cp.value) cp.value = v; };
    const sync = ()=>{
      const z = zoneForCP(cp.value);
      $('tpl-zone-code').value = z ? z.code : '';
      $('tpl-zone-name').value = z ? z.name : '';
    };
    const updateSummaryExtras = ()=>{
      // No sobreescribo el resto, solo añado/actualizo CP/Zona en el desglose si existe
      const sum = $('summaryField'); if (!sum) return;
      const parts = (sum.value || '').split(' • ').filter(Boolean);
      const filtered = parts.filter(p=> !/^CP:/i.test(p) && !/^Zona:/i.test(p));
      const extras = [];
      if (cp.value) extras.push('CP: '+cp.value);
      const zc = $('tpl-zone-code')?.value || ''; const zn = $('tpl-zone-name')?.value || '';
      if (zc || zn) extras.push('Zona: ' + (zc ? (zc + (zn ? ' - '+zn : '')) : zn));
      sum.value = filtered.concat(extras).join(' • ').trim();
    };

    cp.addEventListener('input', ()=>{ sanitize(); sync(); updateSummaryExtras(); });
    cp.addEventListener('blur',  ()=>{ sanitize(); sync(); updateSummaryExtras(); });
    // Primera sync
    sanitize(); sync(); updateSummaryExtras();
  }

  // ========= BUILDERS =========
  function serviceLabel(){
    const s = $('service');
    if (!s) return '';
    const opt = s.options[s.selectedIndex];
    return (opt && opt.text) ? opt.text.trim() : '';
  }
  function currentPetText(){
    const name  = $('tpl-pet-name')?.value || '';
    const spec  = $('tpl-pet-species')?.value || '';
    const breed = $('tpl-pet-breed')?.value || '';
    const bits = [];
    if (name) bits.push(name);
    const meta = [spec, breed].filter(Boolean).join(', ');
    if (meta) bits.push('('+meta+')');
    return bits.join(' ');
  }
  function buildSummary(){
    const parts = [];
    parts.push(`Servicio: ${serviceLabel() || '-'}`);
    parts.push(`Fechas: ${$('startDate')?.value || '-'} a ${$('endDate')?.value || '-'}`);
    parts.push(`Hora: ${$('start')?.value || '-'} a ${$('end')?.value || '-'}`);
    const pet = currentPetText(); if (pet) parts.push(`Mascota: ${pet}`);
    if ($('postalCode')?.value) parts.push(`CP: ${$('postalCode').value}`);
    const zc = $('tpl-zone-code')?.value || ''; const zn = $('tpl-zone-name')?.value || '';
    if (zc || zn) parts.push('Zona: ' + (zc ? (zc + (zn ? ' - '+zn : '')) : zn));
    parts.push(`Nombre: ${$('firstName')?.value || ''} ${$('lastName')?.value || ''}`);
    parts.push(`Email/Tel: ${$('email')?.value || ''} / ${$('phone')?.value || ''}`);
    if ($('notes')?.value) parts.push(`Notas: ${$('notes').value}`);
    return parts.join(' • ');
  }
  function buildHtmlTable(fd){
    // Muestro TODOS los campos (menos Desglose) tal cual, para que también viajen las Mascota_* y Zona_*
    const nice = {
      Servicio:'Servicio', Fecha_inicio:'Fecha inicio', Fecha_fin:'Fecha fin',
      Hora_inicio:'Hora inicio', Hora_fin:'Hora fin',
      Nombre:'Nombre', Apellidos:'Apellidos', Email:'Email', Telefono:'Teléfono',
      CP:'Código Postal', Notas:'Notas',
      Mascota_nombre:'Mascota — nombre', Mascota_especie:'Mascota — especie', Mascota_raza:'Mascota — raza', Mascota_tamano:'Mascota — tamaño', Mascota_medicacion:'Mascota — medicación', Mascota_necesidades:'Mascota — necesidades',
      Zona_codigo:'Zona — código', Zona_nombre:'Zona — nombre'
    };
    const rows = [];
    for (const [k,v] of fd.entries()){
      if (k === 'Desglose') continue;
      const label = nice[k] || k.replace(/[_-]+/g,' ');
      rows.push(
        `<tr>
           <th align="left" style="padding:6px 8px;border-bottom:1px solid #eee">${label}</th>
           <td style="padding:6px 8px;border-bottom:1px solid #eee">${String(v||'-')}</td>
         </tr>`
      );
    }
    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;line-height:1.45;color:#222">
        <p><strong>Nueva reserva — The Pets Lovers</strong></p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">
          ${rows.join('')}
        </table>
      </div>`;
  }

  // ========= EMAILJS =========
  async function ensureEmailJS(){
    if (window.emailjs && window.emailjs.send) return window.emailjs;
    await new Promise((res,rej)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload = res; s.onerror = ()=>rej(new Error('No se pudo cargar EmailJS'));
      document.head.appendChild(s);
    });
    return window.emailjs;
  }

  async function sendBookingWithEmailJS(form){
    const fd = new FormData(form);

    // Desglose para email
    const summary = buildSummary();
    const summaryField = $('summaryField');
    if (summaryField) summaryField.value = summary;
    fd.set('Desglose', summary);

    // Aseguro hidden reply_to si existe
    const reply = $('tpl-replyto')?.value || $('email')?.value || '';

    // Payload para la plantilla (incluye CP, Zona, Mascota_* si están)
    const payload = Object.fromEntries(fd.entries());
    Object.assign(payload, {
      to_email: EJ.toEmail,               // ← evita 422 (admin)
      to_name:  EJ.toName,
      reply_to: reply,
      from_name: `${$('firstName')?.value||''} ${$('lastName')?.value||''}`.trim(),
      subject: 'Nueva reserva — The Pets Lovers',
      service_label: serviceLabel(),
      page_url: location.href,
      message_html: buildHtmlTable(fd)
    });

    const emailjs = await ensureEmailJS();
    try { emailjs.init({ publicKey: EJ.publicKey }); } catch(_){}

    // Envío principal (admin)
    const res = await emailjs.send(EJ.serviceId, EJ.templateId, payload, EJ.publicKey);

    // Envío copia al cliente (si hay email cliente)
    const clientEmail = reply.trim();
    if (clientEmail){
      const nombre  = ($('firstName')?.value || '').trim();
      const apes    = ($('lastName')?.value  || '').trim();
      const htmlCopy = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;line-height:1.45;color:#222">
          <p>Hola ${nombre} ${apes},</p>
          <p>Hemos recibido tu solicitud de reserva en <strong>The Pets Lovers</strong>. Este es el resumen:</p>
          <p style="margin:.5em 0 1em">${summary || '—'}</p>
          <p>Te contactaremos lo antes posible. Si necesitas cambiar algo, responde a este correo.</p>
          <p style="margin-top:1.2em;color:#666">Gracias por confiar en profesionales del sector veterinario.</p>
        </div>`;
      const copyVars = Object.assign({}, payload, {
        to_email: clientEmail, // ← tu plantilla debe usar {{to_email}} en “To email”
        to_name:  `${nombre} ${apes}`.trim(),
        subject:  '[The Pets Lovers] Copia de tu solicitud de reserva',
        message_html: htmlCopy
      });
      try { await emailjs.send(EJ.serviceId, EJ.templateId, copyVars, EJ.publicKey); } catch(_e){}
    }

    return res;
  }

  // ========= FIRESTORE opcional =========
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    try{
      const db = firebase.firestore();
      if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('reservas').add(payload);
      return true;
    }catch(_){ return false; }
  }

  // ========= AUTH check =========
  function isLogged(){
    try{
      const a = firebase && firebase.auth && firebase.auth();
      const u = a && a.currentUser;
      return !!(u && !u.isAnonymous);
    }catch(_){ return false; }
  }

  // ========= INIT =========
  function attach(){
    const form = $('bookingForm');
    if (!form) return;

    // IMPORTANTÍSIMO: evitar el handler del navbar
    form.setAttribute('data-tpl-emailjs','false');

    // Autocompletado (Nombre/Apellidos/Email/Teléfono) y CP→Zona
    bootstrapAutocomplete();
    setupCPZone();

    form.addEventListener('submit', async function(e){
      e.preventDefault();

      if (typeof form.reportValidity === 'function' && !form.reportValidity()){
        return;
      }
      if (!isLogged()){
        showErrorOverlay('Para enviar la reserva debes iniciar sesión.');
        return;
      }

      const btn = form.querySelector('button[type="submit"], .cta-button');
      const old = btn ? btn.textContent : '';
      if (btn){ btn.disabled = true; btn.textContent = 'Enviando…'; }

      // Para log / Firestore
      const fd = new FormData(form);
      const payloadForDb = Object.fromEntries(fd.entries());
      payloadForDb._tipo = 'reserva';
      payloadForDb._estado = 'enviada';
      payloadForDb._page = location.href;

      try{
        try{ await saveToFirestore(payloadForDb); }catch(_){}
        await sendBookingWithEmailJS(form);

        showSuccessOverlay(
          form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.',
          form.dataset.tplRedirect || 'perfil.html'
        );
        try{ form.reset(); }catch(_){}
      }catch(err){
        console.error('Reservas EmailJS error:', err);
        const msg = (err && err.text) || (err && err.message) || 'No se pudo enviar la solicitud (correo/servidor).';
        showErrorOverlay(msg, JSON.stringify(err, null, 2));
      }finally{
        if (btn){ btn.disabled = false; btn.textContent = old; }
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();
})();
