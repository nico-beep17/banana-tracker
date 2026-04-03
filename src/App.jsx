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
import { Toaster, toast } from 'sonner';
import useAppStore from './store/useAppStore';
import { useQueryClient } from '@tanstack/react-query';
import { useAppOperations } from './hooks/useAppOperations';
import {
  useFarmsQuery, useArrivalsQuery, useSamplingsQuery, useContainersQuery,
  useWeeklyRatesQuery, useConsigneesQuery, useConsigneeWeeklyRatesQuery,
  useChartOfAccountsQuery, useJournalEntriesQuery, useJournalLinesQuery,
  useMaterialsInventoryQuery, useEmployeesQuery, useDtrRecordsQuery, useAttendanceLocationsQuery
} from './queries/hooks';

// Auto-retry lazy imports: if a chunk fails to load (stale PWA cache after redeploy),
// force a hard page reload once to pick up the new filenames.
const lazyRetry = (importFn) => lazy(() =>
  importFn().catch(() => {
    // Only reload once per session to avoid infinite loops
    const hasReloaded = sessionStorage.getItem('lavc_chunk_reload');
    if (!hasReloaded) {
      sessionStorage.setItem('lavc_chunk_reload', '1');
      window.location.reload();
      return new Promise(() => {}); // never resolves — page is reloading
    }
    // If already reloaded once this session, surface the real error
    return importFn();
  })
);

