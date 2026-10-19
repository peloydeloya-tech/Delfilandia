export interface ApiMutationResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  status?: number;
}

/**
 * Maps HTTP and Database errors to friendly user-facing messages
 */
export function getFriendlyErrorMessage(status: number, data?: any, defaultMsg = 'Ocorreu um erro ao processar a operação.'): string {
  if (status === 409) {
    return 'Já existe uma encomenda ou registo com este identificador / código.';
  }
  if (status === 422) {
    return 'O cliente ou dado associado não foi encontrado no banco de dados.';
  }
  if (status === 400) {
    return data?.error || 'Os dados informados são inválidos ou incompletos.';
  }
  if (status === 503) {
    return 'O banco de dados está temporariamente indisponível. Por favor tente novamente em instantes.';
  }
  if (status === 401 || status === 403) {
    return 'Sessão expirada ou não autorizada. Por favor autentique-se novamente.';
  }
  return data?.error || defaultMsg;
}
