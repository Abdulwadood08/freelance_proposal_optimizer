import AuthRedirect from "@/components/shared/AuthRedirect/AuthRedirect";
import Analytics from "@/components/analytics/Analytics";

export default function AnalyticsPage() {
  return (
    <AuthRedirect>
      <Analytics />
    </AuthRedirect>
  );
}
