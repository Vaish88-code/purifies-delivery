import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@shared/lib/firebase';
import { registerUser, loginUser, logoutUser, emailToPhone } from '@shared/lib/firebase/auth';
import { createUserDocument, getUserDocument, updateUserDocument } from '@shared/lib/firebase/firestore';
import { createVendorDocument } from '@shared/lib/firebase/firestore';
import type { UpiPaymentMethod } from '@shared/lib/firebase/firestore';

export type UserRole = 'customer' | 'vendor' | 'delivery' | 'admin';
export type Language = 'en' | 'hi' | 'mr' | 'kn';

interface User {
  id: string;
  phone: string;
  name: string;
  role: UserRole;
  language: Language;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  paymentMethods?: UpiPaymentMethod[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  language: Language;
  loading: boolean;
  setLanguage: (lang: Language) => void;
  login: (phone: string, password: string) => Promise<{ success: boolean; role: UserRole; error?: string }>;
  register: (
    phone: string,
    password: string,
    language: Language,
    name: string,
    role: UserRole,
    address: string,
    pincode: string,
    state: string,
    shopName?: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  switchRole: (role: UserRole) => void;
  updateProfile: (data: Partial<Pick<User, 'name' | 'address' | 'pincode' | 'city' | 'state' | 'phone' | 'paymentMethods'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Locale mapping for each supported language (used for number/currency formatting)
export const LANGUAGE_LOCALE: Record<Language, string> = {
  en: 'en-IN',
  hi: 'hi-IN',
  mr: 'mr-IN',
  kn: 'kn-IN',
};

export const translations: Record<Language, Record<string, string>> = {
  en: {
    login: 'Login',
    register: 'Register',
    phone: 'Phone Number',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    forgotPassword: 'Forgot Password?',
    newUser: 'New user?',
    existingUser: 'Already have an account?',
    selectLanguage: 'Select Language',
    dashboard: 'Dashboard',
    orders: 'Orders',
    subscriptions: 'Subscriptions',
    orderHistory: 'Order History',
    quickOrder: 'Quick Order',
    orderWater: 'Order Water',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Logout',
    today: 'Today',
    schedule: 'Schedule',
    subscription: 'Subscription',
    proceed: 'Proceed to Payment',
    selectJarType: 'Select Jar Type',
    selectQuantity: 'Select Quantity',
    deliveryType: 'Delivery Type',
    priceBreakdown: 'Price Breakdown',
    total: 'Total',
    welcome: 'Welcome',
    address: 'Address',
    earnings: 'Earnings',
    inventory: 'Inventory',
    deliveries: 'Deliveries',
    pending: 'Pending',
    completed: 'Completed',
    activeSubscriptions: 'Active Subscriptions',
    totalOrders: 'Total Orders',
    totalUsers: 'Total Users',
    revenue: 'Revenue',
    vendors: 'Vendors',
    subscriptionRequests: 'Subscription Requests',
    subscriptionCustomers: 'Subscription Customers',
    deliveryTeam: 'Delivery Team',
    shopSettings: 'Shop Settings',
    stock: 'Stock',
    vendorAccount: 'Vendor Account',
    vendorPortal: 'Vendor Portal',
    deliveryDashboard: 'Delivery Dashboard',
    delivery: 'Delivery',
    assigned: 'Assigned',
    availabilityStatus: 'Availability Status',
    youAreAvailable: 'You are available for orders',
    youAreNotAvailable: 'You are not available',
    available: 'Available',
    unavailable: 'Unavailable',
    assignedDeliveries: 'Assigned Deliveries',
    deliveryMap: 'Delivery Map',
    refresh: 'Refresh',
    loading: 'Loading...',
    noOrdersAssigned: 'No orders assigned yet',
    ordersWillAppear: 'Orders will appear here when vendors assign them to you.',
    makeSureAvailable: 'Make sure your availability status is set to "Available" to receive orders.',
    selectShop: 'Select Shop',
    selectShopDesc: 'Shops in your city — near shops show faster delivery times',
    pincode: 'Pincode',
    noShopsInCity: 'No shops in your city yet.',
    updatePincodeForShops: 'Update your pincode in profile to see shops in your area.',
    nearYou: 'Near you',
    sameCity: 'Same city',
    sameState: 'Same state',
    continueToOrder: 'Continue to Order',
  },
  hi: {
    login: 'लॉग इन',
    register: 'रजिस्टर',
    phone: 'फ़ोन नंबर',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड पुष्टि करें',
    forgotPassword: 'पासवर्ड भूल गए?',
    newUser: 'नए उपयोगकर्ता?',
    existingUser: 'पहले से खाता है?',
    selectLanguage: 'भाषा चुनें',
    dashboard: 'डैशबोर्ड',
    orders: 'ऑर्डर',
    subscriptions: 'सब्सक्रिप्शन',
    orderHistory: 'ऑर्डर इतिहास',
    quickOrder: 'त्वरित ऑर्डर',
    orderWater: 'पानी ऑर्डर करें',
    profile: 'प्रोफ़ाइल',
    settings: 'सेटिंग्स',
    logout: 'लॉग आउट',
    today: 'आज',
    schedule: 'शेड्यूल',
    subscription: 'सब्सक्रिप्शन',
    proceed: 'भुगतान के लिए आगे बढ़ें',
    selectJarType: 'जार प्रकार चुनें',
    selectQuantity: 'मात्रा चुनें',
    deliveryType: 'डिलीवरी प्रकार',
    priceBreakdown: 'कीमत विवरण',
    total: 'कुल',
    welcome: 'स्वागत है',
    address: 'पता',
    earnings: 'कमाई',
    inventory: 'इन्वेंटरी',
    deliveries: 'डिलीवरी',
    pending: 'लंबित',
    completed: 'पूर्ण',
    activeSubscriptions: 'सक्रिय सब्सक्रिप्शन',
    totalOrders: 'कुल ऑर्डर',
    totalUsers: 'कुल उपयोगकर्ता',
    revenue: 'राजस्व',
    vendors: 'विक्रेता',
    subscriptionRequests: 'सब्सक्रिप्शन अनुरोध',
    subscriptionCustomers: 'सब्सक्रिप्शन ग्राहक',
    deliveryTeam: 'डिलीवरी टीम',
    shopSettings: 'दुकान सेटिंग्स',
    stock: 'स्टॉक',
    vendorAccount: 'विक्रेता खाता',
    vendorPortal: 'विक्रेता पोर्टल',
    deliveryDashboard: 'डिलीवरी डैशबोर्ड',
    delivery: 'डिलीवरी',
    assigned: 'नियत',
    availabilityStatus: 'उपलब्धता स्थिति',
    youAreAvailable: 'आप ऑर्डर के लिए उपलब्ध हैं',
    youAreNotAvailable: 'आप उपलब्ध नहीं हैं',
    available: 'उपलब्ध',
    unavailable: 'अनुपलब्ध',
    assignedDeliveries: 'नियत डिलीवरी',
    deliveryMap: 'डिलीवरी मानचित्र',
    refresh: 'रीफ्रेश करें',
    loading: 'लोड हो रहा है...',
    noOrdersAssigned: 'अभी तक कोई ऑर्डर नियत नहीं',
    ordersWillAppear: 'जब विक्रेता आपको ऑर्डर देंगे तो यहां दिखेंगे।',
    makeSureAvailable: 'ऑर्डर पाने के लिए उपलब्धता "उपलब्ध" रखें।',
    selectShop: 'दुकान चुनें',
    selectShopDesc: 'आपके शहर की दुकानें — पास की दुकानों में तेज़ डिलीवरी',
    pincode: 'पिनकोड',
    noShopsInCity: 'आपके शहर में अभी कोई दुकान नहीं।',
    updatePincodeForShops: 'दुकानें देखने के लिए प्रोफाइल में पिनकोड अपडेट करें।',
    nearYou: 'आपके पास',
    sameCity: 'समान शहर',
    sameState: 'समान राज्य',
    continueToOrder: 'ऑर्डर करें',
  },
  mr: {
    login: 'लॉगिन',
    register: 'नोंदणी करा',
    phone: 'फोन नंबर',
    password: 'पासवर्ड',
    confirmPassword: 'पासवर्ड पुष्टी करा',
    forgotPassword: 'पासवर्ड विसरलात?',
    newUser: 'नवीन वापरकर्ता?',
    existingUser: 'आधीच खाते आहे?',
    selectLanguage: 'भाषा निवडा',
    dashboard: 'डॅशबोर्ड',
    orders: 'ऑर्डर',
    subscriptions: 'सदस्यता',
    orderHistory: 'ऑर्डर इतिहास',
    quickOrder: 'जलद ऑर्डर',
    orderWater: 'पाणी ऑर्डर करा',
    profile: 'प्रोफाइल',
    settings: 'सेटिंग्ज',
    logout: 'लॉग आउट',
    today: 'आज',
    schedule: 'वेळापत्रक',
    subscription: 'सदस्यता',
    proceed: 'पेमेंटसाठी पुढे जा',
    selectJarType: 'जार प्रकार निवडा',
    selectQuantity: 'प्रमाण निवडा',
    deliveryType: 'डिलिव्हरी प्रकार',
    priceBreakdown: 'किंमत तपशील',
    total: 'एकूण',
    welcome: 'स्वागत आहे',
    address: 'पत्ता',
    earnings: 'कमाई',
    inventory: 'इन्व्हेंटरी',
    deliveries: 'डिलिव्हरी',
    pending: 'प्रलंबित',
    completed: 'पूर्ण',
    activeSubscriptions: 'सक्रिय सदस्यता',
    totalOrders: 'एकूण ऑर्डर',
    totalUsers: 'एकूण वापरकर्ते',
    revenue: 'महसूल',
    vendors: 'विक्रेते',
    subscriptionRequests: 'सब्सक्रिप्शन विनंत्या',
    subscriptionCustomers: 'सब्सक्रिप्शन ग्राहक',
    deliveryTeam: 'डिलीवरी टीम',
    shopSettings: 'दुकान सेटिंग्स',
    stock: 'स्टॉक',
    vendorAccount: 'विक्रेता खाते',
    vendorPortal: 'विक्रेता पोर्टल',
    deliveryDashboard: 'डिलिव्हरी डॅशबोर्ड',
    delivery: 'डिलिव्हरी',
    assigned: 'नियुक्त',
    availabilityStatus: 'उपलब्धता स्थिती',
    youAreAvailable: 'तुम ऑर्डरसाठी उपलब्ध आहात',
    youAreNotAvailable: 'तुम उपलब्ध नाही',
    available: 'उपलब्ध',
    unavailable: 'अनुपलब्ध',
    assignedDeliveries: 'नियुक्त डिलिव्हरी',
    deliveryMap: 'डिलिव्हरी नकाशा',
    refresh: 'रीफ्रेश',
    loading: 'लोड होत आहे...',
    noOrdersAssigned: 'अद्याप ऑर्डर नियुक्त नाही',
    ordersWillAppear: 'विक्रेता ऑर्डर देताच येथे दिसतील.',
    makeSureAvailable: 'ऑर्डर मिळवण्यासाठी उपलब्धता "उपलब्ध" ठेवा.',
    selectShop: 'दुकान निवडा',
    selectShopDesc: 'तुमच्या शहरातील दुकाने — जवळच्या दुकानांमध्ये जलद वितरण',
    pincode: 'पिनकोड',
    noShopsInCity: 'तुमच्या शहरात अजून दुकाने नाहीत.',
    updatePincodeForShops: 'दुकाने दिसण्यासाठी प्रोफाइलमध्ये पिनकोड अपडेट करा.',
    nearYou: 'तुमच्या जवळ',
    sameCity: 'समान शहर',
    sameState: 'समान राज्य',
    continueToOrder: 'ऑर्डर करा',
  },
  kn: {
    login: 'ಲಾಗ್ ಇನ್',
    register: 'ನೋಂದಣಿ',
    phone: 'ಫೋನ್ ಸಂಖ್ಯೆ',
    password: 'ಪಾಸ್‌ವರ್ಡ್',
    confirmPassword: 'ಪಾಸ್‌ವರ್ಡ್ ದೃಢೀಕರಿಸಿ',
    forgotPassword: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿದ್ದೀರಾ?',
    newUser: 'ಹೊಸ ಬಳಕೆದಾರ?',
    existingUser: 'ಈಗಾಗಲೇ ಖಾತೆ ಇದೆಯೇ?',
    selectLanguage: 'ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    orders: 'ಆದೇಶಗಳು',
    subscriptions: 'ಚಂದಾದಾರಿಕೆಗಳು',
    orderHistory: 'ಆದೇಶ ಇತಿಹಾಸ',
    quickOrder: 'ತ್ವರಿತ ಆದೇಶ',
    orderWater: 'ನೀರು ಆರ್ಡರ್ ಮಾಡಿ',
    profile: 'ಪ್ರೊಫೈಲ್',
    settings: 'ಸೆಟ್ಟಿಂಗ್ಗಳು',
    logout: 'ಲಾಗ್ ಔಟ್',
    today: 'ಇಂದು',
    schedule: 'ವೇಳಾಪಟ್ಟಿ',
    subscription: 'ಚಂದಾದಾರಿಕೆ',
    proceed: 'ಪಾವತಿಗೆ ಮುಂದುವರಿಸಿ',
    selectJarType: 'ಜಾರ್ ಪ್ರಕಾರವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    selectQuantity: 'ಪ್ರಮಾಣವನ್ನು ಆಯ್ಕೆಮಾಡಿ',
    deliveryType: 'ವಿತರಣೆ ಪ್ರಕಾರ',
    priceBreakdown: 'ಬೆಲೆ ವಿವರ',
    total: 'ಒಟ್ಟು',
    welcome: 'ಸ್ವಾಗತ',
    address: 'ವಿಳಾಸ',
    earnings: 'ಆದಾಯ',
    inventory: 'ಸ್ಟಾಕ್',
    deliveries: 'ವಿತರಣೆಗಳು',
    pending: 'ಬಾಕಿ',
    completed: 'ಪೂರ್ಣಗೊಂಡಿದೆ',
    activeSubscriptions: 'ಸಕ್ರಿಯ ಚಂದಾದಾರಿಕೆಗಳು',
    totalOrders: 'ಒಟ್ಟು ಆದೇಶಗಳು',
    totalUsers: 'ಒಟ್ಟು ಬಳಕೆದಾರರು',
    revenue: 'ಆದಾಯ',
    vendors: 'ವ್ಯಾಪಾರಿಗಳು',
    subscriptionRequests: 'ಚಂದಾ ವಿನಂತಿಗಳು',
    subscriptionCustomers: 'ಚಂದಾ ಗ್ರಾಹಕರು',
    deliveryTeam: 'ಡೆಲಿವರಿ ತಂಡ',
    shopSettings: 'ಅಂಗಡಿ ಸೆಟ್ಟಿಂಗ್ಗಳು',
    stock: 'ಸ್ಟಾಕ್',
    vendorAccount: 'ವ್ಯಾಪಾರಿ ಖಾತೆ',
    vendorPortal: 'ವ್ಯಾಪಾರಿ ಪೋರ್ಟಲ್',
    deliveryDashboard: 'ವಿತರಣೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    delivery: 'ವಿತರಣೆ',
    assigned: 'ನಿಯೋಜಿತ',
    availabilityStatus: 'ಲಭ್ಯತೆ ಸ್ಥಿತಿ',
    youAreAvailable: 'ನೀವು ಆರ್ಡರ್ಗಳಿಗೆ ಲಭ್ಯರಿದ್ದೀರಿ',
    youAreNotAvailable: 'ನೀವು ಲಭ್ಯರಲ್ಲ',
    available: 'ಲಭ್ಯ',
    unavailable: 'ಲಭ್ಯವಿಲ್ಲ',
    assignedDeliveries: 'ನಿಯೋಜಿತ ವಿತರಣೆಗಳು',
    deliveryMap: 'ವಿತರಣೆ ನಕ್ಷೆ',
    refresh: 'ರಿಫ್ರೆಶ್',
    loading: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    noOrdersAssigned: 'ಇನ್ನೂ ಆರ್ಡರ್ಗಳನ್ನು ನಿಯೋಜಿಸಲಾಗಿಲ್ಲ',
    ordersWillAppear: 'ವ್ಯಾಪಾರಿಗಳು ನಿಮಗೆ ನಿಯೋಜಿಸಿದಾಗ ಆರ್ಡರ್ಗಳು ಇಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ.',
    makeSureAvailable: 'ಆರ್ಡರ್ಗಳನ್ನು ಪಡೆಯಲು ಲಭ್ಯತೆಯನ್ನು "ಲಭ್ಯ" ಎಂದು ಹೊಂದಿಸಿ.',
    selectShop: 'ಅಂಗಡಿ ಆಯ್ಕೆಮಾಡಿ',
    selectShopDesc: 'ನಿಮ್ಮ ನಗರದ ಅಂಗಡಿಗಳು — ಹತ್ತಿರದ ಅಂಗಡಿಗಳಲ್ಲಿ ವೇಗವಾದ ವಿತರಣೆ',
    pincode: 'ಪಿನ್ ಕೋಡ್',
    noShopsInCity: 'ನಿಮ್ಮ ನಗರದಲ್ಲಿ ಇನ್ನೂ ಅಂಗಡಿಗಳಿಲ್ಲ.',
    updatePincodeForShops: 'ಅಂಗಡಿಗಳನ್ನು ನೋಡಲು ಪ್ರೊಫೈಲ್ನಲ್ಲಿ ಪಿನ್ ಕೋಡ್ ನವೀಕರಿಸಿ.',
    nearYou: 'ನಿಮ್ಮ ಹತ್ತಿರ',
    sameCity: 'ಅದೇ ನಗರ',
    sameState: 'ಅದೇ ರಾಜ್ಯ',
    continueToOrder: 'ಆರ್ಡರ್ ಮಾಡಿ',
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [loading, setLoading] = useState(true);

  // Listen to auth state changes
  useEffect(() => {
    console.log('🔍 Setting up auth state listener...');
    let authResolved = false;

    const authTimeout = window.setTimeout(() => {
      if (!authResolved) {
        console.warn('⚠️ Auth state listener timed out — continuing so pages can load');
        setLoading(false);
      }
    }, 10000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      authResolved = true;
      window.clearTimeout(authTimeout);
      console.log('🔄 Auth state changed:', firebaseUser ? `User logged in (${firebaseUser.uid})` : 'User logged out');
      
      if (firebaseUser) {
        try {
          console.log('📥 Fetching user data from Firestore for UID:', firebaseUser.uid);
          const phone = emailToPhone(firebaseUser.email || '');
          console.log('📞 Extracted phone from email:', phone);
          
          // Get user data from Firestore
          const userData = await getUserDocument(firebaseUser.uid);
          
          if (userData) {
            console.log('✅ User data loaded from Firestore:', {
              name: userData.name,
              role: userData.role,
              phone: userData.phone
            });
            
            setUser({
              id: userData.uid,
              phone: userData.phone || phone,
              name: userData.name,
              role: userData.role,
              language: userData.language,
              address: userData.address,
              pincode: userData.pincode,
              city: userData.city,
              state: userData.state,
              paymentMethods: userData.paymentMethods,
            });
            setLanguage(userData.language);
          } else {
            console.warn('⚠️  No user document found in Firestore for authenticated user');
            console.warn('⚠️  Setting minimal user data from Firebase Auth');
            
            // Fallback: use data from Firebase Auth if Firestore document doesn't exist
            setUser({
              id: firebaseUser.uid,
              phone,
              name: firebaseUser.displayName || 'User',
              role: 'customer',
              language: 'en',
            });
            setLanguage('en');
          }
        } catch (error: any) {
          console.error('❌ Error fetching user data in auth state listener:', error);
          console.error('❌ Error code:', error.code);
          console.error('❌ Error message:', error.message);
          
          // Still set user from Firebase Auth even if Firestore fails
          const phone = emailToPhone(firebaseUser.email || '');
          setUser({
            id: firebaseUser.uid,
            phone,
            name: firebaseUser.displayName || 'User',
            role: 'customer',
            language: 'en',
          });
          setLanguage('en');
        }
      } else {
        console.log('👋 User logged out, clearing user state');
        setUser(null);
      }
      
      setLoading(false);
      console.log('✅ Auth state update complete');
    }, (error) => {
      authResolved = true;
      window.clearTimeout(authTimeout);
      console.error('❌ Auth state listener error:', error);
      setLoading(false);
    });

    return () => {
      window.clearTimeout(authTimeout);
      console.log('🧹 Cleaning up auth state listener');
      unsubscribe();
    };
  }, []);

  const login = async (phone: string, password: string): Promise<{ success: boolean; role: UserRole; error?: string }> => {
    try {
      console.log('🔑 Starting login process...');
      console.log('📞 Phone:', phone);
      console.log('🔒 Password length:', password.length);
      
      // Check if auth is initialized
      if (!auth) {
        throw new Error('Firebase Auth is not initialized. Please check your Firebase configuration.');
      }
      
      const result = await loginUser(phone, password);
      console.log('📋 Login result:', { success: result.success, hasUser: !!result.user, error: result.error });
      
      if (result.success && result.user) {
        console.log('✅ Firebase Auth successful, fetching user data from Firestore...');
        console.log('👤 User UID:', result.user.uid);
        
        try {
          // Wait a bit for Firestore to be ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // User data will be fetched by onAuthStateChanged, but we need role for navigation
          const userData = await getUserDocument(result.user.uid);
          
          if (userData) {
            console.log('✅ User data fetched from Firestore:', { 
              role: userData.role, 
              name: userData.name,
              phone: userData.phone 
            });
            return { success: true, role: userData.role || 'customer' };
          } else {
            console.warn('⚠️  User document not found in Firestore for UID:', result.user.uid);
            console.warn('⚠️  This might mean the user registered but Firestore document creation failed.');
            console.warn('⚠️  Allowing login with default role. User should update their profile.');
            // Still allow login even if Firestore document doesn't exist
            return { success: true, role: 'customer' };
          }
        } catch (firestoreError: any) {
          console.error('❌ Error fetching user document from Firestore:', firestoreError);
          console.error('❌ Error code:', firestoreError.code);
          console.error('❌ Error message:', firestoreError.message);
          
          // If it's a permission error, we still allow login but show warning
          if (firestoreError.code === 'permission-denied') {
            console.warn('⚠️  Firestore permission denied. User is authenticated but cannot access Firestore.');
            console.warn('⚠️  Please check Firestore security rules. Allowing login with default role.');
            return { 
              success: true, 
              role: 'customer',
              error: 'Login successful but cannot access user data. Please check Firestore permissions.'
            };
          }
          
          // Still allow login even if Firestore fetch fails (user is authenticated)
          return { success: true, role: 'customer' };
        }
      }
      
      // Login failed at Firebase Auth level
      console.error('❌ Firebase Auth login failed:', result.error);
      return { success: false, role: 'customer', error: result.error || 'Login failed. Please check your credentials.' };
    } catch (error: any) {
      console.error('❌ Unexpected login error in AuthContext:', error);
      console.error('❌ Error stack:', error.stack);
      return { 
        success: false, 
        role: 'customer',
        error: error.message || 'An unexpected error occurred during login. Please try again.'
      };
    }
  };

  const register = async (
    phone: string,
    password: string,
    lang: Language,
    name: string,
    role: UserRole,
    address: string,
    pincode: string,
    state: string,
    shopName?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      console.log('📝 Starting registration process...');
      const result = await registerUser(phone, password, lang, name, role);
      
      if (result.success && result.user) {
        console.log('✅ User created, saving to Firestore...');
        
        try {
          // Create user document in Firestore
          await createUserDocument({
            uid: result.user.uid,
            phone: result.user.phone,
            name,
            role,
            language: lang,
            address,
            pincode,
            state,
          });
          console.log('✅ User document created in Firestore');

          // If vendor, create vendor document
          if (role === 'vendor' && shopName) {
            await createVendorDocument({
              uid: result.user.uid,
              shopName,
              ownerName: name,
              phone,
              address,
              state,
              pincode,
              status: 'pending',
            });
            console.log('✅ Vendor document created in Firestore');
          }

          // Set user state immediately so dashboard shows name and profile details right away
          // (avoids race where onAuthStateChanged runs before Firestore write and gets null)
          setUser({
            id: result.user.uid,
            phone: result.user.phone,
            name,
            role,
            language: lang,
            address: address || undefined,
            pincode: pincode || undefined,
            state: state || undefined,
          });
          setLanguage(lang);
          return { success: true };
        } catch (firestoreError: any) {
          console.error('❌ Error saving to Firestore:', firestoreError);
          // Even if Firestore fails, user is created in Auth, so we return success
          // but log the error
          return { 
            success: true, 
            error: 'Account created but there was an error saving additional details. Please try logging in.' 
          };
        }
      }
      
      console.error('❌ Registration failed:', result.error);
      return { success: false, error: result.error };
    } catch (error: any) {
      console.error('❌ Registration error in AuthContext:', error);
      return { 
        success: false, 
        error: error.message || 'An unexpected error occurred during registration'
      };
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleSetLanguage = async (lang: Language) => {
    setLanguage(lang);
    if (user) {
      try {
        await updateUserDocument(user.id, { language: lang });
        setUser({ ...user, language: lang });
      } catch (error) {
        console.error('Error updating language:', error);
      }
    }
  };

  const switchRole = (role: UserRole) => {
    if (user) {
      setUser({ ...user, role });
    }
  };

  const updateProfile = async (
    data: Partial<Pick<User, 'name' | 'address' | 'pincode' | 'city' | 'state' | 'phone' | 'paymentMethods'>>
  ): Promise<void> => {
    if (!user) return;
    try {
      await updateUserDocument(user.id, data);
      setUser({ ...user, ...data });
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        language,
        loading,
        setLanguage: handleSetLanguage,
        login,
        register,
        logout,
        switchRole,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useTranslation() {
  const { language } = useAuth();
  return (key: string) => translations[language][key] || key;
}

// Locale string for current language (for Intl number/date formatting)
export function useLocale(): string {
  const { language } = useAuth();
  return LANGUAGE_LOCALE[language] || 'en-IN';
}

// Format plain numbers in the current language/locale
export function useFormatNumber() {
  const locale = useLocale();
  return (value: number) => new Intl.NumberFormat(locale).format(value);
}

// Format INR currency in the current language/locale
export function useFormatCurrency() {
  const locale = useLocale();
  return (value: number) =>
    new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
}