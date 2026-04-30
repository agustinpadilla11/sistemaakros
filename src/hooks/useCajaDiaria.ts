import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
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
  return m === 'transferencia' || m === 'mp' || m === 'mercado pago';
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
  const [merchForm, setMerchForm] = useState({ producto_id: '', cantidad: 1, metodo_pago: 'efectivo' });
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
        .filter((c: any) => c.fecha_pago && c.fecha_pago.toDate() >= startOfMonth && c.fecha_pago.toDate() <= endOfMonth));

      const otrosSnap = await getDocs(query(collection(db, 'otros_costos'), where('estado', '==', 'pagado')));
      setOtrosCostos(otrosSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((c: any) => c.fecha && c.fecha.toDate() >= startOfMonth && c.fecha.toDate() <= endOfMonth));

      const ventasSnap = await getDocs(collection(db, 'ventas_merch'));
      setVentasMerch(ventasSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((v: any) => v.fecha && v.fecha.toDate() >= startOfMonth && v.fecha.toDate() <= endOfMonth));

      const egresosSnap = await getDocs(collection(db, 'egresos'));
      setEgresos(egresosSnap.docs.map(d => ({id: d.id, ...d.data()} as any))
        .filter((e: any) => e.fecha && e.fecha.toDate() >= startOfMonth && e.fecha.toDate() <= endOfMonth));

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
    e.preventDefault();
    setIsProcessing(true);
    try {
      const aluId = cuotaForm.alumna_id;
      const mesNum = Number(cuotaForm.mes);
      const year = currentDate.getFullYear();
      const cuotasSnap = await getDocs(query(collection(db, 'cuotas'), where('alumna_id', '==', aluId), where('mes', '==', mesNum), where('anio', '==', year)));
      if (cuotasSnap.empty) {
        const newRef = doc(collection(db, 'cuotas'));
        await setDoc(newRef, { id: newRef.id, alumna_id: aluId, mes: mesNum, anio: year, monto: Number(cuotaForm.monto), estado: 'pagado', metodo_pago: cuotaForm.metodo_pago, fecha_pago: currentDate });
      } else {
        const existing = cuotasSnap.docs[0];
        await updateDoc(doc(db, 'cuotas', existing.id), { estado: 'pagado', monto: Number(cuotaForm.monto), metodo_pago: cuotaForm.metodo_pago, fecha_pago: currentDate });
      }
      setCuotaForm({...cuotaForm, alumna_id: '', monto: ''});
      setSearchCuota('');
      loadData();
    } catch (err) { console.error(err); alert('Error al cobrar cuota'); } finally { setIsProcessing(false); }
  };

  const handlePOSMerch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const prod = productos.find(p => p.id === merchForm.producto_id);
      if (!prod) return;
      const montoTotal = Number(prod.precio) * merchForm.cantidad;
      const newRef = doc(collection(db, 'ventas_merch'));
      await setDoc(newRef, { id: newRef.id, producto_id: prod.id, nombre_producto: prod.nombre, cantidad: merchForm.cantidad, monto: montoTotal, metodo_pago: merchForm.metodo_pago, fecha: currentDate });
      await updateDoc(doc(db, 'productos', prod.id), { stock: prod.stock - merchForm.cantidad });
      setMerchForm({ producto_id: '', cantidad: 1, metodo_pago: 'efectivo' });
      setSearchMerch('');
      loadData();
    } catch (err) { console.error(err); alert('Error al vender merch'); } finally { setIsProcessing(false); }
  };

  const handlePOSOtro = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const newRef = doc(collection(db, 'otros_costos'));
      await setDoc(newRef, { id: newRef.id, alumna_id: otroForm.alumna_id, concepto: otroForm.concepto, monto: Number(otroForm.monto), estado: 'pagado', metodo_pago: otroForm.metodo_pago, fecha: currentDate, notas: 'Ingreso Rápido' });
      setOtroForm({ alumna_id: '', concepto: '', monto: '', metodo_pago: 'efectivo' });
      setSearchOtro('');
      loadData();
    } catch (err) { console.error(err); alert('Error al cobrar otro costo'); } finally { setIsProcessing(false); }
  };

  // ---------- SAVE ACTIONS ----------
  const handleSaveEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const ref = doc(collection(db, 'egresos'));
      await setDoc(ref, { concepto: egresoForm.concepto, monto: Number(egresoForm.monto), metodo: egresoForm.metodo, fecha: currentDate });
      setShowEgreso(false);
      setEgresoForm({ concepto: '', monto: '', metodo: 'efectivo' });
      loadData();
    } catch (err) { console.error(err); alert('Error al guardar egreso'); }
  };

  const handleUpdateCaja = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, 'cajas', dateStr), { monto: Number(nuevoComienzo), fecha: currentDate });
      setCajaFormOpen(false);
      loadData();
    } catch(err) { console.error(err); }
  };

  const deleteEgreso = async (id: string) => {
    if (!confirm('¿Eliminar registro?')) return;
    await deleteDoc(doc(db, 'egresos', id));
    loadData();
  };

  const handleArqueo = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data: ArqueoData = { fecha: currentDate, esperado: cajaFinalEfvo, real: Number(efectivoReal), diferencia: Number(efectivoReal) - cajaFinalEfvo, usuario: 'Administración' };
      await setDoc(doc(db, 'arqueos', dateStr), data);
      setArqueoData(data);
      setShowArqueo(false);
      setEfectivoReal('');
      alert('Arqueo de caja guardado con éxito');
    } catch (err) { console.error(err); alert('Error al guardar arqueo'); }
  };

  // ---------- DAILY CALCULATIONS ----------
  const isSameDay = (d: Date) => d >= startOfDay && d <= endOfDay;

  const cuotasHoy = cuotas.filter(c => isSameDay(c.fecha_pago?.toDate()));
  const otrosHoy = otrosCostos.filter(c => isSameDay(c.fecha?.toDate()));
  const merchHoy = ventasMerch.filter(v => isSameDay(v.fecha?.toDate()));
  const licenciasHoy = licencias.filter(l => isSameDay(toDate(l.fecha)));
  const inscripcionesFedHoy = inscripcionesFed.filter(i => isSameDay(toDate(i.fecha)));
  const matriculasHoy = matriculas.filter(m => isSameDay(toDate(m.fecha)));
  const segurosHoy = seguros.filter(s => isSameDay(toDate(s.fecha)));
  const torneosPagosHoy = torneosPagos.filter(t => isSameDay(toDate(t.fecha)));
  const egresosHoy = egresos.filter(e => isSameDay(e.fecha.toDate()));

  const allDayItems = [...cuotasHoy, ...otrosHoy, ...merchHoy, ...licenciasHoy, ...inscripcionesFedHoy, ...matriculasHoy, ...segurosHoy, ...torneosPagosHoy];

  const totalIngEfvoHoy = sumMonto(allDayItems.filter(isEfectivo));
  const ingDebitoHoy = sumMonto(allDayItems.filter(isDebito));
  const ingTransfHoy = sumMonto(allDayItems.filter(isTransf));
  const totalIngresosGralHoy = totalIngEfvoHoy + ingDebitoHoy + ingTransfHoy;
  const totalEgresosGralHoy = sumMonto(egresosHoy);

  const cajaFinalEfvo = comienzoCaja + totalIngEfvoHoy - sumMonto(egresosHoy.filter(isEfectivo));
  const totalFinalTodo = comienzoCaja + totalIngresosGralHoy - totalEgresosGralHoy;

  // ---------- MONTHLY CALCULATIONS ----------
  const allMonthItems = [...cuotas, ...otrosCostos, ...ventasMerch, ...licencias, ...inscripcionesFed, ...matriculas, ...seguros, ...torneosPagos];

  const totCuotasEfvoMes = sumMonto(cuotas.filter(c => c.metodo_pago === 'efectivo'));
  const totOtrosEfvoMes = sumMonto([...otrosCostos, ...ventasMerch, ...licencias, ...inscripcionesFed, ...matriculas, ...seguros, ...torneosPagos].filter(isEfectivo));
  // BUG FIX: These 3 variables were referenced in the JSX but never defined
  const totDebitoMes = sumMonto(allMonthItems.filter(isDebito));
  const totTransfMes = sumMonto(allMonthItems.filter(isTransf));
  const totEgresosMes = sumMonto(egresos);
  const totFinalMes = sumMonto(allMonthItems) - totEgresosMes;

  // ---------- EXCEL EXPORT ----------
  const exportToExcel = () => {
    const dataIngresos = [
      ...cuotas.map(c => ({ Fecha: c.fecha_pago?.toDate().toLocaleDateString('es-AR'), Tipo: 'CUOTA', Metodo: getMetodo(c).toUpperCase(), Monto: c.monto, Concepto: `MES ${c.mes}/${c.anio}`, Gimnasta: alumnas.find(a => a.id === c.alumna_id)?.nombre_completo || 'N/A' })),
      ...otrosCostos.map(o => ({ Fecha: o.fecha?.toDate().toLocaleDateString('es-AR'), Tipo: 'OTRO', Metodo: getMetodo(o).toUpperCase(), Monto: o.monto, Concepto: (o.concepto || '').toUpperCase(), Gimnasta: alumnas.find(a => a.id === o.alumna_id)?.nombre_completo || 'N/A' })),
      ...ventasMerch.map(v => ({ Fecha: v.fecha?.toDate().toLocaleDateString('es-AR'), Tipo: 'INDUMENTARIA/KIOSKO', Metodo: getMetodo(v).toUpperCase(), Monto: v.monto, Concepto: (v.nombre_producto || v.concepto || '').toUpperCase(), Gimnasta: 'VENTA MOSTRADOR' })),
      ...licencias.map(l => ({ Fecha: toDate(l.fecha).toLocaleDateString('es-AR'), Tipo: 'FEDERACION (LICENCIA)', Metodo: (l.metodo || 'EFECTIVO').toUpperCase(), Monto: l.monto, Concepto: 'LICENCIA ANUAL', Gimnasta: (l.alumna_nombre || '').toUpperCase() })),
      ...inscripcionesFed.map(i => ({ Fecha: toDate(i.fecha).toLocaleDateString('es-AR'), Tipo: 'FEDERACION (INSCRIPCION)', Metodo: (i.metodo || 'EFECTIVO').toUpperCase(), Monto: i.monto, Concepto: 'INSCRIPCION TORNEO', Gimnasta: (i.alumna_nombre || '').toUpperCase() })),
      ...matriculas.map(m => ({ Fecha: toDate(m.fecha).toLocaleDateString('es-AR'), Tipo: 'MATRICULA', Metodo: (m.metodo || 'EFECTIVO').toUpperCase(), Monto: m.monto, Concepto: 'PAGO MATRICULA', Gimnasta: (m.alumna_nombre || '').toUpperCase() })),
      ...seguros.map(s => ({ Fecha: toDate(s.fecha).toLocaleDateString('es-AR'), Tipo: 'SEGURO', Metodo: (s.metodo || 'EFECTIVO').toUpperCase(), Monto: s.monto, Concepto: 'PAGO SEGURO', Gimnasta: (s.alumna_nombre || '').toUpperCase() })),
      ...torneosPagos.map(t => ({ Fecha: toDate(t.fecha).toLocaleDateString('es-AR'), Tipo: 'TORNEO INTERNO', Metodo: (t.metodo || 'EFECTIVO').toUpperCase(), Monto: t.monto, Concepto: (t.categoria || 'TORNEO').toUpperCase(), Gimnasta: (t.alumna_nombre || '').toUpperCase() })),
    ];
    dataIngresos.sort((a, b) => { const pA = a.Fecha.split('/'); const pB = b.Fecha.split('/'); return new Date(+pA[2],+pA[1]-1,+pA[0]).getTime() - new Date(+pB[2],+pB[1]-1,+pB[0]).getTime(); });

    const dataEgresos = egresos.map(e => ({ Fecha: e.fecha.toDate().toLocaleDateString('es-AR'), Concepto: e.concepto.toUpperCase(), Metodo: e.metodo.toUpperCase(), Monto: e.monto }));
    const tE = sumMonto(dataIngresos.filter(i => i.Metodo === 'EFECTIVO'));
    const tD = sumMonto(dataIngresos.filter(i => i.Metodo === 'DEBITO'));
    const tT = sumMonto(dataIngresos.filter(i => i.Metodo === 'TRANSFERENCIA' || i.Metodo === 'MP'));
    const tEgr = dataEgresos.reduce((a,b) => a + b.Monto, 0);

    const dataResumen = [
      { Categoria: 'INGRESOS EFECTIVO', Monto: tE }, { Categoria: 'INGRESOS DEBITO', Monto: tD },
      { Categoria: 'INGRESOS TRANSFERENCIA/MP', Monto: tT }, { Categoria: '', Monto: '' },
      { Categoria: 'TOTAL INGRESOS', Monto: tE + tD + tT }, { Categoria: 'TOTAL EGRESOS (SE SACO DE CAJA)', Monto: tEgr },
      { Categoria: '', Monto: '' }, { Categoria: 'BALANCE NETO', Monto: (tE + tD + tT) - tEgr }
    ];

    const wb = XLSX.utils.book_new();
    
    // Format amounts as numbers for better Excel support
    const formatSheet = (ws: any) => {
      const range = XLSX.utils.decode_range(ws['!ref'] || "A1:A1");
      for (let R = range.s.r + 1; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = {c: C, r: R};
          const cellRef = XLSX.utils.encode_cell(cellAddress);
          const cell = ws[cellRef];
          if (cell && cell.t === 'n') {
            cell.z = '"$"#,##0.00'; // Currency format
          }
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
    totalIngEfvoHoy, ingDebitoHoy, ingTransfHoy,
    totalIngresosGralHoy, totalEgresosGralHoy,
    cajaFinalEfvo, totalFinalTodo,
    // Monthly calcs
    totCuotasEfvoMes, totOtrosEfvoMes, totDebitoMes, totTransfMes, totEgresosMes, totFinalMes,
    // Utils
    formatter, exportToExcel, MESES,
  };
}
