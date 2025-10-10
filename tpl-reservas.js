/***** HELPERS DOM *****/
const $ = (s,root=document)=>root.querySelector(s);
const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));
const fmt = n => (typeof n!=="number"||isNaN(n))?"—":n.toFixed(2).replace(".",",")+" €";

/***** CONSTANTES Y TABLAS DE PRECIOS *****/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD
const FESTIVO_NORMAL_PLUS = 10; // cliente
const FESTIVO_NORMAL_AUX = 8;
const BIG_DAY_PLUS = 30; // cliente
const BIG_DAY_AUX = 15;  // auxiliar
const URGENCIA_PLUS = 10; // cliente (tu margen)

// Precios públicos (cliente)
const PUBLIC_PRICES = {
  guarderia_dia: { adulto: 15, cachorro: 20,
    bonos: { adult: {10:135,20:250,30:315}, puppy: {10:185,20:350,30:465} }
  },
  alojamiento_nocturno: {
    std: { normal: 30, desde11: 28 },   // 28 € desde día 11
    puppy: { normal: 35, desde11: 32 },
    segundo: { normal: 25, desde11: 22 }
  },
  paseo: {
    base: 12, extra_mascota: 8,
    bonos: {10:115,15:168,20:220,25:270,30:318}
  },
  visita_gato: {
    base60: 22, base90: 30, d11_60: 18, d11_90: 27,
    med15: 12, med15_d11: 10,
    gatosExtra: { one:12, twoEach:8, moreEach:6 }
  },
  exoticos_aves: { base: 20 },
  exoticos_reptiles: { base: 20 },
  exoticos_mamiferos: { base: 25 },
  transporte: { base: 20 }
};

// Pagos al auxiliar (interno; para margen=total - aux - festivoAux)
const AUX_PAY = {
  guarderia_dia: { adulto: 12, cachorro: 17, bonosAdult:{10:11,20:10,30:9}, bonosPuppy:{10:16,20:14,30:12} },
  alojamiento_nocturno: {
    std:{ normal:25, desde11:22 }, puppy:{ normal:30, desde11:27 }, segundo:{ normal:20, desde11:17 }
  },
  paseo: { base:10, extra_mascota:5, bonos:{10:8,15:7.5,20:7,25:6.5,30:6} },
  visita_gato: {
    base60:17, base90:25, d11_60:12, d11_90:21,
    med15_publicEqualsAux:true,
    gatosExtra:{ one:10, twoEach:6, moreEach:4 }
  },
  exoticos_aves:{ base:15 },
  exoticos_reptiles:{ base:15 },
  exoticos_mamiferos:{ base:20 },
  transporte:{ base:15 }
};

const DEPOSITO_MODE = "margin"; // cobramos tu margen ahora

