import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { JwtPayload } from './jwt';
export interface AuthenticatedSocket extends Socket {
    user?: JwtPayload;
    barId?: string;
    tableId?: string;
    isTableSession?: boolean;
}
export declare class SocketManager {
    private io;
    private redis;
    private connectedUsers;
    private userSockets;
    constructor(server: HttpServer);
    private setupRedisAdapter;
    private setupMiddleware;
    private setupEventHandlers;
    private handleConnection;
    private setupSocketEventHandlers;
    private handleSongRequest;
    private handleQueueUpdate;
    private handlePointsUpdate;
    private isValidRoom;
    private registerConnection;
    private handleDisconnection;
    emitToBar(barId: string, event: string, data: any): void;
    emitToAdmins(barId: string, event: string, data: any): void;
    emitToTable(tableId: string, event: string, data: any): void;
    emitToUser(userId: string, event: string, data: any): void;
    getConnectionStats(): {
        totalConnections: number;
        barConnections: Record<string, number>;
    };
    getIO(): SocketIOServer;
    close(): Promise<void>;
}
export declare const initSocketManager: (server: HttpServer) => SocketManager;
export declare const getSocketManager: () => SocketManager;
export declare const emitQueueUpdate: (barId: string, queueData: any) => void;
export declare const emitSongApproved: (barId: string, songData: any) => void;
export declare const emitSongRejected: (barId: string, songData: any) => void;
export declare const emitPointsUpdated: (userId: string, pointsData: any) => void;
export declare const emitMenuUpdated: (barId: string, menuData: any) => void;
//# sourceMappingURL=socket.d.ts.map