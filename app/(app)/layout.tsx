/**
 * Authenticated app layout — Rail (fixed) + Topbar + content.
 * All pages under /p, /synthese, /ressources, /parametres, /historique.
 */
import { auth } from "@/auth";
import { Rail } from "@/components/chrome/Rail";
import { TopbarWrapper } from "@/components/chrome/TopbarWrapper";
import { ConnectionLogger } from "@/app/(app)/ConnectionLogger";
import { listPlannings, listPlanningsForUser } from "@/lib/db/queries";
import { getAppSettings } from "@/lib/actions/appSettings";
import styles from "./layout.module.css";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [session, appCfg] = await Promise.all([auth(), getAppSettings()]);
  const user = session?.user;
  const userRole = user?.role ?? "contact";
  const userId   = user?.id;

  const plannings = userId && userRole !== "admin"
    ? await listPlanningsForUser(userId)
    : await listPlannings();

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "?";

  return (
    <>
      <ConnectionLogger userId={user?.id ?? null} />
      <Rail
        avatarInitials={initials}
        logoDataUrl={appCfg.logoDataUrl}
        logoAlt={appCfg.logoAlt}
      />
      <div className={styles.content}>
        <TopbarWrapper plannings={plannings} />
        <main className={styles.main}>{children}</main>
      </div>
    </>
  );
}
