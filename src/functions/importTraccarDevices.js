import { base44 } from '@/api/base44Client';
export const importTraccarDevices = async (data = {}) => (await base44.functions.invoke('importTraccarDevices', data)).data;
