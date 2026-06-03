"use client";

import {
  useState,
  FormEvent,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  createUser,
  getUser,
  fetchProfileSuggestions,
  extractResumeProfile,
  type ProfileSuggestionsRequest,
  type ResumeExtractResponse,
} from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import AppToast, {
  type ToastMessage,
  useToastAutoDismiss,
} from "@/components/shared/AppToast/AppToast";
import styles from "./ProfileForm.module.css";

const WrenchIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const DocIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const BriefcaseIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const FolderIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);
const LinkIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const LightbulbIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.65 4.65 0 0 1 7.91 14" />
  </svg>
);
const StarIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.sectionIcon}
  >
    <polygon points="12 2 15 9 22 9 17 14 18 22 12 18 6 22 7 14 2 9 9 9" />
  </svg>
);
const UploadIconSvg = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    className={styles.uploadIcon}
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/** Decorative PDF file badge (not an embedded viewer). */
const PdfBadgeIcon = () => (
  <svg viewBox="0 0 48 56" className={styles.pdfBadgeSvg} aria-hidden>
    <path fill="#c62828" d="M12 6h14l10 10v32H12V6z" />
    <path fill="#ff8a80" d="M26 6h10l8 8H26V6z" />
    <rect x="11" y="34" width="26" height="15" rx="2" fill="#fafafa" />
    <text
      x="24"
      y="45.5"
      textAnchor="middle"
      fill="#c62828"
      fontSize="10"
      fontWeight="700"
      fontFamily="system-ui, sans-serif"
    >
      PDF
    </text>
  </svg>
);

interface CaseStudy {
  title: string;
  description: string;
  achievements?: string;
  technologies?: string[];
  duration?: string;
}

interface WorkExp {
  title: string;
  company: string;
  period: string;
}

