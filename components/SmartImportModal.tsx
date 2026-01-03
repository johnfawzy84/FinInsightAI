import React, { useState, useEffect, useRef } from 'react';
import { ImportSettings, ColumnMapping, Transaction, CategorizationRule, Category } from '../types';
import { readCsvPreview, parseMappedData } from '../utils/parser';
import { categorizeTransactionsAI } from '../services/gemini';
import { applyRulesToTransactions } from '../hooks/useSessionData';
import { Upload, ArrowRight, Settings, CheckCircle, AlertTriangle, Loader2, FileText, ChevronRight, Wand2, X, Download, BrainCircuit, Tag } from 'lucide-react';

interface SmartImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (transactions: Transaction[], newCategories: string[], source: string) => void;
  existingRules: CategorizationRule[];
  existingCategories: string[];
  defaultSettings: ImportSettings;
  existingSources: string[];
}

type ImportStep = 'upload' | 'mapping' | 'processing' | 'results';

export const SmartImportModal: React.FC<SmartImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingRules,
  existingCategories,
  defaultSettings,
  existingSources
}) => {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [rawPreview, setRawPreview] = useState<{ headers: string[], rows: string[][] } | null>(null);
  const [settings, setSettings] = useState<ImportSettings>(defaultSettings);
  const [sourceName, setSourceName] = useState('');
  
  const [mapping, setMapping] = useState<ColumnMapping>({
    dateIndex: -1,
    descriptionIndex: -1,
    amountIndex: -1,
    categoryIndex: -1,
    typeIndex: -1
  });

  const [processStatus, setProcessStatus] = useState<{ 
    current: string; 
    progress: number; 
    aiCount: number; 
  }>({ current: '', progress: 0, aiCount: 0 });

  const [result, setResult] = useState<{ success: Transaction[], failed: any[] }>({ success: [], failed: [] });
  const [resolvedFailed, setResolvedFailed] = useState<number[]>([]); // Indices of failed rows ignored/handled

  // Reset state on open
  useEffect(() => {
    if (isOpen) {
        setStep('upload');
        setFile(null);
        setRawPreview(null);
        setResult({ success: [], failed: [] });
        setResolvedFailed([]);
        setSourceName('');
    }
  }, [isOpen]);

  // --- Step 1: File Upload & Analysis ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      // Auto-detect delimiter if CSV
      let detectDelim = settings.delimiter;
      if (selectedFile.name.endsWith('.csv')) {
         // Simple sniff
         const text = await selectedFile.slice(0, 500).text();
         if ((text.match(/;/g) || []).length > (text.match(/,/g) || []).length) detectDelim = ';';
         else detectDelim = ',';
         setSettings(prev => ({ ...prev, delimiter: detectDelim }));
      }
      
      try {
        const { headers, preview } = await readCsvPreview(selectedFile, detectDelim);
        setRawPreview({ headers, rows: preview });
        guessMapping(headers, preview);
        setStep('mapping');
        // Auto-suggest source name from filename
        const suggested = selectedFile.name.split('.')[0].replace(/[-_]/g, ' ');
        setSourceName(suggested);
      } catch (err) {
        alert("Could not read file. Please check format.");
      }
    }
  };

  const updatePreview = async () => {
    if (!file) return;
    try {
        const { headers, preview } = await readCsvPreview(file, settings.delimiter);
        setRawPreview({ headers, rows: preview });
    } catch (err) {
        console.error(err);
    }
  };

  // --- Step 2: Mapping Logic ---
  const guessMapping = (headers: string[], rows: string[][]) => {
     // Heuristics
     const lowerHeaders = headers.map(h => h.toLowerCase());
     const firstRow = rows[0] || [];

     let dateIdx = lowerHeaders.findIndex(h => h.includes('date') || h.includes('datum') || h.includes('zeit'));
     let amountIdx = lowerHeaders.findIndex(h => h.includes('amount') || h.includes('betrag') || h.includes('wert') || h.includes('saldo'));
     let descIdx = lowerHeaders.findIndex(h => h.includes('desc') || h.includes('text') || h.includes('verwendung') || h.includes('payee'));
     let catIdx = lowerHeaders.findIndex(h => h.includes('cat') || h.includes('kategorie'));
     let typeIdx = lowerHeaders.findIndex(h => h.includes('type') || h.includes('art'));

     // Fallback: Check content if header missing
     if (dateIdx === -1) dateIdx = firstRow.findIndex(c => c.match(/\d{1,4}[./-]\d{1,2}[./-]\d{1,4}/));
     if (amountIdx === -1) amountIdx = firstRow.findIndex(c => c.match(/-?\d+[.,]?\d*/));
     if (descIdx === -1) descIdx = firstRow.findIndex(c => c.length > 5 && !c.match(/\d/)); // Longest text field

     setMapping({
        dateIndex: dateIdx,
        descriptionIndex: descIdx,
        amountIndex: amountIdx,
        categoryIndex: catIdx,
        typeIndex: typeIdx
     });
  };

  const handleStartProcessing = async () => {
      if (!file || !rawPreview || !sourceName.trim()) {
          if (!sourceName.trim()) alert("Please identify the source of these transactions (e.g. 'Chase Checking').");
          return;
      }
      setStep('processing');
      setProcessStatus({ current: 'Parsing File...', progress: 10, aiCount: 0 });

      try {
          // 1. Read FULL file
          const { rows } = await readCsvPreview(file, settings.delimiter);
          
          // 2. Parse basic data
          const parsed = parseMappedData(rows, mapping, settings);
          let transactions = parsed.success;
          
          setProcessStatus({ current: 'Applying Rules...', progress: 30, aiCount: 0 });

          // 3. Apply Local Rules
          transactions = applyRulesToTransactions(transactions, existingRules);

          // 4. Identify transactions needing AI
          const needsAi = transactions.filter(t => t.category === Category.UNCATEGORIZED || t.category === 'Uncategorized');
          
          if (needsAi.length > 0) {
              setProcessStatus({ current: `AI Categorizing ${needsAi.length} transactions...`, progress: 50, aiCount: needsAi.length });
              
              // Batch AI calls (chunk of 50)
              const chunkSize = 50;
              let aiResults: { id: string, category: string }[] = [];
              
              for (let i = 0; i < needsAi.length; i += chunkSize) {
                  const chunk = needsAi.slice(i, i + chunkSize);
                  // Pass simplified objects to save tokens
                  const categorizedChunk = await categorizeTransactionsAI(
                      chunk.map(t => ({ id: t.id, description: t.description, amount: t.amount })),
                      existingCategories
                  );
                  aiResults = [...aiResults, ...categorizedChunk];
                  setProcessStatus(prev => ({ ...prev, progress: 50 + ((i / needsAi.length) * 40) }));
              }

              // Merge AI results
              const aiMap = new Map(aiResults.map(r => [r.id, r.category]));
              transactions = transactions.map(t => {
                  if (aiMap.has(t.id)) return { ...t, category: aiMap.get(t.id)! };
                  return t;
              });
          }

          setResult({ success: transactions, failed: parsed.failed });
          setStep('results');

      } catch (err) {
          console.error(err);
          alert("Error processing file.");
          setStep('mapping');
      }
  };

  // --- Render Helpers ---

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Wand2 className="text-indigo-400" /> Smart Import Wizard
                    </h2>
                    <div className="flex gap-2 mt-2">
                        {['Upload', 'Map Columns', 'Processing', 'Results'].map((s, i) => {
                            const stepIdx = ['upload', 'mapping', 'processing', 'results'].indexOf(step);
                            return (
                                <div key={s} className={`text-xs flex items-center gap-1 ${i <= stepIdx ? 'text-indigo-400 font-bold' : 'text-slate-600'}`}>
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${i <= stepIdx ? 'bg-indigo-500/20' : 'bg-slate-800 border border-slate-700'}`}>
                                        {i + 1}
                                    </div>
                                    {s}
                                    {i < 3 && <ChevronRight size={10} />}
                                </div>
                            )
                        })}
                    </div>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={24} /></button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-900">
                
                {/* STEP 1: UPLOAD */}
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="w-full max-w-lg border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50 rounded-2xl p-10 transition-all text-center group cursor-pointer relative">
                            <input 
                                type="file" 
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                accept=".csv,.xlsx,.xls,.txt"
                                onChange={handleFileSelect}
                            />
                            <div className="mx-auto bg-slate-800 p-4 rounded-full w-20 h-20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Upload size={32} className="text-indigo-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Click or Drag file to upload</h3>
                            <p className="text-slate-400 text-sm mt-2">Supports CSV, Excel (.xlsx)</p>
                        </div>
                    </div>
                )}

                {/* STEP 2: MAPPING */}
                {step === 'mapping' && rawPreview && (
                    <div className="space-y-6">
                        {/* Settings Bar */}
                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                             <div className="md:col-span-1">
                                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1 flex items-center gap-1">
                                    <Tag size={12}/> Import Source
                                </label>
                                <input 
                                    type="text"
                                    list="source-suggestions"
                                    value={sourceName}
                                    onChange={(e) => setSourceName(e.target.value)}
                                    placeholder="e.g. Chase Checking"
                                    className="w-full bg-slate-900 border border-indigo-500/50 rounded px-2 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                                />
                                <datalist id="source-suggestions">
                                    {existingSources.map(s => <option key={s} value={s} />)}
                                </datalist>
                             </div>
                             <div>
                                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1">Delimiter</label>
                                <select 
                                    value={settings.delimiter}
                                    onChange={e => { setSettings({...settings, delimiter: e.target.value}); setTimeout(updatePreview, 100); }}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                                >
                                    <option value=",">Comma (,)</option>
                                    <option value=";">Semicolon (;)</option>
                                    <option value="|">Pipe (|)</option>
                                    <option value="\t">Tab</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1">Date Format</label>
                                <select 
                                    value={settings.dateFormat}
                                    onChange={e => setSettings({...settings, dateFormat: e.target.value as any})}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                                >
                                    <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                                </select>
                             </div>
                             <div>
                                <label className="text-xs text-slate-400 font-semibold uppercase block mb-1">Decimal</label>
                                <select 
                                    value={settings.decimalSeparator}
                                    onChange={e => setSettings({...settings, decimalSeparator: e.target.value as any})}
                                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1.5 text-sm text-white"
                                >
                                    <option value=".">Dot (.)</option>
                                    <option value=",">Comma (,)</option>
                                </select>
                             </div>
                        </div>

                        {/* Mapping Table */}
                        <div className="overflow-x-auto border border-slate-700 rounded-xl bg-slate-800/20">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                                <thead>
                                    <tr>
                                        {rawPreview.headers.map((h, i) => (
                                            <th key={i} className="p-2 min-w-[150px] bg-slate-900 border-b border-slate-700">
                                                <div className="mb-2">
                                                    <select
                                                        className={`w-full text-xs p-1 rounded border focus:outline-none ${
                                                            Object.values(mapping).includes(i) 
                                                            ? 'bg-indigo-600 border-indigo-500 text-white font-bold' 
                                                            : 'bg-slate-800 border-slate-600 text-slate-400'
                                                        }`}
                                                        value={
                                                            mapping.dateIndex === i ? 'date' :
                                                            mapping.descriptionIndex === i ? 'desc' :
                                                            mapping.amountIndex === i ? 'amount' :
                                                            mapping.categoryIndex === i ? 'cat' :
                                                            mapping.typeIndex === i ? 'type' : ''
                                                        }
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            const newMap = { ...mapping };
                                                            // Clear previous assignment of this type
                                                            if (val === 'date') newMap.dateIndex = i;
                                                            if (val === 'desc') newMap.descriptionIndex = i;
                                                            if (val === 'amount') newMap.amountIndex = i;
                                                            if (val === 'cat') newMap.categoryIndex = i;
                                                            if (val === 'type') newMap.typeIndex = i;
                                                            if (val === '') {
                                                                if (newMap.dateIndex === i) newMap.dateIndex = -1;
                                                                if (newMap.descriptionIndex === i) newMap.descriptionIndex = -1;
                                                                if (newMap.amountIndex === i) newMap.amountIndex = -1;
                                                                if (newMap.categoryIndex === i) newMap.categoryIndex = -1;
                                                                if (newMap.typeIndex === i) newMap.typeIndex = -1;
                                                            }
                                                            setMapping(newMap);
                                                        }}
                                                    >
                                                        <option value="">Ignore</option>
                                                        <option value="date">Date (Required)</option>
                                                        <option value="desc">Description</option>
                                                        <option value="amount">Amount (Required)</option>
                                                        <option value="cat">Category</option>
                                                        <option value="type">Type (Inc/Exp)</option>
                                                    </select>
                                                </div>
                                                <div className="text-slate-300 font-mono text-xs truncate" title={h}>{h}</div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rawPreview.rows.map((row, idx) => (
                                        <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                                            {row.map((cell, cIdx) => (
                                                <td key={cIdx} className="p-2 text-slate-400 text-xs truncate max-w-[150px]">
                                                    {cell}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setStep('upload')} className="px-4 py-2 text-slate-400 hover:text-white">Back</button>
                            <button 
                                onClick={handleStartProcessing}
                                disabled={mapping.dateIndex === -1 || mapping.amountIndex === -1 || !sourceName.trim()}
                                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2"
                            >
                                Process Data <ArrowRight size={16} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 3: PROCESSING */}
                {step === 'processing' && (
                    <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="relative w-24 h-24">
                            <div className="absolute inset-0 border-4 border-slate-700 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                            <div className="absolute inset-0 flex items-center justify-center text-indigo-400">
                                <Wand2 size={32} />
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-white mb-2">{processStatus.current}</h3>
                            <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mx-auto mb-2">
                                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${processStatus.progress}%` }}></div>
                            </div>
                            {processStatus.aiCount > 0 && (
                                <p className="text-sm text-slate-400 flex items-center justify-center gap-2">
                                    <BrainCircuit size={14} className="text-purple-400 animate-pulse"/> 
                                    AI is categorizing {processStatus.aiCount} items...
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* STEP 4: RESULTS */}
                {step === 'results' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-emerald-500/10 border border-emerald-500/30 p-6 rounded-xl flex items-center gap-4">
                                <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400">
                                    <CheckCircle size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{result.success.length}</h3>
                                    <p className="text-emerald-400 text-sm font-medium">Ready to Import</p>
                                </div>
                            </div>
                            <div className={`border p-6 rounded-xl flex items-center gap-4 ${result.failed.length > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-slate-800/50 border-slate-700'}`}>
                                <div className={`p-3 rounded-full ${result.failed.length > 0 ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                                    <AlertTriangle size={32} />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-white">{result.failed.length}</h3>
                                    <p className={`${result.failed.length > 0 ? 'text-red-400' : 'text-slate-400'} text-sm font-medium`}>Failed Rows</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                            <div className="flex items-center gap-2 mb-2 text-slate-300">
                                <Tag size={16} className="text-indigo-400"/> 
                                <span className="text-sm font-semibold">Importing as source:</span>
                                <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-600">{sourceName}</span>
                            </div>
                        </div>

                        {/* Failed List */}
                        {result.failed.length > 0 && (
                            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                                <div className="p-3 bg-slate-900 border-b border-slate-700 flex justify-between items-center">
                                    <h4 className="font-bold text-slate-300 text-sm">Issues ({result.failed.length})</h4>
                                    <span className="text-xs text-slate-500">These rows will be skipped</span>
                                </div>
                                <div className="max-h-40 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="text-slate-500 bg-slate-900/50">
                                            <tr>
                                                <th className="p-2">Row</th>
                                                <th className="p-2">Reason</th>
                                                <th className="p-2">Data</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {result.failed.map((fail, i) => (
                                                <tr key={i} className="border-b border-slate-700/50 text-slate-400">
                                                    <td className="p-2 font-mono text-red-400">{fail.row}</td>
                                                    <td className="p-2">{fail.reason}</td>
                                                    <td className="p-2 font-mono opacity-50 truncate max-w-[200px]">{JSON.stringify(fail.raw)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
                             <button onClick={() => setStep('upload')} className="px-4 py-2 text-slate-400 hover:text-white">Cancel</button>
                             <button 
                                onClick={() => {
                                    const newCats = Array.from(new Set(result.success.map(t => t.category)))
                                        .filter(c => !existingCategories.includes(c) && c !== Category.UNCATEGORIZED && c !== 'Uncategorized');
                                    onImportComplete(result.success, newCats, sourceName);
                                    onClose();
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg shadow-emerald-500/20"
                             >
                                <Download size={18} /> Import {result.success.length} Transactions
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};