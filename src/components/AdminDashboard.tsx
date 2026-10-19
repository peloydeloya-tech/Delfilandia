import React, { useState, useMemo, useRef } from 'react';
import { Order, Client, FinancialStats, OrderStatus, DatePeriodFilter } from '../types';
import { formatKz, STATUS_FLOW, LINEAR_STATUS_FLOW, getStatusConfig, formatDatePT, checkIsOrderDelayed } from '../utils/formatters';
import { 
  Plus, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Package, 
  CheckCircle2, 
  Truck, 
  Search, 
  Filter, 
  MessageSquare, 
  Eye, 
  Users, 
  FileText, 
  Sparkles, 
  Lock, 
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  AlertTriangle,
  Clock,
  CreditCard,
  Check,
  XCircle,
  HelpCircle,
  Percent,
  QrCode,
  Tag,
  Download,
  X,
  AlertCircle,
  Trash2,
  KeyRound,
  Images as ImagesIcon
} from 'lucide-react';
import { ExportModal } from './ExportModal';

export type AlertFilterType =
  | 'NONE'
  | 'PENDING_PAYMENT'
  | 'DELAYED'
  | 'NOT_YET_BOUGHT'
  | 'BOUGHT_NOT_RECEIVED'
  | 'TODAY_DELIVERIES'
  | 'WITH_PROBLEMS';

interface AdminDashboardProps {
  orders: Order[];
  clients?: Client[];
  stats: FinancialStats;
  adminPin?: string;
  onUpdateAdminPin?: (newPin: string) => void;
  onOpenNewOrderModal: () => void;
  onOpenOrderDetailsModal: (order: Order) => void;
  onAdvanceStatus: (orderId: string) => void;
  onUpdateStatus?: (orderId: string, newStatus: OrderStatus, customNote?: string) => void;
  onDeleteOrder?: (orderId: string) => void;
  onSendWhatsAppUpdate: (order: Order) => void;
  onOpenMarkAsDelivered: (order: Order) => void;
  onOpenClientReceipt: (order: Order) => void;
  onOpenInternalReceipt: (order: Order) => void;
  onOpenQRCode: (order: Order) => void;
  onOpenShippingLabel: (order: Order) => void;
  activeSubTab: 'orders' | 'whatsapp' | 'products' | 'clients' | 'financials' | 'future' | 'settings';
  setActiveSubTab: (tab: 'orders' | 'whatsapp' | 'products' | 'clients' | 'financials' | 'future' | 'settings') => void;
  onLogAuditAction?: (action: string, description: string, orderId?: string, orderCode?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  orders,
  clients = [],
  adminPin = '1234',
  onUpdateAdminPin,
  onOpenNewOrderModal,
  onOpenOrderDetailsModal,
  onAdvanceStatus,
  onUpdateStatus,
  onDeleteOrder,
  onSendWhatsAppUpdate,
  onOpenMarkAsDelivered,
  onOpenClientReceipt,
  onOpenInternalReceipt,
  onOpenQRCode,
  onOpenShippingLabel,
  activeSubTab,
  setActiveSubTab,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [activeAlertFilter, setActiveAlertFilter] = useState<AlertFilterType>('NONE');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodFilter>('TODOS');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const ordersSectionRef = useRef<HTMLDivElement>(null);

  // FILTER ORDERS BY PERIOD & STATUS & SEARCH
  const periodFilteredOrders = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);

