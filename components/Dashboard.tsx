import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';
import { Transaction, TransactionType } from '../types';
import { PieChart as PieIcon, TrendingUp, DollarSign, Repeat, ArrowRight, Layers, Tag } from 'lucide-react';

interface DashboardProps {
  transactions: Transaction[];
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const Dashboard: React.FC<DashboardProps> = ({ transactions }) => {
  const [viewMode, setViewMode] = useState<'main' | 'sub'>('main');

  const summary = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.type === TransactionType.INCOME)
      .reduce((acc, t) => acc + t.amount, 0);
    const totalExpense = transactions
      .filter(t => t.type === TransactionType.EXPENSE)
      .reduce((acc, t) => acc + t.amount, 0);
    
    return {
      income: totalIncome,
      expense: totalExpense,
      balance: totalIncome - totalExpense
    };
  }, [transactions]);

  const categoryData = useMemo(() => {
    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
    const catMap = new Map<string, number>();

    expenses.forEach(t => {
      let key = t.category;
      if (viewMode === 'main') {
          // Group by Main Category (e.g. "Utilities.Water" -> "Utilities")
          // If no dot, it stays as is.
          key = t.category.split('.')[0].trim();
      }
      const current = catMap.get(key) || 0;
      catMap.set(key, current + t.amount);
    });

    return Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, viewMode]);

  const recentTrends = useMemo(() => {
      const sorted = [...transactions].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      return sorted.slice(-10).map(t => ({
          date: t.date,
          amount: t.type === TransactionType.INCOME ? t.amount : -t.amount,
          description: t.description
      }));
  }, [transactions]);

  // Identify recurring spendings (simple heuristic: same description appearing > 1 time)
  const regularSpendings = useMemo(() => {
    const expenses = transactions.filter(t => t.type === TransactionType.EXPENSE);
    const groups: Record<string, { count: number, amount: number, category: string }> = {};

    expenses.forEach(t => {
      // Normalize description to find matches
      const key = t.description.toLowerCase().trim().slice(0, 15); // Check first 15 chars for similarity
      if (!groups[key]) {
        groups[key] = { count: 0, amount: t.amount, category: t.category };
      }
      groups[key].count += 1;
      // Keep the latest amount or average? Let's use latest found
      groups[key].amount = t.amount;
    });

    return Object.entries(groups)
      .filter(([_, data]) => data.count > 1)
      .map(([key, data]) => ({ description: key, ...data }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5); // Top 5
  }, [transactions]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <TrendingUp size={20} />
            </div>
            <h3 className="text-slate-400 font-medium">Total Income</h3>
          </div>
          <p className="text-2xl font-bold text-white">${summary.income.toFixed(2)}</p>
        </div>
        
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <DollarSign size={20} />
            </div>
            <h3 className="text-slate-400 font-medium">Total Expenses</h3>
          </div>
          <p className="text-2xl font-bold text-white">${summary.expense.toFixed(2)}</p>
        </div>

        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center space-x-3 mb-2">
            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
              <PieIcon size={20} />
            </div>
            <h3 className="text-slate-400 font-medium">Net Balance</h3>
          </div>
          <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            ${summary.balance.toFixed(2)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spending by Category */}
        <div className="lg:col-span-2 bg-surface p-6 rounded-xl border border-slate-700 shadow-lg min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-white">Spending by Category</h3>
              <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-600">
                  <button
                      onClick={() => setViewMode('main')}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'main' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      title="Group by Main Category (e.g. Utilities)"
                  >
                      <Layers size={14} />
                      <span>Main</span>
                  </button>
                  <button
                      onClick={() => setViewMode('sub')}
                      className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${viewMode === 'sub' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                      title="Show Sub Categories (e.g. Utilities.Water)"
                  >
                      <Tag size={14} />
                      <span>Sub</span>
                  </button>
              </div>
          </div>

          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  fill="#8884d8"
                  paddingAngle={5}
                  dataKey="value"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                />
                <Legend layout="vertical" verticalAlign="middle" align="right" />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500">
              No expense data available
            </div>
          )}
        </div>

        {/* Regular Spendings */}
        <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex items-center space-x-2 mb-6">
             <Repeat size={20} className="text-purple-400" />
             <h3 className="text-xl font-semibold text-white">Regular Spendings</h3>
          </div>
          
          <div className="space-y-4">
            {regularSpendings.length > 0 ? (
              regularSpendings.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                  <div className="overflow-hidden">
                    <p className="text-sm font-medium text-white capitalize truncate">{item.description}</p>
                    <p className="text-xs text-slate-500">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-200">${item.amount.toFixed(2)}</p>
                    <p className="text-[10px] text-slate-500 bg-slate-700 inline-block px-1.5 py-0.5 rounded mt-1">
                      x{item.count}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-slate-500 py-10">
                <p>No recurring transactions detected yet.</p>
              </div>
            )}
            
            {regularSpendings.length > 0 && (
                <div className="pt-2 text-center">
                    <button className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center justify-center w-full">
                        View All <ArrowRight size={12} className="ml-1" />
                    </button>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Transaction Flow */}
      <div className="bg-surface p-6 rounded-xl border border-slate-700 shadow-lg min-h-[400px]">
        <h3 className="text-xl font-semibold text-white mb-6">Cash Flow Trend</h3>
        {recentTrends.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={recentTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickFormatter={(val) => val.slice(5)} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <RechartsTooltip 
                  cursor={{fill: '#334155', opacity: 0.2}}
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff' }}
                />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]}>
                  {recentTrends.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.amount > 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            No transaction history
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;