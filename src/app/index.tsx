import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useEffect } from 'react';

import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const {
    usuario,
    carregando,
  } = useAuth();

  useEffect(() => {
    if (carregando) {
      return;
    }

    // Usuário não autenticado
    if (!usuario) {
      router.replace('/login');
      return;
    }

    // Cliente
    if (usuario.tipo === 'CLIENTE') {
      router.replace('/cliente');
      return;
    }

    // Motorista
    if (usuario.tipo === 'MOTORISTA') {
      router.replace('/motorista');
      return;
    }
  }, [carregando, usuario]);

  if (carregando) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />

        <Text style={styles.texto}>
          Carregando...
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  texto: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
});
