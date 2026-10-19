import { Order, Client, AppSettings, AuditLog, PublicOrderView } from '../types';
import { getFriendlyErrorMessage } from '../utils/apiErrorHandler';

export interface AppDataResponse {
  orders: Order[];
  clients: Client[];
  settings: AppSettings;
  auditLogs: AuditLog[];
}

export interface AuthStatusResponse {
  isAuthenticated: boolean;
  user?: {
    email?: string;
    role?: string;
  };
}

export interface OrderMutationResponse {
  success: boolean;
  order?: Order;
  message?: string;
  error?: string;
}

export interface ClientMutationResponse {
  success: boolean;
  client?: Client;
  message?: string;
  error?: string;
}

export interface SettingsMutationResponse {
  success: boolean;
  settings?: AppSettings;
  message?: string;
  error?: string;
}

/**
 * DELFILÂNDIA Centralized API Service Layer
 * Interacts with PostgreSQL Cloud SQL through backend /api/* routes with credentials: 'include'.
 * Guarantees standard error formatting and strict response typing.
 */
class ApiService {
  private defaultHeaders = {
    'Content-Type': 'application/json',
  };
  private token: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.token = sessionStorage.getItem('delfilandia_session_token') || localStorage.getItem('delfilandia_session_token');
      } catch {
        // ignore
      }
    }
  }

  setAuthToken(token: string | null): void {
    this.token = token;
    if (typeof window !== 'undefined') {
      try {
        if (token) {
          sessionStorage.setItem('delfilandia_session_token', token);
          localStorage.setItem('delfilandia_session_token', token);
        } else {
          sessionStorage.removeItem('delfilandia_session_token');
          localStorage.removeItem('delfilandia_session_token');
        }
      } catch {
        // ignore
      }
    }
  }

  getAuthToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('delfilandia_session_token') || localStorage.getItem('delfilandia_session_token');
      } catch {
        // ignore
      }
    }
    return null;
  }

  /**
   * Helper method for executing fetch requests with standardized error handling
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<{ data: T | null; error: string | null; status: number }> {
    try {
      const headers: Record<string, string> = {
        ...this.defaultHeaders,
        ...((options.headers as Record<string, string>) || {}),
      };

      const token = this.getAuthToken();
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        ...options,
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          // If unauthorized and not auth-check endpoint, clear invalid local token
          if (endpoint !== '/api/auth/status' && endpoint !== '/api/auth/login') {
            this.setAuthToken(null);
          }
        }
        const errorData = await response.json().catch(() => ({}));
        const rawMessage = errorData?.error || errorData?.message || response.statusText;
        const friendlyMessage = getFriendlyErrorMessage(response.status, rawMessage);
        return { data: null, error: friendlyMessage, status: response.status };
      }

      const data = (await response.json().catch(() => null)) as T;
      return { data, error: null, status: response.status };
    } catch (err: any) {
      const friendlyMessage = getFriendlyErrorMessage(0, err?.message);
      return { data: null, error: friendlyMessage, status: 0 };
    }
  }

  /**
   * Check if current session cookie is valid and authenticated as admin
   */
  async checkAuthStatus(): Promise<AuthStatusResponse> {
    const { data } = await this.request<AuthStatusResponse>('/api/auth/status');
    if (data && data.isAuthenticated) {
      return data;
    }
    return { isAuthenticated: false };
  }

  /**
   * Request a 6-digit password reset code sent via transactional email
   */
  async requestPasswordResetCode(email: string): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const response = await fetch('/api/auth/recover/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return { success: false, message: '', error: data.error || 'Erro ao solicitar código de recuperação.' };
      }
      return { success: true, message: data.message || 'Código enviado com sucesso.' };
    } catch (err: any) {
      return { success: false, message: '', error: err.message || 'Erro ao conectar ao servidor.' };
    }
  }

  /**
   * Verify the 6-digit email reset code and set a new admin password
   */
  async verifyResetCodeAndSetPassword(
    email: string,
    code: string,
    newPassword: string
  ): Promise<{ success: boolean; message: string; error?: string; remainingAttempts?: number }> {
    try {
      const response = await fetch('/api/auth/recover/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, code, newPassword, rawPassword: newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return {
          success: false,
          message: '',
          error: data.error || 'Código de verificação ou credencial inválida.',
          remainingAttempts: data.remainingAttempts,
        };
      }
      return { success: true, message: data.message || 'Senha redefinida com sucesso!' };
    } catch (err: any) {
      return { success: false, message: '', error: err.message || 'Erro ao conectar ao servidor.' };
    }
  }

  /**
   * Perform administrative logout and invalidate session cookie
   */
  async logout(): Promise<boolean> {
    this.setAuthToken(null);
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetch all application data from PostgreSQL (Cloud SQL)
   */
  async fetchAppData(): Promise<{ data: AppDataResponse | null; error: string | null; status: number }> {
    const { data, error, status } = await this.request<AppDataResponse>('/api/data');
    return { data, error, status };
  }

  /**
   * Public tracking endpoint for lightweight client lookups
   */
  async fetchPublicTrack(code: string): Promise<{ data: PublicOrderView | null; error: string | null }> {
    const cleanCode = encodeURIComponent(code.trim().toUpperCase());
    const { data, error } = await this.request<PublicOrderView>(`/api/track/${cleanCode}`);
    return { data, error };
  }

  /**
   * Create a new order (and optionally a new client) in PostgreSQL
   */
  async createOrder(
    newOrder: Order,
    newClient?: Client
  ): Promise<{ data: Order | null; client?: Client; error: string | null }> {
    const { data, error } = await this.request<OrderMutationResponse>('/api/orders/new', {
      method: 'POST',
      body: JSON.stringify({
        newOrder,
        newClient,
      }),
    });

    if (error || !data) {
      return { data: null, error: error || 'Erro ao criar encomenda.' };
    }

    return { data: data.order || newOrder, client: newClient, error: null };
  }

  /**
   * Update an existing order and persist audit log in PostgreSQL
   */
  async updateOrder(
    orderId: string,
    updatedOrder: Order,
    auditLog?: AuditLog
  ): Promise<{ data: Order | null; error: string | null }> {
    const encodedId = encodeURIComponent(orderId);
    const { data, error } = await this.request<OrderMutationResponse>(`/api/orders/${encodedId}`, {
      method: 'PUT',
      body: JSON.stringify({
        updatedOrder,
        auditLog,
      }),
    });

    if (error || !data) {
      return { data: null, error: error || 'Erro ao atualizar encomenda.' };
    }

    return { data: data.order || updatedOrder, error: null };
  }

  /**
   * Permanently delete an order in PostgreSQL
   */
  async deleteOrder(orderCode: string): Promise<{ success: boolean; error: string | null }> {
    const encodedCode = encodeURIComponent(orderCode);
    const { error, status } = await this.request<{ success: boolean }>(`/api/orders/${encodedCode}`, {
      method: 'DELETE',
    });

    if (error) {
      return { success: false, error };
    }

    return { success: status >= 200 && status < 300, error: null };
  }

  /**
   * Update client details in PostgreSQL
   */
  async updateClient(
    clientId: string,
    updatedClient: Client
  ): Promise<{ data: Client | null; error: string | null }> {
    const encodedId = encodeURIComponent(clientId);
    const { data, error } = await this.request<ClientMutationResponse>(`/api/clients/${encodedId}`, {
      method: 'PUT',
      body: JSON.stringify({ updatedClient }),
    });

    if (error || !data) {
      return { data: null, error: error || 'Erro ao atualizar cliente.' };
    }

    return { data: data.client || updatedClient, error: null };
  }

  /**
   * Update system settings in PostgreSQL
   */
  async saveSettings(settings: AppSettings): Promise<{ data: AppSettings | null; error: string | null }> {
    const { data, error } = await this.request<SettingsMutationResponse>('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ settings }),
    });

    if (error || !data) {
      return { data: null, error: error || 'Erro ao salvar configurações.' };
    }

    return { data: data.settings || settings, error: null };
  }
}

export const apiService = new ApiService();
