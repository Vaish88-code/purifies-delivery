import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '../firebase';
import { Language, UserRole } from '@shared/contexts/AuthContext';

export interface AuthUser {
  uid: string;
  phone: string;
  name: string;
  role: UserRole;
  language: Language;
  email?: string;
}

// Convert phone number to email format for Firebase Auth
export const phoneToEmail = (phone: string): string => {
  return `${phone}@purifies.app`;
};

// Convert email back to phone number
export const emailToPhone = (email: string): string => {
  return email.replace('@purifies.app', '');
};

export const registerUser = async (
  phone: string,
  password: string,
  language: Language,
  name: string,
  role: UserRole
): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
  try {
    const email = phoneToEmail(phone);
    console.log('📝 Attempting registration with:', { phone, email: email.substring(0, 10) + '...', name, role });
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    console.log('✅ User created in Firebase Auth:', { uid: firebaseUser.uid });

    // Update display name
    await updateProfile(firebaseUser, {
      displayName: name,
    });

    console.log('✅ User profile updated');

    return {
      success: true,
      user: {
        uid: firebaseUser.uid,
        phone,
        name,
        role,
        language,
        email: firebaseUser.email || undefined,
      },
    };
  } catch (error: any) {
    console.error('❌ Registration error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Registration failed';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'An account with this phone number already exists. Please login instead.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid phone number format.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'Password is too weak. Please use at least 6 characters.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Email/Password authentication is not enabled. Please contact support.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const loginUser = async (
  phone: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> => {
  try {
    const email = phoneToEmail(phone);
    console.log('🔐 Attempting login with:', { phone, email: email.substring(0, 10) + '...' });
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    console.log('✅ Login successful:', { uid: firebaseUser.uid });

    return {
      success: true,
      user: {
        uid: firebaseUser.uid,
        phone,
        name: firebaseUser.displayName || 'User',
        role: 'customer', // Will be fetched from Firestore
        language: 'en', // Will be fetched from Firestore
        email: firebaseUser.email || undefined,
      },
    };
  } catch (error: any) {
    console.error('❌ Login error:', error);
    
    // Provide user-friendly error messages
    let errorMessage = 'Login failed';
    // NOTE: Newer Firebase Auth SDKs often throw `auth/invalid-credential` for both
    // "user not found" and "wrong password" scenarios. Keep a friendly message.
    if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-login-credentials') {
      errorMessage = 'Invalid phone number or password. Please check your credentials.';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'No account found with this phone number. Please register first.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'Incorrect password. Please try again.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'Invalid phone number format.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'This account has been disabled.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'Too many failed login attempts. Please try again later.';
    } else if (error.code === 'auth/network-request-failed') {
      errorMessage = 'Network error. Please check your internet connection.';
    } else if (error.code === 'auth/operation-not-allowed') {
      errorMessage = 'Email/Password authentication is not enabled in Firebase. Please enable it in Firebase Console.';
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage,
    };
  }
};

export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};
