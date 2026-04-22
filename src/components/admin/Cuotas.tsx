import { useState, useEffect, useRef } from 'react';
import { collection, query, getDocs, updateDoc, doc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Filter, Upload, Plus } from 'lucide-react';
import * as XLSX from 'xlsx';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function Cuotas() {
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [cuotas, setCuotas] = useState<Record<string, any[]>>({}); // Record<alumnaId, Cuota[]>
  const [loading, setLoading] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal states
  const [selectedCuota, setSelectedCuota] = useState<any>(null);
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [metodo, setMetodo] = useState('efectivo');
  const [notas, setNotas] = useState('');

  // Global Cobrar states
  const [isCobrarOpen, setIsCobrarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [cobrarForm, setCobrarForm] = useState({
    alumna_id: '',
    monto: '30000',
    fecha: new Date().toISOString().split('T')[0],
    metodo: 'transferencia',
    mes_target: (new Date().getMonth() + 1).toString()
  });

  const today = new Date();
  const [yearFil, setYearFil] = useState(today.getFullYear());

  const loadData = async () => {
    setLoading(true);
    try {
      // Fetch grupos
      const gSnap = await getDocs(collection(db, 'grupos'));
      const priority: Record<string, number> = { 'jardín': 1, 'iniciación': 2, 'formación': 3, 'desarrollo': 4, 'rendimiento': 5 };
      const getPriority = (name: string) => {
         const lower = name?.toLowerCase() || '';
         for (const key in priority) {
             if (lower.includes(key)) return priority[key];
         }
         return 99;
      };
      
      const gData = gSnap.docs.map(g => ({ id: g.id, ...g.data() }));
      gData.sort((a: any, b: any) => getPriority(a.nombre) - getPriority(b.nombre));
      setGrupos(gData);

      const aSnap = await getDocs(collection(db, 'alumnas'));
      const alus = aSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setAlumnas(alus);

      const cSnap = await getDocs(query(collection(db, 'cuotas'), where('anio', '==', yearFil)));
      const cuotasMap: Record<string, any[]> = {};
      
      cSnap.forEach(d => {
        const c = { id: d.id, ...d.data() };
        if (!cuotasMap[c.alumna_id]) cuotasMap[c.alumna_id] = [];
        cuotasMap[c.alumna_id].push(c);
      });
      setCuotas(cuotasMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [yearFil]);

  const handlePagar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCuota) return;
    try {
      await updateDoc(doc(db, 'cuotas', selectedCuota.id), {
        estado: 'pagado',
        monto: Number(monto),
        fecha_pago: fechaPago ? new Date(fechaPago) : serverTimestamp(),
        metodo_pago: metodo,
        notas
      });
      setSelectedCuota(null);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error registrando pago');
    }
  };

  const openModal = (cuota: any) => {
    setSelectedCuota(cuota);
    setMonto(cuota.monto.toString());
    const d = new Date();
    setFechaPago(d.toISOString().split('T')[0]);
    setMetodo('efectivo');
    setNotas(cuota.notas || '');
  };

  const handlePagarCobrarGlobal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cobrarForm.alumna_id) return;
    try {
      // Find the existing cuota for that month and year
      const mesNum = Number(cobrarForm.mes_target);
      const existing = cuotas[cobrarForm.alumna_id]?.find(c => c.mes === mesNum && c.anio === yearFil);
      
      if (existing) {
        await updateDoc(doc(db, 'cuotas', existing.id), {
          estado: 'pagado',
          monto: Number(cobrarForm.monto),
          fecha_pago: new Date(cobrarForm.fecha),
          metodo_pago: cobrarForm.metodo,
          notas: 'Cobrado desde panel'
        });
        alert('Pago registrado correctamente.');
        setIsCobrarOpen(false);
        loadData();
      } else {
        alert('No se encontró el registro de cuota para ese mes/alumna.');
      }
    } catch (err) {
      console.error(err);
      alert('Error registrando cobro');
    }
  };

  const selectedAluGroup = alumnas.find(a => a.id === cobrarForm.alumna_id)?.grupo_id;
  const selectedGroup = grupos.find(g => g.id === selectedAluGroup);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(firstSheet) as any[];

      const batchPromises = [];
      const monthsKeys = [
        { match: ['ene', 'enero', '1'], mes: 1 },
        { match: ['feb', 'febrero', '2'], mes: 2 },
        { match: ['mar', 'marzo', '3'], mes: 3 },
        { match: ['abr', 'abril', '4'], mes: 4 }
      ];
      
      for (const row of rows) {
        const nombre = row['Nombre Completo'] || row['Nombre'] || row['Alumna'] || row['nombre'];
        const dni = row['DNI'] || row['dni'];
        
        let alu = null;
        if (dni) alu = alumnas.find(a => a.dni == dni);
        if (!alu && nombre) alu = alumnas.find(a => a.nombre_completo.toLowerCase() === String(nombre).toLowerCase());
        
        if (alu) {
          for (const mKey of monthsKeys) {
            const rowKey = Object.keys(row).find(k => mKey.match.some(m => k.toLowerCase().includes(m)));
            if (rowKey) {
              const val = row[rowKey]?.toString().toLowerCase().trim();
              if (val === 'pagado' || val === 'si' || val === 'ok' || val === 'true' || Number(val) > 0) {
                const existing = cuotas[alu.id]?.find(c => c.mes === mKey.mes && c.anio === yearFil);
                if (existing && existing.estado !== 'pagado') {
                  batchPromises.push(updateDoc(doc(db, 'cuotas', existing.id), {
                    estado: 'pagado',
                    fecha_pago: new Date(),
                    metodo_pago: 'importacion',
                    notas: 'Importado de Excel/CSV'
                  }));
                }
              }
            }
          }
        }
      }
      
      await Promise.all(batchPromises);
      alert(`Importación exitosa. Se actualizaron ${batchPromises.length} cuotas.`);
      loadData();
    } catch (err) {
      console.error(err);
      alert('Error en la importación. Asegúrese de que el formato sea correcto.');
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">Estado de Cuotas</h1>
        <div className="flex items-center gap-4">
          <input type="file" accept=".csv, .xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 transition-colors"
          >
            <Upload className="w-3 h-3" /> Importar Ene-Abr
          </button>
          
          <button 
            onClick={() => setIsCobrarOpen(true)}
            className="flex items-center gap-2 bg-purple-600 text-white px-3 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-3 h-3" /> Cobrar
          </button>

          <div className="flex items-center gap-2 ml-4 pl-4 border-l border-slate-200">
            <Filter className="w-4 h-4 text-slate-400" />
            <select value={yearFil} onChange={e => setYearFil(Number(e.target.value))} className="bg-slate-100 border border-slate-200 rounded p-2 focus:ring-purple-500 focus:border-purple-500 text-xs font-bold uppercase outline-none">
              <option value={2024}>2024</option>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <h3 className="text-sm font-bold uppercase tracking-tight">Pagos del Año</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left bg-white">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white">
                <th className="p-4 font-black sticky left-0 bg-white border-r border-b border-slate-100 z-10 w-48">Gimnasta</th>
                {MESES.map((m, i) => (
                  <th key={m} className={`p-3 font-black text-center w-16 border-b border-slate-100 ${(today.getMonth() === i && yearFil === today.getFullYear()) ? 'bg-purple-50 text-purple-600' : ''}`}>
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={13} className="py-8 text-center text-xs font-bold uppercase text-slate-500">Cargando datos...</td></tr>
              ) : alumnas.map(alu => {
                const aluCuotas = cuotas[alu.id] || [];
                return (
                  <tr key={alu.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-xs font-bold sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 z-10 truncate max-w-48">
                      {alu.nombre_completo}
                    </td>
                    {MESES.map((_, idx) => {
                      const mesIndex = idx + 1;
                      const c = aluCuotas.find(x => x.mes === mesIndex);
                      
                      if (!c) return <td key={mesIndex} className="p-3 text-center text-slate-300">-</td>;
                      
                      const isPagado = c.estado === 'pagado';
                      const isVencido = c.estado === 'vencido';
                      
                      return (
                        <td key={mesIndex} className="p-2 text-center">
                          <button 
                            onClick={() => { if(!isPagado) openModal(c); }}
                            title={isPagado ? `Pagado: $${c.monto}` : `Pendiente: $${c.monto}`}
                            disabled={isPagado}
                            className={`w-full h-8 rounded flex justify-center items-center font-bold text-xs transition-colors ${
                              isPagado ? 'bg-emerald-100 text-emerald-700 cursor-default' : 
                              isVencido ? 'bg-red-100 text-red-700 hover:bg-red-200' : 
                              'bg-amber-100 text-amber-700 hover:bg-amber-200'
                            }`}
                          >
                            {isPagado ? '✔' : isVencido ? '!' : '-'}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedCuota && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Registrar Pago</h2>
            <p className="text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded">
              Gimnasta: <b>{alumnas.find(a => a.id === selectedCuota.alumna_id)?.nombre_completo}</b><br/>
              Mes: {MESES[selectedCuota.mes - 1]} {yearFil}
            </p>
            <form onSubmit={handlePagar} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Monto ($)</label>
                <input type="number" required value={monto} onChange={e => setMonto(e.target.value)} className="w-full border p-2 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Fecha de pago</label>
                  <input type="date" required value={fechaPago} onChange={e => setFechaPago(e.target.value)} className="w-full border p-2 rounded" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Método</label>
                  <select value={metodo} onChange={e => setMetodo(e.target.value)} className="w-full border p-2 rounded">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notas opcionales</label>
                <input type="text" value={notas} onChange={e => setNotas(e.target.value)} className="w-full border p-2 rounded" />
              </div>
              
              <div className="flex gap-3 justify-end pt-4">
                <button type="button" onClick={() => setSelectedCuota(null)} className="px-4 py-2 bg-slate-100 rounded text-slate-600 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700">Guardar Pago</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cobrar Modal Global */}
      {isCobrarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md p-6 overflow-visible">
            <h2 className="text-sm font-bold uppercase tracking-tight mb-4">Cobrar Cuota</h2>
            <form onSubmit={handlePagarCobrarGlobal} className="space-y-4">
              <div className="relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Buscar Gimnasta (Apellido/Nombre)</label>
                <input 
                  type="text"
                  list="alumnas-datalist"
                  required 
                  value={searchTerm}
                  onChange={e => {
                    setSearchTerm(e.target.value);
                    const matchedAlu = alumnas.find(a => a.nombre_completo === e.target.value);
                    setCobrarForm({...cobrarForm, alumna_id: matchedAlu ? matchedAlu.id : ''});
                  }}
                  placeholder="Ej: Pérez María..."
                  className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded outline-none uppercase text-slate-600 focus:ring-purple-500 focus:border-purple-500"
                />
                <datalist id="alumnas-datalist">
                  {alumnas.map(a => (
                    <option key={a.id} value={a.nombre_completo} />
                  ))}
                </datalist>
                {!cobrarForm.alumna_id && searchTerm.length > 0 && (
                   <p className="text-[9px] text-red-500 font-bold uppercase tracking-wide mt-1">Selecciona una gimnasta válida de la lista.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Mes a Cobrar</label>
                  <select required value={cobrarForm.mes_target} onChange={e => setCobrarForm({...cobrarForm, mes_target: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded outline-none uppercase text-slate-600 focus:ring-purple-500 focus:border-purple-500">
                    {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Monto ($)</label>
                  <input type="number" required value={cobrarForm.monto} onChange={e => setCobrarForm({...cobrarForm, monto: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded outline-none focus:ring-purple-500 focus:border-purple-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Fecha</label>
                  <input type="date" required value={cobrarForm.fecha} onChange={e => setCobrarForm({...cobrarForm, fecha: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded outline-none focus:ring-purple-500 focus:border-purple-500 text-slate-500 uppercase" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Método</label>
                  <select required value={cobrarForm.metodo} onChange={e => setCobrarForm({...cobrarForm, metodo: e.target.value})} className="w-full bg-slate-50 border-slate-200 text-xs font-bold border p-3 rounded outline-none uppercase text-slate-600 focus:ring-purple-500 focus:border-purple-500">
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="mp">Mercado Pago</option>
                  </select>
                </div>
              </div>
              
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
                <button type="button" onClick={() => { setIsCobrarOpen(false); setSearchTerm(''); }} className="px-4 py-2 bg-slate-100 rounded text-slate-600 text-[10px] font-bold uppercase tracking-widest hover:bg-slate-200">Cancelar</button>
                <button type="submit" disabled={!cobrarForm.alumna_id} className="px-4 py-2 bg-purple-600 text-white rounded text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50">Completar Cobro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
