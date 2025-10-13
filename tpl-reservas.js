/****************************************************
 * TPL · RESERVAS (COMPLETO · para reservas.html remaquetado)
 * (Mantiene IDs y comportamiento del flujo actual)
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
const between11 = (n)=> n>=11;

/************** Etiquetas **************/
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

/************** Festivos señalados **************/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

/************** Tarifas CLIENTE **************/
const PUB = {
  guarderia: {
    dayAdult: 15, dayPuppy: 20,
    packsAdult: {10:135, 20:250, 30:315},
    packsPuppy: {10:185, 20:350, 30:465}
  },
  alojamiento: {
    std_1_10:30, std_11:28,
    pup_1_10:35, pup_11:32,
    second_1_10:25, second_11:22
  },
  paseo: { base:12, extra:8 }, // por mascota adicional
  visita: {
    base60_1_10:22, base60_11:18,
    base90_1_10:30, base90_11:27,
    med15_1_10:12,  med15_11:10,
    extraCats: {one:12, twoEach:8, threePlusEach:6}
  },
  exoticos: { aves:20, reptiles:20, mamiferos:25 },
  transporte: { base:20 },
  suplementos: { festivo:10, senalado:30, urgencia:10 } // (urgencia íntegro a margen, festivo/normal no auto)
};

/************** Tarifas AUXILIAR (interno, no visible) **************/
const AUX = {
  guarderia: {
    dayAdult:12, dayPuppy:17,
    // precio por DÍA cuando entra en bono:
    perDayAdult: {10:11, 20:10, 30:9},
    perDayPuppy: {10:16, 20:14, 30:12}
  },
  alojamiento: {
    std_1_10:25, std_11:22,
    pup_1_10:30, pup_11:27,
    second_1_10:20, second_11:17
  },
  paseo: { base:10, extra:5 },
  visita: {
    base60_1_10:17, base60_11:12,
    base90_1_10:25, base90_11:21,
    med15_sameAsPublic:true,
    extraCats: {one:10, twoEach:6, threePlusEach:4}
  },
  exoticos: { aves:15, reptiles:15, mamiferos:20 },
  transporte: { base:15 },
  suplementos: { festivo:8, senalado:15 } // urgencia NO suma al aux
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
function boolFrom(v){
  const s = (v===true || v===false) ? v : String(v||"").toLowerCase().trim();
  if(s===true || s==="true" || s==="si" || s==="sí" || s==="s" || s==="1") return true;
  if(s===false || s==="false" || s==="no" || s==="0") return false;
  return null;
}
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
          esterilizado: (x.esterilizado ?? x.castrado ?? x.esterilizada ?? null),
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
    esterilizado: (p.esterilizado ?? p.castrado ?? p.esterilizada ?? null),
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
      ? `<img class="pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    const el=document.createElement("label");
    el.className="pet-item";
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}" style="margin-right:6px;width:18px;height:18px">
      ${iconHtml}
      <div style="display:flex;flex-direction:column;line-height:1.25">
        <strong>${p.nombre||"Mascota"}</strong>
        <span class="muted">${(p.especie||'').toLowerCase()}</span>
      </div>
    `;
    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    grid.innerHTML = `
      <div class="pet-item">
        <div><strong style="color:#666">No hay mascotas en tu perfil</strong>
        <div class="muted">Añádelas en tu perfil para seleccionarlas aquí.</div></div>
      </div>`;
  }

  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    __updatePuppyDisplay?.();
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

