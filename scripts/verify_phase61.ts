import { sanitizeOrderForPublic, verifyNoInternalDataLeaks } from '../src/utils/security.ts';
import { matchOrderCode, formatKz } from '../src/utils/formatters.ts';
import { 
  getPublicTrackingBaseUrl, 
  getPublicTrackingUrl, 
  replaceTemplateVariables, 
  getWhatsAppLink,
  DEFAULT_WHATSAPP_TEMPLATES 
} from '../src/utils/whatsapp.ts';

async function runAudit() {
  console.log("===============================================================================");
  console.log("   FASE 6.1 — AUDITORIA COMPLETA DO RASTREAMENTO PÚBLICO E MOBILE");
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
  // 1. Verificação do Endpoint de Rastreio Público via HTTP no Servidor Ativo
  // ---------------------------------------------------------------------------
  console.log("1. Auditoria do Endpoint Público GET /api/track/AO-451023 no Servidor:");
  const res = await fetch("http://localhost:3000/api/track/AO-451023");
  assert(res.status === 200, `HTTP Status 200 retornado para /api/track/AO-451023 (obtido: ${res.status})`);
  
  const cacheControl = res.headers.get("cache-control") || "";
  const pragma = res.headers.get("pragma") || "";
  const expires = res.headers.get("expires") || "";
  assert(cacheControl.includes("no-store"), `Cache-Control contém 'no-store': ${cacheControl}`);
  assert(cacheControl.includes("no-cache"), `Cache-Control contém 'no-cache'`);
  assert(cacheControl.includes("must-revalidate"), `Cache-Control contém 'must-revalidate'`);
  assert(pragma === "no-cache", `Header Pragma: ${pragma}`);
  assert(expires === "0", `Header Expires: ${expires}`);

  const body = await res.json();
  assert(!!body.order, "Resposta JSON contém o objeto 'order'");
  const publicOrder = body.order;

  // Verificação de Integridade dos Dados Públicos
  assert(publicOrder.code === "AO-451023", `Código: ${publicOrder.code}`);
  assert(publicOrder.status === "PRODUTO_COMPRADO", `Status: ${publicOrder.status}`);
  assert(publicOrder.paymentStatus === "CONFIRMADO", `Status de Pagamento: ${publicOrder.paymentStatus}`);
  if (publicOrder.showSalesPrice) {
    assert(publicOrder.resalePrice === 25000, `Preço de Venda visível: ${formatKz(publicOrder.resalePrice)}`);
    assert(publicOrder.amountPaid === 25000, `Valor Pago visível: ${formatKz(publicOrder.amountPaid)}`);
    assert(publicOrder.amountPending === 0, `Saldo Pendente visível: ${formatKz(publicOrder.amountPending)}`);
  } else {
    assert(publicOrder.resalePrice === undefined, `Preço de Venda ocultado conforme configuração de privacidade (showSalesPriceToClient: false)`);
    assert(publicOrder.amountPaid === undefined, `Valor Pago ocultado conforme configuração de privacidade`);
    assert(publicOrder.amountPending === undefined, `Saldo Pendente ocultado conforme configuração de privacidade`);
  }
  assert(publicOrder.clientFirstName.includes("Aldemiro"), `Primeiro Nome Sanitizado: ${publicOrder.clientFirstName}`);
  assert(Array.isArray(publicOrder.timeline), `Timeline pública presente (${publicOrder.timeline.length} etapas)`);

  // ---------------------------------------------------------------------------
  // 2. Auditoria Rigorosa de Privacidade (Zero Leaks)
  // ---------------------------------------------------------------------------
  console.log("\n2. Auditoria de Privacidade (Zero Leaks):");
  assert(verifyNoInternalDataLeaks(publicOrder), "verifyNoInternalDataLeaks: Aprovado sem vazamentos");
  assert(publicOrder.purchaseCost === undefined, "purchaseCost omitido com sucesso");
  assert(publicOrder.purchaseLocation === undefined, "purchaseLocation omitido com sucesso");
  assert(publicOrder.deliveryCost === undefined, "deliveryCost omitido com sucesso");
  assert(publicOrder.otherCosts === undefined, "otherCosts omitido com sucesso");
  assert(publicOrder.grossProfit === undefined, "grossProfit omitido com sucesso");
  assert(publicOrder.netProfit === undefined, "netProfit omitido com sucesso");
  assert(publicOrder.adminNotes === undefined, "adminNotes omitido com sucesso");
  assert(publicOrder.clientPhone === undefined, "clientPhone privado omitido");
  assert(publicOrder.clientAddress === undefined, "clientAddress privado omitido");
  assert(publicOrder.supplier === undefined, "supplier omitido");
  assert(publicOrder.adminPassword === undefined, "adminPassword omitido");
  assert(publicOrder.adminPasswordHash === undefined, "adminPasswordHash omitido");
  assert(publicOrder.adminPasswordSalt === undefined, "adminPasswordSalt omitido");

  // ---------------------------------------------------------------------------
  // 3. Auditoria de Normalização em matchOrderCode()
  // ---------------------------------------------------------------------------
  console.log("\n3. Auditoria de Normalização em matchOrderCode():");
  const testOrderRef = { code: "AO-451023", clientPhone: "+244 923 456 789" };

  const validFormats = [
    { input: "AO-451023", desc: "Formato canónico exato (AO-451023)" },
    { input: "ao-451023", desc: "Minúsculas com hífen (ao-451023)" },
    { input: "AO451023", desc: "Sem hífen maiúsculas (AO451023)" },
    { input: "ao451023", desc: "Sem hífen minúsculas (ao451023)" },
    { input: "A0-451023", desc: "Dígito 0 em vez de letra O com hífen (A0-451023)" },
    { input: "A0451023", desc: "Dígito 0 em vez de letra O sem hífen (A0451023)" },
    { input: "451023", desc: "Apenas os 6 dígitos numéricos (451023)" },
    { input: " AO-451023 ", desc: 'Espaços nas extremidades (" AO-451023 ")' },
    { input: " ao-451023 ", desc: 'Espaços e minúsculas (" ao-451023 ")' },
    { input: "#AO-451023", desc: "Prefixo hash (#AO-451023)" },
    { input: "#A0-451023", desc: "Prefixo hash com dígito zero (#A0-451023)" },
    { input: "AO 451023", desc: "Separado por espaço (AO 451023)" },
    { input: "923456789", desc: "Busca por telefone do cliente (923456789)" },
  ];

  for (const item of validFormats) {
    const matched = matchOrderCode(testOrderRef, item.input);
    assert(matched === true, `matchOrderCode: ${item.desc} -> ${matched}`);
  }

  // Robustez contra Entradas Anômalas e Ataques
  const anomalousInputs = [
    { input: "", desc: "String vazia" },
    { input: "   ", desc: "Espaços em branco apenas" },
    { input: null as any, desc: "null" },
    { input: undefined as any, desc: "undefined" },
    { input: "' OR '1'='1", desc: "SQL Injection: ' OR '1'='1" },
    { input: "' OR 1=1 --", desc: "SQL Injection com comentário: ' OR 1=1 --" },
    { input: "UNION SELECT null, null, null --", desc: "SQL Injection: UNION SELECT" },
    { input: "<script>alert(1)</script>", desc: "XSS: <script>" },
    { input: "<svg onload=alert(1)>", desc: "XSS: <svg onload>" },
    { input: "../../etc/passwd", desc: "Path traversal: ../../etc/passwd" },
    { input: "../../../", desc: "Path traversal relativo: ../../../" },
    { input: "A".repeat(1000), desc: "String gigante (1.000 chars)" },
    { input: "AO-451023; DROP TABLE orders; --", desc: "Multi-statement injection" },
    { input: "\u0000\u001F\uFFFD", desc: "Caracteres de controlo e Unicode inválido" },
  ];

  for (const item of anomalousInputs) {
    try {
      const result = matchOrderCode(testOrderRef, item.input);
      assert(result === false, `matchOrderCode protegido contra anomalia [${item.desc}] -> false`);
    } catch (err) {
      assert(false, `matchOrderCode gerou exceção em [${item.desc}]: ${err}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Auditoria de Endpoints Públicos via HTTP para Variações e Códigos Anômalos
  // ---------------------------------------------------------------------------
  console.log("\n4. Auditoria de Respostas HTTP para Variações e Ataques:");
  
  const httpFormatTests = [
    { query: "ao-451023", expectedStatus: 200, desc: "Minúsculas: ao-451023" },
    { query: "AO451023", expectedStatus: 200, desc: "Sem hífen: AO451023" },
    { query: "A0-451023", expectedStatus: 200, desc: "Zero: A0-451023" },
    { query: "451023", expectedStatus: 200, desc: "Apenas dígitos: 451023" },
    { query: "%20AO-451023%20", expectedStatus: 200, desc: "Com espaços codificados URL" },
    { query: "AO-999999", expectedStatus: 404, desc: "Código inexistente AO-999999" },
    { query: encodeURIComponent("' OR '1'='1"), expectedStatus: 404, desc: "SQL injection ' OR '1'='1" },
    { query: encodeURIComponent("<script>alert(1)</script>"), expectedStatus: 404, desc: "XSS payload" },
    { query: encodeURIComponent("../../etc/passwd"), expectedStatus: 404, desc: "Path traversal" },
  ];

  for (const t of httpFormatTests) {
    const r = await fetch(`http://localhost:3000/api/track/${t.query}`);
    assert(r.status === t.expectedStatus, `HTTP GET /api/track/${t.query} retornou ${r.status} (${t.desc})`);
  }

  // ---------------------------------------------------------------------------
  // 5. Auditoria de Deep Links e SPA Fallback
  // ---------------------------------------------------------------------------
  console.log("\n5. Auditoria de Deep Links e Fallback SPA do Servidor:");
  const spaRoutes = [
    "/track/AO-451023",
    "/acompanhar/AO-451023",
    "/r/AO-451023",
    "/rastreio/AO-451023",
    "/encomenda/AO-451023",
    "/?code=AO-451023",
    "/AO-451023",
  ];

  for (const route of spaRoutes) {
    const spaRes = await fetch(`http://localhost:3000${route}`);
    assert(spaRes.status === 200, `SPA Deep Link ${route} retornou HTTP 200`);
    const cType = spaRes.headers.get("content-type") || "";
    assert(cType.includes("text/html"), `Content-Type é text/html: ${cType}`);
    const htmlText = await spaRes.text();
    assert(htmlText.includes("<!DOCTYPE html>") || htmlText.includes("<html"), `HTML válido entregue para ${route}`);
  }

  // ---------------------------------------------------------------------------
  // 6. Auditoria de Compatibilidade com WhatsApp, iPhone, Safari e Android
  // ---------------------------------------------------------------------------
  console.log("\n6. Auditoria de Compatibilidade Mobile (WhatsApp / iOS / Android):");
  const baseUrl = getPublicTrackingBaseUrl();
  assert(!baseUrl.includes("localhost"), `Base URL pública livre de localhost: ${baseUrl}`);
  assert(!baseUrl.includes("127.0.0.1"), `Base URL pública livre de 127.0.0.1: ${baseUrl}`);
  assert(!baseUrl.includes("ais-dev-"), `Base URL pública livre de ais-dev- (prevenção de 403 Forbidden IAM no WhatsApp): ${baseUrl}`);
  assert(baseUrl.startsWith("https://"), `Base URL pública utiliza HTTPS estrito`);

  const trackingUrl = getPublicTrackingUrl("AO-451023");
  assert(trackingUrl.includes("?code=AO-451023"), `URL de tracking SPA compatível: ${trackingUrl}`);

  const waMsg = replaceTemplateVariables(DEFAULT_WHATSAPP_TEMPLATES[2].templateText, {
    ...publicOrder,
    clientPhone: "+244 923 456 789",
    clientName: "Aldemiro Samba",
  });
  assert(waMsg.includes("AO-451023"), "Mensagem do WhatsApp inclui código AO-451023");
  assert(waMsg.includes("Aldemiro"), "Mensagem do WhatsApp inclui nome do cliente");
  assert(waMsg.includes(trackingUrl), "Mensagem do WhatsApp inclui o link HTTPS oficial");
  assert(!waMsg.includes("localhost"), "Mensagem do WhatsApp sem referências locais");

  const waDirectLink = getWhatsAppLink("+244 923 456 789", waMsg);
  assert(waDirectLink.startsWith("https://api.whatsapp.com/send?phone=244"), "Link direto oficial api.whatsapp.com gerado com DDI Angola (+244)");
  assert(waDirectLink.includes(encodeURIComponent("AO-451023")), "Link WhatsApp codifica os parâmetros com segurança");

  // ---------------------------------------------------------------------------
  // 7. Teste de Independência do Sistema Administrativo
  // ---------------------------------------------------------------------------
  console.log("\n7. Teste de Independência do Sistema Administrativo:");
  const unauthAdminRes = await fetch("http://localhost:3000/api/data");
  assert(unauthAdminRes.status === 401, "Acesso a /api/data sem cookie/token retorna HTTP 401 Unauthorized");
  
  const publicTrackAgain = await fetch("http://localhost:3000/api/track/AO-451023");
  assert(publicTrackAgain.status === 200, "Tracking público permanece 100% funcional sem qualquer sessão administrativa");

  // ---------------------------------------------------------------------------
  // 8. Benchmark de Performance HTTP (15 requisições de amostragem)
  // ---------------------------------------------------------------------------
  console.log("\n8. Benchmark de Performance HTTP em /api/track/AO-451023 (15 requisições):");
  const latencies: number[] = [];
  const ROUNDS = 15;

  for (let i = 0; i < ROUNDS; i++) {
    const start = performance.now();
    const r = await fetch("http://localhost:3000/api/track/AO-451023");
    await r.json();
    const elapsed = performance.now() - start;
    latencies.push(elapsed);
  }

  latencies.sort((a, b) => a - b);
  const minLatency = latencies[0];
  const maxLatency = latencies[latencies.length - 1];
  const meanLatency = latencies.reduce((acc, v) => acc + v, 0) / latencies.length;
  const medianLatency = latencies[Math.floor(latencies.length / 2)];
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)];
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)];

  console.log(`  [BENCHMARK] Total: ${ROUNDS} requisições HTTP`);
  console.log(`  [BENCHMARK] Mínimo: ${minLatency.toFixed(2)} ms`);
  console.log(`  [BENCHMARK] Médio: ${meanLatency.toFixed(2)} ms`);
  console.log(`  [BENCHMARK] Mediana (p50): ${medianLatency.toFixed(2)} ms`);
  console.log(`  [BENCHMARK] p95: ${p95Latency.toFixed(2)} ms`);
  console.log(`  [BENCHMARK] p99: ${p99Latency.toFixed(2)} ms`);
  console.log(`  [BENCHMARK] Máximo: ${maxLatency.toFixed(2)} ms`);

  assert(meanLatency < 600, `Latência média HTTP < 600ms (obtido: ${meanLatency.toFixed(2)} ms)`);
  assert(p95Latency < 1000, `Latência p95 HTTP < 1000ms (obtido: ${p95Latency.toFixed(2)} ms)`);

  console.log("\n===============================================================================");
  console.log(`   RESULTADO DA AUDITORIA FASE 6.1: ${passed} PASSOU, ${failed} FALHOU`);
  console.log("===============================================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAudit().catch((err) => {
  console.error("Erro fatal na auditoria da Fase 6.1:", err);
  process.exit(1);
});
