import { getDbOrders, getDbOrderByCode, saveDbOrder } from '../src/db/repository.ts';
import { sanitizeOrderForPublic, verifyNoInternalDataLeaks } from '../src/utils/security.ts';
import { matchOrderCode, getCustomerStatusFlow, getCustomerStepIndex } from '../src/utils/formatters.ts';
import { VALID_ORDER_STATUSES, VALID_PAYMENT_STATUSES } from '../src/types.ts';

async function runPhase52Validation() {
  console.log("=== INICIANDO BATERIA DE TESTES NÃO DESTRUTIVOS DA FASE 5.2 ===");
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // 1. Validação da Encomenda Real Homologada (AO-451023)
  console.log("\n1. Verificação da Encomenda Real Homologada AO-451023:");
  const realOrder = await getDbOrderByCode('AO-451023');
  assert(realOrder !== null, "Encomenda real AO-451023 existe no PostgreSQL");
  if (realOrder) {
    console.log("  Valores de AO-451023:", {
      code: realOrder.code,
      resalePrice: realOrder.resalePrice,
      purchaseCost: realOrder.purchaseCost,
      deliveryCost: realOrder.deliveryCost,
      otherCosts: realOrder.otherCosts,
      grossProfit: realOrder.grossProfit,
      netProfit: realOrder.netProfit,
    });
    assert(realOrder.code === 'AO-451023', "Código exato AO-451023");
    assert(realOrder.clientName === 'Aldemiro Samba', "Cliente: Aldemiro Samba");
    assert(realOrder.resalePrice === 25000, "Preço de Venda: 25.000 Kz");
    assert(realOrder.amountPaid === 25000, "Valor Pago: 25.000 Kz");
    assert(realOrder.amountPending === 0, "Saldo Pendente: 0 Kz");
    assert(realOrder.status === 'PRODUTO_COMPRADO', "Estado: PRODUTO_COMPRADO");
    assert(realOrder.paymentStatus === 'CONFIRMADO', "Pagamento: CONFIRMADO");
    assert(realOrder.purchaseCost === 18000, "Custo Compra: 18.000 Kz");
    assert(realOrder.deliveryCost === 0 || realOrder.deliveryCost === 2500, `Custo Frete: ${realOrder.deliveryCost} Kz`);
    assert(realOrder.grossProfit === 7000, "Lucro Bruto: 7.000 Kz");
    assert(realOrder.netProfit === 7000 || realOrder.netProfit === 4500, `Lucro Líquido: ${realOrder.netProfit} Kz`);
  }

  // 2. Validação da Máquina de Estados e Configurações
  console.log("\n2. Validação da Máquina de Estados e Stepper do Cliente:");
  const expectedStatuses = [
    'AGUARDANDO_PAGAMENTO',
    'PAGAMENTO_CONFIRMADO',
    'PRODUTO_COMPRADO',
    'SAIU_PARA_ENTREGA',
    'ENTREGUE',
    'PROBLEMA',
    'CANCELADA'
  ];
  assert(
    JSON.stringify(VALID_ORDER_STATUSES) === JSON.stringify(expectedStatuses),
    "Todos os 7 estados oficiais estão definidos e protegidos em VALID_ORDER_STATUSES"
  );

  const linearSteps = getCustomerStatusFlow('PRODUTO_COMPRADO');
  assert(linearSteps.length === 5, "Fluxo base linear do cliente possui 5 passos essenciais");
  assert(getCustomerStepIndex('PRODUTO_COMPRADO') === 2, "Passo do cliente para PRODUTO_COMPRADO é index 2 (Passo 3)");

  const problemSteps = getCustomerStatusFlow('PROBLEMA');
  assert(problemSteps.length === 6, "Fluxo com PROBLEMA adiciona 6º passo de alerta");
  assert(getCustomerStepIndex('PROBLEMA') === 5, "Index de PROBLEMA mapeado para 5 (Passo 6)");

  const cancelSteps = getCustomerStatusFlow('CANCELADA');
  assert(cancelSteps.length === 6, "Fluxo com CANCELADA adiciona 6º passo de cancelamento");
  assert(getCustomerStepIndex('CANCELADA') === 5, "Index de CANCELADA mapeado para 5 (Passo 6)");

  // 3. Validação de Rastreio Público e Higienização (Privacidade Total)
  console.log("\n3. Validação de Privacidade e Higienização no Rastreio Público:");
  if (realOrder) {
    const publicView = sanitizeOrderForPublic(realOrder, { showSalesPriceToClient: false } as any);
    assert(publicView.code === 'AO-451023', "Código público preservado");
    assert(publicView.clientFirstName === 'Cliente: Aldemiro', "Nome do cliente higienizado para primeiro nome");
    assert(publicView.productName.includes('Conjunto'), "Nome do produto exibido");
    assert(publicView.status === 'PRODUTO_COMPRADO', "Status público visível");
    
    // Verificação de vazamento de dados internos
    const isLeakFree = verifyNoInternalDataLeaks(publicView as any);
    assert(isLeakFree, "Zero vazamentos de custos internos no objeto público");
    assert(!('purchaseCost' in publicView), "purchaseCost NÃO existe no view público");
    assert(!('purchaseLocation' in publicView), "purchaseLocation NÃO existe no view público");
    assert(!('deliveryCost' in publicView), "deliveryCost NÃO existe no view público");
    assert(!('otherCosts' in publicView), "otherCosts NÃO existe no view público");
    assert(!('grossProfit' in publicView), "grossProfit NÃO existe no view público");
    assert(!('netProfit' in publicView), "netProfit NÃO existe no view público");
    assert(!('adminNotes' in publicView), "adminNotes NÃO existe no view público");
    assert(!('clientPhone' in publicView), "Telefone do cliente NÃO existe no view público");
    assert(!('clientAddress' in publicView), "Morada completa NÃO existe no view público");
  }

  // 4. Validação de Resolução Flexível de Códigos de Rastreio
  console.log("\n4. Resolução Inteligente e Flexível de Códigos de Rastreio:");
  const testOrder = { code: 'AO-451023', clientPhone: '935133346' };
  assert(matchOrderCode(testOrder, 'AO-451023'), "Match exato: AO-451023");
  assert(matchOrderCode(testOrder, 'ao-451023'), "Match minúsculas: ao-451023");
  assert(matchOrderCode(testOrder, 'AO451023'), "Match sem hífen: AO451023");
  assert(matchOrderCode(testOrder, 'A0-451023'), "Match com zero: A0-451023");
  assert(matchOrderCode(testOrder, '451023'), "Match apenas dígitos: 451023");
  assert(matchOrderCode(testOrder, '#AO-451023'), "Match com cardinal: #AO-451023");
  assert(matchOrderCode(testOrder, '935133346'), "Match por telefone: 935133346");
  assert(!matchOrderCode(testOrder, 'AO-999999'), "Não match código inexistente");
  assert(!matchOrderCode(testOrder, "'; DROP TABLE orders; --"), "Bloqueio de tentativa SQLi na busca");

  // 5. Validação de Rejeição de Estados Inválidos
  console.log("\n5. Validação de Rejeição de Estados e Pagamentos Inválidos:");
  try {
    const invalidOrder = {
      ...realOrder!,
      code: 'AO-TEMP-INVALID',
      status: 'ESTADO_INVENTADO' as any,
    };
    await saveDbOrder(invalidOrder);
    assert(false, "Deveria ter rejeitado estado inválido");
  } catch (err: any) {
    assert(err.status === 400 || String(err.message).includes('inválido'), "saveDbOrder rejeitou com sucesso estado inválido");
  }

  console.log(`\n=== RESULTADO DOS TESTES: ${passed} PASSOU, ${failed} FALHOU ===`);
  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runPhase52Validation().catch((err) => {
  console.error("Erro na execução dos testes:", err);
  process.exit(1);
});
