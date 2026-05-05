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
  return m === 'transferencia';
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
  const [licencias, setLicencias] = useState<Record<string, any>[]>([]);
  const [inscripcionesFed, setInscripcionesFed] = useState<Record<string, any>[]>([]);
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
  const [arqueoData, setArqueoData] = useState<ArqueoData | null>(null);

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
      const cajaDoc = cajaSnap.docs.find(d => d.id === dateStr);
      setComienzoCaja(cajaDoc ? cajaDoc.data().monto : 0);

      const cuotasSnap = await getDocs(query(collection(db, 'cuotas'), where('estado', '==', 'pagado')));
      setCuotas(cuotasSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((c: any) => {
          const d = toDate(c.fecha_pago);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      const otrosSnap = await getDocs(query(collection(db, 'otros_costos'), where('estado', '==', 'pagado')));
      setOtrosCostos(otrosSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((c: any) => {
          const d = toDate(c.fecha);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      const ventasSnap = await getDocs(collection(db, 'ventas_merch'));
      setVentasMerch(ventasSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((v: any) => {
          const d = toDate(v.fecha);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      const egresosSnap = await getDocs(collection(db, 'egresos'));
      setEgresos(egresosSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((e: any) => {
          const d = toDate(e.fecha);
          return d >= startOfMonth && d <= endOfMonth;
        }));

      const arqueoSnap = await getDocs(collection(db, 'arqueos'));
      const dayArqueo = arqueoSnap.docs.find(d => d.id === dateStr);
      setArqueoData(dayArqueo ? dayArqueo.data() as ArqueoData : null);

      // Fetch module-specific income
      const filterByMonth = (docs: any[]) => docs.filter((x: any) => {
        const d = toDate(x.fecha);
        return d >= startOfMonth && d <= endOfMonth;
      });

      const licSnap = await getDocs(collection(db, 'federacion_licencias'));
      setLicencias(filterByMonth(licSnap.docs.map(d => ({id: d.id, ...d.data()}))));

      const insSnap = await getDocs(collection(db, 'federacion_inscripciones'));
      setInscripcionesFed(filterByMonth(insSnap.docs.map(d => ({id: d.id, ...d.data()}))));

      const matSnap = await getDocs(collection(db, 'matriculas'));
      setMatriculas(filterByMonth(matSnap.docs.map(d => ({id: d.id, ...d.data()}))));

      const segSnap = await getDocs(collection(db, 'seguros'));
      setSeguros(filterByMonth(segSnap.docs.map(d => ({id: d.id, ...d.data()}))));

      const torSnap = await getDocs(collection(db, 'torneos_pagos'));
      setTorneosPagos(filterByMonth(torSnap.docs.map(d => ({id: d.id, ...d.data()}))));

      const alSnap = await getDocs(collection(db, 'alumnas'));
      setAlumnas(alSnap.docs.map(d => ({id: d.id, ...d.data()} as any)));
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
      alert('¡Cobro registrado con éxito!');
    } catch (err) {
      console.error('Error en handlePOSCuota:', err);
      alert('Error al registrar el cobro: ' + (err instanceof Error ? err.message : 'Error desconocido'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePOSMerch = async (e: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const { producto_id, cantidad, metodo_pago } = merchForm;
    
    if (!producto_id) {
      alert('Por favor, selecciona un producto.');
      return;
    }
    if (!cantidad || cantidad <= 0) {
      alert('La cantidad debe ser mayor a 0.');
      return;
    }

    setIsProcessing(true);
    try {
      const prod = productos.find(p => p.id === producto_id);
      if (!prod) throw new Error('Producto no encontrado en el inventario.');
      
      if (prod.stock < cantidad) {
        if (!confirm(`Stock insuficiente (${prod.stock}). ¿Deseas continuar con la venta de todos modos?`)) {
          setIsProcessing(false);
          return;
        }
      }

      const total = Number(merchForm.monto) > 0 ? Number(merchForm.monto) : Number(prod.precio) * cantidad;
      const ventaRef = doc(collection(db, 'ventas_merch'));
      
      await setDoc(ventaRef, {
        id: ventaRef.id,
        producto_id,
        nombre_producto: prod.nombre,
        cantidad,
        monto: total,
        metodo_pago,
        fecha: serverTimestamp(),
        tipo: 'kiosko',
        creado_el: serverTimestamp()
      });

      // Update stock
      await updateDoc(doc(db, 'productos', producto_id), {
        stock: increment(-cantidad)
      });

      setMerchForm({ producto_id: '', cantidad: 1, monto: '', metodo_pago: 'efectivo' });
      setSearchMerch('');
      await loadData();
      alert('¡Venta realizada con éxito!');
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

      const newRef = doc(collection(db, 'otros_costos'));
      await setDoc(newRef, {
        id: newRef.id,
        alumna_id,
        concepto: concepto.toUpperCase(),
        monto: parsedMonto || 0,
        estado: 'pagado',
        metodo_pago,
        fecha: serverTimestamp(),
        notas: 'Ingreso rápido desde Mostrador'
      });
      
      setOtroForm({ alumna_id: '', concepto: '', monto: '', metodo_pago: 'efectivo' });
      setSearchOtro('');
      await loadData();
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

  const handleArqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: ArqueoData = {
        fecha: serverTimestamp() as any,
        esperado: cajaFinalEfvo,
        real: Number(efectivoReal),
        diferencia: Number(efectivoReal) - cajaFinalEfvo,
        usuario: 'Administración'
      };
      await setDoc(doc(db, 'arqueos', dateStr), data);
      setArqueoData(data);
      setShowArqueo(false);
      setEfectivoReal('');
      alert('¡Arqueo de caja guardado con éxito!');
    } catch (err) {
      console.error(err);
      alert('Error al guardar arqueo');
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
  const licenciasHoy = licencias.filter(l => isSameDay(toDate(l.fecha)));
  const inscripcionesFedHoy = inscripcionesFed.filter(i => isSameDay(toDate(i.fecha)));
  const matriculasHoy = matriculas.filter(m => isSameDay(toDate(m.fecha)));
  const segurosHoy = seguros.filter(s => isSameDay(toDate(s.fecha)));
  const torneosPagosHoy = torneosPagos.filter(t => isSameDay(toDate(t.fecha)));
  const egresosHoy = egresos.filter(e => isSameDay(toDate(e.fecha)));

  const allDayItems = [...cuotasHoy, ...otrosHoy, ...merchHoy, ...licenciasHoy, ...inscripcionesFedHoy, ...matriculasHoy, ...segurosHoy, ...torneosPagosHoy];

  const totalIngEfvoHoy = sumMonto(allDayItems.filter(isEfectivo));
  const ingDebitoHoy = sumMonto(allDayItems.filter(isDebito));
  const ingTransfHoy = sumMonto(allDayItems.filter(isTransf));
  const totalIngresosGralHoy = totalIngEfvoHoy + ingDebitoHoy + ingTransfHoy;
  const totalEgresosGralHoy = sumMonto(egresosHoy);

  const cajaFinalEfvo = comienzoCaja + totalIngEfvoHoy - sumMonto(egresosHoy.filter(isEfectivo));
  const cajaFinalDebito = ingDebitoHoy - sumMonto(egresosHoy.filter(isDebito));
  const cajaFinalTransf = ingTransfHoy - sumMonto(egresosHoy.filter(isTransf));
  const totalFinalTodo = comienzoCaja + totalIngresosGralHoy - totalEgresosGralHoy;

  // ---------- MONTHLY CALCULATIONS ----------
  const allMonthItems = [...cuotas, ...otrosCostos, ...ventasMerch, ...licencias, ...inscripcionesFed, ...matriculas, ...seguros, ...torneosPagos];

  const totCuotasEfvoMes = sumMonto(cuotas.filter(c => getMetodo(c) === 'efectivo'));
  const totOtrosEfvoMes = sumMonto([...otrosCostos, ...ventasMerch, ...licencias, ...inscripcionesFed, ...matriculas, ...seguros, ...torneosPagos].filter(isEfectivo));
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
        ...licenciasHoy.map(i => ({ id: i.id, collection: 'federacion_licencias' })),
        ...inscripcionesFedHoy.map(i => ({ id: i.id, collection: 'federacion_inscripciones' })),
        ...matriculasHoy.map(i => ({ id: i.id, collection: 'matriculas' })),
        ...segurosHoy.map(i => ({ id: i.id, collection: 'seguros' })),
        ...torneosPagosHoy.map(i => ({ id: i.id, collection: 'torneos_pagos' })),
        ...egresosHoy.map(i => ({ id: i.id, collection: 'egresos' })),
      ];

      const dateStr = currentDate.toISOString().split('T')[0];

      for (const item of allItemsToDelete) {
        if (item.id) {
          deletePromises.push(deleteDoc(doc(db, item.collection, item.id)));
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
      ...licencias.map(l => ({ Fecha: toDate(l.fecha).toLocaleDateString('es-AR'), Tipo: 'FEDERACION (LICENCIA)', Metodo: getMetodo(l).toUpperCase(), Monto: l.monto, Concepto: 'LICENCIA ANUAL', Gimnasta: (l.alumna_nombre || '').toUpperCase() })),
      ...inscripcionesFed.map(i => ({ Fecha: toDate(i.fecha).toLocaleDateString('es-AR'), Tipo: 'FEDERACION (INSCRIPCION)', Metodo: getMetodo(i).toUpperCase(), Monto: i.monto, Concepto: 'INSCRIPCION TORNEO', Gimnasta: (i.alumna_nombre || '').toUpperCase() })),
      ...matriculas.map(m => ({ Fecha: toDate(m.fecha).toLocaleDateString('es-AR'), Tipo: 'MATRICULA', Metodo: getMetodo(m).toUpperCase(), Monto: m.monto, Concepto: 'PAGO MATRICULA', Gimnasta: (m.alumna_nombre || '').toUpperCase() })),
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
    licencias, inscripcionesFed, matriculas, seguros, torneosPagos,
    alumnas, productos,
    // POS
    posTab, setPosTab,
    cuotaForm, setCuotaForm, merchForm, setMerchForm, otroForm, setOtroForm,
    isProcessing, searchCuota, setSearchCuota, searchMerch, setSearchMerch, searchOtro, setSearchOtro,
    handlePOSCuota, handlePOSMerch, handlePOSOtro,
    // Egreso / Caja / Arqueo
    showEgreso, setShowEgreso, egresoForm, setEgresoForm, handleSaveEgreso,
    cajaFormOpen, setCajaFormOpen, nuevoComienzo, setNuevoComienzo, handleUpdateCaja,
    showArqueo, setShowArqueo, efectivoReal, setEfectivoReal, arqueoData, handleArqueo,
    deleteEgreso,
    // Daily calcs
    cuotasHoy, otrosHoy, merchHoy, licenciasHoy, inscripcionesFedHoy,
    matriculasHoy, segurosHoy, torneosPagosHoy, egresosHoy,
    allDayItems, allMonthItems,
    totalIngEfvoHoy, ingDebitoHoy, ingTransfHoy,
    totalIngresosGralHoy, totalEgresosGralHoy,
    cajaFinalEfvo, cajaFinalDebito, cajaFinalTransf, totalFinalTodo,
    // Monthly calcs
    totCuotasEfvoMes, totOtrosEfvoMes, totDebitoMes, totTransfMes, totEgresosMes, totFinalMes,
    // Utils
    formatter, exportToExcel, MESES, resetDailyData
  };
}
