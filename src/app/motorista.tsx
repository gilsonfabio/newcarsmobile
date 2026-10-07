import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { router } from 'expo-router';
import * as Location from 'expo-location';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

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
}

export default function Motorista() {

    const { usuario, logout } = useAuth();
    const [online, setOnline] = useState(false);
    const [corridas, setCorridas] = useState<Corrida[]>([]);
    const [corridaAtual, setCorridaAtual] = useState<Corrida | null>(null);
    const [carregando, setCarregando] = useState(false);
    const [processando, setProcessando] = useState<string | null>(null);

    /*
     * Guarda a última corrida conhecida.
     *
     * É usada para detectar quando uma corrida
     * ACEITA ou EM_ANDAMENTO desapareceu.
     */
    const corridaAnteriorRef = useRef<Corrida | null>(null);

    /*
     * Impede duas requisições de polling
     * acontecendo simultaneamente.
     */
    const pollingEmAndamentoRef = useRef(false);

    /*
     * Controla se o componente ainda está montado.
     */
    const componenteAtivoRef = useRef(true);

    // ==========================================================
    // ATUALIZAR LOCALIZAÇÃO NO BACKEND
    // ==========================================================

    const enviarLocalizacao = useCallback(
        async (marcarOnline = false) => {
            try {
                const { status } =
                    await Location.requestForegroundPermissionsAsync();

                if (status !== 'granted') {

                    console.log(
                        'Permissão de localização não concedida.'
                    );

                    if (marcarOnline) {

                        Alert.alert(
                            'Localização necessária',
                            'É necessário permitir o acesso à localização para ficar online.'
                        );
                    }

                    return false;
                }

                const localizacao =
                    await Location.getCurrentPositionAsync({
                        accuracy:
                            Location.Accuracy.High,
                    });

                const latitude =
                    localizacao.coords.latitude;

                const longitude =
                    localizacao.coords.longitude;

                console.log(
                    'Localização motorista:',
                    latitude,
                    longitude
                );

                const response =
                    await api.put(
                        '/motoristas/localizacao',
                        {
                            latitude,
                            longitude,
                            ...(marcarOnline
                                ? { online: true }
                                : {}),
                        }
                    );

                console.log(
                    'Localização enviada:',
                    response.data
                );

                return true;

            } catch (error: any) {

                console.error(
                    'Erro ao atualizar localização:',
                    error?.response?.data || error
                );

                if (marcarOnline) {

                    Alert.alert(
                        'Erro',
                        error?.response?.data?.error ||
                        'Não foi possível ativar o modo online.'
                    );
                }

                return false;
            }
        },
        []
    );

    // ==========================================================
    // LOGOUT
    // ==========================================================

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

                        await logout();

                        router.replace('/login');
                    },
                },
            ]
        );
    };

    // ==========================================================
    // BUSCAR CORRIDAS DISPONÍVEIS
    // ==========================================================

    const carregarCorridas = useCallback(async () => {

        /*
         * Só procura corridas se o motorista
         * estiver online.
         */
        if (!online) {
            return;
        }

        try {

            setCarregando(true);

            const response = await api.get(
                '/corridas/disponiveis'
            );

            const lista =
                response.data?.corridas ?? [];

            /*
             * Só atualiza o estado se o componente
             * ainda estiver montado.
             */
            if (componenteAtivoRef.current) {
                setCorridas(lista);
            }

        } catch (error: any) {

            console.error(
                'Erro ao buscar corridas:',
                error?.response?.data || error
            );

        } finally {

            if (componenteAtivoRef.current) {
                setCarregando(false);
            }
        }

    }, [online]);

    // ==========================================================
    // BUSCAR MINHA CORRIDA
    // ==========================================================

    const carregarMinhaCorrida = useCallback(async () => {

        /*
         * Se já existe uma consulta acontecendo,
         * não inicia outra.
         */
        if (pollingEmAndamentoRef.current) {
            return;
        }

        pollingEmAndamentoRef.current = true;

        try {

            const response = await api.get(
                '/corridas/minha'
            );

            const corrida =
                response.data?.corrida ?? null;

            const corridaAnterior =
                corridaAnteriorRef.current;

            /*
             * ==================================================
             * DETECTAR CANCELAMENTO
             * ==================================================
             *
             * Só considera cancelamento quando:
             *
             * corrida anterior:
             * ACEITA ou EM_ANDAMENTO
             *
             * corrida atual:
             * null
             *
             * FINALIZADA não entra nessa condição.
             */
            const clienteCancelou =
                corridaAnterior &&
                !corrida &&
                (
                    corridaAnterior.status === 'ACEITA' ||
                    corridaAnterior.status === 'EM_ANDAMENTO'
                );

            if (clienteCancelou) {

                console.log(
                    'Cliente cancelou a corrida:',
                    corridaAnterior.id
                );

                if (componenteAtivoRef.current) {

                    setCorridaAtual(null);

                    corridaAnteriorRef.current =
                        null;

                    Alert.alert(
                        'Corrida cancelada',
                        'O cliente cancelou a corrida.'
                    );
                }

                /*
                 * Depois do cancelamento,
                 * atualiza as corridas disponíveis.
                 *
                 * Não chama carregarMinhaCorrida
                 * novamente aqui.
                 */
                if (online) {
                    await carregarCorridas();
                }

                return;
            }

            /*
             * Atualiza a corrida atual.
             */
            if (componenteAtivoRef.current) {

                setCorridaAtual(corrida);

                corridaAnteriorRef.current =
                    corrida;

                console.log(
                    'Minha corrida:',
                    corrida
                );
            }

        } catch (error: any) {

            console.error(
                'Erro ao buscar minha corrida:',
                error?.response?.data || error
            );

        } finally {

            /*
             * Libera a trava.
             */
            pollingEmAndamentoRef.current =
                false;
        }

    }, [
        online,
        carregarCorridas,
    ]);

    // ==========================================================
    // POLLING INTELIGENTE
    // ==========================================================

    useEffect(() => {

        componenteAtivoRef.current = true;

        let cancelado = false;
        let timeout: ReturnType<typeof setTimeout> | null =
            null;

        const executarPolling = async () => {

            if (cancelado) {
                return;
            }

            /*
             * Sempre verifica minha corrida.
             *
             * Isso permite recuperar uma corrida ativa
             * quando o motorista abre o aplicativo.
             */
            await carregarMinhaCorrida();

            if (cancelado) {
                return;
            }

            /*
             * Se o motorista está online e não possui
             * uma corrida atual, busca corridas disponíveis.
             */
            if (
                online &&
                !corridaAnteriorRef.current
            ) {
                await carregarCorridas();
            }

            if (cancelado) {
                return;
            }

            /*
             * Agenda o próximo ciclo SOMENTE depois
             * que o ciclo atual terminou.
             *
             * Isso evita sobreposição de requisições.
             */
            timeout = setTimeout(
                executarPolling,
                3000
            );
        };

        executarPolling();

        return () => {

            cancelado = true;

            componenteAtivoRef.current =
                false;

            if (timeout) {
                clearTimeout(timeout);
            }

        };

    }, [
        carregarMinhaCorrida,
        carregarCorridas,
        online,
    ]);

    // ==========================================================
    // ALTERNAR ONLINE / OFFLINE
    // ==========================================================

    const alternarOnline = async () => {

        // ======================================================
        // FICAR OFFLINE
        // ======================================================

        if (online) {

            try {

                await api.put(
                    '/motoristas/localizacao',
                    {
                        online: false,
                    }
                );

                setOnline(false);

                setCorridas([]);

                console.log(
                    'Motorista ficou offline.'
                );

            } catch (error: any) {

                console.error(
                    'Erro ao ficar offline:',
                    error?.response?.data || error
                );

                Alert.alert(
                    'Erro',
                    error?.response?.data?.error ||
                    'Não foi possível ficar offline.'
                );
            }

            return;
        }

        // ======================================================
        // FICAR ONLINE
        // ======================================================

        setCarregando(true);

        const sucesso =
            await enviarLocalizacao(true);

        if (!sucesso) {

            setCarregando(false);

            return;
        }

        setOnline(true);

        setCarregando(false);

        console.log(
            'Motorista ficou online.'
        );
    };

    // ==========================================================
    // ACEITAR CORRIDA
    // ==========================================================

    const aceitarCorrida = async (
        corridaId: string
    ) => {

        try {

            setProcessando(corridaId);

            const response = await api.put(
                `/corridas/${corridaId}/aceitar`
            );

            const corridaAceita =
                response.data?.corrida;

            if (!corridaAceita) {

                throw new Error(
                    'Corrida não retornada pela API.'
                );
            }

            /*
             * Coloca a corrida como corrida atual.
             */
            setCorridaAtual(
                corridaAceita
            );

            /*
             * Atualiza a referência imediatamente.
             */
            corridaAnteriorRef.current =
                corridaAceita;

            /*
             * Remove a corrida da lista.
             */
            setCorridas((lista) =>
                lista.filter(
                    (corrida) =>
                        corrida.id !== corridaId
                )
            );

            Alert.alert(
                'Corrida aceita',
                'A corrida foi atribuída a você.'
            );

        } catch (error: any) {

            console.error(
                'Erro ao aceitar corrida:',
                error?.response?.data || error
            );

            Alert.alert(
                'Erro',
                error?.response?.data?.error ||
                'Não foi possível aceitar a corrida.'
            );

            /*
             * Atualiza a lista somente se ainda
             * estiver online.
             */
            if (online) {
                await carregarCorridas();
            }

        } finally {

            setProcessando(null);
        }
    };

    // ==========================================================
    // INICIAR CORRIDA
    // ==========================================================

    const iniciarCorrida = async (
        corridaId: string
    ) => {

        try {

            setProcessando(corridaId);

            const response = await api.put(
                `/corridas/${corridaId}/iniciar`
            );

            console.log(
                'Resposta iniciar corrida:',
                response.data
            );

            const corridaAtualizada =
                response.data?.corrida;

            if (!corridaAtualizada) {

                throw new Error(
                    'A API não retornou a corrida atualizada.'
                );
            }

            /*
             * Atualiza a tela.
             */
            setCorridaAtual(
                corridaAtualizada
            );

            /*
             * Atualiza a referência.
             */
            corridaAnteriorRef.current =
                corridaAtualizada;

            /*
             * Remove da lista de disponíveis.
             */
            setCorridas((lista) =>
                lista.filter(
                    (corrida) =>
                        corrida.id !== corridaId
                )
            );

            Alert.alert(
                'Corrida iniciada',
                'A corrida está em andamento.'
            );

        } catch (error: any) {

            console.error(
                'Erro ao iniciar corrida:',
                error?.response?.data || error
            );

            Alert.alert(
                'Erro',
                error?.response?.data?.error ||
                'Não foi possível iniciar a corrida.'
            );

        } finally {

            setProcessando(null);
        }
    };

    // ==========================================================
    // FINALIZAR CORRIDA
    // ==========================================================

    const finalizarCorrida = async (
        corridaId: string
    ) => {

        Alert.alert(
            'Finalizar corrida',
            'Deseja realmente finalizar esta corrida?',
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Finalizar',
                    style: 'destructive',

                    onPress: async () => {

                        try {

                            setProcessando(
                                corridaId
                            );

                            const response =
                                await api.put(
                                    `/corridas/${corridaId}/finalizar`
                                );

                            const corridaFinalizada =
                                response.data?.corrida;

                            if (!corridaFinalizada) {

                                throw new Error(
                                    'Corrida não retornada pela API.'
                                );
                            }

                            /*
                             * Mantém a corrida finalizada
                             * na tela.
                             */
                            setCorridaAtual(
                                corridaFinalizada
                            );

                            /*
                             * IMPORTANTE:
                             *
                             * Guarda FINALIZADA.
                             *
                             * O polling nunca interpretará
                             * FINALIZADA como cancelamento.
                             */
                            corridaAnteriorRef.current =
                                corridaFinalizada;

                            Alert.alert(
                                'Corrida finalizada',
                                'A corrida foi concluída com sucesso.'
                            );

                        } catch (error: any) {

                            console.error(
                                'Erro ao finalizar corrida:',
                                error?.response?.data || error
                            );

                            Alert.alert(
                                'Erro',
                                error?.response?.data?.error ||
                                'Não foi possível finalizar a corrida.'
                            );

                        } finally {

                            setProcessando(null);
                        }
                    },
                },
            ]
        );
    };

    // ==========================================================
    // STATUS DA CORRIDA
    // ==========================================================

    const textoStatus = (
        status: string
    ) => {

        switch (status) {

            case 'SOLICITADA':
                return 'Solicitada';

            case 'ACEITA':
                return 'Aceita';

            case 'EM_ANDAMENTO':
                return 'Em andamento';

            case 'FINALIZADA':
                return 'Finalizada';

            case 'CANCELADA':
                return 'Cancelada';

            default:
                return status;
        }
    };

    // ==========================================================
    // REFRESH MANUAL
    // ==========================================================

    const atualizarTela = async () => {

        await carregarMinhaCorrida();

        /*
         * Só consulta disponíveis se estiver online
         * e sem corrida ativa.
         */
        if (
            online &&
            !corridaAnteriorRef.current
        ) {
            await carregarCorridas();
        }
    };

    // ==========================================================
    // ATUALIZAÇÃO PERIÓDICA DA LOCALIZAÇÃO
    // ==========================================================

    useEffect(() => {
        if (!online) {
            return;
        }

        let cancelado = false;

        const atualizarLocalizacao = async () => {
            if (cancelado) {
                return;
            }

            try {
                const { status } = await Location.requestForegroundPermissionsAsync();

                if (status !== 'granted') {
                    console.log(
                        'Permissão de localização não concedida.'
                    );
                    return;
                }

                const localizacao =
                    await Location.getCurrentPositionAsync({
                        accuracy:
                            Location.Accuracy.High,
                    });

                if (cancelado) {
                    return;
                }

                const latitude =
                    localizacao.coords.latitude;

                const longitude =
                    localizacao.coords.longitude;

                console.log(
                    'Atualizando posição:',
                    latitude,
                    longitude
                );

                await api.put(
                    '/motoristas/localizacao',
                    {
                        latitude,
                        longitude,
                    }
                );

            } catch (error: any) {

                console.error(
                    'Erro na atualização automática da localização:',
                    error?.response?.data || error
                );

            }
        };

        atualizarLocalizacao();

        const intervalo =
            setInterval(
                atualizarLocalizacao,
                15000
            );

        return () => {

            cancelado = true;

            clearInterval(intervalo);

        };

    }, [online]);

    // ==========================================================
    // RENDER
    // ==========================================================

    return (
        <View style={styles.container}>

            {/* ==================================================
                CABEÇALHO
            ================================================== */}

            <View style={styles.cabecalho}>

                <View>

                    <Text style={styles.titulo}>
                        Motorista
                    </Text>

                    <Text style={styles.usuario}>
                        {usuario?.name || 'Motorista'}
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

            <ScrollView
                contentContainerStyle={
                    styles.conteudo
                }
                refreshControl={
                    <RefreshControl
                        refreshing={carregando}
                        onRefresh={atualizarTela}
                    />
                }
            >

                {/* ==================================================
                    STATUS ONLINE
                ================================================== */}

                <View style={styles.cardOnline}>

                    <View>

                        <Text style={styles.label}>
                            Status
                        </Text>

                        <Text
                            style={[
                                styles.statusOnline,
                                online
                                    ? styles.online
                                    : styles.offline,
                            ]}
                        >
                            {online
                                ? '● Online'
                                : '● Offline'}
                        </Text>

                    </View>

                    <TouchableOpacity
                        style={[
                            styles.botaoOnline,
                            online
                                ? styles.botaoOffline
                                : styles.botaoFicarOnline,
                        ]}
                        onPress={alternarOnline}
                    >

                        <Text
                            style={
                                styles.botaoOnlineTexto
                            }
                        >
                            {online
                                ? 'Ficar offline'
                                : 'Ficar online'}
                        </Text>

                    </TouchableOpacity>

                </View>

                {/* ==================================================
                    MINHA CORRIDA
                ================================================== */}

                {corridaAtual && (

                    <View
                        style={
                            styles.areaCorridaAtual
                        }
                    >

                        <Text
                            style={
                                styles.tituloSecao
                            }
                        >
                            Minha corrida
                        </Text>

                        <View
                            style={
                                styles.cardCorridaAtual
                            }
                        >

                            <View
                                style={
                                    styles.linhaStatus
                                }
                            >

                                <Text
                                    style={
                                        styles.label
                                    }
                                >
                                    Status
                                </Text>

                                <Text
                                    style={[
                                        styles.statusAtual,

                                        corridaAtual.status ===
                                            'ACEITA' &&
                                            styles.statusAceita,

                                        corridaAtual.status ===
                                            'EM_ANDAMENTO' &&
                                            styles.statusAndamento,

                                        corridaAtual.status ===
                                            'FINALIZADA' &&
                                            styles.statusFinalizada,

                                        corridaAtual.status ===
                                            'CANCELADA' &&
                                            styles.statusCancelada,
                                    ]}
                                >
                                    {textoStatus(
                                        corridaAtual.status
                                    )}
                                </Text>

                            </View>

                            <View
                                style={
                                    styles.divisor
                                }
                            />

                            <Text
                                style={
                                    styles.label
                                }
                            >
                                Destino
                            </Text>

                            <Text
                                style={
                                    styles.destino
                                }
                            >
                                {corridaAtual.destino}
                            </Text>

                            <Text
                                style={
                                    styles.coordenadas
                                }
                            >
                                Latitude:{' '}
                                {
                                    corridaAtual
                                        .destino_latitude
                                }
                            </Text>

                            <Text
                                style={
                                    styles.coordenadas
                                }
                            >
                                Longitude:{' '}
                                {
                                    corridaAtual
                                        .destino_longitude
                                }
                            </Text>

                            {/* ==================================================
                                BOTÃO INICIAR
                            ================================================== */}

                            {corridaAtual.status ===
                                'ACEITA' && (

                                <TouchableOpacity
                                    style={
                                        styles.botaoIniciar
                                    }
                                    disabled={
                                        processando ===
                                        corridaAtual.id
                                    }
                                    onPress={() =>
                                        iniciarCorrida(
                                            corridaAtual.id
                                        )
                                    }
                                >

                                    {processando ===
                                    corridaAtual.id ? (

                                        <ActivityIndicator
                                            color="#fff"
                                        />

                                    ) : (

                                        <Text
                                            style={
                                                styles.botaoTexto
                                            }
                                        >
                                            Iniciar corrida
                                        </Text>

                                    )}

                                </TouchableOpacity>
                            )}

                            {/* ==================================================
                                BOTÃO FINALIZAR
                            ================================================== */}

                            {corridaAtual.status ===
                                'EM_ANDAMENTO' && (

                                <TouchableOpacity
                                    style={
                                        styles.botaoFinalizar
                                    }
                                    disabled={
                                        processando ===
                                        corridaAtual.id
                                    }
                                    onPress={() =>
                                        finalizarCorrida(
                                            corridaAtual.id
                                        )
                                    }
                                >

                                    {processando ===
                                    corridaAtual.id ? (

                                        <ActivityIndicator
                                            color="#fff"
                                        />

                                    ) : (

                                        <Text
                                            style={
                                                styles.botaoTexto
                                            }
                                        >
                                            Finalizar corrida
                                        </Text>

                                    )}

                                </TouchableOpacity>
                            )}

                            {/* ==================================================
                                CORRIDA FINALIZADA
                            ================================================== */}

                            {corridaAtual.status ===
                                'FINALIZADA' && (

                                <View
                                    style={
                                        styles.finalizada
                                    }
                                >

                                    <Text
                                        style={
                                            styles.finalizadaTexto
                                        }
                                    >
                                        ✓ Corrida concluída
                                    </Text>

                                </View>
                            )}

                            {/* ==================================================
                                CORRIDA CANCELADA
                            ================================================== */}

                            {corridaAtual.status ===
                                'CANCELADA' && (

                                <View
                                    style={
                                        styles.cancelada
                                    }
                                >

                                    <Text
                                        style={
                                            styles.canceladaTexto
                                        }
                                    >
                                        Corrida cancelada pelo cliente
                                    </Text>

                                </View>
                            )}

                        </View>

                    </View>
                )}

                {/* ==================================================
                    CORRIDAS DISPONÍVEIS
                ================================================== */}

                {online && !corridaAtual && (

                    <View>

                        <View
                            style={
                                styles.cabecalhoSecao
                            }
                        >

                            <Text
                                style={
                                    styles.tituloSecao
                                }
                            >
                                Corridas disponíveis
                            </Text>

                            <TouchableOpacity
                                onPress={
                                    carregarCorridas
                                }
                            >
                                <Text
                                    style={
                                        styles.atualizarTexto
                                    }
                                >
                                    Atualizar
                                </Text>
                            </TouchableOpacity>

                        </View>

                        {carregando ? (

                            <View
                                style={
                                    styles.carregando
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
                                    Buscando corridas...
                                </Text>

                            </View>

                        ) : corridas.length === 0 ? (

                            <View
                                style={
                                    styles.vazio
                                }
                            >

                                <Text
                                    style={
                                        styles.vazioTitulo
                                    }
                                >
                                    Nenhuma corrida disponível
                                </Text>

                                <Text
                                    style={
                                        styles.vazioTexto
                                    }
                                >
                                    Aguarde novas solicitações.
                                </Text>

                            </View>

                        ) : (

                            corridas.map((corrida) => (

                                <View
                                    key={corrida.id}
                                    style={
                                        styles.cardCorrida
                                    }
                                >

                                    <Text
                                        style={
                                            styles.corridaTitulo
                                        }
                                    >
                                        Nova corrida
                                    </Text>

                                    <View
                                        style={
                                            styles.divisor
                                        }
                                    />

                                    <Text
                                        style={
                                            styles.label
                                        }
                                    >
                                        Origem
                                    </Text>

                                    <Text
                                        style={
                                            styles.coordenadas
                                        }
                                    >
                                        Latitude:{' '}
                                        {
                                            corrida
                                                .origem_latitude
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.coordenadas
                                        }
                                    >
                                        Longitude:{' '}
                                        {
                                            corrida
                                                .origem_longitude
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.labelDestino
                                        }
                                    >
                                        Destino
                                    </Text>

                                    <Text
                                        style={
                                            styles.destino
                                        }
                                    >
                                        {corrida.destino}
                                    </Text>

                                    <Text
                                        style={
                                            styles.coordenadas
                                        }
                                    >
                                        Latitude:{' '}
                                        {
                                            corrida
                                                .destino_latitude
                                        }
                                    </Text>

                                    <Text
                                        style={
                                            styles.coordenadas
                                        }
                                    >
                                        Longitude:{' '}
                                        {
                                            corrida
                                                .destino_longitude
                                        }
                                    </Text>

                                    <TouchableOpacity
                                        style={
                                            styles.botaoAceitar
                                        }
                                        disabled={
                                            processando ===
                                            corrida.id
                                        }
                                        onPress={() =>
                                            aceitarCorrida(
                                                corrida.id
                                            )
                                        }
                                    >

                                        {processando ===
                                        corrida.id ? (

                                            <ActivityIndicator
                                                color="#fff"
                                            />

                                        ) : (

                                            <Text
                                                style={
                                                    styles.botaoTexto
                                                }
                                            >
                                                Aceitar corrida
                                            </Text>

                                        )}

                                    </TouchableOpacity>

                                </View>

                            ))
                        )}

                    </View>
                )}

                {/* ==================================================
                    OFFLINE
                ================================================== */}

                {!online &&
                    !corridaAtual && (

                    <View
                        style={
                            styles.vazio
                        }
                    >

                        <Text
                            style={
                                styles.vazioTitulo
                            }
                        >
                            Você está offline
                        </Text>

                        <Text
                            style={
                                styles.vazioTexto
                            }
                        >
                            Fique online para receber
                            corridas.
                        </Text>

                    </View>
                )}

            </ScrollView>

        </View>
    );
}

