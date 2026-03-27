import React, { useState, useEffect, useCallback, Suspense, lazy } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import { Browser } from '@capacitor/browser';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import AIAssistantWidget from './components/AIAssistantWidget';
import UserManagement from './components/UserManagement';
import { supabase } from './supabaseClient';
import { BotMessageSquare } from 'lucide-react';
import { logAudit } from './utils/auditLog';
import { offlineSync } from './utils/offlineSync';

// Lazy-loaded heavy modules — only downloaded when user navigates to the tab
const ArrivalForm = lazy(() => import('./components/ArrivalForm'));
const ArrivalsTable = lazy(() => import('./components/ArrivalsTable'));
const FarmsAndGrowers = lazy(() => import('./components/FarmsAndGrowers'));
const Sampling = lazy(() => import('./components/Sampling'));
const NewContainerForm = lazy(() => import('./components/NewContainerForm'));
const ContainersList = lazy(() => import('./components/ContainersList'));
const ContainerStuffingGrid = lazy(() => import('./components/ContainerStuffingGrid'));
const Reports = lazy(() => import('./components/Reports'));
const Accounting = lazy(() => import('./components/Accounting'));
const Payroll = lazy(() => import('./components/Payroll'));
const ShipmentTracker = lazy(() => import('./components/ShipmentTracker'));
const MaterialsInventory = lazy(() => import('./components/MaterialsInventory'));
const Consignees = lazy(() => import('./components/Consignees'));

// Loading fallback for lazy modules
const LazyFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '0.75rem', color: 'var(--text-tertiary)' }}>
    <div style={{ width: '24px', height: '24px', border: '3px solid var(--color-primary-soft)', borderTop: '3px solid var(--color-primary-main)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <span style={{ fontSize: '0.95rem' }}>Loading module...</span>
  </div>
);



class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '2rem', color: 'red' }}><h1>CRASH</h1><pre>{this.state.error?.stack}</pre></div>;
    }
    return this.props.children;
  }
}

