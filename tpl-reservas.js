/****************************************************
 * TPL · RESERVAS (COMPLETO)
 * - Autorelleno titular + mascotas (Firestore)
 * - Picker de mascotas (tarjeta horizontal avatar redondo)
 * - Preselección servicio (no si vienes de perfil/mis-reservas)
 * - Cálculo: bonos, tramos ≥11, extras 2ª+, cachorro auto por edad
 * - Desglose detallado con precio unitario × días/paseos
 * - “A pagar ahora” = margen (no se muestra coste interno)
 * - EmailJS opcional
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
function plural(n, s, p){ return (n===1? s : p); }
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

/** Festivos por CCAA (rellena por año para activarlos) **/
const FESTIVOS_CCAA = {
  // "2025": { "Madrid": ["2025-01-06", "2025-03-19", ...], "Andalucía": [...], ... }
};

/************** Etiquetas y precios públicos **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos_aves:"Exóticos (aves)",
    exoticos_reptiles:"Exóticos (reptiles)",
    exoticos_mamiferos:"Exóticos (mamíferos)",
    transporte:"Transporte"
  })[s]||s;
}

// Público (cliente)
const PUB = {
  paseo: { base:12, extra:8, packs:[30,25,20,15,10], packPrice:{10:115,15:168,20:220,25:270,30:318} },
  guarderia: {
    adult:{ perDay:15, packs:{10:135,20:250,30:315} },
    puppy:{ perDay:20, packs:{10:185,20:350,30:465} },
    extra2:12, extra3p:8 // suplementos por día para 2ª y 3ª+
  },
  alojamiento: {
    first:{ std:{d1_10:30, d11:28}, puppy:{d1_10:35, d11:32} },
    extra:{ std:{d1_10:25, d11:22}, puppy:{d1_10:30, d11:28} } // regla especial cachorros
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

// Auxiliar (interno) — se usa solo para “A pagar ahora”
const AUX = {
  guarderia:{
    adult:{ perDay:12, packsPerDay:{10:11,20:10,30:9} },
    puppy:{ perDay:17, packsPerDay:{10:16,20:14,30:12} },
    // extras (2ª/3ª+) se incluyen en per-day suplementario que forma parte del coste base (margen = diferencia)
    extra2:12, extra3p:8 // si quisieras reflejarlo explícitamente
  },
  alojamiento:{
    first:{ std:{d1_10:25, d11:22}, puppy:{d1_10:30, d11:27} },
    extra:{ std:{d1_10:20, d11:17}, puppy:{d1_10:30, d11:27} } // regla cachorros para extras (30/28 cliente ⇒ 30/27 aux ≥11)
  },
  paseo:{ base:10, extra:5, packsPerWalk:{10:8,15:7.5,20:7,25:6.5,30:6} },
  visitaGato:{
    base60:{d1_10:17, d11:12},
    base90:{d1_10:25, d11:21},
    med15:{d1_10:12, d11:10}, // margen 0 en medicación (igual que público)
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
    'exoticos':'exoticos_aves','exoticos-aves':'exoticos_aves','aves':'exoticos_aves',
    'exoticos-reptiles':'exoticos_reptiles','reptiles':'exoticos_reptiles',
    'exoticos-mamiferos':'exoticos_mamiferos','mamiferos':'exoticos_mamiferos',
    'transporte':'transporte'
  };
  const allowed = new Set(Object.values(map));
  if(allowed.has(s)) return s;
  return map[s] || "";
}
function inferServiceFromReferrer(){
  try{
    const r = document.referrer ? new URL(document.referrer) : null;
    if(!r) return "";
    const p = (r.pathname || "").toLowerCase();
    if(/perfil|reservas|mis-reservas/.test(p)) return ""; // no preseleccionar
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
          castrado: x.castrado===true || x.esterilizado===true || x.castrada===true,
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
    castrado: !!(p.castrado===true || p.esterilizado===true || p.castrada===true),
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

function cap(s){ s=String(s||''); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }
function ageYears(birth){
  if(!birth) return "";
  const d = new Date(birth); if(isNaN(d)) return "";
  const t = new Date();
  const years = t.getFullYear() - d.getFullYear()
              - ((t.getMonth()<d.getMonth()) || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate()) ? 1 : 0);
  return years>=0 ? String(years) : "";
}

function renderPetsGrid(pets){
  const grid=$("#petsGrid");
  grid.innerHTML="";

  (pets||[]).forEach(p=>{
    const iconHtml = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="tpl-pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    const years = ageYears(p.nacimiento);
    const sexoSymbol = (String(p.sexo).toLowerCase()==='hembra')?'♀':(String(p.sexo).toLowerCase()==='macho'?'♂':'');
    const subBits = [
      p.raza||'',
      cap(p.especie||''),
      years?(`Edad: ${years}`):'',
      p.castrado?'Castrado':'',
      sexoSymbol
    ].filter(Boolean).join(' · ');

    el.innerHTML = `
      <input type="checkbox" class="pet-check" data-id="${p.id}">
      ${iconHtml}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub">${subBits}</div>
      </div>
    `;
    // Para helpers de cachorro
    if(p.nacimiento) el.setAttribute('data-birth', p.nacimiento);
    if(p.especie)    el.setAttribute('data-species', String(p.especie).toLowerCase());
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
    doRecalc();
  }, { once:true });
}

/************** Recogida de payload **************/
function collectPayload(){
  const petsSel = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  const numOverride = parseInt($("#numPets")?.value||"1",10);
  return {
    serviceType: $("#serviceType").value,
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
    pets: petsSel,
    numPetsOverride: isNaN(numOverride)?1:Math.max(1,numOverride)
  };
}

