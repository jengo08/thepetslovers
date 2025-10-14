/****************************************************
 * TPL · RESERVAS (COMPLETO · actualizado)
 * - Mantiene IDs y comportamiento del flujo actual
 * - Tarjetas de mascota horizontales mini (sin tocar tu estética global)
 * - Bonos/Tramos/Extras según tus reglas (guardería, alojamiento, paseos, gato, exóticos)
 * - “A pagar ahora” = Subtotal − coste auxiliar (tablas internas)
 * - Preselección servicio: solo por ?service/svc o referrer de /servicios (no desde perfil)
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
const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // MM-DD

function labelService(s){
  return ({ guarderia_dia:"Guardería de día", alojamiento_nocturno:"Alojamiento nocturno",
            paseo:"Paseo", visita_gato:"Visita gato", exoticos:"Exóticos", transporte:"Transporte" })[s]||s;
}

/************** Precios Públicos **************/
const PRICES_PUBLIC = {
  paseo: { base:12, extra:8 }, // por paseo/día
  guarderia: {
    adultDay:15, puppyDay:20,
    extra2:12, extra3p:8,
    bonos:{ adult:{10:135,20:250,30:315}, puppy:{10:185,20:350,30:465} }
  },
  alojamiento: {
    std:{d1_10:30, d11p:28},
    puppy:{d1_10:35, d11p:32},
    extra:{d1_10:25, d11p:22},
    extraIfPuppy:{d1_10:30, d11p:28} // si hay cachorro y ≥2 mascotas (tu regla)
  },
  visita_gato:{
    base60:{d1_10:22, d11p:18},
    base90:{d1_10:30, d11p:27},
    med15 :{d1_10:12, d11p:10},
    extraCats: { one:12, twoEach:8, threePlusEach:6 }
  },
  exoticos:{
    aves:{d1_10:20, d11p:18, extra:false},
    reptiles:{d1_10:20, d11p:18, extra:false},
    mamiferos:{d1_10:25, d11p:22, extra2p:{d1_10:20, d11p:18}} // 2ª+ masc para peq. mamíferos
  },
  transporte:{ base:20 },
  suplementos:{ festivo:10, big:30, urgencia:10 }
};

/************** Costes Auxiliares (internos) **************/
const PRICES_AUX = {
  paseo:{ base:10, extra:5 }, // por paseo/día
  guarderia:{
    adultDay:12, puppyDay:17,
    extra2:12, extra3p:8, // auxiliar igual que público para extras diarios
    bonos:{ adult:{10:11,20:10,30:9}, puppy:{10:16,20:14,30:12} } // €/día efectivos en bono
  },
  alojamiento:{
    std:{d1_10:25, d11p:22},
    puppy:{d1_10:30, d11p:27},
    extra:{d1_10:20, d11p:17},
    extraIfPuppy:{d1_10:30, d11p:28} // tu pauta para grupos con cachorro
  },
  visita_gato:{
    base60:{d1_10:17, d11p:12},
    base90:{d1_10:25, d11p:21},
    med15 :{d1_10:10, d11p:10}, // mismo que público (margen 0)
    extraCats:{ one:10, twoEach:6, threePlusEach:4 }
  },
  exoticos:{
    aves:{d1_10:15, d11p:12, extra:false},
    reptiles:{d1_10:15, d11p:12, extra:false},
    mamiferos:{d1_10:20, d11p:18, extra2p:{d1_10:14, d11p:14}}
  },
  transporte:{ base:15 },
  suplementos:{ festivo:8, big:15, urgencia:0 } // urgencia íntegro a tu margen
};

/************** Estado **************/
const STATE = { owner:null, pets:[], selectedPetIds:[] };

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
          sexo: (x.sexo || x.genero || "").toLowerCase(), // macho/hembra
          castrado: !!(x.castrado || x.esterilizado || x.neutered),
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
    castrado: !!(p.castrado || p.esterilizado || p.neutered),
    foto: p.foto || p.img || ""
  }));

  return { owner:{ fullName, email, phone, region, address, postalCode:postal }, pets };
}

