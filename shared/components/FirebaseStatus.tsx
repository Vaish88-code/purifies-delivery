import { useEffect, useState } from 'react';
import { auth, db } from '@shared/lib/firebase';

export function FirebaseStatus() {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error' | 'permissions'>('checking');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Check if auth is initialized
        if (!auth) {
          throw new Error('Firebase Auth is not initialized');
        }

        // Check if Firestore is initialized
        if (!db) {
          throw new Error('Firestore is not initialized');
        }

        // Basic initialization check passed
        setStatus('connected');
        console.log('✅ Firebase services initialized successfully');
      } catch (error: any) {
        console.error('❌ Firebase initialization check failed:', error);
        setStatus('error');
        setError(error.message || 'Unknown error');
      }
    };

    checkConnection();
  }, []);

  // Listen for permission errors from Firestore operations
  useEffect(() => {
    const handlePermissionError = (event: CustomEvent) => {
      if (event.detail?.code === 'permission-denied' || event.detail?.message?.includes('permission')) {
        setStatus('permissions');
        setError('Missing or insufficient permissions');
      }
    };

    window.addEventListener('firebase-permission-error' as any, handlePermissionError);
    return () => {
      window.removeEventListener('firebase-permission-error' as any, handlePermissionError);
    };
  }, []);

  // Only show in development
  if (import.meta.env.MODE === 'production') {
    return null;
  }

  if (status === 'checking' || status === 'connected') {
    return null; // Don't show anything while checking or if connected
  }

  if (status === 'permissions') {
    return (
      <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-3 rounded-lg shadow-lg text-sm z-50 max-w-md">
        <strong className="block mb-2">⚠️ Firestore Permission Error</strong>
        <p className="mb-2">{error}</p>
        <p className="text-xs mb-2">You need to update Firestore security rules in Firebase Console.</p>
        <ol className="text-xs list-decimal list-inside space-y-1 mb-2">
          <li>Go to Firebase Console → Firestore Database → Rules</li>
          <li>Copy rules from <code className="bg-black/20 px-1 rounded">firestore.rules</code> file</li>
          <li>Click "Publish"</li>
        </ol>
        <a 
          href="https://console.firebase.google.com/project/purifies-b425b/firestore/rules" 
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline hover:no-underline"
        >
          Open Firebase Console →
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg text-sm z-50 max-w-md">
        <strong>Firebase Connection Error:</strong> {error}
        <br />
        <span className="text-xs">Check console for details</span>
      </div>
    );
  }

  return null;
}
