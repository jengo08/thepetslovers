/* reservas.js — envío con EmailJS usando template_rao5n0c y to_email explícito */
(function(){
  'use strict';

  // ========= UTIL =========
  const $id = (id) => document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);

  /* TPL: INICIO BLOQUE NUEVO [Split nombre/apellidos + helpers UDB] */
  function splitSmart(text){
    if (!text) return {nombre:'', apellidos:''};
    let s = String(text).trim().replace(/\s+/g,' ');
    if (s.includes(',')){
      const a = s.split(',');
      return { nombre:(a.slice(1).join(',')||'').trim(), apellidos:(a[0]||'').trim() };
    }
    const parts = s.split(' ');
    if (parts.length === 1) return { nombre: parts[0], apellidos: '' };
    return { nombre: parts[0], apellidos: parts.slice(1).join(' ') };
  }
  function setIfEmpty(el,val){ if(el && !el.value && val) el.value = val; }
  function udbKey(uid, key){ return 'tpl.udb.' + uid + '.' + key; }
  function udbGet(uid, key){
    try{ const raw = localStorage.getItem(udbKey(uid, key)); return raw ? JSON.parse(raw) : null; }catch(_){ return null; }
  }
  function udbSet(uid, key, val){
    try{ localStorage.setItem(udbKey(uid, key), JSON.stringify(val)); }catch(_){}
  }
  function toArrayMaybe(objOrArr){
    if (!objOrArr) return [];
    return Array.isArray(objOrArr) ? objOrArr : Object.keys(objOrArr).map(k => Object.assign({id:k}, objOrArr[k]));
  }
  function normalizePet(p){
    if (!p) return null;
    const id  = p.id || p.uid || p._id || p.chip || p.chipid || p.microchip || null;
    const nombre = p.nombre || p.name || p.petName || '';
    const especie = p.especie || p.tipo || p.species || p.type || '';
    const raza = p.raza || p.breed || '';
    const tam = p.tamano || p['tamaño'] || p.size || '';
    const meds = p.medicacion || p['medicación'] || p.medication || '';
    const needs = p.necesidades || p.needs || p.specialNeeds || '';
    return { id, nombre, especie, raza, tamano: tam, medicacion: meds, necesidades: needs };
  }
  /* TPL: FIN BLOQUE NUEVO */

  // Config EmailJS (lee tu objeto global y da defaults)
  const EJ = (function(){
    const cfg = window.TPL_EMAILJS || {};
    return {
      serviceId: cfg.serviceId || 'service_odjqrfl',
      templateId: cfg.templateId || 'template_rao5n0c',
      publicKey:  cfg.publicKey  || 'L2xAATfVuHJwj4EIV',
      toEmail:    cfg.toEmail    || 'gestion@thepetslovers.es',  // ← destinatario por defecto
      toName:     cfg.toName     || 'Gestión The Pets Lovers',
    };
  })();

  // ========= OVERLAY =========
  function ensureOverlay(){
    let wrap = $id('tpl-overlay');
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

  // ========= BUILDERS =========
  function serviceLabel(){
    const s = $id('service');
    if (!s) return '';
    const opt = s.options[s.selectedIndex];
    return (opt && opt.text) ? opt.text.trim() : '';
  }

  /* TPL: INICIO BLOQUE NUEVO [Texto mascota a partir de hidden] */
  function currentPetText(){
    const name  = $id('tpl-pet-name')?.value || '';
    const spec  = $id('tpl-pet-species')?.value || '';
    const breed = $id('tpl-pet-breed')?.value || '';
    const bits = [];
    if (name) bits.push(name);
    const meta = [spec, breed].filter(Boolean).join(', ');
    if (meta) bits.push('(' + meta + ')');
    return bits.join(' ');
  }
  /* TPL: FIN BLOQUE NUEVO */

  function buildSummary(){
    const sd = $id('startDate')?.value || '';
    const ed = $id('endDate')?.value || '';
    const st = $id('start')?.value || '';
    const et = $id('end')?.value || '';
    const svc = serviceLabel();
    const pet = currentPetText();

    const parts = [];
    if (svc) parts.push(`Servicio: ${svc}`);
    parts.push(`Fechas: ${sd || '-'} a ${ed || '-'}`);
    parts.push(`Hora: ${st || '-'} a ${et || '-'}`);
    parts.push(`Nombre: ${$id('firstName')?.value || ''} ${$id('lastName')?.value || ''}`);
    parts.push(`Email/Tel: ${$id('email')?.value || ''} / ${$id('phone')?.value || ''}`);
    if (pet) parts.push(`Mascota: ${pet}`);

    // TPL: añadir CP/Zona si existen
    const cp = $id('postalCode')?.value || '';
    const zc = $id('tpl-zone-code')?.value || '';
    const zn = $id('tpl-zone-name')?.value || '';
    if (cp) parts.push(`CP: ${cp}`);
    if (zc || zn) parts.push(`Zona: ${zc}${(zc && zn) ? ' - ' : ''}${zn}`);

    return parts.join(' | ');
  }

  function buildHtmlTable(fd){
    const map = {
      Servicio:'Servicio', Fecha_inicio:'Fecha inicio', Fecha_fin:'Fecha fin',
      Hora_inicio:'Hora inicio', Hora_fin:'Hora fin',
      Nombre:'Nombre', Apellidos:'Apellidos', Email:'Email', Telefono:'Teléfono', Notas:'Notas',
      CP:'Código Postal', Zona_codigo:'Zona (código)', Zona_nombre:'Zona (nombre)',
      Mascota:'Mascota',
      Mascota_nombre:'Mascota · nombre', Mascota_especie:'Mascota · especie',
      Mascota_raza:'Mascota · raza', Mascota_tamano:'Mascota · tamaño',
      Mascota_medicacion:'Mascota · medicación', Mascota_necesidades:'Mascota · necesidades',
      Mascota_id:'Mascota · id'
    };
    const rows = [];
    for (const [k,v] of fd.entries()){
      if (k === 'Desglose') continue;
      const label = map[k] || k.replace(/[_-]+/g,' ');
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

    /* TPL: INICIO BLOQUE NUEVO [Normalizar nombre/apellidos antes del resumen] */
    const f = $id('firstName'), l = $id('lastName');
    if (f && (!l || !l.value || /\s/.test(f.value||''))){
      const s = splitSmart(f.value);
      if (s.nombre) f.value = s.nombre;
      if (s.apellidos && (!l || !l.value)) l && (l.value = s.apellidos);
    }
    /* TPL: FIN BLOQUE NUEVO */

    // Desglose para email
    const summary = buildSummary();
    const summaryField = $id('summaryField');
    if (summaryField) summaryField.value = summary;
    fd.set('Desglose', summary);

    // Payload base con TODOS los campos del form
    const payload = Object.fromEntries(fd.entries());

    // TPL: campos útiles extra para la plantilla
    Object.assign(payload, {
      to_email: EJ.toEmail,               // ← evita 422
      to_name:  EJ.toName,
      reply_to: $id('email')?.value || payload.Email || '',
      from_name: `${$id('firstName')?.value||''} ${$id('lastName')?.value||''}`.trim(),
      subject: 'Nueva reserva — The Pets Lovers',
      service_label: serviceLabel(),
      page_url: location.href,
      message_html: buildHtmlTable(fd),
      // espejo explícito CP/Zona (por si tu template usa estas keys)
      cp: $id('postalCode')?.value || payload.CP || '',
      zona_code: $id('tpl-zone-code')?.value || payload.Zona_codigo || '',
      zona_name: $id('tpl-zone-name')?.value || payload.Zona_nombre || '',
      user_uid: $id('tpl-uid')?.value || ''
    });

    const emailjs = await ensureEmailJS();
    try { emailjs.init({ publicKey: EJ.publicKey }); } catch(_){}

    // Enviar con .send (no sendForm), pasando el payload completo
    return await emailjs.send(EJ.serviceId, EJ.templateId, payload, EJ.publicKey);
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

  /* TPL: INICIO BLOQUE NUEVO [Cargar mascotas de Firestore si no están en UDB] */
  async function loadPetsFromFirestore(uid){
    const list = [];
    try{
      if (typeof firebase === 'undefined' || !firebase.firestore) return list;
      const db = firebase.firestore();
      const profileCols = ['owners','propietarios','profiles','usuarios'];

      for (let i=0;i<profileCols.length;i++){
        const col = profileCols[i];
        try{
          const docRef = db.collection(col).doc(uid);
          // subcolecciones
          const sub1 = await docRef.collection('mascotas').get().catch(()=>null);
          if (sub1 && !sub1.empty){ sub1.forEach(d => list.push(Object.assign({id:d.id}, d.data()))); }
          const sub2 = await docRef.collection('pets').get().catch(()=>null);
          if (sub2 && !sub2.empty){ sub2.forEach(d => list.push(Object.assign({id:d.id}, d.data()))); }
          // arrays en el doc
          const main = await docRef.get().catch(()=>null);
          if (main && main.exists){
            const data = main.data() || {};
            toArrayMaybe(data.mascotas).forEach(p => list.push(p));
            toArrayMaybe(data.pets).forEach(p => list.push(p));
          }
          if (list.length) break;
        }catch(_){}
      }

      // Fallback colección raíz 'mascotas'
      if (!list.length){
        const q1 = await db.collection('mascotas').where('ownerUid','==',uid).get().catch(()=>null);
        if (q1 && !q1.empty){ q1.forEach(d => list.push(Object.assign({id:d.id}, d.data()))); }
      }
      if (!list.length){
        const q2 = await db.collection('mascotas').where('uid','==',uid).get().catch(()=>null);
        if (q2 && !q2.empty){ q2.forEach(d => list.push(Object.assign({id:d.id}, d.data()))); }
      }
    }catch(_){}
    return list.map(normalizePet).filter(Boolean);
  }
  function renderPets(uid, pets){
    const sec = $id('tpl-pet-section');
    const sel = $id('tpl-pet-select');
    const list = (pets||[]).map(normalizePet).filter(Boolean);
    if (!list.length){ if (sec) sec.hidden = true; return; }
    if (list.length === 1){
      if (sec) sec.hidden = true;
      applyPetHidden(list[0]);
      return;
    }
    if (!sec || !sel) return;
    sec.hidden = false; sel.innerHTML = '';
    list.forEach(p=>{
      const meta = [p.especie||'', p.raza||''].filter(Boolean).join(', ');
      const label = (p.nombre || 'Mascota') + (meta?` (${meta})`:'');
      const opt = new Option(label, p.id || p.nombre || '');
      try{ opt.dataset.pet = JSON.stringify(p); }catch(_){}
      sel.appendChild(opt);
    });
    sel.onchange = function(){
      const o = sel.options[sel.selectedIndex]; if (!o) return;
      try{ applyPetHidden(JSON.parse(o.dataset.pet||'{}')); }catch(_){}
    };
    sel.onchange();
  }
  function applyPetHidden(p){
    const map = {
      'tpl-pet-id': p.id||'',
      'tpl-pet-name': p.nombre||'',
      'tpl-pet-species': p.especie||'',
      'tpl-pet-breed': p.raza||'',
      'tpl-pet-size': p.tamano||'',
      'tpl-pet-med': p.medicacion||'',
      'tpl-pet-needs': p.necesidades||''
    };
    Object.keys(map).forEach(id=>{
      const el = $id(id); if (el) el.value = map[id];
    });
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ========= AUTH check ligero =========
  function isLogged(){
    try{
      const a = firebase && firebase.auth && firebase.auth();
      const u = a && a.currentUser;
      return !!(u && !u.isAnonymous);
    }catch(_){ return false; }
  }

  /* TPL: INICIO BLOQUE NUEVO [Hydrate titular + mascotas al tener sesión] */
  function hydrateFromAuthUser(user){
    if (!user || user.isAnonymous) return;
    const emailEl = $id('email');
    const firstEl = $id('firstName');
    const lastEl  = $id('lastName');
    // Email y nombre visible
    if (user.email) setIfEmpty(emailEl, user.email);
    const sp = splitSmart(user.displayName || '');
    setIfEmpty(firstEl, sp.nombre);
    setIfEmpty(lastEl,  sp.apellidos);

    // Owner desde UDB
    const owner = udbGet(user.uid,'owner') || udbGet(user.uid,'propietario');
    if (owner){
      setIfEmpty(firstEl, owner.nombre || owner.name || '');
      setIfEmpty(lastEl,  owner.apellidos || '');
      setIfEmpty($id('phone'), owner.telefono || owner.phone || '');
    }

    // Hidden tracking
    const hidReply = $id('tpl-replyto');
    const hidUid   = $id('tpl-uid');
    const hidProf  = $id('tpl-perfil-url');
    if (hidUid)  hidUid.value = user.uid || '';
    if (hidReply) hidReply.value = (emailEl && emailEl.value) ? emailEl.value : (user.email || '');
    if (hidProf && !hidProf.value) hidProf.value = (function(){
      const a = document.getElementById('tpl-login-link');
      const href = a && a.getAttribute('href') || 'perfil.html';
      return /perfil/.test(href) ? href : 'perfil.html';
    })();

    // Mascotas: primero UDB, luego Firestore
    const udbPets = toArrayMaybe(udbGet(user.uid,'mascotas') || udbGet(user.uid,'pets')).map(normalizePet).filter(Boolean);
    if (udbPets.length){ renderPets(user.uid, udbPets); }
    else {
      loadPetsFromFirestore(user.uid).then(list=>{
        if (list && list.length){
          renderPets(user.uid, list);
          udbSet(user.uid, 'mascotas', list); // cache local
        }
      });
    }
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ========= INIT =========
  function attach(){
    const form = $id('bookingForm');
    if (!form) return;

    // IMPORTANTÍSIMO: evitar el handler del navbar
    form.setAttribute('data-tpl-emailjs','false');

    // Hydrate cuando la auth esté lista / cambie
    window.addEventListener('tpl-auth-ready', function(ev){
      hydrateFromAuthUser(ev && ev.detail ? ev.detail.user : (window.__TPL_AUTH__ && window.__TPL_AUTH__.user) || null);
    });
    window.addEventListener('tpl-auth-change', function(){
      hydrateFromAuthUser((window.__TPL_AUTH__ && window.__TPL_AUTH__.user) || null);
    });

    // Por si ya está logueado al cargar
    try{
      const a = firebase && firebase.auth && firebase.auth();
      if (a && a.currentUser) hydrateFromAuthUser(a.currentUser);
    }catch(_){}

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
