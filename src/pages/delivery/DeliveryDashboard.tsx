import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Truck,
  MapPin,
  Phone,
  Navigation,
  CheckCircle,
  Package,
  IndianRupee,
  Store,
  User as UserIcon,
  ToggleLeft,
  ToggleRight,
  Clock,
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L, { type LatLngExpression } from 'leaflet';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@shared/components/ui/card';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';
import { Logo } from '@shared/components/Logo';
import { LanguageSelector } from '@shared/components/LanguageSelector';
import { useAuth, useTranslation } from '@shared/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@shared/hooks/use-toast';
import {
  getOrdersByDeliveryPerson,
  updateOrderDocument,
  getUserDocument,
  subscribeToOrdersByDeliveryPerson,
  getVendorByUid,
  updateUserLocationWithPermission,
} from '@shared/lib/firebase/firestore';
import { Order } from '@shared/lib/firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '@shared/lib/firebase';
import { haversineMeters } from '@shared/utils/geo';

const LOCATION_SYNC_MIN_MS = 20000;
const LOCATION_SYNC_MIN_MOVE_M = 40;

const GEO_REGION = 'Kolhapur, Maharashtra, India';
const KOLHAPUR_CENTER: LatLngExpression = [16.705, 74.2433];

async function geocodeOne(query: string): Promise<LatLngExpression | null> {
  if (!query || !query.trim()) return null;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query.trim())}&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'Purifies-Delivery/1.0' },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const { lat, lon } = data[0];
  return [parseFloat(lat), parseFloat(lon)];
}

async function geocodeAddress(address: string): Promise<LatLngExpression | null> {
  if (!address || !address.trim()) return null;
  const q = [address.trim(), GEO_REGION].filter(Boolean).join(', ');
  return geocodeOne(q);
}

/** Try multiple queries for better success (full address, then pincode+region, then place+region). */
async function geocodeWithFallbacks(queries: string[]): Promise<LatLngExpression | null> {
  for (const q of queries) {
    if (!q || !q.trim()) continue;
    const result = await geocodeOne(q.trim());
    if (result) return result;
  }
  return null;
}

