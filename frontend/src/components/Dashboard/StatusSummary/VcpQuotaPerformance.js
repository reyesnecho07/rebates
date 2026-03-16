// src/components/Dashboard/VanQuotaPerformance.js
import React, { useState, useEffect, useMemo } from 'react';
import { RefreshCw, TrendingUp, Calendar, DollarSign, Target } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
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
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(null);

  // Auto-load dates when modal opens for ANY tab
  useEffect(() => {
    console.log('📅 Auto-loading dates check:', {
      customerModalTab,
      hasModalCustomer: !!modalCustomer,
      hasPeriodFrom: !!periodFrom,
      hasPeriodTo: !!periodTo
    });
    
    // Only run if we have a modalCustomer but no dates set yet
    if (modalCustomer && (!periodFrom || !periodTo)) {
      console.log('📅 Auto-loading dates for customer:', modalCustomer.customer);
      
      // Try to get dates from customer data
      const dateFrom = modalCustomer.details?.rebateDetails?.dateFrom || 
                      modalCustomer.dateFrom || 
                      modalCustomer.details?.dateRange?.periodFrom;
      
      const dateTo = modalCustomer.details?.rebateDetails?.dateTo || 
                    modalCustomer.dateTo || 
                    modalCustomer.details?.dateRange?.periodTo;
      
      if (dateFrom && dateTo) {
        console.log('📅 Setting auto-loaded dates from customer data:', { dateFrom, dateTo });
        setPeriodFrom(dateFrom);
        setPeriodTo(dateTo);
      } else {
        // If no dates in customer data, use current quarter
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        // Calculate quarter start and end
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        const quarterEndMonth = quarterStartMonth + 2;
        
        const quarterStartDate = new Date(currentYear, quarterStartMonth, 1);
        const quarterEndDate = new Date(currentYear, quarterEndMonth + 1, 0);
        
        const formattedFrom = quarterStartDate.toISOString().split('T')[0];
        const formattedTo = quarterEndDate.toISOString().split('T')[0];
        
        console.log('📅 Using default quarter dates:', {
          from: formattedFrom,
          to: formattedTo
        });
        
        setPeriodFrom(formattedFrom);
        setPeriodTo(formattedTo);
      }
    }
  }, [modalCustomer, periodFrom, periodTo]); // Run when modalCustomer changes or when dates are empty

  // Calculate statistics using useMemo
  const stats = useMemo(() => {
    if (!dailyData.length) return null;
    
    const salesData = dailyData.map(d => d.sales);
    const maxSales = Math.max(...salesData);
    const minSales = Math.min(...salesData);
    const avgSales = salesData.reduce((a, b) => a + b, 0) / salesData.length;
    const stdDev = Math.sqrt(
      salesData.reduce((sq, n) => sq + Math.pow(n - avgSales, 2), 0) / salesData.length
    );
    
    // Calculate trend (last 7 days vs first 7 days)
    const recentTrend = dailyData.slice(-7).reduce((sum, d) => sum + d.sales, 0) / 7;
    const initialTrend = dailyData.slice(0, 7).reduce((sum, d) => sum + d.sales, 0) / 7;
    const trendPercentage = ((recentTrend - initialTrend) / initialTrend) * 100;
    
    return {
      maxSales,
      minSales,
      avgSales,
      stdDev,
      trendPercentage,
      totalDays: dailyData.length,
      daysWithData: salesData.filter(s => s > 0).length
    };
  }, [dailyData]);

  // Fetch daily transactions when quota tab is active
  useEffect(() => {
    console.log('🔄 Checking if should fetch daily transactions:', {
      customerModalTab,
      hasModalCustomer: !!modalCustomer,
      modalCustomerCode: modalCustomer?.code,
      modalCustomerRebateCode: modalCustomer?.rebateCode
    });
    
    if (customerModalTab === 'quota' && modalCustomer?.code && modalCustomer?.rebateCode) {
      console.log('📊 Fetching daily transactions for quota tab');
      fetchDailyTransactions();
    }
  }, [customerModalTab, modalCustomer]);

  const fetchDailyTransactions = async () => {
    if (!modalCustomer?.code || !modalCustomer?.rebateCode) return;
    
    setLoading(true);
    try {
      // Log the dates being used
      console.log('📅 Fetching with dates:', {
        periodFrom,
        periodTo,
        customer: modalCustomer.customer
      });
      
      const response = await fetch(
        `http://192.168.100.193:3006/api/vcp/dashboard/customer/${modalCustomer.code}/daily-transactions?` +
        `db=VCP_OWN&rebateCode=${modalCustomer.rebateCode}&rebateType=${modalCustomer.rebateType}&` +
        `periodFrom=${periodFrom}&periodTo=${periodTo}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const transactions = data.data.dailyTransactions || [];
          
          // Get frequency from modalCustomer
          const frequency = modalCustomer?.frequency || 'Quarterly';
          
          console.log('📊 Processing transactions for frequency:', frequency);
          
          // Process data based on frequency
          if (frequency === 'Monthly') {
            // MONTHLY: Group by day, only show days with transactions
            const dailyMap = {};
            
            transactions.forEach(item => {
              if (item.date) {
                const date = new Date(item.date);
                const dayOfMonth = date.getDate();
                const monthName = date.toLocaleDateString('en-US', { month: 'long' });
                const year = date.getFullYear();
                
                const key = `Day ${dayOfMonth}`;
                
                if (!dailyMap[key]) {
                  dailyMap[key] = {
                    key: key,
                    day: dayOfMonth,
                    totalSales: 0,
                    transactionCount: 0,
                    date: item.date,
                    monthName: monthName,
                    year: year,
                    monthYear: `${monthName} ${year}`
                  };
                }
                
                dailyMap[key].totalSales += item.actualSales || 0;
                dailyMap[key].transactionCount++;
              }
            });
            
            // Convert to array and sort by day
            const aggregatedData = Object.values(dailyMap)
              .sort((a, b) => a.day - b.day)
              .map((item, index) => ({
                name: `Day ${item.day}`,
                displayName: item.day.toString(),
                sales: item.totalSales,
                day: item.day,
                monthName: item.monthName,
                year: item.year,
                monthYear: item.monthYear,
                transactionCount: item.transactionCount,
                hasTransactions: item.transactionCount > 0,
                date: item.date,
                isPeak: false,
                type: 'monthly-day'
              }));
            
            // Mark peak day
            if (aggregatedData.length > 0) {
              const maxSales = Math.max(...aggregatedData.map(d => d.sales));
              aggregatedData.forEach(item => {
                item.isPeak = item.sales === maxSales && item.sales > 0;
              });
            }
            
            setDailyData(aggregatedData);
            
          } else {
            // QUARTERLY: Group by day, only show days with transactions
            const dayMap = {};
            
            transactions.forEach(item => {
              if (item.date) {
                const date = new Date(item.date);
                const monthName = date.toLocaleDateString('en-US', { month: 'long' });
                const dayOfMonth = date.getDate();
                const year = date.getFullYear();
                
                // Create a unique key for each day
                const key = `${monthName} ${dayOfMonth}`;
                
                if (!dayMap[key]) {
                  dayMap[key] = {
                    key: key,
                    displayName: `${monthName.substring(0, 3)} ${dayOfMonth}`,
                    day: dayOfMonth,
                    monthName: monthName,
                    year: year,
                    totalSales: 0,
                    transactionCount: 0,
                    date: item.date,
                    monthYear: `${monthName} ${year}`
                  };
                }
                
                dayMap[key].totalSales += item.actualSales || 0;
                dayMap[key].transactionCount++;
              }
            });
            
            // Convert to array and sort by date
            const allDays = Object.values(dayMap)
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .map((day, index) => ({
                name: day.displayName,
                displayName: day.displayName,
                sales: day.totalSales,
                day: day.day,
                monthName: day.monthName,
                year: day.year,
                monthYear: day.monthYear,
                transactionCount: day.transactionCount,
                hasTransactions: day.transactionCount > 0,
                date: day.date,
                isPeak: false,
                type: 'quarterly-day'
              }));
            
            // Mark peak day
            if (allDays.length > 0) {
              const maxSales = Math.max(...allDays.map(d => d.sales));
              allDays.forEach(item => {
                item.isPeak = item.sales === maxSales && item.sales > 0;
              });
            }
            
            setDailyData(allDays);
          }
          
          setSummary(data.data.totals);
        }
      } else {
        console.error('❌ Failed to fetch daily transactions:', response.status);
      }
    } catch (error) {
      console.error('Error fetching daily transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (customerModalTab !== 'quota') return null;

  // Styling classes
  const headerClasses = `px-6 py-3 border-b ${
    isDark ? 'border-gray-700' : 'border-gray-200'
  } ${isDark ? 'bg-gradient-to-r from-gray-800 to-gray-900' : 'bg-gray-50'}`;

  const titleClasses = `text-base font-bold ${
    isDark ? 'text-gray-100' : 'text-gray-900'
  }`;

  const subtitleClasses = `text-xs ${
    isDark ? 'text-gray-400' : 'text-gray-600'
  }`;

  const chartCardClasses = `border rounded-lg p-4 shadow-sm h-full flex flex-col ${
    isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
  }`;

  const Loading = () => (
    <div className="flex items-center justify-center h-full">
      <div className={`flex items-center gap-2 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
        <RefreshCw className="w-5 h-5 animate-spin" />
        Loading daily sales data...
      </div>
    </div>
  );

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      const frequency = modalCustomer?.frequency || 'Quarterly';
      const isMonthly = frequency === 'Monthly';
      
      return (
        <div className={`rounded-lg shadow-xl p-3 min-w-[180px] ${
          isDark 
            ? 'bg-gray-900 border border-gray-700 text-white' 
            : 'bg-white border border-gray-200 text-gray-900'
        }`}>
          <p className="text-xs font-semibold mb-2">
            {isMonthly 
              ? `Day ${data?.day || label}`
              : data?.displayName || label
            }
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs">Total Sales:</span>
              <span className={`text-sm font-bold ${
                isDark ? 'text-blue-300' : 'text-blue-600'
              }`}>
                {formatDecimal(data?.sales || payload[0].value)}
              </span>
            </div>
            
            {data?.transactionCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs">Transactions:</span>
                <span className={`text-xs ${
                  isDark ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {data.transactionCount}
                </span>
              </div>
            )}
            
            {!isMonthly && data?.monthName && (
              <div className="flex items-center justify-between">
                <span className="text-xs">Month:</span>
                <span className={`text-xs ${
                  isDark ? 'text-purple-300' : 'text-purple-600'
                }`}>
                  {data.monthName}
                </span>
              </div>
            )}
            
            {data?.isPeak && (
              <div className={`text-xs px-2 py-1 rounded-full inline-block mt-1 ${
                isDark 
                  ? 'bg-yellow-900/30 text-yellow-300' 
                  : 'bg-yellow-100 text-yellow-700'
              }`}>
                Peak {isMonthly ? 'Day' : 'Transaction Day'}
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Custom legend component
  const renderCustomLegend = (props) => {
    const { payload } = props;
    // Filter to only show Sales Trend, not Average
    const filteredPayload = payload.filter(entry => entry.value === 'Daily Sales');
    
    return (
      <div className="flex items-center justify-center gap-4 pt-2">
        {filteredPayload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  const renderAreaChart = () => {
    if (loading || !dailyData.length) {
      return (
        <div className="flex-1 flex items-center justify-center">
          {loading ? <Loading /> : (
            <div className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              No daily sales data available
            </div>
          )}
        </div>
      );
    }

    // Calculate Y-axis domain based on actual sales data
    const salesValues = dailyData.map(d => d.sales);
    const maxSales = Math.max(...salesValues);
    const minSales = Math.min(...salesValues);
    
    // Set Y-axis domain with padding (10% above max value)
    const yDomain = [0, maxSales * 1.1];
    
    // Get X-axis formatter
    const getXAxisFormatter = (data, frequency) => {
      if (!data || data.length === 0) return (value, index) => index + 1;
      
      if (frequency === 'Monthly') {
        // For monthly: show just the day number (1, 2, 3, ...)
        return (value, index) => {
          const item = data[index];
          if (item?.day) {
            return item.day.toString();
          }
          return value || (index + 1).toString();
        };
      } else if (frequency === 'Quarterly') {
        return (value, index) => {
          const item = data[index];
          if (item?.displayName) {
            return item.displayName;
          }
          return value || (index + 1).toString();
        };
      }
      
      // Default: show day numbers
      return (value, index) => index + 1;
    };

    // Format Y-axis ticks nicely
    const formatYAxisTick = (value) => {
      if (value === 0) return '0';
      if (value < 1000) return formatDecimal(value);
      if (value < 1000000) return formatDecimal(value / 1000) + 'K';
      return formatDecimal(value / 1000000) + 'M';
    };

    return (
      <div className=" flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={dailyData} // Use original data, not smoothed
                margin={{ top: 10, right: 20, left: 0, bottom: 20 }}            >
              <defs>
                {/* Gradient for area fill */}
                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                  <stop 
                    offset="5%" 
                    stopColor={isDark ? "#3B82F6" : "#2563EB"} 
                    stopOpacity={0.8}
                  />
                  <stop 
                    offset="95%" 
                    stopColor={isDark ? "#3B82F6" : "#2563EB"} 
                    stopOpacity={0.1}
                  />
                </linearGradient>
                
                {/* Gradient for the line */}
                <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={isDark ? "#60A5FA" : "#3B82F6"} />
                  <stop offset="100%" stopColor={isDark ? "#93C5FD" : "#60A5FA"} />
                </linearGradient>
              </defs>
              
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke={isDark ? "#374151" : "#E5E7EB"}
                vertical={false}
              />
              
              <XAxis 
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? "#4B5563" : "#D1D5DB" }}
                tickFormatter={getXAxisFormatter(dailyData, modalCustomer?.frequency || 'Quarterly')}
                interval={0}
                minTickGap={10}
                padding={{ left: 5, right: 5 }}
              />
              
              <YAxis 
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: isDark ? "#4B5563" : "#D1D5DB" }}
                tickFormatter={formatYAxisTick}
                domain={[0, 'auto']}
                allowDataOverflow={false}
                scale="linear"
                width={40} 
              />
              
              <Tooltip 
                content={<CustomTooltip />}
                cursor={{ 
                  stroke: isDark ? '#4B5563' : '#E5E7EB',
                  strokeWidth: 1,
                  strokeDasharray: '3 3'
                }}
              />
              
              <Legend 
                content={renderCustomLegend}
                verticalAlign="top"
                height={36}
              />
              
              {/* Area with gradient - Using natural curve for accurate representation */}
              <Area
                type="monotoneX" 
                dataKey="sales"
                name="Daily Sales"
                stroke="url(#lineGradient)"
                strokeWidth={2.5}
                fill="url(#colorSales)"
                fillOpacity={0.6}
                activeDot={{ 
                  r: 6, 
                  fill: isDark ? "#60A5FA" : "#3B82F6",
                  stroke: isDark ? "#1E40AF" : "#1D4ED8",
                  strokeWidth: 2
                }}
                dot={{
                  r: 4,
                  fill: isDark ? "#93C5FD" : "#60A5FA",
                  stroke: isDark ? "#1E40AF" : "#1D4ED8",
                  strokeWidth: 1.5,
                  strokeOpacity: 0.8
                }}
                connectNulls={true}
                isAnimationActive={true}
                animationDuration={1500}
                animationEasing="ease-in-out"
              />
              
            </AreaChart>
          </ResponsiveContainer>
        </div>
        
        {/* X-axis labels */}
        <div className={`pt-3 border-t ${
          isDark ? 'border-gray-700' : 'border-gray-200'
        } flex-shrink-0`}>
          <div className="text-center">
            <div className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
              Daily Sales with Accurate Y-Axis Alignment
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatisticalSummary = () => {
    if (!dailyData.length) return null;

    const frequency = modalCustomer?.frequency || 'Quarterly';
    const isMonthly = frequency === 'Monthly';
    
    const totalSales = dailyData.reduce((sum, d) => sum + d.sales, 0);
    const daysWithSales = dailyData.filter(d => d.sales > 0).length;
    const avgPerActiveDay = daysWithSales > 0 ? totalSales / daysWithSales : 0;
    const peakDay = Math.max(...dailyData.map(d => d.sales));
    
    return (
      <div className="grid grid-cols-1 gap-4">
        {/* Total Sales */}
        <div className={`border rounded-xl p-3 text-center flex flex-col items-center justify-center transition-all duration-200 ${
          isDark 
            ? 'bg-blue-900/20 border-blue-700/30' 
            : 'bg-blue-50 border-blue-100'
        }`}>
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
            <div className={`text-lg font-bold ${
              isDark ? 'text-blue-300' : 'text-blue-700'
            }`}>
              {formatDecimal(totalSales)}
            </div>
          </div>
          <div className={`text-xs font-medium mt-1 ${
            isDark ? 'text-blue-400' : 'text-blue-600'
          }`}>
            Total Sales
          </div>
          <div className={`text-[10px] mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            {isMonthly ? 'This month' : 'This quarter'}
          </div>
        </div>
        
        {/* Active Days */}
        <div className={`border rounded-xl p-3 text-center flex flex-col items-center justify-center transition-all duration-200 ${
          isDark 
            ? 'bg-purple-900/20 border-purple-700/30' 
            : 'bg-purple-50 border-purple-100'
        }`}>
          <div className="flex items-center gap-2">
            <Calendar className={`w-4 h-4 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
            <div className={`text-lg font-bold ${
              isDark ? 'text-purple-300' : 'text-purple-700'
            }`}>
              {daysWithSales}
            </div>
          </div>
          <div className={`text-xs font-medium mt-1 ${
            isDark ? 'text-purple-400' : 'text-purple-600'
          }`}>
            {isMonthly ? 'Transaction Days' : 'Transaction Days'}
          </div>
          <div className={`text-[10px] mt-1 ${
            isDark ? 'text-gray-400' : 'text-gray-500'
          }`}>
            Days with sales
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionRecords = () => {
    if (!dailyData.length) return null;
    
    // Group by month for better organization
    const transactionsByMonth = {};
    dailyData.forEach(transaction => {
      const monthKey = transaction.monthYear || transaction.monthName || 'Unknown';
      if (!transactionsByMonth[monthKey]) {
        transactionsByMonth[monthKey] = [];
      }
      transactionsByMonth[monthKey].push(transaction);
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className={headerClasses}>
        <div className="flex items-center justify-between">
          <div>
            <h4 className={titleClasses}>
              {modalCustomer?.rebateType || 'Rebate'} Performance Analysis
            </h4>
            <p className={subtitleClasses}>
              {modalCustomer?.frequency === 'Monthly' 
                ? 'Monthly summary sales trend' 
                : 'Quarterly summary sales trend'
              }
            </p>
          </div>
          {loading && (
            <div className={`flex items-center gap-2 text-sm ${
              isDark ? 'text-blue-400' : 'text-blue-600'
            }`}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Loading...
            </div>
          )}
        </div>
      </div>
      
      <div className={`flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 min-h-0 ${
        isDark ? 'bg-gray-800' : 'bg-white'
      }`}>
        {/* Main Chart Area - 2/3 width */}
        <div className="lg:col-span-2 min-h-0">
          <div className={chartCardClasses}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-2 flex-shrink-0">
              <div>
                <h5 className={`text-sm font-semibold ${
                  isDark ? 'text-gray-100' : 'text-gray-900'
                }`}>
                  {modalCustomer?.frequency === 'Monthly' 
                    ? 'Monthly Sales by Day' 
                    : 'Quarterly Sales by Transaction Day'
                  }
                </h5>
                <p className={`text-xs ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}>
                  {modalCustomer?.frequency === 'Monthly' 
                    ? `Showing ${dailyData.length} transaction days`
                    : `Showing ${dailyData.length} transaction days`
                  }
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600"></div>
                  <span className={`text-xs ${
                    isDark ? 'text-gray-300' : 'text-gray-700'
                  } font-medium`}>
                    Daily Sales
                  </span>
                </div>
              </div>
            </div>
            {renderAreaChart()}
          </div>
        </div>
        
        {/* Side Panel - 1/3 width */}
        <div className="space-y-4 h-80">
          {/* Statistical Summary */}
          <div className={chartCardClasses}>
            <h5 className={`text-sm font-semibold ${
              isDark ? 'text-gray-100' : 'text-gray-900'
            } mb-4`}>
              Statistical Summary
            </h5>
            {renderStatisticalSummary()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VcpQuotaPerformance;