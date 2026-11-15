import { useAuthStore } from '../../store/authStore';

export type { UserRecord } from '../mocks/vmmsMocks';

export async function getCurrentUser() {
  const user = useAuthStore.getState().currentUser;
  if (!user) throw new Error('No signed in VMMS user is available.');
  return user;
}
