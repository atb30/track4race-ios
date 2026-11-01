import { base44 } from '@/api/base44Client';

export const registerTraccarDevice = async (data = {}) =>
  (await base44.functions.invoke('registerTraccarDevice', data)).data;
