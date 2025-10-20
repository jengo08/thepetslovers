/* TPL · PERFIL
   - No cambia tu diseño.
   - Lee Firestore (reservas/{uid}/items) y, si no hay sesión/datos, usa localStorage.
   - Pinta propietario, mascotas y reservas con el mismo estilo.
*/

(function(){
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));

  /* ==== Firebase init (opcional) ==== */
  try{
    if(window.__TPL_FIREBASE_CONFIG && typeof firebase!=='undefined' && !firebase.apps.length){
      firebase.initializeApp(window.__TPL_FIREBASE_CONFIG);
    }
  }catch(_){}

  /* ==== Helpers ==== */
  function getUID(){
    try{ return firebase?.auth?.().currentUser?.uid || localStorage.getItem('tpl_auth_uid') || 'default'; }
    catch(_){ return 'default'; }
  }
  function udbKey(k){ return `tpl.udb.${getUID()}.${k}`; }
  function udbGet(k, fb){ try{ const v=localStorage.getItem(udbKey(k)); return v?JSON.parse(v):fb; }catch(_){ return fb; } }
  function fmtMoney(n){ return (typeof n==="number"&& !isNaN(n)) ? n.toFixed(2).replace('.',',')+' €' : '—'; }

  function sexToSymbol(sex){
    const s=String(sex||"").toLowerCase();
    if(/hembra|female|fema|♀/.test(s)) return "♀";
    if(/macho|male|♂/.test(s)) return "♂";
    return "";
  }
  function calcYears(birth){
    if(!birth) return null;
    const d=new Date(birth); if(isNaN(d)) return null;
    const t=new Date();
    let y=t.getFullYear()-d.getFullYear();
    if(t.getMonth()<d.getMonth() || (t.getMonth()===d.getMonth() && t.getDate()<d.getDate())) y--;
    return Math.max(0,y);
  }

  function svcLabel(s){
    return ({
      guarderia_dia:"Guardería de día",
      alojamiento_nocturno:"Alojamiento nocturno",
      paseo:"Paseo",
      visita_gato:"Visita gato",
      exoticos:"Servicio exóticos",
      transporte:"Transporte"
    })[s]||s||'—';
  }
  function statePill(state){
    const map = { received:'Recibida', proposed:'Propuesta', confirmed:'Confirmada', cancelled:'Cancelada', paid_review:'Recibida' };
    return map[state] || state || 'Recibida';
  }

  /* ==== Datos: propietario y mascotas ==== */
  async function readOwnerAndPets(){
    const fbOwner = udbGet('owner', null);
    const fbPets  = udbGet('pets', []) || udbGet('mascotas', []);

    // Fallback local
    let owner = fbOwner ? {
      fullName: [fbOwner.nombre||'', fbOwner.apellidos||''].filter(Boolean).join(' ').trim(),
      email: fbOwner.email||'',
      phone: fbOwner.telefono||'',
      region: fbOwner.ccaa||'',
      address: fbOwner.direccion||'',
      postalCode: fbOwner.cp||''
    } : null;
    let pets = (fbPets||[]).map((p,i)=>({
      id:p.id||`loc_${i}`,
      nombre:p.nombre||'Mascota',
      especie:(p.especie||p.tipo||'').toLowerCase(),
      nacimiento:p.nacimiento||p.birthdate||'',
      raza:p.raza||p.tipoExotico||'',
      sexo:p.sexo||p.genero||'',
      castrado: p.castrado===true || String(p.castrado||'').toLowerCase()==='si',
      foto:p.foto||''
    }));

    // Intento Firestore si hay sesión
    try{
      if(firebase?.auth && firebase?.firestore){
        await new Promise(res=>firebase.auth().onAuthStateChanged(()=>res(), ()=>res()));
        const u = firebase.auth().currentUser;
        if(u){
          const db=firebase.firestore();

          async function tryDoc(coll){
            try{
              const snap = await db.collection(coll).doc(u.uid).get();
              return snap.exists ? {ref:snap.ref, data:snap.data()||{}} : null;
            }catch(_){ return null; }
          }
          const hit = await tryDoc('users')
                    || await tryDoc('propietarios')
                    || await tryDoc('owners')
                    || await tryDoc('usuarios')
                    || await tryDoc('perfiles');

          if(hit){
            const d = hit.data;
            const nombre   = d.nombre || d.name || d.Nombre || "";
            const apellido = d.apellido || d.apellidos || d.surname || d.Apellidos || "";
            owner = {
              fullName: d.fullName || [nombre,apellido].filter(Boolean).join(' ').trim() || (u.displayName||''),
              email: d.email || u.email || (owner?.email||''),
              phone: d.phone || d.telefono || (owner?.phone||''),
              region: d.region || d.comunidad || d.comunidadAutonoma || d.ccaa || d.CCAA || (owner?.region||''),
              address: d.address || d.direccion || (owner?.address||''),
              postalCode: d.postalCode || d.cp || d.codigo_postal || d.codigoPostal || d.CP || (owner?.postalCode||'')
            };

            // Subcolección mascotas
            try{
              const sub = await hit.ref.collection('mascotas').get();
              if(!sub.empty){
                pets = sub.docs.map((doc,i)=>{
                  const x = doc.data()||{};
                  return {
                    id: doc.id || String(i+1),
                    nombre: x.nombre || x.name || 'Mascota',
                    especie: (x.especie || x.tipo || '').toLowerCase(),
                    nacimiento: x.birthdate || x.nacimiento || '',
                    raza: x.raza || x.tipoExotico || '',
                    sexo: x.sexo || x.genero || '',
                    castrado: x.castrado===true || String(x.castrado||'').toLowerCase()==='si',
                    foto: x.foto || x.img || ''
                  };
                });
              }
            }catch(_){}
          }
        }
      }
    }catch(_){}

    return { owner: owner||{fullName:'',email:'',phone:'',region:'',address:'',postalCode:''}, pets };
  }

  /* ==== Reservas: Firestore primero, luego local ==== */
  async function loadReservations(){
    try{
      if (firebase?.auth && firebase?.firestore) {
        await new Promise(res => firebase.auth().onAuthStateChanged(()=>res(), ()=>res()));
        const u = firebase.auth().currentUser;
        if (u) {
          const db = firebase.firestore();
          const snap = await db.collection("reservas").doc(u.uid).collection("items")
            .orderBy("createdAt", "desc")
            .get();
          const list = snap.docs.map(d => ({ id: d.id, ...(d.data()||{}) }));
          if (list.length) return list;
        }
      }
    }catch(e){
      console.warn("[perfil] Firestore no disponible; usando localStorage", e);
    }
    try{ return JSON.parse(localStorage.getItem("tpl.reservas")||"[]"); }
    catch(_){ return []; }
  }

  /* ==== Pintado ==== */
  function renderOwner(owner){
    $('#tpl-owner-nombre').textContent   = owner.fullName || '—';
    $('#tpl-owner-telefono').textContent = owner.phone || '—';
    $('#tpl-owner-zona').textContent     = owner.region || '—';
    $('#tpl-owner-email').textContent    = owner.email || '—';

    const ok = !!(owner.fullName && owner.phone && owner.email && owner.region);
    const pill = $('#tpl-owner-status');
    if(pill){
      pill.innerHTML = ok
        ? '<i class="fa-solid fa-circle-check"></i> Completo'
        : '<i class="fa-solid fa-circle-exclamation"></i> Incompleto';
    }
    $('#tpl-owner-fill').style.display = ok ? 'none' : '';
    $('#tpl-owner-edit').style.display = ok ? '' : 'none';
  }

  function renderPets(pets){
    const empty = $('#tpl-pets-empty');
    const list  = $('#tpl-pets-list');
    const pill  = $('#tpl-pets-status');

    if(!pets.length){
      empty.hidden = false;
      list.hidden  = true;
      if(pill) pill.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Ninguna';
      return;
    }

    empty.hidden = true;
    list.hidden  = false;

    list.innerHTML = pets.map(p=>{
      const subBits=[];
      if(p.raza) subBits.push(p.raza);
      if(p.especie) subBits.push(p.especie);
      const age = calcYears(p.nacimiento);
      if(age!==null) subBits.push(age===0 ? 'Edad: <1' : `Edad: ${age}`);
      const sex = sexToSymbol(p.sexo);
      if(sex) subBits.push(sex);
      if(p.castrado) subBits.push('Castrado');

      // Cachorro informativo (≤6 meses)
      if(p.especie==='perro' && p.nacimiento){
        const d=new Date(p.nacimiento);
        if(!isNaN(d)){
          const t=new Date();
          const months=(t.getFullYear()-d.getFullYear())*12+(t.getMonth()-d.getMonth())-(t.getDate()<d.getDate()?1:0);
          if(months<=6) subBits.push('Cachorro');
        }
      }

      const thumb = p.foto
        ? `<img class="tpl-pet-thumb" src="${p.foto}" alt="${p.nombre||'Mascota'}">`
        : `<div class="tpl-pet-icon" aria-hidden="true">🐾</div>`;

      return `
        <div class="tpl-pet-item">
          ${thumb}
          <div class="tpl-pet-meta">
            <div class="tpl-pet-name">${p.nombre||'Mascota'}</div>
            <div class="tpl-pet-sub">${subBits.join(' · ')}</div>
          </div>
          <a class="tpl-pet-edit" href="tpl-mascota.html">Editar</a>
        </div>`;
    }).join('');

    if(pill) pill.innerHTML = `<i class="fa-solid fa-paw"></i> ${pets.length} ${pets.length===1?'registrada':'registradas'}`;
  }

  function renderBookings(reservations){
    const empty = $('#tpl-bookings-empty');
    const host  = $('#tpl-bookings-list');
    const pill  = $('#tpl-bookings-status');

    if(!reservations.length){
      empty.hidden = false;
      host.hidden  = true;
      if(pill) pill.innerHTML = '<i class="fa-regular fa-circle"></i> Sin reservas';
      return;
    }

    empty.hidden = true;
    host.hidden  = false;

    host.innerHTML = reservations.map(r=>{
      const ctx = `${svcLabel(r.service?.type)}${r.service?.exoticType?(' · '+r.service.exoticType):''} · ${r.dates?.startDate||'—'}${r.dates?.endDate?(' — '+r.dates.endDate):''}`;
      const lines = (r.pricing?.breakdownPublic||[]).map(l=>`
        <div class="line" style="display:flex;justify-content:space-between;margin:6px 0">
          <span>${l.label}</span><span>${fmtMoney(l.amount)}</span>
        </div>`).join('');
      return `
        <article class="tpl-card" style="margin:10px 0">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <strong>${ctx}</strong>
            <span class="tpl-pill">${statePill(r.status)}</span>
          </div>
          <div class="divider" style="border-top:1px dashed #ececec;margin:12px 0"></div>
          <div>${lines}</div>
          <div class="line total" style="display:flex;justify-content:space-between;margin:6px 0;font-weight:700;border-top:1px dashed #ececec;padding-top:8px">
            <span>Total</span><span>${fmtMoney(r.pricing?.totalClient)}</span>
          </div>
          <div class="line" style="display:flex;justify-content:space-between;margin:6px 0">
            <span>Pagado</span><span>${fmtMoney(r.pricing?.payNow)}</span>
          </div>
          <div class="line" style="display:flex;justify-content:space-between;margin:6px 0">
            <span>Pendiente</span><span>${fmtMoney(r.pricing?.payLater)}</span>
          </div>
        </article>`;
    }).join('');

    if(pill) pill.innerHTML = `<i class="fa-solid fa-calendar-check"></i> ${reservations.length} ${reservations.length===1?'reserva':'reservas'}`;
  }

  /* ==== Mount ==== */
  document.addEventListener('DOMContentLoaded', async ()=>{
    try{
      const { owner, pets } = await readOwnerAndPets();
      renderOwner(owner);
      renderPets(pets);
    }catch(_){
      renderOwner({fullName:'',email:'',phone:'',region:''});
      renderPets([]);
    }

    try{
      const bookings = await loadReservations();
      renderBookings(bookings);
    }catch(_){
      renderBookings([]);
    }
  });
})();
