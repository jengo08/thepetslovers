/* reservas.js — The Pets Lovers (completo)
   - Estética/flujo como “el de antes”, sin tocar tu HTML.
   - Auto-relleno de datos de cliente + mascotas del perfil al iniciar sesión (Firebase).
   - Cálculo automático: visitas (gatos) 60/90 + 2ª medicación, paseos, guardería (bonos auto), alojamiento (desc. ≥ día 11).
   - EmailJS con template_rao5n0c (to_email explícito) + guardado en Firestore.
*/

(function(){
  'use strict';

  // ========= HELPERS =========
  const $id = (id) => document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);
  const $$ = (sel,root)=> Array.from((root||document).querySelectorAll(sel));
  const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||false);
  const num = (v,def=0)=> isFinite(+v) ? +v : def;
  const clamp = (n,min,max)=> Math.max(min, Math.min(max, n));
  function fmtEUR(n){ try{ return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(+n||0); }catch(_){ return (+(+n||0)).toFixed(2)+' €'; } }
  function getQS(k, d=null){ try{ return new URLSearchParams(location.search).get(k) ?? d; }catch(_){ return d; } }
  function daysBetweenInclusive(d1,d2){
    if(!d1||!d2) return 0;
    const a = new Date(d1), b = new Date(d2);
    a.setHours(0,0,0,0); b.setHours(0,0,0,0);
    return Math.max(0, Math.round((b - a)/86400000) + 1);
  }
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

  // ========= UDB helpers (localStorage) =========
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

  // ========= TARIFAS reales =========
  // Nota: define window.TPL_DEPOSITO_PCT = 0.20 si quieres mostrar la nota de señal (20%)
  const PRICING = {
    visitas: {
      label: 'Visitas a domicilio (gatos)',
      durations: [60, 90],
      base:     { gato: { 60: 22, 90: 30 } },              // €/visita (día 1–10)
      baseLong: { gato: { 60: 18, 90: 27 } },              // €/visita (desde día 11)
      med15: { normal: 12, long: 10 },                     // 2ª visita medicación (15’)
      visitsPerDayChoices: [1, 2],
      // suplemento por gato extra (€/visita por gato extra)
      extraCat(e) {
        if (e <= 0) return 0;
        if (e === 1) return 12;
        if (e === 2) return 8;
        return 6;
      }
    },
    paseos: {
      label: 'Paseos',
      durations: [60],
      base: { 60: 12 },             // €/paseo (1 perro)
      addlDogFixed: 8               // +8€ por perro extra (mismo paseo)
    },
    guarderia: {
      label: 'Guardería de día',
      perDay: { adult: 15, puppy: 20 },   // cachorro ≤6m
      bundles: {
        adult: { 10: 135, 20: 250, 30: 315 },
        puppy: { 10: 185, 20: 350, 30: 465 }
      }
    },
    alojamiento: {
      label: 'Alojamiento',
      perNight:          { adult: 30, puppy: 35 },
      longStayPerNight:  { adult: 27, puppy: 32 },       // desde el día 11 (aplica a todo)
      secondDogPerNight: { adult: 25, long: 22 }         // por cada perro extra
    },
    exoticos: {
      label: 'Exóticos (visitas)',
      tipos: { aves: 20, reptiles: 15, pequenos: 25 }
    },
    bodas:        { label: 'Bodas / exclusivos', perHour: 0 },
    postquir:     { label: 'Postquirúrgico',     perHour: 0 },
    transporte:   { label: 'Transporte',         base: 20 } // + km (pendiente)
  };

  // ========= HIDDEN builders =========
  function ensureHidden(name, idHint){
    let el = q(`input[name="${name}"]`);
    if (!el){
      el = document.createElement('input');
      el.type = 'hidden';
      el.name = name;
      if (idHint) el.id = idHint;
      const form = $id('bookingForm');
      form && form.appendChild(el);
    }
    return el;
  }

  // ========= UI dinámica de servicio (debajo de “Datos del servicio”) =========
  function ensureServiceDynamicUI(){
    const sec = q('section[aria-labelledby="sec-servicio"]');
    if (!sec) return null;
    let box = $id('svc-dynamic');
    if (!box){
      box = document.createElement('div');
      box.id = 'svc-dynamic';
      box.className = 'tpl-section';
      box.innerHTML = `
        <h2 style="margin-top:4px;font-size:1.05rem">Opciones del servicio</h2>
        <div class="booking-grid" id="svc-grid"></div>
        <div id="budgetBox" class="booking-field" style="margin-top:6px;grid-column:1/-1"></div>
      `;
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

  function buildUIFor(service){
    const grid = $id('svc-grid'); if (!grid) return;
    grid.innerHTML = '';

    // Hiddens para email/resumen
    const hTipo   = ensureHidden('Servicio_tipo','svc_tipo');
    const hDur    = ensureHidden('Servicio_duracion','svc_dur');
    const hVxd    = ensureHidden('Servicio_visitas_dia','svc_vxd');
    const hNmas   = ensureHidden('Servicio_mascotas','svc_nmas');
    const hHoras  = ensureHidden('Servicio_horas','svc_horas');
    const hTotal  = ensureHidden('Presupuesto_total','svc_total');
    const hDet    = ensureHidden('Presupuesto_detalle','svc_detalle');
    const hDias   = ensureHidden('Servicio_dias','svc_dias');

    const sd = $id('startDate'), ed = $id('endDate');
    function currentDays(){ return daysBetweenInclusive(sd?.value, ed?.value); }
    on(sd,'change', ()=> { hDias.value = currentDays(); recalcBudget(); });
    on(ed,'change', ()=> { hDias.value = currentDays(); recalcBudget(); });

    if (service === 'visitas'){
      const selDur = document.createElement('select');
      selDur.innerHTML = ['Elige…'].concat(PRICING.visitas.durations.map(x=>`${x} min`)).map((t,i)=>{
        const v = i===0 ? '' : PRICING.visitas.durations[i-1];
        return `<option value="${v}">${t}</option>`;
      }).join('');
      grid.appendChild(optionEl('Duración por visita', selDur.outerHTML));
      const selDurEl = grid.querySelector('select');
      on(selDurEl,'change', ()=>{ hDur.value = selDurEl.value; recalcBudget(); });

      const vxdSel = document.createElement('select');
      vxdSel.innerHTML = PRICING.visitas.visitsPerDayChoices.map(n=>`<option value="${n}">${n}</option>`).join('');
      grid.appendChild(optionEl('Visitas por día', vxdSel.outerHTML));
      const vxdEl = grid.querySelectorAll('select')[1];
      vxdEl.value = 1;
      on(vxdEl,'change', ()=>{ hVxd.value = vxdEl.value; recalcBudget(); });

      const nmInput = document.createElement('input');
      nmInput.type = 'number'; nmInput.min = '1'; nmInput.max = '10'; nmInput.value = '1';
      grid.appendChild(optionEl('Nº de gatos', nmInput.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,10); recalcBudget(); });

      hVxd.value = '1'; hNmas.value = '1'; hDias.value = currentDays();

    } else if (service === 'paseos'){
      const selDur = document.createElement('select');
      selDur.innerHTML = ['Elige…','60 min'].map((t,i)=>`<option value="${i?60:''}">${t}</option>`);
      grid.appendChild(optionEl('Duración del paseo', selDur.outerHTML));
      const selDurEl = grid.querySelector('select');
      on(selDurEl,'change', ()=>{ hDur.value = selDurEl.value || 60; recalcBudget(); });

      const nmInput = document.createElement('input');
      nmInput.type = 'number'; nmInput.min = '1'; nmInput.max = '6'; nmInput.value = '1';
      grid.appendChild(optionEl('Nº de perros (mismo paseo)', nmInput.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,6); recalcBudget(); });

      hDur.value = 60; hNmas.value = '1'; hDias.value = currentDays();

    } else if (service === 'guarderia'){
      const info = document.createElement('div');
      info.innerHTML = `<small>Se calcula por <strong>días</strong>. Si coinciden 10/20/30, aplicamos el <strong>bono automático</strong> por mascota.</small>`;
      grid.appendChild(optionEl('Info', info.outerHTML));
      hDias.value = currentDays();

    } else if (service === 'alojamiento'){
      const info = document.createElement('div');
      info.innerHTML = `<small>Se calcula por <strong>noches</strong>. Desde el <strong>día 11</strong> se aplica la tarifa reducida (para toda la estancia).</small>`;
      grid.appendChild(optionEl('Info', info.outerHTML));
      hDias.value = currentDays();

    } else if (service === 'bodas'){
      const horasInput = document.createElement('input');
      horasInput.type = 'number'; horasInput.min = '1'; horasInput.max = '16'; horasInput.value = '4';
      grid.appendChild(optionEl('Horas del servicio', horasInput.outerHTML));
      const hEl = grid.querySelector('input[type="number"]');
      on(hEl,'input', ()=>{ hHoras.value = clamp(+hEl.value||1,1,16); recalcBudget(); });
      hHoras.value = '4';
    }

    recalcBudget();
  }

  // ========= Presupuesto =========
  function isPuppySelected(){
    const m = +($id('tpl-pet-age-months')?.value || 0);
    if (m > 0) return m <= 6;
    const bd = $id('tpl-pet-birthdate')?.value;
    if (bd){
      const b = new Date(bd), now = new Date();
      const months = (now.getFullYear()-b.getFullYear())*12 + (now.getMonth()-b.getMonth());
      return months <= 6;
    }
    return false;
  }
  function getMainNumPets(){
    const v = $id('numPets')?.value || '1';
    if (v === '6+') {
      const n = +($id('numPetsExact')?.value || 6);
      return Math.max(6, n);
    }
    return Math.max(1, +v || 1);
  }

  function recalcBudget(){
    const svc = ($id('service')?.value)||'';
    const b = $id('budgetBox'); if (!b) return;
    const sd = $id('startDate')?.value, ed = $id('endDate')?.value;
    const dias = Math.max(1, daysBetweenInclusive(sd, ed));
    const longStay = dias >= 11;

    let total = 0;
    const lines = [];
    let avisoTarifa = false;

    if (svc === 'visitas'){
      const dur  = num($id('svc_dur')?.value);
      const vxd  = num($id('svc_vxd')?.value||1);
      const nmas = num($id('svc_nmas')?.value||1);
      const extra = Math.max(0, nmas - 1);

      const baseMap = longStay ? PRICING.visitas.baseLong : PRICING.visitas.base;
      const p1 = baseMap.gato?.[dur];
      if (typeof p1 !== 'number') { avisoTarifa = true; }

      const precio1 = +p1 || 0;
      const precio2 = (vxd >= 2) ? (longStay ? PRICING.visitas.med15.long : PRICING.visitas.med15.normal) : 0;

      const supUnit = PRICING.visitas.extraCat(extra);
      const supPorDia = (supUnit * extra) * vxd;

      const porDia = (precio1 + (precio2||0)) + supPorDia;
      total += porDia * dias;

      lines.push(`Visitas: ${vxd}/día · ${dur||'?'} min · ${nmas} gato(s) × ${dias} día(s)`);

    } else if (svc === 'paseos'){
      const dur  = num($id('svc_dur')?.value||60);
      const nmas = num($id('svc_nmas')?.value||1);
      const base = PRICING.paseos.base[dur];
      if (typeof base !== 'number') { avisoTarifa = true; }
      const porPaseo = +base || 0;
      const sup = PRICING.paseos.addlDogFixed || 0;
      const porDia = porPaseo + Math.max(0, nmas-1)*sup;

      total += porDia * dias;
      lines.push(`Paseos: 1 paseo/día · ${dur} min · ${nmas} perro(s) × ${dias} día(s)`);

    } else if (svc === 'guarderia'){
      const np = getMainNumPets();
      const puppy = isPuppySelected();
      const tabla = puppy ? PRICING.guarderia.bundles.puppy : PRICING.guarderia.bundles.adult;
      const pDia  = puppy ? PRICING.guarderia.perDay.puppy : PRICING.guarderia.perDay.adult;

      let totalPorMascota;
      if (tabla[dias]) {
        totalPorMascota = tabla[dias];
        lines.push(`Guardería: bono automático ${dias} días (${puppy?'cachorro':'adulto'})`);
      } else {
        totalPorMascota = pDia * dias;
        lines.push(`Guardería: ${dias} día(s) · ${puppy?'cachorro':'adulto'}`);
      }

      total += totalPorMascota * np;
      if (np > 1) lines.push(`(x${np} mascotas)`);

    } else if (svc === 'alojamiento'){
      const puppy = isPuppySelected();
      const np = getMainNumPets();
      const firstRate = (longStay ? PRICING.alojamiento.longStayPerNight : PRICING.alojamiento.perNight)[ puppy ? 'puppy' : 'adult' ];
      const extraRate = longStay ? PRICING.alojamiento.secondDogPerNight.long : PRICING.alojamiento.secondDogPerNight.adult;

      const porNoche = (+firstRate || 0) + Math.max(0, np-1) * (+extraRate || 0);
      total += porNoche * dias;

      lines.push(`Alojamiento: ${dias} noche(s) · ${puppy?'cachorro':'adulto'} · ${np} perro(s)`);

    } else if (svc === 'exoticos'){
      lines.push('Exóticos: el precio se confirmará según especie (aves/reptiles/pequeños).');

    } else if (svc === 'bodas' || svc === 'postquirurgico'){
      lines.push('Servicio a consultar: el precio final se dará tras hablar contigo.');

    } else if (svc === 'transporte'){
      lines.push('Transporte: base 20 € + km / esperas (se calcula al asignar cuidador).');
    }

    const det = [];
    if (lines.length) det.push('• ' + lines.join('\n• '));
    det.push('• Desplazamiento: pendiente (según dirección)');

    if ((+window.TPL_DEPOSITO_PCT||0) > 0 && total > 0){
      const dep = total * (+window.TPL_DEPOSITO_PCT);
      det.push(`• Pago anticipado (${Math.round(+window.TPL_DEPOSITO_PCT*100)}%): ${fmtEUR(dep)} (se solicita tras aceptar)`);
    }

    $id('svc_total') && ($id('svc_total').value = String(total.toFixed(2)));
    $id('svc_detalle') && ($id('svc_detalle').value = det.join('\n'));

    const warn = avisoTarifa ? `<div style="color:#a66;font-size:.95rem;margin:6px 0">Tarifa sin configurar para esta combinación. Ajusta PRICING y quedará automática.</div>` : '';
    b.innerHTML = `
      <div style="border:1px solid #eee;border-radius:10px;padding:12px;background:#fafafa">
        <strong>Presupuesto estimado</strong>
        <div style="margin:8px 0;white-space:pre-line">${det.join('\n')}</div>
        <div style="font-size:1.1rem;margin-top:6px;">Total estimado (sin desplazamiento): <strong>${fmtEUR(total)}</strong></div>
        ${warn}
      </div>
    `;

    // Resumen corto para Email
    const sum = $id('summaryField');
    if (sum){
      const prev = sum.value ? sum.value.split(' • ').filter(Boolean) : [];
      const rest = prev.filter(s => !/^Presupuesto:/i.test(s));
      sum.value = rest.concat([`Presupuesto: ${fmtEUR(total)} (sin desplazamiento)`]).join(' • ');
    }
  }

  // ========= Preselección desde URL =========
  function hydrateFromURL(){
    const mapServ = (s)=>({ 'visitas':'visitas','paseos':'paseos','guarderia':'guarderia','guardería':'guarderia','alojamiento':'alojamiento','bodas':'bodas','postquirurgico':'postquirurgico','post-quirurgico':'postquirurgico','postquir':'postquirurgico','transporte':'transporte','exoticos':'exoticos','exótico':'exoticos' }[String(s||'').toLowerCase()]||'');
    const serviceEl = $id('service');
    if (!serviceEl) return;

    const s = mapServ(getQS('serv') || getQS('service') || getQS('servicio') || '');
    if (s){
      serviceEl.value = s;
      serviceEl.dispatchEvent(new Event('change',{bubbles:true}));
    }
    // Subopciones
    const setLater = ()=> {
      if (!$id('svc-dynamic')) { setTimeout(setLater, 60); return; }
      const dur  = getQS('dur') || getQS('duracion') || getQS('duración');
      const vxd  = getQS('vxd') || getQS('visitas_dia') || getQS('vd');
      const nmas = getQS('n') || getQS('mascotas');
      const horas= getQS('h') || getQS('horas');

      if (dur  && $id('svc_dur'))  $id('svc_dur').value  = dur,  recalcBudget();
      if (vxd  && $id('svc_vxd'))  $id('svc_vxd').value  = vxd,  recalcBudget();
      if (nmas && $id('svc_nmas')) $id('svc_nmas').value = nmas, recalcBudget();
      if (horas&& $id('svc_horas'))$id('svc_horas').value= horas,recalcBudget();
    };
    setLater();
  }

  // ========= EMAILJS =========
  const EJ = (function(){
    const cfg = window.TPL_EMAILJS || {};
    return {
      serviceId: cfg.serviceId || 'service_odjqrfl',
      templateId: cfg.templateId || cfg.templates?.reserva || 'template_rao5n0c',
      publicKey:  cfg.publicKey  || 'L2xAATfVuHJwj4EIV',
      toEmail:    (cfg.adminEmail || cfg.toEmail || '').trim() || 'gestion@thepetslovers.es',
      toName:     cfg.toName || 'Gestión The Pets Lovers',
    };
  })();

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

  function serviceLabel(){
    const s = $id('service');
    if (!s) return '';
    const opt = s.options[s.selectedIndex];
    return (opt && opt.text) ? opt.text.trim() : '';
  }
  function buildSummary(){
    const sd = $id('startDate')?.value || '';
    const ed = $id('endDate')?.value || '';
    const st = $id('start')?.value || '';
    const et = $id('end')?.value || '';
    const svc = serviceLabel();

    const parts = [];
    if (svc) parts.push(`Servicio: ${svc}`);
    parts.push(`Fechas: ${sd || '-'} a ${ed || '-'}`);
    parts.push(`Hora: ${st || '-'} a ${et || '-'}`);
    parts.push(`Nombre: ${$id('firstName')?.value || ''} ${$id('lastName')?.value || ''}`);
    parts.push(`Email/Tel: ${$id('email')?.value || ''} / ${$id('phone')?.value || ''}`);

    const cp = $id('postalCode')?.value || '';
    const regionSel = $id('region');
    const ccaaText = regionSel ? (regionSel.options[regionSel.selectedIndex]?.text || '') : '';
    if (cp) parts.push(`CP: ${cp}`);
    if (ccaaText) parts.push(`CCAA: ${ccaaText}`);

    const total = $id('svc_total')?.value;
    if (total) parts.push(`Presupuesto: ${fmtEUR(total)} (sin desplazamiento)`);

    return parts.join(' | ');
  }
  function buildHtmlTable(fd){
    const map = {
      Servicio:'Servicio', Fecha_inicio:'Fecha inicio', Fecha_fin:'Fecha fin',
      Hora_inicio:'Hora inicio', Hora_fin:'Hora fin',
      Nombre:'Nombre', Apellidos:'Apellidos', Email:'Email', Telefono:'Teléfono', Notas:'Notas',
      Direccion:'Dirección', CP:'Código Postal', CCAA:'Comunidad Autónoma',
      Mascota_id:'Mascota · id', Mascota_nombre:'Mascota · nombre', Mascota_especie:'Mascota · especie',
      Mascota_raza:'Mascota · raza', Mascota_tamano:'Mascota · tamaño', Mascota_medicacion:'Mascota · medicación',
      Mascota_necesidades:'Mascota · necesidades', Mascota_birthdate:'Mascota · nacimiento', Mascota_edad_meses:'Mascota · edad (meses)',
      Servicio_tipo:'Servicio · tipo', Servicio_duracion:'Servicio · duración (min)',
      Servicio_visitas_dia:'Servicio · visitas/día', Servicio_mascotas:'Servicio · nº mascotas',
      Servicio_horas:'Servicio · horas', Servicio_dias:'Servicio · días',
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

    // normalizar nombre/apellidos si escribió todo en "Nombre"
    const f = $id('firstName'), l = $id('lastName');
    if (f && (!l || !l.value || /\s/.test(f.value||''))){
      const s = splitSmart(f.value);
      if (s.nombre) f.value = s.nombre;
      if (s.apellidos && (!l || !l.value)) l && (l.value = s.apellidos);
    }

    const summary = buildSummary();
    const summaryField = $id('summaryField');
    if (summaryField) summaryField.value = summary;
    fd.set('Desglose', summary);

    const payload = Object.fromEntries(fd.entries());
    Object.assign(payload, {
      to_email: EJ.toEmail,               // requerido por la plantilla
      to_name:  EJ.toName,
      reply_to: $id('email')?.value || payload.Email || '',
      from_name: `${$id('firstName')?.value||''} ${$id('lastName')?.value||''}`.trim(),
      subject: 'Nueva reserva — The Pets Lovers',
      service_label: serviceLabel(),
      page_url: location.href,
      message_html: buildHtmlTable(fd),
      user_uid: $id('tpl-uid')?.value || ''
    });

    const emailjs = await ensureEmailJS();
    try { emailjs.init({ publicKey: EJ.publicKey }); } catch(_){}
    return await emailjs.send(EJ.serviceId, EJ.templateId, payload, EJ.publicKey);
  }

  // ========= FIRESTORE =========
  async function saveToFirestore(payload){
    if (typeof firebase === 'undefined' || !firebase.firestore) return false;
    try{
      const db = firebase.firestore();
      if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection('reservas').add(payload);
      return true;
    }catch(_){ return false; }
  }

  // ========= Mascotas (perfil) =========
  function normalizePet(p){
    if (!p) return null;
    const id  = p.id || p.uid || p._id || p.chip || p.chipid || p.microchip || null;
    const nombre = p.nombre || p.name || p.petName || '';
    const especie = p.especie || p.tipo || p.species || p.type || '';
    const raza = p.raza || p.breed || '';
    const tam = p.tamano || p['tamaño'] || p.size || '';
    const meds = p.medicacion || p['medicación'] || p.medication || '';
    const needs = p.necesidades || p.needs || p.specialNeeds || '';
    const birth = p.birthdate || p.fecha_nacimiento || p.nacimiento || '';
    const edadM = p.edadMeses || p.edad_meses || '';
    return { id, nombre, especie, raza, tamano: tam, medicacion: meds, necesidades: needs, birthdate: birth, edadMeses: edadM };
  }
  async function loadPetsFromFirestore(uid){
    const list = [];
    try{
      if (typeof firebase === 'undefined' || !firebase.firestore) return list;
      const db = firebase.firestore();
      const path = db.collection('users').doc(uid);

      // subcolecciones
      const s1 = await path.collection('mascotas').get().catch(()=>null);
      if (s1 && !s1.empty) s1.forEach(d=> list.push(Object.assign({id:d.id}, d.data())));
      const s2 = await path.collection('pets').get().catch(()=>null);
      if (s2 && !s2.empty) s2.forEach(d=> list.push(Object.assign({id:d.id}, d.data())));

      // arrays en el doc
      const main = await path.get().catch(()=>null);
      if (main && main.exists){
        const data = main.data() || {};
        toArrayMaybe(data.mascotas).forEach(p => list.push(p));
        toArrayMaybe(data.pets).forEach(p => list.push(p));
      }
    }catch(_){}
    return list.map(normalizePet).filter(Boolean);
  }
  function applyPetHidden(p){
    const map = {
      'tpl-pet-id': p.id||'',
      'tpl-pet-name': p.nombre||'',
      'tpl-pet-species': p.especie||'',
      'tpl-pet-breed': p.raza||'',
      'tpl-pet-size': p.tamano||'',
      'tpl-pet-med': p.medicacion||'',
      'tpl-pet-needs': p.necesidades||'',
      'tpl-pet-birthdate': p.birthdate || '',
      'tpl-pet-age-months': p.edadMeses || ''
    };
    Object.keys(map).forEach(id=>{
      const el = $id(id); if (el) el.value = map[id];
    });
  }
  function renderPets(uid, pets){
    const sec = $id('tpl-pet-section');
    const sel = $id('tpl-pet-select');
    const list = (pets||[]).map(normalizePet).filter(Boolean);
    if (!list.length){ if (sec) sec.hidden = true; return; }
    if (list.length === 1){
      if (sec) sec.hidden = true;
      applyPetHidden(list[0]);
      recalcBudget();
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

  // ========= Perfil (cliente) =========
  async function autoFillFromProfile(user){
    if (!user || user.isAnonymous) return;

    const emailEl = $id('email');
    const firstEl = $id('firstName');
    const lastEl  = $id('lastName');
    const phoneEl = $id('phone');
    const addrEl  = $id('location');
    const cpEl    = $id('postalCode');
    const ccaaSel = $id('region');

    // datos básicos del auth
    if (user.email) setIfEmpty(emailEl, user.email);
    const sp = splitSmart(user.displayName || '');
    setIfEmpty(firstEl, sp.nombre);
    setIfEmpty(lastEl,  sp.apellidos);

    // buscar doc en Firestore
    try{
      if (typeof firebase !== 'undefined' && firebase.firestore){
        const db = firebase.firestore();
        const doc = await db.collection('users').doc(user.uid).get().catch(()=>null);
        const d = doc && doc.exists ? doc.data() : null;

        if (d){
          setIfEmpty(firstEl, d.nombre || d.name || '');
          setIfEmpty(lastEl,  d.apellidos || d.surname || '');
          setIfEmpty(emailEl, d.email || '');
          setIfEmpty(phoneEl, d.telefono || d.phone || '');
          setIfEmpty(addrEl,  d.direccion || d.address || '');
          setIfEmpty(cpEl,    d.cp || d.postal || d.zip || '');

          if (ccaaSel && d.ccaa){
            const val = (''+d.ccaa).toLowerCase();
            const found = [...ccaaSel.options].find(o=> (o.value===val) || (o.text||'').toLowerCase().includes(val));
            if (found) ccaaSel.value = found.value;
          }
        }
      }
    }catch(_){}

    // Hidden tracking
    ensureHidden('reply_to','tpl-replyto').value = (emailEl && emailEl.value) ? emailEl.value : (user.email || '');
    ensureHidden('user_uid','tpl-uid').value = user.uid || '';
    ensureHidden('perfil_url','tpl-perfil-url').value = 'perfil.html';

    // Mascotas: primero local cache, luego Firestore
    const udbPets = toArrayMaybe(udbGet(user.uid,'mascotas') || udbGet(user.uid,'pets')).map(normalizePet).filter(Boolean);
    if (udbPets.length){ renderPets(user.uid, udbPets); }
    else {
      const list = await loadPetsFromFirestore(user.uid);
      if (list && list.length){
        renderPets(user.uid, list);
        udbSet(user.uid, 'mascotas', list); // cache local
      }
    }
  }

  // ========= Overlay =========
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

  // ========= Auth helpers =========
  function isLogged(){
    try{
      const a = firebase && firebase.auth && firebase.auth();
      const u = a && a.currentUser;
      return !!(u && !u.isAnonymous);
    }catch(_){ return false; }
  }
  function toggleAuthUI(logged){
    const form = $id('bookingForm');
    const wall = $id('authWall');
    if (form) form.classList.toggle('disabled', !logged);
    if (wall) wall.style.display = logged ? 'none' : 'block';
  }

  // ========= INIT =========
  function attach(){
    const form = $id('bookingForm');
    if (!form) return;

    // Evitar duplicar handlers
    form.setAttribute('data-tpl-emailjs','false');

    // Crear hiddens de mascota/perfil si no existen
    ensureHidden('Mascota_id','tpl-pet-id');
    ensureHidden('Mascota_nombre','tpl-pet-name');
    ensureHidden('Mascota_especie','tpl-pet-species');
    ensureHidden('Mascota_raza','tpl-pet-breed');
    ensureHidden('Mascota_tamano','tpl-pet-size');
    ensureHidden('Mascota_medicacion','tpl-pet-med');
    ensureHidden('Mascota_necesidades','tpl-pet-needs');
    ensureHidden('Mascota_birthdate','tpl-pet-birthdate');
    ensureHidden('Mascota_edad_meses','tpl-pet-age-months');
    ensureHidden('reply_to','tpl-replyto');
    ensureHidden('user_uid','tpl-uid');
    ensureHidden('perfil_url','tpl-perfil-url');

    // UI dinámica de servicio
    ensureServiceDynamicUI();
    on($id('service'),'change', ()=>{ buildUIFor($id('service').value || ''); });
    buildUIFor($id('service')?.value||'');
    hydrateFromURL();

    // Ayuda FAB
    if (!document.getElementById('tpl-help-fab')){
      const a = document.createElement('a');
      a.id = 'tpl-help-fab';
      a.href = 'ayuda.html';
      a.textContent = 'Centro de ayuda';
      a.setAttribute('aria-label','Centro de ayuda');
      Object.assign(a.style, {
        position:'fixed', right:'16px', bottom:'16px',
        background:'#339496', color:'#fff', padding:'10px 14px',
        borderRadius:'999px', boxShadow:'0 4px 14px rgba(0,0,0,.15)',
        fontWeight:'600', textDecoration:'none', zIndex:10000
      });
      document.body.appendChild(a);
    }

    // Auth: activar/desactivar + auto-relleno como antes
    try{
      if (typeof firebase !== 'undefined' && firebase.auth){
        const auth = firebase.auth();
        auth.onAuthStateChanged(async (user)=>{
          toggleAuthUI(!!user && !user.isAnonymous);
          if (user && !user.isAnonymous){
            await autoFillFromProfile(user);
          }
        });
        // por si ya está logueado al cargar
        if (auth.currentUser){ toggleAuthUI(true); autoFillFromProfile(auth.currentUser); }
        else { toggleAuthUI(false); }
      }
    }catch(_){}

    // Envío
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
})();

/* TPL: fixes visuales opcionales (no rompen si faltan nodos) */
(function(){
  'use strict';
  function movePetSection(){
    var pet = document.getElementById('tpl-pet-section');
    var serv = document.querySelector('section[aria-labelledby="sec-servicio"]');
    var titular = document.querySelector('section[aria-labelledby="sec-titular"]');
    if (pet && serv && titular) {
      serv.after(pet);  // queda entre “Datos del servicio” y “Titular”
      pet.hidden = pet.hidden && false;
    }
  }
  function hideFreeNamePets(){
    var sec = document.querySelector('section[aria-labelledby="sec-mascotas"]');
    if (sec) sec.style.display = 'none';
  }
  function ensureSvcPlaceholder(){
    var grid = document.getElementById('svc-grid');
    var box  = document.getElementById('svc-dynamic');
    if (!box) return;
    if (!grid || !grid.childElementCount){
      var p = document.createElement('div');
      p.style.fontSize='.95rem';
      p.style.color='#666';
      p.textContent='Elige un servicio para ver opciones y presupuesto.';
      (grid||box).appendChild(p);
    }
  }
  function runFixes(){
    try{ movePetSection(); }catch(_){}
    try{ hideFreeNamePets(); }catch(_){}
    try{ ensureSvcPlaceholder(); }catch(_){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runFixes);
  else runFixes();
})();
