/****************************************************
 * TPL · RESERVAS (COMPLETO · remaquetado)
 * - Mantiene IDs y flujo actual
 * - Autorelleno titular + mascotas (Firestore y local)
 * - Picker de mascotas (tarjetas con checkbox, mini avatar redondo, info extendida)
 * - Preselección de servicio desde ?service= / ?svc= o referrer (NO si vienes de perfil)
 * - Cálculo y resumen (Subtotal / Pagar ahora[margen] / Pendiente)
 * - Bonos y tramos desde día 11 (todas las reglas que definimos)
 * - Login inline
 * - Guarda localmente la reserva (para perfil)
 * - EmailJS opcional (respeta tu config)
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
function yearsFrom(birth){
  if(!birth) return "";
  const d=new Date(birth); if(isNaN(d)) return "";
  const t=new Date();
  let y=t.getFullYear()-d.getFullYear();
  if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
  return y<0?"":String(y);
}

/************** Precios públicos **************/
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

// Públicos
const PUB = {
  paseo: { base:12, extra:8 }, // por paseo
  guarderia: {
    adult: 15, puppy: 20,
    bonos: { // precio pack total
      adult: {10:135, 20:250, 30:315},
      puppy: {10:185, 20:350, 30:465}
    }
  },
  alojamiento: {
    first: { std_1_10:30, std_11:28, pup_1_10:35, pup_11:32 },
    extra: { _1_10:25, _11:22 } // 2ª+ mascota
  },
  gato: {
    base60_1_10:22, base60_11:18,
    base90_1_10:30, base90_11:27,
    med15_1_10:12,  med15_11:10,
    extraCats: { one:12, twoEach:8, threePlusEach:6 }
  },
  exoticos: { // servicio único + selector tipo
    aves:       { _1_10:20, _11:18, extra:false },
    reptiles:   { _1_10:20, _11:18, extra:false },
    mamiferos:  { first_1_10:25, first_11:22, extra_1_10:20, extra_11:18 }
  },
  transporte: { base:20 },
  suplementos: {
    urgencia: 10,
    festivo: 10,
    big: 30
  }
};

// Auxiliares (para margen)
const AUX = {
  paseo: { base:10, extra:5, bonos:{10:8,15:7.5,20:7,25:6.5,30:6} }, // por paseo
  guarderia: {
    adult:12, puppy:17,
    bonos: { // coste por día dentro de bono
      adult:{10:11,20:10,30:9},
      puppy:{10:16,20:14,30:12}
    }
  },
  alojamiento: {
    first: { std_1_10:25, std_11:22, pup_1_10:30, pup_11:27 },
    extra: { _1_10:20, _11:17 }
  },
  gato: {
    base60_1_10:17, base60_11:12,
    base90_1_10:25, base90_11:21,
    med15_1_10:12,  med15_11:10, // margen 0 en med
    extraCats: { one:10, twoEach:6, threePlusEach:4 }
  },
  exoticos: {
    aves:      { _1_10:15, _11:12, extra:false },
    reptiles:  { _1_10:15, _11:12, extra:false },
    mamiferos: { first_1_10:20, first_11:18, extra_1_10:14, extra_11:14 } // 2ª+ = 14 en ambos tramos
  },
  transporte: { base:15 },
  suplementos: {
    festivo: 8,  // del +10 público → +2 margen
    big: 15,     // del +30 público → +15 margen
    urgencia: 0  // +10 íntegro a margen
  }
};

/************** Servicio: etiquetas **************/
function labelService(s){
  return ({
    guarderia_dia:"Guardería de día",
    alojamiento_nocturno:"Alojamiento nocturno",
    paseo:"Paseo",
    visita_gato:"Visita gato",
    exoticos:"Visita exóticos",
    transporte:"Transporte"
  })[s]||s;
}
function labelExotic(t){
  return ({aves:"Aves", reptiles:"Reptiles", mamiferos:"Pequeños mamíferos"})[t]||"";
}

