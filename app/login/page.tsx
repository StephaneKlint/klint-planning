import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./LoginForm";
import styles from "./Login.module.css";

export const metadata = {
  title: "Connexion — Klint Planning",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; error?: string; callbackUrl?: string; invited?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/p");

  const params = await searchParams;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandK}>K</span>
          <span className={styles.brandName}>Klint Planning</span>
        </div>

        <h1 className={styles.heading}>Connexion</h1>

        {params.invited === "1" ? (
          <div style={{ background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#166534", marginBottom: 20 }}>
            ✓ Mot de passe défini. Vous pouvez maintenant vous connecter.
          </div>
        ) : (
          <p className={styles.subheading}>
            Connectez-vous avec votre email et votre mot de passe.
          </p>
        )}

        <LoginForm
          error={params.error === "1"}
        />
      </div>
    </div>
  );
}
