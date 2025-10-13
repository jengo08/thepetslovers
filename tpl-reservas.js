/****************************************************
 * TPL · RESERVAS (COMPLETO · actualizado)
 * - Mantiene IDs y flujo
 * - Tarjetas de mascotas compactas (lista horizontal)
 * - Preselección servicio (no si viene de perfil)
 * - Cálculo público + auxiliar + desglose detallado
 * - “A pagar ahora” = margen = Subtotal – Aux
 * - EmailJS intacto (usa TPL_EMAILJS si está habilitado)
 ****************************************************/

/************** Helpers **************/
const $  = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmtMoney = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";
const parseDate = v => { const d=new Date(v); return isNaN(d)?null:d; };
const nowISO    = ()=> new Date().toISOString();

function daysInclusive(a,b){
  const A=parseDate(a), B=parseDate(b||a);
  if(!A||!B) return 0;
  const diff = Math.round((B-A)/86400000);
  return diff>=0 ? diff+1 : 0;
}
function fmtMD(dateStr){
  const d=parseDate(dateStr); if(!d) return "";
  const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${m}-${dd}`;
}
function clampInt(n, min=0){ n=Number(n||0); return isNaN(n)?min:Math.max(min,Math.floor(n)); }
function cap(s){ s=String(s||''); return s? s[0].toUpperCase()+s.slice(1) : s; }
function yearsFrom(birth){
  if(!birth) return "";
  const d=new Date(birth); if(isNaN(d)) return "";
  const t=new Date();
  let y=t.getFullYear()-d.getFullYear();
  if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth()&&t.getDate()<d.getDate())) y--;
  return y<0?"":String(y);
}
function isPuppy(p){
  if((p.especie||"").toLowerCase()!=="perro") return false;
  const d = p.nacimiento? new Date(p.nacimiento) : null;
  if(!d || isNaN(d)) return false;
  const months=(Date.now()-d.getTime())/2629800000;
  return months<=6;
}

/************** Etiquetas y precios públicos **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos_aves:"Visita exóticos (aves)",
    exoticos_reptiles:"Visita exóticos (reptiles)",
    exoticos_mamiferos:"Visita exóticos (mamíferos)",
    transporte:"Transporte"
  })[s]||s;
}

const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

// PÚBLICO (cliente)
const PUB = {
  paseos: { base:12, extra:8 }, // por paseo
  transporte: { base:20 },
  guarderia: {
    adult:  { day:15, pack10:135, pack20:250, pack30:315 },
    puppy:  { day:20, pack10:185, pack20:350, pack30:465 }
  },
  alojamiento: {
    std:   { d1_10:30, d11p:28 },
    puppy: { d1_10:35, d11p:32 },
    extra: { d1_10:25, d11p:22 }
  },
  visitaGato: {
    base60: { d1_10:22, d11p:18 },
    base90: { d1_10:30, d11p:27 },
    med15:  { d1_10:12, d11p:10 },
    extraCats: { one:12, twoEach:8, threePlusEach:6 }
  },
  exoticos: { aves:20, reptiles:20, mamiferos:25 }
};

// AUXILIAR (coste interno)
const AUX = {
  paseos: { base:10, extra:5, packs: {10:8,15:7.5,20:7,25:6.5,30:6} },
  guarderia: {
    adultDay:12, puppyDay:17,
    packAdultPerDay: {10:11,20:10,30:9},
    packPuppyPerDay: {10:16,20:14,30:12}
  },
  alojamiento: {
    std:   { d1_10:25, d11p:22 },
    puppy: { d1_10:30, d11p:27 },
    extra: { d1_10:20, d11p:17 }
  },
  visitaGato: {
    base60: { d1_10:17, d11p:12 },
    base90: { d1_10:25, d11p:21 },
    med15:  { d1_10:10, d11p:10 }, // margen 0 frente público
    extraCats: { one:10, twoEach:6, threePlusEach:4 }
  },
  exoticos: { aves:15, reptiles:15, mamiferos:20 },
  transporte: 15,
  festivo: { normal:8, señalados:15 }
};

/************** Preselección de servicio **************/
function canonicalizeService(raw){
  if(!raw) return "";
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = {
    'paseo':'paseo','paseos':'paseo',
    'guarderia':'guarderia_dia','guarderia-de-dia':'guarderia_dia','guarderia_dia':'guarderia_dia',
    'alojamiento':'alojamiento_nocturno','estancias':'alojamiento_nocturno','nocturnas':'alojamiento_nocturno','estancias-nocturnas':'alojamiento_nocturno',
    'visitas':'visita_gato','visita-gato':'visita_gato','visita':'visita_gato',
    'exoticos':'exoticos_aves','exoticos-aves':'exoticos_aves','aves':'exoticos_aves',
    'exoticos-reptiles':'exoticos_reptiles','reptiles':'exoticos_reptiles',
    'exoticos-mamiferos':'exoticos_mamiferos','mamiferos':'exoticos_mamiferos',
    'transporte':'transporte'
  };
  const allowed = new Set(['paseo','guarderia_dia','alojamiento_nocturno','visita_gato','exoticos_aves','exoticos_reptiles','exoticos_mamiferos','transporte']);
  if(allowed.has(s)) return s;
  return map[s] || "";
}
function inferServiceFromReferrer(){
  try{
    const r = document.referrer ? new URL(document.referrer) : null;
    if(!r) return "";
    const p = (r.pathname || "").toLowerCase();
    if(p.includes("perfil")) return ""; // ← no preseleccionar si viene del perfil
    if(/paseo|paseos/.test(p)) return 'paseo';
    if(/guarderia/.test(p)) return 'guarderia_dia';
    if(/estancia|estancias|alojamiento|noche|nocturn/.test(p)) return 'alojamiento_nocturno';
    if(/visita/.test(p) && /gato/.test(p)) return 'visita_gato';
    if(/exotico|exoticos/.test(p) && /ave|aves/.test(p)) return 'exoticos_aves';
    if(/exotico|exoticos/.test(p) && /reptil|reptiles/.test(p)) return 'exoticos_reptiles';
    if(/exotico|exoticos/.test(p) && /mamifer/.test(p)) return 'exoticos_mamiferos';
    if(/transporte/.test(p)) return 'transporte';
  }catch(_){}
  return "";
}
function preselectService(){
  const el = $("#serviceType"); if(!el) return;
  const qs = new URLSearchParams(location.search);
  let raw = qs.get('service') || qs.get('svc');
  if(!raw) raw = inferServiceFromReferrer();
  if(!raw){ try{ raw = localStorage.getItem('tpl.lastService') || ""; }catch(_){ raw=""; } }
  const canon = canonicalizeService(raw);
  if(canon){
    el.value = canon;
    try{ localStorage.setItem('tpl.lastService', canon); }catch(_){}
  }
}

/************** Auth **************/
function onAuth(cb){
  try{ return firebase.auth().onAuthStateChanged(cb); }
  catch(_){ cb(null); return ()=>{}; }
}

/************** Firestore: owner + pets **************/
async function readOwnerAndPets(uid){
  const db=firebase.firestore();

  async function readDoc(coll){
    try{
      const snap = await db.collection(coll).doc(uid).get();
      return snap.exists ? {ref:snap.ref, data:snap.data()||{}, coll} : null;
    }catch(e){
      console.warn(`[perfil] error leyendo ${coll}`, e);
      return null;
    }
  }

  const hit = await readDoc("users")
          || await readDoc("propietarios")
          || await readDoc("owners")
          || await readDoc("usuarios")
          || await readDoc("perfiles");

  const d = hit?.data || {};
  const nombre   = d.nombre || d.name || d.Nombre || "";
  const apellido = d.apellido || d.apellidos || d.surname || d.Apellidos || "";
  const fullName = d.fullName || [nombre,apellido].filter(Boolean).join(" ").trim() || (firebase.auth().currentUser?.displayName||"");
  const phone    = d.phone || d.telefono || d.tlf || d.Telefono || "";
  const region   = d.region || d.comunidad || d.comunidadAutonoma || d.ccaa || d.CCAA || "";
  const address  = d.address || d.direccion || d.Direccion || "";
  const postal   = d.postalCode || d.cp || d.codigo_postal || d.codigoPostal || d.CP || "";
  const email    = d.email || firebase.auth().currentUser?.email || "";

  let pets = Array.isArray(d.pets) ? d.pets : (Array.isArray(d.mascotas)? d.mascotas : []);

  if(!pets.length && hit?.ref){
    try{
      const sub = await hit.ref.collection("mascotas").get();
      pets = sub.docs.map((doc,i)=>{
        const x=doc.data()||{};
        return {
          id: doc.id || String(i+1),
          nombre: x.nombre || x.name || "Mascota",
          especie: (x.especie || x.tipo || "").toLowerCase(),
          nacimiento: x.birthdate || x.nacimiento || "",
          raza: x.raza || x.tipoExotico || "",
          sexo: x.sexo || x.genero || "",
          castrado: (x.castrado ?? x.esterilizado ?? "").toString().toLowerCase(),
          foto: x.foto || x.img || ""
        };
      });
    }catch(e){
      console.warn("[perfil] subcolección 'mascotas' inaccesible por reglas:", e);
    }
  }

  pets = pets.map((p,i)=>({
    id: p.id || p.uid || String(i+1),
    nombre: p.nombre || p.name || "Mascota",
    especie: (p.especie || p.tipo || "").toLowerCase(),
    nacimiento: p.nacimiento || p.birthdate || "",
    raza: p.raza || p.tipoExotico || "",
    sexo: p.sexo || p.genero || "",
    castrado: (p.castrado ?? p.esterilizado ?? "").toString().toLowerCase(),
    foto: p.foto || p.img || ""
  }));

  return { owner:{ fullName, email, phone, region, address, postalCode:postal }, pets };
}

/************** Fallback localStorage **************/
function getUID(){
  try{ return firebase.auth().currentUser?.uid || localStorage.getItem('tpl_auth_uid') || 'default'; }
  catch(_){ return 'default'; }
}
function udbKey(k){ return `tpl.udb.${getUID()}.${k}`; }
function udbGet(k,fb){ try{ const v=localStorage.getItem(udbKey(k)); return v?JSON.parse(v):fb; }catch(_){ return fb; } }

/************** UI titular **************/
function setSelectValue(selectId, value){
  const el = document.getElementById(selectId);
  if(!el || !value) return;
  const target = String(value).trim().toLowerCase();
  const hit = Array.from(el.options).find(o => (o.value||o.text).trim().toLowerCase()===target);
  if(hit){ el.value = hit.value; return; }
  const opt=document.createElement("option"); opt.value=String(value); opt.text=String(value);
  opt.dataset.injected="1"; el.appendChild(opt); el.value=opt.value;
}
function fillOwner(owner){
  $("#ownerFullName").value = owner.fullName || "";
  $("#email").value = owner.email || "";
  $("#phone").value = owner.phone || "";
  setSelectValue("region", owner.region || "");
  $("#address").value = owner.address || "";
  $("#postalCode").value = owner.postalCode || "";
}

/************** Estado + render mascotas **************/
const STATE = { owner:null, pets:[], selectedPetIds:[] };

function renderPetsGrid(pets){
  const grid=$("#petsGrid");
  grid.innerHTML="";

  (pets||[]).forEach(p=>{
    const avatar = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="tpl-pet-thumb" style="display:flex;align-items:center;justify-content:center;border:2px solid #eee;background:#fafafa"><i class="fa-solid fa-paw" style="opacity:.5"></i></div>`;

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.setAttribute("data-birth", p.nacimiento||"");
    el.setAttribute("data-species", (p.especie||"").toLowerCase());
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${avatar}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub"></div>
      </div>
    `;
    // sub: especie · raza · edad · sexo · castrado(si)
    const bits=[];
    if(p.especie) bits.push(cap(p.especie));
    if(p.raza)    bits.push(p.raza);
    const ageY=yearsFrom(p.nacimiento); if(ageY!=="") bits.push("Edad: "+ageY);
    if(p.sexo)    bits.push(p.sexo.trim().toLowerCase()==="hembra"?"♀ Hembra":"♂ Macho");
    if(String(p.castrado)==="si"||String(p.castrado)==="sí") bits.push("Castrado: Sí");
    el.querySelector(".tpl-pet-sub").textContent = bits.join(" · ");

    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    grid.innerHTML = `
      <div class="tpl-pet-item">
        <div class="tpl-pet-meta">
          <div class="tpl-pet-name" style="color:#666">No hay mascotas en tu perfil</div>
          <div class="tpl-pet-sub">Añádelas en tu perfil para seleccionarlas aquí.</div>
        </div>
      </div>`;
  }

  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    try{ if(typeof __updatePuppyDisplay==='function') __updatePuppyDisplay(); }catch(_){}
    doRecalc();
  }, { once:true });
}

/************** Recogida de payload **************/
function collectPayload(){
  const petsSel = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  const selCount = petsSel.length;
  const numSelectEl = $("#numPets");
  const numOverride = numSelectEl ? clampInt(numSelectEl.value,1) : 0;
  const nPetsForCalc = Math.max(selCount, numOverride||selCount||1);

  return {
    serviceType: $("#serviceType").value,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    travelNeeded: $("#travelNeeded")?.value || "no",
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    walkCount: clampInt($("#walkCount")?.value || 0,0), // opcional: si no existe, se ignora
    petsSelected: petsSel,
    nPetsForCalc
  };
}

/************** Cálculo + resumen **************/
function splitTranches(days){ return { d1_10: Math.min(10, days), d11p: Math.max(0, days-10) }; }
function greedyPacks(totalDays, packs){ // packs: {30:x,20:y,10:z,day:w}
  let rem=totalDays, lines=[], total=0;
  const use=(size, price)=>{ const n=Math.floor(rem/size); if(n>0){ lines.push([`${size}`, n, price]); total+=n*price; rem-=n*size; } };
  use(30, packs.pack30);
  use(20, packs.pack20);
  use(10, packs.pack10);
  if(rem>0){ lines.push(["sueltos", rem, packs.day]); total+=rem*packs.day; rem=0; }
  return {lines,total};
}

function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const bigStart = BIG_DAYS.includes(fmtMD(payload.startDate));
  const bigEnd   = BIG_DAYS.includes(fmtMD(payload.endDate));
  const bigDayFee = (bigStart||bigEnd)?30:0;

  let linesPublic=[], totalPublic=0;
  let linesAux=[], totalAux=0;

  // helpers para añadir línea
  function addPub(label, amount, note){ linesPublic.push({label, amount, note}); totalPublic+=amount||0; }
  function addAux(label, amount){ linesAux.push({label, amount}); totalAux+=amount||0; }

  // --- Conteos por especie/edad ---
  const pets = payload.petsSelected;
  const nSel = pets.length;
  const nPets = Math.max(payload.nPetsForCalc, nSel||1);

  const dogs = pets.filter(p=>(p.especie||"").toLowerCase()==="perro");
  const cats = pets.filter(p=>(p.especie||"").toLowerCase()==="gato");
  const nDogs = Math.max(dogs.length, (s==="paseo"||s==="guarderia_dia"||s==="alojamiento_nocturno")?nPets:dogs.length);
  const nCats = Math.max(cats.length, s==="visita_gato"?nPets:cats.length);

  const dogPuppies = dogs.filter(isPuppy).length;
  // si hay menos seleccionadas que nPets, las extra se consideran adultas
  const dogAdults  = Math.max(0, nDogs - dogPuppies);

  // --- Cálculos por servicio ---
  if(s==="paseo"){
    // nº de paseos: si hay input #walkCount >0 usarlo, si no, uno por día del rango
    const walks = payload.walkCount>0 ? payload.walkCount : nDays;
    const extras = Math.max(0, nDogs-1);
    const base = PUB.paseos.base * walks;
    const add  = PUB.paseos.extra * extras * walks;

    addPub(`Paseo (60’) × ${walks}`, base);
    if(extras>0) addPub(`Mascotas adicionales × ${walks} ( ${extras} )`, add);

    // AUX
    addAux(`(aux) Paseo × ${walks}`, AUX.paseos.base*walks);
    if(extras>0) addAux(`(aux) Extras × ${walks} (${extras})`, AUX.paseos.extra*extras*walks);
  }

  if(s==="guarderia_dia"){
    // Adultos
    if(dogAdults>0){
      const packs = {day:PUB.guarderia.adult.day, pack10:PUB.guarderia.adult.pack10, pack20:PUB.guarderia.adult.pack20, pack30:PUB.guarderia.adult.pack30};
      const result = greedyPacks(dogAdults*nDays, packs);
      result.lines.forEach(([kind, qty, price])=>{
        const label = kind==="sueltos" ? `Guardería · Adulto · ${qty} día(s)` : `Guardería · Adulto · Bono ${kind} × ${qty/kind}`;
        addPub(label, qty*(kind==="sueltos"?packs.day:price));
      });
      // AUX: por día según pack por día
      const perDay=AUX.guarderia.packAdultPerDay;
      // reconstruimos coste aux equivalente
      let remaining=dogAdults*nDays;
      const apply=(sz,costPerDay)=>{ const n=Math.floor(remaining/sz); if(n>0){ addAux(`(aux) Guardería · Adulto · pack${sz} × ${n}`, costPerDay*sz*n); remaining-=n*sz; } };
      apply(30,perDay[30]); apply(20,perDay[20]); apply(10,perDay[10]);
      if(remaining>0){ addAux(`(aux) Guardería · Adulto · sueltos ${remaining}`, remaining*AUX.guarderia.adultDay); }
    }
    // Cachorros
    if(dogPuppies>0){
      const packs = {day:PUB.guarderia.puppy.day, pack10:PUB.guarderia.puppy.pack10, pack20:PUB.guarderia.puppy.pack20, pack30:PUB.guarderia.puppy.pack30};
      const result = greedyPacks(dogPuppies*nDays, packs);
      result.lines.forEach(([kind, qty, price])=>{
        const label = kind==="sueltos" ? `Guardería · Cachorro · ${qty} día(s)` : `Guardería · Cachorro · Bono ${kind} × ${qty/kind}`;
        addPub(label, qty*(kind==="sueltos"?packs.day:price));
      });
      // AUX
      const perDay=AUX.guarderia.packPuppyPerDay;
      let remaining=dogPuppies*nDays;
      const apply=(sz,costPerDay)=>{ const n=Math.floor(remaining/sz); if(n>0){ addAux(`(aux) Guardería · Cachorro · pack${sz} × ${n}`, costPerDay*sz*n); remaining-=n*sz; } };
      apply(30,perDay[30]); apply(20,perDay[20]); apply(10,perDay[10]);
      if(remaining>0){ addAux(`(aux) Guardería · Cachorro · sueltos ${remaining}`, remaining*AUX.guarderia.puppyDay); }
    }
  }

  if(s==="alojamiento_nocturno"){
    const {d1_10, d11p} = splitTranches(nDays);

    // ¿1ª mascota cachorro?
    const firstIsPuppy = dogs.some(isPuppy); // si hay alguno cachorro, consideramos la 1ª como cachorro
    const price1 = firstIsPuppy ? PUB.alojamiento.puppy : PUB.alojamiento.std;
    const aux1   = firstIsPuppy ? AUX.alojamiento.puppy : AUX.alojamiento.std;

    if(nDogs>=1){
      if(d1_10>0) addPub(`Alojamiento · 1ª mascota · días 1–10 (${d1_10})`, price1.d1_10*d1_10);
      if(d11p>0)  addPub(`Alojamiento · 1ª mascota · desde día 11 (${d11p})`, price1.d11p*d11p);

      if(d1_10>0) addAux(`(aux) Alojamiento · 1ª · 1–10 (${d1_10})`, aux1.d1_10*d1_10);
      if(d11p>0)  addAux(`(aux) Alojamiento · 1ª · 11+ (${d11p})`, aux1.d11p*d11p);
    }

    const extras = Math.max(0, nDogs-1);
    if(extras>0){
      if(d1_10>0) addPub(`Alojamiento · ${extras} mascota(s) extra · 1–10 (${d1_10})`, PUB.alojamiento.extra.d1_10*extras*d1_10);
      if(d11p>0)  addPub(`Alojamiento · ${extras} mascota(s) extra · 11+ (${d11p})`, PUB.alojamiento.extra.d11p*extras*d11p);

      if(d1_10>0) addAux(`(aux) Extra · ${extras} · 1–10 (${d1_10})`, AUX.alojamiento.extra.d1_10*extras*d1_10);
      if(d11p>0)  addAux(`(aux) Extra · ${extras} · 11+ (${d11p})`, AUX.alojamiento.extra.d11p*extras*d11p);
    }
  }

  if(s==="visita_gato"){
    const {d1_10, d11p} = splitTranches(nDays);
    const use90 = payload.visitDuration==="90";
    const basePub = use90?PUB.visitaGato.base90:PUB.visitaGato.base60;
    const baseAux = use90?AUX.visitaGato.base90:AUX.visitaGato.base60;

    if(d1_10>0){ addPub(`Visita gato · ${use90?90:60}’ · 1–10 (${d1_10})`, basePub.d1_10*d1_10);
                 addAux(`(aux) Visita · ${use90?90:60}’ · 1–10 (${d1_10})`, baseAux.d1_10*d1_10); }
    if(d11p>0){  addPub(`Visita gato · ${use90?90:60}’ · 11+ (${d11p})`, basePub.d11p*d11p);
                 addAux(`(aux) Visita · ${use90?90:60}’ · 11+ (${d11p})`, baseAux.d11p*d11p); }

    if(payload.secondMedVisit==="si"){
      if(d1_10>0){ addPub(`2ª visita medicación 15’ · 1–10 (${d1_10})`, PUB.visitaGato.med15.d1_10*d1_10);
                   addAux(`(aux) Med 15’ · 1–10 (${d1_10})`, AUX.visitaGato.med15.d1_10*d1_10); }
      if(d11p>0){  addPub(`2ª visita medicación 15’ · 11+ (${d11p})`, PUB.visitaGato.med15.d11p*d11p);
                   addAux(`(aux) Med 15’ · 11+ (${d11p})`, AUX.visitaGato.med15.d11p*d11p); }
    }

    // Gatos extra por visita
    const catsCount = Math.max(nCats, 1);
    const extraCats = Math.max(0, catsCount-1);
    if(extraCats>0){
      let perPub=0, perAux=0, label="";
      if(extraCats===1){ perPub=PUB.visitaGato.extraCats.one; perAux=AUX.visitaGato.extraCats.one; label="1 gato extra"; }
      else if(extraCats===2){ perPub=PUB.visitaGato.extraCats.twoEach*2; perAux=AUX.visitaGato.extraCats.twoEach*2; label="2 gatos extra"; }
      else { perPub=PUB.visitaGato.extraCats.threePlusEach*extraCats; perAux=AUX.visitaGato.extraCats.threePlusEach*extraCats; label=`${extraCats} gatos extra`; }
      // Es por visita (día)
      addPub(`Gatos extra (${label}) × ${nDays}`, perPub*nDays);
      addAux(`(aux) Gatos extra (${label}) × ${nDays}`, perAux*nDays);
    }
  }

  if(s==="exoticos_aves"){ addPub("Visita exóticos (aves)", PUB.exoticos.aves); addAux("(aux) Aves", AUX.exoticos.aves); }
  if(s==="exoticos_reptiles"){ addPub("Visita exóticos (reptiles)", PUB.exoticos.reptiles); addAux("(aux) Reptiles", AUX.exoticos.reptiles); }
  if(s==="exoticos_mamiferos"){ addPub("Visita exóticos (mamíferos)", PUB.exoticos.mamiferos); addAux("(aux) Mamíferos peq.", AUX.exoticos.mamiferos); }
  if(s==="transporte"){ addPub("Transporte", PUB.transporte.base); addAux("(aux) Transporte", AUX.transporte); }

  // Días señalados
  if(bigDayFee){ addPub("Día señalado", bigDayFee); addAux("(aux) Día señalado", AUX.festivo.señalados); }

  if(payload.travelNeeded==="si"){ addPub("Desplazamiento", 0, "pendiente"); }

  const payNow   = Math.max(0, totalPublic - totalAux); // margen
  const payLater = Math.max(0, totalPublic - payNow);

  return { linesPublic, totalPublic, payNow, payLater };
}

function renderSummary(calcRes, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${payload.nPetsForCalc||0} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calcRes.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span>${l.label}</span><span>${l.note?'<span class="muted">pendiente</span>':fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calcRes.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calcRes.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calcRes.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";

  if(!payload.serviceType || !payload.startDate || !payload.endDate){
    renderSummary({linesPublic:[],totalPublic:0,payNow:0,payLater:0}, payload);
    return;
  }
  const c = calc(payload);
  renderSummary(c, payload);
}

/************** EmailJS (opcional, respeta tu config) **************/
async function sendEmails(reservation){
  if(!window.TPL_EMAILJS || !TPL_EMAILJS.enabled || !window.emailjs) return;
  const svc = labelService(reservation.service.type);
  const mascotas = (reservation.pets||[]).map(p=>p.nombre).join(", ")||"—";

  const vars = {
    reserva_id: reservation.id,
    service: svc,
    startDate: reservation.dates.startDate,
    endDate: reservation.dates.endDate || reservation.dates.startDate,
    Hora_inicio: reservation.dates.startTime || "",
    Hora_fin: reservation.dates.endTime || "",
    species: mascotas,
    summaryField: JSON.stringify(reservation.pricing.breakdownPublic.map(l=>`${l.label}${l.amount?`: ${l.amount}€`:""}`), null, 2),

    firstName: reservation.owner.fullName,
    email: reservation.owner.email,
    phone: reservation.owner.phone,
    region: reservation.region || $("#region").value || "",
    address: reservation.owner.address,
    postalCode: reservation.owner.postalCode,
    observations: $("#notes").value || "",

    total_cliente: reservation.pricing.totalClient,
    pagar_ahora: reservation.pricing.payNow,
    pendiente: reservation.pricing.payLater,

    total_txt: fmtMoney(reservation.pricing.totalClient).replace(" €","€"),
    pay_now_txt: fmtMoney(reservation.pricing.payNow).replace(" €","€"),
    pay_later_txt: fmtMoney(reservation.pricing.payLater).replace(" €","€"),

    _estado: reservation.status || "paid_review",
    _uid: firebase.auth().currentUser?.uid || "",
    _email: firebase.auth().currentUser?.email || "",

    admin_email: (TPL_EMAILJS && TPL_EMAILJS.adminEmail) ? TPL_EMAILJS.adminEmail : "gestion@thepetslovers.es"
  };

  try{
    await emailjs.send(TPL_EMAILJS.serviceId, TPL_EMAILJS.templateIdCliente, vars);
    await emailjs.send(TPL_EMAILJS.serviceId, TPL_EMAILJS.templateIdGestion, vars);
    console.log("[EmailJS] enviados");
  }catch(e){
    console.warn("[EmailJS] error", e);
  }
}

/************** Login inline (no redirige) **************/
function mountInlineLogin(){
  const host=$("#tpl-inline-login"); if(!host) return;
  host.innerHTML = `
    <div class="tpl-login-card" role="region" aria-label="Acceso rápido">
      <h3 class="tpl-login-title">Accede aquí mismo</h3>
      <form id="tpl-inline-form" class="tpl-login-form" novalidate style="display:grid;gap:8px">
        <label>Email</label>
        <input type="email" name="email" required autocomplete="email" />
        <label>Contraseña</label>
        <input type="password" name="password" required autocomplete="current-password" />
        <button type="submit" class="tpl-btn">Iniciar sesión</button>
        <button type="button" class="tpl-btn-outline" id="tpl-google-btn"><i class="fa-brands fa-google"></i> Google</button>
        <p class="tpl-login-msg" aria-live="polite"></p>
      </form>
    </div>
  `;
  const form=$("#tpl-inline-form");
  const msg = host.querySelector(".tpl-login-msg");
  const gbtn=$("#tpl-google-btn");

  form.addEventListener("submit", async (e)=>{
    e.preventDefault();
    msg.textContent = "Accediendo…";
    try{
      await firebase.auth().signInWithEmailAndPassword(form.email.value.trim(), form.password.value);
      msg.textContent = "¡Listo!";
      location.reload();
    }catch(err){
      msg.textContent = (err && err.message) || "No se pudo iniciar sesión.";
    }
  });

  gbtn.addEventListener("click", async ()=>{
    msg.textContent="Conectando con Google…";
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      await firebase.auth().signInWithPopup(provider);
      location.reload();
    }catch(err){
      msg.textContent = (err && err.message) || "No se pudo iniciar con Google.";
    }
  });
}

/************** INIT **************/
window.addEventListener("load", ()=>{
  // Fechas coherentes
  $("#startDate").addEventListener("change", ()=>{
    if(!$("#endDate").value) $("#endDate").value = $("#startDate").value;
    if($("#endDate").value && parseDate($("#endDate").value) < parseDate($("#startDate").value)){
      $("#endDate").value = $("#startDate").value;
    }
    doRecalc();
  });
  $("#endDate").addEventListener("change", ()=>{
    if($("#startDate").value && parseDate($("#endDate").value) < parseDate($("#startDate").value)){
      $("#endDate").value = $("#startDate").value;
    }
    doRecalc();
  });

  // Preselección de servicio
  preselectService();

  // Binds de recálculo
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","visitDuration","secondMedVisit","numPets","walkCount"]
    .forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input", doRecalc); });

  // Auth gate
  onAuth(async (u)=>{
    const wall=$("#authWall");
    const form=$("#reservaForm");

    if(!u){
      wall.style.display="block";
      form.classList.add("disabled");
      mountInlineLogin();
      return;
    }

    wall.style.display="none";
    form.classList.remove("disabled");

    // Cargar owner + mascotas
    try{
      let {owner, pets} = await readOwnerAndPets(u.uid);

      // Fallback local si falta algo
      if((!owner?.fullName || !owner?.phone) && udbGet("owner",null)){
        const fb=udbGet("owner",{});
        owner = {
          fullName: (fb.nombre||"") + (fb.apellidos?(" "+fb.apellidos):""),
          email: fb.email || owner.email,
          phone: fb.telefono || owner.phone,
          region: fb.ccaa || owner.region,
          address: fb.direccion || owner.address,
          postalCode: fb.cp || owner.postalCode
        };
      }
      fillOwner(owner||{});

      // Mezcla mascotas firestore + locales (evitar duplicados)
      const localPets = udbGet("pets", []) || udbGet("mascotas", []) || [];
      const merged = [
        ...(pets||[]),
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", castrado:(p.castrado??p.esterilizado??"").toString().toLowerCase(), foto:p.foto||"" }))
      ];
      const seen=new Set();
      STATE.pets = merged.filter(p=>{
        const key = `${(p.nombre||"").toLowerCase()}|${p.especie||""}|${p.nacimiento||""}`;
        if(seen.has(key)) return false; seen.add(key); return true;
      });

      renderPetsGrid(STATE.pets);
    }catch(e){
      console.warn("[init] owner/pets", e);
    }

    // Mostrar controles visita gato si aplica
    $("#visitCatControls").style.display =
      ($("#serviceType").value==="visita_gato") ? "" : "none";

    doRecalc();

    // CTA reservar
    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      if(!payload.nPetsForCalc){
        alert("Elige al menos una mascota."); return;
      }

      const c=calc(payload);
      const reservation = {
        id: "resv_"+Date.now(),
        status: "paid_review",
        createdAt: nowISO(),
        region: payload.region,
        service: { type: payload.serviceType },
        dates: {
          startDate: payload.startDate,
          endDate: payload.endDate,
          startTime: payload.startTime || null,
          endTime: payload.endTime || null
        },
        owner: {
          fullName: $("#ownerFullName").value.trim(),
          email: $("#email").value.trim(),
          phone: $("#phone").value.trim(),
          address: $("#address").value.trim(),
          postalCode: $("#postalCode").value.trim(),
          contactPref: $("#contactPref")?.value || "Cualquiera",
          contactTime: $("#contactTime")?.value || ""
        },
        pets: payload.petsSelected,
        pricing: {
          breakdownPublic: c.linesPublic,
          totalClient: Number(c.totalPublic.toFixed(2)),
          payNow: Number(c.payNow.toFixed(2)),
          payLater: Number(c.payLater.toFixed(2)),
          currency:"EUR"
        }
      };

      // Guarda una copia local para mostrar en perfil
      try{
        const key="tpl.reservas";
        const list = JSON.parse(localStorage.getItem(key)||"[]");
        list.unshift(reservation);
        localStorage.setItem(key, JSON.stringify(list));
      }catch(_){}

      // Envío emails (opcional)
      try{ await sendEmails(reservation); }catch(_){}

      // UI gracias
      $("#reservaForm").style.display="none";
      $("#thanks").style.display="block";
    });
  });
});
