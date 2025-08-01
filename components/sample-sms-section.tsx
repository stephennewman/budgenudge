'use client';

import { useState } from 'react';
import SampleSMSModal from '@/components/sample-sms-modal';
import SlickTextCTAModal from '@/components/slicktext-cta-modal';

export default function SampleSMSSection() {
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [showCTAModal, setShowCTAModal] = useState(false);

  return (
    <>
      {/* SECTION 2.5: SAMPLE SMS DEMO - LEAD GENERATION */}
      <section className="bg-gradient-to-br from-blue-50 to-green-50 py-20 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-6">
            <span className="text-3xl">📱</span>
          </div>
          
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
            See What Your Money Texts Look Like
          </h2>
          
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
            Get a sample financial analysis text to see exactly how Krezzo keeps you informed about your spending. No signup required.
          </p>

          <div className="bg-white border-2 border-blue-200 rounded-2xl p-8 mb-8 max-w-md mx-auto shadow-lg">
            <div className="text-left text-sm font-mono bg-gray-50 p-4 rounded-lg border">
              <div className="text-blue-600 font-semibold mb-2">📊 SAMPLE FINANCIAL ANALYSIS</div>
              <div className="text-gray-800">
                July 2025<br/><br/>
                💰 Available Balance: $3,083.26<br/><br/>
                💳 This Month: $1,247.89<br/>
                📈 25 transactions<br/>
                📈 18% more than last month<br/><br/>
                🏷️ Top Categories:<br/>
                1. Groceries: $347 (28%)<br/>
                2. Restaurant: $286 (23%)<br/>
                3. Gas: $134 (11%)<br/><br/>
                🏪 Top Merchants:<br/>
                1. Publix: $234<br/>
                2. Starbucks: $89<br/>
                3. Shell: $67<br/><br/>
                <span className="text-blue-600">Want to see YOUR real data?<br/>
                👉 get.krezzo.com/sign-up</span>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setShowSampleModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-12 rounded-xl text-xl shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              📱 Send Me This Sample Text
            </button>
            
            <button 
              onClick={() => setShowCTAModal(true)}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-lg shadow-lg transform hover:scale-105 transition-all duration-200 ml-4"
            >
              💬 Subscribe to SMS Alerts
            </button>
            
            <p className="text-sm text-gray-500">
              Sample: 30 seconds, no signup • Subscribe: Get ongoing SMS insights
            </p>
          </div>
        </div>
      </section>
      
      <SampleSMSModal 
        isOpen={showSampleModal}
        onClose={() => setShowSampleModal(false)}
      />
      
      <SlickTextCTAModal 
        isOpen={showCTAModal}
        onClose={() => setShowCTAModal(false)}
      />
    </>
  );
}