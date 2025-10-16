/****************************************************
 * TPL · RESERVAS (COMPLETO · remaquetado)
 * - Mantiene IDs y flujo actual
 * - Autorelleno titular + mascotas (Firestore users/... o propietarios/... + subcolección mascotas)
 * - Picker de mascotas (tarjetas con checkbox) → avatar redondo + edad + sexo + “castrado”
 * - Preselección de servicio desde ?service= / ?svc= o referrer (pero NO desde perfil/mis-reservas)
 * - Cálculo y resumen:
 *    · Guardería: packs 30→20→10 en 1ª; suplementos 2ª=12€/día, 3ª+=8€/día (no aplican packs)
 *    · Alojamiento: 1–10 / ≥11; 2ª+ mascota desglosada; puppy auto por edad
 *    · Paseos: packs 30/25/20/15/10 (1 perro); extra mascota +8€/paseo desglosado
 *    · Visitas gato: 1–10 / ≥11 (60’ 22→18 / 90’ 30→27 / med15 12→10), gatos extra por visita
 *    · Exóticos unificado + selector tipo: aves/reptiles 20→18 sin extra; mamíferos 1ª 25→22 + extra 20→18
 * - Márgenes internos (aux) para “A pagar ahora”
 * - Login inline
 * - Guarda local en perfil
 * - EmailJS opcional (usa tu config TPL_EMAILJS existente)
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
function cap(s){ s=String(s||''); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }
function monthsDiff(d){
  const x=parseDate(d); if(!x) return null;
  const t=new Date();
  return (t.getFullYear()-x.getFullYear())*12 + (t.getMonth()-x.getMonth()) - (t.getDate()<x.getDate()?1:0);
}
function yearsFrom(birth){
  const d=parseDate(birth); if(!d) return "";
  const t=new Date();
  const years = t.getFullYear() - d.getFullYear()
              - ((t.getMonth()<d.getMonth()) || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate()) ? 1 : 0);
  return years>=0 ? String(years) : "";
}

/************** Etiquetas y precios públicos **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos:"Servicio de exóticos",
    exoticos_aves:"Visita exóticos (aves)",
    exoticos_reptiles:"Visita exóticos (reptiles)",
    exoticos_mamiferos:"Visita exóticos (mamíferos)",
    transporte:"Transporte"
  })[s]||s;
}

const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD (señalados). Los festivos CCAA se pueden añadir posteriormente.

/** Tarifas públicas (cliente) */
const PUB = {
  paseo: { base:12, extra:8, packs:[30,25,20,15,10], packPrice:{10:115,15:168,20:220,25:270,30:318} },
  guarderia: {
    adult:{ perDay:15, packs:{10:135,20:250,30:315} },
    puppy:{ perDay:20, packs:{10:185,20:350,30:465} },
    extra2:12, extra3p:8 // suplementos por día (NO aplican packs)
  },
  alojamiento: {
    first:{ std:{d1_10:30, d11:28}, puppy:{d1_10:35, d11:32} },
    extra:{ std:{d1_10:25, d11:22}, puppy:{d1_10:30, d11:28} }
  },
  visitaGato: {
    base60:{d1_10:22, d11:18},
    base90:{d1_10:30, d11:27},
    med15: {d1_10:12, d11:10},
    extrasPerVisit: { oneExtra:12, twoEach:8, threePlusEach:6 }
  },
  exoticos:{
    aves:{ d1_10:20, d11:18, extras:false },
    reptiles:{ d1_10:20, d11:18, extras:false },
    mamiferos:{ first:{d1_10:25, d11:22}, extra:{d1_10:20, d11:18} }
  },
  transporte:{ base:20 },
  suplementos:{ urgencia:10, festivo:10, diaSeñalado:30 }
};