function mergeResumeSkills(existing: string[], incoming: string[]): string[] {
  const seen = new Set(existing.map((s) => s.toLowerCase()));
  const out = [...existing];
  for (const s of incoming || []) {
    const t = String(s || "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  }
  return out.slice(0, 25);
}

function mergeResumeWorkExp(
  prev: WorkExp[],
  incoming: ResumeExtractResponse["work_experience"],
): WorkExp[] {
  const rows: WorkExp[] = (incoming || [])
    .map((w) => ({
      title: String(w?.title ?? "").trim(),
      company: String(w?.company ?? "").trim(),
      period: String(w?.period ?? "").trim(),
    }))
    .filter((w) => w.title || w.company || w.period)
    .slice(0, 12);
  if (!rows.length) return prev;
  const prevMeaningful = prev.filter((w) => w.title.trim() || w.company.trim());
  if (prevMeaningful.length === 0) return rows;
  const key = (w: WorkExp) => `${w.title}|${w.company}`.toLowerCase();
  const keys = new Set(prevMeaningful.map(key));
  const additions = rows.filter((r) => !keys.has(key(r)));
  return [...prev, ...additions].slice(0, 15);
}

function mergeResumeCaseStudies(
  prev: (string | CaseStudy)[],
  projects: ResumeExtractResponse["projects"],
  summary?: string,
): (string | CaseStudy)[] {
  const next = [...prev];
  const plist = projects || [];
  for (const p of plist) {
    const title = String(p?.title ?? "").trim();
    const description = String(p?.description ?? "").trim();
    if (!title && !description) continue;
    next.push({
      title: title || "Project",
      description,
      achievements: "",
      technologies: [],
      duration: "",
    });
  }
  const sum = (summary || "").trim();
  if (!plist.length && sum) {
    next.push({
      title: "Professional summary",
      description: sum.slice(0, 2500),
      achievements: "",
      technologies: [],
      duration: "",
    });
  }
  return next;
}

function mergeResumePortfolio(
  prev: string[],
  links: ResumeExtractResponse["links"],
): string[] {
  const n = [(prev[0] || "").trim(), (prev[1] || "").trim()];
  const fill = (i: number, val?: string) => {
    const u = (val || "").trim();
    if (u && !(n[i] || "").trim()) n[i] = u;
  };
  fill(0, links?.upwork);
  const second =
    links?.linkedin?.trim() ||
    links?.github?.trim() ||
    links?.portfolio?.trim() ||
    "";
  fill(1, second || undefined);
  return n;
}

export default function ProfileForm() {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [profileReady, setProfileReady] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [message, setMessage] = useState<ToastMessage>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    user_id: "",
    name: "",
    email: "",
    skills: [] as string[],
    resume_url: "",
    resume_file: null as File | null,
    case_studies: [] as (string | CaseStudy)[],
    fiverr_gigs: [] as string[],
    upwork_profile: "",
  });
  const [workExperience, setWorkExperience] = useState<WorkExp[]>([]);
  const [portfolioLinks, setPortfolioLinks] = useState(["", ""]); // Upwork + LinkedIn
  const [skillInput, setSkillInput] = useState("");
  const [showCaseStudyForm, setShowCaseStudyForm] = useState(false);
  const [newCaseStudy, setNewCaseStudy] = useState<CaseStudy>({
    title: "",
    description: "",
    achievements: "",
    technologies: [] as string[],
    duration: "",
  });
  const [techInput, setTechInput] = useState("");
  const [dragging, setDragging] = useState(false);
  const [resumeParsing, setResumeParsing] = useState(false);

  const loadUserProfile = useCallback(async () => {
    if (!currentUser) return;
    try {
      const user = await getUser(currentUser.uid, currentUser);
      setFormData({
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        skills: user.skills,
        resume_url: user.resume_url,
        resume_file: null,
        case_studies: user.case_studies || [],
        fiverr_gigs: user.fiverr_gigs || [],
        upwork_profile: user.upwork_profile,
      });
      setPortfolioLinks([
        user.upwork_profile || "",
        (user.fiverr_gigs && user.fiverr_gigs[0]) || "",
      ]);
    } catch {
      console.log("Profile not found, will create new one");
    } finally {
      setProfileReady(true);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    setProfileReady(false);
    setAiSuggestions([]);
    setSuggestionsError(null);
    setSuggestionsLoading(false);
    setFormData((prev) => ({
      ...prev,
      user_id: currentUser.uid,
      email: currentUser.email || "",
    }));
    void loadUserProfile();
  }, [currentUser, loadUserProfile]);

  const hasProfileInfo = !!(formData.name?.trim() && formData.email);
  const hasSkills = formData.skills.length > 0;
  const hasExperience = workExperience.length > 0;
  const hasResume = !!(formData.resume_url?.trim() || formData.resume_file);
  const hasPortfolio = portfolioLinks.some((l) => l?.trim());
  const completionCount = [
    hasProfileInfo,
    hasSkills,
    hasExperience,
    hasResume,
    hasPortfolio,
  ].filter(Boolean).length;
  const completionPercent = Math.round((completionCount / 5) * 100);

  const suggestionSnapshotKey = useMemo(() => {
    if (!currentUser) return "";
    const payload: ProfileSuggestionsRequest = {
      user_id: currentUser.uid,
      name: formData.name,
      email: formData.email,
      skills: formData.skills,
      case_studies: formData.case_studies,
      resume_present: !!(formData.resume_url?.trim() || formData.resume_file),
      upwork_profile: (
        portfolioLinks[0]?.trim() ||
        formData.upwork_profile ||
        ""
      ).trim(),
      portfolio_links: portfolioLinks.map((l) => l.trim()).filter(Boolean),
      work_experience: workExperience.map((w) => ({
        title: w.title,
        company: w.company,
        period: w.period,
      })),
    };
    return JSON.stringify(payload);
  }, [
    currentUser,
    formData.name,
    formData.email,
    formData.skills,
    formData.case_studies,
    formData.resume_url,
    formData.resume_file,
    formData.upwork_profile,
    portfolioLinks,
    workExperience,
  ]);

  useEffect(() => {
    if (!profileReady || !currentUser || !suggestionSnapshotKey) return;
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void (async () => {
        setSuggestionsLoading(true);
        setSuggestionsError(null);
        try {
          const parsed = JSON.parse(
            suggestionSnapshotKey,
          ) as ProfileSuggestionsRequest;
          const res = await fetchProfileSuggestions(parsed, currentUser);
          if (!cancelled) setAiSuggestions(res.suggestions ?? []);
        } catch (e) {
          if (!cancelled) {
            setSuggestionsError(
              (e as Error).message || "Suggestions unavailable",
            );
            setAiSuggestions([]);
          }
        } finally {
          if (!cancelled) setSuggestionsLoading(false);
        }
      })();
    }, 900);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [profileReady, currentUser, suggestionSnapshotKey]);

  useToastAutoDismiss(message, setMessage);

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({
        ...formData,
        skills: [...formData.skills, skillInput.trim()],
      });
      setSkillInput("");
    }
  };

  const removeSkill = (s: string) => {
    setFormData({
      ...formData,
      skills: formData.skills.filter((x) => x !== s),
    });
  };

  const removeCaseStudy = (index: number) => {
    setFormData({
      ...formData,
      case_studies: formData.case_studies.filter((_, i) => i !== index),
    });
  };

  const isPdfResume =
    !!formData.resume_file &&
    String(formData.resume_file.type).toLowerCase().includes("pdf");

  const clearResumeFile = useCallback(() => {
    setFormData((prev) => ({ ...prev, resume_file: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const runPdfExtract = useCallback(
    async (file: File) => {
      setResumeParsing(true);
      setMessage(null);
      try {
        const ext = await extractResumeProfile(file, currentUser);
        setFormData((prev) => ({
          ...prev,
          resume_file: file,
          name: prev.name.trim()
            ? prev.name
            : ext.full_name.trim() || prev.name,
          skills: mergeResumeSkills(prev.skills, ext.skills || []),
          case_studies: mergeResumeCaseStudies(
            prev.case_studies,
            ext.projects || [],
            ext.professional_summary,
          ),
        }));
        setWorkExperience((prev) =>
          mergeResumeWorkExp(prev, ext.work_experience || []),
        );
        setPortfolioLinks((prev) =>
          mergeResumePortfolio(prev, ext.links || {}),
        );
        setMessage({
          type: "success",
          text: "Résumé parsed — empty fields were filled where possible. Review before saving.",
        });
      } catch (err) {
        setMessage({
          type: "error",
          text: (err as Error).message || "Could not parse this PDF.",
        });
      } finally {
        setResumeParsing(false);
      }
    },
    [currentUser],
  );

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: "error", text: "Resume must be less than 5MB" });
      return;
    }
    if (
      !file.type.includes("pdf") &&
      !file.type.includes("doc") &&
      !file.type.includes("docx")
    ) {
      setMessage({ type: "error", text: "Resume must be PDF or DOC/DOCX" });
      return;
    }
    setFormData((prev) => ({ ...prev, resume_file: file }));
    if (file.type.includes("pdf")) {
      setMessage({
        type: "success",
        text: `Selected: ${file.name}. Click Extract to fill profile fields from this PDF.`,
      });
    } else {
      setMessage({
        type: "success",
        text: `Selected: ${file.name}. Extract is for PDF only; you can still save this file with your profile.`,
      });
    }
  };

  const handleExtractResume = () => {
    const f = formData.resume_file;
    if (!f || !f.type.toLowerCase().includes("pdf")) {
      setMessage({ type: "error", text: "Choose a PDF résumé first." });
      return;
    }
    if (!currentUser) {
      setMessage({
        type: "error",
        text: "Sign in to extract profile fields from your PDF.",
      });
      return;
    }
    void runPdfExtract(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = {
        target: { files: [file] },
      } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleResumeFileChange(fakeEvent);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const addWorkExp = () => {
    setWorkExperience([
      ...workExperience,
      { title: "", company: "", period: "" },
    ]);
  };

  const updateWorkExp = (
    index: number,
    field: keyof WorkExp,
    value: string,
  ) => {
    const next = [...workExperience];
    next[index] = { ...next[index], [field]: value };
    setWorkExperience(next);
  };

  const removeWorkExp = (index: number) => {
    setWorkExperience(workExperience.filter((_, i) => i !== index));
  };

  const addTechToCaseStudy = () => {
    if (
      techInput.trim() &&
      !newCaseStudy.technologies?.includes(techInput.trim())
    ) {
      setNewCaseStudy({
        ...newCaseStudy,
        technologies: [...(newCaseStudy.technologies || []), techInput.trim()],
      });
      setTechInput("");
    }
  };

  const saveStructuredCaseStudy = () => {
    if (!newCaseStudy.title.trim() || !newCaseStudy.description.trim()) {
      setMessage({ type: "error", text: "Title and description required" });
      return;
    }
    setFormData({
      ...formData,
      case_studies: [...formData.case_studies, { ...newCaseStudy }],
    });
    setNewCaseStudy({
      title: "",
      description: "",
      achievements: "",
      technologies: [],
      duration: "",
    });
    setShowCaseStudyForm(false);
    setMessage({ type: "success", text: "Case study added" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    setMessage(null);
    try {
      let resumeUrl = formData.resume_url;
      if (formData.resume_file) {
        resumeUrl = await new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = (ev) => resolve(ev.target?.result as string);
          r.onerror = reject;
          r.readAsDataURL(formData.resume_file!);
        });
      }
      const upwork = portfolioLinks[0]?.trim() || formData.upwork_profile;
      const linkedInSlot = portfolioLinks[1]?.trim() || "";
      const fiverrGigs = [
        ...(linkedInSlot ? [linkedInSlot] : []),
        ...formData.fiverr_gigs.filter(
          (g) => g.trim() && g.trim() !== linkedInSlot,
        ),
      ];
      await createUser(
        {
          user_id: formData.user_id,
          name: formData.name,
          email: formData.email,
          skills: formData.skills,
          resume_url: resumeUrl,
          case_studies: formData.case_studies,
          upwork_profile: upwork,
          fiverr_gigs: fiverrGigs,
        },
        currentUser,
      );
      setMessage({ type: "success", text: "Profile saved successfully!" });
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: (err as Error).message || "Failed to save profile",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className={styles.wrapper}>
        {/* Main column */}
        <div className={styles.mainColumn}>
          <header className={styles.header}>
            <h1 className={styles.title}>Profile Builder</h1>
            <p className={styles.subtitle}>
              Complete your profile to generate better AI proposals.
            </p>
          </header>

          {/* Profile completion (after saved profile is loaded — avoids misleading %) */}
          <section className={styles.strengthSection}>
            <h2 className={styles.strengthTitle}>Profile Completion</h2>
            <p className={styles.strengthQuestion}>
              See which sections are filled in and what still needs attention.
            </p>
            {!profileReady ? (
              <>
                <div className={styles.progressBar} aria-hidden>
                  <div className={styles.progressIndeterminate} />
                </div>
                <div className={styles.progressLabel}>
                  Loading your profile…
                </div>
                <p className={styles.checklistHint}>
                  Fetching saved data from the server.
                </p>
              </>
            ) : (
              <>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <div className={styles.progressLabel}>{completionPercent}%</div>
                <div className={styles.checklist}>
                  <span
                    className={`${styles.checkItem} ${hasProfileInfo ? styles.done : ""}`}
                  >
                    Profile Info
                  </span>
                  <span
                    className={`${styles.checkItem} ${hasSkills ? styles.done : ""}`}
                  >
                    Skills & Expertise
                  </span>
                  <span
                    className={`${styles.checkItem} ${hasExperience ? styles.done : ""}`}
                  >
                    Experience Added
                  </span>
                  <span
                    className={`${styles.checkItem} ${hasResume ? styles.done : styles.pending}`}
                  >
                    Add Resume
                  </span>
                  <span
                    className={`${styles.checkItem} ${hasPortfolio ? styles.done : styles.pending}`}
                  >
                    Add Portfolio
                  </span>
                </div>
              </>
            )}
          </section>

          {/* Name / Email - minimal for "Profile Info" */}
          <section className={styles.section}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name *</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
                placeholder="Your full name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email *</label>
              <input
                type="email"
                className={styles.formInput}
                value={formData.email}
                disabled
                style={{ opacity: 0.9 }}
              />
            </div>
          </section>

          {/* Skills & Expertise */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <WrenchIcon /> Skills & Expertise
              </h3>
            </div>
            <div className={styles.skillsRow}>
              {formData.skills.map((s) => (
                <span key={s} className={styles.tag}>
                  {s}
                  <span
                    className={styles.tagRemove}
                    onClick={() => removeSkill(s)}
                  >
                    ×
                  </span>
                </span>
              ))}
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addSkill())
                }
                placeholder="Add your top five skills or areas of expertise"
              />
              <button
                type="button"
                className={styles.addSkillBtn}
                onClick={addSkill}
                aria-label="Add skill"
              >
                +
              </button>
            </div>
          </section>

          {/* Resume Upload */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <DocIcon /> Resume Upload
              </h3>
            </div>
            <div
              className={`${styles.uploadZone} ${dragging ? styles.dragging : ""} ${formData.resume_file ? styles.uploadZoneHasFile : ""}`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleResumeFileChange}
                className={styles.fileInput}
              />
              {isPdfResume && formData.resume_file ? (
                <div className={styles.resumeFileTile}>
                  <button
                    type="button"
                    className={styles.resumeFileRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearResumeFile();
                    }}
                    aria-label="Remove résumé file"
                  >
                    ×
                  </button>
                  <div className={styles.resumeFileBadge}>
                    <PdfBadgeIcon />
                  </div>
                  <p className={styles.uploadPreviewFileName}>
                    {formData.resume_file.name}
                  </p>
                  <p className={styles.uploadPreviewHint}>
                    Drag another file here or use Upload to replace.
                  </p>
                </div>
              ) : formData.resume_file &&
                !formData.resume_file.type.toLowerCase().includes("pdf") ? (
                <div className={styles.resumeFileTile}>
                  <button
                    type="button"
                    className={styles.resumeFileRemove}
                    onClick={(e) => {
                      e.stopPropagation();
                      clearResumeFile();
                    }}
                    aria-label="Remove résumé file"
                  >
                    ×
                  </button>
                  <div
                    className={`${styles.resumeFileBadge} ${styles.resumeFileBadgeDoc}`}
                  >
                    <DocIcon />
                  </div>
                  <p className={styles.uploadPreviewFileName}>
                    {formData.resume_file.name}
                  </p>
                  <p className={styles.hint}>
                    Extract works for PDF only; you can still save this file
                    with your profile.
                  </p>
                </div>
              ) : (
                <>
                  <UploadIconSvg />
                  <p>Drag your résumé here or use Upload below</p>
                  <p className={styles.hint}>PDF, DOC, or DOCX · max 5MB</p>
                </>
              )}
            </div>
            <div className={styles.uploadBtnRow}>
              <button
                type="button"
                className={styles.uploadBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={resumeParsing}
              >
                Upload Resume
              </button>
              <button
                type="button"
                className={styles.extractBtn}
                onClick={handleExtractResume}
                disabled={resumeParsing || !isPdfResume || !currentUser}
                title={
                  !currentUser
                    ? "Sign in to extract fields"
                    : !isPdfResume
                      ? "Upload a PDF first"
                      : undefined
                }
              >
                {resumeParsing ? "Extracting…" : "Extract"}
              </button>
            </div>
            <p className={styles.resumeParsingHint}>
              {resumeParsing
                ? "Reading PDF and filling profile fields…"
                : "Choose Extract after uploading a PDF to fill empty fields (name, skills, experience, projects, links). Scanned PDFs without text are not supported."}
            </p>
          </section>

          {/* Work Experience */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <BriefcaseIcon /> Work Experience
              </h3>
              <button
                type="button"
                className={styles.addExpBtn}
                onClick={addWorkExp}
              >
                + Add Experience
              </button>
            </div>
            <div className={styles.expList}>
              {workExperience.map((exp, i) => (
                <div key={i} className={styles.expCard}>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={exp.title}
                    onChange={(e) => updateWorkExp(i, "title", e.target.value)}
                    placeholder="Job title"
                    style={{ marginBottom: "0.5rem" }}
                  />
                  <input
                    type="text"
                    className={styles.formInput}
                    value={exp.company}
                    onChange={(e) =>
                      updateWorkExp(i, "company", e.target.value)
                    }
                    placeholder="Company"
                    style={{ marginBottom: "0.5rem" }}
                  />
                  <input
                    type="text"
                    className={styles.formInput}
                    value={exp.period}
                    onChange={(e) => updateWorkExp(i, "period", e.target.value)}
                    placeholder="e.g. 2021 - Present"
                  />
                  <button
                    type="button"
                    className={styles.tagRemove}
                    onClick={() => removeWorkExp(i)}
                    style={{ marginTop: "0.5rem" }}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Case Studies & Projects */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <FolderIcon /> Case Studies & Projects
              </h3>
              <button
                type="button"
                className={styles.addProjectBtn}
                onClick={() => setShowCaseStudyForm(!showCaseStudyForm)}
              >
                + Add Project
              </button>
            </div>
            {formData.case_studies.length > 0 && (
              <div className={styles.caseStudiesList}>
                {formData.case_studies.map((study, index) => (
                  <div key={index} className={styles.caseStudyCard}>
                    {typeof study === "string" ? (
                      <>
                        <span className={styles.caseStudyText}>{study}</span>
                        <span
                          className={styles.tagRemove}
                          onClick={() => removeCaseStudy(index)}
                        >
                          ×
                        </span>
                      </>
                    ) : (
                      <>
                        <div className={styles.caseStudyHeader}>
                          <strong>{study.title}</strong>
                          <span
                            className={styles.tagRemove}
                            onClick={() => removeCaseStudy(index)}
                          >
                            ×
                          </span>
                        </div>
                        <p className={styles.caseStudyDescription}>
                          {study.description}
                        </p>
                        {study.achievements && (
                          <p className={styles.caseStudyAchievements}>
                            {study.achievements}
                          </p>
                        )}
                        {study.duration && (
                          <p className={styles.caseStudyDuration}>
                            {study.duration}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
            {showCaseStudyForm && (
              <div className={styles.detailedCaseStudyForm}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Title *</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newCaseStudy.title}
                    onChange={(e) =>
                      setNewCaseStudy({
                        ...newCaseStudy,
                        title: e.target.value,
                      })
                    }
                    placeholder="Project title"
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Description *</label>
                  <textarea
                    className={styles.formTextarea}
                    value={newCaseStudy.description}
                    onChange={(e) =>
                      setNewCaseStudy({
                        ...newCaseStudy,
                        description: e.target.value,
                      })
                    }
                    placeholder="Describe the project and your role"
                    rows={3}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Technologies</label>
                  <div className={styles.tagInput}>
                    {(newCaseStudy.technologies || []).map((t) => (
                      <span key={t} className={styles.tag}>
                        {t}
                        <span
                          className={styles.tagRemove}
                          onClick={() =>
                            setNewCaseStudy({
                              ...newCaseStudy,
                              technologies:
                                newCaseStudy.technologies?.filter(
                                  (x) => x !== t,
                                ) || [],
                            })
                          }
                        >
                          ×
                        </span>
                      </span>
                    ))}
                    <input
                      type="text"
                      value={techInput}
                      onChange={(e) => setTechInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        (e.preventDefault(), addTechToCaseStudy())
                      }
                      placeholder="Add technology"
                    />
                  </div>
                  <button
                    type="button"
                    className={styles.addButton}
                    onClick={addTechToCaseStudy}
                  >
                    Add
                  </button>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Duration</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    value={newCaseStudy.duration}
                    onChange={(e) =>
                      setNewCaseStudy({
                        ...newCaseStudy,
                        duration: e.target.value,
                      })
                    }
                    placeholder="e.g. 3 months"
                  />
                </div>
                <button
                  type="button"
                  className={styles.saveProfileBtn}
                  onClick={saveStructuredCaseStudy}
                >
                  Save Case Study
                </button>
              </div>
            )}
            <div className={styles.projectsGrid}>
              <div
                className={styles.projectCardPlaceholder}
                onClick={() => setShowCaseStudyForm(true)}
              >
                <span className={styles.plus}>+</span>
              </div>
              <div
                className={styles.projectCardPlaceholder}
                onClick={() => setShowCaseStudyForm(true)}
              >
                <span className={styles.plus}>+</span>
              </div>
            </div>
          </section>

          {/* Portfolio Links */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3 className={styles.sectionTitle}>
                <LinkIcon /> Portfolio Links
              </h3>
            </div>
            <div className={styles.portfolioInputs}>
              <input
                type="url"
                placeholder="Upwork profile URL"
                value={portfolioLinks[0]}
                onChange={(e) => {
                  const next = [...portfolioLinks];
                  next[0] = e.target.value;
                  setPortfolioLinks(next);
                }}
              />
              <input
                type="url"
                placeholder="LinkedIn profile URL"
                value={portfolioLinks[1]}
                onChange={(e) => {
                  const next = [...portfolioLinks];
                  next[1] = e.target.value;
                  setPortfolioLinks(next);
                }}
              />
            </div>
          </section>
        </div>

        {/* Right sidebar */}
        <div className={styles.sidebarColumn}>
          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarCardTitle}>
              <LightbulbIcon /> Smart suggestions
            </h3>
            {suggestionsLoading && (
              <p className={styles.suggestionStatus}>Generating suggestions…</p>
            )}
            {suggestionsError && !suggestionsLoading && (
              <p className={styles.suggestionError}>{suggestionsError}</p>
            )}
            {!suggestionsLoading &&
              !suggestionsError &&
              aiSuggestions.length === 0 &&
              profileReady && (
                <p className={styles.suggestionStatus}>
                  No suggestions yet — try changing your profile fields or check
                  that OPENAI_API_KEY is set on the API.
                </p>
              )}
            {aiSuggestions.map((text, i) => (
              <div
                key={`${i}-${text.slice(0, 24)}`}
                className={styles.suggestionBox}
              >
                {text}
              </div>
            ))}
          </div>

          <div className={styles.sidebarCard}>
            <h3 className={styles.sidebarCardTitle}>
              <StarIcon /> Profile Traits
            </h3>
            <div className={styles.traitRow}>
              <div className={styles.traitLabel}>Completeness</div>
              <div className={styles.traitBar}>
                {profileReady ? (
                  <div
                    className={styles.traitFill}
                    style={{ width: `${completionPercent}%` }}
                  />
                ) : (
                  <div className={styles.traitFillIndeterminate} />
                )}
              </div>
            </div>
            <div className={styles.traitRow}>
              <div className={styles.traitLabel}>Value Coverage</div>
              <div className={styles.traitBar}>
                {profileReady ? (
                  <div
                    className={styles.traitFill}
                    style={{
                      width: `${Math.min(100, completionPercent + 20)}%`,
                    }}
                  />
                ) : (
                  <div className={styles.traitFillIndeterminate} />
                )}
              </div>
            </div>
            <div className={styles.traitRow}>
              <div className={styles.traitLabel}>Language Usage Score</div>
              <div className={styles.traitBar}>
                <div className={styles.traitFill} style={{ width: "28%" }} />
              </div>
            </div>
            <button
              type="button"
              className={styles.saveProfileBtn}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        </div>
      </div>

      <AppToast message={message} onDismiss={() => setMessage(null)} />
    </>
  );
}
