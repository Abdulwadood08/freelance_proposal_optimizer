import GenerateProposal from '@/components/GenerateProposal/GenerateProposal';
import ProtectedRoute from '@/components/auth/ProtectedRoute/ProtectedRoute';

export default function GeneratePage() {
  return (
    <ProtectedRoute>
      <GenerateProposal />
    </ProtectedRoute>
  );
}