/***** FECHAS *****/
function parseDate(val){ const d=new Date(val); return isNaN(d)?null:d; }
function fmtMD(dateStr){
  const d=parseDate(dateStr); if(!d) return "";
  const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0");
  return `${m}-${dd}`;
}
function daysInclusive(startDate, endDate){
  const a=parseDate(startDate), b=parseDate(endDate||startDate);
  if(!a || !b) return 0;
  const diff = Math.round((b-a)/86400000);
  return diff>=0 ? diff+1 : 0;
}
function hoursBetween(start,end){
  if(!start || !end) return 0;
  const [h1,m1]=start.split(":").map(Number); const [h2,m2]=end.split(":").map(Number);
  let t = (h2*60+m2)-(h1*60+m1); if(t<0) t = 0;
  return t/60;
}
function nowISO(){ return new Date().toISOString(); }
function todayStr(){ const d=new Date();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0"); return `${d.getFullYear()}-${m}-${dd}`; }

/***** PERFIL / AUTH *****/
async function awaitAuthUser(){
  return new Promise(resolve=>{
    try{ const off=firebase.auth().onAuthStateChanged(u=>{ off&&off(); resolve(u||null); }); }
    catch(_){ resolve(null); }
  });
}

async function getOwnerDoc(uid){
  const db = firebase.firestore();

  async function readDocFrom(coll){
    try{
      const snap = await db.collection(coll).doc(uid).get();
      return snap.exists ? {data:snap.data(), ref:snap.ref, coll} : null;
    }catch(e){
      console.warn("[perfil] error leyendo", coll, e);
      return null;
    }
  }

  let hit = await readDocFrom("propietarios")
         || await readDocFrom("owners")
         || await readDocFrom("usuarios")
         || await readDocFrom("perfiles");

  if(!hit){
    console.warn("[perfil] no hay documento para uid", uid);
    return { fullName:"", email: firebase.auth().currentUser?.email || "", phone:"", region:"", address:"", postalCode:"", pets: [] };
  }

  const d = hit.data||{};
  const nombre   = d.nombre || d.name || "";
  const apellido = d.apellido || d.apellidos || d.surname || "";
  const fullName = d.fullName || [nombre,apellido].filter(Boolean).join(" ").trim() || (firebase.auth().currentUser?.displayName||"");
  const phone    = d.phone || d.telefono || d.tlf || "";
  const region   = d.region || d.comunidad || d.comunidadAutonoma || d.ccaa || "";
  const address  = d.address || d.direccion || "";
  const postal   = d.postalCode || d.cp || d.codigo_postal || d.codigoPostal || "";
  const email    = d.email || firebase.auth().currentUser?.email || "";

  let pets = Array.isArray(d.pets) ? d.pets : (Array.isArray(d.mascotas) ? d.mascotas : []);

  // Subcolección 'mascotas' (si no hay array)
  if(!pets.length && hit.ref){
    try{
      const sub = await hit.ref.collection("mascotas").get();
      pets = sub.docs.map((doc,i)=>{
        const p=doc.data()||{};
        return {
          id: p.id || doc.id || String(i+1),
          name: p.name || p.nombre || "Mascota",
          species: (p.species || p.especie || p.tipo || "").toLowerCase(),
          birth: p.birth || p.nacimiento || p.fechaNacimiento || "",
          subtype: p.subtype || p.subtipo || "",
          img: p.img || p.foto || ""
        };
      });
      if(pets.length) console.debug("[perfil] mascotas por subcolección:", pets.length);
    }catch(e){
      console.warn("[perfil] subcolección mascotas no accesible (rules):", e);
    }
  }

  pets = pets.map((p,i)=>({
    id: p.id || p.uid || String(i+1),
    name: p.name || p.nombre || "Mascota",
    species: (p.species || p.especie || p.tipo || "").toLowerCase(),
    birth: p.birth || p.nacimiento || p.fechaNacimiento || "",
    subtype: p.subtype || p.subtipo || "",
    img: p.img || p.foto || ""
  }));

  return { fullName, email, phone, region, address, postalCode: postal, pets };
}

/***** UI RENDER *****/
function isPuppy(p){
  if(!p || p.species!=="perro") return false;
  if(!p.birth) return false;
  const d = parseDate(p.birth); if(!d) return false;
  const now = new Date();
  const months = (now.getFullYear()-d.getFullYear())*12 + (now.getMonth()-d.getMonth()) - (now.getDate()<d.getDate()?1:0);
  return months<=6;
}
function isPuppyPet(p){ return isPuppy(p); }

function renderPets(pets){
  const grid = $("#petsGrid");
  grid.innerHTML = "";

  (pets||[]).forEach(p=>{
    const puppy = isPuppyPet(p);
    const iconHtml =
      p.img ? `<img class="tpl-pet-thumb" src="${p.img}" alt="${p.name||'Mascota'}">`
            : `<div class="tpl-pet-icon">${
                p.species==="perro" ? '<i class="fa-solid fa-dog"></i>' :
                p.species==="gato" ? '<i class="fa-solid fa-cat"></i>' :
                '<i class="fa-solid fa-kiwi-bird"></i>'}</div>`;

    const subtype = p.subtype ? ` · ${p.subtype}` : (p.species==="exotico" ? ' · exótico' : '');
    const birthTxt = p.birth ? ` · Nac: ${p.birth}` : '';

    const el = document.createElement("label");
    el.className = "tpl-pet-item";
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}" style="margin-right:6px;width:18px;height:18px">
      ${iconHtml}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.name||"Mascota"} ${puppy ? '<span class="badge">Cachorro (≤6m)</span>' : ''}</div>
        <div class="tpl-pet-sub">${(p.species||'').toLowerCase()}${subtype}${birthTxt}</div>
      </div>
    `;
    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    const empty = document.createElement("div");
    empty.className = "tpl-pet-item";
    empty.innerHTML = `<div class="tpl-pet-meta">
      <div class="tpl-pet-name" style="font-weight:600;color:#666">No hay mascotas en tu perfil</div>
      <div class="tpl-pet-sub">Añádelas en tu perfil para seleccionarlas aquí.</div>
    </div>`;
    grid.appendChild(empty);
  }
}

function selectedPets(all){
  const ids = $$(".pet-check:checked").map(x=>x.getAttribute("data-id"));
  return (all||[]).filter(p=>ids.includes(p.id));
}

function fillOwner(owner){
  $("#ownerFullName").value = owner.fullName || "";
  $("#email").value = owner.email || "";
  $("#phone").value = owner.phone || "";
  $("#region").value = owner.region || "";
  $("#address").value = owner.address || "";
  $("#postalCode").value = owner.postalCode || "";
}

/***** PORTADO DESDE SERVICIOS *****/
function canonicalizeService(raw){
  if(!raw) return "";
  const s = String(raw).toLowerCase().trim().replace(/\s+/g,'_').replace(/[^\w_]/g,'');
  const map = {
    'guarderia':'guarderia_dia','guarderia_de_dia':'guarderia_dia','guarderia_dia':'guarderia_dia',
    'alojamiento':'alojamiento_nocturno','alojamiento_nocturno':'alojamiento_nocturno','noche':'alojamiento_nocturno',
    'paseo':'paseo','paseos':'paseo',
    'visita':'visita_gato','visitas':'visita_gato','visita_gato':'visita_gato','visita_a_domicilio_gato':'visita_gato',
    'exoticos':'exoticos_aves','exoticos_aves':'exoticos_aves','aves':'exoticos_aves',
    'exoticos_reptiles':'exoticos_reptiles','reptiles':'exoticos_reptiles',
    'exoticos_mamiferos':'exoticos_mamiferos','mamiferos':'exoticos_mamiferos','mamiferos_pequenos':'exoticos_mamiferos',
    'transporte':'transporte'
  };
  const allowed = new Set(['guarderia_dia','alojamiento_nocturno','paseo','visita_gato','exoticos_aves','exoticos_reptiles','exoticos_mamiferos','transporte']);
  return map[s] || (allowed.has(s) ? s : "");
}
function detectIncomingService(){
  const qs = new URLSearchParams(location.search);
  let raw = qs.get('service') || qs.get('svc');
  if(!raw && location.hash.includes('service=')){
    try{ raw = new URLSearchParams(location.hash.slice(1)).get('service'); }catch(_){}
  }
  if(!raw){
    try{
      const port = sessionStorage.getItem('tpl.gotoReserva');
      if(port){ raw = (JSON.parse(port)||{}).service || ""; sessionStorage.removeItem('tpl.gotoReserva'); }
    }catch(_){}
  }
  if(!raw && document.referrer){
    const u=new URL(document.referrer), p=u.pathname.toLowerCase();
    if(/guarderia/.test(p)) raw='guarderia_dia';
    else if(/alojamiento|noche/.test(p)) raw='alojamiento_nocturno';
    else if(/paseo/.test(p)) raw='paseo';
    else if(/visita/.test(p)&&/gato/.test(p)) raw='visita_gato';
    else if(/exotico|exoticos/.test(p)&&/ave|aves/.test(p)) raw='exoticos_aves';
    else if(/exotico|exoticos/.test(p)&&/reptil|reptiles/.test(p)) raw='exoticos_reptiles';
    else if(/exotico|exoticos/.test(p)&&/mamifer/.test(p)) raw='exoticos_mamiferos';
    else if(/transporte/.test(p)) raw='transporte';
  }
  if(!raw){ try{ raw = localStorage.getItem('tpl.lastService') || ""; }catch(_){} }
  const canon = canonicalizeService(raw);
  if(canon){ try{ localStorage.setItem('tpl.lastService', canon); }catch(_){} }
  return canon;
}

/***** CÁLCULO *****/
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
function round2(n){ return Math.round((n||0)*100)/100; }

function calcPublicAndAux(payload){
  const s = payload.serviceType;
  const startDate = payload.startDate;
  const endDate = payload.endDate || payload.startDate;
  const numDays = Math.max(1, daysInclusive(startDate,endDate));
  const pets = payload.pets||[];
  const cats = pets.filter(p=>p.species==="gato").length || 0;
  const numPets = Math.max(1,pets.length||1); // paseo/aloja/guardería
  const anyPuppy = pets.some(isPuppyPet);

  let linesPublic=[], linesAux=[], totalPublic=0, totalAux=0;

  // Guardería de día con bonos automáticos (10/20/30). Si son 11 días: bono 10 + 1 suelto, etc.
  if(s==="guarderia_dia"){
    const isPuppy = anyPuppy;
    const pDay = isPuppy ? PUBLIC_PRICES.guarderia_dia.cachorro : PUBLIC_PRICES.guarderia_dia.adulto;
    const auxDay = isPuppy ? AUX_PAY.guarderia_dia.cachorro : AUX_PAY.guarderia_dia.adulto;
    const bonoPack = isPuppy ? PUBLIC_PRICES.guarderia_dia.bonos.puppy : PUBLIC_PRICES.guarderia_dia.bonos.adult;
    const bonoAux  = isPuppy ? AUX_PAY.guarderia_dia.bonosPuppy : AUX_PAY.guarderia_dia.bonosAdult;

    let remaining = numDays;
    [30,20,10].forEach(size=>{
      while(remaining>=size){
        linesPublic.push({label:`Bono ${size} días`, amount:bonoPack[size]});
        totalPublic += bonoPack[size];
        const aux = bonoAux[size]*size;
        linesAux.push({label:`Auxiliar bono ${size}`, amount:aux});
        totalAux += aux;
        remaining -= size;
      }
    });
    if(remaining>0){
      linesPublic.push({label:`Días sueltos (${remaining})`, amount:pDay*remaining});
      totalPublic += pDay*remaining;
      linesAux.push({label:`Auxiliar días sueltos`, amount:auxDay*remaining});
      totalAux += auxDay*remaining;
    }
  }

  // Alojamiento nocturno: 1–10 normal; desde 11: “desde11”
  if(s==="alojamiento_nocturno"){
    const petsCount = Math.max(1, numPets);
    for(let i=0;i<petsCount;i++){
      const petIndex = i+1;
      const second = (petIndex>=2);
      const isPup = isPuppyPet(pets[i]);
      let pub=0, aux=0;
      for(let d=1; d<=numDays; d++){
        const from11 = (d>=11);
        let pPub=0, pAux=0;
        if(second){
          pPub = from11 ? PUBLIC_PRICES.alojamiento_nocturno.segundo.desde11 : PUBLIC_PRICES.alojamiento_nocturno.segundo.normal;
          pAux = from11 ? AUX_PAY.alojamiento_nocturno.segundo.desde11 : AUX_PAY.alojamiento_nocturno.segundo.normal;
        }else if(isPup){
          pPub = from11 ? PUBLIC_PRICES.alojamiento_nocturno.puppy.desde11 : PUBLIC_PRICES.alojamiento_nocturno.puppy.normal;
          pAux = from11 ? AUX_PAY.alojamiento_nocturno.puppy.desde11 : AUX_PAY.alojamiento_nocturno.puppy.normal;
        }else{
          pPub = from11 ? PUBLIC_PRICES.alojamiento_nocturno.std.desde11 : PUBLIC_PRICES.alojamiento_nocturno.std.normal;
          pAux = from11 ? AUX_PAY.alojamiento_nocturno.std.desde11 : AUX_PAY.alojamiento_nocturno.std.normal;
        }
        pub += pPub; aux += pAux;
      }
      linesPublic.push({label:`Alojamiento · mascota ${petIndex} · ${numDays} día(s)`, amount:pub});
      linesAux.push({label:`Aux alojamiento · mascota ${petIndex}`, amount:aux});
      totalPublic += pub; totalAux += aux;
    }
  }

  // Paseos (60'): base + extras por mascota
  if(s==="paseo"){
    const walks = 1; // unidad
    linesPublic.push({label:`Paseo (60’) · ${walks} uds`, amount:PUBLIC_PRICES.paseo.base*walks});
    linesAux.push({label:`Aux paseo`, amount:AUX_PAY.paseo.base*walks});
    totalPublic += PUBLIC_PRICES.paseo.base*walks;
    totalAux += AUX_PAY.paseo.base*walks;

    const extraPets = Math.max(0, numPets-1);
    if(extraPets>0){
      linesPublic.push({label:`Mascotas adicionales (${extraPets})`, amount:PUBLIC_PRICES.paseo.extra_mascota*extraPets*walks});
      linesAux.push({label:`Aux extras (${extraPets})`, amount:AUX_PAY.paseo.extra_mascota*extraPets*walks});
      totalPublic += PUBLIC_PRICES.paseo.extra_mascota*extraPets*walks;
      totalAux += AUX_PAY.paseo.extra_mascota*extraPets*walks;
    }
  }

  // Visita a gato: 60/90 y 2ª visita medicación 15’ (12 € / 10 € desde día 11)
  if(s==="visita_gato"){
    const use90 = String($("#visitDuration").value||"60")==="90";
    const from11 = (numDays>=11);

    const p = use90 ? (from11?PUBLIC_PRICES.visita_gato.d11_90:PUBLIC_PRICES.visita_gato.base90)
                    : (from11?PUBLIC_PRICES.visita_gato.d11_60:PUBLIC_PRICES.visita_gato.base60);
    const a = use90 ? (from11?AUX_PAY.visita_gato.d11_90:AUX_PAY.visita_gato.base90)
                    : (from11?AUX_PAY.visita_gato.d11_60:AUX_PAY.visita_gato.base60);
    linesPublic.push({label:`Base (Visita gato · ${use90?90:60}’)`, amount:p});
    linesAux.push({label:`Aux visita gato`, amount:a});
    totalPublic += p; totalAux += a;

    // Gatos extra
    const cats = pets.filter(p=>p.species==="gato").length || 0;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      let perClient, perAux;
      if(extraCats===1){ perClient=PUBLIC_PRICES.visita_gato.gatosExtra.one; perAux=AUX_PAY.visita_gato.gatosExtra.one; }
      else if(extraCats===2){ perClient=PUBLIC_PRICES.visita_gato.gatosExtra.twoEach; perAux=AUX_PAY.visita_gato.gatosExtra.twoEach; }
      else { perClient=PUBLIC_PRICES.visita_gato.gatosExtra.moreEach; perAux=AUX_PAY.visita_gato.gatosExtra.moreEach; }
      const addC = perClient * extraCats;
      const addA = perAux * extraCats;
      linesPublic.push({label:`Gatos extra (${extraCats})`, amount:addC});
      linesAux.push({label:`Aux gatos extra`, amount:addA});
      totalPublic+=addC; totalAux+=addA;
    }

    // 2ª visita medicación
    if(($("#secondMedVisit").value||"no")==="si"){
      const pm = from11 ? PUBLIC_PRICES.visita_gato.med15_d11 : PUBLIC_PRICES.visita_gato.med15;
      const am = pm; // margen 0
      linesPublic.push({label:`2ª visita (medicación 15’)`, amount:pm});
      linesAux.push({label:`Aux medicación 15’`, amount:am});
      totalPublic+=pm; totalAux+=am;
    }
  }

  // Exóticos
  if(s==="exoticos_aves"||s==="exoticos_reptiles"||s==="exoticos_mamiferos"){
    const base = PUBLIC_PRICES[s].base;
    const aux = AUX_PAY[s].base;
    linesPublic.push({label:`Base (${labelService(s)})`, amount:base});
    linesAux.push({label:`Aux ${labelService(s)}`, amount:aux});
    totalPublic+=base; totalAux+=aux;
  }

  // Transporte
  if(s==="transporte"){
    const base = PUBLIC_PRICES.transporte.base;
    const aux  = AUX_PAY.transporte.base;
    linesPublic.push({label:`Transporte`, amount:base});
    linesAux.push({label:`Aux transporte`, amount:aux});
    totalPublic+=base; totalAux+=aux;
  }

  // SUPLEMENTOS AUTOMÁTICOS
  // Urgencia (<2h hoy)
  const today = todayStr();
  if(startDate===today && payload.startTime){
    const [hh,mm]=payload.startTime.split(":").map(Number);
    const start = new Date(); start.setHours(hh||0,mm||0,0,0);
    const minsDiff = Math.round((start - new Date())/60000);
    if(minsDiff>0 && minsDiff<120){
      linesPublic.push({label:"Suplemento urgencia (<2h)", amount:URGENCIA_PLUS});
      totalPublic += URGENCIA_PLUS; // solo cliente (tu margen)
    }
  }

  // Festivos “tochos” y normales
  const keyStart = fmtMD(startDate), keyEnd = fmtMD(endDate);
  const isBig = BIG_DAYS.includes(keyStart) || BIG_DAYS.includes(keyEnd);
  if(isBig){
    linesPublic.push({label:`Día señalado`, amount:BIG_DAY_PLUS});
    linesAux.push({label:`Aux día señalado`, amount:BIG_DAY_AUX});
    totalPublic += BIG_DAY_PLUS; totalAux += BIG_DAY_AUX;
  }else if(payload.festive===true){
    linesPublic.push({label:`Festivo`, amount:FESTIVO_NORMAL_PLUS});
    linesAux.push({label:`Aux festivo`, amount:FESTIVO_NORMAL_AUX});
    totalPublic += FESTIVO_NORMAL_PLUS; totalAux += FESTIVO_NORMAL_AUX;
  }

  // Nota de desplazamiento (no suma)
  if(payload.travelNeeded==="si"){
    linesPublic.push({label:`Desplazamiento`, note:"pendiente"});
  }

  // PAY NOW = margen
  const payNow = Math.max(0, totalPublic - totalAux);
  const payLater = Math.max(0, totalPublic - payNow);

  return {linesPublic,totalPublic,totalAux,payNow,payLater};
}

function renderSummary(calc, payload){
  const ctx = `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length||0} mascota(s)`;
  $("#summaryContext").textContent = ctx;

  const box = $("#summaryLines"); box.innerHTML = "";
  calc.linesPublic.forEach(l=>{
    const row = document.createElement("div");
    row.className = "line";
    const right = (l.note==="pendiente") ? '<span class="muted">pendiente</span>' : fmt(l.amount);
    row.innerHTML = `<span>${l.label}${l.calc?` <span class="muted">· ${l.calc}</span>`:""}</span><span>${right}</span>`;
    box.appendChild(row);
  });
  $("#subtotalTxt").textContent = fmt(calc.totalPublic);
  $("#payNowTxt").textContent = fmt(calc.payNow);
  $("#payLaterTxt").textContent = fmt(calc.payLater);
}

/***** FORM PAYLOAD *****/
function collectPayload(statePets){
  return {
    serviceType: $("#serviceType").value,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    notes: $("#notes").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    festive: false, // si conectas festivos por CCAA, marca aquí
    travelNeeded: $("#travelNeeded").value,
    pets: selectedPets(statePets)
  };
}

function buildReservation(calc, payload){
  return {
    id: "resv_"+Date.now(),
    status: "paid_review",
    createdAt: nowISO(),
    service: { type: payload.serviceType },
    dates: { startDate: payload.startDate, endDate: payload.endDate, startTime: payload.startTime||null, endTime: payload.endTime||null },
    region: payload.region,
    owner: {
      fullName: $("#ownerFullName").value.trim(),
      email: $("#email").value.trim(),
      phone: $("#phone").value.trim(),
      address: $("#address").value.trim(),
      postalCode: $("#postalCode").value.trim(),
      contactPref: $("#contactPref").value,
      contactTime: $("#contactTime").value,
      emergencyName: $("#emergencyName").value.trim(),
      emergencyPhone: $("#emergencyPhone").value.trim()
    },
    pets: payload.pets,
    flags: {
      urgency: calc.linesPublic.some(l=>String(l.label).toLowerCase().includes("urgencia")),
      bigDay: BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate)),
      festive: payload.festive===true,
      travelNeeded: payload.travelNeeded==="si"
    },
    pricing: {
      breakdownPublic: calc.linesPublic,
      totalClient: round2(calc.totalPublic),
      payNow: round2(calc.payNow),
      payLater: round2(calc.payLater),
      currency:"EUR"
    },
    internal: {
      totalAux: round2(calc.totalAux||0),
      margin: round2(calc.totalPublic - (calc.totalAux||0))
    }
  };
}

/***** EMAILJS (usa un único template) *****/
async function sendEmails(reservation){
  if(!window.TPL_EMAILJS || !TPL_EMAILJS.enabled) { console.log("[EmailJS] desactivado"); return; }
  const svc = labelService(reservation.service.type);
  const mascotas = (reservation.pets||[]).map(p=>p.name).join(", ")||"—";

  const baseVars = {
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
    region: reservation.region,
    address: reservation.owner.address,
    postalCode: reservation.owner.postalCode,
    observations: $("#notes").value || "",

    total_cliente: reservation.pricing.totalClient,
    pagar_ahora: reservation.pricing.payNow,
    pendiente: reservation.pricing.payLater,

    total_txt: fmt(reservation.pricing.totalClient).replace(" €","€"),
    pay_now_txt: fmt(reservation.pricing.payNow).replace(" €","€"),
    pay_later_txt: fmt(reservation.pricing.payLater).replace(" €","€"),

    _estado: reservation.status,
    _uid: firebase.auth().currentUser?.uid || "",
    _email: firebase.auth().currentUser?.email || "",

    admin_email: (window.TPL_EMAILJS && TPL_EMAILJS.adminEmail) ? TPL_EMAILJS.adminEmail : "gestion@thepetslovers.es"
  };

  try{
    await emailjs.send(TPL_EMAILJS.serviceId, TPL_EMAILJS.templateIdCliente, baseVars);
    await emailjs.send(TPL_EMAILJS.serviceId, TPL_EMAILJS.templateIdGestion, baseVars);
    console.log("[EmailJS] enviados");
  }catch(e){
    console.warn("[EmailJS] error", e);
  }
}

/***** RECALC / BIND *****/
function doRecalc(){
  const state = window.__STATE__ || {};
  const payload = collectPayload(state.pets||[]);
  if(!payload.serviceType || !payload.startDate || !payload.endDate){ 
    renderSummary({linesPublic:[],totalPublic:0,payNow:0,payLater:0}, payload); 
    return; 
  }
  // Visita gato: mostrar/ocultar controles
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";

  const calc = calcPublicAndAux(payload);
  renderSummary(calc, payload);
  sessionStorage.setItem("tpl.lastCalc", JSON.stringify({payload,calc}));
}

function bindRecalc(){
  ["serviceType","startDate","endDate","startTime","endTime","region","notes","address","postalCode","travelNeeded","visitDuration","secondMedVisit"]
    .forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input", doRecalc); });
  $("#petsGrid").addEventListener("change", doRecalc);
}

/***** INIT *****/
window.addEventListener("load", async ()=>{
  const user = await awaitAuthUser();
  if(!user){
    $("#sessionGate").style.display="block";
    $("#reservaForm").classList.add("disabled");
    return;
  }
  $("#sessionGate").style.display="none";
  $("#reservaForm").classList.remove("disabled");

  const owner = await getOwnerDoc(user.uid);
  window.__STATE__ = { owner, pets: owner.pets || [] };

  renderPets(window.__STATE__.pets);
  fillOwner(owner);

  // Prefijar servicio si viene de servicios o referrer
  const qs = new URLSearchParams(location.search);
  const svcQS = canonicalizeService(qs.get("service")||qs.get("svc"));
  if(svcQS){ $("#serviceType").value = svcQS; }
  if(!$("#serviceType").value){
    const autoSvc = detectIncomingService();
    if(autoSvc) $("#serviceType").value = autoSvc;
  }
  $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";

  // Fechas: si cambias inicio y fin queda antes, ajustamos
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

  bindRecalc();
  doRecalc();

  // CTA Reservar (demo: guarda + emails + gracias)
  $("#btnReserve").addEventListener("click", async ()=>{
    if(!$("#serviceType").value || !$("#startDate").value || !$("#endDate").value){
      alert("Selecciona servicio y fechas de inicio/fin."); return;
    }
    const sel = selectedPets(window.__STATE__.pets||[]);
    if(!sel.length){ alert("Elige al menos una mascota."); return; }

    const payload = collectPayload(window.__STATE__.pets||[]);
    const calc = calcPublicAndAux(payload);
    const reservation = buildReservation(calc, payload);

    // MOCK persistencia local para que en perfil aparezca
    try{
      const key="tpl.reservas";
      const list = JSON.parse(localStorage.getItem(key)||"[]");
      list.unshift(reservation);
      localStorage.setItem(key, JSON.stringify(list));
    }catch(_){}

    await sendEmails(reservation);

    $("#reservaForm").style.display="none";
    $("#thanks").style.display="block";
  });
});
