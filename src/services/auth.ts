import { api } from './api';

import {
    CadastroData,
    LoginData,
    LoginResponse,
} from '../types/auth';

export async function signIn(
  data: LoginData
): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>(
    '/signIn',
    data
  );

  return response.data;
}

export async function signUp(
  data: CadastroData
) {
  const response = await api.post(
    '/signUp',
    data
  );

  return response.data;
}