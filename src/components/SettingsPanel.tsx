import React, { useState, useEffect, useMemo } from 'react';
import { AppSettings, AuditLog } from '../types';
import { formatDatePT } from '../utils/formatters';
import { getPublicTrackingUrl } from '../utils/whatsapp';
import { mergePreservedSettings } from '../utils/settingsPreservation';
import { DEFAULT_SETTINGS } from '../data/mockData';
import { 
  generateSalt, 
  hashPasswordWithSalt, 
  evaluatePasswordStrength, 
  sanitizeInput 
} from '../utils/security';
import { 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  KeyRound, 
  FileText, 
  CheckCircle2, 
  Lock, 
  Search,
  Save,
  Store,
  Phone,
  Mail,
  MessageSquare,
  Clock,
  MapPin,
  Tag,
  Globe,
  ExternalLink,
  Link,
  Check,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Cloud,
  Database
} from 'lucide-react';

interface SettingsPanelProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  auditLogs: AuditLog[];
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onUpdateSettings,
  auditLogs,
}) => {
  // Brand & Operations State
  const [brandName, setBrandName] = useState(settings.brandName || 'DELFILÂNDIA');
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || '/logo.jpg');
  const [whatsappNumber, setWhatsappNumber] = useState(settings.whatsappNumber || '923000000');
  const [phoneNumber, setPhoneNumber] = useState(settings.phoneNumber || '923000000');
  const [email, setEmail] = useState(settings.email || 'contacto@delfilandia.com');
  const [initialMessage, setInitialMessage] = useState(
    settings.initialMessage || 'Olá! Vim do site da DELFILÂNDIA e gostaria de tirar uma dúvida sobre a minha encomenda.'
  );
  const [businessHours, setBusinessHours] = useState(settings.businessHours || 'Segunda a Sábado: 08h00 - 18h00');
  const [provincesInput, setProvincesInput] = useState((settings.provincesServed || []).join(', '));
  const [minDeliveryDays, setMinDeliveryDays] = useState(settings.minDeliveryDays || 1);
  const [maxDeliveryDays, setMaxDeliveryDays] = useState(settings.maxDeliveryDays || 3);
  const [codePrefix, setCodePrefix] = useState(settings.codePrefix || 'AO-');
  const [publicTrackingDomain, setPublicTrackingDomain] = useState(settings.publicTrackingDomain || '');

  // Privacy State
  const [showSalesPrice, setShowSalesPrice] = useState<boolean>(settings.showSalesPriceToClient ?? false);
  const [showFullName, setShowFullName] = useState<boolean>(settings.showFullNameToClient ?? false);
  const [showDistrict, setShowDistrict] = useState<boolean>(settings.showDistrictToClient ?? true);
  const [showEstimatedDelivery, setShowEstimatedDelivery] = useState<boolean>(settings.showEstimatedDeliveryToClient ?? true);

  // In-line Password & Email Change State
  const [adminEmailState, setAdminEmailState] = useState<string>(settings.adminEmail || 'admin@delfilandia.com');
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [showCurrentPass, setShowCurrentPass] = useState<boolean>(false);
  const [showNewPass, setShowNewPass] = useState<boolean>(false);
  const [showConfirmPass, setShowConfirmPass] = useState<boolean>(false);
  const [passwordError, setPasswordError] = useState<string>('');
  const [passwordSuccess, setPasswordSuccess] = useState<string>('');

  // Feedback State
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [logSearch, setLogSearch] = useState<string>('');

  // Synchronize component form fields when settings prop updates (e.g. after server sync)
  useEffect(() => {
    if (settings) {
      if (settings.brandName) setBrandName(settings.brandName);
      if (settings.logoUrl) setLogoUrl(settings.logoUrl);
      if (settings.whatsappNumber) setWhatsappNumber(settings.whatsappNumber);
      if (settings.phoneNumber) setPhoneNumber(settings.phoneNumber);
      if (settings.email) setEmail(settings.email);
      if (settings.initialMessage) setInitialMessage(settings.initialMessage);
      if (settings.businessHours) setBusinessHours(settings.businessHours);
      if (Array.isArray(settings.provincesServed)) setProvincesInput(settings.provincesServed.join(', '));
      if (settings.minDeliveryDays !== undefined) setMinDeliveryDays(settings.minDeliveryDays);
      if (settings.maxDeliveryDays !== undefined) setMaxDeliveryDays(settings.maxDeliveryDays);
      if (settings.codePrefix) setCodePrefix(settings.codePrefix);
      if (settings.publicTrackingDomain !== undefined) setPublicTrackingDomain(settings.publicTrackingDomain);
      if (settings.showSalesPriceToClient !== undefined) setShowSalesPrice(settings.showSalesPriceToClient);
      if (settings.showFullNameToClient !== undefined) setShowFullName(settings.showFullNameToClient);
      if (settings.showDistrictToClient !== undefined) setShowDistrict(settings.showDistrictToClient);
      if (settings.showEstimatedDeliveryToClient !== undefined) setShowEstimatedDelivery(settings.showEstimatedDeliveryToClient);
      if (settings.adminEmail) setAdminEmailState(settings.adminEmail);
    }
  }, [settings]);

  // Handle General Settings Save
  const handleSave = () => {
    const provincesArray = provincesInput
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const updatedSettings = mergePreservedSettings(
      {
        ...settings,
        brandName: brandName.trim() || settings.brandName || 'DELFILÂNDIA',
        logoUrl: logoUrl.trim() || settings.logoUrl || '/logo.jpg',
        whatsappNumber: whatsappNumber.trim() || settings.whatsappNumber || '923000000',
        phoneNumber: phoneNumber.trim() || settings.phoneNumber || '923000000',
        email: email.trim() || settings.email || 'contacto@delfilandia.com',
        initialMessage: initialMessage || settings.initialMessage,
        businessHours: businessHours.trim() || settings.businessHours,
        provincesServed: provincesArray.length > 0 ? provincesArray : settings.provincesServed,
        minDeliveryDays: Number(minDeliveryDays) || settings.minDeliveryDays || 1,
        maxDeliveryDays: Number(maxDeliveryDays) || settings.maxDeliveryDays || 3,
        codePrefix: codePrefix.trim() || settings.codePrefix || 'AO-',
        publicTrackingDomain: publicTrackingDomain.trim(),

        showSalesPriceToClient: showSalesPrice,
        showFullNameToClient: showFullName,
        showDistrictToClient: showDistrict,
        showEstimatedDeliveryToClient: showEstimatedDelivery,
      },
      DEFAULT_SETTINGS
    );

    onUpdateSettings(updatedSettings);

    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3500);
  };

  // Handle Direct In-line Credentials Change (Email & Password)
  const handleDirectPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    // 1. Validate Senha Atual
    const trimmedCurrent = currentPasswordInput.trim();

    if (!trimmedCurrent) {
      setPasswordError('Por favor, insira a sua senha atual para autorizar as alterações.');
      return;
    }

    const trimmedEmail = sanitizeInput(adminEmailState).trim().toLowerCase();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setPasswordError('Por favor, informe um Email de Acesso válido.');
      return;
    }

    // 2. Validate Nova Senha if filled
    const trimmedNew = newPasswordInput.trim();

    if (trimmedNew) {
      if (trimmedNew.length < 6) {
        setPasswordError('A nova senha deve ter no mínimo 6 caracteres.');
        return;
      }

      const strengthEval = evaluatePasswordStrength(trimmedNew);
      if (strengthEval.score < 2) {
        setPasswordError('A nova senha é muito fraca. Adicione números ou letras maiúsculas.');
        return;
      }

      const trimmedConfirm = confirmPasswordInput.trim();
      if (trimmedNew !== trimmedConfirm) {
        setPasswordError('A "Nova Senha" e a "Confirmação de Senha" não coincidem.');
        return;
      }
    }

    try {
      // Call backend secure endpoint
      const response = await fetch('/api/auth/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword: trimmedCurrent,
          newPassword: trimmedNew || undefined,
          newEmail: trimmedEmail,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao atualizar credenciais.');
      }

      // Success: Update local state notification
      onUpdateSettings({
        ...settings,
        adminEmail: trimmedEmail,
        adminConfigured: true,
      });

      setPasswordSuccess('Credenciais de administrador (email/senha) salvas com sucesso!');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmPasswordInput('');

      setTimeout(() => {
        setPasswordSuccess('');
      }, 4500);
    } catch (err: any) {
      setPasswordError(err.message || 'Erro ao salvar credenciais.');
    }
  };

  // Test WhatsApp Direct Link
  const handleTestWhatsAppLink = () => {
    const cleanPhone = whatsappNumber.replace(/\D/g, '');
    const fullPhone = cleanPhone.startsWith('244') ? cleanPhone : `244${cleanPhone}`;
    const testMsg = `Olá! Este é um teste de contacto para a loja ${brandName || 'DELFILÂNDIA'}.`;
    const url = `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(testMsg)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const filteredLogs = (auditLogs || []).filter((log) => {
    if (!log) return false;
    const search = logSearch.toLowerCase();
    const orderCode = (log.orderCode || '').toLowerCase();
    const action = (log.action || '').toLowerCase();
    const description = (log.description || '').toLowerCase();
    const createdBy = (log.createdBy || '').toLowerCase();
    return (
      orderCode.includes(search) ||
      action.includes(search) ||
      description.includes(search) ||
      createdBy.includes(search)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Header Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Store className="w-5 h-5" />
            </span>
            <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
              Configurações da Vendedora & Atendimento
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Defina o número de WhatsApp para atendimento dos clientes, altere a senha de acesso e personalize a loja.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isSaved && (
            <div className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-800 animate-pulse">
              <CheckCircle2 className="w-4 h-4" />
              <span>Configurações Salvas!</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer shrink-0"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Configurações</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: WHATSAPP DA VENDEDORA & CONTACTO DOS CLIENTES (DESTAQUE MÁXIMO) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-emerald-50/70 via-white to-emerald-50/40 dark:from-emerald-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-emerald-300 dark:border-emerald-700/80 shadow-md space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/70 dark:border-emerald-900/60 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-sm shrink-0 mt-0.5">
              <MessageSquare className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Número de Telefone da Vendedora (WhatsApp dos Clientes)
                </h2>
                <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Canal Oficial
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Para onde as mensagens dos clientes serão enviadas quando clicarem em <strong>"Falar com a Vendedora"</strong> ou <strong>"Tirar Dúvidas"</strong> na página pública de rastreio.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestWhatsAppLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-300 dark:border-emerald-800 transition-colors cursor-pointer shrink-0"
            title="Abrir WhatsApp para testar se o número está a receber mensagens"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Testar Atendimento no WhatsApp</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          
          {/* Main WhatsApp Phone Input */}
          <div className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-emerald-200 dark:border-emerald-900 space-y-2 shadow-sm">
            <label className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-emerald-600" />
                Número do WhatsApp da Vendedora <span className="text-rose-500">*</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                Angola (+244)
              </span>
            </label>

            <div className="relative">
              <input
                type="text"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="Ex: 932520782 ou +244 932 520 782"
                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border-2 border-emerald-300 focus:border-emerald-500 dark:border-emerald-800 dark:focus:border-emerald-600 rounded-xl text-slate-900 dark:text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/30 transition-all"
              />
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              💡 <strong>Dica:</strong> Pode digitar apenas os 9 dígitos (ex: <code className="font-bold text-slate-700 dark:text-slate-300">932520782</code>). O sistema adiciona automaticamente o indicativo internacional de Angola (<code className="font-bold text-slate-700 dark:text-slate-300">+244</code>).
            </p>
          </div>

          {/* Alternative Phone Input */}
          <div className="bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2 shadow-sm">
            <label className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-blue-600" />
                Telefone Alternativo / Chamadas
              </span>
              <span className="text-[11px] text-slate-500 font-normal">Opcional</span>
            </label>

            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Ex: 923000000"
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Número secundário para chamadas telefónicas diretas e suporte por voz.
            </p>
          </div>

          {/* Initial Pre-filled Message */}
          <div className="md:col-span-2 bg-white dark:bg-slate-800/80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <label className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Mensagem Inicial Padrão do WhatsApp
            </label>

            <textarea
              rows={2}
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Olá! Vim do site da DELFILÂNDIA e gostaria de tirar uma dúvida..."
              className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 leading-relaxed"
            />
            <p className="text-[11px] text-slate-500">
              Texto que já aparecerá digitado no WhatsApp do cliente quando ele abrir a conversa para tirar dúvidas gerais.
            </p>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: SEGURANÇA & CREDENCIAIS DE ACESSO (EMAIL & SENHA)              */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-amber-300 dark:border-amber-700/80 shadow-md space-y-6">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/70 dark:border-amber-900/60 pb-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-600 text-white shadow-sm shrink-0 mt-0.5">
              <KeyRound className="w-5 h-5 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Credenciais de Acesso da Vendedora (Email e Senha)
                </h2>
                <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Protegido
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Defina o <strong>Email de Login</strong> e a <strong>Senha de Acesso</strong> de administrador para proteger as encomendas e finanças.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Painel Protegido</span>
            </span>
          </div>
        </div>

        {/* Inline Credentials Change Form */}
        <form onSubmit={handleDirectPasswordChange} className="space-y-4">
          
          {/* Feedback Messages */}
          {passwordError && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {/* Email de Acesso Row */}
          <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm max-w-md">
            <label className="font-bold text-xs text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Mail className="w-4 h-4 text-amber-600" />
              <span>Email de Acesso (Login do Administrador)</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              value={adminEmailState}
              onChange={(e) => {
                setAdminEmailState(e.target.value);
                if (passwordError) setPasswordError('');
              }}
              required
              placeholder="ex: admin@delfilandia.com"
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="text-[10px] text-slate-400">
              Email principal utilizado para entrar na área administrativa.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            
            {/* 1. Senha Atual */}
            <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
              <label className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                1. Senha Atual de Confirmação <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPasswordInput}
                  onChange={(e) => {
                    setCurrentPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Senha atual para autorizar"
                  className="w-full p-2.5 pr-9 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  title={showCurrentPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Obrigatório para confirmar alterações
              </p>
            </div>

            {/* 2. Nova Senha */}
            <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-amber-200 dark:border-amber-900 space-y-1.5 shadow-sm">
              <label className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                2. Nova Senha <span className="text-slate-400 font-normal">(opcional)</span>
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPasswordInput}
                  onChange={(e) => {
                    setNewPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Mínimo 4 caracteres"
                  className="w-full p-2.5 pr-9 bg-slate-50 dark:bg-slate-900 border-2 border-amber-300 focus:border-amber-500 dark:border-amber-800 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/30"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  title={showNewPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Preencha apenas se desejar mudar a senha
              </p>
            </div>

            {/* 3. Confirmar Nova Senha */}
            <div className="bg-white dark:bg-slate-800/90 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 shadow-sm">
              <label className="font-bold text-xs text-slate-700 dark:text-slate-300 block">
                3. Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPasswordInput}
                  onChange={(e) => {
                    setConfirmPasswordInput(e.target.value);
                    if (passwordError) setPasswordError('');
                  }}
                  placeholder="Repita a nova senha"
                  className="w-full p-2.5 pr-9 bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs sm:text-sm font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
                  title={showConfirmPass ? 'Ocultar' : 'Mostrar'}
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-400">
                Deve ser idêntica à nova senha
              </p>
            </div>

          </div>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600" />
              <span>As novas credenciais passarão a ser exigidas imediatamente ao iniciar sessão.</span>
            </div>

            <button
              type="submit"
              className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 text-xs sm:text-sm active:scale-95 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>Salvar Credenciais de Acesso</span>
            </button>
          </div>

        </form>

      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: CONFIGURAÇÕES DA LOJA, PRAZOS E ATENDIMENTO                    */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Store className="w-5 h-5 text-blue-600" />
              <span>Informações da Loja & Operações em Angola</span>
            </h2>
            <p className="text-xs text-slate-500">
              Personalize o nome da marca, horário de atendimento, prazos de entrega e províncias atendidas.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nome da Marca</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Email Oficial da Loja</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Prefixo do Código de Rastreio</label>
            <input
              type="text"
              value={codePrefix}
              onChange={(e) => setCodePrefix(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-mono font-bold text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Horário de Atendimento</label>
            <input
              type="text"
              value={businessHours}
              onChange={(e) => setBusinessHours(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Prazo Mínimo de Entrega (Dias)</label>
            <input
              type="number"
              min={1}
              value={minDeliveryDays}
              onChange={(e) => setMinDeliveryDays(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Prazo Máximo de Entrega (Dias)</label>
            <input
              type="number"
              min={1}
              value={maxDeliveryDays}
              onChange={(e) => setMaxDeliveryDays(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="sm:col-span-2 lg:col-span-3">
            <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Províncias Atendidas em Angola (Separadas por vírgula)</label>
            <input
              type="text"
              value={provincesInput}
              onChange={(e) => setProvincesInput(e.target.value)}
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: DOMÍNIO & LINK PÚBLICO DE RASTREIO                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <span>Link Público de Rastreio dos Clientes</span>
          </h2>
          <p className="text-xs text-slate-500">
            Endereço utilizado para gerar os links enviados por WhatsApp para consulta de encomendas.
          </p>
        </div>

        <div className="bg-emerald-50/80 dark:bg-emerald-950/30 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="font-bold text-emerald-900 dark:text-emerald-300 flex items-center gap-1.5">
              <Link className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Link de Exemplo Gerado para Encomenda Ativa (AO-160166)
            </span>
            <button
              type="button"
              onClick={() => {
                const testUrl = getPublicTrackingUrl('AO-160166', publicTrackingDomain);
                window.open(testUrl, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-xs shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Link de Exemplo</span>
            </button>
          </div>

          <div className="p-2.5 bg-white dark:bg-slate-900 rounded-lg border border-emerald-200 dark:border-emerald-900 font-mono text-emerald-800 dark:text-emerald-300 text-xs break-all select-all flex items-center justify-between">
            <span>{getPublicTrackingUrl('AO-160166', publicTrackingDomain)}</span>
          </div>

          <p className="text-[11px] text-emerald-700 dark:text-emerald-400/90 leading-relaxed">
            💡 <strong>Acesso Universal:</strong> O link acima é 100% público e pode ser aberto em qualquer telemóvel, navegador ou rede (Unitel, Africell, Wi-Fi) sem necessidade de login.
          </p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 5: PRIVACIDADE DO CLIENTE PÚBLICO                                 */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            <span>Configurações de Privacidade do Cliente Público</span>
          </h2>
          <p className="text-xs text-slate-500">
            Defina o que o cliente pode visualizar na página pública de acompanhamento da encomenda.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          
          {/* Option 1: Sales Price */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Mostrar Valor de Venda ao Cliente</span>
              <input
                type="checkbox"
                checked={showSalesPrice}
                onChange={(e) => setShowSalesPrice(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Se desligado, esconde o valor do produto na consulta pública para maior discrição.
            </p>
          </div>

          {/* Option 2: Full Name */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Mostrar Nome Completo</span>
              <input
                type="checkbox"
                checked={showFullName}
                onChange={(e) => setShowFullName(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Se desligado, mostra apenas o primeiro nome (ex: "Cliente: Maria").
            </p>
          </div>

          {/* Option 3: District */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Mostrar Município / Bairro</span>
              <input
                type="checkbox"
                checked={showDistrict}
                onChange={(e) => setShowDistrict(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Exibe a localidade genérica da entrega em Angola sem revelar a morada exata.
            </p>
          </div>

          {/* Option 4: Estimated Delivery */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 dark:text-white">Mostrar Previsão de Entrega</span>
              <input
                type="checkbox"
                checked={showEstimatedDelivery}
                onChange={(e) => setShowEstimatedDelivery(e.target.checked)}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Exibe a data prevista para entrega do produto.
            </p>
          </div>

        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm active:scale-95 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Salvar Todas as Configurações</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 6: BASE DE DADOS RELACIONAL POSTGRESQL (CLOUD SQL / SUPABASE)     */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-br from-indigo-50/80 via-white to-blue-50/50 dark:from-indigo-950/20 dark:via-slate-900 dark:to-slate-900 rounded-2xl p-5 sm:p-6 border-2 border-indigo-200 dark:border-indigo-900/60 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-100 dark:border-indigo-900/40 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  Base de Dados Relacional PostgreSQL (Cloud SQL / Supabase Engine)
                </h2>
                <span className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  PostgreSQL Ativo
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Estrutura relacional SQL nativa com tabelas de encomendas, clientes, configurações e logs de auditoria gerenciados via Drizzle ORM.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Motor de Banco de Dados:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white">PostgreSQL 15+ (SQL Relacional)</span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Instância & Região:</span>
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 truncate block">
              ai-studio-47fc5704 (europe-west2)
            </span>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800/80 rounded-xl border border-indigo-100 dark:border-slate-700">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">Tabelas Criadas:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> orders, clients, settings, audit_logs
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 7: REGISTRO DE AUDITORIA (AUDIT LOGS)                             */}
      {/* ========================================================================= */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Registro de Auditoria do Sistema (Audit Logs)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Histórico rastreável de todas as alterações em encomendas, pagamentos e estado.
            </p>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filtrar logs..."
              value={logSearch}
              onChange={(e) => setLogSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div className="overflow-x-auto border border-slate-100 dark:border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 font-semibold border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="p-3">Data / Hora</th>
                <th className="p-3">Encomenda</th>
                <th className="p-3">Ação</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Autor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Nenhum registro de auditoria encontrado.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="p-3 font-mono text-slate-500">{formatDatePT(log.createdAt)}</td>
                    <td className="p-3 font-mono font-bold text-slate-900 dark:text-white">{log.orderCode || 'SISTEMA'}</td>
                    <td className="p-3 font-semibold text-blue-600 dark:text-blue-400">{log.action}</td>
                    <td className="p-3 text-slate-700 dark:text-slate-300">{log.description}</td>
                    <td className="p-3 text-slate-500 font-medium">{log.createdBy}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
