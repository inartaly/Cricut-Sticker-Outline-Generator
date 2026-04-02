// Simple image uploader.
// Reads the selected file as a data URL and passes it up.

import React from "react";

function ImageUploader({ onImageSelected }) {
  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        onImageSelected(result);
      }
    };

    reader.readAsDataURL(file);
  };

  return (
    <div style={{ marginTop: "1rem" }}>
      <label htmlFor="image-input">Choose an image file</label>
      <br />
      <input
        id="image-input"
        type="file"
        accept="image/*"
        onChange={handleFileChange}
      />
      <p style={{ color: "#6b7280", fontSize: "0.8rem", marginTop: "0.5rem" }}>
        For the cleanest outlines, images with transparent backgrounds work
        best, but any image will work.
      </p>
    </div>
  );
}

export default ImageUploader;
