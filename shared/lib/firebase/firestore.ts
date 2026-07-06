import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  Timestamp,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
  deleteField,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Language, UserRole } from '@shared/contexts/AuthContext';
import {
  cityKeyForMatching,
  statesCompatibleForAreaMatch,
  distanceMetersShopToPerson,
} from '@shared/utils/geo';

export interface UpiPaymentMethod {
  id: string;
  type: 'googlepay' | 'phonepe' | 'paytm' | 'upi';
  upiId: string;
  label: string;
  isDefault?: boolean;
}

export interface FirestoreUser {
  uid: string;
  phone: string;
  name: string;
  role: UserRole;
  language: Language;
  email?: string;
  address?: string;
  pincode?: string;
  city?: string;
  state?: string;
  isAvailable?: boolean; // For delivery persons - availability status
  /** Device location for delivery tracking */
  latitude?: number;
  longitude?: number;
  locationPermissionGranted?: boolean;
  locationUpdatedAt?: Timestamp;
  paymentMethods?: UpiPaymentMethod[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Vendor {
  id?: string;
  uid: string;
  shopName: string;
  ownerName: string;
  phone: string;
  address: string;
   city?: string;
  state?: string;
  pincode?: string;
  /** Precise shop location for delivery map; set via "Set shop location from GPS" in shop settings */
  latitude?: number;
  longitude?: number;
  status: 'pending' | 'approved' | 'rejected';
  shopImage?: string; // URL to shop image in Firebase Storage
  upiId?: string; // Optional UPI ID for receiving payments
  prices?: {
    jar20L?: number;
    jar10L?: number;
    bottles?: number;
  };
  stock?: {
    jar20L?: number; // Stock quantity for 20L jars (max 250, min 25)
    jar10L?: number; // Stock quantity for 10L jars (max 250, min 25)
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Order {
  id?: string;
  orderId: string; // Unique order ID like ORD-001
  customerUid: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerPincode?: string;
  /** Delivery location from customer device (accurate). Used by delivery map when present. */
  latitude?: number;
  longitude?: number;
  vendorUid: string;
  vendorShopName: string;
  vendorAddress?: string;
  vendorPhone?: string;
  deliveryPersonUid?: string;
  deliveryPersonName?: string;
  deliveryPersonPhone?: string;
  items: {
    jarType: '20L' | '10L' | 'bottles';
    quantity: number;
    pricePerUnit: number;
  }[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'today' | 'schedule' | 'subscription';
  scheduledDate?: string;
  scheduledTime?: string;
  /** When order is created from subscription delivery, links to that subscription doc id for correct jar counting */
  subscriptionId?: string;
  status: 'pending' | 'accepted' | 'rejected' | 'preparing' | 'out_for_delivery' | 'delivered' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Subscription {
  id?: string;
  subscriptionId: string; // Unique subscription ID like SUB-001
  customerUid: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerPincode?: string;
  vendorUid: string;
  vendorShopName: string;
  vendorAddress?: string;
  vendorPhone?: string;
  jarType: 'jar20L' | 'jar10L' | 'bottles';
  quantity: number; // Number of jars/bottles per delivery
  pricePerUnit: number; // Price per jar/bottle
  frequency: 'daily' | 'alternate' | 'weekly' | 'biweekly' | 'monthly';
  /** Selected weekdays for recurring delivery, e.g. ['monday', 'wednesday'] */
  deliveryDaysOfWeek?: string[];
  /** How many deliveries per week (matches deliveryDaysOfWeek.length when set) */
  deliveriesPerWeek?: number;
  /** Preferred delivery time window, e.g. "09:00" */
  preferredDeliveryTime?: string;
  /** Vendor approval workflow: pending → approved/rejected */
  vendorApprovalStatus?: 'pending' | 'approved' | 'rejected';
  isActive: boolean;
  isPaused: boolean;
  startDate: string; // ISO date string
  nextDeliveryDate?: string; // ISO date string
  monthlyAmount: number; // Calculated monthly total
  savings?: number; // Discount amount
  /**
   * Billing fields for the current (or last) subscription month.
   * `billingMonth` format: YYYY-MM (e.g. "2026-01")
   */
  billingMonth?: string;
  billingPaid?: boolean;
  billingPaidAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Subscription payment document – tracks monthly billing for subscriptions
export interface SubscriptionPayment {
  id?: string;
  subscriptionId: string; // Firestore subscription doc id
  customerUid: string;
  customerName?: string;
  vendorUid: string;
  vendorShopName?: string;
  month: string; // YYYY-MM
  amount: number;
  status: 'INITIATED' | 'PAYMENT_REQUESTED' | 'SUCCESS' | 'FAILED' | 'PAID';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Simple payment record for one-time order payments
export interface Payment {
  id?: string;
  orderId: string;        // Firestore order doc id
  orderOrderId: string;   // human-readable orderId (ORD-...)
  customerUid: string;
  customerName: string;
  vendorUid: string;
  vendorShopName: string;
  amount: number;
  status: 'INITIATED' | 'SUCCESS' | 'FAILED';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// Create user document in Firestore
export const createUserDocument = async (userData: Omit<FirestoreUser, 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    const now = Timestamp.now();
    const userDoc: FirestoreUser = {
      ...userData,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'users', userData.uid), userDoc);
  } catch (error: any) {
    console.error('Error creating user document:', error);
    // Dispatch custom event for permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Get user document from Firestore
export const getUserDocument = async (uid: string): Promise<FirestoreUser | null> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      return userDocSnap.data() as FirestoreUser;
    }
    return null;
  } catch (error: any) {
    console.error('Error getting user document:', error);
    // Dispatch custom event for permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Update user document
export const updateUserDocument = async (
  uid: string,
  updates: Partial<Omit<FirestoreUser, 'uid' | 'createdAt'>>,
): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    await updateDoc(userDocRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating user document:', error);
    throw error;
  }
};

/** Update user location and permission flag (used by location permission modal). */
export const updateUserLocationWithPermission = async (
  uid: string,
  latitude: number,
  longitude: number,
  locationPermissionGranted: boolean
): Promise<void> => {
  try {
    const userDocRef = doc(db, 'users', uid);
    const now = Timestamp.now();
    await updateDoc(userDocRef, {
      latitude,
      longitude,
      locationPermissionGranted,
      locationUpdatedAt: now,
      updatedAt: now,
    });
  } catch (error: any) {
    console.error('Error updating user location:', error);
    throw error;
  }
};

// Create vendor document
export const createVendorDocument = async (
  vendorData: Omit<Vendor, 'id' | 'createdAt' | 'updatedAt'>
): Promise<void> => {
  try {
    const now = Timestamp.now();
    const vendorDoc: Vendor = {
      ...vendorData,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'vendors', vendorData.uid), vendorDoc);
  } catch (error) {
    console.error('Error creating vendor document:', error);
    throw error;
  }
};

// Get vendor by UID
export const getVendorByUid = async (uid: string): Promise<Vendor | null> => {
  try {
    const vendorDocRef = doc(db, 'vendors', uid);
    const vendorDocSnap = await getDoc(vendorDocRef);
    
    if (vendorDocSnap.exists()) {
      const data = vendorDocSnap.data() as Record<string, any>;
      return {
        id: vendorDocSnap.id,
        ...data,
      } as Vendor;
    }
    return null;
  } catch (error) {
    console.error('Error getting vendor document:', error);
    throw error;
  }
};

// Get all vendors
export const getAllVendors = async (): Promise<Vendor[]> => {
  try {
    const vendorsRef = collection(db, 'vendors');
    const querySnapshot = await getDocs(vendorsRef);
    
    return querySnapshot.docs.map((doc) => {
      const data = doc.data() as Record<string, any>;
      return {
        id: doc.id,
        ...data,
      } as Vendor;
    });
  } catch (error: any) {
    console.error('Error getting all vendors:', error);
    // Dispatch custom event for permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time listener for vendors (for customers to see updated shop details)
export const subscribeToVendors = (
  callback: (vendors: Vendor[]) => void
): Unsubscribe => {
  try {
    console.log('🔴 Setting up real-time listener for vendors');
    const vendorsRef = collection(db, 'vendors');
    
    // Query for all vendors
    const q = query(vendorsRef);
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log('🟡 Vendor snapshot triggered - Total vendors:', querySnapshot.docs.length);
        
        // Log document changes
        querySnapshot.docChanges().forEach((change) => {
          console.log('🟡 Vendor document change:', {
            type: change.type, // 'added', 'modified', 'removed'
            docId: change.doc.id,
            shopName: change.doc.data().shopName,
            shopImage: change.doc.data().shopImage ? 'Yes' : 'No'
          });
        });
        
        const vendors = querySnapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, any>;
          return {
            id: doc.id,
            ...data,
          } as Vendor;
        });
        
        // Filter only approved vendors
        const approvedVendors = vendors.filter(v => v.status === 'approved');
        
        console.log('🟢 Real-time vendor update:', {
          total: vendors.length,
          approved: approvedVendors.length
        });
        
        // Call callback with new array reference
        callback([...approvedVendors]);
      },
      (error) => {
        console.error('❌ Error in vendors real-time listener:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
        }
        callback([]);
      }
    );
    
    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Error setting up vendors listener:', error);
    return () => {};
  }
};

// Upload shop image to Firebase Storage
export const uploadShopImage = async (
  vendorUid: string,
  imageFile: File
): Promise<string> => {
  try {
    console.log('📤 Uploading shop image for vendor:', vendorUid);
    console.log('📤 Image file details:', {
      name: imageFile.name,
      size: imageFile.size,
      type: imageFile.type
    });
    
    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('File must be an image. Supported formats: JPG, PNG, WebP, GIF');
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (imageFile.size > maxSize) {
      throw new Error(`Image size (${(imageFile.size / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of 5MB`);
    }
    
    if (imageFile.size === 0) {
      throw new Error('Selected file is empty. Please choose a valid image file.');
    }
    
    // Create storage reference with sanitized filename
    const sanitizedFileName = imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const imagePath = `shop-images/${vendorUid}/${Date.now()}_${sanitizedFileName}`;
    const imageRef = ref(storage, imagePath);
    
    console.log('📤 Storage path:', imagePath);
    console.log('📤 Storage reference created, uploading file...');
    
    // Upload file with metadata
    const metadata = {
      contentType: imageFile.type,
      customMetadata: {
        uploadedBy: vendorUid,
        uploadedAt: new Date().toISOString(),
      }
    };
    
    const snapshot = await uploadBytes(imageRef, imageFile, metadata);
    console.log('✅ Image uploaded to Storage successfully');
    console.log('✅ Upload snapshot:', {
      fullPath: snapshot.metadata.fullPath,
      size: snapshot.metadata.size,
      contentType: snapshot.metadata.contentType
    });
    
    // Get download URL
    console.log('📥 Getting download URL...');
    const downloadURL = await getDownloadURL(snapshot.ref);
    console.log('✅ Image download URL obtained:', downloadURL);
    
    if (!downloadURL || !downloadURL.startsWith('https://')) {
      throw new Error('Failed to get valid download URL from Firebase Storage');
    }
    
    return downloadURL;
  } catch (error: any) {
    console.error('❌ Error uploading shop image:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Provide user-friendly error messages
    if (error.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Please check Firebase Storage rules are published in Firebase Console.');
    } else if (error.code === 'storage/quota-exceeded') {
      throw new Error('Storage quota exceeded. Please contact support.');
    } else if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Upload failed due to network issues. Please check your internet connection and try again.');
    } else if (error.message) {
      throw error;
    } else {
      throw new Error('Failed to upload image. Please try again or check Firebase Storage configuration.');
    }
  }
};

// Delete old shop image from Firebase Storage
export const deleteShopImage = async (imageURL: string): Promise<void> => {
  try {
    if (!imageURL) return;
    
    // Extract path from URL
    const urlParts = imageURL.split('/o/');
    if (urlParts.length < 2) return;
    
    const encodedPath = urlParts[1].split('?')[0];
    const imagePath = decodeURIComponent(encodedPath);
    
    // Create storage reference and delete
    const imageRef = ref(storage, imagePath);
    await deleteObject(imageRef);
    console.log('✅ Old shop image deleted');
  } catch (error: any) {
    // Log but don't throw - deletion failure shouldn't block updates
    console.warn('⚠️ Could not delete old shop image:', error);
  }
};

// Update vendor document
export const updateVendorDocument = async (
  uid: string,
  updates: Partial<Omit<Vendor, 'id' | 'uid' | 'createdAt'>>,
  deleteOldImage?: boolean
): Promise<void> => {
  try {
    console.log('📝 Updating vendor document:', { uid, updates });
    const vendorDocRef = doc(db, 'vendors', uid);
    
    // Check if document exists first
    const vendorDocSnap = await getDoc(vendorDocRef);
    if (!vendorDocSnap.exists()) {
      throw new Error(`Vendor document with UID ${uid} does not exist`);
    }
    
    // Delete old image if new image is being uploaded and old image exists
    if (deleteOldImage && updates.shopImage) {
      const currentData = vendorDocSnap.data() as Vendor;
      if (currentData.shopImage && currentData.shopImage !== updates.shopImage) {
        await deleteShopImage(currentData.shopImage);
      }
    }
    
    console.log('✅ Vendor document exists, updating...');
    
    // Filter out undefined values, handle null values (delete field)
    const cleanedUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        // If value is null, use deleteField() to remove the field
        if (value === null) {
          cleanedUpdates[key] = deleteField();
        } else {
          cleanedUpdates[key] = value;
        }
      }
    });
    
    // Update the document
    await updateDoc(vendorDocRef, {
      ...cleanedUpdates,
      updatedAt: Timestamp.now(),
    });
    
    console.log('✅ Vendor document updated successfully');
  } catch (error: any) {
    console.error('❌ Error updating vendor document:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    // Dispatch custom event for permission errors
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
      throw new Error('Permission denied. Please check Firestore security rules allow vendor updates.');
    }
    
    throw error;
  }
};

// Generate unique order ID
const generateOrderId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `ORD-${timestamp}-${random}`;
};

