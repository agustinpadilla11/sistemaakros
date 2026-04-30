// =========================================================
// Akros — Shared TypeScript Types
// All Firestore entity interfaces in one place.
// =========================================================

import { Timestamp } from 'firebase/firestore';

// ----- Helpers -----
export type MetodoPago = 'efectivo' | 'debito' | 'transferencia' | 'mp' | 'Mercado Pago' | 'importacion' | 'otro';
export type EstadoCuota = 'pagado' | 'pendiente' | 'vencido';
export type EstadoAlumna = 'activa' | 'inactiva' | 'pendiente_aprobacion';
export type Rol = 'admin' | 'padre';

// ----- Core Entities -----

export interface Usuario {
  id: string;
  uid: string;
  email: string;
  nombre: string;
  telefono: string;
  rol: Rol;
  creado_en?: string | Timestamp;
}

export interface Alumna {
  id: string;
  nombre_completo: string;
  fecha_nacimiento: Timestamp;
  dni: string;
  estado: EstadoAlumna;
  creado_en: Timestamp;
  grupo_id?: string;
  foto_dni_url?: string;
  foto_apto_url?: string;
  fecha_apto_medico?: Timestamp;
  email_contacto?: string;
  importada?: boolean;
}

export interface Grupo {
  id: string;
  nombre: string;
  horario: string;
  descripcion: string;
}

export interface PadreAlumna {
  id: string;
  usuario_id: string;
  alumna_id: string;
  vinculado_en: Timestamp;
}

// ----- Financial Entities -----

export interface Cuota {
  id: string;
  alumna_id: string;
  mes: number;
  anio: number;
  monto: number;
  estado: EstadoCuota;
  fecha_pago?: Timestamp | null;
  metodo_pago?: string;
  metodo?: string;
  notas?: string;
}

export interface Egreso {
  id: string;
  concepto: string;
  monto: number;
  metodo: string;
  fecha: Timestamp;
}

export interface VentaMerch {
  id: string;
  producto_id?: string;
  nombre_producto?: string;
  alumna_nombre?: string;
  concepto?: string;
  prenda?: string;
  talle?: string;
  cantidad?: number;
  monto: number;
  metodo_pago?: string;
  metodo?: string;
  fecha: Timestamp;
  tipo?: string;
  estado_entrega?: string;
  observacion?: string;
}

export interface Producto {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  stock: number;
  imagen_url: string;
}

export interface OtroCosto {
  id: string;
  alumna_id: string;
  concepto: string;
  monto: number;
  estado: string;
  metodo_pago?: string;
  metodo?: string;
  fecha: Timestamp;
  notas?: string;
}

// ----- Module-specific Entities -----

export interface FederacionLicencia {
  id: string;
  alumna_nombre: string;
  monto: number;
  metodo: string;
  metodo_pago?: string;
  fecha: Timestamp;
}

export interface FederacionInscripcion {
  id: string;
  alumna_nombre: string;
  monto: number;
  metodo: string;
  metodo_pago?: string;
  fecha: Timestamp;
}

export interface Matricula {
  id: string;
  alumna_nombre: string;
  monto: number;
  metodo: string;
  metodo_pago?: string;
  fecha: Timestamp;
}

export interface Seguro {
  id: string;
  alumna_nombre: string;
  monto: number;
  metodo: string;
  metodo_pago?: string;
  fecha: Timestamp;
}

export interface TorneoPago {
  id: string;
  alumna_nombre: string;
  categoria?: string;
  monto: number;
  metodo: string;
  metodo_pago?: string;
  fecha: Timestamp;
}

export interface ArqueoData {
  fecha: Date;
  esperado: number;
  real: number;
  diferencia: number;
  usuario: string;
}

export interface CajaDoc {
  monto: number;
  fecha: Date;
}

export interface Baja {
  id: string;
  alumna_nombre: string;
  alumna_dni: string;
  grupo_nombre: string;
  grupo_horario: string;
  fecha: Timestamp;
}
