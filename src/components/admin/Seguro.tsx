import { useState, useEffect } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2, Calendar, ChevronLeft, ChevronRight, Download, Search, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const cleanNameForMatch = (name: string) => {
  return name ? name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "").trim() : "";
};

export default function Seguro() {
  const [loading, setLoading] = useState(true);
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [bajas, setBajas] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'movimientos' | 'control' | 'altas_bajas'>('movimientos');
  
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [isEditing, setIsEditing] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [controlSearch, setControlSearch] = useState('');
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

      const gSnap = await getDocs(collection(db, 'grupos'));
      setGrupos(gSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const bSnap = await getDocs(collection(db, 'bajas'));
      setBajas(bSnap.docs.map(doc => {
        const d = doc.data();
        let dateObj = new Date();
        if (d.fecha?.toDate) dateObj = d.fecha.toDate();
        else if (d.fecha) dateObj = new Date(d.fecha);
        return { id: doc.id, ...d, dateObj };
      }));

      const dSnap = await getDocs(collection(db, 'seguros'));
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

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedMonto = typeof form.monto === 'string'
        ? parseFloat(form.monto.replace(',', '.'))
        : parseFloat(form.monto);

      const payload = {
        alumna_nombre: (form.alumna_nombre || 'S/N').toString().toUpperCase(),
        monto: parsedMonto || 0,
        metodo: form.metodo,
        fecha: new Date(form.fecha),
        notas: form.notas,
        tipo: 'seguro'
      };

      if (isEditing === 'nuevo') {
        const newRef = doc(collection(db, 'seguros'));
        await setDoc(newRef, { id: newRef.id, ...payload });
      } else {
        await updateDoc(doc(db, 'seguros', isEditing.id), payload);
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
      await deleteDoc(doc(db, 'seguros', id));
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const startCobrarSeguro = (alumnaNombre: string) => {
    setForm({
      alumna_nombre: alumnaNombre,
      monto: '',
      metodo: 'efectivo',
      fecha: new Date().toISOString().split('T')[0],
      notas: ''
    });
    setSearchTerm(alumnaNombre);
    setIsEditing('nuevo');
    setActiveTab('movimientos');
  };

  const getSeguroStatus = (alumna: any, year: number) => {
    const grupo = grupos.find(g => g.id === alumna.grupo_id);
    const grupoNombre = (grupo?.nombre || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    // Check if group is desarrollo, formacion or elite
    const isBonificado = grupoNombre.includes('desarrollo') || 
                         grupoNombre.includes('formacion') || 
                         grupoNombre.includes('elite');

    if (isBonificado) {
      return { 
        status: 'bonificado', 
        label: 'PAGADO (GRUPO)', 
        detail: `Bonificado/Incluido por grupo ${grupo?.nombre || 'Competitivo'}` 
      };
    }

    const matchedPayment = data.find(d => 
      cleanNameForMatch(d.alumna_nombre) === cleanNameForMatch(alumna.nombre_completo) &&
      d.dateObj.getFullYear() === year
    );

    if (matchedPayment) {
      return {
        status: 'pagado',
        label: 'PAGADO',
        detail: `Pagado el ${matchedPayment.dateObj.toLocaleDateString('es-AR')} ($${matchedPayment.monto})`
      };
    }

    return {
      status: 'pendiente',
      label: 'PENDIENTE',
      detail: `Sin registrar pago para el año ${year}`
    };
  };

  const exportToExcel = () => {
    const filteredData = data.filter(d => 
      d.dateObj.getMonth() === currentMonthDate.getMonth() && 
      d.dateObj.getFullYear() === currentMonthDate.getFullYear()
    );

    const worksheetData = filteredData.map(d => ({
      Fecha: d.dateObj.toLocaleDateString('es-AR'),
      Gimnasta: d.alumna_nombre,
      Monto: d.monto,
      Método: d.metodo,
      Notas: d.notas || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MOVIMIENTOS SEGUROS');
    
    const fileName = `Seguros_Movimientos_${MESES[currentMonthDate.getMonth()]}_${currentMonthDate.getFullYear()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportControlToExcel = () => {
    const year = currentMonthDate.getFullYear();
    const worksheetData = alumnas
      .filter(a => a.estado !== 'inactiva')
      .map(a => {
        const statusInfo = getSeguroStatus(a, year);
        const grupo = grupos.find(g => g.id === a.grupo_id);
        return {
          Gimnasta: a.nombre_completo.toUpperCase(),
          DNI: a.dni,
          Grupo: (grupo?.nombre || 'SIN GRUPO').toUpperCase(),
          Estado: statusInfo.label,
          Detalle: statusInfo.detail
        };
      });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'CONTROL SEGUROS');
    
    const fileName = `Control_Seguros_${year}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const exportAltasBajasToExcel = () => {
    const monthName = MESES[currentMonthDate.getMonth()];
    const year = currentMonthDate.getFullYear();

    const worksheetAltasData = altasDelMes.map(a => ({
      Fecha: a.creado_en?.toDate ? a.creado_en.toDate().toLocaleDateString('es-AR') : new Date(a.creado_en).toLocaleDateString('es-AR'),
      Tipo: 'ALTA (REGISTRO)',
      Gimnasta: a.nombre_completo.toUpperCase(),
      DNI: a.dni,
      Grupo: (grupos.find(g => g.id === a.grupo_id)?.nombre || 'SIN GRUPO').toUpperCase()
    }));

    const worksheetBajasData = bajasDelMes.map(b => ({
      Fecha: b.dateObj.toLocaleDateString('es-AR'),
      Tipo: 'BAJA (DESVINCULACIÓN)',
      Gimnasta: b.alumna_nombre.toUpperCase(),
      DNI: b.alumna_dni,
      Grupo: (b.grupo_nombre || 'SIN GRUPO').toUpperCase()
    }));

    const combinedData = [...worksheetAltasData, ...worksheetBajasData];

    const worksheet = XLSX.utils.json_to_sheet(combinedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ALTAS Y BAJAS');
    
    const fileName = `Altas_Bajas_${monthName}_${year}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const changeMonth = (delta: number) => {
    setCurrentMonthDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + delta);
      return newDate;
    });
  };

  // Filter lists based on selected month/year
  const filteredData = data.filter(d => 
    d.dateObj.getMonth() === currentMonthDate.getMonth() && 
    d.dateObj.getFullYear() === currentMonthDate.getFullYear()
  );

  const filteredAlumnas = alumnas.filter(a => 
    a.estado !== 'inactiva' && (a.nombre_completo || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredControlAlumnas = alumnas.filter(a => 
    a.estado !== 'inactiva' && (a.nombre_completo || '').toLowerCase().includes(controlSearch.toLowerCase())
  );

  const altasDelMes = alumnas.filter(a => {
    if (!a.creado_en) return false;
    const date = a.creado_en.toDate ? a.creado_en.toDate() : new Date(a.creado_en);
    return date.getMonth() === currentMonthDate.getMonth() && 
           date.getFullYear() === currentMonthDate.getFullYear();
  });

  const bajasDelMes = bajas.filter(b => {
    return b.dateObj.getMonth() === currentMonthDate.getMonth() && 
           b.dateObj.getFullYear() === currentMonthDate.getFullYear();
  });

  const combinedAltasBajas = [
    ...altasDelMes.map(a => ({
      id: `alta-${a.id}`,
      tipo: 'alta',
      fecha: a.creado_en.toDate ? a.creado_en.toDate() : new Date(a.creado_en),
      nombre: a.nombre_completo,
      dni: a.dni,
      grupo: grupos.find(g => g.id === a.grupo_id)?.nombre || 'SIN GRUPO'
    })),
    ...bajasDelMes.map(b => ({
      id: `baja-${b.id}`,
      tipo: 'baja',
      fecha: b.dateObj,
      nombre: b.alumna_nombre,
      dni: b.alumna_dni,
      grupo: b.grupo_nombre
    }))
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
        <h1 className="text-sm font-bold uppercase tracking-tight flex items-center gap-2">
           <ShieldCheck className="w-5 h-5 text-emerald-600" />
           Seguro Deportivo
        </h1>
        <div className="flex bg-slate-100 p-1 rounded-lg gap-1 border border-slate-200 w-full sm:w-fit overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('movimientos')}
            className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'movimientos' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Movimientos Caja
          </button>
          <button 
            onClick={() => setActiveTab('control')}
            className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'control' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Control Seguros
          </button>
          <button 
            onClick={() => setActiveTab('altas_bajas')}
            className={`px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'altas_bajas' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          >
            Altas y Bajas
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
        <div className="flex flex-wrap items-center gap-4 w-full sm:w-auto">
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
           {activeTab === 'movimientos' && (
             <button 
               onClick={exportToExcel}
               className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
             >
               <Download className="w-3 h-3" /> Exportar Caja Excel
             </button>
           )}
           {activeTab === 'control' && (
             <button 
               onClick={exportControlToExcel}
               className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
             >
               <Download className="w-3 h-3" /> Exportar Control Excel
             </button>
           )}
           {activeTab === 'altas_bajas' && (
             <button 
               onClick={exportAltasBajasToExcel}
               className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
             >
               <Download className="w-3 h-3" /> Exportar Altas/Bajas
             </button>
           )}
        </div>
        
        {activeTab === 'movimientos' && (
          <button 
            onClick={() => { 
              setForm({alumna_nombre: '', monto: '', metodo: 'efectivo', fecha: new Date().toISOString().split('T')[0], notas: ''}); 
              setSearchTerm('');
              setIsEditing('nuevo'); 
            }}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-700 transition-colors shadow-sm w-full sm:w-auto justify-center"
          >
            <Plus className="w-3 h-3" /> Cobrar Seguro
          </button>
        )}
      </div>

      {activeTab === 'movimientos' && isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-md border border-slate-200 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
          <h2 className="text-sm font-black uppercase tracking-tight mb-4 text-emerald-900">{isEditing === 'nuevo' ? 'Registrar' : 'Editar'} Cobro de Seguro</h2>
          <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="relative">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Gimnasta</label>
              <div className="relative">
                <input 
                  type="text" 
                  required 
                  value={searchTerm} 
                  onChange={e => { setSearchTerm(e.target.value); setShowDropdown(true); setForm({...form, alumna_nombre: e.target.value}); }}
                  onFocus={() => setShowDropdown(true)}
                  className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-emerald-500 focus:border-emerald-500 uppercase pr-10" 
                  placeholder="Buscar gimnasta..."
                />
                <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
              </div>
              {showDropdown && searchTerm && (
                <ul className="absolute z-10 w-full bg-white border border-slate-200 mt-1 max-h-48 overflow-y-auto rounded shadow-xl">
                  {filteredAlumnas.map(a => (
                    <li 
                      key={a.id} 
                      className="p-3 text-xs font-bold uppercase hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-none transition-colors"
                      onClick={() => {
                        setForm({...form, alumna_nombre: a.nombre_completo});
                        setSearchTerm(a.nombre_completo);
                        setShowDropdown(false);
                      }}
                    >
                      {a.nombre_completo}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto ($)</label>
              <input type="text" inputMode="numeric" required value={form.monto} onChange={e=>setForm({...form, monto: e.target.value.replace(/[^0-9.]/g, '')})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-emerald-500 focus:border-emerald-500" placeholder="0" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Método de Pago</label>
              <select required value={form.metodo} onChange={e=>setForm({...form, metodo: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold uppercase border p-2.5 rounded outline-none focus:ring-emerald-500 focus:border-emerald-500">
                <option value="efectivo">Efectivo</option>
                <option value="debito">Débito</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
              <input type="date" required value={form.fecha} onChange={e=>setForm({...form, fecha: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-emerald-500 focus:border-emerald-500" />
            </div>
            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Notas / Observaciones</label>
              <input type="text" value={form.notas} onChange={e=>setForm({...form, notas: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-2.5 rounded outline-none focus:ring-emerald-500 focus:border-emerald-500" placeholder="Opcional..." />
            </div>
            
            <div className="lg:col-span-3 flex gap-3 justify-end mt-4 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setIsEditing(null)} className="px-6 py-2 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold tracking-widest hover:bg-slate-200 transition-colors">Cancelar</button>
              <button type="submit" className="px-8 py-2 bg-emerald-600 text-white rounded shadow-sm text-[10px] uppercase font-bold tracking-widest hover:bg-emerald-700 transition-colors">Guardar</button>
            </div>
          </form>
        </div>
      )}

      {activeTab === 'movimientos' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200 font-black">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Gimnasta</th>
                  <th className="px-6 py-4">Monto</th>
                  <th className="px-6 py-4">Método</th>
                  <th className="px-6 py-4">Notas</th>
                  <th className="px-6 py-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr><td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">Cargando...</td></tr>
                ) : filteredData.length === 0 ? (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No hay movimientos registrados para este mes</td></tr>
                ) : (
                  filteredData.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold">{d.dateObj.toLocaleDateString('es-AR')}</td>
                      <td className="px-6 py-4 text-xs font-black uppercase text-slate-800">{d.alumna_nombre}</td>
                      <td className="px-6 py-4 text-sm font-black text-emerald-700">${d.monto.toLocaleString('es-AR')}</td>
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md ${
                          d.metodo === 'efectivo' ? 'bg-emerald-100 text-emerald-700' :
                          d.metodo === 'debito' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>{d.metodo}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 italic">{d.notas || d.notes || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-3 text-slate-400">
                          <button onClick={() => {
                            setForm({
                              alumna_nombre: d.alumna_nombre,
                              monto: d.monto.toString(),
                              metodo: d.metodo,
                              fecha: d.dateObj.toISOString().split('T')[0],
                              notas: d.notas || d.notes || ''
                            });
                            setSearchTerm(d.alumna_nombre);
                            setIsEditing(d);
                          }} className="hover:text-emerald-600"><Edit className="w-4 h-4" /></button>
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
      )}

      {activeTab === 'control' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative max-w-sm">
               <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
               <input 
                 type="text"
                 placeholder="Buscar gimnasta..."
                 value={controlSearch}
                 onChange={e => setControlSearch(e.target.value)}
                 className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-600"
               />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200 font-black">
                    <th className="px-6 py-4">Gimnasta</th>
                    <th className="px-6 py-4">DNI</th>
                    <th className="px-6 py-4">Grupo</th>
                    <th className="px-6 py-4">Estado Seguro</th>
                    <th className="px-6 py-4">Detalle</th>
                    <th className="px-6 py-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {loading ? (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">Cargando...</td></tr>
                  ) : filteredControlAlumnas.length === 0 ? (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No hay gimnastas activas cargadas</td></tr>
                  ) : (
                    filteredControlAlumnas.map(a => {
                      const statusInfo = getSeguroStatus(a, currentMonthDate.getFullYear());
                      const grupo = grupos.find(g => g.id === a.grupo_id);
                      return (
                        <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-xs font-black uppercase text-slate-800">{a.nombre_completo}</td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-500">{a.dni || '-'}</td>
                          <td className="px-6 py-4 text-xs font-bold text-purple-600 uppercase">{grupo?.nombre || 'SIN GRUPO'}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                              statusInfo.status === 'bonificado' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              statusInfo.status === 'pagado' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                              'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 font-medium">{statusInfo.detail}</td>
                          <td className="px-6 py-4 text-right">
                             {statusInfo.status === 'pendiente' ? (
                               <button 
                                 onClick={() => startCobrarSeguro(a.nombre_completo)}
                                 className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-1.5 rounded uppercase hover:bg-emerald-700 transition-colors shadow-sm"
                               >
                                 Cobrar
                               </button>
                             ) : (
                               <span className="text-[10px] font-bold text-slate-400 uppercase">PAGADO</span>
                             )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'altas_bajas' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200 font-black">
                  <th className="px-6 py-4">Fecha</th>
                  <th className="px-6 py-4">Movimiento</th>
                  <th className="px-6 py-4">Gimnasta</th>
                  <th className="px-6 py-4">DNI</th>
                  <th className="px-6 py-4">Grupo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {loading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">Cargando...</td></tr>
                ) : combinedAltasBajas.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">Sin altas ni bajas registradas en este mes</td></tr>
                ) : (
                  combinedAltasBajas.map(item => (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-xs font-bold">{item.fecha.toLocaleDateString('es-AR')}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                          item.tipo === 'alta' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-red-100 text-red-800 border border-red-200'
                        }`}>
                          {item.tipo === 'alta' ? 'ALTA' : 'BAJA'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs font-black uppercase text-slate-800">{item.nombre}</td>
                      <td className="px-6 py-4 text-xs font-bold text-slate-500">{item.dni || '-'}</td>
                      <td className="px-6 py-4 text-xs font-bold text-purple-600 uppercase">{item.grupo}</td>
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
