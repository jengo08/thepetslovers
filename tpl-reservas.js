// reservas.js (REEMPLAZAR ENTERO)
// Gestión de reservas: sesión, cards de mascotas con foto, cálculo de Total y "A pagar ahora" = margen,
// suplementos (urgencia/festivos/días señalados), guardado en Firestore, emails (cliente+gestión)
// y persistencia local para que el perfil muestre el estado.

(function(){
  'use strict';

  /* ============= Utilidades base ============= */
  const €fmt = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
  const fmtEUR = (n) => €fmt.format(Math.round((+n || 0) * 100) / 100);
  const currency = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);

  const $  = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  function parseDateSafe(str){ if(!str) return null; const d = new Date(str); return isNaN(d) ? null : d; }
  const todayStr = ()=>{const d=new Date();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return `${d.getFullYear()}-${m}-${dd}`};
  const monthDayKey = (date)=>{ const d=parseDateSafe(date); if(!d) return ""; const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${m}-${dd}`; };
  const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

  /* ============= Servicio y fechas ============= */
  function svcKey(){
    const raw = (document.getElementById('service')?.value || '').toString().trim().toLowerCase();
    const map = {
      'guarderia':'guarderia','guardería':'guarderia','daycare':'guarderia',
      'alojamiento':'alojamiento','estancias':'alojamiento','estancia':'alojamiento',
      'paseos':'paseos','paseo':'paseos','walks':'paseos',
      'visitas':'visitas','visita':'visitas','gatos':'visitas',
      'exoticos':'exoticos','exóticos':'exoticos','exotico':'exoticos',
      'transporte':'transporte'
    };
    return map[raw] || raw;
  }

  function getDays(){
    const start = document.getElementById('startDate')?.value;
    const end   = document.getElementById('endDate')?.value;
    if(!start || !end) return 0;
    const d1 = new Date(start);
    const d2 = new Date(end);
    if(isNaN(d1) || isNaN(d2)) return 0;
    const diff = Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff + 1 : 0; // inclusive
  }

  function updateDaysRow(nDias){
    const labelEl = document.querySelector('#sumSenalado')?.previousElementSibling;
    if(labelEl) labelEl.textContent = 'Días';
    const valueDiv = document.getElementById('sumSenalado')?.parentElement;
    if(valueDiv){
      const text = nDias === 1 ? '1 día' : `${nDias} días`;
      valueDiv.innerHTML = `<span id="sumSenalado">${text}</span>`;
    }
  }

  /* ============= Nombre y apellidos juntos ============= */
  function unifyNameFields(){
    const firstNameEl = document.getElementById('firstName');
    const lastNameEl  = document.getElementById('lastName');
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

  /* ============= Preselección de servicio por URL ============= */
  function preselectService(){
    const svcSelect = document.getElementById('service');
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

  /* ============= Mascotas: cards con foto/nombre/especie ============= */
  function ensurePetsContainer(){
    let grid = document.getElementById('petsGrid');
    if(!grid){
      const anchor = document.getElementById('petsAnchor') || document.getElementById('bookingForm') || document.body;
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
        .tpl-badge{font-size:11px;border-radius:999px;padding:2px 6px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3}
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
  function isPuppyPet(p){
    if(p.species!=="perro") return false;
    const m = ageMonths(p.birth);
    return (m!=null && m<=6);
  }

  function ensurePetsMock(profile){
    if(profile && Array.isArray(profile.pets) && profile.pets.length) return profile;
    const mock = profile || {};
    mock.pets = [
      {id:"luna", name:"Luna", species:"perro", birth:"2025-07-10", img:"https://images.unsplash.com/photo-1517849845537-4d257902454a?w=160"},
      {id:"michi", name:"Michi", species:"gato", birth:"2022-05-01", img:"https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=160"},
      {id:"kiko", name:"Kiko", species:"exotico", subtype:"ave", birth:"2021-03-03", img:"https://images.unsplash.com/photo-1501706362039-c06b2d715385?w=160"}
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

    // sincroniza con #numPets
    grid.addEventListener('change', ()=>{
      const count = $$('.pet-check:checked', grid).length;
      const numSel = document.getElementById('numPets');
      if(numSel){
        if(count>=6){ numSel.value='6+'; const ex = document.getElementById('numPetsExact'); if(ex) ex.value = String(count); }
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
    // bloquea la edición: cachorro auto detectado no es editable
    const sel = document.getElementById('isPuppy');
    if(sel){
      sel.value = forcePuppy ? 'si' : 'no';
      sel.disabled = !!forcePuppy;
    }
    const g = document.getElementById('guard-puppy');
    if(g){ g.checked = !!forcePuppy; g.disabled = !!forcePuppy; }
    const a = document.getElementById('aloj-puppy');
    if(a){ a.checked = !!forcePuppy; a.disabled = !!forcePuppy; }
  }

  /* ============= Tarifas públicas (cliente) ============= */
  const PRICES = {
    base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 20, exoticos: 0 },
    puppyBase: { guarderia: 20, alojamiento: 35 },

    // Visitas (gatos) — tramo desde día 11
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

  // Bonos guardería (1 mascota)
  const BUNDLE_GUARDERIA = {
    adult: { 10: 135, 20: 250, 30: 315 },
    puppy: { 10: 185, 20: 350, 30: 465 }
  };

  // Exóticos: precio por VISITA (species → tipo)
  const EXOTIC_PRICES = {
    conejo: 25, pajaro: 20, huron: 25, iguana: 20, otro: null
  };

  /* ============= Pagos al auxiliar (interno) para margen ============= */
  const AUX = {
    guarderia: { adulto:12, cachorro:17, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
    alojamiento: {
      std:{ normal:25, desde11:22 }, puppy:{ normal:30, desde11:27 }, segundo:{ normal:20, desde11:17 }
    },
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
  const URGENCIA_PLUS = 10; // cliente (margen tuyo)
  const FESTIVO_NORMAL_PLUS = 10; // cliente (+8 aux, +2 margen)
  const FESTIVO_NORMAL_AUX = 8;
  const BIG_DAY_PLUS = 30;   // cliente (+15 aux, +15 margen)
  const BIG_DAY_AUX = 15;

  /* ============= Campos dependientes existentes ============= */
  function getNumMascotas(){
    const select = document.getElementById('numPets');
    if(!select) return 1;
    const val = select.value;
    if(val === '6+'){
      const exact = document.getElementById('numPetsExact');
      const n = parseInt((exact && exact.value) || '6', 10);
      return isNaN(n) ? 6 : Math.max(6, n);
    }
    const num = parseInt(val, 10);
    return isNaN(num) ? 1 : num;
  }

  /* ============= Detección automática “cachorro” global (fallback) ============= */
  function monthsBetween(d1, d2){
    let months = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth());
    if(d2.getDate() < d1.getDate()) months -= 1;
    return months;
  }
  function computeIsPuppyAuto(){
    // Si hay cards seleccionadas y alguna es cachorro, lo gestionamos allí (lockPuppyUI)
    // Fallback solo si no hay cards seleccionadas
    if($$('.pet-check:checked').length>0) return null;

    const now = new Date();
    const dobIds = ['petBirthdate','petDob','birthDatePet','pet_dob','mascotaNacimiento'];
    for(const id of dobIds){
      const d = parseDateSafe(document.getElementById(id)?.value || '');
      if(d){ return Math.max(0, monthsBetween(d, now)) <= 6; }
    }
    const monthsIds = ['petAgeMonths','ageMonths','mascotaMeses'];
    for(const id of monthsIds){
      const n = parseInt(document.getElementById(id)?.value || '', 10);
      if(Number.isFinite(n)) return n <= 6;
    }
    const yearsIds = ['petAgeYears','ageYears','mascotaAnios'];
    for(const id of yearsIds){
      const n = parseFloat(document.getElementById(id)?.value || '');
      if(Number.isFinite(n)) return (n * 12) <= 6;
    }
    const ageVal = document.getElementById('petAge')?.value;
    const ageUnit = (document.getElementById('petAgeUnit')?.value || '').toLowerCase();
    if(ageVal){
      const n = parseFloat(ageVal);
      if(Number.isFinite(n)){
        const months = (ageUnit.startsWith('año') ? n*12 : n);
        return months <= 6;
      }
    }
    return null;
  }

  /* ============= Esqueleto de desglose si falta ============= */
  function ensureSummaryNodes(){
    let body = document.getElementById('summaryBody');
    if(!body){
      const sec = document.createElement('section'); sec.id='budget-summary'; sec.className='tpl-summary';
      const h3 = document.createElement('h3'); h3.textContent='Desglose';
      const tbl = document.createElement('table'); tbl.className='summary';
      const thead = document.createElement('thead'); thead.innerHTML='<tr><th>Concepto</th><th>Importe</th></tr>';
      body = document.createElement('tbody'); body.id='summaryBody';
      tbl.appendChild(thead); tbl.appendChild(body); sec.appendChild(h3); sec.appendChild(tbl);
      (document.getElementById('bookingForm') || document.body).appendChild(sec);
    }
    const rows = [
      { id:'sumBase',     label:'Base suelto' },
      { id:'sumVisit1',   label:'Visitas (principal)' },
      { id:'sumVisit2',   label:'Visitas (medicación)' },
      { id:'sumFestivo',  label:'Suplementos/bono' },
      { id:'sumSenalado', label:'Días' },
      { id:'sumPets',     label:'Suplementos mascotas' },
      { id:'sumSubtotal', label:'Subtotal', cls:'total' },
      { id:'sumDeposit',  label:'A pagar ahora', cls:'total' },
      { id:'sumResto',    label:'Pendiente (12 días antes)', cls:'total' }
    ];
    rows.forEach(r=>{
      if(!document.getElementById(r.id)){
        const tr = document.createElement('tr'); if(r.cls) tr.className=r.cls;
        const th = document.createElement('th'); th.textContent = r.label;
        const td = document.createElement('td'); td.id = r.id; td.textContent = '0.00';
        tr.appendChild(th); tr.appendChild(td); body.appendChild(tr);
      }
    });
  }

  /* ============= Exóticos dinámicos en select species ============= */
  function toggleExoticSpecies(){
    const svc = svcKey();
    const speciesSelect = document.getElementById('species');
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

  /* ============= Cálculo de costes (cliente) y auxiliar (interno) ============= */
  function getVisitDuration(){
    const visitDur  = parseInt((document.getElementById('visitDuration')?.value ?? '60'), 10);
    return Number.isFinite(visitDur) ? visitDur : 60;
  }
  function getVisitDaily(){
    return Math.max(1, parseInt((document.getElementById('visitDaily')?.value ?? '1'), 10));
  }

  function computeCosts(){
    const svc = svcKey();
    const species   = (document.getElementById('species')?.value || 'perro');
    const visitDur  = getVisitDuration();
    const visitDaily= getVisitDaily();
    const nMasc = getNumMascotas();

    let nDias = getDays();
    if(!Number.isFinite(nDias) || nDias <= 0){
      nDias = (['transporte','bodas','postquirurgico','exoticos','visitas','paseos'].includes(svc)) ? 1 : 0;
    }
    updateDaysRow(nDias);

    // Si no hay cards seleccionadas, intenta detección auto por campos; si hay cards, se bloquea en lockPuppyUI()
    const autoP = computeIsPuppyAuto();
    if(autoP !== null) lockPuppyUI(autoP);

    // importes cliente
    let baseCost = 0, visit1Cost = 0, visit2Cost = 0, supplementPetsCost = 0, packCost = 0, extraDaysCost = 0;
    let exoticUnpriced = false;

    // auxiliar internamente
    let auxTotal = 0;

    const startDate = document.getElementById('startDate')?.value || todayStr();
    const endDate   = document.getElementById('endDate')?.value || startDate;
    const mdKeyStart= monthDayKey(startDate);
    const mdKeyEnd  = monthDayKey(endDate);

    // Festivos/Tochos (demo): aplicar por el día de inicio si cae en fecha concreta
    let plusFestivoCliente = 0, plusFestivoAux = 0;
    if(BIG_DAYS.includes(mdKeyStart) || BIG_DAYS.includes(mdKeyEnd)){
      plusFestivoCliente += BIG_DAY_PLUS;
      plusFestivoAux     += BIG_DAY_AUX;
    } else {
      // si activas un switch de festivo normal, cámbialo aquí; por defecto no auto
      const isFestivoNormal = false;
      if(isFestivoNormal){ plusFestivoCliente += FESTIVO_NORMAL_PLUS; plusFestivoAux += FESTIVO_NORMAL_AUX; }
    }

    // Urgencia (<2h). Si tienes hora de inicio, aplícalo. Aquí demo: no hay hora → no aplica.
    let plusUrgencia = 0; // si tuvieras hora y falta <2h => plusUrgencia = 10;

    /* ---------- Cálculo por servicio ---------- */
    if(svc === 'visitas'){
      // Visitas a domicilio (gatos)
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

      // 2ª+ visitas/día (todas 15 min med.)
      const extrasPorDia = Math.max(0, visitDaily - 1);
      if(extrasPorDia > 0){
        const tarifaMed = longStay ? PRICES.visitaMed_larga : PRICES.visitaMed;
        visit2Cost = tarifaMed * nDias * extrasPorDia;
        // Auxiliar: medicación = mismo público (margen 0)
        auxTotal   += tarifaMed * nDias * extrasPorDia;
      }

      // gatos extra por visita (público y auxiliar)
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
      // Paseos (60')
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
        extraDaysCost = baseCost;
        // Auxiliar bono (por paseo)
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
      // Guardería de día (bonos exactos)
      const manualPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const selectedObjs = selectedPets(currentProfile);
      const anyPuppyCards = selectedObjs.some(isPuppyPet);
      const isPuppy = anyPuppyCards ? true : (autoP!==null ? autoP : manualPuppy);

      const perDay = isPuppy ? PRICES.puppyBase.guarderia : PRICES.base.guarderia;
      const table  = isPuppy ? BUNDLE_GUARDERIA.puppy : BUNDLE_GUARDERIA.adult;
      const auxDay = isPuppy ? AUX.guarderia.cachorro : AUX.guarderia.adulto;
      const auxB   = isPuppy ? AUX.guarderia.bonosPuppy : AUX.guarderia.bonosAdult;

      let packDays = 0;
      if (nDias >= 30) packDays = 30;
      else if (nDias >= 20) packDays = 20;
      else if (nDias >= 10) packDays = 10;

      if (packDays > 0) {
        const packPrice = table[packDays];
        const remaining = nDias - packDays;
        packCost      = packPrice;
        baseCost      = remaining * perDay;
        extraDaysCost = baseCost;
        auxTotal += auxB[packDays]*packDays + auxDay*remaining;
      } else {
        baseCost = perDay * nDias;
        auxTotal += auxDay * nDias;
      }

      // suplementos por más mascotas en guardería (si aplican públicamente; aquí no sumamos público, solo auxiliar si decides en futuro)

    } else if(svc === 'alojamiento'){
      // Alojamiento nocturno (por mascota; 2ª mascota tabla específica)
      const manualPuppy = (document.getElementById('isPuppy')?.value === 'si');
      const selectedObjs = selectedPets(currentProfile);
      const anyPuppyCards = selectedObjs.some(isPuppyPet);
      const isPuppy = anyPuppyCards ? true : (autoP!==null ? autoP : manualPuppy);

      const petsCount = Math.max(1, nMasc);
      for(let idx=1; idx<=petsCount; idx++){
        const isSecond = (idx>=2);
        for(let d=1; d<=nDias; d++){
          const desde11 = (d>=11);
          // público
          let pPub = 0, pAux = 0;
          if(isSecond){
            pPub = desde11 ? PRICES.alojSegundoPerroD11 : PRICES.alojSegundoPerroDia;
            pAux = desde11 ? AUX.alojamiento.segundo.desde11 : AUX.alojamiento.segundo.normal;
          }else if(isPuppy){
            pPub = desde11 ? 32 : PRICES.puppyBase.alojamiento;
            pAux = desde11 ? AUX.alojamiento.puppy.desde11 : AUX.alojamiento.puppy.normal;
          }else{
            pPub = desde11 ? 27 : PRICES.base.alojamiento;
            pAux = desde11 ? AUX.alojamiento.std.desde11 : AUX.alojamiento.std.normal;
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

    /* ---------- Pintado del desglose ---------- */
    const els = {
      sumBase: $('#sumBase'),
      sumVisit1: $('#sumVisit1'),
      sumVisit2: $('#sumVisit2'),
      sumPets: $('#sumPets'),
      sumFestivo: $('#sumFestivo'),
      sumSenalado: $('#sumSenalado'),
      sumSubtotal: $('#sumSubtotal'),
      sumDeposit: $('#sumDeposit'),
      sumResto: $('#sumResto')
    };

    if(els.sumBase)   els.sumBase.textContent   = (!exoticUnpriced ? currency(baseCost) : '—');
    if(els.sumVisit1) els.sumVisit1.textContent = currency(visit1Cost);
    if(els.sumVisit2) els.sumVisit2.textContent = currency(visit2Cost);
    if(els.sumPets)   els.sumPets.textContent   = currency(supplementPetsCost);

    const festLabelEl  = els.sumFestivo?.previousElementSibling;
    if (festLabelEl) festLabelEl.textContent = 'Suplementos/bono';
    if(els.sumFestivo) els.sumFestivo.textContent = currency(packCost + supCliente);

    // Días (informativo)
    if(els.sumSenalado) els.sumSenalado.textContent = (nDias>0)?(nDias===1?'1 día':`${nDias} días`):'0';

    if(els.sumSubtotal) els.sumSubtotal.textContent = (!exoticUnpriced) ? currency(subtotal) : '—';
    if(els.sumDeposit)  els.sumDeposit.textContent  = (!exoticUnpriced) ? currency(payNow)  : '—';
    if(els.sumResto)    els.sumResto.textContent    = (!exoticUnpriced) ? currency(payLater): '—';

    // Guarda último cálculo en sessionStorage (p.ej. para perfil)
    try{
      sessionStorage.setItem("tpl.lastCalc", JSON.stringify({
        svc, nDias, nMasc, baseCost, visit1Cost, visit2Cost, supplementPetsCost, packCost, supCliente,
        subtotal, auxTotal, supAux, payNow, payLater
      }));
    }catch(_){}

    // DEBUG
    console.debug('[DESGLOSE]', { svc, nDias, nMasc, baseCost, packCost, visit1Cost, visit2Cost, supplementPetsCost, supCliente, subtotal, auxTotal, supAux, payNow, payLater });
  }

  /* ============= Eventos ============= */
  function bindEvents(){
    const ids = ['service','species','isPuppy','startDate','endDate','visitDuration','visitDaily','numPets','numPetsExact',
                 'petBirthdate','petDob','birthDatePet','pet_dob','mascotaNacimiento',
                 'petAgeMonths','ageMonths','mascotaMeses','petAgeYears','ageYears','mascotaAnios',
                 'petAge','petAgeUnit'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if(!el) return;
      const handler = () => { toggleExoticSpecies(); computeCosts(); };
      el.addEventListener('change', handler);
      if(el.tagName === 'INPUT' || el.tagName === 'SELECT'){ el.addEventListener('input', handler); }
    });
  }

  /* ============= Sesión / Perfil ============= */
  function getProfile(){
    try{ return JSON.parse(localStorage.getItem("tpl.profile")||"null"); }catch(_){ return null; }
  }

  let currentProfile = null;

  /* ============= Inicialización y envío ============= */
  document.addEventListener('DOMContentLoaded', async () => {
    ensureSummaryNodes();
    preselectService();
    unifyNameFields();
    bindEvents();

    // Auth UI + carga perfil
    const form = document.getElementById('bookingForm');
    const wall = document.getElementById('authWall');

    let user = null, ownerDoc = null;
    if(typeof firebase !== 'undefined' && firebase.auth){
      const auth = firebase.auth();
      auth.onAuthStateChanged(async (u) => {
        user = u || null;
        const logged = !!user;
        if(form) form.classList.toggle('disabled', !logged);
        if(wall) wall.style.display = logged ? 'none' : 'block';

        if(logged && firebase.firestore){
          try{
            const db = firebase.firestore();
            const col = (window.TPL_COLLECTIONS?.owners) || 'propietarios';
            const docRef = await db.collection(col).doc(user.uid).get();
            ownerDoc = docRef.exists ? docRef.data() : null;
            currentProfile = ensurePetsMock(ownerDoc || getProfile() || {});
          }catch(_){
            currentProfile = ensurePetsMock(getProfile() || {});
          }
        }else{
          currentProfile = ensurePetsMock(getProfile() || {});
        }

        // rellenar datos y pintar mascotas
        fillOwnerFromProfile(currentProfile);
        renderPets(currentProfile);
        computeCosts();
        setTimeout(computeCosts, 300);
      });
    } else {
      currentProfile = ensurePetsMock(getProfile() || {});
      fillOwnerFromProfile(currentProfile);
      renderPets(currentProfile);
      computeCosts();
      setTimeout(computeCosts, 300);
    }

    // Envío (Firestore + EmailJS + persistencia local)
    if(form){
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault(); ev.stopPropagation();

        const auth = (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null;
        const user = auth?.currentUser || null;
        if(!user){ alert('Debes iniciar sesión para reservar.'); return; }

        // Perfil existente?
        try{
          const db = firebase.firestore();
          const col = (window.TPL_COLLECTIONS?.owners) || 'propietarios';
          const doc = await db.collection(col).doc(user.uid).get();
          if(!doc.exists){
            alert('Completa tu perfil antes de hacer una reserva.');
            if(window.location.pathname.indexOf('perfil')===-1) { window.location.href = 'perfil.html'; }
            return;
          }
        }catch(_){}

        // Recalcular
        computeCosts();

        // Form → payload
        const fd = new FormData(form);
        const payload = {}; for(const [k,v] of fd.entries()){ payload[k] = v; }

        // Lee último cálculo
        let calc=null; try{ calc=JSON.parse(sessionStorage.getItem("tpl.lastCalc")||"null"); }catch(_){}
        const subtotal  = calc?.subtotal || 0;
        const payNow    = calc?.payNow   || 0;
        const payLater  = calc?.payLater || Math.max(0, subtotal-payNow);

        // Estado inicial (simulamos pago ahora OK → 'paid_review')
        payload._estado = 'paid_review';
        payload._uid = user.uid;
        payload._email = user.email || null;
        payload._createdAt = firebase.firestore && firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : new Date().toISOString();

        // Detalle económico
        payload.total_cliente = Number(subtotal.toFixed(2));
        payload.pagar_ahora  = Number(payNow.toFixed(2));
        payload.pendiente    = Number(payLater.toFixed(2));

        // Guardar en Firestore
        let saved = false, docId = null;
        try{
          if(firebase.firestore){
            const docRef = await firebase.firestore().collection('reservas').add(payload);
            saved = true; docId = docRef.id;
          }
        }catch(err){ console.warn('No se pudo guardar la reserva en Firestore', err); }

        // Guardar también local para que el perfil lo muestre (mock)
        try{
          const key="tpl.reservas";
          const r = {
            id: docId || ("resv_"+Date.now()),
            status: payload._estado,
            createdAt: new Date().toISOString(),
            service: payload.service || svcKey(),
            dates: { start: payload.startDate||todayStr(), end: payload.endDate||payload.startDate||todayStr() },
            owner: { name: (payload.firstName||'').trim(), email: (payload.email||''), phone: (payload.phone||'') },
            petsCount: getNumMascotas(),
            pricing: { total: subtotal, payNow, payLater }
          };
          let arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){}
          arr.unshift(r); localStorage.setItem(key, JSON.stringify(arr));
        }catch(_){}

        // EmailJS: cliente + gestión (si configuras TPL_EMAILJS.{serviceId, publicKey, templates:{cliente,gestion}})
        let mailed = false;
        try{
          if(window.emailjs){
            const cfg = window.TPL_EMAILJS || {};
            const service  = cfg.serviceId || cfg.service || '<YOUR_SERVICE_ID>';
            const pubKey   = cfg.publicKey || cfg.userId || '<YOUR_PUBLIC_KEY>';
            const tplCliente = (cfg.templates && cfg.templates.cliente) || cfg.templateCliente || '<TEMPLATE_CLIENTE>';
            const tplGestion = (cfg.templates && cfg.templates.gestion) || cfg.templateGestion || '<TEMPLATE_GESTION>';

            const paramsCliente = Object.assign({}, payload, {
              reserva_id: docId, total_txt: fmtEUR(subtotal), pay_now_txt: fmtEUR(payNow), pay_later_txt: fmtEUR(payLater)
            });
            const paramsGestion = Object.assign({}, payload, {
              reserva_id: docId, total_txt: fmtEUR(subtotal), pay_now_txt: fmtEUR(payNow), pay_later_txt: fmtEUR(payLater)
            });

            const r1 = await emailjs.send(service, tplCliente, paramsCliente, pubKey);
            const r2 = await emailjs.send(service, tplGestion, paramsGestion, pubKey);
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

  function fillOwnerFromProfile(profile){
    const firstNameEl = document.getElementById('firstName');
    const lastNameEl  = document.getElementById('lastName');
    const emailEl     = document.getElementById('email');
    const phoneEl     = document.getElementById('phone');
    const addrEl      = document.getElementById('address');
    const cpEl        = document.getElementById('postalCode');
    const regionEl    = document.getElementById('region');

    const full = (profile?.fullName) || (profile?((profile.name||"")+" "+(profile.surname||"")).trim():"");
    if(firstNameEl && full) firstNameEl.value = full;
    if(lastNameEl) lastNameEl.value = ''; // oculto por unifyNameFields
    if(emailEl && profile?.email) emailEl.value = profile.email;
    if(phoneEl && profile?.phone) phoneEl.value = profile.phone;
    if(addrEl && profile?.address) addrEl.value = profile.address;
    if(cpEl && profile?.postalCode) cpEl.value = profile.postalCode;
    if(regionEl && profile?.region) regionEl.value = profile.region;
  }

  // Exponer recálculo manual
  window.updateSummaryFromJS = computeCosts;
})();
