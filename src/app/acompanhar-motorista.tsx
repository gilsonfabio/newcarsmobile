
import React, { useCallback, useEffect, useRef, useState } from 'react';

import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import MapView, { Marker, Region } from 'react-native-maps';
import { router } from 'expo-router';

import { api } from '../services/api';

interface Motorista {
  nome: string | null;
  telefone: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Corrida {
  id: string;
  status: string;
  origem_latitude: number;
  origem_longitude: number;
  destino: string;
  motorista: Motorista | null;
}

export default function AcompanharMotorista() {
  const mapaRef = useRef<MapView | null>(null);

  const [corrida, setCorrida] = useState<Corrida | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const buscarCorrida = useCallback(async () => {
    try {
      const response = await api.get('/corridas/minha');

      const dados: Corrida | null =
        response.data?.corrida ?? null;

      if (!dados) {
        setCorrida(null);
        setErro('Nenhuma corrida ativa foi encontrada.');
        return;
      }

      setErro('');
      setCorrida(dados);

      if (
        dados.status === 'FINALIZADA' ||
        dados.status === 'CANCELADA'
      ) {
        Alert.alert(
          dados.status === 'FINALIZADA'
            ? 'Corrida finalizada'
            : 'Corrida cancelada',
          dados.status === 'FINALIZADA'
            ? 'A corrida foi concluída.'
            : 'A corrida foi cancelada.',
          [
            {
              text: 'Voltar',
              onPress: () => router.replace('/cliente'),
            },
          ],
          { cancelable: false }
        );
      }
    } catch (error: any) {
      console.error(
        'Erro ao atualizar localização do motorista:',
        error?.response?.data || error
      );

      setErro('Não foi possível atualizar a localização.');
    } finally {
      setCarregando(false);
    }
  }, []);

  // Primeira consulta e atualizações periódicas.
  useEffect(() => {
    buscarCorrida();

    const intervalo = setInterval(() => {
      buscarCorrida();
    }, 3000);

    return () => clearInterval(intervalo);
  }, [buscarCorrida]);

  const latitudeMotorista =
    corrida?.motorista?.latitude != null
      ? Number(corrida.motorista.latitude)
      : null;

  const longitudeMotorista =
    corrida?.motorista?.longitude != null
      ? Number(corrida.motorista.longitude)
      : null;

  // Mantém o motorista e o ponto de embarque visíveis no mapa.
  useEffect(() => {
    if (
      latitudeMotorista == null ||
      longitudeMotorista == null ||
      !corrida
    ) {
      return;
    }

    const pontos = [
      {
        latitude: latitudeMotorista,
        longitude: longitudeMotorista,
      },
      {
        latitude: Number(corrida.origem_latitude),
        longitude: Number(corrida.origem_longitude),
      },
    ];

    const temporizador = setTimeout(() => {
      mapaRef.current?.fitToCoordinates(pontos, {
        edgePadding: {
          top: 100,
          right: 65,
          bottom: 220,
          left: 65,
        },
        animated: true,
      });
    }, 300);

    return () => clearTimeout(temporizador);
  }, [
    latitudeMotorista,
    longitudeMotorista,
    corrida?.id,
    corrida?.origem_latitude,
    corrida?.origem_longitude,
  ]);

  if (carregando) {
    return (
      <View style={styles.centralizado}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.textoCarregamento}>
          Localizando seu motorista...
        </Text>
      </View>
    );
  }

