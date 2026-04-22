import express from "express";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
