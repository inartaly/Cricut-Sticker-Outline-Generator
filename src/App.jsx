// Main app component.
// Coordinates image upload, outline generation, and downloads.

import React, { useRef, useState } from "react";
import ImageUploader from "./ImageUploader";
import { generateOutlinePNGAndSVG } from "./outline";

function App() {
  // Original image as data URL.
  const [imageSrc, setImageSrc] = useState(null);

  // Generated PNG outline as data URL.
  const [outlinePngSrc, setOutlinePngSrc] = useState(null);

  // Generated SVG outline as string.
  const [outlineSvg, setOutlineSvg] = useState(null);

  // Outline thickness in pixels (used for PNG stroke radius).
  const [outlineThickness, setOutlineThickness] = useState(10);

  // Processing state.
  const [isProcessing, setIsProcessing] = useState(false);

  // Hidden canvas used for processing.
  const canvasRef = useRef(null);

  const handleImageSelected = (dataUrl) => {
    setImageSrc(dataUrl);
    setOutlinePngSrc(null);
    setOutlineSvg(null);
  };

  const handleGenerateOutline = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);

    try {
      const canvas = canvasRef.current;

      const { pngDataUrl, svgString } = await generateOutlinePNGAndSVG({
        imageSrc,
        canvas,
        outlineThickness
      });

      setOutlinePngSrc(pngDataUrl);
      setOutlineSvg(svgString);
    } catch (err) {
      console.error(err);
      alert("Something went wrong while generating the outline.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPng = () => {
    if (!outlinePngSrc) return;
    const a = document.createElement("a");
    a.href = outlinePngSrc;
    a.download = "sticker-outline.png";
    a.click();
  };

  const handleDownloadSvg = () => {
    if (!outlineSvg) return;
    const blob = new Blob([outlineSvg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sticker-outline.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-root">
      <div className="card">
        <h1>Cricut Sticker Outline Generator</h1>
        <p style={{ color: "#9ca3af", fontSize: "0.9rem" }}>
          Upload an image, generate a smooth, Cricut-ready outline, and export
          as PNG or SVG. Everything runs locally in your browser.
        </p>

        <ImageUploader onImageSelected={handleImageSelected} />

        <div className="controls-row">
          <div>
            <label htmlFor="thickness">
              Outline thickness (PNG): {outlineThickness}px
            </label>
            <br />
            <input
              id="thickness"
              className="slider-input"
              type="range"
              min="4"
              max="40"
              value={outlineThickness}
              onChange={(e) => setOutlineThickness(Number(e.target.value))}
            />
          </div>

          <button
            onClick={handleGenerateOutline}
            disabled={!imageSrc || isProcessing}
          >
            {isProcessing ? "Generating..." : "Generate Outline"}
          </button>
        </div>

        {/* Hidden canvas for processing */}
        <canvas
          ref={canvasRef}
          style={{ display: "none" }}
          aria-hidden="true"
        />

        <div className="preview-grid">
          <div className="preview-box">
            <h2>Original Image</h2>
            {imageSrc ? (
              <img src={imageSrc} alt="Original" />
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                No image selected yet.
              </p>
            )}
          </div>

          <div className="preview-box">
            <h2>PNG Outline</h2>
            {outlinePngSrc ? (
              <>
                <img src={outlinePngSrc} alt="Outline PNG" />
                <button onClick={handleDownloadPng}>Download PNG</button>
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                Generate an outline to see the PNG result.
              </p>
            )}
          </div>

          <div className="preview-box">
            <h2>SVG Outline</h2>
            {outlineSvg ? (
              <>
                <div
                  dangerouslySetInnerHTML={{ __html: outlineSvg }}
                  style={{ borderRadius: "0.5rem", overflow: "hidden" }}
                />
                <button onClick={handleDownloadSvg}>Download SVG</button>
              </>
            ) : (
              <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
                Generate an outline to see the SVG result.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
