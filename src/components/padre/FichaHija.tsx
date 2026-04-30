import { useState, useEffect } from 'react';
import { db } from '../../firebase/config';
import { useParams, Link } from 'react-router-dom';
import { isBefore, addDays } from 'date-fns';
import { AlertCircle, CheckCircle, XCircle, Edit3, User, Phone, Shield, FileText, Info, X, Camera, UploadCloud, CheckCircle2 } from 'lucide-react';
import { updateDoc, doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { supabase } from '../../supabase/config';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

export default function FichaHija() {
  const { id } = useParams();
  const [alumna, setAlumna] = useState<any>(null);
  const [cuotas, setCuotas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCuotaDetail, setSelectedCuotaDetail] = useState<any>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});
  
  const [formData, setFormData] = useState({
    nombre_completo: '',
    dni: '',
    fecha_nacimiento: '',
    nombre_padre: '',
    telefono_padre: '',
    nombre_madre: '',
    telefono_madre: '',
    celular_gimnasta: '',
    email_contacto: '',
    direccion: '',
    telefono: '',
    antecedentes_medicos: '',
    obra_social: '',
    plan_obra_social: '',
    numero_obra_social: '',
    contacto_urgencia: ''
  });

  useEffect(() => {
    async function loadData() {
      try {
        const docSnap = await getDoc(doc(db, 'alumnas', id as string));
        if (docSnap.exists()) {
          const data = docSnap.id ? { id: docSnap.id, ...docSnap.data() } : docSnap.data();
          setAlumna(data);
          setFormData({
            nombre_completo: data.nombre_completo || '',
            dni: data.dni || '',
            fecha_nacimiento: data.fecha_nacimiento ? (data.fecha_nacimiento.toDate ? data.fecha_nacimiento.toDate().toISOString().split('T')[0] : new Date(data.fecha_nacimiento).toISOString().split('T')[0]) : '',
            nombre_padre: data.nombre_padre || '',
            telefono_padre: data.telefono_padre || '',
            nombre_madre: data.nombre_madre || '',
            telefono_madre: data.telefono_madre || '',
            celular_gimnasta: data.celular_gimnasta || '',
            email_contacto: data.email_contacto || '',
            direccion: data.direccion || '',
            telefono: data.telefono || '',
            antecedentes_medicos: data.antecedentes_medicos || '',
            obra_social: data.obra_social || '',
            plan_obra_social: data.plan_obra_social || '',
            numero_obra_social: data.numero_obra_social || '',
            contacto_urgencia: data.contacto_urgencia || ''
          });
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

  const handleUpdateData = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const dataToSave = {
        ...formData,
        fecha_nacimiento: formData.fecha_nacimiento ? new Date(formData.fecha_nacimiento) : null
      };
      await updateDoc(doc(db, 'alumnas', id as string), dataToSave);
      setAlumna({ ...alumna, ...dataToSave });
      setShowEditModal(false);
      alert('Datos actualizados correctamente');
    } catch (err) {
      console.error(err);
      alert('Error al actualizar datos');
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadingField(fieldName);
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
        
        setAlumna((prev: any) => ({ ...prev, [`${fieldName}_url`]: publicUrl }));
        
        if (file.type.startsWith('image/')) {
          setPreviews(prev => ({ ...prev, [fieldName]: publicUrl }));
        }
        
        alert('Archivo actualizado correctamente');
      } catch (err) {
        console.error(err);
        alert('Error al subir archivo');
      } finally {
        setUploadingField(null);
      }
    }
  };

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
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 w-10 h-10 rounded-full flex items-center justify-center overflow-hidden">
            {alumna.foto_gimnasta_url ? (
              <img src={alumna.foto_gimnasta_url} alt={alumna.nombre_completo} className="w-full h-full object-cover" />
            ) : (
              <span className="text-purple-700 font-black text-sm">{alumna.nombre_completo.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <h1 className="text-sm font-bold uppercase tracking-tight">{alumna.nombre_completo}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setShowEditModal(true)}
            className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wide hover:bg-emerald-200 transition-colors flex items-center gap-2"
          >
            <Edit3 className="w-3 h-3"/> Actualizar Datos
          </button>
          <Link to="/portal" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-purple-600 underline">Volver</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-1 border-t-4 border-t-purple-600 space-y-6">
          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-1">Identificación</h2>
            <div className="space-y-4 text-xs font-bold uppercase">
              <p><span className="text-slate-400 block tracking-widest mb-1 text-[10px]">DNI</span> {alumna.dni}</p>
              <p><span className="text-slate-400 block tracking-widest mb-1 text-[10px]">Fecha Nac.</span> {alumna.fecha_nacimiento ? (alumna.fecha_nacimiento.toDate ? alumna.fecha_nacimiento.toDate().toLocaleDateString('es-AR') : new Date(alumna.fecha_nacimiento).toLocaleDateString('es-AR')) : '-'}</p>
              <p><span className="text-slate-400 block tracking-widest mb-1 text-[10px]">Estado</span> {alumna.estado}</p>
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-1">Contacto Familiar</h2>
            <div className="space-y-3 text-[11px] font-bold uppercase">
              {alumna.nombre_padre && <p><span className="text-slate-400 block tracking-widest mb-0.5 text-[9px]">Padre</span> {alumna.nombre_padre} ({alumna.telefono_padre})</p>}
              {alumna.nombre_madre && <p><span className="text-slate-400 block tracking-widest mb-0.5 text-[9px]">Madre</span> {alumna.nombre_madre} ({alumna.telefono_madre})</p>}
              {alumna.email_contacto && <p><span className="text-slate-400 block tracking-widest mb-0.5 text-[9px]">Email</span> {alumna.email_contacto}</p>}
            </div>
          </div>

          <div>
            <h2 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 border-b border-slate-50 pb-1">Salud / Obra Social</h2>
            <div className="space-y-3 text-[11px] font-bold uppercase">
              <p><span className="text-slate-400 block tracking-widest mb-0.5 text-[9px]">Obra Social</span> {alumna.obra_social || 'No informada'}</p>
              <p><span className="text-slate-400 block tracking-widest mb-0.5 text-[9px]">Contacto Urgencia</span> {alumna.contacto_urgencia || '-'}</p>
            </div>
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
            <h2 className="text-sm font-bold uppercase tracking-tight mb-4 border-b border-slate-100 pb-2 flex items-center justify-between">
              Estado de Cuotas {today.getFullYear()}
              <div className="flex gap-2">
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span> PAGO</span>
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span> PDTE</span>
                <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span> DEUDA</span>
              </div>
            </h2>
            <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
              {MESES.map((m, idx) => {
                const mesIndex = idx + 1;
                const c = cuotas.find(x => x.mes === mesIndex);
                const isExento = mesIndex <= 4;
                const isLate = today.getDate() > 15 && mesIndex === (today.getMonth() + 1);

                if (!c && isExento) {
                  return (
                    <div key={m} className="p-3 border rounded text-center bg-slate-50 border-slate-100 opacity-50">
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{m}</div>
                      <div className="text-[9px] font-black text-slate-300">EXENTO</div>
                    </div>
                  );
                }

                if (!c) {
                  const isDeuda = mesIndex <= (today.getMonth() + 1);
                  return (
                    <div key={m} className={`p-3 border rounded text-center ${isDeuda ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100 opacity-50'}`}>
                      <div className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-1">{m}</div>
                      <div className={`text-[9px] font-black ${isDeuda ? 'text-red-700' : 'text-slate-300'}`}>
                        {isDeuda ? 'DEUDA' : '-'}
                      </div>
                    </div>
                  );
                }

                const isPagado = c.estado === 'pagado';
                const isVencido = c.estado === 'vencido' || (!isPagado && isLate);

                return (
                  <div 
                    key={m} 
                    onClick={() => isPagado && setSelectedCuotaDetail(c)}
                    className={`p-3 border rounded text-center cursor-pointer transition-all hover:scale-105 ${
                    isPagado ? 'bg-emerald-50 border-emerald-200 shadow-sm shadow-emerald-100' :
                    isVencido ? 'bg-red-50 border-red-200 animate-pulse' : 'bg-amber-50 border-amber-200'
                  }`}>
                    <div className={`text-[10px] uppercase font-bold tracking-widest mb-1 ${
                      isPagado ? 'text-emerald-700' : isVencido ? 'text-red-700' : 'text-amber-700'
                    }`}>{m}</div>
                    <div className={`text-[9px] font-black flex items-center justify-center gap-1 ${
                      isPagado ? 'text-emerald-700' : isVencido ? 'text-red-700' : 'text-amber-700'
                    }`}>
                      {isPagado ? <><CheckCircle className="w-2.5 h-2.5"/> PAGADO</> : 
                       isVencido ? <><AlertCircle className="w-2.5 h-2.5"/> DEUDA</> : 'PDTE'}
                    </div>
                    {isPagado && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedCuotaDetail(c); }}
                        className="mt-2 w-full py-1 rounded bg-emerald-600 text-white text-[8px] font-black uppercase tracking-tighter hover:bg-emerald-700 transition-colors"
                      >
                        Ver Detalles
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {(today.getDate() > 15) && (
              <p className="mt-4 text-[9px] font-bold text-red-600 bg-red-50 p-2 rounded border border-red-100 flex items-center gap-2">
                <AlertCircle className="w-3 h-3"/>
                AVISO: SI NO SE REGISTRA EL PAGO ANTES DEL DÍA 15, LA CUOTA TENDRÁ UN INCREMENTO.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal Editar Datos - Sincronizado con NuevaInscripcion */}
      {showEditModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800">Actualizar Información</h2>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Modificá los datos necesarios y presioná guardar.</p>
              </div>
              <button onClick={() => setShowEditModal(false)} className="bg-slate-50 p-2 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <form onSubmit={handleUpdateData} className="p-6 space-y-10">
              {/* SECCIÓN DATOS PERSONALES */}
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-purple-600 tracking-widest bg-purple-50 p-2 rounded inline-block">1. Datos Personales</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Nombre Completo</label>
                    <input type="text" value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">DNI</label>
                    <input type="text" value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Fecha Nacimiento</label>
                    <input type="date" value={formData.fecha_nacimiento} onChange={e => setFormData({...formData, fecha_nacimiento: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors text-slate-500" />
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Dirección</label>
                    <input type="text" value={formData.direccion} onChange={e => setFormData({...formData, direccion: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Email Contacto</label>
                    <input type="email" value={formData.email_contacto} onChange={e => setFormData({...formData, email_contacto: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold lowercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                </div>
              </div>

              {/* SECCIÓN FAMILIA */}
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-purple-600 tracking-widest bg-purple-50 p-2 rounded inline-block">2. Familia y Urgencias</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Nombre Padre</label>
                      <input type="text" value={formData.nombre_padre} onChange={e => setFormData({...formData, nombre_padre: e.target.value})} className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Teléfono Padre</label>
                      <input type="tel" value={formData.telefono_padre} onChange={e => setFormData({...formData, telefono_padre: e.target.value})} className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                    </div>
                  </div>
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Nombre Madre</label>
                      <input type="text" value={formData.nombre_madre} onChange={e => setFormData({...formData, nombre_madre: e.target.value})} className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Teléfono Madre</label>
                      <input type="tel" value={formData.telefono_madre} onChange={e => setFormData({...formData, telefono_madre: e.target.value})} className="w-full bg-white border border-slate-200 rounded p-2 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                    </div>
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Contacto Urgencia (Nombre y Teléfono)</label>
                    <input type="text" value={formData.contacto_urgencia} onChange={e => setFormData({...formData, contacto_urgencia: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                </div>
              </div>

              {/* SECCIÓN SALUD Y ARCHIVOS */}
              <div className="space-y-6">
                <h3 className="text-[10px] font-black uppercase text-purple-600 tracking-widest bg-purple-50 p-2 rounded inline-block">3. Salud y Documentación</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Obra Social</label>
                    <input type="text" value={formData.obra_social} onChange={e => setFormData({...formData, obra_social: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Plan</label>
                    <input type="text" value={formData.plan_obra_social} onChange={e => setFormData({...formData, plan_obra_social: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Nº Carnet</label>
                    <input type="text" value={formData.numero_obra_social} onChange={e => setFormData({...formData, numero_obra_social: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1 tracking-widest">Antecedentes Médicos</label>
                    <textarea value={formData.antecedentes_medicos} onChange={e => setFormData({...formData, antecedentes_medicos: e.target.value})} rows={2} className="w-full bg-slate-50 border border-slate-200 rounded p-3 text-xs font-bold uppercase outline-none focus:border-purple-400 transition-colors" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  {[
                    { id: 'foto_gimnasta', label: 'Foto Perfil', icon: <Camera className="w-4 h-4"/> },
                    { id: 'certificado_medico', label: 'Apto Médico', icon: <FileText className="w-4 h-4"/> },
                    { id: 'foto_dni_frente', label: 'DNI Frente', icon: <FileText className="w-4 h-4"/> },
                    { id: 'foto_dni_dorso', label: 'DNI Dorso', icon: <FileText className="w-4 h-4"/> }
                  ].map((item) => {
                    const currentUrl = (alumna as any)[`${item.id}_url`];
                    const isUploading = uploadingField === item.id;
                    return (
                      <div key={item.id} className="relative group">
                        <div className={`h-32 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-2 text-center ${
                          isUploading ? 'border-purple-400 bg-purple-50' : 'border-slate-200 bg-slate-50 hover:border-purple-300'
                        }`}>
                          {currentUrl && !isUploading ? (
                            item.id.includes('foto') ? (
                              <img src={currentUrl} className="w-full h-full object-cover rounded-lg" alt="preview" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                <span className="text-[8px] font-black uppercase text-emerald-600">Cargado</span>
                              </div>
                            )
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              {isUploading ? <UploadCloud className="w-5 h-5 animate-bounce text-purple-500" /> : item.icon}
                              <span className="text-[8px] font-black uppercase tracking-widest">{isUploading ? 'Subiendo...' : item.label}</span>
                            </div>
                          )}
                          
                          <input 
                            type="file" 
                            accept={item.id.includes('foto') ? "image/*" : "image/*,application/pdf"} 
                            onChange={e => handleFileChange(e, item.id)} 
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            disabled={isUploading}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setShowEditModal(false)} className="px-6 py-3 rounded text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" disabled={saving} className="bg-purple-600 text-white px-10 py-3 rounded text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-200 disabled:opacity-50">
                  {saving ? 'Guardando...' : 'Guardar Todos los Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detalles de Cuota */}
      {selectedCuotaDetail && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedCuotaDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-emerald-600 p-6 text-white text-center">
               <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle className="w-8 h-8 text-white" />
               </div>
               <h2 className="text-sm font-black uppercase tracking-widest">Pago Confirmado</h2>
               <p className="text-[10px] font-bold uppercase opacity-80 mt-1">Mes {MESES[selectedCuotaDetail.mes - 1]} {selectedCuotaDetail.anio}</p>
            </div>
            <div className="p-6 space-y-6">
               <div className="grid grid-cols-2 gap-6">
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Monto Abonado</span>
                    <span className="text-lg font-black text-slate-800">${selectedCuotaDetail.monto}</span>
                  </div>
                  <div>
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Medio de Pago</span>
                    <span className="text-xs font-bold text-slate-800 uppercase bg-slate-100 px-2 py-1 rounded">{selectedCuotaDetail.metodo_pago || 'Efectivo'}</span>
                  </div>
                  <div className="col-span-2 border-t border-slate-50 pt-4">
                    <span className="block text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">Fecha de Registro</span>
                    <span className="text-xs font-bold text-slate-600 uppercase">
                      {selectedCuotaDetail.fecha_pago ? (selectedCuotaDetail.fecha_pago.toDate ? selectedCuotaDetail.fecha_pago.toDate().toLocaleString('es-AR') : new Date(selectedCuotaDetail.fecha_pago).toLocaleString('es-AR')) : '-'}
                    </span>
                  </div>
                  {selectedCuotaDetail.notas && (
                    <div className="col-span-2 bg-slate-50 p-3 rounded italic text-[10px] text-slate-500 border-l-2 border-slate-200">
                      "{selectedCuotaDetail.notas}"
                    </div>
                  )}
               </div>
               <button onClick={() => setSelectedCuotaDetail(null)} className="w-full py-3 rounded bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-colors mt-4">
                 Cerrar
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
