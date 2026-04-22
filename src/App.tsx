import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/shared/Login';
import Registro from './components/shared/Registro';
import { ProtectedRoute } from './components/shared/ProtectedRoute';
import { useAuth } from './hooks/useAuth';

import AdminLayout from './components/admin/AdminLayout';
import AdminDashboard from './components/admin/AdminDashboard';
import Alumnas from './components/admin/Alumnas';
import ImportarCSV from './components/admin/ImportarCSV';
import ImportarDocumentos from './components/admin/ImportarDocumentos';
import FichaAlumna from './components/admin/FichaAlumna';
import Grupos from './components/admin/Grupos';
import Cuotas from './components/admin/Cuotas';
import Merchandising from './components/admin/Merchandising';
import OtrosCostos from './components/admin/OtrosCostos';
import CajaDiaria from './components/admin/CajaDiaria';
import ImportarCaja from './components/admin/ImportarCaja';

import PortalPadreLayout from './components/padre/PortalPadreLayout';
import PortalPadre from './components/padre/PortalPadre';
import FichaHija from './components/padre/FichaHija';
import NuevaInscripcion from './components/padre/NuevaInscripcion';

export default function App() {
  const { userData, loading } = useAuth();

  if (loading) return null;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />
      
      {/* Route matching for / */}
      <Route path="/" element={
        userData ? (
          userData.rol === 'admin' ? <Navigate to="/admin" replace /> : <Navigate to="/portal" replace />
        ) : (
          <Navigate to="/login" replace />
        )
      } />

      {/* Admin routes */}
      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="alumnas" element={<Alumnas />} />
          <Route path="alumnas/importar" element={<ImportarCSV />} />
          <Route path="alumnas/importar-docs" element={<ImportarDocumentos />} />
          <Route path="alumnas/:id" element={<FichaAlumna />} />
          <Route path="grupos" element={<Grupos />} />
          <Route path="cuotas" element={<Cuotas />} />
          <Route path="merchandising" element={<Merchandising />} />
          <Route path="otros-costos" element={<OtrosCostos />} />
          <Route path="caja" element={<CajaDiaria />} />
          <Route path="caja/importar" element={<ImportarCaja />} />
        </Route>
      </Route>

      {/* Padre routes */}
      <Route element={<ProtectedRoute allowedRoles={['padre']} />}>
        <Route path="/portal" element={<PortalPadreLayout />}>
          <Route index element={<PortalPadre />} />
          <Route path="alumna/:id" element={<FichaHija />} />
          <Route path="inscripcion" element={<NuevaInscripcion />} />
        </Route>
      </Route>
    </Routes>
  );
}
