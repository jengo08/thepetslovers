/* reservas.js — completo (autorrelleno perfil + UI servicio + email unificado + Firestore + flags perfil) */
(function(){
  'use strict';

  /* ==================== HELPERS ==================== */
  const $id = (id) => document.getElementById(id);
  const q = (sel,root)=> (root||document).querySelector(sel);
  const $$ = (sel,root)=> Array.from((root||document).querySelectorAll(sel));
  const on = (el,ev,fn,opt)=> el && el.addEventListener(ev,fn,opt||false);
  const num = (v,def=0)=> isFinite(+v) ? +v : def;
  const clamp = (n,min,max)=> Math.max(min, Math.min(max, n));
  const fmtEUR = (n)=>{ try{ return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(+n||0) }catch(_){ return (+(+n||0)).toFixed(2)+' €'} };
  const getQS = (k, d=null)=> { try{ return new URLSearchParams(location.search).get(k) ?? d; }catch(_){ return d; } };
  const daysBetweenInclusive = (d1,d2)=>{ if(!d1||!d2) return 0; const a=new Date(d1), b=new Date(d2); a.setHours(0,0,0,0); b.setHours(0,0,0,0); return Math.max(0, Math.round((b-a)/86400000)+1); };
  const nowIso = ()=> new Date().toISOString();

  /* ==================== CONFIG ==================== */
  // Lee de window.TPL_EMAILJS que defines en el HTML
  const EJ = (function(){
    const cfg = window.TPL_EMAILJS || {};
    return {
      serviceId: cfg.serviceId || cfg.service || 'service_odjqrfl',
      templateId: (cfg.templates && (cfg.templates.reserva || cfg.templates.booking)) || cfg.templateId || 'template_rao5n0c',
      publicKey:  cfg.publicKey  || cfg.userId || 'L2xAATfVuHJwj4EIV',
      adminEmail: (cfg.adminEmail || '').trim()
    };
  })();

  // % depósito solo informativo en el desglose (no se cobra aquí)
  const TPL_DEPOSITO_PCT = (typeof window.TPL_DEPOSITO_PCT === 'number') ? window.TPL_DEPOSITO_PCT : 0;

  /* ==================== HIDDENS ==================== */
  function ensureHidden(name, id){
    let el = q(`input[name="${name}"]`);
    if (!el){
      el = document.createElement('input');
      el.type='hidden'; el.name=name; if(id) el.id=id;
      const form = $id('bookingForm'); form && form.appendChild(el);
    }
    return el;
  }
  function ensureCoreHiddens(){
    ensureHidden('Desglose','summaryField');
    ensureHidden('Mascotas_detalle','petsDetail');
    ensureHidden('Mascotas_detalle_json','petsDetailJson');
    ensureHidden('Mascotas_lista','petsListHidden');

    // espejo mascota “seleccionada”
    ensureHidden('Mascota_id','tpl-pet-id');
    ensureHidden('Mascota_nombre','tpl-pet-name');
    ensureHidden('Mascota_especie','tpl-pet-species');
    ensureHidden('Mascota_raza','tpl-pet-breed');
    ensureHidden('Mascota_tamano','tpl-pet-size');
    ensureHidden('Mascota_medicacion','tpl-pet-med');
    ensureHidden('Mascota_necesidades','tpl-pet-needs');
    ensureHidden('Mascota_birthdate','tpl-pet-birthdate');
    ensureHidden('Mascota_edad_meses','tpl-pet-age-months');

    // owner / meta
    ensureHidden('user_uid','tpl-uid');
    ensureHidden('reply_to','tpl-replyto');
    ensureHidden('Perfil_url','tpl-perfil-url');

    // presupuesto “motor 2”
    ensureHidden('Presupuesto_total','svc_total');
    ensureHidden('Presupuesto_detalle','svc_detalle');

    // zona opcional
    ensureHidden('Zona_codigo','tpl-zone-code');
    ensureHidden('Zona_nombre','tpl-zone-name');
  }

  /* ==================== OVERLAY ==================== */
  function ensureOverlay(){
    let wrap = $id('tpl-overlay');
    if(!wrap){
      wrap = document.createElement('div');
      wrap.id='tpl-overlay'; wrap.className='tpl-overlay';
      wrap.innerHTML = `
        <div class="tpl-modal" role="dialog" aria-live="polite">
          <p id="tpl-ov-text" style="margin:0 0 12px"></p>
          <pre id="tpl-err-detail" style="display:none;white-space:pre-wrap;text-align:left;font-size:.9rem;background:#f7f7f7;padding:8px;border-radius:8px;max-height:220px;overflow:auto"></pre>
          <button type="button" class="cta-button" id="tpl-ov-action">Aceptar</button>
        </div>`;
      document.body.appendChild(wrap);
    }
    return wrap;
  }
  function showSuccessOverlay(msg, go){
    const wrap = ensureOverlay();
    q('#tpl-ov-text',wrap).textContent = msg || 'Tu solicitud se ha enviado correctamente.';
    const det = q('#tpl-err-detail',wrap); det.style.display='none'; det.textContent='';
    wrap.classList.add('on');
    const btn = q('#tpl-ov-action',wrap);
    btn.textContent = 'Ir a mi perfil';
    btn.onclick = ()=>{ location.href = go || 'perfil.html'; };
  }
  function showErrorOverlay(msg, detail){
    const wrap = ensureOverlay();
    q('#tpl-ov-text',wrap).textContent = msg || 'No se pudo enviar la solicitud.';
    const det = q('#tpl-err-detail',wrap);
    if (detail){ det.style.display='block'; det.textContent=String(detail); }
    else { det.style.display='none'; det.textContent=''; }
    wrap.classList.add('on');
    const btn = q('#tpl-ov-action',wrap);
    btn.textContent='Cerrar';
    btn.onclick=()=>{ wrap.classList.remove('on'); };
  }

  /* ==================== UDB (cache local) ==================== */
  const udbKey = (uid,key)=> `tpl.udb.${uid}.${key}`;
  function udbGet(uid, key){ try{ const v=localStorage.getItem(udbKey(uid,key)); return v?JSON.parse(v):null }catch(_){ return null } }
  function udbSet(uid, key, val){ try{ localStorage.setItem(udbKey(uid,key), JSON.stringify(val)); }catch(_){ } }
  const toArrayMaybe = (x)=> !x?[]:(Array.isArray(x)?x:Object.keys(x).map(k=>Object.assign({id:k},x[k])));

  /* ==================== PERFIL → FORM ==================== */
  function splitSmart(text){
    if (!text) return {nombre:'', apellidos:''};
    let s = String(text).trim().replace(/\s+/g,' ');
    if (s.includes(',')){ const a=s.split(','); return {nombre:(a.slice(1).join(',')||'').trim(), apellidos:(a[0]||'').trim()}; }
    const parts = s.split(' '); if(parts.length===1) return {nombre:parts[0], apellidos:''};
    return {nombre:parts[0], apellidos:parts.slice(1).join(' ')};
  }
  const setIfEmpty=(el,val)=>{ if(el && !el.value && val){ el.value = val; } };

  async function autoFillFromProfile(user){
    if(!user || user.isAnonymous) return;

    const firstEl=$id('firstName'), lastEl=$id('lastName'), emailEl=$id('email'), phoneEl=$id('phone');
    const addrEl=$id('location'), cpEl=$id('postalCode'), ccaaSel=$id('region');

    // 0) Firebase user visible
    if (user.email) setIfEmpty(emailEl,user.email);
    const sp = splitSmart(user.displayName||'');
    setIfEmpty(firstEl, sp.nombre); setIfEmpty(lastEl, sp.apellidos);
    setIfEmpty(phoneEl, user.phoneNumber||'');

    // 1) cache local del perfil (como antes)
    const ownerCache = udbGet(user.uid,'owner') || udbGet(user.uid,'propietario');
    if (ownerCache){
      setIfEmpty(firstEl, ownerCache.nombre || ownerCache.name || '');
      setIfEmpty(lastEl,  ownerCache.apellidos || '');
      setIfEmpty(emailEl, ownerCache.email || '');
      setIfEmpty(phoneEl, ownerCache.telefono || ownerCache.phone || '');
      setIfEmpty(addrEl,  ownerCache.direccion || '');
      setIfEmpty(cpEl,    ownerCache.cp || '');
      if (ownerCache.ccaa && ccaaSel){
        const val=(''+ownerCache.ccaa).toLowerCase();
        const f=[...ccaaSel.options].find(o=>o.value===val || (o.text||'').toLowerCase().includes(val));
        if (f) ccaaSel.value=f.value;
      }
    }

    // 2) Firestore “users/{uid}”
    try{
      if (typeof firebase!=='undefined' && firebase.firestore){
        const db=firebase.firestore();
        const doc=await db.collection('users').doc(user.uid).get().catch(()=>null);
        if (doc && doc.exists){
          const d=doc.data()||{};
          const nombre=d.nombre||d.name||'', apellidos=d.apellidos||d.surname||'';
          const email=d.email||'', telefono=d.telefono||d.phone||'';
          const direccion=d.direccion||d.address||'', cp=d.cp||d.postal||d.zip||'';
          const ccaa=d.ccaa||d.region||'';
          setIfEmpty(firstEl, nombre); setIfEmpty(lastEl, apellidos);
          setIfEmpty(emailEl, email);  setIfEmpty(phoneEl, telefono);
          setIfEmpty(addrEl, direccion); setIfEmpty(cpEl, cp);
          if (ccaa && ccaaSel){
            const val=(''+ccaa).toLowerCase();
            const f=[...ccaaSel.options].find(o=>o.value===val || (o.text||'').toLowerCase().includes(val));
            if (f) ccaaSel.value=f.value;
          }
          // refresca cache local
          udbSet(user.uid,'owner',{nombre,apellidos,email,telefono,direccion,cp,ccaa});
        }
      }
    }catch(_){}

    // hiddens mínimos
    ensureHidden('reply_to','tpl-replyto').value = emailEl?.value || user.email || '';
    ensureHidden('user_uid','tpl-uid').value = user.uid || '';
    ensureHidden('Perfil_url','tpl-perfil-url').value = (q('#tpl-login-link')?.getAttribute('href')) || 'perfil.html';
  }

  /* ==================== MASCOTAS ==================== */
  function normalizePet(p){
    if(!p) return null;
    return {
      id: p.id||p.uid||p._id||p.chip||p.microchip||'',
      nombre: p.nombre||p.name||p.petName||'',
      especie: p.especie||p.tipo||p.species||p.type||'',
      raza: p.raza||p.breed||'',
      tamano: p.tamano||p['tamaño']||p.size||'',
      medicacion: p.medicacion||p['medicación']||p.medication||'',
      necesidades: p.necesidades||p.needs||p.specialNeeds||'',
      birthdate: p.birthdate||p.fnac||''
    };
  }
  async function loadPetsFromFirestore(uid){
    const out=[];
    try{
      if (typeof firebase==='undefined' || !firebase.firestore) return out;
      const db=firebase.firestore();
      const paths=[['users',uid,'mascotas'],['users',uid,'pets'],['owners',uid,'mascotas'],['propietarios',uid,'mascotas']];
      for (const [col,doc,sub] of paths){
        try{
          const snap=await db.collection(col).doc(doc).collection(sub).get();
          if(!snap.empty){ snap.forEach(d=>out.push(Object.assign({id:d.id},d.data()))); }
        }catch(_){}
        if(out.length) break;
      }
      if(!out.length){
        const udoc=await db.collection('users').doc(uid).get().catch(()=>null);
        if(udoc && udoc.exists){
          const data=udoc.data()||{};
          toArrayMaybe(data.mascotas).forEach(p=>out.push(p));
          toArrayMaybe(data.pets).forEach(p=>out.push(p));
        }
      }
    }catch(_){}
    return out.map(normalizePet).filter(Boolean);
  }
  function applyPetHidden(p){
    const map={
      'tpl-pet-id':p.id||'','tpl-pet-name':p.nombre||'','tpl-pet-species':p.especie||'','tpl-pet-breed':p.raza||'',
      'tpl-pet-size':p.tamano||'','tpl-pet-med':p.medicacion||'','tpl-pet-needs':p.necesidades||'',
      'tpl-pet-birthdate':p.birthdate||'','tpl-pet-age-months':''
    };
    Object.keys(map).forEach(id=>{ const el=$id(id); if(el) el.value=map[id]; });
  }
  function pickFirstPetFromDetailJson(){
    try{
      const raw=$id('petsDetailJson')?.value||'';
      if(!raw) return null;
      const arr=JSON.parse(raw);
      if(Array.isArray(arr) && arr.length){
        const a=arr[0]||{};
        return normalizePet({
          id:a.Microchip||a.id, nombre:a.Nombre, especie:a.Especie, raza:a.Raza,
          tamano:a.Tamano||a.Tamaño, medicacion:a.Tratamiento||a.Medicacion, necesidades:a.Necesidades
        });
      }
    }catch(_){}
    return null;
  }

  /* ==================== UI DINÁMICA OPCIONAL (si no tienes motor en HTML) ==================== */
  const PRICING = {
    visitas: { durations:[60,90], addlPetPct:0, base:{ gato:{60:0,90:0}, perro:{60:0,90:0}, 'exótico':{60:0,90:0} }, visitsPerDayChoices:[1,2] },
    paseos:  { durations:[30,60], base:{30:0,60:0}, addlDogPct:0 },
    guarderia:{ perDay:0 },
    alojamiento:{ perNight:0 },
    bodas:{ perHour:0 }
  };
  function ensureServiceDynamicUI(){
    const sec=q('section[aria-labelledby="sec-servicio"]'); if(!sec) return null;
    let box=$id('svc-dynamic');
    if(!box){
      box=document.createElement('div'); box.id='svc-dynamic'; box.className='tpl-section';
      box.innerHTML=`<h2 style="margin-top:4px;font-size:1.05rem">Opciones del servicio</h2>
        <div class="booking-grid" id="svc-grid"></div>
        <div id="budgetBox" class="booking-field" style="margin-top:6px;grid-column:1/-1"></div>`;
      sec.appendChild(box);
    }
    return box;
  }
  function optionEl(label, inner){
    const wrap=document.createElement('div'); wrap.className='booking-field';
    wrap.innerHTML=`<label>${label}</label>${inner}`; return wrap;
  }
  function buildUIFor(service){
    const grid=$id('svc-grid'); if(!grid) return;
    grid.innerHTML='';
    const sd=$id('startDate'), ed=$id('endDate');
    const hTipo=ensureHidden('Servicio_tipo','svc_tipo');
    const hDur =ensureHidden('Servicio_duracion','svc_dur');
    const hVxd =ensureHidden('Servicio_visitas_dia','svc_vxd');
    const hNmas=ensureHidden('Servicio_mascotas','svc_nmas');
    const hHoras=ensureHidden('Servicio_horas','svc_horas');
    const hTotal=ensureHidden('Presupuesto_total','svc_total');
    const hDet  =ensureHidden('Presupuesto_detalle','svc_detalle');
    const hDias =ensureHidden('Servicio_dias','svc_dias');
    const curDays=()=> daysBetweenInclusive(sd?.value, ed?.value);
    on(sd,'change', ()=>{ hDias.value=curDays(); recalcBudget(); });
    on(ed,'change', ()=>{ hDias.value=curDays(); recalcBudget(); });

    if (service==='visitas'){
      const selTipo=document.createElement('select');
      ['','Gato','Perro','Exótico'].forEach((t,i)=>{ const o=new Option(i? t : 'Elige…', (i? t.toLowerCase():'')); selTipo.appendChild(o); });
      grid.appendChild(optionEl('Tipo de mascota', selTipo.outerHTML));
      const selTipoEl=grid.querySelector('select');
      on(selTipoEl,'change', ()=>{ hTipo.value=selTipoEl.value; recalcBudget(); });

      const s=PRICING.visitas.durations, selDur=document.createElement('select');
      selDur.innerHTML=['Elige…'].concat(s.map(x=>`${x} min`)).map((t,i)=>`<option value="${i? s[i-1]:''}">${t}</option>`).join('');
      grid.appendChild(optionEl('Duración por visita', selDur.outerHTML));
      const selDurEl=grid.querySelectorAll('select')[1];
      on(selDurEl,'change', ()=>{ hDur.value=selDurEl.value; recalcBudget(); });

      const vxdSel=document.createElement('select');
      vxdSel.innerHTML=PRICING.visitas.visitsPerDayChoices.map(n=>`<option value="${n}">${n}</option>`).join('');
      grid.appendChild(optionEl('Visitas por día', vxdSel.outerHTML));
      const vxdEl=grid.querySelectorAll('select')[2]; vxdEl.value=1;
      on(vxdEl,'change', ()=>{ hVxd.value=vxdEl.value; recalcBudget(); });

      const nmInput=document.createElement('input'); nmInput.type='number'; nmInput.min='1'; nmInput.max='10'; nmInput.value='1';
      grid.appendChild(optionEl('Nº de mascotas', nmInput.outerHTML));
      const nmEl=grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value=clamp(+nmEl.value||1,1,10); recalcBudget(); });

      hVxd.value='1'; hNmas.value='1'; hDias.value=curDays();

    }else if(service==='paseos'){
      const s=PRICING.paseos.durations, selDur=document.createElement('select');
      selDur.innerHTML=['Elige…'].concat(s.map(x=>`${x} min`)).map((t,i)=>`<option value="${i? s[i-1]:''}">${t}</option>`).join('');
      grid.appendChild(optionEl('Duración del paseo', selDur.outerHTML));
      const selDurEl=grid.querySelector('select');
      on(selDurEl,'change', ()=>{ hDur.value=selDurEl.value; recalcBudget(); });

      const nmInput=document.createElement('input'); nmInput.type='number'; nmInput.min='1'; nmInput.max='6'; nmInput.value='1';
      grid.appendChild(optionEl('Nº de perros', nmInput.outerHTML));
      const nmEl=grid.querySelector('input[type="number"]');
      on(nmEl,'input', ()=>{ hNmas.value=clamp(+nmEl.value||1,1,6); recalcBudget(); });

      hNmas.value='1'; hDias.value=curDays();

    }else if(service==='guarderia'){
      grid.appendChild(optionEl('Info', `<small>Se calcula por <strong>días completos</strong> de guardería.</small>`));
      hDias.value=curDays();

    }else if(service==='alojamiento'){
      grid.appendChild(optionEl('Info', `<small>Se calcula por <strong>noches</strong> (días entre inicio y fin).</small>`));
      hDias.value=curDays();

    }else if(service==='bodas'){
      const horas=document.createElement('input'); horas.type='number'; horas.min='1'; horas.max='16'; horas.value='4';
      grid.appendChild(optionEl('Horas del servicio', horas.outerHTML));
      const hEl=grid.querySelector('input[type="number"]');
      on(hEl,'input', ()=>{ hHoras.value=clamp(+hEl.value||1,1,16); recalcBudget(); });
      hHoras.value='4';
    }

    recalcBudget();
  }
  function recalcBudget(){
    const svc=$id('service')?.value||'';
    const b=$id('budgetBox'); // si no existe, seguimos igual (porque el HTML nuevo ya calcula)
    const sd=$id('startDate')?.value, ed=$id('endDate')?.value;
    const dias=daysBetweenInclusive(sd,ed)||1;

    let total=0; const lines=[]; let warn=false;

    if(svc==='visitas'){
      const tipo=$id('svc_tipo')?.value||'', dur=num($id('svc_dur')?.value), vxd=num($id('svc_vxd')?.value||1), nmas=num($id('svc_nmas')?.value||1);
      const base= PRICING.visitas.base[(tipo||'').replace('ó','o')]?.[dur];
      if (!base && base!==0) warn=true;
      const porVisita=+base||0;
      const porDia=porVisita*vxd*( nmas>1 ? (1+(nmas-1)*(PRICING.visitas.addlPetPct||0)) : 1 );
      total += porDia*dias;
      lines.push(`Visitas: ${vxd}/día · ${dur||'?'} min · ${nmas} mascota(s) × ${dias} día(s)`);
    } else if(svc==='paseos'){
      const dur=num($id('svc_dur')?.value), nmas=num($id('svc_nmas')?.value||1);
      const base=PRICING.paseos.base[dur]; if(!base && base!==0) warn=true;
      const porPaseo=+base||0;
      total += porPaseo*( nmas>1 ? (1+(nmas-1)*(PRICING.paseos.addlDogPct||0)) : 1 )*dias;
      lines.push(`Paseos: 1 paseo/día · ${dur||'?'} min · ${nmas} perro(s) × ${dias} día(s)`);
    } else if(svc==='guarderia'){
      const p=PRICING.guarderia.perDay; if(p===undefined) warn=true; total += (+p||0)*dias; lines.push(`Guardería: ${dias} día(s)`);
    } else if(svc==='alojamiento'){
      const p=PRICING.alojamiento.perNight; if(p===undefined) warn=true; total += (+p||0)*dias; lines.push(`Alojamiento: ${dias} noche(s)`);
    } else if(svc==='bodas'){
      const h=num($id('svc_horas')?.value||0); const p=PRICING.bodas.perHour; if(p===undefined) warn=true;
      total += (+p||0)*Math.max(h,1); lines.push(`Bodas/exclusivos: ${Math.max(h,1)} hora(s)`);
    }

    const det=[];
    if(lines.length) det.push('• '+lines.join('\n• '));
    det.push('• Desplazamiento: pendiente (según dirección)');
    if (TPL_DEPOSITO_PCT>0 && total>0){
      det.push(`• Anticipo ${Math.round(TPL_DEPOSITO_PCT*100)}%: ${fmtEUR(total*TPL_DEPOSITO_PCT)} (se solicita tras aceptar)`);
    }

    $id('svc_total') && ($id('svc_total').value = String(total.toFixed(2)));
    $id('svc_detalle') && ($id('svc_detalle').value = det.join(' · '));

    if (b){
      const warnHtml = warn? `<div style="color:#a66;font-size:.95rem;margin:6px 0">Ajusta la tabla de tarifas PRICING para esta combinación.</div>`:'';
      b.innerHTML = `
        <div style="border:1px solid #eee;border-radius:10px;padding:12px;background:#fafafa">
          <strong>Presupuesto estimado</strong>
          <div style="margin:8px 0;white-space:pre-line">${det.join('\n')}</div>
          <div style="font-size:1.1rem;margin-top:6px;">Total estimado (sin desplazamiento): <strong>${fmtEUR(total)}</strong></div>
          ${warnHtml}
        </div>`;
    }

    // Si el HTML “nuevo” ya calcula (sumSubtotal), mantenemos sincronía al vuelo más abajo.
  }
  // Preselección via URL
  function hydrateFromURL(){
    const mapServ=(s)=>({'visitas':'visitas','paseos':'paseos','guarderia':'guarderia','guardería':'guarderia','alojamiento':'alojamiento','bodas':'bodas'}[String(s||'').toLowerCase()]||'');
    const serviceEl=$id('service'); if(!serviceEl) return;
    const s=mapServ(getQS('serv')||getQS('servicio')||'');
    if(s){ serviceEl.value=s; serviceEl.dispatchEvent(new Event('change',{bubbles:true})); }
    const later=()=>{ if(!$id('svc-dynamic')){ setTimeout(later,60); return; }
      const tipo=(getQS('tipo')||'').toLowerCase(); const dur=getQS('dur')||getQS('duracion')||getQS('duración');
      const vxd=getQS('vxd')||getQS('visitas_dia')||getQS('vd'); const n=getQS('n')||getQS('mascotas'); const h=getQS('h')||getQS('horas');
      if(tipo && $id('svc_tipo')) $id('svc_tipo').value=tipo, recalcBudget();
      if(dur  && $id('svc_dur'))  $id('svc_dur').value=dur,   recalcBudget();
      if(vxd  && $id('svc_vxd'))  $id('svc_vxd').value=vxd,   recalcBudget();
      if(n    && $id('svc_nmas')) $id('svc_nmas').value=n,    recalcBudget();
      if(h    && $id('svc_horas'))$id('svc_horas').value=h,   recalcBudget();
    }; later();
  }

  /* ==================== EMAIL (resumen + html con múltiples mascotas) ==================== */
  function serviceLabel(){
    const s=$id('service'); if(!s) return '';
    const opt=s.options[s.selectedIndex]; return (opt && opt.text)? opt.text.trim() : '';
  }
  function buildSummary(){
    const sd=$id('startDate')?.value||'', ed=$id('endDate')?.value||'';
    const st=$id('start')?.value||'', et=$id('end')?.value||'';
    const svc=serviceLabel();
    const owner=[ `Nombre: ${$id('firstName')?.value||''} ${$id('lastName')?.value||''}`.trim(),
                  `Email/Tel: ${$id('email')?.value||''} / ${$id('phone')?.value||''}` ];
    const total=$id('svc_total')?.value;
    const dep = (TPL_DEPOSITO_PCT>0 && total) ? ` · Anticipo ${Math.round(TPL_DEPOSITO_PCT*100)}%` : '';
    return [ (svc?`Servicio: ${svc}`:''), `Fechas: ${sd||'-'} a ${ed||'-'}`, `Hora: ${st||'-'} a ${et||'-'}`, owner.join(' | '),
             (total?`Presupuesto: ${fmtEUR(total)} (sin desplazamiento${dep})`:'') ].filter(Boolean).join(' | ');
  }
  function buildHtmlEmail(fd){
    const obj=Object.fromEntries(fd.entries());

    const Reserva = {
      Servicio: obj.Servicio || serviceLabel() || '',
      'Fecha inicio': obj.Fecha_inicio || '',
      'Fecha fin':    obj.Fecha_fin    || '',
      'Hora inicio':  obj.Hora_inicio  || '',
      'Hora fin':     obj.Hora_fin     || '',
      Notas:          obj.Notas || ''
    };
    const Propietario = {
      Nombre:    obj.Nombre    || '',
      Apellidos: obj.Apellidos || '',
      Email:     obj.Email     || '',
      Teléfono:  obj.Telefono  || '',
      Dirección: obj.Direccion || '',
      CP:        obj.CP        || '',
      CCAA:      (function(){ const sel=$id('region'); return sel? (sel.options[sel.selectedIndex]?.text||'') : (obj.CCAA||''); })()
    };

    // Mascotas: si hay JSON múltiple, lo mostramos todo; si no, usamos “Mascota_*”
    let mascotasHtml='';
    try{
      const raw=obj.Mascotas_detalle_json||''; const arr=raw? JSON.parse(raw): [];
      if (Array.isArray(arr) && arr.length){
        mascotasHtml = `
          <h3 style="margin:16px 0 4px">Mascotas</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr>
              <th align="left" style="padding:6px 8px;border-bottom:2px solid #ddd">Nombre</th>
              <th align="left" style="padding:6px 8px;border-bottom:2px solid #ddd">Especie</th>
              <th align="left" style="padding:6px 8px;border-bottom:2px solid #ddd">Raza</th>
              <th align="left" style="padding:6px 8px;border-bottom:2px solid #ddd">Notas</th>
            </tr>
            ${arr.map(r=>`
              <tr>
                <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.Nombre||'-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.Especie||'-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.Raza||'-'}</td>
                <td style="padding:6px 8px;border-bottom:1px solid #eee">${[r.Salud,r.Tratamiento,r.Comportamiento].filter(Boolean).join(' · ')||''}</td>
              </tr>`).join('')}
          </table>`;
      } else {
        const Mascota = {
          ID:          obj.Mascota_id || '',
          Nombre:      obj.Mascota_nombre || '',
          Especie:     obj.Mascota_especie || '',
          Raza:        obj.Mascota_raza || '',
          Tamaño:      obj.Mascota_tamano || '',
          Medicación:  obj.Mascota_medicacion || '',
          Necesidades: obj.Mascota_necesidades || ''
        };
        mascotasHtml = `
          <h3 style="margin:16px 0 4px">Mascota</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            ${Object.entries(Mascota).map(([k,v])=>`
              <tr>
                <th align="left" style="padding:6px 8px;border-bottom:1px solid #eee">${k}</th>
                <td style="padding:6px 8px;border-bottom:1px solid #eee">${String(v||'-')}</td>
              </tr>`).join('')}
          </table>`;
      }
    }catch(_){}

    const Presupuesto = {
      Detalle: (obj.Presupuesto_detalle || 'Desplazamiento: pendiente (según dirección)'),
      Total:   obj.Presupuesto_total ? fmtEUR(obj.Presupuesto_total) : ''
    };

    const section = (title, rows)=> `
      <h3 style="margin:16px 0 4px">${title}</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        ${Object.entries(rows).map(([k,v])=>`
          <tr>
            <th align="left" style="padding:6px 8px;border-bottom:1px solid #eee">${k}</th>
            <td style="padding:6px 8px;border-bottom:1px solid #eee">${String(v||'-')}</td>
          </tr>`).join('')}
      </table>`;

    return `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,'Helvetica Neue',Arial,sans-serif;line-height:1.45;color:#222">
        <p><strong>Nueva reserva — The Pets Lovers</strong></p>
        ${section('Reserva', Reserva)}
        ${section('Propietario', Propietario)}
        ${mascotasHtml}
        ${section('Presupuesto', Presupuesto)}
      </div>`;
  }

  /* ==================== EMAILJS ==================== */
  async function ensureEmailJS(){
    if (window.emailjs?.send) return window.emailjs;
    await new Promise((res,rej)=>{
      const s=document.createElement('script');
      s.src='https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      s.onload=res; s.onerror=()=>rej(new Error('No se pudo cargar EmailJS'));
      document.head.appendChild(s);
    });
    return window.emailjs;
  }
  async function sendBookingWithEmailJS(form){
    const fd=new FormData(form);

    // split nombre si puso todo en "Nombre"
    const f=$id('firstName'), l=$id('lastName');
    if (f && (!l || !l.value || /\s/.test(f.value||''))){
      const s=splitSmart(f.value||''); if(s.nombre) f.value=s.nombre; if(s.apellidos && (!l||!l.value)) l&&(l.value=s.apellidos);
    }

    const resumen=buildSummary();
    ensureHidden('Desglose','summaryField').value = resumen;
    fd.set('Desglose', resumen);

    const payload=Object.fromEntries(fd.entries());
    const messageHtml = buildHtmlEmail(fd);

    Object.assign(payload,{
      subject: 'Nueva reserva — The Pets Lovers',
      page_url: location.href,
      service_label: serviceLabel(),
      message_html: messageHtml,
      reply_to: $id('reply_to')?.value || payload.Email || '',
      to_email: EJ.adminEmail || payload.to_email || '',
      to_name: 'Gestión The Pets Lovers',
      from_name: `${$id('firstName')?.value||''} ${$id('lastName')?.value||''}`.trim(),
      cp: payload.CP || '',
      zona_code: payload.Zona_codigo || '',
      zona_name: payload.Zona_nombre || '',
      user_uid: $id('tpl-uid')?.value || payload.user_uid || ''
    });

    const emailjs = await ensureEmailJS();
    try{ emailjs.init({ publicKey:EJ.publicKey }); }catch(_){}

    let ok=0;
    // a gestión
    if (EJ.adminEmail){
      const r1 = await emailjs.send(EJ.serviceId, EJ.templateId, Object.assign({},payload,{to_email:EJ.adminEmail}), EJ.publicKey);
      if (r1 && r1.status>=200 && r1.status<300) ok++;
    }
    // a la dueña si puso email
    if ((payload.Email||'').trim()){
      const r2 = await emailjs.send(EJ.serviceId, EJ.templateId, Object.assign({},payload,{to_email:(payload.Email||'').trim()}), EJ.publicKey);
      if (r2 && r2.status>=200 && r2.status<300) ok++;
    }
    return ok>0;
  }

  /* ==================== FIRESTORE ==================== */
  async function saveToFirestore(payload){
    if (typeof firebase==='undefined' || !firebase.firestore) return null;
    try{
      const db=firebase.firestore();
      if (firebase.firestore.FieldValue) payload._createdAt=firebase.firestore.FieldValue.serverTimestamp();
      const ref=await db.collection('reservas').add(payload);
      // espejo en users/{uid}/reservas/{id}
      try{
        if (payload.user_uid){
          await db.collection('users').doc(payload.user_uid).collection('reservas').doc(ref.id).set({
            reserva_id: ref.id,
            estado: payload.estado || 'solicitada',
            _estado: payload._estado || 'enviada',
            servicio: payload.Servicio || payload.service_label || '',
            fecha_inicio: payload.Fecha_inicio || '',
            fecha_fin: payload.Fecha_fin || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            resumen: payload.Desglose || '',
            total: payload.Presupuesto_total ? +payload.Presupuesto_total : null
          }, { merge:true });
        }
      }catch(_){}
      return ref.id;
    }catch(err){
      console.warn('[Firestore] fallo al guardar:', err);
      return null;
    }
  }

  /* ==================== SUBMIT ==================== */
  async function onSubmit(e){
    e.preventDefault();
    const form=e.currentTarget;

    if (typeof form.reportValidity==='function' && !form.reportValidity()) return;

    // requiere sesión
    try{
      const u=firebase?.auth?.().currentUser;
      if (!u || u.isAnonymous){ showErrorOverlay('Para enviar la reserva debes iniciar sesión.'); return; }
    }catch(_){}

    const btn=form.querySelector('button[type="submit"], .cta-button');
    const old=btn?btn.textContent:'';
    if (btn){ btn.disabled=true; btn.textContent='Enviando…'; }

    // payload para DB
    const fd=new FormData(form);
    const payloadDb=Object.fromEntries(fd.entries());
    payloadDb._tipo='reserva'; payloadDb._estado='enviada'; payloadDb.estado='solicitada';
    payloadDb._page=location.href; payloadDb._ts=nowIso();
    payloadDb.user_uid = $id('tpl-uid')?.value || (firebase?.auth?.().currentUser?.uid || '');

    payloadDb.owner = {
      nombre: payloadDb.Nombre||'', apellidos: payloadDb.Apellidos||'',
      email: payloadDb.Email||'', telefono: payloadDb.Telefono||'',
      direccion: payloadDb.Direccion||'', cp: payloadDb.CP||'', ccaa: payloadDb.CCAA||''
    };

    // mascota principal espejo (además de Mascotas_detalle_json)
    payloadDb.pet = {
      id: payloadDb.Mascota_id||'', nombre: payloadDb.Mascota_nombre||'',
      especie: payloadDb.Mascota_especie||'', raza: payloadDb.Mascota_raza||'',
      tamano: payloadDb.Mascota_tamano||'', medicacion: payloadDb.Mascota_medicacion||'',
      necesidades: payloadDb.Mascota_necesidades||''
    };

    // presupuesto mínimo si viene vacío
    if (!payloadDb.Presupuesto_detalle){
      const dias=daysBetweenInclusive(payloadDb.Fecha_inicio, payloadDb.Fecha_fin)||1;
      payloadDb.Presupuesto_detalle = `Desplazamiento: pendiente (según dirección) · Días: ${dias}`;
    }

    // guarda + email
    let docId=null;
    try{ docId=await saveToFirestore(payloadDb); }catch(_){}
    try{ await sendBookingWithEmailJS(form); }catch(err){ console.warn('EmailJS error:', err); }

    // flags para perfil.html (flash + última reserva)
    try{
      localStorage.setItem('tpl.flash', JSON.stringify({type:'success', msg:'Tu reserva se ha solicitado. Te llamaremos para confirmar los detalles.'}));
      localStorage.setItem('tpl.lastReservation', JSON.stringify({ id:docId, estado:'solicitada', ts:Date.now() }));
    }catch(_){}

    showSuccessOverlay(form.dataset.tplSuccess || 'Tu solicitud se ha enviado correctamente.', form.dataset.tplRedirect || 'perfil.html');
    try{ form.reset(); }catch(_){}
    if (btn){ btn.disabled=false; btn.textContent=old; }
  }

  /* ==================== AUTH → hidratar ==================== */
  async function hydrateOnAuth(user){
    if(!user || user.isAnonymous) return;
    await autoFillFromProfile(user);

    // mascota seleccionada: prioriza JSON del propio formulario si ya existe
    let pet=pickFirstPetFromDetailJson();
    if(!pet){
      const cache=toArrayMaybe( udbGet(user.uid,'mascotas') || udbGet(user.uid,'pets') ).map(normalizePet).filter(Boolean);
      if (cache.length===1) pet=cache[0];
      if(!pet){
        const list=await loadPetsFromFirestore(user.uid);
        if (list.length===1) pet=list[0];
        if (!cache.length && list.length) udbSet(user.uid,'mascotas', list);
      }
    }
    if(pet) applyPetHidden(pet);
  }

  /* ==================== FIXES UI “como antes” ==================== */
  function movePetSection(){
    var pet=$id('tpl-pet-section'); var serv=q('section[aria-labelledby="sec-servicio"]'); var titular=q('section[aria-labelledby="sec-titular"]');
    if(pet && serv && titular){ serv.after(pet); pet.hidden=false; }
  }
  function hideFreeNamePets(){ var sec=q('section[aria-labelledby="sec-mascotas"]'); if(sec) sec.style.display='none'; }
  function ensureHelpFab(){
    if($id('tpl-help-fab')) return;
    var a=document.createElement('a'); a.id='tpl-help-fab'; a.href='ayuda.html'; a.textContent='Centro de ayuda'; a.setAttribute('aria-label','Centro de ayuda');
    Object.assign(a.style,{position:'fixed',right:'16px',bottom:'16px',background:'#339496',color:'#fff',padding:'10px 14px',borderRadius:'999px',boxShadow:'0 4px 14px rgba(0,0,0,.15)',fontWeight:'600',textDecoration:'none',zIndex:'99999'});
    document.body.appendChild(a);
  }
  function ensureSvcPlaceholder(){
    var grid=$id('svc-grid'); var box=$id('svc-dynamic'); if(!box) return;
    if(!grid || !grid.childElementCount){
      var p=document.createElement('div'); p.style.fontSize='.95rem'; p.style.color='#666'; p.textContent='Elige un servicio para ver opciones y presupuesto.';
      (grid||box).appendChild(p);
    }
  }

  /* ==================== INIT ==================== */
  function attach(){
    const form=$id('bookingForm'); if(!form) return;

    form.setAttribute('data-tpl-emailjs','false'); // evita colisiones
    ensureCoreHiddens();

    // UI dinámica (si la quieres además del motor del HTML)
    ensureServiceDynamicUI();
    on($id('service'),'change', ()=>{ buildUIFor($id('service').value||''); });
    buildUIFor($id('service')?.value||'');
    hydrateFromURL();

    // Sincronía con el “resumen-panel” del HTML (sumSubtotal)
    const sumTotalEl=$id('sumSubtotal');
    if (sumTotalEl){
      const syncBudget=()=> {
        const t=(sumTotalEl.textContent||'').replace(/[^\d.,]/g,'').replace(',','.');
        const val=(t && !isNaN(parseFloat(t)))? parseFloat(t):'';
        if(val!=='') $id('svc_total').value=String(val.toFixed(2));
        const det=$id('svc_detalle'); if(det && !det.value){
          const fest=$id('sumFestivo')?.textContent||'', sen=$id('sumSenalado')?.textContent||'', pets=$id('sumPets')?.textContent||'';
          const lines=[]; if(pets) lines.push(`Suplementos por mascotas: ${pets} €`);
          if(fest) lines.push(`Festivos (auto): ${fest} €`); if(sen) lines.push(`Días especiales: ${sen} €`);
          if (TPL_DEPOSITO_PCT>0 && val) lines.push(`Anticipo ${Math.round(TPL_DEPOSITO_PCT*100)}%: ${fmtEUR(val*TPL_DEPOSITO_PCT)} (se solicita tras aceptar)`);
          lines.push('Desplazamiento: pendiente (según dirección)'); det.value=lines.join(' · ');
        }
      };
      const obs=new MutationObserver(syncBudget);
      obs.observe(sumTotalEl,{childList:true,characterData:true,subtree:true}); syncBudget();
    }

    // fixes
    try{ movePetSection(); }catch(_){}
    try{ hideFreeNamePets(); }catch(_){}
    try{ ensureHelpFab(); }catch(_){}
    try{ ensureSvcPlaceholder(); }catch(_){}

    // submit
    on(form,'submit', onSubmit);

    // auth
    try{
      if (firebase?.auth){
        firebase.auth().onAuthStateChanged(async (u)=>{ if(u && !u.isAnonymous){ await hydrateOnAuth(u); } });
        const cu=firebase.auth().currentUser; if(cu && !cu.isAnonymous){ hydrateOnAuth(cu); }
      }
      // compat con tus eventos custom si existen
      window.addEventListener('tpl-auth-ready', (ev)=>{ const u=ev?.detail?.user || (window.__TPL_AUTH__ && window.__TPL_AUTH__.user); if(u) hydrateOnAuth(u); });
      window.addEventListener('tpl-auth-change', ()=>{ const u=(window.__TPL_AUTH__ && window.__TPL_AUTH__.user); if(u) hydrateOnAuth(u); });
    }catch(_){}
  }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', attach);
  else attach();

})();
