import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Order } from '../types';
import { formatKz, formatDatePT, getStatusConfig } from './formatters';
import { getPublicTrackingUrl } from './whatsapp';
import { DELFILANDIA_LOGO_SRC } from '../components/DelfilandiaWordmark';

/**
 * Converts an image source/URL to a base64 Data URL.
 */
async function getImageDataUrl(src: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width || 120;
        canvas.height = img.naturalHeight || img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
          return;
        }
      } catch (e) {
        console.warn('Canvas export failed:', e);
      }
      resolve('');
    };
    img.onerror = () => resolve('');
    img.src = src;
  });
}

/**
 * Generates and downloads the Official DELFILÂNDIA Client Receipt as a clean vector PDF.
 */
export async function downloadClientReceiptPdf(order: Order, showSalesPrice: boolean = false): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const trackingUrl = getPublicTrackingUrl(order.code);
    const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
      margin: 1,
      width: 260,
      color: { dark: '#0f172a', light: '#ffffff' },
    });

    let logoDataUrl = '';
    try {
      logoDataUrl = await getImageDataUrl(DELFILANDIA_LOGO_SRC);
    } catch {
      // Ignore logo failure
    }

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 14;

    // --- TOP HEADER BOX ---
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(8, 75, 138);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, 26, 3, 3, 'FD');

    // Logo
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', margin + 3, y + 2.5, 21, 21);
      } catch {
        // Fallback placeholder circle
        doc.setFillColor(234, 118, 23);
        doc.circle(margin + 13.5, y + 13, 10, 'F');
      }
    }

    // Brand Titles
    const textStartX = margin + 27;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(8, 75, 138);
    doc.text('DELFI', textStartX, y + 9);
    const delfiWidth = doc.getTextWidth('DELFI');
    doc.setTextColor(234, 118, 23);
    doc.text('LÂNDIA', textStartX + delfiWidth, y + 9);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(234, 118, 23);
    doc.text('UM MUNDO DE PRODUTOS À SUA PORTA', textStartX, y + 14);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Comprovativo de Registo e Acompanhamento Transparente', textStartX, y + 19);

    // Code Badge Box
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(pageWidth - margin - 42, y + 3, 39, 20, 2, 2, 'FD');

    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(59, 130, 246);
    doc.text('CÓDIGO DO PEDIDO', pageWidth - margin - 22.5, y + 8, { align: 'center' });

    doc.setFontSize(11);
    doc.setFont('courier', 'bold');
    doc.setTextColor(8, 75, 138);
    doc.text(order.code, pageWidth - margin - 22.5, y + 14, { align: 'center' });

    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Emitido em: ${formatDatePT(new Date().toISOString())}`, pageWidth - margin - 22.5, y + 19, { align: 'center' });

    y += 31;

    // --- CLIENT & DESTINATION SECTION ---
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 30, 2, 2, 'FD');

    const colW = contentWidth / 2;

    // Left: Client
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('CLIENTE DESTINATÁRIO', margin + 4, y + 7);

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(order.clientName || 'Cliente DELFILÂNDIA', margin + 4, y + 14);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(`Telefone: ${order.clientPhone || 'Não especificado'}`, margin + 4, y + 21);

    // Right: Delivery Location
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('LOCAL DE ENTREGA EM ANGOLA', margin + colW + 4, y + 7);

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(`${order.clientDistrict || 'Luanda'}, ${order.clientProvince || 'Luanda'}`, margin + colW + 4, y + 14);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const locationDesc = order.referencePoint
      ? `${order.clientAddress || ''} (Ref: ${order.referencePoint})`
      : order.clientAddress || 'Conforme acordado com a vendedora';
    const splitLocation = doc.splitTextToSize(locationDesc, colW - 8);
    doc.text(splitLocation, margin + colW + 4, y + 20);

    y += 35;

    // --- PRODUCT TABLE ---
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, contentWidth, 8, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('DESCRIÇÃO DO PRODUTO', margin + 4, y + 5.5);
    doc.text('QTD', margin + contentWidth - 45, y + 5.5, { align: 'center' });
    doc.text('ESTADO DO PAGAMENTO', margin + contentWidth - 4, y + 5.5, { align: 'right' });

    y += 8;

    doc.setFillColor(255, 255, 255);
    doc.rect(margin, y, contentWidth, 18, 'FD');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    const splitProd = doc.splitTextToSize(order.productName || 'Artigo de Encomenda DELFILÂNDIA', contentWidth - 65);
    doc.text(splitProd, margin + 4, y + 7);

    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    doc.text(`${order.quantity || 1}`, margin + contentWidth - 45, y + 8, { align: 'center' });

    // Payment Status Pill
    const payText = order.paymentStatus || 'CONFIRMADO';
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin + contentWidth - 32, y + 3.5, 28, 7, 1.5, 1.5, 'FD');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text(payText, margin + contentWidth - 18, y + 8, { align: 'center' });

    y += 22;

    // --- FINANCIAL DETAILS (IF ENABLED) ---
    if (showSalesPrice && order.resalePrice > 0) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

      const col3 = contentWidth / 3;

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Preço Total Combinado:', margin + 4, y + 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text(formatKz(order.resalePrice), margin + 4, y + 12);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Valor Já Pago:', margin + col3 + 4, y + 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(formatKz(order.amountPaid), margin + col3 + 4, y + 12);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('Saldo Pendente:', margin + col3 * 2 + 4, y + 6);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(order.amountPending > 0 ? 225 : 100, order.amountPending > 0 ? 29 : 116, order.amountPending > 0 ? 72 : 139);
      doc.text(formatKz(order.amountPending), margin + col3 * 2 + 4, y + 12);

      y += 22;
    }

    // --- STATUS & QR CODE SECTION ---
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(219, 234, 254);
    doc.roundedRect(margin, y, contentWidth, 54, 3, 3, 'FD');

    const statusConfig = getStatusConfig(order.status);

    // Left info
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('Estado Atual da Encomenda:', margin + 6, y + 12);

    // Status Blue Badge
    doc.setFillColor(37, 99, 235);
    doc.roundedRect(margin + 6, y + 16, 60, 10, 2, 2, 'F');
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(statusConfig.label, margin + 36, y + 22.5, { align: 'center' });

    // Delivery Estimate
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Previsão de Entrega:', margin + 6, y + 34);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(8, 75, 138);
    doc.text(order.estimatedDeliveryDate || 'A confirmar com a vendedora', margin + 42, y + 34);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Aponte a câmara do telemóvel para o QR Code ao lado para', margin + 6, y + 42);
    doc.text('acompanhar as atualizações em tempo real a qualquer momento.', margin + 6, y + 46);

    // Right QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', pageWidth - margin - 46, y + 4, 40, 40);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('Escanear para Acompanhar', pageWidth - margin - 26, y + 47, { align: 'center' });
    }

    y += 60;

    // --- FOOTER BRANDING ---
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(8, 75, 138);
    doc.text('✓ Compra acompanhada com transparência pela DELFILÂNDIA', pageWidth / 2, y, { align: 'center' });

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Acompanhe cada etapa da sua encomenda, desde a confirmação do pagamento até à entrega local em Angola.', pageWidth / 2, y + 4.5, { align: 'center' });

    // Save PDF
    const filename = `Comprovativo-${order.code}-${(order.clientName || 'Cliente').replace(/\s+/g, '_')}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.error('Error generating client receipt PDF:', err);
    return false;
  }
}

