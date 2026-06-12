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
  searchParams: Promise<{ verify?: string; error?: string; callbackUrl?: string }>;
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
        <p className={styles.subheading}>
          Connectez-vous avec votre email et votre mot de passe.
        </p>

        <LoginForm
          error={params.error === "1"}
        />
      </div>
    </div>
  );
}
