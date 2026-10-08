import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from 'react-native';

import * as Location from 'expo-location';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import {
  useCallback,
  useEffect,
  useState,
  useRef
} from 'react';

import MapView, {
  Marker,
  Polyline,
  Region,
} from 'react-native-maps';

import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Localizacao {
  latitude: number;
  longitude: number;
}

interface Motorista {
    id: string;
    usuario_id: string;
    nome: string | null;
    telefone: string | null;
    latitude: number | null;
    longitude: number | null;
    status: string;
    online: number;
}

interface Corrida {
    id: string;
    cliente_id: string;

    origem_latitude: number;
    origem_longitude: number;

    destino_latitude: number;
    destino_longitude: number;

    destino: string;

    motorista_id: string | null;

    status: string;

    valor: number | null;
    valor_estimado: number | null;
    valor_final: number | null;

    motorista?: Motorista | null;
}

function decodificarPolyline(
  encoded: string
): Localizacao[] {

  const pontos: Localizacao[] = [];

  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {

    let shift = 0;
    let resultado = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;

      resultado |=
        (byte & 0x1f) << shift;

      shift += 5;

    } while (byte >= 0x20);

    const deltaLatitude =
      resultado & 1
        ? ~(resultado >> 1)
        : resultado >> 1;

    latitude += deltaLatitude;

    shift = 0;
    resultado = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      resultado |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLongitude =
      resultado & 1
        ? ~(resultado >> 1)
        : resultado >> 1;

    longitude += deltaLongitude;

    pontos.push({
      latitude: latitude / 100000,
      longitude: longitude / 100000,
    });
  }

  return pontos;
}