/************** Bonos guardería (cliente/aux) **************/
function splitPacks(n){ // devuelve {p30,p20,p10,rest}
  const p30=Math.floor(n/30); n%=30;
  const p20=Math.floor(n/20); n%=20;
  const p10=Math.floor(n/10); n%=10;
  return {p30,p20,p10,rest:n};
}
function sumGuarderiaCliente(nDays, isPuppy){
  const packs = splitPacks(nDays);
  const cfg = isPuppy? PUB.guarderia.packsPuppy : PUB.guarderia.packsAdult;
  const day = isPuppy? PUB.guarderia.dayPuppy : PUB.guarderia.dayAdult;
  const lines=[];
  if(packs.p30) lines.push({label:`Guardería · bono 30 × ${packs.p30}`, amount: cfg[30]*packs.p30});
  if(packs.p20) lines.push({label:`Guardería · bono 20 × ${packs.p20}`, amount: cfg[20]*packs.p20});
  if(packs.p10) lines.push({label:`Guardería · bono 10 × ${packs.p10}`, amount: cfg[10]*packs.p10});
  if(packs.rest) lines.push({label:`Guardería · ${packs.rest} día(s) sueltos`, amount: day*packs.rest});
  const total = lines.reduce((a,b)=>a+b.amount,0);
  return {lines,total};
}
function sumGuarderiaAux(nDays, isPuppy){
  const packs = splitPacks(nDays);
  const perDay = isPuppy? AUX.guarderia.perDayPuppy : AUX.guarderia.perDayAdult;
  const day = isPuppy? AUX.guarderia.dayPuppy : AUX.guarderia.dayAdult;
  const lines=[];
  if(packs.p30) lines.push({label:`Aux · guardería · bono 30 × ${packs.p30}`, amount: perDay[30]*30*packs.p30});
  if(packs.p20) lines.push({label:`Aux · guardería · bono 20 × ${packs.p20}`, amount: perDay[20]*20*packs.p20});
  if(packs.p10) lines.push({label:`Aux · guardería · bono 10 × ${packs.p10}`, amount: perDay[10]*10*packs.p10});
  if(packs.rest) lines.push({label:`Aux · guardería · ${packs.rest} día(s)`, amount: day*packs.rest});
  const total = lines.reduce((a,b)=>a+b.amount,0);
  return {lines,total};
}

