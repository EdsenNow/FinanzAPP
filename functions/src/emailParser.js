const spamMarketingRegex = /(estado de cuenta|extracto|resumen de cuenta|resumen de saldo|balance de cuenta|balance mensual|informe de cuenta|estado de tarjeta|resumen mensual|alerta de inicio de sesi[oó]n|intento de acceso|cambio de contrase[nñ]a|empleo|vacante|postula|bolet[ií]n|newsletter|publicidad|descuento|ofert|promoci[oó]n|suscr[ií]bete|unsubscribe|darse de baja|ver en navegador|tienes hamb|lugares nuevos|soluciones|ahorro\s*🎨|bolsa de trabajo|linkedIn|glassdoor|indeed|career|hiring|trabajo|pide tu s[uú]per|como pides tu comida|c[oó]digo de verificaci[oó]n|verificar tu correo|clave temporal|otp|security code)/i;
const bankTxnKeywords = /(monto|importe|cargo|compra|consumo|d[eé]bito|debito|pago|transacci[oó]n|recibo|factura|viaje|transferencia|notificaci[oó]n|alerta|aprobada|banco|bhd|popular|banreservas|scotiabank|visa|mastercard|paypal|stripe|voucher)/i;
const STATUS_WORDS = /^(estatus|estado|aprobad|declinad|pendiente|procesad|exitosa|fallid|rechazad)/i;
const declinedPatterns = [
  /declinad/, /rechazad/, /denegad/, /no\s+aprobad/, /transaccion\s+fallid/,
  /operacion\s+fallid/, /no\s+procesad/, /error\s+en\s+la\s+transaccion/
];
const incomePatterns = [
  /abono/, /deposito/, /acreditad/, /acreditacion/, /ingreso/, /nomina/,
  /transferencia\s+recibid/, /transferencia\s+entrante/, /reembolso/, /devolucion/
];
const expensePatterns = [
  /consumo/, /compra/, /cargo/, /debito/, /débito/, /retiro/, /pago/,
  /transferencia\s+enviad/, /transferencia\s+saliente/
];

function normalizeText(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isDeclined(text) {
  const t = normalizeText(text);
  return declinedPatterns.some((p) => p.test(t));
}

function detectTransactionType(text) {
  const t = normalizeText(text);
  const incomeScore = incomePatterns.reduce((acc, p) => acc + (p.test(t) ? 1 : 0), 0);
  const expenseScore = expensePatterns.reduce((acc, p) => acc + (p.test(t) ? 1 : 0), 0);
  return incomeScore > expenseScore ? 'income' : 'expense';
}

function parseNumericAmount(value) {
  let raw = String(value || '').trim().replace(/\s/g, '');
  if (!raw) return null;
  if (/,\d{1,4}$/.test(raw)) {
    raw = raw.replace(/\./g, '').replace(',', '.');
  } else {
    raw = raw.replace(/,/g, '');
  }
  const n = parseFloat(raw);
  return !isNaN(n) && n > 0 && n < 10_000_000 ? n : null;
}

function currencyFromToken(token) {
  const t = String(token || '').toUpperCase();
  if (t.includes('RD$') || t === 'DOP') return 'DOP';
  if (t.includes('US$') || t === 'USD' || t === '$') return 'USD';
  if (t === 'EUR' || t.includes('€')) return 'EUR';
  if (t === 'GBP' || t.includes('£')) return 'GBP';
  if (t === 'COP' || t.includes('COL$')) return 'COP';
  if (t === 'MXN' || t.includes('MX$')) return 'MXN';
  if (t === 'ARS') return 'ARS';
  if (t === 'CLP') return 'CLP';
  if (t === 'PEN' || t.includes('S/.')) return 'PEN';
  if (t === 'BRL' || t.includes('R$')) return 'BRL';
  return null;
}

function scoreMoneyMention(mention) {
  const before = String(mention.before || '');
  const after = String(mention.after || '');
  const beforeStart = Math.max(
    before.lastIndexOf('.'),
    before.lastIndexOf(';'),
    before.lastIndexOf('|'),
    before.lastIndexOf('\n')
  ) + 1;
  const afterEndCandidates = ['.', ';', '|', '\n']
    .map(separator => after.indexOf(separator))
    .filter(index => index >= 0);
  const afterEnd = afterEndCandidates.length ? Math.min(...afterEndCandidates) : after.length;
  const context = normalizeText(`${before.slice(beforeStart)} ${after.slice(0, afterEnd)}`);
  let score = 0;

  if (/(monto|importe|valor|cargo|compra|consumo|debito|pago|transaccion|autorizacion|realizad|aprobada|aprobado)/.test(context)) {
    score += 5;
  }
  if (/(balance|saldo|disponible|limite|credito disponible|balance disponible|saldo disponible)/.test(context)) {
    score -= 12;
  }
  if (/(tasa|tipo de cambio|comision|itbis|impuesto|fee)/.test(context)) {
    score -= 4;
  }
  if (mention.currency === 'USD' && mention.amount < 10000) {
    score += 1;
  }
  return score;
}

function parseMoneyMentions(text) {
  const mentions = [];
  const token = '(RD\\$|US\\$|COL\\$|MX\\$|R\\$|S\\/\\.|USD|DOP|EUR|GBP|COP|MXN|ARS|CLP|PEN|BRL|[$€£¥])';
  const amount = '(\\d[\\d,. ]*)';
  const patterns = [
    { regex: new RegExp(`${token}\\s*${amount}`, 'gi'), tokenIndex: 1, amountIndex: 2 },
    { regex: new RegExp(`${amount}\\s*${token}`, 'gi'), tokenIndex: 2, amountIndex: 1 }
  ];

  for (const { regex, tokenIndex, amountIndex } of patterns) {
    let match = regex.exec(text || '');
    while (match) {
      const parsedAmount = parseNumericAmount(match[amountIndex]);
      const currency = currencyFromToken(match[tokenIndex]);
      if (parsedAmount && currency) {
        const rawText = String(text || '');
        const before = rawText.slice(Math.max(0, match.index - 90), match.index);
        const after = rawText.slice(match.index + match[0].length, match.index + match[0].length + 90);
        mentions.push({ amount: parsedAmount, currency, index: match.index, before, after });
      }
      if (match[0] === '') regex.lastIndex += 1;
      match = regex.exec(text || '');
    }
  }

  return mentions
    .sort((a, b) => a.index - b.index)
    .filter((mention, index, arr) => {
      const prev = arr[index - 1];
      return !prev || prev.index !== mention.index || prev.currency !== mention.currency || prev.amount !== mention.amount;
    });
}

function parseAmountInfo(text) {
  const mentions = parseMoneyMentions(text);
  if (mentions.length) {
    const scored = mentions.map(mention => ({ ...mention, score: scoreMoneyMention(mention) }));
    const viable = scored.filter(mention => mention.score >= 0);
    const candidates = viable.length ? viable : scored;
    return candidates.sort((a, b) => b.score - a.score || a.index - b.index)[0] || mentions[0];
  }
  const m = String(text || '').match(/(?:monto|importe|valor|cargo|compra|d[eé]bito|debito|pago|transacci[oó]n)[:\s]+(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])?\s*([\d,. ]+)/i);
  if (!m) return null;
  const amount = parseNumericAmount(m[1]);
  return amount ? { amount, currency: null, index: m.index } : null;
}

