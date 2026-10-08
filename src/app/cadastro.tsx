import React, { useEffect, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

import type {
  CadastroData,
  TipoUsuario,
} from '../types/auth';

interface Marca {
  idMarca: string;
  nome: string;
}

interface Modelo {
  idModelo: string;
  nome: string;
}

interface Categoria {
  id: string;
  nome: string;
  descricao?: string | null;
  capacidade_passageiros: number;
}

type TipoSelecao = 'MARCA' | 'MODELO' | 'CATEGORIA' | null;

export default function Cadastro() {
  const { cadastro } = useAuth();

  // ==========================================================
  // DADOS DO USUÁRIO
  // ==========================================================

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');

  const [tipo, setTipo] = useState<TipoUsuario>('CLIENTE');

  const [cnh, setCnh] = useState('');

  // ==========================================================
  // DADOS DO VEÍCULO
  // ==========================================================

  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [marcaId, setMarcaId] = useState('');
  const [modeloId, setModeloId] = useState('');
  const [categoriaId, setCategoriaId] = useState('');

  const [placa, setPlaca] = useState('');
  const [cor, setCor] = useState('');
  const [ano, setAno] = useState('');

  // ==========================================================
  // CONTROLES
  // ==========================================================

  const [carregando, setCarregando] = useState(false);
  const [carregandoDadosVeiculo, setCarregandoDadosVeiculo] =
    useState(false);
  const [carregandoModelos, setCarregandoModelos] =
    useState(false);

  const [modalSelecao, setModalSelecao] =
    useState<TipoSelecao>(null);

  // ==========================================================
  // CARREGAR MARCAS E CATEGORIAS
  // ==========================================================

  useEffect(() => {
    if (tipo === 'MOTORISTA') {
      carregarDadosVeiculo();
    } else {
      limparDadosVeiculo();
    }
  }, [tipo]);

  async function carregarDadosVeiculo() {
    try {
      setCarregandoDadosVeiculo(true);

      const [marcasResponse, categoriasResponse] =
        await Promise.all([
          api.get('/marcas'),
          api.get('/categorias'),
        ]);

      setMarcas(marcasResponse.data);
      setCategorias(categoriasResponse.data);

    } catch (error) {
      console.error(
        'Erro ao carregar dados do veículo:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível carregar as marcas e categorias dos veículos.'
      );
    } finally {
      setCarregandoDadosVeiculo(false);
    }
  }

  // ==========================================================
  // CARREGAR MODELOS DA MARCA
  // ==========================================================

  useEffect(() => {
    if (!marcaId) {
      setModelos([]);
      setModeloId('');
      return;
    }

    carregarModelos();
  }, [marcaId]);

  async function carregarModelos() {
    try {
      setCarregandoModelos(true);

      setModeloId('');

      const response = await api.get(
        `/modelos/marca/${marcaId}`
      );

      setModelos(response.data);

    } catch (error) {
      console.error(
        'Erro ao carregar modelos:',
        error
      );

      setModelos([]);

      Alert.alert(
        'Erro',
        'Não foi possível carregar os modelos desta marca.'
      );
    } finally {
      setCarregandoModelos(false);
    }
  }

  // ==========================================================
  // LIMPAR DADOS DO VEÍCULO
  // ==========================================================

  function limparDadosVeiculo() {
    setMarcas([]);
    setModelos([]);
    setCategorias([]);

    setMarcaId('');
    setModeloId('');
    setCategoriaId('');

    setPlaca('');
    setCor('');
    setAno('');
    setCnh('');
  }

  // ==========================================================
  // BUSCAR NOME DOS ITENS SELECIONADOS
  // ==========================================================

  function getMarcaNome() {
    const marca = marcas.find(
      item => item.idMarca === marcaId
    );

    return marca?.nome || 'Selecione a marca';
  }

  function getModeloNome() {
    const modelo = modelos.find(
      item => item.idModelo === modeloId
    );

    return modelo?.nome || 'Selecione o modelo';
  }

  function getCategoriaNome() {
    const categoria = categorias.find(
      item => item.id === categoriaId
    );

    if (!categoria) {
      return 'Selecione a categoria';
    }

    return `${categoria.nome} • ${categoria.capacidade_passageiros} passageiros`;
  }

  // ==========================================================
  // SELEÇÃO
  // ==========================================================

  function selecionarMarca(id: string) {
    setMarcaId(id);
    setModalSelecao(null);
  }

  function selecionarModelo(id: string) {
    setModeloId(id);
    setModalSelecao(null);
  }

  function selecionarCategoria(id: string) {
    setCategoriaId(id);
    setModalSelecao(null);
  }

  // ==========================================================
  // VALIDAÇÃO E CADASTRO
  // ==========================================================

  async function handleCadastro() {
    if (!nome.trim()) {
      Alert.alert('Atenção', 'Informe seu nome.');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Atenção', 'Informe seu email.');
      return;
    }

    if (!telefone.trim()) {
      Alert.alert('Atenção', 'Informe seu telefone.');
      return;
    }

    if (!password) {
      Alert.alert('Atenção', 'Informe uma senha.');
      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Atenção',
        'A senha deve possuir pelo menos 6 caracteres.'
      );
      return;
    }

    if (password !== confirmarPassword) {
      Alert.alert(
        'Atenção',
        'As senhas não conferem.'
      );
      return;
    }

    // ========================================================
    // VALIDAÇÕES DO MOTORISTA
    // ========================================================

    if (tipo === 'MOTORISTA') {
      if (!cnh.trim()) {
        Alert.alert(
          'Atenção',
          'Informe o número da CNH.'
        );
        return;
      }

      if (!marcaId) {
        Alert.alert(
          'Atenção',
          'Selecione a marca do veículo.'
        );
        return;
      }

      if (!modeloId) {
        Alert.alert(
          'Atenção',
          'Selecione o modelo do veículo.'
        );
        return;
      }

      if (!categoriaId) {
        Alert.alert(
          'Atenção',
          'Selecione a categoria do veículo.'
        );
        return;
      }

      if (!placa.trim()) {
        Alert.alert(
          'Atenção',
          'Informe a placa do veículo.'
        );
        return;
      }

      if (ano.trim()) {
        const anoNumerico = Number(ano);
        const anoAtual = new Date().getFullYear();

        if (
          Number.isNaN(anoNumerico) ||
          anoNumerico < 1950 ||
          anoNumerico > anoAtual + 1
        ) {
          Alert.alert(
            'Atenção',
            'Informe um ano de veículo válido.'
          );
          return;
        }
      }
    }

    try {
      setCarregando(true);

      const dados: CadastroData = {
        nome: nome.trim(),
        email: email.trim(),
        telefone: telefone.trim(),
        password,
        tipo,
      };

      // ========================================================
      // DADOS DO MOTORISTA
      // ========================================================

      if (tipo === 'MOTORISTA') {
        dados.cnh = cnh.trim();

        dados.veiculo = {
          marca_id: marcaId,
          modelo_id: modeloId,
          categoria_id: categoriaId,
          placa: placa.trim().toUpperCase(),
          cor: cor.trim() || undefined,
          ano: ano.trim()
            ? Number(ano)
            : undefined,
        };
      }

      console.log(
        'DADOS DO CADASTRO:',
        dados
      );

      await cadastro(dados);

      Alert.alert(
        'Cadastro realizado',
        tipo === 'MOTORISTA'
          ? 'Seu cadastro foi realizado. O veículo e os dados da CNH serão analisados antes da liberação para corridas.'
          : 'Seu cadastro foi realizado com sucesso.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );

    } catch (error: any) {
      console.error(
        'Erro ao realizar cadastro:',
        error
      );

      const mensagem =
        error?.response?.data?.error ||
        'Não foi possível realizar o cadastro.';

      Alert.alert(
        'Erro no cadastro',
        mensagem
      );

    } finally {
      setCarregando(false);
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === 'ios'
          ? 'padding'
          : undefined
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        <View style={styles.header}>
          <Text style={styles.title}>
            Criar conta
          </Text>

          <Text style={styles.subtitle}>
            Cadastre-se para utilizar o Mobilidade
          </Text>
        </View>

        {/* ================================================== */}
        {/* TIPO DE USUÁRIO */}
        {/* ================================================== */}

        <Text style={styles.sectionTitle}>
          Tipo de conta
        </Text>

        <View style={styles.tipoContainer}>

          <TouchableOpacity
            style={[
              styles.tipoButton,
              tipo === 'CLIENTE' &&
                styles.tipoButtonAtivo,
            ]}
            onPress={() =>
              setTipo('CLIENTE')
            }
            disabled={carregando}
          >
            <Text
              style={[
                styles.tipoText,
                tipo === 'CLIENTE' &&
                  styles.tipoTextAtivo,
              ]}
            >
              Cliente
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tipoButton,
              tipo === 'MOTORISTA' &&
                styles.tipoButtonAtivo,
            ]}
            onPress={() =>
              setTipo('MOTORISTA')
            }
            disabled={carregando}
          >
            <Text
              style={[
                styles.tipoText,
                tipo === 'MOTORISTA' &&
                  styles.tipoTextAtivo,
              ]}
            >
              Motorista
            </Text>
          </TouchableOpacity>

        </View>

        {/* ================================================== */}
        {/* DADOS PESSOAIS */}
        {/* ================================================== */}

        <Text style={styles.sectionTitle}>
          Dados pessoais
        </Text>

        <Text style={styles.label}>
          Nome completo
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite seu nome"
          placeholderTextColor="#999"
          value={nome}
          onChangeText={setNome}
          editable={!carregando}
        />

        <Text style={styles.label}>
          Email
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite seu email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!carregando}
        />

        <Text style={styles.label}>
          Telefone
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite seu telefone"
          placeholderTextColor="#999"
          value={telefone}
          onChangeText={setTelefone}
          keyboardType="phone-pad"
          editable={!carregando}
        />

        {/* ================================================== */}
        {/* MOTORISTA */}
        {/* ================================================== */}

        {tipo === 'MOTORISTA' && (
          <>
            <Text style={styles.sectionTitle}>
              Dados do motorista
            </Text>

            <Text style={styles.label}>
              CNH
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Número da CNH"
              placeholderTextColor="#999"
              value={cnh}
              onChangeText={setCnh}
              keyboardType="numeric"
              editable={!carregando}
            />

            {/* ============================================== */}
            {/* VEÍCULO */}
            {/* ============================================== */}

            <Text style={styles.sectionTitle}>
              Veículo
            </Text>

            {carregandoDadosVeiculo ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" />

                <Text style={styles.loadingText}>
                  Carregando informações dos veículos...
                </Text>
              </View>
            ) : (
              <>
                {/* MARCA */}

                <Text style={styles.label}>
                  Marca
                </Text>

                <TouchableOpacity
                  style={styles.select}
                  onPress={() =>
                    setModalSelecao('MARCA')
                  }
                  disabled={carregando}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !marcaId &&
                        styles.placeholder,
                    ]}
                  >
                    {getMarcaNome()}
                  </Text>

                  <Text style={styles.arrow}>
                    ▼
                  </Text>
                </TouchableOpacity>

                {/* MODELO */}

                <Text style={styles.label}>
                  Modelo
                </Text>

                <TouchableOpacity
                  style={[
                    styles.select,
                    !marcaId &&
                      styles.selectDisabled,
                  ]}
                  onPress={() =>
                    marcaId &&
                    setModalSelecao('MODELO')
                  }
                  disabled={
                    !marcaId ||
                    carregandoModelos ||
                    carregando
                  }
                >
                  <Text
                    style={[
                      styles.selectText,
                      !modeloId &&
                        styles.placeholder,
                    ]}
                  >
                    {carregandoModelos
                      ? 'Carregando modelos...'
                      : getModeloNome()}
                  </Text>

                  <Text style={styles.arrow}>
                    ▼
                  </Text>
                </TouchableOpacity>

                {/* CATEGORIA */}

                <Text style={styles.label}>
                  Categoria
                </Text>

                <TouchableOpacity
                  style={styles.select}
                  onPress={() =>
                    setModalSelecao('CATEGORIA')
                  }
                  disabled={carregando}
                >
                  <Text
                    style={[
                      styles.selectText,
                      !categoriaId &&
                        styles.placeholder,
                    ]}
                  >
                    {getCategoriaNome()}
                  </Text>

                  <Text style={styles.arrow}>
                    ▼
                  </Text>
                </TouchableOpacity>

                {/* PLACA */}

                <Text style={styles.label}>
                  Placa
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="ABC1D23"
                  placeholderTextColor="#999"
                  value={placa}
                  onChangeText={texto =>
                    setPlaca(
                      texto
                        .toUpperCase()
                        .replace(/\s/g, '')
                    )
                  }
                  autoCapitalize="characters"
                  editable={!carregando}
                  maxLength={7}
                />

                {/* COR */}

                <Text style={styles.label}>
                  Cor
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Ex.: Prata"
                  placeholderTextColor="#999"
                  value={cor}
                  onChangeText={setCor}
                  editable={!carregando}
                />

                {/* ANO */}

                <Text style={styles.label}>
                  Ano
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Ex.: 2024"
                  placeholderTextColor="#999"
                  value={ano}
                  onChangeText={texto =>
                    setAno(
                      texto.replace(/\D/g, '')
                    )
                  }
                  keyboardType="numeric"
                  maxLength={4}
                  editable={!carregando}
                />

                {/* AVISO */}

                <View style={styles.infoBox}>
                  <Text style={styles.infoTitle}>
                    Cadastro do motorista
                  </Text>

                  <Text style={styles.infoText}>
                    Após o cadastro, seus dados e o
                    veículo poderão ser analisados
                    antes da liberação para realizar
                    corridas.
                  </Text>
                </View>
              </>
            )}
          </>
        )}

        {/* ================================================== */}
        {/* SENHA */}
        {/* ================================================== */}

        <Text style={styles.sectionTitle}>
          Segurança
        </Text>

        <Text style={styles.label}>
          Senha
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite sua senha"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!carregando}
        />

        <Text style={styles.label}>
          Confirmar senha
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Digite novamente sua senha"
          placeholderTextColor="#999"
          value={confirmarPassword}
          onChangeText={setConfirmarPassword}
          secureTextEntry
          editable={!carregando}
        />

        {/* ================================================== */}
        {/* BOTÃO */}
        {/* ================================================== */}

        <TouchableOpacity
          style={[
            styles.cadastrarButton,
            carregando &&
              styles.buttonDisabled,
          ]}
          onPress={handleCadastro}
          disabled={
            carregando ||
            carregandoDadosVeiculo
          }
        >
          {carregando ? (
            <ActivityIndicator
              color="#fff"
            />
          ) : (
            <Text style={styles.cadastrarText}>
              Criar conta
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginButton}
          onPress={() =>
            router.replace('/login')
          }
          disabled={carregando}
        >
          <Text style={styles.loginText}>
            Já tenho uma conta
          </Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ==================================================== */}
      {/* MODAL DE SELEÇÃO */}
      {/* ==================================================== */}

      <Modal
        visible={modalSelecao !== null}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setModalSelecao(null)
        }
      >
        <View style={styles.modalOverlay}>

          <View style={styles.modalContainer}>

            <View style={styles.modalHeader}>

              <Text style={styles.modalTitle}>
                {modalSelecao === 'MARCA' &&
                  'Selecione a marca'}

                {modalSelecao === 'MODELO' &&
                  'Selecione o modelo'}

                {modalSelecao === 'CATEGORIA' &&
                  'Selecione a categoria'}
              </Text>

              <TouchableOpacity
                onPress={() =>
                  setModalSelecao(null)
                }
              >
                <Text style={styles.modalClose}>
                  ✕
                </Text>
              </TouchableOpacity>

            </View>

            {/* ============================================ */}
            {/* MARCAS */}
            {/* ============================================ */}

            {modalSelecao === 'MARCA' && (
              <FlatList
                data={marcas}
                keyExtractor={item =>
                  item.idMarca
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() =>
                      selecionarMarca(
                        item.idMarca
                      )
                    }
                  >
                    <Text style={styles.optionTitle}>
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    Nenhuma marca disponível.
                  </Text>
                }
              />
            )}

            {/* ============================================ */}
            {/* MODELOS */}
            {/* ============================================ */}

            {modalSelecao === 'MODELO' && (
              <FlatList
                data={modelos}
                keyExtractor={item =>
                  item.idModelo
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() =>
                      selecionarModelo(
                        item.idModelo
                      )
                    }
                  >
                    <Text style={styles.optionTitle}>
                      {item.nome}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    Nenhum modelo disponível para
                    esta marca.
                  </Text>
                }
              />
            )}

            {/* ============================================ */}
            {/* CATEGORIAS */}
            {/* ============================================ */}

            {modalSelecao === 'CATEGORIA' && (
              <FlatList
                data={categorias}
                keyExtractor={item =>
                  item.id
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.option}
                    onPress={() =>
                      selecionarCategoria(
                        item.id
                      )
                    }
                  >
                    <Text style={styles.optionTitle}>
                      {item.nome}
                    </Text>

                    <Text style={styles.optionDescription}>
                      {item.descricao ||
                        'Categoria de veículo'}
                    </Text>

                    <Text style={styles.optionCapacity}>
                      Até{' '}
                      {item.capacidade_passageiros}{' '}
                      passageiros
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyText}>
                    Nenhuma categoria disponível.
                  </Text>
                }
              />
            )}

          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

