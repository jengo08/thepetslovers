document.addEventListener('DOMContentLoaded', () => {
    const cookieModalOverlay = document.getElementById('cookie-modal-overlay');
    const acceptButton = document.getElementById('accept-cookies');
    const denyButton = document.getElementById('deny-cookies');

    if (localStorage.getItem('cookies-accepted') === 'true') {
        cookieModalOverlay.style.display = 'none';
    } else {
        cookieModalOverlay.style.display = 'flex';
    }

    acceptButton.addEventListener('click', () => {
        localStorage.setItem('cookies-accepted', 'true');
        cookieModalOverlay.style.display = 'none';
    });
    
    denyButton.addEventListener('click', () => {
        cookieModalOverlay.style.display = 'none';
    });
});
