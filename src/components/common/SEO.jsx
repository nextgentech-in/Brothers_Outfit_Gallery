import { useEffect } from 'react';

const DEFAULT_TITLE = "Brother’s Outfit Gallery | Men's Clothing Store in Himatnagar";
const DEFAULT_DESCRIPTION = "Shop premium men's clothing in Himatnagar. Discover trendy shirts, kurtas, denim, jeans & accessories. Free delivery on orders over ₹999.";
const DOMAIN = "https://www.brothersoutfitgallery.com";
const DEFAULT_OG_IMAGE = `${DOMAIN}/images/hero.png`;

function setMetaTag(selector, attrName, attrValue, content) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrValue);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

function setCanonical(url) {
  let element = document.querySelector('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

export default function SEO({
  title,
  description,
  canonical,
  ogImage,
  ogType = 'website',
  noindex = false,
  jsonLd = null,
}) {
  useEffect(() => {
    // 1. Title
    const finalTitle = title ? (title.includes("Brother") ? title : `${title} | Brother’s Outfit Gallery`) : DEFAULT_TITLE;
    document.title = finalTitle;

    // 2. Meta Description
    const finalDesc = description || DEFAULT_DESCRIPTION;
    setMetaTag('meta[name="description"]', 'name', 'description', finalDesc);

    // 3. Robots (noindex for private/cart/checkout/utility routes)
    const robotsContent = noindex ? 'noindex, nofollow' : 'index, follow';
    setMetaTag('meta[name="robots"]', 'name', 'robots', robotsContent);

    // 4. Canonical Tag
    const cleanPath = canonical || window.location.pathname;
    const finalCanonical = cleanPath.startsWith('http')
      ? cleanPath
      : `${DOMAIN}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`;
    setCanonical(finalCanonical);

    // 5. Open Graph & Twitter Cards
    const finalImage = ogImage ? (ogImage.startsWith('http') ? ogImage : `${DOMAIN}${ogImage}`) : DEFAULT_OG_IMAGE;
    setMetaTag('meta[property="og:title"]', 'property', 'og:title', finalTitle);
    setMetaTag('meta[property="og:description"]', 'property', 'og:description', finalDesc);
    setMetaTag('meta[property="og:image"]', 'property', 'og:image', finalImage);
    setMetaTag('meta[property="og:url"]', 'property', 'og:url', finalCanonical);
    setMetaTag('meta[property="og:type"]', 'property', 'og:type', ogType);
    setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', "Brother’s Outfit Gallery");

    setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', finalTitle);
    setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', finalDesc);
    setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', finalImage);

    // 6. JSON-LD Structured Data
    const existingScript = document.getElementById('seo-dynamic-jsonld');
    if (existingScript) {
      existingScript.remove();
    }

    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'seo-dynamic-jsonld';
      script.type = 'application/ld+json';
      script.text = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const s = document.getElementById('seo-dynamic-jsonld');
      if (s) s.remove();
    };
  }, [title, description, canonical, ogImage, ogType, noindex, jsonLd]);

  return null;
}
