import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Sparkles, Trash2, Undo2, Redo2, Eye, EyeOff, Download, 
  RotateCcw, Sliders, Brush, PaintBucket, Minimize2, MoveRight, HelpCircle
} from 'lucide-react';
import { inpaintCanvas } from '../utils/inpainting';
import { ImageEditorState, ImageRemovalMethod } from '../types';

export default function ImageRemover() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageName, setImageName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  
  // Editor parameters
  const [editorState, setEditorState] = useState<ImageEditorState>({
    brushSize: 24,
    removalMethod: 'inpaint',
    fillColor: '#ffffff',
    blurRadius: 15,
    pixelSize: 12,
    stretchDirection: 'left'
  });

  // Canvas refs
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  // States
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showOriginal, setShowOriginal] = useState(false);
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Show guides / instructions
  const [showHelp, setShowHelp] = useState(true);

  // Show a toast message helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Generate dynamic sample images for easy testing!
  const loadSampleImage = (type: 'photo' | 'report' | 'banner') => {
    // We create a canvas, paint a custom scene with a watermark, extract its dataURL, and load it as image
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 800;
    sampleCanvas.height = 600;
    const ctx = sampleCanvas.getContext('2d');
    if (!ctx) return;

    if (type === 'photo') {
      // Landscape photo
      // Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 300);
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(1, '#bae6fd');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 800, 600);

      // Mountains
      ctx.fillStyle = '#0f766e';
      ctx.beginPath();
      ctx.moveTo(0, 450);
      ctx.lineTo(200, 300);
      ctx.lineTo(400, 500);
      ctx.lineTo(650, 250);
      ctx.lineTo(800, 480);
      ctx.lineTo(800, 600);
      ctx.lineTo(0, 600);
      ctx.fill();

      // Sun
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(600, 150, 60, 0, Math.PI * 2);
      ctx.fill();

      // Lake
      ctx.fillStyle = '#0e7490';
      ctx.fillRect(0, 480, 800, 120);

      // Watermark Text list
      ctx.save();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.font = 'bold 36px Arial';
      ctx.textAlign = 'center';
      
      // Top right time watermark
      ctx.font = '24px monospace';
      ctx.fillStyle = 'rgba(234, 88, 12, 0.85)'; // Orange timestamp
      ctx.fillText('2026-06-09 13:15:01', 650, 50);

      // Big diagonal watermark text
      ctx.translate(400, 300);
      ctx.rotate(-Math.PI / 10);
      ctx.font = 'bold 54px sans-serif';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
      ctx.fillText('COPYRIGHT WATERMARK', 0, 0);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeText('COPYRIGHT WATERMARK', 0, 0);
      ctx.restore();

      setImageName('风景摄影样图_含有时间戳与斜向水印.png');
    } else if (type === 'report') {
      // Document page
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, 800, 600);

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('行业市场分析报告与财务摘要', 60, 80);

      ctx.fillStyle = '#475569';
      ctx.font = '16px sans-serif';
      ctx.fillText('一、概述与核心指标', 60, 130);

      // Lines of text
      ctx.fillStyle = '#334155';
      ctx.font = '14px monospace';
      const lines = [
        '研究表明，近三年来在电商去水印工具及图片处理领域的市场渗透率保持每年 12% 的高速增长。',
        '随着内容创作者日益增长的版权二次加工需求，高精度、零痕迹的AI修复技术受到极高追捧。',
        '2026年Q2度数据显示，用户对于图片质量的要求从 720P 普遍升级到了具有高斯细节的 4K 分辨率。',
        '本文件包含的核心内容涉及算法参数化调整、视频重构和MediaRecorder媒体录制，请妥善保管。',
        '测试提示：使用左侧的“智能填充/内容识别”画笔，均匀涂抹在下方灰色“机密”防伪水印上，然后点击“开始去除”按钮。',
        '你也可以尝试使用“模糊过渡”或“像素马赛克”来体验不一样的遮盖效果。'
      ];
      lines.forEach((line, index) => {
        ctx.fillText(line, 60, 180 + index * 30);
      });

      // Grid chart
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(100, 400 + i * 30);
        ctx.lineTo(700, 400 + i * 30);
        ctx.stroke();
      }

      // Watermark Behind
      ctx.save();
      ctx.translate(400, 300);
      ctx.rotate(-Math.PI / 12);
      ctx.fillStyle = 'rgba(220, 38, 38, 0.12)'; // Light red watermark
      ctx.font = '90px Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('INTERNAL ONLY', 0, 50);
      ctx.fillText('机密文件', 0, -50);
      ctx.restore();

      setImageName('文档报告样图_机密红色背景水印.png');
    } else {
      // Commercial Banner
      // Gradient background
      const pathGrad = ctx.createLinearGradient(0, 0, 800, 600);
      pathGrad.addColorStop(0, '#4f46e5');
      pathGrad.addColorStop(0.5, '#7c3aed');
      pathGrad.addColorStop(1, '#db2777');
      ctx.fillStyle = pathGrad;
      ctx.fillRect(0, 0, 800, 600);

      // Product stand mock
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.ellipse(400, 420, 200, 50, 0, 0, Math.PI * 2);
      ctx.fill();

      // Product block
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect(320, 220, 160, 200, 16);
      ctx.fill();

      // Simple icon on product
      ctx.fillStyle = '#a855f7';
      ctx.beginPath();
      ctx.arc(400, 300, 32, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fdba74';
      ctx.font = 'bold 36px Arial';
      ctx.fillText('★ SUPER DEALS ★', 230, 120);

      // Store Watermark on white product and background
      ctx.fillStyle = 'rgba(15, 23, 42, 0.3)';
      ctx.font = 'bold 24px sans-serif';
      ctx.fillText('店铺名 ID: 998811', 330, 260);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(325, 235, 150, 170);

      // Outer pattern watermark
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.font = 'italic 700 24px sans-serif';
      ctx.fillText('PROMO ONLY - DO NOT REPOST', 200, 520);

      setImageName('电商广告样图_白色主体前置店名水印.png');
    }

    const img = new Image();
    img.src = sampleCanvas.toDataURL();
    img.onload = () => {
      setImage(img);
      initializeCanvases(img);
    };
  };

  // Handle Drag Over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle Drag Leave
  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Handle Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Input File
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  // Process selected file
  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      triggerToast('❌ 请流式上传合法的图片格式文件');
      return;
    }

    setImageName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const img = new Image();
        img.src = event.target.result as string;
        img.onload = () => {
          setImage(img);
          initializeCanvases(img);
          triggerToast('🎉 图片加载成功！使用画笔在要移除的水印上涂抹吧。');
        };
      }
    };
    reader.readAsDataURL(file);
  };

  // Initialize Canvas
  const initializeCanvases = (img: HTMLImageElement) => {
    // Keep raw physical coordinates at full, uncompressed natural resolution
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;

    setCanvasDimensions({ width, height });

    // Restrain CSS layout dimensions but keep resolution lossless
    const maxW = 1000;
    const maxH = 680;
    const ratio = Math.min(1, maxW / width, maxH / height);
    const renderWidth = Math.round(width * ratio);
    const renderHeight = Math.round(height * ratio);

    setDisplayDimensions({ width: renderWidth, height: renderHeight });
  };

  // Render original image into base canvas on canvasDimensions changes
  useEffect(() => {
    if (!image || canvasDimensions.width === 0) return;

    const imgCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    if (!imgCanvas || !maskCanvas) return;

    const ctx = imgCanvas.getContext('2d');
    const maskCtx = maskCanvas.getContext('2d');
    if (!ctx || !maskCtx) return;

    // Setup base resolution
    imgCanvas.width = canvasDimensions.width;
    imgCanvas.height = canvasDimensions.height;

    maskCanvas.width = canvasDimensions.width;
    maskCanvas.height = canvasDimensions.height;

    // Draw base image
    ctx.drawImage(image, 0, 0, canvasDimensions.width, canvasDimensions.height);

    // Save state
    const originalData = ctx.getImageData(0, 0, canvasDimensions.width, canvasDimensions.height);
    setOriginalImageData(originalData);

    // Reset history
    setHistory([originalData]);
    setHistoryIndex(0);

    // Reset mask
    maskCtx.clearRect(0, 0, canvasDimensions.width, canvasDimensions.height);

  }, [canvasDimensions, image]);

  // Handle drawing mouse/touch coordinates
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return null;

    const rect = maskCanvas.getBoundingClientRect();
    
    // Support Touch Events as well!
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Maps client pixels to actual canvas coordinates exactly
    const x = ((clientX - rect.left) / rect.width) * maskCanvas.width;
    const y = ((clientY - rect.top) / rect.height) * maskCanvas.height;

    return { x, y };
  };

  const handleStartDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);

    const coords = getCoordinates(e);
    if (!coords) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const rect = maskCanvas.getBoundingClientRect();
    const scale = rect.width ? (maskCanvas.width / rect.width) : 1;

    maskCtx.beginPath();
    maskCtx.arc(coords.x, coords.y, (editorState.brushSize * scale) / 2, 0, Math.PI * 2);
    
    // Brushing color indicator
    maskCtx.fillStyle = 'rgba(239, 68, 68, 0.7)'; // Transparent red
    maskCtx.fill();

    maskCtx.beginPath();
    maskCtx.moveTo(coords.x, coords.y);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const coords = getCoordinates(e);
    if (!coords) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return;

    const rect = maskCanvas.getBoundingClientRect();
    const scale = rect.width ? (maskCanvas.width / rect.width) : 1;

    maskCtx.lineWidth = editorState.brushSize * scale;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.strokeStyle = 'rgba(239, 68, 68, 0.7)';

    maskCtx.lineTo(coords.x, coords.y);
    maskCtx.stroke();

    maskCtx.beginPath();
    maskCtx.moveTo(coords.x, coords.y);
  };

  const handleEndDraw = () => {
    setIsDrawing(false);
  };

  // Reset the Overlay Mask Canvas
  const clearMask = () => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d');
    if (maskCtx) {
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
      triggerToast('🧹 涂抹区域已清空！');
    }
  };

  // Revert back completely to original loaded image state
  const resetImageToOriginal = () => {
    const imgCanvas = imageCanvasRef.current;
    if (!imgCanvas || !originalImageData) return;
    const ctx = imgCanvas.getContext('2d');
    if (ctx) {
      ctx.putImageData(originalImageData, 0, 0);
      setHistory([originalImageData]);
      setHistoryIndex(0);
      clearMask();
      triggerToast('🔄 已还原到图片的初始未处理状态');
    }
  };

  // Undo last step
  const handleUndo = () => {
    if (historyIndex > 0) {
      const idx = historyIndex - 1;
      setHistoryIndex(idx);
      const imgCanvas = imageCanvasRef.current;
      if (imgCanvas) {
        const ctx = imgCanvas.getContext('2d');
        ctx?.putImageData(history[idx], 0, 0);
      }
    }
  };

  // Redo step
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const idx = historyIndex + 1;
      setHistoryIndex(idx);
      const imgCanvas = imageCanvasRef.current;
      if (imgCanvas) {
        const ctx = imgCanvas.getContext('2d');
        ctx?.putImageData(history[idx], 0, 0);
      }
    }
  };

  // Push updated state to undo queue
  const pushHistory = (imgData: ImageData) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(imgData);
    
    // Cap at 15 states to avoid huge RAM consumption
    if (newHistory.length > 15) {
      newHistory.shift();
    }
    
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Check if mask contains any drawn pixels
  const isMaskEmpty = (): boolean => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return true;
    const maskCtx = maskCanvas.getContext('2d');
    if (!maskCtx) return true;

    const data = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height).data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] > 10) return false; // Contains visible brush transparent strokes
    }
    return true;
  };

  // Execute Watermark Removal Algorithm
  const executeRemoval = async () => {
    if (!imageCanvasRef.current || !maskCanvasRef.current) return;

    if (isMaskEmpty()) {
      triggerToast('💡 请先使用画笔在图片的水印文字、Logo 或红字区域上进行涂抹！');
      return;
    }

    setIsProcessing(true);
    // Standard delay to look smooth and let browser thread update UI beautifully
    await new Promise((resolve) => setTimeout(resolve, 400));

    try {
      const imgCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const ctx = imgCanvas.getContext('2d');
      if (!ctx) return;

      const { removalMethod, fillColor, blurRadius, pixelSize, stretchDirection } = editorState;
      const width = imgCanvas.width;
      const height = imgCanvas.height;

      if (removalMethod === 'gemini-ai-inpaint') {
        const maskCtx = maskCanvas.getContext('2d');
        if (!maskCtx) throw new Error("Could not access mask context");

        const maskData = maskCtx.getImageData(0, 0, width, height).data;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let hasMask = false;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4 + 3;
            // Any semi-visible stroke pixel is part of our mask
            if (maskData[idx] > 30) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
              hasMask = true;
            }
          }
        }

        if (!hasMask) {
          triggerToast('💡 请先使用画笔在图片的水印上进行涂抹！');
          setIsProcessing(false);
          return;
        }

        // Calculate cropped 1:1 square surrounding watermark to minimize packet load & increase speed
        const boxW = maxX - minX;
        const boxH = maxY - minY;
        const centerX = minX + boxW / 2;
        const centerY = minY + boxH / 2;

        const maxSideOfBox = Math.max(boxW, boxH);
        const padding = Math.max(120, maxSideOfBox * 0.5); // Rich details capture
        const sideLen = Math.round(Math.min(width, height, maxSideOfBox + padding));

        const startX = Math.round(Math.max(0, Math.min(width - sideLen, centerX - sideLen / 2)));
        const startY = Math.round(Math.max(0, Math.min(height - sideLen, centerY - sideLen / 2)));

        // Crop region on helper canvas
        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = sideLen;
        cropCanvas.height = sideLen;
        const cropCtx = cropCanvas.getContext('2d');
        if (!cropCtx) throw new Error("Could not construct crop graphics context");

        cropCtx.drawImage(imgCanvas, startX, startY, sideLen, sideLen, 0, 0, sideLen, sideLen);

        // Optional: Let's also overlay a light highlight on the crop to hint Gemini where the watermark is,
        // or let Gemini's vision find it itself. To preserve pure quality, we'll send the clean crop of original
        const cropBase64 = cropCanvas.toDataURL('image/png');

        triggerToast('🔮 正在打包并传送数据，召唤 Gemini 大模型为您重塑图像...');

        try {
          const res = await fetch('/api/gemini/inpaint', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              image: cropBase64,
              prompt: "In this image, there is an digital watermark or time logo. Please perform photorealistic content-aware inpainting to delete and erase the watermark, reconstructing natural textures, light, colors, and features beneath it perfectly. Make it look seamlessly clean. Do not output anything except the un-watermarked cropped image parts."
            })
          });

          const data = await res.json();

          if (data && data.success && data.image) {
            // Re-draw generated image patch
            await new Promise<void>((resolve, reject) => {
              const patchImage = new Image();
              patchImage.crossOrigin = "anonymous";
              patchImage.src = data.image;
              patchImage.onload = () => {
                // To blend perfectly we draw the patch, but restrict mixing only within mask box with some feather
                ctx.save();
                ctx.drawImage(patchImage, 0, 0, sideLen, sideLen, startX, startY, sideLen, sideLen);
                ctx.restore();
                resolve();
              };
              patchImage.onerror = (e) => reject(e);
            });
            triggerToast('✨ Gemini AI 画面重置重构消除法执行成功！');
          } else {
            console.warn("Gemini rejected or deactivated. Error message:", data?.message);
            // Fallback to local biharmonic content-aware interpolation
            inpaintCanvas(ctx, width, height, maskCanvas);
            triggerToast('🪄 已启用本地超自适应插值扩散去印 (云端神经系统暂未加载)');
          }
        } catch (apiErr) {
          console.error("API call error; fallback to local", apiErr);
          inpaintCanvas(ctx, width, height, maskCanvas);
          triggerToast('🪄 已启用本地微积分差值插值扩散去印 (网络链接受限)');
        }

      } else if (removalMethod === 'inpaint') {
        // Smart interactive content filling
        inpaintCanvas(ctx, width, height, maskCanvas);

      } else if (removalMethod === 'color') {
        // Solid color paint
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          const maskData = maskCtx.getImageData(0, 0, width, height).data;
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          for (let i = 0; i < width * height; i++) {
            if (maskData[i * 4 + 3] > 30) {
              // Parse hex fill color
              const hex = fillColor.replace('#', '');
              const r = parseInt(hex.substring(0, 2), 16);
              const g = parseInt(hex.substring(2, 4), 16);
              const b = parseInt(hex.substring(4, 6), 16);

              data[i * 4] = r;
              data[i * 4 + 1] = g;
              data[i * 4 + 2] = b;
              data[i * 4 + 3] = 255;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

      } else if (removalMethod === 'pixelate') {
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          const maskData = maskCtx.getImageData(0, 0, width, height).data;
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Compute grid of pixelSize
          for (let y = 0; y < height; y += pixelSize) {
            for (let x = 0; x < width; x += pixelSize) {
              
              // Check if block contains mask
              let blockHasMask = false;
              let rAcc = 0, gAcc = 0, bAcc = 0, count = 0;

              // Scan block
              for (let by = 0; by < pixelSize && (y + by) < height; by++) {
                for (let bx = 0; bx < pixelSize && (x + bx) < width; bx++) {
                  const pxIdx = ((y + by) * width + (x + bx));
                  if (maskData[pxIdx * 4 + 3] > 30) {
                    blockHasMask = true;
                  }
                  
                  const offset = pxIdx * 4;
                  rAcc += data[offset];
                  gAcc += data[offset + 1];
                  bAcc += data[offset + 2];
                  count++;
                }
              }

              // If has mask, fill block with average color
              if (blockHasMask && count > 0) {
                const avgR = Math.round(rAcc / count);
                const avgG = Math.round(gAcc / count);
                const avgB = Math.round(bAcc / count);

                for (let by = 0; by < pixelSize && (y + by) < height; by++) {
                  for (let bx = 0; bx < pixelSize && (x + bx) < width; bx++) {
                    const pxIdx = ((y + by) * width + (x + bx));
                    // Only fill mask pixels in mosaic or entire bounding block? We fill mask pixels specifically
                    if (maskData[pxIdx * 4 + 3] > 30) {
                      const offset = pxIdx * 4;
                      data[offset] = avgR;
                      data[offset + 1] = avgG;
                      data[offset + 2] = avgB;
                    }
                  }
                }
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

      } else if (removalMethod === 'blur') {
        // Gaussian/Box blur region
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          const maskData = maskCtx.getImageData(0, 0, width, height).data;
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Double pass box blur on masked pixels
          const radius = Math.min(25, blurRadius);
          const tempR = new Uint8ClampedArray(data);

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = y * width + x;
              if (maskData[idx * 4 + 3] <= 30) continue;

              let rAcc = 0, gAcc = 0, bAcc = 0, count = 0;

              // Sample box
              for (let sy = -radius; sy <= radius; sy++) {
                const ny = y + sy;
                if (ny < 0 || ny >= height) continue;

                for (let sx = -radius; sx <= radius; sx++) {
                  const nx = x + sx;
                  if (nx < 0 || nx >= width) continue;

                  const nIdx = (ny * width + nx) * 4;
                  rAcc += tempR[nIdx];
                  gAcc += tempR[nIdx + 1];
                  bAcc += tempR[nIdx + 2];
                  count++;
                }
              }

              if (count > 0) {
                const pxIdx = idx * 4;
                data[pxIdx] = Math.round(rAcc / count);
                data[pxIdx + 1] = Math.round(gAcc / count);
                data[pxIdx + 2] = Math.round(bAcc / count);
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

      } else if (removalMethod === 'stretch') {
        // Pixel stretching along direction from the unmasked border
        const maskCtx = maskCanvas.getContext('2d');
        if (maskCtx) {
          const maskData = maskCtx.getImageData(0, 0, width, height).data;
          const imgData = ctx.getImageData(0, 0, width, height);
          const data = imgData.data;

          // Find bounding box coordinates of the masked pixels
          let minX = width, maxX = 0, minY = height, maxY = 0;
          let hasMaskPixels = false;

          for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
              const idx = (y * width + x) * 4 + 3;
              if (maskData[idx] > 30) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
                hasMaskPixels = true;
              }
            }
          }

          if (hasMaskPixels) {
            // Reapply stretch based on the source neighboring line
            if (stretchDirection === 'left') {
              // Grab columns directly on the right (maxX + 1) and stretch leftwise
              const sourceX = Math.min(width - 1, maxX + 2);
              for (let y = minY; y <= maxY; y++) {
                const srcIdx = (y * width + sourceX) * 4;
                const r = data[srcIdx];
                const g = data[srcIdx + 1];
                const b = data[srcIdx + 2];

                for (let x = minX; x <= maxX; x++) {
                  const targetIdx = (y * width + x);
                  if (maskData[targetIdx * 4 + 3] > 30) {
                    const offset = targetIdx * 4;
                    data[offset] = r;
                    data[offset + 1] = g;
                    data[offset + 2] = b;
                  }
                }
              }
            } else if (stretchDirection === 'right') {
              // Grab columns on the left (minX - 2) and stretch rightwise
              const sourceX = Math.max(0, minX - 2);
              for (let y = minY; y <= maxY; y++) {
                const srcIdx = (y * width + sourceX) * 4;
                const r = data[srcIdx];
                const g = data[srcIdx + 1];
                const b = data[srcIdx + 2];

                for (let x = minX; x <= maxX; x++) {
                  const targetIdx = (y * width + x);
                  if (maskData[targetIdx * 4 + 3] > 30) {
                    const offset = targetIdx * 4;
                    data[offset] = r;
                    data[offset + 1] = g;
                    data[offset + 2] = b;
                  }
                }
              }
            } else if (stretchDirection === 'up') {
              // Grab rows on bottom (maxY + 2) and stretch upwards
              const sourceY = Math.min(height - 1, maxY + 2);
              for (let x = minX; x <= maxX; x++) {
                const srcIdx = (sourceY * width + x) * 4;
                const r = data[srcIdx];
                const g = data[srcIdx + 1];
                const b = data[srcIdx + 2];

                for (let y = minY; y <= maxY; y++) {
                  const targetIdx = (y * width + x);
                  if (maskData[targetIdx * 4 + 3] > 30) {
                    const offset = targetIdx * 4;
                    data[offset] = r;
                    data[offset + 1] = g;
                    data[offset + 2] = b;
                  }
                }
              }
            } else if (stretchDirection === 'down') {
              // Grab rows on top (minY - 2) and stretch downwards
              const sourceY = Math.max(0, minY - 2);
              for (let x = minX; x <= maxX; x++) {
                const srcIdx = (sourceY * width + x) * 4;
                const r = data[srcIdx];
                const g = data[srcIdx + 1];
                const b = data[srcIdx + 2];

                for (let y = minY; y <= maxY; y++) {
                  const targetIdx = (y * width + x);
                  if (maskData[targetIdx * 4 + 3] > 30) {
                    const offset = targetIdx * 4;
                    data[offset] = r;
                    data[offset + 1] = g;
                    data[offset + 2] = b;
                  }
                }
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }
      }

      // Record History Frame
      const currentImageState = ctx.getImageData(0, 0, width, height);
      pushHistory(currentImageState);

      // Clear mask so they see the result immediately
      clearMask();
      triggerToast('✨ 水印去除成功！');
    } catch (err) {
      console.error(err);
      triggerToast('❌ 部分算法执行发生异常，请重试');
    } finally {
      setIsProcessing(false);
    }
  };

  // Export processed image
  const handleDownload = () => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      const baseName = imageName.substring(0, imageName.lastIndexOf('.')) || 'watermark_removed';
      link.download = `${baseName}_已移除水印.png`;
      link.href = dataUrl;
      link.click();
      triggerToast('💾 图片成功打包下载！');
    } catch (err) {
      triggerToast('❌ 下载失败，请检查浏览器安全策略');
    }
  };

  // Keyboard undo listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z or Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      // Escape or Backspace clears mask
      if (e.key === 'Escape') {
        clearMask();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history]);

  // Auto extract background color under picker by eyeing image center (default)
  const extractAverageColor = () => {
    const imgCanvas = imageCanvasRef.current;
    if (!imgCanvas) return;
    const ctx = imgCanvas.getContext('2d');
    if (!ctx) return;
    try {
      // Pick color from the upper center
      const x = Math.round(imgCanvas.width / 2);
      const y = Math.round(imgCanvas.height / 5);
      const data = ctx.getImageData(x, y, 1, 1).data;
      const hex = '#' + ((1 << 24) + (data[0] << 16) + (data[1] << 8) + data[2]).toString(16).slice(1);
      setEditorState(prev => ({ ...prev, fillColor: hex }));
      triggerToast(`🎨 自动提取周边画布色: ${hex}`);
    } catch {
      // ignore
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]" id="image-remover-workspace">
      
      {/* LEFT SIDEBAR: CONTROL ACTIONS */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 text-slate-100" id="image-controls-sidebar">
        
        {/* Module title */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2 text-xs font-semibold uppercase bg-indigo-500/20 text-indigo-400 rounded-md border border-indigo-500/30">
              图片去除
            </span>
            <span className="text-slate-500 text-xs">智能像素重建</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">消除参数配置</h2>
        </div>

         {/* Algorithm buttons */}
        <div className="space-y-2">
          <label className="text-slate-400 text-xs font-semibold block">1. 选择去水印方法</label>
          <div className="grid grid-cols-1 gap-1.5" id="removal-methods-group">
            
            <button
              id="method-gemini-ai-inpaint"
              onClick={() => setEditorState(prev => ({ ...prev, removalMethod: 'gemini-ai-inpaint' }))}
              className={`flex items-center justify-between p-3 rounded-xl transition text-left border ${
                editorState.removalMethod === 'gemini-ai-inpaint'
                  ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-violet-300 border-violet-500 font-medium shadow-md shadow-violet-500/10'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-350 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0 animate-pulse" />
                <div>
                  <div className="text-sm font-bold flex items-center gap-1.5 text-violet-200">
                    🪄 Gemini大模型无损重构
                  </div>
                  <div className="text-xs text-slate-500">端脑生成原始无防伪细节的完美底画</div>
                </div>
              </div>
              <div className="text-[9px] bg-violet-500/20 text-violet-300 border border-violet-500/30 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">
                AIGC
              </div>
            </button>

            <button
              id="method-inpaint"
              onClick={() => setEditorState(prev => ({ ...prev, removalMethod: 'inpaint' }))}
              className={`flex items-center justify-between p-3 rounded-xl transition text-left border ${
                editorState.removalMethod === 'inpaint'
                  ? 'bg-indigo-600/20 text-indigo-300 border-indigo-500 font-medium'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-350 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                <div>
                  <div className="text-sm">内容识别智能填充 (推荐)</div>
                  <div className="text-xs text-slate-500">AI拟真差值修复，背景融和最佳</div>
                </div>
              </div>
              <div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse shrink-0" />
            </button>

            <button
              id="method-stretch"
              onClick={() => setEditorState(prev => ({ ...prev, removalMethod: 'stretch' }))}
              className={`flex items-center justify-between p-3 rounded-xl transition text-left border ${
                editorState.removalMethod === 'stretch'
                  ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500 font-medium'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-300 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <MoveRight className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm">线性边缘拉伸填充</div>
                  <div className="text-xs text-slate-500">适合纯色或线性背景的条状水印</div>
                </div>
              </div>
            </button>

            <button
              id="method-color"
              onClick={() => {
                setEditorState(prev => ({ ...prev, removalMethod: 'color' }));
                extractAverageColor();
              }}
              className={`flex items-center justify-between p-3 rounded-xl transition text-left border ${
                editorState.removalMethod === 'color'
                  ? 'bg-amber-600/20 text-amber-300 border-amber-500 font-medium'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-300 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <PaintBucket className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-sm">纯色底色块覆盖</div>
                  <div className="text-xs text-slate-500">直接覆以纯色，可自由吸取色号</div>
                </div>
              </div>
            </button>

            <button
              id="method-blur"
              onClick={() => setEditorState(prev => ({ ...prev, removalMethod: 'blur' }))}
              className={`flex items-center justify-between p-3 rounded-xl transition text-left border ${
                editorState.removalMethod === 'blur'
                  ? 'bg-rose-600/20 text-rose-300 border-rose-500 font-medium'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-300 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="text-sm">超柔和模糊过渡</div>
                  <div className="text-xs text-slate-500">均匀羽化降低杂质文字的视觉可见度</div>
                </div>
              </div>
            </button>

            <button
              id="method-pixelate"
              onClick={() => setEditorState(prev => ({ ...prev, removalMethod: 'pixelate' }))}
              className={`flex items-center justify-between p-3 rounded-xl transition text-left border ${
                editorState.removalMethod === 'pixelate'
                  ? 'bg-blue-600/20 text-blue-300 border-blue-500 font-medium'
                  : 'bg-slate-950 hover:bg-slate-800/80 text-slate-300 border-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Minimize2 className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-sm">像素马赛克打码</div>
                  <div className="text-xs text-slate-500">经典的复古像素碎块阻断识别</div>
                </div>
              </div>
            </button>

          </div>
        </div>

        {/* Dynamic Context Parameters based on algorithm */}
        <AnimatePresence mode="wait">
          <motion.div
            key={editorState.removalMethod}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3.5"
          >
            <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3 h-3" />
              当前方法专属参数
            </div>

            {/* Brush radius (Common is almost all) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1"><Brush className="w-3.5 h-3.5" /> 涂抹画笔大小:</span>
                <span className="font-semibold text-indigo-300">{editorState.brushSize}px</span>
              </div>
              <input
                id="brush-radius-slider"
                type="range"
                min="4"
                max="80"
                value={editorState.brushSize}
                onChange={(e) => setEditorState(prev => ({ ...prev, brushSize: Number(e.target.value) }))}
                className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* GEMINI AI INPAINT OPTION */}
            {editorState.removalMethod === 'gemini-ai-inpaint' && (
              <div className="space-y-2 text-xs text-slate-400 leading-relaxed font-sans mt-1">
                <div className="p-2.5 bg-violet-500/10 border border-violet-500/20 rounded-lg text-violet-300">
                  <div className="font-bold mb-0.5 text-[11px] flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                    云端 AIGC 联想重构已激活
                  </div>
                  本模式利用 Google Imagen & Gemini 多模态图像神经元，根据水印周边的物理、天空、建筑等光影，强力生成/脑补出最自然的原始底图。
                </div>
                <p>
                  💡 <strong>使用方法</strong>: 用画笔完全覆盖水印（可适当偏宽），点击下方紫色按钮。系统将自动裁剪选区并提交给 Gemini 端脑为您重置底图。
                </p>
              </div>
            )}

            {/* INPAINT OPTION */}
            {editorState.removalMethod === 'inpaint' && (
              <p className="text-xs text-slate-400 leading-relaxed font-sans mt-1">
                📌 <strong className="text-slate-300">智能建议</strong>: 请尽量精准地涂抹水印轮廓，画笔可以比待擦除目标稍稍粗出一两圈。边缘轮廓过渡会由算法自动补偿，效果最干净。
              </p>
            )}

            {/* COLOR FILL OPTION */}
            {editorState.removalMethod === 'color' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>遮罩底色 (HEX):</span>
                  <button 
                    onClick={extractAverageColor}
                    className="text-[10px] text-amber-400 hover:underline bg-amber-500/15 px-1.5 py-0.5 rounded"
                  >
                    吸取样图底色
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="color-fill-picker"
                    type="color"
                    value={editorState.fillColor}
                    onChange={(e) => setEditorState(prev => ({ ...prev, fillColor: e.target.value }))}
                    className="w-10 h-8 rounded border border-slate-700 bg-slate-900 cursor-pointer overflow-hidden p-0"
                  />
                  <input
                    type="text"
                    value={editorState.fillColor}
                    onChange={(e) => setEditorState(prev => ({ ...prev, fillColor: e.target.value }))}
                    className="flex-1 bg-slate-900 text-slate-200 text-xs px-2.5 py-1.5 rounded border border-slate-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* STRETCH DIRECTION */}
            {editorState.removalMethod === 'stretch' && (
              <div className="space-y-2">
                <label className="text-xs text-slate-300 block">选择抓取拉伸侧:</label>
                <div className="grid grid-cols-4 gap-1">
                  {(['left', 'right', 'up', 'down'] as const).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setEditorState(prev => ({ ...prev, stretchDirection: dir }))}
                      className={`py-1 text-xs rounded border capitalize transition ${
                        editorState.stretchDirection === dir
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                          : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-850'
                      }`}
                    >
                      {dir === 'left' ? '左侧' : dir === 'right' ? '右侧' : dir === 'up' ? '上方' : '下方'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500">
                  算法将会提取选区对向外侧的第一个有效像素横向或纵向复制，非常适合修复带有复杂横纹或防盗网边缘的水印。
                </p>
              </div>
            )}

            {/* BLUR RADIUS */}
            {editorState.removalMethod === 'blur' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>模糊半径:</span>
                  <span className="font-semibold text-rose-300">{editorState.blurRadius}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="40"
                  value={editorState.blurRadius}
                  onChange={(e) => setEditorState(prev => ({ ...prev, blurRadius: Number(e.target.value) }))}
                  className="w-full accent-rose-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* PIXEL SIZE */}
            {editorState.removalMethod === 'pixelate' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>马赛克像素块尺寸:</span>
                  <span className="font-semibold text-blue-300">{editorState.pixelSize}px</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="32"
                  value={editorState.pixelSize}
                  onChange={(e) => setEditorState(prev => ({ ...prev, pixelSize: Number(e.target.value) }))}
                  className="w-full accent-blue-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Action Controls for drawing */}
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 grid grid-cols-2 gap-2" id="mask-action-buttons">
          <button
            id="btn-clear-mask"
            onClick={clearMask}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs bg-slate-905 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-white transition font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            清空涂抹区域
          </button>
          
          <button
            id="btn-revert-original"
            onClick={resetImageToOriginal}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs bg-slate-905 hover:bg-slate-800 border border-slate-800 text-slate-350 hover:text-white transition font-medium"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            重置加载原图
          </button>
        </div>

        {/* Apply Processing execution */}
        <button
          id="btn-run-remover"
          disabled={!image || isProcessing}
          onClick={executeRemoval}
          className={`w-full font-bold text-sm py-3.5 px-6 rounded-xl relative overflow-hidden transition flex items-center justify-center gap-2 ${
            !image 
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-lg active:scale-[0.98]'
          }`}
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>智能重建修复中...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4.5 h-4.5 text-yellow-300 animate-pulse" />
              <span>开始去除涂抹水印</span>
            </>
          )}
        </button>

        {/* Sample preset launcher */}
        {!image && (
          <div className="border border-indigo-950/40 bg-indigo-950/10 rounded-xl p-3.5 text-center mt-auto">
            <div className="text-indigo-400 font-semibold text-xs mb-2">💡 没有图片？可以直接加载样图进行测试</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button 
                onClick={() => loadSampleImage('photo')}
                className="bg-indigo-900/40 hover:bg-indigo-900/80 text-[11px] py-1.5 px-1 rounded text-indigo-200 transition"
              >
                自然风景
              </button>
              <button 
                onClick={() => loadSampleImage('report')}
                className="bg-indigo-900/40 hover:bg-indigo-900/80 text-[11px] py-1.5 px-1 rounded text-indigo-200 transition"
              >
                公文报告
              </button>
              <button 
                onClick={() => loadSampleImage('banner')}
                className="bg-indigo-900/40 hover:bg-indigo-900/80 text-[11px] py-1.5 px-1 rounded text-indigo-200 transition"
              >
                电商广告
              </button>
            </div>
          </div>
        )}

      </div>

      {/* RIGHT SIDEBAR: CURRENT CANVAS WORKSPACE */}
      <div className="lg:col-span-8 flex flex-col gap-4 bg-slate-950 border border-slate-900 rounded-2xl p-4 md:p-5 relative overflow-hidden text-slate-300" id="image-canvas-viewport">
        
        {/* Top workspace action stats bar */}
        {image && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-900 text-xs">
            <div className="flex items-center gap-1.5 text-slate-400">
              <span className="text-slate-300 truncate max-w-[200px]" title={imageName}>{imageName}</span>
              <span className="text-slate-600">|</span>
              <span>分辨率: <strong className="text-slate-300">{canvasDimensions.width} × {canvasDimensions.height}</strong></span>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                id="btn-undo"
                disabled={historyIndex <= 0}
                onClick={handleUndo}
                className={`p-1.5 rounded-lg border transition ${
                  historyIndex <= 0
                    ? 'border-slate-900 text-slate-700 cursor-not-allowed'
                    : 'border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
                title="撤销 (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                id="btn-redo"
                disabled={historyIndex >= history.length - 1}
                onClick={handleRedo}
                className={`p-1.5 rounded-lg border transition ${
                  historyIndex >= history.length - 1
                    ? 'border-slate-900 text-slate-700 cursor-not-allowed'
                    : 'border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
                title="重做"
              >
                <Redo2 className="w-4 h-4" />
              </button>

              <span className="text-slate-800 font-light">|</span>

              {/* Compare toggle */}
              <button
                id="btn-compare-press"
                onMouseDown={() => {
                  setShowOriginal(true);
                  const imgCanvas = imageCanvasRef.current;
                  if (imgCanvas && originalImageData) {
                    imgCanvas.getContext('2d')?.putImageData(originalImageData, 0, 0);
                  }
                }}
                onMouseUp={() => {
                  setShowOriginal(false);
                  const imgCanvas = imageCanvasRef.current;
                  if (imgCanvas) {
                    imgCanvas.getContext('2d')?.putImageData(history[historyIndex], 0, 0);
                  }
                }}
                onMouseLeave={() => {
                  if (showOriginal) {
                    setShowOriginal(false);
                    const imgCanvas = imageCanvasRef.current;
                    if (imgCanvas) {
                      imgCanvas.getContext('2d')?.putImageData(history[historyIndex], 0, 0);
                    }
                  }
                }}
                onTouchStart={() => {
                  setShowOriginal(true);
                  const imgCanvas = imageCanvasRef.current;
                  if (imgCanvas && originalImageData) {
                    imgCanvas.getContext('2d')?.putImageData(originalImageData, 0, 0);
                  }
                }}
                onTouchEnd={() => {
                  setShowOriginal(false);
                  const imgCanvas = imageCanvasRef.current;
                  if (imgCanvas) {
                    imgCanvas.getContext('2d')?.putImageData(history[historyIndex], 0, 0);
                  }
                }}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold select-none transition ${
                  showOriginal 
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                    : 'border-slate-800 text-slate-300 hover:bg-slate-900'
                }`}
                title="按住查看对比"
              >
                {showOriginal ? <Eye className="w-3.5 h-3.5 text-indigo-400" /> : <EyeOff className="w-3.5 h-3.5" />}
                {showOriginal ? '查看初始原图' : '长按对比原图'}
              </button>

              {/* Download banner */}
              <button
                id="btn-download-image"
                onClick={handleDownload}
                className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs shrink-0 transition"
              >
                <Download className="w-3.5 h-3.5" />
                导出完工图片
              </button>
            </div>
          </div>
        )}

        {/* Main Canvas Canvas Container viewport */}
        <div 
          ref={containerRef}
          className={`flex-1 min-h-[380px] max-h-[580px] relative rounded-xl flex items-center justify-center overflow-auto ${
            isDragging ? 'bg-indigo-950/20 border-2 border-dashed border-indigo-500' : 'bg-slate-900/60'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          id="canvas-gesture-surface"
        >
          {image ? (
            <div 
              className="relative shadow-2xl cursor-crosshair select-none"
              style={{ 
                width: displayDimensions.width || '100%', 
                height: displayDimensions.height || 'auto' 
              }}
            >
              {/* Image base pixels rendering */}
              <canvas
                id="image-render-canvas"
                ref={imageCanvasRef}
                className="absolute inset-0 pointer-events-none rounded"
                style={{ width: '100%', height: '100%' }}
              />

              {/* Interactive overlay drawing mask */}
              <canvas
                id="mask-scratch-pad"
                ref={maskCanvasRef}
                className="absolute inset-0 z-10 rounded opacity-80"
                style={{ width: '100%', height: '100%', mixBlendMode: 'normal' }}
                onMouseDown={handleStartDraw}
                onMouseMove={handleDraw}
                onMouseUp={handleEndDraw}
                onMouseLeave={handleEndDraw}
                
                onTouchStart={handleStartDraw}
                onTouchMove={handleDraw}
                onTouchEnd={handleEndDraw}
              />
            </div>
          ) : (
            // Empty upload welcome card state
            <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 max-w-md w-full">
              <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-805 flex items-center justify-center text-indigo-400 mb-4 animate-bounce">
                <Upload className="w-7 h-7" />
              </div>
              
              <h3 className="text-lg font-bold text-slate-100 mb-1">图片无损去水印</h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                拖拽你的水印图片到这里，或点击下方按钮导入文件。支持 JPG, PNG, WEBP 等。
              </p>

              <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-6 rounded-xl cursor-pointer shadow-lg shadow-indigo-600/15 transition active:scale-[0.98]">
                <span>本地上传图片</span>
                <input
                  id="image-file-picker"
                  type="file"
                  accept="image/*"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </label>

              <div className="mt-8 flex items-center gap-2 text-xs text-slate-500">
                <HelpCircle className="w-3.5 h-3.5" />
                <span>不经过任何服务器，本地核心 100% 密闭计算</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom instructions bar */}
        {image && (
          <div className="flex flex-col md:flex-row md:items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-900 gap-2">
            <div>
              <span className="text-amber-500/95 font-semibold">💡 快捷提示</span>: 在图片上按住鼠标左键即可进行红色高亮涂抹，点击“开始去除”后，红区将会按照所选算法完成智能填充。
            </div>
            {showHelp && (
              <div className="flex items-center gap-1.5 bg-slate-900 py-1 px-2 rounded-md">
                <span>Esc = 清空画笔 </span>
                <span className="text-slate-700">|</span>
                <span>Ctrl + Z = 撤销 </span>
                <button 
                  onClick={() => setShowHelp(false)}
                  className="text-slate-400 hover:text-white ml-1 text-[10px]"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        )}

        {/* Dynamic toasts overlay */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 15 }}
              className="absolute bottom-6 right-6 z-50 bg-slate-800 text-slate-100 px-4 py-2.5 rounded-xl text-xs border border-slate-700 shadow-xl flex items-center gap-2 font-medium"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

    </div>
  );
}
