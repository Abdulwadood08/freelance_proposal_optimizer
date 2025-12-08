'use client';

import styles from './profile.module.css';
import ProfileForm from '@/components/profile/ProfileForm/ProfileForm';

export default function ProfilePage() {
  return (
    <div className={styles.container}>
      <ProfileForm />
    </div>
  );
}