/** Tarifas auxiliar (para margen “A pagar ahora”) */
const AUX = {
  guarderia:{
    adult:{ perDay:12, packsPerDay:{10:11,20:10,30:9} },
    puppy:{ perDay:17, packsPerDay:{10:16,20:14,30:12} },
    extra2:12, extra3p:8
  },
  alojamiento:{
    first:{ std:{d1_10:25, d11:22}, puppy:{d1_10:30, d11:27} },
    extra:{ std:{d1_10:20, d11:17}, puppy:{d1_10:30, d11:27} }
  },
  paseo:{ base:10, extra:5, packsPerWalk:{10:8,15:7.5,20:7,25:6.5,30:6} },
  visitaGato:{
    base60:{d1_10:17, d11:12},
    base90:{d1_10:25, d11:21},
    med15:{d1_10:12, d11:10}, // med15: margen 0
    extrasPerVisit: { oneExtra:10, twoEach:6, threePlusEach:4 }
  },
  exoticos:{
    aves:{ d1_10:15, d11:12 },
    reptiles:{ d1_10:15, d11:12 },
    mamiferos:{ first:{d1_10:20, d11:18}, extra:{d1_10:16, d11:14} }
  },
  transporte:{ base:15 },
  suplementos:{ festivo:8, diaSeñalado:15, urgencia:0 }
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
    'exoticos':'exoticos','exoticos-aves':'exoticos','aves':'exoticos','exoticos-reptiles':'exoticos','reptiles':'exoticos','exoticos-mamiferos':'exoticos','mamiferos':'exoticos',
    'transporte':'transporte'
  };
  const allowed = new Set(['paseo','guarderia_dia','alojamiento_nocturno','visita_gato','exoticos','transporte']);
  if(allowed.has(s)) return s;
  return map[s] || "";
}
function inferServiceFromReferrer(){
  try{
    const r = document.referrer ? new URL(document.referrer) : null;
    if(!r) return "";
    const p = (r.pathname || "").toLowerCase();
    if(/perfil|reservas|mis-reservas/.test(p)) return ""; // NO preseleccionar desde perfil
    if(/paseo|paseos/.test(p)) return 'paseo';
    if(/guarderia/.test(p)) return 'guarderia_dia';
    if(/estancia|estancias|alojamiento|noche|nocturn/.test(p)) return 'alojamiento_nocturno';
    if(/visita/.test(p) && /gato/.test(p)) return 'visita_gato';
    if(/exotico|exoticos|ave|reptil|mamifer/.test(p)) return 'exoticos';
    if(/transporte/.test(p)) return 'transporte';
  }catch(_){}
  return "";
}
function preselectService(){
  const el = $("#serviceType"); if(!el) return;
  const qs = new URLSearchParams(location.search);
  let raw = qs.get('service') || qs.get('svc');

  // si vienes de perfil/mis-reservas: NO preseleccionar
  try{
    const ref = document.referrer ? new URL(document.referrer) : null;
    if(ref && /perfil|reservas|mis-reservas/.test((ref.pathname||'').toLowerCase())) raw = '';
  }catch(_){}

  if(!raw) raw = inferServiceFromReferrer();
  if(!raw){ try{ raw = localStorage.getItem('tpl.lastService') || ""; }catch(_){ raw=""; } }
  const canon = canonicalizeService(raw);
  if(canon){
    el.value = canon;
    try{ localStorage.setItem('tpl.lastService', canon); }catch(_){}
  }
  // Mostrar controles dependientes
  toggleVisitControls();
  toggleExoticControls();
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
          castrado: (typeof x.castrado==="boolean")?x.castrado:(/si|true/i.test(String(x.castrado||""))),
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
    castrado: (typeof p.castrado==="boolean")?p.castrado:(/si|true/i.test(String(p.castrado||""))),
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
    const iconHtml = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="tpl-pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    // símbolo sexo
    const sx = String(p.sexo||"").toLowerCase();
    const sexSym = sx.startsWith("hemb") ? "♀" : (sx.startsWith("mach") ? "♂" : "");

    const edadY = yearsFrom(p.nacimiento||"");
    const subBits = [];
    if(p.raza) subBits.push(p.raza);
    if(p.especie) subBits.push(cap(p.especie));
    if(edadY) subBits.push(`Edad: ${edadY}`);
    if(sexSym) subBits.push(sexSym);
    if(p.castrado) subBits.push("Castrado");

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.setAttribute("data-birth", p.nacimiento||"");
    el.setAttribute("data-species", (p.especie||"").toLowerCase());
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${iconHtml}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub">${subBits.join(" · ")}</div>
      </div>
    `;
    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    grid.innerHTML = `
      <div class="tpl-pet-item">
        <div><strong style="color:#666">No hay mascotas en tu perfil</strong>
        <div class="muted">Añádelas en tu perfil para seleccionarlas aquí.</div></div>
      </div>`;
  }

  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    __updatePuppyDisplay();
    doRecalc();
  }, { once:true });
}

/************** Recogida de payload **************/
function collectPayload(){
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  const numOverride = parseInt($("#numPets")?.value||"1",10);
  return {
    serviceType: $("#serviceType").value,
    exoticType: $("#exoticType")?.value || "",
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    travelNeeded: "no",
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    pets,
    numPetsOverride: isNaN(numOverride)?1:Math.max(1,numOverride)
  };
}

/************** Cálculo + resumen **************/
function choosePacks(qty, packSet, priceMap){
  // devuelve [{pack:30, n:1}, ... , {unit:remainder}] optimizando coste
  let left = qty;
  const seq = [...packSet].sort((a,b)=>b-a);
  const res=[];
  for(const p of seq){
    const n = Math.floor(left / p);
    if(n>0){ res.push({pack:p, n, packPrice:priceMap[p]}); left -= n*p; }
  }
  if(left>0) res.push({unit:left});
  return res;
}

function isPuppyPet(p){
  if(!p || p.especie!=="perro") return false;
  const m = monthsDiff(p.nacimiento);
  return (m!==null && m<=6);
}

function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  // número de mascotas: override si se usa; si no, según selección
  const nPets = Math.max(1, payload.numPetsOverride || (payload.pets?.length||1));
  let lines=[], auxLines=[], totalPub=0, totalAux=0;

  function pushLine(label, qty, unit, auxUnit){
    const total = qty*unit;
    lines.push({ html:`<div class="desc">${label}<br><small>${qty} × ${fmtMoney(unit)}</small></div>`, amount: total });
    totalPub += total;
    if(typeof auxUnit==="number"){
      auxLines.push({ label, qty, unit:auxUnit, total:qty*auxUnit });
      totalAux += qty*auxUnit;
    }
  }

  // ===== GUARDERÍA DE DÍA =====
  if(s==="guarderia_dia"){
    // puppy si CUALQUIER perro seleccionado es puppy
    const anyPuppy = (payload.pets||[]).some(isPuppyPet);
    const tier = anyPuppy ? "puppy" : "adult";

    // 1ª mascota con packs (auto 30→20→10 y resto sueltos)
    const packs = PUB.guarderia[tier].packs;
    const chosen = choosePacks(nDays, [30,20,10], packs);
    chosen.forEach(ch=>{
      if(ch.pack){
        // público pack
        pushLine(`Guardería · 1ª mascota · bono ${ch.pack}`, 1, ch.packPrice, ch.packPrice); // aux: packPrice por total días (equivalente €/día ya reflejado)
      }else{
        // días sueltos
        const perDayPub = PUB.guarderia[tier].perDay;
        const perDayAux = AUX.guarderia[tier].perDay;
        pushLine(`Guardería · 1ª mascota · días sueltos`, ch.unit, perDayPub, perDayAux);
      }
    });

    // 2ª mascota = 12€/día; 3ª+ = 8€/día. NO aplican packs (se multiplican por días)
    if(nPets>=2){
      const extras = nPets-1;
      const nSecond = Math.min(1, extras);
      const nThirdPlus = Math.max(0, extras-1);
      if(nSecond>0){
        pushLine(`Guardería · 2ª mascota · suplemento`, nDays, PUB.guarderia.extra2, AUX.guarderia.extra2);
      }
      if(nThirdPlus>0){
        pushLine(`Guardería · ${nThirdPlus} mascota(s) extra · suplemento c/u`, nDays*nThirdPlus, PUB.guarderia.extra3p, AUX.guarderia.extra3p);
      }
    }
  }

  // ===== ALOJAMIENTO NOCTURNO =====
  if(s==="alojamiento_nocturno"){
    const firstPet = (payload.pets||[])[0] || null;
    const firstIsPuppy = isPuppyPet(firstPet);
    const firstBlock = Math.min(10, nDays), restBlock=Math.max(0, nDays-10);

    // 1ª mascota
    if(firstBlock>0){
      const pub = firstIsPuppy ? PUB.alojamiento.first.puppy.d1_10 : PUB.alojamiento.first.std.d1_10;
      const aux = firstIsPuppy ? AUX.alojamiento.first.puppy.d1_10 : AUX.alojamiento.first.std.d1_10;
      pushLine(`Alojamiento · 1ª mascota · 1–10`, firstBlock, pub, aux);
    }
    if(restBlock>0){
      const pub = firstIsPuppy ? PUB.alojamiento.first.puppy.d11 : PUB.alojamiento.first.std.d11;
      const aux = firstIsPuppy ? AUX.alojamiento.first.puppy.d11 : AUX.alojamiento.first.std.d11;
      pushLine(`Alojamiento · 1ª mascota · desde 11`, restBlock, pub, aux);
    }

    // 2ª+ mascotas
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      if(firstBlock>0){
        const pub = firstIsPuppy ? PUB.alojamiento.extra.puppy.d1_10 : PUB.alojamiento.extra.std.d1_10;
        const aux = firstIsPuppy ? AUX.alojamiento.extra.puppy.d1_10 : AUX.alojamiento.extra.std.d1_10;
        pushLine(`Alojamiento · ${extras} mascota(s) extra · 1–10`, extras*firstBlock, pub, aux);
      }
      if(restBlock>0){
        const pub = firstIsPuppy ? PUB.alojamiento.extra.puppy.d11 : PUB.alojamiento.extra.std.d11;
        const aux = firstIsPuppy ? AUX.alojamiento.extra.puppy.d11 : AUX.alojamiento.extra.std.d11;
        pushLine(`Alojamiento · ${extras} mascota(s) extra · desde 11`, extras*restBlock, pub, aux);
      }
    }
  }

  // ===== PASEOS (60’) =====
  if(s==="paseo"){
    const nWalks = nDays; // 1 paseo por día
    // Packs en 1ª mascota
    const chosen = choosePacks(nWalks, PUB.paseo.packs, PUB.paseo.packPrice);
    chosen.forEach(ch=>{
      if(ch.pack){
        // precio pack público total; auxiliar: pack por paseo
        const unitAux = AUX.paseo.packsPerWalk[ch.pack]; // €/paseo
        pushLine(`Paseos (60’) · bono ${ch.pack}`, 1, ch.packPrice, unitAux*ch.pack);
      }else if(ch.unit){
        pushLine(`Paseos (60’) · sueltos`, ch.unit, PUB.paseo.base, AUX.paseo.base);
      }
    });
    // Suplemento 2ª+ mascotas (por paseo)
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      pushLine(`Paseos · ${extras} mascota(s) extra`, nWalks*extras, PUB.paseo.extra, AUX.paseo.extra);
    }
  }

  // ===== VISITA GATO =====
  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const firstBlock = Math.min(10, nDays);
    const restBlock  = Math.max(0, nDays-10);

    // base
    const pBase10 = use90? PUB.visitaGato.base90.d1_10 : PUB.visitaGato.base60.d1_10;
    const pBase11 = use90? PUB.visitaGato.base90.d11   : PUB.visitaGato.base60.d11;
    const aBase10 = use90? AUX.visitaGato.base90.d1_10 : AUX.visitaGato.base60.d1_10;
    const aBase11 = use90? AUX.visitaGato.base90.d11   : AUX.visitaGato.base60.d11;

    if(firstBlock>0) pushLine(`Visita gato · ${use90?90:60}’ · 1–10`, firstBlock, pBase10, aBase10);
    if(restBlock>0)  pushLine(`Visita gato · ${use90?90:60}’ · desde 11`, restBlock, pBase11, aBase11);

    // medicación 15’
    if(payload.secondMedVisit==="si"){
      const pMed10 = PUB.visitaGato.med15.d1_10;
      const pMed11 = PUB.visitaGato.med15.d11;
      const aMed10 = AUX.visitaGato.med15.d1_10;
      const aMed11 = AUX.visitaGato.med15.d11;
      if(firstBlock>0) pushLine(`2ª visita medicación 15’ · 1–10`, firstBlock, pMed10, aMed10);
      if(restBlock>0)  pushLine(`2ª visita medicación 15’ · desde 11`, restBlock, pMed11, aMed11);
    }

    // extras por nº de gatos (importe por visita)
    const catsSel = payload.pets.filter(p=>p.especie==="gato").length || nPets;
    const extraCats = Math.max(0, catsSel-1);
    if(extraCats>0){
      let perCat=0, auxPer=0;
      if(extraCats===1){ perCat = PUB.visitaGato.extrasPerVisit.oneExtra; auxPer=AUX.visitaGato.extrasPerVisit.oneExtra; }
      else if(extraCats===2){ perCat = PUB.visitaGato.extrasPerVisit.twoEach; auxPer=AUX.visitaGato.extrasPerVisit.twoEach; }
      else { perCat = PUB.visitaGato.extrasPerVisit.threePlusEach; auxPer=AUX.visitaGato.extrasPerVisit.threePlusEach; }
      pushLine(`Gatos extra (${extraCats})`, nDays*extraCats, perCat, auxPer);
    }
  }

  // ===== EXÓTICOS (unificado) =====
  if(s==="exoticos"){
    const kind = (payload.exoticType||"aves");
    const firstBlock = Math.min(10, nDays);
    const restBlock  = Math.max(0, nDays-10);

    if(kind==="mamiferos"){
      // 1ª mascota
      if(firstBlock>0) pushLine(`Exóticos · Mamífero · 1ª · 1–10`, firstBlock, PUB.exoticos.mamiferos.first.d1_10, AUX.exoticos.mamiferos.first.d1_10);
      if(restBlock>0)  pushLine(`Exóticos · Mamífero · 1ª · desde 11`, restBlock, PUB.exoticos.mamiferos.first.d11,   AUX.exoticos.mamiferos.first.d11);
      // extras
      const extras = Math.max(0, nPets-1);
      if(extras>0){
        if(firstBlock>0) pushLine(`Exóticos · Mamífero · ${extras} extra · 1–10`, extras*firstBlock, PUB.exoticos.mamiferos.extra.d1_10, AUX.exoticos.mamiferos.extra.d1_10);
        if(restBlock>0)  pushLine(`Exóticos · Mamífero · ${extras} extra · desde 11`, extras*restBlock, PUB.exoticos.mamiferos.extra.d11, AUX.exoticos.mamiferos.extra.d11);
      }
    }else{
      const title = (kind==="aves"?"Ave":"Reptil");
      if(firstBlock>0) pushLine(`Exóticos · ${title} · 1–10`, firstBlock, PUB.exoticos.aves.d1_10, AUX.exoticos.aves.d1_10);
      if(restBlock>0)  pushLine(`Exóticos · ${title} · desde 11`, restBlock, PUB.exoticos.aves.d11, AUX.exoticos.aves.d11);
      // sin extras por 2ª+
    }
  }

  // ===== TRANSPORTE =====
  if(s==="transporte"){
    pushLine(`Transporte`, 1, PUB.transporte.base, AUX.transporte.base);
  }

  // ===== Suplementos globales (solo días señalados por ahora) =====
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  if(big){
    // Cliente +30 por día señalado (simplificado si hay 1 día señalado en rango)
    pushLine(`Día señalado`, 1, PUB.suplementos.diaSeñalado, AUX.suplementos.diaSeñalado);
  }

  // Totales y márgenes
  const payNow   = Math.max(0, totalPub - totalAux); // tu margen (depósito)
  const payLater = Math.max(0, totalAux);            // pendiente para el auxiliar

  return { linesPublic:lines, totalPublic:totalPub, payNow, payLater };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.numPetsOverride || (payload.pets||[]).length || 0)} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span class="desc">${l.html||""}</span><span>${fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calc.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calc.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calc.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  toggleVisitControls();
  toggleExoticControls();

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
    summaryField: JSON.stringify(reservation.pricing.breakdownPublic.map(l=>`${l.label||''}${l.amount?`: ${l.amount}€`:""}`), null, 2),

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

/************** Controles dependientes de servicio **************/
function toggleVisitControls(){
  var v = document.getElementById('visitCatControls');
  var s = document.getElementById('serviceType');
  if(!v || !s) return;
  v.style.display = (s.value === 'visita_gato') ? '' : 'none';
}
function toggleExoticControls(){
  var e = document.getElementById('exoticRow');
  var s = document.getElementById('serviceType');
  if(!e || !s) return;
  e.style.display = (s.value === 'exoticos') ? '' : 'none';
}

/************** Cachorro display (solo lectura, automático por selección) **************/
function __updatePuppyDisplay(){
  var grid = document.getElementById('petsGrid'); if(!grid) return;
  var any = false;
  grid.querySelectorAll('.tpl-pet-item').forEach(function(card){
    var chk = card.querySelector('.pet-check');
    if(chk && chk.checked){
      var birth = (card.getAttribute('data-birth')||'').trim();
      var species = (card.getAttribute('data-species')||'').trim().toLowerCase();
      if(species==='perro' && birth){
        var m = monthsDiff(birth);
        if(m!==null && m<=6) any = true;
      }
    }
  });
  // no mostramos nada en UI de servicio; la condición afectará precios automáticamente
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
  ["serviceType","exoticType","startDate","endDate","startTime","endTime","region","address","postalCode","visitDuration","secondMedVisit","numPets"]
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
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", castrado:(typeof p.castrado==="boolean")?p.castrado:(/si|true/i.test(String(p.castrado||""))), foto:p.foto||"" }))
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

    // Mostrar controles por si viene preseleccionado
    toggleVisitControls();
    toggleExoticControls();

    doRecalc();

    // CTA reservar
    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      const nSel = payload.numPetsOverride || (STATE.selectedPetIds.length);
      if(!nSel){
        alert("Elige al menos una mascota o indica el número."); return;
      }

      const c=calc(payload);
      const reservation = {
        id: "resv_"+Date.now(),
        status: "paid_review",
        createdAt: nowISO(),
        region: payload.region,
        service: { type: payload.serviceType, exoticType: payload.exoticType || null },
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
        pets: payload.pets,
        pricing: {
          breakdownPublic: c.linesPublic.map(l=>({label:l.html?.replace(/<[^>]+>/g,"")||"", amount: Number(l.amount.toFixed(2))})),
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
