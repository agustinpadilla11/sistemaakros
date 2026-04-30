import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc, where, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2, Printer, Download, XCircle, Users, History, Calendar, Upload, AlertCircle, UserMinus } from 'lucide-react';
import * as XLSX from 'xlsx';

const GRUPOS_PREDETERMINADOS = [
  { nombre: "Jardín", horario: "Lunes y Miércoles 17:00 a 17:50hs" },
  { nombre: "Jardín", horario: "Lunes y Miércoles 18:00 a 18:50hs" },
  { nombre: "Iniciación", horario: "Lunes y Miércoles 9:30 a 11:30hs" },
  { nombre: "Iniciación", horario: "Lunes y Miércoles 15:00 a 16:40hs" },
  { nombre: "Iniciación", horario: "Lunes y Miércoles 17:00 a 18:40hs" },
  { nombre: "Iniciación", horario: "Lunes y Miércoles 19:00 a 20:40hs" },
  { nombre: "Iniciación", horario: "Martes y Jueves 15:00 a 16:40hs" },
  { nombre: "Iniciación", horario: "Martes y Jueves 17:00 a 18:40hs" },
  { nombre: "Iniciación", horario: "Martes y Jueves 19:00 a 20:40hs" },
  { nombre: "Formación", horario: "Lunes, Miércoles y Viernes 8:30 a 10:30hs" },
  { nombre: "Formación", horario: "Lunes, Miércoles y Viernes 15:00 a 17:00hs" },
  { nombre: "Formación", horario: "Lunes, Miércoles y Viernes 19:00 a 21:00hs" },
  { nombre: "Formación", horario: "Martes, Jueves y Viernes 15:00 a 17:00hs" },
  { nombre: "Formación", horario: "Martes, Jueves y Viernes 17:00 a 19:00hs" },
  { nombre: "Formación", horario: "Martes, Jueves y Viernes 19:00 a 21:00hs" },
  { nombre: "Desarrollo", horario: "Lunes, Miércoles y Viernes 8:30 a 11:30hs" },
  { nombre: "Desarrollo", horario: "Lunes, Miércoles y Viernes 15:00 a 18:00hs" },
  { nombre: "Desarrollo", horario: "Lunes, Miércoles y Viernes 16:45 a 19:45hs" },
  { nombre: "Desarrollo", horario: "Lunes, Miércoles y Viernes 17:00 a 21:00hs" },
  { nombre: "Desarrollo", horario: "Martes, Jueves y Viernes 15:00 a 18:00hs" },
  { nombre: "Desarrollo", horario: "Martes, Jueves y Viernes 18:00 a 21:00hs" },
  { nombre: "Rendimiento", horario: "Lunes a Viernes 15:00 a 19:00hs" }
];

const calculateClasses = (horario: string) => {
  const h = (horario || '').toLowerCase();
  if (h.includes('lunes a viernes')) return { weekly: 5, monthly: 20 };
  if (h.includes('lunes a sábado') || h.includes('lunes a sabado')) return { weekly: 6, monthly: 24 };
  
  const days = ['lunes', 'martes', 'miercoles', 'miércoles', 'jueves', 'viernes', 'sabado', 'sábado'];
  let count = 0;
  days.forEach(d => {
    if (h.includes(d)) {
      if ((d === 'miercoles' && h.includes('miércoles')) || (d === 'sabado' && h.includes('sábado'))) return;
      count++;
    }
  });
  return { weekly: count, monthly: count * 4 };
};

