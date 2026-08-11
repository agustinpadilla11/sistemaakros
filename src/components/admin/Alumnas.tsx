import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Search, Filter, Plus, FileSpreadsheet, Edit, Trash2, CheckCircle, Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Alumnas() {
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [bajas, setBajas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('activa');
  const [activeSubTab, setActiveSubTab] = useState<'listado' | 'altas' | 'bajas'>('listado');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusConfirmId, setStatusConfirmId] = useState<{id: string, nuevoEstado: string} | null>(null);

  const loadAlumnas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'alumnas'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlumnas(data);

      const bajasSnap = await getDocs(collection(db, 'bajas'));
      setBajas(bajasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error loading alumnas", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlumnas();
  }, []);

  const handleEstadoChange = async (id: string, nuevoEstado: string) => {
    try {
      // Optimistic UI state update
      setAlumnas(prev => prev.map(a => a.id === id ? { ...a, estado: nuevoEstado, grupo_id: nuevoEstado === 'inactiva' ? '' : a.grupo_id } : a));

      const updateData: any = { estado: nuevoEstado };
      if (nuevoEstado === 'inactiva') {
        updateData.grupo_id = '';
      }
      await updateDoc(doc(db, 'alumnas', id), updateData);
      
      if (nuevoEstado === 'inactiva') {
        const alumna = alumnas.find(a => a.id === id);
        if (alumna) {
          let grupoNombre = 'SIN GRUPO';
          let grupoHorario = '';
          if (alumna.grupo_id) {
             const gSnap = await getDocs(collection(db, 'grupos'));
             const grupoDoc = gSnap.docs.find(d => d.id === alumna.grupo_id);
             if (grupoDoc) {
                const gData = grupoDoc.data();
                grupoNombre = gData.nombre || 'SIN GRUPO';
                grupoHorario = gData.horario || '';
             }
          }
          await setDoc(doc(collection(db, 'bajas')), {
            alumna_nombre: alumna.nombre_completo,
            alumna_dni: alumna.dni || '',
            grupo_nombre: grupoNombre,
            grupo_horario: grupoHorario,
            fecha: new Date()
          });

          const bajasSnap = await getDocs(collection(db, 'bajas'));
          setBajas(bajasSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      }
      
      setStatusConfirmId(null);
      loadAlumnas();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar estado');
      loadAlumnas(); // Rollback on error
    }
  };

  const handleEliminar = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'alumnas', id));
      setDeleteConfirmId(null);
      loadAlumnas();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  const filteredAlumnas = alumnas.filter(a => {
    const matchSearch = a.nombre_completo?.toLowerCase().includes(search.toLowerCase()) || 
                        a.dni?.includes(search);
    const matchEstado = a.estado === filterEstado;
    return matchSearch && matchEstado;
  }).sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));

  const getAltasPorMes = () => {
    const groups: Record<string, any[]> = {};
    alumnas.forEach(a => {
      if (a.creado_en) {
        const date = a.creado_en.toDate ? a.creado_en.toDate() : new Date(a.creado_en);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(a);
      }
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(key => {
        const [year, month] = key.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, 1);
        const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        return {
          monthLabel: monthName,
          key,
          list: groups[key].sort((x, y) => (x.nombre_completo || '').localeCompare(y.nombre_completo || ''))
        };
      });
  };

  const getBajasPorMes = () => {
    const groups: Record<string, any[]> = {};
    bajas.forEach(b => {
      if (b.fecha) {
        const date = b.fecha.toDate ? b.fecha.toDate() : new Date(b.fecha);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(b);
      }
    });
    return Object.keys(groups)
      .sort((a, b) => b.localeCompare(a))
      .map(key => {
        const [year, month] = key.split('-');
        const dateObj = new Date(Number(year), Number(month) - 1, 1);
        const monthName = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        return {
          monthLabel: monthName,
          key,
          list: groups[key].sort((x, y) => (x.alumna_nombre || '').localeCompare(y.alumna_nombre || ''))
        };
      });
  };

  const exportBajasExcel = () => {
    const dataToExport = bajas.map(b => {
      const date = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
      return {
        'Nombre Completo': b.alumna_nombre,
        'Grupo al que pertenecía': b.grupo_nombre + (b.grupo_horario ? ` (${b.grupo_horario})` : ''),
        'Día de Baja': date.toLocaleDateString('es-AR')
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Bajas");
    worksheet['!cols'] = [{ wch: 30 }, { wch: 35 }, { wch: 15 }];
    XLSX.writeFile(workbook, `Bajas_Gimnastas_${new Date().getFullYear()}.xlsx`);
  };

  const exportGimnastasExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Gimnastas');

    worksheet.columns = [
      { header: 'REGULARES', key: 'reg_nombre', width: 35 },
      { header: '', key: 'gap1', width: 5 },
      { header: 'ALTAS', key: 'alta_nombre', width: 35 },
      { header: 'Mes Alta', key: 'alta_mes', width: 25 },
      { header: '', key: 'gap2', width: 5 },
      { header: 'BAJAS', key: 'baja_nombre', width: 35 },
      { header: 'Mes Baja', key: 'baja_mes', width: 25 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).alignment = { horizontal: 'center' };

    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const sortedAlumnas = [...alumnas].sort((a, b) => (a.nombre_completo || '').localeCompare(b.nombre_completo || ''));
    
    const regulares: any[] = [];
    const altas: any[] = [];
    const bajasList: any[] = [];

    sortedAlumnas.forEach(a => {
      if (a.estado === 'inactiva') {
        let mesDetalle = '';
        const baja = bajas.find(b => b.alumna_dni === a.dni || b.alumna_nombre === a.nombre_completo);
        if (baja && baja.fecha) {
          const bDate = baja.fecha.toDate ? baja.fecha.toDate() : new Date(baja.fecha);
          mesDetalle = bDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        }
        bajasList.push({ nombre: a.nombre_completo, mes: mesDetalle });
      } else if (a.estado === 'activa') {
        const cDate = a.creado_en?.toDate ? a.creado_en.toDate() : (a.creado_en ? new Date(a.creado_en) : today);
        if (cDate.getMonth() === currentMonth && cDate.getFullYear() === currentYear) {
          altas.push({ nombre: a.nombre_completo, mes: cDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) });
        } else {
          regulares.push({ nombre: a.nombre_completo });
        }
      }
    });

    const maxRows = Math.max(regulares.length, altas.length, bajasList.length);

    for (let i = 0; i < maxRows; i++) {
      const row = worksheet.addRow({
        reg_nombre: regulares[i]?.nombre || '',
        gap1: '',
        alta_nombre: altas[i]?.nombre || '',
        alta_mes: altas[i]?.mes || '',
        gap2: '',
        baja_nombre: bajasList[i]?.nombre || '',
        baja_mes: bajasList[i]?.mes || ''
      });

      // Estilos para Altas (columnas C y D) - 1 indexado en exceljs -> 3 y 4
      if (altas[i]) {
        row.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } };
        row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCFFCC' } };
      }
      
      // Estilos para Bajas (columnas F y G) - 1 indexado en exceljs -> 6 y 7
      if (bajasList[i]) {
        row.getCell(6).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCCCC' } };
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `Gimnastas_Completas.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm gap-4">
        <h1 className="text-base lg:text-lg font-black uppercase tracking-tight">Gimnastas</h1>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          {activeSubTab === 'bajas' && bajas.length > 0 && (
            <button 
              onClick={exportBajasExcel} 
              className="flex-1 lg:flex-none text-center bg-green-50 text-green-700 px-3 lg:px-4 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-green-100 transition-colors border border-green-200 whitespace-nowrap flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" /> Exportar Bajas
            </button>
          )}
          <button 
            onClick={exportGimnastasExcel}
            className="flex-1 lg:flex-none text-center bg-blue-50 text-blue-700 px-3 lg:px-4 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-blue-100 transition-colors border border-blue-200 whitespace-nowrap flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
          <Link to="/admin/alumnas/importar-docs" className="flex-1 lg:flex-none text-center bg-emerald-50 text-emerald-700 px-3 lg:px-4 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-100 transition-colors border border-emerald-200 whitespace-nowrap">
            Importar Docs
          </Link>
          <Link to="/admin/alumnas/importar" className="flex-1 lg:flex-none text-center bg-slate-100 text-slate-600 px-3 lg:px-4 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 transition-colors whitespace-nowrap">
            Importar Excel
          </Link>
          <Link to="/admin/alumnas/nueva" className="flex-1 lg:flex-none text-center bg-purple-600 text-white px-3 lg:px-4 py-2 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors whitespace-nowrap">
            Nueva
          </Link>
        </div>
      </div>

      {/* TABS DE SECCION */}
      <div className="flex bg-slate-200/50 p-1 rounded-xl border border-slate-200 w-full lg:w-fit overflow-x-auto gap-1">
        <button 
          onClick={() => setActiveSubTab('listado')}
          className={`flex-1 lg:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'listado' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Listado de Gimnastas
        </button>
        <button 
          onClick={() => setActiveSubTab('altas')}
          className={`flex-1 lg:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'altas' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Altas por Mes
        </button>
        <button 
          onClick={() => setActiveSubTab('bajas')}
          className={`flex-1 lg:flex-none px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeSubTab === 'bajas' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-800'}`}
        >
          Bajas por Mes
        </button>
      </div>

      {activeSubTab === 'listado' && (
        <>
          <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input 
                  type="text" 
                  placeholder="Buscar por nombre o DNI..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-full border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 uppercase"
                />
              </div>
              <div className="w-full sm:w-64 relative">
                <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select 
                  value={filterEstado}
                  onChange={(e) => setFilterEstado(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-full border border-slate-200 text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 uppercase"
                >
                  <option value="activa">Activas</option>
                  <option value="inactiva">Inactivas</option>
                  <option value="pendiente_aprobacion">Pendientes</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <h3 className="text-sm font-bold uppercase tracking-tight">Listado</h3>
               <div className="flex bg-slate-200/50 p-1 rounded-lg gap-1 border border-slate-200 w-full sm:w-auto overflow-x-auto">
                 <button 
                   onClick={() => setFilterEstado('activa')}
                   className={`px-3 py-1.5 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterEstado === 'activa' ? 'bg-emerald-600 text-white font-extrabold shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Activas ({alumnas.filter(a => a.estado === 'activa').length})
                 </button>
                 <button 
                   onClick={() => setFilterEstado('inactiva')}
                   className={`px-3 py-1.5 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterEstado === 'inactiva' ? 'bg-red-600 text-white font-extrabold shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Bajas ({alumnas.filter(a => a.estado === 'inactiva').length})
                 </button>
                 <button 
                   onClick={() => setFilterEstado('pendiente_aprobacion')}
                   className={`px-3 py-1.5 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${filterEstado === 'pendiente_aprobacion' ? 'bg-amber-500 text-white font-extrabold shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   Pendientes ({alumnas.filter(a => a.estado === 'pendiente_aprobacion').length})
                 </button>
               </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white border-b border-slate-100">
                    <th className="px-6 py-3 font-black">Nombre / DNI</th>
                    <th className="px-6 py-3 font-black">Estado</th>
                    <th className="px-6 py-3 font-black">Importada</th>
                    <th className="px-6 py-3 font-black text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">Cargando...</td></tr>
                  ) : filteredAlumnas.length === 0 ? (
                    <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-500 font-bold uppercase">No hay resultados</td></tr>
                  ) : (
                    filteredAlumnas.map(alumna => (
                      <tr key={alumna.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium">{alumna.nombre_completo}</div>
                          <div className="text-xs text-slate-500">{alumna.dni}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                            alumna.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
                            alumna.estado === 'inactiva' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {alumna.estado === 'inactiva' ? 'Baja' : alumna.estado === 'pendiente_aprobacion' ? 'Pendiente' : 'Activa'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {alumna.importada ? <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Sí</span> : '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-3 items-center">
                            {statusConfirmId?.id === alumna.id ? (
                               <div className="flex items-center gap-1">
                                  <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">¿Cambiar estado a {statusConfirmId.nuevoEstado === 'inactiva' ? 'baja' : statusConfirmId.nuevoEstado === 'activa' ? 'activa' : statusConfirmId.nuevoEstado}?</span>
                                  <button onClick={() => handleEstadoChange(alumna.id, statusConfirmId.nuevoEstado)} className="text-[10px] bg-slate-800 text-white font-bold uppercase rounded px-2 py-1">Sí</button>
                                  <button onClick={() => setStatusConfirmId(null)} className="text-[10px] bg-slate-200 text-slate-600 font-bold uppercase rounded px-2 py-1">No</button>
                               </div>
                            ) : (
                               <>
                                 {alumna.estado === 'pendiente_aprobacion' && (
                                   <button onClick={() => setStatusConfirmId({id: alumna.id, nuevoEstado: 'activa'})} className="text-[10px] font-bold text-emerald-600 uppercase underline hover:text-emerald-800">
                                     Aprobar
                                   </button>
                                 )}
                                 {alumna.estado === 'activa' && (
                                   <button onClick={() => setStatusConfirmId({id: alumna.id, nuevoEstado: 'inactiva'})} className="text-[10px] font-bold text-red-600 uppercase underline hover:text-red-800">
                                     Dar de Baja
                                   </button>
                                 )}
                                 {alumna.estado === 'inactiva' && (
                                   <button onClick={() => setStatusConfirmId({id: alumna.id, nuevoEstado: 'activa'})} className="text-[10px] font-bold text-emerald-600 uppercase underline hover:text-emerald-800">
                                     Dar de Alta
                                   </button>
                                 )}
                               </>
                            )}
                            <Link to={`/admin/alumnas/${alumna.id}`} className="text-[10px] font-bold text-purple-600 uppercase underline hover:text-purple-800">
                              Ver Perfil
                            </Link>
                            {deleteConfirmId === alumna.id ? (
                              <div className="flex items-center gap-1">
                                <span className="text-[10px] text-red-600 font-bold uppercase mr-1">¿Seguro?</span>
                                <button onClick={() => handleEliminar(alumna.id)} className="text-[10px] bg-red-600 text-white font-bold uppercase rounded px-2 py-1">Sí</button>
                                <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] bg-slate-200 text-slate-600 font-bold uppercase rounded px-2 py-1">No</button>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteConfirmId(alumna.id)} className="text-[10px] font-bold text-red-600 uppercase underline hover:text-red-800">
                                Eliminar
                              </button>
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
        </>
      )}

      {activeSubTab === 'altas' && (
        <div className="space-y-6">
          {getAltasPorMes().length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-xs font-bold uppercase tracking-widest text-slate-400">
              No hay registros de altas en el sistema
            </div>
          ) : (
            getAltasPorMes().map(group => (
              <div key={group.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-purple-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-purple-900 tracking-wider">{group.monthLabel}</h3>
                  <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">{group.list.length} ALTAS</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white border-b border-slate-100">
                        <th className="px-6 py-3 font-black">Gimnasta</th>
                        <th className="px-6 py-3 font-black">DNI</th>
                        <th className="px-6 py-3 font-black">Fecha Ingreso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.list.map(a => {
                        const regDate = a.creado_en?.toDate ? a.creado_en.toDate() : new Date(a.creado_en);
                        return (
                          <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-xs font-black uppercase text-slate-800">{a.nombre_completo}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{a.dni || 'S/D'}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{regDate.toLocaleDateString('es-AR')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeSubTab === 'bajas' && (
        <div className="space-y-6">
          {getBajasPorMes().length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm text-center text-xs font-bold uppercase tracking-widest text-slate-400">
              No hay registros de bajas en el sistema
            </div>
          ) : (
            getBajasPorMes().map(group => (
              <div key={group.key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-red-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase text-red-900 tracking-wider">{group.monthLabel}</h3>
                  <span className="text-[10px] font-black text-red-600 bg-red-100 px-2 py-0.5 rounded-full">{group.list.length} BAJAS</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white border-b border-slate-100">
                        <th className="px-6 py-3 font-black">Gimnasta</th>
                        <th className="px-6 py-3 font-black">DNI</th>
                        <th className="px-6 py-3 font-black">Grupo Anterior</th>
                        <th className="px-6 py-3 font-black">Día de Baja</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {group.list.map(b => {
                        const date = b.fecha?.toDate ? b.fecha.toDate() : new Date(b.fecha);
                        return (
                          <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 text-xs font-black uppercase text-slate-800">{b.alumna_nombre}</td>
                            <td className="px-6 py-4 text-xs font-bold text-slate-500">{b.alumna_dni || 'S/D'}</td>
                            <td className="px-6 py-4 text-xs font-bold text-purple-600 uppercase">{b.grupo_nombre} {b.grupo_horario ? `(${b.grupo_horario})` : ''}</td>
                            <td className="px-6 py-4 text-xs text-slate-400">{date.toLocaleDateString('es-AR')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
