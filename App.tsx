import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { TrainingExample, Instance } from './types';
import { convertToHtml } from './services/geminiService';
import { TrashIcon, CopyIcon, ChevronDownIcon, PlusIcon, XIcon, PencilIcon } from './components/Icons';

declare const mammoth: any;

// --- Helper & UI Components ---

const Header: React.FC = () => (
    <header className="text-center p-4 md:p-6">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800 dark:text-white">
            Text to Blog Converter
        </h1>
        <p className="mt-2 text-md md:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            Create separate instances to train the AI for different formatting styles. Your work is saved automatically.
        </p>
    </header>
);

const ExampleModal: React.FC<{ example: TrainingExample | null; onClose: () => void }> = ({ example, onClose }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (example) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [example, onClose]);

    if (!example) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 transition-opacity duration-300" 
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="example-modal-title"
        >
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl m-4" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
                    <h3 id="example-modal-title" className="text-xl font-semibold text-slate-800 dark:text-slate-100">Training Example</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                        <XIcon />
                    </button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 font-mono text-xs mb-1">INPUT:</p>
                        <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{example.input}</pre>
                    </div>
                    <div>
                        <p className="text-slate-500 dark:text-slate-400 font-mono text-xs mb-1">OUTPUT:</p>
                        <pre className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap font-mono">{example.output}</pre>
                    </div>
                </div>
            </div>
        </div>
    );
};

interface TrainingSectionProps {
    examples: TrainingExample[];
    onAddExample: (input: string, output: string) => void;
    onRemoveExample: (id: string) => void;
}

