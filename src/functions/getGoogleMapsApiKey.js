import { base44 } from '@/api/base44Client';
export const getGoogleMapsApiKey = async (data = {}) => (await base44.functions.invoke('getGoogleMapsApiKey', data)).data;
