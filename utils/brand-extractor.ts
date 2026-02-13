export class BrandExtractor {
  private async fetchWithTimeout(url: string, timeout: number = 10000): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  async inferWebsite(emailOrDomain: string): Promise<string | null> {
    let domain = emailOrDomain;
    
    if (emailOrDomain.includes('@')) {
      domain = emailOrDomain.split('@')[1];
    }

    // Try common protocols
    const protocols = ['https://', 'http://'];
    for (const protocol of protocols) {
      try {
        const url = `${protocol}${domain}`;
        const response = await this.fetchWithTimeout(url);
        if (response.ok) {
          return url;
        }
      } catch {
        continue;
      }
    }

    // Try with www
    try {
      const url = `https://www.${domain}`;
      const response = await this.fetchWithTimeout(url);
      if (response.ok) {
        return url;
      }
    } catch {
      // Continue to return null
    }

    return null;
  }

  private async extractLogo(html: string, baseUrl: string): Promise<any> {
    // Enhanced logo extraction with multiple strategies
    
    // Strategy 1: Look for logo-specific patterns
    const logoPatterns = [
      /<img[^>]*src=["']([^"']*logo[^"']*)["'][^>]*>/gi,
      /<img[^>]*alt=["']([^"']*logo[^"']*)["'][^>]*>/gi,
      /<img[^>]*class=["']([^"']*logo[^"']*)["'][^>]*>/gi,
      /<img[^>]*id=["']([^"']*logo[^"']*)["'][^>]*>/gi
    ];

    // Strategy 2: Look for header/nav images
    const headerPatterns = [
      /<img[^>]*src=["']([^"']*)["'][^>]*class=["'][^"']*header[^"']*["'][^>]*>/gi,
      /<img[^>]*src=["']([^"']*)["'][^>]*class=["'][^"']*nav[^"']*["'][^>]*>/gi
    ];

    // Strategy 3: Look for SVG logos (without dotAll flag)
    const svgPatterns = [
      /<svg[^>]*class=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<\/svg>/gi,
      /<svg[^>]*id=["'][^"']*logo[^"']*["'][^>]*>[\s\S]*?<\/svg>/gi
    ];

    // Strategy 4: Look for images with specific alt text patterns
    const altPatterns = [
      /<img[^>]*alt=["']([^"']*(?:texas|tech|university|ttu|double|raider)[^"']*)["'][^>]*src=["']([^"']*)["'][^>]*>/gi,
      /<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*(?:texas|tech|university|ttu|double|raider)[^"']*)["'][^>]*>/gi
    ];

    // Try logo patterns first
    for (const pattern of logoPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          const srcMatch = match.match(/src=["']([^"']*)["']/);
          if (srcMatch) {
            const logo = await this.tryFetchLogo(srcMatch[1], baseUrl);
            if (logo) return logo;
          }
        }
      }
    }

    // Try alt text patterns for brand-specific images
    for (const pattern of altPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          const srcMatch = match.match(/src=["']([^"']*)["']/);
          if (srcMatch) {
            const logo = await this.tryFetchLogo(srcMatch[1], baseUrl);
            if (logo) return logo;
          }
        }
      }
    }

    // Try header/nav patterns
    for (const pattern of headerPatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          const srcMatch = match.match(/src=["']([^"']*)["']/);
          if (srcMatch) {
            const logo = await this.tryFetchLogo(srcMatch[1], baseUrl);
            if (logo) return logo;
          }
        }
      }
    }

    // Try SVG patterns
    for (const pattern of svgPatterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        // For SVG, we'll return the SVG content as base64
        const svgContent = matches[0];
        const base64 = Buffer.from(svgContent).toString('base64');
        return {
          url: baseUrl,
          data_b64: base64,
          alt: 'SVG Logo',
          content_type: 'image/svg+xml'
        };
      }
    }

    // Strategy 5: Look for any image in the first 2000 characters (likely header)
    const earlyImageMatch = html.substring(0, 2000).match(/<img[^>]*src=["']([^"']*)["'][^>]*>/i);
    if (earlyImageMatch) {
      const logo = await this.tryFetchLogo(earlyImageMatch[1], baseUrl);
      if (logo) return logo;
    }

    // Strategy 6: Look for images with specific file extensions that are likely logos
    const logoFilePatterns = [
      /<img[^>]*src=["']([^"']*\.(?:svg|png|jpg|jpeg))["'][^>]*>/gi
    ];

    for (const pattern of logoFilePatterns) {
      const matches = html.match(pattern);
      if (matches) {
        for (const match of matches) {
          const srcMatch = match.match(/src=["']([^"']*)["']/);
          if (srcMatch) {
            const src = srcMatch[1];
            // Skip very small images and icons
            if (!src.includes('icon') && !src.includes('favicon') && !src.includes('16x16') && !src.includes('32x32')) {
              const logo = await this.tryFetchLogo(src, baseUrl);
              if (logo) return logo;
            }
          }
        }
      }
    }

    return null;
  }

  private async tryFetchLogo(src: string, baseUrl: string): Promise<any> {
    try {
      let fullSrc = src;
      
      if (src.startsWith('//')) {
        fullSrc = 'https:' + src;
      } else if (src.startsWith('/')) {
        fullSrc = baseUrl.replace(/\/$/, '') + src;
      } else if (!src.startsWith('http')) {
        fullSrc = baseUrl.replace(/\/$/, '') + '/' + src.replace(/^\//, '');
      }

      // Skip data URLs and very small images
      if (fullSrc.startsWith('data:') || 
          fullSrc.includes('icon') || 
          fullSrc.includes('favicon') ||
          fullSrc.includes('16x16') ||
          fullSrc.includes('32x32') ||
          fullSrc.includes('apple-touch')) {
        return null;
      }

      // Skip very long URLs that are likely not logos
      if (fullSrc.length > 200) {
        return null;
      }

      // Skip generic logo references
      const genericLogoPatterns = [
        /customer[-_]?logo/i,
        /placeholder[-_]?logo/i,
        /sample[-_]?logo/i,
        /temp[-_]?logo/i,
        /demo[-_]?logo/i,
        /example[-_]?logo/i
      ];
      
      if (genericLogoPatterns.some(pattern => pattern.test(fullSrc))) {
        return null;
      }

      const response = await this.fetchWithTimeout(fullSrc);
      if (response.ok) {
        const arrayBuffer = await response.arrayBuffer();
        
        // Check if the image is too small (likely not a logo)
        if (arrayBuffer.byteLength < 1000) {
          return null;
        }
        
        // Check if the image is too large (likely a banner or hero image)
        if (arrayBuffer.byteLength > 500000) { // 500KB limit
          return null;
        }
        
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        
        return {
          url: fullSrc,
          data_b64: base64,
          alt: 'Logo',
          content_type: response.headers.get('content-type') || 'image/png'
        };
      }
    } catch (error) {
      // Log the error for debugging (but don't fail)
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Failed to fetch logo - non-critical, continue
    }
    return null;
  }

  private extractColors(cssContent: string): string[] {
    const colors = new Set<string>();
    
    // Find hex colors (3, 4, 6, 8 characters)
    const hexColors = cssContent.match(/#[0-9a-fA-F]{3,8}/g) || [];
    hexColors.forEach(color => colors.add(color));
    
    // Find rgb/rgba colors
    const rgbColors = cssContent.match(/rgba?\([^)]+\)/g) || [];
    rgbColors.forEach(color => colors.add(color));
    
    // Find hsl/hsla colors
    const hslColors = cssContent.match(/hsla?\([^)]+\)/g) || [];
    hslColors.forEach(color => colors.add(color));
    
    // Find named colors
    const namedColors = cssContent.match(/\b(aqua|black|blue|fuchsia|gray|green|lime|maroon|navy|olive|purple|red|silver|teal|white|yellow|transparent|currentColor)\b/gi) || [];
    namedColors.forEach(color => colors.add(color.toLowerCase()));
    
    // Find CSS custom properties (CSS variables)
    const cssVarColors = cssContent.match(/var\(--[^)]+\)/g) || [];
    cssVarColors.forEach(color => colors.add(color));
    
    // Filter out irrelevant colors and CSS artifacts
    const filteredColors = Array.from(colors).filter(color => {
      const cleanColor = color.toLowerCase().trim();
      
      // Skip very light or very dark colors that are likely backgrounds/text
      if (cleanColor === '#fff' || cleanColor === '#ffffff' || cleanColor === 'white') {
        return false;
      }
      if (cleanColor === '#000' || cleanColor === '#000000' || cleanColor === 'black') {
        return false;
      }
      if (cleanColor === '#f5f5f5' || cleanColor === '#fafafa' || cleanColor === '#f0f0f0') {
        return false;
      }
      if (cleanColor === '#333' || cleanColor === '#666' || cleanColor === '#999') {
        return false;
      }
      
      // Skip transparent colors
      if (cleanColor === 'transparent' || cleanColor === 'currentcolor') {
        return false;
      }
      
      // Skip incomplete hex colors (like #0006, #fffc)
      if (cleanColor.startsWith('#') && cleanColor.length === 5) {
        return false;
      }
      
      // Skip colors with very low alpha values (mostly transparent)
      if (cleanColor.includes('00') && (cleanColor.includes('26') || cleanColor.includes('4d') || cleanColor.includes('b3'))) {
        return false;
      }
      
      // Skip colors that are too similar to each other
      return true;
    });
    
    // Sort colors by importance and uniqueness
    const sortedColors = filteredColors.sort((a, b) => {
      // Prioritize hex colors, then rgb, then named colors
      const aScore = a.startsWith('#') ? 3 : a.startsWith('rgb') ? 2 : 1;
      const bScore = b.startsWith('#') ? 3 : b.startsWith('rgb') ? 2 : 1;
      
      if (aScore !== bScore) {
        return bScore - aScore;
      }
      
      // For hex colors, prioritize more saturated colors
      if (a.startsWith('#') && b.startsWith('#')) {
        const aHex = a.replace('#', '');
        const bHex = b.replace('#', '');
        
        // Simple saturation check - look for colors that aren't just grays
        const aIsGray = aHex.match(/^([0-9a-f])\1{2,}$/i);
        const bIsGray = bHex.match(/^([0-9a-f])\1{2,}$/i);
        
        if (aIsGray && !bIsGray) return 1;
        if (!aIsGray && bIsGray) return -1;
      }
      
      return 0;
    });
    
    return sortedColors.slice(0, 8);
  }

  private extractFonts(cssContent: string): string[] {
    const fonts = new Set<string>();
    
    // First, try to resolve CSS variables to get actual font values
    const cssVars = new Map<string, string>();
    const varMatches = cssContent.match(/--[^:]+:\s*([^;]+);/g) || [];
    varMatches.forEach(match => {
      const varMatch = match.match(/--([^:]+):\s*([^;]+);/);
      if (varMatch) {
        const varName = varMatch[1];
        const varValue = varMatch[2].trim();
        cssVars.set(`--${varName}`, varValue);
      }
    });
    
    // Find font-family declarations with better regex
    const fontFamilyPatterns = [
      /font-family:\s*([^;}]+)/gi,
      /font-family\s*:\s*([^;}]+)/gi,
      /font:\s*[^/]*\/([^;]+)/gi
    ];
    
    fontFamilyPatterns.forEach(pattern => {
      const matches = cssContent.match(pattern) || [];
      matches.forEach(match => {
        // Extract the font family part
        let fontPart = match;
        if (match.includes('font-family:')) {
          fontPart = match.replace(/font-family:\s*/i, '').trim();
        } else if (match.includes('font:')) {
          const fontMatch = match.match(/font:\s*[^/]*\/([^;]+)/i);
          if (fontMatch) {
            fontPart = fontMatch[1].trim();
          }
        }
        
        // Split by comma and clean up each font
        fontPart.split(',').forEach(font => {
          let cleanFont = font.trim()
            .replace(/['"]/g, '')
            .replace(/^[a-z]/, (match) => match.toUpperCase()) // Capitalize first letter
            .replace(/\s+/g, ' '); // Normalize spaces
          
          // Try to resolve CSS variables
          if (cleanFont.startsWith('var(--')) {
            const varName = cleanFont.match(/var\(--([^)]+)\)/);
            if (varName && cssVars.has(`--${varName[1]}`)) {
              cleanFont = cssVars.get(`--${varName[1]}`) || cleanFont;
            }
          }
          
          if (cleanFont && cleanFont.length > 1 && !cleanFont.includes('{') && !cleanFont.startsWith('var(--')) {
            fonts.add(cleanFont);
          }
        });
      });
    });
    
    // Also look for @import statements for Google Fonts
    const googleFontMatches = cssContent.match(/@import\s+url\(['"]?https:\/\/fonts\.googleapis\.com\/css\?family=([^'"]+)['"]?\)/gi) || [];
    googleFontMatches.forEach(match => {
      const familyMatch = match.match(/family=([^'"]+)/i);
      if (familyMatch) {
        const fontFamily = familyMatch[1].replace(/\+/g, ' ').replace(/%20/g, ' ');
        fonts.add(fontFamily);
      }
    });
    
    // Look for font-face declarations
    const fontFaceMatches = cssContent.match(/@font-face\s*\{[^}]*font-family:\s*['"]?([^'"]+)['"]?[^}]*\}/gi) || [];
    fontFaceMatches.forEach(match => {
      const familyMatch = match.match(/font-family:\s*['"]?([^'"]+)['"]?/i);
      if (familyMatch) {
        const fontFamily = familyMatch[1].trim();
        if (fontFamily && !fontFamily.startsWith('var(--')) {
          fonts.add(fontFamily);
        }
      }
    });
    
    // Filter out common generic fonts, CSS artifacts, and duplicates
    const genericFonts = [
      'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 
      'inherit', 'initial', 'unset', 'default', 'normal'
    ];
    
    const systemFonts = [
      'arial', 'helvetica', 'times', 'times new roman', 'courier', 'courier new',
      'verdana', 'georgia', 'palatino', 'garamond', 'bookman', 'comic sans ms',
      'trebuchet ms', 'arial black', 'impact', 'lucida console', 'tahoma',
      'apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica neue',
      'ubuntu', 'noto sans', 'liberation sans', 'dejavu sans', 'bitstream vera sans'
    ];
    
    const iconFonts = [
      'fontawesome', 'font-awesome', 'fa', 'icon', 'icons', 'glyphicon',
      'material-icons', 'material-symbols', 'ionicons', 'feather', 'heroicons',
      'divipixel', 'etmodules'
    ];
    
    const filteredFonts = Array.from(fonts).filter(font => {
      const cleanFont = font.toLowerCase().trim();
      
      // Remove CSS artifacts
      const cleanFontWithoutArtifacts = cleanFont
        .replace(/\s*!important\s*/g, '')
        .replace(/\s*;?\s*$/g, '')
        .replace(/^['"]+|['"]+$/g, '');
      
      // Skip if empty after cleaning
      if (!cleanFontWithoutArtifacts || cleanFontWithoutArtifacts.length < 2) {
        return false;
      }
      
      // Skip generic fonts
      if (genericFonts.includes(cleanFontWithoutArtifacts)) {
        return false;
      }
      
      // Skip system fonts
      if (systemFonts.includes(cleanFontWithoutArtifacts)) {
        return false;
      }
      
      // Skip icon fonts
      if (iconFonts.some(iconFont => cleanFontWithoutArtifacts.includes(iconFont))) {
        return false;
      }
      
      // Skip fonts with CSS artifacts
      if (cleanFont.includes('!important') || cleanFont.includes(';')) {
        return false;
      }
      
      // Skip very short or very long font names
      if (cleanFontWithoutArtifacts.length < 3 || cleanFontWithoutArtifacts.length > 50) {
        return false;
      }
      
      return true;
    });
    
    // Remove duplicates and normalize (case-insensitive)
    const fontMap = new Map<string, string>();
    
    filteredFonts.forEach(font => {
      const cleanFont = font.replace(/\s*!important\s*/g, '').replace(/\s*;?\s*$/g, '').trim();
      const lowerFont = cleanFont.toLowerCase();
      
      // Use the first occurrence of each font (case-insensitive)
      if (!fontMap.has(lowerFont)) {
        fontMap.set(lowerFont, cleanFont);
      }
    });
    
    return Array.from(fontMap.values()).slice(0, 6);
  }

  async scrapeBrandElements(url: string): Promise<any> {
    try {
      const response = await this.fetchWithTimeout(url);
      const html = await response.text();
      
      // Extract CSS content
      let cssContent = '';
      
      // Look for external CSS files
      const cssLinkMatches = html.match(/<link[^>]*href=["']([^"']*\.css[^"']*)["'][^>]*>/gi) || [];
      for (const match of cssLinkMatches) {
        const hrefMatch = match.match(/href=["']([^"']*)["']/);
        if (hrefMatch) {
          try {
            let cssUrl = hrefMatch[1];
            if (cssUrl.startsWith('//')) {
              cssUrl = 'https:' + cssUrl;
            } else if (cssUrl.startsWith('/')) {
              cssUrl = url.replace(/\/$/, '') + cssUrl;
            } else if (!cssUrl.startsWith('http')) {
              cssUrl = url.replace(/\/$/, '') + '/' + cssUrl.replace(/^\//, '');
            }
            
            const cssResponse = await this.fetchWithTimeout(cssUrl);
            if (cssResponse.ok) {
              cssContent += await cssResponse.text();
            }
          } catch {
            continue;
          }
        }
      }

      // Also look for Google Fonts and other CDN fonts
      const fontLinkMatches = html.match(/<link[^>]*href=["']([^"']*fonts[^"']*)["'][^>]*>/gi) || [];
      for (const match of fontLinkMatches) {
        const hrefMatch = match.match(/href=["']([^"']*)["']/);
        if (hrefMatch) {
          try {
            let fontUrl = hrefMatch[1];
            if (fontUrl.startsWith('//')) {
              fontUrl = 'https:' + fontUrl;
            } else if (fontUrl.startsWith('/')) {
              fontUrl = url.replace(/\/$/, '') + fontUrl;
            } else if (!fontUrl.startsWith('http')) {
              fontUrl = url.replace(/\/$/, '') + '/' + fontUrl.replace(/^\//, '');
            }
            
            const fontResponse = await this.fetchWithTimeout(fontUrl);
            if (fontResponse.ok) {
              cssContent += await fontResponse.text();
            }
          } catch {
            continue;
          }
        }
      }

      // Extract inline styles
      const inlineStyleMatches = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || [];
      for (const match of inlineStyleMatches) {
        const contentMatch = match.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        if (contentMatch) {
          cssContent += contentMatch[1];
        }
      }

      // Also look for CSS variables defined in :root or html selectors
      const rootVarMatches = html.match(/:(root|html)\s*\{([^}]*)\}/gi) || [];
      for (const match of rootVarMatches) {
        const contentMatch = match.match(/:(root|html)\s*\{([^}]*)\}/i);
        if (contentMatch) {
          cssContent += contentMatch[2];
        }
      }

      // Extract elements
      const logo = await this.extractLogo(html, url);
      const colors = this.extractColors(cssContent);
      const fonts = this.extractFonts(cssContent);

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Unknown';

      return {
        url,
        logo,
        colors,
        fonts,
        title
      };

    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return null;
    }
  }
}
