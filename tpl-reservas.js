/*
},
total_cliente: bk.subtotal, pagar_ahora: bk.pagar_ahora, pendiente: bk.pendiente,
total_txt: fmt(bk.subtotal), pay_now_txt: fmt(bk.pagar_ahora), pay_later_txt: fmt(bk.pendiente),
summaryField: document.getElementById('breakdown').innerText
};


try {
const ref = await db.collection('reservas').add(doc);


// EmailJS → cliente
const params = {
reserva_id: ref.id,
service: doc.service, startDate: doc.startDate, endDate: doc.endDate,
Hora_inicio: doc.Hora_inicio, Hora_fin: doc.Hora_fin,
species: doc.species, summaryField: doc.summaryField,
firstName: doc.titular.firstName, email: doc.titular.email, phone: doc.titular.phone,
region: doc.titular.region, address: doc.titular.address, postalCode: doc.titular.postalCode,
observations: doc.titular.observations,
_estado: doc._estado, _uid: doc._uid, _email: doc._email,
total_cliente: doc.total_cliente, pagar_ahora: doc.pagar_ahora, pendiente: doc.pendiente,
total_txt: doc.total_txt, pay_now_txt: doc.pay_now_txt, pay_later_txt: doc.pay_later_txt,
admin_email: (window.TPL_EMAILJS?.adminEmail || 'gestion@thepetslovers.es')
};


await emailjs.send(window.TPL_EMAILJS.serviceId, window.TPL_EMAILJS.templates.cliente, params);
// EmailJS → gestión
await emailjs.send(window.TPL_EMAILJS.serviceId, window.TPL_EMAILJS.templates.gestion, params);


alert('Tu reserva se ha registrado y está en revisión.');
// Copia a localStorage (respaldo ligero)
try { localStorage.setItem('lastReserva', JSON.stringify({ id: ref.id, ...doc })); } catch(e) {}
// Redirect suave a perfil
setTimeout(()=> location.href = '/perfil.html', 600);
}
catch(err){
console.error(err);
alert('No se pudo completar la reserva. Revísalo e inténtalo de nuevo.');
}
});


// Inicialización
(function init(){
// Fechas mínimas (hoy)
$('#startDate').min = todayStr();
$('#endDate').min = todayStr();


// Preselección servicio
preselectService();
syncSpeciesUI();
ensureInlineControls();
refresh();
})();
})();
