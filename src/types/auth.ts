// ============================================================
// TIPOS DE USUÁRIO
// ============================================================

export type TipoUsuario = 'CLIENTE' | 'MOTORISTA' | 'ADMIN';

// ============================================================
// VEÍCULO
// ============================================================

export interface Veiculo {
  id: string;
  placa: string;
  cor: string | null;
  ano: number | null;
  capacidade: number;
  marca_id: string;
  marca: string;
  modelo_id: string;
  modelo: string;
  categoria_id: string;
  categoria: string;
}


// ============================================================
// MOTORISTA
// ============================================================

export interface Motorista {
  id: string;
  cnh: string;
  status: string;
  online: boolean;
  veiculo: Veiculo | null;
}

// ============================================================
// USUÁRIO
// ============================================================

export interface Usuario {
  id: string;
  name: string;
  email: string;
  telefone: string;
  tipo: TipoUsuario;
  motorista?: Motorista | null;
}

// ============================================================
// RESPOSTA DO LOGIN
// ============================================================

export interface LoginResponse extends Usuario {
  token: string;

  refreshToken: string;
}

// ============================================================
// DADOS PARA LOGIN
// ============================================================

export interface LoginData {
  email: string;
  password: string;
}

// ============================================================
// DADOS DO VEÍCULO NO CADASTRO
// ============================================================

export interface CadastroVeiculoData {
  marca_id: string;
  modelo_id: string;
  categoria_id: string;
  placa: string;
  cor?: string;
  ano?: number;
}

// ============================================================
// DADOS DO CADASTRO
// ============================================================

export interface CadastroData {
  nome: string;
  email: string;
  telefone: string;
  password: string;
  tipo: TipoUsuario;
  cnh?: string;
  veiculo?: CadastroVeiculoData;
}