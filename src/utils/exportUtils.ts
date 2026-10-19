import { Order, Client, ProductSummaryItem } from '../types';
import { formatKz, formatDatePT, getPaymentMethodLabel } from './formatters';

/**
 * Downloads CSV content as a file with UTF-8 BOM so Excel opens PT-AO special characters natively.
 */
function downloadCSV(filename: string, csvContent: string) {
  // UTF-8 BOM byte sequence
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Export Encomendas
 */
export function exportOrdersCSV(orders: Order[]) {
  const headers = [
    'Código',
    'Data Registro',
    'Cliente',
    'Telefone',
    'Província',
    'Município',
    'Endereço',
    'Produto',
    'Quantidade',
    'Preço Venda (Kz)',
    'Valor Pago (Kz)',
    'Valor Pendente (Kz)',
    'Status Pagamento',
    'Método Pagamento',
    'Estado Encomenda',
    'Data Previsão Entrega',
    'Custo Compra Local (Kz)',
    'Local Compra Angola',
    'Custo Entrega (Kz)',
    'Outros Custos (Kz)',
    'Lucro Bruto (Kz)',
    'Lucro Líquido (Kz)',
    'Observações Internas'
  ];

  const rows = orders.map((o) => [
    `"${o.code}"`,
    `"${formatDatePT(o.createdAt)}"`,
    `"${o.clientName.replace(/"/g, '""')}"`,
    `"${o.clientPhone}"`,
    `"${o.clientProvince}"`,
    `"${o.clientDistrict || ''}"`,
    `"${o.clientAddress.replace(/"/g, '""')}"`,
    `"${o.productName.replace(/"/g, '""')}"`,
    o.quantity || 1,
    o.resalePrice,
    o.amountPaid,
    o.amountPending ?? Math.max(0, o.resalePrice - o.amountPaid),
    `"${o.paymentStatus}"`,
    `"${getPaymentMethodLabel(o.paymentMethod)}"`,
    `"${o.status}"`,
    `"${o.estimatedDeliveryDate}"`,
    o.purchaseCost,
    `"${(o.purchaseLocation || '').replace(/"/g, '""')}"`,
    o.deliveryCost ?? 0,
    o.otherCosts ?? 0,
    o.grossProfit ?? (o.resalePrice - o.purchaseCost),
    o.netProfit ?? (o.resalePrice - o.purchaseCost - (o.deliveryCost ?? 0) - (o.otherCosts ?? 0)),
    `"${(o.adminNotes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(`delfilandia_encomendas_${dateStr}.csv`, csvContent);
}

/**
 * Export Clientes
 */
export function exportClientsCSV(clients: Client[]) {
  const headers = [
    'ID',
    'Nome Cliente',
    'Telefone',
    'Província',
    'Município',
    'Endereço',
    'Total Encomendas',
    'Total Comprado (Kz)',
    'Data Cadastro'
  ];

  const rows = clients.map((c) => [
    `"${c.id}"`,
    `"${c.name.replace(/"/g, '""')}"`,
    `"${c.phone}"`,
    `"${c.province}"`,
    `"${c.district || ''}"`,
    `"${c.address.replace(/"/g, '""')}"`,
    c.totalOrders,
    c.totalSpent,
    `"${formatDatePT(c.createdAt)}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(`delfilandia_clientes_${dateStr}.csv`, csvContent);
}

/**
 * Export Relatório de Produtos Vendidos
 */
export function exportProductsCSV(products: ProductSummaryItem[]) {
  const headers = [
    'Produto',
    'Total Vendas (Unidades)',
    'Receita Total (Kz)',
    'Lucro Estimado (Kz)',
    'Preço Médio (Kz)',
    'Última Venda'
  ];

  const rows = products.map((p) => [
    `"${p.productName.replace(/"/g, '""')}"`,
    p.totalSalesCount,
    p.totalRevenue,
    p.totalEstimatedProfit,
    Math.round(p.averagePrice),
    `"${formatDatePT(p.lastSaleDate)}"`
  ]);

  const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(`delfilandia_produtos_${dateStr}.csv`, csvContent);
}

/**
 * Export Relatório Financeiro
 */
export function exportFinancialsCSV(orders: Order[]) {
  let totalRevenue = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let totalCost = 0;
  let totalDelivery = 0;
  let totalOther = 0;
  let totalNetProfit = 0;

  orders.forEach((o) => {
    totalRevenue += o.resalePrice;
    totalPaid += o.amountPaid;
    totalPending += o.amountPending ?? Math.max(0, o.resalePrice - o.amountPaid);
    totalCost += o.purchaseCost;
    totalDelivery += o.deliveryCost ?? 0;
    totalOther += o.otherCosts ?? 0;
    totalNetProfit += o.netProfit ?? (o.resalePrice - o.purchaseCost - (o.deliveryCost ?? 0) - (o.otherCosts ?? 0));
  });

  const margin = totalRevenue > 0 ? (totalNetProfit / totalRevenue) * 100 : 0;

  const lines = [
    'RELATÓRIO FINANCEIRO - DELFILÂNDIA',
    `Data do Relatório;${formatDatePT(new Date().toISOString())}`,
    `Total de Encomendas;${orders.length}`,
    '',
    'MÉTRICA;VALOR (KZ);PERCENTUAL',
    `Receita Bruta de Vendas;${totalRevenue};100%`,
    `Total Recebido de Clientes;${totalPaid};${totalRevenue > 0 ? ((totalPaid / totalRevenue) * 100).toFixed(1) : 0}%`,
    `Total Pendente a Receber;${totalPending};${totalRevenue > 0 ? ((totalPending / totalRevenue) * 100).toFixed(1) : 0}%`,
    `Custo dos Produtos Adquiridos;${totalCost};${totalRevenue > 0 ? ((totalCost / totalRevenue) * 100).toFixed(1) : 0}%`,
    `Custo de Entregas e Transportes;${totalDelivery};${totalRevenue > 0 ? ((totalDelivery / totalRevenue) * 100).toFixed(1) : 0}%`,
    `Outros Custos Operacionais;${totalOther};${totalRevenue > 0 ? ((totalOther / totalRevenue) * 100).toFixed(1) : 0}%`,
    `Lucro Bruto;${totalRevenue - totalCost};${totalRevenue > 0 ? (((totalRevenue - totalCost) / totalRevenue) * 100).toFixed(1) : 0}%`,
    `Lucro Líquido Real;${totalNetProfit};${margin.toFixed(1)}%`,
    `Margem Líquida %;${margin.toFixed(2)}%`
  ];

  const dateStr = new Date().toISOString().slice(0, 10);
  downloadCSV(`delfilandia_relatorio_financeiro_${dateStr}.csv`, lines.join('\n'));
}
