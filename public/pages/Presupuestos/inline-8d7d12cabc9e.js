// Script de prueba para verificar que openDatePicker está disponible
    window.addEventListener('load', function() {
      console.log('Verificando openDatePicker:', typeof window.openDatePicker);
      console.log('Verificando datePickerModal:', document.getElementById('datePickerModal'));
      
      // Si openDatePicker no está definida, mostrar error
      if (typeof window.openDatePicker !== 'function') {
        console.error('ERROR: window.openDatePicker no está definida!');
      }
    });
