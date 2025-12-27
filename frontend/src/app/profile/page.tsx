import Profile from '@/components/Profile/Profile';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';

export default function ProfilePage() {
  return (
    <ProtectedRoute>
      <Profile />
    </ProtectedRoute>
  );
}