// ==========================================================
// ESTILOS
// ==========================================================

const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },

    cabecalho: {
        paddingTop: 55,
        paddingBottom: 18,
        paddingHorizontal: 20,
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    titulo: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '700',
    },

    usuario: {
        color: '#d1d5db',
        fontSize: 14,
        marginTop: 4,
    },

    botaoSair: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#374151',
    },

    botaoSairTexto: {
        color: '#ffffff',
        fontWeight: '600',
    },

    conteudo: {
        padding: 16,
        paddingBottom: 40,
    },

    cardOnline: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,

        elevation: 2,
    },

    label: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 4,
        fontWeight: '600',
    },

    statusOnline: {
        fontSize: 16,
        fontWeight: '700',
    },

    online: {
        color: '#16a34a',
    },

    offline: {
        color: '#6b7280',
    },

    botaoOnline: {
        paddingHorizontal: 16,
        paddingVertical: 11,
        borderRadius: 10,
    },

    botaoFicarOnline: {
        backgroundColor: '#16a34a',
    },

    botaoOffline: {
        backgroundColor: '#6b7280',
    },

    botaoOnlineTexto: {
        color: '#ffffff',
        fontWeight: '700',
    },

    tituloSecao: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },

    cabecalhoSecao: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    atualizarTexto: {
        color: '#2563eb',
        fontWeight: '600',
        marginBottom: 12,
    },

    areaCorridaAtual: {
        marginBottom: 24,
    },

    cardCorridaAtual: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,

        elevation: 2,
    },

    linhaStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    statusAtual: {
        fontSize: 15,
        fontWeight: '700',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#e5e7eb',
        color: '#374151',
    },

    statusAceita: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
    },

    statusAndamento: {
        backgroundColor: '#dbeafe',
        color: '#1d4ed8',
    },

    statusFinalizada: {
        backgroundColor: '#dcfce7',
        color: '#166534',
    },

    statusCancelada: {
        backgroundColor: '#fee2e2',
        color: '#991b1b',
    },

    divisor: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 14,
    },

    destino: {
        fontSize: 16,
        color: '#111827',
        fontWeight: '600',
        marginBottom: 8,
    },

    coordenadas: {
        fontSize: 13,
        color: '#6b7280',
        marginBottom: 3,
    },

    botaoIniciar: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 18,
    },

    botaoFinalizar: {
        backgroundColor: '#16a34a',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 18,
    },

    botaoAceitar: {
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 18,
    },

    botaoTexto: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },

    finalizada: {
        marginTop: 18,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
    },

    finalizadaTexto: {
        color: '#166534',
        fontSize: 15,
        fontWeight: '700',
    },

    cancelada: {
        marginTop: 18,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#fee2e2',
        alignItems: 'center',
    },

    canceladaTexto: {
        color: '#991b1b',
        fontSize: 15,
        fontWeight: '700',
    },

    cardCorrida: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        marginBottom: 14,

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,

        elevation: 2,
    },

    corridaTitulo: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },

    labelDestino: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 14,
        marginBottom: 4,
        fontWeight: '600',
    },

    carregando: {
        alignItems: 'center',
        paddingVertical: 40,
    },

    carregandoTexto: {
        marginTop: 10,
        color: '#6b7280',
    },

    vazio: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 30,
        alignItems: 'center',
        marginTop: 10,
    },

    vazioTitulo: {
        fontSize: 17,
        fontWeight: '700',
        color: '#374151',
        textAlign: 'center',
    },

    vazioTexto: {
        fontSize: 14,
        color: '#6b7280',
        marginTop: 8,
        textAlign: 'center',
    },
});
