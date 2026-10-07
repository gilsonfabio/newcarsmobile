import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Location from 'expo-location';
import { router } from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import MapView, {
  Marker,
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
            style={styles.mapa}
            initialRegion={
              regiaoInicial
            }
            showsUserLocation
            showsMyLocationButton
          >
            {/* Localização do cliente */}

            <Marker
              coordinate={{
                latitude:
                  localizacao.latitude,

                longitude:
                  localizacao.longitude,
              }}
              title="Você"
            />

            {/* Destino da corrida */}

            {corridaAtual && (
              <Marker
                coordinate={{
                  latitude:
                    corridaAtual.destino_latitude,

                  longitude:
                    corridaAtual.destino_longitude,
                }}
                title="Destino"
                description={
                  corridaAtual.destino
                }
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

      <View style={styles.painelInferior}>

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

    backgroundColor: '#fff',

    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,

    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 30,

    elevation: 10,

    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: {
      width: 0,
      height: -3,
    },
  },

  tituloPainel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 8,
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

});