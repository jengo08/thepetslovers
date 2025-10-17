/****************************************************
 * TPL · RESERVAS (COMPLETO)
 * Mantiene tu flujo; añade subtipo para EXÓTICOS y
 * ajusta auxiliares extra-guardería (2ª=10, 3ª+=6).
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

/************** Etiquetas **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos:"Visita exóticos",
    exoticos_aves:"Visita exóticos (aves)",
    exoticos_reptiles:"Visita exóticos (reptiles)",
    exoticos_mamiferos:"Visita exóticos (mamíferos)",
    transporte:"Transporte"
  })[s]||s;
}

/************** Config tarifas públicas **************/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD
const PRICES_PUBLIC = {
  paseo: { base:12, extra:8 },
  transporte: { base:20 },
  guarderia: { adult:15, puppy:20, extra2:12, extra3p:8 },
  alojamiento: { std_1_10:30, std_11:28, pup_1_10:35, pup_11:32, segundo_1_10:25, segundo_11:22 },
  visita: { base60_1_10:22, base60_11:18, base90_1_10:30, base90_11:27, med15_1_10:12, med15_11:10,
            extra1:12, extraEach2:8, extraEach3p:6 },
  exoticos: {
    aves: { day_1_10:20, day_11:20 },        // público sin descuento aparte de auxiliar
    reptiles: { day_1_10:20, day_11:20 },
    mamiferos: { first_1_10:25, first_11:22, extra_1_10:20, extra_11:18 }
  }
};