const TrainingSection: React.FC<TrainingSectionProps> = ({ examples, onAddExample, onRemoveExample }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [newExampleInput, setNewExampleInput] = useState('');
    const [newExampleOutput, setNewExampleOutput] = useState('');
    const [viewingExample, setViewingExample] = useState<TrainingExample | null>(null);
    const newExampleInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const editor = newExampleInputRef.current;
        if (!editor) return;

        const handlePaste = (event: ClipboardEvent) => {
            const items = event.clipboardData?.items;
            if (!items) return;

            // Find and handle the first image
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item.type.startsWith('image/')) {
                    event.preventDefault();
                    const blob = item.getAsFile();
                    if (!blob) continue;

                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const src = e.target?.result as string;
                        const img = document.createElement('img');
                        img.src = src;
                        img.style.maxWidth = '100px';
                        img.style.maxHeight = '100px';
                        img.style.objectFit = 'contain';
                        
                        const selection = window.getSelection();
                        if (!selection || selection.rangeCount === 0) return;
                        
                        const range = selection.getRangeAt(0);
                        range.deleteContents();
                        range.insertNode(img);

                        const newRange = document.createRange();
                        newRange.setStartAfter(img);
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);

                        editor.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                    };
                    reader.readAsDataURL(blob);
                    return;
                }
            }
        };

        editor.addEventListener('paste', handlePaste);
        return () => editor.removeEventListener('paste', handlePaste);
    }, []);

    const handleAdd = () => {
        if (newExampleInput.trim() && newExampleOutput.trim()) {
            onAddExample(newExampleInput, newExampleOutput);
            setNewExampleInput('');
            setNewExampleOutput('');
             if (newExampleInputRef.current) {
                newExampleInputRef.current.innerHTML = '';
            }
        }
    };
    
    return (
        <>
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden transition-all duration-300">
                <button onClick={() => setIsOpen(!isOpen)} className="w-full flex justify-between items-center p-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700">
                    <div className="flex items-center gap-3">
                        <span className="bg-indigo-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">1</span>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Train the AI (Optional)</h2>
                    </div>
                    <ChevronDownIcon className={`w-6 h-6 text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="p-4 bg-white dark:bg-slate-800/50">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                             <div
                                ref={newExampleInputRef}
                                onInput={(e) => setNewExampleInput(e.currentTarget.innerHTML)}
                                contentEditable={true}
                                data-placeholder="Paste sample input here (including images)..."
                                className="w-full h-32 p-3 border rounded-md bg-white dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition overflow-y-auto empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
                                aria-label="Sample Input"
                            />
                            <textarea
                                value={newExampleOutput}
                                onChange={(e) => setNewExampleOutput(e.target.value)}
                                placeholder="Desired HTML: e.g., '<h3>Chapter 1</h3>'"
                                className="w-full h-32 p-3 border rounded-md bg-white dark:bg-slate-900 dark:text-slate-200 border-slate-300 dark:border-slate-600 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                                aria-label="Desired HTML Output"
                            />
                        </div>
                        <button onClick={handleAdd} className="flex items-center gap-2 w-full justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition disabled:opacity-50" disabled={!newExampleInput.trim() || !newExampleOutput.trim()}>
                            <PlusIcon /> Add Example
                        </button>
                        {examples.length > 0 && <hr className="my-4 border-slate-200 dark:border-slate-700" />}
                        <div className="space-y-2">
                            {examples.map((ex, index) => (
                                <div key={ex.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-slate-50 dark:bg-slate-700/50">
                                    <button 
                                        onClick={() => setViewingExample(ex)} 
                                        className="flex-1 text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-200 dark:hover:bg-slate-600 rounded-md transition"
                                    >
                                        Example #{index + 1}
                                    </button>
                                    <button onClick={() => onRemoveExample(ex.id)} className="flex-shrink-0 text-slate-400 hover:text-red-500 p-1 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition">
                                        <TrashIcon />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <ExampleModal example={viewingExample} onClose={() => setViewingExample(null)} />
        </>
    );
};

interface InputSectionProps {
    inputText: string;
    onTextChange: (text: string) => void;
    onFileChange: (file: File) => void;
}

const InputSection: React.FC<InputSectionProps> = ({ inputText, onTextChange, onFileChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const contentEditableRef = useRef<HTMLDivElement>(null);

    // Sync contentEditable div with state from parent (e.g., when switching instances)
    useEffect(() => {
        if (contentEditableRef.current && contentEditableRef.current.innerHTML !== inputText) {
            contentEditableRef.current.innerHTML = inputText;
        }
    }, [inputText]);

    return (
        <div className="space-y-4">
             <div className="flex items-center gap-3">
                <span className="bg-indigo-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">2</span>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Provide Your Content</h2>
            </div>
            <div
                ref={contentEditableRef}
                onInput={(e) => onTextChange(e.currentTarget.innerHTML)}
                contentEditable={true}
                data-placeholder="Paste your rich text here..."
                className="w-full min-h-[250px] p-4 border rounded-lg bg-white dark:bg-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400"
            />
            <div className="text-center">
                <span className="text-slate-500 dark:text-slate-400">or</span>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => e.target.files && onFileChange(e.target.files[0])}
                    className="hidden"
                    accept=".txt,.docx"
                />
                <button onClick={() => fileInputRef.current?.click()} className="ml-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                    Upload a .txt or .docx file
                </button>
            </div>
        </div>
    );
}

interface OutputSectionProps {
    outputHtml: string;
    error: string | null;
    isLoading: boolean;
}

const OutputSection: React.FC<OutputSectionProps> = ({ outputHtml, error, isLoading }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(outputHtml).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <span className="bg-indigo-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">3</span>
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Get Your HTML</h2>
            </div>
            <div className="relative w-full min-h-[250px] border rounded-lg bg-slate-900 dark:bg-black/50 border-slate-300 dark:border-slate-700">
                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-2">
                             <div className="w-8 h-8 border-4 border-slate-400 border-t-indigo-500 rounded-full animate-spin"></div>
                             <p className="text-slate-400">Converting...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-4 text-red-500">{error}</div>
                ) : (
                    <>
                        <pre className="p-4 text-sm text-slate-100 whitespace-pre-wrap overflow-x-auto"><code className="language-html">{outputHtml || <span className="text-slate-500">Output will appear here...</span>}</code></pre>
                        {outputHtml && (
                            <button onClick={handleCopy} className="absolute top-2 right-2 flex items-center gap-2 px-3 py-1 bg-slate-700 text-slate-200 text-sm font-semibold rounded-md hover:bg-slate-600 transition">
                                <CopyIcon className="w-4 h-4" />
                                {copied ? 'Copied!' : 'Copy'}
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

interface SidebarProps {
    instances: Instance[];
    activeInstanceId: string | null;
    onSelectInstance: (id: string) => void;
    onAddInstance: () => void;
    onDeleteInstance: (id: string) => void;
    onRenameInstance: (id: string, newName: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ instances, activeInstanceId, onSelectInstance, onAddInstance, onDeleteInstance, onRenameInstance }) => {
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        renameInputRef.current?.focus();
        renameInputRef.current?.select();
    }, [renamingId]);

    const handleStartRename = (id: string, currentName: string) => {
        setRenamingId(id);
        setRenameValue(currentName);
    };

    const handleFinishRename = () => {
        if (renamingId && renameValue.trim()) {
            onRenameInstance(renamingId, renameValue.trim());
        }
        setRenamingId(null);
        setRenameValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') handleFinishRename();
        if (e.key === 'Escape') setRenamingId(null);
    };

    return (
        <aside className="w-64 bg-slate-100 dark:bg-slate-900/50 p-4 flex flex-col h-full border-r border-slate-200 dark:border-slate-800 flex-shrink-0">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">My Instances</h2>
            <button onClick={onAddInstance} className="flex items-center justify-center gap-2 w-full px-4 py-2 mb-4 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition">
                <PlusIcon className="w-5 h-5" /> New Instance
            </button>
            <nav className="flex-1 overflow-y-auto -mr-2 pr-2">
                <ul className="space-y-1">
                    {instances.map(inst => {
                        const isActive = inst.id === activeInstanceId;
                        return (
                            <li key={inst.id}>
                                <div className={`group flex items-center justify-between gap-2 rounded-md ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'hover:bg-slate-200 dark:hover:bg-slate-800'}`}>
                                    {renamingId === inst.id ? (
                                        <input
                                            ref={renameInputRef}
                                            type="text"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onBlur={handleFinishRename}
                                            onKeyDown={handleKeyDown}
                                            className="w-full bg-transparent px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none"
                                        />
                                    ) : (
                                        <button onClick={() => onSelectInstance(inst.id)} className={`flex-1 text-left px-3 py-1.5 text-sm font-medium truncate ${isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-200'}`}>
                                            {inst.name}
                                        </button>
                                    )}
                                    {renamingId !== inst.id && (
                                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-2">
                                            <button onClick={() => handleStartRename(inst.id, inst.name)} className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-100 rounded-md">
                                                <PencilIcon />
                                            </button>
                                            <button onClick={() => onDeleteInstance(inst.id)} className="p-1 text-slate-500 hover:text-red-500 rounded-md">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </aside>
    );
};

