import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, getDoc, limit } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import { UserCircle, AlertCircle } from 'lucide-react';

export default function PortalPadre() {
  const { userData } = useAuth();
  if (!userData) return null;
  const [alumnas, setAlumnas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Link states
  const [showLink, setShowLink] = useState(false);
  const [dniABuscar, setDniABuscar] = useState('');
  const [linkError, setLinkError] = useState('');
  const [linkSuccess, setLinkSuccess] = useState('');

  useEffect(() => {
    if (userData) {
      loadAlumnas();
    }
  }, [userData]);

  const loadAlumnas = async () => {
    try {
      // Find links
      const linksSnap = await getDocs(query(
        collection(db, 'padre_alumna'),
        where('usuario_id', '==', userData!.uid)
      ));
      
      const alumnasData: any[] = [];
      for (const linkDoc of linksSnap.docs) {
        const alumnaId = linkDoc.data().alumna_id;
        const aluSnap = await getDoc(doc(db, 'alumnas', alumnaId));
        if (aluSnap.exists()) {
          alumnasData.push({ id: aluSnap.id, ...aluSnap.data() });
        }
      }
      setAlumnas(alumnasData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError('');
    setLinkSuccess('');
    
    try {
      const q = query(collection(db, 'alumnas'), where('dni', '==', dniABuscar), limit(1));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setLinkError('No encontramos una alumna con ese DNI. Contactá al gimnasio.');
        return;
      }
      
      const alumnaId = snap.docs[0].id;
      const linkId = `${userData!.uid}_${alumnaId}`;
      
      await setDoc(doc(db, 'padre_alumna', linkId), {
        usuario_id: userData!.uid,
        alumna_id: alumnaId,
        vinculado_en: serverTimestamp()
      });
      
      setLinkSuccess('¡Hija vinculada exitosamente!');
      setDniABuscar('');
      setShowLink(false);
      loadAlumnas();
    } catch (err: any) {
      setLinkError('Error al vincular: ' + err.message);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight">Mis Hijas</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{userData.email}</p>
        </div>
        <button 
          onClick={() => setShowLink(!showLink)}
          className="w-full sm:w-auto bg-purple-600 text-white px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
        >
          {showLink ? 'Cancelar' : 'Vincular por DNI'}
        </button>
      </div>

      {showLink && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4 animate-in slide-in-from-top-4 duration-200">
          <h3 className="text-sm font-bold uppercase tracking-tight">Vincular alumna existente</h3>
          {linkError && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-red-600">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs font-bold uppercase">{linkError}</p>
            </div>
          )}
          {linkSuccess && (
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex items-center gap-2 text-emerald-600">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs font-bold uppercase">{linkSuccess}</p>
            </div>
          )}
          <form onSubmit={handleLink} className="flex flex-col sm:flex-row gap-3">
            <input 
              type="text" 
              placeholder="Ingresá el DNI de tu hija" 
              value={dniABuscar}
              onChange={(e) => setDniABuscar(e.target.value)}
              className="flex-1 bg-slate-50 rounded-lg border border-slate-200 p-3 text-xs font-bold uppercase focus:ring-2 focus:ring-purple-500/50 outline-none"
              required
            />
            <button type="submit" className="bg-slate-800 text-white px-8 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors">
              Buscar e Vincular
            </button>
          </form>
        </div>
      )}

      {alumnas.length === 0 ? (
        <div className="text-center bg-white p-12 rounded-xl border border-slate-200 shadow-sm">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
            <UserCircle className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-sm font-bold uppercase tracking-tight">No hay alumnas vinculadas</h3>
          <p className="text-xs text-slate-400 font-bold uppercase mt-2 max-w-sm mx-auto">
            Podés vincular una alumna existente usando su DNI para ver sus cuotas y datos.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {alumnas.map(alumna => (
            <Link key={alumna.id} to={`/portal/alumna/${alumna.id}`} className="block group">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-purple-300 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border-2 border-white shadow-sm">
                    {alumna.foto_gimnasta_url ? (
                      <img src={alumna.foto_gimnasta_url} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <span className="text-purple-700 font-black text-lg">
                        {alumna.nombre_completo.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold uppercase tracking-tight truncate group-hover:text-purple-600 transition-colors">{alumna.nombre_completo}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">DNI: {alumna.dni}</p>
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                  <span className={`inline-flex px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${
                    alumna.estado === 'activa' ? 'bg-emerald-100 text-emerald-700' :
                    alumna.estado === 'inactiva' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {alumna.estado}
                  </span>
                  
                  <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest flex items-center gap-1 group-hover:gap-2 transition-all">
                    Ver ficha <span>→</span>
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
