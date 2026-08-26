import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-dark text-light p-6 md:p-12 selection:bg-primary selection:text-dark">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center justify-between border-b border-white/5 pb-6">
          <Link to="/" className="flex items-center gap-2 text-xs font-semibold text-gray hover:text-primary transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al inicio</span>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center text-dark font-bold shadow-neon-primary">
              <Sparkles className="w-4 h-4 text-dark" />
            </div>
            <span className="font-bold text-sm text-light">FinanzApp</span>
          </div>
        </div>

        <div className="card-glass p-8 space-y-6 text-sm text-gray leading-relaxed">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-light">Términos de Servicio</h1>
              <p className="text-xs text-gray">Última actualización: Agosto 2026</p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">1. Aceptación de los Términos</h2>
            <p>
              Al acceder y utilizar FinanzApp, aceptas cumplir estos Términos de Servicio y todas las leyes aplicables. Si no estás de acuerdo, te solicitamos no utilizar la plataforma.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">2. Uso de la Aplicación</h2>
            <p>
              FinanzApp es una herramienta de gestión financiera personal diseñada para ayudarte a rastrear presupuestos y gastos. No somos una entidad bancaria, ni ofrecemos asesoría financiera personalizada o inversiones.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">3. Cuentas y Responsabilidad</h2>
            <p>
              Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de todas las actividades realizadas en tu cuenta.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">4. Contacto y Soporte</h2>
            <p>
              Para cualquier consulta sobre estos términos, comunícate con nosotros a <a href="mailto:soporte@byfinanzapp.com" className="text-primary hover:underline">soporte@byfinanzapp.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
