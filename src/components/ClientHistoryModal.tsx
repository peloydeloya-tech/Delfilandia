import React, { useState } from 'react';
import { Client, Order } from '../types';
import { formatKz, formatAngolaPhone, formatDatePT, getStatusConfig, getPaymentStatusInfo } from '../utils/formatters';
import { X, User, Phone, MapPin, ShoppingBag, DollarSign, Calendar, MessageSquare, Plus, Edit2, Save, Eye, CheckCircle2 } from 'lucide-react';

interface ClientHistoryModalProps {
  client: Client | null;
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onOpenNewOrderForClient: (client: Client) => void;
  onOpenOrderDetails: (order: Order) => void;
  onUpdateClientInfo?: (updatedClient: Client) => void;
}

export const ClientHistoryModal: React.FC<ClientHistoryModalProps> = ({
  client,
  isOpen,
  onClose,
  orders,
  onOpenNewOrderForClient,
  onOpenOrderDetails,
  onUpdateClientInfo,
}) => {
  if (!isOpen || !client) return null;

  const clientOrders = orders.filter((o) => o.clientId === client.id || o.clientPhone === client.phone);
  const totalSpentCalculated = clientOrders.reduce((sum, o) => sum + o.resalePrice, 0);

  // Find last order date
  const sortedOrders = [...clientOrders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const lastOrderDate = sortedOrders.length > 0 ? sortedOrders[0].createdAt : client.createdAt;

  // Edit State
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(client.name);
  const [editPhone, setEditPhone] = useState(client.phone);
  const [editProvince, setEditProvince] = useState(client.province);
  const [editDistrict, setEditDistrict] = useState(client.district || '');
  const [editAddress, setEditAddress] = useState(client.address);

  const handleSaveEdit = () => {
    if (!onUpdateClientInfo) return;
    const updated: Client = {
      ...client,
      name: editName,
      phone: editPhone,
      province: editProvince,
      district: editDistrict,
      address: editAddress,
    };
    onUpdateClientInfo(updated);
    setIsEditing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-500/30">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">Histórico do Cliente</h2>
              <p className="text-xs text-slate-400">{client.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          
          {/* Client Overview Info Box */}
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
            {!isEditing ? (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{client.name}</h3>
                    <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      {formatAngolaPhone(client.phone)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 hover:bg-slate-100 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Editar Dados</span>
                    </button>

                    <a
                      href={`https://wa.me/244${client.phone.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>WhatsApp</span>
                    </a>

                    <button
                      onClick={() => {
                        onClose();
                        onOpenNewOrderForClient(client);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Nova Encomenda</span>
                    </button>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                  <p className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-semibold">Localização:</span>
                    <span>{client.province} {client.district ? `- ${client.district}` : ''} ({client.address})</span>
                  </p>
                </div>
              </div>
            ) : (
              /* Editing Form */
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Editar Dados do Cliente</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Telefone</label>
                    <input
                      type="text"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Província</label>
                    <input
                      type="text"
                      value={editProvince}
                      onChange={(e) => setEditProvince(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Município</label>
                    <input
                      type="text"
                      value={editDistrict}
                      onChange={(e) => setEditDistrict(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 block mb-1">Endereço de Entrega</label>
                    <input
                      type="text"
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Salvar Alterações</span>
                  </button>
                </div>
              </div>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 pt-2 text-center border-t border-slate-200 dark:border-slate-700">
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Total Encomendas</span>
                <span className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                  {clientOrders.length}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Total Comprado</span>
                <span className="text-xs sm:text-sm font-extrabold text-blue-700 dark:text-blue-400">
                  {formatKz(totalSpentCalculated)}
                </span>
              </div>
              <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700">
                <span className="text-[10px] text-slate-400 block font-bold">Última Encomenda</span>
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                  {formatDatePT(lastOrderDate).slice(0, 11)}
                </span>
              </div>
            </div>
          </div>

          {/* Orders History List */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
              <span>Lista de Encomendas Registadas ({clientOrders.length})</span>
            </h3>

            {clientOrders.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <p className="text-xs text-slate-500">Nenhuma encomenda registada para este cliente ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {clientOrders.map((order) => {
                  const statusInfo = getStatusConfig(order.status);
                  const paymentInfo = getPaymentStatusInfo(order.paymentStatus);

                  return (
                    <div
                      key={order.id}
                      className="bg-white dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                            {order.code}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusInfo.badgeBg}`}>
                            {statusInfo.badgeText}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${paymentInfo.badgeBg}`}>
                            {paymentInfo.label}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {order.productName}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {formatDatePT(order.createdAt)} • Previsão: {order.estimatedDeliveryDate}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-700">
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 block">Valor Venda</span>
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                            {formatKz(order.resalePrice)}
                          </span>
                        </div>

                        <button
                          onClick={() => {
                            onClose();
                            onOpenOrderDetails(order);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center gap-1 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5 text-blue-600" />
                          <span>Ver Encomenda</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};