/************** Preselección de servicio **************/
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
function inferFromReferrer(){
  try{
    if(!document.referrer) return {svc:"",ex:""};
    const r = new URL(document.referrer);
    const p = (r.pathname||"").toLowerCase();
    if(/perfil|reservas/.test(p)) return {svc:"",ex:""}; // NO preseleccionar desde perfil
    if(/paseo|paseos/.test(p)) return {svc:'paseo',ex:""};
    if(/guarderia/.test(p)) return {svc:'guarderia_dia',ex:""};
    if(/estancia|estancias|alojamiento|noche|nocturn/.test(p)) return {svc:'alojamiento_nocturno',ex:""};
    if(/visita/.test(p) && /gato/.test(p)) return {svc:'visita_gato',ex:""};
    if(/exotico|exoticos/.test(p)){
      let ex="";
      if(/ave|aves/.test(p)) ex="aves";
      else if(/reptil|reptiles/.test(p)) ex="reptiles";
      else if(/mamifer/.test(p)) ex="mamiferos";
      return {svc:'exoticos',ex};
    }
    if(/transporte/.test(p)) return {svc:'transporte',ex:""};
  }catch(_){}
  return {svc:"",ex:""};
}
function preselectService(){
  const sel = $("#serviceType"); if(!sel) return;
  const qs = new URLSearchParams(location.search);
  let raw = qs.get('service') || qs.get('svc');

  // NO preseleccionar si vienes de perfil
  const ref = inferFromReferrer();
  if(!raw && ref.svc==="") {
    sel.value = ""; return;
  }

  if(!raw && ref.svc) raw = ref.svc;
  const canon = canonicalizeService(raw);
  if(canon && [...sel.options].some(o=>o.value===canon)){ sel.value = canon; }

  // Tipo exótico desde referrer si aplica
  if(canon==='exoticos' && ref.ex){
    $("#exoticType").value = ref.ex;
  }

  // Mostrar/ocultar controles dependientes
  const ev = new Event('change'); sel.dispatchEvent(ev);
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
          castrado: (x.castrado ?? x.esterilizado ?? x.esterilizada ?? false),
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
    castrado: (p.castrado ?? p.esterilizado ?? p.esterilizada ?? false),
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
    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.innerHTML = `
      ${iconHtml}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"}</div>
        <div class="tpl-pet-sub"></div>
      </div>
      <input type="checkbox" class="pet-check" data-id="${p.id}">
    `;
    // data-* para lógicas
    if(p.nacimiento) el.dataset.birth = p.nacimiento;
    if(p.especie)    el.dataset.species = (p.especie||"").toLowerCase();
    if(p.sexo)       el.dataset.sex = (p.sexo||"").toLowerCase();
    if(p.castrado)   el.dataset.castrado = String(!!p.castrado);
    grid.appendChild(el);

    // rellenar sublínea (edad / raza / sexo / castrado)
    const sub = el.querySelector('.tpl-pet-sub');
    const edadY = yearsFrom(p.nacimiento);
    const sexoSym = (p.sexo||"").toLowerCase()==='hembra' ? '♀' :
                    (p.sexo||"").toLowerCase()==='macho'  ? '♂' : '';
    const bits=[];
    if(p.raza) bits.push(p.raza);
    if(edadY!=="") bits.push(`Edad: ${edadY}`);
    if(sexoSym) bits.push(sexoSym);
    if(p.castrado===true) bits.push('Castrado');
    sub.textContent = bits.join(' · ');
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
    __updatePuppyDisplay();
    doRecalc();
  }, { once:true });
}

/************** Cachorro (solo lectura en “Datos del servicio”) **************/
function __updatePuppyDisplay(){
  const disp = $("#isPuppyDisplay"); if(!disp) return;
  const svc = $("#serviceType").value;
  if(!(svc==='paseo'||svc==='guarderia_dia'||svc==='alojamiento_nocturno')){
    disp.value='no'; return;
  }
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
  let any=false;
  pets.forEach(p=>{
    if((p.especie||"").toLowerCase()==='perro' && p.nacimiento){
      const d=new Date(p.nacimiento);
      if(!isNaN(d)){
        const t=new Date();
        const months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
        if(months<=6) any=true;
      }
    }
  });
  disp.value = any?'si':'no';
}

