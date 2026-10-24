export function normalizeMoney(value) {
  if (value === null || value === undefined) return 0;
  let s = String(value).trim().replace(/R\$/gi, '').replace(/\s/g, '');
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) s = s.replace(/\./g, '').replace(',', '.');
  else if (hasComma) s = s.replace(',', '.');
  const n = Number(s.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}

function detectCategory(text) {
  const t = text.toLowerCase();
  const groups = [
    ['Mercado',['mercado','supermercado','atacadao','atacadão','alimentação','alimentacao']],
    ['Combustível',['combustível','combustivel','gasolina','etanol','diesel','posto']],
    ['Restaurante',['restaurante','lanche','ifood','pizza','hamburguer','hambúrguer']],
    ['Casa',['aluguel','energia','luz','água','agua','internet','condomínio','condominio']],
    ['Saúde',['farmácia','farmacia','médico','medico','consulta','remédio','remedio']],
    ['Transporte',['uber','99','taxi','táxi','estacionamento','pedágio','pedagio']],
    ['Lazer',['cinema','bar','show','lazer','viagem']],
    ['Filho',['escola','creche','fralda','brinquedo']],
    ['Trabalho',['obra','material','ferramenta','serviço','servico']],
    ['Renda',['recebi','salário','salario','pagamento','entrada','cliente']]
  ];
  for (const [name, keys] of groups) if (keys.some(k=>t.includes(k))) return name;
  return 'Outros';
}

function detectAccount(text) {
  const t = text.toLowerCase();
  const checks = [
    ['Nubank',/\bnubank\b|\bnu\b/],['Inter',/\binter\b/],['Itaú',/\bita[uú]\b/],
    ['Bradesco',/\bbradesco\b/],['Santander',/\bsantander\b/],['CAIXA',/\bcaixa\b/],
    ['Banco do Brasil',/banco do brasil|\bbb\b/],['C6 Bank',/\bc6\b/],['PicPay',/\bpicpay\b/],
    ['Mercado Pago',/mercado pago/],['PIX',/\bpix\b/],['Dinheiro',/\bdinheiro\b|\besp[eé]cie\b/]
  ];
  for (const [name,re] of checks) if (re.test(t)) return name;
  return 'Não informado';
}

function extractAmount(raw) {
  const matches = [...raw.matchAll(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})|\d+(?:[.,]\d{1,2})?)/gi)];
  for (const m of matches) {
    const after = raw.slice((m.index ?? 0) + m[0].length).trimStart();
    if (/^x\b/i.test(after)) continue;
    const amount = normalizeMoney(m[1]);
    if (amount > 0) return amount;
  }
  return 0;
}

export function parseNaturalTransaction(raw) {
  const original = String(raw ?? '').trim();
  if (!original) return { error: 'Digite um lançamento.' };
  const amount = extractAmount(original);
  if (!(amount > 0)) return { error: 'Não encontrei o valor.' };
  const t = original.toLowerCase();
  const kind = /(recebi|sal[aá]rio|entrada|ganhei|pagamento recebido|caiu na conta)/i.test(t) ? 'income' : 'expense';
  const installmentMatch = t.match(/(?:em\s*)?(\d+)\s*x\b/i);
  let installments = kind === 'expense' && installmentMatch ? Number(installmentMatch[1]) : 1;
  if (!Number.isInteger(installments) || installments < 1 || installments > 120) installments = 1;
  return {
    kind,
    amount,
    installments,
    category: detectCategory(original),
    account: detectAccount(original),
    description: original.slice(0,500)
  };
}

export function splitInstallments(amount, count) {
  const n = Math.max(1, Math.trunc(count || 1));
  const cents = Math.round(Number(amount) * 100);
  const base = Math.floor(cents / n);
  const extra = cents - base * n;
  return Array.from({length:n},(_,i)=>(base + (i < extra ? 1 : 0))/100);
}

export function addMonthsClamped(isoDate, offset) {
  const [y,m,d] = String(isoDate).split('-').map(Number);
  const target = new Date(y, m-1 + Number(offset || 0), 1);
  const last = new Date(target.getFullYear(), target.getMonth()+1, 0).getDate();
  const day = Math.min(d, last);
  return `${target.getFullYear()}-${String(target.getMonth()+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

export function budgetStatus(expense, budget, now = new Date()) {
  const b = Number(budget || 0);
  if (!(b > 0)) return {tone:'neutral',label:'Configure o orçamento',hint:'Defina um limite mensal para acompanhar o ritmo.'};
  const e = Number(expense || 0);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const spendRatio = e / b;
  const timeRatio = now.getDate() / last;
  if (spendRatio < timeRatio * 0.9) return {tone:'success',label:'Tranquilo',hint:'O gasto está abaixo do ritmo do mês.'};
  if (spendRatio < Math.min(1, timeRatio * 1.2)) return {tone:'warning',label:'Atenção',hint:'O gasto está perto ou acima do ritmo esperado.'};
  return {tone:'danger',label:'Frear gastos',hint:'O gasto está avançando mais rápido que o mês.'};
}

export function computeDashboard(transactions, settings = {}, now = new Date()) {
  const mk = monthKey(now);
  const current = transactions.filter(t => !t.deleted_at && String(t.occurred_on).slice(0,7) === mk);
  const income = current.filter(t=>t.kind==='income').reduce((s,t)=>s+Number(t.amount||0),0);
  const expense = current.filter(t=>t.kind==='expense').reduce((s,t)=>s+Number(t.amount||0),0);
  const planned = Math.max(Number(settings.monthly_income||0), income);
  const reserve = Number(settings.protected_reserve||0);
  const freeMoney = Math.max(0, planned - expense - reserve);
  const last = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const remainingDays = Math.max(1, last - now.getDate() + 1);
  return {
    current,
    income,
    expense,
    planned,
    reserve,
    freeMoney,
    remainingDays,
    dailySafe: freeMoney / remainingDays,
    status: budgetStatus(expense, settings.monthly_budget, now),
    budgetRatio: Number(settings.monthly_budget||0) > 0 ? expense / Number(settings.monthly_budget) : 0
  };
}

export function filterTransactions(transactions, filters = {}) {
  const q = String(filters.query||'').trim().toLowerCase();
  const kind = filters.kind || 'all';
  const month = filters.month || '';
  const category = filters.category || 'all';
  return transactions.filter(t => {
    if (t.deleted_at) return false;
    if (kind !== 'all' && t.kind !== kind) return false;
    if (month && String(t.occurred_on).slice(0,7) !== month) return false;
    if (category !== 'all' && (t.category||'Outros') !== category) return false;
    if (q) {
      const hay = `${t.description||''} ${t.category||''} ${t.account||''} ${t.created_by_name||''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export function summarizeBy(transactions, field) {
  const sums = new Map();
  for (const t of transactions) {
    if (t.deleted_at || t.kind !== 'expense') continue;
    const key = t[field] || 'Não informado';
    sums.set(key, (sums.get(key)||0) + Number(t.amount||0));
  }
  return [...sums.entries()].sort((a,b)=>b[1]-a[1]);
}
