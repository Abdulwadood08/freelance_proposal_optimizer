import GenerateProposal from '@/components/GenerateProposal/GenerateProposal';
import AuthRedirect from '@/components/shared/AuthRedirect/AuthRedirect';

export default function GeneratePage() {
  return (
    <AuthRedirect>
      <GenerateProposal />
    </AuthRedirect>
  );
}
