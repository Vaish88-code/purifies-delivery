// Utility function to test Firebase Authentication setup
import { auth } from '@shared/lib/firebase';

export const testAuthSetup = async (): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> => {
  try {
    // Check if auth is initialized
    if (!auth) {
      return {
        success: false,
        message: 'Firebase Auth is not initialized',
      };
    }

    // Check auth settings
    const authDomain = auth.config?.authDomain || 'unknown';
    
    return {
      success: true,
      message: 'Firebase Auth is properly initialized',
      details: {
        authDomain,
        currentUser: auth.currentUser ? 'Logged in' : 'Not logged in',
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Unknown error checking auth setup',
      details: error,
    };
  }
};

