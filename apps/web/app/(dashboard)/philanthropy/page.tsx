'use client';

import { useState } from 'react';
import { Heart, ShieldCheck, Globe, Scale, Lightbulb, ChevronRight, AlertTriangle, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PhilanthropyPage() {
  const [healthCheckStatus, setHealthCheckStatus] = useState<'idle' | 'running' | 'completed'>('idle');
  const [score, setScore] = useState(0);

  const runHealthCheck = () => {
    setHealthCheckStatus('running');
    setTimeout(() => {
      setScore(85);
      setHealthCheckStatus('completed');
    }, 2000);
  };

  return (
    <div className="flex-1 space-y-6 pt-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between px-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Heart className="w-6 h-6 text-pink-500" />
            Philanthropic Strategy
          </h2>
          <p className="text-slate-400">Manage and optimize family giving, foundations, and social impact.</p>
        </div>
      </div>

      <div className="px-6">
        <Tabs defaultValue="strategies" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800">
            <TabsTrigger value="strategies" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              Strategies & Vehicles
            </TabsTrigger>
            <TabsTrigger value="health-check" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <ShieldCheck className="w-4 h-4 mr-2 text-green-400" />
              Health Check
            </TabsTrigger>
            <TabsTrigger value="best-practices" className="data-[state=active]:bg-slate-800 data-[state=active]:text-white">
              <Lightbulb className="w-4 h-4 mr-2 text-yellow-400" />
              Best Practices
            </TabsTrigger>
          </TabsList>

          <TabsContent value="strategies" className="mt-6 space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-blue-400" />
                    Donor Advised Funds (DAF)
                  </CardTitle>
                  <CardDescription>Flexible and tax-efficient giving.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-400">
                  A DAF is a giving account established at a public charity. It allows donors to make a charitable contribution, receive an immediate tax deduction, and then recommend grants from the fund over time.
                </CardContent>
                <CardFooter>
                  <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center font-medium transition-colors">
                    Explore DAFs in Brazil vs US <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </CardFooter>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Scale className="w-5 h-5 text-amber-400" />
                    Private Foundations
                  </CardTitle>
                  <CardDescription>Maximum control, higher compliance.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-400">
                  Ideal for large-scale, multi-generational philanthropy. Offers complete control over board appointments and grant-making, but requires significant administrative overhead and strict regulatory compliance.
                </CardContent>
                <CardFooter>
                   <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center font-medium transition-colors">
                    Setup Guidelines <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </CardFooter>
              </Card>

              <Card className="bg-slate-900/50 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Heart className="w-5 h-5 text-pink-400" />
                    Direct Impact Investing
                  </CardTitle>
                  <CardDescription>Aligning wealth with purpose.</CardDescription>
                </CardHeader>
                <CardContent className="text-sm text-slate-400">
                  Investing directly into companies, organizations, and funds with the intention to generate a measurable, beneficial social or environmental impact alongside a financial return.
                </CardContent>
                <CardFooter>
                  <button className="text-blue-400 hover:text-blue-300 text-sm flex items-center font-medium transition-colors">
                    View ESG Portfolios <ArrowRight className="w-4 h-4 ml-1" />
                  </button>
                </CardFooter>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="health-check" className="mt-6">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">Philanthropic Health & Compliance Check</CardTitle>
                <CardDescription>Evaluate the efficiency and legal standing of current philanthropic structures.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {healthCheckStatus === 'idle' && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <ShieldCheck className="w-16 h-16 text-slate-700 mb-4" />
                    <h3 className="text-lg font-medium text-white mb-2">Run Diagnostic</h3>
                    <p className="text-slate-400 max-w-md mb-6">
                      Analyze current family giving against tax optimization rules (e.g. ITCMD limits in Brazil, 5% minimum distribution for US Foundations).
                    </p>
                    <button
                      onClick={runHealthCheck}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/20"
                    >
                      Start Analysis
                    </button>
                  </div>
                )}

                {healthCheckStatus === 'running' && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
                      <ShieldCheck className="absolute inset-0 m-auto w-8 h-8 text-blue-500" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">Analyzing Structures...</h3>
                    <p className="text-slate-400">Checking ITCMD compliance and cross-border tax efficiencies.</p>
                  </div>
                )}

                {healthCheckStatus === 'completed' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between p-6 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">Health Score: {score}/100</h3>
                        <p className="text-slate-400">Structure is mostly compliant, but optimization is possible.</p>
                      </div>
                      <div className="text-5xl font-black text-green-400">{score}%</div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-medium tracking-wider text-slate-500 uppercase">Actionable Insights</h4>
                      
                      <div className="p-4 bg-yellow-900/20 border border-yellow-700/50 rounded-lg flex gap-4 items-start">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-yellow-500 mb-1">State ITCMD Limit Reached (SP)</h5>
                          <p className="text-sm text-slate-300">
                            Direct family donations in São Paulo are nearing the annual ITCMD exemption limit (approx. R$ 80,000). Further direct donations will incur a 4% tax. Consider routing through an endowed fund.
                          </p>
                        </div>
                      </div>

                      <div className="p-4 bg-green-900/20 border border-green-700/50 rounded-lg flex gap-4 items-start">
                        <ShieldCheck className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                        <div>
                          <h5 className="font-medium text-green-500 mb-1">US Foundation Distribution</h5>
                          <p className="text-sm text-slate-300">
                            The family's US Private Foundation has successfully met the 5% minimum qualifying distribution requirement for the current fiscal year.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="pt-4 flex justify-end">
                      <button onClick={() => setHealthCheckStatus('idle')} className="text-slate-400 hover:text-white transition-colors text-sm">
                        Run New Audit
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="best-practices" className="mt-6">
             <Card className="bg-slate-900/50 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white">MFO Philanthropy Guidelines</CardTitle>
                <CardDescription>Curated standards for multi-generational wealth transition and giving.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-4 mt-2">
                  <li className="flex gap-3">
                    <ChevronRight className="w-5 h-5 text-pink-500 shrink-0" />
                    <div>
                      <strong className="text-slate-200 block mb-1">Involve the Next Generation Early</strong>
                      <p className="text-sm text-slate-400">Use philanthropy as a training ground for financial literacy and family governance by allowing NextGen members to manage a subset of the giving budget.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <ChevronRight className="w-5 h-5 text-pink-500 shrink-0" />
                    <div>
                      <strong className="text-slate-200 block mb-1">Align with Investment Policy Statement (IPS)</strong>
                      <p className="text-sm text-slate-400">Ensure that the foundation's endowment is invested in a manner that does not contradict its philanthropic mission (e.g., negative screening for ESG).</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <ChevronRight className="w-5 h-5 text-pink-500 shrink-0" />
                    <div>
                      <strong className="text-slate-200 block mb-1">Document the Family Vision</strong>
                      <p className="text-sm text-slate-400">Establish a formal Family Constitution that explicitly outlines the shared values and goals driving the family's charitable initiatives.</p>
                    </div>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </div>
  );
}
