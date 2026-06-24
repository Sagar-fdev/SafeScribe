import { useState, useEffect, useRef } from 'react';
import './ImageWithLoader.css';

export default function ImageWithLoader({ src, alt, className, style }) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const imgRef = useRef();

  const handleLoad = () => {
    setProgress(100);
    setLoaded(true);
  };

  const handleError = () => {
    setProgress(100);
    setLoaded(true);
  };

  useEffect(() => {
    if (!src) return;
    
    setLoaded(false);
    setProgress(0);

    // If browser has already loaded/cached the image (common for base64 data URLs),
    // trigger loaded state instantly to prevent getting stuck at 95%
    if (imgRef.current && imgRef.current.complete) {
      handleLoad();
      return;
    }

    // Simulate progress smoothly while browser decodes the image
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) {
          clearInterval(interval);
          return 95;
        }
        const step = Math.max(1, Math.floor((95 - prev) / 8));
        return prev + step;
      });
    }, 50);

    return () => clearInterval(interval);
  }, [src]);

  return (
    <div className={`image-loader-wrapper ${className || ''}`} style={style}>
      {!loaded && (
        <div className="image-loading-placeholder">
          <div className="image-loading-spinner-small"></div>
          <span className="image-loading-percentage">Loading Image... {progress}%</span>
          <div className="image-loading-bar">
            <div className="image-loading-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        className={`loaded-image ${loaded ? 'visible' : 'hidden'}`}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  );
}
