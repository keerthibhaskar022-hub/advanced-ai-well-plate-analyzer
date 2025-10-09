import React from 'react';

interface WelcomePageProps {
  onStart: () => void;
}

const Step: React.FC<{ number: number; title: string; children: React.ReactNode }> = ({ number, title, children }) => (
  <li className="flex">
    <span className="flex-shrink-0 flex items-center justify-center w-8 h-8 bg-[--color-accent-primary] text-[--color-accent-primary-text] rounded-full font-bold">
      {number}
    </span>
    <div className="ml-4">
      {/* FIX: Changed invalid HTML tag 'hh3' to 'h3'. */}
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-[--color-text-muted]">{children}</p>
    </div>
  </li>
);

export const WelcomePage: React.FC<WelcomePageProps> = ({ onStart }) => {
  return (
    <div className="flex flex-col items-center text-center p-4 sm:p-8">
      <h2 className="text-3xl sm:text-4xl font-extrabold text-[--color-text-primary] tracking-tight">
        Welcome to the IC50 Analyzer
      </h2>
      <p className="mt-4 max-w-2xl text-lg text-[--color-text-muted]">
        This tool automates the analysis of 96-well plates to determine IC50 values from your images. Follow the steps below to get started.
      </p>

      <div className="mt-10 text-left max-w-3xl w-full">
        <ol className="space-y-8">
          <Step number={1} title="Upload Image">
            Upload a clear, top-down photograph of your 96-well plate. Ensure good lighting and minimal glare for the best results.
          </Step>

          <Step number={2} title="Crop the Plate">
            Use the interactive rectangle to crop the image to the plate area. This improves accuracy and processing speed. You can also rotate the image if it's tilted.
          </Step>

          <Step number={3} title="Calibrate the Grid">
            Precisely define the well locations by clicking the centers of three points: the <strong>top-left</strong>, <strong>top-right</strong>, and <strong>bottom-left</strong> wells. This robust method is highly accurate and corrects for rotation or perspective skew in the image.
          </Step>

          <Step number={4} title="Define Controls">
            Click on a well representing 100% viability (e.g., negative control, no drug) and a well for 0% viability (e.g., positive control, max concentration).
          </Step>

          <Step number={5} title="Enter Concentrations">
            Input the drug concentration for each row you have analyzed. The app uses this data to plot the dose-response curve.
          </Step>

          <Step number={6} title="Analyze and Review">
            Click 'Analyze' to process the plate. You will see the calculated IC50 value, a dose-response curve, a heatmap of well viability, and a data table with detailed results.
          </Step>
        </ol>
      </div>

      <div className="mt-12">
        <button
          onClick={onStart}
          className="px-8 py-3 bg-[--color-accent-primary] text-[--color-accent-primary-text] font-semibold rounded-lg shadow-lg hover:bg-[--color-accent-primary-hover] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-transform transform hover:scale-105"
        >
          Get Started
        </button>
      </div>
    </div>
  );
};
