import { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { supabase } from '../../supabase/config';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Camera, FileText, CheckCircle2, UploadCloud, X } from 'lucide-react';

export default function NuevaInscripcion() {
  const { userData } = useAuth();
  if (!userData) return null;
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre_completo: '',
    dni: '',
    fecha_nacimiento: '',
    nombre_padre: '',
    nombre_madre: '',
    domicilio: '',
    celular_gimnasta: '',
    email_contacto: '',
    antecedentes_medicos: '',
    telefono_padre: '',
    telefono_madre: '',
    obra_social: '',
    numero_obra_social: '',
    plan_obra_social: '',
    contacto_urgencia: '',
  });

  const [files, setFiles] = useState<{ [key: string]: File | null }>({
    foto_dni_frente: null,
    foto_dni_dorso: null,
    foto_gimnasta: null,
    certificado_medico: null,
  });

  const [previews, setPreviews] = useState<{ [key: string]: string }>({});
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles({ ...files, [fieldName]: file });
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviews(prev => ({ ...prev, [fieldName]: reader.result as string }));
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews(prev => ({ ...prev, [fieldName]: 'pdf' }));
      }
    }
  };

  const uploadFile = async (file: File, folder: string, filename: string): Promise<string> => {
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${folder}/${Date.now()}_${filename}.${fileExt}`;
      
      const { data, error } = await supabase.storage
        .from('alumnas')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('alumnas')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (err) {
      console.error("Supabase upload failed for:", filename, err);
      return '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      alert("Debés aceptar los términos y condiciones para continuar.");
      return;
    }
    
    setLoading(true);
    try {
      const newAlumnaRef = doc(collection(db, 'alumnas'));
      
      // Attempt Uploading Images
      const foto_dni_frente_url = files.foto_dni_frente ? await uploadFile(files.foto_dni_frente, `alumnas/${newAlumnaRef.id}`, 'dni_frente') : '';
      const foto_dni_dorso_url = files.foto_dni_dorso ? await uploadFile(files.foto_dni_dorso, `alumnas/${newAlumnaRef.id}`, 'dni_dorso') : '';
      const foto_gimnasta_url = files.foto_gimnasta ? await uploadFile(files.foto_gimnasta, `alumnas/${newAlumnaRef.id}`, 'foto_perfil') : '';
      const certificado_medico_url = files.certificado_medico ? await uploadFile(files.certificado_medico, `alumnas/${newAlumnaRef.id}`, 'certificado') : '';

      // Create Alumna directly
      await setDoc(newAlumnaRef, {
        id: newAlumnaRef.id,
        nombre_completo: form.nombre_completo,
        dni: form.dni,
        fecha_nacimiento: new Date(form.fecha_nacimiento),
        nombre_padre: form.nombre_padre,
        nombre_madre: form.nombre_madre,
        domicilio: form.domicilio,
        celular_gimnasta: form.celular_gimnasta,
        email_contacto: form.email_contacto,
        antecedentes_medicos: form.antecedentes_medicos,
        telefono_padre: form.telefono_padre,
        telefono_madre: form.telefono_madre,
        obra_social: form.obra_social,
        numero_obra_social: form.numero_obra_social,
        plan_obra_social: form.plan_obra_social,
        contacto_urgencia: form.contacto_urgencia,
        // Files
        foto_dni_frente_url,
        foto_dni_dorso_url,
        foto_gimnasta_url,
        certificado_medico_url,
        
        estado: 'pendiente_aprobacion',
        creado_en: serverTimestamp()
      });

      // Link it to the padre
      const linkId = `${userData!.uid}_${newAlumnaRef.id}`;
      await setDoc(doc(db, 'padre_alumna', linkId), {
        usuario_id: userData!.uid,
        alumna_id: newAlumnaRef.id,
        vinculado_en: serverTimestamp()
      });

      alert('Inscripción enviada correctamente. El estado es Pendiente de Aprobación. Cuando sea aprobada te notificaremos.');
      navigate('/portal');
    } catch (err) {
      console.error(err);
      alert('Error al enviar la inscripción. Asegúrese de que el tamaño de los archivos no sea demasiado grande y vuelva a intentar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="bg-white p-6 md:p-8 rounded-xl shadow-sm border border-slate-200">
        <h1 className="text-xl font-bold uppercase tracking-tight mb-2 text-slate-800">Formulario de Inscripción</h1>
        <p className="text-xs text-slate-500 font-bold uppercase mb-8 tracking-widest border-b border-slate-100 pb-4">Completá todos los datos para solicitar cupo o registrar a tu hija.</p>
        
        <form onSubmit={handleSubmit} className="space-y-8">

          {/* DATOS DE LA GIMNASTA */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-purple-700 uppercase tracking-widest bg-purple-50 p-2 rounded">Datos de la Gimnasta</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Apellido y Nombre <span className="text-red-500">*</span></label>
                <input type="text" required value={form.nombre_completo} onChange={e => setForm({...form, nombre_completo: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="Ej: Perez, María" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">DNI <span className="text-red-500">*</span></label>
                <input type="text" required value={form.dni} onChange={e => setForm({...form, dni: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Fecha de Nacimiento <span className="text-red-500">*</span></label>
                <input type="date" required value={form.fecha_nacimiento} onChange={e => setForm({...form, fecha_nacimiento: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none uppercase text-slate-500" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Celular Gimnasta (Opcional)</label>
                <input type="tel" value={form.celular_gimnasta} onChange={e => setForm({...form, celular_gimnasta: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
               <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Domicilio exacto <span className="text-red-500">*</span></label>
                  <input type="text" required value={form.domicilio} onChange={e => setForm({...form, domicilio: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
               </div>
               <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Email <span className="text-slate-400 text-[8px]">(Opcional)</span></label>
                  <input type="email" value={form.email_contacto} onChange={e => setForm({...form, email_contacto: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
               </div>
            </div>
            
            <div className="pt-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Antecedentes Médicos Importantes / Alergias <span className="text-red-500">*</span></label>
                <textarea required value={form.antecedentes_medicos} onChange={e => setForm({...form, antecedentes_medicos: e.target.value})} rows={3} placeholder="De no poseer, indique 'Ninguno'." className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none"></textarea>
            </div>
          </section>

          {/* DATOS DE LOS PADRES */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-purple-700 uppercase tracking-widest bg-purple-50 p-2 rounded">Datos de Padres / Tutores</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Apellido y Nombre del Padre <span className="text-red-500">*</span></label>
                <input type="text" required value={form.nombre_padre} onChange={e => setForm({...form, nombre_padre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Teléfono del Padre <span className="text-red-500">*</span></label>
                <input type="tel" required value={form.telefono_padre} onChange={e => setForm({...form, telefono_padre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Apellido y Nombre de la Madre <span className="text-red-500">*</span></label>
                <input type="text" required value={form.nombre_madre} onChange={e => setForm({...form, nombre_madre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Teléfono de la Madre <span className="text-red-500">*</span></label>
                <input type="tel" required value={form.telefono_madre} onChange={e => setForm({...form, telefono_madre: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
            </div>
            <div className="pt-2">
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Otro contacto de urgencia (Nombre y Teléfono)</label>
                <input type="text" value={form.contacto_urgencia} onChange={e => setForm({...form, contacto_urgencia: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" placeholder="Ej: Abuela Marta - 261 456 7890" />
            </div>
          </section>

          {/* OBRA SOCIAL */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-purple-700 uppercase tracking-widest bg-purple-50 p-2 rounded">Cobertura Médica</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Obra Social</label>
                <input type="text" value={form.obra_social} onChange={e => setForm({...form, obra_social: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Número de Credencial</label>
                <input type="text" value={form.numero_obra_social} onChange={e => setForm({...form, numero_obra_social: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest mb-1">Plan</label>
                <input type="text" value={form.plan_obra_social} onChange={e => setForm({...form, plan_obra_social: e.target.value})} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
              </div>
            </div>
          </section>

          {/* ARCHIVOS ADJUNTOS */}
          <section className="space-y-4">
            <h2 className="text-sm font-black text-purple-700 uppercase tracking-widest bg-purple-50 p-2 rounded">Archivos Adjuntos</h2>
            <p className="text-[10px] font-bold text-slate-400 mb-4 tracking-widest uppercase">Solo se admite un archivo por campo (Imagen o PDF corto).</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { id: 'foto_dni_frente', label: 'DNI Frente', icon: <FileText className="w-5 h-5"/> },
                { id: 'foto_dni_dorso', label: 'DNI Dorso', icon: <FileText className="w-5 h-5"/> },
                { id: 'foto_gimnasta', label: 'Foto Perfil', icon: <Camera className="w-5 h-5"/>, accept: "image/*" },
                { id: 'certificado_medico', label: 'Certificado Med.', icon: <FileText className="w-5 h-5"/> }
              ].map((item) => (
                <div key={item.id} className="relative group">
                   <div className={`h-40 rounded-xl border-2 border-dashed transition-all flex flex-col items-center justify-center p-4 text-center ${
                     files[item.id] ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-purple-300'
                   }`}>
                      {previews[item.id] ? (
                        previews[item.id] === 'pdf' ? (
                          <div className="flex flex-col items-center gap-2">
                             <FileText className="w-10 h-10 text-emerald-600" />
                             <span className="text-[9px] font-black uppercase text-emerald-700 truncate w-32">{files[item.id]?.name}</span>
                          </div>
                        ) : (
                          <img src={previews[item.id]} alt="preview" className="w-full h-full object-cover rounded-lg" />
                        )
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-slate-400">
                           {item.icon}
                           <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
                           <UploadCloud className="w-4 h-4 opacity-30 mt-1" />
                        </div>
                      )}
                      
                      <input 
                        type="file" 
                        required={!files[item.id]}
                        accept={item.accept || "image/*,application/pdf"} 
                        onChange={e => handleFileChange(e, item.id)} 
                        className="absolute inset-0 opacity-0 cursor-pointer" 
                      />

                      {files[item.id] && (
                        <div className="absolute top-2 right-2 bg-emerald-500 text-white rounded-full p-1 shadow-lg">
                           <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}
                   </div>
                   {files[item.id] && (
                     <p className="text-[8px] font-bold text-emerald-600 mt-1 text-center uppercase">¡Listo!</p>
                   )}
                </div>
              ))}
            </div>
          </section>

          {/* TERMINOS Y CONDICIONES */}
          <section className="space-y-4 pt-6 mt-6 border-t border-slate-200">
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest bg-slate-100 p-2 rounded">Reglas de convivencia y términos</h2>
            
            <div className="h-64 overflow-y-auto bg-slate-50 p-4 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-4 font-medium leading-relaxed">
              <p><b>CERTIFICADO MÉDICO:</b> Es obligatoria la presentación del mismo, en caso de no cumplimentar esta disposición, Akro's no se hará responsable de las consecuencias ocasionadas por desconocimiento de patologías existentes. Los alumnos tendrán 30 días desde la inscripción para a presentación del mismo, caso contrario podrán ser dados de baja. El mismo debe adjuntarse al sistema. Quién tenga el certificado 2025 deberá actualizarlo en los mismos plazos.</p>
              
              <p><b>CUOTAS:</b> Las cuotas tendrán una actualización acorde al Índice de inflación publicado. Las cuotas son mensuales, y deben abonarse independientemente de la concurrencia o no a clase, ya que el hecho de tener un cupo en una clase implica que el profesor está a disposición del alumno. Si por algún motivo no concurrirá, debe avisar para dar la baja. En este caso, Akro's podrá disponer del cupo. Si decide retornar deberá inscribirse nuevamente, y su lugar estará sujeto a disponibilidad.</p>
              
              <p><b>CUOTAS ATRASADAS:</b> Las cuotas deben abonarse del 1 al 10 de cada mes, abonadas fuera de término sufrirán un recargo del 10% mensual. En caso de que pase al mes siguiente deberá abonarse la cuota actualizada con el recargo.</p>
              
              <p><b>GRUPOS FEDERADOS:</b> La incorporación en los mismos depende del nivel técnico de los alumnos, y su permanencia está sujeta al cumplimiento de la asistencia. Los gastos federativos, de indumentaria y de viajes a competencias son por cuenta del alumno, así como el prorrateo de los gastos de los profesores que los acompañen.</p>

              <p><b>AKRO'S</b> se reserva el derecho de admisión.</p>

              <p><b>HORARIOS:</b> Es importante que las gimnastas lleguen a horario para poder realizar la Entrada en Calor y evitar lesiones. La tolerancia para ingresar a clase será de 15 minutos. Así mismo, se les solicita respetar los horarios de salida, el personal del gimnasio se retira 15 minutos después del horario de finalización de las clases.</p>

              <p><b>PERTENENCIAS PERSONALES:</b> AKRO'S no se hace responsable de las pertenencias personales extraviadas, aconsejamos no concurrir con elementos de valor.</p>

              <p><b>RESPONSABILIDAD:</b> Tomo conocimiento de que la Gimnasia Artística es una actividad deportiva, que esta sujeta a riesgos y lesiones propias. También es un deporte que requiere del contacto físico de los profesores con los alumnos, para la enseñanza y/o cuidado de los diferentes ejercicios, con el objetivo de salvaguardar la integridad física de los mismos, y autorizo expresamente dicha práctica.</p>
            </div>

            <div className="flex items-start gap-4 pt-4">
              <input type="checkbox" id="termsChecked" required checked={acceptedTerms} onChange={e => setAcceptedTerms(e.target.checked)} className="mt-1 w-5 h-5 text-purple-600 rounded" />
              <label htmlFor="termsChecked" className="text-xs font-bold text-slate-700">
                HE LEÍDO ATENTAMENTE Y ACEPTO LAS PAUTAS REGLAMENTARIAS PARA EFECTIVIZAR LA INSCRIPCIÓN Y TOMO RESPONSABILIDAD DE LA INFORMACIÓN CARGADA EN ESTE FORMULARIO.
              </label>
            </div>
          </section>

          <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white p-4 rounded-xl text-xs uppercase font-black tracking-widest hover:bg-purple-700 disabled:opacity-50 mt-8 transition-colors shadow-lg">
            {loading ? 'Subiendo archivos y enviando (Puede tomar unos segundos)...' : 'Enviar Formulario Completo de Inscripción'}
          </button>
        </form>
      </div>
    </div>
  );
}
