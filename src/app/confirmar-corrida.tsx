import React, { useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  router,
  useLocalSearchParams,
} from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function ConfirmarCorrida() {
  const params = useLocalSearchParams<{
    latitude: string;
    longitude: string;
    destino: string;
    destino_latitude: string;
    destino_longitude: string;
  }>();

  const { token } = useAuth();

  const [carregando, setCarregando] =
    useState(false);

  /*
   * Converte os parâmetros recebidos
   * da tela anterior.
   */
  const origemLatitude =
    Number(params.latitude);

  const origemLongitude =
    Number(params.longitude);

  const destinoLatitude =
    Number(params.destino_latitude);

  const destinoLongitude =
    Number(params.destino_longitude);

  const destino =
    params.destino ?? '';

  /*
   * Voltar para a tela anterior.
   */
  function voltar() {
    router.back();
  }

  /*
   * Confirma e salva a corrida no backend.
   */
  async function confirmarCorrida() {
    /*
     * ==========================================
     * VALIDA TOKEN
     * ==========================================
     */

    if (!token) {
      Alert.alert(
        'Sessão expirada',
        'Sua sessão não está mais disponível. Faça login novamente.'
      );

      return;
    }

    /*
     * ==========================================
     * VALIDA ORIGEM
     * ==========================================
     */

    if (
      !Number.isFinite(origemLatitude) ||
      !Number.isFinite(origemLongitude)
    ) {
      Alert.alert(
        'Erro',
        'A localização de origem é inválida.'
      );

      return;
    }

    /*
     * ==========================================
     * VALIDA DESTINO
     * ==========================================
     */

    if (!destino.trim()) {
      Alert.alert(
        'Erro',
        'O endereço de destino é obrigatório.'
      );

      return;
    }

    if (
      !Number.isFinite(destinoLatitude) ||
      !Number.isFinite(destinoLongitude)
    ) {
      Alert.alert(
        'Erro',
        'A localização do destino é inválida.'
      );

      return;
    }

    try {
      setCarregando(true);

      /*
       * ========================================
       * ENVIA PARA O BACKEND
       * ========================================
       *
       * O api já possui o:
       *
       * Authorization:
       * Bearer SEU_TOKEN
       *
       * configurado pelo AuthContext.
       */

      const response = await api.post(
        '/corridas',
        {
          origem: {
            latitude: origemLatitude,
            longitude: origemLongitude,
          },

          destino: {
            endereco: destino.trim(),
            latitude: destinoLatitude,
            longitude: destinoLongitude,
          },
        }
      );

      console.log(
        'Corrida criada:',
        response.data
      );

      /*
       * ========================================
       * SUCESSO
       * ========================================
       */

      const corrida =
        response.data?.corrida;

      Alert.alert(
        'Corrida solicitada',
        'Sua corrida foi solicitada com sucesso.',
        [
          {
            text: 'OK',

            onPress: () => {
              /*
               * Por enquanto voltamos para
               * a tela inicial.
               *
               * Depois podemos criar a tela
               * "Aguardando motorista".
               */

              router.replace('/cliente');
            },
          },
        ]
      );

      /*
       * Se futuramente quisermos utilizar
       * o ID da corrida:
       *
       * corrida?.id
       */

      if (corrida?.id) {
        console.log(
          'ID da corrida:',
          corrida.id
        );
      }

    } catch (error: any) {
      console.error(
        'Erro ao solicitar corrida:',
        error
      );

      /*
       * ========================================
       * ERRO DO BACKEND
       * ========================================
       */

      const mensagem =
        error?.response?.data?.error ??
        error?.response?.data?.message ??
        'Não foi possível solicitar a corrida.';

      Alert.alert(
        'Erro',
        mensagem
      );

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
      {/* CABEÇALHO */}

      <View style={styles.cabecalho}>
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={voltar}
          disabled={carregando}
        >
          <Text style={styles.botaoVoltarTexto}>
            ←
          </Text>
        </TouchableOpacity>

        <Text style={styles.cabecalhoTitulo}>
          Confirmar corrida
        </Text>

        <View style={styles.espacoCabecalho} />
      </View>

      {/* CONTEÚDO */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
      >
        <Text style={styles.titulo}>
          Confirme sua corrida
        </Text>

        <Text style={styles.subtitulo}>
          Confira os locais de partida e destino
          antes de solicitar.
        </Text>

        {/* ORIGEM */}

        <View style={styles.card}>
          <View style={styles.iconeContainer}>
            <Text style={styles.icone}>
              📍
            </Text>
          </View>

          <View style={styles.cardConteudo}>
            <Text style={styles.label}>
              Partida
            </Text>

            <Text style={styles.textoPrincipal}>
              Sua localização atual
            </Text>

            <Text style={styles.coordenadas}>
              {Number.isFinite(origemLatitude)
                ? origemLatitude.toFixed(6)
                : '--'}
              ,{' '}
              {Number.isFinite(origemLongitude)
                ? origemLongitude.toFixed(6)
                : '--'}
            </Text>
          </View>
        </View>

        {/* LINHA */}

        <View style={styles.linha}>
          <View style={styles.linhaVertical} />
        </View>

        {/* DESTINO */}

        <View style={styles.card}>
          <View style={styles.iconeContainer}>
            <Text style={styles.icone}>
              🏁
            </Text>
          </View>

          <View style={styles.cardConteudo}>
            <Text style={styles.label}>
              Destino
            </Text>

            <Text style={styles.textoPrincipal}>
              {destino || 'Destino não informado'}
            </Text>

            <Text style={styles.coordenadas}>
              {Number.isFinite(destinoLatitude)
                ? destinoLatitude.toFixed(6)
                : '--'}
              ,{' '}
              {Number.isFinite(destinoLongitude)
                ? destinoLongitude.toFixed(6)
                : '--'}
            </Text>
          </View>
        </View>

        {/* INFORMAÇÃO */}

        <View style={styles.info}>
          <Text style={styles.infoIcone}>
            ℹ️
          </Text>

          <Text style={styles.infoTexto}>
            Ao confirmar, sua solicitação será
            enviada para os motoristas disponíveis
            próximos à sua localização.
          </Text>
        </View>
      </ScrollView>

      {/* RODAPÉ */}

      <View style={styles.rodape}>
        <TouchableOpacity
          style={[
            styles.botaoConfirmar,
            carregando &&
              styles.botaoDesabilitado,
          ]}
          onPress={confirmarCorrida}
          disabled={carregando}
        >
          {carregando ? (
            <>
              <ActivityIndicator
                color="#fff"
                size="small"
              />

              <Text
                style={
                  styles.botaoConfirmarTexto
                }
              >
                Solicitando...
              </Text>
            </>
          ) : (
            <Text
              style={
                styles.botaoConfirmarTexto
              }
            >
              Confirmar corrida
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoCancelar}
          onPress={voltar}
          disabled={carregando}
        >
          <Text
            style={
              styles.botaoCancelarTexto
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  scroll: {
    flex: 1,
  },

  cabecalho: {
    height: 95,
    paddingTop: 45,
    paddingHorizontal: 20,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',

    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },

  botaoVoltar: {
    width: 42,
    height: 42,

    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoVoltarTexto: {
    fontSize: 30,
    color: '#111',
    fontWeight: '400',
  },

  cabecalhoTitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111',
  },

  espacoCabecalho: {
    width: 42,
  },

  conteudo: {
    padding: 22,
    paddingBottom: 30,
  },

  titulo: {
    fontSize: 25,
    fontWeight: 'bold',
    color: '#111',
  },

  subtitulo: {
    marginTop: 8,
    marginBottom: 25,

    fontSize: 14,
    lineHeight: 20,

    color: '#666',
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',

    padding: 16,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: '#e5e5e5',

    backgroundColor: '#fafafa',
  },

  iconeContainer: {
    width: 45,
    height: 45,

    borderRadius: 23,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#fff',
  },

  icone: {
    fontSize: 21,
  },

  cardConteudo: {
    flex: 1,
    marginLeft: 12,
  },

  label: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },

  textoPrincipal: {
    marginTop: 5,

    fontSize: 15,
    lineHeight: 21,

    color: '#111',
    fontWeight: '600',
  },

  coordenadas: {
    marginTop: 5,

    fontSize: 11,
    color: '#888',
  },

  linha: {
    height: 25,
    paddingLeft: 38,
  },

  linhaVertical: {
    width: 2,
    flex: 1,
    backgroundColor: '#ddd',
  },

  info: {
    flexDirection: 'row',

    marginTop: 25,
    padding: 15,

    borderRadius: 12,

    backgroundColor: '#f5f5f5',
  },

  infoIcone: {
    fontSize: 16,
  },

  infoTexto: {
    flex: 1,

    marginLeft: 8,

    fontSize: 12,
    lineHeight: 18,

    color: '#666',
  },

  rodape: {
    paddingHorizontal: 22,
    paddingTop: 15,
    paddingBottom: 25,

    borderTopWidth: 1,
    borderTopColor: '#eee',

    backgroundColor: '#fff',
  },

  botaoConfirmar: {
    height: 55,

    borderRadius: 12,

    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#111',
  },

  botaoDesabilitado: {
    opacity: 0.6,
  },

  botaoConfirmarTexto: {
    marginLeft: 8,

    color: '#fff',

    fontSize: 17,
    fontWeight: 'bold',
  },

  botaoCancelar: {
    height: 45,
    marginTop: 8,

    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoCancelarTexto: {
    color: '#555',

    fontSize: 14,
    fontWeight: '600',
  },
});