function parseAmount(text) {
  const patterns = [
    /(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])\s*(\d[\d,. ]*)/i,
    /(\d[\d,. ]*)\s*(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])/i,
    /(?:monto|importe|valor|cargo|compra|débito|debito|pago|transacci[oó]n)[:\s]+(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])?\s*([\d,. ]+)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    let raw = m[1].trim().replace(/\s/g, '');
    if (/,\d{2}$/.test(raw)) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0 && n < 10_000_000) return n;
  }
  return null;
}

function parseMerchant(text) {
  const patterns = [
    /(?:localidad|comercio|merchant|establecimiento|local)[:\s]+([A-Za-z0-9 &'.,:/\-*]{2,60})/i,
    /(?:transacci[oó]n|compra|pago|cargo|consumo)\s*(?:de)?\s*(?:[A-Z]{2,4}\$|[A-Z]{3}|[$€£¥])?\s*[\d,. ]*\s*(?:en|at|por)\s+([A-Za-z0-9 &'.,:/\-*]{2,50})/i,
    /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s+([A-Za-z][A-Za-z0-9 &'.,:/\-*]{2,60?})\s+(?:aprobad|declinad|pendiente|procesad|exitosa|fallid|rechazad)/i,
    /(?:compra en|pago en|cargo en|consumo en)[:\s]+([A-Za-z0-9 &'.,:/\-*]{2,50})/i,
    /(?:en|at)\s+([A-Z][A-Za-z0-9 &'.,:/\-*]{2,50})/,
    /(?:descripci[oó]n|concepto)[:\s]+([A-Za-z0-9 &'.,:/\-*]{2,50})/i,
  ];

  for (const p of patterns) {
    const m = text.match(p);
    if (!m) continue;
    let merchant = m[1].trim();
    if (STATUS_WORDS.test(merchant)) continue;
    if (merchant.includes('*')) {
      const parts = merchant.split('*');
      if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
        merchant = parts[0].trim();
      }
    }
    if (merchant.length >= 2) return merchant;
  }
  return null;
}

function parseDate(dateHeader, body) {
  if (dateHeader) {
    const d = new Date(dateHeader);
    if (!isNaN(d.getTime())) return d;
  }
  const m1 = body.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m1) {
    const d = new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
    if (!isNaN(d.getTime())) return d;
  }
  const m2 = body.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m2) {
    const d = new Date(Number(m2[1]), Number(m2[2]) - 1, Number(m2[3]));
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * Recibe un correo con Asunto, Fecha y Texto, y extrae los datos de la transacción.
 */
function extractTransactionData(subject, dateHeader, textBody) {
  const fullText = `${subject}\n${textBody}`;

  if (spamMarketingRegex.test(subject) || spamMarketingRegex.test(fullText)) {
    return { ignored: true, reason: 'marketing/spam' };
  }

  if (!bankTxnKeywords.test(fullText)) {
    return { ignored: true, reason: 'no_bank_context' };
  }

  const isDeclinedTxn = isDeclined(fullText);

  const amountInfo = parseAmountInfo(fullText);
  let amount = amountInfo ? amountInfo.amount : parseAmount(fullText);
  if (!amount) return null;

  const description = parseMerchant(fullText) || subject;
  const date = parseDate(dateHeader, fullText);
  const type = detectTransactionType(fullText);

  return {
    amount,
    description: description.substring(0, 80),
    date,
    subject,
    type,
    status: isDeclinedTxn ? 'rejected' : 'approved',
  };
}

module.exports = {
  extractTransactionData
};
