import { createFileRoute } from '@tanstack/react-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useState } from 'react';

import { auth } from '../lib/firebase';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

// PIT-22 disposable test screen — delete once the real login/register ticket lands.
function RouteComponent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      console.log('Firebase ID token:', idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
        <button type="submit">Create user</button>
      </form>
      {error && <div>{error}</div>}
    </div>
  );
}
