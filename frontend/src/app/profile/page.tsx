import Profile from '@/components/Profile/Profile';
import AuthRedirect from '@/components/shared/AuthRedirect/AuthRedirect';

export default function ProfilePage() {
  return (
    <AuthRedirect>
      <Profile />
    </AuthRedirect>
  );
}
