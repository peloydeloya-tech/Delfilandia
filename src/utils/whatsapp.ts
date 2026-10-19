import { Order, OrderStatus, WhatsAppTemplate } from '../types';
import { getStatusConfig } from './formatters';

export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'tpl-1',
    name: 'Aguardando Pagamento',
    statusKey: 'AGUARDANDO_PAGAMENTO',
    templateText: `Olá, {{cliente}}! 👋📌

Temos uma atualização sobre a sua encomenda. Aguardamos a confirmação do pagamento. ⏳

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

🗓️ Previsão: {{previsao}}
📍 Local de Entrega: {{provincia}}, {{municipio}}

🔗 Aceda ao nosso site para acompanhar:
{{link}}

👉 Basta abrir o link acima e inserir o seu código (*{{codigo}}*) para consultar o estado atualizado.

Obrigado pela preferência! DELFILÂNDIA ❤️`,
  },
  {
    id: 'tpl-2',
    name: 'Pagamento Confirmado',
    statusKey: 'PAGAMENTO_CONFIRMADO',
    templateText: `Olá, {{cliente}}! 👋🎉

O seu pagamento foi confirmado com sucesso! 💳✅

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

🗓️ Previsão de Entrega: {{previsao}}
📍 Local de Entrega: {{provincia}}, {{municipio}}

🔗 Aceda ao nosso site para acompanhar:
{{link}}

👉 Basta abrir o link acima e digitar o seu código (*{{codigo}}*) para acompanhar todas as etapas.

Obrigado pela confiança na DELFILÂNDIA! ❤️`,
  },
  {
    id: 'tpl-3',
    name: 'Produto Comprado',
    statusKey: 'PRODUTO_COMPRADO',
    templateText: `Olá, {{cliente}}! 👋🛍️

O seu produto já foi adquirido e brevemente estará consigo! 🛒✨

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

🗓️ Previsão de Entrega: {{previsao}}
📍 Local de Entrega: {{provincia}}, {{municipio}}

🔗 Aceda ao nosso site de acompanhamento:
{{link}}

👉 Abra o link acima e digite o seu código (*{{codigo}}*) para consultar o progresso em tempo real.

Seguimos a preparar tudo para si com rapidez e segurança. DELFILÂNDIA ❤️`,
  },
  {
    id: 'tpl-4',
    name: 'Saiu para Entrega',
    statusKey: 'SAIU_PARA_ENTREGA',
    templateText: `Olá, {{cliente}}! 👋🚚

A sua encomenda já saiu para entrega e está a caminho! 💨🚀

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

📍 Endereço de Entrega: {{provincia}}, {{municipio}}
🗓️ Previsão: {{previsao}}

🔗 Acompanhe no nosso site:
{{link}}

👉 Insira o seu código (*{{codigo}}*) no site para verificar a rota e os detalhes da entrega.

Por favor, mantenha o seu telefone disponível para o estafeta.
Obrigado pela confiança! DELFILÂNDIA ❤️`,
  },
  {
    id: 'tpl-5',
    name: 'Entregue',
    statusKey: 'ENTREGUE',
    templateText: `Olá, {{cliente}}! 👋🎉

A sua encomenda foi entregue com sucesso! 🎁✅

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

📍 Local de Entrega: {{provincia}}, {{municipio}}

🔗 Aceda ao nosso sistema para consultar o seu comprovativo digital:
{{link}}

👉 Digite o seu código (*{{codigo}}*) para visualizar o recibo de entrega.

Obrigado por confiar na DELFILÂNDIA! ❤️`,
  },
  {
    id: 'tpl-6',
    name: 'Problema / Atenção',
    statusKey: 'PROBLEMA',
    templateText: `Olá, {{cliente}}! 👋⚠️

Gostaríamos de informar sobre uma atualização relativamente à sua encomenda (*{{produto}}*). 🚨

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

📍 Local: {{provincia}}, {{municipio}}

🔗 Aceda ao nosso site para verificar os detalhes atualizados:
{{link}}

👉 Digite o seu código (*{{codigo}}*) na pesquisa para consultar a nota de esclarecimento.

A nossa equipa está a acompanhar o caso para resolver rapidamente. DELFILÂNDIA. 🤝`,
  },
  {
    id: 'tpl-7',
    name: 'Cancelada',
    statusKey: 'CANCELADA',
    templateText: `Olá, {{cliente}}! 👋❌

Informamos que a encomenda (*{{produto}}*) com o código {{codigo}} foi cancelada no nosso sistema. 🚫

📦 Produto: {{produto}}
🏷️ Código: {{codigo}}

📍 Estado Atual:
{{estado}}

🔗 Aceda ao nosso site de consulta:
{{link}}

👉 Insira o código (*{{codigo}}*) para ver o histórico do pedido.

Se tiver alguma dúvida sobre reembolsos ou novo pedido, por favor contacte-nos.
Obrigado, DELFILÂNDIA. 💙`,
  },
  {
    id: 'tpl-8',
    name: 'Confirmação de Entrega',
    statusKey: 'CONFIRMACAO_ENTREGA',
    templateText: `Olá, {{cliente}}! 👋🥳

A sua encomenda (*{{produto}}*) com código {{codigo}} foi confirmada como entregue! 🎉✅

📦 Produto: {{produto}}
🏷️ O seu Código de Rastreio: {{codigo}}

📍 Estado Atual:
{{estado}}

📍 Local: {{provincia}}, {{municipio}}

🔗 Aceda ao site para ver o comprovativo final:
{{link}}

👉 Insira o código (*{{codigo}}*) para conferir os detalhes e o comprovativo.

Obrigado por comprar connosco! DELFILÂNDIA ❤️`,
  },
];