/************** Render mascotas (horizontal mini) **************/
function ageYears(birth){
  if(!birth) return ""; const d=new Date(birth); if(isNaN(d)) return "";
  const t=new Date();
  let y=t.getFullYear()-d.getFullYear();
  if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
  return y>=0? y : "";
}
function cap(s){ s=String(s||""); return s? s.charAt(0).toUpperCase()+s.slice(1) : s; }

function renderPetsGrid(pets){
  const grid=$("#petsGrid"); grid.innerHTML="";

  (pets||[]).forEach(p=>{
    const avatar = p.foto
      ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
      : `<div class="tpl-pet-icon"><i class="fa-solid fa-paw"></i></div>`;

    const yrs = ageYears(p.nacimiento);
    const sex = (p.sexo==="macho" || p.sexo==="male")?"♂":(p.sexo==="hembra"||p.sexo==="female")?"♀":"";
    const metaBits = [
      p.raza? p.raza : "",
      p.especie? cap(p.especie) : "",
      yrs!==""? `Edad: ${yrs}` : "",
      p.castrado? "Castrado" : ""
    ].filter(Boolean).join(" · ");

    const el=document.createElement("label");
    el.className="tpl-pet-item";
    el.setAttribute("data-birth", p.nacimiento||"");
    el.setAttribute("data-species", p.especie||"");
    el.innerHTML = `
      ${avatar}
      <div class="tpl-pet-meta">
        <div class="tpl-pet-name">${p.nombre||"Mascota"} ${sex?`· ${sex}`:""}</div>
        <div class="tpl-pet-sub">${metaBits}</div>
      </div>
      <input type="checkbox" class="pet-check" data-id="${p.id}">
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
    try{ __updatePuppyDisplay(); }catch(_){}
    doRecalc();
  }, { once:true });
}

/************** Payload **************/
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
    visitDuration: $("#visitDuration")?.value || "60",
    secondMedVisit: $("#secondMedVisit")?.value || "no",
    // Exóticos
    exoticType: $("#exoticType")?.value || "aves",
    exoticCount: parseInt($("#exoticCount")?.value||"1",10),
    pets
  };
}

/************** Util bonos guardería (solo 1ª mascota) **************/
function applyGuarderiaBono(days, isPuppy){
  const bonos = isPuppy ? PRICES_PUBLIC.guarderia.bonos.puppy : PRICES_PUBLIC.guarderia.bonos.adult;
  const dayPrice = isPuppy ? PRICES_PUBLIC.guarderia.puppyDay : PRICES_PUBLIC.guarderia.adultDay;
  let remain = days, total = 0, lines=[];

  function consume(k){
    total += bonos[k];
    lines.push({label:`Guardería · Bono ${k} días`, unit:`${bonos[k]/k} €`, qty:k, amount:bonos[k]});
    remain -= k;
  }

  while(remain>=30) consume(30);
  while(remain>=20) consume(20);
  while(remain>=10) consume(10);
  if(remain>0){ // sueltos
    const add = dayPrice*remain;
    total += add;
    lines.push({label:`Guardería · ${remain} día(s)`, unit:`${dayPrice} €`, qty:remain, amount:add});
  }
  return { total, lines };
}

/************** Cálculo cliente + auxiliar **************/
function isPuppy(p){ // cachorro perro ≤ 6 meses
  if(!p || p.especie!=="perro" || !p.nacimiento) return false;
  const d = new Date(p.nacimiento); if(isNaN(d)) return false;
  const t=new Date();
  const months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
  return months<=6;
}

function calc(payload){
  const s = payload.serviceType;
  const nDays = Math.max(1, daysInclusive(payload.startDate, payload.endDate));
  const selPets = payload.pets;
  const nPets = selPets.length;

  let lines=[], linesAux=[], total=0, totalAux=0;

  // PAS EOS (1 paseo/día)
  if(s==="paseo"){
    const base = PRICES_PUBLIC.paseo.base * nDays;
    lines.push({label:`Paseo · 1ª mascota · ${nDays} día(s) · 12 €`, amount: base});
    total += base;

    if(nPets>1){
      const extras = (nPets-1) * PRICES_PUBLIC.paseo.extra * nDays;
      lines.push({label:`Paseo · ${nPets-1} mascota(s) extra · ${nDays} día(s) · 8 €`, amount: extras});
      total += extras;
    }
    // Aux
    const auxBase = PRICES_AUX.paseo.base * nDays;
    totalAux += auxBase;
    linesAux.push({label:`(AUX) Paseo · 1ª mascota · ${nDays} día(s) · 10 €`, amount: auxBase});
    if(nPets>1){
      const auxExtras = (nPets-1) * PRICES_AUX.paseo.extra * nDays;
      totalAux += auxExtras;
      linesAux.push({label:`(AUX) Paseo · ${nPets-1} extra · ${nDays} día(s) · 5 €`, amount: auxExtras});
    }
  }

  // GUAR D ER ÍA
  if(s==="guarderia_dia"){
    const anyPuppy = selPets.some(p=>isPuppy(p));
    // 1ª mascota con bono
    const bono = applyGuarderiaBono(nDays, anyPuppy);
    bono.lines.forEach(l=>lines.push(l));
    total += bono.total;

    // Aux 1ª mascota con bono (€/día efectivos)
    const bonosAux = anyPuppy ? PRICES_AUX.guarderia.bonos.puppy : PRICES_AUX.guarderia.bonos.adult;
    let remain=nDays;
    function auxAdd(k, pricePerDay){
      const add = k*pricePerDay;
      totalAux += add;
      linesAux.push({label:`(AUX) Guardería · Bono ${k} días`, amount:add});
      remain -= k;
    }
    while(remain>=30) auxAdd(30, anyPuppy?bonosAux[30]:bonosAux[30]);
    while(remain>=20) auxAdd(20, anyPuppy?bonosAux[20]:bonosAux[20]);
    while(remain>=10) auxAdd(10, anyPuppy?bonosAux[10]:bonosAux[10]);
    if(remain>0){
      const dayAux = anyPuppy ? PRICES_AUX.guarderia.puppyDay : PRICES_AUX.guarderia.adultDay;
      const add = dayAux*remain; totalAux += add;
      linesAux.push({label:`(AUX) Guardería · ${remain} día(s) · ${dayAux} €`, amount:add});
    }

    // Mascotas extra SIN bono
    if(nPets>=2){
      const extra2 = PRICES_PUBLIC.guarderia.extra2 * nDays;
      lines.push({label:`Guardería · 2ª mascota · ${nDays} día(s) · 12 €`, amount: extra2});
      total += extra2;

      // Aux extra 2ª
      totalAux += (PRICES_AUX.guarderia.extra2 * nDays);
      linesAux.push({label:`(AUX) Guardería · 2ª mascota · ${nDays} día(s) · 12 €`, amount: PRICES_AUX.guarderia.extra2 * nDays});
    }
    if(nPets>=3){
      const more = (nPets-2) * PRICES_PUBLIC.guarderia.extra3p * nDays;
      lines.push({label:`Guardería · ${nPets-2} mascota(s) extra · ${nDays} día(s) · 8 €`, amount: more});
      total += more;

      // Aux extra 3ª+
      const moreAux = (nPets-2) * PRICES_AUX.guarderia.extra3p * nDays;
      totalAux += moreAux;
      linesAux.push({label:`(AUX) Guardería · ${nPets-2} extra · ${nDays} día(s) · 8 €`, amount: moreAux});
    }
  }

  // ALOJAMIENTO (tramos y cachorro)
  if(s==="alojamiento_nocturno"){
    const first = selPets[0];
    const firstIsPuppy = !!first && isPuppy(first);

    // 1ª mascota
    const p1 = firstIsPuppy ? PRICES_PUBLIC.alojamiento.puppy : PRICES_PUBLIC.alojamiento.std;
    const p1_d10 = Math.min(nDays,10)*p1.d1_10;
    const p1_d11 = Math.max(0,nDays-10)*p1.d11p;
    lines.push({label:`Alojamiento · 1ª mascota · ${Math.min(nDays,10)} día(s) · ${p1.d1_10} €`, amount:p1_d10});
    if(p1_d11>0) lines.push({label:`Alojamiento · 1ª mascota (≥11) · ${nDays-10} día(s) · ${p1.d11p} €`, amount:p1_d11});
    total += p1_d10 + p1_d11;

    // Aux 1ª
    const ax1 = firstIsPuppy ? PRICES_AUX.alojamiento.puppy : PRICES_AUX.alojamiento.std;
    const ax1_d10 = Math.min(nDays,10)*ax1.d1_10;
    const ax1_d11 = Math.max(0,nDays-10)*ax1.d11p;
    totalAux += ax1_d10 + ax1_d11;
    linesAux.push({label:`(AUX) Aloj. 1ª · ${Math.min(nDays,10)} día(s) · ${ax1.d1_10} €`, amount:ax1_d10});
    if(ax1_d11>0) linesAux.push({label:`(AUX) Aloj. 1ª (≥11) · ${nDays-10} día(s) · ${ax1.d11p} €`, amount:ax1_d11});

    // Extras
    if(nPets>1){
      const anyPuppyInGroup = selPets.some(p=>isPuppy(p));
      const exPub = anyPuppyInGroup ? PRICES_PUBLIC.alojamiento.extraIfPuppy : PRICES_PUBLIC.alojamiento.extra;
      const exAux = anyPuppyInGroup ? PRICES_AUX.alojamiento.extraIfPuppy : PRICES_AUX.alojamiento.extra;

      const count = nPets-1;
      const ex_d10 = Math.min(nDays,10)*exPub.d1_10*count;
      const ex_d11 = Math.max(0,nDays-10)*exPub.d11p*count;
      total += ex_d10 + ex_d11;
      lines.push({label:`Alojamiento · ${count} mascota(s) extra · ${Math.min(nDays,10)} día(s) · ${exPub.d1_10} €`, amount:ex_d10});
      if(ex_d11>0) lines.push({label:`Alojamiento · ${count} extra (≥11) · ${nDays-10} día(s) · ${exPub.d11p} €`, amount:ex_d11});

      const ax_d10 = Math.min(nDays,10)*exAux.d1_10*count;
      const ax_d11 = Math.max(0,nDays-10)*exAux.d11p*count;
      totalAux += ax_d10 + ax_d11;
      linesAux.push({label:`(AUX) Aloj. ${count} extra · ${Math.min(nDays,10)} día(s) · ${exAux.d1_10} €`, amount:ax_d10});
      if(ax_d11>0) linesAux.push({label:`(AUX) Aloj. ${count} extra (≥11) · ${nDays-10} día(s) · ${exAux.d11p} €`, amount:ax_d11});
    }
  }

  // VISITA GATO
  if(s==="visita_gato"){
    const use90 = payload.visitDuration==="90";
    const cats = selPets.filter(p=>p.especie==="gato").length || selPets.length || 1;
    const long = nDays>=11;

    const baseTbl = use90? PRICES_PUBLIC.visita_gato.base90 : PRICES_PUBLIC.visita_gato.base60;
    const base = (long? baseTbl.d11p : baseTbl.d1_10);
    lines.push({label:`Visita gato · ${use90?90:60}’ · ${long?'≥11':'1–10'} · 1 visita`, amount: base});
    total += base;

    // Aux base
    const auxBaseTbl = use90? PRICES_AUX.visita_gato.base90 : PRICES_AUX.visita_gato.base60;
    const auxBase = (long? auxBaseTbl.d11p : auxBaseTbl.d1_10);
    totalAux += auxBase;
    linesAux.push({label:`(AUX) Visita gato · ${use90?90:60}’`, amount:auxBase});

    // 2ª medicación
    if(payload.secondMedVisit==="si"){
      const med = long? PRICES_PUBLIC.visita_gato.med15.d11p : PRICES_PUBLIC.visita_gato.med15.d1_10;
      total += med;
      lines.push({label:`Visita gato · 2ª medicación 15’`, amount:med});

      const medAux = long? PRICES_AUX.visita_gato.med15.d11p : PRICES_AUX.visita_gato.med15.d1_10;
      totalAux += medAux;
      linesAux.push({label:`(AUX) 2ª medicación 15’`, amount:medAux});
    }

    // Gatos extra
    const extraCats = Math.max(0, cats-1);
    if(extraCats>0){
      let add=0, auxAdd=0, label="";
      if(extraCats===1){ add = PRICES_PUBLIC.visita_gato.extraCats.one; auxAdd = PRICES_AUX.visita_gato.extraCats.one; label=`Gato extra (1)`; }
      else if(extraCats===2){ add = 2*PRICES_PUBLIC.visita_gato.extraCats.twoEach; auxAdd = 2*PRICES_AUX.visita_gato.extraCats.twoEach; label=`Gatos extra (2 × 8 €)`; }
      else { add = extraCats*PRICES_PUBLIC.visita_gato.extraCats.threePlusEach; auxAdd = extraCats*PRICES_AUX.visita_gato.extraCats.threePlusEach; label=`Gatos extra (${extraCats} × 6 €)`; }
      total += add; totalAux += auxAdd;
      lines.push({label:`Visita gato · ${label}`, amount:add});
      linesAux.push({label:`(AUX) ${label}`, amount:auxAdd});
    }
  }

  // EXÓTICOS (por visita) - usa exoticType + exoticCount
  if(s==="exoticos"){
    const type = payload.exoticType || "aves";
    const count = Math.max(1, payload.exoticCount||1);
    const long = nDays>=11; // si reservan varios días, aplicamos tramo ≥11 a la visita: asumimos 1 visita (igual que gatos); si quieres por día, dime y lo multiplico
    const tbl = PRICES_PUBLIC.exoticos[type];
    const aux = PRICES_AUX.exoticos[type];

    const unit = long? tbl.d11p : tbl.d1_10;
    const unitAux = long? aux.d11p : aux.d1_10;

    // 1ª mascota
    lines.push({label:`Exóticos · ${type} · 1ª mascota · ${long?'≥11':'1–10'} · ${unit} €`, amount:unit});
    linesAux.push({label:`(AUX) Exóticos · ${type} · 1ª · ${unitAux} €`, amount:unitAux});
    total += unit; totalAux += unitAux;

    // extras según tipo
    if(type==="mamiferos" && count>1){
      const exTbl = tbl.extra2p, exAx = aux.extra2p;
      const exUnit = long? exTbl.d11p : exTbl.d1_10;
      const exUnitAux = long? exAx.d11p : exAx.d1_10;
      const extrasCnt = count-1;
      const add = extrasCnt * exUnit;
      const addAux = extrasCnt * exUnitAux;
      lines.push({label:`Exóticos · Peq. mamíferos · ${extrasCnt} extra · ${exUnit} €`, amount:add});
      linesAux.push({label:`(AUX) Peq. mamíferos · ${extrasCnt} extra · ${exUnitAux} €`, amount:addAux});
      total += add; totalAux += addAux;
    }
    // aves/reptiles: sin extra
  }

  // TRANSPORTE
  if(s==="transporte"){
    total += PRICES_PUBLIC.transporte.base;
    lines.push({label:`Transporte`, amount:PRICES_PUBLIC.transporte.base});

    totalAux += PRICES_AUX.transporte.base;
    linesAux.push({label:`(AUX) Transporte`, amount:PRICES_AUX.transporte.base});
  }

  // Suplementos especiales por fechas señaladas (cliente +30 / aux +15)
  const big = BIG_DAYS.includes(fmtMD(payload.startDate)) || BIG_DAYS.includes(fmtMD(payload.endDate));
  if(big){
    total += PRICES_PUBLIC.suplementos.big;
    lines.push({label:"Día señalado (24/12,25/12,31/12,01/01)", amount:PRICES_PUBLIC.suplementos.big});
    totalAux += PRICES_AUX.suplementos.big;
    linesAux.push({label:"(AUX) Día señalado", amount:PRICES_AUX.suplementos.big});
  }

  // Resultado
  const payNow   = Math.max(0, total - totalAux); // tu margen
  const payLater = Math.max(0, total - payNow);

  return { linesPublic:lines, linesAux, totalPublic:total, totalAux, payNow, payLater };
}

/************** Resumen **************/
function renderSummary(calcRes, payload){
  $("#summaryContext").textContent =
    `${labelService(payload.serviceType)} · ${payload.startDate||"—"}${payload.endDate?(" — "+payload.endDate):""}${payload.startTime?(" · "+payload.startTime):""}${payload.endTime?("–"+payload.endTime):""} · ${(payload.pets||[]).length|| (payload.serviceType==='exoticos'? payload.exoticCount:0)} mascota(s)`;

  const box=$("#summaryLines"); box.innerHTML="";
  calcRes.linesPublic.forEach(l=>{
    const row=document.createElement("div");
    row.className="line";
    row.innerHTML = `<span>${l.label}</span><span>${fmtMoney(l.amount)}</span>`;
    box.appendChild(row);
  });

  $("#subtotalTxt").textContent = fmtMoney(calcRes.totalPublic);
  $("#payNowTxt").textContent   = fmtMoney(calcRes.payNow);
  $("#payLaterTxt").textContent = fmtMoney(calcRes.payLater);
}

function doRecalc(){
  const payload = collectPayload();
  $("#visitCatControls").style.display = (payload.serviceType==="visita_gato") ? "" : "none";
  $("#exoticControls").style.display   = (payload.serviceType==="exoticos") ? "" : "none";

  if(!payload.serviceType || !payload.startDate || !payload.endDate){
    renderSummary({linesPublic:[],totalPublic:0,payNow:0,payLater:0}, payload);
    return;
  }
  const c = calc(payload);
  renderSummary(c, payload);
}

/************** EmailJS (opcional, respetando tu config) **************/
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

/************** Auth **************/
function onAuth(cb){
  try{ return firebase.auth().onAuthStateChanged(cb); }
  catch(_){ cb(null); return ()=>{}; }
}

/************** Fallback localStorage **************/
function getUID(){
  try{ return firebase.auth().currentUser?.uid || localStorage.getItem('tpl_auth_uid') || 'default'; }
  catch(_){ return 'default'; }
}
function udbKey(k){ return `tpl.udb.${getUID()}.${k}`; }
function udbGet(k,fb){ try{ const v=localStorage.getItem(udbKey(k)); return v?JSON.parse(v):fb; }catch(_){ return fb; } }

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

  // Binds de recálculo
  ["serviceType","startDate","endDate","startTime","endTime","region","address","postalCode","visitDuration","secondMedVisit","exoticType","exoticCount"]
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
        ...localPets.map((p,i)=>({ id:p.id||`loc_${i}`, nombre:p.nombre, especie:(p.especie||p.tipo||"").toLowerCase(), nacimiento:p.nacimiento||p.birthdate||"", raza:p.raza||p.tipoExotico||"", sexo:(p.sexo||p.genero||"").toLowerCase(), castrado:!!(p.castrado||p.esterilizado||p.neutered), foto:p.foto||"" }))
      ];
      const seen=new Set();
      STATE.pets = merged.filter(p=>{
        const key = `${(p.nombre||"").toLowerCase()}|${p.especie||""}`;
        if(seen.has(key)) return false; seen.add(key); return true;
      });

      renderPetsGrid(STATE.pets);
      try{ __updatePuppyDisplay(); }catch(_){}
    }catch(e){
      console.warn("[init] owner/pets", e);
    }

    doRecalc();

    // CTA reservar
    $("#btnReserve").addEventListener("click", async ()=>{
      const payload=collectPayload();
      if(!payload.serviceType || !payload.startDate || !payload.endDate){
        alert("Selecciona servicio y fechas de inicio/fin."); return;
      }
      if(payload.serviceType!=="exoticos" && !STATE.selectedPetIds.length){
        alert("Elige al menos una mascota."); return;
      }

      const c=calc(payload);
      const reservation = {
        id: "resv_"+Date.now(),
        status: "paid_review",
        createdAt: nowISO(),
        region: payload.region,
        service: { type: payload.serviceType, exoticType: payload.exoticType||null },
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
