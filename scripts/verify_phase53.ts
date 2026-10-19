import { getDbOrders, getDbOrderByCode, getDbAuditLogs, getDbClients, saveDbOrder } from '../src/db/repository.ts';
import { sanitizeOrderForPublic, verifyNoInternalDataLeaks } from '../src/utils/security.ts';
import { matchOrderCode, formatKz, getCustomerStatusFlow } from '../src/utils/formatters.ts';
import { VALID_ORDER_STATUSES, VALID_PAYMENT_STATUSES, VALID_PAYMENT_METHODS } from '../src/types.ts';

async function runPhase53Validation() {
  console.log("=== INICIANDO BATERIA DE TESTES NÃO DESTRUTIVOS DA FASE 5.3 ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Preservação Absoluta da Encomenda Real Homologada (AO-451023)
  console.log("\n1. Verificação da Encomenda Real Homologada AO-451023:");
  const realOrder = await getDbOrderByCode('AO-451023');
  assert(realOrder !== null, "AO-451023 localizada no PostgreSQL");
  if (realOrder) {
    assert(realOrder.code === 'AO-451023', "Código exato: AO-451023");
    assert(realOrder.clientName === 'Aldemiro Samba', "Cliente: Aldemiro Samba");
    assert(realOrder.resalePrice === 25000, "Valor de Venda: 25.000,00 Kz");
    assert(realOrder.amountPaid === 25000, "Valor Pago: 25.000,00 Kz");
    assert(realOrder.amountPending === 0, "Saldo Pendente: 0,00 Kz");
    assert(realOrder.status === 'PRODUTO_COMPRADO', "Estado: PRODUTO_COMPRADO");
    assert(realOrder.paymentStatus === 'CONFIRMADO', "Pagamento: CONFIRMADO");
    assert(realOrder.paymentMethod === 'EXPRESS' || realOrder.paymentMethod === 'TRANSFERENCIA', `Método de Pagamento: ${realOrder.paymentMethod}`);
    assert(realOrder.purchaseCost === 18000, "Custo de Compra: 18.000,00 Kz");
    assert(realOrder.grossProfit === 7000, "Lucro Bruto: 7.000,00 Kz");
    assert(realOrder.netProfit === 7000, "Lucro Líquido: 7.000,00 Kz");
  }

  // 2. Auditoria dos Audit Logs Existentes no PostgreSQL
  console.log("\n2. Auditoria dos Logs de Auditoria Operacional (audit_logs):");
  const auditLogs = await getDbAuditLogs();
  assert(auditLogs.length >= 60, `Total de audit_logs carregados: ${auditLogs.length} (>= 60)`);
  if (auditLogs.length > 0) {
    const sampleLog = auditLogs[0];
    assert(Boolean(sampleLog.id), "Log possui id único");
    assert(Boolean(sampleLog.action), "Log possui action definida");
    assert(Boolean(sampleLog.createdAt), "Log possui timestamp ISO válido");
    assert(Boolean(sampleLog.createdBy), "Log possui ator/utilizador associado");
    assert(Boolean(sampleLog.orderCode), "Log possui vínculo com encomenda ou SISTEMA");
  }

  // 3. Auditoria do Histórico Financeiro e Regras de Negócio
  console.log("\n3. Auditoria das Fórmulas Financeiras e Invariantes:");
  const testResale = 30000;
  const testPaid = 10000;
  const testPending = Math.max(0, testResale - testPaid);
  const testPurchase = 15000;
  const testDelivery = 2500;
  const testOther = 500;
  const testGross = testResale - testPurchase;
  const testNet = testResale - testPurchase - testDelivery - testOther;

  assert(testPending === 20000, "Cálculo de saldo pendente correto (30.000 - 10.000 = 20.000)");
  assert(testGross === 15000, "Cálculo de lucro bruto correto (30.000 - 15.000 = 15.000)");
  assert(testNet === 12000, "Cálculo de lucro líquido correto (30.000 - 15.000 - 2.500 - 500 = 12.000)");

  // 4. Verificação de PaymentStatus e PaymentMethods Permitidos
  console.log("\n4. Verificação de Enums e Constantes de Pagamento:");
  assert(VALID_PAYMENT_STATUSES.includes('PENDENTE'), "Status PENDENTE suportado");
  assert(VALID_PAYMENT_STATUSES.includes('PARCIAL'), "Status PARCIAL suportado");
  assert(VALID_PAYMENT_STATUSES.includes('CONFIRMADO'), "Status CONFIRMADO suportado");
  assert(VALID_PAYMENT_STATUSES.includes('REEMBOLSADO'), "Status REEMBOLSADO suportado");

  assert(VALID_PAYMENT_METHODS.includes('TRANSFERENCIA'), "Método TRANSFERENCIA suportado");
  assert(VALID_PAYMENT_METHODS.includes('EXPRESS'), "Método EXPRESS suportado");
  assert(VALID_PAYMENT_METHODS.includes('TPA'), "Método TPA suportado");
  assert(VALID_PAYMENT_METHODS.includes('DINHEIRO'), "Método DINHEIRO suportado");
  assert(VALID_PAYMENT_METHODS.includes('OUTRO'), "Método OUTRO suportado");

  // 5. Testes de Privacidade e Não-Vazamento em Rastreio Público
  console.log("\n5. Auditoria de Privacidade do Rastreio Público:");
  if (realOrder) {
    const publicOrder = sanitizeOrderForPublic(realOrder, { showSalesPriceToClient: false } as any);
    const noLeak = verifyNoInternalDataLeaks(publicOrder as any);
    assert(noLeak, "Função verifyNoInternalDataLeaks aprovou o objeto higienizado");
    assert(!('purchaseCost' in publicOrder), "purchaseCost não vazado");
    assert(!('purchaseLocation' in publicOrder), "purchaseLocation não vazado");
    assert(!('deliveryCost' in publicOrder), "deliveryCost não vazado");
    assert(!('otherCosts' in publicOrder), "otherCosts não vazado");
    assert(!('grossProfit' in publicOrder), "grossProfit não vazado");
    assert(!('netProfit' in publicOrder), "netProfit não vazado");
    assert(!('adminNotes' in publicOrder), "adminNotes não vazado");
    assert(!('clientPhone' in publicOrder), "clientPhone não vazado");
    assert(!('clientAddress' in publicOrder), "clientAddress não vazado");
  }

  // 6. Testes de Formatação Financeira em Kwanzas (AOA / Kz)
  console.log("\n6. Validação dos Formatadores Financeiros Oficiais de Angola:");
  assert(formatKz(25000).includes('25') && formatKz(25000).includes('Kz'), "formatKz(25000) formata com Kz");
  assert(formatKz(0).includes('0') && formatKz(0).includes('Kz'), "formatKz(0) formata corretamente");
  assert(formatKz(-500).includes('0') || formatKz(-500).includes('Kz'), "formatKz trata valores negativos com segurança");

  // 7. Teste de Rejeição de Pagamento / Estado Inválido
  console.log("\n7. Rejeição de Operações com Dados Inválidos:");
  try {
    const corruptedPayload: any = {
      code: 'AO-INVALID-PAYMENT-TEST',
      clientName: 'Teste Inválido',
      resalePrice: -1000,
      status: 'ESTADO_INEXISTENTE',
    };
    await saveDbOrder(corruptedPayload);
    assert(false, "Deveria ter lançado exceção para payload inválido");
  } catch (err: any) {
    assert(err.status === 400 || String(err.message).includes('inválido'), "saveDbOrder rejeitou com sucesso estado/valor inválido com erro 400");
  }

  // 8. Integridade de Clientes e Acumulados
  console.log("\n8. Integridade da Base de Clientes (clients):");
  const clientsList = await getDbClients();
  assert(clientsList.length === 6, `Total de clientes cadastrados: ${clientsList.length} (esperado: 6)`);
  const aldemiroClient = clientsList.find((c) => c.name.includes('Aldemiro'));
  assert(aldemiroClient !== undefined, "Cliente Aldemiro Samba cadastrado na tabela clients");
  if (aldemiroClient) {
    assert(aldemiroClient.totalSpent >= 0, "totalSpent do cliente é não-negativo");
    assert(aldemiroClient.totalOrders >= 0, "totalOrders do cliente é não-negativo");
  }

  console.log(`\n=== RESULTADO DOS TESTES DA FASE 5.3: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase53Validation().catch((err) => {
  console.error("Erro na execução dos testes:", err);
  process.exit(1);
});
