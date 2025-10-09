import type { Point, WellResult, RGB, GridConfig } from '../types';

// Further reduced radius factor for more conservative sampling, avoiding edges and glare spots near edges.
const WELL_RADIUS_FACTOR = 0.30; 

interface Lab { l: number; a: number; b: number; }

export interface AnalysisOutput {
  wellResults: WellResult[];
  ic50: { value: number; units: string; } | null;
}

/**
 * Converts an RGB color value to the perceptually uniform CIE L*a*b* color space.
 * This is the standard for accurate color difference measurement.
 * The conversion is a two-step process: RGB -> XYZ -> L*a*b*.
 */
function rgbToLab(rgb: RGB): Lab {
    // Step 1: sRGB to linear RGB
    let r = rgb.r / 255;
    let g = rgb.g / 255;
    let b = rgb.b / 255;

    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
    
    // Step 2: Linear RGB to XYZ (using D65 illuminant reference)
    const x = r * 0.4124564 + g * 0.3575761 + b * 0.1804375;
    const y = r * 0.2126729 + g * 0.7151522 + b * 0.0721750;
    const z = r * 0.0193339 + g * 0.1191920 + b * 0.9503041;
    
    // Step 3: XYZ to L*a*b*
    let varX = x / 0.95047; // Observer= 2°, Illuminant= D65
    let varY = y / 1.00000;
    let varZ = z / 1.08883;

    const f = (t: number) => (t > 0.008856) ? Math.pow(t, 1 / 3) : (7.787 * t) + (16 / 116);

    varX = f(varX);
    varY = f(varY);
    varZ = f(varZ);

    const l = (116 * varY) - 16;
    const a = 500 * (varX - varY);
    const b_lab = 200 * (varY - varZ);
    
    return { l: l, a: a, b: b_lab };
}

/**
 * Converts a CIE L*a*b* color value back to sRGB.
 * This is the reverse of the rgbToLab conversion.
 */
function labToRgb(lab: Lab): RGB {
    let y = (lab.l + 16) / 116;
    let x = lab.a / 500 + y;
    let z = y - lab.b / 200;

    const f_inv = (t: number) => (t > 0.206897) ? Math.pow(t, 3) : (t - 16 / 116) / 7.787;

    x = f_inv(x) * 0.95047;
    y = f_inv(y) * 1.00000;
    z = f_inv(z) * 1.08883;
    
    // XYZ to linear RGB (D65 illuminant)
    let r = x *  3.2404542 + y * -1.5371385 + z * -0.4985314;
    let g = x * -0.9692660 + y *  1.8760108 + z *  0.0415560;
    let b = x *  0.0556434 + y * -0.2040259 + z *  1.0572252;
    
    // Linear RGB to sRGB
    const toSrgb = (c: number) => (c > 0.0031308) ? (1.055 * Math.pow(c, 1 / 2.4) - 0.055) : (12.92 * c);
    
    r = toSrgb(r);
    g = toSrgb(g);
    b = toSrgb(b);

    // Clamp and scale to 0-255
    const clamp = (val: number) => Math.max(0, Math.min(255, Math.round(val * 255)));

    return { r: clamp(r), g: clamp(g), b: clamp(b) };
}

function getPixelData(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): RGB[] {
  radius = Math.max(1, Math.round(radius));
  const pixels: RGB[] = [];
  try {
    const imageData = ctx.getImageData(Math.round(x - radius), Math.round(y - radius), radius * 2, radius * 2);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const px = (i / 4) % (radius * 2);
      const py = Math.floor((i / 4) / (radius * 2));
      const dist = Math.sqrt(Math.pow(px - radius, 2) + Math.pow(py - radius, 2));
      if (dist <= radius) {
        pixels.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
      }
    }
  } catch (e) {
    console.error("Error getting pixel data for well at", {x, y, radius}, e);
  }
  return pixels;
}

/**
 * Calculates a robust representative color by finding the median color in the CIELAB space.
 * This method is highly resistant to outliers like glare and shadows.
 */
function getRobustAverageColor(pixels: RGB[]): RGB {
    if (pixels.length === 0) {
        return { r: 0, g: 0, b: 0 };
    }
    if (pixels.length === 1) {
        return pixels[0];
    }

    const labPixels = pixels.map(rgbToLab);
    
    const l_values = labPixels.map(p => p.l).sort((a, b) => a - b);
    const a_values = labPixels.map(p => p.a).sort((a, b) => a - b);
    const b_values = labPixels.map(p => p.b).sort((a, b) => a - b);

    const mid = Math.floor(l_values.length / 2);
    const medianL = l_values.length % 2 === 0 ? (l_values[mid - 1] + l_values[mid]) / 2 : l_values[mid];
    const medianA = a_values.length % 2 === 0 ? (a_values[mid - 1] + a_values[mid]) / 2 : a_values[mid];
    const medianB = b_values.length % 2 === 0 ? (b_values[mid - 1] + b_values[mid]) / 2 : b_values[mid];
    
    const medianLabColor: Lab = { l: medianL, a: medianA, b: medianB };
    
    return labToRgb(medianLabColor);
}