/**
 * Generates and downloads the Official Shipping Label as a clean vector PDF.
 */
export async function downloadShippingLabelPdf(order: Order): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [100, 140], // Standard shipping label format
    });

    const trackingUrl = getPublicTrackingUrl(order.code);
    const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
      margin: 1,
      width: 240,
      color: { dark: '#000000', light: '#ffffff' },
    });

    let logoDataUrl = '';
    try {
      logoDataUrl = await getImageDataUrl(DELFILANDIA_LOGO_SRC);
    } catch {
      // Ignore
    }

    const margin = 5;
    const width = 100 - margin * 2;
    let y = 5;

    // Outer Border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.roundedRect(margin, y, width, 130, 3, 3, 'S');

    // Header Box
    y += 2;
    if (logoDataUrl) {
      try {
        doc.addImage(logoDataUrl, 'PNG', margin + 3, y + 1, 14, 14);
      } catch {
        // Ignore
      }
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(8, 75, 138);
    doc.text('DELFI', margin + 19, y + 6);
    const dW = doc.getTextWidth('DELFI');
    doc.setTextColor(234, 118, 23);
    doc.text('LÂNDIA', margin + 19 + dW, y + 6);

    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('ETIQUETA DE ENTREGA LOCAL EM ANGOLA', margin + 19, y + 11);

    // Code Tag
    doc.setFillColor(0, 0, 0);
    doc.roundedRect(margin + width - 32, y + 2, 30, 9, 1.5, 1.5, 'F');
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(order.code, margin + width - 17, y + 8, { align: 'center' });

    y += 16;
    doc.setLineWidth(0.4);
    doc.line(margin + 2, y, margin + width - 2, y);

    // DESTINATÁRIO
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('DESTINATÁRIO:', margin + 4, y);

    y += 5;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(order.clientName || 'Cliente DELFILÂNDIA', margin + 4, y);

    y += 5;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text(`Tel: ${order.clientPhone || 'Não especificado'}`, margin + 4, y);

    y += 5;
    doc.setLineWidth(0.2);
    doc.setDrawColor(200, 200, 200);
    doc.line(margin + 2, y, margin + width - 2, y);

    // LOCAL DE ENTREGA
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('LOCAL DE ENTREGA:', margin + 4, y);

    y += 4.5;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 2, y, width - 4, 18, 1.5, 1.5, 'F');

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${order.clientDistrict || 'Luanda'} — ${order.clientProvince || 'Luanda'}`, margin + 4, y + 5);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const fullAddr = order.referencePoint
      ? `${order.clientAddress || ''} (Ref: ${order.referencePoint})`
      : order.clientAddress || 'Conforme acordado';
    const splitAddr = doc.splitTextToSize(fullAddr, width - 10);
    doc.text(splitAddr, margin + 4, y + 10);

    y += 22;

    // CONTEÚDO & QR CODE
    doc.setLineWidth(0.2);
    doc.line(margin + 2, y, margin + width - 2, y);

    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text('CONTEÚDO / PRODUTO:', margin + 4, y);

    y += 4.5;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    const splitProdName = doc.splitTextToSize(order.productName || 'Artigo', width - 40);
    doc.text(splitProdName, margin + 4, y);

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`Qtd: ${order.quantity || 1} item(s)`, margin + 4, y + 9);
    doc.text(`Prev: ${order.estimatedDeliveryDate || 'A confirmar'}`, margin + 4, y + 14);

    // QR Code
    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', margin + width - 32, y - 4, 30, 30);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Rastreio QR', margin + width - 17, y + 28, { align: 'center' });
    }

    const filename = `Etiqueta-${order.code}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.error('Error generating shipping label PDF:', err);
    return false;
  }
}

