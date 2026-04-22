import { useState } from 'react';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function ImportarCaja() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setResultado(null);
    let successCount = 0;
    let errors = [];

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        const keys = Object.keys(row);
        const findKey = (includesArr: string[], excludesArr: string[] = []) => {
            return keys.find(k => {
                const upperK = k.toUpperCase();
                const matchInc = includesArr.some(inc => upperK.includes(inc.toUpperCase()));
                const matchExc = excludesArr.some(exc => upperK.includes(exc.toUpperCase()));
                return matchInc && !matchExc;
            });
        };

        const fechaKey = findKey(['FECHA', 'DIA', 'DATE']);
        const conceptoKey = findKey(['CONCEPTO', 'DETALLE', 'DESCRIPCION', 'OBSERVACION', 'ALUMNA', 'GIMNASTA']);
        const montoKey = findKey(['MONTO', 'IMPORTE', 'VALOR', 'TOTAL', 'INGRESO', 'EGRESO', 'EFECTIVO']);
        const tipoKey = findKey(['TIPO', 'CATEGORIA', 'RUBRO']);
        const metodoKey = findKey(['METODO', 'PAGO', 'FORMA']);

        const conceptoStr = conceptoKey ? String(row[conceptoKey]).trim() : 'Sin concepto';
        let montoNum = montoKey ? Number(String(row[montoKey]).replace(/[^0-9.-]+/g,"")) : 0;
        
        // Skip empty rows
        if (!montoKey || !row[montoKey] || montoNum === 0) {
          continue; 
        }

        let fechaObj = new Date();
        if (fechaKey && row[fechaKey]) {
           if (typeof row[fechaKey] === 'number') {
               fechaObj = new Date(Math.round((row[fechaKey] - 25569)*86400*1000));
           } else {
               fechaObj = new Date(row[fechaKey]);
           }
        }
        if (isNaN(fechaObj.getTime())) fechaObj = new Date();

        const tipoStr = tipoKey ? String(row[tipoKey]).toLowerCase() : 'otro';
        const metodoStr = metodoKey ? String(row[metodoKey]).toLowerCase() : 'efectivo';
        
        let metodoNorm = 'efectivo';
        if (metodoStr.includes('transf') || metodoStr.includes('mercado') || metodoStr.includes('mp') || metodoStr.includes('tc') || metodoStr.includes('tarjeta')) {
          metodoNorm = 'transferencia';
        }

        try {
          if (tipoStr.includes('egreso') || tipoStr.includes('gasto')) {
             const ref = doc(collection(db, 'egresos'));
             await setDoc(ref, {
               id: ref.id, concepto: conceptoStr, monto: Math.abs(montoNum), metodo: metodoNorm, fecha: fechaObj
             });
          } else if (tipoStr.includes('cuota')) {
             const ref = doc(collection(db, 'cuotas'));
             await setDoc(ref, {
               id: ref.id, alumna_id: 'csv_import', mes: fechaObj.getMonth()+1, anio: fechaObj.getFullYear(),
               monto: Math.abs(montoNum), estado: 'pagado', metodo_pago: metodoNorm, fecha_pago: fechaObj, notas: conceptoStr
             });
          } else if (tipoStr.includes('merch') || tipoStr.includes('ropa') || tipoStr.includes('kiosko') || tipoStr.includes('gaseosa')) {
             const ref = doc(collection(db, 'ventas_merch'));
             await setDoc(ref, {
               id: ref.id, producto_id: 'csv_import', nombre_producto: conceptoStr,
               cantidad: 1, monto: Math.abs(montoNum), metodo_pago: metodoNorm, fecha: fechaObj
             });
          } else {
             // Otros costos por defecto
             const ref = doc(collection(db, 'otros_costos'));
             await setDoc(ref, {
               id: ref.id, alumna_id: 'csv_import', concepto: conceptoStr,
               monto: Math.abs(montoNum), estado: 'pagado', metodo_pago: metodoNorm, fecha: fechaObj, notas: 'Importación Excel'
             });
          }
          successCount++;
        } catch (err: any) {
          errors.push(`Fila ${i + 2}: ${err.message}`);
        }
      }

      setResultado({ success: successCount, errors });
    } catch (err) {
      console.error(err);
      alert('Error procesando el archivo. Asegúrate de que es un Excel válido.');
    } finally {
      setLoading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">Importar Historial de Caja</h1>
        <Link to="/admin/caja" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-purple-600 underline">Volver a Caja</Link>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          Instrucciones para la importación
        </p>
        <p className="text-sm text-slate-600 mb-6">
          Sube tu planilla de Excel. El sistema buscará inteligentemente las operaciones para asignarlas a las cuentas. <br/><br/>
          Te recomendamos un Excel con al menos estas columnas para una precisión perfecta:
          <br/><br/>
          <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">FECHA</span> | 
          <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">CONCEPTO</span> | 
          <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">MONTO</span> | 
          <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">TIPO (Cuota, Ingreso, Egreso, Kiosko)</span> | 
          <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">MÉTODO PAGO (Efectivo, Transf)</span>
        </p>
        
        <div className="border-2 border-dashed border-slate-200 p-8 rounded-xl text-center bg-slate-50">
           <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload-caja"
              disabled={loading}
           />
           <label htmlFor="file-upload-caja" className="cursor-pointer flex flex-col items-center">
              <span className={`bg-emerald-600 text-white px-6 py-3 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-emerald-700 transition-colors shadow-sm ${loading ? 'opacity-50' : ''}`}>
                 {loading ? 'Procesando Tesorería...' : 'Seleccionar Excel Histórico'}
              </span>
              <span className="text-xs text-slate-400 font-medium mt-3">Sumará directamente a los balances de ingresos y egresos de los meses correspondientes.</span>
           </label>
        </div>

        {resultado && (
          <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Resultados</h3>
            <p className="text-xs font-medium text-emerald-700">Movimientos procesados y asentados: {resultado.success}</p>
            {resultado.errors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200/50">
                <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2">Errores detallados:</p>
                <ul className="list-disc pl-5 text-xs text-red-500 space-y-1">
                  {resultado.errors.map((e: string, i: number) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
