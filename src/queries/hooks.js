import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabaseClient';
import useAppStore from '../store/useAppStore';
import { toast } from 'sonner';

/**
 * Generic query factory that builds a useQuery hook, fetches from Supabase,
 * and sets the result into the corresponding Zustand store field.
 */
function createSyncQuery(queryKey, tableName, zustandSetterName, queryConfig = {}) {
    return (isEnabled = true) => {
        const setter = useAppStore(state => state[zustandSetterName]);
        return useQuery({
            queryKey: [queryKey],
            queryFn: async () => {
                let request = supabase.from(tableName).select('*');
                if (queryConfig.orderBy) {
                    request = request.order(queryConfig.orderBy.column, { ascending: queryConfig.orderBy.ascending });
                }
                const { data, error } = await request;
                if (error) throw error;
                setter(data || []);
                return data;
            },
            enabled: isEnabled,
            ...queryConfig.queryOptions
        });
    };
}

// ----------------------------------------------------
// Core Entities
// ----------------------------------------------------
export const useFarmsQuery = createSyncQuery('farms', 'farms', 'setFarms');
export const useArrivalsQuery = createSyncQuery('arrivals', 'arrivals', 'setArrivals', { orderBy: { column: 'dateTimeEncoded', ascending: false } });
export const useSamplingsQuery = createSyncQuery('samplings', 'samplings', 'setSamplings', { orderBy: { column: 'encodedAt', ascending: false } });
export const useContainersQuery = createSyncQuery('containers', 'containers', 'setContainers', { orderBy: { column: 'dateCreated', ascending: false } });
export const useWeeklyRatesQuery = createSyncQuery('weekly_rates', 'weekly_rates', 'setWeeklyRates', { orderBy: { column: 'created_at', ascending: false } });

// ----------------------------------------------------
// Consignees (Buyers)
// ----------------------------------------------------
export const useConsigneesQuery = createSyncQuery('consignees', 'consignees', 'setConsignees', { orderBy: { column: 'last_modified', ascending: false } });
export const useConsigneeWeeklyRatesQuery = createSyncQuery('consignee_weekly_rates', 'consignee_weekly_rates', 'setConsigneeWeeklyRates', { orderBy: { column: 'created_at', ascending: false } });

// ----------------------------------------------------
// Accounting & Finance
// ----------------------------------------------------
export const useChartOfAccountsQuery = createSyncQuery('chart_of_accounts', 'chart_of_accounts', 'setChartOfAccounts', { orderBy: { column: 'code', ascending: true } });
export const useJournalEntriesQuery = createSyncQuery('journal_entries', 'journal_entries', 'setJournalEntries', { orderBy: { column: 'date_posted', ascending: false } });
export const useJournalLinesQuery = createSyncQuery('journal_lines', 'journal_lines', 'setJournalLines');

// ----------------------------------------------------
// Inventory
// ----------------------------------------------------
export const useMaterialsInventoryQuery = createSyncQuery('materials_inventory', 'materials_inventory', 'setInventoryItems', { orderBy: { column: 'item_code', ascending: true } });

// ----------------------------------------------------
// HR & Payroll (Fail gracefully if tables do not exist)
// ----------------------------------------------------
export const useEmployeesQuery = (isEnabled = true) => {
    const setEmployees = useAppStore(state => state.setEmployees);
    return useQuery({
        queryKey: ['employees'],
        queryFn: async () => {
            const { data, error } = await supabase.from('employees').select('*').order('last_name', { ascending: true });
            if (error && error.code !== '42P01') throw error; // Ignore undefined table
            const finalData = data || [];
            if (!error) setEmployees(finalData);
            return finalData;
        },
        enabled: isEnabled
    });
};

export const useDtrRecordsQuery = (isEnabled = true) => {
    const setDtrRecords = useAppStore(state => state.setDtrRecords);
    return useQuery({
        queryKey: ['dtr_records'],
        queryFn: async () => {
            const { data, error } = await supabase.from('dtr_records').select('*');
            if (error && error.code !== '42P01') throw error;
            const finalData = data || [];
            if (!error) setDtrRecords(finalData);
            return finalData;
        },
        enabled: isEnabled
    });
};

export const useAttendanceLocationsQuery = (isEnabled = true) => {
    const setAttendanceLocations = useAppStore(state => state.setAttendanceLocations);
    return useQuery({
        queryKey: ['attendance_locations'],
        queryFn: async () => {
            const { data, error } = await supabase.from('attendance_locations').select('*');
            if (error && error.code !== '42P01') throw error;
            const finalData = data || [];
            if (!error) setAttendanceLocations(finalData);
            return finalData;
        },
        enabled: isEnabled
    });
};
