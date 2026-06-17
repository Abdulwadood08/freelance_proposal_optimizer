import Profile from "@/components/profile/Profile";
import AuthRedirect from "@/components/shared/AuthRedirect/AuthRedirect";

export default function ProfilePage() {
  return (
    <AuthRedirect>
      <Profile />
    </AuthRedirect>
  );
}
