import React, { useState, useCallback, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { PlateAnalyzer } from './components/PlateAnalyzer';
import { ResultsDisplay } from './components/ResultsDisplay';
import { processWellPlate } from './services/wellPlateProcessor';
import type { WellResult, Point, GridConfig } from './types';
import { WelcomePage } from './components/WelcomePage';
import { SunIcon, MoonIcon } from './components/icons';

type AppState = 'welcome' | 'uploading' | 'analyzing' | 'processing' | 'results' | 'error';
type IC50Result = { value: number; units: string; } | null;

function App() {
  const [appState, setAppState] = useState<AppState>('welcome');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [processedImageUrl, setProcessedImageUrl] = useState<string>('');
  const [results, setResults] = useState<WellResult[]>([]);
  const [ic50, setIc50] = useState<IC50Result>(null);
  const [error, setError] = useState<string>('');
  
  const [gridConfig, setGridConfig] = useState<GridConfig | null>(null);
  const [gridDimensions, setGridDimensions] = useState<{ rows: number, cols: number }>({ rows: 0, cols: 0 });

  const [rowConcentrations, setRowConcentrations] = useState<number[]>([]);
  const [concentrationUnits, setConcentrationUnits] = useState<string>('nM');

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedTheme = window.localStorage.getItem('theme');
      if (savedTheme === 'light' || savedTheme === 'dark') {
        return savedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        return 'light';
      }
    }
    return 'dark';
  });

  useEffect(() => {
    window.localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'dark' ? 'light' : 'dark');
  };

  const handleImageUpload = useCallback((file: File) => {
    setImageFile(file);
    const newImageUrl = URL.createObjectURL(file);
    setImageUrl(newImageUrl);
    setProcessedImageUrl(newImageUrl); // Initially, processed image is the original
    setAppState('analyzing');
  }, []);

  const handleAnalysisComplete = useCallback(async (
    newGridConfig: GridConfig,
    rowCount: number,
    colCount: number,
    negP: Point, 
    posP: Point,
    newRowConcentrations: number[],
    newConcentrationUnits: string,
    imageDataUrl?: string
  ) => {
    const sourceImageUrl = imageDataUrl || imageUrl;
    if (!sourceImageUrl) return;

    setProcessedImageUrl(sourceImageUrl);
    setGridConfig(newGridConfig);
    setGridDimensions({ rows: rowCount, cols: colCount });
    setRowConcentrations(newRowConcentrations);
    setConcentrationUnits(newConcentrationUnits);
    setAppState('processing');
    try {
      const { wellResults, ic50: calculatedIc50 } = await processWellPlate(
        sourceImageUrl, 
        newGridConfig,
        rowCount,
        colCount,
        negP, 
        posP, 
        newRowConcentrations, 
        newConcentrationUnits
      );
      setResults(wellResults);
      setIc50(calculatedIc50);
      setAppState('results');
    } catch (e) {
      console.error("Analysis failed:", e);
      const errorMessage = e instanceof Error ? e.message : "Analysis failed. Please try again.";
      setError(errorMessage);
      setAppState('error');
    }
  }, [imageUrl]);
  
  const handleReset = useCallback(() => {
    setAppState('uploading');
    setImageFile(null);
    if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
    }
    setImageUrl('');
    setProcessedImageUrl('');
    setResults([]);
    setIc50(null);
    setError('');
    setGridConfig(null);
    setGridDimensions({ rows: 0, cols: 0 });
    setRowConcentrations([]);
    setConcentrationUnits('nM');
  }, [imageUrl]);
  
  const renderContent = () => {
    switch (appState) {
      case 'welcome':
        return <WelcomePage onStart={() => setAppState('uploading')} />;
      case 'uploading':
        return <ImageUploader onImageUpload={handleImageUpload} />;
      case 'analyzing':
        if (!imageFile) {
            handleReset(); // Should not happen
            return null;
        }
        return <PlateAnalyzer imageFile={imageFile} onAnalysisComplete={handleAnalysisComplete} onCancel={handleReset} />;
      case 'processing':
        return (
          <div className="flex flex-col items-center justify-center p-8">
            <svg className="animate-spin -ml-1 mr-3 h-10 w-10 text-[--color-accent-primary]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="mt-4 text-lg font-semibold">Analyzing plate, please wait...</p>
          </div>
        );
      case 'results':
        return <ResultsDisplay 
                  results={results} 
                  ic50={ic50} 
                  imageUrl={processedImageUrl} 
                  gridConfig={gridConfig!} 
                  rowCount={gridDimensions.rows}
                  colCount={gridDimensions.cols}
                  onReset={handleReset} 
                  rowConcentrations={rowConcentrations}
                  concentrationUnits={concentrationUnits}
                />;
      case 'error':
        return (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600">An Error Occurred</h2>
            <p className="text-red-500 mt-2">{error}</p>
            <button onClick={handleReset} className="mt-6 px-4 py-2 bg-[--color-accent-primary] text-[--color-accent-primary-text] font-semibold rounded-lg shadow-md hover:bg-[--color-accent-primary-hover] transition-colors">
              Try Again
            </button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen font-sans">
      <header className="bg-[--color-background-secondary] shadow-md">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold leading-tight">Well Plate IC50 Analyzer</h1>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[--color-text-secondary] bg-[--color-background-tertiary] rounded-lg hover:bg-[--color-background-tertiary-hover] transition-colors"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? 
              <SunIcon className="w-5 h-5" /> : 
              <MoonIcon className="w-5 h-5" />
            }
            <span className="hidden sm:inline">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-[--color-background-secondary] shadow-xl rounded-lg p-4 sm:p-6 md:p-8">
            {renderContent()}
          </div>
        </div>
      </main>
      <footer className="text-center py-4 text-sm text-[--color-text-muted]">
        <p>Built with React & TypeScript.</p>
      </footer>
    </div>
  );
}

export default App;