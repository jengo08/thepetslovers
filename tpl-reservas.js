/* reservas.js — The Pets Lovers (auto-relleno + cálculo con todo: bonos, urgencia, festivos, días señalados, multipet, exóticos, etc.)
   NOTA: este archivo usa EmailJS + Firebase que ya están inicializados en tu HTML principal.
   Requiere:
     - <form id="bookingForm"> con los campos que ya tienes (startDate, endDate, ...).
     - #authWall para bloquear si no hay sesión.
     - tpl-auth-bridge.js para unificar sesión.
     - TPL_EMAILJS (opcional) para sobreescribir service/plantillas/publicKey.

   Mantiene compatibilidad con tus páginas y estilos actuales.
*/

(function(){
  'use strict';

  /* ================ Utiles ================ */
  const €fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const fmtEUR = (n) => €fmt.format(Math.round((+n || 0) * 100) / 100);
  const currency = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);
  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  function parseDateSafe(str){ if(!str) return null; const d = new Date(str); return isNaN(d) ? null : d; }
  const todayStr = ()=>{const d=new Date();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return `${d.getFullYear()}-${m}-${dd}`};
  const monthDayKey = (date)=>{ const d=parseDateSafe(date); if(!d) return ""; const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${m}-${dd}`; };
  const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

  /* ================ Servicio / Fechas ================ */
  function svcKey(){
    const raw = ($('#service')?.value || '').toString().trim().toLowerCase();
    const map = {
      'guarderia':'guarderia','guardería':'guarderia','daycare':'guarderia',
      'alojamiento':'alojamiento','estancias':'alojamiento','estancia':'alojamiento',
      'paseos':'paseos','paseo':'paseos','walks':'paseos',
      'visitas':'visitas','visita':'visitas','gatos':'visitas',
      'exoticos':'exoticos','exóticos':'exoticos','exotico':'exoticos',
      'transporte':'transporte','postquirurgico':'postquirurgico','bodas':'bodas'
    };
    return map[raw] || raw;
  }

  function getDays(){
    const start = $('#startDate')?.value;
    const end   = $('#endDate')?.value;
    if(!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    if(isNaN(d1) || isNaN(d2)) return 0;
    const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0; // inclusive
  }
  function updateDaysRow(nDias){
    const valueDiv = $('#sumSenalado')?.parentElement;
    if(valueDiv){ valueDiv.innerHTML = `<span id="sumSenalado">${nDias===1?'1 día':`${nDias} días`}</span>`; }
  }

  /* ================ Nombre y apellidos juntos ================ */
  function unifyNameFields(){
    const firstNameEl = $('#firstName');
    const lastNameEl  = $('#lastName');
    if(!firstNameEl || !lastNameEl) return;

    const label = document.querySelector('label[for="firstName"]');
    if(label) label.textContent = 'Nombre y apellidos';
    if(firstNameEl.placeholder) firstNameEl.placeholder = 'Nombre y apellidos';

    function updateLastName(){
      const parts = firstNameEl.value.trim().split(/\s+/);
      lastNameEl.value = (parts.length >= 2) ? parts.slice(1).join(' ') : '';
    }
    function mergeOnLoad(){
      const nameVal = (firstNameEl.value || '').trim();
      const surVal  = (lastNameEl.value  || '').trim();
      if(surVal && !nameVal.toLowerCase().includes(surVal.toLowerCase())){
        firstNameEl.value = `${nameVal} ${surVal}`.trim();
      }
    }
    function hideLastNameField(){
      const container = lastNameEl.closest('.booking-field') || lastNameEl.parentElement;
      if(container) container.style.display = 'none';
    }
    setTimeout(() => { mergeOnLoad(); hideLastNameField(); updateLastName(); }, 800);
    firstNameEl.addEventListener('input', updateLastName);
    lastNameEl.addEventListener('input', () => { mergeOnLoad(); hideLastNameField(); updateLastName(); });
  }

  /* ================ Preselección de servicio ================= */
  function preselectService(){
    const svcSelect = $('#service');
    if(!svcSelect) return;
    const urlParams = new URLSearchParams(window.location.search);
    let svc = urlParams.get('service') || urlParams.get('svc') || null;
    if(!svc){
      svc = localStorage.getItem('tpl.lastService') || null;
      if(svc) localStorage.removeItem('tpl.lastService');
    }
    if(svc){
      const opt = Array.from(svcSelect.options).find(o => o.value === svc);
      if(opt){
        svcSelect.value = svc;
        try{ svcSelect.dispatchEvent(new Event('change',{ bubbles:true })); }catch(_){}
      }
    }
  }

  /* ================ Mascotas: cards con foto ================= */
  function ensurePetsContainer(){
    let grid = $('#petsGrid');
    if(!grid){
      const anchor = $('#tpl-pet-section') || $('#petsAnchor') || $('#bookingForm') || document.body;
      const sec = document.createElement('section');
      sec.id = 'petsSection';
      sec.innerHTML = `
        <h3 style="margin-top:12px">Mascotas</h3>
        <div id="petsGrid" class="tpl-pets-grid"></div>
        <p class="muted">Selecciona hasta 3 mascotas para esta reserva.</p>
      `;
      anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      grid = sec.querySelector('#petsGrid');
      const style = document.createElement('style');
      style.textContent = `
        .tpl-pets-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        @media(min-width:900px){.tpl-pets-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
        .tpl-pet{display:flex;gap:10px;align-items:center;border:1px solid #e5e7eb;border-radius:14px;padding:10px;background:#fff}
        .tpl-pet img{width:56px;height:56px;border-radius:50%;object-fit:cover;border:1px solid #e5e7eb}
        .tpl-pet input[type=checkbox]{width:18px;height:18px}
        .tpl-badge{font-size:11px;border-radius:999px;padding:2px 6px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;margin-left:6px}
      `;
      document.head.appendChild(style);
    }
    return grid;
  }

  function ageMonths(birth){
    const d = parseDateSafe(birth); if(!d) return null;
    const now = new Date();
    let months = (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth());
    if(now.getDate() < d.getDate()) months -= 1;
    return months;
  }
  function isPuppyPet(p){ return p?.species==="perro" && (ageMonths(p.birth)??99) <= 6; }

  function ensurePetsMock(profile){
    if(profile && Array.isArray(profile.pets) && profile.pets.length) return profile;
    const mock = profile || {};
    mock.pets = [
      {id:"luna", name:"Luna", species:"perro", birth:"2025-07-10", img:"https://images.unsplash.com/photo-1517849845537-4d257902454a?w=160"},
      {id:"michi", name:"Michi", species:"gato",  birth:"2022-05-01", img:"https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=160"},
      {id:"kiko", name:"Kiko", species:"exotico",subtype:"ave", birth:"2021-03-03", img:"https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=160"}
    ];
    return mock;
  }

  function renderPets(profile){
    const grid = ensurePetsContainer();
    grid.innerHTML = "";
    const pets = (profile?.pets)||[];
    pets.slice(0,50).forEach(p=>{
      const puppy = isPuppyPet(p);
      const wrap = document.createElement('label');
      wrap.className = 'tpl-pet';
      wrap.innerHTML = `
        <input type="checkbox" class="pet-check" data-id="${p.id}">
        <img src="${p.img||""}" alt="${p.name}">
        <div style="flex:1">
          <div><strong>${p.name||"Mascota"}</strong>
            ${p.species==="perro" ? '<i class="fa-solid fa-dog"></i>' :
              p.species==="gato" ? '<i class="fa-solid fa-cat"></i>' :
              '<i class="fa-solid fa-kiwi-bird"></i>'}
            ${puppy?'<span class="tpl-badge">Cachorro (≤6m)</span>':''}
          </div>
          <div class="muted">${p.species==="exotico"?(p.subtype?("Exótico · "+p.subtype):"Exótico"):p.species} · Nac: ${p.birth||"—"}</div>
        </div>
      `;
      grid.appendChild(wrap);
    });

    // sincroniza con #numPets (si lo usas)
    grid.addEventListener('change', ()=>{
      const count = $$('.pet-check:checked', grid).length;
      const numSel = $('#numPets');
      if(numSel){
        if(count>=6){ numSel.value='6+'; const ex = $('#numPetsExact'); if(ex) ex.value = String(count); }
        else numSel.value = String(Math.max(1,count||1));
        try{ numSel.dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
      }
      // cachorros: si alguno seleccionado es cachorro → bloquear UI cachorro = sí
      const selectedObjs = selectedPets(profile);
      const anyPuppy = selectedObjs.some(isPuppyPet);
      lockPuppyUI(anyPuppy);
      computeCosts(); // repercute en precios
    });
  }

  function selectedPets(profile){
    const ids = $$('.pet-check:checked').map(x=>x.getAttribute('data-id'));
    const all = (profile?.pets)||[];
    return all.filter(p=>ids.includes(p.id)).slice(0,3);
  }

  function lockPuppyUI(forcePuppy){
    const sel = $('#isPuppy');
    if(sel){ sel.value = forcePuppy ? 'si' : 'no'; sel.disabled = !!forcePuppy; }
    const g = $('#guard-puppy'); if(g){ g.checked = !!forcePuppy; g.disabled = !!forcePuppy; }
    const a = $('#aloj-puppy');  if(a){ a.checked = !!forcePuppy; a.disabled = !!forcePuppy; }
  }

  /* ================ Tarifas públicas y auxiliar ================ */
  const PRICES = {
    base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 20, exoticos: 0 },
    puppyBase: { guarderia: 20, alojamiento: 35 },
    // Visitas (gatos)
    visita60: 22, visita90: 30,
    visita60_larga: 18, visita90_larga: 27,
    visitaMed: 12, visitaMed_larga: 10,
    // Paseos
    paseoStd: 12,
    paseoExtraPerro: 8,
    paseoBonos: { 10:115, 15:168, 20:220, 25:270, 30:318 },
    // Alojamiento — 2º perro
    alojSegundoPerroDia: 25,
    alojSegundoPerroD11: 22
  };
  const BUNDLE_GUARDERIA = {
    adult: { 10: 135, 20: 250, 30: 315 },
    puppy: { 10: 185, 20: 350, 30: 465 }
  };
  const EXOTIC_PRICES = { conejo: 25, pajaro: 20, huron: 25, iguana: 20, otro: null };

  const AUX = {
    guarderia: { adulto:12, cachorro:17, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
    alojamiento: { std:{ normal:25, desde11:22 }, puppy:{ normal:30, desde11:27 }, segundo:{ normal:20, desde11:17 } },
    paseo: { base:10, extra_mascota:5, bonos:{10:8,15:7.5,20:7,25:6.5,30:6} },
    visitas: {
      base60:17, base90:25, d11_60:12, d11_90:21,
      med15_publicEqualsAux:true,
      gatosExtra:{ one:10, twoEach:6, moreEach:4 }
    },
    exoticos:{ aves:15, reptiles:15, mamiferos:20 },
    transporte:{ base:15 }
  };

  // suplementos
  const URGENCIA_PLUS = 10; // cliente (tu margen)
  const FESTIVO_NORMAL_PLUS = 10; // cliente (+8 aux, +2 margen)
  const FESTIVO_NORMAL_AUX = 8;
  const BIG_DAY_PLUS = 30;   // cliente (+15 aux, +15 margen)
  const BIG_DAY_AUX = 15;

  /* ================ Campos dependientes ================ */
  function getNumMascotas(){
    const select = $('#numPets');
    if(!select) return Math.max(1, $$('.pet-check:checked').length || 1);
    const val = select.value;
    if(val === '6+'){
      const exact = $('#numPetsExact');
      const n = parseInt((exact && exact.value) || '6', 10);
      return isNaN(n) ? 6 : Math.max(6, n);
    }
    const num = parseInt(val, 10);
    return isNaN(num) ? 1 : num;
  }

  /* ================ Exóticos (select species) ================ */
  function toggleExoticSpecies(){
    const svc = svcKey();
    const speciesSelect = $('#species');
    if(!speciesSelect) return;
    if(!speciesSelect.dataset.originalOptions){
      speciesSelect.dataset.originalOptions = speciesSelect.innerHTML;
    }
    if(svc === 'exoticos'){
      speciesSelect.innerHTML = `
        <option value="conejo">Conejo</option>
        <option value="pajaro">Pájaro</option>
        <option value="huron">Hurón</option>
        <option value="iguana">Iguana</option>
        <option value="otro">Otro exótico</option>
      `;
    } else {
      speciesSelect.innerHTML = speciesSelect.dataset.originalOptions;
    }
  }
  function toggleSpeciesVisibility(){
    const svc = svcKey();
    const block = $('#speciesBlock');
    const species = $('#species');
    if(!block || !species) return;

    if(svc === 'visitas'){
      block.style.display = 'block';
      species.value = 'gato';
      species.disabled = true;
    } else if(svc === 'exoticos'){
      block.style.display = 'block';
      species.disabled = false;
      toggleExoticSpecies();
    } else {
      block.style.display = 'none';
    }
  }

  /* ================ Desglose (crear si falta) ================ */
  function ensureSummaryNodes(){
    if(!$('#summaryBody')){
      const sec = document.createElement('section'); sec.id='budget-summary'; sec.className='tpl-summary card';
      const h3 = document.createElement('h3'); h3.textContent='Desglose';
      const tbl = document.createElement('table'); tbl.className='summary';
      const thead = document.createElement('thead'); thead.innerHTML='<tr><th>Concepto</th><th>Importe</th></tr>';
      const body = document.createElement('tbody'); body.id='summaryBody';
      body.innerHTML = `
        <tr><th>Base suelto</th><td id="sumBase">0.00</td></tr>
        <tr><th>Visitas (principal)</th><td id="sumVisit1">0.00</td></tr>
        <tr><th>Visitas (medicación)</th><td id="sumVisit2">0.00</td></tr>
        <tr><th>Suplementos/bono</th><td id="sumFestivo">0.00</td></tr>
        <tr><th>Días</th><td id="sumSenalado">0</td></tr>
        <tr><th>Suplementos mascotas</th><td id="sumPets">0.00</td></tr>
        <tr class="total"><th>Subtotal</th><td id="sumSubtotal">0.00</td></tr>
        <tr class="total"><th>A pagar ahora</th><td id="sumDeposit">0.00</td></tr>
        <tr class="total"><th>Pendiente (12 días antes)</th><td id="sumResto">0.00</td></tr>
      `;
      tbl.appendChild(thead); tbl.appendChild(body); sec.appendChild(h3); sec.appendChild(tbl);
      ($('#bookingForm') || document.body).appendChild(sec);
    }
  }

  function getVisitDuration(){
    const v = parseInt(($('#visitDuration')?.value ?? '60'), 10);
    return Number.isFinite(v) ? v : 60;
  }
  function getVisitDaily(){
    return Math.max(1, parseInt(($('#visitDaily')?.value ?? '1'), 10));
  }
  /* ================ Cálculo ================ */
  function computeCosts(){
    const svc = svcKey();
    const species   = ($('#species')?.value || 'perro');
    const visitDur  = getVisitDuration();
    const visitDaily= getVisitDaily();
    const nMasc = getNumMascotas();

    let nDias = getDays();
    if(!Number.isFinite(nDias) || nDias <= 0){
      nDias = (['transporte','bodas','postquirurgico','exoticos','visitas','paseos'].includes(svc)) ? 1 : 0;
    }
    updateDaysRow(nDias);

    // importes cliente
    let baseCost = 0, visit1Cost = 0, visit2Cost = 0, supplementPetsCost = 0, packCost = 0;
    let exoticUnpriced = false;

    // auxiliar internamente
    let auxTotal = 0;

    const startDate = $('#startDate')?.value || todayStr();
    const endDate   = $('#endDate')?.value || startDate;
    const mdKeyStart= monthDayKey(startDate);
    const mdKeyEnd  = monthDayKey(endDate);

    // Festivos/Tochos (por simplicidad, si cae el inicio o fin)
    let plusFestivoCliente = 0, plusFestivoAux = 0;
    if(BIG_DAYS.includes(mdKeyStart) || BIG_DAYS.includes(mdKeyEnd)){
      plusFestivoCliente += BIG_DAY_PLUS;
      plusFestivoAux     += BIG_DAY_AUX;
    } else {
      // si activas festivo normal manual, cambia aquí:
      const isFestivoNormal = false;
      if(isFestivoNormal){ plusFestivoCliente += FESTIVO_NORMAL_PLUS; plusFestivoAux += FESTIVO_NORMAL_AUX; }
    }

    // Urgencia (<2h): si tuvieras hora de inicio real, calcula diff y aplica.
    let plusUrgencia = 0;

    /* ----- Cálculo por servicio ----- */
    if(svc === 'visitas'){
      const longStay = nDias >= 11;
      const tarifa1 = (visitDur === 90)
        ? (longStay ? PRICES.visita90_larga : PRICES.visita90)
        : (visitDur === 15)
          ? (longStay ? PRICES.visitaMed_larga : PRICES.visitaMed)
          : (longStay ? PRICES.visita60_larga : PRICES.visita60);

      visit1Cost = tarifa1 * nDias * 1;

      // Auxiliar base
      const aux1 = (visitDur === 90)
        ? (longStay ? AUX.visitas.d11_90 : AUX.visitas.base90)
        : (visitDur === 15)
          ? (AUX.visitas.med15_publicEqualsAux ? (longStay?PRICES.visitaMed_larga:PRICES.visitaMed) : 0)
          : (longStay ? AUX.visitas.d11_60 : AUX.visitas.base60);
      auxTotal += aux1 * nDias;

      // 2ª+ visitas/día (todas 15’)
      const extrasPorDia = Math.max(0, visitDaily - 1);
      if(extrasPorDia > 0){
        const tarifaMed = longStay ? PRICES.visitaMed_larga : PRICES.visitaMed;
        visit2Cost = tarifaMed * nDias * extrasPorDia;
        auxTotal   += tarifaMed * nDias * extrasPorDia; // margen 0
      }

      // gatos extra por visita
      const totalVisitas = nDias * Math.max(1, visitDaily);
      if(nMasc > 1){
        const extras = nMasc - 1;
        let perClient=0, perAux=0;
        if(extras === 1){ perClient=12; perAux=AUX.visitas.gatosExtra.one; }
        else if(extras === 2){ perClient=8;  perAux=AUX.visitas.gatosExtra.twoEach; }
        else { perClient=6; perAux=AUX.visitas.gatosExtra.moreEach; }
        supplementPetsCost = perClient * extras * totalVisitas;
        auxTotal           += perAux   * extras * totalVisitas;
      }

    } else if(svc === 'paseos'){
      const pricePer = PRICES.paseoStd;
      let packDays = 0;
      if      (nDias >= 30) packDays = 30;
      else if (nDias >= 25) packDays = 25;
      else if (nDias >= 20) packDays = 20;
      else if (nDias >= 15) packDays = 15;
      else if (nDias >= 10) packDays = 10;

      if (packDays > 0) {
        const packPrice = PRICES.paseoBonos[packDays]; // bono 1 perro
        const remaining = nDias - packDays;
        packCost      = packPrice;
        baseCost      = remaining * pricePer;
        auxTotal += AUX.paseo.bonos[packDays]*packDays + AUX.paseo.base*remaining;
      } else {
        baseCost = nDias * pricePer;
        auxTotal += AUX.paseo.base * nDias;
      }
      // mascotas extra por paseo
      if(nMasc > 1){
        supplementPetsCost = (nMasc - 1) * nDias * PRICES.paseoExtraPerro;
        auxTotal += (nMasc - 1) * nDias * AUX.paseo.extra_mascota;
      }

    } else if(svc === 'guarderia'){
      const selectedObjs = selectedPets(currentProfile);
      const anyPuppyCards = selectedObjs.some(isPuppyPet);

      const perDay = anyPuppyCards ? PRICES.puppyBase.guarderia : PRICES.base.guarderia;
      const table  = anyPuppyCards ? BUNDLE_GUARDERIA.puppy     : BUNDLE_GUARDERIA.adult;
      const auxDay = anyPuppyCards ? AUX.guarderia.cachorro     : AUX.guarderia.adulto;
      const auxB   = anyPuppyCards ? AUX.guarderia.bonosPuppy   : AUX.guarderia.bonosAdult;

      let packDays = 0;
      if (nDias >= 30) packDays = 30;
      else if (nDias >= 20) packDays = 20;
      else if (nDias >= 10) packDays = 10;

      if (packDays > 0) {
        const packPrice = table[packDays];
        const remaining = nDias - packDays;
        packCost      = packPrice;
        baseCost      = remaining * perDay;
        auxTotal += auxB[packDays]*packDays + auxDay*remaining;
      } else {
        baseCost = perDay * nDias;
        auxTotal += auxDay * nDias;
      }

    } else if(svc === 'alojamiento'){
      const petsCount = Math.max(1, nMasc);
      for(let idx=1; idx<=petsCount; idx++){
        const isSecond = (idx>=2);
        for(let d=1; d<=nDias; d++){
          const desde11 = (d>=11);
          let pPub = 0, pAux = 0;
          if(isSecond){
            pPub = desde11 ? PRICES.alojSegundoPerroD11 : PRICES.alojSegundoPerroDia;
            pAux = desde11 ? AUX.alojamiento.segundo.desde11 : AUX.alojamiento.segundo.normal;
          }else{
            // ¿alguno cachorro?
            const anyPuppy = selectedPets(currentProfile).some(isPuppyPet);
            pPub = desde11 ? (anyPuppy?32:27) : (anyPuppy?PRICES.puppyBase.alojamiento:PRICES.base.alojamiento);
            pAux = desde11 ? (anyPuppy?AUX.alojamiento.puppy.desde11:AUX.alojamiento.std.desde11)
                           : (anyPuppy?AUX.alojamiento.puppy.normal:AUX.alojamiento.std.normal);
          }
          baseCost += pPub;
          auxTotal += pAux;
        }
      }

    } else if(svc === 'exoticos'){
      const exoticType = species || 'otro';
      const pricePerVisit = EXOTIC_PRICES[exoticType];
      if(pricePerVisit != null){
        const vxd = Math.max(1, getVisitDaily());
        baseCost = pricePerVisit * nDias * vxd;
        const aux = (exoticType==="pajaro")?AUX.exoticos.aves:(exoticType==="iguana")?AUX.exoticos.reptiles:(exoticType==="conejo"||exoticType==="huron")?AUX.exoticos.mamiferos:0;
        auxTotal += aux * nDias * vxd;
      } else {
        exoticUnpriced = true; baseCost = 0;
      }

    } else if(svc === 'transporte'){
      baseCost = PRICES.base.transporte;
      auxTotal += AUX.transporte.base;

    } else {
      baseCost = PRICES.base[svc] || 0;
    }

    // suplementos (cliente y auxiliar)
    const supCliente = plusUrgencia + plusFestivoCliente;
    const supAux     = plusFestivoAux; // urgencia no va al auxiliar

    // Totales cliente
    const subtotalBefore = baseCost + visit1Cost + visit2Cost + supplementPetsCost + packCost + supCliente;
    const subtotal = (!exoticUnpriced) ? subtotalBefore : 0;

    // "A pagar ahora" = margen = total cliente - pago auxiliar
    const payNow = Math.max(0, subtotal - (auxTotal + supAux));
    const payLater = Math.max(0, subtotal - payNow);

    // Pintado
    $('#sumBase')?.textContent    = (!exoticUnpriced ? currency(baseCost) : '—');
    $('#sumVisit1')?.textContent  = currency(visit1Cost);
    $('#sumVisit2')?.textContent  = currency(visit2Cost);
    $('#sumFestivo')?.textContent = currency(packCost + supCliente);
    $('#sumSenalado')?.textContent= (nDias>0)?(nDias===1?'1 día':`${nDias} días`):'0';
    $('#sumPets')?.textContent    = currency(supplementPetsCost);
    $('#sumSubtotal')?.textContent= (!exoticUnpriced) ? currency(subtotal) : '—';
    $('#sumDeposit')?.textContent = (!exoticUnpriced) ? currency(payNow)  : '—';
    $('#sumResto')?.textContent   = (!exoticUnpriced) ? currency(payLater): '—';

    // Resumen oculto (para email)
    const summaryField = $('#summaryField');
    if(summaryField){
      const s = [];
      s.push(`Días: ${nDias}`);
      if(!exoticUnpriced){
        if(packCost > 0)     s.push(`Coste del bono: ${currency(packCost)} €`);
        if(baseCost > 0)     s.push(`Base suelto: ${currency(baseCost)} €`);
        if(visit1Cost > 0)   s.push(`Visitas (principal): ${currency(visit1Cost)} €`);
        if(visit2Cost > 0)   s.push(`Visitas (medicación): ${currency(visit2Cost)} €`);
        if(supplementPetsCost > 0) s.push(`Suplementos mascotas: ${currency(supplementPetsCost)} €`);
        if(supCliente > 0)   s.push(`Suplementos varios: ${currency(supCliente)} €`);
        s.push(`Subtotal: ${currency(subtotal)} €`);
        s.push(`A pagar ahora: ${currency(payNow)} €`);
        s.push(`Pendiente: ${currency(payLater)} €`);
      } else {
        s.push(`Precio a consultar`);
      }
      summaryField.value = s.join(' | ');
    }

    // Guarda último cálculo (para perfil)
    try{
      sessionStorage.setItem("tpl.lastCalc", JSON.stringify({
        svc, nDias, nMasc, baseCost, visit1Cost, visit2Cost, supplementPetsCost, packCost, supCliente,
        subtotal, auxTotal, supAux, payNow, payLater
      }));
    }catch(_){}
  }

  /* ================ Eventos ================ */
  function bindEvents(){
    const ids = ['service','species','startDate','endDate','startTime','endTime','visitDuration','visitDaily','numPets','numPetsExact'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      const handler = () => { toggleSpeciesVisibility(); computeCosts(); };
      el.addEventListener('change', handler);
      if(el.tagName === 'INPUT' || el.tagName === 'SELECT'){ el.addEventListener('input', handler); }
    });

    // Botón Atrás (si existe en la página)
    $('#btnBack')?.addEventListener('click', ()=>{
      if(document.referrer){ history.back(); } else { window.location.href = '/servicios.html'; }
    });
  }

  /* ================ Sesión (via tpl-auth-bridge) ================ */
  function getProfile(){
    try{ return JSON.parse(localStorage.getItem("tpl.profile")||"null"); }catch(_){ return null; }
  }

  let currentProfile = null;

  function fillOwnerFromProfile(profile){
    $('#firstName') && profile?.fullName && ($('#firstName').value = profile.fullName);
    $('#lastName')  && ($('#lastName').value = '');
    $('#email')     && profile?.email && ($('#email').value = profile.email);
    $('#phone')     && profile?.phone && ($('#phone').value = profile.phone);
    $('#address')   && profile?.address && ($('#address').value = profile.address);
    $('#postalCode')&& profile?.postalCode && ($('#postalCode').value = profile.postalCode);
    $('#region')    && profile?.region && ($('#region').value = profile.region);
  }
  /* ================ Init y Envío ================ */
  document.addEventListener('DOMContentLoaded', ()=>{
    ensureSummaryNodes();
    preselectService();
    unifyNameFields();
    bindEvents();
    toggleSpeciesVisibility();
    computeCosts();
    setTimeout(computeCosts, 300);

    const form = $('#bookingForm');
    const wall = $('#authWall');

    function applyAuthUI(logged){
      form?.classList.toggle('disabled', !logged);
      if(wall) wall.style.display = logged ? 'none' : 'block';
    }

    // Espera a que tpl-auth-bridge deje el estado listo (o usa local si no está)
    function hydrateProfile(){
      // Lee de Firebase (si está) o del local profile
      const bridge = window.TPL_AUTH;
      const logged = bridge?.isLogged ? bridge.isLogged() : !!getProfile();
      applyAuthUI(!!logged);

      // Cargar perfil desde Firestore si hay user y firestore cargado
      const uid = bridge?.uid ? bridge.uid() : null;

      if(logged && typeof firebase !== 'undefined' && firebase.firestore && uid){
        firebase.firestore().collection((window.TPL_COLLECTIONS?.owners) || 'propietarios')
          .doc(uid).get()
          .then(doc=>{
            const ownerDoc = doc.exists ? doc.data() : null;
            currentProfile = ensurePetsMock(ownerDoc || getProfile() || {});
            fillOwnerFromProfile(currentProfile);
            renderPets(currentProfile);
            computeCosts();
          }).catch(_=>{
            currentProfile = ensurePetsMock(getProfile() || {});
            fillOwnerFromProfile(currentProfile);
            renderPets(currentProfile);
            computeCosts();
          });
      }else{
        currentProfile = ensurePetsMock(getProfile() || {});
        fillOwnerFromProfile(currentProfile);
        renderPets(currentProfile);
        computeCosts();
      }
    }

    // Primer hidratado
    hydrateProfile();

    // Responder a eventos del bridge
    window.addEventListener('tpl-auth-ready', hydrateProfile);
    window.addEventListener('tpl-auth-change', hydrateProfile);

    // Envío (Firestore + EmailJS + persistencia local)
    if(form){
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault(); ev.stopPropagation();

        const bridge = window.TPL_AUTH;
        const logged = bridge?.isLogged ? bridge.isLogged() : false;
        if(!logged){ alert('Debes iniciar sesión para reservar.'); return; }
        const uid = bridge?.uid ? bridge.uid() : null;
        const mail= bridge?.email ? bridge.email() : null;

        // Perfil existente?
        try{
          if(typeof firebase !== 'undefined' && firebase.firestore && uid){
            const db = firebase.firestore();
            const col = (window.TPL_COLLECTIONS?.owners) || 'propietarios';
            const doc = await db.collection(col).doc(uid).get();
            if(!doc.exists){
              alert('Completa tu perfil antes de hacer una reserva.');
              if(window.location.pathname.indexOf('perfil')===-1) { window.location.href = 'perfil.html'; }
              return;
            }
          }
        }catch(_){}

        // Recalcular
        computeCosts();

        // Form → payload
        const fd = new FormData(form);
        const payload = {}; for(const [k,v] of fd.entries()){ payload[k] = v; }

        // Último cálculo
        let calc=null; try{ calc=JSON.parse(sessionStorage.getItem("tpl.lastCalc")||"null"); }catch(_){}
        const subtotal  = calc?.subtotal || 0;
        const payNow    = calc?.payNow   || 0;
        const payLater  = calc?.payLater || Math.max(0, subtotal-payNow);

        // Estado (simulamos pago ahora OK → 'paid_review')
        payload._estado = 'paid_review';
        payload._uid = uid || null;
        payload._email = mail || payload.email || null;
        payload._createdAt = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue)
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date().toISOString();

        // Económico
        payload.total_cliente = Number(subtotal.toFixed(2));
        payload.pagar_ahora  = Number(payNow.toFixed(2));
        payload.pendiente    = Number(payLater.toFixed(2));

        // Guardar en Firestore
        let saved = false, docId = null;
        try{
          if(typeof firebase !== 'undefined' && firebase.firestore){
            const docRef = await firebase.firestore().collection('reservas').add(payload);
            saved = true; docId = docRef.id;
          }
        }catch(err){ console.warn('No se pudo guardar la reserva en Firestore', err); }

        // Guardar también local (para perfil)
        try{
          const key="tpl.reservas";
          const r = {
            id: docId || ("resv_"+Date.now()),
            status: payload._estado,
            createdAt: new Date().toISOString(),
            service: payload.service || svcKey(),
            dates: { start: payload.startDate||todayStr(), end: payload.endDate||payload.startDate||todayStr() },
            owner: { name: (payload.firstName||'').trim(), email: (payload.email||mail||''), phone: (payload.phone||'') },
            petsCount: getNumMascotas(),
            pricing: { total: subtotal, payNow, payLater }
          };
          let arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){}
          arr.unshift(r); localStorage.setItem(key, JSON.stringify(arr));
        }catch(_){}

        // EmailJS: cliente + gestión
        let mailed = false;
        try{
          if(window.emailjs){
            // Usa los datos globales si existen; si no, usa los del HTML original
            const cfg = window.TPL_EMAILJS || {};
            const service  = cfg.serviceId || cfg.service || (window.EJ?.serviceId) || 'service_odjqrfl';
            const pubKey   = cfg.publicKey || cfg.userId || (window.EJ?.publicKey) || 'L2xAATfVuHJwj4EIV';
            const tplCliente = (cfg.templates && cfg.templates.cliente) || cfg.templateCliente || (window.EJ?.templates?.reserva) || 'template_rao5n0c';
            const tplGestion = (cfg.templates && cfg.templates.gestion) || cfg.templateGestion || (window.EJ?.templates?.reserva) || 'template_rao5n0c';

            const paramsBase = Object.assign({}, payload, {
              reserva_id: docId,
              total_txt: fmtEUR(subtotal),
              pay_now_txt: fmtEUR(payNow),
              pay_later_txt: fmtEUR(payLater),
              admin_email: (window.EJ?.adminEmail) || 'gestion@thepetslovers.es'
            });

            const r1 = await emailjs.send(service, tplCliente, paramsBase, pubKey);
            const r2 = await emailjs.send(service, tplGestion, paramsBase, pubKey);
            if((r1 && r1.status>=200 && r1.status<300) || (r2 && r2.status>=200 && r2.status<300)) mailed = true;
          }
        }catch(err){ console.warn('No se pudo enviar email (demo) con EmailJS', err); }

        if(saved || mailed){
          alert('Tu reserva se ha registrado. Está en revisión.');
          const redirect = form.dataset.tplRedirect || form.getAttribute('data-tpl-redirect');
          const wait = parseInt(form.dataset.tplWait || form.getAttribute('data-tpl-wait') || '800', 10);
          if(redirect){ setTimeout(() => { window.location.href = redirect; }, wait); }
          else { form.reset(); computeCosts(); }
        } else {
          alert('No se pudo enviar la reserva. Por favor, inténtalo de nuevo.');
        }
      });
    }
  });

  // Exponer recálculo manual si lo necesitas desde la consola
  window.updateSummaryFromJS = computeCosts;

  /* ================== (Opcional) Portado por URL ================== */
  function readQuery(){
    const q = new URLSearchParams(location.search);
    const svc = q.get('svc') || q.get('service') || '';
    const start = q.get('startDate') || q.get('start') || '';
    const end   = q.get('endDate') || q.get('end') || '';
    return {svc,start,end};
  }
  function applyPort(){
    const {svc,start,end} = readQuery();
    if(svc && $('#service')){
      $('#service').value = svc;
      try{ $('#service').dispatchEvent(new Event('change',{bubbles:true})); }catch(_){}
    }
    if(start && $('#startDate')) $('#startDate').value = start;
    if(end && $('#endDate')) $('#endDate').value = end;
  }
  document.addEventListener('DOMContentLoaded', applyPort);
  /* ================== Extras UI (si faltan nodos) ================== */
  (function ensureUIBits(){
    // Hero y footer los trae tu tema. Aquí solo aseguramos el marcador de mascotas si no existe.
    document.addEventListener('DOMContentLoaded', ()=>{
      if(!document.getElementById('tpl-pet-section')){
        const anchor = document.getElementById('petsAnchor') || document.getElementById('bookingForm') || document.body;
        const sec = document.createElement('section');
        sec.id = 'tpl-pet-section';
        sec.className='tpl-section';
        sec.setAttribute('aria-label','Mascotas seleccionables');
        anchor.parentNode.insertBefore(sec, anchor.nextSibling);
      }
    });
  })();

  /* ================== Validaciones ligeras ================== */
  function validateDates(){
    const s = $('#startDate')?.value;
    const e = $('#endDate')?.value;
    if(s && e){
      const ds = new Date(s), de = new Date(e);
      if(de < ds){ $('#endDate').value = s; }
    }
  }
  document.addEventListener('DOMContentLoaded', ()=>{
    $('#startDate')?.addEventListener('change', validateDates);
    $('#endDate')?.addEventListener('change', validateDates);
  });

  /* ================== Ajustes horarios (urgencia futura) ================== */
  // Aquí podrías aplicar la lógica <2h con startTime si lo deseas
  // function isUrgent(){ ... }

})();
/* ======= BLOQUE DE CONFIG EMAILJS (fallback, por si no viene desde HTML) =======
   Si ya configuras en el HTML:
     window.TPL_EMAILJS = {
       serviceId: "service_odjqrfl",
       publicKey: "L2xAATfVuHJwj4EIV",
       templates: { cliente: "template_rao5n0c",  gestion: "template_rao5n0c" }
     };
   entonces esto no hace falta; lo dejo como respaldo. (ajusta desde window.TPL_EMAILJS si quieres) =======
  const EJ = {
    serviceId: "service_odjqrfl",
    publicKey: "L2xAATfVuHJwj4EIV",
    templates: { reserva: "template_rao5n0c" },
    adminEmail: "gestion@thepetslovers.es"
  };
*/
