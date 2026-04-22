import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

export default function Registro() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Create user doc
      // SEGURIDAD: Solo este correo será Administrador automáticamente. El resto será siempre 'padre'.
      const isAdmin = email.toLowerCase() === 'mpatojardel@gmail.com';
      
      await setDoc(doc(db, 'usuarios', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        nombre,
        telefono: '', // Hardcoded empty string to pass Firestore rules
        rol: isAdmin ? 'admin' : 'padre',
        creado_en: serverTimestamp()
      });
      navigate(isAdmin ? '/admin' : '/portal');
    } catch (err: any) {
      setError('Error al registrar: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-black uppercase tracking-tight text-slate-800">Crear Cuenta</h2>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mt-2">Registrate como padre/tutor</p>
        </div>
        
        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-md mb-4 text-xs font-bold uppercase">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Nombre Completo</label>
            <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Contraseña</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none" />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white p-3 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700 disabled:opacity-50 mt-2 transition-colors">
            {loading ? 'Registrando...' : 'Registrarme'}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] uppercase font-bold text-slate-500">
          ¿Ya tenés cuenta?{' '}
          <Link to="/login" className="text-purple-600 hover:text-purple-800 underline tracking-widest">
            Ingresá acá
          </Link>
        </div>
      </div>
    </div>
  );
}
