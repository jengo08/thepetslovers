/* TPL: INICIO BLOQUE NUEVO [reservas.js · UI + perfil + envío EmailJS + Firestore] */
(function(){
  // ========= Helpers =========
  const $ = (id) => document.getElementById(id);
  const currency = (n) => (Math.round((n || 0) * 100) / 100).toFixed(2);
  const qs = (k) => new URLSearchParams(location.search).get(k);
  const mm = (d)=> String(d.getMonth()+1).padStart(2,'0');
  const dd = (d)=> String(d.getDate()).padStart(2,'0');
  const ymd = (d)=> `${d.getFullYear()}-${mm(d)}-${dd(d)}`;
  const SPECIAL_MMDD = ['12-24','12-25','12-31','01-01'];

  const PRICES = {
    base: { visitas: 22, paseos: 12, guarderia: 15, alojamiento: 30, bodas: 0, postquirurgico: 0, transporte: 0, exoticos: 0 },
    puppyBase: { guarderia: 20, alojamiento: 35 },
    visita60: 22, visita90: 30,
    visita60_larga: 18, visita90_larga: 27,
    visitaMed: 12, visitaMed_larga: 10,
    depositPct: 0.20
  };
  const BUNDLE_GUARDERIA = {
    adult:  { 10: 135, 20: 250, 30: 315 },
    puppy:  { 10: 185, 20: 350, 30: 465 }
  };
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

  function eachDate(from,to){
    const res=[]; if(!from||!to) return res;
    const d1=new Date(from), d2=new Date(to);
    if(isNaN(d1)||isNaN(d2)||d2<d1) return res;
    const cur=new Date(d1); cur.setHours(0,0,0,0); d2.setHours(0,0,0,0);
    while(cur<=d2){ res.push(new Date(cur)); cur.setDate(cur.getDate()+1); }
    return res;
  }
  function debounce(fn, wait=300){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), wait); }; }

  // ========= Elementos =========
  const els = {};
  function bindEls(){
    [
      'bookingForm','authWall','service','region','startDate','endDate','start','end',
      'location','tplAddrSuggest','postalCode',
      'species','isPuppy','numPets','numPetsExact',
      'needTravel','travelBubble',
      'visitDuration','visitDaily','fieldVisitDuration','fieldVisitDaily',
      'firstName','lastName','phone','email','contactTime',
      'petsContainer','petsListHidden','tplPetNamesList',
      'sumBase','sumVisit1','sumVisit2','rowVisit1','rowVisit2','sumPets','sumFestivo','sumSenalado','sumTravel','sumBono','rowBono','sumSubtotal','sumDeposit',
      'summaryField'
    ].forEach(id=> els[id] = $(id));
  }

  // ========= Servicio preseleccionado =========
  function inferServiceFromReferrer(){
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
  }
  function presetService(){
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
    let val = map[norm] || inferServiceFromReferrer();
    if(val && els.service){ els.service.value = val; }
  }

  // ========= UI dependiente de servicio =========
  function toggleFields(){
    const svc = els.service?.value;
    const isVisitas = (svc === 'visitas');
    els.bookingForm?.classList.toggle('tpl-visitas-on', isVisitas);
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
    if(!els.tplPetNamesList) return;
    els.tplPetNamesList.innerHTML = (PROFILE_PET_NAMES||[]).map(n => `<option value="${(n||'').replace(/"/g,'&quot;')}"></option>`).join('');
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
    wrap.querySelectorAll('input[id^="petName_"]').forEach(inp=> inp.addEventListener('input', updatePetsListHidden));
  }
  function updatePetsListHidden(){
    const names = [...els.petsContainer.querySelectorAll('input[id^="petName_"]')].map(i=>i.value.trim()).filter(Boolean);
    if (els.petsListHidden) els.petsListHidden.value = names.join(', ');
  }
  function travelSync(){
    if(els.travelBubble) els.travelBubble.style.display = els.needTravel?.value === 'si' ? 'block' : 'none';
    if(els.sumTravel) els.sumTravel.textContent = (els.needTravel?.value === 'si') ? 'pendiente' : '—';
  }

  // ========= Festivos =========
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
      const isSpecial = SPECIAL_MMDD.includes(`${mm(d)}-${dd(d)}`);
      if(isNat || isReg) festivo += 10;
      if(isSpecial) senalado += 30;
    }
    return { festivo, senalado, nDias: days.length };
  }

  // ========= Cálculos =========
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
    if(service === 'visitas') return 0;
    if(service === 'alojamiento')   return isPuppy ? (PRICES.puppyBase.alojamiento ?? PRICES.base.alojamiento) : PRICES.base.alojamiento;
    if(service === 'guarderia')     return isPuppy ? (PRICES.puppyBase.guarderia   ?? PRICES.base.guarderia)   : PRICES.base.guarderia;
    return PRICES.base[service] || 0;
  }
  function calcVisitas(visitDurationMin, dailyVisits, nDias){
    const longStay = (nDias >= 11);
    const price1 = (visitDurationMin === 90) ? (longStay ? PRICES.visita90_larga : PRICES.visita90) : (longStay ? PRICES.visita60_larga : PRICES.visita60);
    const price2 = dailyVisits === 2 ? (longStay ? PRICES.visitaMed_larga : PRICES.visitaMed) : 0;
    return { price1, price2 };
  }
  function calcBonoGuarderia(nDias, isPuppy){
    const perDay = isPuppy ? (PRICES.puppyBase.guarderia ?? PRICES.base.guarderia) : PRICES.base.guarderia;
    const table  = isPuppy ? BUNDLE_GUARDERIA.puppy : BUNDLE_GUARDERIA.adult;
    const bundlePrice = table[nDias];
    if (!bundlePrice) return 0;
    const normalTotal = perDay * nDias;
    return Math.max(0, normalTotal - bundlePrice);
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
    const deposit = subtotal * (PRICES.depositPct || 0.2);

    els.sumBase.textContent     = isVisitas ? '—' : (subtotal>0 ? currency(base) : '—');
    els.rowVisit1.style.display = isVisitas ? '' : 'none';
    els.rowVisit2.style.display = (isVisitas && visit2 > 0) ? '' : 'none';
    els.sumVisit1.textContent   = currency(visit1);
    els.sumVisit2.textContent   = currency(visit2);
    els.sumPets.textContent     = currency(pets);
    els.sumFestivo.textContent  = currency(festivo);
    els.sumSenalado.textContent = currency(senalado);
    els.rowBono.style.display   = (svc === 'guarderia' && bono > 0) ? '' : 'none';
    els.sumBono.textContent     = currency(bono);
    els.sumSubtotal.textContent = (subtotal>0) ? currency(subtotal) : '—';
    els.sumDeposit.textContent  = (subtotal>0) ? currency(deposit) : '—';
  }
  async function recalcAll(){
    toggleFields(); syncPetsExact(); renderPetNameFields(getNumMascotas()); await recalc();
  }

  // ========= Autocomplete dirección (OSM) =========
  async function searchAddresses(q){
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6&countrycodes=es&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'Accept':'application/json' }});
    if(!r.ok) return [];
    return r.json();
  }
  function renderAddrSuggestions(list){
    if(!els.tplAddrSuggest) return;
    if(!list.length){ els.tplAddrSuggest.style.display='none'; els.tplAddrSuggest.innerHTML=''; return; }
    els.tplAddrSuggest.innerHTML = list.map((it)=>(`
      <div class="tpl-addr-item" role="option" tabindex="0" data-raw='${JSON.stringify(it).replace(/'/g,"&#39;")}'>
        ${it.display_name}
      </div>`)).join('');
    els.tplAddrSuggest.style.display = 'block';
    els.tplAddrSuggest.querySelectorAll('.tpl-addr-item').forEach(node=>{
      const choose = ()=> {
        const item = JSON.parse(node.dataset.raw.replace(/&#39;/g,"'"));
        els.location.value = (item?.display_name || '').replace(/, España$/,'');
        const pc = item?.address?.postcode || '';
        if(els.postalCode){ els.postalCode.value = pc; }
        els.tplAddrSuggest.style.display='none';
      };
      node.addEventListener('click', choose);
      node.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') choose(); });
    });
  }
  const addressInputHandler = debounce(async ()=>{
    const q = (els.location?.value || '').trim();
    if(q.length < 4){ renderAddrSuggestions([]); return; }
    try{ renderAddrSuggestions(await searchAddresses(q) || []); }
    catch(_){ renderAddrSuggestions([]); }
  }, 380);

  // ========= Perfil (auto-relleno) =========
  async function autoContactFromProfile(user){
    try{
      if(!user || typeof firebase === 'undefined') return;
      const db = firebase.firestore();
      const doc = await db.collection('users').doc(user.uid).get();
      const d = doc.exists ? doc.data() : {};
      els.firstName.value = d?.nombre || user.displayName?.split(' ')?.[0] || '';
      els.lastName.value  = d?.apellidos || user.displayName?.split(' ')?.slice(1).join(' ') || '';
      els.email.value     = d?.email || user.email || '';
      els.phone.value     = d?.telefono || user.phoneNumber || '';
      if(d?.direccion) els.location.value = d.direccion;
      if(d?.cp)        els.postalCode.value = d.cp;
      if(d?.ccaa && els.region){
        const val = (''+d.ccaa).toLowerCase();
        if([...els.region.options].some(o=>o.value===val)) els.region.value = val;
      }
      // Nombres de mascotas
      const petsSnap = await db.collection('users').doc(user.uid).collection('mascotas').get();
      PROFILE_PET_NAMES = petsSnap.docs.map(x=> (x.data()?.nombre || '').trim()).filter(Boolean);
      fillPetDatalist();
    }catch(_){}
  }
  async function autoPuppyFromProfile(){
    try{
      if(typeof firebase === 'undefined') return;
      const auth = firebase.auth();
      const db = firebase.firestore();
      const u = auth.currentUser;
      if(!u) return;
      const snap = await db.collection('users').doc(u.uid).collection('mascotas').limit(1).get();
      if(!snap.empty){
        const pet = snap.docs[0].data();
        if(pet?.birthdate){
          const b = new Date(pet.birthdate);
          const today = new Date();
          const months = (today.getFullYear()-b.getFullYear())*12 + (today.getMonth()-b.getMonth());
          const isP = months < 6;
          const svc = els.service?.value || '';
          const species = els.species?.value || 'perro';
          const puppyAllowed = (svc === 'alojamiento' || svc === 'guarderia') && species !== 'otros' && svc !== 'visitas';
          if(els.isPuppy && puppyAllowed){ els.isPuppy.value = isP ? 'si' : 'no'; }
          await recalc();
        }
      }
    }catch(_){}
  }

  // ========= Login inline si no hay sesión =========
  function renderInlineLogin(){
    const host = document.getElementById('tpl-inline-login');
    if(!host || typeof firebase === 'undefined') return;
    host.innerHTML = `
      <div class="tpl-login-card" role="region" aria-label="Acceso rápido" style="border:1px solid #eee;border-radius:12px;padding:16px;background:#fff;max-width:520px;margin:14px auto 0;box-shadow:0 2px 12px rgba(0,0,0,.05)">
        <h3 class="tpl-login-title" style="margin:0 0 8px;color:#58425a;font-weight:700;font-size:1.05rem;text-align:center">Accede aquí mismo</h3>
        <div class="tpl-socials" style="display:grid;gap:10px;margin-bottom:8px">
          <button type="button" class="tpl-btn-social" id="tpl-google-btn" style="display:flex;align-items:center;justify-content:center;gap:8px;border:1px solid #ddd;border-radius:999px;padding:10px 14px;background:#fff;cursor:pointer;font-weight:600;color:var(--color-principal)">
            <i class="fa-brands fa-google"></i> Continuar con Google
          </button>
        </div>
        <div class="tpl-sep" style="position:relative;text-align:center;margin:6px 0 8px;color:#999;font-size:.9rem">
          <span style="background:#fff;padding:0 8px;position:relative;z-index:1">o</span>
          <span aria-hidden="true" style="position:absolute;left:0;right:0;top:50%;height:1px;background:#eee"></span>
        </div>
        <form class="tpl-login-form" id="tpl-inline-form" novalidate style="display:grid;gap:8px">
          <label style="font-size:.9rem;color:#58425a">Email</label>
          <input type="email" name="email" required autocomplete="email" style="border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:1rem"/>
          <label style="font-size:.9rem;color:#58425a">Contraseña</label>
          <input type="password" name="password" required autocomplete="current-password" style="border:1px solid #ddd;border-radius:10px;padding:10px 12px;font-size:1rem"/>
          <button type="submit" class="tpl-btn" style="background:#339496;color:#fff;border:none;border-radius:999px;padding:10px 14px;cursor:pointer;font-weight:600">Iniciar sesión</button>
          <a class="tpl-btn-outline" href="registro.html?next=reserva.html" style="background:#fff;color:#339496;border:1px solid #339496;border-radius:999px;padding:10px 14px;cursor:pointer;font-weight:600;display:inline-block;text-align:center">Regístrate</a>
          <button type="button" class="tpl-link" id="tpl-reset" style="background:none;border:none;color:#339496;text-decoration:underline;cursor:pointer;padding:6px 0;justify-self:center">¿Has olvidado la contraseña?</button>
          <p class="tpl-login-msg" aria-live="polite" style="min-height:1.2em;text-align:center;color:#58425a;margin-top:4px"></p>
        </form>
      </div>
    `;
    const form = document.getElementById('tpl-inline-form');
    const msg  = host.querySelector('.tpl-login-msg');
    const btnG = document.getElementById('tpl-google-btn');
    const auth = firebase.auth();
    const isIOS = /iP(ad|hone|od)/i.test(navigator.userAgent);
    const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

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

    host.querySelector('#tpl-reset').addEventListener('click', async (e)=>{
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

  // ========= Validaciones y resumen antes de enviar =========
  function validateContactPreference(e){
    const pref = (new FormData(els.bookingForm).get('Preferencia_contacto')) || 'cualquiera';
    const tel  = els.phone?.value?.trim();
    const mail = els.email?.value?.trim();
    if(pref === 'telefono' || pref === 'whatsapp'){
      if(!tel){ e.preventDefault(); alert('Por favor, indícanos tu teléfono para poder contactarte.'); return false; }
    }else if(pref === 'email'){
      if(!mail){ e.preventDefault(); alert('Por favor, indícanos tu correo para poder contactarte.'); return false; }
    }
    return true;
  }
  function buildSummary(){
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
    lines.push(`Dirección: ${els.location?.value || '-'}`);
    lines.push(`CP: ${els.postalCode?.value || '-'}`);
    lines.push(`CCAA: ${regionText}`);
    lines.push(`Preferencia contacto: ${new FormData(els.bookingForm).get('Preferencia_contacto') || 'cualquiera'}`);
    if(els.contactTime?.value) lines.push(`Hora preferida contacto: ${els.contactTime.value}`);
    lines.push(`Festivos (auto): ${els.sumFestivo?.textContent || '0.00'} €`);
    lines.push(`Días especiales (auto): ${els.sumSenalado?.textContent || '0.00'} €`);
    if(els.service?.value === 'guarderia' && els.rowBono?.style.display !== 'none'){
      lines.push(`Bono guardería (descuento): −${els.sumBono?.textContent || '0.00'} €`);
    }
    lines.push(`Subtotal (sin desplazamiento): ${els.sumSubtotal?.textContent || '0.00'} €`);
    lines.push(`Depósito a retener: ${els.sumDeposit?.textContent || '0.00'} €`);
    els.summaryField.value = lines.join(' | ');
  }

  // ========= Overlay de éxito =========
  function showSuccessOverlay(){
    var msg = els.bookingForm?.dataset?.tplSuccess || 'Tu solicitud se ha enviado correctamente.';
    var go  = els.bookingForm?.dataset?.tplRedirect || 'perfil.html';
    var wrap = document.getElementById('tpl-overlay');
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

  // ========= EmailJS =========
  async function emailjsSend(fd, extras){
    if(!window.emailjs) return false;
    try{
      const cfg = window.TPL_EMAILJS || {};
      const service  = cfg.serviceId || cfg.service;
      const template = cfg.templateId || cfg.template;
      const pubKey   = cfg.publicKey || cfg.userId;
      if(!service || !template) return false;
      const payload = Object.fromEntries(fd.entries());
      Object.assign(payload, extras || {});
      if (pubKey) { await emailjs.send(service, template, payload, pubKey); }
      else { await emailjs.send(service, template, payload); }
      return true;
    }catch(err){
      console.warn('EmailJS error', err);
      return false;
    }
  }

  // ========= Firestore =========
  async function saveReservationToFirestore(fd){
    if (typeof firebase === 'undefined' || !firebase.firestore) return { ok:false };
    try{
      const db   = firebase.firestore();
      const auth = firebase.auth ? firebase.auth() : null;
      const u    = auth && auth.currentUser ? auth.currentUser : null;

      const payload = {};
      fd.forEach((v,k)=> payload[k]=v);

      payload._page = location.href;
      payload._estado = 'enviada';
      if (firebase.firestore.FieldValue) payload._createdAt = firebase.firestore.FieldValue.serverTimestamp();
      if (u) { payload._uid = u.uid; payload._email = u.email || null; }

      const ref = await db.collection('reservas').add(payload);
      return { ok:true, id: ref.id };
    }catch(err){
      console.warn('Firestore error', err);
      return { ok:false, err:err };
    }
  }

  // ========= Init =========
  function attachEvents(){
    ['change','input'].forEach(ev=>{
      ['service','species','isPuppy','numPets','numPetsExact','region','startDate','endDate','visitDuration','visitDaily','needTravel']
        .forEach(id=>{ const el = $(id); if(el) el.addEventListener(ev, recalcAll); });
    });

    if(els.numPets) els.numPets.addEventListener('change', ()=>{ syncPetsExact(); renderPetNameFields(getNumMascotas()); updatePetsListHidden(); });
    if(els.numPetsExact) els.numPetsExact.addEventListener('input', ()=>{ renderPetNameFields(getNumMascotas()); updatePetsListHidden(); });
    if(els.needTravel) els.needTravel.addEventListener('change', travelSync);
    if(els.location){
      els.location.addEventListener('input', addressInputHandler);
      els.location.addEventListener('focus', addressInputHandler);
      document.addEventListener('click', (e)=>{ if(els.tplAddrSuggest && !els.tplAddrSuggest.contains(e.target) && e.target!==els.location){ els.tplAddrSuggest.style.display='none'; }});
    }

    // Submit
    els.bookingForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!validateContactPreference(e)) return;

      // Completar resumen para correo
      buildSummary();

      // Asegurar algunos campos agregados útiles
      const fd = new FormData(els.bookingForm);
      const extras = {
        _page: location.href,
        _tipo: 'reserva',
        _estado: 'enviada',
        servicio: els.service?.selectedOptions?.[0]?.text || els.service?.value || '',
        subtotal: (els.sumSubtotal?.textContent || '0').replace('—','0').trim(),
        deposito: (els.sumDeposit?.textContent || '0').replace('—','0').trim()
      };

      // Guardar y enviar
      const [fsRes] = await Promise.all([ saveReservationToFirestore(fd) ]);
      if (fsRes?.id) extras.reserva_id = fsRes.id;

      try{ await emailjsSend(fd, extras); }catch(_){}

      showSuccessOverlay();
    });
  }

  function onAuthStateChanged(){
    if (typeof firebase === 'undefined') return;
    const auth = firebase.auth();
    auth.onAuthStateChanged(async (u)=>{
      const logged = !!u;
      els.bookingForm?.classList.toggle('disabled', !logged);
      if (els.authWall) els.authWall.style.display = logged ? 'none' : 'block';
      if (logged){
        await autoContactFromProfile(u);
        await autoPuppyFromProfile();
      }else{
        renderInlineLogin();
      }
    });
  }

  // ========= Start =========
  function start(){
    bindEls();
    presetService();
    renderPetNameFields(1);
    recalcAll();
    travelSync();
    attachEvents();
    onAuthStateChanged();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
/* TPL: FIN BLOQUE NUEVO */