function calculateIC50(
  wellResults: WellResult[],
  rowConcentrations: number[],
  rowCount: number,
  units: string
): { value: number; units: string; } | null {
  if (rowConcentrations.filter(c => c > 0).length < 2) return null;
  
  const viabilitiesByRow: number[][] = Array.from({ length: rowCount }, () => []);
  wellResults.forEach(well => {
      if (well.row < rowCount) {
        viabilitiesByRow[well.row].push(well.viability);
      }
  });

  const dataPoints = rowConcentrations
    .map((concentration, rowIndex) => {
        if (concentration <= 0 || viabilitiesByRow[rowIndex]?.length === 0) {
            return null;
        }
        const viabilities = viabilitiesByRow[rowIndex];
        const avgViability = viabilities.reduce((sum, v) => sum + v, 0) / viabilities.length;
        return {
            concentration,
            viability: avgViability
        };
    })
    .filter((p): p is { concentration: number; viability: number } => p !== null)
    .sort((a, b) => a.concentration - b.concentration);

  if (dataPoints.length < 2) return null;
  
  let p1: { concentration: number; viability: number; } | null = null;
  let p2: { concentration: number; viability: number; } | null = null;

  for (let i = 0; i < dataPoints.length - 1; i++) {
    const currentPoint = dataPoints[i];
    const nextPoint = dataPoints[i+1];
    if ((currentPoint.viability >= 50 && nextPoint.viability < 50) || (currentPoint.viability < 50 && nextPoint.viability >= 50)) {
        if (currentPoint.viability < nextPoint.viability) {
            p1 = currentPoint;
            p2 = nextPoint;
        } else {
            p1 = nextPoint;
            p2 = currentPoint;
        }
        break;
    }
  }

  if (!p1 || !p2) return null;

  const { concentration: conc1, viability: viability1 } = p1;
  const { concentration: conc2, viability: viability2 } = p2;

  if (Math.abs(viability2 - viability1) < 1e-6) return null;

  const ic50Value = conc1 + (50 - viability1) * (conc2 - conc1) / (viability2 - viability1);

  if (isNaN(ic50Value) || !isFinite(ic50Value)) return null;

  return { value: ic50Value, units };
}


export async function processWellPlate(
  imageUrl: string,
  gridConfig: GridConfig,
  rowCount: number,
  colCount: number,
  controlNegativePoint: Point,
  controlPositivePoint: Point,
  rowConcentrations: number[],
  concentrationUnits: string,
): Promise<AnalysisOutput> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = imageUrl;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return reject(new Error('Could not get canvas context'));
      }
      ctx.drawImage(image, 0, 0);
      
      const { origin, u, v } = gridConfig;
      
      const u_mag = Math.hypot(u.x, u.y);
      const v_mag = Math.hypot(v.x, v.y);
      
      const radius = Math.min(u_mag, v_mag) * WELL_RADIUS_FACTOR;

      if (radius === 0 || !isFinite(radius)) {
        return reject(new Error('Could not determine a valid well radius. Check grid selection and dimensions.'));
      }

      const minColorPixels = getPixelData(ctx, controlNegativePoint.x, controlNegativePoint.y, radius);
      const maxColorPixels = getPixelData(ctx, controlPositivePoint.x, controlPositivePoint.y, radius);

      if (minColorPixels.length === 0 || maxColorPixels.length === 0) {
        return reject(new Error('Could not sample reference colors. Please ensure calibration points are inside wells.'));
      }
      
      const minRefRgb = getRobustAverageColor(minColorPixels);
      const maxRefRgb = getRobustAverageColor(maxColorPixels);

      const labMin = rgbToLab(minRefRgb);
      const labMax = rgbToLab(maxRefRgb);

      const gradientVector = {
          l: labMax.l - labMin.l,
          a: labMax.a - labMin.a,
          b: labMax.b - labMin.b
      };
      const gradientMagSq = Math.pow(gradientVector.l, 2) + Math.pow(gradientVector.a, 2) + Math.pow(gradientVector.b, 2);

      const results: WellResult[] = [];
      
      for (let row = 0; row < rowCount; row++) {
        for (let col = 0; col < colCount; col++) {
          const centerX = origin.x + col * u.x + row * v.x;
          const centerY = origin.y + col * u.y + row * v.y;
          
          const pixels = getPixelData(ctx, centerX, centerY, radius);
          const avgColor = getRobustAverageColor(pixels);

          let intensity = 0;
          let viability = 0;

          if (pixels.length > 0 && gradientMagSq > 1e-6) {
              const labWell = rgbToLab(avgColor);
              const wellVector = {
                  l: labWell.l - labMin.l,
                  a: labWell.a - labMin.a,
                  b: labWell.b - labMin.b
              };
              const dotProduct = (wellVector.l * gradientVector.l) + (wellVector.a * gradientVector.a) + (wellVector.b * gradientVector.b);
              
              intensity = dotProduct / gradientMagSq;
              intensity = Math.max(0, Math.min(1, intensity));
              viability = intensity * 100;
          }
          
          results.push({
            id: `${String.fromCharCode(65 + row)}${col + 1}`,
            row,
            col,
            center: { x: centerX, y: centerY },
            avgColor,
            intensity,
            viability
          });
        }
      }
      
      const ic50 = calculateIC50(results, rowConcentrations, rowCount, concentrationUnits);
      resolve({ wellResults: results, ic50 });
    };
    image.onerror = (err) => reject(err);
  });
}