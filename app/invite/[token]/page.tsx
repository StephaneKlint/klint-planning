import { getInvitationByToken } from "@/lib/actions/invitations";
import { InviteForm } from "./InviteForm";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function InvitePage({ params }: Props) {
  const { token } = await params;
  const invite = await getInvitationByToken(token);

  const isExpired = !invite || !!invite.usedAt || invite.expiresAt < new Date();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--klint-paper, #F6F7FB)",
      fontFamily: "var(--font-display, system-ui)",
      padding: 24,
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        boxShadow: "0 4px 24px rgba(0,16,54,0.10)",
        padding: "40px 40px 36px",
        width: "100%",
        maxWidth: 420,
      }}>
        {/* Logo */}
        <div style={{ marginBottom: 28, textAlign: "center" as const }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--klint-navy, #001036)", letterSpacing: "-0.02em" }}>
            Klint Planning
          </div>
        </div>

        {isExpired ? (
          <div style={{ textAlign: "center" as const }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏱</div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#001036", marginBottom: 8 }}>
              Lien expiré ou déjà utilisé
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>
              Ce lien d&apos;invitation n&apos;est plus valide.<br />
              Demandez à votre administrateur de générer un nouveau lien.
            </p>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "#001036", marginBottom: 6 }}>
              Bienvenue, {invite!.name || invite!.email} 👋
            </h1>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 28, lineHeight: 1.6 }}>
              Définissez votre mot de passe pour accéder à Klint Planning.
            </p>
            <InviteForm token={token} email={invite!.email} />
          </>
        )}
      </div>
    </div>
  );
}