export default function Cliente() {
  const {
    usuario,
    token,
    carregando,
    logout,
  } = useAuth();

  const [localizacao, setLocalizacao] = useState<Localizacao | null>(null);
  const [carregandoLocalizacao, setCarregandoLocalizacao] = useState(true);
  const [corridaAtual, setCorridaAtual] = useState<Corrida | null>(null);

  const [rota, setRota] = useState<Localizacao[]>([]);
  const [carregandoRota, setCarregandoRota] = useState(false);

  const mapaRef = useRef<MapView | null>(null);
  const [painelExpandido, setPainelExpandido] = useState(false);
   
  const calcularRota = useCallback(async (
    origem: Localizacao,
    destino: Localizacao
  ) => {

    try {

      setCarregandoRota(true);

      const apiKey = Constants.expoConfig?.extra?.googleMapsApiKey;

      if (!apiKey) {
        console.error(
          'GOOGLE MAPS API KEY não encontrada.'
        );

        return;
      }

      const response = await fetch(
        'https://routes.googleapis.com/directions/v2:computeRoutes',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask':
              'routes.polyline.encodedPolyline,routes.distanceMeters,routes.duration',
          },

          body: JSON.stringify({

            origin: {
              location: {
                latLng: {
                  latitude: origem.latitude,
                  longitude: origem.longitude,
                },
              },
            },

            destination: {
              location: {
                latLng: {
                  latitude: destino.latitude,
                  longitude: destino.longitude,
                },
              },
            },

            travelMode: 'DRIVE',

            routingPreference: 'TRAFFIC_AWARE',

            computeAlternativeRoutes: false,

            languageCode: 'pt-BR',

            units: 'METRIC',
          }),
        }
      );

      if (!response.ok) {

        const erro = await response.text();

        console.error(
          'Erro Google Routes:',
          erro
        );

        return;
      }

      const data = await response.json();

      const encodedPolyline =
        data?.routes?.[0]?.polyline?.encodedPolyline;

      if (!encodedPolyline) {

        console.error(
          'Google não retornou a rota:',
          data
        );

        return;
      }

      const pontos =
        decodificarPolyline(
          encodedPolyline
        );

      setRota(pontos);

      console.log(
        'Rota calculada:',
        pontos.length,
        'pontos'
      );

    } catch (error) {

      console.error(
        'Erro ao calcular rota:',
        error
      );

    } finally {

      setCarregandoRota(false);
    }

  }, []);


  const handleLogout = () => {
    Alert.alert(
      'Sair',
      'Deseja realmente sair do aplicativo?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            try {
              await logout();

              router.replace('/login');
            } catch (error) {
              console.error(
                'Erro ao sair:',
                error
              );

              Alert.alert(
                'Erro',
                'Não foi possível sair do aplicativo.'
              );
            }
          },
        },
      ]
    );
  };

  /*
   * ============================================================
   * BUSCAR MINHA CORRIDA
   * ============================================================
   */

  const carregarMinhaCorrida = useCallback(async () => {
    /*
     * Não consulta a API enquanto o token ainda não estiver
     * disponível.
     */
    if (!token) {
      return;
    }

    try {
      const response = await api.get('/corridas/minha');

      const corrida =
        response.data?.corrida ?? null;

      setCorridaAtual(corrida);

      console.log(
        'Minha corrida:',
        corrida
      );
    } catch (error: any) {
      console.error(
        'Erro ao buscar corrida:',
        error?.response?.data || error
      );
    }
  }, [token]);

  /*
  * ============================================================
  * ACOMPANHAMENTO DA CORRIDA
  * ============================================================
  *
  * Ao entrar na tela:
  * - Consulta a corrida apenas uma vez.
  *
  * Se existir uma corrida:
  * - Começa o acompanhamento a cada 3 segundos.
  *
  * Se não existir:
  * - Não fica consultando a API.
  */

  useEffect(() => {
    if (carregando || !token) {
      return;
    }

    let intervalo: ReturnType<typeof setInterval> | null = null;
    let ativo = true;

    const verificarCorrida = async () => {
      if (!ativo) {
        return;
      }

      try {
        const response = await api.get('/corridas/minha');

        const corrida =
          response.data?.corrida ?? null;

        if (!ativo) {
          return;
        }

        setCorridaAtual(corrida);

        console.log('Minha corrida:', corrida);

        /*
        * Só começa o polling se realmente existir
        * uma corrida ativa.
        */
        if (
          corrida &&
          !intervalo &&
          corrida.status !== 'FINALIZADA' &&
          corrida.status !== 'CANCELADA'
        ) {
          intervalo = setInterval(async () => {
            if (!ativo) {
              return;
            }

            try {
              const responseAtual =
                await api.get('/corridas/minha');

              const corridaAtualizada =
                responseAtual.data?.corrida ?? null;

              if (!ativo) {
                return;
              }

              setCorridaAtual(corridaAtualizada);

              console.log(
                'Corrida atualizada:',
                corridaAtualizada
              );

              /*
              * Se a corrida acabou, não precisamos
              * continuar consultando.
              */
              if (
                !corridaAtualizada ||
                corridaAtualizada.status === 'FINALIZADA' ||
                corridaAtualizada.status === 'CANCELADA'
              ) {
                if (intervalo) {
                  clearInterval(intervalo);
                  intervalo = null;
                }
              }
            } catch (error: any) {
              console.error(
                'Erro ao atualizar corrida:',
                error?.response?.data || error
              );
            }
          }, 3000);
        }
      } catch (error: any) {
        console.error(
          'Erro ao buscar corrida:',
          error?.response?.data || error
        );
      }
    };

    verificarCorrida();

    return () => {
      ativo = false;

      if (intervalo) {
        clearInterval(intervalo);
        intervalo = null;
      }
    };
  }, [carregando, token]);

  /*
   * ============================================================
   * LOCALIZAÇÃO
   * ============================================================
   */

  useEffect(() => {
    let ativo = true;

    async function obterLocalizacao() {
      try {
        const {
          status,
        } =
          await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          Alert.alert(
            'Localização',
            'Precisamos da sua localização para solicitar uma corrida.'
          );

          if (ativo) {
            setCarregandoLocalizacao(false);
          }

          return;
        }

        const location =
          await Location.getCurrentPositionAsync({
            accuracy:
              Location.Accuracy.High,
          });

        if (!ativo) {
          return;
        }

        setLocalizacao({
          latitude:
            location.coords.latitude,
          longitude:
            location.coords.longitude,
        });
      } catch (error) {
        console.error(
          'Erro ao obter localização:',
          error
        );
      } finally {
        if (ativo) {
          setCarregandoLocalizacao(false);
        }
      }
    }

    obterLocalizacao();

    return () => {
      ativo = false;
    };
  }, []);

  /*
   * ============================================================
   * EFFECT 
   * ============================================================
   */

    
  useEffect(() => {
    // Sem corrida ativa: limpa a rota e volta para o cliente.
    if (
      !corridaAtual ||
      corridaAtual.status === 'FINALIZADA' ||
      corridaAtual.status === 'CANCELADA'
    ) {
      setRota([]);

      if (localizacao) {
        mapaRef.current?.animateToRegion(
          {
            latitude: localizacao.latitude,
            longitude: localizacao.longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          },
          700
        );
      }

      return;
    }

    if (
      !corridaAtual.origem_latitude ||
      !corridaAtual.origem_longitude ||
      !corridaAtual.destino_latitude ||
      !corridaAtual.destino_longitude
    ) {
      setRota([]);
      return;
    }

    calcularRota(
      {
        latitude: corridaAtual.origem_latitude,
        longitude: corridaAtual.origem_longitude,
      },
      {
        latitude: corridaAtual.destino_latitude,
        longitude: corridaAtual.destino_longitude,
      }
    );
  }, [
    corridaAtual?.id,
    corridaAtual?.status,
    corridaAtual?.origem_latitude,
    corridaAtual?.origem_longitude,
    corridaAtual?.destino_latitude,
    corridaAtual?.destino_longitude,
    localizacao,
    calcularRota,
  ]);

  useEffect(() => {
    if (rota.length < 2) {
      return;
    }

    const temporizador = setTimeout(() => {
      mapaRef.current?.fitToCoordinates(rota, {
        edgePadding: {
          top: 170,
          right: 55,
          bottom: 300,
          left: 55,
        },
        animated: true,
      });
    }, 400);

    return () => clearTimeout(temporizador);
  }, [rota]);

  /*
   * ============================================================
   * REGIÃO INICIAL DO MAPA
   * ============================================================
   */

  const regiaoInicial: Region | undefined =
    localizacao
      ? {
          latitude:
            localizacao.latitude,

          longitude:
            localizacao.longitude,

          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }
      : undefined;

  /*
   * ============================================================
   * STATUS DA CORRIDA
   * ============================================================
   */

  function textoStatus(
    status: string
  ) {
    switch (status) {
      case 'SOLICITADA':
        return 'Aguardando motorista';

      case 'ACEITA':
        return 'Motorista a caminho';

      case 'EM_ANDAMENTO':
        return 'Corrida em andamento';

      case 'FINALIZADA':
        return 'Corrida finalizada';

      case 'CANCELADA':
        return 'Corrida cancelada';

      default:
        return status;
    }
  }

  /*
   * ============================================================
   * NOVA CORRIDA
   * ============================================================
  */
         
  function solicitarNovaCorrida() {
    if (!localizacao) {
      Alert.alert(
        'Localização',
        'Aguarde obter sua localização atual antes de solicitar uma corrida.'
      );
      return;
    }
     
    setCorridaAtual(null);
     
    router.push({
      pathname: '/solicitar-corrida',
      params: {
        latitude: String(localizacao.latitude),
        longitude: String(localizacao.longitude),
      },
    });
  }
      
  /*
   * ============================================================
   * TELA DE CARREGAMENTO
   * ============================================================
   */

  if (carregando) {
    return (
      <View style={styles.carregandoContainer}>
        <ActivityIndicator
          size="large"
        />

        <Text style={styles.carregandoTexto}>
          Carregando sua sessão...
        </Text>
      </View>
    );
  }
  
  const cancelarCorrida = () => {
    if (!corridaAtual) {
      return;
    }

    Alert.alert(
      'Cancelar corrida',
      'Tem certeza que deseja cancelar esta corrida?',
      [
        {
          text: 'Não',
          style: 'cancel',
        },
        {
          text: 'Sim, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.put(
                `/corridas/${corridaAtual.id}/cancelar`
              );

              setCorridaAtual(null);

              Alert.alert(
                'Corrida cancelada',
                'Sua corrida foi cancelada.'
              );
            } catch (error: any) {
              console.error(
                'Erro ao cancelar corrida:',
                error?.response?.data || error
              );

              Alert.alert(
                'Não foi possível cancelar',
                error?.response?.data?.error ||
                  'Tente novamente.'
              );
            }
          },
        },
      ]
    );
  };

  /*
   * ============================================================
   * TELA
   * ============================================================
   */

  return (
    <View style={styles.container}>

      {/* ======================================================
          MAPA
          ====================================================== */}

      <View style={styles.mapaContainer}>
        {carregandoLocalizacao ||
        !localizacao ? (
          <View
            style={
              styles.carregandoMapa
            }
          >
            <ActivityIndicator
              size="large"
            />

            <Text
              style={
                styles.carregandoMapaTexto
              }
            >
              Obtendo localização...
            </Text>
          </View>
        ) : (
          <MapView
            ref={mapaRef}
            style={styles.mapa}
            initialRegion={regiaoInicial}
            showsUserLocation
            showsMyLocationButton
          >       
            {/* Marcador do cliente */}
            <Marker
              coordinate={{
                latitude: localizacao.latitude,
                longitude: localizacao.longitude,
              }}
              title="Você"
            />

            {/* Marcador do destino */}
            {corridaAtual &&
             corridaAtual.status !== 'FINALIZADA' &&
             corridaAtual.status !== 'CANCELADA' && (
              <Marker
                coordinate={{
                  latitude: corridaAtual.destino_latitude,
                  longitude: corridaAtual.destino_longitude,
                }}
                title="Destino"
                description={corridaAtual.destino}
              />
            )}

            {/* Marcador do motorista */}
            {corridaAtual?.motorista &&
              corridaAtual.motorista.latitude !== null &&
              corridaAtual.motorista.longitude !== null && (
                <Marker
                  coordinate={{
                    latitude: corridaAtual.motorista.latitude,
                    longitude: corridaAtual.motorista.longitude,
                  }}
                  title={corridaAtual.motorista.nome || 'Motorista'}
                  description="Motorista"
                />
              )}

            {/* Rota pela rua */}
            {rota.length > 0 && (
              <Polyline
                coordinates={rota}
                strokeWidth={5}
                strokeColor="#111827"
              />
            )}
          </MapView>
        )}
      </View>

      {/* ======================================================
          PAINEL SUPERIOR
          ====================================================== */}

      <View style={styles.painelSuperior}>

        <View style={styles.cabecalhoSuperior}>
          <View style={styles.informacoesUsuario}>
            <Text style={styles.titulo}>
              Olá, {usuario?.name}
            </Text>

            <Text style={styles.subtitulo}>
              {corridaAtual
                ? 'Acompanhe sua corrida'
                : 'Para onde vamos?'}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.botaoSair}
            onPress={handleLogout}
          >
            <Text style={styles.botaoSairTexto}>
              Sair
            </Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* ======================================================
          PAINEL INFERIOR
          ====================================================== */}

      <View
        style={[
          styles.painelInferior,
          painelExpandido
            ? styles.painelExpandido
            : styles.painelRecolhido,
        ]}
      >
        <TouchableOpacity
          style={styles.alcaPainel}
          onPress={() => setPainelExpandido((anterior) => !anterior)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={
            painelExpandido
              ? 'Recolher detalhes da corrida'
              : 'Expandir detalhes da corrida'
          }
        >
          <View style={styles.alcaVisual} />

          <View style={styles.cabecalhoPainel}>
            <View style={styles.resumoPainel}>
              <Text style={styles.resumoTitulo}>
                {corridaAtual ? 'Minha corrida' : 'Vamos viajar?'}
              </Text>

              <Text style={styles.resumoStatus} numberOfLines={1}>
                {corridaAtual
                  ? textoStatus(corridaAtual.status)
                  : 'Solicite uma corrida para seu destino'}
              </Text>
            </View>

            <View style={styles.botaoExpandir}>
              <Text style={styles.setaPainel}>
                {painelExpandido ? '⌄' : '⌃'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        {painelExpandido && (
          <ScrollView
            style={styles.conteudoPainelExpandido}
            contentContainerStyle={styles.painelConteudo}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {/* Mantenha aqui o conteúdo atual do painel */}
        {corridaAtual ? (
          <>
            {/* ==================================================
                MINHA CORRIDA
                ================================================== */}

            <Text style={styles.tituloPainel}>
              Minha corrida
            </Text>

            {/* STATUS */}

            <View style={styles.statusContainer}>

              <Text
                style={styles.statusLabel}
              >
                Status
              </Text>

              <Text
                style={styles.statusTexto}
              >
                {textoStatus(
                  corridaAtual.status
                )}
              </Text>

            </View>

            {/* DESTINO */}

            <View style={styles.destinoContainer}>

              <Text
                style={styles.destinoLabel}
              >
                Destino
              </Text>

              <Text
                style={styles.destinoTexto}
              >
                {corridaAtual.destino}
              </Text>

            </View>

            {/* ==================================================
                MOTORISTA
                ================================================== */}

            {corridaAtual.status === 'SOLICITADA' && (
              <View style={styles.motoristaContainer}>
                <Text style={styles.motoristaTitulo}>
                  Procurando motorista
                </Text>

                <Text style={styles.motoristaDescricao}>
                  Estamos procurando um motorista próximo para você.
                </Text>
              </View>
            )}

            {(
              corridaAtual.status === 'ACEITA' ||
              corridaAtual.status === 'EM_ANDAMENTO'
            ) && (
              <View style={styles.motoristaContainer}>

                <Text style={styles.motoristaTitulo}>
                  {corridaAtual.status === 'ACEITA'
                    ? '🚗 Motorista encontrado'
                    : '🚗 Corrida em andamento'}
                </Text>

                {corridaAtual.motorista ? (
                  <>
                    {/* ==========================================
                        DADOS DO MOTORISTA
                        ========================================== */}

                    <View style={styles.motoristaCard}>

                      <View style={styles.motoristaAvatar}>
                        <Text style={styles.motoristaAvatarTexto}>
                          {corridaAtual.motorista.nome
                            ? corridaAtual.motorista.nome
                                .charAt(0)
                                .toUpperCase()
                            : 'M'}
                        </Text>
                      </View>

                      <View style={styles.motoristaDados}>

                        <Text style={styles.motoristaNome}>
                          {corridaAtual.motorista.nome ||
                            'Motorista'}
                        </Text>

                        {corridaAtual.motorista.telefone && (
                          <Text style={styles.motoristaTelefone}>
                            {corridaAtual.motorista.telefone}
                          </Text>
                        )}

                        <Text style={styles.motoristaAprovado}>
                          Motorista aprovado
                        </Text>

                      </View>

                    </View>

                    {/* ==========================================
                        LOCALIZAÇÃO DO MOTORISTA
                        ========================================== */}

                    {corridaAtual.motorista.latitude !== null &&
                      corridaAtual.motorista.latitude !== undefined &&
                      corridaAtual.motorista.longitude !== null &&
                      corridaAtual.motorista.longitude !== undefined && (

                        <View style={styles.localizacaoMotorista}>

                          <Text style={styles.localizacaoMotoristaTitulo}>
                            📍 Localização do motorista
                          </Text>

                          <Text style={styles.localizacaoMotoristaTexto}>
                            Latitude:{' '}
                            {Number(
                              corridaAtual.motorista.latitude
                            ).toFixed(6)}
                          </Text>

                          <Text style={styles.localizacaoMotoristaTexto}>
                            Longitude:{' '}
                            {Number(
                              corridaAtual.motorista.longitude
                            ).toFixed(6)}
                          </Text>

                        </View>
                      )}

                  </>
                ) : (
                  <Text style={styles.motoristaDescricao}>
                    Aguardando informações do motorista...
                  </Text>
                )}
                {corridaAtual.status === 'ACEITA' && (
                  <TouchableOpacity
                    style={styles.botaoAcompanharMotorista}
                    onPress={() => router.push('/acompanhar-motorista')}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.botaoAcompanharMotoristaTexto}>
                      📍 Acompanhar chegada do motorista
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* CANCELAR CORRIDA */}

            {(corridaAtual.status === 'SOLICITADA' ||
              corridaAtual.status === 'ACEITA') && (
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={cancelarCorrida}
              >
                <Text style={styles.botaoCancelarTexto}>
                  Cancelar corrida
                </Text>
              </TouchableOpacity>
            )}

            {/* CORRIDA FINALIZADA */}

            {corridaAtual.status ===
              'FINALIZADA' && (
              <View
                style={
                  styles.finalizadaContainer
                }
              >
                <Text
                  style={
                    styles.finalizadaTexto
                  }
                >
                  Sua corrida foi finalizada.
                </Text>

                <TouchableOpacity
                  style={
                    styles.botaoPrincipal
                  }
                  onPress={
                    solicitarNovaCorrida
                  }
                >
                  <Text
                    style={
                      styles.botaoPrincipalTexto
                    }
                  >
                    Solicitar nova corrida
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* CORRIDA CANCELADA */}

            {corridaAtual.status ===
              'CANCELADA' && (
              <View
                style={
                  styles.canceladaContainer
                }
              >
                <Text
                  style={
                    styles.canceladaTexto
                  }
                >
                  Esta corrida foi cancelada.
                </Text>

                <TouchableOpacity
                  style={
                    styles.botaoPrincipal
                  }
                  onPress={
                    solicitarNovaCorrida
                  }
                >
                  <Text
                    style={
                      styles.botaoPrincipalTexto
                    }
                  >
                    Solicitar nova corrida
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            {/* ==================================================
                SEM CORRIDA
                ================================================== */}

            <Text style={styles.tituloPainel}>
              Solicitar uma corrida
            </Text>

            <Text
              style={styles.descricaoPainel}
            >
              Informe seu destino para
              solicitar um motorista.
            </Text>

            <TouchableOpacity
              style={styles.botaoPrincipal}
              onPress={solicitarNovaCorrida}
              disabled={!localizacao || carregandoLocalizacao}
            >
              <Text style={styles.botaoPrincipalTexto}>
                Solicitar corrida
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.botaoHistorico}
              onPress={() =>
                router.push('/historico-corridas')
              }
            >
              <Text
                style={
                  styles.botaoHistoricoTexto
                }
              >
                Histórico de corridas
              </Text>
            </TouchableOpacity>
          </>
        )}
        </ScrollView>
        )}
      </View>
        
    </View>
  );
}

/*
 * ================================================================
 * ESTILOS
 * ================================================================
 */

const styles = StyleSheet.create({

  container: {
    flex: 1,
    backgroundColor: '#fff',
  },

  /*
   * CARREGAMENTO
   */

  carregandoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },

  carregandoTexto: {
    marginTop: 12,
    fontSize: 16,
  },

  /*
   * MAPA
   */

  mapaContainer: {
    flex: 1,
  },

  mapa: {
    flex: 1,
  },

  carregandoMapa: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },

  carregandoMapaTexto: {
    marginTop: 10,
    fontSize: 15,
    color: '#555',
  },

  /*
   * PAINEL SUPERIOR
   */

  painelSuperior: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,

    backgroundColor: '#fff',

    borderRadius: 16,

    paddingHorizontal: 18,
    paddingVertical: 14,

    elevation: 5,

    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: {
      width: 0,
      height: 3,
    },
  },

  titulo: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
  },

  subtitulo: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },

  /*
  * PAINEL INFERIOR
  */
    
  painelInferior: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,

    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,

    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,

    elevation: 14,
    shadowColor: '#000000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: {
      width: 0,
      height: -4,
    },

    overflow: 'hidden',
  },

  painelRecolhido: {
    height: 112,
  },

  painelExpandido: {
    height: '58%',
  },

  alcaPainel: {
    paddingBottom: 12,
  },

  alcaVisual: {
    width: 42,
    height: 5,
    borderRadius: 10,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 12,
  },

  cabecalhoPainel: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  resumoPainel: {
    flex: 1,
    marginRight: 12,
  },

  resumoTitulo: {
    fontSize: 19,
    fontWeight: '800',
    color: '#111827',
  },

  resumoStatus: {
    marginTop: 4,
    fontSize: 14,
    color: '#0F766E',
    fontWeight: '600',
  },

  botaoExpandir: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  setaPainel: {
    fontSize: 25,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 29,
  },

  conteudoPainelExpandido: {
    flexShrink: 1,
  },

  painelConteudo: {
    paddingBottom: 20,
  },
     
  tituloPainel: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 10,
  },
  
  descricaoPainel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 18,
  },

  /*
  * STATUS
  */

  statusContainer: {
    backgroundColor: '#eef6ff',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
    marginBottom: 10,
  },

  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },

  statusTexto: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1769aa',
  },

  /*
   * DESTINO
   */

  destinoContainer: {
    backgroundColor: '#f7f7f7',

    borderRadius: 12,

    padding: 14,

    marginBottom: 10,
  },

  /*
   * MOTORISTA
   */

  motoristaTexto: {
    fontSize: 15,
    fontWeight: '600',
    color: '#15803d',
  },

  /*
   * FINALIZADA
   */

  finalizadaContainer: {
    marginTop: 5,
  },

  finalizadaTexto: {
    fontSize: 14,
    color: '#15803d',
    marginBottom: 12,
  },

  /*
   * CANCELADA
   */

  canceladaContainer: {
    marginTop: 5,
  },

  canceladaTexto: {
    fontSize: 14,
    color: '#b91c1c',
    marginBottom: 12,
  },

  /*
   * BOTÃO PRINCIPAL
   */

  botaoPrincipal: {
    backgroundColor: '#111',

    borderRadius: 14,

    paddingVertical: 15,

    alignItems: 'center',

    marginTop: 8,
  },

  botaoPrincipalTexto: {
    color: '#fff',

    fontSize: 16,

    fontWeight: '700',
  },

  /*
   * HISTÓRICO
   */

  botaoHistorico: {
    alignItems: 'center',

    paddingVertical: 14,

    marginTop: 6,
  },

  botaoHistoricoTexto: {
    fontSize: 14,

    fontWeight: '600',

    color: '#555',
  },

  botaoCancelar: {
    marginTop: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dc2626',
  },

  botaoCancelarTexto: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '700',
  },

  cabecalhoSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  informacoesUsuario: {
    flex: 1,
    marginRight: 12,
  },

  botaoSair: {
    backgroundColor: '#374151',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },

  botaoSairTexto: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  areaProcurandoMotorista: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },

  areaMotorista: {
      marginTop: 16,
  },

  statusTitulo: {
      fontSize: 18,
      fontWeight: '700',
      color: '#111827',
  },

  statusDescricao: {
      marginTop: 6,
      fontSize: 14,
      lineHeight: 20,
      color: '#6b7280',
  },

  cardMotorista: {
      marginTop: 14,
      padding: 14,
      borderRadius: 12,
      backgroundColor: '#f8fafc',
      flexDirection: 'row',
      alignItems: 'center',
  },

  avatarMotorista: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: '#0f766e',
      alignItems: 'center',
      justifyContent: 'center',
  },

  avatarMotoristaTexto: {
      fontSize: 22,
      fontWeight: '700',
      color: '#ffffff',
  },

  dadosMotorista: {
      flex: 1,
      marginLeft: 14,
  },

  nomeMotorista: {
      fontSize: 17,
      fontWeight: '700',
      color: '#111827',
  },

  telefoneMotorista: {
      marginTop: 3,
      fontSize: 14,
      color: '#374151',
  },

  statusMotorista: {
      marginTop: 4,
      fontSize: 13,
      color: '#059669',
  },

  localizacaoTitulo: {
      fontSize: 14,
      fontWeight: '700',
      color: '#065f46',
  },

  localizacaoTexto: {
      marginTop: 3,
      fontSize: 12,
      color: '#047857',
  },

  destinoCorrida: {
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
  },

  destinoLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#6b7280',
      textTransform: 'uppercase',
  },

  destinoTexto: {
      marginTop: 4,
      fontSize: 15,
      color: '#111827',
  },

  motoristaContainer: {
    marginTop: 16,
  },

  motoristaTitulo: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },

  motoristaDescricao: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: '#6b7280',
  },

  motoristaCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    flexDirection: 'row',
    alignItems: 'center',
  },

  motoristaAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#0f766e',
    alignItems: 'center',
    justifyContent: 'center',
  },

  motoristaAvatarTexto: {
    fontSize: 21,
    fontWeight: '700',
    color: '#ffffff',
  },

  motoristaDados: {
    flex: 1,
    marginLeft: 12,
  },

  motoristaNome: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  motoristaTelefone: {
    marginTop: 3,
    fontSize: 14,
    color: '#374151',
  },

  motoristaAprovado: {
    marginTop: 3,
    fontSize: 13,
    color: '#059669',
  },

  localizacaoMotorista: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },

  localizacaoMotoristaTitulo: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
  },

  localizacaoMotoristaTexto: {
    marginTop: 2,
    fontSize: 12,
    color: '#047857',
  },
    
  botaoAcompanharMotorista: {
    marginTop: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoAcompanharMotoristaTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});