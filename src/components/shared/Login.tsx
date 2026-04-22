import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

export default function Login() {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (userData) {
      if (userData.rol === 'admin') navigate('/admin');
      else navigate('/portal');
    }
  }, [userData, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // navigation handled by AuthProvider state change
    } catch (err: any) {
      if (err.code === 'auth/network-request-failed') {
        setError('Error de red. Si estás usando un bloqueador de anuncios (como uBlock o Brave Shields), intenta desactivarlo para esta página. Firebase necesita conectarse a sus servidores.');
      } else {
        setError('Credenciales inválidas o error de red. ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (rol: 'admin' | 'padre') => {
    setLoading(true);
    setError('');
    const demoEmail = rol === 'admin' ? 'admin@akros.app' : 'padre@akros.app';
    const demoPass = 'akros123456';
    
    try {
      await signInWithEmailAndPassword(auth, demoEmail, demoPass);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        try {
          const cred = await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
          await setDoc(doc(db, 'usuarios', cred.user.uid), {
            uid: cred.user.uid,
            email: demoEmail,
            nombre: rol === 'admin' ? 'Admnistrador Prueba' : 'Padre Prueba',
            telefono: '00000000',
            rol: rol,
            creado_en: serverTimestamp()
          });
        } catch (createErr: any) {
           setError('Error generando cuenta de prueba: ' + createErr.message);
           setLoading(false);
        }
      } else {
        setError('Error accediendo a cuenta de prueba: ' + err.message);
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-slate-200 p-8">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Akros" className="h-16 w-auto mx-auto mb-2" />
        </div>
        
        {error && <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded-md mb-4 text-xs font-bold uppercase">{error}</div>}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Email</label>
            <input 
              type="email" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Contraseña</label>
            <input 
              type="password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-slate-200 rounded p-3 text-xs font-bold border focus:ring-purple-500 focus:border-purple-500 outline-none"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-purple-600 text-white p-3 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? 'Cargando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <div className="mt-6 text-center text-[10px] uppercase font-bold text-slate-500">
          ¿No tenés cuenta?{' '}
          <Link to="/registro" className="text-purple-600 hover:text-purple-800 underline tracking-widest">
            Registrate acá
          </Link>
        </div>
      </div>
    </div>
  );
}
