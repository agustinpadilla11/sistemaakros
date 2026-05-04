import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

interface Usuario {
  id: string;
  uid: string; // Alias for id used in components
  email: string;
  nombre: string;
  telefono: string;
  rol: 'admin' | 'padre';
  creado_en?: string;
}

interface AuthContextType {
  currentUser: User | null;
  userData: Usuario | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user.uid);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const fetchUserData = async (userId: string, retries = 3) => {
    try {
      const userDoc = await getDoc(doc(db, 'usuarios', userId));
      if (userDoc.exists()) {
        setUserData({ id: userDoc.id, uid: userDoc.id, ...userDoc.data() } as Usuario);
      } else if (retries > 0) {
        // El doc puede tardar un instante en estar disponible (ej: recién registrado)
        await new Promise(resolve => setTimeout(resolve, 800));
        return fetchUserData(userId, retries - 1);
      } else {
        console.error("No se encontró el documento del usuario en Firestore");
        setUserData(null);
      }
    } catch (err) {
      console.error("Error al obtener datos del usuario:", err);
      setUserData(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData, loading, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

