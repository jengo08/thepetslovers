/* reservas.js — envío con EmailJS usando template_rao5n0c y to_email explícito
   + UI dinámica de servicio (como antes) + cálculo automático de días y presupuesto
*/
(function(){
  'use strict';

  // ========= UTIL =========
  const $id = (id) => document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);
  const $$ = (sel,root)=> Array.from((root||document).querySelectorAll(sel));

  /* TPL: INICIO BLOQUE NUEVO [Utils extra p/fechas, dinero, query y normalización] */
  const pad2 = (n)=> String(n).padStart(2,'0');
  const ymd  = (d)=> `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const mmdd = (d)=> `${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
  const money= (n)=> (Math.round((+n||0)*100)/100).toFixed(2);
  const parseISODate = (v)=>{ if(!v) return null; const p=v.split('-'); if(p.length!==3) return null; return new Date(+p[0],+p[1]-1,+p[2],12,0,0,0); };
  const eachDate = (startISO,endISO)=>{
    const s=parseISODate(startISO), e=parseISODate(endISO);
    if(!s||!e||e<s) return [];
    const out=[]; const d=new Date(s); d.setHours(0,0,0,0); const e0=new Date(e); e0.setHours(0,0,0,0);
    while(d<=e0){ out.push(new Date(d)); d.setDate(d.getDate()+1); }
    return out;
  };
  const qs = (k)=>{ try{ return new URLSearchParams(location.search).get(k); }catch{ return null; } };
  const norm = (s)=> String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
  /* TPL: FIN BLOQUE NUEVO */

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

  /* TPL: INICIO BLOQUE NUEVO [Config precios/depósitos/bonos/festivos — editable] */
  const PRICES = Object.assign({
    base: { visitas:0, paseos:12, guarderia:15, alojamiento:30, bodas:0, postquirurgico:0, transporte:0, exoticos:0 },
    visita60:22, visita90:30,
    visita60_larga:18, visita90_larga:27,   // >= 11 días
    visitaMed:12, visitaMed_larga:10,       // 2ª visita del día
    puppyBase: { guarderia:20, alojamiento:35 }
  }, (window.TPL_PRICES || {}));

  const BUNDLE_GUARDERIA = Object.assign({
    adult: { 10:135, 20:250, 30:315 },
    puppy: { 10:185, 20:350, 30:465 }
  }, (window.TPL_BUNDLE_GUARDERIA || {}));

  const DEPOSIT_BY_SERVICE = Object.assign({
    guarderia:0.20, alojamiento:0.30, visitas:0.15, paseos:0.10, default:0.20
  }, (window.TPL_DEPOSIT_PCT || {}));

  const SPECIAL_MMDD = ['12-24','12-25','12-31','01-01'];
  const REGION_TO_COUNTY = {
    nacional:null, andalucia:'ES-AN', aragon:'ES-AR', asturias:'ES-AS', baleares:'ES-IB', canarias:'ES-CN',
    cantabria:'ES-CB','castilla-la-mancha':'ES-CM','castilla-y-leon':'ES-CL',cataluna:'ES-CT',valenciana:'ES-VC',
    extremadura:'ES-EX',galicia:'ES-GA','la-rioja':'ES-RI',madrid:'ES-MD',melilla:'ES-ML',murcia:'ES-MC',
    navarra:'ES-NC', euskadi:'ES-PV', ceuta:'ES-CE'
  };
  /* TPL: FIN BLOQUE NUEVO */

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

    // Datos extendidos (nuevo)
    const species = $id('species')?.value || (serviceLabel()==='Visitas a domicilio' ? 'gato' : '');
    if (species) parts.push(`Especie: ${species}`);
    const isPuppy = $id('isPuppy')?.value === 'si';
    if ($id('isPuppy') && !$id('fieldIsPuppy')?.hidden) parts.push(`Cachorro: ${isPuppy ? 'sí' : 'no'}`);
    const numPets = getNumPets();
    parts.push(`Nº mascotas: ${numPets}`);

    const regionText = q('#region option:checked')?.text || 'España';
    if ($id('region')) parts.push(`CCAA: ${regionText}`);

    parts.push(`Nombre: ${$id('firstName')?.value || ''} ${$id('lastName')?.value || ''}`);
    parts.push(`Email/Tel: ${$id('email')?.value || ''} / ${$id('phone')?.value || ''}`);
    if (pet) parts.push(`Mascota: ${pet}`);

    // CP/Zona
    const cp = $id('postalCode')?.value || '';
    const zc = $id('tpl-zone-code')?.value || '';
    const zn = $id('tpl-zone-name')?.value || '';
    if (cp) parts.push(`CP: ${cp}`);
    if (zc || zn) parts.push(`Zona: ${zc}${(zc && zn) ? ' - ' : ''}${zn}`);

    // Importes actuales (si panel calculó)
    const sub = $id('sumSubtotal')?.textContent || '';
    const dep = $id('sumDeposit')?.textContent || '';
    if (sub) parts.push(`Subtotal: ${sub} €`);
    if (dep) parts.push(`Depósito: ${dep} €`);
    if (getNeedTravel()) parts.push(`Desplazamiento: se calculará tras dirección`);

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
      Mascota_id:'Mascota · id',
      Mascotas_lista:'Mascotas (nombres)'
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

  // Config EmailJS (lee tu objeto global y da defaults)
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

  async function sendBookingWithEmailJS(form){
    const fd = new FormData(form);

    // Normalizar nombre/apellidos (por si vino todo en Nombre)
    const f = $id('firstName'), l = $id('lastName');
    if (f && (!l || !l.value || /\s/.test(f.value||''))){
      const s = splitSmart(f.value);
      if (s.nombre) f.value = s.nombre;
      if (s.apellidos && (!l || !l.value)) l && (l.value = s.apellidos);
    }

    // Desglose para email (vivo)
    const summary = buildSummary();
    const summaryField = $id('summaryField');
    if (summaryField) summaryField.value = summary;
    fd.set('Desglose', summary);

    // Payload base con TODOS los campos del form
    const payload = Object.fromEntries(fd.entries());

    Object.assign(payload, {
      to_email: EJ.toEmail,
      to_name:  EJ.toName,
      reply_to: $id('email')?.value || payload.Email || '',
      from_name: `${$id('firstName')?.value||''} ${$id('lastName')?.value||''}`.trim(),
      subject: 'Nueva reserva — The Pets Lovers',
      service_label: serviceLabel(),
      page_url: location.href,
      message_html: buildHtmlTable(fd),
      cp: $id('postalCode')?.value || payload.CP || '',
      zona_code: $id('tpl-zone-code')?.value || payload.Zona_codigo || '',
      zona_name: $id('tpl-zone-name')?.value || payload.Zona_nombre || '',
      user_uid: $id('tpl-uid')?.value || ''
    });

    const emailjs = await ensureEmailJS();
    try { emailjs.init({ publicKey: EJ.publicKey }); } catch(_){}

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
          const sub1 = await docRef.collection('mascotas').get().catch(()=>null);
          if (sub1 && !sub1.empty){ sub1.forEach(d => list.push(Object.assign({id:d.id}, d.data()))); }
          const sub2 = await docRef.collection('pets').get().catch(()=>null);
          if (sub2 && !sub2.empty){ sub2.forEach(d => list.push(Object.assign({id:d.id}, d.data()))); }
          const main = await docRef.get().catch(()=>null);
          if (main && main.exists){
            const data = main.data() || {};
            toArrayMaybe(data.mascotas).forEach(p => list.push(p));
            toArrayMaybe(data.pets).forEach(p => list.push(p));
          }
          if (list.length) break;
        }catch(_){}
      }
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
    if (user.email) setIfEmpty(emailEl, user.email);
    const sp = splitSmart(user.displayName || '');
    setIfEmpty(firstEl, sp.nombre);
    setIfEmpty(lastEl,  sp.apellidos);

    const owner = udbGet(user.uid,'owner') || udbGet(user.uid,'propietario');
    if (owner){
      setIfEmpty(firstEl, owner.nombre || owner.name || '');
      setIfEmpty(lastEl,  owner.apellidos || '');
      setIfEmpty($id('phone'), owner.telefono || owner.phone || '');
    }

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

    const udbPets = toArrayMaybe(udbGet(user.uid,'mascotas') || udbGet(user.uid,'pets')).map(normalizePet).filter(Boolean);
    if (udbPets.length){ renderPets(user.uid, udbPets); }
    else {
      loadPetsFromFirestore(user.uid).then(list=>{
        if (list && list.length){
          renderPets(user.uid, list);
          udbSet(user.uid, 'mascotas', list);
        }
      });
    }
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* ===================== NUEVO: UI dinámica + presupuesto ===================== */

  /* TPL: INICIO BLOQUE NUEVO [Inyección UI sin tocar HTML] */
  function ensureServiceFields(){
    const sec = q('.tpl-section[aria-labelledby="sec-servicio"]');
    const grid = q('.booking-grid', sec);
    if (!sec || !grid) return;

    const addField = (id, html)=>{
      if ($id(id)) return $id(id);
      const wrap = document.createElement('div');
      wrap.className = 'booking-field';
      wrap.id = id;
      wrap.innerHTML = html;
      grid.appendChild(wrap);
      return wrap;
    };

    addField('fieldVisitDuration', `
      <label for="visitDuration">Duración de la visita</label>
      <select id="visitDuration">
        <option value="60">60 minutos</option>
        <option value="90">90 minutos</option>
      </select>
    `);

    addField('fieldVisitDaily', `
      <label for="visitDaily">Visitas por día</label>
      <select id="visitDaily">
        <option value="1">1 visita/día</option>
        <option value="2">2 visitas/día</option>
      </select>
    `);

    addField('fieldSpecies', `
      <label for="species">Especie</label>
      <select id="species">
        <option value="perro">Perro</option>
        <option value="gato">Gato</option>
        <option value="otros">Exótico / Otros</option>
      </select>
    `);

    addField('fieldIsPuppy', `
      <label for="isPuppy">¿Cachorro?</label>
      <select id="isPuppy">
        <option value="no">No</option>
        <option value="si">Sí</option>
      </select>
    `);

    addField('fieldNumPets', `
      <label for="numPets">Número de mascotas</label>
      <div>
        <select id="numPets" style="min-width:110px">
          <option>1</option><option>2</option><option>3</option>
          <option>4</option><option>5</option><option>6+</option>
        </select>
        <input id="numPetsExact" type="number" min="6" step="1" placeholder="Exacto" style="width:90px; margin-left:8px; display:none">
      </div>
    `);

    addField('fieldRegion', `
      <label for="region">Comunidad autónoma</label>
      <select id="region">
        <option value="nacional" selected>España (nacional)</option>
        <option value="andalucia">Andalucía</option>
        <option value="aragon">Aragón</option>
        <option value="asturias">Asturias</option>
        <option value="baleares">Baleares</option>
        <option value="canarias">Canarias</option>
        <option value="cantabria">Cantabria</option>
        <option value="castilla-la-mancha">Castilla-La Mancha</option>
        <option value="castilla-y-leon">Castilla y León</option>
        <option value="cataluna">Cataluña</option>
        <option value="valenciana">C. Valenciana</option>
        <option value="extremadura">Extremadura</option>
        <option value="galicia">Galicia</option>
        <option value="la-rioja">La Rioja</option>
        <option value="madrid">Madrid</option>
        <option value="melilla">Melilla</option>
        <option value="murcia">Murcia</option>
        <option value="navarra">Navarra</option>
        <option value="euskadi">País Vasco</option>
        <option value="ceuta">Ceuta</option>
      </select>
    `);

    addField('fieldNeedTravel', `
      <label for="needTravel">¿Necesita desplazamiento?</label>
      <select id="needTravel">
        <option value="no">No</option>
        <option value="si">Sí</option>
      </select>
      <small id="travelBubble" style="display:none; color:#666">
        El coste de desplazamiento se calculará tras conocer la dirección y se cobrará al aceptar la reserva.
      </small>
    `);

    addField('fieldDays', `
      <label>Días totales</label>
      <input id="daysCount" type="text" value="—" readonly>
    `);

    if (!$id('tpl-quote')) {
      const form = $id('bookingForm');
      const panel = document.createElement('div');
      panel.id = 'tpl-quote';
      panel.style.cssText = 'margin-top:12px;border:1px solid #eee;border-radius:12px;padding:12px;background:#fafafa';
      panel.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center">
          <div><strong>Presupuesto estimado</strong> <small style="color:#777">(sin desplazamiento)</small></div>
          <a id="tpl-help" href="${window.TPL_HELP_URL || 'ayuda.html'}" style="text-decoration:none;font-weight:600;color:#339496">¿Necesitas ayuda?</a>
        </div>
        <div id="tpl-quote-body" style="margin-top:8px">
          <div class="row"><span>Base</span><span id="sumBase">—</span></div>
          <div class="row" id="rowVisit1"><span>Visitas (1ª)</span><span id="sumVisit1">—</span></div>
          <div class="row" id="rowVisit2" style="display:none"><span>Visitas (2ª del día)</span><span id="sumVisit2">—</span></div>
          <div class="row"><span>Extra mascotas</span><span id="sumPets">—</span></div>
          <div class="row"><span>Festivos</span><span id="sumFestivo">—</span></div>
          <div class="row"><span>Días señalados</span><span id="sumSenalado">—</span></div>
          <div class="row" id="rowBono" style="display:none"><span>Descuento bono guardería</span><span>−<span id="sumBono">0.00</span></span></div>
          <hr style="border:none;border-top:1px solid #eaeaea;margin:8px 0">
          <div class="row"><strong>Subtotal</strong><strong id="sumSubtotal">—</strong></div>
          <div class="row"><span>Depósito a retener</span><span id="sumDeposit">—</span></div>
          <div class="row"><span>Desplazamiento</span><span id="sumTravel">—</span></div>
        </div>
      `;
      form.appendChild(panel);
      const st = document.createElement('style');
      st.textContent = `#tpl-quote .row{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:center}
        #tpl-quote .row span:last-child{font-variant-numeric:tabular-nums}`;
      document.head.appendChild(st);
    }

    if (!$id('tpl-help-fab')) {
      const fab = document.createElement('a');
      fab.id = 'tpl-help-fab';
      fab.href = (window.TPL_HELP_URL || 'ayuda.html');
      fab.textContent = '¿Necesitas ayuda?';
      fab.style.cssText = `
        position:fixed; right:14px; bottom:14px; z-index:9999;
        background:#339496;color:#fff;padding:10px 14px;border-radius:999px;
        font-weight:700;text-decoration:none; box-shadow:0 6px 16px rgba(0,0,0,.18)
      `;
      document.body.appendChild(fab);
    }
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Preselección servicio como antes] */
  function inferServiceFromReferrer() {
    try {
      const u = new URL(document.referrer || '');
      const p = (u.pathname || '').toLowerCase();
      if (p.includes('guarderia')) return 'guarderia';
      if (p.includes('alojamiento') || p.includes('estancias')) return 'alojamiento';
      if (p.includes('paseos')) return 'paseos';
      if (p.includes('visitas')) return 'visitas';
      if (p.includes('bodas')) return 'bodas';
      if (p.includes('postquir')) return 'postquirurgico';
      if (p.includes('transporte')) return 'transporte';
      if (p.includes('exotico')) return 'exoticos';
    } catch {}
    return null;
  }
  function presetService() {
    const el = $id('service'); if (!el) return;
    const map = { 'visitas':'visitas','visitas-gatos':'visitas','paseos':'paseos','guarderia':'guarderia',
      'alojamiento':'alojamiento','estancias':'alojamiento','bodas':'bodas','postquirurgico':'postquirurgico',
      'transporte':'transporte','exoticos':'exoticos','exotico':'exoticos' };
    const qv = norm(qs('service') || qs('svc') || qs('tipo'));
    let val = map[qv] || inferServiceFromReferrer();
    if (val && Array.from(el.options).some(o => o.value === val)) el.value = val;
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Festivos automáticos con cache + fallback] */
  const _festivosCache = new Map();
  async function holidaysForYear(year) {
    if (_festivosCache.has(year)) return _festivosCache.get(year);
    // local (opcional)
    const tryLocal = async () => {
      for (const url of [`/festivos-es-${year}.json`, `festivos-es-${year}.json`]) {
        try {
          const r = await fetch(url, { cache: 'no-store' });
          if (!r.ok) continue;
          const d = await r.json();
          const nacional = new Set((d.national || d.nacional || []).map(x => x.date || x));
          const porCcaa = new Map();
          if (d.regions) Object.entries(d.regions).forEach(([k, arr]) => porCcaa.set(k, new Set(arr.map(x => x.date || x))));
          return { nacional, porCcaa };
        } catch {}
      }
      return null;
    };
    const local = await tryLocal();
    if (local) { _festivosCache.set(year, local); return local; }
    // API pública
    try {
      const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ES`, { cache: 'force-cache' });
      const data = await r.json();
      const nacional = new Set();
      const porCcaa = new Map();
      for (const h of data) {
        const date = h.date;
        if (!h.counties || !h.counties.length) nacional.add(date);
        else {
          for (const c of h.counties) {
            const key = c;
            if (!porCcaa.has(key)) porCcaa.set(key, new Set());
            porCcaa.get(key).add(date);
          }
        }
      }
      const pack = { nacional, porCcaa };
      _festivosCache.set(year, pack);
      return pack;
    } catch {
      const basic = { nacional: new Set([`${year}-01-06`, `${year}-05-01`, `${year}-08-15`, `${year}-10-12`, `${year}-11-01`, `${year}-12-06`, `${year}-12-08`, `${year}-12-25`]), porCcaa: new Map() };
      _festivosCache.set(year, basic);
      return basic;
    }
  }
  async function festivosAuto(regionKey, startISO, endISO) {
    const days = eachDate(startISO, endISO);
    if (!days.length) return { festivo: 0, senalado: 0, nDias: 0 };
    let festivo = 0, senalado = 0;
    const county = REGION_TO_COUNTY[regionKey || 'nacional'] || null;
    for (const d of days) {
      const year = d.getFullYear();
      const iso = ymd(d);
      const pack = await holidaysForYear(year);
      const isNat = pack.nacional.has(iso);
      const isReg = county ? !!(pack.porCcaa.get(county) && pack.porCcaa.get(county).has(iso)) : false;
      const isSpecial = SPECIAL_MMDD.includes(mmdd(d));
      if (isNat || isReg) festivo += 10;
      if (isSpecial)      senalado += 30;
    }
    return { festivo, senalado, nDias: days.length };
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Lectura de campos/visibilidad] */
  function getService(){ return $id('service')?.value || ''; }
  function getSpecies(){
    const el = $id('species');
    if (el && el.value) return el.value;
    if (getService()==='visitas') return 'gato';
    if (getService()==='exoticos') return 'otros';
    return 'perro';
  }
  function canAskPuppy(){ const s=getService(); return (s==='guarderia'||s==='alojamiento') && getSpecies()!=='otros'; }
  function getIsPuppy(){ return ($id('isPuppy')?.value === 'si'); }
  function getNumPets(){
    const sel = $id('numPets'), exact = $id('numPetsExact');
    if (!sel){
      const h = $id('petsListHidden'); if (h && h.value) return Math.max(1, h.value.split(',').map(s=>s.trim()).filter(Boolean).length);
      return 1;
    }
    const v = sel.value || '1';
    if (v==='6+') return Math.max(6, parseInt(exact?.value||'6',10) || 6);
    return parseInt(v,10) || 1;
  }
  function getRegion(){ return $id('region')?.value || 'nacional'; }
  function getVisitDuration(){ return parseInt($id('visitDuration')?.value || '60', 10); }
  function getVisitDaily(){ return parseInt($id('visitDaily')?.value || '1', 10); }
  function getDatesISO(){ return { start: $id('startDate')?.value || '', end: $id('endDate')?.value || '' }; }
  function getNeedTravel(){ return ($id('needTravel')?.value || 'no') === 'si'; }

  function toggleServiceUI(){
    const svc = getService();
    const isVisitas = (svc === 'visitas');

    const fDur = $id('fieldVisitDuration');
    const fDly = $id('fieldVisitDaily');
    if (fDur) fDur.hidden = !isVisitas;
    if (fDly) fDly.hidden = !isVisitas;

    const speciesEl = $id('species');
    if (speciesEl && isVisitas) speciesEl.value = 'gato';

    const fPup = $id('fieldIsPuppy');
    if (fPup) fPup.hidden = !(canAskPuppy());

    const travelBubble = $id('travelBubble');
    if (travelBubble) travelBubble.style.display = getNeedTravel() ? 'block' : 'none';
    const sumTravel = $id('sumTravel');
    if (sumTravel) sumTravel.textContent = getNeedTravel() ? 'pendiente' : '—';

    // mostrar input exacto si 6+
    const nSel = $id('numPets');
    const nEx  = $id('numPetsExact');
    if (nSel && nEx) nEx.style.display = (nSel.value === '6+') ? '' : 'none';
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Precios por servicio] */
  function basePerDay(service, species, isPuppy) {
    if (service === 'visitas') return 0;
    if (service === 'guarderia') return isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
    if (service === 'alojamiento') return isPuppy ? (PRICES.puppyBase.alojamiento ?? PRICES.base.alojamiento) : PRICES.base.alojamiento;
    return PRICES.base[service] || 0;
  }
  function calcVisitasPrices(durationMin, daily, nDias) {
    const long = (nDias >= 11);
    const p1 = (durationMin === 90) ? (long ? PRICES.visita90_larga : PRICES.visita90) : (long ? PRICES.visita60_larga : PRICES.visita60);
    const p2 = (daily === 2) ? (long ? PRICES.visitaMed_larga : PRICES.visitaMed) : 0;
    return { p1, p2 };
  }
  function petsExtras(service, species, n) {
    n = +n || 1; if (n <= 1) return 0;
    const extra = n - 1;
    if (service === 'visitas') {
      if (extra === 1) return 12;
      if (extra === 2) return 8 * 2;
      if (extra >= 3) return 6 * extra;
      return 0;
    }
    if (service === 'paseos') return 8 * extra;
    if (service === 'alojamiento' && species === 'perro') return 25 * extra;
    return 0;
  }
  function guarderiaBonoDiscount(nDias, isPuppy) {
    const perDay = isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
    const table = isPuppy ? (BUNDLE_GUARDERIA.puppy || {}) : (BUNDLE_GUARDERIA.adult || {});
    const bundlePrice = table[nDias];
    if (!bundlePrice) return 0;
    const normal = perDay * nDias;
    return Math.max(0, normal - bundlePrice);
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Panel de presupuesto + summary hidden] */
  function updateQuotePanel(values) {
    const { isVisitas, base, visit1, visit2, pets, festivo, senalado, bono, subtotal, deposit } = values;
    const set = (id, v) => { const el = $id(id); if (el) el.textContent = money(v); };
    if ($id('sumBase')) $id('sumBase').textContent = isVisitas ? '—' : money(base);
    const r2 = $id('rowVisit2'); if (r2) r2.style.display = (isVisitas && visit2 > 0) ? '' : 'none';
    set('sumVisit1', visit1);
    set('sumVisit2', visit2);
    set('sumPets', pets);
    set('sumFestivo', festivo);
    set('sumSenalado', senalado);
    const rb = $id('rowBono'); if (rb) rb.style.display = (bono > 0) ? '' : 'none';
    set('sumBono', bono);
    if ($id('sumSubtotal')) $id('sumSubtotal').textContent = subtotal > 0 ? money(subtotal) : '—';
    if ($id('sumDeposit'))  $id('sumDeposit').textContent  = subtotal > 0 ? money(deposit)  : '—';
  }
  function updateSummaryHidden(){
    const sf = $id('summaryField');
    if (!sf) return;
    sf.value = buildSummary();
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Recalculo principal] */
  let _recalcLock = false;
  async function recalcAll(){
    if (_recalcLock) return; _recalcLock = true;
    try{
      const svc = getService();
      const isVisitas = (svc === 'visitas');
      const species = getSpecies();
      const isPuppy = canAskPuppy() && getIsPuppy();
      const n = getNumPets();
      const region = getRegion();
      const { start, end } = getDatesISO();

      const days = eachDate(start, end);
      if ($id('daysCount')) $id('daysCount').value = days.length ? String(days.length) : '—';

      const { festivo, senalado, nDias } = await festivosAuto(region, start, end);

      let base = 0, visit1 = 0, visit2 = 0, bono = 0, pets = 0;

      if (isVisitas) {
        const { p1, p2 } = calcVisitasPrices(getVisitDuration(), getVisitDaily(), nDias);
        visit1 = p1 * nDias;
        visit2 = p2 * nDias;
        pets = petsExtras(svc, 'gato', n);
      } else {
        base = basePerDay(svc, species, isPuppy) * nDias;
        pets = petsExtras(svc, species, n);
        if (svc === 'guarderia') bono = guarderiaBonoDiscount(nDias, isPuppy);
      }

      const subtotal = Math.max(0, (base + visit1 + visit2 + pets + festivo + senalado) - bono);
      const depPct = (DEPOSIT_BY_SERVICE[svc] ?? DEPOSIT_BY_SERVICE.default);
      const deposit = subtotal * depPct;

      updateQuotePanel({ isVisitas, base, visit1, visit2, pets, festivo, senalado, bono, subtotal, deposit });
      updateSummaryHidden();
    }finally{
      _recalcLock = false;
    }
  }
  /* TPL: FIN BLOQUE NUEVO */

  /* TPL: INICIO BLOQUE NUEVO [Bindings] */
  function bindDynamicUI(){
    const ids = ['service','startDate','endDate','start','end','visitDuration','visitDaily','species','isPuppy','numPets','numPetsExact','region','needTravel','notes','postalCode'];
    ids.forEach(id=>{
      const el = $id(id); if (!el) return;
      el.addEventListener('change', ()=>{ toggleServiceUI(); recalcAll(); });
      el.addEventListener('input',  ()=>{ toggleServiceUI(); recalcAll(); });
    });
    // por UX: recalcular al teclear fechas
    ['startDate','endDate'].forEach(id=> $id(id)?.addEventListener('input', recalcAll));
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ========= INIT / SUBMIT =========
  function attach(){
    const form = $id('bookingForm');
    if (!form) return;

    // Evita handlers globales no deseados
    form.setAttribute('data-tpl-emailjs','false');

    // Inyecta UI dinámica y preselecciona servicio
    ensureServiceFields();
    presetService();
    toggleServiceUI();
    bindDynamicUI();
    recalcAll();

    // Hydrate cuando la auth esté lista / cambie
    window.addEventListener('tpl-auth-ready', function(ev){
      hydrateFromAuthUser(ev && ev.detail ? ev.detail.user : (window.__TPL_AUTH__ && window.__TPL_AUTH__.user) || null);
      recalcAll();
    });
    window.addEventListener('tpl-auth-change', function(){
      hydrateFromAuthUser((window.__TPL_AUTH__ && window.__TPL_AUTH__.user) || null);
      recalcAll();
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
        try{ form.reset(); recalcAll(); }catch(_){}
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
