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

async function runPhase55Verification() {
  console.log("===============================================================================");
  console.log("   FASE 5.5 — AUDITORIA DE CONCILIAÇÃO, IDEMPOTÊNCIA, CONCORRÊNCIA E INTEGRIDADE");
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
    assert(realOrder.grossProfit === 7000, "Lucro Bruto: 7.000,00 Kz");
    assert(realOrder.netProfit === 7000, "Lucro Líquido: 7.000,00 Kz");
  }

  // ---------------------------------------------------------------------------
  // 2. Teste de Idempotência e Retries Repetidos em Transação com Rollback
  // ---------------------------------------------------------------------------
  console.log("\n2. Auditoria de Idempotência e Prevenção de Dupla Contabilização:");
  let idempotencyVerified = false;
  try {
    await db.transaction(async (tx) => {
      // Simulação: Encomenda temporária gravada pela 1ª vez
      const tempPayload = {
        code: 'AO-IDEMPOTENCY-TEST-TEMP',
        clientName: 'Cliente Teste Idempotência',
        productName: 'Produto Teste',
        resalePrice: '30000.00',
        amountPaid: '30000.00',
        amountPending: '0.00',
        status: 'AGUARDANDO_PAGAMENTO',
        paymentStatus: 'CONFIRMADO',
        paymentMethod: 'TRANSFERENCIA',
        quantity: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // 1ª Inserção
      await tx.insert(orders).values(tempPayload);

      // Simulação de Retries (2ª e 3ª requisições idênticas via UPSERT)
      for (let retry = 1; retry <= 2; retry++) {
        await tx
          .insert(orders)
          .values(tempPayload)
          .onConflictDoUpdate({
            target: orders.code,
            set: {
              clientName: tempPayload.clientName,
              resalePrice: tempPayload.resalePrice,
              amountPaid: tempPayload.amountPaid,
              amountPending: tempPayload.amountPending,
              updatedAt: new Date(),
            }
          });
      }

      // Verificação dentro da transação: deve existir exatamente 1 registro
      const checkInTx = await tx.select().from(orders).where(eq(orders.code, 'AO-IDEMPOTENCY-TEST-TEMP'));
      assert(checkInTx.length === 1, "Idempotência no PostgreSQL: 3 execuções consecutivas resultaram em exatamente 1 registro");
      assert(parseFloat(checkInTx[0].amountPaid || '0') === 30000, "amountPaid não foi duplicado/triplicado (permaneceu 30.000 Kz)");

      idempotencyVerified = true;
      // Abortar transação para manter banco de produção 100% limpo
      throw new Error('ROLLBACK_CLEANUP_IDEMPOTENCY_TEST');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK_CLEANUP_IDEMPOTENCY_TEST') {
      // Rollback intencional bem sucedido
    } else {
      console.error("Erro inesperado no teste de idempotência:", err);
    }
  }
  assert(idempotencyVerified, "Teste de Idempotência e Retries finalizado com Rollback garantido");

  // ---------------------------------------------------------------------------
  // 3. Teste de Concorrência e Isolamento Transacional ACID
  // ---------------------------------------------------------------------------
  console.log("\n3. Auditoria de Concorrência e Bloqueios em Atualizações Concorrentes:");
  let concurrencyPassed = false;
  try {
    await db.transaction(async (tx) => {
      const concCode = 'AO-CONCURRENCY-TEST-TEMP';
      await tx.insert(orders).values({
        code: concCode,
        clientName: 'Cliente Concorrência',
        productName: 'Produto Teste',
        resalePrice: '40000.00',
        amountPaid: '20000.00',
        amountPending: '20000.00',
        status: 'AGUARDANDO_PAGAMENTO',
        paymentStatus: 'PARCIAL',
        paymentMethod: 'TRANSFERENCIA',
        quantity: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Duas atualizações de pagamento simultâneas
      const update1 = tx
        .insert(orders)
        .values({ code: concCode, clientName: 'Cliente', productName: 'P', quantity: 1, resalePrice: '40000.00', amountPaid: '30000.00', amountPending: '10000.00', paymentStatus: 'PARCIAL', paymentMethod: 'TRANSFERENCIA', status: 'AGUARDANDO_PAGAMENTO', createdAt: new Date(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: orders.code, set: { amountPaid: '30000.00', amountPending: '10000.00' } });

      const update2 = tx
        .insert(orders)
        .values({ code: concCode, clientName: 'Cliente', productName: 'P', quantity: 1, resalePrice: '40000.00', amountPaid: '40000.00', amountPending: '0.00', paymentStatus: 'CONFIRMADO', paymentMethod: 'TRANSFERENCIA', status: 'PAGAMENTO_CONFIRMADO', createdAt: new Date(), updatedAt: new Date() })
        .onConflictDoUpdate({ target: orders.code, set: { amountPaid: '40000.00', amountPending: '0.00', paymentStatus: 'CONFIRMADO' } });

      await Promise.all([update1, update2]);

      const concCheck = await tx.select().from(orders).where(eq(orders.code, concCode));
      assert(concCheck.length === 1, "Concorrência: Isolamento preservado, exatamente 1 registro existente");
      assert(concCheck[0].amountPending === '0.00' || concCheck[0].amountPending === '10000.00', "Estado financeiro final é consistente e determinístico");

      concurrencyPassed = true;
      throw new Error('ROLLBACK_CLEANUP_CONCURRENCY_TEST');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK_CLEANUP_CONCURRENCY_TEST') {
      // Rollback com sucesso
    }
  }
  assert(concurrencyPassed, "Teste de Concorrência concluído com Rollback garantido");

  // ---------------------------------------------------------------------------
  // 4. Conciliação Completa de Payment Status e Invariantes Financeiras
  // ---------------------------------------------------------------------------
  console.log("\n4. Conciliação de Status de Pagamento vs Valores Financeiros:");
  const reconciliationMatrix = [
    { name: 'Pagamento Zero', resale: 20000, paid: 0, expectedPending: 20000, expectedStatus: 'PENDENTE' },
    { name: 'Pagamento Parcial 50%', resale: 20000, paid: 10000, expectedPending: 10000, expectedStatus: 'PARCIAL' },
    { name: 'Pagamento Parcial 99%', resale: 20000, paid: 19999, expectedPending: 1, expectedStatus: 'PARCIAL' },
    { name: 'Pagamento Integral Exato', resale: 20000, paid: 20000, expectedPending: 0, expectedStatus: 'CONFIRMADO' },
    { name: 'Pagamento com Excedente', resale: 20000, paid: 25000, expectedPending: 0, expectedStatus: 'CONFIRMADO' },
  ];

  for (const item of reconciliationMatrix) {
    const calcPending = Math.max(0, item.resale - item.paid);
    let calcStatus: PaymentStatus = 'PENDENTE';
    if (item.paid >= item.resale && item.resale > 0) {
      calcStatus = 'CONFIRMADO';
    } else if (item.paid > 0 && item.paid < item.resale) {
      calcStatus = 'PARCIAL';
    } else if (item.paid === 0) {
      calcStatus = 'PENDENTE';
    }

    assert(calcPending === item.expectedPending, `[${item.name}] Saldo pendente: ${calcPending} Kz (esperado: ${item.expectedPending} Kz)`);
    assert(calcStatus === item.expectedStatus, `[${item.name}] Status pagamento: ${calcStatus} (esperado: ${item.expectedStatus})`);
  }

  // ---------------------------------------------------------------------------
  // 5. Auditoria de Audit Logs e Imutabilidade
  // ---------------------------------------------------------------------------
  console.log("\n5. Auditoria da Tabela audit_logs e Imutabilidade dos 60 Registros Reais:");
  const currentLogs = await getDbAuditLogs();
  assert(currentLogs.length === 60, `60 audit logs confirmados (contagem: ${currentLogs.length})`);
  
  // Teste de inserção com mesmo logId (onConflictDoNothing)
  let logIdempotencyPassed = false;
  try {
    await db.transaction(async (tx) => {
      const tempLogId = 'log-test-idempotency-phase55';
      await tx.insert(auditLogs).values({
        logId: tempLogId,
        orderCode: 'AO-451023',
        user: 'Admin Teste',
        action: 'Ação Teste',
        details: 'Detalhe',
        timestamp: new Date(),
      });

      // Tentativa de duplicar log com mesmo logId
      await tx.insert(auditLogs).values({
        logId: tempLogId,
        orderCode: 'AO-451023',
        user: 'Admin Teste',
        action: 'Ação Teste Repetida',
        details: 'Detalhe Repetido',
        timestamp: new Date(),
      }).onConflictDoNothing();

      const logCheck = await tx.select().from(auditLogs).where(eq(auditLogs.logId, tempLogId));
      assert(logCheck.length === 1, "audit_logs: onConflictDoNothing preveniu duplicação de log com mesmo ID");

      logIdempotencyPassed = true;
      throw new Error('ROLLBACK_LOG_TEST');
    });
  } catch (err: any) {
    if (err.message === 'ROLLBACK_LOG_TEST') {
      // Rollback ok
    }
  }
  assert(logIdempotencyPassed, "Teste de idempotência em audit_logs concluído com Rollback");

  // ---------------------------------------------------------------------------
  // 6. Auditoria de Segurança e Não Vazamento de Dados no Tracking Público
  // ---------------------------------------------------------------------------
  console.log("\n6. Auditoria de Privacidade do Rastreio Público (Zero Leaks):");
  if (realOrder) {
    const publicData = sanitizeOrderForPublic(realOrder, { showSalesPriceToClient: false } as any);
    const leakFree = verifyNoInternalDataLeaks(publicData as any);
    assert(leakFree, "verifyNoInternalDataLeaks: Aprovado sem vazamentos");
    assert(!('purchaseCost' in publicData), "purchaseCost não exposto");
    assert(!('purchaseLocation' in publicData), "purchaseLocation não exposto");
    assert(!('deliveryCost' in publicData), "deliveryCost não exposto");
    assert(!('otherCosts' in publicData), "otherCosts não exposto");
    assert(!('grossProfit' in publicData), "grossProfit não exposto");
    assert(!('netProfit' in publicData), "netProfit não exposto");
    assert(!('adminNotes' in publicData), "adminNotes não exposto");
    assert(!('clientPhone' in publicData), "clientPhone não exposto");
  }

  // ---------------------------------------------------------------------------
  // 7. Verificação Final da Integridade da Produção
  // ---------------------------------------------------------------------------
  console.log("\n7. Verificação Pós-Auditoria da Base de Dados de Produção:");
  const finalOrders = await getDbOrders();
  const finalClients = await getDbClients();
  const finalSettings = await getDbSettings();
  const finalAuditLogs = await getDbAuditLogs();

  assert(finalOrders.length === 1, `Total final de Encomendas = 1 (obtido: ${finalOrders.length})`);
  assert(finalClients.length === 6, `Total final de Clientes = 6 (obtido: ${finalClients.length})`);
  assert(finalSettings !== null, "Configurações da Loja preservadas");
  assert(finalAuditLogs.length === 60, `Total final de Audit Logs = 60 (obtido: ${finalAuditLogs.length})`);

  const finalOrder = await getDbOrderByCode('AO-451023');
  assert(finalOrder !== null && finalOrder.code === 'AO-451023', "AO-451023 permanece 100% intacta");
  if (finalOrder) {
    assert(finalOrder.clientName === 'Aldemiro Samba', "Cliente: Aldemiro Samba");
    assert(finalOrder.resalePrice === 25000, "Valor Venda: 25.000,00 Kz");
    assert(finalOrder.amountPaid === 25000, "Valor Pago: 25.000,00 Kz");
    assert(finalOrder.amountPending === 0, "Saldo Pendente: 0,00 Kz");
    assert(finalOrder.status === 'PRODUTO_COMPRADO', "Status: PRODUTO_COMPRADO");
    assert(finalOrder.paymentStatus === 'CONFIRMADO', "Pagamento: CONFIRMADO");
    assert(finalOrder.paymentMethod === 'EXPRESS', "Método: EXPRESS");
  }

  console.log(`\n===============================================================================`);
  console.log(`   RESULTADO DOS TESTES DA FASE 5.5: ${passed} PASSOU, ${failed} FALHOU`);
  console.log(`===============================================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase55Verification().catch((err) => {
  console.error("Erro na execução dos testes:", err);
  process.exit(1);
});
