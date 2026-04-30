import { useState, useEffect } from 'react';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Users, AlertCircle, DollarSign, Calendar, Mail } from 'lucide-react';
import { isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useAuth } from '../../hooks/useAuth';

export default function AdminDashboard() {
  const { userData } = useAuth();
  if (!userData) return null;
  const [stats, setStats] = useState({
    totalActivas: 0,
    cuotasMesPagadas: 0,
    cuotasMesPendientesAmt: 0,
    cuotasMesPendientesCount: 0,
    aptosPorVencer: 0,
    pendientesAprobacion: 0
  });

  const [alumnasVencidas, setAlumnasVencidas] = useState<any[]>([]);
  const [alertasPago, setAlertasPago] = useState<any[]>([]);

  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function loadStats() {
      // In a real app we might fetch selectively or use aggregations.
      // Doing basic fetching for prototype logic.
      
      const alumnasSnap = await getDocs(collection(db, 'alumnas'));
      let activas = 0;
      let pendientes = 0;
      let aptosXVencer = 0;
      const today = new Date();
      // Logic for changing year: valid for 365 days
      const in30Days = addDays(today, 30);
      
      const vencidas: any[] = [];

      alumnasSnap.forEach(doc => {
        const data = doc.data();
        if (data.estado === 'activa') activas++;
        if (data.estado === 'pendiente_aprobacion') pendientes++;
        
        if (data.estado === 'activa' && data.fecha_apto_medico) {
          const aptoDate = data.fecha_apto_medico.toDate();
          // Certificados valen 1 año (365 días)
          const fechaVencimiento = addDays(aptoDate, 365); 
          if (isBefore(fechaVencimiento, in30Days)) {
            aptosXVencer++;
            vencidas.push({ id: doc.id, ...data, aptoDate, fechaVencimiento });
          }
        } else if (data.estado === 'activa' && !data.fecha_apto_medico) {
           // Also consider missing ones as expired/needed.
           aptosXVencer++;
           vencidas.push({ id: doc.id, ...data, aptoDate: null, fechaVencimiento: null });
        }
      });
      
      setAlumnasVencidas(vencidas.sort((a, b) => {
         if (!a.fechaVencimiento) return -1;
         if (!b.fechaVencimiento) return 1;
         return a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
      }));

      const cuotasSnap = await getDocs(query(
        collection(db, 'cuotas'),
        where('mes', '==', today.getMonth() + 1),
        where('anio', '==', today.getFullYear())
      ));

      let pagadasCount = 0;
      let pendientesCount = 0;
      let pendientesAmt = 0;

      cuotasSnap.forEach(doc => {
        const data = doc.data();
        if (data.estado === 'pagado') pagadasCount++;
        if (data.estado === 'pendiente' || data.estado === 'vencido') {
          pendientesCount++;
          pendientesAmt += data.monto;
        }
      });

      setStats({
        totalActivas: activas,
        cuotasMesPagadas: pagadasCount,
        cuotasMesPendientesCount: pendientesCount,
        cuotasMesPendientesAmt: pendientesAmt,
        aptosPorVencer: aptosXVencer,
        pendientesAprobacion: pendientes
      });

      // Fetch ALL unpaid cuotas to identify debtors
      const unpaidSnap = await getDocs(query(
        collection(db, 'cuotas'),
        where('estado', '!=', 'pagado')
      ));

      const alerts: any[] = [];
      unpaidSnap.forEach(d => {
         const c = d.data();
         const alu = alumnasSnap.docs.find(a => a.id === c.alumna_id)?.data();
         if (!alu || alu.estado !== 'activa') return;

         const isCurrentMonth = c.mes === (today.getMonth() + 1) && c.anio === today.getFullYear();
         const isPastMonth = c.anio < today.getFullYear() || (c.anio === today.getFullYear() && c.mes < (today.getMonth() + 1));
         
         if (isCurrentMonth && today.getDate() > 15) {
            alerts.push({ id: d.id, ...c, alumnaNombre: alu.nombre_completo, alumnaEmail: alu.email_contacto, severity: 'yellow', label: 'Cuota Mes Actual (Atrasada)' });
         } else if (isPastMonth) {
            alerts.push({ id: d.id, ...c, alumnaNombre: alu.nombre_completo, alumnaEmail: alu.email_contacto, severity: 'red', label: `Deuda Mes ${c.mes}/${c.anio}` });
         }
      });

      setAlertasPago(alerts.sort((a, b) => (a.severity === 'red' ? -1 : 1)));
    }
    loadStats();
  }, []);
  
  const handleAutoSendAll = async () => {
    if (!window.confirm(`¿Estás seguro de enviar notificaciones automáticas por email a los ${alumnasVencidas.length} registros vencidos?`)) return;
    setIsSending(true);
    
    // Obtenemos todos los que tengan email
    const recipients = alumnasVencidas
      .filter(a => a.email_contacto)
      .map(a => ({
         email: a.email_contacto,
         nombre: a.nombre_completo,
         id: a.id
      }));

    if (recipients.length === 0) {
      alert("No hay padres con emails registrados en esta lista.");
      setIsSending(false);
      return;
    }

    try {
       const res = await fetch('/api/send-reminders', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ recipients })
       });

       const data = await res.json();
       if (!res.ok) {
         throw new Error(data.error || 'Error del servidor');
       }

       alert(`Éxito. ${data.message}`);
       
       // Here you'd update Firestore for each sent so they don't get the email twice
       // We'll leave it as requested for prototype
       
    } catch (e: any) {
       console.error(e);
       alert("Ocurrió un error al enviar. Asegúrate de haber configurado tu RESEND_API_KEY en el servidor: " + e.message);
    } finally {
       setIsSending(false);
    }
  };

  const composeEmail = (alumna: any, type: 'apto' | 'pago' = 'apto', cuotaLabel?: string) => {
    const parentEmail = alumna.email_contacto || alumna.alumnaEmail || '';
    if (!parentEmail) {
       alert('Esta gimnasta no tiene un correo electrónico de contacto registrado.');
       return;
    }
    
    let subject = '';
    let body = '';

    if (type === 'apto') {
      subject = `Aviso de Vencimiento de Certificado Médico - ${alumna.nombre_completo}`;
      body = `Señor papa el certificado medico de aptitud fisica ha cauducado. Para que su hija pueda realizar la actividad y competir en torneos debera actualizar el certificado medico de aptitud fisica lo antes posible.\n\nAtte gimnasio Akros`;
    } else {
      subject = `Aviso de Cuota Pendiente - ${alumna.nombre_completo || alumna.alumnaNombre}`;
      body = `Hola, te informamos que registramos una cuota pendiente (${cuotaLabel}). Por favor, regulariza la situación a la brevedad para evitar recargos.\n\nAtte gimnasio Akros`;
    }

    window.location.href = `mailto:${parentEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Total Alumnas"
          value={stats.totalActivas}
          subtitle="Activas en el sistema"
          subColor="text-purple-600"
          borderColor="border-slate-200"
        />
        <StatCard 
          title="Pendientes (Insc.)"
          value={stats.pendientesAprobacion}
          subtitle="Nuevas solicitudes"
          subColor="text-purple-600"
          borderColor="border-l-purple-600"
        />
        <StatCard 
          title="Aptos Médicos x Vencer"
          value={stats.aptosPorVencer}
          subtitle="Revisar"
          subColor="text-amber-600 font-bold"
          borderColor="border-l-amber-500"
        />
        <StatCard 
          title="Cuotas Cobradas (Mes)"
          value={stats.cuotasMesPagadas}
          subtitle="Pagos del mes"
          subColor="text-emerald-600"
          borderColor="border-l-emerald-500"
          valueColor="text-emerald-600"
        />
      </div>
      
      {alumnasVencidas.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center bg-amber-50/50">
              <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
              <h3 className="font-bold text-sm uppercase tracking-tight text-slate-800">Alertas: Certificados Médicos</h3>
              <div className="ml-auto">
                 <button 
                    onClick={handleAutoSendAll}
                    disabled={isSending}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-xs font-bold uppercase tracking-widest transition-colors shadow-sm"
                 >
                    <Mail className="w-4 h-4" />
                    {isSending ? 'Enviando Avisos...' : 'Avisar Certificados'}
                 </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="p-4 font-bold">Gimnasta</th>
                    <th className="p-4 font-bold">Estado Apto</th>
                    <th className="p-4 font-bold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {alumnasVencidas.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-800 uppercase text-xs">{a.nombre_completo}</p>
                      </td>
                      <td className="p-4">
                        {a.fechaVencimiento ? (
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isBefore(a.fechaVencimiento, new Date()) ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                              {isBefore(a.fechaVencimiento, new Date()) ? 'Vencido (' : 'Vence ('}
                              {format(a.fechaVencimiento, "d 'de' MMMM, yyyy", { locale: es })}
                              )
                           </span>
                        ) : (
                           <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">Sin cargar</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <button onClick={() => composeEmail(a, 'apto')} disabled={!a.email_contacto} className="text-amber-600 hover:text-amber-800 transition-colors"><Mail className="w-4 h-4"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      {/* Alertas de Pago */}
      {alertasPago.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
              <DollarSign className="w-5 h-5 text-slate-800 mr-2" />
              <h3 className="font-bold text-sm uppercase tracking-tight text-slate-800">Alertas de Pago y Morosidad</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="p-4 font-bold">Gimnasta</th>
                    <th className="p-4 font-bold">Detalle de Deuda</th>
                    <th className="p-4 font-bold">Monto</th>
                    <th className="p-4 font-bold text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {alertasPago.map(a => (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-slate-800 uppercase text-xs">{a.alumnaNombre}</p>
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          a.severity === 'red' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {a.label}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-bold text-slate-600">${a.monto}</td>
                      <td className="p-4 text-right">
                         <button 
                           onClick={() => composeEmail(a, 'pago', a.label)} 
                           disabled={!a.alumnaEmail}
                           className={`p-2 rounded-full transition-colors ${a.severity === 'red' ? 'text-red-600 hover:bg-red-50' : 'text-yellow-600 hover:bg-yellow-50'}`}
                         >
                            <Mail className="w-4 h-4" />
                         </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[150px] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-400 font-medium mb-2">Aquí puedes visualizar próximos reportes o gráficos.</p>
          <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">En desarrollo</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, subColor, borderColor, valueColor = "text-slate-800" }: any) {
  return (
    <div className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm ${borderColor.includes('border-l-') ? borderColor + ' border-l-4' : ''}`}>
      <p className="text-xs font-bold text-slate-400 uppercase">{title}</p>
      <p className={`text-3xl font-black mt-1 ${valueColor}`}>{value}</p>
      {subtitle && <div className={`text-xs font-bold mt-2 ${subColor}`}>{subtitle}</div>}
    </div>
  );
}
