/** Email d'alerte sécurité (connexion hors-France) via Brevo — fire-and-forget. */

type SecurityAlertInput = {
  kind: "blocked" | "alert";
  userEmail: string;
  ip: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
};

export async function sendSecurityAlertEmail(input: SecurityAlertInput): Promise<void> {
  if (!process.env.BREVO_API_KEY) return;

  const fromRaw = process.env.EMAIL_FROM ?? "Klint Planning <sdurand@klint-consulting.com>";
  const fromMatch = fromRaw.match(/^(.+?)\s*<(.+?)>$/);
  const senderName  = fromMatch ? fromMatch[1].trim() : "Klint Planning";
  const senderEmail = fromMatch ? fromMatch[2].trim() : fromRaw;

  const isBlocked = input.kind === "blocked";
  const subject = isBlocked
    ? `🚫 Connexion bloquée (hors-France) — ${input.userEmail}`
    : `⚠️ Connexion hors-France — ${input.userEmail}`;
  const title = isBlocked ? "🚫 Connexion bloquée — pays non autorisé" : "⚠️ Connexion détectée hors de France";
  const color = isBlocked ? "#DC2626" : "#D97706";

  try {
    await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender:      { name: senderName, email: senderEmail },
        to:          [{ email: senderEmail }],
        subject,
        htmlContent: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:${color};margin:0 0 16px">${title}</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:4px 0;color:#6B7280;font-size:13px;width:100px">Utilisateur</td><td style="padding:4px 0;font-size:13px;font-weight:600">${input.userEmail}</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">IP</td><td style="padding:4px 0;font-size:13px;font-family:monospace">${input.ip ?? "inconnue"}</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Pays</td><td style="padding:4px 0;font-size:13px">${input.country ?? "inconnu"} (${input.countryCode ?? "?"})</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Ville</td><td style="padding:4px 0;font-size:13px">${input.city ?? "inconnue"}</td></tr>
              <tr><td style="padding:4px 0;color:#6B7280;font-size:13px">Date</td><td style="padding:4px 0;font-size:13px">${new Date().toLocaleString("fr-FR")}</td></tr>
            </table>
            <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0">
            <p style="color:#6B7280;font-size:12px">
              ${isBlocked
                ? "La connexion a été refusée. Si c'est légitime, autorisez l'international pour ce compte depuis Paramètres → Répertoire."
                : "Si cette connexion est légitime, ignorez ce message. Sinon, révoquez l'accès depuis Paramètres → Membres."}
            </p>
          </div>
        `,
      }),
    });
  } catch {
    // fire-and-forget — ne jamais bloquer le flux appelant
  }
}
