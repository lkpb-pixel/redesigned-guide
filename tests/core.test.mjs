import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeMoney, parseNaturalTransaction, splitInstallments,
  addMonthsClamped, computeDashboard, filterTransactions, budgetStatus,
  summarizeBy, monthKey
} from '../core.mjs';

test('normalizeMoney accepts Brazilian currency formats', () => {
  assert.equal(normalizeMoney('1.234,56'), 1234.56);
  assert.equal(normalizeMoney('R$ 85,90'), 85.90);
  assert.equal(normalizeMoney('1200.50'), 1200.50);
});

test('natural parser recognizes expense, category and account', () => {
  const p = parseNaturalTransaction('gastei 85,90 no mercado no Nubank');
  assert.equal(p.kind, 'expense');
  assert.equal(p.amount, 85.90);
  assert.equal(p.category, 'Mercado');
  assert.equal(p.account, 'Nubank');
});

test('natural parser recognizes income', () => {
  const p = parseNaturalTransaction('recebi 1.500,00 de cliente no pix');
  assert.equal(p.kind, 'income');
  assert.equal(p.amount, 1500);
  assert.equal(p.account, 'PIX');
});

test('natural parser recognizes installments', () => {
  const p = parseNaturalTransaction('comprei 600 em 6x no Inter');
  assert.equal(p.installments, 6);
  assert.equal(p.amount, 600);
});

test('splitInstallments preserves total exactly in cents', () => {
  const parts = splitInstallments(100, 3);
  assert.deepEqual(parts, [33.34, 33.33, 33.33]);
  assert.equal(Math.round(parts.reduce((a,b)=>a+b,0)*100), 10000);
});

test('addMonthsClamped keeps month end safe', () => {
  assert.equal(addMonthsClamped('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonthsClamped('2026-01-31', 2), '2026-03-31');
});

test('dashboard protects reserve from spendable amount', () => {
  const tx = [
    {kind:'income', amount:5000, occurred_on:'2026-10-01'},
    {kind:'expense', amount:1200, occurred_on:'2026-10-03'}
  ];
  const d = computeDashboard(tx, {monthly_income:4000, monthly_budget:3000, protected_reserve:1000}, new Date('2026-10-10T12:00:00'));
  assert.equal(d.income, 5000);
  assert.equal(d.expense, 1200);
  assert.equal(d.freeMoney, 2800);
});

test('dashboard daily safe amount uses remaining calendar days', () => {
  const d = computeDashboard([], {monthly_income:3100, monthly_budget:0, protected_reserve:0}, new Date('2026-10-01T12:00:00'));
  assert.equal(d.remainingDays, 31);
  assert.equal(d.dailySafe, 100);
});

test('budget status turns red when spending outruns month', () => {
  const s = budgetStatus(900, 1000, new Date('2026-10-10T12:00:00'));
  assert.equal(s.tone, 'danger');
});

test('filterTransactions filters by text, kind and month without mutation', () => {
  const source = [
    {id:'1',kind:'expense',description:'Mercado',category:'Mercado',account:'Nubank',occurred_on:'2026-10-03'},
    {id:'2',kind:'income',description:'Cliente obra',category:'Renda',account:'PIX',occurred_on:'2026-09-03'}
  ];
  const copy = structuredClone(source);
  const out = filterTransactions(source, {query:'merc', kind:'expense', month:'2026-10'});
  assert.deepEqual(out.map(x=>x.id), ['1']);
  assert.deepEqual(source, copy);
});

test('summarizeBy groups expenses and ignores income', () => {
  const out = summarizeBy([
    {kind:'expense',category:'Mercado',amount:100},
    {kind:'expense',category:'Mercado',amount:50},
    {kind:'income',category:'Renda',amount:1000},
  ], 'category');
  assert.deepEqual(out, [['Mercado',150]]);
});

test('monthKey uses local year and month', () => {
  assert.equal(monthKey(new Date('2026-10-24T12:00:00')), '2026-10');
});
