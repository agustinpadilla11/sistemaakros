import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, getDocs, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Users, AlertCircle, DollarSign, Calendar, Mail, XCircle, Download } from 'lucide-react';
import { isBefore, addDays, format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { useAuth } from '../../hooks/useAuth';

export default function AdminDashboard() {
  const { userData } = useAuth();
  if (!userData) return null;

  const [stats, setStats] = useState({
    totalActivas: 0,
    cuotasMesPagadas: 0,
    cuotasHoyPagadas: 0,
    cuotasMesPendientesAmt: 0,
    cuotasMesPendientesCount: 0,
    aptosPorVencer: 0,
    pendientesAprobacion: 0
  });

  const [alumnasVencidas, setAlumnasVencidas] = useState<any[]>([]);
  const [alertasPago, setAlertasPago] = useState<any[]>([]);
  const [pendientesList, setPendientesList] = useState<any[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showTodayPaymentsModal, setShowTodayPaymentsModal] = useState(false);
  const [cuotasHoy, setCuotasHoy] = useState<any[]>([]);
  useEffect(() => {
    async function loadStats() {
      const alumnasSnap = await getDocs(collection(db, 'alumnas'));
      let activas = 0;
      const today = new Date();
      
      alumnasSnap.forEach(doc => {
        if (doc.data().estado === 'activa') activas++;
      });
      
      const paidCuotasSnap = await getDocs(query(
        collection(db, 'cuotas'),
        where('estado', '==', 'pagado')
      ));

      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

      let pagadasCountHoy = 0;
      let pagadasCountMes = 0;
      const cuotasHoyTemp: any[] = [];

      paidCuotasSnap.forEach(doc => {
        const data = doc.data();
        if (data.fecha_pago) {
          const fp = data.fecha_pago.toDate ? data.fecha_pago.toDate() : new Date(data.fecha_pago);
          
          if (fp >= monthStart && fp <= monthEnd) {
            pagadasCountMes++;
          }

          if (fp >= todayStart && fp <= todayEnd) {
            pagadasCountHoy++;
            const alumna = alumnasSnap.docs.find(a => a.id === data.alumna_id)?.data();
            cuotasHoyTemp.push({
              id: doc.id,
              ...data,
              gimnasta: alumna ? alumna.nombre_completo : 'Desconocida',
              medio: data.metodo_pago || data.metodo || 'Efectivo',
              fechaPagoDate: fp
            });
          }
        }
      });

      setStats(prev => ({
        ...prev,
        totalActivas: activas,
        cuotasMesPagadas: pagadasCountMes,
        cuotasHoyPagadas: pagadasCountHoy
      }));
      
      cuotasHoyTemp.sort((a, b) => b.fechaPagoDate.getTime() - a.fechaPagoDate.getTime());
      setCuotasHoy(cuotasHoyTemp);
    }
    loadStats();
  }, []);
  
  const handleAutoSendAll = async () => {
    if (!window.confirm(`¿Estás seguro de enviar notificaciones automáticas por email a los ${alumnasVencidas.length} registros vencidos?`)) return;
    setIsSending(true);
    
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
       if (!res.ok) throw new Error(data.error || 'Error del servidor');
       alert(`Éxito. ${data.message}`);
    } catch (e: any) {
       console.error(e);
       alert("Ocurrió un error al enviar: " + e.message);
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
      {/* HEADER WITH REFRESH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-800 uppercase tracking-tight">Panel de Control</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Resumen general y alertas del sistema</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 items-center">

           <button 
             onClick={() => window.location.reload()} 
             className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
           >
             <Calendar className="w-4 h-4" />
             Actualizar Datos
           </button>
        </div>
      </div>

      {/* TARJETAS DE ESTADISTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
        <StatCard 
          title="Total Alumnas"
          value={stats.totalActivas}
          subtitle="Activas en el sistema"
          subColor="text-purple-600"
          borderColor="border-slate-200"
        />
        <StatCard 
          title="Cuotas Cobradas"
          value={stats.cuotasHoyPagadas}
          subtitle={`${stats.cuotasMesPagadas} en el mes · Ver hoy ↗`}
          subColor="text-emerald-600 font-bold"
          borderColor="border-l-emerald-500"
          valueColor="text-emerald-600"
          onClick={() => setShowTodayPaymentsModal(true)}
        />
      </div>



      {/* MODAL CUOTAS DE HOY */}
      {showTodayPaymentsModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                   <h2 className="text-sm font-black uppercase tracking-tight text-slate-800">Cuotas Pagadas Hoy</h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                     Detalle de ingresos por cuotas del día
                   </p>
                </div>
                <button onClick={() => setShowTodayPaymentsModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                   <XCircle className="w-8 h-8"/>
                </button>
             </div>
             
             <div className="flex-1 overflow-y-auto p-6 bg-white">
                {cuotasHoy.length > 0 ? (
                  <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] uppercase text-slate-400 tracking-widest font-black border-b border-slate-100 pb-3">
                           <th className="pb-4">Gimnasta</th>
                           <th className="pb-4 text-center">Cuota de</th>
                           <th className="pb-4 text-center">Método</th>
                           <th className="pb-4 text-center">Pagado el</th>
                           <th className="pb-4 text-right">Monto</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-50">
                        {cuotasHoy.map((c, idx) => (
                           <tr key={c.id || idx} className="hover:bg-slate-50 transition-colors">
                              <td className="py-4 text-xs font-black uppercase text-slate-800">{c.gimnasta}</td>
                              <td className="py-4 text-xs text-slate-500 font-medium text-center uppercase">
                                 {c.mes}/{c.anio}
                              </td>
                              <td className="py-4 text-center">
                                 <span className="text-[9px] font-black uppercase px-2 py-1 rounded bg-purple-50 text-purple-700">
                                    {c.medio}
                                 </span>
                              </td>
                              <td className="py-4 text-xs text-slate-500 font-medium text-center">
                                 {format(c.fechaPagoDate, "dd/MM/yyyy HH:mm")} hs
                              </td>
                              <td className="py-4 text-xs font-bold text-emerald-600 text-right">
                                 ${c.monto.toLocaleString('es-AR')}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
                ) : (
                  <div className="py-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                     No se han registrado cuotas pagadas en el día de hoy.
                  </div>
                )}
             </div>
             <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <div className="text-left">
                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Hoy:</span>
                   <p className="text-lg font-black text-emerald-600">
                      ${cuotasHoy.reduce((acc, c) => acc + c.monto, 0).toLocaleString('es-AR')}
                   </p>
                </div>
                <button 
                  onClick={() => setShowTodayPaymentsModal(false)} 
                  className="px-6 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors shadow-lg"
                >
                  Cerrar
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, subtitle, subColor, borderColor, valueColor = "text-slate-800", onClick }: any) {
  const isClickable = !!onClick;
  return (
    <div 
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`bg-white p-5 rounded-xl border border-slate-200 shadow-sm text-left transition-all ${
        borderColor.includes('border-l-') ? borderColor + ' border-l-4' : ''
      } ${
        isClickable ? 'hover:shadow-md hover:border-emerald-400 cursor-pointer active:scale-95 duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500' : ''
      }`}
    >
      <p className="text-xs font-bold text-slate-400 uppercase">{title}</p>
      <p className={`text-3xl font-black mt-1 ${valueColor}`}>{value}</p>
      {subtitle && <div className={`text-xs font-bold mt-2 ${subColor}`}>{subtitle}</div>}
    </div>
  );
}
