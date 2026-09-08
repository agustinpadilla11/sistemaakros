import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase/config";
import { HeartPulse, CheckCircle2, XCircle, Search, ExternalLink, Calendar, Users, AlertTriangle } from "lucide-react";

export default function AptoFisico() {
  const [loading, setLoading] = useState(true);
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [showSoloFaltantes, setShowSoloFaltantes] = useState(false);
  const [editando, setEditando] = useState<any>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [guardando, setGuardando] = useState(false);

  const currentYear = new Date().getFullYear();

  const loadData = async () => {
    setLoading(true);
    try {
      const aSnap = await getDocs(collection(db, "alumnas"));
      const alList = aSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter((a: any) => a.estado !== "inactiva")
        .sort((a: any, b: any) => (a.nombre_completo || "").localeCompare(b.nombre_completo || ""));
      setAlumnas(alList);
      const gSnap = await getDocs(collection(db, "grupos"));
      setGrupos(gSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const getAptoStatus = (alumna: any): "vigente" | "vencido" | "sin_apto" => {
    if (!alumna.fecha_apto_medico) return "sin_apto";
    const fecha = alumna.fecha_apto_medico.toDate
      ? alumna.fecha_apto_medico.toDate()
      : new Date(alumna.fecha_apto_medico);
    return fecha.getFullYear() === currentYear ? "vigente" : "vencido";
  };

  const vigentes = alumnas.filter(a => getAptoStatus(a) === "vigente");
  const faltantes = alumnas.filter(a => getAptoStatus(a) !== "vigente");

  const listaVisible = (showSoloFaltantes ? faltantes : alumnas).filter(a =>
    (a.nombre_completo || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleGuardarFecha = async () => {
    if (!editando || !nuevaFecha) return;
    setGuardando(true);
    try {
      await updateDoc(doc(db, "alumnas", editando.id), {
        fecha_apto_medico: new Date(nuevaFecha + "T12:00:00")
      });
      setEditando(null);
      setNuevaFecha("");
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Error al guardar la fecha");
    } finally {
      setGuardando(false);
    }
  };

  const getFechaStr = (alumna: any): string => {
    if (!alumna.fecha_apto_medico) return "";
    const f = alumna.fecha_apto_medico.toDate
      ? alumna.fecha_apto_medico.toDate()
      : new Date(alumna.fecha_apto_medico);
    return f.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getFechaInput = (alumna: any): string => {
    if (!alumna.fecha_apto_medico) return "";
    const f = alumna.fecha_apto_medico.toDate
      ? alumna.fecha_apto_medico.toDate()
      : new Date(alumna.fecha_apto_medico);
    return f.toISOString().split("T")[0];
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
        <h1 className="text-sm font-black uppercase tracking-tight flex items-center gap-2 text-slate-800">
          <HeartPulse className="w-5 h-5 text-emerald-600" />
          Apto Fisico / Certificado Medico
          <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full uppercase tracking-widest border border-slate-200">
            {currentYear}
          </span>
        </h1>
      </div>

      {/* TARJETAS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-emerald-200 rounded-xl p-5 shadow-sm flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
          <span className="text-[10px] uppercase font-black text-emerald-600 tracking-widest">Al dia ({currentYear})</span>
          <span className="text-4xl font-black text-emerald-700">{vigentes.length}</span>
          <span className="text-[10px] text-slate-400 font-medium uppercase">de {alumnas.length} gimnastas activas</span>
        </div>

        <button
          onClick={() => setShowSoloFaltantes(prev => !prev)}
          className={`text-left border rounded-xl p-5 shadow-sm flex flex-col gap-2 relative overflow-hidden transition-all ${
            showSoloFaltantes ? "bg-red-600 border-red-600 text-white" : "bg-white border-red-200 hover:bg-red-50"
          }`}
        >
          <div className={`absolute top-0 left-0 w-1 h-full ${showSoloFaltantes ? "bg-white/40" : "bg-red-500"}`} />
          <span className={`text-[10px] uppercase font-black tracking-widest ${showSoloFaltantes ? "text-red-100" : "text-red-600"}`}>
            Faltan actualizar
          </span>
          <span className={`text-4xl font-black ${showSoloFaltantes ? "text-white" : "text-red-600"}`}>{faltantes.length}</span>
          <span className={`text-[10px] font-bold uppercase ${showSoloFaltantes ? "text-red-100" : "text-red-400"}`}>
            {showSoloFaltantes ? "Ver todas" : "Tap para ver quienes son"}
          </span>
        </button>

        <div className="bg-slate-800 text-white border border-slate-700 rounded-xl p-5 shadow-md flex flex-col gap-2">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Total Gimnastas</span>
          <span className="text-4xl font-black">{alumnas.length}</span>
          <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase">
            <Users className="w-3 h-3" /> activas en el sistema
          </div>
        </div>
      </div>

      {/* ALERTA faltantes */}
      {showSoloFaltantes && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-xs font-bold text-red-700 uppercase tracking-wide">
            Mostrando solo las {faltantes.length} gimnastas que no tienen el apto fisico al dia para {currentYear}.
          </p>
          <button onClick={() => setShowSoloFaltantes(false)} className="ml-auto text-[10px] font-black uppercase text-red-500 hover:text-red-700 underline whitespace-nowrap">
            Ver todas
          </button>
        </div>
      )}

      {/* BUSCADOR */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Buscar gimnasta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-10 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-slate-600"
          />
        </div>
      </div>

      {/* TABLA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] uppercase text-slate-400 tracking-wider bg-slate-50 border-b border-slate-200 font-black">
                <th className="px-6 py-4">Gimnasta</th>
                <th className="px-6 py-4">Grupo</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4">Fecha Certificado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase">Cargando...</td></tr>
              ) : listaVisible.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-12 text-center text-xs text-slate-400 font-bold uppercase tracking-widest">No hay gimnastas que coincidan</td></tr>
              ) : listaVisible.map(a => {
                const status = getAptoStatus(a);
                const grupo = grupos.find((g: any) => g.id === a.grupo_id);
                const isVigente = status === "vigente";
                return (
                  <tr key={a.id} className={`transition-colors ${showSoloFaltantes ? "bg-red-50/50 hover:bg-red-50" : "hover:bg-slate-50"}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {isVigente
                          ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          : <XCircle className="w-4 h-4 text-red-400 shrink-0" />}
                        <span className={`text-xs font-black uppercase ${showSoloFaltantes ? "text-red-700" : "text-slate-800"}`}>
                          {a.nombre_completo}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-bold text-purple-600 uppercase">{grupo?.nombre || "Sin grupo"}</td>
                    <td className="px-6 py-4">
                      {isVigente ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" /> Vigente {currentYear}
                        </span>
                      ) : status === "sin_apto" ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200">
                          <XCircle className="w-3 h-3" /> No entregado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-100 text-red-700 border border-red-200">
                          <XCircle className="w-3 h-3" /> Vencido
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {getFechaStr(a) ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-slate-600">
                          <Calendar className="w-3 h-3 text-slate-400" /> {getFechaStr(a)}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Sin fecha</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {a.foto_apto_url && (
                          <a href={a.foto_apto_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-purple-600 hover:text-purple-800 border border-purple-200 hover:border-purple-400 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded transition-all">
                            <ExternalLink className="w-3 h-3" /> Ver detalle
                          </a>
                        )}
                        <button
                          onClick={() => { setEditando(a); setNuevaFecha(getFechaInput(a)); }}
                          className={`inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1.5 rounded transition-all ${
                            isVigente
                              ? "text-slate-400 hover:text-slate-600 border border-slate-200 bg-slate-50"
                              : "text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-600"
                          }`}
                        >
                          <Calendar className="w-3 h-3" />
                          {isVigente ? "Actualizar" : "Cargar apto"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Mostrando {listaVisible.length} de {alumnas.length} gimnastas activas
            </span>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase">
              <span className="text-emerald-600">✓ {vigentes.length} al dia</span>
              <span className="text-red-500">✗ {faltantes.length} faltan</span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL EDITAR FECHA */}
      {editando && (
        <div className="fixed inset-0 bg-slate-900/60 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div>
              <h2 className="text-sm font-black uppercase text-slate-800">Actualizar Apto Fisico</h2>
              <p className="text-xs text-slate-500 mt-1 font-medium">{editando.nombre_completo}</p>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-400 tracking-widest mb-1">Fecha del Certificado Medico</label>
              <input
                type="date"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-xs font-bold outline-none focus:border-emerald-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">Para que sea valido para {currentYear}, la fecha debe ser de {currentYear}.</p>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => { setEditando(null); setNuevaFecha(""); }}
                className="px-4 py-2 bg-slate-100 rounded text-[10px] uppercase font-bold text-slate-600 hover:bg-slate-200">
                Cancelar
              </button>
              <button onClick={handleGuardarFecha} disabled={guardando || !nuevaFecha}
                className="px-5 py-2 bg-emerald-600 rounded text-[10px] uppercase font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
