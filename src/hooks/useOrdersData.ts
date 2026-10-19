import { useState, useEffect, useMemo, useCallback } from 'react';
import { Order, Client, PublicOrderView, OrderStatus, FinancialStats, AppSettings, AuditLog } from '../types';
import { INITIAL_ORDERS, INITIAL_CLIENTS, INITIAL_AUDIT_LOGS } from '../data/mockData';
import { sanitizeOrderForPublic } from '../utils/security';
import { 
  mergePreservedSettings, 
  persistSettingsLocally, 
  loadSettingsLocally 
} from '../utils/settingsPreservation';
import { STATUS_FLOW, LINEAR_STATUS_FLOW, matchOrderCode, formatKz, getStatusConfig } from '../utils/formatters';
import { apiService } from '../services/api';

export function useOrdersData(isAdminAuthenticated: boolean, activeTab: 'public' | 'admin') {
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [isInitialDataLoaded, setIsInitialDataLoaded] = useState<boolean>(false);

  // Settings & Audit Logs
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadSettingsLocally());

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    if (typeof window === 'undefined') return INITIAL_AUDIT_LOGS;
    const saved = localStorage.getItem('delfilandia_audit_logs') || localStorage.getItem('kwanza_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  // Core Persistent State
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === 'undefined') return INITIAL_ORDERS;
    const saved = localStorage.getItem('delfilandia_orders') || localStorage.getItem('kwanza_orders');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return INITIAL_ORDERS;
  });

  const [clients, setClients] = useState<Client[]>(() => {
    if (typeof window === 'undefined') return INITIAL_CLIENTS;
    const saved = localStorage.getItem('delfilandia_clients') || localStorage.getItem('kwanza_clients');
    if (saved !== null) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return INITIAL_CLIENTS;
  });

  // Sync data from PostgreSQL Cloud SQL (authoritative source)
  const syncFromPostgreSQL = useCallback(async () => {
    if (!isAdminAuthenticated) {
      return;
    }

    const { data, error, status } = await apiService.fetchAppData();
    if (error) {
      if (status === 401 || status === 403) {
        setApiErrorMessage(error);
        return;
      }
      setApiErrorMessage(error);
      return;
    }

    if (data) {
      if (Array.isArray(data.orders)) {
        setOrders(data.orders);
        try {
          localStorage.setItem('delfilandia_orders', JSON.stringify(data.orders));
        } catch {}
      }
      if (Array.isArray(data.clients)) {
        setClients(data.clients);
        try {
          localStorage.setItem('delfilandia_clients', JSON.stringify(data.clients));
        } catch {}
      }
      if (data.settings) {
        setAppSettings((prev) => {
          const merged = mergePreservedSettings(data.settings, prev);
          persistSettingsLocally(merged);
          return merged;
        });
      }
      if (Array.isArray(data.auditLogs)) {
        setAuditLogs(data.auditLogs);
        try {
          localStorage.setItem('delfilandia_audit_logs', JSON.stringify(data.auditLogs));
        } catch {}
      }
      setApiErrorMessage(null);
    }
    setIsInitialDataLoaded(true);
  }, [isAdminAuthenticated]);

  // Initial and reactive sync - only triggered when authenticated
  useEffect(() => {
    if (isAdminAuthenticated) {
      setApiErrorMessage(null);
      import('../lib/firebase').then((fb) => fb.testFirestoreConnection()).catch(() => {});
      syncFromPostgreSQL();
    } else {
      setApiErrorMessage(null);
    }
  }, [isAdminAuthenticated, syncFromPostgreSQL]);

  // Local storage cache updates (non-authoritative cache)
  useEffect(() => {
    if (!isInitialDataLoaded) return;
    try {
      localStorage.setItem('delfilandia_orders', JSON.stringify(orders));
    } catch {}
  }, [orders, isInitialDataLoaded]);

  useEffect(() => {
    if (!isInitialDataLoaded) return;
    try {
      localStorage.setItem('delfilandia_clients', JSON.stringify(clients));
    } catch {}
  }, [clients, isInitialDataLoaded]);

  useEffect(() => {
    if (!isInitialDataLoaded) return;
    try {
      persistSettingsLocally(appSettings);
    } catch {}
  }, [appSettings, isInitialDataLoaded]);

  useEffect(() => {
    if (!isInitialDataLoaded) return;
    try {
      localStorage.setItem('delfilandia_audit_logs', JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs, isInitialDataLoaded]);

  // Log Audit Action Helper
  const logAuditAction = useCallback((
    action: string,
    description: string,
    orderId?: string,
    orderCode?: string
  ) => {
    const nowIso = new Date().toISOString();
    const newLog: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      orderId: orderId || 'SISTEMA',
      orderCode: orderCode || 'GERAL',
      action: action || 'Ação do Sistema',
      description: description || '',
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };
    setAuditLogs((prev) => [newLog, ...(prev || [])]);
  }, []);

  // Search order for public customer tracking
  const handleSearchCode = useCallback((codeToSearch: string): PublicOrderView | null => {
    if (!codeToSearch || !codeToSearch.trim()) return null;
    const found = orders.find((o) => matchOrderCode(o, codeToSearch));
    if (!found) return null;
    return sanitizeOrderForPublic(found, appSettings);
  }, [orders, appSettings]);

  // Advance Order Status
  const handleAdvanceStatus = useCallback(async (orderId: string) => {
    const currentOrder = orders.find((o) => o.id === orderId || o.code === orderId);
    if (!currentOrder) return;

    const currentIdx = LINEAR_STATUS_FLOW.findIndex((s) => s.key === currentOrder.status);
    if (currentIdx < 0 || currentIdx >= LINEAR_STATUS_FLOW.length - 1) return;

    const nextStep = LINEAR_STATUS_FLOW[currentIdx + 1];
    const nowIso = new Date().toISOString();
    const safeTimeline = Array.isArray(currentOrder.timeline) ? currentOrder.timeline : [];

    const updatedTimeline = [
      ...safeTimeline,
      {
        id: `tm-${Date.now()}`,
        status: nextStep.key,
        title: nextStep.label,
        description: nextStep.description,
        timestamp: nowIso,
        isCompleted: true,
      },
    ];

    const auditLogObj: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      orderId: currentOrder.id || currentOrder.code,
      orderCode: currentOrder.code,
      action: 'Avanço de Estado',
      description: `Estado avançado para "${nextStep.label}"`,
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    const updatedOrder: Order = {
      ...currentOrder,
      status: nextStep.key,
      updatedAt: nowIso,
      timeline: updatedTimeline,
    };

    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? updatedOrder : o)));

    const { data: confirmedOrder, error } = await apiService.updateOrder(updatedOrder.id || updatedOrder.code, updatedOrder, auditLogObj);
    if (error) {
      // Rollback on error
      setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? currentOrder : o)));
      setApiErrorMessage(error);
      return;
    }

    const finalOrder = confirmedOrder || updatedOrder;
    setOrders((prev) => prev.map((o) => (o.id === finalOrder.id || o.code === finalOrder.code ? finalOrder : o)));
    setAuditLogs((prev) => [auditLogObj, ...(prev || [])]);
    setApiErrorMessage(null);
  }, [orders]);

  // Update Status Manually
  const handleUpdateStatus = useCallback(async (
    orderId: string,
    newStatus: OrderStatus,
    note?: string
  ): Promise<Order | null> => {
    const currentOrder = orders.find((o) => o.id === orderId || o.code === orderId);
    if (!currentOrder) return null;

    const statusConfig = STATUS_FLOW.find((s) => s.key === newStatus);
    const nowIso = new Date().toISOString();
    const safeTimeline = Array.isArray(currentOrder.timeline) ? currentOrder.timeline : [];

    const updatedTimeline = [
      ...safeTimeline,
      {
        id: `tm-${Date.now()}`,
        status: newStatus,
        title: statusConfig ? statusConfig.label : newStatus,
        description: statusConfig ? statusConfig.description : 'Estado atualizado manualmente.',
        timestamp: nowIso,
        isCompleted: true,
        publicNote: note,
      },
    ];

    const auditLogObj: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      orderId: currentOrder.id || currentOrder.code,
      orderCode: currentOrder.code,
      action: 'Alteração de Estado',
      description: `Estado alterado manualmente para "${statusConfig?.label || newStatus}"${note ? ` (Nota: ${note})` : ''}`,
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    const updatedOrder: Order = {
      ...currentOrder,
      status: newStatus,
      publicNotes: note ? note : currentOrder.publicNotes,
      updatedAt: nowIso,
      timeline: updatedTimeline,
    };

    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? updatedOrder : o)));

    const { data: confirmedOrder, error } = await apiService.updateOrder(updatedOrder.id || updatedOrder.code, updatedOrder, auditLogObj);
    if (error) {
      // Rollback on error
      setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? currentOrder : o)));
      setApiErrorMessage(error);
      return null;
    }

    const finalOrder = confirmedOrder || updatedOrder;
    setOrders((prev) => prev.map((o) => (o.id === finalOrder.id || o.code === finalOrder.code ? finalOrder : o)));
    setAuditLogs((prev) => [auditLogObj, ...(prev || [])]);
    setApiErrorMessage(null);
    return finalOrder;
  }, [orders]);

  // Confirm Delivery
  const handleConfirmDelivery = useCallback(async (
    orderId: string,
    recipientName: string,
    recipientDoc: string,
    photoUrl?: string,
    deliveryNote?: string
  ): Promise<Order | null> => {
    const currentOrder = orders.find((o) => o.id === orderId || o.code === orderId);
    if (!currentOrder) return null;

    const nowIso = new Date().toISOString();
    const safeTimeline = Array.isArray(currentOrder.timeline) ? currentOrder.timeline : [];
    const updatedTimeline = [
      ...safeTimeline,
      {
        id: `tm-${Date.now()}`,
        status: 'ENTREGUE' as OrderStatus,
        title: 'Entregue com Sucesso',
        description: `Recebido por ${recipientName}${recipientDoc ? ` (Doc: ${recipientDoc})` : ''}.`,
        timestamp: nowIso,
        isCompleted: true,
        publicNote: deliveryNote,
      },
    ];

    const auditLogObj: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      orderId: currentOrder.id || currentOrder.code,
      orderCode: currentOrder.code,
      action: 'Entrega Confirmada',
      description: `Entrega confirmada para ${recipientName} (Doc: ${recipientDoc})`,
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    const updatedOrder: Order = {
      ...currentOrder,
      status: 'ENTREGUE',
      deliveryRecipientName: recipientName,
      deliveryRecipientDoc: recipientDoc,
      deliveryPhotoUrl: photoUrl,
      publicNotes: deliveryNote || currentOrder.publicNotes,
      updatedAt: nowIso,
      timeline: updatedTimeline,
    };

    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? updatedOrder : o)));

    const { data: confirmedOrder, error } = await apiService.updateOrder(updatedOrder.id || updatedOrder.code, updatedOrder, auditLogObj);
    if (error) {
      // Rollback on error
      setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? currentOrder : o)));
      setApiErrorMessage(error);
      return null;
    }

    const finalOrder = confirmedOrder || updatedOrder;
    setOrders((prev) => prev.map((o) => (o.id === finalOrder.id || o.code === finalOrder.code ? finalOrder : o)));
    setAuditLogs((prev) => [auditLogObj, ...(prev || [])]);
    setApiErrorMessage(null);
    return finalOrder;
  }, [orders]);

  // Delete Order
  const handleDeleteOrder = useCallback(async (orderId: string) => {
    const orderToDelete = orders.find((o) => o.id === orderId || o.code === orderId);
    if (!orderToDelete) return;

    const { success, error } = await apiService.deleteOrder(orderToDelete.code);
    if (error || !success) {
      setApiErrorMessage(error || 'Erro ao eliminar encomenda.');
      return;
    }

    const remaining = orders.filter((o) => o.id !== orderToDelete.id && o.code !== orderToDelete.code);
    setOrders(remaining);

    logAuditAction(
      'Eliminar Encomenda',
      `Encomenda ${orderToDelete.code} do cliente ${orderToDelete.clientName} (${orderToDelete.productName}) eliminada permanentemente. O link de rastreio público foi desativado.`,
      orderToDelete.id,
      orderToDelete.code
    );
    setApiErrorMessage(null);
  }, [orders, logAuditAction]);

  // Save Admin Notes
  const handleSaveAdminNotes = useCallback(async (orderId: string, notes: string): Promise<Order | null> => {
    const currentOrder = orders.find((o) => o.id === orderId || o.code === orderId);
    if (!currentOrder) return null;

    const nowIso = new Date().toISOString();
    const updatedOrder: Order = {
      ...currentOrder,
      adminNotes: notes,
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? updatedOrder : o)));

    const auditLogObj: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      orderId: currentOrder.id || currentOrder.code,
      orderCode: currentOrder.code,
      action: 'Notas Internas Salvas',
      description: 'Notas internas atualizadas',
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    const { data: confirmedOrder, error } = await apiService.updateOrder(updatedOrder.id || updatedOrder.code, updatedOrder, auditLogObj);
    if (error) {
      // Rollback on error
      setOrders((prev) => prev.map((o) => (o.id === currentOrder.id || o.code === currentOrder.code ? currentOrder : o)));
      setApiErrorMessage(error);
      return null;
    }

    const finalOrder = confirmedOrder || updatedOrder;
    setOrders((prev) => prev.map((o) => (o.id === finalOrder.id || o.code === finalOrder.code ? finalOrder : o)));
    setAuditLogs((prev) => [auditLogObj, ...(prev || [])]);
    setApiErrorMessage(null);
    return finalOrder;
  }, [orders]);

  // Update Full Order
  const handleUpdateOrder = useCallback(async (updatedOrder: Order): Promise<Order | null> => {
    const nowIso = new Date().toISOString();
    const gross = (updatedOrder.resalePrice || 0) - (updatedOrder.purchaseCost || 0);
    const net = gross - (updatedOrder.deliveryCost || 0) - (updatedOrder.otherCosts || 0);
    const pending = Math.max(0, (updatedOrder.resalePrice || 0) - (updatedOrder.amountPaid || 0));

    const finalOrder: Order = {
      ...updatedOrder,
      amountPending: pending,
      grossProfit: gross,
      netProfit: net,
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    const auditLogObj: AuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      orderId: finalOrder.id || finalOrder.code,
      orderCode: finalOrder.code,
      action: 'Edição de Dados da Encomenda',
      description: `Dados da encomenda ${finalOrder.code} atualizados (Cliente: ${finalOrder.clientName}, Artigo: ${finalOrder.productName}, Preço: ${formatKz(finalOrder.resalePrice)})`,
      createdAt: nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: nowIso,
      updatedBy: 'Vendedora Admin',
    };

    // Optimistic UI update
    setOrders((prev) => prev.map((o) => (o.id === finalOrder.id || o.code === finalOrder.code ? finalOrder : o)));

    const { data: confirmedOrder, error } = await apiService.updateOrder(finalOrder.id || finalOrder.code, finalOrder, auditLogObj);
    if (error) {
      setApiErrorMessage(error);
      return null;
    }

    const savedOrder = confirmedOrder || finalOrder;
    setOrders((prev) => prev.map((o) => (o.id === savedOrder.id || o.code === savedOrder.code ? savedOrder : o)));
    setAuditLogs((prev) => [auditLogObj, ...(prev || [])]);

    // Update client list if clientId matches
    if (savedOrder.clientId) {
      setClients((prev) =>
        prev.map((c) => {
          if (c.id === savedOrder.clientId) {
            return {
              ...c,
              name: savedOrder.clientName || c.name,
              phone: savedOrder.clientPhone || c.phone,
              province: savedOrder.clientProvince || c.province,
              district: savedOrder.clientDistrict || c.district,
              address: savedOrder.clientAddress || c.address,
            };
          }
          return c;
        })
      );
    }

    setApiErrorMessage(null);
    return savedOrder;
  }, []);

  // Save New Order
  const handleSaveOrder = useCallback(async (
    newOrderData: Partial<Order>,
    newClientObj?: Client
  ): Promise<Order | null> => {
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const code = newOrderData.code || `AO-${randomSuffix}`;
    const nowIso = new Date().toISOString();
    const orderStatus: OrderStatus = (newOrderData.status as OrderStatus) || 'AGUARDANDO_PAGAMENTO';
    const statusCfg = getStatusConfig(orderStatus);

    const gross = newOrderData.grossProfit ?? ((newOrderData.resalePrice || 0) - (newOrderData.purchaseCost || 0));
    const net = newOrderData.netProfit ?? (gross - (newOrderData.deliveryCost || 0) - (newOrderData.otherCosts || 0));
    const pending = newOrderData.amountPending ?? Math.max(0, (newOrderData.resalePrice || 0) - (newOrderData.amountPaid || 0));

    const fullOrder: Order = {
      id: newOrderData.id || `ord-${Date.now()}`,
      code,
      createdAt: newOrderData.createdAt || nowIso,
      createdBy: 'Vendedora Admin',
      updatedAt: newOrderData.updatedAt || nowIso,
      updatedBy: 'Vendedora Admin',
      clientId: newOrderData.clientId || `cli-${Date.now()}`,
      clientName: newOrderData.clientName || 'Cliente Particular',
      clientPhone: newOrderData.clientPhone || '',
      clientProvince: newOrderData.clientProvince || 'Luanda',
      clientDistrict: newOrderData.clientDistrict || '',
      clientAddress: newOrderData.clientAddress || '',
      productName: newOrderData.productName || 'Artigo Adquirido em Angola',
      productDescription: newOrderData.productDescription || '',
      productImageUrl: newOrderData.productImageUrl || (newOrderData.productImageUrls?.[0] || ''),
      productImageUrls: newOrderData.productImageUrls || (newOrderData.productImageUrl ? [newOrderData.productImageUrl] : undefined),
      quantity: newOrderData.quantity || 1,
      resalePrice: newOrderData.resalePrice || 0,
      amountPaid: newOrderData.amountPaid ?? 0,
      amountPending: pending,
      paymentStatus: newOrderData.paymentStatus || (orderStatus === 'AGUARDANDO_PAGAMENTO' ? 'PENDENTE' : 'CONFIRMADO'),
      paymentMethod: newOrderData.paymentMethod || 'EXPRESS',
      paymentReceiptRef: newOrderData.paymentReceiptRef || '',
      status: orderStatus,
      estimatedDeliveryDate: newOrderData.estimatedDeliveryDate || '',
      courierName: newOrderData.courierName || '',
      courierPhone: newOrderData.courierPhone || '',
      publicNotes: newOrderData.publicNotes || 'Pedido registrado no sistema da DELFILÂNDIA.',
      purchaseCost: newOrderData.purchaseCost || 0,
      purchaseLocation: newOrderData.purchaseLocation || 'Comércio Local em Angola',
      deliveryCost: newOrderData.deliveryCost || 0,
      otherCosts: newOrderData.otherCosts || 0,
      grossProfit: gross,
      netProfit: net,
      adminNotes: newOrderData.adminNotes || '',
      timeline: newOrderData.timeline && newOrderData.timeline.length > 0 ? newOrderData.timeline : [
        {
          id: `tm-${Date.now()}`,
          status: orderStatus,
          title: statusCfg?.label || 'Aguardando Pagamento',
          description: statusCfg?.description || 'Estamos a aguardar a confirmação do pagamento.',
          timestamp: nowIso,
          isCompleted: true,
        },
      ],
    };

    const existingClient = clients.find((c) => c.id === fullOrder.clientId || c.phone === fullOrder.clientPhone);
    let createdClientObj: Client | undefined = newClientObj;
    if (!existingClient && !createdClientObj && fullOrder.clientName) {
      createdClientObj = {
        id: fullOrder.clientId,
        name: fullOrder.clientName,
        phone: fullOrder.clientPhone,
        province: fullOrder.clientProvince,
        district: fullOrder.clientDistrict,
        address: fullOrder.clientAddress,
        totalOrders: 1,
        totalSpent: fullOrder.resalePrice,
        createdAt: nowIso,
      };
    }

    const { data: savedOrder, error } = await apiService.createOrder(fullOrder, createdClientObj);
    if (error || !savedOrder) {
      setApiErrorMessage(error || 'Erro ao registrar encomenda.');
      return null;
    }

    setOrders((prev) => [savedOrder, ...prev.filter((o) => o.id !== savedOrder.id && o.code !== savedOrder.code)]);

    if (createdClientObj && !existingClient) {
      setClients((prev) => [createdClientObj!, ...prev.filter((c) => c.id !== createdClientObj!.id)]);
    } else if (existingClient) {
      setClients((prev) =>
        prev.map((c) =>
          c.id === existingClient.id
            ? {
                ...c,
                totalOrders: c.totalOrders + 1,
                totalSpent: c.totalSpent + savedOrder.resalePrice,
              }
            : c
        )
      );
    }

    logAuditAction('Nova Encomenda', `Encomenda criada com código ${savedOrder.code}`, savedOrder.id, savedOrder.code);
    setApiErrorMessage(null);
    return savedOrder;
  }, [clients, logAuditAction]);

  // Update Client Info
  const handleUpdateClientInfo = useCallback(async (updatedClient: Client) => {
    const { data, error } = await apiService.updateClient(updatedClient.id, updatedClient);
    if (error || !data) {
      setApiErrorMessage(error || 'Erro ao atualizar cliente.');
      return;
    }

    setClients((prev) => prev.map((c) => (c.id === data.id ? data : c)));
    setApiErrorMessage(null);
  }, []);

  // Save Settings
  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    const { data, error } = await apiService.saveSettings(newSettings);
    if (error || !data) {
      setApiErrorMessage(error || 'Erro ao salvar configurações.');
      return;
    }

    setAppSettings(data);
    persistSettingsLocally(data);
    logAuditAction('Configurações Atualizadas', 'Configurações gerais do sistema alteradas');
    setApiErrorMessage(null);
  }, [logAuditAction]);

  // Financial Stats calculation
  const financialStats: FinancialStats = useMemo(() => {
    let totalSales = 0;
    let totalPurchases = 0;
    let totalDelivery = 0;
    let totalOther = 0;
    let totalGross = 0;
    let totalNet = 0;

    orders.forEach((o) => {
      totalSales += o.resalePrice;
      totalPurchases += o.purchaseCost;
      totalDelivery += o.deliveryCost;
      totalOther += o.otherCosts;
      totalGross += o.grossProfit;
      totalNet += o.netProfit;
    });

    const averageMarginPercent = totalSales > 0 ? (totalNet / totalSales) * 100 : 0;

    return {
      totalRevenueResale: totalSales,
      totalPurchaseCosts: totalPurchases,
      totalDeliveryCosts: totalDelivery,
      totalOtherCosts: totalOther,
      grossProfit: totalGross,
      netProfit: totalNet,
      averageMarginPercent,
    };
  }, [orders]);

  return {
    orders,
    clients,
    appSettings,
    setAppSettings,
    auditLogs,
    financialStats,
    apiErrorMessage,
    setApiErrorMessage,
    isInitialDataLoaded,
    logAuditAction,
    handleSearchCode,
    handleAdvanceStatus,
    handleUpdateStatus,
    handleConfirmDelivery,
    handleDeleteOrder,
    handleSaveAdminNotes,
    handleUpdateOrder,
    handleSaveOrder,
    handleUpdateClientInfo,
    handleSaveSettings,
    syncFromPostgreSQL,
  };
}
