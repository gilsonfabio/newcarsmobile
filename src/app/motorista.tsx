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

import * as Location from 'expo-location';
import { router } from 'expo-router';

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

    // ==========================================================
    // DADOS DO MOTORISTA
    // ==========================================================

    const motorista = usuario?.motorista;

    const veiculo = motorista?.veiculo;

    // ==========================================================
    // ESTADOS
    // ==========================================================

    const [online, setOnline] = useState(
        motorista?.online ?? false
    );

    const [corridas, setCorridas] = useState<Corrida[]>([]);

    const [corridaAtual, setCorridaAtual] =
        useState<Corrida | null>(null);

    const [carregando, setCarregando] =
        useState(false);

    const [processando, setProcessando] =
        useState<string | null>(null);

    /*
     * Guarda a última corrida conhecida.
     *
     * É usada para detectar quando uma corrida
     * ACEITA ou EM_ANDAMENTO desapareceu.
     */
    const corridaAnteriorRef =
        useRef<Corrida | null>(null);

    /*
     * Impede duas requisições de polling
     * acontecendo simultaneamente.
     */
    const pollingEmAndamentoRef =
        useRef(false);

    /*
     * Controla se o componente ainda está montado.
     */
    const componenteAtivoRef =
        useRef(true);

    // ==========================================================
    // SINCRONIZAR STATUS ONLINE DO USUÁRIO
    // ==========================================================

    useEffect(() => {

        if (motorista) {

            setOnline(
                Boolean(motorista.online)
            );
        }

    }, [motorista]);

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

    const carregarCorridas =
        useCallback(async () => {

            /*
             * Só procura corridas se o motorista
             * estiver online.
             */
            if (!online) {
                return;
            }

            try {

                setCarregando(true);

                const response =
                    await api.get(
                        '/corridas/disponiveis'
                    );

                const lista =
                    response.data?.corridas ?? [];

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

    const carregarMinhaCorrida =
        useCallback(async () => {

            if (pollingEmAndamentoRef.current) {
                return;
            }

            pollingEmAndamentoRef.current =
                true;

            try {

                const response =
                    await api.get(
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
                 */

                const clienteCancelou =
                    corridaAnterior &&
                    !corrida &&
                    (
                        corridaAnterior.status ===
                            'ACEITA' ||
                        corridaAnterior.status ===
                            'EM_ANDAMENTO'
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

                    if (online) {

                        await carregarCorridas();
                    }

                    return;
                }

                /*
                 * Atualiza corrida atual.
                 */

                if (componenteAtivoRef.current) {

                    setCorridaAtual(
                        corrida
                    );

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

                pollingEmAndamentoRef.current =
                    false;
            }

        }, [
            online,
            carregarCorridas,
        ]);

    // ==========================================================
    // POLLING
    // ==========================================================

    useEffect(() => {

        componenteAtivoRef.current =
            true;

        let cancelado = false;

        let timeout:
            ReturnType<typeof setTimeout> | null =
            null;

        const executarPolling =
            async () => {

                if (cancelado) {
                    return;
                }

                await carregarMinhaCorrida();

                if (cancelado) {
                    return;
                }

                if (
                    online &&
                    !corridaAnteriorRef.current
                ) {

                    await carregarCorridas();
                }

                if (cancelado) {
                    return;
                }

                timeout =
                    setTimeout(
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

        // ==========================================================
        // VERIFICAR STATUS DO MOTORISTA
        // ==========================================================

        if (!motorista) {

            Alert.alert(
                'Erro',
                'Não foi possível identificar os dados do motorista.'
            );

            return;
        }

        // ==========================================================
        // MOTORISTA PENDENTE
        // ==========================================================

        if (motorista.status === 'PENDENTE') {

            Alert.alert(
                'Cadastro em análise',
                'Seu cadastro ainda está em análise. Aguarde a aprovação para começar a receber corridas.'
            );

            return;
        }

        // ==========================================================
        // MOTORISTA BLOQUEADO
        // ==========================================================

        if (motorista.status === 'BLOQUEADO') {

            Alert.alert(
                'Motorista bloqueado',
                'Seu cadastro está bloqueado. Entre em contato com o suporte para obter mais informações.'
            );

            return;
        }

        // ==========================================================
        // MOTORISTA PRECISA ESTAR ATIVO
        // ==========================================================

        if (motorista.status !== 'ATIVO') {

            Alert.alert(
                'Cadastro não autorizado',
                'Seu cadastro ainda não está autorizado para receber corridas.'
            );

            return;
        }

        // ==========================================================
        // FICAR OFFLINE
        // ==========================================================

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

        // ==========================================================
        // FICAR ONLINE
        // ==========================================================

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

    const aceitarCorrida =
        async (corridaId: string) => {

            try {

                setProcessando(
                    corridaId
                );

                const response =
                    await api.put(
                        `/corridas/${corridaId}/aceitar`
                    );

                const corridaAceita =
                    response.data?.corrida;

                if (!corridaAceita) {

                    throw new Error(
                        'Corrida não retornada pela API.'
                    );
                }

                setCorridaAtual(
                    corridaAceita
                );

                corridaAnteriorRef.current =
                    corridaAceita;

                setCorridas((lista) =>
                    lista.filter(
                        (corrida) =>
                            corrida.id !==
                            corridaId
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

    const iniciarCorrida =
        async (corridaId: string) => {

            try {

                setProcessando(
                    corridaId
                );

                const response =
                    await api.put(
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

                setCorridaAtual(
                    corridaAtualizada
                );

                corridaAnteriorRef.current =
                    corridaAtualizada;

                setCorridas((lista) =>
                    lista.filter(
                        (corrida) =>
                            corrida.id !==
                            corridaId
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

    const finalizarCorrida =
        async (corridaId: string) => {

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

                                setCorridaAtual(
                                    corridaFinalizada
                                );

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

    const textoStatus =
        (status: string) => {

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

    const atualizarTela =
        async () => {

            await carregarMinhaCorrida();

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

        const atualizarLocalizacao =
            async () => {

                if (cancelado) {
                    return;
                }

                try {

                    const { status } =
                        await Location.requestForegroundPermissionsAsync();

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

            clearInterval(
                intervalo
            );
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
                    INFORMAÇÕES DO MOTORISTA
                ================================================== */}

                {motorista && (

                    <View
                        style={
                            styles.cardMotorista
                        }
                    >

                        <View
                            style={
                                styles.cabecalhoCard
                            }
                        >

                            <View>

                                <Text
                                    style={
                                        styles.tituloCard
                                    }
                                >
                                    Seus dados
                                </Text>

                                <Text
                                    style={
                                        styles.subtituloCard
                                    }
                                >
                                    Informações do motorista
                                </Text>

                            </View>

                            <View
                                style={[
                                    styles.badgeAprovacao,

                                    motorista.status ===
                                        'ATIVO' &&
                                        styles.badgeAtivo,

                                    motorista.status ===
                                        'PENDENTE' &&
                                        styles.badgePendente,

                                    motorista.status ===
                                        'BLOQUEADO' &&
                                        styles.badgeBloqueado,
                                ]}
                            >

                                <Text
                                    style={
                                        styles.badgeAprovacaoTexto
                                    }
                                >
                                    {motorista.status ===
                                        'ATIVO'
                                        ? 'Aprovado'
                                        : motorista.status ===
                                            'PENDENTE'
                                            ? 'Em análise'
                                            : motorista.status}
                                </Text>

                            </View>

                        </View>

                        {veiculo && (

                            <>

                                <View
                                    style={
                                        styles.divisor
                                    }
                                />

                                <Text
                                    style={
                                        styles.labelVeiculo
                                    }
                                >
                                    VEÍCULO
                                </Text>

                                <View
                                    style={
                                        styles.veiculoPrincipal
                                    }
                                >

                                    <View
                                        style={
                                            styles.veiculoIcone
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.veiculoIconeTexto
                                            }
                                        >
                                            🚗
                                        </Text>
                                    </View>

                                    <View
                                        style={
                                            styles.veiculoInformacoes
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.veiculoNome
                                            }
                                        >
                                            {veiculo.marca}{' '}
                                            {veiculo.modelo}
                                        </Text>

                                        <Text
                                            style={
                                                styles.veiculoCategoria
                                            }
                                        >
                                            Categoria:{' '}
                                            {veiculo.categoria}
                                        </Text>

                                    </View>

                                </View>

                                <View
                                    style={
                                        styles.detalhesVeiculo
                                    }
                                >

                                    <View
                                        style={
                                            styles.detalheVeiculo
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.detalheLabel
                                            }
                                        >
                                            PLACA
                                        </Text>

                                        <Text
                                            style={
                                                styles.detalheValor
                                            }
                                        >
                                            {veiculo.placa}
                                        </Text>

                                    </View>

                                    <View
                                        style={
                                            styles.detalheVeiculo
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.detalheLabel
                                            }
                                        >
                                            COR
                                        </Text>

                                        <Text
                                            style={
                                                styles.detalheValor
                                            }
                                        >
                                            {veiculo.cor ||
                                                'Não informada'}
                                        </Text>

                                    </View>

                                    <View
                                        style={
                                            styles.detalheVeiculo
                                        }
                                    >

                                        <Text
                                            style={
                                                styles.detalheLabel
                                            }
                                        >
                                            ANO
                                        </Text>

                                        <Text
                                            style={
                                                styles.detalheValor
                                            }
                                        >
                                            {veiculo.ano ||
                                                'Não informado'}
                                        </Text>

                                    </View>

                                </View>

                            </>

                        )}

                    </View>
                )}

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

                    {motorista?.status === 'ATIVO' ? (

                        <TouchableOpacity
                            style={[
                                styles.botaoOnline,
                                online
                                    ? styles.botaoOffline
                                    : styles.botaoFicarOnline,
                            ]}
                            onPress={alternarOnline}
                            activeOpacity={0.85}
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

                    ) : (

                        <View style={styles.statusBloqueadoContainer}>

                            <Text style={styles.statusBloqueadoTexto}>
                                {motorista?.status === 'PENDENTE'
                                    ? 'Aguardando aprovação'
                                    : 'Indisponível'}
                            </Text>

                        </View>
                    )}

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
                                BOTÃO VER ROTA ATÉ O PASSAGEIRO
                            ================================================== */}

                            {corridaAtual.status ===
                                'ACEITA' && (

                                <TouchableOpacity
                                    style={
                                        styles.botaoVerRota
                                    }
                                    onPress={() =>
                                        router.push(
                                            '/rota-embarque'
                                        )
                                    }
                                    activeOpacity={0.85}
                                >

                                    <Text
                                        style={
                                            styles.botaoVerRotaTexto
                                        }
                                    >
                                        📍 Ver rota até o passageiro
                                    </Text>

                                </TouchableOpacity>
                            )}

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
                                ROTA ATÉ DESTINO
                            ================================================== */}

                            {corridaAtual.status ===
                                'EM_ANDAMENTO' && (

                                <TouchableOpacity
                                    style={
                                        styles.botaoVerRota
                                    }
                                    onPress={() =>
                                        router.push(
                                            '/rota-embarque'
                                        )
                                    }
                                    activeOpacity={0.85}
                                >

                                    <Text
                                        style={
                                            styles.botaoTexto
                                        }
                                    >
                                        🗺️ Ver rota até o destino
                                    </Text>

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
                                FINALIZADA
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
                                CANCELADA
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

                            corridas.map(
                                (corrida) => (

                                    <View
                                        key={
                                            corrida.id
                                        }
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
                                            {
                                                corrida.destino
                                            }
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
                                )
                            )
                        )}

                    </View>
                )}

                {/* ==================================================
                    OFFLINE
                ================================================== */}

                {!online &&
                    !corridaAtual &&
                    motorista?.status === 'PENDENTE' && (

                    <View
                        style={[
                            styles.vazio,
                            styles.cardPendente,
                        ]}
                    >

                        <Text
                            style={
                                styles.iconePendente
                            }
                        >
                            ⏳
                        </Text>

                        <Text
                            style={
                                styles.vazioTitulo
                            }
                        >
                            Cadastro em análise
                        </Text>

                        <Text
                            style={
                                styles.vazioTexto
                            }
                        >
                            Seu cadastro de motorista foi recebido
                            e está aguardando aprovação.
                        </Text>

                        <Text
                            style={
                                styles.vazioTexto
                            }
                        >
                            Assim que seu cadastro for aprovado,
                            você poderá ficar online e receber corridas.
                        </Text>

                    </View>
                )}

                {!online &&
                    !corridaAtual &&
                    motorista?.status === 'BLOQUEADO' && (

                    <View
                        style={[
                            styles.vazio,
                            styles.cardBloqueado,
                        ]}
                    >

                        <Text
                            style={
                                styles.iconePendente
                            }
                        >
                            ⚠️
                        </Text>

                        <Text
                            style={
                                styles.vazioTitulo
                            }
                        >
                            Cadastro bloqueado
                        </Text>

                        <Text
                            style={
                                styles.vazioTexto
                            }
                        >
                            Seu cadastro de motorista está bloqueado
                            e você não pode receber corridas no momento.
                        </Text>

                        <Text
                            style={
                                styles.vazioTexto
                            }
                        >
                            Entre em contato com o suporte para mais informações.
                        </Text>

                    </View>
                )}

                {!online &&
                    !corridaAtual &&
                    motorista?.status === 'ATIVO' && (

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

    // ======================================================
    // CARD MOTORISTA
    // ======================================================

    cardMotorista: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        marginBottom: 20,

        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.08,
        shadowRadius: 4,

        elevation: 2,
    },

    cabecalhoCard: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    tituloCard: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },

    subtituloCard: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 3,
    },

    badgeAprovacao: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#e5e7eb',
    },

    badgeAtivo: {
        backgroundColor: '#dcfce7',
    },

    badgePendente: {
        backgroundColor: '#fef3c7',
    },

    badgeBloqueado: {
        backgroundColor: '#fee2e2',
    },

    badgeAprovacaoTexto: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
    },

    labelVeiculo: {
        fontSize: 11,
        color: '#9ca3af',
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 10,
    },

    veiculoPrincipal: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    veiculoIcone: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    veiculoIconeTexto: {
        fontSize: 25,
    },

    veiculoInformacoes: {
        flex: 1,
    },

    veiculoNome: {
        fontSize: 17,
        fontWeight: '700',
        color: '#111827',
    },

    veiculoCategoria: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 4,
    },

    detalhesVeiculo: {
        flexDirection: 'row',
        marginTop: 18,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },

    detalheVeiculo: {
        flex: 1,
    },

    detalheLabel: {
        fontSize: 10,
        fontWeight: '800',
        color: '#9ca3af',
        marginBottom: 4,
    },

    detalheValor: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },

    // ======================================================
    // ONLINE
    // ======================================================

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

    // ======================================================
    // CORRIDAS
    // ======================================================

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

    botaoVerRota: {
        marginTop: 14,
        marginBottom: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#2563EB',
        alignItems: 'center',
        justifyContent: 'center',
    },

    botaoVerRotaTexto: {
        color: '#FFFFFF',
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

    statusBloqueadoContainer: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        maxWidth: 170,
    },

    statusBloqueadoTexto: {
        color: '#92400e',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },

    cardPendente: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
},

cardBloqueado: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
},

iconePendente: {
    fontSize: 36,
    marginBottom: 10,
},
    
});