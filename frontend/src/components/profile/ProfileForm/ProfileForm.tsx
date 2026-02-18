"use client";

import { useState, FormEvent, useEffect, useRef } from "react";
import { createUser, getUser, type User } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import styles from "./ProfileForm.module.css";

const WrenchIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);
const DocIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);
const BriefcaseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);
const FolderIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    <line x1="12" y1="11" x2="12" y2="17" />
    <line x1="9" y1="14" x2="15" y2="14" />
  </svg>
);
const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const LightbulbIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.65 4.65 0 0 1 7.91 14" />
  </svg>
);
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.sectionIcon}>
    <polygon points="12 2 15 9 22 9 17 14 18 22 12 18 6 22 7 14 2 9 9 9" />
  </svg>
);
const UploadIconSvg = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.uploadIcon}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
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

export default function ProfileForm() {
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
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
  const [workExperience, setWorkExperience] = useState<WorkExp[]>([
    { title: "Salesforce Front-End Developer", company: "Salesforce", period: "2021 - Present" },
    { title: "Full Stack Developer", company: "CURSOR", period: "2020 - 2021" },
  ]);
  const [portfolioLinks, setPortfolioLinks] = useState(["", "", ""]); // Upwork + 2 more
  const [skillInput, setSkillInput] = useState("");
  const [caseStudyInput, setCaseStudyInput] = useState("");
  const [fiverrGigInput, setFiverrGigInput] = useState("");
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

  useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        user_id: currentUser.uid,
        email: currentUser.email || "",
      }));
      loadUserProfile();
    }
  }, [currentUser]);

  const loadUserProfile = async () => {
    if (!currentUser) return;
    setLoading(true);
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
        fiverr_gigs: user.fiverr_gigs,
        upwork_profile: user.upwork_profile,
      });
      setPortfolioLinks([
        user.upwork_profile || "",
        (user.fiverr_gigs && user.fiverr_gigs[0]) || "",
        (user.fiverr_gigs && user.fiverr_gigs[1]) || "",
      ]);
    } catch {
      console.log("Profile not found, will create new one");
    } finally {
      setLoading(false);
    }
  };

  const hasProfileInfo = !!(formData.name?.trim() && formData.email);
  const hasSkills = formData.skills.length > 0;
  const hasExperience = workExperience.length > 0;
  const hasResume = !!(formData.resume_url?.trim() || formData.resume_file);
  const hasPortfolio = portfolioLinks.some((l) => l?.trim());
  const strengthCount = [hasProfileInfo, hasSkills, hasExperience, hasResume, hasPortfolio].filter(Boolean).length;
  const strengthPercent = Math.round((strengthCount / 5) * 100);

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput("");
    }
  };

  const removeSkill = (s: string) => {
    setFormData({ ...formData, skills: formData.skills.filter((x) => x !== s) });
  };

  const addCaseStudy = () => {
    if (caseStudyInput.trim() && !formData.case_studies.some((cs) => (typeof cs === "string" ? cs === caseStudyInput.trim() : cs.title === caseStudyInput.trim()))) {
      setFormData({ ...formData, case_studies: [...formData.case_studies, caseStudyInput.trim()] });
      setCaseStudyInput("");
    }
  };

  const removeCaseStudy = (index: number) => {
    setFormData({ ...formData, case_studies: formData.case_studies.filter((_, i) => i !== index) });
  };

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setMessage({ type: "error", text: "Resume must be less than 5MB" });
        return;
      }
      if (!file.type.includes("pdf") && !file.type.includes("doc") && !file.type.includes("docx")) {
        setMessage({ type: "error", text: "Resume must be PDF or DOC/DOCX" });
        return;
      }
      setFormData({ ...formData, resume_file: file });
      setMessage({ type: "success", text: `Selected: ${file.name}` });
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleResumeFileChange(fakeEvent);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };
  const onDragLeave = () => setDragging(false);

  const addWorkExp = () => {
    setWorkExperience([...workExperience, { title: "", company: "", period: "" }]);
  };

  const updateWorkExp = (index: number, field: keyof WorkExp, value: string) => {
    const next = [...workExperience];
    next[index] = { ...next[index], [field]: value };
    setWorkExperience(next);
  };

  const removeWorkExp = (index: number) => {
    setWorkExperience(workExperience.filter((_, i) => i !== index));
  };

  const addTechToCaseStudy = () => {
    if (techInput.trim() && !newCaseStudy.technologies?.includes(techInput.trim())) {
      setNewCaseStudy({ ...newCaseStudy, technologies: [...(newCaseStudy.technologies || []), techInput.trim()] });
      setTechInput("");
    }
  };

  const saveStructuredCaseStudy = () => {
    if (!newCaseStudy.title.trim() || !newCaseStudy.description.trim()) {
      setMessage({ type: "error", text: "Title and description required" });
      return;
    }
    setFormData({ ...formData, case_studies: [...formData.case_studies, { ...newCaseStudy }] });
    setNewCaseStudy({ title: "", description: "", achievements: "", technologies: [], duration: "" });
    setShowCaseStudyForm(false);
    setMessage({ type: "success", text: "Case study added" });
  };

  const addFiverrGig = () => {
    if (fiverrGigInput.trim() && !formData.fiverr_gigs.includes(fiverrGigInput.trim())) {
      setFormData({ ...formData, fiverr_gigs: [...formData.fiverr_gigs, fiverrGigInput.trim()] });
      setFiverrGigInput("");
    }
  };

  const removeFiverrGig = (g: string) => {
    setFormData({ ...formData, fiverr_gigs: formData.fiverr_gigs.filter((x) => x !== g) });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);
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
      const fiverrGigs = [
        ...(portfolioLinks[1]?.trim() ? [portfolioLinks[1]] : []),
        ...(portfolioLinks[2]?.trim() ? [portfolioLinks[2]] : []),
        ...formData.fiverr_gigs,
      ].filter(Boolean);
      await createUser(
        {
          ...formData,
          resume_url: resumeUrl,
          resume_file: undefined,
          upwork_profile: upwork,
          fiverr_gigs: fiverrGigs,
        },
        currentUser
      );
      setMessage({ type: "success", text: "Profile saved successfully!" });
    } catch (err: unknown) {
      setMessage({ type: "error", text: (err as Error).message || "Failed to save profile" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      {/* Main column */}
      <div className={styles.mainColumn}>
        <header className={styles.header}>
          <h1 className={styles.title}>Profile Builder</h1>
          <p className={styles.subtitle}>Complete your profile to generate better AI proposals.</p>
        </header>

        {/* Profile Strength */}
        <section className={styles.strengthSection}>
          <h2 className={styles.strengthTitle}>Profile Strength</h2>
          <p className={styles.strengthQuestion}>Is your profile strong enough?</p>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${strengthPercent}%` }} />
          </div>
          <div className={styles.progressLabel}>{strengthPercent}%</div>
          <div className={styles.checklist}>
            <span className={`${styles.checkItem} ${hasProfileInfo ? styles.done : ""}`}>Profile Info</span>
            <span className={`${styles.checkItem} ${hasSkills ? styles.done : ""}`}>Skills & Expertise</span>
            <span className={`${styles.checkItem} ${hasExperience ? styles.done : ""}`}>Experience Added</span>
            <span className={`${styles.checkItem} ${hasResume ? styles.done : styles.pending}`}>Add Resume</span>
            <span className={`${styles.checkItem} ${hasPortfolio ? styles.done : styles.pending}`}>Add Portfolio</span>
          </div>
        </section>

        {/* Name / Email - minimal for "Profile Info" */}
        <section className={styles.section}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Name *</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Your full name"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email *</label>
            <input type="email" className={styles.formInput} value={formData.email} disabled style={{ opacity: 0.9 }} />
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
                <span className={styles.tagRemove} onClick={() => removeSkill(s)}>×</span>
              </span>
            ))}
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSkill())}
              placeholder="Add your top five skills or areas of expertise"
            />
            <button type="button" className={styles.addSkillBtn} onClick={addSkill} aria-label="Add skill">
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
            className={`${styles.uploadZone} ${dragging ? styles.dragging : ""}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <UploadIconSvg />
            <p>Drag your files here to start uploading</p>
            <p className={styles.hint}>OR DRAG & DROP FOLDER HERE</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleResumeFileChange}
              className={styles.fileInput}
            />
          </div>
          <div className={styles.uploadBtnRow}>
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              Upload Resume
            </button>
          </div>
          <div className={styles.fileUploadOption}>
            <label className={styles.fileUploadLabel}>
              Or paste URL:{" "}
              <input
                type="url"
                className={styles.formInput}
                value={formData.resume_url}
                onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
                placeholder="https://..."
                style={{ display: "inline-block", width: "auto", minWidth: 200 }}
              />
            </label>
            {formData.resume_file && <span className={styles.fileName}>{formData.resume_file.name}</span>}
          </div>
        </section>

        {/* Work Experience */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <BriefcaseIcon /> Work Experience
            </h3>
            <button type="button" className={styles.addExpBtn} onClick={addWorkExp}>
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
                  onChange={(e) => updateWorkExp(i, "company", e.target.value)}
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
                <button type="button" className={styles.tagRemove} onClick={() => removeWorkExp(i)} style={{ marginTop: "0.5rem" }}>
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
            <button type="button" className={styles.addProjectBtn} onClick={() => setShowCaseStudyForm(!showCaseStudyForm)}>
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
                      <span className={styles.tagRemove} onClick={() => removeCaseStudy(index)}>×</span>
                    </>
                  ) : (
                    <>
                      <div className={styles.caseStudyHeader}>
                        <strong>{study.title}</strong>
                        <span className={styles.tagRemove} onClick={() => removeCaseStudy(index)}>×</span>
                      </div>
                      <p className={styles.caseStudyDescription}>{study.description}</p>
                      {study.achievements && <p className={styles.caseStudyAchievements}>{study.achievements}</p>}
                      {study.duration && <p className={styles.caseStudyDuration}>{study.duration}</p>}
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
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, title: e.target.value })}
                  placeholder="Project title"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description *</label>
                <textarea
                  className={styles.formTextarea}
                  value={newCaseStudy.description}
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, description: e.target.value })}
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
                      <span className={styles.tagRemove} onClick={() => setNewCaseStudy({ ...newCaseStudy, technologies: newCaseStudy.technologies?.filter((x) => x !== t) || [] })}>×</span>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTechToCaseStudy())}
                    placeholder="Add technology"
                  />
                </div>
                <button type="button" className={styles.addButton} onClick={addTechToCaseStudy}>Add</button>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duration</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newCaseStudy.duration}
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, duration: e.target.value })}
                  placeholder="e.g. 3 months"
                />
              </div>
              <button type="button" className={styles.saveProfileBtn} onClick={saveStructuredCaseStudy}>
                Save Case Study
              </button>
            </div>
          )}
          <div className={styles.projectsGrid}>
            <div className={styles.projectCardPlaceholder} onClick={() => setShowCaseStudyForm(true)}>
              <span className={styles.plus}>+</span>
            </div>
            <div className={styles.projectCardPlaceholder} onClick={() => setShowCaseStudyForm(true)}>
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
              placeholder="Portfolio or Fiverr URL"
              value={portfolioLinks[1]}
              onChange={(e) => {
                const next = [...portfolioLinks];
                next[1] = e.target.value;
                setPortfolioLinks(next);
              }}
            />
            <input
              type="url"
              placeholder="Another portfolio link"
              value={portfolioLinks[2]}
              onChange={(e) => {
                const next = [...portfolioLinks];
                next[2] = e.target.value;
                setPortfolioLinks(next);
              }}
            />
          </div>
        </section>
      </div>

      {/* Right sidebar */}
      <div className={styles.sidebarColumn}>
        {message && (
          <div className={`${styles.message} ${message.type === "success" ? styles.messageSuccess : styles.messageError}`}>
            {message.text}
          </div>
        )}

        <div className={styles.sidebarCard}>
          <h3 className={styles.sidebarCardTitle}>
            <LightbulbIcon /> Suggestions
          </h3>
          <div className={styles.suggestionBox}>Add certifications to stand out.</div>
          <div className={styles.suggestionBox}>Upload portfolio content.</div>
          <div className={styles.suggestionBox}>Add more info to case studies.</div>
        </div>

        <div className={styles.sidebarCard}>
          <h3 className={styles.sidebarCardTitle}>
            <StarIcon /> Profile Traits
          </h3>
          <div className={styles.traitRow}>
            <div className={styles.traitLabel}>Completeness</div>
            <div className={styles.traitBar}>
              <div className={styles.traitFill} style={{ width: `${strengthPercent}%` }} />
            </div>
          </div>
          <div className={styles.traitRow}>
            <div className={styles.traitLabel}>Value Coverage</div>
            <div className={styles.traitBar}>
              <div className={styles.traitFill} style={{ width: `${Math.min(100, strengthPercent + 20)}%` }} />
            </div>
          </div>
          <div className={styles.traitRow}>
            <div className={styles.traitLabel}>Language Usage Score</div>
            <div className={styles.traitBar}>
              <div className={styles.traitFill} style={{ width: "28%" }} />
            </div>
          </div>
          <button type="button" className={styles.saveProfileBtn} onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