/************** Util: pack/bono greedy descompone unidades en bonos + sueltos **************/
function applyPacks(units, packDefs){ // packDefs: {packs:[30,25,20,15,10], packPrice:{10:115,...}}
  let left = units, lines=[], cost=0;
  const sizes = [...packDefs.packs].sort((a,b)=>b-a);
  for(const sz of sizes){
    const price = packDefs.packPrice[sz];
    const n = Math.floor(left / sz);
    if(n>0){
      lines.push({ label:`Bono ${sz}`, qty:n, unit:price, total:n*price });
      cost += n*price; left -= n*sz;
    }
  }
  // sueltos
  return { lines, leftover:left, cost };
}

/************** Cálculo + resumen **************/
function anyPuppy(pets){
  return pets.some(p=>{
    if(p.especie!=="perro" || !p.nacimiento) return false;
    const months = (Date.now() - new Date(p.nacimiento).getTime()) / 2629800000;
    return months <= 6;
  });
}

function festivosCCAAinRange(start, end, region){
  const y = (parseDate(start)||new Date()).getFullYear();
  const arr = (FESTIVOS_CCAA[String(y)]||{})[String(region)||""] || [];
  const s = parseDate(start)?.getTime()||0;
  const e = parseDate(end  )?.getTime()||0;
  return arr.filter(d=>{ const t=new Date(d).getTime(); return t>=s && t<=e; });
}

