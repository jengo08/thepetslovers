/* TPL: INICIO BLOQUE NUEVO [Submit en captura + guardado local + seguro vet condicional + foto compacta y ajuste táctil] */
(function(){
  'use strict';

  // ===== Listas (carga JSON si existe) =====
  let DOG_BREEDS = ["Mestizo","Labrador Retriever","Golden Retriever","Pastor Alemán","Bulldog Francés","Caniche / Poodle","Chihuahua","Pomerania","Yorkshire Terrier","Shih Tzu","Beagle","Bóxer","Border Collie","Dálmata","Rottweiler","Husky Siberiano","Cocker Spaniel","Teckel / Dachshund","Pastor Belga Malinois","Pastor Australiano"];
  let CAT_BREEDS = ["Mestizo","Europeo Común","Siamés","Persa","Maine Coon","Bengalí","Ragdoll","Sphynx","British Shorthair","Scottish Fold","Azul Ruso","Noruego de Bosque","Bosque de Siberia","Abisinio","Exótico de Pelo Corto"];
  const EXOTIC_TYPES = ["Pájaro","Conejo","Hurón","Hámster","Cobaya","Erizo","Iguana","Lagarto","Camaleón","Serpiente","Rana","Tortuga","Araña","Otro"];
  fetch('tpl-razas.json').then(r=>r.ok?r.json():null).then(j=>{
    if (!j) return;
    if (Array.isArray(j.perro)) DOG_BREEDS = j.perro;
    if (Array.isArray(j.gato))  CAT_BREEDS = j.gato;
    if (document.readyState !== 'loading') updateBreedList();
  }).catch(()=>{});

  // ===== Helpers =====
  const $ = (sel, root=document) => root.querySelector(sel);
  const byId = (id) => document.getElementById(id);
  const setOpts = (datalist, arr) => { datalist.innerHTML = arr.map(x=>`<option value="${escapeHtml(x)}"></option>`).join(''); };
  function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g,m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  function fitCoverScale(imgW, imgH, boxW, boxH){ return Math.max(boxW/imgW, boxH/imgH); }

  // ===== Estado foto / crop =====
  let originalImg = null, imageReady = false, currentCroppedDataUrl = '';
  let cropState = { offX:0, offY:0, scale:1 };

  function drawToCanvas(ctx, img, offX, offY, scale, W, H){
    const dw = img.width * scale, dh = img.height * scale;
    const minX = W - dw, maxX = 0, minY = H - dh, maxY = 0;
    const x = Math.min(maxX, Math.max(minX, offX));
    const y = Math.min(maxY, Math.max(minY, offY));
    ctx.clearRect(0,0,W,H);
    ctx.drawImage(img, x, y, dw, dh);
    return {x,y};
  }

  // ===== Anti-overlay SUBMIT en captura: llamamos a nuestro manejador y frenamos el resto
  document.addEventListener('submit', (e)=>{
    if (e.target && e.target.id === 'tpl-pet-form'){
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      handleSubmit(e.target);
    }
  }, true);

  // ===== Anti-overlay para el file input (captura) para que nadie dispare subidas
  document.addEventListener('change', (e)=>{
    if (e.target && e.target.id === 'foto'){ e.stopPropagation(); e.stopImmediatePropagation(); }
  }, true);

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
    const breedList = byId('tpl-breed-list');

    const microchip = byId('microchip');
    const microNo   = byId('microchip_no_tiene');

    const seguroVet     = byId('seguroVet');
    const seguroVetData = byId('seguroVetData');
    const seguroVetComp = byId('seguroVetComp');
    const seguroVetNum  = byId('seguroVetNum');
    const seguroRC      = byId('seguroRC');

    const camaras   = byId('camaras');
    const fotosSel  = byId('fotos');

    // Icono por especie cuando no hay foto
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
        avatarBox.classList.remove('has-image');
        photoActions.style.display='none';
        photoPickRow.style.display='block';
        currentCroppedDataUrl=''; originalImg=null; imageReady=false;
        updateSpeciesIcon();
        return;
      }
      const tmp = URL.createObjectURL(f);
      preview.src = tmp;
      avatarBox.classList.add('has-image');
      photoPickRow.style.display = 'none';
      photoActions.style.display = 'flex';
      originalImg = new Image();
      originalImg.onload = ()=>{ URL.revokeObjectURL(tmp); imageReady = true; };
      originalImg.src = tmp;
      currentCroppedDataUrl='';
    }, {capture:false});

    btnChange.addEventListener('click', () => fileInput.click());

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

    // Seguro Vet: detalles SOLO si “Sí”
    function toggleSeguroVet(){
      const yes = (seguroVet.value === 'Sí');
      seguroVetData.classList.toggle('is-hidden', !yes);
      seguroVetComp.required = seguroVetNum.required = yes;
      if (!yes){ seguroVetComp.value=''; seguroVetNum.value=''; }
    }
    seguroVet.addEventListener('change', toggleSeguroVet);
    toggleSeguroVet();

    // Cropper minimal (drag / flechas)
    const modal = byId('cropperModal');
    const cropCanvas = byId('cropCanvas');
    const ctx = cropCanvas.getContext('2d');
    const btnCancel = byId('btnCancelCrop');
    const btnApply  = byId('btnApplyCrop');
    let dragging=false, lastX=0, lastY=0;

    function openCropper(){
      if (!imageReady){
        const src = preview && preview.src;
        if (!src || /pet-placeholder\.png$/i.test(src)) { fileInput.click(); return; }
        originalImg = new Image();
        originalImg.onload = ()=>{ imageReady=true; initAndDraw(); };
        originalImg.crossOrigin = 'anonymous';
        originalImg.src = src;
      }
      initAndDraw();
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
    function closeCropper(){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); document.body.style.overflow=''; }

    btnAdjust.addEventListener('click', openCropper);
    btnCancel.addEventListener('click', closeCropper);

    cropCanvas.addEventListener('pointerdown', (e)=>{
      if (!imageReady) return;
      dragging=true; cropCanvas.setPointerCapture(e.pointerId);
      lastX=e.clientX; lastY=e.clientY;
    });
    cropCanvas.addEventListener('pointermove', (e)=>{
      if (!dragging || !imageReady) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      lastX = e.clientX; lastY = e.clientY;
      const W = cropCanvas.width, H = cropCanvas.height;
      const p = drawToCanvas(ctx, originalImg, cropState.offX+dx, cropState.offY+dy, cropState.scale, W, H);
      cropState.offX = p.x; cropState.offY = p.y;
    });
    cropCanvas.addEventListener('pointerup', ()=>{ dragging=false; });
    cropCanvas.addEventListener('pointercancel', ()=>{ dragging=false; });

    modal.addEventListener('keydown', (e)=>{
      if (!imageReady) return;
      const step = 3;
      let moved=false;
      if (e.key==='ArrowLeft'){ cropState.offX -= step; moved=true; }
      if (e.key==='ArrowRight'){ cropState.offX += step; moved=true; }
      if (e.key==='ArrowUp'){ cropState.offY -= step; moved=true; }
      if (e.key==='ArrowDown'){ cropState.offY += step; moved=true; }
      if (moved){
        e.preventDefault();
        const W = cropCanvas.width, H = cropCanvas.height;
        const p = drawToCanvas(ctx, originalImg, cropState.offX, cropState.offY, cropState.scale, W, H);
        cropState.offX = p.x; cropState.offY = p.y;
      }
      if (e.key==='Escape'){ closeCropper(); }
    });

    btnApply.addEventListener('click', ()=>{
      if (!imageReady) return closeCropper();
      const out = document.createElement('canvas');
      out.width = 256; out.height = 256;
      const octx = out.getContext('2d');
      const factor = 256/320;
      drawToCanvas(octx, originalImg, cropState.offX*factor, cropState.offY*factor, cropState.scale*factor, 256, 256);
      currentCroppedDataUrl = out.toDataURL('image/jpeg', 0.9);
      preview.src = currentCroppedDataUrl;
      avatarBox.classList.add('has-image');
      closeCropper();
    });

    // Por si algún script engancha el click del botón, forzamos nuestro flujo
    byId('saveBtn').addEventListener('click', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      handleSubmit(form);
    }, true);
  });

  // ===== Lógica de guardado (reutilizable desde captura y desde botón) =====
  function handleSubmit(form){
    const byId = (id)=>document.getElementById(id);
    const microNo   = byId('microchip_no_tiene');
    const microchip = byId('microchip');
    if (!microNo.checked && !microchip.value.trim()){
      alert('El microchip es obligatorio (o marca “No tiene”).');
      microchip.focus(); return;
    }
    if
