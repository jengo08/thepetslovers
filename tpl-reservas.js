/* reservas.js — envío con EmailJS usando template_rao5n0c y to_email explícito */
(function(){
  'use strict';

  // ========= UTIL =========
  const $id = (id) => document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);

  /* TPL: INICIO BLOQUE NUEVO [Helpers útiles] */
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

  // ========= CONFIG NUEVA (sin tocar HTML) =========
  /* TPL: INICIO BLOQUE NUEVO [Motor de servicios + tarifas “plug-in”] */

  // ⚙️ Ajusta aquí las tarifas cuando quieras. He dejado 0 como placeholder.
  // Base por unidad:
  // - visitas: precio por visita, depende de especie y duración
  // - paseos: precio por paseo, depende de duración
  // - guarderia: precio por día
  // - alojamiento: precio por noche (día)
  // - bodas: precio por hora
  const PRICING = {
    visitas: {
      label: 'Visitas a domicilio',
      durations: [60, 90],
      species: ['gato','perro','exótico'],
      base: {
        gato:   {60: 0,  90: 0},
        perro:  {60: 0,  90: 0},
        exótico:{60: 0,  90: 0}
      },
      addlPetPct: 0,           // p.ej. 0.5 → 50% por mascota adicional
      visitsPerDayChoices: [1,2,3]
    },
    paseos: {
      label: 'Paseos',
      durations: [30, 60],
      base: { 30: 0, 60: 0 },  // por paseo
      addlDogPct: 0            // p.ej. 0.4 para segundo perro
    },
    guarderia: {
      label: 'Guardería de día',
      perDay: 0                // por día
    },
    alojamiento: {
      label: 'Alojamiento',
      perNight: 0              // por noche (día)
    },
    bodas: {
      label: 'Bodas / exclusivos',
      perHour: 0               // por hora
    }
  };

  // % de depósito a mostrar (no cobramos aún). Pon 0 para ocultarlo.
  window.TPL_DEPOSITO_PCT = typeof window.TPL_DEPOSITO_PCT === 'number' ? window.TPL_DEPOSITO_PCT : 0;

  // Crea/actualiza inputs ocultos sin tocar el HTML original
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

  // Construye el subform dinámico debajo de “Datos del servicio”
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
    // Aseguramos ocultos que mandaremos por EmailJS
    const hTipo   = ensureHidden('Servicio_tipo','svc_tipo');
    const hDur    = ensureHidden('Servicio_duracion','svc_dur');
    const hVxd    = ensureHidden('Servicio_visitas_dia','svc_vxd');
    const hNmas   = ensureHidden('Servicio_mascotas','svc_nmas');
    const hHoras  = ensureHidden('Servicio_horas','svc_horas');
    const hTotal  = ensureHidden('Presupuesto_total','svc_total');
    const hDet    = ensureHidden('Presupuesto_detalle','svc_detalle');
    const hDias   = ensureHidden('Servicio_dias','svc_dias');

    // Controles comunes
    const sd = $id('startDate'), ed = $id('endDate');
    function currentDays(){
      return daysBetweenInclusive(sd?.value, ed?.value);
    }
    on(sd,'change', ()=> { hDias.value = currentDays(); recalcBudget(); });
    on(ed,'change', ()=> { hDias.value = currentDays(); recalcBudget(); });

    // Por servicio:
    if (service === 'visitas'){
      // Especie
      const selTipo = document.createElement('select');
      ['Elige…','Gato','Perro','Exótico'].forEach((t,i)=>{
        const o = new Option(t, t.toLowerCase());
        if (i===0) o.value = '';
        selTipo.appendChild(o);
      });
      grid.appendChild(optionEl('Tipo de mascota', selTipo.outerHTML));
      const selTipoEl = grid.querySelector('select');
      on(selTipoEl,'change', ()=>{ hTipo.value = selTipoEl.value; recalcBudget(); });

      // Duración
      const s = PRICING.visitas.durations;
      const selDur = document.createElement('select');
      selDur.innerHTML = ['Elige…'].concat(s.map(x=>`${x} min`)).map((t,i)=>{
        const v = i===0 ? '' : s[i-1];
        return `<option value="${v}">${t}</option>`;
      }).join('');
      grid.appendChild(optionEl('Duración por visita', selDur.outerHTML));
      const selDurEl = grid.querySelectorAll('select')[1];
      on(selDurEl,'change', ()=>{ hDur.value = selDurEl.value; recalcBudget(); });

      // Visitas por día
      const vxdSel = document.createElement('select');
      vxdSel.innerHTML = PRICING.visitas.visitsPerDayChoices.map(n=>`<option value="${n}">${n}</option>`).join('');
      grid.appendChild(optionEl('Visitas por día', vxdSel.outerHTML));
      const vxdEl = grid.querySelectorAll('select')[2];
      vxdEl.value = 1;
      on(vxdEl,'change', ()=>{ hVxd.value = vxdEl.value; recalcBudget(); });

      // Nº mascotas
      const nmInput = document.createElement('input');
      nmInput.type = 'number'; nmInput.min = '1'; nmInput.max = '10'; nmInput.value = '1';
      grid.appendChild(optionEl('Nº de mascotas', nmInput.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,10); recalcBudget(); });

      // Iniciales
      hVxd.value = '1'; hNmas.value = '1'; hDias.value = currentDays();

    } else if (service === 'paseos'){
      // Duración
      const s = PRICING.paseos.durations;
      const selDur = document.createElement('select');
      selDur.innerHTML = ['Elige…'].concat(s.map(x=>`${x} min`)).map((t,i)=>{
        const v = i===0 ? '' : s[i-1];
        return `<option value="${v}">${t}</option>`;
      }).join('');
      grid.appendChild(optionEl('Duración del paseo', selDur.outerHTML));
      const selDurEl = grid.querySelector('select');
      on(selDurEl,'change', ()=>{ hDur.value = selDurEl.value; recalcBudget(); });

      // Nº perros
      const nmInput = document.createElement('input');
      nmInput.type = 'number'; nmInput.min = '1'; nmInput.max = '6'; nmInput.value = '1';
      grid.appendChild(optionEl('Nº de perros', nmInput.outerHTML));
      const nmEl = grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value = clamp(+nmEl.value||1,1,6); recalcBudget(); });

      hNmas.value = '1'; hDias.value = currentDays();

    } else if (service === 'guarderia'){
      // Sin opciones: se calcula por días
      const info = document.createElement('div');
      info.innerHTML = `<small>Se calcula por <strong>días completos</strong> de guardería.</small>`;
      grid.appendChild(optionEl('Info', info.outerHTML));
      hDias.value = currentDays();

    } else if (service === 'alojamiento'){
      const info = document.createElement('div');
      info.innerHTML = `<small>Se calcula por <strong>noches</strong> (días entre inicio y fin).</small>`;
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

  // Cálculo del presupuesto (sin desplazamiento; depósito opcional visible)
  function recalcBudget(){
    const svc = ($id('service')?.value)||'';
    const b = $id('budgetBox'); if (!b) return;
    const sd = $id('startDate')?.value, ed = $id('endDate')?.value;
    const dias = daysBetweenInclusive(sd, ed);

    let total = 0;
    const lines = [];
    let avisoTarifa = false;

    if (svc === 'visitas'){
      const tipo = $id('svc_tipo')?.value || '';
      const dur  = num($id('svc_dur')?.value);
      const vxd  = num($id('svc_vxd')?.value||1);
      const nmas = num($id('svc_nmas')?.value||1);

      const base = PRICING.visitas.base[(tipo||'').replace('ó','o')]?.[dur];
      if (!base && base !== 0){ avisoTarifa = true; }
      const porVisita = +base || 0;
      const porDia = porVisita * vxd * ( nmas>1 ? (1 + (nmas-1)*(PRICING.visitas.addlPetPct||0)) : 1);
      total += porDia * Math.max(dias,1);

      lines.push(`Visitas: ${vxd}/día · ${dur||'?'} min · ${nmas} mascota(s) × ${Math.max(dias,1)} día(s)`);

    } else if (svc === 'paseos'){
      const dur  = num($id('svc_dur')?.value);
      const nmas = num($id('svc_nmas')?.value||1);
      const base = PRICING.paseos.base[dur];
      if (!base && base !== 0){ avisoTarifa = true; }
      const porPaseo = +base || 0;
      // Asumimos 1 paseo por día (si necesitas varios, lo añadimos)
      const porDia = porPaseo * ( nmas>1 ? (1 + (nmas-1)*(PRICING.paseos.addlDogPct||0)) : 1);
      total += porDia * Math.max(dias,1);

      lines.push(`Paseos: 1 paseo/día · ${dur||'?'} min · ${nmas} perro(s) × ${Math.max(dias,1)} día(s)`);

    } else if (svc === 'guarderia'){
      const p = PRICING.guarderia.perDay;
      if (p === undefined){ avisoTarifa = true; }
      total += ( +p || 0 ) * Math.max(dias,1);
      lines.push(`Guardería: ${Math.max(dias,1)} día(s)`);

    } else if (svc === 'alojamiento'){
      const p = PRICING.alojamiento.perNight;
      if (p === undefined){ avisoTarifa = true; }
      total += ( +p || 0 ) * Math.max(dias,1);
      lines.push(`Alojamiento: ${Math.max(dias,1)} noche(s)`);

    } else if (svc === 'bodas'){
      const h = num($id('svc_horas')?.value||0);
      const p = PRICING.bodas.perHour;
      if (p === undefined){ avisoTarifa = true; }
      total += ( +p || 0 ) * Math.max(h,1);
      lines.push(`Bodas/exclusivos: ${Math.max(h,1)} hora(s)`);
    }

    const det = [];
    if (lines.length) det.push('• ' + lines.join('\n• '));

    // Desplazamiento: pendiente
    det.push('• Desplazamiento: pendiente (según dirección)');

    // Depósito (solo visible si lo activas)
    let depositoLine = '';
    if ((+window.TPL_DEPOSITO_PCT||0) > 0 && total > 0){
      const dep = total * (+window.TPL_DEPOSITO_PCT);
      depositoLine = `• Pago anticipado (${Math.round(+window.TPL_DEPOSITO_PCT*100)}%): ${fmtEUR(dep)} (se solicita tras aceptar)`;
      det.push(depositoLine);
    }

    $id('svc_total') && ($id('svc_total').value = String(total.toFixed(2)));
    $id('svc_detalle') && ($id('svc_detalle').value = det.join('\n'));

    // Render caja
    const warn = avisoTarifa ? `<div style="color:#a66;font-size:.95rem;margin:6px 0">Tarifas por definir para esta combinación. Ajusta la tabla en PRICING y quedará automático.</div>` : '';
    b.innerHTML = `
      <div style="border:1px solid #eee;border-radius:10px;padding:12px;background:#fafafa">
        <strong>Presupuesto estimado</strong>
        <div style="margin:8px 0;white-space:pre-line">${det.join('\n')}</div>
        <div style="font-size:1.1rem;margin-top:6px;">Total estimado (sin desplazamiento): <strong>${fmtEUR(total)}</strong></div>
        ${warn}
      </div>
    `;

    // Empujar resumen corto al hidden de tu Email
    const sum = $id('summaryField');
    if (sum){
      const prev = sum.value ? sum.value.split(' • ').filter(Boolean) : [];
      const rest = prev.filter(s => !/^Presupuesto:/i.test(s));
      sum.value = rest.concat([`Presupuesto: ${fmtEUR(total)} (sin desplazamiento)`]).join(' • ');
    }
  }

  // Preselección por URL (desde Servicios). Acepta varias claves:
  // ?serv=visitas&tipo=gato&dur=60&vxd=2&n=1  (ejemplo)
  function hydrateFromURL(){
    const mapServ = (s)=>({ 'visitas':'visitas','paseos':'paseos','guarderia':'guarderia','guardería':'guarderia','alojamiento':'alojamiento','bodas':'bodas' }[String(s||'').toLowerCase()]||'');
    const serviceEl = $id('service');
    if (!serviceEl) return;

    const s = mapServ(getQS('serv') || getQS('servicio') || '');
    if (s){
      serviceEl.value = s;
      serviceEl.dispatchEvent(new Event('change',{bubbles:true}));
    }

    // Rellenar subopciones si existen
    const setLater = ()=> {
      if (!$id('svc-dynamic')) { setTimeout(setLater, 60); return; }
      const tipo = (getQS('tipo')||'').toLowerCase();
      const dur  = getQS('dur') || getQS('duracion') || getQS('duración');
      const vxd  = getQS('vxd') || getQS('visitas_dia') || getQS('vd');
      const nmas = getQS('n') || getQS('mascotas');
      const horas= getQS('h') || getQS('horas');

      if (tipo && $id('svc_tipo')) $id('svc_tipo').value = tipo, recalcBudget();
      if (dur  && $id('svc_dur'))  $id('svc_dur').value  = dur,  recalcBudget();
      if (vxd  && $id('svc_vxd'))  $id('svc_vxd').value  = vxd,  recalcBudget();
      if (nmas && $id('svc_nmas')) $id('svc_nmas').value = nmas, recalcBudget();
      if (horas&& $id('svc_horas'))$id('svc_horas').value= horas,recalcBudget();
    };
    setLater();
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

    // Presupuesto corto
    const total = $id('svc_total')?.value;
    if (total) parts.push(`Presupuesto: ${fmtEUR(total)} (sin desplazamiento)`);

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
        if (q2 && !q2.empty){ q2.forEach(d => list.push(Object.assign({id:d.id}, d.data())); }
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
      const label = (p.nombre || 'Mascota') + (meta?` (${meta})`:``);
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

    /* TPL: INICIO BLOQUE NUEVO [UI dinámica de servicios + ayuda] */
    ensureServiceDynamicUI();

    // Cuando cambie el servicio, pintamos sus opciones y recalculamos
    on($id('service'),'change', ()=>{
      const svc = $id('service').value || '';
      buildUIFor(svc);
    });

    // Construir una vez por si ya hay valor
    buildUIFor($id('service')?.value||'');

    // Preselección vía URL (desde página de servicios)
    hydrateFromURL();

    // Botón flotante “Centro de ayuda”
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
    /* TPL: FIN BLOQUE NUEVO */

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

      // Congelar botón
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
        // Reset UI presupuesto
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
/* TPL: FIX ESTRUCTURA Y FAB AYUDA — pegar al final de reservas.js */
(function(){
  'use strict';
  function movePetSection(){
    var pet = document.getElementById('tpl-pet-section');
    var serv = document.querySelector('section[aria-labelledby="sec-servicio"]');
    var titular = document.querySelector('section[aria-labelledby="sec-titular"]');
    if (pet && serv && titular) {
      serv.after(pet);           // → queda entre servicio y contacto
      pet.hidden = pet.hidden && false; // por si estaba hidden por defecto
    }
  }
  function hideFreeNamePets(){
    var sec = document.querySelector('section[aria-labelledby="sec-mascotas"]');
    if (sec) sec.style.display = 'none'; // ocultar “Mascotas” (nombres libres)
  }
  function ensureHelpFab(){
    if (document.getElementById('tpl-help-fab')) return;
    var a = document.createElement('a');
    a.id='tpl-help-fab';
    a.href='ayuda.html';
    a.textContent='Centro de ayuda';
    a.setAttribute('aria-label','Centro de ayuda');
    Object.assign(a.style,{
      position:'fixed', right:'16px', bottom:'16px',
      background:'#339496', color:'#fff', padding:'10px 14px',
      borderRadius:'999px', boxShadow:'0 4px 14px rgba(0,0,0,.15)',
      fontWeight:'600', textDecoration:'none', zIndex:'99999'
    });
    document.body.appendChild(a);
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
    try{ ensureHelpFab(); }catch(_){}
    try{ ensureSvcPlaceholder(); }catch(_){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', runFixes);
  else runFixes();
})();
