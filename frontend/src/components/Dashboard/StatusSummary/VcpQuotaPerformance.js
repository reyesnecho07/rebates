// src/components/Dashboard/VcpQuotaPerformance.js
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, Calendar, BarChart2, } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const VcpQuotaPerformance = ({
  theme = 'light',
  customerModalTab,
  modalCustomer,
  isLoadingCustomer,
  formatDecimal,
  periodFrom,
  periodTo,
  setPeriodFrom,
  setPeriodTo,
  loadDetailedTransactionsData,
}) => {
  const isDark = theme === 'dark';
  const [dailyData, setDailyData] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [summary, setSummary]     = useState(null);

  // ── Auto-load dates ──────────────────────────────────────────────────────
  useEffect(() => {
    if (modalCustomer && (!periodFrom || !periodTo)) {
      const dateFrom =
        modalCustomer.details?.rebateDetails?.dateFrom ||
        modalCustomer.dateFrom ||
        modalCustomer.details?.dateRange?.periodFrom;
      const dateTo =
        modalCustomer.details?.rebateDetails?.dateTo ||
        modalCustomer.dateTo ||
        modalCustomer.details?.dateRange?.periodTo;

      if (dateFrom && dateTo) {
        setPeriodFrom(dateFrom);
        setPeriodTo(dateTo);
      } else {
        const today  = new Date();
        const qStart = Math.floor(today.getMonth() / 3) * 3;
        const qEnd   = qStart + 2;
        const from   = new Date(today.getFullYear(), qStart, 1);
        const to     = new Date(today.getFullYear(), qEnd + 1, 0);
        setPeriodFrom(from.toISOString().split('T')[0]);
        setPeriodTo(to.toISOString().split('T')[0]);
      }
    }
  }, [modalCustomer, periodFrom, periodTo]);

  // ── Fetch daily transactions ──────────────────────────────────────────────
  useEffect(() => {
    if (customerModalTab === 'quota' && modalCustomer?.code && modalCustomer?.rebateCode) {
      fetchDailyTransactions();
    }
  }, [customerModalTab, modalCustomer]);

  const fetchDailyTransactions = async () => {
    if (!modalCustomer?.code || !modalCustomer?.rebateCode) return;
    setLoading(true);
    try {
      const response = await fetch(
        `http://192.168.100.193:3009/api/vcp/dashboard/customer/${modalCustomer.code}/daily-transactions?` +
        `db=VCP&rebateCode=${modalCustomer.rebateCode}&rebateType=${modalCustomer.rebateType}&` +
        `periodFrom=${periodFrom}&periodTo=${periodTo}`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const transactions = data.data.dailyTransactions || [];
          const frequency    = modalCustomer?.frequency || 'Quarterly';
          const isMonthly    = frequency === 'Monthly';

          if (isMonthly) {
            const dailyMap = {};
            transactions.forEach(item => {
              if (!item.date) return;
              const date      = new Date(item.date);
              const day       = date.getDate();
              const monthName = date.toLocaleDateString('en-US', { month: 'long' });
              const year      = date.getFullYear();
              const key       = `Day ${day}`;
              if (!dailyMap[key]) {
                dailyMap[key] = { key, day, totalSales: 0, transactionCount: 0, date: item.date, monthName, year, monthYear: `${monthName} ${year}` };
              }
              dailyMap[key].totalSales      += item.actualSales || 0;
              dailyMap[key].transactionCount++;
            });
            const aggregated = Object.values(dailyMap)
              .sort((a, b) => a.day - b.day)
              .map(item => ({
                name: `Day ${item.day}`, displayName: item.day.toString(),
                sales: item.totalSales, day: item.day, monthName: item.monthName,
                year: item.year, monthYear: item.monthYear,
                transactionCount: item.transactionCount, hasTransactions: item.transactionCount > 0,
                date: item.date, isPeak: false, type: 'monthly-day',
              }));
            if (aggregated.length) {
              const max = Math.max(...aggregated.map(d => d.sales));
              aggregated.forEach(item => { item.isPeak = item.sales === max && item.sales > 0; });
            }
            setDailyData(aggregated);
          } else {
            const dayMap = {};
            transactions.forEach(item => {
              if (!item.date) return;
              const date      = new Date(item.date);
              const monthName = date.toLocaleDateString('en-US', { month: 'long' });
              const day       = date.getDate();
              const year      = date.getFullYear();
              const key       = `${monthName} ${day}`;
              if (!dayMap[key]) {
                dayMap[key] = { key, displayName: `${monthName.substring(0, 3)} ${day}`, day, monthName, year, totalSales: 0, transactionCount: 0, date: item.date, monthYear: `${monthName} ${year}` };
              }
              dayMap[key].totalSales      += item.actualSales || 0;
              dayMap[key].transactionCount++;
            });
            const allDays = Object.values(dayMap)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map(day => ({
                name: day.displayName, displayName: day.displayName,
                sales: day.totalSales, day: day.day, monthName: day.monthName,
                year: day.year, monthYear: day.monthYear,
                transactionCount: day.transactionCount, hasTransactions: day.transactionCount > 0,
                date: day.date, isPeak: false, type: 'quarterly-day',
              }));
            if (allDays.length) {
              const max = Math.max(...allDays.map(d => d.sales));
              allDays.forEach(item => { item.isPeak = item.sales === max && item.sales > 0; });
            }
            setDailyData(allDays);
          }
          setSummary(data.data.totals);
        }
      }
    } catch (err) {
      console.error('Error fetching daily transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!dailyData.length) return null;
    const salesData     = dailyData.map(d => d.sales);
    const totalSales    = salesData.reduce((a, b) => a + b, 0);
    const daysWithSales = salesData.filter(s => s > 0).length;
    const maxSales      = Math.max(...salesData);
    return { totalSales, daysWithSales, maxSales };
  }, [dailyData]);

  if (customerModalTab !== 'quota') return null;

  const frequency = modalCustomer?.frequency || 'Quarterly';
  const isMonthly = frequency === 'Monthly';

  // ── Theme tokens ───────────────────────────────────────────────────────────
  const T = {
    bg:     isDark ? 'bg-slate-900'                    : 'bg-white',
    card:   isDark ? 'bg-slate-800 border-slate-700'   : 'bg-white border-slate-200',
    header: isDark ? 'bg-slate-800/80 border-slate-700': 'bg-slate-50 border-slate-200',
    tp:     isDark ? 'text-slate-100'                  : 'text-slate-800',
    ts:     isDark ? 'text-slate-400'                  : 'text-slate-500',
    tm:     isDark ? 'text-slate-500'                  : 'text-slate-400',
    grid:   isDark ? '#334155'                         : '#E2E8F0',
    axis:   isDark ? '#475569'                         : '#CBD5E1',
  };

  // ── Tooltip ────────────────────────────────────────────────────────────────
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div className={`rounded-xl shadow-xl border p-3 min-w-[160px] text-xs ${
        isDark ? 'bg-slate-900 border-slate-700 text-slate-100' : 'bg-white border-slate-200 text-slate-800'
      }`}>
        <p className="font-bold mb-2">{isMonthly ? `Day ${d?.day || label}` : d?.displayName || label}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4">
            <span className={T.ts}>Sales</span>
            <span className={`font-bold ${isDark ? 'text-blue-300' : 'text-blue-600'}`}>
              {formatDecimal(d?.sales || payload[0].value)}
            </span>
          </div>
          {d?.transactionCount > 0 && (
            <div className="flex justify-between gap-4">
              <span className={T.ts}>Txns</span>
              <span className={T.tp}>{d.transactionCount}</span>
            </div>
          )}
          {!isMonthly && d?.monthName && (
            <div className="flex justify-between gap-4">
              <span className={T.ts}>Month</span>
              <span className={isDark ? 'text-violet-300' : 'text-violet-600'}>{d.monthName}</span>
            </div>
          )}
          {d?.isPeak && (
            <div className={`mt-1 px-2 py-0.5 rounded-full text-center text-[10px] font-semibold ${
              isDark ? 'bg-amber-900/30 text-amber-300' : 'bg-amber-100 text-amber-700'
            }`}>
              Peak Day
            </div>
          )}
        </div>
      </div>
    );
  };

  const formatYAxis = (v) => {
    if (v === 0) return '0';
    if (v < 1000) return formatDecimal(v);
    if (v < 1_000_000) return (v / 1000).toFixed(1) + 'K';
    return (v / 1_000_000).toFixed(1) + 'M';
  };

  const getXFormatter = () => (value, index) => {
    const item = dailyData[index];
    if (!item) return value;
    return isMonthly ? item.day?.toString() : (item.displayName || value);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={`h-full flex flex-col ${T.bg}`}>

      {/* ── Section header ──────────────────────────────────────────────── */}
      <div className={`flex-shrink-0 px-5 py-3 border-b flex items-center justify-between ${T.header}`}>
        <div>
          <h4 className={`text-xs font-bold uppercase tracking-widest ${T.tp}`}>
            {modalCustomer?.rebateType || 'Rebate'} Performance
          </h4>
          <p className={`text-[11px] mt-0.5 ${T.ts}`}>
            {isMonthly ? 'Monthly summary sales trend' : 'Quarterly summary sales trend'}
          </p>
        </div>
        {loading && (
          <div className={`flex items-center gap-1.5 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
            <RefreshCw size={13} className="animate-spin" />
            Loading…
          </div>
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-4 overflow-hidden">

        {/* Chart — 2/3 */}
        <div className={`flex-1 min-h-0 flex flex-col rounded-xl border ${T.card}`}>
          {/* Chart header */}
          <div className={`flex-shrink-0 px-4 py-2.5 border-b flex items-center justify-between ${T.header} rounded-t-xl`}>
            <div>
              <p className={`text-xs font-bold ${T.tp}`}>
                {isMonthly ? 'Monthly Sales by Day' : 'Quarterly Sales by Transaction Day'}
              </p>
              <p className={`text-[11px] mt-0.5 ${T.ts}`}>
                {dailyData.length} transaction day{dailyData.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
              <span className={`text-[11px] font-medium ${T.ts}`}>Daily Sales</span>
            </div>
          </div>

          {/* Chart body */}
          <div className="flex-1 min-h-0 p-3">
            {loading ? (
              <div className="h-full flex items-center justify-center">
                <div className={`flex items-center gap-2 text-xs ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                  <RefreshCw size={14} className="animate-spin" />
                  Loading daily sales data…
                </div>
              </div>
            ) : dailyData.length === 0 ? (
              <div className="h-full flex items-center justify-center py-16">
                <div className="text-center">
                  <div className={`w-14 h-14 mx-auto rounded-xl flex items-center justify-center mb-4 ${
                    isDark ? 'bg-slate-800' : 'bg-slate-100'
                  }`}>
                    <BarChart2 size={22} className={T.tm} />
                  </div>
                  <h3 className={`text-sm font-bold mb-1 ${T.tp}`}>No Sales Data</h3>
                  <p className={`text-xs ${T.ts}`}>No daily sales data available for this period.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 8, right: 12, left: 0, bottom: 16 }}>
                  <defs>
                    <linearGradient id="vcpColorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={isDark ? '#3B82F6' : '#2563EB'} stopOpacity={0.7} />
                      <stop offset="95%" stopColor={isDark ? '#3B82F6' : '#2563EB'} stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="vcpLineGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%"   stopColor={isDark ? '#60A5FA' : '#3B82F6'} />
                      <stop offset="100%" stopColor={isDark ? '#93C5FD' : '#60A5FA'} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={T.grid} vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: T.axis }}
                    tickFormatter={getXFormatter()}
                    interval={0}
                    minTickGap={10}
                    padding={{ left: 5, right: 5 }}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#64748B' }}
                    tickLine={false}
                    axisLine={{ stroke: T.axis }}
                    tickFormatter={formatYAxis}
                    domain={[0, 'auto']}
                    width={38}
                  />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke: T.grid, strokeWidth: 1, strokeDasharray: '3 3' }}
                  />
                  <Area
                    type="monotoneX"
                    dataKey="sales"
                    name="Daily Sales"
                    stroke="url(#vcpLineGradient)"
                    strokeWidth={2}
                    fill="url(#vcpColorSales)"
                    fillOpacity={1}
                    activeDot={{ r: 5, fill: isDark ? '#60A5FA' : '#3B82F6', stroke: isDark ? '#1E40AF' : '#1D4ED8', strokeWidth: 2 }}
                    dot={{ r: 3, fill: isDark ? '#93C5FD' : '#60A5FA', stroke: isDark ? '#1E40AF' : '#1D4ED8', strokeWidth: 1 }}
                    connectNulls
                    animationDuration={1200}
                    animationEasing="ease-in-out"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Side panel — 1/3 */}
        <div className="lg:w-52 flex-shrink-0 flex flex-col gap-3">

          {/* Total Sales */}
          <div className={`rounded-xl border px-4 py-4 flex flex-col items-center text-center ${
            isDark ? 'bg-blue-900/20 border-blue-700/30' : 'bg-blue-50 border-blue-200'
          }`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
              <TrendingUp size={15} className="text-white" />
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${T.ts}`}>Total Sales</p>
            <p className={`text-base font-bold leading-tight ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>
              {stats ? formatDecimal(stats.totalSales) : '—'}
            </p>
            <p className={`text-[10px] mt-1 ${T.tm}`}>{isMonthly ? 'This month' : 'This quarter'}</p>
          </div>

          {/* Transaction Days */}
          <div className={`rounded-xl border px-4 py-4 flex flex-col items-center text-center ${
            isDark ? 'bg-violet-900/20 border-violet-700/30' : 'bg-violet-50 border-violet-200'
          }`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm">
              <Calendar size={15} className="text-white" />
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${T.ts}`}>Transaction Days</p>
            <p className={`text-base font-bold leading-tight ${isDark ? 'text-violet-300' : 'text-violet-700'}`}>
              {stats ? stats.daysWithSales : '—'}
            </p>
            <p className={`text-[10px] mt-1 ${T.tm}`}>Days with sales</p>
          </div>

          {/* Peak Day */}
          <div className={`rounded-xl border px-4 py-4 flex flex-col items-center text-center ${
            isDark ? 'bg-amber-900/20 border-amber-700/30' : 'bg-amber-50 border-amber-200'
          }`}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-gradient-to-br from-amber-500 to-orange-500 shadow-sm">
              <TrendingUp size={15} className="text-white" />
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${T.ts}`}>Peak Day</p>
            <p className={`text-base font-bold leading-tight ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>
              {stats ? formatDecimal(stats.maxSales) : '—'}
            </p>
            <p className={`text-[10px] mt-1 ${T.tm}`}>Highest single day</p>
          </div>

        </div>
      </div>
    </div>
  );
};

export default VcpQuotaPerformance;