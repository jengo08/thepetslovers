/* TPL: INICIO BLOQUE NUEVO [tpl-reservas.js — Reserva end-to-end: UI, festivos, autorrelleno, Firestore + EmailJS] */
(function(){
  if (window.__TPL_RESERVAS_LOADED__) return;
  window.__TPL_RESERVAS_LOADED__ = true;

  'use strict';

  /* ===== Config y guardas ===== */
  const W = window;

  // Constantes de precios (si no existen ya en la página)
  if (!W.PRICES) {
    W.PRICES = {
      base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 0, exoticos: 0 },
      puppyBase: { guarderia: 20, alojamiento: 35 },
      visita60: 22, visita90: 30,
      visita60_larga: 18, visita90_larga: 27,
      visitaMed: 12, visitaMed_larga: 10,
      depositPct: 0.20
    };
  }
  if (!W.BUNDLE_GUARDERIA) {
    W.BUNDLE_GUARDERIA = {
      adult:  { 10: 135, 20: 250, 30: 315 },
      puppy:  { 10: 185, 20: 350, 30: 465 }
    };
  }

  /* ===== Helpers comunes ===== */
  const byId = (id) => document.getElementById(id);
  const qs = (k) => new URLSearchParams(location.search).get(k);
  const currency = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);
  const debounce = (fn, wait=300)=>{ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; };

  function mmdd(d){ return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function ymd(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
  function eachDate(from,to){
    const res=[]; if(!from||!to) return res;
    const d1=new Date(from), d2=new Date(to);
    if(isNaN(d1)||isNaN(d2)||d2<d1) return res;
    const cur=new Date(d1); cur.setHours(0,0,0,0); d2.setHours(0,0,0,0);
    while(cur<=d2){ res.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
    return res;
  }

  /* ===== UID + udb (base por usuario en localStorage) ===== */
  function getCurrentUserId(){
    try{
      const explicit = localStorage.getItem('tpl.currentUser');
      if (explicit) return explicit;
      const uidLS = localStorage.getItem('tpl_auth_uid');
      if (uidLS) return uidLS;
      if (W.firebase && W.firebase.auth){
        const u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return 'default';
  }
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try{ const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }catch(_){ return fallback; }
  }
  function readLocalOwner(uid){ return udbGet(uid,'owner',null); }
  function readLocalPets(uid){
    const hasPets = localStorage.getItem(udbKey(uid,'pets')) !== null;
    let arr = hasPets ? udbGet(uid,'pets',[]) : udbGet(uid,'mascotas',[]);
    return Array.isArray(arr) ? arr : [];
  }
  function splitNombreCompleto(str){
    const s = String(str||'').trim();
    if(!s) return { first:'', last:'' };
    const parts = s.split(/\s+/);
    if(parts.length === 1) return { first: parts[0], last: '' };
    return { first: parts[0], last: parts.slice(1).join(' ') };
  }

  /* ===== Firestore helpers: owners + pets ===== */
  async function loadOwnerFromFirestore(uid){
    try{
      if (!W.firebase || !firebase.firestore) return null;
      const db = firebase.firestore();
      const snap = await db.collection('owners').doc(uid).get();
      return snap.exists ? snap.data() : null;
    }catch(_){ return null; }
  }
  async function loadPetsFromFirestore(uid){
    try{
      if (!W.firebase || !firebase.firestore) return [];
      const db = firebase.firestore();
      const col = await db.collection('owners').doc(uid).collection('pets').get();
      return col.docs.map(d=>({ id:d.id, ...(d.data()||{}) }));
    }catch(_){ return []; }
  }
  function pickPetSnapshotsByNames(allPets, names){
    const out = [];
    const norm = s => String(s||'').trim().toLowerCase();
    names.forEach(n=>{
      const found = allPets.find(p => norm(p.nombre) === norm(n));
      if (found) out.push(found);
      else out.push({ nombre: n }); // dejamos al menos el nombre
    });
    return out;
  }

  /* ===== Festivos (local json -> Nager -> básico) ===== */
  const SPECIAL_MMDD = ['12-24','12-25','12-31','01-01'];
  const REGION_TO_COUNTY = {
    andalucia:'ES-AN', aragon:'ES-AR', asturias:'ES-AS', baleares:'ES-IB', canarias:'ES-CN', cantabria:'ES-CB',
    'castilla-la-mancha':'ES-CM', 'castilla-y-leon':'ES-CL', cataluna:'ES-CT', ceuta:'ES-CE', valenciana:'ES-VC',
    extremadura:'ES-EX', galicia:'ES-GA', 'la-rioja':'ES-RI', madrid:'ES-MD', melilla:'ES-ML', murcia:'ES-MC',
    navarra:'ES-NC', euskadi:'ES-PV', nacional:null
  };
  const COUNTY_TO_REGIONKEY = {
    'ES-AN':'AN','ES-AR':'AR','ES-AS':'AS','ES-IB':'IB','ES-CN':'CN','ES-CB':'CB','ES-CM':'CM','ES-CL':'CL','ES-CT':'CT','ES-VC':'VC',
    'ES-EX':'EX','ES-GA':'GA','ES-RI':'RI','ES-MD':'MD','ES-MC':'MC','ES-NC':'NC','ES-PV':'PV','ES-CE':'CE','ES-ML':'ML'
  };
  const _festivosCache = new Map();
  async function fetchLocalHolidays(year){
    const urls = [`/festivos-es-${year}.json`, `festivos-es-${year}.json`];
    for(const url of urls){
      try{
        const r = await fetch(url, {cache:'no-store'});
        if(!r.ok) continue;
        const data = await r.json();
        const nacional = new Set((data.national || data.nacional || []).map(x => x.date || x));
        const porCcaa = new Map();
        if(data.regions){ Object.entries(data.regions).forEach(([k, arr])=>{ porCcaa.set(k, new Set((arr||[]).map(x => x.date || x))); }); }
        return { nacional, porCcaa, _src:'local' };
      }catch(_){}
    }
    return null;
  }
  async function fetchNagerHolidays(year){
    const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/ES`, {cache:'force-cache'});
    if(!r.ok) throw new Error('Nager fail');
    const data = await r.json();
    const nacional = new Set();
    const porCcaa = new Map();
    for(const h of data){
      const date = h.date;
      if(!h.counties || !h.counties.length){ nacional.add(date); }
      else{
        for(const c of h.counties){
          const key = COUNTY_TO_REGIONKEY[c] || c;
          if(!porCcaa.has(key)) porCcaa.set(key, new Set());
          porCcaa.get(key).add(date);
        }
      }
    }
    return { nacional, porCcaa, _src:'nager' };
  }
  async function fetchHolidaysForYear(year){
    if(_festivosCache.has(year)) return _festivosCache.get(year);
    try{
      const raw = localStorage.getItem(`tpl_festivos_${year}`);
      if(raw){
        const parsed = JSON.parse(raw);
        if(parsed?.t && Date.now() - parsed.t <= 24*3600*1000){
          const nacional = new Set(parsed.d || []);
          const porCcaa = new Map((parsed.r || []).map(([k,arr])=>[k, new Set(arr||[])]));
          const cached = {nacional, porCcaa, _src:'localStorage'};
          _festivosCache.set(year, cached); return cached;
        }
      }
    }catch(_){}
    const local = await fetchLocalHolidays(year);
    if(local){ _festivosCache.set(year, local); return local; }
    try{
      const nager = await fetchNagerHolidays(year);
      _festivosCache.set(year, nager);
      try{
        localStorage.setItem(`tpl_festivos_${year}`, JSON.stringify({ t:Date.now(), d:[...nager.nacional], r:[...nager.porCcaa.entries()].map(([k,v])=>[k,[...v]]) }));
      }catch(_){}
      return nager;
    }catch(_){}
    const basic = { nacional: new Set([`${year}-01-06`, `${year}-05-01`, `${year}-08-15`, `${year}-10-12`, `${year}-11-01`, `${year}-12-06`, `${year}-12-08`, `${year}-12-25`]), porCcaa: new Map(), _src:'basic' };
    _festivosCache.set(year, basic); return basic;
  }
  async function calcFestivosAutoAsync(region, start, end){
    const days = eachDate(start, end);
    if(!days.length) return { festivo:0, senalado:0, nDias:0 };
    let festivo = 0, senalado = 0;
    for(const d of days){
      const year = d.getFullYear();
      const iso = ymd(d);
      const pack = await fetchHolidaysForYear(year);
      const county = REGION_TO_COUNTY[region || 'nacional'] || null;
      const regKey = COUNTY_TO_REGIONKEY[county] || county;
      const isNat = !!pack?.nacional?.has(iso);
      const isReg = regKey ? !!(pack?.porCcaa?.get(regKey)?.has(iso) || pack?.porCcaa?.get(county)?.has(iso)) : false;
      const isSpecial = SPECIAL_MMDD.includes(mmdd(d));
      if(isNat || isReg) festivo += 10;
      if(isSpecial) senalado += 30;
    }
    return { festivo, senalado, nDias: days.length };
  }

  /* ===== Cálculos de servicio ===== */
  function calcPetSupplements(service, species, n){
    if(n <= 1) return 0;
    if(service === 'visitas'){
      const extra = n - 1;
      if(extra === 1) return 12;
      if(extra === 2) return 8 * 2;
      if(extra >= 3) return 6 * extra;
      return 0;
    }
    if(service === 'paseos') return 8 * (n - 1);
    if(service === 'alojamiento' && species === 'perro') return 25 * (n - 1);
    return 0;
  }
  function getBasePrice(service, species, isPuppy){
    const PR = W.PRICES;
    if(service === 'visitas') return 0;
    if(service === 'alojamiento'){
      return isPuppy ? (PR.puppyBase.alojamiento ?? PR.base.alojamiento) : PR.base.alojamiento;
    }
    if(service === 'guarderia'){
      return isPuppy ? (PR.puppyBase.guarderia ?? PR.base.guarderia) : PR.base.guarderia;
    }
    return PR.base[service] || 0;
  }
  function calcVisitas(visitDurationMin, dailyVisits, nDias){
    const PR = W.PRICES;
    const longStay = (nDias >= 11);
    const price1 = (visitDurationMin === 90) ? (longStay ? PR.visita90_larga : PR.visita90) : (longStay ? PR.visita60_larga : PR.visita60);
    const price2 = dailyVisits === 2 ? (longStay ? PR.visitaMed_larga : PR.visitaMed) : 0;
    return { price1, price2 };
  }
  function calcBonoGuarderia(nDias, isPuppy){
    const PR = W.PRICES;
    const table  = isPuppy ? W.BUNDLE_GUARDERIA.puppy : W.BUNDLE_GUARDERIA.adult;
    const perDay = isPuppy ? (PR.puppyBase.guarderia ?? PR.base.guarderia) : PR.base.guarderia;
    const bundlePrice = table[nDias];
    if (!bundlePrice) return 0;
    const normalTotal = perDay * nDias;
    return Math.max(0, normalTotal - bundlePrice);
  }

  /* ===== UI principal ===== */
  function main(){
    const form = byId('bookingForm');
    const wall = byId('authWall');
    if (!form) return;

    const els = {
      service: byId('service'),
      region: byId('region'),
      startDate: byId('startDate'),
      endDate: byId('endDate'),
      start: byId('start'),
      end: byId('end'),

      address: byId('location'),
      addrSuggest: byId('tplAddrSuggest'),
      postalCode: byId('postalCode'),

      species: byId('species'),
      isPuppy: byId('isPuppy'),
      numPets: byId('numPets'),
      numPetsExact: byId('numPetsExact'),

      needTravel: byId('needTravel'),
      travelBubble: byId('travelBubble'),

      visitDuration: byId('visitDuration'),
      visitDaily: byId('visitDaily'),
      fieldVisitDuration: byId('fieldVisitDuration'),
      fieldVisitDaily: byId('fieldVisitDaily'),

      firstName: byId('firstName'),
      lastName: byId('lastName'),
      phone: byId('phone'),
      email: byId('email'),
      contactTime: byId('contactTime'),

      petsContainer: byId('petsContainer'),
      petsListHidden: byId('petsListHidden'),
      petNamesList: byId('tplPetNamesList'),

      sumBase: byId('sumBase'),
      sumVisit1: byId('sumVisit1'),
      sumVisit2: byId('sumVisit2'),
      rowVisit1: byId('rowVisit1'),
      rowVisit2: byId('rowVisit2'),
      sumPets: byId('sumPets'),
      sumFestivo: byId('sumFestivo'),
      sumSenalado: byId('sumSenalado'),
      sumTravel: byId('sumTravel'),
      sumBono: byId('sumBono'),
      rowBono: byId('rowBono'),
      sumSubtotal: byId('sumSubtotal'),
      sumDeposit: byId('sumDeposit'),

      summaryField: byId('summaryField'),
    };

    // Preselección de servicio por query/referrer
    (function presetService(){
      const raw = (qs('service') || qs('svc') || '').toLowerCase();
      const norm = raw.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-');
      const map = {
        visitas:'visitas','visitas-gatos':'visitas',
        paseos:'paseos',
        guarderia:'guarderia','guarderia-dia':'guarderia',
        alojamiento:'alojamiento','estancias':'alojamiento',
        bodas:'bodas','boda':'bodas',
        postquirurgico:'postquirurgico','post-quirurgico':'postquirurgico','postquirugico':'postquirurgico',
        transporte:'transporte',
        exoticos:'exoticos','exotico':'exoticos'
      };
      let val = map[norm] || (()=>{
        try{
          const u = new URL(document.referrer || '');
          const p = (u.pathname || '').toLowerCase();
          if(p.includes('guarderia')) return 'guarderia';
          if(p.includes('estancias') || p.includes('alojamiento')) return 'alojamiento';
          if(p.includes('paseos')) return 'paseos';
          if(p.includes('visitas')) return 'visitas';
          if(p.includes('bodas')) return 'bodas';
          if(p.includes('postquir')) return 'postquirurgico';
          if(p.includes('transporte')) return 'transporte';
          if(p.includes('exotico')) return 'exoticos';
        }catch(_){}
        return null;
      })();
      if(val && els.service){ els.service.value = val; els.service.disabled = true; }
    })();

    function toggleFields(){
      const svc = els.service?.value;
      const isVisitas = (svc === 'visitas');
      form.classList.toggle('tpl-visitas-on', isVisitas);
      if(els.fieldVisitDuration) els.fieldVisitDuration.hidden = !isVisitas;
      if(els.fieldVisitDaily) els.fieldVisitDaily.hidden = !isVisitas;
      if(els.visitDuration){ els.visitDuration.disabled = !isVisitas; if(!isVisitas) els.visitDuration.value='60'; }
      if(els.visitDaily){ els.visitDaily.disabled = !isVisitas; if(!isVisitas) els.visitDaily.value='1'; }
      const species = els.species?.value || 'perro';
      const puppyApplies = (svc === 'guarderia' || svc === 'alojamiento') && species !== 'otros' && !isVisitas;
      if(els.isPuppy) els.isPuppy.parentElement.hidden = !puppyApplies;
      if(isVisitas && els.species) els.species.value = 'gato';
    }

    function getNumMascotas(){
      let n = els.numPets?.value || '1';
      if(n === '6+') n = Math.max(6, parseInt(els.numPetsExact?.value,10) || 6);
      return parseInt(n,10);
    }
    function syncPetsExact(){
      if(els.numPets?.value === '6+'){
        els.numPetsExact.style.display = 'block';
        els.numPetsExact.required = true;
      }else{
        els.numPetsExact.style.display = 'none';
        els.numPetsExact.required = false;
      }
    }

    let PROFILE_PET_NAMES = [];
    function fillPetDatalist(){
      if(!els.petNamesList) return;
      els.petNamesList.innerHTML = (PROFILE_PET_NAMES||[])
        .map(n => `<option value="${(n||'').replace(/"/g,'&quot;')}"></option>`).join('');
    }
    function renderPetNameFields(n){
      n = Math.max(1, n|0);
      const wrap = els.petsContainer; if(!wrap) return;
      const current = wrap.querySelectorAll('[data-pet-row]').length;
      for(let i=current+1;i<=n;i++){
        const row = document.createElement('div');
        row.className = 'booking-field';
        row.setAttribute('data-pet-row', i.toString());
        row.innerHTML = `
          <label for="petName_${i}">Nombre de la mascota ${n>1?`#${i}`:''}</label>
          <input type="text" id="petName_${i}" name="Mascota_${i}" list="tplPetNamesList" placeholder="Ej. Nala" autocomplete="off">
        `;
        wrap.appendChild(row);
      }
      wrap.querySelectorAll('[data-pet-row]').forEach(r=>{
        const idx = parseInt(r.getAttribute('data-pet-row'),10);
        if(idx>n) r.remove();
      });
      updatePetsListHidden();
      wrap.querySelectorAll('input[id^="petName_"]').forEach(inp=>{
        inp.addEventListener('input', updatePetsListHidden);
      });
    }
    function updatePetsListHidden(){
      const names = [...els.petsContainer.querySelectorAll('input[id^="petName_"]')].map(i=>i.value.trim()).filter(Boolean);
      if (els.petsListHidden) els.petsListHidden.value = names.join(', ');
    }

    function travelSync(){
      if(els.travelBubble) els.travelBubble.style.display = els.needTravel?.value === 'si' ? 'block' : 'none';
      if(els.sumTravel) els.sumTravel.textContent = (els.needTravel?.value === 'si') ? 'pendiente' : '—';
    }

    async function recalc(){
      const svc = els.service?.value || '';
      const species = (els.species?.value || 'perro');
      const isExotic = species === 'otros';
      const isVisitas = (svc === 'visitas');
      const puppyAllowed = (svc === 'alojamiento' || svc === 'guarderia') && !isExotic && !isVisitas;
      const isPuppy = puppyAllowed && (els.isPuppy?.value === 'si');

      const nMasc = getNumMascotas();
      const region = els.region?.value || 'nacional';
      const start = els.startDate?.value;
      const end   = els.endDate?.value;
      const { festivo, senalado, nDias } = await calcFestivosAutoAsync(region, start, end);

      let base = 0, visit1 = 0, visit2 = 0, bono = 0;
      let pets = 0;

      if(isVisitas){
        const dur = parseInt(els.visitDuration?.value || '60', 10);
        const daily = parseInt(els.visitDaily?.value || '1', 10);
        const perDay = calcVisitas(dur, daily, nDias);
        visit1 = perDay.price1 * nDias;
        visit2 = perDay.price2 * nDias;
        base = 0;
        pets = calcPetSupplements(svc, 'gato', nMasc);
      } else {
        base = getBasePrice(svc, species, isPuppy) * nDias;
        pets = calcPetSupplements(svc, species, nMasc);
        if(svc === 'guarderia'){ bono = calcBonoGuarderia(nDias, isPuppy); }
      }

      const subtotal = (base + visit1 + visit2 + pets + festivo + senalado) - bono;
      const deposit = subtotal * ((W.PRICES && W.PRICES.depositPct) || 0.2);

      if (els.sumBase) els.sumBase.textContent = isVisitas ? '—' : (subtotal>0 ? currency(base) : '—');
      if (els.rowVisit1) els.rowVisit1.style.display = isVisitas ? '' : 'none';
      if (els.rowVisit2) els.rowVisit2.style.display = (isVisitas && visit2 > 0) ? '' : 'none';
      if (els.sumVisit1) els.sumVisit1.textContent = currency(visit1);
      if (els.sumVisit2) els.sumVisit2.textContent = currency(visit2);
      if (els.sumPets) els.sumPets.textContent = currency(pets);
      if (els.sumFestivo) els.sumFestivo.textContent = currency(festivo);
      if (els.sumSenalado) els.sumSenalado.textContent = currency(senalado);
      if (els.rowBono) els.rowBono.style.display = (svc === 'guarderia' && bono > 0) ? '' : 'none';
      if (els.sumBono) els.sumBono.textContent = currency(bono);
      if (els.sumSubtotal) els.sumSubtotal.textContent = (subtotal>0) ? currency(subtotal) : '—';
      if (els.sumDeposit) els.sumDeposit.textContent = (subtotal>0) ? currency(deposit) : '—';
    }
    async function recalcAll(){ toggleFields(); syncPetsExact(); renderPetNameFields(getNumMascotas()); await recalc(); }

    ['change','input'].forEach(ev=>{
      ['service','species','isPuppy','numPets','numPetsExact','region','startDate','endDate','visitDuration','visitDaily','needTravel'].forEach(id=>{
        const el = byId(id); if(el) el.addEventListener(ev, recalcAll);
      });
    });

    // Init UI
    renderPetNameFields(1);
    recalcAll();
    els.numPets && els.numPets.addEventListener('change', ()=>{ syncPetsExact(); renderPetNameFields(getNumMascotas()); updatePetsListHidden(); });
    els.numPetsExact && els.numPetsExact.addEventListener('input', ()=>{ renderPetNameFields(getNumMascotas()); updatePetsListHidden(); });
    els.needTravel && els.needTravel.addEventListener('change', travelSync);
    travelSync();

    // Autocomplete dirección (OpenStreetMap Nominatim)
    async function searchAddresses(q){
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=es&q=${encodeURIComponent(q)}`;
      const r = await fetch(url, { headers: { 'Accept':'application/json' }});
      if(!r.ok) return [];
      return r.json();
    }
    function renderAddrSuggestions(list){
      if(!els.addrSuggest) return;
      if(!list.length){ els.addrSuggest.style.display='none'; els.addrSuggest.innerHTML=''; return; }
      els.addrSuggest.innerHTML = list.map((it)=>(`
        <div class="tpl-addr-item" role="option" tabindex="0" data-raw='${JSON.stringify(it).replace(/'/g,"&#39;")}'>
          ${it.display_name}
        </div>`)).join('');
      els.addrSuggest.style.display = 'block';
      els.addrSuggest.querySelectorAll('.tpl-addr-item').forEach(node=>{
        node.addEventListener('click', ()=> chooseAddr(JSON.parse(node.dataset.raw.replace(/&#39;/g,"'"))));
        node.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') chooseAddr(JSON.parse(node.dataset.raw.replace(/&#39;/g,"'"))); });
      });
    }
    function chooseAddr(item){
      if (els.address) els.address.value = (item?.display_name || '').replace(/, España$/,'');
      const pc = item?.address?.postcode || '';
      if(els.postalCode){ els.postalCode.value = pc; }
      if (els.addrSuggest) els.addrSuggest.style.display='none';
    }
    const addressInputHandler = debounce(async ()=>{
      const q = (els.address?.value || '').trim();
      if(q.length < 4){ renderAddrSuggestions([]); return; }
      try{ renderAddrSuggestions(await searchAddresses(q) || []); }
      catch(_){ renderAddrSuggestions([]); }
    }, 380);
    if(els.address){
      els.address.addEventListener('input', addressInputHandler);
      els.address.addEventListener('focus', addressInputHandler);
      document.addEventListener('click', (e)=>{ if(els.addrSuggest && !els.addrSuggest.contains(e.target) && e.target!==els.address){ els.addrSuggest.style.display='none'; }});
    }

    // Autorrelleno desde perfil (local + Firestore)
    async function autoPuppyFromProfile(){
      try{
        const uid = getCurrentUserId();
        const localPets = readLocalPets(uid);
        let refPet = localPets && localPets[0];
        if (W.firebase && W.firebase.auth && firebase.auth().currentUser){
          const petsFS = await loadPetsFromFirestore(uid);
          if (Array.isArray(petsFS) && petsFS.length) refPet = petsFS[0];
        }
        if (!refPet) return;

        // Heurística: "edad" con "mes" y <= 6 -> cachorro
        let isP = false;
        const raw = String(refPet.edad || '').toLowerCase();
        const m = raw.match(/(\d+)\s*mes/);
        if (m){ isP = parseInt(m[1],10) <= 6; }
        if (els.isPuppy && !els.isPuppy.parentElement.hidden){
          els.isPuppy.value = isP ? 'si' : 'no';
        }
        await recalc();
      }catch(_){}
    }

    async function autoContactFromProfile(user){
      try{
        const uid = getCurrentUserId();
        // Owner local
        let owner = readLocalOwner(uid);
        // Si hay sesión, intento Firestore
        if ((!owner || !owner.email) && user && W.firebase && firebase.firestore){
          const fsOwner = await loadOwnerFromFirestore(uid);
          if (fsOwner) owner = {
            nombre: fsOwner.nombre || fsOwner.nombreCompleto || '',
            dni: fsOwner.dni || '',
            direccion: fsOwner.direccion || '',
            cp: fsOwner.cp || '',
            provincia: fsOwner.provincia || '',
            localidad: fsOwner.localidad || '',
            email: fsOwner.email || '',
            telefono: fsOwner.telefono || '',
            contacto: fsOwner.contacto || 'whatsapp',
            contactoHorario: fsOwner.contactoHorario || '',
            zona: fsOwner.zona || ''
          };
        }
        // Pintar datos de contacto
        if (owner){
          const n = splitNombreCompleto(owner.nombre);
          if (els.firstName && !els.firstName.value) els.firstName.value = n.first || '';
          if (els.lastName  && !els.lastName.value)  els.lastName.value  = n.last || '';
          if (els.email     && !els.email.value)     els.email.value     = owner.email || user?.email || '';
          if (els.phone     && !els.phone.value)     els.phone.value     = owner.telefono || user?.phoneNumber || '';
          if (els.address   && !els.address.value)   els.address.value   = owner.direccion || '';
          if (els.postalCode&& !els.postalCode.value)els.postalCode.value= owner.cp || '';
        }
        // Datalist de mascotas
        PROFILE_PET_NAMES = (readLocalPets(uid).map(p=>p?.nombre||'').filter(Boolean));
        if (user && W.firebase && firebase.firestore){
          const petsFS = await loadPetsFromFirestore(uid);
          const namesFS = petsFS.map(p=> String(p?.nombre||'').trim()).filter(Boolean);
          PROFILE_PET_NAMES = Array.from(new Set([...(PROFILE_PET_NAMES||[]), ...namesFS]));
        }
        fillPetDatalist();
        // Precarga primera mascota si no hay nada escrito
        const firstInput = els.petsContainer?.querySelector('input[id^="petName_"]');
        if (firstInput && !firstInput.value && PROFILE_PET_NAMES.length){
          firstInput.value = PROFILE_PET_NAMES[0];
          updatePetsListHidden();
        }
      }catch(_){}
    }

    // Muro/auth + login inline
    function renderInlineLogin(){
      const host = byId('tpl-inline-login');
      if(!host) return;
      host.innerHTML = `
        <div class="tpl-login-card" role="region" aria-label="Acceso rápido">
          <h3 class="tpl-login-title">Accede aquí mismo</h3>
          <div class="tpl-socials">
            <button type="button" class="tpl-btn-social" id="tpl-google-btn">
              <i class="fa-brands fa-google"></i> Continuar con Google
            </button>
          </div>
          <div class="tpl-sep"><span>o</span></div>
          <form class="tpl-login-form" id="tpl-inline-form" novalidate>
            <label>Email</label>
            <input type="email" name="email" required autocomplete="email" />
            <label>Contraseña</label>
            <input type="password" name="password" required autocomplete="current-password" />
            <button type="submit" class="tpl-btn">Iniciar sesión</button>
            <a class="tpl-btn-outline" href="registro.html?next=reserva.html">Regístrate</a>
            <button type="button" class="tpl-link" id="tpl-reset">¿Has olvidado la contraseña?</button>
            <p class="tpl-login-msg" aria-live="polite"></p>
          </form>
        </div>
      `;
      if (!W.firebase || !firebase.auth) return;
      const auth = firebase.auth();
      const isIOS = /iP(ad|hone|od)/i.test(navigator.userAgent);
      const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

      const form = byId('tpl-inline-form');
      const msg  = host.querySelector('.tpl-login-msg');
      const btnG = byId('tpl-google-btn');
      const btnReset = byId('tpl-reset');

      form.addEventListener('submit', async (e)=>{
        e.preventDefault();
        msg.textContent = 'Accediendo…';
        const email = form.email.value.trim();
        const pass  = form.password.value;
        try{
          await auth.signInWithEmailAndPassword(email, pass);
          msg.textContent = '¡Listo!';
          location.reload();
        }catch(err){
          msg.textContent = (err && err.message) || 'No se pudo iniciar sesión.';
        }
      });

      btnG.addEventListener('click', async (e)=>{
        e.preventDefault();
        msg.textContent = 'Conectando con Google…';
        try{
          const provider = new firebase.auth.GoogleAuthProvider();
          if (isIOS && isSafari) { await auth.signInWithRedirect(provider); }
          else { await auth.signInWithPopup(provider); }
        }catch(err){
          msg.textContent = (err && err.message) || 'No se pudo iniciar con Google.';
        }
      });

      btnReset.addEventListener('click', async (e)=>{
        e.preventDefault();
        const email = form.email.value.trim();
        if(!email){ msg.textContent='Escribe tu email arriba para enviarte el enlace.'; return; }
        try{
          await auth.sendPasswordResetEmail(email);
          msg.textContent = 'Revisa tu correo para restablecer la contraseña.';
        }catch(err){
          msg.textContent = (err && err.message) || 'No se pudo enviar el email.';
        }
      });
    }

    function updateAuthUI(user){
      const logged = !!user;
      form.classList.toggle('disabled', !logged);
      if (wall) wall.style.display = logged ? 'none' : 'block';
      if (logged){ autoContactFromProfile(user); autoPuppyFromProfile(); }
      else { autoContactFromProfile(null); }
    }

    if (W.firebase && firebase.auth){
      firebase.auth().onAuthStateChanged(u=>{
        updateAuthUI(u);
        if(!u) renderInlineLogin();
      });
    }else{
      // Sin Firebase: prefill desde local, pero formulario se queda deshabilitado
      autoContactFromProfile(null);
    }

    // Validación preferencia de contacto
    function validateContactPreference(e){
      const pref = (new FormData(form).get('Preferencia_contacto')) || 'cualquiera';
      const tel  = els.phone?.value?.trim();
      const mail = els.email?.value?.trim();
      if(pref === 'telefono' || pref === 'whatsapp'){
        if(!tel){ e.preventDefault(); alert('Por favor, indícanos tu teléfono para poder contactarte.'); return false; }
      }else if(pref === 'email'){
        if(!mail){ e.preventDefault(); alert('Por favor, indícanos tu correo para poder contactarte.'); return false; }
      }
      return true;
    }

    // Preparar campo resumen antes de enviar (para email y admin)
    function buildSummaryIntoHidden(){
      const regionText = els.region?.options?.[els.region.selectedIndex]?.text || 'España';
      let petsVal = els.numPets?.value || '1';
      if(petsVal === '6+') petsVal = Math.max(6, parseInt(els.numPetsExact?.value,10) || 6).toString();
      updatePetsListHidden();

      const lines = [];
      lines.push(`Servicio: ${els.service?.options?.[els.service.selectedIndex]?.text || ''}`);
      lines.push(`Fechas: ${els.startDate?.value || '-'} a ${els.endDate?.value || '-'}`);
      lines.push(`Hora: ${els.start?.value || '-'} a ${els.end?.value || '-'}`);
      if(els.service?.value === 'visitas'){
        lines.push(`Visita: ${els.visitDuration?.value || '60'} min, ${els.visitDaily?.value || '1'} visita(s)/día`);
      }else{
        const puppyAllowed = (els.service?.value === 'alojamiento' || els.service?.value === 'guarderia') && (els.species?.value !== 'otros');
        lines.push(`Tipo de animal: ${els.species?.value || '-'}`);
        lines.push(`Cachorro: ${puppyAllowed ? (els.isPuppy?.value || 'no') : 'no procede'}`);
      }
      lines.push(`Nº mascotas: ${petsVal}`);
      const petNames = els.petsListHidden.value || '';
      if(petNames) lines.push(`Nombres mascotas: ${petNames}`);
      lines.push(`Dirección: ${els.address?.value || '-'}`);
      lines.push(`CP: ${els.postalCode?.value || '-'}`);
      lines.push(`CCAA: ${regionText}`);
      lines.push(`Preferencia contacto: ${new FormData(form).get('Preferencia_contacto') || 'cualquiera'}`);
      if(els.contactTime?.value) lines.push(`Hora preferida contacto: ${els.contactTime.value}`);
      lines.push(`Festivos (auto): ${els.sumFestivo?.textContent || '0.00'} €`);
      lines.push(`Días especiales (auto): ${els.sumSenalado?.textContent || '0.00'} €`);
      if(els.service?.value === 'guarderia' && els.rowBono?.style.display !== 'none'){
        lines.push(`Bono guardería (descuento): −${els.sumBono?.textContent || '0.00'} €`);
      }
      lines.push(`Subtotal (sin desplazamiento): ${els.sumSubtotal?.textContent || '0.00'} €`);
      lines.push(`Depósito a retener: ${els.sumDeposit?.textContent || '0.00'} €`);
      if (els.summaryField) els.summaryField.value = lines.join(' | ');
    }

    // Overlay éxito
    function showSuccessOverlay(){
      const msg = form?.dataset?.tplSuccess || 'Tu solicitud se ha enviado correctamente.';
      const go  = form?.dataset?.tplRedirect || 'perfil.html';
      let wrap = byId('tpl-overlay');
      if(!wrap){
        wrap = document.createElement('div');
        wrap.id = 'tpl-overlay';
        wrap.className = 'tpl-overlay';
        wrap.innerHTML = '<div class="tpl-modal" role="dialog" aria-live="polite"><p></p><button type="button" class="cta-button" id="tpl-ov-accept">Aceptar</button></div>';
        document.body.appendChild(wrap);
      }
      wrap.querySelector('.tpl-modal p').textContent = msg;
      wrap.classList.add('on');
      wrap.querySelector('#tpl-ov-accept').onclick = function(){ location.href = go; };
    }

    // EmailJS envío opcional
    async function tryEmailJS(fd, extra){
      if(!W.emailjs) return false;
      try{
        const cfg = W.TPL_EMAILJS || {};
        const service  = cfg.serviceId || cfg.service;
        const template = (cfg.templates && (cfg.templates.reserva || cfg.templates.booking)) || cfg.templateReserva || cfg.templateBooking || cfg.templateId;
        const pubKey   = cfg.publicKey || cfg.userId;
        if(service && template){
          const payload = Object.fromEntries(fd.entries());
          Object.assign(payload, extra || {});
          if (pubKey) { await emailjs.send(service, template, payload, pubKey); }
          else { await emailjs.send(service, template, payload); }
          return true;
        }
      }catch(err){ console.warn('EmailJS error', err); }
      return false;
    }

    // Submit → Firestore + EmailJS + overlay + persist lastReservation
    form.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!validateContactPreference(e)) return;
      buildSummaryIntoHidden();

      // Guardar en Firestore
      try{
        if (W.firebase && firebase.firestore){
          const db   = firebase.firestore();
          const auth = firebase.auth ? firebase.auth() : null;
          const u    = auth && auth.currentUser ? auth.currentUser : null;

          const fd = new FormData(form);
          const payload = {};
          fd.forEach((v,k)=>{ payload[k]=v; });

          const uid = getCurrentUserId();
          payload._page = location.href;
          payload._estado = 'enviada';
          payload._uid = (u && u.uid) ? u.uid : (uid !== 'default' ? uid : null);
          payload._email = (u && (u.email || null)) || (payload.Email || null);
          if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();

          // Snapshots owner + pets
          let owner = readLocalOwner(uid);
          if ((!owner || !owner.email) && u){ owner = await loadOwnerFromFirestore(uid) || owner; }
          const petsLocal = readLocalPets(uid);
          let petsFS = [];
          if (u){ try{ petsFS = await loadPetsFromFirestore(uid); }catch(_){ petsFS = []; } }
          const allPets = [...petsLocal, ...petsFS];

          const petNames = (payload.Mascotas_lista || '')
            .split(',').map(s=>s.trim()).filter(Boolean);
          const petsSnapshot = petNames.length
            ? pickPetSnapshotsByNames(allPets, petNames)
            : allPets.slice(0, Math.max(1, parseInt(payload.N_mascotas||'1',10)));

          payload._snapshots = {
            owner: owner ? {
              nombre: owner.nombre || owner.nombreCompleto || '',
              dni: owner.dni || '',
              direccion: owner.direccion || '',
              cp: owner.cp || '',
              provincia: owner.provincia || '',
              localidad: owner.localidad || '',
              email: owner.email || '',
              telefono: owner.telefono || '',
              contacto: owner.contacto || '',
              contactoHorario: owner.contactoHorario || '',
              zona: owner.zona || ''
            } : null,
            pets: petsSnapshot.map(p=>({
              nombre: p.nombre || '',
              microchip: p.microchip || '',
              especie: p.especie || '',
              raza: p.raza || p.tipoExotico || '',
              edad: p.edad || '',
              peso: p.peso || '',
              esterilizado: p.esterilizado || '',
              vacunas: p.vacunas || '',
              salud: p.salud || '',
              tratamiento: p.tratamiento || '',
              comidas: p.comidas || '',
              salidas: p.salidas || '',
              tamano: p.tamano || '',
              clinica: p.clinica || '',
              hospitalPref: p.hospitalPref || '',
              comportamiento: p.comportamiento || '',
              foto: p.foto || ''
            }))
          };

          // Extras útiles para admin
          payload._serviceType = payload.Servicio || '';
          payload._startDate = payload.Fecha_inicio || '';
          payload._endDate   = payload.Fecha_fin || '';
          payload._startTime = payload.Hora_inicio || '';
          payload._endTime   = payload.Hora_fin || '';
          payload._nMascotas = payload.N_mascotas || '';
          payload._subtotal  = byId('sumSubtotal')?.textContent || '';
          payload._deposit   = byId('sumDeposit')?.textContent || '';

          await db.collection('reservas').add(payload);
          console.log('[TPL reservas] Guardado en Firestore');

          // Email opcional
          await tryEmailJS(fd, { _page: location.href, _tipo: 'reserva', _estado: 'enviada' });

          // Persistir última reserva (para perfil.html)
          try{
            const localUid = uid || 'default';
            const last = {
              createdAt: Date.now(),
              estado: 'enviada',
              service: payload._serviceType,
              startDate: payload._startDate,
              endDate: payload._endDate
            };
            localStorage.setItem(udbKey(localUid,'lastReservation'), JSON.stringify(last));
          }catch(_){}
        } else {
          // Sin Firestore: intentamos al menos email
          const fd = new FormData(form);
          await tryEmailJS(fd, { _page: location.href, _tipo: 'reserva', _estado: 'enviada' });
        }
      }catch(err){
        console.warn('[TPL reservas] Error al guardar', err);
        // Intento de email aunque falle
        try{
          const fd = new FormData(form);
          await tryEmailJS(fd, { _page: location.href, _tipo: 'reserva', _estado: 'enviada' });
        }catch(_){}
      }

      showSuccessOverlay();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
/* TPL: FIN BLOQUE NUEVO */
/* TPL: INICIO BLOQUE NUEVO [Reservas: selector de mascotas + adjuntar detalle propietario/mascotas a la reserva] */
(function(){
  'use strict';

  // ===== Helpers UDB coherentes con tus scripts =====
  function getCurrentUserId(){
    try{
      const explicit = localStorage.getItem('tpl.currentUser');
      if (explicit) return explicit;
      const uidLS = localStorage.getItem('tpl_auth_uid');
      if (uidLS) return uidLS;
      if (window.firebase && typeof firebase.auth === 'function'){
        const u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return 'default';
  }
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try{ const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }catch(_){ return fallback; }
  }
  function norm(s){ return String(s||'').trim(); }
  function nkey(s){ return norm(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); }

  // ===== Cargar owner + mascotas del usuario =====
  function getOwner(){ return udbGet(getCurrentUserId(), 'owner', null); }
  function getPets(){
    const uid = getCurrentUserId();
    const hasPets = localStorage.getItem(udbKey(uid,'pets')) !== null;
    let arr = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
    if (!Array.isArray(arr)) arr = [];
    // dedupe suave por nombre+microchip+especie
    const seen = new Set(), out=[];
    arr.forEach(p=>{
      const key = `${nkey(p?.nombre)}|${nkey(p?.microchip)}|${nkey(p?.especie||p?.tipo||'')}`;
      if (seen.has(key)) return; seen.add(key); out.push(p);
    });
    return out;
  }

  // ===== UI: modal selector =====
  function openPetPicker(){
    const pets = getPets();
    if (!pets.length){ alert('No tienes mascotas guardadas todavía. Añádelas desde tu perfil.'); return; }

    const overlay = document.getElementById('tpl-petpicker');
    const list = document.getElementById('tpl-petpicker-list');
    const btnApply = document.getElementById('tpl-petpicker-apply');
    const btnCancel = document.getElementById('tpl-petpicker-cancel');
    if (!overlay || !list || !btnApply || !btnCancel) return;

    list.innerHTML = pets.map((p, i)=>{
      const foto = (typeof p.foto === 'string' && p.foto) ? `<img src="${p.foto}" alt="" style="width:42px;height:42px;object-fit:cover;border-radius:50%;border:1px solid #eee">` : `<span style="width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #eee;color:#9aa0a6"><i class="fa-solid fa-paw"></i></span>`;
      const raza = norm(p.raza || p.tipoExotico || '');
      const esp  = norm(p.especie || p.tipo || '');
      const sub  = [esp, raza].filter(Boolean).join(' · ');
      return `
        <label style="display:flex;align-items:center;gap:10px;border:1px solid #eee;border-radius:10px;padding:8px 10px">
          <input type="checkbox" class="tpl-petpick" value="${i}" style="transform:scale(1.2)">
          ${foto}
          <span style="display:flex;flex-direction:column;line-height:1.25">
            <strong>${norm(p.nombre)||'Sin nombre'}</strong>
            <span style="color:#666;font-size:.92rem">${sub||''}</span>
          </span>
        </label>
      `;
    }).join('');

    function close(){ overlay.classList.remove('on'); overlay.style.display='none'; document.body.style.overflow=''; overlay.setAttribute('aria-hidden','true'); }
    overlay.classList.add('on'); overlay.style.display='flex'; document.body.style.overflow='hidden'; overlay.setAttribute('aria-hidden','false');

    btnCancel.onclick = close;
    overlay.addEventListener('click', (e)=>{ if (e.target === overlay) close(); }, { once:true });

    btnApply.onclick = function(){
      const checks = list.querySelectorAll('.tpl-petpick:checked');
      if (!checks.length){ alert('Selecciona al menos una mascota.'); return; }

      // Rellenar los inputs "Mascota_#" existentes
      const names = [];
      checks.forEach(ch=>{
        const p = pets[parseInt(ch.value,10)];
        if (p && p.nombre) names.push(norm(p.nombre));
      });

      // Ajusta nº de mascotas si hace falta
      const numSel = document.getElementById('numPets');
      if (numSel){
        const n = Math.min(5, Math.max(1, names.length));
        numSel.value = String(n);
        numSel.dispatchEvent(new Event('change', { bubbles:true }));
      }

      // Volcar nombres en petName_#
      setTimeout(()=>{
        names.forEach((n, idx)=>{
          const inp = document.getElementById('petName_'+(idx+1));
          if (inp){ inp.value = n; inp.dispatchEvent(new Event('input', { bubbles:true })); }
        });
      }, 120);

      close();
    };
  }

  // ===== Build detalles a enviar (propietaria + mascotas) =====
  function buildOwnerDetail(){
    // Preferimos lo que haya escrito en el form (si existe); si no, owner UDB
    const f = {
      nombre: norm(document.getElementById('firstName')?.value)+' '+norm(document.getElementById('lastName')?.value),
      telefono: norm(document.getElementById('phone')?.value),
      email: norm(document.getElementById('email')?.value),
      direccion: norm(document.getElementById('location')?.value),
      cp: norm(document.getElementById('postalCode')?.value),
      ccaa: (document.getElementById('region')?.selectedOptions?.[0]?.text || '').trim(),
      pref: (new FormData(document.getElementById('bookingForm')||undefined).get('Preferencia_contacto') || '').toString(),
      hora: norm(document.getElementById('contactTime')?.value)
    };
    const fallback = getOwner() || {};
    const val = (x, fb) => x ? x : norm(fb||'');
    const row = {
      Nombre: val(f.nombre, fallback.nombre),
      Telefono: val(f.telefono, fallback.telefono),
      Email: val(f.email, fallback.email),
      Direccion: val(f.direccion, fallback.direccion),
      CP: val(f.cp, fallback.cp),
      CCAA: f.ccaa || fallback.ccaa || '',
      Preferencia_contacto: f.pref || fallback.contacto || '',
      Hora_preferida: f.hora || fallback.contactoHorario || ''
    };
    // Texto plano compacto para plantillas
    const text = `Nombre: ${row.Nombre} | Teléfono: ${row.Telefono} | Email: ${row.Email} | Dirección: ${row.Direccion} | CP: ${row.CP} | CCAA: ${row.CCAA} | Preferencia: ${row.Preferencia_contacto || 'cualquiera'}${row.Hora_preferida ? ' | Hora: '+row.Hora_preferida : ''}`;
    return { row, text };
  }

  function buildPetsDetail(){
    const uid = getCurrentUserId();
    const pets = getPets(); // del UDB
    // Obtén nombres que el usuario finalmente va a reservar (inputs petName_#)
    const inputs = Array.from(document.querySelectorAll('input[id^="petName_"]'));
    const wantNames = inputs.map(i=>nkey(i.value)).filter(Boolean);
    // Si está vacío, intenta hidden ya calculado
    if (!wantNames.length){
      const raw = document.getElementById('petsListHidden')?.value || '';
      raw.split(',').forEach(x=>{ const k=nkey(x); if(k) wantNames.push(k); });
    }
    // Emparejar por nombre normalizado
    const selected = pets.filter(p => wantNames.includes(nkey(p?.nombre))).slice(0, Math.max(1, wantNames.length||1));
    // Formateos
    const toRow = (p)=>({
      Nombre: norm(p?.nombre),
      Especie: norm(p?.especie || p?.tipo),
      Raza: norm(p?.raza || p?.tipoExotico),
      Edad: norm(p?.edad),
      Peso: norm(p?.peso),
      Microchip: norm(p?.microchip),
      Esterilizado: norm(p?.esterilizado),
      Vacunas: norm(p?.vacunas),
      Salud: norm(p?.salud),
      Tratamiento: norm(p?.tratamiento),
      Comportamiento: norm(p?.comportamiento),
      SeguroRC: norm(p?.seguroRC),
      SeguroVet: norm(p?.seguroVet),
      SeguroVetComp: norm(p?.seguroVetComp),
      SeguroVetNum: norm(p?.seguroVetNum)
    });
    const rows = selected.map(toRow);
    const text = rows.map(r=>(
      `Mascota: ${r.Nombre} | ${[r.Especie,r.Raza].filter(Boolean).join(' · ')}${r.Microchip? ' | Chip: '+r.Microchip:''}${r.Edad? ' | Edad: '+r.Edad:''}${r.Peso? ' | Peso: '+r.Peso:''}${r.Esterilizado? ' | Esterilizado: '+r.Esterilizado:''}${r.Vacunas? ' | Vacunas: '+r.Vacunas:''}${r.Salud? ' | Salud: '+r.Salud:''}${r.Tratamiento? ' | Tratamiento: '+r.Tratamiento:''}${r.Comportamiento? ' | Comportamiento: '+r.Comportamiento:''}${r.SeguroRC? ' | Seguro RC: '+r.SeguroRC:''}`
    )).join(' || ');
    return { rows, text };
  }

  // ===== Wire: botón abrir selector =====
  function attachPickerButton(){
    const btn = document.getElementById('tpl-open-petpicker');
    if (!btn) return;
    btn.addEventListener('click', function(e){ e.preventDefault(); openPetPicker(); });
  }

  // ===== Antes de enviar: adjuntar detalle a los hidden =====
  function attachSubmitEnrichment(){
    const form = document.getElementById('bookingForm');
    if (!form) return;
    form.addEventListener('submit', function(){
      try{
        const od = buildOwnerDetail();
        const pd = buildPetsDetail();
        const fOwner = document.getElementById('ownerDetail');
        const fPets  = document.getElementById('petsDetail');
        const fPetsJ = document.getElementById('petsDetailJson');
        if (fOwner) fOwner.value = od.text;
        if (fPets)  fPets.value  = pd.text;
        if (fPetsJ) fPetsJ.value = JSON.stringify(pd.rows);
        // Nota: tus listeners existentes (Firestore + EmailJS) ya tomarán estos campos
      }catch(err){ console.warn('[TPL reservas] enrich submit warn:', err); }
    }, { capture:true });
  }

  // ===== Init =====
  function init(){
    attachPickerButton();
    attachSubmitEnrichment();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
 /* TPL: FIN BLOQUE NUEVO */
