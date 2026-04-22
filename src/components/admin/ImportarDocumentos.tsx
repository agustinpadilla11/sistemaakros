import { useState, useEffect } from 'react';
import { db, storage } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { ChevronLeft, Upload, CheckCircle, AlertCircle, File, Image as ImageIcon, X } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Alumna {
  id: string;
  dni: string;
  nombre_completo: string;
}

interface UploadTask {
  id: string;
  file: File;
  alumnaId: string | '';
  tipo: string | '';
  status: 'pending' | 'uploading' | 'success' | 'error';
  errorMsg?: string;
}

export default function ImportarDocumentos() {
  const [alumnas, setAlumnas] = useState<Alumna[]>([]);
  const [tasks, setTasks] = useState<UploadTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchAlumnas = async () => {
      const snap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(snap.docs.map(d => ({ id: d.id, dni: d.data().dni, nombre_completo: d.data().nombre_completo })));
      setLoading(false);
    };
    fetchAlumnas();
  }, []);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const incomingFiles = Array.from(e.target.files);
    
    const newTasks: UploadTask[] = incomingFiles.map(file => {
      let alumnaId = '';
      let tipo = '';
      const nameLower = file.name.toLowerCase();
      
      // Intentar adivinar tipo
      if (nameLower.includes('frente') || nameLower.includes('dnif') || nameLower.includes('dni-f')) {
        tipo = 'foto_dni_frente';
      } else if (nameLower.includes('dorso') || nameLower.includes('dnid') || nameLower.includes('dni-d')) {
        tipo = 'foto_dni_dorso';
      } else if (nameLower.includes('apto') || nameLower.includes('certif') || nameLower.includes('medi')) {
        tipo = 'certificado_medico';
      } else if (nameLower.includes('foto') || nameLower.includes('perfil') || nameLower.includes('cara')) {
        tipo = 'foto_gimnasta';
      } else if (nameLower.includes('dni')) {
        tipo = 'foto_dni_frente'; // fallback if only 'dni'
      }

      // Intentar buscar DNI con RegEx (7 u 8 digitos)
      const dniMatch = nameLower.match(/\d{7,8}/);
      if (dniMatch) {
        const dStr = dniMatch[0];
        const match = alumnas.find(a => a.dni && a.dni.includes(dStr));
        if (match) alumnaId = match.id;
      }

      // Si no hay MATCH de DNI, buscar por nombre
      if (!alumnaId) {
        // Simple aproximación: Ver si el nombre/apellido está en el archivo. Solo match si es altamente probable para no mezclar.
        const bestMatch = alumnas.find(a => {
           const tokens = a.nombre_completo.toLowerCase().split(' ').filter(t => t.length > 3);
           return tokens.some(t => nameLower.includes(t));
        });
        if (bestMatch) alumnaId = bestMatch.id;
      }

      return {
        id: Math.random().toString(36).substring(7),
        file,
        alumnaId,
        tipo,
        status: 'pending'
      };
    });

    setTasks(prev => [...prev, ...newTasks]);
    e.target.value = ''; // reset
  };

  const procesarSubida = async () => {
    if (uploading) return;
    setUploading(true);

    const pending = tasks.filter(t => t.status === 'pending' && t.alumnaId && t.tipo);
    
    for (let i = 0; i < pending.length; i++) {
       const task = pending[i];
       
       // update local status
       setTasks(prev => prev.map(p => p.id === task.id ? { ...p, status: 'uploading' } : p));
       
       try {
         const timestamp = Date.now();
         const cleanFileName = task.file.name.replace(/[^a-zA-Z0-9.]/g, '_');
         const extension = task.file.name.split('.').pop();
         const finalName = `${timestamp}_${task.tipo}.${extension}`;
         
         const storageRef = ref(storage, `alumnas/${task.alumnaId}/${finalName}`);
         const snapshot = await uploadBytes(storageRef, task.file);
         const downloadUrl = await getDownloadURL(snapshot.ref);
         
         const updatePayload: any = {};
         updatePayload[`${task.tipo}_url`] = downloadUrl;
         
         await updateDoc(doc(db, 'alumnas', task.alumnaId), updatePayload);
         
         setTasks(prev => prev.map(p => p.id === task.id ? { ...p, status: 'success' } : p));
       } catch (err: any) {
         setTasks(prev => prev.map(p => p.id === task.id ? { ...p, status: 'error', errorMsg: err.message } : p));
       }
    }
    
    setUploading(false);
  };

  const removeTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = (id: string, field: string, val: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-4 mb-6 shrink-0">
        <Link to="/admin/alumnas" className="bg-white p-2 rounded-full shadow-sm hover:bg-slate-50 text-slate-500 transition-colors border border-slate-200">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <div>
           <h1 className="text-2xl font-black uppercase tracking-tight text-slate-800">Sincronización Masiva</h1>
           <p className="text-xs uppercase font-bold text-slate-400 tracking-widest mt-1">Sube fotos y certificados. Tip: Nombra los archivos con el DNI.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        <div className="md:col-span-1 bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
           <h3 className="text-sm font-bold uppercase tracking-widest mb-4 border-b border-slate-100 pb-2">Instrucciones</h3>
           <div className="text-xs text-slate-500 space-y-4 mb-6 leading-relaxed">
             <p>1. Descargá las fotos desde Google Drive a tu computadora (en una carpeta).</p>
             <p>2. Seleccioná todos los archivos que quieras importar usando el botón inferior.</p>
             <p>3. El sistema leerá el nombre de cada archivo para intentar adivinar a qué alumna pertenece y si es una Foto, DNI o Certificado.</p>
             <div className="bg-purple-50 p-3 rounded border border-purple-200">
                <span className="font-bold text-purple-800 block mb-1">PRO-TIP Nomenclatura:</span>
                Si los archivos se llaman <code className="bg-white px-1 text-[10px] text-purple-700 font-mono">45123456_foto.jpg</code> o <code className="bg-white px-1 text-[10px] text-purple-700 font-mono">apto_45123456.pdf</code> el sistema lo detectará automáticamente sin que tengas que ajustar nada.
             </div>
           </div>
           
           <div className="mt-auto relative">
             <input type="file" multiple accept="image/*,application/pdf" onChange={handleFiles} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
             <div className="border-2 border-dashed border-purple-300 bg-purple-50 text-purple-700 rounded-xl p-8 flex flex-col items-center justify-center text-center pointer-events-none transition-colors group-hover:bg-purple-100">
                <Upload className="w-8 h-8 mb-2 opacity-50" />
                <span className="text-xs font-bold uppercase tracking-widest">Arrastrar archivos o clic aquí</span>
             </div>
           </div>
        </div>

        <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
           <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center shrink-0">
              <h3 className="text-xs font-bold uppercase tracking-widest">Archivos Seleccionados ({tasks.length})</h3>
              <button onClick={procesarSubida} disabled={uploading || tasks.length === 0} className="bg-purple-600 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                 {uploading ? 'Subiendo...' : 'Iniciar Subida Masiva'} <Upload className="w-3 h-3" />
              </button>
           </div>
           
           <div className="flex-1 overflow-y-auto p-0">
             <table className="w-full text-left">
               <thead className="bg-slate-50 border-b border-slate-200 select-none sticky top-0 z-10">
                 <tr>
                   <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Archivo</th>
                   <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Gimnasta Asignada</th>
                   <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Clasificación</th>
                   <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Estado</th>
                   <th className="p-3 text-[10px] font-bold uppercase tracking-widest text-slate-400"></th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {tasks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                        No hay archivos seleccionados
                      </td>
                    </tr>
                 )}
                 {tasks.map(t => (
                   <tr key={t.id} className="hover:bg-slate-50/50">
                     <td className="p-3">
                        <div className="flex items-center gap-2 max-w-[200px]">
                           {t.file.type.includes('pdf') ? <File className="w-4 h-4 text-slate-400 shrink-0" /> : <ImageIcon className="w-4 h-4 text-slate-400 shrink-0" />}
                           <span className="text-[10px] font-bold text-slate-600 truncate" title={t.file.name}>{t.file.name}</span>
                        </div>
                     </td>
                     <td className="p-3">
                        <select 
                          value={t.alumnaId} 
                          onChange={(e) => updateTask(t.id, 'alumnaId', e.target.value)}
                          disabled={t.status === 'success' || t.status === 'uploading'}
                          className={`w-full max-w-[200px] text-[10px] font-bold uppercase border rounded p-1.5 outline-none ${t.alumnaId ? 'border-purple-200 bg-purple-50 text-purple-800' : 'border-red-300 bg-red-50 text-red-500'}`}
                        >
                          <option value="">-- Sin Asignar --</option>
                          {alumnas.map(a => (
                            <option key={a.id} value={a.id}>{a.nombre_completo} ({a.dni})</option>
                          ))}
                        </select>
                     </td>
                     <td className="p-3">
                        <select 
                          value={t.tipo} 
                          onChange={(e) => updateTask(t.id, 'tipo', e.target.value)}
                          disabled={t.status === 'success' || t.status === 'uploading'}
                          className={`w-full text-[10px] font-bold uppercase border rounded p-1.5 outline-none ${t.tipo ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-300 bg-red-50 text-red-500'}`}
                        >
                          <option value="">-- Clasificar --</option>
                          <option value="foto_gimnasta">Foto Perfil</option>
                          <option value="foto_dni_frente">DNI Frente</option>
                          <option value="foto_dni_dorso">DNI Dorso</option>
                          <option value="certificado_medico">Certificado Médico</option>
                        </select>
                     </td>
                     <td className="p-3">
                        {t.status === 'pending' && <span className="text-[10px] font-bold uppercase text-slate-400">Pendiente</span>}
                        {t.status === 'uploading' && <span className="text-[10px] font-bold uppercase text-purple-600">Subiendo...</span>}
                        {t.status === 'success' && <span className="text-[10px] font-bold uppercase text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> ¡Listo!</span>}
                        {t.status === 'error' && <span className="text-[10px] font-bold uppercase text-red-600 flex items-center gap-1" title={t.errorMsg}><AlertCircle className="w-3 h-3" /> Error</span>}
                     </td>
                     <td className="p-3 text-right">
                       <button onClick={() => removeTask(t.id)} disabled={t.status === 'uploading'} className="text-slate-400 hover:text-red-500 disabled:opacity-50">
                         <X className="w-4 h-4" />
                       </button>
                     </td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </div>
      </div>
    </div>
  );
}
