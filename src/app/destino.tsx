import React, { useEffect, useRef, useState } from 'react';
import Constants from 'expo-constants';

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

import { router, useLocalSearchParams } from 'expo-router';

type Sugestao = {
  placeId: string;
  descricao: string;
  principal: string;
  secundario: string;
};

type AutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: {
      placeId?: string;
      text?: {
        text?: string;
      };
      structuredFormat?: {
        mainText?: {
          text?: string;
        };
        secondaryText?: {
          text?: string;
        };
      };
    };
  }>;
};

type PlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: {
    text?: string;
  };
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

export default function SolicitarCorrida() {
  const params = useLocalSearchParams<{
    latitude: string;
    longitude: string;
  }>();

  const googleMapsApiKey =
    Constants.expoConfig?.extra?.googleMapsApiKey;

  const [textoDestino, setTextoDestino] = useState('');
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);

  const [buscando, setBuscando] = useState(false);
  const [carregandoDetalhes, setCarregandoDetalhes] =
    useState(false);

  const [destinoSelecionado, setDestinoSelecionado] =
    useState(false);

  const [destino, setDestino] = useState('');
  const [destinoLatitude, setDestinoLatitude] =
    useState<number | null>(null);
  const [destinoLongitude, setDestinoLongitude] =
    useState<number | null>(null);

  const [carregando, setCarregando] = useState(false);

  const timeoutBusca = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  function voltar() {
    router.back();
  }

  /*
   * Limpa a busca anterior.
   */
  function limparDestino() {
    setTextoDestino('');
    setSugestoes([]);

    setDestinoSelecionado(false);
    setDestino('');

    setDestinoLatitude(null);
    setDestinoLongitude(null);
  }

  /*
   * Consulta o Autocomplete (New).
   *
   * Endpoint:
   * POST https://places.googleapis.com/v1/places:autocomplete
   */
  async function buscarSugestoes(texto: string) {
    if (!googleMapsApiKey) {
      Alert.alert(
        'Erro',
        'A chave da API do Google Maps não foi encontrada.'
      );

      return;
    }

    if (texto.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    if (!params.latitude || !params.longitude) {
      return;
    }

    try {
      setBuscando(true);

      const latitude = Number(params.latitude);
      const longitude = Number(params.longitude);

      const response = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleMapsApiKey,

            /*
             * Retornamos somente os campos necessários.
             */
            'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,' +
              'suggestions.placePrediction.text,' +
              'suggestions.placePrediction.structuredFormat',
          },

          body: JSON.stringify({
            input: texto,

            languageCode: 'pt-BR',

            includedRegionCodes: ['br'],

            origin: {
              latitude,
              longitude,
            },
          }),
        }
      );

      const resultado: AutocompleteResponse =
        await response.json();

      if (!response.ok) {
        console.error(
          'Erro Autocomplete (New):',
          resultado
        );

        setSugestoes([]);

        return;
      }

      const lista: Sugestao[] =
        (resultado.suggestions ?? [])
          .map((item) => {
            const prediction =
              item.placePrediction;

            if (!prediction?.placeId) {
              return null;
            }

            const descricao =
              prediction.text?.text ?? '';

            const principal =
              prediction.structuredFormat
                ?.mainText?.text ??
              descricao;

            const secundario =
              prediction.structuredFormat
                ?.secondaryText?.text ??
              '';

            return {
              placeId: prediction.placeId,
              descricao,
              principal,
              secundario,
            };
          })
          .filter(
            (item): item is Sugestao =>
              item !== null
          );

      setSugestoes(lista);
    } catch (error) {
      console.error(
        'Erro ao buscar sugestões:',
        error
      );

      setSugestoes([]);
    } finally {
      setBuscando(false);
    }
  }

  /*
   * Aguarda o usuário parar de digitar
   * antes de consultar o Google.
   */
  function alterarTextoDestino(texto: string) {
    setTextoDestino(texto);

    setDestinoSelecionado(false);

    setDestino('');
    setDestinoLatitude(null);
    setDestinoLongitude(null);

    if (timeoutBusca.current) {
      clearTimeout(timeoutBusca.current);
    }

    if (texto.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    timeoutBusca.current = setTimeout(() => {
      buscarSugestoes(texto);
    }, 350);
  }

  /*
   * Busca os detalhes do local selecionado.
   *
   * Endpoint:
   * GET https://places.googleapis.com/v1/places/{PLACE_ID}
   */
  async function selecionarDestino(
    sugestao: Sugestao
  ) {
    if (!googleMapsApiKey) {
      Alert.alert(
        'Erro',
        'A chave da API do Google Maps não foi encontrada.'
      );

      return;
    }

    try {
      setCarregandoDetalhes(true);

      setSugestoes([]);

      const response = await fetch(
        `https://places.googleapis.com/v1/places/${sugestao.placeId}`,
        {
          method: 'GET',

          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleMapsApiKey,

            /*
             * Somente os campos necessários
             * para a corrida.
             */
            'X-Goog-FieldMask':
              'id,formattedAddress,displayName,location',
          },
        }
      );

      const detalhes: PlaceDetailsResponse =
        await response.json();

      if (!response.ok) {
        console.error(
          'Erro Place Details (New):',
          detalhes
        );

        Alert.alert(
          'Erro',
          'Não foi possível obter os detalhes desse endereço.'
        );

        return;
      }

      const latitude =
        detalhes.location?.latitude;

      const longitude =
        detalhes.location?.longitude;

      const endereco =
        detalhes.formattedAddress ??
        sugestao.descricao;

      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !endereco
      ) {
        Alert.alert(
          'Erro',
          'O endereço selecionado não possui uma localização válida.'
        );

        return;
      }

      setTextoDestino(endereco);

      setDestino(endereco);

      setDestinoLatitude(latitude);

      setDestinoLongitude(longitude);

      setDestinoSelecionado(true);
    } catch (error) {
      console.error(
        'Erro ao obter detalhes do local:',
        error
      );

      Alert.alert(
        'Erro',
        'Não foi possível obter os dados do endereço selecionado.'
      );
    } finally {
      setCarregandoDetalhes(false);
    }
  }

  function continuar() {
    if (!params.latitude || !params.longitude) {
      Alert.alert(
        'Erro',
        'Não foi possível obter sua localização atual.'
      );

      return;
    }

    if (
      !destino ||
      destinoLatitude === null ||
      destinoLongitude === null
    ) {
      Alert.alert(
        'Destino',
        'Selecione um endereço na lista de sugestões.'
      );

      return;
    }

    setCarregando(true);

    router.push({
      pathname: '/confirmar-corrida',

      params: {
        latitude: String(params.latitude),
        longitude: String(params.longitude),

        destino: destino,
        destino_latitude: String(destinoLatitude),
        destino_longitude: String(destinoLongitude),
      },
    });

    setCarregando(false);
  }

  useEffect(() => {
    return () => {
      if (timeoutBusca.current) {
        clearTimeout(timeoutBusca.current);
      }
    };
  }, []);

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
        >
          <Text style={styles.botaoVoltarTexto}>
            ←
          </Text>
        </TouchableOpacity>

        <Text style={styles.cabecalhoTitulo}>
          Solicitar corrida
        </Text>

        <View style={styles.espacoCabecalho} />
      </View>

      {/* CONTEÚDO */}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titulo}>
          Para onde você vai?
        </Text>

        <Text style={styles.subtitulo}>
          Digite o endereço ou nome do local de
          destino.
        </Text>

        {/* ORIGEM */}

        <View style={styles.origemCard}>
          <View style={styles.iconeContainer}>
            <Text style={styles.icone}>
              📍
            </Text>
          </View>

          <View style={styles.origemConteudo}>
            <Text style={styles.origemLabel}>
              Partida
            </Text>

            <Text style={styles.origemTexto}>
              Sua localização atual
            </Text>

            {params.latitude &&
              params.longitude && (
                <Text style={styles.coordenadas}>
                  {Number(params.latitude).toFixed(
                    6
                  )}
                  ,{' '}
                  {Number(
                    params.longitude
                  ).toFixed(6)}
                </Text>
              )}
          </View>
        </View>

        {/* DESTINO */}

        <View style={styles.destinoContainer}>
          <Text style={styles.label}>
            Destino
          </Text>

          <TextInput
            style={styles.input}
            value={textoDestino}
            onChangeText={
              alterarTextoDestino
            }
            placeholder="Digite seu destino"
            placeholderTextColor="#888"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />

          {/* CARREGANDO */}

          {buscando && (
            <View style={styles.carregandoBusca}>
              <ActivityIndicator size="small" />

              <Text style={styles.carregandoTexto}>
                Buscando locais...
              </Text>
            </View>
          )}

          {/* CARREGANDO DETALHES */}

          {carregandoDetalhes && (
            <View style={styles.carregandoBusca}>
              <ActivityIndicator size="small" />

              <Text style={styles.carregandoTexto}>
                Obtendo localização...
              </Text>
            </View>
          )}

          {/* SUGESTÕES */}

          {sugestoes.length > 0 && (
            <View style={styles.lista}>
              {sugestoes.map(
                (sugestao, index) => (
                  <React.Fragment
                    key={sugestao.placeId}
                  >
                    <TouchableOpacity
                      style={
                        styles.linhaResultado
                      }
                      activeOpacity={0.7}
                      onPress={() =>
                        selecionarDestino(
                          sugestao
                        )
                      }
                    >
                      <View
                        style={
                          styles.iconeSugestao
                        }
                      >
                        <Text>
                          📍
                        </Text>
                      </View>

                      <View
                        style={
                          styles.textosSugestao
                        }
                      >
                        <Text
                          style={
                            styles.descricaoResultado
                          }
                          numberOfLines={1}
                        >
                          {sugestao.principal}
                        </Text>

                        {sugestao.secundario ? (
                          <Text
                            style={
                              styles.secundarioResultado
                            }
                            numberOfLines={2}
                          >
                            {
                              sugestao.secundario
                            }
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>

                    {index <
                      sugestoes.length - 1 && (
                      <View
                        style={
                          styles.separador
                        }
                      />
                    )}
                  </React.Fragment>
                )
              )}
            </View>
          )}
        </View>

        {/* DESTINO SELECIONADO */}

        {destinoSelecionado && (
          <View style={styles.destinoSelecionado}>
            <View style={styles.destinoIcone}>
              <Text
                style={
                  styles.destinoIconeTexto
                }
              >
                🏁
              </Text>
            </View>

            <View style={styles.destinoInfo}>
              <Text
                style={styles.destinoLabel}
              >
                Destino selecionado
              </Text>

              <Text
                style={styles.destinoTexto}
              >
                {destino}
              </Text>

              {destinoLatitude !== null &&
                destinoLongitude !== null && (
                  <Text
                    style={
                      styles.coordenadasDestino
                    }
                  >
                    {destinoLatitude.toFixed(6)}
                    ,{' '}
                    {destinoLongitude.toFixed(
                      6
                    )}
                  </Text>
                )}
            </View>
          </View>
        )}

        {/* INFORMAÇÃO */}

        <View style={styles.info}>
          <Text style={styles.infoIcone}>
            ℹ️
          </Text>

          <Text style={styles.infoTexto}>
            Selecione uma das opções apresentadas
            para garantir que o endereço e a
            localização estejam corretos.
          </Text>
        </View>
      </ScrollView>

      {/* RODAPÉ */}

      <View style={styles.rodape}>
        <TouchableOpacity
          style={[
            styles.botaoContinuar,
            !destinoSelecionado &&
              styles.botaoContinuarDesabilitado,
          ]}
          onPress={continuar}
          disabled={
            !destinoSelecionado ||
            carregando ||
            carregandoDetalhes
          }
        >
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text
              style={
                styles.botaoContinuarTexto
              }
            >
              Continuar
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.botaoCancelar}
          onPress={voltar}
        >
          <Text
            style={
              styles.botaoCancelarTexto
            }
          >
            Cancelar
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
    marginBottom: 20,

    fontSize: 14,
    lineHeight: 20,

    color: '#666',
  },

  origemCard: {
    flexDirection: 'row',
    alignItems: 'center',

    padding: 14,

    borderRadius: 14,

    backgroundColor: '#f7f7f7',
  },

  iconeContainer: {
    width: 42,
    height: 42,

    borderRadius: 21,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#fff',
  },

  icone: {
    fontSize: 20,
  },

  origemConteudo: {
    marginLeft: 12,
    flex: 1,
  },

  origemLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },

  origemTexto: {
    marginTop: 3,

    fontSize: 15,
    color: '#111',
    fontWeight: '600',
  },

  coordenadas: {
    marginTop: 3,

    fontSize: 11,
    color: '#888',
  },

  destinoContainer: {
    marginTop: 25,
    zIndex: 10,
  },

  label: {
    marginBottom: 8,

    fontSize: 15,
    fontWeight: 'bold',

    color: '#111',
  },

  input: {
    height: 55,

    borderWidth: 1,
    borderColor: '#ddd',

    borderRadius: 12,

    paddingHorizontal: 15,

    fontSize: 16,

    color: '#111',

    backgroundColor: '#fff',
  },

  carregandoBusca: {
    flexDirection: 'row',
    alignItems: 'center',

    marginTop: 8,
    padding: 12,

    borderRadius: 10,

    backgroundColor: '#f5f5f5',
  },

  carregandoTexto: {
    marginLeft: 8,

    fontSize: 13,
    color: '#666',
  },

  lista: {
    marginTop: 5,

    borderWidth: 1,
    borderColor: '#eee',

    borderRadius: 12,

    backgroundColor: '#fff',

    elevation: 5,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 5,

    overflow: 'hidden',
  },

  linhaResultado: {
    minHeight: 65,

    paddingVertical: 12,
    paddingHorizontal: 15,

    flexDirection: 'row',
    alignItems: 'center',
  },

  iconeSugestao: {
    width: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },

  textosSugestao: {
    flex: 1,
    marginLeft: 8,
  },

  descricaoResultado: {
    fontSize: 15,
    color: '#222',
    fontWeight: '600',
  },

  secundarioResultado: {
    marginTop: 3,

    fontSize: 13,
    lineHeight: 18,

    color: '#777',
  },

  separador: {
    height: 1,
    backgroundColor: '#eee',
  },

  destinoSelecionado: {
    marginTop: 20,

    flexDirection: 'row',
    alignItems: 'center',

    padding: 15,

    borderRadius: 14,

    borderWidth: 1,
    borderColor: '#ddd',

    backgroundColor: '#fafafa',
  },

  destinoIcone: {
    width: 44,
    height: 44,

    borderRadius: 22,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#fff',
  },

  destinoIconeTexto: {
    fontSize: 21,
  },

  destinoInfo: {
    flex: 1,
    marginLeft: 12,
  },

  destinoLabel: {
    fontSize: 12,
    color: '#888',
    fontWeight: '600',
  },

  destinoTexto: {
    marginTop: 4,

    fontSize: 14,
    lineHeight: 19,

    color: '#111',
    fontWeight: '600',
  },

  coordenadasDestino: {
    marginTop: 5,

    fontSize: 11,
    color: '#888',
  },

  info: {
    flexDirection: 'row',

    marginTop: 20,
    padding: 14,

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

  botaoContinuar: {
    height: 55,

    borderRadius: 12,

    alignItems: 'center',
    justifyContent: 'center',

    backgroundColor: '#111',
  },

  botaoContinuarDesabilitado: {
    opacity: 0.4,
  },

  botaoContinuarTexto: {
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


/*
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

export default function Destino() {
  const params = useLocalSearchParams<{
    latitude: string;
    longitude: string;
  }>();

  const [destino, setDestino] = useState('');

  function continuar() {
    const destinoFormatado = destino.trim();

    if (!destinoFormatado) {
      Alert.alert(
        'Destino',
        'Informe para onde você deseja ir.'
      );

      return;
    }

    router.push({
      pathname: './confirmar-corrida',
      params: {
        latitude: params.latitude,
        longitude: params.longitude,
        destino: destinoFormatado,
      },
    });
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
      <View style={styles.conteudo}>
        <TouchableOpacity
          style={styles.voltar}
          onPress={() => router.back()}
        >
          <Text style={styles.voltarTexto}>
            ← Voltar
          </Text>
        </TouchableOpacity>

        <Text style={styles.titulo}>
          Para onde você vai?
        </Text>

        <Text style={styles.subtitulo}>
          Informe o endereço ou local de destino.
        </Text>

        <View style={styles.localizacao}>
          <Text style={styles.localizacaoTitulo}>
            📍 Sua localização atual
          </Text>

          <Text style={styles.coordenadas}>
            {params.latitude}, {params.longitude}
          </Text>
        </View>

        <Text style={styles.label}>
          Destino
        </Text>

        <TextInput
          value={destino}
          onChangeText={setDestino}
          placeholder="Ex.: Shopping Flamboyant"
          placeholderTextColor="#999"
          style={styles.input}
          autoCapitalize="sentences"
          returnKeyType="done"
          onSubmitEditing={continuar}
        />

        <TouchableOpacity
          style={styles.botao}
          onPress={continuar}
        >
          <Text style={styles.botaoTexto}>
            Continuar
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

  conteudo: {
    flex: 1,
    padding: 25,
    paddingTop: 55,
  },

  voltar: {
    marginBottom: 30,
  },

  voltarTexto: {
    fontSize: 16,
    color: '#222',
    fontWeight: '600',
  },

  titulo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111',
  },

  subtitulo: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 21,
    color: '#666',
  },

  localizacao: {
    marginTop: 30,
    padding: 18,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
  },

  localizacaoTitulo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },

  coordenadas: {
    marginTop: 7,
    fontSize: 13,
    color: '#666',
  },

  label: {
    marginTop: 28,
    marginBottom: 8,
    fontSize: 15,
    fontWeight: '600',
    color: '#222',
  },

  input: {
    height: 55,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    fontSize: 16,
    color: '#111',
    backgroundColor: '#fff',
  },

  botao: {
    height: 55,
    marginTop: 20,
    borderRadius: 12,
    backgroundColor: '#111',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoTexto: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
});

*/