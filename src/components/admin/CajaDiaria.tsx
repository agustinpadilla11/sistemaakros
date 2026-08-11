import React from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCajaDiaria } from '../../hooks/useCajaDiaria';
import { ChevronLeft, ChevronRight, Calculator, Plus, Trash2, Calendar, ShoppingCart, UserCheck, Download, CheckCircle2 } from 'lucide-react';

export default function CajaDiaria() {
  const { userData } = useAuth();
  const caja = useCajaDiaria();

  if (!userData) return null;

  const {
    currentDate, currentMonthDate, changeDay, changeMonth,
    loading, formatter, exportToExcel, MESES,
    comienzoCaja, alumnas, productos,
    posTab, setPosTab,
    cuotaForm, setCuotaForm, merchForm, setMerchForm, otroForm, setOtroForm,
    isProcessing, searchCuota, setSearchCuota, searchMerch, setSearchMerch, searchOtro, setSearchOtro,
    handlePOSCuota, handlePOSMerch, handlePOSOtro,
    showEgreso, setShowEgreso, egresoForm, setEgresoForm, handleSaveEgreso,
    cajaFormOpen, setCajaFormOpen, nuevoComienzo, setNuevoComienzo, handleUpdateCaja,
    showArqueo, setShowArqueo, efectivoReal, setEfectivoReal, entregadoDuena, setEntregadoDuena, arqueoData, handleArqueo, toast,
    deleteEgreso, deleteIngreso,
    cuotasHoy, otrosHoy, merchHoy, licenciasHoy, inscripcionesFedHoy,
    matriculasHoy, segurosHoy, torneosPagosHoy, egresosHoy, allDayItems,
    totalIngEfvoHoy, ingDebitoHoy, ingTransfHoy,
    totalIngresosGralHoy, totalEgresosGralHoy,
    cajaFinalEfvo, cajaFinalDebito, cajaFinalTransf, totalFinalTodo,
    totCuotasEfvoMes, totOtrosEfvoMes, totDebitoMes, totTransfMes, totEgresosMes, totFinalMes, resetDailyData
  } = caja;

  const cuotaSearchInputRef = React.useRef<HTMLInputElement>(null);
  const merchSearchInputRef = React.useRef<HTMLInputElement>(null);
  const otroSearchInputRef = React.useRef<HTMLInputElement>(null);

  // Focus correct input when active tab changes
  React.useEffect(() => {
    if (posTab === 'cuota') {
      cuotaSearchInputRef.current?.focus();
    } else if (posTab === 'merch') {
      merchSearchInputRef.current?.focus();
    } else if (posTab === 'otro') {
      otroSearchInputRef.current?.focus();
    }
  }, [posTab]);

  // Tab switching shortcuts Alt+1, Alt+2, Alt+3
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === '1') {
        e.preventDefault();
        setPosTab('cuota');
      } else if (e.altKey && e.key === '2') {
        e.preventDefault();
        setPosTab('merch');
      } else if (e.altKey && e.key === '3') {
        e.preventDefault();
        setPosTab('otro');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPosTab]);

  const getMetodo = (item: any) => item.metodo_pago || item.metodo || 'efectivo';

  const getMetodoBadgeStyle = (item: any) => {
    const m = getMetodo(item).toLowerCase();
    if (m === 'efectivo') return 'bg-emerald-100 text-emerald-700';
    if (m === 'debito') return 'bg-blue-100 text-blue-700';
    if (m === 'transferencia' || m === 'mp' || m === 'mercado pago' || m === 'mercado_pago') return 'bg-purple-100 text-purple-700';
    return 'bg-slate-100 text-slate-700';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden gap-6">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
        <div className="flex items-center gap-4 w-full lg:w-auto justify-between lg:justify-start">
          <button onClick={() => changeDay(-1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 shrink-0"><ChevronLeft className="w-4 h-4" /></button>
          <div className="text-center">
            <h1 className="text-base lg:text-lg font-black uppercase tracking-tight text-slate-800">
              {currentDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h1>
            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{currentDate.getFullYear()}</p>
          </div>
          <button onClick={() => changeDay(1)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 shrink-0"><ChevronRight className="w-4 h-4" /></button>
        </div>
        
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button onClick={exportToExcel} className="flex-1 lg:flex-none bg-emerald-600 text-white px-3 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 flex items-center justify-center gap-2">
             <Download className="w-3 h-3" /> <span className="whitespace-nowrap">Exportar Excel</span>
          </button>
          <button onClick={resetDailyData} disabled={isProcessing} className="flex-1 lg:flex-none bg-red-100 text-red-600 px-3 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-red-200 flex items-center justify-center gap-2 disabled:opacity-50">
            <Trash2 className="w-3 h-3" /> <span className="whitespace-nowrap">Limpiar</span>
          </button>
          <button onClick={() => { setNuevoComienzo(comienzoCaja.toString()); setCajaFormOpen(true); }} className="flex-1 lg:flex-none bg-slate-100 text-slate-600 px-3 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 flex items-center justify-center gap-2">
            <Calculator className="w-3 h-3" /> <span className="whitespace-nowrap">Caja Inicial</span>
          </button>
          <button onClick={() => { setEgresoForm({ concepto: 'RETIRO DE CAJA', monto: '', metodo: 'efectivo' }); setShowEgreso(true); }} className="w-full lg:w-auto bg-amber-500 text-white px-4 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-amber-600 flex items-center justify-center gap-2">
            <Plus className="w-3 h-3" /> <span className="whitespace-nowrap">Salida / Gasto</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs font-bold uppercase text-slate-400">Cargando flujos de caja...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-md border-2 border-purple-200 overflow-hidden mb-6">
            <div className="bg-purple-900 px-4 py-3 flex items-center justify-between">
               <h2 className="text-white text-sm font-black uppercase tracking-widest flex items-center gap-2">
                 ⚡ Mostrador Rápido
               </h2>
               <div className="flex gap-1 bg-purple-950 p-1 rounded-lg">
                 <button onClick={()=>setPosTab('cuota')} className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${posTab === 'cuota' ? 'bg-purple-500 text-white' : 'text-purple-300 hover:text-white'}`}><UserCheck className="w-3 h-3"/> Cuota</button>
                 <button onClick={()=>setPosTab('merch')} className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${posTab === 'merch' ? 'bg-purple-500 text-white' : 'text-purple-300 hover:text-white'}`}><ShoppingCart className="w-3 h-3"/> Kiosko</button>
                 <button onClick={()=>setPosTab('otro')} className={`px-4 py-1.5 rounded text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 transition-all ${posTab === 'otro' ? 'bg-purple-500 text-white' : 'text-purple-300 hover:text-white'}`}><Plus className="w-3 h-3"/> Varios</button>
               </div>
            </div>
            <div className="p-4 bg-purple-50/50">
               {posTab === 'cuota' && (
                 <form 
                   onSubmit={(e) => {
                     e.preventDefault();
                     handlePOSCuota(e);
                   }} 
                   className="grid grid-cols-6 gap-3 items-end"
                 >
                    <div className="col-span-2 relative">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Gimnasta</label>
                      <input 
                        ref={cuotaSearchInputRef}
                        list="alumnas-list"
                        type="text" 
                        required 
                        value={searchCuota}
                        autoComplete="off"
                        onChange={e => {
                          const val = e.target.value;
                          setSearchCuota(val);
                          const matched = alumnas.find(a => 
                            a.nombre_completo.trim().toLowerCase() === val.trim().toLowerCase()
                          );
                          setCuotaForm({...cuotaForm, alumna_id: matched ? matched.id : ''});
                        }}
                        placeholder="Ej: Pérez María..."
                        className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                      />
                      <datalist id="alumnas-list">
                        {alumnas.map(a => (
                          <option key={a.id} value={a.nombre_completo} />
                        ))}
                      </datalist>
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
                         <option value="debito">Débito</option>
                         <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div>
                      <button 
                        type="submit" 
                        disabled={isProcessing || !cuotaForm.alumna_id} 
                        className="w-full bg-purple-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-purple-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                         {isProcessing ? 'Procesando...' : 'Cobrar Cuota'}
                      </button>
                    </div>
                 </form>
               )}
               {posTab === 'merch' && (
                 <form 
                   onSubmit={(e) => {
                     e.preventDefault();
                     handlePOSMerch(e);
                   }} 
                   className="grid grid-cols-6 gap-3 items-end"
                 >
                    <div className="col-span-2 relative">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Producto</label>
                      <input 
                        ref={merchSearchInputRef}
                        list="productos-list"
                        type="text" 
                        required 
                        value={searchMerch}
                        autoComplete="off"
                        onChange={e => {
                          const val = e.target.value;
                          setSearchMerch(val);
                          const matched = productos.find(p => 
                            p.nombre.trim().toLowerCase() === val.trim().toLowerCase()
                          );
                          setMerchForm({
                            ...merchForm, 
                            producto_id: matched ? matched.id : '',
                            monto: matched ? (matched.precio * merchForm.cantidad).toString() : merchForm.monto
                          });
                        }}
                        placeholder="Ej: Turrón..."
                        className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                      />
                      <datalist id="productos-list">
                        {productos.map(p => (
                          <option key={p.id} value={p.nombre} />
                        ))}
                      </datalist>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidades</label>
                      <input type="number" required min="1" value={merchForm.cantidad} onChange={e=>{
                        const nuevaCantidad = Number(e.target.value);
                        const prod = productos.find(p => p.id === merchForm.producto_id);
                        const nuevoMonto = prod ? (prod.precio * nuevaCantidad).toString() : merchForm.monto;
                        setMerchForm({...merchForm, cantidad: nuevaCantidad, monto: nuevoMonto});
                      }} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
                      <input type="number" required value={merchForm.monto} onChange={e=>setMerchForm({...merchForm, monto: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" placeholder="Ej: 500" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método</label>
                      <select required value={merchForm.metodo_pago} onChange={e=>setMerchForm({...merchForm, metodo_pago: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white">
                         <option value="efectivo">EFVO</option>
                         <option value="debito">Débito</option>
                         <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div>
                      <button 
                        type="submit" 
                        disabled={isProcessing || !searchMerch || !merchForm.monto} 
                        className="w-full bg-emerald-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                         {isProcessing ? 'Procesando...' : 'Vender'}
                      </button>
                    </div>
                 </form>
               )}
               {posTab === 'otro' && (
                 <form 
                   onSubmit={(e) => {
                     e.preventDefault();
                     handlePOSOtro(e);
                   }} 
                   className="grid grid-cols-6 gap-3 items-end"
                 >
                    <div className="col-span-2 relative">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Gimnasta (Opcional)</label>
                      <input
                        ref={otroSearchInputRef}
                        type="text"
                        list="alumnas-list-otro"
                        value={searchOtro}
                        onChange={(e) => {
                          setSearchOtro(e.target.value);
                          const matchingAlumna = alumnas.find(a => 
                            a.nombre_completo.toLowerCase() === e.target.value.toLowerCase()
                          );
                          setOtroForm({
                            ...otroForm,
                            alumna_id: matchingAlumna ? matchingAlumna.id : ''
                          });
                        }}
                        className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white pr-8"
                        placeholder="Escribir nombre..."
                      />
                      <datalist id="alumnas-list-otro">
                        {alumnas.map(a => (
                          <option key={a.id} value={a.nombre_completo} />
                        ))}
                      </datalist>
                    </div>

                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Concepto</label>
                      <input 
                        type="text" 
                        required 
                        value={otroForm.concepto} 
                        onChange={e=>setOtroForm({...otroForm, concepto: e.target.value})} 
                        className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                        placeholder="Inscrip..." 
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Monto ($)</label>
                      <input 
                        type="number" 
                        required 
                        value={otroForm.monto} 
                        onChange={e=>setOtroForm({...otroForm, monto: e.target.value})} 
                        className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                      />
                    </div>
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método</label>
                      <select required value={otroForm.metodo_pago} onChange={e=>setOtroForm({...otroForm, metodo_pago: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white">
                         <option value="efectivo">EFVO</option>
                         <option value="debito">Débito</option>
                         <option value="transferencia">Transferencia</option>
                      </select>
                    </div>
                    <div className="col-span-1">
                      <button 
                        type="submit" 
                        disabled={isProcessing || !otroForm.concepto || !otroForm.monto} 
                        className="w-full bg-emerald-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      >
                         {isProcessing ? 'Proc...' : 'Cobrar'}
                      </button>
                    </div>
                 </form>
               )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">Comienzo Caja</span>
                <span className="text-xl font-black text-slate-700">{formatter.format(comienzoCaja)}</span>
             </div>
             <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-widest">Ingr. Efectivo</span>
                <span className="text-xl font-black text-emerald-700">{formatter.format(totalIngEfvoHoy)}</span>
             </div>
             <div className="bg-blue-50 p-4 rounded-xl shadow-sm border border-blue-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-blue-600 tracking-widest">Ingr. Débito</span>
                <span className="text-xl font-black text-blue-700">{formatter.format(ingDebitoHoy)}</span>
             </div>
             <div className="bg-purple-50 p-4 rounded-xl shadow-sm border border-purple-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-purple-600 tracking-widest">Ingr. Transferencia</span>
                <span className="text-xl font-black text-purple-700">{formatter.format(ingTransfHoy)}</span>
             </div>
             <div className="bg-amber-50 p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-600 tracking-widest">Se sacó de Caja (Gasto)</span>
                <span className="text-xl font-black text-amber-700">{formatter.format(totalEgresosGralHoy)}</span>
             </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-12 h-12" /></div>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Caja Final Efectivo</p>
               <p className="text-2xl font-black text-emerald-400 relative z-10">
                 {formatter.format(arqueoData ? arqueoData.real : cajaFinalEfvo)}
                 {arqueoData && <span className="text-[10px] text-emerald-600 ml-2 bg-emerald-100 px-1.5 py-0.5 rounded">Arqueado</span>}
               </p>
            </div>
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-12 h-12" /></div>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Caja Final Débito</p>
               <p className="text-2xl font-black text-blue-400 relative z-10">{formatter.format(cajaFinalDebito)}</p>
            </div>
            <div className="bg-slate-800 text-white p-4 rounded-xl shadow-md flex flex-col justify-center relative overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-10"><Calculator className="w-12 h-12" /></div>
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Caja Final Transferencia</p>
               <p className="text-2xl font-black text-purple-400 relative z-10">{formatter.format(cajaFinalTransf)}</p>
            </div>
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg border border-slate-700 flex flex-col justify-center relative overflow-hidden">
               <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Total Consolidado</p>
               <p className="text-3xl font-black text-white relative z-10">
                 {formatter.format((arqueoData ? arqueoData.real : cajaFinalEfvo) + cajaFinalDebito + cajaFinalTransf)}
               </p>
            </div>
          </div>

          {/* DEDICATED CASH CLOSE & HANDOVER SUMMARY BANNER */}
          <div className="bg-white p-5 lg:p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-600"></div>
            <div className="flex flex-col lg:flex-row justify-between gap-6">
              
              {/* Left Column: Explanatory summary of cash calculations */}
              <div className="space-y-3 flex-1">
                <h3 className="text-xs font-black uppercase text-purple-900 tracking-wider">Cierre y Entrega de Efectivo</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Este panel calcula exactamente cuánto efectivo hay en la caja y cuánto dinero debes entregar a la dueña al finalizar el día, asegurando transparencia absoluta.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider">A: Fondo Inicial (Caja Chica)</span>
                    <span className="block text-sm font-black text-slate-700 mt-1">{formatter.format(comienzoCaja)}</span>
                  </div>
                  <div className="bg-emerald-50/50 p-2.5 rounded-lg border border-emerald-100/50">
                    <span className="block text-[9px] uppercase font-bold text-emerald-600 tracking-wider">B: Cobros Efectivo (+)</span>
                    <span className="block text-sm font-black text-slate-700 mt-1">{formatter.format(totalIngEfvoHoy)}</span>
                  </div>
                  <div className="bg-red-50/50 p-2.5 rounded-lg border border-red-100/50">
                    <span className="block text-[9px] uppercase font-bold text-red-600 tracking-wider">C: Gastos en Efectivo (-)</span>
                    <span className="block text-sm font-black text-slate-700 mt-1">{formatter.format(comienzoCaja + totalIngEfvoHoy - cajaFinalEfvo)}</span>
                  </div>
                  <div className="bg-purple-50 p-2.5 rounded-lg border border-purple-100">
                    <span className="block text-[9px] uppercase font-bold text-purple-600 tracking-wider">Esperado en Caja (=)</span>
                    <span className="block text-sm font-black text-slate-700 mt-1" title="A + B - C">{formatter.format(cajaFinalEfvo)}</span>
                  </div>
                </div>
              </div>
                 {/* Right Column: Handover options / Call to Action */}
              <div className="lg:w-[350px] shrink-0 bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col justify-center gap-3">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Caja en Vivo / Estado Actual</span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${arqueoData ? 'bg-purple-100 text-purple-700' : 'bg-emerald-100 text-emerald-700 animate-pulse'}`}>
                    {arqueoData ? 'Arqueado' : 'En Vivo'}
                  </span>
                </div>

                {!arqueoData ? (
                  // Live Register display before Arqueo
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Efectivo en Caja (Est.):</span>
                      <span className="text-sm font-black text-emerald-600">{formatter.format(cajaFinalEfvo)}</span>
                    </div>
                    <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-1">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                        <span>Se entregaría a Dueña:</span>
                        <span className="text-purple-700">{formatter.format(Math.max(0, cajaFinalEfvo - comienzoCaja))}</span>
                      </div>
                      <div className="flex justify-between items-center text-[9px] font-medium text-slate-400 uppercase">
                        <span>Fondo que queda en caja:</span>
                        <span>{formatter.format(comienzoCaja)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        setEfectivoReal(cajaFinalEfvo.toString());
                        setEntregadoDuena(Math.max(0, cajaFinalEfvo - comienzoCaja).toString());
                        setShowArqueo(true);
                      }} 
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 rounded-lg text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Realizar Arqueo
                    </button>
                  </div>
                ) : (
                  // Display real saved numbers after Arqueo
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">Efectivo Real Contado:</span>
                      <span className="text-sm font-black text-slate-800">{formatter.format(arqueoData.real)}</span>
                    </div>

                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase text-center ${arqueoData.diferencia === 0 ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : arqueoData.diferencia > 0 ? 'bg-blue-100 text-blue-800 border border-blue-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
                      {arqueoData.diferencia === 0 ? '✔ Caja Perfecta' : arqueoData.diferencia > 0 ? `⚠ Sobran ${formatter.format(arqueoData.diferencia)}` : `❌ Faltan ${formatter.format(Math.abs(arqueoData.diferencia))}`}
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Entregado a la Dueña:</span>
                        <span className="text-sm font-black text-purple-700">{formatter.format(arqueoData.entregado_duena || 0)}</span>
                      </div>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Quedó en la Caja:</span>
                        <span className="text-sm font-black text-slate-700">{formatter.format(arqueoData.quedo_caja || 0)}</span>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        setEfectivoReal(arqueoData.real.toString());
                        setEntregadoDuena((arqueoData.entregado_duena || 0).toString());
                        setShowArqueo(true);
                      }}
                      className="w-full text-center text-[9px] font-black uppercase text-purple-600 hover:text-purple-800 underline tracking-widest mt-1 block"
                    >
                      Volver a Arquear / Corregir
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-tight text-emerald-700">Detalle Ingresos de Hoy</h3>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">{allDayItems.length} Mvts</span>
                </div>
                <div className="p-0 overflow-y-auto max-h-96">
                  <table className="w-full text-left bg-white">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                       <tr className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          <th className="px-4 py-2">Detalle</th>
                          <th className="px-4 py-2">Método</th>
                          <th className="px-4 py-2 text-right">Monto</th>
                          <th className="px-4 py-2 text-right w-12"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {allDayItems.map(item => {
                        switch (item._type) {
                          case 'cuota': {
                            const c = item as any;
                            return (
                              <tr key={`c-${c.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{alumnas.find(a => a.id === c.alumna_id)?.nombre_completo || 'Desconocida'}</span>
                                   <span className="block text-[10px] font-bold text-purple-600 uppercase tracking-widest mt-0.5 bg-purple-50 inline-block px-1.5 rounded">Cuota Mes {MESES[c.mes - 1]}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(c)}`}>{c.metodo_pago}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(c.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(c.id, 'cuotas')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'otro': {
                            const o = item as any;
                            return (
                              <tr key={`o-${o.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{o.concepto}</span>
                                   <span className="block text-[10px] font-bold text-orange-600 uppercase tracking-widest mt-0.5 bg-orange-50 inline-block px-1.5 rounded">Otros Ingresos</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(o)}`}>{o.metodo_pago || o.metodo || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(o.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(o.id, 'otros_costos')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'merch': {
                            const m = item as any;
                            return (
                              <tr key={`m-${m.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">
                                     {m.tipo === 'merch' 
                                       ? `${m.concepto} ${m.talle ? `(Talle ${m.talle})` : ''} - ${m.alumna_nombre}` 
                                       : `${m.nombre_producto} (x${m.cantidad})`}
                                   </span>
                                   <span className="block text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-0.5 bg-teal-50 inline-block px-1.5 rounded">
                                     {m.tipo === 'merch' ? 'Indumentaria' : 'Kiosko'}
                                   </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(m)}`}>{m.metodo_pago || m.metodo || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(m.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(m.id, 'ventas_merch', { producto_id: m.producto_id, cantidad: m.cantidad })} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'licencia': {
                            const l = item as any;
                            return (
                              <tr key={`l-${l.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{l.alumna_nombre}</span>
                                   <span className="block text-[10px] font-bold text-indigo-600 uppercase tracking-widest mt-0.5 bg-indigo-50 inline-block px-1.5 rounded">Licencia Fed</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(l)}`}>{l.metodo || l.metodo_pago || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(l.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(l.id, 'federacion_licencias')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'inscripcion': {
                            const i = item as any;
                            return (
                              <tr key={`i-${i.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{i.alumna_nombre}</span>
                                   <span className="block text-[10px] font-bold text-sky-600 uppercase tracking-widest mt-0.5 bg-sky-50 inline-block px-1.5 rounded">Inscripción Fed</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(i)}`}>{i.metodo || i.metodo_pago || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(i.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(i.id, 'federacion_inscripciones')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'matricula': {
                            const m = item as any;
                            return (
                              <tr key={`mat-${m.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{m.alumna_nombre}</span>
                                   <span className="block text-[10px] font-bold text-pink-600 uppercase tracking-widest mt-0.5 bg-pink-50 inline-block px-1.5 rounded">Matrícula Anual</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(m)}`}>{m.metodo || m.metodo_pago || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(m.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(m.id, 'matriculas')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'seguro': {
                            const s = item as any;
                            return (
                              <tr key={`seg-${s.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{s.alumna_nombre}</span>
                                   <span className="block text-[10px] font-bold text-cyan-600 uppercase tracking-widest mt-0.5 bg-cyan-50 inline-block px-1.5 rounded">Seguro</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(s)}`}>{s.metodo || s.metodo_pago || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(s.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(s.id, 'seguros')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          case 'torneo': {
                            const t = item as any;
                            return (
                              <tr key={`tor-${t.id}`} className="hover:bg-slate-50 transition-colors">
                                <td className="px-4 py-3">
                                   <span className="block text-xs font-black text-slate-700">{t.alumna_nombre}</span>
                                   <span className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mt-0.5 bg-amber-50 inline-block px-1.5 rounded">Torneo ({t.categoria})</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${getMetodoBadgeStyle(t)}`}>{t.metodo || t.metodo_pago || 'efectivo'}</span>
                                </td>
                                <td className="px-4 py-3 text-sm font-black text-emerald-600 text-right">{formatter.format(t.monto)}</td>
                                <td className="px-4 py-3 text-right">
                                   <button onClick={()=>deleteIngreso(t.id, 'torneos_pagos')} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </td>
                              </tr>
                            );
                          }
                          default:
                            return null;
                        }
                      })}
                      {allDayItems.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Sin ingresos hoy</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>

             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-4 border-b border-slate-100 bg-red-50/50 flex justify-between items-center">
                   <h3 className="text-xs font-black uppercase tracking-tight text-red-700">Detalle Salidas de Hoy</h3>
                   <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">{egresosHoy.length} Mvts</span>
                 </div>
                <div className="p-0 overflow-y-auto max-h-96">
                  <table className="w-full text-left bg-white">
                    <thead className="bg-slate-50 sticky top-0 border-b border-slate-100">
                       <tr className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          <th className="px-4 py-2">Detalle</th>
                          <th className="px-4 py-2">Método</th>
                          <th className="px-4 py-2 text-right">Monto</th>
                          <th className="px-4 py-2 text-right w-12"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {egresosHoy.map(e => (
                         <tr key={`e-${e.id}`} className="hover:bg-slate-50 transition-colors">
                           <td className="px-4 py-3">
                              <span className="block text-xs font-black text-slate-700">{e.concepto}</span>
                              <span className="block text-[10px] font-bold text-red-600 uppercase tracking-widest mt-0.5 bg-red-50 inline-block px-1.5 rounded">Gasto / Salida</span>
                           </td>
                           <td className="px-4 py-3">
                             <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-md ${e.metodo === 'efectivo' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>{e.metodo}</span>
                           </td>
                           <td className="px-4 py-3 text-sm font-black text-red-600 text-right">-{formatter.format(e.monto)}</td>
                           <td className="px-4 py-3 text-right">
                              <button onClick={()=>deleteEgreso(e.id)} className="text-slate-300 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                           </td>
                         </tr>
                      ))}
                      {egresosHoy.length === 0 && (
                        <tr><td colSpan={4} className="p-8 text-center text-xs font-bold uppercase tracking-widest text-slate-400">Sin egresos hoy</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
             </div>
          </div>

          <div className="pt-6 border-t border-slate-200 mt-6">
             <div className="flex justify-between items-center mb-4">
                 <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-purple-600" /> Totales Acumulados (Mes)
                 </h2>
                 <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl shadow-sm border border-slate-200">
                    <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-600">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide min-w-[120px] text-center">
                      {MESES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-200 rounded transition-colors text-slate-600">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Cuotas Efectivo</p>
                   <p className="text-sm font-black text-slate-700">{formatter.format(totCuotasEfvoMes)}</p>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-slate-400 mb-1">Otros Ingr. Efectivo</p>
                   <p className="text-sm font-black text-slate-700">{formatter.format(totOtrosEfvoMes)}</p>
                </div>
                <div className="bg-blue-50 p-4 border border-blue-100 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-blue-600 mb-1">Ingresos Débito</p>
                   <p className="text-sm font-black text-blue-700">{formatter.format(totDebitoMes)}</p>
                </div>
                <div className="bg-red-50 p-4 border border-red-100 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-red-400 mb-1">Se sacó de caja (Mes)</p>
                   <p className="text-sm font-black text-red-600">{formatter.format(totEgresosMes)}</p>
                </div>
                <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg border border-slate-800">
                   <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-1">TOTAL FINAL</p>
                   <p className="text-xl font-black">{formatter.format(totFinalMes)}</p>
                </div>
             </div>
          </div>
        </>
      )}

      {showEgreso && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
             <h2 className="text-sm font-bold uppercase mb-4">Salida de Caja / Gasto</h2>
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
                     <option value="debito">Débito</option>
                     <option value="transferencia">Transferencia</option>
                  </select>
               </div>
               <div className="flex gap-2 justify-end">
                  <button type="button" onClick={()=>setShowEgreso(false)} className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-red-500 rounded text-[10px] uppercase font-bold text-white">Guardar</button>
               </div>
             </form>
          </div>
        </div>
      )}

      {cajaFormOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
             <h2 className="text-sm font-bold uppercase mb-4">Comienzo de Caja</h2>
             <form onSubmit={handleUpdateCaja} className="space-y-4">
               <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Monto ($)</label>
                  <input type="number" required value={nuevoComienzo} onChange={e=>setNuevoComienzo(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-purple-500" />
               </div>
               <div className="flex gap-2 justify-end">
                  <button type="button" onClick={()=>setCajaFormOpen(false)} className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-purple-600 rounded text-[10px] uppercase font-bold text-white">Guardar</button>
               </div>
             </form>
          </div>
        </div>
      )}

      {showArqueo && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
             <h2 className="text-sm font-bold uppercase mb-4">Arqueo de Caja</h2>
             <div className="bg-slate-50 p-3 rounded mb-4 flex justify-between items-center text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Esperado en Caja:</span>
                <span className="font-black text-slate-700">{formatter.format(cajaFinalEfvo)}</span>
             </div>
             <form onSubmit={handleArqueo} className="space-y-4">
                <div>
                   <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Efectivo Real Contado ($)</label>
                   <input type="number" required value={efectivoReal} onChange={e=>setEfectivoReal(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:border-purple-500" />
                </div>
                <div>
                   <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Entregado a la Dueña ($)</label>
                   <input type="number" required value={entregadoDuena} onChange={e=>setEntregadoDuena(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:border-purple-500" />
                </div>
                <div className="bg-purple-50 p-3 rounded flex justify-between items-center text-xs font-bold">
                   <span className="text-[10px] text-purple-600 uppercase">Queda en Caja (Est.):</span>
                   <span className="text-purple-900">{formatter.format(Math.max(0, (Number(efectivoReal) || 0) - (Number(entregadoDuena) || 0)))}</span>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                   <button type="button" onClick={()=>setShowArqueo(false)} className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600">Cancelar</button>
                   <button type="submit" className="px-4 py-2 bg-purple-600 rounded text-[10px] uppercase font-bold text-white">Guardar Cierre</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* TOAST SYSTEM */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-6 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-bounce">
           <span className="text-xs font-bold uppercase tracking-wider">{toast}</span>
        </div>
      )}
    </div>
  );
}