/************** Auxiliares (para margen) **************/
const AUX = {
  guarderia: {
    adult:12, puppy:17,
    extra2:10,      // NUEVO (2ª)
    extra3p:6       // NUEVO (3ª+)
  },
  alojamiento: { std_1_10:25, std_11:22, pup_1_10:30, pup_11:27, segundo_1_10:20, segundo_11:17 },
  paseo: { base:10, extra:5,
           bono10:8, bono15:7.5, bono20:7, bono25:6.5, bono30:6 },
  visita: { base60_1_10:17, base60_11:12, base90_1_10:25, base90_11:21,
            med15_1_10:12, med15_11:10, extra1:10, extraEach2:6, extraEach3p:4 },
  exoticos: {
    aves: { day_1_10:15, day_11:12 },
    reptiles: { day_1_10:15, day_11:12 },
    mamiferos: { first_1_10:20, first_11:18, extra_1_10:14, extra_11:14 }
  },
  transporte: { base:15 },
  suplementos: { urgencia:0, festivo:8, señalado:15 }
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
    'exoticos':'exoticos','exoticos-aves':'exoticos','exoticos-reptiles':'exoticos','exoticos-mamiferos':'exoticos',
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
          castrado: !!(x.castrado || x.esterilizado),
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
    castrado: !!(p.castrado || p.esterilizado),
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
      : `<div class="tpl-pet-thumb" style="display:flex;align-items:center;justify-content:center;background:#f3f4f6"><i class="fa-solid fa-paw"></i></div>`;

    const sexIcon = (String(p.sexo||"").toLowerCase()==="hembra") ? "fa-venus" : (String(p.sexo||"").toLowerCase()==="macho" ? "fa-mars" : "");
    const edadY = (function(b){
      if(!b) return ""; const d=new Date(b); if(isNaN(d)) return "";
      const t=new Date(); let y=t.getFullYear()-d.getFullYear();
      if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
      return (y>=0)? y : "";
    })(p.nacimiento);

    const metaLine = [
      (p.raza||"").trim(),
      (p.especie||"").trim(),
      (edadY!==""? `Edad: ${edadY}` : ""),
      (p.castrado? "Castrado" : "")
    ].filter(Boolean).join(" · ");

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${iconHtml}
      <div class="tpl-pet-meta" data-birth="${p.nacimiento||''}" data-species="${p.especie||''}">
        <div class="tpl-pet-name">${p.nombre||"Mascota"} ${sexIcon?`<i class="fa-solid ${sexIcon}" aria-hidden="true" title="${p.sexo||''}" style="font-size:.9em;opacity:.7"></i>`:""}</div>
        <div class="tpl-pet-sub">${metaLine}</div>
      </div>
    `;
    grid.appendChild(el);
  });

  if(!(pets||[]).length){
    grid.innerHTML = `
      <div class="tpl-pet-item">
        <div style="margin-left:8px"><strong style="color:#666">No hay mascotas en tu perfil</strong>
        <div class="muted">Añádelas en tu perfil para seleccionarlas aquí.</div></div>
      </div>`;
  }

  grid.addEventListener("change", ()=>{
    STATE.selectedPetIds = $$(".pet-check:checked").map(x=>x.dataset.id);
    doRecalc();
  }, { once:true });
}

/************** Recogida de payload **************/
function collectPayload(){
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  // nº mascotas: usa el selector visible según servicio
  const service = $("#serviceType").value;
  const numPets = (service==='exoticos'
    ? parseInt($("#numPets").value||"1",10)
    : parseInt($("#numPetsGeneral").value||"1",10));

  return {
    serviceType: service,
    exoticsType: $("#exoticsType")?.value || null,
    startDate: $("#startDate").value,
    endDate: $("#endDate").value || $("#startDate").value,
    startTime: $("#startTime").value,
    endTime: $("#endTime").value,
    region: $("#region").value,
    address: $("#address").value,
    postalCode: $("#postalCode").value,
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    numPets,
    pets
  };
}

/************** Cálculo + resumen **************/
function calc(payload){
  // Mapear exóticos a sub-servicio interno previo
  let s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  let lines=[], total=0;

  // ===== Paseo =====
  if(s==="paseo"){
    // nº de paseos = nº de días (como acordamos)
    const nPaseos = nDays;
    const base = PRICES_PUBLIC.paseo.base * nPaseos;
    lines.push({label:`Paseo (60’) · ${nPaseos} día(s)`, unit:PRICES_PUBLIC.paseo.base, qty:nPaseos, amount:base});

    // extras por mascota adicional por paseo
    const extras = Math.max(0, (payload.numPets||payload.pets.length||1)-1);
    if(extras>0){
      const add = extras * PRICES_PUBLIC.paseo.extra * nPaseos;
      lines.push({label:`Mascotas adicionales · ${extras} · ${nPaseos} paseo(s)`, unit:PRICES_PUBLIC.paseo.extra, qty:extras*nPaseos, amount:add});
      total += add;
    }
    total += base;
  }

  // ===== Guardería de día =====
  if(s==="guarderia_dia"){
    // 1ª mascota: adulto o cachorro auto (si cualquier perro <6m)
    const anyPuppy = payload.pets.some(p=>{
      if(p.especie!=="perro" || !p.nacimiento) return false;
      const months = (Date.now() - new Date(p.nacimiento).getTime()) / 2629800000;
      return months <= 6;
    });
    const perDay = anyPuppy ? PRICES_PUBLIC.guarderia.puppy : PRICES_PUBLIC.guarderia.adult;
    lines.push({label:`Guardería · 1ª mascota · ${nDays} día(s)`, unit:perDay, qty:nDays, amount:perDay*nDays});
    total += perDay*nDays;

    // 2ª mascota
    const count = Math.max(0,(payload.numPets||payload.pets.length||1)-1);
    if(count>0){
      const second = 1; // solo una "2ª"
      const thirdPlus = Math.max(0, count - second);
      if(second){
        const u=PRICES_PUBLIC.guarderia.extra2;
        const a=u*nDays;
        lines.push({label:`Guardería · 2ª mascota · ${nDays} día(s)`, unit:u, qty:nDays, amount:a});
        total+=a;
      }
      if(thirdPlus>0){
        const u=PRICES_PUBLIC.guarderia.extra3p;
        const a=u*nDays*thirdPlus;
        lines.push({label:`Guardería · ${thirdPlus} mascota(s) extra · ${nDays} día(s)`, unit:u, qty:nDays*thirdPlus, amount:a});
        total+=a;
      }
    }
  }

  // ===== Alojamiento nocturno =====
  if(s==="alojamiento_nocturno"){
    const first = payload.pets[0];
    const firstIsPuppy = first && first.especie==="perro" && first.nacimiento &&
      ( (Date.now()-new Date(first.nacimiento).getTime())/2629800000 <= 6 );

    const days10 = Math.min(10, nDays);
    const days11 = Math.max(0, nDays - 10);

    // 1ª mascota
    const u1_10 = firstIsPuppy ? PRICES_PUBLIC.alojamiento.pup_1_10 : PRICES_PUBLIC.alojamiento.std_1_10;
    const u11   = firstIsPuppy ? PRICES_PUBLIC.alojamiento.pup_11   : PRICES_PUBLIC.alojamiento.std_11;
    if(days10>0){ lines.push({label:`Alojamiento · 1ª mascota · días 1–10`, unit:u1_10, qty:days10, amount:u1_10*days10}); total+=u1_10*days10; }
    if(days11>0){ lines.push({label:`Alojamiento · 1ª mascota · desde día 11`, unit:u11, qty:days11, amount:u11*days11}); total+=u11*days11; }

    // 2ª+ mascotas
    const extraCount=Math.max(0,(payload.numPets||payload.pets.length||1)-1);
    if(extraCount>0){
      const u2_1_10 = PRICES_PUBLIC.alojamiento.segundo_1_10;
      const u2_11   = PRICES_PUBLIC.alojamiento.segundo_11;
      if(days10>0){ const a=u2_1_10*days10*extraCount; lines.push({label:`Alojamiento · ${extraCount} mascota(s) extra · días 1–10`, unit:u2_1_10, qty:days10*extraCount, amount:a}); total+=a; }
      if(days11>0){ const a=u2_11*days11*extraCount; lines.push({label:`Alojamiento · ${extraCount} mascota(s) extra · desde día 11`, unit=u2_11, qty:days11*extraCount, amount:a}); total+=a; }
    }
  }

  // ===== Visita gato =====
  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const days10 = Math.min(10, nDays);
    const days11 = Math.max(0, nDays - 10);

    const base1_10 = use90? PRICES_PUBLIC.visita.base90_1_10 : PRICES_PUBLIC.visita.base60_1_10;
    const base11   = use90? PRICES_PUBLIC.visita.base90_11   : PRICES_PUBLIC.visita.base60_11;

    if(days10>0){ const a=base1_10*days10; lines.push({label:`Visita gato · ${use90?90:60}’ · días 1–10`, unit:base1_10, qty:days10, amount:a}); total+=a; }
    if(days11>0){ const a=base11*days11;   lines.push({label:`Visita gato · ${use90?90:60}’ · desde día 11`, unit:base11, qty:days11, amount:a}); total+=a; }

    // 2ª visita medicación
    if(payload.secondMedVisit==="si"){
      if(days10>0){ const u=PRICES_PUBLIC.visita.med15_1_10, a=u*days10; lines.push({label:`Medicación 15’ · días 1–10`, unit:u, qty:days10, amount:a}); total+=a; }
      if(days11>0){ const u=PRICES_PUBLIC.visita.med15_11,   a=u*days11; lines.push({label:`Medicación 15’ · desde día 11`, unit:u, qty:days11, amount=a}); total+=a; }
    }

    // gatos extra por visita (en base a nº mascotas)
    const cats = Math.max(payload.numPets||payload.pets.length||1, 1);
    const extras = Math.max(0, cats-1);
    if(extras>0){
      // desglosar por tramo
      if(extras===1){
        const u=PRICES_PUBLIC.visita.extra1, a=(nDays*u);
        lines.push({label:`Gato extra (1) · por visita`, unit:u, qty:nDays, amount:a}); total+=a;
      }else if(extras===2){
        const u=PRICES_PUBLIC.visita.extraEach2, a=(nDays*u*2);
        lines.push({label:`Gatos extra (2) · por visita`, unit=u, qty:nDays*2, amount:a}); total+=a;
      }else{
        const u=PRICES_PUBLIC.visita.extraEach3p, a=(nDays*u*extras);
        lines.push({label:`Gatos extra (${extras}) · por visita`, unit=u, qty:nDays*extras, amount:a}); total+=a;
      }
    }
  }

  // ===== Exóticos (subtipo) =====
  if(s==="exoticos"){
    const subtype = (payload.exoticsType||'aves'); // aves | reptiles | mamiferos
    const days10 = Math.min(10, nDays);
    const days11 = Math.max(0, nDays - 10);
    const count = Math.max(1, payload.numPets||payload.pets.length||1);

    if(subtype==='aves' || subtype==='reptiles'){
      const P = PRICES_PUBLIC.exoticos[subtype];
      if(days10>0){ const a=P.day_1_10*days10*count; lines.push({label:`Exóticos (${subtype}) · días 1–10 · ${count} masc.`, unit:P.day_1_10, qty:days10*count, amount:a}); total+=a; }
      if(days11>0){ const a=P.day_11*days11*count;   lines.push({label:`Exóticos (${subtype}) · desde día 11 · ${count} masc.`, unit:P.day_11, qty:days11*count, amount:a}); total+=a; }
    }else{ // mamíferos pequeños
      const P = PRICES_PUBLIC.exoticos.mamiferos;
      // 1ª mascota:
      if(days10>0){ const a=P.first_1_10*days10; lines.push({label:`Exóticos (mamíferos) · 1ª mascota · días 1–10`, unit:P.first_1_10, qty:days10, amount:a}); total+=a; }
      if(days11>0){ const a=P.first_11*days11;   lines.push({label:`Exóticos (mamíferos) · 1ª mascota · desde día 11`, unit:P.first_11, qty:days11, amount:a}); total+=a; }
      // extras:
      const extras=Math.max(0, count-1);
      if(extras>0){
        if(days10>0){ const a=P.extra_1_10*days10*extras; lines.push({label:`Exóticos (mamíferos) · ${extras} extra · días 1–10`, unit:P.extra_1_10, qty:days10*extras, amount:a}); total+=a; }
        if(days11>0){ const a=P.extra_11*days11*extras;   lines.push({label:`Exóticos (mamíferos) · ${extras} extra · desde día 11`, unit:P.extra_11, qty:days11*extras, amount:a}); total+=a; }
      }
    }
  }

  // ===== Transporte =====
  if(s==="transporte"){
    const a=PRICES_PUBLIC.transporte.base;
    lines.push({label:"Transporte", unit:a, qty:1, amount:a});
    total+=a;
  }

  // Días señalados
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  if(big){ lines.push({label:"Día señalado", unit:30, qty:1, amount:30}); total+=30; }

  return { linesPublic:lines, totalPublic:total };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.numPets||payload.pets||[]).length||payload.numPets||0} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    const right = (l.amount!=null) ? fmtMoney(l.amount) : '<span class="muted">—</span>';
    row.innerHTML = `<span>${l.label}${l.unit?` · ${fmtMoney(l.unit)} x ${l.qty}`:""}</span><span>${right}</span>`;
    box.appendChild(row);
  });

  // Tu lógica de “pagar ahora” (mantengo exactamente tu esquema si ya lo tienes):
  // Si tu versión ya calcula margen, aquí puedes sustituir por ese valor.
  const subtotal = calc.totalPublic;
  const payNow   = Math.max(0, subtotal * 0.20);   // << si tu build ya usa margen, ignora esta línea y usa la tuya
  const payLater = Math.max(0, subtotal - payNow); // << idem

  $("#subtotalTxt").textContent = fmtMoney(subtotal);
  $("#payNowTxt").textContent   = fmtMoney(payNow);
  $("#payLaterTxt").textContent = fmtMoney(payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";
  // Mostrar bloque exóticos en HTML (ya gestionado por helpers de la página)

  if(!payload.serviceType || !payload.startDate || !payload.endDate){
    renderSummary({linesPublic:[],totalPublic:0}, payload);
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

/************** Login inline **************/
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
  ["serviceType","exoticsType","startDate","endDate","startTime","endTime","region","address","postalCode","visitDuration","secondMedVisit","numPets","numPetsGeneral"]
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
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", castrado:!!(p.castrado||p.esterilizado), foto:p.foto||"" }))
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
        service: { type: payload.serviceType, exoticsType: payload.exoticsType||null },
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
          // Si tu build ya usa margen: aquí sustituye payNow y payLater
          payNow: Number((c.totalPublic*0.20).toFixed(2)),
          payLater: Number((c.totalPublic*0.80).toFixed(2)),
          currency:"EUR"
        }
      };

      // Guarda una copia local para perfil
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
