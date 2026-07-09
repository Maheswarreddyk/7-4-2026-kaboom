import { useEffect } from 'react';
import { SEO_GLOBAL, SEO_PAGES, PageSeoConfig } from '../config/seo.js';

interface MetaManagerProps {
  page: string;
  customConfig?: PageSeoConfig;
  customSchema?: any;
}

export function MetaManager({ page, customConfig, customSchema }: MetaManagerProps) {
  const config = customConfig || SEO_PAGES[page] || SEO_PAGES.home;

  useEffect(() => {
    // 1. Dynamic Title
    document.title = config.title;

    // Helper to find or create meta tag
    const setMetaTag = (attrName: string, attrVal: string, content: string) => {
      let element = document.querySelector(`meta[${attrName}="${attrVal}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, attrVal);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Helper to find or create link tag
    const setLinkTag = (rel: string, href: string) => {
      let element = document.querySelector(`link[rel="${rel}"]`);
      if (!element) {
        element = document.createElement('link');
        element.setAttribute('rel', rel);
        document.head.appendChild(element);
      }
      element.setAttribute('href', href);
    };

    // 2. Meta Description & Keywords
    setMetaTag('name', 'description', config.description);
    setMetaTag('name', 'keywords', (config.keywords || []).join(', '));
    setMetaTag('name', 'theme-color', SEO_GLOBAL.themeColor);

    // Robots indexing rules
    if (page === 'chat') {
      setMetaTag('name', 'robots', 'noindex, nofollow');
    } else {
      setMetaTag('name', 'robots', 'index, follow');
    }

    // 3. Open Graph Tags
    setMetaTag('property', 'og:title', config.title);
    setMetaTag('property', 'og:description', config.description);
    setMetaTag('property', 'og:image', SEO_GLOBAL.socialImageUrl);
    setMetaTag('property', 'og:url', config.canonical);
    setMetaTag('property', 'og:type', config.ogType || 'website');
    setMetaTag('property', 'og:site_name', SEO_GLOBAL.siteName);
    setMetaTag('property', 'og:locale', SEO_GLOBAL.locale);

    // 4. Twitter Cards
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', config.title);
    setMetaTag('name', 'twitter:description', config.description);
    setMetaTag('name', 'twitter:image', SEO_GLOBAL.socialImageUrl);
    setMetaTag('name', 'twitter:site', SEO_GLOBAL.twitterHandle);
    setMetaTag('name', 'twitter:creator', SEO_GLOBAL.twitterHandle);

    // 5. Canonical Link
    setLinkTag('canonical', config.canonical);

    // 6. JSON-LD Structured Data Injection
    const existingScript = document.getElementById('kaboom-jsonld');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'kaboom-jsonld';
    script.type = 'application/ld+json';

    const structuredData = customSchema || getStructuredDataForPage(page, config);
    script.innerHTML = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      // Clean up JSON-LD on unmount
      const scriptToRemove = document.getElementById('kaboom-jsonld');
      if (scriptToRemove) {
        scriptToRemove.remove();
      }
    };
  }, [page, config, customSchema]);

  return null;
}

// Generates correct schemas for target indexed views
function getStructuredDataForPage(page: string, config: PageSeoConfig) {
  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    'name': SEO_GLOBAL.organization.name,
    'url': SEO_GLOBAL.organization.url,
    'logo': SEO_GLOBAL.organization.logo,
    'contactPoint': {
      '@type': 'ContactPoint',
      'email': SEO_GLOBAL.organization.email,
      'contactType': 'customer support'
    }
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': 'https://kaboom-tv.com/'
      },
      page !== 'home' ? {
        '@type': 'ListItem',
        'position': 2,
        'name': page.charAt(0).toUpperCase() + page.slice(1),
        'item': config.canonical
      } : null
    ].filter(Boolean)
  };

  if (page === 'home') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        orgSchema,
        {
          '@type': 'WebSite',
          'name': SEO_GLOBAL.siteName,
          'url': SEO_GLOBAL.canonicalUrl,
          'potentialAction': {
            '@type': 'SearchAction',
            'target': 'https://kaboom-tv.com/?q={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'SoftwareApplication',
          'name': SEO_GLOBAL.siteName,
          'operatingSystem': 'All',
          'applicationCategory': 'CommunicationApplication',
          'offers': {
            '@type': 'Offer',
            'price': '0.00',
            'priceCurrency': 'USD'
          }
        }
      ]
    };
  }

  if (page === 'faq') {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        breadcrumbSchema,
        {
          '@type': 'FAQPage',
          'mainEntity': [
            {
              '@type': 'Question',
              'name': 'What is Kaboom TV?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Kaboom TV is a premium, free anonymous random video chat platform that allows you to instantly meet new people worldwide using WebRTC connections with zero sign-up required.'
              }
            },
            {
              '@type': 'Question',
              'name': 'Is Kaboom TV anonymous?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Yes. Kaboom TV is 100% anonymous. We do not require accounts, sign-ups, or personal information. Your local video feeds go peer-to-peer using encrypted WebRTC.'
              }
            },
            {
              '@type': 'Question',
              'name': 'Is Kaboom TV mobile compatible?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Absolutely. Kaboom TV is fully optimized with responsive layout grids, safe areas, snapping previews, and swipe gestures designed for all Android and iOS smartphones.'
              }
            },
            {
              '@type': 'Question',
              'name': 'How do I skip to the next partner?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Simply click the double-arrow Next button on the control dock, or perform a Swipe-Left gesture across your screen on mobile devices.'
              }
            }
          ]
        }
      ]
    };
  }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      breadcrumbSchema,
      page === 'contact' ? orgSchema : null
    ].filter(Boolean)
  };
}
