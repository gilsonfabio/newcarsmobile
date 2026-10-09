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

import {
useCallback,
useEffect,
useState,
} from 'react';

import { router } from 'expo-router';

import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface MotoristaPendente {
    id?: string;
    motorista_id?: string;
    usuario_id?: string;

    nome?: string;
    usuario_nome?: string;
    motorista_nome?: string;

    email?: string;
    usuario_email?: string;

    telefone?: string;
    usuario_telefone?: string;

    cnh?: string;
    status?: string;

    marca?: string;
    modelo?: string;
    categoria?: string;
    placa?: string;
    cor?: string;
    ano?: number | string;

    veiculo_marca?: string;
    veiculo_modelo?: string;
    veiculo_categoria?: string;
    veiculo_placa?: string;
    veiculo_cor?: string;
    veiculo_ano?: number | string;

    [campo: string]: unknown;

}

export default function AdminMotoristas() {
    const { usuario, logout } = useAuth();

    const [motoristas, setMotoristas] =
        useState<MotoristaPendente[]>([]);

    const [carregando, setCarregando] =
        useState(true);

    const [atualizando, setAtualizando] =
        useState(false);

    const [processando, setProcessando] =
        useState<string | null>(null);

    const [acessoNegado, setAcessoNegado] =
        useState(false);

    // ======================================================
    // VALIDAR ACESSO À TELA
    // ======================================================

    useEffect(() => {
        if (usuario && usuario.tipo !== 'ADMIN') {
            setAcessoNegado(true);

            Alert.alert(
                'Acesso negado',
                'Somente administradores podem acessar esta tela.',
                [
                    {
                        text: 'Voltar',
                        onPress: () => router.replace('/'),
                    },
                ]
            );
        }
    }, [usuario]);

    // ======================================================
    // CARREGAR MOTORISTAS PENDENTES
    // ======================================================

    const carregarMotoristas = useCallback(
        async (manual = false) => {
            try {
                if (manual) {
                    setAtualizando(true);
                } else {
                    setCarregando(true);
                }

                const response = await api.get(
                    '/admin/motoristas/pendentes'
                );

                const lista =
                    response.data?.motoristas ??
                    response.data?.data ??
                    [];

                if (Array.isArray(lista)) {
                    setMotoristas(lista);
                } else {
                    setMotoristas([]);
                }
            } catch (error: any) {
                console.error(
                    'Erro ao carregar motoristas pendentes:',
                    error?.response?.data || error
                );

                const status = error?.response?.status;

                if (status === 401) {
                    Alert.alert(
                        'Sessão expirada',
                        'Entre novamente no aplicativo para continuar.'
                    );
                } else if (status === 403) {
                    setAcessoNegado(true);

                    Alert.alert(
                        'Acesso negado',
                        error?.response?.data?.error ||
                        'Você não tem permissão para administrar motoristas.',
                        [
                            {
                                text: 'Voltar',
                                onPress: () => router.replace('/'),
                            },
                        ]
                    );
                } else {
                    Alert.alert(
                        'Erro',
                        error?.response?.data?.error ||
                        'Não foi possível carregar os motoristas.'
                    );
                }
            } finally {
                setCarregando(false);
                setAtualizando(false);
            }
        },
        []
    );

    useEffect(() => {
        if (usuario?.tipo === 'ADMIN') {
            carregarMotoristas();
        }
    }, [usuario, carregarMotoristas]);

    // ======================================================
    // OBTER ID DO MOTORISTA
    // ======================================================

    function obterId(
        motorista: MotoristaPendente
    ): string | null {
        const id =
            motorista.motorista_id ??
            motorista.id;

        if (id === undefined || id === null) {
            return null;
        }

        return String(id);
    }

    // ======================================================
    // APROVAR OU BLOQUEAR MOTORISTA
    // ======================================================

    function confirmarAlteracao(
        motorista: MotoristaPendente,
        novoStatus: 'ATIVO' | 'BLOQUEADO'
    ) {
        const motoristaId = obterId(motorista);

        if (!motoristaId) {
            Alert.alert(
                'Erro',
                'Não foi possível identificar o motorista. Verifique o ID retornado pela API.'
            );

            return;
        }

        const nome =
            motorista.usuario_nome ??
            motorista.motorista_nome ??
            motorista.nome ??
            'este motorista';

        const aprovando = novoStatus === 'ATIVO';

        Alert.alert(
            aprovando
                ? 'Aprovar motorista'
                : 'Bloquear motorista',

            aprovando
                ? `Deseja aprovar o cadastro de ${nome}?`
                : `Deseja bloquear o cadastro de ${nome}?`,

            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: aprovando ? 'Aprovar' : 'Bloquear',
                    style: aprovando ? 'default' : 'destructive',

                    onPress: async () => {
                        try {
                            setProcessando(motoristaId);

                            await api.put(
                                `/admin/motoristas/${motoristaId}/status`,
                                {
                                    status: novoStatus,
                                }
                            );

                            setMotoristas((lista) =>
                                lista.filter(
                                    (item) =>
                                        obterId(item) !== motoristaId
                                )
                            );

                            Alert.alert(
                                'Sucesso',
                                aprovando
                                    ? 'Motorista aprovado! Ele já pode ficar online, desde que sua conta esteja ativa.'
                                    : 'Motorista bloqueado com sucesso. Ele não poderá ficar online.'
                            );
                        } catch (error: any) {
                            console.error(
                                'Erro ao alterar status do motorista:',
                                error?.response?.data || error
                            );

                            Alert.alert(
                                'Erro',
                                error?.response?.data?.error ||
                                'Não foi possível alterar o status do motorista.'
                            );
                        } finally {
                            setProcessando(null);
                        }
                    },
                },
            ]
        );
    }

    // ======================================================
    // SAIR DA CONTA
    // ======================================================

    function handleLogout() {
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
    }

    // ======================================================
    // RENDERIZAÇÃO
    // ======================================================

    if (acessoNegado) {
        return (
            <View style={styles.centralizado}>
                <Text style={styles.erroTitulo}>
                    Acesso restrito
                </Text>

                <Text style={styles.textoVazio}>
                    Esta área é exclusiva para administradores.
                </Text>

                <TouchableOpacity
                    style={styles.botaoVoltar}
                    onPress={() => router.replace('/')}
                >
                    <Text style={styles.textoBotao}>
                        Voltar ao início
                    </Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (usuario && usuario.tipo !== 'ADMIN') {
        return (
            <View style={styles.centralizado}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* CABEÇALHO */}

            <View style={styles.cabecalho}>
                <View style={styles.cabecalhoTexto}>
                    <Text style={styles.titulo}>
                        Administração
                    </Text>

                    <Text style={styles.subtitulo}>
                        Aprovação de motoristas
                    </Text>
                </View>

                <TouchableOpacity
                    style={styles.botaoSair}
                    onPress={handleLogout}
                >
                    <Text style={styles.textoSair}>
                        Sair
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.conteudo}
                refreshControl={
                    <RefreshControl
                        refreshing={atualizando}
                        onRefresh={() => carregarMotoristas(true)}
                    />
                }
            >
                {/* RESUMO */}

                <View style={styles.cardResumo}>
                    <View style={styles.resumoIcone}>
                        <Text style={styles.resumoEmoji}>
                            🚘
                        </Text>
                    </View>

                    <View style={styles.resumoInformacoes}>
                        <Text style={styles.resumoNumero}>
                            {motoristas.length}
                        </Text>

                        <Text style={styles.resumoDescricao}>
                            Motoristas aguardando aprovação
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={styles.botaoAtualizar}
                        onPress={() => carregarMotoristas(true)}
                        disabled={atualizando || carregando}
                    >
                        <Text style={styles.textoAtualizar}>
                            Atualizar
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* TÍTULO DA LISTA */}

                <View style={styles.cabecalhoLista}>
                    <Text style={styles.tituloLista}>
                        Cadastros pendentes
                    </Text>

                    <View style={styles.badgeQuantidade}>
                        <Text style={styles.badgeQuantidadeTexto}>
                            {motoristas.length}
                        </Text>
                    </View>
                </View>

                {/* CARREGAMENTO */}

                {carregando ? (
                    <View style={styles.centralizadoLista}>
                        <ActivityIndicator
                            size="large"
                            color="#2563eb"
                        />

                        <Text style={styles.textoCarregando}>
                            Carregando motoristas...
                        </Text>
                    </View>
                ) : motoristas.length === 0 ? (
                    /* LISTA VAZIA */

                    <View style={styles.cardVazio}>
                        <Text style={styles.vazioEmoji}>
                            ✓
                        </Text>

                        <Text style={styles.vazioTitulo}>
                            Tudo em dia!
                        </Text>

                        <Text style={styles.textoVazio}>
                            Não há motoristas aguardando aprovação.
                        </Text>

                        <TouchableOpacity
                            style={styles.botaoRecarregar}
                            onPress={() => carregarMotoristas(true)}
                        >
                            <Text style={styles.textoBotao}>
                                Recarregar lista
                            </Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* CARDS DOS MOTORISTAS */

                    motoristas.map((motorista, indice) => {
                        const id = obterId(motorista);

                        const nome =
                            motorista.usuario_nome ??
                            motorista.motorista_nome ??
                            motorista.nome ??
                            'Nome não informado';

                        const email =
                            motorista.usuario_email ??
                            motorista.email ??
                            'E-mail não informado';

                        const telefone =
                            motorista.usuario_telefone ??
                            motorista.telefone ??
                            'Telefone não informado';

                        const marca =
                            motorista.veiculo_marca ??
                            motorista.marca;

                        const modelo =
                            motorista.veiculo_modelo ??
                            motorista.modelo;

                        const categoria =
                            motorista.veiculo_categoria ??
                            motorista.categoria;

                        const placa =
                            motorista.veiculo_placa ??
                            motorista.placa;

                        const cor =
                            motorista.veiculo_cor ??
                            motorista.cor;

                        const ano =
                            motorista.veiculo_ano ??
                            motorista.ano;

                        return (
                            <View
                                key={id ?? `motorista-${indice}`}
                                style={styles.cardMotorista}
                            >
                                {/* IDENTIFICAÇÃO */}

                                <View style={styles.linhaMotorista}>
                                    <View style={styles.avatar}>
                                        <Text style={styles.avatarTexto}>
                                            {String(nome).charAt(0).toUpperCase()}
                                        </Text>
                                    </View>

                                    <View style={styles.dadosPrincipais}>
                                        <Text style={styles.nomeMotorista}>
                                            {nome}
                                        </Text>

                                        <Text style={styles.textoSecundario}>
                                            Cadastro de motorista
                                        </Text>
                                    </View>

                                    <View style={styles.badgePendente}>
                                        <Text style={styles.badgePendenteTexto}>
                                            PENDENTE
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.divisor} />

                                {/* CONTATO */}

                                <Text style={styles.secaoLabel}>
                                    DADOS PESSOAIS
                                </Text>

                                <View style={styles.linhaDado}>
                                    <Text style={styles.iconeDado}>
                                        ✉
                                    </Text>

                                    <Text style={styles.valorDado}>
                                        {email}
                                    </Text>
                                </View>

                                <View style={styles.linhaDado}>
                                    <Text style={styles.iconeDado}>
                                        ☎
                                    </Text>

                                    <Text style={styles.valorDado}>
                                        {telefone}
                                    </Text>
                                </View>

                                {motorista.cnh != null && (
                                    <View style={styles.linhaDado}>
                                        <Text style={styles.labelDado}>
                                            CNH
                                        </Text>

                                        <Text style={styles.valorDado}>
                                            {String(motorista.cnh)}
                                        </Text>
                                    </View>
                                )}

                                {/* VEÍCULO */}

                                <View style={styles.divisor} />

                                <Text style={styles.secaoLabel}>
                                    VEÍCULO CADASTRADO
                                </Text>

                                {marca || modelo || placa ? (
                                    <>
                                        <View style={styles.veiculoLinha}>
                                            <Text style={styles.veiculoEmoji}>
                                                🚗
                                            </Text>

                                            <View style={styles.veiculoDados}>
                                                <Text style={styles.veiculoNome}>
                                                    {[marca, modelo]
                                                        .filter(Boolean)
                                                        .join(' ') ||
                                                        'Veículo não informado'}
                                                </Text>

                                                <Text style={styles.textoSecundario}>
                                                    {categoria
                                                        ? `Categoria: ${categoria}`
                                                        : 'Categoria não informada'}
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={styles.detalhesVeiculo}>
                                            <View style={styles.detalheVeiculo}>
                                                <Text style={styles.labelDetalhe}>
                                                    PLACA
                                                </Text>

                                                <Text style={styles.valorDetalhe}>
                                                    {placa
                                                        ? String(placa)
                                                        : 'Não informada'}
                                                </Text>
                                            </View>

                                            <View style={styles.detalheVeiculo}>
                                                <Text style={styles.labelDetalhe}>
                                                    COR
                                                </Text>

                                                <Text style={styles.valorDetalhe}>
                                                    {cor
                                                        ? String(cor)
                                                        : 'Não informada'}
                                                </Text>
                                            </View>

                                            <View style={styles.detalheVeiculo}>
                                                <Text style={styles.labelDetalhe}>
                                                    ANO
                                                </Text>

                                                <Text style={styles.valorDetalhe}>
                                                    {ano
                                                        ? String(ano)
                                                        : 'Não informado'}
                                                </Text>
                                            </View>
                                        </View>
                                    </>
                                ) : (
                                    <Text style={styles.textoSecundario}>
                                        Nenhuma informação de veículo foi retornada pela API.
                                    </Text>
                                )}

                                {/* AÇÕES */}

                                <View style={styles.acoes}>
                                    <TouchableOpacity
                                        style={styles.botaoBloquear}
                                        disabled={
                                            !id ||
                                            processando === id
                                        }
                                        onPress={() =>
                                            confirmarAlteracao(
                                                motorista,
                                                'BLOQUEADO'
                                            )
                                        }
                                        activeOpacity={0.8}
                                    >
                                        {processando === id ? (
                                            <ActivityIndicator color="#b91c1c" />
                                        ) : (
                                            <Text style={styles.textoBloquear}>
                                                Bloquear
                                            </Text>
                                        )}
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.botaoAprovar}
                                        disabled={
                                            !id ||
                                            processando === id
                                        }
                                        onPress={() =>
                                            confirmarAlteracao(
                                                motorista,
                                                'ATIVO'
                                            )
                                        }
                                        activeOpacity={0.8}
                                    >
                                        {processando === id ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <Text style={styles.textoBotao}>
                                                ✓ Aprovar motorista
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </View>
    );

}

const styles = StyleSheet.create({
    container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    },

    cabecalho: {
        paddingTop: 55,
        paddingBottom: 22,
        paddingHorizontal: 20,
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    cabecalhoTexto: {
        flex: 1,
    },

    titulo: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '800',
    },

    subtitulo: {
        color: '#d1d5db',
        fontSize: 14,
        marginTop: 5,
    },

    botaoSair: {
        backgroundColor: '#374151',
        paddingHorizontal: 15,
        paddingVertical: 9,
        borderRadius: 9,
        marginLeft: 10,
    },

    textoSair: {
        color: '#ffffff',
        fontWeight: '700',
    },

    conteudo: {
        padding: 16,
        paddingBottom: 40,
    },

    cardResumo: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        marginBottom: 25,
        elevation: 2,
    },

    resumoIcone: {
        width: 48,
        height: 48,
        borderRadius: 13,
        backgroundColor: '#dbeafe',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },

    resumoEmoji: {
        fontSize: 24,
    },

    resumoInformacoes: {
        flex: 1,
    },

    resumoNumero: {
        fontSize: 24,
        fontWeight: '800',
        color: '#111827',
    },

    resumoDescricao: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 2,
        flexShrink: 1,
    },

    botaoAtualizar: {
        paddingHorizontal: 10,
        paddingVertical: 9,
        backgroundColor: '#eff6ff',
        borderRadius: 8,
        marginLeft: 6,
    },

    textoAtualizar: {
        color: '#1d4ed8',
        fontSize: 12,
        fontWeight: '700',
    },

    cabecalhoLista: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 13,
    },

    tituloLista: {
        fontSize: 19,
        fontWeight: '800',
        color: '#111827',
    },

    badgeQuantidade: {
        marginLeft: 10,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        backgroundColor: '#dbeafe',
    },

    badgeQuantidadeTexto: {
        color: '#1d4ed8',
        fontWeight: '800',
        fontSize: 12,
    },

    cardMotorista: {
        backgroundColor: '#ffffff',
        borderRadius: 15,
        padding: 17,
        marginBottom: 16,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.06,
        shadowRadius: 5,
    },

    linhaMotorista: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#e0e7ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 11,
    },

    avatarTexto: {
        color: '#3730a3',
        fontSize: 20,
        fontWeight: '800',
    },

    dadosPrincipais: {
        flex: 1,
    },

    nomeMotorista: {
        color: '#111827',
        fontSize: 16,
        fontWeight: '800',
    },

    textoSecundario: {
        color: '#6b7280',
        fontSize: 12,
        marginTop: 4,
    },

    badgePendente: {
        backgroundColor: '#fef3c7',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 7,
        marginLeft: 5,
    },

    badgePendenteTexto: {
        color: '#92400e',
        fontSize: 9,
        fontWeight: '800',
    },

    divisor: {
        height: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 15,
    },

    secaoLabel: {
        fontSize: 10,
        color: '#9ca3af',
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 11,
    },

    linhaDado: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },

    iconeDado: {
        width: 25,
        fontSize: 16,
        color: '#6b7280',
    },

    labelDado: {
        width: 45,
        fontSize: 12,
        color: '#6b7280',
        fontWeight: '700',
    },

    valorDado: {
        flex: 1,
        fontSize: 13,
        color: '#374151',
    },

    veiculoLinha: {
        flexDirection: 'row',
        alignItems: 'center',
    },

    veiculoEmoji: {
        fontSize: 30,
        marginRight: 12,
    },

    veiculoDados: {
        flex: 1,
    },

    veiculoNome: {
        color: '#111827',
        fontSize: 15,
        fontWeight: '800',
    },

    detalhesVeiculo: {
        flexDirection: 'row',
        marginTop: 17,
        paddingTop: 13,
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
    },

    detalheVeiculo: {
        flex: 1,
    },

    labelDetalhe: {
        fontSize: 10,
        fontWeight: '800',
        color: '#9ca3af',
        marginBottom: 5,
    },

    valorDetalhe: {
        fontSize: 13,
        fontWeight: '700',
        color: '#111827',
    },

    acoes: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 22,
    },

    botaoBloquear: {
        flex: 0.8,
        minHeight: 46,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#fecaca',
        backgroundColor: '#fff7f7',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    textoBloquear: {
        color: '#b91c1c',
        fontSize: 13,
        fontWeight: '800',
    },

    botaoAprovar: {
        flex: 1.4,
        minHeight: 46,
        paddingHorizontal: 10,
        backgroundColor: '#16a34a',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },

    textoBotao: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },

    centralizado: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        padding: 25,
    },

    centralizadoLista: {
        paddingVertical: 45,
        alignItems: 'center',
    },

    textoCarregando: {
        marginTop: 12,
        color: '#6b7280',
        fontSize: 14,
    },

    cardVazio: {
        backgroundColor: '#ffffff',
        borderRadius: 15,
        padding: 28,
        alignItems: 'center',
        marginTop: 5,
    },

    vazioEmoji: {
        fontSize: 35,
        color: '#16a34a',
        fontWeight: '800',
        marginBottom: 12,
    },

    vazioTitulo: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        textAlign: 'center',
    },

    textoVazio: {
        color: '#6b7280',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 21,
        marginTop: 8,
    },

    botaoRecarregar: {
        marginTop: 18,
        paddingHorizontal: 18,
        paddingVertical: 12,
        backgroundColor: '#2563eb',
        borderRadius: 9,
    },

    botaoVoltar: {
        marginTop: 20,
        paddingHorizontal: 20,
        paddingVertical: 13,
        backgroundColor: '#111827',
        borderRadius: 10,
    },

    erroTitulo: {
        color: '#111827',
        fontSize: 22,
        fontWeight: '800',
    },

});
