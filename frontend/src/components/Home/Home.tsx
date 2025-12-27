'use client';

import Link from 'next/link';
import styles from './Home.module.css';
import Card from '@/components/shared/Card/Card';
import Button from '@/components/shared/Button/Button';

export default function Home() {
  return (
    <div className={styles.container}>
      <div className={styles.hero}>
        <h1>Freelance Proposal Optimizer</h1>
        <p>
          Generate tailored, professional Upwork proposals using AI. 
          Create compelling proposals that match your skills and experience.
        </p>
        <div className={styles.heroActions}>
          <Link href="/profile">
            <Button variant="primary">Create Your Profile</Button>
          </Link>
          <Link href="/generate">
            <Button variant="secondary">Generate Proposal</Button>
          </Link>
        </div>
      </div>

      <Card>
        <h2 className="card-title">How It Works</h2>
        <div className={styles.features}>
          <div className={styles.feature}>
            <h3>1. Create Profile</h3>
            <p>
              Add your skills, case studies, and professional information to build your profile.
            </p>
          </div>
          <div className={styles.feature}>
            <h3>2. Paste Job Post</h3>
            <p>
              Copy the job description from Upwork and paste it into our generator.
            </p>
          </div>
          <div className={styles.feature}>
            <h3>3. Get Proposal</h3>
            <p>
              Receive a tailored proposal with multiple tone variations ready to use.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

