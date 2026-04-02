import { supabase } from '../supabaseClient';
import { offlineSync } from '../utils/offlineSync';
import { toast } from 'sonner';
import { logAudit } from '../utils/auditLog';
import useAppStore from '../store/useAppStore';

export function useAppOperations() {
  const {
    activeTab, setActiveTab, tabState, setTabState,
    arrivals, setArrivals, farms, setFarms, samplings, setSamplings,
    containers, setContainers, weeklyRates, setWeeklyRates,
    consignees, setConsignees, consigneeWeeklyRates, setConsigneeWeeklyRates,
    chartOfAccounts, setChartOfAccounts, journalEntries, setJournalEntries,
    journalLines, setJournalLines, inventoryItems, setInventoryItems,
    exchangeRate, setExchangeRate, employees, setEmployees,
    dtrRecords, setDtrRecords, attendanceLocations, setAttendanceLocations,
    user, setUser, userProfile, setUserProfile, authLoading, setAuthLoading,
    isAIOpen, setIsAIOpen, lastReadNotifTime, setLastReadNotifTime
  } = useAppStore();

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
          toast.info('📱 Offline Mode: Arrival logged securely and queued for background syncing when internet returns.');
          return true;
        } else if (data) {
          setArrivals(prev => [...data, ...prev]);
          return true;
        }
      }
    } catch (error) {
      console.error("Offline Sync error (Arrivals):", error);
      toast.error(`⚠️ Database Insert Failed: ${error.message || error.details || 'Unknown constraint error.'}`);
      return false;
    }
  };

  const handleSaveContainer = async (containerData) => {
    const isUpdate = containerData.id && containers.some(c => c.id === containerData.id);

    // Omit columns that are purely front-end display properties or remapped
    const {
      vesselVoyage,
      driverName,
      plugInTime: _plugInTime,
      plugOutTime: _plugOutTime,
      ...dbPayload
    } = containerData;

    if (isUpdate) {
      try {
        const { success, data, queued } = await offlineSync.mutate('update', 'containers', dbPayload, { id: containerData.id });
        if (success) {
          const updatedContainer = { ...dbPayload, ...(data ? data[0] : {}), vesselVoyage, driverName };
          setContainers(prev => prev.map(c => c.id === containerData.id ? { ...c, ...updatedContainer } : c));
          if (queued) toast.info('📱 Offline Mode: Container modifications saved safely locally.');
          handleNavigate('containers-list');
        }
      } catch (error) {
        console.error("Supabase error (Update Container):", error);
        toast.error(`Failed to update container registry in database. Error: ${error.message}`);
      }
    } else {
      try {
        const { success, data, queued } = await offlineSync.mutate('insert', 'containers', dbPayload);
        if (success) {
          const newContainer = { ...dbPayload, ...(data ? data[0] : {}), vesselVoyage, driverName };
          setContainers(prev => [newContainer, ...prev]);
          if (queued) toast.info('📱 Offline Mode: New Container correctly registered locally.');
          handleNavigate('containers-list');
        }
      } catch (error) {
        console.error("Supabase error (Create Container):", error);
        toast.error(`Failed to create container registry in database. Error: ${error.message}`);
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
      toast.error("Failed to save stuffing payload data.");
      return;
    }

    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
      handleNavigate('containers-list');
    }
  };

  const handleSealContainer = async (containerId) => {
    const timeSealed = new Date().toISOString();

    const { data, error } = await supabase
      .from('containers')
      .update({ transit_status: 'SEALED' })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error("Supabase error (Seal Container):", error);
      toast.error("Failed to seal container.");
      return;
    }

    if (data && data[0]) {
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
      toast.error("Failed to run departure dispatch command.");
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
      toast.error("Failed to update transit status.");
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
    if (!oldPayload) { toast.error('Payload not found.'); return; }

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
      toast.error(`Failed to update payload: ${error.message}`);
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
    if (!oldPayload) { toast.error('Payload not found.'); return; }

    if (!window.confirm(`Delete payload ${payloadId} (${oldPayload.total} boxes)? This cannot be undone.`)) return;

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

    const updatedItems = targetContainer.stuffedItems.filter(p => p.id !== payloadId);
    const newTotalBoxes = updatedItems.reduce((sum, p) => sum + (p.total || 0), 0);

    const { data, error } = await supabase
      .from('containers')
      .update({ stuffedItems: updatedItems, totalBoxes: newTotalBoxes })
      .eq('id', containerId)
      .select();

    if (error) {
      console.error('Supabase error (Delete Payload):', error);
      toast.error(`Failed to delete payload: ${error.message}`);
      return;
    }
    if (data && data[0]) {
      setContainers(prev => prev.map(c => c.id === containerId ? data[0] : c));
    }
  };

  const handleApproveArrival = async (arrivalId, batchId) => {
    let fetchQuery = supabase.from('arrivals').select('*');
    if (batchId) fetchQuery = fetchQuery.eq('batchId', batchId);
    else fetchQuery = fetchQuery.eq('id', arrivalId);
    const { data: rowsToApprove, error: fetchErr } = await fetchQuery;
    if (fetchErr || !rowsToApprove?.length) {
      toast.error(`Failed to fetch arrival rows: ${fetchErr?.message || 'Unknown error'}`);
      return;
    }

    const getWeekNum = (dateStr) => {
      const d = new Date(dateStr); const s = new Date(d.getFullYear(), 0, 1);
      return { week: Math.ceil((d.getDay() + 1 + Math.floor((d - s) / 86400000)) / 7), year: d.getFullYear() };
    };

    const TYPE_TO_RATE_KEY = {
      'classA.rha4': 'classA.rha4', 'classA.rha5': 'classA.rha5', 'classA.rha6': 'classA.rha6',
      'classA.sha7': 'classA.sha7', 'classA.sha8': 'classA.sha8', 'classA.sha9': 'classA.sha9',
      'classA.cla':  'classA.cla',
      'classB.rhb4': 'classB.rhb4', 'classB.rhb5': 'classB.rhb5', 'classB.rhb6': 'classB.rhb6',
      'classB.shb7': 'classB.shb7', 'classB.shb8': 'classB.shb8', 'classB.shb9': 'classB.shb9',
      'classB.clb':  'classB.clb',  'classB.fp':   'classB.fp',
    };

    const rowUpdates = rowsToApprove.map(row => {
      const packDate = row.dateOfPacking || row.dateTimeArrive;
      const { week, year } = packDate ? getWeekNum(packDate) : { week: null, year: null };

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

    const { data, error } = await supabase
      .from('arrivals')
      .upsert(rowUpdates, { onConflict: 'id' })
      .select();

    if (error) {
      console.error("Supabase error (Approve Arrival):", error);
      toast.error(`Failed to approve arrival: ${error.message || 'Unknown error'}`);
      return;
    }

    if (data && data.length > 0) {
      const updatedMap = new Map(data.map(item => [item.id, item]));
      setArrivals(prev => prev.map(a => updatedMap.has(a.id) ? updatedMap.get(a.id) : a));
      logAudit('APPROVE_ARRIVAL', 'arrival', batchId || arrivalId, { count: data.length });

      const totalGross = data.reduce((s, r) => s + (Number(r.quantity || 0) * Number(r.locked_rate || 0)), 0);
      if (totalGross > 0) {
        toast.success(`✅ Batch approved — ₱${totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })} locked`);
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
      toast.error(`Failed to delete arrival: ${error.message}`);
      return;
    }

    if (batchId) {
      setArrivals(prev => prev.filter(a => a.batchId !== batchId));
    } else {
      setArrivals(prev => prev.filter(a => a.id !== arrivalId));
    }
    logAudit('DELETE_ARRIVAL', 'arrival', batchId || arrivalId);
  };

  return {
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
  };
}
