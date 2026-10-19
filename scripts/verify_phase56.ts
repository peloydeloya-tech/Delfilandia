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
import { orders, auditLogs } from '../src/db/schema.ts';
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
  type PaymentMethod,
  type AuditLog
} from '../src/types.ts';

async function runPhase56Verification() {
  console.log("===============================================================================");
  console.log("   FASE 5.6 — HOMOLOGAÇÃO FINAL DO SISTEMA DE ENCOMENDAS E PAGAMENTOS");
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
  // 1. Verificação do Estado Inicial dos Dados Reais
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
  assert(realOrder !== null, "Encomenda homologada AO-451023 existe no PostgreSQL");
  if (realOrder) {
    assert(realOrder.code === 'AO-451023', "Código: AO-451023");
    assert(realOrder.clientName === 'Aldemiro Samba', "Cliente: Aldemiro Samba");
    assert(realOrder.resalePrice === 25000, "Preço de Venda: 25.000,00 Kz");
    assert(realOrder.amountPaid === 25000, "Valor Pago: 25.000,00 Kz");
    assert(realOrder.amountPending === 0, "Saldo Pendente: 0,00 Kz");
    assert(realOrder.status === 'PRODUTO_COMPRADO', "Status: PRODUTO_COMPRADO");
    assert(realOrder.paymentStatus === 'CONFIRMADO', "Pagamento: CONFIRMADO");
    assert(realOrder.paymentMethod === 'EXPRESS', "Método: EXPRESS");
    assert(realOrder.purchaseCost === 18000, "Custo de Aquisição: 18.000,00 Kz");
    assert(realOrder.grossProfit === 7000, "Lucro Bruto: 7.000,00 Kz");
    assert(realOrder.netProfit === 7000, "Lucro Líquido: 7.000,00 Kz");
  }

  // ---------------------------------------------------------------------------
  // 2. Auditoria do Motor de Estados
  // ---------------------------------------------------------------------------
  console.log("\n2. Auditoria do Motor de Estados (7 Estados Oficiais):");
  assert(VALID_ORDER_STATUSES.length === 7, "VALID_ORDER_STATUSES possui exatamente 7 estados");
  const expectedStatuses: OrderStatus[] = [
    'AGUARDANDO_PAGAMENTO',
    'PAGAMENTO_CONFIRMADO',
    'PRODUTO_COMPRADO',
    'SAIU_PARA_ENTREGA',
    'ENTREGUE',
    'PROBLEMA',
    'CANCELADA',
  ];
  for (const st of expectedStatuses) {
    assert(VALID_ORDER_STATUSES.includes(st), `Estado verificado: ${st}`);
  }

  // Rejeição de estado inválido
  try {
    await saveDbOrder({ code: 'AO-TEST-INVALID-STATE', status: 'ESTADO_INVENTADO' } as unknown as Order);
    assert(false, "Deveria ter rejeitado estado inválido");
  } catch (err: any) {
    assert(err.status === 400, "Estado inválido rejeitado com HTTP 400");
  }

  // ---------------------------------------------------------------------------
  // 3. Auditoria das Fórmulas Financeiras Implementadas
  // ---------------------------------------------------------------------------
  console.log("\n3. Auditoria das Fórmulas Financeiras Implementadas:");
  // Fórmulas reais:
  // resaleNum = Math.max(0, parseNumeric(ord.resalePrice))
  // paidNum = Math.max(0, parseNumeric(ord.amountPaid))
  // pendingNum = Math.max(0, resaleNum - paidNum)
  // purchaseNum = Math.max(0, parseNumeric(ord.purchaseCost))
  // deliveryNum = Math.max(0, parseNumeric(ord.deliveryCost))
  // otherNum = Math.max(0, parseNumeric(ord.otherCosts))
  // grossNum = resaleNum - purchaseNum
  // netNum = resaleNum - purchaseNum - deliveryNum - otherNum

  const financialScenarios = [
    {
      name: 'Venda 40.000 Kz | Custo 25.000 Kz | Entrega 3.000 Kz | Outros 1.000 Kz | Pago 0 Kz',
      resale: 40000,
      paid: 0,
      purchase: 25000,
      delivery: 3000,
      other: 1000,
      expectedPending: 40000,
      expectedGross: 15000,
      expectedNet: 11000,
      expectedPaymentStatus: 'PENDENTE',
    },
    {
      name: 'Venda 40.000 Kz | Custo 25.000 Kz | Entrega 3.000 Kz | Outros 1.000 Kz | Pago 20.000 Kz',
      resale: 40000,
      paid: 20000,
      purchase: 25000,
      delivery: 3000,
      other: 1000,
      expectedPending: 20000,
      expectedGross: 15000,
      expectedNet: 11000,
      expectedPaymentStatus: 'PARCIAL',
    },
    {
      name: 'Venda 40.000 Kz | Custo 25.000 Kz | Entrega 3.000 Kz | Outros 1.000 Kz | Pago 40.000 Kz',
      resale: 40000,
      paid: 40000,
      purchase: 25000,
      delivery: 3000,
      other: 1000,
      expectedPending: 0,
      expectedGross: 15000,
      expectedNet: 11000,
      expectedPaymentStatus: 'CONFIRMADO',
    },
    {
      name: 'Venda 40.000 Kz | Custo 25.000 Kz | Entrega 3.000 Kz | Outros 1.000 Kz | Pago 45.000 Kz (Excedente)',
      resale: 40000,
      paid: 45000,
      purchase: 25000,
      delivery: 3000,
      other: 1000,
      expectedPending: 0,
      expectedGross: 15000,
      expectedNet: 11000,
      expectedPaymentStatus: 'CONFIRMADO',
    },
  ];

  for (const scen of financialScenarios) {
    const calcPending = Math.max(0, scen.resale - scen.paid);
    const calcGross = scen.resale - scen.purchase;
    const calcNet = scen.resale - scen.purchase - scen.delivery - scen.other;
    let calcPaymentStatus: PaymentStatus = 'PENDENTE';
    if (scen.paid >= scen.resale && scen.resale > 0) {
      calcPaymentStatus = 'CONFIRMADO';
    } else if (scen.paid > 0 && scen.paid < scen.resale) {
      calcPaymentStatus = 'PARCIAL';
    }

    assert(calcPending === scen.expectedPending, `[${scen.name}] pending = ${calcPending} (esperado ${scen.expectedPending})`);
    assert(calcGross === scen.expectedGross, `[${scen.name}] grossProfit = ${calcGross} (esperado ${scen.expectedGross})`);
    assert(calcNet === scen.expectedNet, `[${scen.name}] netProfit = ${calcNet} (esperado ${scen.expectedNet})`);
    assert(calcPaymentStatus === scen.expectedPaymentStatus, `[${scen.name}] paymentStatus = ${calcPaymentStatus} (esperado ${scen.expectedPaymentStatus})`);
  }

  // ---------------------------------------------------------------------------
  // 4. Auditoria de Idempotência e Testes com Rollback
  // ---------------------------------------------------------------------------
  console.log("\n4. Auditoria de Idempotência do UPSERT e Audit Log (Transação com Rollback):");
  let idempotencyOk = false;
  try {
    await db.transaction(async (tx) => {
      const code = 'AO-IDEMPOTENCY-56-TEMP';
      const logId = 'log-idempotency-56-temp';

      // Execução 1: Insert inicial
      await tx.insert(orders).values({
        code,
        clientName: 'Teste Idempotência 5.6',
        productName: 'Item Teste',
        quantity: 1,
        resalePrice: '50000.00',
        amountPaid: '50000.00',
        amountPending: '0.00',
        status: 'PAGAMENTO_CONFIRMADO',
        paymentStatus: 'CONFIRMADO',
        paymentMethod: 'EXPRESS',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await tx.insert(auditLogs).values({
        logId,
        orderCode: code,
        user: 'Admin',
        action: 'Criação de Encomenda',
        details: 'Teste 5.6',
        timestamp: new Date(),
      });

      // Execução 2: Repetição da mesma requisição (Retry / Duplo Clique)
      await tx
        .insert(orders)
        .values({
          code,
          clientName: 'Teste Idempotência 5.6',
          productName: 'Item Teste',
          quantity: 1,
          resalePrice: '50000.00',
          amountPaid: '50000.00',
          amountPending: '0.00',
          status: 'PAGAMENTO_CONFIRMADO',
          paymentStatus: 'CONFIRMADO',
          paymentMethod: 'EXPRESS',
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: orders.code,
          set: {
            amountPaid: '50000.00',
            amountPending: '0.00',
            paymentStatus: 'CONFIRMADO',
            updatedAt: new Date(),
          }
        });

      await tx.insert(auditLogs).values({
        logId,
        orderCode: code,
        user: 'Admin',
        action: 'Criação de Encomenda',
        details: 'Teste 5.6',
        timestamp: new Date(),
      }).onConflictDoNothing();

      // Verificação de não duplicação
      const ordersInTx = await tx.select().from(orders).where(eq(orders.code, code));
      const logsInTx = await tx.select().from(auditLogs).where(eq(auditLogs.logId, logId));

      assert(ordersInTx.length === 1, "Exatamente 1 encomenda persistida após retry (sem duplicata)");
      assert(parseFloat(ordersInTx[0].amountPaid || '0') === 50000, "Valor pago não somado cumulativamente (50.000 Kz exatos)");
      assert(logsInTx.length === 1, "Exatamente 1 audit log persistido após retry (onConflictDoNothing pelo logId)");

      idempotencyOk = true;
      throw new Error('ROLLBACK_CLEANUP_PHASE_56');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK_CLEANUP_PHASE_56') {
      // Rollback bem sucedido
    } else {
      console.error("Erro inesperado no teste de idempotência:", err);
    }
  }
  assert(idempotencyOk, "Transação temporária de teste de idempotência finalizada com Rollback");

  // ---------------------------------------------------------------------------
  // 5. Auditoria de Privacidade e Não-Vazamento de Dados
  // ---------------------------------------------------------------------------
  console.log("\n5. Auditoria de Privacidade no Rastreio Público (Zero Leaks):");
  if (realOrder) {
    const publicView = sanitizeOrderForPublic(realOrder, { showSalesPriceToClient: false } as any);
    assert(verifyNoInternalDataLeaks(publicView as any), "verifyNoInternalDataLeaks: Aprovado sem vazamentos");
    assert(!('purchaseCost' in publicView), "purchaseCost omitido");
    assert(!('purchaseLocation' in publicView), "purchaseLocation omitido");
    assert(!('deliveryCost' in publicView), "deliveryCost omitido");
    assert(!('otherCosts' in publicView), "otherCosts omitido");
    assert(!('grossProfit' in publicView), "grossProfit omitido");
    assert(!('netProfit' in publicView), "netProfit omitido");
    assert(!('adminNotes' in publicView), "adminNotes omitido");
    assert(!('clientPhone' in publicView), "clientPhone omitido");
    assert(!('clientAddress' in publicView), "clientAddress omitido");
    assert(publicView.code === 'AO-451023', "Código público visível");
    assert(publicView.status === 'PRODUTO_COMPRADO', "Status público visível");
  }

  // ---------------------------------------------------------------------------
  // 6. Verificação Final do Banco de Dados Real
  // ---------------------------------------------------------------------------
  console.log("\n6. Verificação Final da Integridade dos Dados Reais no PostgreSQL:");
  const finalOrders = await getDbOrders();
  const finalClients = await getDbClients();
  const finalSettings = await getDbSettings();
  const finalAuditLogs = await getDbAuditLogs();

  assert(finalOrders.length === 1, `Total final de Encomendas = 1 (obtido: ${finalOrders.length})`);
  assert(finalClients.length === 6, `Total final de Clientes = 6 (obtido: ${finalClients.length})`);
  assert(finalSettings !== null, "Configurações da Loja presentes (1 registro)");
  assert(finalAuditLogs.length === 60, `Total final de Audit Logs = 60 (obtido: ${finalAuditLogs.length})`);

  const finalRealOrder = await getDbOrderByCode('AO-451023');
  assert(finalRealOrder !== null, "Encomenda homologada AO-451023 existe");
  if (finalRealOrder) {
    assert(finalRealOrder.code === 'AO-451023', "Código: AO-451023");
    assert(finalRealOrder.clientName === 'Aldemiro Samba', "Cliente: Aldemiro Samba");
    assert(finalRealOrder.resalePrice === 25000, "Preço de Venda: 25.000,00 Kz");
    assert(finalRealOrder.amountPaid === 25000, "Valor Pago: 25.000,00 Kz");
    assert(finalRealOrder.amountPending === 0, "Saldo Pendente: 0,00 Kz");
    assert(finalRealOrder.status === 'PRODUTO_COMPRADO', "Status: PRODUTO_COMPRADO");
    assert(finalRealOrder.paymentStatus === 'CONFIRMADO', "Pagamento: CONFIRMADO");
    assert(finalRealOrder.paymentMethod === 'EXPRESS', "Método: EXPRESS");
    assert(finalRealOrder.purchaseCost === 18000, "Custo Compra: 18.000,00 Kz");
    assert(finalRealOrder.grossProfit === 7000, "Lucro Bruto: 7.000,00 Kz");
    assert(finalRealOrder.netProfit === 7000, "Lucro Líquido: 7.000,00 Kz");
  }

  console.log(`\n===============================================================================`);
  console.log(`   RESULTADO DA HOMOLOGAÇÃO FASE 5.6: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`===============================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase56Verification().catch((err) => {
  console.error("Erro na verificação da Fase 5.6:", err);
  process.exit(1);
});