/************** Recogida de payload **************/
function collectPayload(){
  const pets = STATE.pets.filter(p=>STATE.selectedPetIds.includes(p.id));
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
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    isPuppy: $("#isPuppyDisplay")?.value==='si',
    pets
  };
}

/************** Util bonos guardería **************/
function splitGuarderiaByBonos(nDays, isPuppy){
  // Devuelve [{label, qty, priceUnit, total}] combinando 30→20→10 + resto suelto
  const bonos = isPuppy ? PUB.guarderia.bonos.puppy : PUB.guarderia.bonos.adult;
  const dayPrice = isPuppy ? PUB.guarderia.puppy : PUB.guarderia.adult;

  let remaining = nDays;
  const blocks=[];
  const tryPack = (size)=>{
    while(remaining>=size){
      blocks.push({type:'pack', size, total:bonos[size]});
      remaining -= size;
    }
  };
  [30,20,10].forEach(tryPack);
  if(remaining>0){
    blocks.push({type:'sueltos', size:remaining, priceUnit:dayPrice, total:dayPrice*remaining});
  }
  return blocks;
}

/************** Cálculo + resumen (público y auxiliar) **************/
function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const long = nDays>=11;
  const nPets = (payload.pets||[]).length||0;

  const lines=[], auxLines=[];
  let total=0, auxTotal=0;

  // Suplementos big days (se aplican una sola vez por reserva → lo dejamos para el final con la fecha)
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));

  if(s==="paseo"){
    const nPaseos = 1; // si luego añades campo “nº paseos”, cámbialo aquí
    // 1ª mascota
    const baseUnit = PUB.paseo.base;
    lines.push({label:`Paseo (60’) · 1ª mascota · ${nPaseos} paseo(s) · ${fmtMoney(baseUnit)}`, amount:baseUnit*nPaseos});
    total += baseUnit*nPaseos;
    // Aux
    auxLines.push({label:`(aux) Paseo · 1ª mascota · ${nPaseos}`, amount:AUX.paseo.base*nPaseos});
    auxTotal += AUX.paseo.base*nPaseos;

    // 2ª+ mascota(s)
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      const extraUnit = PUB.paseo.extra;
      lines.push({label:`Paseo (60’) · ${extras} mascota(s) extra · ${nPaseos} paseo(s) · ${fmtMoney(extraUnit)}`, amount:extraUnit*extras*nPaseos});
      total += extraUnit*extras*nPaseos;

      auxLines.push({label:`(aux) Paseo · ${extras} mascota(s) extra · ${nPaseos}`, amount:AUX.paseo.extra*extras*nPaseos});
      auxTotal += AUX.paseo.extra*extras*nPaseos;
    }
  }

  if(s==="guarderia_dia"){
    // cachorro si CUALQUIERA de las mascotas seleccionadas lo es
    const anyPuppy = payload.isPuppy===true;
    const packs = splitGuarderiaByBonos(nDays, anyPuppy);
    packs.forEach(pk=>{
      if(pk.type==='pack'){
        lines.push({label:`Guardería · bono ${pk.size} días`, amount:pk.total});
        // Aux coste día dentro de bono
        const auxDay = anyPuppy ? AUX.guarderia.bonos.puppy[pk.size] : AUX.guarderia.bonos.adult[pk.size];
        auxLines.push({label:`(aux) Guardería · bono ${pk.size} × ${pk.size}d · ${fmtMoney(auxDay)}/d`, amount:auxDay*pk.size});
        total += pk.total;
        auxTotal += auxDay*pk.size;
      }else{
        lines.push({label:`Guardería · ${pk.size} día(s) · ${fmtMoney(pk.priceUnit)}/día`, amount:pk.total});
        const auxDay = anyPuppy ? AUX.guarderia.puppy : AUX.guarderia.adult;
        auxLines.push({label:`(aux) Guardería · ${pk.size} día(s)`, amount:auxDay*pk.size});
        total += pk.total;
        auxTotal += auxDay*pk.size;
      }
    });
  }

  if(s==="alojamiento_nocturno"){
    // 1ª mascota: distinguir puppy si la 1ª seleccionada es cachorro
    const first = payload.pets[0];
    const isFirstPuppy = !!(first && (first.especie||"")==="perro" && first.nacimiento && yearsFrom(first.nacimiento)==="0");
    // Tramos 1–10 y ≥11
    const d1_10 = Math.min(10, nDays);
    const d11   = Math.max(0, nDays-10);

    // 1ª mascota
    const unitFirst_1_10 = isFirstPuppy ? PUB.alojamiento.first.pup_1_10 : PUB.alojamiento.first.std_1_10;
    const unitFirst_11   = isFirstPuppy ? PUB.alojamiento.first.pup_11   : PUB.alojamiento.first.std_11;
    if(d1_10>0){
      lines.push({label:`Alojamiento · 1ª mascota · ${d1_10} día(s) · ${fmtMoney(unitFirst_1_10)}`, amount: unitFirst_1_10*d1_10});
      auxLines.push({label:`(aux) Alojamiento · 1ª · ${d1_10}`, amount:(isFirstPuppy?AUX.alojamiento.first.pup_1_10:AUX.alojamiento.first.std_1_10)*d1_10});
      total += unitFirst_1_10*d1_10;
      auxTotal += (isFirstPuppy?AUX.alojamiento.first.pup_1_10:AUX.alojamiento.first.std_1_10)*d1_10;
    }
    if(d11>0){
      lines.push({label:`Alojamiento · 1ª mascota · ${d11} día(s) · ${fmtMoney(unitFirst_11)}`, amount: unitFirst_11*d11});
      auxLines.push({label:`(aux) Alojamiento · 1ª · ${d11}`, amount:(isFirstPuppy?AUX.alojamiento.first.pup_11:AUX.alojamiento.first.std_11)*d11});
      total += unitFirst_11*d11;
      auxTotal += (isFirstPuppy?AUX.alojamiento.first.pup_11:AUX.alojamiento.first.std_11)*d11;
    }

    // 2ª+ mascota(s)
    const extras = Math.max(0, nPets-1);
    if(extras>0){
      const unitExtra_1_10 = PUB.alojamiento.extra._1_10;
      const unitExtra_11   = PUB.alojamiento.extra._11;
      if(d1_10>0){
        lines.push({label:`Alojamiento · ${extras} mascota(s) extra · ${d1_10} día(s) · ${fmtMoney(unitExtra_1_10)}`, amount: unitExtra_1_10*extras*d1_10});
        auxLines.push({label:`(aux) Alojamiento · extra(${extras}) · ${d1_10}`, amount:AUX.alojamiento.extra._1_10*extras*d1_10});
        total += unitExtra_1_10*extras*d1_10;
        auxTotal += AUX.alojamiento.extra._1_10*extras*d1_10;
      }
      if(d11>0){
        lines.push({label:`Alojamiento · ${extras} mascota(s) extra · ${d11} día(s) · ${fmtMoney(unitExtra_11)}`, amount: unitExtra_11*extras*d11});
        auxLines.push({label:`(aux) Alojamiento · extra(${extras}) · ${d11}`, amount:AUX.alojamiento.extra._11*extras*d11});
        total += unitExtra_11*extras*d11;
        auxTotal += AUX.alojamiento.extra._11*extras*d11;
      }
    }
  }

  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const d1_10 = Math.min(10, nDays);
    const d11   = Math.max(0, nDays-10);

    const pubUnit_1_10 = use90?PUB.gato.base90_1_10:PUB.gato.base60_1_10;
    const pubUnit_11   = use90?PUB.gato.base90_11  :PUB.gato.base60_11;
    const auxUnit_1_10 = use90?AUX.gato.base90_1_10:AUX.gato.base60_1_10;
    const auxUnit_11   = use90?AUX.gato.base90_11  :AUX.gato.base60_11;

    if(d1_10>0){
      lines.push({label:`Visita gato · ${use90?90:60}’ · 1–10 · ${d1_10} día(s) · ${fmtMoney(pubUnit_1_10)}`, amount:pubUnit_1_10*d1_10});
      auxLines.push({label:`(aux) Visita gato · 1–10 · ${d1_10}`, amount:auxUnit_1_10*d1_10});
      total += pubUnit_1_10*d1_10; auxTotal += auxUnit_1_10*d1_10;
    }
    if(d11>0){
      lines.push({label:`Visita gato · ${use90?90:60}’ · ≥11 · ${d11} día(s) · ${fmtMoney(pubUnit_11)}`, amount:pubUnit_11*d11});
      auxLines.push({label:`(aux) Visita gato · ≥11 · ${d11}`, amount:auxUnit_11*d11});
      total += pubUnit_11*d11; auxTotal += auxUnit_11*d11;
    }

    // segunda medicación (opcional)
    if(payload.secondMedVisit==="si"){
      const med1 = PUB.gato.med15_1_10, med2 = PUB.gato.med15_11;
      const auxM1 = AUX.gato.med15_1_10, auxM2 = AUX.gato.med15_11; // margen 0 (mismos importes)
      if(d1_10>0){
        lines.push({label:`2ª visita medicación 15’ · 1–10 · ${d1_10} día(s) · ${fmtMoney(med1)}`, amount:med1*d1_10});
        auxLines.push({label:`(aux) Med 15’ · 1–10 · ${d1_10}`, amount:auxM1*d1_10});
        total += med1*d1_10; auxTotal += auxM1*d1_10;
      }
      if(d11>0){
        lines.push({label:`2ª visita medicación 15’ · ≥11 · ${d11} día(s) · ${fmtMoney(med2)}`, amount:med2*d11});
        auxLines.push({label:`(aux) Med 15’ · ≥11 · ${d11}`, amount:auxM2*d11});
        total += med2*d11; auxTotal += auxM2*d11;
      }
    }

    // gatos extra por visita (por día)
    const cats = payload.pets.filter(p=>(p.especie||"").toLowerCase()==='gato').length || nPets || 1;
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      function perExtra(n){
        if(n===1) return PUB.gato.extraCats.one;
        if(n===2) return 2*PUB.gato.extraCats.twoEach;
        return n*PUB.gato.extraCats.threePlusEach;
      }
      const auxPerExtra = (n)=>{
        if(n===1) return AUX.gato.extraCats.one;
        if(n===2) return 2*AUX.gato.extraCats.twoEach;
        return n*AUX.gato.extraCats.threePlusEach;
      };
      if(d1_10>0){
        lines.push({label:`Gatos extra (${extraCats}) · 1–10 · ${d1_10} día(s)`, amount:perExtra(extraCats)*d1_10});
        auxLines.push({label:`(aux) Gatos extra (${extraCats}) · 1–10 · ${d1_10}`, amount:auxPerExtra(extraCats)*d1_10});
        total += perExtra(extraCats)*d1_10; auxTotal += auxPerExtra(extraCats)*d1_10;
      }
      if(d11>0){
        lines.push({label:`Gatos extra (${extraCats}) · ≥11 · ${d11} día(s)`, amount:perExtra(extraCats)*d11});
        auxLines.push({label:`(aux) Gatos extra (${extraCats}) · ≥11 · ${d11}`, amount:auxPerExtra(extraCats)*d11});
        total += perExtra(extraCats)*d11; auxTotal += auxPerExtra(extraCats)*d11;
      }
    }
  }

  if(s==="exoticos"){
    const t = payload.exoticType||"";
    if(!t){
      lines.push({label:`Visita exóticos · selecciona el tipo`, amount:0});
    }else{
      const d1_10 = Math.min(10, nDays);
      const d11   = Math.max(0, nDays-10);
      const nExtra = Math.max(0, nPets-1);

      if(t==='aves' || t==='reptiles'){
        // sin 2ª+ mascota
        if(d1_10>0){
          lines.push({label:`Exóticos · ${labelExotic(t)} · 1–10 · ${d1_10} día(s) · ${fmtMoney(PUB.exoticos[t]._1_10)}`, amount:PUB.exoticos[t]._1_10*d1_10});
          auxLines.push({label:`(aux) Exóticos · ${labelExotic(t)} · 1–10 · ${d1_10}`, amount:AUX.exoticos[t]._1_10*d1_10});
          total += PUB.exoticos[t]._1_10*d1_10; auxTotal += AUX.exoticos[t]._1_10*d1_10;
        }
        if(d11>0){
          lines.push({label:`Exóticos · ${labelExotic(t)} · ≥11 · ${d11} día(s) · ${fmtMoney(PUB.exoticos[t]._11)}`, amount:PUB.exoticos[t]._11*d11});
          auxLines.push({label:`(aux) Exóticos · ${labelExotic(t)} · ≥11 · ${d11}`, amount:AUX.exoticos[t]._11*d11});
          total += PUB.exoticos[t]._11*d11; auxTotal += AUX.exoticos[t]._11*d11;
        }
      }
      if(t==='mamiferos'){
        // 1ª mascota
        if(d1_10>0){
          lines.push({label:`Exóticos · Peq. mamíferos · 1ª mascota · 1–10 · ${d1_10} día(s) · ${fmtMoney(PUB.exoticos.mamiferos.first_1_10)}`, amount:PUB.exoticos.mamiferos.first_1_10*d1_10});
          auxLines.push({label:`(aux) Exóticos · 1ª · 1–10 · ${d1_10}`, amount:AUX.exoticos.mamiferos.first_1_10*d1_10});
          total += PUB.exoticos.mamiferos.first_1_10*d1_10; auxTotal += AUX.exoticos.mamiferos.first_1_10*d1_10;
        }
        if(d11>0){
          lines.push({label:`Exóticos · Peq. mamíferos · 1ª mascota · ≥11 · ${d11} día(s) · ${fmtMoney(PUB.exoticos.mamiferos.first_11)}`, amount:PUB.exoticos.mamiferos.first_11*d11});
          auxLines.push({label:`(aux) Exóticos · 1ª · ≥11 · ${d11}`, amount:AUX.exoticos.mamiferos.first_11*d11});
          total += PUB.exoticos.mamiferos.first_11*d11; auxTotal += AUX.exoticos.mamiferos.first_11*d11;
        }
        // 2ª+ mascota
        if(nExtra>0){
          if(d1_10>0){
            lines.push({label:`Exóticos · ${nExtra} mascota(s) extra · 1–10 · ${d1_10} día(s) · ${fmtMoney(PUB.exoticos.mamiferos.extra_1_10)}`, amount:PUB.exoticos.mamiferos.extra_1_10*nExtra*d1_10});
            auxLines.push({label:`(aux) Exóticos · extra(${nExtra}) · 1–10 · ${d1_10}`, amount:AUX.exoticos.mamiferos.extra_1_10*nExtra*d1_10});
            total += PUB.exoticos.mamiferos.extra_1_10*nExtra*d1_10; auxTotal += AUX.exoticos.mamiferos.extra_1_10*nExtra*d1_10;
          }
          if(d11>0){
            lines.push({label:`Exóticos · ${nExtra} mascota(s) extra · ≥11 · ${d11} día(s) · ${fmtMoney(PUB.exoticos.mamiferos.extra_11)}`, amount:PUB.exoticos.mamiferos.extra_11*nExtra*d11});
            auxLines.push({label:`(aux) Exóticos · extra(${nExtra}) · ≥11 · ${d11}`, amount:AUX.exoticos.mamiferos.extra_11*nExtra*d11});
            total += PUB.exoticos.mamiferos.extra_11*nExtra*d11; auxTotal += AUX.exoticos.mamiferos.extra_11*nExtra*d11;
          }
        }
      }
    }
  }

  if(s==="transporte"){
    lines.push({label:"Transporte", amount:PUB.transporte.base});
    auxLines.push({label:"(aux) Transporte", amount:AUX.transporte.base});
    total += PUB.transporte.base; auxTotal += AUX.transporte.base;
  }

  // Suplementos globales (cliente) y aux
  if(big){ lines.push({label:"Día señalado", amount:PUB.suplementos.big}); total+=PUB.suplementos.big;
           auxLines.push({label:"(aux) Día señalado", amount:AUX.suplementos.big}); auxTotal+=AUX.suplementos.big; }

  // Urgencia: si quisieras activarlo por UI, aquí sumaría +10 cliente y +0 aux (todo margen).
  // Festivo normal: +10 cliente, +8 aux. (Añade triggers según UI cuando lo habilites)

  const payNow   = Math.max(0, total - auxTotal);  // tu margen
  const payLater = Math.max(0, total - payNow);    // coste aux (cobro 12 días antes)
  return { linesPublic:lines, totalPublic:total, payNow, payLater };
}

