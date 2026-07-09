import { useState, useEffect } from 'react';

export type ViewportType = 'tiny-mobile' | 'small-mobile' | 'large-mobile' | 'tablet' | 'desktop';

export function useResponsive() {
  const [width, setWidth] = useState(() => window.innerWidth);
  const [height, setHeight] = useState(() => window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      setWidth(window.innerWidth);
      setHeight(window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isTinyMobile = width < 360;
  const isSmallMobile = width >= 360 && width < 480;
  const isLargeMobile = width >= 480 && width < 768;
  const isTablet = width >= 768 && width < 1024;
  const isDesktop = width >= 1024;

  const viewportType: ViewportType = isTinyMobile
    ? 'tiny-mobile'
    : isSmallMobile
    ? 'small-mobile'
    : isLargeMobile
    ? 'large-mobile'
    : isTablet
    ? 'tablet'
    : 'desktop';

  const isMobile = width < 768;

  return {
    width,
    height,
    isTinyMobile,
    isSmallMobile,
    isLargeMobile,
    isTablet,
    isDesktop,
    isMobile,
    viewportType,
  };
}
