import { useState, useEffect } from 'react';
import { collection, query, getDocs, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Search, Filter, Plus, FileSpreadsheet, Edit, Trash2, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Alumnas() {
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('todas');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [statusConfirmId, setStatusConfirmId] = useState<{id: string, nuevoEstado: string} | null>(null);

  const loadAlumnas = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'alumnas'));
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAlumnas(data);
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
      await updateDoc(doc(db, 'alumnas', id), { estado: nuevoEstado });
      setStatusConfirmId(null);
      loadAlumnas();
    } catch (err) {
      console.error(err);
      alert('Error al actualizar estado');
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
    const matchEstado = filterEstado === 'todas' || a.estado === filterEstado;
    return matchSearch && matchEstado;
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">Gimnastas</h1>
        <div className="flex gap-3">
          <Link to="/admin/alumnas/importar-docs" className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-100 transition-colors border border-emerald-200">
            Importar Documentos
          </Link>
          <Link to="/admin/alumnas/importar" className="bg-slate-100 text-slate-600 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-slate-200 transition-colors">
            Importar Excel
          </Link>
          <Link to="/admin/alumnas/nueva" className="bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-700 transition-colors">
            Nueva Gimnasta
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-4">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Buscar por nombre o DNI..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-full border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 uppercase"
            />
          </div>
          <div className="w-64 relative">
            <Filter className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select 
              value={filterEstado}
              onChange={(e) => setFilterEstado(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-100 rounded-full border border-slate-200 text-xs font-bold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 uppercase"
            >
              <option value="todas">Todos los estados</option>
              <option value="activa">Activas</option>
              <option value="inactiva">Inactivas</option>
              <option value="pendiente_aprobacion">Pendientes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50">
           <h3 className="text-sm font-bold uppercase tracking-tight">Listado</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-white">
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
                        {alumna.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {alumna.importada ? <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">Sí</span> : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-3">
                        {statusConfirmId?.id === alumna.id ? (
                           <div className="flex items-center gap-1">
                              <span className="text-[10px] text-slate-500 font-bold uppercase mr-1">¿Cambiar estado a {statusConfirmId.nuevoEstado}?</span>
                              <button onClick={() => handleEstadoChange(alumna.id, statusConfirmId.nuevoEstado)} className="text-[10px] bg-slate-800 text-white font-bold uppercase rounded px-2 py-1">Sí</button>
                              <button onClick={() => setStatusConfirmId(null)} className="text-[10px] bg-slate-200 text-slate-600 font-bold uppercase rounded px-2 py-1">No</button>
                           </div>
                        ) : (
                          <>
                            {alumna.estado === 'pendiente_aprobacion' && (
                              <button onClick={() => setStatusConfirmId({id: alumna.id, nuevoEstado: 'activa'})} className="text-[10px] font-bold text-emerald-600 uppercase underline">
                                Aprobar
                              </button>
                            )}
                            {alumna.estado === 'activa' && (
                              <button onClick={() => setStatusConfirmId({id: alumna.id, nuevoEstado: 'inactiva'})} className="text-[10px] font-bold text-slate-600 uppercase underline">
                                Desactivar
                              </button>
                            )}
                          </>
                        )}
                        <Link to={`/admin/alumnas/${alumna.id}`} className="text-[10px] font-bold text-purple-600 uppercase underline">
                          Ver Perfil
                        </Link>
                        {deleteConfirmId === alumna.id ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-red-600 font-bold uppercase mr-1">¿Seguro?</span>
                            <button onClick={() => handleEliminar(alumna.id)} className="text-[10px] bg-red-600 text-white font-bold uppercase rounded px-2 py-1">Sí</button>
                            <button onClick={() => setDeleteConfirmId(null)} className="text-[10px] bg-slate-200 text-slate-600 font-bold uppercase rounded px-2 py-1">No</button>
                          </div>
                        ) : (
                          <button onClick={() => setDeleteConfirmId(alumna.id)} className="text-[10px] font-bold text-red-600 uppercase underline">
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
    </div>
  );
}
