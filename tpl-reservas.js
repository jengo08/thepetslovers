/****************************************************
 * TPL · RESERVAS (COMPLETO · para reservas.html)
 * Ajustes pedidos:
 * - EXÓTICOS (aves/reptiles): desde día 11 → 18 € público y margen 3 € (aux 15 €).
 * - Mantengo que NO haya suplemento por 2ª+ mascota en aves/reptiles.
 * - Si “Desplazamiento = Sí”: además de la línea “pendiente”, muestro aviso en el resumen.
 * - Resto tal cual (bonos, desgloses, tarjetas, overlay, etc.).
 ****************************************************/

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
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos:"Servicio exóticos",
    transporte:"Transporte"
  })[s]||s;
}
function labelExotic(t){
  return ({ aves:"Aves", reptiles:"Reptiles", mamiferos:"Pequeños mamíferos" }[t]||"");
}

/* ====== Tarifas públicas ====== */
const PUB = {
  paseo: { base:12, extra:8 },
  transporte: { base:20 },
  guarderia: {
    suelto: { adult:15, puppy:20 },
    bonos: {
      adult: { d10:13.5, d20:12.5, d30:10.5 },
      puppy: { d10:18.5, d20:17.5, d30:15.5 }
    },
    extra: { second:12, thirdPlus:8 }
  },
  alojamiento: {
    std:   { d1_10:30, d11:28 },
    puppy: { d1_10:35, d11:32 },
    second:{ d1_10:25, d11:22 }
  },
  visitaGato: {
    base60: { d1_10:22, d11:18 },
    base90: { d1_10:30, d11:27 },
    med15:  { d1_10:12, d11:10 },
    extrasPorGato: { one:12, twoEach:8, threePlusEach:6 }
  },
  exoticos: {
    aves:      { base:{ d1_10:20, d11:18 } },
    reptiles:  { base:{ d1_10:20, d11:18 } },
    mamiferos: { first:{ d1_10:25, d11:22 }, extra:{ d1_10:20, d11:18 } }
  }
};
/* ====== Costes auxiliar ====== */
const AUX = {
  paseo: { base:10, extra:5,
    bonos:{ d10:8, d15:7.5, d20:7, d25:6.5, d30:6 }
  },
  transporte: { base:15 },
  guarderia: {
    suelto: { adult:12, puppy:17 },
    bonos: {
      adult:{ d10:11, d20:10, d30:9 },
      puppy:{ d10:16, d20:14, d30:12 }
    },
    extra: { second:10, thirdPlus:6 }
  },
  alojamiento: {
    std:   { d1_10:25, d11:22 },
    puppy: { d1_10:30, d11:27 },
    second:{ d1_10:20, d11:17 }
  },
  visitaGato: {
    base60: { d1_10:17, d11:12 },
    base90: { d1_10:25, d11:21 },
    med15:  { d1_10:12, d11:10 },
    extrasPorGato: { one:10, twoEach:6, threePlusEach:4 }
  },
  exoticos: {
    aves: { base:{ d1_10:15, d11:15 } },
    reptiles: { base:{ d1_10:15, d11:15 } },
    mamiferos: {
      first:{ d1_10:20, d11:18 },
      extra:{ d1_10:14, d11:14 }
    }
  },
  suplementos: {
    urgencia:{ pub:10, aux:0 },
    festivo:{ pub:10, aux:8 },
    senalado:{ pub:30, aux:15 },
    transporte:{ pub:20, aux:15 }
  }
};

/* ====== Helpers bonos ====== */
function splitDaysForBonos(n){
  const res = { d30:0, d20:0, d10:0, suelto:0 };
  if(n<=0) return res;
  res.d30 = Math.floor(n/30); n = n%30;
  res.d20 = Math.floor(n/20); n = n%20;
  res.d10 = Math.floor(n/10); n = n%10;
  res.suelto = n;
  return res;
}
function splitWalks(n){
  const res = { d30:0, d25:0, d20:0, d15:0, d10:0, suelto:0 };
  if(n<=0) return res;
  res.d30 = Math.floor(n/30); n%=30;
  res.d25 = Math.floor(n/25); n%=25;
  res.d20 = Math.floor(n/20); n%=20;
  res.d15 = Math.floor(n/15); n%=15;
  res.d10 = Math.floor(n/10); n%=10;
  res.suelto = n;
  return res;
}

