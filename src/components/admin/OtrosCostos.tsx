import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function OtrosCostos() {
  const [costos, setCostos] = useState<any[]>([]);
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [form, setForm] = useState({ alumna_id: '', concepto: '', monto: '', fecha: '', estado: 'pendiente', metodo_pago: 'efectivo', notas: '' });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const aSnap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));

      const cSnap = await getDocs(collection(db, 'otros_costos'));
      setCostos(cSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => b.fecha?.seconds - a.fecha?.seconds));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.alumna_id) {
       alert("Por favor, selecciona una gimnasta válida de la lista.");
       return;
    }
    
    try {
      const payload = {
        alumna_id: form.alumna_id,
        concepto: form.concepto,
        monto: Number(form.monto),
        fecha: form.fecha ? new Date(form.fecha) : serverTimestamp(),
        estado: form.estado,
        metodo_pago: form.metodo_pago,
        notas: form.notas
      };

      if (isEditing === 'nuevo') {
        const newRef = doc(collection(db, 'otros_costos'));
        await setDoc(newRef, { id: newRef.id, ...payload });
      } else {
        await updateDoc(doc(db, 'otros_costos', isEditing.id), payload);
      }
      setIsEditing(null);
      setSearchTerm('');
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error guardando');
    }
  };

  const getAlumnaName = (id: string) => alumnas.find(a => a.id === id)?.nombre_completo || 'Desconocida';

  const filteredAlumnas = alumnas.filter(a => (a.nombre_completo || '').toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">Otros Costos</h1>
        <button 
          onClick={() => { 
             setForm({alumna_id: '', concepto: '', monto: '', fecha: new Date().toISOString().split('T')[0], estado: 'pendiente', metodo_pago: 'efectivo', notas: ''}); 
             setSearchTerm('');
             setIsEditing('nuevo'); 
          }}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors"
        >
          <Plus className="w-3 h-3" /> Nuevo Costo
        </button>
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-tight mb-4">{isEditing === 'nuevo' ? 'Nuevo' : 'Editar'} Costo</h2>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gimnasta</label>
              <input 
                 type="text" 
                 placeholder="Buscar por nombre..."
                 value={searchTerm} 
                 onChange={e => {
                    setSearchTerm(e.target.value);
                    setShowDropdown(true);
                    setForm({...form, alumna_id: ''}); // clear ID until selected
                 }}
                 onFocus={() => setShowDropdown(true)}
                 className={`w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase ${!form.alumna_id && searchTerm ? 'border-amber-400' : ''}`}
              />
              {showDropdown && (
                <ul className="absolute z-10 w-full bg-white border border-slate-200 mt-1 max-h-48 overflow-y-auto rounded shadow-lg">
                  {filteredAlumnas.length > 0 ? (
                    filteredAlumnas.map(a => (
                      <li 
                         key={a.id} 
                         className="p-2 text-xs font-bold uppercase hover:bg-purple-50 cursor-pointer border-b border-slate-50 last:border-none"
                         onClick={() => {
                            setForm({...form, alumna_id: a.id});
                            setSearchTerm(a.nombre_completo);
                            setShowDropdown(false);
                         }}
                      >
                         {a.nombre_completo}
                      </li>
                    ))
                  ) : (
                    <li className="p-2 text-xs text-slate-500 italic">No se encontraron resultados</li>
                  )}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Concepto (Ej: Torneo)</label>
              <input type="text" required value={form.concepto} onChange={e=>setForm({...form, concepto: e.target.value})} className="w-full border-slate-200 bg-slate-50 text-xs font-bold p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto ($)</label>
              <input type="number" required value={form.monto} onChange={e=>setForm({...form, monto: e.target.value})} className="w-full border-slate-200 bg-slate-50 text-xs font-bold p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Estado</label>
              <select required value={form.estado} onChange={e=>setForm({...form, estado: e.target.value})} className="w-full border-slate-200 bg-slate-50 text-xs font-bold p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase">
                <option value="pendiente">Pendiente</option>
                <option value="pagado">Pagado</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Método de Pago</label>
              <select required value={form.metodo_pago} onChange={e=>setForm({...form, metodo_pago: e.target.value})} className="w-full border-slate-200 bg-slate-50 text-xs font-bold p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
              <input type="date" required value={form.fecha} onChange={e=>setForm({...form, fecha: e.target.value})} className="w-full border-slate-200 bg-slate-50 text-xs font-bold p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas</label>
              <input type="text" value={form.notas} onChange={e=>setForm({...form, notas: e.target.value})} className="w-full border-slate-200 bg-slate-50 text-xs font-bold p-2 rounded outline-none focus:ring-purple-500 focus:border-purple-500" />
            </div>
            
            <div className="flex gap-2 col-span-2 justify-end mt-2">
              <button type="button" onClick={() => setIsEditing(null)} className="px-4 py-2 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-200">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700">Guardar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <h3 className="text-sm font-bold uppercase tracking-tight">Registro</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left bg-white">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white">
                <th className="py-3 px-6 font-black">Fecha</th>
                <th className="py-3 px-6 font-black">Gimnasta</th>
                <th className="py-3 px-6 font-black">Concepto</th>
                <th className="py-3 px-6 font-black">Monto</th>
                <th className="py-3 px-6 font-black">Estado / Método</th>
                <th className="py-3 px-6 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-8 text-center text-xs font-bold uppercase text-slate-500">Cargando...</td></tr>
              ) : (
                costos.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-6 text-xs text-slate-500">{c.fecha ? c.fecha.toDate().toLocaleDateString('es-AR') : '-'}</td>
                    <td className="py-3 px-6 text-sm font-bold uppercase tracking-tight">{getAlumnaName(c.alumna_id)}</td>
                    <td className="py-3 px-6 text-xs font-bold text-slate-600 uppercase">{c.concepto} {c.notas && <span className="text-[10px] text-slate-400 ml-2">({c.notas})</span>}</td>
                    <td className="py-3 px-6 text-sm font-black text-purple-700">${c.monto}</td>
                    <td className="py-3 px-6">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border w-fit ${
                          c.estado === 'pagado' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-amber-100 border-amber-200 text-amber-700'
                        }`}>
                          {c.estado}
                        </span>
                        {c.estado === 'pagado' && (
                           <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">{c.metodo_pago}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-6 text-right">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <button onClick={()=>{
                          const f = {...c}; 
                          if(f.fecha) f.fecha = f.fecha.toDate().toISOString().split('T')[0]; 
                          setIsEditing(c); 
                          setForm(f);
                          setSearchTerm(getAlumnaName(c.alumna_id));
                        }} className="hover:text-purple-600"><Edit className="w-3 h-3" /></button>
                        <button onClick={async () => {
                          if(confirm('Eliminar?')) { await deleteDoc(doc(db, 'otros_costos', c.id)); loadData();}
                        }} className="hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
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
  );
}
