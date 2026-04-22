import { useState, useEffect } from 'react';
import { collection, doc, getDocs, serverTimestamp, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { Link, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';

export default function ImportarCSV() {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<any>(null);
  const [grupos, setGrupos] = useState<any[]>([]);

  useEffect(() => {
    const fetchGrupos = async () => {
      const snap = await getDocs(collection(db, 'grupos'));
      const data = snap.docs.map(d => ({id: d.id, ...d.data()}));
      
      // Orden personalizado
      const priority: Record<string, number> = { 'jardín': 1, 'iniciación': 2, 'formación': 3, 'desarrollo': 4, 'rendimiento': 5 };
      const getPriority = (name: string) => {
         const lower = name?.toLowerCase() || '';
         for (const key in priority) {
             if (lower.includes(key)) return priority[key];
         }
         return 99;
      };
      
      data.sort((a, b) => getPriority(a.nombre) - getPriority(b.nombre));
      setGrupos(data);
    };
    fetchGrupos();
  }, []);

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
      // Expecting columns: DNI, Nombre Completo, Fecha Nacimiento, Grupo ID
      const rows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      // Batch procesing
      let batch = writeBatch(db);
      let operationCount = 0;

      const commitBatchIfNeeded = async (operationsToAdd: number) => {
         if (operationCount + operationsToAdd > 450) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
         }
      };

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

        // Case-insensitive mapping avoiding partial matches with other columns
        const nombreKey = findKey(['NOMBRE DE LA GIMNAS', 'APELLIDO Y NOMBRE'], ['PADRE', 'MADRE']);
        const dniKey = findKey(['DNI DE LA GIMNAS', 'D.N.I', 'DNI'], ['FRENTE', 'DORSO', 'PADRE', 'MADRE']);
        const fechaKey = findKey(['FECHA DE NAC']);
        const padreKey = findKey(['NOMBRE DEL PADR', 'APELLIDO DEL PADR']);
        const madreKey = findKey(['NOMBRE DE LA MADR', 'APELLIDO DE LA MADR']);
        const domKey = findKey(['DOMICILIO', 'DIRECCION']);
        const celKey = findKey(['CELULAR', 'TELEFONO', 'CEL']);
        const sangreKey = findKey(['SANGU', 'SANGRE']);
        
        // Documents / Links
        const dniFrenteKey = findKey(['DNI FRENTE', 'DNI - FRENTE']);
        const dniDorsoKey = findKey(['DNI DORSO', 'DNI - DORSO']);
        const fotoKey = findKey(['FOTO GIMNA', 'FOTO DE LA']);
        const certMedicoKey = findKey(['CERTIFICADO', 'APTITUD']);
        const grupoDeseadoKey = findKey(['GRUPO AL QUE', 'CONCURRIR', 'GRUPO']);

        const nombre_completo = nombreKey ? String(row[nombreKey]).trim() : '';
        const dni = dniKey ? String(row[dniKey]).trim() : '';
        
        if (!nombre_completo) {
          errors.push(`Fila ${i + 2}: No se pudo encontrar la columna del Nombre (${JSON.stringify(keys).substring(0, 50)}...).`);
          continue;
        }

        let fecha_nac_obj = null;
        if (fechaKey && row[fechaKey]) {
           // xlsx might parse dates as numbers or strings
           if (typeof row[fechaKey] === 'number') {
               fecha_nac_obj = new Date(Math.round((row[fechaKey] - 25569)*86400*1000));
           } else {
               fecha_nac_obj = new Date(row[fechaKey]);
           }
        }
        
        let matchGrupoId = '';
        if (grupoDeseadoKey && row[grupoDeseadoKey]) {
           const grpStr = String(row[grupoDeseadoKey]).toUpperCase().trim();
           const match = grupos.find(g => grpStr.includes(g.nombre.toUpperCase()));
           if (match) matchGrupoId = match.id;
        }

        try {
          await commitBatchIfNeeded(13); // 1 alumna + 12 cuotas

          const alumnaRef = doc(collection(db, 'alumnas'));
          batch.set(alumnaRef, {
            id: alumnaRef.id,
            nombre_completo,
            dni,
            fecha_nacimiento: fecha_nac_obj && !isNaN(fecha_nac_obj.getTime()) ? fecha_nac_obj : null,
            grupo_id: matchGrupoId,
            estado: 'activa',
            importada: true,
            
            // Ficha extra info
            nombre_padre: padreKey ? String(row[padreKey]).trim() : '',
            nombre_madre: madreKey ? String(row[madreKey]).trim() : '',
            domicilio: domKey ? String(row[domKey]).trim() : '',
            celular_contacto: celKey ? String(row[celKey]).trim() : '',
            grupo_sanguineo: sangreKey ? String(row[sangreKey]).trim() : '',

            // Links Docs Drive
            doc_dni_frente: dniFrenteKey ? String(row[dniFrenteKey]).trim() : '',
            doc_dni_dorso: dniDorsoKey ? String(row[dniDorsoKey]).trim() : '',
            doc_foto: fotoKey ? String(row[fotoKey]).trim() : '',
            doc_certificado_medico: certMedicoKey ? String(row[certMedicoKey]).trim() : '',

            creado_en: serverTimestamp()
          });
          operationCount++;

          // Automatically generate cuotas
          const today = new Date();
          const year = today.getFullYear();
          for (let m = 1; m <= 12; m++) {
            const cuotaRef = doc(collection(db, 'cuotas'));
            batch.set(cuotaRef, {
              id: cuotaRef.id,
              alumna_id: alumnaRef.id,
              mes: m,
              anio: year,
              monto: 30000, 
              estado: m < today.getMonth() + 1 ? 'vencido' : 'pendiente'
            });
            operationCount++;
          }
          successCount++;
        } catch (err: any) {
          errors.push(`Fila ${i + 2} (${nombre_completo}): ${err.message}`);
        }
      }

      // Commit any remaining operations in the final batch
      if (operationCount > 0) {
         await batch.commit();
      }

      setResultado({ success: successCount, errors });
    } catch (err) {
      console.error(err);
      alert('Error procesando el archivo.');
    } finally {
      setLoading(false);
      // Reset input
      e.target.value = '';
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h1 className="text-sm font-bold uppercase tracking-tight">Importar Alumnas desde Excel/CSV</h1>
        <Link to="/admin/alumnas" className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-purple-600 underline">Volver</Link>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
          Instrucciones para la importación
        </p>
        <p className="text-sm text-slate-600 mb-6">
          Sube un archivo Excel (.xlsx) o de valores separados por coma (.csv). El sistema intentará detectar automáticamente las columnas basándose en sus encabezados. Te recomendamos tener columnas con nombres similares a:
          <br/><br/>
          <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">APELLIDO Y NOMBRE DE LA GIMNAS...</span> | <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">DNI DE LA GIMNASTA</span> | <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">FECHA DE NAC...</span> | <span className="font-mono bg-slate-100 p-1 px-2 text-xs rounded text-slate-700">FOTO GIMNASTA</span>
        </p>
        
        <div className="border-2 border-dashed border-slate-200 p-8 rounded-xl text-center bg-slate-50">
           <input 
              type="file" 
              accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
              onChange={handleFileUpload}
              className="hidden"
              id="file-upload"
              disabled={loading}
           />
           <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
              <span className={`bg-purple-600 text-white px-6 py-3 rounded text-[10px] uppercase font-bold tracking-widest hover:bg-purple-700 transition-colors shadow-sm ${loading ? 'opacity-50' : ''}`}>
                 {loading ? 'Procesando Archivo...' : 'Seleccionar Archivo Excel o CSV'}
              </span>
              <span className="text-xs text-slate-400 font-medium mt-3">Puedes cargar todos y generar sus cuotas del año automáticamente.</span>
           </label>
        </div>

        {resultado && (
          <div className="mt-6 p-4 bg-emerald-50 rounded-xl border border-emerald-200">
            <h3 className="text-xs font-bold text-emerald-800 uppercase tracking-widest mb-1">Resultados de Importación</h3>
            <p className="text-xs font-medium text-emerald-700">Alumnas creadas exitosamente: {resultado.success}</p>
            {resultado.errors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200/50">
                <p className="text-xs font-bold text-red-600 uppercase tracking-widest mb-2">Errores ({resultado.errors.length}):</p>
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