// Public production fallback URL for Google AI Studio deployment
export const PUBLIC_SHARED_FALLBACK_URL = 'https://ais-pre-zogo7fgdsaxqigtfirdqkx-344045634725.europe-west2.run.app';

/**
 * Resolves the public, unauthenticated base URL for customer links.
 * Fixes Google Cloud Run 403 Forbidden errors by converting internal dev endpoints
 * ('ais-dev-...') to public preview endpoints ('ais-pre-...') on Google AI Studio Cloud Run.
 * This guarantees the tracking link opens on ANY phone, computer, or network without needing Google sign-in.
 */
export function getPublicTrackingBaseUrl(configuredDomain?: string): string {
  // 1. Explicitly passed configured domain (ignoring old hardcoded placeholder domains)
  if (configuredDomain && configuredDomain.trim() && !configuredDomain.includes('delfilandia.ao')) {
    let trimmed = configuredDomain.trim();
    let url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed.replace(/\/+$/, '')
      : `https://${trimmed.replace(/\/+$/, '')}`;
    // Replace any internal dev container prefix with the public preview prefix
    if (url.includes('ais-dev-')) {
      url = url.replace('ais-dev-', 'ais-pre-');
    }
    return url;
  }

  // 2. Check saved settings from localStorage if available
  if (typeof window !== 'undefined') {
    try {
      const savedSettingsStr = localStorage.getItem('delfilandia_settings') || localStorage.getItem('kwanza_settings');
      if (savedSettingsStr) {
        const parsed = JSON.parse(savedSettingsStr);
        if (
          parsed.publicTrackingDomain &&
          typeof parsed.publicTrackingDomain === 'string' &&
          parsed.publicTrackingDomain.trim() &&
          !parsed.publicTrackingDomain.includes('delfilandia.ao')
        ) {
          let trimmed = parsed.publicTrackingDomain.trim();
          let url = trimmed.startsWith('http://') || trimmed.startsWith('https://')
            ? trimmed.replace(/\/+$/, '')
            : `https://${trimmed.replace(/\/+$/, '')}`;
          if (url.includes('ais-dev-')) {
            url = url.replace('ais-dev-', 'ais-pre-');
          }
          return url;
        }
      }
    } catch {
      // ignore
    }
  }

  // 3. Auto-detect from Google AI Studio browser location and convert internal dev URL to public shared preview URL
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    let origin = window.location.origin;
    // CRITICAL 403 FIX: ais-dev- endpoints require Google IAM Developer login.
    // Converting to ais-pre- allows anyone (clients on WhatsApp) to view without 403 Forbidden.
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    // If not localhost or dummy, return cleaned origin
    if (!origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      return origin.replace(/\/+$/, '');
    }
  }

  return PUBLIC_SHARED_FALLBACK_URL;
}

