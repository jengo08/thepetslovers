/* reservas.js — The Pets Lovers (auto-relleno + cálculo con tarifas reales + EmailJS)
   © TPL. Última actualización: hoy
*/
(function(){
  'use strict';

  // ======= UTIL =======
  const $id = (id)=> document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);
  const $$ = (sel,root)=> Array.from((root||document).querySelectorAll(sel));
  const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||false);
  const clamp = (n,min,max)=> Math.max(min, Math.min(max, n));
  const num = (v,def=0)=> isFinite(+v) ? +v : def;
  function fmtEUR(n){ try{ return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(+n||0); }catch(_){ return (+(+n||0)).toFixed(2)+' €'; } }
  function daysBetweenInclusive(d1,d2){
    if(!d1||!d2) return 0;
    const a = new Date(d1), b = new Date(d2);
    a.setHours(0,0,0,0); b.setHours(0,0,0,0);
    return Math.max(0, Math.round((b - a)/86400000) + 1);
  }
  function setIfEmpty(el,val){ if(el && !el.value && val!=null) el.value = val; }
  function toArrayMaybe(x){ if(!x) return []; return Array.isArray(x) ? x : Object.keys(x).map(k=>Object.assign({id:k},x[k])); }
  function splitSmart(text){
    if (!text) return {nombre:'', apellidos:''};
    let s = String(text).trim().replace(/\s+/g,' ');
    if (s.includes(',')){ const a = s.split(','); return { nombre:(a.slice(1).join(',')||'').trim(), apellidos:(a[0]||'').trim() }; }
    const parts = s.split(' '); if (parts.length === 1) return { nombre: parts[0], apellidos: '' };
    return { nombre: parts[0], apellidos: parts.slice(1).join(' ') };
  }
  function ensureHidden(name, idHint){
    let el = q(`input[name="${name}"]`);
    if (!el){
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      if (idHint) el.id = idHint;
      const form = $id('bookingForm'); form && form.appendChild(el);
    }
    return el;
  }

  // ======= CONFIG EMAILJS (ajusta desde window.TPL_EMAILJS si quieres) =======
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

  // ======= TARIFAS REALES (tal cual pasaste) =======
  // Puedes sobreescribir cualquier parte desde window.TPL_PRICING antes de cargar este JS.
  const PRICING = Object.assign({
    // ---- GUARDEÍA DE DÍA ----
    guarderia: {
      label: 'Guardería de día',
      perDayStd: 15,                // Tarifa estándar 15 €/día
      perDayPuppy: 20,              // Cachorros (≤6m) 20 €/día
      // Suplemento por más mascotas (solo en DIARIA, no en bono)
      // 1ª mascota incluida en perDay; 2ª: +12 €/día; 3ª+: +8 €/día cada una
      extraDailySecond: 12,
      extraDailyThirdPlus: 8,
      // Bonos (precio por 10/20/30 días). En bonos se suma el coste de cada mascota:
      // ASUNCIÓN: para 2ª y 3ª+ en bono sumamos (suplemento diario * tamaño del bono)
      // (p.ej. 10 días → 12*10 = 120, 8*10 = 80). Si prefieres otro criterio, dímelo.
      bonosStd: {
        10: 135,
        20: 250,
        30: 315
      },
      bonosPuppy: {
        10: 185,
        20: 350,
        30: 465
      }
    },

    // ---- ALOJAMIENTO / ESTANCIAS (por noche) ----
    alojamiento: {
      label: 'Alojamiento',
      perNightStd: 30,
      perNightPuppy: 35,
      fromDay11Std: 27,    // Desde día 11
      fromDay11Puppy: 32,  // Desde día 11 cachorros
      // 2º perro: 25 €/día; desde día 11: 22 €/día
      // ASUNCIÓN: para 3º+ aplicamos misma tarifa que el 2º.
      extraDogPerNight: 25,
      extraDogFromDay11: 22
    },

    // ---- PASEOS ----
    paseos: {
      label: 'Paseos (60 min)',
      perWalk60: 12,         // Paseo estándar (60 min) 12 €
      extraDogPerWalk: 8,    // 2ª mascota +8 €/paseo (ASUNCIÓN: también 3ª+)
      // Bonos (1 perro)
      bonos: {
        10: 115,
        15: 168,
        20: 220,
        25: 270,
        30: 318
      }
    },

    // ---- VISITAS ----
    visitas: {
      label: 'Visitas',
      // Gatos
      gato: {
        m15: { base: 12, fromDay11: 10 },   // medicación 15 min
        m60: { base: 22, fromDay11: 18 },   // 60 min
        m90: { base: 30, fromDay11: 27 },   // 90 min
        // suplementos por nº de gatos (por visita):
        // 1 gato más: +12; 2 gatos más: +8 c/u; ≥3 gatos más: +6 c/u
        extraCats: function(nTotalCats){
          const extras = Math.max(0, nTotalCats - 1);
          if (extras === 0) return 0;
          if (extras === 1) return 12;
          if (extras === 2) return 2 * 8;
          return extras * 6;
        }
      },
      // Exóticos (precio por visita, sin duración)
      aves: 20,
      reptiles: 15,
      pequenos: 25 // pequeños mamíferos
    },

    // ---- TRANSPORTE (solo info) ----
    transporte: {
      base: 20,   // + km
      nota: 'Se calcula según distancia y tiempos de espera.'
    }
  }, window.TPL_PRICING||{});

  // ======= BONOS (si prefieres definirlos desde HTML, se respeta window.TPL_BONOS) =======
  const BONOS = window.TPL_BONOS || {
    paseos: Object.entries(PRICING.paseos.bonos).map(([size,price])=>({size:+size, price:+price, label:`Bono ${size} paseos`})),
    guarderia: [
      { size:10, price:PRICING.guarderia.bonosStd[10], puppy:false, label:'Bono 10 días (estándar)'},
      { size:20, price:PRICING.guarderia.bonosStd[20], puppy:false, label:'Bono 20 días (estándar)'},
      { size:30, price:PRICING.guarderia.bonosStd[30], puppy:false, label:'Bono 30 días (estándar)'},
      { size:10, price:PRICING.guarderia.bonosPuppy[10], puppy:true,  label:'Bono 10 días (cachorros)'},
      { size:20, price:PRICING.guarderia.bonosPuppy[20], puppy:true,  label:'Bono 20 días (cachorros)'},
      { size:30, price:PRICING.guarderia.bonosPuppy[30], puppy:true,  label:'Bono 30 días (cachorros)'}
    ],
    visitas: [] // no hay bono específico de visitas en tu tabla
  };

  // % de depósito visible (si lo usas). 0 → oculto
  window.TPL_DEPOSITO_PCT = typeof window.TPL_DEPOSITO_PCT === 'number' ? window.TPL_DEPOSITO_PCT : 0;

  // ======= OVERLAY =======
  function ensureOverlay(){
    let wrap = $id('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id = 'tpl-overlay';
      wrap.className = 'tpl-overlay';
      wrap.innerHTML = `
        <div class="tpl-modal" role="dialog" aria-live="polite">
          <p id="tpl-ov-text" style="margin:0 0 12px"></p>
          <pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:240px;overflow:auto"></pre>
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

  // ======= PERFIL / AUTORRELLENO =======
  function getAuthUser(){
    try{ const a = firebase && firebase.auth && firebase.auth(); return a ? a.currentUser : null; }catch(_){ return null; }
  }
  function udbKey(uid,key){ return 'tpl.udb.'+uid+'.'+key; }
  function udbGet(uid,key){ try{ const raw = localStorage.getItem(udbKey(uid,key)); return raw ? JSON.parse(raw) : null; }catch(_){ return null; } }
  function normalizePet(p){
    if (!p) return null;
    const id  = p.id || p.uid || p._id || p.chip || p.chipid || p.microchip || null;
    const nombre = p.nombre || p.name || p.petName || '';
    const especie = (p.especie || p.tipo || p.species || p.type || '').toLowerCase();
    const raza = p.raza || p.breed || '';
    const tam = p.tamano || p['tamaño'] || p.size || '';
    const meds = p.medicacion || p['medicación'] || p.medication || '';
    const needs = p.necesidades || p.needs || p.specialNeeds || '';
    const puppy = !!p.cachorro || !!p.puppy || (p.edadMeses!=null && +p.edadMeses<=6);
    return { id, nombre, especie, raza, tamano: tam, medicacion: meds, necesidades: needs, puppy };
  }
  function applyPetHidden(p){
    // Creamos los ocultos con nombres que sí entran en FormData:
    const M = {
      'Mascota_id': p.id||'',
      'Mascota_nombre': p.nombre||'',
      'Mascota_especie': p.especie||'',
      'Mascota_raza': p.raza||'',
      'Mascota_tamano': p.tamano||'',
      'Mascota_medicacion': p.medicacion||'',
      'Mascota_necesidades': p.necesidades||'',
      'Mascota_cachorro': p.puppy ? 'sí' : 'no'
    };
    Object.keys(M).forEach(k=>{ const el = ensureHidden(k); el.value = M[k]; });
    // También espejamos en los ids antiguos por compatibilidad:
    const mapIds = {
      'tpl-pet-id': M.Mascota_id,
      'tpl-pet-name': M.Mascota_nombre,
      'tpl-pet-species': M.Mascota_especie,
      'tpl-pet-breed': M.Mascota_raza,
      'tpl-pet-size': M.Mascota_tamano,
      'tpl-pet-med': M.Mascota_medicacion,
      'tpl-pet-needs': M.Mascota_necesidades
    };
    Object.keys(mapIds).forEach(id=>{ const el=$id(id); if(el) el.value = mapIds[id]; });
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
      const label = (p.nombre || 'Mascota') + (meta?` (${meta})`:``);
      const opt = new Option(label, p.id || p.nombre || '');
      try{ opt.dataset.pet = JSON.stringify(p); }catch(_){}
      sel.appendChild(opt);
    });
    sel.onchange = function(){
      const o = sel.options[sel.selectedIndex]; if (!o) return;
      try{ applyPetHidden(JSON.parse(o.dataset.pet||'{}')); }catch(_){}
      recalcBudget();
    };
    sel.onchange();
  }
  async function loadPetsFromFirestore(uid){
    const out = [];
    try{
      if (typeof firebase === 'undefined' || !firebase.firestore) return out;
      const db = firebase.firestore();
      const docRef = db.collection('owners').doc(uid);
      const sub = await docRef.collection('mascotas').get().catch(()=>null);
      if (sub && !sub.empty){ sub.forEach(d=> out.push(Object.assign({id:d.id}, d.data()))); }
      const main = await docRef.get().catch(()=>null);
      if (main && main.exists){
        const data = main.data()||{};
        toArrayMaybe(data.mascotas).forEach(p => out.push(p));
        toArrayMaybe(data.pets).forEach(p => out.push(p));
      }
      // fallback raíz
      if (!out.length){
        const q1 = await db.collection('mascotas').where('ownerUid','==',uid).get().catch(()=>null);
        if (q1 && !q1.empty){ q1.forEach(d=> out.push(Object.assign({id:d.id}, d.data()))); }
      }
    }catch(_){}
    return out;
  }
  function hydrateFromProfile(){
    const user = getAuthUser();
    // 1) datos visibles (nombre, apellidos, email, tel, cp)
    const fillFrom = (obj)=>{
      if (!obj) return;
      setIfEmpty($id('email'), obj.email);
      setIfEmpty($id('phone'), obj.phone||obj.telefono);
      if (obj.displayName){
        const sp = splitSmart(obj.displayName);
        setIfEmpty($id('firstName'), sp.nombre);
        setIfEmpty($id('lastName'), sp.apellidos);
      }
      setIfEmpty($id('firstName'), obj.firstName||obj.nombre);
      setIfEmpty($id('lastName'),  obj.lastName||obj.apellidos);
      setIfEmpty($id('postalCode'), obj.cp||obj.postalCode||obj.codigoPostal);
      // Espejos ocultos de propietario para el email
      const M = {
        'Propietario_nombre': ($id('firstName')?.value||'').trim(),
        'Propietario_apellidos': ($id('lastName')?.value||'').trim(),
        'Propietario_email': ($id('email')?.value||'').trim(),
        'Propietario_telefono': ($id('phone')?.value||'').trim(),
        'Propietario_cp': ($id('postalCode')?.value||'').trim()
      };
      Object.keys(M).forEach(k=>{ const el = ensureHidden(k); el.value = M[k]; });
    };

    if (user){
      fillFrom({ email:user.email, displayName:user.displayName });
      const owner = udbGet(user.uid,'owner') || udbGet(user.uid,'propietario');
      owner && fillFrom(owner);
      // mascotas
      const udbPets = toArrayMaybe(udbGet(user.uid,'mascotas') || udbGet(user.uid,'pets')).map(normalizePet).filter(Boolean);
      if (udbPets.length){ renderPets(user.uid, udbPets); }
      else { loadPetsFromFirestore(user.uid).then(list=>{ if (list?.length){ renderPets(user.uid, list); try{ localStorage.setItem(udbKey(user.uid,'mascotas'), JSON.stringify(list)); }catch(_){}} }); }
      ensureHidden('tpl-uid').value = user.uid || '';
    } else {
      // 2) window.__TPL_PROFILE__ (si perfil.html lo dejó)
      if (window.__TPL_PROFILE__){ fillFrom(window.__TPL_PROFILE__); renderPets('anon', window.__TPL_PROFILE__.pets||[]); }
      // 3) localStorage (guardado previo)
      try{
        const raw = localStorage.getItem('tpl.profile');
        if (raw){ const p = JSON.parse(raw); fillFrom(p); renderPets('anon', p.pets||[]); }
      }catch(_){}
    }
  }

  // ======= UI dinámico servicio =======
  function ensureServiceDynamicUI(){
    const sec = q('section[aria-labelledby="sec-servicio"]') || q('#sec-servicio')?.closest('section');
    if (!sec) return null;
    let box = $id('svc-dynamic');
    if (!box){
      box = document.createElement('div');
      box.id = 'svc-dynamic';
      box.className = 'tpl-section';
      box.innerHTML = `
        <h2 style="margin-top:4px;font-size:1.05rem">Opciones del servicio</h2>
        <div class="booking-grid" id="svc-grid"></div>
        <div id="budgetBox" class="booking-field" style="margin-top:6px;grid-column:1/-1"></div>`;
      sec.appendChild(box);
    }
    return box;
  }
  function optionEl(label, inner){
    const wrap = document.createElement('div');
    wrap.className = 'booking-field';
    wrap.innerHTML = `<label>${label}</label>${inner}`;
    return wrap;
  }
  function serviceLabel(){
    const s = $id('service'); if(!s) return '';
    const opt = s.options[s.selectedIndex];
    return (opt && opt.text) ? opt.text.trim() : '';
  }

  // Construcción por servicio
  function buildUIFor(service){
    const grid = $id('svc-grid'); if (!grid) return;
    grid.innerHTML = '';

    // Ocultos comunes para email
    const hTipo   = ensureHidden('Servicio_tipo','svc_tipo');
    const hDur    = ensureHidden('Servicio_duracion','svc_dur');
    const hVxd    = ensureHidden('Servicio_visitas_dia','svc_vxd');
    const hNmas   = ensureHidden('Servicio_mascotas','svc_nmas');
    const hHoras  = ensureHidden('Servicio_horas','svc_horas');
    const hTotal  = ensureHidden('Presupuesto_total','svc_total');
    const hDet    = ensureHidden('Presupuesto_detalle','svc_detalle');
    const hDias   = ensureHidden('Servicio_dias','svc_dias');
    const hBono   = ensureHidden('Servicio_bono','svc_bono');

    const sd = $id('startDate'), ed = $id('endDate');
    const currentDays = ()=> daysBetweenInclusive(sd?.value, ed?.value);
    const updateDays = ()=>{ hDias.value = currentDays(); recalcBudget(); };
    on(sd,'change', updateDays); on(ed,'change', updateDays);

    if (service === 'visitas'){
      // Tipo: Gatos / Medicación gato / Aves / Reptiles / Pequeños mamíferos
      const selTipo = document.createElement('select');
      selTipo.innerHTML = `
        <option value="">Elige…</option>
        <option value="gato">Gatos (60/90 min)</option>
        <option value="gato_med">Gatos — medicación 15 min</option>
        <option value="aves">Aves (pájaros)</option>
        <option value="reptiles">Reptiles</option>
        <option value="pequenos">Pequeños mamíferos</option>`;
      grid.appendChild(optionEl('Tipo de visita', selTipo.outerHTML));
      const selTipoEl = grid.querySelector('select');
      on(selTipoEl,'change', ()=>{ hTipo.value = selTipoEl.value; rebuildVisitasOptions(); recalcBudget(); });

      function rebuildVisitasOptions(){
        // Limpia lo específico
        $$('[data-svc-extra]', grid).forEach(n=>n.remove());
        if (selTipoEl.value === 'gato'){
          // Duración 60/90
          const selDur = document.createElement('select');
          selDur.innerHTML = `<option value="">Elige…</option><option value="60">60 min</option><option value="90">90 min</option>`;
          const wrap = optionEl('Duración', selDur.outerHTML); wrap.dataset.svcExtra = '1'; grid.appendChild(wrap);
          const el = grid.querySelector('[data-svc-extra] select');
          on(el,'change', ()=>{ hDur.value = el.value; recalcBudget(); });

          // Visitas/día
          const vxdSel = document.createElement('select');
          vxdSel.innerHTML = `<option>1</option><option>2</option><option>3</option>`;
          const wrap2 = optionEl('Visitas por día', vxdSel.outerHTML); wrap2.dataset.svcExtra = '1'; grid.appendChild(wrap2);
          const vxdEl = wrap2.querySelector('select');
          vxdEl.value = '1'; on(vxdEl,'change', ()=>{ hVxd.value = vxdEl.value; recalcBudget(); });

          // Nº de gatos
          const nmInput = document.createElement('input');
          nmInput.type='number'; nmInput.min='1'; nmInput.max='12'; nmInput.value='1';
          const wrap3 = optionEl('Nº de gatos', nmInput.outerHTML); wrap3.dataset.svcExtra = '1'; grid.appendChild(wrap3);
          const nmEl = wrap3.querySelector('input');
          on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,12); recalcBudget(); });

          hDur.value=''; hVxd.value='1'; hNmas.value='1';
        } else if (selTipoEl.value === 'gato_med'){
          // 15 min medicación (fijo)
          hDur.value = '15';
          // Visitas/día
          const vxdSel = document.createElement('select');
          vxdSel.innerHTML = `<option>1</option><option>2</option>`;
          const wrap2 = optionEl('Visitas por día', vxdSel.outerHTML); wrap2.dataset.svcExtra = '1'; grid.appendChild(wrap2);
          const vxdEl = wrap2.querySelector('select'); vxdEl.value='1';
          on(vxdEl,'change', ()=>{ hVxd.value = vxdEl.value; recalcBudget(); });

          // Nº de gatos
          const nm = document.createElement('input');
          nm.type='number'; nm.min='1'; nm.max='12'; nm.value='1';
          const wrap3 = optionEl('Nº de gatos', nm.outerHTML); wrap3.dataset.svcExtra='1'; grid.appendChild(wrap3);
          const nmEl = wrap3.querySelector('input');
          on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,12); recalcBudget(); });

          hVxd.value='1'; hNmas.value='1';
        } else {
          // Exóticos: 1 visita/día, sin nº mascotas
          hDur.value=''; hVxd.value='1'; hNmas.value='';
        }
      }
      rebuildVisitasOptions();

    } else if (service === 'paseos'){
      // Plan: Suelto (1 paseo/día) o Bono
      const selPlan = document.createElement('select');
      const bonoOpts = Object.keys(PRICING.paseos.bonos).map(size=>`<option value="bono:${size}">Bono ${size} paseos (${fmtEUR(PRICING.paseos.bonos[size])})</option>`).join('');
      selPlan.innerHTML = `<option value="suelto">Suelto (1 paseo/día)</option>${bonoOpts}`;
      grid.appendChild(optionEl('Plan', selPlan.outerHTML));
      const planEl = grid.querySelector('select');
      on(planEl,'change', ()=>{ hBono.value = planEl.value.startsWith('bono:') ? planEl.value.split(':')[1] : ''; recalcBudget(); });

      // Nº perros
      const nm = document.createElement('input'); nm.type='number'; nm.min='1'; nm.max='6'; nm.value='1';
      grid.appendChild(optionEl('Nº de perros', nm.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,6); recalcBudget(); });

      hNmas.value='1'; hBono.value='';

    } else if (service === 'guarderia'){
      // Plan: diario vs bono
      const selPlan = document.createElement('select');
      const gBonos = BONOS.guarderia||[];
      const bonoOpts = gBonos.map(b=>`<option value="bono:${b.size}:${b.puppy?1:0}">${b.label} (${fmtEUR(b.price)})</option>`).join('');
      selPlan.innerHTML = `<option value="diario">Diario</option>${bonoOpts}`;
      grid.appendChild(optionEl('Plan', selPlan.outerHTML));
      const planEl = grid.querySelector('select');
      on(planEl,'change', ()=>{ const v=planEl.value; hBono.value = v.startsWith('bono:') ? v.split(':')[1] : ''; recalcBudget(); });

      // Cachorro (≤6 meses)
      const chk = document.createElement('input'); chk.type='checkbox'; chk.id='guard-puppy';
      grid.appendChild(optionEl('¿Cachorro (≤ 6 meses)?', `<input type="checkbox" id="guard-puppy">`));
      const puppyEl = $id('guard-puppy');
      on(puppyEl,'change', ()=> recalcBudget());

      // Nº mascotas
      const nm = document.createElement('input'); nm.type='number'; nm.min='1'; nm.max='10'; nm.value='1';
      grid.appendChild(optionEl('Nº de mascotas', nm.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,10); recalcBudget(); });

      hNmas.value='1'; hBono.value='';

    } else if (service === 'alojamiento'){
      const chk = document.createElement('input'); chk.type='checkbox'; chk.id='stay-puppy';
      grid.appendChild(optionEl('¿Cachorro (≤ 6 meses)?', `<input type="checkbox" id="stay-puppy">`));
      const puppyEl = $id('stay-puppy'); on(puppyEl,'change', ()=> recalcBudget());

      const nm = document.createElement('input'); nm.type='number'; nm.min='1'; nm.max='6'; nm.value='1';
      grid.appendChild(optionEl('Nº de perros', nm.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,6); recalcBudget(); });
      hNmas.value='1';

    } else {
      // Servicio desconocido
    }

    // Inicializa días
    hDias.value = currentDays();
    recalcBudget();
  }

  // ======= CÁLCULO PRESUPUESTO =======
  function currentPet(){
    try{
      return {
        especie: (ensureHidden('Mascota_especie').value||'').toLowerCase(),
        puppy: /^sí$/i.test(ensureHidden('Mascota_cachorro').value||'no') || /cachorr/.test((ensureHidden('Mascota_tamano').value||'').toLowerCase())
      };
    }catch(_){ return {especie:'', puppy:false}; }
  }

  function recalcBudget(){
    const svc = ($id('service')?.value)||'';
    const b = $id('budgetBox'); if (!b) return;

    const sd = $id('startDate')?.value, ed = $id('endDate')?.value;
    const dias = Math.max(1, daysBetweenInclusive(sd, ed));
    let total = 0;
    const lines = [];

    // Comunes
    const h = (id)=> $id(id)?.value || '';
    const nMasc = num(h('svc_nmas')||1,1);
    const bonoSize = num(h('svc_bono')||0,0);

    if (svc === 'visitas'){
      const tipo = h('svc_tipo'); // gato | gato_med | aves | reptiles | pequenos
      const vxd  = num(h('svc_vxd')||1,1);
      const dur  = h('svc_dur');  // 60 | 90 | 15 (med)
      const pet = currentPet();

      if (tipo === 'gato'){
        const is90 = dur==='90';
        const T = PRICING.visitas.gato[is90?'m90':'m60'];
        // descuento desde día 11
        const d1 = Math.min(10, dias);
        const d2 = Math.max(0, dias - 10);
        const baseDia = T.base; const baseDia11 = T.fromDay11;
        const extraCats = PRICING.visitas.gato.extraCats(nMasc);
        const porVisita = (baseDia + extraCats);
        const porVisita11= (baseDia11 + extraCats);
        total += vxd * ( d1*porVisita + d2*porVisita11 );
        lines.push(`Visitas gato ${dur} min: ${vxd}/día × ${dias} día(s)`);
        if (d2>0) lines.push(`• Desde día 11 aplicado en ${d2} día(s)`);

      } else if (tipo === 'gato_med'){
        const T = PRICING.visitas.gato.m15;
        const d1 = Math.min(10, dias);
        const d2 = Math.max(0, dias - 10);
        const extraCats = PRICING.visitas.gato.extraCats(nMasc);
        const porVisita = (T.base + extraCats);
        const porVisita11= (T.fromDay11 + extraCats);
        total += vxd * ( d1*porVisita + d2*porVisita11 );
        lines.push(`Visitas medicación (15 min): ${vxd}/día × ${dias} día(s)`);
        if (d2>0) lines.push(`• Desde día 11 aplicado en ${d2} día(s)`);

      } else if (tipo === 'aves' || tipo === 'reptiles' || tipo === 'pequenos'){
        const precio = PRICING.visitas[tipo];
        total += dias * precio;
        const nice = {aves:'Aves', reptiles:'Reptiles', pequenos:'Pequeños mamíferos'}[tipo]||tipo;
        lines.push(`Visitas ${nice}: 1/día × ${dias} día(s)`);

      } else {
        lines.push('Selecciona tipo y duración.');
      }

    } else if (svc === 'paseos'){
      const dogs = nMasc;
      const plan = ($id('svc_bono')?.value) ? 'bono' : 'suelto';

      if (plan === 'bono' && bonoSize>0){
        // Un bono (ASUNCIÓN: calcula 1 bono elegido; no se reparte por rango de fechas)
        const price1 = PRICING.paseos.bonos[bonoSize] || 0;
        const extra = Math.max(0, dogs-1) * PRICING.paseos.extraDogPerWalk * bonoSize;
        total += price1 + extra;
        lines.push(`Bono ${bonoSize} paseos: 1 perro ${fmtEUR(price1)}${dogs>1?` + ${dogs-1} perro(s) extra × ${bonoSize} × ${fmtEUR(PRICING.paseos.extraDogPerWalk)} = ${fmtEUR(extra)}`:''}`);
      } else {
        // Suelto: 1 paseo/día
        const walks = dias;
        const base = PRICING.paseos.perWalk60;
        const extra = Math.max(0, dogs-1) * PRICING.paseos.extraDogPerWalk;
        total += walks * (base + extra);
        lines.push(`Paseos sueltos (60 min): 1/día × ${dias} día(s)${dogs>1?` · ${dogs} perros (+${fmtEUR(extra)}/paseo)`:''}`);
      }

    } else if (svc === 'guarderia'){
      const puppy = !!$id('guard-puppy')?.checked;
      const planVal = q('#svc-grid select')?.value || 'diario';
      const isBono = planVal.startsWith('bono:');

      if (isBono){
        // bono:<size>:<puppy?>
        const parts = planVal.split(':'); const size = +parts[1]||10; const bonoPuppy = parts[2]==='1';
        // precio 1ª mascota:
        const pack = (bonoPuppy?PRICING.guarderia.bonosPuppy:PRICING.guarderia.bonosStd)[size] || 0;
        // extras (ASUNCIÓN: se suma suplemento diario * tamaño pack para 2ª y 3ª+)
        const extraSecond = (nMasc>=2 ? PRICING.guarderia.extraDailySecond*size : 0);
        const extraThirdPlus = (nMasc>=3 ? (nMasc-2) * PRICING.guarderia.extraDailyThirdPlus * size : 0);
        total += pack + extraSecond + extraThirdPlus;
        lines.push(`${bonoPuppy?'Bono cachorros':'Bono estándar'} ${size} días: ${fmtEUR(pack)}`);
        if (nMasc>=2) lines.push(`• 2ª mascota: ${fmtEUR(extraSecond)} ( ${fmtEUR(PRICING.guarderia.extraDailySecond)} × ${size} )`);
        if (nMasc>=3) lines.push(`• ${nMasc-2} mascota(s) adicional(es): ${fmtEUR(extraThirdPlus)} ( ${fmtEUR(PRICING.guarderia.extraDailyThirdPlus)} × ${size} × ${nMasc-2} )`);
        ensureHidden('Servicio_bono_tamano').value = String(size);
        ensureHidden('Servicio_bono_puppy').value = bonoPuppy?'sí':'no';
      } else {
        // Diario
        const d1 = dias; // guardería no indica “desde día 11” → aplicar tarifa diaria directa
        const base = puppy ? PRICING.guarderia.perDayPuppy : PRICING.guarderia.perDayStd;
        const extraSecond = (nMasc>=2 ? PRICING.guarderia.extraDailySecond : 0);
        const extraThirdPlus = (nMasc>=3 ? (nMasc-2)*PRICING.guarderia.extraDailyThirdPlus : 0);
        total += d1 * ( base + extraSecond + extraThirdPlus );
        lines.push(`Guardería ${puppy?'cachorros':'estándar'}: ${dias} día(s) · ${nMasc} mascota(s)`);
        if (nMasc>=2) lines.push(`• Suplemento 2ª: ${fmtEUR(extraSecond)}/día`);
        if (nMasc>=3) lines.push(`• Suplemento 3ª+: ${fmtEUR(PRICING.guarderia.extraDailyThirdPlus)}/día × ${nMasc-2}`);
      }

    } else if (svc === 'alojamiento'){
      const puppy = !!$id('stay-puppy')?.checked;
      const dogs = nMasc;
      // Tarifa con tramo desde día 11
      const d1 = Math.min(10, dias), d2 = Math.max(0, dias-10);
      const base = puppy ? PRICING.alojamiento.perNightPuppy : PRICING.alojamiento.perNightStd;
      const base11 = puppy ? PRICING.alojamiento.fromDay11Puppy : PRICING.alojamiento.fromDay11Std;
      // Perros extra (ASUNCIÓN: 2º y 3º+ usan misma tarifa de extra)
      const extra = Math.max(0, dogs-1);
      const extraRate = PRICING.alojamiento.extraDogPerNight;
      const extraRate11= PRICING.alojamiento.extraDogFromDay11;
      total += d1 * ( base + extra*extraRate ) + d2 * ( base11 + extra*extraRate11 );
      lines.push(`Alojamiento ${puppy?'cachorros':'estándar'}: ${dogs} perro(s) × ${dias} noche(s)`);
      if (d2>0) lines.push(`• Desde día 11 aplicado (${d2} noche(s))`);
      if (extra>0) lines.push(`• Perros extra: ${extra} × ${fmtEUR(extraRate)} /noche (y ${fmtEUR(extraRate11)} desde día 11)`);

    } else {
      // sin servicio
    }

    // Desplazamiento: informativo
    lines.push(`• Transporte: base ${fmtEUR(PRICING.transporte.base)} + km (según dirección)`);

    // Depósito (si activado)
    if ((+window.TPL_DEPOSITO_PCT||0) > 0 && total > 0){
      const dep = total * (+window.TPL_DEPOSITO_PCT);
      lines.push(`• Pago anticipado (${Math.round(+window.TPL_DEPOSITO_PCT*100)}%): ${fmtEUR(dep)} (se solicita tras aceptar)`);
    }

    ensureHidden('Presupuesto_total','svc_total').value = total.toFixed(2);
    ensureHidden('Presupuesto_detalle','svc_detalle').value = '• ' + lines.join('\n• ');

    // Render
    b.innerHTML = `
      <div style="border:1px solid #eee;border-radius:10px;padding:12px;background:#fafafa">
        <strong>Presupuesto estimado</strong>
        <div style="margin:8px 0;white-space:pre-line">${('• ' + lines.join('\n• '))}</div>
        <div style="font-size:1.1rem;margin-top:6px;">Total estimado: <strong>${fmtEUR(total)}</strong></div>
      </div>
    `;

    // Resumen corto para el correo
    const sum = $id('summaryField');
    if (sum){
      const prev = sum.value ? sum.value.split(' • ').filter(Boolean) : [];
      const rest = prev.filter(s => !/^Presupuesto:/i.test(s));
      sum.value = rest.concat([`Presupuesto: ${fmtEUR(total)}`]).join(' • ');
    }
  }

  // ======= Email (EmailJS) =======
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
  function buildSummary(){
    const sd = $id('startDate')?.value || '';
    const ed = $id('endDate')?.value || '';
    const st = $id('start')?.value || '';
    const et = $id('end')?.value || '';
    const svc = serviceLabel();

    const petName  = ensureHidden('Mascota_nombre').value||'';
    const petSpec  = ensureHidden('Mascota_especie').value||'';
    const petBreed = ensureHidden('Mascota_raza').value||'';
    const petBits = [petName, [petSpec,petBreed].filter(Boolean).join(', ')].filter(Boolean).join(' ');

    const parts = [];
    if (svc) parts.push(`Servicio: ${svc}`);
    parts.push(`Fechas: ${sd || '-'} a ${ed || '-'}`);
    parts.push(`Hora: ${st || '-'} a ${et || '-'}`);
    parts.push(`Nombre: ${$id('firstName')?.value || ''} ${$id('lastName')?.value || ''}`);
    parts.push(`Email/Tel: ${$id('email')?.value || ''} / ${$id('phone')?.value || ''}`);
    if (petBits) parts.push(`Mascota: ${petBits}`);
    const cp = $id('postalCode')?.value || '';
    if (cp) parts.push(`CP: ${cp}`);
    const total = $id('svc_total')?.value; if (total) parts.push(`Presupuesto: ${fmtEUR(total)}`);
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
      Mascota_id:'Mascota · id', Mascota_cachorro:'Mascota · cachorro',
      Propietario_nombre:'Propietario · nombre', Propietario_apellidos:'Propietario · apellidos',
      Propietario_email:'Propietario · email', Propietario_telefono:'Propietario · teléfono', Propietario_cp:'Propietario · CP',
      Servicio_tipo:'Servicio · tipo', Servicio_duracion:'Servicio · duración (min)',
      Servicio_visitas_dia:'Servicio · visitas/día', Servicio_mascotas:'Servicio · nº mascotas',
      Servicio_horas:'Servicio · horas', Servicio_dias:'Servicio · días',
      Servicio_bono:'Servicio · bono (paseos/guardería)', Servicio_bono_tamano:'Servicio · bono tamaño', Servicio_bono_puppy:'Servicio · bono cachorro',
      Presupuesto_total:'Presupuesto · total', Presupuesto_detalle:'Presupuesto · detalle'
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
  async function sendBookingWithEmailJS(form){
    const fd = new FormData(form);

    // Normalizar nombre/apellidos si van juntos
    const f = $id('firstName'), l = $id('lastName');
    if (f && (!l || !l.value || /\s/.test(f.value||''))){
      const s = splitSmart(f.value);
      if (s.nombre) f.value = s.nombre;
      if (s.apellidos && (!l || !l.value)) l && (l.value = s.apellidos);
    }

    // Desglose para email
    const summary = buildSummary();
    const summaryField = $id('summaryField'); if (summaryField) summaryField.value = summary;
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
      user_uid: $id('tpl-uid')?.value || ''
    });

    const emailjs = await ensureEmailJS();
    try { emailjs.init({ publicKey: EJ.publicKey }); } catch(_){}
    return await emailjs.send(EJ.serviceId, EJ.templateId, payload, EJ.publicKey);
  }

  // ======= Guardado opcional en Firestore (no bloqueante si no hay sesión) =======
  async function saveToFirestore(payload){
    try{
      if (typeof firebase === 'undefined' || !firebase.firestore) return false;
      const db = firebase.firestore();
      if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('reservas').add(payload);
      return true;
    }catch(_){ return false; }
  }

  // ======= INIT =======
  function attach(){
    const form = $id('bookingForm'); if (!form) return;

    // UI dinámica
    ensureServiceDynamicUI();

    on($id('service'),'change', ()=> buildUIFor($id('service').value||''));
    buildUIFor($id('service')?.value||'');

    // Autorelleno ahora mismo
    hydrateFromProfile();

    // Rehidratación cuando auth esté lista/cambie (si usas Firebase)
    window.addEventListener('tpl-auth-ready', ()=> hydrateFromProfile());
    window.addEventListener('tpl-auth-change', ()=> hydrateFromProfile());

    // FAB ayuda (por si quieres)
    if (!document.getElementById('tpl-help-fab')){
      const a = document.createElement('a');
      a.id='tpl-help-fab'; a.href='ayuda.html'; a.textContent='Centro de ayuda';
      a.setAttribute('aria-label','Centro de ayuda');
      Object.assign(a.style,{position:'fixed', right:'16px', bottom:'16px', background:'#339496', color:'#fff', padding:'10px 14px', borderRadius:'999px', boxShadow:'0 4px 14px rgba(0,0,0,.15)', fontWeight:'600', textDecoration:'none', zIndex:10000});
      document.body.appendChild(a);
    }

    // Envío
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;

      // (Petición) — Ya NO bloqueamos por “debes iniciar sesión”
      // Antes de enviar: escribe estado para perfil.html
      try{
        const stamp = Date.now();
        const uid = $id('tpl-uid')?.value || 'anon';
        const item = { id: 'resv_'+stamp, estado: 'solicitada', fecha: new Date().toISOString(), page: location.href };
        const k = `tpl.reservas.${uid}`;
        const list = JSON.parse(localStorage.getItem(k)||'[]'); list.push(item);
        localStorage.setItem(k, JSON.stringify(list));
        localStorage.setItem('tpl.lastReservationStatus', 'solicitada');
        window.dispatchEvent(new CustomEvent('tpl-reserva-creada',{detail:item}));
      }catch(_){}

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
        buildUIFor($id('service')?.value||'');
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

  // ---- Pequeñas correcciones de maquetación opcionales ----
  (function fixes(){
    function movePetSection(){
      var pet = document.getElementById('tpl-pet-section');
      var serv = document.querySelector('section[aria-labelledby="sec-servicio"]');
      if (pet && serv) serv.after(pet);
    }
    function ensureSvcPlaceholder(){
      var grid = document.getElementById('svc-grid');
      var box  = document.getElementById('svc-dynamic');
      if (!box) return;
      if (!grid || !grid.childElementCount){
        var p = document.createElement('div');
        p.style.fontSize='.95rem'; p.style.color='#666';
        p.textContent='Elige un servicio para ver opciones y presupuesto.';
        (grid||box).appendChild(p);
      }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ()=>{ try{movePetSection();ensureSvcPlaceholder();}catch(_){}} );
    else { try{movePetSection();ensureSvcPlaceholder();}catch(_){} }
  })();

})();