function App() {
  // Restore active tab from localStorage so refreshing keeps the user on the same module
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('lavc_active_tab');
    // Don't restore transient sub-views that require prior state
    const nonRestorableTabs = ['new-container', 'edit-container', 'container-stuffing-grid'];
    if (saved && !nonRestorableTabs.includes(saved)) return saved;
    return 'dashboard';
  });
  const [tabState, setTabState] = useState(null); // Used to pass context like pre-selected farmCode
  const [arrivals, setArrivals] = useState([]);
  const [farms, setFarms] = useState([]);
  const [samplings, setSamplings] = useState([]);
  const [containers, setContainers] = useState([]);
  const [weeklyRates, setWeeklyRates] = useState([]);

  // Consignee (Buyer) State
  const [consignees, setConsignees] = useState([]);
  const [consigneeWeeklyRates, setConsigneeWeeklyRates] = useState([]);

  // Phase 12 Accounting State
  const [chartOfAccounts, setChartOfAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLines, setJournalLines] = useState([]);

  // Materials Inventory State
  const [inventoryItems, setInventoryItems] = useState([]);

  // Phase 12 Global Context
  const [exchangeRate, setExchangeRate] = useState(56.50); // Default USD to PHP Rate
  const [employees, setEmployees] = useState([]);
  const [dtrRecords, setDtrRecords] = useState([]);
  const [attendanceLocations, setAttendanceLocations] = useState([]);

  // Auth State
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // AI Assistant State
  const [isAIOpen, setIsAIOpen] = useState(false);

  // Toast System
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  };

  // Notification Read State
  const [lastReadNotifTime, setLastReadNotifTime] = useState(
    parseInt(localStorage.getItem('lavc_notif_last_read') || '0', 10)
  );

  const handleNotificationsOpen = () => {
    const now = Date.now();
    setLastReadNotifTime(now);
    localStorage.setItem('lavc_notif_last_read', now.toString());
  };

  // fetchData is defined outside useEffect so it can be passed to child components
  const fetchData = useCallback(async () => {
    try {
      // Farms — simple unordered query for maximum compatibility
      const { data: farmsData, error: farmsErr } = await supabase.from('farms').select('*');
      if (farmsErr) {
        if (Capacitor.isNativePlatform()) alert(`[Fetch] Farms failed: ${farmsErr.message}`);
        console.error('[Fetch] Farms failed:', farmsErr.code, farmsErr.message, farmsErr.hint);
      } else {
        console.log('[Fetch] Farms loaded:', farmsData?.length ?? 0);
        if (Capacitor.isNativePlatform() && (!farmsData || farmsData.length === 0)) {
           alert('Farms loaded but returned 0 rows. Is RLS still blocking or DB empty?');
        }
        setFarms(farmsData || []);
      }

      const { data: arrivalsData } = await supabase.from('arrivals').select('*').order('dateTimeEncoded', { ascending: false });
      if (arrivalsData) setArrivals(arrivalsData);

      const { data: samplingsData } = await supabase.from('samplings').select('*').order('encodedAt', { ascending: false });
      if (samplingsData) setSamplings(samplingsData);

      const { data: containersData } = await supabase.from('containers').select('*').order('dateCreated', { ascending: false });
      if (containersData) setContainers(containersData);

      const { data: ratesData } = await supabase.from('weekly_rates').select('*').order('created_at', { ascending: false });
      if (ratesData) setWeeklyRates(ratesData);

      const { data: invData } = await supabase.from('materials_inventory').select('*').order('item_code', { ascending: true });
      if (invData) setInventoryItems(invData);

      const { data: coaData } = await supabase.from('chart_of_accounts').select('*').order('code', { ascending: true });
      if (coaData) setChartOfAccounts(coaData);

      const { data: jeData } = await supabase.from('journal_entries').select('*').order('date_posted', { ascending: false });
      if (jeData) setJournalEntries(jeData);

      const { data: jlData } = await supabase.from('journal_lines').select('*');
      if (jlData) setJournalLines(jlData);

      // HR/Payroll tables may not yet exist - catch individually
      try {
        const { data: empData, error: empErr } = await supabase.from('employees').select('*').order('last_name', { ascending: true });
        if (!empErr && empData) setEmployees(empData);
      } catch { /* table may not exist yet */ }

      try {
        const { data: dtrData, error: dtrErr } = await supabase.from('dtr_records').select('*');
        if (!dtrErr && dtrData) setDtrRecords(dtrData);
      } catch { /* table may not exist yet */ }

      try {
        const { data: locData, error: locErr } = await supabase.from('attendance_locations').select('*');
        if (!locErr && locData) setAttendanceLocations(locData);
      } catch { /* table may not exist yet */ }

      try {
        await supabase.from('accounting_periods').select('*');
      } catch { /* table may not exist yet */ }

      // Consignees
      try {
        const { data: consData, error: consErr } = await supabase.from('consignees').select('*').order('last_modified', { ascending: false });
        if (!consErr && consData) setConsignees(consData);
      } catch { /* table may not exist yet */ }

      try {
        const { data: cwrData, error: cwrErr } = await supabase.from('consignee_weekly_rates').select('*').order('created_at', { ascending: false });
        if (!cwrErr && cwrData) setConsigneeWeeklyRates(cwrData);
      } catch { /* table may not exist yet */ }

    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    }
  }, []);

  // Fetch initial data & handle Auth
  useEffect(() => {
    // Failsafe timeout to prevent infinite loading
    const authTimeout = setTimeout(() => {
      console.warn('[Failsafe] authLoading timeout reached, forcing false.');
      setAuthLoading(false);
    }, 6000);

    // Check initial Supabase session — only for setting user state immediately
    console.log('[Auth] Calling getSession()');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[Auth] getSession resolved!', !!session);
      if (error) console.error('[Auth] getSession error:', error);
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
        fetchData();
      } else {
        setAuthLoading(false);
      }
    }).catch(err => {
      console.error('[Auth] getSession crashed:', err);
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[Auth] Event:', event, session?.user?.email);
        if (session?.user) {
          setUser(session.user);
          fetchUserProfile(session.user.id);
          // Refetch data on ALL session-establishing events
          if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
            fetchData();
          }
        } else {
          setUser(null);
          setUserProfile(null);
          setAuthLoading(false);
          // Clear sensitive data on logout
          setFarms([]);
          setArrivals([]);
        }
      }
    );

    let deepLinkCleanup;
    if (Capacitor.isNativePlatform()) {
      // When the external browser redirects to com.lavc.bananatracker://login-callback#access_token=...
      // Android opens the app and fires this event. We extract the tokens and set the session.
      deepLinkCleanup = CapApp.addListener('appUrlOpen', async ({ url }) => {
        console.log('Deep link received:', url);
        // The OAuth redirect puts tokens in the URL hash fragment
        // e.g. com.lavc.bananatracker://login-callback#access_token=...&refresh_token=...
        if (url.includes('access_token') && url.includes('refresh_token')) {
          const hashPart = url.split('#')[1];
          if (hashPart) {
            const params = new URLSearchParams(hashPart);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            if (accessToken && refreshToken) {
              const { error } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (error) {
                console.error('Failed to set session from deep link:', error);
              } else {
                console.log('Session set from deep link successfully');
                await Browser.close(); // Close the OAuth Custom Tab
              }
            }
          }
        }
      });
    }

    // -- CAPACITOR PERMISSIONS --
    if (Capacitor.isNativePlatform()) {
      const requestPermissions = async () => {
        // Camera Permissions (used by html5-qrcode via WebView)
        try {
          const cameraStatus = await Camera.checkPermissions();
          if (cameraStatus.camera !== 'granted' || cameraStatus.photos !== 'granted') {
            await Camera.requestPermissions({ permissions: ['camera', 'photos'] });
          }
        } catch (err) {
          console.warn('Camera permission request failed (non-fatal):', err);
        }

        // Push Notifications
        try {
          let pushStatus = await PushNotifications.checkPermissions();
          if (pushStatus.receive !== 'granted') {
            pushStatus = await PushNotifications.requestPermissions();
          }
          if (pushStatus.receive === 'granted') {
            try {
              await PushNotifications.register();
              console.log('Push notifications registered successfully');
            } catch (regErr) {
              console.warn('Push notification registration failed (FCM not configured?):', regErr);
            }
          }
        } catch (err) {
          console.warn('Push notification permission request failed (non-fatal):', err);
        }
      };

      requestPermissions();
    }

    return () => {
      subscription.unsubscribe();
      if (deepLinkCleanup) deepLinkCleanup.remove();
    };
  }, [fetchData]);

  // Global: Patch all <input type="number"> with inputMode="decimal" for better mobile numpad
  useEffect(() => {
    const patchNumberInputs = () => {
      document.querySelectorAll('input[type="number"]:not([inputmode])').forEach(el => {
        el.setAttribute('inputmode', 'decimal');
      });
    };
    // Patch on mount
    patchNumberInputs();
    // Re-patch when DOM changes (new forms open, tabs switch, etc.)
    const observer = new MutationObserver(patchNumberInputs);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Push Notification Listeners — save token + handle received notifications
  useEffect(() => {
    if (Capacitor.isNativePlatform() && user) {
      // When we receive a registration token, save it to the user's profile
      const tokenListener = PushNotifications.addListener('registration', async (token) => {
        console.log('[Push] FCM Token:', token.value);
        try {
          await supabase.from('profiles').update({ fcm_token: token.value }).eq('id', user.id);
        } catch (e) {
          console.warn('[Push] Failed to save FCM token:', e);
        }
      });

      // When a push notification arrives while app is in foreground
      const receivedListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push] Received:', notification);
        showToast(notification.body || notification.title || 'New notification', 'success');
      });

      // When user taps a push notification
      const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[Push] Tapped:', notification);
        // Could navigate to a specific tab based on notification data
        const tab = notification.notification?.data?.tab;
        if (tab) handleNavigate(tab);
      });

      return () => {
        tokenListener.then(l => l.remove());
        receivedListener.then(l => l.remove());
        actionListener.then(l => l.remove());
      };
    }
  }, [user]);

  // Session inactivity timeout — auto-logout after 30 minutes of no interaction
  useEffect(() => {
    if (!user) return;

    const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
    let timeoutId;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('[Security] Session timed out after 30 min inactivity');
        handleLogout();
      }, SESSION_TIMEOUT);
    };

    // Reset on any user interaction
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer(); // Start the timer

    return () => {
      clearTimeout(timeoutId);
      events.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [user]);

  // Sync profile when user changes (handles both real and dev bypass users)
  useEffect(() => {
    if (user) {
      if (!userProfile || userProfile.id !== user.id) {
        fetchUserProfile(user.id);
      }
    } else {
      setUserProfile(null);
    }
  }, [user, userProfile]);

  const fetchUserProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!error && data) {
        setUserProfile(data);
      } else {
        // Auto-create profile for Google OAuth users (first login)
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        const meta = currentUser?.user_metadata || {};
        const userEmail = currentUser?.email?.toLowerCase() || '';

        // Boss emails that always get Admin role on first login
        const bossEmailsRaw = import.meta.env.VITE_BOSS_EMAILS || 'jannicop@gmail.com';
        const BOSS_EMAILS = bossEmailsRaw.split(',').map(e => e.trim().toLowerCase());
        const isBoss = BOSS_EMAILS.includes(userEmail);

        // Also check if this is the very first user (auto-admin fallback)
        const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const isFirstUser = (count === 0 || count === null);

        const newProfile = {
          id: userId,
          full_name: meta.full_name || meta.name || meta.email?.split('@')[0] || 'New User',
          role: (isBoss || isFirstUser) ? 'Administrator' : 'Pending',
          department: meta.department || '',
          avatar_url: meta.avatar_url || meta.picture || null,
        };

        // Attempt to insert — ignore conflict if trigger already created it
        await supabase.from('profiles').upsert(newProfile, { onConflict: 'id' });
        setUserProfile(newProfile);
      }
    } catch (e) {
      console.error("Error fetching profile", e);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  const handleNavigate = (tabInfo) => {
    if (typeof tabInfo === 'string') {
      setActiveTab(tabInfo);
      setTabState(null);
      localStorage.setItem('lavc_active_tab', tabInfo);
    } else {
      setActiveTab(tabInfo.name);
      setTabState(tabInfo.state || null);
      localStorage.setItem('lavc_active_tab', tabInfo.name);
    }
  };

  const handleAddArrival = async (newArrivalsBatch) => {
    try {
      const { success, data, queued } = await offlineSync.mutate('insert', 'arrivals', newArrivalsBatch);

      if (success) {
        if (queued) {
          // Optimistic local state rendering for offline PWA
          setArrivals(prev => [...newArrivalsBatch, ...prev]);
          alert('📱 Offline Mode: Arrival logged securely and queued for background syncing when internet returns.');
          return true;
        } else if (data) {
          setArrivals(prev => [...data, ...prev]);
          return true;
        }
      }
    } catch (error) {
      console.error("Offline Sync error (Arrivals):", error);
      alert(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}`);
      return false;
    }
  };

  const handleSaveContainer = async (containerData) => {
    const isUpdate = containerData.id && containers.some(c => c.id === containerData.id);

    // Omit columns that are purely front-end display properties
    const {
      timeOfDeparture,
      bookingNo,
      buyer_name,
      vesselVoyage,
      driverName,
      plugInTime: _plugInTime,
      plugOutTime: _plugOutTime,
      dateArrived,
      timeArrived,
      ...dbPayload
    } = containerData;

    if (isUpdate) {
      try {
        const { success, data, queued } = await offlineSync.mutate('update', 'containers', dbPayload, { id: containerData.id });
        if (success) {
          const updatedContainer = { ...(data ? data[0] : dbPayload), timeOfDeparture, bookingNo, buyer_name, vesselVoyage, driverName, dateArrived, timeArrived };
          setContainers(prev => prev.map(c => c.id === containerData.id ? { ...c, ...updatedContainer } : c));
          if (queued) alert('📱 Offline Mode: Container modifications saved safely locally.');
          handleNavigate('containers-list');
        }
      } catch (error) {
        console.error("Supabase error (Update Container):", error);
        alert(`Failed to update container registry in database. Error: ${error.message}`);
      }
    } else {
      try {
        const { success, data, queued } = await offlineSync.mutate('insert', 'containers', dbPayload);
        if (success) {
          const newContainer = { ...(data ? data[0] : dbPayload), timeOfDeparture, bookingNo, buyer_name, vesselVoyage, driverName, dateArrived, timeArrived };
          setContainers(prev => [newContainer, ...prev]);
          if (queued) alert('📱 Offline Mode: New Container correctly registered locally.');
          handleNavigate('containers-list');
        }
      } catch (error) {
        console.error("Supabase error (Create Container):", error);
        alert(`Failed to create container registry in database. Error: ${error.message}`);
      }
    }
  };

  const handleSaveContentPayload = async (containerId, payload) => {
    const targetContainer = containers.find(c => c.id === containerId);
    if (!targetContainer) return;

    const newTotalBoxes = (targetContainer.totalBoxes || 0) + payload.total;
    const newStuffedItems = [...(targetContainer.stuffedItems || []), payload];

    // Automatically manage started and ended times as instructed
    const updates = { totalBoxes: newTotalBoxes, stuffedItems: newStuffedItems };

    if (newStuffedItems.length === 1 && !targetContainer.timeStarted) {
      updates.timeStarted = new Date().toISOString();
    }

    if (newTotalBoxes >= 1540 && !targetContainer.timeEnded) {
      updates.timeEnded = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('containers')
      .update(updates)
      .eq('id', containerId)
      .select();

    if (error) {
      console.error("Supabase error (Stuffed Items):", error);
      alert("Failed to save stuffing payload data.");
      return;
    }

    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
      handleNavigate('containers-list');
    }
  };

  const handleSealContainer = async (containerId) => {
    const timeSealed = new Date().toISOString();

    // As the timeSealed native column might not be initialized on all remote databases 
    // until next major migration, we explicitly update transit_status instead, 
    // and hold timeSealed in memory/app state for seamless UI transitioning.
    const { data, error } = await supabase
      .from('containers')
      .update({ transit_status: 'SEALED' })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error("Supabase error (Seal Container):", error);
      alert("Failed to seal container.");
      return;
    }

    if (data && data[0]) {
      // Patch the local state with timeSealed so the UI reacts correctly
      setContainers(prev => prev.map(c => c.id === containerId ? { ...data[0], timeSealed } : c));
      logAudit('SEAL_CONTAINER', 'container', containerId, { timeSealed });
    }
  };

  const handleDepartContainer = async (containerId) => {
    const timeDeparted = new Date().toISOString();
    const { data, error } = await supabase
      .from('containers')
      .update({ timeDeparted })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error("Supabase error (Depart Container):", error);
      alert("Failed to run departure dispatch command.");
      return;
    }

    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
      logAudit('DEPART_CONTAINER', 'container', containerId, { timeDeparted });
    }
  };

  const handleUpdateTransitStatus = async (containerId, newStatus) => {
    const transit_updated_at = new Date().toISOString();
    const { data, error } = await supabase
      .from('containers')
      .update({ transit_status: newStatus, transit_updated_at })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error("Supabase error (Update Transit):", error);
      alert("Failed to update transit status.");
      return;
    }

    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
    }
  };

  // --- Stuffed Payload Override Handlers ---
  const handleEditStuffedPayload = async (containerId, payloadId, newPayloadData, operatorName) => {
    const targetContainer = containers.find(c => c.id === containerId);
    if (!targetContainer || !targetContainer.stuffedItems) return;

    const oldPayload = targetContainer.stuffedItems.find(p => p.id === payloadId);
    if (!oldPayload) { alert('Payload not found.'); return; }

    // Write audit log
    await supabase.from('override_audit_logs').insert({
      action: 'EDIT',
      entity_type: 'STUFFED_PAYLOAD',
      entity_id: payloadId,
      batch_id: null,
      container_id: containerId,
      old_data: oldPayload,
      new_data: newPayloadData,
      operator_name: operatorName
    });

    // Replace the payload in the array
    const updatedItems = targetContainer.stuffedItems.map(p =>
      p.id === payloadId ? { ...p, data: newPayloadData.data, total: newPayloadData.total } : p
    );
    const newTotalBoxes = updatedItems.reduce((sum, p) => sum + (p.total || 0), 0);

    const { data, error } = await supabase
      .from('containers')
      .update({ stuffedItems: updatedItems, totalBoxes: newTotalBoxes })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error('Supabase error (Edit Payload):', error);
      alert(`Failed to update payload: ${error.message}`);
      return;
    }
    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
    }
  };

  const handleDeleteStuffedPayload = async (containerId, payloadId, operatorName) => {
    const targetContainer = containers.find(c => c.id === containerId);
    if (!targetContainer || !targetContainer.stuffedItems) return;

    const oldPayload = targetContainer.stuffedItems.find(p => p.id === payloadId);
    if (!oldPayload) { alert('Payload not found.'); return; }

    if (!window.confirm(`Delete payload ${payloadId} (${oldPayload.total} boxes)? This cannot be undone.`)) return;

    // Write audit log
    await supabase.from('override_audit_logs').insert({
      action: 'DELETE',
      entity_type: 'STUFFED_PAYLOAD',
      entity_id: payloadId,
      batch_id: null,
      container_id: containerId,
      old_data: oldPayload,
      new_data: null,
      operator_name: operatorName
    });

    // Remove the payload from the array
    const updatedItems = targetContainer.stuffedItems.filter(p => p.id !== payloadId);
    const newTotalBoxes = updatedItems.reduce((sum, p) => sum + (p.total || 0), 0);

    const { data, error } = await supabase
      .from('containers')
      .update({ stuffedItems: updatedItems, totalBoxes: newTotalBoxes })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error('Supabase error (Delete Payload):', error);
      alert(`Failed to delete payload: ${error.message}`);
      return;
    }
    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
    }
  };

  // Calculate high level metrics
  // ONLY count APPROVED arrivals
  const approvedArrivals = arrivals.filter(arr => arr.approval_status === 'APPROVED');

  const todayStr = new Date().toISOString().split('T')[0]; // e.g. '2026-03-23'

  const todayArrivals = approvedArrivals.filter(arr => {
    const packed = arr.dateOfPacking || arr.dateTimeEncoded?.split('T')[0];
    return packed === todayStr;
  });

  const totalBoxesToday = todayArrivals.reduce((sum, arr) => sum + (arr.quantity || 0), 0);
  const totalBoxesAllTime = approvedArrivals.reduce((sum, arr) => sum + (arr.quantity || 0), 0);

  const classATotal = approvedArrivals.reduce((sum, arr) => {
    const isA = arr.typeId ? arr.typeId.startsWith('classA') : (arr.ccClass === 'A' || arr.ccClass === 'Class A' || arr.ccClass === 'SH' || arr.ccClass === 'A (Cluster)');
    return isA ? sum + (arr.quantity || 0) : sum;
  }, 0);
  const classBTotal = approvedArrivals.reduce((sum, arr) => {
    const isB = arr.typeId ? arr.typeId.startsWith('classB') : (arr.ccClass === 'B' || arr.ccClass === 'Class B' || arr.ccClass === 'B (Cluster)' || arr.ccClass === 'B (Finger Pack)');
    return isB ? sum + (arr.quantity || 0) : sum;
  }, 0);

  // Calculate unique farms based on the new 'farmName' property
  const uniqueFarms = new Set(approvedArrivals.map(arr => arr.farmName));

  const calculateRemainingInventory = () => {
    const inventory = {};

    // Initial arrival quantities (ONLY APPROVED)
    approvedArrivals.forEach(arr => {
      if (arr.typeId) {
        inventory[arr.typeId] = (inventory[arr.typeId] || 0) + arr.quantity;
      }
    });

    // Subtract stuffed quantities
    containers.forEach(container => {
      if (container.stuffedItems) {
        container.stuffedItems.forEach(payload => {
          if (payload.data) {
            Object.keys(payload.data).forEach(classGroupName => {
              const classObj = payload.data[classGroupName];
              Object.keys(classObj).forEach(sizeKey => {
                const val = Number(classObj[sizeKey]) || 0;
                if (val > 0) {
                  const typeId = `${classGroupName}.${sizeKey}`;
                  if (inventory[typeId] !== undefined) {
                    inventory[typeId] -= val;
                  }
                }
              });
            });
          }
        });
      }
    });
    return inventory;
  };

  const handleApproveArrival = async (arrivalId, batchId) => {
    // ── Step 1: Fetch the rows we're about to approve so we can read farmCode + date ──
    let fetchQuery = supabase.from('arrivals').select('*');
    if (batchId) fetchQuery = fetchQuery.eq('batchId', batchId);
    else fetchQuery = fetchQuery.eq('id', arrivalId);
    const { data: rowsToApprove, error: fetchErr } = await fetchQuery;
    if (fetchErr || !rowsToApprove?.length) {
      alert(`Failed to fetch arrival rows: ${fetchErr?.message || 'Unknown error'}`);
      return;
    }

    // ── Step 2: Resolve locked_rate for each row from weekly_rates ──
    // Use the arrival's packing date to determine the week number
    const getWeekNum = (dateStr) => {
      const d = new Date(dateStr); const s = new Date(d.getFullYear(), 0, 1);
      return { week: Math.ceil((d.getDay() + 1 + Math.floor((d - s) / 86400000)) / 7), year: d.getFullYear() };
    };

    // typeId → rates_matrix key mapping
    const TYPE_TO_RATE_KEY = {
      'classA.rha4': 'classA.rha4', 'classA.rha5': 'classA.rha5', 'classA.rha6': 'classA.rha6',
      'classA.sha7': 'classA.sha7', 'classA.sha8': 'classA.sha8', 'classA.sha9': 'classA.sha9',
      'classA.cla':  'classA.cla',
      'classB.rhb4': 'classB.rhb4', 'classB.rhb5': 'classB.rhb5', 'classB.rhb6': 'classB.rhb6',
      'classB.shb7': 'classB.shb7', 'classB.shb8': 'classB.shb8', 'classB.shb9': 'classB.shb9',
      'classB.clb':  'classB.clb',  'classB.fp':   'classB.fp',
    };

    // Build per-row updates with locked_rate
    const rowUpdates = rowsToApprove.map(row => {
      const packDate = row.dateOfPacking || row.dateTimeArrive;
      const { week, year } = packDate ? getWeekNum(packDate) : { week: null, year: null };

      // Find matching rate record in state
      let lockedRate = 0;
      if (week && year && row.farmCode) {
        const farm = farms.find(f => f.farmCode === row.farmCode);
        if (farm) {
          const rateRecord = weeklyRates.find(r =>
            r.farm_id === farm.id && r.year === year && r.week_number === week
          );
          if (rateRecord?.rates_matrix && row.typeId && TYPE_TO_RATE_KEY[row.typeId]) {
            lockedRate = Number(rateRecord.rates_matrix[TYPE_TO_RATE_KEY[row.typeId]] || 0);
          }
        }
      }
      return { ...row, locked_rate: lockedRate, approval_status: 'APPROVED', approved_by: user?.id };
    });

    // ── Step 3: Batch-update all rows in one upsert ──
    const { data, error } = await supabase
      .from('arrivals')
      .upsert(rowUpdates, { onConflict: 'id' })
      .select();

    if (error) {
      console.error("Supabase error (Approve Arrival):", error);
      alert(`Failed to approve arrival: ${error.message || 'Unknown error'}`);
      return;
    }

    if (data && data.length > 0) {
      const updatedMap = new Map(data.map(item => [item.id, item]));
      setArrivals(prev => prev.map(a => updatedMap.has(a.id) ? updatedMap.get(a.id) : a));
      logAudit('APPROVE_ARRIVAL', 'arrival', batchId || arrivalId, { count: data.length });

      // Show rate info in toast if available
      const totalGross = data.reduce((s, r) => s + (Number(r.quantity || 0) * Number(r.locked_rate || 0)), 0);
      if (totalGross > 0) {
        showToast?.(`✅ Batch approved — ₱${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })} locked`, 'success');
      }
    }
  };

  const handleDeleteArrival = async (arrivalId, batchId) => {
    if (!window.confirm('Are you sure you want to delete this arrival batch? This cannot be undone.')) return;

    let query = supabase.from('arrivals').delete();
    if (batchId) {
      query = query.eq('batchId', batchId);
    } else {
      query = query.eq('id', arrivalId);
    }

    const { error } = await query;
    if (error) {
      console.error('Supabase error (Delete Arrival):', error);
      alert(`Failed to delete arrival: ${error.message}`);
      return;
    }

    if (batchId) {
      setArrivals(prev => prev.filter(a => a.batchId !== batchId));
    } else {
      setArrivals(prev => prev.filter(a => a.id !== arrivalId));
    }
    logAudit('DELETE_ARRIVAL', 'arrival', batchId || arrivalId);
  };

  const remainingInventoryDetailed = calculateRemainingInventory();

  const remainingTotal = Object.values(remainingInventoryDetailed).reduce((sum, val) => sum + val, 0);
  const remainingClassA = Object.keys(remainingInventoryDetailed).filter(k => k.startsWith('classA')).reduce((sum, k) => sum + remainingInventoryDetailed[k], 0);
  const remainingClassB = Object.keys(remainingInventoryDetailed).filter(k => k.startsWith('classB')).reduce((sum, k) => sum + remainingInventoryDetailed[k], 0);

  const inventoryMetrics = {
    total: remainingTotal,
    classA: remainingClassA,
    classB: remainingClassB,
    detailed: remainingInventoryDetailed
  };

  // ADVANCED ANALYTICS
  const globalSampledBoxes = samplings.flatMap(s => s.boxes || []);
  const downgradeRate = globalSampledBoxes.length > 0
    ? (globalSampledBoxes.filter(b => b.decision === 'DOWNGRADED').length / globalSampledBoxes.length) * 100
    : 0;

  const farmVolumes = {};
  approvedArrivals.forEach(arr => {
     farmVolumes[arr.farmName || 'Unknown'] = (farmVolumes[arr.farmName || 'Unknown'] || 0) + (arr.quantity || 0);
  });
  const topFarmsList = Object.entries(farmVolumes)
     .sort((a,b) => b[1] - a[1])
     .slice(0, 5)
     .map(([name, volume]) => ({ name, volume }));

  const totalRev = containers.reduce((s, c) => s + (Number(c.totalBoxes || 0) * (Number(c.agreed_rate) || 0)), 0);
  const collected = containers.reduce((s, c) => s + (Number(c.amount_paid_partial) || 0), 0);
  const collectionRate = totalRev > 0 ? (collected / totalRev) * 100 : 100;

  const advancedAnalytics = { downgradeRate, topFarms: topFarmsList, collectionRate };

  const [smartNotifications, setSmartNotifications] = useState([]);

  useEffect(() => {
    const now = Date.now();
    const TODAY_START = new Date().setHours(0, 0, 0, 0);
    const notifs = [];

    // 1. Daily Summary — only if there was actual activity today
    if (totalBoxesToday > 0) {
      notifs.push({
        id: 'daily-summary',
        title: 'Daily Summary',
        message: `${totalBoxesToday} boxes logged today across ${uniqueFarms.size} active farms.`,
        icon: '📊',
        time: now,
      });
    }

    // 2. Unsealed / Pending containers — only if there are any
    const unsealed = containers.filter(c => !c.transit_status || c.transit_status === 'PENDING');
    if (unsealed.length > 0) {
      notifs.push({
        id: 'unsealed-summary',
        title: `${unsealed.length} Container${unsealed.length > 1 ? 's' : ''} Pending Dispatch`,
        message: `${unsealed.length} container${unsealed.length > 1 ? 's are' : ' is'} awaiting seal and departure.`,
        icon: '🚢',
        time: now - 60000 * 10,
      });
    }

    // 3. Quality alert — only if there IS sampled data AND rate is bad (>15%)
    if (globalSampledBoxes.length > 0 && downgradeRate > 15) {
      notifs.push({
        id: 'quality-dip',
        title: 'Quality Alert',
        message: `Downgrade rate at ${downgradeRate.toFixed(1)}% — above the 15% threshold. Review packing.`,
        icon: '📉',
        time: now - 60000 * 20,
      });
    }

    // 4. Cash flow alert — only if collection rate is actually low
    if (collectionRate < 70 && containers.length > 0) {
      notifs.push({
        id: 'cash-flow',
        title: 'Low Collection Rate',
        message: `Collection efficiency at ${collectionRate.toFixed(0)}%. Follow up on outstanding receivables.`,
        icon: '💸',
        time: now - 60000 * 30,
      });
    }

    // 5. New arrivals needing approval
    const pendingApproval = arrivals.filter(a => a.approval_status === 'PENDING');
    if (pendingApproval.length > 0) {
      notifs.push({
        id: 'pending-approval',
        title: `${pendingApproval.length} Arrival${pendingApproval.length > 1 ? 's' : ''} Pending Approval`,
        message: `${pendingApproval.length} arrival log${pendingApproval.length > 1 ? 's' : ''} awaiting your review.`,
        icon: '✅',
        time: now - 60000 * 5,
      });
    }

    // Mark read state based on when user last opened the panel
    const processedNotifs = notifs.map(n => ({
      ...n,
      read: n.time <= lastReadNotifTime
    }));

    setSmartNotifications(processedNotifs);
  }, [arrivals, containers, totalBoxesToday, uniqueFarms.size, downgradeRate, globalSampledBoxes.length, collectionRate, lastReadNotifTime]);

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading Application...</div>;
  }

  if (!user) {
    return <Login />;
  }

  return (
    <ErrorBoundary>
      <Layout 
        activeTab={activeTab} 
        onTabChange={handleNavigate} 
        userProfile={userProfile} 
        onLogout={handleLogout} 
        notifications={smartNotifications} 
        onNotificationsOpen={handleNotificationsOpen}
        onRefresh={fetchData}
        arrivals={arrivals}
        farms={farms}
        samplings={samplings}
      >
        <Suspense fallback={<LazyFallback />}>
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={{
              totalBoxes: totalBoxesToday,
              totalBoxesAllTime: totalBoxesAllTime,
              totalTrips: todayArrivals.length,
              classATotal: classATotal,
              classBTotal: classBTotal,
              activeFarms: uniqueFarms.size,
              activeContainers: containers.filter(c => c.totalBoxes > 0 && !c.timeDeparted),
              remainingInventory: inventoryMetrics,
              pendingArrivalsCount: arrivals.filter(a => a.approval_status !== 'APPROVED').length,
              unsealedContainersCount: containers.filter(c => !c.transit_status || c.transit_status === 'PENDING').length,
              sealedContainersCount: containers.filter(c => c.timeSealed).length,
              activeSamplingsCount: samplings.filter(s => s.status !== 'COMPLETED').length,
              advancedAnalytics: advancedAnalytics
            }}
            userProfile={userProfile}
            onNavigate={handleNavigate}
            arrivals={arrivals}
            containers={containers}
            samplings={samplings}
            farms={farms}
            weeklyRates={weeklyRates}
          />
        )}

        {activeTab === 'log-arrival' && (
          <ArrivalForm
            arrivals={arrivals}
            onApproveArrival={handleApproveArrival}
            onDeleteArrival={handleDeleteArrival}
            setArrivals={setArrivals}
            userProfile={userProfile}
            onAddArrival={handleAddArrival}
            farms={farms}
            weeklyRates={weeklyRates}
            samplings={samplings}
            setSamplings={setSamplings}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'sampling' && (
          <Sampling
            farms={farms}
            samplings={samplings}
            setSamplings={setSamplings}
            onNavigate={handleNavigate}
            initialFarmCode={tabState?.farmCode}
          />
        )}

        {activeTab === 'farms' && (
          <FarmsAndGrowers
            farms={farms}
            setFarms={setFarms}
            weeklyRates={weeklyRates}
            setWeeklyRates={setWeeklyRates}
            arrivals={arrivals}
            samplings={samplings}
          />
        )}

        {activeTab === 'consignees' && (
          <Consignees
            consignees={consignees}
            setConsignees={setConsignees}
            consigneeWeeklyRates={consigneeWeeklyRates}
            setConsigneeWeeklyRates={setConsigneeWeeklyRates}
          />
        )}

        {activeTab === 'new-container' && (
          <NewContainerForm
            onSaveContainer={handleSaveContainer}
            onCancel={() => handleNavigate('containers-list')}
            consignees={consignees}
          />
        )}

        {activeTab === 'edit-container' && tabState?.containerId && (
          <NewContainerForm
            onSaveContainer={handleSaveContainer}
            initialData={containers.find(c => c.id === tabState.containerId)}
            onCancel={() => handleNavigate('containers-list')}
            consignees={consignees}
          />
        )}

        {activeTab === 'container-stuffing-grid' && tabState?.containerId && (
          <ContainerStuffingGrid
            containerId={tabState.containerId}
            containers={containers}
            remainingInventory={inventoryMetrics}
            onSavePayload={handleSaveContentPayload}
            onCancel={() => handleNavigate('containers-list')}
          />
        )}

        {activeTab === 'inventory' && (
          <MaterialsInventory
            inventoryItems={inventoryItems}
            setInventoryItems={setInventoryItems}
            userProfile={userProfile}
            farms={farms}
          />
        )}

        {activeTab === 'containers-list' && (
          <ContainersList
            containers={containers}
            onNavigate={handleNavigate}
            onDepartContainer={handleDepartContainer}
            onSealContainer={handleSealContainer}
            onEditPayload={handleEditStuffedPayload}
            onDeletePayload={handleDeleteStuffedPayload}
          />
        )}

        {activeTab === 'reports' && (
          <Reports
            arrivals={arrivals}
            containers={containers}
            samplings={samplings}
          />
        )}

        {activeTab === 'accounting' && (
          <Accounting
            arrivals={arrivals}
            samplings={samplings}
            containers={containers}
            farms={farms}
            weeklyRates={weeklyRates}
            consignees={consignees}
            consigneeWeeklyRates={consigneeWeeklyRates}
            userProfile={userProfile}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
            chartOfAccounts={chartOfAccounts}
            journalEntries={journalEntries}
            journalLines={journalLines}
            showToast={showToast}
          />
        )}

        {activeTab === 'payroll' && (
          <Payroll
            showToast={showToast}
            employees={employees}
            dtrRecords={dtrRecords}
            attendanceLocations={attendanceLocations}
            fetchData={fetchData}
            initialTab={tabState?.tab}
          />
        )}

        {activeTab === 'shipment-tracker' && (
          <ShipmentTracker
            containers={containers}
            onUpdateTransitStatus={handleUpdateTransitStatus}
          />
        )}

        {activeTab === 'user-management' && (
          <UserManagement userProfile={userProfile} />
        )}

        {/* Premium AI Assistant FAB Trigger */}
        <button
          className="ai-copilot-fab"
          style={{
            position: 'fixed',
            bottom: window.innerWidth <= 768 ? '120px' : '24px',
            right: '1.5rem',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            border: '1px solid #064e3b',
            cursor: 'pointer',
            background: 'linear-gradient(180deg, #34d399 0%, #10b981 40%, #047857 100%)',
            boxShadow: 'inset 0 2px 2px rgba(255,255,255,0.6), inset 0 -4px 6px rgba(0,0,0,0.3), 0 8px 16px rgba(0,0,0,0.4)',
            zIndex: 9999,
            pointerEvents: 'auto',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
          }}
          onClick={(e) => {
            e.stopPropagation(); // Prevents clicks leaking into other overlays 
            setIsAIOpen(!isAIOpen);
          }}
          title="Toggle LAVC AI Copilot"
        >
          <BotMessageSquare size={32} strokeWidth={1.5} />
        </button>

        {isAIOpen && (
          <AIAssistantWidget
            arrivals={arrivals}
            containers={containers}
            farms={farms}
            weeklyRates={weeklyRates}
            samplings={samplings}
            inventoryMetrics={inventoryMetrics}
            totalBoxesToday={totalBoxesToday}
            advancedAnalytics={advancedAnalytics}
            onClose={() => setIsAIOpen(false)}
          />
        )}

        {/* Toast Notification Overlay */}
        <div className="toast-container" style={{ position: 'fixed', top: '1rem', right: '1rem', zIndex: 10001, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {toasts.map(t => (
            <div key={t.id} className={`toast toast-${t.type} animation-slide-in`} style={{
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              background: t.type === 'success' ? '#059669' : (t.type === 'error' ? '#dc2626' : '#1f2937'),
              color: 'white',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
              minWidth: '250px',
              fontSize: '0.9rem'
            }}>
              {t.message}
            </div>
          ))}
        </div>
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
