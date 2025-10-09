import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import type { WellResult, GridConfig } from '../types';
import { DownloadIcon, StartOverIcon } from './icons';

type IC50Result = { value: number; units: string; } | null;

interface ResultsDisplayProps {
  results: WellResult[];
  ic50: IC50Result;
  imageUrl: string;
  gridConfig: GridConfig;
  rowCount: number;
  colCount: number;
  onReset: () => void;
  rowConcentrations: number[];
  concentrationUnits: string;
}

// Helper component to render a single grid table
const ResultsGrid: React.FC<{
  title: string;
  data: number[][];
  formatter: (value: number) => string | number;
  colHeaders?: (string | number)[];
  rowHeaders?: (string | number)[];
}> = ({ title, data, formatter, colHeaders, rowHeaders }) => {
  const defaultRowHeaders = Array.from({ length: data.length }, (_, i) => String.fromCharCode(65 + i));
  const defaultColHeaders = Array.from({ length: data[0]?.length || 0 }, (_, i) => i + 1);
  const displayColHeaders = colHeaders || defaultColHeaders;
  const displayRowHeaders = rowHeaders || defaultRowHeaders;

  return (
    <div className="flex-1 flex flex-col">
       <h3 className="text-xl font-bold text-center mb-2">{title}</h3>
       <div className="overflow-x-auto rounded-lg border border-[--color-border-secondary]">
        <table className="w-full text-sm text-center text-[--color-text-muted]">
            <thead className="text-xs text-[--color-table-header-text] uppercase bg-[--color-table-header-bg]">
            <tr>
                <th scope="col" className="px-2 py-2"></th>
                {displayColHeaders.map((header, index) => <th key={index} scope="col" className="px-2 py-2 whitespace-nowrap">{header}</th>)}
            </tr>
            </thead>
            <tbody>
            {data.map((row, rowIndex) => (
                <tr key={rowIndex} className="bg-[--color-background-secondary] border-b border-[--color-border-secondary] hover:bg-[--color-table-row-hover-bg]">
                <th scope="row" className="px-2 py-2 font-medium text-[--color-text-primary] whitespace-nowrap">
                    {displayRowHeaders[rowIndex]}
                </th>
                {row.map((cell, colIndex) => (
                    <td key={colIndex} className="px-2 py-2">{formatter(cell)}</td>
                ))}
                </tr>
            ))}
            </tbody>
        </table>
       </div>
    </div>
  );
};


