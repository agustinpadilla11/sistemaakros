import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, setDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Plus, Edit, Trash2, Printer, Download, XCircle, Users } from 'lucide-react';

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

export default function Grupos() {
  const [grupos, setGrupos] = useState<any[]>([]);
  const [todasAlumnas, setTodasAlumnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [alumnasPorGrupo, setAlumnasPorGrupo] = useState<Record<string, number>>({});
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [managingGroup, setManagingGroup] = useState<any>(null);
  const [form, setForm] = useState({ nombre: '', horario: '', descripcion: '' });

  // UI States substituting window.confirm and window.alert
  const [globalError, setGlobalError] = useState('');
  const [confirmarCarga, setConfirmarCarga] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      const alumnasData = aluSnap.docs.map(d => ({id: d.id, ...d.data()}));
      setTodasAlumnas(alumnasData);

      const counts: Record<string, number> = {};
      alumnasData.forEach(d => {
        const gid = d.grupo_id;
        if (gid) {
          counts[gid] = (counts[gid] || 0) + 1;
        }
      });
      setAlumnasPorGrupo(counts);
    } catch (err) {
      console.error(err);
      setGlobalError('Error al cargar la lista de grupos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError('');
    try {
      if (isEditing === 'nuevo') {
        const newRef = doc(collection(db, 'grupos'));
        await setDoc(newRef, { 
          nombre: form.nombre, 
          horario: form.horario, 
          descripcion: form.descripcion 
        });
      } else {
        await updateDoc(doc(db, 'grupos', isEditing.id), {
          nombre: form.nombre, 
          horario: form.horario, 
          descripcion: form.descripcion 
        });
      }
      setIsEditing(null);
      loadData();
    } catch (err) {
      console.error(err);
      setGlobalError('Error al intentar guardar el grupo.');
    }
  };

  const handleDelete = async (id: string, forceDelete: boolean = false) => {
    setGlobalError('');
    if (alumnasPorGrupo[id] > 0) {
      setGlobalError('No podés eliminar un grupo que tiene alumnas asignadas.');
      setDeleteConfirmId(null);
      return;
    }
    
    if (!forceDelete) {
       setDeleteConfirmId(id);
       return;
    }

    try {
      await deleteDoc(doc(db, 'grupos', id));
      setDeleteConfirmId(null);
      loadData();
    } catch (err) {
      console.error(err);
      setGlobalError('Error al intentar eliminar el grupo.');
    }
  };

  const handleCargarPredeterminados = async () => {
    setGlobalError('');
    if (!confirmarCarga) {
      setConfirmarCarga(true);
      setTimeout(() => setConfirmarCarga(false), 4000); // Reset confirm
      return;
    }

    setLoading(true);
    try {
      const promises = GRUPOS_PREDETERMINADOS.map(g => {
        const newRef = doc(collection(db, 'grupos'));
        return setDoc(newRef, { nombre: g.nombre, horario: g.horario, descripcion: '' });
      });
      await Promise.all(promises);
      setConfirmarCarga(false);
      loadData();
    } catch (error) {
      console.error("Error al cargar default", error);
      setGlobalError("Error al procesar la carga de grupos predeterminados.");
    } finally {
      setLoading(false);
    }
  };

  const updateLocalAlumnasAndCounts = (alumnaId: string, newGroupId: string) => {
    setTodasAlumnas(prev => 
      prev.map(a => a.id === alumnaId ? { ...a, grupo_id: newGroupId } : a)
    );
    // Recalculate counts locally
    setAlumnasPorGrupo(prev => {
      const counts = { ...prev };
      // Decrease old count
      const alumna = todasAlumnas.find(a => a.id === alumnaId);
      if (alumna && alumna.grupo_id) {
         counts[alumna.grupo_id] = Math.max(0, (counts[alumna.grupo_id] || 0) - 1);
      }
      // Increase new count
      if (newGroupId) {
         counts[newGroupId] = (counts[newGroupId] || 0) + 1;
      }
      return counts;
    });
  };

  const handleAddGimnasta = async (alumnaId: string) => {
    try {
      updateLocalAlumnasAndCounts(alumnaId, managingGroup.id);
      await updateDoc(doc(db, 'alumnas', alumnaId), { grupo_id: managingGroup.id });
    } catch (err) {
      console.error(err);
      setGlobalError('Error al asignar gimnasta al grupo.');
      loadData(); // Revert on error
    }
  };

  const handleRemoveGimnasta = async (alumnaId: string) => {
    try {
      updateLocalAlumnasAndCounts(alumnaId, '');
      await updateDoc(doc(db, 'alumnas', alumnaId), { grupo_id: '' });
    } catch (err) {
      console.error(err);
      setGlobalError('Error al remover a la gimnasta del grupo.');
      loadData(); // Revert on error
    }
  };

  const handleMoveGimnasta = async (alumnaId: string, newGroupId: string) => {
    if (!newGroupId) return;
    try {
      updateLocalAlumnasAndCounts(alumnaId, newGroupId);
      await updateDoc(doc(db, 'alumnas', alumnaId), { grupo_id: newGroupId });
    } catch (err) {
      console.error(err);
      setGlobalError('Error al mover a la gimnasta.');
      loadData(); // Revert on error
    }
  };

  const printAsistencia = async (grupoId: string, nombre: string, horario: string) => {
    setGlobalError('');
    try {
      const aluSnap = await getDocs(query(collection(db, 'alumnas'), where('grupo_id', '==', grupoId)));
      const alumnas = aluSnap.docs.map(d => d.data());
      
      alumnas.sort((a,b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
      
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
         setGlobalError('La ventana de impresión fue bloqueada por tu navegador. (Asegúrate de permitir las ventanas emergentes / pop-ups)');
         return;
      }
      
      const mesActual = new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase();
      
      const rows = alumnas.map((a, i) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${i+1}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-transform: uppercase;">${a.nombre_completo}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${a.dni || ''}</td>
          ${Array(8).fill('<td style="padding: 8px; border: 1px solid #ddd;"></td>').join('')}
        </tr>
      `).join('');

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
             <title>Planilla Asistencia - ${nombre}</title>
             <style>
               @media print {
                 @page { margin: 1cm; size: landscape; }
                 body { -webkit-print-color-adjust: exact; }
               }
               body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
               .header { border-bottom: 2px solid #581c87; padding-bottom: 15px; margin-bottom: 20px; }
               h1 { font-size: 24px; margin: 0 0 5px 0; color: #581c87; }
               h2 { font-size: 14px; color: #666; margin: 0; text-transform: uppercase; }
               table { width: 100%; border-collapse: collapse; margin-top: 10px; }
               th { background-color: #f3e8ff; padding: 10px; border: 1px solid #d8b4fe; font-size: 11px; text-transform: uppercase; color: #581c87;}
               td { font-size: 12px; }
               .empty-state { text-align: center; padding: 30px; color: #999; font-style: italic; }
             </style>
          </head>
          <body>
             <div class="header">
                 <h1>PLANILLA DE ASISTENCIA - AKROS</h1>
                 <h2>${mesActual} | GRUPO: ${nombre} | HORARIO: ${horario}</h2>
             </div>
             <table>
               <thead>
                 <tr>
                    <th style="width: 30px;">#</th>
                    <th style="width: 250px;">Alumna</th>
                    <th style="width: 100px;">DNI</th>
                    <th>Clase 1</th>
                    <th>Clase 2</th>
                    <th>Clase 3</th>
                    <th>Clase 4</th>
                    <th>Clase 5</th>
                    <th>Clase 6</th>
                    <th>Clase 7</th>
                    <th>Clase 8</th>
                 </tr>
               </thead>
               <tbody>
                 ${rows.length > 0 ? rows : `<tr><td colspan="11" class="empty-state">No hay alumnas asignadas a este grupo aún.</td></tr>`}
               </tbody>
             </table>
             <script>
               window.onload = function() { setTimeout(() => { window.print(); window.close(); }, 500); }
             </script>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
    } catch(err) {
      console.error(err);
      setGlobalError('Error interno generando la planilla de asistencia.');
    }
  };

  return (
    <div className="space-y-8">
      {globalError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm font-bold uppercase tracking-wide">{globalError}</p>
          <button onClick={() => setGlobalError('')} className="ml-auto text-red-500 hover:text-red-800">
             <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">Grupos</h1>
        <div className="flex gap-2">
           {grupos.length === 0 && !loading && (
             <button 
               onClick={handleCargarPredeterminados}
               className={`flex items-center gap-2 border px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide transition-colors ${confirmarCarga ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-sm' : 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-200'}`}
             >
               <Download className="w-3 h-3" /> {confirmarCarga ? 'Haz Clic de Nuevo para Confirmar' : 'Cargar Horarios Predeterminados'}
             </button>
           )}
           <button 
             onClick={() => { setForm({nombre: '', horario: '', descripcion: ''}); setIsEditing('nuevo'); }}
             className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors"
           >
             <Plus className="w-3 h-3" /> Nuevo Grupo / Horario
           </button>
        </div>
      </div>

      {isEditing && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
          <h2 className="text-sm font-bold uppercase tracking-tight mb-4">{isEditing === 'nuevo' ? 'Nuevo' : 'Editar'} Grupo</h2>
          <form onSubmit={handleSave} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nombre (Categoría)</label>
              <input type="text" required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-2 rounded text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="ej: Iniciación" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Días y Horarios</label>
              <input type="text" required value={form.horario} onChange={e => setForm({...form, horario: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-2 rounded text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="ej: Lunes y Miércoles 17:00 a 18:40hs" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Profesor/Notas (Opcional)</label>
              <input type="text" value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} className="w-full border-slate-200 bg-slate-50 p-2 rounded text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="Prof. Ana" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setIsEditing(null)} className="px-4 py-2 bg-slate-100 rounded text-slate-600 text-[10px] uppercase font-bold tracking-widest">Cancelar</button>
              <button type="submit" className="px-4 py-2 bg-purple-600 text-white rounded text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700">Guardar</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? <p className="text-xs font-bold uppercase text-slate-400">Cargando Grupos...</p> : (
          grupos.map(g => (
            <div key={g.id} className={`bg-white flex flex-col p-5 rounded-xl shadow-sm border transition-colors ${deleteConfirmId === g.id ? 'border-red-400 bg-red-50/50' : 'border-slate-200 hover:border-purple-300'}`}>
              <div className="flex justify-between items-start">
                <h3 className={`text-sm font-bold uppercase tracking-tight px-2 py-1 rounded inline-block ${deleteConfirmId === g.id ? 'bg-red-100 text-red-900' : 'bg-purple-50 text-purple-900'}`}>{g.nombre}</h3>
                <div className="flex gap-2 text-slate-400 ml-2">
                  <button onClick={() => { setIsEditing(g); setForm(g); }} className="hover:text-purple-600 bg-white border border-slate-100 shadow-sm p-1.5 rounded" title="Editar">
                     <Edit className="w-3 h-3" />
                  </button>
                  {deleteConfirmId === g.id ? (
                     <div className="flex gap-1 ml-1 items-center">
                        <span className="text-[10px] text-red-600 font-bold uppercase mx-1">¿Seguro?</span>
                        <button onClick={() => handleDelete(g.id, true)} className="bg-red-600 text-white font-bold uppercase rounded px-2 py-1 text-[9px]">Sí</button>
                        <button onClick={() => setDeleteConfirmId(null)} className="bg-slate-200 text-slate-600 font-bold uppercase rounded px-2 py-1 text-[9px]">No</button>
                     </div>
                  ) : (
                     <button onClick={() => handleDelete(g.id)} className="bg-white border border-slate-100 shadow-sm p-1.5 rounded hover:text-red-600 transition-colors" title="Eliminar">
                        <Trash2 className="w-3 h-3" />
                     </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-600 font-bold uppercase mt-3 mb-1 min-h-[1.5rem] leading-tight">{g.horario}</p>
              {g.descripcion && <p className="text-[10px] text-slate-400 mt-1 mb-2 tracking-widest uppercase">{g.descripcion}</p>}

              <div className="mt-auto border-t border-slate-100 pt-4 mt-6 flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                <button 
                  onClick={() => setManagingGroup(g)} 
                  className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-2 py-1 rounded"
                >
                  <Users className="w-3 h-3" /> {alumnasPorGrupo[g.id] || 0} Inscriptas
                </button>
                <button 
                  onClick={() => printAsistencia(g.id, g.nombre, g.horario)}
                  className="flex items-center gap-1.5 text-purple-600 hover:text-purple-800 transition-colors"
                >
                  <Printer className="w-3 h-3" /> Imprimir Asistencia
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {managingGroup && (
         <div className="fixed inset-0 bg-slate-900/50 flex justify-center items-center z-50 p-4">
           <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden">
             
             <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <div>
                   <h2 className="text-sm font-black uppercase tracking-tight text-blue-900">
                     Alumnas: {managingGroup.nombre}
                   </h2>
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{managingGroup.horario}</p>
                </div>
                <button onClick={() => setManagingGroup(null)} className="text-slate-400 hover:text-slate-600">
                   <XCircle className="w-6 h-6"/>
                </button>
             </div>
             
             <div className="p-4 bg-blue-50/50 border-b border-slate-200">
                <label className="block text-[10px] font-bold text-blue-700 uppercase tracking-widest mb-2 flex items-center gap-2">
                   <Plus className="w-3 h-3" /> Inscribir al grupo
                </label>
                <div className="flex gap-2">
                   <input 
                     type="text" 
                     list="all-alumnas-list" 
                     className="flex-1 p-2 bg-white border border-blue-200 rounded text-xs font-bold uppercase focus:border-blue-500 outline-none" 
                     placeholder="Buscar alumna para agregarla a este horario..."
                     onKeyDown={e => {
                       if (e.key === 'Enter') {
                         e.preventDefault();
                         const val = (e.target as HTMLInputElement).value;
                         const match = todasAlumnas.find(a => `${a.nombre_completo} (DNI: ${a.dni || '-'})` === val);
                         if (match) {
                           handleAddGimnasta(match.id);
                           (e.target as HTMLInputElement).value = '';
                         } else {
                           setGlobalError("Asegúrate de seleccionar una alumna válida de la lista.");
                         }
                       }
                     }}
                   />
                   <datalist id="all-alumnas-list">
                      {todasAlumnas.map(a => <option key={a.id} value={`${a.nombre_completo} (DNI: ${a.dni || '-'})`} />)}
                   </datalist>
                </div>
                <p className="text-[9px] text-slate-500 mt-1.5 uppercase font-bold">Busca su nombre en la lista y presiona <kbd className="bg-slate-200 px-1 rounded">Enter</kbd> para inscribirla instantáneamente.</p>
             </div>

             <div className="flex-1 overflow-y-auto p-0 bg-white min-h-[300px]">
                <table className="w-full text-left bg-white">
                   <tbody className="divide-y divide-slate-100">
                      {todasAlumnas.filter(a => a.grupo_id === managingGroup.id).map(a => (
                         <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-3">
                              <p className="text-xs font-black uppercase text-slate-700">{a.nombre_completo}</p>
                              <p className="text-[10px] uppercase text-slate-400 font-bold tracking-widest">DNI: {a.dni || 'S/D'}</p>
                            </td>
                            <td className="px-6 py-3 text-right">
                               <div className="flex justify-end items-center gap-2">
                                  <select 
                                    className="text-[10px] w-48 font-bold uppercase text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 cursor-pointer"
                                    value=""
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (val === 'none') {
                                        handleRemoveGimnasta(a.id);
                                      } else if (val) {
                                        handleMoveGimnasta(a.id, val);
                                      }
                                    }}
                                  >
                                     <option value="" disabled>Mover a otro grupo...</option>
                                     <option value="none" className="text-red-600 font-bold">❌ Quitar del grupo</option>
                                     {grupos.filter(g => g.id !== managingGroup.id).map(g => (
                                        <option key={g.id} value={g.id}>{g.nombre} ({g.horario})</option>
                                     ))}
                                  </select>
                               </div>
                            </td>
                         </tr>
                      ))}
                      {todasAlumnas.filter(a => a.grupo_id === managingGroup.id).length === 0 && (
                         <tr><td colSpan={2} className="px-4 py-12 text-center text-[10px] font-bold uppercase text-slate-400 tracking-widest">Aún no hay inscriptas en este grupo.</td></tr>
                      )}
                   </tbody>
                </table>
             </div>
           </div>
         </div>
      )}
    </div>
  );
}
