'use client';

import styles from './Profile.module.css';
import ProfileForm from '@/components/profile/ProfileForm/ProfileForm';

export default function Profile() {
  return (
    <div className={styles.container}>
      <ProfileForm />
    </div>
  );
}
