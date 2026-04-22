import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2, ShoppingBag, Package, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Merchandising() {
  const [activeTab, setActiveTab] = useState<'pedidos' | 'catalogo'>('pedidos');
  
  // Data states
  const [productos, setProductos] = useState<any[]>([]);
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [todasAlumnas, setTodasAlumnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Navigation for History
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  // Forms state
  const [isEditingCatalogo, setIsEditingCatalogo] = useState<any>(null);
  const [deleteConfirmPedidoId, setDeleteConfirmPedidoId] = useState<string | null>(null);
  const [deleteConfirmCatalogoId, setDeleteConfirmCatalogoId] = useState<string | null>(null);
  const [isEditingPedido, setIsEditingPedido] = useState<any>(null);
  
  const [formCatalogo, setFormCatalogo] = useState({ nombre: '', descripcion: '', precio: '', stock: '', imagen_url: '' });
  const [formPedido, setFormPedido] = useState({
    alumna_nombre: '',
    prenda: '',
    talle: '',
    monto: '',
    observacion: '',
    metodo: 'efectivo',
    estado: 'no entregado'
  });

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Alumnas
      const aluSnap = await getDocs(collection(db, 'alumnas'));
      setTodasAlumnas(aluSnap.docs.map(d => ({id: d.id, ...d.data()})));
      
      // 2. Catalogo
      const prodSnap = await getDocs(collection(db, 'productos'));
      setProductos(prodSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      
      // 3. Pedidos (ventas_merch)
      const pedSnap = await getDocs(collection(db, 'ventas_merch'));
      const pedData = pedSnap.docs.map(doc => {
         const data = doc.data();
         let dateObj = new Date();
         if (data.fecha && data.fecha.toDate) {
            dateObj = data.fecha.toDate();
         } else if (typeof data.fecha === 'string') {
            dateObj = new Date(data.fecha);
         }
         return { id: doc.id, ...data, dateObj, timestamp: dateObj.getTime() };
      });
      pedData.sort((a,b) => b.timestamp - a.timestamp); // Descending
      setPedidos(pedData);
      
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const changeMonth = (delta: number) => {
    setCurrentMonthDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // Guardar Pedido
  const handleSavePedido = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        alumna_nombre: formPedido.alumna_nombre,
        concepto: formPedido.prenda, // para compatibilidad con caja
        prenda: formPedido.prenda,
        talle: formPedido.talle,
        monto: parseFloat(formPedido.monto.toString()) || 0,
        observacion: formPedido.observacion,
        metodo: formPedido.metodo,
        estado_entrega: formPedido.estado,
        fecha: new Date(),
        tipo: 'merch' // identificador para caja
      };

      if (isEditingPedido === 'nuevo') {
        const newRef = doc(collection(db, 'ventas_merch'));
        await setDoc(newRef, { id: newRef.id, ...payload });
      } else {
        // En edición, no pisamos la fecha original a menos que queramos
        const editPayload = { ...payload };
        delete (editPayload as any).fecha; // Mantenemos la fecha original
        await updateDoc(doc(db, 'ventas_merch', isEditingPedido.id), editPayload);
      }
      setIsEditingPedido(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el pedido');
    }
  };

  // Guardar Catalogo
  const handleSaveCatalogo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        nombre: formCatalogo.nombre,
        descripcion: formCatalogo.descripcion,
        precio: Number(formCatalogo.precio),
        stock: Number(formCatalogo.stock),
        imagen_url: formCatalogo.imagen_url || 'https://picsum.photos/seed/merch/400/400'
      };

      if (isEditingCatalogo === 'nuevo') {
        const newRef = doc(collection(db, 'productos'));
        await setDoc(newRef, { id: newRef.id, ...payload });
      } else {
        await updateDoc(doc(db, 'productos', isEditingCatalogo.id), payload);
      }
      setIsEditingCatalogo(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error guardando producto');
    }
  };

  const handleDeletePedido = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ventas_merch', id));
      setDeleteConfirmPedidoId(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCatalogo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'productos', id));
      setDeleteConfirmCatalogoId(null);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleEstado = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'entregado' ? 'no entregado' : 'entregado';
    // Actualización optimista para UX súper veloz
    setPedidos(prev => prev.map(p => p.id === id ? { ...p, estado_entrega: newStatus } : p));
    try {
      await updateDoc(doc(db, 'ventas_merch', id), { estado_entrega: newStatus });
    } catch (err) {
      console.error(err);
      loadData(); // Revert on failure
    }
  };
  
  // Filtrar pedidos por el mes seleccionado
  const pedidosMes = pedidos.filter(p => {
     return p.dateObj.getMonth() === currentMonthDate.getMonth() && 
            p.dateObj.getFullYear() === currentMonthDate.getFullYear();
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
           <ShoppingBag className="w-5 h-5 text-purple-600" />
           Merchandising & Pedidos
        </h1>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button 
             onClick={()=>setActiveTab('pedidos')} 
             className={`px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest transition-colors ${activeTab === 'pedidos' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
           >
             📦 Historial de Pedidos
           </button>
           <button 
             onClick={()=>setActiveTab('catalogo')} 
             className={`px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest transition-colors ${activeTab === 'catalogo' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
           >
             🏷️ Catálogo de Ropa/Accs
           </button>
        </div>
      </div>

      {/* ----------------- TAB PEDIDOS ----------------- */}
      {activeTab === 'pedidos' && (
         <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                 <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-purple-600" /> Historial de Pedidos del Mes
                 </h2>
                 <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg shadow-inner border border-slate-200/60">
                    <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white rounded transition-colors text-slate-600" title="Mes anterior">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide min-w-[120px] text-center">
                      {MESES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
                    </span>
                    <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white rounded transition-colors text-slate-600" title="Mes siguiente">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
              </div>
              <button 
                onClick={() => { 
                  setFormPedido({alumna_nombre: '', prenda: '', talle: '', monto: '', observacion: '', metodo: 'efectivo', estado: 'no entregado'}); 
                  setIsEditingPedido('nuevo'); 
                }}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors shadow-sm"
              >
                <Plus className="w-3 h-3" /> Nuevo Pedido
              </button>
            </div>

            {isEditingPedido && (
              <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                <h2 className="text-sm font-black uppercase tracking-tight mb-4 text-purple-900">{isEditingPedido === 'nuevo' ? 'Registrar' : 'Editar'} Pedido</h2>
                <form onSubmit={handleSavePedido} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Fila 1 */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Apellido y Nombre</label>
                    <input 
                      type="text" 
                      required 
                      list="pedidos-alumnas"
                      value={formPedido.alumna_nombre} 
                      onChange={e=>setFormPedido({...formPedido, alumna_nombre: e.target.value})} 
                      className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase" 
                      placeholder="Buscar alumna..."
                    />
                    <datalist id="pedidos-alumnas">
                       {todasAlumnas.map(a => <option key={a.id} value={`${a.nombre_completo} (DNI: ${a.dni})`} />)}
                    </datalist>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Prenda / Artículo</label>
                     <input 
                       type="text" 
                       required 
                       list="pedidos-prendas"
                       value={formPedido.prenda} 
                       onChange={e=>setFormPedido({...formPedido, prenda: e.target.value})} 
                       className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase" 
                       placeholder="Ej: Maya, Remera..."
                     />
                     <datalist id="pedidos-prendas">
                        {productos.map(p => <option key={p.id} value={p.nombre} />)}
                     </datalist>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Talle</label>
                    <input type="text" required value={formPedido.talle} onChange={e=>setFormPedido({...formPedido, talle: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase" placeholder="Ej: S, 12, Único" />
                  </div>

                  {/* Fila 2 */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto Cobrado ($) Fijo</label>
                    <input type="text" inputMode="numeric" required value={formPedido.monto} onChange={e=>setFormPedido({...formPedido, monto: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Medio de Pago</label>
                    <select required value={formPedido.metodo} onChange={e=>setFormPedido({...formPedido, metodo: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold uppercase border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500">
                      <option value="efectivo">Efectivo</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </div>
                  <div>
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado de Entrega</label>
                     <select required value={formPedido.estado} onChange={e=>setFormPedido({...formPedido, estado: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold uppercase border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500">
                      <option value="no entregado">No Entregado (Pendiente)</option>
                      <option value="entregado">Entregado ALUMNA</option>
                    </select>
                  </div>
                  <div className="lg:col-span-1">
                     <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Observaciones</label>
                     <input type="text" value={formPedido.observacion} onChange={e=>setFormPedido({...formPedido, observacion: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Opcional..." />
                  </div>
                  
                  <div className="lg:col-span-4 flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
                    <button type="button" onClick={() => setIsEditingPedido(null)} className="px-6 py-2 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
                    <button type="submit" className="px-8 py-2 bg-purple-600 text-white rounded shadow-sm text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700 transition-colors">Guardar Pedido</button>
                  </div>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200">
                       <th className="px-6 py-4 font-black">Fecha</th>
                       <th className="px-6 py-4 font-black">Alumna</th>
                       <th className="px-6 py-4 font-black">Prenda y Talle</th>
                       <th className="px-6 py-4 font-black">Cobro</th>
                       <th className="px-6 py-4 font-black">Estado Entrega</th>
                       <th className="px-6 py-4 font-black text-right">Acciones</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {loading ? (
                       <tr><td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">Cargando pedidos...</td></tr>
                     ) : pedidosMes.length === 0 ? (
                       <tr><td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No hay pedidos registrados en {MESES[currentMonthDate.getMonth()]}</td></tr>
                     ) : (
                       pedidosMes.map(p => (
                         <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-xs text-slate-600 font-bold uppercase">
                              {p.dateObj.toLocaleDateString('es-AR')}
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-black text-slate-800 uppercase">{p.alumna_nombre || 'S/D'}</p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="text-xs font-bold text-purple-700 uppercase">{p.prenda || p.concepto}</p>
                              <p className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Talle: {p.talle || '-'}</p>
                              {p.observacion && <p className="text-[9px] text-slate-400 italic mt-1">{p.observacion}</p>}
                            </td>
                            <td className="px-6 py-4">
                               <p className="text-sm font-black text-slate-800">${parseFloat(p.monto).toLocaleString('es-AR')}</p>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.metodo}</p>
                            </td>
                            <td className="px-6 py-4">
                               <div className="flex flex-col items-start gap-1">
                                 <button 
                                   onClick={() => handleToggleEstado(p.id, p.estado_entrega || 'no entregado')}
                                   className={`inline-flex px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                                     p.estado_entrega === 'entregado' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-400' : 'bg-amber-100/50 text-amber-700 border-amber-400'
                                   }`}
                                   title="Clic para cambiar estado"
                                 >
                                    {p.estado_entrega || 'no entregado'} {p.estado_entrega === 'entregado' ? '✓' : '⏳'}
                                 </button>
                                 <span className="text-[8px] uppercase tracking-widest text-slate-400 font-bold ml-1">Cambiar</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-3">
                                <button onClick={()=>{
                                  setFormPedido({
                                    alumna_nombre: p.alumna_nombre || '',
                                    prenda: p.prenda || p.concepto || '',
                                    talle: p.talle || '',
                                    monto: p.monto?.toString() || '',
                                    observacion: p.observacion || '',
                                    metodo: p.metodo || 'efectivo',
                                    estado: p.estado_entrega || 'no entregado'
                                  });
                                  setIsEditingPedido(p);
                                }} className="text-slate-400 hover:text-purple-600 transition-colors" title="Editar"><Edit className="w-4 h-4" /></button>
                                {deleteConfirmPedidoId === p.id ? (
                                   <div className="flex flex-col items-center gap-1">
                                      <span className="text-[9px] text-red-600 font-bold uppercase tracking-widest leading-none">¿Seguro?</span>
                                      <div className="flex gap-1 mt-1">
                                         <button onClick={() => handleDeletePedido(p.id)} className="bg-red-600 text-white px-2 py-1 rounded text-[9px] font-bold uppercase hover:bg-red-700">Sí</button>
                                         <button onClick={() => setDeleteConfirmPedidoId(null)} className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[9px] font-bold uppercase hover:bg-slate-300">No</button>
                                      </div>
                                   </div>
                                ) : (
                                   <button onClick={()=>setDeleteConfirmPedidoId(p.id)} className="text-slate-400 hover:text-red-600 transition-colors" title="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                )}
                              </div>
                            </td>
                         </tr>
                       ))
                     )}
                   </tbody>
                 </table>
               </div>
            </div>
         </div>
      )}


      {/* ----------------- TAB CATALOGO ----------------- */}
      {activeTab === 'catalogo' && (
         <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                 <Package className="w-4 h-4 text-purple-600" /> Artículos Base
              </h2>
              <button 
                onClick={() => { setFormCatalogo({nombre: '', descripcion: '', precio: '', stock: '', imagen_url: ''}); setIsEditingCatalogo('nuevo'); }}
                className="flex items-center gap-2 bg-slate-800 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-slate-700 transition-colors"
              >
                <Plus className="w-3 h-3" /> Añadir Artículo al Catálogo
              </button>
            </div>

            {isEditingCatalogo && (
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-slate-800"></div>
                <h2 className="text-sm font-bold uppercase tracking-tight mb-4">{isEditingCatalogo === 'nuevo' ? 'Nuevo' : 'Editar'} Artículo</h2>
                <form onSubmit={handleSaveCatalogo} className="grid grid-cols-2 gap-4">
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre Prenda/Art</label><input type="text" required value={formCatalogo.nombre} onChange={e=>setFormCatalogo({...formCatalogo, nombre: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2 rounded outline-none focus:ring-slate-500 focus:border-slate-500" /></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Precio Sugerido ($)</label><input type="text" inputMode="numeric" required value={formCatalogo.precio} onChange={e=>setFormCatalogo({...formCatalogo, precio: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2 rounded outline-none focus:ring-slate-500 focus:border-slate-500" /></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Stock Ideal</label><input type="text" inputMode="numeric" required value={formCatalogo.stock} onChange={e=>setFormCatalogo({...formCatalogo, stock: e.target.value.replace(/[^0-9]/g, '')})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2 rounded outline-none focus:ring-slate-500 focus:border-slate-500" /></div>
                  <div><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">URL Imagen</label><input type="text" value={formCatalogo.imagen_url} onChange={e=>setFormCatalogo({...formCatalogo, imagen_url: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2 rounded outline-none focus:ring-slate-500 focus:border-slate-500" /></div>
                  <div className="col-span-2"><label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Descripción corta</label><input type="text" value={formCatalogo.descripcion} onChange={e=>setFormCatalogo({...formCatalogo, descripcion: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2 rounded outline-none focus:ring-slate-500 focus:border-slate-500" /></div>
                  
                  <div className="flex gap-2 col-span-2 justify-end mt-2">
                    <button type="button" onClick={() => setIsEditingCatalogo(null)} className="px-4 py-2 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-200">Cancelar</button>
                    <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded text-[10px] uppercase font-bold tracking-widest hover:bg-slate-900">Guardar Artículo</button>
                  </div>
                </form>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {loading ? <p className="text-xs font-bold uppercase text-slate-400">Cargando...</p> : (
                productos.map(p => (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-300 transition-colors">
                    <img src={p.imagen_url} alt={p.nombre} className="w-full h-32 object-cover" referrerPolicy="no-referrer" />
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-sm font-bold uppercase tracking-tight truncate" title={p.nombre}>{p.nombre}</h3>
                        <span className="font-black text-slate-700">${p.precio}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 uppercase font-bold line-clamp-2 min-h-[30px] mb-4">{p.descripcion}</p>
                      <div className="flex justify-between items-center border-t border-slate-100 pt-3">
                        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded border ${p.stock > 5 ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                          Stock: {p.stock}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={()=>{setIsEditingCatalogo(p); setFormCatalogo(p);}} className="text-slate-400 hover:text-slate-600"><Edit className="w-3 h-3" /></button>
                          {deleteConfirmCatalogoId === p.id ? (
                             <div className="flex gap-1">
                               <button onClick={()=>handleDeleteCatalogo(p.id)} className="bg-red-600 text-white px-2 py-1 rounded text-[9px] font-bold uppercase hover:bg-red-700">Sí</button>
                               <button onClick={()=>setDeleteConfirmCatalogoId(null)} className="bg-slate-200 text-slate-600 px-2 py-1 rounded text-[9px] font-bold uppercase hover:bg-slate-300">X</button>
                             </div>
                          ) : (
                             <button onClick={()=>setDeleteConfirmCatalogoId(p.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
         </div>
      )}

    </div>
  );
}