/************** Cálculo + resumen **************/
function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const anyPuppy = payload.pets.some(p=>{
    if(p.especie!=="perro" || !p.nacimiento) return false;
    const d=new Date(p.nacimiento); if(isNaN(d)) return false;
    const t=new Date();
    const months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
    return months<=6;
  });

  let lines=[], total=0;
  let auxLines=[], auxTotal=0;

  if(s==="guarderia_dia"){
    const pub = sumGuarderiaCliente(nDays, anyPuppy);
    const aux = sumGuarderiaAux(nDays, anyPuppy);
    lines.push(...pub.lines); total+=pub.total;
    auxLines.push(...aux.lines); auxTotal+=aux.total;
  }

  if(s==="alojamiento_nocturno"){
    // 1ª mascota
    const first = payload.pets[0];
    const firstPuppy = first && first.especie==="perro" && first.nacimiento &&
      ((Date.now()-new Date(first.nacimiento).getTime())/2629800000 <= 6);

    const d1 = Math.min(nDays,10), d2 = Math.max(0,nDays-10);
    const firstPub = (firstPuppy?PUB.alojamiento.pup_1_10:PUB.alojamiento.std_1_10)*d1
                   + (firstPuppy?PUB.alojamiento.pup_11:PUB.alojamiento.std_11)*d2;
    const firstAux = (firstPuppy?AUX.alojamiento.pup_1_10:AUX.alojamiento.std_1_10)*d1
                   + (firstPuppy?AUX.alojamiento.pup_11:AUX.alojamiento.std_11)*d2;
    lines.push({label:`Alojamiento · 1ª mascota · ${nDays} noche(s)`, amount:firstPub});
    auxLines.push({label:`Aux · alojamiento · 1ª mascota`, amount:firstAux});
    total+=firstPub; auxTotal+=firstAux;

    // 2ª+ mascotas
    const secondCount=Math.max(0,(payload.pets.length-1));
    if(secondCount>0){
      const addPub = PUB.alojamiento.second_1_10*d1 + PUB.alojamiento.second_11*d2;
      const addAux = AUX.alojamiento.second_1_10*d1 + AUX.alojamiento.second_11*d2;
      lines.push({label:`Alojamiento · ${secondCount} mascota(s) extra`, amount:addPub*secondCount});
      auxLines.push({label:`Aux · alojamiento · ${secondCount} extra`, amount:addAux*secondCount});
      total+=addPub*secondCount; auxTotal+=addAux*secondCount;
    }
  }

  if(s==="paseo"){
    // (suelo interpretarlo como 1 paseo seleccionado; si incorporas "cantidad", multiplicas)
    const base = PUB.paseo.base;
    const extras = Math.max(0,(payload.pets.length||1)-1)*PUB.paseo.extra;
    lines.push({label:`Paseo (60’) · base`, amount:base});
    if(extras) lines.push({label:`Paseo · mascotas adicionales`, amount:extras});
    total += base + extras;

    const auxBase = AUX.paseo.base;
    const auxExtras = Math.max(0,(payload.pets.length||1)-1)*AUX.paseo.extra;
    auxLines.push({label:`Aux · paseo base`, amount:auxBase});
    if(auxExtras) auxLines.push({label:`Aux · paseo extras`, amount:auxExtras});
    auxTotal += auxBase + auxExtras;
  }

  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const long = between11(nDays);
    const basePub = (use90 ? (long?PUB.visita.base90_11:PUB.visita.base90_1_10)
                           : (long?PUB.visita.base60_11:PUB.visita.base60_1_10)) * nDays;
    lines.push({label:`Visita gato · ${use90?90:60}’ × ${nDays}`, amount:basePub});
    total+=basePub;

    const baseAux = (use90 ? (long?AUX.visita.base90_11:AUX.visita.base90_1_10)
                           : (long?AUX.visita.base60_11:AUX.visita.base60_1_10)) * nDays;
    auxLines.push({label:`Aux · visita ${use90?90:60}’ × ${nDays}`, amount:baseAux});
    auxTotal+=baseAux;

    if(payload.secondMedVisit==="si"){
      const medPub = (long?PUB.visita.med15_11:PUB.visita.med15_1_10) * nDays;
      lines.push({label:`2ª visita medicación 15’ × ${nDays}`, amount:medPub});
      total+=medPub;

      const medAux = (AUX.visita.med15_sameAsPublic ? (long?PUB.visita.med15_11:PUB.visita.med15_1_10) : 0) * nDays;
      auxLines.push({label:`Aux · 2ª medicación 15’ × ${nDays}`, amount:medAux});
      auxTotal+=medAux;
    }

    // Gatos extra (por visita)
    const cats = payload.pets.filter(p=>p.especie==="gato").length || payload.pets.length || 1;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      let addPub=0, addAux=0, label="";
      if(extraCats===1){
        addPub = PUB.visita.extraCats.one;
        addAux = AUX.visita.extraCats.one;
        label = "Gato extra (1)";
      }else if(extraCats===2){
        addPub = PUB.visita.extraCats.twoEach*extraCats;
        addAux = AUX.visita.extraCats.twoEach*extraCats;
        label = "Gatos extra (2)";
      }else{
        addPub = PUB.visita.extraCats.threePlusEach*extraCats;
        addAux = AUX.visita.extraCats.threePlusEach*extraCats;
        label = `Gatos extra (${extraCats})`;
      }
      lines.push({label:`${label} × ${nDays}`, amount:addPub*nDays});
      auxLines.push({label:`Aux · ${label} × ${nDays}`, amount:addAux*nDays});
      total+=addPub*nDays; auxTotal+=addAux*nDays;
    }
  }

  if(s==="exoticos_aves" || s==="exoticos_reptiles" || s==="exoticos_mamiferos"){
    const key = s==="exoticos_aves" ? "aves" : (s==="exoticos_reptiles"?"reptiles":"mamiferos");
    const pub = PUB.exoticos[key]*nDays;
    const aux = AUX.exoticos[key]*nDays;
    lines.push({label:`Exóticos · ${key} × ${nDays}`, amount:pub});
    auxLines.push({label:`Aux · exóticos · ${key} × ${nDays}`, amount:aux});
    total+=pub; auxTotal+=aux;
  }

  if(s==="transporte"){
    lines.push({label:"Transporte", amount:PUB.transporte.base});
    auxLines.push({label:"Aux · transporte", amount:AUX.transporte.base});
    total+=PUB.transporte.base; auxTotal+=AUX.transporte.base;
  }

  // Días señalados (aplica si inicio o fin coincide)
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  if(big){
    lines.push({label:"Día señalado", amount:PUB.suplementos.senalado});
    auxLines.push({label:"Aux · día señalado", amount:AUX.suplementos.senalado});
    total+=PUB.suplementos.senalado; auxTotal+=AUX.suplementos.senalado;
  }

  // Desplazamiento: pendiente (no suma)
  if(payload.travelNeeded==="si"){
    lines.push({label:"Desplazamiento", note:"pendiente"});
  }

  const payNow   = Math.max(0, total - auxTotal);   // margen real
  const payLater = Math.max(0, total - payNow);
  return { linesPublic:lines, totalPublic:total, payNow, payLater };
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

/************** EmailJS (opcional) **************/
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

  // Reubicar “Cachorro (≤6 m)” a Datos del servicio (solo lectura)
  (function movePuppyDisplay(){
    const puppy = $("#isPuppyDisplay");
    if(!puppy) return;
    const field = puppy.closest(".field") || puppy;
    const after = $("#numPets")?.closest(".field");
    if(after && field){
      after.parentElement.insertBefore(field, after.nextSibling);
    }
  })();

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
        ...localPets.map((p,i)=>({
          id:p.id||`loc_${i}`,
          nombre:p.nombre,
          especie:(p.especie||p.tipo||"").toLowerCase(),
          nacimiento:p.nacimiento||p.birthdate||"",
          raza:p.raza||p.tipoExotico||"",
          sexo:p.sexo||p.genero||"",
          esterilizado:(p.esterilizado ?? p.castrado ?? p.esterilizada ?? null),
          foto:p.foto||""
        }))
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

