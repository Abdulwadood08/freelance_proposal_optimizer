'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createUser, getUser } from '@/lib/api';
import styles from './OnboardingWizard.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

interface CaseStudy {
  title: string;
  description: string;
  achievements?: string;
  technologies?: string[];
  duration?: string;
}

const TOTAL_STEPS = 4;

export default function OnboardingWizard() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    user_id: '',
    name: '',
    email: '',
    skills: [] as string[],
    case_studies: [] as (string | CaseStudy)[],
    resume_url: '',
    upwork_profile: '',
    fiverr_gigs: [] as string[],
  });

  // Step-specific inputs
  const [skillInput, setSkillInput] = useState('');
  const [caseStudyInput, setCaseStudyInput] = useState('');
  const [showCaseStudyForm, setShowCaseStudyForm] = useState(false);
  const [newCaseStudy, setNewCaseStudy] = useState<CaseStudy>({
    title: '',
    description: '',
    achievements: '',
    technologies: [],
    duration: '',
  });
  const [techInput, setTechInput] = useState('');

  // Initialize with user data
  useEffect(() => {
    if (currentUser) {
      setFormData(prev => ({
        ...prev,
        user_id: currentUser.uid,
        email: currentUser.email || '',
      }));
    }
  }, [currentUser]);

  // Check if user already has profile
  useEffect(() => {
    const checkExistingProfile = async () => {
      if (!currentUser) return;
      try {
        const user = await getUser(currentUser.uid, currentUser);
        // User already has profile, redirect to dashboard
        router.push('/');
      } catch {
        // No profile exists, continue with onboarding
      }
    };
    checkExistingProfile();
  }, [currentUser, router]);

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
      setError('Title and description are required');
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
    setError('');
  };

  const addFiverrGig = (gig: string) => {
    if (gig.trim() && !formData.fiverr_gigs.includes(gig.trim())) {
      setFormData({ ...formData, fiverr_gigs: [...formData.fiverr_gigs, gig.trim()] });
    }
  };

  const removeFiverrGig = (gig: string) => {
    setFormData({ ...formData, fiverr_gigs: formData.fiverr_gigs.filter(g => g !== gig) });
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.name.trim().length > 0;
      case 2:
        return formData.skills.length >= 1;
      case 3:
        return formData.case_studies.length >= 1;
      case 4:
        return true; // Optional step
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) {
      setError(getValidationError(currentStep));
      return;
    }
    setError('');
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  const handleSkip = () => {
    if (currentStep === 4) {
      // Skip optional step and complete
      handleComplete();
    } else {
      handleNext();
    }
  };

  const handleComplete = async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError('');

    try {
      await createUser(formData, currentUser);
      // Redirect to dashboard with success
      router.push('/?onboarding=complete');
    } catch (err: any) {
      setError(err.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const getValidationError = (step: number): string => {
    switch (step) {
      case 1:
        return 'Please enter your name';
      case 2:
        return 'Please add at least one skill';
      case 3:
        return 'Please add at least one case study';
      default:
        return 'Please complete this step';
    }
  };

  const getStepTitle = (step: number): string => {
    switch (step) {
      case 1:
        return 'Welcome! Let\'s get started';
      case 2:
        return 'Tell us about your skills';
      case 3:
        return 'Share your experience';
      case 4:
        return 'Optional information';
      default:
        return '';
    }
  };

  const getStepDescription = (step: number): string => {
    switch (step) {
      case 1:
        return 'We\'ll use this information to create personalized proposals for you.';
      case 2:
        return 'Add your key skills. These help us match you with relevant job posts.';
      case 3:
        return 'Add case studies or projects you\'ve worked on. This helps create more compelling proposals.';
      case 4:
        return 'You can add these later if you want. Let\'s finish up!';
      default:
        return '';
    }
  };

  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className={styles.wizardContainer}>
      <div className={styles.wizardContent}>
        {/* Progress Bar */}
        <div className={styles.progressContainer}>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className={styles.progressText}>
            Step {currentStep} of {TOTAL_STEPS} ({Math.round(progress)}%)
          </div>
        </div>

        <Card className={styles.wizardCard}>
          <div className={styles.stepHeader}>
            <h1 className={styles.stepTitle}>{getStepTitle(currentStep)}</h1>
            <p className={styles.stepDescription}>{getStepDescription(currentStep)}</p>
          </div>

          {error && (
            <div className={styles.errorMessage}>{error}</div>
          )}

          {/* Step 1: Basic Info */}
          {currentStep === 1 && (
            <div className={styles.stepContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Your Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Email</label>
                <input
                  type="email"
                  className={styles.input}
                  value={formData.email}
                  disabled
                  style={{ backgroundColor: 'var(--bg-secondary)', cursor: 'not-allowed' }}
                />
                <small className={styles.helpText}>Email is managed by your account</small>
              </div>
            </div>
          )}

          {/* Step 2: Skills */}
          {currentStep === 2 && (
            <div className={styles.stepContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Add Your Skills *</label>
                <p className={styles.helpText}>Add at least 3-5 skills for best results</p>
                
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
                    placeholder="Type a skill and press Enter"
                    className={styles.tagInputField}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={addSkill} className={styles.addButton}>
                  Add Skill
                </Button>
              </div>
            </div>
          )}

          {/* Step 3: Case Studies */}
          {currentStep === 3 && (
            <div className={styles.stepContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Add Case Studies *</label>
                <p className={styles.helpText}>Add at least one project or case study</p>
                
                {/* Existing case studies */}
                {formData.case_studies.length > 0 && (
                  <div className={styles.caseStudiesList}>
                    {formData.case_studies.map((study, index) => (
                      <div key={index} className={styles.caseStudyCard}>
                        {typeof study === 'string' ? (
                          <>
                            <span>{study}</span>
                            <span className={styles.tagRemove} onClick={() => removeCaseStudy(index)}>×</span>
                          </>
                        ) : (
                          <>
                            <div className={styles.caseStudyHeader}>
                              <strong>{study.title}</strong>
                              <span className={styles.tagRemove} onClick={() => removeCaseStudy(index)}>×</span>
                            </div>
                            <p className={styles.caseStudyDescription}>{study.description}</p>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick add */}
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
                    placeholder="Quick add: Enter case study description"
                    className={styles.tagInputField}
                  />
                </div>
                <Button type="button" variant="secondary" onClick={addCaseStudy} className={styles.addButton}>
                  Add Simple Case Study
                </Button>

                {/* Detailed form */}
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={() => setShowCaseStudyForm(!showCaseStudyForm)} 
                  className={styles.addButton}
                >
                  {showCaseStudyForm ? 'Cancel' : '+ Add Detailed Case Study'}
                </Button>

                {showCaseStudyForm && (
                  <div className={styles.detailedForm}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Title *</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={newCaseStudy.title}
                        onChange={(e) => setNewCaseStudy({ ...newCaseStudy, title: e.target.value })}
                        placeholder="E-commerce Platform"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Description *</label>
                      <textarea
                        className={styles.textarea}
                        value={newCaseStudy.description}
                        onChange={(e) => setNewCaseStudy({ ...newCaseStudy, description: e.target.value })}
                        placeholder="Describe the project..."
                        rows={3}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>Technologies</label>
                      <div className={styles.tagInput}>
                        {newCaseStudy.technologies?.map((tech, i) => (
                          <span key={i} className={styles.tag}>
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
                          className={styles.tagInputField}
                        />
                      </div>
                    </div>
                    <Button type="button" variant="primary" onClick={saveStructuredCaseStudy}>
                      Save Case Study
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Optional Info */}
          {currentStep === 4 && (
            <div className={styles.stepContent}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Resume URL (Optional)</label>
                <input
                  type="url"
                  className={styles.input}
                  value={formData.resume_url}
                  onChange={(e) => setFormData({ ...formData, resume_url: e.target.value })}
                  placeholder="https://example.com/resume.pdf"
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Upwork Profile URL (Optional)</label>
                <input
                  type="url"
                  className={styles.input}
                  value={formData.upwork_profile}
                  onChange={(e) => setFormData({ ...formData, upwork_profile: e.target.value })}
                  placeholder="https://www.upwork.com/freelancers/..."
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Fiverr Gigs (Optional)</label>
                <div className={styles.tagInput}>
                  {formData.fiverr_gigs.map((gig, index) => (
                    <span key={index} className={styles.tag}>
                      {gig}
                      <span className={styles.tagRemove} onClick={() => removeFiverrGig(gig)}>×</span>
                    </span>
                  ))}
                  <input
                    type="text"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const target = e.target as HTMLInputElement;
                        addFiverrGig(target.value);
                        target.value = '';
                      }
                    }}
                    placeholder="Add Fiverr gig URL and press Enter"
                    className={styles.tagInputField}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className={styles.navigation}>
            {currentStep > 1 && (
              <Button 
                type="button" 
                variant="secondary" 
                onClick={handleBack}
                disabled={loading}
              >
                ← Back
              </Button>
            )}
            
            <div className={styles.navigationRight}>
              {currentStep === 4 && (
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleSkip}
                  disabled={loading}
                  className={styles.skipButton}
                >
                  Skip
                </Button>
              )}
              <Button 
                type="button" 
                variant="primary" 
                onClick={handleNext}
                disabled={loading}
              >
                {loading ? 'Saving...' : currentStep === TOTAL_STEPS ? 'Complete Setup' : 'Next →'}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

