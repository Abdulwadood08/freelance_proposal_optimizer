import AuthRedirect from "@/components/shared/AuthRedirect/AuthRedirect";
import Settings from "@/components/settings/Settings";

export default function SettingsPage() {
  return (
    <AuthRedirect>
      <Settings />
    </AuthRedirect>
  );
}
