import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc, collection, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { supabase } from '../../supabase/config';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function FichaAlumna() {
  const { userData } = useAuth();
  if (!userData) return null;
  const { id } = useParams();
  const isNew = !id || id === 'nueva';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'info' | 'pagos' | 'grupos'>('info');
  const [pagosInfo, setPagosInfo] = useState<any[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    nombre_completo: '',
    dni: '',
    fecha_nacimiento: '',
    grupo_id: '',
    estado: 'activa',
    nombre_padre: '',
    telefono_padre: '',
    nombre_madre: '',
    telefono_madre: '',
    celular_gimnasta: '',
    email_contacto: '',
    antecedentes_medicos: '',
    obra_social: '',
    plan_obra_social: '',
    numero_obra_social: '',
    contacto_urgencia: '',
    foto_dni_frente_url: '',
    foto_dni_dorso_url: '',
    foto_gimnasta_url: '',
    certificado_medico_url: ''
  });

  useEffect(() => {
    async function loadData() {
      // Load groups
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
      
      if (!isNew) {
        try {
          const docSnap = await getDoc(doc(db, 'alumnas', id as string));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFormData({
              nombre_completo: data.nombre_completo || '',
              dni: data.dni || '',
              fecha_nacimiento: data.fecha_nacimiento ? data.fecha_nacimiento.toDate().toISOString().split('T')[0] : '',
              grupo_id: data.grupo_id || '',
              estado: data.estado || 'activa',
              nombre_padre: data.nombre_padre || '',
              telefono_padre: data.telefono_padre || '',
              nombre_madre: data.nombre_madre || '',
              telefono_madre: data.telefono_madre || '',
              celular_gimnasta: data.celular_gimnasta || '',
              email_contacto: data.email_contacto || '',
              antecedentes_medicos: data.antecedentes_medicos || '',
              obra_social: data.obra_social || '',
              plan_obra_social: data.plan_obra_social || '',
              numero_obra_social: data.numero_obra_social || '',
              contacto_urgencia: data.contacto_urgencia || '',
              foto_dni_frente_url: data.foto_dni_frente_url || '',
              foto_dni_dorso_url: data.foto_dni_dorso_url || '',
              foto_gimnasta_url: data.foto_gimnasta_url || '',
              certificado_medico_url: data.certificado_medico_url || '',
            });
          }

          // Fetch Pagos history (Cuotas y Otros Costos)
          const cuotasSnap = await getDocs(query(collection(db, 'cuotas'), where('alumna_id', '==', id)));
          const costosSnap = await getDocs(query(collection(db, 'otros_costos'), where('alumna_id', '==', id)));
          
          let history: any[] = [];
          cuotasSnap.forEach(d => {
            const c = d.data();
            history.push({
              _id: d.id,
              tipo: 'Cuota',
              detalle: `Mes ${MESES[c.mes - 1]} ${c.anio}`,
              monto: c.monto,
              estado: c.estado,
              fecha_pago: c.fecha_pago ? c.fecha_pago.toDate() : null,
              timestamp_sorting: c.anio * 100 + c.mes // For sorting
            });
          });
          costosSnap.forEach(d => {
            const c = d.data();
            const dateObj = c.fecha ? c.fecha.toDate() : new Date();
            history.push({
              _id: d.id,
              tipo: 'Otros Costos',
              detalle: c.concepto,
              monto: c.monto,
              estado: c.estado,
              fecha_pago: dateObj,
              timestamp_sorting: dateObj.getTime()
            });
          });
          
          // Sort by timestamp or logical order
          history.sort((a, b) => b.timestamp_sorting - a.timestamp_sorting);
          setPagosInfo(history);

        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    }
    loadData();
  }, [id, isNew]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0] && !isNew) {
      const file = e.target.files[0];
      setUploading(fieldName);
      try {
        const fileExt = file.name.split('.').pop();
        const filePath = `${id}/${Date.now()}_${fieldName}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('alumnas')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('alumnas')
          .getPublicUrl(filePath);
        
        await updateDoc(doc(db, 'alumnas', id as string), {
          [`${fieldName}_url`]: publicUrl
        });
        
        setFormData(prev => ({ ...prev, [`${fieldName}_url`]: publicUrl }));
        alert('Archivo cargado correctamente');
      } catch (err) {
        console.error(err);
        alert('Error al subir archivo');
      } finally {
        setUploading(null);
      }
    } else if (isNew) {
      alert('Primero guardá los datos básicos de la gimnasta antes de subir archivos.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = {
        nombre_completo: formData.nombre_completo,
        dni: formData.dni,
        fecha_nacimiento: formData.fecha_nacimiento ? new Date(formData.fecha_nacimiento) : null,
        grupo_id: formData.grupo_id,
        estado: formData.estado,
        nombre_padre: formData.nombre_padre,
        telefono_padre: formData.telefono_padre,
        nombre_madre: formData.nombre_madre,
        telefono_madre: formData.telefono_madre,
        celular_gimnasta: formData.celular_gimnasta,
        email_contacto: formData.email_contacto,
        antecedentes_medicos: formData.antecedentes_medicos,
        obra_social: formData.obra_social,
        plan_obra_social: formData.plan_obra_social,
        numero_obra_social: formData.numero_obra_social,
        contacto_urgencia: formData.contacto_urgencia
      };

      if (isNew) {
        const newRef = doc(collection(db, 'alumnas'));
        await setDoc(newRef, {
          id: newRef.id,
          ...dataToSave,
          creado_en: serverTimestamp()
        });
        
        // Generar 12 cuotas
        const today = new Date();
        const year = today.getFullYear();
        const promises = [];
        for (let m = 1; m <= 12; m++) {
          const cuotaRef = doc(collection(db, 'cuotas'));
          promises.push(setDoc(cuotaRef, {
            id: cuotaRef.id,
            alumna_id: newRef.id,
            mes: m,
            anio: year,
            monto: 30000,
            estado: m < today.getMonth() + 1 ? 'vencido' : 'pendiente'
          }));
        }
        await Promise.all(promises);
      } else {
        const docRef = doc(db, 'alumnas', id as string);
        const currentSnap = await getDoc(docRef);
        const currentData = currentSnap.data();

        await updateDoc(docRef, dataToSave);

        if (formData.estado === 'inactiva' && currentData?.estado !== 'inactiva') {
          let grupoNombre = 'SIN GRUPO';
          let grupoHorario = '';
          if (formData.grupo_id) {
             const gSnap = await getDocs(collection(db, 'grupos'));
             const grupoDoc = gSnap.docs.find(d => d.id === formData.grupo_id);
             if (grupoDoc) {
                const gData = grupoDoc.data();
                grupoNombre = gData.nombre || 'SIN GRUPO';
                grupoHorario = gData.horario || '';
             }
          }
          await setDoc(doc(collection(db, 'bajas')), {
            alumna_nombre: formData.nombre_completo,
            alumna_dni: formData.dni || '',
            grupo_nombre: grupoNombre,
            grupo_horario: grupoHorario,
            fecha: new Date()
          });
        }
      }
      navigate('/admin/alumnas');
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Cargando...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-white p-4 lg:p-6 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-base lg:text-lg font-black uppercase tracking-tight">{isNew ? 'Nueva Gimnasta' : formData.nombre_completo || 'Ficha Gimnasta'}</h1>
        <Link to="/admin/alumnas" className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-purple-600 underline whitespace-nowrap">Volver al Listado</Link>
      </div>

      {!isNew && (
        <div className="flex bg-slate-200/50 p-1 rounded-lg gap-1 border border-slate-200 w-full lg:w-fit overflow-x-auto scrollbar-hide">
          <button 
            onClick={() => setActiveTab('info')}
            className={`flex-1 lg:flex-none px-4 lg:px-6 py-2.5 rounded-md text-[9px] lg:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'info' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Información
          </button>
          <button 
            onClick={() => setActiveTab('pagos')}
            className={`flex-1 lg:flex-none px-4 lg:px-6 py-2.5 rounded-md text-[9px] lg:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'pagos' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Pagos
          </button>
          <button 
            onClick={() => setActiveTab('grupos')}
            className={`flex-1 lg:flex-none px-4 lg:px-6 py-2.5 rounded-md text-[9px] lg:text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'grupos' ? 'bg-white shadow-sm text-purple-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Grupo
          </button>
        </div>
      )}

      {activeTab === 'info' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Nombre Completo</label>
              <input type="text" required value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">DNI</label>
              <input type="text" required value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
            </div>
            <div>
              <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Fecha de Nacimiento</label>
              <input type="date" required value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none uppercase text-slate-500" />
            </div>
            <div>
              <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Celular Gimnasta</label>
              <input type="tel" value={formData.celular_gimnasta} onChange={e => setFormData({...formData, celular_gimnasta: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
            </div>

            <div>
              <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Grupo</label>
              <select value={formData.grupo_id} onChange={e => setFormData({...formData, grupo_id: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none uppercase text-slate-600">
                <option value="">Seleccionar Grupo...</option>
                {grupos.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre} ({g.horario})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Estado</label>
              <select value={formData.estado} onChange={e => setFormData({...formData, estado: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none uppercase text-slate-600">
                <option value="activa">Activa</option>
                <option value="inactiva">Baja</option>
                <option value="pendiente_aprobacion">Pendiente</option>
              </select>
            </div>
            
            <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                 <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Padre / Tutor</label>
                 <input type="text" value={formData.nombre_padre} onChange={e => setFormData({...formData, nombre_padre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none mb-2" placeholder="Nombre" />
                 <input type="text" value={formData.telefono_padre} onChange={e => setFormData({...formData, telefono_padre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="Teléfono" />
              </div>
              <div>
                 <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Madre / Tutor</label>
                 <input type="text" value={formData.nombre_madre} onChange={e => setFormData({...formData, nombre_madre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none mb-2" placeholder="Nombre" />
                 <input type="text" value={formData.telefono_madre} onChange={e => setFormData({...formData, telefono_madre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="Teléfono" />
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div>
                  <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Obra Social</label>
                  <input type="text" value={formData.obra_social} onChange={e => setFormData({...formData, obra_social: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
               </div>
               <div>
                  <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Número Obra Social</label>
                  <input type="text" value={formData.numero_obra_social} onChange={e => setFormData({...formData, numero_obra_social: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
               </div>
               <div>
                  <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Plan OS</label>
                  <input type="text" value={formData.plan_obra_social} onChange={e => setFormData({...formData, plan_obra_social: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
               </div>
            </div>

            <div className="md:col-span-2">
               <label className="block text-[9px] lg:text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Antecedentes Médicos</label>
               <textarea value={formData.antecedentes_medicos} onChange={e => setFormData({...formData, antecedentes_medicos: e.target.value})} rows={2} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
            </div>

            {/* Documentos */}
            <div className="md:col-span-2 pt-4 border-t border-slate-100">
               <h3 className="text-xs font-bold uppercase text-slate-500 tracking-widest mb-4">Documentación Adjunta</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {['foto_gimnasta', 'foto_dni_frente', 'foto_dni_dorso', 'certificado_medico'].map((docKey) => {
                    const url = (formData as any)[`${docKey}_url`];
                    const isUploading = uploading === docKey;
                    return (
                      <div key={docKey} className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-3">
                        <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">{docKey.replace(/_/g, ' ')}</span>
                        
                        {url && (
                          <div className="relative group">
                            {docKey.includes('foto') && (
                               <img src={url} alt={docKey} className="w-full h-24 object-cover rounded border border-slate-200 mb-2" />
                            )}
                            <a href={url} target="_blank" rel="noopener noreferrer" className="block text-center text-[9px] font-bold text-white bg-slate-800/80 px-2 py-1 rounded uppercase tracking-tighter">
                              Ver Completo
                            </a>
                          </div>
                        )}

                        <div className="mt-auto">
                          <label className="block w-full cursor-pointer bg-white border border-dashed border-slate-300 hover:border-purple-400 p-2 rounded text-center transition-colors">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {isUploading ? 'Subiendo...' : url ? 'Cambiar' : 'Cargar'}
                            </span>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*,application/pdf"
                              disabled={isUploading}
                              onChange={(e) => handleFileChange(e, docKey)} 
                            />
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
            
          </div>
          
          <div className="pt-4 flex justify-end">
             <button type="submit" disabled={saving} className="bg-purple-600 text-white px-6 py-3 rounded text-[10px] font-bold uppercase tracking-widest hover:bg-purple-700 disabled:opacity-50">
               {saving ? 'Guardando...' : 'Guardar Gimnasta'}
             </button>
          </div>
        </form>
      </div>
      )}

      {activeTab === 'pagos' && !isNew && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50">
             <h3 className="text-sm font-bold uppercase tracking-tight">Registro Financiero</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left bg-white">
              <thead>
                <tr className="text-[10px] lg:text-xs uppercase text-slate-400 tracking-wider bg-white">
                  <th className="py-3 px-4 lg:px-6 font-black border-b border-slate-100 whitespace-nowrap">Tipo</th>
                  <th className="py-3 px-4 lg:px-6 font-black border-b border-slate-100 whitespace-nowrap">Detalle</th>
                  <th className="py-3 px-4 lg:px-6 font-black border-b border-slate-100 whitespace-nowrap">Monto</th>
                  <th className="py-3 px-4 lg:px-6 font-black border-b border-slate-100 whitespace-nowrap">Estado</th>
                  <th className="py-3 px-4 lg:px-6 font-black border-b border-slate-100 whitespace-nowrap">Fecha Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagosInfo.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-xs font-bold uppercase text-slate-500">No hay pagos registrados.</td></tr>
                ) : pagosInfo.map(p => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 lg:px-6 text-[10px] lg:text-xs font-bold text-slate-600 uppercase">{p.tipo}</td>
                    <td className="py-3 px-4 lg:px-6 text-[10px] lg:text-xs text-slate-500">{p.detalle}</td>
                    <td className="py-3 px-4 lg:px-6 text-xs lg:text-sm font-black text-purple-700">${p.monto}</td>
                    <td className="py-3 px-4 lg:px-6">
                      <span className={`inline-flex px-2 py-1 rounded text-[9px] lg:text-[10px] font-bold uppercase tracking-widest border ${
                        p.estado === 'pagado' ? 'bg-emerald-100 border-emerald-200 text-emerald-700' : 'bg-amber-100 border-amber-200 text-amber-700'
                      }`}>
                        {p.estado}
                      </span>
                    </td>
                    <td className="py-3 px-4 lg:px-6 text-[10px] lg:text-xs text-slate-500">{p.fecha_pago ? p.fecha_pago.toLocaleDateString('es-AR') : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'grupos' && !isNew && (
         <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="text-sm font-bold uppercase tracking-tight mb-4">Grupo Actual</h3>
            
            {formData.grupo_id ? (
              <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                <p className="text-xs font-bold uppercase text-purple-900 tracking-wider">
                  {grupos.find(g => g.id === formData.grupo_id)?.nombre || 'Desconocido'}
                </p>
                <p className="text-[10px] uppercase font-bold text-purple-500 tracking-widest mt-1">
                  Horario: {grupos.find(g => g.id === formData.grupo_id)?.horario || '-'}
                </p>
                <p className="text-[10px] uppercase font-bold text-purple-500 tracking-widest mt-1">
                  Profesor: {grupos.find(g => g.id === formData.grupo_id)?.profesor || '-'}
                </p>
              </div>
            ) : (
              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">No tiene grupo asignado.</p>
            )}

            <div className="mt-8 pt-6 border-t border-slate-100">
               <h3 className="text-xs font-bold uppercase tracking-tight text-slate-400 mb-2">Historial de Cambios</h3>
               <p className="text-[10px] uppercase font-bold text-slate-300 tracking-widest">Los cambios de grupo futuros se irán listando aquí.</p>
            </div>
         </div>
      )}
    </div>
  );
}
