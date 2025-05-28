import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import StatisticsDisplay from './StatisticsDisplay'; 

function App() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const getTodayDateString = useCallback(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    const day = now.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const [currentDate, setCurrentDate] = useState(getTodayDateString());
  const [statistics, setStatistics] = useState(null);
  const [loadingStatistics, setLoadingStatistics] = useState(false);
  const [errorStatistics, setErrorStatistics] = useState(null);

  const [selectedTimeFilter, setSelectedTimeFilter] = useState(0); 

  const fetchResults = useCallback(async (dateToFetch, activeTimeFilterHours) => {
    setLoading(true);
    setError(null);
    let apiUrl = `/api/results?date=${dateToFetch}`;

    const isToday = dateToFetch === getTodayDateString();
    if (isToday && activeTimeFilterHours > 0) {
      apiUrl += `&time_filter_hours=${activeTimeFilterHours}`;
      // console.log(`fetchResults: Aplicando filtro de ${activeTimeFilterHours} hora(s) para hoje.`);
    } else {
      // console.log(`fetchResults: Buscando dia inteiro para ${dateToFetch}.`);
    }

    try {
      if (!dateToFetch) {
        dateToFetch = getTodayDateString();
      }
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Erro HTTP ao buscar resultados! Status: ${response.status}`);
      }
      const data = await response.json();
      const sortedData = data.sort((a, b) => {
        const dateA = new Date(a.horario_br);
        const dateB = new Date(b.horario_br);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) return 0;
        return dateB - dateA;
      });
      setResults(sortedData);
    } catch (e) {
      console.error("Erro ao buscar resultados:", e);
      setError("Não foi possível carregar os resultados.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [getTodayDateString]);

  const fetchStatistics = useCallback(async (dateToFetch, activeTimeFilterHours, isUpdate = false) => {
    if (!dateToFetch) return;

    if (!isUpdate) {
      setLoadingStatistics(true);
    }
    setErrorStatistics(null); 
    
    let apiUrl = `/api/statistics?date=${dateToFetch}`;
    const isToday = dateToFetch === getTodayDateString();
    if (isToday && activeTimeFilterHours > 0) {
      apiUrl += `&time_filter_hours=${activeTimeFilterHours}`;
      // console.log(`fetchStatistics: Aplicando filtro de ${activeTimeFilterHours} hora(s) para hoje.`);
    } else {
      // console.log(`fetchStatistics: Buscando estatísticas do dia inteiro para ${dateToFetch}.`);
    }

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Erro HTTP ao buscar estatísticas! Status: ${response.status}`);
      }
      const data = await response.json();
      setStatistics(data);
    } catch (e) {
      console.error("Erro ao buscar estatísticas:", e);
      setErrorStatistics("Não foi possível carregar as estatísticas.");
      setStatistics(null);
    } finally {
      if (!isUpdate) {
        setLoadingStatistics(false);
      }
    }
  }, [getTodayDateString]);


  useEffect(() => {
    setResults([]); 
    setStatistics(null); 
    
    const loadDataAndStatsForDate = async () => {
      await fetchResults(currentDate, selectedTimeFilter);
      await fetchStatistics(currentDate, selectedTimeFilter, false); 
    };
    
    loadDataAndStatsForDate();

    const intervalId = setInterval(async () => {
        if (currentDate === getTodayDateString()) { 
            await fetchResults(currentDate, selectedTimeFilter);
            await fetchStatistics(currentDate, selectedTimeFilter, true); 
        }
    }, 5000); 
    
    return () => clearInterval(intervalId);
  }, [currentDate, fetchResults, fetchStatistics, getTodayDateString, selectedTimeFilter]);


  const goToPreviousDay = () => {
    const tempDate = new Date(currentDate + 'T12:00:00');
    if (isNaN(tempDate.getTime())) return;
    tempDate.setDate(tempDate.getDate() - 1);
    setCurrentDate(tempDate.toISOString().slice(0, 10));
    setSelectedTimeFilter(0); 
  };

  const goToNextDay = () => {
    const tempDate = new Date(currentDate + 'T12:00:00');
    if (isNaN(tempDate.getTime())) return;
    const todayForComparison = new Date(getTodayDateString() + 'T12:00:00');
    if (tempDate >= todayForComparison) return;
    tempDate.setDate(tempDate.getDate() + 1);
    setCurrentDate(tempDate.toISOString().slice(0, 10));
    setSelectedTimeFilter(0); 
  };
  
  const handleTimeFilterChange = (event) => {
    setSelectedTimeFilter(parseInt(event.target.value, 10));
  };

  const isToday = currentDate === getTodayDateString();
  const todayDateObj = new Date(getTodayDateString() + 'T00:00:00');
  const displayedDateObj = new Date(currentDate + 'T00:00:00');
  const isNextDayButtonDisabled = displayedDateObj >= todayDateObj || isSameDay(displayedDateObj, todayDateObj);

  function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
  }

  const groupResultsForFixedColumns = (data) => {
    const grouped = {};
    data.forEach(result => {
      const date = new Date(result.horario_br);
      if (isNaN(date.getTime())) {
        console.warn("Resultado com data inválida da API, ignorando:", result);
        return;
      }
      const dateKey = date.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
      const hourKey = date.getHours().toString().padStart(2, '0');
      const minuteExact = date.getMinutes();
      const second = date.getSeconds();
      const startOfTenMinuteBlock = Math.floor(minuteExact / 10) * 10;
      const blockKey = `${hourKey}:${startOfTenMinuteBlock.toString().padStart(2, '0')}`;
      const minuteColumnIndex = minuteExact % 10;
      const slotIndex = second >= 30 ? 1 : 0;

      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][blockKey]) {
        grouped[dateKey][blockKey] = Array.from({ length: 10 }, () => [null, null]);
      }
      if (!grouped[dateKey][blockKey][minuteColumnIndex]) {
        grouped[dateKey][blockKey][minuteColumnIndex] = [null, null];
      }

      const currentSlotResult = grouped[dateKey][blockKey][minuteColumnIndex][slotIndex];
      if (currentSlotResult === null || new Date(result.horario_br) > new Date(currentSlotResult.horario_br)) {
        grouped[dateKey][blockKey][minuteColumnIndex][slotIndex] = result;
      }
    });
    return grouped;
  };

  const groupedResults = useMemo(() => {
    return groupResultsForFixedColumns(results);
  }, [results]);

  let formattedDisplayDate = "Carregando...";
  try {
    const displayDate = new Date(currentDate + 'T12:00:00');
    if (!isNaN(displayDate.getTime())) {
      formattedDisplayDate = displayDate.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    } else {
      formattedDisplayDate = "Data Inválida";
    }
  } catch (e) {
    formattedDisplayDate = "Erro na Data";
  }

  if (loading && results.length === 0 && statistics === null) {
    return <div className="container">Carregando dados para {formattedDisplayDate}...</div>;
  }
  if (error) {
    return <div className="container error">{error}</div>;
  }

  return (
    <div className="container">
      <h1>Resultados do Blaze Double</h1>

      <div className="navigation-controls">
        <div className="date-navigation">
          <button onClick={goToPreviousDay}>&larr; Dia Anterior</button>
          <h2 className="current-display-date">Data: {formattedDisplayDate}</h2>
          <button onClick={goToNextDay} disabled={isNextDayButtonDisabled}>Dia Seguinte &rarr;</button>
        </div>

        {isToday && (
          <div className="time-filter-selector">
            <label htmlFor="timeFilter">Mostrar: </label>
            <select id="timeFilter" value={selectedTimeFilter} onChange={handleTimeFilterChange}>
              <option value="0">Dia Inteiro</option>
              {/* Gerar opções de 1 a 12 horas dinamicamente */}
              {Array.from({ length: 12 }, (_, i) => i + 1).map(hour => (
                <option key={hour} value={hour}>
                  Última{hour > 1 ? 's' : ''} {hour} Hora{hour > 1 ? 's' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {Object.keys(groupedResults).length === 0 && !loading ? (
        <p className="no-results-message">
          Nenhum resultado disponível para este período.
          {currentDate === getTodayDateString() && selectedTimeFilter === 0 && " Aguardando a coleta..."}
        </p>
      ) : (
        Object.keys(groupedResults)
          .map(dateKey => (
            <div key={dateKey} className="date-section">
              {Object.keys(groupedResults[dateKey])
                .sort((a,b) => b.localeCompare(a))
                .map(blockKey => (
                  <div key={`${dateKey}-${blockKey}`} className="time-block">
                    <div className="time-block-label">{blockKey}</div>
                    <div className="minute-grid-wrapper">
                      <div className="minute-header-row">
                        {Array.from({ length: 10 }, (_, i) => (
                          <div key={i} className="minute-header-cell">{i.toString().padStart(2, '0')}</div>
                        ))}
                      </div>
                      <div className="results-row-grid">
                        {groupedResults[dateKey][blockKey].map((minuteSlots, minIdx) => (
                          <div key={`${dateKey}-${blockKey}-min-${minIdx}`} className="minute-column-slots">
                            {minuteSlots.map((result, slotIdx) => (
                              result ? (
                                <div key={result.blaze_id ? `${result.blaze_id}-${slotIdx}` : `result-${dateKey}-${blockKey}-${minIdx}-${slotIdx}`} className="result-and-time-wrapper">
                                  <div className={`result-item ${result.cor.toLowerCase()}`}>
                                    <span className="result-number">{result.numero}</span>
                                  </div>
                                  <span className="result-time">
                                    {new Date(result.horario_br).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo'})}
                                  </span>
                                </div>
                              ) : (
                                <div key={`empty-${dateKey}-${blockKey}-${minIdx}-${slotIdx}`} className="result-and-time-wrapper">
                                  <div className="result-item placeholder"></div>
                                  <span className="result-time placeholder-time">--:--:--</span>
                                </div>
                              )
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          ))
      )}

      <StatisticsDisplay 
        statistics={statistics} 
        loading={loadingStatistics} 
        error={errorStatistics} 
      />
    </div>
  );
}

export default App;