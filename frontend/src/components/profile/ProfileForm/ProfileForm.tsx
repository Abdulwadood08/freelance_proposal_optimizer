'use client';

import { useState, FormEvent, useEffect } from 'react';
import { createUser, getUser, type User } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import styles from './ProfileForm.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

export default function ProfileForm() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  interface CaseStudy {
    title: string;
    description: string;
    achievements?: string;
    technologies?: string[];
    duration?: string;
  }

  const [formData, setFormData] = useState({
    user_id: '',
    name: '',
    email: '',
    skills: [] as string[],
    resume_url: '',
    resume_file: null as File | null,
    case_studies: [] as (string | CaseStudy)[],
    fiverr_gigs: [] as string[],
    upwork_profile: '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [caseStudyInput, setCaseStudyInput] = useState('');
  const [fiverrGigInput, setFiverrGigInput] = useState('');
  const [showCaseStudyForm, setShowCaseStudyForm] = useState(false);
  const [newCaseStudy, setNewCaseStudy] = useState<CaseStudy>({
    title: '',
    description: '',
    achievements: '',
    technologies: [] as string[],
    duration: '',
  });
  const [techInput, setTechInput] = useState('');

  // Initialize form with user data and auto-load profile
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        user_id: currentUser.uid,
        email: currentUser.email || '',
      }));
      
      // Auto-load user profile if it exists
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
    } catch (error: any) {
      // User doesn't exist yet, that's okay - they'll create it
      console.log('Profile not found, will create new one');
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      setFormData({ ...formData, skills: [...formData.skills, skillInput.trim()] });
      setSkillInput('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData({ ...formData, skills: formData.skills.filter(s => s !== skill) });
  };

  const addCaseStudy = () => {
    if (caseStudyInput.trim() && !formData.case_studies.some(cs => 
      typeof cs === 'string' ? cs === caseStudyInput.trim() : cs.title === caseStudyInput.trim()
    )) {
      setFormData({ ...formData, case_studies: [...formData.case_studies, caseStudyInput.trim()] });
      setCaseStudyInput('');
    }
  };

  const removeCaseStudy = (index: number) => {
    setFormData({ 
      ...formData, 
      case_studies: formData.case_studies.filter((_, i) => i !== index) 
    });
  };

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setMessage({ type: 'error', text: 'Resume file must be less than 5MB' });
        return;
      }
      if (!file.type.includes('pdf') && !file.type.includes('doc') && !file.type.includes('docx')) {
        setMessage({ type: 'error', text: 'Resume must be a PDF or DOC/DOCX file' });
        return;
      }
      setFormData({ ...formData, resume_file: file });
      setMessage({ type: 'success', text: `Resume file selected: ${file.name}` });
    }
  };

  const addTechToCaseStudy = () => {
    if (techInput.trim() && !newCaseStudy.technologies?.includes(techInput.trim())) {
      setNewCaseStudy({
        ...newCaseStudy,
        technologies: [...(newCaseStudy.technologies || []), techInput.trim()]
      });
      setTechInput('');
    }
  };

  const removeTechFromCaseStudy = (tech: string) => {
    setNewCaseStudy({
      ...newCaseStudy,
      technologies: newCaseStudy.technologies?.filter(t => t !== tech) || []
    });
  };

  const saveStructuredCaseStudy = () => {
    if (!newCaseStudy.title.trim() || !newCaseStudy.description.trim()) {
      setMessage({ type: 'error', text: 'Title and description are required' });
      return;
    }
    
    setFormData({ 
      ...formData, 
      case_studies: [...formData.case_studies, { ...newCaseStudy }] 
    });
    setNewCaseStudy({
      title: '',
      description: '',
      achievements: '',
      technologies: [],
      duration: '',
    });
    setShowCaseStudyForm(false);
    setMessage({ type: 'success', text: 'Case study added successfully!' });
  };

  const addFiverrGig = () => {
    if (fiverrGigInput.trim() && !formData.fiverr_gigs.includes(fiverrGigInput.trim())) {
      setFormData({ ...formData, fiverr_gigs: [...formData.fiverr_gigs, fiverrGigInput.trim()] });
      setFiverrGigInput('');
    }
  };

  const removeFiverrGig = (gig: string) => {
    setFormData({ ...formData, fiverr_gigs: formData.fiverr_gigs.filter(g => g !== gig) });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    setMessage(null);

    try {
      // Convert resume file to data URL if uploaded
      let resumeUrl = formData.resume_url;
      if (formData.resume_file) {
        const reader = new FileReader();
        resumeUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(formData.resume_file!);
        });
      }

      const submitData = {
        ...formData,
        resume_url: resumeUrl,
        resume_file: undefined, // Don't send file object
      };

      await createUser(submitData, currentUser);
      setMessage({ type: 'success', text: 'Profile saved successfully!' });
      setTimeout(() => {
        router.push('/generate');
      }, 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save profile' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h1 className="card-title">User Profile</h1>
      <p className={styles.description}>
        Create or update your profile to generate personalized proposals.
      </p>

      {message && (
        <div className={`${styles.message} ${styles[`message${message.type.charAt(0).toUpperCase() + message.type.slice(1)}`]}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
          <input
            type="email"
            className={styles.formInput}
            value={formData.email}
            disabled
            style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
          />
          <small style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', display: 'block' }}>
            Email is managed by your account
          </small>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Skills *</label>
          <div className={styles.tagInput}>
            {formData.skills.map((skill, index) => (
              <span key={index} className={styles.tag}>
                {skill}
                <span className={styles.tagRemove} onClick={() => removeSkill(skill)}>×</span>
              </span>
            ))}
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSkill();
                }
              }}
              placeholder="Add skill and press Enter"
            />
          </div>
          <Button type="button" variant="secondary" onClick={addSkill} className={styles.addButton}>
            Add Skill
          </Button>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Resume</label>
          <div className={styles.fileUploadSection}>
            <div className={styles.fileUploadOption}>
              <label className={styles.fileUploadLabel}>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeFileChange}
                  className={styles.fileInput}
                />
                <span className={styles.fileUploadButton}>📄 Upload Resume</span>
              </label>
              {formData.resume_file && (
                <span className={styles.fileName}>{formData.resume_file.name}</span>
              )}
            </div>
            <div className={styles.orDivider}>OR</div>
            <input
              type="url"
              className={styles.formInput}
              value={formData.resume_url}
              onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
              placeholder="https://example.com/resume.pdf"
            />
          </div>
          <small className={styles.helpText}>
            Upload a PDF/DOC file or provide a URL to your resume
          </small>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Case Studies</label>
          
          {/* Existing case studies display */}
          <div className={styles.caseStudiesList}>
            {formData.case_studies.map((study, index) => (
              <div key={index} className={styles.caseStudyCard}>
                {typeof study === 'string' ? (
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
                    {study.achievements && (
                      <p className={styles.caseStudyAchievements}>Achievements: {study.achievements}</p>
                    )}
                    {study.technologies && study.technologies.length > 0 && (
                      <div className={styles.caseStudyTech}>
                        {study.technologies.map((tech, i) => (
                          <span key={i} className={styles.techTag}>{tech}</span>
                        ))}
                      </div>
                    )}
                    {study.duration && (
                      <p className={styles.caseStudyDuration}>Duration: {study.duration}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Quick add (simple text) */}
          <div className={styles.tagInput}>
            <input
              type="text"
              value={caseStudyInput}
              onChange={(e) => setCaseStudyInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCaseStudy();
                }
              }}
              placeholder="Quick add: Enter case study text"
            />
          </div>
          <Button type="button" variant="secondary" onClick={addCaseStudy} className={styles.addButton}>
            Add Simple Case Study
          </Button>

          {/* Detailed case study form */}
          <Button 
            type="button" 
            variant="secondary" 
            onClick={() => setShowCaseStudyForm(!showCaseStudyForm)} 
            className={styles.addButton}
          >
            {showCaseStudyForm ? 'Cancel' : '+ Add Detailed Case Study'}
          </Button>

          {showCaseStudyForm && (
            <div className={styles.detailedCaseStudyForm}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Title *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newCaseStudy.title}
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, title: e.target.value })}
                  placeholder="e.g., E-commerce Platform Development"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Description *</label>
                <textarea
                  className={styles.formTextarea}
                  value={newCaseStudy.description}
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, description: e.target.value })}
                  placeholder="Describe the project, your role, and key responsibilities..."
                  rows={4}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Key Achievements</label>
                <textarea
                  className={styles.formTextarea}
                  value={newCaseStudy.achievements}
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, achievements: e.target.value })}
                  placeholder="e.g., Increased conversion rate by 30%, Reduced load time by 50%..."
                  rows={2}
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Technologies Used</label>
                <div className={styles.tagInput}>
                  {newCaseStudy.technologies?.map((tech, index) => (
                    <span key={index} className={styles.tag}>
                      {tech}
                      <span className={styles.tagRemove} onClick={() => removeTechFromCaseStudy(tech)}>×</span>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={techInput}
                    onChange={(e) => setTechInput(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addTechToCaseStudy();
                      }
                    }}
                    placeholder="Add technology"
                  />
                </div>
                <Button type="button" variant="secondary" onClick={addTechToCaseStudy} className={styles.addButton}>
                  Add Technology
                </Button>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Duration</label>
                <input
                  type="text"
                  className={styles.formInput}
                  value={newCaseStudy.duration}
                  onChange={(e) => setNewCaseStudy({ ...newCaseStudy, duration: e.target.value })}
                  placeholder="e.g., 3 months, Jan 2023 - Mar 2023"
                />
              </div>

              <Button type="button" variant="primary" onClick={saveStructuredCaseStudy}>
                Save Case Study
              </Button>
            </div>
          )}
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Fiverr Gigs</label>
          <div className={styles.tagInput}>
            {formData.fiverr_gigs.map((gig, index) => (
              <span key={index} className={styles.tag}>
                {gig}
                <span className={styles.tagRemove} onClick={() => removeFiverrGig(gig)}>×</span>
              </span>
            ))}
            <input
              type="text"
              value={fiverrGigInput}
              onChange={(e) => setFiverrGigInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addFiverrGig();
                }
              }}
              placeholder="Add Fiverr gig and press Enter"
            />
          </div>
          <Button type="button" variant="secondary" onClick={addFiverrGig} className={styles.addButton}>
            Add Fiverr Gig
          </Button>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Upwork Profile URL</label>
          <input
            type="url"
            className={styles.formInput}
            value={formData.upwork_profile}
            onChange={(e) => setFormData({ ...formData, upwork_profile: e.target.value })}
            placeholder="https://www.upwork.com/freelancers/..."
          />
        </div>

        <Button type="submit" variant="primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </Card>
  );
}

