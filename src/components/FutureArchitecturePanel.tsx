import React, { useState } from 'react';
import { 
  Users, 
  UserCheck, 
  MessageSquare, 
  Smartphone, 
  FileSpreadsheet, 
  QrCode, 
  PackageCheck, 
  CreditCard, 
  Star, 
  PenTool, 
  MapPin, 
  Sparkles, 
  CheckCircle2, 
  Settings, 
  ShieldCheck,
  Send,
  Camera
} from 'lucide-react';

export const FutureArchitecturePanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'roles' | 'whatsapp' | 'delivery' | 'inventory'>('roles');
  const [simulatedSignature, setSimulatedSignature] = useState<boolean>(false);
  const [testSmsSent, setTestSmsSent] = useState<boolean>(false);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
      
      {/* Header */}
      <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" /> Pronta para Expansão Futura
          </span>
          <span className="text-xs text-slate-400 font-mono">Angola Architecture Module</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
          Módulos de Expansão Prontos para Ativação
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          A arquitetura do sistema foi estruturada para suportar múltiplos funcionários, WhatsApp Business API, assinaturas digitais de entrega e controlo de estoque sem necessitar de reescrita do código.
        </p>
      </div>

      {/* Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'roles' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Múltiplos Admins e Funcionários</span>
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'whatsapp' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>WhatsApp API e SMS Angola</span>
        </button>

        <button
          onClick={() => setActiveTab('delivery')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'delivery' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <MapPin className="w-4 h-4" />
          <span>Assinatura Digital e Estafetas</span>
        </button>

        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-colors ${
            activeTab === 'inventory' ? 'bg-amber-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <PackageCheck className="w-4 h-4" />
          <span>Estoque e Avaliações</span>
        </button>
      </div>

      {/* Tab 1: Roles */}
      {activeTab === 'roles' && (
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-blue-600" />
                <span>Administradora Principal</span>
              </div>
              <p className="text-slate-500 text-xs">
                Acesso total: cadastrar produtos, definir margem de lucro, ver custos de compra local e relatórios financeiros completos.
              </p>
              <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                role: 'ADMIN_OWNER'
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <UserCheck className="w-4 h-4 text-blue-600" />
                <span>Assistente / Atendimento</span>
              </div>
              <p className="text-slate-500 text-xs">
                Acesso limitado: registrar pedidos, enviar mensagens pelo WhatsApp, consultar histórico de clientes sem ver custo interno.
              </p>
              <span className="inline-block px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold">
                role: 'ASSISTANT'
              </span>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                <MapPin className="w-4 h-4 text-amber-600" />
                <span>Estafeta / Entregador Local</span>
              </div>
              <p className="text-slate-500 text-xs">
                Acesso apenas a rota do dia, botão de confirmar entrega com foto e assinatura digital do cliente em Luanda.
              </p>
              <span className="inline-block px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold">
                role: 'COURIER'
              </span>
            </div>

          </div>
        </div>
      )}

      {/* Tab 2: WhatsApp & SMS */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-xl border border-blue-200 dark:border-blue-800 space-y-3">
            <h3 className="font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>Conexão WhatsApp Business API & SMS Gateway (Unitel / Movicel)</span>
            </h3>
            <p className="text-blue-800 dark:text-blue-300 text-xs">
              Atualmente o sistema já gera os links diretos para envio manual com 1 clique no WhatsApp. Para envio 100% automático em segundo plano, basta configurar as credenciais do seu gateway:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-300 dark:border-blue-700">
                <span className="text-[11px] font-mono text-slate-500 block">WhatsApp Meta Business Token:</span>
                <input
                  type="password"
                  disabled
                  value="EAAG...WHATSAPP_TOKEN_CONFIGURED"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-xs p-1.5 rounded mt-1 font-mono text-slate-500"
                />
              </div>

              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-blue-300 dark:border-blue-700">
                <span className="text-[11px] font-mono text-slate-500 block">Gateway SMS Angola API Key:</span>
                <input
                  type="password"
                  disabled
                  value="AO_SMS_GATEWAY_UNITEL_KEY"
                  className="w-full bg-slate-100 dark:bg-slate-800 text-xs p-1.5 rounded mt-1 font-mono text-slate-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={() => {
                  setTestSmsSent(true);
                  setTimeout(() => setTestSmsSent(false), 3000);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Testar Simulação de Notificação Automática</span>
              </button>
              {testSmsSent && (
                <p className="text-xs text-blue-700 font-bold mt-2">
                  ✅ Simulação executada: Notificação enviada para o telemóvel do cliente!
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Delivery Signature */}
      {activeTab === 'delivery' && (
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <PenTool className="w-4 h-4 text-amber-600" />
              <span>Comprovativo com Assinatura Digital e Foto de Entrega</span>
            </h3>
            <p className="text-slate-600 dark:text-slate-300 text-xs">
              Módulo interativo para o estafeta recolher a assinatura do destinatário no ecrã do smartphone no momento do recebimento.
            </p>

            {/* Simulated Signature Pad */}
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 rounded-xl p-6 text-center space-y-2">
              {simulatedSignature ? (
                <div className="space-y-2">
                  <div className="font-serif italic text-xl text-blue-600 font-bold">
                    Maria Silva
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Assinado digitalmente em 14/08/2026 04:15 - Luanda (Talatona)
                  </p>
                </div>
              ) : (
                <p className="text-slate-400 text-xs italic">
                  [ Espaço reservado para assinatura com o dedo no smartphone ]
                </p>
              )}
              <button
                onClick={() => setSimulatedSignature(!simulatedSignature)}
                className="px-3 py-1.5 bg-amber-600 text-white font-bold text-xs rounded-lg shadow-sm"
              >
                {simulatedSignature ? 'Limpar Assinatura' : 'Simular Assinatura do Cliente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Inventory */}
      {activeTab === 'inventory' && (
        <div className="space-y-4 text-xs sm:text-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <PackageCheck className="w-4 h-4 text-blue-600" />
                <span>Gestão de Estoque Local em Luanda</span>
              </h4>
              <p className="text-slate-500 text-xs">
                Controlo automático de quantidades em posse da vendedora prontas para pronta entrega.
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500" />
                <span>Avaliações e Opinião do Cliente</span>
              </h4>
              <p className="text-slate-500 text-xs">
                Sondagem de satisfação enviada ao cliente após a confirmação do estado "Entregue".
              </p>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
