import Constants from 'expo-constants';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';

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
      text?: { text?: string };
      structuredFormat?: {
        mainText?: { text?: string };
        secondaryText?: { text?: string };
      };
    };
  }>;
};

type PlaceDetailsResponse = {
  id?: string;
  formattedAddress?: string;
  displayName?: { text?: string };
  location?: {
    latitude?: number;
    longitude?: number;
  };
};

type EnderecoSelecionado = {
  endereco: string;
  latitude: number;
  longitude: number;
};

export default function SolicitarCorrida() {
  const params = useLocalSearchParams<{
    latitude: string;
    longitude: string;
  }>();

  const googleMapsApiKey =
    Constants.expoConfig?.extra?.googleMapsApiKey;

  // ORIGEM
  const [textoOrigem, setTextoOrigem] = useState('');
  const [sugestoesOrigem, setSugestoesOrigem] = useState<Sugestao[]>([]);
  const [buscandoOrigem, setBuscandoOrigem] = useState(false);
  const [carregandoDetalhesOrigem, setCarregandoDetalhesOrigem] =
    useState(false);
  const [origemSelecionada, setOrigemSelecionada] = useState(false);
  const [origem, setOrigem] = useState<EnderecoSelecionado | null>(null);

  // DESTINO
  const [textoDestino, setTextoDestino] = useState('');
  const [sugestoesDestino, setSugestoesDestino] = useState<Sugestao[]>([]);
  const [buscandoDestino, setBuscandoDestino] = useState(false);
  const [carregandoDetalhesDestino, setCarregandoDetalhesDestino] =
    useState(false);
  const [destinoSelecionado, setDestinoSelecionado] = useState(false);
  const [destino, setDestino] = useState<EnderecoSelecionado | null>(null);

  const [usandoLocalizacaoDestino, setUsandoLocalizacaoDestino] =
    useState(false);
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(false);
  const [carregando, setCarregando] = useState(false);

  const timeoutOrigem = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timeoutDestino = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Evita que uma resposta antiga substitua os resultados de uma busca nova.
  const requisicaoOrigem = useRef(0);
  const requisicaoDestino = useRef(0);

  function voltar() {
    router.back();
  }

  function cancelarTimeouts() {
    if (timeoutOrigem.current) clearTimeout(timeoutOrigem.current);
    if (timeoutDestino.current) clearTimeout(timeoutDestino.current);
  }

  async function buscarSugestoes(
    texto: string,
    tipo: 'origem' | 'destino',
  ) {
    const numeroRequisicao =
      tipo === 'origem'
        ? ++requisicaoOrigem.current
        : ++requisicaoDestino.current;

    const setSugestoes =
      tipo === 'origem' ? setSugestoesOrigem : setSugestoesDestino;

    const setBuscando =
      tipo === 'origem' ? setBuscandoOrigem : setBuscandoDestino;

    if (!googleMapsApiKey) {
      Alert.alert(
        'Erro',
        'A chave da API do Google Maps não foi encontrada.',
      );
      return;
    }

    if (texto.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    const latitude = Number(params.latitude);
    const longitude = Number(params.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      Alert.alert(
        'Localização',
        'Não foi possível identificar sua localização atual.',
      );
      return;
    }

    try {
      setBuscando(true);

      const response = await fetch(
        'https://places.googleapis.com/v1/places:autocomplete',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': googleMapsApiKey,
            'X-Goog-FieldMask':
              'suggestions.placePrediction.placeId,' +
              'suggestions.placePrediction.text,' +
              'suggestions.placePrediction.structuredFormat',
          },
          body: JSON.stringify({
            input: texto,
            languageCode: 'pt-BR',
            includedRegionCodes: ['br'],
            origin: { latitude, longitude },
          }),
        },
      );

      const resultado: AutocompleteResponse = await response.json();

      if (!response.ok) {
        console.error('Erro Autocomplete:', resultado);

        if (
          tipo === 'origem'
            ? numeroRequisicao === requisicaoOrigem.current
            : numeroRequisicao === requisicaoDestino.current
        ) {
          setSugestoes([]);
        }
        return;
      }

      const lista: Sugestao[] = (resultado.suggestions ?? [])
        .map((item) => {
          const prediction = item.placePrediction;

          if (!prediction?.placeId) return null;

          const descricao = prediction.text?.text ?? '';

          return {
            placeId: prediction.placeId,
            descricao,
            principal:
              prediction.structuredFormat?.mainText?.text ?? descricao,
            secundario:
              prediction.structuredFormat?.secondaryText?.text ?? '',
          };
        })
        .filter((item): item is Sugestao => item !== null);

      const requisicaoAtual =
        tipo === 'origem'
          ? numeroRequisicao === requisicaoOrigem.current
          : numeroRequisicao === requisicaoDestino.current;

      if (requisicaoAtual) setSugestoes(lista);
    } catch (error) {
      console.error(`Erro ao buscar ${tipo}:`, error);

      if (
        tipo === 'origem'
          ? numeroRequisicao === requisicaoOrigem.current
          : numeroRequisicao === requisicaoDestino.current
      ) {
        setSugestoes([]);
      }
    } finally {
      const requisicaoAtual =
        tipo === 'origem'
          ? numeroRequisicao === requisicaoOrigem.current
          : numeroRequisicao === requisicaoDestino.current;

      if (requisicaoAtual) setBuscando(false);
    }
  }

  function alterarTexto(texto: string, tipo: 'origem' | 'destino') {
    if (tipo === 'origem') {
      setTextoOrigem(texto);
      setOrigem(null);
      setOrigemSelecionada(false);
      setSugestoesOrigem([]);

      if (timeoutOrigem.current) clearTimeout(timeoutOrigem.current);

      if (texto.trim().length < 2) {
        requisicaoOrigem.current++;
        setBuscandoOrigem(false);
        return;
      }

      timeoutOrigem.current = setTimeout(() => {
        buscarSugestoes(texto, 'origem');
      }, 350);

      return;
    }

    setTextoDestino(texto);
    setDestino(null);
    setDestinoSelecionado(false);
    setUsandoLocalizacaoDestino(false);
    setSugestoesDestino([]);

    if (timeoutDestino.current) clearTimeout(timeoutDestino.current);

    if (texto.trim().length < 2) {
      requisicaoDestino.current++;
      setBuscandoDestino(false);
      return;
    }

    timeoutDestino.current = setTimeout(() => {
      buscarSugestoes(texto, 'destino');
    }, 350);
  }

  async function selecionarEndereco(
    sugestao: Sugestao,
    tipo: 'origem' | 'destino',
  ) {
    if (!googleMapsApiKey) {
      Alert.alert('Erro', 'A chave da API do Google Maps não foi encontrada.');
      return;
    }

    const setCarregandoDetalhes =
      tipo === 'origem'
        ? setCarregandoDetalhesOrigem
        : setCarregandoDetalhesDestino;

    const setSugestoes =
      tipo === 'origem' ? setSugestoesOrigem : setSugestoesDestino;

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
            'X-Goog-FieldMask':
              'id,formattedAddress,displayName,location',
          },
        },
      );

      const detalhes: PlaceDetailsResponse = await response.json();

      if (!response.ok) {
        console.error('Erro Place Details:', detalhes);
        Alert.alert('Erro', 'Não foi possível obter os detalhes desse endereço.');
        return;
      }

      const latitude = detalhes.location?.latitude;
      const longitude = detalhes.location?.longitude;
      const endereco = detalhes.formattedAddress ?? sugestao.descricao;

      if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !endereco
      ) {
        Alert.alert(
          'Erro',
          'O endereço selecionado não possui uma localização válida.',
        );
        return;
      }

      const selecionado: EnderecoSelecionado = {
        endereco,
        latitude,
        longitude,
      };

      if (tipo === 'origem') {
        setTextoOrigem(endereco);
        setOrigem(selecionado);
        setOrigemSelecionada(true);
      } else {
        setTextoDestino(endereco);
        setDestino(selecionado);
        setDestinoSelecionado(true);
        setUsandoLocalizacaoDestino(false);
      }
    } catch (error) {
      console.error(`Erro ao obter detalhes de ${tipo}:`, error);
      Alert.alert('Erro', 'Não foi possível obter os dados do endereço selecionado.');
    } finally {
      setCarregandoDetalhes(false);
    }
  }

  async function usarLocalizacaoAtualComoOrigem() {
    try {
      setCarregandoLocalizacao(true);

      const permissao =
        await Location.requestForegroundPermissionsAsync();

      if (permissao.status !== 'granted') {
        Alert.alert(
          'Permissão necessária',
          'Permita o acesso à localização para usar sua posição atual como origem.',
        );
        return;
      }

      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitude = posicao.coords.latitude;
      const longitude = posicao.coords.longitude;

      let endereco =
        `Minha localização atual (${latitude.toFixed(6)}, ${longitude.toFixed(6)})`;

      try {
        const enderecos = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (enderecos.length > 0) {
          const item = enderecos[0];

          endereco = [
            item.street,
            item.streetNumber,
            item.district,
            item.city,
            item.region,
          ]
            .filter(Boolean)
            .join(', ') || endereco;
        }
      } catch (error) {
        console.warn('Não foi possível obter o endereço do GPS:', error);
      }

      setTextoOrigem(endereco);

      setOrigem({
        endereco,
        latitude,
        longitude,
      });

      setOrigemSelecionada(true);
      setSugestoesOrigem([]);
    } catch (error) {
      console.error('Erro ao obter localização atual:', error);

      Alert.alert(
        'Localização',
        'Não foi possível obter sua localização atual. Verifique se o GPS está ativado.',
      );
    } finally {
      setCarregandoLocalizacao(false);
    }
  }

  function continuar() {
    if (!origem || !origemSelecionada) {
      Alert.alert('Origem', 'Selecione um endereço de origem na lista de sugestões.');
      return;
    }

    if (!destino || !destinoSelecionado) {
      Alert.alert('Destino', 'Selecione um endereço de destino ou use sua localização atual.');
      return;
    }

    if (carregando) return;

    setCarregando(true);

    cancelarTimeouts();

    router.push({
      pathname: '/confirmar-corrida',
      params: {
        // Endereço textual da origem e suas coordenadas.
        origem: origem.endereco,
        latitude: String(origem.latitude),
        longitude: String(origem.longitude),

        // Endereço textual do destino e suas coordenadas.
        destino: destino.endereco,
        destino_latitude: String(destino.latitude),
        destino_longitude: String(destino.longitude),

        usando_localizacao_destino: usandoLocalizacaoDestino ? '1' : '0',
      },
    });

    setCarregando(false);
  }

  useEffect(() => {
    return () => cancelarTimeouts();
  }, []);

  const detalhesOrigem = carregandoDetalhesOrigem;
  const detalhesDestino = carregandoDetalhesDestino;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.cabecalho}>
        <TouchableOpacity style={styles.botaoVoltar} onPress={voltar}>
          <Text style={styles.botaoVoltarTexto}>←</Text>
        </TouchableOpacity>

        <Text style={styles.cabecalhoTitulo}>Solicitar corrida</Text>

        <View style={styles.espacoCabecalho} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.conteudo}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.titulo}>De onde e para onde?</Text>

        <Text style={styles.subtitulo}>
          Informe a origem e o destino da sua corrida. Você também pode usar sua
          localização atual como destino.
        </Text>

        {/* ORIGEM */}
        <View style={styles.enderecoContainer}>
          <Text style={styles.label}>Origem</Text>

          <TextInput
            style={styles.input}
            value={textoOrigem}
            onChangeText={(texto) => alterarTexto(texto, 'origem')}
            placeholder="Digite o endereço de partida"
            placeholderTextColor="#888"
            autoCorrect={false}
            returnKeyType="search"
          />

          {buscandoOrigem && (
            <View style={styles.carregandoBusca}>
              <ActivityIndicator size="small" />
              <Text style={styles.carregandoTexto}>Buscando endereços...</Text>
            </View>
          )}

          {detalhesOrigem && (
            <View style={styles.carregandoBusca}>
              <ActivityIndicator size="small" />
              <Text style={styles.carregandoTexto}>Obtendo localização...</Text>
            </View>
          )}

          {sugestoesOrigem.length > 0 && (
            <View style={styles.lista}>
              {sugestoesOrigem.map((sugestao, index) => (
                <React.Fragment key={sugestao.placeId}>
                  <TouchableOpacity
                    style={styles.linhaResultado}
                    activeOpacity={0.7}
                    onPress={() => selecionarEndereco(sugestao, 'origem')}
                  >
                    <View style={styles.iconeSugestao}>
                      <Text>📍</Text>
                    </View>

                    <View style={styles.textosSugestao}>
                      <Text style={styles.descricaoResultado} numberOfLines={1}>
                        {sugestao.principal}
                      </Text>

                      {!!sugestao.secundario && (
                        <Text
                          style={styles.secundarioResultado}
                          numberOfLines={2}
                        >
                          {sugestao.secundario}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {index < sugestoesOrigem.length - 1 && (
                    <View style={styles.separador} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          {origem && origemSelecionada && (
            <View style={styles.enderecoSelecionado}>
              <Text style={styles.enderecoSelecionadoTitulo}>
                ✓ Origem selecionada
              </Text>
              <Text style={styles.enderecoSelecionadoTexto}>
                {origem.endereco}
              </Text>
              <Text style={styles.coordenadas}>
                {origem.latitude.toFixed(6)}, {origem.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        {/* DESTINO */}
        <View style={styles.enderecoContainer}>
          <Text style={styles.label}>Destino</Text>

          <TextInput
            style={styles.input}
            value={textoDestino}
            onChangeText={(texto) => alterarTexto(texto, 'destino')}
            placeholder="Digite o endereço de destino"
            placeholderTextColor="#888"
            autoCorrect={false}
            returnKeyType="search"
          />

          {buscandoDestino && (
            <View style={styles.carregandoBusca}>
              <ActivityIndicator size="small" />
              <Text style={styles.carregandoTexto}>Buscando endereços...</Text>
            </View>
          )}

          {detalhesDestino && (
            <View style={styles.carregandoBusca}>
              <ActivityIndicator size="small" />
              <Text style={styles.carregandoTexto}>Obtendo localização...</Text>
            </View>
          )}

          {sugestoesDestino.length > 0 && (
            <View style={styles.lista}>
              {sugestoesDestino.map((sugestao, index) => (
                <React.Fragment key={sugestao.placeId}>
                  <TouchableOpacity
                    style={styles.linhaResultado}
                    activeOpacity={0.7}
                    onPress={() => selecionarEndereco(sugestao, 'destino')}
                  >
                    <View style={styles.iconeSugestao}>
                      <Text>📍</Text>
                    </View>

                    <View style={styles.textosSugestao}>
                      <Text style={styles.descricaoResultado} numberOfLines={1}>
                        {sugestao.principal}
                      </Text>

                      {!!sugestao.secundario && (
                        <Text
                          style={styles.secundarioResultado}
                          numberOfLines={2}
                        >
                          {sugestao.secundario}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>

                  {index < sugestoesDestino.length - 1 && (
                    <View style={styles.separador} />
                  )}
                </React.Fragment>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.botaoLocalizacao}
            onPress={usarLocalizacaoAtualComoOrigem}
            disabled={carregandoLocalizacao}
            activeOpacity={0.8}
          >
            {carregandoLocalizacao ? (
              <ActivityIndicator color="#087F5B" />
            ) : (
              <Text style={styles.botaoLocalizacaoTexto}>
                ◎ Usar minha localização atual como destino
              </Text>
            )}
          </TouchableOpacity>

          {destino && destinoSelecionado && (
            <View style={styles.enderecoSelecionado}>
              <Text style={styles.enderecoSelecionadoTitulo}>
                ✓ {usandoLocalizacaoDestino
                  ? 'Localização atual definida como destino'
                  : 'Destino selecionado'}
              </Text>
              <Text style={styles.enderecoSelecionadoTexto}>
                {destino.endereco}
              </Text>
              <Text style={styles.coordenadas}>
                {destino.latitude.toFixed(6)}, {destino.longitude.toFixed(6)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.infoIcone}>ℹ️</Text>
          <Text style={styles.infoTexto}>
            Para a origem e o destino, selecione uma sugestão válida ou utilize
            o botão de localização atual no destino. Confira os endereços antes
            de continuar.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.rodape}>
        <TouchableOpacity
          style={[
            styles.botaoContinuar,
            (!origemSelecionada || !destinoSelecionado) &&
              styles.botaoContinuarDesabilitado,
          ]}
          onPress={continuar}
          disabled={
            !origemSelecionada ||
            !destinoSelecionado ||
            carregando ||
            carregandoLocalizacao ||
            carregandoDetalhesOrigem ||
            carregandoDetalhesDestino
          }
        >
          {carregando ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.botaoContinuarTexto}>Continuar</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.botaoCancelar} onPress={voltar}>
          <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { flex: 1 },

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
  botaoVoltarTexto: { fontSize: 30, color: '#111', fontWeight: '400' },
  cabecalhoTitulo: { fontSize: 18, fontWeight: 'bold', color: '#111' },
  espacoCabecalho: { width: 42 },

  conteudo: { padding: 22, paddingBottom: 30 },
  titulo: { fontSize: 25, fontWeight: 'bold', color: '#111' },
  subtitulo: {
    marginTop: 8,
    marginBottom: 20,
    fontSize: 14,
    lineHeight: 20,
    color: '#666',
  },

  enderecoContainer: { marginTop: 15, zIndex: 10 },
  label: { marginBottom: 8, fontSize: 15, fontWeight: 'bold', color: '#111' },
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
  carregandoTexto: { marginLeft: 8, fontSize: 13, color: '#666' },

  lista: {
    marginTop: 5,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
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
  textosSugestao: { flex: 1, marginLeft: 8 },
  descricaoResultado: { fontSize: 15, color: '#222', fontWeight: '600' },
  secundarioResultado: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: '#777',
  },
  separador: { height: 1, backgroundColor: '#eee' },

  enderecoSelecionado: {
    marginTop: 10,
    padding: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#B7E4D3',
    backgroundColor: '#F0FAF6',
  },
  enderecoSelecionadoTitulo: {
    fontSize: 13,
    color: '#087F5B',
    fontWeight: 'bold',
  },
  enderecoSelecionadoTexto: {
    marginTop: 5,
    fontSize: 14,
    lineHeight: 20,
    color: '#222',
    fontWeight: '600',
  },
  coordenadas: { marginTop: 5, fontSize: 11, color: '#777' },

  botaoLocalizacao: {
    minHeight: 46,
    marginTop: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#B7E4D3',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0FAF6',
  },
  botaoLocalizacaoTexto: {
    color: '#087F5B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  info: {
    flexDirection: 'row',
    marginTop: 22,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  infoIcone: { fontSize: 16 },
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
  botaoContinuarDesabilitado: { opacity: 0.4 },
  botaoContinuarTexto: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  botaoCancelar: {
    height: 45,
    marginTop: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  botaoCancelarTexto: { color: '#555', fontSize: 14, fontWeight: '600' },
});