/* ====== Preselección ====== */
function canonicalizeService(raw){
  if(!raw) return "";
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const map = {
    'paseo':'paseo','paseos':'paseo',
    'guarderia':'guarderia_dia','guarderia-de-dia':'guarderia_dia','guarderia_dia':'guarderia_dia',
    'alojamiento':'alojamiento_nocturno','estancias':'alojamiento_nocturno','nocturnas':'alojamiento_nocturno','estancias-nocturnas':'alojamiento_nocturno',
    'visitas':'visita_gato','visita-gato':'visita_gato','visita':'visita_gato',
    'exoticos':'exoticos','exoticos-aves':'exoticos','aves':'exoticos',
    'exoticos-reptiles':'exoticos','reptiles':'exoticos',
    'exoticos-mamiferos':'exoticos','mamiferos':'exoticos',
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
    if(/paseo|paseos/.test(p)) return 'paseo';
    if(/guarderia/.test(p)) return 'guarderia_dia';
    if(/estancia|estancias|alojamiento|noche|nocturn/.test(p)) return 'alojamiento_nocturno';
    if(/visita/.test(p) && /gato/.test(p)) return 'visita_gato';
    if(/exotico|exoticos/.test(p)) return 'exoticos';
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
  if(canon){ el.value = canon; }
}

/* ====== Auth ====== */
function onAuth(cb){
  try{ return firebase.auth().onAuthStateChanged(cb); }
  catch(_){ cb(null); return ()=>{}; }
}

/* ====== Firestore owner + pets ====== */
async function readOwnerAndPets(uid){
  const db=firebase.firestore();
  async function readDoc(coll){
    try{
      const snap = await db.collection(coll).doc(uid).get();
      return snap.exists ? {ref:snap.ref, data:snap.data()||{}, coll} : null;
    }catch(e){ console.warn(`[perfil] error leyendo ${coll}`, e); return null; }
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
          castrado: x.castrado===true || String(x.castrado).toLowerCase()==='si',
          foto: x.foto || x.img || ""
        };
      });
    }catch(e){ console.warn("[perfil] subcolección 'mascotas' inaccesible:", e); }
  }

  pets = pets.map((p,i)=>({
    id: p.id || p.uid || String(i+1),
    nombre: p.nombre || p.name || "Mascota",
    especie: (p.especie || p.tipo || "").toLowerCase(),
    nacimiento: p.nacimiento || p.birthdate || "",
    raza: p.raza || p.tipoExotico || "",
    sexo: p.sexo || p.genero || "",
    castrado: p.castrado===true || String(p.castrado||"").toLowerCase()==='si',
    foto: p.foto || p.img || ""
  }));

  return { owner:{ fullName, email, phone, region, address, postalCode:postal }, pets };
}

/* ====== LocalStorage helpers ====== */
function getUID(){
  try{ return firebase.auth().currentUser?.uid || localStorage.getItem('tpl_auth_uid') || 'default'; }
  catch(_){ return 'default'; }
}
function udbKey(k){ return `tpl.udb.${getUID()}.${k}`; }
function udbGet(k,fb){ try{ const v=localStorage.getItem(udbKey(k)); return v?JSON.parse(v):fb; }catch(_){ return fb; } }

/* ====== Owner UI ====== */
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
  $("#email").value = owner.email || ""
  $("#phone").value = owner.phone || "";
  setSelectValue("region", owner.region || "");
  $("#address").value = owner.address || "";
  $("#postalCode").value = owner.postalCode || "";
}

/* ====== Estado + tarjetas mascotas ====== */
const STATE = { owner:null, pets:[], selectedPetIds:[] };