/* ============================================================
   UI: tarjetas de mascotas compactas (lista vertical)
   – Manteniendo tu estética, solo ampliamos el subtítulo
   ============================================================ */
(function(){
  var _origRender = window.renderPetsGrid;

  function cap(s){ s=String(s||''); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }
  function calcAge(birth){
    if(!birth) return "";
    var d=new Date(birth); if(isNaN(d)) return "";
    var t=new Date();
    var years = t.getFullYear()-d.getFullYear()
               - ((t.getMonth()<d.getMonth()) || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate()) ? 1 : 0);
    return years>=0 ? String(years) : "";
  }
  function asSiNo(v){
    const b = boolFrom(v);
    return b===null ? "" : (b?"Sí":"No");
  }

  function normalizeCard(el){
    el.classList.add('tpl-pet-item'); // para tus estilos compactos
    var chk = el.querySelector('input[type="checkbox"]');
    if(chk) chk.classList.add('pet-check');

    var img = el.querySelector('img');
    var ico = el.querySelector('.pet-icon');
    if(img){ img.classList.add('tpl-pet-thumb'); }
    else if(ico){ ico.classList.add('tpl-pet-thumb'); }

    var meta = el.querySelector('.tpl-pet-meta');
    if(!meta){
      meta = document.createElement('div');
      meta.className = 'tpl-pet-meta';
      var anchor = el.querySelector('img, .tpl-pet-thumb, .pet-icon');
      if(anchor && anchor.nextSibling) anchor.parentNode.insertBefore(meta, anchor.nextSibling);
      else el.appendChild(meta);
    }

    var name = meta.querySelector('.tpl-pet-name') || el.querySelector('strong');
    if(!name){
      name = document.createElement('div');
      name.className='tpl-pet-name';
      meta.appendChild(name);
    }else{
      name.classList.add('tpl-pet-name');
      if(name.parentElement!==meta) meta.prepend(name);
    }

    var sub = meta.querySelector('.tpl-pet-sub');
    if(!sub){
      sub = document.createElement('div');
      sub.className='tpl-pet-sub';
      meta.appendChild(sub);
    }
  }

  function fillCard(el, pet){
    var name = el.querySelector('.tpl-pet-name');
    if(name) name.textContent = pet.nombre || "Mascota";

    if(pet.nacimiento) el.setAttribute('data-birth', pet.nacimiento);
    if(pet.especie)    el.setAttribute('data-species', String(pet.especie).toLowerCase());

    var especie = (pet.especie||"").toString().trim();
    var raza    = (pet.raza||"").toString().trim();
    var edadY   = calcAge(pet.nacimiento||"");
    var sexo    = (pet.sexo||"").toString().trim(); // macho/hembra
    var castr   = asSiNo(pet.esterilizado);

    var bits=[];
    if(especie) bits.push(cap(especie));
    if(raza)    bits.push(raza);
    if(edadY)   bits.push("Edad: "+edadY);
    if(sexo)    bits.push(cap(sexo));
    if(castr)   bits.push("Castrado: "+castr);

    var sub = el.querySelector('.tpl-pet-sub');
    if(sub) sub.textContent = bits.join(" · ");
  }

  function enhance(pets){
    var grid = document.getElementById('petsGrid'); if(!grid) return;
    var cards = grid.querySelectorAll('label, .pet-item, .tpl-pet-item');

    cards.forEach(function(card){
      normalizeCard(card);
      var id = card.querySelector('.pet-check')?.getAttribute('data-id');
      var p = id ? (pets||[]).find(x => String(x.id)===String(id)) : null;
      if(p) fillCard(card, p);
    });

    try{ if(typeof __updatePuppyDisplay==='function') __updatePuppyDisplay(); }catch(_){}
  }

  window.renderPetsGrid = function(pets){
    if(typeof _origRender === 'function') _origRender(pets);
    enhance(pets||STATE.pets||[]);
  };

  document.addEventListener('DOMContentLoaded', function(){
    if($('#petsGrid')?.children?.length){
      enhance(STATE?.pets||[]);
    }
  });
})();