  if (!corrida) {
    return (
      <View style={styles.centralizado}>
        <Text style={styles.titulo}>
          Acompanhamento indisponível
        </Text>

        <Text style={styles.descricao}>
          {erro || 'Não encontramos uma corrida ativa.'}
        </Text>

        <TouchableOpacity
          style={styles.botao}
          onPress={() => router.replace('/cliente')}
        >
          <Text style={styles.botaoTexto}>
            Voltar para o início
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const regiaoInicial: Region = {
    latitude:
      latitudeMotorista ?? Number(corrida.origem_latitude),
    longitude:
      longitudeMotorista ?? Number(corrida.origem_longitude),
    latitudeDelta: 0.025,
    longitudeDelta: 0.025,
  };

  const statusTexto =
    corrida.status === 'ACEITA'
      ? 'Motorista a caminho'
      : corrida.status === 'EM_ANDAMENTO'
        ? 'Corrida em andamento'
        : corrida.status === 'FINALIZADA'
          ? 'Corrida finalizada'
          : corrida.status === 'CANCELADA'
            ? 'Corrida cancelada'
            : 'Status: ' + corrida.status;

  return (
    <View style={styles.container}>
      <MapView
        ref={mapaRef}
        style={styles.mapa}
        initialRegion={regiaoInicial}
        showsUserLocation
        showsMyLocationButton
      >
        <Marker
          coordinate={{
            latitude: Number(corrida.origem_latitude),
            longitude: Number(corrida.origem_longitude),
          }}
          title="Seu ponto de embarque"
          pinColor="#16A34A"
        />

        {latitudeMotorista != null &&
          longitudeMotorista != null && (
            <Marker
              coordinate={{
                latitude: latitudeMotorista,
                longitude: longitudeMotorista,
              }}
              title={corrida.motorista?.nome || 'Seu motorista'}
              description="Localização atual do motorista"
              pinColor="#2563EB"
            />
          )}
      </MapView>

      <TouchableOpacity
        style={styles.botaoVoltar}
        onPress={() => router.replace('/cliente')}
      >
        <Text style={styles.botaoVoltarTexto}>
          ‹ Voltar
        </Text>
      </TouchableOpacity>

      <View style={styles.painel}>
        <View style={styles.indicador} />

        <Text style={styles.titulo}>
          Acompanhe seu motorista
        </Text>

        <View style={styles.statusCard}>
          <View style={styles.indicadorStatus} />

          <View style={styles.statusConteudo}>
            <Text style={styles.status}>
              {statusTexto}
            </Text>

            <Text style={styles.descricao}>
              {latitudeMotorista != null &&
              longitudeMotorista != null
                ? 'A posição do motorista é atualizada automaticamente.'
                : 'Aguardando a localização do motorista.'}
            </Text>
          </View>
        </View>

        <View style={styles.motoristaCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarTexto}>
              {corrida.motorista?.nome?.charAt(0).toUpperCase() || 'M'}
            </Text>
          </View>

          <View style={styles.dadosMotorista}>
            <Text style={styles.nomeMotorista}>
              {corrida.motorista?.nome || 'Motorista'}
            </Text>

            <Text style={styles.telefone}>
              {corrida.motorista?.telefone || 'Telefone não informado'}
            </Text>
          </View>
        </View>

        {!!erro && (
          <Text style={styles.aviso}>{erro}</Text>
        )}

        <TouchableOpacity
          style={styles.botao}
          onPress={() => router.replace('/cliente')}
        >
          <Text style={styles.botaoTexto}>
            Voltar para minha corrida
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  mapa: {
    flex: 1,
  },

  centralizado: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  textoCarregamento: {
    marginTop: 12,
    color: '#475569',
    fontSize: 15,
  },

  botaoVoltar: {
    position: 'absolute',
    top: 55,
    left: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    elevation: 5,
  },

  botaoVoltarTexto: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700',
  },

  painel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '48%',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    elevation: 12,
  },

  indicador: {
    width: 42,
    height: 5,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },

  titulo: {
    fontSize: 21,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 14,
  },

  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#ECFDF5',
  },

  indicadorStatus: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#059669',
    marginRight: 12,
  },

  statusConteudo: {
    flex: 1,
  },

  status: {
    fontSize: 16,
    fontWeight: '800',
    color: '#065F46',
  },

  descricao: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 19,
    color: '#64748B',
  },

  motoristaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginTop: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarTexto: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  dadosMotorista: {
    flex: 1,
    marginLeft: 12,
  },

  nomeMotorista: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },

  telefone: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748B',
  },

  aviso: {
    marginTop: 10,
    color: '#B45309',
    fontSize: 13,
  },

  botao: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 13,
    alignItems: 'center',
    backgroundColor: '#0F766E',
  },

  botaoTexto: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});