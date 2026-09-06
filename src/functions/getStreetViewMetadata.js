import { base44 } from '@/api/base44Client';

export const getStreetViewMetadata = async (data) =>
  (await base44.functions.invoke('getStreetViewMetadata', data)).data;
