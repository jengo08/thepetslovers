// js/reservas.js
// Flujo: 1) Servicio/fechas 2) Mascotas 3) Titular 4) Desglose 5) CTA.
// Login-wall (Firebase), autocompletado desde perfil, cálculo de márgenes y guardado + EmailJS.

(function(){
  'use strict';

  /* ===== Utils ===== */
  const €fmt = new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'});
  const currency = (n)=> (Math.round((+n||0)*100)/100).toFixed(2);
  const fmtEUR = (n)=> €fmt.format(Math.round((+n||0)*100)/100);
  const $  = (s,r=document)=>r.querySelector(s);
  const $$ = (s,r=document)=>Array.from(r.querySelectorAll(s));
  const parseDateSafe=(str)=>{ if(!str) return null; const d=new Date(str); return isNaN(d)?null:d; };
  const todayStr=()=>{const d=new Date();const m=String(d.getMonth()+1).padStart(2,"0");const dd=String(d.getDate()).padStart(2,"0");return `${d.getFullYear()}-${m}-${dd}`};

  function monthDayKey(date){const d=parseDateSafe(date); if(!d) return ""; const m=String(d.getMonth()+1).padStart(2,"0"), dd=String(d.getDate()).padStart(2,"0"); return `${m}-${dd}`;}
  const BIG_DAYS = ["12-24","12-25","12-31","01-01"]; // Días señalados (cliente +30 / auxiliar +15)

  /* ===== Servicio y fechas ===== */
  function svcKey(){
    const raw = ($('#service')?.value || '').toString().trim().toLowerCase();
    const map = {
      'guarderia':'guarderia','guardería':'guarderia','daycare':'guarderia',
      'alojamiento':'alojamiento','estancias':'alojamiento','estancia':'alojamiento',
      'paseos':'paseos','paseo':'paseos','walks':'paseos',
      'visitas':'visitas','visita':'visitas','gatos':'visitas',
      'exoticos':'exoticos','exóticos':'exoticos','exotico':'exoticos',
      'transporte':'transporte','postquirurgico':'postquirurgico','bodas':'bodas'
    };
    return map[raw] || raw;
  }
  function getDays(){
    const s=$('#startDate')?.value, e=$('#endDate')?.value;
    if(!s||!e) return 0;
    const d1=new Date(s), d2=new Date(e); if(isNaN(d1)||isNaN(d2)) return 0;
    const diff=Math.floor((d2-d1)/(1000*60*60*24));
    return diff>=0 ? diff+1 : 0;
  }
  function updateDaysRow(nDias){
    const td=$('#sumSenalado')?.parentElement;
    if(td) td.innerHTML=`<span id="sumSenalado">${nDias===1?'1 día':`${nDias} días`}</span>`;
  }

  /* ===== Nombre y apellidos en un campo visible ===== */
  function unifyNameFields(){
    const first=$('#firstName'), last=$('#lastName'); if(!first||!last) return;
    const lab=document.querySelector('label[for="firstName"]'); if(lab) lab.textContent='Nombre y apellidos';
    if(first.placeholder) first.placeholder='Nombre y apellidos';
    const up=()=>{ const parts=first.value.trim().split(/\s+/); last.value=(parts.length>=2)?parts.slice(1).join(' '):''; };
    const merge=()=>{ const n=(first.value||'').trim(), s=(last.value||'').trim(); if(s && !n.toLowerCase().includes(s.toLowerCase())) first.value=`${n} ${s}`.trim(); };
    const hide=()=>{ const c=last.closest('.booking-field')||last.parentElement; if(c) c.style.display='none'; };
    setTimeout(()=>{ merge(); hide(); up(); }, 600);
    first.addEventListener('input', up); last.addEventListener('input', ()=>{ merge(); hide(); up(); });
  }

  /* ===== Mascotas (sin imágenes) ===== */
  function ensurePetsList(){ let list=$('#petsList'); if(!list){ const a=$('#petsAnchor')||$('#bookingForm')||document.body; list=document.createElement('section'); list.id='petsList'; list.className='pets-list'; a.appendChild(list);} return list; }
  function ageMonths(b){ const d=parseDateSafe(b); if(!d) return null; const n=new Date(); let m=(n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth()); if(n.getDate()<d.getDate()) m--; return m; }
  function isPuppyPet(p){ return p?.species==="perro" && (ageMonths(p.birth)??99) <= 6; }
  function ensurePetsMock(profile){
    if(profile && Array.isArray(profile.pets) && profile.pets.length) return profile;
    const mock=profile||{}; mock.pets=[
      {id:"luna", name:"Luna", species:"perro", birth:"2025-07-10"},
      {id:"michi", name:"Michi", species:"gato",  birth:"2022-05-01"},
      {id:"kiko", name:"Kiko", species:"exotico",subtype:"ave", birth:"2021-03-03"}
    ]; return mock;
  }
  function renderPets(profile){
    const list=ensurePetsList(); list.innerHTML="";
    const pets=(profile?.pets)||[];
    pets.slice(0,50).forEach(p=>{
      const puppy=isPuppyPet(p);
      const line=document.createElement('label'); line.className='pet-line';
      line.innerHTML = `
        <input type="checkbox" class="pet-check" data-id="${p.id}">
        <div style="display:flex;flex-direction:column;gap:2px">
          <strong>${p.name||"Mascota"}</strong>
          <div class="pet-meta">
            <span class="muted">${p.species==="exotico"?(p.subtype?("Exótico · "+p.subtype):"Exótico"):p.species}${p.birth?(" · Nac: "+p.birth):""}</span>
            ${puppy?'<span class="badge">Cachorro (≤6m)</span>':''}
          </div>
        </div>
      `;
      list.appendChild(line);
    });
    list.addEventListener('change', ()=>computeCosts());
  }
  function selectedPets(profile){ const ids=$$('.pet-check:checked').map(x=>x.getAttribute('data-id')); const all=(profile?.pets)||[]; return all.filter(p=>ids.includes(p.id)).slice(0,3); }
  function getNumMascotas(){ return Math.max(1, $$('.pet-check:checked').length || 1); }

  /* ===== Especie visible según servicio ===== */
  function toggleSpeciesVisibility(){
    const svc=svcKey(), block=$('#speciesBlock'), sp=$('#species'); if(!block||!sp) return;
    if(svc==='visitas'){ block.style.display='block'; sp.value='gato'; sp.disabled=true; }
    else if(svc==='exoticos'){ block.style.display='block'; sp.disabled=false; }
    else { block.style.display='none'; }
  }

  /* ===== Tarifas públicas + auxiliar ===== */
  const PRICES={
    base:{visitas:22,paseos:12,guarderia:15,alojamiento:30,bodas:0,postquirurgico:0,transporte:20,exoticos:0},
    puppyBase:{guarderia:20,alojamiento:35},
    visita60:22, visita90:30, visita60_larga:18, visita90_larga:27, visitaMed:12, visitaMed_larga:10,
    paseoStd:12, paseoExtraPerro:8, paseoBonos:{10:115,15:168,20:220,25:270,30:318},
    alojSegundoPerroDia:25, alojSegundoPerroD11:22
  };
  const BUNDLE_GUARDERIA={ adult:{10:135,20:250,30:315}, puppy:{10:185,20:350,30:465} };
  const EXOTIC_PRICES={conejo:25,pajaro:20,huron:25,iguana:20,otro:null};
  const AUX={
    guarderia:{adulto:12,cachorro:17,bonosAdult:{10:11,20:10,30:9},bonosPuppy:{10:16,20:14,30:12}},
    alojamiento:{std:{normal:25,desde11:22},puppy:{normal:30,desde11:27},segundo:{normal:20,desde11:17}},
    paseo:{base:10,extra_mascota:5,bonos:{10:8,15:7.5,20:7,25:6.5,30:6}},
    visitas:{base60:17,base90:25,d11_60:12,d11_90:21,med15_publicEqualsAux:true,gatosExtra:{one:10,twoEach:6,moreEach:4}},
    exoticos:{aves:15,reptiles:15,mamiferos:20},
    transporte:{base:15}
  };
  const URGENCIA_PLUS=10, FESTIVO_NORMAL_PLUS=10, FESTIVO_NORMAL_AUX=8, BIG_DAY_PLUS=30, BIG_DAY_AUX=15;

  function getVisitDuration(){ return 60; } // si añades selector visible, cámbialo
  function getVisitDaily(){ return 1; }

  /* ===== Cálculo de costes ===== */
  function computeCosts(){
    const svc=svcKey();
    const species=($('#species')?.value||'perro');
    const visitDur=getVisitDuration();
    const visitDaily=getVisitDaily();
    const nMasc=getNumMascotas();

    let nDias=getDays(); if(!Number.isFinite(nDias)||nDias<=0){ nDias=(['transporte','bodas','postquirurgico','exoticos','visitas','paseos'].includes(svc))?1:0; }
    updateDaysRow(nDias);

    let baseCost=0, visit1Cost=0, visit2Cost=0, supplementPetsCost=0, packCost=0, exoticUnpriced=false, auxTotal=0;

    const sDate=$('#startDate')?.value||todayStr(), eDate=$('#endDate')?.value||sDate;
    const mdS=monthDayKey(sDate), mdE=monthDayKey(eDate);

    let plusFestivoCliente=0, plusFestivoAux=0;
    if(BIG_DAYS.includes(mdS)||BIG_DAYS.includes(mdE)){ plusFestivoCliente+=BIG_DAY_PLUS; plusFestivoAux+=BIG_DAY_AUX; }
    const plusUrgencia=0; // si luego conectamos con hora actual y <2h, aplicar URGENCIA_PLUS

    if(svc==='visitas'){
      const long=nDias>=11;
      const tarifa1=(visitDur===90)?(long?PRICES.visita90_larga:PRICES.visita90):(visitDur===15)?(long?PRICES.visitaMed_larga:PRICES.visitaMed):(long?PRICES.visita60_larga:PRICES.visita60);
      visit1Cost = tarifa1*nDias;
      const aux1=(visitDur===90)?(long?AUX.visitas.d11_90:AUX.visitas.base90):(visitDur===15)?(AUX.visitas.med15_publicEqualsAux?(long?PRICES.visitaMed_larga:PRICES.visitaMed):0):(long?AUX.visitas.d11_60:AUX.visitas.base60);
      auxTotal += aux1*nDias;

      const extras=Math.max(0,visitDaily-1);
      if(extras>0){ const tMed= long?PRICES.visitaMed_larga:PRICES.visitaMed; visit2Cost=tMed*nDias*extras; auxTotal+=tMed*nDias*extras; }

      const totalVis=nDias*Math.max(1,visitDaily);
      if(nMasc>1){
        const extra=nMasc-1; let perC=0, perA=0;
        if(extra===1){ perC=12; perA=AUX.visitas.gatosExtra.one; }
        else if(extra===2){ perC=8; perA=AUX.visitas.gatosExtra.twoEach; }
        else { perC=6; perA=AUX.visitas.gatosExtra.moreEach; }
        supplementPetsCost = perC*extra*totalVis;
        auxTotal           += perA*extra*totalVis;
      }

    } else if(svc==='paseos'){
      const pp=PRICES.paseoStd; let pack=0;
      if(nDias>=30)pack=30; else if(nDias>=25)pack=25; else if(nDias>=20)pack=20; else if(nDias>=15)pack=15; else if(nDias>=10)pack=10;
      if(pack>0){ const price=PRICES.paseoBonos[pack]; const rem=nDias-pack; packCost=price; baseCost=rem*pp; auxTotal+=AUX.paseo.bonos[pack]*pack + AUX.paseo.base*rem; }
      else { baseCost=nDias*pp; auxTotal+=AUX.paseo.base*nDias; }
      if(nMasc>1){ supplementPetsCost=(nMasc-1)*nDias*PRICES.paseoExtraPerro; auxTotal+=(nMasc-1)*nDias*AUX.paseo.extra_mascota; }

    } else if(svc==='guarderia'){
      const anyPuppy = selectedPets(currentProfile).some(isPuppyPet);
      const perDay=anyPuppy?PRICES.puppyBase.guarderia:PRICES.base.guarderia;
      const table=anyPuppy?BUNDLE_GUARDERIA.puppy:BUNDLE_GUARDERIA.adult;
      const auxDay=anyPuppy?AUX.guarderia.cachorro:AUX.guarderia.adulto;
      const auxB=anyPuppy?AUX.guarderia.bonosPuppy:AUX.guarderia.bonosAdult;
      let pack=0; if(nDias>=30)pack=30; else if(nDias>=20)pack=20; else if(nDias>=10)pack=10;
      if(pack>0){ const price=table[pack]; const rem=nDias-pack; packCost=price; baseCost=rem*perDay; auxTotal+=auxB[pack]*pack + auxDay*rem; }
      else { baseCost=perDay*nDias; auxTotal+=auxDay*nDias; }

    } else if(svc==='alojamiento'){
      const petsCount=Math.max(1,nMasc);
      for(let i=1;i<=petsCount;i++){
        const isSecond=(i>=2);
        for(let d=1; d<=nDias; d++){
          const d11=(d>=11); let pPub=0,pAux=0;
          if(isSecond){ pPub=d11?PRICES.alojSegundoPerroD11:PRICES.alojSegundoPerroDia; pAux=d11?AUX.alojamiento.segundo.desde11:AUX.alojamiento.segundo.normal; }
          else{
            const anyPup = selectedPets(currentProfile).some(isPuppyPet);
            pPub = d11 ? (anyPup?32:27) : (anyPup?PRICES.puppyBase.alojamiento:PRICES.base.alojamiento);
            pAux = d11 ? (anyPup?AUX.alojamiento.puppy.desde11:AUX.alojamiento.std.desde11)
                       : (anyPup?AUX.alojamiento.puppy.normal:AUX.alojamiento.std.normal);
          }
          baseCost += pPub; auxTotal += pAux;
        }
      }

    } else if(svc==='exoticos'){
      const type=($('#species')?.value)||'otro', price=EXOTIC_PRICES[type];
      if(price!=null){ const vxd=Math.max(1,getVisitDaily()); baseCost=price*nDias*vxd;
        const aux=(type==="pajaro")?AUX.exoticos.aves:(type==="iguana")?AUX.exoticos.reptiles:(type==="conejo"||type==="huron")?AUX.exoticos.mamiferos:0;
        auxTotal+=aux*nDias*vxd;
      } else { exoticUnpriced=true; baseCost=0; }

    } else if(svc==='transporte'){
      baseCost=PRICES.base.transporte; auxTotal+=AUX.transporte.base;

    } else {
      baseCost=PRICES.base[svc]||0;
    }

    const supCliente = plusUrgencia + plusFestivoCliente;
    const supAux     = plusFestivoAux;

    const subtotal = (!exoticUnpriced)?(baseCost+visit1Cost+visit2Cost+supplementPetsCost+packCost+supCliente):0;
    const payNow   = Math.max(0, subtotal - (auxTotal + supAux)); // tu margen ahora
    const payLater = Math.max(0, subtotal - payNow);              // resto 12 días antes

    $('#sumBase')?.textContent    = (!exoticUnpriced?currency(baseCost):'—');
    $('#sumVisit1')?.textContent  = currency(visit1Cost);
    $('#sumVisit2')?.textContent  = currency(visit2Cost);
    $('#sumFestivo')?.textContent = currency(packCost + supCliente);
    $('#sumSenalado')?.textContent= (nDias>0)?(nDias===1?'1 día':`${nDias} días`):'0';
    $('#sumPets')?.textContent    = currency(supplementPetsCost);
    $('#sumSubtotal')?.textContent= (!exoticUnpriced?currency(subtotal):'—');
    $('#sumDeposit')?.textContent = (!exoticUnpriced?currency(payNow):'—');
    $('#sumResto')?.textContent   = (!exoticUnpriced?currency(payLater):'—');

    const hidden=$('#summaryField');
    if(hidden){
      const s=[];
      s.push(`Días: ${nDias}`);
      if(!exoticUnpriced){
        if(packCost>0) s.push(`Coste del bono: ${currency(packCost)} €`);
        if(baseCost>0) s.push(`Base suelto: ${currency(baseCost)} €`);
        if(visit1Cost>0) s.push(`Visitas (principal): ${currency(visit1Cost)} €`);
        if(visit2Cost>0) s.push(`Visitas (medicación): ${currency(visit2Cost)} €`);
        if(supplementPetsCost>0) s.push(`Suplementos mascotas: ${currency(supplementPetsCost)} €`);
        if(supCliente>0) s.push(`Suplementos varios: ${currency(supCliente)} €`);
        s.push(`Subtotal: ${currency(subtotal)} €`);
        s.push(`A pagar ahora: ${currency(payNow)} €`);
        s.push(`Pendiente: ${currency(payLater)} €`);
      } else { s.push('Precio a consultar'); }
      hidden.value=s.join(' | ');
    }

    try{ sessionStorage.setItem("tpl.lastCalc", JSON.stringify({svc,nDias,nMasc,baseCost,visit1Cost,visit2Cost,supplementPetsCost,packCost, supCliente, subtotal, auxTotal, supAux, payNow, payLater})); }catch(_){}
  }

  /* ===== Perfil / Autorelleno ===== */
  function getProfile(){ try{ return JSON.parse(localStorage.getItem("tpl.profile")||"null"); }catch(_){ return null; } }
  let currentProfile=null;
  function fillOwnerFromProfile(p){
    $('#firstName')&&p?.fullName &&($('#firstName').value=p.fullName);
    $('#lastName')&&($('#lastName').value='');
    $('#email')&&p?.email &&($('#email').value=p.email);
    $('#phone')&&p?.phone &&($('#phone').value=p.phone);
    $('#address')&&p?.address &&($('#address').value=p.address);
    $('#postalCode')&&p?.postalCode&&($('#postalCode').value=p.postalCode);
    $('#region')&&p?.region&&($('#region').value=p.region);
  }

  /* ===== Eventos y arranque ===== */
  function bindEvents(){
    ['service','species','startDate','endDate','startTime','endTime'].forEach(id=>{
      const el=document.getElementById(id); if(!el) return;
      const h=()=>{ toggleSpeciesVisibility(); computeCosts(); };
      el.addEventListener('change',h); el.addEventListener('input',h);
    });
    $('#btnBack')?.addEventListener('click', ()=>{ if(document.referrer) history.back(); else location.href='servicios.html'; });
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    unifyNameFields();
    bindEvents();
    toggleSpeciesVisibility();
    computeCosts();
    setTimeout(computeCosts,300);

    const form=$('#bookingForm'), wall=$('#authWall');

    // Auth helpers (Firebase compat)
    const isLogged = ()=>{ try{return !!(firebase?.auth()?.currentUser);}catch(_){return false;} };
    const getUID   = ()=>{ try{return firebase?.auth()?.currentUser?.uid||null;}catch(_){return null;} };
    const getMail  = ()=>{ try{return firebase?.auth()?.currentUser?.email||null;}catch(_){return null;} };

    function applyAuthUI(logged){
      form?.classList.toggle('disabled', !logged);
      if(wall) wall.style.display = logged ? 'none' : 'block';
    }

    async function hydrateProfile(){
      const logged=isLogged();
      applyAuthUI(logged);
      const uid=getUID();

      if(logged && typeof firebase!=='undefined' && firebase.firestore && uid){
        try{
          const snap=await firebase.firestore().collection('propietarios').doc(uid).get();
          const owner=snap.exists?snap.data():null;
          currentProfile=ensurePetsMock(owner || getProfile() || {});
        }catch(_){
          currentProfile=ensurePetsMock(getProfile() || {});
        }
      }else{
        currentProfile=ensurePetsMock(getProfile() || {});
      }
      fillOwnerFromProfile(currentProfile);
      renderPets(currentProfile);
      computeCosts();
    }

    try{
      if(firebase?.auth){
        firebase.auth().onAuthStateChanged(()=>{ hydrateProfile(); });
      } else { hydrateProfile(); }
    }catch(_){ hydrateProfile(); }

    // Envío
    if(form){
      form.addEventListener('submit', async (ev)=>{
        ev.preventDefault(); ev.stopPropagation();
        if(!isLogged()){ alert('Debes iniciar sesión para reservar.'); return; }

        // Requiere perfil en Firestore
        try{
          const uid=getUID();
          if(uid && firebase?.firestore){
            const doc=await firebase.firestore().collection('propietarios').doc(uid).get();
            if(!doc.exists){
              alert('Completa tu perfil antes de hacer una reserva.');
              if(location.pathname.indexOf('perfil')===-1) location.href='perfil.html';
              return;
            }
          }
        }catch(_){}

        computeCosts();

        // Recopilar datos
        const fd=new FormData(form); const payload={}; for(const [k,v] of fd.entries()) payload[k]=v;

        let calc=null; try{ calc=JSON.parse(sessionStorage.getItem("tpl.lastCalc")||"null"); }catch(_){}
        const subtotal=calc?.subtotal||0, payNow=calc?.payNow||0, payLater=calc?.payLater||Math.max(0, subtotal-payNow);

        payload._estado='paid_review'; // solicitud en revisión tras abonar señal (cuando integremos pago real)
        payload._uid=getUID();
        payload._email=getMail() || payload.email || null;
        payload._createdAt=(firebase?.firestore?.FieldValue)?firebase.firestore.FieldValue.serverTimestamp():new Date().toISOString();
        payload.total_cliente=Number(subtotal.toFixed(2));
        payload.pagar_ahora=Number(payNow.toFixed(2));
        payload.pendiente=Number(payLater.toFixed(2));

        // Guardar
        let saved=false, docId=null;
        try{
          if(firebase?.firestore){
            const ref=await firebase.firestore().collection('reservas').add(payload);
            saved=true; docId=ref.id;
          }
        }catch(err){ console.warn('Firestore error',err); }

        // Copia local (para mostrar en perfil aunque falle correo)
        try{
          const key="tpl.reservas";
          const r={ id:docId||("resv_"+Date.now()), status:payload._estado, createdAt:new Date().toISOString(),
            service: payload.service||svcKey(),
            dates:{start:payload.startDate||todayStr(), end:payload.endDate||payload.startDate||todayStr()},
            owner:{name:(payload.firstName||'').trim(), email:(payload.email||getMail()||''), phone:(payload.phone||'')},
            petsCount:getNumMascotas(), pricing:{ total:subtotal, payNow, payLater } };
          let arr=[]; try{ arr=JSON.parse(localStorage.getItem(key)||"[]"); }catch(_){}
          arr.unshift(r); localStorage.setItem(key, JSON.stringify(arr));
        }catch(_){}

        // Emails (si configurado)
        let mailed=false;
        try{
          if(window.emailjs && window.TPL_EMAILJS){
            const cfg=window.TPL_EMAILJS;
            const service=cfg.serviceId, pub=cfg.publicKey;
            const tplC=(cfg.templates&&cfg.templates.cliente);
            const tplG=(cfg.templates&&cfg.templates.gestion);
            if(service && pub && tplC){
              const params=Object.assign({}, payload, {
                reserva_id: docId,
                total_txt: fmtEUR(subtotal),
                pay_now_txt: fmtEUR(payNow),
                pay_later_txt: fmtEUR(payLater),
                admin_email: cfg.adminEmail || 'gestion@thepetslovers.es'
              });
              const r1=await emailjs.send(service, tplC, params, pub);
              let ok1=(r1 && r1.status>=200 && r1.status<300);
              let ok2=true;
              if(tplG){ const r2=await emailjs.send(service, tplG, params, pub); ok2=(r2 && r2.status>=200 && r2.status<300); }
              mailed = ok1 && ok2;
            }
          }
        }catch(err){ console.warn('EmailJS error',err); }

        if(saved || mailed){
          alert('Tu reserva se ha registrado y está en revisión.');
          const redirect=form.dataset.tplRedirect||form.getAttribute('data-tpl-redirect');
          const wait=parseInt(form.dataset.tplWait||form.getAttribute('data-tpl-wait')||'800',10);
          if(redirect){ setTimeout(()=>{ location.href=redirect; }, wait); }
          else { form.reset(); computeCosts(); }
        } else {
          alert('No se pudo enviar la reserva. Inténtalo de nuevo.');
        }
      });
    }

    // Seguridad: si algo no montó todavía, no bloquees el form en pruebas
    setTimeout(()=>{ try{ $('#bookingForm')?.classList.remove('disabled'); $('#authWall')&&( $('#authWall').style.display='none'); }catch(_){}} ,1000);
  });

})();
