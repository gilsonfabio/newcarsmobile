import { api } from './api';

export async function testarApi() {
  try {
    const response = await api.get('/health');

    console.log('================================');
    console.log('API:', response.data);
    console.log('================================');

    return response.data;
  } catch (error) {
    console.error('================================');
    console.error('ERRO AO CONECTAR COM A API');
    console.error(error);
    console.error('================================');

    throw error;
  }
}