function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const petsCountSelected = (payload.pets||[]).length || 0;
  const nPets = Math.max(1, payload.numPetsOverride || petsCountSelected || 1);
  const long = nDays>=11;
  let lines=[], auxLines=[], totalPub=0, totalAux=0;

  // Helpers para añadir línea con detalle unitario × días
  function pushLine(label, qty, unit, scope="pub"){
    const total = qty*unit;
    const htmlLabel = `<div class="desc">${label}<br><small>${qty} × ${fmtMoney(unit)}</small></div>`;
    lines.push({ html: htmlLabel, amount: total });
    if(scope==="both" || scope==="aux"){
      auxLines.push({ label, qty, unit, total });
    }
    totalPub += total;
  }
  function pushAux(label, qty, unit){
    auxLines.push({ label, qty, unit, total: qty*unit });
    totalAux += qty*unit;
  }

  // ========== SERVICIOS ==========
  if(s==="paseo"){
    const firstUnits = nDays; // 1 paseo por día
    // Bono solo para 1ª mascota
    const pack = applyPacks(firstUnits, PUB.paseo);
    // líneas bonos
    pack.lines.forEach(l=>{
      pushLine(`Paseos · 1ª mascota · Bono ${l.qty? (l.qty>1?`${l.qty}× ${l.label}`:l.label):l.label}`, 1, l.total);
      // Aux: por pack precio por paseo
      const perWalk = AUX.paseo.packsPerWalk[parseInt(l.label.split(" ")[1],10)];
      pushAux(`AUX Paseos 1ª · ${l.label}`, parseInt(l.label.split(" ")[1],10)*l.qty, perWalk);
    });
    // sueltos 1ª
    if(pack.leftover>0){
      pushLine(`Paseos · 1ª mascota · sueltos`, pack.leftover, PUB.paseo.base);
      pushAux(`AUX Paseos 1ª · sueltos`, pack.leftover, AUX.paseo.base);
    }
    // Extras 2ª+ por paseo
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      pushLine(`Paseos · ${extras} mascota(s) extra`, extras*firstUnits, PUB.paseo.extra);
      pushAux(`AUX Paseos extra`, extras*firstUnits, AUX.paseo.extra);
    }
  }

  if(s==="guarderia_dia"){
    const isPuppyFirst = anyPuppy(payload.pets);
    const conf = isPuppyFirst ? PUB.guarderia.puppy : PUB.guarderia.adult;
    const auxConf = isPuppyFirst ? AUX.guarderia.puppy : AUX.guarderia.adult;

    // Bonos SOLO 1ª mascota
    const pack = applyPacks(nDays, { packs:[30,20,10], packPrice:conf.packs });
    pack.lines.forEach(l=>{
      pushLine(`Guardería · 1ª mascota · ${l.label}`, 1, l.total);
      const perDayAux = auxConf.packsPerDay[parseInt(l.label.split(" ")[1],10)];
      pushAux(`AUX Guardería 1ª · ${l.label}`, parseInt(l.label.split(" ")[1],10), perDayAux);
    });
    // Sueltos 1ª
    if(pack.leftover>0){
      pushLine(`Guardería · 1ª mascota · sueltos`, pack.leftover, conf.perDay);
      pushAux(`AUX Guardería 1ª · sueltos`, pack.leftover, auxConf.perDay);
    }

    // Suplementos 2ª+ (no aplican bonos)
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      const unit2 = PUB.guarderia.extra2;
      const unit3 = PUB.guarderia.extra3p;
      // 1 extra (2ª)
      const e2 = Math.min(1, extras);
      if(e2>0){
        pushLine(`Guardería · 2ª mascota (suplemento)`, nDays*e2, unit2);
        pushAux(`AUX Guardería extra 2ª`, nDays*e2, unit2); // margen = diferencia con público si la quieres neta, aquí igual para claridad
      }
      // 3ª+ si las hay
      const e3p = Math.max(0, extras-1);
      if(e3p>0){
        pushLine(`Guardería · ${e3p} mascota(s) extra (suplemento)`, nDays*e3p, unit3);
        pushAux(`AUX Guardería extra 3ª+`, nDays*e3p, unit3);
      }
    }
  }

  if(s==="alojamiento_nocturno"){
    const hasPuppy = anyPuppy(payload.pets);
    const firstUnit = hasPuppy ? (long?PUB.alojamiento.first.puppy.d11:PUB.alojamiento.first.puppy.d1_10)
                               : (long?PUB.alojamiento.first.std.d11 :PUB.alojamiento.first.std.d1_10);
    // 1ª mascota: dividir en tramos
    if(nDays<=10){
      pushLine(`Alojamiento · 1ª mascota · ${nDays} ${plural(nDays,'día','días')}`, nDays, firstUnit);
      pushAux(`AUX Aloja 1ª · d1-10`, nDays, hasPuppy?AUX.alojamiento.first.puppy.d1_10:AUX.alojamiento.first.std.d1_10);
    }else{
      pushLine(`Alojamiento · 1ª mascota · 1–10`, 10, hasPuppy?PUB.alojamiento.first.puppy.d1_10:PUB.alojamiento.first.std.d1_10);
      pushLine(`Alojamiento · 1ª mascota · desde 11`, nDays-10, hasPuppy?PUB.alojamiento.first.puppy.d11:PUB.alojamiento.first.std.d11);
      pushAux(`AUX Aloja 1ª · 1–10`, 10, hasPuppy?AUX.alojamiento.first.puppy.d1_10:AUX.alojamiento.first.std.d1_10);
      pushAux(`AUX Aloja 1ª · ≥11`, nDays-10, hasPuppy?AUX.alojamiento.first.puppy.d11:AUX.alojamiento.first.std.d11);
    }

    // Extras
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      // Regla cachorros: extras 30 → 28 desde 11
      const unit10 = hasPuppy? PUB.alojamiento.extra.puppy.d1_10 : PUB.alojamiento.extra.std.d1_10;
      const unit11 = hasPuppy? PUB.alojamiento.extra.puppy.d11   : PUB.alojamiento.extra.std.d11;
      if(nDays<=10){
        pushLine(`Alojamiento · ${extras} mascota(s) extra · ${nDays} ${plural(nDays,'día','días')}`, extras*nDays, unit10);
        pushAux(`AUX Aloja extras · d1-10`, extras*nDays, hasPuppy?AUX.alojamiento.extra.puppy.d1_10:AUX.alojamiento.extra.std.d1_10);
      }else{
        pushLine(`Alojamiento · ${extras} mascota(s) extra · 1–10`, extras*10, unit10);
        pushLine(`Alojamiento · ${extras} mascota(s) extra · desde 11`, extras*(nDays-10), unit11);
        pushAux(`AUX Aloja extras · 1–10`, extras*10, hasPuppy?AUX.alojamiento.extra.puppy.d1_10:AUX.alojamiento.extra.std.d1_10);
        pushAux(`AUX Aloja extras · ≥11`, extras*(nDays-10), hasPuppy?AUX.alojamiento.extra.puppy.d11:AUX.alojamiento.extra.std.d11);
      }
    }
  }

  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const basePub = use90 ? (long?PUB.visitaGato.base90.d11:PUB.visitaGato.base90.d1_10)
                          : (long?PUB.visitaGato.base60.d11:PUB.visitaGato.base60.d1_10);
    const baseAux = use90 ? (long?AUX.visitaGato.base90.d11:AUX.visitaGato.base90.d1_10)
                          : (long?AUX.visitaGato.base60.d11:AUX.visitaGato.base60.d1_10);
    pushLine(`Visita gato · ${use90?90:60}’`, nDays, basePub);
    pushAux(`AUX Visita gato · ${use90?90:60}’`, nDays, baseAux);

    if(payload.secondMedVisit==="si"){
      const medP = long?PUB.visitaGato.med15.d11:PUB.visitaGato.med15.d1_10;
      const medA = long?AUX.visitaGato.med15.d11:AUX.visitaGato.med15.d1_10;
      pushLine(`2ª visita medicación 15’`, nDays, medP);
      pushAux(`AUX Med 15’`, nDays, medA);
    }

    // Nº de gatos
    const catsSel = payload.pets.filter(p=>p.especie==="gato").length || nPets;
    const extraCats = Math.max(0, catsSel-1);
    if(extraCats>0){
      let perCat=0, auxPer=0;
      if(extraCats===1){ perCat = PUB.visitaGato.extrasPerVisit.oneExtra; auxPer=AUX.visitaGato.extrasPerVisit.oneExtra; }
      else if(extraCats===2){ perCat = PUB.visitaGato.extrasPerVisit.twoEach; auxPer=AUX.visitaGato.extrasPerVisit.twoEach; }
      else { perCat = PUB.visitaGato.extrasPerVisit.threePlusEach; auxPer=AUX.visitaGato.extrasPerVisit.threePlusEach; }
      pushLine(`Gatos extra (${extraCats})`, nDays*extraCats, perCat);
      pushAux(`AUX Gatos extra`, nDays*extraCats, auxPer);
    }
  }

  if(s==="exoticos_aves" || s==="exoticos_reptiles" || s==="exoticos_mamiferos"){
    if(s==="exoticos_mamiferos"){
      const first = long?PUB.exoticos.mamiferos.first.d11:PUB.exoticos.mamiferos.first.d1_10;
      const firstAux = long?AUX.exoticos.mamiferos.first.d11:AUX.exoticos.mamiferos.first.d1_10;
      pushLine(`Exóticos · Mamífero · 1ª mascota`, nDays, first);
      pushAux(`AUX Exóticos Mam · 1ª`, nDays, firstAux);
      const extras = Math.max(0, nPets-1);
      if(extras>0){
        const ext = long?PUB.exoticos.mamiferos.extra.d11:PUB.exoticos.mamiferos.extra.d1_10;
        const extA= long?AUX.exoticos.mamiferos.extra.d11:AUX.exoticos.mamiferos.extra.d1_10;
        pushLine(`Exóticos · Mamífero · ${extras} mascota(s) extra`, extras*nDays, ext);
        pushAux(`AUX Exóticos Mam · extras`, extras*nDays, extA);
      }
    }else{
      const base = long?PUB.exoticos.aves.d11:PUB.exoticos.aves.d1_10; // aves=reptiles igual
      const baseA= long?AUX.exoticos.aves.d11:AUX.exoticos.aves.d1_10;
      const kind = s==="exoticos_aves"?"Ave":"Reptil";
      pushLine(`Exóticos · ${kind}`, nDays, base);
      pushAux(`AUX Exóticos ${kind}`, nDays, baseA);
      // Sin suplementos por 2ª+
    }
  }

  if(s==="transporte"){
    pushLine(`Transporte`, 1, PUB.transporte.base);
    pushAux(`AUX Transporte`, 1, AUX.transporte.base);
  }

  // ===== Suplementos globales =====
  // Días señalados fijos
  const isBig = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  if(isBig){
    pushLine(`Día señalado`, 1, PUB.suplementos.diaSeñalado);
    pushAux(`AUX Día señalado`, 1, AUX.suplementos.diaSeñalado);
  }
  // Festivos CCAA (si hay tabla)
  const fest = festivosCCAAinRange(payload.startDate, payload.endDate, payload.region);
  if(Array.isArray(fest) && fest.length){
    pushLine(`Festivo (${payload.region})`, fest.length, PUB.suplementos.festivo);
    pushAux(`AUX Festivo`, fest.length, AUX.suplementos.festivo);
  }

  // ===== Totales y márgenes =====
  totalAux = auxLines.reduce((a,x)=>a+x.total,0);
  const payNow   = Math.max(0, totalPub - totalAux); // margen
  const payLater = Math.max(0, totalPub - payNow);

  return { linesPublic:lines, totalPublic:totalPub, payNow, payLater };
}

function renderSummary(calc, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""} · ${(payload.pets||[]).length||payload.numPetsOverride||0} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `${l.html}<span>${fmtMoney(l.amount)}</span>`;
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
    summaryField: JSON.stringify(reservation.pricing.breakdownPublic?.map(l=>`${l.label||''}`) || [], null, 2),

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
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","visitDuration","secondMedVisit","numPets"]
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
      STATE.owner = owner;
      fillOwner(owner||{});

      // Mezcla mascotas firestore + locales (evitar duplicados)
      const localPets = udbGet("pets", []) || udbGet("mascotas", []) || [];
      const merged = [
        ...(pets||[]),
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"", castrado:!!(p.castrado||p.esterilizado||p.castrada), foto:p.foto||"" }))
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
      if(!STATE.selectedPetIds.length && payload.numPetsOverride<1){
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
          breakdownPublic: [], // (render ya muestra toda la info)
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
