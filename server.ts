import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import path from "path";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Firebase (Server-side)
  const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
  };
  const firebaseApp = initializeApp(firebaseConfig);
  const db = getFirestore(firebaseApp, process.env.VITE_FIREBASE_DATABASE_ID);

  // Initialize Supabase (Server-side for keeping it alive)
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  let supabase: any = null;

  if (supabaseUrl && supabaseAnonKey) {
    supabase = createClient(supabaseUrl, supabaseAnonKey);

    const pingSupabase = async () => {
      try {
        console.log("[Supabase Keep-Alive] Intentando conectar a Supabase...");
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
          console.error("[Supabase Keep-Alive] Error al pingear Supabase:", error.message);
        } else {
          console.log(`[Supabase Keep-Alive] Ping exitoso. Buckets encontrados: ${data?.length || 0}`);
        }
      } catch (err) {
        console.error("[Supabase Keep-Alive] Error inesperado:", err);
      }
    };

    // Ping on server start
    pingSupabase();

    // Ping every 24 hours (86400000 ms)
    setInterval(pingSupabase, 24 * 60 * 60 * 1000);
  } else {
    console.warn("[Supabase Keep-Alive] No se encontraron credenciales de Supabase. El auto-ping no se iniciará.");
  }

  // API Route for health check and manual keep-alive trigger
  app.get("/api/health", async (req, res) => {
    try {
      let supabaseStatus = "not_configured";
      if (supabase) {
        const { data, error } = await supabase.storage.listBuckets();
        if (error) {
          supabaseStatus = `error: ${error.message}`;
        } else {
          supabaseStatus = `ok (found ${data?.length || 0} buckets)`;
        }
      }
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        supabase: supabaseStatus
      });
    } catch (error: any) {
      console.error("Error in /api/health", error);
      res.status(500).json({
        status: "error",
        message: error.message || error
      });
    }
  });

  // API Route to send late payment reminders
  app.post("/api/send-late-payment-reminders", async (req, res) => {
    try {
      const resendKey = process.env.RESEND_API_KEY;

      if (!resendKey) {
        return res.status(500).json({ error: "No se configuró RESEND_API_KEY." });
      }

      const resend = new Resend(resendKey);

      // Check current date
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();
      const dayOfMonth = now.getDate();

      // Only send if it's after the 15th and May or later
      if (currentMonth < 5 && currentYear <= 2026) {
        return res.json({ message: "Sistema exento hasta Mayo 2026." });
      }
      
      if (dayOfMonth <= 15) {
        return res.json({ message: "Aún no es después del día 15. No se envían avisos de mora." });
      }

      // Fetch all students (alumnas)
      const studentsSnap = await getDocs(collection(db, 'alumnas'));
      const students = studentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      // Fetch cuotas for the current month
      const cuotasQuery = query(
        collection(db, 'cuotas'), 
        where('anio', '==', currentYear),
        where('mes', '==', currentMonth),
        where('estado', '==', 'pagado')
      );
      const cuotasSnap = await getDocs(cuotasQuery);
      const paidStudentIds = new Set(cuotasSnap.docs.map(doc => (doc.data() as any).alumna_id));
      let sentCount = 0;

      for (const student of students) {
        // Find email (might be in email_contacto)
        const email = student.email_contacto || student.email;
        if (email && !paidStudentIds.has(student.id)) {
          try {
            await resend.emails.send({
              from: 'Akros Gimnasio <avisos@akrosgimnasia.com>',
              to: email,
              subject: 'Aviso de Mora en Cuota Mensual',
              text: `Señor papa,\n\nNo ha pagado la cuota del correspondiente mes en tiempo y forma, por ende se le habrá un incremento en la misma.\n\nAtte.\nGimnasio Akros`,
            });
            sentCount++;
          } catch (e) {
            console.error("Error sending to:", email, e);
          }
        }
      }

      res.json({ success: true, message: `Se enviaron ${sentCount} avisos de mora.` });
    } catch (error) {
      console.error("Critical error in /api/send-late-payment-reminders", error);
      res.status(500).json({ error: "Error en el proceso de recordatorios." });
    }
  });

  // API Route to send medical certificate expiration emails via Resend
  app.post("/api/send-reminders", async (req, res) => {
    try {
      const { recipients } = req.body;
      const resendKey = process.env.RESEND_API_KEY;

      if (!resendKey) {
        return res.status(500).json({ error: "No se configuró la clave de API (RESEND_API_KEY) en el servidor." });
      }

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ error: "No se enviaron destinatarios." });
      }

      const resend = new Resend(resendKey);

      let successCount = 0;
      let errorCount = 0;

      // Ideally you'd use batch sending if the plan supports it, but single sends work for prototypes
      for (const recipient of recipients) {
        if (!recipient.email) continue;
        
        try {
          // As per Resend free tier rules, if you don't have a verified domain, 
          // you can only send to yourself. In production you put a domain like 'hola@akrosgimnasia.com'
          await resend.emails.send({
            from: 'Akros Avisos <onboarding@resend.dev>', // Use verified domain in production
            to: recipient.email,
            subject: 'Aviso de Vencimiento de Certificado Médico',
            text: `Señor papá/mamá/tutor,\n\nEl certificado médico de aptitud física de la alumna ${recipient.nombre} se encuentra caducado o está por vencer.\n\nPara que la gimnasta pueda realizar la actividad y competir en torneos, deberá actualizar el certificado médico de aptitud física lo antes posible y acercarlo al gimnasio.\n\nAtte.\nGimnasio Akros`,
          });
          successCount++;
        } catch (e) {
          console.error("Error sending to:", recipient.email, e);
          errorCount++;
        }
      }

      res.json({ success: true, message: `Se enviaron ${successCount} correos. ${errorCount} fallaron.` });
    } catch (error) {
       console.error("Critical error in /api/send-reminders", error);
       res.status(500).json({ error: "Ocurrió un error general en el envío." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
