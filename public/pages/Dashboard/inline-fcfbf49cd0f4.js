window.addEventListener('load', function() {
      if (typeof window.jspdf !== 'undefined' && !window.jsPDF) {
        window.jsPDF = window.jspdf.jsPDF;
      }
    });
