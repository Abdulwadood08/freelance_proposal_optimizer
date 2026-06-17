import AuthRedirect from "@/components/shared/AuthRedirect/AuthRedirect";
import ProposalHistory from "@/components/history/ProposalHistory";

export default function ProposalHistoryPage() {
  return (
    <AuthRedirect>
      <ProposalHistory />
    </AuthRedirect>
  );
}