function renderSummary(calc, payload){
  const svc = labelService(payload.serviceType);
  const ctxBits=[svc];
  if(payload.serviceType==='exoticos' && payload.exoticType) ctxBits.push(labelExotic(payload.exoticType));
  if(payload.startDate) ctxBits.push(payload.startDate+(payload.endDate?(" — "+payload.endDate):""));
  if(payload.startTime) ctxBits.push(payload.startTime + (payload.endTime?("–"+payload.endTime):""));
  ctxBits.push(`${(payload.pets||[]).length||0} mascota(s)`);
  $("#summaryContext").textContent = ctxBits.filter(Boolean).join(" · ");

  const box=$("#summaryLines"); box.innerHTML="";
  calc.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span class="desc">${l.label}</span><span>${fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calc.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calc.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calc.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  // Mostrar/ocultar grupos
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";
  $("#exoticTypeRow").style.display    = (payload.serviceType==="exoticos") ? "" : "none";

  // “Cachorro” display auto
  __updatePuppyDisplay();

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
    service: svc + (reservation.service.exoticType?` · ${labelExotic(reservation.service.exoticType)}`:""),
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

  // Preselección
  preselectService();

  // Binds de recálculo
  ["serviceType","exoticType","startDate","endDate","startTime","endTime","region","address","postalCode","visitDuration","secondMedVisit"]
    .forEach(id=>{ const el=$("#"+id); if(el) el.addEventListener("input", doRecalc); });
  $("#serviceType")?.addEventListener("change", ()=>{ doRecalc(); });

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
          id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(),
          nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:p.sexo||p.genero||"",
          castrado:(p.castrado ?? p.esterilizado ?? p.esterilizada ?? false),
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

    // Mostrar controles según preselección
    $("#visitCatControls").style.display = ($("#serviceType").value==="visita_gato") ? "" : "none";
    $("#exoticTypeRow").style.display    = ($("#serviceType").value==="exoticos") ? "" : "none";

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
      if(payload.serviceType==='exoticos' && !payload.exoticType){
        alert("Selecciona el tipo de exótico."); return;
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
          breakdownPublic: c.linesPublic,
          totalClient: Number(c.totalPublic.toFixed(2)),
          payNow: Number(c.payNow.toFixed(2)),      // margen
          payLater: Number(c.payLater.toFixed(2)),  // coste auxiliar (12 días antes)
          currency:"EUR"
        }
      };

      // Guarda copia local para perfil
      try{
        const key="tpl.reservas";
        const list = JSON.parse(localStorage.getItem(key)||"[]");
        list.unshift(reservation);
        localStorage.setItem(key, JSON.stringify(list));
      }catch(_){}

      // Emails (opcional)
      try{ await sendEmails(reservation); }catch(_){}

      // UI gracias
      $("#reservaForm").style.display="none";
      $("#thanks").style.display="block";
    });
  });
});