// Dose-Response Curve Component
const DoseResponseCurve: React.FC<{
  data: { concentration: number; viability: number }[];
  ic50: IC50Result;
  units: string;
}> = ({ data, ic50, units }) => {
  if (data.length < 2) {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-4 border rounded-lg border-[--color-border-secondary] bg-[--color-background-primary]">
            <h3 className="text-xl font-bold text-center mb-2">Dose-Response Curve</h3>
            <p className="text-[--color-text-muted]">Not enough data to draw a curve.</p>
        </div>
    );
  }

  const width = 500;
  const height = 400;
  const margin = { top: 20, right: 20, bottom: 60, left: 60 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const xMax = Math.max(...data.map(d => d.concentration));
  const yMax = 100;

  const xScale = (x: number) => (x / xMax) * innerWidth;
  const yScale = (y: number) => innerHeight - (y / yMax) * innerHeight;

  const linePath = data.map(d => `${xScale(d.concentration)},${yScale(d.viability)}`).join(' ');

  const xTicks = Array.from({ length: 5 }, (_, i) => (xMax / 4) * i);
  const yTicks = [0, 25, 50, 75, 100];

  const ic50X = ic50 ? xScale(ic50.value) : null;
  const fiftyY = yScale(50);
  
  return (
    <div className="flex-1 flex flex-col">
      <h3 className="text-xl font-bold text-center mb-2">Dose-Response Curve</h3>
      <div className="p-4 border rounded-lg border-[--color-border-secondary] bg-[--color-background-primary] flex justify-center items-center">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-[--color-text-primary]">
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Axes and Grid Lines */}
            <line x1="0" y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="currentColor" strokeOpacity="0.3" />
            <line x1="0" y1="0" x2="0" y2={innerHeight} stroke="currentColor" strokeOpacity="0.3" />
            
            {/* Ticks */}
            {yTicks.map(tick => (
                <g key={`y-tick-${tick}`} transform={`translate(0, ${yScale(tick)})`}>
                    <line x1="-5" x2={innerWidth} stroke="currentColor" strokeOpacity="0.1" />
                    <text x="-10" dy=".32em" textAnchor="end" fontSize="12">{tick}</text>
                </g>
            ))}
            {xTicks.map(tick => (
                 <g key={`x-tick-${tick}`} transform={`translate(${xScale(tick)}, ${innerHeight})`}>
                    <line y2="5" stroke="currentColor" strokeOpacity="0.3" />
                    <text y="20" textAnchor="middle" fontSize="12">{tick.toPrecision(2)}</text>
                </g>
            ))}
            
             {/* Axis Labels */}
            <text transform={`translate(${innerWidth / 2}, ${innerHeight + 45})`} textAnchor="middle" fontSize="14" fontWeight="bold">Concentration ({units})</text>
            <text transform={`rotate(-90)`} x={-innerHeight / 2} y={-45} textAnchor="middle" fontSize="14" fontWeight="bold">Viability (%)</text>

            {/* IC50 Lines */}
            {ic50 && ic50X !== null && ic50X > 0 && ic50X < innerWidth && (
              <>
                <line x1={ic50X} y1={innerHeight} x2={ic50X} y2={fiftyY} stroke="red" strokeDasharray="4" />
                <line x1="0" y1={fiftyY} x2={ic50X} y2={fiftyY} stroke="red" strokeDasharray="4" />
                <text x={ic50X} y={innerHeight + 20} textAnchor="middle" fill="red" fontSize="12">{ic50.value.toPrecision(3)}</text>
                <text x={-10} y={fiftyY} textAnchor="end" dy=".32em" fill="red" fontSize="12">50</text>
              </>
            )}

            {/* Data line and points */}
            <polyline points={linePath} fill="none" strokeWidth="2" className="stroke-[--color-text-secondary]" />
            {data.map(d => (
              <circle key={d.concentration} cx={xScale(d.concentration)} cy={yScale(d.viability)} r="4" fill="rgb(59 130 246)" />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
};


export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, ic50, imageUrl, gridConfig, rowCount, colCount, onReset, rowConcentrations, concentrationUnits }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const radius = useMemo(() => {
    // This factor must match the one in wellPlateProcessor.ts for consistency.
    const WELL_RADIUS_FACTOR = 0.30;
    if (!gridConfig) return 0;
    const u_mag = Math.hypot(gridConfig.u.x, gridConfig.u.y);
    const v_mag = Math.hypot(gridConfig.v.x, gridConfig.v.y);
    return Math.min(u_mag, v_mag) * WELL_RADIUS_FACTOR;
  }, [gridConfig]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = image.offsetWidth;
    canvas.height = image.offsetHeight;

    const scaleX = image.naturalWidth / image.offsetWidth;
    const scaleY = image.naturalHeight / image.offsetHeight;

    results.forEach(well => {
      const { center, avgColor, id } = well;
      const displayX = center.x / scaleX;
      const displayY = center.y / scaleY;
      const displayRadius = radius / scaleX;

      ctx.beginPath();
      ctx.arc(displayX, displayY, displayRadius, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(${avgColor.r}, ${avgColor.g}, ${avgColor.b}, 0.9)`;
      ctx.lineWidth = 3;
      ctx.stroke();
      
      ctx.font = 'bold 11px sans-serif';
      const text = `${id}`;
      ctx.textAlign = 'center';
      // Add a stroke for better visibility on any background
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.lineWidth = 2;
      ctx.strokeText(text, displayX, displayY + 4);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillText(text, displayX, displayY + 4);
    });
  }, [results, radius]);
  
  useEffect(() => {
    const image = imageRef.current;
    if (image) {
      const handleLoad = () => draw();
      image.addEventListener('load', handleLoad);
      if (image.complete) handleLoad();
      const handleResize = () => draw();
      window.addEventListener('resize', handleResize);
      return () => {
        image.removeEventListener('load', handleLoad);
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [draw]);

  const processResultsIntoGrid = useCallback(() => {
    const grid: number[][] = Array(rowCount).fill(0).map(() => Array(colCount).fill(0));
    results.forEach(well => {
        if (well.row < rowCount && well.col < colCount) {
            grid[well.row][well.col] = well.viability;
        }
    });
    return grid;
  }, [results, rowCount, colCount]);

  const viabilityData = processResultsIntoGrid();
  
  const doseResponseData = useMemo(() => {
    const viabilitiesByRow: number[][] = Array.from({ length: rowCount }, () => []);
    results.forEach(well => {
        viabilitiesByRow[well.row].push(well.viability);
    });

    return rowConcentrations
      .map((concentration, rowIndex) => {
          if (concentration <= 0 || viabilitiesByRow[rowIndex].length === 0) {
              return null;
          }
          const viabilities = viabilitiesByRow[rowIndex];
          const avgViability = viabilities.reduce((sum, v) => sum + v, 0) / viabilities.length;
          return {
              concentration,
              viability: avgViability
          };
      })
      .filter((p): p is { concentration: number; viability: number } => p !== null)
      .sort((a, b) => a.concentration - b.concentration);
  }, [results, rowConcentrations, rowCount]);


  const customRowHeaders = useMemo(() => {
    const defaultRowHeaders = Array.from({ length: rowCount }, (_, i) => String.fromCharCode(65 + i));
    return defaultRowHeaders.map((header, i) => {
      const conc = rowConcentrations[i];
      if (conc > 0) {
        return `${header} (${conc} ${concentrationUnits})`;
      }
      return header;
    });
  }, [rowCount, rowConcentrations, concentrationUnits]);
  
  const downloadCSV = () => {
    const colHeaders = Array.from({ length: colCount }, (_, i) => i + 1);
    
    let csvContent = `IC50,${ic50 ? `${ic50.value.toPrecision(5)} ${ic50.units}` : 'Not calculated'}\n\n`;
    csvContent += "Well Viability (%)\n";
    csvContent += `Row,${colHeaders.join(',')}\n`;
    viabilityData.forEach((row, rowIndex) => {
        const rowHeader = customRowHeaders[rowIndex].includes(',') ? `"${customRowHeaders[rowIndex]}"` : customRowHeaders[rowIndex];
        csvContent += `${rowHeader},${row.map(val => val.toFixed(2)).join(',')}\n`;
    });


    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "well_plate_ic50_analysis.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Analysis Results</h2>
        <div className="flex gap-2">
            <button onClick={downloadCSV} className="flex items-center justify-center px-4 py-2 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 transition-colors">
                <DownloadIcon className="w-5 h-5 mr-2" />
                Download CSV
            </button>
            <button onClick={onReset} className="flex items-center justify-center px-4 py-2 bg-[--color-button-secondary-bg] text-[--color-button-secondary-text] font-semibold rounded-lg hover:bg-[--color-button-secondary-hover-bg] transition-colors">
                <StartOverIcon className="w-5 h-5 mr-2" />
                Start Over
            </button>
        </div>
      </div>
      
      <div className="bg-[--color-background-tertiary] p-6 rounded-lg text-center shadow-inner">
        <h3 className="text-lg font-medium text-[--color-text-muted] uppercase tracking-wider">Calculated IC50 Value</h3>
        {ic50 ? (
          <>
            <p className="text-4xl font-bold text-[--color-accent-primary] mt-2">
              {ic50.value.toPrecision(4)} {ic50.units}
            </p>
            <p className="text-xs text-[--color-text-muted] mt-2">
                Calculated using linear interpolation between the data points surrounding 50% viability.
            </p>
          </>
        ) : (
          <p className="text-xl text-[--color-text-secondary] mt-2">
            Could not determine IC50. Ensure concentration points bracket 50% viability.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <div className="relative w-full rounded-lg overflow-hidden shadow-md">
            <img ref={imageRef} src={imageUrl} alt="Analyzed Well Plate" className="w-full h-auto block" />
            <canvas ref={canvasRef} className="absolute top-0 left-0 w-full h-full pointer-events-none" />
        </div>

        <div className="flex flex-col gap-8">
            <DoseResponseCurve 
              data={doseResponseData}
              ic50={ic50}
              units={concentrationUnits}
            />
            <ResultsGrid 
                title="Well Viability (%)" 
                data={viabilityData} 
                formatter={(val) => val.toFixed(1)}
                rowHeaders={customRowHeaders}
                colHeaders={Array.from({ length: colCount }, (_, i) => i + 1)}
            />
        </div>
      </div>
    </div>
  );
};