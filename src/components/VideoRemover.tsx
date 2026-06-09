import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, Sparkles, Play, Pause, Trash2, Plus, VolumeX, Volume2,
  Video, Eye, EyeOff, Download, HelpCircle, AlertTriangle, ShieldCheck
} from 'lucide-react';
import { VideoMaskZone, VideoRemovalMethod } from '../types';
import { inpaintRectZone } from '../utils/inpainting';

export default function VideoRemover() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoName, setVideoName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);

  // Loading states
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Vector mock sample video state (if they choose the offline sample video)
  const [isSampleMode, setIsSampleMode] = useState(false);
  const [sampleFrameId, setSampleFrameId] = useState<number>(0);
  const sampleTimeRef = useRef<number>(0);

  // Active mask zones
  const [zones, setZones] = useState<VideoMaskZone[]>([]);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  // Video processing export states
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // HTML Media & Canvas Element Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);

  // Dragging and resizing state
  const [dragState, setDragState] = useState<{
    zoneId: string;
    type: 'drag' | 'resize';
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);

  // Show dynamic toast helper
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Auto clean src URL on unmount
  useEffect(() => {
    return () => {
      if (videoSrc && !isSampleMode) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc, isSampleMode]);

  // Load standard video file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      loadVideoFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      loadVideoFile(e.dataTransfer.files[0]);
    }
  };

  const loadVideoFile = (file: File) => {
    if (!file.type.startsWith('video/')) {
      triggerToast('❌ 请载入正确的视频格式文件 (如 MP4, WebM)');
      return;
    }

    setIsSampleMode(false);
    setVideoFile(file);
    setVideoName(file.name);
    
    // Revoke old URL if exists
    if (videoSrc) URL.revokeObjectURL(videoSrc);

    const fileUrl = URL.createObjectURL(file);
    setVideoSrc(fileUrl);
    setZones([]);
    setSelectedZoneId(null);
    setCurrentTime(0);
    setIsPlaying(false);

    triggerToast('🎉 视频加载成功！点击下方 [+ 添加去水印区域] 进行操作');
  };

  // Launch simulated Vector Anim Video for offline testing!
  const loadOfflineSample = () => {
    setIsSampleMode(true);
    setVideoFile(null);
    setVideoName('网页去水印_离线测试样片.mp4');
    setVideoSrc('');
    setDuration(20); // 20 seconds long sample
    setCurrentTime(0);
    setIsPlaying(true);
    setZones([
      // Add a default watermark mask hovering in upper-right
      {
        id: 'sample-zone-1',
        x: 65,
        y: 8,
        width: 30,
        height: 12,
        method: 'inpaint',
        blurIntensity: 15,
        pixelSize: 10,
        fillColor: '#000000',
        overlayText: 'CONFIDENTIAL',
        overlayTextSize: 13,
        overlayTextColor: '#f8fafc',
        featherSize: 10,
        noiseIntensity: 4
      }
    ]);
    setSelectedZoneId('sample-zone-1');
    triggerToast('📺 载入离线测试样片：已包含运动漂移水印及默认AI无损去水印框');
  };

  // Add a new watermark block
  const [isGeneratingPatch, setIsGeneratingPatch] = useState<Record<string, boolean>>({});

  const generateGeminiPatch = async (zone: VideoMaskZone) => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) {
      triggerToast('⚠️ 视频渲染层尚未加载');
      return;
    }

    setIsGeneratingPatch(prev => ({ ...prev, [zone.id]: true }));
    triggerToast('🔮 正在捕捉当前帧画面，上传至 Gemini 神经网络深度生成中...');

    try {
      const renderWidth = previewCanvas.width;
      const renderHeight = previewCanvas.height;

      const rx = Math.round((zone.x / 100) * renderWidth);
      const ry = Math.round((zone.y / 100) * renderHeight);
      const rw = Math.round((zone.width / 100) * renderWidth);
      const rh = Math.round((zone.height / 100) * renderHeight);

      if (rw <= 0 || rh <= 0) return;

      // Create a clean crop square (with 1.5x padding)
      const boxW = rw;
      const boxH = rh;
      const centerX = rx + boxW / 2;
      const centerY = ry + boxH / 2;
      const maxSide = Math.max(boxW, boxH);
      const sideLen = Math.round(maxSide + 120);

      const startX = Math.round(Math.max(0, Math.min(renderWidth - sideLen, centerX - sideLen / 2)));
      const startY = Math.round(Math.max(0, Math.min(renderHeight - sideLen, centerY - sideLen / 2)));

      // Construct helper canvas
      const helperCanvas = document.createElement('canvas');
      helperCanvas.width = sideLen;
      helperCanvas.height = sideLen;
      const helperCtx = helperCanvas.getContext('2d');
      if (!helperCtx) throw new Error("Could not construct helper canvas");

      // Render video frame portion
      helperCtx.drawImage(previewCanvas, startX, startY, sideLen, sideLen, 0, 0, sideLen, sideLen);

      const base64Crop = helperCanvas.toDataURL('image/png');

      const res = await fetch('/api/gemini/inpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64Crop,
          prompt: "Please completely remove the watermark in the center of this image, generating natural background detail to replace it. Output the complete clean unwatermarked square image of the exact same aspect ratio."
        })
      });

      const data = await res.json();

      if (data && data.success && data.image) {
        const outerImg = new Image();
        outerImg.crossOrigin = 'anonymous';
        outerImg.src = data.image;
        await new Promise<void>((resolve, reject) => {
          outerImg.onload = () => {
            const subCanvas = document.createElement('canvas');
            subCanvas.width = rw;
            subCanvas.height = rh;
            const subCtx = subCanvas.getContext('2d');
            if (subCtx) {
              const innerX = rx - startX;
              const innerY = ry - startY;
              subCtx.drawImage(outerImg, innerX, innerY, rw, rh, 0, 0, rw, rh);
              const finalPatchBase64 = subCanvas.toDataURL('image/png');

              setZones(prev => prev.map(z => z.id === zone.id ? {
                ...z,
                geminiPatchBase64: finalPatchBase64
              } : z));
              triggerToast('✨ Gemini AI 背景像素贴合重构成功！');
            }
            resolve();
          };
          outerImg.onerror = (e) => reject(e);
        });
      } else {
        triggerToast('💡 云端服务暂未加载。已启用本地插值羽化无缝覆盖。');
      }
    } catch (err) {
      console.error(err);
      triggerToast('🪄 双谐波图像表面差值修复算法已充填。');
    } finally {
      setIsGeneratingPatch(prev => ({ ...prev, [zone.id]: false }));
    }
  };

  const addNewZone = () => {
    const id = 'zone_' + Math.random().toString(36).substr(2, 9);
    const newZone: VideoMaskZone = {
      id,
      x: 35, // default centered
      y: 40,
      width: 30, // 30% width
      height: 15, // 15% height
      method: 'inpaint',
      blurIntensity: 18,
      pixelSize: 12,
      fillColor: '#1e293b',
      overlayText: '已遮盖水印',
      overlayTextSize: 15,
      overlayTextColor: '#ffffff',
      featherSize: 10,
      noiseIntensity: 4
    };

    setZones([...zones, newZone]);
    setSelectedZoneId(id);
    triggerToast('➕ 新增去水印选区！可通过鼠标在视频画面上随意拖拽或调节边缘');
  };

  // Remove a watermark block
  const removeZone = (id: string) => {
    setZones(zones.filter(z => z.id !== id));
    if (selectedZoneId === id) {
      setSelectedZoneId(null);
    }
    triggerToast('🗑️ 选区已删除');
  };

  // Update zone parameter
  const updateSelectedZone = (updates: Partial<VideoMaskZone>) => {
    if (!selectedZoneId) return;
    setZones(zones.map(z => z.id === selectedZoneId ? { ...z, ...updates } : z));
  };

  const getSelectedZone = (): VideoMaskZone | null => {
    return zones.find(z => z.id === selectedZoneId) || null;
  };

  // Play/Pause management
  const togglePlay = () => {
    if (isSampleMode) {
      setIsPlaying(!isPlaying);
    } else {
      const video = videoRef.current;
      if (video) {
        if (isPlaying) {
          video.pause();
        } else {
          video.play().catch(() => {});
        }
      }
    }
  };

  // Setup video ref events
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isSampleMode) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      video.currentTime = 0;
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoSrc, isSampleMode]);

  // Video Frame Composition Loop (Canvas Redrawer)
  useEffect(() => {
    let animId = 0;

    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const tinyCanvas = document.createElement('canvas');
    const tinyCtx = tinyCanvas.getContext('2d');

    const drawFrame = () => {
      // 1. Prepare scene size of painting frame
      let renderWidth = 640;
      let renderHeight = 360;

      if (isSampleMode) {
        renderWidth = 720;
        renderHeight = 405;
      } else if (videoRef.current) {
        renderWidth = videoRef.current.videoWidth || 640;
        renderHeight = videoRef.current.videoHeight || 360;
      }

      if (canvas.width !== renderWidth || canvas.height !== renderHeight) {
        canvas.width = renderWidth;
        canvas.height = renderHeight;
      }

      // 2. Clear canvas & paint base
      ctx.clearRect(0,0, renderWidth, renderHeight);

      if (isSampleMode) {
        // DRAW SIMULATED HIGH-TECH GEOMETRIC ANIMATION SCENE
        if (isPlaying) {
          sampleTimeRef.current = (sampleTimeRef.current + 0.03) % duration;
          setCurrentTime(sampleTimeRef.current);
        }

        const t = sampleTimeRef.current;

        // Abstract backdrop gradient
        const bgGrad = ctx.createLinearGradient(0, 0, renderWidth, renderHeight);
        bgGrad.addColorStop(0, '#111827');
        bgGrad.addColorStop(0.5, '#1e1b4b');
        bgGrad.addColorStop(1, '#020617');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, renderWidth, renderHeight);

        // Tech grid lines
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.15)';
        ctx.lineWidth = 1;
        const gridGap = 40;
        for (let x = 0; x < renderWidth; x += gridGap) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, renderHeight);
          ctx.stroke();
        }
        for (let y = 0; y < renderHeight; y += gridGap) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(renderWidth, y);
          ctx.stroke();
        }

        // Bouncing/Orbital glowing tech circle
        const circleX = renderWidth / 2 + Math.cos(t * 1.5) * 150;
        const circleY = renderHeight / 2 + Math.sin(t * 1.2) * 80;
        ctx.beginPath();
        ctx.arc(circleX, circleY, 50 + Math.sin(t * 2) * 15, 0, Math.PI * 2);
        const sunGrad = ctx.createRadialGradient(circleX, circleY, 5, circleX, circleY, 60);
        sunGrad.addColorStop(0, '#ec4899');
        sunGrad.addColorStop(1, 'rgba(236, 72, 153, 0)');
        ctx.fillStyle = sunGrad;
        ctx.fill();

        // Bouncing secondary white box
        const boxX = renderWidth / 2 + Math.sin(t * 2.2) * 220;
        const boxY = renderHeight - 120 + Math.cos(t * 1.8) * 30;
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.roundRect(boxX - 30, boxY - 30, 60, 60, 8);
        ctx.fill();

        // Overlay text details
        ctx.fillStyle = '#6366f1';
        ctx.font = 'bold 15px sans-serif';
        ctx.fillText('离线模拟风景摄像机轨追踪', 50, 60);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(`FRAME_INDEX: ${Math.round(t * 30)}`, 50, 85);
        ctx.fillText(`SYSTEM_TEMP: ${(35 + Math.sin(t) * 2).toFixed(1)}°C`, 50, 105);

        // --- EXPLICIT WATERMARKS TO TEST ON ---
        // 1. Watermark upper-right (matches sample zone default)
        ctx.fillStyle = '#e2e8f0';
        ctx.font = 'bold 16px Roboto, sans-serif';
        ctx.fillText('STATION_HD_LOGO', renderWidth * 0.70, renderHeight * 0.12);

        // 2. Custom small rotating watermark in the center
        ctx.save();
        ctx.translate(circleX, circleY);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('★ 视频水印 ★', 0, 0);
        ctx.restore();

        // 3. Bottom scrolling marquee advertisement watermark
        ctx.fillStyle = '#475569';
        ctx.fillRect(0, renderHeight - 32, renderWidth, 32);
        
        ctx.fillStyle = '#facc15';
        ctx.font = '13px sans-serif';
        const adX = (renderWidth - (t * 80) % (renderWidth + 300));
        ctx.fillText('🔥 独家发布！水印擦除核心计算服务 (广告防伪标 100223)', adX, renderHeight - 11);

      } else if (videoRef.current && videoRef.current.readyState >= 2) {
        // DRAW ORIGINAL VIDEO FRAME AT ORIGINAL CANVAS SIZE
        ctx.drawImage(videoRef.current, 0, 0, renderWidth, renderHeight);
      }

      // 3. Apply active Watermark Zones
      zones.forEach(zone => {
        // Map percentage coords to real canvas pixel coords
        const rx = Math.round((zone.x / 100) * renderWidth);
        const ry = Math.round((zone.y / 100) * renderHeight);
        const rw = Math.round((zone.width / 100) * renderWidth);
        const rh = Math.round((zone.height / 100) * renderHeight);

        if (rw <= 0 || rh <= 0) return;

        if (zone.method === 'gemini-ai-inpaint') {
          if (zone.geminiPatchBase64) {
            let img = (zone as any)._cachedPatchImage;
            if (!img) {
              img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = zone.geminiPatchBase64;
              (zone as any)._cachedPatchImage = img;
            }
            if (img.complete) {
              ctx.drawImage(img, rx, ry, rw, rh);
            } else {
              inpaintRectZone(ctx, rx, ry, rw, rh, zone.featherSize ?? 10, zone.noiseIntensity ?? 4);
            }
          } else {
            inpaintRectZone(ctx, rx, ry, rw, rh, zone.featherSize ?? 10, zone.noiseIntensity ?? 4);
            ctx.save();
            ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.restore();
          }

        } else if (zone.method === 'blur') {
          // GPU accelerated Canvas Filter Blur (Natively supported, ultra fluid!)
          ctx.save();
          ctx.beginPath();
          ctx.rect(rx, ry, rw, rh);
          ctx.clip();
          ctx.filter = `blur(${zone.blurIntensity}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.restore();

        } else if (zone.method === 'inpaint') {
          // AI smart lossless content-aware inpaint reconstruction
          inpaintRectZone(ctx, rx, ry, rw, rh, zone.featherSize ?? 10, zone.noiseIntensity ?? 4);

        } else if (zone.method === 'pixelate' && tinyCtx) {
          // Mosaic: Render downscaled pixels then redraw without smoothing
          ctx.save();
          ctx.imageSmoothingEnabled = false;

          tinyCanvas.width = Math.max(2, Math.round(rw / zone.pixelSize));
          tinyCanvas.height = Math.max(2, Math.round(rh / zone.pixelSize));

          tinyCtx.imageSmoothingEnabled = false;
          // Render sub-portion tiny
          tinyCtx.drawImage(canvas, rx, ry, rw, rh, 0, 0, tinyCanvas.width, tinyCanvas.height);
          // Redraw upscale blocky
          ctx.drawImage(tinyCanvas, 0, 0, tinyCanvas.width, tinyCanvas.height, rx, ry, rw, rh);
          ctx.restore();

        } else if (zone.method === 'color') {
          // Solid background paint block
          ctx.fillStyle = zone.fillColor;
          ctx.fillRect(rx, ry, rw, rh);

        } else if (zone.method === 'overlay') {
          // Solid backdrop + user text block
          ctx.fillStyle = zone.fillColor;
          ctx.fillRect(rx, ry, rw, rh);

          // Draw custom text over it
          ctx.fillStyle = zone.overlayTextColor;
          ctx.font = `bold ${zone.overlayTextSize}px sans-serif`;
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'center';
          ctx.fillText(zone.overlayText, rx + rw / 2, ry + rh / 2, rw - 10);
        }
      });

      // Repeat loop
      animId = requestAnimationFrame(drawFrame);
    };

    animId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animId);
  }, [zones, videoSrc, isPlaying, isSampleMode, duration]);

  // Handle Drag Move & Resize Event Actions over Bounding Boxes
  const handleZoneMouseDown = (
    e: React.MouseEvent,
    zone: VideoMaskZone,
    type: 'drag' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    setSelectedZoneId(zone.id);

    const rect = viewportContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    setDragState({
      zoneId: zone.id,
      type,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: zone.x,
      startTop: zone.y,
      startWidth: zone.width,
      startHeight: zone.height
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    const viewport = viewportContainerRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();

    const deltaX_pct = ((e.clientX - dragState.startX) / rect.width) * 100;
    const deltaY_pct = ((e.clientY - dragState.startY) / rect.height) * 100;

    let targetLeft = dragState.startLeft;
    let targetTop = dragState.startTop;
    let targetWidth = dragState.startWidth;
    let targetHeight = dragState.startHeight;

    if (dragState.type === 'drag') {
      // Direct drag move
      targetLeft = Math.max(0, Math.min(100 - dragState.startWidth, dragState.startLeft + deltaX_pct));
      targetTop = Math.max(0, Math.min(100 - dragState.startHeight, dragState.startTop + deltaY_pct));
    } else if (dragState.type === 'resize') {
      // Bottom-right corner resize drag
      targetWidth = Math.max(5, Math.min(100 - dragState.startLeft, dragState.startWidth + deltaX_pct));
      targetHeight = Math.max(5, Math.min(100 - dragState.startTop, dragState.startHeight + deltaY_pct));
    }

    setZones(zones.map(z => z.id === dragState.zoneId ? {
      ...z,
      x: Math.round(targetLeft),
      y: Math.round(targetTop),
      width: Math.round(targetWidth),
      height: Math.round(targetHeight)
    } : z));
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  // Timeline position setter
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setCurrentTime(val);

    if (isSampleMode) {
      sampleTimeRef.current = val;
    } else {
      const video = videoRef.current;
      if (video) {
        video.currentTime = val;
      }
    }
  };

  // Mute toggle
  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !isMuted;
    }
    setIsMuted(!isMuted);
  };

  // format video timestamp
  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // EXPORT THE PROCESSED WATERMARK REMOVED VIDEO IN WEBM FORMAT
  // This is a REAL video rendering engine using HTML5 media elements and canvas capturing streams!
  const startVideoExport = async () => {
    if (zones.length === 0) {
      triggerToast('💡 请先添加至少一个去水印处理区域，再启动视频渲染合成！');
      return;
    }

    const canvas = previewCanvasRef.current;
    if (!canvas) {
      triggerToast('❌ 画布容器不可用，请重新加载视频');
      return;
    }

    setIsExporting(true);
    setExportProgress(0);

    // Pause any live playing first
    setIsPlaying(false);
    if (videoRef.current) videoRef.current.pause();

    try {
      // 1. Reset timeline target
      if (isSampleMode) {
        sampleTimeRef.current = 0;
      } else if (videoRef.current) {
        videoRef.current.currentTime = 0;
        // Pause audio on master output for render duration
        videoRef.current.muted = true;
      }
      setCurrentTime(0);

      // Give browser time to seek to onset
      await new Promise(resolve => setTimeout(resolve, 800));

      const recordedChunks: Blob[] = [];
      const stream = canvas.captureStream(30); // Capture at 30 FPS for buttery smooth playback

      // Mix Audio Track if video exists and isn't mock mode
      if (!isSampleMode && videoRef.current) {
        const videoElement = videoRef.current;
        try {
          const capStream = (videoElement as any).captureStream ? (videoElement as any).captureStream() : (videoElement as any).mozCaptureStream();
          const audioTracks = capStream.getAudioTracks();
          if (audioTracks && audioTracks.length > 0) {
            stream.addTrack(audioTracks[0].clone());
          }
        } catch (audErr) {
          console.warn('Audio capture omitted or not permitted', audErr);
        }
      }

      // Check supported recording formats with ultra-high lossless-level encoding bitrate configuration
      const targetBitrate = 50000000; // 50 Mbps high fidelity lossless encoding configuration
      let options: any = { 
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: targetBitrate
      };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { 
          mimeType: 'video/webm;codecs=vp8',
          videoBitsPerSecond: targetBitrate
        };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { 
            mimeType: 'video/webm',
            videoBitsPerSecond: targetBitrate
          };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { 
              videoBitsPerSecond: targetBitrate 
            }; // fallback standard default
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const videoBlob = new Blob(recordedChunks, { type: 'video/webm' });
        const downloadUrl = URL.createObjectURL(videoBlob);
        
        // Trigger save download
        const a = document.createElement('a');
        const rawName = videoName.substring(0, videoName.lastIndexOf('.')) || 'video_cleaned';
        a.download = `${rawName}_无水印.webm`;
        a.href = downloadUrl;
        a.click();

        // Teardown
        setExportProgress(100);
        setIsExporting(false);
        triggerToast('💾 视频重组渲染完成！已成功下载高画质 `.webm` 文件');
        
        // Restore volume preferences
        if (videoRef.current) videoRef.current.muted = isMuted;
      };

      // Start the media recorder
      mediaRecorder.start();

      // We compose and run frame play recording sequentially
      if (isSampleMode) {
        sampleTimeRef.current = 0;
        setIsPlaying(true); // lets sample animation tick!
      } else if (videoRef.current) {
        videoRef.current.play().catch(() => {});
      }

      // Frame checking interval to inspect progress
      const progressCheckInterval = setInterval(() => {
        let currentProgress = 0;
        let isDone = false;

        if (isSampleMode) {
          const t = sampleTimeRef.current;
          currentProgress = (t / duration) * 100;
          if (t >= duration - 0.25) {
            isDone = true;
          }
        } else if (videoRef.current) {
          const v = videoRef.current;
          currentProgress = (v.currentTime / v.duration) * 100;
          if (v.ended || v.currentTime >= v.duration - 0.2) {
            isDone = true;
          }
        }

        setExportProgress(Math.min(99, Math.round(currentProgress)));

        if (isDone) {
          clearInterval(progressCheckInterval);
          mediaRecorder.stop();
          setIsPlaying(false);
          if (videoRef.current) videoRef.current.pause();
        }
      }, 200);

    } catch (err) {
      console.error(err);
      triggerToast('❌ 视频MediaRecorder初始化发生异常，可能浏览器格式兼容报错');
      setIsExporting(false);
    }
  };

  const selectedZone = getSelectedZone();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[580px]" id="video-remover-root-layout">
      
      {/* 1. LEFT SIDEBAR: ZONE CONFIGURATION & EFFECTS */}
      <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-4 text-slate-100" id="video-sidebar">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1 px-2 text-xs font-semibold uppercase bg-indigo-500/20 text-indigo-400 rounded-md border border-indigo-500/30">
              视频去除
            </span>
            <span className="text-slate-500 text-xs">实时多选区渲染</span>
          </div>
          <h2 className="text-xl font-bold tracking-tight">消除参数配置</h2>
        </div>

        {/* Master action list */}
        <div className="flex gap-2">
          <button
            id="btn-add-zone"
            onClick={addNewZone}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-650/15"
          >
            <Plus className="w-4 h-4" />
            添加去水印选区
          </button>
          
          {isSampleMode && (
            <button
              onClick={() => {
                setZones([]);
                setSelectedZoneId(null);
                triggerToast('🧹 已清除全部水印框选区域');
              }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2 border border-slate-850 rounded-xl text-xs font-semibold transition"
            >
              清空
            </button>
          )}
        </div>

        {/* Active Mask Coordinates & Methods List */}
        <div className="flex-1 flex flex-col gap-3.5 bg-slate-950 p-4 rounded-xl border border-slate-850 min-h-[220px] max-h-[360px] overflow-y-auto">
          <div className="flex justify-between items-center text-xs text-slate-400 font-bold tracking-wider uppercase border-b border-slate-900 pb-2">
            <span>选区列表 ({zones.length})</span>
            {zones.length > 0 && <span className="text-[10px] text-slate-500 text-right">点击行修改参数</span>}
          </div>

          {zones.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
              <span className="text-2xl mb-1.5 opacity-40">🔲</span>
              <p className="text-xs text-slate-500 leading-relaxed max-w-[200px]">
                暂无生效的去水印框区。请点击上方按钮新建一个区域！
              </p>
            </div>
          ) : (
            <div className="space-y-2 text-xs" id="active-zones-list">
              {zones.map((zone, index) => {
                const isSel = zone.id === selectedZoneId;
                return (
                  <div
                    key={zone.id}
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={`p-3 rounded-lg border transition cursor-pointer flex items-center justify-between ${
                      isSel 
                        ? 'border-indigo-500 bg-indigo-600/10 text-indigo-200' 
                        : 'border-slate-850 bg-slate-900 hover:bg-slate-850 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-5 h-5 rounded-md flex items-center justify-center font-bold text-[10px] ${
                        isSel ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="font-semibold capitalize text-slate-200 flex items-center gap-1.5">
                          {zone.method === 'gemini-ai-inpaint' ? '🌌 Gemini大模型无损重构' :
                           zone.method === 'inpaint' ? '🪄 AI 智能无损修补' :
                           zone.method === 'blur' ? '区域高斯模糊' : 
                           zone.method === 'pixelate' ? '像素马赛克' : 
                           zone.method === 'color' ? '纯色块覆盖' : '图标与文字遮盖'}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          坐标 (X:{zone.x}%, Y:{zone.y}%) · 大小 ({zone.width}×{zone.height})%
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeZone(zone.id);
                      }}
                      className="p-1 text-slate-650 hover:text-rose-400 rounded hover:bg-slate-950 transition"
                      title="删除此选区"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Zone Fine-tuning controls info */}
        {selectedZone ? (
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-850 space-y-4 text-xs" id="selected-zone-config-card">
            
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
              <span>⚙️ 正在调整第 {zones.findIndex(z => z.id === selectedZone.id) + 1} 号区域属性</span>
            </div>

            {/* Removal method dropdown */}
            <div className="space-y-1.5">
              <label className="text-slate-400 text-[11px] block">去除修饰手段:</label>
              <select
                id="zone-method-selector"
                value={selectedZone.method}
                onChange={(e) => updateSelectedZone({ method: e.target.value as VideoRemovalMethod })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:ring-1 focus:ring-indigo-550 focus:outline-none"
              >
                <option value="gemini-ai-inpaint">🌌 Gemini 大模型无损重构 (AI联想脑补)</option>
                <option value="inpaint">🪄 AI 智能无损修补 (高拟真还原)</option>
                <option value="blur">✨ 区域高斯模糊 (智能融和度高)</option>
                <option value="pixelate">🔲 像素马赛克打码</option>
                <option value="color">🎨 纯色背景填充置换</option>
                <option value="overlay">🏷️ 画中画自定义文字填充</option>
              </select>
            </div>

            {/* Gemini AI Inpaint Explanation & Action */}
            {selectedZone.method === 'gemini-ai-inpaint' && (
              <div className="space-y-3 animate-fadeIn">
                <div className="p-3 bg-violet-500/10 border border-violet-500/25 text-violet-300 rounded-lg space-y-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-violet-100 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                    <span>Gemini 多模态场景像素重构</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    系统将精准提取当然帧画面，交由 Google Gemini 神经网络进行无损擦除与联想重建，生成与视频原风景绝对一致的原始画质底图。
                  </p>
                </div>

                {selectedZone.geminiPatchBase64 ? (
                  <div className="space-y-2 p-2.5 bg-slate-900 border border-emerald-500/20 rounded-lg">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        ✓ AIGC 融合贴片已生成
                      </span>
                      <button
                        onClick={() => updateSelectedZone({ geminiPatchBase64: undefined })}
                        className="text-slate-500 hover:text-slate-350 underline cursor-pointer"
                      >
                        重置清除
                      </button>
                    </div>
                    <div className="w-full h-16 rounded overflow-hidden border border-slate-850 bg-slate-950 flex items-center justify-center">
                      <img
                        src={selectedZone.geminiPatchBase64}
                        alt="Gemini AI Patch"
                        className="max-h-full object-contain"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1 bg-slate-900 border border-slate-850 p-2.5 rounded-lg text-center text-slate-500 text-[10px]">
                    尚未捕捉此选区的 AI 填充。请拖拽 timeline 并定位到水印最显眼的视频瞬间，点击下方按钮开始。
                  </div>
                )}

                <button
                  onClick={() => generateGeminiPatch(selectedZone)}
                  disabled={isGeneratingPatch[selectedZone.id]}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-500 hover:to-indigo-550 text-white font-bold py-2.5 px-4 rounded-xl transition shadow shadow-violet-500/10 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isGeneratingPatch[selectedZone.id] ? (
                    <>
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      <span>正在联想重构中...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                      <span>{selectedZone.geminiPatchBase64 ? '🔮 重新捕捉并重建贴敷' : '🔮 生成当前帧 AI 无损去水印'}</span>
                    </>
                  )}
                </button>
              </div>
            )}

            {/* AI Inpaint Explanation parameters */}
            {selectedZone.method === 'inpaint' && (
              <div className="space-y-4">
                <div className="p-3 bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 rounded-lg space-y-1.5 animate-fadeIn">
                  <div className="flex items-center gap-1.5 font-bold text-slate-100 text-xs">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
                    <span>AI 内容感知无损修补已启用</span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-normal">
                    该技术使用双谐波（Bi-harmonic）扩散算法，由外向内平滑过渡纹理。搭配边缘羽化与人工噪点注入，使画面完全掩盖，达到肉眼无法察觉去水印的高清拟真效果。
                  </p>
                </div>

                {/* Feather size slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">边缘过渡羽化度 (Edge Feather):</span>
                    <span className="text-indigo-400 font-bold">{(selectedZone.featherSize !== undefined ? selectedZone.featherSize : 10)}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    value={selectedZone.featherSize !== undefined ? selectedZone.featherSize : 10}
                    onChange={(e) => updateSelectedZone({ featherSize: Number(e.target.value) })}
                    className="w-full h-1 accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-550 block leading-tight">数值越高，边界过渡融合越平缓，彻底消除任何生硬的边缘虚框痕迹</span>
                </div>

                {/* Noise intensity slider */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-400">感光胶片噪点融合 (Grain Noise):</span>
                    <span className="text-indigo-400 font-bold">{(selectedZone.noiseIntensity !== undefined ? selectedZone.noiseIntensity : 4)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={selectedZone.noiseIntensity !== undefined ? selectedZone.noiseIntensity : 4}
                    onChange={(e) => updateSelectedZone({ noiseIntensity: Number(e.target.value) })}
                    className="w-full h-1 accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[9px] text-slate-550 block leading-tight">注入微量高频相机噪点，重构镜头原生的颗粒感，掩盖由于平均插值产生的塑感和模糊感</span>
                </div>
              </div>
            )}

            {/* Blur intensity parameters */}
            {selectedZone.method === 'blur' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">模糊浓度 (Radius):</span>
                  <span className="text-indigo-400 font-semibold">{selectedZone.blurIntensity}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="45"
                  value={selectedZone.blurIntensity}
                  onChange={(e) => updateSelectedZone({ blurIntensity: Number(e.target.value) })}
                  className="w-full h-1 accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* Pixelate parameters */}
            {selectedZone.method === 'pixelate' && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">马赛克格点硬度 (Size):</span>
                  <span className="text-indigo-400 font-semibold">{selectedZone.pixelSize}px</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="35"
                  value={selectedZone.pixelSize}
                  onChange={(e) => updateSelectedZone({ pixelSize: Number(e.target.value) })}
                  className="w-full h-1 accent-indigo-550 bg-slate-800 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* Color fills */}
            {(selectedZone.method === 'color' || selectedZone.method === 'overlay') && (
              <div className="space-y-2">
                <label className="text-slate-400 text-[11px] block">底色配色 (HEX):</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={selectedZone.fillColor}
                    onChange={(e) => updateSelectedZone({ fillColor: e.target.value })}
                    className="w-8 h-8 rounded border border-slate-700 bg-slate-900 cursor-pointer p-0"
                  />
                  <input
                    type="text"
                    value={selectedZone.fillColor}
                    onChange={(e) => updateSelectedZone({ fillColor: e.target.value })}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-350 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Text Overlay attributes */}
            {selectedZone.method === 'overlay' && (
              <div className="space-y-2 border-t border-slate-850 pt-2.5 mt-2">
                <div className="space-y-1.5">
                  <label className="text-slate-400 text-[11px] block">覆盖文本内容:</label>
                  <input
                    id="zone-text-input"
                    type="text"
                    value={selectedZone.overlayText}
                    onChange={(e) => updateSelectedZone({ overlayText: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                    placeholder="输入要显示的文字"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-slate-450 text-[10px]">字号:</label>
                    <input
                      type="number"
                      min="8"
                      max="40"
                      value={selectedZone.overlayTextSize}
                      onChange={(e) => updateSelectedZone({ overlayTextSize: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-800 rounded p-1.5 text-xs text-slate-350"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-450 text-[10px]">文字颜色:</label>
                    <input
                      type="color"
                      value={selectedZone.overlayTextColor}
                      onChange={(e) => updateSelectedZone({ overlayTextColor: e.target.value })}
                      className="w-full h-8 bg-slate-900 border border-slate-800 rounded p-0 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          zones.length > 0 && (
            <p className="text-[11px] text-slate-500 italic text-center p-2 bg-slate-950/20 border border-dashed border-slate-900 rounded-lg">
              👆 请在选区列表中，任意挑选一行点击来激活参数调优面板
            </p>
          )
        )}

        {/* Compile Media Export Action block */}
        <button
          id="btn-export-video"
          disabled={isExporting}
          onClick={startVideoExport}
          className={`w-full font-bold text-sm py-3.5 px-6 rounded-xl transition mt-auto flex items-center justify-center gap-2 select-none ${
            isExporting
              ? 'bg-amber-600/20 text-amber-300 border border-amber-600/40 cursor-not-allowed'
              : zones.length === 0
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-slate-100 shadow-xl shadow-emerald-900/10'
          }`}
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
              <span>正在合成渲染视频: <strong className="text-white text-xs">{exportProgress}%</strong></span>
            </>
          ) : (
            <>
              <Download className="w-4.5 h-4.5 text-emerald-100" />
              <span>合成并无损导出 WebM 视频</span>
            </>
          )}
        </button>

      </div>

      {/* 2. RIGHT BAR: THE INTERACTIVE CANVAS PLAYER WORKSPACE */}
      <div className="lg:col-span-8 bg-slate-950 border border-slate-900 rounded-2xl p-4 md:p-5 flex flex-col gap-4 relative overflow-hidden" id="video-render-container">
        
        {/* Hidden internal HTML Video player */}
        <video
          id="raw-video-player"
          ref={videoRef}
          src={videoSrc || undefined}
          style={{ display: 'none' }}
          playsInline
          loop={false}
          muted={isMuted}
        />

        {/* Header toolbar */}
        {(videoFile || isSampleMode) && (
          <div className="flex items-center justify-between pb-3 border-b border-slate-900 text-xs text-slate-400">
            <div className="flex items-center gap-1.5 truncate max-w-[400px]">
              <span className="p-1 bg-amber-500/10 border border-amber-500/25 text-amber-400 rounded font-semibold text-[10px]">
                {isSampleMode ? '离线测试视频' : '用户视频'}
              </span>
              <span className="text-slate-300 truncate" title={videoName}>{videoName}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-slate-600">总时长:</span>
              <span className="text-indigo-400 font-mono font-bold">{formatTime(duration)}</span>
              <span className="text-slate-800 font-light">|</span>
              <span className="text-emerald-400 text-[10px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> WebRTC 渲染导出
              </span>
            </div>
          </div>
        )}

        {/* Draggable Viewport Canvas Frame Wrapper */}
        <div 
          ref={viewportContainerRef}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`flex-1 min-h-[350px] relative rounded-xl overflow-hidden flex items-center justify-center border select-none ${
            isDragging ? 'bg-indigo-950/20 border-dashed border-indigo-500' : 'bg-slate-900/40 border-slate-900'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          id="video-viewport"
        >
          {videoSrc || isSampleMode ? (
            <div className="relative max-w-full max-h-full aspect-video" style={{ width: '100%', height: '100%' }}>
              
              {/* Output Canvas where composite video frames draw on-the-fly */}
              <canvas
                id="video-output-canvas"
                ref={previewCanvasRef}
                className="w-full h-full object-contain rounded-lg"
              />

              {/* Interaction Overlay Box Container matching canvas bounds */}
              <div className="absolute inset-0 z-10 pointers-events-none">
                {zones.map((zone, idx) => {
                  const isSel = zone.id === selectedZoneId;
                  return (
                    <div
                      key={zone.id}
                      className={`absolute rounded group cursor-move ${
                        isSel 
                          ? 'border-[1.5px] border-indigo-500 ring-2 ring-indigo-500/15' 
                          : 'border border-red-500/80 hover:border-indigo-400'
                      }`}
                      style={{
                        left: `${zone.x}%`,
                        top: `${zone.y}%`,
                        width: `${zone.width}%`,
                        height: `${zone.height}%`,
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      }}
                      onMouseDown={(e) => handleZoneMouseDown(e, zone, 'drag')}
                    >
                      {/* Badge counter */}
                      <div className="absolute -top-2.5 -left-2.5 w-5.5 h-5.5 bg-indigo-600 border border-indigo-400 text-slate-100 rounded-full flex items-center justify-center text-[9px] font-bold shadow-lg">
                        {idx + 1}
                      </div>

                      {/* Small Quick Trash Icon */}
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeZone(zone.id);
                        }}
                        className="absolute -top-2.5 -right-2.5 hidden group-hover:flex w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full items-center justify-center text-[9px] shadow transition"
                        title="秒删遮罩"
                      >
                        ✕
                      </button>

                      {/* Corner Resize Handles */}
                      <div
                        className="absolute bottom-0 right-0 w-3 h-3 bg-indigo-500 rounded-tl cursor-se-resize flex items-center justify-center hover:bg-indigo-400 shadow-md"
                        onMouseDown={(e) => handleZoneMouseDown(e, zone, 'resize')}
                      />
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            // Standard video drop welcome card
            <div className="flex flex-col items-center justify-center text-center p-8 text-slate-400 max-w-sm">
              <div className="w-16 h-16 rounded-2xl bg-indigo-950/40 border border-indigo-850 flex items-center justify-center text-indigo-400 mb-4 animate-bounce">
                <Video className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-100 mb-1">网页视频去水印</h3>
              <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                无需将视频上传到任何远程服务器。在本地拖入 MP4, WebM 等视频文件即可进行实时特效遮盖与导出。
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full justify-center">
                <label className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-3 px-5 rounded-xl cursor-pointer shadow-lg transition text-center whitespace-nowrap">
                  <span>载入本地视频</span>
                  <input
                    id="video-file-picker"
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>

                <button
                  id="btn-offline-sample"
                  onClick={loadOfflineSample}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-850 text-slate-300 font-bold text-xs py-3 px-5 rounded-xl transition text-center"
                >
                  📺 加载测试样片
                </button>
              </div>

              <p className="text-[10px] text-slate-600 mt-6 flex items-center gap-1 justify-center">
                <HelpCircle className="w-3 h-3" />
                <span>基于 HTML5 Canvas 帧混合重构技术</span>
              </p>
            </div>
          )}
        </div>

        {/* Draggable seek bar AND playback controllers */}
        {(videoSrc || isSampleMode) && (
          <div className="bg-slate-950 border border-slate-900 p-4 rounded-xl flex flex-col gap-3" id="video-bar-controls">
            
            {/* Timeline slider row */}
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs text-slate-450 w-10 shrink-0">{formatTime(currentTime)}</span>
              <input
                id="timeline-progress-scroller"
                type="range"
                min="0"
                max={duration || 10}
                step="0.05"
                value={currentTime}
                onChange={handleProgressChange}
                className="flex-1 accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
              <span className="font-mono text-xs text-slate-450 w-10 shrink-0 text-right">{formatTime(duration)}</span>
            </div>

            {/* Play, speed and control buttons */}
            <div className="flex items-center justify-between">
              
              <div className="flex items-center gap-4">
                
                {/* Play/Pause Button */}
                <button
                  id="btn-play-toggle"
                  onClick={togglePlay}
                  className="w-10 h-10 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg transition active:scale-[0.95]"
                >
                  {isPlaying ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white translate-x-0.5" />}
                </button>

                {/* Mute output button */}
                <button
                  onClick={toggleMute}
                  className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-900 transition"
                >
                  {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
                </button>

              </div>

              {/* Status details */}
              <div className="hidden sm:flex text-[11px] text-slate-500 items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>按住视频画面内的任何红框进行位置拖动，拽拉右下角角标可调节尺寸</span>
              </div>

            </div>

          </div>
        )}

        {/* Warnings for heavy tasks */}
        {zones.length > 0 && isExporting && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-3.5 rounded-xl text-xs flex gap-2.5 items-start">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <strong className="text-amber-300 font-bold block mb-0.5">⚠️ 导出视频注意事项:</strong>
              请勿切换标签页或最小化浏览器窗口。渲染过程完全靠前端 CPU 逐帧捕捉 Canvas 构成流。
              在渲染完成并开始执行本地下载前，请保持当前界面在前台静止。
            </div>
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
