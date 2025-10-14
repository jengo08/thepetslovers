/****************************************************
 * TPL · RESERVAS (COMPLETO)
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
function ageYears(birth){
  if(!birth) return null;
  const d=new Date(birth); if(isNaN(d)) return null;
  const t=new Date();
  let y=t.getFullYear()-d.getFullYear();
  if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
  return Math.max(0,y);
}
const isPuppy = p => (p?.especie==="perro" && p?.nacimiento && ((Date.now()-new Date(p.nacimiento).getTime())/2629800000)<=6);

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

// Público
const PUB = {
  guarderia: { adult:15, puppy:20,
    bonos:{ adult:{10:135,20:250,30:315}, puppy:{10:185,20:350,30:465} } },
  alojamiento:{
    first:{ std:{d1_10:30, d11:28}, puppy:{d1_10:35, d11:32} },
    extra:{ d1_10:25, d11:22 }
  },
  paseo:{ base:12, extra:8, bonos:{10:115,15:168,20:220,25:270,30:318} }, // packs informativos auto si exacto nº paseos
  visitaGato:{
    base60:{ d1_10:22, d11:18 },
    base90:{ d1_10:30, d11:27 },
    med15:{ d1_10:12, d11:10 },
    extraCats:{ one:12, twoEach:8, threePlusEach:6 }
  },
  exoticos:{ aves:20, reptiles:20, mamiferos:25 },
  transporte:{ base:20 },
  suplementos:{ urgencia:10, festivo:10, bigDay:30 }
};

// Auxiliar (interno)
const AUX = {
  guarderia:{ adult:12, puppy:17, bonos:{ adult:{10:11,20:10,30:9}, puppy:{10:16,20:14,30:12} } },
  alojamiento:{
    first:{ std:{d1_10:25, d11:22}, puppy:{d1_10:30, d11:27} },
    extra:{ d1_10:20, d11:17 }
  },
  paseo:{ base:10, extra:5, bonosPer:{10:8,15:7.5,20:7,25:6.5,30:6} },
  visitaGato:{
    base60:{ d1_10:17, d11:12 },
    base90:{ d1_10:25, d11:21 },
    med15:{ d1_10:12, d11:10 }, // margen 0
    extraCats:{ one:10, twoEach:6, threePlusEach:4 }
  },
  exoticos:{ aves:15, reptiles:15, mamiferos:20 },
  transporte:{ base:15 },
  suplementos:{ festivo:8, bigDay:15 } // urgencia: 0 (entero a margen)
};

/************** Preselección de servicio (sin localStorage) **************/
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
  const canon = canonicalizeService(raw);
  if(canon) el.value = canon;
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
          sexo: (x.sexo || x.genero || "").toLowerCase(),
          castrado: !!(x.castrado || x.esterilizado || x.esterilizada),
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
    sexo: (p.sexo || p.genero || "").toLowerCase(),
    castrado: !!(p.castrado || p.esterilizado || p.esterilizada),
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
      : `<div class="tpl-pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    // símbolo sexo
    const sexSym = (p.sexo||"").toLowerCase()==='hembra' ? '♀' : ((p.sexo||"").toLowerCase()==='macho' ? '♂' : '');
    const years  = ageYears(p.nacimiento);
    const subBits = [];
    if(p.raza) subBits.push(p.raza);
    if(years!==null) subBits.push(`Edad: ${years}`);
    if(sexSym) subBits.push(sexSym);
    if(p.castrado) subBits.push('Castrado');

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.setAttribute('data-birth', p.nacimiento||'');
    el.setAttribute('data-species', p.especie||'');
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${avatar}
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
        <div class="tpl-pet-meta">
          <div class="tpl-pet-name" style="color:#666">No hay mascotas en tu perfil</div>
          <div class="tpl-pet-sub">Añádelas en tu perfil para seleccionarlas aquí.</div>
        </div>
      </div>`;
  }

  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    // sincroniza selector "Nº de mascotas"
    const sel=$("#numPets"); if(sel) sel.value = String(Math.max(1, STATE.selectedPetIds.length||1));
    // actualizar “cachorro” de display (solo lectura)
    try{ if(typeof __updatePuppyDisplay==='function') __updatePuppyDisplay(); }catch(_){}
    doRecalc();
  }, { once:true });
}

/************** Recogida de payload **************/
function collectPayload(){
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
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
    pets
  };
}

