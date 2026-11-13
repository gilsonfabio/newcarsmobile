
import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Alert,
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

import * as Location from 'expo-location';

import { api } from '../services/api';

type ModalidadePagamento = 'PRESENCIAL' | 'ONLINE';

type FormaPagamento = 'DINHEIRO' | 'PIX' | 'CARTAO';

type OpcaoVeiculo = {
  cotacao_id: string;
  categoria_veiculo_id: string;
  nome: string;
  descricao?: string | null;
  capacidade_passageiros: number;
  distancia_metros?: number;
  duracao_estimada_segundos?: number;
  valor_estimado: number | string;
};

type Estimativa = {
  distancia_metros: number;
  duracao_estimada_segundos: number;
  opcoes: OpcaoVeiculo[];
};

export default function ConfirmarCorrida() {
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    origem?: string;
    destino?: string;
    destino_latitude?: string;
    destino_longitude?: string;
  }>();

  const origemLatitude = Number(params.latitude);
  const origemLongitude = Number(params.longitude);

  const destinoLatitude = Number(params.destino_latitude);
  const destinoLongitude = Number(params.destino_longitude);

  const destino = params.destino ?? '';

  const [origemEndereco, setOrigemEndereco] =
    useState((params.origem ?? '').trim());

  const [estimativa, setEstimativa] =
    useState<Estimativa | null>(null);

  const [
    categoriaSelecionada,
    setCategoriaSelecionada,
  ] = useState<string | null>(null);

  const [carregandoEstimativa, setCarregandoEstimativa] =
    useState(true);

  const [confirmando, setConfirmando] =
    useState(false);

  // Forma inicial de pagamento
  const [modalidade, setModalidade] =
    useState<ModalidadePagamento>('PRESENCIAL');

  const [formaPagamento, setFormaPagamento] =
    useState<FormaPagamento>('DINHEIRO');

  /*
   * Obtém endereço da origem quando necessário.
   */
  useEffect(() => {
    let ativo = true;

    const resolverEnderecoOrigem = async () => {
      const origemInformada =
        typeof params.origem === 'string'
          ? params.origem.trim()
          : '';

      if (origemInformada) {
        setOrigemEndereco(origemInformada);
        return;
      }

      if (
        !Number.isFinite(origemLatitude) ||
        !Number.isFinite(origemLongitude) ||
        origemLatitude < -90 ||
        origemLatitude > 90 ||
        origemLongitude < -180 ||
        origemLongitude > 180
      ) {
        setOrigemEndereco('');
        return;
      }

      try {
        const resultados = await Location.reverseGeocodeAsync({
          latitude: origemLatitude,
          longitude: origemLongitude,
        });

        const endereco = resultados[0];

        const textoEndereco = endereco
          ? [
              endereco.street,
              endereco.streetNumber,
              endereco.district,
              endereco.city,
              endereco.region,
              endereco.postalCode,
              endereco.country,
            ]
                .filter(Boolean)
                .join(', ')
          : '';

        if (ativo) {
          setOrigemEndereco(
            textoEndereco ||
              `Localização atual (${origemLatitude.toFixed(6)}, ${origemLongitude.toFixed(6)})`
          );
        }
      } catch (error) {
        console.warn(
          'Erro ao obter endereço da origem:',
          error
        );

        if (ativo) {
          setOrigemEndereco(
            `Localização atual (${origemLatitude.toFixed(6)}, ${origemLongitude.toFixed(6)})`
          );
        }
      }
    };

    resolverEnderecoOrigem();

    return () => {
      ativo = false;
    };
  }, [
    params.origem,
    origemLatitude,
    origemLongitude,
  ]);

  /*
   * Formata distância.
   */
  const formatarDistancia = (metros: number) => {
    if (!Number.isFinite(metros)) {
      return '0 km';
    }

    return `${(metros / 1000)
      .toFixed(1)
      .replace('.', ',')} km`;
  };

  /*
   * Formata duração.
   */
  const formatarDuracao = (segundos: number) => {
    if (!Number.isFinite(segundos)) {
      return '0 min';
    }

    const minutos = Math.ceil(segundos / 60);

    if (minutos < 60) {
      return `${minutos} min`;
    }

    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;

    return minutosRestantes === 0
      ? `${horas}h`
      : `${horas}h ${minutosRestantes}min`;
  };

  /*
   * Formata valor monetário.
   */
  const formatarValor = (valor: number | string) => {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return 'R$ 0,00';
    }

    return numero.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  /*
   * Busca estimativa no backend.
   */
  const carregarEstimativa = useCallback(async () => {
    if (
      !Number.isFinite(origemLatitude) ||
      !Number.isFinite(origemLongitude) ||
      !Number.isFinite(destinoLatitude) ||
      !Number.isFinite(destinoLongitude) ||
      origemLatitude < -90 ||
      origemLatitude > 90 ||
      origemLongitude < -180 ||
      origemLongitude > 180 ||
      destinoLatitude < -90 ||
      destinoLatitude > 90 ||
      destinoLongitude < -180 ||
      destinoLongitude > 180 ||
      !destino.trim()
    ) {
      Alert.alert(
        'Dados inválidos',
        'Não foi possível identificar corretamente a origem e o destino.'
      );

      setCarregandoEstimativa(false);
      return;
    }

    try {
      setCarregandoEstimativa(true);

      const response = await api.post(
        '/corridas/estimativa',
        {
          origem: (params.origem ?? '').trim() || undefined,
          origem_latitude: origemLatitude,
          origem_longitude: origemLongitude,
          destino_latitude: destinoLatitude,
          destino_longitude: destinoLongitude,
          destino,
        }
      );

      const dados: Estimativa | undefined =
        response.data;

      if (
        !dados ||
        !Array.isArray(dados.opcoes)
      ) {
        throw new Error(
          'Resposta inválida recebida do servidor.'
        );
      }

      const opcoesValidas = dados.opcoes.every(
        opcao =>
          typeof opcao.cotacao_id === 'string' &&
          opcao.cotacao_id.length > 0
      );

      if (!opcoesValidas) {
        throw new Error(
          'O servidor não retornou o identificador da cotação para todas as categorias.'
        );
      }

      setEstimativa(dados);

      if (dados.opcoes.length > 0) {
        setCategoriaSelecionada(
          dados.opcoes[0].categoria_veiculo_id
        );
      } else {
        setCategoriaSelecionada(null);
      }

    } catch (error: any) {
      console.error(
        'Erro ao carregar estimativa:',
        error?.response?.data || error
      );

      const mensagem =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.message ||
        'Não foi possível calcular a estimativa da corrida.';

      Alert.alert('Erro', mensagem);

      setEstimativa(null);
      setCategoriaSelecionada(null);

    } finally {
      setCarregandoEstimativa(false);
    }
  }, [
    origemLatitude,
    origemLongitude,
    destinoLatitude,
    destinoLongitude,
    destino,
    params.origem,
  ]);

  useEffect(() => {
    carregarEstimativa();
  }, [carregarEstimativa]);

  /*
   * Altera modalidade de pagamento.
   *
   * Dinheiro só pode ser presencial.
   */
  const selecionarModalidade = (
    novaModalidade: ModalidadePagamento
  ) => {
    setModalidade(novaModalidade);

    if (
      novaModalidade === 'ONLINE' &&
      formaPagamento === 'DINHEIRO'
    ) {
      setFormaPagamento('PIX');
    }
  };

  /*
   * Confirma corrida e registra pagamento.
   */
  const confirmarCorrida = async () => {
    if (!estimativa) {
      Alert.alert(
        'Atenção',
        'A estimativa da corrida ainda não foi carregada.'
      );
      return;
    }

    if (!categoriaSelecionada) {
      Alert.alert(
        'Atenção',
        'Selecione uma categoria de veículo.'
      );
      return;
    }

    const opcao = estimativa.opcoes.find(
      item =>
        item.categoria_veiculo_id === categoriaSelecionada
    );

    if (!opcao) {
      Alert.alert(
        'Atenção',
        'A categoria selecionada não está mais disponível.'
      );
      return;
    }

    if (!opcao.cotacao_id) {
      Alert.alert(
        'Erro',
        'A cotação desta categoria não foi identificada. Atualize a estimativa.'
      );
      return;
    }

    if (
      modalidade === 'ONLINE' &&
      formaPagamento === 'DINHEIRO'
    ) {
      Alert.alert(
        'Forma de pagamento inválida',
        'Dinheiro só está disponível para pagamento presencial.'
      );
      return;
    }

    try {
      setConfirmando(true);

      console.log('=================================');
      console.log('CONFIRMANDO CORRIDA');
      console.log('Categoria:', opcao.nome);
      console.log('Cotação:', opcao.cotacao_id);
      console.log('Valor:', opcao.valor_estimado);
      console.log('Modalidade:', modalidade);
      console.log('Forma de pagamento:', formaPagamento);
      console.log('=================================');

      /*
       * O preço não é enviado pelo aplicativo.
       * O backend recupera o valor da cotação.
       */
      const response = await api.post(
        '/corridas',
        {
          cotacao_id: opcao.cotacao_id,
          modalidade,
          forma_pagamento: formaPagamento,
        }
      );

      console.log('=================================');
      console.log('CORRIDA CRIADA');
      console.log(response.data);
      console.log('=================================');

      const valorConfirmado =
        response.data?.corrida?.valor_estimado ??
        opcao.valor_estimado;

      const mensagemPagamento =
        modalidade === 'ONLINE'
          ? 'O pagamento foi registrado como pendente. A cobrança online será disponibilizada após a integração com o gateway.'
          : 'O pagamento será confirmado pelo motorista após o recebimento.';

      Alert.alert(
        'Corrida solicitada',
        `Sua corrida foi solicitada com sucesso.\n\nValor: ${formatarValor(valorConfirmado)}\nPagamento: ${formaPagamento}\nModalidade: ${modalidade}\n\n${mensagemPagamento}`,
        [
          {
            text: 'OK',
            onPress: () => {
              router.replace('/cliente');
            },
          },
        ]
      );

    } catch (error: any) {
      console.error(
        'Erro ao confirmar corrida:',
        error?.response?.data || error
      );

      const mensagem =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Não foi possível solicitar a corrida.';

      Alert.alert('Erro', mensagem);

    } finally {
      setConfirmando(false);
    }
  };

  /*
   * Carregando estimativa.
   */
  if (carregandoEstimativa) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color="#2563eb"
        />

        <Text style={styles.loadingTitle}>
          Calculando sua corrida...
        </Text>

        <Text style={styles.loadingText}>
          Estamos calculando a distância,
          duração e valores disponíveis.
        </Text>
      </View>
    );
  }

  /*
   * Erro na estimativa.
   */
  if (!estimativa) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>
          Não foi possível calcular a corrida
        </Text>

        <Text style={styles.errorText}>
          Verifique o destino e tente novamente.
        </Text>

        <TouchableOpacity
          style={styles.retryButton}
          onPress={carregarEstimativa}
        >
          <Text style={styles.retryButtonText}>
            Tentar novamente
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const opcaoSelecionada = estimativa.opcoes.find(
    opcao =>
      opcao.categoria_veiculo_id === categoriaSelecionada
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* CABEÇALHO */}

        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBack}
            onPress={() => router.back()}
          >
            <Text style={styles.headerBackText}>
              ‹
            </Text>
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>
              Confirmar corrida
            </Text>

            <Text style={styles.headerSubtitle}>
              Escolha seu veículo e pagamento
            </Text>
          </View>
        </View>

        {/* ORIGEM */}

        <View style={styles.originCard}>
          <Text style={styles.originLabel}>
            ORIGEM
          </Text>

          <Text
            style={styles.originText}
            numberOfLines={3}
          >
            {origemEndereco ||
              'Obtendo endereço da localização atual...'}
          </Text>
        </View>

        {/* DESTINO */}

        <View style={styles.destinationCard}>
          <Text style={styles.destinationLabel}>
            DESTINO
          </Text>

          <Text
            style={styles.destinationText}
            numberOfLines={3}
          >
            {destino}
          </Text>
        </View>

        {/* RESUMO DA ROTA */}

        <View style={styles.routeSummary}>
          <View style={styles.routeSummaryItem}>
            <Text style={styles.routeSummaryLabel}>
              Distância
            </Text>

            <Text style={styles.routeSummaryValue}>
              {formatarDistancia(
                estimativa.distancia_metros
              )}
            </Text>
          </View>

          <View style={styles.separator} />

          <View style={styles.routeSummaryItem}>
            <Text style={styles.routeSummaryLabel}>
              Tempo estimado
            </Text>

            <Text style={styles.routeSummaryValue}>
              {formatarDuracao(
                estimativa.duracao_estimada_segundos
              )}
            </Text>
          </View>
        </View>

        {/* CATEGORIAS */}

        <Text style={styles.sectionTitle}>
          Escolha uma categoria
        </Text>

        {estimativa.opcoes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              Nenhuma categoria disponível
            </Text>

            <Text style={styles.emptyText}>
              Não existem categorias de veículos
              disponíveis no momento.
            </Text>
          </View>
        ) : (
          estimativa.opcoes.map(opcao => {
            const selecionada =
              opcao.categoria_veiculo_id === categoriaSelecionada;

            return (
              <TouchableOpacity
                key={opcao.cotacao_id}
                style={[
                  styles.vehicleCard,
                  selecionada &&
                    styles.vehicleCardSelected,
                ]}
                activeOpacity={0.8}
                onPress={() =>
                  setCategoriaSelecionada(
                    opcao.categoria_veiculo_id
                  )
                }
              >
                <View
                  style={[
                    styles.vehicleIcon,
                    selecionada &&
                      styles.vehicleIconSelected,
                  ]}
                >
                  <Text style={styles.vehicleIconText}>
                    🚗
                  </Text>
                </View>

                <View style={styles.vehicleInfo}>
                  <View style={styles.vehicleNameRow}>
                    <Text style={styles.vehicleName}>
                      {opcao.nome}
                    </Text>

                    {selecionada && (
                      <View style={styles.selectedBadge}>
                        <Text style={styles.selectedBadgeText}>
                          Selecionado
                        </Text>
                      </View>
                    )}
                  </View>

                  {opcao.descricao ? (
                    <Text
                      style={styles.vehicleDescription}
                      numberOfLines={2}
                    >
                      {opcao.descricao}
                    </Text>
                  ) : null}

                  <Text style={styles.capacityText}>
                    Até {opcao.capacidade_passageiros}{' '}
                    passageiro
                    {opcao.capacidade_passageiros !== 1
                      ? 's'
                      : ''}
                  </Text>
                </View>

                <View style={styles.vehiclePriceContainer}>
                  <Text style={styles.vehiclePrice}>
                    {formatarValor(opcao.valor_estimado)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* RESUMO DA ESCOLHA */}

        {opcaoSelecionada && (
          <View style={styles.selectedSummary}>
            <View>
              <Text style={styles.selectedSummaryLabel}>
                Sua escolha
              </Text>

              <Text style={styles.selectedSummaryVehicle}>
                {opcaoSelecionada.nome}
              </Text>
            </View>

            <Text style={styles.selectedSummaryPrice}>
              {formatarValor(
                opcaoSelecionada.valor_estimado
              )}
            </Text>
          </View>
        )}

        {/* MODALIDADE DE PAGAMENTO */}

        <Text style={styles.sectionTitle}>
          Como deseja pagar?
        </Text>

        <View style={styles.paymentOptionsRow}>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              modalidade === 'PRESENCIAL' &&
                styles.paymentOptionSelected,
            ]}
            activeOpacity={0.8}
            onPress={() =>
              selecionarModalidade('PRESENCIAL')
            }
          >
            <Text style={styles.paymentOptionIcon}>
              🚘
            </Text>

            <Text
              style={[
                styles.paymentOptionTitle,
                modalidade === 'PRESENCIAL' &&
                  styles.paymentOptionTitleSelected,
              ]}
            >
              Presencial
            </Text>

            <Text style={styles.paymentOptionDescription}>
              Pague ao motorista
            </Text>

            {modalidade === 'PRESENCIAL' && (
              <Text style={styles.paymentSelectedMark}>
                ✓ Selecionado
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentOption,
              modalidade === 'ONLINE' &&
                styles.paymentOptionSelected,
            ]}
            activeOpacity={0.8}
            onPress={() =>
              selecionarModalidade('ONLINE')
            }
          >
            <Text style={styles.paymentOptionIcon}>
              📱
            </Text>

            <Text
              style={[
                styles.paymentOptionTitle,
                modalidade === 'ONLINE' &&
                  styles.paymentOptionTitleSelected,
              ]}
            >
              Online
            </Text>

            <Text style={styles.paymentOptionDescription}>
              Pagamento digital
            </Text>

            {modalidade === 'ONLINE' && (
              <Text style={styles.paymentSelectedMark}>
                ✓ Selecionado
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* FORMA DE PAGAMENTO */}

        <Text style={styles.paymentSubtitle}>
          Forma de pagamento
        </Text>

        <View style={styles.paymentMethods}>
          {modalidade === 'PRESENCIAL' && (
            <TouchableOpacity
              style={[
                styles.paymentMethod,
                formaPagamento === 'DINHEIRO' &&
                  styles.paymentMethodSelected,
              ]}
              onPress={() =>
                setFormaPagamento('DINHEIRO')
              }
            >
              <Text style={styles.paymentMethodIcon}>
                💵
              </Text>

              <Text
                style={[
                  styles.paymentMethodText,
                  formaPagamento === 'DINHEIRO' &&
                    styles.paymentMethodTextSelected,
                ]}
              >
                Dinheiro
              </Text>

              {formaPagamento === 'DINHEIRO' && (
                <Text style={styles.paymentCheck}>
                  ✓
                </Text>
              )}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[
              styles.paymentMethod,
              formaPagamento === 'PIX' &&
                styles.paymentMethodSelected,
            ]}
            onPress={() =>
              setFormaPagamento('PIX')
            }
          >
            <Text style={styles.paymentMethodIcon}>
              ⚡
            </Text>

            <Text
              style={[
                styles.paymentMethodText,
                formaPagamento === 'PIX' &&
                  styles.paymentMethodTextSelected,
              ]}
            >
              PIX
            </Text>

            {formaPagamento === 'PIX' && (
              <Text style={styles.paymentCheck}>
                ✓
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.paymentMethod,
              formaPagamento === 'CARTAO' &&
                styles.paymentMethodSelected,
            ]}
            onPress={() =>
              setFormaPagamento('CARTAO')
            }
          >
            <Text style={styles.paymentMethodIcon}>
              💳
            </Text>

            <Text
              style={[
                styles.paymentMethodText,
                formaPagamento === 'CARTAO' &&
                  styles.paymentMethodTextSelected,
              ]}
            >
              Cartão
            </Text>

            {formaPagamento === 'CARTAO' && (
              <Text style={styles.paymentCheck}>
                ✓
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* AVISO SOBRE PAGAMENTO */}

        <View style={styles.paymentNotice}>
          <Text style={styles.paymentNoticeTitle}>
            {modalidade === 'PRESENCIAL'
              ? 'Pagamento ao motorista'
              : 'Pagamento online'}
          </Text>

          <Text style={styles.paymentNoticeText}>
            {modalidade === 'PRESENCIAL'
              ? formaPagamento === 'DINHEIRO'
                ? 'Você pagará em dinheiro diretamente ao motorista. Ele confirmará o recebimento.'
                : formaPagamento === 'PIX'
                  ? 'Você pagará via PIX ao motorista. Ele deverá verificar o recebimento antes de confirmar.'
                  : 'Você pagará utilizando a maquininha do motorista. Ele confirmará o recebimento.'
              : 'O pagamento será registrado como pendente. A cobrança online por PIX ou cartão será ativada após a integração com o gateway de pagamento.'}
          </Text>
        </View>

        {/* CONFIRMAR */}

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (
              !categoriaSelecionada ||
              confirmando ||
              estimativa.opcoes.length === 0
            ) && styles.confirmButtonDisabled,
          ]}
          disabled={
            !categoriaSelecionada ||
            confirmando ||
            estimativa.opcoes.length === 0
          }
          onPress={confirmarCorrida}
        >
          {confirmando ? (
            <ActivityIndicator
              size="small"
              color="#fff"
            />
          ) : (
            <Text style={styles.confirmButtonText}>
              Confirmar corrida
            </Text>
          )}
        </TouchableOpacity>

        <Text style={styles.infoText}>
          O valor apresentado é o valor confirmado
          da sua corrida. Ele não será aumentado
          após a solicitação.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#f8fafc',
  },

  loadingTitle: {
    marginTop: 18,
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },

  loadingText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
    color: '#64748b',
    textAlign: 'center',
  },

  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
  },

  errorText: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 21,
    color: '#64748b',
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 25,
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },

  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  backButton: {
    marginTop: 12,
    width: '100%',
    maxWidth: 320,
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    justifyContent: 'center',
    alignItems: 'center',
  },

  backButtonText: {
    color: '#334155',
    fontSize: 16,
    fontWeight: '600',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },

  headerBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },

  headerBackText: {
    fontSize: 32,
    lineHeight: 34,
    color: '#0f172a',
    marginTop: -3,
  },

  headerTitleContainer: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
  },

  headerSubtitle: {
    marginTop: 3,
    fontSize: 14,
    color: '#64748b',
  },

  originCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 14,
  },

  originLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#15803d',
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  originText: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    color: '#14532d',
  },

  destinationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 14,
  },

  destinationLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    letterSpacing: 0.8,
    marginBottom: 7,
  },

  destinationText: {
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
    color: '#0f172a',
  },

  routeSummary: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 17,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 25,
  },

  routeSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },

  routeSummaryLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 5,
  },

  routeSummaryValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },

  separator: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },

  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 15,
    marginBottom: 12,
  },

  vehicleCardSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },

  vehicleIcon: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 13,
  },

  vehicleIconSelected: {
    backgroundColor: '#dbeafe',
  },

  vehicleIconText: {
    fontSize: 27,
  },

  vehicleInfo: {
    flex: 1,
  },

  vehicleNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },

  vehicleName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },

  selectedBadge: {
    backgroundColor: '#2563eb',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },

  selectedBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },

  vehicleDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 17,
    color: '#64748b',
  },

  capacityText: {
    marginTop: 6,
    fontSize: 12,
    color: '#475569',
  },

  vehiclePriceContainer: {
    marginLeft: 10,
    alignItems: 'flex-end',
  },

  vehiclePrice: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0f172a',
  },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },

  emptyText: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748b',
    textAlign: 'center',
  },

  selectedSummary: {
    marginTop: 8,
    marginBottom: 25,
    padding: 17,
    borderRadius: 16,
    backgroundColor: '#0f172a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  selectedSummaryLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 3,
  },

  selectedSummaryVehicle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },

  selectedSummaryPrice: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },

  // MODALIDADE DE PAGAMENTO

  paymentOptionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },

  paymentOption: {
    flex: 1,
    minHeight: 135,
    backgroundColor: '#fff',
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    padding: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },

  paymentOptionSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },

  paymentOptionIcon: {
    fontSize: 27,
    marginBottom: 8,
  },

  paymentOptionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
  },

  paymentOptionTitleSelected: {
    color: '#1d4ed8',
  },

  paymentOptionDescription: {
    marginTop: 5,
    fontSize: 11,
    color: '#64748b',
    textAlign: 'center',
  },

  paymentSelectedMark: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '800',
    color: '#2563eb',
  },

  paymentSubtitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 10,
  },

  paymentMethods: {
    flexDirection: 'row',
    gap: 9,
    marginBottom: 15,
  },

  paymentMethod: {
    flex: 1,
    minHeight: 88,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 13,
    padding: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  paymentMethodSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },

  paymentMethodIcon: {
    fontSize: 23,
    marginBottom: 6,
  },

  paymentMethodText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },

  paymentMethodTextSelected: {
    color: '#1d4ed8',
  },

  paymentCheck: {
    position: 'absolute',
    top: 5,
    right: 7,
    fontSize: 13,
    fontWeight: '800',
    color: '#2563eb',
  },

  paymentNotice: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
    borderWidth: 1,
    borderRadius: 13,
    padding: 14,
    marginBottom: 20,
  },

  paymentNoticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9a3412',
    marginBottom: 5,
  },

  paymentNoticeText: {
    fontSize: 12,
    lineHeight: 19,
    color: '#7c2d12',
  },

  // BOTÃO DE CONFIRMAÇÃO

  confirmButton: {
    height: 56,
    borderRadius: 14,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  confirmButtonDisabled: {
    opacity: 0.5,
  },

  confirmButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },

  infoText: {
    marginTop: 14,
    paddingHorizontal: 5,
    fontSize: 11,
    lineHeight: 17,
    color: '#64748b',
    textAlign: 'center',
  },
});