// Lazy-loaded heavy modules — only downloaded when user navigates to the tab
const ArrivalForm = lazyRetry(() => import('./components/ArrivalForm'));
const ArrivalsTable = lazyRetry(() => import('./components/ArrivalsTable'));
const FarmsAndGrowers = lazyRetry(() => import('./components/FarmsAndGrowers'));
const Sampling = lazyRetry(() => import('./components/Sampling'));
const NewContainerForm = lazyRetry(() => import('./components/NewContainerForm'));
const ContainersList = lazyRetry(() => import('./components/ContainersList'));
const ContainerStuffingGrid = lazyRetry(() => import('./components/ContainerStuffingGrid'));
const Reports = lazyRetry(() => import('./components/Reports'));
const Accounting = lazyRetry(() => import('./components/Accounting'));
const Payroll = lazyRetry(() => import('./components/Payroll'));
const ShipmentTracker = lazyRetry(() => import('./components/ShipmentTracker'));
const MaterialsInventory = lazyRetry(() => import('./components/MaterialsInventory'));
const Consignees = lazyRetry(() => import('./components/Consignees'));
const ShippingDocs = lazyRetry(() => import('./components/ShippingDocs'));

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
  console.log('[App] RENDER START');
  const {
    activeTab, setActiveTab, tabState, setTabState,
    // Data vars still read directly in App.jsx (notifications, edit-container lookup, ArrivalForm props)
    arrivals, setArrivals, farms, setFarms, samplings, containers,
    // UI state
    exchangeRate, setExchangeRate,
    user, setUser, userProfile, setUserProfile, authLoading, setAuthLoading,
    isAIOpen, setIsAIOpen, lastReadNotifTime, setLastReadNotifTime
  } = useAppStore();

  const handleNotificationsOpen = () => {
    const now = Date.now();
    setLastReadNotifTime(now);
    localStorage.setItem('lavc_notif_last_read', now.toString());
  };

  const isAuth = !!user;
  useFarmsQuery(isAuth);
  useArrivalsQuery(isAuth);
  useSamplingsQuery(isAuth);
  useContainersQuery(isAuth);
  useWeeklyRatesQuery(isAuth);
  useConsigneesQuery(isAuth);
  useConsigneeWeeklyRatesQuery(isAuth);
  useChartOfAccountsQuery(isAuth);
  useJournalEntriesQuery(isAuth);
  useJournalLinesQuery(isAuth);
  useMaterialsInventoryQuery(isAuth);
  useEmployeesQuery(isAuth);
  useDtrRecordsQuery(isAuth);
  useAttendanceLocationsQuery(isAuth);

  const queryClient = useQueryClient();

  // Replaced with React Query. Exposing invalidateQueries for backward compatibility.
  const fetchData = useCallback(async () => {
    queryClient.invalidateQueries();
  }, [queryClient]);

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
        toast.info(notification.body || notification.title || 'New notification');
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

  const {
    handleNavigate,
    handleAddArrival,
    handleSaveContainer,
    handleSaveContentPayload,
    handleSealContainer,
    handleDepartContainer,
    handleUpdateTransitStatus,
    handleEditStuffedPayload,
    handleDeleteStuffedPayload,
    handleApproveArrival,
    handleDeleteArrival
  } = useAppOperations();

  // --- Derived Analytics (computed from Zustand store data) ---
  let approvedArrivals = [], todayArrivals = [], totalBoxesToday = 0, uniqueFarms = new Set();
  let totalBoxesAllTime = 0, classATotal = 0, classBTotal = 0;
  let inventoryMetrics = { total: 0, classA: 0, classB: 0, detailed: {} };
  let globalSampledBoxes = [], downgradeRate = 0, collectionRate = 100;
  let advancedAnalytics = { downgradeRate: 0, topFarms: [], collectionRate: 100 };

  try {
    console.log('[App] Computing analytics... arrivals:', arrivals?.length, 'containers:', containers?.length, 'samplings:', samplings?.length);
    approvedArrivals = (arrivals || []).filter(a => a.approval_status === 'APPROVED');

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    todayArrivals = approvedArrivals.filter(a => {
      const d = new Date(a.dateTimeArrive || a.dateTimeEncoded || 0);
      return d >= todayStart;
    });
    totalBoxesToday = todayArrivals.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
    uniqueFarms = new Set(todayArrivals.map(a => a.farmCode).filter(Boolean));

    totalBoxesAllTime = approvedArrivals.reduce((s, a) => s + (Number(a.quantity) || 0), 0);
    classATotal = approvedArrivals
      .filter(a => a.typeId && a.typeId.startsWith('classA'))
      .reduce((s, a) => s + (Number(a.quantity) || 0), 0);
    classBTotal = approvedArrivals
      .filter(a => a.typeId && a.typeId.startsWith('classB'))
      .reduce((s, a) => s + (Number(a.quantity) || 0), 0);

    // Remaining inventory = all approved boxes minus what's been stuffed into containers
    const stuffedByType = {};
    (containers || []).forEach(c => {
      (c.stuffedItems || []).forEach(payload => {
        const data = payload.data || {};
        Object.entries(data).forEach(([key, val]) => {
          if (val && typeof val === 'object') {
            // Nested format: { classA: { rha4: 100, rha5: 50 } }
            Object.entries(val).forEach(([subKey, subVal]) => {
              const typeId = `${key}.${subKey}`;
              stuffedByType[typeId] = (stuffedByType[typeId] || 0) + (Number(subVal) || 0);
            });
          } else {
            // Flat format: { 'classA.rha4': 100 }
            stuffedByType[key] = (stuffedByType[key] || 0) + (Number(val) || 0);
          }
        });
      });
    });
    const approvedByType = {};
    approvedArrivals.forEach(a => {
      if (a.typeId) {
        approvedByType[a.typeId] = (approvedByType[a.typeId] || 0) + (Number(a.quantity) || 0);
      }
    });
    const remainingInventoryDetailed = {};
    Object.keys(approvedByType).forEach(typeId => {
      remainingInventoryDetailed[typeId] = Math.max(0, (approvedByType[typeId] || 0) - (stuffedByType[typeId] || 0));
    });

    const remainingTotal = Object.values(remainingInventoryDetailed).reduce((sum, val) => sum + val, 0);
    const remainingClassA = Object.keys(remainingInventoryDetailed).filter(k => k.startsWith('classA')).reduce((sum, k) => sum + remainingInventoryDetailed[k], 0);
    const remainingClassB = Object.keys(remainingInventoryDetailed).filter(k => k.startsWith('classB')).reduce((sum, k) => sum + remainingInventoryDetailed[k], 0);

    inventoryMetrics = {
      total: remainingTotal,
      classA: remainingClassA,
      classB: remainingClassB,
      detailed: remainingInventoryDetailed
    };

    // ADVANCED ANALYTICS
    globalSampledBoxes = (samplings || []).flatMap(s => s.boxes || []);
    downgradeRate = globalSampledBoxes.length > 0
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

    const totalRev = (containers || []).reduce((s, c) => s + (Number(c.totalBoxes || 0) * (Number(c.agreed_rate) || 0)), 0);
    const collected = (containers || []).reduce((s, c) => s + (Number(c.amount_paid_partial) || 0), 0);
    collectionRate = totalRev > 0 ? (collected / totalRev) * 100 : 100;

    advancedAnalytics = { downgradeRate, topFarms: topFarmsList, collectionRate };
    console.log('[App] Analytics computed OK');
  } catch (analyticsErr) {
    console.error('[App] ANALYTICS CRASH:', analyticsErr);
  }

  const [smartNotifications, setSmartNotifications] = useState([]);

  useEffect(() => {
    const now = Date.now();
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

  console.log('[App] PRE-RENDER: authLoading=', authLoading, 'user=', !!user, 'userProfile=', !!userProfile);

  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', color: '#334155' }}>Loading Application...</div>;
  }

  if (!user) {
    return <Login />;
  }

  console.log('[App] RENDERING MAIN LAYOUT for tab:', activeTab);

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
          />
        )}

        {activeTab === 'log-arrival' && (
          <ArrivalForm
            onApproveArrival={handleApproveArrival}
            onDeleteArrival={handleDeleteArrival}
            userProfile={userProfile}
            onAddArrival={handleAddArrival}
            onNavigate={handleNavigate}
          />
        )}

        {activeTab === 'sampling' && (
          <Sampling
            onNavigate={handleNavigate}
            initialFarmCode={tabState?.farmCode}
          />
        )}

        {activeTab === 'farms' && (
          <FarmsAndGrowers />
        )}

        {activeTab === 'consignees' && (
          <Consignees />
        )}

        {activeTab === 'new-container' && (
          <NewContainerForm
            onSaveContainer={handleSaveContainer}
            onCancel={() => handleNavigate('containers-list')}
          />
        )}

        {activeTab === 'edit-container' && tabState?.containerId && (
          <NewContainerForm
            onSaveContainer={handleSaveContainer}
            initialData={containers.find(c => c.id === tabState.containerId)}
            onCancel={() => handleNavigate('containers-list')}
          />
        )}

        {activeTab === 'container-stuffing-grid' && tabState?.containerId && (
          <ContainerStuffingGrid
            containerId={tabState.containerId}
            remainingInventory={inventoryMetrics}
            onSavePayload={handleSaveContentPayload}
            onCancel={() => handleNavigate('containers-list')}
          />
        )}

        {activeTab === 'inventory' && (
          <MaterialsInventory
            userProfile={userProfile}
          />
        )}

        {activeTab === 'containers-list' && (
          <ContainersList
            onNavigate={handleNavigate}
            onDepartContainer={handleDepartContainer}
            onSealContainer={handleSealContainer}
            onEditPayload={handleEditStuffedPayload}
            onDeletePayload={handleDeleteStuffedPayload}
            userProfile={userProfile}
          />
        )}

        {activeTab === 'reports' && (
          <Reports />
        )}

        {activeTab === 'accounting' && (
          <Accounting
            userProfile={userProfile}
            exchangeRate={exchangeRate}
            setExchangeRate={setExchangeRate}
          />
        )}

        {activeTab === 'payroll' && (
          <Payroll
            initialTab={tabState?.tab}
            userProfile={userProfile}
          />
        )}

        {activeTab === 'shipment-tracker' && (
          <ShipmentTracker
            onUpdateTransitStatus={handleUpdateTransitStatus}
          />
        )}

        {activeTab === 'shipping-docs' && (
          <ShippingDocs />
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
            inventoryMetrics={inventoryMetrics}
            totalBoxesToday={totalBoxesToday}
            advancedAnalytics={advancedAnalytics}
            onClose={() => setIsAIOpen(false)}
          />
        )}

        {/* Toast Notification Overlay - Powered by Sonner */}
        <Toaster position="top-right" richColors />
        </Suspense>
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
