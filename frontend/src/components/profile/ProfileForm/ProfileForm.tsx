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
  const [formData, setFormData] = useState({
    user_id: '',
    name: '',
    email: '',
    skills: [] as string[],
    resume_url: '',
    case_studies: [] as string[],
    fiverr_gigs: [] as string[],
    upwork_profile: '',
  });
  const [skillInput, setSkillInput] = useState('');
  const [caseStudyInput, setCaseStudyInput] = useState('');
  const [fiverrGigInput, setFiverrGigInput] = useState('');

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
        case_studies: user.case_studies,
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
    if (caseStudyInput.trim() && !formData.case_studies.includes(caseStudyInput.trim())) {
      setFormData({ ...formData, case_studies: [...formData.case_studies, caseStudyInput.trim()] });
      setCaseStudyInput('');
    }
  };

  const removeCaseStudy = (study: string) => {
    setFormData({ ...formData, case_studies: formData.case_studies.filter(s => s !== study) });
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
      await createUser(formData, currentUser);
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
          <label className={styles.formLabel}>Resume URL</label>
          <input
            type="url"
            className={styles.formInput}
            value={formData.resume_url}
            onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
            placeholder="https://example.com/resume.pdf"
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Case Studies</label>
          <div className={styles.tagInput}>
            {formData.case_studies.map((study, index) => (
              <span key={index} className={styles.tag}>
                {study}
                <span className={styles.tagRemove} onClick={() => removeCaseStudy(study)}>×</span>
              </span>
            ))}
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
              placeholder="Add case study and press Enter"
            />
          </div>
          <Button type="button" variant="secondary" onClick={addCaseStudy} className={styles.addButton}>
            Add Case Study
          </Button>
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

