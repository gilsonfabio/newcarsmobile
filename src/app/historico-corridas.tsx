import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Corrida {
  id: string;

  cliente_id: string;

  origem_latitude: number;
  origem_longitude: number;

  destino: string;
  destino_latitude: number;
  destino_longitude: number;

  motorista_id: string | null;

  status: string;

  valor: number | null;

  created_at?: string;
  updated_at?: string;
}

export default function HistoricoCorridas() {
  const {
    token,
    carregando,
  } = useAuth();

  const [
    corridas,
    setCorridas,
  ] = useState<Corrida[]>([]);

  const [
    carregandoHistorico,
    setCarregandoHistorico,
  ] = useState(true);

  const [
    atualizando,
    setAtualizando,
  ] = useState(false);

  /*
   * ============================================================
   * BUSCAR HISTÓRICO
   * ============================================================
   */

  const carregarHistorico = useCallback(
    async () => {
      if (!token) {
        return;
      }

      try {
        setCarregandoHistorico(true);

        const response =
          await api.get(
            '/corridas/historico'
          );

        const lista =
          response.data?.corridas ?? [];

        setCorridas(lista);

        console.log(
          'Histórico:',
          lista
        );
      } catch (error: any) {
        console.error(
          'Erro ao buscar histórico:',
          error?.response?.data || error
        );

        Alert.alert(
          'Erro',
          error?.response?.data?.error ||
            'Não foi possível carregar o histórico.'
        );
      } finally {
        setCarregandoHistorico(false);
        setAtualizando(false);
      }
    },
    [token]
  );

  /*
   * ============================================================
   * CARREGAR QUANDO A SESSÃO ESTIVER PRONTA
   * ============================================================
   */

  useEffect(() => {
    if (carregando || !token) {
      return;
    }

    carregarHistorico();
  }, [
    carregando,
    token,
    carregarHistorico,
  ]);

  /*
   * ============================================================
   * ATUALIZAR
   * ============================================================
   */

  const atualizar = useCallback(
    async () => {
      setAtualizando(true);

      await carregarHistorico();
    },
    [carregarHistorico]
  );

  /*
   * ============================================================
   * STATUS
   * ============================================================
   */

  function textoStatus(
    status: string
  ) {
    switch (status) {
      case 'FINALIZADA':
        return 'Finalizada';

      case 'CANCELADA':
        return 'Cancelada';

      case 'SOLICITADA':
        return 'Solicitada';

      case 'ACEITA':
        return 'Aceita';

      case 'EM_ANDAMENTO':
        return 'Em andamento';

      default:
        return status;
    }
  }

  /*
   * ============================================================
   * DATA
   * ============================================================
   */

  function formatarData(
    data?: string
  ) {
    if (!data) {
      return 'Data não informada';
    }

    try {
      const dataObj =
        new Date(data);

      return dataObj.toLocaleString(
        'pt-BR',
        {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      );
    } catch {
      return data;
    }
  }

  /*
   * ============================================================
   * VALOR
   * ============================================================
   */

  function formatarValor(
    valor: number | null
  ) {
    if (
      valor === null ||
      valor === undefined
    ) {
      return 'Valor não informado';
    }

    return valor.toLocaleString(
      'pt-BR',
      {
        style: 'currency',
        currency: 'BRL',
      }
    );
  }

  /*
   * ============================================================
   * CARD DA CORRIDA
   * ============================================================
   */

  function renderCorrida({
    item,
  }: {
    item: Corrida;
  }) {
    const finalizada =
      item.status === 'FINALIZADA';

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
      >
        <View
          style={styles.cardCabecalho}
        >
          <View>
            <Text
              style={styles.cardTitulo}
            >
              Corrida
            </Text>

            <Text
              style={styles.cardData}
            >
              {formatarData(
                item.created_at
              )}
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              finalizada
                ? styles.statusFinalizada
                : styles.statusCancelada,
            ]}
          >
            <Text
              style={[
                styles.statusTexto,
                finalizada
                  ? styles.statusTextoFinalizada
                  : styles.statusTextoCancelada,
              ]}
            >
              {textoStatus(
                item.status
              )}
            </Text>
          </View>
        </View>

        <View
          style={styles.linha}
        />

        <View
          style={styles.localContainer}
        >
          <View
            style={styles.pontoOrigem}
          />

          <View
            style={styles.localTextoContainer}
          >
            <Text
              style={styles.localLabel}
            >
              Origem
            </Text>

            <Text
              style={styles.coordenadas}
            >
              {item.origem_latitude.toFixed(
                6
              )}
              {' , '}
              {item.origem_longitude.toFixed(
                6
              )}
            </Text>
          </View>
        </View>

        <View
          style={styles.linhaVertical}
        />

        <View
          style={styles.localContainer}
        >
          <View
            style={styles.pontoDestino}
          />

          <View
            style={styles.localTextoContainer}
          >
            <Text
              style={styles.localLabel}
            >
              Destino
            </Text>

            <Text
              style={styles.destino}
              numberOfLines={2}
            >
              {item.destino}
            </Text>
          </View>
        </View>

        <View
          style={styles.rodapeCard}
        >
          <Text
            style={styles.motorista}
          >
            {item.motorista_id
              ? 'Motorista identificado'
              : 'Motorista não informado'}
          </Text>

          <Text
            style={styles.valor}
          >
            {formatarValor(
              item.valor
            )}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  /*
   * ============================================================
   * CARREGANDO SESSÃO
   * ============================================================
   */

  if (carregando) {
    return (
      <View
        style={
          styles.carregandoContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.carregandoTexto
          }
        >
          Carregando sessão...
        </Text>
      </View>
    );
  }

  /*
   * ============================================================
   * CARREGANDO HISTÓRICO
   * ============================================================
   */

  if (carregandoHistorico) {
    return (
      <View
        style={
          styles.carregandoContainer
        }
      >
        <ActivityIndicator
          size="large"
        />

        <Text
          style={
            styles.carregandoTexto
          }
        >
          Carregando histórico...
        </Text>
      </View>
    );
  }

  /*
   * ============================================================
   * TELA
   * ============================================================
   */

  return (
    <View
      style={styles.container}
    >
      {/* ======================================================
          CABEÇALHO
          ====================================================== */}

      <View
        style={styles.cabecalho}
      >
        <TouchableOpacity
          style={styles.botaoVoltar}
          onPress={() =>
            router.back()
          }
        >
          <Text
            style={styles.botaoVoltarTexto}
          >
            ‹
          </Text>
        </TouchableOpacity>

        <View>
          <Text
            style={styles.titulo}
          >
            Histórico
          </Text>

          <Text
            style={styles.subtitulo}
          >
            Suas corridas
          </Text>
        </View>

        <View
          style={styles.espacoCabecalho}
        />
      </View>

      {/* ======================================================
          LISTA
          ====================================================== */}

      {corridas.length === 0 ? (
        <View
          style={styles.vazioContainer}
        >
          <Text
            style={styles.iconeVazio}
          >
            🚗
          </Text>

          <Text
            style={styles.tituloVazio}
          >
            Nenhuma corrida encontrada
          </Text>

          <Text
            style={styles.textoVazio}
          >
            Quando você finalizar uma
            corrida, ela aparecerá aqui.
          </Text>

          <TouchableOpacity
            style={styles.botaoNovaCorrida}
            onPress={() =>
              router.push(
                '/solicitar-corrida'
              )
            }
          >
            <Text
              style={
                styles.botaoNovaCorridaTexto
              }
            >
              Solicitar corrida
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={corridas}
          keyExtractor={(item) =>
            item.id
          }
          renderItem={renderCorrida}
          contentContainerStyle={
            styles.lista
          }
          showsVerticalScrollIndicator={
            false
          }
          refreshing={atualizando}
          onRefresh={atualizar}
        />
      )}
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
    backgroundColor: '#f5f5f5',
  },

  /*
   * CABEÇALHO
   */

  cabecalho: {
    height: 110,

    backgroundColor: '#fff',

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

    borderRadius: 21,

    backgroundColor: '#f2f2f2',

    alignItems: 'center',
    justifyContent: 'center',
  },

  botaoVoltarTexto: {
    fontSize: 34,
    lineHeight: 36,
    color: '#111',

    marginTop: -4,
  },

  titulo: {
    fontSize: 21,
    fontWeight: '700',
    color: '#111',
    textAlign: 'center',
  },

  subtitulo: {
    marginTop: 2,

    fontSize: 13,

    color: '#777',

    textAlign: 'center',
  },

  espacoCabecalho: {
    width: 42,
  },

  /*
   * LISTA
   */

  lista: {
    padding: 16,
    paddingBottom: 30,
  },

  /*
   * CARD
   */

  card: {
    backgroundColor: '#fff',

    borderRadius: 16,

    padding: 16,

    marginBottom: 14,

    elevation: 2,

    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: {
      width: 0,
      height: 2,
    },
  },

  cardCabecalho: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',
  },

  cardTitulo: {
    fontSize: 16,

    fontWeight: '700',

    color: '#222',
  },

  cardData: {
    marginTop: 3,

    fontSize: 12,

    color: '#777',
  },

  /*
   * STATUS
   */

  statusBadge: {
    paddingHorizontal: 10,

    paddingVertical: 6,

    borderRadius: 20,
  },

  statusFinalizada: {
    backgroundColor: '#ecfdf3',
  },

  statusCancelada: {
    backgroundColor: '#fef2f2',
  },

  statusTexto: {
    fontSize: 12,

    fontWeight: '700',
  },

  statusTextoFinalizada: {
    color: '#15803d',
  },

  statusTextoCancelada: {
    color: '#b91c1c',
  },

  /*
   * LINHA
   */

  linha: {
    height: 1,

    backgroundColor: '#eee',

    marginVertical: 14,
  },

  /*
   * LOCAIS
   */

  localContainer: {
    flexDirection: 'row',

    alignItems: 'flex-start',
  },

  localTextoContainer: {
    flex: 1,

    marginLeft: 12,
  },

  pontoOrigem: {
    width: 12,
    height: 12,

    borderRadius: 6,

    backgroundColor: '#111',

    marginTop: 4,
  },

  pontoDestino: {
    width: 12,
    height: 12,

    borderRadius: 6,

    backgroundColor: '#d00',

    marginTop: 4,
  },

  linhaVertical: {
    width: 1,

    height: 18,

    backgroundColor: '#ccc',

    marginLeft: 5.5,

    marginVertical: 2,
  },

  localLabel: {
    fontSize: 11,

    color: '#888',

    marginBottom: 2,
  },

  coordenadas: {
    fontSize: 12,

    color: '#555',
  },

  destino: {
    fontSize: 14,

    fontWeight: '600',

    color: '#222',
  },

  /*
   * RODAPÉ DO CARD
   */

  rodapeCard: {
    flexDirection: 'row',

    alignItems: 'center',

    justifyContent: 'space-between',

    marginTop: 16,

    paddingTop: 12,

    borderTopWidth: 1,

    borderTopColor: '#eee',
  },

  motorista: {
    fontSize: 12,

    color: '#666',
  },

  valor: {
    fontSize: 16,

    fontWeight: '700',

    color: '#111',
  },

  /*
   * VAZIO
   */

  vazioContainer: {
    flex: 1,

    alignItems: 'center',

    justifyContent: 'center',

    paddingHorizontal: 35,
  },

  iconeVazio: {
    fontSize: 50,

    marginBottom: 16,
  },

  tituloVazio: {
    fontSize: 19,

    fontWeight: '700',

    color: '#222',

    textAlign: 'center',
  },

  textoVazio: {
    marginTop: 8,

    fontSize: 14,

    lineHeight: 21,

    color: '#777',

    textAlign: 'center',
  },

  botaoNovaCorrida: {
    marginTop: 22,

    backgroundColor: '#111',

    borderRadius: 14,

    paddingHorizontal: 25,

    paddingVertical: 14,
  },

  botaoNovaCorridaTexto: {
    color: '#fff',

    fontSize: 15,

    fontWeight: '700',
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

    fontSize: 15,

    color: '#666',
  },

});
