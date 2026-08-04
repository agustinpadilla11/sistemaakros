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
      let pendientesCount = 0;
      let aptosXVencer = 0;
      const today = new Date();
      const in30Days = addDays(today, 30);
      
      const vencidas: any[] = [];
      const pendingTemp: any[] = [];

      alumnasSnap.forEach(doc => {
        const data = doc.data();
        if (data.estado === 'activa') activas++;
        if (data.estado === 'pendiente_aprobacion') {
          pendientesCount++;
          pendingTemp.push({ id: doc.id, ...data });
        }
        
        if (data.estado === 'activa' && data.fecha_apto_medico) {
          const aptoDate = data.fecha_apto_medico.toDate();
          const fechaVencimiento = addDays(aptoDate, 365); 
          if (isBefore(fechaVencimiento, in30Days)) {
            aptosXVencer++;
            vencidas.push({ id: doc.id, ...data, aptoDate, fechaVencimiento });
          }
        } else if (data.estado === 'activa' && !data.fecha_apto_medico) {
           aptosXVencer++;
           vencidas.push({ id: doc.id, ...data, aptoDate: null, fechaVencimiento: null });
        }
      });
      
      setAlumnasVencidas(vencidas.sort((a, b) => {
         if (!a.fechaVencimiento) return -1;
         if (!b.fechaVencimiento) return 1;
         return a.fechaVencimiento.getTime() - b.fechaVencimiento.getTime();
      }));

      setPendientesList(pendingTemp);

      const cuotasSnap = await getDocs(query(
        collection(db, 'cuotas'),
        where('mes', '==', today.getMonth() + 1),
        where('anio', '==', today.getFullYear())
      ));

      let unpaidCount = 0;
      let unpaidAmt = 0;

      cuotasSnap.forEach(doc => {
        const data = doc.data();
        if (data.estado === 'pendiente' || data.estado === 'vencido') {
          unpaidCount++;
          unpaidAmt += data.monto;
        }
      });

      // Fetch paid cuotas for today list modal and month count
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

      setStats({
        totalActivas: activas,
        cuotasMesPagadas: pagadasCountMes,
        cuotasHoyPagadas: pagadasCountHoy,
        cuotasMesPendientesCount: unpaidCount,
        cuotasMesPendientesAmt: unpaidAmt,
        aptosPorVencer: aptosXVencer,
        pendientesAprobacion: pendientesCount
      });
      cuotasHoyTemp.sort((a, b) => b.fechaPagoDate.getTime() - a.fechaPagoDate.getTime());
      setCuotasHoy(cuotasHoyTemp);

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

  const handleExportarMes = async () => {
    try {
      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
      
      const paidCuotasSnap = await getDocs(query(
        collection(db, 'cuotas'),
        where('estado', '==', 'pagado')
      ));
      
      const alumnasSnap = await getDocs(collection(db, 'alumnas'));
      const alumnasMap: Record<string, string> = {};
      alumnasSnap.forEach(d => {
         alumnasMap[d.id] = d.data().nombre_completo || 'Desconocida';
      });

      const pagosDelMes: any[] = [];
      let totalEfectivo = 0;
      let totalTransferencia = 0;
      let totalDebito = 0;
      let totalOtros = 0;
      let countEfectivo = 0;
      let countTransferencia = 0;
      let countDebito = 0;
      let countOtros = 0;

      paidCuotasSnap.forEach(doc => {
        const data = doc.data();
        if (data.fecha_pago) {
          const fp = data.fecha_pago.toDate ? data.fecha_pago.toDate() : new Date(data.fecha_pago);
          if (fp >= monthStart && fp <= monthEnd) {
             const metodo = (data.metodo_pago || data.metodo || 'Efectivo').toLowerCase();
             const monto = Number(data.monto) || 0;
             
             let metodoLabel = 'Efectivo';
             if (metodo.includes('efectivo')) { totalEfectivo += monto; countEfectivo++; metodoLabel = 'Efectivo'; }
             else if (metodo.includes('transferencia')) { totalTransferencia += monto; countTransferencia++; metodoLabel = 'Transferencia'; }
             else if (metodo.includes('debito') || metodo.includes('débito') || metodo.includes('tarjeta')) { totalDebito += monto; countDebito++; metodoLabel = 'Tarjeta/Débito'; }
             else { totalOtros += monto; countOtros++; metodoLabel = 'Otros'; }

             pagosDelMes.push({
               Gimnasta: alumnasMap[data.alumna_id] || 'Desconocida',
               'Mes Abonado': `${data.mes}/${data.anio}`,
               Monto: monto,
               Metodo: metodoLabel,
               'Fecha de Pago': format(fp, 'dd/MM/yyyy HH:mm')
             });
          }
        }
      });

      if (pagosDelMes.length === 0) {
         alert("No hay pagos registrados en este mes para exportar.");
         return;
      }

      pagosDelMes.sort((a, b) => a.Gimnasta.localeCompare(b.Gimnasta));

      pagosDelMes.push({});
      pagosDelMes.push({ Gimnasta: 'RESUMEN DEL MES' });
      pagosDelMes.push({ Gimnasta: 'Total Efectivo', Monto: totalEfectivo, Metodo: `${countEfectivo} pagos` });
      pagosDelMes.push({ Gimnasta: 'Total Transferencia', Monto: totalTransferencia, Metodo: `${countTransferencia} pagos` });
      pagosDelMes.push({ Gimnasta: 'Total Tarjeta/Débito', Monto: totalDebito, Metodo: `${countDebito} pagos` });
      pagosDelMes.push({ Gimnasta: 'Total Otros', Monto: totalOtros, Metodo: `${countOtros} pagos` });
      pagosDelMes.push({});
      pagosDelMes.push({ 
         Gimnasta: 'TOTAL RECAUDADO', 
         Monto: totalEfectivo + totalTransferencia + totalDebito + totalOtros,
         Metodo: `${countEfectivo + countTransferencia + countDebito + countOtros} pagos en total` 
      });

      const ws = XLSX.utils.json_to_sheet(pagosDelMes);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resumen del Mes");
      XLSX.writeFile(wb, `Resumen_Ingresos_Cuotas_${format(today, 'MM_yyyy')}.xlsx`);

    } catch (e) {
      console.error(e);
      alert('Error al generar el Excel');
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER WITH REFRESH */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-800 uppercase tracking-tight">Panel de Control</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Resumen general y alertas del sistema</p>
        </div>
        <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
           <button 
             onClick={handleExportarMes} 
             className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:bg-emerald-700 transition-colors shadow-sm"
           >
             <Download className="w-4 h-4" />
             Exportar Mes (Excel)
           </button>
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
          title="Cuotas Cobradas"
          value={stats.cuotasHoyPagadas}
          subtitle={`${stats.cuotasMesPagadas} en el mes · Ver hoy ↗`}
          subColor="text-emerald-600 font-bold"
          borderColor="border-l-emerald-500"
          valueColor="text-emerald-600"
          onClick={() => setShowTodayPaymentsModal(true)}
        />
      </div>

      {/* SECCIÓN PENDIENTES - PRIORIDAD ALTA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 lg:p-5 border-b border-slate-100 flex items-center bg-purple-50">
          <Users className="w-5 h-5 text-purple-600 mr-2" />
          <h3 className="font-bold text-[10px] lg:text-sm uppercase tracking-tight text-slate-800">Solicitudes Pendientes de Aprobación</h3>
          <span className="ml-2 lg:ml-3 bg-purple-600 text-white text-[9px] lg:text-[10px] font-black px-2 py-0.5 rounded-full">{pendientesList.length}</span>
        </div>
        <div className="overflow-x-auto">
          {pendientesList.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-widest text-slate-500">
                  <th className="p-4 font-bold">Gimnasta</th>
                  <th className="p-4 font-bold">DNI</th>
                  <th className="p-4 font-bold text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {pendientesList.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4">
                      <p className="font-bold text-slate-800 uppercase text-xs">{p.nombre_completo}</p>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-500">
                      {p.dni}
                    </td>
                    <td className="p-4 text-right">
                      <Link 
                        to={`/admin/alumnas/${p.id}`} 
                        className="inline-flex items-center gap-1 text-purple-600 hover:text-purple-800 font-bold uppercase text-[10px] tracking-widest underline"
                      >
                        Ver Datos y Validar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
              No hay solicitudes pendientes de aprobación en este momento.
            </div>
          )}
        </div>
      </div>

      {/* ALERTAS APTOS MEDICOS */}
      {alumnasVencidas.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 lg:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center bg-amber-50/50 gap-3">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />
                <h3 className="font-bold text-[10px] lg:text-sm uppercase tracking-tight text-slate-800">Alertas: Certificados Médicos</h3>
              </div>
              <div className="w-full sm:w-auto sm:ml-auto">
                 <button 
                    onClick={handleAutoSendAll}
                    disabled={isSending}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm"
                 >
                    <Mail className="w-4 h-4" />
                    {isSending ? 'Enviando Avisos...' : 'Avisar Certificados'}
                 </button>
              </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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

      {/* ALERTAS PAGOS */}
      {alertasPago.length > 0 && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center bg-slate-50">
              <DollarSign className="w-5 h-5 text-slate-800 mr-2" />
              <h3 className="font-bold text-sm uppercase tracking-tight text-slate-800">Alertas de Pago y Morosidad</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
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

      {/* FOOTER PLACEHOLDER */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[150px] flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-slate-400 font-medium mb-2">Aquí puedes visualizar próximos reportes o gráficos.</p>
          <p className="text-xs text-slate-300 uppercase tracking-widest font-bold">En desarrollo</p>
        </div>
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
