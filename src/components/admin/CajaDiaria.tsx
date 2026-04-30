import { useAuth } from '../../hooks/useAuth';
import { useCajaDiaria } from '../../hooks/useCajaDiaria';
import { ChevronLeft, ChevronRight, Calculator, Plus, Trash2, Calendar, ShoppingCart, UserCheck, Tag, Download, CheckCircle2 } from 'lucide-react';


export default function CajaDiaria() {
  const { userData } = useAuth();
  const caja = useCajaDiaria();

  // Guard AFTER all hooks (fixes React hooks violation)
  if (!userData) return null;

  // Destructure for template compatibility
  const {
    currentDate, currentMonthDate, changeDay, changeMonth, dateStr,
    loading, formatter, exportToExcel, MESES,
    cuotas, otrosCostos, ventasMerch, egresos, comienzoCaja,
    licencias, inscripcionesFed, matriculas, seguros, torneosPagos,
    alumnas, productos,
    posTab, setPosTab,
    cuotaForm, setCuotaForm, merchForm, setMerchForm, otroForm, setOtroForm,
    isProcessing, searchCuota, setSearchCuota, searchMerch, setSearchMerch, searchOtro, setSearchOtro,
    handlePOSCuota, handlePOSMerch, handlePOSOtro,
    showEgreso, setShowEgreso, egresoForm, setEgresoForm, handleSaveEgreso,
    cajaFormOpen, setCajaFormOpen, nuevoComienzo, setNuevoComienzo, handleUpdateCaja,
    showArqueo, setShowArqueo, efectivoReal, setEfectivoReal, arqueoData, handleArqueo,
    deleteEgreso,
    cuotasHoy, otrosHoy, merchHoy, licenciasHoy, inscripcionesFedHoy,
    matriculasHoy, segurosHoy, torneosPagosHoy, egresosHoy,
    totalIngEfvoHoy, ingDebitoHoy, ingTransfHoy,
    totalIngresosGralHoy, totalEgresosGralHoy,
    cajaFinalEfvo, totalFinalTodo,
    totCuotasEfvoMes, totOtrosEfvoMes, totDebitoMes, totTransfMes, totEgresosMes, totFinalMes,
  } = caja;





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
          <button onClick={exportToExcel} className="bg-emerald-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 flex items-center gap-2">
             <Download className="w-3 h-3" /> Exportar Excel
          </button>
          <button onClick={() => { setNuevoComienzo(comienzoCaja.toString()); setCajaFormOpen(true); }} className="bg-slate-100 text-slate-600 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 flex items-center gap-2">
            <Calculator className="w-3 h-3" /> Modificar Comienzo
          </button>
          <button onClick={() => { setEgresoForm({ concepto: 'RETIRO DE CAJA', monto: '', metodo: 'efectivo' }); setShowEgreso(true); }} className="bg-amber-500 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-amber-600 flex items-center gap-2">
            <Plus className="w-3 h-3" /> Salida de Caja (Gasto)
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
               </div>
            </div>
            <div className="p-4 bg-purple-50/50">
               <datalist id="pos-alumnas-datalist">
                 {alumnas.map(a => <option key={a.id} value={a.nombre_completo} />)}
               </datalist>
               <datalist id="pos-merch-datalist">
                 {productos.map(p => <option key={p.id} value={p.nombre}>{`$${p.precio} (Stk: ${p.stock})`}</option>)}
               </datalist>

               {posTab === 'cuota' && (
                 <form onSubmit={handlePOSCuota} className="grid grid-cols-6 gap-3 items-end">
                   <div className="col-span-2 relative">
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Buscar Gimnasta</label>
                     <input 
                       type="text" list="pos-alumnas-datalist" required 
                       value={searchCuota}
                       onChange={e => {
                         const val = e.target.value;
                         setSearchCuota(val);
                         const matched = alumnas.find(a => 
                           a.nombre_completo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === 
                           val.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
                         );
                         setCuotaForm({...cuotaForm, alumna_id: matched ? matched.id : ''});
                       }}
                       placeholder="Ej: Pérez María..."
                       className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                     />
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
                        <option value="mp">Mercado Pago</option>

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
                         const val = e.target.value;
                         setSearchMerch(val);
                         const matched = productos.find(p => 
                           p.nombre.toLowerCase() === val.toLowerCase()
                         );
                         setMerchForm({...merchForm, producto_id: matched ? matched.id : ''});
                       }}
                       placeholder="Ej: Turrón..."
                       className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" 
                     />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Unidades</label>
                     <input type="number" required min="1" value={merchForm.cantidad} onChange={e=>setMerchForm({...merchForm, cantidad: Number(e.target.value)})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white" />
                   </div>
                   <div>
                     <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Método</label>
                     <select required value={merchForm.metodo_pago} onChange={e=>setMerchForm({...merchForm, metodo_pago: e.target.value})} className="w-full text-xs font-bold p-2.5 rounded border border-purple-200 outline-none focus:border-purple-500 uppercase bg-white">
                        <option value="efectivo">EFVO</option>
                        <option value="debito">Débito</option>
                        <option value="transferencia">Transferencia</option>
                        <option value="mp">Mercado Pago</option>

                     </select>
                   </div>
                   <div>
                     <button type="submit" disabled={isProcessing || !merchForm.producto_id} className="w-full bg-emerald-600 text-white rounded p-2.5 font-bold text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-colors disabled:opacity-50">
                        Vender
                     </button>
                   </div>
                 </form>
               )}
            </div>
          </div>

          {/* TABLERO DIARIO */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
             <div className="bg-indigo-50 p-4 rounded-xl shadow-sm border border-indigo-100 flex flex-col justify-between">
                <span className="text-[10px] uppercase font-bold text-indigo-600 tracking-widest">Ingr. Transf.</span>
                <span className="text-xl font-black text-indigo-700">{formatter.format(ingTransfHoy)}</span>
             </div>
             <div className="bg-amber-50 p-4 rounded-xl shadow-sm border border-amber-100 flex flex-col justify-between col-span-2">
                <span className="text-[10px] uppercase font-bold text-amber-600 tracking-widest">Se sacó de Caja (Gasto)</span>
                <span className="text-xl font-black text-amber-700">{formatter.format(totalEgresosGralHoy)}</span>
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800 text-white p-5 rounded-xl shadow-md flex justify-between items-center">
               <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">TOTAL FINAL (Todo Sumado)</p>
                  <p className="text-2xl font-black">{formatter.format(totalFinalTodo)}</p>
               </div>
            </div>
            
            <div className={`p-5 rounded-xl shadow-md flex justify-between items-center border-2 ${arqueoData ? 'bg-white border-emerald-500' : 'bg-white border-dashed border-slate-300'}`}>
               <div>
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">ARQUEO DE CIERRE</p>
                  {arqueoData ? (
                    <div className="flex items-center gap-4 mt-1">
                      <div>
                        <p className="text-xs text-slate-500 font-bold uppercase">Real en caja:</p>
                        <p className="text-lg font-black text-slate-800">{formatter.format(arqueoData.real)}</p>
                      </div>
                      <div className={`px-3 py-1 rounded text-xs font-bold uppercase ${arqueoData.diferencia === 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                        {arqueoData.diferencia === 0 ? 'Caja Cerrada OK' : `Dif: ${formatter.format(arqueoData.diferencia)}`}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowArqueo(true)} className="mt-2 bg-purple-600 text-white px-6 py-2 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 transition-all flex items-center gap-2">
                       <CheckCircle2 className="w-4 h-4" /> Realizar Arqueo
                    </button>
                  )}
               </div>
               {arqueoData && <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
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
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Cuota - {alumnas.find(a => a.id === c.alumna_id)?.nombre_completo || 'Desconocida'}</td>
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
                     {licenciasHoy.map(l => (
                        <tr key={l.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Fed (Licencia): {l.alumna_nombre}</td>
                          <td className="p-3 text-xs font-bold uppercase">{l.metodo}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(l.monto)}</td>
                        </tr>
                     ))}
                     {inscripcionesFedHoy.map(i => (
                        <tr key={i.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Fed (Inscripción): {i.alumna_nombre}</td>
                          <td className="p-3 text-xs font-bold uppercase">{i.metodo}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(i.monto)}</td>
                        </tr>
                     ))}
                     {matriculasHoy.map(m => (
                        <tr key={m.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Matrícula: {m.alumna_nombre}</td>
                          <td className="p-3 text-xs font-bold uppercase">{m.metodo}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(m.monto)}</td>
                        </tr>
                     ))}
                     {segurosHoy.map(s => (
                        <tr key={s.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Seguro: {s.alumna_nombre}</td>
                          <td className="p-3 text-xs font-bold uppercase">{s.metodo}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(s.monto)}</td>
                        </tr>
                     ))}
                     {torneosPagosHoy.map(t => (
                        <tr key={t.id}>
                          <td className="p-3 text-[10px] font-bold text-slate-500 uppercase">Torneo: {t.alumna_nombre} ({t.categoria})</td>
                          <td className="p-3 text-xs font-bold uppercase">{t.metodo}</td>
                          <td className="p-3 text-xs font-black text-emerald-600 text-right">{formatter.format(t.monto)}</td>
                        </tr>
                     ))}
                     {cuotasHoy.length === 0 && otrosHoy.length === 0 && merchHoy.length === 0 && licenciasHoy.length === 0 && inscripcionesFedHoy.length === 0 && matriculasHoy.length === 0 && segurosHoy.length === 0 && torneosPagosHoy.length === 0 && (
                       <tr><td colSpan={3} className="p-6 text-center text-[10px] font-bold uppercase text-slate-400">Sin ingresos hoy</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
            </div>

            {/* Detalle Egresos */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h3 className="text-xs font-bold uppercase tracking-tight text-red-700">Detalle Salidas de Caja de Hoy</h3>
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
                   <Calendar className="w-4 h-4 text-purple-600" /> Totales Acumulados (Mes)
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
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-lg">
                   <p className="text-[9px] uppercase font-bold text-indigo-600 mb-1">Ingresos Transferencia</p>
                   <p className="text-sm font-black text-indigo-700">{formatter.format(totTransfMes)}</p>
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

      {/* MODAL EGRESO */}
      {showEgreso && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
             <h2 className="text-sm font-bold uppercase mb-4">Salida de Caja / Gasto (Hoy)</h2>
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
                     <option value="mp">Mercado Pago</option>
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
      {/* MODAL ARQUEO */}
      {showArqueo && (
        <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 border border-slate-200">
             <h2 className="text-sm font-bold uppercase mb-2">Arqueo de Caja</h2>
             <p className="text-[10px] text-slate-500 font-bold uppercase mb-4">Ingresá el efectivo físico total que hay en caja ahora.</p>
             <div className="bg-slate-50 p-3 rounded mb-4 flex justify-between items-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Esperado:</span>
                <span className="text-xs font-black text-slate-700">{formatter.format(cajaFinalEfvo)}</span>
             </div>
             <form onSubmit={handleArqueo} className="space-y-4">
               <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Efectivo Real ($)</label>
                  <input type="number" required value={efectivoReal} onChange={e=>setEfectivoReal(e.target.value)} className="w-full p-2.5 bg-white border border-slate-200 rounded text-xs font-bold outline-none focus:border-purple-500" placeholder="Ej: 45500" />
               </div>
               <div className="flex gap-2 justify-end mt-2">
                  <button type="button" onClick={()=>setShowArqueo(false)} className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600 hover:bg-slate-200">Cancelar</button>
                  <button type="submit" className="px-4 py-2 bg-purple-600 rounded text-[10px] uppercase font-bold text-white hover:bg-purple-700">Guardar Cierre</button>
               </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