    return orders.filter((order) => {
      const orderDate = order.createdAt.slice(0, 10);

      if (periodFilter === 'HOJE') {
        if (orderDate !== todayStr) return false;
      } else if (periodFilter === '7_DIAS') {
        const d = new Date(order.createdAt);
        const diffDays = (now.getTime() - d.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7) return false;
      } else if (periodFilter === 'ESTE_MES') {
        const d = new Date(order.createdAt);
        if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
      } else if (periodFilter === 'MES_ANTERIOR') {
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const d = new Date(order.createdAt);
        if (d.getMonth() !== lastMonthDate.getMonth() || d.getFullYear() !== lastMonthDate.getFullYear()) return false;
      } else if (periodFilter === 'PERSONALIZADO') {
        if (customStartDate && orderDate < customStartDate) return false;
        if (customEndDate && orderDate > customEndDate) return false;
      }

      return true;
    });
  }, [orders, periodFilter, customStartDate, customEndDate]);

  // CALC FINANCIAL STATS FOR FILTERED PERIOD
  const periodStats = useMemo(() => {
    let totalRevenue = 0;
    let totalReceived = 0;
    let totalPending = 0;
    let totalCost = 0;
    let totalDeliveryCost = 0;
    let totalOtherCosts = 0;
    let grossProfit = 0;
    let netProfit = 0;

    periodFilteredOrders.forEach((o) => {
      totalRevenue += o.resalePrice;
      totalReceived += o.amountPaid;
      totalPending += o.amountPending ?? Math.max(0, o.resalePrice - o.amountPaid);
      totalCost += o.purchaseCost;
      totalDeliveryCost += o.deliveryCost ?? o.additionalExpenses ?? 0;
      totalOtherCosts += o.otherCosts ?? 0;
      grossProfit += o.grossProfit ?? (o.resalePrice - o.purchaseCost);
      netProfit += o.netProfit ?? (o.resalePrice - o.purchaseCost - (o.deliveryCost ?? o.additionalExpenses ?? 0) - (o.otherCosts ?? 0));
    });

    const averageMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      totalReceived,
      totalPending,
      totalCost,
      totalDeliveryCost,
      totalOtherCosts,
      grossProfit,
      netProfit,
      averageMarginPercent,
      activeCount: periodFilteredOrders.filter((o) => o.status !== 'ENTREGUE' && o.status !== 'CANCELADA').length,
      deliveredCount: periodFilteredOrders.filter((o) => o.status === 'ENTREGUE').length,
      totalCount: periodFilteredOrders.length,
    };
  }, [periodFilteredOrders]);

  // ADMINISTRATIVE ALERTS
  const alerts = useMemo(() => {
    const todayISO = new Date().toISOString().slice(0, 10);

    const pendingPayment = orders.filter(
      (o) => o.paymentStatus === 'PENDENTE' || o.paymentStatus === 'PARCIAL'
    );
    const delayed = orders.filter((o) => checkIsOrderDelayed(o));
    const notYetBought = orders.filter(
      (o) => o.status === 'AGUARDANDO_PAGAMENTO' || o.status === 'PAGAMENTO_CONFIRMADO'
    );
    const boughtNotReceived = orders.filter((o) => o.status === 'PRODUTO_COMPRADO');
    const todayDeliveries = orders.filter(
      (o) => o.estimatedDeliveryDate === todayISO && o.status !== 'ENTREGUE'
    );
    const withProblems = orders.filter((o) => o.status === 'PROBLEMA');

    return {
      pendingPayment,
      delayed,
      notYetBought,
      boughtNotReceived,
      todayDeliveries,
      withProblems,
      totalAlertsCount:
        pendingPayment.length +
        delayed.length +
        notYetBought.length +
        boughtNotReceived.length +
        todayDeliveries.length +
        withProblems.length,
    };
  }, [orders]);

  // ALERT METADATA FOR TITLES & DESCRIPTIONS
  const alertMeta: Record<
    AlertFilterType,
    { title: string; description: string; count: number }
  > = {
    NONE: {
      title: 'Todas as Encomendas',
      description: 'A exibir todas as encomendas do período.',
      count: orders.length,
    },
    PENDING_PAYMENT: {
      title: 'Pagamentos Pendentes',
      description: 'Encomendas com pagamento pendente ou parcial aguardando liquidação.',
      count: alerts.pendingPayment.length,
    },
    DELAYED: {
      title: 'Entregas Atrasadas',
      description: 'Encomendas cuja data prevista de entrega já expirou e ainda não foram entregues.',
      count: alerts.delayed.length,
    },
    NOT_YET_BOUGHT: {
      title: 'Produtos a Comprar',
      description: 'Encomendas que aguardam compra física no comércio local em Angola.',
      count: alerts.notYetBought.length,
    },
    BOUGHT_NOT_RECEIVED: {
      title: 'Aguardando Recepção',
      description: 'Produtos já comprados que aguardam recepção e preparação para envio ao cliente.',
      count: alerts.boughtNotReceived.length,
    },
    TODAY_DELIVERIES: {
      title: 'Entregas para Hoje',
      description: 'Encomendas com previsão de entrega agendada para a data de hoje.',
      count: alerts.todayDeliveries.length,
    },
    WITH_PROBLEMS: {
      title: 'Com Problemas',
      description: 'Encomendas com ocorrência ou problema registado que requerem intervenção.',
      count: alerts.withProblems.length,
    },
  };

  const handleAlertClick = (filterType: AlertFilterType) => {
    if (activeAlertFilter === filterType) {
      setActiveAlertFilter('NONE');
    } else {
      setActiveAlertFilter(filterType);
      setActiveSubTab('orders');
      setTimeout(() => {
        ordersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  // FINAL FILTERED TABLE
  const finalFilteredOrders = periodFilteredOrders.filter((order) => {
    const matchesSearch =
      order.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.clientPhone.includes(searchTerm);

    const matchesStatus = statusFilter === 'ALL' || order.status === statusFilter;

    let matchesAlert = true;
    const todayISO = new Date().toISOString().slice(0, 10);

    if (activeAlertFilter === 'PENDING_PAYMENT') {
      matchesAlert = order.paymentStatus === 'PENDENTE' || order.paymentStatus === 'PARCIAL';
    } else if (activeAlertFilter === 'DELAYED') {
      matchesAlert = checkIsOrderDelayed(order);
    } else if (activeAlertFilter === 'NOT_YET_BOUGHT') {
      matchesAlert = order.status === 'AGUARDANDO_PAGAMENTO' || order.status === 'PAGAMENTO_CONFIRMADO';
    } else if (activeAlertFilter === 'BOUGHT_NOT_RECEIVED') {
      matchesAlert = order.status === 'PRODUTO_COMPRADO';
    } else if (activeAlertFilter === 'TODAY_DELIVERIES') {
      matchesAlert = order.estimatedDeliveryDate === todayISO && order.status !== 'ENTREGUE';
    } else if (activeAlertFilter === 'WITH_PROBLEMS') {
      matchesAlert = order.status === 'PROBLEMA';
    }

    return matchesSearch && matchesStatus && matchesAlert;
  });

  return (
    <div className="space-y-6 pb-12">
      
      {/* Top Welcome & Quick Actions Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-amber-500/20 text-amber-300 text-xs font-bold px-2.5 py-0.5 rounded border border-amber-500/30 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              Painel Restrito da Vendedora
            </span>
            <span className="text-xs text-slate-400 font-mono">Angola Local Resale</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
            Gestão de Encomendas e Lucro
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Controle de clientes, pagamentos, compras no comércio local em Angola e acompanhamento.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={() => setIsExportModalOpen(true)}
            className="bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold py-3 px-3.5 rounded-xl border border-slate-700 shadow-md transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm shrink-0 active:scale-95 cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-400" />
            <span>Exportar</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewOrderModal}
            className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 sm:px-5 rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 text-xs sm:text-sm shrink-0 active:scale-95 border border-blue-500/40 cursor-pointer"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Nova Encomenda</span>
          </button>
        </div>
      </div>

      {/* ADMINISTRATIVE ALERTS BANNER */}
      {alerts.totalAlertsCount > 0 && (
        <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-800/80 pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
              <div>
                <h3 className="font-bold text-sm sm:text-base text-amber-900 dark:text-amber-200">
                  Alertas Administrativos ({alerts.totalAlertsCount}) - Encomendas que precisam da sua atenção
                </h3>
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Clique em qualquer alerta abaixo para filtrar e visualizar imediatamente as encomendas correspondentes.
                </p>
              </div>
            </div>
            
            {activeAlertFilter !== 'NONE' && (
              <button
                type="button"
                onClick={() => setActiveAlertFilter('NONE')}
                className="text-xs font-bold text-amber-800 dark:text-amber-200 bg-amber-200 dark:bg-amber-800/60 hover:bg-amber-300 dark:hover:bg-amber-700 px-3 py-1 rounded-full transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3 h-3" />
                <span>Limpar Filtro</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            {/* 1. Pagamentos Pendentes */}
            <button
              type="button"
              onClick={() => handleAlertClick('PENDING_PAYMENT')}
              title="Clique para filtrar pagamentos pendentes ou parciais"
              className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
                activeAlertFilter === 'PENDING_PAYMENT'
                  ? 'ring-2 ring-amber-500 bg-amber-200 dark:bg-amber-800/90 border-amber-500 shadow-md scale-[1.02]'
                  : alerts.pendingPayment.length > 0
                  ? 'bg-amber-100/80 dark:bg-amber-900/50 border-amber-300 text-amber-950 dark:text-amber-100 hover:bg-amber-200/80 hover:shadow-sm hover:scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold block text-[11px] leading-tight">Pagamentos Pendentes</span>
                {activeAlertFilter === 'PENDING_PAYMENT' && (
                  <span className="text-[9px] bg-amber-600 text-white font-bold px-1.5 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-extrabold">{alerts.pendingPayment.length}</span>
                <span className="text-[10px] opacity-70 font-semibold">Ver lista →</span>
              </div>
            </button>

            {/* 2. Entregas Atrasadas */}
            <button
              type="button"
              onClick={() => handleAlertClick('DELAYED')}
              title="Clique para filtrar encomendas com entrega atrasada"
              className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
                activeAlertFilter === 'DELAYED'
                  ? 'ring-2 ring-rose-500 bg-rose-200 dark:bg-rose-900/90 border-rose-500 shadow-md scale-[1.02]'
                  : alerts.delayed.length > 0
                  ? 'bg-rose-100/80 dark:bg-rose-950/60 border-rose-300 text-rose-950 dark:text-rose-100 hover:bg-rose-200/80 hover:shadow-sm hover:scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold block text-[11px] leading-tight">Entregas Atrasadas</span>
                {activeAlertFilter === 'DELAYED' && (
                  <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-extrabold">{alerts.delayed.length}</span>
                <span className="text-[10px] opacity-70 font-semibold">Ver lista →</span>
              </div>
            </button>

            {/* 3. Produtos a Comprar */}
            <button
              type="button"
              onClick={() => handleAlertClick('NOT_YET_BOUGHT')}
              title="Clique para filtrar encomendas que precisam de ser compradas localmente"
              className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
                activeAlertFilter === 'NOT_YET_BOUGHT'
                  ? 'ring-2 ring-blue-500 bg-blue-200 dark:bg-blue-900/90 border-blue-500 shadow-md scale-[1.02]'
                  : alerts.notYetBought.length > 0
                  ? 'bg-blue-100/80 dark:bg-blue-950/60 border-blue-300 text-blue-950 dark:text-blue-100 hover:bg-blue-200/80 hover:shadow-sm hover:scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold block text-[11px] leading-tight">Produtos a Comprar</span>
                {activeAlertFilter === 'NOT_YET_BOUGHT' && (
                  <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-extrabold">{alerts.notYetBought.length}</span>
                <span className="text-[10px] opacity-70 font-semibold">Ver lista →</span>
              </div>
            </button>

            {/* 4. Aguardando Recepção */}
            <button
              type="button"
              onClick={() => handleAlertClick('BOUGHT_NOT_RECEIVED')}
              title="Clique para filtrar produtos já comprados aguardando recepção ou envio"
              className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
                activeAlertFilter === 'BOUGHT_NOT_RECEIVED'
                  ? 'ring-2 ring-purple-500 bg-purple-200 dark:bg-purple-900/90 border-purple-500 shadow-md scale-[1.02]'
                  : alerts.boughtNotReceived.length > 0
                  ? 'bg-purple-100/80 dark:bg-purple-950/60 border-purple-300 text-purple-950 dark:text-purple-100 hover:bg-purple-200/80 hover:shadow-sm hover:scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold block text-[11px] leading-tight">Aguardando Recepção</span>
                {activeAlertFilter === 'BOUGHT_NOT_RECEIVED' && (
                  <span className="text-[9px] bg-purple-600 text-white font-bold px-1.5 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-extrabold">{alerts.boughtNotReceived.length}</span>
                <span className="text-[10px] opacity-70 font-semibold">Ver lista →</span>
              </div>
            </button>

            {/* 5. Entregas para Hoje */}
            <button
              type="button"
              onClick={() => handleAlertClick('TODAY_DELIVERIES')}
              title="Clique para filtrar encomendas agendadas para entrega hoje"
              className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
                activeAlertFilter === 'TODAY_DELIVERIES'
                  ? 'ring-2 ring-blue-500 bg-blue-200 dark:bg-blue-900/90 border-blue-500 shadow-md scale-[1.02]'
                  : alerts.todayDeliveries.length > 0
                  ? 'bg-blue-100/80 dark:bg-blue-950/60 border-blue-300 text-blue-950 dark:text-blue-100 hover:bg-blue-200/80 hover:shadow-sm hover:scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold block text-[11px] leading-tight">Entregas para Hoje</span>
                {activeAlertFilter === 'TODAY_DELIVERIES' && (
                  <span className="text-[9px] bg-blue-600 text-white font-bold px-1.5 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-extrabold">{alerts.todayDeliveries.length}</span>
                <span className="text-[10px] opacity-70 font-semibold">Ver lista →</span>
              </div>
            </button>

            {/* 6. Com Problemas */}
            <button
              type="button"
              onClick={() => handleAlertClick('WITH_PROBLEMS')}
              title="Clique para filtrar encomendas marcadas com ocorrência ou problema"
              className={`p-2.5 rounded-xl border flex flex-col justify-between text-left transition-all duration-200 cursor-pointer ${
                activeAlertFilter === 'WITH_PROBLEMS'
                  ? 'ring-2 ring-rose-500 bg-rose-200 dark:bg-rose-900 border-rose-500 shadow-md scale-[1.02]'
                  : alerts.withProblems.length > 0
                  ? 'bg-rose-200 dark:bg-rose-900 border-rose-400 text-rose-950 dark:text-white hover:bg-rose-300 dark:hover:bg-rose-800 hover:shadow-sm hover:scale-[1.01]'
                  : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-bold block text-[11px] leading-tight">Com Problemas</span>
                {activeAlertFilter === 'WITH_PROBLEMS' && (
                  <span className="text-[9px] bg-rose-600 text-white font-bold px-1.5 py-0.5 rounded-full">Ativo</span>
                )}
              </div>
              <div className="flex items-baseline justify-between mt-1">
                <span className="text-lg font-extrabold">{alerts.withProblems.length}</span>
                <span className="text-[10px] opacity-70 font-semibold">Ver lista →</span>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* PERIOD FILTER SELECTION BAR */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Filtrar Indicadores por Período:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['TODOS', 'HOJE', '7_DIAS', 'ESTE_MES', 'MES_ANTERIOR', 'PERSONALIZADO'] as DatePeriodFilter[]).map((pf) => (
            <button
              key={pf}
              onClick={() => setPeriodFilter(pf)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                periodFilter === pf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {pf === 'TODOS' && 'Todo o Período'}
              {pf === 'HOJE' && 'Hoje'}
              {pf === '7_DIAS' && 'Últimos 7 dias'}
              {pf === 'ESTE_MES' && 'Este Mês'}
              {pf === 'MES_ANTERIOR' && 'Mês Anterior'}
              {pf === 'PERSONALIZADO' && 'Personalizado'}
            </button>
          ))}
        </div>

        {periodFilter === 'PERSONALIZADO' && (
          <div className="flex items-center gap-2 pt-2 md:pt-0">
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
            />
            <span className="text-xs text-slate-400">até</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1 text-xs text-slate-800 dark:text-slate-200"
            />
          </div>
        )}
      </div>

      {/* KPI FINANCIAL CARDS BREAKDOWN */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Receita de Vendas</span>
          <p className="text-base sm:text-lg font-black text-slate-900 dark:text-white">{formatKz(periodStats.totalRevenue)}</p>
          <span className="text-[10px] text-slate-400">Preço combinado</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block">Total Recebido</span>
          <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">{formatKz(periodStats.totalReceived)}</p>
          <span className="text-[10px] text-slate-400">Confirmado em conta</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 block">Total Pendente</span>
          <p className="text-base sm:text-lg font-black text-amber-600 dark:text-amber-400">{formatKz(periodStats.totalPending)}</p>
          <span className="text-[10px] text-slate-400">A receber dos clientes</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 block">Custo dos Produtos</span>
          <p className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">{formatKz(periodStats.totalCost)}</p>
          <span className="text-[10px] text-slate-400">Comprado em Angola</span>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 block">Outros Custos</span>
          <p className="text-base sm:text-lg font-black text-slate-700 dark:text-slate-300">{formatKz(periodStats.totalDeliveryCost + periodStats.totalOtherCosts)}</p>
          <span className="text-[10px] text-slate-400">Entrega + Taxas</span>
        </div>

        <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white p-4 rounded-2xl border border-blue-700/60 shadow-md space-y-1">
          <span className="text-[11px] font-bold text-amber-300 block">Lucro Líquido</span>
          <p className="text-base sm:text-lg font-black text-amber-300">{formatKz(periodStats.netProfit)}</p>
          <span className="text-[10px] text-blue-200">Margem: {periodStats.averageMarginPercent.toFixed(1)}%</span>
        </div>
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'orders'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Lista de Encomendas ({finalFilteredOrders.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('whatsapp')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'whatsapp'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>Central WhatsApp</span>
        </button>

        <button
          onClick={() => setActiveSubTab('products')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'products'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Produtos & Vendas</span>
        </button>

        <button
          onClick={() => setActiveSubTab('clients')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'clients'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Clientes Registados</span>
        </button>

        <button
          onClick={() => setActiveSubTab('financials')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'financials'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Relatórios Financeiros</span>
        </button>

        <button
          onClick={() => setActiveSubTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'settings'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Configurações & Senha</span>
        </button>

        <button
          onClick={() => setActiveSubTab('future')}
          className={`px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shrink-0 ${
            activeSubTab === 'future'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Arquitetura Futura</span>
        </button>
      </div>

      {/* ORDERS LIST CONTENT */}
      {activeSubTab === 'orders' && (
        <div ref={ordersSectionRef} className="space-y-4">
          
          {/* Active Alert Filter Banner */}
          {activeAlertFilter !== 'NONE' && (
            <div className="bg-gradient-to-r from-amber-500/10 via-blue-500/10 to-transparent border border-amber-300 dark:border-amber-700/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
              <div className="flex items-start sm:items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-slate-950 shrink-0 mt-0.5 sm:mt-0">
                  <AlertCircle className="w-5 h-5 font-bold" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded">
                      Filtro de Alerta Ativo
                    </span>
                    <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {finalFilteredOrders.length} {finalFilteredOrders.length === 1 ? 'encomenda encontrada' : 'encomendas encontradas'}
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white mt-1">
                    {alertMeta[activeAlertFilter]?.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    {alertMeta[activeAlertFilter]?.description}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveAlertFilter('NONE')}
                className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 shadow-sm flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
                <span>Ver Todas as Encomendas</span>
              </button>
            </div>
          )}

          {/* Filters & Search Controls */}
          <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar por código, cliente ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Status Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="ALL">Todos os Estados</option>
                {STATUS_FLOW.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

          </div>

          {/* Orders Table Cards */}
          <div className="space-y-3">
            {finalFilteredOrders.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 text-center text-slate-500 space-y-2">
                <Package className="w-10 h-10 mx-auto text-slate-400" />
                <p className="font-semibold text-sm">Nenhuma encomenda encontrada com estes filtros.</p>
              </div>
            ) : (
              finalFilteredOrders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const isDelayed = checkIsOrderDelayed(order);

                return (
                  <div
                    key={order.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                      
                      {/* Left: Code + Client + Product + Badges */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {order.code}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${statusConfig.badgeBg}`}>
                            {statusConfig.label}
                          </span>

                          {/* Delayed Delivery Badge */}
                          {isDelayed && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Entrega Atrasada
                            </span>
                          )}

                          <span className="text-[11px] text-slate-400 font-mono">
                            {formatDatePT(order.createdAt)}
                          </span>

                          {/* Multi-Photo Count Badge */}
                          {(() => {
                            const imgs = (order.productImageUrls && order.productImageUrls.length > 0)
                              ? order.productImageUrls
                              : (order.productImageUrl ? [order.productImageUrl] : []);
                            if (imgs.length === 0) return null;
                            return (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                                <ImagesIcon className="w-3 h-3 text-blue-500" />
                                {imgs.length} {imgs.length === 1 ? 'foto' : 'fotos'}
                              </span>
                            );
                          })()}
                        </div>

                        <div className="flex items-center gap-2.5">
                          {(() => {
                            const coverImg = (order.productImageUrls && order.productImageUrls.length > 0)
                              ? order.productImageUrls[0]
                              : order.productImageUrl;
                            if (!coverImg) return null;
                            return (
                              <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 shadow-xs">
                                <img src={coverImg} alt={order.productName} className="w-full h-full object-cover" />
                              </div>
                            );
                          })()}
                          <div className="flex flex-wrap items-baseline gap-2">
                            <h3 className="font-bold text-base text-slate-900 dark:text-white">
                              {order.productName}
                            </h3>
                            <span className="text-xs text-slate-500">
                              para <strong className="text-slate-800 dark:text-slate-200">{order.clientName}</strong> ({order.clientProvince})
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Financial Summary */}
                      <div className="flex items-center gap-4 text-xs">
                        <div className="text-right">
                          <span className="text-slate-400 block text-[10px]">Preço Cliente</span>
                          <span className="font-extrabold text-slate-900 dark:text-white text-sm">
                            {formatKz(order.resalePrice)}
                          </span>
                        </div>

                        {/* INTERNAL FINANCIAL BADGE */}
                        <div className="text-right bg-blue-50 dark:bg-blue-950/50 p-2 rounded-xl border border-blue-200 dark:border-blue-800">
                          <span className="text-blue-700 dark:text-blue-400 block text-[10px] font-semibold flex items-center gap-1 justify-end">
                            <Lock className="w-3 h-3" /> Custo Local: {formatKz(order.purchaseCost)}
                          </span>
                          <span className="font-extrabold text-blue-800 dark:text-blue-300 text-sm">
                            Lucro Líquido: {formatKz(order.netProfit ?? (order.resalePrice - order.purchaseCost - (order.deliveryCost ?? 0) - (order.otherCosts ?? 0)))}
                          </span>
                        </div>
                      </div>

                    </div>

                    {/* Interactive 5-Stage Stepper for instant stage selection */}
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 sm:p-3 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                        <span>Estágio da Encomenda (Clique para alterar o estado diretamente):</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusConfig.badgeBg}`}>
                          {statusConfig.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                        {LINEAR_STATUS_FLOW.map((s, idx) => {
                          const isCurrent = order.status === s.key;
                          return (
                            <button
                              key={s.key}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onUpdateStatus) {
                                  onUpdateStatus(order.id || order.code, s.key);
                                }
                              }}
                              title={`Definir como: ${s.label}`}
                              className={`px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 text-center cursor-pointer ${
                                isCurrent
                                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400 scale-[1.02]'
                                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400 hover:bg-blue-50/40 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono shrink-0 ${
                                isCurrent ? 'bg-white/20 text-white' : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              }`}>
                                {idx + 1}
                              </span>
                              <span className="truncate">{s.label}</span>
                              {isCurrent && <Check className="w-3 h-3 shrink-0 ml-0.5" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bottom Row: Local Purchase detail + Action Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs">
                      
                      <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Comprado em: <strong className="text-slate-700 dark:text-slate-300">{order.purchaseLocation}</strong></span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendWhatsAppUpdate(order);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1 border border-blue-200 dark:border-blue-800 transition-colors text-xs cursor-pointer"
                          title="Enviar atualização ao cliente pelo WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </button>

                        {order.status !== 'ENTREGUE' && order.status !== 'CANCELADA' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenMarkAsDelivered(order);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 text-xs shadow-sm transition-all cursor-pointer"
                            title="Marcar encomenda como entregue"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Marcar Entregue</span>
                          </button>
                        )}

                        {order.status !== 'ENTREGUE' && order.status !== 'CANCELADA' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onAdvanceStatus(order.id || order.code);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold flex items-center gap-1 text-xs shadow-sm transition-all active:scale-95 cursor-pointer"
                            title="Avançar para o próximo passo"
                          >
                            <span>Avançar</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenClientReceipt(order);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 text-xs transition-colors cursor-pointer"
                          title="Gerar Comprovativo do Cliente (sem valores internos)"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                          <span>Comprovativo Cliente</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInternalReceipt(order);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium flex items-center gap-1 text-xs transition-colors cursor-pointer"
                          title="Gerar Comprovativo Interno (com custos e margens)"
                        >
                          <Lock className="w-3.5 h-3.5 text-rose-600" />
                          <span>Interno</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenQRCode(order);
                          }}
                          className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1 text-xs transition-colors cursor-pointer"
                          title="Gerar / Baixar QR Code de rastreio"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenShippingLabel(order);
                          }}
                          className="px-2 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center gap-1 text-xs transition-colors cursor-pointer"
                          title="Imprimir Etiqueta de Envio"
                        >
                          <Tag className="w-3.5 h-3.5 text-amber-600" />
                          <span>Etiqueta</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenOrderDetailsModal(order);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 font-bold flex items-center gap-1 text-xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Editar</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderToDelete(order);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-bold flex items-center gap-1 text-xs border border-rose-200 dark:border-rose-900/60 transition-all active:scale-95 cursor-pointer"
                          title="Eliminar esta encomenda permanentemente"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                          <span>Eliminar</span>
                        </button>
                      </div>

                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>
      )}

      {/* CONFIRM DELETE MODAL DIALOG */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-rose-300 dark:border-rose-800 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-900/50 text-rose-600 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirmar Eliminação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {orderToDelete.code}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Deseja mesmo eliminar a encomenda <strong>{orderToDelete.code}</strong> do cliente <strong>{orderToDelete.clientName}</strong> ({orderToDelete.productName})?
              <span className="block mt-2 font-semibold text-rose-600 dark:text-rose-400">
                Esta ação é irreversível e os dados desta encomenda serão apagados permanentemente.
              </span>
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteOrder) {
                    onDeleteOrder(orderToDelete.id);
                  }
                  setOrderToDelete(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Sim, Eliminar Encomenda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EXPORT MODAL */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        orders={orders}
        clients={clients}
      />

    </div>
  );
};