// ==========================================================
// ESTILOS
// ==========================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  header: {
    marginBottom: 25,
  },

  title: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 15,
    color: '#666',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111',
    marginTop: 22,
    marginBottom: 14,
  },

  tipoContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 5,
  },

  tipoButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  tipoButtonAtivo: {
    backgroundColor: '#111',
    borderColor: '#111',
  },

  tipoText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#555',
  },

  tipoTextAtivo: {
    color: '#fff',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 7,
    marginTop: 10,
  },

  input: {
    height: 52,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#111',
  },

  select: {
    minHeight: 52,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectDisabled: {
    backgroundColor: '#eeeeee',
  },

  selectText: {
    flex: 1,
    fontSize: 16,
    color: '#111',
  },

  placeholder: {
    color: '#999',
  },

  arrow: {
    marginLeft: 10,
    fontSize: 12,
    color: '#555',
  },

  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  loadingText: {
    color: '#666',
    fontSize: 14,
  },

  infoBox: {
    marginTop: 18,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#eef5ff',
    borderWidth: 1,
    borderColor: '#d6e5ff',
  },

  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4f91',
    marginBottom: 5,
  },

  infoText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#41617d',
  },

  cadastrarButton: {
    height: 54,
    backgroundColor: '#111',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  cadastrarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  loginButton: {
    alignItems: 'center',
    paddingVertical: 18,
  },

  loginText: {
    fontSize: 15,
    color: '#111',
    fontWeight: '600',
  },

  // ========================================================
  // MODAL
  // ========================================================

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },

  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: '75%',
    paddingBottom: 25,
  },

  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  modalTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
  },

  modalClose: {
    fontSize: 22,
    color: '#555',
  },

  option: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },

  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },

  optionDescription: {
    marginTop: 4,
    fontSize: 13,
    color: '#666',
  },

  optionCapacity: {
    marginTop: 5,
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },

  emptyText: {
    padding: 25,
    textAlign: 'center',
    color: '#777',
  },
});