/************** Util bonos guardería **************/
function applyBonoGuarderia(days, isPuppy){
  const out = [];
  const table = isPuppy ? PUB.guarderia.bonos.puppy : PUB.guarderia.bonos.adult;
  let d = days;
  const chunks = [30,20,10]; // 30→20→10 y resto suelto
  chunks.forEach(k=>{
    const n = Math.floor(d / k);
    if(n>0){
      const price = table[k];
      for(let i=0;i<n;i++) out.push({type:'bono', k, price});
      d -= n*k;
    }
  });
  for(let i=0;i<d;i++) out.push({type:'suelto', k:1, price: isPuppy?PUB.guarderia.puppy: PUB.guarderia.adult});
  return out;
}
function applyBonoGuarderiaAux(days, isPuppy){
  const out = [];
  const perDay = isPuppy ? AUX.guarderia.bonos.puppy : AUX.guarderia.bonos.adult;
  let d = days;
  const chunks = [30,20,10];
  chunks.forEach(k=>{
    const n = Math.floor(d / k);
    if(n>0){
      for(let i=0;i<n;i++) out.push({type:'bono', k, perDay:perDay[k]});
      d -= n*k;
    }
  });
  for(let i=0;i<d;i++) out.push({type:'suelto', k:1, perDay:isPuppy?AUX.guarderia.puppy: AUX.guarderia.adult});
  return out;
}

