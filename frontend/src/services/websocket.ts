import type { ProcessResponse } from '../types';

export interface WebSocketMessage {
  type: string;
  data: ProcessResponse;
}

export type WebSocketMessageHandler = (message: WebSocketMessage) => void;

// WebSocket service for real-time communication
export const websocketService = {
  // Create WebSocket connection
  connect(onMessage: WebSocketMessageHandler): WebSocket {
    const websocket = new WebSocket(`ws://localhost:8000/ws/${crypto.randomUUID()}`);
    
    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      onMessage(message);
    };

    return websocket;
  },

  // Close WebSocket connection
  disconnect(ws: WebSocket | null): void {
    if (ws) {
      ws.close();
    }
  }
};
