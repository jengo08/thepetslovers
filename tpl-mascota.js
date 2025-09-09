/* TPL: INICIO BLOQUE NUEVO [Mascota: crear/editar/eliminar con confirm y UID robusto — FIX bind en edición] */
(function(){
  'use strict';

  // ====== Base por usuario (localStorage) ======
  function getCurrentUserId(){
    var explicit = localStorage.getItem('tpl.currentUser');
    if (explicit) return explicit;
    var uidLS = localStorage.getItem('tpl_auth_uid');
    if (uidLS) return uidLS;
    try{
      if (window.firebase && typeof firebase.auth === 'function'){
        var u = firebase.auth().currentUser;
        if (u && !u.isAnonymous && u.uid) return u.uid;
      }
    }catch(_){}
    return 'default';
  }
  function udbKey(uid, key){ return `tpl.udb.${uid}.${key}`; }
  function udbGet(uid, key, fallback){
    try { const v = localStorage.getItem(udbKey(uid,key)); return v ? JSON.parse(v) : fallback; }
    catch(_){ return fallback; }
  }
  function udbSet(uid, key, value){ try { localStorage.setItem(udbKey(uid,key), JSON.stringify(value)); } catch(_){ } }
  function udbHas(uid, key){ try { return localStorage.getItem(udbKey(uid,key)) !== null; }catch(_){ return false; } }

  // ===== Listas de razas (con posible JSON externo) =====
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
  const setOpts = (datalist, arr) => { if(!datalist) return; datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
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
    try{
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

      // Botones/Modal eliminar (si existen en tu HTML)
      const deleteRow = byId('tpl-delete-row');
      let deleteBtn   = byId('tpl-delete'); // puede no existir; habrá fallback
      const deleteModal = byId('deleteModal');
      const btnCancelDelete = byId('btnCancelDelete');
      const btnConfirmDelete = byId('btnConfirmDelete');

      // Icono por especie (si no hay foto)
      function updateSpeciesIcon(){
        if (!avatarIcon || !especie) return;
        const v = especie.value;
        let cls = 'fa-paw';
        if (v === 'Perro') cls = 'fa-dog';
        else if (v === 'Gato') cls = 'fa-cat';
        else if (v === 'Exótico') cls = 'fa-dove';
        avatarIcon.innerHTML = `<i class="fa-solid ${cls}"></i>`;
      }

      // Preview al elegir archivo
      if (fileInput){
        fileInput.addEventListener('change', () => {
          const f = fileInput.files && fileInput.files[0];
          if (!f){
            if (preview) preview.src = 'images/pet-placeholder.png';
            if (avatarBox) avatarBox.classList.remove('has-image');
            if (photoActions) photoActions.style.display='none';
            if (photoPickRow) photoPickRow.style.display='block';
            currentCroppedDataUrl=''; originalImg=null; imageReady=false;
            updateSpeciesIcon();
            return;
          }
          const tmp = URL.createObjectURL(f);
          if (preview) preview.src = tmp;
          if (avatarBox) avatarBox.classList.add('has-image');
          if (photoPickRow) photoPickRow.style.display = 'none';
          if (photoActions) photoActions.style.display = 'flex';

          originalImg = new Image();
          originalImg.onload = ()=>{ URL.revokeObjectURL(tmp); imageReady = true; };
          originalImg.src = tmp;
          currentCroppedDataUrl='';
        });
      }
      if (btnChange){ btnChange.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); fileInput && fileInput.click(); }); }

      // Microchip obligatorio salvo "No tiene"
      function updateMicroState(){
        if (!microchip || !microNo) return;
        if (microNo.checked){
          microchip.value = '';
          microchip.setAttribute('disabled','disabled');
          microchip.removeAttribute('required');
        } else {
          microchip.removeAttribute('disabled');
          microchip.setAttribute('required','required');
        }
      }
      if (microNo){ microNo.addEventListener('change', updateMicroState); }
      updateMicroState();

      // Especie -> razas/tipos + icono
      function updateBreedList(){
        if (!especie || !labelRaza || !breedList) return;
        const v = especie.value;
        if (v === 'Perro'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, DOG_BREEDS); }
        else if (v === 'Gato'){ labelRaza.textContent = 'Raza *'; setOpts(breedList, CAT_BREEDS); }
        else if (v === 'Exótico'){ labelRaza.textContent = 'Especie (exóticos) *'; setOpts(breedList, EXOTIC_TYPES); }
        else { labelRaza.textContent = 'Raza / Tipo *'; setOpts(breedList, []); }
        if (!(avatarBox && avatarBox.classList.contains('has-image'))) updateSpeciesIcon();
      }
      if (especie){ especie.addEventListener('change', updateBreedList); }
      updateBreedList();

      // ===== Seguro Vet: detalles SOLO si “Sí” =====
      function toggleSeguroVet(){
        if (!seguroVet || !seguroVetData) return;
        const yes = (seguroVet.value === 'Sí');
        seguroVetData.classList.toggle('is-hidden', !yes);
        seguroVetData.hidden = !yes;
        if (seguroVetComp) seguroVetComp.required = !!yes;
        if (seguroVetNum)  seguroVetNum.required  = !!yes;
        if (!yes){
          if (seguroVetComp) seguroVetComp.value = '';
          if (seguroVetNum)  seguroVetNum.value  = '';
        }
      }
      if (seguroVet){
        seguroVet.addEventListener('change', toggleSeguroVet);
        toggleSeguroVet();
      }

      // ===== Cropper minimal (drag/flechas) =====
      const modal = byId('cropperModal');
      const cropCanvas = byId('cropCanvas');
      const ctx = cropCanvas ? cropCanvas.getContext('2d') : null;
      const btnCancel = byId('btnCancelCrop');
      const btnApply  = byId('btnApplyCrop');
      let dragging=false, lastX=0, lastY=0;

      function openCropper(){
        if (!modal || !cropCanvas || !ctx || !preview) return;
        if (!imageReady){
          const src = preview.src;
          if (!src || /pet-placeholder\.png$/i.test(src)){ fileInput && fileInput.click(); return; }
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
      if (btnAdjust){ btnAdjust.addEventListener('click', (e)=>{ e.preventDefault(); e.stopPropagation(); openCropper(); }); }
      if (btnCancel){ btnCancel.addEventListener('click', ()=>{ if(!modal) return; modal.style.display='none'; modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }); }
      if (cropCanvas){
        cropCanvas.addEventListener('pointerdown', (e)=>{ if (!imageReady) return; dragging=true; cropCanvas.setPointerCapture(e.pointerId); lastX=e.clientX; lastY=e.clientY; });
        cropCanvas.addEventListener('pointermove', (e)=>{ if (!dragging || !imageReady) return; const dx=e.clientX-lastX, dy=e.clientY-lastY; lastX=e.clientX; lastY=e.clientY; const p=drawToCanvas(ctx, originalImg, cropState.offX+dx, cropState.offY+dy, cropState.scale, cropCanvas.width, cropCanvas.height); cropState.offX=p.x; cropState.offY=p.y; });
        cropCanvas.addEventListener('pointerup', ()=>{ dragging=false; });
        cropCanvas.addEventListener('pointercancel', ()=>{ dragging=false; });
      }
      if (modal){
        modal.addEventListener('keydown', (e)=>{ if (!imageReady || !ctx || !cropCanvas) return; const step=3; let moved=false; if (e.key==='ArrowLeft'){cropState.offX-=step;moved=true;} if (e.key==='ArrowRight'){cropState.offX+=step;moved=true;} if (e.key==='ArrowUp'){cropState.offY-=step;moved=true;} if (e.key==='ArrowDown'){cropState.offY+=step;moved=true;} if (moved){ e.preventDefault(); const p=drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, cropCanvas.width, cropCanvas.height); cropState.offX=p.x; cropState.offY=p.y; } if (e.key==='Escape' && btnCancel){ btnCancel.click(); } });
      }
      if (btnApply){ btnApply.addEventListener('click', ()=>{ if (!imageReady || !ctx) return btnCancel && btnCancel.click(); const out=document.createElement('canvas'); out.width=256; out.height=256; const octx=out.getContext('2d'); const factor=256/320; drawToCanvas(octx, originalImg, cropState.offX*factor, cropState.offY*factor, cropState.scale*factor, 256,256); currentCroppedDataUrl = out.toDataURL('image/jpeg', 0.9); if (preview) preview.src = currentCroppedDataUrl; if (avatarBox) avatarBox.classList.add('has-image'); btnCancel && btnCancel.click(); }); }

      // ===== Guardar (crear/actualizar) =====
      function doSave(){
        if (!form) return false;

        if (microNo && !microNo.checked && microchip && !microchip.value.trim()){
          alert('El microchip es obligatorio (o marca “No tiene”).');
          microchip && microchip.focus();
          return false;
        }
        if (typeof form.reportValidity === 'function' && !form.reportValidity()) return false;

        const fd = new FormData(form);
        const mascota = {
          nombre: (fd.get('nombre')||'').toString().trim(),
          microchip: (microNo && microNo.checked) ? 'No tiene' : (fd.get('microchip')||'').toString().trim(),
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
          seguroVetComp: (seguroVet && seguroVet.value==='Sí') ? (byId('seguroVetComp')?.value||'') : '',
          seguroVetNum:  (seguroVet && seguroVet.value==='Sí') ? (byId('seguroVetNum')?.value ||'') : '',
          seguroRC: (fd.get('seguroRC')||'').toString(),
          foto: ''
        };

        const uid = getCurrentUserId();
        const finalize = (dataUrl) => {
          const baseFoto = currentCroppedDataUrl || dataUrl || existingFotoDataUrl || 'images/pet-placeholder.png';
          mascota.foto = baseFoto;

          const hasPets = udbHas(uid, 'pets');
          let arr = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
          if (!Array.isArray(arr)) arr = [];

          if (editIndex >= 0 && arr[editIndex]){
            arr[editIndex] = mascota;   // actualizar
          } else {
            arr.push(mascota);          // crear (modo alta)
          }

          udbSet(uid, 'pets', arr);
          if (udbHas(uid, 'mascotas')){ udbSet(uid, 'mascotas', arr); }
          try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}

          location.assign('perfil.html');
        };

        const file = fileInput && fileInput.files && fileInput.files[0];
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
        return false;
      }
      // Exponer para uso inline si lo necesitas
      window.__TPL_PET_SAVE__ = doSave;

      // —— Bind robusto al botón Guardar:
      function bindSaveButton(){
        // 1) por ID
        if (saveBtn && !saveBtn.__tplBound){
          saveBtn.__tplBound = true;
          saveBtn.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); doSave(); });
          return;
        }
        // 2) fallback: por texto “guardar … perfil”
        const cand = Array.prototype.slice.call(document.querySelectorAll('button, a'))
          .find(el => !el.__tplBound && /guardar/i.test(el.textContent||'') && /perfil/i.test(el.textContent||''));
        if (cand){
          cand.__tplBound = true;
          cand.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); doSave(); });
        }
      }
      bindSaveButton();

      /* ===== Eliminar mascota ===== */
      function actuallyDelete(){
        if (editIndex < 0) return;
        const uid = getCurrentUserId();
        const hasPets = udbHas(uid, 'pets');
        let arr = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
        if (!Array.isArray(arr)) arr = [];
        if (arr[editIndex]) arr.splice(editIndex, 1);

        udbSet(uid, 'pets', arr);
        if (udbHas(uid, 'mascotas')){ udbSet(uid, 'mascotas', arr); }
        try{ localStorage.setItem('tpl.udb.lastChange', String(Date.now())); }catch(_){}

        location.assign('perfil.html');
      }
      window.__TPL_PET_DELETE__ = actuallyDelete;

      function openDeleteModal(){
        if (deleteModal){
          deleteModal.style.display = 'flex';
          deleteModal.setAttribute('aria-hidden','false');
          document.body.style.overflow = 'hidden';
          btnConfirmDelete && btnConfirmDelete.focus();
        } else {
          if (confirm('¿Seguro que quieres eliminar esta mascota? No hay vuelta atrás.')) {
            actuallyDelete();
          }
        }
      }
      window.__TPL_PET_OPEN_DELETE__ = openDeleteModal;

      function closeDeleteModal(){
        if (!deleteModal) return;
        deleteModal.style.display = 'none';
        deleteModal.setAttribute('aria-hidden','true');
        document.body.style.overflow = '';
      }

      // —— Bind robusto al botón Eliminar:
      function bindDeleteButton(){
        // 1) por ID
        if (deleteBtn && !deleteBtn.__tplBound){
          deleteBtn.__tplBound = true;
          deleteBtn.addEventListener('click', function(e){ e.preventDefault(); openDeleteModal(); });
          return;
        }
        // 2) fallback: por texto “eliminar”
        const cand = Array.prototype.slice.call(document.querySelectorAll('button, a'))
          .find(el => !el.__tplBound && /eliminar/i.test(el.textContent||''));
        if (cand){
          deleteBtn = cand;
          cand.__tplBound = true;
          cand.addEventListener('click', function(e){ e.preventDefault(); openDeleteModal(); });
        }
      }
      bindDeleteButton();

      if (btnCancelDelete){ btnCancelDelete.addEventListener('click', function(){ closeDeleteModal(); }); }
      if (deleteModal){
        deleteModal.addEventListener('click', function(e){ if (e.target === deleteModal) closeDeleteModal(); });
        deleteModal.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeDeleteModal(); });
      }
      if (btnConfirmDelete){ btnConfirmDelete.addEventListener('click', function(){ closeDeleteModal(); actuallyDelete(); }); }

      // ===== MODO EDICIÓN (aislado: si falla, no rompe los binds) =====
      (function initEditModeSafe(){
        try{
          const params = new URLSearchParams(location.search);
          const e = params.get('edit');
          if (e == null) return;
          const idx = parseInt(e, 10);
          if (Number.isNaN(idx) || idx < 0) return;

          const uid = getCurrentUserId();
          const hasPets = udbHas(uid, 'pets');
          const arr = hasPets ? (udbGet(uid,'pets',[])||[]) : (udbGet(uid,'mascotas',[])||[]);
          if (!Array.isArray(arr) || !arr[idx]) return;

          editIndex = idx;
          const pet = arr[idx];

          const h1 = document.querySelector('h1');
          if (h1) h1.textContent = 'Editar mascota';
          if (saveBtn) saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar cambios y volver al perfil';
          if (deleteRow) deleteRow.style.display = 'flex';

          if (nombre) nombre.value = pet.nombre || '';
          if ((pet.microchip||'') === 'No tiene'){
            if (microNo) microNo.checked = true;
            updateMicroState();
          } else {
            if (microNo) microNo.checked = false;
            updateMicroState();
            if (microchip) microchip.value = pet.microchip || '';
          }

          if (especie) especie.value = pet.especie || '';
          updateBreedList();
          if (raza) raza.value = pet.raza || pet.tipoExotico || '';

          if (edad) edad.value = pet.edad || '';
          if (peso) peso.value = pet.peso || '';
          if (esterilizado) esterilizado.value = pet.esterilizado || '';
          if (vacunas) vacunas.value = pet.vacunas || '';
          if (salud) salud.value = pet.salud || '';
          if (tratamiento) tratamiento.value = pet.tratamiento || '';
          if (comidas) comidas.value = pet.comidas || '';
          if (salidas) salidas.value = pet.salidas || '';
          if (tamano) tamano.value = pet.tamano || '';
          if (clinica) clinica.value = pet.clinica || '';
          if (hospitalPref) hospitalPref.value = pet.hospitalPref || '';
          if (comportamiento) comportamiento.value = pet.comportamiento || '';

          if (camaras) camaras.value = pet.camaras || '';
          if (fotosSel) fotosSel.value = pet.fotos || '';

          if (seguroVet){
            seguroVet.value = pet.seguroVet || '';
            toggleSeguroVet();
            if (seguroVet.value === 'Sí'){
              if (seguroVetComp) seguroVetComp.value = pet.seguroVetComp || '';
              if (seguroVetNum)  seguroVetNum.value  = pet.seguroVetNum  || '';
            }
          }
          if (seguroRC) seguroRC.value = pet.seguroRC || '';

          existingFotoDataUrl = pet.foto || '';
          if (existingFotoDataUrl && !/pet-placeholder\.png$/i.test(existingFotoDataUrl)){
            if (preview) preview.src = existingFotoDataUrl;
            if (avatarBox) avatarBox.classList.add('has-image');
            if (photoPickRow) photoPickRow.style.display = 'none';
            if (photoActions) photoActions.style.display = 'flex';
          } else {
            if (avatarBox) avatarBox.classList.remove('has-image');
            if (photoActions) photoActions.style.display = 'none';
            if (photoPickRow) photoPickRow.style.display = 'block';
            updateSpeciesIcon();
          }
        }catch(e){
          console.warn('[tpl-mascota] initEditModeSafe:', e);
          // Aun si algo falla, los botones ya están enlazados (binds arriba)
        }
      })();

      // Safety: re-bind si el DOM cambia (por inyecciones tardías)
      new MutationObserver(function(){
        bindSaveButton();
        bindDeleteButton();
      }).observe(document.documentElement, { childList:true, subtree:true });

    }catch(err){
      console.error('[tpl-mascota] init error:', err);
    }
  });

  // Refrescar datalist tras cargar JSON (si llegó después del DOMContentLoaded)
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
