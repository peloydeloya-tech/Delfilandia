import React, { useState } from 'react';
import { Client, Order } from '../types';
import { formatKz, formatAngolaPhone, formatDatePT } from '../utils/formatters';
import { Users, Phone, MapPin, ShoppingBag, Plus, MessageSquare, Search, Eye, Calendar } from 'lucide-react';
import { ClientHistoryModal } from './ClientHistoryModal';

interface ClientManagementProps {
  clients: Client[];
  orders: Order[];
  onOpenNewOrderForClient: (client: Client) => void;
  onOpenOrderDetailsModal?: (order: Order) => void;
  onUpdateClientInfo?: (updatedClient: Client) => void;
}

export const ClientManagement: React.FC<ClientManagementProps> = ({
  clients,
  orders,
  onOpenNewOrderForClient,
  onOpenOrderDetailsModal,
  onUpdateClientInfo,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery) ||
      c.province.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.district && c.district.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      {/* Top Bar with Search and Add */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Buscar cliente por nome, telefone, província ou município..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white"
          />
        </div>
        <div className="text-xs font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0">
          Total: {filteredClients.length} cliente(s)
        </div>
      </div>

      {/* Clients Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredClients.map((client) => {
          const clientOrders = orders.filter((o) => o.clientId === client.id || o.clientPhone === client.phone);
          const totalSpentCalculated = clientOrders.reduce((sum, o) => sum + o.resalePrice, 0);

          // Get last order date
          const sorted = [...clientOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const lastOrder = sorted.length > 0 ? sorted[0] : null;

          return (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-800 transition-all"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white">
                      {client.name}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      {formatAngolaPhone(client.phone)}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-800 shrink-0">
                    {clientOrders.length} Encomenda(s)
                  </span>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1 bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>
                      <strong className="text-slate-900 dark:text-slate-200">{client.province}</strong>
                      {client.district ? ` (${client.district})` : ''} - {client.address}
                    </span>
                  </p>
                  {lastOrder && (
                    <p className="flex items-center gap-1.5 text-slate-500 text-[11px] pt-1 border-t border-slate-200/60 dark:border-slate-700">
                      <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                      <span>Última encomenda: <strong>{formatDatePT(lastOrder.createdAt)}</strong></span>
                    </p>
                  )}
                </div>
              </div>

              {/* Bottom Financials & Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                <div>
                  <span className="text-[10px] text-slate-400 block font-bold">Total Comprado (Kz)</span>
                  <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                    {formatKz(totalSpentCalculated || client.totalSpent)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelectedClientForHistory(client)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Ver Histórico Completo do Cliente"
                  >
                    <Eye className="w-3.5 h-3.5 text-blue-600" />
                    <span>Ver Histórico</span>
                  </button>

                  <a
                    href={`https://wa.me/244${client.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 transition-colors"
                    title="Abrir WhatsApp Directo"
                  >
                    <MessageSquare className="w-4 h-4" />
                  </a>

                  <button
                    onClick={() => onOpenNewOrderForClient(client)}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                    title="Registrar Nova Encomenda para este cliente"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nova</span>
                  </button>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {/* Client History Modal */}
      <ClientHistoryModal
        client={selectedClientForHistory}
        isOpen={!!selectedClientForHistory}
        onClose={() => setSelectedClientForHistory(null)}
        orders={orders}
        onOpenNewOrderForClient={onOpenNewOrderForClient}
        onOpenOrderDetails={(ord) => {
          if (onOpenOrderDetailsModal) {
            onOpenOrderDetailsModal(ord);
          }
        }}
        onUpdateClientInfo={onUpdateClientInfo}
      />
    </div>
  );
};
