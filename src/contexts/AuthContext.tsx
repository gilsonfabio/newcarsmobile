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

  // ==========================================================
  // CARREGAR SESSÃO SALVA
  // ==========================================================

  async function carregarSessao() {
    try {

      const tokenSalvo =
        await SecureStore.getItemAsync('token');

      const usuarioSalvo =
        await SecureStore.getItemAsync('usuario');

      if (tokenSalvo && usuarioSalvo) {

        const usuarioParseado: Usuario =
          JSON.parse(usuarioSalvo);

        setToken(tokenSalvo);

        setUsuario(usuarioParseado);

        api.defaults.headers.common.Authorization =
          `Bearer ${tokenSalvo}`;
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

  // ==========================================================
  // LOGIN
  // ==========================================================

  async function login(data: LoginData) {

    try {

      const response =
        await api.post<LoginResponse>(
          '/signIn',
          data
        );

      const dados = response.data;

      console.log('=================================');
      console.log('LOGIN REALIZADO');
      console.log('Usuário:', dados.name);
      console.log('Tipo:', dados.tipo);
      console.log('Motorista:', dados.motorista);
      console.log('=================================');

      // ------------------------------------------------------
      // SALVA TOKEN
      // ------------------------------------------------------

      await SecureStore.setItemAsync(
        'token',
        dados.token
      );

      // ------------------------------------------------------
      // SALVA REFRESH TOKEN
      // ------------------------------------------------------

      await SecureStore.setItemAsync(
        'refreshToken',
        dados.refreshToken
      );

      // ------------------------------------------------------
      // MONTA USUÁRIO COMPLETO
      // ------------------------------------------------------
      //
      // IMPORTANTE:
      // Agora mantemos motorista e veículo.
      //

      const usuarioCompleto: Usuario = {
        id: dados.id,
        name: dados.name,
        email: dados.email,
        telefone: dados.telefone,
        tipo: dados.tipo,
        motorista: dados.motorista ?? null,
      };

      // ------------------------------------------------------
      // SALVA USUÁRIO
      // ------------------------------------------------------

      await SecureStore.setItemAsync(
        'usuario',
        JSON.stringify(usuarioCompleto)
      );

      // ------------------------------------------------------
      // CONFIGURA TOKEN NO AXIOS
      // ------------------------------------------------------

      api.defaults.headers.common.Authorization =
        `Bearer ${dados.token}`;

      // ------------------------------------------------------
      // ATUALIZA ESTADO
      // ------------------------------------------------------

      setToken(dados.token);

      setUsuario(usuarioCompleto);

    } catch (error) {

      console.error(
        'Erro ao realizar login:',
        error
      );

      throw error;
    }
  }

  // ==========================================================
  // CADASTRO
  // ==========================================================

  async function cadastro(
    data: CadastroData
  ) {

    try {

      await api.post(
        '/signUp',
        data
      );

    } catch (error) {

      console.error(
        'Erro ao realizar cadastro:',
        error
      );

      throw error;
    }
  }

  // ==========================================================
  // LOGOUT
  // ==========================================================

  async function logout() {

    try {

      await SecureStore.deleteItemAsync(
        'token'
      );

      await SecureStore.deleteItemAsync(
        'refreshToken'
      );

      await SecureStore.deleteItemAsync(
        'usuario'
      );

      delete api.defaults.headers.common.Authorization;

      setToken(null);

      setUsuario(null);

    } catch (error) {

      console.error(
        'Erro ao realizar logout:',
        error
      );

      throw error;
    }
  }

  // ==========================================================
  // PROVIDER
  // ==========================================================

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

// ============================================================
// HOOK
// ============================================================

export function useAuth() {
  return useContext(AuthContext);
}