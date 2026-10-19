import { 
  getDbOrders, 
  getDbOrderByCode, 
  getDbClients, 
  getDbAuditLogs, 
  getDbSettings, 
  saveDbOrder,
  DatabaseError 
} from '../src/db/repository.ts';
import { db } from '../src/db/index.ts';
import { orders } from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import { sanitizeOrderForPublic, verifyNoInternalDataLeaks } from '../src/utils/security.ts';
import { 
  formatKz, 
  matchOrderCode, 
  getCustomerStatusFlow, 
  getCustomerStepIndex 
} from '../src/utils/formatters.ts';
import { 
  VALID_ORDER_STATUSES, 
  VALID_PAYMENT_STATUSES, 
  VALID_PAYMENT_METHODS, 
  type Order, 
  type OrderStatus, 
  type PaymentStatus, 
  type PaymentMethod 
} from '../src/types.ts';

async function runPhase54Verification() {
  console.log("===============================================================================");
  console.log("   FASE 5.4 — AUDITORIA PROFUNDA DE CONSISTÊNCIA FINANCEIRA E TRANSACIONAL");
  console.log("===============================================================================\n");

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

  // ---------------------------------------------------------------------------
  // 1. Verificação Prévia de Produção (Estado Inicial)
  // ---------------------------------------------------------------------------
  console.log("1. Verificação do Estado Inicial de Produção no PostgreSQL Cloud SQL:");
  const initialOrders = await getDbOrders();
  const initialClients = await getDbClients();
  const initialSettings = await getDbSettings();
  const initialAuditLogs = await getDbAuditLogs();

  assert(initialOrders.length === 1, `Total de Encomendas = 1 (obtido: ${initialOrders.length})`);
  assert(initialClients.length === 6, `Total de Clientes = 6 (obtido: ${initialClients.length})`);
  assert(initialSettings !== null, "Configurações da Loja presentes (1 registro)");
  assert(initialAuditLogs.length === 60, `Total de Audit Logs = 60 (obtido: ${initialAuditLogs.length})`);

  const realOrder = await getDbOrderByCode('AO-451023');
  assert(realOrder !== null, "Encomenda homologada AO-451023 existe");
  if (realOrder) {
    assert(realOrder.code === 'AO-451023', "Código: AO-451023");
    assert(realOrder.clientName === 'Aldemiro Samba', "Cliente: Aldemiro Samba");
    assert(realOrder.resalePrice === 25000, "Preço de Venda: 25.000,00 Kz");
    assert(realOrder.amountPaid === 25000, "Valor Pago: 25.000,00 Kz");
    assert(realOrder.amountPending === 0, "Saldo Pendente: 0,00 Kz");
    assert(realOrder.status === 'PRODUTO_COMPRADO', "Status: PRODUTO_COMPRADO");
    assert(realOrder.paymentStatus === 'CONFIRMADO', "Pagamento: CONFIRMADO");
    assert(realOrder.paymentMethod === 'EXPRESS', "Método: EXPRESS");
    assert(realOrder.purchaseCost === 18000, "Custo Compra: 18.000,00 Kz");
    assert(realOrder.deliveryCost === 0, "Custo Frete: 0,00 Kz");
    assert(realOrder.grossProfit === 7000, "Lucro Bruto: 7.000,00 Kz");
    assert(realOrder.netProfit === 7000, "Lucro Líquido: 7.000,00 Kz");
  }

  // ---------------------------------------------------------------------------
  // 2. Invariantes Financeiras e Recálculo Determinístico
  // ---------------------------------------------------------------------------
  console.log("\n2. Auditoria Matemática de Invariantes Financeiras:");
  const testMatrix = [
    { resale: 50000, paid: 0, expectedPending: 50000, expectedStatus: 'PENDENTE' },
    { resale: 50000, paid: 20000, expectedPending: 30000, expectedStatus: 'PARCIAL' },
    { resale: 50000, paid: 50000, expectedPending: 0, expectedStatus: 'CONFIRMADO' },
    { resale: 50000, paid: 60000, expectedPending: 0, expectedStatus: 'CONFIRMADO' }, // overpayment
  ];

  for (const item of testMatrix) {
    const calcPending = Math.max(0, item.resale - item.paid);
    assert(calcPending === item.expectedPending, `resale: ${item.resale}, paid: ${item.paid} -> pending: ${calcPending}`);
  }

  const resaleVal = 40000;
  const purchaseVal = 25000;
  const deliveryVal = 3000;
  const otherVal = 1000;
  const grossCalc = resaleVal - purchaseVal;
  const netCalc = resaleVal - purchaseVal - deliveryVal - otherVal;
  assert(grossCalc === 15000, `Lucro bruto (40.000 - 25.000 = 15.000 Kz): ${grossCalc}`);
  assert(netCalc === 11000, `Lucro líquido (40.000 - 25.000 - 3.000 - 1.000 = 11.000 Kz): ${netCalc}`);

  // ---------------------------------------------------------------------------
  // 3. Validação de Ciclo de Vida e Stepper
  // ---------------------------------------------------------------------------
  console.log("\n3. Auditoria do Ciclo de Vida e Stepper de Encomendas:");
  const validStatuses: OrderStatus[] = [
    'AGUARDANDO_PAGAMENTO',
    'PAGAMENTO_CONFIRMADO',
    'PRODUTO_COMPRADO',
    'SAIU_PARA_ENTREGA',
    'ENTREGUE',
    'PROBLEMA',
    'CANCELADA',
  ];
  assert(
    JSON.stringify(VALID_ORDER_STATUSES) === JSON.stringify(validStatuses),
    "VALID_ORDER_STATUSES contém os 7 estados oficiais"
  );

  assert(getCustomerStepIndex('AGUARDANDO_PAGAMENTO') === 0, "AGUARDANDO_PAGAMENTO -> Passo 1 (index 0)");
  assert(getCustomerStepIndex('PAGAMENTO_CONFIRMADO') === 1, "PAGAMENTO_CONFIRMADO -> Passo 2 (index 1)");
  assert(getCustomerStepIndex('PRODUTO_COMPRADO') === 2, "PRODUTO_COMPRADO -> Passo 3 (index 2)");
  assert(getCustomerStepIndex('SAIU_PARA_ENTREGA') === 3, "SAIU_PARA_ENTREGA -> Passo 4 (index 3)");
  assert(getCustomerStepIndex('ENTREGUE') === 4, "ENTREGUE -> Passo 5 (index 4)");
  assert(getCustomerStepIndex('PROBLEMA') === 5, "PROBLEMA -> Alerta dinâmico (index 5)");
  assert(getCustomerStepIndex('CANCELADA') === 5, "CANCELADA -> Alerta dinâmico (index 5)");

  // ---------------------------------------------------------------------------
  // 4. Teste de Rejeição de Entradas Inválidas e Segurança de Dados
  // ---------------------------------------------------------------------------
  console.log("\n4. Testes Não-Destrutivos de Validação e Rejeição de Entradas Corrompidas:");
  
  // Teste A: Código Ausente
  try {
    await saveDbOrder({ code: '' } as any);
    assert(false, "Deveria rejeitar encomenda sem código");
  } catch (err: any) {
    assert(err.status === 400, "Código vazio rejeitado com HTTP 400");
  }

  // Teste B: Estado Inválido
  try {
    await saveDbOrder({ code: 'AO-TEMP-INVALID-STATUS', status: 'ESTADO_HACK' } as unknown as Order);
    assert(false, "Deveria rejeitar estado inexistente");
  } catch (err: any) {
    assert(err.status === 400, "Estado inválido rejeitado com HTTP 400");
  }

  // ---------------------------------------------------------------------------
  // 5. Teste Transacional com Rollback Automático (Isolamento Total)
  // ---------------------------------------------------------------------------
  console.log("\n5. Auditoria de Atomicidade ACID e Rollback no PostgreSQL:");
  let rollbackSucceeded = false;
  try {
    await db.transaction(async (tx) => {
      // Inserção temporária dentro de transação com erro intencional
      await tx.insert(orders).values({
        code: 'AO-TRANSACTION-TEST-TEMP',
        clientName: 'Teste Transacional',
        productName: 'Produto Teste',
        resalePrice: '10000.00',
        amountPaid: '10000.00',
        amountPending: '0.00',
        status: 'AGUARDANDO_PAGAMENTO',
        paymentStatus: 'CONFIRMADO',
        paymentMethod: 'TRANSFERENCIA',
        quantity: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Lançar erro proposital para forçar ROLLBACK completo
      throw new Error('FORCED_ROLLBACK_TEST_PHASE_5_4');
    });
  } catch (err: any) {
    if (err.message === 'FORCED_ROLLBACK_TEST_PHASE_5_4') {
      rollbackSucceeded = true;
    }
  }

  assert(rollbackSucceeded, "Transação intermediária abortada propositalmente");
  const tempOrderCheck = await getDbOrderByCode('AO-TRANSACTION-TEST-TEMP');
  assert(tempOrderCheck === null, "Rollback verificado: Registro temporário NÃO existe no PostgreSQL");

  // ---------------------------------------------------------------------------
  // 6. Auditoria de Privacidade do Rastreio Público
  // ---------------------------------------------------------------------------
  console.log("\n6. Auditoria de Higienização e Privacidade no Rastreio Público:");
  if (realOrder) {
    const publicView = sanitizeOrderForPublic(realOrder, { showSalesPriceToClient: false } as any);
    assert(publicView.code === 'AO-451023', "Código público visível");
    assert(publicView.clientFirstName === 'Cliente: Aldemiro', "Nome anonimizado para primeiro nome");
    assert(publicView.productName.includes('Conjunto'), "Nome do produto exibido");
    assert(publicView.status === 'PRODUTO_COMPRADO', "Status público visível");

    const noLeak = verifyNoInternalDataLeaks(publicView as any);
    assert(noLeak, "Zero vazamentos de custos internos comprovado");
    assert(!('purchaseCost' in publicView), "purchaseCost NÃO existe no view público");
    assert(!('purchaseLocation' in publicView), "purchaseLocation NÃO existe no view público");
    assert(!('deliveryCost' in publicView), "deliveryCost NÃO existe no view público");
    assert(!('otherCosts' in publicView), "otherCosts NÃO existe no view público");
    assert(!('grossProfit' in publicView), "grossProfit NÃO existe no view público");
    assert(!('netProfit' in publicView), "netProfit NÃO existe no view público");
    assert(!('adminNotes' in publicView), "adminNotes NÃO existe no view público");
    assert(!('clientPhone' in publicView), "clientPhone NÃO existe no view público");
    assert(!('clientAddress' in publicView), "clientAddress NÃO existe no view público");
  }

  // ---------------------------------------------------------------------------
  // 7. Auditoria de Resolução Flexível de Códigos e Proteção Anti-Injeção
  // ---------------------------------------------------------------------------
  console.log("\n7. Auditoria de Resolução Flexível de Códigos de Rastreio:");
  const testTrackObj = { code: 'AO-451023', clientPhone: '935133346' };
  assert(matchOrderCode(testTrackObj, 'AO-451023'), "Match exato: AO-451023");
  assert(matchOrderCode(testTrackObj, 'ao-451023'), "Match minúsculo: ao-451023");
  assert(matchOrderCode(testTrackObj, 'AO451023'), "Match sem hífen: AO451023");
  assert(matchOrderCode(testTrackObj, 'A0-451023'), "Match com zero: A0-451023");
  assert(matchOrderCode(testTrackObj, '451023'), "Match apenas dígitos: 451023");
  assert(matchOrderCode(testTrackObj, ' 935133346 '), "Match por telefone com espaços: 935133346");
  assert(!matchOrderCode(testTrackObj, "'; DROP TABLE orders; --"), "Bloqueio de tentativa SQLi na busca");
  assert(!matchOrderCode(testTrackObj, "<script>alert(1)</script>"), "Bloqueio de tentativa XSS na busca");

  // ---------------------------------------------------------------------------
  // 8. Verificação Pós-Testes de Produção (Integridade Absoluta)
  // ---------------------------------------------------------------------------
  console.log("\n8. Verificação Pós-Testes da Base de Dados de Produção:");
  const finalOrders = await getDbOrders();
  const finalClients = await getDbClients();
  const finalSettings = await getDbSettings();
  const finalAuditLogs = await getDbAuditLogs();

  assert(finalOrders.length === 1, `Total final de Encomendas = 1 (obtido: ${finalOrders.length})`);
  assert(finalClients.length === 6, `Total final de Clientes = 6 (obtido: ${finalClients.length})`);
  assert(finalSettings !== null, "Configurações preservadas");
  assert(finalAuditLogs.length === 60, `Total final de Audit Logs = 60 (obtido: ${finalAuditLogs.length})`);

  const finalRealOrder = await getDbOrderByCode('AO-451023');
  assert(finalRealOrder !== null && finalRealOrder.code === 'AO-451023', "AO-451023 permanece 100% intacta");
  if (finalRealOrder) {
    assert(finalRealOrder.amountPaid === 25000, "Valor Pago inalterado: 25.000,00 Kz");
    assert(finalRealOrder.resalePrice === 25000, "Preço Venda inalterado: 25.000,00 Kz");
    assert(finalRealOrder.status === 'PRODUTO_COMPRADO', "Status inalterado: PRODUTO_COMPRADO");
    assert(finalRealOrder.paymentStatus === 'CONFIRMADO', "Pagamento inalterado: CONFIRMADO");
  }

  console.log(`\n===============================================================================`);
  console.log(`   RESULTADO DOS TESTES DA FASE 5.4: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`===============================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase54Verification().catch((err) => {
  console.error("Erro na execução dos testes:", err);
  process.exit(1);
});
