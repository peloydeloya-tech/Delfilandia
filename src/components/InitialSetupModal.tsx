import React, { useState, useMemo } from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Mail, 
  User, 
  KeyRound, 
  Check, 
  X, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  Copy, 
  CheckCircle2, 
  AlertTriangle,
  ShieldAlert
} from 'lucide-react';
import { DELFILANDIA_LOGO_SRC, DelfilandiaWordmark } from './DelfilandiaWordmark';
import { 
  generateSalt, 
  hashPasswordWithSalt, 
  evaluatePasswordStrength, 
  generateRecoveryCode,
  sanitizeInput
} from '../utils/security';
import { AppSettings } from '../types';
import { apiService } from '../services/api';

interface InitialSetupModalProps {
  isOpen: boolean;
  onSuccessSetup: (newSettings: Partial<AppSettings>) => void;
  onClose?: () => void;
}

export const InitialSetupModal: React.FC<InitialSetupModalProps> = ({
  isOpen,
  onSuccessSetup,
  onClose,
}) => {
  const [adminName, setAdminName] = useState<string>('Administrador');
  const [adminEmail, setAdminEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);

  // Recovery Code
  const [recoveryCode] = useState<string>(() => generateRecoveryCode());
  const [isCopiedCode, setIsCopiedCode] = useState<boolean>(false);
  const [isCodeConfirmed, setIsCodeConfirmed] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [step, setStep] = useState<'form' | 'recovery_success'>('form');

  // Real-time password strength analysis
  const strength = useMemo(() => evaluatePasswordStrength(password), [password]);

  if (!isOpen) return null;

  const handleCopyCode = () => {
    try {
      navigator.clipboard.writeText(recoveryCode);
      setIsCopiedCode(true);
      setTimeout(() => setIsCopiedCode(false), 3000);
    } catch {
      // fallback
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = sanitizeInput(adminEmail).toLowerCase().trim();
    const cleanName = sanitizeInput(adminName).trim() || 'Administrador';
    const cleanPass = password.trim();

    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg('Por favor, informe um endereço de email válido.');
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    if (cleanPass !== confirmPassword.trim()) {
      setErrorMsg('A confirmação de senha não coincide com a senha inserida.');
      return;
    }

    if (strength.score < 2) {
      setErrorMsg('A senha escolhida é fraca ou comum. Adicione números, letras maiúsculas ou símbolos.');
      return;
    }

    setIsLoading(true);

    try {
      // Direct secure setup submission to Backend Security Engine
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          adminName: cleanName,
          adminEmail: cleanEmail,
          password: cleanPass,
          rawPassword: cleanPass,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao configurar a conta de administrador.');
      }

      // 3. Save email for convenience in local storage and set auth token
      try {
        localStorage.setItem('delfilandia_admin_login_email', cleanEmail);
        if (data.token) {
          apiService.setAuthToken(data.token);
        }
      } catch {
        // ignore
      }

      // 4. Update frontend state
      onSuccessSetup({
        adminConfigured: true,
        adminName: cleanName,
        adminEmail: cleanEmail,
        adminRecoveryCode: data.recoveryCode || recoveryCode,
        failedLoginAttempts: 0,
        lockedUntil: undefined,
      });

      setStep('recovery_success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro inesperado ao criar a conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthBarColor = (score: number) => {
    switch (score) {
      case 0:
      case 1:
        return 'bg-rose-500';
      case 2:
        return 'bg-amber-500';
      case 3:
        return 'bg-emerald-500';
      case 4:
      default:
        return 'bg-emerald-400';
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6 my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-2 flex items-center justify-center shadow-lg ring-4 ring-amber-500/10">
            <img
              src={DELFILANDIA_LOGO_SRC}
              alt="DELFILÂNDIA"
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
            />
          </div>
          <DelfilandiaWordmark size="md" />
          
          <div className="pt-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Configuração Inicial de Segurança</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Criar Conta de Administrador
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-1">
              Defina as suas credenciais personalizadas para proteger o painel de encomendas da DELFILÂNDIA.
            </p>
          </div>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Error banner */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-start gap-2.5 text-xs text-rose-700 dark:text-rose-300 font-semibold leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Nome da Administradora */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Nome da Vendedora / Administradora
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  placeholder="ex: Delfina Samba"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 2. Email de Acesso */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email de Acesso (Login Principal)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="ex: seuemail@gmail.com ou admin@delfilandia.com"
                  required
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* 3. Senha */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Senha Segura
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Crie uma senha forte (mínimo 6 dígitos)"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {password.length > 0 && (
                <div className="pt-1.5 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Força da Senha:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{strength.label}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 h-1.5">
                    {[1, 2, 3, 4].map((stepIdx) => (
                      <div
                        key={stepIdx}
                        className={`h-full rounded-full transition-all ${
                          strength.score >= stepIdx
                            ? getStrengthBarColor(strength.score)
                            : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                      />
                    ))}
                  </div>
                  {strength.feedback && (
                    <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                      💡 {strength.feedback}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* 4. Confirmação de Senha */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirmar Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Repita a sua senha"
                  required
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Emergency Recovery Code Preview Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  Código de Emergência Único:
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
                >
                  {isCopiedCode ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{isCopiedCode ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <div className="font-mono text-xs font-black bg-white dark:bg-slate-950 px-3 py-2 rounded-xl text-amber-600 dark:text-amber-400 border border-amber-500/30 text-center tracking-wider select-all">
                {recoveryCode}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Guarde este código num local seguro. Ele permitirá recuperar o acesso se esquecer da senha.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex gap-3">
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Agora Não
                </button>
              )}
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition-all flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span>Configurando com Segurança...</span>
                ) : (
                  <>
                    <span>Criar Minha Conta de Administrador</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Step 2: Confirmation & Key Safe Record */
          <div className="space-y-5 text-center py-2 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-500 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                Conta Criada com Sucesso!
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                O seu login de administrador está ativo e protegido com criptografia SHA-256 e políticas anti-invasão.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-left space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Email de Acesso:</span>
                <span className="font-bold text-slate-900 dark:text-white">{adminEmail}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 dark:text-slate-400">Código de Emergência:</span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{recoveryCode}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (onClose) onClose();
              }}
              className="w-full py-3.5 px-6 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Aceder ao Painel da Vendedora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