// --- Main App Component ---

const LOCAL_STORAGE_KEY = 'html-converter-instances';

export default function App() {
    const [instances, setInstances] = useState<Instance[]>([]);
    const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load from localStorage on initial render
    useEffect(() => {
        try {
            const savedInstances = localStorage.getItem(LOCAL_STORAGE_KEY);
            const loadedInstances: Instance[] = savedInstances ? JSON.parse(savedInstances) : [];
            
            if (loadedInstances.length > 0) {
                setInstances(loadedInstances);
                setActiveInstanceId(loadedInstances[0].id);
            } else {
                // Create a default instance if none exist
                const newInstance: Instance = {
                    id: Date.now().toString(),
                    name: 'My First Model',
                    trainingExamples: [],
                    inputText: '',
                    outputHtml: '',
                };
                setInstances([newInstance]);
                setActiveInstanceId(newInstance.id);
            }
        } catch (e) {
            console.error("Failed to load instances from localStorage", e);
             const newInstance: Instance = {
                id: Date.now().toString(),
                name: 'Default Model',
                trainingExamples: [],
                inputText: '',
                outputHtml: '',
            };
            setInstances([newInstance]);
            setActiveInstanceId(newInstance.id);
        }
    }, []);

    // Save to localStorage whenever instances change
    useEffect(() => {
        if (instances.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(instances));
        }
    }, [instances]);

    const activeInstance = instances.find(inst => inst.id === activeInstanceId);

    const updateActiveInstance = useCallback((updates: Partial<Omit<Instance, 'id' | 'name'>>) => {
        setInstances(prev =>
            prev.map(inst =>
                inst.id === activeInstanceId ? { ...inst, ...updates } : inst
            )
        );
    }, [activeInstanceId]);
    
    const addExample = useCallback((input: string, output: string) => {
        if (!activeInstance) return;
        const newExample: TrainingExample = { id: Date.now().toString(), input, output };
        updateActiveInstance({
            trainingExamples: [...activeInstance.trainingExamples, newExample],
        });
    }, [activeInstance, updateActiveInstance]);

    const removeExample = useCallback((id: string) => {
        if (!activeInstance) return;
        updateActiveInstance({
            trainingExamples: activeInstance.trainingExamples.filter(ex => ex.id !== id),
        });
    }, [activeInstance, updateActiveInstance]);

    const handleTextChange = useCallback((html: string) => {
        const cleanedHtml = html.replace(/&nbsp;/g, ' ');
        updateActiveInstance({ inputText: cleanedHtml, outputHtml: '' }); // Clear output on input change
    }, [updateActiveInstance]);

    const handleFileChange = (file: File) => {
        if (!file) return;
        setError(null);

        const setContent = (html: string) => {
            const cleanedHtml = html.replace(/&nbsp;/g, ' ');
            updateActiveInstance({ inputText: cleanedHtml, outputHtml: '' });
        };
    
        if (file.name.endsWith('.docx')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target?.result as ArrayBuffer;
                    const result = await mammoth.convertToHtml({ arrayBuffer });
                    setContent(result.value);
                } catch (err) {
                    console.error("Error processing .docx file:", err);
                    setError("Failed to process .docx file. It might be corrupt.");
                }
            };
            reader.onerror = () => setError("Failed to read file.");
            reader.readAsArrayBuffer(file);
        } else if (file.name.endsWith('.txt')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target?.result as string;
                const html = text.split('\n').map(p => `<p>${p || '<br>'}</p>`).join('');
                setContent(html);
            };
            reader.onerror = () => setError("Failed to read file.");
            reader.readAsText(file);
        } else {
            setError("Unsupported file type. Please upload a .txt or .docx file.");
        }
    };
    
    const handleAddInstance = () => {
        const newInstance: Instance = {
            id: Date.now().toString(),
            name: `New Model ${instances.length + 1}`,
            trainingExamples: [],
            inputText: '',
            outputHtml: '',
        };
        setInstances(prev => [...prev, newInstance]);
        setActiveInstanceId(newInstance.id);
    };

    const handleDeleteInstance = (idToDelete: string) => {
        setInstances(prev => {
            const remaining = prev.filter(inst => inst.id !== idToDelete);
            if (activeInstanceId === idToDelete) {
                setActiveInstanceId(remaining.length > 0 ? remaining[0].id : null);
            }
            if (remaining.length === 0) {
                localStorage.removeItem(LOCAL_STORAGE_KEY);
            }
            return remaining;
        });
    };
    
    const handleRenameInstance = (id: string, newName: string) => {
        setInstances(prev => prev.map(inst => inst.id === id ? { ...inst, name: newName } : inst));
    };

    const handleConvert = async () => {
        if (!activeInstance || !activeInstance.inputText.trim()) {
            setError("Please provide some text to convert.");
            return;
        }
        setIsLoading(true);
        setError(null);
        updateActiveInstance({ outputHtml: '' });

        try {
            const result = await convertToHtml(activeInstance.inputText, activeInstance.trainingExamples);
            updateActiveInstance({ outputHtml: result });
        } catch (err: any) {
            setError(err.message || "An unknown error occurred.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen text-slate-800 dark:text-slate-200 font-sans">
            <Sidebar
                instances={instances}
                activeInstanceId={activeInstanceId}
                onSelectInstance={setActiveInstanceId}
                onAddInstance={handleAddInstance}
                onDeleteInstance={handleDeleteInstance}
                onRenameInstance={handleRenameInstance}
            />
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <main className="max-w-4xl mx-auto p-4 sm:p-6 md:p-8">
                    <Header />
                    {activeInstance ? (
                         <div className="mt-8 space-y-8">
                            <TrainingSection
                                examples={activeInstance.trainingExamples}
                                onAddExample={addExample}
                                onRemoveExample={removeExample}
                            />
                            <InputSection
                                inputText={activeInstance.inputText}
                                onTextChange={handleTextChange}
                                onFileChange={handleFileChange}
                            />
                            <div className="text-center">
                                <button 
                                    onClick={handleConvert} 
                                    disabled={isLoading || !activeInstance.inputText.trim()}
                                    className="w-full max-w-xs px-6 py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 focus:ring-offset-slate-50 dark:focus:ring-offset-slate-900 transition-transform transform hover:scale-105 disabled:bg-indigo-400 disabled:cursor-not-allowed disabled:scale-100"
                                >
                                    {isLoading ? 'Converting...' : 'Convert to HTML'}
                                </button>
                            </div>
                            <OutputSection
                                outputHtml={activeInstance.outputHtml}
                                error={error}
                                isLoading={isLoading}
                            />
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p>Create an instance to get started.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}