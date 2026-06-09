/**
 * Lightweight, high-performance inpainting algorithm for web canvas.
 * Approximates border-propagation of neighbor pixel averages to reconstruct the masked area.
 */
export function inpaintCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  maskCanvas: HTMLCanvasElement
) {
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  // Get mask data (brush strokes on maskCanvas)
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) return;
  const maskData = maskCtx.getImageData(0, 0, width, height).data;

  // Create a grid of mask inclusion (true means needs inpainting)
  const isMask = new Uint8Array(width * height);
  let maskCount = 0;

  // Find bounding box to narrow down scan/remaining area
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  let hasMaskPixels = false;

  for (let i = 0; i < width * height; i++) {
    const alpha = maskData[i * 4 + 3];
    const red = maskData[i * 4];
    if (alpha > 30 || red > 30) {
      isMask[i] = 1; // Needs to be filled
      maskCount++;
      const x = i % width;
      const y = Math.floor(i / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      hasMaskPixels = true;
    } else {
      isMask[i] = 0; // Solid background
    }
  }

  if (maskCount === 0 || !hasMaskPixels) return;

  // Restrict slightly safely to avoid out-of-bounds neighbor lookups
  minX = Math.max(1, minX - 1);
  maxX = Math.min(width - 2, maxX + 1);
  minY = Math.max(1, minY - 1);
  maxY = Math.min(height - 2, maxY + 1);

  // Make a copy of original canvas data to read from
  const srcData = new Uint8ClampedArray(data);

  // Buffer state: 0 = unmasked/filled, 1 = masked(unfilled)
  const state = new Uint8Array(isMask); 

  let remaining = maskCount;
  let maxPasses = 150; // Cap to avoid endless loops
  let pass = 0;

  const dx = [0, 0, -1, 1, -1, 1, -1, 1];
  const dy = [-1, 1, 0, 0, -1, -1, 1, 1];

  // Find initial frontier pixels
  let frontier: number[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * width + x;
      if (state[idx] !== 1) continue;

      let isFrontier = false;
      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (state[ny * width + nx] === 0) {
            isFrontier = true;
            break;
          }
        }
      }
      if (isFrontier) {
        frontier.push(idx);
      }
    }
  }

  // Fast propagation BFS loop
  while (frontier.length > 0 && pass < maxPasses && remaining > 0) {
    const nextFrontierSet = new Set<number>();
    const toFillIndexes: number[] = [];
    const fillColors: [number, number, number][] = [];

    for (let i = 0; i < frontier.length; i++) {
      const idx = frontier[i];
      const y = Math.floor(idx / width);
      const x = idx % width;

      let sumR = 0, sumG = 0, sumB = 0;
      let weightSum = 0;

      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

        const nIdx = ny * width + nx;
        if (state[nIdx] === 0) {
          const pixelIdx = nIdx * 4;
          const distWeight = d < 4 ? 1.0 : 0.707;
          sumR += srcData[pixelIdx] * distWeight;
          sumG += srcData[pixelIdx + 1] * distWeight;
          sumB += srcData[pixelIdx + 2] * distWeight;
          weightSum += distWeight;
        }
      }

      if (weightSum > 0) {
        toFillIndexes.push(idx);
        fillColors.push([
          Math.round(sumR / weightSum),
          Math.round(sumG / weightSum),
          Math.round(sumB / weightSum)
        ]);
      }
    }

    if (toFillIndexes.length === 0) {
      break;
    }

    // Apply the filled pixels
    for (let i = 0; i < toFillIndexes.length; i++) {
      const idx = toFillIndexes[i];
      const color = fillColors[i];
      const pixelIdx = idx * 4;

      srcData[pixelIdx] = color[0];
      srcData[pixelIdx + 1] = color[1];
      srcData[pixelIdx + 2] = color[2];
      srcData[pixelIdx + 3] = 255;

      data[pixelIdx] = color[0];
      data[pixelIdx + 1] = color[1];
      data[pixelIdx + 2] = color[2];
      data[pixelIdx + 3] = 255;

      state[idx] = 0; // Mark valid
      remaining--;
    }

    // Find next border layer from neighbors
    for (let i = 0; i < toFillIndexes.length; i++) {
      const idx = toFillIndexes[i];
      const y = Math.floor(idx / width);
      const x = idx % width;

      for (let d = 0; d < 8; d++) {
        const nx = x + dx[d];
        const ny = y + dy[d];
        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          const nIdx = ny * width + nx;
          if (state[nIdx] === 1) {
            nextFrontierSet.add(nIdx);
          }
        }
      }
    }

    frontier = Array.from(nextFrontierSet);
    pass++;
  }

  // Directional blend for any remaining isolated core pixels (confined inside bounding box)
  if (remaining > 0) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const idx = y * width + x;
        if (state[idx] !== 1) continue;

        let rSum = 0, gSum = 0, bSum = 0, wSum = 0;

        // Search Up
        for (let step = 1; step < 15; step++) {
          const ny = y - step;
          if (ny < 0) break;
          const nIdx = ny * width + x;
          if (state[nIdx] === 0) {
            const weight = 1 / step;
            const pIdx = nIdx * 4;
            rSum += srcData[pIdx] * weight;
            gSum += srcData[pIdx + 1] * weight;
            bSum += srcData[pIdx + 2] * weight;
            wSum += weight;
            break;
          }
        }

        // Search Down
        for (let step = 1; step < 15; step++) {
          const ny = y + step;
          if (ny >= height) break;
          const nIdx = ny * width + x;
          if (state[nIdx] === 0) {
            const weight = 1 / step;
            const pIdx = nIdx * 4;
            rSum += srcData[pIdx] * weight;
            gSum += srcData[pIdx + 1] * weight;
            bSum += srcData[pIdx + 2] * weight;
            wSum += weight;
            break;
          }
        }

        // Search Left
        for (let step = 1; step < 15; step++) {
          const nx = x - step;
          if (nx < 0) break;
          const nIdx = y * width + nx;
          if (state[nIdx] === 0) {
            const weight = 1 / step;
            const pIdx = nIdx * 4;
            rSum += srcData[pIdx] * weight;
            gSum += srcData[pIdx + 1] * weight;
            bSum += srcData[pIdx + 2] * weight;
            wSum += weight;
            break;
          }
        }

        // Search Right
        for (let step = 1; step < 15; step++) {
          const nx = x + step;
          if (nx >= width) break;
          const nIdx = y * width + nx;
          if (state[nIdx] === 0) {
            const weight = 1 / step;
            const pIdx = nIdx * 4;
            rSum += srcData[pIdx] * weight;
            gSum += srcData[pIdx + 1] * weight;
            bSum += srcData[pIdx + 2] * weight;
            wSum += weight;
            break;
          }
        }

        if (wSum > 0) {
          const pixelIdx = idx * 4;
          data[pixelIdx] = Math.round(rSum / wSum);
          data[pixelIdx + 1] = Math.round(gSum / wSum);
          data[pixelIdx + 2] = Math.round(bSum / wSum);
          data[pixelIdx + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * High-performance 2D area inpainting for video frames.
 * Propagates colors from the boundaries of the selection rectangle inwards,
 * creating an AI-like lossless content-aware fill with customizable feathering and film grain.
 */
export function inpaintRectZone(
  ctx: CanvasRenderingContext2D,
  rx: number,
  ry: number,
  rw: number,
  rh: number,
  featherSize: number = 8,
  noiseIntensity: number = 4
): void {
  if (rw <= 0 || rh <= 0) return;
  const canvasWidth = ctx.canvas.width;
  const canvasHeight = ctx.canvas.height;
  
  // Constrain coordinates to canvas bounds
  const xStart = Math.max(0, rx);
  const yStart = Math.max(0, ry);
  const xEnd = Math.min(canvasWidth - 1, rx + rw);
  const yEnd = Math.min(canvasHeight - 1, ry + rh);
  
  const width = xEnd - xStart;
  const height = yEnd - yStart;
  if (width <= 0 || height <= 0) return;

  // Use a padding of 5 pixels around the mask to capture clean original textures/backgrounds
  const pad = 5;
  const sX = Math.max(0, xStart - pad);
  const sY = Math.max(0, yStart - pad);
  const eX = Math.min(canvasWidth, xEnd + pad);
  const eY = Math.min(canvasHeight, yEnd + pad);
  
  const w = eX - sX;
  const h = eY - sY;
  if (w <= 0 || h <= 0) return;

  const imgData = ctx.getImageData(sX, sY, w, h);
  const data = imgData.data;

  // Copy original pixel colors to inspect boundaries cleanly without feedback loop interference
  const original = new Uint8ClampedArray(data);

  // Mask bounds relative to the retrieved image sub-box coordinates
  const maskLeft = xStart - sX;
  const maskTop = yStart - sY;
  const maskRight = xEnd - sX;
  const maskBottom = yEnd - sY;

  // Function to gather smooth averaged background color further away from watermark text compression artifacts
  const getAveragedBoundaryColor = (baseX: number, baseY: number, stepX: number, stepY: number) => {
    let r = 0, g = 0, b = 0, weightTotal = 0;
    // Sample 3 levels deep in the specified directional direction
    for (let depth = 1; depth <= 3; depth++) {
      const cx = Math.max(0, Math.min(w - 1, baseX + stepX * depth));
      const cy = Math.max(0, Math.min(h - 1, baseY + stepY * depth));
      const idx = (cy * w + cx) * 4;
      const weight = 1 / depth; // Give higher weight to closer clean pixels
      r += original[idx] * weight;
      g += original[idx + 1] * weight;
      b += original[idx + 2] * weight;
      weightTotal += weight;
    }
    return [r / weightTotal, g / weightTotal, b / weightTotal];
  };

  // Precompute boundary colors to avoid redundant execution in inner loops! (Massive speedup)
  const colorsL: [number, number, number][] = [];
  const colorsR: [number, number, number][] = [];
  for (let y = maskTop; y < maskBottom; y++) {
    colorsL[y - maskTop] = getAveragedBoundaryColor(maskLeft - 1, y, -1, 0) as [number, number, number];
    colorsR[y - maskTop] = getAveragedBoundaryColor(maskRight, y, 1, 0) as [number, number, number];
  }

  const colorsT: [number, number, number][] = [];
  const colorsB: [number, number, number][] = [];
  for (let x = maskLeft; x < maskRight; x++) {
    colorsT[x - maskLeft] = getAveragedBoundaryColor(x, maskTop - 1, 0, -1) as [number, number, number];
    colorsB[x - maskLeft] = getAveragedBoundaryColor(x, maskBottom, 0, 1) as [number, number, number];
  }

  // Precompute distance weights map using the formula 1 / Math.pow(dist, 1.8) (Saves Math.pow computations)
  const wL_arr = new Float32Array(maskRight - maskLeft);
  const wR_arr = new Float32Array(maskRight - maskLeft);
  for (let x = maskLeft; x < maskRight; x++) {
    const dL = x - maskLeft + 1;
    const dR = maskRight - x;
    wL_arr[x - maskLeft] = 1 / Math.pow(dL, 1.8);
    wR_arr[x - maskLeft] = 1 / Math.pow(dR, 1.8);
  }

  const wT_arr = new Float32Array(maskBottom - maskTop);
  const wB_arr = new Float32Array(maskBottom - maskTop);
  for (let y = maskTop; y < maskBottom; y++) {
    const dT = y - maskTop + 1;
    const dB = maskBottom - y;
    wT_arr[y - maskTop] = 1 / Math.pow(dT, 1.8);
    wB_arr[y - maskTop] = 1 / Math.pow(dB, 1.8);
  }

  // Precompute trigonometric sine & cosine tables for dynamic high-frequency video grain (film noise shaping)
  const sinValsX = new Float32Array(maskRight - maskLeft);
  const cosValsX = new Float32Array(maskRight - maskLeft);
  for (let x = maskLeft; x < maskRight; x++) {
    const val = x * 0.17;
    sinValsX[x - maskLeft] = Math.sin(val);
    cosValsX[x - maskLeft] = Math.cos(val);
  }

  const sinValsY = new Float32Array(maskBottom - maskTop);
  const cosValsY = new Float32Array(maskBottom - maskTop);
  for (let y = maskTop; y < maskBottom; y++) {
    const val = y * 0.23;
    sinValsY[y - maskTop] = Math.sin(val);
    cosValsY[y - maskTop] = Math.cos(val);
  }

  for (let y = maskTop; y < maskBottom; y++) {
    const yIdx = y - maskTop;
    const colorL = colorsL[yIdx];
    const colorR = colorsR[yIdx];
    const wT = wT_arr[yIdx];
    const wB = wB_arr[yIdx];

    const sinY = sinValsY[yIdx];
    const cosY = cosValsY[yIdx];

    const dT = y - maskTop + 1;
    const dB = maskBottom - y;

    for (let x = maskLeft; x < maskRight; x++) {
      const xIdx = x - maskLeft;
      const idx = (y * w + x) * 4;

      const dL = x - maskLeft + 1;
      const dR = maskRight - x;

      const wL = wL_arr[xIdx];
      const wR = wR_arr[xIdx];

      const totalWeight = wL + wR + wT + wB;

      // Retrieve precomputed boundary averages
      const colorT = colorsT[xIdx];
      const colorB = colorsB[xIdx];

      // Mathematical bi-harmonic blend
      let r = (colorL[0] * wL + colorR[0] * wR + colorT[0] * wT + colorB[0] * wB) / totalWeight;
      let g = (colorL[1] * wL + colorR[1] * wR + colorT[1] * wT + colorB[1] * wB) / totalWeight;
      let b = (colorL[2] * wL + colorR[2] * wR + colorT[2] * wT + colorB[2] * wB) / totalWeight;

      // Apply Boundary Feathering to blend raw inpaint transition seamlessly with original background
      const distToBorder = Math.min(dL - 1, dR - 1, dT - 1, dB - 1);
      if (distToBorder < featherSize && featherSize > 0) {
        // Organic sinusoidal curve produces a smoother transition than linear interpolation
        const ratio = distToBorder / featherSize;
        const blendFactor = Math.sin(ratio * Math.PI / 2); // 0 at boundary (use original), 1 deep inside (use inpaint)
        
        const origR = original[idx];
        const origG = original[idx + 1];
        const origB = original[idx + 2];

        r = origR * (1 - blendFactor) + r * blendFactor;
        g = origG * (1 - blendFactor) + g * blendFactor;
        b = origB * (1 - blendFactor) + b * blendFactor;
      }

      // Match high-frequency video grain (dynamic noise injection) to prevent the "smudged plastic" look
      if (noiseIntensity > 0) {
        // Use precomputed trigonometric values to calculate Math.sin(A + B) (Fast!)
        const sinX = sinValsX[xIdx];
        const cosX = cosValsX[xIdx];
        const spatialSin = sinX * cosY + cosX * sinY;
        const grainMultiplier = 0.5 + 0.5 * spatialSin; // spatial noise shaping
        const noise = (Math.random() - 0.5) * noiseIntensity * (0.6 + 0.8 * grainMultiplier);
        r = Math.max(0, Math.min(255, r + noise));
        g = Math.max(0, Math.min(255, g + noise));
        b = Math.max(0, Math.min(255, b + noise));
      }

      data[idx] = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, sX, sY);
}
