/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image as ImageIcon, Video, ShieldCheck, Sparkles, Zap, 
  HelpCircle, ChevronDown, Check, ArrowRight, Github
} from 'lucide-react';
import ImageRemover from './components/ImageRemover';
import VideoRemover from './components/VideoRemover';

export default function App() {
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white" id="main-app-container">
      
      {/* 1. DECORATIVE BACKGROUND GLOW */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* 2. HEADER NAVIGATION */}
      <header className="border-b border-slate-900/80 bg-slate-950/60 backdrop-blur-md sticky top-0 z-50 transition" id="app-nav-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1.5">
                网页去水印工具
                <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 font-medium">
                  V1.2 PRO
                </span>
              </h1>
              <p className="text-[10px] text-slate-500 hidden sm:block">智能内容重塑，本地像素级无损处理</p>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs text-slate-400">
            <div className="hidden md:flex items-center gap-1.5 text-emerald-400/90 font-medium bg-emerald-500/5 px-2.5 py-1 rounded-full border border-emerald-500/15">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>本服务不上传任何文件，100% 保护隐私安全</span>
            </div>
            
            <span className="text-slate-800 hidden md:block">|</span>
            
            <div className="flex items-center gap-1 text-slate-500">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>硬件加速开启</span>
            </div>
          </div>
        </div>
      </header>

      {/* 3. HERO DESCRIPTION CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10 flex flex-col gap-8">
        
        {/* Intro text */}
        <div className="text-center md:text-left md:flex md:items-end justify-between border-b border-slate-900 pb-6 gap-6" id="welcome-intro-block">
          <div>
            <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest block mb-1">
              FREE WATERMARK REMOVER ONLINE
            </span>
            <h2 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
              图片与视频无缝消除水印
            </h2>
            <p className="mt-2 text-slate-400 text-sm max-w-2xl leading-relaxed">
              基于前沿的 Web Canvas 帧缓冲算法，为您提供一个开箱即用的本地处理工作区。无需下载额外客户端，只需轻轻涂抹或圈选，即可迅速移除画面瑕疵、字幕、台标或复杂防伪文案。
            </p>
          </div>

          {/* Quick tab control */}
          <div className="mt-6 md:mt-0 bg-slate-900/60 border border-slate-800 p-1.5 rounded-xl flex gap-1 self-center" id="tab-controls">
            <button
              id="tab-btn-image"
              onClick={() => setActiveTab('image')}
              className={`flex items-center gap-2 py-2.5 px-5 rounded-lg text-xs font-bold transition select-none ${
                activeTab === 'image'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              图片无损擦除
            </button>
            <button
              id="tab-btn-video"
              onClick={() => setActiveTab('video')}
              className={`flex items-center gap-2 py-2.5 px-5 rounded-lg text-xs font-bold transition select-none ${
                activeTab === 'video'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Video className="w-4 h-4" />
              视频多区屏蔽
            </button>
          </div>
        </div>

        {/* 4. ACTIVE FUNCTIONAL WORKSPACE */}
        <div className="min-h-[480px]" id="applet-active-workspace">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25 }}
            >
              {activeTab === 'image' ? <ImageRemover /> : <VideoRemover />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 5. APP FEATURES GRID */}
        <section className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6" id="features-highlights">
          
          <div className="p-5 bg-slate-900/35 border border-slate-900 rounded-xl flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/15 flex items-center justify-center text-indigo-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">100% 隐私安全保障</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                所有资源和原始图像数据均在您的浏览器本地进行内存加载、渲染和混叠处理，决不向外部服务器上传任何临时字节，安全绝对无忧。
              </p>
            </div>
          </div>

          <div className="p-5 bg-slate-900/35 border border-slate-900 rounded-xl flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center text-emerald-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">智能拟差插值重建</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                独创的画笔内容识别算法会快速捕获涂抹边界的未污染像素，依距离自适应构建渐变纹理，实现不糊成片、无断崖式突变的无缝修复。
              </p>
            </div>
          </div>

          <div className="p-5 bg-slate-900/35 border border-slate-900 rounded-xl flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/15 flex items-center justify-center text-purple-400 shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-100">多模态屏蔽策略</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                支持高斯模糊（可调半径）、马赛克色块遮盖（可变格尺寸）、拉伸延展以及自定义文字、底色等多重复合手段，深度掌控擦除逻辑。
              </p>
            </div>
          </div>

        </section>

        {/* 6. EXPANDABLE FAQ ACCORDION SECTION */}
        <section className="bg-slate-900/20 border border-slate-900 rounded-2xl p-6 mt-4" id="faq-accordion-block">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="w-4.5 h-4.5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">使用常见问题及技术解析</h3>
          </div>

          <div className="space-y-3.5">
            {[
              {
                q: "图片去水印的“智能填充/内容识别”算法是如何在浏览器中运行的？",
                a: "本工具集成了自研的递归外向轮廓传播算法（类似 Telea 算法原理）。由于它是纯本地 JavaScript 代码编写，程序会对您涂抹区域（红框/红笔迹）的轮廓宽度进行分解，逐层向内部采样未污染区域的背景平均色，并应用高斯衰减权重进行混合，从而在无服务器端大型大模型介入下依然能实现接近完美的质感拼合。"
              },
              {
                q: "视频去水印导出的原理是什么，下载的格式有损吗？",
                a: "当您在视频上放置高斯模糊或马赛克滤镜后，浏览器通过 HTML5 Canvas 高频抓取视频的实时帧（每秒30帧），混合并过滤完水印坐标像素后，再交由 MediaRecorder 视频采集接口，无损合成为标准的 WebM 高画质编码格式文件。这保证了没有任何画质压缩或二度转码失真。"
              },
              {
                q: "为什么大尺寸视频在我的电脑上渲染导出偏慢？",
                a: "由于所有的帧捕获、裁剪、硬件像素矩阵计算均在您的设备 CPU/GPU 内存中实时完成，当视频的分辨率达到 1080P 或 4K 时，浏览器在每帧混合时需要消耗一定的硬件算力，这是为了保证绝对的安全离线隐私，请在渲染进度完成前保持页面处于前台工作状态即可。"
              }
            ].map((item, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index} 
                  className="bg-slate-950 rounded-xl border border-slate-900 hover:border-slate-800 transition"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full text-left p-4 flex items-center justify-between gap-4 select-none"
                  >
                    <span className="text-xs md:text-sm font-semibold text-slate-200">{item.q}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <p className="px-4 pb-4 text-xs text-slate-400 leading-relaxed border-t border-slate-900/60 pt-3">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* 7. SECURE FOOTER */}
      <footer className="border-t border-slate-900/80 bg-slate-950 py-6 mt-16 text-xs text-slate-550" id="app-footer">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="p-1 px-2 rounded-md bg-indigo-500/10 text-indigo-400 text-[10px] border border-indigo-500/20 font-bold">
              SAFE CORE
            </span>
            <span>网页去水印自动化处理软件 · 本设备极安全离线处理模式已激活</span>
          </div>
          
          <div className="flex items-center gap-1 text-slate-600">
            <span>© 2026 Web Watermark Eraser PRO. All files are private.</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
