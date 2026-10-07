export type TipoUsuario = 'CLIENTE' | 'MOTORISTA';

export interface Usuario {
  id: string;
  name: string;
  email: string;
  telefone: string;
  tipo: TipoUsuario;
}

export interface LoginResponse extends Usuario {
  token: string;
  refreshToken: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface CadastroData {
  nome: string;
  email: string;
  telefone: string;
  password: string;
  tipo: TipoUsuario;
  cnh?: string;
}