/************** Cálculo + resumen **************/
function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const pets = payload.pets||[];
  const numPets = pets.length || 0;

  let lines=[], total=0;
  let auxLines=[], auxTotal=0;

  // Suplementos días señalados
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  // Flags de festivo/urgencia no tienen UI; si los añades, contempla aquí.
  const isFestivo = false, isUrgente = false;

  if(s==="paseo"){
    const walks = nDays; // 1 paseo por día
    const extras = Math.max(0, numPets-1);
    // Bonos sólo si 1 perro y coincide nº exacto
    const bonoPub = (numPets===1) ? PUB.paseo.bonos[walks] : null;
    const bonoAuxPer = (numPets===1) ? AUX.paseo.bonosPer[walks] : null;

    if(bonoPub!=null){
      lines.push({label:`Paseos (${walks}) · pack`, amount:bonoPub});
      total += bonoPub;
      auxLines.push({label:`Aux · paseos (${walks})`, amount:bonoAuxPer*walks});
      auxTotal += bonoAuxPer*walks;
    }else{
      const base = PUB.paseo.base*walks;
      const extra = extras*PUB.paseo.extra*walks;
      lines.push({label:`Paseos (${walks}) · base`, amount:base});
      if(extra>0) lines.push({label:`Paseos · mascotas extra (${extras})`, amount:extra});
      total += base + extra;

      const auxBase = AUX.paseo.base*walks;
      const auxExtra = extras*AUX.paseo.extra*walks;
      auxLines.push({label:`Aux · paseos (${walks})`, amount:auxBase});
      if(auxExtra>0) auxLines.push({label:`Aux · extra (${extras})`, amount:auxExtra});
      auxTotal += auxBase + auxExtra;
    }
  }

  if(s==="guarderia_dia"){
    // cualquier día aplica bono 30→20→10 + sueltos
    const anyPuppy = pets.some(p=>isPuppy(p));
    const chunks = applyBonoGuarderia(nDays, anyPuppy);
    chunks.forEach(ch=>{
      if(ch.type==='bono'){
        lines.push({label:`Guardería · bono ${ch.k} días`, amount:ch.price});
        total += ch.price;
      }else{
        lines.push({label:`Guardería · día suelto`, amount:ch.price});
        total += ch.price;
      }
    });

    // Aux
    const chAux = applyBonoGuarderiaAux(nDays, anyPuppy);
    chAux.forEach(ch=>{
      const amt = ch.type==='bono' ? (ch.perDay*ch.k) : ch.perDay;
      auxLines.push({label:`Aux · guardería ${ch.type==='bono'?'bono '+ch.k:'suelto'}`, amount:amt});
      auxTotal += amt;
    });
  }

  if(s==="alojamiento_nocturno"){
    // 1ª mascota: std/puppy con tramo 1–10 y 11+
    if(numPets>=1){
      const first = pets[0];
      const firstIsPuppy = isPuppy(first);
      const pubTbl = firstIsPuppy ? PUB.alojamiento.first.puppy : PUB.alojamiento.first.std;
      const auxTbl = firstIsPuppy ? AUX.alojamiento.first.puppy : AUX.alojamiento.first.std;

      const d1_10 = Math.min(10, nDays);
      const d11   = Math.max(0, nDays-10);
      if(d1_10>0){ lines.push({label:`Alojamiento · 1ª mascota (días 1–10)`, amount:pubTbl.d1_10*d1_10}); total+=pubTbl.d1_10*d1_10;
                   auxLines.push({label:`Aux · 1ª (1–10)`, amount:auxTbl.d1_10*d1_10}); auxTotal+=auxTbl.d1_10*d1_10; }
      if(d11>0){   lines.push({label:`Alojamiento · 1ª mascota (desde día 11)`, amount:pubTbl.d11*d11}); total+=pubTbl.d11*d11;
                   auxLines.push({label:`Aux · 1ª (≥11)`, amount:auxTbl.d11*d11}); auxTotal+=auxTbl.d11*d11; }
    }
    // 2ª+ mascota(s)
    const extras = Math.max(0, numPets-1);
    if(extras>0){
      const d1_10 = Math.min(10, nDays);
      const d11   = Math.max(0, nDays-10);
      const pubE = PUB.alojamiento.extra, auxE = AUX.alojamiento.extra;
      if(d1_10>0){ const amt = pubE.d1_10 * d1_10 * extras; lines.push({label:`Alojamiento · ${extras} mascota(s) extra (1–10)`, amount:amt}); total+=amt;
                   const ax  = auxE.d1_10 * d1_10 * extras; auxLines.push({label:`Aux · extra x${extras} (1–10)`, amount:ax}); auxTotal+=ax; }
      if(d11>0){   const amt = pubE.d11   * d11   * extras; lines.push({label:`Alojamiento · ${extras} mascota(s) extra (≥11)`, amount:amt}); total+=amt;
                   const ax  = auxE.d11   * d11   * extras; auxLines.push({label:`Aux · extra x${extras} (≥11)`, amount:ax}); auxTotal+=ax; }
    }
  }

  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const d1_10 = Math.min(10, nDays);
    const d11   = Math.max(0, nDays-10);

    const PUBB = use90?PUB.visitaGato.base90:PUB.visitaGato.base60;
    const AUXB = use90?AUX.visitaGato.base90:AUX.visitaGato.base60;

    if(d1_10>0){ lines.push({label:`Visita gato ${use90?90:60}’ (1–10) x${d1_10}`, amount:PUBB.d1_10*d1_10}); total+=PUBB.d1_10*d1_10;
                 auxLines.push({label:`Aux visita ${use90?90:60}’ (1–10) x${d1_10}`, amount:AUXB.d1_10*d1_10}); auxTotal+=AUXB.d1_10*d1_10; }
    if(d11>0){   lines.push({label:`Visita gato ${use90?90:60}’ (≥11) x${d11}`, amount:PUBB.d11*d11}); total+=PUBB.d11*d11;
                 auxLines.push({label:`Aux visita ${use90?90:60}’ (≥11) x${d11}`, amount:AUXB.d11*d11}); auxTotal+=AUXB.d11*d11; }

    // Medicación 15' segunda visita (por día)
    if(payload.secondMedVisit==="si"){
      if(d1_10>0){ lines.push({label:`2ª visita medicación 15’ (1–10) x${d1_10}`, amount:PUB.visitaGato.med15.d1_10*d1_10}); total+=PUB.visitaGato.med15.d1_10*d1_10;
                   auxLines.push({label:`Aux med 15’ (1–10) x${d1_10}`, amount:AUX.visitaGato.med15.d1_10*d1_10}); auxTotal+=AUX.visitaGato.med15.d1_10*d1_10; }
      if(d11>0){   lines.push({label:`2ª visita medicación 15’ (≥11) x${d11}`, amount:PUB.visitaGato.med15.d11*d11}); total+=PUB.visitaGato.med15.d11*d11;
                   auxLines.push({label:`Aux med 15’ (≥11) x${d11}`, amount:AUX.visitaGato.med15.d11*d11}); auxTotal+=AUX.visitaGato.med15.d11*d11; }
    }

    // Gatos extra por visita (por día)
    const cats = pets.filter(p=>p.especie==="gato").length || pets.length || 1;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      const pubAddEach = extraCats===1 ? PUB.visitaGato.extraCats.one
                        : extraCats===2 ? PUB.visitaGato.extraCats.twoEach
                        : PUB.visitaGato.extraCats.threePlusEach;
      const auxAddEach = extraCats===1 ? AUX.visitaGato.extraCats.one
                        : extraCats===2 ? AUX.visitaGato.extraCats.twoEach
                        : AUX.visitaGato.extraCats.threePlusEach;

      const addPub = pubAddEach * extraCats * nDays;
      const addAux = auxAddEach * extraCats * nDays;

      lines.push({label:`Gatos extra (${extraCats}) x${nDays}`, amount:addPub});
      auxLines.push({label:`Aux gatos extra (${extraCats}) x${nDays}`, amount:addAux});
      total += addPub; auxTotal += addAux;
    }
  }

  if(s==="exoticos_aves" || s==="exoticos_reptiles" || s==="exoticos_mamiferos"){
    const key = s==='exoticos_aves'?'aves': (s==='exoticos_reptiles'?'reptiles':'mamiferos');
    const pub = PUB.exoticos[key];
    const aux = AUX.exoticos[key];
    const amtPub = pub * nDays, amtAux = aux * nDays;
    lines.push({label:`Exóticos (${cap(key)}) x${nDays}`, amount:amtPub}); total+=amtPub;
    auxLines.push({label:`Aux exóticos (${cap(key)}) x${nDays}`, amount:amtAux}); auxTotal+=amtAux;
  }

  if(s==="transporte"){
    lines.push({label:"Transporte", amount:PUB.transporte.base});
    auxLines.push({label:"Aux transporte", amount:AUX.transporte.base});
    total+=PUB.transporte.base; auxTotal+=AUX.transporte.base;
  }

  // Suplementos globales
  if(isUrgente){ lines.push({label:"Urgencia (≤2h)", amount:PUB.suplementos.urgencia}); total+=PUB.suplementos.urgencia; /* aux 0 => íntegro a margen */ }
  if(isFestivo){ lines.push({label:"Festivo", amount:PUB.suplementos.festivo}); total+=PUB.suplementos.festivo;
                 auxLines.push({label:"Aux festivo", amount:AUX.suplementos.festivo}); auxTotal+=AUX.suplementos.festivo; }
  if(big){ lines.push({label:"Día señalado", amount:PUB.suplementos.bigDay}); total+=PUB.suplementos.bigDay;
           auxLines.push({label:"Aux día señalado", amount:AUX.suplementos.bigDay}); auxTotal+=AUX.suplementos.bigDay; }

  if(payload.travelNeeded==="si"){
    lines.push({label:"Desplazamiento", note:"pendiente"});
  }

  const payNow   = Math.max(0, total - auxTotal); // tu margen
  const payLater = Math.max(0, total - payNow);

  return { linesPublic:lines, totalPublic:total, payNow, payLater, aux:{lines:auxLines, total:auxTotal} };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length||0} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span>${l.label}</span><span>${l.note?'<span class="muted">pendiente</span>':fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calc.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calc.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calc.payLater);
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

