export interface Point {
  x: number;
  y: number;
}

export interface GridConfig {
  origin: Point; // Center of the top-left well
  u: Point;      // Vector from one well to the next in a row
  v: Point;      // Vector from one well to the next in a column
}

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface WellResult {
  id: string;
  row: number;
  col: number;
  center: Point;
  avgColor: RGB;
  intensity: number; // 0-1 scale
  viability: number; // 0-100 scale
}

export interface ConcentrationPoint {
  wellId: string;
  concentration: number;
}