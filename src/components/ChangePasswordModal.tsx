import React, { useState, useEffect, useMemo } from 'react';
import { 
  Lock, 
  KeyRound, 
  X, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Mail,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  generateSalt, 
  hashPasswordWithSalt, 
  evaluatePasswordStrength, 
  sanitizeInput 
} from '../utils/security';
import { AppSettings } from '../types';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSettings?: AppSettings;
  adminEmail?: string;
  adminPassword?: string;
  onSuccessChange: (newCredentials: { 
    newPasswordHash?: string; 
    newSalt?: string; 
    newEmail?: string;
    newPassword?: string;
  }) => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
  appSettings,
  adminEmail,
  adminPassword,
  onSuccessChange,
}) => {
  const currentSavedEmail = (appSettings?.adminEmail || adminEmail || '').trim();
  const [emailInput, setEmailInput] = useState<string>(currentSavedEmail);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');

  const [showCurrent, setShowCurrent] = useState<boolean>(false);
  const [showNew, setShowNew] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const strength = useMemo(() => evaluatePasswordStrength(newPasswordInput), [newPasswordInput]);

  useEffect(() => {
    if (isOpen) {
      setEmailInput(appSettings?.adminEmail || adminEmail || '');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setErrorMsg('');
      setSuccessMsg('');
    }
  }, [isOpen, appSettings, adminEmail]);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleClose = () => {
    handleResetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const enteredCurrent = currentPasswordInput.trim();
    if (!enteredCurrent) {
      setErrorMsg('Por favor, insira a sua "Senha Atual" para autorizar a alteração.');
      return;
    }

    const trimmedEmail = sanitizeInput(emailInput).trim().toLowerCase();
    const trimmedNewPass = newPasswordInput.trim();

    if (!trimmedEmail) {
      setErrorMsg('O Email de Acesso não pode estar vazio.');
      return;
    }

    // 1. Verify current password hash if salt exists
    if (appSettings?.adminPasswordSalt && appSettings?.adminPasswordHash) {
      const currentComputedHash = await hashPasswordWithSalt(enteredCurrent, appSettings.adminPasswordSalt);
      if (currentComputedHash !== appSettings.adminPasswordHash) {
        setErrorMsg('A "Senha Atual" informada está incorreta.');
        return;
      }
    } else if (adminPassword && enteredCurrent !== adminPassword) {
      setErrorMsg('A "Senha Atual" informada está incorreta.');
      return;
    }

    // 2. Validate new password if provided
    if (trimmedNewPass) {
      if (trimmedNewPass.length < 6) {
        setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }

      if (strength.score < 2) {
        setErrorMsg('A nova senha é muito fraca. Adicione números ou caracteres variados.');
        return;
      }

      if (trimmedNewPass !== confirmPasswordInput.trim()) {
        setErrorMsg('A "Nova Senha" e a "Confirmação de Senha" não coincidem.');
        return;
      }
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: enteredCurrent,
          newPassword: trimmedNewPass || undefined,
          newEmail: trimmedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar credenciais.');
      }

      onSuccessChange({
        newEmail: trimmedEmail,
        newPassword: trimmedNewPass || undefined,
      });

      setSuccessMsg('Credenciais de administrador atualizadas com sucesso!');

      setTimeout(() => {
        handleClose();
      }, 1400);
    } catch (err: any) {
      setErrorMsg(err.message || 'Erro ao atualizar credenciais.');
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full p-6 sm:p-7 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-black text-base sm:text-lg text-slate-900 dark:text-white">
              Alterar Credenciais de Acesso
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Atualize o seu <strong>Email de Login</strong> ou defina uma <strong>Nova Senha Segura</strong> com criptografia SHA-256.
        </p>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-2 text-xs font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="space-y-1 text-left">
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
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="seuemail@exemplo.com"
                required
                className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Senha Atual */}
          <div className="space-y-1 text-left">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Senha Atual (Obrigatória)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPasswordInput}
                onChange={(e) => setCurrentPasswordInput(e.target.value)}
                placeholder="Insira a sua senha atual"
                required
                className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-1 border-t border-slate-100 dark:border-slate-800" />

          {/* Nova Senha */}
          <div className="space-y-1 text-left">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Nova Senha (Opcional)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="Deixe em branco para manter a atual"
                className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Password Strength Meter */}
            {newPasswordInput.length > 0 && (
              <div className="pt-1 space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">Força da Senha:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-200">{strength.label}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 h-1">
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
              </div>
            )}
          </div>

          {/* Confirmar Nova Senha */}
          {newPasswordInput && (
            <div className="space-y-1 text-left">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Confirme a nova senha"
                  required
                  className="w-full pl-9 pr-10 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <span>Salvando...</span>
              ) : (
                <>
                  <span>Salvar Alterações</span>
                  <Check className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