function FitBoundsToRoute({
  driver,
  vendor,
  customer,
}: {
  driver: LatLngExpression | null;
  vendor: LatLngExpression | null;
  customer: LatLngExpression | null;
}) {
  const map = useMap();
  useEffect(() => {
    const points: [number, number][] = [];
    if (driver && Array.isArray(driver)) points.push([driver[0], driver[1]]);
    if (vendor && Array.isArray(vendor)) points.push([vendor[0], vendor[1]]);
    if (customer && Array.isArray(customer)) points.push([customer[0], customer[1]]);
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [map, driver, vendor, customer]);
  return null;
}

function CenterOnDriverButton({ position }: { position: LatLngExpression | null }) {
  const map = useMap();
  if (!position) return null;
  return (
    <button
      type="button"
      onClick={() => map.setView(position as [number, number], 16)}
      className="absolute top-2 right-2 z-[1000] bg-white dark:bg-zinc-800 text-xs font-medium px-3 py-1.5 rounded shadow hover:bg-zinc-100 dark:hover:bg-zinc-700"
    >
      Center on my location
    </button>
  );
}

export default function DeliveryDashboard() {
  const { user, logout, updateProfile } = useAuth();
  const t = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [isAvailable, setIsAvailable] = useState<boolean>(true);
  const [updatingAvailability, setUpdatingAvailability] = useState(false);
  const [driverPosition, setDriverPosition] = useState<LatLngExpression | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedVendorPosition, setSelectedVendorPosition] = useState<LatLngExpression | null>(null);
  const [selectedCustomerPosition, setSelectedCustomerPosition] = useState<LatLngExpression | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedShopAddress, setSelectedShopAddress] = useState<string | null>(null);
  const [selectedCustomerAddress, setSelectedCustomerAddress] = useState<string | null>(null);
  const [locatingOrderId, setLocatingOrderId] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profilePhone, setProfilePhone] = useState(user?.phone || '');
  const [profileAddress, setProfileAddress] = useState(user?.address || '');
  const [profileCity, setProfileCity] = useState('');
  const [profileState, setProfileState] = useState(user?.state || '');

  // Default map center (India) for OpenStreetMap
  const defaultCenter: LatLngExpression = [20.5937, 78.9629];
  const defaultZoom = 5;

  // Fetch user availability status
  useEffect(() => {
    const fetchUserAvailability = async () => {
      if (!user?.id) return;

      try {
        const userDoc = await getUserDocument(user.id);
        if (userDoc) {
          // Default to true (available) if not set (backward compatibility)
          setIsAvailable(userDoc.isAvailable !== false);
        }
      } catch (error) {
        console.error('Error fetching user availability:', error);
      }
    };

    fetchUserAvailability();
  }, [user?.id]);

  // Real-time listener for orders assigned to this delivery person
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      console.log('🔴 Setting up real-time listener for delivery person orders:', user.id);
      
      // Set up real-time listener for orders
      const unsubscribe = subscribeToOrdersByDeliveryPerson(
        user.id,
        (deliveryOrders) => {
          console.log('🟢 Real-time orders update received in DeliveryDashboard:', {
            count: deliveryOrders.length,
            orders: deliveryOrders.map(o => ({
              id: o.id,
              orderId: o.orderId,
              customerName: o.customerName,
              vendorShopName: o.vendorShopName,
              status: o.status,
              deliveryPersonUid: o.deliveryPersonUid,
            }))
          });
          
          // Double-check filtering to ensure we only show orders assigned to this delivery person
          const assignedOrders = deliveryOrders.filter(order => {
            const isAssigned = order.deliveryPersonUid && order.deliveryPersonUid === user.id;
            if (!isAssigned && order.id) {
              console.warn('⚠️ Order not assigned to this delivery person:', {
                orderId: order.orderId || order.id,
                orderDeliveryPersonUid: order.deliveryPersonUid,
                currentUserUid: user.id,
              });
            }
            return isAssigned;
          });
          
          setOrders(assignedOrders);
          setLoading(false);
          console.log('✅ Delivery orders updated in real-time:', assignedOrders.length);
          
          if (assignedOrders.length > 0) {
            console.log('📦 First order sample:', {
              id: assignedOrders[0].id,
              orderId: assignedOrders[0].orderId,
              customerName: assignedOrders[0].customerName,
              vendorShopName: assignedOrders[0].vendorShopName,
              deliveryPersonUid: assignedOrders[0].deliveryPersonUid,
              status: assignedOrders[0].status,
              hasVendorAddress: !!assignedOrders[0].vendorAddress,
              hasVendorPhone: !!assignedOrders[0].vendorPhone,
            });
          }
        },
        (error) => {
          console.error('❌ Error in delivery orders listener:', error);
          setLoading(false);
          toast({
            title: 'Error',
            description: error.message || 'Failed to load orders. Please try again.',
            variant: 'destructive',
          });
        }
      );

      // Cleanup: Unsubscribe when component unmounts or user changes
      return () => {
        console.log('🔴 Unsubscribing from delivery orders listener');
        unsubscribe();
        setOrders([]); // Clear state on cleanup
      };
    } catch (error: any) {
      console.error('❌ Error setting up delivery orders listener:', error);
      setLoading(false);
      toast({
        title: 'Error',
        description: error.message || 'Failed to set up orders listener. Please refresh the page.',
        variant: 'destructive',
      });
    }
  }, [user?.id, toast]);

  const lastFirestoreLocationRef = useRef<{ at: number; lat: number; lng: number } | null>(null);

  const pushLocationToFirestore = useCallback((lat: number, lng: number) => {
    if (!user?.id) return;
    const now = Date.now();
    const prev = lastFirestoreLocationRef.current;
    let shouldWrite = !prev || now - prev.at >= LOCATION_SYNC_MIN_MS;
    if (prev && !shouldWrite) {
      const moved = haversineMeters(prev.lat, prev.lng, lat, lng);
      if (moved >= LOCATION_SYNC_MIN_MOVE_M) shouldWrite = true;
    }
    if (!shouldWrite) return;
    lastFirestoreLocationRef.current = { at: now, lat, lng };
    updateUserLocationWithPermission(user.id, lat, lng, true).catch((err) => {
      console.warn('Could not save driver location for vendors:', err);
    });
  }, [user?.id]);

  // Track delivery person's real-time location (map + Firestore so vendors see distance to shop)
  useEffect(() => {
    if (!user?.id || user.role !== 'delivery') return;
    if (!navigator.geolocation) {
      console.warn('Geolocation is not available in this browser.');
      return;
    }

    const geoOpts: PositionOptions = {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 20000,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverPosition([lat, lng]);
        pushLocationToFirestore(lat, lng);
      },
      () => {},
      geoOpts
    );

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverPosition([lat, lng]);
        pushLocationToFirestore(lat, lng);
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      geoOpts
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user?.id, user?.role, pushLocationToFirestore]);

  // Keep local profile form in sync when user changes
  useEffect(() => {
    setProfileName(user?.name || '');
    setProfilePhone(user?.phone || '');
    setProfileAddress(user?.address || '');
    setProfileState(user?.state || '');

    // Try to derive city from address (last comma-separated part)
    if (user?.address) {
      const parts = user.address.split(',').map((p) => p.trim()).filter(Boolean);
      setProfileCity(parts.length > 1 ? parts[parts.length - 1] : '');
    } else {
      setProfileCity('');
    }
  }, [user?.name, user?.phone, user?.address, user?.state]);

  const handleSaveProfile = async () => {
    if (!user) return;
    try {
      setSavingProfile(true);
      const baseAddress = profileAddress.trim();
      const cityPart = profileCity.trim();
      const fullAddress =
        cityPart && baseAddress && !baseAddress.toLowerCase().includes(cityPart.toLowerCase())
          ? `${baseAddress}, ${cityPart}`
          : baseAddress || user.address;
      await updateProfile({
        name: profileName.trim() || user.name,
        phone: profilePhone.trim() || user.phone,
        address: fullAddress || undefined,
        state: profileState.trim() || undefined,
      });
      toast({
        title: 'Profile updated',
        description: 'Your name, phone, and address have been updated.',
      });
      setEditingProfile(false);
    } catch (error: any) {
      console.error('Error updating delivery profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not update profile. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Toggle availability status
  const handleToggleAvailability = async () => {
    if (!user?.id || updatingAvailability) return;

    try {
      setUpdatingAvailability(true);
      const newAvailability = !isAvailable;
      
      console.log('🔄 Toggling availability:', {
        userId: user.id,
        currentStatus: isAvailable,
        newStatus: newAvailability
      });
      
      // Update user document in Firestore
      const userDocRef = doc(db, 'users', user.id);
      await updateDoc(userDocRef, {
        isAvailable: newAvailability,
        updatedAt: Timestamp.now(),
      });
      
      console.log('✅ Availability updated in Firestore:', {
        userId: user.id,
        isAvailable: newAvailability,
        timestamp: new Date().toISOString()
      });
      
      setIsAvailable(newAvailability);
      
      toast({
        title: newAvailability ? 'Now Available' : 'Now Unavailable',
        description: newAvailability 
          ? 'You will appear in vendor lists for order assignments. Status updated in real-time.'
          : 'You will not appear in vendor lists until you set yourself as available.',
      });
      
      // Log that vendor should see update
      console.log('📢 Vendor dashboard should receive real-time update for user:', user.id);
    } catch (error: any) {
      console.error('❌ Error updating availability:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        stack: error.stack
      });
      toast({
        title: 'Error',
        description: error.message || 'Failed to update availability. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingAvailability(false);
    }
  };

  const handleMarkDelivered = async (orderId: string) => {
    if (updatingOrderId) return;

    try {
      setUpdatingOrderId(orderId);
      await updateOrderDocument(orderId, { status: 'delivered' });
      
      // Real-time listener will automatically update the orders
      // No need to manually refresh
      
      toast({
        title: 'Marked as Delivered',
        description: 'Order has been marked as delivered successfully.',
      });
    } catch (error: any) {
      console.error('Error marking order as delivered:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStartDelivery = async (orderId: string) => {
    if (updatingOrderId) return;

    try {
      setUpdatingOrderId(orderId);
      await updateOrderDocument(orderId, { status: 'out_for_delivery' });
      
      // Real-time listener will automatically update the orders
      // No need to manually refresh
      
      toast({
        title: 'Delivery Started',
        description: 'Order status updated to "Out for Delivery".',
      });
    } catch (error: any) {
      console.error('Error starting delivery:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update order. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Show vendor shop + customer on map; use device coords when available, else geocode with fallbacks
  const handleViewOnMap = async (order: Order) => {
    const key = order.id || order.orderId;
    setSelectedOrderId(key);
    setSelectedOrder(order);
    setLocatingOrderId(key);
    setSelectedVendorPosition(null);
    setSelectedCustomerPosition(null);
    setSelectedShopAddress(null);
    setSelectedCustomerAddress(null);

    try {
      // Build display addresses for Google Maps (shows in search bar)
      const customerAddr = [order.customerAddress, order.customerPincode].filter(Boolean).join(', ') || order.customerAddress || '';
      setSelectedCustomerAddress(customerAddr || null);

      let customerPos: LatLngExpression | null = null;
      const hasStoredCoords =
        typeof order.latitude === 'number' &&
        typeof order.longitude === 'number' &&
        Number.isFinite(order.latitude) &&
        Number.isFinite(order.longitude);

      if (hasStoredCoords) {
        customerPos = [order.latitude!, order.longitude!];
      } else {
        const customerQueries = [
          [order.customerAddress, order.customerPincode, GEO_REGION].filter(Boolean).join(', '),
          order.customerPincode ? `${order.customerPincode}, ${GEO_REGION}` : '',
          order.customerAddress ? `${order.customerAddress}, India` : '',
        ].filter(Boolean);
        customerPos = await geocodeWithFallbacks(customerQueries);
        if (!customerPos && (order.customerPincode || order.customerAddress)) {
          customerPos = await geocodeOne(`${order.customerPincode || 'Kolhapur'}, Maharashtra, India`);
        }
      }
      if (!customerPos) {
        customerPos = KOLHAPUR_CENTER;
      }

      let vendor: Awaited<ReturnType<typeof getVendorByUid>> = null;
      try {
        vendor = await getVendorByUid(order.vendorUid);
      } catch (_) {}

      // Shop address for display and Google Maps
      const shopAddr = [order.vendorShopName, vendor?.address || order.vendorAddress, vendor?.pincode].filter(Boolean).join(', ') || order.vendorAddress || '';
      setSelectedShopAddress(shopAddr || null);

      // Prefer vendor's GPS location (set via "Set shop location from GPS") for accuracy
      let vendorPos: LatLngExpression | null = null;
      if (vendor && typeof vendor.latitude === 'number' && typeof vendor.longitude === 'number' &&
          Number.isFinite(vendor.latitude) && Number.isFinite(vendor.longitude)) {
        vendorPos = [vendor.latitude, vendor.longitude];
      }
      if (!vendorPos) {
        const vendorPincode = vendor?.pincode;
        const vendorQueries = [
          [order.vendorShopName, vendor?.address || order.vendorAddress, vendorPincode, GEO_REGION].filter(Boolean).join(', '),
          [vendor?.address || order.vendorAddress, vendorPincode, GEO_REGION].filter(Boolean).join(', '),
          [order.vendorAddress, vendorPincode, GEO_REGION].filter(Boolean).join(', '),
          vendorPincode ? `${vendorPincode}, ${GEO_REGION}` : '',
          order.vendorShopName ? `${order.vendorShopName}, ${GEO_REGION}` : '',
        ].filter((q) => q && q !== GEO_REGION);
        vendorPos = await geocodeWithFallbacks(vendorQueries);
        if (!vendorPos) {
          vendorPos = await geocodeOne(`${vendor?.pincode || 'Kolhapur'}, Maharashtra, India`);
        }
      }
      if (!vendorPos) {
        vendorPos = KOLHAPUR_CENTER;
      }

      setSelectedCustomerPosition(customerPos);
      setSelectedVendorPosition(vendorPos);

      const usedFallback =
        (customerPos === KOLHAPUR_CENTER || vendorPos === KOLHAPUR_CENTER) &&
        (!hasStoredCoords || !order.vendorAddress);
      if (usedFallback) {
        toast({
          title: 'Map opened',
          description: 'One location could not be found; map centered on Kolhapur. Use "Open in Google Maps" for directions.',
        });
      }
    } catch (error: any) {
      console.error('Error loading map locations:', error);
      setSelectedCustomerPosition(KOLHAPUR_CENTER);
      setSelectedVendorPosition(KOLHAPUR_CENTER);
      setSelectedShopAddress(null);
      setSelectedCustomerAddress(null);
      toast({
        title: 'Map error',
        description: error.message || 'Showing default area. Use address to navigate.',
        variant: 'destructive',
      });
    } finally {
      setLocatingOrderId(null);
    }
  };

  // Manual refresh function (for refresh button)
  const fetchOrders = useCallback(async () => {
    if (!user?.id) return;

    try {
      const deliveryOrders = await getOrdersByDeliveryPerson(user.id);
      const assignedOrders = deliveryOrders.filter(order => 
        order.deliveryPersonUid && order.deliveryPersonUid === user.id
      );
      setOrders(assignedOrders);
      toast({
        title: 'Refreshed',
        description: `Loaded ${assignedOrders.length} orders.`,
      });
    } catch (error: any) {
      console.error('Error refreshing orders:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to refresh orders.',
        variant: 'destructive',
      });
    }
  }, [user?.id, toast]);

  // Format order items
  const formatOrderItems = (order: Order): string => {
    return order.items.map(item => {
      const jarName = item.jarType === '20L' ? '20L Jar' : item.jarType === '10L' ? '10L Jar' : 'Bottles';
      return `${item.quantity}x ${jarName}`;
    }).join(', ');
  };

  const getDeliveryTypeDisplay = (order: Order): { label: string; detail?: string } => {
    if (order.deliveryType === 'today') {
      return { label: 'Today (Quick)', detail: order.deliveryFee > 0 ? 'Express delivery' : undefined };
    }
    if (order.deliveryType === 'schedule') {
      const parts = [order.scheduledDate, order.scheduledTime].filter(Boolean);
      return { label: 'Scheduled', detail: parts.length ? parts.join(' • ') : 'Date/time not set' };
    }
    return { label: 'Subscription' };
  };

  // Calculate stats from real orders
  const assignedOrders = orders.filter(o => o.status === 'accepted' || o.status === 'preparing');
  const completedOrders = orders.filter(o => o.status === 'delivered');
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthDeliveries = completedOrders.filter((order) => {
    if (!order.createdAt) return false;
    const created = order.createdAt.toDate();
    const key = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
    return key === monthKey;
  }).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 glass border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 rounded-full bg-secondary/10 text-secondary font-medium">{t('delivery')}</span>
            <LanguageSelector />
            <Button variant="ghost" size="sm" onClick={() => { logout(); navigate('/login'); }}>{t('logout')}</Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)] items-start">
          {/* Delivery person profile */}
          <Card className="card-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserIcon className="h-5 w-5 text-primary" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {editingProfile ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="dp-name">Name</Label>
                    <Input
                      id="dp-name"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dp-phone">Phone Number</Label>
                    <Input
                      id="dp-phone"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="dp-address">Address</Label>
                    <Input
                      id="dp-address"
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      placeholder="House / Flat, Street, Area, City"
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="dp-city">City</Label>
                      <Input
                        id="dp-city"
                        value={profileCity}
                        onChange={(e) => setProfileCity(e.target.value)}
                        placeholder="City"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dp-state">State</Label>
                      <Input
                        id="dp-state"
                        value={profileState}
                        onChange={(e) => setProfileState(e.target.value)}
                        placeholder="State"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingProfile(false);
                        setProfileName(user?.name || '');
                        setProfilePhone(user?.phone || '');
                        setProfileAddress(user?.address || '');
                      }}
                      disabled={savingProfile}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveProfile}
                      disabled={savingProfile}
                    >
                      {savingProfile ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold text-base">{user?.name || 'Delivery Partner'}</p>
                    <p className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      <span>{user?.phone || 'Not set'}</span>
                    </p>
                    {user?.address && (
                      <p className="flex items-start gap-1 text-muted-foreground">
                        <MapPin className="h-4 w-4 mt-0.5" />
                        <span>{user.address}</span>
                      </p>
                    )}
                    {user?.state && (
                      <p className="text-xs text-muted-foreground">
                        State: {user.state}
                      </p>
                    )}
                    {driverPosition && (
                      <p className="text-xs text-muted-foreground flex items-start gap-1.5 pt-1 max-w-md">
                        <Navigation className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" aria-hidden />
                        <span>
                          Live location is saved for vendors so they can see how far you are from their shop (km).
                          Keep location permission on and use this dashboard while online.
                        </span>
                      </p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingProfile(true)}
                  >
                    Edit
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Availability Toggle */}
          <Card className="card-shadow">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-sm font-medium">{t('availabilityStatus')}</p>
                  <p className="text-xs text-muted-foreground">
                    {isAvailable ? t('youAreAvailable') : t('youAreNotAvailable')}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleAvailability}
                  disabled={updatingAvailability}
                  className={`gap-2 ${
                    isAvailable
                      ? 'border-success text-success hover:bg-success/10'
                      : 'border-muted-foreground text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {isAvailable ? (
                    <>
                      <ToggleRight className="h-5 w-5" />
                      {t('available')}
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="h-5 w-5" />
                      {t('unavailable')}
                    </>
                  )}
                  {updatingAvailability && <Clock className="h-4 w-4 animate-spin" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* OpenStreetMap: driver, shop, customer with routes */}
        <Card className="card-shadow">
          <CardHeader>
            <CardTitle>{t('deliveryMap') || 'Delivery Map'}</CardTitle>
          </CardHeader>
          <CardContent className="h-80 relative">
            <MapContainer
              center={
                (selectedCustomerPosition as LatLngExpression) ||
                (selectedVendorPosition as LatLngExpression) ||
                (driverPosition as LatLngExpression) ||
                defaultCenter
              }
              zoom={
                selectedCustomerPosition || selectedVendorPosition || driverPosition ? 13 : defaultZoom
              }
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {/* Driver marker */}
              {driverPosition && (
                <Marker position={driverPosition}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-blue-600">Your location (Delivery person)</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {Array.isArray(driverPosition)
                          ? `${(driverPosition as [number, number])[0].toFixed(5)}, ${(driverPosition as [number, number])[1].toFixed(5)}`
                          : ''}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {/* Vendor shop marker */}
              {selectedVendorPosition && selectedOrder && (
                <Marker position={selectedVendorPosition}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-amber-600">Shop: {selectedOrder.vendorShopName}</p>
                      {selectedOrder.vendorAddress && (
                        <p className="text-xs mt-1">{selectedOrder.vendorAddress}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {Array.isArray(selectedVendorPosition)
                          ? `${(selectedVendorPosition as [number, number])[0].toFixed(5)}, ${(selectedVendorPosition as [number, number])[1].toFixed(5)}`
                          : ''}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {/* Customer marker */}
              {selectedCustomerPosition && selectedOrder && (
                <Marker position={selectedCustomerPosition}>
                  <Popup>
                    <div className="text-sm">
                      <p className="font-semibold text-green-600">
                        Customer: {selectedOrder.customerName}
                      </p>
                      {selectedOrder.customerAddress && (
                        <p className="text-xs mt-1">{selectedOrder.customerAddress}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1 font-mono">
                        {Array.isArray(selectedCustomerPosition)
                          ? `${(selectedCustomerPosition as [number, number])[0].toFixed(5)}, ${(selectedCustomerPosition as [number, number])[1].toFixed(5)}`
                          : ''}
                      </p>
                    </div>
                  </Popup>
                </Marker>
              )}
              {/* Route: Driver → Shop */}
              {driverPosition && selectedVendorPosition && (
                <Polyline
                  positions={[driverPosition, selectedVendorPosition]}
                  pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
                />
              )}
              {/* Route: Shop → Customer */}
              {selectedVendorPosition && selectedCustomerPosition && (
                <Polyline
                  positions={[selectedVendorPosition, selectedCustomerPosition]}
                  pathOptions={{ color: '#22c55e', weight: 4, opacity: 0.8 }}
                />
              )}
              <FitBoundsToRoute
                driver={driverPosition}
                vendor={selectedVendorPosition}
                customer={selectedCustomerPosition}
              />
              <CenterOnDriverButton position={driverPosition} />
              {/* Legend */}
              {(selectedVendorPosition || selectedCustomerPosition) && (
                <div className="absolute bottom-2 left-2 z-[1000] rounded bg-white/95 dark:bg-zinc-800/95 px-2 py-1.5 text-xs shadow">
                  <p className="font-medium mb-1">Route</p>
                  <p className="text-blue-600 dark:text-blue-400">Blue: You → Shop</p>
                  <p className="text-green-600 dark:text-green-400">Green: Shop → Customer</p>
                </div>
              )}
            </MapContainer>
            {/* Google Maps turn-by-turn: uses addresses so search bar shows real addresses; origin=Current+Location uses phone GPS */}
            {selectedOrder && selectedVendorPosition && selectedCustomerPosition && (
              <div className="mt-3 flex flex-wrap gap-3">
                {(() => {
                  const shopDest = selectedShopAddress
                    ? `destination=${encodeURIComponent(selectedShopAddress)}`
                    : `destination=${(selectedVendorPosition as [number, number])[0]},${(selectedVendorPosition as [number, number])[1]}`;
                  // Omitting origin lets Google Maps use phone's real-time GPS when opened on mobile
                  const toShopUrl = `https://www.google.com/maps/dir/?api=1&${shopDest}&travelmode=driving`;
                  return (
                    <a
                      href={toShopUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
                    >
                      <Navigation className="h-4 w-4" />
                      Navigate to Shop (uses your phone location)
                    </a>
                  );
                })()}
                {(() => {
                  const shopOrig = selectedShopAddress
                    ? `origin=${encodeURIComponent(selectedShopAddress)}`
                    : `origin=${(selectedVendorPosition as [number, number])[0]},${(selectedVendorPosition as [number, number])[1]}`;
                  const custDest = selectedCustomerAddress
                    ? `destination=${encodeURIComponent(selectedCustomerAddress)}`
                    : `destination=${(selectedCustomerPosition as [number, number])[0]},${(selectedCustomerPosition as [number, number])[1]}`;
                  const toCustomerUrl = `https://www.google.com/maps/dir/?api=1&${shopOrig}&${custDest}&travelmode=driving`;
                  return (
                    <a
                      href={toCustomerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-md bg-green-500/10 px-3 py-1.5 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-500/20"
                    >
                      <Navigation className="h-4 w-4" />
                      Navigate: Shop → Customer
                    </a>
                  );
                })()}
              </div>
            )}
            {selectedOrder && selectedVendorPosition && selectedCustomerPosition && (
              <p className="mt-2 text-xs text-muted-foreground">
                Opens Google Maps with shop and customer addresses. On phone, choose &quot;My location&quot; as start for turn-by-turn navigation.
              </p>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-3 gap-4">
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{assignedOrders.length}</p>
              <p className="text-xs text-muted-foreground">{t('assigned')}</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-success">{completedOrders.length}</p>
              <p className="text-xs text-muted-foreground">{t('completed')}</p>
            </CardContent>
          </Card>
          <Card className="card-shadow">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-secondary">{monthDeliveries}</p>
              <p className="text-xs text-muted-foreground">Deliveries this month</p>
            </CardContent>
          </Card>
        </div>

        <Card className="card-shadow">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>{t('assignedDeliveries')}</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchOrders}
              disabled={loading}
            >
              {loading ? t('loading') : t('refresh')}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <p className="text-center text-muted-foreground py-4">{t('loading')}</p>
            ) : orders.length === 0 ? (
              <div className="text-center py-8">
                <Truck className="h-16 w-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <p className="text-muted-foreground font-medium mb-2">{t('noOrdersAssigned')}</p>
                <p className="text-sm text-muted-foreground">
                  {t('ordersWillAppear')}
                  <br />
                  {t('makeSureAvailable')}
                </p>
              </div>
            ) : (
              orders.map((order) => {
                // Determine order border color based on status
                const isDelivered = order.status === 'delivered';
                const isPending = order.status === 'accepted' || order.status === 'preparing' || order.status === 'pending';
                const borderColor = isDelivered 
                  ? 'border-green-500 border-4' 
                  : isPending 
                  ? 'border-red-500 border-4' 
                  : 'border-border border-2';
                
                // Determine if order is recent (within last hour)
                const orderTime = order.createdAt?.toMillis() || 0;
                const now = Date.now();
                const oneHourAgo = now - (60 * 60 * 1000);
                const isRecent = orderTime > oneHourAgo;
                
                // Get assignment date/time (when deliveryPersonUid was set)
                const assignedAt = order.updatedAt || order.createdAt;
                const assignedDate = assignedAt?.toDate();
                
                const deliveryType = getDeliveryTypeDisplay(order);
                return (
                <div key={order.id} className={`p-4 rounded-xl ${borderColor} bg-muted/30 space-y-4 ${isRecent ? 'ring-2 ring-primary/30' : ''}`}>
                  {/* Order Assignment Date/Time */}
                  {assignedDate && (
                    <div className="flex items-center justify-between gap-2 text-xs pb-2 border-b">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          <strong>Assigned on:</strong> {assignedDate.toLocaleDateString()} at {assignedDate.toLocaleTimeString()}
                        </span>
                      </div>
                      {isRecent && (
                        <span className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary font-semibold">
                          ⭐ NEW ORDER
                        </span>
                      )}
                    </div>
                  )}
                  {/* Shop Information */}
                  <div className="pb-3 border-b">
                    <div className="flex items-start gap-2">
                      <Store className="h-5 w-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-muted-foreground mb-1">Pick up from:</p>
                        <p className="font-bold">{order.vendorShopName}</p>
                        {order.vendorAddress && (
                          <div className="flex items-start gap-1 mt-1 text-sm text-muted-foreground">
                            <MapPin className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{order.vendorAddress}</span>
                          </div>
                        )}
                        {order.vendorPhone && (
                          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                            <Phone className="h-4 w-4" />
                            <span>{order.vendorPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {order.vendorPhone && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 w-full gap-1"
                        onClick={() => window.open(`tel:${order.vendorPhone}`, '_self')}
                      >
                        <Phone className="h-4 w-4" />
                        Call Shop
                      </Button>
                    )}
                  </div>

                  {/* Order Items Detail */}
                  <div className="pb-3 border-b">
                    <p className="font-semibold text-sm text-muted-foreground mb-2">Order Details:</p>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Delivery Type:</strong> {deliveryType.label}
                      {deliveryType.detail ? ` — ${deliveryType.detail}` : ''}
                    </p>
                    <div className="space-y-2">
                      {order.items && order.items.map((item, index) => (
                        <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="text-sm font-medium">
                              {item.quantity}x {item.jarType === '20L' ? '20L Jar' : item.jarType === '10L' ? '10L Jar' : 'Bottles (Pack of 12)'}
                            </span>
                          </div>
                          <span className="text-sm font-semibold">₹{item.pricePerUnit * item.quantity}</span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 border-t text-sm">
                        <span>Subtotal:</span>
                        <span className="font-semibold">₹{order.subtotal}</span>
                      </div>
                      {order.deliveryFee > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span>Delivery Fee:</span>
                          <span className="font-semibold">₹{order.deliveryFee}</span>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t font-bold">
                        <span>Total:</span>
                        <span className="text-lg">₹{order.total}</span>
                      </div>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-semibold text-sm text-muted-foreground mb-1">Deliver to:</p>
                        <p className="font-bold text-lg">{order.customerName}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          order.status === 'accepted' || order.status === 'preparing'
                            ? 'bg-primary/10 text-primary'
                            : order.status === 'out_for_delivery'
                            ? 'bg-secondary/10 text-secondary'
                            : order.status === 'delivered'
                            ? 'bg-success/10 text-success'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1).replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-start gap-2 text-sm p-2 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                        <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        <div className="flex-1">
                          <p className="font-medium text-primary mb-1">Delivery Address:</p>
                          <p className="text-foreground">{order.customerAddress}</p>
                          {order.customerPincode && (
                            <p className="text-xs text-muted-foreground mt-1">Pincode: {order.customerPincode}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-sm p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
                        <Phone className="h-4 w-4 text-success" />
                        <div>
                          <p className="font-medium text-success mb-1">Customer Phone:</p>
                          <p className="text-foreground font-semibold">{order.customerPhone}</p>
                        </div>
                      </div>
                      {order.createdAt && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                          <Clock className="h-3 w-3" />
                          <span>Order placed: {formatDistanceToNow(order.createdAt.toDate(), { addSuffix: true })}</span>
                        </div>
                      )}
                      {order.orderId && (
                        <div className="text-xs text-muted-foreground p-2">
                          Order ID: {order.orderId}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 min-w-[140px] gap-1"
                        onClick={() => window.open(`tel:${order.customerPhone}`, '_self')}
                      >
                        <Phone className="h-4 w-4" />
                        Call Customer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 min-w-[140px] gap-1"
                        onClick={() => handleViewOnMap(order)}
                        disabled={locatingOrderId === (order.id || order.orderId)}
                      >
                        <MapPin className="h-4 w-4" />
                        {locatingOrderId === (order.id || order.orderId) ? 'Locating...' : 'View on Map'}
                      </Button>
                      {(order.status === 'accepted' || order.status === 'preparing') && (
                        <Button 
                          size="sm" 
                          className="flex-1 min-w-[140px] gap-1 bg-primary hover:bg-primary/90"
                          onClick={() => order.id && handleStartDelivery(order.id)}
                          disabled={updatingOrderId === order.id}
                        >
                          <Navigation className="h-4 w-4" />
                          {updatingOrderId === order.id ? 'Starting...' : 'Start Delivery'}
                        </Button>
                      )}
                      {order.status === 'out_for_delivery' && (
                        <Button 
                          size="sm" 
                          className="flex-1 min-w-[140px] gap-1 bg-success hover:bg-success/90" 
                          onClick={() => order.id && handleMarkDelivered(order.id)}
                          disabled={updatingOrderId === order.id}
                        >
                          <CheckCircle className="h-4 w-4" />
                          {updatingOrderId === order.id ? 'Marking...' : 'Mark Delivered'}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
