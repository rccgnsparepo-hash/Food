import React, { useState, useEffect, useRef } from 'react';
import { Skeleton } from './Skeleton';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderClassName?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  placeholderClassName = '',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const imgRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let observer: IntersectionObserver;

    if (imgRef.current) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setImageSrc(src);
              if (observer && imgRef.current) {
                observer.unobserve(imgRef.current);
              }
            }
          });
        },
        {
          rootMargin: '100px', // Load 100px before reaching viewport
          threshold: 0.01,
        }
      );

      observer.observe(imgRef.current);
    }

    return () => {
      if (observer && observer.disconnect) {
        observer.disconnect();
      }
    };
  }, [src]);

  return (
    <div ref={imgRef} className={`relative overflow-hidden ${containerClassName}`}>
      {(!imageSrc || !isLoaded) && (
        <Skeleton className={`absolute inset-0 w-full h-full ${placeholderClassName}`} />
      )}
      {imageSrc && (
        <img
          src={imageSrc}
          alt={alt}
          onLoad={() => setIsLoaded(true)}
          className={`transition-opacity duration-300 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          } ${className}`}
          {...props}
        />
      )}
    </div>
  );
};