// Create order document
export const createOrderDocument = async (
  orderData: Omit<Order, 'id' | 'orderId' | 'createdAt' | 'updatedAt'>
): Promise<{ docId: string; orderId: string }> => {
  try {
    const orderId = generateOrderId();
    const now = Timestamp.now();
    
    // Remove undefined fields before saving (Firestore doesn't accept undefined)
    const cleanedOrderData: any = {};
    Object.keys(orderData).forEach((key) => {
      const value = (orderData as any)[key];
      if (value !== undefined) {
        cleanedOrderData[key] = value;
      }
    });
    
    const orderDoc: Order = {
      ...cleanedOrderData,
      orderId,
      createdAt: now,
      updatedAt: now,
    };
    
    // Use addDoc to auto-generate document ID
    const orderRef = await addDoc(collection(db, 'orders'), orderDoc);
    console.log('✅ Order created:', { docId: orderRef.id, orderId });
    return { docId: orderRef.id, orderId };
  } catch (error: any) {
    console.error('❌ Error creating order document:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Get orders by vendor UID
export const getOrdersByVendor = async (vendorUid: string): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('vendorUid', '==', vendorUid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  } catch (error: any) {
    console.error('❌ Error getting orders by vendor:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time listener for orders by vendor UID
export const subscribeToOrdersByVendor = (
  vendorUid: string,
  callback: (orders: Order[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    console.log('🔴 Setting up real-time listener for vendor orders:', vendorUid);
    const ordersRef = collection(db, 'orders');
    
    // Query orders for this vendor
    const q = query(
      ordersRef,
      where('vendorUid', '==', vendorUid)
    );
    
    console.log('🔴 Using real-time listener for vendor orders');
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log('🟢 Real-time orders update received for vendor:', {
          count: querySnapshot.docs.length,
          changes: querySnapshot.docChanges().length
        });
        
        // Log what changed
        querySnapshot.docChanges().forEach((change) => {
          console.log('🟡 Order change:', {
            type: change.type, // 'added', 'modified', 'removed'
            docId: change.doc.id,
            orderId: change.doc.data().orderId,
            status: change.doc.data().status,
          });
        });
        
        // Map documents to Order objects
        const orders = querySnapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, any>;
          return {
            id: doc.id,
            ...data,
          } as Order;
        });
        
        // Sort by createdAt (newest first)
        orders.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
        
        console.log(`✅ Real-time vendor orders updated: ${orders.length} orders`);
        callback(orders);
      },
      (error) => {
        console.error('❌ Error in vendor orders listener:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );
    
    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Error setting up vendor orders listener:', error);
    if (errorCallback) {
      errorCallback(error);
    }
    // Return a no-op unsubscribe function
    return () => {};
  }
};

// Get orders by customer UID
export const getOrdersByCustomer = async (customerUid: string): Promise<Order[]> => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('customerUid', '==', customerUid));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Order[];
  } catch (error: any) {
    console.error('❌ Error getting orders by customer:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time listener for orders by customer UID
export const subscribeToOrdersByCustomer = (
  customerUid: string,
  callback: (orders: Order[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const ordersRef = collection(db, 'orders');
    const q = query(ordersRef, where('customerUid', '==', customerUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((docSnap) => {
          const data = docSnap.data() as any;
          return {
            id: docSnap.id,
            ...data,
          } as Order;
        });

        orders.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        callback(orders);
      },
      (error) => {
        console.error('❌ Error in subscribeToOrdersByCustomer:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToOrdersByCustomer:', error);
    errorCallback?.(error);
    return () => {};
  }
};

// Update order document
export const updateOrderDocument = async (
  orderId: string,
  updates: Partial<Omit<Order, 'id' | 'orderId' | 'createdAt'>>,
): Promise<void> => {
  try {
    console.log('📝 Updating order document:', { orderId, updates });
    const orderDocRef = doc(db, 'orders', orderId);
    
    // Check if document exists
    const orderDocSnap = await getDoc(orderDocRef);
    if (!orderDocSnap.exists()) {
      throw new Error(`Order document with ID ${orderId} does not exist`);
    }
    
    // Remove undefined values (Firestore doesn't accept undefined)
    const cleanedUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        cleanedUpdates[key] = value;
      }
    });
    
    await updateDoc(orderDocRef, {
      ...cleanedUpdates,
      updatedAt: Timestamp.now(),
    });
    
    console.log('✅ Order document updated successfully with:', cleanedUpdates);
  } catch (error: any) {
    console.error('❌ Error updating order document:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Get order by ID
export const getOrderById = async (orderId: string): Promise<Order | null> => {
  try {
    const orderDocRef = doc(db, 'orders', orderId);
    const orderDocSnap = await getDoc(orderDocRef);
    
    if (orderDocSnap.exists()) {
      return { id: orderDocSnap.id, ...orderDocSnap.data() } as Order;
    }
    return null;
  } catch (error: any) {
    console.error('❌ Error getting order by ID:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Get delivery persons by pincode (nearby delivery persons)
// Filters only available delivery persons (isAvailable === true or undefined for backward compatibility)
export const getDeliveryPersonsByPincode = async (pincode: string, onlyAvailable: boolean = true): Promise<FirestoreUser[]> => {
  try {
    console.log('🔍 Fetching delivery persons for pincode:', pincode, 'Only available:', onlyAvailable);
    const usersRef = collection(db, 'users');
    
    // Get all users with role 'delivery' and matching pincode
    const q = query(
      usersRef,
      where('role', '==', 'delivery'),
      where('pincode', '==', pincode)
    );
    
    const querySnapshot = await getDocs(q);
    let deliveryPersons = querySnapshot.docs.map((doc) => ({
      ...doc.data(),
    })) as FirestoreUser[];
    
    // If no exact match, try to get nearby (within 1000 pincode range)
    if (deliveryPersons.length === 0 && pincode) {
      try {
        const pincodeNum = parseInt(pincode);
        if (!isNaN(pincodeNum)) {
          // Get all delivery persons and filter by pincode range
          const allDeliveryQuery = query(
            usersRef,
            where('role', '==', 'delivery')
          );
          const allSnapshot = await getDocs(allDeliveryQuery);
          deliveryPersons = allSnapshot.docs
            .map((doc) => ({
              ...doc.data(),
            }))
            .filter((person) => {
              if (!person.pincode) return false;
              const personPincode = parseInt(person.pincode);
              if (isNaN(personPincode)) return false;
              return Math.abs(personPincode - pincodeNum) <= 1000;
            }) as FirestoreUser[];
        }
      } catch (rangeError) {
        console.log('Could not fetch nearby delivery persons:', rangeError);
      }
    }
    
    // Filter only available delivery persons if requested
    if (onlyAvailable) {
      deliveryPersons = deliveryPersons.filter(person => 
        person.isAvailable === true || person.isAvailable === undefined // undefined means available by default (backward compatibility)
      );
    }
    
    console.log(`✅ Found ${deliveryPersons.length} delivery persons for pincode ${pincode}`);
    return deliveryPersons;
  } catch (error: any) {
    console.error('❌ Error getting delivery persons by pincode:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

/** Vendor shop fields used to match delivery persons (city + optional state; pincode fallback). */
export type VendorDeliveryArea = {
  pincode?: string;
  city?: string;
  state?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
};

function pincodeNearMatch(vendorPin: string, personPin: string): boolean {
  if (!vendorPin || !personPin) return false;
  if (personPin === vendorPin) return true;
  const vn = parseInt(vendorPin, 10);
  const pn = parseInt(personPin, 10);
  if (Number.isNaN(vn) || Number.isNaN(pn)) return false;
  return Math.abs(vn - pn) <= 1000;
}

/** True if delivery person should appear for this vendor (same city when vendor has city; else pincode). */
export function deliveryPersonMatchesVendorArea(
  person: FirestoreUser,
  area: VendorDeliveryArea
): boolean {
  const vendorCityKey = cityKeyForMatching(area.city, area.address);
  const personCityKey = cityKeyForMatching(person.city, person.address);
  const vendorPin = (area.pincode || '').toString().trim();
  const personPin = (person.pincode || '').toString().trim();

  if (!statesCompatibleForAreaMatch(area.state, person.state)) return false;

  const pinMatch = pincodeNearMatch(vendorPin, personPin);

  if (vendorCityKey) {
    if (personCityKey && personCityKey === vendorCityKey) return true;
    if (!personCityKey && pinMatch) return true;
    return false;
  }

  return pinMatch;
}

/**
 * Real-time delivery persons for a vendor: same city (or city derived from address), compatible state,
 * sorted by available first then distance from shop when coordinates exist.
 */
export const subscribeToDeliveryPersonsForVendorArea = (
  area: VendorDeliveryArea,
  callback: (deliveryPersons: FirestoreUser[]) => void,
  onlyAvailable: boolean = false
): Unsubscribe => {
  const vendorCityKey = cityKeyForMatching(area.city, area.address);
  const vendorPin = (area.pincode || '').toString().trim();
  if (!vendorCityKey && !vendorPin) {
    callback([]);
    return () => {};
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('role', '==', 'delivery'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        let deliveryPersons = querySnapshot.docs
          .map((docSnap) => {
            const data = docSnap.data() as Record<string, any>;
            return {
              uid: data.uid || docSnap.id,
              phone: data.phone || '',
              name: data.name || '',
              role: data.role || 'delivery',
              language: data.language || 'en',
              email: data.email,
              address: data.address,
              pincode: data.pincode,
              city: data.city,
              state: data.state,
              latitude: data.latitude,
              longitude: data.longitude,
              locationPermissionGranted: data.locationPermissionGranted,
              locationUpdatedAt: data.locationUpdatedAt,
              isAvailable: data.isAvailable,
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
            } as FirestoreUser;
          })
          .filter((person) => deliveryPersonMatchesVendorArea(person, area));

        if (onlyAvailable) {
          deliveryPersons = deliveryPersons.filter(
            (person) => person.isAvailable === true || person.isAvailable === undefined
          );
        }

        const dist = (p: FirestoreUser) =>
          distanceMetersShopToPerson(area.latitude, area.longitude, p.latitude, p.longitude) ??
          Number.POSITIVE_INFINITY;

        deliveryPersons.sort((a, b) => {
          const aAvailable = a.isAvailable !== false;
          const bAvailable = b.isAvailable !== false;
          if (aAvailable && !bAvailable) return -1;
          if (!aAvailable && bAvailable) return 1;
          const da = dist(a);
          const db = dist(b);
          if (da !== db) return da - db;
          return (a.name || '').localeCompare(b.name || '');
        });

        callback([...deliveryPersons]);
      },
      (error) => {
        console.error('❌ Error in delivery persons real-time listener:', error);
        if (error.code === 'permission-denied' || error.message?.includes('permission')) {
          window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
        }
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Error setting up delivery persons listener:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    return () => {};
  }
};

/** @deprecated Prefer subscribeToDeliveryPersonsForVendorArea with full vendor fields. */
export const subscribeToDeliveryPersonsByPincode = (
  pincode: string,
  callback: (deliveryPersons: FirestoreUser[]) => void,
  onlyAvailable: boolean = false
): Unsubscribe => {
  return subscribeToDeliveryPersonsForVendorArea({ pincode }, callback, onlyAvailable);
};

// Get orders by delivery person UID
export const getOrdersByDeliveryPerson = async (deliveryPersonUid: string): Promise<Order[]> => {
  try {
    console.log('🔍 Fetching orders for delivery person:', deliveryPersonUid);
    const ordersRef = collection(db, 'orders');
    
    // Try query with orderBy first (requires composite index)
    let q;
    try {
      q = query(
        ordersRef,
        where('deliveryPersonUid', '==', deliveryPersonUid),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      const orders = querySnapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, any>;
        return {
          id: doc.id,
          ...data,
        } as Order;
      });
      
      console.log(`✅ Found ${orders.length} orders for delivery person`);
      return orders;
    } catch (indexError: any) {
      // If composite index error, fallback to query without orderBy
      if (indexError.code === 'failed-precondition' || indexError.message?.includes('index')) {
        console.warn('⚠️ Composite index not found, using fallback query');
        const fallbackQuery = query(
          ordersRef,
          where('deliveryPersonUid', '==', deliveryPersonUid)
        );
        const fallbackSnapshot = await getDocs(fallbackQuery);
        
        const orders = fallbackSnapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, any>;
          return {
            id: doc.id,
            ...data,
          } as Order;
        });
        
        // Sort manually by createdAt
        orders.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
        
        console.log(`✅ Found ${orders.length} orders for delivery person (fallback query)`);
        return orders;
      }
      throw indexError;
    }
  } catch (error: any) {
    console.error('❌ Error getting orders by delivery person:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time listener for orders assigned to a delivery person
export const subscribeToOrdersByDeliveryPerson = (
  deliveryPersonUid: string,
  callback: (orders: Order[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    console.log('🔴 Setting up real-time listener for delivery person orders:', deliveryPersonUid);
    const ordersRef = collection(db, 'orders');
    
    // Query orders assigned to this delivery person
    const q = query(
      ordersRef,
      where('deliveryPersonUid', '==', deliveryPersonUid)
    );
    
    console.log('🔴 Using real-time listener for delivery person orders');
    
    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        console.log('🟢 Real-time orders update received for delivery person:', {
          count: querySnapshot.docs.length,
          changes: querySnapshot.docChanges().length
        });
        
        // Log what changed
        querySnapshot.docChanges().forEach((change) => {
          console.log('🟡 Order change:', {
            type: change.type, // 'added', 'modified', 'removed'
            docId: change.doc.id,
            orderId: change.doc.data().orderId,
            status: change.doc.data().status,
          });
        });
        
        // Map documents to Order objects
        const orders = querySnapshot.docs.map((doc) => {
          const data = doc.data() as Record<string, any>;
          return {
            id: doc.id,
            ...data,
          } as Order;
        });
        
        // Sort by createdAt (newest first)
        orders.sort((a, b) => {
          const aTime = a.createdAt?.toMillis() || 0;
          const bTime = b.createdAt?.toMillis() || 0;
          return bTime - aTime;
        });
        
        console.log(`✅ Real-time orders updated: ${orders.length} orders`);
        callback(orders);
      },
      (error) => {
        console.error('❌ Error in delivery person orders listener:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );
    
    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Error setting up delivery person orders listener:', error);
    if (errorCallback) {
      errorCallback(error);
    }
    // Return a no-op unsubscribe function
    return () => {};
  }
};

// ==================== SUBSCRIPTION FUNCTIONS ====================

// Generate unique subscription ID
const generateSubscriptionId = (): string => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `SUB-${timestamp}-${random}`;
};

// Create subscription document
export const createSubscriptionDocument = async (
  subscriptionData: Omit<Subscription, 'id' | 'subscriptionId' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const subscriptionId = generateSubscriptionId();
    const now = Timestamp.now();
    
    // Remove undefined fields
    const cleanedData: any = {
      subscriptionId,
      ...subscriptionData,
      createdAt: now,
      updatedAt: now,
    };
    
    // Remove undefined values
    Object.keys(cleanedData).forEach((key) => {
      if (cleanedData[key] === undefined) {
        delete cleanedData[key];
      }
    });
    
    const subscriptionsRef = collection(db, 'subscriptions');
    const docRef = await addDoc(subscriptionsRef, cleanedData);
    
    console.log('✅ Subscription created:', subscriptionId);
    return docRef.id;
  } catch (error: any) {
    console.error('❌ Error creating subscription:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
      throw new Error('Permission denied. Please check Firestore security rules.');
    }
    throw error;
  }
};

// Get subscriptions by customer UID
export const getSubscriptionsByCustomer = async (customerUid: string): Promise<Subscription[]> => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('customerUid', '==', customerUid));
    const querySnapshot = await getDocs(q);
    
    const subscriptions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];
    
    // Sort by createdAt (newest first)
    subscriptions.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });
    
    return subscriptions;
  } catch (error: any) {
    console.error('❌ Error getting subscriptions by customer:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Get subscriptions by vendor UID
export const getSubscriptionsByVendor = async (vendorUid: string): Promise<Subscription[]> => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('vendorUid', '==', vendorUid));
    const querySnapshot = await getDocs(q);
    
    const subscriptions = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Subscription[];
    
    // Sort by createdAt (newest first)
    subscriptions.sort((a, b) => {
      const aTime = a.createdAt?.toMillis() || 0;
      const bTime = b.createdAt?.toMillis() || 0;
      return bTime - aTime;
    });
    
    return subscriptions;
  } catch (error: any) {
    console.error('❌ Error getting subscriptions by vendor:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time subscriptions by vendor UID (used for subscription requests)
export const subscribeToSubscriptionsByVendor = (
  vendorUid: string,
  callback: (subscriptions: Subscription[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('vendorUid', '==', vendorUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as Subscription[];

        subs.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        callback(subs);
      },
      (error) => {
        console.error('❌ Error in subscribeToSubscriptionsByVendor:', error);
        callback([]);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToSubscriptionsByVendor:', error);
    errorCallback?.(error);
    return () => {};
  }
};

// Real-time subscriptions by customer UID
export const subscribeToSubscriptionsByCustomer = (
  customerUid: string,
  callback: (subscriptions: Subscription[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('customerUid', '==', customerUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const subs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as Subscription[];

        subs.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        callback(subs);
      },
      (error) => {
        console.error('❌ Error in subscribeToSubscriptionsByCustomer:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToSubscriptionsByCustomer:', error);
    errorCallback?.(error);
    return () => {};
  }
};

// Update subscription document
export const updateSubscriptionDocument = async (
  subscriptionId: string,
  updates: Partial<Omit<Subscription, 'id' | 'subscriptionId' | 'createdAt'>>
): Promise<void> => {
  try {
    console.log('📝 Updating subscription document:', { subscriptionId, updates });
    const subscriptionDocRef = doc(db, 'subscriptions', subscriptionId);
    
    // Check if document exists
    const subscriptionDocSnap = await getDoc(subscriptionDocRef);
    if (!subscriptionDocSnap.exists()) {
      throw new Error(`Subscription document with ID ${subscriptionId} does not exist`);
    }
    
    // Remove undefined values
    const cleanedUpdates: any = {};
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        cleanedUpdates[key] = value;
      }
    });
    
    await updateDoc(subscriptionDocRef, {
      ...cleanedUpdates,
      updatedAt: Timestamp.now(),
    });
    
    console.log('✅ Subscription document updated successfully');
  } catch (error: any) {
    console.error('❌ Error updating subscription document:', error);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error message:', error.message);
    
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
      throw new Error('Permission denied. Please check Firestore security rules allow subscription updates.');
    }
    
    throw error;
  }
};

// ==================== SUBSCRIPTION PAYMENTS ====================

// Create subscription payment document
export const createSubscriptionPaymentDocument = async (
  paymentData: Omit<SubscriptionPayment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const now = Timestamp.now();
    const cleaned: any = {
      ...paymentData,
      createdAt: now,
      updatedAt: now,
    };

    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === undefined) {
        delete cleaned[key];
      }
    });

    const paymentsRef = collection(db, 'subscriptionPayments');
    const docRef = await addDoc(paymentsRef, cleaned);
    console.log('✅ Subscription payment created:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('❌ Error creating subscription payment:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Update subscription payment document
export const updateSubscriptionPaymentDocument = async (
  paymentId: string,
  updates: Partial<Omit<SubscriptionPayment, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const paymentRef = doc(db, 'subscriptionPayments', paymentId);
    const snap = await getDoc(paymentRef);
    if (!snap.exists()) {
      throw new Error(`Subscription payment document with ID ${paymentId} does not exist`);
    }

    const cleaned: any = {};
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        cleaned[key] = value;
      }
    });

    await updateDoc(paymentRef, {
      ...cleaned,
      updatedAt: Timestamp.now(),
    });
    console.log('✅ Subscription payment updated:', paymentId);
  } catch (error: any) {
    console.error('❌ Error updating subscription payment:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time subscription payments by customer UID
export const subscribeToSubscriptionPaymentsByCustomer = (
  customerUid: string,
  callback: (payments: SubscriptionPayment[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const paymentsRef = collection(db, 'subscriptionPayments');
    const q = query(paymentsRef, where('customerUid', '==', customerUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as SubscriptionPayment[];

        payments.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() ?? 0;
          const bTime = b.updatedAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        callback(payments);
      },
      (error) => {
        console.error('❌ Error in subscribeToSubscriptionPaymentsByCustomer:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToSubscriptionPaymentsByCustomer:', error);
    errorCallback?.(error);
    return () => {};
  }
};

// Real-time subscription payments by vendor UID (for vendor dashboard Bill / Mark Paid)
export const subscribeToSubscriptionPaymentsByVendor = (
  vendorUid: string,
  callback: (payments: SubscriptionPayment[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const paymentsRef = collection(db, 'subscriptionPayments');
    const q = query(paymentsRef, where('vendorUid', '==', vendorUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as SubscriptionPayment[];
        callback(payments);
      },
      (error) => {
        console.error('❌ Error in subscribeToSubscriptionPaymentsByVendor:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToSubscriptionPaymentsByVendor:', error);
    errorCallback?.(error);
    return () => {};
  }
};

// ==================== ORDER PAYMENTS (ONE-TIME) ====================

// Create one-time order payment document (for UPI flows in OrderWater)
export const createPaymentDocument = async (
  paymentData: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    const now = Timestamp.now();
    const cleaned: any = {
      ...paymentData,
      createdAt: now,
      updatedAt: now,
    };

    Object.keys(cleaned).forEach((key) => {
      if (cleaned[key] === undefined) {
        delete cleaned[key];
      }
    });

    const paymentsRef = collection(db, 'payments');
    const docRef = await addDoc(paymentsRef, cleaned);
    console.log('✅ Order payment created:', docRef.id);
    return docRef.id;
  } catch (error: any) {
    console.error('❌ Error creating payment document:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Get a single payment document by orderId (used in OrderTracking)
export const getPaymentByOrderId = async (orderId: string): Promise<Payment | null> => {
  try {
    const paymentsRef = collection(db, 'payments');
    const q = query(paymentsRef, where('orderId', '==', orderId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    const docSnap = snapshot.docs[0];
    const data = docSnap.data() as any;
    return {
      id: docSnap.id,
      ...data,
    } as Payment;
  } catch (error: any) {
    console.error('❌ Error getting payment by orderId:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Update one-time payment document
export const updatePaymentDocument = async (
  paymentId: string,
  updates: Partial<Omit<Payment, 'id' | 'createdAt'>>
): Promise<void> => {
  try {
    const paymentRef = doc(db, 'payments', paymentId);
    const snap = await getDoc(paymentRef);

    if (!snap.exists()) {
      throw new Error(`Payment document with ID ${paymentId} does not exist`);
    }

    const cleaned: any = {};
    Object.keys(updates).forEach((key) => {
      const value = (updates as any)[key];
      if (value !== undefined) {
        cleaned[key] = value;
      }
    });

    await updateDoc(paymentRef, {
      ...cleaned,
      updatedAt: Timestamp.now(),
    });

    console.log('✅ Payment document updated:', paymentId);
  } catch (error: any) {
    console.error('❌ Error updating payment document:', error);
    if (error.code === 'permission-denied' || error.message?.includes('permission')) {
      window.dispatchEvent(new CustomEvent('firebase-permission-error', { detail: error }));
    }
    throw error;
  }
};

// Real-time listener for payments received by a vendor
export const subscribeToPaymentsByVendor = (
  vendorUid: string,
  callback: (payments: Payment[]) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const paymentsRef = collection(db, 'payments');
    const q = query(paymentsRef, where('vendorUid', '==', vendorUid));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const payments = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...(docSnap.data() as any),
        })) as Payment[];

        payments.sort((a, b) => {
          const aTime = a.updatedAt?.toMillis?.() ?? 0;
          const bTime = b.updatedAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        callback(payments);
      },
      (error) => {
        console.error('❌ Error in subscribeToPaymentsByVendor:', error);
        errorCallback?.(error);
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToPaymentsByVendor:', error);
    errorCallback?.(error);
    return () => {};
  }
};

// Real-time listener for a single order by document ID
export const subscribeToOrderById = (
  orderDocId: string,
  callback: (order: Order | null) => void,
  errorCallback?: (error: Error) => void
): Unsubscribe => {
  try {
    const orderRef = doc(db, 'orders', orderDocId);

    const unsubscribe = onSnapshot(
      orderRef,
      (snap) => {
        if (!snap.exists()) {
          callback(null);
          return;
        }
        const data = snap.data() as any;
        const order: Order = {
          id: snap.id,
          ...data,
        };
        callback(order);
      },
      (error) => {
        console.error('❌ Error in subscribeToOrderById:', error);
        if (errorCallback) {
          errorCallback(error);
        }
      }
    );

    return unsubscribe;
  } catch (error: any) {
    console.error('❌ Failed to set up subscribeToOrderById:', error);
    if (errorCallback) {
      errorCallback(error);
    }
    return () => {};
  }
};

// Helper to determine if a subscription has an unpaid past month bill
export const isSubscriptionOverdue = (sub: Subscription, currentMonth: string, payments: SubscriptionPayment[] = []): boolean => {
  const startMonth = sub.startDate.slice(0, 7);
  
  // If we are still in the start month, no overdue
  if (currentMonth === startMonth) return false;
  
  // If current month is before start month (impossible, but just in case)
  if (currentMonth < startMonth) return false;
  
  // Calculate the last month that should have been paid
  // e.g., if currentMonth is 2026-08, then last due month is 2026-07
  const [yearStr, monthStr] = currentMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month === 0) {
    month = 12;
    year -= 1;
  }
  const lastDueMonth = `${year}-${month.toString().padStart(2, '0')}`;
  
  // Check if lastDueMonth is before start month (no, since currentMonth > startMonth)
  if (lastDueMonth < startMonth) return false;
  
  // Check if we have a payment marked PAID for lastDueMonth either in sub or payments
  const hasPaidLastDueMonth = 
    (sub.billingPaid === true && sub.billingMonth === lastDueMonth) ||
    payments.some(p => p.month === lastDueMonth && p.status === 'PAID');
  
  return !hasPaidLastDueMonth;
};

// Compute current subscription status based on latest payment and billing fields
export const computeSubscriptionStatus = (
  subscription: Subscription,
  latestPayment: SubscriptionPayment | null,
  now: Date,
  allPayments: SubscriptionPayment[] = []
): 'ACTIVE' | 'PAYMENT_DUE' | 'PENDING_VERIFICATION' | 'PAID' | 'PAUSED' | 'AWAITING_APPROVAL' | 'REJECTED' => {
  const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM

  if (subscription.vendorApprovalStatus === 'rejected') {
    return 'REJECTED';
  }

  if (
    subscription.vendorApprovalStatus === 'pending' ||
    (subscription.isActive === false &&
      subscription.isPaused !== true &&
      subscription.billingPaid !== true &&
      subscription.vendorApprovalStatus !== 'approved')
  ) {
    return 'AWAITING_APPROVAL';
  }

  if (subscription.isPaused) {
    return 'PAUSED';
  }

  // Check if there are any overdue past months first
  if (isSubscriptionOverdue(subscription, currentMonth, allPayments)) {
    return 'PAYMENT_DUE';
  }

  // If subscription billing already marked as paid for this month (vendor confirmed)
  if (subscription.billingPaid === true && subscription.billingMonth === currentMonth) {
    return 'PAID';
  }

  // Payment record for this month: if vendor already marked PAID, treat as PAID even if subscription doc not yet synced
  if (latestPayment && latestPayment.month === currentMonth && latestPayment.status === 'PAID') {
    return 'PAID';
  }

  // Map on payment status if we have a payment for current month
  if (latestPayment && latestPayment.month === currentMonth) {
    switch (latestPayment.status) {
      case 'PAID':
        return 'PAID'; // Vendor confirmed receipt – customer can order jars
      case 'SUCCESS':
      case 'PAYMENT_REQUESTED':
        return 'PENDING_VERIFICATION'; // Customer paid, awaiting vendor confirmation
      case 'FAILED':
        return 'ACTIVE'; // Failed payment for current month, but not overdue yet
      case 'INITIATED':
      default:
        return 'PENDING_VERIFICATION';
    }
  }

  // No payment record for current month and no overdue past months
  return 'ACTIVE';
};

// Calculate monthly amount based on frequency and price
export const calculateMonthlyAmount = (
  quantity: number,
  pricePerUnit: number,
  frequency: Subscription['frequency']
): { monthlyAmount: number; savings: number; deliveriesPerMonth: number } => {
  // Calculate deliveries per month based on frequency
  let deliveriesPerMonth = 0;
  let discountPercent = 0;
  
  switch (frequency) {
    case 'daily':
      deliveriesPerMonth = 30;
      discountPercent = 20; // 20% discount for daily
      break;
    case 'alternate':
      deliveriesPerMonth = 15; // Every 2nd day = ~15 times per month
      discountPercent = 15; // 15% discount
      break;
    case 'weekly':
      deliveriesPerMonth = 4;
      discountPercent = 10; // 10% discount
      break;
    case 'biweekly':
      deliveriesPerMonth = 2;
      discountPercent = 5; // 5% discount
      break;
    case 'monthly':
      deliveriesPerMonth = 1;
      discountPercent = 0; // No discount
      break;
    default:
      deliveriesPerMonth = 1;
      discountPercent = 0;
  }
  
  const baseAmount = quantity * pricePerUnit * deliveriesPerMonth;
  const discountAmount = (baseAmount * discountPercent) / 100;
  const monthlyAmount = baseAmount - discountAmount;
  
  return {
    monthlyAmount: Math.round(monthlyAmount),
    savings: Math.round(discountAmount),
    deliveriesPerMonth,
  };
};
