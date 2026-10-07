import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import * as SecureStore from 'expo-secure-store';

import { api } from '../services/api';

import {
  CadastroData,
  LoginData,
  LoginResponse,
  Usuario,
} from '../types/auth';

interface AuthContextData {
  usuario: Usuario | null;
  token: string | null;
  carregando: boolean;

  login: (data: LoginData) => Promise<void>;

  cadastro: (data: CadastroData) => Promise<void>;

  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>(
  {} as AuthContextData
);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({
  children,
}: AuthProviderProps) {

  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const [token, setToken] = useState<string | null>(null);

  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    carregarSessao();
  }, []);

  async function carregarSessao() {
    try {

      const tokenSalvo =
        await SecureStore.getItemAsync('token');

      const usuarioSalvo =
        await SecureStore.getItemAsync('usuario');

      if (tokenSalvo && usuarioSalvo) {

        const usuario = JSON.parse(
          usuarioSalvo
        );

        setToken(tokenSalvo);

        setUsuario(usuario);

        api.defaults.headers.common.Authorization = `Bearer ${tokenSalvo}`;
      }

    } catch (error) {

      console.error(
        'Erro ao carregar sessão:',
        error
      );

    } finally {

      setCarregando(false);
    }
  }

  async function login(data: LoginData) {

    const response = await api.post<LoginResponse>(
      '/signIn',
      data
    );

    const dados = response.data;

    await SecureStore.setItemAsync(
      'token',
      dados.token
    );

    await SecureStore.setItemAsync(
      'refreshToken',
      dados.refreshToken
    );

    await SecureStore.setItemAsync(
      'usuario',
      JSON.stringify({
        id: dados.id,
        name: dados.name,
        email: dados.email,
        telefone: dados.telefone,
        tipo: dados.tipo,
      })
    );

    api.defaults.headers.common.Authorization =
      `Bearer ${dados.token}`;

    setToken(dados.token);

    setUsuario({
      id: dados.id,
      name: dados.name,
      email: dados.email,
      telefone: dados.telefone,
      tipo: dados.tipo,
    });
  }

  async function cadastro(
    data: CadastroData
  ) {

    await api.post(
      '/signUp',
      data
    );
  }

  async function logout() {

    await SecureStore.deleteItemAsync('token');

    await SecureStore.deleteItemAsync(
      'refreshToken'
    );

    await SecureStore.deleteItemAsync(
      'usuario'
    );

    delete api.defaults.headers.common.Authorization;

    setToken(null);

    setUsuario(null);
  }

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        carregando,
        login,
        cadastro,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}