import { create } from 'zustand';

const useAppStore = create((set) => ({
    // Tab State
    activeTab: localStorage.getItem('lavc_active_tab') || 'dashboard',
    setActiveTab: (tab) => {
        const nonRestorableTabs = ['new-container', 'edit-container', 'container-stuffing-grid'];
        if (!nonRestorableTabs.includes(tab)) {
            localStorage.setItem('lavc_active_tab', tab);
        }
        set({ activeTab: tab });
    },
    tabState: null,
    setTabState: (state) => set({ tabState: state }),

    // Auth & User State
    user: null,
    setUser: (user) => set({ user }),
    userProfile: null,
    setUserProfile: (profile) => set({ userProfile: profile }),
    authLoading: true,
    setAuthLoading: (loading) => set({ authLoading: loading }),

    // Core Data State
    farms: [],
    setFarms: (farms) => set({ farms }),
    arrivals: [],
    setArrivals: (arrivals) => set({ arrivals }),
    samplings: [],
    setSamplings: (samplings) => set({ samplings }),
    containers: [],
    setContainers: (containers) => set({ containers }),
    weeklyRates: [],
    setWeeklyRates: (weeklyRates) => set({ weeklyRates }),

    // Consignee State
    consignees: [],
    setConsignees: (consignees) => set({ consignees }),
    consigneeWeeklyRates: [],
    setConsigneeWeeklyRates: (rates) => set({ consigneeWeeklyRates: rates }),

    // Accounting State
    chartOfAccounts: [],
    setChartOfAccounts: (chartOfAccounts) => set({ chartOfAccounts }),
    journalEntries: [],
    setJournalEntries: (journalEntries) => set({ journalEntries }),
    journalLines: [],
    setJournalLines: (journalLines) => set({ journalLines }),

    // Inventory State
    inventoryItems: [],
    setInventoryItems: (inventoryItems) => set({ inventoryItems }),

    // Global Settings
    exchangeRate: import.meta.env.VITE_EXCHANGE_RATE ? parseFloat(import.meta.env.VITE_EXCHANGE_RATE) : 56.50,
    setExchangeRate: (rate) => set({ exchangeRate: rate }),

    // HR/Payroll State
    employees: [],
    setEmployees: (employees) => set({ employees }),
    dtrRecords: [],
    setDtrRecords: (dtrRecords) => set({ dtrRecords }),
    attendanceLocations: [],
    setAttendanceLocations: (locations) => set({ attendanceLocations: locations }),

    // UI/Utility State
    isAIOpen: false,
    setIsAIOpen: (isOpen) => set({ isAIOpen: isOpen }),
    lastReadNotifTime: parseInt(localStorage.getItem('lavc_notif_last_read') || '0', 10),
    setLastReadNotifTime: (time) => set({ lastReadNotifTime: time }),
}));

export default useAppStore;
