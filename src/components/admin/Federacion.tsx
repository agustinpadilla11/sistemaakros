import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2, CheckSquare, Calendar, ChevronLeft, ChevronRight, Download, Search, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '../../hooks/useAuth';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export default function Federacion() {
  const { userData } = useAuth();
  if (!userData) return null;
  const [activeTab, setActiveTab] = useState<'licencias' | 'inscripciones'>('licencias');
  const [loading, setLoading] = useState(true);
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [isEditing, setIsEditing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const [form, setForm] = useState({
    alumna_nombre: '',
    monto: '',
    metodo: 'efectivo',
    fecha: new Date().toISOString().split('T')[0],
    notas: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const aSnap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(aSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (a.nombre_completo || '').localeCompare(b.nombre_completo || '')));

      const collectionName = activeTab === 'licencias' ? 'federacion_licencias' : 'federacion_inscripciones';
      const dSnap = await getDocs(collection(db, collectionName));
      const docs = dSnap.docs.map(doc => {
        const d = doc.data();
        let dateObj = new Date();
        if (d.fecha?.toDate) dateObj = d.fecha.toDate();
        else if (d.fecha) dateObj = new Date(d.fecha);
        return { id: doc.id, ...d, dateObj };
      });
      docs.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
      setData(docs);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [activeTab]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const collectionName = activeTab === 'licencias' ? 'federacion_licencias' : 'federacion_inscripciones';
      const payload = {
        alumna_nombre: form.alumna_nombre,
        monto: parseFloat(form.monto) || 0,
        metodo: form.metodo,
        fecha: new Date(form.fecha),
        notas: form.notas,
        tipo: activeTab // para caja diaria
      };

      if (isEditing === 'nuevo') {
        const newRef = doc(collection(db, collectionName));
        await setDoc(newRef, { id: newRef.id, ...payload });
      } else {
        await updateDoc(doc(db, collectionName, isEditing.id), payload);
      }
      setIsEditing(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este registro?')) return;
    try {
      const collectionName = activeTab === 'licencias' ? 'federacion_licencias' : 'federacion_inscripciones';
      await deleteDoc(doc(db, collectionName, id));
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const exportToExcel = () => {
    const filteredData = data.filter(d => 
      d.dateObj.getMonth() === currentMonthDate.getMonth() && 
      d.dateObj.getFullYear() === currentMonthDate.getFullYear()
    );

    const worksheetData = filteredData.map(d => ({
      'Fecha': d.dateObj.toLocaleDateString('es-AR'),
      'Gimnasta': d.alumna_nombre,
      'Monto': d.monto,
      'Medio de Pago': d.metodo.toUpperCase(),
      'Tipo': activeTab === 'licencias' ? 'LICENCIA' : 'INSCRIPCION',
      'Notas': d.notas || ''
    }));

    // Add a summary row
    const total = filteredData.reduce((acc, d) => acc + d.monto, 0);
    worksheetData.push({
      'Fecha': 'TOTAL',
      'Gimnasta': '',
      'Monto': total,
      'Medio de Pago': '',
      'Tipo': '',
      'Notas': ''
    } as any);

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    
    // Set column widths
    const wscols = [
      {wch: 15}, // Fecha
      {wch: 30}, // Gimnasta
      {wch: 12}, // Monto
      {wch: 20}, // Medio
      {wch: 15}, // Tipo
      {wch: 40}  // Notas
    ];
    worksheet['!cols'] = wscols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeTab.toUpperCase());
    
    const fileName = `Federacion_${activeTab}_${MESES[currentMonthDate.getMonth()]}_${currentMonthDate.getFullYear()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const changeMonth = (delta: number) => {
    setCurrentMonthDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  const filteredData = data.filter(d => 
    d.dateObj.getMonth() === currentMonthDate.getMonth() && 
    d.dateObj.getFullYear() === currentMonthDate.getFullYear()
  );

  const filteredAlumnas = alumnas.filter(a => 
    (a.nombre_completo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
           <CheckSquare className="w-5 h-5 text-purple-600" />
           Federación
        </h1>
        <div className="flex bg-slate-100 p-1 rounded-lg">
           <button 
             onClick={()=>setActiveTab('licencias')} 
             className={`px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest transition-colors ${activeTab === 'licencias' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
           >
             💳 Licencias
           </button>
           <button 
             onClick={()=>setActiveTab('inscripciones')} 
             className={`px-4 py-2 rounded text-[10px] uppercase font-bold tracking-widest transition-colors ${activeTab === 'inscripciones' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
           >
             📝 Inscripciones
           </button>
        </div>
      </div>

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg shadow-inner border border-slate-200/60">
              <button onClick={() => changeMonth(-1)} className="p-1.5 hover:bg-white rounded transition-colors text-slate-600">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide min-w-[120px] text-center">
                {MESES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
              </span>
              <button onClick={() => changeMonth(1)} className="p-1.5 hover:bg-white rounded transition-colors text-slate-600">
                <ChevronRight className="w-4 h-4" />
              </button>
           </div>
           <button 
             onClick={exportToExcel}
             className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors shadow-sm"
           >
             <Download className="w-3 h-3" /> Exportar Excel
           </button>
        </div>
        <button 
          onClick={() => { 
            setForm({alumna_nombre: '', monto: '', metodo: 'efectivo', fecha: new Date().toISOString().split('T')[0], notas: ''}); 
            setSearchTerm('');
            setIsEditing('nuevo'); 
          }}
          className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors shadow-sm"
        >
          <Plus className="w-3 h-3" /> Nuevo Registro
        </button>
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
          <h2 className="text-sm font-black uppercase tracking-tight mb-4 text-purple-900">{isEditing === 'nuevo' ? 'Registrar' : 'Editar'} {activeTab === 'licencias' ? 'Licencia' : 'Inscripción'}</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gimnasta</label>
              <div className="relative">
                <input 
                  list="alumnas-list"
                  type="text" 
                  required 
                  value={form.alumna_nombre} 
                  onChange={e => setForm({...form, alumna_nombre: e.target.value})}
                  className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500 uppercase pr-10" 
                  placeholder="Nombre de la gimnasta..."
                />
                <datalist id="alumnas-list">
                  {alumnas.map(a => (
                    <option key={a.id} value={a.nombre_completo} />
                  ))}
                </datalist>
                <Users className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto ($)</label>
              <input type="text" inputMode="numeric" required value={form.monto} onChange={e=>setForm({...form, monto: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Método de Pago</label>
              <select required value={form.metodo} onChange={e=>setForm({...form, metodo: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold uppercase border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500">
                <option value="efectivo">Efectivo</option>
                <option value="debito">Débito</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
              <input type="date" required value={form.fecha} onChange={e=>setForm({...form, fecha: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas / Observaciones</label>
              <input type="text" value={form.notas} onChange={e=>setForm({...form, notas: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-purple-500 focus:border-purple-500" placeholder="Opcional..." />
            </div>
            
            <div className="lg:col-span-3 flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setIsEditing(null)} className="px-6 py-2 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
              <button type="submit" className="px-8 py-2 bg-purple-600 text-white rounded shadow-sm text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700 transition-colors">Guardar</button>
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
                <th className="px-6 py-4 font-black">Gimnasta</th>
                <th className="px-6 py-4 font-black">Monto</th>
                <th className="px-6 py-4 font-black">Método</th>
                <th className="px-6 py-4 font-black">Notas</th>
                <th className="px-6 py-4 font-black text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">Cargando...</td></tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No hay registros para este mes</td></tr>
              ) : (
                filteredData.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs text-slate-600 font-bold">{d.dateObj.toLocaleDateString('es-AR')}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-800 uppercase">{d.alumna_nombre}</td>
                    <td className="px-6 py-4 text-sm font-black text-purple-700">${d.monto.toLocaleString('es-AR')}</td>
                    <td className="px-6 py-4"><span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-100 px-2 py-1 rounded">{d.metodo}</span></td>
                    <td className="px-6 py-4 text-xs text-slate-400 italic">{d.notas || '-'}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3 text-slate-400">
                        <button onClick={() => {
                          setForm({
                            alumna_nombre: d.alumna_nombre,
                            monto: d.monto.toString(),
                            metodo: d.metodo,
                            fecha: d.dateObj.toISOString().split('T')[0],
                            notas: d.notas || ''
                          });
                          setSearchTerm(d.alumna_nombre);
                          setIsEditing(d);
                        }} className="hover:text-purple-600"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(d.id)} className="hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
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
