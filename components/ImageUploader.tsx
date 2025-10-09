import React, { useState, useCallback } from 'react';
import { UploadIcon } from './icons';

interface ImageUploaderProps {
  onImageUpload: (file: File) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload }) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File | null | undefined) => {
    if (file && file.type.startsWith('image/')) {
      onImageUpload(file);
    } else {
      alert('Please upload a valid image file.');
    }
  }, [onImageUpload]);

  // FIX: Changed event type from React.DragEvent<HTMLDivElement> to React.DragEvent<HTMLLabelElement> to match the element it's attached to.
  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // FIX: Changed event type from React.DragEvent<HTMLDivElement> to React.DragEvent<HTMLLabelElement> to match the element it's attached to.
  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // FIX: Changed event type from React.DragEvent<HTMLDivElement> to React.DragEvent<HTMLLabelElement> to match the element it's attached to.
  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // FIX: Changed event type from React.DragEvent<HTMLDivElement> to React.DragEvent<HTMLLabelElement> to match the element it's attached to.
  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <label
        htmlFor="file-upload"
        className={`relative flex flex-col items-center justify-center w-full max-w-2xl h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors
          ${isDragging 
            ? 'border-[--color-accent-secondary] bg-[--color-background-accent]' 
            : 'border-[--color-border-primary] hover:border-[--color-border-primary-hover] bg-[--color-background-primary]'}`
        }
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
            <UploadIcon className="w-12 h-12 mb-4 text-[--color-text-muted]" />
          <p className="mb-2 text-sm text-[--color-text-muted]">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-[--color-text-muted]">PNG, JPG, GIF up to 10MB</p>
        </div>
        <input id="file-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
      </label>
    </div>
  );
};