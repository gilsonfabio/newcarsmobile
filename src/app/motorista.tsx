
import {
    ActivityIndicator,
    Alert,
    AppState,
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

// ==========================================================
// INTERFACES
// ==========================================================

interface PagamentoCorrida {
    id: string;
    corrida_id: string;
    modalidade: 'PRESENCIAL' | 'ONLINE';
    forma_pagamento: 'DINHEIRO' | 'PIX' | 'CARTAO';
    status: string;
    valor_bruto: number | string;
    percentual_comissao?: number | string;
    graduacao_nome?: string | null;
    valor_comissao?: number | string;
    valor_liquido?: number | string;
    gateway?: string | null;
    confirmado_em?: string | null;
    tipo_confirmacao?: string | null;
}

interface Corrida {
    id: string;
    cliente_id: string;
    origem: string;
    origem_latitude: number;
    origem_longitude: number;
    destino: string;
    destino_latitude: number;
    destino_longitude: number;
    motorista_id: string | null;
    status: string;
    valor: number | null;
    pagamento?: PagamentoCorrida | null;
}

export default function Motorista() {
    const { usuario, logout } = useAuth();

    const motorista = usuario?.motorista;
    const veiculo = motorista?.veiculo;

    // ==========================================================
    // ESTADOS
    // ==========================================================

    const [online, setOnline] = useState(Boolean(motorista?.online ?? false));

    const saindoRef = useRef(false);

    const [corridas, setCorridas] = useState<Corrida[]>([]);
    const [corridaAtual, setCorridaAtual] = useState<Corrida | null>(null);

    const [carregando, setCarregando] = useState(false);
    const [processando, setProcessando] = useState<string | null>(null);

    const [confirmandoPagamento, setConfirmandoPagamento] = useState(false);

    // ==========================================================
    // REFERÊNCIAS
    // ==========================================================

    const appAtivoRef = useRef(AppState.currentState === 'active');

    const corridaAnteriorRef = useRef<Corrida | null>(null);
    const pollingEmAndamentoRef = useRef(false);
    const componenteAtivoRef = useRef(true);

    // ==========================================================
    // STATUS DO MOTORISTA
    // ==========================================================

    const statusMotorista = String(
        motorista?.status ?? ''
    ).toUpperCase();

    const motoristaAprovado =
        statusMotorista === 'APROVADO';

    const motoristaPendente =
        statusMotorista === 'PENDENTE';

    const motoristaBloqueado =
        statusMotorista === 'BLOQUEADO';

    // ==========================================================
    // ESTADO DO APLICATIVO
    // ==========================================================

    useEffect(() => {
        const subscription = AppState.addEventListener(
            'change',
            (nextAppState) => {
                const estavaAtivo = appAtivoRef.current;
                const estaAtivo = nextAppState === 'active';

                appAtivoRef.current = estaAtivo;

                if (!estavaAtivo && estaAtivo) {
                    console.log(
                        'Aplicativo voltou ao primeiro plano.'
                    );
                }
            }
        );

        return () => {
            subscription.remove();
        };
    }, []);

    // ==========================================================
    // SINCRONIZAR STATUS ONLINE
    // ==========================================================

    useEffect(() => {
        if (motorista) {
            setOnline(Boolean(motorista.online));
        }
    }, [motorista]);

    // ==========================================================
    // ENVIAR LOCALIZAÇÃO
    // ==========================================================

    const enviarLocalizacao = useCallback(
        async (marcarOnline = false): Promise<boolean> => {
            try {
                if (!appAtivoRef.current) {
                    return false;
                }

                const { status } =
                    await Location.requestForegroundPermissionsAsync();

                if (status !== 'granted') {
                    if (marcarOnline) {
                        Alert.alert(
                            'Localização necessária',
                            'Permita o acesso à localização para ficar online.'
                        );
                    }

                    return false;
                }

                if (!appAtivoRef.current) {
                    return false;
                }

                const localizacao =
                    await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });

                if (!appAtivoRef.current) {
                    return false;
                }

                const response = await api.put(
                    '/motoristas/localizacao',
                    {
                        latitude: localizacao.coords.latitude,
                        longitude: localizacao.coords.longitude,
                        ...(marcarOnline ? { online: true } : {}),
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
                        if (saindoRef.current) {
                            return;
                        }

                        saindoRef.current = true;
                        componenteAtivoRef.current = false;

                        try {
                            await logout();
                        } catch (error) {
                            console.error('Erro ao sair da conta:', error);
                        } finally {
                            router.replace('/login');
                        }
                    },
                },
            ]
        );
    };

    // ==========================================================
    // BUSCAR CORRIDAS DISPONÍVEIS
    // ==========================================================

    const carregarCorridas = useCallback(async () => {
        if (!componenteAtivoRef.current || !appAtivoRef.current) {
            return;
        }

        if (
            !appAtivoRef.current ||
            !online ||
            !motoristaAprovado
        ) {
            return;
        }

        try {
            if (componenteAtivoRef.current) {
                setCarregando(true);
            }

            const response = await api.get(
                '/corridas/disponiveis'
            );

            const lista: Corrida[] =
                response.data?.corridas ?? [];

            if (
                componenteAtivoRef.current &&
                appAtivoRef.current
            ) {
                setCorridas(lista);
            }
        } catch (error: any) {
            const status = error?.response?.status;
            const mensagem = error?.response?.data?.error;

            if (
                !appAtivoRef.current &&
                (
                    status === 401 ||
                    mensagem === 'Token não informado.' ||
                    mensagem === 'Token inválido.'
                )
            ) {
                return;
            }

            console.error(
                'Erro ao buscar corridas:',
                error?.response?.data || error
            );
        } finally {
            if (componenteAtivoRef.current) {
                setCarregando(false);
            }
        }
    }, [online, motoristaAprovado]);

    // ==========================================================
    // BUSCAR MINHA CORRIDA
    // ==========================================================

    const carregarMinhaCorrida = useCallback(async () => {
        if (
            saindoRef.current ||
            !componenteAtivoRef.current ||
            !appAtivoRef.current ||
            pollingEmAndamentoRef.current
        ) {
            return;
        }

        pollingEmAndamentoRef.current = true;

        try {
            const response = await api.get('/corridas/minha');

            if (
                saindoRef.current ||
                !componenteAtivoRef.current ||
                !appAtivoRef.current
            ) {
                return;
            }

            const corrida: Corrida | null =
                response.data?.corrida ?? null;

            const corridaAnterior = corridaAnteriorRef.current;

            const clienteCancelou = Boolean(
                corridaAnterior &&
                !corrida &&
                (
                    corridaAnterior.status === 'ACEITA' ||
                    corridaAnterior.status === 'EM_ANDAMENTO'
                )
            );

            if (clienteCancelou) {
                console.log('Corrida cancelada:', corridaAnterior?.id);

                setCorridaAtual(null);
                corridaAnteriorRef.current = null;

                Alert.alert(
                    'Corrida cancelada',
                    'O cliente cancelou a corrida.'
                );

                return;
            }

            setCorridaAtual(corrida);
            corridaAnteriorRef.current = corrida;
        } catch (error: any) {
            if (saindoRef.current || !componenteAtivoRef.current) {
                return;
            }

            const status = error?.response?.status;
            const mensagem = error?.response?.data?.error;

            if (
                !appAtivoRef.current &&
                (
                    status === 401 ||
                    mensagem === 'Token não informado.' ||
                    mensagem === 'Token inválido.'
                )
            ) {
                return;
            }

            console.error(
                'Erro ao buscar minha corrida:',
                error?.response?.data || error
            );
        } finally {
            pollingEmAndamentoRef.current = false;
        }
    }, []);

    // ==========================================================
    // POLLING DE CORRIDAS
    // ==========================================================

    useEffect(() => {
        componenteAtivoRef.current = true;

        let cancelado = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let executando = false;

        const limparTimeout = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };

        const executarPolling = async () => {
            if (
                cancelado ||
                saindoRef.current ||
                !componenteAtivoRef.current ||
                !appAtivoRef.current ||
                executando
            ) {
                return;
            }

            executando = true;

            try {
                await carregarMinhaCorrida();

                if (
                    cancelado ||
                    !componenteAtivoRef.current ||
                    !appAtivoRef.current
                ) {
                    return;
                }

                if (
                    online &&
                    motoristaAprovado &&
                    !corridaAnteriorRef.current
                ) {
                    await carregarCorridas();
                }
            } catch (error) {
                console.error('Erro no polling do motorista:', error);
            } finally {
                executando = false;

                if (
                    !cancelado &&
                    !saindoRef.current &&
                    componenteAtivoRef.current &&
                    appAtivoRef.current
                ) {
                    timeout = setTimeout(executarPolling, 3000);
                }
            }
        };

        const subscription = AppState.addEventListener(
            'change',
            (estado) => {
                const ativo = estado === 'active';

                appAtivoRef.current = ativo;

                if (!ativo) {
                    limparTimeout();
                    return;
                }

                limparTimeout();
                executarPolling();
            }
        );

        if (AppState.currentState === 'active') {
            appAtivoRef.current = true;
            executarPolling();
        } else {
            appAtivoRef.current = false;
        }

        return () => {
            cancelado = true;
            componenteAtivoRef.current = false;

            limparTimeout();
            subscription.remove();
        };
    }, [
        carregarMinhaCorrida,
        carregarCorridas,
        online,
        motoristaAprovado,
    ]);

    // ==========================================================
    // ALTERNAR ONLINE / OFFLINE
    // ==========================================================

    const alternarOnline = async () => {
        if (!motorista) {
            Alert.alert(
                'Erro',
                'Não foi possível identificar os dados do motorista.'
            );
            return;
        }

        const status = String(
            motorista.status ?? ''
        ).toUpperCase();

        if (status === 'PENDENTE') {
            Alert.alert(
                'Cadastro em análise',
                'Aguarde a aprovação do cadastro para começar a receber corridas.'
            );
            return;
        }

        if (status === 'BLOQUEADO') {
            Alert.alert(
                'Motorista bloqueado',
                'Entre em contato com o suporte para obter mais informações.'
            );
            return;
        }

        if (status !== 'APROVADO') {
            Alert.alert(
                'Cadastro não autorizado',
                'Seu cadastro ainda não está autorizado para receber corridas.'
            );
            return;
        }

        // FICAR OFFLINE

        if (online) {
            try {
                setCarregando(true);

                await api.put('/motoristas/localizacao', {
                    online: false,
                });

                setOnline(false);
                setCorridas([]);

                console.log('Motorista ficou offline.');
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
            } finally {
                setCarregando(false);
            }

            return;
        }

        // FICAR ONLINE

        setCarregando(true);

        const sucesso = await enviarLocalizacao(true);

        if (sucesso) {
            setOnline(true);
            console.log('Motorista ficou online.');
        }

        setCarregando(false);
    };

    // ==========================================================
    // ACEITAR CORRIDA
    // ==========================================================

    const aceitarCorrida = async (corridaId: string) => {
        try {
            setProcessando(corridaId);

            const response = await api.put(
                `/corridas/${corridaId}/aceitar`
            );

            const corridaAceita: Corrida | undefined =
                response.data?.corrida;

            if (!corridaAceita) {
                throw new Error(
                    'Corrida não retornada pela API.'
                );
            }

            setCorridaAtual(corridaAceita);
            corridaAnteriorRef.current = corridaAceita;

            setCorridas(lista =>
                lista.filter(corrida => corrida.id !== corridaId)
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

            if (online && appAtivoRef.current) {
                await carregarCorridas();
            }
        } finally {
            setProcessando(null);
        }
    };

    // ==========================================================
    // INICIAR CORRIDA
    // ==========================================================

    const iniciarCorrida = async (corridaId: string) => {
        try {
            setProcessando(corridaId);

            const response = await api.put(
                `/corridas/${corridaId}/iniciar`
            );

            const corridaAtualizada: Corrida | undefined =
                response.data?.corrida;

            if (!corridaAtualizada) {
                throw new Error(
                    'A API não retornou a corrida atualizada.'
                );
            }

            setCorridaAtual(corridaAtualizada);
            corridaAnteriorRef.current = corridaAtualizada;

            setCorridas(lista =>
                lista.filter(corrida => corrida.id !== corridaId)
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

    const finalizarCorrida = (corridaId: string) => {
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
                            setProcessando(corridaId);

                            const response = await api.put(
                                `/corridas/${corridaId}/finalizar`
                            );

                            const corridaFinalizada: Corrida | undefined =
                                response.data?.corrida;

                            if (!corridaFinalizada) {
                                throw new Error(
                                    'Corrida não retornada pela API.'
                                );
                            }

                            setCorridaAtual(corridaFinalizada);
                            corridaAnteriorRef.current =
                                corridaFinalizada;

                            Alert.alert(
                                'Corrida finalizada',
                                'A corrida foi concluída com sucesso.'
                            );

                            // Busca novamente para carregar os dados
                            // completos do pagamento.
                            await carregarMinhaCorrida();

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
    // CONFIRMAR RECEBIMENTO DO PAGAMENTO
    // ==========================================================

    const confirmarRecebimentoPagamento = async (
        corridaId: string
    ) => {
        if (confirmandoPagamento) {
            return;
        }

        const pagamento = corridaAtual?.pagamento;

        if (!pagamento) {
            Alert.alert(
                'Pagamento não encontrado',
                'Não foi possível localizar os dados do pagamento desta corrida.'
            );
            return;
        }

        if (
            pagamento.modalidade !== 'PRESENCIAL' ||
            pagamento.status !== 'PENDENTE'
        ) {
            Alert.alert(
                'Confirmação não permitida',
                'Este pagamento não pode ser confirmado pelo motorista.'
            );
            return;
        }

        Alert.alert(
            'Confirmar recebimento',
            'Confirma que recebeu o pagamento do cliente?',
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Sim, recebi',
                    onPress: async () => {
                        if (confirmandoPagamento) {
                            return;
                        }

                        try {
                            setConfirmandoPagamento(true);

                            await api.put(
                                `/corridas/${corridaId}/pagamento/confirmar`
                            );

                            // Atualiza a tela após a confirmação.

                            setCorridaAtual(corridaAnterior => {
                                if (!corridaAnterior) {
                                    return null;
                                }

                                const corridaAtualizada = {
                                    ...corridaAnterior,
                                    pagamento: corridaAnterior.pagamento
                                        ? {
                                            ...corridaAnterior.pagamento,
                                            status: 'APROVADO',
                                            tipo_confirmacao: 'MOTORISTA',
                                        }
                                        : null,
                                };

                                corridaAnteriorRef.current =
                                    corridaAtualizada;

                                return corridaAtualizada;
                            });

                            Alert.alert(
                                'Pagamento confirmado',
                                'O recebimento foi confirmado com sucesso.'
                            );

                        } catch (error: any) {
                            console.error(
                                'Erro ao confirmar pagamento:',
                                error?.response?.data || error
                            );

                            Alert.alert(
                                'Erro',
                                error?.response?.data?.error ||
                                    'Não foi possível confirmar o recebimento.'
                            );

                        } finally {
                            setConfirmandoPagamento(false);
                        }
                    },
                },
            ]
        );
    };

    // ==========================================================
    // STATUS DA CORRIDA
    // ==========================================================

    const textoStatus = (status: string) => {
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
    // ATUALIZAR TELA MANUALMENTE
    // ==========================================================

    const atualizarTela = async () => {
        if (!appAtivoRef.current) {
            return;
        }

        await carregarMinhaCorrida();

        if (
            appAtivoRef.current &&
            online &&
            motoristaAprovado &&
            !corridaAnteriorRef.current
        ) {
            await carregarCorridas();
        }
    };

    // ==========================================================
    // ATUALIZAÇÃO AUTOMÁTICA DA LOCALIZAÇÃO
    // ==========================================================

    useEffect(() => {
        if (!online || !motoristaAprovado) {
            return;
        }

        let cancelado = false;

        const atualizarLocalizacao = async () => {
            if (!appAtivoRef.current || cancelado) {
                return;
            }

            try {
                const { status } =
                    await Location.requestForegroundPermissionsAsync();

                if (
                    status !== 'granted' ||
                    cancelado ||
                    !appAtivoRef.current
                ) {
                    return;
                }

                const localizacao =
                    await Location.getCurrentPositionAsync({
                        accuracy: Location.Accuracy.High,
                    });

                if (cancelado || !appAtivoRef.current) {
                    return;
                }

                await api.put('/motoristas/localizacao', {
                    latitude: localizacao.coords.latitude,
                    longitude: localizacao.coords.longitude,
                });
            } catch (error: any) {
                const status = error?.response?.status;
                const mensagem = error?.response?.data?.error;

                if (
                    !appAtivoRef.current &&
                    (
                        status === 401 ||
                        mensagem === 'Token não informado.' ||
                        mensagem === 'Token inválido.'
                    )
                ) {
                    return;
                }

                console.error(
                    'Erro na atualização automática da localização:',
                    error?.response?.data || error
                );
            }
        };

        atualizarLocalizacao();

        const intervalo = setInterval(() => {
            if (appAtivoRef.current && !cancelado) {
                atualizarLocalizacao();
            }
        }, 15000);

        return () => {
            cancelado = true;
            clearInterval(intervalo);
        };
    }, [online, motoristaAprovado]);

    // ==========================================================
    // RENDERIZAÇÃO
    // ==========================================================

    return (
        <View style={styles.container}>

            <View style={styles.cabecalho}>
                <View>
                    <Text style={styles.titulo}>Motorista</Text>
                    <Text style={styles.usuario}>
                        {usuario?.name || 'Motorista'}
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.botaoSair}
                    onPress={handleLogout}
                >
                    <Text style={styles.botaoSairTexto}>Sair</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.conteudo}
                refreshControl={
                    <RefreshControl
                        refreshing={carregando}
                        onRefresh={atualizarTela}
                    />
                }
            >

                {/* DADOS DO MOTORISTA */}

                {motorista && (
                    <View style={styles.cardMotorista}>
                        <View style={styles.cabecalhoCard}>
                            <View>
                                <Text style={styles.tituloCard}>
                                    Seus dados
                                </Text>
                                <Text style={styles.subtituloCard}>
                                    Informações do motorista
                                </Text>
                            </View>

                            <View
                                style={[
                                    styles.badgeAprovacao,
                                    motoristaAprovado && styles.badgeAtivo,
                                    motoristaPendente && styles.badgePendente,
                                    motoristaBloqueado && styles.badgeBloqueado,
                                ]}
                            >
                                <Text style={styles.badgeAprovacaoTexto}>
                                    {motoristaAprovado
                                        ? 'Aprovado'
                                        : motoristaPendente
                                            ? 'Em análise'
                                            : motoristaBloqueado
                                                ? 'Bloqueado'
                                                : 'Não identificado'}
                                </Text>
                            </View>
                        </View>

                        {veiculo && (
                            <>
                                <View style={styles.divisor} />

                                <Text style={styles.labelVeiculo}>
                                    VEÍCULO
                                </Text>

                                <View style={styles.veiculoPrincipal}>
                                    <View style={styles.veiculoIcone}>
                                        <Text style={styles.veiculoIconeTexto}>
                                            🚗
                                        </Text>
                                    </View>

                                    <View style={styles.veiculoInformacoes}>
                                        <Text style={styles.veiculoNome}>
                                            {veiculo.marca} {veiculo.modelo}
                                        </Text>

                                        <Text style={styles.veiculoCategoria}>
                                            Categoria: {veiculo.categoria}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.detalhesVeiculo}>
                                    <View style={styles.detalheVeiculo}>
                                        <Text style={styles.detalheLabel}>
                                            PLACA
                                        </Text>
                                        <Text style={styles.detalheValor}>
                                            {veiculo.placa}
                                        </Text>
                                    </View>

                                    <View style={styles.detalheVeiculo}>
                                        <Text style={styles.detalheLabel}>
                                            COR
                                        </Text>
                                        <Text style={styles.detalheValor}>
                                            {veiculo.cor || 'Não informada'}
                                        </Text>
                                    </View>

                                    <View style={styles.detalheVeiculo}>
                                        <Text style={styles.detalheLabel}>
                                            ANO
                                        </Text>
                                        <Text style={styles.detalheValor}>
                                            {veiculo.ano || 'Não informado'}
                                        </Text>
                                    </View>
                                </View>
                            </>
                        )}
                    </View>
                )}

                {/* STATUS ONLINE / OFFLINE */}

                <View style={styles.cardOnline}>
                    <View>
                        <Text style={styles.label}>Status</Text>

                        <Text
                            style={[
                                styles.statusOnline,
                                online ? styles.online : styles.offline,
                            ]}
                        >
                            {online ? '● Online' : '● Offline'}
                        </Text>
                    </View>

                    {motoristaAprovado ? (
                        <TouchableOpacity
                            style={[
                                styles.botaoOnline,
                                online
                                    ? styles.botaoOffline
                                    : styles.botaoFicarOnline,
                            ]}
                            onPress={alternarOnline}
                            activeOpacity={0.85}
                            disabled={carregando}
                        >
                            {carregando ? (
                                <ActivityIndicator color="#fff" />
                            ) : (
                                <Text style={styles.botaoOnlineTexto}>
                                    {online
                                        ? 'Ficar offline'
                                        : 'Ficar online'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.statusBloqueadoContainer}>
                            <Text style={styles.statusBloqueadoTexto}>
                                {motoristaPendente
                                    ? 'Aguardando aprovação'
                                    : motoristaBloqueado
                                        ? 'Motorista bloqueado'
                                        : 'Status não identificado'}
                            </Text>
                        </View>
                    )}
                </View>

                {/* MINHA CORRIDA */}

                {corridaAtual && (
                    <View style={styles.areaCorridaAtual}>
                        <Text style={styles.tituloSecao}>
                            Minha corrida
                        </Text>

                        <View style={styles.cardCorridaAtual}>

                            <View style={styles.linhaStatus}>
                                <Text style={styles.label}>Status</Text>

                                <Text
                                    style={[
                                        styles.statusAtual,
                                        corridaAtual.status === 'ACEITA' &&
                                            styles.statusAceita,
                                        corridaAtual.status === 'EM_ANDAMENTO' &&
                                            styles.statusAndamento,
                                        corridaAtual.status === 'FINALIZADA' &&
                                            styles.statusFinalizada,
                                        corridaAtual.status === 'CANCELADA' &&
                                            styles.statusCancelada,
                                    ]}
                                >
                                    {textoStatus(corridaAtual.status)}
                                </Text>
                            </View>

                            <View style={styles.divisor} />

                            <Text style={styles.label}>Destino</Text>
                            <Text style={styles.destino}>
                                {corridaAtual.destino}
                            </Text>

                            <Text style={styles.coordenadas}>
                                Latitude: {corridaAtual.destino_latitude}
                            </Text>

                            <Text style={styles.coordenadas}>
                                Longitude: {corridaAtual.destino_longitude}
                            </Text>

                            {/* CORRIDA ACEITA */}

                            {corridaAtual.status === 'ACEITA' && (
                                <>
                                    <TouchableOpacity
                                        style={styles.botaoVerRota}
                                        onPress={() =>
                                            router.push('/rota-embarque')
                                        }
                                    >
                                        <Text style={styles.botaoVerRotaTexto}>
                                            📍 Ver rota até o passageiro
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.botaoIniciar}
                                        disabled={processando === corridaAtual.id}
                                        onPress={() =>
                                            iniciarCorrida(corridaAtual.id)
                                        }
                                    >
                                        {processando === corridaAtual.id ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.botaoTexto}>
                                                Iniciar corrida
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* CORRIDA EM ANDAMENTO */}

                            {corridaAtual.status === 'EM_ANDAMENTO' && (
                                <>
                                    <TouchableOpacity
                                        style={styles.botaoVerRota}
                                        onPress={() =>
                                            router.push('/rota-embarque')
                                        }
                                    >
                                        <Text style={styles.botaoVerRotaTexto}>
                                            🗺️ Ver rota até o destino
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.botaoFinalizar}
                                        disabled={processando === corridaAtual.id}
                                        onPress={() =>
                                            finalizarCorrida(corridaAtual.id)
                                        }
                                    >
                                        {processando === corridaAtual.id ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.botaoTexto}>
                                                Finalizar corrida
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </>
                            )}

                            {/* CORRIDA FINALIZADA */}

                            {corridaAtual.status === 'FINALIZADA' && (
                                <>
                                    <View style={styles.finalizada}>
                                        <Text style={styles.finalizadaTexto}>
                                            ✓ Corrida concluída
                                        </Text>
                                    </View>

                                    {/* DADOS DO PAGAMENTO */}

                                    <View style={styles.cardPagamento}>
                                        <Text style={styles.tituloPagamento}>
                                            Pagamento da corrida
                                        </Text>

                                        {corridaAtual.pagamento ? (
                                            <>
                                                <View style={styles.linhaPagamento}>
                                                    <Text style={styles.labelPagamento}>
                                                        Valor da corrida
                                                    </Text>

                                                    <Text style={styles.valorPagamento}>
                                                        {Number(
                                                            corridaAtual.pagamento.valor_bruto
                                                        ).toLocaleString('pt-BR', {
                                                            style: 'currency',
                                                            currency: 'BRL',
                                                        })}
                                                    </Text>
                                                </View>

                                                <View style={styles.linhaPagamento}>
                                                    <Text style={styles.labelPagamento}>
                                                        Modalidade
                                                    </Text>

                                                    <Text style={styles.textoPagamento}>
                                                        {corridaAtual.pagamento.modalidade === 'PRESENCIAL'
                                                            ? 'Presencial'
                                                            : 'Online'}
                                                    </Text>
                                                </View>

                                                <View style={styles.linhaPagamento}>
                                                    <Text style={styles.labelPagamento}>
                                                        Forma de pagamento
                                                    </Text>

                                                    <Text style={styles.textoPagamento}>
                                                        {corridaAtual.pagamento.forma_pagamento === 'DINHEIRO'
                                                            ? 'Dinheiro'
                                                            : corridaAtual.pagamento.forma_pagamento === 'PIX'
                                                                ? 'PIX'
                                                                : 'Cartão'}
                                                    </Text>
                                                </View>

                                                <View style={styles.linhaPagamento}>
                                                    <Text style={styles.labelPagamento}>
                                                        Situação
                                                    </Text>

                                                    <Text
                                                        style={[
                                                            styles.statusPagamento,
                                                            corridaAtual.pagamento.status === 'APROVADO'
                                                                ? styles.pagamentoAprovado
                                                                : corridaAtual.pagamento.status === 'PENDENTE'
                                                                    ? styles.pagamentoPendente
                                                                    : styles.pagamentoOutro,
                                                        ]}
                                                    >
                                                        {corridaAtual.pagamento.status === 'APROVADO'
                                                            ? 'Aprovado'
                                                            : corridaAtual.pagamento.status === 'PENDENTE'
                                                                ? 'Pendente'
                                                                : corridaAtual.pagamento.status}
                                                    </Text>
                                                </View>

                                                {/* PAGAMENTO PRESENCIAL PENDENTE */}

                                                {corridaAtual.pagamento.modalidade === 'PRESENCIAL' &&
                                                    corridaAtual.pagamento.status === 'PENDENTE' && (
                                                        <>
                                                            <Text style={styles.instrucaoPagamento}>
                                                                Confirme somente depois de receber o
                                                                dinheiro, verificar o PIX ou concluir
                                                                a cobrança na máquina de cartão.
                                                            </Text>

                                                            <TouchableOpacity
                                                                style={styles.botaoConfirmarPagamento}
                                                                disabled={confirmandoPagamento}
                                                                activeOpacity={0.85}
                                                                onPress={() =>
                                                                    confirmarRecebimentoPagamento(
                                                                        corridaAtual.id
                                                                    )
                                                                }
                                                            >
                                                                {confirmandoPagamento ? (
                                                                    <ActivityIndicator color="#ffffff" />
                                                                ) : (
                                                                    <Text style={styles.botaoConfirmarPagamentoTexto}>
                                                                        Confirmar recebimento
                                                                    </Text>
                                                                )}
                                                            </TouchableOpacity>
                                                        </>
                                                    )}

                                                {/* PAGAMENTO ONLINE PENDENTE */}

                                                {corridaAtual.pagamento.modalidade === 'ONLINE' &&
                                                    corridaAtual.pagamento.status === 'PENDENTE' && (
                                                        <View style={styles.avisoPagamentoOnline}>
                                                            <Text style={styles.avisoPagamentoOnlineTexto}>
                                                                Pagamento online aguardando confirmação
                                                                do gateway. Não é necessário confirmar
                                                                manualmente.
                                                            </Text>
                                                        </View>
                                                    )}

                                                {/* PAGAMENTO APROVADO */}

                                                {corridaAtual.pagamento.status === 'APROVADO' && (
                                                    <View style={styles.pagamentoConcluido}>
                                                        <Text style={styles.pagamentoConcluidoTexto}>
                                                            ✓ Recebimento confirmado
                                                        </Text>
                                                    </View>
                                                )}
                                            </>
                                        ) : (
                                            <Text style={styles.pagamentoSemRegistro}>
                                                Não foram encontrados dados de pagamento para esta corrida.
                                            </Text>
                                        )}
                                    </View>
                                </>
                            )}

                            {/* CORRIDA CANCELADA */}

                            {corridaAtual.status === 'CANCELADA' && (
                                <View style={styles.cancelada}>
                                    <Text style={styles.canceladaTexto}>
                                        Corrida cancelada pelo cliente
                                    </Text>
                                </View>
                            )}

                        </View>
                    </View>
                )}

                {/* CORRIDAS DISPONÍVEIS */}

                {online && motoristaAprovado && !corridaAtual && (
                    <View>
                        <View style={styles.cabecalhoSecao}>
                            <Text style={styles.tituloSecao}>
                                Corridas disponíveis
                            </Text>

                            <TouchableOpacity onPress={carregarCorridas}>
                                <Text style={styles.atualizarTexto}>
                                    Atualizar
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {carregando ? (
                            <View style={styles.carregando}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.carregandoTexto}>
                                    Buscando corridas...
                                </Text>
                            </View>
                        ) : corridas.length === 0 ? (
                            <View style={styles.vazio}>
                                <Text style={styles.vazioTitulo}>
                                    Nenhuma corrida disponível
                                </Text>
                                <Text style={styles.vazioTexto}>
                                    Aguarde novas solicitações.
                                </Text>
                            </View>
                        ) : (
                            corridas.map(corrida => (
                                <View
                                    key={corrida.id}
                                    style={styles.cardCorrida}
                                >
                                    <Text style={styles.corridaTitulo}>
                                        Nova corrida
                                    </Text>

                                    <View style={styles.divisor} />

                                    <Text style={styles.label}>Origem</Text>
                                    <Text style={styles.destino}>
                                        {corrida.origem}
                                    </Text>

                                    <Text style={styles.coordenadas}>
                                        Latitude: {corrida.origem_latitude}
                                    </Text>

                                    <Text style={styles.coordenadas}>
                                        Longitude: {corrida.origem_longitude}
                                    </Text>

                                    <Text style={styles.labelDestino}>
                                        Destino
                                    </Text>

                                    <Text style={styles.destino}>
                                        {corrida.destino}
                                    </Text>

                                    <Text style={styles.coordenadas}>
                                        Latitude: {corrida.destino_latitude}
                                    </Text>

                                    <Text style={styles.coordenadas}>
                                        Longitude: {corrida.destino_longitude}
                                    </Text>

                                    {corrida.valor != null && (
                                        <Text style={styles.valorCorrida}>
                                            Valor: {Number(corrida.valor).toLocaleString(
                                                'pt-BR',
                                                {
                                                    style: 'currency',
                                                    currency: 'BRL',
                                                }
                                            )}
                                        </Text>
                                    )}

                                    <TouchableOpacity
                                        style={styles.botaoAceitar}
                                        disabled={processando === corrida.id}
                                        onPress={() =>
                                            aceitarCorrida(corrida.id)
                                        }
                                    >
                                        {processando === corrida.id ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.botaoTexto}>
                                                Aceitar corrida
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* MOTORISTA OFFLINE */}

                {!online && !corridaAtual && motoristaPendente && (
                    <View style={[styles.vazio, styles.cardPendente]}>
                        <Text style={styles.iconePendente}>⏳</Text>

                        <Text style={styles.vazioTitulo}>
                            Cadastro em análise
                        </Text>

                        <Text style={styles.vazioTexto}>
                            Seu cadastro de motorista foi recebido e está
                            aguardando aprovação.
                        </Text>

                        <Text style={styles.vazioTexto}>
                            Assim que for aprovado, você poderá ficar online
                            e receber corridas.
                        </Text>
                    </View>
                )}

                {!online && !corridaAtual && motoristaBloqueado && (
                    <View style={[styles.vazio, styles.cardBloqueado]}>
                        <Text style={styles.iconePendente}>⚠️</Text>

                        <Text style={styles.vazioTitulo}>
                            Cadastro bloqueado
                        </Text>

                        <Text style={styles.vazioTexto}>
                            Seu cadastro está bloqueado e você não pode
                            receber corridas no momento.
                        </Text>

                        <Text style={styles.vazioTexto}>
                            Entre em contato com o suporte para mais
                            informações.
                        </Text>
                    </View>
                )}

                {!online &&
                    !corridaAtual &&
                    motoristaAprovado && (
                        <View style={styles.vazio}>
                            <Text style={styles.vazioTitulo}>
                                Você está offline
                            </Text>

                            <Text style={styles.vazioTexto}>
                                Fique online para receber corridas.
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

    cardMotorista: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
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

    cardOnline: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
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
        minWidth: 125,
        alignItems: 'center',
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
        shadowOffset: { width: 0, height: 2 },
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

    valorCorrida: {
        marginTop: 12,
        fontSize: 16,
        fontWeight: '700',
        color: '#15803d',
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
        backgroundColor: '#2563eb',
        alignItems: 'center',
        justifyContent: 'center',
    },

    botaoVerRotaTexto: {
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
        shadowOffset: { width: 0, height: 2 },
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
        maxWidth: 175,
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

    // ==========================================================
    // PAGAMENTO
    // ==========================================================

    cardPagamento: {
        marginTop: 18,
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#f9fafb',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },

    tituloPagamento: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },

    linhaPagamento: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },

    labelPagamento: {
        fontSize: 14,
        color: '#6b7280',
        fontWeight: '500',
    },

    textoPagamento: {
        fontSize: 14,
        color: '#111827',
        fontWeight: '700',
    },

    valorPagamento: {
        fontSize: 18,
        color: '#15803d',
        fontWeight: '800',
    },

    statusPagamento: {
        fontSize: 13,
        fontWeight: '800',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        overflow: 'hidden',
    },

    pagamentoAprovado: {
        backgroundColor: '#dcfce7',
        color: '#166534',
    },

    pagamentoPendente: {
        backgroundColor: '#fef3c7',
        color: '#92400e',
    },

    pagamentoOutro: {
        backgroundColor: '#e5e7eb',
        color: '#374151',
    },

    instrucaoPagamento: {
        fontSize: 13,
        lineHeight: 20,
        color: '#4b5563',
        marginTop: 8,
        marginBottom: 14,
    },

    botaoConfirmarPagamento: {
        backgroundColor: '#16a34a',
        borderRadius: 10,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 50,
    },

    botaoConfirmarPagamentoTexto: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
    },

    avisoPagamentoOnline: {
        marginTop: 8,
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#dbeafe',
    },

    avisoPagamentoOnlineTexto: {
        color: '#1e40af',
        fontSize: 13,
        lineHeight: 19,
        fontWeight: '600',
    },

    pagamentoConcluido: {
        marginTop: 8,
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#dcfce7',
        alignItems: 'center',
    },

    pagamentoConcluidoTexto: {
        color: '#166534',
        fontSize: 14,
        fontWeight: '800',
    },

    pagamentoSemRegistro: {
        color: '#92400e',
        fontSize: 13,
        lineHeight: 19,
    },

});
