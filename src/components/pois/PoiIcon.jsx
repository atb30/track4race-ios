
import React, { useState, useEffect } from 'react';

export default function PoiIcon({ type, className = "w-8 h-8" }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    // Reset error state when icon_url changes
    setHasError(false);
  }, [type?.icon_url]);

  if (!type) return null;

  const { icon_url, color, name } = type;

  if (hasError || !icon_url) {
    return (
      <div className={`${className} rounded-full flex-shrink-0`} style={{ backgroundColor: color || "#3b82f6" }} />
    );
  }

  return (
    <div className={`${className} rounded flex items-center justify-center flex-shrink-0 bg-white`}>
      <img
        src={icon_url}
        alt={name || 'POI Icon'}
        className="w-full h-full object-contain"
        onError={() => {
          console.warn(`Failed to load icon for POI type "${name}" from URL: ${icon_url}`);
          setHasError(true);
        }}
      />
    </div>
  );
}
