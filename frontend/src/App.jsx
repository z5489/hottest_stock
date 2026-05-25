import React, { useState, useEffect, useRef } from 'react';

const criteriaChecks = {
  price: (v) => v >= 1.0,
  marketCap: (v) => v > 25000000,
  float: (v) => v <= 75000000,
  avgVolume60D: (v) => v > 300000,
  volume: (v) => v > 100000,
  perf1W: (v) => v >= -10 && v <= 10,
  perf1M: (v) => v > 30,
  volatility1W: (v) => v > 3
};

const columns = [
  { label: 'Ticker', field: 'ticker', isSticky: true, class: 'sticky-col-ticker' },
  { label: 'Name', field: 'name', isSticky: true, class: 'sticky-col-name' },
  { label: 'Price', field: 'price' },
  { label: 'Mkt Cap', field: 'marketCap' },
  { label: 'Float', field: 'float' },
  { label: 'Avg Vol 60D', field: 'avgVolume60D' },
  { label: 'Volume', field: 'volume' },
  { label: 'Rel Vol', field: 'relVol' },
  { label: 'Perf 1W', field: 'perf1W' },
  { label: 'Perf 1M', field: 'perf1M' },
  { label: 'Perf YTD', field: 'perfYTD' },
  { label: 'Vol 1W', field: 'volatility1W' },
  { label: 'ADR% 14D', field: 'adr14' },
  { label: 'Status', field: 'status' }
];