export default function Grupos() {
  const [activeTab, setActiveTab] = useState<'grupos' | 'bajas'>('grupos');
  const [grupos, setGrupos] = useState<any[]>([]);
  const [bajas, setBajas] = useState<any[]>([]);
  const [todasAlumnas, setTodasAlumnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alumnasPorGrupo, setAlumnasPorGrupo] = useState<Record<string, number>>({});
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [managingGroup, setManagingGroup] = useState<any>(null);
  const [form, setForm] = useState({ nombre: '', horario: '', descripcion: '' });

  const [globalError, setGlobalError] = useState('');
  const [confirmarCarga, setConfirmarCarga] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [importResults, setImportResults] = useState<{
    total: number,
    success: number,
    notFound: string[],
    noGroup: string[],
    alreadyCorrect: number
  } | null>(null);

  const loadData = async () => {
    setLoading(true);
    setGlobalError('');
    try {
      const snap = await getDocs(collection(db, 'grupos'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const priority: Record<string, number> = { 'jardín': 1, 'iniciación': 2, 'formación': 3, 'desarrollo': 4, 'rendimiento': 5 };
      const getPriority = (name: string) => {
         const lower = name?.toLowerCase() || '';
         for (const key in priority) {
             if (lower.includes(key)) return priority[key];
         }
         return 99;
      };
      data.sort((a: any, b: any) => getPriority(a.nombre) - getPriority(b.nombre));
      setGrupos(data);

      const aluSnap = await getDocs(collection(db, 'alumnas'));
      const alumnasData = aluSnap.docs.map(d => ({id: d.id, ...d.data()} as any));
      setTodasAlumnas(alumnasData);

      const counts: Record<string, number> = {};
      alumnasData.forEach(d => {
        const gid = d.grupo_id;
        if (gid) {
          counts[gid] = (counts[gid] || 0) + 1;
        }
      });
      setAlumnasPorGrupo(counts);

      const bajasSnap = await getDocs(query(collection(db, 'bajas'), orderBy('fecha', 'desc')));
      setBajas(bajasSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
      setGlobalError('Error al cargar datos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing === 'nuevo') {
        const newRef = doc(collection(db, 'grupos'));
        await setDoc(newRef, { ...form });
      } else {
        await updateDoc(doc(db, 'grupos', isEditing.id), { ...form });
      }
      setIsEditing(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id: string, forceDelete: boolean = false) => {
    if (alumnasPorGrupo[id] > 0) {
      setGlobalError('No podés eliminar un grupo que tiene alumnas asignadas.');
      return;
    }
    if (!forceDelete) { setDeleteConfirmId(id); return; }
    try {
      await deleteDoc(doc(db, 'grupos', id));
      setDeleteConfirmId(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleCargarPredeterminados = async () => {
    if (!confirmarCarga) { setConfirmarCarga(true); setTimeout(() => setConfirmarCarga(false), 4000); return; }
    setLoading(true);
    try {
      const promises = GRUPOS_PREDETERMINADOS.map(g => {
        const newRef = doc(collection(db, 'grupos'));
        return setDoc(newRef, { ...g, descripcion: '' });
      });
      await Promise.all(promises);
      setConfirmarCarga(false);
      loadData();
    } catch (error) { console.error(error); }
  };

  const handleVaciarGrupo = async (grupoId: string) => {
    if (!window.confirm('¿Estás seguro de que quieres quitar a todas las gimnastas de este grupo? Esta acción no se puede deshacer.')) return;
    setLoading(true);
    try {
      const q = query(collection(db, 'alumnas'), where('grupo_id', '==', grupoId));
      const snap = await getDocs(q);
      const batch = snap.docs.map(d => updateDoc(doc(db, 'alumnas', d.id), { grupo_id: '' }));
      await Promise.all(batch);
      loadData();
      alert('Grupo vaciado con éxito.');
    } catch (err) {
      console.error(err);
      setGlobalError('Error al vaciar el grupo.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setImportResults(null);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      
      let success = 0;
      let alreadyCorrect = 0;
      let notFound: string[] = [];
      let noGroup: string[] = [];
      let totalProcessed = 0;

      const normalize = (s: any) => s?.toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim() || "";
      const cleanForMatch = (s: any) => normalize(s).replace(/[^a-z0-9]/g, "");

      // Process all sheets
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        let currentHeaderSearch = "";
        let inTable = false;
        let colMap: { name: number, dni: number }[] = [];
        let currentMatchedGroup: any = null;
        let currentTableContext = "";

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          // Empty row ends a table
          if (!row || row.length === 0 || row.every(c => c === null || c === "")) {
            inTable = false;
            currentHeaderSearch = ""; 
            currentMatchedGroup = null;
            continue;
          }

          const rowString = row.join(" ").toLowerCase();
          
          // Detect table start
          if (rowString.includes("apellido y nombre")) {
            colMap = [];
            for (let j = 0; j < row.length; j++) {
              const cell = (row[j] || "").toString().toLowerCase();
              if (cell.includes("apellido y nombre")) {
                let dniIdx = -1;
                for (let k = Math.max(0, j - 2); k < j + 5; k++) {
                  if (row[k] && row[k].toString().toLowerCase().includes("dni")) { dniIdx = k; break; }
                }
                colMap.push({ name: j, dni: dniIdx });
              }
            }
            inTable = true;
            currentTableContext = (currentHeaderSearch + " " + rowString).trim() || sheetName;
            
            // Identify Group for this table
            const textToMatch = normalize(currentTableContext + " " + sheetName);
            const matches = grupos.map(g => {
              const gNombre = normalize(g.nombre);
              const gHorario = normalize(g.horario);
              let score = 0;
              if (textToMatch.includes(gNombre)) score += 15;
              if (gNombre.includes("jardin") && textToMatch.includes("motricidad")) score += 12;
              
              const days = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado"];
              days.forEach(d => { if (textToMatch.includes(d) && gHorario.includes(d)) score += 5; });

              const timesInGroup = gHorario.match(/\d{1,2}:\d{2}/g) || [];
              timesInGroup.forEach(tg => {
                if (textToMatch.includes(tg) || textToMatch.includes(tg.replace(":", ""))) score += 8;
              });
              return { g, score };
            }).sort((a,b) => b.score - a.score);

            if (matches.length > 0 && matches[0].score >= 10) {
              currentMatchedGroup = matches[0].g;
            }
            continue;
          }

          // If not in table, collect context
          if (!inTable) {
             const nonNullable = row.filter(c => c !== null && c !== "");
             if (nonNullable.length > 0) currentHeaderSearch += " " + nonNullable.join(" ");
             continue;
          }

          // Inside a table, process rows
          if (inTable && colMap.length > 0) {
            if (!currentMatchedGroup) {
              // We couldn't identify the group for this table
              // But we only report it once per table or per failed row? 
              // Let's report it for each row to be consistent with the results UI
              for (const map of colMap) {
                const nombreRaw = (row[map.name] || "").toString().trim();
                if (nombreRaw && nombreRaw.toLowerCase() !== "apellido y nombre" && nombreRaw.length > 2) {
                   noGroup.push(`${nombreRaw} (Contexto: ${currentTableContext})`);
                   totalProcessed++;
                }
              }
              continue;
            }

            for (const map of colMap) {
              const nombreRaw = (row[map.name] || "").toString().trim();
              const dniRaw = map.dni !== -1 ? (row[map.dni] || "").toString().trim() : "";
              
              if (!nombreRaw || nombreRaw.toLowerCase() === "apellido y nombre" || nombreRaw.length < 3) continue;
              
              totalProcessed++;
              const cleanNombreExcel = cleanForMatch(nombreRaw);
              const cleanDniExcel = dniRaw.split('.')[0].replace(/\D/g, "");

              let alumnaMatch = todasAlumnas.find(a => {
                const cleanDniFirebase = (a.dni || "").toString().replace(/\D/g, "");
                if (cleanDniExcel && cleanDniExcel.length >= 7 && cleanDniExcel === cleanDniFirebase) return true;
                
                const cleanNameFirebase = cleanForMatch(a.nombre_completo);
                if (cleanNombreExcel === cleanNameFirebase) return true;
                
                // Fuzzy match for reversed names or multi-names
                const excelParts = normalize(nombreRaw).split(/[\s,]+/).filter(p => p.length > 2);
                if (excelParts.length >= 2) {
                   if (excelParts.every(p => cleanNameFirebase.includes(p))) return true;
                }

                return (cleanNombreExcel.length > 12 && (cleanNameFirebase.includes(cleanNombreExcel) || cleanNombreExcel.includes(cleanNameFirebase)));
              });

              if (!alumnaMatch) { notFound.push(nombreRaw); continue; }

              if (alumnaMatch.grupo_id === currentMatchedGroup.id) {
                alreadyCorrect++;
              } else {
                await updateDoc(doc(db, 'alumnas', alumnaMatch.id), { grupo_id: currentMatchedGroup.id });
                updateLocalAlumnasAndCounts(alumnaMatch.id, currentMatchedGroup.id);
                success++;
              }
            }
          }
        }
      }
      
      setImportResults({ total: totalProcessed, success, notFound, noGroup, alreadyCorrect });
      loadData();
    } catch (err) {
      console.error(err);
      setGlobalError('Error técnico al importar: ' + (err as Error).message);
    } finally {
      setLoading(false);
      if (e.target) e.target.value = '';
    }
  };

  const updateLocalAlumnasAndCounts = (alumnaId: string, newGroupId: string) => {
    setTodasAlumnas(prev => prev.map(a => a.id === alumnaId ? { ...a, grupo_id: newGroupId } : a));
    setAlumnasPorGrupo(prev => {
      const counts = { ...prev };
      const alumna = todasAlumnas.find(a => a.id === alumnaId);
      if (alumna && alumna.grupo_id) counts[alumna.grupo_id] = Math.max(0, (counts[alumna.grupo_id] || 0) - 1);
      if (newGroupId) counts[newGroupId] = (counts[newGroupId] || 0) + 1;
      return counts;
    });
  };

  const handleAddGimnasta = async (alumnaId: string) => {
    try {
      updateLocalAlumnasAndCounts(alumnaId, managingGroup.id);
      await updateDoc(doc(db, 'alumnas', alumnaId), { grupo_id: managingGroup.id });
    } catch (err) { console.error(err); loadData(); }
  };

  const handleRemoveGimnasta = async (alumnaId: string) => {
    try {
      const alumna = todasAlumnas.find(a => a.id === alumnaId);
      if (alumna) {
        await setDoc(doc(collection(db, 'bajas')), {
          alumna_nombre: alumna.nombre_completo,
          alumna_dni: alumna.dni || '',
          grupo_nombre: managingGroup.nombre,
          grupo_horario: managingGroup.horario,
          fecha: new Date()
        });
      }
      updateLocalAlumnasAndCounts(alumnaId, '');
      await updateDoc(doc(db, 'alumnas', alumnaId), { grupo_id: '' });
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleMoveGimnasta = async (alumnaId: string, newGroupId: string) => {
    if (!newGroupId) return;
    try {
      updateLocalAlumnasAndCounts(alumnaId, newGroupId);
      await updateDoc(doc(db, 'alumnas', alumnaId), { grupo_id: newGroupId });
    } catch (err) { console.error(err); loadData(); }
  };

  const printAsistencia = async (grupoId: string, nombre: string, horario: string) => {
    try {
      const aluSnap = await getDocs(query(collection(db, 'alumnas'), where('grupo_id', '==', grupoId)));
      const alumnas = aluSnap.docs.map(d => d.data());
      alumnas.sort((a,b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
      
      const counts = calculateClasses(horario);
      const columnasClases = 20;
      const printWindow = window.open('', '_blank');
      if (!printWindow) return;
      
      const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase();
      const rows = alumnas.map((a, i) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i+1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-transform: uppercase;">${a.nombre_completo}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${a.dni || ''}</td>
          ${Array(columnasClases).fill('<td style="padding: 8px; border: 1px solid #ddd;"></td>').join('')}
        </tr>
      `).join('');

      printWindow.document.write(`
        <html>
          <head>
             <title>Asistencia - ${nombre}</title>
             <style>
               @media print { @page { margin: 1cm; size: landscape; } body { -webkit-print-color-adjust: exact; } }
               body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
               .header { border-bottom: 2px solid #581c87; padding-bottom: 15px; margin-bottom: 20px; }
               <h1>PLANILLA DE ASISTENCIA - AKROS</h1>
               <div class="info" style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                  <span>MES: ${mesActual} | GRUPO: ${nombre}</span>
                  <span>HORARIO: ${horario}</span>
                  <span>CLASES SEMANA: ${counts.weekly} | CLASES MES: ${counts.monthly}</span>
               </div>
             </style>
          </head>
          <body>
             <div class="header">
                 <h1>PLANILLA DE ASISTENCIA - AKROS</h1>
                 <div class="info" style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 11px; font-weight: bold; text-transform: uppercase;">
                    <span>MES: ${mesActual} | GRUPO: ${nombre}</span>
                    <span>HORARIO: ${horario}</span>
                    <span>CLASES SEMANA: ${counts.weekly} | CLASES MES: ${counts.monthly}</span>
                 </div>
             </div>
             <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
               <thead>
                 <tr>
                    <th style="background-color: #f3e8ff; padding: 8px; border: 1px solid #d8b4fe; font-size: 10px; text-transform: uppercase; color: #581c87; width: 30px;">#</th>
                    <th style="background-color: #f3e8ff; padding: 8px; border: 1px solid #d8b4fe; font-size: 10px; text-transform: uppercase; color: #581c87; width: 250px;">Alumna</th>
                    <th style="background-color: #f3e8ff; padding: 8px; border: 1px solid #d8b4fe; font-size: 10px; text-transform: uppercase; color: #581c87; width: 80px;">DNI</th>
                    ${Array(columnasClases).fill(0).map((_, i) => `<th style="background-color: #f3e8ff; padding: 8px; border: 1px solid #d8b4fe; font-size: 10px; text-transform: uppercase; color: #581c87;">Clase ${i+1}</th>`).join('')}
                 </tr>
               </thead>
               <tbody>${rows}</tbody>
             </table>
             <script>window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } catch(err) { console.error(err); }
  };

  return (
    <div className="space-y-8">
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-bold uppercase tracking-wide">{globalError}</p>
          <button onClick={() => setGlobalError('')} className="ml-auto"><XCircle className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex gap-4 items-center">
          <h1 className="text-sm font-bold uppercase tracking-tight">Gestión de Grupos</h1>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={()=>setActiveTab('grupos')} className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'grupos' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Grupos</button>
            <button onClick={()=>setActiveTab('bajas')} className={`px-4 py-1.5 rounded text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'bajas' ? 'bg-white text-purple-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>Bajas</button>
          </div>
        </div>
        <div className="flex gap-2">
           {activeTab === 'grupos' && (
             <>
               {grupos.length === 0 && !loading && (
                 <button onClick={handleCargarPredeterminados} className={`flex items-center gap-2 border px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${confirmarCarga ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-emerald-100 text-emerald-700'}`}>
                   <Download className="w-3 h-3" /> {confirmarCarga ? 'Haz Clic de Nuevo' : 'Cargar Predeterminados'}
                 </button>
               )}
               <input type="file" id="excel-upload" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleImportExcel} />
               <label htmlFor="excel-upload" className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide cursor-pointer hover:bg-blue-700 transition-colors">
                 <Upload className="w-3 h-3" /> Importar Excel
               </label>
               <button onClick={() => { setForm({nombre: '', horario: '', descripcion: ''}); setIsEditing('nuevo'); }} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors">
                 <Plus className="w-3 h-3" /> Nuevo Grupo
               </button>
             </>
           )}
        </div>
      </div>

      {activeTab === 'grupos' ? (
        <>
          {isEditing && (
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6 animate-in slide-in-from-top duration-300">
              <h2 className="text-sm font-bold uppercase tracking-tight mb-4">{isEditing === 'nuevo' ? 'Crear' : 'Editar'} Grupo</h2>
              <form onSubmit={handleSave} className="flex gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre (Categoría)</label>
                  <input type="text" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-2.5 rounded text-xs font-bold border uppercase" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Días y Horarios</label>
                  <input type="text" required value={form.horario} onChange={e => setForm({...form, horario: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-2.5 rounded text-xs font-bold border uppercase" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setIsEditing(null)} className="px-4 py-2.5 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold">Cancelar</button>
                  <button type="submit" className="px-4 py-2.5 bg-purple-600 text-white rounded text-[10px] uppercase font-bold">Guardar</button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? <p className="text-xs font-bold uppercase text-slate-400">Cargando...</p> : grupos.map(g => (
              <div key={g.id} className="bg-white flex flex-col p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-300 transition-all group">
                <div className="flex justify-between items-start">
                  <h3 className="text-sm font-black uppercase tracking-tight px-3 py-1 rounded bg-purple-50 text-purple-900">{g.nombre}</h3>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleVaciarGrupo(g.id)} title="Vaciar Grupo" className="text-slate-400 hover:text-amber-600 transition-colors">
                       <UserMinus className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setIsEditing(g); setForm(g); }} className="text-slate-400 hover:text-purple-600"><Edit className="w-4 h-4" /></button>
                    {deleteConfirmId === g.id ? (
                      <div className="flex gap-1 items-center bg-red-50 p-1 rounded">
                        <button onClick={() => handleDelete(g.id, true)} className="bg-red-600 text-white text-[8px] px-2 py-1 rounded font-black uppercase">SÍ</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-200 text-slate-600 text-[8px] px-2 py-1 rounded font-black uppercase">NO</button>
                      </div>
                    ) : (
                      <button onClick={() => handleDelete(g.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-slate-600 font-bold uppercase mt-4 mb-2">{g.horario}</p>
                <div className="mt-auto border-t border-slate-100 pt-4 flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                  <button onClick={() => setManagingGroup(g)} className="flex items-center gap-1.5 text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors">
                    <Users className="w-3.5 h-3.5" /> {alumnasPorGrupo[g.id] || 0} ALUMNAS
                  </button>
                  <button onClick={() => printAsistencia(g.id, g.nombre, g.horario)} className="flex items-center gap-1.5 text-purple-600 hover:text-purple-800">
                    <Printer className="w-3.5 h-3.5" /> IMPRIMIR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200 font-black">
                <th className="px-6 py-4">Fecha Baja</th>
                <th className="px-6 py-4">Gimnasta</th>
                <th className="px-6 py-4">Grupo Anterior</th>
                <th className="px-6 py-4">Horario Anterior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bajas.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase">No se han registrado bajas recientemente</td></tr>
              ) : (
                bajas.map(b => (
                  <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-xs font-bold text-slate-500">{(b.fecha?.toDate?.() || new Date(b.fecha)).toLocaleDateString('es-AR')}</td>
                    <td className="px-6 py-4 text-xs font-black text-slate-800 uppercase">{b.alumna_nombre}</td>
                    <td className="px-6 py-4 text-xs font-bold text-purple-600 uppercase">{b.grupo_nombre}</td>
                    <td className="px-6 py-4 text-xs text-slate-400 uppercase">{b.grupo_horario}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {managingGroup && (
         <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200 relative">
             <div className="absolute top-0 left-0 w-full h-1 bg-blue-500"></div>
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div>
                   <h2 className="text-sm font-black uppercase tracking-tight text-slate-800 flex items-center gap-2">
                     <Users className="w-5 h-5 text-blue-600" />
                     {managingGroup.nombre}
                   </h2>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{managingGroup.horario}</p>
                </div>
                <button onClick={() => setManagingGroup(null)} className="text-slate-300 hover:text-slate-600 transition-colors">
                   <XCircle className="w-8 h-8"/>
                </button>
             </div>
             
             <div className="p-6 bg-blue-50/30 border-b border-slate-100">
                <label className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Inscribir Gimnasta</label>
                <input 
                  type="text" list="all-alumnas-list" 
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm" 
                  placeholder="Buscar por nombre o DNI..."
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const val = (e.target as HTMLInputElement).value;
                      const match = todasAlumnas.find(a => `${a.nombre_completo} (DNI: ${a.dni || '-'})` === val);
                      if (match) { handleAddGimnasta(match.id); (e.target as HTMLInputElement).value = ''; }
                    }
                  }}
                />
                <datalist id="all-alumnas-list">
                  {todasAlumnas.map(a => <option key={a.id} value={`${a.nombre_completo} (DNI: ${a.dni || '-'})`} />)}
                </datalist>
             </div>

             <div className="flex-1 overflow-y-auto p-0 bg-white">
                <table className="w-full text-left">
                   <tbody className="divide-y divide-slate-50">
                      {todasAlumnas.filter(a => a.grupo_id === managingGroup.id).map(a => (
                         <tr key={a.id} className="hover:bg-slate-50 transition-colors group">
                            <td className="px-8 py-4">
                              <p className="text-xs font-black uppercase text-slate-700">{a.nombre_completo}</p>
                              <p className="text-[10px] uppercase text-slate-400 font-bold">DNI: {a.dni || 'S/D'}</p>
                            </td>
                            <td className="px-8 py-4 text-right">
                               <div className="flex justify-end items-center gap-3">
                                  <select 
                                    className="text-[10px] font-black uppercase text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    value="" onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'none') handleRemoveGimnasta(a.id);
                                      else if (val) handleMoveGimnasta(a.id, val);
                                    }}
                                  >
                                     <option value="" disabled>Gestionar...</option>
                                     <option value="none">❌ Quitar del Grupo</option>
                                     {grupos.filter(g => g.id !== managingGroup.id).map(g => (
                                        <option key={g.id} value={g.id}>Mover a: {g.nombre} ({g.horario})</option>
                                     ))}
                                  </select>
                               </div>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           </div>
         </div>
      )}
      {importResults && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex justify-center items-center z-[60] p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh] overflow-hidden border border-slate-200">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-emerald-50/50">
                <div>
                   <h2 className="text-xl font-black uppercase tracking-tight text-slate-800">Resultado de Importación</h2>
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">Resumen del procesamiento del archivo.</p>
                </div>
                <button onClick={() => setImportResults(null)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-2 rounded-full shadow-sm"><XCircle className="w-6 h-6"/></button>
             </div>
             
             <div className="p-8 overflow-y-auto space-y-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
                      <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Procesados</p>
                      <p className="text-2xl font-black text-slate-800">{importResults.total}</p>
                   </div>
                   <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Asignados</p>
                      <p className="text-2xl font-black text-emerald-700">{importResults.success}</p>
                   </div>
                   <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                      <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Ya Correctos</p>
                      <p className="text-2xl font-black text-blue-700">{importResults.alreadyCorrect}</p>
                   </div>
                   <div className="bg-red-50 p-4 rounded-2xl border border-red-100 text-center">
                      <p className="text-[10px] font-black text-red-600 uppercase mb-1">Errores</p>
                      <p className="text-2xl font-black text-red-700">{importResults.notFound.length + importResults.noGroup.length}</p>
                   </div>
                </div>

                {importResults.notFound.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-red-600 uppercase tracking-widest flex items-center gap-2">
                       <AlertCircle className="w-4 h-4" /> Gimnastas no encontradas en el sistema ({importResults.notFound.length})
                    </h3>
                    <div className="bg-red-50/50 rounded-xl p-4 border border-red-100 max-h-40 overflow-y-auto">
                       {importResults.notFound.map((n, idx) => (
                         <div key={idx} className="text-[10px] font-bold text-red-700 uppercase py-1 border-b border-red-100/50 last:border-0">{n}</div>
                       ))}
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">Sugerencia: Asegurate que estas gimnastas estén cargadas en la sección "Gimnastas" con el mismo nombre o DNI.</p>
                  </div>
                )}

                {importResults.noGroup.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-amber-600 uppercase tracking-widest flex items-center gap-2">
                       <AlertCircle className="w-4 h-4" /> Grupos no identificados en el sistema ({importResults.noGroup.length})
                    </h3>
                    <div className="bg-amber-50/50 rounded-xl p-4 border border-amber-100 max-h-40 overflow-y-auto">
                       {importResults.noGroup.map((n, idx) => (
                         <div key={idx} className="text-[10px] font-bold text-amber-700 uppercase py-1 border-b border-amber-100/50 last:border-0">{n}</div>
                       ))}
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">Sugerencia: Verifica que el título del grupo en el Excel coincida con el nombre del grupo creado en el sistema.</p>
                  </div>
                )}
             </div>

             <div className="p-6 bg-slate-50 border-t border-slate-100">
                <button onClick={() => setImportResults(null)} className="w-full bg-slate-800 text-white py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-colors">Entendido</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