/**
 * Returns the public customer tracking URL for an order.
 * Uses root query parameter (?code=...) so that SPA static hosts / Cloud Run preview proxies
 * always find index.html without throwing '404 Page Not Found'.
 */
export function getPublicTrackingUrl(orderCode: string, configuredDomain?: string): string {
  const baseUrl = getPublicTrackingBaseUrl(configuredDomain);
  const cleanCode = (orderCode || '').trim().toUpperCase();
  return `${baseUrl}/?code=${cleanCode}`;
}

/**
 * Replaces template variables {{cliente}}, {{produto}}, {{codigo}}, {{estado}}, {{previsao}}, {{provincia}}, {{municipio}}, {{link}}
 */
export function replaceTemplateVariables(templateText: string, order: Order, trackingBaseUrl?: string): string {
  const statusConfig = getStatusConfig(order.status);
  
  const emojiMap: Record<string, string> = {
    AGUARDANDO_PAGAMENTO: '⏳ Aguardando Pagamento',
    PAGAMENTO_CONFIRMADO: '✅ Pagamento Confirmado',
    PRODUTO_COMPRADO: '🛍️ Produto Comprado',
    SAIU_PARA_ENTREGA: '🚀 Saiu para Entrega',
    ENTREGUE: '🎉 Entregue com Sucesso',
    PROBLEMA: '⚠️ Atenção Necessária',
    CANCELADA: '❌ Encomenda Cancelada',
  };

  const statusLabelWithEmoji = emojiMap[order.status] || (statusConfig ? statusConfig.label : order.status);
  const locationCombined = order.clientAddress
    ? `${order.clientAddress} (${order.clientProvince || 'Luanda'})`
    : (order.clientDistrict ? `${order.clientProvince}, ${order.clientDistrict}` : (order.clientProvince || 'Luanda, Angola'));
  const cleanBaseUrl = getPublicTrackingBaseUrl(trackingBaseUrl);
  const directLinkWithCode = getPublicTrackingUrl(order.code, trackingBaseUrl);

  let result = templateText
    .replace(/\{\{provincia\}\},\s*\{\{municipio\}\}/g, locationCombined)
    .replace(/\{\{cliente\}\}/g, order.clientName || 'Cliente')
    .replace(/\{\{produto\}\}/g, order.productName || 'Produto')
    .replace(/\{\{codigo\}\}/g, order.code || '')
    .replace(/\{\{estado\}\}/g, statusLabelWithEmoji)
    .replace(/\{\{previsao\}\}/g, order.estimatedDeliveryDate || 'A confirmar')
    .replace(/\{\{provincia\}\}/g, order.clientProvince || 'Luanda')
    .replace(/\{\{municipio\}\}/g, order.clientDistrict || order.clientAddress || order.clientProvince || 'Angola')
    .replace(/\{\{link\}\}/g, directLinkWithCode)
    .replace(/\{\{linkBase\}\}/g, cleanBaseUrl)
    .replace(/\{\{linkDireto\}\}/g, directLinkWithCode)
    .replace(/\{\{linkComCodigo\}\}/g, directLinkWithCode);

  // If link was not present in the template text, append direct tracking link automatically at bottom
  if (!templateText.includes('{{link}}') && !result.includes(directLinkWithCode)) {
    result += `\n\n🔗 Acompanhe em tempo real:\n${directLinkWithCode}\n👉 Basta abrir o link para ver o progresso da entrega.`;
  }

  return result;
}

/**
 * Creates deep-link WhatsApp URL using official api.whatsapp.com/send interface to preserve emojis and line breaks across all platforms
 */
export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  let fullPhone = cleanPhone;
  if (!cleanPhone.startsWith('244')) {
    fullPhone = `244${cleanPhone}`;
  }
  const encodedText = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodedText}`;
}

/**
 * Generates WhatsApp message for order and optional status
 */
export function generateWhatsAppMessage(order: Order, newStatusKey?: OrderStatus | 'CONFIRMACAO_ENTREGA'): string {
  const targetKey = newStatusKey || order.status;
  const foundTpl = DEFAULT_WHATSAPP_TEMPLATES.find((t) => t.statusKey === targetKey);

  if (foundTpl) {
    return replaceTemplateVariables(foundTpl.templateText, order);
  }

  // Fallback
  return replaceTemplateVariables(DEFAULT_WHATSAPP_TEMPLATES[0].templateText, order);
}