/**
 * Generates and downloads the Official Internal Admin Receipt as a clean vector PDF.
 */
export async function downloadInternalReceiptPdf(order: Order): Promise<boolean> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const statusConfig = getStatusConfig(order.status);
    const deliveryCost = order.deliveryCost ?? 0;
    const otherCosts = order.otherCosts ?? 0;
    const totalInternalCosts = order.purchaseCost + deliveryCost + otherCosts;
    const grossProfit = order.grossProfit ?? (order.resalePrice - order.purchaseCost);
    const netProfit = order.netProfit ?? (order.resalePrice - totalInternalCosts);
    const marginPercent = order.resalePrice > 0 ? (netProfit / order.resalePrice) * 100 : 0;

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    let y = 14;

    // Header Red Warning Box
    doc.setFillColor(255, 241, 242);
    doc.setDrawColor(244, 63, 94);
    doc.setLineWidth(0.6);
    doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(159, 18, 57);
    doc.text('🔒 CONFIDENCIAL — DEMONSTRATIVO FINANCEIRO INTERNO', margin + 4, y + 8);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(190, 18, 60);
    doc.text('Apenas para controlo da vendedora/administração. Proibido fornecer ao cliente.', margin + 4, y + 14);

    doc.setFontSize(11);
    doc.setFont('courier', 'bold');
    doc.text(order.code, pageWidth - margin - 4, y + 11, { align: 'right' });

    y += 24;

    // Info Grid
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, y, contentWidth, 22, 2, 2, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('CLIENTE:', margin + 4, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${order.clientName} (${order.clientPhone})`, margin + 4, y + 12);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`${order.clientProvince || 'Luanda'}, ${order.clientDistrict || ''}`, margin + 4, y + 18);

    const colW = contentWidth / 2;
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('ARTIGO & ESTADO:', margin + colW + 4, y + 6);
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(`${order.productName} (${order.quantity} un)`, margin + colW + 4, y + 12);
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Estado: ${statusConfig.label}`, margin + colW + 4, y + 18);

    y += 28;

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(51, 65, 85);
    doc.text('ITEM FINANCEIRO', margin + 4, y + 5);
    doc.text('VALOR', pageWidth - margin - 4, y + 5, { align: 'right' });

    y += 7;

    const rows = [
      ['Preço Cobrado ao Cliente (Venda)', formatKz(order.resalePrice), [15, 23, 42], true],
      ['Valor Efetivamente Recebido', formatKz(order.amountPaid), [16, 185, 129], false],
      ['Saldo em Falta / Pendente', formatKz(order.amountPending), order.amountPending > 0 ? [225, 29, 72] : [100, 116, 139], false],
      ['Custo de Compra Local do Produto', formatKz(order.purchaseCost), [217, 119, 6], false],
      ['Local de Compra do Artigo', order.purchaseLocation || 'Não especificado', [71, 85, 105], false],
      ['Custos de Envio / Entrega', formatKz(deliveryCost), [71, 85, 105], false],
      ['Outras Despesas Operacionais', formatKz(otherCosts), [71, 85, 105], false],
      ['Total de Custos & Despesas', formatKz(totalInternalCosts), [159, 18, 57], true],
      ['LUCRO BRUTO', formatKz(grossProfit), [8, 75, 138], true],
      ['LUCRO LÍQUIDO FINAL', `${formatKz(netProfit)} (${marginPercent.toFixed(1)}% Margem)`, [16, 185, 129], true],
    ] as const;

    rows.forEach(([label, val, rgb, isBold], i) => {
      const isAlt = i % 2 === 1;
      if (isAlt) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin, y, contentWidth, 7, 'F');
      }
      doc.setFont('helvetica', isBold ? 'bold' : 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      doc.text(label, margin + 4, y + 5);

      doc.setTextColor(rgb[0], rgb[1], rgb[2]);
      doc.text(val, pageWidth - margin - 4, y + 5, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);
      y += 7;
    });

    if (order.adminNotes) {
      y += 6;
      doc.setFillColor(254, 252, 232);
      doc.setDrawColor(254, 240, 138);
      doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(133, 77, 14);
      doc.text('NOTAS INTERNAS:', margin + 4, y + 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(113, 63, 18);
      const splitNotes = doc.splitTextToSize(order.adminNotes, contentWidth - 8);
      doc.text(splitNotes, margin + 4, y + 12);
      y += 24;
    }

    const filename = `Comprovativo-Interno-${order.code}.pdf`;
    doc.save(filename);
    return true;
  } catch (err) {
    console.error('Error generating internal receipt PDF:', err);
    return false;
  }
}

