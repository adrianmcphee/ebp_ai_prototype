import axios from 'axios';
import { API_BASE } from '../constants';

/**
 * Memory-only session management service
 * Sessions do not survive page refresh
 */
class SessionService {
  private sessionId: string | null = null;

  async initialize(): Promise<string> {
    if (!this.sessionId) {
      try {
        const response = await axios.post(`${API_BASE}/api/session`);
        this.sessionId = response.data.session_id;
        
        if (!this.sessionId) {
          throw new Error('Session ID not returned from server');
        }
      } catch (error) {
        throw new Error(`Failed to initialize session: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    return this.sessionId;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  reset(): void {
    this.sessionId = null;
  }
}

export const sessionService = new SessionService();
