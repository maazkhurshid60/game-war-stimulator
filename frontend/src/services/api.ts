import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import {
  APIResponse,
  Game,
  GameState,
  GameStats,
  LeaderboardEntry,
  PaginatedResponse,
  PlayerStats,
  Round,
} from '../types';

/**
 * Frontend API Client Service for War Card Game Simulator.
 */
class ApiService {
  private client: AxiosInstance;

  constructor() {
    const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

    this.client = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    // Request Interceptor: Attach timestamp
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        config.headers.set('X-Request-Timestamp', new Date().toISOString());
        return config;
      },
      (error: AxiosError) => {
        console.error('[API Request Error]:', error);
        return Promise.reject(error);
      }
    );

    // Response Interceptor: Error logging and unwrapping
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        console.error('[API Response Error]:', error.response?.data || error.message);
        return Promise.reject(this.formatError(error));
      }
    );
  }

  private formatError(error: AxiosError): Error {
    const data = error.response?.data as any;
    const message = data?.message || data?.detail || error.message || 'An unknown network error occurred';
    return new Error(message);
  }

  /**
   * Initializes a new game match.
   */
  async startGame(player1Name = 'Player 1', player2Name = 'Player 2'): Promise<Game> {
    const res = await this.client.post<APIResponse<Game>>('/api/games', {
      player1_name: player1Name,
      player2_name: player2Name,
    });
    return res.data.data;
  }

  /**
   * Fetches metadata for a specific game by ID.
   */
  async getGame(gameId: string): Promise<Game> {
    const res = await this.client.get<APIResponse<Game>>(`/api/games/${gameId}`);
    return res.data.data;
  }

  /**
   * Retrieves a paginated list of recorded games.
   */
  async getGames(page = 1, limit = 20): Promise<PaginatedResponse<Game>> {
    const res = await this.client.get<PaginatedResponse<Game>>('/api/games', {
      params: { page, limit },
    });
    return res.data;
  }

  /**
   * Executes a single turn step in an ongoing game.
   */
  async playRound(gameId: string): Promise<Round> {
    const res = await this.client.post<APIResponse<Round>>(`/api/games/${gameId}/next-round`);
    return res.data.data;
  }

  /**
   * Simulates the match continuously until completion.
   */
  async simulateGame(gameId: string): Promise<Game> {
    const res = await this.client.post<APIResponse<Game>>(`/api/games/${gameId}/simulate`);
    return res.data.data;
  }

  /**
   * Manually finishes an ongoing match.
   */
  async completeGame(gameId: string): Promise<Game> {
    const res = await this.client.post<APIResponse<Game>>(`/api/games/${gameId}/complete`);
    return res.data.data;
  }

  /**
   * Retrieves paginated round history logs for a match.
   */
  async getRounds(gameId: string, page = 1, limit = 50): Promise<PaginatedResponse<Round>> {
    const res = await this.client.get<PaginatedResponse<Round>>(`/api/games/${gameId}/rounds`, {
      params: { page, limit },
    });
    return res.data;
  }

  /** Retrieves complete history for games longer than a single page. */
  async getAllRounds(gameId: string, limit = 200): Promise<Round[]> {
    const firstPage = await this.getRounds(gameId, 1, limit);
    if (firstPage.total_pages <= 1) return firstPage.data;

    const remainingPages = await Promise.all(
      Array.from({ length: firstPage.total_pages - 1 }, (_, index) =>
        this.getRounds(gameId, index + 2, limit)
      )
    );

    return [firstPage.data, ...remainingPages.map((page) => page.data)]
      .flat()
      .sort((a, b) => a.round_number - b.round_number);
  }

  /**
   * Fetches live internal state snapshot (hands, remaining cards).
   */
  async getGameState(gameId: string): Promise<GameState> {
    const res = await this.client.get<APIResponse<GameState>>(`/api/games/${gameId}/state`);
    return res.data.data;
  }

  /**
   * Fetches aggregate global game statistics overview.
   */
  async getStatsOverview(): Promise<GameStats> {
    const res = await this.client.get<APIResponse<GameStats>>('/api/stats/overview');
    return res.data.data;
  }

  /**
   * Fetches individual player stats.
   */
  async getPlayerStats(playerId: string): Promise<PlayerStats> {
    const res = await this.client.get<APIResponse<PlayerStats>>(`/api/stats/player/${playerId}`);
    return res.data.data;
  }

  /**
   * Retrieves matches with the highest war count.
   */
  async getMostWars(): Promise<any[]> {
    const res = await this.client.get<APIResponse<any[]>>('/api/stats/most-wars');
    return res.data.data;
  }

  /**
   * Retrieves global player win leaderboard.
   */
  async getLeaderboard(): Promise<LeaderboardEntry[]> {
    const res = await this.client.get<APIResponse<LeaderboardEntry[]>>('/api/stats/leaderboard');
    return res.data.data;
  }
}

export const apiService = new ApiService();
export default apiService;
