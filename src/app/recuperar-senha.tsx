import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { router } from 'expo-router';
import { useState } from 'react';
import { api } from '../services/api';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [solicitacaoEnviada, setSolicitacaoEnviada] =
    useState(false);

  async function handleRecuperarSenha() {
    const emailFormatado = email.trim().toLowerCase();

    if (!emailFormatado) {
      Alert.alert('Atenção', 'Informe seu e-mail.');
      return;
    }

    const formatoEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formatoEmail.test(emailFormatado)) {
      Alert.alert(
        'E-mail inválido',
        'Informe um endereço de e-mail válido.'
      );
      return;
    }

    try {
      setCarregando(true);

      await api.post('/password/forgot', {
        email: emailFormatado,
      });

      setSolicitacaoEnviada(true);
    } catch (error: any) {
      console.error(
        'Erro ao solicitar recuperação de senha:',
        error
      );

      Alert.alert(
        'Não foi possível continuar',
        error?.response?.data?.error ||
          error?.response?.data?.message ||
          'Não foi possível processar sua solicitação. Tente novamente.'
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.voltar}
        onPress={() => router.back()}
      >
        <Text style={styles.textoVoltar}>
          ‹ Voltar ao login
        </Text>
      </TouchableOpacity>

      <View style={styles.conteudo}>
        <View style={styles.icone}>
          <Text style={styles.iconeTexto}>🔐</Text>
        </View>

        <Text style={styles.titulo}>
          Recuperar senha
        </Text>

        {solicitacaoEnviada ? (
          <>
            <Text style={styles.descricao}>
              Se existir uma conta associada a esse e-mail,
              você receberá as instruções para redefinir sua
              senha.
            </Text>

            <TouchableOpacity
              style={styles.botao}
              onPress={() => router.replace('/')}
            >
              <Text style={styles.textoBotao}>
                Voltar ao login
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.descricao}>
              Informe o e-mail cadastrado na sua conta.
              Enviaremos as instruções para recuperar seu
              acesso.
            </Text>

            <Text style={styles.label}>
              E-mail cadastrado
            </Text>

            <TextInput
              style={styles.input}
              placeholder="seuemail@exemplo.com"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!carregando}
              returnKeyType="send"
              onSubmitEditing={handleRecuperarSenha}
            />

            <TouchableOpacity
              style={[
                styles.botao,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={handleRecuperarSenha}
              disabled={carregando}
            >
              {carregando ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.textoBotao}>
                  Enviar instruções
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.ajuda}>
              Verifique também a caixa de spam do seu
              e-mail.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 25,
    justifyContent: 'center',
  },

  voltar: {
    position: 'absolute',
    top: 55,
    left: 25,
    paddingVertical: 10,
  },

  textoVoltar: {
    color: '#2563eb',
    fontSize: 15,
    fontWeight: '600',
  },

  conteudo: {
    width: '100%',
  },

  icone: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 22,
  },

  iconeTexto: {
    fontSize: 32,
  },

  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
    textAlign: 'center',
    marginBottom: 12,
  },

  descricao: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: 30,
  },

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#222',
    marginBottom: 18,
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
    fontSize: 16,
    fontWeight: 'bold',
  },

  ajuda: {
    textAlign: 'center',
    color: '#777',
    fontSize: 13,
    marginTop: 20,
    lineHeight: 20,
  },
});
