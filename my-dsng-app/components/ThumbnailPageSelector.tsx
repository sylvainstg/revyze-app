import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { X } from 'lucide-react';
import { Button } from './ui/Button';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://aistudiocdn.com/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs`;

interface ThumbnailPageSelectorProps {
    pdfUrl: string;
    currentPage: number;
    onSelectPage: (pageNumber: number) => void;
    onClose: () => void;
}

export const ThumbnailPageSelector: React.FC<ThumbnailPageSelectorProps> = ({
    pdfUrl,
    currentPage,
    onSelectPage,
    onClose
}) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [selectedPage, setSelectedPage] = useState(currentPage);

    const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const handleSelectPage = (pageNumber: number) => {
        setSelectedPage(pageNumber);
    };

    const handleConfirm = () => {
        onSelectPage(selectedPage);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">Select Thumbnail Page</h2>
                        <p className="text-sm text-slate-500 mt-1">Choose which page to display on the project card</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Page Grid */}
                <div className="flex-1 overflow-y-auto p-6">
                    <Document
                        file={pdfUrl}
                        onLoadSuccess={handleDocumentLoadSuccess}
                        className="flex flex-col items-center"
                    >
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                            {Array.from(new Array(numPages), (_, index) => (
                                <div
                                    key={`page_${index + 1}`}
                                    onClick={() => handleSelectPage(index + 1)}
                                    className={`cursor-pointer rounded-lg border-2 transition-all overflow-hidden ${selectedPage === index + 1
                                            ? 'border-indigo-600 ring-2 ring-indigo-200 shadow-lg'
                                            : 'border-slate-200 hover:border-indigo-300'
                                        }`}
                                >
                                    <div className="relative bg-slate-50">
                                        <Page
                                            pageNumber={index + 1}
                                            width={200}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                        />
                                        <div className={`absolute bottom-0 left-0 right-0 py-2 text-center text-xs font-medium ${selectedPage === index + 1
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white/90 text-slate-600'
                                            }`}>
                                            Page {index + 1}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Document>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleConfirm}>
                        Set as Thumbnail
                    </Button>
                </div>
            </div>
        </div>
    );
};
