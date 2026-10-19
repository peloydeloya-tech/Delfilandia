import React, { useState } from 'react';
import { Order, WhatsAppTemplate } from '../types';
import { DEFAULT_WHATSAPP_TEMPLATES, replaceTemplateVariables, getWhatsAppLink } from '../utils/whatsapp';
import { 
  MessageSquare, 
  Send, 
  Copy, 
  Check, 
  Search, 
  User, 
  Package, 
  Calendar, 
  MapPin, 
  FileEdit,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { DelfilandiaWordmark } from './DelfilandiaWordmark';

interface WhatsAppCentralProps {
  orders: Order[];
  onLogAuditAction?: (action: string, description: string, orderId?: string, orderCode?: string) => void;
}

export const WhatsAppCentral: React.FC<WhatsAppCentralProps> = ({ orders, onLogAuditAction }) => {
  const [selectedOrderId, setSelectedOrderId] = useState<string>(orders[0]?.id || '');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(DEFAULT_WHATSAPP_TEMPLATES[0].id);
  const [customMessage, setCustomMessage] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [orderSearch, setOrderSearch] = useState<string>('');

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || orders[0];
  const selectedTemplate = DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.id === selectedTemplateId) || DEFAULT_WHATSAPP_TEMPLATES[0];

  // Sync custom message when order or template changes
  React.useEffect(() => {
    if (selectedOrder && selectedTemplate) {
      setCustomMessage(replaceTemplateVariables(selectedTemplate.templateText, selectedOrder));
    }
  }, [selectedOrderId, selectedTemplateId, orders]);

  const filteredOrders = orders.filter((o) =>
    o.code.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.clientName.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.productName.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const handleCopyMessage = () => {
    if (!customMessage) return;
    navigator.clipboard.writeText(customMessage);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);

    if (selectedOrder && onLogAuditAction) {
      onLogAuditAction(
        'Mensagem WhatsApp Copiada',
        `Mensagem de WhatsApp copiada para a encomenda ${selectedOrder.code}`,
        selectedOrder.id,
        selectedOrder.code
      );
    }
  };

  const handleOpenWhatsApp = () => {
    if (!selectedOrder || !customMessage) return;
    const link = getWhatsAppLink(selectedOrder.clientPhone, customMessage);
    window.open(link, '_blank');

    if (onLogAuditAction) {
      onLogAuditAction(
        'Envio WhatsApp Preparado',
        `Abertura de link do WhatsApp para cliente ${selectedOrder.clientName} (${selectedOrder.clientPhone}) - Encomenda ${selectedOrder.code}`,
        selectedOrder.id,
        selectedOrder.code
      );
    }
  };

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-blue-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="bg-blue-500/20 text-blue-300 font-mono text-xs font-bold px-3 py-1 rounded-full border border-blue-500/30 inline-flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Central de Comunicação Directa (wa.me)
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <span>Central WhatsApp •</span>
            <DelfilandiaWordmark size="md" />
          </h2>
          <p className="text-xs sm:text-sm text-blue-100/80 mt-1 max-w-2xl">
            Gere mensagens personalizadas com modelos pré-configurados e variáveis automáticas (cliente, produto, código, estado e previsão). Envie via wa.me iniciado manualmente pela vendedora.
          </p>
        </div>

        {selectedOrder && (
          <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 text-xs shrink-0 space-y-1">
            <span className="text-blue-300 font-bold block">Encomenda Selecionada:</span>
            <span className="font-mono font-bold text-white text-sm block">{selectedOrder.code}</span>
            <span className="text-slate-200 block">{selectedOrder.clientName} ({selectedOrder.clientPhone})</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT 4 COLS: Order Selector */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-600" />
              <span>1. Escolher Encomenda</span>
            </h3>
            <span className="text-xs text-slate-400 font-mono">{filteredOrders.length} ordens</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Pesquisar por código ou cliente..."
              value={orderSearch}
              onChange={(e) => setOrderSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filteredOrders.length === 0 ? (
              <p className="text-xs text-slate-400 p-4 text-center">Nenhuma encomenda encontrada.</p>
            ) : (
              filteredOrders.map((ord) => {
                const isSelected = ord.id === selectedOrderId;
                return (
                  <button
                    key={ord.id}
                    onClick={() => setSelectedOrderId(ord.id)}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-500 text-blue-950 dark:text-blue-100 shadow-sm ring-1 ring-blue-500'
                        : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs">{ord.code}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                        {ord.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white truncate">{ord.clientName}</span>
                    <span className="text-[11px] text-slate-500 truncate">{ord.productName}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT 8 COLS: Template Selector + Live Editor */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Template Selector */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              <span>2. Escolher Modelo de Mensagem</span>
            </h3>

            <div className="flex flex-wrap gap-2">
              {DEFAULT_WHATSAPP_TEMPLATES.map((tpl) => {
                const isSelected = tpl.id === selectedTemplateId;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {tpl.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Message Generator & Live Editor */}
          {selectedOrder && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                    <FileEdit className="w-4 h-4 text-blue-600" />
                    <span>3. Gerar e Editar Mensagem</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Edite o texto livremente antes de enviar. As variáveis foram substituídas automaticamente com os dados do cliente.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                      isCopied
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {isCopied ? <Check className="w-3.5 h-3.5 text-blue-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{isCopied ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>
              </div>

              {/* Textarea Editor */}
              <div className="space-y-2">
                <textarea
                  rows={10}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl p-4 text-xs sm:text-sm font-sans text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none leading-relaxed shadow-inner"
                />
              </div>

              {/* Available Variables Chips */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs space-y-1.5">
                <span className="font-bold text-slate-700 dark:text-slate-300 block text-[11px]">
                  Variáveis suportadas nos modelos:
                </span>
                <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{cliente}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{produto}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{codigo}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{estado}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{previsao}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{provincia}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-slate-600 dark:text-slate-300">{"{{municipio}}"}</span>
                  <span className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border text-blue-600 dark:text-blue-400 font-bold">{"{{link}}"}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>Destinatário: <strong>{selectedOrder.clientName}</strong> ({selectedOrder.clientPhone})</span>
                </div>

                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <Send className="w-4 h-4" />
                  <span>Enviar pelo WhatsApp (wa.me)</span>
                  <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                </button>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
};