function calcYears(birth){
  if(!birth) return null;
  const d=new Date(birth); if(isNaN(d)) return null;
  const t=new Date();
  let y = t.getFullYear()-d.getFullYear();
  if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
  return Math.max(0,y);
}
function sexToSymbol(sex){
  const s=String(sex||"").toLowerCase();
  if(/hembra|fema|female|♀/.test(s)) return "♀";
  if(/macho|male|♂/.test(s)) return "♂";
  return "";
}
function renderPetsGrid(pets){
  const grid=$("#petsGrid");
  grid.innerHTML="";

  (pets||[]).forEach(p=>{
    const thumb = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<img class="tpl-pet-thumb" alt="-" src="data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns=\\"http://www.w3.org/2000/svg\\" width=\\"80\\" height=\\"80\\"><circle cx=\\"40\\" cy=\\"40\\" r=\\"38\\" fill=\\"#fff\\" stroke=\\"#eee\\"/><text x=\\"40\\" y=\\"49\\" font-size=\\"26\\" text-anchor=\\"middle\\" fill=\\"#9aa0a6\\">🐾</text></svg>')}">`;

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${thumb}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub"></div>
      </div>
    `;
    const bits=[];
    if(p.raza) bits.push(p.raza);
    if(p.especie) bits.push(p.especie);
    const age = calcYears(p.nacimiento);
    if(age!==null){ bits.push(age===0 ? "Edad: <1" : `Edad: ${age}`); }
    const sexSym = sexToSymbol(p.sexo);
    if(sexSym) bits.push(sexSym);
    if(p.castrado) bits.push("Castrado");
    el.querySelector('.tpl-pet-sub').innerHTML = bits.join(" · ");

    if(p.nacimiento) el.setAttribute('data-birth', p.nacimiento);
    if(p.especie)    el.setAttribute('data-species', String(p.especie).toLowerCase());
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
    doRecalc();
  }, { once:true });
}

/* ====== Payload ====== */
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
    exoticType: $("#exoticType")?.value || "aves",
    numPetsSelect: parseInt($("#numPets")?.value||"1",10),
    pets
  };
}

/* ====== Cálculo ====== */
function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const nSel = (payload.pets||[]).length;
  const nPets = Math.max(nSel || payload.numPetsSelect || 1, 1);

  let lines=[], totalPub=0, totalAux=0;

  function pushLine(label, qty, unitPub, unitAux, note){
    const pub = qty*unitPub;
    const aux = qty*unitAux;
    lines.push({label, qty, unitPub, unitAux, amountPub:pub, amountAux:aux, note});
    totalPub += pub; totalAux += aux;
  }

  // Días señalados fijos
  const bigCount = (()=>{
    if(!parseDate(payload.startDate)||!parseDate(payload.endDate)) return 0;
    let c=0;
    for(let i=0;i<nDays;i++){
      const d=new Date(parseDate(payload.startDate)); d.setDate(d.getDate()+i);
      if(BIG_DAYS.includes(fmtMD(d.toISOString()))) c++;
    }
    return c;
  })();
  if(bigCount>0){
    pushLine("Día señalado", bigCount, AUX.suplementos.senalado.pub, AUX.suplementos.senalado.aux);
  }

  if(s==="paseo"){
    const packs = splitWalks(nDays);
    if(packs.d30) pushLine("Paseos (30) · 1ª mascota", 30*packs.d30, 10.6, AUX.paseo.bonos.d30);
    if(packs.d25) pushLine("Paseos (25) · 1ª mascota", 25*packs.d25, 10.8, AUX.paseo.bonos.d25);
    if(packs.d20) pushLine("Paseos (20) · 1ª mascota", 20*packs.d20, 11.0, AUX.paseo.bonos.d20);
    if(packs.d15) pushLine("Paseos (15) · 1ª mascota", 15*packs.d15, 11.2, AUX.paseo.bonos.d15);
    if(packs.d10) pushLine("Paseos (10) · 1ª mascota", 10*packs.d10, 11.5, AUX.paseo.bonos.d10);
    if(packs.suelto) pushLine(`Paseos sueltos (${packs.suelto}) · 1ª mascota`, packs.suelto, PUB.paseo.base, AUX.paseo.base);
    const extras = Math.max(0, nPets-1);
    if(extras>0) pushLine(`Mascotas extra (${extras}) · ${nDays} paseo(s)`, nDays*extras, PUB.paseo.extra, AUX.paseo.extra);
  }

  if(s==="guarderia_dia"){
    const anyPuppy = (payload.pets||[]).some(p=>{
      if(p.especie!=="perro" || !p.nacimiento) return false;
      const months = (Date.now()-new Date(p.nacimiento).getTime())/2629800000;
      return months<=6;
    });
    const kind = anyPuppy ? "puppy" : "adult";
    const packs = splitDaysForBonos(nDays);
    if(packs.d30) pushLine(`Guardería · bono 30 · 1ª mascota (${packs.d30*30} día(s))`, packs.d30*30, PUB.guarderia.bonos[kind].d30, AUX.guarderia.bonos[kind].d30);
    if(packs.d20) pushLine(`Guardería · bono 20 · 1ª mascota (${packs.d20*20} día(s))`, packs.d20*20, PUB.guarderia.bonos[kind].d20, AUX.guarderia.bonos[kind].d20);
    if(packs.d10) pushLine(`Guardería · bono 10 · 1ª mascota (${packs.d10*10} día(s))`, packs.d10*10, PUB.guarderia.bonos[kind].d10, AUX.guarderia.bonos[kind].d10);
    if(packs.suelto) pushLine(`Guardería · suelto · 1ª mascota (${packs.suelto} día(s))`, packs.suelto, PUB.guarderia.suelto[kind], AUX.guarderia.suelto[kind]);
    const second = (nPets>=2)?1:0;
    const rest   = Math.max(0, nPets-2);
    if(second) pushLine(`Guardería · 2ª mascota (${nDays} día(s))`, nDays, PUB.guarderia.extra.second, AUX.guarderia.extra.second);
    if(rest>0) pushLine(`Guardería · ${rest} mascota(s) extra (${nDays} día(s))`, nDays*rest, PUB.guarderia.extra.thirdPlus, AUX.guarderia.extra.thirdPlus);
  }

  if(s==="alojamiento_nocturno"){
    const d1 = Math.min(nDays, 10);
    const d2 = Math.max(0, nDays-10);
    const first = (payload.pets||[])[0];
    const firstIsPuppy = !!(first && first.especie==="perro" && first.nacimiento &&
      ((Date.now()-new Date(first.nacimiento).getTime())/2629800000 <= 6));
    const prv = firstIsPuppy ? PUB.alojamiento.puppy : PUB.alojamiento.std;
    const ax  = firstIsPuppy ? AUX.alojamiento.puppy : AUX.alojamiento.std;

    if(d1) pushLine(`Alojamiento · 1ª mascota · ${d1} día(s) · 1–10`, d1, prv.d1_10, ax.d1_10);
    if(d2) pushLine(`Alojamiento · 1ª mascota · ${d2} día(s) · ≥11`,  d2, prv.d11,   ax.d11);

    const extras = Math.max(0, nPets-1);
    if(extras>0){
      if(d1) pushLine(`Alojamiento · ${extras} mascota(s) extra · ${d1} día(s) · 1–10`, d1*extras, PUB.alojamiento.second.d1_10, AUX.alojamiento.second.d1_10);
      if(d2) pushLine(`Alojamiento · ${extras} mascota(s) extra · ${d2} día(s) · ≥11`,  d2*extras, PUB.alojamiento.second.d11,   AUX.alojamiento.second.d11);
    }
  }

  if(s==="visita_gato"){
    const use90 = $("#visitDuration")?.value==="90";
    const d1 = Math.min(nDays,10), d2=Math.max(0,nDays-10);
    const basePub = use90? PUB.visitaGato.base90 : PUB.visitaGato.base60;
    const baseAux = use90? AUX.visitaGato.base90 : AUX.visitaGato.base60;

    if(d1) pushLine(`Visita gato ${use90?90:60}’ · 1–10`, d1, basePub.d1_10, baseAux.d1_10);
    if(d2) pushLine(`Visita gato ${use90?90:60}’ · ≥11`,  d2, basePub.d11,   baseAux.d11);

    if($("#secondMedVisit")?.value==="si"){
      if(d1) pushLine(`2ª visita medicación 15’ · 1–10`, d1, PUB.visitaGato.med15.d1_10, AUX.visitaGato.med15.d1_10);
      if(d2) pushLine(`2ª visita medicación 15’ · ≥11`,  d2, PUB.visitaGato.med15.d11,   AUX.visitaGato.med15.d11);
    }

    const cats = (payload.pets||[]).filter(p=>p.especie==="gato").length || nPets;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      const per = extraCats===1 ? {pub:12, aux:10}
                 : extraCats===2 ? {pub:8,  aux:6}
                 :                  {pub:6,  aux:4};
      pushLine(`Gatos extra (${extraCats}) · ${nDays} día(s)`, nDays*extraCats, per.pub, per.aux);
    }
  }

  if(s==="exoticos"){
    const kind = ($("#exoticType")?.value || "aves");
    const d1 = Math.min(nDays,10), d2=Math.max(0,nDays-10);

    if(kind==="aves" || kind==="reptiles"){
      // SIN suplemento 2ª+ mascota (precio por visita)
      const pr = PUB.exoticos[kind].base, ax=AUX.exoticos[kind].base;
      if(d1) pushLine(`Exóticos (${labelExotic(kind)}) · 1–10`, d1, pr.d1_10, ax.d1_10);
      if(d2) pushLine(`Exóticos (${labelExotic(kind)}) · ≥11`,  d2, pr.d11,   ax.d11);
    }else{
      if(d1) pushLine(`Exóticos (Pequeños mamíferos) · 1ª mascota · 1–10`, d1, PUB.exoticos.mamiferos.first.d1_10, AUX.exoticos.mamiferos.first.d1_10);
      if(d2) pushLine(`Exóticos (Pequeños mamíferos) · 1ª mascota · ≥11`,  d2, PUB.exoticos.mamiferos.first.d11,   AUX.exoticos.mamiferos.first.d11);
      const extras = Math.max(0, nPets-1);
      if(extras>0){
        if(d1) pushLine(`Exóticos (Pequeños mamíferos) · ${extras} mascota(s) extra · 1–10`, d1*extras, PUB.exoticos.mamiferos.extra.d1_10, AUX.exoticos.mamiferos.extra.d1_10);
        if(d2) pushLine(`Exóticos (Pequeños mamíferos) · ${extras} mascota(s) extra · ≥11`,  d2*extras, PUB.exoticos.mamiferos.extra.d11,   AUX.exoticos.mamiferos.extra.d11);
      }
    }
  }

  if(s==="transporte"){
    pushLine("Transporte", 1, PUB.transporte.base, AUX.transporte.base);
  }

  // Desplazamiento “pendiente”
  if(payload.travelNeeded==="si"){
    lines.push({label:"Desplazamiento", qty:1, unitPub:0, unitAux:0, amountPub:0, amountAux:0, note:"pendiente"});
  }

  const payNow   = Math.max(0, totalPub - totalAux);
  const payLater = Math.max(0, totalPub - payNow);
  return { lines, totalPub, totalAux, payNow, payLater };
}

function renderSummary(c, payload){
  const extraCtx = payload.serviceType==="exoticos" ? ` · ${labelExotic(payload.exoticType)}` : "";
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)}${extraCtx} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length||payload.numPetsSelect||0} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  c.lines.forEach(l=>{
    const priceTxt = l.note ? `<span class="note">pendiente</span>`
                   : `${fmtMoney(l.amountPub)} <span class="note">(${l.qty} × ${fmtMoney(l.unitPub)})</span>`;
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span>${l.label}</span><span>${priceTxt}</span>`;
    box.appendChild(row);
  });

  // Aviso extra si hay desplazamiento
  if(payload.travelNeeded==="si"){
    const info=document.createElement("div");
    info.className="line";
    info.innerHTML = `<span class="note">El desplazamiento no se podrá calcular hasta confirmar el auxiliar que mejor se adapta a tus necesidades.</span><span></span>`;
    box.appendChild(info);
  }

  $("#subtotalTxt").textContent = fmtMoney(c.totalPub);
  $("#payNowTxt").textContent   = fmtMoney(c.payNow);
  $("#payLaterTxt").textContent = fmtMoney(c.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";
  const exo = $("#exoticControls"); if(exo) exo.style.display = (payload.serviceType==="exoticos") ? "" : "none";

  if(!payload.serviceType || !payload.startDate || !payload.endDate){
    renderSummary({lines:[],totalPub:0,totalAux:0,payNow:0,payLater:0}, payload);
    return;
  }
  const c = calc(payload);
  renderSummary(c, payload);
}

/* ====== EmailJS (única plantilla; cliente + gestión) con fallback REST ====== */
async function sendEmails(reservation){
  if(!window.TPL_EMAILJS || !TPL_EMAILJS.enabled) return;

  const vars = {
    reserva_id: reservation.id,
    _estado: reservation.status || "paid_review",

    service: (()=>{
      const svc = reservation.service?.type || "";
      const exo = reservation.service?.exoticType ? (" · " + reservation.service.exoticType) : "";
      return (svc + exo) || "—";
    })(),

    startDate: reservation.dates?.startDate || "",
    endDate: reservation.dates?.endDate || reservation.dates?.startDate || "",
    Hora_inicio: reservation.dates?.startTime || "",
    Hora_fin: reservation.dates?.endTime || "",

    firstName: reservation.owner?.fullName || "",
    email: reservation.owner?.email || "",
    phone: reservation.owner?.phone || "",
    region: reservation.region || $("#region")?.value || "",
    address: reservation.owner?.address || "",
    postalCode: reservation.owner?.postalCode || "",

    species: (reservation.pets||[]).map(p=>p.nombre||"Mascota").join(", ") || "—",

    summaryField: JSON.stringify(
      (reservation.pricing?.breakdownPublic||[]).map(l=>{
        const amount = (l.amount!=null) ? `${Number(l.amount).toFixed(2).replace('.',',')}€` : "";
        return amount ? `${l.label}: ${amount}` : l.label;
      }),
      null, 2
    ),

    total_cliente: reservation.pricing?.totalClient ?? 0,
    pagar_ahora:   reservation.pricing?.payNow ?? 0,
    pendiente:     reservation.pricing?.payLater ?? 0,

    total_txt:     (reservation.pricing?.totalClient!=null ? reservation.pricing.totalClient.toFixed(2).replace('.',',')+' €' : '—'),
    pay_now_txt:   (reservation.pricing?.payNow!=null   ? reservation.pricing.payNow.toFixed(2).replace('.',',')+' €'   : '—'),
    pay_later_txt: (reservation.pricing?.payLater!=null ? reservation.pricing.payLater.toFixed(2).replace('.',',')+' €' : '—'),

    observations: $("#notes")?.value || "",

    _uid:   (firebase?.auth?.().currentUser?.uid)   || "",
    _email: (firebase?.auth?.().currentUser?.email) || ""
  };

  async function sendWithSDK(to_email, to_name){
    if(!window.emailjs) throw new Error("SDK not loaded");
    try{ if(TPL_EMAILJS.publicKey){ emailjs.init(TPL_EMAILJS.publicKey); } }catch(_){}
    return emailjs.send(
      TPL_EMAILJS.serviceId,
      TPL_EMAILJS.templateId,
      { to_email, to_name, ...vars }
    );
  }

  async function sendWithREST(to_email, to_name){
    const payload = {
      service_id: TPL_EMAILJS.serviceId,
      template_id: TPL_EMAILJS.templateId,
      user_id: TPL_EMAILJS.publicKey,
      template_params: { to_email, to_name, ...vars }
    };
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if(!res.ok){
      const txt = await res.text().catch(()=>res.statusText);
      throw new Error("REST send failed: "+txt);
    }
    return res.text();
  }

  const toClient  = { to_email: vars.email, to_name: vars.firstName || "Cliente" };
  const toAdmin   = { to_email: TPL_EMAILJS.adminEmail || "gestion@thepetslovers.es", to_name: "Gestión The Pets Lovers" };

  // Cliente
  try{
    if(window.emailjs) await sendWithSDK(toClient.to_email, toClient.to_name);
    else await sendWithREST(toClient.to_email, toClient.to_name);
    console.log("[EmailJS] Cliente OK");
  }catch(err1){
    console.warn("[EmailJS] Cliente SDK error, intento REST…", err1);
    try{
      await sendWithREST(toClient.to_email, toClient.to_name);
      console.log("[EmailJS] Cliente OK (REST)");
    }catch(err2){
      console.error("[EmailJS] Cliente FALLÓ", err2);
    }
  }

  // Gestión
  try{
    if(window.emailjs) await sendWithSDK(toAdmin.to_email, toAdmin.to_name);
    else await sendWithREST(toAdmin.to_email, toAdmin.to_name);
    console.log("[EmailJS] Gestión OK");
  }catch(err1){
    console.warn("[EmailJS] Gestión SDK error, intento REST…", err1);
    try{
      await sendWithREST(toAdmin.to_email, toAdmin.to_name);
      console.log("[EmailJS] Gestión OK (REST)");
    }catch(err2){
      console.error("[EmailJS] Gestión FALLÓ", err2);
    }
  }
}

/* ====== INIT ====== */
window.addEventListener("load", ()=>{
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

  preselectService();

  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","travelNeeded","visitDuration","secondMedVisit","exoticType","numPets"]
    .forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input", doRecalc); });

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

    try{
      let {owner, pets} = await readOwnerAndPets(u.uid);
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

      const localPets = udbGet("pets", []) || udbGet("mascotas", []) || [];
      const merged = [
        ...(pets||[]),
        ...localPets.map((p,i)=>({
          id:p.id||`loc_${i}`, nombre:p.nombre,
          especie:(p.especie||p.tipo||"").toLowerCase(),
          nacimiento:p.nacimiento||p.birthdate||"",
          raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"",
          castrado: p.castrado===true || String(p.castrado||"").toLowerCase()==='si',
          foto:p.foto||""
        }))
      ];
      const seen=new Set();
      STATE.pets = merged.filter(p=>{
        const key = `${(p.nombre||"").toLowerCase()}|${p.especie||""}`;
        if(seen.has(key)) return false; seen.add(key); return true;
      });

      renderPetsGrid(STATE.pets);
    }catch(e){ console.warn("[init] owner/pets", e); }

    $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";
    const exo = $("#exoticControls"); if(exo) exo.style.display = ($("#serviceType").value==="exoticos") ? "" : "none";

    doRecalc();

    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      if(!STATE.selectedPetIds.length && payload.serviceType!=="exoticos"){
        alert("Elige al menos una mascota."); return;
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
          breakdownPublic: c.lines.map(l=>({label:l.label, qty:l.qty, unit:l.unitPub, amount:l.amountPub})),
          totalClient: Number(c.totalPub.toFixed(2)),
          payNow: Number(c.payNow.toFixed(2)),
          payLater: Number(c.payLater.toFixed(2)),
          currency:"EUR"
        }
      };

      try{
        const key="tpl.reservas";
        const list = JSON.parse(localStorage.getItem(key)||"[]");
        list.unshift(reservation);
        localStorage.setItem(key, JSON.stringify(list));
      }catch(_){}

      try{ await sendEmails(reservation); }catch(_){}

      const ov=$("#overlay"); if(ov) ov.style.display="flex";
    });
  });
});
