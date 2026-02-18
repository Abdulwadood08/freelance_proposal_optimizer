"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getUserProposals, scoreProposal, type Proposal } from "@/lib/api";
import styles from "./Analytics.module.css";
import ScoreCard from "./ScoreCard";
import QualityRadarChart from "./QualityRadarChart";
import KeywordCoverageChart from "./KeywordCoverageChart";
import ComparisonBars from "./ComparisonBars";

interface Suggestion {
  type: "success" | "warning";
  title: string;
  description: string;
}

export default function Analytics() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [scores, setScores] = useState({
    quality: 87,
    personalization: 92,
    keywords: 78,
  });
  const [qualityBreakdown, setQualityBreakdown] = useState({
    originality: 85,
    personalization: 92,
    valueProposition: 80,
    professionalTone: 90,
    callToAction: 75,
    empathy: 88,
    formatting: 85,
  });
  const [keywordCoverage, setKeywordCoverage] = useState([
    { keyword: "Technical", coverage: 95 },
    { keyword: "Teamwork", coverage: 85 },
    { keyword: "Problem Solving", coverage: 80 },
    { keyword: "Market Research", coverage: 75 },
    { keyword: "Testing", coverage: 70 },
    { keyword: "Analytics", coverage: 65 },
  ]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([
    {
      type: "success",
      title: "Strong Opening",
      description: "Starts strong and immediately captures attention and establishes credibility.",
    },
    {
      type: "success",
      title: "Add Specific Instances",
      description: "Include specific quantifiable achievements that demonstrate how you've solved similar problems.",
    },
    {
      type: "success",
      title: "Good Keyword Coverage",
      description: "You've covered 78% of the important keywords from the job description.",
    },
    {
      type: "warning",
      title: "Enhance Call to Action",
      description: "Make your call to action more direct and action-oriented, with clear next steps or availability.",
    },
    {
      type: "success",
      title: "Professional Tone",
      description: "Your writing style is appropriate for the industry and engaging.",
    },
  ]);
  const [comparisons, setComparisons] = useState({
    personalization: { you: 80, avg: 70 },
    clarity: { you: 78, avg: 75 },
    valueProp: { you: 70, avg: 60 },
    professionalism: { you: 85, avg: 75 },
  });

  useEffect(() => {
    if (currentUser) {
      loadProposals();
    }
  }, [currentUser]);

  const loadProposals = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const result = await getUserProposals(currentUser.uid, currentUser, 10);
      setProposals(result.proposals || []);
      if (result.proposals && result.proposals.length > 0) {
        setSelectedProposal(result.proposals[0]);
        await analyzeProposal(result.proposals[0]);
      }
    } catch (err) {
      console.error("Failed to load proposals:", err);
    } finally {
      setLoading(false);
    }
  };

  const analyzeProposal = async (proposal: Proposal) => {
    if (!currentUser || !proposal.job_post) return;
    try {
      const scoreResult = await scoreProposal(
        currentUser.uid,
        proposal.proposal || proposal.tone_variations?.professional || "",
        proposal.job_post,
        currentUser
      );
      // Update scores based on API result
      setScores({
        quality: Math.round(scoreResult.score * 10),
        personalization: Math.round(scoreResult.section_scores.personalization * 50),
        keywords: 78, // This would come from keyword analysis
      });
    } catch (err) {
      console.error("Failed to analyze proposal:", err);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Proposal Analysis</h1>
        <p className={styles.subtitle}>
          Detailed insights and recommendations for your proposal
        </p>
      </header>

      {/* Top Metrics Section */}
      <div className={styles.metricsGrid}>
        <ScoreCard
          title="Proposal Quality Score"
          score={scores.quality}
          message="Excellent! Ready to message."
        />
        <ScoreCard
          title="Personalization Score"
          score={scores.personalization}
          message="Extremely Personalized."
        />
        <ScoreCard
          title="Keywords Match Percentage"
          score={scores.keywords}
          message="Great! Close for top keywords."
          isPercentage
        />
      </div>

      {/* Analytics Breakdown Section */}
      <div className={styles.breakdownGrid}>
        {/* Quality Breakdown Radar Chart */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Quality Breakdown</h3>
          <QualityRadarChart data={qualityBreakdown} />
        </div>

        {/* Keyword Coverage Chart */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Keyword Coverage (top 50%)</h3>
          <KeywordCoverageChart data={keywordCoverage} />
        </div>
      </div>

      {/* AI Suggestions */}
      <div className={styles.suggestionsCard}>
        <h3 className={styles.chartTitle}>AI Suggestions for Improvement</h3>
        <div className={styles.suggestionsList}>
          {suggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`${styles.suggestionItem} ${
                suggestion.type === "success" ? styles.suggestionSuccess : styles.suggestionWarning
              }`}
            >
              <div className={styles.suggestionIcon}>
                {suggestion.type === "success" ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                )}
              </div>
              <div className={styles.suggestionContent}>
                <h4 className={styles.suggestionTitle}>{suggestion.title}</h4>
                <p className={styles.suggestionDescription}>{suggestion.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Comparison Section */}
      <div className={styles.comparisonCard}>
        <h3 className={styles.chartTitle}>How You Compare to Average Proposals</h3>
        <ComparisonBars data={comparisons} />
      </div>
    </div>
  );
}
