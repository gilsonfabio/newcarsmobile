import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import MapView, {
    Marker,
    Polyline,
    Region,
} from 'react-native-maps';

import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { router } from 'expo-router';

import { api } from '../services/api';

interface Corrida {
    id: string;
    status: string;
    origem_latitude: number;
    origem_longitude: number;
    destino_latitude: number;
    destino_longitude: number;
    destino: string;
}

interface Coordenada {
    latitude: number;
    longitude: number;
}

interface RotaGoogle {
    coordenadas: Coordenada[];
    distancia: number;
    duracao: string;
}

// =====================================================
// DECODIFICAR POLYLINE DO GOOGLE
// =====================================================

function decodificarPolyline(
    encoded: string
): Coordenada[] {
    const pontos: Coordenada[] = [];

    let index = 0;
    let latitude = 0;
    let longitude = 0;

    while (index < encoded.length) {
        let resultado = 0;
        let shift = 0;
        let byte: number;

        do {
            byte = encoded.charCodeAt(index++) - 63;
            resultado |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);

        const deltaLatitude =
            resultado & 1
                ? ~(resultado >> 1)
                : resultado >> 1;

        latitude += deltaLatitude;

        resultado = 0;
        shift = 0;

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
            latitude: latitude / 1e5,
            longitude: longitude / 1e5,
        });
    }

    return pontos;
}

// =====================================================
// FORMATAR DISTÂNCIA
// =====================================================

function formatarDistancia(metros: number) {
    if (metros < 1000) {
        return `${Math.round(metros)} m`;
    }

    return `${(metros / 1000).toFixed(1)} km`;
}

// =====================================================
// TELA
// =====================================================

