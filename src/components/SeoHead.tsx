import React, { useEffect } from 'react';

export interface SeoProps {
  title: string;
  description: string;
  url: string;
  dayNumber?: number;
  sectionName?: string;
  articleBody?: string;
  datePublished?: string;
  imageUrl?: string;
}

export const SeoHead: React.FC<SeoProps> = ({
  title,
  description,
  url,
  dayNumber,
  sectionName,
  articleBody,
  datePublished,
  imageUrl = 'https://widokinaraj.pl/app-logo.png'
}) => {
  useEffect(() => {
    try {
      const fullTitle = `${title || 'Widoki na Raj'} | Widoki na Raj`;
      document.title = fullTitle;

      const setMetaTag = (attrName: 'name' | 'property', attrValue: string, content: string) => {
        try {
          let element = document.head.querySelector(`meta[${attrName}="${attrValue}"]`);
          if (!element) {
            element = document.createElement('meta');
            element.setAttribute(attrName, attrValue);
            document.head.appendChild(element);
          }
          element.setAttribute('content', content || '');
        } catch {}
      };

      const setLinkTag = (rel: string, href: string) => {
        try {
          let element = document.head.querySelector(`link[rel="${rel}"]`);
          if (!element) {
            element = document.createElement('link');
            element.setAttribute('rel', rel);
            document.head.appendChild(element);
          }
          element.setAttribute('href', href || '');
        } catch {}
      };

      setMetaTag('name', 'description', description || '');
      setLinkTag('canonical', url || 'https://widokinaraj.pl');

      setMetaTag('property', 'og:title', fullTitle);
      setMetaTag('property', 'og:description', description || '');
      setMetaTag('property', 'og:url', url || 'https://widokinaraj.pl');
      setMetaTag('property', 'og:type', 'article');
      setMetaTag('property', 'og:image', imageUrl);
      setMetaTag('property', 'og:site_name', 'Widoki na Raj');
      setMetaTag('property', 'og:locale', 'pl_PL');

      setMetaTag('name', 'twitter:card', 'summary_large_image');
      setMetaTag('name', 'twitter:title', fullTitle);
      setMetaTag('name', 'twitter:description', description || '');
      setMetaTag('name', 'twitter:image', imageUrl);

      const schemaData = {
        '@context': 'https://schema.org',
        '@type': 'BlogPosting',
        'headline': title || 'Widoki na Raj',
        'description': description || '',
        'articleBody': (articleBody || description || '').slice(0, 5000),
        'inLanguage': 'pl',
        'mainEntityOfPage': {
          '@type': 'WebPage',
          '@id': url || 'https://widokinaraj.pl'
        },
        'url': url || 'https://widokinaraj.pl',
        'datePublished': datePublished || new Date().toISOString(),
        'dateModified': datePublished || new Date().toISOString(),
        'author': {
          '@type': 'Organization',
          'name': 'Widoki na Raj',
          'url': 'https://widokinaraj.pl'
        },
        'publisher': {
          '@type': 'Organization',
          'name': 'Widoki na Raj',
          'logo': {
            '@type': 'ImageObject',
            'url': imageUrl
          }
        },
        ...(dayNumber ? { 'keywords': `Dzień ${dayNumber}, ${sectionName || 'Różaniec'}, Widoki na Raj, modlitwa 365 dni` } : {})
      };

      let scriptElement = document.head.querySelector('#schema-jsonld') as HTMLScriptElement | null;
      if (!scriptElement) {
        scriptElement = document.createElement('script');
        scriptElement.id = 'schema-jsonld';
        scriptElement.type = 'application/ld+json';
        document.head.appendChild(scriptElement);
      }
      scriptElement.text = JSON.stringify(schemaData, null, 2);
    } catch (e) {
      console.warn('[SeoHead] Metadata update warning:', e);
    }
  }, [title, description, url, dayNumber, sectionName, articleBody, datePublished, imageUrl]);

  return null;
};
