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
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert('Atenção', 'Informe o e-mail e a senha.');
      return;
    }

    try {
      setCarregando(true);

      await login({
        email: email.trim(),
        password,
      });

      router.replace('/');
    } catch (error: any) {
      console.error(error);

      const mensagem =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Não foi possível realizar o login.';

      Alert.alert('Erro', mensagem);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Mobilidade</Text>

      <Text style={styles.subtitulo}>
        Entre na sua conta
      </Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor="#888"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        autoComplete="email"
      />

      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#888"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
      />

      <TouchableOpacity
        style={styles.esqueciSenha}
        onPress={() => router.push('/recuperar-senha')}
        disabled={carregando}
        accessibilityRole="button"
      >
        <Text style={styles.textoEsqueciSenha}>
          Esqueci minha senha
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.botao}
        onPress={handleLogin}
        disabled={carregando}
        accessibilityRole="button"
      >
        {carregando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.textoBotao}>Entrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/cadastro')}
        disabled={carregando}
      >
        <Text style={styles.cadastro}>
          Ainda não tenho uma conta
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 30,
    backgroundColor: '#fff',
  },

  titulo: {
    fontSize: 36,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#111',
  },

  subtitulo: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 35,
  },

  input: {
    height: 52,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#222',
  },

  esqueciSenha: {
    alignSelf: 'flex-end',
    marginTop: -5,
    marginBottom: 15,
    paddingVertical: 5,
  },

  textoEsqueciSenha: {
    color: '#2563eb',
    fontSize: 14,
    fontWeight: '600',
  },

  botao: {
    height: 52,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  textoBotao: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },

  cadastro: {
    textAlign: 'center',
    marginTop: 25,
    fontSize: 15,
    color: '#333',
  },
});
