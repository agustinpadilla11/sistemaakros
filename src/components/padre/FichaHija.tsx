import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useParams, Link } from 'react-router-dom';
import { isBefore, addDays } from 'date-fns';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function FichaHija() {
  const { id } = useParams();
  const [alumna, setAlumna] = useState<any>(null);
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const docSnap = await getDoc(doc(db, 'alumnas', id as string));
        if (docSnap.exists()) {
          setAlumna({ id: docSnap.id, ...docSnap.data() });
        }
        
        const today = new Date();
        const cSnap = await getDocs(query(
          collection(db, 'cuotas'),
          where('alumna_id', '==', id),
          where('anio', '==', today.getFullYear())
        ));
        setCuotas(cSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  if (loading) return <div>Cargando...</div>;
  if (!alumna) return <div>No encontrada</div>;

  const today = new Date();
  const in30Days = addDays(today, 30);
  
  let aptoStatus = 'vencido';
  if (alumna.fecha_apto_medico) {
    const aptoDate = alumna.fecha_apto_medico.toDate();
    if (isBefore(today, aptoDate)) {
      if (isBefore(aptoDate, in30Days)) {
        aptoStatus = 'vencer';
      } else {
        aptoStatus = 'vigente';
      }
    }
  } else {
    aptoStatus = 'falta';
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">{alumna.nombre_completo}</h1>
        <Link to="/portal" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-purple-600 underline">Volver</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 border-t-4 border-t-purple-600">
          <h2 className="text-sm font-bold uppercase tracking-tight mb-4">Datos</h2>
          <div className="space-y-4 text-xs font-bold uppercase">
            <p><span className="text-slate-400 block tracking-widest mb-1 text-[10px]">DNI</span> {alumna.dni}</p>
            <p><span className="text-slate-400 block tracking-widest mb-1 text-[10px]">Fecha Nac.</span> {alumna.fecha_nacimiento ? alumna.fecha_nacimiento.toDate().toLocaleDateString('es-AR') : '-'}</p>
            <p><span className="text-slate-400 block tracking-widest mb-1 text-[10px]">Estado</span> {alumna.estado}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-2 space-y-8">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-tight mb-4 flex items-center justify-between border-b border-slate-100 pb-2">
              Apto Médico
              {aptoStatus === 'vigente' && <span className="bg-emerald-100 border-emerald-200 border text-emerald-700 px-3 py-1 rounded text-[10px] flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Vigente</span>}
              {aptoStatus === 'vencer' && <span className="bg-amber-100 border-amber-200 border text-amber-700 px-3 py-1 rounded text-[10px] flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Vence pronto</span>}
              {aptoStatus === 'vencido' && <span className="bg-red-100 border-red-200 border text-red-700 px-3 py-1 rounded text-[10px] flex items-center gap-1"><XCircle className="w-3 h-3"/> Vencido</span>}
              {aptoStatus === 'falta' && <span className="bg-slate-100 border border-slate-200 text-slate-500 px-3 py-1 rounded text-[10px] flex items-center gap-1"><AlertCircle className="w-3 h-3"/> No entregado</span>}
            </h2>
            <p className="text-xs font-bold uppercase text-slate-500 mb-4">
              {alumna.fecha_apto_medico ? `Vence el ${alumna.fecha_apto_medico.toDate().toLocaleDateString('es-AR')}` : 'Aún no has presentado el apto médico.'}
            </p>
            <button className="bg-purple-100 text-purple-700 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-purple-200 transition-colors mt-2">
              Actualizar Apto Médico
            </button>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-tight mb-4 border-b border-slate-100 pb-2">Estado de Cuotas {today.getFullYear()}</h2>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {MESES.map((m, idx) => {
                const mesIndex = idx + 1;
                const c = cuotas.find(x => x.mes === mesIndex);
                if (!c) {
                  return (
                    <div key={m} className="p-3 border rounded text-center bg-slate-50 border-slate-100 opacity-50">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{m}</div>
                      <div className="text-[10px] font-black text-slate-300">-</div>
                    </div>
                  );
                }
                const isPagado = c.estado === 'pagado';
                const isVencido = c.estado === 'vencido';

                return (
                  <div key={m} className={`p-3 border rounded text-center ${
                    isPagado ? 'bg-emerald-50 border-emerald-200' :
                    isVencido ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${
                      isPagado ? 'text-emerald-700' : isVencido ? 'text-red-700' : 'text-amber-700'
                    }`}>{m}</div>
                    <div className={`text-[10px] font-black ${
                      isPagado ? 'text-emerald-700' : isVencido ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {isPagado ? 'PAGADO' : isVencido ? 'VENCIDO' : 'PDTE'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
