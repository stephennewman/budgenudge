'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface BrandData {
  url: string;
  logo?: {
    url: string;
    data_b64: string;
    alt: string;
    content_type: string;
  };
  colors: string[];
  fonts: string[];
  title: string;
}

export default function BrandExtractorPage() {
  const [emailDomain, setEmailDomain] = useState('');
  const [loading, setLoading] = useState(false);
  const [brandData, setBrandData] = useState<BrandData | null>(null);
  const [error, setError] = useState('');

  const analyzeBrand = async () => {
    if (!emailDomain.trim()) {
      setError('Please enter an email or domain');
      return;
    }

    setLoading(true);
    setError('');
    setBrandData(null);

    try {
      const response = await fetch('/api/brand-extractor/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email_or_domain: emailDomain.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        setBrandData(data.brand_data);
      } else {
        setError(data.error || 'Failed to analyze brand');
      }
    } catch {
      setError('An error occurred while analyzing the brand');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center text-white mb-8">
          <h1 className="text-4xl font-bold mb-4 drop-shadow-lg">
            🎨 Brand Extractor
          </h1>
          <p className="text-xl opacity-90">
            Automated brand analysis from any website
          </p>
        </div>

        {/* Input Section */}
        <Card className="max-w-2xl mx-auto mb-8 shadow-xl">
          <CardHeader>
            <CardTitle className="text-center">Analyze Website Brand</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-center">
              <Input
                type="text"
                placeholder="Enter email or domain (e.g., stephen@krezzo.com or krezzo.com)"
                value={emailDomain}
                onChange={(e) => setEmailDomain(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && analyzeBrand()}
                className="flex-1"
              />
              <Button 
                onClick={analyzeBrand} 
                disabled={loading}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {loading ? '🔍 Analyzing...' : '🔍 Analyze Brand'}
              </Button>
            </div>
            
            {loading && (
              <div className="text-center mt-4">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="text-gray-600 mt-2">Analyzing website and extracting brand elements...</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="max-w-2xl mx-auto mb-8 border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center text-red-600">
                <h3 className="text-lg font-semibold mb-2">❌ Error</h3>
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Results */}
        {brandData && (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Website Info */}
            <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-xl">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-2">{brandData.title}</h2>
                  <p className="text-lg opacity-90">{brandData.url}</p>
                </div>
              </CardContent>
            </Card>

            {/* Logo Section */}
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🖼️ Logo
                </CardTitle>
              </CardHeader>
              <CardContent>
                {brandData.logo ? (
                  <div className="text-center">
                    <img
                      src={`data:${brandData.logo.content_type};base64,${brandData.logo.data_b64}`}
                      alt={brandData.logo.alt}
                      className="max-w-xs max-h-24 mx-auto rounded-lg shadow-lg"
                    />
                    <p className="text-gray-600 mt-2">{brandData.logo.alt}</p>
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No logo found</p>
                )}
              </CardContent>
            </Card>

            {/* Color Palette */}
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🎨 Color Palette
                </CardTitle>
              </CardHeader>
              <CardContent>
                {brandData.colors.length > 0 ? (
                  <div className="flex flex-wrap gap-4 justify-center">
                    {brandData.colors.map((color, index) => (
                      <div
                        key={index}
                        className="w-20 h-20 rounded-lg border-2 border-white shadow-lg flex items-center justify-center text-white font-bold text-sm"
                        style={{ backgroundColor: color }}
                      >
                        {color}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No colors found</p>
                )}
              </CardContent>
            </Card>

            {/* Typography */}
            <Card className="shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  🔤 Typography
                </CardTitle>
              </CardHeader>
              <CardContent>
                {brandData.fonts.length > 0 ? (
                  <div className="flex flex-wrap gap-4 justify-center">
                    {brandData.fonts.map((font, index) => (
                      <div
                        key={index}
                        className="bg-gray-100 px-4 py-3 rounded-lg border border-gray-200 font-medium"
                      >
                        {font}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500">No fonts found</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
