import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const api = axios.create({
  baseURL: 'http://10.111.135.208:3333',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync('token');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    console.log('API:', config.method?.toUpperCase(), config.url);
    console.log(
      'Authorization:',
      token ? 'Bearer TOKEN_EXISTE' : 'SEM TOKEN'
    );

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);