export default function App() {
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState('latest');
  const [showPassOnly, setShowPassOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('relVol');
  const [sortAsc, setSortAsc] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState(false);

  const exportDropdownRef = useRef(null);

  useEffect(() => {
    // Load runs registry on mount
    const loadRuns = async () => {
      try {
        const response = await fetch('./output/runs.json');
        if (response.ok) {
          const runDates = await response.json();
          setRuns(runDates);
        }
      } catch (err) {
        console.warn('Failed to load runs.json, using latest only:', err);
      }
    };
    loadRuns();
    fetchData('latest');
  }, []);

  useEffect(() => {
    // Click outside to close export dropdown
    const handleClickOutside = (e) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async (runDate) => {
    setLoading(true);
    setErrorState(false);
    
    let resultsUrl = './output/results.json';
    let metaUrl = './output/meta.json';
    
    if (runDate !== 'latest') {
      resultsUrl = `./output/results_${runDate}.json`;
      metaUrl = `./output/meta_${runDate}.json`;
    }

    try {
      const metaRes = await fetch(metaUrl);
      if (!metaRes.ok) throw new Error('Meta file load failure');
      const metaJson = await metaRes.json();
      
      const resultsRes = await fetch(resultsUrl);
      if (!resultsRes.ok) throw new Error('Results file load failure');
      const resultsJson = await resultsRes.json();

      setMeta(metaJson);
      setResults(resultsJson);
    } catch (err) {
      console.error(`Error loading data for run ${runDate}:`, err);
      if (runDate !== 'latest') {
        alert(`Data for ${runDate} could not be loaded. Falling back to latest.`);
        setSelectedRun('latest');
        fetchData('latest');
      } else {
        setErrorState(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRunChange = (e) => {
    const val = e.target.value;
    setSelectedRun(val);
    fetchData(val);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Formatting helpers
  const formatAbbreviated = (value, isCurrency = false) => {
    if (value === null || value === undefined) return 'N/A';
    const val = parseFloat(value);
    if (isNaN(val)) return 'N/A';
    
    const prefix = isCurrency ? '$' : '';
    const absVal = Math.abs(val);
    let formatted = '';
    
    if (absVal >= 1e12) {
      formatted = (val / 1e12).toFixed(1) + 'T';
    } else if (absVal >= 1e9) {
      formatted = (val / 1e9).toFixed(1) + 'B';
    } else if (absVal >= 1e6) {
      formatted = (val / 1e6).toFixed(1) + 'M';
    } else if (absVal >= 1e3) {
      formatted = (val / 1e3).toFixed(1) + 'K';
    } else {
      formatted = val.toString();
    }
    
    formatted = formatted.replace(/\.0([TBMK])/, '$1');
    return prefix + formatted;
  };

  const formatPrice = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const val = parseFloat(value);
    if (isNaN(val)) return 'N/A';
    return '$' + val.toFixed(2);
  };

  const formatRelVol = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const val = parseFloat(value);
    if (isNaN(val)) return 'N/A';
    return val.toFixed(2) + 'x';
  };

  const formatPercent = (value, showSign = false) => {
    if (value === null || value === undefined) return 'N/A';
    const val = parseFloat(value);
    if (isNaN(val)) return 'N/A';
    const sign = showSign && val >= 0 ? '+' : '';
    return sign + val.toFixed(1) + '%';
  };

  // CSV exports
  const downloadCSV = (content, filename) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getVisibleRows = () => {
    return results
      .filter((row) => {
        if (showPassOnly) return row.status === 'PASS';
        return true;
      })
      .filter((row) => {
        const tickerMatch = row.ticker.toLowerCase().includes(searchTerm.toLowerCase());
        const nameMatch = row.name ? row.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        return tickerMatch || nameMatch;
      });
  };

  const exportTickersOnly = () => {
    const visible = getVisibleRows();
    let csv = 'ticker\n';
    visible.forEach(r => csv += `${r.ticker}\n`);
    const date = meta ? meta.runDate : new Date().toISOString().split('T')[0];
    downloadCSV(csv, `hottest_stocks_tickers_${date}.csv`);
    setExportOpen(false);
  };

  const exportAllFields = () => {
    const visible = getVisibleRows();
    const headers = ['ticker', 'name', 'price', 'marketCap', 'float', 'avgVolume60D', 'volume', 'relVol', 'perf1W', 'perf1M', 'perfYTD', 'volatility1W', 'adr14', 'status'];
    let csv = headers.join(',') + '\n';
    
    visible.forEach((row) => {
      const line = headers.map(header => {
        const val = row[header];
        if (val === null || val === undefined) return '';
        // Wrap names in quotes in case they contain commas
        if (header === 'name') return `"${val.replace(/"/g, '""')}"`;
        return val;
      }).join(',');
      csv += line + '\n';
    });
    
    const date = meta ? meta.runDate : new Date().toISOString().split('T')[0];
    downloadCSV(csv, `hottest_stocks_full_${date}.csv`);
    setExportOpen(false);
  };

  // Sort and Filter Logic
  const getSortedRows = () => {
    const visible = getVisibleRows();
    return [...visible].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return sortAsc ? valA - valB : valB - valA;
      }
    });
  };

  const sortedRows = getSortedRows();

  // Cell rendering helper
  const renderCell = (row, col) => {
    const val = row[col.field];
    
    if (col.field === 'ticker') {
      return <span className="ticker-txt">{val}</span>;
    }
    
    if (col.field === 'name') {
      return <span className="name-txt" title={val}>{val || '—'}</span>;
    }

    if (col.field === 'status') {
      const badgeClass = `status-tag ${val.toLowerCase().replace('/', '')}`;
      const title = val === 'FAIL' && row.failedCriteria && row.failedCriteria.length > 0
        ? `Failed criteria: ${row.failedCriteria.join(', ')}`
        : undefined;
      return <span className={badgeClass} title={title}>{val}</span>;
    }

    // Determine criteria badge
    const hasCriterion = criteriaChecks[col.field] !== undefined;
    let badge = null;
    if (hasCriterion && val !== null && val !== undefined) {
      const passes = criteriaChecks[col.field](val);
      badge = (
        <span className={`pass-fail-pill ${passes ? 'pass' : 'fail'}`}>
          {passes ? '✓ Pass' : '✗ Fail'}
        </span>
      );
    }

    let displayVal = 'N/A';
    let textClass = 'mono-val';
    
    if (val !== null && val !== undefined) {
      if (col.field === 'price') {
        displayVal = formatPrice(val);
      } else if (col.field === 'marketCap') {
        displayVal = formatAbbreviated(val, true);
      } else if (col.field === 'float' || col.field === 'avgVolume60D' || col.field === 'volume') {
        displayVal = formatAbbreviated(val, false);
      } else if (col.field === 'relVol') {
        displayVal = formatRelVol(val);
      } else if (col.field === 'perf1W' || col.field === 'perf1M' || col.field === 'perfYTD') {
        displayVal = formatPercent(val, true);
        textClass += val > 0 ? ' perf-green' : (val < 0 ? ' perf-red' : '');
      } else if (col.field === 'volatility1W' || col.field === 'adr14') {
        displayVal = formatPercent(val, false);
      }
    }

    if (hasCriterion) {
      return (
        <div className="cell-badge-container">
          {badge}
          <span className={textClass}>{displayVal}</span>
        </div>
      );
    }

    return <span className={textClass}>{displayVal}</span>;
  };

  // Pass rate calculation
  const passRate = meta && meta.totalTickers > 0
    ? ((meta.passCount / meta.totalTickers) * 100).toFixed(1) + '%'
    : '0.0%';

  return (
    <div className="container">
      {/* Top Header Row */}
      <header className="header">
        <div className="logo-area">
          <div className="logo-icon">
            <svg viewBox="0 0 24 24">
              <path d="M4 12l1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8-8 8z" />
            </svg>
          </div>
          <div className="title-area">
            <h1>Momentum Stock Screener</h1>
            <p>Interactive Stock Analysis Dashboard</p>
          </div>
        </div>

        <div className="date-selector-container">
          <label className="date-selector-label" htmlFor="run-date-select">Data as of:</label>
          <select
            id="run-date-select"
            className="custom-select"
            value={selectedRun}
            onChange={handleRunChange}
          >
            <option value="latest">Latest</option>
            {runs.map((date) => (
              <option key={date} value={date}>{date}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="stats-panel">
        <div className="stat-card">
          <span className="stat-label">Total Screened</span>
          <span className="stat-value total">
            {meta ? meta.totalTickers.toLocaleString() : '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Passed All Criteria</span>
          <span className="stat-value pass">
            {meta ? meta.passCount.toLocaleString() : '—'}
          </span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Pass Rate</span>
          <span className="stat-value rate">{passRate}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Data Timestamp</span>
          <span className="stat-value timestamp">
            {meta ? (
              <>
                <div>{meta.runDate}</div>
                <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>
                  {meta.runTimestampUTC}
                </div>
              </>
            ) : '—'}
          </span>
        </div>
      </section>

      {/* Toolbar Controls */}
      <section className="toolbar">
        <div className="search-container">
          <input
            id="ticker-search"
            type="text"
            className="search-input"
            placeholder="Search by ticker or company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <svg className="search-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <div className="toggle-group">
          <button
            id="btn-filter-passing"
            className={`toggle-btn ${showPassOnly ? 'active' : ''}`}
            onClick={() => setShowPassOnly(true)}
          >
            <span className="dot-indicator green"></span>
            Passing only
          </button>
          <button
            id="btn-filter-all"
            className={`toggle-btn ${!showPassOnly ? 'active' : ''}`}
            onClick={() => setShowPassOnly(false)}
          >
            <span className="dot-indicator gray"></span>
            All stocks
          </button>
        </div>

        <div className="export-container" ref={exportDropdownRef}>
          <button
            id="btn-export-csv"
            className="export-btn"
            onClick={() => setExportOpen(!exportOpen)}
          >
            Export CSV
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z" />
            </svg>
          </button>
          {exportOpen && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={exportAllFields}>
                Full CSV
              </button>
              <button className="dropdown-item" onClick={exportTickersOnly}>
                Only Tickers
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Main Table Grid */}
      {loading ? (
        <div className="no-data-view">
          <div className="no-data-icon">⏳</div>
          <p>Loading market screening metrics...</p>
        </div>
      ) : errorState ? (
        <div className="no-data-view">
          <div className="no-data-icon">⚠️</div>
          <p>No screener data was found. The screener runs weekdays at 9 PM UTC after market close.</p>
        </div>
      ) : (
        <section className="table-container">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.field}
                    className={col.isSticky ? col.class : undefined}
                    onClick={() => handleSort(col.field)}
                  >
                    {col.label}
                    {sortField === col.field && (
                      <span className="sort-arrow">
                        {sortAsc ? '▲' : '▼'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="no-results-msg">
                    No matching stocks found.
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => (
                  <tr key={row.ticker}>
                    {columns.map((col) => (
                      <td
                        key={col.field}
                        className={col.isSticky ? col.class : undefined}
                      >
                        {renderCell(row, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
