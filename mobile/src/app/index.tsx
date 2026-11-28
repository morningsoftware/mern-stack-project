import { Redirect } from 'expo-router';
import { useSession } from '../lib/session';

// "/" exists for signed-in and signed-out users alike, then sends each to their own entry point.
export default function Entry() {
  const { user } = useSession();
  return <Redirect href={user ? '/projects' : '/sign-in'} />;
}