export default function RotaEmbarque() {
    const mapaRef = useRef<MapView | null>(null);

    const ultimaAtualizacaoRotaRef = useRef(0);

    const [corrida, setCorrida] =
        useState<Corrida | null>(null);

    const [localizacao, setLocalizacao] =
        useState<Coordenada | null>(null);

    const [rota, setRota] =
        useState<RotaGoogle | null>(null);

    const [carregando, setCarregando] =
        useState(true);

    const [erro, setErro] = useState('');

    // =====================================================
    // BUSCAR CORRIDA ATUAL
    // =====================================================

    const carregarCorrida = useCallback(async () => {
        try {
            const response = await api.get(
                '/corridas/minha'
            );

            const dados: Corrida | null =
                response.data?.corrida ?? null;

            if (!dados) {
                setCorrida(null);
                setErro(
                    'Nenhuma corrida ativa foi encontrada.'
                );
                return;
            }

            setCorrida(dados);
            setErro('');
        } catch (error: any) {
            console.error(
                'Erro ao buscar corrida:',
                error?.response?.data || error
            );

            setErro(
                'Não foi possível carregar os dados da corrida.'
            );
        } finally {
            setCarregando(false);
        }
    }, []);

    useEffect(() => {
        carregarCorrida();

        const intervalo = setInterval(
            carregarCorrida,
            5000
        );

        return () => clearInterval(intervalo);
    }, [carregarCorrida]);

    // =====================================================
    // ACOMPANHAR GPS DO MOTORISTA
    // =====================================================

    useEffect(() => {
        let cancelado = false;

        let inscricao:
            Location.LocationSubscription | null = null;

        async function iniciarGPS() {
            try {
                const permissao =
                    await Location.requestForegroundPermissionsAsync();

                if (permissao.status !== 'granted') {
                    setErro(
                        'Permita o acesso à localização para visualizar a rota.'
                    );
                    return;
                }

                const atual =
                    await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });

                if (cancelado) {
                    return;
                }

                setLocalizacao({
                    latitude: atual.coords.latitude,
                    longitude: atual.coords.longitude,
                });

                inscricao =
                    await Location.watchPositionAsync(
                        {
                            accuracy: Location.Accuracy.High,
                            timeInterval: 5000,
                            distanceInterval: 10,
                        },
                        (posicao) => {
                            if (cancelado) {
                                return;
                            }

                            setLocalizacao({
                                latitude:
                                    posicao.coords.latitude,
                                longitude:
                                    posicao.coords.longitude,
                            });
                        }
                    );
            } catch (error) {
                console.error(
                    'Erro ao obter GPS:',
                    error
                );

                setErro(
                    'Não foi possível obter sua localização atual.'
                );
            }
        }

        iniciarGPS();

        return () => {
            cancelado = true;
            inscricao?.remove();
        };
    }, []);

    // =====================================================
    // CALCULAR ROTA
    //
    // ACEITA:
    // motorista -> embarque
    //
    // EM_ANDAMENTO:
    // motorista -> destino final
    // =====================================================

    useEffect(() => {
        if (!corrida || !localizacao) {
            return;
        }

        if (
            corrida.status !== 'ACEITA' &&
            corrida.status !== 'EM_ANDAMENTO'
        ) {
            setRota(null);
            return;
        }

        // =================================================
        // IMPORTANTE:
        // Criamos uma cópia da localização depois da
        // validação para o TypeScript saber que ela não
        // pode ser null dentro da função async.
        // =================================================

        const localizacaoAtual: Coordenada = {
            latitude: localizacao.latitude,
            longitude: localizacao.longitude,
        };

        // =================================================
        // DEFINIR DESTINO DA ROTA
        // =================================================

        const destinoRota: Coordenada =
            corrida.status === 'EM_ANDAMENTO'
                ? {
                    latitude: Number(
                        corrida.destino_latitude
                    ),
                    longitude: Number(
                        corrida.destino_longitude
                    ),
                }
                : {
                    latitude: Number(
                        corrida.origem_latitude
                    ),
                    longitude: Number(
                        corrida.origem_longitude
                    ),
                };

        // =================================================
        // VALIDAR DESTINO
        // =================================================

        if (
            !Number.isFinite(destinoRota.latitude) ||
            !Number.isFinite(destinoRota.longitude)
        ) {
            setErro(
                'As coordenadas do destino da corrida são inválidas.'
            );
            return;
        }

        // =================================================
        // EVITAR EXCESSO DE CHAMADAS AO GOOGLE
        // =================================================

        const agora = Date.now();

        if (
            agora -
                ultimaAtualizacaoRotaRef.current <
            15000
        ) {
            return;
        }

        ultimaAtualizacaoRotaRef.current = agora;

        // =================================================
        // CALCULAR ROTA NO GOOGLE
        // =================================================

        async function calcularRota() {
            try {
                const apiKey =
                    Constants.expoConfig?.extra
                        ?.googleMapsApiKey;

                if (!apiKey) {
                    throw new Error(
                        'Google Maps API Key não configurada em extra.googleMapsApiKey.'
                    );
                }

                const resposta = await fetch(
                    'https://routes.googleapis.com/directions/v2:computeRoutes',
                    {
                        method: 'POST',

                        headers: {
                            'Content-Type':
                                'application/json',

                            'X-Goog-Api-Key':
                                apiKey,

                            'X-Goog-FieldMask':
                                'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
                        },

                        body: JSON.stringify({
                            origin: {
                                location: {
                                    latLng: {
                                        latitude:
                                            localizacaoAtual.latitude,

                                        longitude:
                                            localizacaoAtual.longitude,
                                    },
                                },
                            },

                            destination: {
                                location: {
                                    latLng: {
                                        latitude:
                                            destinoRota.latitude,

                                        longitude:
                                            destinoRota.longitude,
                                    },
                                },
                            },

                            travelMode: 'DRIVE',

                            languageCode: 'pt-BR',

                            units: 'METRIC',
                        }),
                    }
                );

                const dados =
                    await resposta.json();

                if (!resposta.ok) {
                    throw new Error(
                        dados?.error?.message ||
                            'Falha ao calcular a rota.'
                    );
                }

                const resultado =
                    dados.routes?.[0];

                if (
                    !resultado?.polyline
                        ?.encodedPolyline
                ) {
                    throw new Error(
                        'O Google não retornou uma rota válida.'
                    );
                }

                const coordenadas =
                    decodificarPolyline(
                        resultado
                            .polyline
                            .encodedPolyline
                    );

                setRota({
                    coordenadas,

                    distancia:
                        resultado.distanceMeters ??
                        0,

                    duracao:
                        resultado.duration ??
                        '',
                });

                setErro('');
            } catch (error: any) {
                console.error(
                    'Erro ao calcular rota:',
                    error?.message || error
                );

                setErro(
                    error?.message ||
                        'Não foi possível calcular a rota.'
                );
            }
        }

        calcularRota();
    }, [
        corrida?.id,
        corrida?.status,
        corrida?.origem_latitude,
        corrida?.origem_longitude,
        corrida?.destino_latitude,
        corrida?.destino_longitude,
        localizacao?.latitude,
        localizacao?.longitude,
    ]);

    // =====================================================
    // ENQUADRAR ROTA NO MAPA
    // =====================================================

    useEffect(() => {
        if (
            !rota ||
            rota.coordenadas.length < 2
        ) {
            return;
        }

        const temporizador =
            setTimeout(() => {
                mapaRef.current?.fitToCoordinates(
                    rota.coordenadas,
                    {
                        edgePadding: {
                            top: 100,
                            right: 55,
                            bottom: 240,
                            left: 55,
                        },

                        animated: true,
                    }
                );
            }, 400);

        return () =>
            clearTimeout(temporizador);
    }, [rota]);

    // =====================================================
    // CARREGAMENTO
    // =====================================================

    if (carregando && !corrida) {
        return (
            <View
                style={styles.centralizado}
            >
                <ActivityIndicator
                    size="large"
                    color="#2563EB"
                />

                <Text
                    style={
                        styles.textoCarregando
                    }
                >
                    Carregando rota da corrida...
                </Text>
            </View>
        );
    }

    // =====================================================
    // CORRIDA NÃO ENCONTRADA
    // =====================================================

    if (!corrida) {
        return (
            <View
                style={styles.centralizado}
            >
                <Text style={styles.titulo}>
                    Corrida não encontrada
                </Text>

                <Text
                    style={styles.descricao}
                >
                    {erro ||
                        'Não existe uma corrida ativa.'}
                </Text>

                <TouchableOpacity
                    style={
                        styles.botaoVoltar
                    }
                    onPress={() =>
                        router.back()
                    }
                >
                    <Text
                        style={
                            styles.botaoVoltarTexto
                        }
                    >
                        Voltar
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // =====================================================
    // AGUARDANDO LOCALIZAÇÃO
    // =====================================================

    if (!localizacao) {
        return (
            <View
                style={styles.centralizado}
            >
                <ActivityIndicator
                    size="large"
                    color="#2563EB"
                />

                <Text
                    style={
                        styles.textoCarregando
                    }
                >
                    Obtendo sua localização...
                </Text>

                {!!erro && (
                    <Text
                        style={styles.erro}
                    >
                        {erro}
                    </Text>
                )}

                <TouchableOpacity
                    style={
                        styles.botaoVoltar
                    }
                    onPress={() =>
                        router.back()
                    }
                >
                    <Text
                        style={
                            styles.botaoVoltarTexto
                        }
                    >
                        Voltar
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    // =====================================================
    // REGIÃO INICIAL
    // =====================================================

    const regiaoInicial: Region = {
        latitude: localizacao.latitude,
        longitude: localizacao.longitude,
        latitudeDelta: 0.025,
        longitudeDelta: 0.025,
    };

    // =====================================================
    // DESTINO ATUAL
    // =====================================================

    const destinoAtual: Coordenada =
        corrida.status === 'EM_ANDAMENTO'
            ? {
                latitude: Number(
                    corrida.destino_latitude
                ),

                longitude: Number(
                    corrida.destino_longitude
                ),
            }
            : {
                latitude: Number(
                    corrida.origem_latitude
                ),

                longitude: Number(
                    corrida.origem_longitude
                ),
            };

    // =====================================================
    // TELA
    // =====================================================

    return (
        <View style={styles.container}>
            <MapView
                ref={mapaRef}
                style={styles.mapa}
                initialRegion={regiaoInicial}
                showsUserLocation
                showsMyLocationButton
            >
                {/* =========================================
                    POSIÇÃO ATUAL DO MOTORISTA
                ========================================= */}

                <Marker
                    coordinate={localizacao}
                    title="Você"
                    description="Sua localização atual"
                    pinColor="#2563EB"
                />

                {/* =========================================
                    DESTINO
                ========================================= */}

                <Marker
                    coordinate={destinoAtual}
                    title={
                        corrida.status ===
                        'EM_ANDAMENTO'
                            ? 'Destino final'
                            : 'Embarque do passageiro'
                    }
                    description={
                        corrida.status ===
                        'EM_ANDAMENTO'
                            ? corrida.destino
                            : 'Ponto de encontro'
                    }
                    pinColor="#16A34A"
                />

                {/* =========================================
                    ROTA
                ========================================= */}

                {!!rota && (
                    <Polyline
                        coordinates={
                            rota.coordenadas
                        }
                        strokeColor="#2563EB"
                        strokeWidth={6}
                    />
                )}
            </MapView>

            {/* =============================================
                BOTÃO VOLTAR
            ============================================= */}

            <TouchableOpacity
                style={styles.botaoTopo}
                onPress={() =>
                    router.back()
                }
            >
                <Text
                    style={
                        styles.botaoTopoTexto
                    }
                >
                    ‹ Voltar
                </Text>
            </TouchableOpacity>

            {/* =============================================
                PAINEL INFERIOR
            ============================================= */}

            <View style={styles.painel}>
                <View style={styles.alca} />

                <Text style={styles.titulo}>
                    {corrida.status ===
                    'EM_ANDAMENTO'
                        ? 'Rota até o destino'
                        : 'Rota até o passageiro'}
                </Text>

                <Text
                    style={styles.subtitulo}
                >
                    {corrida.status ===
                    'EM_ANDAMENTO'
                        ? `Siga a rota até ${
                              corrida.destino ||
                              'o destino final'
                          }. A rota será atualizada conforme sua localização.`
                        : 'Dirija até o ponto de embarque para iniciar a corrida.'}
                </Text>

                {/* =========================================
                    RESUMO DA ROTA
                ========================================= */}

                {rota ? (
                    <View
                        style={
                            styles.resumoRota
                        }
                    >
                        <View
                            style={
                                styles.dadoRota
                            }
                        >
                            <Text
                                style={
                                    styles.dadoValor
                                }
                            >
                                {formatarDistancia(
                                    rota.distancia
                                )}
                            </Text>

                            <Text
                                style={
                                    styles.dadoLegenda
                                }
                            >
                                Distância
                            </Text>
                        </View>

                        <View
                            style={
                                styles.separador
                            }
                        />

                        <View
                            style={
                                styles.dadoRota
                            }
                        >
                            <Text
                                style={
                                    styles.dadoValor
                                }
                            >
                                {rota.duracao
                                    ? `${Math.ceil(
                                          parseInt(
                                              rota.duracao,
                                              10
                                          ) /
                                              60
                                      )} min`
                                    : '--'}
                            </Text>

                            <Text
                                style={
                                    styles.dadoLegenda
                                }
                            >
                                Tempo estimado
                            </Text>
                        </View>
                    </View>
                ) : (
                    <View
                        style={
                            styles.avisoRota
                        }
                    >
                        <ActivityIndicator
                            color="#2563EB"
                        />

                        <Text
                            style={
                                styles.avisoTexto
                            }
                        >
                            Calculando o melhor
                            caminho...
                        </Text>
                    </View>
                )}

                {/* =========================================
                    ERRO
                ========================================= */}

                {!!erro && (
                    <Text
                        style={styles.erro}
                    >
                        {erro}
                    </Text>
                )}

                {/* =========================================
                    INFORMAÇÃO GPS
                ========================================= */}

                <Text
                    style={
                        styles.atualizacao
                    }
                >
                    A posição GPS é monitorada
                    continuamente. A rota é
                    recalculada periodicamente
                    conforme o status da corrida.
                </Text>

                {/* =========================================
                    BOTÃO VOLTAR
                ========================================= */}

                <TouchableOpacity
                    style={
                        styles.botaoVoltar
                    }
                    onPress={() =>
                        router.back()
                    }
                >
                    <Text
                        style={
                            styles.botaoVoltarTexto
                        }
                    >
                        Voltar para a corrida
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// =====================================================
// ESTILOS
// =====================================================

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
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        backgroundColor: '#FFFFFF',
    },

    textoCarregando: {
        marginTop: 12,
        color: '#475569',
        fontSize: 15,
        textAlign: 'center',
    },

    botaoTopo: {
        position: 'absolute',
        top: 55,
        left: 18,
        paddingHorizontal: 18,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        elevation: 5,
    },

    botaoTopoTexto: {
        color: '#111827',
        fontSize: 15,
        fontWeight: '700',
    },

    painel: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 28,
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        elevation: 12,
    },

    alca: {
        width: 42,
        height: 5,
        borderRadius: 5,
        backgroundColor: '#D1D5DB',
        alignSelf: 'center',
        marginBottom: 16,
    },

    titulo: {
        fontSize: 22,
        fontWeight: '800',
        color: '#111827',
    },

    subtitulo: {
        fontSize: 14,
        lineHeight: 20,
        color: '#64748B',
        marginTop: 6,
    },

    resumoRota: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#EFF6FF',
        borderRadius: 16,
        paddingVertical: 16,
        marginTop: 16,
    },

    dadoRota: {
        flex: 1,
        alignItems: 'center',
    },

    dadoValor: {
        fontSize: 21,
        fontWeight: '800',
        color: '#1D4ED8',
    },

    dadoLegenda: {
        marginTop: 4,
        fontSize: 13,
        color: '#475569',
    },

    separador: {
        width: 1,
        height: 36,
        backgroundColor: '#BFDBFE',
    },

    avisoRota: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 16,
    },

    avisoTexto: {
        color: '#475569',
        fontSize: 14,
    },

    erro: {
        marginTop: 12,
        color: '#B91C1C',
        fontSize: 13,
    },

    atualizacao: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 12,
        lineHeight: 18,
    },

    botaoVoltar: {
        marginTop: 16,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        backgroundColor: '#111827',
    },

    botaoVoltarTexto: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '700',
    },

    descricao: {
        fontSize: 14,
        lineHeight: 21,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 8,
        marginBottom: 12,
    },
});