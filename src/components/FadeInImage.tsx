import { useCallback, useState } from 'react';
import type { ImgHTMLAttributes } from 'react';

/**
 * An <img> that fades in once it has loaded, so a photo arrives over whatever
 * ground sits behind it instead of popping out of a blank box.
 */
export default function FadeInImage({ className = '', ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [loaded, setLoaded] = useState(false);

  // A cached image can finish before the load handler is attached and then
  // never fire it; without this check on mount it would stay invisible.
  const checkAlreadyLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) setLoaded(true);
  }, []);

  return (
    <img
      ref={checkAlreadyLoaded}
      {...props}
      onLoad={() => setLoaded(true)}
      className={`transition-opacity duration-300 motion-reduce:transition-none ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
    />
  );
}
