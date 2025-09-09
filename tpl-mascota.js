/* TPL: INICIO BLOQUE NUEVO [Mascota: guardar/editar en base por usuario (localStorage)] */
(function(){
  'use strict';

  // ====== Base por usuario (localStorage) ======
  /* TPL: INICIO BLOQUE NUEVO [UID robusto: currentUser -> tpl_auth_uid -> Firebase UID -> default] */
  function getCurrentUserId(){
    // 1) UID explícito si lo setea tu login antiguo
    var explicit = localStorage.getItem('tpl.currentUser');
    if (explicit) return explicit;

    // 2) UID sincronizado por navbar/auth reciente
    var uidLS = localStorage.getItem('tpl_auth_uid');
    if (uidLS) return uidLS;

    // 3) UID real de Firebase si está cargado
    try{
      if (window.firebase && typeof firebase.auth === 'function'){
        var u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}

    // 4) Fallback
    return 'default';
  }
  /* TPL: FIN BLOQUE NUEVO */

  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  function udbSet(uid, key, value){
    try { localStorage.setItem(udbKey(uid,key), JSON.stringify(value)); } catch(_){}
  }

  /* TPL: INICIO BLOQUE NUEVO [Helpers compat: leer varias claves y saber si existe alias] */
  function udbGetAny(uid, keys, fallback){
    for (var i=0;i<keys.length;i++){
      var v = udbGet(uid, keys[i], undefined);
      if (v !== undefined && v !== null) return v;
    }
    return fallback;
  }
  function udbHas(uid, key){
    try { return localStorage.getItem(udbKey(uid,key)) !== null; } catch(_){ return false; }
  }
  /* TPL: FIN BLOQUE NUEVO */

  // ===== Listas (carga JSON si existe) =====
  let DOG_BREEDS = ["Mestizo","Labrador Retriever","Golden Retriever","Pastor Alemán","Bulldog Francés","Caniche / Poodle","Chihuahua","Pomerania","Yorkshire Terrier","Shih Tzu","Beagle","Bóxer","Border Collie","Dálmata","Rottweiler","Husky Siberiano","Cocker Spaniel","Teckel / Dachshund","Pastor Belga Malinois","Pastor Australiano"];
  let CAT_BREEDS = ["Mestizo","Europeo Común","Siamés","Persa","Maine Coon","Bengalí","Ragdoll","Sphynx","British Shorthair","Scottish Fold","Azul Ruso","Noruego de Bosque","Bosque de Siberia","Abisinio","Exótico de Pelo Corto"];
  const EXOTIC_TYPES = ["Pájaro","Conejo","Hurón","Hámster","Cobaya","Erizo","Iguana","Lagarto","Camaleón","Serpiente","Rana","Tortuga","Araña","Otro"];

  fetch('tpl-razas.json').then(r=>r.ok?r.json():null).then(j=>{
    if (!j) return;
    if (Array.isArray(j.perro) && j.perro.length) DOG_BREEDS = j.perro;
    if (Array.isArray(j.gato)  && j.gato.length)  CAT_BREEDS = j.gato;
    if (document.readyState !== 'loading') updateBreedList();
  }).catch(()=>{});

  // ===== Helpers =====
  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

  // ===== Estado foto / crop =====
  let originalImg = null, imageReady = false;
  let cropState = { offX:0, offY:0, scale:1 };
  let currentCroppedDataUrl = '';
  let editIndex = -1;
  let existingFotoDataUrl = '';

  function fitCoverScale(imgW, imgH, boxW, boxH){ return Math.max(boxW/imgW, boxH/imgH); }
  function drawToCanvas(ctx, img, offX, offY, scale, W, H){
    const dw = img.width * scale, dh = img.height * scale;
    const minX = W - dw, maxX = 0;
    const minY = H - dh, maxY = 0;
    const x = Math.min(maxX, Math.max(minX, offX));
    const y = Math.min(maxY, Math.max(minY, offY));
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(img, x, y, dw, dh);
    return {x,y};
  }

  document.addEventListener('DOMContentLoaded', () => {
    const form = byId('tpl-pet-form');

    // Foto & UI
    const avatarBox   = byId('avatarBox');
    const avatarIcon  = byId('avatarIcon');
    const preview     = byId('preview');
    const fileInput   = byId('foto');
    const photoPickRow= byId('photoPickRow');
    const photoActions= byId('photoActions');
    const btnChange   = byId('btnChangePhoto');
    const btnAdjust   = byId('btnAdjustPhoto');

    // Campos
    const especie   = byId('especie');
    const labelRaza = byId('label-raza');
    const raza      = byId('raza');
    const breedList = byId('tpl-breed-list');

    const nombre    = byId('nombre');
    const microchip = byId('microchip');
    const microNo   = byId('microchip_no_tiene');
    const edad      = byId('edad');
    const peso      = byId('peso');
    const esterilizado = byId('esterilizado');
    const vacunas   = byId('vacunas');
    const salud     = byId('salud');
    const tratamiento = byId('tratamiento');
    const comidas   = byId('comidas');
    const salidas   = byId('salidas');
    const tamano    = byId('tamano');
    const clinica   = byId('clinica');
    const hospitalPref = byId('hospitalPref');
    const comportamiento = byId('comportamiento');

    const camaras   = byId('camaras');
    const fotosSel  = byId('fotos');

    const seguroVet     = byId('seguroVet');
    const seguroVetData = byId('seguroVetData');
    const seguroVetComp = byId('seguroVetComp');
    const seguroVetNum  = byId('seguroVetNum');
    const seguroRC      = byId('seguroRC');

    const saveBtn = byId('saveBtn');

    // Icono por especie (si no hay foto)
    function updateSpeciesIcon(){
      const v = especie.value;
      let cls = 'fa-paw';
      if (v === 'Perro') cls = 'fa-dog';
      else if (v === 'Gato') cls = 'fa-cat';
      else if (v === 'Exótico') cls = 'fa-dove';
      avatarIcon.innerHTML = `<i class="fa-solid ${cls}"></i>`;
    }

    // Preview al elegir archivo
    fileInput.addEventListener('change', () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f){
        preview.src = 'images/pet-placeholder.png';
        avatarBox.classList.remove('has-image');   // sin imagen => solo huellita
        photoActions.style.display='none';
        photoPickRow.style.display='block';
        currentCroppedDataUrl=''; originalImg=null; imageReady=false;
        updateSpeciesIcon();
        return;
      }
      const tmp = URL.createObjectURL(f);
      preview.src = tmp;
      avatarBox.classList.add('has-image');        // con imagen
      photoPickRow.style.display = 'none';
      photoActions.style.display = 'flex';

      originalImg = new Image();
      originalImg.onload = ()=>{ URL.revokeObjectURL(tmp); imageReady = true; };
      originalImg.src = tmp;
      currentCroppedDataUrl='';
    });

    btnChange.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); fileInput.click(); });

    // Microchip obligatorio salvo "No tiene"
    function updateMicroState(){
      if (microNo.checked){
        microchip.value = '';
        microchip.setAttribute('disabled','disabled');
        microchip.removeAttribute('required');
      } else {
        microchip.removeAttribute('disabled');
        microchip.setAttribute('required','required');
      }
    }
    microNo.addEventListener('change', updateMicroState);
    updateMicroState();

    // Especie -> razas/tipos + icono
    function updateBreedList(){
      const v = especie.value;
      if (v === 'Perro'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, DOG_BREEDS); }
      else if (v === 'Gato'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, CAT_BREEDS); }
      else if (v === 'Exótico'){ labelRaza.textContent = 'Especie (exóticos) *'; setOpts(breedList, EXOTIC_TYPES); }
      else { labelRaza.textContent = 'Raza / Tipo *'; setOpts(breedList, []); }
      if (!avatarBox.classList.contains('has-image')) updateSpeciesIcon();
    }
    especie.addEventListener('change', updateBreedList);
    updateBreedList();

    // ===== Seguro Vet: detalles SOLO si “Sí” =====
    function toggleSeguroVet(){
      const yes = (seguroVet.value === 'Sí');
      seguroVetData.classList.toggle('is-hidden', !yes);
      seguroVetData.hidden = !yes;
      seguroVetComp.required = seguroVetNum.required = yes;
      if (!yes){ seguroVetComp.value=''; seguroVetNum.value=''; }
    }
    seguroVet.addEventListener('change', toggleSeguroVet);
    toggleSeguroVet();

    // ===== Cropper minimal (drag/flechas) =====
    const modal = byId('cropperModal');
    const cropCanvas = byId('cropCanvas');
    const ctx = cropCanvas.getContext('2d');
    const btnCancel = byId('btnCancelCrop');
    const btnApply  = byId('btnApplyCrop');
    let dragging=false, lastX=0, lastY=0;

    function openCropper(){
      if (!imageReady){
        const src = preview && preview.src;
        if (!src || /pet-placeholder\.png$/i.test(src)){ fileInput.click(); return; }
        originalImg = new Image();
        originalImg.onload = ()=>{ imageReady=true; initAndDraw(); };
        originalImg.crossOrigin = 'anonymous';
        originalImg.src = src;
      } else { initAndDraw(); }
      function initAndDraw(){
        const W = cropCanvas.width, H = cropCanvas.height;
        cropState.scale = fitCoverScale(originalImg.width, originalImg.height, W, H);
        cropState.offX = (W - originalImg.width * cropState.scale)/2;
        cropState.offY = (H - originalImg.height * cropState.scale)/2;
        drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, W, H);
        modal.style.display = 'flex'; modal.setAttribute('aria-hidden','false');
        document.body.style.overflow = 'hidden';
        cropCanvas.focus();
      }
    }
    byId('btnAdjustPhoto').addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openCropper(); });
    btnCancel.addEventListener('click', ()=>{ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; });
    cropCanvas.addEventListener('pointerdown', (e)=>{ if (!imageReady) return; dragging=true; cropCanvas.setPointerCapture(e.pointerId); lastX=e.clientX; lastY=e.clientY; });
    cropCanvas.addEventListener('pointermove', (e)=>{ if (!dragging || !imageReady) return; const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY; const p=drawToCanvas(ctx, originalImg, cropState.offX+dx, cropState.offY+dy, cropState.scale, cropCanvas.width, cropCanvas.height); cropState.offX=p.x; cropState.offY=p.y; });
    cropCanvas.addEventListener('pointerup', ()=>{ dragging=false; });
    cropCanvas.addEventListener('pointercancel', ()=>{ dragging=false; });
    modal.addEventListener('keydown', (e)=>{ if (!imageReady) return; const step=3; let moved=false; if (e.key==='ArrowLeft'){cropState.offX-=step;moved=true;} if (e.key==='ArrowRight'){cropState.offX+=step;moved=true;} if (e.key==='ArrowUp'){cropState.offY-=step;moved=true;} if (e.key==='ArrowDown'){cropState.offY+=step;moved=true;} if (moved){ e.preventDefault(); const p=drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, cropCanvas.width, cropCanvas.height); cropState.offX=p.x; cropState.offY=p.y; } if (e.key==='Escape'){ btnCancel.click(); } });
    btnApply.addEventListener('click', ()=>{ if (!imageReady) return btnCancel.click(); const out=document.createElement('canvas'); out.width=256; out.height=256; const octx=out.getContext('2d'); const factor=256/320; drawToCanvas(octx, originalImg, cropState.offX*factor, cropState.offY*factor, cropState.scale*factor, 256,256); currentCroppedDataUrl = out.toDataURL('image/jpeg', 0.9); preview.src = currentCroppedDataUrl; avatarBox.classList.add('has-image'); btnCancel.click(); });

    // ===== MODO EDICIÓN (lee de udb) =====
    (function initEditMode(){
      const params = new URLSearchParams(location.search);
      const e = params.get('edit');
      if (e == null) return;
      const idx = parseInt(e, 10);
      if (Number.isNaN(idx) || idx < 0) return;

      const uid = getCurrentUserId();
      /* TPL: INICIO BLOQUE NUEVO [Leer pets con compat a alias "mascotas"] */
      const arr = udbGetAny(uid, ['pets','mascotas'], []);
      /* TPL: FIN BLOQUE NUEVO */
      if (!Array.isArray(arr) || !arr[idx]) return;

      editIndex = idx;
      const pet = arr[idx];

      const h1 = document.querySelector('h1');
      if (h1) h1.textContent = 'Editar mascota';
      if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios y volver al perfil';

      nombre.value = pet.nombre || '';
      if ((pet.microchip||'') === 'No tiene'){
        microNo.checked = true;
        updateMicroState();
      } else {
        microNo.checked = false;
        updateMicroState();
        microchip.value = pet.microchip || '';
      }

      especie.value = pet.especie || '';
      updateBreedList();
      raza.value = pet.raza || pet.tipoExotico || '';

      edad.value = pet.edad || '';
      peso.value = pet.peso || '';
      esterilizado.value = pet.esterilizado || '';
      vacunas.value = pet.vacunas || '';
      salud.value = pet.salud || '';
      tratamiento.value = pet.tratamiento || '';
      comidas.value = pet.comidas || '';
      salidas.value = pet.salidas || '';
      tamano.value = pet.tamano || '';
      clinica.value = pet.clinica || '';
      hospitalPref.value = pet.hospitalPref || '';
      comportamiento.value = pet.comportamiento || '';

      camaras.value = pet.camaras || '';
      fotosSel.value = pet.fotos || '';

      seguroVet.value = pet.seguroVet || '';
      toggleSeguroVet();
      if (seguroVet.value === 'Sí'){
        seguroVetComp.value = pet.seguroVetComp || '';
        seguroVetNum.value  = pet.seguroVetNum  || '';
      }
      seguroRC.value = pet.seguroRC || '';

      existingFotoDataUrl = pet.foto || '';
      if (existingFotoDataUrl && !/pet-placeholder\.png$/i.test(existingFotoDataUrl)){
        preview.src = existingFotoDataUrl;
        avatarBox.classList.add('has-image');
        photoPickRow.style.display = 'none';
        photoActions.style.display = 'flex';
      } else {
        avatarBox.classList.remove('has-image');
        photoActions.style.display = 'none';
        photoPickRow.style.display = 'block';
        updateSpeciesIcon();
      }
    })();

    // ===== Guardar (crear/actualizar) directamente en udb =====
    saveBtn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();

      if (!microNo.checked && !microchip.value.trim()){
        alert('El microchip es obligatorio (o marca “No tiene”).');
        microchip.focus();
        return;
      }
      if (!form.reportValidity()) return;

      const fd = new FormData(form);
      const mascota = {
        nombre: (fd.get('nombre')||'').toString().trim(),
        microchip: microNo.checked ? 'No tiene' : (fd.get('microchip')||'').toString().trim(),
        especie: (fd.get('especie')||'').toString(),
        raza: (fd.get('raza')||'').toString().trim(),
        edad: (fd.get('edad')||'').toString().trim(),
        peso: (fd.get('peso')||'').toString().trim(),
        esterilizado: (fd.get('esterilizado')||'').toString(),
        vacunas: (fd.get('vacunas')||'').toString(),
        salud: (fd.get('salud')||'').toString(),
        tratamiento: (fd.get('tratamiento')||'').toString(),
        comidas: (fd.get('comidas')||'').toString(),
        salidas: (fd.get('salidas')||'').toString(),
        tamano: (fd.get('tamano')||'').toString(),
        clinica: (fd.get('clinica')||'').toString(),
        hospitalPref: (fd.get('hospitalPref')||'').toString(),
        comportamiento: (fd.get('comportamiento')||'').toString(),
        camaras: (fd.get('camaras')||'').toString(),
        fotos: (fd.get('fotos')||'').toString(),
        seguroVet: (fd.get('seguroVet')||'').toString(),
        seguroVetComp: (seguroVet.value==='Sí') ? (byId('seguroVetComp').value||'') : '',
        seguroVetNum:  (seguroVet.value==='Sí') ? (byId('seguroVetNum').value ||'') : '',
        seguroRC: (fd.get('seguroRC')||'').toString(),
        foto: ''
      };

      const uid = getCurrentUserId();
      const finalize = (dataUrl) => {
        const baseFoto = currentCroppedDataUrl || dataUrl || existingFotoDataUrl || 'images/pet-placeholder.png';
        mascota.foto = baseFoto;

        /* TPL: INICIO BLOQUE NUEVO [Leer con compat y escribir sincronizando alias si existe] */
        let arr = udbGetAny(uid, ['pets','mascotas'], []);
        if (!Array.isArray(arr)) arr = [];
        if (editIndex >= 0 && arr[editIndex]){
          arr[editIndex] = mascota;   // actualizar
        } else {
          arr.push(mascota);          // crear
        }
        udbSet(uid, 'pets', arr);
        if (udbHas(uid, 'mascotas')){ udbSet(uid, 'mascotas', arr); }
        try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}
        /* TPL: FIN BLOQUE NUEVO */

        location.assign('perfil.html');
      };

      const file = fileInput.files && fileInput.files[0];
      if (currentCroppedDataUrl){ finalize(currentCroppedDataUrl); }
      else if (file){
        const reader = new FileReader();
        reader.onload = () => {
          const img = new Image();
          img.onload = () => {
            const out = document.createElement('canvas');
            out.width = 256; out.height = 256;
            const octx = out.getContext('2d');
            const scale = fitCoverScale(img.width, img.height, 256, 256);
            const dw = img.width*scale, dh = img.height*scale;
            const x = (256 - dw)/2, y = (256 - dh)/2;
            octx.drawImage(img, x, y, dw, dh);
            finalize(out.toDataURL('image/jpeg', 0.85));
          };
          img.src = reader.result;
        };
        reader.readAsDataURL(file);
      } else {
        finalize('');
      }
    });
  });

  // Refrescar datalist tras cargar JSON (fuera del DOMContentLoaded por el fetch inicial)
  function updateBreedList(){
    const especie = document.getElementById('especie');
    const labelRaza = document.getElementById('label-raza');
    const breedList = document.getElementById('tpl-breed-list');
    if (!especie || !labelRaza || !breedList) return;
    const v = especie.value;
    if (v === 'Perro'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, DOG_BREEDS); }
    else if (v === 'Gato'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, CAT_BREEDS); }
    else if (v === 'Exótico'){ labelRaza.textContent = 'Especie (exóticos) *'; setOpts(breedList, EXOTIC_TYPES); }
    else { labelRaza.textContent = 'Raza / Tipo *'; setOpts(breedList, []); }
  }
})();
 /* TPL: FIN BLOQUE NUEVO */
