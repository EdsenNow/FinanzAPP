import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft, ShieldCheck } from 'lucide-react';

export default function PrivacyPage() {
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
            <ShieldCheck className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-light">Política de Privacidad</h1>
              <p className="text-xs text-gray">Última actualización: Agosto 2026</p>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">1. Compromiso con la Privacidad</h2>
            <p>
              En FinanzApp respetamos y protegemos la privacidad de nuestros usuarios. Esta política describe cómo recopilamos, usamos y resguardamos la información cuando utilizas nuestros servicios.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">2. Datos Recopilados</h2>
            <p>
              - <b>Datos de Cuenta:</b> Nombre y correo electrónico facilitados mediante Firebase Authentication o Google Sign-In.<br />
              - <b>Datos Financieros:</b> Transacciones, presupuestos y categorías ingresados manualmente o importados mediante archivos JSON.<br />
              - <b>Datos de Gmail (Opcional):</b> Si decides conectar tu cuenta de Gmail, accedemos únicamente a los correos de remitentes bancarios autorizados para extraer montos y descripciones de transacciones en tiempo real.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">3. Divulgación de Uso Limitado de Datos de Google (CASA AL1)</h2>
            <p className="p-4 rounded-xl bg-white/5 border border-white/5 text-light text-xs">
              El uso y transferencia de información recibida de las APIs de Google por parte de FinanzApp se adhiere a la <b>Política de Datos de Usuario de los Servicios API de Google</b>, incluidos los requisitos de <i>Uso Limitado</i>. No vendemos, no transferimos para publicidad y no utilizamos datos de Gmail para entrenar modelos de IA general.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">4. Seguridad y Encriptación</h2>
            <p>
              Toda la información se transmite mediante HTTPS con cifrado TLS 1.3 y HSTS estricto. Las credenciales y tokens se almacenan en Firestore protegidos con reglas de seguridad a nivel de documento (`request.auth.uid == userId`).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-bold text-light">5. Eliminación de Datos</h2>
            <p>
              Puedes eliminar todas tus categorías y transacciones en cualquier momento desde la sección de Configuración. Si deseas borrar tu cuenta completa, puedes solicitarlo escribiendo a <a href="mailto:soporte@byfinanzapp.com" className="text-primary hover:underline">soporte@byfinanzapp.com</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
