import { io, Socket } from 'socket.io-client';

// Deve ser o mesmo endereço utilizado pelo Axios.
const SOCKET_URL = 'http://10.111.135.208:3333';

let socket: Socket | null = null;

export function conectarSocket(token: string): Socket {
    if (socket) {
        // Atualiza a autenticação caso o token tenha mudado.
        socket.auth = { token };

        if (!socket.connected) {
            socket.connect();
        }

        return socket;

    }

    socket = io(SOCKET_URL, {
        autoConnect: false,
        auth: {
            token,
        },
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
        console.log('Socket.IO conectado:', socket?.id);
    });

    socket.on('connect_error', (error) => {
        console.error(
            'Erro na conexão Socket.IO:',
            error.message
        );
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket.IO desconectado:', reason);
    });

    socket.connect();

    return socket;
}

export function obterSocket(): Socket | null {
    return socket;
}

export function desconectarSocket(): void {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }
}
