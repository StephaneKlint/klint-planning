import { ResetPasswordForm } from "./ResetPasswordForm";
import styles from "@/app/login/Login.module.css";

export const metadata = {
  title: "Réinitialisation du mot de passe — Klint Planning",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.brandK}>K</span>
          <span className={styles.brandName}>Klint Planning</span>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
