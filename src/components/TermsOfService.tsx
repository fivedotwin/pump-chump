import React from 'react';
import { ArrowLeft, Shield, AlertTriangle, Users, Gavel, Eye, Lock, Zap } from 'lucide-react';

interface TermsOfServiceProps {
  onBack: () => void;
}

export const TermsOfService: React.FC<TermsOfServiceProps> = ({ onBack }) => {
  return (
    <div className="min-h-screen bg-black text-white font-mono">
      {/* Header with Logo */}
      <div className="bg-gray-900 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded overflow-hidden border border-green-400/30 bg-gray-800">
              <img 
                src="https://i.imgur.com/RdENATy.png" 
                alt="Pump Chump" 
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-green-400">Pump Chump</h1>
              <p className="text-gray-400 text-sm">Terms of Service</p>
            </div>
          </div>
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 rounded bg-gray-700 text-white hover:bg-gray-600 transition-all duration-200"
          >
            <ArrowLeft className="w-4 h-4" />
            [back]
          </button>
        </div>
      </div>

      {/* Terms Content */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded overflow-hidden border-2 border-green-400 bg-gray-800">
              <img 
                src="https://i.imgur.com/RdENATy.png" 
                alt="Pump Chump" 
                className="w-full h-full object-cover"
              />
            </div>
            <h2 className="text-3xl font-bold text-green-400 mb-2">Terms of Service</h2>
            <p className="text-gray-400">Last updated: {new Date().toLocaleDateString()}</p>
          </div>

          {/* Introduction */}
          <div className="mb-8 p-4 bg-green-400/10 border border-green-400/30 rounded">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
              <div>
                <h3 className="text-green-400 font-bold mb-2">Welcome to Pump Chump</h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  By accessing or using Pump Chump ("the Platform"), you agree to be bound by these Terms of Service. 
                  Pump Chump is a decentralized memecoin launchpad and live streaming platform built on the Solana blockchain.
                </p>
              </div>
            </div>
          </div>

          {/* Terms Sections */}
          <div className="space-y-8">
            {/* 1. Acceptance of Terms */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Gavel className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">1. Acceptance of Terms</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>
                  By connecting your Solana wallet and using Pump Chump, you acknowledge that you have read, 
                  understood, and agree to be bound by these Terms of Service and our Privacy Policy.
                </p>
                <p>
                  If you do not agree to these terms, you must not access or use the Platform.
                </p>
              </div>
            </section>

            {/* 2. Platform Description */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Zap className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">2. Platform Description</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>
                  Pump Chump provides:
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Memecoin creation and trading on Solana blockchain</li>
                  <li>Live video streaming capabilities for traders</li>
                  <li>Interactive gaming features including brick-breaking games</li>
                  <li>Social features for community interaction</li>
                  <li>Wallet integration for Solana-based transactions</li>
                </ul>
              </div>
            </section>

            {/* 3. User Responsibilities */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">3. User Responsibilities</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>You agree to:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Provide accurate information when creating your profile</li>
                  <li>Maintain the security of your wallet and private keys</li>
                  <li>Comply with all applicable laws and regulations</li>
                  <li>Not engage in market manipulation or fraudulent activities</li>
                  <li>Respect other users and maintain appropriate conduct during live streams</li>
                  <li>Not use the Platform for money laundering or illegal activities</li>
                </ul>
              </div>
            </section>

            {/* 4. Financial Risks */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
                <h3 className="text-xl font-bold text-white">4. Financial Risks & Disclaimers</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <div className="p-4 bg-yellow-400/10 border border-yellow-400/30 rounded">
                  <p className="text-yellow-400 font-bold mb-2">⚠️ HIGH RISK WARNING</p>
                  <p>
                    Trading memecoins involves substantial risk of loss. You may lose all invested funds. 
                    Only invest what you can afford to lose completely.
                  </p>
                </div>
                <p>You acknowledge that:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Cryptocurrency trading is highly speculative and risky</li>
                  <li>Memecoin values can be extremely volatile</li>
                  <li>Past performance does not guarantee future results</li>
                  <li>We do not provide financial advice or investment recommendations</li>
                  <li>You are solely responsible for your trading decisions</li>
                </ul>
              </div>
            </section>

            {/* 5. Privacy & Data */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">5. Privacy & Data Collection</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>We collect and process:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Wallet addresses for authentication and transaction processing</li>
                  <li>Profile information you voluntarily provide</li>
                  <li>Usage data to improve Platform functionality</li>
                  <li>Video/audio streams during live streaming sessions</li>
                </ul>
                <p>
                  We do not store private keys or have access to your wallet funds. 
                  All transactions are processed directly on the Solana blockchain.
                </p>
              </div>
            </section>

            {/* 6. Prohibited Activities */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Lock className="w-5 h-5 text-red-400" />
                <h3 className="text-xl font-bold text-white">6. Prohibited Activities</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>You may not:</p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Use the Platform for illegal activities</li>
                  <li>Manipulate markets or engage in pump-and-dump schemes</li>
                  <li>Harass, abuse, or threaten other users</li>
                  <li>Share inappropriate content during live streams</li>
                  <li>Attempt to hack or exploit Platform vulnerabilities</li>
                  <li>Create multiple accounts to circumvent restrictions</li>
                  <li>Use automated trading bots without permission</li>
                </ul>
              </div>
            </section>

            {/* 7. Limitation of Liability */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">7. Limitation of Liability</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <div className="p-4 bg-red-400/10 border border-red-400/30 rounded">
                  <p className="text-red-400 font-bold mb-2">IMPORTANT DISCLAIMER</p>
                  <p>
                    Pump Chump is provided "as is" without warranties. We are not liable for any losses, 
                    damages, or issues arising from Platform use, including but not limited to trading losses, 
                    technical failures, or security breaches.
                  </p>
                </div>
                <p>
                  Our liability is limited to the maximum extent permitted by law. 
                  You use the Platform at your own risk.
                </p>
              </div>
            </section>

            {/* 8. Modifications */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Gavel className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">8. Modifications to Terms</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>
                  We reserve the right to modify these Terms of Service at any time. 
                  Changes will be effective immediately upon posting. Continued use of the Platform 
                  constitutes acceptance of modified terms.
                </p>
              </div>
            </section>

            {/* 9. Contact Information */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <Users className="w-5 h-5 text-green-400" />
                <h3 className="text-xl font-bold text-white">9. Contact & Support</h3>
              </div>
              <div className="pl-8 space-y-3 text-gray-300 text-sm leading-relaxed">
                <p>
                  For questions about these Terms of Service or Platform support, 
                  please contact us through our official channels or community Discord.
                </p>
                <p className="text-green-400">
                  Remember: We will never ask for your private keys or seed phrases!
                </p>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="mt-12 pt-8 border-t border-gray-700 text-center">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="w-8 h-8 rounded overflow-hidden border border-green-400/30 bg-gray-800">
                <img 
                  src="https://i.imgur.com/RdENATy.png" 
                  alt="Pump Chump" 
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-green-400 font-bold">Pump Chump</span>
            </div>
            <p className="text-gray-400 text-sm">
              By using Pump Chump, you acknowledge that you have read and understood these terms.
            </p>
            <p className="text-gray-500 text-xs mt-2">
              Trade responsibly. Only invest what you can afford to lose. 🚀
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};