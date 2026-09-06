import { base44 } from '@/api/base44Client';
export const getWeatherData = async (data = {}) => {
  const result = await base44.functions.invoke('getWeatherData', data);
  // Conservamos la forma de respuesta que utilizaba la interfaz original.
  return { data: result.data };
};
