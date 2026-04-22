import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { ChevronLeft, ChevronRight, Calculator, Plus, Trash2, Calendar, ShoppingCart, UserCheck, Tag, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function CajaDiaria() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [otrosCostos, setOtrosCostos] = useState<any[]>([]);
  const [ventasMerch, setVentasMerch] = useState<any[]>([]);
  const [egresos, setEgresos] = useState<any[]>([]);
  const [comienzoCaja, setComienzoCaja] = useState<number>(0);

  // Lists for Quick POS
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [productos, setProductos] = useState<any[]>([]);

  // POS State
  const [posTab, setPosTab] = useState<'cuota'|'merch'|'otro'>('cuota');
  const [cuotaForm, setCuotaForm] = useState({ alumna_id: '', mes: (currentDate.getMonth()+1).toString(), monto: '', metodo_pago: 'efectivo' });
  const [merchForm, setMerchForm] = useState({ producto_id: '', cantidad: 1, metodo_pago: 'efectivo' });
  const [otroForm, setOtroForm] = useState({ alumna_id: '', concepto: '', monto: '', metodo_pago: 'efectivo' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchCuota, setSearchCuota] = useState('');
  const [searchMerch, setSearchMerch] = useState('');
  const [searchOtro, setSearchOtro] = useState('');

  // Forms
  const [showEgreso, setShowEgreso] = useState(false);
  const [egresoForm, setEgresoForm] = useState({ concepto: '', monto: '', metodo: 'efectivo' });
  const [cajaFormOpen, setCajaFormOpen] = useState(false);
  const [nuevoComienzo, setNuevoComienzo] = useState('');

  // Derived Dates
  const dateStr = currentDate.toISOString().split('T')[0];
  const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);
  
  const startOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
  const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Comienzo de Caja
      const monthPrefix = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}`;
      const cajaSnap = await getDocs(query(collection(db, 'cajas')));
      const cajaDoc = cajaSnap.docs.find(d => d.id === dateStr);
      setComienzoCaja(cajaDoc ? cajaDoc.data().monto : 0);

      // 2. Fetch Cuotas (All paid for the month, filters logic locally to avoid index rules)
      const cuotasSnap = await getDocs(query(collection(db, 'cuotas'), where('estado', '==', 'pagado')));
      const cuotasList = cuotasSnap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(c => c.fecha_pago && c.fecha_pago.toDate() >= startOfMonth && c.fecha_pago.toDate() <= endOfMonth);
      setCuotas(cuotasList);

      // 3. Fetch Otros Costos
      const otrosSnap = await getDocs(query(collection(db, 'otros_costos'), where('estado', '==', 'pagado')));
      const otrosList = otrosSnap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(c => c.fecha && c.fecha.toDate() >= startOfMonth && c.fecha.toDate() <= endOfMonth);
      setOtrosCostos(otrosList);

      // 4. Fetch Ventas Merch
      const ventasSnap = await getDocs(collection(db, 'ventas_merch'));
      const ventasList = ventasSnap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(v => v.fecha && v.fecha.toDate() >= startOfMonth && v.fecha.toDate() <= endOfMonth);
      setVentasMerch(ventasList);

      // 5. Fetch Egresos
      const egresosSnap = await getDocs(collection(db, 'egresos'));
      const egresosList = egresosSnap.docs.map(d => ({id: d.id, ...d.data()}))
        .filter(e => e.fecha && e.fecha.toDate() >= startOfMonth && e.fecha.toDate() <= endOfMonth);
      setEgresos(egresosList);

      // 6. Config Data
      const alSnap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(alSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(a => a.estado === 'activa'));
      const prSnap = await getDocs(collection(db, 'productos'));
      setProductos(prSnap.docs.map(d => ({id: d.id, ...d.data()})).filter(p => p.stock > 0));

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [dateStr, currentMonthDate]);

  const changeDay = (days: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d);
  };

  const changeMonth = (months: number) => {
    const m = new Date(currentMonthDate);
    m.setMonth(m.getMonth() + months);
    setCurrentMonthDate(m);
  };

  // --- TERMINAL DE COBRO (POS) FUNCS ---
  const handlePOSCuota = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      // Find or create
      const aluId = cuotaForm.alumna_id;
      const mesNum = Number(cuotaForm.mes);
      const year = currentDate.getFullYear();
      
      const cuotasSnap = await getDocs(query(collection(db, 'cuotas'), where('alumna_id', '==', aluId), where('mes', '==', mesNum), where('anio', '==', year)));
      if (cuotasSnap.empty) {
         const newRef = doc(collection(db, 'cuotas'));
         await setDoc(newRef, {
           id: newRef.id, alumna_id: aluId, mes: mesNum, anio: year,
           monto: Number(cuotaForm.monto), estado: 'pagado', metodo_pago: cuotaForm.metodo_pago,
           fecha_pago: currentDate
         });
      } else {
         const existing = cuotasSnap.docs[0];
         await updateDoc(doc(db, 'cuotas', existing.id), {
           estado: 'pagado', monto: Number(cuotaForm.monto), metodo_pago: cuotaForm.metodo_pago, fecha_pago: currentDate
         });
      }
      setCuotaForm({...cuotaForm, alumna_id: '', monto: ''});
      setSearchCuota('');
      loadData();
    } catch (err) { console.error(err); alert('Error al cobrar cuota'); } finally { setIsProcessing(false); }
  };

  const handlePOSMerch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const prod = productos.find(p => p.id === merchForm.producto_id);
      if(!prod) return;
      const montoTotal = Number(prod.precio) * merchForm.cantidad;
      
      const newRef = doc(collection(db, 'ventas_merch'));
      await setDoc(newRef, {
        id: newRef.id, producto_id: prod.id, nombre_producto: prod.nombre,
        cantidad: merchForm.cantidad, monto: montoTotal, metodo_pago: merchForm.metodo_pago,
        fecha: currentDate
      });
      await updateDoc(doc(db, 'productos', prod.id), { stock: prod.stock - merchForm.cantidad });
      
      setMerchForm({ producto_id: '', cantidad: 1, metodo_pago: 'efectivo' });
      setSearchMerch('');
      loadData();
    } catch (err) { console.error(err); alert('Error al vender merch'); } finally { setIsProcessing(false); }
  };

  const handlePOSOtro = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const newRef = doc(collection(db, 'otros_costos'));
      await setDoc(newRef, {
        id: newRef.id, alumna_id: otroForm.alumna_id, concepto: otroForm.concepto,
        monto: Number(otroForm.monto), estado: 'pagado', metodo_pago: otroForm.metodo_pago,
        fecha: currentDate, notas: 'Ingreso Rápido'
      });
      setOtroForm({ alumna_id: '', concepto: '', monto: '', metodo_pago: 'efectivo' });
      setSearchOtro('');
      loadData();
    } catch (err) { console.error(err); alert('Error al cobrar otro costo'); } finally { setIsProcessing(false); }
  };

  // --- SAVING FUNCS ---
  const handleSaveEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ref = doc(collection(db, 'egresos'));
      await setDoc(ref, {
        concepto: egresoForm.concepto,
        monto: Number(egresoForm.monto),
        metodo: egresoForm.metodo,
        fecha: currentDate // Guardamos el egreso en el día seleccionado, no el serverTimestamp literal
      });
      setShowEgreso(false);
      setEgresoForm({ concepto: '', monto: '', metodo: 'efectivo' });
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar egreso');
    }
  };

  const handleUpdateCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'cajas', dateStr), {
        monto: Number(nuevoComienzo),
        fecha: currentDate
      });
      setCajaFormOpen(false);
      loadData();
    } catch(err) {
      console.error(err);
    }
  };

  const deleteEgreso = async (id: string) => {
    if(!confirm('¿Eliminar egreso?')) return;
    await deleteDoc(doc(db, 'egresos', id));
    loadData();
  };

  // --- CALCS (DIARIOS) ---
  const isSameDay = (d: Date) => d >= startOfDay && d <= endOfDay;

  const cuotasHoy = cuotas.filter(c => isSameDay(c.fecha_pago?.toDate()));
  const otrosHoy = otrosCostos.filter(c => isSameDay(c.fecha?.toDate()));
  const merchHoy = ventasMerch.filter(v => isSameDay(v.fecha?.toDate()));
  const egresosHoy = egresos.filter(e => isSameDay(e.fecha.toDate()));

  // Efectivo Hoy
  const ingCuotasEfvoHoy = cuotasHoy.filter(c => (c.metodo_pago || c.metodo) === 'efectivo').reduce((acc, c) => acc + c.monto, 0);
  const ingOtrosEfvoHoy = otrosHoy.filter(c => (c.metodo_pago || c.metodo) === 'efectivo' || (!c.metodo_pago && !c.metodo)).reduce((acc, c) => acc + c.monto, 0);
  const ingMerchEfvoHoy = merchHoy.filter(c => (c.metodo_pago || c.metodo) === 'efectivo').reduce((acc, c) => acc + c.monto, 0);
  const totalIngEfvoHoy = ingCuotasEfvoHoy + ingOtrosEfvoHoy + ingMerchEfvoHoy;
  
  // Transf/MP Hoy
  const ingCuotasTransfHoy = cuotasHoy.filter(c => (c.metodo_pago || c.metodo) !== 'efectivo').reduce((acc, c) => acc + c.monto, 0);
  const ingOtrosTransfHoy = otrosHoy.filter(c => {
     const met = (c.metodo_pago || c.metodo || '');
     return met === 'transferencia' || met === 'mp' || (!['efectivo'].includes(met) && met !== '');
  }).reduce((acc, c) => acc + c.monto, 0);
  const ingMerchTransfHoy = merchHoy.filter(c => (c.metodo_pago || c.metodo) !== 'efectivo').reduce((acc, c) => acc + c.monto, 0);
  const totalIngTransfHoy = ingCuotasTransfHoy + ingOtrosTransfHoy + ingMerchTransfHoy;

  const totalEgresosHoy = egresosHoy.reduce((acc, e) => acc + e.monto, 0);
  
  // Caja Final
  const cajaFinalEfvo = comienzoCaja + totalIngEfvoHoy - egresosHoy.filter(e => e.metodo === 'efectivo').reduce((a, b) => a + b.monto, 0);

  // --- CALCS (MENSUALES) ---
  const totCuotasEfvoMes = cuotas.filter(c => c.metodo_pago === 'efectivo').reduce((acc, c) => acc + c.monto, 0);
  const totOtrosEfvoMes = otrosCostos.filter(c => c.metodo_pago === 'efectivo' || !c.metodo_pago).reduce((acc, c) => acc + c.monto, 0) + ventasMerch.filter(v=>v.metodo_pago==='efectivo').reduce((acc,v)=>acc+v.monto,0);
  const totCuotasTransfMes = cuotas.filter(c => c.metodo_pago !== 'efectivo').reduce((acc, c) => acc + c.monto, 0);
  const totOtrosTransfMes = otrosCostos.filter(c => c.metodo_pago === 'transferencia' || c.metodo_pago === 'mp').reduce((acc, c) => acc + c.monto, 0) + ventasMerch.filter(v=>v.metodo_pago!=='efectivo').reduce((acc,v)=>acc+v.monto,0);
  const totEgresosMes = egresos.reduce((acc, e) => acc + e.monto, 0);
  
  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
        <div className="flex items-center gap-4">
          <button onClick={() => changeDay(-1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center">
            <h1 className="text-lg font-black uppercase tracking-tight text-slate-800">
              {currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{currentDate.getFullYear()}</p>
          </div>
          <button onClick={() => changeDay(1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><ChevronRight className="w-4 h-4" /></button>
        </div>
        
        <div className="flex gap-3">
          <Link to="/admin/caja/importar" className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-100 flex items-center gap-2 border border-emerald-200">
             <Upload className="w-3 h-3" /> Importar Histórico
          </Link>
          <button onClick={() => { setNuevoComienzo(comienzoCaja.toString()); setCajaFormOpen(true); }} className="bg-slate-100 text-slate-600 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 flex items-center gap-2">
            <Calculator className="w-3 h-3" /> Modificar Comienzo Caja
          </button>
          <button onClick={() => setShowEgreso(true)} className="bg-red-500 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-red-600 flex items-center gap-2">
            <Plus className="w-3 h-3" /> Añadir Egreso
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold uppercase text-slate-400">Cargando flujos de caja...</div>
      ) : (
        <>
          {/* RECEPCION / POS TERMINAL */}
          <div className="bg-white rounded-xl shadow-md border-2 border-purple-200 overflow-hidden mb-6">
            <div className="bg-purple-900 px-4 py-3 flex items-center justify-between">
               <h2 className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
                 ⚡ Mostrador Rápido
               </h2>
               <div className="flex gap-1 bg-purple-950 p-1 rounded-lg">
                 <button onClick={()=>setPosTab('cuota')} className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${posTab === 'cuota' ? 'bg-purple-500 text-white' : 'text-purple-300 hover:text-white'}`}><UserCheck className="w-3 h-3"/> Cuota</button>
                 <button onClick={()=>setPosTab('merch')} className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${posTab === 'merch' ? 'bg-purple-500 text-white' : 'text-purple-300 hover:text-white'}`}><ShoppingCart className="w-3 h-3"/> Kiosko</button>
                 <button onClick={()=>setPosTab('otro')} className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${posTab === 'otro' ? 'bg-purple-500 text-white' : 'text-purple-300 hover:text-white'}`}><Tag className="w-3 h-3"/> Otro</button>
               </div>
            </div>
            <div className="p-4 bg-purple-50/50">
               <datalist id="pos-alumnas-datalist">
                 {alumnas.map(a => <option key={a.id} value={a.nombre_completo} />)}
               </datalist>
               <datalist id="pos-merch-datalist">
                 {productos.map(p => <option key={p.id} value={`${p.nombre} - $${p.precio} (Stk: ${p.stock})`} />)}
               </datalist>

               {posTab === 'cuota' && (
                 <form onSubmit={handlePOSCuota} className="grid grid-cols-6 gap-3 items-end">
                   <div className="col-span-2 relative">
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Gimnasta</label>
                     <input 
                       type="text" list="pos-alumnas-datalist" required 
                       value={searchCuota}
                       onChange={e => {
                         setSearchCuota(e.target.value);
                         const matched = alumnas.find(a => a.nombre_completo === e.target.value);
                         setCuotaForm({...cuotaForm, alumna_id: matched ? matched.id : ''});
                       }}
                       placeholder="Ej: Pérez María..."
                       className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                     />
                     {!cuotaForm.alumna_id && searchCuota.length > 0 && <p className="text-[9px] text-red-500 font-bold uppercase tracking-wide mt-1 absolute">Nombre inválido</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Mes</label>
                     <select required value={cuotaForm.mes} onChange={e=>setCuotaForm({...cuotaForm, mes: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white">
                        {MESES.map((m, i) => <option key={m} value={i+1}>{m}</option>)}
                     </select>
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
                     <input type="number" required value={cuotaForm.monto} onChange={e=>setCuotaForm({...cuotaForm, monto: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" placeholder="Ej: 30000" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método</label>
                     <select required value={cuotaForm.metodo_pago} onChange={e=>setCuotaForm({...cuotaForm, metodo_pago: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white">
                        <option value="efectivo">EFVO</option>
                        <option value="transferencia">MP/Transf</option>
                     </select>
                   </div>
                   <div>
                     <button type="submit" disabled={isProcessing || !cuotaForm.alumna_id} className="w-full bg-purple-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-purple-700 transition-colors disabled:opacity-50">
                        Cobrar Cuota
                     </button>
                   </div>
                 </form>
               )}
               {posTab === 'merch' && (
                 <form onSubmit={handlePOSMerch} className="grid grid-cols-5 gap-3 items-end">
                   <div className="col-span-2 relative">
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Producto</label>
                     <input 
                       type="text" list="pos-merch-datalist" required 
                       value={searchMerch}
                       onChange={e => {
                         setSearchMerch(e.target.value);
                         const matched = productos.find(p => `${p.nombre} - $${p.precio} (Stk: ${p.stock})` === e.target.value);
                         setMerchForm({...merchForm, producto_id: matched ? matched.id : ''});
                       }}
                       placeholder="Ej: Turrón..."
                       className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                     />
                     {!merchForm.producto_id && searchMerch.length > 0 && <p className="text-[9px] text-red-500 font-bold uppercase tracking-wide mt-1 absolute">Producto inválido</p>}
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidades</label>
                     <input type="number" required min="1" value={merchForm.cantidad} onChange={e=>setMerchForm({...merchForm, cantidad: Number(e.target.value)})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método</label>
                     <select required value={merchForm.metodo_pago} onChange={e=>setMerchForm({...merchForm, metodo_pago: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white">
                        <option value="efectivo">EFVO</option>
                        <option value="transferencia">MP/Transf</option>
                     </select>
                   </div>
                   <div>
                     <button type="submit" disabled={isProcessing || !merchForm.producto_id} className="w-full bg-emerald-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        Vender
                     </button>
                   </div>
                 </form>
               )}
               {posTab === 'otro' && (
                 <form onSubmit={handlePOSOtro} className="grid grid-cols-6 gap-3 items-end">
                   <div className="col-span-2 relative">
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Gimnasta</label>
                     <input 
                       type="text" list="pos-alumnas-datalist" required 
                       value={searchOtro}
                       onChange={e => {
                         setSearchOtro(e.target.value);
                         const matched = alumnas.find(a => a.nombre_completo === e.target.value);
                         setOtroForm({...otroForm, alumna_id: matched ? matched.id : ''});
                       }}
                       placeholder="Ej: Gómez María..."
                       className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                     />
                     {!otroForm.alumna_id && searchOtro.length > 0 && <p className="text-[9px] text-red-500 font-bold uppercase tracking-wide mt-1 absolute">Nombre inválido</p>}
                   </div>
                   <div className="col-span-2">
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Concepto</label>
                     <input type="text" required value={otroForm.concepto} onChange={e=>setOtroForm({...otroForm, concepto: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" placeholder="Ej: Inscripción / Poliza" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
                     <input type="number" required value={otroForm.monto} onChange={e=>setOtroForm({...otroForm, monto: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" />
                   </div>
                   <div>
                     <button type="submit" disabled={isProcessing || !otroForm.alumna_id} className="w-full bg-blue-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-colors disabled:opacity-50">
                        Cargar
                     </button>
                   </div>
                 </form>
               )}
            </div>
          </div>

          {/* TABLERO DIARIO */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Comienzo Caja Hoy</span>
                <span className="text-xl font-black text-slate-700">{formatter.format(comienzoCaja)}</span>
             </div>
             <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Ingresos Efectivo (Hoy)</span>
                <span className="text-xl font-black text-emerald-700">{formatter.format(totalIngEfvoHoy)}</span>
             </div>
             <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">Ingresos TC/Transferencia (Hoy)</span>
                <span className="text-xl font-black text-blue-700">{formatter.format(totalIngTransfHoy)}</span>
             </div>
             <div className="bg-red-50 p-4 rounded-xl shadow-sm border border-red-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-red-600 tracking-widest">Egresos (Hoy)</span>
                <span className="text-xl font-black text-red-700">{formatter.format(totalEgresosHoy)}</span>
             </div>
          </div>
          
          <div className="bg-slate-800 text-white p-5 rounded-xl shadow-md flex justify-between items-center">
             <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">CAJA FINAL (Solo Efectivo Físico esperado)</p>
                <p className="text-2xl font-black">{formatter.format(cajaFinalEfvo)}</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Detalle Ingresos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                 <h3 className="text-xs font-bold uppercase tracking-tight text-emerald-700">Detalle Ingresos de Hoy</h3>
               </div>
               <div className="p-0 overflow-y-auto max-h-80">
                 <table className="w-full text-left bg-white">
                   <tbody className="divide-y divide-slate-100">
                     {cuotasHoy.map(c => (
                        <tr key={c.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Cuota</td>
                          <td className="p-3 text-xs font-bold uppercase">{c.metodo_pago}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(c.monto)}</td>
                        </tr>
                     ))}
                     {otrosHoy.map(o => (
                        <tr key={o.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Otros: {o.concepto}</td>
                          <td className="p-3 text-xs font-bold uppercase">{o.metodo_pago || o.metodo || 'efectivo'}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(o.monto)}</td>
                        </tr>
                     ))}
                     {merchHoy.map(m => (
                        <tr key={m.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">
                             {m.tipo === 'merch' 
                               ? `Otros (Merch): ${m.concepto} ${m.talle ? `(Talle ${m.talle})` : ''} - ${m.alumna_nombre}` 
                               : `Otros (Kiosko): ${m.nombre_producto} (x${m.cantidad})`}
                          </td>
                          <td className="p-3 text-xs font-bold uppercase">{m.metodo_pago || m.metodo || 'efectivo'}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(m.monto)}</td>
                        </tr>
                     ))}
                     {cuotasHoy.length === 0 && otrosHoy.length === 0 && merchHoy.length === 0 && (
                       <tr><td colSpan={3} className="p-6 text-center text-[10px] font-bold uppercase text-slate-400">Sin ingresos hoy</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* Detalle Egresos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 border-b border-slate-100 bg-slate-50">
                 <h3 className="text-xs font-bold uppercase tracking-tight text-red-700">Detalle Egresos de Hoy</h3>
               </div>
               <div className="p-0 overflow-y-auto max-h-80">
                 <table className="w-full text-left bg-white">
                   <tbody className="divide-y divide-slate-100">
                     {egresosHoy.map(e => (
                        <tr key={e.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-600 uppercase">{e.concepto}</td>
                          <td className="p-3 text-[10px] font-bold uppercase text-slate-400">{e.metodo}</td>
                          <td className="p-3 text-xs font-black text-red-600 text-right">{formatter.format(e.monto)}</td>
                          <td className="p-3 text-right">
                             <button onClick={()=>deleteEgreso(e.id)} className="text-red-300 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          </td>
                        </tr>
                     ))}
                     {egresosHoy.length === 0 && (
                       <tr><td colSpan={4} className="p-6 text-center text-[10px] font-bold uppercase text-slate-400">Sin egresos hoy</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-200 mt-6">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-purple-600" /> Totales Acumulados
                 </h2>
                 <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-600" title="Mes anterior">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide min-w-[120px] text-center">
                      {MESES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-600" title="Mes siguiente">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Cuotas Efectivo</p>
                   <p className="text-sm font-black text-slate-700">{formatter.format(totCuotasEfvoMes)}</p>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Otros Ingr. Efectivo</p>
                   <p className="text-sm font-black text-slate-700">{formatter.format(totOtrosEfvoMes)}</p>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Cuotas Transf</p>
                   <p className="text-sm font-black text-slate-700">{formatter.format(totCuotasTransfMes)}</p>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Otros Ingr. Transf</p>
                   <p className="text-sm font-black text-slate-700">{formatter.format(totOtrosTransfMes)}</p>
                </div>
                <div className="bg-red-50 p-4 border border-red-100 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-red-400 mb-1">Egresos Totales</p>
                   <p className="text-sm font-black text-red-600">{formatter.format(totEgresosMes)}</p>
                </div>
             </div>
          </div>
        </>
      )}

      {/* MODAL EGRESO */}
      {showEgreso && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
             <h2 className="text-sm font-bold uppercase mb-4">Añadir Egreso (Hoy)</h2>
             <form onSubmit={handleSaveEgreso} className="space-y-4">
               <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Concepto</label>
                  <input type="text" required value={egresoForm.concepto} onChange={e=>setEgresoForm({...egresoForm, concepto: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs uppercase font-bold outline-none focus:border-red-500" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Monto ($)</label>
                  <input type="number" required value={egresoForm.monto} onChange={e=>setEgresoForm({...egresoForm, monto: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-red-500" />
               </div>
               <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Método</label>
                  <select required value={egresoForm.metodo} onChange={e=>setEgresoForm({...egresoForm, metodo: e.target.value})} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs uppercase font-bold outline-none focus:border-red-500">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                  </select>
               </div>
               <div className="flex gap-2 justify-end mt-2 pt-2">
                  <button type="button" onClick={()=>setShowEgreso(false)} className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-red-500 rounded text-[10px] uppercase font-bold text-white hover:bg-red-600">Guardar</button>
               </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL COMIENZO CAJA */}
      {cajaFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
             <h2 className="text-sm font-bold uppercase mb-4">Comienzo de Caja</h2>
             <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Registra el efectivo inicial para este día.</p>
             <form onSubmit={handleUpdateCaja} className="space-y-4">
               <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Monto ($)</label>
                  <input type="number" required value={nuevoComienzo} onChange={e=>setNuevoComienzo(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-purple-500" />
               </div>
               <div className="flex gap-2 justify-end mt-2">
                  <button type="button" onClick={()=>setCajaFormOpen(false)} className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-purple-600 rounded text-[10px] uppercase font-bold text-white hover:bg-purple-700">Guardar</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