/************** EmailJS (opcional, respeta config existente) **************/
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

  // Preselección de servicio (solo query/referrer, sin localStorage)
  preselectService();

  // Binds de recálculo
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","visitDuration","secondMedVisit"]
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
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:(p.sexo||p.genero||"").toLowerCase(), castrado:!!(p.castrado||p.esterilizado||p.esterilizada), foto:p.foto||"" }))
      ];
      const seen=new Set();
      STATE.pets = merged.filter(p=>{
        const key = `${(p.nombre||"").toLowerCase()}|${p.especie||""}`;
        if(seen.has(key)) return false; seen.add(key); return true;
      });

      renderPetsGrid(STATE.pets);
    }catch(e){
      console.warn("[init] owner/pets", e);
    }

    // Mostrar controles visita gato si aplica (por la preselección)
    $("#visitCatControls").style.display =
      ($("#serviceType").value==="visita_gato") ? "" : "none";

    doRecalc();

    // CTA reservar
    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      if(!STATE.selectedPetIds.length){
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
        pets: payload.pets,
        pricing: {
          breakdownPublic: c.linesPublic,
          totalClient: Number(c.totalPublic.toFixed(2)),
          payNow: Number(c.payNow.toFixed(2)),      // margen
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

/* ============================================================
   UI: tarjetas mascotas (vertical + avatar redondo)
   ============================================================ */
(function ensurePetListStyle(){
  // ya renderizamos estilado en renderPetsGrid
  // si se hubiera pintado antes, normalizamos
  document.addEventListener('DOMContentLoaded', ()=>{
    const grid=$("#petsGrid"); if(!grid) return;
    if(grid.children.length){
      STATE.selectedPetIds = $$(".pet-check:checked", grid).map(x=>x.dataset.id);
      const sel=$("#numPets"); if(sel) sel.value = String(Math.max(1, STATE.selectedPetIds.length||1));
    }
  });
})();

/* ============================================================
   Display de “Cachorro (≤6 m)” (solo lectura)
   ============================================================ */
function __updatePuppyDisplay(){
  var disp = document.getElementById('isPuppyDisplay');
  var grid = document.getElementById('petsGrid');
  if(!disp || !grid){ return; }
  var any = false;
  grid.querySelectorAll('.tpl-pet-item').forEach(function(card){
    var chk = card.querySelector('.pet-check');
    if(chk && chk.checked){
      var birth = (card.getAttribute('data-birth')||'').trim();
      var species = (card.getAttribute('data-species')||'').trim().toLowerCase();
      if(species==='perro' && birth){
        var d = new Date(birth);
        if(!isNaN(d)){
          var t=new Date();
          var months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
          if(months<=6) any = true;
        }
      }
    }
  });
  disp.value = any ? 'si' : 'no';
}
