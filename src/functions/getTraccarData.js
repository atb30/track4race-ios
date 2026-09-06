import { base44 } from '@/api/base44Client';
export const getTraccarData = async (data = {}) => (await base44.functions.invoke('getTraccarData', data)).data;
