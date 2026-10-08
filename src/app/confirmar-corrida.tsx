import React, {
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

import { api } from '../services/api';

type OpcaoVeiculo = {
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
  /*
   * IMPORTANTE:
   *
   * A tela solicitar-corrida envia:
   *
   * latitude
   * longitude
   * destino
   * destino_latitude
   * destino_longitude
   *
   * Portanto usamos exatamente esses nomes aqui.
   */
  const params = useLocalSearchParams<{
    latitude?: string;
    longitude?: string;
    destino?: string;
    destino_latitude?: string;
    destino_longitude?: string;
  }>();

  /*
   * Logs para facilitar o diagnóstico caso algum
   * parâmetro não chegue corretamente.
   */
  console.log('=================================');
  console.log('PARAMETROS CONFIRMAR CORRIDA');
  console.log('latitude:', params.latitude);
  console.log('longitude:', params.longitude);
  console.log(
    'destino_latitude:',
    params.destino_latitude
  );
  console.log(
    'destino_longitude:',
    params.destino_longitude
  );
  console.log('destino:', params.destino);
  console.log('=================================');

  const origemLatitude = Number(
    params.latitude
  );

  const origemLongitude = Number(
    params.longitude
  );

  const destinoLatitude = Number(
    params.destino_latitude
  );

  const destinoLongitude = Number(
    params.destino_longitude
  );

  const destino = params.destino ?? '';

  const [estimativa, setEstimativa] =
    useState<Estimativa | null>(null);

  const [
    categoriaSelecionada,
    setCategoriaSelecionada,
  ] = useState<string | null>(null);

  const [
    carregandoEstimativa,
    setCarregandoEstimativa,
  ] = useState(true);

  const [confirmando, setConfirmando] =
    useState(false);

  /*
   * Formata distância.
   */
  const formatarDistancia = (
    metros: number
  ) => {
    if (!Number.isFinite(metros)) {
      return '0 km';
    }

    const km = metros / 1000;

    return `${km
      .toFixed(1)
      .replace('.', ',')} km`;
  };

  /*
   * Formata duração.
   */
  const formatarDuracao = (
    segundos: number
  ) => {
    if (!Number.isFinite(segundos)) {
      return '0 min';
    }

    const minutos = Math.ceil(
      segundos / 60
    );

    if (minutos < 60) {
      return `${minutos} min`;
    }

    const horas = Math.floor(
      minutos / 60
    );

    const minutosRestantes =
      minutos % 60;

    if (minutosRestantes === 0) {
      return `${horas}h`;
    }

    return `${horas}h ${minutosRestantes}min`;
  };

  /*
   * Formata valor monetário.
   */
  const formatarValor = (
    valor: number | string
  ) => {
    const numero = Number(valor);

    if (!Number.isFinite(numero)) {
      return 'R$ 0,00';
    }

    return numero.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      }
    );
  };

  /*
   * Busca a estimativa.
   */
  const carregarEstimativa =
    useCallback(async () => {
      console.log(
        '================================='
      );

      console.log(
        'VALIDANDO DADOS DA CORRIDA'
      );

      console.log(
        'origemLatitude:',
        origemLatitude
      );

      console.log(
        'origemLongitude:',
        origemLongitude
      );

      console.log(
        'destinoLatitude:',
        destinoLatitude
      );

      console.log(
        'destinoLongitude:',
        destinoLongitude
      );

      console.log(
        'destino:',
        destino
      );

      console.log(
        '================================='
      );

      /*
       * Validação.
       */
      if (
        !Number.isFinite(
          origemLatitude
        ) ||
        !Number.isFinite(
          origemLongitude
        ) ||
        !Number.isFinite(
          destinoLatitude
        ) ||
        !Number.isFinite(
          destinoLongitude
        ) ||
        !destino.trim()
      ) {
        console.error(
          'DADOS INVALIDOS PARA ESTIMATIVA'
        );

        Alert.alert(
          'Dados inválidos',
          'Não foi possível identificar corretamente a origem e o destino.'
        );

        setCarregandoEstimativa(false);

        return;
      }

      try {
        setCarregandoEstimativa(true);

        console.log(
          '================================='
        );

        console.log(
          'SOLICITANDO ESTIMATIVA'
        );

        console.log(
          'Origem:',
          origemLatitude,
          origemLongitude
        );

        console.log(
          'Destino:',
          destinoLatitude,
          destinoLongitude
        );

        console.log(
          'Endereço destino:',
          destino
        );

        console.log(
          '================================='
        );

        const response =
          await api.post(
            '/corridas/estimativa',
            {
              origem_latitude:
                origemLatitude,

              origem_longitude:
                origemLongitude,

              destino_latitude:
                destinoLatitude,

              destino_longitude:
                destinoLongitude,

              destino,
            }
          );

        console.log(
          '================================='
        );

        console.log(
          'RESPOSTA ESTIMATIVA'
        );

        console.log(
          response.data
        );

        console.log(
          '================================='
        );

        /*
         * O backend retorna diretamente:
         *
         * {
         *   distancia_metros,
         *   duracao_estimada_segundos,
         *   opcoes
         * }
         */
        const dados:
          | Estimativa
          | undefined =
          response.data;

        if (
          !dados ||
          !Array.isArray(
            dados.opcoes
          )
        ) {
          throw new Error(
            'Resposta inválida recebida do servidor.'
          );
        }

        setEstimativa(dados);

        /*
         * Seleciona automaticamente
         * a primeira categoria.
         */
        if (
          dados.opcoes.length > 0
        ) {
          setCategoriaSelecionada(
            dados.opcoes[0]
              .categoria_veiculo_id
          );
        } else {
          setCategoriaSelecionada(
            null
          );
        }
      } catch (error: any) {
        console.error(
          'Erro ao carregar estimativa:',
          error?.response?.data ||
            error
        );

        const mensagem =
          error?.response?.data
            ?.message ||
          error?.response?.data
            ?.error ||
          'Não foi possível calcular a estimativa da corrida.';

        Alert.alert(
          'Erro',
          mensagem
        );

        setEstimativa(null);

        setCategoriaSelecionada(
          null
        );
      } finally {
        setCarregandoEstimativa(
          false
        );
      }
    }, [
      origemLatitude,
      origemLongitude,
      destinoLatitude,
      destinoLongitude,
      destino,
    ]);

  useEffect(() => {
    carregarEstimativa();
  }, [carregarEstimativa]);

  /*
   * Confirma a corrida.
   *
   * O backend recalcula:
   * - distância;
   * - duração;
   * - preço.
   */
  const confirmarCorrida =
    async () => {
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

      const opcao =
        estimativa.opcoes.find(
          item =>
            item.categoria_veiculo_id ===
            categoriaSelecionada
        );

      if (!opcao) {
        Alert.alert(
          'Atenção',
          'A categoria selecionada não está mais disponível.'
        );

        return;
      }

      try {
        setConfirmando(true);

        console.log(
          '================================='
        );

        console.log(
          'CONFIRMANDO CORRIDA'
        );

        console.log(
          'Categoria:',
          opcao.nome
        );

        console.log(
          'Categoria ID:',
          opcao.categoria_veiculo_id
        );

        console.log(
          '================================='
        );

        /*
         * IMPORTANTE:
         *
         * Não enviamos preço, distância
         * ou duração.
         *
         * O backend calcula novamente
         * esses valores.
         */
        const response =
          await api.post(
            '/corridas',
            {
              origem_latitude:
                origemLatitude,

              origem_longitude:
                origemLongitude,

              destino_latitude:
                destinoLatitude,

              destino_longitude:
                destinoLongitude,

              destino,

              categoria_veiculo_id:
                opcao.categoria_veiculo_id,
            }
          );

        console.log(
          '================================='
        );

        console.log(
          'CORRIDA CRIADA'
        );

        console.log(
          response.data
        );

        console.log(
          '================================='
        );

        Alert.alert(
          'Corrida solicitada',
          'Sua corrida foi solicitada com sucesso.',
          [
            {
              text: 'OK',
              onPress: () => {
                router.replace(
                  '/cliente'
                );
              },
            },
          ]
        );
      } catch (error: any) {
        console.error(
          'Erro ao confirmar corrida:',
          error?.response?.data ||
            error
        );

        const mensagem =
          error?.response?.data
            ?.message ||
          error?.response?.data
            ?.error ||
          'Não foi possível solicitar a corrida.';

        Alert.alert(
          'Erro',
          mensagem
        );
      } finally {
        setConfirmando(false);
      }
    };

  /*
   * Carregando estimativa.
   */
  if (carregandoEstimativa) {
    return (
      <View
        style={
          styles.loadingContainer
        }
      >
        <ActivityIndicator
          size="large"
          color="#2563eb"
        />

        <Text
          style={
            styles.loadingTitle
          }
        >
          Calculando sua corrida...
        </Text>

        <Text
          style={
            styles.loadingText
          }
        >
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
      <View
        style={
          styles.loadingContainer
        }
      >
        <Text
          style={
            styles.errorTitle
          }
        >
          Não foi possível calcular a
          corrida
        </Text>

        <Text
          style={
            styles.errorText
          }
        >
          Verifique o destino e tente
          novamente.
        </Text>

        <TouchableOpacity
          style={
            styles.retryButton
          }
          onPress={
            carregarEstimativa
          }
        >
          <Text
            style={
              styles.retryButtonText
            }
          >
            Tentar novamente
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={
            styles.backButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={
              styles.backButtonText
            }
          >
            Voltar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  /*
   * Categoria selecionada.
   */
  const opcaoSelecionada =
    estimativa.opcoes.find(
      opcao =>
        opcao.categoria_veiculo_id ===
        categoriaSelecionada
    );

  return (
    <View
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* CABEÇALHO */}

        <View
          style={styles.header}
        >
          <TouchableOpacity
            style={
              styles.headerBack
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.headerBackText
              }
            >
              ‹
            </Text>
          </TouchableOpacity>

          <View
            style={
              styles.headerTitleContainer
            }
          >
            <Text
              style={
                styles.headerTitle
              }
            >
              Confirmar corrida
            </Text>

            <Text
              style={
                styles.headerSubtitle
              }
            >
              Escolha seu veículo
            </Text>
          </View>
        </View>

        {/* DESTINO */}

        <View
          style={
            styles.destinationCard
          }
        >
          <Text
            style={
              styles.destinationLabel
            }
          >
            DESTINO
          </Text>

          <Text
            style={
              styles.destinationText
            }
            numberOfLines={3}
          >
            {destino}
          </Text>
        </View>

        {/* RESUMO DA ROTA */}

        <View
          style={
            styles.routeSummary
          }
        >
          <View
            style={
              styles.routeSummaryItem
            }
          >
            <Text
              style={
                styles.routeSummaryLabel
              }
            >
              Distância
            </Text>

            <Text
              style={
                styles.routeSummaryValue
              }
            >
              {formatarDistancia(
                estimativa.distancia_metros
              )}
            </Text>
          </View>

          <View
            style={styles.separator}
          />

          <View
            style={
              styles.routeSummaryItem
            }
          >
            <Text
              style={
                styles.routeSummaryLabel
              }
            >
              Tempo estimado
            </Text>

            <Text
              style={
                styles.routeSummaryValue
              }
            >
              {formatarDuracao(
                estimativa.duracao_estimada_segundos
              )}
            </Text>
          </View>
        </View>

        {/* TÍTULO */}

        <Text
          style={styles.sectionTitle}
        >
          Escolha uma categoria
        </Text>

        {/* CATEGORIAS */}

        {estimativa.opcoes
          .length === 0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Nenhuma categoria
              disponível
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Não existem categorias de
              veículos disponíveis no
              momento.
            </Text>
          </View>
        ) : (
          estimativa.opcoes.map(
            opcao => {
              const selecionada =
                opcao.categoria_veiculo_id ===
                categoriaSelecionada;

              return (
                <TouchableOpacity
                  key={
                    opcao.categoria_veiculo_id
                  }
                  style={[
                    styles.vehicleCard,
                    selecionada &&
                      styles.vehicleCardSelected,
                  ]}
                  activeOpacity={
                    0.8
                  }
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
                    <Text
                      style={
                        styles.vehicleIconText
                      }
                    >
                      🚗
                    </Text>
                  </View>

                  <View
                    style={
                      styles.vehicleInfo
                    }
                  >
                    <View
                      style={
                        styles.vehicleNameRow
                      }
                    >
                      <Text
                        style={
                          styles.vehicleName
                        }
                      >
                        {opcao.nome}
                      </Text>

                      {selecionada && (
                        <View
                          style={
                            styles.selectedBadge
                          }
                        >
                          <Text
                            style={
                              styles.selectedBadgeText
                            }
                          >
                            Selecionado
                          </Text>
                        </View>
                      )}
                    </View>

                    {opcao.descricao ? (
                      <Text
                        style={
                          styles.vehicleDescription
                        }
                        numberOfLines={
                          2
                        }
                      >
                        {
                          opcao.descricao
                        }
                      </Text>
                    ) : null}

                    <Text
                      style={
                        styles.capacityText
                      }
                    >
                      Até{' '}
                      {
                        opcao.capacidade_passageiros
                      }{' '}
                      passageiro
                      {opcao.capacidade_passageiros !==
                      1
                        ? 's'
                        : ''}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.vehiclePriceContainer
                    }
                  >
                    <Text
                      style={
                        styles.vehiclePrice
                      }
                    >
                      {formatarValor(
                        opcao.valor_estimado
                      )}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            }
          )
        )}

        {/* RESUMO */}

        {opcaoSelecionada && (
          <View
            style={
              styles.selectedSummary
            }
          >
            <View>
              <Text
                style={
                  styles.selectedSummaryLabel
                }
              >
                Sua escolha
              </Text>

              <Text
                style={
                  styles.selectedSummaryVehicle
                }
              >
                {
                  opcaoSelecionada.nome
                }
              </Text>
            </View>

            <Text
              style={
                styles.selectedSummaryPrice
              }
            >
              {formatarValor(
                opcaoSelecionada.valor_estimado
              )}
            </Text>
          </View>
        )}

        {/* CONFIRMAR */}

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!categoriaSelecionada ||
              confirmando) &&
              styles.confirmButtonDisabled,
          ]}
          disabled={
            !categoriaSelecionada ||
            confirmando
          }
          onPress={
            confirmarCorrida
          }
        >
          {confirmando ? (
            <ActivityIndicator
              size="small"
              color="#fff"
            />
          ) : (
            <Text
              style={
                styles.confirmButtonText
              }
            >
              Confirmar corrida
            </Text>
          )}
        </TouchableOpacity>

        <Text
          style={styles.infoText}
        >
          O valor apresentado é uma
          estimativa. O valor final poderá
          variar conforme as condições da
          corrida.
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
    marginBottom: 15,
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