/**
 * Builds printable HTML for the Client Receipt and triggers print.
 */
export async function printClientReceipt(order: Order, showSalesPrice: boolean = false): Promise<void> {
  const trackingUrl = getPublicTrackingUrl(order.code);
  const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
    margin: 1,
    width: 220,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const statusConfig = getStatusConfig(order.status);

  const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Comprovativo-${order.code}-DELFILANDIA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      padding: 20px;
    }
    .no-print-bar {
      max-width: 680px;
      margin: 0 auto 16px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: white;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
    }
    .btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 6px 14px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      font-size: 12px;
    }
    .btn-close {
      background: #475569;
      margin-left: 8px;
    }
    .card {
      max-width: 680px;
      margin: 0 auto;
      background: white;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #084b8a;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .brand-delfi { color: #084b8a; }
    .brand-landia { color: #ea7617; }
    .brand-slogan {
      font-size: 10px;
      font-weight: 800;
      color: #ea7617;
      margin-top: 2px;
    }
    .brand-sub {
      font-size: 11px;
      color: #64748b;
      margin-top: 3px;
    }
    .code-box {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 8px 14px;
      border-radius: 8px;
      text-align: right;
    }
    .code-label { font-size: 9px; font-weight: bold; color: #3b82f6; text-transform: uppercase; }
    .code-val { font-family: monospace; font-size: 16px; font-weight: 900; color: #084b8a; }
    .code-date { font-size: 9px; color: #64748b; }
    .section-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 14px;
      margin-bottom: 16px;
    }
    .sec-label { font-size: 10px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
    .sec-val { font-size: 13px; font-weight: bold; color: #0f172a; }
    .sec-sub { font-size: 11px; color: #475569; margin-top: 2px; }
    .table-box {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 16px;
    }
    .table-head {
      display: flex;
      justify-content: space-between;
      background: #f1f5f9;
      padding: 8px 14px;
      font-size: 10px;
      font-weight: bold;
      color: #475569;
      border-bottom: 1px solid #e2e8f0;
    }
    .table-body {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 14px;
    }
    .pill {
      background: #eff6ff;
      color: #2563eb;
      font-size: 10px;
      font-weight: bold;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid #bfdbfe;
    }
    .status-card {
      border: 1px solid #dbeafe;
      background: #ffffff;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 18px;
    }
    .status-pill {
      display: inline-block;
      background: #2563eb;
      color: white;
      font-weight: bold;
      font-size: 12px;
      padding: 6px 14px;
      border-radius: 8px;
      margin: 6px 0;
    }
    .footer {
      text-align: center;
      border-top: 1px dashed #cbd5e1;
      padding-top: 14px;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { background: white !important; padding: 0 !important; }
      .no-print-bar { display: none !important; }
      .card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>Comprovativo Oficial DELFILÂNDIA - <strong>${order.code}</strong></span>
    <div>
      <button class="btn" onclick="window.print()">🖨️ Imprimir Documento</button>
      <button class="btn btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div class="card">
    <div class="header">
      <div>
        <div class="brand-title">
          <span class="brand-delfi">DELFI</span><span class="brand-landia">LÂNDIA</span>
        </div>
        <div class="brand-slogan">UM MUNDO DE PRODUTOS À SUA PORTA</div>
        <div class="brand-sub">Comprovativo de Registo e Acompanhamento Transparente</div>
      </div>
      <div class="code-box">
        <div class="code-label">Código do Pedido</div>
        <div class="code-val">${order.code}</div>
        <div class="code-date">Emitido em: ${formatDatePT(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="section-grid">
      <div>
        <div class="sec-label">Cliente Destinatário</div>
        <div class="sec-val">${order.clientName || 'Cliente DELFILÂNDIA'}</div>
        <div class="sec-sub">Telefone: ${order.clientPhone || 'Não especificado'}</div>
      </div>
      <div>
        <div class="sec-label">Local de Entrega em Angola</div>
        <div class="sec-val">${order.clientDistrict || 'Luanda'}, ${order.clientProvince || 'Luanda'}</div>
        <div class="sec-sub">${order.clientAddress || 'Conforme acordado'}${order.referencePoint ? ' (Ref: ' + order.referencePoint + ')' : ''}</div>
      </div>
    </div>

    <div class="table-box">
      <div class="table-head">
        <span>DESCRIÇÃO DO PRODUTO</span>
        <span>QTD</span>
        <span>ESTADO DO PAGAMENTO</span>
      </div>
      <div class="table-body">
        <span style="font-weight:bold; font-size:13px;">${order.productName || 'Artigo'}</span>
        <span style="font-weight:bold; font-size:13px;">${order.quantity || 1}</span>
        <span class="pill">${order.paymentStatus || 'CONFIRMADO'}</span>
      </div>
    </div>

    ${showSalesPrice && order.resalePrice > 0 ? `
    <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:12px; margin-bottom:16px;">
      <div>
        <div style="font-size:10px; color:#64748b;">Preço Combinado</div>
        <div style="font-weight:bold; font-size:13px;">${formatKz(order.resalePrice)}</div>
      </div>
      <div>
        <div style="font-size:10px; color:#64748b;">Valor Pago</div>
        <div style="font-weight:bold; font-size:13px; color:#10b981;">${formatKz(order.amountPaid)}</div>
      </div>
      <div>
        <div style="font-size:10px; color:#64748b;">Saldo Pendente</div>
        <div style="font-weight:bold; font-size:13px; color:${order.amountPending > 0 ? '#e11d48' : '#64748b'};">${formatKz(order.amountPending)}</div>
      </div>
    </div>
    ` : ''}

    <div class="status-card">
      <div>
        <div style="font-size:11px; font-weight:bold; color:#475569;">Estado Atual da Encomenda:</div>
        <div class="status-pill">${statusConfig.label}</div>
        <div style="font-size:12px; color:#334155; margin-top:4px;">
          <strong>Previsão de Entrega:</strong> ${order.estimatedDeliveryDate || 'A confirmar com a vendedora'}
        </div>
        <div style="font-size:10px; color:#64748b; margin-top:6px;">
          Aponte a câmara do telemóvel para o QR Code para acompanhar atualizações em tempo real.
        </div>
      </div>
      <div style="text-align:center;">
        <img src="${qrDataUrl}" alt="QR Code" style="width:110px; height:110px; display:block; border-radius:8px;" />
        <span style="font-size:9px; font-weight:bold; color:#475569;">Escanear para Rastrear</span>
      </div>
    </div>

    <div class="footer">
      <strong style="color:#084b8a;">✓ Compra acompanhada com transparência pela DELFILÂNDIA</strong><br />
      Acompanhe cada etapa da sua encomenda, desde a confirmação do pagamento até à entrega local em Angola.
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
`;

  openPrintableWindow(html, () => downloadClientReceiptPdf(order, showSalesPrice));
}

/**
 * Builds printable HTML for the Shipping Label and triggers print.
 */
export async function printShippingLabel(order: Order): Promise<void> {
  const trackingUrl = getPublicTrackingUrl(order.code);
  const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
    margin: 1,
    width: 180,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Etiqueta-${order.code}-DELFILANDIA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      padding: 16px;
      color: #000;
    }
    .no-print-bar {
      max-width: 420px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #0f172a;
      color: white;
      padding: 8px 14px;
      border-radius: 10px;
      font-size: 12px;
    }
    .btn {
      background: #2563eb;
      color: white;
      border: none;
      padding: 5px 12px;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      font-size: 11px;
    }
    .btn-close { background: #475569; margin-left: 6px; }
    .label-card {
      max-width: 400px;
      margin: 0 auto;
      background: white;
      border: 2px solid #000;
      border-radius: 14px;
      padding: 18px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
      margin-bottom: 12px;
    }
    .brand-delfi { font-weight: 900; font-size: 18px; color: #084b8a; }
    .brand-landia { font-weight: 900; font-size: 18px; color: #ea7617; }
    .code-tag {
      background: #000;
      color: #fff;
      font-family: monospace;
      font-weight: bold;
      font-size: 14px;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .sec { margin-bottom: 10px; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; }
    .sec:last-child { border-bottom: none; }
    .label-title { font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase; margin-bottom: 3px; }
    .client-name { font-size: 16px; font-weight: 900; color: #000; }
    .client-phone { font-size: 12px; font-weight: bold; margin-top: 2px; }
    .loc-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      padding: 8px 10px;
      border-radius: 8px;
      margin-top: 4px;
    }
    .loc-title { font-size: 13px; font-weight: bold; }
    .loc-sub { font-size: 11px; color: #475569; }
    .prod-grid {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      body { background: white !important; padding: 0 !important; }
      .no-print-bar { display: none !important; }
      .label-card { border: 2px solid #000 !important; box-shadow: none !important; }
      @page { margin: 6mm; size: auto; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>Etiqueta de Envio - <strong>${order.code}</strong></span>
    <div>
      <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div class="label-card">
    <div class="header">
      <div>
        <span class="brand-delfi">DELFI</span><span class="brand-landia">LÂNDIA</span>
        <div style="font-size:8px; font-weight:bold; text-transform:uppercase; color:#475569;">Etiqueta de Entrega Local</div>
      </div>
      <div class="code-tag">${order.code}</div>
    </div>

    <div class="sec">
      <div class="label-title">Destinatário:</div>
      <div class="client-name">${order.clientName || 'Cliente'}</div>
      <div class="client-phone">📞 ${order.clientPhone || 'Sem telefone'}</div>
    </div>

    <div class="sec">
      <div class="label-title">Local de Entrega:</div>
      <div class="loc-box">
        <div class="loc-title">📍 ${order.clientDistrict || 'Luanda'} — ${order.clientProvince || 'Luanda'}</div>
        <div class="loc-sub">${order.clientAddress || 'Conforme acordado'}${order.referencePoint ? ' (Ref: ' + order.referencePoint + ')' : ''}</div>
      </div>
    </div>

    <div class="sec prod-grid">
      <div>
        <div class="label-title">Conteúdo / Produto:</div>
        <div style="font-size:12px; font-weight:bold;">${order.productName || 'Artigo'}</div>
        <div style="font-size:11px; color:#475569; margin-top:2px;">Qtd: <strong>${order.quantity || 1} item(s)</strong></div>
        <div style="font-size:10px; color:#64748b; margin-top:2px;">Prev: <strong>${order.estimatedDeliveryDate || 'A confirmar'}</strong></div>
      </div>
      <div style="text-align:center;">
        <img src="${qrDataUrl}" alt="QR" style="width:85px; height:85px; display:block;" />
        <span style="font-size:8px; font-weight:bold;">Rastreio QR</span>
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 400);
    };
  </script>
</body>
</html>
`;

  openPrintableWindow(html, () => downloadShippingLabelPdf(order));
}

/**
 * Builds printable HTML for the Internal Admin Receipt and triggers print.
 */
export async function printInternalReceipt(order: Order): Promise<void> {
  const statusConfig = getStatusConfig(order.status);
  const deliveryCost = order.deliveryCost ?? 0;
  const otherCosts = order.otherCosts ?? 0;
  const totalInternalCosts = order.purchaseCost + deliveryCost + otherCosts;
  const netProfit = order.netProfit ?? (order.resalePrice - totalInternalCosts);
  const marginPercent = order.resalePrice > 0 ? (netProfit / order.resalePrice) * 100 : 0;

  const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>Interno-${order.code}-DELFILANDIA</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 20px; color: #0f172a; }
    .no-print-bar { max-width: 680px; margin: 0 auto 14px auto; display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: white; padding: 10px 16px; border-radius: 12px; font-size: 13px; }
    .btn { background: #e11d48; color: white; border: none; padding: 6px 14px; border-radius: 8px; font-weight: bold; cursor: pointer; font-size: 12px; }
    .btn-close { background: #475569; margin-left: 8px; }
    .card { max-width: 680px; margin: 0 auto; background: white; border: 1px solid #cbd5e1; border-radius: 16px; padding: 24px; }
    .warn-header { background: #ffe4e6; border: 1px solid #fda4af; padding: 12px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; color: #9f1239; font-weight: bold; font-size: 12px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; background: #f8fafc; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 16px; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f1f5f9; font-weight: bold; }
    .num { text-align: right; font-weight: bold; font-family: monospace; font-size: 13px; }
    .total-row { background: #f0fdf4; font-weight: 900; font-size: 14px; color: #16a34a; }
    @media print {
      body { background: white !important; padding: 0 !important; }
      .no-print-bar { display: none !important; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>Comprovativo Interno (Admin) - <strong>${order.code}</strong></span>
    <div>
      <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div class="card">
    <div class="warn-header">
      <span>🔒 CONFIDENCIAL — DEMONSTRATIVO FINANCEIRO INTERNO</span>
      <span style="font-family:monospace; font-size:14px;">${order.code}</span>
    </div>

    <div class="grid-2">
      <div>
        <div style="font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase;">Cliente</div>
        <div style="font-weight:bold; font-size:13px;">${order.clientName} (${order.clientPhone})</div>
        <div style="color:#64748b;">${order.clientProvince}, ${order.clientDistrict || ''}</div>
      </div>
      <div>
        <div style="font-size:10px; color:#64748b; font-weight:bold; text-transform:uppercase;">Produto</div>
        <div style="font-weight:bold; font-size:13px;">${order.productName} (${order.quantity} un)</div>
        <div style="color:#64748b;">Estado: ${statusConfig.label}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item Financeiro</th>
          <th style="text-align:right;">Valor</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>Preço de Venda ao Cliente</td><td class="num">${formatKz(order.resalePrice)}</td></tr>
        <tr><td>Valor Pago pelo Cliente</td><td class="num" style="color:#10b981;">${formatKz(order.amountPaid)}</td></tr>
        <tr><td>Saldo Pendente do Cliente</td><td class="num" style="color:${order.amountPending > 0 ? '#e11d48' : '#64748b'};">${formatKz(order.amountPending)}</td></tr>
        <tr><td>Custo de Compra Local</td><td class="num" style="color:#d97706;">${formatKz(order.purchaseCost)}</td></tr>
        <tr><td>Local de Compra</td><td style="text-align:right; font-size:12px;">${order.purchaseLocation || 'Não especificado'}</td></tr>
        <tr><td>Custos de Envio / Entrega</td><td class="num">${formatKz(deliveryCost)}</td></tr>
        <tr><td>Outras Despesas</td><td class="num">${formatKz(otherCosts)}</td></tr>
        <tr style="background:#f8fafc; font-weight:bold;"><td>Total de Custos Operacionais</td><td class="num" style="color:#e11d48;">${formatKz(totalInternalCosts)}</td></tr>
        <tr class="total-row"><td>LUCRO LÍQUIDO FINAL</td><td class="num">${formatKz(netProfit)} (${marginPercent.toFixed(1)}%)</td></tr>
      </tbody>
    </table>

    ${order.adminNotes ? `
    <div style="background:#fefce8; border:1px solid #fef08a; padding:12px; border-radius:10px; font-size:11px; color:#713f12;">
      <strong>Notas Internas da Vendedora:</strong> ${order.adminNotes}
    </div>
    ` : ''}
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  </script>
</body>
</html>
`;

  openPrintableWindow(html, () => downloadInternalReceiptPdf(order));
}

/**
 * Builds printable HTML for the QR Code tracking card.
 */
export async function printQrCard(order: Order): Promise<void> {
  const trackingUrl = getPublicTrackingUrl(order.code);
  const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
    margin: 1,
    width: 260,
    color: { dark: '#0f172a', light: '#ffffff' },
  });

  const html = `
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <title>QRCode-Rastreio-${order.code}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; padding: 20px; text-align: center; }
    .no-print-bar { max-width: 360px; margin: 0 auto 16px auto; display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: white; padding: 8px 14px; border-radius: 10px; font-size: 12px; }
    .btn { background: #2563eb; color: white; border: none; padding: 5px 12px; border-radius: 6px; font-weight: bold; cursor: pointer; }
    .btn-close { background: #475569; margin-left: 6px; }
    .qr-card { max-width: 360px; margin: 0 auto; background: white; border: 2px solid #3b82f6; border-radius: 16px; padding: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .brand { font-size: 18px; font-weight: 900; margin-bottom: 12px; }
    .delfi { color: #084b8a; }
    .landia { color: #ea7617; }
    .code { font-family: monospace; font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 10px; }
    .client { font-size: 13px; font-weight: bold; color: #334155; margin-top: 8px; }
    .url { font-size: 10px; color: #64748b; margin-top: 4px; word-break: break-all; }
    @media print {
      body { background: white !important; padding: 0 !important; }
      .no-print-bar { display: none !important; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <span>QR Code - <strong>${order.code}</strong></span>
    <div>
      <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
      <button class="btn btn-close" onclick="window.close()">Fechar</button>
    </div>
  </div>

  <div class="qr-card">
    <div class="brand">
      <span class="delfi">DELFI</span><span class="landia">LÂNDIA</span>
      <div style="font-size:9px; color:#ea7617; font-weight:bold;">UM MUNDO DE PRODUTOS À SUA PORTA</div>
    </div>

    <img src="${qrDataUrl}" alt="QR" style="width:200px; height:200px; margin:0 auto; display:block;" />
    
    <div class="code">CÓDIGO: ${order.code}</div>
    <div class="client">Cliente: ${order.clientName || 'Cliente'}</div>
    <div class="url">${trackingUrl}</div>
  </div>

  <script>
    window.onload = function() { setTimeout(function() { window.print(); }, 400); };
  </script>
</body>
</html>
`;

  openPrintableWindow(html, () => downloadShippingLabelPdf(order));
}

/**
 * Robust window opening helper that falls back to PDF download if popup blocked.
 */
function openPrintableWindow(htmlContent: string, fallbackPdfGenerator: () => Promise<boolean>): void {
  try {
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);

    const printWin = window.open(blobUrl, '_blank');
    if (printWin) {
      printWin.focus();
      return;
    }
  } catch (e) {
    console.warn('window.open failed, trying fallback iframe/PDF:', e);
  }

  // If window.open is blocked or fails inside iframe sandbox, try creating an iframe print
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('title', 'Impressão');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(htmlContent);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch {
          // If printing fails, generate PDF
          fallbackPdfGenerator();
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 3000);
        }
      }, 500);
      return;
    }
  } catch {
    // Fallback directly to downloading the PDF
    fallbackPdfGenerator();
  }
}
