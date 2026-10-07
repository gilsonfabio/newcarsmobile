import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { useState } from 'react';

import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

type TipoUsuario = 'CLIENTE' | 'MOTORISTA';

export default function Cadastro() {
  const { cadastro } = useAuth();

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [tipo, setTipo] = useState<TipoUsuario>('CLIENTE');
  const [cnh, setCnh] = useState('');

  const [carregando, setCarregando] = useState(false);

  async function handleCadastro() {
    if (!nome || !email || !telefone || !password) {
      Alert.alert(
        'Atenção',
        'Preencha todos os campos obrigatórios.'
      );

      return;
    }

    if (password !== confirmarPassword) {
      Alert.alert(
        'Atenção',
        'As senhas não são iguais.'
      );

      return;
    }

    if (password.length < 6) {
      Alert.alert(
        'Atenção',
        'A senha deve possuir pelo menos 6 caracteres.'
      );

      return;
    }

    if (tipo === 'MOTORISTA' && !cnh) {
      Alert.alert(
        'Atenção',
        'Informe a CNH para continuar.'
      );

      return;
    }

    try {
      setCarregando(true);

      await cadastro({
        nome,
        email,
        telefone,
        password,
        tipo,
        ...(tipo === 'MOTORISTA' ? { cnh } : {}),
      });

      Alert.alert(
        'Cadastro realizado',
        tipo === 'MOTORISTA'
          ? 'Seu cadastro foi realizado. Aguarde a aprovação para começar a dirigir.'
          : 'Sua conta foi criada com sucesso.',
        [
          {
            text: 'Continuar',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error: any) {
      console.error('Erro ao cadastrar:', error);

      const mensagem =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Não foi possível realizar o cadastro.';

      Alert.alert('Erro', mensagem);
    } finally {
      setCarregando(false);
    }
  }

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
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.titulo}>
            Criar conta
          </Text>

          <Text style={styles.subtitulo}>
            Cadastre-se para usar o Mobilidade
          </Text>
        </View>

        <View style={styles.tipoContainer}>
          <Text style={styles.label}>
            Quero me cadastrar como
          </Text>

          <View style={styles.tipoOpcoes}>
            <TouchableOpacity
              style={[
                styles.tipoBotao,
                tipo === 'CLIENTE' &&
                  styles.tipoBotaoSelecionado,
              ]}
              onPress={() => setTipo('CLIENTE')}
            >
              <Text
                style={[
                  styles.tipoTexto,
                  tipo === 'CLIENTE' &&
                    styles.tipoTextoSelecionado,
                ]}
              >
                Cliente
              </Text>

              <Text
                style={[
                  styles.tipoDescricao,
                  tipo === 'CLIENTE' &&
                    styles.tipoDescricaoSelecionada,
                ]}
              >
                Solicitar corridas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.tipoBotao,
                tipo === 'MOTORISTA' &&
                  styles.tipoBotaoSelecionado,
              ]}
              onPress={() => setTipo('MOTORISTA')}
            >
              <Text
                style={[
                  styles.tipoTexto,
                  tipo === 'MOTORISTA' &&
                    styles.tipoTextoSelecionado,
                ]}
              >
                Motorista
              </Text>

              <Text
                style={[
                  styles.tipoDescricao,
                  tipo === 'MOTORISTA' &&
                    styles.tipoDescricaoSelecionada,
                ]}
              >
                Realizar corridas
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.formulario}>
          <Text style={styles.label}>
            Nome completo
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Digite seu nome"
            placeholderTextColor="#888"
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
          />

          <Text style={styles.label}>
            Email
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Digite seu email"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>
            Telefone
          </Text>

          <TextInput
            style={styles.input}
            placeholder="(62) 99999-9999"
            placeholderTextColor="#888"
            value={telefone}
            onChangeText={setTelefone}
            keyboardType="phone-pad"
          />

          {tipo === 'MOTORISTA' && (
            <>
              <Text style={styles.label}>
                CNH
              </Text>

              <TextInput
                style={styles.input}
                placeholder="Digite o número da CNH"
                placeholderTextColor="#888"
                value={cnh}
                onChangeText={setCnh}
                keyboardType="numeric"
              />

              <View style={styles.avisoMotorista}>
                <Text style={styles.avisoTitulo}>
                  Cadastro de motorista
                </Text>

                <Text style={styles.avisoTexto}>
                  Após o cadastro, seus dados precisarão
                  ser analisados antes de você começar
                  a receber corridas.
                </Text>
              </View>
            </>
          )}

          <Text style={styles.label}>
            Senha
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Digite sua senha"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <Text style={styles.label}>
            Confirmar senha
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Digite a senha novamente"
            placeholderTextColor="#888"
            value={confirmarPassword}
            onChangeText={setConfirmarPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[
              styles.botao,
              carregando && styles.botaoDesabilitado,
            ]}
            onPress={handleCadastro}
            disabled={carregando}
          >
            {carregando ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.textoBotao}>
                Criar conta
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.voltar}
            onPress={() => router.replace('/login')}
            disabled={carregando}
          >
            <Text style={styles.voltarTexto}>
              Já tenho uma conta
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  scroll: {
    flexGrow: 1,
    padding: 25,
    paddingBottom: 40,
  },

  header: {
    marginTop: 25,
    marginBottom: 30,
  },

  titulo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
  },

  subtitulo: {
    marginTop: 8,
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },

  formulario: {
    width: '100%',
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 7,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 18,
    fontSize: 16,
    color: '#222',
    backgroundColor: '#fff',
  },

  tipoContainer: {
    marginBottom: 25,
  },

  tipoOpcoes: {
    flexDirection: 'row',
    gap: 10,
  },

  tipoBotao: {
    flex: 1,
    minHeight: 82,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    justifyContent: 'center',
  },

  tipoBotaoSelecionado: {
    backgroundColor: '#111',
    borderColor: '#111',
  },

  tipoTexto: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#222',
    textAlign: 'center',
  },

  tipoTextoSelecionado: {
    color: '#fff',
  },

  tipoDescricao: {
    marginTop: 5,
    fontSize: 12,
    color: '#777',
    textAlign: 'center',
  },

  tipoDescricaoSelecionada: {
    color: '#ddd',
  },

  avisoMotorista: {
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },

  avisoTitulo: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 5,
  },

  avisoTexto: {
    fontSize: 13,
    lineHeight: 19,
    color: '#666',
  },

  botao: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  textoBotao: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  voltar: {
    alignItems: 'center',
    marginTop: 22,
  },

  voltarTexto: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
});
