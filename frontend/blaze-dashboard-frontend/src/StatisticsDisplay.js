// src/StatisticsDisplay.js
import React from 'react';

// Mapeamento de cores para português
const colorNamesPt = {
  red: "Vermelho",
  black: "Preto",
  white: "Branco"
};

const StatisticsDisplay = React.memo(({ statistics, loading, error }) => {
  // console.log("StatisticsDisplay renderizou. Loading:", loading, "Stats:", statistics);

  if (loading) { 
    return <div className="statistics-loading">Carregando estatísticas...</div>;
  }

  if (error) {
    return <div className="statistics-error error">{error}</div>;
  }

  if (!statistics) {
    return <div className="statistics-info"><p>Nenhuma estatística para exibir no momento.</p></div>; 
  }

  const totalResults = statistics.total_results_in_period; 
  const totalWhites = statistics.total_whites_in_period;
  const dateRequested = statistics.date_requested || "Data não disponível";
  const appliedFilterHours = statistics.time_filter_applied_hours;
  let titleDatePart = dateRequested;
  if (appliedFilterHours) {
    titleDatePart += ` (Última${appliedFilterHours > 1 ? 's' : ''} ${appliedFilterHours} Hora${appliedFilterHours > 1 ? 's' : ''})`;
  }

  const hourlyStatsData = statistics.color_stats_hourly && typeof statistics.color_stats_hourly === 'object'
    ? statistics.color_stats_hourly
    : null;
  
  const hourlyKeys = hourlyStatsData
    ? Object.keys(hourlyStatsData).sort((a, b) => parseInt(a) - parseInt(b))
    : [];

  const sequenceStatsData = statistics.sequence_stats && typeof statistics.sequence_stats === 'object'
    ? statistics.sequence_stats
    : null;

  return (
    <div className="statistics-section">
      <h2>Estatísticas para {titleDatePart}</h2>
      <p>Total de Resultados no Período: {totalResults !== undefined ? totalResults : "N/A"}</p>
      {/* LINHA MODIFICADA - ADICIONADA A CLASSE "total-whites-highlight" */}
      {totalWhites !== undefined && (
         <p className="total-whites-highlight">Total de Brancos no Período: {totalWhites}</p>
      )}
      
      {totalResults > 0 ? (
        <>
          {/* Estatísticas de Cores por Hora */}
          {hourlyStatsData ? (
            <div className="stats-subsection">
              <h3>Frequência das Cores por Hora (no período):</h3>
              {hourlyKeys.length > 0 ? (
                hourlyKeys.map(hourKey => {
                  const hourlyData = hourlyStatsData[hourKey];
                  const colorsDetail = hourlyData && hourlyData.colors && typeof hourlyData.colors === 'object' 
                                       ? hourlyData.colors 
                                       : null;

                  if (!hourlyData) return null; 

                  return (
                    <div key={hourKey} className="hourly-stat-block">
                      <h4>Hora: {hourKey}:00 - {hourKey}:59 <span className="hourly-total">(Total na hora: {hourlyData.total_results_in_hour !== undefined ? hourlyData.total_results_in_hour : 'N/A'})</span></h4>
                      {colorsDetail ? (
                        <div className="hourly-color-details">
                          {Object.entries(colorsDetail)
                            .sort(([colorA], [colorB]) => {
                               const order = { red: 0, black: 1, white: 2 };
                               return (order[colorA] ?? 99) - (order[colorB] ?? 99);
                            })
                            .map(([colorKey, stats]) => (
                              <div key={`${hourKey}-${colorKey}`} className={`color-stat-item color-stat-${colorKey.toLowerCase()}`}>
                                <strong>{colorNamesPt[colorKey] || colorKey}:</strong> 
                                {' '}{stats.count !== undefined ? stats.count : 'N/A'} vez(es) 
                                ({stats.percentage !== undefined ? stats.percentage : 'N/A'}%)
                              </div>
                          ))}
                        </div>
                      ) : (
                        <p>Dados de cores para esta hora não disponíveis.</p>
                      )}
                    </div>
                  );
                })
              ) : (
                <p>Nenhuma estatística de cor por hora disponível para este período.</p>
              )}
            </div>
          ) : (
            <div className="stats-subsection"><p>Estatísticas de cores por hora não disponíveis.</p></div>
          )}

          {/* Estatísticas de Sequência */}
          {sequenceStatsData ? (
            <div className="stats-subsection">
              <h3>Estatísticas de Sequência (no período):</h3>
              <div className="sequence-stats-list">
                <div className="sequence-stat-item">
                  <strong>Maior sequência de Vermelhos:</strong> {sequenceStatsData.longest_red_streak !== undefined ? sequenceStatsData.longest_red_streak : 0}
                </div>
                <div className="sequence-stat-item">
                  <strong>Maior sequência de Pretos:</strong> {sequenceStatsData.longest_black_streak !== undefined ? sequenceStatsData.longest_black_streak : 0}
                </div>
                <div className="sequence-stat-item">
                  <strong>Maior sequência de Brancos:</strong> {sequenceStatsData.longest_white_streak !== undefined ? sequenceStatsData.longest_white_streak : 0}
                </div>
                <div className="sequence-stat-item">
                  <strong>Maior sequência sem Brancos:</strong> {sequenceStatsData.longest_streak_without_white !== undefined ? sequenceStatsData.longest_streak_without_white : 0}
                </div>
              </div>
            </div>
          ) : (
            <div className="stats-subsection"><p>Estatísticas de sequência não disponíveis.</p></div>
          )}
        </>
      ) : (
        <p>Nenhum resultado no período para calcular estatísticas.</p>
      )}
    </div>
  );
});

export default StatisticsDisplay;