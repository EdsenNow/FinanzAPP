(function() {
  const customHost = "byfinanzapp.com";
  // Evitar bucles redirigiendo solo si estamos en un dominio por defecto de Firebase
  if (window.location.hostname && (window.location.hostname === "finanzapp-fb.web.app" || window.location.hostname === "finanzapp-fb.firebaseapp.com")) {
    const canonicalUrl = "https://" + customHost + window.location.pathname + window.location.search + window.location.hash;
    window.location.replace(canonicalUrl);
  }
})();
