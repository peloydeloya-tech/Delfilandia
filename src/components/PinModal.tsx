import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  KeyRound, 
  Sparkles,
  RefreshCw,
  CheckCircle2,
  Send,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { DELFILANDIA_LOGO_SRC, DelfilandiaWordmark } from './DelfilandiaWordmark';
import { sanitizeInput } from '../utils/security';
import { AppSettings } from '../types';
import { apiService } from '../services/api';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appSettings?: AppSettings;
  onOpenSetup?: () => void;
  adminEmail?: string;
  adminPassword?: string;
  currentPin?: string;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  appSettings,
  onOpenSetup,
  adminEmail,
  adminPassword,
  currentPin,
}) => {
  const isConfigured = Boolean(
    appSettings?.adminConfigured || 
    appSettings?.adminPasswordHash || 
    adminPassword || 
    currentPin
  );

  const defaultEmail = (appSettings?.adminEmail || adminEmail || 'acmscorporation@gmail.com').trim();

  const [emailInput, setEmailInput] = useState<string>(() => {
    return localStorage.getItem('delfilandia_admin_login_email') || defaultEmail;
  });
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [lockoutRemaining, setLockoutRemaining] = useState<number>(0);

  // Email Recovery System States
  const [isRecoveryMode, setIsRecoveryMode] = useState<boolean>(false);
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'verify'>('request');
  const [recoveryEmail, setRecoveryEmail] = useState<string>(defaultEmail);
  const [recoveryCodeInput, setRecoveryCodeInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [recoverySuccessMsg, setRecoverySuccessMsg] = useState<string>('');
  const [codeExpiresIn, setCodeExpiresIn] = useState<number>(0);
  const [resendCooldown, setResendCooldown] = useState<number>(0);

  // Sync state on open
  useEffect(() => {
    if (isOpen) {
      const savedEmail = localStorage.getItem('delfilandia_admin_login_email') || defaultEmail;
      setEmailInput(savedEmail);
      setRecoveryEmail(savedEmail);
      setPasswordInput('');
      setErrorMsg('');
      setShowPassword(false);
      setShowNewPassword(false);
      setIsRecoveryMode(false);
      setRecoveryStep('request');
      setRecoveryCodeInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setRecoverySuccessMsg('');

      // Check current lock status from server
      fetch('/api/auth/status')
        .then((res) => (res.ok ? res.json() : null))
        .then((status) => {
          if (status) {
            if (status.isLocked && status.remainingSeconds > 0) {
              setLockoutRemaining(status.remainingSeconds);
            }
            if (status.failedAttempts) {
              setFailedAttempts(status.failedAttempts);
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, defaultEmail]);

  // Lockout countdown timer
  useEffect(() => {
    if (lockoutRemaining <= 0) return;

    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  // Code expiration countdown timer
  useEffect(() => {
    if (codeExpiresIn <= 0) return;
    const timer = setInterval(() => {
      setCodeExpiresIn((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [codeExpiresIn]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Standard Login Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutRemaining > 0) return;

    setErrorMsg('');
    const enteredEmail = sanitizeInput(emailInput).trim().toLowerCase();
    const enteredPassword = passwordInput.trim();

    if (!enteredEmail) {
      setErrorMsg('Por favor, insira o seu email de acesso.');
      return;
    }

    if (!enteredPassword) {
      setErrorMsg('Por favor, insira a sua senha.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: enteredEmail,
          password: enteredPassword,
          rawPassword: enteredPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.isLocked && data.remainingSeconds) {
          setLockoutRemaining(data.remainingSeconds);
        }
        if (typeof data.failedAttempts === 'number') {
          setFailedAttempts(data.failedAttempts);
        }
        throw new Error(data.error || 'Credenciais de acesso incorretas.');
      }

      // Login successful: Save email preference and token
      try {
        localStorage.setItem('delfilandia_admin_login_email', enteredEmail);
        if (data.token) {
          apiService.setAuthToken(data.token);
        }
      } catch {
        // ignore
      }

      setFailedAttempts(0);
      setLockoutRemaining(0);
      setPasswordInput('');
      setErrorMsg('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao realizar login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 1: Request 6-digit verification code by Email
  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setRecoverySuccessMsg('');

    const targetEmail = sanitizeInput(recoveryEmail).trim().toLowerCase();
    if (!targetEmail) {
      setErrorMsg('Por favor, insira o email administrativo da conta.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiService.requestPasswordResetCode(targetEmail);

      if (!result.success) {
        throw new Error(result.error || 'Erro ao enviar código de recuperação.');
      }

      setRecoverySuccessMsg(result.message || 'Código de verificação enviado! Verifique o seu email.');
      setRecoveryStep('verify');
      setCodeExpiresIn(15 * 60); // 15 minutos
      setResendCooldown(60); // 60 segundos antes de reenviar
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao solicitar código de recuperação.');
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Verify 6-digit code and set new password
  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setRecoverySuccessMsg('');

    const targetEmail = sanitizeInput(recoveryEmail).trim().toLowerCase();
    const code = recoveryCodeInput.trim();
    const newPass = newPasswordInput.trim();
    const confirmPass = confirmPasswordInput.trim();

    if (!code) {
      setErrorMsg('Por favor, insira o código de 6 dígitos recebido por email.');
      return;
    }

    if (newPass.length < 6) {
      setErrorMsg('A nova senha deve conter pelo menos 6 caracteres.');
      return;
    }

    if (newPass !== confirmPass) {
      setErrorMsg('As senhas digitadas não coincidem. Por favor, confirme a nova senha.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await apiService.verifyResetCodeAndSetPassword(targetEmail, code, newPass);

      if (!result.success) {
        throw new Error(result.error || 'Código de verificação inválido.');
      }

      setRecoverySuccessMsg('Senha redefinida com sucesso! A redirecionar para o login...');
      setFailedAttempts(0);
      setLockoutRemaining(0);
      
      // Auto pre-fill login with new password and redirect to login mode
      setTimeout(() => {
        setIsRecoveryMode(false);
        setRecoveryStep('request');
        setEmailInput(targetEmail);
        setPasswordInput(newPass);
        setRecoverySuccessMsg('');
        setErrorMsg('');
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao redefinir a senha.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-7 max-w-sm sm:max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header with Logo */}
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border-2 border-amber-500/30 p-1.5 flex items-center justify-center shadow-md ring-4 ring-amber-500/10">
            <img
              src={DELFILANDIA_LOGO_SRC}
              alt="DELFILÂNDIA"
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo.jpg'; }}
            />
          </div>
          <DelfilandiaWordmark size="sm" />
          
          <div className="pt-1">
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-500" />
              <span>{isRecoveryMode ? 'Recuperação de Senha por Email' : 'Acesso da Vendedora'}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isRecoveryMode 
                ? recoveryStep === 'request'
                  ? 'Informe o seu email administrativo para receber o código de 6 dígitos.'
                  : 'Insira o código enviado por email e defina a sua nova senha.'
                : 'Inicie sessão com o seu email e senha de administrador.'}
            </p>
          </div>
        </div>

        {/* Lockout Warning Banner */}
        {lockoutRemaining > 0 && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold text-center space-y-1 animate-pulse">
            <div className="flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              <span>Conta Bloqueada Temporariamente</span>
            </div>
            <p className="font-mono text-sm">
              Tente novamente em {Math.floor(lockoutRemaining / 60)}:{(lockoutRemaining % 60).toString().padStart(2, '0')}
            </p>
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-semibold text-center leading-relaxed">
            {errorMsg}
          </div>
        )}

        {/* Success Alert */}
        {recoverySuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold text-center leading-relaxed flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{recoverySuccessMsg}</span>
          </div>
        )}

        {/* If Admin Not Configured Yet -> Suggest Initial Account Setup */}
        {!isConfigured && !isRecoveryMode ? (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                Nenhuma Conta Configurada
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Ainda não existem credenciais de administrador. Crie a sua conta inicial com senha segura.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onOpenSetup) onOpenSetup();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Criar Conta de Administrador</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : isRecoveryMode ? (
          recoveryStep === 'request' ? (
            /* STEP 1: SOLICITAR CÓDIGO POR EMAIL */
            <form onSubmit={handleRequestCode} className="space-y-3.5">
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Email Administrativo
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={recoveryEmail}
                    onChange={(e) => {
                      setRecoveryEmail(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="ex: acmscorporation@gmail.com"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                  Enviaremos um código seguro de 6 dígitos com validade de 15 minutos.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar</span>
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isLoading ? 'A Enviar...' : 'Enviar Código'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* STEP 2: INSERIR CÓDIGO DE 6 DÍGITOS E DEFINIR NOVA SENHA */
            <form onSubmit={handleVerifyAndResetPassword} className="space-y-3.5">
              {/* Monospace 6-Digit Code */}
              <div className="space-y-1 text-left">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Código de 6 Dígitos
                  </label>
                  {codeExpiresIn > 0 && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 font-mono font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {Math.floor(codeExpiresIn / 60)}:{(codeExpiresIn % 60).toString().padStart(2, '0')}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    maxLength={10}
                    value={recoveryCodeInput}
                    onChange={(e) => {
                      setRecoveryCodeInput(e.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase());
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="ex: 849201"
                    autoFocus
                    required
                    className="w-full pl-9 pr-3 py-2.5 font-mono text-center tracking-widest font-bold uppercase bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-base text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPasswordInput}
                    onChange={(e) => {
                      setNewPasswordInput(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="Mínimo 6 caracteres"
                    required
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1 text-left">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPasswordInput}
                    onChange={(e) => {
                      setConfirmPasswordInput(e.target.value);
                      if (errorMsg) setErrorMsg('');
                    }}
                    placeholder="Repita a nova senha"
                    required
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRecoveryStep('request')}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Alterar Email
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <span>{isLoading ? 'A Redefinir...' : 'Redefinir Senha'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Resend Link */}
              <div className="text-center pt-1">
                <button
                  type="button"
                  disabled={resendCooldown > 0 || isLoading}
                  onClick={() => handleRequestCode()}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-50 disabled:no-underline cursor-pointer inline-flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>
                    {resendCooldown > 0
                      ? `Reenviar código em ${resendCooldown}s`
                      : 'Não recebeu o código? Reenviar por email'}
                  </span>
                </button>
              </div>
            </form>
          )
        ) : (
          /* STANDARD LOGIN FORM */
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* 1. Email Field */}
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Email de Acesso
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={emailInput}
                  disabled={lockoutRemaining > 0}
                  onChange={(e) => {
                    setEmailInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="ex: admin@delfilandia.com"
                  required
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-60"
                />
              </div>
            </div>

            {/* 2. Password Field */}
            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Senha de Acesso
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsRecoveryMode(true);
                    setRecoveryStep('request');
                    setRecoveryEmail(emailInput || defaultEmail);
                    setErrorMsg('');
                    setRecoverySuccessMsg('');
                  }}
                  className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                >
                  Esqueceu a senha?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus={!!emailInput}
                  disabled={lockoutRemaining > 0}
                  value={passwordInput}
                  onChange={(e) => {
                    setPasswordInput(e.target.value);
                    if (errorMsg) setErrorMsg('');
                  }}
                  placeholder="Insira a sua senha"
                  required
                  className="w-full pl-9 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1 rounded-lg"
                  title={showPassword ? 'Ocultar senha' : 'Ver senha'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading || lockoutRemaining > 0}
                className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <span>{isLoading ? 'Verificando...' : 'Entrar'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export const LoginModal = PinModal;
