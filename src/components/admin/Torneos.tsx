import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2, Trophy, Search, FileUp, Printer, Download, UserPlus, Users, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Torneos() {
  const [loading, setLoading] = useState(true);
  const [torneos, setTorneos] = useState<any[]>([]);
  const [pagos, setPagos] = useState<any[]>([]);
  const [alumnas, setAlumnas] = useState<any[]>([]);
  
  const [isEditingTorneo, setIsEditingTorneo] = useState<any>(null);
  const [isEditingPago, setIsEditingPago] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTorneo, setSelectedTorneo] = useState<any>(null);

  const [torneoForm, setTorneoForm] = useState({
    nombre: '',
    lugar: '',
    fecha: new Date().toISOString().split('T')[0]
  });

  const [pagoForm, setPagoForm] = useState({
    alumna_nombre: '',
    torneo_id: '',
    categoria: '',
    monto: '',
    metodo: 'efectivo',
    fecha: new Date().toISOString().split('T')[0]
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const aSnap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any })).filter(a => a.estado !== 'inactiva').sort((a: any, b: any) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));

      const tSnap = await getDocs(collection(db, 'torneos_lista'));
      const tList = tSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTorneos(tList);

      const pSnap = await getDocs(collection(db, 'torneos_pagos'));
      setPagos(pSnap.docs.map(doc => {
        const d = doc.data();
        let dateObj = new Date();
        if (d.fecha?.toDate) dateObj = d.fecha.toDate();
        else if (d.fecha) dateObj = new Date(d.fecha);
        return { id: doc.id, ...d, dateObj };
      }));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSaveTorneo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditingTorneo === 'nuevo') {
        const newRef = doc(collection(db, 'torneos_lista'));
        await setDoc(newRef, { id: newRef.id, ...torneoForm });
      } else {
        await updateDoc(doc(db, 'torneos_lista', isEditingTorneo.id), torneoForm);
      }
      setIsEditingTorneo(null);
      loadData();
    } catch (err: any) { 
      console.error(err); 
      alert('Error al guardar torneo: ' + err.message);
    }
  };

  const handleSavePago = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedMonto = typeof pagoForm.monto === 'string' 
        ? parseFloat(pagoForm.monto.replace(',', '.')) 
        : parseFloat(pagoForm.monto);
      
      const payload = {
        ...pagoForm,
        alumna_nombre: (pagoForm.alumna_nombre || 'S/N').toString().toUpperCase(),
        categoria: (pagoForm.categoria || '').toString().toUpperCase(),
        torneo_id: selectedTorneo.id,
        monto: parsedMonto || 0,
        fecha: new Date(pagoForm.fecha + 'T12:00:00'),
        tipo: 'torneo'
      };
      if (isEditingPago === 'nuevo') {
        const newRef = doc(collection(db, 'torneos_pagos'));
        await setDoc(newRef, { id: newRef.id, ...payload });
      } else {
        await updateDoc(doc(db, 'torneos_pagos', isEditingPago.id), payload);
      }
      setIsEditingPago(null);
      loadData();
    } catch (err: any) { 
      console.error(err); 
      alert('Error al guardar pago: ' + err.message);
    }
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTorneo) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data: any[] = XLSX.utils.sheet_to_json(ws);
      
      if (confirm(`¿Importar ${data.length} registros a este torneo? (Solo se tomarán los nombres)`)) {
        for (const item of data) {
           const firstValue = Object.values(item)[0];
           const name = (item.Nombre || item['Nombre y Apellido'] || item.nombre_completo || item.nombre || firstValue || 'S/N').toString().toUpperCase();

           const newRef = doc(collection(db, 'torneos_pagos'));
           await setDoc(newRef, {
             id: newRef.id,
             alumna_nombre: name,
             torneo_id: selectedTorneo.id,
             categoria: '',
             monto: 0,
             metodo: 'efectivo',
             fecha: null,
             estado: 'pendiente',
             tipo: 'torneo'
           });
        }
        alert('Importación finalizada');
        loadData();
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePrint = (torneoId: string) => {
    const torneo = torneos.find(t => t.id === torneoId);
    const participantes = pagos.filter(p => p.torneo_id === torneoId);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Lista de Torneo - ${torneo?.nombre}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; color: #1e293b; }
            h1 { text-transform: uppercase; font-size: 24px; margin-bottom: 5px; }
            h2 { font-size: 14px; color: #64748b; margin-top: 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 30px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: left; }
            th { background: #f8fafc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.1em; }
            td { font-size: 12px; font-weight: bold; }
            .header { border-bottom: 2px solid #1e293b; padding-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${torneo?.nombre}</h1>
            <h2>Lugar: ${torneo?.lugar} | Fecha: ${torneo?.fecha}</h2>
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Gimnasta</th>
                <th>Categoría</th>
                <th>Monto</th>
                <th>Método</th>
              </tr>
            </thead>
            <tbody>
              ${participantes.map((p, i) => `
                <tr>
                  <td>${i + 1}</td>
                  <td style="text-transform: uppercase;">${p.alumna_nombre}</td>
                  <td style="text-transform: uppercase;">${p.categoria}</td>
                  <td>$${p.monto.toLocaleString('es-AR')}</td>
                  <td style="text-transform: uppercase;">${p.metodo}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top: 30px; font-size: 10px; color: #94a3b8;">Generado por Sistema Akros - ${new Date().toLocaleString()}</p>
          <script>window.print();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const currentPagos = selectedTorneo 
    ? pagos
        .filter(p => p.torneo_id === selectedTorneo.id && p.alumna_nombre.includes(searchTerm.toUpperCase()))
        .sort((a, b) => a.alumna_nombre.localeCompare(b.alumna_nombre))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
           <Trophy className="w-5 h-5 text-amber-600" />
           {selectedTorneo ? `Torneo: ${selectedTorneo.nombre}` : 'Torneos'}
        </h1>
        {selectedTorneo && (
          <button onClick={() => setSelectedTorneo(null)} className="flex items-center gap-2 text-slate-500 hover:text-slate-800 text-[10px] font-bold uppercase tracking-widest bg-slate-100 px-3 py-1.5 rounded transition-all">
            <ChevronLeft className="w-4 h-4" /> Volver a la Lista
          </button>
        )}
      </div>

      <datalist id="torneo-alumnas-datalist">
        {alumnas.map(a => <option key={a.id} value={a.nombre_completo} />)}
      </datalist>

      {!selectedTorneo ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {torneos.map(t => (
              <div key={t.id} onClick={() => setSelectedTorneo(t)} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3">
                   <div className="flex gap-1">
                      <button onClick={(e)=> { e.stopPropagation(); setTorneoForm({nombre: t.nombre, lugar: t.lugar, fecha: t.fecha}); setIsEditingTorneo(t); }} className="p-1.5 text-slate-300 hover:text-amber-600 hover:bg-amber-50 rounded transition-all"><Edit className="w-4 h-4" /></button>
                      <button onClick={async (e)=>{ e.stopPropagation(); if(confirm('¿Eliminar torneo?')) { await deleteDoc(doc(db, 'torneos_lista', t.id)); loadData(); }}} className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded transition-all"><Trash2 className="w-4 h-4" /></button>
                   </div>
                </div>
                <div className="bg-amber-50 p-3 rounded-xl w-fit mb-4 group-hover:bg-amber-100 transition-colors">
                  <Trophy className="w-6 h-6 text-amber-600" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-tight text-slate-800 mb-1">{t.nombre}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">{t.lugar} • {t.fecha}</p>
                <div className="text-[10px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                   Ver Detalles <ChevronRight className="w-3 h-3" />
                </div>
              </div>
            ))}
            
            {/* Create Button at the end */}
            <button 
              onClick={() => { setTorneoForm({nombre: '', lugar: '', fecha: new Date().toISOString().split('T')[0]}); setIsEditingTorneo('nuevo'); }}
              className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-slate-400 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/30 transition-all min-h-[160px]"
            >
              <Plus className="w-8 h-8" />
              <span className="text-[10px] font-black uppercase tracking-widest">Crear Nuevo Torneo</span>
            </button>
          </div>

          {isEditingTorneo && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                <h2 className="text-sm font-black uppercase tracking-tight mb-6 text-slate-800">{isEditingTorneo === 'nuevo' ? 'Nuevo' : 'Editar'} Torneo</h2>
                <form onSubmit={handleSaveTorneo} className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre del Torneo</label>
                      <input type="text" required value={torneoForm.nombre} onChange={e=>setTorneoForm({...torneoForm, nombre: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 uppercase" placeholder="Ej: Provincial Federativo" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Lugar / Sede</label>
                      <input type="text" required value={torneoForm.lugar} onChange={e=>setTorneoForm({...torneoForm, lugar: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 uppercase" placeholder="Ej: Club Akros" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                      <input type="date" required value={torneoForm.fecha} onChange={e=>setTorneoForm({...torneoForm, fecha: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div className="flex gap-3 justify-end mt-6">
                      <button type="button" onClick={()=>setIsEditingTorneo(null)} className="px-6 py-2.5 bg-slate-100 rounded-xl text-slate-600 text-[10px] uppercase font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
                      <button type="submit" className="px-8 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] uppercase font-bold hover:bg-amber-700 transition-all shadow-md shadow-amber-200">Guardar Torneo</button>
                    </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Recaudado</p>
                <p className="text-xl font-black text-amber-700">${currentPagos.reduce((a,b)=>a+b.monto, 0).toLocaleString('es-AR')}</p>
             </div>
             <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-center">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Inscriptos</p>
                <p className="text-xl font-black text-slate-800">{currentPagos.length}</p>
             </div>
             <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input type="file" onChange={handleImportExcel} className="hidden" id="excel-import" />
                  <label htmlFor="excel-import" className="h-full flex flex-col items-center justify-center gap-1 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer">
                    <FileUp className="w-5 h-5" /> Importar Excel
                  </label>
                </div>
                <button onClick={()=>handlePrint(selectedTorneo.id)} className="flex-1 flex flex-col items-center justify-center gap-1 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-100 transition-colors border border-slate-200">
                  <Printer className="w-5 h-5" /> Imprimir
                </button>
             </div>
          </div>

          {isEditingPago && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white p-6 rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500"></div>
                <h2 className="text-sm font-black uppercase tracking-tight mb-6 text-slate-800">{isEditingPago === 'nuevo' ? 'Registrar' : 'Editar'} Pago - {selectedTorneo.nombre}</h2>
                <form onSubmit={handleSavePago} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gimnasta</label>
                      <input 
                        type="text" list="torneo-alumnas-datalist" required 
                        value={pagoForm.alumna_nombre} 
                        onChange={e=>setPagoForm({...pagoForm, alumna_nombre: e.target.value})}
                        className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 uppercase" 
                        placeholder="Buscar por nombre..."
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto ($)</label>
                      <input type="text" required value={pagoForm.monto} onChange={e=>setPagoForm({...pagoForm, monto: e.target.value.replace(/[^0-9,.]/g, '')})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" placeholder="0.00" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                      <input type="date" required value={pagoForm.fecha} onChange={e=>setPagoForm({...pagoForm, fecha: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded-xl outline-none focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <div className="md:col-span-2 flex gap-3 justify-end mt-6 pt-4 border-t border-slate-100">
                      <button type="button" onClick={()=>setIsEditingPago(null)} className="px-6 py-2.5 bg-slate-100 rounded-xl text-slate-600 text-[10px] uppercase font-bold hover:bg-slate-200">Cancelar</button>
                      <button type="submit" className="px-8 py-2.5 bg-amber-600 text-white rounded-xl text-[10px] uppercase font-bold hover:bg-amber-700 shadow-md">Guardar Pago</button>
                    </div>
                </form>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-sm font-bold uppercase tracking-tight text-slate-800">Participantes</h3>
              <div className="relative w-full sm:max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text"
                  placeholder="Buscar participante (A-Z)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-amber-500 transition-all"
                />
              </div>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200 font-black">
                  <th className="px-6 py-4">Gimnasta</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentPagos.length === 0 ? (
                  <tr><td colSpan={2} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase">Sin participantes registrados</td></tr>
                ) : (
                  currentPagos.map(p => (
                    <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.monto > 0 ? 'bg-emerald-50/40' : ''}`}>
                      <td className="px-6 py-4 text-sm font-black text-slate-800 uppercase flex items-center gap-2">
                        {p.monto > 0 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        {p.alumna_nombre}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3 text-slate-400 items-center">
                          {(!p.monto || p.monto === 0) ? (
                            <button 
                              onClick={()=>{setPagoForm({alumna_nombre: p.alumna_nombre, torneo_id: p.torneo_id, categoria: '', monto: '', metodo: 'efectivo', fecha: new Date().toISOString().split('T')[0]}); setIsEditingPago(p);}} 
                              className="text-[10px] uppercase font-black bg-amber-100 text-amber-700 px-4 py-2 rounded-lg hover:bg-amber-200 transition-colors whitespace-nowrap shadow-sm"
                            >
                              Cargar Pago
                            </button>
                          ) : (
                            <div className="flex items-center gap-4 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                              <div className="text-right">
                                <span className="block text-xs font-black text-emerald-600">${p.monto.toLocaleString('es-AR')}</span>
                                <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-widest">{p.dateObj ? p.dateObj.toLocaleDateString('es-AR') : ''}</span>
                              </div>
                              <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
                                <button onClick={()=>{setPagoForm({alumna_nombre: p.alumna_nombre, torneo_id: p.torneo_id, categoria: '', monto: p.monto.toString(), metodo: p.metodo, fecha: p.fecha ? p.dateObj.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]}); setIsEditingPago(p);}} className="hover:text-amber-600 text-slate-400 p-1.5 hover:bg-slate-50 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                                <button onClick={async ()=>{if(confirm('¿Eliminar registro?')) { await deleteDoc(doc(db, 'torneos_pagos', p.id)); loadData(); }}} className="hover:text-red-600 text-slate-400 p-1.5 hover:bg-slate-50 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                              </div>
                            </div>
                          )}
                          {(!p.monto || p.monto === 0) && (
                            <button onClick={async ()=>{if(confirm('¿Eliminar registro?')) { await deleteDoc(doc(db, 'torneos_pagos', p.id)); loadData(); }}} className="hover:text-red-600 p-2"><Trash2 className="w-4 h-4" /></button>
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
      )}
    </div>
  );
}
