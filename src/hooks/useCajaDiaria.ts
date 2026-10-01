import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import * as XLSX from 'xlsx';
import type { Alumna, Producto, ArqueoData } from '../types';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Helper: get method from heterogeneous records
const getMetodo = (item: Record<string, any>): string =>
  (item.metodo_pago || item.metodo || 'efectivo').toString().toLowerCase();

const isEfectivo = (item: Record<string, any>) => getMetodo(item) === 'efectivo';
const isDebito = (item: Record<string, any>) => getMetodo(item) === 'debito';
const isTransf = (item: Record<string, any>) => {
  const m = getMetodo(item);
  return m === 'transferencia' || m === 'mp' || m === 'mercado pago' || m === 'mercado_pago' || m === 'transf cta pato' || m === 'transf cta ak';
};

const sumMonto = (items: Record<string, any>[]) => items.reduce((a, b) => a + (b.monto || 0), 0);

const toDate = (fecha: any): Date => {
  if (!fecha) return new Date(0);
  if (fecha.toDate) return fecha.toDate();
  return new Date(fecha);
};

export function useCajaDiaria() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // Data States
  const [cuotas, setCuotas] = useState<Record<string, any>[]>([]);
  const [otrosCostos, setOtrosCostos] = useState<Record<string, any>[]>([]);
  const [ventasMerch, setVentasMerch] = useState<Record<string, any>[]>([]);
  const [egresos, setEgresos] = useState<Record<string, any>[]>([]);
  const [comienzoCaja, setComienzoCaja] = useState<number>(0);

  // New income sources
  const [federacion, setFederacion] = useState<Record<string, any>[]>([]);
  
  const [matriculas, setMatriculas] = useState<Record<string, any>[]>([]);
  const [seguros, setSeguros] = useState<Record<string, any>[]>([]);
  const [torneosPagos, setTorneosPagos] = useState<Record<string, any>[]>([]);

  // Config
  const [alumnas, setAlumnas] = useState<Record<string, any>[]>([]);
  const [productos, setProductos] = useState<Record<string, any>[]>([]);

  // POS State
  const [posTab, setPosTab] = useState<'cuota'|'merch'|'otro'>('cuota');
  const [cuotaForm, setCuotaForm] = useState({ alumna_id: '', mes: (new Date().getMonth()+1).toString(), monto: '', metodo_pago: 'efectivo' });
  const [merchForm, setMerchForm] = useState({ producto_id: '', cantidad: 1, monto: '', metodo_pago: 'efectivo' });
  const [otroForm, setOtroForm] = useState({ alumna_id: '', concepto: '', monto: '', metodo_pago: 'efectivo' });
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchCuota, setSearchCuota] = useState('');
  const [searchMerch, setSearchMerch] = useState('');
  const [searchOtro, setSearchOtro] = useState('');

  // Egreso / Caja / Arqueo UI state
  const [nuevoComienzo, setNuevoComienzo] = useState('');
  const [showEgreso, setShowEgreso] = useState(false);
  const [egresoForm, setEgresoForm] = useState({ concepto: '', monto: '', metodo: 'efectivo' });
  const [cajaFormOpen, setCajaFormOpen] = useState(false);
  const [showArqueo, setShowArqueo] = useState(false);
  const [efectivoReal, setEfectivoReal] = useState('');
  const [entregadoDuena, setEntregadoDuena] = useState('');
  const [arqueoData, setArqueoData] = useState<ArqueoData | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Derived Dates
  const dateStr = currentDate.toISOString().split('T')[0];
  const startOfDay = new Date(currentDate); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(currentDate); endOfDay.setHours(23,59,59,999);
  const startOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth(), 1);
  const endOfMonth = new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0, 23, 59, 59, 999);

  // ---------- DATA LOADING ----------
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const monthPrefix = `${currentDate.getFullYear()}-${(currentDate.getMonth()+1).toString().padStart(2, '0')}`;
      const cajaSnap = await getDocs(query(collection(db, 'cajas')));
      
      const cuotasSnap = await getDocs(query(collection(db, 'cuotas'), where('estado', '==', 'pagado')));
      const otrosSnap = await getDocs(query(collection(db, 'otros_costos'), where('estado', '==', 'pagado')));
      const ventasSnap = await getDocs(collection(db, 'ventas_merch'));
      const egresosSnap = await getDocs(collection(db, 'egresos'));
      const arqueoSnap = await getDocs(collection(db, 'arqueos'));
      
      
      const matSnap = await getDocs(collection(db, 'matriculas'));
      const segSnap = await getDocs(collection(db, 'seguros'));
      const torSnap = await getDocs(collection(db, 'torneos_pagos'));

      // Helper to sum for a specific date
      const getEfvoForDate = (dStr: string) => {
         const yDate = new Date(dStr + "T12:00:00");
         const yStart = new Date(yDate); yStart.setHours(0,0,0,0);
         const yEnd = new Date(yDate); yEnd.setHours(23,59,59,999);
         
         const isY = (d: any) => {
            if (!d) return false;
            const t = d.toDate ? d.toDate() : new Date(d);
            return t >= yStart && t <= yEnd;
         };
         
         let sumIn = 0;
         cuotasSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha_pago) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumIn += (d.monto||0));
         otrosSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumIn += (d.monto||0));
         ventasSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumIn += (d.monto||0));
         
         matSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumIn += (d.monto||0));
         segSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumIn += (d.monto||0));
         torSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumIn += (d.monto||0));
         
         let sumOut = 0;
         egresosSnap.docs.map(d=>d.data()).filter(d => isY(d.fecha) && (d.metodo_pago || d.metodo || 'efectivo') === 'efectivo').forEach(d => sumOut += (d.monto||0));
         
         return { sumIn, sumOut };
      };

      const allCajasMap = cajaSnap.docs.reduce((acc: any, d) => ({...acc, [d.id]: d.data().monto}), {});
      const allArqueosMap = arqueoSnap.docs.reduce((acc: any, d) => {
        const data = d.data();
        const dateKey = data.fecha_str || d.id.split('_')[0];
        return { ...acc, [dateKey]: (acc[dateKey] || 0) + (data.entregado_duena || 0) };
      }, {});

      let currentCheckDate = new Date(currentDate);
      let foundManual = false;
      let calculatedBalance = 0;
      let daysBack = 0;

      // Iteramos hacia atrás buscando la última caja manual (max 30 días)
      const balancesToAdd: any[] = [];
      while (daysBack < 30) {
        const checkStr = currentCheckDate.toISOString().split('T')[0];
        
        if (allCajasMap[checkStr] !== undefined) {
           calculatedBalance = allCajasMap[checkStr];
           foundManual = true;
           break;
        } else {
           balancesToAdd.unshift(checkStr); // Agregamos al principio para calcular en orden
        }
        
        currentCheckDate.setDate(currentCheckDate.getDate() - 1);
        daysBack++;
      }

      if (foundManual && balancesToAdd.length > 0) {
        // Calcular el saldo progresivamente hasta hoy
        for (const bStr of balancesToAdd) {
           if (bStr === dateStr) break; // No sumamos los de hoy porque esos forman parte del día
           const prevStr = new Date(new Date(bStr + "T12:00:00").getTime() - 86400000).toISOString().split('T')[0];
           const { sumIn, sumOut } = getEfvoForDate(prevStr);
           const entregado = allArqueosMap[prevStr] || 0;
           calculatedBalance = calculatedBalance + sumIn - sumOut - entregado;
        }
        // Si hoy no tiene caja manual, será el balance calculado
        if (allCajasMap[dateStr] === undefined) {
           const yStr = new Date(currentDate.getTime() - 86400000).toISOString().split('T')[0];
           const { sumIn, sumOut } = getEfvoForDate(yStr);
           const entregado = allArqueosMap[yStr] || 0;
           setComienzoCaja(calculatedBalance + sumIn - sumOut - entregado);
        } else {
           setComienzoCaja(allCajasMap[dateStr]);
        }
      } else {
        setComienzoCaja(allCajasMap[dateStr] || 0);
      }

      setCuotas(cuotasSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((c: any) => {
          const d = toDate(c.fecha_pago);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      setOtrosCostos(otrosSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((c: any) => {
          const d = toDate(c.fecha);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      setVentasMerch(ventasSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((v: any) => {
          const d = toDate(v.fecha);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      setEgresos(egresosSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((e: any) => {
          const d = toDate(e.fecha);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      const dayArqueos = arqueoSnap.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(a => (a.fecha_str || a.id.split('_')[0]) === dateStr)
        .sort((a, b) => {
           const timeA = a.fecha?.toMillis ? a.fecha.toMillis() : 0;
           const timeB = b.fecha?.toMillis ? b.fecha.toMillis() : 0;
           return timeA - timeB;
        });
        
      if (dayArqueos.length > 0) {
        const lastArqueo = dayArqueos[dayArqueos.length - 1];
        const totalEntregado = dayArqueos.reduce((sum, curr) => sum + (curr.entregado_duena || 0), 0);
        setArqueoData({ ...lastArqueo, entregado_duena: totalEntregado } as ArqueoData);
      } else {
        setArqueoData(null);
      }

      const filterByMonth = (docs: any[]) => docs.filter((x: any) => {
        const d = toDate(x.fecha);
        return d >= startOfMonth && d <= endOfMonth;
      });

      const allTor = torSnap.docs.map(d => ({id: d.id, ...d.data()}));
      setFederacion(filterByMonth(allTor.filter(t => t.tipo === 'federacion')));
      setMatriculas(filterByMonth(matSnap.docs.map(d => ({id: d.id, ...d.data()}))));
      setSeguros(filterByMonth(segSnap.docs.map(d => ({id: d.id, ...d.data()}))));
      setTorneosPagos(filterByMonth(allTor.filter(t => t.tipo !== 'federacion')));

      const alSnap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(alSnap.docs.map(d => ({id: d.id, ...d.data()} as any)).filter((a: any) => a.estado !== 'inactiva'));
      const prSnap = await getDocs(collection(db, 'productos'));
      setProductos(prSnap.docs.map(d => ({id: d.id, ...d.data()} as any)).filter((p: any) => p.stock > 0));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [dateStr, currentMonthDate]);

  useEffect(() => { loadData(); }, [loadData]);

  // ---------- NAVIGATION ----------
  const changeDay = (days: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + days);
    setCurrentDate(d);
    setCurrentMonthDate(new Date(d));
  };

  const changeMonth = (months: number) => {
    const m = new Date(currentMonthDate);
    m.setMonth(m.getMonth() + months);
    setCurrentMonthDate(m);
  };

  // ---------- POS ACTIONS ----------
  const handlePOSCuota = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const { alumna_id, monto, mes, metodo_pago } = cuotaForm;
    
    if (!alumna_id) {
      alert('Por favor, selecciona una gimnasta de la lista desplegable.');
      return;
    }
    if (!monto || Number(monto) <= 0) {
      alert('Por favor, ingresa un monto válido.');
      return;
    }

    setIsProcessing(true);
    try {
      console.log('Iniciando cobro POS:', { alumna_id, monto, mes, metodo_pago });
      
      const mesNum = Number(mes);
      const year = currentDate.getFullYear();
      
      const parsedMonto = typeof monto === 'string'
        ? parseFloat(monto.replace(',', '.'))
        : Number(monto);

      const payload = {
        estado: 'pagado',
        monto: parsedMonto || 0,
        metodo_pago: metodo_pago,
        fecha_pago: serverTimestamp(),
        notas: 'Cobro rápido desde Mostrador (Caja Diaria)',
        actualizado_el: serverTimestamp()
      };

      // 1. Check if fee already exists for this gymnast/month/year
      const cuotasRef = collection(db, 'cuotas');
      const q = query(
        cuotasRef, 
        where('alumna_id', '==', alumna_id), 
        where('mes', '==', mesNum), 
        where('anio', '==', year)
      );
      const qSnap = await getDocs(q);

      if (!qSnap.empty) {
        const cuotaDoc = qSnap.docs[0];
        console.log('Actualizando cuota existente:', cuotaDoc.id);
        await updateDoc(doc(db, 'cuotas', cuotaDoc.id), payload);
      } else {
        const newRef = doc(cuotasRef);
        await setDoc(newRef, {
          id: newRef.id,
          alumna_id,
          mes: mesNum,
          anio: year,
          ...payload,
          creado_el: serverTimestamp()
        });
        console.log('Nueva cuota creada:', newRef.id);
      }

      // Success
      setCuotaForm({ ...cuotaForm, alumna_id: '', monto: '' });
      setSearchCuota('');
      await loadData();
      showToast('Cuota cargada con éxito');
    } catch (err) {
      console.error('Error en handlePOSCuota:', err);
      alert('Error al registrar el cobro: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePOSMerch = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const { metodo_pago, monto } = merchForm;
    
    setIsProcessing(true);
    try {
      const total = Number(monto);
      if (total <= 0) {
        alert('Por favor, ingresa un monto válido.');
        setIsProcessing(false);
        return;
      }

      const ventaRef = doc(collection(db, 'ventas_merch'));
      
      await setDoc(ventaRef, {
        id: ventaRef.id,
        nombre_producto: 'VENTA KIOSKO',
        monto: total,
        metodo_pago,
        fecha: serverTimestamp(),
        tipo: 'kiosko',
        creado_el: serverTimestamp(),
        actualizado_el: serverTimestamp()
      });

      setMerchForm({ producto_id: '', cantidad: 1, monto: '', metodo_pago: 'efectivo' });
      await loadData();
      showToast('Venta cargada con éxito');
    } catch (err) {
      console.error('Error en handlePOSMerch:', err);
      alert('Error al registrar la venta: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePOSOtro = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    const { alumna_id, concepto, monto, metodo_pago } = otroForm;
    if (!concepto || !monto) return;

    setIsProcessing(true);
    try {
      const parsedMonto = typeof monto === 'string'
        ? parseFloat(monto.replace(',', '.'))
        : Number(monto);

      const lowerConcepto = concepto.toLowerCase();
      let collectionName = 'otros_costos';
      let docData: any = {
        alumna_id,
        concepto: concepto.toUpperCase(),
        monto: parsedMonto || 0,
        estado: 'pagado',
        metodo_pago,
        fecha: serverTimestamp(),
        notas: 'Ingreso rápido desde Mostrador'
      };

      if (lowerConcepto.includes('matricula') || lowerConcepto.includes('matrícula')) {
        collectionName = 'matriculas';
        const alu = alumnas.find(a => a.id === alumna_id);
        docData = {
          alumna_nombre: alu ? alu.nombre_completo : '',
          monto: parsedMonto || 0,
          fecha: serverTimestamp(),
          metodo: metodo_pago,
        };
      } else if (lowerConcepto.includes('seguro')) {
        collectionName = 'seguros';
        const alu = alumnas.find(a => a.id === alumna_id);
        docData = {
          alumna_nombre: alu ? alu.nombre_completo : '',
          monto: parsedMonto || 0,
          fecha: serverTimestamp(),
          metodo: metodo_pago,
        };
      }

      const newRef = doc(collection(db, collectionName));
      await setDoc(newRef, {
        id: newRef.id,
        ...docData
      });
      
      setOtroForm({ alumna_id: '', concepto: '', monto: '', metodo_pago: 'efectivo' });
      setSearchOtro('');
      await loadData();
      showToast('Ingreso extra cargado con éxito');
    } catch (err) {
      console.error(err);
      alert('Error al registrar ingreso extra');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- SAVE ACTIONS ----------
  const handleSaveEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!egresoForm.concepto || !egresoForm.monto) return;
    
    try {
      const ref = doc(collection(db, 'egresos'));
      await setDoc(ref, {
        concepto: egresoForm.concepto.toUpperCase(),
        monto: Number(egresoForm.monto),
        metodo: egresoForm.metodo,
        fecha: serverTimestamp()
      });
      setShowEgreso(false);
      setEgresoForm({ concepto: '', monto: '', metodo: 'efectivo' });
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al guardar egreso');
    }
  };

  const handleUpdateCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'cajas', dateStr), {
        monto: Number(nuevoComienzo),
        fecha: serverTimestamp()
      });
      setCajaFormOpen(false);
      await loadData();
    } catch(err) {
      console.error(err);
      alert('Error al actualizar inicio de caja');
    }
  };

  const deleteEgreso = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar este registro de egreso?')) return;
    try {
      await deleteDoc(doc(db, 'egresos', id));
      await loadData();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  const deleteIngreso = async (id: string, collectionName: string, extraData?: { producto_id?: string, cantidad?: number }) => {
    if (!window.confirm('¿Seguro que deseas eliminar este registro de ingreso?')) return;
    try {
      if (collectionName === 'ventas_merch' && extraData?.producto_id && extraData?.cantidad) {
        await updateDoc(doc(db, 'productos', extraData.producto_id), {
          stock: increment(extraData.cantidad)
        });
      }
      await deleteDoc(doc(db, collectionName, id));
      await loadData();
      alert('Registro de ingreso eliminado correctamente.');
    } catch (err) {
      console.error(err);
      alert('Error al eliminar ingreso: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    }
  };

  const handleArqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const realNum = Number(efectivoReal);
      const entregadoNum = Number(entregadoDuena);
      const quedoNum = realNum - entregadoNum;
      const esperadoAntesEntrega = comienzoCaja + totalIngEfvoHoy - sumMonto(egresosHoy.filter(isEfectivo));

      const data: any = {
        fecha: serverTimestamp() as any,
        fecha_str: dateStr,
        esperado: esperadoAntesEntrega,
        real: realNum,
        entregado_duena: entregadoNum,
        quedo_caja: quedoNum,
        diferencia: realNum - esperadoAntesEntrega,
        usuario: 'Administración'
      };
      await setDoc(doc(db, 'arqueos', `${dateStr}_${Date.now()}`), data);
      await loadData();
      setShowArqueo(false);
      setEfectivoReal('');
      setEntregadoDuena('');
      showToast('Arqueo de caja guardado con éxito');
    } catch (err) {
      console.error(err);
      alert('Error al guardar arqueo');
    }
  };

  const clearArqueo = async () => {
    if (!window.confirm('¿Seguro que deseas eliminar los arqueos de hoy?')) return;
    try {
      const arqueoSnap = await getDocs(collection(db, 'arqueos'));
      const toDelete = arqueoSnap.docs.filter(d => (d.data().fecha_str || d.id.split('_')[0]) === dateStr);
      for (const d of toDelete) {
        await deleteDoc(doc(db, 'arqueos', d.id));
      }
      setArqueoData(null);
      setEfectivoReal('');
      setEntregadoDuena('');
      showToast('Arqueo eliminado con éxito');
    } catch (err) {
      console.error(err);
      alert('Error al eliminar arqueo');
    }
  };

  // ---------- DAILY CALCULATIONS ----------
  const isSameDay = (d: Date) => {
    return d.getFullYear() === currentDate.getFullYear() &&
           d.getMonth() === currentDate.getMonth() &&
           d.getDate() === currentDate.getDate();
  };

  const cuotasHoy = cuotas.filter(c => isSameDay(toDate(c.fecha_pago)));
  const otrosHoy = otrosCostos.filter(c => isSameDay(toDate(c.fecha)));
  const merchHoy = ventasMerch.filter(v => isSameDay(toDate(v.fecha)));
  const federacionHoy = federacion.filter(l => isSameDay(toDate(l.fecha)));
  
  const matriculasHoy = matriculas.filter(m => isSameDay(toDate(m.fecha)));
  const segurosHoy = seguros.filter(s => isSameDay(toDate(s.fecha)));
  const torneosPagosHoy = torneosPagos.filter(t => isSameDay(toDate(t.fecha)));
  const egresosHoy = egresos.filter(e => isSameDay(toDate(e.fecha)));

  const rawAllDayItems = [
    ...cuotasHoy.map(x => ({ ...x, _type: 'cuota' as const })),
    ...otrosHoy.map(x => ({ ...x, _type: 'otro' as const })),
    ...merchHoy.map(x => ({ ...x, _type: 'merch' as const })),
    ...federacionHoy.map(x => ({ ...x, _type: 'federacion' as const })),
    
    ...matriculasHoy.map(x => ({ ...x, _type: 'matricula' as const })),
    ...segurosHoy.map(x => ({ ...x, _type: 'seguro' as const })),
    ...torneosPagosHoy.map(x => ({ ...x, _type: 'torneo' as const })),
  ];

  const allDayItems = [...rawAllDayItems].sort((a: any, b: any) => {
    const timeA = (a.actualizado_el || a.creado_el || a.fecha_pago || a.fecha) ? toDate(a.actualizado_el || a.creado_el || a.fecha_pago || a.fecha).getTime() : 0;
    const timeB = (b.actualizado_el || b.creado_el || b.fecha_pago || b.fecha) ? toDate(b.actualizado_el || b.creado_el || b.fecha_pago || b.fecha).getTime() : 0;
    return timeB - timeA; // Más reciente arriba, más antiguo abajo
  });

  const totalIngEfvoHoy = sumMonto(allDayItems.filter(isEfectivo));
  const ingDebitoHoy = sumMonto(allDayItems.filter(isDebito));
  const ingTransfHoy = sumMonto(allDayItems.filter(isTransf));
  const totalIngresosGralHoy = totalIngEfvoHoy + ingDebitoHoy + ingTransfHoy;
  const totalEgresosGralHoy = sumMonto(egresosHoy);

  const egresosEfvoHoy = egresosHoy.filter(isEfectivo);
  const totalEgresosEfvoHoy = sumMonto(egresosEfvoHoy);
  const entregadoDuenaHoy = arqueoData?.entregado_duena || 0;

  // Evitar duplicación si la entrega a dueña ya fue registrada como egreso explícito
  const alreadyInEgresos = entregadoDuenaHoy > 0 && egresosEfvoHoy.some(e =>
    (e.concepto?.toLowerCase().includes('dueña') || e.concepto?.toLowerCase().includes('duena') || e.concepto?.toLowerCase().includes('retiro')) &&
    Number(e.monto) === Number(entregadoDuenaHoy)
  );

  const totalRetirosSalidasEfvoHoy = totalEgresosEfvoHoy + (alreadyInEgresos ? 0 : entregadoDuenaHoy);
  // Saldo Actual en Caja = (Comienzo Caja) - (Total Retiros / Salidas / Entregas de Efectivo a dueña) + (Ingresos en Efectivo de ventas/cobros)
  const saldoActualCaja = comienzoCaja - totalRetirosSalidasEfvoHoy + totalIngEfvoHoy;

  const cajaFinalEfvo = saldoActualCaja;
  const cajaFinalDebito = ingDebitoHoy - sumMonto(egresosHoy.filter(isDebito));
  const cajaFinalTransf = ingTransfHoy - sumMonto(egresosHoy.filter(isTransf));
  const totalFinalTodo = comienzoCaja + totalIngresosGralHoy - totalEgresosGralHoy - (alreadyInEgresos ? 0 : entregadoDuenaHoy);

  // ---------- MONTHLY CALCULATIONS ----------
  const allMonthItems = [...cuotas, ...otrosCostos, ...ventasMerch, ...federacion, ...matriculas, ...seguros, ...torneosPagos];

  const totCuotasEfvoMes = sumMonto(cuotas.filter(c => getMetodo(c) === 'efectivo'));
  const totOtrosEfvoMes = sumMonto([...otrosCostos, ...ventasMerch, ...federacion, ...matriculas, ...seguros, ...torneosPagos].filter(isEfectivo));
  const totDebitoMes = sumMonto(allMonthItems.filter(isDebito));
  const totTransfMes = sumMonto(allMonthItems.filter(isTransf));
  const totEgresosMes = sumMonto(egresos);
  const totFinalMes = (comienzoCaja + sumMonto(allMonthItems)) - totEgresosMes;

  // ---------- ADMINISTRATIVE RESET ----------
  const resetDailyData = async () => {
    if (!window.confirm('¿Estás seguro de que deseas ELIMINAR TODOS los movimientos de caja de hoy? Esto no se puede deshacer.')) {
      return;
    }
    
    setIsProcessing(true);
    try {
      const deletePromises: Promise<void>[] = [];
      
      const allItemsToDelete = [
        ...cuotasHoy.map(i => ({ id: i.id, collection: 'cuotas' })),
        ...otrosHoy.map(i => ({ id: i.id, collection: 'otros_costos' })),
        ...merchHoy.map(i => ({ id: i.id, collection: 'ventas_merch' })),
        ...federacionHoy.map(i => ({ id: i.id, collection: 'torneos_pagos' })),
        ...matriculasHoy.map(i => ({ id: i.id, collection: 'matriculas' })),
        ...segurosHoy.map(i => ({ id: i.id, collection: 'seguros' })),
        ...torneosPagosHoy.map(i => ({ id: i.id, collection: 'torneos_pagos' })),
        ...egresosHoy.map(i => ({ id: i.id, collection: 'egresos' })),
      ];

      const dateStr = currentDate.toISOString().split('T')[0];

      for (const item of allItemsToDelete) {
        if (item.id) {
          if (item.collection === 'torneos_pagos') {
            deletePromises.push(updateDoc(doc(db, item.collection, item.id), { monto: 0, fecha: null }));
          } else {
            deletePromises.push(deleteDoc(doc(db, item.collection, item.id)));
          }
        }
      }

      await Promise.all(deletePromises);
      
      if (arqueoData) {
        await deleteDoc(doc(db, 'arqueos', dateStr));
        setArqueoData(null);
      }

      await loadData();
      alert('¡Los datos del día de hoy han sido restablecidos a cero!');
    } catch (err) {
      console.error('Error resetting daily data:', err);
      alert('Hubo un error al intentar borrar los datos de hoy.');
    } finally {
      setIsProcessing(false);
    }
  };

  // ---------- EXCEL EXPORT ----------
  const exportToExcel = () => {
    const dataIngresos = [
      ...cuotas.map(c => ({ Fecha: toDate(c.fecha_pago).toLocaleDateString('es-AR'), Tipo: 'CUOTA', Metodo: getMetodo(c).toUpperCase(), Monto: c.monto, Concepto: `MES ${c.mes}/${c.anio}`, Gimnasta: alumnas.find(a => a.id === c.alumna_id)?.nombre_completo || 'N/A' })),
      ...otrosCostos.map(o => ({ Fecha: toDate(o.fecha).toLocaleDateString('es-AR'), Tipo: 'OTRO', Metodo: getMetodo(o).toUpperCase(), Monto: o.monto, Concepto: (o.concepto || '').toUpperCase(), Gimnasta: alumnas.find(a => a.id === o.alumna_id)?.nombre_completo || 'N/A' })),
      ...ventasMerch.map(v => ({ Fecha: toDate(v.fecha).toLocaleDateString('es-AR'), Tipo: 'INDUMENTARIA/KIOSKO', Metodo: getMetodo(v).toUpperCase(), Monto: v.monto, Concepto: (v.nombre_producto || v.concepto || '').toUpperCase(), Gimnasta: 'VENTA MOSTRADOR' })),
      ...federacion.map(l => ({ Fecha: toDate(l.fecha).toLocaleDateString('es-AR'), Tipo: 'FEDERACION', Metodo: getMetodo(l).toUpperCase(), Monto: l.monto, Concepto: 'FEDERACION', Gimnasta: (l.alumna_nombre || '').toUpperCase() })),
      ...matriculas.map(m => ({ Fecha: toDate(m.fecha).toLocaleDateString('es-AR'), Tipo: 'INSCRIPCION', Metodo: getMetodo(m).toUpperCase(), Monto: m.monto, Concepto: 'PAGO INSCRIPCION ANUAL', Gimnasta: (m.alumna_nombre || '').toUpperCase() })),
      ...seguros.map(s => ({ Fecha: toDate(s.fecha).toLocaleDateString('es-AR'), Tipo: 'SEGURO', Metodo: getMetodo(s).toUpperCase(), Monto: s.monto, Concepto: 'PAGO SEGURO', Gimnasta: (s.alumna_nombre || '').toUpperCase() })),
      ...torneosPagos.map(t => ({ Fecha: toDate(t.fecha).toLocaleDateString('es-AR'), Tipo: 'TORNEO INTERNO', Metodo: getMetodo(t).toUpperCase(), Monto: t.monto, Concepto: (t.categoria || 'TORNEO').toUpperCase(), Gimnasta: (t.alumna_nombre || '').toUpperCase() })),
    ];
    dataIngresos.sort((a, b) => { 
      const pA = a.Fecha.split('/'); 
      const pB = b.Fecha.split('/'); 
      return new Date(+pA[2],+pA[1]-1,+pA[0]).getTime() - new Date(+pB[2],+pB[1]-1,+pB[0]).getTime(); 
    });

    const dataEgresos = egresos.map(e => ({ Fecha: toDate(e.fecha).toLocaleDateString('es-AR'), Concepto: e.concepto.toUpperCase(), Metodo: e.metodo.toUpperCase(), Monto: e.monto }));
    
    const tE = sumMonto(dataIngresos.filter(i => i.Metodo === 'EFECTIVO'));
    const tD = sumMonto(dataIngresos.filter(i => i.Metodo === 'DEBITO'));
    const tT = sumMonto(dataIngresos.filter(i => i.Metodo === 'TRANSFERENCIA' || i.Metodo === 'MP' || i.Metodo === 'MERCADO PAGO'));
    const tEgr = dataEgresos.reduce((a,b) => a + b.Monto, 0);

    const dataResumen = [
      { Categoria: 'INGRESOS EFECTIVO', Monto: tE },
      { Categoria: 'INGRESOS DEBITO', Monto: tD },
      { Categoria: 'INGRESOS TRANSFERENCIA/MP', Monto: tT },
      { Categoria: '', Monto: '' },
      { Categoria: 'TOTAL INGRESOS', Monto: tE + tD + tT },
      { Categoria: 'TOTAL EGRESOS (SE SACO DE CAJA)', Monto: tEgr },
      { Categoria: '', Monto: '' },
      { Categoria: 'BALANCE NETO', Monto: (tE + tD + tT) - tEgr }
    ];

    const wb = XLSX.utils.book_new();
    
    const formatSheet = (ws: any) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cell = ws[XLSX.utils.encode_cell({c: C, r: R})];
          if (cell && cell.t === 'n') cell.z = '"$"#,##0.00';
        }
      }
      return ws;
    };

    const wsIng = XLSX.utils.json_to_sheet(dataIngresos);
    wsIng['!cols'] = [{wch:12},{wch:25},{wch:15},{wch:15},{wch:30},{wch:35}];
    formatSheet(wsIng);

    const wsEgr = XLSX.utils.json_to_sheet(dataEgresos);
    wsEgr['!cols'] = [{wch:12},{wch:30},{wch:15},{wch:15}];
    formatSheet(wsEgr);

    const wsRes = XLSX.utils.json_to_sheet(dataResumen);
    wsRes['!cols'] = [{wch:40},{wch:20}];
    formatSheet(wsRes);

    XLSX.utils.book_append_sheet(wb, wsRes, "Resumen Mensual");
    XLSX.utils.book_append_sheet(wb, wsIng, "Detalle Ingresos");
    XLSX.utils.book_append_sheet(wb, wsEgr, "Detalle Egresos");
    XLSX.writeFile(wb, `Caja_Akros_${MESES[currentMonthDate.getMonth()]}_${currentMonthDate.getFullYear()}.xlsx`);
  };

  const formatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

  return {
    // Navigation
    currentDate, currentMonthDate, changeDay, changeMonth, dateStr,
    // Loading
    loading,
    // Data
    cuotas, otrosCostos, ventasMerch, egresos, comienzoCaja,
    federacion, matriculas, seguros, torneosPagos,
    alumnas, productos,
    // POS
    posTab, setPosTab,
    cuotaForm, setCuotaForm, merchForm, setMerchForm, otroForm, setOtroForm,
    isProcessing, searchCuota, setSearchCuota, searchMerch, setSearchMerch, searchOtro, setSearchOtro,
    handlePOSCuota, handlePOSMerch, handlePOSOtro,
    // Egreso / Caja / Arqueo
    showEgreso, setShowEgreso, egresoForm, setEgresoForm, handleSaveEgreso,
    cajaFormOpen, setCajaFormOpen, nuevoComienzo, setNuevoComienzo, handleUpdateCaja,
    showArqueo, setShowArqueo, efectivoReal, setEfectivoReal, entregadoDuena, setEntregadoDuena, arqueoData, handleArqueo, clearArqueo, toast,
    deleteEgreso, deleteIngreso,
    // Daily calcs
    cuotasHoy, otrosHoy, merchHoy, federacionHoy,
    matriculasHoy, segurosHoy, torneosPagosHoy, egresosHoy,
    allDayItems, allMonthItems,
    totalIngEfvoHoy, ingDebitoHoy, ingTransfHoy,
    totalIngresosGralHoy, totalEgresosGralHoy,
    totalRetirosSalidasEfvoHoy, saldoActualCaja,
    cajaFinalEfvo, cajaFinalDebito, cajaFinalTransf, totalFinalTodo,
    // Monthly calcs
    totCuotasEfvoMes, totOtrosEfvoMes, totDebitoMes, totTransfMes, totEgresosMes, totFinalMes,
    // Utils
    formatter, exportToExcel, MESES, resetDailyData
  };
}
