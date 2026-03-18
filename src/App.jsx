import React, { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Camera } from '@capacitor/camera';
import { PushNotifications } from '@capacitor/push-notifications';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ArrivalForm from './components/ArrivalForm';
import ArrivalsTable from './components/ArrivalsTable';
import FarmsAndGrowers from './components/FarmsAndGrowers';
import Sampling from './components/Sampling';
import NewContainerForm from './components/NewContainerForm';
import ContainersList from './components/ContainersList';
import ContainerStuffingGrid from './components/ContainerStuffingGrid';
import Reports from './components/Reports';
import Accounting from './components/Accounting';
import Payroll from './components/Payroll';
import Login from './components/Login';
import ShipmentTracker from './components/ShipmentTracker';
import MaterialsInventory from './components/MaterialsInventory';
import AIAssistantWidget from './components/AIAssistantWidget';
import { supabase } from './supabaseClient';
import { BotMessageSquare } from 'lucide-react';



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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [tabState, setTabState] = useState(null); // Used to pass context like pre-selected farmCode
  const [arrivals, setArrivals] = useState([]);
  const [farms, setFarms] = useState([]);
  const [samplings, setSamplings] = useState([]);
  const [containers, setContainers] = useState([]);
  const [weeklyRates, setWeeklyRates] = useState([]);

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

  // fetchData is defined outside useEffect so it can be passed to child components
  const fetchData = useCallback(async () => {
    try {
      const { data: farmsData } = await supabase.from('farms').select('*').order('lastModified', { ascending: false });
      if (farmsData) setFarms(farmsData);

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
      } catch (_) { /* table may not exist yet */ }

      try {
        const { data: dtrData, error: dtrErr } = await supabase.from('dtr_records').select('*');
        if (!dtrErr && dtrData) setDtrRecords(dtrData);
      } catch (_) { /* table may not exist yet */ }

      try {
        const { data: locData, error: locErr } = await supabase.from('attendance_locations').select('*');
        if (!locErr && locData) setAttendanceLocations(locData);
      } catch (_) { /* table may not exist yet */ }

      try {
        await supabase.from('accounting_periods').select('*');
      } catch (_) { /* table may not exist yet */ }

    } catch (err) {
      console.error('Error fetching data from Supabase:', err);
    }
  }, []);

  // Fetch initial data & handle Auth
  useEffect(() => {
    // Check for saved dev bypass session first
    const savedDevUser = localStorage.getItem('lavc_dev_bypass_user');
    if (savedDevUser) {
      try {
        const parsed = JSON.parse(savedDevUser);
        setUser(parsed);
        fetchUserProfile(parsed.id);
      } catch (_) {
        localStorage.removeItem('lavc_dev_bypass_user');
      }
    }

    // Check initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserProfile(session.user.id);
      } else if (!savedDevUser) {
        setAuthLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          fetchUserProfile(session.user.id);
        } else {
          // IMPORTANT: Only clear the user if we are NOT using a dev bypass
          // This prevents initial null session events from clearing restored dev user
          if (!localStorage.getItem('lavc_dev_bypass_user')) {
            setUser(null);
            setUserProfile(null);
            setAuthLoading(false);
          }
        }
      }
    );

    fetchData();

    // -- CAPACITOR PERMISSIONS --
    if (Capacitor.isNativePlatform()) {
      const requestPermissions = async () => {
        try {
          // Camera Permissions
          const cameraStatus = await Camera.checkPermissions();
          if (cameraStatus.camera !== 'granted') {
            await Camera.requestPermissions();
          }
        } catch (err) {
          console.warn('Camera permission request failed (non-fatal):', err);
        }

        // Push Notifications — only request permission, do NOT register
        // (FCM registration requires google-services.json to be configured first)
        try {
          let pushStatus = await PushNotifications.checkPermissions();
          if (pushStatus.receive !== 'granted') {
            await PushNotifications.requestPermissions();
          }
          // NOTE: Do NOT call PushNotifications.register() here.
          // It will crash without a valid google-services.json / FCM setup.
        } catch (err) {
          console.warn('Push notification permission request failed (non-fatal):', err);
        }
      };

      requestPermissions();
    }

    return () => subscription.unsubscribe();
  }, [fetchData]);

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
    // 1. Check for Dev Bypass Mock ID (Zero UUID)
    if (userId === '00000000-0000-0000-0000-000000000000' || userId === 'dev-bypass-id') {
      setUserProfile({
        id: userId,
        full_name: 'Developer Admin',
        role: 'Admin / Developer',
        department: 'Engineering'
      });
      setAuthLoading(false);
      return;
    }

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
        const newProfile = {
          id: userId,
          full_name: meta.full_name || meta.name || meta.email?.split('@')[0] || 'New User',
          role: meta.role || 'Hub Receiver',
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
    localStorage.removeItem('lavc_dev_bypass_user');
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
  };

  const handleNavigate = (tabInfo) => {
    if (typeof tabInfo === 'string') {
      setActiveTab(tabInfo);
      setTabState(null);
    } else {
      setActiveTab(tabInfo.name);
      setTabState(tabInfo.state || null);
    }
  };

  const handleAddArrival = async (newArrivalsBatch) => {
    const { data, error } = await supabase
      .from('arrivals')
      .insert(newArrivalsBatch)
      .select();

    if (error) {
      console.error("Supabase error (Arrivals):", error);
      alert(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}`);
      return false;
    }

    if (data) {
      setArrivals(prev => [...data, ...prev]);
      return true;
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
      plugInTime,
      plugOutTime,
      dateArrived,
      ...dbPayload
    } = containerData;

    if (isUpdate) {
      const { data, error } = await supabase
        .from('containers')
        .update(dbPayload)
        .eq('id', containerData.id)
        .select();

      if (error) {
        console.error("Supabase error (Update Container):", error);
        alert(`Failed to update container registry in database. Error: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        // Re-inject the front-end properties into local state so the UI functions seamlessly
        setContainers(prev => prev.map(c => c.id === containerData.id ? { ...data[0], timeOfDeparture, bookingNo, buyer_name, vesselVoyage, driverName, dateArrived } : c));
        handleNavigate('containers-list');
      }
    } else {
      const { data, error } = await supabase
        .from('containers')
        .insert([dbPayload])
        .select();

      if (error) {
        console.error("Supabase error (Create Container):", error);
        alert(`Failed to create container registry in database. Error: ${error.message}`);
        return;
      }

      if (data && data.length > 0) {
        // Re-inject the front-end properties into local state so the UI functions seamlessly
        setContainers(prev => [{ ...data[0], timeOfDeparture, bookingNo, buyer_name, vesselVoyage, driverName, dateArrived }, ...prev]);
        handleNavigate('containers-list');
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

  const totalBoxesToday = approvedArrivals.reduce((sum, arr) => sum + (arr.quantity || 0), 0);
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
    let query = supabase.from('arrivals').update({ approval_status: 'APPROVED', approved_by: user?.id });

    if (batchId) {
      query = query.eq('batchId', batchId);
    } else {
      query = query.eq('id', arrivalId);
    }

    const { data, error } = await query.select();

    if (error) {
      console.error("Supabase error (Approve Arrival):", error);
      alert(`Failed to approve arrival: ${error.message || 'Unknown error'}`);
      return;
    }

    if (data && data.length > 0) {
      // Create a map of updated items for faster lookup
      const updatedMap = new Map(data.map(item => [item.id, item]));
      setArrivals(prev => prev.map(a => updatedMap.has(a.id) ? updatedMap.get(a.id) : a));
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

  const [smartNotifications, setSmartNotifications] = useState([]);

  useEffect(() => {
    // Generate intelligent notifications summary based on recent global events
    const notifs = [];

    // Summary of operations
    notifs.push({
      id: 'daily-summary',
      title: 'Daily Summary',
      message: `Total boxes arrived today: ${totalBoxesToday}. Active farms: ${uniqueFarms.size}.`,
      icon: '📊',
      read: false
    });

    // Accounting & Payroll Alerts
    const unpostedPayroll = arrivals.some(a => a.approval_status === 'APPROVED' && !a.is_posted); // Mock check
    if (unpostedPayroll) {
      notifs.push({
        id: 'unposted-payroll',
        title: 'Action Required: Payroll',
        message: 'Approved arrivals ready for payroll processing.',
        icon: '💰',
        read: false
      });
    }

    // HUB ALERT: Unsealed containers
    const unsealed = containers.filter(c => !c.transit_status || c.transit_status === 'PENDING');
    if (unsealed.length > 0) {
      notifs.push({
        id: 'unsealed-summary',
        title: 'Hub Alert: Departure',
        message: `⚠️ ${unsealed.length} containers standing by for seal and dispatch.`,
        icon: '🚢',
        read: false
      });
    }

    // STRATEGIC ANALYSIS: Quality Trends
    const sampledBoxes = samplings.flatMap(s => s.boxes || []);
    if (sampledBoxes.length > 0) {
      const downgradeRate = (sampledBoxes.filter(b => b.decision === 'DOWNGRADED').length / sampledBoxes.length) * 100;
      if (downgradeRate > 15) {
        notifs.push({
          id: 'quality-analysis',
          title: 'Intelligence: Quality Dip',
          message: `Alert: Overall downgrade rate is at ${downgradeRate.toFixed(1)}%. Inspect Farm Group outputs.`,
          icon: '📉',
          read: false
        });
      } else {
        notifs.push({
          id: 'quality-analysis-good',
          title: 'Intelligence: Quality Stable',
          message: `Packing quality is optimal. Downgrade rate at ${downgradeRate.toFixed(1)}%.`,
          icon: '✨',
          read: false
        });
      }
    }

    // STRATEGIC ANALYSIS: Collection Efficiency
    const totalRev = containers.reduce((s, c) => s + (Number(c.totalBoxes || 0) * (Number(c.agreed_rate) || 0)), 0);
    const collected = containers.reduce((s, c) => s + (Number(c.amount_paid_partial) || 0), 0);
    const collectionRate = totalRev > 0 ? (collected / totalRev) * 100 : 100;

    if (collectionRate < 70) {
      notifs.push({
        id: 'finance-analysis',
        title: 'Intelligence: Cash Flow',
        message: `Collection efficiency is at ${collectionRate.toFixed(0)}%. Follow up on outstanding receivables.`,
        icon: '💸',
        read: false
      });
    }

    // Geofence Violations (if any)
    // Here we'd typically have a query for recent violations

    setSmartNotifications(notifs);
  }, [arrivals, containers, totalBoxesToday, uniqueFarms.size]);


  if (authLoading) {
    return <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Loading Application...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} />;
  }

  return (
    <ErrorBoundary>
      <Layout activeTab={activeTab} onTabChange={handleNavigate} userProfile={userProfile} onLogout={handleLogout} notifications={smartNotifications} onRefresh={fetchData}>
        {activeTab === 'dashboard' && (
          <Dashboard
            metrics={{
              totalBoxes: totalBoxesToday,
              totalTrips: arrivals.length,
              classATotal: classATotal,
              classBTotal: classBTotal,
              activeFarms: uniqueFarms.size,
              activeContainers: containers.filter(c => c.totalBoxes > 0 && !c.timeDeparted),
              remainingInventory: inventoryMetrics,
              pendingArrivalsCount: arrivals.filter(a => a.approval_status !== 'APPROVED').length,
              unsealedContainersCount: containers.filter(c => !c.transit_status || c.transit_status === 'PENDING').length,
              activeSamplingsCount: samplings.filter(s => s.status !== 'COMPLETED').length
            }}
            userProfile={userProfile}
            onNavigate={handleNavigate}
          >
            <ArrivalsTable arrivals={arrivals} onApproveArrival={handleApproveArrival} onDeleteArrival={handleDeleteArrival} setArrivals={setArrivals} userProfile={userProfile} />
          </Dashboard>
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
          />
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

        {/* Premium AI Assistant FAB Trigger */}
        <button
          className="ai-copilot-fab"
          style={{
            position: 'fixed',
            bottom: '96px',
            right: '1.5rem',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #10b981, #059669)',
            boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
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
      </Layout>
    </ErrorBoundary>
  );
}

export default App;
