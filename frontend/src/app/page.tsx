"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getUser } from "@/lib/api";
import Dashboard from "@/components/Dashboard/Dashboard";

export default function DashboardPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    if (!loading && !currentUser) {
      router.push("/login");
    }
  }, [currentUser, loading, router]);

  // Check if user has completed onboarding
  useEffect(() => {
    const checkProfile = async () => {
      if (!currentUser || loading) return;
      
      try {
        await getUser(currentUser.uid, currentUser);
        // User has profile, show dashboard
        setCheckingProfile(false);
        
        // Show success message if coming from onboarding
        if (typeof window !== 'undefined' && window.location.search.includes('onboarding=complete')) {
          // You can add a toast notification here
          console.log('Onboarding completed!');
        }
      } catch (error) {
        // User doesn't have profile, redirect to onboarding
        router.push('/onboarding');
      }
    };

    if (currentUser && !loading) {
      checkProfile();
    }
  }, [currentUser, loading, router]);

  if (loading || checkingProfile) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <div>Loading...</div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return <Dashboard />;
}
