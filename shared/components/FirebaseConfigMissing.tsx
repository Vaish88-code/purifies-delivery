const REQUIRED_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const;

export function getMissingFirebaseEnvKeys(): string[] {
  return REQUIRED_KEYS.filter((key) => !import.meta.env[key] || import.meta.env[key] === '');
}

export function FirebaseConfigMissing({ missing }: { missing: string[] }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-lg w-full rounded-xl border bg-card p-6 shadow-lg space-y-4">
        <h1 className="text-xl font-semibold text-foreground">Firebase configuration missing</h1>
        <p className="text-sm text-muted-foreground">
          The app cannot connect to Firebase because these environment variables are not set in{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code>:
        </p>
        <ul className="text-sm list-disc list-inside space-y-1 text-destructive">
          {missing.map((key) => (
            <li key={key}>{key}</li>
          ))}
        </ul>
        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
          <li>Copy <code className="text-xs bg-muted px-1 py-0.5 rounded">.env.example</code> to <code className="text-xs bg-muted px-1 py-0.5 rounded">.env</code></li>
          <li>Add your Firebase project values from Firebase Console</li>
          <li>Restart the dev server: <code className="text-xs bg-muted px-1 py-0.5 rounded">npm run dev</code></li>
        </ol>
      </div>
    </div>
  );
}
